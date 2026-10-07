import * as THREE from 'three';
import { Batch, mat } from './blocks.js?v=13';

/* =========================================================
 * 教室裝潢 + 門口的班牌 / 教室牌
 * 依空間種類與名稱自動擺家具（不必一間一間畫）
 *
 * 每間教室用「前後 u、左右 v」的座標擺：
 *   u = 0 是教室前面（黑板 / 電視那面牆），往後增加
 *   v = 0 是教室中線
 * 有門開在南北牆的教室，前面是西牆；門開在東西牆的，前面是北牆
 * ========================================================= */

/* ---------- 一整張的貼圖 ---------- */

function bigTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const T = {};
const once = (k, f) => (T[k] ||= f());

const blackboardMat = () => once('bb', () => new THREE.MeshLambertMaterial({ map: bigTex(640, 150, (c, w, h) => {
  c.fillStyle = '#2f5d47'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 6);
  // 中間會被電視擋住，字寫在兩側
  c.fillStyle = 'rgba(255,255,255,.78)'; c.font = '700 26px "Noto Sans TC", sans-serif';
  c.fillText('值日生：', 18, 40); c.fillText('聯絡簿', 18, 80);
  c.fillText('今天也要', w - 130, 40); c.fillText('加油！', w - 110, 80);
}) }));
const tvMat = () => once('tv', () => new THREE.MeshLambertMaterial({ map: bigTex(512, 290, (c, w, h) => {
  c.fillStyle = '#111'; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#1d3b6e'); g.addColorStop(1, '#0d1a33');
  c.fillStyle = g; c.fillRect(10, 10, w - 20, h - 20);
  c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '700 44px "Noto Sans TC", sans-serif'; c.textAlign = 'center';
  c.fillText('溪口國小', w / 2, h / 2 - 6);
  c.font = '500 24px "Noto Sans TC", sans-serif'; c.fillText('Xikou Elementary School', w / 2, h / 2 + 34);
}), emissive: '#0d1a33', emissiveIntensity: 0.4 }));
const corkMat = () => once('cork', () => new THREE.MeshLambertMaterial({ map: bigTex(512, 128, (c, w, h) => {
  c.fillStyle = '#c9a26a'; c.fillRect(0, 0, w, h);
  const cols = ['#fff7b0', '#ffd1dc', '#c8f0ff', '#d8ffc8', '#ffffff'];
  for (let i = 0; i < 14; i++) {
    c.fillStyle = cols[i % cols.length];
    c.save(); c.translate(20 + i * 35, 20 + (i % 3) * 30); c.rotate((i % 5 - 2) * 0.05);
    c.fillRect(0, 0, 30, 40); c.fillStyle = '#d33'; c.fillRect(13, 2, 4, 4); c.restore();
  }
}) }));
const booksMat = () => once('books', () => new THREE.MeshLambertMaterial({ map: (() => {
  const t = bigTex(256, 256, (c, w, h) => {
    c.fillStyle = '#7a5532'; c.fillRect(0, 0, w, h);
    const cols = ['#c0392b', '#2471a3', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#16a085', '#ecf0f1', '#34495e'];
    for (let row = 0; row < 4; row++) {
      let x = 4;
      while (x < w - 6) {
        const bw = 6 + Math.random() * 10, bh = 40 + Math.random() * 18;
        c.fillStyle = cols[(Math.random() * cols.length) | 0];
        c.fillRect(x, row * 64 + 62 - bh, bw, bh);
        x += bw + 1;
      }
      c.fillStyle = '#5c3d22'; c.fillRect(0, row * 64 + 60, w, 4);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})() }));
const cabinetMat = () => once('cab', () => new THREE.MeshLambertMaterial({ map: bigTex(128, 256, (c, w, h) => {
  c.fillStyle = '#9aa3ab'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#6d757c'; c.lineWidth = 4;
  for (let i = 0; i < 4; i++) { c.strokeRect(8, 8 + i * 62, w - 16, 54); c.fillStyle = '#545b61'; c.fillRect(w / 2 - 14, 30 + i * 62, 28, 6); }
}) }));
const mirrorMat = () => once('mirror', () => new THREE.MeshLambertMaterial({ map: bigTex(256, 128, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#dfeef7'); g.addColorStop(0.5, '#f7fbfd'); g.addColorStop(1, '#c9dce8');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(40, 0, 10, h); c.fillRect(60, 0, 4, h);
}), emissive: '#ffffff', emissiveIntensity: 0.15 }));
const screenMat = () => once('screen', () => new THREE.MeshLambertMaterial({ color: '#203a5c', emissive: '#16304f', emissiveIntensity: 0.6 }));

// 常用材質
const M = {
  wood: () => mat('planks', '#e8c9a0'),
  desk: () => mat('wool', '#e2c79c'),
  metal: () => mat('wool', '#7f8c86'),
  dark: () => mat('wool', '#2b2f33'),
  white: () => mat('wool', '#f5f5f2'),
  grey: () => mat('wool', '#b8bcc0'),
  red: () => mat('wool', '#d32f2f'),
  frame: () => mat('wool', '#7a5232'),
};

/* ---------- 房間座標框架 ---------- */

// 班級教室的前後方向（依學校實際）：思源樓維持原方向，其他棟前後對調
const flipped = (room) => room.type === 'class' && room.building !== 'D';

function frameOf(room, wallT, flip = false) {
  const m = room.m, d = room.doors || '';
  const inset = wallT / 2 + 0.02;
  const alongX = /[NS]/.test(d) || (!/[EW]/.test(d) && (m.x2 - m.x1) >= (m.z2 - m.z1));
  const L = (alongX ? m.x2 - m.x1 : m.z2 - m.z1) - inset * 2;   // 前後長度
  const W = (alongX ? m.z2 - m.z1 : m.x2 - m.x1) - inset * 2;   // 左右寬度
  const xc = (m.x1 + m.x2) / 2, zc = (m.z1 + m.z2) / 2;
  // flip：教室前面改在另一端（班級教室依學校實際配置）
  const toWorld = flip
    ? (u, v) => (alongX ? [m.x2 - inset - u, zc + v] : [xc + v, m.z2 - inset - u])
    : (u, v) => (alongX ? [m.x1 + inset + u, zc + v] : [xc + v, m.z1 + inset + u]);
  // 門在 v 的哪一邊；大型家具（床、鋼琴、櫃子）放另一邊才不會擋門
  const doorSide = alongX ? (d.includes('S') && !d.includes('N') ? 1 : -1) : (d.includes('E') && !d.includes('W') ? 1 : -1);
  return { L, W, alongX, toWorld, away: -doorSide };
}

function placer(batch, fr, y0) {
  // 以 (u, v) 為中心、底部在 y 的方塊
  const put = (material, du, dv, h, u, v, y = 0, plain = false) => {
    const [x, z] = fr.toWorld(u, v);
    const [w, d] = fr.alongX ? [du, dv] : [dv, du];
    (plain ? batch.plain : batch.box).call(batch, material, w, h, d, x, y0 + y + h / 2, z);
  };
  return put;
}

/* ---------- 各種家具 ---------- */

function deskAndChair(put, u, v) {
  put(M.desk(), 0.45, 0.6, 0.04, u, v, 0.68);           // 桌面
  put(M.metal(), 0.4, 0.56, 0.16, u, v, 0.52);          // 抽屜
  put(M.metal(), 0.04, 0.04, 0.52, u, v - 0.26, 0);     // 桌腳
  put(M.metal(), 0.04, 0.04, 0.52, u, v + 0.26, 0);
  put(M.desk(), 0.38, 0.38, 0.04, u + 0.45, v, 0.4);    // 椅面
  put(M.desk(), 0.04, 0.38, 0.32, u + 0.64, v, 0.46);   // 椅背
  put(M.metal(), 0.3, 0.04, 0.4, u + 0.45, v - 0.16, 0);
  put(M.metal(), 0.3, 0.04, 0.4, u + 0.45, v + 0.16, 0);
}
function chairAt(put, u, v, faceBack = true) {
  put(M.desk(), 0.38, 0.38, 0.04, u, v, 0.4);
  put(M.desk(), 0.04, 0.38, 0.32, u + (faceBack ? 0.19 : -0.19), v, 0.46);
  put(M.metal(), 0.3, 0.3, 0.4, u, v, 0);
}
// 前面牆：黑板 + 86 吋電視
function frontWall(put, fr, { board = true, tv = true } = {}) {
  const W = fr.W;
  // 黑板置中；86 吋電視掛在黑板正中間（學校實際配置），兩側露出黑板
  if (board) {
    const bw = Math.min(5.2, W * 0.75);
    put(M.frame(), 0.05, bw + 0.16, 1.36, 0.025, 0, 0.82);
    put(blackboardMat(), 0.06, bw, 1.2, 0.04, 0, 0.9, true);
    put(M.frame(), 0.12, bw, 0.04, 0.08, 0, 0.86);       // 粉筆槽
  }
  if (tv) {
    const tv86 = [1.9, 1.07];                            // 86 吋：約 190 × 107 公分
    const tu = board ? 0.1 : 0.035;                      // 在黑板前面一點
    put(M.dark(), 0.07, tv86[0] + 0.06, tv86[1] + 0.06, tu, 0, 0.97);
    put(tvMat(), 0.08, tv86[0], tv86[1], tu + 0.015, 0, 1.0, true);
  }
}
function teacherDesk(put, u, v) {
  put(M.wood(), 0.65, 1.3, 0.78, u, v, 0);
  put(M.dark(), 0.05, 0.4, 0.28, u - 0.1, v + 0.3, 0.78);   // 電腦螢幕
}
function lockers(put, fr) {
  const W = fr.W - 0.4, u = fr.L - 0.21;
  put(M.wood(), 0.4, W, 1.1, u, 0, 0);
  const n = Math.max(2, Math.floor(W / 0.46)), cell = W / n;
  const cols = ['#f4d6a0', '#cfe6f7', '#f7d0d8', '#d6efc9'];
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
    put(mat('wool', cols[(i + r) % cols.length]), 0.02, cell - 0.06, 0.46, u - 0.21, -W / 2 + cell * (i + 0.5), 0.07 + r * 0.52);
  }
  put(corkMat(), 0.03, Math.min(4.5, fr.W - 1), 0.95, fr.L - 0.015, 0, 1.45, true);   // 布告欄
}

/* ---------- 各種教室 ---------- */

function classroom(put, fr) {
  frontWall(put, fr);
  teacherDesk(put, 1.25, fr.away * (fr.W / 2 - 1.0));
  const rows = Math.max(2, Math.floor((fr.L - 1.7 - 2.3) / 1.15) + 1);
  const cols = fr.W > 6.5 ? 6 : 5;
  const span = fr.W - 1.4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    deskAndChair(put, 2.3 + r * 1.15, -span / 2 + (span * c) / (cols - 1));
  }
  lockers(put, fr);
}

function groupTables(put, fr, startU = 2.3) {
  const cols = fr.W > 6 ? 3 : 2, rows = Math.max(1, Math.floor((fr.L - startU - 1.2) / 2.3));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const u = startU + 0.9 + r * 2.3, v = -fr.W / 2 + (fr.W * (c + 0.5)) / cols;
    put(M.desk(), 1.1, 1.1, 0.05, u, v, 0.68);
    put(M.metal(), 0.9, 0.9, 0.68, u, v, 0);
    chairAt(put, u - 0.8, v, false); chairAt(put, u + 0.8, v, true);
    chairAt(put, u, v - 0.8); chairAt(put, u, v + 0.8);
  }
}

function musicRoom(put, fr) {
  frontWall(put, fr);
  // 直立式鋼琴 + 琴椅（放在不靠門的那一側）
  const pv = fr.away * (fr.W / 2 - 1.1);
  put(M.dark(), 0.6, 1.5, 1.25, 1.0, pv, 0);
  put(M.white(), 0.25, 1.4, 0.05, 1.38, pv, 0.72);           // 白鍵
  put(M.dark(), 0.12, 1.4, 0.03, 1.4, pv, 0.77);             // 黑鍵
  put(M.dark(), 0.35, 0.9, 0.45, 1.85, pv, 0);               // 琴椅
  // 階梯座位：後半部三層，椅子放在台階上
  const start = fr.L * 0.42, step = (fr.L - start - 0.2) / 3;
  for (let k = 0; k < 3; k++) {
    const h = 0.2 * (k + 1), u0 = start + k * step;
    put(M.wood(), fr.L - 0.2 - u0, fr.W - 0.4, h, (u0 + fr.L - 0.2) / 2, 0, 0);
    const n = Math.floor((fr.W - 1) / 0.75);
    for (let i = 0; i < n; i++) {
      const v = -((n - 1) * 0.75) / 2 + i * 0.75, u = u0 + step * 0.45;
      put(M.red(), 0.38, 0.38, 0.06, u, v, h + 0.4);
      put(M.red(), 0.05, 0.38, 0.36, u + 0.19, v, h + 0.46);
      put(M.metal(), 0.3, 0.3, 0.4, u, v, h);
    }
  }
}

function computerRoom(put, fr) {
  frontWall(put, fr, { board: false, tv: true });
  teacherDesk(put, 1.2, fr.away * (fr.W / 2 - 1.0));
  const rows = Math.max(2, Math.floor((fr.L - 2.3) / 1.6));
  const seats = Math.max(3, Math.floor((fr.W - 1.0) / 0.85));
  for (let r = 0; r < rows; r++) {
    const u = 2.3 + r * 1.6;
    put(M.desk(), 0.7, fr.W - 1.0, 0.05, u, 0, 0.7);
    put(M.metal(), 0.6, fr.W - 1.1, 0.7, u, 0, 0);
    for (let i = 0; i < seats; i++) {
      const v = -(fr.W - 1.0) / 2 + (fr.W - 1.0) * (i + 0.5) / seats;
      put(M.dark(), 0.05, 0.52, 0.34, u - 0.18, v, 0.92);          // 螢幕
      put(screenMat(), 0.02, 0.48, 0.3, u - 0.205, v, 0.94);
      put(M.dark(), 0.12, 0.08, 0.18, u - 0.15, v, 0.75);          // 支架
      put(M.grey(), 0.16, 0.42, 0.02, u + 0.05, v, 0.75);          // 鍵盤
      chairAt(put, u + 0.6, v, true);
    }
  }
}

function library(put, fr) {
  const W = fr.W, L = fr.L;
  // 北面整排書櫃（門在南邊）
  for (let u = 0.6; u < L - 0.6; u += 1.0) put(booksMat(), 0.98, 0.4, 2.1, u, fr.away * (W / 2 - 0.2), 0);
  // 前段：一排排雙面書櫃
  for (let k = 0; k < 4; k++) put(booksMat(), 0.45, W * 0.5, 1.5, 1.6 + k * 1.7, -W * 0.05, 0);
  // 中段：閱讀桌
  for (let k = 0; k < 3; k++) {
    const u = 9.2 + k * 2.6;
    put(M.desk(), 1.6, 1.0, 0.05, u, 0.6, 0.7); put(M.metal(), 1.4, 0.8, 0.7, u, 0.6, 0);
    for (const dv of [-0.75, 1.95]) for (const du of [-0.45, 0.45]) chairAt(put, u + du, dv, true);
  }
  // 綠色葉子坐墊（照片裡的閱讀區）
  for (let k = 0; k < 6; k++) put(mat('wool', '#5fbf73'), 0.7, 0.55, 0.15, 17.2 + (k % 3) * 0.9, 0.2 + Math.floor(k / 3) * 0.9, 0);
  // 城堡閱讀角落：兩座塔（黃、粉紅）+ 城牆 + 城垛
  const cu = Math.min(L - 2.2, 21.5);
  for (const [dv, col] of [[-1.6, '#f4d35e'], [1.6, '#f5a6c3']]) {
    put(mat('wool', col), 1.3, 1.3, 2.5, cu, dv, 0);
    for (const [a, b] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) put(mat('wool', col), 0.35, 0.35, 0.3, cu + a, dv + b, 2.5);
  }
  put(mat('wool', '#f2efe6'), 0.4, 1.9, 2.0, cu + 0.45, 0, 0);
  for (let i = -2; i <= 2; i += 2) put(mat('wool', '#f2efe6'), 0.4, 0.3, 0.3, cu + 0.45, i * 0.35, 2.0);
  put(mat('wool', '#8bc6ec'), 0.05, 0.9, 1.3, cu + 0.22, 0, 0);       // 城門
  // 彩虹天花板
  const rb = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];
  rb.forEach((col, i) => put(mat('wool', col), 0.35, W - 0.4, 0.05, cu - 3 + i * 0.36, 0, 2.92));
}

function healthCenter(put, fr) {
  const W = fr.W, L = fr.L;
  // 後面兩張病床，中間拉簾
  const A = fr.away;
  for (const dv of [A * (W / 2 - 0.75), A * (W / 2 - 2.1)]) {
    put(M.metal(), 1.95, 0.95, 0.42, L - 1.15, dv, 0);
    put(M.white(), 1.9, 0.9, 0.14, L - 1.15, dv, 0.42);
    put(mat('wool', '#cfe8ff'), 0.4, 0.6, 0.1, L - 0.35, dv, 0.56);   // 枕頭
    put(mat('wool', '#9fd3c7'), 1.0, 0.85, 0.06, L - 1.5, dv, 0.56);  // 被子
  }
  put(mat('wool', '#b7e3d6'), 2.1, 0.03, 1.8, L - 1.15, A * (W / 2 - 1.43), 0);
  // 身高體重計
  const sv = -A * (W / 2 - 0.5), su = L * 0.5;
  put(M.white(), 0.45, 0.45, 0.08, su, sv, 0);
  put(M.grey(), 0.06, 0.06, 1.95, su + 0.2, sv, 0.08);
  put(M.dark(), 0.3, 0.06, 0.03, su + 0.07, sv, 1.6);
  put(M.dark(), 0.04, 0.2, 0.15, su + 0.17, sv, 1.1);
  // 護理師桌 + 藥櫃（紅十字）
  put(M.wood(), 0.7, 1.3, 0.75, 1.5, -0.4, 0); chairAt(put, 2.15, -0.4, true);
  put(M.white(), 0.45, 1.2, 1.8, 0.25, A * (W / 2 - 0.8), 0);
  put(M.red(), 0.02, 0.3, 0.1, 0.48, A * (W / 2 - 0.8), 1.45); put(M.red(), 0.02, 0.1, 0.3, 0.48, A * (W / 2 - 0.8), 1.35);
}

const gymCourtMat = () => once('gymcourt', () => new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, map: bigTex(1024, 560, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 7;
  c.strokeRect(10, 10, w - 20, h - 20);
  c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w / 2, h - 10); c.stroke();
  c.beginPath(); c.arc(w / 2, h / 2, 70, 0, Math.PI * 2); c.stroke();
  c.fillStyle = 'rgba(214,90,60,.55)';
  for (const side of [0, 1]) {
    const x0 = side ? w - 10 - 190 : 10;
    c.fillRect(x0, h / 2 - 80, 190, 160); c.strokeRect(x0, h / 2 - 80, 190, 160);
    c.beginPath(); c.arc(side ? w - 60 : 60, h / 2, 240, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2); c.stroke();
  }
}) }));

function gym(put, fr) {
  const W = fr.W, L = fr.L;   // 活動中心門在東西，u 是南北向；這裡改用 v（東西向）擺球場
  // 籃球場線（28 × 15 公尺）
  put(gymCourtMat(), Math.min(15, L - 2), Math.min(28, W - 12), 0.01, L / 2, -2.5, 0.015, true);
  // 舞台：東邊
  put(M.wood(), L - 0.4, 5, 1.0, L / 2, W / 2 - 2.6, 0);
  put(mat('wool', '#b3202a'), L - 0.6, 0.15, 3.6, L / 2, W / 2 - 0.2, 1.0);   // 紅色布幕（活動中心挑高兩層）
  put(mat('wool', '#8a1820'), L - 0.6, 0.3, 0.6, L / 2, W / 2 - 0.3, 4.4);
  // 兩個籃框（在球場兩端，標準高度 3.05 公尺）
  const half = Math.min(28, W - 12) / 2;
  for (const s of [-1, 1]) {
    const v = -2.5 + s * (half - 1.2);                                   // 籃板位置，柱子在場外
    put(M.grey(), 0.25, 0.25, 3.5, L / 2, v + s * 1.0, 0);               // 柱子
    put(M.grey(), 0.12, 1.0, 0.12, L / 2, v + s * 0.5, 3.35);            // 支架
    put(M.white(), 1.8, 0.06, 1.05, L / 2, v, 2.9);                      // 籃板
    put(mat('wool', '#e65100'), 0.45, 0.45, 0.03, L / 2, v - s * 0.28, 3.05);  // 籃框（朝球場）
  }
}

// 各處室的辦公桌組數（依學校實際）
const OFFICE_DESKS = [['教務處', 6], ['學務處', 6], ['輔導室', 6], ['總務處', 6], ['人事室', 2], ['會計室', 2]];

function deskSet(put, u, v) {
  put(M.desk(), 0.7, 1.3, 0.75, u, v, 0);
  put(M.dark(), 0.05, 0.5, 0.32, u - 0.2, v, 0.8); put(screenMat(), 0.02, 0.46, 0.28, u - 0.225, v, 0.82);
  put(M.grey(), 0.16, 0.42, 0.02, u + 0.05, v, 0.75);          // 鍵盤
  chairAt(put, u + 0.6, v, true);
}
function officeDesks(put, fr, count) {
  const W = fr.W, L = fr.L, usableL = L - 1.0;                  // 後面留給公文櫃
  let rows, cols;
  if (count) {
    rows = count <= 2 ? 1 : 2;
    cols = Math.ceil(count / rows);
    // 空間不夠排兩排就改一排
    if (rows === 2 && usableL < 3.8) { rows = 1; cols = count; }
  } else {
    rows = Math.max(1, Math.floor((usableL - 0.4) / 1.9)); cols = Math.max(1, Math.floor((W - 1.4) / 1.5));
  }
  let placed = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (count && placed >= count) return;
    const u = 1.2 + r * Math.min(1.9, (usableL - 1.2) / Math.max(1, rows - 0.5));
    const v = -(W - 1.2) / 2 + (W - 1.2) * (c + 0.5) / cols;
    deskSet(put, u, v);
    placed++;
  }
}
// 資訊室：前面兩組辦公桌，後半部是機房（伺服器機櫃、交換器），中間有玻璃隔間
const rackMat = () => once('rack', () => new THREE.MeshLambertMaterial({ emissive: '#0a1a10', emissiveIntensity: 0.5, map: bigTex(128, 256, (c, w, h) => {
  c.fillStyle = '#1b1f24'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    const y = 10 + i * 17;
    c.fillStyle = i % 4 === 0 ? '#3a4048' : '#2a2f36'; c.fillRect(10, y, w - 20, 13);
    const lights = ['#3dff6e', '#3dff6e', '#ffb02e', '#38b6ff'];
    for (let k = 0; k < 5; k++) { c.fillStyle = lights[(i + k) % lights.length]; c.fillRect(16 + k * 7, y + 5, 3, 3); }
    if (i % 3 === 1) { c.fillStyle = '#4b535c'; for (let k = 0; k < 12; k++) c.fillRect(56 + k * 5, y + 4, 3, 5); }   // 交換器網路孔
  }
}) }));
function infoRoom(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away;
  // 機房在 v 的一半（不靠門那側）
  const split = A * 0.3;
  put(mat('glass'), L - 0.4, 0.06, 2.4, L / 2, split, 0);                 // 玻璃隔間
  const nR = Math.max(2, Math.floor((L - 1.2) / 0.75));
  for (let i = 0; i < nR; i++) put(rackMat(), 0.65, 0.9, 2.0, 0.7 + i * 0.75, A * (W / 2 - 0.6), 0, true);   // 機櫃（含交換器）
  put(mat('wool', '#e9edf0'), 0.5, 0.5, 1.6, L - 0.4, A * (W / 2 - 2.0), 0);   // 冷氣（機房空調）
  // 前半：兩組辦公桌 + 電腦
  for (let k = 0; k < 2; k++) deskSet(put, 1.0 + k * (L > 4 ? 1.9 : 1.6), -A * (W / 4) );
  put(cabinetMat(), 0.45, 0.9, 1.8, L - 0.24, -A * (W / 2 - 1.0), 0, true);
}

function office(put, fr, name) {
  const W = fr.W, L = fr.L;
  if (name.includes('會議室')) {
    put(M.wood(), L * 0.6, Math.min(2.2, W * 0.4), 0.75, L / 2, 0, 0);
    const n = Math.floor((L * 0.6) / 0.8);
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) chairAt(put, L / 2 - (L * 0.6) / 2 + 0.4 + i * 0.8, s * (Math.min(2.2, W * 0.4) / 2 + 0.35));
    frontWall(put, fr, { board: false, tv: true });
    return;
  }
  if (name.includes('校長室')) {
    put(M.wood(), 0.9, 1.8, 0.78, 1.3, -W / 4, 0); chairAt(put, 0.6, -W / 4, false);
    put(mat('wool', '#7a4a2a'), 0.8, 2.2, 0.45, L - 1.0, W / 4, 0);   // 沙發
    put(mat('wool', '#7a4a2a'), 0.2, 2.2, 0.4, L - 0.5, W / 4, 0.45);
    put(M.desk(), 0.7, 1.2, 0.4, L - 2.1, W / 4, 0);                  // 茶几
  } else if (name.includes('資訊室')) {
    return infoRoom(put, fr);
  } else {
    // 辦公桌 + 電腦：處室 6 組、人事會計室 2 組，其他依空間大小
    const count = OFFICE_DESKS.find(([k]) => name.includes(k))?.[1];
    officeDesks(put, fr, count);
  }
  // 公文櫃：後面靠牆
  const n = Math.max(1, Math.floor((W - 1) / 0.95));
  for (let i = 0; i < n; i++) put(cabinetMat(), 0.45, 0.9, 1.8, L - 0.24, -(n - 1) * 0.95 / 2 + i * 0.95, 0, true);
}

function kinder(put, fr) {
  const cols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'];
  // 巧拼地墊
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) put(mat('wool', cols[(i + j) % 4]), 0.95, 0.95, 0.03, fr.L - 1.2 - i * 1.0, -1 + j * 1.0, 0);
  // 小圓桌（低）
  for (let k = 0; k < 3; k++) {
    const u = 1.6 + k * 1.8, v = -fr.W / 4;
    put(mat('wool', cols[k]), 1.0, 1.0, 0.05, u, v, 0.5); put(M.white(), 0.6, 0.6, 0.5, u, v, 0);
    for (const dv of [-0.7, 0.7]) put(mat('wool', cols[(k + 2) % 4]), 0.3, 0.3, 0.3, u, v + dv, 0);
  }
}

function danceRoom(put, fr) {
  const A = fr.away, v = A * (fr.W / 2 - 0.03);   // 不靠門那面牆：一整面鏡子 + 把桿
  put(mirrorMat(), fr.L - 1, 0.04, 2.0, fr.L / 2, v, 0.3, true);
  put(M.wood(), fr.L - 1, 0.05, 0.05, fr.L / 2, v - A * 0.25, 1.0);
  for (let u = 1; u < fr.L - 0.5; u += 2) put(M.grey(), 0.04, 0.25, 0.04, u, v - A * 0.13, 1.0);
}

function storage(put, fr) {
  for (let u = 0.6; u < fr.L - 0.4; u += 1.0) put(mat('wool', '#a8a8a0'), 0.95, 0.45, 2.0, u, fr.away * (fr.W / 2 - 0.25), 0);
  for (let i = 0; i < 4; i++) put(mat('planks', '#c8a070'), 0.5, 0.5, 0.5, 1 + i * 0.7, 0, 0);
}

/** 依名稱、種類挑布置 */
function furnishRoom(room, fr, put) {
  const n = room.name || '', t = room.type;
  if (room.hidden || room.open || t === 'wc' || t === 'garden') return;
  if (t === 'class') return classroom(put, fr);
  if (n.includes('圖書館')) return library(put, fr);
  if (n.includes('音樂')) return musicRoom(put, fr);
  if (n.includes('電腦')) return computerRoom(put, fr);   // 3F 電腦教室二之後依照片調整
  if (n.includes('健康中心')) return healthCenter(put, fr);
  if (n.includes('活動中心')) return gym(put, fr);
  if (n.includes('舞蹈') || n.includes('律動')) return danceRoom(put, fr);
  if (t === 'office') return office(put, fr, n);
  if (t === 'kinder') return kinder(put, fr);
  if (t === 'storage') return storage(put, fr);
  if (t === 'special' && n !== '桌球教室') { frontWall(put, fr); return groupTables(put, fr); }
}

/* ---------- 門牌 ---------- */

function signTexture(title, sub, kind) {
  return bigTex(512, 176, (c, w, h) => {
    const theme = {
      class: { bg: '#fffaf0', border: '#d32f2f', ink: '#1d2733', sub: '#d32f2f' },
      room: { bg: '#1e3a5f', border: '#c9a227', ink: '#ffffff', sub: '#ffd970' },
      wc: { bg: '#3b6e8f', border: '#ffffff', ink: '#ffffff', sub: '#dff' },
    }[kind];
    c.fillStyle = theme.border; c.fillRect(0, 0, w, h);
    c.fillStyle = theme.bg; c.fillRect(10, 10, w - 20, h - 20);
    c.fillStyle = theme.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    let fs = 78;
    c.font = `900 ${fs}px "Noto Sans TC", sans-serif`;
    while (c.measureText(title).width > w - 50 && fs > 30) { fs -= 4; c.font = `900 ${fs}px "Noto Sans TC", sans-serif`; }
    c.fillText(title, w / 2, sub ? 70 : h / 2);
    if (sub) { c.fillStyle = theme.sub; c.font = '700 40px "Noto Sans TC", sans-serif'; c.fillText(sub, w / 2, 136); }
  });
}

function addSign(room, f, group, wallT) {
  // 班牌掛在黑板那一端的門（前門）
  const door = flipped(room) ? room.doorPts?.at(-1) : room.doorPts?.[0];
  if (!door) return;
  let title, sub, kind;
  if (room.type === 'class') { title = room.display; sub = room.code; kind = 'class'; }
  else if (room.type === 'wc') { title = '🚻 廁所'; sub = ''; kind = 'wc'; }
  else { title = (room.name || '').replace(/（.*?）/g, ''); sub = room.no || ''; kind = 'room'; }
  if (!title) return;
  const face = new THREE.MeshLambertMaterial({ map: signTexture(title, sub, kind) });
  const edge = new THREE.MeshLambertMaterial({ color: kind === 'class' ? '#d32f2f' : '#c9a227' });
  const horizWall = door.side === 'N' || door.side === 'S';
  // 牌子和牆垂直，凸出到走廊；兩面都有字
  const geo = horizWall ? new THREE.BoxGeometry(0.05, 0.31, 0.9) : new THREE.BoxGeometry(0.9, 0.31, 0.05);
  const mats = horizWall ? [face, face, edge, edge, edge, edge] : [edge, edge, edge, edge, face, face];
  const sign = new THREE.Mesh(geo, mats);
  const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[door.side];
  const off = wallT / 2 + 0.5;
  sign.position.set(door.x + out[0] * off, f.y + 2.5, door.z + out[1] * off);
  sign.castShadow = true;
  group.add(sign);
  // 掛牌的鐵架
  const bar = new THREE.Mesh(new THREE.BoxGeometry(horizWall ? 0.03 : 0.95, 0.03, horizWall ? 0.95 : 0.03), new THREE.MeshLambertMaterial({ color: '#555' }));
  bar.position.set(door.x + out[0] * off, f.y + 2.68, door.z + out[1] * off);
  group.add(bar);
}

/** 幫一整層樓擺家具、掛門牌 */
export function furnishFloor(f, wallT) {
  const batch = new Batch();
  for (const room of f.rooms) {
    const fr = frameOf(room, wallT, flipped(room));
    furnishRoom(room, fr, placer(batch, fr, f.y));
  }
  const g = new THREE.Group();
  batch.build(g);
  for (const room of f.rooms) {
    if (room.hidden || room.open || room.type === 'garden' || room.type === 'hall') continue;
    addSign(room, f, g, wallT);
  }
  return g;
}
