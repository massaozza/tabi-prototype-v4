// scripts/generate-ui-translations.mjs
//
// scripts/ui-strings.json の文言を各言語に翻訳し、
// src/i18n/local/{lang}/auto.ts として書き出す。
//
//   GEMINI_API_KEY=xxxx npm run i18n:generate            … 全言語
//   GEMINI_API_KEY=xxxx npm run i18n:generate -- ko th   … 指定言語だけ
//
// 特徴：
//   - 途中で止めても再開できる（翻訳済みはスキップ）
//   - Geminiのレート上限に配慮して1件ずつ順番に送信し、間隔を空ける
//   - 429が出たら待って自動リトライ
//   - チャンクごとに保存するので中断してもそこまでは残る
//
// 追加の依存パッケージは不要（Node 18+ の標準fetchを使用）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STRINGS = path.join(__dirname, 'ui-strings.json');
const CACHE_DIR = path.join(__dirname, 'ui-translations');

const LANGS = {
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

// レート上限対策。無料枠は毎分15リクエスト程度なので余裕を持たせる
const CHUNK = 25;
const DELAY_MS = 5000;
const MAX_RETRY = 5;
const RETRY_WAIT_MS = 65000;

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

if (!API_KEY) {
  console.error('GEMINI_API_KEY が設定されていません。');
  console.error('例: GEMINI_API_KEY=xxxx npm run i18n:generate');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function translateChunk(entries, langCode, langName) {
  const payload = {};
  entries.forEach(([key, text]) => {
    payload[key] = text;
  });

  const prompt = `You are localizing TABI47, a Japan travel website, for ${langName} speakers.

Translate every value in the JSON below from English into ${langName}.

Rules:
- Keep the exact same keys. Do not add or drop keys.
- These are UI labels, buttons, headings and short sentences on a travel website.
- Keep them concise and natural. Button labels should stay short.
- Keep the brand name "TABI47" unchanged.
- Keep Japanese place names recognizable.
- Preserve leading/trailing spaces, arrows and punctuation style.
- Return ONLY valid JSON. No markdown fences, no commentary.

${JSON.stringify(payload, null, 0)}`;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
          }),
        }
      );
    } catch (e) {
      console.warn(`   通信エラー (${attempt}/${MAX_RETRY}): ${e}`);
      await sleep(5000);
      continue;
    }

    if (res.status === 429) {
      console.warn(`   レート上限。${Math.round(RETRY_WAIT_MS / 1000)}秒待ちます (${attempt}/${MAX_RETRY})`);
      await sleep(RETRY_WAIT_MS);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`   Gemini ${res.status} (${attempt}/${MAX_RETRY}): ${body.slice(0, 200)}`);
      await sleep(5000);
      continue;
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = String(raw).replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn(`   JSON解析に失敗 (${attempt}/${MAX_RETRY})`);
      await sleep(3000);
      continue;
    }

    const out = {};
    for (const [key] of entries) {
      const v = parsed?.[key];
      if (typeof v === 'string' && v.trim()) out[key] = v;
    }
    return out;
  }

  return null;
}

function writeTsFile(langCode, translations) {
  const dir = path.join(ROOT, 'src', 'i18n', 'local', langCode);
  fs.mkdirSync(dir, { recursive: true });

  const lines = [
    '// このファイルは scripts/generate-ui-translations.mjs が自動生成しています。',
    '// 直接編集しないでください（次回の生成で上書きされます）。',
    '// 訳を手で調整したい場合は同じキーを common.ts / home.ts / pages.ts に書いてください。',
    '// それらは auto.ts より後に読み込まれるため、手書きの訳が優先されます。',
    '',
    'const translations: Record<string, string> = {',
  ];
  for (const key of Object.keys(translations).sort()) {
    lines.push(`  ${key}: ${JSON.stringify(translations[key])},`);
  }
  lines.push('};', '', 'export default translations;', '');

  fs.writeFileSync(path.join(dir, 'auto.ts'), lines.join('\n'));
}

async function main() {
  const strings = loadJson(STRINGS, null);
  if (!strings) {
    console.error(`${path.relative(ROOT, STRINGS)} が見つかりません。先に npm run i18n:extract を実行してください。`);
    process.exit(1);
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets = requested.length > 0 ? requested : Object.keys(LANGS);

  const allKeys = Object.keys(strings);
  console.log(`対象文言: ${allKeys.length} 種 / 対象言語: ${targets.join(', ')}\n`);

  for (const lang of targets) {
    const langName = LANGS[lang];
    if (!langName) {
      console.warn(`未対応の言語コードです: ${lang}`);
      continue;
    }

    const cacheFile = path.join(CACHE_DIR, `${lang}.json`);
    const done = loadJson(cacheFile, {});

    // 未翻訳、または原文が変わったものだけを対象にする
    const todo = allKeys.filter((k) => !done[k]);

    console.log(`[${lang}] 翻訳済み ${allKeys.length - todo.length} / ${allKeys.length}`);
    if (todo.length === 0) {
      writeTsFile(lang, done);
      console.log(`[${lang}] 変更なし。auto.ts を書き出しました\n`);
      continue;
    }

    for (let i = 0; i < todo.length; i += CHUNK) {
      const slice = todo.slice(i, i + CHUNK);
      const entries = slice.map((k) => [k, strings[k]]);
      const n = Math.floor(i / CHUNK) + 1;
      const total = Math.ceil(todo.length / CHUNK);
      process.stdout.write(`[${lang}] ${n}/${total} (${slice.length}件) ... `);

      const out = await translateChunk(entries, lang, langName);
      if (!out) {
        console.log('失敗。ここで中断します。再実行すれば続きから再開できます。');
        break;
      }

      Object.assign(done, out);
      fs.writeFileSync(cacheFile, JSON.stringify(done, null, 2) + '\n');
      writeTsFile(lang, done);
      console.log(`完了 (${Object.keys(out).length}件)`);

      if (i + CHUNK < todo.length) await sleep(DELAY_MS);
    }

    console.log(`[${lang}] src/i18n/local/${lang}/auto.ts を更新しました\n`);
  }

  console.log('終了しました。src/i18n/local/*/auto.ts をGitHubにアップロードしてください。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
