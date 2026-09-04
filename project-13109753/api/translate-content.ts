// /api/translate-content.ts
// Node.js Runtime（Edge Runtimeでの問題を回避）
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Node.js Runtime（デフォルト）を明示
// export const config = { runtime: 'edge' }; // 削除

const SUPPORTED_LANGS = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  experience: ['placeName', 'whatWasGood', 'whatWasHard', 'tip'],
  trip: ['title', 'summary'],
  spot: ['title', 'description'],
};

function transKey(type: string, id: string, lang: string) {
  return `${type}:${id}:trans:${lang}`;
}

const LANG_NAMES: Record<string, string> = {
  'en': 'English', 'ja': 'Japanese', 'zh-TW': 'Traditional Chinese',
  'zh-CN': 'Simplified Chinese', 'ko': 'Korean', 'th': 'Thai',
  'fr': 'French', 'de': 'German', 'es': 'Spanish', 'id': 'Indonesian',
};

async function translateWithGemini(
  fields: Record<string, string>,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<Record<string, string> | null> {
  const prompt = `Translate this Japan travel content from ${LANG_NAMES[sourceLang] || sourceLang} to ${LANG_NAMES[targetLang] || targetLang}.
Return ONLY valid JSON with same keys. No markdown.

${JSON.stringify(fields)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!res.ok) {
    console.error('[translate-content] Gemini error:', res.status);
    return null;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('[translate-content] JSON parse failed:', cleaned.slice(0, 100));
    return null;
  }
}

async function getRecord(type: string, id: string, host: string): Promise<any> {
  if (type === 'experience') {
    return await kv.get(`experiences:${id}`);
  }
  if (type === 'trip') {
    return await kv.get(`trips:${id}`);
  }
  if (type === 'spot') {
    const list = await kv.get<any[]>('content:destinations');
    let record = list?.find((d: any) => d.id === id) || null;
    if (!record) {
      const res = await fetch(`https://${host}/api/content?type=destinations`);
      if (res.ok) {
        const data = await res.json();
        record = (data.data || []).find((d: any) => d.id === id) || null;
      }
    }
    return record;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const host = req.headers.host || 'www.tabi47.com';

  // ── GET ──
  if (req.method === 'GET') {
    const { type, id, lang } = req.query as { type: string; id: string; lang: string };

    if (!type || !id || !lang) {
      return res.status(400).json({ error: 'type, id, lang required' });
    }
    if (!SUPPORTED_LANGS.includes(lang as Lang)) {
      return res.status(400).json({ error: 'Unsupported lang' });
    }

    try {
      // キャッシュ確認
      const cached = await kv.get(transKey(type, id, lang));
      if (cached) return res.json({ translation: cached, fromCache: true });

      // レコード取得
      const record = await getRecord(type, id, host);
      if (!record) {
        return res.status(404).json({ error: 'Content not found', type, id });
      }

      const originalLang = record.originalLanguage || (type === 'spot' ? 'en' : 'ja');

      // 同一言語
      if (originalLang === lang) {
        const fields: Record<string, string> = {};
        for (const field of TRANSLATABLE_FIELDS[type] || []) {
          if (record[field]) fields[field] = record[field];
        }
        return res.json({ translation: fields, isOriginal: true });
      }

      // 翻訳フィールド抽出
      const fields: Record<string, string> = {};
      for (const field of TRANSLATABLE_FIELDS[type] || []) {
        if (record[field] && typeof record[field] === 'string') {
          fields[field] = record[field];
        }
      }

      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: 'No translatable fields found', recordKeys: Object.keys(record) });
      }

      // 翻訳実行
      const translated = await translateWithGemini(fields, originalLang, lang, apiKey);
      if (!translated) {
        return res.status(500).json({ error: 'Translation failed' });
      }

      // キャッシュ保存（30日）
      await kv.set(transKey(type, id, lang), translated, { ex: 60 * 60 * 24 * 30 });
      return res.json({ translation: translated, fromCache: false });

    } catch (err) {
      console.error('[translate-content] error:', err);
      return res.status(500).json({ error: String(err) });
    }
  }

  // ── POST ──
  if (req.method === 'POST') {
    try {
      const { type, id, targetLang = 'en', force } = req.body || {};
      if (!type || !id) return res.status(400).json({ error: 'type and id required' });

      if (!force) {
        const cached = await kv.get(transKey(type, id, targetLang));
        if (cached) return res.json({ success: true, result: 'cached' });
      }

      const record = await getRecord(type, id, host);
      if (!record) return res.status(404).json({ error: 'Content not found' });

      const originalLang = record.originalLanguage || 'ja';
      const fields: Record<string, string> = {};
      for (const field of TRANSLATABLE_FIELDS[type] || []) {
        if (record[field] && typeof record[field] === 'string') fields[field] = record[field];
      }

      const translated = await translateWithGemini(fields, originalLang, targetLang, apiKey);
      if (!translated) return res.status(500).json({ error: 'Translation failed' });

      await kv.set(transKey(type, id, targetLang), translated, { ex: 60 * 60 * 24 * 30 });
      return res.json({ success: true, result: 'generated' });

    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
