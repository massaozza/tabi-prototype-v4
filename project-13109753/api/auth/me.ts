// /api/auth/me.ts
// Vercel Serverless Function（Node.js Runtime）
// Cookie内のセッショントークンから、現在ログイン中のユーザー情報を返す。
// ログインしていない場合は { user: null } を返す（エラーにはしない）。
//
// auth.tsと同じくNode.js Runtime向けの (req, res) 形式で書く。

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

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

function getCookie(req: VercelRequest, name: string): string | null {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = getCookie(req, 'session');
  if (!token) {
    res.status(200).json({ user: null });
    return;
  }

  try {
    const session = await kv.get<SessionRecord>(`session:${token}`);
    if (!session) {
      res.status(200).json({ user: null });
      return;
    }

    const user = await kv.get<UserRecord>(`user:${session.uid}`);
    if (!user) {
      res.status(200).json({ user: null });
      return;
    }

    res.status(200).json({
      user: { uid: user.uid, email: user.email, displayName: user.displayName },
    });
  } catch {
    // KV読み取り失敗時は「未ログイン」として扱う（サイト全体を落とさない）
    res.status(200).json({ user: null });
  }
}
