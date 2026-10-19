import * as THREE from 'three';
import { Batch, mat } from './blocks.js?v=172';

/* =========================================================
 * 校園圍牆與外面的人行道（依 2026-10-12 使用者照片）
 *   - 圍牆：灰色石材矮牆（牆面有一個個拱形凹槽，裡面是紅磚）、黃褐色磚柱（灰色柱帽）、柱子之間黑色直條鐵欄杆
 *   - 牆外：灰色地磚人行道、紅色路緣、柏油路；人行道上一排老榕樹（氣根、竹竿支架）和木頭長椅
 * ========================================================= */

function canvasTex(w, h, draw, { repeat = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const T = {};
const once = (k, f) => (T[k] ||= f());

// 矮牆牆面：一公尺一個拱形凹槽（貼圖 1 公尺見方，矮牆 0.75 公尺高，只會用到下面 3/4）
const baseMat = () => once('wallbase', () => new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (c) => {
  c.fillStyle = '#a9a6a0'; c.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,40,40'},.08)`; c.fillRect(Math.random() * 64, Math.random() * 64, 3, 3); }
  // 拱形凹槽：外框淺灰、裡面紅磚
  const x0 = 13, x1 = 51, top = 30, bottom = 60, r = (x1 - x0) / 2;
  c.fillStyle = '#c9c6bf';
  c.beginPath(); c.moveTo(x0 - 3, bottom); c.lineTo(x0 - 3, top + r); c.arc(32, top + r, r + 3, Math.PI, 0); c.lineTo(x1 + 3, bottom); c.fill();
  c.fillStyle = '#8a5640';
  c.beginPath(); c.moveTo(x0, bottom); c.lineTo(x0, top + r); c.arc(32, top + r, r, Math.PI, 0); c.lineTo(x1, bottom); c.fill();
  c.fillStyle = 'rgba(40,20,10,.35)';
  for (let y = top + 6; y < bottom; y += 6) c.fillRect(x0, y, x1 - x0, 1);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 62, 64, 2);
}) }));
// 磚柱：黃褐色小磚
const pillarMat = () => once('wallpillar', () => new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (c) => {
  c.fillStyle = '#d9a95a'; c.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 8; row++) {
    for (let k = 0; k < 4; k++) {
      c.fillStyle = `hsl(36, 55%, ${54 + Math.random() * 10}%)`;
      c.fillRect(k * 16 + (row % 2 ? 8 : 0) - 16, row * 8, 15, 7);
      c.fillRect(k * 16 + (row % 2 ? 8 : 0) + 48, row * 8, 15, 7);
    }
  }
}) }));
// 鐵欄杆：黑色直條（透明背景）
const barsMat = () => once('wallbars', () => new THREE.MeshLambertMaterial({ color: '#2a2c2e', alphaTest: 0.5, side: THREE.DoubleSide, map: canvasTex(64, 64, (c) => {
  c.clearRect(0, 0, 64, 64);
  c.fillStyle = '#ffffff';
  for (let x = 2; x < 64; x += 9) c.fillRect(x, 0, 3, 64);
}) }));

/**
 * runs: [{ ax, az, bx, bz, street }]（公尺，水平或垂直的直線）。street：外側有人行道、榕樹、馬路
 * out(run) 回傳外側方向 [nx, nz]
 */
export function buildCampusWall(group, runs, { avoid = [] } = {}) {
  const b = new Batch();
  const stone = mat('wool', '#b5b2ab'), cap = mat('wool', '#8e8c86'), capTop = mat('wool', '#6f6d68'), rail = mat('wool', '#2a2c2e');
  for (const r of runs) {
    const L = Math.hypot(r.bx - r.ax, r.bz - r.az), ux = (r.bx - r.ax) / L, uz = (r.bz - r.az) / L;
    const horiz = Math.abs(uz) < 1e-6;
    const at = (t) => [r.ax + ux * t, r.az + uz * t];
    const box = (m, len, h, thick, t, y) => {
      const [x, z] = at(t);
      b.box(m, horiz ? len : thick, h, horiz ? thick : len, x, y, z);
    };
    if (r.street) buildStreet(b, r, L, ux, uz, avoid);
    if (r.noWall) continue;                                      // 正門兩側是樹籬，不蓋圍牆
    box(baseMat(), L, 0.75, 0.42, L / 2, 0.375);                 // 矮牆
    box(stone, L, 0.08, 0.5, L / 2, 0.79);                       // 矮牆頂
    const n = Math.max(1, Math.round(L / 3.2)), step = L / n;
    for (let i = 0; i <= n; i++) {
      const t = i * step;
      box(pillarMat(), 0.55, 2.3, 0.55, t, 1.15);                 // 磚柱
      box(cap, 0.7, 0.14, 0.7, t, 2.37);                          // 柱帽
      box(capTop, 0.5, 0.1, 0.5, t, 2.49);
      if (i < n) {
        const a = t + 0.3, c = t + step - 0.3;
        box(barsMat(), c - a, 1.0, 0.04, (a + c) / 2, 1.33);      // 鐵欄杆
        box(rail, c - a, 0.05, 0.06, (a + c) / 2, 1.86);          // 上橫桿
        box(rail, c - a, 0.05, 0.06, (a + c) / 2, 0.86);          // 下橫桿
      }
    }
  }
  b.build(group);
}

// 牆外：人行道、紅色路緣、柏油路、一排榕樹和長椅
function buildStreet(b, r, L, ux, uz, avoid) {
  const [nx, nz] = r.out;
  const horiz = Math.abs(uz) < 1e-6;
  const at = (t, d) => [r.ax + ux * t + nx * d, r.az + uz * t + nz * d];
  const flat = (m, d1, d2, y, h) => {
    const [x, z] = at(L / 2, (d1 + d2) / 2), w = d2 - d1;
    b.box(m, horiz ? L + 12 : w, h, horiz ? w : L + 12, x, y, z);
  };
  flat(mat('tile', '#c4bcb2'), 0.21, 4.6, 0.04, 0.08);           // 人行道地磚
  flat(mat('wool', '#b84a4a'), 4.6, 4.85, 0.06, 0.12);           // 紅色路緣
  flat(mat('wool', '#45474a'), 4.85, 14, 0.015, 0.03);           // 柏油路
  const [cx, cz] = at(L / 2, 9.4), lw = 0.15;                    // 路中間黃線
  b.box(mat('wool', '#e8c21c'), horiz ? L + 12 : lw, 0.02, horiz ? lw : L + 12, cx, 0.04, cz);

  const trunk = mat('log', '#8a7a66'), root = mat('log', '#6d5f50'), leaves = mat('leaves');
  const bamboo = mat('wool', '#c8b07a'), seat = mat('planks', '#b07a45'), metal = mat('wool', '#2b2b2b');
  const near = (x, z) => avoid.some(([ax, az, rad]) => Math.hypot(x - ax, z - az) < rad);
  const N = Math.max(1, Math.round(L / (r.treeGap || 13)));
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) * (L / N), [x, z] = at(t, 1.7);
    if (near(x, z)) continue;
    // 老榕樹：粗樹幹、樹根、氣根、很大很密的樹冠
    b.box(root, 1.5, 0.35, 1.5, x, 0.18, z);
    b.box(trunk, 0.9, 3.2, 0.9, x, 1.6, z);
    b.box(trunk, 0.5, 1.4, 0.5, x + nx * 0.6 + ux * 0.4, 3.4, z + nz * 0.6 + uz * 0.4);
    for (const [du, dd] of [[-1.3, 0.4], [1.1, -0.3], [0.5, 1.2], [-0.6, -0.9]]) {
      b.box(root, 0.12, 3.0, 0.12, x + ux * du + nx * dd, 2.4, z + uz * du + nz * dd);   // 氣根
    }
    b.box(leaves, 6.4, 2.4, 6.4, x, 4.6, z);
    b.box(leaves, 4.6, 1.6, 4.6, x + ux * 0.6, 6.4, z + uz * 0.6);
    b.box(leaves, 3.2, 1.6, 3.2, x - ux * 2.6 + nx * 0.8, 4.2, z - uz * 2.6 + nz * 0.8);
    // 竹竿支架：兩根斜撐＋一根橫的接到下一棵
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.08, 4.2, 0.08);
      if (horiz) g.rotateZ(s * 0.35); else g.rotateX(-s * 0.35);
      g.translate(x + ux * s * 0.75, 2.0, z + uz * s * 0.75);
      b.add(bamboo, g);
    }
    const [hx, hz] = at(t + L / N / 2, 1.7);
    if (i < N - 1) b.box(bamboo, horiz ? L / N : 0.07, 0.07, horiz ? 0.07 : L / N, hx, 3.3, hz);
    // 樹和樹中間的木頭長椅（面向馬路）
    if (i % 2 === 0 && !near(hx, hz)) {
      const [bx, bz] = at(t + L / N / 2, 1.2);
      b.box(seat, horiz ? 1.6 : 0.45, 0.06, horiz ? 0.45 : 1.6, bx, 0.45, bz);
      const [kx, kz] = at(t + L / N / 2, 0.98);
      b.box(seat, horiz ? 1.6 : 0.05, 0.4, horiz ? 0.05 : 1.6, kx, 0.72, kz);
      for (const s of [-0.7, 0.7]) b.box(metal, horiz ? 0.06 : 0.45, 0.45, horiz ? 0.45 : 0.06, bx + ux * s, 0.22, bz + uz * s);
    }
  }
}
