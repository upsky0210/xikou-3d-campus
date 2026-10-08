import * as THREE from 'three';
import { Batch, mat } from './blocks.js?v=19';

/* =========================================================
 * 戶外特別場景（依使用者提供的照片）
 *   - 水漾游泳館：外觀（白色浪板牆＋藍色波浪、西端藍色泡泡牆面與招牌）＋室內泳池
 *   - 游泳池旁的遊戲場：白色小木屋塔＋黃綠螺旋管狀滑梯
 *   - 橘貓彩蛋：躲在游泳池後面
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

// 西端藍色立面：泡泡圓點＋「水漾游泳館」招牌
const poolFacadeMat = () => once('poolfacade', () => new THREE.MeshLambertMaterial({ map: canvasTex(300, 480, (c, w, h) => {
  c.fillStyle = '#2f5aa8'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 12) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, 0, 5, h); }
  c.fillStyle = '#ffffff'; c.font = '900 40px "Noto Sans TC", sans-serif'; c.textAlign = 'center';
  c.fillText('水漾游泳館', w / 2, 70);
  c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(30, 84, w - 60, 18);
  c.fillStyle = '#2f5aa8'; c.font = '700 13px sans-serif'; c.fillText('Swimming Pool', w / 2, 98);
  let s = 3;
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
 * m：泳池建築的範圍（公尺），door：入口在北牆的位置 [x1, x2]
 */
export function buildPool(group, m, roofTex) {
  const b = new Batch();
  const W = m.x2 - m.x1, D = m.z2 - m.z1, cx = (m.x1 + m.x2) / 2, cz = (m.z1 + m.z2) / 2;
  // 屋頂（空拍照的青綠 / 橘色浪板）
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.4, D + 0.3), new THREE.MeshLambertMaterial({ map: roofTex }));
  roof.position.set(cx, 6.2, cz); roof.castShadow = roof.receiveShadow = true;
  group.add(roof);
  // 屋頂冷氣主機
  for (let i = 0; i < 8; i++) b.box(mat('wool', '#3a3f45'), 1.1, 0.9, 0.8, m.x1 + 8 + i * ((W - 12) / 7), 6.85, m.z1 + 1.2);
  // 西端藍色高立面（含招牌）
  const fac = new THREE.Mesh(new THREE.BoxGeometry(4.6, 7.6, 1.0), [poolFacadeMat(), poolFacadeMat(), mat('wool', '#2f5aa8'), mat('wool', '#2f5aa8'), poolFacadeMat(), poolFacadeMat()]);
  fac.position.set(m.x1 + 2.4, 3.8, m.z1 - 0.2); fac.castShadow = true;   // 貼在北牆外側
  group.add(fac);

  // ===== 室內 =====
  const deck = mat('tile', '#e9e4d8');
  b.box(deck, W - 0.4, 0.05, D - 0.4, cx, 0.025, cz);                      // 池畔磁磚
  const pw = Math.min(25, W - 10), pd = Math.min(10.5, D - 3.6), px = cx + 2;   // 25 公尺泳池
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
}

/* ---------- 游泳池旁的遊戲場：白色小木屋塔、黃綠螺旋管狀滑梯、紅樓梯綠扶手 ---------- */
export function buildPoolPlayground(group, m) {
  const b = new Batch();
  const cx = (m.x1 + m.x2) / 2, cz = (m.z1 + m.z2) / 2;
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
  // 第二條較短的直管滑梯（從右邊的塔）
  const [tx, tz, th] = towers[2];
  for (let k = 0; k < 6; k++) {
    const g = new THREE.CylinderGeometry(0.4, 0.4, 0.55, 14, 1, true);
    g.rotateZ(Math.PI / 2 + 0.45); g.translate(tx + 1.2 + k * 0.5, th - k * 0.28, tz);
    b.add(mat('wool', k % 2 ? '#f2d22e' : '#3fbfb0', { side: THREE.DoubleSide }), g);
  }
  // 塔頂白色彎曲的「樹枝」裝飾
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * 1.3;
      b.box(white, 0.08, 0.35, 0.08, sx - 0.5 + i * 0.35 + Math.sin(a) * (0.5 + i * 0.2), sh + 2.3 + Math.cos(a) * 0.9 + k * 0.05, sz - 0.2);
    }
    b.box(mat('wool', '#8fd18a'), 0.25, 0.04, 0.15, sx - 0.5 + i * 0.35 + 1.0, sh + 3.3, sz - 0.2);
  }
  // 圓形木頭座椅
  for (const [x, z] of [[m.x1 + 1.2, m.z2 - 1.2], [m.x2 - 1.2, m.z2 - 1.4]]) {
    const g = new THREE.CylinderGeometry(0.9, 0.9, 0.42, 24); g.translate(x, 0.21, z); b.add(mat('wool', '#9aa0a6'), g);
    const t = new THREE.CylinderGeometry(0.85, 0.85, 0.06, 24); t.translate(x, 0.45, z); b.add(mat('planks', '#a0522d'), t);
  }
  b.build(group);
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
