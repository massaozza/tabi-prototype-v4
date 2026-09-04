// /api/admin-experiences.ts
// GET    → 全Experience一覧（Admin専用）
// DELETE /api/admin-experiences?id=xxx → Experience削除（Admin専用）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // ── DELETE: Experience削除 ──
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id is required' }, 400);
    try {
      const exp = await kv.get<{ uid?: string; id: string; spotId?: string }>(`experiences:${id}`);
      if (!exp) return json({ error: 'Experience not found' }, 404);
      await kv.del(`experiences:${id}`);
      if (exp.uid) await kv.srem(`user:${exp.uid}:experiences`, id);
      await kv.srem('experiences:all', id);
      if (exp.spotId) await kv.srem(`spot:${exp.spotId}:experiences`, id);
      return json({ success: true });
    } catch (err) {
      return json({ error: 'Failed to delete experience', detail: String(err) }, 500);
    }
  }

  // ── GET: Experience一覧 ──
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const allIds = await kv.smembers('experiences:all') as string[];
    const experiences = (await Promise.all(
      (allIds || []).map(async (id) => {
        try {
          const e = await kv.get<any>(`experiences:${id}`);
          if (!e) return null;
          return {
            id: e.id,
            placeName: e.placeName,
            area: e.area,
            category: e.category,
            uid: e.uid,
            wouldRecommend: e.wouldRecommend,
            helpfulCount: e.helpfulCount || 0,
            createdAt: e.createdAt,
          };
        } catch { return null; }
      })
    )).filter(Boolean).sort((a: any, b: any) => (a!.createdAt < b!.createdAt ? 1 : -1));

    return json({ experiences, total: experiences.length });
  } catch (err) {
    return json({ error: 'Internal error', detail: String(err) }, 500);
  }
}
