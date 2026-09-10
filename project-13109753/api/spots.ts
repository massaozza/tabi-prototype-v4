// /api/spots.ts
// Vercel Serverless Function（Edge Runtime）
//
// Spot単位の読み書きAPI。
//
// 【なぜ新設したか】
// 以前のSpot更新は POST /api/content?type=destinations による
// 「367件の配列を丸ごと置換する」方式しかなかった。
// この方式では、Import処理と管理画面の保存が同時に走ると
// 後から書いた側が相手の変更を丸ごと消してしまう。
// 1件だけ直す操作でも全件を送り直す必要もあった。
//
// このAPIは1件単位で更新するため、同時実行でも他のSpotに影響しない。
//
// GET    /api/spots                      → 公開Spot一覧（認証不要）
// GET    /api/spots?id=xxx               → 1件取得（認証不要）
// GET    /api/spots?prefecture=Tochigi   → 都道府県で絞り込み
// GET    /api/spots?status=draft         → 状態で絞り込み（管理者のみ）
// POST   /api/spots                      → 新規作成（管理者のみ）
// PATCH  /api/spots?id=xxx               → 部分更新（管理者のみ）
// DELETE /api/spots?id=xxx               → 削除（管理者のみ・原則は使わない）
//
// 【Edge Runtimeにしている理由】
// Vercel無料プランのNode.js Serverless Functionが上限12本に達しているため。

import { kv } from '@vercel/kv';
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import {
  type Spot,
  type SpotStatus,
  getSpot,
  getSpots,
  listPublishedSpots,
  saveSpot,
  patchSpot,
  deleteSpot,
  prefIndexKey,
  statusIndexKey,
  deriveEnrichmentLevel,
} from './_spotStore.js';
import { buildWikiContent, fetchOsmTagsById } from './_wikiContent.js';

export const config = { runtime: 'edge' };

const VALID_STATUS: SpotStatus[] = ['published', 'draft', 'staging', 'rejected'];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 保存前の検証。壊れたデータでSpotを作らせない */
function validateSpotInput(input: unknown): { ok: true; spot: Spot } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Body must be an object' };
  const s = input as Record<string, unknown>;

  if (typeof s.id !== 'string' || !/^[a-z0-9-]+$/.test(s.id)) {
    return { ok: false, error: 'id must be a slug (lowercase letters, numbers, hyphens)' };
  }
  if (typeof s.title !== 'string' || !s.title.trim()) {
    return { ok: false, error: 'title is required' };
  }
  if (typeof s.lat !== 'number' || typeof s.lng !== 'number') {
    return { ok: false, error: 'lat and lng must be numbers' };
  }
  if (s.lat < 20 || s.lat > 46 || s.lng < 122 || s.lng > 154) {
    // 日本の範囲から外れる座標は入力ミスの可能性が高い
    return { ok: false, error: 'Coordinates are outside Japan' };
  }
  if (s.status !== undefined && !VALID_STATUS.includes(s.status as SpotStatus)) {
    return { ok: false, error: `status must be one of: ${VALID_STATUS.join(', ')}` };
  }

  return {
    ok: true,
    spot: {
      id: s.id,
      title: String(s.title).slice(0, 300),
      category: typeof s.category === 'string' ? s.category : '',
      prefecture: typeof s.prefecture === 'string' ? s.prefecture : '',
      description: typeof s.description === 'string' ? s.description.slice(0, 5000) : '',
      lat: s.lat as number,
      lng: s.lng as number,
      image: typeof s.image === 'string' ? s.image : '',
      city: typeof s.city === 'string' ? s.city : undefined,
      address: typeof s.address === 'string' ? s.address : undefined,
      officialUrl: typeof s.officialUrl === 'string' ? s.officialUrl : undefined,
      openingHours: typeof s.openingHours === 'string' ? s.openingHours : undefined,
      admission: typeof s.admission === 'string' ? s.admission : undefined,
      access: typeof s.access === 'string' ? s.access : undefined,
      canonicalCategory: typeof s.canonicalCategory === 'string' ? s.canonicalCategory : undefined,
      aliases: Array.isArray(s.aliases)
        ? (s.aliases.filter((a) => typeof a === 'string') as string[]).slice(0, 20)
        : undefined,
      status: (s.status as SpotStatus) || 'published',
      sources: Array.isArray(s.sources) ? (s.sources as Spot['sources']) : undefined,
      fieldSources:
        s.fieldSources && typeof s.fieldSources === 'object'
          ? (s.fieldSources as Spot['fieldSources'])
          : undefined,
    },
  };
}

/** レスポンス用に enrichmentLevel を付ける（保存はしない派生値） */
function withLevel(spot: Spot) {
  return {
    ...spot,
    enrichmentLevel: spot.completeness ? deriveEnrichmentLevel(spot.completeness) : 1,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  // ── GET ──
  if (req.method === 'GET') {
    if (id) {
      const spot = await getSpot(id);
      if (!spot) return json({ error: 'Spot not found' }, 404);
      // 非公開Spotは管理者だけに見せる
      if (spot.status && spot.status !== 'published' && !(await isAdminRequest(req))) {
        return json({ error: 'Spot not found' }, 404);
      }
      return json({ spot: withLevel(spot) });
    }

    const prefecture = url.searchParams.get('prefecture');
    const status = url.searchParams.get('status');

    // 状態指定は管理者専用（下書きや却下データを公開しない）
    if (status) {
      if (!(await isAdminRequest(req))) return adminUnauthorized();
      if (!VALID_STATUS.includes(status as SpotStatus)) {
        return json({ error: 'Invalid status' }, 400);
      }
      const ids = ((await kv.smembers(statusIndexKey(status as SpotStatus))) || []) as string[];
      const spots = await getSpots(ids.filter(Boolean));
      return json({ spots: spots.map(withLevel), count: spots.length });
    }

    if (prefecture) {
      const ids = ((await kv.smembers(prefIndexKey(prefecture))) || []) as string[];
      const all = await getSpots(ids.filter(Boolean));
      const isAdmin = await isAdminRequest(req);
      const spots = isAdmin ? all : all.filter((s) => !s.status || s.status === 'published');
      return json({ spots: spots.map(withLevel), count: spots.length });
    }

    const spots = await listPublishedSpots();
    return json({ spots: spots.map(withLevel), count: spots.length });
  }

  // ── ここから先は管理者のみ ──
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  // ── POST ?action=regenerateContent: OSM由来の説明文・写真をやり直す ──
  //
  // 【なぜ必要か】
  // OSM StagingからCreate as draftする際、Wikidata/Wikipediaの取得や
  // AIによる整形が失敗すると description/image が空のまま作成される。
  // Staging側は一度Reviewすると使い切りになり、同じ候補で
  // やり直すことができない。既存Spotのsourcesに残るOSM出典情報
  // （osmType/osmId）から、直接タグを取り直してこの処理をやり直せる
  // ようにする。
  if (req.method === 'POST' && url.searchParams.get('action') === 'regenerateContent') {
    if (!id) return json({ error: 'id query parameter is required' }, 400);

    const spot = await getSpot(id);
    if (!spot) return json({ error: 'Spot not found' }, 404);

    const osmSource = (spot.sources || []).find((s) => s.type === 'OSM' && s.id);
    if (!osmSource?.id) {
      return json({ error: 'This spot has no OSM source to regenerate content from' }, 400);
    }
    const [osmType, osmId] = osmSource.id.split('/');
    if (!osmType || !osmId) {
      return json({ error: `Malformed OSM source id: "${osmSource.id}"` }, 400);
    }

    const tags = await fetchOsmTagsById(osmType, osmId);
    if (!tags) {
      return json({ error: 'Could not fetch OSM tags for this element (Overpass unavailable or element not found)' }, 502);
    }

    const wiki = await buildWikiContent(spot.title, tags);
    if (!wiki) {
      return json({
        success: false,
        note: 'No Wikidata/Wikipedia content found, or AI rewrite failed. Spot left unchanged.',
      });
    }

    const patch: Partial<Spot> = {
      description: wiki.description,
      fieldSources: { ...(spot.fieldSources || {}), description: 'AI_DERIVED' },
      sources: [
        ...(spot.sources || []).filter((s) => s.type !== 'AI_DERIVED' && s.type !== 'WIKIMEDIA'),
        { type: 'AI_DERIVED', url: wiki.descriptionSourceUrl, syncedAt: new Date().toISOString() },
      ],
    };
    if (wiki.image) {
      patch.image = wiki.image.url;
      patch.imageCredit = {
        author: wiki.image.author,
        license: wiki.image.license,
        licenseUrl: wiki.image.licenseUrl,
        sourceUrl: wiki.image.sourceUrl,
      };
      patch.sources!.push({
        type: 'WIKIMEDIA',
        url: wiki.image.sourceUrl,
        syncedAt: new Date().toISOString(),
      });
      patch.fieldSources!.image = 'WIKIMEDIA';
    }

    const updated = await patchSpot(id, patch);
    return json({ success: true, spot: updated ? withLevel(updated) : null });
  }

  // ── POST: 新規作成 ──
  if (req.method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const checked = validateSpotInput(body);
    if (checked.ok === false) return json({ error: checked.error }, 400);

    const existing = await getSpot(checked.spot.id);
    if (existing) {
      return json({ error: `Spot "${checked.spot.id}" already exists. Use PATCH to update.` }, 409);
    }

    await saveSpot(checked.spot);
    const saved = await getSpot(checked.spot.id);
    return json({ success: true, spot: saved ? withLevel(saved) : null }, 201);
  }

  // ── PATCH: 部分更新 ──
  if (req.method === 'PATCH') {
    if (!id) return json({ error: 'id query parameter is required' }, 400);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // 座標が含まれる場合だけ範囲を確認する
    if (body.lat !== undefined || body.lng !== undefined) {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json({ error: 'lat and lng must be numbers' }, 400);
      }
      if (lat < 20 || lat > 46 || lng < 122 || lng > 154) {
        return json({ error: 'Coordinates are outside Japan' }, 400);
      }
    }
    if (body.status !== undefined && !VALID_STATUS.includes(body.status as SpotStatus)) {
      return json({ error: `status must be one of: ${VALID_STATUS.join(', ')}` }, 400);
    }

    const updated = await patchSpot(id, body as Partial<Spot>);
    if (!updated) return json({ error: 'Spot not found' }, 404);
    return json({ success: true, spot: withLevel(updated) });
  }

  // ── DELETE ──
  // 原則は status='rejected' による論理削除を使う。
  // Trip / Review / Guide が紐づいている可能性があるため。
  if (req.method === 'DELETE') {
    if (!id) return json({ error: 'id query parameter is required' }, 400);

    const [guides, experiences] = await Promise.all([
      kv.scard(`spot:${id}:guides`).catch(() => 0),
      kv.scard(`spot:${id}:experiences`).catch(() => 0),
    ]);

    // 関連コンテンツがある場合は、明示的な force なしでは削除させない
    if ((Number(guides) > 0 || Number(experiences) > 0) && url.searchParams.get('force') !== '1') {
      return json(
        {
          error: 'This spot has related content. Set status to "rejected" instead, or pass force=1.',
          relatedGuides: Number(guides),
          relatedExperiences: Number(experiences),
        },
        409
      );
    }

    const ok = await deleteSpot(id);
    if (!ok) return json({ error: 'Spot not found' }, 404);
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
