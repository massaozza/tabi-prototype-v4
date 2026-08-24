// /api/admin-users.ts
// Vercel Serverless Function（Edge Runtime）
// 管理画面「Users」ページ向けに、登録ユーザーの一覧を返すAPI。
//
// 【重要】このファイルは自己完結型にしてある（api/内の他ファイルからimportしない）。
// Vercelのビルド環境では、api/配下のファイル同士でモジュールを共有すると
// 実行時に "Cannot find module" エラーになることがあるため。
//
// 一覧の取得元：
// - users:index → 全ユーザーのuidを持つSet（api/auth.ts のサインアップ時に追加）
// - user:{uid}  → 各ユーザーのレコード（email, passwordHash, displayName, createdAt）
//
// 【自動バックフィル】users:index を追加する前に登録されたユーザーは、
// この索引に含まれていない。初回アクセス時、索引が空であれば
// user:* キーを直接スキャンして索引を作り直す（以降は通常通りSetを使う）。

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

async function getOrBackfillUids(): Promise<string[]> {
  const existing = (await kv.smembers('users:index')) as string[] | null;
  if (existing && existing.length > 0) {
    return existing;
  }

  // users:index がまだ無い/空 → user:* キーから直接スキャンしてバックフィルする
  const allUserKeys = await kv.keys('user:*');
  const candidateUids = allUserKeys
    .filter((k) => !k.startsWith('user:byEmail:'))
    .map((k) => k.slice('user:'.length))
    .filter((uid) => uid.length > 0);

  if (candidateUids.length > 0) {
    await kv.sadd('users:index', ...candidateUids);
  }

  return candidateUids;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const uids = await getOrBackfillUids();

    if (uids.length === 0) {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const records = await Promise.all(
      uids.map((uid) => kv.get<UserRecord>(`user:${uid}`))
    );

    const users: PublicUser[] = records
      .filter((u): u is UserRecord => Boolean(u))
      .map((u) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        createdAt: u.createdAt,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
