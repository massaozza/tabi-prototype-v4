// /api/translate-ui.ts
// UI文言（英語原文）をまとめて翻訳して返す。
// 翻訳ファイルに無いキーはここで自動翻訳されるため、10言語ファイルを
// 手作業でメンテする必要がなくなる。結果はKVに永続キャッシュする。
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { createHash } from 'crypto';

export const config = { maxDuration: 60 };

const SUPPORTED_LANGS = ['en', 'ja', 'zh-TW', 'zh-CN', 'ko', 'th', 'fr', 'de', 'es', 'id'] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

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
const CHUNK = 40;
const CHUNK_CHARS = 6000;

function uiKey(text: string, lang: string) {
  return `ui:${createHash('sha1').update(text).digest('hex').slice(0, 16)}:${lang}`;
}

async function translateChunk(
  texts: string[],
  targetLang: string,
  apiKey: string
): Promise<string[] | null> {
  // インデックス付きオブジェクトで返させる（配列より欠落に強い）
  const payload: Record<string, string> = {};
  texts.forEach((t, i) => {
    payload[String(i)] = t;
  });

  const prompt = `You are localizing TABI47, a Japan travel website, for ${LANG_NAMES[targetLang] || targetLang} speakers.

Translate every value in the JSON below into ${LANG_NAMES[targetLang] || targetLang}.
The source text may be English or Japanese. Detect it per value.
If a value is already in ${LANG_NAMES[targetLang] || targetLang}, return it unchanged.

Rules:
- Keep the exact same keys ("0", "1", ...). Do not add or drop keys.
- These are UI labels, buttons, place descriptions and travel content. Keep them natural and concise.
- Keep the brand name "TABI47" unchanged.
- Keep Japanese place names recognizable.
- Preserve leading/trailing spaces, arrows, symbols and punctuation style.
- Return ONLY valid JSON. No markdown fences, no commentary.

${JSON.stringify(payload)}`;

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (e) {
    console.error('[translate-ui] fetch failed:', e);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[translate-ui] Gemini error:', res.status, body.slice(0, 200));
    return null;
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[translate-ui] JSON parse failed:', cleaned.slice(0, 200));
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  return texts.map((original, i) => {
    const v = parsed[String(i)];
    return typeof v === 'string' && v.trim() ? v : original;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const lang: string = body?.lang;
  const rawTexts: unknown = body?.texts;

  if (!lang || !Array.isArray(rawTexts)) {
    return res.status(400).json({ error: 'texts and lang required' });
  }
  if (!SUPPORTED_LANGS.includes(lang as Lang)) {
    return res.status(400).json({ error: 'Unsupported lang' });
  }

  const texts = Array.from(
    new Set((rawTexts as unknown[]).filter((t): t is string => typeof t === 'string' && !!t.trim()))
  ).slice(0, MAX_TEXTS);

  if (texts.length === 0) return res.json({ translations: {} });

  const translations: Record<string, string> = {};

  // すでに対象言語で書かれているものはGeminiに投げない
  const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;
  const HANGUL = /[\uac00-\ud7af]/;
  const THAI = /[\u0e00-\u0e7f]/;
  const alreadyTarget = (text: string): boolean => {
    if (lang === 'ja') return /[\u3040-\u30ff]/.test(text);
    if (lang === 'ko') return HANGUL.test(text);
    if (lang === 'th') return THAI.test(text);
    if (lang === 'en') return !CJK.test(text) && !HANGUL.test(text) && !THAI.test(text);
    if (lang === 'zh-TW' || lang === 'zh-CN') {
      return CJK.test(text) && !/[\u3040-\u30ff]/.test(text) && !/[A-Za-z]{4,}/.test(text);
    }
    return false;
  };

  try {
    // ── 1. キャッシュ一括確認 ──
    const cached = await Promise.all(texts.map((t) => kv.get<string>(uiKey(t, lang)).catch(() => null)));
    const missing: string[] = [];
    texts.forEach((t, i) => {
      if (typeof cached[i] === 'string' && cached[i]) translations[t] = cached[i] as string;
      else if (alreadyTarget(t)) translations[t] = t;
      else missing.push(t);
    });

    if (missing.length === 0) {
      return res.json({ translations, fromCache: true });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // 鍵が無くてもキャッシュ済み分は返す（画面は英語にフォールバック）
      return res.json({ translations, error: 'GEMINI_API_KEY not configured' });
    }

    // ── 2. チャンクに分けて並列翻訳 ──
    // 件数だけでなく文字数でも分割する（長文の説明文でトークン超過しないように）
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

    const results = await Promise.all(chunks.map((c) => translateChunk(c, lang, apiKey)));

    // ── 3. キャッシュ保存 ──
    const writes: Promise<any>[] = [];
    results.forEach((out, ci) => {
      if (!out) return;
      chunks[ci].forEach((original, i) => {
        const translated = out[i];
        if (typeof translated !== 'string' || !translated.trim()) return;
        translations[original] = translated;
        // UI文言は変わらないので長めに保持（180日）
        writes.push(kv.set(uiKey(original, lang), translated, { ex: 60 * 60 * 24 * 180 }).catch(() => null));
      });
    });
    await Promise.all(writes);

    return res.json({ translations, translated: writes.length });
  } catch (err) {
    console.error('[translate-ui] error:', err);
    return res.status(200).json({ translations, error: String(err) });
  }
}
