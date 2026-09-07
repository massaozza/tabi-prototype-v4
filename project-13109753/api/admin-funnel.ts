// /api/admin-funnel.ts
// Vercel Serverless Function（Edge Runtime）
//
// 管理画面の「Funnel」タブ用に、収益ファネルの数値をまとめて返すAPI。
//
// 【計測の流れ】
//   詳細ページ表示 → view
//   Saveボタン     → save
//   Copyボタン     → copy
//   Book Hotel     → booking_hotel
//   Book Experience→ booking_experience
// これらは /api/track-view が KV のカウンタに積んでいる。
// このAPIはそのカウンタを、コンテンツ単位・種別単位で読み出して集計する。
//
// 【Edge Runtimeにしている理由】
// Vercel無料プランはNode.js Serverless Functionが12本までで、
// 既にその上限に達しているため。Edge Functionは本数上限の対象外。
//
// GET /api/admin-funnel
//   → { totals, byType, items }
//
// GET /api/admin-funnel?contentType=trip
//   → 種別を絞って取得

import { kv } from '@vercel/kv';
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';

export const config = { runtime: 'edge' };

const EVENTS = ['view', 'save', 'copy', 'booking_hotel', 'booking_experience'] as const;
type FunnelEvent = (typeof EVENTS)[number];

const CONTENT_TYPES = ['trip', 'guide', 'experience', 'spot'] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

type Counts = Record<FunnelEvent, number>;

interface FunnelItem {
  contentType: ContentType;
  id: string;
  title: string;
  counts: Counts;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyCounts(): Counts {
  return { view: 0, save: 0, copy: 0, booking_hotel: 0, booking_experience: 0 };
}

// track-view.ts と同じキー設計にそろえる
function eventKey(event: FunnelEvent, contentType: ContentType, id: string): string {
  if (event === 'view') return `views:${contentType}:${id}`;
  return `events:${event}:${contentType}:${id}`;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** 各コンテンツの「ID → 表示名」を集める */
async function collectTrips(): Promise<{ id: string; title: string }[]> {
  const uids = ((await kv.smembers('users:index')) || []) as string[];
  const perUser = await Promise.all(
    uids.map((uid) => kv.smembers(`user:${uid}:trips`).catch(() => []))
  );
  const published = ((await kv.smembers('trips:published')) || []) as string[];
  const ids = [...new Set([...perUser.flat(), ...published].filter(Boolean))] as string[];

  const records = await Promise.all(
    ids.map(async (id) => {
      try {
        const t = await kv.get<any>(`trips:${id}`);
        return { id, title: t?.title || '(No title)' };
      } catch {
        return { id, title: '(No title)' };
      }
    })
  );
  return records;
}

async function collectSimple(
  indexKey: string,
  recordPrefix: string,
  titleFields: string[]
): Promise<{ id: string; title: string }[]> {
  const ids = ((await kv.smembers(indexKey)) || []) as string[];
  return Promise.all(
    ids.filter(Boolean).map(async (id) => {
      try {
        const r = await kv.get<any>(`${recordPrefix}${id}`);
        let title = '';
        for (const f of titleFields) {
          if (r?.[f] && typeof r[f] === 'string') {
            title = r[f];
            break;
          }
        }
        return { id, title: title || '(No title)' };
      } catch {
        return { id, title: '(No title)' };
      }
    })
  );
}

/** Spot（destinations / localsPlaces）はリスト1本に入っている */
async function collectSpots(): Promise<{ id: string; title: string }[]> {
  const out: { id: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const key of ['content:destinations', 'content:localsPlaces']) {
    try {
      const list = await kv.get<any[]>(key);
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        out.push({ id: item.id, title: item.title || item.name || '(No title)' });
      }
    } catch {
      /* 片方が無くても続行する */
    }
  }
  return out;
}

async function collectByType(
  contentType: ContentType
): Promise<{ id: string; title: string }[]> {
  switch (contentType) {
    case 'trip':
      return collectTrips();
    case 'guide':
      return collectSimple('guides:all', 'guides:', ['title']);
    case 'experience':
      return collectSimple('experiences:all', 'experiences:', ['placeName', 'title']);
    case 'spot':
      return collectSpots();
  }
}

/** 5イベント分のカウンタをまとめて読む */
async function readCounts(
  contentType: ContentType,
  records: { id: string; title: string }[]
): Promise<FunnelItem[]> {
  if (records.length === 0) return [];

  const keys: string[] = [];
  for (const r of records) {
    for (const ev of EVENTS) keys.push(eventKey(ev, contentType, r.id));
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

export default async function handler(req: Request): Promise<Response> {
  // 管理者以外は一切処理させない（サーバー側の境界）
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(req.url);
  const filter = url.searchParams.get('contentType');
  const targets =
    filter && CONTENT_TYPES.includes(filter as ContentType)
      ? [filter as ContentType]
      : [...CONTENT_TYPES];

  try {
    const items: FunnelItem[] = [];
    const byType: Record<string, Counts & { items: number }> = {};

    for (const contentType of targets) {
      const records = await collectByType(contentType);
      const withCounts = await readCounts(contentType, records);
      items.push(...withCounts);

      const sum = emptyCounts();
      for (const it of withCounts) {
        for (const ev of EVENTS) sum[ev] += it.counts[ev];
      }
      byType[contentType] = { ...sum, items: withCounts.length };
    }

    const totals = emptyCounts();
    for (const it of items) {
      for (const ev of EVENTS) totals[ev] += it.counts[ev];
    }

    // 数字が動いているものを上に出す
    items.sort((a, b) => b.counts.view - a.counts.view || b.counts.copy - a.counts.copy);

    return json({ totals, byType, items });
  } catch (err) {
    return json({ error: 'Failed to aggregate funnel', detail: String(err) }, 500);
  }
}
