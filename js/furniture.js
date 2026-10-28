import * as THREE from 'three';
import { Batch, mat, SPOTS } from './blocks.js?v=250';

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
  const m = room.m, d = room.frameDoors || room.doors || '';   // frameDoors：家具方向用哪幾面門來算（後來加的門不影響擺設）
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

// 會發白光的燈（日光燈、LED、吸頂燈）
const isLamp = (m) => m.emissiveIntensity >= 0.6 && m.emissive && m.emissive.r > 0.8 && m.emissive.g > 0.8;
// 沒畫燈的房間自動補長條日光燈（跟方陣教室一樣：1.2m 長、貼著天花板），大約每 2.6m 一排；挑高的活動中心自己有燈
const tubeMat = () => once('tube', () => new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#f4fbff', emissiveIntensity: 0.9 }));
function ceilingTubes(put, fr) {
  const nu = Math.max(1, Math.round(fr.L / 2.6)), nv = Math.max(1, Math.round(fr.W / 2.6));
  for (let i = 0; i < nu; i++) for (let k = 0; k < nv; k++) {
    put(tubeMat(), Math.min(1.2, fr.L - 0.4), 0.06, 0.04, (i + 0.5) * fr.L / nu, (k + 0.5 - nv / 2) * fr.W / nv, 2.85);
  }
}

function placer(batch, fr, y0) {
  // 以 (u, v) 為中心、底部在 y 的方塊
  const put = (material, du, dv, h, u, v, y = 0, plain = false) => {
    if (y >= 2.2 && isLamp(material)) put.lit = true;              // 這間已經有天花板燈（就不用再自動補）
    const [x, z] = fr.toWorld(u, v);
    const [w, d] = fr.alongX ? [du, dv] : [dv, du];
    (plain ? batch.plain : batch.box).call(batch, material, w, h, d, x, y0 + y + h / 2, z);
  };
  // 任意幾何（例如六角柱）：中心放在 (u, v)，y 是中心高度；rotY 是繞垂直軸旋轉
  put.geo = (material, geo, u, v, y, rotY = 0) => {
    if (y >= 2.2 && isLamp(material)) put.lit = true;
    const [x, z] = fr.toWorld(u, v);
    if (rotY) geo.rotateY(rotY);
    geo.translate(x, y0 + y, z);
    batch.add(material, geo);
  };
  // 登記互動設施：(u, v) 的世界座標；dv 是面向球場的方向（沿 v）
  put.spot = (data, u, v, y, dv = 0, du = 0) => {                 // dv／du：籃框朝哪個方向（沿 v 或沿 u）
    const [x, z] = fr.toWorld(u, v), [x2, z2] = fr.toWorld(u + du, v + dv), d = Math.hypot(x2 - x, z2 - z) || 1;
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
// 中庭「豐盈圓滿」壁畫（依 360 照片 10-2）：白牆、上面一道黃藍弧線；中間一圈彩色圓環和跳舞的人；左「豐盈圓滿」、右「大器今生」（紅色書法字）；兩旁玻璃磚窗
const muralMat = () => once('mural', () => new THREE.MeshLambertMaterial({ map: bigTex(800, 360, (c, w, h) => {
  c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, w, h);
  // 上面的黃藍弧線
  for (const [col, r, lw] of [['#f5c518', 520, 22], ['#2e86de', 500, 14]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(w / 2, 560, r + 120, r, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); }
  // 兩旁玻璃磚窗
  for (const x0 of [8, w - 96]) for (let x = x0; x < x0 + 88; x += 22) for (let y = 120; y < h - 10; y += 22) {
    const g = c.createLinearGradient(x, y, x + 20, y + 20); g.addColorStop(0, '#d6eef0'); g.addColorStop(1, '#9fcfd2'); c.fillStyle = g; c.fillRect(x + 1, y + 1, 20, 20);
  }
  // 中間一圈彩色圓環
  c.lineCap = 'round';
  ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#2e86de', '#8e44ad'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 12; c.beginPath(); c.arc(w / 2, 200, 118 - i * 3, i * 1.05, i * 1.05 + 4.2); c.stroke(); });
  // 跳舞的人（圓環裡）
  for (const [x, col] of [[350, '#e74c3c'], [410, '#27ae60'], [470, '#2e86de']]) {
    c.fillStyle = col; c.beginPath(); c.arc(x, 130, 15, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 10;
    c.beginPath(); c.moveTo(x, 146); c.lineTo(x - 8, 230); c.lineTo(x - 32, 292); c.moveTo(x - 8, 230); c.lineTo(x + 24, 292); c.moveTo(x - 4, 172); c.lineTo(x - 46, 136); c.moveTo(x - 4, 172); c.lineTo(x + 42, 152); c.stroke();
  }
  // 紅色書法字：左「豐盈圓滿」、右「大器今生」
  c.fillStyle = '#d63031'; c.font = '900 50px "DFKai-SB", "BiauKai", "Noto Serif TC", "Noto Sans TC", serif'; c.textAlign = 'center';
  c.fillText('豐盈圓滿', 205, 196); c.fillText('大器今生', w - 205, 196);
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



// 分組桌：一組 2 公尺見方（桌子＋四張椅子），組和組之間、靠牆都留走道（約 0.8～0.9 公尺）；門口正前方不放
function groupTables(put, fr, startU = 2.3) {
  const cols = Math.max(1, Math.min(3, Math.floor((fr.W - 1.8 + 0.8) / 2.8))), rows = Math.max(1, Math.floor((fr.L - startU - 1.0 + 0.8) / 2.8));
  const dp = (curRoom?.doorPts || []).map((d) => fr.toLocal(d.x, d.z));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const u = startU + 1.0 + r * 2.8, v = (c - (cols - 1) / 2) * 2.8;
    if (dp.some(([du, dv]) => Math.abs(du - u) < 1.9 && Math.abs(dv - v) < fr.W / 2 + 0.5 && Math.abs(Math.abs(dv) - fr.W / 2) < 0.6 && Math.abs(v) + 1.0 > fr.W / 2 - 1.9)) continue;   // 門口前面那組不放
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

// 3F 音樂教室二（304，依照片）：紅棕色木地板（黃線、紅線）；前面（西牆）木作櫃＋投影布幕＋推車大電視、旁邊白板，黑色數位鋼琴在門旁邊、
//   老師的白色教具推車堆滿東西、北邊咖啡色布簾；北牆一排綠色布告欄矮櫃，上面放鼓、彩色音管、非洲鼓、電風扇；
//   後面（東邊）一層層木頭階梯舞台（綠色踢腳），最上層兩邊各一組電腦、中間綠色布幕、上面黑色喇叭；舞台上方橢圓形造型天花板
const scheduleMat = () => once('schedule', () => new THREE.MeshLambertMaterial({ emissive: '#ffffff', emissiveIntensity: 0.35, map: bigTex(320, 180, (c, w, h) => {
  c.fillStyle = '#fbfbfb'; c.fillRect(0, 0, w, h);                       // 螢幕上的課表（黃色表頭、格子）
  c.fillStyle = '#f4e27a'; c.fillRect(20, 20, w - 40, 22);
  c.strokeStyle = '#9aa0a6'; c.lineWidth = 1;
  for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(20 + i * (w - 40) / 6, 20); c.lineTo(20 + i * (w - 40) / 6, h - 20); c.stroke(); }
  for (let j = 0; j <= 6; j++) { c.beginPath(); c.moveTo(20, 20 + j * (h - 40) / 6); c.lineTo(w - 20, 20 + j * (h - 40) / 6); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 30; i++) c.fillRect(26 + (i % 6) * (w - 40) / 6, 50 + Math.floor(i / 6) * (h - 40) / 6, 26, 4);
  c.fillStyle = '#3f7a45'; c.fillRect(22, h - 42, (w - 40) / 6 - 4, 20);
}) }));
function musicRoom2(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;               // A：北牆（不靠門）、D：南邊（走廊、門）
  const green = mat('wool', '#2f9a4a'), dkgreen = mat('wool', '#1f4a32'), tread = mat('planks', '#f3dcb0'), wood = mat('planks', '#e8c9a0');
  put(mat('planks', '#c4704a'), L, W, 0.012, L / 2, 0, 0);                     // 紅棕色木地板
  put(mat('wool', '#e8c22a'), 0.05, W - 1.2, 0.004, 3.2, 0, 0.014); put(mat('wool', '#c0392b'), 3.0, 0.05, 0.004, 4.7, D * 0.4, 0.014);
  put(green, L - 0.1, 0.02, 0.95, L / 2, D * (W / 2 - 0.012), 0);            // 南牆（走廊那面）下段綠色
  // 前面：木作櫃（下段深綠門板）、投影布幕、推車上的大電視、白板
  put(wood, 0.45, 4.2, 0.95, 0.24, A * 0.3, 0); put(dkgreen, 0.02, 1.0, 0.6, 0.47, A * 1.6, 0.15); put(dkgreen, 0.02, 1.0, 0.6, 0.47, D * 0.6, 0.15);
  put(M.white(), 0.04, 2.0, 1.45, 0.12, D * 0.55, 1.05); put(scheduleMat(), 0.02, 1.8, 1.0, 0.15, D * 0.55, 1.35, true);   // 投影布幕（投著課表）
  put(M.dark(), 0.5, 0.6, 0.06, 0.9, A * 1.5, 0.05); put(M.grey(), 0.06, 0.06, 1.2, 0.9, A * 1.5, 0.1);
  put(M.dark(), 0.08, 2.0, 1.2, 0.9, A * 1.5, 1.05); put(scheduleMat(), 0.02, 1.9, 1.1, 0.85, A * 1.5, 1.1, true);   // 推車大電視
  put(M.white(), 0.04, 1.1, 0.9, 0.06, D * 2.2, 1.1);                         // 白板
  // 黑色數位鋼琴（門旁邊）＋琴椅
  put(M.dark(), 0.45, 1.35, 0.95, 0.95, D * 1.65, 0); put(M.white(), 0.16, 1.25, 0.03, 1.22, D * 1.65, 0.72);
  put(M.dark(), 0.32, 0.8, 0.45, 1.55, D * 1.65, 0);
  // 老師的白色教具推車（堆滿小東西）、咖啡色布簾、角落置物櫃
  put(M.white(), 0.6, 0.95, 0.55, 2.6, A * 1.3, 0.35); put(M.dark(), 0.6, 0.95, 0.35, 2.6, A * 1.3, 0);
  ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'].forEach((c, i) => put(mat('wool', c), 0.14, 0.14, 0.12 + (i % 3) * 0.08, 2.45 + (i % 2) * 0.28, A * (0.95 + i * 0.13), 0.9));
  put(mat('wool', '#9a7350'), 0.3, 0.55, 2.75, 3.8, A * (W / 2 - 0.35), 0);   // 布簾在北門旁邊
  put(wood, 1.2, 0.4, 2.0, 1.0, A * (W / 2 - 0.22), 0); for (let k = 0; k < 4; k++) put(mat('wool', ['#d9c9a8', '#7a5a3a', '#e8e2d6', '#5a7aa8'][k]), 1.0, 0.3, 0.25, 1.0, A * (W / 2 - 0.25), 0.3 + k * 0.45);
  // 北牆：綠色布告欄矮櫃（木框），上面放樂器
  const cu1 = 3.5, cu2 = L - 1.0;
  put(wood, cu2 - cu1, 0.42, 1.35, (cu1 + cu2) / 2, A * (W / 2 - 0.23), 0);
  for (let u = cu1 + 0.45; u < cu2 - 0.3; u += 0.85) put(dkgreen, 0.7, 0.02, 1.0, u, A * (W / 2 - 0.45), 0.2);
  const top = 1.35;
  for (const [u, c, r, h] of [[cu1 + 0.5, '#c0392b', 0.17, 0.25], [cu1 + 0.9, '#d98a2b', 0.15, 0.22], [cu1 + 2.4, '#7a4a2a', 0.18, 0.55], [cu1 + 2.8, '#a0522d', 0.12, 0.45]])
    put.geo(mat('wool', c), new THREE.CylinderGeometry(r, r * 0.9, h, 12), u, A * (W / 2 - 0.25), top + h / 2);   // 鼓、非洲鼓
  ['#e84393', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f'].forEach((c, i) => put(mat('wool', c), 0.06, 0.06, 0.55 + i * 0.12, cu1 + 1.4 + i * 0.1, A * (W / 2 - 0.25), top));   // 彩色音管
  put(M.white(), 0.32, 0.25, 0.42, cu1 + 1.95, A * (W / 2 - 0.25), top);          // 電風扇
  // 後面：階梯舞台（四層，木頭踏面、綠色踢腳），最上層平台
  const steps = 4, sd = 0.55, platD = 1.6, sh = 0.18;
  for (let k = 0; k < steps; k++) {
    const u0 = L - platD - (steps - 1 - k) * sd, h = sh * (k + 1);
    put(green, L - u0, W - 0.1, h - 0.04, (u0 + L) / 2, 0, 0);
    put(tread, L - u0, W - 0.1, 0.04, (u0 + L) / 2, 0, h - 0.04);
  }
  const ty = sh * steps, uT = L - platD / 2;
  put(mat('wool', '#2fae4a'), 0.08, 2.8, 2.25, L - 0.08, 0, ty);                    // 綠色布幕
  put(M.dark(), 0.3, 0.75, 0.42, L - 0.2, 0, ty + 2.35 > 2.9 ? 2.4 : ty + 1.9);    // 喇叭
  for (const s of [A, D]) {                                                          // 兩邊的電腦
    const v = s * (W / 2 - 1.2);
    put(M.desk(), 0.6, 1.0, 0.05, uT + 0.2, v, ty + 0.7); put(M.metal(), 0.5, 0.9, 0.7, uT + 0.2, v, ty);
    put(M.dark(), 0.05, 0.5, 0.32, uT + 0.42, v, ty + 0.78); put(screenMat(), 0.02, 0.46, 0.28, uT + 0.4, v, ty + 0.8);
  }
  put(M.white(), 0.35, 0.3, 0.6, uT, A * (W / 2 - 0.3), ty);                         // 除濕機
  put(mat('wool', '#7ac943'), 0.35, 0.5, 1.6, uT, D * (W / 2 - 0.35), ty);           // 彩色置物架
  // 橢圓形造型天花板、吸頂電扇
  put.geo(M.white(), new THREE.CylinderGeometry(1, 1, 0.16, 32).scale(1.4, 1, 2.4), L - 3.0, 0, 2.78);
  for (const [u, v] of [[2.0, -1.8], [2.0, 1.8], [5.0, -2.2], [5.0, 2.2]]) put(M.white(), 0.7, 0.7, 0.14, u, v, 2.82);
}

// 3F 美勞教室（311，依照片）：深色木紋拼花地板、淺藍天花板（長條 LED 燈、藍色捲線器）；
//   前面（西牆）整面 OSB 粒片板＋綠色黑板（中間黑色電視），前面老師工作櫃台（堆滿美勞用品）＋電腦桌；
//   後面（東牆）淺藍色牆＋彩虹魚群壁畫＋色相環海報、五個水龍頭的洗手槽；北牆整排木色高櫃（黑色小黑板、開放書櫃，上面放紙黏土大球、三角錐）；
//   南牆（中庭那面）窗戶下一排灰木色抽屜櫃；兩列長桌（灰木紋桌面、白色桌腳、桌下置物格）配木頭圓凳
const osbMat = () => once('osb', () => {
  const t = bigTex(256, 256, (c, w, h) => {
    c.fillStyle = '#c9944e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = ['#b07a3a', '#dcaa64', '#a86c30', '#e2b874'][i % 4]; c.save(); c.translate(Math.random() * w, Math.random() * h); c.rotate(Math.random() * 3); c.fillRect(-9, -3, 18, 6); c.restore(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshLambertMaterial({ map: t });
});
const fishMuralMat = () => once('fishmural', () => new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.3, map: bigTex(700, 200, (c, w, h) => {
  const cols = ['#e53935', '#fb8c00', '#fdd835', '#7cb342', '#26a69a', '#1e88e5', '#5e35b1', '#ec407a'];
  for (let i = 0; i < 260; i++) {                                         // 一條彩虹色的魚群（像一條龍）：左邊細、中間粗
    const t = i / 260, x = 30 + t * 640, y = 100 + Math.sin(t * 7) * 30 - t * 20, r = 10 + Math.sin(t * Math.PI) * 34;
    c.fillStyle = cols[Math.floor(t * 8 + Math.random() * 1.5) % 8];
    c.beginPath(); c.ellipse(x + (Math.random() - 0.5) * r * 1.6, y + (Math.random() - 0.5) * r * 1.6, 9, 5, Math.random() * 3, 0, 7); c.fill();
  }
}) }));
const colorWheelMat = () => once('colorwheel', () => new THREE.MeshLambertMaterial({ map: bigTex(120, 160, (c, w, h) => {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) { c.fillStyle = `hsl(${i * 30},80%,55%)`; c.beginPath(); c.moveTo(60, 80); c.arc(60, 80, 42, i * Math.PI / 6, (i + 1) * Math.PI / 6); c.fill(); }
  c.fillStyle = '#fff'; c.beginPath(); c.arc(60, 80, 16, 0, 7); c.fill();
  c.fillStyle = '#556'; c.fillRect(14, 12, 92, 8); c.fillRect(14, 136, 92, 6);
}) }));
function artRoom3(put, fr, room) {
  const W = fr.W, L = fr.L, N = -1, S = 1;                                        // v：北（櫃子）負、南（窗戶、門）正；u：從西（黑板）往東（洗手槽）
  const cab = mat('wool', '#e6d8bf'), white = M.white(), black = mat('wool', '#1d1f1e');
  put(mat('planks', '#5a4434'), L, W, 0.012, L / 2, 0, 0);                         // 深色木紋地板
  // 西牆：OSB 板、綠色黑板＋電視、電箱、喇叭
  put(osbMat(), 0.03, W - 0.1, 2.9, 0.016, 0, 0);
  put(white, 0.05, 4.5, 1.3, 0.04, N * 0.2, 0.85); put(mat('wool', '#2f5a45'), 0.06, 4.3, 1.15, 0.05, N * 0.2, 0.92);
  put(M.dark(), 0.07, 1.8, 1.05, 0.07, N * 0.2, 0.97); put(screenMat(), 0.02, 1.7, 0.95, 0.1, N * 0.2, 1.02);
  put(M.white(), 0.08, 0.5, 0.6, 0.06, S * 1.9, 2.1); put(M.dark(), 0.18, 0.28, 0.28, 0.1, N * 2.9, 2.45);
  // 老師工作櫃台（堆滿美勞用品）、電腦桌＋網椅
  put(mat('wool', '#d9d6cf'), 0.55, 2.6, 0.82, 1.0, N * 0.7, 0); put(mat('planks', '#e2c79c'), 0.6, 2.7, 0.04, 1.0, N * 0.7, 0.82);
  ['#e53935', '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ff7043', '#f48fb1'].forEach((c, i) => put(mat('wool', c), 0.22, 0.28, 0.08 + (i % 3) * 0.07, 0.95 + (i % 2) * 0.15, N * (1.8 - i * 0.33), 0.86));
  put(M.desk(), 0.7, 1.3, 0.05, 1.2, N * 3.0, 0.72); put(M.metal(), 0.6, 1.2, 0.72, 1.2, N * 3.0, 0);
  put(M.dark(), 0.05, 0.55, 0.36, 1.0, N * 3.0, 0.8); put(screenMat(), 0.02, 0.5, 0.32, 1.03, N * 3.0, 0.82);
  officeChair(put, 1.9, N * 3.0, -1, 0, '#1d1f22');
  // 東牆：淺藍色牆、彩虹魚群壁畫、色相環、洗手槽（五個水龍頭、白色水盆）
  put(mat('wool', '#9fd0ea'), 0.03, W - 0.1, 2.9, L - 0.016, 0, 0);
  put(fishMuralMat(), 0.02, 4.4, 1.25, L - 0.04, N * 0.3, 1.55, true);
  put(colorWheelMat(), 0.02, 0.5, 0.68, L - 0.04, N * 2.5, 1.1, true);
  put(mat('planks', '#cdbb9e'), 0.6, 3.8, 0.82, L - 0.32, N * 0.4, 0); put(mat('wool', '#9ea3a8'), 0.62, 3.8, 0.04, L - 0.32, N * 0.4, 0.82);
  for (let i = 0; i < 5; i++) {
    const v = N * 0.4 + (i - 2) * 0.7;
    put(M.grey(), 0.04, 0.04, 0.28, L - 0.55, v, 0.86); put(M.grey(), 0.18, 0.03, 0.03, L - 0.48, v, 1.12);
    for (let k = 0; k < 3; k++) put(white, 0.18, 0.18, 0.05, L - 0.3, v + 0.25, 0.86 + k * 0.05);
  }
  put(mat('planks', '#8a7a68'), 0.06, 0.95, 2.1, L - 0.04, N * (W / 2 - 0.9), 0);   // 東北角灰色木門（櫃子間）
  // 北牆：木色高櫃（黑色小黑板、開放書櫃），上面放紙黏土大球、三角錐、捲起來的紙
  // 門口（南北兩面）前面櫃子切開，桌子、人才過得去
  const doors = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z));
  const runs = (a, b, sideV) => { const cuts = doors.filter(([u, v]) => v * sideV > 0 && u > a - 1 && u < b + 1).map(([u]) => u).sort((x, y) => x - y); const out = []; let s0 = a;
    for (const u of cuts) { if (u - 1.0 > s0 + 0.4) out.push([s0, u - 1.0]); s0 = Math.max(s0, u + 1.0); } if (b > s0 + 0.4) out.push([s0, b]); return out; };
  const freeN = (u) => runs(u - 0.01, u + 0.01, N).length > 0;
  const u1 = 1.0, u2 = L - 1.4, cv = N * (W / 2 - 0.3);
  for (const [a, b] of runs(u1, u2, N)) {
    put(cab, b - a, 0.55, 2.3, (a + b) / 2, cv, 0);
    for (let u = a + 0.6; u < b; u += 0.6) put(mat('wool', '#cbb999'), 0.015, 0.02, 2.2, u, cv + S * 0.28, 0.05);   // 櫃門分隔線
    put(mat('wool', '#cbb999'), b - a, 0.02, 0.015, (a + b) / 2, cv + S * 0.28, 0.9);
  }
  for (const [u, w] of [[u1 + 4.6, 1.1], [u1 + 7.0, 2.6]]) if (freeN(u - w / 2) && freeN(u + w / 2)) put(black, w, 0.02, 1.15, u, cv + S * 0.28, 1.0);
  put(mat('planks', '#cdb48e'), 1.0, 0.03, 1.2, u1 + 5.85, cv + S * 0.28, 0.95);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) put(mat('wool', ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#ecf0f1'][(i + k) % 5]), 0.14, 0.2, 0.3, u1 + 5.45 + i * 0.2, cv + S * 0.18, 1.0 + k * 0.4);
  const top = 2.3;
  for (const [u, r, c] of [[u1 + 0.6, 0.32, '#e8b07a'], [u1 + 1.3, 0.38, '#7fb3e6'], [u1 + 2.0, 0.33, '#e05a3a'], [u1 + 2.6, 0.3, '#f08a3a']])
    if (freeN(u)) put.geo(mat('wool', c), new THREE.SphereGeometry(r, 12, 10), u, cv, top + r);
  for (const u of [u1 + 4.0, u1 + 4.6]) if (freeN(u)) put.geo(mat('wool', '#f05a28'), new THREE.ConeGeometry(0.16, 0.45, 10), u, cv, top + 0.22);
  put(mat('wool', '#d9c39a'), 2.4, 0.5, 0.12, u1 + 7.5, cv, top);
  // 南牆（窗戶下）：灰木色抽屜櫃
  for (const [a, b] of runs(0.6, L - 0.6, S)) put(mat('planks', '#8f8272'), b - a, 0.42, 0.8, (a + b) / 2, S * (W / 2 - 0.23), 0);
  // 兩列長桌（桌下置物格）＋木頭圓凳（坐在桌子東邊、面向黑板）
  const top2 = mat('planks', '#8a8378'), leg = mat('wool', '#eeeae0'), stool = mat('planks', '#5a3a24');
  // 兩頭（門口那兩段）留橫向走道：從門口進來可以走到中間的直走道（依使用者回報：原本桌子、圓凳把路擋住）
  const du0 = doors.length ? Math.min(...doors.map(([u]) => u)) + 1.2 : 3.2, du1 = doors.length ? Math.max(...doors.map(([u]) => u)) - 1.4 : L - 1.8;
  for (let u = du0; u <= du1; u += 1.8) for (const v of [N * 1.6, S * 1.6]) {           // 靠牆那邊也留得出走道
    put(top2, 0.95, 1.8, 0.05, u, v, 0.76); put(black, 0.85, 1.7, 0.14, u, v, 0.6);
    for (const du of [-0.4, 0.4]) for (const dv of [-0.82, 0.82]) put(leg, 0.07, 0.07, 0.62, u + du, v + dv, 0);
    for (const dv of [-0.55, 0, 0.55]) { put(stool, 0.3, 0.3, 0.04, u + 0.3, v + dv, 0.46); put(stool, 0.04, 0.04, 0.46, u + 0.3, v + dv, 0); }   // 圓凳收在桌子底下，桌子之間留走道
  }
  // 天花板：長條 LED 燈、藍色捲線器
  const led = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#f4fbff', emissiveIntensity: 0.9 });
  for (const v of [-2.6, -0.9, 0.9, 2.6]) put(led, L - 1.0, 0.06, 0.04, L / 2, v, 2.85);
  for (const [u, v] of [[4.0, -1.5], [7.0, 1.5], [10.0, -1.5]]) { put.geo(mat('wool', '#2a5ab0'), new THREE.CylinderGeometry(0.2, 0.2, 0.1, 14).rotateX(Math.PI / 2), u, v, 2.65); put(M.dark(), 0.02, 0.02, 0.9, u, v, 1.75); }
}

// 2F 自然教室一、二（依照片，兩間一樣）：灰白磨石子地、薄荷綠天花板（長條 LED 燈、吸頂電扇）；
//   前面（西牆）OSB 粒片板＋四片白板、兩個小喇叭、右邊一扇木門（準備室）；前面一張大實驗桌（灰色桌身、玻璃木紋桌面）＋右邊老師電腦桌；
//   後面（東牆）薄荷綠牆＋一排六個水龍頭的洗手槽、上面一排自然科海報；北牆整排木色高櫃（中間五張礦物／地球科學海報、上面放紙箱和地球儀）；
//   南牆窗戶下一排灰木色矮櫃；三列實驗桌（灰色桌身、桌下置物格、玻璃木紋桌面），桌子兩端疊著橘色圓凳
const natPosterMat = (k) => once('natposter' + k, () => new THREE.MeshLambertMaterial({ map: bigTex(160, 220, (c, w, h) => {
  const dark = k % 2 === 0;
  c.fillStyle = dark ? '#1d2230' : '#f4f8f2'; c.fillRect(0, 0, w, h);
  c.fillStyle = ['#3a8fd0', '#e8762b', '#7cc38a', '#f2c14e', '#9b7ad6'][k % 5]; c.fillRect(10, 10, w - 20, 34);
  for (let i = 0; i < 6; i++) { c.fillStyle = ['#c9a27a', '#8aa0b8', '#b85a4a', '#d8d0c0', '#6a8a6a', '#a07ac0'][(i + k) % 6]; c.beginPath(); c.ellipse(36 + (i % 2) * 80, 74 + Math.floor(i / 2) * 50, 26, 18, 0, 0, 7); c.fill(); }
  c.fillStyle = dark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.3)'; for (let i = 0; i < 4; i++) c.fillRect(16, 200 - i * 9, w - 32, 4);
}) }));
// 4F 客語教室（鄉土教室，依 360 照片 24）：紅磚紋壁紙、深灰木紋地板；南牆綠色黑板（兩邊各一塊小綠板）、吊掛投影機；
//   西牆（走廊）室內窗＋窗下薄荷綠矮櫃、窗前掛蓑衣和小紅燈籠；北牆四塊綠色布告欄（有台灣地圖）＋下面整排木頭小格櫃、橘色高櫃、櫃頂油紙傘；
//   東牆（外牆）窗戶綠色樹紋捲簾＋窗下矮書櫃（手工藝品）、兩張學生課桌配藍椅；五組深紅色木頭長桌配長板凳；老師電腦桌、黑色辦公椅、橘色講桌櫃
const hakkaBrickMat = (rx = 10, ry = 5) => once('hakkabrick' + rx + 'x' + ry, () => new THREE.MeshLambertMaterial({ map: (() => {
  const t = bigTex(128, 128, (c, w, h) => {
    c.fillStyle = '#efe4dc'; c.fillRect(0, 0, w, h);                              // 白色灰縫
    for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) {
      c.fillStyle = ['#c98c88', '#d19894', '#c4837f', '#cf928c'][(r * 3 + k + 4) % 4];
      c.fillRect(k * 40 + (r % 2) * 20 + 2, r * 16 + 2, 36, 12);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);           // 一格約 0.73m 寬、0.59m 高（磚塊大小跟真的差不多）
  return t;
})() }));
const hakkaBoardMat = (k) => once('hakkaboard' + k, () => new THREE.MeshLambertMaterial({ map: bigTex(160, 130, (c, w, h) => {
  c.fillStyle = '#1f6b4a'; c.fillRect(0, 0, w, h);                               // 綠色布告欄
  if (k === 2) {                                                                  // 台灣地圖海報
    c.fillStyle = '#cfe6f2'; c.fillRect(30, 8, 100, 114);
    c.fillStyle = '#7bb86a'; c.beginPath(); [[96, 14], [104, 24], [102, 44], [96, 64], [88, 84], [80, 104], [76, 116], [70, 100], [64, 82], [66, 60], [74, 40], [84, 24]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();   // 台灣（番薯形）
  } else if (k === 1) {                                                           // 彩色圖片海報
    c.fillStyle = '#fbf3e4'; c.fillRect(34, 10, 92, 112);
    for (let i = 0; i < 9; i++) { c.fillStyle = ['#e8a23a', '#d0584a', '#7ab0d8', '#9ac46a'][i % 4]; c.fillRect(42 + (i % 3) * 28, 22 + Math.floor(i / 3) * 32, 22, 24); }
  } else {                                                                        // 兩張白色學習單
    for (const x of [22, 88]) { c.fillStyle = '#f7f7f2'; c.fillRect(x, 20, 50, 70); c.fillStyle = '#9aa0a6'; for (let i = 0; i < 6; i++) c.fillRect(x + 6, 30 + i * 9, 38, 3); }
  }
  c.strokeStyle = '#c99a5a'; c.lineWidth = 8; c.strokeRect(0, 0, w, h);          // 木框
}) }));
const treeBlindMat = () => once('treeblind', () => new THREE.MeshLambertMaterial({ map: bigTex(128, 160, (c, w, h) => {
  c.fillStyle = '#bfe3cf'; c.fillRect(0, 0, w, h);                               // 淺綠捲簾
  c.strokeStyle = '#2f4a3a'; c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(64, 160); c.lineTo(64, 70); c.stroke();                // 樹幹＋捲捲的樹枝
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(64, 90); c.quadraticCurveTo(64 + s * 40, 70, 64 + s * 30, 40); c.stroke(); c.beginPath(); c.arc(64 + s * 22, 40, 9, 0, 5); c.stroke(); }
  c.fillStyle = '#ffffff'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(14 + (i * 37) % 100, 14 + (i * 23) % 80, 3, 0, 7); c.fill(); }
}) }));
function hakkaRoom(put0, fr, room) {
  // 門在西牆（走廊）：v 的 A＝東（外牆）、D＝西（走廊）；u 改從南邊（黑板）量
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const put = (m, du, dv, h, u, v, y, plain) => put0(m, du, dv, h, L - u, v, y, plain);
  put.geo = (m, g, u, v, y, r) => put0.geo(m, g, L - u, v, y, r);
  const doorU = (room?.doorPts || []).map((d) => L - fr.toLocal(d.x, d.z)[0]);
  const runs = (a, b, g = 0.7) => { const cuts = doorU.filter((u) => u > a - g && u < b + g).sort((x, y) => x - y); const out = []; let s0 = a;
    for (const u of cuts) { if (u - g > s0 + 0.3) out.push([s0, u - g]); s0 = Math.max(s0, u + g); } if (b > s0 + 0.3) out.push([s0, b]); return out; };
  const brick = hakkaBrickMat(), red = mat('wool', '#6e1f22'), redTop = mat('wool', '#7c2428'), orange = mat('wool', '#d9822b');
  const green = mat('wool', '#1f5a3e'), wood = mat('planks', '#c99a5a'), mint = mat('wool', '#a6dccb'), white = M.white();
  put(mat('planks', '#4a4d52'), L, W, 0.012, L / 2, 0, 0);                        // 深灰木紋地板
  // 紅磚紋壁紙：南北兩面整面；東西兩面只貼窗戶下面和上面（西牆門口空出來）
  put(brick, 0.02, W - 0.1, 2.95, 0.012, 0, 0, true); put(brick, 0.02, W - 0.1, 2.95, L - 0.012, 0, 0, true);
  for (const [y0, h] of [[0, 1.0], [2.2, 0.75]]) {
    const bm = (len) => hakkaBrickMat(Math.max(1, Math.round(len / 0.73)), Math.round(h / 0.59 * 10) / 10);
    put(bm(L - 0.1), L - 0.1, 0.02, h, L / 2, A * (W / 2 - 0.012), y0, true);
    for (const [a, b] of y0 ? [[0.05, L - 0.05]] : runs(0.05, L - 0.05)) put(bm(b - a), b - a, 0.02, h, (a + b) / 2, D * (W / 2 - 0.012), y0, true);
  }
  // 南牆：綠色黑板（中間大、兩邊小）、吊掛投影機
  put(M.grey(), 0.05, 3.8, 1.3, 0.03, 0, 0.85); put(green, 0.06, 3.6, 1.15, 0.04, 0, 0.92);
  for (const s of [-1, 1]) { put(M.grey(), 0.05, 1.1, 1.0, 0.03, s * 2.65, 0.95); put(green, 0.06, 1.0, 0.9, 0.04, s * 2.65, 1.0); }
  put(M.dark(), 0.08, 1.9, 1.1, 0.08, 0, 0.95); put(screenMat(), 0.02, 1.8, 1.0, 0.13, 0, 1.0);   // 黑板中間的電子白板（像電視那樣掛在黑板上）
  put(white, 0.4, 0.35, 0.15, 1.6, 0, 2.55); put(M.grey(), 0.04, 0.04, 0.3, 1.6, 0, 2.7);
  // 老師區（東南角）：電腦桌、螢幕、黑色辦公椅、橘色講桌櫃、小摺疊桌
  put(mat('planks', '#e6dcc8'), 0.7, 1.3, 0.74, 1.0, A * (W / 2 - 0.8), 0);
  put(M.dark(), 0.05, 0.5, 0.34, 0.85, A * (W / 2 - 0.8), 0.76); put(screenMat(), 0.02, 0.46, 0.3, 0.88, A * (W / 2 - 0.8), 0.78);
  put(M.dark(), 0.5, 0.5, 0.45, 1.65, A * (W / 2 - 0.8), 0); put(M.dark(), 0.08, 0.5, 0.55, 1.88, A * (W / 2 - 0.8), 0.45);
  put(orange, 0.5, 0.7, 1.0, 0.55, A * 1.5, 0); put(mat('wool', '#c06e20'), 0.52, 0.72, 0.04, 0.55, A * 1.5, 1.0);
  put(mat('planks', '#b5773f'), 0.5, 0.6, 0.7, 2.6, A * (W / 2 - 0.4), 0); put(white, 0.3, 0.4, 0.12, 2.6, A * (W / 2 - 0.4), 0.7);
  // 北牆：四塊綠色布告欄＋下面整排木頭小格櫃、東邊橘色高櫃、櫃頂兩把油紙傘
  const bv = D * 0.5;
  for (let k = 0; k < 4; k++) put(hakkaBoardMat(k), 0.03, 1.15, 0.95, L - 0.04, bv + (k - 1.5) * 1.2, 1.15, true);
  put(mat('wool', '#d9b27a'), 0.38, 4.8, 0.9, L - 0.21, bv, 0);                    // 小格櫃：8 欄 × 2 層，格子裡面是深色，有幾格放東西
  const stuff = ['#d0584a', '#e8c22a', '#7ab0d8', '#9ac46a', '#f2a6b0', '#c9a46a'];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
    const cv = bv - 2.1 + i * 0.6, cy = 0.06 + j * 0.42;
    put(mat('wool', '#5a3e26'), 0.01, 0.52, 0.36, L - 0.405, cv, cy, true);
    if ((i * 3 + j * 5) % 4 === 0) put(mat('wool', stuff[(i + j) % stuff.length]), 0.12, 0.3, 0.16, L - 0.44, cv, cy);   // 露出格子一點點
  }
  put(orange, 0.45, 0.65, 2.15, L - 0.24, bv + 2.75, 0);
  const umb = (col, v) => put.geo(mat('wool', col), new THREE.ConeGeometry(0.45, 0.22, 16), L - 0.5, v, 2.2);
  umb('#c0392b', bv - 1.0); umb('#f2a6b0', bv + 0.2);
  // 西牆（走廊）：窗下薄荷綠矮櫃、蓑衣、小紅燈籠
  for (const [a, b] of runs(0.9, L - 0.9, 1.1)) { put(mint, b - a, 0.45, 0.75, (a + b) / 2, D * (W / 2 - 0.25), 0); put(wood, b - a, 0.47, 0.04, (a + b) / 2, D * (W / 2 - 0.25), 0.75); }
  const straw = mat('wool', '#7a5a3a'), sv = D * (W / 2 - 0.15), su = L * 0.33;
  put(straw, 0.9, 0.05, 0.25, su, sv, 1.95); put(straw, 0.65, 0.05, 0.75, su, sv, 1.2); put(straw, 0.45, 0.05, 0.25, su, sv, 0.95);
  for (const u of [L * 0.5, L * 0.6, L * 0.72]) put.geo(mat('wool', '#d32f2f'), new THREE.SphereGeometry(0.09, 10, 8), u, D * (W / 2 - 0.2), 1.75);
  // 東牆（外牆）：窗戶綠色樹紋捲簾、窗下矮書櫃（手工藝品）、兩張學生課桌＋藍椅
  for (let k = 0; k < 4; k++) put(treeBlindMat(), 1.3, 0.03, 0.75, L * (0.25 + k * 0.17), A * (W / 2 - 0.05), 1.95, true);
  put(wood, L * 0.3, 0.35, 0.8, L * 0.78, A * (W / 2 - 0.2), 0);
  for (let i = 0; i < 6; i++) put(mat('wool', ['#c9a46a', '#d0584a', '#e8c22a', '#8a6a42', '#7ab0d8', '#f2a6b0'][i]), 0.22, 0.2, 0.18, L * 0.66 + i * L * 0.045, A * (W / 2 - 0.22), 0.8);
  for (const u of [L * 0.7, L * 0.82]) {
    put(mat('wool', '#e8e8e4'), 0.5, 0.55, 0.04, u, A * (W / 2 - 0.7), 0.7); put(M.grey(), 0.05, 0.45, 0.7, u, A * (W / 2 - 0.7), 0);
    put(mat('wool', '#2a86c8'), 0.38, 0.36, 0.45, u, A * (W / 2 - 1.2), 0); put(mat('wool', '#2a86c8'), 0.38, 0.05, 0.4, u, A * (W / 2 - 1.36), 0.45);
  }
  // 五組深紅色木頭長桌＋兩條長板凳（長邊沿 u）
  const table = (u, v) => {
    put(redTop, 1.4, 0.85, 0.05, u, v, 0.7);
    for (const du of [-0.6, 0.6]) for (const dv of [-0.33, 0.33]) put(red, 0.06, 0.06, 0.7, u + du, v + dv, 0);
    for (const s of [-1, 1]) { put(redTop, 1.4, 0.28, 0.05, u, v + s * 0.6, 0.4); for (const du of [-0.55, 0.55]) put(red, 0.06, 0.22, 0.4, u + du, v + s * 0.6, 0); }
  };
  // 排成兩直排、中間和兩邊留走道：西排（靠走廊）兩組放在兩扇門中間，門口正前方空出來；東排三組（東北角留給學生課桌）
  const du0 = Math.min(...doorU), du1 = Math.max(...doorU), mid = (du0 + du1) / 2;
  for (const u of [mid - 0.9, mid + 0.9]) table(u, D * 1.5);
  for (const u of [mid - 2.1, mid, mid + 2.1]) table(u, A * 0.95);              // 前後各留 0.7m 走道
  // 白色天花板：長條日光燈、吸頂電扇、冷氣（北邊）
  const tube = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#f4fbff', emissiveIntensity: 0.9 });
  for (const v of [-W * 0.3, 0, W * 0.3]) for (const u of [L * 0.25, L * 0.5, L * 0.75]) put(tube, 1.2, 0.06, 0.04, u, v, 2.85);
  for (const u of [L * 0.35, L * 0.7]) put(white, 0.7, 0.7, 0.1, u, 0, 2.85);
  put(white, 0.25, 0.9, 0.3, L - 0.15, A * 0.6, 2.45);
}
// 3F 方陣教室（科學情境教室，依 360 照片 21）：橘色＋灰色木紋大方格地板、牆下半淺藍綠；南牆一排綠色黑板（兩邊小布告欄）、投影機；
//   北牆綠色布告欄（貼滿學習單）＋一排黃色鐵架推車（藍色、透明收納箱）、直立海報；西牆（窗）北段也有黃色推車、灰色老師櫃台桌（藍籃子）、
//   南段黃色小凳、電風扇、綠色垃圾桶；東牆（走廊）窗下粉紅／淺藍相間矮櫃，上面一台台機器人、機械積木作品（黑色底盤）
const checkerFloorMat = (rx, ry) => once('checker' + rx + 'x' + ry, () => new THREE.MeshLambertMaterial({ map: (() => {
  const t = bigTex(128, 128, (c, w, h) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const orange = (i + j) % 2 === 0;
      c.fillStyle = orange ? '#d08a4a' : '#7d8784'; c.fillRect(i * 64, j * 64, 64, 64);
      c.fillStyle = orange ? 'rgba(120,60,20,.18)' : 'rgba(40,50,50,.2)';              // 木紋
      for (let k = 0; k < 8; k++) c.fillRect(i * 64, j * 64 + k * 8 + (k * 3) % 5, 64, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);                   // 一格 1.2 公尺
  return t;
})() }));
const worksheetBoardMat = () => once('worksheetboard', () => new THREE.MeshLambertMaterial({ map: bigTex(256, 128, (c, w, h) => {
  c.fillStyle = '#1f6b4a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) {
    c.fillStyle = (i + j) % 3 === 0 ? '#f2d64a' : '#cfe8f6'; c.fillRect(8 + i * 35, 10 + j * 58, 28, 46);
    c.fillStyle = 'rgba(60,60,60,.45)'; for (let k = 0; k < 4; k++) c.fillRect(12 + i * 35, 18 + j * 58 + k * 9, 20, 3);
  }
  c.strokeStyle = '#c99a5a'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
}) }));
function phalanxRoom(put0, fr, room) {
  // 門在東牆（走廊）：v 的 A＝西（外牆窗戶）、D＝東（走廊）；u 改從南邊（黑板）量
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const put = (m, du, dv, h, u, v, y, plain) => put0(m, du, dv, h, L - u, v, y, plain);
  put.geo = (m, g, u, v, y, r) => put0.geo(m, g, L - u, v, y, r);
  const doorU = (room?.doorPts || []).map((d) => L - fr.toLocal(d.x, d.z)[0]);
  const runs = (a, b, g = 0.7) => { const cuts = doorU.filter((u) => u > a - g && u < b + g).sort((x, y) => x - y); const out = []; let s0 = a;
    for (const u of cuts) { if (u - g > s0 + 0.3) out.push([s0, u - g]); s0 = Math.max(s0, u + g); } if (b > s0 + 0.3) out.push([s0, b]); return out; };
  const teal = mat('wool', '#a8dcd6'), yellow = mat('wool', '#f2c81e'), white = M.white(), green = mat('wool', '#1f5a3e');
  put(checkerFloorMat(Math.round(W / 2.4), Math.round(L / 2.4)), L, W, 0.012, L / 2, 0, 0, true);   // 橘灰大方格木紋地板
  // 牆下半淺藍綠（東牆門口空出來）
  put(teal, 0.02, W - 0.1, 1.0, 0.012, 0, 0, true); put(teal, 0.02, W - 0.1, 1.0, L - 0.012, 0, 0, true);
  put(teal, L - 0.1, 0.02, 1.0, L / 2, A * (W / 2 - 0.012), 0, true);
  for (const [a, b] of runs(0.05, L - 0.05)) put(teal, b - a, 0.02, 1.0, (a + b) / 2, D * (W / 2 - 0.012), 0, true);
  // 南牆：一排綠色黑板（三塊）、兩邊小布告欄、投影機、喇叭
  put(M.grey(), 0.05, 4.6, 1.25, 0.03, 0, 0.85);
  for (let k = -1; k <= 1; k++) put(green, 0.06, 1.48, 1.15, 0.04, k * 1.5, 0.9);
  for (const s of [-1, 1]) { put(mat('wool', '#2a6a4a'), 0.05, 0.75, 0.9, 0.04, s * (W / 2 - 0.55), 1.0); put(M.dark(), 0.15, 0.2, 0.25, 0.1, s * (W / 2 - 0.3), 2.4); }
  put(M.dark(), 0.12, 2.0, 0.06, 0.12, 0, 0.8);                                   // 粉筆槽
  put(white, 0.35, 0.3, 0.14, 1.8, 0, 2.6); put(M.grey(), 0.04, 0.04, 0.3, 1.8, 0, 2.72);
  // 北牆：綠色布告欄（學習單）＋黃色鐵架推車、直立海報
  for (let k = 0; k < 3; k++) put(worksheetBoardMat(), 0.03, 1.25, 0.85, L - 0.04, D * 0.3 + (k - 1) * 1.3, 1.45, true);
  const bins = [mat('wool', '#2a6ad0'), mat('glass')], cart = (u, v, alongU) => {
    const [du, dv] = alongU ? [0.7, 0.45] : [0.45, 0.7];
    for (const y of [0.08, 0.5, 0.92]) put(yellow, du, dv, 0.04, u, v, y);           // 三層架子
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(yellow, 0.04, 0.04, 1.0, u + a * (du / 2 - 0.02), v + b * (dv / 2 - 0.02), 0.04);
    for (const y of [0.12, 0.54]) put(bins[((u * 7 + v * 3 + y * 10) | 0) % 2 ? 1 : 0], du - 0.1, dv - 0.1, 0.3, u, v, y);   // 收納箱
    put(M.dark(), du - 0.1, dv - 0.1, 0.04, u, v, 0);                                // 輪子
  };
  for (let k = 0; k < 6; k++) cart(L - 0.3, D * (W / 2 - 1.1) + A * k * 0.75, false);
  put(mat('wool', '#7ab0d8'), 0.04, 0.6, 1.5, L - 0.3, D * (W / 2 - 0.35), 0.1);     // 直立海報
  // 西牆（窗）：北段黃色推車、灰色老師櫃台桌（藍籃子）；南段黃色小凳、電風扇、綠色垃圾桶
  for (let k = 0; k < 2; k++) cart(L - 1.15 - k * 0.75, A * (W / 2 - 0.3), true);
  const du0 = L - 3.3, dv0 = A * (W / 2 - 0.55);
  put(mat('wool', '#9aa0a6'), 1.4, 0.7, 0.95, du0, dv0, 0); put(mat('wool', '#b8bdc2'), 1.45, 0.75, 0.04, du0, dv0, 0.95);
  for (let k = 0; k < 3; k++) put(mat('wool', '#2a6ad0'), 0.3, 0.25, 0.18, du0 - 0.45 + k * 0.45, dv0, 0.99);
  put(M.dark(), 0.05, 0.4, 0.3, du0, dv0 - A * 0.1, 0.99);
  put(yellow, 0.4, 0.4, 0.45, 0.9, A * (W / 2 - 0.4), 0); put(white, 0.3, 0.3, 0.45, 1.5, A * (W / 2 - 0.35), 0);
  put(mat('wool', '#43a047'), 0.3, 0.3, 0.4, 2.0, A * (W / 2 - 0.3), 0);
  // 東牆（走廊）：窗下粉紅／淺藍相間矮櫃＋機器人作品
  const pink = mat('wool', '#f2b8c6'), blue = mat('wool', '#a8c8ec'), robotCols = ['#f2c81e', '#9aa0a6', '#2a6ad0', '#e65100'];
  let ri = 0;
  for (const [a, b] of runs(0.9, L - 0.9, 0.9)) {
    const cv = D * (W / 2 - 0.3), n = Math.max(1, Math.round((b - a) / 0.6));
    for (let k = 0; k < n; k++) put(k % 2 ? blue : pink, (b - a) / n - 0.02, 0.55, 0.8, a + (k + 0.5) * (b - a) / n, cv, 0);
    put(mat('planks', '#b5773f'), b - a, 0.58, 0.04, (a + b) / 2, cv, 0.8);
    for (let u = a + 0.4; u < b - 0.3; u += 0.7) {
      put(M.dark(), 0.5, 0.35, 0.06, u, cv, 0.84);                                   // 黑色底盤
      const col = mat('wool', robotCols[ri++ % 4]);
      put(col, 0.18, 0.18, 0.16, u - 0.08, cv, 0.9); put(col, 0.08, 0.08, 0.2, u + 0.1, cv - 0.05, 0.9);   // 機器人／積木
      put(M.grey(), 0.25, 0.03, 0.03, u, cv + 0.08, 1.06);
    }
  }
  // 白色天花板：日光燈、吸頂電扇、冷氣
  const tube = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#f4fbff', emissiveIntensity: 0.9 });
  for (const v of [-W * 0.28, 0, W * 0.28]) for (const u of [L * 0.25, L * 0.5, L * 0.75]) put(tube, 1.2, 0.06, 0.04, u, v, 2.85);
  for (const u of [L * 0.35, L * 0.7]) put(mat('wool', '#d8c49a'), 0.7, 0.7, 0.1, u, A * 0.4, 2.85);
  put(white, 0.25, 0.9, 0.3, L - 0.15, A * 1.6, 2.45);
}
// 倉鼠「奶茶」（依照片）：灰色毛、背上深灰條紋、白色肚子和臉頰、粉紅色耳朵、黑眼睛；
//   透明塑膠飼養箱，裡面鋪木屑和白色紙棉，薄荷綠食盆、不鏽鋼飲水管、透明小屋
function hamsterCage(put, u, v, y) {
  const clear = once('hamGlass', () => new THREE.MeshLambertMaterial({ color: '#e6f4ff', transparent: true, opacity: 0.22, depthWrite: false }));
  const Lc = 0.62, Wc = 0.42, Hc = 0.3;                                          // 箱子：沿 u 長、沿 v 寬
  put(mat('wool', '#e8d6ae'), Lc - 0.02, Wc - 0.02, 0.05, u, v, y);              // 木屑
  for (const [du, dv] of [[-0.18, 0.1], [0.05, -0.12], [0.2, 0.12], [-0.05, 0.02]]) put(mat('wool', '#f6f6f2'), 0.12, 0.1, 0.025, u + du, v + dv, y + 0.05);   // 白色紙棉
  put(clear, Lc, Wc, Hc, u, v, y);                                               // 透明箱子
  put(mat('wool', '#a8dcc6'), 0.12, 0.12, 0.04, u + 0.17, v - 0.1, y + 0.05);     // 薄荷綠食盆
  put(mat('wool', '#c8a060'), 0.08, 0.08, 0.02, u + 0.17, v - 0.1, y + 0.09);     // 盆裡的飼料
  put(M.grey(), 0.02, 0.02, 0.2, u + 0.22, v + 0.17, y + 0.12);                   // 不鏽鋼飲水管
  put(clear, 0.16, 0.14, 0.12, u - 0.2, v - 0.1, y + 0.05);                       // 透明小屋
  // 奶茶（臉朝 +u，蹲在食盆旁；比實際放大一點，才看得清楚）
  const g = mat('wool', '#9a9a9c'), dk = mat('wool', '#6e6e72'), wt = mat('wool', '#eeeeea'), hy = y + 0.05, k = 1.7;
  const p = (m, du, dv, h, ou, ov, oy) => put(m, du * k, dv * k, h * k, u - 0.02 + ou * k, v + 0.04 + ov * k, hy + oy * k);
  p(wt, 0.13, 0.1, 0.05, 0, 0, 0);                                               // 白色肚子
  p(g, 0.13, 0.1, 0.06, 0, 0, 0.04);                                             // 身體
  p(dk, 0.11, 0.025, 0.006, 0, 0, 0.1);                                          // 背上的深色條紋
  p(g, 0.06, 0.08, 0.06, 0.08, 0, 0.03);                                         // 頭
  p(wt, 0.03, 0.06, 0.03, 0.105, 0, 0.02);                                       // 白色臉頰、嘴巴
  p(mat('wool', '#f2b8b8'), 0.01, 0.015, 0.02, 0.112, 0, 0.035);                 // 粉紅鼻子
  for (const s of [-1, 1]) {
    p(M.dark(), 0.012, 0.012, 0.012, 0.106, s * 0.028, 0.06);                    // 黑眼睛
    p(mat('wool', '#e8a8a8'), 0.012, 0.022, 0.025, 0.065, s * 0.03, 0.09);       // 粉紅耳朵
  }
}
function natureRoom(put0, fr, room) {
  // 前後鏡射（依使用者說明）：白板在東、洗手槽在西 → 下面的 u 都從東邊量
  const Lm = fr.L, put = (m, du, dv, h, u, v, y, plain) => put0(m, du, dv, h, Lm - u, v, y, plain);
  put.geo = (m, g, u, v, y, r) => put0.geo(m, g, Lm - u, v, y, r);
  // 櫃子沿牆排，但門口那一段要空出來（兩邊的門都在同樣的 u 附近）
  const doorU = (room?.doorPts || []).map((d) => Lm - fr.toLocal(d.x, d.z)[0]);
  const runs = (a, b) => { const cuts = doorU.filter((u) => u > a - 0.9 && u < b + 0.9).sort((x, y) => x - y); const out = []; let s0 = a;
    for (const u of cuts) { if (u - 0.9 > s0 + 0.3) out.push([s0, u - 0.9]); s0 = Math.max(s0, u + 0.9); } if (b > s0 + 0.3) out.push([s0, b]); return out; };
  const W = fr.W, L = fr.L, A = fr.away, D = -A;                                 // A：北（櫃子）、D：南（窗戶、門）；u：西（白板）→ 東（洗手槽）
  const grey = mat('wool', '#a9adb2'), glassTop = mat('wool', '#e8d2a4'), cab = mat('wool', '#e3d4bb'), white = M.white();
  put(mat('tile', '#cfd0cc'), L, W, 0.012, L / 2, 0, 0);                         // 磨石子地
  // 西牆：OSB 板、白板、喇叭、準備室木門
  put(osbMat(), 0.03, W - 0.1, 2.9, 0.016, 0, 0);
  put(M.grey(), 0.05, 3.4, 1.15, 0.04, A * 0.2, 1.0); put(white, 0.06, 3.3, 1.05, 0.05, A * 0.2, 1.05);
  put(M.dark(), 0.08, 1.5, 0.88, 0.08, A * 0.2, 1.1); put(screenMat(), 0.02, 1.42, 0.8, 0.13, A * 0.2, 1.14);   // 白板中間的大電視
  for (const dv of [-1.2, 1.2]) put(white, 0.14, 0.28, 0.2, 0.08, A * 0.2 + dv, 2.35);
  put(mat('planks', '#8a7a68'), 0.06, 0.95, 2.1, 0.04, A * (W / 2 - 1.3), 0);
  // 前面：大實驗桌（玻璃木紋桌面）、老師電腦桌
  put(grey, 1.0, 1.8, 0.82, 1.6, D * 0.3, 0); put(glassTop, 1.1, 1.9, 0.05, 1.6, D * 0.3, 0.82);   // 門口要走得進來：桌子往中間收
  if (room?.name === '自然教室二') hamsterCage(put, 1.6, D * 0.95, 0.87);          // 竹竹老師養的倉鼠「奶茶」：放在電視前大實驗桌的一端
  put(mat('planks', '#d8c8ae'), 0.8, 1.3, 0.74, 0.65, A * 1.6, 0); put(mat('planks', '#e6d8c0'), 0.85, 1.4, 0.04, 0.65, A * 1.6, 0.74);
  put(M.dark(), 0.05, 0.55, 0.36, 0.5, A * 1.6, 0.82); put(screenMat(), 0.02, 0.5, 0.32, 0.53, A * 1.6, 0.84);
  put(M.dark(), 0.4, 0.2, 0.42, 0.65, A * 1.1, 0.78); put(mat('wool', '#d32f2f'), 0.3, 0.12, 0.3, 0.65, A * 2.1, 0.78);
  // 東牆：薄荷綠牆、洗手槽（六個水龍頭）、自然科海報、電風扇
  put(mat('wool', '#8fd3bf'), 0.03, W - 0.1, 2.9, L - 0.016, 0, 0);
  put(mat('planks', '#dccab0'), 0.6, 4.2, 0.82, L - 0.32, A * 0.4, 0); put(M.grey(), 0.62, 4.2, 0.04, L - 0.32, A * 0.4, 0.82);
  for (let i = 0; i < 6; i++) { const v = A * 0.4 + (i - 2.5) * 0.68; put(M.grey(), 0.04, 0.04, 0.3, L - 0.55, v, 0.86); put(M.grey(), 0.16, 0.03, 0.03, L - 0.48, v, 1.14); }
  put(mat('wool', '#43a047'), 0.25, 0.4, 0.12, L - 0.35, A * 0.9, 0.86);
  for (let k = 0; k < 5; k++) put(natPosterMat(k + 5), 0.02, 0.6, 0.85, L - 0.04, A * 0.4 + (k - 2) * 0.75, 1.55, true);
  put(natPosterMat(1), 0.02, 0.8, 0.6, L - 0.04, A * 2.8, 1.35, true);
  put(white, 0.4, 0.4, 0.9, L - 0.5, A * (W / 2 - 0.6), 0);
  // 北牆：木色高櫃＋五張礦物海報（黑框）、櫃頂紙箱、地球儀
  const cabRuns = runs(0.5, L - 1.1);
  for (const [a, b] of cabRuns) {
    put(cab, b - a, 0.55, 2.3, (a + b) / 2, A * (W / 2 - 0.3), 0);
    for (let u = a + 0.6; u < b; u += 0.6) put(mat('wool', '#cbb999'), 0.015, 0.02, 2.2, u, A * (W / 2 - 0.58), 0.05);
  }
  // 礦物海報掛在最長那段櫃子上（不會掛到門口懸空）
  const [ra, rb] = cabRuns.reduce((x, y) => (y[1] - y[0] > x[1] - x[0] ? y : x), [0, 0]);
  const np = Math.min(5, Math.floor((rb - ra) / 0.78)), pc = (ra + rb) / 2;
  for (let k = 0; k < np; k++) put(natPosterMat(k), 0.66, 0.03, 0.9, pc + (k - (np - 1) / 2) * 0.78, A * (W / 2 - 0.59), 1.3, true);
  for (let k = 0; k < 4; k++) put(mat('wool', '#c9a46a'), 0.6, 0.45, 0.4, L - 4.2 + k * 0.65, A * (W / 2 - 0.3), 2.3);
  put.geo(mat('wool', '#3a8fd0'), new THREE.SphereGeometry(0.2, 14, 10), 0.7, A * (W / 2 - 0.3), 2.52);
  // 南牆：窗戶下灰木色矮櫃
  for (const [a, b] of runs(1.5, L - 1.5)) put(mat('planks', '#8f8272'), b - a, 0.42, 0.8, (a + b) / 2, D * (W / 2 - 0.23), 0);
  // 三列實驗桌（長邊沿 u），兩端疊橘色圓凳
  const stoolTop = mat('wool', '#f07a4a'), stoolLeg = mat('wool', '#1d1d1d');
  const stack = (u, v) => { for (let k = 0; k < 3; k++) put(stoolTop, 0.34, 0.34, 0.05, u, v, 0.3 + k * 0.12); for (const d of [-0.13, 0.13]) put(stoolLeg, 0.03, 0.03, 0.62, u + d, v + d, 0); };
  // 靠牆兩列各兩張、中間一列三張（門口那段不放桌子，才走得進來）
  for (const [u, v] of [[3.7, A * 2.2], [6.0, A * 2.2], [3.7, 0], [6.0, 0], [8.3, 0], [3.7, D * 2.2], [6.0, D * 2.2]]) {
    put(grey, 1.85, 0.95, 0.75, u, v, 0); put(mat('wool', '#d6d8da'), 1.7, 0.85, 0.3, u, v, 0.3);   // 桌身＋置物格
    put(glassTop, 2.0, 1.05, 0.05, u, v, 0.75);
    for (const dv of [-0.22, 0.22]) stack(u + 1.25, v + dv);
  }
  // 薄荷綠天花板、長條 LED 燈、吸頂電扇
  put(mat('wool', '#a7dcc9'), L, W, 0.02, L / 2, 0, 2.93);
  const led = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#f4fbff', emissiveIntensity: 0.9 });
  for (const v of [-2.4, -0.8, 0.8, 2.4]) put(led, L - 1.0, 0.06, 0.04, L / 2, v, 2.85);
  for (const u of [3.0, 6.0, 9.0]) if (u < L - 0.6) put(white, 0.6, 0.6, 0.12, u, A * 1.5, 2.8);
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
  //   （門開在兩端：吧台和櫃子放在兩扇門中間，不擋門）
  put(mat('planks', '#9a7048'), 2.6, 0.5, 1.02, 3.75, D * (W / 2 - 0.4), 0);
  put(mat('wool', '#1b1b1b'), 2.6, 0.6, 0.06, 3.75, D * (W / 2 - 0.45), 1.02);
  put(mat('wool', '#b9bdc2'), 0.6, 0.55, 0.9, 2.75, D * (W / 2 - 0.45), 1.08);
  put(mat('planks', '#8a6040'), 1.3, 0.5, 1.2, 5.8, D * (W / 2 - 0.3), 0);
  put(mat('wool', '#e0c58a'), 0.6, 0.45, 0.35, 5.6, D * (W / 2 - 0.3), 1.2);
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
  // ---- 依 360 照片（10-1、10-2）補的：思源樓前的彩繪貓咪大花盆（山蘇）＋蕨類吊盆、生態池前的磚紅色步道、壁畫兩旁兩棵高松樹 ----
  {
    const brick = mat('wool', '#c27a5a'), pondZ = (pd ? ((pd[1] + pd[3]) / 2 - P.ORIGIN[1]) / P.PX_PER_M : (m.z1 + m.z2) / 2);
    const pondX2 = pd ? (pd[2] - P.ORIGIN[0]) / P.PX_PER_M : m.x1 + 3.3;
    box(brick, 1.4, 0.02, m.z2 - m.z1 - 3, pondX2 + 0.9, 0, (m.z1 + m.z2) / 2);            // 生態池前面南北向的磚紅色步道
    for (let z = m.z1 + 2; z < m.z2 - 1.5; z += 0.7) box(mat('wool', '#a8654a'), 1.4, 0.022, 0.03, pondX2 + 0.9, 0, z);   // 步道磚縫
    // 壁畫兩旁的高松樹
    for (const dz of [-5, 5]) {
      const px = pondX2 + 3.6, pz = pondZ + dz;
      box(mat('log', '#ffffff'), 0.5, 12, 0.5, px, 0, pz);
      for (let k = 0; k < 7; k++) { const wdt = 4.2 - k * 0.5, y = 3 + k * 1.3; box(mat('leaves'), wdt, 0.8, wdt * 0.4, px, y, pz); box(mat('leaves'), wdt * 0.4, 0.8, wdt, px, y, pz); }
      box(mat('leaves'), 0.7, 1.0, 0.7, px, 12, pz);
    }
    // 思源樓前（中庭西側、生態池北邊）：兩個彩繪貓咪大花盆夾著入口，種山蘇
    const catPot = (x, z, k) => {
      geo(mat('wool', '#8a8f96'), new THREE.CylinderGeometry(0.42, 0.3, 1.6, 12), x, 0.8, z);
      geo(mat('wool', '#f2f0ea'), new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), x, 0.03, z);         // 白色小石子座
      // 卡通貓（畫在花盆朝東那面）：身體條紋、大眼睛、尖耳朵
      const cols = k ? ['#f2c14e', '#e74c3c', '#2e86de'] : ['#f7f2e8', '#f39c12', '#8e44ad'];
      for (let i = 0; i < 5; i++) box(mat('wool', cols[i % 3]), 0.04, 0.12, 0.42, x + 0.39, 0.25 + i * 0.14, z);
      box(mat('wool', cols[0]), 0.04, 0.34, 0.5, x + 0.4, 1.0, z);
      for (const s of [-1, 1]) { box(M.white(), 0.03, 0.12, 0.12, x + 0.43, 1.12, z + s * 0.11); box(M.dark(), 0.03, 0.06, 0.06, x + 0.45, 1.12, z + s * 0.11); box(mat('wool', cols[0]), 0.04, 0.14, 0.1, x + 0.38, 1.35, z + s * 0.18); }
      box(mat('wool', '#f28aa0'), 0.03, 0.05, 0.08, x + 0.45, 1.0, z);
      // 山蘇（一圈往外翹的寬葉子）
      for (let i = 0; i < 8; i++) { const lf = new THREE.BoxGeometry(0.9, 0.04, 0.22); lf.translate(0.45, 0, 0); lf.rotateZ(0.7); lf.rotateY(i * Math.PI / 4); geo(mat('wool', '#4f9a3a'), lf, x, 1.55, z); }
    };
    const cz0 = pondZ - 6.8;
    catPot(m.x1 + 2.4, cz0 - 0.9, 0); catPot(m.x1 + 2.4, cz0 + 0.9, 1);             // 放在階梯底下（不擋階梯）
    // 蕨類吊盆：掛在思源樓一樓走廊外牆（藍綠欄杆下面），一排，生態池那段不掛
    for (let z = m.z1 + 2.5; z < m.z2 - 2; z += 1.6) {
      if (Math.abs(z - pondZ) < 4.2 || Math.abs(z - cz0) < 1.6) continue;
      geo(mat('wool', '#b85a3a'), new THREE.CylinderGeometry(0.16, 0.11, 0.2, 10), m.x1 + 0.18, 1.45, z);
      for (let i = 0; i < 5; i++) { const lf = new THREE.BoxGeometry(0.45, 0.03, 0.1); lf.translate(0.22, 0, 0); lf.rotateZ(-0.5); lf.rotateY(i * Math.PI * 2 / 5); geo(mat('wool', '#5aa83e'), lf, m.x1 + 0.18, 1.62, z); }
    }
  }
  return b;
}

// 牆面塗裝：窗戶上下兩段（不擋窗），門那一側不貼（不擋門）
// 牆面下段油漆在門口要斷開（不然會像一塊板子擋在門口；依使用者回報思科教室）；上段在門楣上面，不用斷
let curRoom = null;
function paintBands(put, fr, material) {
  const W = fr.W, L = fr.L, A = fr.away;
  const dp = (curRoom?.doorPts || []).map((d) => fr.toLocal(d.x, d.z));
  const cut = (a, b, ds) => { const out = []; let s0 = a; for (const d of ds.sort((x, y) => x - y)) { if (d - 0.85 > s0 + 0.1) out.push([s0, d - 0.85]); s0 = Math.max(s0, d + 0.85); } if (b > s0 + 0.1) out.push([s0, b]); return out; };
  for (const [y0, h] of [[0, 1.0], [2.2, 0.78]]) {
    const low = y0 === 0;
    for (const [uw, near] of [[0.012, (u) => u < 0.6], [L - 0.012, (u) => u > L - 0.6]]) {
      for (const [a, b] of cut(-(W / 2 - 0.05), W / 2 - 0.05, low ? dp.filter(([u]) => near(u)).map(([, v]) => v) : [])) put(material, 0.02, b - a, h, uw, (a + b) / 2, y0);
    }
    for (const [a, b] of cut(0.05, L - 0.05, low ? dp.filter(([, v]) => v * A > W / 2 - 0.6).map(([u]) => u) : [])) put(material, b - a, 0.02, h, (a + b) / 2, A * (W / 2 - 0.012), y0);
  }
}
const ballMat = (c) => mat('wool', c);
function ball(put, u, v, y, r, color) { put.geo(ballMat(color), new THREE.SphereGeometry(r, 10, 8), u, v, y + r); }

const marbleMat = () => once('marble', () => new THREE.MeshLambertMaterial({ map: bigTex(128, 128, (c, w, h) => {
  c.fillStyle = '#f2f1ee'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(120,120,125,.35)'; c.lineWidth = 2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(i * 30 - 20, 0); c.bezierCurveTo(i * 30 + 10, 40, i * 30 - 30, 80, i * 30 + 20, h); c.stroke(); }
}) }));
const healthPosterMat = () => once('healthposter', () => new THREE.MeshLambertMaterial({ map: bigTex(256, 160, (c, w, h) => {
  c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, w, h);                              // 白板＋衛教海報
  for (let i = 0; i < 6; i++) { const x = 10 + (i % 3) * 82, y = 12 + Math.floor(i / 3) * 74; c.fillStyle = ['#fde2b8', '#cfe8f6', '#f7d0d8', '#d8f0c8', '#fff4b0', '#e8d8f6'][i]; c.fillRect(x, y, 72, 64); c.fillStyle = ['#e8762b', '#2e86de', '#d63a5a', '#27ae60', '#c9a400', '#8e44ad'][i]; c.fillRect(x + 6, y + 6, 60, 10); c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) c.fillRect(x + 6, y + 24 + k * 9, 52, 4); }
  c.strokeStyle = '#b8bcc0'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
}) }));
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
    const u = 1.2 + k * 1.6, v = A * (W / 2 - 1.05);                    // 窗下有矮櫃，桌子往裡面一點
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
  put(marbleMat(), 0.04, 1.8, 0.9, 1.72, D * (W / 2 - 1.6), 0.02);                 // 正面大理石（依 360 照片）
  put(marbleMat(), 0.7, 1.9, 0.04, 1.4, D * (W / 2 - 1.6), 0.95);
  put(M.dark(), 0.05, 0.5, 0.32, 1.25, D * (W / 2 - 1.6), 1.0); put(screenMat(), 0.02, 0.46, 0.28, 1.275, D * (W / 2 - 1.6), 1.02);
  chairAt(put, 0.7, D * (W / 2 - 1.6), false);
  // 白色高櫃、水槽檯面、藥櫃紅十字
  put(M.white(), 0.5, 1.8, 2.1, 0.27, A * (W / 2 - 1.0), 0);
  put(M.red(), 0.02, 0.3, 0.1, 0.53, A * (W / 2 - 1.0), 1.6); put(M.red(), 0.02, 0.1, 0.3, 0.53, A * (W / 2 - 1.0), 1.5);
  put(M.white(), 1.6, 0.55, 0.88, L - 3.0, D * (W / 2 - 0.3), 0);
  // ---- 依 360 照片 11 補的 ----
  // 東牆：灰色冰箱、白板（衛教海報）、玻璃門書櫃
  put(mat('wool', '#8a8f96'), 0.65, 0.6, 1.6, L - 0.35, 0, 0);
  put(healthPosterMat(), 0.03, 1.4, 0.9, L - 0.03, D * 1.4, 1.0, true);
  const bkv = D * 2.7;
  put(mat('planks', '#d8c4a0'), 0.4, 1.0, 2.0, L - 0.22, bkv, 0);
  for (let i = 0; i < 4; i++) put(mat('wool', ['#2e86de', '#e74c3c', '#27ae60', '#f39c12'][i]), 0.05, 0.8, 0.28, L - 0.43, bkv, 0.3 + i * 0.45);   // 書本
  put(mat('glass'), 0.02, 0.96, 1.9, L - 0.43, bkv, 0.05);
  // 西牆：白色高衣櫃、長沙發椅
  put(M.white(), 0.55, 1.2, 2.2, 0.3, 0, 0);
  put(M.grey(), 0.02, 0.02, 1.9, 0.58, -0.02, 0.15);
  put(mat('wool', '#d8c4a0'), 0.6, 1.15, 0.4, 0.35, A * 1.22, 0); put(mat('wool', '#5a6068'), 0.58, 1.12, 0.1, 0.35, A * 1.22, 0.4);
  put(mat('wool', '#d8c4a0'), 0.1, 1.15, 0.45, 0.08, A * 1.22, 0.4);
  // 南牆（窗下）一整排矮櫃
  put(mat('wool', '#ece6da'), L - 3.4, 0.45, 0.85, (L - 2.6) / 2 + 0.4, A * (W / 2 - 0.23), 0);
  put(mat('planks', '#c9a87a'), L - 3.4, 0.47, 0.04, (L - 2.6) / 2 + 0.4, A * (W / 2 - 0.23), 0.85);
  // 指針式體重計（紅色底座）
  const ds = 5.4, dsv = D * (W / 2 - 0.5);
  put(M.red(), 0.5, 0.4, 0.1, ds, dsv, 0); put(M.grey(), 0.08, 0.08, 1.0, ds, dsv + A * 0.12, 0.1);
  put.geo(M.white(), new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20).rotateX(Math.PI / 2), ds, dsv + A * 0.12, 1.2);
  // 推車（藥品用品）
  const cu = L - 4.6, cv = A * (W / 2 - 0.8);
  for (const y of [0.15, 0.55, 0.9]) put(M.metal(), 0.5, 0.4, 0.03, cu, cv, y);
  for (const [a, c] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(M.metal(), 0.03, 0.03, 0.9, cu + a * 0.23, cv + c * 0.18, 0.05);
  for (let i = 0; i < 4; i++) put(mat('wool', ['#ffffff', '#7ab0d8', '#e74c3c', '#f2c81e'][i]), 0.1, 0.08, 0.14, cu - 0.15 + i * 0.1, cv, 0.93);
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
    const uEnd = rv === A * (W / 2 - 2.2) ? L - 1.6 : L - 0.4;            // 中間那排東邊留走道，才走得到靠窗那排
    for (let u = 0.6; u < uEnd; u += 1.2) {
      for (const [du, dv] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]]) put(M.white(), 0.04, 0.04, 2.0, u + du, rv + dv, 0);
      for (const y of [0.15, 0.7, 1.25, 1.8]) {
        put(M.white(), 1.15, 0.55, 0.03, u, rv, y);
        if (y < 1.7) for (let i = 0; i < 4; i++) ball(put, u - 0.4 + i * 0.27, rv - 0.1 + (i % 2) * 0.2, y + 0.03, 0.11, ballCols[k++ % ballCols.length]);
        else put(mat('wool', '#d8b77a'), 0.6, 0.45, 0.35, u, rv, y + 0.03);   // 頂層紙箱
      }
    }
  }
  // 藍色籃子裝滿球
  for (let i = 0; i < 2; i++) {                                            // 兩個就好，東邊留路進去
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

// 1F 圖書館（依 360 照片 04、05 和 10-19 新照片 11 張）：
//   前段（西）：入口（南牆）旁圓弧借還書櫃台（淡紫桌面、電腦、事務機、電話）、西牆整面白色高書櫃；北牆一扇門通多元文化走廊，
//     門上方貓頭鷹時鐘、門旁「新書區」書櫃、窗下電腦檯（三台電腦）與紫外線殺菌櫃；中間一道 S 形白色矮書櫃（蝴蝶貼紙、正面展示新書）
//   中段：彩色圓筒閱讀小屋、圓形座椅（藍綠坐墊、下面書櫃、黃綠花台＋乾枝花藝）、前面兩道弧形白色展示台（學生紙盒作品）；
//     南北兩牆高書櫃；天花板一條彎彎的彩虹帶＋一圈圈白色圓形造型板
//   後段（東）：亮面橘色木地板、北牆和東牆架高木平台＋深色木書櫃、白色雙面書櫃、綠色幸運草小凳
function library(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;                                   // u：西→東；A＝北（多元文化走廊那側）、D＝南（入口、溪口情廊）
  const doors = (room?.doorPts || []).map((d) => [...fr.toLocal(d.x, d.z), d.side]);
  const doorU = doors.map(([u]) => u), nDoor = doors.find((d) => d[2] === 'N'), sDoor = doors.find((d) => d[2] === 'S');
  const freeAt = (u, half, side) => doors.every(([du, , s]) => s !== side || Math.abs(du - u) > half + 0.8);
  const ds = (geo, m, u, v, y) => put.geo(m, geo, u, v, y);
  const dbl = (c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
  const shelfW = mat('wool', '#f6f4ee'), woodTrim = mat('planks', '#e8d4b0');
  const z1 = 8.6, z2 = 15.3;                                                       // 前段／中段、中段／後段分界
  put(mat('tile', '#eadfca'), z2, W, 0.012, z2 / 2, 0, 0);                          // 米色塑膠地板
  put(mat('planks', '#ffffff'), L - z2, W, 0.012, (z2 + L) / 2, 0, 0);             // 後段橘色木地板
  const tallShelf = (u, v, alongU, len) => {                                        // 白色高書櫃（木邊）＋書
    const [du, dv] = alongU ? [len, 0.38] : [0.38, len];
    put(shelfW, du, dv, 2.3, u, v, 0);
    put(booksMat(), alongU ? len - 0.1 : 0.05, alongU ? 0.05 : len - 0.1, 2.0, u + (alongU ? 0 : (u < L / 2 ? 0.2 : -0.2)), v + (alongU ? (v > 0 ? -0.2 : 0.2) : 0), 0.15, true);
  };
  /* ---- 前段 ---- */
  tallShelf(0.2, 0, false, W - 0.6);                                                // 西牆整面高書櫃
  // 圓弧借還書櫃台（入口西邊）
  const cu = 1.7, cv = D * 1.7;
  ds(new THREE.CylinderGeometry(1.25, 1.25, 0.95, 24, 1, true, Math.PI * 0.15, Math.PI * 0.9), dbl('#c9cdd2'), cu, cv, 0.475);
  ds(new THREE.CylinderGeometry(1.35, 1.35, 0.05, 24, 1, false, Math.PI * 0.15, Math.PI * 0.9), mat('wool', '#b8b0dc'), cu, cv, 0.97);
  put(M.dark(), 0.4, 0.2, 0.42, cu + 0.2, cv + A * 0.4, 1.0); put(screenMat(), 0.02, 0.5, 0.32, cu + 0.32, cv + A * 0.4, 1.05);
  put(white(), 0.5, 0.45, 0.35, cu - 0.2, cv + A * 1.0, 1.0);                       // 事務機
  officeChair(put, cu - 0.6, cv, 1, 0, '#2b2d31');
  // 北牆：門（通多元文化走廊）、上方貓頭鷹時鐘、「新書區」書櫃、窗下電腦檯＋三台電腦、紫外線殺菌櫃
  const nu = nDoor ? nDoor[0] : 2.6;
  put.geo(mat('wool', '#5a3a22'), new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20).rotateX(Math.PI / 2), nu + 1.05, A * (W / 2 - 0.08), 2.45);
  put.geo(white(), new THREE.CylinderGeometry(0.15, 0.15, 0.07, 20).rotateX(Math.PI / 2), nu + 1.05, A * (W / 2 - 0.1), 2.45);
  put(woodTrim, 0.9, 0.35, 2.2, nu + 1.6, A * (W / 2 - 0.2), 0); put(booksMat(), 0.8, 0.05, 1.9, nu + 1.6, A * (W / 2 - 0.39), 0.15, true);
  put(mat('wool', '#7a2a3a'), 0.25, 0.03, 0.9, nu + 2.2, A * (W / 2 - 0.05), 1.4);    // 「新書區」直式牌
  put(woodTrim, 4.0, 0.55, 0.85, nu + 4.6, A * (W / 2 - 0.3), 0);
  put(white(), 0.5, 0.4, 0.6, nu + 2.9, A * (W / 2 - 0.3), 0.85);                   // 紫外線殺菌櫃
  for (let k = 0; k < 3; k++) { put(M.dark(), 0.45, 0.05, 0.36, nu + 3.8 + k * 0.75, A * (W / 2 - 0.35), 0.88); put(screenMat(), 0.42, 0.02, 0.32, nu + 3.8 + k * 0.75, A * (W / 2 - 0.38), 0.9); }
  for (let k = 0; k < 3; k++) put.geo(mat('wool', '#c9cdd2'), new THREE.ConeGeometry(0.16, 0.35, 12), nu + 3.6 + k * 1.2, A * (W / 2 - 0.5), 2.3);   // 吊燈
  // S 形白色矮書櫃（正面展示新書、蝴蝶）：南北向、短一點（使用者 10-20：原本東西向橫在中間擋路）
  const N = 8, sv0 = D * 1.7, sv1 = A * 1.3, su = 6.0;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, f = (t) => [su + Math.sin(t * Math.PI * 1.6) * 0.45, sv0 + (sv1 - sv0) * t];
    const [ua, va] = f(t0), [ub, vb] = f(t1), len = Math.hypot(ub - ua, vb - va), ang = Math.atan2(vb - va, ub - ua);
    const g = new THREE.BoxGeometry(len + 0.04, 1.0, 0.42); g.rotateY(fr.alongX ? -ang : Math.PI / 2 - ang);
    ds(g, shelfW, (ua + ub) / 2, (va + vb) / 2, 0.5);
    if (i % 3 === 1) { const g2 = new THREE.BoxGeometry(0.35, 0.45, 0.02); g2.rotateY(fr.alongX ? -ang : Math.PI / 2 - ang); g2.translate(0, 0, 0.22); ds(g2, mat('wool', ['#e74c3c', '#2a4a8a', '#3fa36a', '#f2c14e'][i % 4]), (ua + ub) / 2, (va + vb) / 2, 0.55); }
  }
  // 南牆高書櫃（入口那段空出來）
  for (let u = 0.9; u < z1 - 0.2; u += 1.2) if (freeAt(u, 0.6, 'S') && !(u < 3.2)) tallShelf(u, D * (W / 2 - 0.2), true, 1.18);   // 只到前段（中段圓筒小屋旁邊要留走道）
  /* ---- 中段：彩色圓筒閱讀小屋＋圓形座椅 ---- */
  const bu = 12.0, bv = D * 0.3;
  ds(new THREE.CylinderGeometry(1.05, 1.05, 0.4, 24), booksMat(), bu, bv, 0.2);
  ds(new THREE.CylinderGeometry(1.08, 1.08, 0.08, 24), mat('wool', '#1fa59a'), bu, bv, 0.44);
  ds(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16), mat('wool', '#d8e070'), bu, bv, 0.68);
  for (let i = 0; i < 9; i++) { const a = i * 0.7, g = new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4); g.rotateZ(Math.sin(a) * 0.25); g.rotateX(Math.cos(a) * 0.25); ds(g, mat('wool', '#b8642a'), bu, bv, 1.5); }
  for (let i = 0; i < 3; i++) ds(new THREE.SphereGeometry(0.11, 8, 6), mat('wool', '#c0182a'), bu + (i - 1) * 0.12, bv, 1.15 + i * 0.12);
  // 圓形座椅西邊一座白色展示台，上面學生紙盒作品（四周留走道）
  put(shelfW, 0.5, 1.3, 1.05, 9.3, D * 0.3, 0);
  for (let k = 0; k < 3; k++) put(mat('wool', ['#2a6ad0', '#d32f2f', '#f2c14e'][k]), 0.4, 0.36, 0.35, 9.3, D * 0.3 + (k - 1) * 0.42, 1.05);
  for (const [u, v, col, seat] of [[9.6, A * 2.4, '#f2df6a', '#b8162a'], [14.4, A * 2.4, '#f6b8cc', '#6a3a8a'], [9.3, D * 2.6, '#8fd0ec', '#6a3a8a'], [14.8, D * 2.6, '#bfe07a', '#b8162a'], [12.0, A * 2.7, '#c9b4e6', '#6a3a8a']]) {
    const face = Math.atan2(bv - v, bu - u), g = new THREE.CylinderGeometry(0.8, 0.8, 2.3, 24, 1, true, 0, Math.PI * 1.55);
    g.rotateY(-face - Math.PI * 0.775 + Math.PI / 2);
    ds(g, dbl(col), u, v, 1.15);
    ds(new THREE.CylinderGeometry(0.72, 0.72, 0.4, 20), mat('wool', '#f4f0e6'), u, v, 0.2);
    ds(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 20), mat('wool', seat), u, v, 0.43);
  }
  // 天花板：彎彎的彩虹帶＋白色圓形造型板
  const rb = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];
  for (let i = 0; i < 40; i++) {
    const t = i / 40, u = 3.5 + t * 11, v = Math.sin(t * Math.PI * 2.2) * 1.4;
    rb.forEach((col, k) => put(new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 }), 0.3, 0.06, 0.1, u, v + (k - 3) * 0.06, 2.75));
  }
  for (const [u, v, r] of [[5, 1.5, 0.9], [7.5, -1.2, 1.1], [10, 1.3, 1.0], [12.5, -1.0, 1.2], [14.5, 1.0, 0.9]]) ds(new THREE.CylinderGeometry(r, r, 0.08, 24), white(), u, v, 2.8);
  /* ---- 後段：架高木平台＋深色木書櫃 ---- */
  const plat = mat('planks', '#e8c890'), dark = mat('planks', '#6a3a22');
  put(plat, L - z2, 2.0, 0.2, (z2 + L) / 2, A * (W / 2 - 1.0), 0);
  for (let u = z2 + 0.5; u < L - 0.4; u += 1.0) { put(dark, 0.98, 0.42, 2.2, u, A * (W / 2 - 0.22), 0.2); put(booksMat(), 0.9, 0.05, 2.0, u, A * (W / 2 - 0.44), 0.3, true); }
  put(plat, 2.0, W - 2.0, 0.2, L - 1.0, D * 1.0, 0);
  for (let w = -(W / 2 - 2.5); w <= W / 2 - 0.6; w += 1.0) { const v = D * w; put(dark, 0.42, 0.98, 2.2, L - 0.22, v, 0.2); put(booksMat(), 0.05, 0.9, 2.0, L - 0.44, v, 0.3, true); }
  for (let u = z2 + 1.0; u < L - 3.2; u += 2.2) { put(shelfW, 0.45, 1.3, 1.6, u, D * 1.0, 0); put(booksMat(), 0.47, 1.2, 1.3, u, D * 1.0, 0.15, true); }
  const clover = (u, v) => { for (const [a, b] of [[-0.22, 0], [0.22, 0], [0, -0.22], [0, 0.22]]) ds(new THREE.CylinderGeometry(0.26, 0.26, 0.42, 14), mat('wool', '#3fb36a'), u + a, v + b, 0.21); };
  clover(z2 + 1.6, A * 0.6); clover(z2 + 3.6, A * 0.4);
  function white() { return M.white(); }
}

// 1F 幸運方塘（自造基地，依 360 照片 06）：兩組弧形淺色長桌＋紅、白造型椅；北牆木格書櫃（材料、作品）；
//   兩端窗下檯面擺 3D 印表機、紙箱；雷射切割機、白板、冷氣、投影機
function makerRoom(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const top = mat('wool', '#e8dcc0'), legM = mat('wool', '#c9cdd2'), red = mat('wool', '#e8422a'), white = mat('wool', '#f2f2f0'), wood = mat('planks', '#e2c79a');
  put(mat('tile', '#f2efe8'), L, W, 0.012, L / 2, 0, 0);
  // 北牆木格書櫃
  for (let u = 1.0; u < L - 1.0; u += 1.0) {
    put(wood, 0.98, 0.38, 2.2, u, A * (W / 2 - 0.2), 0);
    for (let k = 0; k < 4; k++) put(k % 2 ? booksMat() : mat('wool', ['#d0584a', '#7ab0d8', '#f2c81e', '#c9a46a'][(k + Math.round(u)) % 4]), 0.8, 0.05, 0.3, u, A * (W / 2 - 0.4), 0.15 + k * 0.52, true);
  }
  // 兩端（東、西牆）窗下檯面＋3D 印表機＋紙箱
  // 兩端窗下檯面（轉 90 度後是南北兩頭）；放在東半邊（A），西南角的門口空出來
  for (const u of [0.3, L - 0.3]) {
    const cv = A * 0.9;
    put(wood, 0.55, W * 0.45, 0.85, u, cv, 0); put(mat('wool', '#d8c49a'), 0.58, W * 0.45, 0.04, u, cv, 0.85);
    for (const dv of [-0.7, 0.5]) { put(M.dark(), 0.4, 0.4, 0.45, u, cv + dv, 0.89); put(mat('wool', '#e8762b'), 0.3, 0.3, 0.02, u, cv + dv, 1.0); }
    put(mat('wool', '#c9a46a'), 0.4, 0.5, 0.35, u, cv - A * 1.6, 0);
  }
  // 雷射切割機（北牆書櫃前）、白板（東牆）
  put(M.dark(), 1.0, 0.7, 0.9, L * 0.55, A * (W / 2 - 0.85), 0);
  put(mat('wool', '#e8e8e4'), 0.03, 1.6, 1.0, L - 0.03, A * 1.2, 1.0);
  // 兩組弧形長桌（兩段斜接成弧形），兩邊配紅、白造型椅
  const chair = (u, v, k) => { const m = k % 2 ? red : white; put(m, 0.42, 0.42, 0.06, u, v, 0.44); put(m, 0.42, 0.06, 0.42, u, v + (v > 0 ? 0.2 : -0.2), 0.48); for (const [a, b] of [[-0.15, -0.15], [0.15, 0.15], [-0.15, 0.15], [0.15, -0.15]]) put(mat('wool', '#c8a070'), 0.03, 0.03, 0.44, u + a, v + b, 0); };
  let ck = 0;
  //   兩組中間留約 1 公尺走道（原本兩組接成一整排，加上兩頭的窗下檯面，門的另一半邊整個走不過去）
  for (const gu of [2.5, L - 2.5]) {
    for (const s of [-1, 1]) {
      const a = s * 0.28, cu = gu + s * 0.87, cv = 0.25;
      const g = new THREE.BoxGeometry(1.8, 0.05, 0.8); g.rotateY(a); put.geo(top, g, cu, cv, 0.72);
      for (const [lu, lv] of [[-0.75, -0.3], [0.75, 0.3], [-0.75, 0.3], [0.75, -0.3]]) put(legM, 0.05, 0.05, 0.72, cu + lu * Math.cos(a) + lv * Math.sin(a), cv + lv * Math.cos(a) - lu * Math.sin(a), 0);
      for (const t of [-0.55, 0.55]) for (const side of [-1, 1]) chair(cu + t * Math.cos(a) + side * 0.65 * Math.sin(a), cv + side * 0.65 * Math.cos(a) - t * Math.sin(a), ck++);
    }
  }
  // 冷氣、投影機
  put(M.white(), 0.25, 1.0, 0.3, L * 0.6, A * (W / 2 - 0.15), 2.5);
  put(M.white(), 0.35, 0.3, 0.14, L * 0.5, 0, 2.7);
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

// 活動中心（依 360 照片 22）：淺色楓木地板＋白線籃球場、藍線（羽球／排球）；東邊舞台：木紋板框、深紅布幕（金色流蘇）、
//   背板（學校標誌、藍色浪花）、兩顆喇叭、紅色計分板；兩個主籃框從天花板吊下來（藍色護墊）；南北兩面牆各四個掛牆練習籃框；
//   牆邊靠著摺疊桌椅推車、海報。天花板（米白波浪板、鋼架、圓燈）在 app.js（放在天花板群組，鳥瞰時會拿掉）
const gymMapleMat = (rx, ry) => once('gymmaple' + rx + 'x' + ry, () => new THREE.MeshLambertMaterial({ map: (() => {
  const t = bigTex(128, 128, (c, w, h) => {                                       // 淺色楓木地板：一條條窄木條（一格 2 公尺）
    for (let i = 0; i < 16; i++) { c.fillStyle = ['#ecd2a2', '#e6c993', '#f0d9ad', '#e2c48c'][(i * 5) % 4]; c.fillRect(0, i * 8, w, 8); }
    c.fillStyle = 'rgba(150,110,60,.25)'; for (let i = 0; i < 16; i++) { c.fillRect(0, i * 8, w, 1); c.fillRect(((i * 37) % 100) + 10, i * 8, 1, 8); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
})() }));
const gymBlueMat = () => once('gymblue', () => new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, map: bigTex(1024, 560, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(40,80,200,.9)'; c.lineWidth = 6;
  for (const x0 of [60, 540]) {                                                   // 兩個橫向的小球場（羽球／排球）
    c.strokeRect(x0, 40, 420, h - 80);
    c.beginPath(); c.moveTo(x0 + 210, 40); c.lineTo(x0 + 210, h - 40); c.stroke();
    for (const dx of [130, 290]) { c.beginPath(); c.moveTo(x0 + dx, 40); c.lineTo(x0 + dx, h - 40); c.stroke(); }
  }
}) }));
const stageBackMat = () => once('stageback', () => new THREE.MeshLambertMaterial({ map: bigTex(512, 200, (c, w, h) => {
  c.fillStyle = '#1c2236'; c.fillRect(0, 0, w, h);                               // 深藍背板
  c.fillStyle = '#e8762b'; c.beginPath(); c.arc(w * 0.6, 60, 28, 0, 7); c.fill();  // 學校標誌（橘色圓）
  c.fillStyle = '#f4f4f0'; c.font = 'bold 26px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.fillText('溪口國小', w * 0.42, 66);
  for (let i = 0; i < 3; i++) {                                                   // 藍色浪花
    c.fillStyle = ['#3a8fd0', '#5fb0e6', '#bfe3f5'][i]; c.beginPath(); c.moveTo(w * 0.2, h);
    for (let x = w * 0.2; x <= w * 0.8; x += 8) c.lineTo(x, h - 50 + i * 14 + Math.sin(x / 18 + i) * 10);
    c.lineTo(w * 0.8, h); c.closePath(); c.fill();
  }
}) }));
function gym(put, fr) {
  const W = fr.W, L = fr.L;   // 活動中心門在東西，u 是南北向（0＝北牆）；這裡改用 v（東西向）擺球場，v 越大越東
  put(gymMapleMat(Math.round(W / 2), Math.round(L / 2)), L, W, 0.012, L / 2, 0, 0, true);   // 淺色楓木地板
  // 籃球場線（28 × 15 公尺）＋藍色小球場線
  const CL = Math.min(28, W - 12), CW = Math.min(15, L - 2), cv = -2.5;
  put(gymCourtMat(), CW, CL, 0.01, L / 2, cv, 0.015, true);
  put(gymBlueMat(), CW + 1, CL - 2, 0.01, L / 2, cv, 0.017, true);
  // 舞台（東邊）：木紋板框（中間是舞台口）、台面前緣深咖啡色
  // 舞台縮小（依使用者說明）：舞台口兩側木紋板只到舞台邊，南北兩頭留通道，從東邊兩扇門可以走到甲梯
  const vp = W / 2 - 4.2, ow = 9, oh = 4.0, sw = 11, panel = mat('planks', '#b8673a');
  put(mat('wool', '#4a2a1e'), sw, 0.6, 1.0, L / 2, vp - 0.3, 0);                 // 台前緣
  put(M.wood(), sw, W / 2 - vp, 1.0, L / 2, (vp + W / 2) / 2, 0);               // 台面
  for (const s of [-1, 1]) {
    const a = L / 2 + s * ow / 2, b = L / 2 + s * (sw / 2 + 0.3);
    put(panel, Math.abs(b - a), 0.3, 6.5, (a + b) / 2, vp, 0);                    // 舞台口兩側的木紋板
    put(M.dark(), 0.45, 0.4, 0.7, L / 2 + s * (ow / 2 + 0.8), vp - 0.35, 4.3);              // 喇叭
  }
  put(panel, ow, 0.3, 6.5 - 1.0 - oh, L / 2, vp, 1.0 + oh);                      // 舞台口上方
  put(M.dark(), ow - 1, 0.04, 0.5, L / 2, vp - 0.17, 5.6);                            // 上方的黑色長條
  put(new THREE.MeshLambertMaterial({ color: '#d32f2f', emissive: '#b01818', emissiveIntensity: 0.6 }), 0.9, 0.05, 0.4, L / 2 - (ow / 2 + 0.95), vp - 0.17, 2.6);   // 紅色計分板
  // 布幕：深紅色，兩邊拉開、上面一排帷幔＋金色流蘇；後面是背板
  const red = mat('wool', '#7a1420');
  for (const s of [-1, 1]) put(red, 2.4, 0.15, oh, L / 2 + s * (ow / 2 - 1.2), vp + 0.4, 1.0);
  put(red, ow, 0.15, 0.7, L / 2, vp + 0.3, 1.0 + oh - 0.7);
  put(mat('wool', '#d9a93a'), ow, 0.16, 0.08, L / 2, vp + 0.3, 1.0 + oh - 0.78);
  put(stageBackMat(), ow - 1, 0.05, 3.2, L / 2, W / 2 - 0.2, 1.0, true);
  for (const s of [-1, 1]) put(panel, 0.3, W / 2 - vp, 6.5, L / 2 + s * (sw / 2 + 0.15), (vp + W / 2) / 2, 0);   // 舞台兩側的牆（後台和通道隔開）
  // 兩個主籃框：從天花板吊下來（吊桿＋玻璃籃板、藍色護墊），標準高度 3.05 公尺
  const half = CL / 2, blue = mat('wool', '#1f4fb8');
  for (const s of [-1, 1]) {
    const v = cv + s * (half - 1.2);
    for (const du of [-0.7, 0.7]) put(M.dark(), 0.08, 0.08, 6.4 - 3.9, L / 2 + du, v + s * 0.25, 3.9);   // 吊桿
    put(M.dark(), 1.8, 0.6, 0.1, L / 2, v + s * 0.1, 3.85);                          // 籃板上面的橫架
    put(mat('glass'), 1.8, 0.04, 1.05, L / 2, v, 2.8);                              // 玻璃籃板
    put(blue, 1.8, 0.1, 0.16, L / 2, v, 2.72);                                      // 下緣藍色護墊
    for (const du of [-0.9, 0.9]) put(blue, 0.08, 0.1, 1.05, L / 2 + du, v, 2.8);
    put(M.white(), 0.6, 0.05, 0.45, L / 2, v - s * 0.03, 2.95);                     // 籃板上的白框
    put(mat('wool', '#e65100'), 0.45, 0.45, 0.03, L / 2, v - s * 0.28, 3.05);       // 籃框（朝球場）
    put.spot({ kind: 'hoop' }, L / 2, v - s * 0.28, 3.05, -s);                      // 可以投籃
  }
  // 南北兩面牆：各四個掛牆練習籃框（白色籃板），面向球場
  for (const [u0, s] of [[0.05, 1], [L - 0.05, -1]]) for (const v of [-15, -7, 1, 9]) {
    put(M.grey(), 0.3, 0.08, 0.08, u0 + s * 0.15, v, 2.7);                          // 支架
    put(M.white(), 0.05, 1.1, 0.75, u0 + s * 0.32, v, 2.4);                         // 籃板
    put(mat('wool', '#e65100'), 0.38, 0.38, 0.03, u0 + s * 0.55, v, 2.6);           // 籃框
    put.spot({ kind: 'hoop' }, u0 + s * 0.55, v, 2.6, 0, s);
  }
  // 牆邊：摺疊桌椅推車、海報
  for (const [u, v] of [[0.45, -19], [0.45, -11], [L - 0.45, -11], [L - 0.45, 5]]) {
    put(M.grey(), 0.5, 1.6, 1.3, u, v, 0); put(mat('wool', '#5a6068'), 0.52, 1.62, 0.05, u, v, 0.2);
  }
  for (const [u, v, k] of [[0.12, -17, 0], [L - 0.12, 13, 1]]) put(mat('wool', ['#9ac46a', '#7ab0d8'][k]), 0.05, 0.9, 1.6, u, v, 0);   // 靠牆立著的海報板（不擋窗）
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

// 1F 校長室（依 10-19 新照片 10 張）：深木紋地板；西端會議區——西牆大電視＋玻璃門矮櫃（L 型延伸到北牆，上面咖啡機、飲水機、茶葉袋）、
//   淺木色會議桌（黑色桌腳）＋8 張灰色網椅；北牆由西到東：灰木紋高櫃、白色門（茶水間）、玻璃獎盃展示櫃、白色玻璃白板（紅色春聯、
//   上方框裱書法、校長漫畫立牌）；南牆窗戶（斑馬捲簾）下米色沙發組＋白色桌巾茶几、電風扇、立燈；入口白色門（玻璃磚條）；
//   東端校長辦公區：木條地板架高一階、東牆整面淺木色高櫃、圓弧木頭大辦公桌（玻璃桌面）、黑色皮椅（紅色指揮官背心）、
//   青花瓷檯燈、電腦、事務機、桌前木框黑皮客椅、紅色小椅子、圓形小邊桌、東南角深色高櫃
const glassBoardMat = () => once('glassboard', () => new THREE.MeshLambertMaterial({ map: bigTex(512, 256, (c, w, h) => {
  c.fillStyle = '#e4f0ee'; c.fillRect(0, 0, w, h);                                // 白色玻璃白板（淡淡的綠）
  c.fillStyle = '#d32f2f'; c.fillRect(40, 30, 52, 190);                             // 紅色春聯
  c.fillStyle = '#1d1d1d'; c.font = '900 40px "DFKai-SB", "Noto Serif TC", serif'; c.textAlign = 'center';
  ['今', '馬', '熊', '讚'].forEach((ch, i) => c.fillText(ch, 66, 70 + i * 44));
  c.fillStyle = '#f4e6e0'; c.fillRect(110, 34, 50, 120); c.fillStyle = '#e8762b'; c.fillRect(114, 40, 42, 20); c.fillStyle = '#7ab0d8'; for (let i = 0; i < 4; i++) c.fillRect(116, 70 + i * 18, 38, 10);   // 海報
  // 校長漫畫立牌：圓臉、眼鏡、白襯衫、比讚
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(430, 140, 46, 100, 0, 0, 7); c.fill();
  c.fillStyle = '#f2c9a0'; c.beginPath(); c.arc(430, 74, 30, 0, 7); c.fill();
  c.fillStyle = '#2b2b2b'; c.fillRect(402, 44, 56, 14);
  c.strokeStyle = '#2b2b2b'; c.lineWidth = 3; c.beginPath(); c.arc(419, 76, 8, 0, 7); c.arc(441, 76, 8, 0, 7); c.stroke();
  c.fillStyle = '#e8eef4'; c.fillRect(408, 106, 44, 70); c.fillStyle = '#2a4a8a'; c.fillRect(410, 176, 40, 50);
}) }));
function principalOffice(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;                                    // u：西→東；A＝北（不靠門）、D＝南（窗戶、門）
  const pale = mat('planks', '#d8c8ac'), greyWood = mat('planks', '#9a8f84'), deskWood = mat('planks', '#c07a3a');
  const beige = mat('wool', '#ece2d2'), black = mat('wool', '#202226'), white = M.white();
  const doorU = (room.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]);
  put(mat('planks', '#7a634e'), L, W, 0.012, L / 2, 0, 0);                          // 深木紋地板
  /* ---- 西端：會議區 ---- */
  // 西牆：大電視＋玻璃門矮櫃（L 型轉到北牆），上面咖啡機、飲水機、茶葉袋
  put(pale, 0.5, W - 2.0, 0.85, 0.27, A * 1.0, 0);
  for (let i = 0; i < 9; i++) put(mat('glass'), 0.02, 0.5, 0.7, 0.53, A * 1.0 - (W - 2.0) / 2 + 0.3 + i * 0.6, 0.1);
  put(M.dark(), 0.07, 2.1, 1.2, 0.05, A * 0.6, 1.25); put(tvMat(), 0.08, 2.0, 1.1, 0.08, A * 0.6, 1.3, true);
  put(pale, 2.2, 0.5, 0.85, 1.6, A * (W / 2 - 0.27), 0);
  put(mat('wool', '#d32f2f'), 0.3, 0.3, 0.38, 1.0, A * (W / 2 - 0.3), 0.85);       // 紅色咖啡機
  put(white, 0.4, 0.35, 0.45, 1.6, A * (W / 2 - 0.3), 0.85);                        // 飲水機
  for (const du of [0, 0.25]) put(mat('wool', '#4aa84a'), 0.2, 0.12, 0.42, 2.2 + du, A * (W / 2 - 0.3), 0.85);   // 綠色茶葉袋
  // 北牆：灰木紋高櫃、白色門（茶水間）、玻璃獎盃展示櫃、白色玻璃白板
  put(greyWood, 1.2, 0.55, 2.5, 3.3, A * (W / 2 - 0.28), 0);
  put(white, 0.95, 0.06, 2.1, 4.5, A * (W / 2 - 0.02), 0);                          // 白色門（關著）
  put(mat('wool', '#c9c9c4'), 0.08, 0.04, 0.08, 4.85, A * (W / 2 - 0.06), 1.0);
  put(greyWood, 0.8, 0.55, 2.6, 5.5, A * (W / 2 - 0.28), 0);                         // 展示櫃
  put(mat('glass'), 0.7, 0.02, 1.5, 5.5, A * (W / 2 - 0.56), 0.95);
  for (let i = 0; i < 6; i++) put(mat('wool', ['#f1e3c0', '#d4a017', '#e8e2d4'][i % 3]), 0.22, 0.12, 0.24, 5.3 + (i % 2) * 0.4, A * (W / 2 - 0.35), 1.0 + Math.floor(i / 2) * 0.48);
  put(glassBoardMat(), 2.0, 0.03, 1.0, 7.0, A * (W / 2 - 0.03), 1.0, true);
  put(mat('wool', '#3a2a1a'), 0.6, 0.04, 0.5, 6.7, A * (W / 2 - 0.03), 2.15); put(mat('wool', '#f4f0e6'), 0.45, 0.05, 0.36, 6.7, A * (W / 2 - 0.05), 2.22);   // 框裱書法
  // 會議桌＋8 張灰色網椅
  const mu = 2.9, mv = A * 0.9;                                                     // 會議桌長邊南北向（依使用者更正：轉 90 度）
  put(mat('wool', '#e6ddcc'), 1.2, 2.6, 0.05, mu, mv, 0.74);
  for (const dv of [-1.15, 1.15]) put(black, 1.0, 0.06, 0.74, mu, mv + dv, 0);
  for (const dv of [-0.85, 0, 0.85]) for (const s of [-1, 1]) officeChair(put, mu + s * 0.95, mv + dv, -s, 0, '#55595e');
  for (const s of [-1, 1]) officeChair(put, mu, mv + s * 1.65, 0, -s, '#55595e');
  // 南牆窗下：米色沙發組＋白色桌巾茶几、電風扇、立燈（避開門）
  const su = 2.3, sv = D * (W / 2 - 0.5);
  put(beige, 2.0, 0.8, 0.42, su, sv, 0); put(beige, 2.0, 0.2, 0.42, su, sv + D * 0.3, 0.42);
  for (const s of [-1, 1]) put(beige, 0.22, 0.8, 0.25, su + s * 0.9, sv, 0.42);
  for (const du of [-0.45, 0.45]) put(mat('wool', '#c9a46a'), 0.4, 0.15, 0.36, su + du, sv + D * 0.15, 0.45);   // 金色靠枕
  put(beige, 0.85, 0.85, 0.42, 0.7, D * 1.0, 0); put(beige, 0.2, 0.85, 0.4, 0.38, D * 1.0, 0.42);   // 單人沙發（靠西）
  put(white, 1.2, 0.7, 0.42, su, D * (W / 2 - 1.55), 0); put(mat('wool', '#f6f4ee'), 1.25, 0.75, 0.03, su, D * (W / 2 - 1.55), 0.42);   // 茶几＋桌巾
  put(white, 0.08, 0.08, 1.2, 3.6, D * (W / 2 - 0.4), 0); put.geo(white, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16).rotateX(Math.PI / 2), 3.6, D * (W / 2 - 0.4), 1.3);   // 電風扇
  put(white, 0.05, 0.05, 1.3, 0.35, D * (W / 2 - 0.35), 0); put.geo(mat('wool', '#f2ede0'), new THREE.CylinderGeometry(0.16, 0.2, 0.3, 14), 0.35, D * (W / 2 - 0.35), 1.45);   // 立燈
  // 南牆窗戶上的斑馬捲簾（門口那段不放）
  for (let u = 0.9; u < L - 0.6; u += 1.5) if (doorU.every((d) => Math.abs(d - u) > 1.1)) put(mat('wool', '#f2efe6'), 1.3, 0.03, 1.0, u, D * (W / 2 - 0.02), 1.7);
  /* ---- 東端：校長辦公區（架高一階） ---- */
  const pu = L - 3.0;
  put(mat('planks', '#b8a48c'), 3.0, W, 0.08, L - 1.5, 0, 0);
  for (let v = -W / 2 + 0.3; v < W / 2; v += 0.25) put(mat('wool', '#8a7864'), 3.0, 0.02, 0.005, L - 1.5, v, 0.081);   // 木條紋
  // 東牆整面淺木色高櫃
  for (let v = A * (W / 2 - 0.5), k = 0; k < Math.floor((W - 1.4) / 0.6); k++, v += D * 0.6) {
    put(mat('planks', '#e2d4bc'), 0.55, 0.58, 2.6, L - 0.28, v, 0.08);
    put(mat('wool', '#b8ab98'), 0.02, 0.02, 0.18, L - 0.56, v + 0.2, 1.3);
  }
  // 圓弧大辦公桌（木頭、玻璃桌面）＋黑色皮椅（紅色背心）、檯燈、電腦、事務機、名牌
  const du0 = L - 1.9, dv0 = A * 0.4;
  put(deskWood, 0.85, 2.2, 0.76, du0, dv0, 0.08);
  put.geo(deskWood, new THREE.CylinderGeometry(0.6, 0.6, 0.76, 20, 1, false, 0, Math.PI), du0 - 0.15, dv0 + D * 1.1, 0.46);
  put(mat('glass'), 0.88, 2.25, 0.02, du0, dv0, 0.85);
  put(black, 0.6, 0.6, 0.5, du0 + 0.75, dv0, 0.08); put(black, 0.12, 0.6, 0.75, du0 + 1.05, dv0, 0.58);
  put(mat('wool', '#d32f2f'), 0.06, 0.5, 0.55, du0 + 0.98, dv0, 0.75);              // 紅色背心
  put(M.dark(), 0.05, 0.55, 0.36, du0 + 0.2, dv0 + D * 0.5, 0.88); put(screenMat(), 0.02, 0.5, 0.32, du0 + 0.17, dv0 + D * 0.5, 0.9);
  put(white, 0.45, 0.4, 0.3, du0 + 0.15, dv0 + A * 0.75, 0.88);                     // 事務機
  put.geo(mat('wool', '#3a5aa8'), new THREE.SphereGeometry(0.13, 12, 10), du0 + 0.25, dv0 + D * 1.15, 1.0);   // 青花瓷燈座
  put.geo(mat('wool', '#d8c49a'), new THREE.CylinderGeometry(0.16, 0.24, 0.32, 16), du0 + 0.25, dv0 + D * 1.15, 1.2);
  put(mat('wool', '#c9a46a'), 0.06, 0.4, 0.12, du0 - 0.4, dv0, 0.88);               // 名牌
  // 客椅（木框黑皮）、紅色小椅子、圓形小邊桌、東南角深色高櫃
  put(mat('wool', '#4a2a1e'), 0.55, 0.55, 0.45, du0 - 1.0, dv0, 0.08); put(black, 0.5, 0.5, 0.06, du0 - 1.0, dv0, 0.5); put(mat('wool', '#4a2a1e'), 0.08, 0.55, 0.55, du0 - 1.25, dv0, 0.53);
  put(mat('wool', '#e53935'), 0.3, 0.3, 0.3, pu - 0.2, A * (W / 2 - 0.8), 0);
  put.geo(mat('wool', '#6a3a22'), new THREE.CylinderGeometry(0.28, 0.2, 0.6, 14), pu + 0.6, A * (W / 2 - 0.5), 0.38);
  put(mat('planks', '#7a6a5c'), 0.6, 1.0, 2.5, L - 0.35, D * (W / 2 - 0.55), 0.08);
}

// 1F 總務處（依 10-27 九張照片重畫）：
//   中間兩區橘色屏風隔間（上半橘色、下半灰色、鋁框），每區 4 個座位背對背，中間一條走道（地上藍色條紋）
//   北牆：上方一整排木色吊櫃、兩片白板（貼公告）、上面掛時鐘，兩側到頂木櫃
//   南牆：木色吊櫃＋玻璃書櫃（一排排資料夾），西南角紅色 LED 用電顯示器（77 kW）和監控小螢幕，前面一張深色長桌＋木頭圓凳
//   西牆（窗）：灰色捲簾、窗下一整排木矮櫃放粉紅色資料夾；東牆（走廊）：灰色捲簾、紅色春聯、壁扇、兩扇門中間木抽屜櫃
// u：從北牆往南；v：A 西（窗）、D 東（走廊、門）
function generalOffice(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A, s = W / 2;
  const wood = mat('planks', '#b5773f'), orange = mat('wool', '#e8825f'), panel = mat('wool', '#a9aeb3'), alu = mat('wool', '#d2d5d8');
  const deskTop = mat('wool', '#dfe1dc'), drawer = mat('wool', '#cfd0c8'), black = mat('wool', '#202226'), blind = mat('wool', '#c9ccce');
  const doorU = (room.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]);
  // 屏風：下半灰、上半橘、頂上鋁條
  const screen = (u, v, du, dv) => { put(panel, du, dv, 0.6, u, v, 0); put(orange, du, dv, 0.62, u, v, 0.6); put(alu, du + 0.02, dv + 0.02, 0.03, u, v, 1.22); };
  // 一區 4 個座位：兩張桌子沿 u 排、背對背（中間一道屏風），c＝這區中心的 v
  const cluster = (c) => {
    const u0 = 2.7, n = 2, du = 1.45;
    screen(u0 + (n * du) / 2 - du / 2, c, n * du, 0.05);                       // 中間那道
    for (const k of [-1, 1]) screen(u0 - du / 2 - 0.03, c + k * 0.36, 0.05, 0.72);   // 兩端側板
    for (const k of [-1, 1]) screen(u0 + (n - 0.5) * du + 0.03, c + k * 0.36, 0.05, 0.72);
    for (let i = 0; i < n; i++) for (const k of [-1, 1]) {
      const u = u0 + i * du, v = c + k * 0.37;
      put(deskTop, du - 0.08, 0.68, 0.04, u, v, 0.72);
      put(drawer, 0.42, 0.55, 0.68, u + 0.45, v + k * 0.03, 0);              // 抽屜櫃
      put(drawer, 0.04, 0.6, 0.72, u - 0.62, v, 0);
      put(black, 0.32, 0.22, 0.02, u - 0.1, v - k * 0.22, 0.76);             // 螢幕底座
      put(black, 0.55, 0.04, 0.34, u - 0.1, v - k * 0.25, 0.84); put(screenMat(), 0.5, 0.02, 0.3, u - 0.1, v - k * 0.23, 0.86);
      put(black, 0.45, 0.15, 0.02, u - 0.1, v - k * 0.02, 0.76);             // 鍵盤
      officeChair(put, u - 0.1, v + k * 0.62, 0, -k, '#202226');
    }
  };
  cluster(A * 1.75); cluster(D * 1.7);
  // 走道地上的藍色條紋（從門口往裡面）
  for (const du of [1.6, 6.9]) put(mat('wool', '#2f6fc0'), 0.35, 2.2, 0.01, du, D * (s - 1.15), 0);
  put(mat('wool', '#2f6fc0'), L - 2.2, 0.3, 0.01, L / 2, A * 0.05, 0);

  /* ---- 北牆 ---- */
  put(wood, 0.45, W - 0.1, 0.7, 0.24, 0, 2.15);                                   // 吊櫃
  for (const k of [-1, 1]) put(wood, 0.45, 1.0, 2.15, 0.24, k * (s - 0.55), 0);   // 兩側到頂木櫃
  for (const k of [-1, 1]) put(M.white(), 0.03, 1.5, 1.05, 0.03, k * 0.8, 0.95, true);   // 兩片白板
  for (const [dv, y, c] of [[-1.2, 1.6, '#f6e58d'], [-0.6, 1.3, '#ffffff'], [0.5, 1.7, '#f8c8dc'], [1.1, 1.25, '#ffffff'], [0.9, 1.5, '#cfe8ff']]) put(mat('wool', c), 0.02, 0.3, 0.35, 0.05, dv, y);
  put(wood, 0.4, W - 2.2, 0.08, 0.2, 0, 0.9);                                     // 白板下緣的木條
  put.geo(M.white(), new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24).rotateX(Math.PI / 2), 0.05, 0, 2.05, fr.alongX ? Math.PI / 2 : 0);   // 時鐘

  /* ---- 南牆：玻璃書櫃＋資料夾 ---- */
  put(wood, 0.45, W - 1.6, 0.7, L - 0.24, A * 0.7, 2.15);
  put(wood, 0.45, W - 1.6, 0.85, L - 0.24, A * 0.7, 0);
  put(wood, 0.45, W - 1.6, 0.05, L - 0.24, A * 0.7, 1.45);
  put(mat('glass'), 0.02, W - 1.7, 1.25, L - 0.47, A * 0.7, 0.88);
  const fc = ['#f2b6c8', '#9ec5e8', '#e8d9a0', '#ffffff', '#3a3a3a', '#f7d4df'];
  for (let i = 0, v = A * 0.7 - (W - 1.8) / 2; v < A * 0.7 + (W - 1.8) / 2; v += 0.09, i++) {
    for (const y of [0.9, 1.5]) put(mat('wool', fc[(i + (y > 1 ? 2 : 0)) % fc.length]), 0.26, 0.07, 0.32, L - 0.28, v, y);
  }
  // 西南角：紅色 LED 用電顯示器、監控小螢幕、白色配電箱
  put(black, 0.05, 0.6, 0.18, L - 0.03, A * (s - 0.5), 2.45);
  put(mat('wool', '#ff2a2a'), 0.02, 0.4, 0.1, L - 0.06, A * (s - 0.55), 2.49);
  put(M.white(), 0.08, 0.4, 0.3, L - 0.05, A * (s - 0.45), 1.75); put(screenMat(), 0.02, 0.3, 0.2, L - 0.1, A * (s - 0.45), 1.8);
  put(M.white(), 0.15, 0.5, 0.65, L - 0.08, D * (s - 0.35), 1.5);
  // 深色長桌＋木頭圓凳、藍色圓凳
  const tu = L - 1.35, tv = A * 1.2;
  put(mat('wool', '#5a4e48'), 0.8, 1.9, 0.04, tu, tv, 0.82);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(black, 0.05, 0.05, 0.82, tu + a * 0.34, tv + b * 0.88, 0);
  put(mat('wool', '#e53935'), 0.4, 0.3, 0.12, tu, tv - 0.4, 0.86);                 // 紅色籃子
  put(M.white(), 0.32, 0.32, 0.3, tu, tv + 0.4, 0.86);
  for (const [dv, c] of [[-0.6, '#9a5a2a'], [0.1, '#2e4a8a'], [0.7, '#9a5a2a']]) {
    put.geo(mat('wool', c), new THREE.CylinderGeometry(0.18, 0.18, 0.06, 14), tu - 0.65, tv + dv, 0.55);
    put.geo(mat('wool', '#6a3a1a'), new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), tu - 0.65, tv + dv, 0.27);
  }

  /* ---- 西牆（窗）：灰色捲簾、窗下木矮櫃＋粉紅色資料夾、壁扇 ---- */
  for (let u = 1.6; u < L - 1.2; u += 1.5) put(blind, 1.35, 0.03, 1.1, u, A * (s - 0.02), 1.5);
  put(wood, L - 2.6, 0.45, 0.8, L / 2, A * (s - 0.23), 0);
  for (let i = 0; i < 18; i++) put(mat('wool', ['#f2b6c8', '#f7d4df', '#e9a0b8'][i % 3]), 0.12, 0.26, 0.3, 2.2 + i * 0.13, A * (s - 0.25), 0.8);
  put(mat('wool', '#7fd04a'), 0.45, 0.25, 0.4, 2.0, A * (s - 0.25), 0.8);           // 綠色袋子
  /* ---- 東牆（走廊）：灰色捲簾、春聯、壁扇、兩扇門中間的木抽屜櫃 ---- */
  const free = (u) => doorU.every((d) => Math.abs(d - u) > 0.9);
  for (let u = 2.4; u < L - 1.6; u += 1.4) if (free(u)) put(blind, 1.25, 0.03, 0.55, u, D * (s - 0.02), 2.05);
  put(mat('wool', '#d32f2f'), 0.4, 0.02, 0.8, L / 2, D * (s - 0.02), 1.35);        // 春聯「和諧共生 喜到成功」
  put(mat('wool', '#f2c94c'), 0.06, 0.03, 0.6, L / 2 - 0.08, D * (s - 0.03), 1.45); put(mat('wool', '#f2c94c'), 0.06, 0.03, 0.6, L / 2 + 0.08, D * (s - 0.03), 1.45);
  put(M.white(), 0.4, 0.15, 0.4, L / 2 + 0.6, D * (s - 0.1), 2.3);                // 壁扇
  put(mat('wool', '#d9b98a'), Math.max(0.6, doorU[1] - doorU[0] - 2.0), 0.4, 0.8, (doorU[0] + doorU[1]) / 2, D * (s - 0.2), 0);
  put(M.white(), 0.8, 0.25, 0.3, 0.9, D * (s - 0.15), 2.5);                       // 冷氣
}


// 2F 科任教師辦公室（依 10-27 九張照片）：原本是一間教室
//   地板：深咖啡、米色大格子相間；中間兩區芥末黃屏風隔間（上半黃、下半灰、鋁框），每區 6 個座位背對背，兩區中間一條東西向走道
//   北牆：四片綠色黑板（木框）、上面貼「兒童園地」字、下面一排藍粉白小門矮櫃，東側木格子櫃，西側粉紅色門
//   南牆：綠色黑板（午餐明細、紅色「福」字、粉筆寫的名字），西南角銀色冰箱、木凳，西牆南段嵌一座木格櫃
//   西牆北段咖啡色木格櫃、紙箱；東牆（走廊）紅色時鐘、兩扇門中間藍白矮櫃；南區東端一疊透明收納箱
// u：從北牆往南；v：A 西（窗、校外）、D 東（走廊、門）
function subjectOffice(put, fr, room) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A, s = W / 2;
  const yellow = mat('wool', '#d9a640'), panel = mat('wool', '#a9aeb3'), alu = mat('wool', '#d2d5d8');
  const deskTop = mat('wool', '#dfe1dc'), drawer = mat('wool', '#d8d6cc'), black = mat('wool', '#202226');
  const brown = mat('planks', '#8a4f2c'), frame = mat('planks', '#b07a3e'), board = mat('wool', '#2f5d47');
  // 地板大格子（深咖啡那一半；底色是米色）
  const T = 0.9;
  for (let i = 0; i * T < L; i++) for (let k = 0; k * T < W; k++) if ((i + k) % 2) {
    const u = Math.min(L, (i + 1) * T), w = Math.min(W, (k + 1) * T);
    put(mat('planks', '#5a3a2a'), u - i * T, w - k * T, 0.01, (i * T + u) / 2, -s + (k * T + w) / 2, 0);
  }
  const screen = (u, v, du, dv) => { put(panel, du, dv, 0.55, u, v, 0); put(yellow, du, dv, 0.62, u, v, 0.55); put(alu, du + 0.02, dv + 0.02, 0.03, u, v, 1.17); };
  // 一區：沿 v 排 3 張桌子、兩排背對背，c＝這區中心的 u
  const v0 = A * 1.7, v1 = D * 1.4, n = 3, dw = (v1 - v0) / n;   // 桌子小一點，四周留得出走道
  const block = (c) => {
    screen(c, (v0 + v1) / 2, 0.05, Math.abs(v1 - v0));
    for (const k of [-1, 1]) for (const vv of [v0, v1]) screen(c + k * 0.31, vv, 0.62, 0.05);
    for (let i = 0; i < n; i++) for (const k of [-1, 1]) {
      const v = v0 + dw * (i + 0.5), u = c + k * 0.32;
      put(deskTop, 0.6, Math.abs(dw) - 0.06, 0.04, u, v, 0.72);
      put(drawer, 0.5, 0.36, 0.68, u + k * 0.03, v + dw * 0.33, 0);           // 抽屜櫃
      put(black, 0.04, 0.5, 0.32, u - k * 0.22, v - dw * 0.08, 0.84); put(screenMat(), 0.02, 0.46, 0.28, u - k * 0.2, v - dw * 0.08, 0.86);
      put(black, 0.2, 0.3, 0.02, u - k * 0.19, v - dw * 0.08, 0.76);
      put(black, 0.14, 0.42, 0.02, u, v - dw * 0.08, 0.76);                    // 鍵盤
      put(black, 0.2, 0.11, 0.28, u - k * 0.13, v + dw * 0.22, 0.76);          // 小主機
      officeChair(put, u + k * 0.5, v - dw * 0.08, -k, 0, '#8a2a3a');          // 酒紅色網椅（靠著桌子）
    }
  };
  block(2.4); block(5.75);                                                    // 北邊黑板前、兩區中間、南邊都留走道
  // 透明收納箱一疊（南區東端）
  for (let j = 0; j < 4; j++) {
    put(mat('wool', '#8ccfc4'), 0.5, 0.6, 0.04, 5.75, D * 1.75, j * 0.4);
    put(mat('glass'), 0.48, 0.58, 0.34, 5.75, D * 1.75, j * 0.4 + 0.04);
  }
  put(mat('wool', '#3cc04a'), 0.45, 0.55, 0.12, 5.75, D * 1.75, 1.6);

  /* ---- 北牆 ---- */
  put(frame, 0.06, 4.7, 1.32, 0.03, D * 0.2, 0.86);
  put(board, 0.07, 4.5, 1.2, 0.04, D * 0.2, 0.92);
  for (let k = 1; k < 4; k++) put(frame, 0.08, 0.05, 1.2, 0.05, D * 0.2 - 2.25 + k * 1.125, 0.92);
  put(childCornerMat(), 0.02, 2.2, 0.38, 0.02, D * 0.2, 2.3, true);             // 「兒童園地」
  put(frame, 0.4, 4.7, 0.82, 0.2, D * 0.2, 0);                                   // 黑板下矮櫃（小門藍粉白）
  for (let k = 0; k < 8; k++) for (const y of [0.06, 0.42]) put(mat('wool', ['#4a7ad8', '#f2d4e0', '#f6f6f2', '#7aa8e8'][(k + (y > 0.1 ? 1 : 0)) % 4]), 0.02, 0.54, 0.32, 0.41, D * 0.2 - 2.1 + k * 0.6, y);
  put(frame, 0.35, 0.9, 2.1, 0.18, D * (s - 0.55), 0);                          // 東側木格子櫃
  for (const y of [0.5, 1.0, 1.5]) put(frame, 0.33, 0.85, 0.03, 0.19, D * (s - 0.55), y);
  put(mat('wool', '#e8505b'), 0.25, 0.3, 0.3, 0.2, D * (s - 0.45), 1.53); put(mat('wool', '#f2c94c'), 0.2, 0.25, 0.2, 0.2, D * (s - 0.7), 1.03);
  put(mat('wool', '#f2c3d4'), 0.04, 0.9, 2.05, 0.02, A * (s - 0.6), 0);          // 粉紅色門

  /* ---- 南牆 ---- */
  put(frame, 0.06, 3.6, 1.32, L - 0.03, D * 0.4, 0.86);
  put(lunchBoardMat(), 0.07, 3.4, 1.2, L - 0.04, D * 0.4, 0.92, true);
  put(M.grey(), 0.7, 0.7, 1.75, L - 0.4, A * (s - 0.45), 0);                     // 銀色冰箱
  put(M.white(), 0.6, 0.62, 0.02, L - 0.76, A * (s - 0.45), 1.05);
  put(frame, 0.45, 0.45, 0.6, L - 0.35, A * (s - 1.3), 0);                       // 木凳、小木桌
  put(brown, 0.4, 1.0, 2.1, L - 1.8, A * (s - 0.2), 0);                          // 西牆南段嵌入的木格櫃
  for (const y of [0.7, 1.4]) put(mat('wool', '#e8dcc8'), 0.3, 0.9, 0.04, L - 1.8, A * (s - 0.22), y);

  /* ---- 西牆北段：咖啡色木格櫃、紙箱 ---- */
  put(brown, 2.4, 0.42, 1.0, 2.2, A * (s - 0.21), 0);
  for (let k = 0; k < 4; k++) put(mat('wool', '#e8dcc8'), 0.02, 0.4, 0.95, 1.0 + k * 0.6, A * (s - 0.43), 0.02);
  put(mat('wool', '#c9a06a'), 0.5, 0.4, 0.35, 3.0, A * (s - 0.21), 1.0);   // 紙箱放在櫃子上，不擋走道
  /* ---- 東牆（走廊）：紅色時鐘、兩扇門中間藍白矮櫃 ---- */
  const doorU = (room.doorPts || []).map((d) => fr.toLocal(d.x, d.z)[0]).sort((a, b) => a - b);
  const c0 = (doorU[0] ?? 1.6) + 1.0, c1 = (doorU[1] ?? L - 1.6) - 1.0;
  put(frame, c1 - c0, 0.4, 0.75, (c0 + c1) / 2, D * (s - 0.2), 0);
  for (let u = c0 + 0.3; u < c1 - 0.2; u += 0.6) put(mat('wool', ['#4a7ad8', '#f6f6f2'][Math.round(u / 0.6) % 2]), 0.54, 0.02, 0.6, u, D * (s - 0.41), 0.08);
  put.geo(mat('wool', '#c62828'), new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20).rotateX(Math.PI / 2), L / 2, D * (s - 0.03), 2.3, fr.alongX ? 0 : Math.PI / 2);
}
const childCornerMat = () => once('childcorner', () => new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.4, map: bigTex(400, 70, (c, w, h) => {
  c.fillStyle = '#2b3a6a'; c.font = '900 52px "DFKai-SB", "標楷體", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  ['地', '園', '童', '兒'].forEach((t, i) => c.fillText(t, 50 + i * 100, h / 2));     // 由右往左讀：兒童園地
}) }));
const lunchBoardMat = () => once('lunchboard', () => new THREE.MeshLambertMaterial({ map: bigTex(480, 170, (c, w, h) => {
  c.fillStyle = '#2f5d47'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '16px sans-serif'; c.fillText('午餐明細', 20, 26);
  for (const [x, y, ww, hh, col] of [[22, 40, 34, 46, '#ffffff'], [64, 40, 40, 30, '#ffffff'], [30, 96, 30, 40, '#f8c8dc'], [70, 90, 30, 40, '#f6e58d']]) { c.fillStyle = col; c.fillRect(x, y, ww, hh); }
  c.save(); c.translate(250, 70); c.rotate(Math.PI / 4); c.fillStyle = '#d32f2f'; c.fillRect(-16, -16, 32, 32); c.restore();
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.strokeRect(320, 20, 140, 130); c.beginPath(); c.moveTo(320, 85); c.lineTo(460, 85); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '15px sans-serif';
  for (let r = 0; r < 4; r++) c.fillText('〇〇  〇〇  〇〇', 330, 42 + r * 30);
}) }));

// 2F 英語教室一（210，依 10-28 八張照片）：前牆（西）、後牆（東）漆深藍色，側牆黃色
//   前牆：互動電子白板（兩側白板）、左邊綠板貼「ASK 3 BEFORE ME」海報、右邊綠板「Rules」；講台北側一組玻璃屏風老師桌（掛藍色口袋掛袋）
//   後牆：三片綠色黑板（世界地圖海報）、下面一排藍白小置物格
//   北牆：高窗、時鐘，下面木框玻璃櫃、白色門片收納櫃、黃色門；南牆（走廊）：道路地圖捲簾、紅色「Luck」、深咖啡木護牆板
//   木頭單人課桌椅 6 欄 × 5 排（中間留走道）；走廊外牆窗下一整片字母／自然發音面板（彩虹眼睛吉祥物）
// u：從前牆（西）往後；v：S（+，走廊、門）、N（－）
function englishRoom(put, fr, room) {
  const W = fr.W, L = fr.L, s = W / 2, S = fr.away, N = -S;
  const blue = mat('wool', '#1f4fa8'), wood = mat('planks', '#c98d4a'), dark = mat('planks', '#5a3a26'), white = M.white(), green = mat('wool', '#2f5d47');
  const doorU = (room.doorPts || []).map((d) => fr.toLocal(d.x, d.z)).filter(([, v]) => v * S > 0).map(([u]) => u).sort((a, b) => a - b);
  // 前後牆漆深藍色
  for (const u of [0.015, L - 0.015]) put(blue, 0.02, W - 0.05, 2.9, u, 0, 0.02);
  /* ---- 前牆 ---- */
  put(M.frame(), 0.05, 4.6, 1.3, 0.03, N * 0.3, 0.85);
  put(white, 0.05, 1.2, 1.15, 0.05, N * 0.3 - 1.65, 0.9, true); put(white, 0.05, 1.2, 1.15, 0.05, N * 0.3 + 1.65, 0.9, true);
  put(M.dark(), 0.07, 2.0, 1.2, 0.06, N * 0.3, 0.88); put(screenMat(), 0.08, 1.9, 1.1, 0.065, N * 0.3, 0.93, true);   // 互動電子白板
  put(green, 0.04, 1.0, 1.2, 0.04, S * 2.9, 0.9); put(mat('wool', '#3a6ad8'), 0.05, 0.55, 0.75, 0.05, S * 2.9, 1.05);   // 綠板＋ASK 3 BEFORE ME 海報
  put(green, 0.04, 1.3, 0.95, 0.04, N * 3.05, 1.2); put(englishRulesMat(), 0.05, 1.15, 0.8, 0.05, N * 3.05, 1.27, true);   // Rules
  put(M.white(), 0.25, 0.2, 0.25, 0.15, N * 2.3, 2.35); put(M.white(), 0.25, 0.2, 0.25, 0.15, S * 1.7, 2.35);   // 喇叭
  // 講台北側：玻璃屏風老師桌、藍色口袋掛袋
  const tu = 1.25, tv = N * (s - 0.75);
  put(mat('wool', '#e8e8e2'), 1.4, 0.75, 0.74, tu, tv, 0);
  put(alu(), 0.04, 0.75, 1.15, tu + 0.72, tv, 0); put(mat('glass'), 0.02, 0.7, 0.4, tu + 0.72, tv, 0.75);
  put(alu(), 1.4, 0.04, 1.15, tu, tv + S * 0.39, 0); put(mat('glass'), 1.3, 0.02, 0.4, tu, tv + S * 0.39, 0.75);
  put(M.dark(), 0.05, 0.5, 0.32, tu - 0.3, tv, 0.76); put(screenMat(), 0.02, 0.46, 0.28, tu - 0.27, tv, 0.78);
  officeChair(put, tu - 0.75, tv, 1, 0, '#2b2d31');
  put(mat('wool', '#2a5fc0'), 0.02, 0.6, 0.85, tu + 0.75, tv, 0.2);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) put(mat('wool', '#f2c94c'), 0.02, 0.1, 0.08, tu + 0.77, tv - 0.2 + i * 0.2, 0.32 + j * 0.18);
  /* ---- 木頭單人課桌椅：6 欄（中間留走道）× 5 排，面向前面 ---- */
  for (let r = 0; r < 5; r++) for (const v of [-2.45, -1.55, -0.65, 0.65, 1.55, 2.45]) {
    const u = 2.9 + r * 1.0;
    put(wood, 0.45, 0.6, 0.04, u, v, 0.68);
    put(wood, 0.04, 0.56, 0.22, u - 0.2, v, 0.46);                                   // 前面的抽屜板（刻「溪口國小」）
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.04, 0.04, 0.68, u + a * 0.19, v + b * 0.26, 0);
    for (const b of [-1, 1]) put(mat('wool', '#f2702a'), 0.06, 0.06, 0.05, u + 0.19, v + b * 0.26, 0);   // 橘色桌腳套
    put(wood, 0.32, 0.36, 0.04, u + 0.42, v, 0.4);                                  // 椅子
    put(wood, 0.04, 0.36, 0.38, u + 0.58, v, 0.44);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.03, 0.03, 0.4, u + 0.42 + a * 0.14, v + b * 0.16, 0);
  }
  /* ---- 後牆：三片綠色黑板＋世界地圖、下面藍白小置物格 ---- */
  put(M.frame(), 0.05, 4.8, 1.35, L - 0.03, N * 0.3, 1.0);
  for (const k of [-1, 0, 1]) put(green, 0.05, 1.5, 1.2, L - 0.05, N * 0.3 + k * 1.55, 1.07);
  put(worldMapMat(), 0.04, 1.2, 0.95, L - 0.08, N * 0.3, 1.15, true);
  put(worldMapMat(), 0.04, 0.8, 0.55, L - 0.08, N * 0.3 + 1.55, 1.35, true);
  put(mat('wool', '#f6f6f2'), 0.04, 0.7, 0.85, L - 0.08, N * 0.3 - 1.55, 1.2);
  put(wood, 0.42, 5.0, 0.85, L - 0.22, N * 0.3, 0);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) put(mat('wool', j ? '#3f72d6' : '#eef2fb'), 0.02, 0.38, 0.36, L - 0.44, N * 0.3 - 2.3 + i * 0.42, 0.05 + j * 0.4);
  /* ---- 北牆：木框玻璃櫃、白門收納櫃、時鐘、黃色門 ---- */
  const nv = N * (s - 0.23);
  put(wood, 2.2, 0.45, 2.0, 3.5, nv, 0); put(mat('glass'), 2.1, 0.02, 1.0, 3.5, nv + S * 0.24, 0.9);
  put(wood, 2.2, 0.45, 0.85, 5.7, nv, 0);
  for (let k = 0; k < 4; k++) put(M.white(), 0.5, 0.02, 0.95, 5.0 + k * 0.5, nv + S * 0.24, 0.9);
  put(wood, 2.2, 0.45, 0.05, 5.7, nv, 1.9);
  put.geo(mat('wool', '#a01e2a'), new THREE.CylinderGeometry(0.18, 0.18, 0.05, 20).rotateX(Math.PI / 2), L / 2, N * (s - 0.03), 2.35, fr.alongX ? 0 : Math.PI / 2);
  put(mat('wool', '#f2b632'), 0.9, 0.04, 2.0, L - 1.0, N * (s - 0.02), 0, true);    // 黃色門（通隔壁）
  /* ---- 南牆（走廊）：深咖啡護牆板、道路地圖捲簾、Luck ---- */
  const runs = [[0.4, (doorU[0] ?? 1.5) - 0.7], [(doorU[0] ?? 1.5) + 0.7, (doorU[1] ?? L - 1.5) - 0.7], [(doorU[1] ?? L - 1.5) + 0.7, L - 0.3]];
  for (const [a, b] of runs) if (b - a > 0.3) put(dark, b - a, 0.04, 0.9, (a + b) / 2, S * (s - 0.02), 0);
  for (const u of [L * 0.3, L * 0.62]) put(roadMapMat(), 1.6, 0.03, 0.9, u, S * (s - 0.04), 1.75, true);
  put(mat('wool', '#d32f2f'), 0.3, 0.02, 0.3, L * 0.45, S * (s - 0.04), 1.7);
  put(M.white(), 0.7, 0.35, 0.35, L * 0.8, S * (s - 0.2), 2.4);                   // 窗型冷氣
  // 天花板：兩台吊扇（白色方形）、投影機
  for (const u of [L * 0.35, L * 0.7]) put(M.white(), 0.55, 0.55, 0.2, u, 0, 2.7);
  put(M.white(), 0.4, 0.35, 0.15, 2.3, N * 0.3, 2.6);
  // 走廊外牆：窗下字母／自然發音面板（兩扇門中間）
  if (doorU.length >= 2) put(phonicsMat(), doorU[1] - doorU[0] - 1.4, 0.03, 0.95, (doorU[0] + doorU[1]) / 2, S * (s + 0.36), 0.05, true);
}
const alu = () => mat('wool', '#d2d5d8');
const englishRulesMat = () => once('enrules', () => new THREE.MeshLambertMaterial({ map: bigTex(240, 170, (c, w, h) => {
  c.fillStyle = '#2f5d47'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffffff'; c.font = 'bold 26px sans-serif'; c.fillText('Rules', 80, 32);
  c.font = '15px sans-serif'; ['1. Be on time.', '2. Do your best.', '3. Help each other.', '4. Keep it clean.', '5. Raise your hand.'].forEach((t, i) => c.fillText(t, 18, 60 + i * 22));
}) }));
const worldMapMat = () => once('worldmap', () => new THREE.MeshLambertMaterial({ map: bigTex(256, 180, (c, w, h) => {
  c.fillStyle = '#a8d8f0'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#7cc46a';
  for (const [x, y, rx, ry] of [[55, 60, 36, 26], [75, 120, 18, 30], [130, 55, 22, 18], [140, 105, 22, 32], [190, 60, 46, 26], [215, 130, 20, 14]]) { c.beginPath(); c.ellipse(x, y, rx, ry, 0.3, 0, 7); c.fill(); }
  c.fillStyle = '#f2c94c'; for (let i = 0; i < 10; i++) c.fillRect(10 + i * 24, h - 18, 18, 12);   // 下面一排國旗
  c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
}) }));
const roadMapMat = () => once('roadmap', () => new THREE.MeshLambertMaterial({ map: bigTex(256, 140, (c, w, h) => {
  c.fillStyle = '#cfe8b0'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#3a8ad8'; c.lineWidth = 16; c.beginPath(); c.moveTo(60, 0); c.bezierCurveTo(30, 60, 110, 80, 80, h); c.stroke();   // 河
  c.strokeStyle = '#9aa0a8'; c.lineWidth = 9;
  for (const [x1, y1, x2, y2] of [[0, 40, w, 30], [120, 0, 150, h], [0, 110, w, 120], [190, 0, 230, h]]) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  c.fillStyle = '#e85a5a'; for (const [x, y] of [[160, 70], [210, 90], [100, 30]]) { c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); }
}) }));
const phonicsMat = () => once('phonics', () => new THREE.MeshLambertMaterial({ map: bigTex(1024, 200, (c, w, h) => {
  c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, w, h);
  const cols = ['#d9b8e8', '#e8c27a', '#9fd060', '#9ccbf0', '#a08f88'];
  for (let i = 0; i < 9; i++) { c.fillStyle = cols[i % 5]; c.beginPath(); const x = i * 120; c.moveTo(x, 0); c.lineTo(x + 130, 0); c.lineTo(x + 90, 36); c.lineTo(x + 20, 30); c.fill(); c.beginPath(); c.moveTo(x + 40, h); c.lineTo(x + 160, h); c.lineTo(x + 130, h - 30); c.lineTo(x + 60, h - 26); c.fill(); }
  c.fillStyle = '#b08a90'; c.font = 'bold 18px sans-serif';
  const L1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', L2 = ['sh', 'ch', 'th', 'wh', 'ph', 'ou', 'oy', 'ai', 'ee', 'oa', 'ar', 'or', 'bl', 'cr', 'st', 'sp', 'gr', 'fl'];
  for (let i = 0; i < 90; i++) { const x = 30 + (i * 53) % 940, y = 50 + ((i * 37) % 120); c.fillText(x < 520 ? L1[i % 26] : L2[i % L2.length], x, y); }
  for (const [x, y] of [[60, 70], [250, 50], [600, 120], [480, 160]]) {                // 彩虹眼睛吉祥物
    const g = c.createLinearGradient(x - 26, y, x + 26, y); ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'].forEach((col, k) => g.addColorStop(k / 5, col));
    c.strokeStyle = g; c.lineWidth = 8; c.beginPath(); c.arc(x, y, 24, 0, 7); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 19, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(x + 4, y + 2, 8, 0, 7); c.fill();
    c.fillStyle = '#333'; c.fillRect(x - 14, y + 26, 9, 12); c.fillRect(x + 6, y + 26, 9, 12);
  }
}) }));

// 2F 幼兒園辦公室（208，依 10-28 八張照片）：淡黃色牆、灰米色木紋地板
//   北端：窗下一整排米色抽屜櫃（印表機、熱水瓶、小抽屜盒、盆栽）、冷氣；前面粉紅色弧形服務台（螢幕是海底世界的畫）、碎紙機
//   東牆：到頂的毛玻璃白板拉門櫃（下面米色櫃門、中間格子放資料夾，白板上畫「溪口附幼 115 學年度 福氣滿滿」）
//   中間：淡紫色玻璃大長桌＋藍色塑膠椅、一盆粉色花；南端：白色百葉玻璃門、時鐘、影印機、茶水角（吊櫃、水槽、烘碗機）
//   西牆（門那側）：行事曆大白板、壁扇
// u：從北牆往南；v：A 東（櫃子）、D 西（門）
function kinderOffice(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A, s = W / 2;
  const beige = mat('wool', '#e6dac6'), grey = mat('wool', '#b8bcc0'), frost = mat('wool', '#dcebe2');
  /* ---- 北端：抽屜櫃、窗、服務台 ---- */
  put(beige, 0.6, W - 1.6, 0.85, 0.32, A * 0.3, 0);
  for (let k = 0; k < 7; k++) for (const y of [0.15, 0.45, 0.72]) put(mat('wool', '#d3c5ae'), 0.02, 0.5, 0.02, 0.63, A * 0.3 - (W - 1.6) / 2 + 0.35 + k * ((W - 2.2) / 6), y);
  put(mat('wool', '#c4c8cc'), 0.6, W - 1.6, 0.03, 0.32, A * 0.3, 0.85);
  put(M.dark(), 0.4, 0.45, 0.32, 0.35, D * 1.2, 0.88);                                 // 印表機
  put(M.white(), 0.25, 0.25, 0.3, 0.35, A * 0.1, 0.88);                                // 熱水瓶
  for (let k = 0; k < 3; k++) put(mat('wool', '#3a3a3a'), 0.3, 0.32, 0.25, 0.35, A * (0.9 + k * 0.36), 0.88);   // 小抽屜盒
  for (const dv of [-0.4, -0.15]) put(mat('wool', '#5aa83f'), 0.12, 0.12, 0.2, 0.35, A * dv, 0.88);
  put(mat('glass'), 0.03, 1.8, 1.25, 0.02, A * 0.3, 1.0); put(M.white(), 0.9, 0.3, 0.3, 0.2, A * 0.3, 2.45);   // 窗、冷氣
  // 粉紅色弧形服務台（凸面朝南，人坐在北邊裡面）
  const cu = 1.55, cv = A * 0.8, R = 1.1;
  put.geo(beige, new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.74, 24, 1, true, -Math.PI / 3, (Math.PI * 2) / 3), cu, cv, 0.37, fr.alongX ? Math.PI / 2 : 0);
  put.geo(mat('wool', '#d98a8e'), new THREE.RingGeometry(R - 0.6, R, 24, 1, -Math.PI * 5 / 6, (Math.PI * 2) / 3).rotateX(-Math.PI / 2), cu, cv, 0.76, fr.alongX ? Math.PI / 2 : 0);
  put(M.dark(), 0.05, 0.75, 0.55, cu + 0.55, cv + A * 0.35, 0.77); put(oceanArtMat(), 0.02, 0.7, 0.5, cu + 0.58, cv + A * 0.35, 0.8, true);   // 螢幕（海底世界）
  officeChair(put, cu - 0.2, cv, 1, 0, '#2b2d31');
  put(mat('wool', '#e8e2d2'), 0.4, 0.3, 0.6, cu + 0.9, cv - A * 0.5, 0);           // 碎紙機
  /* ---- 東牆：毛玻璃白板拉門櫃 ---- */
  const ev = A * (s - 0.23), eu0 = 0.75, eu1 = L - 1.9;
  put(beige, eu1 - eu0, 0.45, 0.9, (eu0 + eu1) / 2, ev, 0);
  put(grey, eu1 - eu0, 0.45, 0.04, (eu0 + eu1) / 2, ev, 0.9);
  put(grey, eu1 - eu0, 0.45, 1.6, (eu0 + eu1) / 2, ev + A * 0.02, 0.94);
  const seg = (eu1 - eu0) / 3;
  for (let k = 0; k < 3; k++) {
    const u = eu0 + seg * (k + 0.5);
    put(k === 0 ? kinderOfficeBoardMat() : frost, seg * 0.62, 0.03, 1.4, u - seg * 0.18, ev - A * 0.24, 1.0, k === 0);   // 毛玻璃白板
    for (const y of [1.15, 1.55, 1.95]) for (let i = 0; i < 4; i++) put(mat('wool', ['#2a5fc0', '#e8e8e8', '#d63a3a', '#f2c94c'][(i + k) % 4]), 0.05, 0.1, 0.3, u + seg * 0.2 + i * 0.07, ev - A * 0.05, y);   // 資料夾
  }
  put(mat('wool', '#c9a06a'), eu1 - eu0, 0.4, 0.3, (eu0 + eu1) / 2, ev, 2.55);      // 櫃子上的紙箱
  /* ---- 中間：淡紫色玻璃大長桌＋藍色塑膠椅 ---- */
  const tu = L * 0.64, tv = D * 0.5, TL = 2.4, TW = 1.2;
  put(mat('wool', '#e0d4ec'), TL, TW, 0.04, tu, tv, 0.74);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(M.grey(), 0.05, 0.05, 0.74, tu + a * (TL / 2 - 0.15), tv + b * (TW / 2 - 0.15), 0);
  const chair = (u, v, fu, fv) => {
    put(mat('wool', '#2246b8'), 0.42, 0.42, 0.05, u, v, 0.44);
    if (fu) put(mat('wool', '#2246b8'), 0.05, 0.42, 0.5, u - fu * 0.2, v, 0.48); else put(mat('wool', '#2246b8'), 0.42, 0.05, 0.5, u, v - fv * 0.2, 0.48);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(M.grey(), 0.025, 0.025, 0.44, u + a * 0.17, v + b * 0.17, 0);
  };
  for (const du of [-0.8, 0, 0.8]) for (const k of [-1, 1]) chair(tu + du, tv + k * (TW / 2 + 0.3), 0, -k);
  put.geo(M.white(), new THREE.CylinderGeometry(0.1, 0.08, 0.16, 12), tu - 0.3, tv, 0.84);
  put.geo(mat('wool', '#f2b8b0'), new THREE.SphereGeometry(0.14, 10, 8), tu - 0.3, tv, 1.0);   // 粉色花
  /* ---- 南端：百葉玻璃門、時鐘、影印機、茶水角 ---- */
  put(M.white(), 0.04, 1.0, 2.2, L - 0.02, D * 0.6, 0, true);
  for (let y = 0.25; y < 2.0; y += 0.1) put(M.grey(), 0.02, 0.85, 0.02, L - 0.05, D * 0.6, y);
  put.geo(M.white(), new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20).rotateX(Math.PI / 2), L - 0.03, D * 0.6, 2.45, fr.alongX ? Math.PI / 2 : 0);
  put(mat('wool', '#3a3a3a'), 0.6, 0.6, 1.1, L - 0.4, D * (s - 0.45), 0); put(M.white(), 0.55, 0.55, 0.2, L - 0.4, D * (s - 0.45), 1.1);   // 影印機
  put(beige, 0.6, 1.8, 0.85, L - 0.32, A * (s - 1.1), 0); put(mat('wool', '#c4c8cc'), 0.6, 1.8, 0.03, L - 0.32, A * (s - 1.1), 0.85);
  put(beige, 0.4, 1.8, 0.8, L - 0.22, A * (s - 1.1), 1.75);                         // 吊櫃
  put(M.white(), 0.4, 0.45, 0.5, L - 0.32, A * (s - 0.5), 0.88);                   // 烘碗機
  put(M.grey(), 0.04, 0.04, 0.25, L - 0.5, A * (s - 1.4), 0.88);                    // 水龍頭
  /* ---- 西牆（門那側）：行事曆大白板、壁扇 ---- */
  put(M.frame(), 1.9, 0.04, 1.2, L * 0.5, D * (s - 0.02), 1.0);
  put(scheduleBoardMat(), 1.8, 0.05, 1.1, L * 0.5, D * (s - 0.03), 1.05, true);
  put(M.white(), 0.35, 0.15, 0.35, L * 0.5 + 1.3, D * (s - 0.1), 2.2);
}
const oceanArtMat = () => once('oceanart', () => new THREE.MeshLambertMaterial({ map: bigTex(160, 110, (c, w, h) => {
  c.fillStyle = '#2a6ab8'; c.fillRect(0, 0, w, h); c.fillStyle = '#3f8ad0'; c.fillRect(0, 0, w, 30);
  c.fillStyle = '#4caf50'; for (let i = 0; i < 6; i++) c.fillRect(10 + i * 26, h - 30 + (i % 2) * 8, 8, 30);
  const fish = [['#f2c94c', 40, 50], ['#ff7043', 100, 40], ['#ffffff', 70, 75], ['#f48fb1', 125, 70]];
  for (const [col, x, y] of fish) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, 12, 7, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x - 20, y - 7); c.lineTo(x - 20, y + 7); c.fill(); }
}) }));
const kinderOfficeBoardMat = () => once('kofficeboard', () => new THREE.MeshLambertMaterial({ map: bigTex(200, 240, (c, w, h) => {
  c.fillStyle = '#dcebe2'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#4a4ab8'; c.font = 'bold 26px sans-serif'; c.fillText('溪口附幼', 40, 40);
  c.fillStyle = '#5a7ac8'; c.font = '16px sans-serif'; c.fillText('115 學年度', 60, 70);
  c.strokeStyle = '#7a8ac0'; c.lineWidth = 2; for (const x of [65, 135]) { c.beginPath(); c.arc(x, 120, 24, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x, 144); c.lineTo(x, 180); c.stroke(); }
  c.fillStyle = '#4a9a5a'; c.font = 'bold 24px sans-serif'; c.fillText('福氣滿滿', 50, 220);
}) }));
const scheduleBoardMat = () => once('kschedule', () => new THREE.MeshLambertMaterial({ map: bigTex(320, 200, (c, w, h) => {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#c9d0d8'; c.lineWidth = 1; for (let x = 10; x < w; x += 10) { c.beginPath(); c.moveTo(x, 20); c.lineTo(x, 110); c.stroke(); }
  c.fillStyle = '#333'; c.font = '10px sans-serif'; for (let d = 1; d <= 31; d++) c.fillText(String(d), d * 10 - 4, 14);
  c.fillStyle = '#d04a4a'; c.font = '18px sans-serif'; c.fillText('發展會議', 20, 70);
  c.fillStyle = '#222'; c.fillRect(0, 112, w, 4);
  for (const x of [30, 110, 190]) { c.fillStyle = '#f6d6c8'; c.beginPath(); c.arc(x, 160, 26, 0, 7); c.fill(); }
}) }));

function office(put, fr, name, room) {
  const W = fr.W, L = fr.L;
  if (name.includes('校長室') && room) return principalOffice(put, fr, room);
  if (name === '科任教師辦公室' && room) return subjectOffice(put, fr, room);   // 依照片
  if (name === '幼兒園辦公室') return kinderOffice(put, fr);   // 依照片
  if (name.includes('總務處') && room) return generalOffice(...flipU(put, fr), room);   // 白板在南牆、玻璃書櫃在北牆（使用者 10-27 說明）
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

// 幼兒園班級教室（星星班、太陽班、月亮班、彩虹班；依星星班 8 張照片）：
//   前牆：上方一整排淺木色吊櫃（投影布捲在下緣）、白板（日期條「年 月 日 天氣 星期」）、洞洞板＋幼兒名單；老師桌在門那側，前面一片洞洞板隔板
//   窗那側（校外）：窗下一整排米色矮櫃、粉紅色紗簾、時鐘；前段是扮家家酒廚房（磚紋流理臺＋掛鍋子的網架）、碎花桌巾小圓桌
//   後牆：山形綠色布告欄＋下面米色矮櫃、門那側角落到頂的米色高櫃（烤箱）、窗那側白色百葉門；帳篷、弧形收納櫃（白色收納盒）、綠色地墊
//   門那側：牆上掛網夾著小朋友的畫、矮書櫃上放木頭娃娃屋、繪本網架；中間低矮的木頭展示桌（拱形底座、白色托盤）、白色長桌＋小木椅、線軸圓桌
// u：從前牆往後；v：A 窗（校外）、D 門（走廊）；周周老師站在白板前（u≈1.2, v≈0.3），前面那張小矮桌是立體拼圖桌
// 前後對調（u → L-u）：put 和 fr.toLocal 一起換，函式裡用門的位置算的家具也跟著對
function flipU(put0, fr) {
  const L = fr.L;
  const put = (m, du, dv, h, u, v, y, plain) => put0(m, du, dv, h, L - u, v, y, plain);
  put.geo = (m, g, u, v, y, r = 0) => put0.geo(m, g, L - u, v, y, -r);
  return [put, { ...fr, toLocal: (x, z) => { const [u, v] = fr.toLocal(x, z); return [L - u, v]; } }];
}
function kinderClass(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A, s = W / 2;
  const lw = mat('planks', '#e6d3b5'), beige = mat('wool', '#e8dcc8'), wood = mat('planks', '#d9b98a'), white = M.white();
  const kidChair = (u, v) => {                                        // 幼兒園小木椅
    put(wood, 0.32, 0.32, 0.04, u, v, 0.28);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.04, 0.04, 0.28, u + a * 0.13, v + b * 0.13, 0);
  };
  const kidTable = (u, v, du, dv) => {                                 // 白色桌面、木頭桌腳（幼兒高度）
    put(white, du, dv, 0.04, u, v, 0.5);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.05, 0.05, 0.5, u + a * (du / 2 - 0.06), v + b * (dv / 2 - 0.06), 0);
  };
  /* ---- 前牆 ---- */
  put(lw, 0.45, W - 0.1, 0.7, 0.24, 0, 2.15);                                 // 吊櫃
  put(white, 0.1, 2.6, 0.1, 0.5, A * 0.6, 2.05);                               // 捲起來的投影布
  put(beige, 0.4, 3.0, 0.6, 0.2, A * 0.6, 0);                                  // 白板下的矮櫃
  put(M.frame(), 0.04, 2.5, 1.25, 0.02, A * 0.6, 0.8);
  put(kinderBoardMat(), 0.05, 2.4, 1.15, 0.04, A * 0.6, 0.85, true);         // 白板（照片、注音、數字）
  put(dateStripMat(), 0.05, 0.36, 1.2, 0.04, A * 2.05, 0.82, true);          // 日期條
  put(pegboardMat(), 0.05, 1.3, 1.5, 0.03, D * 1.25, 0.6, true);             // 洞洞板＋幼兒名單
  /* 老師桌（門那側，前面一片洞洞板隔板、上面放藤編圓墊） */
  put(lw, 0.7, 1.3, 0.75, 0.75, D * 1.95, 0);
  put(M.dark(), 0.05, 0.5, 0.32, 0.6, D * 1.95, 0.76); put(screenMat(), 0.02, 0.46, 0.28, 0.63, D * 1.95, 0.78);
  put(pegboardMat(false), 0.04, 1.3, 1.05, 1.12, D * 1.95, 0, true);
  put.geo(mat('wool', '#c8a46a'), new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16), 1.12, D * 1.6, 1.11);
  officeChair(put, 0.3, D * 1.95, 1, 0, '#2b2d31');
  put.geo(mat('wool', '#eceef0'), new THREE.CylinderGeometry(0.17, 0.17, 0.75, 16), 0.35, D * (s - 0.35), 0.375);   // 空氣清淨機
  put.geo(mat('wool', '#8e9399'), new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16), 0.35, D * (s - 0.35), 0.81);
  /* 投影機（吊在天花板） */
  put(white, 0.4, 0.35, 0.15, 1.8, A * 0.6, 2.55); put(M.grey(), 0.04, 0.04, 0.4, 1.8, A * 0.6, 2.7);
  /* 立體拼圖小矮桌（老師前面） */
  put(lw, 0.7, 1.0, 0.04, 2.1, A * 0.3, 0.4);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(lw, 0.05, 0.05, 0.4, 2.1 + a * 0.29, A * 0.3 + b * 0.44, 0);

  /* ---- 窗那側 ---- */
  put(beige, L - 1.2, 0.4, 0.75, L / 2, A * (s - 0.2), 0);                     // 窗下一整排矮櫃
  for (const k of [-1, 1]) put(mat('wool', '#f2a3a0'), 0.3, 0.05, 1.5, L * 0.55 + k * 0.25, A * (s - 0.05), 0.85);   // 粉紅紗簾
  put.geo(mat('wool', '#5fb3e0'), new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20).rotateX(Math.PI / 2), L * 0.45, A * (s - 0.03), 1.75, fr.alongX ? 0 : Math.PI / 2);   // 時鐘
  // 扮家家酒廚房：磚紋流理臺、上面網架掛平底鍋
  put(brickMat(), 1.1, 0.6, 0.55, 1.75, A * (s - 1.05), 0, true);
  put(mat('wool', '#f2efe8'), 1.1, 0.6, 0.03, 1.75, A * (s - 1.05), 0.55);
  put(white, 1.1, 0.03, 0.7, 1.75, A * (s - 1.33), 0.58);
  for (const [du, col] of [[-0.3, '#2b2b2b'], [0, '#9aa0a6'], [0.3, '#2b2b2b']]) put(mat('wool', col), 0.26, 0.04, 0.26, 1.75 + du, A * (s - 1.3), 0.86);
  put(mat('wool', '#2a7be4'), 0.35, 0.3, 0.14, 1.45, A * (s - 1.0), 0.58); put(mat('wool', '#3cc04a'), 0.35, 0.3, 0.1, 2.05, A * (s - 1.0), 0.58);
  // 碎花桌巾小圓桌（前面窗邊角落）
  put.geo(mat('wool', '#f2d98a'), new THREE.CylinderGeometry(0.42, 0.45, 0.5, 18), 0.75, A * (s - 1.2), 0.25);
  // 白色長桌兩張＋小木椅（窗那側、中段）
  kidTable(L * 0.5, A * 2.25, 0.75, 1.5);
  for (const dv of [-0.4, 0.4]) for (const k of [-1, 1]) kidChair(L * 0.5 + k * 0.6, A * 2.25 + dv);

  /* ---- 後牆 ---- */
  put(greenBoardMat(), 0.04, 2.6, 1.35, L - 0.03, A * 0.3, 1.05, true);        // 山形綠色布告欄
  put(beige, 0.5, 2.4, 0.85, L - 0.26, A * 0.3, 0);                             // 下面的矮櫃（熱水壺、籃子）
  put(mat('wool', '#e86aa0'), 0.25, 0.4, 0.15, L - 0.3, A * 0.9, 0.85); put(M.grey(), 0.18, 0.18, 0.24, L - 0.3, D * 0.4, 0.85);
  put(beige, 0.55, 1.4, 2.6, L - 0.28, D * (s - 0.72), 0);                      // 門那側角落到頂的高櫃
  put(white, 0.4, 0.5, 0.32, L - 0.6, D * (s - 0.72), 1.15);                    // 烤箱（嵌在高櫃中段）
  put(mat('wool', '#f4f4f0'), 0.04, 0.9, 2.0, L - 0.02, A * (s - 0.6), 0, true);   // 白色百葉門
  for (let y = 0.2; y < 1.9; y += 0.12) put(M.grey(), 0.02, 0.8, 0.02, L - 0.05, A * (s - 0.6), y);
  // 帳篷（白色、披著小被子）、弧形收納櫃＋白色收納盒、綠色地墊
  put(mat('wool', '#7ab26a'), 1.9, 1.7, 0.02, L - 2.0, A * 1.85, 0);
  put.geo(mat('wool', '#f7f4ee'), new THREE.ConeGeometry(0.62, 1.5, 4), L - 1.05, A * (s - 1.05), 0.75, Math.PI / 4);
  put(mat('wool', '#e9c98a'), 0.5, 0.05, 0.9, L - 1.05, A * (s - 1.45), 0.25);
  put(wood, 0.45, 1.5, 0.72, L - 2.3, A * 0.95, 0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) put(white, 0.04, 0.38, 0.24, L - 2.54, A * 0.95 + (i - 1) * 0.46, 0.06 + j * 0.34);
  put(mat('wool', '#2a6ad0'), 0.3, 0.42, 0.18, L - 2.3, A * 1.5, 0.72);       // 藍色籃子

  /* ---- 門那側 ---- */
  const u1 = 2.5, u2 = L - 2.5;                                                 // 兩扇門中間
  put(wood, u2 - u1, 0.38, 0.75, (u1 + u2) / 2, D * (s - 0.2), 0);             // 矮書櫃
  for (let u = u1 + 0.15; u < u2 - 0.1; u += 0.12) put(mat('wool', ['#e8505b', '#5fb3e0', '#f2c94c', '#6fcf97', '#bb6bd9'][Math.round(u * 8) % 5]), 0.08, 0.04, 0.24, u, D * (s - 0.4), 0.05);
  dollhouse(put, (u1 + u2) / 2 - 0.2, D * (s - 0.2), 0.75, fr);
  put(artNetMat(), u2 - u1 + 0.6, 0.03, 1.0, (u1 + u2) / 2, D * (s - 0.03), 1.25, true);   // 掛網夾著小朋友的畫
  // 白色長桌兩張＋小木椅（門那側、中段）、線軸圓桌
  kidTable(L * 0.5, D * 1.8, 0.75, 1.5);
  for (const dv of [-0.4, 0.4]) for (const k of [-1, 1]) kidChair(L * 0.5 + k * 0.6, D * 1.8 + dv);
  put.geo(mat('planks', '#c99a62'), new THREE.CylinderGeometry(0.45, 0.45, 0.06, 18), L * 0.72, D * 1.6, 0.45);
  put.geo(mat('planks', '#b88a55'), new THREE.CylinderGeometry(0.16, 0.16, 0.42, 12), L * 0.72, D * 1.6, 0.21);
  // 繪本網架（白色網格，掛幾本繪本）
  gridRack(put, L - 2.6, D * 0.95, 1.2, 1.05, 0);
  for (const [dv, col] of [[-0.35, '#bb6bd9'], [0.05, '#e86aa0'], [0.4, '#5fb3e0']]) put(mat('wool', col), 0.03, 0.32, 0.34, L - 2.63, D * 0.95 + dv, 0.62);

  /* ---- 中間：低矮的木頭展示桌（拱形底座、上面白色托盤、小網架） ---- */
  const tu = L * 0.62, tv = A * 0.25;
  put(lw, 1.6, 0.9, 0.12, tu, tv, 0.38);
  for (const k of [-1, 1]) put(lw, 1.6, 0.06, 0.38, tu, tv + k * 0.42, 0);
  for (const k of [-1, 0, 1]) put(lw, 0.06, 0.9, 0.38, tu + k * 0.77, tv, 0);
  for (const k of [-1, 1]) put(white, 0.65, 0.6, 0.06, tu + k * 0.38, tv, 0.5);
  gridRack(put, tu, tv, 0.8, 0.5, 0.56);
  put(mat('wool', '#3cc04a'), 0.12, 0.12, 0.12, tu - 0.4, tv - 0.1, 0.56); put(mat('wool', '#e8505b'), 0.1, 0.18, 0.1, tu - 0.3, tv + 0.12, 0.56);
}
// 白色網架（立在 u 位置、沿著 v 方向、寬 w 高 h、底部在 y）：外框＋一格一格的細鐵線
function gridRack(put, u, v, w, h, y) {
  const wire = M.white();
  for (const k of [-1, 1]) put(wire, 0.03, 0.03, h, u, v + k * w / 2, y);
  for (let z = 0; z <= h + 0.001; z += h / 6) put(wire, 0.015, w, 0.015, u, v, y + z);
  for (let t = -w / 2 + w / 6; t < w / 2 - 0.01; t += w / 6) put(wire, 0.015, 0.015, h, u, v + t, y);
}
// 木頭娃娃屋（白色牆、淺綠窗、藍色屋頂）
function dollhouse(put, u, v, y, fr) {
  put(mat('wool', '#f6f3ea'), 0.6, 0.3, 0.45, u, v, y);
  put(mat('wool', '#9ed39a'), 0.02, 0.1, 0.12, u - 0.31, v - 0.05, y + 0.2);
  put(mat('wool', '#9ed39a'), 0.02, 0.1, 0.12, u - 0.31, v + 0.08, y + 0.2);
  put.geo(mat('wool', '#4a8fd8'), new THREE.ConeGeometry(0.45, 0.3, 4).rotateY(Math.PI / 4).scale(1, 1, 0.55), u, v, y + 0.6, fr.alongX ? 0 : Math.PI / 2);
}
const pegboardMat = (poster = true) => once(`kpeg${poster}`, () => new THREE.MeshLambertMaterial({ map: bigTex(256, 300, (c, w, h) => {
  c.fillStyle = '#ddbf92'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#9a7a52'; for (let x = 10; x < w; x += 18) for (let y = 10; y < h; y += 18) { c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill(); }
  if (!poster) return;
  c.fillStyle = '#ffffff'; c.fillRect(70, 30, 120, 170);                       // 幼兒名單
  c.fillStyle = '#7fc8e8'; c.fillRect(70, 30, 120, 18);
  c.fillStyle = '#4a90c8'; for (let i = 0; i < 9; i++) c.fillRect(82, 58 + i * 15, 40, 8);
  c.fillStyle = '#f2c94c'; for (let i = 0; i < 9; i++) c.fillRect(132, 58 + i * 15, 46, 8);
}) }));
const kinderBoardMat = () => once('kboard', () => new THREE.MeshLambertMaterial({ map: bigTex(480, 230, (c, w, h) => {
  c.fillStyle = '#f7f8f6'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#c9ccce'; c.fillRect(w / 2 - 1, 0, 2, h);
  c.fillStyle = '#e04646'; c.font = 'bold 18px sans-serif'; c.fillText('一  二  三  四  五', 14, 26);
  const cols = ['#c86a3a', '#4a6aa8', '#e0a040', '#6aa850', '#a85a8a'];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {                    // 小朋友的照片＋紅色圈圈
    c.fillStyle = cols[(r + k) % 5]; c.beginPath(); c.arc(28 + k * 34, 60 + r * 40, 12, 0, 7); c.fill();
    c.strokeStyle = '#d04040'; c.lineWidth = 2; c.beginPath(); c.arc(44 + k * 34, 60 + r * 40, 9, 0, 7); c.stroke();
  }
  c.fillStyle = '#d04040'; c.font = '16px sans-serif';
  for (let r = 0; r < 9; r++) c.fillText(`${(r * 7) % 19 + 1}  ${(r * 5) % 13 + 2}`, w / 2 + 16, 30 + r * 22);
}) }));
const dateStripMat = () => once('kdate', () => new THREE.MeshLambertMaterial({ map: bigTex(72, 240, (c, w, h) => {
  c.fillStyle = '#d8f0b0'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffffff'; c.fillRect(6, 8, 60, 132);
  c.fillStyle = '#2a2a2a'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center';
  ['年', '月', '日'].forEach((t, i) => c.fillText(t, 36, 40 + i * 42));
  c.fillStyle = '#f2e27a'; c.fillRect(6, 148, 60, 84);
  c.fillStyle = '#2a2a2a'; c.font = 'bold 18px sans-serif'; c.fillText('天氣', 36, 176); c.fillText('星期', 36, 216);
}) }));
const greenBoardMat = () => once('kgreen', () => new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.5, map: bigTex(320, 170, (c, w, h) => {
  // 山形上緣（三座山）的綠色布告欄，米色木邊
  const ridge = [[0, 70], [40, 70], [40, 40], [90, 40], [140, 6], [190, 45], [230, 15], [270, 45], [270, 60], [w, 60]];
  c.beginPath(); c.moveTo(0, h); ridge.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(w, h); c.closePath();
  c.fillStyle = '#e6d3b5'; c.fill();
  c.save(); c.translate(6, 8); c.scale((w - 12) / w, (h - 14) / h); c.fillStyle = '#5f8a3a'; c.fill(); c.restore();
  c.fillStyle = '#ffffff'; c.fillRect(120, 50, 56, 80); c.fillRect(40, 80, 40, 30); c.fillRect(196, 70, 36, 46);
  c.fillStyle = '#e88a3a'; c.fillRect(120, 50, 56, 10);
}) }));
const brickMat = () => once('kbrick', () => new THREE.MeshLambertMaterial({ map: bigTex(128, 64, (c, w, h) => {
  c.fillStyle = '#e8dccc'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#b5684a';
  for (let r = 0; r < 8; r++) for (let k = -1; k < 8; k++) c.fillRect(k * 18 + (r % 2) * 9 + 1, r * 8 + 1, 16, 6);
}) }));
const artNetMat = () => once('knet', () => new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.4, map: bigTex(512, 160, (c, w, h) => {
  c.strokeStyle = 'rgba(200,190,170,.9)'; c.lineWidth = 2;
  for (let x = -60; x < w; x += 22) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60, h); c.stroke(); c.beginPath(); c.moveTo(x + 60, 0); c.lineTo(x, h); c.stroke(); }
  const cols = ['#e8505b', '#5fb3e0', '#f2c94c', '#6fcf97', '#bb6bd9', '#f28c38'];
  for (let i = 0; i < 18; i++) {                                                // 小朋友的畫
    const x = 8 + (i % 9) * 56, y = 8 + Math.floor(i / 9) * 76 + (i % 3) * 4;
    c.fillStyle = i % 4 === 1 ? '#f3dcb8' : '#ffffff'; c.fillRect(x, y, 46, 62);
    c.strokeStyle = cols[i % 6]; c.lineWidth = 3; c.beginPath(); c.arc(x + 23, y + 30, 12, 0, 7); c.stroke();
    c.fillStyle = cols[(i + 2) % 6]; c.fillRect(x + 8, y + 44, 30, 8);
  }
}) }));

function danceRoom(put, fr, room) {
  const A = fr.away, v = A * (fr.W / 2 - 0.03);   // 不靠門那面牆：一整面鏡子 + 把桿（這面牆也有門的話，門口斷開）
  const du = (room?.doorPts || []).map((d) => fr.toLocal(d.x, d.z)).filter(([, dv]) => dv * A > 0).map(([u]) => u).sort((a, b) => a - b);
  const runs = []; let s0 = 0.5;
  for (const d of du) { if (d - 0.9 > s0 + 0.3) runs.push([s0, d - 0.9]); s0 = Math.max(s0, d + 0.9); }
  if (fr.L - 0.5 > s0 + 0.3) runs.push([s0, fr.L - 0.5]);
  for (const [a, b] of runs) {
    put(mirrorMat(), b - a, 0.04, 2.0, (a + b) / 2, v, 0.32, true);
    put(M.wood(), b - a, 0.05, 0.05, (a + b) / 2, v - A * 0.25, 1.0);
    for (let u = a + 0.3; u < b; u += 2) put(M.grey(), 0.04, 0.25, 0.04, u, v - A * 0.13, 1.0);
  }
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
  //   房間窄的時候（潛能教室二）整組往北靠，南邊高櫃前留約 0.85 公尺走道：不然兩排椅子把南北都塞住，到不了東邊老師桌
  const blue = mat('wool', '#9fd0ea'), wood = mat('wool', '#c8955a'), tv0 = D * 0.4, tu = Math.min(L / 2, Math.max(1.58, L - 2.51));
  for (const du of [-0.34, 0.34]) for (const k of [-1, 0, 1]) {
    const u = tu + du, v = tv0 + k * 0.95;
    put(blue, 0.66, 0.92, 0.04, u, v, 0.6);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put(wood, 0.05, 0.05, 0.6, u + a * 0.28, v + b * 0.4, 0);
    const cu = u + Math.sign(du) * 0.55;
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
  put(mat('wool', '#b8bcc0'), 1.35, 0.05, 1.2, 1.325, A * (W / 2 - 1.75), 0);    // 屏風跟前牆留 0.65 公尺，走得進老師座位（原本只剩 0.5，人卡住）
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

// B1 敬業樓地下室（依照片）：一大片磨石子地、白柱子包紫色防撞墊、牆邊藍色防撞墊、淺藍天花板＋橘色水管＋吊掛日光燈；
//   北半邊是桌球區（藍色 STIGA 桌球桌、深藍／寶藍色擋板、收起來的桌子、發球網），中間是自行車道（白線、斑馬線、腳踏車圖示、吊掛紅綠燈），
//   南牆一整排自行車安全海報，東端（甲梯出口）彩虹壁畫「至善 思源 敬業 勤學」＋白色雙開門，旁邊跳高軟墊、橘色布幕、巧拼
//   u：從北牆往南（0～L），v：從中間往東為正（西 -W/2、東 +W/2）
const bikePosterMat = (k) => once('bikeposter' + k, () => new THREE.MeshLambertMaterial({ map: bigTex(880, 340, (c, w, h) => {
  const [title, col, band] = [['自行車上路須知', '#c0392b', '#f3e7ff'], ['自行車號誌須知', '#c0392b', '#ffeef0'],
    ['自行車騎行守則', '#1f5fa8', '#e8f3ff'], ['自行車體驗區', '#2e7d32', '#eef8ea']][k];
  c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h);
  c.fillStyle = band; c.fillRect(0, 0, w, 60);
  c.strokeStyle = '#d9d9d9'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
  c.fillStyle = '#fff6e0'; c.fillRect(24, 22, 260, 58); c.strokeStyle = col; c.lineWidth = 4; c.strokeRect(24, 22, 260, 58);
  c.fillStyle = col; c.font = '900 34px "Noto Sans TC", sans-serif'; c.textBaseline = 'middle'; c.fillText(title, 36, 52);
  // 插圖：小朋友騎腳踏車、號誌、圓形圖示（只畫成色塊，字太小看不清）
  const bike = (x, y, s, frame) => {
    c.strokeStyle = '#333'; c.lineWidth = 3 * s;
    for (const dx of [-28, 28]) { c.beginPath(); c.arc(x + dx * s, y, 20 * s, 0, 7); c.stroke(); }
    c.strokeStyle = frame; c.lineWidth = 5 * s; c.beginPath(); c.moveTo(x - 28 * s, y); c.lineTo(x - 6 * s, y - 26 * s); c.lineTo(x + 18 * s, y - 26 * s); c.lineTo(x + 28 * s, y); c.moveTo(x - 6 * s, y - 26 * s); c.lineTo(x, y); c.lineTo(x + 18 * s, y - 26 * s); c.stroke();
    c.fillStyle = '#f2a65a'; c.beginPath(); c.arc(x, y - 52 * s, 9 * s, 0, 7); c.fill();
    c.fillStyle = '#e8762b'; c.beginPath(); c.arc(x, y - 56 * s, 10 * s, Math.PI, 0); c.fill();
  };
  if (k === 3) bike(170, 230, 2.2, '#d63a2a');
  else for (let i = 0; i < 3; i++) bike(90 + i * 120, 250, 0.9, ['#2a7ad6', '#d63a2a', '#2e9a4a'][i]);
  const colors = ['#f2b134', '#5bb0e0', '#e8584f', '#7cc38a', '#9b7ad6'];
  for (let i = 0; i < 6; i++) {
    const x = 460 + (i % 3) * 135, y = 100 + Math.floor(i / 3) * 120;
    c.fillStyle = '#ffffff'; c.fillRect(x, y, 120, 105); c.strokeStyle = colors[(i + k) % 5]; c.lineWidth = 5; c.strokeRect(x, y, 120, 105);
    c.fillStyle = colors[(i + k + 2) % 5]; c.beginPath(); c.arc(x + 60, y + 45, 28, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 15, y + 82, 90, 6);
  }
  c.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 0; i < 5; i++) c.fillRect(30, 110 + i * 14, 380 - (i % 2) * 60, 5);
}) }));
const rainbowMuralMat = () => once('rainbowmural', () => new THREE.MeshLambertMaterial({ map: bigTex(900, 400, (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#5cb6ea'); sky.addColorStop(1, '#c9ecff');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, y] of [[90, 40], [760, 60], [520, 30]]) { c.beginPath(); c.ellipse(x, y, 50, 16, 0, 0, 7); c.fill(); }
  ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'].forEach((col, i) => {
    c.strokeStyle = col; c.lineWidth = 12; c.beginPath(); c.arc(450, 330, 250 - i * 12, Math.PI, 0); c.stroke();
  });
  c.fillStyle = '#1d3a8a'; c.font = '900 34px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.fillText('至善　思源　敬業　勤學', 450, 52);
  c.fillStyle = '#8bd36a'; c.fillRect(0, 300, w, 100);
  c.fillStyle = '#ffffff'; for (let x = 0; x < w; x += 22) c.fillRect(x, 290, 6, 30);                 // 白色小圍籬
  for (let i = 0; i < 40; i++) { c.fillStyle = ['#ff6b8a', '#ffd23a', '#ffffff', '#8a6ae0'][i % 4]; c.beginPath(); c.arc(20 + (i * 97) % w, 330 + (i * 37) % 60, 5, 0, 7); c.fill(); }
  for (const [x, s] of [[300, 1], [700, 0.8]]) {                                                   // 兩棵大樹
    c.fillStyle = '#7a5232'; c.fillRect(x - 10 * s, 220, 20 * s, 100);
    c.fillStyle = '#5bb33a'; c.beginPath(); c.arc(x, 190, 70 * s, 0, 7); c.fill(); c.fillStyle = '#7fd04a'; c.beginPath(); c.arc(x - 25 * s, 175, 40 * s, 0, 7); c.fill();
  }
  c.fillStyle = '#2f6b4f'; c.fillRect(400, 240, 110, 70); c.strokeStyle = '#8a5a2a'; c.lineWidth = 5; c.strokeRect(400, 240, 110, 70);   // 小黑板
  c.fillStyle = '#ffffff'; c.font = '700 16px sans-serif'; c.fillText('1+5=6', 455, 270); c.fillText('4+1=5', 455, 294);
  const kid = (x, y, shirt, hair) => {
    c.fillStyle = '#f5c99a'; c.beginPath(); c.arc(x, y, 15, 0, 7); c.fill();
    c.fillStyle = hair; c.beginPath(); c.arc(x, y - 4, 15, Math.PI, 0); c.fill();
    c.fillStyle = shirt; c.fillRect(x - 12, y + 14, 24, 28); c.fillStyle = '#3a4a8a'; c.fillRect(x - 10, y + 42, 8, 16); c.fillRect(x + 2, y + 42, 8, 16);
  };
  kid(150, 250, '#e53935', '#3a2a1a'); kid(560, 280, '#e53935', '#3a2a1a'); kid(620, 285, '#fdd835', '#5a3a1a'); kid(820, 275, '#e53935', '#2a1a10');
  c.fillStyle = '#f5c99a'; c.beginPath(); c.arc(100, 205, 17, 0, 7); c.fill(); c.fillStyle = '#c99a5a'; c.beginPath(); c.arc(100, 198, 17, Math.PI, 0); c.fill();   // 老師
  c.fillStyle = '#f19ab0'; c.fillRect(85, 222, 30, 50); c.fillStyle = '#8a8a8a'; c.fillRect(88, 272, 10, 30); c.fillRect(102, 272, 10, 30);
}) }));
function bikeIconMat() {
  return once('bikeicon', () => new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.4, map: bigTex(256, 160, (c, w, h) => {
    c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = 12;
    for (const x of [60, 196]) { c.beginPath(); c.arc(x, 110, 40, 0, 7); c.stroke(); }
    c.beginPath(); c.moveTo(60, 110); c.lineTo(110, 60); c.lineTo(170, 60); c.lineTo(196, 110); c.stroke();
    c.beginPath(); c.arc(130, 24, 16, 0, 7); c.fill(); c.fillRect(112, 40, 30, 30);
  }) }));
}
function tableTennisHall(put, fr) {
  const W = fr.W, L = fr.L;
  const white = M.white(), purple = mat('wool', '#8a2fa0'), blue = mat('wool', '#1d5fc4'), line = mat('wool', '#fbfbfb');
  put(mat('tile', '#d6d6d2'), L, W, 0.012, L / 2, 0, 0);                         // 灰白磨石子地
  // 柱子：白色、下段包紫色防撞墊（三排、每 5 公尺一根）
  const rowsU = [6.0, 11.4, 16.8], colsV = [];
  for (let v = -20; v <= 20; v += 5) colsV.push(v);
  for (const u of rowsU) for (const v of colsV) { put(white, 0.55, 0.55, 2.36, u, v, 0); put(purple, 0.78, 0.78, 1.55, u, v, 0); }
  // 南北兩面牆的壁柱：藍色防撞墊（南牆貼海報的地方也一樣）
  for (const v of colsV) for (const [u, s] of [[0.25, 1], [L - 0.25, -1]]) { put(white, 0.5, 0.6, 2.36, u, v, 0); put(blue, 0.55, 0.9, 1.55, u + s * 0.04, v, 0); }
  // 天花板（B1 上面就是地面，室內高 2.4 公尺）：淺藍色天花板、橘色水管、吊掛日光燈
  put(mat('wool', '#cfe4ec'), L, W, 0.02, L / 2, 0, 2.36);
  const orange = mat('wool', '#e0582a'), lamp = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#fffbe8', emissiveIntensity: 0.9 });
  for (const u of [3.5, 7.2, 20.5]) put(orange, 0.12, W - 0.6, 0.12, u, 0, 2.2);   // 避開桌球比賽那張桌子上方（鏡頭）
  for (const u of [3.0, 8.7, 14.1, 19.6]) for (let v = -22.5; v <= 22.5; v += 4.5) {
    put(M.grey(), 0.02, 0.02, 0.2, u, v - 0.5, 2.16); put(M.grey(), 0.02, 0.02, 0.2, u, v + 0.5, 2.16);
    put(M.grey(), 0.2, 1.3, 0.06, u, v, 2.1); put(lamp, 0.12, 1.2, 0.02, u, v, 2.08);
  }
  // 北半邊：桌球區（靠北牆一排、西半邊再一區），外面圍一圈擋板
  const tableTop = mat('wool', '#1f4fa0'), leg = mat('wool', '#d8dadc'), netMat = mat('wool', '#16244a');
  const pingTable = (u, v) => {
    put(tableTop, 1.525, 2.74, 0.04, u, v, 0.72); put(white, 1.53, 0.02, 0.005, u, v, 0.76);   // 桌面＋中線
    put(netMat, 1.7, 0.02, 0.15, u, v, 0.76);                                                // 網子
    for (const dv of [-1.0, 1.0]) for (const du of [-0.6, 0.6]) put(leg, 0.05, 0.05, 0.72, u + du, v + dv, 0);
    put(leg, 0.04, 2.0, 0.04, u, v, 0.15);
  };
  for (let v = -22; v <= 18; v += 4) pingTable(2.9, v);
  for (let v = -21; v <= -5; v += 4) pingTable(8.7, v);
  pingTable(8.7, 2.5);                                                   // 林老師打桌球用的那張（app.js ppTable）
  const cabort = mat('wool', '#252a78'), chanson = mat('wool', '#2563c9');
  const fence = (u, v, du, dv, k) => put(k % 3 === 1 ? chanson : cabort, du, dv, 0.72, u, v, 0.05);
  for (let v = -23, k = 0; v < 19; v += 2.1, k++) if (k % 4 !== 3) fence(5.3, v + 1, 0.04, 2.0, k);    // 桌球區南邊那排擋板（每隔幾片留一個缺口進出）
  for (let v = -23, k = 0; v < -3; v += 2.1, k++) fence(11.0, v + 1, 0.04, 2.0, k + 1);
  for (let u = 6.6, k = 0; u < 10.8; u += 2.1, k++) fence(u + 1, -2.6, 2.0, 0.04, k);
  // 北牆邊：收起來立著的桌球桌、發球網
  for (let v = -17.5; v <= 12.5; v += 5) { put(tableTop, 0.12, 1.5, 1.45, 0.75, v, 0.15); put(leg, 0.5, 1.4, 0.15, 0.75, v, 0); }
  put(blue, 0.04, 2.2, 1.5, 0.7, 19.5, 0.3); for (const dv of [-1.1, 1.1]) put(blue, 0.8, 0.04, 1.8, 1.0, 19.5 + dv, 0);
  // 自行車道：兩條白線、斑馬線、腳踏車圖示、終點方框（白線）
  put(line, 0.08, 36, 0.006, 12.5, 3, 0.013); put(line, 0.08, 36, 0.006, 14.1, 3, 0.013);
  for (let v = 4; v <= 13; v += 0.7) put(line, 1.6, 0.32, 0.006, 15.2, v, 0.013);
  put(bikeIconMat(), 1.1, 1.6, 0.004, 13.3, -6, 0.016, true);
  for (const [a, b] of [[10.5, 15.2], [17.6, 15.2]]) put(line, 0.08, 9, 0.006, a, 20.5, 0.013);   // 東端方框
  for (const v of [16, 25]) put(line, 7.1, 0.08, 0.006, 14.05, v, 0.013);
  for (let v = 17.5; v <= 23.5; v += 1.5) put(line, 2.2, 0.06, 0.006, 11.6, v, 0.013);
  // 吊掛的綠色紅綠燈（三個燈＋兩個燈的行人號誌）
  const signal = mat('wool', '#2f6b3a'), lens = mat('wool', '#1b2420');
  for (const [u, v] of [[11.0, 4], [11.0, 16]]) {
    put(M.grey(), 0.04, 0.04, 0.12, u, v, 2.24); put(signal, 0.32, 1.0, 0.3, u, v, 1.94);
    for (const dv of [-0.32, 0, 0.32]) put(lens, 0.02, 0.24, 0.24, u - 0.17, v + dv, 1.97);
  }
  put(signal, 0.3, 0.32, 0.62, 16.8 - 0.42, 10, 1.6); for (const y of [1.66, 1.94]) put(lens, 0.02, 0.24, 0.24, 16.8 - 0.58, 10, y);
  // 南牆：自行車安全海報（四大張，貼在藍色防撞墊中間）
  [-12.5, -7.5, -2.5, 2.5].forEach((v, k) => put(bikePosterMat(k), 0.03, 4.2, 1.62, L - 0.03, v, 0.55, true));
  put(white, 0.01, 0.4, 0.55, L - 0.04, 7.5, 1.2);                                            // 柱子上的闖關單（第十站）
  // 東南角：跳高軟墊、跳高架、橘色布幕、疊起來的巧拼
  put(mat('wool', '#3a7fd0'), 3.2, 4.0, 0.45, 19.6, 20.0, 0); put(mat('wool', '#4a8fe0'), 2.8, 3.6, 0.2, 19.6, 20.0, 0.45);
  for (const du of [-1.9, 1.9]) put(M.grey(), 0.05, 0.05, 1.5, 19.6 + du, 17.6, 0);
  put(mat('wool', '#f4f4f4'), 3.8, 0.04, 0.04, 19.6, 17.6, 1.25);
  put(mat('wool', '#e88a1a'), 0.04, 4.0, 2.2, L - 0.08, 19.5, 0.1);
  for (let i = 0; i < 9; i++) put(mat('wool', i % 3 ? '#2a9a6a' : '#3a6ad0'), 1.5, 1.5, 0.08, 21.2, 23.6, i * 0.09);
  // 東牆（甲梯出口）：彩虹壁畫、白色雙開門、消防栓箱
  put(rainbowMuralMat(), 5.0, 0.03, 2.2, 16.0, W / 2 - 0.03, 0.12, true);
  put(mat('wool', '#eceae4'), 2.0, 0.08, 2.2, 20.9, W / 2 - 0.06, 0); put(mat('glass'), 0.8, 0.09, 1.0, 20.5, W / 2 - 0.06, 1.2); put(mat('glass'), 0.8, 0.09, 1.0, 21.3, W / 2 - 0.06, 1.2);
  put(mat('wool', '#d23a2f'), 0.4, 0.15, 0.5, 7.0, W / 2 - 0.1, 1.2);
  put(mat('wool', '#e8e2c8'), 0.5, 0.12, 0.6, 7.6, W / 2 - 0.08, 1.4); put(mat('wool', '#e8e2c8'), 0.5, 0.12, 0.6, 8.3, W / 2 - 0.08, 1.4);
}

// 1F 幼兒園中央廚房（甲梯北邊、走廊對面是溪口家園）：紅磚色止滑地磚、靠牆不鏽鋼流理臺＋水槽、
//   北牆大灶＋排油煙罩、蒸飯箱、冰箱、中島備料台、送餐車（午餐送到各班）、菜單白板
function kinderKitchen(put, fr) {
  const W = fr.W, L = fr.L, A = fr.away, D = -A;
  const steel = mat('wool', '#cfd4d9'), steel2 = mat('wool', '#9ea6ad'), black = M.dark();
  put(mat('wool', '#c46a50'), L - 0.1, W - 0.1, 0.012, L / 2, 0, 0);                         // 止滑地磚
  // 東牆：長長的不鏽鋼流理臺、兩個水槽、上面一排層架（鍋碗）
  const cv = A * (W / 2 - 0.4), cu = L / 2 + 0.3, cl = L - 1.4;
  put(steel, cl, 0.7, 0.85, cu, cv, 0);
  for (const u of [L * 0.32, L * 0.56]) {
    put(steel2, 0.9, 0.5, 0.02, u, cv, 0.85);                                                 // 水槽
    put(M.grey(), 0.04, 0.04, 0.32, u, cv + A * 0.28, 0.85); put(M.grey(), 0.04, 0.22, 0.04, u, cv + A * 0.18, 1.15);   // 水龍頭
  }
  put(steel, cl, 0.35, 0.03, cu, A * (W / 2 - 0.2), 1.65);                                    // 層架
  for (let i = 0; i < 7; i++) put.geo(steel2, new THREE.CylinderGeometry(0.13, 0.11, 0.18, 12), cu - cl / 2 + 0.5 + i * (cl - 1) / 6, A * (W / 2 - 0.2), 1.77);
  // 北牆：兩口大灶（上面大湯鍋）＋排油煙罩
  for (const v of [A * 0.9, A * 2.0]) {
    put(black, 0.9, 0.95, 0.7, 0.55, v, 0);
    put.geo(steel, new THREE.CylinderGeometry(0.36, 0.33, 0.5, 18), 0.55, v, 0.95);
  }
  put(steel, 0.9, 2.5, 0.08, 0.5, A * 1.45, 2.2); put(steel, 0.08, 2.5, 0.45, 0.93, A * 1.45, 1.95);   // 油煙罩
  put(steel2, 0.25, 0.25, 0.6, 0.15, A * 1.45, 2.3);                                         // 排氣管
  // 西北角：蒸飯箱（不鏽鋼高櫃、門上有把手）
  put(steel, 0.85, 1.0, 1.75, 0.55, D * 1.0, 0);
  for (const y of [0.45, 1.2]) put(black, 0.03, 0.5, 0.05, 0.99, D * 1.0, y);
  // 西牆（門以北）：兩台營業用冰箱、鐵架上的餐盤
  for (const u of [1.6, 2.5]) { put(steel, 0.85, 0.75, 1.95, u, D * (W / 2 - 0.45), 0); put(black, 0.4, 0.03, 0.04, u, D * (W / 2 - 0.84), 1.1); }
  const ru = 3.8, rv = D * (W / 2 - 0.3);
  for (const [du, dv] of [[-0.55, -0.2], [0.55, -0.2], [-0.55, 0.2], [0.55, 0.2]]) put(M.grey(), 0.04, 0.04, 1.6, ru + du, rv + dv, 0);
  for (const y of [0.2, 0.7, 1.2]) { put(M.grey(), 1.15, 0.45, 0.03, ru, rv, y); for (let i = 0; i < 3; i++) put(mat('wool', ['#f2c230', '#4fb0e0', '#e86ab0'][i]), 0.3, 0.32, 0.12, ru - 0.38 + i * 0.38, rv, y + 0.03); }
  // 中間：不鏽鋼中島備料台、砧板、大鋼盆
  const iu = L * 0.45, iv = A * 0.3;
  put(steel, 3.0, 1.0, 0.85, iu, iv, 0); put(steel2, 2.9, 0.9, 0.04, iu, iv, 0.2);              // 下層隔板
  put(mat('wool', '#f2f2ee'), 0.5, 0.35, 0.03, iu - 0.8, iv, 0.85); put(mat('wool', '#7fc26b'), 0.5, 0.35, 0.03, iu + 0.2, iv, 0.85);   // 白色、綠色砧板
  put.geo(steel2, new THREE.CylinderGeometry(0.25, 0.18, 0.14, 14), iu + 1.0, iv, 0.92);
  // 南邊（門旁）：兩台送餐車，上面放保溫湯桶和餐盒
  for (const v of [D * 0.6, A * 0.9]) {
    const u = L - 1.3;
    for (const y of [0.15, 0.8]) put(steel, 0.9, 0.6, 0.04, u, v, y);
    for (const [du, dv] of [[-0.42, -0.27], [0.42, -0.27], [-0.42, 0.27], [0.42, 0.27]]) { put(steel2, 0.04, 0.04, 0.8, u + du, v + dv, 0.04); put(black, 0.08, 0.08, 0.08, u + du, v + dv, 0); }
    put.geo(mat('wool', '#e8ecef'), new THREE.CylinderGeometry(0.2, 0.2, 0.32, 14), u - 0.18, v, 1.0);
    put(mat('wool', '#4fb0e0'), 0.35, 0.45, 0.14, u + 0.25, v, 0.84);
  }
  // 南牆：菜單白板（今天的午餐）
  put(M.white(), 0.04, 1.6, 1.0, L - 0.03, A * 1.8, 1.1);
  for (let i = 0; i < 4; i++) put(mat('wool', ['#d63a3a', '#2e6fd8', '#3ba55c', '#f2a03a'][i]), 0.045, 0.9 - (i % 2) * 0.3, 0.06, L - 0.03, A * 1.8 - 0.2, 1.85 - i * 0.2);
}

/** 依名稱、種類挑布置 */
function furnishRoom(room, fr, put) {
  const n = room.name || '', t = room.type;
  curRoom = room;
  if (n === '穿堂') return entranceHall(put, fr, room);                     // 依照片：主題牆、海報牆、彩色天花板
  if (room.hidden || room.open || t === 'garden') return;
  if (t === 'wc' && room.floor === '1F' && room.building === 'B') return restroomWash(put, fr, room);   // 1F 白雲班旁：依照片
  if (t === 'wc') return restroom(put, fr, room);                       // 廁所入口屏風、木紋磚、植生牆
  if (t === 'class') return classroom(put, fr, room);
  if (n.includes('圖書館')) return library(put, fr, room);                     // 依 360 照片 04、05
  if (n.startsWith('幸運方塘')) return makerRoom(put, fr, room);                 // 依 360 照片 06
  if (n === '音樂教室二') return musicRoom2(put, fr);
  if (n === '美勞教室') return artRoom3(put, fr, room);
  if (n === '方陣教室') return phalanxRoom(put, fr, room);                      // 3F 方陣教室（科學情境教室），依 360 照片
  if (n === '客語教室') return hakkaRoom(put, fr, room);                        // 4F 客語教室（鄉土教室），依 360 照片
  if (n === '自然教室一' || n === '自然教室二') return natureRoom(put, fr, room);   // 2F 兩間自然教室，依照片（一樣的配置）                 // 3F 美勞教室，依照片              // 依照片
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
  if (n === '桌球教室') return tableTennisHall(put, fr);                // B1 敬業樓地下室，依照片
  if (n.includes('活動中心')) return gym(put, fr);
  if (n.includes('舞蹈') || n.includes('律動')) return danceRoom(put, fr, room);
  if (n === '會議室' && room.no === '111') return meetingRoom(put, fr, room);   // 1F 會議室依照片
  if (n === '幼兒園中央廚房') return kinderKitchen(put, fr);
  if (t === 'office') return office(put, fr, n, room);
  if (n === '星星班' || n === '太陽班') return kinderClass(...flipU(put, fr));   // 白板在南牆（使用者 10-27 說明）
  if (n === '月亮班' || n === '彩虹班') return kinderClass(put, fr);   // 依星星班照片
  if (t === 'kinder') return kinder(put, fr);
  if (t === 'storage') return storage(put, fr);
  if (n === '英語教室一') return englishRoom(put, fr, room);   // 依照片
  if (t === 'special' && n !== '桌球教室') { frontWall(put, fr); return groupTables(put, fr); }
}

/* ---------- 門牌 ---------- */

// 門牌英文（班級教室不用，維持中文＋班級代號）
export const ROOM_EN = {   // 也給 app.js 的英文介面用
  '人事室・會計室': 'Personnel & Accounting', '健康中心': 'Health Center', '儲藏室': 'Storage Room', '器材室': 'Equipment Room',
  '圖書館': 'Library', '團輔室': 'Group Counseling Room', '太陽班': 'Sun Class', '彩虹班': 'Rainbow Class', '星星班': 'Star Class',
  '月亮班': 'Moon Class', '白雲班': 'Cloud Class', '學務處': 'Student Affairs Office', '客語教室': 'Hakka Classroom',
  '家長會': "Parents' Association", '幸運方塘': 'Maker Space', '幼兒園辦公室': 'Kindergarten Office',
  '幼兒多功能活動室一': 'Kindergarten Activity Room 1', '幼兒多功能活動室二': 'Kindergarten Activity Room 2',
  '律動教室': 'Rhythm Room', '思科教室': 'Cisco Classroom', '溪口家園': 'Xikou Home', '幼兒園中央廚房': 'Kindergarten Central Kitchen', '教務處': 'Academic Affairs Office',
  '教師會辦公室': "Teachers' Association Office", '方陣教室': 'Science Discovery Room', '會議室': 'Meeting Room',
  '校長室': "Principal's Office", '桌球教室': 'Table Tennis Room', '油印室': 'Printing Room', '活動中心': 'Activity Center',
  '潛能教室一': 'Resource Room 1', '潛能教室二': 'Resource Room 2', '潛能教室三': 'Resource Room 3', '潛能教室四': 'Resource Room 4',
  '科任教師辦公室': 'Subject Teachers\' Office', '穿堂': 'Entrance Hall', '總務處': 'General Affairs Office', '美勞教室': 'Art Room',
  '自然教室一': 'Science Room 1', '自然教室二': 'Science Room 2', '舞蹈教室': 'Dance Room', '英語教室一': 'English Room 1',
  '英語教室二': 'English Room 2', '視聽教室': 'Audio-Visual Room', '諮商室': 'Counseling Room', '警衛室': 'Security Office',
  '資訊室': 'IT Office', '輔導室': 'Counseling Office', '電腦教室一': 'Computer Lab 1', '電腦教室二': 'Computer Lab 2',
  '音樂教室一': 'Music Room 1', '音樂教室二': 'Music Room 2', '廁所': 'Restroom', '性別友善廁所': 'All-Gender Restroom',
};
const roomEn = (title) => ROOM_EN[title.replace(/^🚻\s*/, '')] || '';
// en：英文（有的話中文縮小一點，分三行：中文／英文／編號）
function signTexture(title, sub, kind, en = '') {
  if (en) return bigTex(512, 176, (c, w, h) => {
    const theme = { room: { bg: '#1e3a5f', border: '#c9a227', ink: '#ffffff', en: '#e8eef6', sub: '#ffd970' },
      wc: { bg: '#3b6e8f', border: '#ffffff', ink: '#ffffff', en: '#e6f6ff', sub: '#dff' } }[kind];
    c.fillStyle = theme.border; c.fillRect(0, 0, w, h);
    c.fillStyle = theme.bg; c.fillRect(10, 10, w - 20, h - 20);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const fit = (text, weight, size, min) => { let fs = size; c.font = `${weight} ${fs}px "Noto Sans TC", sans-serif`; while (c.measureText(text).width > w - 44 && fs > min) { fs -= 2; c.font = `${weight} ${fs}px "Noto Sans TC", sans-serif`; } };
    const y1 = sub ? 50 : 62, y2 = sub ? 104 : 124;
    c.fillStyle = theme.ink; fit(title, 900, 62, 28); c.fillText(title, w / 2, y1);
    c.fillStyle = theme.en; fit(en, 700, 36, 18); c.fillText(en, w / 2, y2);
    if (sub) { c.fillStyle = theme.sub; c.font = '700 28px "Noto Sans TC", sans-serif'; c.fillText(sub, w / 2, 146); }
  });
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
  const mains = room.mainDoor ? (room.doorPts || []).filter((d) => d.side === room.mainDoor) : [];
  if (room.signEnd === 'E') mains.sort((a, b) => b.x - a.x);         // signEnd：門牌掛在東邊那扇
  const door = mains[0] || (flipped(room) ? room.doorPts?.at(-1) : room.doorPts?.[0]);   // mainDoor：主要門口在哪一面
  if (!door) return;
  let title, sub, kind;
  if (room.type === 'class') { title = room.display; sub = room.code; kind = 'class'; }
  else if (room.type === 'wc') { title = room.sign || '🚻 廁所'; sub = ''; kind = 'wc'; }
  else { title = (room.name || '').replace(/（.*?）/g, ''); sub = room.no || ''; kind = 'room'; }
  if (!title) return;
  const face = new THREE.MeshLambertMaterial({ map: signTexture(title, sub, kind, kind === 'class' ? '' : roomEn(title)) });   // 班級教室牌維持中文＋代號
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
  // 室內的家具不投射太陽的陰影（屋頂、牆壁本來就擋住太陽，每張畫面再畫一次影子是白工，學校的內顯電腦會很吃力）；
  //   中庭、露臺、穿堂這種露天的地方照舊有影子
  const batch = new Batch(), outdoor = new Batch();
  for (const room of f.rooms) {
    const fr = frameOf(room, wallT, flipped(room));
    const b = room.open || room.type === 'garden' ? outdoor : batch;
    const put = placer(b, fr, room.ground ? 0 : f.y);              // 警衛室在地面高度
    furnishRoom(room, fr, put);
    if (!put.lit && !room.hidden && !room.open && !['garden', 'hall'].includes(room.type) && !(room.name || '').includes('活動中心')) ceilingTubes(put, fr);
  }
  const g = new THREE.Group();
  batch.build(g, { cast: false });
  outdoor.build(g);
  // 中庭：遊樂器材、南洋杉、樹籬
  const court = f.rooms.find((r) => r.name === '中庭');
  if (court) decorateCourtyard(court.m, f.level === 0 ? 0 : f.y).build(g);   // 中庭在地面（建築一樓有墊高）
  for (const room of f.rooms) {
    if (room.hidden || room.open || room.type === 'garden' || room.type === 'hall') continue;
    addSign(room, f, g, wallT);
  }
  return g;
}
