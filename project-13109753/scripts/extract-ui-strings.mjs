// scripts/extract-ui-strings.mjs
//
// src配下の .tsx から t('auto_xxxx', "English text") を抽出し、
// scripts/ui-strings.json に書き出す。
//
//   npm run i18n:extract
//
// 追加の依存パッケージは不要（Node標準機能のみ）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(__dirname, 'ui-strings.json');

// t('key', "English text") の形をキー名に関わらず拾う。
// auto_xxxx（codemod生成）だけでなく、手で名付けたキーも対象にする。
// クォートは ' " どちらも許容する。
const PATTERN =
  /\bt\(\s*(?:'([A-Za-z0-9_.]+)'|"([A-Za-z0-9_.]+)")\s*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g;

// すでに手書きの訳がある文言は抽出しない（重複と上書き事故を防ぐ）
function loadCuratedKeys() {
  const localDir = path.join(SRC, 'i18n', 'local');
  const keys = new Set();
  if (!fs.existsSync(localDir)) return keys;
  for (const lang of fs.readdirSync(localDir)) {
    const dir = path.join(localDir, lang);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.ts') || f === 'auto.ts' || f === 'index.ts') continue;
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/^\s*([A-Za-z0-9_.]+)\s*:/gm)) keys.add(m[1]);
    }
  }
  return keys;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.tsx$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

const curated = loadCuratedKeys();
const strings = {};
let occurrences = 0;
let skippedCurated = 0;

for (const file of walk(SRC)) {
  const code = fs.readFileSync(file, 'utf8');
  for (const m of code.matchAll(PATTERN)) {
    const key = m[1] || m[2];
    const rawText = m[3];
    // 手書きの訳が既にあるキーは対象外
    if (curated.has(key)) {
      skippedCurated += 1;
      continue;
    }
    let text;
    try {
      // シングルクォートの場合はダブルクォートに変換してからJSONとして読む
      text = rawText.startsWith('"')
        ? JSON.parse(rawText)
        : JSON.parse('"' + rawText.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');
    } catch {
      continue;
    }
    if (!text || !/[A-Za-z]/.test(text)) continue;
    occurrences += 1;
    if (strings[key] && strings[key] !== text) {
      console.warn(`⚠ キー衝突: ${key}\n   "${strings[key]}"\n   "${text}"`);
    }
    strings[key] = text;
  }
}

// キー順に並べて差分を見やすくする
const sorted = {};
for (const k of Object.keys(strings).sort()) sorted[k] = strings[k];

fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');

const chars = Object.values(sorted).reduce((n, s) => n + s.length, 0);
console.log(`抽出しました: ${Object.keys(sorted).length} 種 / 出現 ${occurrences} 箇所 / ${chars} 文字`);
console.log(`手書きの訳があるため除外: ${skippedCurated} 箇所`);
console.log(`→ ${path.relative(ROOT, OUT)}`);
