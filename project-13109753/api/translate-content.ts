// /api/translate-content.ts
// POST /api/translate-content
//   body: { type: 'experience'|'trip'|'spot', id: string, targetLang: string, force?: boolean }
// → 指定コンテンツを指定言語に翻訳してKVに保存
//
// GET /api/translate-content?type=experience&id=xxx&lang=ko
// → 保存済み翻訳を返す（なければon-demand生成）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const SUPPORTED_LANGS = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

// 翻訳対象フィールド定義
const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  experience: ['placeName', 'whatWasGood', 'bestTimeToVisit', 'localTips', 'description'],
  trip: ['title', 'summary', 'highlights'],
  spot: ['title', 'description', 'tips'],
};

function transKey(type: string, id: string, lang: string) {
  return `${type}:${id}:trans:${lang}`;
}

function statusKey(type: string, id: string) {
  return `${type}:${id}:trans:status`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function translateWithGemini(
  content: Record<string, string>,
  sourceLang: string,
  targetLang: string
): Promise<Record<string, string> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const langNames: Record<string, string> = {
    'en': 'English', 'ja': '日本語', 'zh-TW': '繁體中文', 'zh-CN': '简体中文',
    'ko': '한국어', 'th': 'ภาษาไทย', 'fr': 'Français', 'de': 'Deutsch',
    'es': 'Español', 'id': 'Bahasa Indonesia',
  };

  const fieldsJson = JSON.stringify(content, null, 2);
  const prompt = `You are a professional translator for TABI47, a Japan travel platform.
Translate the following travel content from ${langNames[sourceLang] || sourceLang} to ${langNames[targetLang] || targetLang}.

Rules:
1. This is real local knowledge about Japan — preserve the meaning and nuance
2. Make it natural and understandable for ${langNames[targetLang]} speakers
3. Keep proper nouns (place names, station names, restaurant names) in their original form or standard romanization
4. Do NOT translate: {{variable}} placeholders
5. Return ONLY a valid JSON object with the same keys — no markdown, no explanation
6. If a field is empty or null, keep it as empty string

Content to translate:
${fieldsJson}

Return translated JSON:`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function getSourceContent(type: string, id: string): Promise<{
  record: any;
  fields: Record<string, string>;
  originalLang: string;
} | null> {
  let record: any = null;

  if (type === 'experience') {
    record = await kv.get(`experiences:${id}`);
  } else if (type === 'trip') {
    record = await kv.get(`trips:${id}`);
  } else if (type === 'spot') {
    const destinations = await kv.get<any[]>('content:destinations');
    record = destinations?.find((d) => d.id === id) || null;
  }

  if (!record) return null;

  const fields: Record<string, string> = {};
  for (const field of TRANSLATABLE_FIELDS[type] || []) {
    if (record[field] && typeof record[field] === 'string') {
      fields[field] = record[field];
    } else if (Array.isArray(record[field])) {
      fields[field] = record[field].join(' | ');
    }
  }

  const originalLang = record.originalLanguage || 'ja';
  return { record, fields, originalLang };
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // ── GET: 翻訳済みコンテンツを取得 ──
  if (req.method === 'GET') {
    const type = url.searchParams.get('type');
    const id = url.searchParams.get('id');
    const lang = url.searchParams.get('lang') as Lang;

    if (!type || !id || !lang) return json({ error: 'type, id, lang are required' }, 400);
    if (!SUPPORTED_LANGS.includes(lang)) return json({ error: 'Unsupported language' }, 400);

    // キャッシュを確認
    const cached = await kv.get(transKey(type, id, lang));
    if (cached) return json({ translation: cached, fromCache: true });

    // on-demand生成
    const source = await getSourceContent(type, id);
    if (!source) return json({ error: 'Content not found' }, 404);

    // 同一言語ならそのまま返す
    if (source.originalLang === lang) {
      return json({ translation: source.fields, fromCache: false, isOriginal: true });
    }

    const translated = await translateWithGemini(source.fields, source.originalLang, lang);
    if (!translated) return json({ error: 'Translation failed' }, 500);

    // キャッシュ保存（30日）
    await kv.set(transKey(type, id, lang), translated, { ex: 60 * 60 * 24 * 30 });

    return json({ translation: translated, fromCache: false });
  }

  // ── POST: 翻訳を生成・保存 ──
  if (req.method === 'POST') {
    let body: { type: string; id: string; targetLang?: string; allLangs?: boolean; force?: boolean };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { type, id, targetLang, allLangs, force } = body;
    if (!type || !id) return json({ error: 'type and id are required' }, 400);

    const source = await getSourceContent(type, id);
    if (!source) return json({ error: 'Content not found' }, 404);

    const targetLangs: Lang[] = allLangs
      ? SUPPORTED_LANGS.filter((l) => l !== source.originalLang)
      : targetLang
      ? [targetLang as Lang]
      : ['en']; // デフォルトは英語のみ

    const results: Record<string, string> = {};

    for (const lang of targetLangs) {
      // force=falseかつキャッシュありはスキップ
      if (!force) {
        const cached = await kv.get(transKey(type, id, lang));
        if (cached) { results[lang] = 'skipped (cached)'; continue; }
      }

      const translated = await translateWithGemini(source.fields, source.originalLang, lang);
      if (translated) {
        await kv.set(transKey(type, id, lang), translated, { ex: 60 * 60 * 24 * 30 });
        // statusを更新
        const status = await kv.get<Record<string, string>>(statusKey(type, id)) || {};
        status[lang] = 'generated';
        await kv.set(statusKey(type, id), status);
        results[lang] = 'generated';
      } else {
        results[lang] = 'failed';
      }
    }

    return json({ success: true, results });
  }

  return json({ error: 'Method not allowed' }, 405);
}
