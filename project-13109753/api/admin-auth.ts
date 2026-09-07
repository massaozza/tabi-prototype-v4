// /api/admin-auth.ts
// Vercel Serverless Function（Edge Runtime）
//
// 管理画面のログイン・ログアウト・状態確認を行うAPI。
// 認証の判断をブラウザからサーバーへ移すために新設した。
//
// 必要な環境変数（いずれもサーバー側のみ。クライアントには渡らない）：
//   ADMIN_PASSWORD        … 管理画面のパスワード
//   ADMIN_SESSION_SECRET  … セッショントークンの署名鍵（32文字以上を推奨）
//
// どちらか未設定の場合は認証を常に失敗させる（fail-closed）。
//
// POST   /api/admin-auth  body: { password }  → 成功なら HttpOnly Cookie を発行
// GET    /api/admin-auth                      → { authenticated: boolean }
// DELETE /api/admin-auth                      → Cookie を破棄
//
// ブルートフォース対策として、失敗時はIP単位で回数を数え、
// 一定回数を超えたら一時的に受け付けなくする。

import { kv } from '@vercel/kv';
import {
  checkAdminPassword,
  createAdminToken,
  isAdminRequest,
  adminCookieHeader,
  clearAdminCookieHeader,
} from './_adminAuth.js';

export const config = { runtime: 'edge' };

/** 同一IPからの連続失敗を許す回数と、そのカウントの保持時間 */
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

export default async function handler(req: Request): Promise<Response> {
  // ── 状態確認 ──
  if (req.method === 'GET') {
    return json({ authenticated: await isAdminRequest(req) });
  }

  // ── ログアウト ──
  if (req.method === 'DELETE') {
    return json({ success: true }, 200, { 'Set-Cookie': clearAdminCookieHeader() });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── ログイン ──
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    console.error('[admin-auth] ADMIN_PASSWORD / ADMIN_SESSION_SECRET が未設定です');
    return json({ error: 'Admin authentication is not configured' }, 503);
  }

  const attemptKey = `adminAuth:attempts:${clientIp(req)}`;
  try {
    const attempts = (await kv.get<number>(attemptKey)) || 0;
    if (attempts >= MAX_ATTEMPTS) {
      return json({ error: 'Too many attempts. Please try again later.' }, 429);
    }
  } catch {
    /* カウンタが読めなくてもログイン自体は続行する */
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const ok = await checkAdminPassword(body?.password);

  if (!ok) {
    try {
      const n = await kv.incr(attemptKey);
      if (n === 1) await kv.expire(attemptKey, ATTEMPT_WINDOW_SECONDS);
    } catch {
      /* 記録できなくても応答は返す */
    }
    return json({ error: 'Invalid password' }, 401);
  }

  const token = await createAdminToken();
  if (!token) return json({ error: 'Admin authentication is not configured' }, 503);

  try {
    await kv.del(attemptKey);
  } catch {
    /* noop */
  }

  return json({ success: true }, 200, { 'Set-Cookie': adminCookieHeader(token) });
}
