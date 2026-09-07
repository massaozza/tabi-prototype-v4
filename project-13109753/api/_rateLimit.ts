// /api/_rateLimit.ts
//
// AI APIの呼び出し回数を制限する共通処理。
//
// 【なぜ必要か】
// Gemini APIはプリペイド課金なので、無制限に呼べる公開APIがあると
// 第三者に残高を枯らされる。残高が尽きるとチャットも翻訳も止まるため、
// 「サービスが停止する」という形で実害が出る。
// ログイン必須にすると訪日前の見込み客が試せなくなるので、
// 誰でも使えるが常識的な回数までに抑える方式をとる。
//
// 【方式】
// 固定ウィンドウ方式。KVのINCRとEXPIREだけで実装しており、
// 1回の判定で1〜2コマンドしか使わないため軽い。
// 厳密なスライディングウィンドウではないが、
// 悪用を止めるという目的には十分。
//
// 【重要】ファイル名を "_" で始めているのは、
// Vercelがこれをエンドポイントとして公開しないようにするため。
//
// Edge / Node のどちらからも使えるよう、kv以外の依存を持たない。

import { kv } from '@vercel/kv';

export interface RateWindow {
  /** ウィンドウの長さ（秒） */
  windowSeconds: number;
  /** そのウィンドウ内で許す回数 */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** 制限に達した場合、次に試せるまでの秒数 */
  retryAfter: number;
  /** どのウィンドウで引っかかったか（ログ用） */
  hitWindow?: number;
}

/** 未ログインの一般訪問者向け。試すには十分だが連打はできない量 */
export const ANON_LIMITS: RateWindow[] = [
  { windowSeconds: 60 * 60, max: 20 },
  { windowSeconds: 60 * 60 * 24, max: 50 },
];

/** ログイン済みユーザー向け。本気で使う人が困らない量 */
export const USER_LIMITS: RateWindow[] = [
  { windowSeconds: 60 * 60, max: 60 },
  { windowSeconds: 60 * 60 * 24, max: 200 },
];

/**
 * 回数を数えて、上限を超えていないかを判定する。
 *
 * @param scope  対象API名。'chat' など
 * @param id     識別子。IPアドレスかuid
 * @param limits 適用するウィンドウの一覧
 */
export async function checkRateLimit(
  scope: string,
  id: string,
  limits: RateWindow[]
): Promise<RateLimitResult> {
  if (!id) return { ok: true, retryAfter: 0 };

  const nowSec = Math.floor(Date.now() / 1000);

  for (const { windowSeconds, max } of limits) {
    // ウィンドウごとにバケットを切る。バケット番号が変われば自然にリセットされる
    const bucket = Math.floor(nowSec / windowSeconds);
    const key = `rl:${scope}:${id}:${windowSeconds}:${bucket}`;

    try {
      const count = await kv.incr(key);
      // 最初の1回だけTTLを設定する（放置してもKVに溜まらないように）
      if (count === 1) await kv.expire(key, windowSeconds);

      if (count > max) {
        const resetAt = (bucket + 1) * windowSeconds;
        return {
          ok: false,
          retryAfter: Math.max(resetAt - nowSec, 1),
          hitWindow: windowSeconds,
        };
      }
    } catch {
      // KVが落ちているときに全リクエストを止めるのは過剰なので、
      // 計測できない場合は通す（可用性を優先する）
      return { ok: true, retryAfter: 0 };
    }
  }

  return { ok: true, retryAfter: 0 };
}

/** Edge Runtime（Request）から接続元IPを取り出す */
export function clientIpFromRequest(req: Request): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

/** Node.js Runtime（VercelRequest相当）から接続元IPを取り出す */
export function clientIpFromNodeRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real;

  const fwd = req.headers['x-forwarded-for'];
  const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
  if (typeof fwdStr === 'string' && fwdStr) return fwdStr.split(',')[0].trim();

  return 'unknown';
}

/** 上限に達したときのレスポンス（Edge用） */
export function rateLimitedResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  );
}
