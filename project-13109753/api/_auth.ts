// /api/auth.ts
// Vercel Serverless Function（Node.js Runtime）
// サインアップ・ログイン・ログアウトを扱う認証API。
//
// 設計方針：
// - 外部認証サービス（Firebase等）は使わず、Vercel KVに自前でユーザー・セッションを保存する
// - パスワードは bcryptjs でハッシュ化する（自己流の暗号処理は行わない）
// - ログイン状態は HttpOnly Cookie に入れたセッショントークンで管理する
//   （トークン自体はKVに保存され、JavaScriptからは読み取れない）
//
// 【重要】bcryptjsがNode.jsのcryptoモジュールに依存するため、Edge Runtimeでは動かない。
// このファイルは、Vercelの標準的なNode.js Runtime向けの (req, res) 形式で書く
// （chat.ts等のEdge Runtime向け Request/Response 形式とは異なる）。
//
// KVのキー設計：
// - user:{uid}              → ユーザーレコード（email, passwordHash, displayName等）
// - user:byEmail:{email}    → email から uid を引くための索引
// - users:index             → 全ユーザーのuidを持つSet（管理画面のユーザー一覧で使用）
// - session:{token}         → { uid, createdAt }。TTL付きで自動失効する

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

function getCookie(req: VercelRequest, name: string): string | null {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body: {
    action?: string;
    email?: string;
    password?: string;
    displayName?: string;
  } = req.body || {};

  const { action } = body;

  // ── サインアップ ──
  if (action === 'signup') {
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const displayName = (body.displayName || '').trim();

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }
    if (password.length < 8) {
      res
        .status(400)
        .json({ error: 'Password must be at least 8 characters' });
      return;
    }
    if (!displayName) {
      res.status(400).json({ error: 'Display name is required' });
      return;
    }

    try {
      const existingUid = await kv.get<string>(`user:byEmail:${email}`);
      if (existingUid) {
        res
          .status(409)
          .json({ error: 'An account with this email already exists' });
        return;
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
      await kv.sadd('users:index', uid);

      const token = await createSession(uid);

      res.setHeader('Set-Cookie', setSessionCookie(token));
      res.status(200).json({ success: true, user: toPublicUser(user) });
      return;
    } catch (err) {
      res.status(500).json({ error: 'Signup failed', detail: String(err) });
      return;
    }
  }

  // ── ログイン ──
  if (action === 'login') {
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    try {
      const uid = await kv.get<string>(`user:byEmail:${email}`);
      if (!uid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const user = await kv.get<UserRecord>(`user:${uid}`);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = await createSession(user.uid);

      res.setHeader('Set-Cookie', setSessionCookie(token));
      res.status(200).json({ success: true, user: toPublicUser(user) });
      return;
    } catch (err) {
      res.status(500).json({ error: 'Login failed', detail: String(err) });
      return;
    }
  }

  // ── ログアウト ──
  if (action === 'logout') {
    try {
      const token = getCookie(req, 'session');
      if (token) {
        await kv.del(`session:${token}`);
      }
      res.setHeader('Set-Cookie', clearSessionCookie());
      res.status(200).json({ success: true });
      return;
    } catch (err) {
      res.status(500).json({ error: 'Logout failed', detail: String(err) });
      return;
    }
  }

  res
    .status(400)
    .json({ error: 'Unknown action. Must be "signup", "login", or "logout"' });
}
