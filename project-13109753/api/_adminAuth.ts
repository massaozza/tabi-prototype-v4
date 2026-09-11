// /api/_adminAuth.ts
//
// 管理者認証の共通処理。
//
// 【なぜ必要か】
// これまで管理画面の認証は AdminAuth.tsx が localStorage を見るだけで、
// サーバー側には一切チェックがなかった。つまり画面を隠していただけで、
// /api/admin-users や /api/content を直接叩けば誰でも
// 全ユーザーの個人情報を読み、全コンテンツを上書きできた。
// このモジュールは、その境界をサーバー側に移すためのもの。
//
// 【設計（KVでの失効管理あり）】
// - 管理者パスワードは環境変数 ADMIN_PASSWORD（サーバー側のみ）に置く。
//   クライアントのバンドルには一切含めない。
// - ログイン成功時に crypto.randomUUID() でランダムなセッションIDを
//   発行し、KVに { createdAt, expiresAt } をTTL付きで保存する。
//   Cookieには「セッションID + HMAC-SHA256署名」を入れる
//   （署名は改ざん検知の一次防御、実際の有効性はKVへの問い合わせで
//   最終確認する）。
// - こうすることで、ログアウト時・Cookie漏洩時・パスワード変更時に
//   サーバー側からそのセッション（または全セッション）を即座に
//   無効化できる（以前は有効期限が来るまで止められなかった）。
// - 署名鍵は ADMIN_SESSION_SECRET。32文字未満、またはよくある弱い値
//   （all-same-char等）は拒否し、未設定時と同様に認証を常に
//   失敗させる（fail-closed）。
//
// 【KV障害時の挙動について】
// セッション検証がKVの読み取りに依存するため、KVが落ちていると
// 管理者は一時的にログインできなくなる（fail-closed）。認証という
// 高コストな失敗を許容できない処理では、可用性より安全側に倒す。
//
// 【重要】ファイル名を "_" で始めているのは、Vercelがこれを
// APIエンドポイントとして公開しないようにするため（共有モジュール扱い）。
//
// Edge Runtime / Node.js Runtime のどちらからも使えるよう、
// Web Crypto API のみを使い、Cookie文字列を引数で受け取る形にしている。

import { kv } from '@vercel/kv';

export const ADMIN_COOKIE_NAME = 'tabi47_admin';

/** 管理者セッションの有効期間（8時間） */
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

/** セッションIDごとのKVキー。値は存在すれば有効（TTLで自動失効） */
function sessionKey(sessionId: string): string {
  return `admin:session:${sessionId}`;
}

/** 発行済みセッションIDの一覧（「全セッション失効」用）。個別のTTL失効とは独立して管理する */
const ADMIN_ACTIVE_SESSIONS_SET = 'admin:sessions:active';

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  // "aaaaaaaa...", "00000000..." のような明らかに弱い値も拒否する
  if (/^(.)\1+$/.test(secret)) return null;
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

/** 長さに依存しない比較（タイミング攻撃対策） */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * 新しい管理者セッションを作る。
 * ランダムなセッションIDをKVに保存し、「セッションID.署名」を返す。
 * KVへの書き込みに失敗した場合は null（＝ログイン自体を失敗させる）。
 */
export async function createAdminToken(): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;

  const sessionId = crypto.randomUUID();
  try {
    await kv.set(sessionKey(sessionId), { createdAt: Date.now() }, { ex: ADMIN_SESSION_SECONDS });
    await kv.sadd(ADMIN_ACTIVE_SESSIONS_SET, sessionId);
  } catch {
    return null;
  }

  const sig = await hmac(sessionId, secret);
  return `${sessionId}.${sig}`;
}

/**
 * トークンの署名を検証し、KV上でそのセッションがまだ有効か確認する。
 * どちらか一方でも失敗したら未認証扱いにする。
 */
export async function verifyAdminToken(token: string | null | undefined): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;

  const sessionId = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  // UUID以外の値が紛れ込んでいないか軽く検証する（KVクエリの前に弾く）
  if (!/^[0-9a-f-]{16,64}$/i.test(sessionId)) return false;

  const expected = await hmac(sessionId, secret);
  if (!safeEqual(sig, expected)) return false;

  try {
    const record = await kv.get(sessionKey(sessionId));
    return record !== null && record !== undefined;
  } catch {
    // KV障害時はfail-closed（安全側）にする
    return false;
  }
}

/** ログアウト時・不正利用検知時に、指定したトークンのセッションだけを失効させる */
export async function revokeAdminToken(token: string | null | undefined): Promise<void> {
  if (!token) return;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return;
  const sessionId = token.slice(0, dot);
  try {
    await kv.del(sessionKey(sessionId));
    await kv.srem(ADMIN_ACTIVE_SESSIONS_SET, sessionId);
  } catch {
    /* ログアウト自体は続行する（Cookie削除だけでも一定の効果はある） */
  }
}

/**
 * 発行済みの全管理者セッションを失効させる。
 * パスワード変更時・Cookie漏洩が疑われる場合に使う「緊急停止」用。
 *
 * 【制約】個別セッションのTTL失効とは別にこのSetを維持しているため、
 * 自然にTTL切れしたセッションIDがこのSetに残り続けることがある
 * （実害はない。srem対象が既に存在しなくてもエラーにはならない）。
 * 定期的な掃除は行っていないため、Setのサイズは緩やかに増える可能性がある。
 */
export async function revokeAllAdminSessions(): Promise<number> {
  try {
    const ids = ((await kv.smembers(ADMIN_ACTIVE_SESSIONS_SET)) || []) as string[];
    if (ids.length === 0) return 0;
    await Promise.all(ids.map((id) => kv.del(sessionKey(id)).catch(() => null)));
    await kv.del(ADMIN_ACTIVE_SESSIONS_SET);
    return ids.length;
  } catch {
    return 0;
  }
}

/** 管理者パスワードを照合する */
export async function checkAdminPassword(password: unknown): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== 'string' || !password) return false;
  // 生の比較ではなくハッシュ同士を比べ、長さの違いを漏らさない
  const secret = getSecret() || 'fallback-compare-only';
  const [a, b] = await Promise.all([hmac(password, secret), hmac(expected, secret)]);
  return safeEqual(a, b);
}

/** Cookieヘッダ文字列から値を取り出す */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Edge Runtime（Request）用。管理者として認証済みかを返す */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const token = readCookie(req.headers.get('cookie'), ADMIN_COOKIE_NAME);
  return verifyAdminToken(token);
}

/** Node.js Runtime（VercelRequest相当）用 */
export async function isAdminNodeRequest(req: {
  headers: { cookie?: string };
}): Promise<boolean> {
  const token = readCookie(req.headers?.cookie, ADMIN_COOKIE_NAME);
  return verifyAdminToken(token);
}

/** Set-Cookie ヘッダ値を組み立てる */
export function adminCookieHeader(token: string): string {
  return [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${ADMIN_SESSION_SECONDS}`,
  ].join('; ');
}

export function clearAdminCookieHeader(): string {
  return [
    `${ADMIN_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

/** 未認証時に返す共通レスポンス（Edge用） */
export function adminUnauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

