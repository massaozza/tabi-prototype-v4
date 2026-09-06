// /api/translate-ui.ts
// Vercel Serverless Function（Edge Runtime）
//
// UI文言・DBコンテンツのテキストをまとめて翻訳して返す。
// 翻訳ファイルに無い文言はここで自動翻訳されるため、10言語ファイルを
// 手作業でメンテする必要がなくなる。結果はKVに永続キャッシュする。
//
// 【重要】Edge Runtimeにしている理由：
// Node.js Serverless Functionの本数がプランの上限（12本）に達していたため、
// Node版のままだとこの関数がデプロイされず404になる。
// Edge Functionは本数上限の対象外で、起動も速い。
// そのためNode専用API（node:crypto等）は使わず、ハッシュは純粋なJSで実装している。
//
// POST /api/translate-ui
//   body: { texts: string[], lang: string }
//   res:  { translations: { [originalText]: translatedText } }

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const SUPPORTED_LANGS = ['en', 'ja', 'zh-TW', 'zh-CN', 'ko', 'th', 'fr', 'de', 'es', 'id'];

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

const MAX_TEXTS = 250;
const CHUNK = 25;
const CHUNK_CHARS = 3500;

// Geminiのレート上限に達したことを表す。以降のリクエストを止めるために使う。
class RateLimited extends Error {}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Edgeではnode:cryptoが使えないため、純粋なJSのFNV-1a系ハッシュでキーを作る
function hashText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

function uiKey(text: string, lang: string): string {
  return `ui:${hashText(text)}:${text.length}:${lang}`;
}

const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;
const KANA = /[\u3040-\u30ff]/;
const HANGUL = /[\uac00-\ud7af]/;
const THAI = /[\u0e00-\u0e7f]/;

function alreadyTarget(text: string, lang: string): boolean {
  if (lang === 'ja') return KANA.test(text);
  if (lang === 'ko') return HANGUL.test(text);
  if (lang === 'th') return THAI.test(text);
  if (lang === 'en') return !CJK.test(text) && !HANGUL.test(text) && !THAI.test(text);
  if (lang === 'zh-TW' || lang === 'zh-CN') {
    return CJK.test(text) && !KANA.test(text) && !/[A-Za-z]{4,}/.test(text);
  }
  return false;
}

async function translateChunk(
  texts: string[],
  targetLang: string,
  apiKey: string,
  errors: string[]
): Promise<string[] | null> {
  const payload: Record<string, string> = {};
  texts.forEach((t, i) => {
    payload[String(i)] = t;
  });

  const langName = LANG_NAMES[targetLang] || targetLang;
  const prompt = `You are localizing TABI47, a Japan travel website, for ${langName} speakers.

Translate every value in the JSON below into ${langName}.
The source text may be English or Japanese. Detect it per value.
If a value is already in ${langName}, return it unchanged.

Rules:
- Keep the exact same keys ("0", "1", ...). Do not add or drop keys.
- These are UI labels, buttons, place descriptions and travel content. Keep them natural and concise.
- Keep the brand name "TABI47" unchanged.
- Keep Japanese place names recognizable.
- Preserve leading/trailing spaces, arrows, symbols and punctuation style.
- Return ONLY valid JSON. No markdown fences, no commentary.

${JSON.stringify(payload)}`;

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
        }),
      }
    );
  } catch (e) {
    console.error('[translate-ui] fetch failed:', e);
    errors.push('fetch failed: ' + String(e).slice(0, 120));
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[translate-ui] Gemini error:', res.status, body.slice(0, 300));
    errors.push(`gemini ${res.status} (${model}): ` + body.slice(0, 200));
    // 429（レート上限）は分割リトライしても悪化するだけなので即座に打ち切る
    if (res.status === 429) throw new RateLimited();
    return null;
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = String(raw).replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[translate-ui] JSON parse failed:', cleaned.slice(0, 200));
    errors.push('json parse failed: ' + cleaned.slice(0, 150));
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  return texts.map((original, i) => {
    const v = parsed[String(i)];
    return typeof v === 'string' && v.trim() ? v : original;
  });
}

// チャンクが失敗したら半分に割って再挑戦する。
// 1件が原因で40件まとめて英語のまま残る、という事態を防ぐ。
async function translateWithRetry(
  texts: string[],
  targetLang: string,
  apiKey: string,
  errors: string[],
  depth = 0
): Promise<string[] | null> {
  const out = await translateChunk(texts, targetLang, apiKey, errors);
  if (out) return out;
  if (depth >= 1 || texts.length <= 1) return null;

  // 429以外の失敗なら、半分に割って順番に再挑戦する（並列にはしない）
  const mid = Math.ceil(texts.length / 2);
  const a = await translateWithRetry(texts.slice(0, mid), targetLang, apiKey, errors, depth + 1);
  const b = await translateWithRetry(texts.slice(mid), targetLang, apiKey, errors, depth + 1);
  if (!a && !b) return null;
  return [...(a || texts.slice(0, mid)), ...(b || texts.slice(mid))];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const lang: string = body?.lang;
  const rawTexts: unknown = body?.texts;

  if (!lang || !Array.isArray(rawTexts)) {
    return json({ error: 'texts and lang required' }, 400);
  }
  if (!SUPPORTED_LANGS.includes(lang)) {
    return json({ error: 'Unsupported lang' }, 400);
  }

  const texts = Array.from(
    new Set((rawTexts as unknown[]).filter((t): t is string => typeof t === 'string' && !!t.trim()))
  ).slice(0, MAX_TEXTS);

  if (texts.length === 0) return json({ translations: {} });

  const translations: Record<string, string> = {};

  try {
    // ── 1. キャッシュを一括確認 ──
    const cached = await Promise.all(
      texts.map((t) => kv.get<string>(uiKey(t, lang)).catch(() => null))
    );

    const missing: string[] = [];
    texts.forEach((t, i) => {
      const c = cached[i];
      if (typeof c === 'string' && c) translations[t] = c;
      else if (alreadyTarget(t, lang)) translations[t] = t;
      else missing.push(t);
    });

    if (missing.length === 0) {
      return json({ translations, fromCache: true });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return json({ translations, error: 'GEMINI_API_KEY not configured' });
    }

    // ── 2. 件数と文字数の両方でチャンク分割 ──
    const chunks: string[][] = [];
    let cur: string[] = [];
    let curChars = 0;
    for (const text of missing) {
      if (cur.length > 0 && (cur.length >= CHUNK || curChars + text.length > CHUNK_CHARS)) {
        chunks.push(cur);
        cur = [];
        curChars = 0;
      }
      cur.push(text);
      curChars += text.length;
    }
    if (cur.length > 0) chunks.push(cur);

    // 【重要】Geminiの毎分リクエスト上限に引っかからないよう、
    // チャンクは並列ではなく順番に処理する。
    // 429が出た時点で打ち切り、取得できた分だけ返す（残りは次回のアクセスで取得される）。
    const errors: string[] = [];
    const results: (string[] | null)[] = [];
    let rateLimited = false;
    for (const chunk of chunks) {
      if (rateLimited) {
        results.push(null);
        continue;
      }
      try {
        results.push(await translateWithRetry(chunk, lang, apiKey, errors));
      } catch (e) {
        if (e instanceof RateLimited) {
          rateLimited = true;
          results.push(null);
        } else {
          throw e;
        }
      }
    }

    // ── 3. キャッシュ保存（180日） ──
    const writes: Promise<unknown>[] = [];
    results.forEach((out, ci) => {
      if (!out) return;
      chunks[ci].forEach((original, i) => {
        const translated = out[i];
        if (typeof translated !== 'string' || !translated.trim()) return;
        translations[original] = translated;
        // 翻訳できず原文が返ってきたものはキャッシュしない（次回再挑戦させる）
        if (translated === original && !alreadyTarget(original, lang)) return;
        writes.push(
          kv.set(uiKey(original, lang), translated, { ex: 60 * 60 * 24 * 180 }).catch(() => null)
        );
      });
    });
    await Promise.all(writes);

    return json({
      translations,
      translated: writes.length,
      ...(rateLimited ? { rateLimited: true } : {}),
      ...(errors.length ? { geminiErrors: errors.slice(0, 2) } : {}),
    });
  } catch (err) {
    console.error('[translate-ui] error:', err);
    // 失敗してもキャッシュ済み分は返す（画面が壊れないように）
    return json({ translations, error: String(err) });
  }
}
