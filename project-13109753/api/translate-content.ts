// /api/translate-content.ts
// Node.js Runtime（Edge Runtimeでの問題を回避）
//
// 【このファイルの役割】
// Spot・体験談・旅程・地方紹介文をGeminiで多言語に翻訳し、KVに30日
// キャッシュする。GET（キャッシュ優先の遅延生成）とPOST（明示的な
// 事前生成、管理者専用のforce再生成）の2系統がある。
//
// 【セキュリティ上の変更点（元の実装との差分）】
// - type/id/lang/targetLangをすべて厳格に検証する（許可リスト方式）。
// - force=true（キャッシュを無視して再生成）は管理者セッションが
//   ある場合のみ許可する。誰でも同じ翻訳を無限に再生成できると、
//   Gemini APIの費用を無制限に消費させられる。
// - キャッシュヒットはレート制限のカウント対象にしない
//   （実際にGeminiを呼ぶ場合だけをレート制限する）。
// - Geminiを実際に呼ぶ経路にIP単位のレート制限を適用する。
// - 同一コンテンツ・同一言語への同時リクエストは、KVのSET NXによる
//   ロックで直列化し、Geminiの重複呼び出しを防ぐ。
// - req.headers.host を外部fetch先として使わない（Hostヘッダーは
//   クライアントが送ってくる値であり、信用してよい情報ではない。
//   以前はこれを使って自分自身の /api/content を叩いていたが、
//   spotデータは _spotStore.ts の getSpot() から直接KVを読む形に
//   変更し、host依存を無くした）。
// - Gemini呼び出しにタイムアウト（AbortSignal）を追加する。
// - 入力文字数・フィールド数に上限を設ける。
// - 例外の詳細（スタック・生のエラーメッセージ）をレスポンスに含めない。

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { isAdminNodeRequest } from './_adminAuth.js';
import {
  checkRateLimit,
  clientIpFromNodeRequest,
  ANON_LIMITS,
} from './_rateLimit.js';
import { getSpot } from './_spotStore.js';

const SUPPORTED_LANGS = ['en', 'ja', 'zh-TW', 'zh-CN', 'ko', 'th', 'fr', 'de', 'es', 'id'] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  region: ['region', 'description'],
  experience: ['placeName', 'whatWasGood', 'whatWasHard', 'tip'],
  trip: ['title', 'summary'],
  spot: ['title', 'description', 'story', 'tips'],
};
const VALID_TYPES = Object.keys(TRANSLATABLE_FIELDS);

/** idの形式チェック（英数・ハイフン・アンダースコアのみ、長さ制限） */
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

/** 1フィールドあたりの最大文字数。これを超える分は翻訳対象から外す */
const MAX_FIELD_CHARS = 4000;
/** Geminiへの呼び出し自体のタイムアウト */
const GEMINI_TIMEOUT_MS = 15_000;
/** 同時生成ロックの保持時間。この間は同じキーへの2重生成を防ぐ */
const GENERATION_LOCK_SECONDS = 30;

function transKey(type: string, id: string, lang: string) {
  return `${type}:${id}:trans:${lang}`;
}
function lockKey(type: string, id: string, lang: string) {
  return `translock:${type}:${id}:${lang}`;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  'zh-TW': 'Traditional Chinese',
  'zh-CN': 'Simplified Chinese',
  ko: 'Korean',
  th: 'Thai',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  id: 'Indonesian',
};

function isValidType(type: unknown): type is string {
  return typeof type === 'string' && VALID_TYPES.includes(type);
}
function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id);
}
function isValidLang(lang: unknown): lang is Lang {
  return typeof lang === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(lang);
}

/** 型が違ってもクラッシュしないよう安全に文字列フィールドだけ取り出す */
function extractFields(record: Record<string, unknown>, type: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const field of TRANSLATABLE_FIELDS[type] || []) {
    const value = record[field];
    if (typeof value === 'string' && value.length > 0) {
      fields[field] = value.length > MAX_FIELD_CHARS ? value.slice(0, MAX_FIELD_CHARS) : value;
    }
  }
  return fields;
}

async function translateWithGemini(
  fields: Record<string, string>,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<Record<string, string> | null> {
  const prompt = `Translate this Japan travel content from ${LANG_NAMES[sourceLang] || sourceLang} to ${LANG_NAMES[targetLang] || targetLang}.
Return ONLY valid JSON with same keys. No markdown.

${JSON.stringify(fields)}`;

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );
  } catch (e) {
    console.error('[translate-content] Gemini request failed (network/timeout):', e);
    return null;
  }

  if (!res.ok) {
    console.error('[translate-content] Gemini error:', res.status);
    return null;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    // 期待したキー以外が混ざらないよう、元のfieldsのキーだけを取り出す
    const out: Record<string, string> = {};
    for (const key of Object.keys(fields)) {
      if (typeof parsed[key] === 'string') out[key] = parsed[key];
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    console.error('[translate-content] JSON parse failed');
    return null;
  }
}

/**
 * type/idに対応するレコードを取得する。
 * 【重要】以前はspot型でHostヘッダーを使い自分自身にfetchしていたが、
 * Hostヘッダーはクライアントが送る値なので外部fetch先として信用できない。
 * 代わりに共有のSpotストア（KVから直接読む）を使う。
 */
async function getRecord(type: string, id: string): Promise<Record<string, unknown> | null> {
  if (type === 'experience') {
    return (await kv.get(`experiences:${id}`)) as Record<string, unknown> | null;
  }
  if (type === 'trip') {
    return (await kv.get(`trips:${id}`)) as Record<string, unknown> | null;
  }
  if (type === 'region') {
    const REGIONS: Record<string, { region: string; description: string }> = {
      hokkaido: {
        region: 'Hokkaido',
        description: "Japan's northernmost island, known for powder snow, national parks, and fresh seafood.",
      },
      tohoku: {
        region: 'Tohoku',
        description: 'The northeastern region of Honshu, known for hot springs, mountain scenery, and seasonal traditions.',
      },
      kanto: {
        region: 'Kanto',
        description: 'Home to Tokyo and the surrounding prefectures, blending modern city life with historic towns like Kamakura.',
      },
      chubu: {
        region: 'Chubu',
        description: 'Central Japan, home to the Japanese Alps, Mt. Fuji, and cities like Nagoya and Kanazawa.',
      },
      kansai: {
        region: 'Kansai',
        description: "The historic heart of Japan, home to Kyoto, Osaka, and Nara's ancient temples and shrines.",
      },
      chugoku: {
        region: 'Chugoku',
        description: 'Western Honshu, home to Hiroshima and the scenic Seto Inland Sea coastline.',
      },
      shikoku: {
        region: 'Shikoku',
        description: "Japan's smallest main island, known for its pilgrimage route, rural landscapes, and udon culture.",
      },
      'kyushu-okinawa': {
        region: 'Kyushu & Okinawa',
        description: 'Southern Japan, known for volcanic hot springs, subtropical islands, and distinctive local cuisine.',
      },
    };
    return REGIONS[id] || null;
  }
  if (type === 'spot') {
    const spot = await getSpot(id);
    return spot as unknown as Record<string, unknown> | null;
  }
  return null;
}

/** 生成ロックを取得する。取れなければ false */
async function acquireLock(key: string): Promise<boolean> {
  try {
    const result = await kv.set(key, '1', { nx: true, ex: GENERATION_LOCK_SECONDS });
    return result !== null;
  } catch {
    // ロックが取れなくても翻訳自体は止めない（可用性優先）
    return true;
  }
}
async function releaseLock(key: string): Promise<void> {
  try {
    await kv.del(key);
  } catch {
    /* noop */
  }
}

/** ロック中に他リクエストが生成を終えるのを短く待つ */
async function waitForCache(key: string, attempts = 4, delayMs = 700): Promise<unknown | null> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const cached = await kv.get(key).catch(() => null);
    if (cached) return cached;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[translate-content] GEMINI_API_KEY not configured');
    return res.status(503).json({ error: 'Translation is not configured' });
  }

  const ip = clientIpFromNodeRequest(req);

  // ── GET ──
  if (req.method === 'GET') {
    const { type, id, lang } = req.query as { type?: unknown; id?: unknown; lang?: unknown };

    if (!isValidType(type)) return res.status(400).json({ error: 'Invalid or missing type' });
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid or missing id' });
    if (!isValidLang(lang)) return res.status(400).json({ error: 'Invalid or missing lang' });

    try {
      // キャッシュ確認（レート制限より先に行い、ヒットならカウントしない）
      const cached = await kv.get(transKey(type, id, lang));
      if (cached) return res.json({ translation: cached, fromCache: true });

      // ここから先はGeminiを呼ぶ可能性があるのでレート制限を適用する
      const limit = await checkRateLimit('translate-content', ip, ANON_LIMITS);
      if (!limit.ok) {
        res.setHeader('Retry-After', String(limit.retryAfter));
        return res.status(429).json({ error: 'Too many requests. Please try again later.', retryAfter: limit.retryAfter });
      }

      const record = await getRecord(type, id);
      if (!record) return res.status(404).json({ error: 'Content not found' });

      const originalLang =
        typeof record.originalLanguage === 'string'
          ? record.originalLanguage
          : type === 'spot'
          ? 'en'
          : 'ja';

      // 同一言語ならそのまま返す（翻訳不要）
      if (originalLang === lang) {
        return res.json({ translation: extractFields(record, type), isOriginal: true });
      }

      const fields = extractFields(record, type);
      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: 'No translatable fields found' });
      }

      // 同一コンテンツ・同一言語への同時生成を防ぐ
      const lkey = lockKey(type, id, lang);
      if (!(await acquireLock(lkey))) {
        const waited = await waitForCache(transKey(type, id, lang));
        if (waited) return res.json({ translation: waited, fromCache: true });
        return res.status(202).json({ error: 'Translation is already being generated. Please retry shortly.' });
      }

      try {
        const translated = await translateWithGemini(fields, originalLang, lang, apiKey);
        if (!translated) return res.status(502).json({ error: 'Translation failed' });

        await kv.set(transKey(type, id, lang), translated, { ex: 60 * 60 * 24 * 30 });
        return res.json({ translation: translated, fromCache: false });
      } finally {
        await releaseLock(lkey);
      }
    } catch (err) {
      console.error('[translate-content] GET error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  // ── POST ──
  if (req.method === 'POST') {
    try {
      const body = (req.body || {}) as { type?: unknown; id?: unknown; targetLang?: unknown; force?: unknown };
      const { type, id } = body;
      const targetLang = body.targetLang ?? 'en';
      const force = body.force === true;

      if (!isValidType(type)) return res.status(400).json({ error: 'Invalid or missing type' });
      if (!isValidId(id)) return res.status(400).json({ error: 'Invalid or missing id' });
      if (!isValidLang(targetLang)) return res.status(400).json({ error: 'Invalid or missing targetLang' });

      // force（キャッシュ無視の再生成）は管理者のみ。
      // 誰でも呼べると、同じ翻訳を何度でも再生成させてGemini費用を
      // 消費させられる。
      if (force && !(await isAdminNodeRequest(req))) {
        return res.status(403).json({ error: 'force requires an authenticated admin session' });
      }

      const key = transKey(type, id, targetLang);

      if (!force) {
        const cached = await kv.get(key);
        if (cached) return res.json({ success: true, result: 'cached' });
      }

      // forceでない一般利用にはレート制限を適用する
      // （forceは管理者操作のため対象外にしている）
      if (!force) {
        const limit = await checkRateLimit('translate-content-post', ip, ANON_LIMITS);
        if (!limit.ok) {
          res.setHeader('Retry-After', String(limit.retryAfter));
          return res
            .status(429)
            .json({ error: 'Too many requests. Please try again later.', retryAfter: limit.retryAfter });
        }
      }

      const record = await getRecord(type, id);
      if (!record) return res.status(404).json({ error: 'Content not found' });

      const originalLang = typeof record.originalLanguage === 'string' ? record.originalLanguage : 'ja';
      const fields = extractFields(record, type);
      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: 'No translatable fields found' });
      }

      const lkey = lockKey(type, id, targetLang);
      if (!force && !(await acquireLock(lkey))) {
        const waited = await waitForCache(key);
        if (waited) return res.json({ success: true, result: 'cached' });
        return res.status(202).json({ error: 'Translation is already being generated. Please retry shortly.' });
      }

      try {
        const translated = await translateWithGemini(fields, originalLang, targetLang, apiKey);
        if (!translated) return res.status(502).json({ error: 'Translation failed' });

        await kv.set(key, translated, { ex: 60 * 60 * 24 * 30 });
        return res.json({ success: true, result: 'generated' });
      } finally {
        if (!force) await releaseLock(lkey);
      }
    } catch (err) {
      console.error('[translate-content] POST error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
