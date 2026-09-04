// /api/admin-users.ts
// GET  → 全ユーザー一覧
// DELETE /api/admin-users?uid=xxx → ユーザー削除（Admin専用）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

interface UserRecord {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface PublicUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

function isWrongTypeError(err: unknown): boolean {
  return String(err).includes('WRONGTYPE');
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // ── DELETE: ユーザー削除（Admin専用） ──
  if (req.method === 'DELETE') {
    const uid = url.searchParams.get('uid');
    if (!uid) return json({ error: 'uid is required' }, 400);
    try {
      // ユーザーレコード削除
      await kv.del(`user:${uid}`);
      // usersインデックスから除外
      await kv.srem('users:index', uid);
      // そのユーザーのTrip・Experienceインデックスも削除
      await kv.del(`user:${uid}:trips`);
      await kv.del(`user:${uid}:experiences`);
      return json({ success: true });
    } catch (err) {
      return json({ error: 'Failed to delete user', detail: String(err) }, 500);
    }
  }

  // ── GET: ユーザー一覧 ──
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    let uids: string[] = [];
    try {
      const members = await kv.smembers('users:index');
      uids = (members || []).filter((m): m is string => typeof m === 'string');
    } catch (err) {
      if (isWrongTypeError(err)) {
        await kv.del('users:index');
        return json({ users: [] });
      }
      throw err;
    }

    if (uids.length === 0) {
      // バックフィル: user:* を直接スキャン
      try {
        let cursor = 0;
        do {
          const [nextCursor, keys] = await kv.scan(cursor, { match: 'user:*', count: 100 });
          cursor = nextCursor as unknown as number;
          for (const key of keys as string[]) {
            const parts = key.split(':');
            if (parts.length === 2) uids.push(parts[1]);
          }
        } while (cursor !== 0);
        if (uids.length > 0) {
          await kv.sadd('users:index', ...uids);
        }
      } catch { /* バックフィル失敗は無視 */ }
    }

    const records = await Promise.all(
      uids.map(async (uid) => {
        try { return await kv.get<UserRecord>(`user:${uid}`); }
        catch { return null; }
      })
    );

    const users: PublicUser[] = records
      .filter((u): u is UserRecord => Boolean(u))
      .map((u) => ({ uid: u.uid, email: u.email, displayName: u.displayName, createdAt: u.createdAt }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return json({ users });
  } catch (err) {
    return json({ error: 'Internal error', detail: String(err) }, 500);
  }
}
