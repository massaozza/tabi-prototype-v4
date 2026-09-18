// /api/admin-users.ts
// GET  → 全ユーザー一覧
// DELETE /api/admin-users?uid=xxx → ユーザー削除（Admin専用）

import { kv } from '@vercel/kv';
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';

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
  // 管理者以外は一切処理させない（サーバー側の境界）
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  const url = new URL(req.url);

  // ── DELETE: ユーザー削除（Admin専用） ──
  //
  // 【2026-09-18 修正】以前は user:{uid}:trips / user:{uid}:experiences の
  // 「索引（Set）」だけを削除していたが、それが指す実データ（trips:{id}等）
  // 自体は削除されず、公開Tripなどはユーザー削除後もサイト上に残り続けて
  // いた（削除依頼への対応としても不十分だった）。
  // また user:{uid}:guides・user:{uid}:savedTrips・user:byEmail:{email}
  // は一切削除されていなかった。
  // 今回、そのユーザーが持つTrip・Experience・Guideの実データと、
  // それらが登録されているグローバル索引（trips:published、
  // guides:all、experiences:all、spot:{id}:guides等）も含めて
  // カスケード削除するようにした。
  //
  // savedTrips（他人のTripを保存したブックマーク一覧）は、参照先が
  // 「他人の」Tripのため、実データ自体を削除する必要はなく、
  // このユーザー分の索引Setを削除するだけでよい。
  //
  // 写実データの完全性を優先し、個々のTrip/Experience/Guideの削除で
  // 一部失敗しても、他の削除処理は続行する（部分的な削除漏れが残る
  // 可能性はあるが、一つの失敗で全体を止めない方が実務上安全）。
  if (req.method === 'DELETE') {
    const uid = url.searchParams.get('uid');
    if (!uid) return json({ error: 'uid is required' }, 400);
    try {
      // 削除前に、email（byEmail索引の削除に必要）を読んでおく
      const userRecord = await kv.get<UserRecord>(`user:${uid}`).catch(() => null);

      // 削除前に、このユーザーが持つコンテンツのIDを読んでおく
      // （索引を先に消すと、どのTrip/Experience/Guideが対象か分からなくなる）
      const [tripIds, experienceIds, guideIds] = await Promise.all([
        kv.smembers(`user:${uid}:trips`).catch(() => []) as Promise<string[]>,
        kv.smembers(`user:${uid}:experiences`).catch(() => []) as Promise<string[]>,
        kv.smembers(`user:${uid}:guides`).catch(() => []) as Promise<string[]>,
      ]);

      // Trip本体を削除し、公開索引（trips:published）からも除外する
      await Promise.all(
        (tripIds || []).map(async (tripId) => {
          try {
            const trip = await kv.get<{ isPublic?: boolean }>(`trips:${tripId}`);
            await kv.del(`trips:${tripId}`);
            if (trip?.isPublic) await kv.srem('trips:published', tripId);
          } catch {
            /* 個別のTrip削除に失敗しても他の処理は続行する */
          }
        })
      );

      // Experience本体を削除し、全体索引・SPOT逆引き索引からも除外する
      await Promise.all(
        (experienceIds || []).map(async (expId) => {
          try {
            const exp = await kv.get<{ spotId?: string }>(`experiences:${expId}`);
            await kv.del(`experiences:${expId}`);
            await kv.srem('experiences:all', expId);
            if (exp?.spotId) await kv.srem(`spot:${exp.spotId}:experiences`, expId);
          } catch {
            /* 個別のExperience削除に失敗しても他の処理は続行する */
          }
        })
      );

      // Guide本体を削除し、全体索引・SPOT逆引き索引（複数SPOT対応）からも除外する
      await Promise.all(
        (guideIds || []).map(async (guideId) => {
          try {
            const guide = await kv.get<{ spots?: { spotId?: string }[] }>(`guides:${guideId}`);
            await kv.del(`guides:${guideId}`);
            await kv.srem('guides:all', guideId);
            const spotIds = (guide?.spots || [])
              .map((s) => s.spotId)
              .filter((s): s is string => Boolean(s));
            await Promise.all(spotIds.map((spotId) => kv.srem(`spot:${spotId}:guides`, guideId)));
          } catch {
            /* 個別のGuide削除に失敗しても他の処理は続行する */
          }
        })
      );

      // ユーザーごとの索引Set（savedTripsは他人のTripへの参照なので、
      // 実データではなくこの索引自体だけを削除する）
      await Promise.all([
        kv.del(`user:${uid}:trips`),
        kv.del(`user:${uid}:experiences`),
        kv.del(`user:${uid}:guides`),
        kv.del(`user:${uid}:savedTrips`),
      ]);

      // メールアドレスの逆引き索引（残すと、同じメールでの再登録時に
      // 存在しないuidを指す古いマッピングが残ってしまう）
      if (userRecord?.email) {
        await kv.del(`user:byEmail:${userRecord.email}`);
      }

      // ユーザー本体と一覧からの除外
      await kv.del(`user:${uid}`);
      await kv.srem('users:index', uid);

      return json({
        success: true,
        deleted: {
          trips: (tripIds || []).length,
          experiences: (experienceIds || []).length,
          guides: (guideIds || []).length,
        },
      });
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
          await kv.sadd('users:index', uids[0], ...uids.slice(1));
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
