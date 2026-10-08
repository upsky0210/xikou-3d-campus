import * as THREE from 'three';
import { Batch, mat } from './blocks.js?v=17';

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
function officeChair(put, u, v, faceU, faceV, color) {
  const mesh = mat('wool', color), black = mat('wool', '#202226');
  put(black, 0.5, 0.5, 0.06, u, v, 0.05);                         // 星形腳座（簡化成底板）
  put(black, 0.06, 0.06, 0.4, u, v, 0.08);
  put(black, 0.48, 0.48, 0.08, u, v, 0.46);                       // 坐墊
  if (faceU) put(mesh, 0.06, 0.46, 0.5, u - faceU * 0.24, v, 0.54);
  else put(mesh, 0.46, 0.06, 0.5, u, v - faceV * 0.24, 0.54);
}
function meetingRoom(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
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
  const uA = 2.6, uB = L - 2.2, half = Math.min(2.4, W / 2 - 1.2), tw = 0.9;
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
  for (let u = uA + 0.4; u < uB - 0.2; u += 0.85) {
    for (const s of [-1, 1]) {
      officeChair(put, u, s * (half + tw / 2 + 0.35), 0, -s, chairCols[k++ % 2]);       // 外側
      officeChair(put, u, s * (half - tw / 2 - 0.35), 0, s, chairCols[k++ % 2]);        // 內側
    }
  }
  for (let v = -half + 0.4; v <= half - 0.4; v += 0.85) officeChair(put, uB + tw + 0.1, v, -1, 0, chairCols[k++ % 2]);
  // 後牆：校史牆
  put(historyWallMat(), 0.03, W - 0.6, 1.7, L - 0.02, 0, 0.85, true);
  // 窗邊：抽屜櫃
  for (let u = L * 0.45; u < L - 0.6; u += 0.9) put(mat('planks', '#b08a66'), 0.88, 0.45, 0.85, u, A * (W / 2 - 0.25), 0);
  // 門那一側：獎盃櫃＋易拉展＋玻璃展示櫃
  put(mat('planks', '#e2d6c2'), 3.0, 0.5, 0.9, 4.0, D * (W / 2 - 0.27), 0);
  for (let i = 0; i < 7; i++) {
    const u = 2.8 + i * 0.4, h = 0.35 + (i % 3) * 0.18, v = D * (W / 2 - 0.27);
    put(mat('wool', '#d4a017'), 0.12, 0.12, h, u, v, 0.9);
    put.geo(mat('wool', '#e6b422'), new THREE.CylinderGeometry(0.1, 0.05, 0.16, 10), u, v, 0.9 + h + 0.08);
  }
  for (let i = 0; i < 3; i++) put(bannerMat(i), 0.04, 0.8, 2.0, 6.2 + i * 0.95, D * (W / 2 - 0.9), 0.05, true);
  put(mat('planks', '#d9cdb8'), 4.0, 0.6, 0.8, L - 3.0, D * (W / 2 - 0.32), 0);
  put(mat('glass'), 4.0, 0.6, 0.12, L - 3.0, D * (W / 2 - 0.32), 0.8);
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
  for (const z of [m.z1 + 0.7, m.z2 - 0.7]) box(hedge, m.x2 - m.x1 - 22, 1.0, 1.0, (m.x1 + m.x2) / 2 - 4, 0, z);
  // 香蕉樹（西北角）
  const bx = m.x1 + 2.2, bz = m.z1 + 2.2;
  box(mat('log', '#b9c27a'), 0.35, 2.6, 0.35, bx, 0, bz);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.BoxGeometry(2.2, 0.06, 0.6); leaf.translate(1.1, 0, 0); leaf.rotateZ(0.35); leaf.rotateY(i * Math.PI / 3);
    geo(mat('wool', '#5fae3a'), leaf, bx, 2.5, bz);
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

// 1F 學務處（依照片）：藍灰色屏風隔間辦公桌 6 組、中間木色會議桌、後牆木頭高櫃、冰箱與咖啡機
function studentAffairs(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const panel = mat('wool', '#8e9db0');
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? A : D, u = 1.6 + (i % 3) * 2.0, v = side * (W / 2 - 1.0);
    put(M.desk(), 1.3, 1.0, 0.74, u, v, 0);
    put(M.dark(), 0.05, 0.5, 0.32, u, v + side * 0.25, 0.79); put(screenMat(), 0.02, 0.46, 0.28, u - 0.025, v + side * 0.25, 0.81);
    chairAt(put, u, v - side * 0.75);
    put(panel, 1.4, 0.05, 1.25, u, v + side * 0.55, 0);                 // 背板
    put(panel, 0.05, 1.1, 1.25, u + 0.7, v, 0);                         // 側板
  }
  // 中間木色會議桌＋木椅
  put(mat('wool', '#6e3b2a'), 2.4, 1.1, 0.06, L / 2 + 0.3, 0, 0.72);
  put(mat('wool', '#4a2a1e'), 2.2, 0.9, 0.72, L / 2 + 0.3, 0, 0);
  for (const du of [-0.8, 0, 0.8]) { chairAt(put, L / 2 + 0.3 + du, -0.85); chairAt(put, L / 2 + 0.3 + du, 0.85); }
  // 後牆木頭高櫃
  for (let i = 0; i < 4; i++) put(mat('planks', '#b5773f'), 0.5, 1.4, 2.2, L - 0.27, -2.1 + i * 1.4, 0);
  // 前面：冰箱、咖啡機、飲水機
  put(mat('wool', '#c9ccd1'), 0.6, 0.65, 1.6, 0.35, D * (W / 2 - 2.5), 0);
  put(M.dark(), 0.3, 0.3, 0.4, 0.35, D * (W / 2 - 3.2), 0.8); put(M.grey(), 0.4, 0.4, 0.8, 0.35, D * (W / 2 - 3.2), 0);
  put(M.white(), 0.35, 0.35, 1.1, 0.35, D * (W / 2 - 3.8), 0);
}

// 廁所入口（依照片）：門內一片黑色鐵格柵框＋木紋門板的拉門屏風、木紋磚腰牆、綠色植生牆
function restroom(put, fr, room) {
  const W = fr.W, L = fr.L;
  const wood = mat('planks', '#a8875f'), grass = mat('grass', '#ffffff'), iron = mat('wool', '#2b2b2b');
  // 牆面：下段木紋磚、上段綠色植生牆（窗戶上下兩段）
  paintBands(put, fr, wood);
  put(grass, 0.03, W - 0.2, 0.75, 0.03, 0, 2.2);
  put(grass, 0.03, W - 0.2, 0.75, L - 0.03, 0, 2.2);
  // 門內的屏風（每個門一片）
  for (const d of room.doorPts || []) {
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
  if (room.hidden || room.open || t === 'garden') return;
  if (t === 'wc') return restroom(put, fr, room);                       // 廁所入口屏風、木紋磚、植生牆
  if (t === 'class') return classroom(put, fr);
  if (n.includes('圖書館')) return library(put, fr);
  if (n.includes('音樂')) return musicRoom(put, fr);
  if (n.includes('電腦教室二')) return computerRoomHex(put, fr);   // 依照片：彩色六角電腦島
  if (n.includes('電腦')) return computerRoom(put, fr);
  if (n.includes('教師會')) return teachersLounge(put, fr);
  if (n.includes('健康中心')) return healthCenter2(put, fr);           // 依照片
  if (n.includes('油印室')) return mimeographRoom(put, fr);            // 依照片
  if (n === '器材室') return sportsRoom(put, fr);                      // 1F 體育器材室，依照片
  if (n === '學務處') return studentAffairs(put, fr);                  // 依照片
  if (n.includes('活動中心')) return gym(put, fr);
  if (n.includes('舞蹈') || n.includes('律動')) return danceRoom(put, fr);
  if (n === '會議室' && room.no === '111') return meetingRoom(put, fr);   // 1F 會議室依照片
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
  // 中庭：遊樂器材、南洋杉、樹籬
  const court = f.rooms.find((r) => r.name === '中庭');
  if (court) decorateCourtyard(court.m, f.y).build(g);
  for (const room of f.rooms) {
    if (room.hidden || room.open || room.type === 'garden' || room.type === 'hall') continue;
    addSign(room, f, g, wallT);
  }
  return g;
}
