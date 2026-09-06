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

// codemodが出力する形式に対応：t('auto_xxxx', "text")
const PATTERN = /\bt\(\s*'(auto_[0-9a-f]+)'\s*,\s*("(?:[^"\\]|\\.)*")\s*\)/g;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.tsx$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

const strings = {};
let occurrences = 0;

for (const file of walk(SRC)) {
  const code = fs.readFileSync(file, 'utf8');
  for (const m of code.matchAll(PATTERN)) {
    const key = m[1];
    let text;
    try {
      text = JSON.parse(m[2]);
    } catch {
      continue;
    }
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
console.log(`→ ${path.relative(ROOT, OUT)}`);
