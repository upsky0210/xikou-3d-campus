import * as THREE from 'three';
import { Batch, mat } from './blocks.js?v=30';

/* =========================================================
 * 操場一帶（依 2026-10-12 使用者照片）
 *   - 操場：5 道 PU 跑道（外到內：藍紅藍紅藍，兩直道＋兩端半圓）、中間藍色籃球場（紅色禁區）、兩端草地＋圍網
 *   - 司令臺：勤學樓正中央，弧形雨遮、彩色三角形拼貼牆（藏著 XIKOU）、磁磚臺座
 *   - 勤學樓背面：深色鋼架遮陽格柵、綠色百葉、藍綠色擴張網、冷氣、校訓布條、大王椰子
 *   - 思源樓面向操場的那面：「OPEN A BOOK OPEN YOUR MIND」壁畫、拱形陽臺、入口階梯
 * ========================================================= */

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const cache = {};
const once = (k, f) => (cache[k] ||= f());
const texMat = (key, w, h, draw, opts = {}) => once(key, () => new THREE.MeshLambertMaterial({ map: canvasTex(w, h, draw), ...opts }));
// 固定的亂數（每次載入都一樣）
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const C = {
  laneBlue: '#4f8fd2', laneRed: '#b65a4c', court: '#2d64b3', key: '#b5524a', grass: '#6aa84f',
};

/* ---------- 操場 ---------- */
/**
 * cx, cz：中心；A、B：跑道外緣的半長、半寬（公尺）
 * 回傳：{ hoops } 方便之後用
 */
export function buildField(group, cx, cz, A, B) {
  const lanes = 5, lw = 1.0, R = B, Ls = A - B, Ri = R - lanes * lw;
  const PX = 24, W = Math.ceil(2 * A * PX), H = Math.ceil(2 * B * PX);
  const courtW = 9.2, courtL = Math.min(26, 2 * Ls - 1.5), gap = (2 * Ri - 2 * courtW) / 3;
  const courtZ = [-(courtW / 2 + gap / 2), courtW / 2 + gap / 2];   // 兩座球場（東西向）並排
  const tex = canvasTex(W, H, (c) => {
    const xc = W / 2, yc = H / 2, xl = xc - Ls * PX, xr = xc + Ls * PX;
    const stadium = (r) => { c.beginPath(); c.arc(xr, yc, r * PX, -Math.PI / 2, Math.PI / 2); c.arc(xl, yc, r * PX, Math.PI / 2, Math.PI * 1.5); c.closePath(); };
    // 跑道：外到內 藍紅藍紅藍
    for (let i = 0; i < lanes; i++) { stadium(R - i * lw); c.fillStyle = i % 2 ? C.laneRed : C.laneBlue; c.fill(); }
    stadium(Ri); c.fillStyle = C.grass; c.fill();
    // 一點顆粒感
    const rnd = rng(7);
    c.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 2500; i++) c.fillRect(rnd() * W, rnd() * H, 2, 2);
    // 白色分道線
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2;
    for (let i = 0; i <= lanes; i++) { stadium(R - i * lw); c.stroke(); }
    // 起跑線（北側直道）、終點線（南側直道）
    c.lineWidth = 3;
    for (const [x, y0, y1] of [[xc - 6 * PX, yc - R * PX, yc - Ri * PX], [xc + 4 * PX, yc + Ri * PX, yc + R * PX]]) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
    // 中間：直道之間整片藍色球場
    c.fillStyle = C.court; c.fillRect(xl, yc - Ri * PX, xr - xl, Ri * 2 * PX);
    c.fillStyle = 'rgba(255,255,255,.04)';
    for (let i = 0; i < 1500; i++) c.fillRect(xl + rnd() * (xr - xl), yc - Ri * PX + rnd() * Ri * 2 * PX, 2, 2);
    // 兩座籃球場：紅色禁區、罰球圈、中線虛線
    for (const oz of courtZ) {
      const y = yc + oz * PX, hw = (courtW / 2) * PX, hl = (courtL / 2) * PX;
      for (const s of [-1, 1]) {
        const xe = xc + s * hl, kd = 4.6 * PX, kw = 3.8 * PX;
        c.fillStyle = C.key; c.fillRect(s < 0 ? xe : xe - kd, y - kw / 2, kd, kw);
        c.strokeStyle = '#ffffff'; c.lineWidth = 3;
        c.strokeRect(s < 0 ? xe : xe - kd, y - kw / 2, kd, kw);
        c.beginPath(); c.arc(xe - s * kd, y, 1.7 * PX, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : Math.PI * 1.5); c.stroke();
      }
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      c.strokeRect(xc - hl, y - hw, hl * 2, hw * 2);
      c.fillStyle = '#ffffff';
      for (let k = -4; k <= 4; k++) c.fillRect(xc - 6, y + k * hw / 4.5 - 4, 12, 8);   // 中線（短白線）
    }
  });
  const fieldMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2 * A, 2 * B), fieldMat);
  plane.rotation.x = -Math.PI / 2; plane.position.set(cx, 0.03, cz); plane.receiveShadow = true;
  group.add(plane);

  const b = new Batch();
  // 籃球架：綠色包覆的柱子、白色籃板、橘色籃框
  const pole = mat('wool', '#2e8b57'), white = mat('wool', '#f4f4f2'), rim = mat('wool', '#e0662a'), steel = mat('wool', '#9aa0a6');
  for (const oz of courtZ) for (const s of [-1, 1]) {
    const xe = cx + s * (courtL / 2), z = cz + oz;
    b.box(pole, 0.28, 2.6, 0.28, xe + s * 0.9, 1.3, z);                // 柱子（下段綠色防護墊）
    b.box(steel, 0.14, 1.0, 0.14, xe + s * 0.9, 3.1, z);
    b.box(steel, 1.0, 0.1, 0.1, xe + s * 0.45, 3.5, z);               // 支架
    b.box(white, 0.06, 1.05, 1.8, xe - s * 0.0, 3.55, z);             // 籃板
    b.box(rim, 0.45, 0.04, 0.45, xe - s * 0.3, 3.05, z);              // 籃框
    b.box(white, 0.3, 0.35, 0.3, xe - s * 0.3, 2.85, z);              // 籃網
  }
  // 兩端草地前的圍網（鐵柱＋網）
  const netMat = once('fence', () => new THREE.MeshLambertMaterial({ map: (() => {
    const t = canvasTex(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(70,80,80,.75)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 6);
    return t;
  })(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  for (const s of [-1, 1]) {
    const x = cx + s * (Ls + 1.4), half = Ri - 1.0, h = 3.2;
    for (let z = -half; z <= half + 0.01; z += half / 4) b.box(steel, 0.09, h, 0.09, x, h / 2, cz + z);
    b.box(steel, 0.07, 0.07, half * 2, x, h, cz);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, h), netMat);
    net.rotation.y = Math.PI / 2; net.position.set(x, h / 2, cz);
    group.add(net);
  }
  // 西端草地上的小足球門
  {
    const x = cx - (Ls + 5.5), z = cz + Ri * 0.45;
    for (const dz of [-1.5, 1.5]) b.box(white, 0.1, 2.0, 0.1, x, 1.0, z + dz);
    b.box(white, 0.1, 0.1, 3.1, x, 2.0, z);
    b.box(white, 1.0, 0.06, 0.06, x - 0.5, 2.0, z - 1.5); b.box(white, 1.0, 0.06, 0.06, x - 0.5, 2.0, z + 1.5);
  }
  b.build(group);
}

/* ---------- 司令臺 ---------- */
const mosaicMat = () => texMat('mosaic', 480, 200, (c, w, h) => {
  const cols = ['#d8343f', '#f0b429', '#2f8fd6', '#1f3f7a', '#ee8a3c', '#a3abb3', '#f2c14e', '#e2574c'];
  const rnd = rng(11), n = 12, m = 5, sw = w / n, sh = h / m;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const x = i * sw, y = j * sh, a = cols[(rnd() * cols.length) | 0], bcol = cols[(rnd() * cols.length) | 0];
    c.fillStyle = a; c.fillRect(x, y, sw, sh);
    c.fillStyle = bcol; c.beginPath();
    if (rnd() < 0.5) { c.moveTo(x, y); c.lineTo(x + sw, y); c.lineTo(x + sw, y + sh); } else { c.moveTo(x, y + sh); c.lineTo(x + sw, y); c.lineTo(x + sw, y + sh); }
    c.fill();
  }
});
const stageBaseMat = () => texMat('stagebase', 640, 96, (c, w, h) => {
  c.fillStyle = '#efdcbc'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#dce6ee';                                             // 淺色尖拱圖案
  for (let i = 0; i < 22; i++) {
    const x = 10 + i * 29;
    c.beginPath(); c.moveTo(x, h); c.lineTo(x, 34); c.lineTo(x + 11, 18); c.lineTo(x + 22, 34); c.lineTo(x + 22, h); c.closePath(); c.fill();
    c.fillStyle = '#c9d3dc'; c.fillRect(x + 25, 30, 3, h - 30); c.fillStyle = '#dce6ee';
  }
  c.strokeStyle = 'rgba(160,140,110,.25)'; c.lineWidth = 1;          // 小磁磚格線
  for (let x = 0; x < w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.fillStyle = '#4f9bd9'; c.fillRect(0, 0, w, 7);                    // 上緣藍色磁磚
});

/** m：司令臺範圍（公尺），z1 是勤學樓外牆 */
export function buildStage(group, m) {
  const b = new Batch();
  const x1 = m.x1, x2 = m.x2, W = x2 - x1, xc = (x1 + x2) / 2, z0 = m.z1 + 0.2;
  const depth = m.z2 - 0.2 - z0, ph = 1.2;
  const tile = mat('wool', '#efdcbc'), white = mat('wool', '#f6f6f3'), peach = mat('wool', '#f2d4bf'), trim = mat('wool', '#e0a440');
  // 臺座（正面磁磚圖案）
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, ph, depth), [tile, tile, tile, tile, stageBaseMat(), tile]);
  base.position.set(xc, ph / 2, z0 + depth / 2); base.castShadow = base.receiveShadow = true;
  group.add(base);
  b.box(mat('wool', '#4f9bd9'), W, 0.05, depth, xc, ph + 0.025, z0 + depth / 2);
  b.box(mat('wool', '#e9e4da'), W - 0.1, 0.02, depth - 0.15, xc, ph + 0.06, z0 + depth / 2);
  // 後牆：白牆、左邊一扇門、中間彩色拼貼、右邊鐵窗
  const wy = ph, wh = 1.95;
  b.box(white, W * 0.82, wh, 0.12, xc, wy + wh / 2, z0 + 0.06);
  for (const s of [-1, 1]) b.box(white, 0.25, wh, 1.2, xc + s * W * 0.41, wy + wh / 2, z0 + 0.6);   // 兩側白色短牆
  b.box(mat('wool', '#2b2f33'), 0.75, 1.75, 0.04, x1 + 2.2, wy + 0.875, z0 + 0.14);                // 門
  b.plain(mosaicMat(), 3.6, 1.5, 0.04, x1 + 4.45, wy + 0.75, z0 + 0.14);
  b.box(mat('wool', '#3a4048'), 0.7, 0.95, 0.04, x1 + 6.75, wy + 1.0, z0 + 0.14);                 // 鐵窗
  for (let i = 0; i < 4; i++) b.box(white, 0.03, 0.95, 0.05, x1 + 6.5 + i * 0.17, wy + 1.0, z0 + 0.16);
  // 弧形雨遮：一片片往外弧出，前緣蜜桃色、上緣橘色
  const N = 24, cw = (W + 0.4) / N;
  for (let i = 0; i < N; i++) {
    const x = x1 - 0.2 + cw * (i + 0.5), t = (x - xc) / ((W + 0.4) / 2);
    const d = 2.3 + 0.55 * (1 - t * t);
    b.box(white, cw + 0.01, 0.35, d, x, 3.3, z0 + d / 2);           // 底面（白色）
    b.box(peach, cw + 0.02, 0.8, 0.18, x, 3.85, z0 + d);            // 前緣
    b.box(trim, cw + 0.02, 0.1, 0.24, x, 4.3, z0 + d);              // 上緣
    b.box(peach, cw + 0.01, 0.1, d, x, 4.25, z0 + d / 2);
  }
  // 兩側旗桿（白色水泥座）
  for (const x of [x1 - 2.2, x2 + 1.5]) {
    b.box(white, 0.6, 0.9, 0.6, x, 0.45, z0 + 1.4);
    const g = new THREE.CylinderGeometry(0.06, 0.08, 9, 8); g.translate(x, 5.4, z0 + 1.4);
    b.add(mat('wool', '#b8bcc0'), g);
  }
  b.build(group);
}

/* ---------- 勤學樓背面（面向操場） ---------- */
const bannerMat = (key, bg, ink, a, bTxt, en) => texMat(key, 160, 480, (c, w, h) => {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.35)';                               // 淡淡的文具／實驗器材圖案
  for (let i = 0; i < 5; i++) { c.save(); c.translate(30 + (i % 2) * 90, 300 + i * 34); c.rotate(-0.6); c.fillRect(-40, -6, 80, 12); c.restore(); }
  c.fillStyle = ink; c.textAlign = 'center';
  c.font = '600 11px sans-serif'; c.fillText(en, w / 2, 26);
  c.font = '900 50px "Noto Sans TC", sans-serif';
  [...a].forEach((ch, i) => c.fillText(ch, w * 0.35, 90 + i * 56));
  [...bTxt].forEach((ch, i) => c.fillText(ch, w * 0.68, 120 + i * 56));
});

function palm(b, x, z, h) {
  const trunk = mat('wool', '#a59d90'), leaf = mat('wool', '#3f8f3a'), leaf2 = mat('wool', '#5aa046');
  b.box(trunk, 0.4, h, 0.4, x, h / 2, z);
  b.box(mat('wool', '#7fa84a'), 0.5, 1.0, 0.5, x, h + 0.1, z);       // 葉鞘（綠色那段）
  for (let j = 0; j < 11; j++) {
    const a = (j / 11) * Math.PI * 2 + (j % 2) * 0.2;
    for (let k = 0; k < 4; k++) {
      const r = 0.5 + k * 0.75, y = h + 0.6 - k * k * 0.14;
      const g = new THREE.BoxGeometry(0.8, 0.07, 0.34 - k * 0.04);
      g.rotateZ(-0.15 - k * 0.12); g.rotateY(-a);
      g.translate(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      b.add(k % 2 ? leaf2 : leaf, g);
    }
  }
}

/**
 * 勤學樓南面：x1～x2 是外牆範圍，z 是外牆外側，floors 層樓；stage = [sx1, sx2] 司令臺範圍
 */
export function buildFacadeC(group, x1, x2, z, floors, FH, stage) {
  const b = new Batch();
  const frame = mat('wool', '#4b3b30'), ledge = mat('wool', '#e6d6b3'), louver = mat('wool', '#2f7d5c');
  const slat = mat('wool', '#c98c4a'), bluePanel = mat('wool', '#3c6fc8'), greenPanel = mat('wool', '#2f8f6a'), ac = mat('wool', '#e9ebec');
  const H = floors * FH, out = 0.9, n = Math.round((x2 - x1) / 3.2), bw = (x2 - x1) / n;
  const rnd = rng(23);
  const [sx1, sx2] = stage, scx = (sx1 + sx2) / 2;
  // 樓板外凸的水平遮陽板
  for (let k = 1; k <= floors; k++) b.box(ledge, x2 - x1, 0.22, out, (x1 + x2) / 2, k * FH - 0.11, z + out / 2);
  for (let i = 0; i < n; i++) {
    const bx0 = x1 + i * bw, bx = bx0 + bw / 2;
    b.box(frame, 0.12, H, 0.12, bx0, H / 2, z + out);                  // 鋼架直柱
    const mid = Math.abs(bx - scx) < 3.2;                               // 司令臺正上方那兩格：藍色擴張網＋布條
    for (let k = 0; k < floors; k++) {
      const y0 = k * FH;
      if (k === 0 && bx > sx1 - 0.5 && bx < sx2 + 0.5) continue;       // 一樓被司令臺擋住
      b.box(frame, bw, 0.08, 0.1, bx, y0 + 2.75, z + out);              // 鋼架橫桿
      const t = mid ? 2 : (rnd() * 4) | 0;
      if (t === 0) for (let s = 0; s < 6; s++) b.box(louver, bw - 0.25, 0.07, 0.14, bx, y0 + 1.0 + s * 0.3, z + out - 0.05);   // 綠色百葉
      else if (t === 1) for (let s = 0; s < 8; s++) b.box(slat, 0.07, 1.7, 0.08, bx - bw / 2 + 0.3 + s * (bw - 0.6) / 7, y0 + 0.95 + 0.85, z + out - 0.05);   // 木色直條
      else b.box(t === 2 ? bluePanel : greenPanel, 0.95, 0.95, 0.06, bx + (rnd() < 0.5 ? -0.6 : 0.6), y0 + 2.1, z + out - 0.04);   // 擴張網方塊
      if (rnd() < 0.55) b.box(ac, 0.8, 0.6, 0.32, bx + (rnd() < 0.5 ? -0.8 : 0.8), y0 + 1.05, z + out - 0.25);   // 冷氣室外機
    }
  }
  b.box(frame, 0.12, H, 0.12, x2, H / 2, z + out);
  // 校訓布條：司令臺上方左黃右綠
  b.plain(bannerMat('banner-y', '#f3c84a', '#b0472f', '愛人', '如己', 'Love your neighbor as yourself.'), 1.7, 6.0, 0.04, sx1 + 2.1, 9.6, z + out + 0.12);
  b.plain(bannerMat('banner-g', '#bfe3cf', '#2c4a63', '盡心', '盡力', 'Do your best.'), 1.7, 6.0, 0.04, sx2 - 1.1, 9.6, z + out + 0.12);
  // 一樓牆腳的灌木
  for (const [a, c] of [[x1 + 0.5, sx1 - 2.6], [sx2 + 2.0, x2 - 0.3]]) b.box(mat('leaves'), c - a, 0.8, 0.7, (a + c) / 2, 0.4, z + 0.45);
  // 大王椰子：司令臺左邊四棵、右邊三棵
  for (const x of [sx1 - 13, sx1 - 10, sx1 - 7, sx1 - 3.6]) palm(b, x, z + 1.3, 13 + rnd() * 2);
  for (const x of [sx2 + 3.4, sx2 + 6.6, sx2 + 9.6]) palm(b, x, z + 1.3, 12.5 + rnd() * 2.5);
  b.build(group);
}

/* ---------- 思源樓面向操場的那面：壁畫＋拱形陽臺＋入口 ---------- */
const muralMat = () => texMat('mural', 384, 832, (c, w, h) => {
  const P = w / 7.5;                                                   // 每公尺幾 px（寬 7.5 公尺）
  const Y = (m) => h - m * P;                                          // 從地面算起的高度 → 畫布 y
  c.fillStyle = '#ecdcb4'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#d9c79c'; c.fillRect(0, Y(0.5), w, 0.5 * P);           // 牆腳
  const rnd = rng(5);
  c.fillStyle = '#7fb6e6';                                             // 牆上散落的淺藍色小方塊
  for (let i = 0; i < 28; i++) c.fillRect(rnd() * (w - 20), rnd() * (h - 60), 0.45 * P, 0.14 * P);
  const win = (x, y, ww, hh) => {
    c.fillStyle = '#ffffff'; c.fillRect(x * P, Y(y + hh), ww * P, hh * P);
    c.fillStyle = '#7d8d99'; c.fillRect(x * P + 4, Y(y + hh) + 4, ww * P - 8, hh * P - 8);
    c.fillStyle = '#ffffff'; c.fillRect(x * P + ww * P / 2 - 2, Y(y + hh), 4, hh * P); c.fillRect(x * P, Y(y + hh * 0.6), ww * P, 3);
  };
  for (const k of [1, 2, 3]) win(0.7, k * 3.6 + 0.9, 1.4, 1.1);       // 左邊一排窗
  for (const k of [1, 2, 3]) win(5.0, k * 3.6 + 0.9, 1.5, 1.1);       // 右邊一排窗
  win(4.6, 14.6, 1.0, 0.8);                                            // 頂樓小窗
  // 壁畫：拱形窗框裡，白色角色抱著紅色的書
  c.fillStyle = '#2b2b30';
  const ax = 1.9 * P, ay = Y(11.0), aw = 2.4 * P, ah = 4.0 * P;
  c.beginPath(); c.moveTo(ax, ay + ah); c.lineTo(ax, ay + aw / 2); c.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); c.lineTo(ax + aw, ay + ah); c.closePath(); c.fill();
  c.fillStyle = '#f7f5ef'; c.fillRect(ax - 4, ay + ah, aw + 8, 8);    // 窗臺
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(ax + aw * 0.62, ay + ah * 0.48, aw * 0.36, ah * 0.42, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ea7d93'; c.fillRect(ax + aw * 0.42, ay + ah * 0.1, aw * 0.42, 6);   // 粉紅色的條紋
  c.fillStyle = '#d6332f'; c.fillRect(ax + aw * 0.05, ay + ah * 0.6, aw * 0.5, ah * 0.3);   // 紅色的書
  c.fillStyle = '#ffffff'; c.font = '700 9px sans-serif'; c.textAlign = 'center';
  c.fillText('BOOK', ax + aw * 0.18, ay + ah * 0.78); c.fillText('BOOK', ax + aw * 0.43, ay + ah * 0.78);
  c.fillStyle = '#f4d03f'; c.fillRect(ax + aw * 0.2, ay + ah * 0.45, 6, ah * 0.14);   // 黃色蠟燭
  // 下方小窗裡的小兔子
  c.fillStyle = '#2b2b30'; c.fillRect(2.8 * P, Y(6.2), 0.7 * P, 0.7 * P);
  c.fillStyle = '#ffffff'; c.fillRect(2.95 * P, Y(6.0), 0.4 * P, 0.4 * P); c.fillRect(3.0 * P, Y(6.35), 0.08 * P, 0.35 * P); c.fillRect(3.22 * P, Y(6.35), 0.08 * P, 0.35 * P);
  // 英文字
  c.fillStyle = '#4a4a4a'; c.font = '500 19px sans-serif'; c.textAlign = 'center';
  c.fillText('OPEN A BOOK', 3.2 * P, Y(12.2)); c.fillText('OPEN YOUR MIND', 3.2 * P, Y(11.55));
});
const archMat = () => texMat('arches', 200, 832, (c, w, h) => {
  const P = w / 3.6, Y = (m) => h - m * P;
  c.fillStyle = '#e8d7ad'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#7fb6e6'; c.fillRect(0.4 * P, Y(13.2), 0.4 * P, 0.12 * P); c.fillRect(2.5 * P, Y(9.6), 0.4 * P, 0.12 * P);
  for (const k of [1, 2, 3]) {
    const x0 = 0.35 * P, ww = 2.9 * P, top = Y(k * 3.6 + 3.1), bot = Y(k * 3.6 + 0.3), r = ww / 2;
    c.fillStyle = '#3a3d42';
    c.beginPath(); c.moveTo(x0, bot); c.lineTo(x0, top + r * 0.5); c.ellipse(x0 + r, top + r * 0.5, r, r * 0.5, 0, Math.PI, 0); c.lineTo(x0 + ww, bot); c.closePath(); c.fill();
    c.fillStyle = 'rgba(230,235,240,.85)';                              // 拱形透光板
    c.beginPath(); c.ellipse(x0 + r, top + r * 0.5, r - 4, r * 0.5 - 4, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#202225';                                            // 欄杆
    c.fillRect(x0, bot - 1.1 * P, ww, 4);
    for (let i = 0; i <= 14; i++) c.fillRect(x0 + (i * ww) / 14 - 1, bot - 1.1 * P, 2, 1.1 * P);
  }
  // 一樓入口：深色玻璃門＋雨遮
  c.fillStyle = '#2d3238'; c.fillRect(0.9 * P, Y(3.3), 1.9 * P, 2.4 * P);
  c.fillStyle = '#9aa3ab'; c.fillRect(1.82 * P, Y(3.3), 3, 2.4 * P);
  c.fillStyle = '#cdbf9c'; c.fillRect(0.6 * P, Y(3.6), 2.5 * P, 0.2 * P);
});

/** x1～x2：牆面範圍（xa 是壁畫和拱形陽臺的分界），z：外牆外側，H：牆高 */
export function buildMuralBlock(group, x1, xa, x2, z, H) {
  const b = new Batch();
  b.plain(muralMat(), xa - x1, 16.2, 0.3, (x1 + xa) / 2, 8.1, z + 0.15);
  b.plain(archMat(), x2 - xa, 16.2, 0.3, (xa + x2) / 2, 8.1, z + 0.15);
  const beige = mat('wool', '#ecdcb4'), stone = mat('wool', '#d6d2c8');
  b.box(beige, 2.4, 1.2, 0.5, x1 + 4.6, 16.8, z + 0.15);              // 頂上凸起的那一塊
  // 入口階梯（5 階）＋兩旁花臺
  const ex = (xa + x2) / 2, steps = 5;
  for (let i = 0; i < steps; i++) b.box(stone, 2.4, 0.18 * (steps - i), 0.38, ex, 0.09 * (steps - i), z + 0.5 + i * 0.38);
  for (const s of [-1, 1]) {
    b.box(beige, 0.6, 0.9, 1.6, ex + s * 1.55, 0.45, z + 1.1);
    b.box(mat('leaves'), 0.5, 0.4, 1.4, ex + s * 1.55, 1.1, z + 1.1);
  }
  // 壁畫前面三棵樹（圓形樹穴）
  for (const x of [x1 - 3.5, x1 - 0.8, x1 + 2.0]) {
    const g = new THREE.CylinderGeometry(0.75, 0.75, 0.4, 16); g.translate(x, 0.2, z + 1.6); b.add(mat('wool', '#d9d6cc'), g);
    b.box(mat('log', '#8b6b4a'), 0.3, 2.6, 0.3, x, 1.5, z + 1.6);
    b.box(mat('leaves'), 2.8, 1.8, 2.4, x, 3.4, z + 1.6);
    b.box(mat('leaves'), 2.0, 0.8, 1.8, x, 4.6, z + 1.6);
  }
  palm(b, x2 + 0.6, z + 1.3, 15);
  b.build(group);
}
