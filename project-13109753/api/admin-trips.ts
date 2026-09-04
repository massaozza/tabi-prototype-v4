// /api/admin-trips.ts
// GET    → 全Trip一覧（Admin専用）
// DELETE /api/admin-trips?id=xxx → Trip削除（Admin専用）

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

  // ── DELETE: Trip削除 ──
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id is required' }, 400);
    try {
      const trip = await kv.get<{ uid?: string; id: string }>(`trips:${id}`);
      if (!trip) return json({ error: 'Trip not found' }, 404);
      await kv.del(`trips:${id}`);
      if (trip.uid) await kv.srem(`user:${trip.uid}:trips`, id);
      await kv.srem('trips:all', id);
      return json({ success: true });
    } catch (err) {
      return json({ error: 'Failed to delete trip', detail: String(err) }, 500);
    }
  }

  // ── GET: Trip一覧 ──
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const allIds = await kv.smembers('trips:all') as string[];
    const trips = (await Promise.all(
      (allIds || []).map(async (id) => {
        try {
          const t = await kv.get<any>(`trips:${id}`);
          if (!t) return null;
          return {
            id: t.id,
            title: t.title,
            status: t.status,
            uid: t.uid,
            authorName: t.authorName,
            createdAt: t.createdAt,
            isPublic: t.isPublic,
            tripType: t.tripType,
            saveCount: t.saveCount || 0,
            copyCount: t.copyCount || 0,
          };
        } catch { return null; }
      })
    )).filter(Boolean).sort((a: any, b: any) => (a!.createdAt < b!.createdAt ? 1 : -1));

    return json({ trips, total: trips.length });
  } catch (err) {
    return json({ error: 'Internal error', detail: String(err) }, 500);
  }
}
