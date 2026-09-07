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

/** Spot はリストに入っているため件数のみ（作成日を持たない） */
async function collectSpots(): Promise<ContentCounts> {
  const seen = new Set<string>();
  for (const key of ['content:destinations', 'content:localsPlaces']) {
    try {
      const list = await kv.get<Record<string, unknown>[]>(key);
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (typeof item?.id === 'string') seen.add(item.id);
      }
    } catch {
      /* 片方が無くても続行する */
    }
  }
  return { total: seen.size, recent7d: 0 };
}

async function collectArticles(): Promise<ContentCounts> {
  try {
    const list = await kv.get<unknown[]>('content:articles');
    return { total: Array.isArray(list) ? list.length : 0, recent7d: 0 };
  } catch {
    return { total: 0, recent7d: 0 };
  }
}

/** コピー数の多いコンテンツ上位 */
async function topByCopy(
  limit = 5
): Promise<{ contentType: string; id: string; title: string; copy: number; view: number }[]> {
  const targets: { contentType: string; id: string; title: string }[] = [];

  // Trip
  const uids = ((await kv.smembers('users:index')) || []) as string[];
  const perUser = await Promise.all(
    uids.map((uid) => kv.smembers(`user:${uid}:trips`).catch(() => []))
  );
  const publishedIds = ((await kv.smembers('trips:published')) || []) as string[];
  const tripIds = [...new Set([...perUser.flat(), ...publishedIds].filter(Boolean))] as string[];
  const trips = await Promise.all(
    tripIds.map((id) => kv.get<Record<string, unknown>>(`trips:${id}`).catch(() => null))
  );
  tripIds.forEach((id, i) => {
    const t = trips[i];
    targets.push({
      contentType: 'trip',
      id,
      title: (typeof t?.title === 'string' && t.title) || '(No title)',
    });
  });

  if (targets.length === 0) return [];

  const keys: string[] = [];
  for (const t of targets) {
    keys.push(`events:copy:${t.contentType}:${t.id}`);
    keys.push(`views:${t.contentType}:${t.id}`);
  }

  const values: unknown[] = [];
  const CHUNK = 200;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK);
    try {
      const got = await kv.mget<unknown[]>(slice[0], ...slice.slice(1));
      values.push(...(Array.isArray(got) ? got : slice.map(() => null)));
    } catch {
      values.push(...slice.map(() => null));
    }
  }

  return targets
    .map((t, i) => ({
      ...t,
      copy: toNumber(values[i * 2]),
      view: toNumber(values[i * 2 + 1]),
    }))
    .filter((t) => t.copy > 0 || t.view > 0)
    .sort((a, b) => b.copy - a.copy || b.view - a.view)
    .slice(0, limit);
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
      top,
    ] = await Promise.all([
      readAllTimeTotals(),
      readMonthTotals(thisMonth),
      readMonthTotals(lastMonth),
      collectTrips(),
      collectFromIndex('guides:all', 'guides:'),
      collectFromIndex('experiences:all', 'experiences:'),
      collectSpots(),
      collectArticles(),
      topByCopy(),
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
      topContent: top,
    });
  } catch (err) {
    return json({ error: 'Failed to build dashboard', detail: String(err) }, 500);
  }
}
