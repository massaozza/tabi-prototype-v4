// /api/auth/me.ts
// Vercel Serverless Function（Edge Runtime）
// Cookie内のセッショントークンから、現在ログイン中のユーザー情報を返す。
// ログインしていない場合は { user: null } を返す（エラーにはしない）。

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

interface UserRecord {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface SessionRecord {
  uid: string;
  createdAt: string;
}

function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = getCookie(req, 'session');
  if (!token) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const session = await kv.get<SessionRecord>(`session:${token}`);
    if (!session) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await kv.get<UserRecord>(`user:${session.uid}`);
    if (!user) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        user: { uid: user.uid, email: user.email, displayName: user.displayName },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    // KV読み取り失敗時は「未ログイン」として扱う（サイト全体を落とさない）
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
