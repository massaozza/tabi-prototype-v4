// /api/admin-experiences.ts
// GET    → 全Experience一覧
// PATCH  /api/admin-experiences?id=xxx → Experience編集
// DELETE /api/admin-experiences?id=xxx → Experience削除

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
  const id = url.searchParams.get('id');

  // ── PATCH: Experience編集 ──
  if (req.method === 'PATCH') {
    if (!id) return json({ error: 'id is required' }, 400);
    let body: { placeName?: string; whatWasGood?: string; bestTimeToVisit?: string; area?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    try {
      const exp = await kv.get<any>(`experiences:${id}`);
      if (!exp) return json({ error: 'Experience not found' }, 404);
      const updated = {
        ...exp,
        ...(body.placeName !== undefined && { placeName: body.placeName }),
        ...(body.whatWasGood !== undefined && { whatWasGood: body.whatWasGood }),
        ...(body.bestTimeToVisit !== undefined && { bestTimeToVisit: body.bestTimeToVisit }),
        ...(body.area !== undefined && { area: body.area }),
      };
      await kv.set(`experiences:${id}`, updated);
      return json({ success: true, experience: updated });
    } catch (err) {
      return json({ error: 'Failed to update', detail: String(err) }, 500);
    }
  }

  // ── DELETE ──
  if (req.method === 'DELETE') {
    if (!id) return json({ error: 'id is required' }, 400);
    try {
      const exp = await kv.get<any>(`experiences:${id}`);
      if (!exp) return json({ error: 'Experience not found' }, 404);
      await kv.del(`experiences:${id}`);
      if (exp.uid) await kv.srem(`user:${exp.uid}:experiences`, id);
      await kv.srem('experiences:all', id);
      if (exp.spotId) await kv.srem(`spot:${exp.spotId}:experiences`, id);
      return json({ success: true });
    } catch (err) {
      return json({ error: 'Failed to delete', detail: String(err) }, 500);
    }
  }

  // ── GET: 全Experience一覧 ──
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    // 全ユーザーのExperience IDを集約
    const uids = ((await kv.smembers('users:index')) || []) as string[];
    const allIdSets = await Promise.all(
      uids.map((uid) => kv.smembers(`user:${uid}:experiences`).catch(() => []))
    );
    // experiences:allも参照
    const globalIds = ((await kv.smembers('experiences:all')) || []) as string[];
    const mergedIds = [...new Set([...allIdSets.flat(), ...globalIds].filter(Boolean))] as string[];

    const experiences = (await Promise.all(
      mergedIds.map(async (eid) => {
        try {
          const e = await kv.get<any>(`experiences:${eid}`);
          if (!e) return null;
          return {
            id: e.id || eid,
            placeName: e.placeName || '',
            area: e.area || '',
            category: e.category || '',
            uid: e.uid || '',
            wouldRecommend: e.wouldRecommend || false,
            helpfulCount: e.helpfulCount || 0,
            createdAt: e.createdAt || '',
            whatWasGood: e.whatWasGood || '',
            bestTimeToVisit: e.bestTimeToVisit || '',
            photos: e.photos || [],
          };
        } catch { return null; }
      })
    )).filter(Boolean).sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));

    return json({ experiences, total: experiences.length });
  } catch (err) {
    return json({ error: 'Internal error', detail: String(err) }, 500);
  }
}
