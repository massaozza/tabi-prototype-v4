// /api/admin-spot-migrate.ts
// Vercel Serverless Function（Edge Runtime）
//
// 既存367件のSpotを content:destinations（単一JSON配列）から
// spot:{id}（個別キー）へ移行する。
//
// 【設計方針】
// 1. 既存IDを一切変更しない。IDがURLとリレーションの両方を兼ねているため、
//    変えるとSEO資産と Trip / Guide / Review / Experience の紐づけが壊れる。
// 2. 移行前に必ずバックアップを取る。
// 3. content:destinations は移行では書き換えない。
//    移行が失敗しても既存サイトは動き続ける。
// 4. 冪等。何度実行してもSpotは増えない（IDが同じなら上書き）。
//
// 実行順序：
//   POST ?action=backup   … バックアップのみ
//   POST ?action=migrate  … 移行（バックアップ未実施なら自動で取る）
//   GET  ?action=verify   … 移行結果の検証レポート
//   POST ?action=rollback&stamp=xxx … バックアップから復元
//
// すべて管理者認証必須。

import { kv } from '@vercel/kv';
import { destinations as mockDestinations } from '../src/mocks/homeData.js';
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import {
  type Spot,
  LEGACY_CACHE_KEY,
  MIGRATION_FLAG,
  backupKey,
  getSpot,
  getSpots,
  listSpotIds,
  bulkSaveSpots,
  rebuildDerivedCache,
  deriveEnrichmentLevel,
} from './_spotStore.js';

export const config = { runtime: 'edge', maxDuration: 60 };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface LegacySpot {
  id?: string;
  title?: string;
  category?: string;
  prefecture?: string;
  description?: string;
  lat?: number;
  lng?: number;
  image?: string;
}

/**
 * 移行元データを読む。
 *
 * 【重要】content:destinations は空の可能性がある。
 * /api/content の GET は `kv.get(...) ?? FALLBACK_DATA` という実装で、
 * KVが空のときは src/mocks/homeData.ts の値を返している。
 * つまり現在表示されている367件の正データは KV ではなくソースコードにある。
 *
 * そのため移行元は「KV → 無ければ mocks」の順で解決する。
 * これを間違えると0件を移して空振りする。
 */
async function readLegacy(): Promise<{ list: LegacySpot[]; origin: 'kv' | 'mocks' | 'none' }> {
  try {
    const fromKv = await kv.get<LegacySpot[]>(LEGACY_CACHE_KEY);
    if (Array.isArray(fromKv) && fromKv.length > 0) {
      return { list: fromKv, origin: 'kv' };
    }
  } catch {
    /* KVが読めない場合も mocks にフォールバックする */
  }

  const fromMocks = mockDestinations as unknown as LegacySpot[];
  if (Array.isArray(fromMocks) && fromMocks.length > 0) {
    return { list: fromMocks, origin: 'mocks' };
  }
  return { list: [], origin: 'none' };
}

/** バックアップを取る。戻り値はタイムスタンプ */
async function createBackup(): Promise<{ stamp: string; count: number; origin: string }> {
  const { list, origin } = await readLegacy();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  // KVの現在値もそのまま残す（空なら空として記録し、復元時に元の状態へ戻せる）
  const kvCurrent = await kv.get<LegacySpot[]>(LEGACY_CACHE_KEY).catch(() => null);
  await kv.set(backupKey(stamp), { source: list, kvBefore: kvCurrent, origin });
  await kv.sadd('backup:destinations:index', stamp);
  return { stamp, count: list.length, origin };
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // ───────────────────────────────────────────
  // 検証レポート
  // ───────────────────────────────────────────
  if (req.method === 'GET' && (action === 'verify' || !action)) {
    const { list: legacy, origin: legacyOrigin } = await readLegacy();
    const legacyIds = legacy.map((s) => s.id).filter((v): v is string => Boolean(v));
    const spotIds = await listSpotIds();
    const spots = await getSpots(spotIds);

    const spotIdSet = new Set(spotIds);
    const legacyIdSet = new Set(legacyIds);

    // ID一致
    const matched = legacyIds.filter((id) => spotIdSet.has(id));
    const missingInNew = legacyIds.filter((id) => !spotIdSet.has(id));
    const extraInNew = spotIds.filter((id) => !legacyIdSet.has(id));

    // フィールドが移行前後で一致しているか（URL＝IDの維持確認を含む）
    const fieldMismatch: { id: string; field: string; before: unknown; after: unknown }[] = [];
    const byId = new Map(spots.map((s) => [s.id, s]));
    for (const l of legacy) {
      if (!l.id) continue;
      const n = byId.get(l.id);
      if (!n) continue;
      for (const f of ['title', 'category', 'prefecture', 'description', 'lat', 'lng', 'image'] as const) {
        if (l[f] !== undefined && l[f] !== n[f]) {
          fieldMismatch.push({ id: l.id, field: f, before: l[f], after: n[f] });
        }
      }
    }

    // リレーションの生存確認
    const relationChecks = await Promise.all(
      spotIds.map(async (id) => {
        const [guides, experiences] = await Promise.all([
          kv.scard(`spot:${id}:guides`).catch(() => 0),
          kv.scard(`spot:${id}:experiences`).catch(() => 0),
        ]);
        return { id, guides: Number(guides), experiences: Number(experiences) };
      })
    );
    const withGuides = relationChecks.filter((r) => r.guides > 0);
    const withExperiences = relationChecks.filter((r) => r.experiences > 0);

    // 孤児リレーション（Spotが存在しないのに索引が残っている）
    const orphanRelations: string[] = [];
    for (const r of relationChecks) {
      if ((r.guides > 0 || r.experiences > 0) && !spotIdSet.has(r.id)) orphanRelations.push(r.id);
    }

    // completeness の分布
    const completenessStats = {
      baseData: 0,
      editorialContent: 0,
      officialInfo: 0,
      localKnowledge: 0,
      actualData: 0,
    };
    const levelStats: Record<number, number> = {};
    for (const s of spots) {
      if (s.completeness) {
        for (const k of Object.keys(completenessStats) as (keyof typeof completenessStats)[]) {
          if (s.completeness[k]) completenessStats[k] += 1;
        }
        const lv = deriveEnrichmentLevel(s.completeness);
        levelStats[lv] = (levelStats[lv] || 0) + 1;
      }
    }

    // 日光東照宮の回帰確認
    const nikko = await getSpot('nikko-toshogu');
    const nikkoLegacy = legacy.find((s) => s.id === 'nikko-toshogu');
    const nikkoReport = {
      existsInLegacy: Boolean(nikkoLegacy),
      existsInNew: Boolean(nikko),
      idPreserved: nikko?.id === 'nikko-toshogu',
      url: '/en/destinations/nikko-toshogu',
      fieldsMatch: nikkoLegacy && nikko
        ? (['title', 'category', 'prefecture', 'description', 'lat', 'lng', 'image'] as const).every(
            (f) => nikkoLegacy[f] === nikko[f]
          )
        : false,
      relatedGuides: nikko ? Number(await kv.scard('spot:nikko-toshogu:guides').catch(() => 0)) : 0,
      relatedExperiences: nikko
        ? Number(await kv.scard('spot:nikko-toshogu:experiences').catch(() => 0))
        : 0,
      completeness: nikko?.completeness ?? null,
    };

    const backupStamps = ((await kv.smembers('backup:destinations:index')) || []) as string[];

    return json({
      migrated: Boolean(await kv.get(MIGRATION_FLAG)),
      // 移行元がKVかmocksかを明示する（0件で空振りするのを防ぐため）
      legacySource: legacyOrigin,
      counts: {
        legacy: legacy.length,
        newStore: spotIds.length,
        idMatched: matched.length,
        missingInNewStore: missingInNew.length,
        extraInNewStore: extraInNew.length,
      },
      urlChanges: fieldMismatch.filter((m) => m.field === 'id').length,
      fieldMismatchCount: fieldMismatch.length,
      fieldMismatchSamples: fieldMismatch.slice(0, 10),
      missingIds: missingInNew.slice(0, 20),
      relations: {
        spotsWithGuides: withGuides.length,
        spotsWithExperiences: withExperiences.length,
        orphanRelations: orphanRelations.length,
        orphanSamples: orphanRelations.slice(0, 10),
      },
      completeness: completenessStats,
      enrichmentLevels: levelStats,
      nikkoToshogu: nikkoReport,
      backups: backupStamps,
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ───────────────────────────────────────────
  // バックアップ
  // ───────────────────────────────────────────
  if (action === 'backup') {
    const result = await createBackup();
    return json({ success: true, ...result });
  }

  // ───────────────────────────────────────────
  // ロールバック
  // ───────────────────────────────────────────
  if (action === 'rollback') {
    const stamp = url.searchParams.get('stamp');
    if (!stamp) return json({ error: 'stamp query parameter is required' }, 400);

    const backup = await kv.get<{
      source?: LegacySpot[];
      kvBefore?: LegacySpot[] | null;
      origin?: string;
    }>(backupKey(stamp));
    if (!backup) return json({ error: 'Backup not found' }, 404);

    // 移行前のKVの状態に正確に戻す。
    // 元が空（mocksで表示されていた）なら、キーを削除して空の状態に戻す。
    if (Array.isArray(backup.kvBefore) && backup.kvBefore.length > 0) {
      await kv.set(LEGACY_CACHE_KEY, backup.kvBefore);
    } else {
      await kv.del(LEGACY_CACHE_KEY);
    }
    await kv.del(MIGRATION_FLAG);

    return json({
      success: true,
      restoredTo: Array.isArray(backup.kvBefore) && backup.kvBefore.length > 0 ? 'kv snapshot' : 'empty (mocks fallback)',
      sourceCount: backup.source?.length ?? 0,
      note: 'Migration flag cleared. spot:{id} records were left in place; the site now reads the pre-migration source again.',
    });
  }

  // ───────────────────────────────────────────
  // 移行
  // ───────────────────────────────────────────
  if (action === 'migrate') {
    const { list: legacy, origin } = await readLegacy();
    if (legacy.length === 0) {
      return json(
        { error: 'No legacy spot data found in KV or mocks. Nothing to migrate.' },
        400
      );
    }

    // ── バッチ処理にしている理由 ──
    // 1件ずつ saveSpot() を呼ぶと1件あたりKV操作が9回発生し、
    // 367件では約3,300往復になってEdge Functionの実行時間を超える（実測504）。
    // offset / limit で分割し、呼び出し側が続きから再開できるようにする。
    // 冪等なので、同じ範囲を二度実行してもSpotは増えない。
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(url.searchParams.get('limit') || '120', 10) || 120)
    );

    // バックアップは最初のバッチでだけ取る
    let backupStamp: string | null = null;
    if (offset === 0) {
      const backup = await createBackup();
      backupStamp = backup.stamp;
    }

    const slice = legacy.slice(offset, offset + limit);
    const errors: { id: string; error: string }[] = [];
    const seen = new Set<string>();
    const prepared: Spot[] = [];

    for (const l of slice) {
      if (!l.id || typeof l.id !== 'string') {
        errors.push({ id: String(l.id), error: 'missing id' });
        continue;
      }
      if (seen.has(l.id)) {
        errors.push({ id: l.id, error: 'duplicate id in legacy data' });
        continue;
      }
      seen.add(l.id);

      prepared.push({
        id: l.id,
        title: l.title || '',
        category: l.category || '',
        prefecture: l.prefecture || '',
        description: l.description || '',
        lat: typeof l.lat === 'number' ? l.lat : 0,
        lng: typeof l.lng === 'number' ? l.lng : 0,
        image: l.image || '',
        status: 'published',
        sources: [{ type: 'TABI47_LEGACY', syncedAt: new Date().toISOString() }],
        // 既存データはすべてTABI47が用意したものなので、
        // フィールド単位の出典もLEGACYとして記録する
        fieldSources: {
          title: 'TABI47_LEGACY',
          category: 'TABI47_LEGACY',
          prefecture: 'TABI47_LEGACY',
          description: 'TABI47_LEGACY',
          lat: 'TABI47_LEGACY',
          lng: 'TABI47_LEGACY',
          image: 'TABI47_LEGACY',
        },
      });
    }

    // completeness は bulkSaveSpots が実データから判定する（固定値を入れない）
    const result = await bulkSaveSpots(prepared, 'published');
    errors.push(...result.errors);

    const nextOffset = offset + slice.length;
    const done = nextOffset >= legacy.length;

    // 全バッチが終わったら、派生キャッシュを再構築して完了フラグを立てる
    let cache: { count: number; skipped: boolean } | null = null;
    if (done) {
      cache = await rebuildDerivedCache();
      await kv.set(MIGRATION_FLAG, new Date().toISOString());
    }

    return json({
      success: true,
      legacySource: origin,
      legacyCount: legacy.length,
      offset,
      limit,
      processed: slice.length,
      written: result.written,
      errors: errors.length,
      errorSamples: errors.slice(0, 10),
      nextOffset: done ? null : nextOffset,
      done,
      backupStamp,
      derivedCache: cache,
      hint: done
        ? 'Migration complete. Run action=verify to check the result.'
        : `Run again with ?action=migrate&offset=${nextOffset} to continue.`,
    });
  }

  // ───────────────────────────────────────────
  // 索引の再構築（索引だけが壊れた場合の修復用）
  // ───────────────────────────────────────────
  if (action === 'reindex') {
    // migrate と同じ理由でバッチ処理にする（逐次だとタイムアウトする）
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(url.searchParams.get('limit') || '120', 10) || 120)
    );

    const allIds = await listSpotIds();
    const slice = allIds.slice(offset, offset + limit);
    const spots = await getSpots(slice);

    // bulkSaveSpots が completeness を再判定する
    // （Guide / Experience が後から増えた場合に反映される）
    const result = await bulkSaveSpots(spots);

    const nextOffset = offset + slice.length;
    const done = nextOffset >= allIds.length;
    const cache = done ? await rebuildDerivedCache() : null;

    return json({
      success: true,
      total: allIds.length,
      offset,
      processed: slice.length,
      reindexed: result.written,
      errors: result.errors.length,
      nextOffset: done ? null : nextOffset,
      done,
      derivedCache: cache,
      hint: done ? 'Reindex complete.' : `Run again with ?action=reindex&offset=${nextOffset}.`,
    });
  }

  return json({ error: 'Unknown action. Use backup / migrate / verify / rollback / reindex.' }, 400);
}
