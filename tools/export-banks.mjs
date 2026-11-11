#!/usr/bin/env node
/* 把遊戲內建的題庫匯出成 CSV 範本（給老師匯入 Google 試算表改題目）
 *
 *   node tools/export-banks.mjs            輸出到 3Dmap/題庫範本/（site 外面，不會上傳）
 *   node tools/export-banks.mjs 資料夾      輸出到指定資料夾
 *
 * 每個 CSV 第一列是欄位名稱；Excel 直接開也不會亂碼（有 BOM）。
 * 題庫有哪些、對應哪個遊戲，看 js/sheet-config.js。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', '題庫範本'));
const ICON_NAME = { TAIWAN_SVG: '臺灣地圖' };
const src = (f) => fs.readFileSync(path.join(ROOT, 'js', 'games', f), 'utf8');

// 從程式裡拿出 `const 名稱 = [ ... ];` 這個陣列（題庫都是純資料，直接算出來）
function grab(file, name) {
  const s = src(file), at = s.indexOf(`const ${name} = [`);
  if (at < 0) throw new Error(`${file} 裡找不到 ${name}`);
  let i = s.indexOf('[', at), depth = 0, q = null;
  for (let k = i; k < s.length; k++) {
    const ch = s[k];
    if (q) { if (ch === '\\') k++; else if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') q = ch;
    else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) {
      // 題目裡用到的圖（例如 TAIWAN_SVG 臺灣地圖）在範本裡寫成「臺灣地圖」這種代號，遊戲讀到會換回圖
      const scope = new Proxy({}, { has: (t, key) => !(key in globalThis), get: (t, key) => (key === Symbol.unscopables ? undefined : ICON_NAME[key] || key) });
      return new Function('scope', `with (scope) { return ${s.slice(i, k + 1)}; }`)(scope);
    }
  }
  throw new Error(`${name} 的陣列沒有結尾`);
}
const cell = (v) => { v = String(v ?? ''); return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v; };
const write = (name, head, rows) => {
  fs.writeFileSync(path.join(OUT, name), '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
  console.log(`  ${name}（${rows.length} 題）`);
};

fs.mkdirSync(OUT, { recursive: true });
console.log(`輸出到 ${OUT}`);
// 是非題：答案寫遊戲按鈕上的字（老師一看就懂）
const TF = [
  ['glider', 'GLIDER_FOOD', '蜜袋鼯能吃嗎', '可以吃', '不能吃'],
  ['float', 'FLOAT_ITEMS', '沉浮實驗', '浮起來', '沉下去'],
  ['history', 'HISTORY_ITEMS', '臺灣史地大考驗', '對', '錯'],
  ['traffic', 'TRAFFIC_ITEMS', '交通安全大考驗', '對', '不對'],
  ['life', 'LIFE_ITEMS', '生活大考驗', '對', '不對'],
  ['nature', 'NATURE_ITEMS', '自然小觀察', '對', '不對'],
];
for (const [kind, v, zh, yes, no] of TF) {
  write(`${kind}_${zh}.csv`, ['圖示', '題目', `答案（${yes}／${no}）`, '解說'], grab('quiz.js', v).map((q) => [q.e, q.n, q.ok ? yes : no, q.why]));
}
const MC = [['units', 'UNITS_ITEMS', '數學單位量詞'], ['geo', 'GEO_ITEMS', '臺灣地理'], ['busquiz', 'BUSQ_ITEMS', '乘車安全'], ['library', 'LIB_ITEMS', '整理圖書館'], ['decimal', 'DECIMAL_ITEMS', '小數點']];
for (const [kind, v, zh] of MC) {
  write(`${kind}_${zh}.csv`, ['圖示', '題目', '正確答案', '錯的選項1', '錯的選項2', '解說'], grab('kg.js', v).map((q) => [q.e, q.q, ...q.a, q.why]));
}
write('rhetoric_修辭小偵探.csv', ['修辭（譬喻 擬人 誇飾 排比 類疊 設問）', '句子', '解說'], grab('kg.js', 'RHET_Q'));
console.log('完成');
