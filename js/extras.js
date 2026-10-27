import * as THREE from 'three';
import { Batch, mat, SPOTS } from './blocks.js?v=235';

/* =========================================================
 * 戶外特別場景（依使用者提供的照片）
 *   - 水漾游泳館：外觀（白色浪板牆＋藍色波浪、東西兩端都有藍色泡泡立面、入口在東端、西面藍白條紋）＋室內泳池
 *   - 游泳池旁的遊戲場：白色小木屋塔＋黃綠螺旋管狀滑梯
 *   - 橘貓彩蛋：坐在游泳館入口階梯上
 * ========================================================= */

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const cache = {};
const once = (k, f) => (cache[k] ||= f());

/* ---------- 游泳館外牆：一張貼圖代表 8 公尺寬 × 6 公尺高 ---------- */
export const poolWallMat = () => once('poolwall', () => new THREE.MeshLambertMaterial({ map: canvasTex(512, 384, (c, w, h) => {
  c.fillStyle = '#eef0f2'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { c.fillStyle = x % 16 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.5)'; c.fillRect(x, 0, 4, h); }   // 浪板
  c.fillStyle = '#9aa0a6'; c.fillRect(0, h - 26, w, 26);                                  // 牆腳
  // 一排格柵窗（離地約 3 公尺）
  for (const x0 of [40, 300]) {
    c.fillStyle = '#2a3036'; c.fillRect(x0, 128, 170, 62);
    c.strokeStyle = '#d8dde2'; c.lineWidth = 2;
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(x0 + i * 22, 128); c.lineTo(x0 + i * 22 + 40, 190); c.stroke(); c.beginPath(); c.moveTo(x0 + i * 22 + 40, 128); c.lineTo(x0 + i * 22, 190); c.stroke(); }
    c.strokeStyle = '#ffffff'; c.lineWidth = 5; c.strokeRect(x0, 128, 170, 62);
  }
  // 藍色波浪裝飾
  c.strokeStyle = '#4a8fd6'; c.lineWidth = 7; c.lineCap = 'round';
  for (const [x, y] of [[70, 92], [250, 70], [420, 96], [150, 230], [380, 238]]) {
    c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 15, y - 14, x + 30, y - 14, x + 45, y); c.bezierCurveTo(x + 55, y + 8, x + 62, y + 4, x + 66, y - 4); c.stroke();
  }
}, [1 / 8, 1 / 6]) }));

/** 游泳館入口（北牆東端藍色立面中間偏西）：回傳門的 [x1, x2] */
export const poolDoor = (m) => [m.x2 - 3.9, m.x2 - 2.8];
/** 游泳館側門（西面條紋牆、南邊轉角第一格的鐵窗正下方）：回傳門的 [z1, z2]、門高 */
// 寬 1.4：扣掉兩邊門框看起來約 1.1 公尺；比 1.4 窄的話尋路格子（0.5 公尺一格、離牆要 0.45）可能找不到路穿過去
export const poolSideDoor = (m) => [m.z2 - 1.9, m.z2 - 0.5];
export const POOL_SIDE_DOOR_H = 2.2;
// 25 公尺泳池（水面）：中心、長（沿 x）、寬（沿 z），6 條水道；app.js 的碰撞、陳老師的節奏划水也用這個
export const poolWater = (m) => {
  const W = m.x2 - m.x1, D = m.z2 - m.z1;
  return { x: (m.x1 + m.x2) / 2 + 2, z: (m.z1 + m.z2) / 2, w: Math.min(25, W - 10), d: Math.min(10.5, D - 3.6), lanes: 6 };
};

// 游泳館西面（面向遊戲場）：藍白直條紋、上排大窗、下排鐵窗
export const poolStripeMat = () => once('poolstripe', () => new THREE.MeshLambertMaterial({ map: canvasTex(512, 384, (c, w, h) => {
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#e9eef2' : '#35a2e0'; c.fillRect(i * 64, 0, 64, h); }
  for (let i = 0; i < 4; i++) {
    c.fillStyle = '#cfdce6'; c.fillRect(16 + i * 128, 30, 100, 70);                 // 上排大窗
    c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(16 + i * 128, 30, 100, 70);
    c.fillStyle = '#5d6b76'; c.fillRect(30 + i * 128, 190, 70, 50);                 // 下排鐵窗
    c.strokeStyle = '#e8e8e8'; c.lineWidth = 2;
    for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(30 + i * 128 + k * 14, 190); c.lineTo(30 + i * 128 + k * 14, 240); c.stroke(); }
  }
  c.fillStyle = '#9aa0a6'; c.fillRect(0, h - 22, w, 22);
}, [1 / 8, 1 / 6]) }));
/** 西面條紋牆的一段（x：牆中線、za～zb、y0～y1、厚 t）：條紋從南邊轉角起算，牆分段開門時條紋、窗戶才接得起來 */
export function poolStripeGeo(m, x, za, zb, y0, y1, t) {
  const zEnd = m.z2 - 0.185;                                   // 側門剛好在第一格鐵窗正下方
  const g = new THREE.BoxGeometry(t, y1 - y0, zb - za);
  g.translate(x, (y0 + y1) / 2, (za + zb) / 2);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i), z = p.getZ(i), y = p.getY(i);
    uv.setXY(i, nx > 0.5 ? zEnd - z : nx < -0.5 ? z - zEnd : p.getX(i), Math.abs(n.getY(i)) > 0.5 ? z : y);   // 室內那面／室外那面
  }
  return g;
}

// 藍色立面：泡泡圓點（西端那面有「水漾游泳館」招牌）
const poolFacadeMat = (sign = true) => once('poolfacade' + sign, () => new THREE.MeshLambertMaterial({ map: canvasTex(300, 480, (c, w, h) => {
  c.fillStyle = '#2f5aa8'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 12) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, 0, 5, h); }
  if (sign) {
    c.fillStyle = '#ffffff'; c.font = '900 40px "Noto Sans TC", sans-serif'; c.textAlign = 'center';
    c.fillText('水漾游泳館', w / 2, 70);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(30, 84, w - 60, 18);
    c.fillStyle = '#2f5aa8'; c.font = '700 13px sans-serif'; c.fillText('Swimming Pool', w / 2, 98);
  }
  let s = sign ? 3 : 9;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const r = 6 + rnd() * 16;
    c.fillStyle = rnd() < 0.5 ? '#9fd4f5' : '#cfe9fb';
    c.beginPath(); c.arc(30 + rnd() * (w - 60), 140 + rnd() * (h - 170), r, 0, Math.PI * 2); c.fill();
  }
}) }));

// 泳池水面：藍色、泳道線
const waterMat = (lanes) => once('water' + lanes, () => new THREE.MeshLambertMaterial({ emissive: '#0c3a66', emissiveIntensity: 0.25, map: canvasTex(1024, 420, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1f78c4'); g.addColorStop(1, '#155ea6');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const y = Math.random() * h, x = Math.random() * w; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 20, y - 6, x + 40, y); c.stroke(); }
  c.fillStyle = '#0d2c55';
  for (let i = 0; i < lanes; i++) {
    const y = (h / lanes) * (i + 0.5);
    c.fillRect(40, y - 5, w - 80, 10);
    c.fillRect(40, y - 18, 8, 36); c.fillRect(w - 48, y - 18, 8, 36);
  }
}) }));

/**
 * 游泳館：外牆（碰撞在 app.js 的資料階段處理）、西端藍色立面、屋頂冷氣主機、室內泳池
 * m：泳池建築的範圍（公尺）；入口在北牆東端（poolDoor）
 */
export function buildPool(group, m, roofTex) {
  const b = new Batch();
  const W = m.x2 - m.x1, D = m.z2 - m.z1, cx = (m.x1 + m.x2) / 2, cz = (m.z1 + m.z2) / 2;
  // 屋頂（空拍照的青綠 / 橘色浪板）
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.4, D + 0.3), new THREE.MeshLambertMaterial({ map: roofTex }));
  roof.position.set(cx, 6.2, cz); roof.castShadow = roof.receiveShadow = true;
  group.add(roof);
  // 屋頂冷氣主機
  for (let i = 0; i < 8; i++) b.box(mat('wool', '#3a3f45'), 1.1, 0.9, 0.8, m.x1 + 4 + i * ((W - 12) / 7), 6.85, m.z1 + 1.2);
  // 西端也有一面藍色泡泡立面（含招牌，沒有門）
  const facW = new THREE.Mesh(new THREE.BoxGeometry(4.6, 7.6, 1.0), [mat('wool', '#2f5aa8'), mat('wool', '#2f5aa8'), mat('wool', '#2f5aa8'), mat('wool', '#2f5aa8'), poolFacadeMat(), poolFacadeMat()]);
  facW.position.set(m.x1 + 2.4, 3.8, m.z1 - 0.2); facW.castShadow = true;
  group.add(facW);
  // 東端藍色高立面（依照片：入口在這裡，門在立面中間偏西、門前有階梯；貓咪常坐在階梯上）
  const blue = mat('wool', '#2f5aa8'), fx0 = m.x2 - 4.7, fx1 = m.x2 - 0.1, [d0, d1] = poolDoor(m);
  const facPiece = (a, c, y0, y1) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(c - a, y1 - y0, 1.0), [blue, blue, blue, blue, blue, poolFacadeMat(false)]);
    g.position.set((a + c) / 2, (y0 + y1) / 2, m.z1 - 0.2); g.castShadow = true;
    // 貼圖對齊整面立面
    const uv = g.geometry.attributes.uv;
    for (let i = 20; i < 24; i++) uv.setXY(i, 1 - ((c - (c - a) * uv.getX(i)) - fx0) / (fx1 - fx0), (y0 + (y1 - y0) * uv.getY(i)) / 7.6);
    group.add(g);
  };
  facPiece(fx0, d0, 0, 7.6); facPiece(d1, fx1, 0, 7.6); facPiece(d0, d1, 2.4, 7.6);
  // 門內暗處、門框：不算碰撞（暗處是畫面上的深色，算了會把門封住）
  const keep = Batch.collector; Batch.collector = null;
  b.box(mat('wool', '#1d2228'), d1 - d0, 2.4, 0.05, (d0 + d1) / 2, 1.2, m.z1 + 0.32);
  for (const x of [d0 + 0.08, d1 - 0.08]) b.box(blue, 0.17, 2.4, 1.05, x, 1.2, m.z1 - 0.2);           // 門框（蓋住牆的斷面；門口寬度由牆的碰撞決定，門框不另外擋，免得卡在門框和牆的角落）
  // 西面側門的門框（白色鋁框；跟大門一樣不算碰撞，門口寬度由牆決定）
  {
    const [s0, s1] = poolSideDoor(m), dh = POOL_SIDE_DOOR_H, frame = mat('wool', '#e8eef2');
    for (const z of [s0 + 0.08, s1 - 0.08]) b.box(frame, 0.35, dh, 0.17, m.x1, dh / 2, z);
    b.box(frame, 0.35, 0.12, s1 - s0, m.x1, dh - 0.06, (s0 + s1) / 2);
  }
  Batch.collector = keep;
  // 門右邊（東側）的白色鐵格柵門
  for (let i = 0; i <= 8; i++) b.box(mat('wool', '#e8e8e4'), 0.04, 2.0, 0.04, d1 + 0.4 + i * 0.22, 1.0, m.z1 - 0.72);
  for (const y of [0.1, 1.0, 2.0]) b.box(mat('wool', '#e8e8e4'), 1.9, 0.05, 0.05, d1 + 0.4 + 0.88, y, m.z1 - 0.72);
  // 門前三階灰色磁磚階梯＋不鏽鋼扶手
  const sx = (d0 + d1) / 2;
  const steps = [];                                                    // 可以踩上去（回傳給 app.js 當墊高地面）
  for (let i = 0; i < 3; i++) {
    const h = 0.15 * (3 - i), z = m.z1 - 0.9 - i * 0.4;
    b.box(mat('wool', '#8f99a3'), 1.8, h, 0.4, sx, h / 2, z);
    steps.push({ x1: sx - 0.9, x2: sx + 0.9, z1: z - 0.2, z2: z + 0.2, h });
  }
  const steel = mat('wool', '#c9cdd2');
  for (const z of [m.z1 - 0.9, m.z1 - 1.7]) b.box(steel, 0.05, 1.0, 0.05, d0 - 0.15, 0.5 + (z === m.z1 - 0.9 ? 0.4 : 0), z);
  { const g = new THREE.BoxGeometry(0.05, 0.05, 1.0); g.rotateX(-0.45); g.translate(d0 - 0.15, 1.2, m.z1 - 1.3); b.add(steel, g); }
  // 東邊灰藍色磁磚矮牆（往北延伸）
  b.box(mat('tile', '#8195aa'), 0.35, 1.2, 6.0, fx1 - 0.2, 0.6, m.z1 - 0.7 - 3.0);
  // 白牆前：黑色橡膠地墊＋三支高低單槓
  b.box(mat('wool', '#2a2d31'), 7.5, 0.04, 4.5, d0 - 4.6, 0.02, m.z1 - 2.4);
  const posts = [d0 - 1.5, d0 - 3.4, d0 - 5.4, d0 - 7.6], bars = [2.3, 2.0, 1.6];
  posts.forEach((x) => b.box(steel, 0.07, x === posts[0] ? 2.3 : 2.3, 0.07, x, 1.15, m.z1 - 2.4));
  bars.forEach((h, i) => b.box(steel, posts[i] - posts[i + 1], 0.05, 0.05, (posts[i] + posts[i + 1]) / 2, h, m.z1 - 2.4));

  // ===== 室內 =====
  const deck = mat('tile', '#e9e4d8');
  b.box(deck, W - 0.4, 0.05, D - 0.4, cx, 0.025, cz);                      // 池畔磁磚
  const { w: pw, d: pd, x: px } = poolWater(m);                             // 25 公尺泳池
  const water = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.04, pd), waterMat(6));
  water.position.set(px, 0.06, cz); water.receiveShadow = true;
  group.add(water);
  // 池邊（淺色）與水道繩（紅白）
  b.box(mat('wool', '#f2f2ee'), pw + 0.6, 0.08, 0.3, px, 0.04, cz - pd / 2 - 0.15);
  b.box(mat('wool', '#f2f2ee'), pw + 0.6, 0.08, 0.3, px, 0.04, cz + pd / 2 + 0.15);
  for (let i = 1; i < 6; i++) {
    const z = cz - pd / 2 + (pd / 6) * i;
    for (let k = 0; k < 25; k++) b.box(mat('wool', k % 2 ? '#e8e8e8' : '#d63a3a'), pw / 25 - 0.05, 0.08, 0.08, px - pw / 2 + (k + 0.5) * (pw / 25), 0.1, z);
  }
  // 池邊扶梯
  for (const [dx, dz] of [[-1, -1], [1, 1]]) {
    const lx = px + dx * (pw / 2 - 1.2), lz = cz + dz * (pd / 2 + 0.1);
    for (const o of [-0.3, 0.3]) b.box(mat('wool', '#c9cdd2'), 0.06, 0.9, 0.06, lx + o, 0.45, lz);
  }
  // 彩色拱形鋼骨（藍、黃、綠、紅）
  const beamCols = ['#2e6fd8', '#f2c230', '#3ba55c', '#d63a3a'];
  const nB = Math.max(4, Math.round(W / 6));
  for (let i = 0; i <= nB; i++) {
    const x = m.x1 + 0.6 + (i * (W - 1.2)) / nB, col = mat('wool', beamCols[i % 4]);
    b.box(col, 0.3, 5.6, 0.3, x, 2.8, m.z1 + 0.4);
    b.box(col, 0.3, 5.6, 0.3, x, 2.8, m.z2 - 0.4);
    for (let k = 0; k < 8; k++) {                                         // 拱形屋架（分段）
      const t0 = k / 8, t1 = (k + 1) / 8, z0 = m.z1 + 0.4 + t0 * (D - 0.8), z1 = m.z1 + 0.4 + t1 * (D - 0.8);
      const y = 5.6 + Math.sin(Math.PI * (t0 + t1) / 2) * 0.35;
      b.box(col, 0.25, 0.25, z1 - z0 + 0.05, x, y, (z0 + z1) / 2);
    }
  }
  // 三角旗串（橫跨泳池）
  const flagCols = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00'];
  for (let i = 0; i < 4; i++) {
    const x = px - pw / 2 + 2 + i * ((pw - 4) / 3);
    for (let k = 0; k < 14; k++) {
      const z = m.z1 + 1 + k * ((D - 2) / 13), sag = Math.sin(Math.PI * k / 13) * 0.6;
      b.box(mat('wool', flagCols[(k + i) % 5]), 0.04, 0.28, 0.24, x, 3.9 - sag, z);
    }
  }
  // 牆邊巧拼地墊、紅色椅子
  for (let i = 0; i < 6; i++) b.box(mat('wool', ['#3ba55c', '#4fc3c7'][i % 2]), 0.9, 0.5, 0.9, m.x2 - 1.2, 0.25 + 0, m.z1 + 1.5 + i * 0.95);
  for (let i = 0; i < 10; i++) b.box(mat('wool', '#d63a3a'), 0.45, 0.45, 0.45, px - pw / 2 + 2 + i * 2.2, 0.22, m.z2 - 0.7);

  b.build(group);
  return steps;
}

/* ---------- 游泳池旁的遊戲場：白色小木屋塔、黃綠螺旋管狀滑梯、紅樓梯綠扶手 ---------- */
export function buildPoolPlayground(group, m) {
  const b = new Batch();
  const cx = (m.x1 + m.x2) / 2, cz = (m.z1 + m.z2) / 2;
  // 依照片：滑梯出口、樹穴都朝北（操場那邊）。下面照原本座標蓋，最後整組繞中心轉 180 度
  const pivot = new THREE.Group(), inner = new THREE.Group();
  pivot.position.set(cx, 0, cz); pivot.rotation.y = Math.PI; inner.position.set(-cx, 0, -cz);
  pivot.add(inner); group.add(pivot);
  const white = mat('wool', '#f1efe8'), grey = mat('wool', '#d9d6cc');
  b.box(mat('grass', '#ffffff'), m.x2 - m.x1, 0.04, m.z2 - m.z1, cx, 0.02, cz);   // 人工草皮
  // 三座小木屋塔（平台高度不同）
  const towers = [[cx - 3.5, cz - 1.5, 1.4], [cx, cz + 0.5, 2.6], [cx + 3.2, cz - 2.2, 1.8]];
  for (const [x, z, h] of towers) {
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.box(white, 0.14, h + 1.6, 0.14, x + dx, (h + 1.6) / 2, z + dz);
    b.box(grey, 1.8, 0.12, 1.8, x, h, z);
    for (let i = 0; i < 6; i++) b.box(white, 0.06, 1.0, 0.06, x - 0.8 + i * 0.32, h + 0.55, z - 0.85);   // 欄杆
    // 尖屋頂（兩片斜板）
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(1.9, 0.08, 1.2); g.rotateX(s * 0.7); g.translate(x, h + 2.0, z + s * 0.42);
      b.add(white, g);
    }
  }
  // 塔與塔之間的走道
  b.box(grey, 3.0, 0.1, 0.9, cx - 1.8, 2.0, cz - 0.5);
  b.box(grey, 2.6, 0.1, 0.9, cx + 1.6, 2.2, cz - 0.8);
  // 紅色樓梯＋綠色扶手（往最左邊的塔）
  for (let i = 0; i < 6; i++) b.box(mat('wool', '#a8483a'), 0.9, 0.1, 0.32, towers[0][0], 0.15 + i * 0.22, towers[0][1] + 2.6 - i * 0.3);
  for (const o of [-0.5, 0.5]) {
    const g = new THREE.BoxGeometry(0.06, 0.08, 2.1); g.rotateX(0.62); g.translate(towers[0][0] + o, 1.25, towers[0][1] + 1.8);
    b.add(mat('wool', '#8fd18a'), g);
  }
  // 黃綠相間的螺旋管狀滑梯（從最高的塔繞下來）
  const [sx, sz, sh] = towers[1];
  for (let k = 0; k < 14; k++) {
    const t = k / 13, a = t * Math.PI * 1.4;
    const g = new THREE.CylinderGeometry(0.42, 0.42, 0.55, 14, 1, true);
    g.rotateZ(Math.PI / 2); g.rotateY(-a);
    g.translate(sx + 1.2 + Math.sin(a) * 2.0, sh - t * (sh - 0.35), sz + 1.0 + (1 - Math.cos(a)) * 1.4);
    b.add(mat('wool', k % 2 ? '#3fbfb0' : '#f2d22e', { side: THREE.DoubleSide }), g);
  }
  // 可以溜（整組轉了 180 度，座標要跟著轉）
  const W = ([x, y, z]) => [2 * cx - x, y, 2 * cz - z];
  const tube = (pts) => pts.map(W);
  {
    const pts = [[sx, sh + 0.05, sz]];
    for (let k = 0; k <= 13; k++) { const t = k / 13, a = t * Math.PI * 1.4; pts.push([sx + 1.2 + Math.sin(a) * 2.0, sh - t * (sh - 0.35) - 0.3, sz + 1.0 + (1 - Math.cos(a)) * 1.4]); }
    const [ax, , az] = pts.at(-2), [bx, , bz] = pts.at(-1), d = Math.hypot(bx - ax, bz - az);
    pts.push([bx + (bx - ax) / d * 1.0, 0, bz + (bz - az) / d * 1.0]);
    const [ex2, , ez2] = W(pts.at(-2));
    SPOTS.push({ kind: 'slide', name: '螺旋溜滑梯', floorY: 0, x: ex2, z: ez2, r: 2.4, path: tube(pts) });
  }
  // 第二條較短的直管滑梯（從右邊的塔）
  const [tx, tz, th] = towers[2];
  for (let k = 0; k < 6; k++) {
    const g = new THREE.CylinderGeometry(0.4, 0.4, 0.55, 14, 1, true);
    g.rotateZ(Math.PI / 2 + 0.45); g.translate(tx + 1.2 + k * 0.5, th - k * 0.28, tz);
    b.add(mat('wool', k % 2 ? '#f2d22e' : '#3fbfb0', { side: THREE.DoubleSide }), g);
  }
  {
    const pts = [[tx, th + 0.05, tz]];
    for (let k = 0; k <= 5; k++) pts.push([tx + 1.2 + k * 0.5, th - k * 0.28 - 0.3, tz]);
    pts.push([tx + 1.2 + 6.5 * 0.5, Math.max(0, th - 6.5 * 0.28 - 0.3), tz], [tx + 1.2 + 8 * 0.5, 0, tz]);
    const [ex2, , ez2] = W(pts.at(-2));
    SPOTS.push({ kind: 'slide', name: '直管溜滑梯', floorY: 0, x: ex2, z: ez2, r: 2.0, path: tube(pts) });
  }
  // 塔頂白色彎曲的「樹枝」裝飾
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * 1.3;
      b.box(white, 0.08, 0.35, 0.08, sx - 0.5 + i * 0.35 + Math.sin(a) * (0.5 + i * 0.2), sh + 2.3 + Math.cos(a) * 0.9 + k * 0.05, sz - 0.2);
    }
    b.box(mat('wool', '#8fd18a'), 0.25, 0.04, 0.15, sx - 0.5 + i * 0.35 + 1.0, sh + 3.3, sz - 0.2);
  }
  // 前面（朝操場）三個圓形樹穴：水泥圓座＋木頭座板，種著大樹
  for (const x of [m.x1 + 3.5, cx + 0.5, m.x2 - 3.0]) {
    const z = m.z2 - 1.3;
    const g = new THREE.CylinderGeometry(1.1, 1.1, 0.45, 24); g.translate(x, 0.225, z); b.add(mat('wool', '#a7a39a'), g);
    const t = new THREE.CylinderGeometry(1.15, 1.15, 0.06, 24); t.translate(x, 0.48, z); b.add(mat('planks', '#a0522d'), t);
    b.box(mat('log', '#6e5a44'), 0.32, 4.2, 0.32, x, 2.4, z);
    b.box(mat('leaves'), 4.2, 1.6, 4.0, x, 5.0, z);
    b.box(mat('leaves'), 3.0, 1.0, 3.0, x, 6.2, z);
  }
  b.build(inner);
}

/* ---------- 電梯（依照片）：藍底白玫瑰磁磚牆、不鏽鋼門框、一樓門上「交通安全五大運動」 ---------- */
const roseTileMat = () => once('rose', () => new THREE.MeshLambertMaterial({ map: canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#5f88aa'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(235,240,245,.8)'; c.lineWidth = 3;
  for (const [x, y] of [[32, 32], [96, 96]]) {
    for (let r = 6; r <= 24; r += 6) { c.beginPath(); c.arc(x, y, r, r * 0.3, Math.PI * 2 - r * 0.1); c.stroke(); }
  }
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.strokeRect(0, 0, w, h);
}, [1, 1]) }));
const elevDoorMat = (art) => once('elevdoor' + art, () => new THREE.MeshLambertMaterial({ map: canvasTex(256, 480, (c, w, h) => {
  if (!art) {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#b9bec3'); g.addColorStop(0.5, '#e6e9ec'); g.addColorStop(1, '#b9bec3');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else {
    const cols = ['#cfe4f2', '#ffe08a', '#bfe6c4', '#ffc9a8', '#f6c6d6'];
    for (let i = 0; i < 5; i++) { c.fillStyle = cols[i]; c.fillRect(0, 110 + i * 74, w, 74); }
    c.fillStyle = '#f7f1e3'; c.fillRect(0, 0, w, 110);
    c.textAlign = 'center'; c.font = '900 40px "Noto Sans TC", sans-serif';
    c.lineWidth = 6; c.strokeStyle = '#ffffff';
    c.fillStyle = '#7b4fc2'; c.strokeText('交通安全', w / 2, 48); c.fillText('交通安全', w / 2, 48);
    c.fillStyle = '#e0572a'; c.strokeText('五大運動', w / 2, 96); c.fillText('五大運動', w / 2, 96);
    c.font = '700 20px "Noto Sans TC", sans-serif'; c.fillStyle = '#333';
    ['1. 車頭朝外停車', '2. 乘客責任', '3. 下車時說謝謝', '4. 對禮讓行人致謝', '5. 保護長者及婦孺'].forEach((t, i) => c.fillText(t, w / 2, 152 + i * 74));
  }
  c.fillStyle = 'rgba(60,60,60,.6)'; c.fillRect(w / 2 - 1, 0, 2, h);   // 兩扇門的中縫
}) }));
/** m：電梯範圍（門在東邊 x2），y：樓層高度，art：一樓門上有交通安全彩繪 */
export function buildElevator(group, m, y, H, art) {
  const b = new Batch();
  const tile = mat('wool', '#e3d6bc'), steel = mat('wool', '#c3c8cd');
  const W = m.x2 - m.x1, D = m.z2 - m.z1, zc = (m.z1 + m.z2) / 2, dw = 1.1;
  b.box(tile, W, H, 0.2, (m.x1 + m.x2) / 2, y + H / 2, m.z1 + 0.1);           // 北、南、西三面井道牆
  b.box(tile, W, H, 0.2, (m.x1 + m.x2) / 2, y + H / 2, m.z2 - 0.1);
  b.box(tile, 0.2, H, D, m.x1 + 0.1, y + H / 2, zc);
  // 門那一面：藍色玫瑰磁磚
  const rose = roseTileMat();
  for (const [a, c] of [[m.z1, zc - dw / 2 - 0.12], [zc + dw / 2 + 0.12, m.z2]]) b.box(rose, 0.2, H, c - a, m.x2 - 0.1, y + H / 2, (a + c) / 2);
  b.box(rose, 0.2, H - 2.3, dw + 0.24, m.x2 - 0.1, y + 2.3 + (H - 2.3) / 2, zc);
  for (const s of [-1, 1]) b.box(steel, 0.24, 2.3, 0.12, m.x2 - 0.1, y + 1.15, zc + s * (dw / 2 + 0.06));   // 不鏽鋼門框
  b.box(steel, 0.24, 0.12, dw + 0.24, m.x2 - 0.1, y + 2.24, zc);
  b.box(steel, 0.06, 0.6, 0.14, m.x2 + 0.03, y + 1.3, zc + dw / 2 + 0.45);   // 按鈕面板
  b.box(mat('wool', '#e9ebed'), D - 0.4, 0.02, W - 0.4, (m.x1 + m.x2) / 2, y + 0.02, zc);   // 車廂地板
  b.build(group);
  // 門（關著的樣子；走過去就會進電梯）
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.15, dw), [elevDoorMat(art), elevDoorMat(art), steel, steel, steel, steel]);
  door.position.set(m.x2 - 0.06, y + 1.075, zc);
  group.add(door);
  // 門上方的無障礙電梯標誌
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.3), mat('wool', '#1f3f8a'));
  sign.position.set(m.x2 + 0.02, y + 2.55, zc);
  group.add(sign);
}

/* ---------- 橘貓彩蛋 ---------- */
function tabbyTex() {
  return canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#e39a45'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c4762b';
    for (let i = 0; i < 6; i++) c.fillRect(0, 4 + i * 11, w, 4);
  });
}
export function makeCat() {
  const g = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ map: tabbyTex() });
  const light = new THREE.MeshLambertMaterial({ color: '#f6d7a8' });
  const dark = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
  const pink = new THREE.MeshLambertMaterial({ color: '#f29ca8' });
  const box = (m, w, h, d, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  // 坐著的身體
  box(fur, 0.26, 0.3, 0.34, 0, 0.17, 0.02);
  box(light, 0.16, 0.18, 0.02, 0, 0.2, -0.16);            // 胸前淺色
  box(fur, 0.07, 0.16, 0.07, -0.07, 0.08, -0.13); box(fur, 0.07, 0.16, 0.07, 0.07, 0.08, -0.13);   // 前腳
  box(light, 0.075, 0.03, 0.08, -0.07, 0.015, -0.14); box(light, 0.075, 0.03, 0.08, 0.07, 0.015, -0.14);
  // 頭
  const head = new THREE.Group(); head.position.set(0, 0.4, -0.08); g.add(head);
  box(fur, 0.22, 0.18, 0.18, 0, 0, 0, head);
  box(fur, 0.06, 0.07, 0.04, -0.07, 0.12, 0.02, head); box(fur, 0.06, 0.07, 0.04, 0.07, 0.12, 0.02, head);   // 耳朵
  box(pink, 0.03, 0.04, 0.01, -0.07, 0.12, -0.002, head); box(pink, 0.03, 0.04, 0.01, 0.07, 0.12, -0.002, head);
  box(dark, 0.035, 0.035, 0.01, -0.05, 0.02, -0.092, head); box(dark, 0.035, 0.035, 0.01, 0.05, 0.02, -0.092, head);   // 眼睛
  box(light, 0.09, 0.05, 0.02, 0, -0.04, -0.095, head);
  box(pink, 0.025, 0.02, 0.01, 0, -0.02, -0.106, head);   // 鼻子
  // 尾巴（會擺動）
  const tail = new THREE.Group(); tail.position.set(0.1, 0.04, 0.18); g.add(tail);
  box(fur, 0.05, 0.05, 0.28, 0.06, 0, 0.12, tail);
  g.userData.anim = (t) => {
    tail.rotation.y = Math.sin(t * 2.2) * 0.5;
    head.rotation.y = Math.sin(t * 0.5) * 0.45;
    head.rotation.x = Math.max(0, Math.sin(t * 0.31)) * 0.15;
  };
  return g;
}

/* ---------- 蜜袋鼯 ----------
   cream：奶油色、窩在藍色保暖袋裡抱著點心（五年四班，依照片）
   grey ：灰毛、白肚子、臉上黑色條紋從鼻子到背、黑眼圈、蓬蓬灰尾巴（花花，依照片：趴在毯子上、尾巴捲在旁邊）
   pale ：比較白的灰毛、黑條紋、手上抱著點心、尾巴拖在後面（泡泡，依照片） */

/**
 * 倉鼠（依照片：灰褐色背、深色背線、白臉頰白肚子、黑亮眼睛、粉紅鼻子）從粉紅色熊頭陶瓷小屋的圓洞探出頭；前面是 -z
 */
export function makeHamster() {
  const g = new THREE.Group();
  const M = (color, e) => new THREE.MeshLambertMaterial(e ? { color, emissive: e } : { color });
  const pink = M('#f3b6c6'), pinkD = M('#e79cb0'), hole = M('#3a2430'), nose = M('#e08a96'), eye = M('#0d0a0a', '#080505');
  const fur = M('#8d8a86'), furD = M('#5e5a57'), white = M('#f2efe9'), paw = M('#f6dcd8');
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const box = (m, w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  // 小屋：圓圓的蛋形（下面平）＋兩個圓耳朵
  const shell = add(new THREE.SphereGeometry(0.11, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), pink, 0, 0.1, 0);
  shell.scale.set(1, 1.25, 0.95);
  add(new THREE.CylinderGeometry(0.105, 0.1, 0.1, 20), pink, 0, 0.05, 0);
  for (const sx of [-1, 1]) {
    const ear = add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), pink, sx * 0.075, 0.225, 0);
    ear.rotation.x = Math.PI / 2;
    const inner = add(new THREE.CylinderGeometry(0.02, 0.02, 0.031, 12), pinkD, sx * 0.075, 0.225, -0.002);
    inner.rotation.x = Math.PI / 2;
  }
  const door = add(new THREE.CircleGeometry(0.06, 20), hole, 0, 0.1, -0.1);   // 前面的圓洞（裡面暗暗的）
  door.rotation.y = Math.PI;
  box(M('#f5e3c9'), 0.035, 0.035, 0.004, 0, 0.03, -0.103);   // 下面的小倉鼠貼紙
  // 倉鼠：頭從洞口探出來，兩隻小手扶在洞口
  box(fur, 0.085, 0.075, 0.07, 0, 0.105, -0.095);             // 頭頂、背
  box(furD, 0.02, 0.06, 0.071, 0, 0.115, -0.095);             // 深色背線
  box(white, 0.09, 0.04, 0.06, 0, 0.075, -0.1);               // 白臉頰、下巴
  box(nose, 0.016, 0.014, 0.01, 0, 0.098, -0.132);            // 粉紅鼻子
  for (const sx of [-1, 1]) {
    box(eye, 0.016, 0.018, 0.006, sx * 0.022, 0.118, -0.131); // 黑亮眼睛
    box(fur, 0.022, 0.022, 0.012, sx * 0.03, 0.15, -0.09);    // 小耳朵
    box(paw, 0.018, 0.012, 0.02, sx * 0.022, 0.05, -0.122);   // 扶在洞口的小手
  }
  return g;
}

/* ---------- 生態池的烏龜（前面是 -z）：綠色龜殼（六角花紋）、黃綠色頭和腳；腳可以划水 ---------- */
export function makeTurtle(shellColor = '#4f7f3a') {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = shellColor; c.fillRect(0, 0, 64, 64);
  c.strokeStyle = '#2f4f22'; c.lineWidth = 2;
  for (const [x, y] of [[16, 16], [48, 16], [32, 32], [16, 48], [48, 48], [0, 32], [64, 32]]) {
    c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); } c.closePath(); c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const skin = new THREE.MeshLambertMaterial({ color: '#8fae4a' }), dark = new THREE.MeshLambertMaterial({ color: '#2f4f22' });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
  shell.scale.set(1, 0.6, 1.25); shell.position.y = 0.02; g.add(shell);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 16), dark); rim.scale.set(1, 1, 1.25); rim.position.y = 0.02; g.add(rim);
  const box = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const head = new THREE.Group(); head.position.set(0, 0.04, -0.2); g.add(head);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.1), skin); hb.position.z = -0.03; head.add(hb);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, 0.015), new THREE.MeshLambertMaterial({ color: '#111', emissive: '#080808' })); e.position.set(sx * 0.041, 0.012, -0.05); head.add(e); }
  const legs = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = new THREE.Group(); l.position.set(sx * 0.13, 0.01, sz * 0.12); g.add(l);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.06), skin); m.position.x = sx * 0.04; l.add(m);
    legs.push(l);
  }
  box(skin, 0.03, 0.025, 0.06, 0, 0.01, 0.21);                       // 尾巴
  g.userData.head = head; g.userData.legs = legs;
  return g;
}

export function makeGlider(look = 'cream') {
  const g = new THREE.Group();
  const M = (color, e) => new THREE.MeshLambertMaterial(e ? { color, emissive: e } : { color });
  const pink = M('#f0a8a8'), eye = M('#160808', '#120404');
  const box = (m, w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  if (look === 'cream') {
    const fur = M('#f3e2b8'), furD = M('#e8d09c'), blue = M('#2346b8'), blueD = M('#15287a');
    // 藍色保暖袋（開口朝上，裡面比較暗）
    box(blue, 0.3, 0.14, 0.26, 0, 0.07, 0);
    box(blueD, 0.24, 0.01, 0.2, 0, 0.145, 0);
    box(blue, 0.32, 0.04, 0.03, 0, 0.16, -0.13);               // 袋口前緣捲邊
    box(fur, 0.15, 0.12, 0.16, 0, 0.2, 0.01);                  // 身體：從袋子裡探出來
    box(fur, 0.12, 0.1, 0.11, 0, 0.29, -0.06);                 // 頭（前面是 -z）
    box(pink, 0.04, 0.03, 0.03, 0, 0.27, -0.125);              // 粉紅鼻子
    for (const s of [-1, 1]) {
      box(eye, 0.03, 0.03, 0.01, s * 0.035, 0.305, -0.116);    // 黑亮大眼睛
      box(fur, 0.045, 0.05, 0.015, s * 0.06, 0.355, -0.04);    // 耳朵
      box(pink, 0.028, 0.034, 0.005, s * 0.06, 0.352, -0.049); // 耳朵內側
    }
    box(pink, 0.025, 0.025, 0.025, -0.03, 0.235, -0.13);       // 兩隻粉紅小手抱著點心
    box(pink, 0.025, 0.025, 0.025, 0.03, 0.235, -0.13);
    box(M('#d9a05a'), 0.03, 0.03, 0.03, 0, 0.245, -0.14);
    box(furD, 0.07, 0.06, 0.08, 0.1, 0.17, 0.12);              // 蓬蓬的大尾巴：從袋口垂到外面
    box(fur, 0.08, 0.16, 0.08, 0.16, 0.09, 0.15);
    return g;
  }
  // 灰色系：趴在桌上（前面是 -z）
  const pale = look === 'pale';
  const fur = M(pale ? '#b9b6b4' : '#9c9a9c'), white = M('#f4f1ea'), stripe = M('#3b3537'), tailM = M(pale ? '#a8a4a2' : '#7d7a7c');
  const earM = M('#8a7466');
  box(fur, 0.13, 0.08, 0.2, 0, 0.05, 0.02);                    // 身體
  box(white, 0.11, 0.02, 0.17, 0, 0.012, 0.0);                  // 白肚子
  box(white, 0.1, 0.05, 0.03, 0, 0.05, -0.08);                  // 白胸口
  box(stripe, 0.025, 0.006, 0.2, 0, 0.093, 0.02);               // 背上一條黑線
  // 頭
  box(white, 0.11, 0.09, 0.09, 0, 0.09, -0.12);
  box(stripe, 0.025, 0.092, 0.06, 0, 0.09, -0.13).scale.set(1, 1.01, 1.6);   // 鼻子到頭頂的黑條紋
  box(pink, 0.03, 0.025, 0.02, 0, 0.075, -0.17);                // 粉紅鼻子
  for (const s of [-1, 1]) {
    box(stripe, 0.035, 0.035, 0.006, s * 0.035, 0.1, -0.166);   // 黑眼圈
    box(eye, 0.024, 0.024, 0.008, s * 0.035, 0.1, -0.169);      // 黑亮大眼睛
    box(earM, 0.035, 0.045, 0.012, s * 0.05, 0.155, -0.105);    // 耳朵
    box(pink, 0.02, 0.028, 0.004, s * 0.05, 0.153, -0.112);     // 耳朵內側
    box(pink, 0.03, 0.015, 0.035, s * 0.055, 0.008, -0.1);      // 粉紅前腳
    box(pink, 0.03, 0.015, 0.035, s * 0.06, 0.008, 0.1);        // 後腳
    box(fur, 0.01, 0.012, 0.15, s * 0.07, 0.03, 0.01);          // 身體兩側的飛膜
  }
  if (pale) {
    // 泡泡：手上抱著點心，尾巴直直拖在後面
    box(pink, 0.025, 0.025, 0.025, -0.025, 0.05, -0.17);
    box(pink, 0.025, 0.025, 0.025, 0.025, 0.05, -0.17);
    box(M('#f2e3b0'), 0.04, 0.035, 0.03, 0, 0.055, -0.19);
    box(tailM, 0.045, 0.045, 0.22, 0, 0.03, 0.22);
    box(stripe, 0.04, 0.04, 0.06, 0, 0.03, 0.35);
  } else {
    // 花花：尾巴往旁邊捲過來，尾巴尖是深色
    box(tailM, 0.05, 0.05, 0.12, 0.03, 0.025, 0.17);
    box(tailM, 0.12, 0.05, 0.05, 0.1, 0.025, 0.22);
    box(tailM, 0.05, 0.05, 0.12, 0.16, 0.025, 0.17);
    box(stripe, 0.05, 0.05, 0.06, 0.16, 0.025, 0.09);
  }
  return g;
}
