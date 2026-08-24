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
//
// 【自己修復】users:index が何らかの理由でSet以外の型として存在してしまっている
// 場合（WRONGTYPEエラー）、そのキーを削除してから作り直す。

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

async function getUsersIndexSafe(): Promise<string[] | null> {
  try {
    return (await kv.smembers('users:index')) as string[] | null;
  } catch (err) {
    if (isWrongTypeError(err)) {
      // users:index が Set以外の型で存在している → 削除して作り直す
      try {
        await kv.del('users:index');
      } catch {
        // ignore
      }
      return null;
    }
    throw err;
  }
}

async function addToUsersIndexSafe(uids: string[]): Promise<void> {
  try {
    await kv.sadd('users:index', ...uids);
  } catch (err) {
    if (isWrongTypeError(err)) {
      await kv.del('users:index');
      await kv.sadd('users:index', ...uids);
    } else {
      throw err;
    }
  }
}

async function getOrBackfillUids(): Promise<string[]> {
  const existing = await getUsersIndexSafe();
  if (existing && existing.length > 0) {
    return existing;
  }

  // users:index がまだ無い/空 → user:* キーから直接スキャンしてバックフィルする
  //
  // 【注意】"user:*" というパターンは、user:{uid} だけでなく、
  // user:byEmail:{email} や user:{uid}:trips / user:{uid}:experiences
  // （そのユーザーのTrip/Experience ID一覧）のような、別の名前空間のキーにも
  // マッチしてしまう。"user:" を取り除いた残りの文字列に ":" が含まれる場合は
  // すべて別の名前空間のキーとみなし、候補から除外する（uid自体にはコロンが
  // 含まれないUUID形式のため、この判定で正しく絞り込める）。
  const allUserKeys = await kv.keys('user:*');
  const candidateUids = allUserKeys
    .map((k) => k.slice('user:'.length))
    .filter((rest) => rest.length > 0 && !rest.includes(':'));

  if (candidateUids.length > 0) {
    await addToUsersIndexSafe(candidateUids);
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
      uids.map(async (uid) => {
        try {
          return await kv.get<UserRecord>(`user:${uid}`);
        } catch {
          // 想定外の形式のuidが紛れていた場合でも、その1件だけをスキップし、
          // 一覧全体の表示は継続する。
          return null;
        }
      })
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
