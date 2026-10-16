import * as THREE from 'three';
import { Batch, mat, SPOTS } from './blocks.js?v=97';

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
const whiteboardMat = () => once('wb', () => new THREE.MeshLambertMaterial({ map: bigTex(640, 150, (c, w, h) => {
  c.fillStyle = '#f7f8f8'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(40,80,160,.55)'; c.lineWidth = 2;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(24, 30 + i * 18); c.lineTo(130 + Math.random() * 60, 30 + i * 18); c.stroke(); }
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(w - 200, 26 + i * 16); c.lineTo(w - 40 - Math.random() * 50, 26 + i * 16); c.stroke(); }
  c.fillStyle = '#f7a8c8'; c.fillRect(200, 12, 30, 40);
}) }));
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

// 班級教室的前後方向（依學校實際）：至善樓、思源樓前後對調，勤學樓維持原方向
const flipped = (room) => room.type === 'class' && room.building !== 'C';

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
  const toLocal = flip
    ? (x, z) => (alongX ? [m.x2 - inset - x, z - zc] : [m.z2 - inset - z, x - xc])
    : (x, z) => (alongX ? [x - m.x1 - inset, z - zc] : [z - m.z1 - inset, x - xc]);
  return { L, W, alongX, toWorld, toLocal, away: -doorSide };
}

function placer(batch, fr, y0) {
  // 以 (u, v) 為中心、底部在 y 的方塊
  const put = (material, du, dv, h, u, v, y = 0, plain = false) => {
    const [x, z] = fr.toWorld(u, v);
    const [w, d] = fr.alongX ? [du, dv] : [dv, du];
    (plain ? batch.plain : batch.box).call(batch, material, w, h, d, x, y0 + y + h / 2, z);
  };
  // 任意幾何（例如六角柱）：中心放在 (u, v)，y 是中心高度；rotY 是繞垂直軸旋轉
  put.geo = (material, geo, u, v, y, rotY = 0) => {
    const [x, z] = fr.toWorld(u, v);
    if (rotY) geo.rotateY(rotY);
    geo.translate(x, y0 + y, z);
    batch.add(material, geo);
  };
  // 登記互動設施：(u, v) 的世界座標；dv 是面向球場的方向（沿 v）
  put.spot = (data, u, v, y, dv = 0) => {
    const [x, z] = fr.toWorld(u, v), [x2, z2] = fr.toWorld(u, v + dv), d = Math.hypot(x2 - x, z2 - z) || 1;
    SPOTS.push({ ...data, x, y: y0 + y, z, fx: (x2 - x) / d, fz: (z2 - z) / d, floorY: y0 });
  };
  return put;
}

/* ---------- 各種家具 ---------- */

function deskAndChair(put, u, v, top = M.desk(), frame = M.metal(), seat = M.desk()) {
  put(top, 0.45, 0.6, 0.04, u, v, 0.68);                // 桌面
  put(frame, 0.4, 0.56, 0.16, u, v, 0.52);              // 抽屜
  put(frame, 0.04, 0.04, 0.52, u, v - 0.26, 0);         // 桌腳
  put(frame, 0.04, 0.04, 0.52, u, v + 0.26, 0);
  put(seat, 0.38, 0.38, 0.04, u + 0.45, v, 0.4);        // 椅面
  put(seat, 0.04, 0.38, 0.32, u + 0.64, v, 0.46);       // 椅背
  put(frame, 0.3, 0.04, 0.4, u + 0.45, v - 0.16, 0);
  put(frame, 0.3, 0.04, 0.4, u + 0.45, v + 0.16, 0);
}
function chairAt(put, u, v, faceBack = true) {
  put(M.desk(), 0.38, 0.38, 0.04, u, v, 0.4);
  put(M.desk(), 0.04, 0.38, 0.32, u + (faceBack ? 0.19 : -0.19), v, 0.46);
  put(M.metal(), 0.3, 0.3, 0.4, u, v, 0);
}
// 前面牆：黑板 + 86 吋電視
function frontWall(put, fr, { board = true, tv = true, white = false } = {}) {
  const W = fr.W;
  // 黑板置中；86 吋電視掛在黑板正中間（學校實際配置），兩側露出黑板
  if (board) {
    const bw = Math.min(5.2, W * 0.75);
    put(M.frame(), 0.05, bw + 0.16, 1.36, 0.025, 0, 0.82);
    put(white ? whiteboardMat() : blackboardMat(), 0.06, bw, 1.2, 0.04, 0, 0.9, true);
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

// 班級教室（依照片）：綠色桌面＋木頭課桌椅、黑板中間 86 吋電視、兩側布告欄
//   1～2 年級：白牆、後面黃色置物櫃
//   3～6 年級：淺藍色牆、後面木色格子櫃、窗邊書櫃與紅地毯閱讀角
function classroom(put, fr, room) {
  const grade = +(room?.code?.[0] || 3), low = grade <= 2;
  const W = fr.W, L = fr.L, A = fr.away;
  const senior = grade >= 5;
  if (!low && !senior) paintBands(put, fr, mat('wool', '#bcd9ee'));
  frontWall(put, fr);
  const bw = Math.min(5.2, W * 0.75);
  for (const s of [-1, 1]) put(corkMat(), 0.03, Math.min(1.0, (W - bw) / 2 - 0.2), 1.0, 0.03, s * (bw / 2 + 0.6), 1.0, true);
  teacherDesk(put, 1.25, A * (W / 2 - 1.0));
  const green = mat('wool', '#3f8f74'), wood = mat('planks', '#b98a5a');
  const rows = Math.max(2, Math.floor((L - 1.7 - 2.3) / 1.15) + 1);
  const cols = W > 6.5 ? 6 : 5;
  const span = W - 1.4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    deskAndChair(put, 2.3 + r * 1.15, -span / 2 + (span * c) / (cols - 1), green, wood, wood);
  }
  // 後面的櫃子
  const cw = W - 0.4, u = L - 0.21;
  if (low) {
    put(M.white(), 0.4, cw, 1.15, u, 0, 0);
    const n = Math.max(2, Math.floor(cw / 0.46)), cell = cw / n;
    for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
      put(mat('wool', (i + r) % 2 ? '#f2d35c' : '#f7e7a1'), 0.02, cell - 0.06, 0.48, u - 0.21, -cw / 2 + cell * (i + 0.5), 0.08 + r * 0.54);
    }
    put(corkMat(), 0.03, Math.min(4.5, W - 1), 0.95, L - 0.015, 0, 1.5, true);
  } else if (senior) {
    seniorBack(put, fr, room);                                              // 5～6 年級（依照片）
  } else {
    put(mat('planks', '#d6b98a'), 0.42, cw, 1.7, u, 0, 0);
    const n = Math.max(2, Math.floor(cw / 0.42)), cell = cw / n;
    for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) {
      put(mat('wool', (i + r) % 2 ? '#efe0c2' : '#e6d2ac'), 0.02, cell - 0.05, 0.48, u - 0.22, -cw / 2 + cell * (i + 0.5), 0.1 + r * 0.53);
    }
    put(corkMat(), 0.03, Math.min(3.0, W - 2), 0.7, L - 0.015, 0, 1.95, true);
    // 窗邊書櫃＋紅地毯閱讀角
    put(booksMat(), 1.6, 0.35, 1.2, L - 1.7, A * (W / 2 - 0.2), 0);
    put(mat('wool', '#c0392b'), 1.0, 1.6, 0.012, L - 0.95, A * (W / 2 - 1.1), 0);
  }
}

// 穿堂（依照片）：東端深色主題牆（山、月亮、星星、小門）＋兩側玻璃磚、背面是中庭「豐盈圓滿」壁畫（下面是生態池）
//                兩側海報牆＋長木椅、彩色木條天花板、棕米色格子地磚、電子看板
const darkThemeMat = () => once('darktheme', () => new THREE.MeshLambertMaterial({ map: bigTex(512, 440, (c, w, h) => {
  c.fillStyle = '#2b333b'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#20272e';
  c.beginPath(); c.moveTo(0, 300); c.lineTo(90, 230); c.lineTo(170, 280); c.lineTo(260, 210); c.lineTo(360, 270); c.lineTo(440, 220); c.lineTo(w, 260); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  c.fillStyle = '#f2d36b'; c.beginPath(); c.arc(410, 70, 22, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2b333b'; c.beginPath(); c.arc(420, 62, 20, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f2d36b';
  for (const [x, y] of [[80, 60], [150, 110], [300, 50], [350, 130], [470, 150]]) c.fillRect(x, y, 4, 4);
  // 中間的小門（米白色門框＋小窗）
  c.fillStyle = '#e9dfc6'; c.fillRect(220, 150, 80, 230);
  c.fillStyle = '#c4a46a'; c.fillRect(232, 165, 56, 200);
  c.fillStyle = '#9fc7e8'; c.fillRect(244, 178, 32, 32);
  c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '14px sans-serif'; c.fillText('Save the world, one book at a time', 310, 230);
}) }));
const glassBlockMat = () => once('glassblock', () => new THREE.MeshLambertMaterial({ emissive: '#9fd8d8', emissiveIntensity: 0.25, map: bigTex(160, 256, (c, w, h) => {
  c.fillStyle = '#e8f2f2'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 32) {
    const g = c.createLinearGradient(x, y, x + 30, y + 30);
    g.addColorStop(0, '#bfe3e3'); g.addColorStop(1, '#8fc7c9');
    c.fillStyle = g; c.fillRect(x + 2, y + 2, 28, 28);
  }
}) }));
const muralMat = () => once('mural', () => new THREE.MeshLambertMaterial({ map: bigTex(800, 360, (c, w, h) => {
  c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, w, h);
  // 彩色筆刷
  const strokes = ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#2e86de', '#8e44ad'];
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) { c.strokeStyle = strokes[i]; c.lineWidth = 14; c.beginPath(); c.moveTo(220 + i * 60, 300); c.bezierCurveTo(260 + i * 50, 120, 420 + i * 20, 80, 560, 160 + i * 12); c.stroke(); }
  // 跳舞的人
  for (const [x, col] of [[300, '#e74c3c'], [400, '#27ae60'], [500, '#2e86de']]) {
    c.fillStyle = col; c.beginPath(); c.arc(x, 110, 18, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 12;
    c.beginPath(); c.moveTo(x, 130); c.lineTo(x - 10, 230); c.lineTo(x - 40, 300); c.moveTo(x - 10, 230); c.lineTo(x + 30, 300); c.moveTo(x - 5, 160); c.lineTo(x - 55, 120); c.moveTo(x - 5, 160); c.lineTo(x + 50, 140); c.stroke();
  }
  c.fillStyle = '#d63031'; c.font = '900 52px "Noto Sans TC", sans-serif';
  c.textAlign = 'center'; c.fillText('豐盈圓滿', w / 2, 70);
}) }));
const posterWallMat = () => once('posterwall', () => new THREE.MeshLambertMaterial({ map: bigTex(800, 200, (c, w, h) => {
  c.fillStyle = '#b5895a'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 10) { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(x, 0, 2, h); }
  const cols = ['#ffe28a', '#ffb3b3', '#b3e0ff', '#c8f2b0', '#ffffff', '#f7c6ff'];
  for (let i = 0; i < 18; i++) {
    const x = 14 + (i % 9) * 88, y = i < 9 ? 14 : 106;
    c.fillStyle = cols[i % cols.length]; c.fillRect(x, y, 74, 80);
    c.fillStyle = ['#e74c3c', '#2e86de', '#27ae60', '#f39c12'][i % 4]; c.fillRect(x + 8, y + 8, 58, 12);
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) c.fillRect(x + 8, y + 28 + k * 11, 50 - (k % 2) * 14, 5);
  }
}) }));
const checkerMat = () => once('checker', () => {
  const t = bigTex(128, 128, (c) => {
    c.fillStyle = '#d7b58a'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#a8784e'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(0, 63, 128, 2); c.fillRect(63, 0, 2, 128);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 7);
  return new THREE.MeshLambertMaterial({ map: t });
});
function entranceHall(put, fr, room) {
  const W = fr.W, L = fr.L;              // u：南北向、v：東西向（v 越大越靠中庭）
  put(checkerMat(), L, W, 0.012, L / 2, 0, 0, true);
  // 東端主題牆（牆本身在 app.js 加，這裡貼兩面的畫）；牆往後退到走廊東邊時，畫和盆栽跟著退（ev 是牆的位置）
  const wallLen = L - 2.16, ev = W / 2 + ((room?.endWallM ?? room?.m.x2 ?? 0) - (room?.m.x2 ?? 0));
  put(darkThemeMat(), 3.4, 0.03, 2.9, L / 2, ev, 0, true);
  for (const s of [-1, 1]) put(glassBlockMat(), (wallLen - 3.4) / 2 - 0.05, 0.03, 2.5, L / 2 + s * ((wallLen - 3.4) / 4 + 1.7), ev, 0.25, true);
  put(muralMat(), wallLen, 0.03, 2.9, L / 2, ev + 0.335, 0, true);
  for (const s of [-1, 1]) put.geo(mat('wool', '#c0392b'), new THREE.CylinderGeometry(0.3, 0.25, 0.4, 12), L / 2 + s * 2.2, ev - 0.5, 0.2);   // 盆栽
  for (const s of [-1, 1]) put.geo(mat('leaves'), new THREE.SphereGeometry(0.45, 8, 6), L / 2 + s * 2.2, ev - 0.5, 0.75);
  // 兩側海報牆＋長木椅
  for (const u of [0.015, L - 0.015]) put(posterWallMat(), 0.03, 6.8, 1.7, u, 1.2, 0.85, true);
  for (const u of [0.4, L - 0.4]) { put(M.wood(), 0.4, 3.6, 0.08, u, 1.2, 0.4); put(M.wood(), 0.3, 3.4, 0.4, u, 1.2, 0); }
  // 彩色木條天花板
  const slats = ['#c0392b', '#e67e22', '#f1c40f', '#e8d5b0', '#16a085', '#2980b9', '#8e44ad', '#e8d5b0'];
  for (let i = 0; i * 0.62 < L - 0.3; i++) put(mat('planks', slats[i % slats.length]), 0.42, W - 0.6, 0.08, 0.4 + i * 0.62, 0, 2.86);
  // 電子看板
  put(M.dark(), 0.35, 0.8, 1.9, L - 0.6, W / 2 - 1.6, 0);
  put(screenMat(), 0.02, 0.7, 1.2, L - 0.78, W / 2 - 1.6, 0.6);
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

// 3F 電腦教室二（依照片）：六座彩色六角電腦島，每座底下一圈下凹圓形地板，紅棕色木地板，前面白板＋電視
function computerRoomHex(put, fr) {
  const W = fr.W, L = fr.L;
  put(mat('planks', '#b8664a'), L, W, 0.012, L / 2, 0, 0);                  // 紅棕色木地板
  frontWall(put, fr, { white: true });
  const colors = ['#7ac943', '#2f9fd8', '#f2a33a', '#b9a6e0', '#f5d82e', '#f26b3a'];
  const cols = 3, rows = 2, grey = mat('wool', '#9aa0a6');
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const col = colors[r * cols + c];
    const u = 2.6 + c * (L - 4.2) / (cols - 1), v = (r === 0 ? -1 : 1) * Math.min(1.8, W / 4);
    // 下凹圓形地板：外圈同色的邊、裡面深一點的木地板
    put.geo(mat('wool', col), new THREE.CylinderGeometry(1.45, 1.45, 0.02, 40), u, v, 0.022);
    put.geo(mat('planks', '#8f4a35'), new THREE.CylinderGeometry(1.3, 1.3, 0.02, 40), u, v, 0.026);
    // 中柱、灰色六角桌面、彩色六角頂板
    put.geo(M.metal(), new THREE.CylinderGeometry(0.1, 0.12, 1.25, 8), u, v, 0.63);
    put.geo(grey, new THREE.CylinderGeometry(1.05, 1.05, 0.05, 6), u, v, 0.76);
    put.geo(mat('wool', col), new THREE.CylinderGeometry(0.72, 0.72, 0.04, 6), u, v, 1.27);
    // 三台電腦朝外：螢幕、主機、鍵盤
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 + (r + c) * 0.5;
      const du = Math.cos(a), dv = Math.sin(a);
      // (u, v) 方向換成世界座標的旋轉角，讓螢幕面朝外
      const [wx, wz] = fr.alongX ? [du, dv] : [dv, du];
      const rot = Math.atan2(wx, wz);
      const at = (rad) => [u + du * rad, v + dv * rad];
      put.geo(M.dark(), new THREE.BoxGeometry(0.5, 0.33, 0.04), ...at(0.45), 0.97, rot);
      put.geo(screenMat(), new THREE.BoxGeometry(0.46, 0.29, 0.01), ...at(0.475), 0.97, rot);
      put.geo(M.dark(), new THREE.BoxGeometry(0.1, 0.18, 0.1), ...at(0.4), 0.87, rot);
      put.geo(M.grey(), new THREE.BoxGeometry(0.42, 0.02, 0.14), ...at(0.82), 0.79, rot);
      put.geo(M.dark(), new THREE.BoxGeometry(0.3, 0.08, 0.32), ...at(0.2), 0.83, rot + 0.5);
    }
  }
  // 後面的格子書櫃
  for (let i = 0; i < 3; i++) put(mat('wool', '#f1ebc8'), 0.35, 0.8, 1.1, L - 0.2, fr.away * (W / 2 - 0.6 - i * 0.85), 0);
}

// 2F 教師會辦公室（依照片）：兩張米白大理石長桌＋黑底花紋椅、後牆成果展示櫃、吧台與冰箱、花紋壁紙
const loungeChairMat = () => once('lchair', () => new THREE.MeshLambertMaterial({ map: (() => {
  const t = bigTex(128, 128, (c, w, h) => {
    c.fillStyle = '#1c1d22'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c9c9c9'; c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = 15 + (i * 37) % 110, y = 20 + (i * 53) % 100;
      c.beginPath(); c.ellipse(x, y, 14, 6, i, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(x - 10, y + 12); c.quadraticCurveTo(x, y, x + 12, y - 14); c.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})() }));
const wallpaperMat = () => once('wallpaper', () => new THREE.MeshLambertMaterial({ map: (() => {
  const t = bigTex(128, 128, (c, w, h) => {
    c.fillStyle = '#b89a6e'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(120,90,50,.45)';
    for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96]]) {
      for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(x, y, 16, 6, (k * Math.PI) / 3, 0, Math.PI * 2); c.fill(); }
    }
    c.fillStyle = 'rgba(255,240,210,.25)';
    for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2);
  return t;
})() }));
const displayWallMat = () => once('display', () => new THREE.MeshLambertMaterial({ emissive: '#3a2a10', emissiveIntensity: 0.35, map: bigTex(900, 300, (c, w, h) => {
  c.fillStyle = '#5a3e26'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 18) for (let y = 0; y < h; y += 18) {   // 馬賽克磚
    c.fillStyle = 'hsl(' + (30 + ((x * 7 + y * 3) % 30)) + ',30%,' + (28 + ((x + y) % 5) * 4) + '%)';
    c.fillRect(x + 1, y + 1, 16, 16);
  }
  c.fillStyle = 'rgba(255,255,255,.55)';
  for (const y of [120, 200, 268]) c.fillRect(30, y, w - 60, 4);     // 玻璃層板
  const cols = ['#fff', '#cfe8ff', '#ffe0a0', '#e0f0d0'];
  for (let i = 0; i < 22; i++) { c.fillStyle = cols[i % 4]; c.fillRect(60 + (i % 11) * 72, i < 11 ? 66 : 146, 46, 52); }   // 成果、海報
  for (let i = 0; i < 18; i++) { c.fillStyle = ['#d33', '#3a8', '#36c', '#eb3'][i % 4]; c.fillRect(70 + i * 44, 230, 26, 36); }  // 作品
  c.font = '900 40px "Noto Sans TC", sans-serif'; c.textBaseline = 'top';
  c.fillStyle = '#ffe14d'; c.fillText('解鎖', 60, 12); c.fillStyle = '#7fd4ff'; c.fillText('新溪望', 150, 12);
  c.fillStyle = '#9fe8ff'; c.fillText('航向幸福', w - 290, 12); c.fillStyle = '#ffd36b'; c.fillText('入口岸', w - 130, 12);
}) }));
// 花紋餐椅：faceU = ±1 面向 ±u；faceU = 0 時用 faceV 面向 ±v
function loungeChair(put, u, v, faceU, faceV = 0) {
  const m = loungeChairMat(), wood = mat('wool', '#3a2a22');
  put(wood, 0.42, 0.42, 0.44, u, v, 0);
  put(m, 0.44, 0.44, 0.08, u, v, 0.44);
  if (faceU) put(m, 0.06, 0.44, 0.55, u - faceU * 0.2, v, 0.52);
  else put(m, 0.44, 0.06, 0.55, u, v - faceV * 0.2, 0.52);
}
function teachersLounge(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;     // A：窗戶那一側；D：門那一側
  put(mat('tile', '#f6f4ef'), L, W, 0.012, L / 2, 0, 0);                    // 白色地磚
  // 牆面：前後牆花紋壁紙；窗戶那面下段木作腰板＋捲簾
  put(wallpaperMat(), 0.03, W - 0.1, 2.95, 0.02, 0, 0, true);
  put(wallpaperMat(), 0.03, W - 0.1, 2.95, L - 0.02, 0, 0, true);
  put(mat('planks', '#8a6040'), L - 0.2, 0.04, 1.0, L / 2, A * (W / 2 - 0.02), 0);
  put(mat('wool', '#e8dcc0', { transparent: true, opacity: 0.85 }), L - 0.4, 0.03, 1.2, L / 2, A * (W / 2 - 0.05), 1.0);
  // 後牆：成果展示櫃（燈光照亮的層架）
  const dispW = Math.min(5.5, W - 1.4);
  put(mat('planks', '#9a7048'), 0.45, dispW, 0.85, L - 0.3, 0, 0);
  put(displayWallMat(), 0.05, dispW, 1.6, L - 0.08, 0, 0.9, true);
  // 展示櫃前一排白色折疊桌＋椅子
  for (const dv of [-1.1, 1.1]) {
    put(M.white(), 0.5, 1.8, 0.04, L - 1.35, dv, 0.72);
    put(M.metal(), 0.4, 1.6, 0.72, L - 1.35, dv, 0);
    for (const k of [-0.6, 0, 0.6]) loungeChair(put, L - 0.85, dv + k, -1);
  }
  // 兩張米白大理石長桌，各 6 張花紋椅
  const u0 = L * 0.42;
  for (const dv of [-W * 0.22, W * 0.24]) {
    put(mat('wool', '#3a2a22'), 3.0, 1.0, 0.72, u0, dv, 0);
    put(mat('wool', '#f1e8d2'), 3.1, 1.1, 0.05, u0, dv, 0.72);
    for (const du of [-1.0, 0, 1.0]) { loungeChair(put, u0 + du, dv - 0.8, 0, 1); loungeChair(put, u0 + du, dv + 0.8, 0, -1); }
  }
  // 門那一側：吧台（上面放冰箱）、櫃子、紙箱
  put(mat('planks', '#9a7048'), 2.6, 0.5, 1.02, 1.6, D * (W / 2 - 0.4), 0);
  put(mat('wool', '#1b1b1b'), 2.6, 0.6, 0.06, 1.6, D * (W / 2 - 0.45), 1.02);
  put(mat('wool', '#b9bdc2'), 0.6, 0.55, 0.9, 0.6, D * (W / 2 - 0.45), 1.08);
  put(mat('planks', '#8a6040'), 1.6, 0.5, 1.2, 3.8, D * (W / 2 - 0.3), 0);
  put(mat('wool', '#e0c58a'), 0.6, 0.45, 0.35, 3.5, D * (W / 2 - 0.3), 1.2);
  // 電腦桌（在長桌前面、靠吧台那側）
  put(M.white(), 0.6, 1.2, 0.74, u0 - 2.2, D * (W / 2 - 1.5), 0);
  put(M.dark(), 0.05, 0.55, 0.36, u0 - 2.3, D * (W / 2 - 1.5), 0.78);
  put(screenMat(), 0.02, 0.5, 0.32, u0 - 2.275, D * (W / 2 - 1.5), 0.8);
}

// 1F 會議室（111，依照片）：U 型會議桌＋橘 / 黑網椅、前牆木作櫃與投影布幕、後牆校史牆、獎盃櫃、易拉展、玻璃展示櫃
const historyWallMat = () => once('history', () => new THREE.MeshLambertMaterial({ map: bigTex(1000, 260, (c, w, h) => {
  c.fillStyle = '#f4f6f2'; c.fillRect(0, 0, w, h);
  // 山與海
  c.fillStyle = '#9fd3e8'; c.beginPath(); c.moveTo(0, 170); c.bezierCurveTo(200, 120, 380, 210, 620, 150); c.lineTo(620, h); c.lineTo(0, h); c.fill();
  c.fillStyle = '#7cc38a'; c.beginPath(); c.moveTo(250, h); c.bezierCurveTo(380, 120, 500, 110, 640, 200); c.lineTo(700, h); c.fill();
  c.fillStyle = '#4f9f6a'; c.beginPath(); c.moveTo(420, h); c.quadraticCurveTo(520, 140, 650, h); c.fill();
  // 兩個 XIKOU 圓形圖案
  for (const x of [130, 300]) {
    c.fillStyle = '#4a5a8a'; c.beginPath(); c.arc(x, 105, 72, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 16; k++) { c.fillStyle = ['#e8584f', '#f2b134', '#5bb0e0', '#7cc38a'][k % 4]; c.beginPath(); c.arc(x + Math.cos(k / 16 * Math.PI * 2) * 52, 105 + Math.sin(k / 16 * Math.PI * 2) * 52, 12, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, 105, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2b3a6b'; c.font = '700 16px sans-serif'; c.textAlign = 'center'; c.fillText('XIKOU', x, 110);
  }
  // 校史文字
  c.fillStyle = '#2b3a6b'; c.font = '900 30px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.fillText('校　史', 820, 44);
  c.fillStyle = 'rgba(43,58,107,.55)';
  for (let i = 0; i < 9; i++) c.fillRect(660, 64 + i * 18, 300 - (i % 3) * 30, 6);
}) }));
const bannerMat = (seed) => once('banner' + seed, () => new THREE.MeshLambertMaterial({ map: bigTex(160, 400, (c, w, h) => {
  const bg = ['#f3eee2', '#2a1c14', '#e8f0ff'][seed % 3];
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.fillStyle = seed % 3 === 1 ? '#f2d27a' : '#c0392b';
  c.font = '900 34px "Noto Sans TC", sans-serif'; c.textAlign = 'center';
  c.fillText(['優質學校', '品德學校', '溪口國小'][seed % 3], w / 2, 60);
  const cols = ['#e67e22', '#3498db', '#27ae60', '#9b59b6'];
  for (let i = 0; i < 6; i++) { c.fillStyle = cols[(i + seed) % 4]; c.fillRect(14 + (i % 2) * 70, 100 + Math.floor(i / 2) * 80, 62, 66); }
}) }));
function officeChair(put, u, v, faceU, faceV, color, seatColor = '#202226') {
  const mesh = mat('wool', color), black = mat('wool', '#202226');
  put(black, 0.5, 0.5, 0.06, u, v, 0.05);                         // 星形腳座（簡化成底板）
  put(black, 0.06, 0.06, 0.4, u, v, 0.08);
  put(mat('wool', seatColor), 0.48, 0.48, 0.08, u, v, 0.46);      // 坐墊
  if (faceU) put(mesh, 0.06, 0.46, 0.5, u - faceU * 0.24, v, 0.54);
  else put(mesh, 0.46, 0.06, 0.5, u, v - faceV * 0.24, 0.54);
}
function meetingRoom(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const doorU = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]);
  put(mat('planks', '#a8988a'), L, W, 0.012, L / 2, 0, 0);                       // 木紋地板
  // 前牆：下櫃＋兩側玻璃櫃，中間黃色牆面，上方投影布幕
  put(mat('planks', '#e2d6c2'), 0.5, W - 0.4, 0.9, 0.27, 0, 0);
  for (const s of [-1, 1]) {
    put(mat('planks', '#e2d6c2'), 0.35, 2.2, 1.3, 0.2, s * (W / 2 - 1.4), 0.9);
    put(mat('glass'), 0.02, 2.0, 1.15, 0.385, s * (W / 2 - 1.4), 0.97);
    for (let k = 0; k < 6; k++) put(mat('wool', ['#4a8f5c', '#d9a31a', '#7a5232'][k % 3]), 0.2, 0.25, 0.3, 0.2, s * (W / 2 - 1.4) - 0.8 + k * 0.32, 1.0 + (k % 2) * 0.6);
  }
  put(mat('wool', '#f1d36b'), 0.03, 2.2, 1.3, 0.02, 0, 0.9);
  put(M.white(), 0.12, 3.2, 0.12, 0.1, 0, 2.75);                                 // 捲起來的投影布幕
  put(M.white(), 0.4, 0.35, 0.18, 4.0, 0, 2.8);                                  // 吊掛投影機
  // 推車上的大電視
  put(M.dark(), 0.6, 0.6, 0.08, 1.6, D * (W / 2 - 1.6), 0.05);
  put(M.grey(), 0.08, 0.08, 1.0, 1.6, D * (W / 2 - 1.6), 0.1);
  put(M.dark(), 0.08, 1.9, 1.1, 1.6, D * (W / 2 - 1.6), 1.0);
  put(screenMat(), 0.02, 1.8, 1.0, 1.65, D * (W / 2 - 1.6), 1.05);
  // U 型會議桌（開口朝前面布幕），桌邊與椅子
  const top = mat('wool', '#ece3d0'), base = mat('wool', '#5a3a2a');
  const uA = 2.6, uB = L - 2.2, half = Math.min(2.2, W / 2 - 1.4), tw = 0.9;   // 兩側留得出走道
  for (const s of [-1, 1]) {
    put(base, uB - uA, tw - 0.2, 0.72, (uA + uB) / 2, s * half, 0);
    put(top, uB - uA, tw, 0.05, (uA + uB) / 2, s * half, 0.72);
  }
  put(base, tw - 0.2, half * 2 + tw - 0.2, 0.72, uB + tw / 2 - 0.45, 0, 0);
  put(top, tw, half * 2 + tw, 0.05, uB + tw / 2 - 0.45, 0, 0.72);
  // 圓角（底部那兩個角用圓柱補）
  for (const s of [-1, 1]) put.geo(top, new THREE.CylinderGeometry(tw / 2, tw / 2, 0.05, 20), uB, s * half, 0.745);
  const chairCols = ['#e8732a', '#2b2d31'];
  let k = 0;
  // 椅子靠桌子收好，而且不算擋路：外側椅子和牆邊櫃子中間是走道，椅子擋住會卡住走不過去
  const keep = Batch.collector; Batch.collector = null;
  for (let u = uA + 0.4; u < uB - 0.2; u += 0.85) {
    for (const s of [-1, 1]) {
      officeChair(put, u, s * (half + tw / 2 + 0.25), 0, -s, chairCols[k++ % 2]);       // 外側
      officeChair(put, u, s * (half - tw / 2 - 0.35), 0, s, chairCols[k++ % 2]);        // 內側
    }
  }
  for (let v = -half + 0.4; v <= half - 0.4; v += 0.85) officeChair(put, uB + tw + 0.1, v, -1, 0, chairCols[k++ % 2]);
  Batch.collector = keep;
  // 後牆：校史牆
  put(historyWallMat(), 0.03, W - 0.6, 1.7, L - 0.02, 0, 0.85, true);
  // 窗邊：抽屜櫃
  for (let u = L * 0.45; u < L - 0.6; u += 0.9) if (doorU.every((d) => Math.abs(d - u) > 1.3)) put(mat('planks', '#b08a66'), 0.88, 0.45, 0.85, u, A * (W / 2 - 0.25), 0);
  // 門那一側：獎盃櫃＋易拉展＋玻璃展示櫃
  put(mat('planks', '#e2d6c2'), 3.0, 0.5, 0.9, 4.0, D * (W / 2 - 0.27), 0);
  for (let i = 0; i < 7; i++) {
    const u = 2.8 + i * 0.4, h = 0.35 + (i % 3) * 0.18, v = D * (W / 2 - 0.27);
    put(mat('wool', '#d4a017'), 0.12, 0.12, h, u, v, 0.9);
    put.geo(mat('wool', '#e6b422'), new THREE.CylinderGeometry(0.1, 0.05, 0.16, 10), u, v, 0.9 + h + 0.08);
  }
  for (let i = 0; i < 3; i++) put(bannerMat(i), 0.04, 0.8, 2.0, 6.2 + i * 0.95, D * (W / 2 - 0.3), 0.05, true);   // 易拉展貼著牆，才不會擋住走道
  put(mat('planks', '#d9cdb8'), 4.0, 0.45, 0.8, L - 3.0, D * (W / 2 - 0.25), 0);
  put(mat('glass'), 4.0, 0.45, 0.12, L - 3.0, D * (W / 2 - 0.25), 0.8);
  // 時鐘
  put.geo(M.white(), new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24).rotateX(Math.PI / 2), L - 0.05 - 0.6, A * (W / 2 - 0.05), 2.3, fr.alongX ? Math.PI / 2 : 0);
}

/* ---------- 中庭（依照片）：草地、幼兒園前的遊樂器材、兩棵南洋杉、樹籬、香蕉樹 ---------- */
export function decorateCourtyard(m, y0) {
  const b = new Batch();
  const at = (x, y, z) => [x, y0 + y, z];
  const box = (material, w, h, d, x, y, z) => b.box(material, w, h, d, ...at(x, y + h / 2, z));
  const geo = (material, g, x, y, z) => { g.translate(...at(x, y, z)); b.add(material, g); };
  const brown = mat('planks', '#9a5f3e'), post = mat('wool', '#3a2a22'), red = mat('wool', '#d81f26');
  const white = mat('wool', '#f1f1f1'), net = mat('wool', '#e9e9e9', { transparent: true, opacity: 0.55 });
  const zc = (m.z1 + m.z2) / 2, ex = m.x2 - 6;          // 遊樂器材中心（東端、幼兒園前）

  // 安全地墊
  box(mat('wool', '#3b3f45'), 10.5, 0.04, 15, ex, 0, zc);

  // 中央塔：四根柱子、平台、尖屋頂、前面攀岩牆
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(post, 0.18, 2.9, 0.18, ex + dx, 0, zc + dz);
  box(brown, 2.1, 0.12, 2.1, ex, 1.5, zc);
  box(brown, 2.1, 0.7, 0.08, ex, 1.6, zc - 1.0); box(brown, 2.1, 0.7, 0.08, ex, 1.6, zc + 1.0);
  geo(mat('planks', '#b7744f'), new THREE.ConeGeometry(1.75, 1.2, 4).rotateY(Math.PI / 4), ex, 3.5, zc);
  box(brown, 0.15, 1.5, 2.0, ex - 1.15, 0, zc);                                   // 攀岩牆
  const holds = ['#4fc3c7', '#e8e8e8', '#5ab35a', '#c79bd0'];
  for (let i = 0; i < 12; i++) box(mat('wool', holds[i % 4]), 0.08, 0.1, 0.12, ex - 1.25, 0.2 + Math.floor(i / 4) * 0.4, zc - 0.7 + (i % 4) * 0.47);

  // 兩側小塔（左邊平頂、右邊有遮簷）
  for (const s of [-1, 1]) {
    const tz = zc + s * 4.6;
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(post, 0.16, 2.6, 0.16, ex + dx, 0, tz + dz);
    box(brown, 1.5, 0.12, 1.5, ex, 1.2, tz);
    if (s < 0) { box(brown, 1.6, 0.12, 1.6, ex, 2.55, tz); box(white, 0.05, 1.2, 0.05, ex - 0.7, 1.3, tz - 0.4); box(white, 0.05, 1.2, 0.05, ex - 0.7, 1.3, tz + 0.4); }
    else box(brown, 0.08, 0.9, 1.5, ex + 0.75, 1.3, tz);
    // 網橋：平台、白色扶手、網子
    const bz = zc + s * 2.3;
    box(brown, 1.2, 0.08, 2.4, ex, 1.35, bz);
    for (const dx of [-0.6, 0.6]) { box(white, 0.05, 0.05, 2.4, ex + dx, 2.2, bz); box(net, 0.03, 0.8, 2.4, ex + dx, 1.42, bz); }
    // 紅色雙滑梯：從小塔往西滑下來
    const sl = new THREE.BoxGeometry(2.6, 0.08, 1.1); sl.rotateZ(0.42);
    geo(red, sl, ex - 1.9, 0.7, tz);
    for (const dz of [-0.55, 0, 0.55]) { const rail = new THREE.BoxGeometry(2.6, 0.22, 0.06); rail.rotateZ(0.42); geo(red, rail, ex - 1.9, 0.8, tz + dz); }
    box(red, 0.6, 0.12, 1.1, ex - 3.35, 0, tz);                                   // 滑梯出口
    SPOTS.push({ kind: 'slide', name: '紅色溜滑梯', floorY: y0, x: ex - 1.9, z: tz, r: 2.6,     // 可以溜：從小塔平台滑到西邊出口
      path: [[ex - 0.2, 1.32, tz], [ex - 0.71, 1.3, tz], [ex - 3.09, 0.22, tz], [ex - 3.9, 0, tz]].map(([x, y, z]) => [x, y0 + y, z]) });
  }
  // 藍色拱形攀爬架（北邊）
  for (let i = 0; i <= 10; i++) {
    const t = Math.PI * i / 10;
    box(mat('wool', '#2e6fd8'), 0.18, 0.12, 0.5, ex - 3.0 - Math.cos(t) * 0.9, Math.sin(t) * 0.9, zc - 6.6);
  }
  // 單槓（南邊）
  for (const dx of [-1.2, 1.2]) box(post, 0.12, 2.1, 0.12, ex + dx, 0, zc + 6.6);
  box(white, 2.5, 0.06, 0.06, ex, 2.1, zc + 6.6);
  for (let i = 0; i < 5; i++) box(white, 0.05, 0.05, 0.5, ex - 1 + i * 0.5, 2.1, zc + 6.6);

  // 兩棵高大的南洋杉（一層一層的枝葉）
  const pine = mat('leaves'), trunk = mat('log', '#ffffff');
  for (const s of [-1, 1]) {
    const px = m.x2 - 12.5, pz = zc + s * 8.5;
    box(trunk, 0.6, 15, 0.6, px, 0, pz);
    for (let k = 0; k < 8; k++) {
      const wdt = 5.2 - k * 0.55, y = 3.5 + k * 1.5;
      box(pine, wdt, 0.7, wdt * 0.35, px, y, pz);
      box(pine, wdt * 0.35, 0.7, wdt, px, y, pz);
    }
    box(pine, 0.8, 1.2, 0.8, px, 15.3, pz);
  }
  // 樹籬：南北兩側沿著建築
  const hedge = mat('leaves');
  box(hedge, m.x2 - m.x1 - 22, 1.0, 1.0, (m.x1 + m.x2) / 2 - 4, 0, m.z2 - 0.7);
  // 北邊（敬業樓前）：中間是會議室前小花台（field.js buildCourtyard），樹籬只留兩段
  for (const [a, c] of [[-14.9, -13.6], [1.2, 7.5]]) box(hedge, c - a, 1.0, 1.0, (a + c) / 2, 0, m.z1 + 0.7);
  // 香蕉樹（西北角）
  const bx = m.x1 + 2.2, bz = m.z1 + 2.2;
  box(mat('log', '#b9c27a'), 0.35, 2.6, 0.35, bx, 0, bz);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.BoxGeometry(2.2, 0.06, 0.6); leaf.translate(1.1, 0, 0); leaf.rotateZ(0.35); leaf.rotateY(i * Math.PI / 3);
    geo(mat('wool', '#5fae3a'), leaf, bx, 2.5, bz);
  }
  // 生態池（依照片：穿堂背面「豐盈圓滿」壁畫正下方）：石頭池邊、水面、睡蓮葉、水生植物、石頭
  const P = window.CAMPUS, pd = P.outdoor?.pond;
  if (pd) {
    const px = (v) => (v - P.ORIGIN[0]) / P.PX_PER_M, pz = (v) => (v - P.ORIGIN[1]) / P.PX_PER_M;
    const x1 = px(pd[0]), x2 = px(pd[2]), z1 = pz(pd[1]), z2 = pz(pd[3]);
    const cxp = (x1 + x2) / 2, czp = (z1 + z2) / 2, w = x2 - x1, d = z2 - z1, rim = 0.35;
    const stone = mat('brick', '#c9c4b8');
    box(stone, w, 0.45, rim, cxp, 0, z1 + rim / 2);
    box(stone, w, 0.45, rim, cxp, 0, z2 - rim / 2);
    box(stone, rim, 0.45, d - rim * 2, x1 + rim / 2, 0, czp);
    box(stone, rim, 0.45, d - rim * 2, x2 - rim / 2, 0, czp);
    box(mat('water', '#ffffff'), w - rim * 2, 0.3, d - rim * 2, cxp, 0, czp);           // 池水
    let s2 = 11;
    const rnd = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9; i++) {                                                      // 睡蓮葉
      const g = new THREE.CylinderGeometry(0.18 + rnd() * 0.12, 0.18, 0.02, 12);
      geo(mat('wool', '#4f9e3f'), g, x1 + rim + 0.3 + rnd() * (w - rim * 2 - 0.6), 0.32, z1 + rim + 0.3 + rnd() * (d - rim * 2 - 0.6));
    }
    for (let i = 0; i < 3; i++) box(mat('wool', '#f2a7c3'), 0.12, 0.1, 0.12, x1 + rim + 0.5 + i * 0.7, 0.33, czp + (i - 1) * 0.9);   // 睡蓮花
    for (const [fx, fz] of [[x1 + rim + 0.25, z1 + rim + 0.3], [x2 - rim - 0.3, z2 - rim - 0.35], [x1 + rim + 0.3, z2 - rim - 0.4]]) {   // 水生植物
      for (let k = 0; k < 5; k++) box(mat('wool', '#3f8f3a'), 0.05, 0.7 + k * 0.08, 0.05, fx + (k % 3) * 0.08, 0.3, fz + Math.floor(k / 3) * 0.08);
    }
    for (const [rx, rz, rs] of [[x2 - rim - 0.4, z1 + rim + 0.4, 0.35], [x2 - rim - 0.7, z1 + rim + 0.55, 0.25]]) box(mat('wool', '#9a9a95'), rs, rs * 0.7, rs, rx, 0.3, rz);   // 石頭
    // 池邊兩側的盆栽灌木
    for (const z of [z1 - 0.6, z2 + 0.6]) box(mat('leaves'), 0.9, 0.8, 0.9, x1 + 0.6, 0, z);
  }
  return b;
}

// 牆面塗裝：窗戶上下兩段（不擋窗），門那一側不貼（不擋門）
function paintBands(put, fr, material) {
  const W = fr.W, L = fr.L, A = fr.away;
  for (const [y0, h] of [[0, 1.0], [2.2, 0.78]]) {
    put(material, 0.02, W - 0.1, h, 0.012, 0, y0);
    put(material, 0.02, W - 0.1, h, L - 0.012, 0, y0);
    put(material, L - 0.1, 0.02, h, L / 2, A * (W / 2 - 0.012), y0);
  }
}
const ballMat = (c) => mat('wool', c);
function ball(put, u, v, y, r, color) { put.geo(ballMat(color), new THREE.SphereGeometry(r, 10, 8), u, v, y + r); }

// 1F 健康中心（依照片）：淺綠色牆、牙科診療椅、病床＋綠色隔簾、藍桌面＋木椅、身高體重計、紅色屏風、接待櫃台、白色櫃子
function healthCenter2(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  paintBands(put, fr, mat('wool', '#c9e6a4'));
  // 後面：兩張病床＋綠色隔簾與簾軌
  for (const dv of [A * (W / 2 - 0.75), A * (W / 2 - 2.15)]) {
    put(M.metal(), 1.95, 0.95, 0.42, L - 1.15, dv, 0);
    put(M.white(), 1.9, 0.9, 0.14, L - 1.15, dv, 0.42);
    put(mat('wool', '#cfe8ff'), 0.4, 0.6, 0.1, L - 0.35, dv, 0.56);
    put(mat('wool', '#7fc8a9'), 1.0, 0.85, 0.06, L - 1.5, dv, 0.56);
  }
  put(mat('wool', '#3f8f5f'), 2.2, 0.03, 1.9, L - 1.15, A * (W / 2 - 1.45), 0.1);
  put(mat('wool', '#3f8f5f'), 0.03, 2.9, 1.9, L - 2.3, A * (W / 2 - 1.45), 0.1);
  put(M.grey(), 2.3, 0.04, 0.04, L - 1.15, A * (W / 2 - 1.45), 2.05);
  // 牙科診療椅（藍色）＋燈臂
  const du0 = L - 3.4, dv0 = A * (W / 2 - 1.2);
  put(M.white(), 0.5, 0.5, 0.45, du0, dv0, 0);
  put(mat('wool', '#3a7bd5'), 1.4, 0.6, 0.15, du0, dv0, 0.45);
  put(mat('wool', '#3a7bd5'), 0.15, 0.6, 0.6, du0 + 0.75, dv0, 0.55);
  put(M.grey(), 0.06, 0.06, 1.5, du0 - 0.5, dv0 + 0.4, 0);
  put(M.white(), 0.5, 0.25, 0.12, du0 - 0.3, dv0 + 0.3, 1.5);
  // 藍桌面工作桌＋木椅
  for (const k of [0, 1]) {
    const u = 1.2 + k * 1.6, v = A * (W / 2 - 0.6);
    put(mat('wool', '#3a7bd5'), 1.2, 0.7, 0.05, u, v, 0.72); put(M.metal(), 1.1, 0.6, 0.72, u, v, 0);
    chairAt(put, u, v - A * 0.6);
  }
  // 身高體重計（磅秤式）
  const sv = D * (W / 2 - 0.6), su = L * 0.55;
  put(M.white(), 0.5, 0.5, 0.12, su, sv, 0);
  put(M.grey(), 0.08, 0.08, 1.8, su, sv, 0.12);
  put(M.dark(), 0.35, 0.05, 0.05, su - 0.15, sv, 1.15);
  put.geo(M.white(), new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20).rotateX(Math.PI / 2), su, sv - D * 0.05, 1.45);
  // 紅色可移動屏風
  put(M.metal(), 0.05, 0.05, 0.2, L * 0.42, 0, 0);
  put(mat('wool', '#b8433a'), 0.05, 1.3, 1.5, L * 0.42, 0, 0.25);
  // 接待櫃台（木紋＋白檯面）＋電腦＋辦公椅
  put(mat('planks', '#d8c4a0'), 0.6, 1.8, 0.95, 1.4, D * (W / 2 - 1.6), 0);
  put(M.white(), 0.7, 1.9, 0.04, 1.4, D * (W / 2 - 1.6), 0.95);
  put(M.dark(), 0.05, 0.5, 0.32, 1.25, D * (W / 2 - 1.6), 1.0); put(screenMat(), 0.02, 0.46, 0.28, 1.275, D * (W / 2 - 1.6), 1.02);
  chairAt(put, 0.7, D * (W / 2 - 1.6), false);
  // 白色高櫃、水槽檯面、藥櫃紅十字
  put(M.white(), 0.5, 1.8, 2.1, 0.27, A * (W / 2 - 1.0), 0);
  put(M.red(), 0.02, 0.3, 0.1, 0.53, A * (W / 2 - 1.0), 1.6); put(M.red(), 0.02, 0.1, 0.3, 0.53, A * (W / 2 - 1.0), 1.5);
  put(M.white(), 1.6, 0.55, 0.88, L - 3.0, D * (W / 2 - 0.3), 0);
}

// 1F 油印室（依照片）：大型油印機、鋪桌布的工作桌、辦公桌＋電腦＋鐵櫃、電風扇、紙箱
function mimeographRoom(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  // 油印機（窗邊）
  const mu = L / 2, mv = A * (W / 2 - 1.3);
  put(mat('wool', '#e9eaec'), 0.75, 1.15, 0.85, mu, mv, 0);
  put(mat('wool', '#7c8590'), 0.7, 0.5, 0.12, mu, mv - D * 0.25, 0.85);
  put(M.white(), 0.4, 0.35, 0.05, mu, mv + A * 0.45, 0.6);                 // 出紙盤
  put(mat('wool', '#35a0d8'), 0.05, 0.2, 0.08, mu - 0.39, mv, 0.75);      // 操作面板
  // 辦公桌＋電腦＋鐵製抽屜櫃（窗邊另一張）
  const ou = L / 2, ov = A * (W / 2 - 2.9);
  put(M.desk(), 0.75, 1.4, 0.75, ou, ov, 0);
  put(M.grey(), 0.6, 0.45, 0.7, ou, ov + D * 0.45, 0);
  put(M.dark(), 0.05, 0.5, 0.32, ou - 0.2, ov - A * 0.2, 0.8); put(screenMat(), 0.02, 0.46, 0.28, ou - 0.225, ov - A * 0.2, 0.82);
  chairAt(put, ou + 0.6, ov, true);
  // 鋪格紋桌布的長工作桌，上面有紙張與文具
  put(mat('wool', '#efe6c8'), 0.9, 2.4, 0.75, 0.75, 0.2, 0);
  for (let i = 0; i < 4; i++) put(M.white(), 0.3, 0.4, 0.06 + i * 0.03, 0.7, -0.6 + i * 0.5, 0.75);
  // 電風扇
  put(M.grey(), 0.35, 0.35, 0.05, L - 0.6, A * (W / 2 - 4.2), 0);
  put(M.grey(), 0.04, 0.04, 1.1, L - 0.6, A * (W / 2 - 4.2), 0.05);
  put.geo(M.white(), new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18).rotateZ(Math.PI / 2), L - 0.6, A * (W / 2 - 4.2), 1.25);
  // 紙箱（A4 影印紙）
  for (let i = 0; i < 5; i++) put(mat('wool', '#d8b77a'), 0.45, 0.32, 0.28, L - 0.35, D * (W / 2 - 0.4 - (i % 3) * 0.4), Math.floor(i / 3) * 0.28);
}

// 1F 體育器材室（依照片）：鐵架上滿滿的球與紙箱、藍色籃子裝球、交通錐、置物櫃
function sportsRoom(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const ballCols = ['#e8732a', '#d63a3a', '#f2c230', '#3a7bd5', '#ffffff', '#8b4a2b', '#3ba55c', '#e86ab0'];
  let k = 0;
  // 兩排鐵架（靠窗的牆＋中間）
  for (const rv of [A * (W / 2 - 0.35), A * (W / 2 - 2.2)]) {
    for (let u = 0.6; u < L - 0.4; u += 1.2) {
      for (const [du, dv] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]]) put(M.white(), 0.04, 0.04, 2.0, u + du, rv + dv, 0);
      for (const y of [0.15, 0.7, 1.25, 1.8]) {
        put(M.white(), 1.15, 0.55, 0.03, u, rv, y);
        if (y < 1.7) for (let i = 0; i < 4; i++) ball(put, u - 0.4 + i * 0.27, rv - 0.1 + (i % 2) * 0.2, y + 0.03, 0.11, ballCols[k++ % ballCols.length]);
        else put(mat('wool', '#d8b77a'), 0.6, 0.45, 0.35, u, rv, y + 0.03);   // 頂層紙箱
      }
    }
  }
  // 藍色籃子裝滿球
  for (let i = 0; i < 3; i++) {
    const u = 0.8 + i * 1.2, v = D * (W / 2 - 2.0);
    put(mat('wool', '#2e6fd8'), 0.8, 0.6, 0.45, u, v, 0);
    for (let j = 0; j < 4; j++) ball(put, u - 0.2 + (j % 2) * 0.4, v - 0.12 + Math.floor(j / 2) * 0.24, 0.35, 0.12, ballCols[(i * 3 + j) % ballCols.length]);
  }
  // 交通錐
  for (let i = 0; i < 4; i++) {
    put.geo(mat('wool', '#f26b1d'), new THREE.ConeGeometry(0.16, 0.5, 12), L - 0.5, D * (W / 2 - 0.5 - i * 0.4), 0.27);
    put.geo(M.white(), new THREE.CylinderGeometry(0.1, 0.12, 0.06, 12), L - 0.5, D * (W / 2 - 0.5 - i * 0.4), 0.3);
  }
  // 置物櫃（前牆）
  const n = Math.max(2, Math.floor((W - 1) / 0.5));
  for (let i = 0; i < n; i++) put(mat('wool', ['#f4ecd8', '#e6f3ee'][i % 2]), 0.45, 0.48, 1.9, 0.25, -(n - 1) * 0.25 + i * 0.5, 0);
}

// 木色高櫃：兩扇門、門縫、小把手（一個方塊貼一張）
const woodCabMat = () => once('woodcab', () => new THREE.MeshLambertMaterial({ map: bigTex(128, 256, (c, w, h) => {
  c.fillStyle = '#c0803f'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(120,70,30,.18)';
  for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 20 + Math.random() * 40);
  c.fillStyle = '#7a4a22'; c.fillRect(w / 2 - 1, 0, 2, h); c.fillRect(0, h * 0.62, w, 2); c.fillRect(0, 0, w, 3); c.fillRect(0, h - 3, w, 3);
  c.fillStyle = '#d9d9d9'; for (const x of [w / 2 - 10, w / 2 + 6]) { c.fillRect(x, h * 0.55, 4, 12); c.fillRect(x, h * 0.66, 4, 12); }
}) }));
// 1F 學務處（依兩張照片）：中間一區藍紫＋灰色雙色屏風的辦公座位（兩排背對背）、西邊紅木色船形會議桌＋6 張木椅、
//   東牆與南牆東段整排木色高櫃、北牆窗戶灰色捲簾、冰箱／碎紙機／白色抽屜櫃＋咖啡機、西牆白板行事曆＋冷氣、南牆白鐵門（通司令臺）＋玻璃門
function studentAffairs(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;          // A：南（操場那側）、D：北（走廊、窗戶那側）
  const lav = mat('wool', '#9aa6dc'), pgrey = mat('wool', '#bfc3c8'), alu = mat('wool', '#d9dcdf');
  const cab = woodCabMat(), black = mat('wool', '#202226');
  const doorU = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]);
  const free = (u, half) => doorU.every((d) => Math.abs(d - u) > half + 0.6);
  // 屏風：下段灰、上段藍紫，鋁框
  const panel = (du, dv, u, v) => {
    put(pgrey, du, dv, 0.65, u, v, 0);
    put(lav, du, dv, 0.6, u, v, 0.65);
    put(alu, Math.max(du, 0.06) + 0.01, Math.max(dv, 0.06) + 0.01, 0.04, u, v, 1.25);
  };
  // 中間辦公區：3 × 2 座位，兩排背對背
  const u0 = 3.0, u1 = Math.min(L - 1.1, 7.1), cw = (u1 - u0) / 3, vm = D * 0.9;
  panel(u1 - u0, 0.05, (u0 + u1) / 2, vm);                              // 中間隔板
  for (let i = 0; i <= 3; i++) panel(0.05, 1.7, u0 + i * cw, vm);        // 座位之間的側板
  for (const s of [-1, 1]) panel(u1 - u0, 0.05, (u0 + u1) / 2, vm + s * 0.85);   // 外側矮擋板（只擋桌子後面一半）
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const u = u0 + cw * (i + 0.5), v = vm + s * 0.42;
    put(mat('wool', '#d9d4c7'), cw - 0.1, 0.75, 0.74, u, v, 0);         // 桌子
    put(black, 0.5, 0.05, 0.34, u, v - s * 0.22, 0.76); put(screenMat(), 0.46, 0.02, 0.3, u, v - s * 0.2, 0.78);
    officeChair(put, u, v + s * 1.25, 0, -s, '#2b2d31');
  }
  // 西邊：紅木色船形會議桌＋木頭高背椅
  const tu = 1.75, tv = A * 1.3, top = mat('wool', '#8a4a32'), wood = mat('wool', '#5e2f1e');
  put(top, 1.9, 1.15, 0.05, tu, tv, 0.72);
  for (const s of [-1, 1]) put.geo(top, new THREE.CylinderGeometry(0.575, 0.575, 0.05, 20), tu + s * 0.95, tv, 0.745);
  for (const s of [-1, 1]) put(alu, 0.25, 0.4, 0.72, tu + s * 0.6, tv, 0);
  for (const du of [-0.7, 0, 0.7]) for (const s of [-1, 1]) {
    const cv = tv + s * 0.85;
    put(wood, 0.45, 0.45, 0.06, tu + du, cv, 0.44);
    put(wood, 0.45, 0.06, 0.65, tu + du, cv + s * 0.21, 0.5);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.05, 0.05, 0.44, tu + du + a * 0.19, cv + b * 0.19, 0);
  }
  // 東牆整排木色高櫃、南牆東段也是
  const nE = Math.max(3, Math.floor((W - 0.4) / 1.1));
  for (let i = 0; i < nE; i++) put(cab, 0.55, (W - 0.4) / nE - 0.02, 2.3, L - 0.3, -(W - 0.4) / 2 + ((W - 0.4) / nE) * (i + 0.5), 0, true);
  for (let u = 4.4; u < L - 1.0; u += 1.1) put(cab, 1.08, 0.55, 2.3, u, A * (W / 2 - 0.3), 0, true);
  // 南牆西段：白鐵門（直通司令臺，門開著靠在牆邊），旁邊是玻璃門
  const sd = (room?.doorPts || []).find((d) => d.side === 'S');
  if (sd) {
    const [du] = fr.toLocal(sd.x, sd.z), steel = mat('wool', '#c9cdd2');
    for (const s of [-1, 1]) put(steel, 0.06, 0.12, 2.25, du + s * 0.5, A * (W / 2 - 0.02), 0);   // 門框
    put(steel, 1.06, 0.12, 0.06, du, A * (W / 2 - 0.02), 2.22);
    put(steel, 0.05, 0.9, 2.1, du - 0.5, A * (W / 2 - 0.5), 0.03);                                // 打開的門片
  }
  put(alu, 1.5, 0.06, 2.3, 2.55, A * (W / 2 - 0.03), 0);
  put(mat('glass'), 1.3, 0.05, 2.1, 2.55, A * (W / 2 - 0.06), 0.1);
  // 北牆：窗戶上半的灰色捲簾
  for (let u = 3.2; u < L - 0.8; u += 1.3) put(mat('wool', '#c3c8cd'), 1.25, 0.04, 0.8, u, D * (W / 2 - 0.05), 2.0);
  // 北牆（兩個門之間）：白色抽屜櫃＋咖啡機、碎紙機、冰箱
  const nv = D * (W / 2 - 0.4);
  const fu = [[4.6, 3.9, 3.05], [0.45, 2.6, 2.6]].find((c) => c.every((u) => free(u, 0.4))) || [null, null, null];
  if (fu[0] !== null) { put(M.white(), 0.5, 0.55, 1.0, fu[0], nv, 0); put(black, 0.25, 0.25, 0.4, fu[0], nv, 1.0); }
  if (fu[1] !== null) put(mat('wool', '#e3e5e7'), 0.5, 0.45, 0.75, fu[1], nv, 0);
  if (fu[2] !== null) put(mat('wool', '#c9ccd1'), 0.7, 0.7, 1.75, fu[2], nv - D * 0.05, 0);
  // 西牆：白板行事曆＋下方矮書櫃＋上方冷氣
  put(M.frame(), 0.03, 2.5, 1.25, 0.02, A * 0.6, 1.0);
  put(whiteboardMat(), 0.04, 2.4, 1.15, 0.04, A * 0.6, 1.05, true);
  put(booksMat(), 0.35, 2.4, 0.9, 0.2, A * 0.6, 0, true);
  put(M.white(), 0.3, 1.0, 0.3, 0.17, A * 0.6, 2.5);
}

// 廁所入口（依照片）：門內一片黑色鐵格柵框＋木紋門板的拉門屏風、木紋磚腰牆、綠色植生牆
function restroom(put, fr, room) {
  const W = fr.W, L = fr.L;
  const wood = mat('planks', '#a8875f'), grass = mat('grass', '#ffffff'), iron = mat('wool', '#2b2b2b');
  // 牆面：下段木紋磚、上段綠色植生牆（窗戶上下兩段）
  paintBands(put, fr, wood);
  const upper = room.screen === false ? mat('wool', '#eadfc8') : grass;   // 勤學樓性別友善廁所：上段米色磁磚
  put(upper, 0.03, W - 0.2, 0.75, 0.03, 0, 2.2);
  put(upper, 0.03, W - 0.2, 0.75, L - 0.03, 0, 2.2);
  // 門內的屏風（每個門一片）
  for (const d of room.screen === false ? [] : room.doorPts || []) {
    const [u, v] = fr.toLocal(d.x, d.z), inward = -Math.sign(v) || 1, sv = v + inward * 0.9;
    const w = 1.5;
    put(iron, w, 0.05, 0.06, u, sv, 2.24);  put(iron, w, 0.05, 0.06, u, sv, 0.02);       // 上下框
    put(iron, 0.06, 0.05, 2.28, u - w / 2, sv, 0); put(iron, 0.06, 0.05, 2.28, u + w / 2, sv, 0);
    for (let i = 1; i < 6; i++) { put(iron, w, 0.04, 0.04, u, sv, 1.85 + i * 0.07); put(iron, w, 0.04, 0.04, u, sv, 0.05 + i * 0.07); }   // 上下格柵
    for (const o of [-0.45, 0.45]) put(iron, 0.04, 0.04, 1.4, u + o, sv, 0.45);
    put(wood, 0.5, 0.03, 1.1, u, sv, 0.6);                                                // 中間木紋門板
    put(iron, w + 0.6, 0.06, 0.06, u, sv, 2.35);                                          // 上方滑軌
  }
  // 洗手台與隔間（遠離門的那一側）
  const far = -Math.sign(fr.toLocal(room.doorPts?.[0]?.x ?? 0, room.doorPts?.[0]?.z ?? 0)[1] || -1);
  const n = Math.max(1, Math.floor((L - 2.2) / 1.0));
  for (let i = 0; i < n; i++) {
    const u = 1.6 + i * 1.0;
    put(mat('wool', '#d9d4c8'), 0.05, 1.4, 2.0, u - 0.5, far * (W / 2 - 0.7), 0);       // 隔板
    put(mat('wool', '#b8a07a'), 0.9, 0.04, 1.8, u, far * (W / 2 - 1.4), 0.1);            // 隔間門
  }
  put(M.white(), 0.5, 1.6, 0.85, 0.3, 0, 0);                                             // 洗手台
  put(mat('glass'), 0.02, 1.4, 0.8, 0.02, 0, 1.15);                                     // 鏡子
}

// 1F 白雲班和甲梯中間的廁所（依照片）：牆面整片淺色木紋磚、深灰地磚、輕鋼架天花板＋方形 LED 燈；
//   進門正對一座木紋磚矮牆（中島），前面是白色長條洗手槽、5 個水龍頭，兩端擺洗手乳；矮牆上貼兩張洗手海報、放抽取式衛生紙；
//   兩側牆上有白底橘色的緊急求救鈴；矮牆後面是廁所隔間（白色門板）
// 淺色木紋磚（每塊約 60×20 公分，錯縫貼；貼圖 1 公尺一張、重複貼）
const woodTileMat = () => once('woodtile', () => {
  const t = bigTex(256, 256, (c, w, h) => {
    let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < 5; r++) for (let k = -1; k < 2; k++) {
      const x0 = k * 154 + (r % 2) * 77, y0 = r * 51.2, tone = 205 + rnd() * 25;
      c.fillStyle = `rgb(${tone + 25},${tone + 5},${tone - 30})`; c.fillRect(x0, y0, 154, 51.2);
      for (let i = 0; i < 9; i++) {                                     // 木紋：細細的深色長條
        c.fillStyle = `rgba(150,105,60,${0.08 + rnd() * 0.14})`;
        c.fillRect(x0 + rnd() * 40, y0 + 3 + rnd() * 45, 60 + rnd() * 90, 1 + rnd() * 2);
      }
      c.fillStyle = 'rgba(120,95,70,.45)'; c.fillRect(x0, y0, 154, 1.5); c.fillRect(x0, y0, 1.5, 51.2);   // 磚縫
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshLambertMaterial({ map: t });
});
function restroomWash(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const wood = woodTileMat(), white = M.white(), chrome = mat('wool', '#c9ccd0');
  put(mat('tile', '#7d8186'), L, W, 0.012, L / 2, 0, 0);                         // 深灰地磚
  // 牆面木紋磚：兩端整面、裡面那面（窗戶上下）
  for (const u of [0.012, L - 0.012]) put(wood, 0.02, W - 0.1, 2.95, u, 0, 0);
  for (const [y0, h] of [[0, 1.0], [2.2, 0.75]]) put(wood, L - 0.1, 0.02, h, L / 2, A * (W / 2 - 0.012), y0);
  // 天花板：方形 LED 燈
  const led = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#fffbe8', emissiveIntensity: 0.8 });
  for (let u = 1.2; u < L - 0.5; u += 2.0) for (const v of [-W / 4, W / 4]) put(led, 0.6, 0.6, 0.02, u, v, 2.93);
  // 中島：木紋磚矮牆，洗手槽朝門那側
  const IL = Math.min(3.6, L - 3), iv = D * 0.2, face = iv + D * 0.13;
  put(wood, IL, 0.26, 1.25, L / 2, iv, 0);
  put(white, IL + 0.04, 0.3, 0.03, L / 2, iv, 1.25);                              // 白色檯面
  put(wood, IL - 0.3, 0.42, 0.55, L / 2, face + D * 0.21, 0);                      // 洗手槽底座
  put(white, IL + 0.2, 0.5, 0.06, L / 2, face + D * 0.25, 0.55);                   // 洗手槽：槽底
  put(white, IL + 0.2, 0.05, 0.25, L / 2, face + D * 0.48, 0.55);                  //         前緣
  for (const s of [-1, 1]) put(white, 0.05, 0.5, 0.25, L / 2 + s * (IL / 2 + 0.08), face + D * 0.25, 0.55);
  put(white, IL + 0.2, 0.05, 0.42, L / 2, face + D * 0.02, 0.55);                  //         後面的白色擋水板
  for (let i = 0; i < 5; i++) {                                                  // 5 個水龍頭
    const u = L / 2 + (i - 2) * (IL / 5.5);
    put(chrome, 0.04, 0.12, 0.04, u, face + D * 0.06, 0.92); put(chrome, 0.04, 0.04, 0.1, u, face + D * 0.12, 0.84);
  }
  for (const s of [-1, 1]) {                                                     // 兩端：洗手乳、衛生紙；檯面上的抽取式衛生紙
    put(mat('glass'), 0.08, 0.08, 0.18, L / 2 + s * (IL / 2 - 0.05), face + D * 0.3, 0.61);
    put(white, 0.22, 0.12, 0.08, L / 2 + s * (IL / 2 - 0.2), iv, 1.28);
  }
  for (const [du, col] of [[-0.85, '#bfe3f2'], [0.85, '#d6ecf7']]) {               // 兩張洗手海報
    put(mat('wool', col), 0.32, 0.01, 0.42, L / 2 + du, face + D * 0.005, 0.9);
    put(mat('wool', '#3a8fc0'), 0.26, 0.012, 0.06, L / 2 + du, face + D * 0.006, 1.24);
  }
  // 兩端牆上的緊急求救鈴（白底橘色按鈕）
  for (const [u, s] of [[0.03, 1], [L - 0.03, -1]]) { put(white, 0.02, 0.1, 0.14, u, D * 0.6, 1.2); put(mat('wool', '#f08a24'), 0.025, 0.05, 0.05, u + s * 0.01, D * 0.6, 1.24); }
  // 矮牆後面：廁所隔間（白色門板、灰色隔板）
  const n = Math.max(2, Math.floor((L - 1.6) / 1.1));
  for (let i = 0; i < n; i++) {
    const u = (L - n * 1.1) / 2 + (i + 0.5) * 1.1;
    put(mat('wool', '#d9d4c8'), 0.05, 1.5, 2.1, u - 0.55, A * (W / 2 - 0.75), 0);
    put(mat('wool', '#ece8df'), 0.95, 0.04, 2.0, u, A * (W / 2 - 1.5), 0.08);
  }
  put(mat('wool', '#d9d4c8'), 0.05, 1.5, 2.1, (L + n * 1.1) / 2, A * (W / 2 - 0.75), 0);
}

// 1F 電腦教室一（依照片）：兩座長條雙面電腦島（木桌面、深色桌腳、螢幕背對背、白色折疊椅），
//   前面白板＋教師桌＋投影機、後面綠色布告欄貼滿電腦課海報、門側玻璃書櫃、白色地磚
const pcPosterMat = () => once('pcposter', () => new THREE.MeshLambertMaterial({ map: bigTex(900, 210, (c, w, h) => {
  c.fillStyle = '#2f6b4f'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#d9d9d9'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  const cols = ['#cfe8ff', '#d8f5c8', '#fff3b0', '#ffd6cc', '#e8dcff', '#ffffff'];
  const titles = ['電腦主機構造', '電腦周邊設備', '網路安全', '電腦教室規則', '資訊倫理', '電腦配備'];
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 97, y = 22 + (i % 2) * 14;
    c.fillStyle = cols[i % cols.length]; c.fillRect(x, y, 82, 150);
    c.fillStyle = '#c0392b'; c.font = '700 13px "Noto Sans TC", sans-serif'; c.fillText(titles[i % titles.length], x + 4, y + 18);
    c.fillStyle = ['#3498db', '#27ae60', '#e67e22'][i % 3]; c.fillRect(x + 8, y + 30, 66, 60);
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) c.fillRect(x + 8, y + 100 + k * 11, 60 - (k % 2) * 16, 5);
  }
}) }));
function foldingChair(put, u, v, faceV) {
  const white = mat('wool', '#ececea'), grey = mat('wool', '#b9bcc0');
  put(white, 0.4, 0.4, 0.04, u, v, 0.45);
  put(white, 0.38, 0.04, 0.32, u, v + faceV * 0.2, 0.55);
  for (const du of [-0.17, 0.17]) put(grey, 0.03, 0.03, 0.45, u + du, v - faceV * 0.15, 0), put(grey, 0.03, 0.03, 0.85, u + du, v + faceV * 0.18, 0);
}
function computerRoom1(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  put(mat('tile', '#f3f3f0'), L, W, 0.012, L / 2, 0, 0);                      // 白色地磚
  // 前面：白板、捲起來的投影布幕、吊掛投影機
  put(M.frame(), 0.05, 4.2, 1.3, 0.025, 0, 0.85);
  put(whiteboardMat(), 0.06, 4.0, 1.15, 0.04, 0, 0.92, true);
  put(M.white(), 0.1, 3.0, 0.12, 0.1, 0, 2.72);
  put(M.white(), 0.35, 0.3, 0.15, 3.2, 0, 2.75);
  // 教師桌（兩台螢幕）
  const tv = D * (W / 2 - 1.5);
  put(mat('wool', '#3a3d42'), 0.75, 2.0, 0.75, 1.1, tv, 0);
  for (const o of [-0.45, 0.45]) { put(M.dark(), 0.04, 0.55, 0.34, 0.95, tv + o, 0.8); put(screenMat(), 0.01, 0.5, 0.3, 0.97, tv + o, 0.82); }
  chairAt(put, 1.75, tv, true);
  // 兩座長條雙面電腦島
  const u1 = 2.2, u2 = L - 1.5, top = mat('wool', '#d9a86c'), base = mat('wool', '#4a4d52');
  for (const s of [-1, 1]) {
    const vc = s * 1.75;
    put(base, u2 - u1 - 0.2, 1.2, 0.72, (u1 + u2) / 2, vc, 0);
    put(top, u2 - u1, 1.5, 0.05, (u1 + u2) / 2, vc, 0.72);
    for (let u = u1 + 0.45; u < u2 - 0.2; u += 0.78) {
      for (const r of [-1, 1]) {                       // r：這一排面向哪一側
        put(M.dark(), 0.5, 0.04, 0.33, u, vc + r * 0.2, 0.8);
        put(screenMat(), 0.46, 0.01, 0.29, u, vc + r * 0.225, 0.82);
        put(M.dark(), 0.12, 0.12, 0.06, u, vc + r * 0.15, 0.77);
        put(M.dark(), 0.42, 0.14, 0.02, u, vc + r * 0.5, 0.77);    // 鍵盤
        put(M.dark(), 0.06, 0.1, 0.03, u + 0.3, vc + r * 0.5, 0.77);   // 滑鼠
        foldingChair(put, u, vc + r * 1.12, r);
      }
    }
  }
  // 後面：綠色布告欄貼滿電腦課海報，下面兩個紙箱
  put(pcPosterMat(), 0.03, Math.min(6.4, W - 1.2), 1.5, L - 0.015, 0, 0.9, true);
  for (const o of [-0.35, 0.35]) put(mat('wool', '#d8b77a'), 0.5, 0.6, 0.55, L - 0.4, o, 0);
  // 門那一側：玻璃門書櫃（上面堆紙箱）
  for (let i = 0; i < 4; i++) {
    const u = 2.6 + i * 0.95, v = D * (W / 2 - 0.22);
    put(mat('planks', '#b5773f'), 0.92, 0.42, 1.9, u, v, 0);
    put(booksMat(), 0.86, 0.02, 1.5, u, v - D * 0.215, 0.2);
    put(mat('glass'), 0.86, 0.02, 1.6, u, v - D * 0.23, 0.15);
    put(mat('wool', '#d8b77a'), 0.6, 0.4, 0.35, u, v, 1.9);
  }
  // 窗邊冷氣
  for (const u of [2.5, L - 2.5]) put(M.white(), 0.9, 0.25, 0.3, u, A * (W / 2 - 0.15), 2.4);
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
    put.spot({ kind: 'hoop' }, L / 2, v - s * 0.28, 3.05, -s);                  // 可以投籃
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
  const W = fr.W, L = fr.L, A = -fr.away;
  // 機房在 v 的一半（依使用者更正：和辦公區對調，機房在靠南那側）
  const split = A * 0.3;
  put(mat('glass'), L - 0.4, 0.06, 2.4, L / 2, split, 0);                 // 玻璃隔間
  const nR = Math.max(2, Math.floor((L - 1.2) / 0.75));
  for (let i = 0; i < nR; i++) put(rackMat(), 0.65, 0.9, 2.0, 0.7 + i * 0.75, A * (W / 2 - 0.6), 0, true);   // 機櫃（含交換器）
  put(mat('wool', '#e9edf0'), 0.5, 0.5, 1.6, L - 0.4, A * (W / 2 - 2.0), 0);   // 冷氣（機房空調）
  // 前半：兩組辦公桌 + 電腦
  for (let k = 0; k < 2; k++) deskSet(put, 1.0 + k * (L > 4 ? 1.9 : 1.6), -A * (W / 4) );
  put(cabinetMat(), 0.45, 0.9, 1.8, L - 0.24, -A * (W / 2 - 1.0), 0, true);
}

// 1F 校長室（依照片）：木紋地板、東牆大電視＋玻璃門矮櫃、北牆咖啡機／飲水機、淺木色會議桌＋灰色網椅、
//   米色沙發＋蕾絲桌巾茶几、玻璃獎盃櫃
function principalOffice(put0, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  // 依使用者更正：整間左右鏡射（u → L - u）
  const put = (m, du, dv, h, u, v, y, plain) => put0(m, du, dv, h, L - u, v, y, plain);
  put.geo = (m, g, u, v, y, r) => put0.geo(m, g, L - u, v, y, r);
  const wood = mat('planks', '#b5773f'), pale = mat('planks', '#b8aa98'), orange = mat('wool', '#e8825f');
  const grey = mat('wool', '#8a8f94'), beige = mat('wool', '#e8dcc6'), black = mat('wool', '#202226');
  // 門在 v 方向哪個 u 附近，家具要避開
  const doorU = (room.doorPts || []).map((d) => L - fr.toLocal(d.x, d.z)[0]);
  const clear = (u, half) => doorU.every((d) => Math.abs(d - u) > half + 0.5);
  const split = 0;
  // 地板：東半木紋
  put(mat('planks', '#8c735a'), L - split, W, 0.012, (split + L) / 2, 0, 0);

  /* ---- 東半：接待／會議區 ---- */
  // 東牆：大電視＋下方玻璃門矮櫃
  put(pale, 0.5, 4.4, 0.85, L - 0.27, A * 0.9, 0);
  for (let i = 0; i < 8; i++) put(mat('glass'), 0.02, 0.5, 0.7, L - 0.53, A * 0.9 - 1.9 + i * 0.55, 0.1);
  put(M.dark(), 0.07, 2.0, 1.2, L - 0.04, A * 1.8, 1.2); put(tvMat(), 0.08, 1.9, 1.1, L - 0.06, A * 1.8, 1.25, true);
  // 北牆：矮櫃延伸，咖啡機、飲水機、綠色茶葉袋
  put(pale, 2.8, 0.5, 0.85, L - 1.9 - 0.4, A * (W / 2 - 0.27), 0);
  put(M.dark(), 0.3, 0.3, 0.4, L - 1.4, A * (W / 2 - 0.3), 0.85); put(M.white(), 0.35, 0.35, 0.5, L - 2.0, A * (W / 2 - 0.3), 0.85);
  for (const du of [0, 0.3]) put(mat('wool', '#4a9a52'), 0.2, 0.12, 0.4, L - 2.8 - du, A * (W / 2 - 0.3), 0.85);
  put(pale, 0.5, 0.9, 2.2, L - 3.7, A * (W / 2 - 0.27), 0);                // 北牆高櫃
  // 會議桌（淺木色桌面、黑色桌腳）＋灰色網椅
  const mu = L / 2, mv = A * 1.0;
  put(mat('wool', '#e9dcc0'), 2.4, 1.1, 0.05, mu, mv, 0.72);
  for (const du of [-1.0, 1.0]) put(black, 0.06, 0.9, 0.72, mu + du, mv, 0);
  for (const du of [-0.8, 0, 0.8]) for (const s of [-1, 1]) officeChair(put, mu + du, mv + s * 0.95, 0, -s, '#4a4e54');
  for (const s of [-1, 1]) officeChair(put, mu + s * 1.55, mv, -s, 0, '#4a4e54');
  // 玻璃獎盃櫃（木紋框、上方玻璃展示格）
  const tu = L - 0.3;
  put(pale, 0.5, 1.2, 2.3, tu, D * (W / 2 - 0.9), 0);
  put(mat('glass'), 0.02, 1.0, 1.4, tu - 0.26, D * (W / 2 - 0.9), 0.75);
  for (let i = 0; i < 4; i++) put(mat('wool', ['#d4a017', '#f1e3c0', '#c9ccd1'][i % 3]), 0.18, 0.22, 0.2, tu - 0.05, D * (W / 2 - 0.9) - 0.35 + (i % 2) * 0.5, 0.82 + Math.floor(i / 2) * 0.6);
  // 沙發組：米色雙人沙發＋單人沙發＋蕾絲桌巾茶几（背對門那面牆，避開門）
  const su = L / 2;
  const sv = D * (W / 2 - 0.7);
  put(beige, 1.9, 0.8, 0.4, su, sv, 0); put(beige, 1.9, 0.2, 0.45, su, sv + D * 0.3, 0.4);   // 沙發座與椅背
  put(beige, 0.25, 0.8, 0.28, su - 0.82, sv, 0.4); put(beige, 0.25, 0.8, 0.28, su + 0.82, sv, 0.4);
  put(mat('wool', '#f0e4d8'), 0.4, 0.4, 0.15, su - 0.4, sv - D * 0.1, 0.4);                  // 靠枕
  put(mat('wool', '#f2efe8'), 0.9, 1.6, 0.04, su, sv - D * 1.4, 0.45);                        // 茶几桌巾
  put(mat('wool', '#5a3a2a'), 0.8, 1.5, 0.45, su, sv - D * 1.4, 0);
}

// 1F 總務處（依照片）：橘色屏風隔間的辦公座位、白板與木色吊櫃（西牆）、窗邊灰色捲簾＋矮櫃＋粉紅資料夾、
//   玻璃書櫃、長桌＋木凳、電風扇
function generalOffice(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const wood = mat('planks', '#b5773f'), pale = mat('planks', '#b8aa98'), orange = mat('wool', '#e8825f');
  const grey = mat('wool', '#8a8f94'), beige = mat('wool', '#e8dcc6'), black = mat('wool', '#202226');
  // 門在 v 方向哪個 u 附近，家具要避開
  const doorU = (room.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]);
  const clear = (u, half) => doorU.every((d) => Math.abs(d - u) > half + 0.5);
  const split = L;

  /* ---- 西半：辦公區 ---- */
  // 西牆：白板＋上方木色吊櫃＋下方矮櫃
  put(mat('wool', '#f6f6f2'), 0.04, 3.4, 1.2, 0.03, A * 0.6, 0.9, true);
  put(wood, 0.4, 3.4, 0.55, 0.22, A * 0.6, 1.95);
  put(wood, 0.45, 2.2, 2.4, 0.24, D * 1.9, 0);
  // 北牆窗：灰色捲簾＋下方木矮櫃＋粉紅色資料夾
  for (let u = 1.2; u < split - 0.4; u += 1.5) put(mat('wool', '#d9dcdf'), 1.3, 0.03, 1.3, u, A * (W / 2 - 0.02), 1.1);
  for (let u = 0.9; u < split + 0.2; u += 0.9) put(wood, 0.88, 0.45, 0.8, u + 0.2, A * (W / 2 - 0.25), 0);
  for (let i = 0; i < 10; i++) put(mat('wool', ['#f2b6c8', '#f7d4df', '#e9a0b8'][i % 3]), 0.18, 0.28, 0.28, 2.6 + i * 0.12, A * (W / 2 - 0.3), 0.8);
  // 橘色屏風隔間：4 個座位（兩欄），螢幕、桌上雜物
  for (const [u, v] of [[1.6, A * 2.0], [3.4, A * 2.0], [5.2, A * 2.0], [1.6, A * 0.2], [3.4, A * 0.2], [5.2, A * 0.2]]) {
    put(M.desk(), 1.5, 0.75, 0.74, u, v, 0);
    put(orange, 1.7, 0.05, 1.25, u, v + A * 0.42, 0);                       // 背板（靠窗那面）
    put(orange, 0.05, 1.4, 1.25, u - 0.85, v, 0);                           // 側板
    put(black, 0.05, 0.55, 0.34, u, v + A * 0.12, 0.76); put(screenMat(), 0.02, 0.5, 0.3, u, v + A * 0.1, 0.78);
    officeChair(put, u, v + D * 0.75, 0, -D, '#2b2d31');
  }
  // 東側玻璃書櫃（木框，放滿資料夾）
  put(wood, 0.45, 2.6, 2.2, split - 0.3, D * (W / 2 - 1.5), 0);
  put(mat('glass'), 0.02, 2.2, 1.2, split - 0.52, D * (W / 2 - 1.5), 0.7);
  for (let i = 0; i < 8; i++) put(mat('wool', ['#f2b6c8', '#9ec5e8', '#e8d9a0'][i % 3]), 0.2, 0.22, 0.3, split - 0.4, D * (W / 2 - 1.5) - 0.9 + i * 0.26, 0.8 + (i % 2) * 0.55);
  // 靠門側：長桌＋木凳（避開門）
  const barU = clear(1.8, 1.4) ? 1.8 : 3.6;
  put(mat('wool', '#6e5a4a'), 2.6, 0.7, 0.05, barU, D * (W / 2 - 0.9), 0.82);
  put(mat('wool', '#3e3a36'), 2.4, 0.5, 0.82, barU, D * (W / 2 - 0.9), 0);
  for (const du of [-0.8, 0, 0.8]) {
    const sv = D * (W / 2 - 1.55);
    put(mat('wool', '#b5773f'), 0.35, 0.35, 0.05, barU + du, sv, 0.6);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(mat('wool', '#b5773f'), 0.04, 0.04, 0.6, barU + du + a * 0.13, sv + b * 0.13, 0);
  }
  put(M.white(), 0.4, 0.4, 0.5, barU + 1.6, D * (W / 2 - 1.4), 0);          // 電風扇

  // 時鐘（西牆）
  put.geo(M.white(), new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24).rotateX(Math.PI / 2), 0.05, D * 0.8, 2.3, fr.alongX ? Math.PI / 2 : 0);
}


function office(put, fr, name, room) {
  const W = fr.W, L = fr.L;
  if (name.includes('校長室') && room) return principalOffice(put, fr, room);
  if (name.includes('總務處') && room) return generalOffice(put, fr, room);
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

// 木頭椅（高背，餐桌／會議桌用）：face = 椅子面向 v 的哪一邊（+1／-1）
function woodChair(put, u, v, face, wood = mat('wool', '#6b3a22')) {
  put(wood, 0.45, 0.45, 0.06, u, v, 0.44);
  put(wood, 0.45, 0.06, 0.6, u, v - face * 0.21, 0.5);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.05, 0.05, 0.44, u + a * 0.19, v + b * 0.19, 0);
}

// 木頭椅，面向 u 方向（+1／-1）
function woodChairU(put, u, v, face, wood = mat('wool', '#6b3a22')) {
  put(wood, 0.45, 0.45, 0.06, u, v, 0.44);
  put(wood, 0.06, 0.45, 0.6, u - face * 0.21, v, 0.5);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.05, 0.05, 0.44, u + a * 0.19, v + b * 0.19, 0);
}

// 3F 輔導室（依 6 張空景照片＋使用者說明）：
//   西牆（走廊）：雪人窗、兩扇門、窗下木矮櫃；南牆淺綠：白板行事曆、時鐘、抽屜櫃＋地球儀，前面一座木格柵展示櫃（圓弧頂、噴瓶圓層板、禮物盒）
//   北牆：一整排到頂的米白收納櫃（圓把手），東北角冰箱、東牆北端灰色門
//   東牆灰色捲簾窗；北半段用一道 1.6 m 木櫃隔出休息區：小桌子（倉鼠籠、小朋友的畫）、愛心椅凳、木茶几（裁紙機）、深咖啡雙人沙發（小熊）、
//   微波爐電鍋櫃、「歡喜招吉祥」匾額；南半段白色圓桌＋紅圓凳、貼綠色海報的木門櫃
//   中間兩排 OA 屏風辦公桌（坐下來面向西邊的門口），東南邊另一張單獨的辦公桌＋護貝機
// u：從北牆往南；v：A 東（校外、灰牆）、D 西（走廊、門）
const snowmanMat = (scarf) => once(`snowman${scarf}`, () => new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.4, map: bigTex(64, 128, (c) => {
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(32, 94, 26, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(32, 50, 19, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2b2b2b'; c.fillRect(24, 44, 4, 4); c.fillRect(36, 44, 4, 4);
  c.fillStyle = '#e8892b'; c.fillRect(31, 51, 9, 3);                    // 紅蘿蔔鼻子
  c.fillStyle = scarf; c.fillRect(14, 64, 36, 7); c.fillRect(38, 64, 7, 18);   // 圍巾
  if (scarf === '#d63a3a') { c.fillRect(19, 20, 26, 14); c.fillRect(14, 32, 36, 5); }   // 紅帽子
}) }));
const calendarBoardMat = () => once('calboard', () => new THREE.MeshLambertMaterial({ map: bigTex(256, 160, (c, w, h) => {
  c.fillStyle = '#b9bec4'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#f8f8f5'; c.fillRect(5, 5, w - 10, h - 10);
  c.strokeStyle = '#8f99a4'; c.lineWidth = 1;
  for (let x = 34; x < w - 40; x += 18) { c.beginPath(); c.moveTo(x + 0.5, 14); c.lineTo(x + 0.5, h - 12); c.stroke(); }
  for (let y = 14; y < h - 10; y += 14) { c.beginPath(); c.moveTo(14, y + 0.5); c.lineTo(w - 46, y + 0.5); c.stroke(); }
  c.fillStyle = '#4a4f55'; c.font = '700 11px sans-serif';
  ['月', '日', '行', '事', '曆'].forEach((t, i) => c.fillText(t, 16, 40 + i * 16));
  c.fillStyle = '#f2a7c0'; c.fillRect(128, 72, 22, 26);                 // 粉紅便條
  c.fillStyle = '#f7c6d8'; c.fillRect(w - 40, 60, 30, 40);
  c.fillStyle = '#e8506a'; c.beginPath(); c.arc(54, 104, 6, 0, Math.PI * 2); c.arc(64, 104, 6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(48, 106); c.lineTo(59, 120); c.lineTo(70, 106); c.fill();   // 愛心
}) }));
const blessingMat = () => once('blessing', () => new THREE.MeshLambertMaterial({ map: bigTex(96, 224, (c, w, h) => {
  c.fillStyle = '#c9a54a'; c.fillRect(0, 0, w, h);                       // 金色框
  c.fillStyle = '#f4ead2'; c.fillRect(9, 9, w - 18, h - 18);
  c.fillStyle = '#1d1b1a'; c.font = '700 30px "Noto Serif TC", "Noto Sans TC", serif'; c.textAlign = 'center';
  ['歡', '喜', '招', '吉', '祥'].forEach((t, i) => c.fillText(t, w / 2, 48 + i * 36));
}) }));
const kidsDrawingMat = () => once('kidsdraw', () => new THREE.MeshLambertMaterial({ map: bigTex(256, 64, (c, w, h) => {
  c.fillStyle = '#d9dadb'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 50; c.fillStyle = '#fbfbf8'; c.fillRect(x, 6 + (i % 2) * 4, 44, 52);
    c.strokeStyle = '#6b6b6b'; c.lineWidth = 1.5; c.strokeRect(x + 10, 20, 24, 20); c.beginPath(); c.arc(x + 22, 30, 6, 0, Math.PI * 2); c.stroke();   // 鉛筆畫的倉鼠籠
  }
}) }));
function counselingRoom(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A, E = (v) => A * v;           // E(v)：往東 v 公尺
  const green = mat('wool', '#e3eba6'), greyWall = mat('wool', '#d3d6d8'), white = mat('wool', '#f3f3f0');
  const grey = mat('wool', '#a7acb1'), woodBand = mat('wool', '#caa577'), frost = mat('glass'), alu = mat('wool', '#c9cdd1');
  const black = mat('wool', '#1d1f22'), lightWood = mat('planks', '#c9ae8a'), knob = M.metal();
  put(mat('planks', '#bdb3a3'), L, W, 0.012, L / 2, 0, 0);                     // 灰木紋地板
  // 牆面：南牆淺萊姆綠、北牆櫃子上方綠、東牆淺灰
  put(green, 0.02, W - 0.1, 2.96, L - 0.012, 0, 0); put(green, 0.02, W - 0.1, 0.55, 0.012, 0, 2.42);
  for (const [y0, h] of [[0, 1.0], [2.2, 0.78]]) put(greyWall, L - 0.1, 0.02, h, L / 2, E(W / 2 - 0.012), y0);
  // ---- 北牆：到頂的米白收納櫃（從西牆到冰箱前） ----
  const cv0 = -W / 2 + 0.02, cv1 = 2.05, cab = mat('wool', '#e9e1cf');
  put(cab, 0.6, cv1 - cv0, 2.4, 0.31, E((cv0 + cv1) / 2), 0);
  for (let v = cv0 + 0.55; v < cv1; v += 0.55) put(mat('wool', '#cfc6b2'), 0.01, 0.015, 2.3, 0.615, E(v), 0.05);   // 櫃門縫
  for (let v = cv0 + 0.275; v < cv1; v += 0.55) for (const y of [0.95, 1.65]) put(knob, 0.03, 0.05, 0.05, 0.625, E(v + 0.18), y);
  // 東北角：冰箱、東牆北端灰色門
  put(mat('wool', '#b8bdc2'), 0.65, 0.65, 1.75, 0.4, E(2.45), 0);
  put(mat('wool', '#aeb4b9'), 0.9, 0.03, 2.05, 1.25, E(W / 2 - 0.03), 0); put(knob, 0.06, 0.04, 0.06, 0.9, E(W / 2 - 0.06), 1.0);
  // ---- 隔出休息區的木櫃（1.6 m 高，門朝東邊休息區；朝西那面是平的木皮），上面放金色、紅色裝飾 ----
  const pv = 1.55, pu0 = 1.45, pu1 = 5.0, pu = (pu0 + pu1) / 2;   // 北端跟收納櫃之間留一條小走道（依照片）
  put(mat('planks', '#b9a184'), pu1 - pu0, 0.5, 1.6, pu, E(pv), 0); put(white, pu1 - pu0 + 0.05, 0.55, 0.03, pu, E(pv), 1.6);
  for (let u = pu0 + 0.35; u < pu1; u += 0.7) { put(knob, 0.05, 0.03, 0.05, u, E(pv + 0.26), 1.0); put(mat('wool', '#a08868'), 0.015, 0.01, 1.5, u + 0.35, E(pv + 0.255), 0.05); }
  put(mat('wool', '#d4af37'), 2.0, 0.12, 0.1, pu + 0.2, E(pv), 1.63); put(mat('wool', '#c0392b'), 0.3, 0.3, 0.18, pu + 0.9, E(pv), 1.63);
  put(mat('wool', '#f2efe6'), 1.8, 0.01, 0.28, pu - 0.3, E(pv - 0.26), 0.85);   // 西面貼的小卡片
  // ---- 東邊休息區（北→南）：小桌子＋倉鼠籠、愛心椅凳、木茶几、雙人沙發、微波爐電鍋櫃、匾額 ----
  const tv = W / 2 - 0.33;
  for (const u of [1.95, 2.95]) {
    put(mat('wool', '#e6ebe6'), 0.95, 0.6, 0.04, u, E(tv), 0.7);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(mat('wool', '#8b5a32'), 0.05, 0.05, 0.7, u + a * 0.42, E(tv + b * 0.25), 0);
  }
  put(white, 0.62, 0.42, 0.03, 1.95, E(tv), 0.74);                                 // 倉鼠籠：白色底盤＋透明壓克力
  put(frost, 0.62, 0.42, 0.3, 1.95, E(tv), 0.77);
  put(mat('planks', '#d9b98a'), 0.2, 0.3, 0.12, 2.15, E(tv), 0.77);                // 籠子裡的木頭小屋台
  put(kidsDrawingMat(), 1.4, 0.01, 0.35, 2.3, E(W / 2 - 0.02), 1.1, true);          // 牆上小朋友畫的倉鼠籠
  put(mat('wool', '#d9dadb'), 3.6, 0.02, 1.1, 3.1, E(W / 2 - 0.05), 1.65);          // 灰色捲簾
  const ott = mat('wool', '#8fa3ad');                                              // 愛心形椅凳
  for (const s of [-1, 1]) put.geo(ott, new THREE.CylinderGeometry(0.19, 0.19, 0.42, 14), 3.6 + s * 0.1, E(2.65), 0.21);
  put.geo(ott, new THREE.CylinderGeometry(0.15, 0.15, 0.42, 4).rotateY(Math.PI / 4), 3.6, E(2.8), 0.21);
  put(mat('planks', '#d8b98a'), 0.6, 0.9, 0.04, 4.2, E(3.05), 0.42);              // 木茶几（黑腳）＋藍色裁紙機
  for (const s of [-1, 1]) put(black, 0.6, 0.04, 0.42, 4.2, E(3.05 + s * 0.4), 0);
  put(mat('wool', '#2f5aa8'), 0.35, 0.3, 0.03, 4.2, E(3.0), 0.46);
  const sofa = mat('wool', '#3b2c2e'), cushion = mat('wool', '#4a383a');          // 深咖啡雙人沙發，面向北
  put(sofa, 0.85, 1.15, 0.3, 5.0, E(3.05), 0.08); put(cushion, 0.62, 0.85, 0.12, 4.92, E(3.05), 0.38);   // 西邊留走道
  put(sofa, 0.22, 1.15, 0.48, 5.32, E(3.05), 0.38);
  for (const s of [-1, 1]) put(sofa, 0.85, 0.15, 0.62, 5.0, E(3.05 + s * 0.5), 0);
  const bear = mat('wool', '#c58a4a');                                              // 沙發上的小熊
  put(bear, 0.18, 0.24, 0.24, 4.95, E(2.75), 0.5); put(bear, 0.15, 0.18, 0.16, 4.95, E(2.75), 0.74);
  const mv = W / 2 - 0.27;                                                          // 微波爐電鍋櫃（深灰框、木門、上面微波爐）
  put(mat('wool', '#4a4d52'), 0.9, 0.5, 0.95, 5.9, E(mv), 0); put(lightWood, 0.85, 0.02, 0.45, 5.9, E(mv - 0.26), 0.05);
  put(mat('wool', '#2b2d31'), 0.84, 0.46, 0.4, 5.9, E(mv + 0.02), 0.52);
  put.geo(mat('wool', '#e8508a'), new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), 5.7, E(mv), 0.64);   // 粉紅電鍋
  put.geo(mat('wool', '#c62828'), new THREE.CylinderGeometry(0.13, 0.11, 0.16, 12), 6.1, E(mv), 0.61);
  put(black, 0.5, 0.36, 0.3, 5.9, E(mv), 0.95);                                    // 微波爐
  put(blessingMat(), 0.42, 0.02, 0.98, 5.3, E(W / 2 - 0.02), 1.55, true);           // 「歡喜招吉祥」匾額
  // ---- 東南邊：白色圓桌＋紅圓凳、貼綠色海報的木門櫃 ----
  put.geo(white, new THREE.CylinderGeometry(0.45, 0.45, 0.04, 20), 6.65, E(2.45), 0.72);
  put(M.metal(), 0.06, 0.06, 0.72, 6.65, E(2.45), 0);
  for (const [du, dv] of [[-0.6, 0.15], [0.55, -0.1]]) {
    put.geo(mat('wool', '#c0392b'), new THREE.CylinderGeometry(0.17, 0.17, 0.04, 12), 6.65 + du, E(2.45 + dv), 0.45);
    put(mat('wool', '#c0392b'), 0.04, 0.04, 0.45, 6.65 + du, E(2.45 + dv), 0);
  }
  put(mat('planks', '#8c7a66'), 1.0, 0.45, 2.0, 7.75, E(W / 2 - 0.25), 0);
  put(mat('wool', '#6b5a48'), 0.015, 0.01, 1.9, 7.75, E(W / 2 - 0.48), 0.05);
  put(mat('wool', '#5cb85c'), 0.3, 0.01, 0.55, 7.55, E(W / 2 - 0.48), 1.25);
  // ---- 南牆：白板行事曆、時鐘、抽屜櫃＋地球儀；前面的木格柵展示櫃、禮物盒 ----
  put(calendarBoardMat(), 0.03, 1.7, 1.1, L - 0.03, E(0.1), 1.25, true);
  put.geo(white, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20).rotateX(Math.PI / 2), L - 0.04, E(-1.15), 2.4, 0);
  put(black, 0.01, 0.02, 0.12, L - 0.07, E(-1.15), 2.38); put(black, 0.01, 0.1, 0.02, L - 0.07, E(-1.15) + 0.04, 2.4);
  put(mat('wool', '#ede2cc'), 0.45, 1.6, 0.8, L - 0.25, E(1.75), 0);
  put(mat('wool', '#9aa0a6'), 0.35, 0.6, 0.38, L - 0.22, E(1.35), 0.8);
  for (let r = 0; r < 4; r++) put(white, 0.01, 0.54, 0.02, L - 0.4, E(1.35), 0.86 + r * 0.09);
  put(M.metal(), 0.04, 0.04, 0.22, L - 0.25, E(1.95), 0.8);
  put.geo(mat('wool', '#3d7cc9'), new THREE.SphereGeometry(0.17, 12, 10), L - 0.25, E(1.95), 1.17);
  const au = L - 0.95, av = -2.1;                                                   // 展示櫃（長邊跟南牆平行）
  put(lightWood, 0.42, 1.25, 0.85, au, E(av), 0);
  put(white, 0.4, 0.5, 1.25, au, E(av + 0.35), 0.85);                               // 右半邊開放格（白）
  for (const y of [1.25, 1.65]) put(lightWood, 0.38, 0.48, 0.03, au - 0.02, E(av + 0.35), y);
  for (let k = 0; k < 5; k++) put(mat('wool', '#7a4a2a'), 0.06, 0.07, 1.25, au, E(av - 0.55 + k * 0.13), 0.85);   // 直條木格柵
  put(lightWood, 0.5, 1.35, 0.07, au, E(av), 2.1);                                  // 圓弧頂板（簡化成長板）
  put(mat('wool', '#efe6d8'), 0.02, 0.28, 0.42, au - 0.22, E(av - 0.4), 1.35);      // 掛著的帆布袋
  put.geo(white, new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), au - 0.32, E(av + 0.5), 0.92);   // 圓形小層板＋噴瓶
  for (const dv of [-0.08, 0.08]) put(white, 0.07, 0.07, 0.22, au - 0.36, E(av + 0.5 + dv), 0.935);
  [['#a8ded8', 0, 0], ['#c0392b', 0, 0.3], ['#f4b8c8', 0.4, 0]].forEach(([col, du, y]) => put(mat('wool', col), 0.32, 0.32, 0.3, au - 0.55 - du, E(av + 0.6), y));   // 禮物盒
  // ---- 中間：兩排 OA 屏風辦公桌，人坐在桌子東邊、臉朝西邊的門口 ----
  const us = [2.3, 3.6, 4.9], cw = 1.3;
  const panel = (u, v, du, dv) => {
    put(grey, du, dv, 0.72, u, v, 0); put(woodBand, du, dv, 0.26, u, v, 0.72); put(frost, du, dv, 0.27, u, v, 0.98);
    put(alu, du + 0.02, dv + 0.02, 0.03, u, v, 1.25);
  };
  const desk = (u, v, pink) => {
    put(white, cw - 0.08, 0.72, 0.04, u, v, 0.71);                                   // 白色桌面（高 0.75）
    put(white, 0.42, 0.55, 0.66, u + cw / 2 - 0.3, v + A * 0.05, 0);                 // 活動抽屜櫃
    put(black, 0.6, 0.05, 0.38, u, v + D * 0.22, 0.77); put(screenMat(), 0.55, 0.02, 0.33, u, v + D * 0.19, 0.79);
    put(black, 0.45, 0.16, 0.02, u, v + A * 0.12, 0.75);                             // 鍵盤
    if (pink) put(mat('wool', '#e9b9c4'), 0.75, 0.42, 0.01, u + 0.1, v + A * 0.12, 0.75);
    officeChair(put, u, v + A * 0.75, 0, D, '#2b2d31');                              // 椅子在東邊，坐下來面向西（門口）
  };
  [E(-2.2), E(-0.2)].forEach((v, ci) => {
    panel((us[0] + us[2]) / 2, v + D * 0.4, cw * 3, 0.05);                           // 前面（西側）一整道屏風
    for (let k = 0; k <= 3; k++) panel(us[0] - cw / 2 + k * cw, v, 0.05, 0.8);        // 組與組中間
    us.forEach((u, i) => desk(u, v, ci === 1 && i === 1));
  });
  // 東南邊單獨一張（旁邊護貝機放在小白櫃上）
  const su = 7.0;                                                                    // 跟中間辦公桌區之間留走道
  panel(su, E(0.4) + D * 0.4, cw, 0.05); for (const s of [-1, 1]) panel(su + s * cw / 2, E(0.4), 0.05, 0.8);
  desk(su, E(0.4), false);
  put(white, 0.5, 0.5, 0.7, L - 0.3, E(0.45), 0); put(mat('wool', '#d9d9d9'), 0.3, 0.45, 0.1, L - 0.3, E(0.45), 0.7);
  // ---- 西邊：窗下木矮櫃（兩扇門中間）、窗戶上的雪人貼紙 ----
  const doorU = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]).sort((a, b) => a - b);
  const c0 = (doorU[0] ?? 1.5) + 1.05, c1 = (doorU[1] ?? L - 1.5) - 1.05;
  if (c1 - c0 > 1) { put(lightWood, c1 - c0, 0.42, 0.85, (c0 + c1) / 2, D * (W / 2 - 0.23), 0); put(white, c1 - c0 + 0.05, 0.45, 0.03, (c0 + c1) / 2, D * (W / 2 - 0.23), 0.85); }
  ['#4fb3c8', '#d63a3a', '#4fb3c8', '#d63a3a'].forEach((col, i) => put(snowmanMat(col), 0.32, 0.01, 0.62, c0 + 0.3 + i * (c1 - c0 - 0.6) / 3, D * (W / 2 - 0.05), 1.35, true));
}

// 1F 教務處（依三張照片＋使用者指示）：棕米相間木紋地板、淺藍牆、南牆茶水區（米色上下櫃、湖水綠壁面、冰箱、咖啡機）、
//   東南角六人會議桌（蕾絲桌巾、東西向）、中間一長排米色櫃台、4 張霧面玻璃屏風 OA 桌（靠窗北邊那張粉紅椅）＋靠茶水櫃的雙螢幕主任桌（都面向門口）、北牆玻璃門書櫃
const plankFloorMat = () => once('plankfloor', () => new THREE.MeshLambertMaterial({ map: bigTex(512, 512, (c, w, h) => {
  const cols = ['#8d6c52', '#dacfb9'], pw = 64, ph = 20;
  for (let y = 0, r = 0; y < h; y += ph, r++) for (let x = -(r % 3) * 21, k = r; x < w; x += pw, k++) {
    c.fillStyle = cols[k % 2]; c.fillRect(x, y, pw - 1, ph - 1);
  }
}) }));
const binderCaseMat = () => once('bindercase', () => new THREE.MeshLambertMaterial({ map: bigTex(128, 256, (c, w, h) => {
  c.fillStyle = '#ece3d0'; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) {
    const y = 12 + r * 46;
    c.fillStyle = '#d9d4c8'; c.fillRect(8, y, w - 16, 40);
    for (let x = 12; x < w - 14; x += 9) { c.fillStyle = ['#3d5fa8', '#4b6fb8', '#c0392b', '#3d5fa8'][(x + r) % 4]; c.fillRect(x, y + 6, 7, 32); }
  }
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(8, 12, w - 16, 180);           // 玻璃門反光
  c.fillStyle = '#d6c9ae'; c.fillRect(0, 200, w, 56); c.fillStyle = '#b9a98a'; c.fillRect(w / 2 - 1, 200, 2, 56);
}) }));
function academicAffairs(put, fr, room) {
  // u：從北牆往南；v：A 西（窗外）、D 東（走廊、門）
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const cream = mat('wool', '#e8dcc4'), top = mat('wool', '#a2a7ac'), black = mat('wool', '#202226');
  const grey = mat('wool', '#a9aeb3'), frost = mat('glass'), deskTop = mat('wool', '#d9d4c7');
  put(plankFloorMat(), L, W, 0.012, L / 2, 0, 0, true);
  paintBands(put, fr, mat('wool', '#c6e7ea'));
  // 北牆：玻璃門書櫃（藍色資料夾）
  const nb = 5, bw = 0.95, bv0 = A * (W / 2 - 0.3) + D * bw / 2;
  for (let i = 0; i < nb; i++) put(binderCaseMat(), 0.45, bw - 0.02, 2.3, 0.25, bv0 + D * i * bw, 0, true);
  // 南牆：茶水區（米色上下櫃、湖水綠壁面）、冰箱、咖啡機
  const kv = A * 0.9, kl = 3.6, ku = L - 0.32;
  put(cream, 0.6, kl, 0.88, ku, kv, 0); put(top, 0.62, kl, 0.04, ku, kv, 0.88);
  put(mat('wool', '#7fd3cf'), 0.02, kl, 0.75, L - 0.02, kv, 0.92);
  put(cream, 0.38, kl, 0.75, L - 0.2, kv, 1.75);
  put(mat('wool', '#c9ccd1'), 0.7, 0.7, 1.7, L - 0.4, A * (W / 2 - 0.45), 0);
  put(black, 0.3, 0.3, 0.4, L - 0.3, kv + D * 1.2, 0.92);
  // 中間一長排米色櫃台（灰色桌面），面向門
  const cu0 = 1.0, cu1 = Math.min(5.0, L - 3.3), cv = D * 0.9;
  put(cream, cu1 - cu0, 0.6, 0.95, (cu0 + cu1) / 2, cv, 0); put(top, cu1 - cu0 + 0.1, 0.7, 0.05, (cu0 + cu1) / 2, cv, 0.95);
  // 辦公桌：人坐在西邊、臉朝東（門口）；螢幕在東半邊
  const desk = (u, v, du, monitors, chair = ['#2b2d31', '#202226']) => {
    put(deskTop, du, 0.75, 0.04, u, v, 0.72);
    put(grey, du - 0.1, 0.05, 0.7, u, v + D * 0.33, 0);                                   // 前擋板
    for (const s of [-1, 1]) put(grey, 0.05, 0.7, 0.72, u + s * (du / 2 - 0.03), v, 0);
    monitors.forEach((du2) => { put(black, 0.55, 0.05, 0.36, u + du2, v + D * 0.22, 0.76); put(screenMat(), 0.5, 0.02, 0.32, u + du2, v + D * 0.195, 0.78); });
    put(M.grey(), 0.45, 0.16, 0.02, u, v + A * 0.05, 0.76);                               // 鍵盤
    officeChair(put, u, v + A * 0.75, 0, D, ...chair);
  };
  // 4 張 OA 屏風桌（2 × 2），在櫃台西邊
  const rows = [D * 0.9 + A * 1.45, D * 0.9 + A * 3.0], cols = [cu0 + 0.9, cu0 + 2.5];
  for (const v of rows) for (const u of cols) {
    const pink = v === rows[1] && u === cols[0];                      // 靠窗那排北邊這張：粉紅色椅子（依照片）
    desk(u, v, 1.4, [0], pink ? ['#f2a7c0', '#f6c3d4'] : undefined);
    put(frost, 1.4, 0.05, 0.4, u, v + D * 0.38, 0.95); put(grey, 1.4, 0.05, 0.25, u, v + D * 0.38, 0.72);   // 霧面玻璃屏風
    put(grey, 0.05, 0.8, 1.3, u + 0.72, v, 0); put(frost, 0.05, 0.8, 0.3, u + 0.72, v, 1.3);
  }
  // 主任桌（雙螢幕），直接靠著南牆茶水區的櫃子，臉朝門口
  const du = L - 0.62 - 0.85;
  desk(du, A * 1.0, 1.7, [-0.32, 0.32]);
  put(cream, 0.5, 0.45, 0.6, du - 1.1, A * 1.0, 0);                                        // 旁邊的矮櫃
  // 六人會議桌（蕾絲桌巾）在東南角，東西向擺，木椅南北各三張
  const tu = L - 1.2, tv = D * (W / 2 - 1.55);
  put(mat('wool', '#f4efe6'), 1.0, 2.0, 0.04, tu, tv, 0.74);
  put(mat('wool', '#8a6a52'), 0.8, 1.8, 0.72, tu, tv, 0);
  for (const dv of [-0.65, 0, 0.65]) { woodChairU(put, tu - 0.75, tv + dv, 1); woodChairU(put, tu + 0.75, tv + dv, -1); }
  put(M.white(), 0.3, 1.0, 0.3, L / 2, A * (W / 2 - 0.17), 2.5);                         // 冷氣
}

// 潛能教室一、二（資源班，依照片）：北牆木色凹槽＋大電視＋白板＋米色矮櫃、南牆整面米色高櫃（貼紙）、
//   東邊窗前粉紅色屏風老師桌、西邊門旁洗手台、中間淺藍色小桌＋木頭小椅
const stickerCabMat = () => once('stickercab', () => new THREE.MeshLambertMaterial({ map: bigTex(768, 256, (c, w, h) => {
  c.fillStyle = '#ece2cf'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#cdbfa5'; c.lineWidth = 2;
  for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); c.stroke(); }
  c.beginPath(); c.moveTo(0, h * 0.62); c.lineTo(w, h * 0.62); c.stroke();
  c.fillStyle = '#9aa0a6'; for (let i = 0; i < 8; i++) { c.fillRect(i * w / 8 + w / 8 - 10, h * 0.66, 5, 5); c.fillRect(i * w / 8 + 6, h * 0.66, 5, 5); }
  const faces = [['#3d6fb8', '#f2c9a0'], ['#2b2b2b', '#f6d1b0'], ['#6b4a2b', '#f2c9a0'], ['#b5524a', '#f6d1b0'], ['#2b2b2b', '#f2c9a0']];
  faces.forEach(([hair, skin], i) => {
    const x = 120 + i * 120, y = h * 0.5;
    c.fillStyle = hair; c.beginPath(); c.arc(x, y - 4, 22, Math.PI, 0); c.fill();
    c.fillStyle = skin; c.beginPath(); c.arc(x, y + 4, 18, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#333'; c.fillRect(x - 8, y, 3, 3); c.fillRect(x + 5, y, 3, 3);
  });
  c.fillStyle = '#5b9bd5'; c.font = '700 22px sans-serif'; c.fillText('Happy', 300, 50);
  c.fillStyle = '#9fd0f0'; for (const [x, y] of [[560, 30], [600, 60], [200, 40]]) { c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); }
}) }));
function resourceRoom(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;              // A：東（窗）、D：西（門）
  const cream = mat('wool', '#ece2cf'), grey = mat('wool', '#9aa0a6');
  put(mat('planks', '#a39584'), L, W, 0.012, L / 2, 0, 0);                        // 灰木紋地板
  // 北牆（u=0）：木色凹槽＋大電視＋白板＋米色矮櫃
  const span = W - 1.8, vc = D * 0.3;
  put(cream, 0.5, span, 0.85, 0.27, vc, 0); put(grey, 0.55, span, 0.04, 0.27, vc, 0.85);
  put(mat('planks', '#8b7a66'), 0.06, span, 1.9, 0.03, vc, 0.9);
  put(M.dark(), 0.08, 2.0, 1.15, 0.09, vc + A * 0.5, 1.1); put(tvMat(), 0.09, 1.9, 1.05, 0.1, vc + A * 0.5, 1.15, true);
  put(whiteboardMat(), 0.05, 1.0, 1.25, 0.12, vc + D * 1.25, 1.05, true);
  // 南牆（u=L）：整面米色高櫃（卡通貼紙）
  put(stickerCabMat(), 0.6, W - 2.0, 2.4, L - 0.3, D * 0.2, 0, true);
  // 東邊窗前：米色矮櫃、粉紅色屏風老師桌
  put(cream, Math.max(1, L - 1.6), 0.45, 0.85, L / 2, A * (W / 2 - 0.25), 0);
  put(mat('wool', '#d98fa3'), Math.min(1.8, L - 1.4), 0.05, 0.45, L * 0.42, A * (W / 2 - 1.55), 0.7);
  put(mat('wool', '#b8bcc0'), Math.min(1.8, L - 1.4), 0.05, 0.7, L * 0.42, A * (W / 2 - 1.55), 0);
  put(M.desk(), 1.2, 0.65, 0.74, L * 0.42, A * (W / 2 - 1.0), 0);
  officeChair(put, L * 0.42, A * (W / 2 - 1.25) + D * 0.0, 0, A, '#2b2d31');
  // 西邊門旁：洗手台
  put(cream, 0.6, 0.9, 0.85, L - 0.95, D * (W / 2 - 0.5), 0); put(grey, 0.62, 0.92, 0.04, L - 0.95, D * (W / 2 - 0.5), 0.85);
  // 中間：淺藍色小桌 2 × 3、木頭小椅
  const blue = mat('wool', '#9fd0ea'), wood = mat('wool', '#c8955a'), tv0 = D * 0.4;
  for (const du of [-0.34, 0.34]) for (const k of [-1, 0, 1]) {
    const u = L / 2 + du, v = tv0 + k * 0.95;
    put(blue, 0.66, 0.92, 0.04, u, v, 0.6);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.05, 0.05, 0.6, u + a * 0.28, v + b * 0.4, 0);
    const cu = u + Math.sign(du) * 0.6;
    put(wood, 0.32, 0.32, 0.04, cu, v, 0.34); put(wood, 0.04, 0.32, 0.3, cu + Math.sign(du) * 0.15, v, 0.38);
  }
}

// 高年級教室（5～6 年級，依照片）：灰白牆、前面綠色黑板＋大電視、後牆綠色／木色兩排置物櫃＋白板＋綠色拱形布告欄＋時鐘木櫃、
//   窗下綠木色矮櫃、前面角落灰色屏風老師區、書櫃
const archBoardMat = () => once('archboard', () => new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.5, map: bigTex(480, 200, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  const r = w / 6;
  c.fillStyle = '#bfa27a';                                              // 木框
  c.beginPath(); c.moveTo(0, h); c.lineTo(0, r);
  for (let i = 0; i < 3; i++) c.arc(r + i * 2 * r, r, r, Math.PI, 0);
  c.lineTo(w, h); c.closePath(); c.fill();
  c.fillStyle = '#8fd14f';
  c.beginPath(); c.moveTo(8, h - 8); c.lineTo(8, r);
  for (let i = 0; i < 3; i++) c.arc(r + i * 2 * r, r + 4, r - 8, Math.PI, 0);
  c.lineTo(w - 8, h - 8); c.closePath(); c.fill();
  c.fillStyle = '#ffffff';                                              // 貼著的作品、學習單
  for (let i = 0; i < 9; i++) c.fillRect(40 + i * 46, 110 + (i % 2) * 34, 34, 28);
  c.fillStyle = '#f2d1e0'; for (let i = 0; i < 5; i++) c.fillRect(30 + i * 12, 90 + Math.floor(i / 5) * 12, 9, 9);
}) }));
function seniorBack(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const lime = mat('wool', '#8fd14f'), wood = mat('wool', '#c8a77c');
  // 後牆兩排置物櫃
  const cw = W - 1.2, u = L - 0.22, n = Math.max(4, Math.floor(cw / 0.5)), cell = cw / n, v0 = D * 0.4;
  put(mat('wool', '#b89a72'), 0.42, cw, 1.6, u, v0, 0);
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) put((i + r) % 2 ? lime : wood, 0.02, cell - 0.05, 0.72, u - 0.22, v0 - cw / 2 + cell * (i + 0.5), 0.08 + r * 0.78);
  // 上面：左邊白板、右邊綠色拱形布告欄
  put(whiteboardMat(), 0.04, Math.min(2.6, cw * 0.4), 1.0, L - 0.03, v0 + D * cw * 0.28, 1.8, true);
  put(archBoardMat(), 0.03, Math.min(3.0, cw * 0.48), 1.3, L - 0.03, v0 + A * cw * 0.22, 1.65, true);
  // 時鐘木櫃
  const tv = v0 + A * (cw / 2 + 0.35);
  put(mat('wool', '#b89a72'), 0.42, 0.6, 2.75, u, tv, 0);
  put.geo(M.white(), new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20).rotateX(Math.PI / 2), u - 0.22, tv, 2.45, fr.alongX ? Math.PI / 2 : 0);
  // 窗下（A 側）綠木色矮櫃
  const sl = L - 2.6, sn = Math.max(3, Math.floor(sl / 0.55));
  put(mat('wool', '#b89a72'), sl, 0.35, 0.85, 1.6 + sl / 2, A * (W / 2 - 0.18), 0);
  for (let i = 0; i < sn; i++) put(i % 2 ? lime : wood, sl / sn - 0.05, 0.02, 0.7, 1.6 + (sl / sn) * (i + 0.5), A * (W / 2 - 0.37), 0.08);
  // 前面角落：灰色屏風老師區
  put(mat('wool', '#b8bcc0'), 1.5, 0.05, 1.2, 1.25, A * (W / 2 - 1.75), 0);
  // 書櫃（D 側＝門那一側）：放在後門前面的牆邊，不擋門（門寬最多 1.6 m）
  const doorU = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]).sort((a, b) => a - b);
  const backU = doorU.length ? doorU[doorU.length - 1] : L - 1.5;
  put(booksMat(), 1.0, 0.35, 1.6, Math.max(2.5, backU - 0.8 - 0.85), D * (W / 2 - 0.2), 0, true);
}

// 3F 思科教室（依照片）：淺藍牆；前牆白板＋大電視、旁邊洞洞板；兩側牆是木框凹槽（白色玻璃板＋電視）下面灰色矮櫃；
//   後牆米色櫃子、中間白板、彩色收納格、冰箱；中間 6 張白色桌腳灰色亮面實驗桌＋木頭方凳
function ciscoRoom(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  paintBands(put, fr, mat('wool', '#cfe6f2'));
  const doorU = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]);
  const free = (u, half) => doorU.every((d) => Math.abs(d - u) > half + 0.7);
  const cream = mat('wool', '#e9dcc4'), grey = mat('wool', '#7f8489'), wood = mat('planks', '#d8b98a'), white = mat('wool', '#f4f4f2');
  // 前牆：滑動白板＋中間大電視、下面木頭置物板、兩邊洞洞板
  put(whiteboardMat(), 0.05, Math.min(4.6, W - 2), 1.45, 0.05, 0, 0.9, true);
  put(M.dark(), 0.07, 1.96, 1.13, 0.09, 0, 1.05); put(tvMat(), 0.08, 1.9, 1.07, 0.1, 0, 1.08, true);
  put(wood, 0.25, Math.min(4.6, W - 2), 0.08, 0.14, 0, 0.82);
  for (const s of [-1, 1]) put(mat('wool', '#f3f3f0'), 0.04, 0.9, 1.1, 0.04, s * (Math.min(4.6, W - 2) / 2 + 0.6), 1.0);
  // 老師桌（前面右邊）
  put(white, 0.6, 1.2, 0.85, 1.2, D * (W / 2 - 1.5), 0); put(M.dark(), 0.05, 0.5, 0.35, 1.2, D * (W / 2 - 1.5), 0.87);
  // 兩側牆：灰色矮櫃＋木框凹槽（白色玻璃板＋電視），避開門
  for (const s of [-1, 1]) {
    for (let u = 2.2; u < L - 1.0; u += 1.0) {
      if (!free(u, 0.5)) continue;
      put(grey, 1.0, 0.5, 0.85, u, s * (W / 2 - 0.27), 0);
      put(wood, 1.0, 0.25, 0.08, u, s * (W / 2 - 0.15), 2.6);
      put(mat('wool', '#eef3f5'), 0.98, 0.04, 1.5, u, s * (W / 2 - 0.05), 1.0);
    }
    const tu = L / 2;
    if (free(tu, 1.0)) { put(M.dark(), 1.5, 0.06, 0.88, tu, s * (W / 2 - 0.08), 1.35); put(tvMat(), 1.42, 0.07, 0.8, tu, s * (W / 2 - 0.09), 1.39, true); }
  }
  // 後牆：米色櫃子、中間白板、右邊彩色收納格、冰箱
  for (const dv of [-2.6, -1.7, 1.7]) { put(cream, 0.5, 0.86, 2.4, L - 0.27, dv, 0); put(mat('wool', '#cbbd9f'), 0.02, 0.02, 2.3, L - 0.53, dv, 0.05); put(mat('wool', '#cbbd9f'), 0.02, 0.86, 0.02, L - 0.53, dv, 1.5); }
  put(whiteboardMat(), 0.04, 1.6, 1.2, L - 0.04, -0.2, 1.0, true);
  put(booksMat(), 0.45, 1.2, 1.4, L - 0.27, 0.9, 0.9, true);
  put(mat('wool', '#c9ccd1'), 0.65, 0.7, 1.7, L - 0.6, A * (W / 2 - 0.5), 0);
  put(mat('wool', '#3cb371'), 0.04, 2.0, 0.5, L - 0.03, 0, 2.55);                // 綠幕（捲起來）
  // 實驗桌 2 × 3＋木凳
  const top = mat('wool', '#8c9399'), leg = mat('wool', '#f2f2ef'), stool = mat('planks', '#d9b27a');
  for (const u of [L * 0.36, L * 0.66]) for (const v of [-2.1, 0, 2.1]) {
    put(top, 1.9, 0.85, 0.04, u, v, 0.78);
    put(leg, 1.8, 0.75, 0.04, u, v, 0.4);                                      // 下層置物板
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(leg, 0.05, 0.05, 0.78, u + a * 0.88, v + b * 0.38, 0);
    for (const du of [-0.5, 0.5]) for (const s of [-1, 1]) {
      put(stool, 0.24, 0.24, 0.04, u + du, v + s * 0.68, 0.44);
      for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(stool, 0.04, 0.04, 0.44, u + du + a * 0.09, v + s * 0.68 + b * 0.09, 0);
    }
  }
}


// 1F 警衛室（依照片）：窗前一長條深色桌（電話、監視器螢幕、對講機）、上面吊兩台監視器電視、黑色辦公椅、電風扇
const cctvMat = () => once('cctv', () => new THREE.MeshLambertMaterial({ emissive: '#1a2a3a', emissiveIntensity: 0.4, map: bigTex(256, 144, (c, w, h) => {
  c.fillStyle = '#111'; c.fillRect(0, 0, w, h);
  const cols = ['#6f7b84', '#8a9298', '#5f6b72', '#9aa59b', '#7d8a7a', '#a8a29a'];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { c.fillStyle = cols[(r + k) % cols.length]; c.fillRect(2 + k * 42, 2 + r * 35, 40, 33); c.fillStyle = '#f2c230'; c.fillRect(4 + k * 42, 4 + r * 35, 14, 3); }
}) }));
function guardRoom(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const doorU = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]);
  // 南牆（窗口那面）：深色長桌沿著窗戶
  const desk = mat('wool', '#3a3d42'), black = mat('wool', '#1d1f22');
  put(desk, 0.65, W - 0.8, 0.05, L - 0.35, 0, 0.75);
  put(mat('wool', '#e8e4da'), 0.55, 0.6, 0.72, L - 0.35, A * (W / 2 - 0.6), 0);     // 抽屜櫃
  put(black, 0.05, 0.55, 0.36, L - 0.55, D * 0.6, 0.8); put(screenMat(), 0.02, 0.5, 0.32, L - 0.53, D * 0.6, 0.82);
  put(black, 0.05, 0.7, 0.45, L - 0.55, A * 0.4, 0.8); put(cctvMat(), 0.02, 0.66, 0.4, L - 0.53, A * 0.4, 0.82, true);
  put(mat('wool', '#e9e6df'), 0.25, 0.2, 0.08, L - 0.4, 0, 0.8);                    // 電話
  // 上面吊兩台監視器電視
  for (const s of [-1, 1]) { put(black, 0.08, 1.3, 0.78, L - 0.5, s * W / 4, 2.05); put(cctvMat(), 0.02, 1.24, 0.72, L - 0.55, s * W / 4, 2.08, true); put(M.grey(), 0.05, 0.05, 0.45, L - 0.5, s * W / 4, 2.55); }
  officeChair(put, L - 1.2, 0, 1, 0, '#1d1f22');
  put(M.white(), 0.4, 0.4, 0.5, 0.6, A * (W / 2 - 0.5), 0);                         // 電風扇
  put(mat('wool', '#d23a2f'), 0.02, 0.35, 0.9, 0.02, D * (W / 2 - 0.6), 1.1);        // 紅色春聯
}

/** 依名稱、種類挑布置 */
function furnishRoom(room, fr, put) {
  const n = room.name || '', t = room.type;
  if (n === '穿堂') return entranceHall(put, fr, room);                     // 依照片：主題牆、海報牆、彩色天花板
  if (room.hidden || room.open || t === 'garden') return;
  if (t === 'wc' && room.floor === '1F' && room.building === 'B') return restroomWash(put, fr, room);   // 1F 白雲班旁：依照片
  if (t === 'wc') return restroom(put, fr, room);                       // 廁所入口屏風、木紋磚、植生牆
  if (t === 'class') return classroom(put, fr, room);
  if (n.includes('圖書館')) return library(put, fr);
  if (n.includes('音樂')) return musicRoom(put, fr);
  if (n.includes('電腦教室一')) return computerRoom1(put, fr);       // 依照片：長條雙面電腦島
  if (n.includes('電腦教室二')) return computerRoomHex(put, fr);   // 依照片：彩色六角電腦島
  if (n.includes('電腦')) return computerRoom(put, fr);
  if (n.includes('教師會')) return teachersLounge(put, fr);
  if (n.includes('健康中心')) return healthCenter2(put, fr);           // 依照片
  if (n === '教務處') return academicAffairs(put, fr, room);           // 依照片
  if (n === '輔導室') return counselingRoom(put, fr, room);            // 依照片
  if (n === '潛能教室一' || n === '潛能教室二') return resourceRoom(put, fr);   // 資源班，依照片
  if (n === '思科教室') return ciscoRoom(put, fr, room);                // 依照片
  if (n.includes('油印室')) return mimeographRoom(put, fr);            // 依照片
  if (n === '器材室') return sportsRoom(put, fr);                      // 1F 體育器材室，依照片
  if (n === '警衛室') return guardRoom(put, fr, room);                 // 依照片
  if (n === '學務處') return studentAffairs(put, fr, room);                  // 依照片
  if (n.includes('活動中心')) return gym(put, fr);
  if (n.includes('舞蹈') || n.includes('律動')) return danceRoom(put, fr);
  if (n === '會議室' && room.no === '111') return meetingRoom(put, fr, room);   // 1F 會議室依照片
  if (t === 'office') return office(put, fr, n, room);
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
  else if (room.type === 'wc') { title = room.sign || '🚻 廁所'; sub = ''; kind = 'wc'; }
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
  const y0 = room.ground ? 0 : f.y;
  sign.position.set(door.x + out[0] * off, y0 + 2.5, door.z + out[1] * off);
  sign.castShadow = true;
  group.add(sign);
  // 掛牌的鐵架
  const bar = new THREE.Mesh(new THREE.BoxGeometry(horizWall ? 0.03 : 0.95, 0.03, horizWall ? 0.95 : 0.03), new THREE.MeshLambertMaterial({ color: '#555' }));
  bar.position.set(door.x + out[0] * off, y0 + 2.68, door.z + out[1] * off);
  group.add(bar);
}

/** 幫一整層樓擺家具、掛門牌 */
export function furnishFloor(f, wallT) {
  const batch = new Batch();
  for (const room of f.rooms) {
    const fr = frameOf(room, wallT, flipped(room));
    furnishRoom(room, fr, placer(batch, fr, room.ground ? 0 : f.y));   // 警衛室在地面高度
  }
  const g = new THREE.Group();
  batch.build(g);
  // 中庭：遊樂器材、南洋杉、樹籬
  const court = f.rooms.find((r) => r.name === '中庭');
  if (court) decorateCourtyard(court.m, f.level === 0 ? 0 : f.y).build(g);   // 中庭在地面（建築一樓有墊高）
  for (const room of f.rooms) {
    if (room.hidden || room.open || room.type === 'garden' || room.type === 'hall') continue;
    addSign(room, f, g, wallT);
  }
  return g;
}
