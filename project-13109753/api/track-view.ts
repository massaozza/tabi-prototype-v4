// /api/track-view.ts
// Vercel Serverless Function（Node.js Runtime）
// TABI 3.0：GUIDE・EXPERIENCE・TRIP・SPOTの閲覧数（Views）を計測するための、
// 軽量な専用API。Creator Dashboardの「実績」タブで、実際の閲覧数を
// 表示できるようにするための基盤。
//
// 【設計方針】既存のコンテンツAPI（guides.ts, experiences.ts等）には
// 触れず、独立した仕組みにしている。閲覧数は「どのコンテンツが、何回
// 見られたか」というシンプルなカウンタ（KVのINCR）のみで管理し、
// 誰が見たか・いつ見たかは記録しない（プライバシー・実装コストの両面で
// 最小限にとどめている）。
//
// POST /api/track-view
//   body: { contentType: 'guide' | 'experience' | 'trip' | 'spot', id: string, event?: string }
//   → 該当コンテンツのイベント数を+1する（認証不要、誰でも呼べる）
//   → event を省略すると 'view'（従来どおりの閲覧数）
//
// GET /api/track-view?contentType=guide&ids=id1,id2,id3&event=save
//   → 指定した複数idの現在のイベント数をまとめて取得する
//   → レスポンス: { views: { id1: 5, id2: 12, ... } }
//
// 【ファネル計測】収益ファネルの各段階を同じ仕組みで数える。
//   view              … 詳細ページの表示
//   save              … Saveボタンのタップ
//   copy              … Copy to My Tripのタップ
//   booking_hotel     … Book HotelのCTAタップ
//   booking_experience… Book ExperienceのCTAタップ
// これにより「見られた数 → 保存された数 → コピーされた数 → 予約に進んだ数」を
// コンテンツ単位で追えるようになる。
//
// KVのキー設計：
//   views:{contentType}:{id}                  … event='view' の累積（既存データと互換）
//   events:{event}:{contentType}:{id}         … それ以外のイベントの累積
//   m:{event}:{contentType}:{id}:{YYYY-MM}    … 月別（前月比の算出に使う）
//   mt:{event}:{YYYY-MM}                      … 月別の全体合計（一覧を走査せずに読める）
//
// 【月別を持つ理由】
// 累積値だけでは「今月と先月」を分けられず、伸びているのか止まっているのかが
// 判断できない。あとから遡って計算することもできないため、
// 記録の時点で月ごとに分けておく必要がある。
// 月別キーには400日のTTLを付け、古い分は自動で消えるようにしている。

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

type ContentType = 'guide' | 'experience' | 'trip' | 'spot';
const VALID_TYPES: ContentType[] = ['guide', 'experience', 'trip', 'spot'];

type FunnelEvent = 'view' | 'save' | 'copy' | 'booking_hotel' | 'booking_experience';
const VALID_EVENTS: FunnelEvent[] = [
  'view',
  'save',
  'copy',
  'booking_hotel',
  'booking_experience',
];

function eventKey(event: FunnelEvent, contentType: ContentType, id: string): string {
  // event='view' は既存キーのまま（過去の閲覧数を引き継ぐ）
  if (event === 'view') return `views:${contentType}:${id}`;
  return `events:${event}:${contentType}:${id}`;
}

/** 現在の年月（UTC基準）。例: '2026-09' */
function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** コンテンツ単位の月別キー */
function monthlyKey(
  event: FunnelEvent,
  contentType: ContentType,
  id: string,
  month: string
): string {
  return `m:${event}:${contentType}:${id}:${month}`;
}

/** イベント種別ごとの月別合計キー（コンテンツを走査せずに集計できる） */
function monthlyTotalKey(event: FunnelEvent, month: string): string {
  return `mt:${event}:${month}`;
}

/** 月別データの保持期間（400日）。前年同月比まで見られる長さ */
const MONTHLY_TTL_SECONDS = 400 * 24 * 60 * 60;

function parseEvent(raw: unknown): FunnelEvent | null {
  if (raw === undefined || raw === null || raw === '') return 'view';
  if (typeof raw !== 'string') return null;
  return VALID_EVENTS.includes(raw as FunnelEvent) ? (raw as FunnelEvent) : null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === 'POST') {
    const body = req.body || {};
    const contentType = body.contentType as ContentType;
    const id = typeof body.id === 'string' ? body.id.trim() : '';

    const event = parseEvent(body.event);

    if (!VALID_TYPES.includes(contentType) || !id || !event) {
      res.status(400).json({ error: 'contentType and id are required, event must be valid' });
      return;
    }

    try {
      const month = currentMonth();

      // 累積・コンテンツ別月次・全体月次を同時に積む。
      // 計測の失敗でページ表示を止めたくないので、月次側は失敗しても無視する。
      const newCount = await kv.incr(eventKey(event, contentType, id));

      const mKey = monthlyKey(event, contentType, id, month);
      const mtKey = monthlyTotalKey(event, month);
      await Promise.all([
        kv
          .incr(mKey)
          .then((n) => (n === 1 ? kv.expire(mKey, MONTHLY_TTL_SECONDS) : null))
          .catch(() => null),
        kv
          .incr(mtKey)
          .then((n) => (n === 1 ? kv.expire(mtKey, MONTHLY_TTL_SECONDS) : null))
          .catch(() => null),
      ]);

      res.status(200).json({ success: true, event, views: newCount });
    } catch (err) {
      // 閲覧数の記録に失敗しても、ページ表示自体には影響させない
      res.status(200).json({ success: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'GET') {
    const contentType = req.query.contentType as ContentType;
    const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);

    const event = parseEvent(req.query.event);

    if (!VALID_TYPES.includes(contentType) || ids.length === 0 || !event) {
      res.status(400).json({ error: 'contentType and ids are required, event must be valid' });
      return;
    }

    try {
      const keys = ids.map((id) => eventKey(event, contentType, id));
      const values = await kv.mget<number[]>(keys[0], ...keys.slice(1));
      const views: Record<string, number> = {};
      ids.forEach((id, idx) => {
        views[id] = values?.[idx] ?? 0;
      });
      res.status(200).json({ views });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch views', detail: String(err) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
