import * as THREE from 'three';
import { Batch, mat, SPOTS } from './blocks.js?v=241';

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
    SPOTS.push({ kind: 'hoop', x: xe - s * 0.3, y: 3.05, z, fx: -s, fz: 0, floorY: 0 });   // 可以投籃
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
  {                                                                    // 後牆，留出白鐵門的門洞（對準學務處的門）
    const wl = xc - W * 0.41, wr = xc + W * 0.41, d0 = x1 + 1.39 - 0.5, d1 = x1 + 1.39 + 0.5;
    b.box(white, d0 - wl, wh, 0.12, (wl + d0) / 2, wy + wh / 2, z0 + 0.06);
    b.box(white, wr - d1, wh, 0.12, (d1 + wr) / 2, wy + wh / 2, z0 + 0.06);
    b.box(white, d1 - d0, wh - 2.0, 0.12, (d0 + d1) / 2, wy + 2.0 + (wh - 2.0) / 2, z0 + 0.06);
  }
  for (const s of [-1, 1]) b.box(white, 0.25, wh, 1.2, xc + s * W * 0.41, wy + wh / 2, z0 + 0.6);   // 兩側白色短牆
  // 後牆的門：白鐵門，打開著，直通學務處（位置對準學務處南牆的門）
  const dx = x1 + 1.39;
  b.box(mat('wool', '#c9cdd2'), 0.05, 1.95, 0.85, dx + 0.47, wy + 0.975, z0 + 0.6);                  // 打開的白鐵門片
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
  // 臺座可以走上去（從學務處的門、或從操場那邊跳上去）
  return [{ x1, x2, z1: z0 - 0.05, z2: z0 + depth, h: ph + 0.06 }];
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

// wallZ：樹後面（北邊）建築外牆的位置；朝牆那邊的葉子剪掉，才不會穿進樓上的教室
function palm(b, x, z, h, wallZ = -Infinity) {
  const trunk = mat('wool', '#a59d90'), leaf = mat('wool', '#3f8f3a'), leaf2 = mat('wool', '#5aa046');
  b.box(trunk, 0.4, h, 0.4, x, h / 2, z);
  b.box(mat('wool', '#7fa84a'), 0.5, 1.0, 0.5, x, h + 0.1, z);       // 葉鞘（綠色那段）
  for (let j = 0; j < 11; j++) {
    const a = (j / 11) * Math.PI * 2 + (j % 2) * 0.2;
    for (let k = 0; k < 4; k++) {
      const r = 0.5 + k * 0.75, y = h + 0.6 - k * k * 0.14;
      if (z + Math.sin(a) * r - 0.45 < wallZ + 0.2) continue;                  // 碰到牆的葉子不畫
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
export function buildFacadeC(group, x1, x2, z, floors, FH, stage, base = 0) {
  const b = new Batch();
  const frame = mat('wool', '#4b3b30'), ledge = mat('wool', '#e6d6b3'), louver = mat('wool', '#2f7d5c');
  const slat = mat('wool', '#c98c4a'), bluePanel = mat('wool', '#3c6fc8'), greenPanel = mat('wool', '#2f8f6a'), ac = mat('wool', '#e9ebec');
  const H = floors * FH, out = 0.9, n = Math.round((x2 - x1) / 3.2), bw = (x2 - x1) / n;
  const rnd = rng(23);
  const [sx1, sx2] = stage, scx = (sx1 + sx2) / 2;
  // 樓板外凸的水平遮陽板
  for (let k = 1; k <= floors; k++) b.box(ledge, x2 - x1, 0.22, out, (x1 + x2) / 2, base + k * FH - 0.11, z + out / 2);
  for (let i = 0; i < n; i++) {
    const bx0 = x1 + i * bw, bx = bx0 + bw / 2;
    if (bx0 > sx1 - 0.6 && bx0 < sx2 + 0.6) b.box(frame, 0.12, H + base - 4.9, 0.12, bx0, (H + base + 4.9) / 2, z + out);   // 司令臺上方：從雨遮上面開始
    else b.box(frame, 0.12, H + base, 0.12, bx0, (H + base) / 2, z + out);   // 鋼架直柱（從地面）
    const mid = Math.abs(bx - scx) < 3.2;                               // 司令臺正上方那兩格：藍色擴張網＋布條
    for (let k = 0; k < floors; k++) {
      const y0 = base + k * FH;
      if (k === 0 && bx > sx1 - 0.5 && bx < sx2 + 0.5) continue;       // 一樓被司令臺擋住
      b.box(frame, bw, 0.08, 0.1, bx, y0 + 2.75, z + out);              // 鋼架橫桿
      const t = mid ? 2 : (rnd() * 4) | 0;
      if (t === 0) for (let s = 0; s < 6; s++) b.box(louver, bw - 0.25, 0.07, 0.14, bx, y0 + 1.0 + s * 0.3, z + out - 0.05);   // 綠色百葉
      else if (t === 1) for (let s = 0; s < 8; s++) b.box(slat, 0.07, 1.7, 0.08, bx - bw / 2 + 0.3 + s * (bw - 0.6) / 7, y0 + 0.95 + 0.85, z + out - 0.05);   // 木色直條
      else b.box(t === 2 ? bluePanel : greenPanel, 0.95, 0.95, 0.06, bx + (rnd() < 0.5 ? -0.6 : 0.6), y0 + 2.1, z + out - 0.04);   // 擴張網方塊
      if (rnd() < 0.55) b.box(ac, 0.8, 0.6, 0.32, bx + (rnd() < 0.5 ? -0.8 : 0.8), y0 + 1.05, z + out - 0.25);   // 冷氣室外機
    }
  }
  b.box(frame, 0.12, H + base, 0.12, x2, (H + base) / 2, z + out);
  // 校訓布條：司令臺上方左黃右綠
  b.plain(bannerMat('banner-y', '#f3c84a', '#b0472f', '愛人', '如己', 'Love your neighbor as yourself.'), 1.7, 6.0, 0.04, sx1 + 2.1, base + 9.6, z + out + 0.12);
  b.plain(bannerMat('banner-g', '#bfe3cf', '#2c4a63', '盡心', '盡力', 'Do your best.'), 1.7, 6.0, 0.04, sx2 - 1.1, base + 9.6, z + out + 0.12);
  // 一樓牆腳的灌木
  for (const [a, c] of [[x1 + 0.5, sx1 - 2.6], [sx2 + 2.0, x2 - 0.3]]) b.box(mat('leaves'), c - a, 0.8, 0.7, (a + c) / 2, 0.4, z + 0.45);
  // 大王椰子：司令臺左邊四棵、右邊三棵
  for (const x of [sx1 - 13, sx1 - 10, sx1 - 7, sx1 - 3.6]) palm(b, x, z + 1.3, 13 + rnd() * 2, z);
  for (const x of [sx2 + 3.4, sx2 + 6.6, sx2 + 9.6]) palm(b, x, z + 1.3, 12.5 + rnd() * 2.5, z);
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
});

/** x1～x2：牆面範圍（xa 是壁畫和拱形陽臺的分界），z：外牆外側，H：牆高 */
export function buildMuralBlock(group, x1, xa, x2, z, H, base = 0) {
  const b = new Batch();
  const beige = mat('wool', '#ecdcb4');
  // 壁畫整面跟著建築墊高；底下補一段牆腳
  b.plain(muralMat(), xa - x1, 16.2, 0.3, (x1 + xa) / 2, base + 8.1, z + 0.15);
  if (base) b.box(mat('wool', '#d9c79c'), xa - x1, base, 0.3, (x1 + xa) / 2, base / 2, z + 0.15);
  // 拱形陽臺那一欄：一樓是通道（沒有門），只蓋二樓以上，兩側留柱子（柱子從地面開始）
  {
    const y0 = 3.3, g = new THREE.BoxGeometry(x2 - xa, 16.2 - y0, 0.3), uv = g.attributes.uv;
    for (let i = 16; i < 24; i++) uv.setY(i, (y0 + (16.2 - y0) * uv.getY(i)) / 16.2);
    g.translate((xa + x2) / 2, base + (y0 + 16.2) / 2, z + 0.15);
    b.add(archMat(), g);
    b.box(mat('wool', '#e8d7ad'), 0.7, base + y0, 0.3, xa + 0.35, (base + y0) / 2, z + 0.15);
    b.box(mat('wool', '#e8d7ad'), 0.5, base + y0, 0.3, x2 - 0.25, (base + y0) / 2, z + 0.15);
  }
  b.box(beige, 2.4, 1.2, 0.5, x1 + 4.6, base + 16.8, z + 0.15);       // 頂上凸起的那一塊
  // 壁畫前面三棵樹（圓形樹穴）
  for (const x of [x1 - 3.5, x1 - 0.8, x1 + 2.0]) {
    const g = new THREE.CylinderGeometry(0.75, 0.75, 0.4, 16); g.translate(x, 0.2, z + 1.6); b.add(mat('wool', '#d9d6cc'), g);
    b.box(mat('log', '#8b6b4a'), 0.3, 2.6, 0.3, x, 1.5, z + 1.6);
    b.box(mat('leaves'), 2.8, 1.8, 2.4, x, 3.4, z + 1.6);
    b.box(mat('leaves'), 2.0, 0.8, 1.8, x, 4.6, z + 1.6);
  }
  palm(b, x2 + 0.6, z + 1.3, 15 + base, z);
  b.build(group);
  return [];
}

/* ---------- 中庭（依照片）：敬業樓、勤學樓面向中庭的立面、會議室前小花台、電腦教室前沙坑 ---------- */
const waveMat = () => texMat('wavefascia', 256, 64, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#f4f1ea';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.45);
  for (let x = w; x >= 0; x -= 4) c.lineTo(x, h * 0.55 + Math.sin((x / w) * Math.PI * 3) * h * 0.3);
  c.closePath(); c.fill();
}, { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
const nameMat = (key, zh, en) => texMat(key, 512, 96, (c, w, h) => {
  c.fillStyle = '#e4dccb'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#5b5a55'; c.textAlign = 'center';
  c.font = '700 40px "Noto Sans TC", sans-serif';
  [...zh].forEach((ch, i) => c.fillText(ch, w / 2 + (i - 1) * 140, 50));
  c.font = '600 18px sans-serif'; en.split(' ').forEach((t, i) => c.fillText(t, w / 2 + (i - 0.5) * 140, 82));
});
const railMat = () => texMat('ironrail', 256, 64, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.strokeStyle = '#2a2a2a'; c.lineWidth = 3;
  c.strokeRect(2, 2, w - 4, h - 4);
  for (let i = 0; i < 4; i++) {                                         // 捲草紋
    const x = 32 + i * 64;
    c.beginPath(); c.arc(x, h / 2, 14, 0, Math.PI * 1.6); c.stroke();
    c.beginPath(); c.arc(x + 18, h / 2 + 6, 8, Math.PI, Math.PI * 2.6); c.stroke();
    c.beginPath(); c.moveTo(x - 30, h - 4); c.quadraticCurveTo(x, 6, x + 30, h - 4); c.stroke();
  }
}, { transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });

/**
 * 面向中庭的走廊立面：柱子、各層切角的樑、一樓波浪飾帶、柱子上的冷氣
 * z：走廊外緣；dir：立面朝哪邊（+1 朝 +z、-1 朝 -z）
 */
function courtFacade(b, group, x1, x2, z, dir, floors, FH, opt = {}) {
  const base = opt.base || 0;
  const col = mat('wool', '#e6dcc8'), beam = mat('wool', '#ece4d4'), ac = mat('wool', '#eceeef');
  const n = Math.round((x2 - x1) / 4.4), bw = (x2 - x1) / n, H = floors * FH;
  for (let i = 0; i <= n; i++) b.box(col, 0.6, H + base, 0.6, x1 + i * bw, (H + base) / 2, z + dir * 0.3);
  for (let k = 1; k <= floors; k++) {
    const y = base + k * FH;
    b.box(beam, x2 - x1, 0.5, 0.5, (x1 + x2) / 2, y - 0.25, z + dir * 0.25);
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {               // 開口上方兩角切角
      const g = new THREE.BoxGeometry(0.9, 0.3, 0.45); g.rotateZ(s * 0.6);
      g.translate(x1 + i * bw + bw / 2 - s * (bw / 2 - 0.55), y - 0.6, z + dir * 0.25);
      b.add(beam, g);
    }
    if (k < floors) for (let i = 0; i <= n; i += 1) if ((i + k) % 2 === 0) b.box(ac, 0.3, 0.55, 0.75, x1 + i * bw + 0.48, base + (k - 1) * FH + 2.3, z + dir * 0.45);
  }
  // 一樓波浪飾帶（opt.eaves：這一段改成咖啡色小屋簷）
  for (let i = 0; i < n; i++) {
    const cx = x1 + (i + 0.5) * bw;
    if (opt.eaves && cx > opt.eaves[0] && cx < opt.eaves[1]) {
      const g = new THREE.BoxGeometry(bw - 0.8, 0.08, 1.0); g.rotateX(dir * 0.45); g.translate(cx, base + 2.65, z + dir * 0.45);
      b.add(mat('wool', '#6b4a3a'), g);
      continue;
    }
    const wv = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.6, 0.7), waveMat());
    wv.position.set(cx, base + FH - 0.85, z + dir * 0.52); if (dir < 0) wv.rotation.y = Math.PI;
    group.add(wv);
  }
  // 樓名
  if (opt.name) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), opt.name);
    sign.position.set((x1 + x2) / 2, opt.nameY ?? base + H + 0.6, z + dir * 0.62); if (dir < 0) sign.rotation.y = Math.PI;
    group.add(sign);
  }
}

function bananaTree(b, x, z, h = 2.8) {
  b.box(mat('log', '#b9c27a'), 0.32, h, 0.32, x, h / 2, z);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.BoxGeometry(2.0, 0.06, 0.55); leaf.translate(1.0, 0, 0); leaf.rotateZ(0.4 + (i % 2) * 0.25); leaf.rotateY(i * Math.PI * 2 / 7);
    leaf.translate(x, h - 0.1, z); b.add(mat('wool', i % 2 ? '#5fae3a' : '#4f9a32'), leaf);
  }
}

/** m：中庭範圍（公尺）。回傳可以走上去的墊高區域 */
export function buildCourtyard(group, m, FH, base = 0) {
  const b = new Batch(), raised = [];
  // 敬業樓（北邊，立面朝南）：一到三樓走廊，四、五樓整排直條遮陽板
  courtFacade(b, group, m.x1, m.x2, m.z1, 1, 3, FH, { base });
  const fin = mat('wool', '#e2d8c3');
  b.box(fin, m.x2 - m.x1, 0.7, 0.7, (m.x1 + m.x2) / 2, base + 3 * FH + 0.35, m.z1 + 0.35);
  for (let x = m.x1 + 0.4; x < m.x2; x += 0.95) b.box(fin, 0.24, 2 * FH - 0.7, 0.7, x, base + 3 * FH + 0.7 + (2 * FH - 0.7) / 2, m.z1 + 0.35);
  const nA = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), nameMat('name-jy', '敬業樓', 'Jing Ye'));
  nA.position.set((m.x1 + m.x2) / 2, base + 5 * FH + 0.6, m.z1 + 0.72); group.add(nA);
  b.box(fin, m.x2 - m.x1, 1.3, 0.6, (m.x1 + m.x2) / 2, base + 5 * FH + 0.65, m.z1 + 0.3);
  // 勤學樓（南邊，立面朝北）：四層走廊，一樓東段（幼兒園）是咖啡色小屋簷
  courtFacade(b, group, m.x1, m.x2, m.z2, -1, 4, FH, { base, eaves: [4, m.x2], name: nameMat('name-qx', '勤學樓', 'Qin Xue') });
  b.box(mat('wool', '#e4dccb'), m.x2 - m.x1, 1.3, 0.6, (m.x1 + m.x2) / 2, base + 4 * FH + 0.65, m.z2 - 0.3);
  b.box(mat('wool', '#2f86d0'), 0.5, 3.0 + base, 0.4, -4.2, (3.0 + base) / 2, m.z2 - 0.5);                           // 藍色柱子

  // 會議室前小花台：墊高平台、雕花鐵欄杆、弧形階梯、樹籬、香蕉樹、波浪石牆、百葉箱、石桌椅
  const tx1 = -9.5, tx2 = -2.5, tz1 = m.z1 + 0.05, tz2 = m.z1 + 2.2, th = base || 0.9;
  const granite = mat('wool', '#a8918a');
  b.box(granite, tx2 - tx1, th, tz2 - tz1, (tx1 + tx2) / 2, th / 2, (tz1 + tz2) / 2);
  b.box(mat('wool', '#cfc6b8'), tx2 - tx1, 0.04, tz2 - tz1, (tx1 + tx2) / 2, th + 0.02, (tz1 + tz2) / 2);
  raised.push({ x1: tx1, x2: tx2, z1: tz1, z2: tz2, h: th + 0.04 });
  const rail = new THREE.Mesh(new THREE.PlaneGeometry(tx2 - tx1 - 1.2, 0.9), railMat());
  rail.position.set((tx1 + tx2) / 2 - 0.6, th + 0.45, tz2 - 0.05); group.add(rail);
  const rail2 = new THREE.Mesh(new THREE.PlaneGeometry(tz2 - tz1, 0.9), railMat());
  rail2.rotation.y = Math.PI / 2; rail2.position.set(tx1 + 0.05, th + 0.45, (tz1 + tz2) / 2); group.add(rail2);
  b.box(mat('wool', '#2a2a2a'), tx2 - tx1 - 1.2, 0.05, 0.05, (tx1 + tx2) / 2 - 0.6, th + 0.92, tz2 - 0.05);
  for (let i = 0; i < 8; i++) {                                         // 弧形階梯往東下
    const h = th - (i + 1) * 0.2, x = tx2 + 0.2 + i * 0.4, wz = (tz2 - tz1) + i * 0.25;
    if (h <= 0) break;
    b.box(granite, 0.4, h, wz, x, h / 2, tz1 + wz / 2);
    raised.push({ x1: x - 0.2, x2: x + 0.2, z1: tz1, z2: tz1 + wz, h });
  }
  const steel = mat('wool', '#c9cdd2');
  { const g = new THREE.BoxGeometry(2.2, 0.05, 0.05); g.rotateZ(-0.42); g.translate(tx2 + 1.0, th + 0.55, tz2 + 0.55); b.add(steel, g); }
  b.box(mat('leaves'), tx2 - tx1 + 2, 0.9, 0.9, (tx1 + tx2) / 2 - 1.2, 0.45, tz2 + 0.6);         // 樹籬
  for (const [x, z] of [[-12.2, m.z1 + 1.4], [-10.6, m.z1 + 2.4], [-11.2, m.z1 + 0.9]]) bananaTree(b, x, z, 2.6 + (x % 2 ? 0.4 : 0));
  for (let i = 0; i < 14; i++) {                                        // 波浪石牆
    const x = -15.2 + i * 0.4, h = 0.55 + Math.sin(i * 0.7) * 0.25;
    b.box(mat('wool', '#9c9690'), 0.42, h, 0.45, x, h / 2, m.z1 + 2.6);
  }
  // 百葉箱
  const wbx = -0.6, wbz = m.z1 + 2.6, white = mat('wool', '#f2f2ef');
  for (const [a, c] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) b.box(white, 0.06, 1.1, 0.06, wbx + a * 0.25, 0.55, wbz + c * 0.2);
  b.box(white, 0.7, 0.6, 0.55, wbx, 1.4, wbz);
  for (let i = 0; i < 5; i++) b.box(mat('wool', '#d8d8d4'), 0.72, 0.03, 0.57, wbx, 1.15 + i * 0.12, wbz);
  for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.8, 0.05, 0.42); g.rotateX(s * 0.55); g.translate(wbx, 1.82, wbz + s * 0.15); b.add(white, g); }
  // 石桌椅
  const stone = mat('wool', '#7d7f80'), sx = 2.6, sz = m.z1 + 3.0;
  { const g = new THREE.CylinderGeometry(0.85, 0.85, 0.12, 16); g.translate(sx, 0.7, sz); b.add(stone, g); }
  { const g = new THREE.CylinderGeometry(0.3, 0.4, 0.64, 10); g.translate(sx, 0.32, sz); b.add(stone, g); }
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, g = new THREE.CylinderGeometry(0.25, 0.28, 0.4, 10); g.translate(sx + Math.cos(a) * 1.35, 0.2, sz + Math.sin(a) * 1.35); b.add(stone, g); }

  // 電腦教室前的沙坑：灰色遮陽篷（扇形邊）、藍色柱子、波浪磨石子邊框、彩色橡膠地墊
  const kx = 12.6, kz = m.z1 + 2.9, kw = 5.6, kd = 3.0;
  b.box(mat('wool', '#d8c9a6'), kw, 0.05, kd, kx, 0.03, kz);
  SPOTS.push({ kind: 'sand', name: '沙坑', x: kx, z: kz, w: kw, d: kd, y: 0.055, r: 2.6, floorY: 0 });   // 可以玩沙（堆沙堡）
  const terr = mat('wool', '#b9b6ae');
  for (let i = 0; i <= 14; i++) {
    const x = kx - kw / 2 + (i / 14) * kw, h = 0.35 + Math.abs(Math.sin(i * 0.9)) * 0.35;
    b.box(terr, kw / 14 + 0.02, h, 0.3, x, h / 2, kz + kd / 2 + 0.15);
  }
  for (let i = 0; i <= 7; i++) {
    const z = kz - kd / 2 + (i / 7) * kd, h = 0.35 + Math.abs(Math.sin(i * 1.1)) * 0.3;
    b.box(terr, 0.3, h, kd / 7 + 0.02, kx - kw / 2 - 0.15, h / 2, z);
  }
  const pole = mat('wool', '#2e6fc4');
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(pole, 0.12, 2.6, 0.12, kx + a * (kw / 2 - 0.3), 1.3, kz + c * (kd / 2 - 0.2));
  const canvas = mat('wool', '#7c8085');
  for (let i = 0; i < 10; i++) {
    const t = (i + 0.5) / 10, z = kz - kd / 2 - 0.2 + t * (kd + 0.4);
    b.box(canvas, kw + 0.4, 0.06, (kd + 0.4) / 10 + 0.02, kx, 2.6 + Math.sin(Math.PI * t) * 0.55, z);
  }
  for (let i = 0; i < 18; i++) for (const s of [-1, 1]) b.box(i % 2 ? canvas : mat('wool', '#eceae4'), (kw + 0.4) / 18, 0.12, 0.04, kx - (kw + 0.4) / 2 + ((kw + 0.4) / 18) * (i + 0.5), 2.55, kz + s * (kd / 2 + 0.2));
  for (const [x, c] of [[kx + 0.4, '#2e6fc4'], [kx + 1.2, '#e8e8e4']]) { b.box(mat('wool', '#e8e8e4'), 0.7, 0.45, 0.5, x, 0.23, kz + kd / 2 - 0.5); b.box(mat('wool', c), 0.72, 0.08, 0.52, x, 0.49, kz + kd / 2 - 0.5); }
  const tiles = ['#3f6b55', '#5a4d5e', '#6d6f73'];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) b.box(mat('wool', tiles[(i + j) % 3]), 0.98, 0.03, 0.48, kx - 4.0 + i * 1.0, 0.015, kz + kd / 2 + 0.55 + j * 0.5);
  b.build(group);
  return raised;
}

/* ---------- 教師停車場（乙梯旁邊的空地，依 2026-10-14 照片） ----------
 * 地面是灰粉色地磚。車子停在三邊、中間留車道才開得出去（依使用者說明）：
 *   西邊沿圍牆 3 台前後一列（車頭朝南）、北邊沿扶手 2 台（車頭朝南）、東邊靠乙梯 4 台（車頭朝西）；
 *   南邊空著，接到警衛室旁邊往校門的車道。東邊是上走廊的階梯（無障礙車位標誌在旁邊） */
// 方塊車：車身、車窗、車頂、輪子、車燈。ax：車子長邊沿 x（true）或沿 z（false）；dir：車頭朝 +（1）或 -（-1）
function car(b, x, z, dir, color, ax = true) {
  const body = mat('wool', color), glass = mat('wool', '#2b3440'), tire = mat('wool', '#1b1b1d');
  const B = (m, l, h, w, dl, y, dw) => (ax ? b.box(m, l, h, w, x + dl, y, z + dw) : b.box(m, w, h, l, x + dw, y, z + dl));
  B(body, 4.3, 0.65, 1.8, 0, 0.6, 0);                                     // 車身
  B(glass, 2.3, 0.55, 1.62, -dir * 0.25, 1.2, 0);                         // 車窗（車廂）
  B(body, 2.1, 0.1, 1.55, -dir * 0.25, 1.52, 0);                          // 車頂
  for (const [a, c] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) B(tire, 0.62, 0.6, 0.3, a * 1.35, 0.3, c * 0.82);
  for (const c of [-0.6, 0.6]) {
    B(mat('wool', '#fff6c8'), 0.06, 0.16, 0.36, dir * 2.16, 0.72, c);    // 頭燈
    B(mat('wool', '#c0392b'), 0.06, 0.14, 0.32, -dir * 2.16, 0.74, c);   // 尾燈
  }
}
const paverMat = () => {
  if (paverMat.m) return paverMat.m;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  const cols = ['#a9a3a2', '#b9a7a6', '#9d9a9b', '#c2b2ae', '#aaa0a4'];
  for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) {
    c.fillStyle = cols[(r * 3 + k * 7) % cols.length]; c.fillRect(k * 16 + (r % 2) * 8 - 8, r * 8, 15, 7);
    c.fillRect(k * 16 + (r % 2) * 8 + 8, r * 8, 15, 7);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  return (paverMat.m = new THREE.MeshLambertMaterial({ map: t }));
};
// Subaru 森林人（方方高高的休旅車：黑色輪拱飾板、車頂架、大燈會亮）。單獨一組（不合併），點了會閃大燈、按喇叭
//   車長沿 z、車頭朝 dir（1＝往 +z）；回傳 { g, lights }
function forester(x, z, dir, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); if (dir < 0) g.rotation.y = Math.PI;
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const body = M(color), clad = M('#26282b'), glass = M('#2b3440'), tire = M('#151517'), rim = M('#9aa1a8'), rail = M('#1d1f22');
  const box = (m, w, h, d, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  box(body, 1.84, 0.78, 4.6, 0, 0.78, 0);                          // 車身（比轎車高）
  box(clad, 1.88, 0.24, 4.64, 0, 0.42, 0);                          // 下緣黑色飾板
  box(glass, 1.7, 0.66, 2.75, 0, 1.5, -0.25);                       // 車窗（車廂方方正正、到車尾）
  box(body, 1.66, 0.08, 2.7, 0, 1.86, -0.25);                       // 車頂
  for (const sx of [-0.62, 0.62]) box(rail, 0.06, 0.08, 2.3, sx, 1.94, -0.25);   // 車頂架
  box(M('#3a3c40'), 1.2, 0.2, 0.06, 0, 0.82, 2.31);                 // 水箱罩
  box(M('#c9ccd0'), 0.18, 0.1, 0.07, 0, 0.84, 2.33);                 // 廠徽
  for (const [a, c] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    box(tire, 0.32, 0.72, 0.72, a * 0.84, 0.36, c * 1.45);
    box(rim, 0.33, 0.34, 0.34, a * 0.84, 0.36, c * 1.45);
  }
  const lights = [];
  for (const sx of [-0.62, 0.62]) {
    lights.push(box(M('#fff6c8', { emissive: '#000000' }), 0.42, 0.14, 0.06, sx, 1.0, 2.3));    // 大燈
    box(M('#c0392b'), 0.36, 0.14, 0.06, sx, 1.02, -2.3);                                        // 尾燈
  }
  // 碰撞：蓋場景時登記一個方塊
  Batch.collector?.push({ x1: x - 0.94, x2: x + 0.94, z1: z - 2.32, z2: z + 2.32, y1: 0, y2: 1.95 });
  return { g, lights };
}
// 鐵皮浪板（資源回收場）：淺灰綠色、直條紋
const tinMat = () => {
  if (tinMat.m) return tinMat.m;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#c9d0c8'; c.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(x, 0, 2, 64); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 4, 0, 2, 64); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (tinMat.m = new THREE.MeshLambertMaterial({ map: t }));
};
/** x1～x2、z1～z2：停車場範圍（公尺）；guardZ：警衛室北牆（西邊那列車從這裡往北排）；shedX2：資源回收場東邊到哪裡 */
export function buildParking(group, x1, x2, z1, z2, { guardZ = z2 + 9, shedX2 = x1 + 8 } = {}) {
  const b = new Batch();
  b.box(paverMat(), x2 - x1, 0.04, z2 - z1, (x1 + x2) / 2, 0.02, (z1 + z2) / 2);                // 地磚
  const line = mat('wool', '#ece8e2');
  // 西邊沿圍牆：3 台前後首尾相接、車頭朝南；最南邊那台緊靠警衛室北牆，往北排上去
  ['#7d8790', '#f4f4f2', '#25272b'].forEach((c, i) => car(b, x1 + 1.25, guardZ - 2.4 - i * 4.4, 1, c, false));
  // 北邊沿扶手：2 台並排、車頭朝南（靠東邊一點，後面是資源回收場）：藍色森林人（Upsky 老師的車）、綠色森林人（同事看了也跟著買）
  const nx = [x1 + 6.8, x1 + 9.5];
  const foresters = [forester(nx[0], z1 + 2.4, 1, '#2f5aa0'), forester(nx[1], z1 + 2.4, 1, '#3e6b4f')];
  for (const fo of foresters) group.add(fo.g);
  for (let i = 0; i <= nx.length; i++) b.box(line, 0.1, 0.02, 4.8, x1 + 4.05 + i * 2.7, 0.045, z1 + 2.4);
  // 東邊靠乙梯（走廊那側）：4 台並排、車頭朝西（朝中間車道）
  const ez = [0, 1, 2, 3].map((i) => z2 - 1.6 - i * 2.7);
  ez.forEach((z, i) => car(b, x2 - 2.6, z, -1, ['#5d6168', '#6f7378', '#c9ccd0', '#3a5f9e'][i], true));
  for (let i = 0; i <= ez.length; i++) b.box(line, 4.8, 0.02, 0.1, x2 - 2.55, 0.045, z2 - 0.25 - i * 2.7);
  // 北邊後面：資源回收場（鐵皮屋，大約一層半樓高，斜屋頂；正面朝停車場，有拉門和招牌）
  {
    const sx1 = x1 + 0.1, sx2 = shedX2, sz1 = z1 - 5.2, sz2 = z1 - 0.15, sh = 4.6, cx = (sx1 + sx2) / 2, cz = (sz1 + sz2) / 2;
    const tin = tinMat(), frame = mat('wool', '#8e9590'), roof = mat('wool', '#b7bdb8'), dark = mat('wool', '#3f4542');
    b.box(tin, sx2 - sx1, sh, sz2 - sz1, cx, sh / 2, cz);                                   // 鐵皮牆
    const rg = new THREE.BoxGeometry(sx2 - sx1 + 0.5, 0.12, sz2 - sz1 + 0.9); rg.rotateX(-0.12); rg.translate(cx, sh + 0.3, cz);   // 往前（南）斜的屋頂
    b.add(roof, rg);
    for (const x of [sx1 + 0.08, sx2 - 0.08]) b.box(frame, 0.16, sh, 0.16, x, sh / 2, sz2);   // 角柱
    const dw = Math.min(4.2, sx2 - sx1 - 1.6), dx = cx - 0.6;
    b.box(dark, dw + 0.2, 2.7, 0.06, dx, 1.35, sz2 + 0.02);                                // 拉門門框（暗）
    for (let k = 0; k < 2; k++) b.box(tin, dw / 2 - 0.06, 2.55, 0.05, dx - dw / 4 + k * dw / 2, 1.3, sz2 + 0.06);   // 兩片鐵皮拉門
    // 招牌：白底綠字「資源回收場」；旁邊藍色無障礙標誌
    const sign = new THREE.CanvasTexture((() => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 72;
      const c = cv.getContext('2d'); c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, 320, 72); c.strokeStyle = '#2e7d4f'; c.lineWidth = 6; c.strokeRect(3, 3, 314, 66);
      c.fillStyle = '#2e7d4f'; c.font = '900 44px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('資源回收場', 160, 38); return cv; })());
    sign.colorSpace = THREE.SRGBColorSpace;
    b.plain(new THREE.MeshLambertMaterial({ map: sign }), 2.4, 0.54, 0.04, dx, 3.05, sz2 + 0.07);
    b.box(mat('wool', '#2f5aa8'), 0.5, 0.55, 0.04, dx + dw / 2 + 0.6, 2.4, sz2 + 0.07);
    b.box(mat('wool', '#ffffff'), 0.22, 0.26, 0.05, dx + dw / 2 + 0.6, 2.42, sz2 + 0.07);
  }
  // 無障礙車位標誌（藍底白色輪椅）
  b.box(mat('wool', '#c9cdd2'), 0.08, 2.0, 0.08, x2 - 1.0, 1.0, z1 + 0.6);
  b.box(mat('wool', '#2f5aa8'), 0.04, 0.6, 0.45, x2 - 1.0, 1.75, z1 + 0.6);
  b.box(mat('wool', '#ffffff'), 0.05, 0.25, 0.2, x2 - 1.0, 1.8, z1 + 0.6);
  // 東邊靠走廊的不鏽鋼扶手（往走廊的階梯旁）
  const steel = mat('wool', '#c9cdd2');
  for (const [a, c] of [[z1 + 0.3, z1 + 2.8], [z2 - 2.8, z2 - 0.3]]) {        // 只有兩端有扶手，中間是走進走廊的入口
    for (let z = a; z <= c + 0.01; z += (c - a) / 2) b.box(steel, 0.05, 1.0, 0.05, x2 - 0.25, 0.5, z);
    b.box(steel, 0.06, 0.06, c - a, x2 - 0.25, 1.0, (a + c) / 2);
  }
  b.build(group);
  return foresters;
}

/* ---------- 校門口一帶（依 2026-10-14 照片）
 *   左（北）：汽車停車場，沿著警衛室旁邊的車道往北接到圖書館那頭
 *   右（南）：機車停車棚（綠色屋頂、木頭天花板、紅白藍條紋柱子、不鏽鋼信箱櫃），旁邊是馬賽克壁畫牆，走到底的拱門通操場
 *   穿堂入口：寬花崗石階梯、兩旁花台與扶手、彩色條紋雨遮、金色鏤空招牌 */
const mosaicKidsMat = () => texMat('mosaickids', 1024, 160, (c, w, h) => {
  const P = 8;                                                          // 一格馬賽克 8px
  for (let y = 0; y < h; y += P) for (let x = 0; x < w; x += P) {
    let col = y < 26 ? '#7aa6dc' : y > h - 52 ? (y > h - 26 ? '#4f8a3a' : '#7fb04a') : '#eef0f2';
    if (y >= 24 && y < 34 && Math.sin(x / 26) > 0.2) col = '#7aa6dc';     // 藍色雲邊
    c.fillStyle = col; c.fillRect(x, y, P - 1, P - 1);
  }
  const kid = (x0, skin, shirt, pants, pose) => {                       // 像素小孩在玩（踢球、跳繩、跑步）
    const px = (gx, gy, col) => { c.fillStyle = col; c.fillRect(x0 + gx * P, 40 + gy * P, P - 1, P - 1); };
    for (const [gx, gy] of [[1, 0], [2, 0], [1, 1], [2, 1]]) px(gx, gy, '#2b2b2b');
    for (const [gx, gy] of [[1, 2], [2, 2]]) px(gx, gy, skin);
    for (let gy = 3; gy < 6; gy++) for (let gx = 1; gx < 3; gx++) px(gx, gy, shirt);
    px(0, 3 + pose % 2, skin); px(3, 4 - pose % 2, skin);
    for (let gy = 6; gy < 9; gy++) { px(1 - (pose % 2) * (gy - 6) / 2 | 0, gy, pants); px(2 + (gy - 6) / 2 | 0, gy, pants); }
  };
  const cols = [['#f2c9a0', '#e85d3a', '#2f5aa8'], ['#f6d1b0', '#f2c230', '#3a3a3a'], ['#f2c9a0', '#4f9a3a', '#2f5aa8'], ['#f6d1b0', '#e8892b', '#6b4a32'], ['#f2c9a0', '#3b82f6', '#2b2b2b']];
  for (let i = 0; i < 12; i++) kid(30 + i * 82, ...cols[i % cols.length], i);
  c.fillStyle = '#e53935'; for (let i = 0; i < 4; i++) c.fillRect(110 + i * 230, 110, 14, 14);   // 球
}, {});
const stripeCeilMat = () => texMat('stripeceil', 512, 128, (c, w, h) => {
  const cols = ['#a64d6b', '#e8a07a', '#f2c9b8', '#e8b04a', '#f4d6c8', '#d8653a', '#b05a7a', '#f0b98a'];
  const n = cols.length;
  for (let i = 0; i < n; i++) { c.fillStyle = cols[i]; c.beginPath(); c.moveTo(i * w / n, 0); c.lineTo((i + 1) * w / n, 0); c.lineTo((i + 1.6) * w / n, h); c.lineTo((i + 0.6) * w / n, h); c.fill(); }
});
const goldBandMat = () => texMat('goldband', 1024, 128, (c, w, h) => {
  c.fillStyle = '#b8955a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#d9bd84'; for (let y = 6; y < h; y += 12) for (let x = (y / 12 % 2) * 6; x < w; x += 12) { c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#e8e4da'; c.fillRect(0, 0, w, 62);
  c.fillStyle = '#5a5a55'; c.font = '700 38px "Noto Sans TC", sans-serif'; c.textAlign = 'center';
  c.fillText('臺 北 市 文 山 區 溪 口 國 民 小 學', w / 2, 46);
  c.fillStyle = '#5a4520'; c.font = '700 26px serif';
  c.fillText('Taipei Municipal Wenshan District Xikou Elementary School', w / 2, 102);
});
const lockerMat = () => texMat('lockers', 128, 128, (c, w, h) => {
  c.fillStyle = '#c9cdd2'; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) {
    c.fillStyle = '#b3b8be'; c.fillRect(4 + k * 31, 4 + r * 25, 28, 22);
    c.fillStyle = '#7d8288'; c.fillRect(14 + k * 31, 16 + r * 25, 8, 3);
  }
});
// 機車：車身沿 x（並排停在 z 方向），dir：車頭朝 +x（1）或 -x（-1）
function scooter(b, x, z, col, dir = 1) {
  const body = mat('wool', col), dark = mat('wool', '#1d1f22'), seat = mat('wool', '#2b2b2b'), red = mat('wool', '#c0392b');
  b.box(dark, 0.42, 0.42, 0.12, x + dir * 0.62, 0.21, z);                 // 前輪
  b.box(dark, 0.42, 0.42, 0.12, x - dir * 0.62, 0.21, z);                 // 後輪
  b.box(body, 1.25, 0.42, 0.42, x - dir * 0.1, 0.55, z);                  // 車身
  b.box(seat, 0.7, 0.12, 0.36, x - dir * 0.3, 0.82, z);                   // 坐墊
  b.box(body, 0.18, 0.65, 0.4, x + dir * 0.55, 0.85, z);                  // 前面
  b.box(dark, 0.05, 0.05, 0.62, x + dir * 0.55, 1.2, z);                  // 把手
  b.box(red, 0.04, 0.1, 0.24, x - dir * 0.74, 0.7, z);                    // 尾燈
}
/** 校門口：gx 是校門（圍牆）的 x；z1、z2 是校門口兩邊；hall：穿堂 { x1, z1, z2 }；base：建築墊高 */
export function buildFrontYard(group, { gx, gz1, gz2, hall, guard, base, fieldZ, carLot }) {
  const b = new Batch(), raised = [];
  const paver = mat('tile', '#b9b2ac'), granite = mat('wool', '#b8b4ae'), steel = mat('wool', '#c9cdd2');
  // 地面：校門到穿堂、往北到停車場、往南到操場，都是灰粉色地磚
  b.box(paver, hall.x1 - gx, 0.03, gz2 - gz1 + 6, (gx + hall.x1) / 2, 0.015, (gz1 + gz2) / 2);
  b.box(paver, hall.x1 - guard.x2 - 0.2, 0.03, gz1 - carLot.z2 + 0.2, (guard.x2 + hall.x1) / 2, 0.015, (gz1 + carLot.z2) / 2);   // 警衛室旁的車道
  b.box(paver, hall.x1 - gx, 0.03, guard.z1 - carLot.z2, (gx + hall.x1) / 2, 0.015, (carLot.z2 + guard.z1) / 2);   // 停車場和警衛室中間
  b.box(paver, hall.x1 - gx, 0.03, fieldZ - gz2, (gx + hall.x1) / 2, 0.015, (gz2 + fieldZ) / 2);
  // 沿著圍牆、往北接到停車場的那列車在 buildParking（從警衛室北牆往北排）
  // 穿堂入口：雨遮（底下彩色條紋、正面金色鏤空招牌）、兩旁花台、扶手、國旗
  const hz1 = hall.z1, hz2 = hall.z2, hzc = (hz1 + hz2) / 2, hx = hall.x1, top = base + 3.4;
  b.plain(stripeCeilMat(), 3.2, 0.12, hz2 - hz1 + 2, hx - 1.4, top, hzc);
  b.plain(goldBandMat(), 0.25, 1.3, hz2 - hz1 + 2.2, hx - 3.05, top + 0.55, hzc);
  b.box(mat('wool', '#e9e6df'), 3.4, 0.35, hz2 - hz1 + 2.2, hx - 1.3, top + 1.35, hzc);
  for (const s of [-1, 1]) {
    const z = s < 0 ? hz1 - 0.6 : hz2 + 0.6;
    b.box(mat('wool', '#d8d4cc'), 0.5, top, 0.5, hx - 0.25, top / 2, z);          // 雨遮柱
    b.box(granite, 1.6, base + 0.2, 1.4, hx - 1.0, (base + 0.2) / 2, z);           // 花台（跟穿堂一樣高）
    const g = new THREE.CylinderGeometry(0.42, 0.3, 0.32, 14); g.translate(hx - 1.0, base + 0.36, z); b.add(mat('wool', '#c4704a'), g);   // 陶盆
    b.box(mat('leaves'), 0.7, 0.6, 0.7, hx - 1.0, base + 0.8, z);
    raised.push({ x1: hx - 1.8, x2: hx - 0.2, z1: z - 0.7, z2: z + 0.7, h: base + 0.2 });
    // 不鏽鋼扶手（沿著階梯往下）
    const rz = s < 0 ? hz1 + 1.0 : hz2 - 1.0, g2 = new THREE.BoxGeometry(1.6, 0.05, 0.05);
    g2.rotateZ(0.75); g2.translate(hx - 0.65, base * 0.5 + 0.95, rz); b.add(steel, g2);
    for (const dx of [-1.25, -0.1]) b.box(steel, 0.05, 0.95, 0.05, hx + dx, (base * (dx > -1 ? 1 : 0.1)) + 0.47, rz);
    // 國旗（照片上入口兩旁各有一支）
    const fz = s < 0 ? hz1 - 1.3 : hz2 + 1.3;
    { const pg = new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6); pg.translate(hx - 2.2, 1.6, fz); b.add(steel, pg); }
    {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshLambertMaterial({ map: flagMat().map, side: THREE.DoubleSide }));
      fl.rotation.y = -Math.PI / 2; fl.position.set(hx - 2.2, 2.85, fz + s * 0.45);   // 面向校門；旗子往外側（遠離入口）飄
      fl.scale.x = s < 0 ? -1 : 1;                                                        // 青天白日都在靠旗桿那一角
      group.add(fl);
    }
  }
  // 校門南邊：馬賽克壁畫牆（在圍牆內側）
  const wz1 = gz2 + 1.4, wz2 = fieldZ - 3.5;
  b.box(mat('wool', '#d9d4ca'), 0.4, 2.4, wz2 - wz1, gx + 0.2, 1.2, (wz1 + wz2) / 2);
  b.plain(mosaicKidsMat(), 0.02, 2.2, wz2 - wz1 - 0.2, gx + 0.42, 1.15, (wz1 + wz2) / 2);
  b.box(mat('wool', '#4a5a6a'), 0.5, 0.15, wz2 - wz1, gx + 0.22, 2.45, (wz1 + wz2) / 2);
  // 機車停車棚：綠色屋頂、木頭天花板、紅白藍條紋柱子、不鏽鋼信箱櫃
  const sx1 = gx + 2.0, sx2 = sx1 + 4.2, sz1 = wz1 + 2.0, sz2 = wz2 - 1.0, H = 2.7;
  b.box(mat('wool', '#3f6b52'), sx2 - sx1 + 0.8, 0.35, sz2 - sz1 + 0.8, (sx1 + sx2) / 2, H + 0.18, (sz1 + sz2) / 2);
  b.box(mat('wool', '#2f3437'), sx2 - sx1 + 0.85, 0.12, sz2 - sz1 + 0.85, (sx1 + sx2) / 2, H + 0.42, (sz1 + sz2) / 2);
  b.box(mat('planks', '#b5773f'), sx2 - sx1 + 0.6, 0.04, sz2 - sz1 + 0.6, (sx1 + sx2) / 2, H - 0.02, (sz1 + sz2) / 2);
  const pil = (x, z) => {
    b.box(mat('wool', '#2f5aa8'), 0.5, 0.9, 0.5, x, 0.45, z);
    for (let i = 0; i < 4; i++) b.box(mat('wool', i % 2 ? '#e8826a' : '#f4f1ea'), 0.5, 0.45, 0.5, x, 0.9 + 0.225 + i * 0.45, z);
  };
  for (let z = sz1; z <= sz2 + 0.01; z += (sz2 - sz1) / 3) pil(sx2, z);
  for (const z of [sz1, sz2]) pil(sx1, z);
  b.plain(lockerMat(), 0.6, 1.6, 1.8, sx1 + 0.7, 0.8, sz1 + 1.2);                 // 信箱櫃
  b.box(mat('planks', '#c98c4a'), 0.08, 2.0, 1.9, sx1 + 1.05, 1.0, sz1 + 1.2);    // 木頭圍板
  const cols = ['#1f1f22', '#2b2f36', '#d8d8d4', '#7fb6d6', '#1f1f22', '#b8312f', '#f2efe2', '#2b2f36', '#9aa0a6', '#1f1f22'];
  let k = 0;
  // 車頭朝牆、一台一台並排（像照片）：靠牆一排、外面一排
  for (let z = sz1 + 2.7; z < sz2 - 0.4; z += 0.62) {
    scooter(b, sx1 + 0.95, z, cols[k++ % cols.length], -1);
    if ((k % 6) !== 2) scooter(b, sx2 - 1.0, z + 0.3, cols[(k * 3) % cols.length], 1);
  }
  // 走到底：拱門通往操場
  const az = fieldZ - 2.4, ax1 = gx + 0.3, ax2 = sx2 + 4;
  b.box(mat('wool', '#d9cfbd'), (ax2 - ax1) / 2 - 1.3, 2.6, 0.4, ax1 + ((ax2 - ax1) / 2 - 1.3) / 2, 1.3, az);
  b.box(mat('wool', '#d9cfbd'), (ax2 - ax1) / 2 - 1.3, 2.6, 0.4, ax2 - ((ax2 - ax1) / 2 - 1.3) / 2, 1.3, az);
  const ac = (ax1 + ax2) / 2;
  for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; b.box(mat('wool', '#d9cfbd'), 0.3, 0.3, 0.4, ac - Math.cos(a) * 1.3, 2.1 + Math.sin(a) * 0.6, az); }
  b.box(mat('wool', '#d9cfbd'), 2.6, 0.3, 0.4, ac, 2.75, az);
  b.build(group);
  return raised;
}
const flagMat = () => texMat('rocflag', 96, 64, (c, w, h) => {
  c.fillStyle = '#d7262b'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#1b3f95'; c.fillRect(0, 0, w / 2, h / 2);
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(w / 4, h / 4, 7, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.moveTo(w / 4 + Math.cos(a) * 11, h / 4 + Math.sin(a) * 11); c.lineTo(w / 4 + Math.cos(a + 0.2) * 7, h / 4 + Math.sin(a + 0.2) * 7); c.lineTo(w / 4 + Math.cos(a - 0.2) * 7, h / 4 + Math.sin(a - 0.2) * 7); c.fill(); }
  c.fillStyle = '#1b3f95'; c.beginPath(); c.arc(w / 4, h / 4, 5.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(w / 4, h / 4, 4.5, 0, Math.PI * 2); c.fill();
});

/* ---------- 警衛室（依照片）：外牆木紋磚、窗口有大理石檯面、上面鐵皮雨遮、轉角「警衛室」牌子 ---------- */
export function buildGuardHouse(group, m, base) {
  const b = new Batch();
  // 窗口朝南（校門口那邊）：檯面＋雨遮（在地面高度看出去）
  const z = m.z2 + 0.15, xc = (m.x1 + m.x2) / 2;
  b.box(mat('wool', '#efe9dc'), 1.9, 0.06, 0.45, xc, base + 0.9, z + 0.2);
  b.box(mat('wool', '#6f7478'), m.x2 - m.x1 + 0.6, 0.06, 1.3, xc, base + 3.0, z + 0.55);
  for (const dx of [-1, 1]) { const g = new THREE.BoxGeometry(0.06, 0.06, 1.2); g.rotateX(-0.6); g.translate(xc + dx * (m.x2 - m.x1) * 0.35, base + 2.7, z + 0.4); b.add(mat('wool', '#3a3f45'), g); }
  b.plain(texMat('guardsign', 128, 64, (c, w, h) => {
    c.fillStyle = '#f6f2ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#c98c4a'; c.fillRect(w - 30, 0, 30, h);
    c.fillStyle = '#2b2b2b'; c.font = '700 26px "Noto Sans TC", sans-serif'; c.fillText('警衛室', 6, 30);
    c.font = '600 12px sans-serif'; c.fillText('Security Room', 6, 52);
  }), 0.6, 0.3, 0.02, m.x2 - 0.4, base + 2.4, z + 0.02);
  b.build(group);
}
