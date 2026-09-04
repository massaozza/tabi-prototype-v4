// /api/admin-trips.ts
// GET    → 全Trip一覧（全ユーザーのtripsを集約）
// DELETE /api/admin-trips?id=xxx → Trip削除

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

  // ── DELETE ──
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id is required' }, 400);
    try {
      const trip = await kv.get<any>(`trips:${id}`);
      if (!trip) return json({ error: 'Trip not found' }, 404);
      await kv.del(`trips:${id}`);
      if (trip.uid) {
        await kv.srem(`user:${trip.uid}:trips`, id);
        await kv.srem(`user:${trip.uid}:savedTrips`, id);
      }
      await kv.srem('trips:published', id);
      return json({ success: true });
    } catch (err) {
      return json({ error: 'Failed to delete', detail: String(err) }, 500);
    }
  }

  // ── GET: 全Trip一覧 ──
  // 全ユーザーのuidを取得 → 各ユーザーのuser:{uid}:tripsからID一覧を取得 → 各Tripを取得
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    // 1. 全ユーザーUID取得
    const uids = ((await kv.smembers('users:index')) || []) as string[];

    // 2. 各ユーザーのtrip IDを集約（重複除去）
    const allTripIdSets = await Promise.all(
      uids.map((uid) => kv.smembers(`user:${uid}:trips`).catch(() => []))
    );
    const allTripIds = [...new Set(allTripIdSets.flat().filter(Boolean))] as string[];

    // 3. 公開Trip（published index）も追加
    const publishedIds = ((await kv.smembers('trips:published')) || []) as string[];
    const mergedIds = [...new Set([...allTripIds, ...publishedIds])];

    // 4. 各Tripを取得
    const trips = (await Promise.all(
      mergedIds.map(async (id) => {
        try {
          const t = await kv.get<any>(`trips:${id}`);
          if (!t) return null;
          return {
            id: t.id || id,
            title: t.title || '(No title)',
            status: t.status || 'planning',
            uid: t.uid || '',
            authorName: t.authorName || '',
            createdAt: t.createdAt || '',
            isPublic: t.isPublic || false,
            tripType: t.tripType || 'recommended',
            saveCount: t.saveCount || 0,
            copyCount: t.copyCount || 0,
          };
        } catch { return null; }
      })
    )).filter(Boolean).sort((a: any, b: any) =>
      (a.createdAt < b.createdAt ? 1 : -1)
    );

    return json({ trips, total: trips.length });
  } catch (err) {
    return json({ error: 'Internal error', detail: String(err) }, 500);
  }
}
