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
  patchSpot,
  rebuildDerivedCache,
  type Spot,
} from './_spotStore.js';
import { createDraftSpotFromStaging, osmSourceOf } from './_draftSpot.js';
import type { MatchStatus } from './_osmMatching.js';
import {
  getStaging,
  listStagingIds,
  listStagingIdsFiltered,
  listUnreviewedStagingIds,
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
 * OSMの名称から Spot の slug を作る処理・下書き作成処理は
 * ./_draftSpot.js に切り出した（GitHub Actionsの一括ジョブとも共有するため）。
 */

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

    // 優先度での絞り込み。低スコアのものを開かずに済むようにする
    const priorityParam = url.searchParams.get('priority');
    const priority =
      priorityParam && ['high', 'medium', 'low'].includes(priorityParam)
        ? (priorityParam as 'high' | 'medium' | 'low')
        : undefined;

    // 【重要】status × priority の複合索引がある場合はそれを使う。
    // NEWは都道府県が増えると万単位になるため、priority指定なしで
    // 全件を個別取得すると実行時間上限（約25秒）を超えてタイムアウトする
    // （実際に3県目でNEW 14,714件になり発生した）。
    let ids: string[];
    if (status && priority) {
      ids = await listStagingIdsFiltered(status, priority);
    } else {
      ids = await listStagingIds(status);
    }

    // 安全策：件数に際限なく個別取得しないよう上限をかける。
    // 【なぜpriority指定時にも必要になったか】
    // 47都道府県分になると、priorityで絞り込んでもなお数千件になり、
    // 全件個別取得してからJSで並び替え・上位200件に絞る、という
    // 従来のやり方では実行時間上限（約25秒）を超えてタイムアウトする
    // ようになった（実際に発生した）。
    const HARD_FETCH_CAP = 1000;
    let truncated = false;
    if (ids.length > HARD_FETCH_CAP) {
      ids = ids.slice(0, HARD_FETCH_CAP);
      truncated = true;
    }

    let records = await getStagingRecords(ids);

    if (prefecture) records = records.filter((r) => r.prefecture === prefecture);
    if (onlyPending) records = records.filter((r) => !r.reviewedAt);
    if (priority) {
      // 複合索引で既に絞り込み済みだが、statusを指定していない
      // （全件横断の）呼び出しに備えて念のためJS側でも絞る
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
      truncated,
      summary,
      attribution: '© OpenStreetMap contributors (ODbL 1.0)',
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const action = url.searchParams.get('action');

  // ───────────────────────────────────────────
  // bulkApproveNew: NEWのうち指定した優先度のものを、まとめてdraftとして作成する
  // ───────────────────────────────────────────
  // 【なぜ必要か】
  // NEW×highだけで都道府県4県合計1,000件を超えており、1件ずつのReviewは
  // 現実的でない。high優先度はWikidata/Wikipedia/公式サイトなど複数の
  // 裏付けがある候補に限られ、これまで誤り（存在しない場所・閉業施設等）は
  // 確認されていない。draft止まりで公開はされない（別途 publish=1 が必要）ため、
  // 万一質の低いものが混ざっても表には出ない。
  // POSSIBLE_MATCHは対象外（誤統合のリスクがあるため引き続き手動確認が必要）。
  if (action === 'bulkApproveNew') {
    const priorityParam = url.searchParams.get('priority') || 'high';
    if (!['high', 'medium', 'low'].includes(priorityParam)) {
      return json({ error: 'priority must be high, medium, or low' }, 400);
    }
    const priority = priorityParam as 'high' | 'medium' | 'low';
    const prefecture = url.searchParams.get('prefecture');
    const publish = url.searchParams.get('publish') === '1';
    // 【重要】各件がWikidata/Wikipedia/Gemini呼び出しを伴うようになったため、
    // 以前（KV書き込みのみ）より1件あたりの処理コストが大きい。
    // Edge Functionの実行時間上限（約25秒）に収まるよう、
    // 既定・上限とも小さめにする。
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '15'), 1), 20);

    // 【重要】reviewed済みを含む全件を取得してからJSで除外するのではなく、
    // Redis側のSDIFFで「まだreviewされていないもの」だけを先に絞り込む。
    // こうしないと、処理が進むほど「先頭側は全部reviewed済み」という
    // 状態になり、後方に候補が残っているのに0件と誤判定してしまう。
    const unreviewedIds = await listUnreviewedStagingIds('NEW', priority);
    // prefectureで絞り込む可能性があるため、limitより余裕を持って取得する
    // （全件ではなく、それでも安全な範囲に収める）
    const FETCH_CAP = Math.min(unreviewedIds.length, Math.max(limit * 10, 100));
    const ids = unreviewedIds.slice(0, FETCH_CAP);
    let candidates = await getStagingRecords(ids);
    if (prefecture) candidates = candidates.filter((r) => r.prefecture === prefecture);
    // SDIFFの時点で除外しているはずだが、念のため二重チェックしておく
    candidates = candidates.filter((r) => !r.reviewedAt && !r.resultSpotId);

    const remainingBefore = unreviewedIds.length;
    const batch = candidates.slice(0, limit);

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    // Edge Functionの実行時間上限（約25秒）に収まるよう、少しずつ並列実行する
    const CONCURRENCY = 10;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((record) =>
          createDraftSpotFromStaging(record, {
            publish,
            reviewNote: `Bulk approved (priority=${priority}, no individual review)`,
            rebuildCache: false,
          })
        )
      );
      for (const r of results) {
        if (r.status === 'fulfilled') created += 1;
        else {
          failed += 1;
          if (errors.length < 10) errors.push(String(r.reason));
        }
      }
    }

    // draft作成時は公開一覧に影響しないため再構築しない。
    // publish=1（一括公開）の場合だけ、全件処理し終えた後に1回だけ再構築する
    // （1件ごとに再構築すると、バッチが大きいほど無視できない負荷になる）。
    if (publish && created > 0) {
      await rebuildDerivedCache().catch(() => null);
    }

    const remainingAfter = Math.max(0, remainingBefore - batch.length);
    return json({
      success: true,
      action: 'bulkApproveNew',
      priority,
      prefecture: prefecture || null,
      created,
      failed,
      processedThisCall: batch.length,
      remainingAfterThisCall: remainingAfter,
      errors,
      note:
        `${created} spots created as ${publish ? 'published' : 'draft'}` +
        (failed ? `, ${failed} failed` : '') +
        (remainingAfter > 0
          ? `. ${remainingAfter} more remain — call again to continue.`
          : '. No more remaining for this filter.'),
    });
  }

  if (!id) return json({ error: 'id query parameter is required' }, 400);
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
    // 【段階公開（指示書32）】既定は draft。
    // 旅行価値の低いSpotが大量に公開されるのを防ぐため、
    // 公開は明示的に publish=1 を付けたときだけにする。
    const publish = url.searchParams.get('publish') === '1';

    const slug = await createDraftSpotFromStaging(record, {
      publish,
      requestedSlug,
      reviewNote: note,
    });

    return json({
      success: true,
      action: 'approved_new',
      spotId: slug,
      status: publish ? 'published' : 'draft',
      url: `/en/destinations/${slug}`,
      note: publish
        ? 'Spot published.'
        : 'Spot created as draft. It is not visible on the site until published.',
    });
  }

  return json(
    { error: 'Unknown action. Use approveNew / bulkApproveNew / merge / reject / defer.' },
    400
  );
}
