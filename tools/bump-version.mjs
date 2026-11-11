#!/usr/bin/env node
/* 一次更新全站的版本號（瀏覽器快取用的 ?v=數字）
 *
 *   node tools/bump-version.mjs        目前最大的版本號 +1
 *   node tools/bump-version.mjs 300    指定成 300
 *
 * 會改 index.html 和 js/ 底下所有 .js（包含子資料夾），全部換成同一個數字。
 * 模組之間的 import 網址一定要一致：同一個檔案用兩種 ?v= 載入，瀏覽器會當成兩份，程式會壞掉。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = /\?v=(\d+)/g;

const jsFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? jsFiles(p) : e.name.endsWith('.js') ? [p] : [];
});
const files = [path.join(ROOT, 'index.html'), path.join(ROOT, 'teacher.html'), ...jsFiles(path.join(ROOT, 'js'))];

const arg = process.argv[2];
if (arg !== undefined && !/^\d+$/.test(arg)) {
  console.error(`版本號要是數字，收到：${arg}`);
  process.exit(1);
}

const sources = files.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
const found = new Set(sources.flatMap(({ text }) => [...text.matchAll(VERSION)].map((m) => +m[1])));
if (!found.size) {
  console.error('找不到任何 ?v=數字，沒有更新。');
  process.exit(1);
}

const next = arg !== undefined ? +arg : Math.max(...found) + 1;
if (found.size > 1) console.warn(`注意：原本的版本號不一致（${[...found].sort((a, b) => a - b).join('、')}），這次會統一。`);

let changed = 0;
for (const { file, text } of sources) {
  const updated = text.replace(VERSION, `?v=${next}`);
  if (updated === text) continue;
  fs.writeFileSync(file, updated);
  console.log(`  ${path.relative(ROOT, file).replaceAll('\\', '/')}`);
  changed++;
}
console.log(`版本號已更新為 ?v=${next}（${changed} 個檔案）`);
