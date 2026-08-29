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
//   body: { contentType: 'guide' | 'experience' | 'trip' | 'spot', id: string }
//   → 該当コンテンツの閲覧数を+1する（認証不要、誰でも呼べる）
//
// GET /api/track-view?contentType=guide&ids=id1,id2,id3
//   → 指定した複数idの現在の閲覧数をまとめて取得する
//   → レスポンス: { views: { id1: 5, id2: 12, ... } }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

type ContentType = 'guide' | 'experience' | 'trip' | 'spot';
const VALID_TYPES: ContentType[] = ['guide', 'experience', 'trip', 'spot'];

function viewKey(contentType: ContentType, id: string): string {
  return `views:${contentType}:${id}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === 'POST') {
    const body = req.body || {};
    const contentType = body.contentType as ContentType;
    const id = typeof body.id === 'string' ? body.id.trim() : '';

    if (!VALID_TYPES.includes(contentType) || !id) {
      res.status(400).json({ error: 'contentType and id are required' });
      return;
    }

    try {
      const newCount = await kv.incr(viewKey(contentType, id));
      res.status(200).json({ success: true, views: newCount });
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

    if (!VALID_TYPES.includes(contentType) || ids.length === 0) {
      res.status(400).json({ error: 'contentType and ids are required' });
      return;
    }

    try {
      const values = await kv.mget<number[]>(...ids.map((id) => viewKey(contentType, id)));
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
