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
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import {
  type Spot,
  LEGACY_CACHE_KEY,
  MIGRATION_FLAG,
  SPOTS_INDEX,
  backupKey,
  spotKey,
  getSpot,
  getSpots,
  listSpotIds,
  saveSpot,
  rebuildDerivedCache,
  evaluateCompleteness,
  deriveEnrichmentLevel,
  statusIndexKey,
  prefIndexKey,
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

/** 移行元データを読む */
async function readLegacy(): Promise<LegacySpot[]> {
  const list = await kv.get<LegacySpot[]>(LEGACY_CACHE_KEY);
  return Array.isArray(list) ? list : [];
}

/** バックアップを取る。戻り値はタイムスタンプ */
async function createBackup(): Promise<{ stamp: string; count: number }> {
  const legacy = await readLegacy();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await kv.set(backupKey(stamp), legacy);
  await kv.sadd('backup:destinations:index', stamp);
  return { stamp, count: legacy.length };
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // ───────────────────────────────────────────
  // 検証レポート
  // ───────────────────────────────────────────
  if (req.method === 'GET' && (action === 'verify' || !action)) {
    const legacy = await readLegacy();
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

    const backup = await kv.get<LegacySpot[]>(backupKey(stamp));
    if (!Array.isArray(backup)) return json({ error: 'Backup not found' }, 404);

    // 派生キャッシュを元の内容に戻す。
    // spot:{id} 側は残るが、読み取り経路は派生キャッシュなので表示は復旧する。
    await kv.set(LEGACY_CACHE_KEY, backup);
    await kv.del(MIGRATION_FLAG);

    return json({
      success: true,
      restored: backup.length,
      note: 'content:destinations restored and migration flag cleared. spot:{id} records were left in place.',
    });
  }

  // ───────────────────────────────────────────
  // 移行
  // ───────────────────────────────────────────
  if (action === 'migrate') {
    const legacy = await readLegacy();
    if (legacy.length === 0) {
      return json({ error: 'No legacy data found in content:destinations' }, 400);
    }

    // 1. バックアップ（必ず取る）
    const backup = await createBackup();

    // 2. 1件ずつ spot:{id} へ書き込む。
    //    派生キャッシュの再構築は最後に1回だけ行う（rebuild=false）。
    const errors: { id: string; error: string }[] = [];
    let written = 0;
    const seen = new Set<string>();

    for (const l of legacy) {
      if (!l.id || typeof l.id !== 'string') {
        errors.push({ id: String(l.id), error: 'missing id' });
        continue;
      }
      if (seen.has(l.id)) {
        errors.push({ id: l.id, error: 'duplicate id in legacy data' });
        continue;
      }
      seen.add(l.id);

      try {
        const spot: Spot = {
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
        };

        // completeness は saveSpot 内で実データから判定される（固定値を入れない）
        await saveSpot(spot, false);
        written += 1;
      } catch (e) {
        errors.push({ id: l.id, error: String(e) });
      }
    }

    // 3. 派生キャッシュを spot:{id} から再構築する。
    //    ここで初めて content:destinations が新ストア由来になる。
    const cache = await rebuildDerivedCache();

    // 4. 移行完了フラグ
    await kv.set(MIGRATION_FLAG, new Date().toISOString());

    return json({
      success: true,
      backupStamp: backup.stamp,
      legacyCount: legacy.length,
      written,
      errors: errors.length,
      errorSamples: errors.slice(0, 10),
      derivedCache: cache,
    });
  }

  // ───────────────────────────────────────────
  // 索引の再構築（索引だけが壊れた場合の修復用）
  // ───────────────────────────────────────────
  if (action === 'reindex') {
    const ids = await listSpotIds();
    const spots = await getSpots(ids);
    let fixed = 0;

    for (const s of spots) {
      await kv.sadd(SPOTS_INDEX, s.id);
      if (s.prefecture) await kv.sadd(prefIndexKey(s.prefecture), s.id);
      await kv.sadd(statusIndexKey(s.status || 'published'), s.id);
      // completeness を再判定する（Guide/Experienceが後から増えた場合に反映）
      const completeness = await evaluateCompleteness(s);
      await kv.set(spotKey(s.id), { ...s, completeness });
      fixed += 1;
    }

    const cache = await rebuildDerivedCache();
    return json({ success: true, reindexed: fixed, derivedCache: cache });
  }

  return json({ error: 'Unknown action. Use backup / migrate / verify / rollback / reindex.' }, 400);
}
