/* 題庫試算表：從 Google 試算表讀題目，蓋掉遊戲內建的題庫（設定在 js/sheet-config.js）
 *
 *   useSheet(kind, list, toItem, min)
 *     kind    sheet-config.js 裡的名稱
 *     list    遊戲的題目陣列（讀到就「原地」換成新題目，遊戲照常用同一個陣列）
 *     toItem  一列（字串陣列）→ 一題；格式不對回傳 null（那一列跳過）
 *     min     至少要有幾題才採用，太少就維持內建題目
 *     valid   其他條件（例如是非題「對」「錯」各要 3 題以上），不符合也維持內建題目
 *
 * 讀不到（沒網路、試算表沒共用、學校網路擋掉）→ 用上一次成功讀到的（存在這台電腦）→ 再不行用內建題目。 */
import { SHEETS } from '../sheet-config.js?v=326';

const CACHE = 'campus-sheet-';

// 試算表網址 → CSV 下載網址。支援：一般網址（/d/ID/edit#gid=0）、發布到網路的 CSV（/pub?output=csv）、站內檔案（測試用）
export function csvUrl(u) {
  u = (u || '').trim();
  if (!u) return null;
  if (!/^https?:/.test(u)) return u;                                    // 站內的 .csv（相對路徑）
  if (/output=csv|tqx=out:csv/.test(u)) return u;
  const id = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (!id) return null;
  const gid = u.match(/[#&?]gid=(\d+)/);
  return `https://docs.google.com/spreadsheets/d/${id[1]}/gviz/tq?tqx=out:csv${gid ? '&gid=' + gid[1] : ''}`;
}

// CSV 拆成一列一列（處理引號、引號裡的逗號和換行、"" 跳脫）
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

// 把讀到的題目放進遊戲：第一列是標題（圖示、題目…）就跳過
function apply(list, rows, toItem, min, valid) {
  const body = /題目|句子|修辭|圖示|答案/.test(rows[0]?.join('') || '') ? rows.slice(1) : rows;
  const items = body.map((r) => { try { return toItem(r); } catch { return null; } }).filter(Boolean);
  if (items.length < min || !valid(items)) return 0;
  list.splice(0, list.length, ...items);
  return items.length;
}

export const sheetStatus = {};                                        // 除錯用：每個題庫目前用的是哪裡的題目
export function useSheet(kind, list, toItem, min = 5, valid = () => true) {
  const url = csvUrl(SHEETS[kind]);
  if (!url) return Promise.resolve((sheetStatus[kind] = '內建'));
  // 先用上一次讀到的（馬上就有，不用等網路）
  try {
    const old = JSON.parse(localStorage.getItem(CACHE + kind) || 'null');
    if (old?.url === url && apply(list, old.rows, toItem, min, valid)) sheetStatus[kind] = '上次讀到的試算表';
  } catch { /* 私密模式或壞掉的快取 */ }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  return fetch(url, { cache: 'no-store', signal: ctl.signal })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then((text) => {
      if (/^\s*</.test(text)) throw new Error('拿到的是網頁不是 CSV（試算表可能沒有共用成「知道連結的任何人」）');
      const rows = parseCSV(text), n = apply(list, rows, toItem, min, valid);
      if (!n) throw new Error(`能用的題目不夠（至少 ${min} 題${valid.need ? '，而且' + valid.need : ''}）`);
      try { localStorage.setItem(CACHE + kind, JSON.stringify({ url, rows })); } catch { /* 滿了就算了 */ }
      return (sheetStatus[kind] = `試算表（${n} 題）`);
    })
    .catch((e) => {
      console.warn(`題庫「${kind}」讀不到試算表，用${sheetStatus[kind] || '內建題目'}：`, e.message);
      return (sheetStatus[kind] ||= '內建');
    })
    .finally(() => clearTimeout(timer));
}

/* ---- 三種題目格式（試算表一列 → 遊戲的一題）---- */

const YES = ['對', '是', 'o', '⭕', '○', '1', 'y', 'yes', 'true', '正確'], NO = ['錯', '否', 'x', '❌', '×', '0', 'n', 'no', 'false', '不對', '錯誤'];
// 是非題：圖示、題目、答案、解說。答案可以寫「對／錯」，或寫遊戲按鈕上的字（例如「可以吃」「不能吃」、「浮起來」「沉下去」）
export const trueFalse = (yesLabel, noLabel, icon = '❓') => ([e, n, ans, why]) => {
  if (!n || !ans) return null;
  const a = ans.toLowerCase();
  const ok = YES.includes(a) || ans === yesLabel || (yesLabel && yesLabel.startsWith(ans)) ? 1
    : NO.includes(a) || ans === noLabel || (noLabel && noLabel.startsWith(ans)) ? 0 : null;
  return ok === null ? null : { e: e || icon, n, ok, why: why || '' };
};
// 三選一：圖示、題目、正確答案、錯的選項1、錯的選項2、解說
export const threeChoice = (icon = '❓') => ([e, q, a0, a1, a2, why]) =>
  q && a0 && a1 && a2 && new Set([a0, a1, a2]).size === 3 ? { e: e || icon, q, a: [a0, a1, a2], why: why || '' } : null;
// 是非題一回 5 題，對、錯各抽 2～3 題，所以兩種各要有 3 題以上
export const bothSides = Object.assign((items) => items.filter((q) => q.ok).length >= 3 && items.filter((q) => !q.ok).length >= 3, { need: '「對」「錯」各 3 題以上' });
