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
// 【設計】
// - 管理者パスワードは環境変数 ADMIN_PASSWORD（サーバー側のみ）に置く。
//   クライアントのバンドルには一切含めない。
// - ログインに成功したら HMAC-SHA256 で署名したトークンを
//   HttpOnly Cookie に入れる。KVに保存しないので失効管理は有効期限のみ。
// - 署名鍵は ADMIN_SESSION_SECRET。未設定なら認証を常に失敗させる
//   （設定漏れで「誰でも通る」状態になるのを防ぐため、fail-closed にしている）。
//
// 【重要】ファイル名を "_" で始めているのは、Vercelがこれを
// APIエンドポイントとして公開しないようにするため（共有モジュール扱い）。
//
// Edge Runtime / Node.js Runtime のどちらからも使えるよう、
// Web Crypto API のみを使い、Cookie文字列を引数で受け取る形にしている。

export const ADMIN_COOKIE_NAME = 'tabi47_admin';

/** 管理者セッションの有効期間（8時間） */
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
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

/** 管理者トークンを発行する。形式: {exp}.{署名} */
export async function createAdminToken(): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS;
  const payload = String(exp);
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}

/** トークンの署名と有効期限を検証する */
export async function verifyAdminToken(token: string | null | undefined): Promise<boolean> {
  const secret = getSecret();
  // 鍵が未設定なら誰も通さない（設定漏れで開放されるのを防ぐ）
  if (!secret || !token) return false;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const exp = parseInt(payload, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;

  const expected = await hmac(payload, secret);
  return safeEqual(sig, expected);
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

/** 管理者パスワードを照合する */
export async function checkAdminPassword(password: unknown): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== 'string' || !password) return false;
  // 生の比較ではなくハッシュ同士を比べ、長さの違いを漏らさない
  const secret = getSecret() || 'fallback-compare-only';
  const [a, b] = await Promise.all([hmac(password, secret), hmac(expected, secret)]);
  return safeEqual(a, b);
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
