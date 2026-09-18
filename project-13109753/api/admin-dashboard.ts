// /api/admin-dashboard.ts
// Vercel Serverless Function（Edge Runtime）
//
// 管理画面Dashboard用の集計API。
// これまでDashboardは src/mocks/adminData.ts の固定値を表示しており、
// 本番の実績とは無関係だった。この API で実データに置き換える。
//
// 返すもの：
//   funnel      … 収益ファネル（今月・先月・前月比）
//   content     … コンテンツ在庫（種別ごとの件数と直近7日の増加）
//   users       … 登録者数と直近7日の増加、Trip作成率
//   topContent  … コピー数上位のコンテンツ
//
// 【月別データについて】
// /api/track-view が mt:{event}:{YYYY-MM} に月別合計を積んでいる。
// 実装した月からの記録なので、前月比が意味を持つのは翌月以降。
// データが無い月は null を返し、画面側で「—」と表示させる。
//
// 【Edge Runtimeにしている理由】
// Node.js Serverless Functionが上限12本に達しているため。

import { kv } from '@vercel/kv';
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';

export const config = { runtime: 'edge' };

const EVENTS = ['view', 'save', 'copy', 'booking_hotel', 'booking_experience'] as const;
type FunnelEvent = (typeof EVENTS)[number];

type Counts = Record<FunnelEvent, number>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyCounts(): Counts {
  return { view: 0, save: 0, copy: 0, booking_hotel: 0, booking_experience: 0 };
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** UTC基準で n か月前の 'YYYY-MM' を返す */
function monthKey(offset = 0): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** 指定月のイベント合計を読む。1件も記録が無い月は null にする */
async function readMonthTotals(month: string): Promise<Counts | null> {
  const keys = EVENTS.map((ev) => `mt:${ev}:${month}`);
  let values: unknown[] = [];
  try {
    const got = await kv.mget<unknown[]>(keys[0], ...keys.slice(1));
    values = Array.isArray(got) ? got : [];
  } catch {
    return null;
  }

  // すべて未記録ならその月のデータは存在しない扱いにする
  if (values.every((v) => v === null || v === undefined)) return null;

  const counts = emptyCounts();
  EVENTS.forEach((ev, i) => {
    counts[ev] = toNumber(values[i]);
  });
  return counts;
}

/** 累積の合計（コンテンツ横断）。Funnelページと同じ考え方で読む */
async function readAllTimeTotals(): Promise<Counts> {
  // 累積はコンテンツ単位にしか無いため、月別合計の全期間分を足す。
  // 直近13か月分を見れば実用上足りる。
  const totals = emptyCounts();
  const months = Array.from({ length: 13 }, (_, i) => monthKey(-i));
  const results = await Promise.all(months.map((m) => readMonthTotals(m)));
  for (const r of results) {
    if (!r) continue;
    for (const ev of EVENTS) totals[ev] += r[ev];
  }
  return totals;
}

interface ContentCounts {
  total: number;
  recent7d: number;
}

/** Trip の件数と直近7日の新規数 */
async function collectTrips(): Promise<{
  counts: ContentCounts;
  published: number;
  uidsWithTrip: Set<string>;
}> {
  const uids = ((await kv.smembers('users:index')) || []) as string[];
  const perUser = await Promise.all(
    uids.map((uid) => kv.smembers(`user:${uid}:trips`).catch(() => []))
  );
  const publishedIds = ((await kv.smembers('trips:published')) || []) as string[];
  const ids = [...new Set([...perUser.flat(), ...publishedIds].filter(Boolean))] as string[];

  const cutoff = daysAgoIso(7);
  let recent = 0;
  const uidsWithTrip = new Set<string>();

  const records = await Promise.all(
    ids.map((id) => kv.get<Record<string, unknown>>(`trips:${id}`).catch(() => null))
  );
  for (const t of records) {
    if (!t) continue;
    if (typeof t.createdAt === 'string' && t.createdAt > cutoff) recent += 1;
    if (typeof t.uid === 'string' && t.uid) uidsWithTrip.add(t.uid);
  }

  return {
    counts: { total: ids.length, recent7d: recent },
    published: publishedIds.length,
    uidsWithTrip,
  };
}

/** Set索引を持つコンテンツ（guides / experiences）の件数 */
async function collectFromIndex(
  indexKey: string,
  recordPrefix: string
): Promise<ContentCounts> {
  const ids = ((await kv.smembers(indexKey)) || []) as string[];
  const cutoff = daysAgoIso(7);
  let recent = 0;

  const records = await Promise.all(
    ids
      .filter(Boolean)
      .map((id) => kv.get<Record<string, unknown>>(`${recordPrefix}${id}`).catch(() => null))
  );
  for (const r of records) {
    if (r && typeof r.createdAt === 'string' && r.createdAt > cutoff) recent += 1;
  }

  return { total: ids.length, recent7d: recent };
}

/**
 * Spot の件数（作成日を持たないため recent7d は常に0）。
 *
 * 【2026-09-18 修正】
 * 以前は content:destinations / content:localsPlaces（= _spotStore.ts の
 * LEGACY_CACHE_KEY。DERIVED_CACHE_MAX=1500件を超えた時点で更新が止まる
 * 派生キャッシュ）を数えていたため、全国展開後は古い件数のまま凍結していた
 * （547件など、実際のSpot総数と無関係な値）。
 * 正しい件数は spots:status:published（公開済みSpotの索引セット）の
 * SCARD で取得する。全件取得（GET）ではなく件数のみ（SCARD）にすることで、
 * Spotが1万件超でも軽量に保てる。
 */
async function collectSpots(): Promise<ContentCounts> {
  try {
    const total = await kv.scard('spots:status:published');
    return { total: typeof total === 'number' ? total : 0, recent7d: 0 };
  } catch {
    return { total: 0, recent7d: 0 };
  }
}

async function collectArticles(): Promise<ContentCounts> {
  try {
    const list = await kv.get<unknown[]>('content:articles');
    return { total: Array.isArray(list) ? list.length : 0, recent7d: 0 };
  } catch {
    return { total: 0, recent7d: 0 };
  }
}

/**
 * コンテンツ1件ごとのファネル数値を集める。
 *
 * 【以前の実装の問題】
 * Trip しか集計していなかったため、Spot（377件）やGuide・Experienceが
 * どれだけ見られているかをDashboardから知る手段が無かった。
 * Funnelページを統合するにあたり、全種別を対象にする。
 */
interface ContentRow {
  contentType: string;
  id: string;
  title: string;
  counts: Counts;
}

async function collectIdsAndTitles(
  contentType: string
): Promise<{ id: string; title: string }[]> {
  if (contentType === 'trip') {
    const uids = ((await kv.smembers('users:index')) || []) as string[];
    const perUser = await Promise.all(
      uids.map((uid) => kv.smembers(`user:${uid}:trips`).catch(() => []))
    );
    const publishedIds = ((await kv.smembers('trips:published')) || []) as string[];
    const ids = [...new Set([...perUser.flat(), ...publishedIds].filter(Boolean))] as string[];
    const records = await Promise.all(
      ids.map((id) => kv.get<Record<string, unknown>>(`trips:${id}`).catch(() => null))
    );
    return ids.map((id, i) => ({
      id,
      title: (typeof records[i]?.title === 'string' && records[i]!.title as string) || '(No title)',
    }));
  }

  if (contentType === 'guide' || contentType === 'experience') {
    const indexKey = contentType === 'guide' ? 'guides:all' : 'experiences:all';
    const prefix = contentType === 'guide' ? 'guides:' : 'experiences:';
    const titleFields = contentType === 'guide' ? ['title'] : ['placeName', 'title'];
    const ids = ((await kv.smembers(indexKey)) || []) as string[];
    const records = await Promise.all(
      ids
        .filter(Boolean)
        .map((id) => kv.get<Record<string, unknown>>(`${prefix}${id}`).catch(() => null))
    );
    return ids.filter(Boolean).map((id, i) => {
      const r = records[i];
      let title = '';
      for (const f of titleFields) {
        if (r && typeof r[f] === 'string' && r[f]) {
          title = r[f] as string;
          break;
        }
      }
      return { id, title: title || '(No title)' };
    });
  }

  // spot は件数が1万件超で全件走査に向かないため、別関数
  // （collectSpotTotals / collectSpotTopRows）で個別に処理する。
  return [];
}

/**
 * Spot 1件あたりの上位候補として何件まで見るか。
 * イベント種別ごとに上位N件を取り、和集合をとる（重複は除く）。
 * 大半のSpotはイベント数が0のため、実務上はこれで十分な範囲をカバーできる。
 */
const SPOT_RANK_TOP_N = 100;

/**
 * Spotの種別合計（By content の集計行用）。
 * totals:{event}:spot を読むだけなので、Spot件数に関わらず軽量。
 */
async function collectSpotTotals(): Promise<Counts> {
  const keys = EVENTS.map((ev) => `totals:${ev}:spot`);
  let values: unknown[] = [];
  try {
    const got = await kv.mget<unknown[]>(keys[0], ...keys.slice(1));
    values = Array.isArray(got) ? got : keys.map(() => null);
  } catch {
    values = keys.map(() => null);
  }
  const counts = emptyCounts();
  EVENTS.forEach((ev, i) => {
    counts[ev] = toNumber(values[i]);
  });
  return counts;
}

/**
 * Spotの明細行（1件ごとの内訳テーブル用）。
 *
 * 【注意】全12,000件超を対象にするのではなく、5イベントそれぞれの
 * ランキング（rank:{event}:spot）上位N件の和集合のみを対象にする。
 * そのため、明細テーブルでSpotを検索・並び替えする際は「上位に一度も
 * 入ったことがないSpot」はヒットしない。全件対象の検索は別課題
 * （Explore全文検索エンジン導入）で対応する。
 */
async function collectSpotTopRows(): Promise<ContentRow[]> {
  const idSet = new Set<string>();
  await Promise.all(
    EVENTS.map(async (ev) => {
      try {
        const top = await kv.zrange<string[]>(`rank:${ev}:spot`, 0, SPOT_RANK_TOP_N - 1, {
          rev: true,
        });
        (top || []).forEach((id) => {
          if (typeof id === 'string') idSet.add(id);
        });
      } catch {
        /* このイベントのランキングが未整備でも他は続行する */
      }
    })
  );

  const ids = [...idSet];
  if (ids.length === 0) return [];

  const spots = await Promise.all(
    ids.map((id) => kv.get<Record<string, unknown>>(`spot:${id}`).catch(() => null))
  );

  const keys: string[] = [];
  for (const id of ids) {
    for (const ev of EVENTS) {
      keys.push(ev === 'view' ? `views:spot:${id}` : `events:${ev}:spot:${id}`);
    }
  }
  const CHUNK = 200;
  const values: unknown[] = [];
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK);
    try {
      const got = await kv.mget<unknown[]>(slice[0], ...slice.slice(1));
      values.push(...(Array.isArray(got) ? got : slice.map(() => null)));
    } catch {
      values.push(...slice.map(() => null));
    }
  }

  return ids.map((id, idx) => {
    const counts = emptyCounts();
    EVENTS.forEach((ev, evIdx) => {
      counts[ev] = toNumber(values[idx * EVENTS.length + evIdx]);
    });
    const s = spots[idx];
    const title =
      (s && typeof s.title === 'string' && s.title) ||
      (s && typeof s.name === 'string' && (s.name as string)) ||
      '(No title)';
    return { contentType: 'spot', id, title, counts };
  });
}

/** 5イベント分のカウンタをまとめて読む */
async function readRowCounts(
  contentType: string,
  records: { id: string; title: string }[]
): Promise<ContentRow[]> {
  if (records.length === 0) return [];

  const keys: string[] = [];
  for (const r of records) {
    for (const ev of EVENTS) {
      keys.push(ev === 'view' ? `views:${contentType}:${r.id}` : `events:${ev}:${contentType}:${r.id}`);
    }
  }

  // mgetは一度に投げる量が多すぎると失敗しうるので分割する
  const CHUNK = 200;
  const values: unknown[] = [];
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK);
    try {
      const got = await kv.mget<unknown[]>(slice[0], ...slice.slice(1));
      values.push(...(Array.isArray(got) ? got : slice.map(() => null)));
    } catch {
      values.push(...slice.map(() => null));
    }
  }

  return records.map((r, idx) => {
    const counts = emptyCounts();
    EVENTS.forEach((ev, evIdx) => {
      counts[ev] = toNumber(values[idx * EVENTS.length + evIdx]);
    });
    return { contentType, id: r.id, title: r.title, counts };
  });
}

/** 全種別のコンテンツ明細を返す */
async function collectAllContent(): Promise<{
  items: ContentRow[];
  byType: Record<string, Counts & { items: number }>;
}> {
  // spot は件数が1万件超のため、全件走査するtrip/guide/experienceとは
  // 別経路（totals: / rank: ベースの軽量集計）で扱う。
  const types = ['trip', 'guide', 'experience'];
  const items: ContentRow[] = [];
  const byType: Record<string, Counts & { items: number }> = {};

  for (const contentType of types) {
    const records = await collectIdsAndTitles(contentType);
    const rows = await readRowCounts(contentType, records);
    items.push(...rows);

    const sum = emptyCounts();
    for (const r of rows) {
      for (const ev of EVENTS) sum[ev] += r.counts[ev];
    }
    byType[contentType] = { ...sum, items: rows.length };
  }

  const [spotPublishedCount, spotTotals, spotTopRows] = await Promise.all([
    kv.scard('spots:status:published').catch(() => 0),
    collectSpotTotals(),
    collectSpotTopRows(),
  ]);
  items.push(...spotTopRows);
  byType['spot'] = {
    ...spotTotals,
    items: typeof spotPublishedCount === 'number' ? spotPublishedCount : 0,
  };

  // 数字が動いているものを上に出す
  items.sort((a, b) => b.counts.copy - a.counts.copy || b.counts.view - a.counts.view);
  return { items, byType };
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await isAdminRequest(req))) return adminUnauthorized();
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const thisMonth = monthKey(0);
    const lastMonth = monthKey(-1);

    const [
      allTime,
      current,
      previous,
      tripData,
      guides,
      experiences,
      spots,
      articles,
      allContent,
    ] = await Promise.all([
      readAllTimeTotals(),
      readMonthTotals(thisMonth),
      readMonthTotals(lastMonth),
      collectTrips(),
      collectFromIndex('guides:all', 'guides:'),
      collectFromIndex('experiences:all', 'experiences:'),
      collectSpots(),
      collectArticles(),
      collectAllContent(),
    ]);

    // ユーザー
    const uids = ((await kv.smembers('users:index')) || []) as string[];
    const cutoff = daysAgoIso(7);
    let recentUsers = 0;
    const userRecords = await Promise.all(
      uids.map((uid) => kv.get<Record<string, unknown>>(`user:${uid}`).catch(() => null))
    );
    for (const u of userRecords) {
      if (u && typeof u.createdAt === 'string' && u.createdAt > cutoff) recentUsers += 1;
    }

    return json({
      months: { current: thisMonth, previous: lastMonth },
      funnel: {
        allTime,
        current,   // データが無ければ null
        previous,  // データが無ければ null
      },
      content: {
        trips: tripData.counts,
        publishedTrips: tripData.published,
        guides,
        experiences,
        spots,
        articles,
      },
      users: {
        total: uids.length,
        recent7d: recentUsers,
        withTrip: tripData.uidsWithTrip.size,
      },
      byType: allContent.byType,
      items: allContent.items,
    });
  } catch (err) {
    return json({ error: 'Failed to build dashboard', detail: String(err) }, 500);
  }
}
