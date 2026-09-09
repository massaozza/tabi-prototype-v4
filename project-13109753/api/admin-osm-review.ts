// /api/admin-osm-review.ts
// Vercel Serverless Function（Edge Runtime）
//
// Staging に置かれたOSM候補を人間が確認し、Spot Master へ反映する。
// Staging から Production へ渡す唯一の経路。
//
// GET  /api/admin-osm-review?status=POSSIBLE_MATCH  … Review待ち一覧
// GET  /api/admin-osm-review?id=xxx                 … 1件の詳細
// POST /api/admin-osm-review?id=xxx&action=...      … 判断を適用
//
// action:
//   approveNew  … 新規Spotとして作成する（既定は draft。publish=1 で公開）
//   merge       … 既存Spotに紐づける（Spotの内容は上書きしない）
//   reject      … 旅行Spotとして不適切。Productionには入れない
//   defer       … 判断を保留する
//
// 【Spotの内容を上書きしない理由（指示書6）】
// 既存の高品質なデータをOSMで自動上書きしてはいけない。
// merge では osm:src の紐づけと sources への追記だけを行い、
// title / description / image などは変更しない。
// 不足している項目だけを補う場合は fill=1 を明示的に指定する。

import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import {
  getSpot,
  saveSpot,
  patchSpot,
  type Spot,
  type SpotSource,
} from './_spotStore.js';
import type { MatchStatus } from './_osmMatching.js';
import {
  getStaging,
  listStagingIds,
  getStagingRecords,
  updateStaging,
  linkOsmToSpot,
  getStagingSummary,
  type StagingRecord,
} from './_osmStaging.js';

// 【注意】maxDuration は Edge Runtime では効かない。
// 実際の実行時間上限は約25秒なので、重い処理は必ず分割する。
export const config = { runtime: 'edge' };

const VALID_STATUS: MatchStatus[] = ['MATCHED', 'POSSIBLE_MATCH', 'NEW', 'REJECTED'];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * OSMの名称から Spot の slug を作る。
 *
 * 【IDは変更できない前提で作る】
 * SpotのIDはURLとリレーションの両方を兼ねるため、後から変えられない。
 * そのため生成時点で読みやすいslugにする。
 * タイムスタンプ由来のIDにすると /destinations/mg8x2k-a3f9j のような
 * 無意味なURLになり、SEO上も不利になる。
 */
function makeSlug(name: string, prefecture: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // 日本語などラテン文字以外はslugにできないため落とす
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (base.length >= 3) return base.slice(0, 80);

  // ラテン文字が取れない場合は都道府県名を接頭辞にする
  const pref = prefecture.toLowerCase().replace(/[^a-z]/g, '');
  return `${pref}-spot`.slice(0, 80);
}

/** 同名slugが既にある場合に連番を付ける */
async function uniqueSlug(base: string): Promise<string> {
  if (!(await getSpot(base))) return base;
  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}`;
    if (!(await getSpot(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function osmSourceOf(record: StagingRecord): SpotSource {
  return {
    type: 'OSM',
    id: `${record.osmType}/${record.osmId}`,
    url: `https://www.openstreetmap.org/${record.osmType}/${record.osmId}`,
    syncedAt: new Date().toISOString(),
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  // ── GET ──
  if (req.method === 'GET') {
    if (id) {
      const record = await getStaging(id);
      if (!record) return json({ error: 'Staging record not found' }, 404);

      // 候補Spotの現在の内容も返す（Reviewの判断材料）
      const candidateSpots = await Promise.all(
        record.candidates.map(async (c) => {
          const spot = await getSpot(c.spotId);
          return spot
            ? {
                ...c,
                spot: {
                  id: spot.id,
                  title: spot.title,
                  category: spot.category,
                  prefecture: spot.prefecture,
                  lat: spot.lat,
                  lng: spot.lng,
                  description: spot.description?.slice(0, 200),
                  completeness: spot.completeness,
                },
              }
            : { ...c, spot: null };
        })
      );

      return json({ record: { ...record, candidates: candidateSpots } });
    }

    const statusParam = url.searchParams.get('status');
    const prefecture = url.searchParams.get('prefecture');
    const onlyPending = url.searchParams.get('pending') === '1';

    let status: MatchStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUS.includes(statusParam as MatchStatus)) {
        return json({ error: 'Invalid status' }, 400);
      }
      status = statusParam as MatchStatus;
    }

    const ids = await listStagingIds(status);
    let records = await getStagingRecords(ids);

    if (prefecture) records = records.filter((r) => r.prefecture === prefecture);
    if (onlyPending) records = records.filter((r) => !r.reviewedAt);

    // 優先度での絞り込み。低スコアのものを開かずに済むようにする
    const priority = url.searchParams.get('priority');
    if (priority && ['high', 'medium', 'low'].includes(priority)) {
      records = records.filter((r) => (r.reviewPriority || 'low') === priority);
    }

    // 【並び順】
    // 未Reviewを上に。そのうえで旅行価値スコアの高いものから見せる。
    // NEWが数千件になるため、価値の高い候補から確認できないと運用できない。
    records.sort((a, b) => {
      if (Boolean(a.reviewedAt) !== Boolean(b.reviewedAt)) return a.reviewedAt ? 1 : -1;
      const sa = a.travelScore ?? 0;
      const sb = b.travelScore ?? 0;
      if (sb !== sa) return sb - sa;
      return b.confidence - a.confidence;
    });

    const summary = await getStagingSummary();
    return json({
      records: records.slice(0, 200).map((r) => ({
        id: r.id,
        name: r.name,
        aliases: r.aliases,
        prefecture: r.prefecture,
        city: r.city,
        category: r.canonicalKey,
        group: r.canonicalGroup,
        lat: r.lat,
        lng: r.lng,
        matchStatus: r.matchStatus,
        matchedSpotId: r.matchedSpotId,
        confidence: r.confidence,
        matchReason: r.matchReason,
        candidates: r.candidates,
        travelScore: r.travelScore,
        travelSignals: r.travelSignals,
        reviewPriority: r.reviewPriority,
        duplicateOf: r.duplicateOf,
        reviewedAt: r.reviewedAt,
        reviewAction: r.reviewAction,
        resultSpotId: r.resultSpotId,
        officialUrl: r.officialUrl,
      })),
      total: records.length,
      summary,
      attribution: '© OpenStreetMap contributors (ODbL 1.0)',
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!id) return json({ error: 'id query parameter is required' }, 400);

  const action = url.searchParams.get('action');
  const record = await getStaging(id);
  if (!record) return json({ error: 'Staging record not found' }, 404);

  let note = '';
  try {
    const body = await req.json();
    if (typeof body?.note === 'string') note = body.note.slice(0, 500);
  } catch {
    /* bodyは任意 */
  }

  // ───────────────────────────────────────────
  // reject: Productionには入れない
  // ───────────────────────────────────────────
  if (action === 'reject') {
    await updateStaging(id, {
      matchStatus: 'REJECTED',
      reviewedAt: new Date().toISOString(),
      reviewAction: 'rejected',
      reviewNote: note,
    });
    return json({ success: true, action: 'rejected' });
  }

  // ───────────────────────────────────────────
  // defer: 判断を保留
  // ───────────────────────────────────────────
  if (action === 'defer') {
    await updateStaging(id, {
      reviewedAt: new Date().toISOString(),
      reviewAction: 'deferred',
      reviewNote: note,
    });
    return json({ success: true, action: 'deferred' });
  }

  // ───────────────────────────────────────────
  // merge: 既存Spotに紐づける
  // ───────────────────────────────────────────
  if (action === 'merge') {
    const targetSpotId = url.searchParams.get('spotId') || record.matchedSpotId;
    if (!targetSpotId) {
      return json({ error: 'spotId is required for merge' }, 400);
    }

    const spot = await getSpot(targetSpotId);
    if (!spot) return json({ error: `Spot "${targetSpotId}" not found` }, 404);

    // 【重要】既存の内容は上書きしない。
    // OSMは基礎情報の出典であり、TABI47が用意した title / description /
    // image のほうが品質が高い。出典の追記だけを行う。
    const sources = [...(spot.sources || [])];
    const already = sources.some(
      (s) => s.type === 'OSM' && s.id === `${record.osmType}/${record.osmId}`
    );
    if (!already) sources.push(osmSourceOf(record));

    const patch: Partial<Spot> = { sources };

    // fill=1 のときだけ、空欄になっている項目をOSMで補う。
    // 既に値がある項目は触らない（field-level provenance）。
    if (url.searchParams.get('fill') === '1') {
      const fieldSources = { ...(spot.fieldSources || {}) };
      if (!spot.city && record.city) {
        patch.city = record.city;
        fieldSources.city = 'OSM';
      }
      if (!spot.address && record.address) {
        patch.address = record.address;
        fieldSources.address = 'OSM';
      }
      if (!spot.officialUrl && record.officialUrl) {
        patch.officialUrl = record.officialUrl;
        fieldSources.officialUrl = 'OSM';
      }
      if (!spot.canonicalCategory && record.canonicalKey) {
        patch.canonicalCategory = record.canonicalKey;
        fieldSources.canonicalCategory = 'OSM';
      }
      // 日本語名などを別表記として追加する
      const aliases = new Set([...(spot.aliases || []), ...record.aliases]);
      if (aliases.size > 0) patch.aliases = [...aliases].slice(0, 20);
      patch.fieldSources = fieldSources;
    }

    await patchSpot(targetSpotId, patch);
    // 冪等性の担保：次回のImportで新規扱いにならないようにする
    await linkOsmToSpot(record.osmType, record.osmId, targetSpotId);

    await updateStaging(id, {
      matchStatus: 'MATCHED',
      matchedSpotId: targetSpotId,
      reviewedAt: new Date().toISOString(),
      reviewAction: 'merged',
      reviewNote: note,
      resultSpotId: targetSpotId,
    });

    return json({
      success: true,
      action: 'merged',
      spotId: targetSpotId,
      filled: url.searchParams.get('fill') === '1',
      note: 'Existing spot content was not overwritten. Only the OSM source was recorded.',
    });
  }

  // ───────────────────────────────────────────
  // approveNew: 新規Spotとして作成
  // ───────────────────────────────────────────
  if (action === 'approveNew') {
    if (record.resultSpotId) {
      return json(
        { error: `Already created as "${record.resultSpotId}"`, spotId: record.resultSpotId },
        409
      );
    }

    const requestedSlug = url.searchParams.get('slug');
    const base = requestedSlug
      ? requestedSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : makeSlug(record.name, record.prefecture);
    const slug = await uniqueSlug(base);

    // 【段階公開（指示書32）】既定は draft。
    // 旅行価値の低いSpotが大量に公開されるのを防ぐため、
    // 公開は明示的に publish=1 を付けたときだけにする。
    const publish = url.searchParams.get('publish') === '1';

    const spot: Spot = {
      id: slug,
      title: record.name,
      // カテゴリは canonical のみ設定する。
      // 既存367件の表示用カテゴリ（「Culture & History」等）を
      // 推測で当てはめると誤分類になるため、Reviewで人間が付ける。
      category: '',
      prefecture: record.prefecture,
      // 【重要】説明文をAIや推測で生成しない（指示書17）。
      // 事実でない説明を作るより、空のままにして後から人が書く。
      description: '',
      lat: record.lat,
      lng: record.lng,
      image: '',
      city: record.city,
      address: record.address,
      officialUrl: record.officialUrl,
      canonicalCategory: record.canonicalKey,
      aliases: record.aliases.slice(0, 20),
      status: publish ? 'published' : 'draft',
      sources: [osmSourceOf(record)],
      fieldSources: {
        title: 'OSM',
        prefecture: 'OSM',
        lat: 'OSM',
        lng: 'OSM',
        ...(record.city ? { city: 'OSM' as const } : {}),
        ...(record.address ? { address: 'OSM' as const } : {}),
        ...(record.officialUrl ? { officialUrl: 'OSM' as const } : {}),
        ...(record.canonicalKey ? { canonicalCategory: 'OSM' as const } : {}),
      },
    };

    await saveSpot(spot);
    await linkOsmToSpot(record.osmType, record.osmId, slug);

    await updateStaging(id, {
      reviewedAt: new Date().toISOString(),
      reviewAction: 'approved_new',
      reviewNote: note,
      resultSpotId: slug,
      matchedSpotId: slug,
    });

    return json({
      success: true,
      action: 'approved_new',
      spotId: slug,
      status: spot.status,
      url: `/en/destinations/${slug}`,
      note: publish
        ? 'Spot published.'
        : 'Spot created as draft. It is not visible on the site until published.',
    });
  }

  return json(
    { error: 'Unknown action. Use approveNew / merge / reject / defer.' },
    400
  );
}
