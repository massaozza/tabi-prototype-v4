// /api/_auth.ts
// 複数のAPI（upload-url.ts, experiences.ts等）で共通して使う、
// 「ログイン中のユーザーIDを取得する」ロジックをまとめたヘルパー。

import type { VercelRequest } from '@vercel/node';
import { kv } from '@vercel/kv';

interface SessionRecord {
  uid: string;
  createdAt: string;
}

export function getCookie(req: VercelRequest, name: string): string | null {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** session Cookieから、現在ログイン中のユーザーIDを取得する。未ログインなら null。 */
export async function getAuthenticatedUid(req: VercelRequest): Promise<string | null> {
  const token = getCookie(req, 'session');
  if (!token) return null;
  try {
    const session = await kv.get<SessionRecord>(`session:${token}`);
    return session?.uid ?? null;
  } catch {
    return null;
  }
}
