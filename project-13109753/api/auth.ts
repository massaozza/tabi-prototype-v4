// /api/auth.ts
// Vercel Serverless Function（Edge Runtime）
// サインアップ・ログイン・ログアウトを扱う認証API。
//
// 設計方針：
// - 外部認証サービス（Firebase等）は使わず、Vercel KVに自前でユーザー・セッションを保存する
// - パスワードは bcryptjs でハッシュ化する（自己流の暗号処理は行わない）
// - ログイン状態は HttpOnly Cookie に入れたセッショントークンで管理する
//   （トークン自体はKVに保存され、JavaScriptからは読み取れない）
//
// KVのキー設計：
// - user:{uid}              → ユーザーレコード（email, passwordHash, displayName等）
// - user:byEmail:{email}    → email から uid を引くための索引
// - session:{token}         → { uid, createdAt }。TTL付きで自動失効する

import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

// GEMINI_API_KEY等とは異なり、bcryptjsがNode.jsのcryptoモジュールに依存するため、
// このAPIはVercelのデフォルト（Node.js Runtime）で動かす。Edge Runtimeは指定しない。
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30日
const SALT_ROUNDS = 10;

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
}

function toPublicUser(user: UserRecord): PublicUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

function generateId(): string {
  return crypto.randomUUID();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setSessionCookie(token: string): string {
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie(): string {
  return `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

async function createSession(uid: string): Promise<string> {
  const token = generateId();
  await kv.set(
    `session:${token}`,
    { uid, createdAt: new Date().toISOString() },
    { ex: SESSION_TTL_SECONDS }
  );
  return token;
}

function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: {
    action?: string;
    email?: string;
    password?: string;
    displayName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action } = body;

  // ── サインアップ ──
  if (action === 'signup') {
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const displayName = (body.displayName || '').trim();

    if (!isValidEmail(email)) {
      return jsonResponse({ error: 'Invalid email address' }, 400);
    }
    if (password.length < 8) {
      return jsonResponse(
        { error: 'Password must be at least 8 characters' },
        400
      );
    }
    if (!displayName) {
      return jsonResponse({ error: 'Display name is required' }, 400);
    }

    try {
      const existingUid = await kv.get<string>(`user:byEmail:${email}`);
      if (existingUid) {
        return jsonResponse(
          { error: 'An account with this email already exists' },
          409
        );
      }

      const uid = generateId();
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user: UserRecord = {
        uid,
        email,
        passwordHash,
        displayName,
        createdAt: new Date().toISOString(),
      };

      await kv.set(`user:${uid}`, user);
      await kv.set(`user:byEmail:${email}`, uid);

      const token = await createSession(uid);

      return jsonResponse(
        { success: true, user: toPublicUser(user) },
        200,
        { 'Set-Cookie': setSessionCookie(token) }
      );
    } catch (err) {
      return jsonResponse(
        { error: 'Signup failed', detail: String(err) },
        500
      );
    }
  }

  // ── ログイン ──
  if (action === 'login') {
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return jsonResponse(
        { error: 'Email and password are required' },
        400
      );
    }

    try {
      const uid = await kv.get<string>(`user:byEmail:${email}`);
      if (!uid) {
        return jsonResponse({ error: 'Invalid email or password' }, 401);
      }

      const user = await kv.get<UserRecord>(`user:${uid}`);
      if (!user) {
        return jsonResponse({ error: 'Invalid email or password' }, 401);
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return jsonResponse({ error: 'Invalid email or password' }, 401);
      }

      const token = await createSession(user.uid);

      return jsonResponse(
        { success: true, user: toPublicUser(user) },
        200,
        { 'Set-Cookie': setSessionCookie(token) }
      );
    } catch (err) {
      return jsonResponse(
        { error: 'Login failed', detail: String(err) },
        500
      );
    }
  }

  // ── ログアウト ──
  if (action === 'logout') {
    try {
      const token = getCookie(req, 'session');
      if (token) {
        await kv.del(`session:${token}`);
      }
      return jsonResponse({ success: true }, 200, {
        'Set-Cookie': clearSessionCookie(),
      });
    } catch (err) {
      return jsonResponse(
        { error: 'Logout failed', detail: String(err) },
        500
      );
    }
  }

  return jsonResponse(
    { error: 'Unknown action. Must be "signup", "login", or "logout"' },
    400
  );
}
