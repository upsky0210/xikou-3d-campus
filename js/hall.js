/* 穿堂東端（依使用者 11-25 的三張照片重做）
   - hallThemeWall：主題牆（整年都在）：深灰牆、夜空和山、打開的書（窗、小門、英文標語）、兩側玻璃磚窗、紅框時鐘、無障礙標示牌、四盆盆栽
   - hallXmas：耶誕布置（event-dates.js 的 XMAS_ON，2027/01/04 0:00 自動收起來）：
     木頭矮圍籬和白毛毯、三隻土撥鼠（耶誕帽、圍巾、耳罩、格子禮物、紅緞帶）、白樹、覆雪小樹、小玩偶和木牌、頂上松枝花圈＋一排吊飾、金色大鈴鐺
     （大耶誕樹在 furniture.js 的 xmasTree）
   座標：s＝從主題牆左端（北）往右（南）幾公尺，d＝離牆往外幾公尺，y＝高度 */
import * as THREE from 'three';
import { mat } from './blocks.js?v=349';

const cache = {};
const once = (k, f) => (cache[k] ||= f());
function tex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// 穿堂比較暗：東西自己亮一點（e：亮多少）
const lit = (c, e = 0.28) => once(`lit${c}${e}`, () => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e, side: THREE.DoubleSide }));
const litMap = (k, e, w, h, draw) => once(k, () => { const map = tex(w, h, draw); return new THREE.MeshLambertMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: e }); });

/* ---------- 主題牆 ---------- */
const WALL_LEN = 6.39, WALL_H = 2.96, PX = 220;                         // 1 公尺＝220 像素
const WIN = [[0.72, 1.6, 0.5, 2.62], [5.0, 5.9, 0.5, 2.62]];            // 玻璃磚窗：s1, s2, 下緣, 上緣
const themeMat = () => litMap('theme', 0.22, Math.round(WALL_LEN * PX), Math.round(WALL_H * PX), (c, w, h) => {
  const X = (s) => s * PX, Y = (y) => h - y * PX;
  const R = (s1, s2, y1, y2, col) => { c.fillStyle = col; c.fillRect(X(s1), Y(y2), X(s2 - s1), (y2 - y1) * PX); };
  c.fillStyle = '#3a4149'; c.fillRect(0, 0, w, h);
  R(0, 0.55, 0, WALL_H, '#2c3238'); R(5.95, WALL_LEN, 0, WALL_H, '#2c3238');         // 兩邊的柱子
  const branch = (pts, lw) => { c.lineWidth = lw; c.beginPath(); c.moveTo(X(pts[0][0]), Y(pts[0][1])); for (const p of pts.slice(1)) c.lineTo(X(p[0]), Y(p[1])); c.stroke(); };
  // 夜空（下面兩個角是圓的）
  c.fillStyle = '#20242a';
  c.beginPath(); c.moveTo(X(1.66), Y(WALL_H)); c.lineTo(X(4.94), Y(WALL_H)); c.lineTo(X(4.94), Y(0.82)); c.quadraticCurveTo(X(4.92), Y(0.56), X(4.66), Y(0.56));
  c.lineTo(X(1.92), Y(0.56)); c.quadraticCurveTo(X(1.68), Y(0.56), X(1.66), Y(0.82)); c.fill();
  // 打在牆上的黃光
  for (const s of [2.35, 4.1]) {
    const g = c.createRadialGradient(X(s), Y(1.95), 10, X(s), Y(1.95), 190);
    g.addColorStop(0, 'rgba(214,190,150,.28)'); g.addColorStop(1, 'rgba(214,190,150,0)');
    c.fillStyle = g; c.fillRect(X(s) - 190, Y(1.95) - 190, 380, 380);
  }
  // 山
  c.fillStyle = '#15181c';
  c.beginPath(); c.moveTo(X(1.7), Y(0.82));
  for (const [cx, cy, x, y] of [[1.95, 1.0, 2.12, 1.22], [2.25, 1.42, 2.42, 1.2], [2.52, 1.02, 2.62, 1.08], [2.7, 1.14, 2.8, 0.98]]) c.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y));
  c.lineTo(X(3.6), Y(0.98)); c.quadraticCurveTo(X(3.8), Y(1.2), X(3.95), Y(1.0));
  for (const [cx, cy, x, y] of [[4.1, 1.1, 4.2, 1.36], [4.32, 1.62, 4.46, 1.2], [4.52, 1.0, 4.62, 1.12], [4.76, 1.36, 4.93, 1.2]]) c.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y));
  c.lineTo(X(4.93), Y(0.8)); c.quadraticCurveTo(X(4.92), Y(0.57), X(4.66), Y(0.57)); c.lineTo(X(1.92), Y(0.57)); c.quadraticCurveTo(X(1.7), Y(0.57), X(1.7), Y(0.82)); c.fill();
  // 樹（淺一點的灰）：左右各一棵，樹枝伸進夜空；綠葉子
  c.strokeStyle = '#454d55'; c.lineCap = 'round'; c.lineJoin = 'round';
  branch([[1.64, 0.6], [1.64, 2.3]], 16); branch([[1.64, 2.1], [1.9, 2.35], [2.02, 2.6]], 13); branch([[1.86, 2.32], [2.16, 2.44]], 8);
  branch([[4.97, 0.6], [4.96, 2.9]], 22); branch([[4.95, 1.75], [4.8, 1.85], [4.72, 1.8]], 9); branch([[4.95, 2.45], [4.72, 2.62], [4.62, 2.8]], 10);
  c.fillStyle = '#5d8a5e';
  for (const [s, y, r] of [[1.98, 2.5, 0.5], [2.08, 2.6, -0.6], [2.12, 2.36, 0.8], [2.2, 2.46, -0.3], [2.04, 2.28, 1.2], [2.24, 2.36, 0.2], [4.6, 2.7, 0.5], [4.66, 2.84, -0.5], [4.72, 2.5, 0.9], [4.7, 1.92, 0.5], [4.64, 1.8, -0.4], [4.72, 1.7, 0.9]]) {
    c.beginPath(); c.ellipse(X(s), Y(y), 9, 5, r, 0, Math.PI * 2); c.fill();
  }
  // 月亮、流星、星星
  c.fillStyle = '#f0d23c'; c.beginPath(); c.arc(X(4.28), Y(2.45), 17, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#20242a'; c.beginPath(); c.arc(X(4.25), Y(2.48), 15, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f0d23c';
  for (const [s, y] of [[2.16, 2.24], [2.56, 2.38]]) { c.beginPath(); c.moveTo(X(s), Y(y)); c.lineTo(X(s + 0.14), Y(y - 0.05)); c.lineTo(X(s), Y(y) + 5); c.fill(); }
  c.fillStyle = '#e8e8e0';
  for (const [s, y] of [[1.9, 1.9], [2.05, 1.62], [2.3, 1.95], [2.42, 1.5], [2.6, 1.75], [2.62, 2.1], [3.84, 2.3], [3.95, 1.9], [4.05, 2.15], [4.2, 1.7], [4.4, 1.95], [4.5, 2.2], [4.56, 1.58], [4.02, 1.45], [2.2, 2.6]]) {
    c.beginPath(); c.arc(X(s), Y(y), 2, 0, 7); c.fill();
  }
  // 書：書頁（米白）、封面（棕灰）
  c.fillStyle = '#cfc6b4'; c.beginPath(); c.moveTo(X(3.48), Y(2.5)); c.quadraticCurveTo(X(3.6), Y(2.42), X(3.74), Y(2.48)); c.lineTo(X(3.74), Y(0.57)); c.lineTo(X(3.48), Y(0.57)); c.fill();
  c.strokeStyle = 'rgba(120,108,88,.35)'; c.lineWidth = 1;
  for (let i = 1; i < 9; i++) { c.beginPath(); c.moveTo(X(3.48) + i * 6, Y(2.44)); c.lineTo(X(3.48) + i * 6, Y(0.57)); c.stroke(); }
  {
    const g = c.createLinearGradient(X(2.74), 0, X(3.48), 0); g.addColorStop(0, '#8d766c'); g.addColorStop(1, '#6b5a54');
    c.fillStyle = g; c.beginPath(); c.moveTo(X(2.74), Y(2.36)); c.lineTo(X(3.48), Y(2.5)); c.lineTo(X(3.48), Y(0.57)); c.lineTo(X(2.74), Y(0.57)); c.fill();
  }
  // 書上的窗：兩個坐著看天空的人
  R(2.93, 3.32, 1.64, 2.12, '#8b8c90'); R(2.955, 3.295, 1.665, 2.095, '#5d6166'); R(2.98, 3.27, 1.69, 2.07, '#6db4e6');
  c.fillStyle = '#fff6e2'; for (const [s, y] of [[3.05, 1.99], [3.2, 1.93]]) { c.beginPath(); c.ellipse(X(s), Y(y), 13, 5, 0, 0, 7); c.fill(); }
  for (const [s, hair, top] of [[3.09, '#d9a35a', '#7a5a46'], [3.17, '#2a2522', '#33363a']]) { R(s - 0.025, s + 0.025, 1.69, 1.75, top); c.fillStyle = hair; c.beginPath(); c.arc(X(s), Y(1.77), 6, 0, 7); c.fill(); }
  // 標語
  c.fillStyle = '#f4f1ea'; c.font = 'bold 19px "Comic Sans MS", "Segoe Print", cursive'; c.textAlign = 'center';
  c.fillText('CHANGE YOUR THOUGHTS AND', X(3.11), Y(1.44), 0.68 * PX); c.fillText("YOU'LL CHANGE YOUR WORLD.", X(3.11), Y(1.3), 0.68 * PX);
  // 小門（綠色，半開、裡面黃黃的光）
  c.fillStyle = '#1f1c1a'; c.beginPath(); c.moveTo(X(2.83), Y(0.57)); c.lineTo(X(2.83), Y(1.05)); c.quadraticCurveTo(X(2.95), Y(1.16), X(3.07), Y(1.05)); c.lineTo(X(3.07), Y(0.57)); c.fill();
  R(2.86, 3.04, 0.57, 1.04, '#f4dc3a'); R(2.86, 2.99, 0.57, 1.04, '#7fa858');
  c.strokeStyle = '#55763c'; c.lineWidth = 2;
  for (const [a, b] of [[0.6, 0.78], [0.82, 1.01]]) for (const s of [2.872, 2.932]) c.strokeRect(X(s), Y(b), 0.046 * PX, (b - a) * PX);
  for (const [s1, s2, y1, y2] of WIN) R(s1 - 0.05, s2 + 0.05, y1 - 0.05, y2 + 0.05, '#1f262b');   // 窗框的凹槽
});
const glassMat = () => litMap('glass', 0.42, 192, 448, (c, w, h) => {
  c.fillStyle = '#5d8f92'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) for (let k = 0; k < 14; k++) {
    const x = i * 32 + 2, y = k * 32 + 2, low = k > 8 && (i * 5 + k * 3) % 4 < 2;         // 下面透出一點後面植物的綠色
    c.fillStyle = low ? '#b9d6bd' : '#cfe3e4'; c.fillRect(x, y, 28, 28);
    if ((i * 7 + k * 5) % 6) {                                                             // 大部分是葉紋玻璃，少數素面
      c.strokeStyle = low ? '#8fb894' : '#9fbfc2'; c.lineWidth = 2;
      for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(x + 4 + j * 5, y + 25); c.quadraticCurveTo(x + 10 + j * 3, y + 12, x + 20 + (j % 2) * 5, y + 4 + j * 4); c.stroke(); }
    }
  }
});
const clockMat = () => litMap('clock', 0.35, 128, 128, (c) => {
  c.fillStyle = '#f8f8f4'; c.fillRect(0, 0, 128, 128);
  c.fillStyle = '#222'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) c.fillText(i, 64 + Math.sin(i * Math.PI / 6) * 50, 64 - Math.cos(i * Math.PI / 6) * 50);
  c.strokeStyle = '#111'; c.lineCap = 'round';
  for (const [a, r, lw] of [[9.5 * Math.PI / 6, 26, 5], [Math.PI, 40, 3]]) { c.lineWidth = lw; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(a) * r, 64 - Math.cos(a) * r); c.stroke(); }
});
// 無障礙標示牌（藍底白字）：左柱 坡道（箭頭往左）、右柱 電梯（箭頭往右）
const accessMat = (right) => litMap(`access${right}`, 0.3, 200, 104, (c, w, h) => {
  c.fillStyle = '#23307c'; c.fillRect(0, 0, w, h);
  const ix = right ? 8 : 106, tx = right ? 148 : 52, d = right ? 1 : -1;
  c.strokeStyle = c.fillStyle = '#ffffff'; c.lineWidth = 3; c.lineCap = 'round'; c.strokeRect(ix, 10, 84, 84);
  c.textAlign = 'center'; c.font = 'bold 25px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  c.fillText('無障礙', tx, 32, 84); c.fillText(right ? '電梯' : '坡道', tx, 60, 84);
  c.lineWidth = 6; c.beginPath(); c.moveTo(tx - d * 36, 82); c.lineTo(tx + d * 28, 82); c.stroke();
  c.beginPath(); c.moveTo(tx + d * 40, 82); c.lineTo(tx + d * 24, 73); c.lineTo(tx + d * 24, 91); c.fill();
  c.lineWidth = 4;
  if (right) {
    c.strokeRect(ix + 22, 40, 42, 46);
    c.beginPath(); c.arc(ix + 42, 70, 11, 0, 7); c.stroke(); c.beginPath(); c.arc(ix + 38, 48, 4, 0, 7); c.fill();
    c.beginPath(); c.moveTo(ix + 38, 54); c.lineTo(ix + 39, 64); c.lineTo(ix + 52, 64); c.lineTo(ix + 56, 78); c.stroke();
    for (const [x, up] of [[30, 1], [54, 0]]) { c.beginPath(); c.moveTo(ix + x, up ? 16 : 34); c.lineTo(ix + x - 7, 25); c.lineTo(ix + x + 7, 25); c.fill(); c.fillRect(ix + x - 2, up ? 24 : 16, 4, 10); }
  } else {
    c.beginPath(); c.moveTo(ix + 8, 58); c.quadraticCurveTo(ix + 34, 64, ix + 74, 86); c.stroke();                      // 坡道
    c.beginPath(); c.arc(ix + 44, 24, 6, 0, 7); c.fill(); c.lineWidth = 8; c.beginPath(); c.moveTo(ix + 44, 36); c.lineTo(ix + 44, 54); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.moveTo(ix + 44, 54); c.lineTo(ix + 34, 68); c.moveTo(ix + 44, 54); c.lineTo(ix + 56, 74); c.moveTo(ix + 44, 38); c.lineTo(ix + 32, 50); c.moveTo(ix + 44, 38); c.lineTo(ix + 56, 48); c.stroke();
  }
});

// 共用：把（s, y, d）換成 put 的座標。幾何的 +x 是往牆的方向、z 是往右
function tools(put, u0, ev) {
  const at = (m, g, s, y, d) => put.geo(m, g, u0 + s, ev - d, y);
  const ball = (m, rs, ry, rd, s, y, d, seg = 12) => { const g = new THREE.SphereGeometry(1, seg, Math.max(5, seg - 4)); g.scale(rd, ry, rs); at(m, g, s, y, d); };
  const box = (m, w, h, dp, s, y, d) => at(m, new THREE.BoxGeometry(dp, h, w), s, y, d);
  const cyl = (m, r1, r2, h, s, y, d, seg = 12) => at(m, new THREE.CylinderGeometry(r1, r2, h, seg), s, y, d);
  // 面向外面的貼圖平面
  const card = (m, w, h, s, y, d, tilt = 0) => { const g = new THREE.PlaneGeometry(w, h); g.rotateZ(tilt); g.rotateY(-Math.PI / 2); at(m, g, s, y, d); };
  // 從 a 到 b 的細棒（兩端可以不一樣粗）；a、b 是 [s, y, d]
  const rod = (m, a, b, r1, r2 = r1, seg = 5) => {
    const A = new THREE.Vector3(-a[2], a[1], a[0]), B = new THREE.Vector3(-b[2], b[1], b[0]), D = B.clone().sub(A), len = D.length();
    const g = new THREE.CylinderGeometry(r2, r1, len, seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), D.normalize()));
    const c = A.add(B).multiplyScalar(0.5); g.translate(c.x, c.y, c.z); at(m, g, 0, 0, 0);
  };
  const tube = (m, pts, r, seg = 24) => at(m, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([s, y, d]) => new THREE.Vector3(-d, y, s))), seg, r, 5), 0, 0, 0);
  // 面向外面的圈圈（蝴蝶結）：在 s-y 平面上
  const ring = (m, R, r, s, y, d, flat = 1) => { const g = new THREE.TorusGeometry(R, r, 5, 10); g.scale(1, flat, 1); g.rotateY(Math.PI / 2); at(m, g, s, y, d); };
  return { at, ball, box, cyl, card, rod, tube, ring };
}

export function hallThemeWall(put, fr, ev) {
  const u0 = fr.L / 2 - WALL_LEN / 2, K = tools(put, u0, ev);
  put(themeMat(), WALL_LEN, 0.03, WALL_H, fr.L / 2, ev, 0, true);
  for (const [s1, s2, y1, y2] of WIN) put(glassMat(), s2 - s1, 0.02, y2 - y1, u0 + (s1 + s2) / 2, ev - 0.02, y1, true);
  // 紅框時鐘（照片是 9 點半）
  K.at(lit('#a3161f'), new THREE.CylinderGeometry(0.17, 0.17, 0.05, 24).rotateZ(Math.PI / 2), 4.8, 2.3, 0.04);
  K.at(clockMat(), new THREE.CircleGeometry(0.135, 24).rotateY(-Math.PI / 2), 4.8, 2.3, 0.07);
  K.card(accessMat(false), 0.34, 0.18, 0.28, 1.72, 0.03); K.card(accessMat(true), 0.34, 0.18, 6.15, 1.72, 0.03);
  // 盆栽：左邊 1 盆、右邊 3 盆
  const soil = mat('wool', '#4a3728'), leaf = lit('#2f6b34', 0.12), leaf2 = lit('#3f8443', 0.12);
  const gold = lit('#d8a93a', 0.25), red = lit('#c4161f', 0.3);
  const pot = (c, s, d, r, h) => { K.cyl(lit(c, 0.2), r, r * 0.78, h, s, h / 2, d, 14); K.cyl(lit(c, 0.2), r * 1.1, r * 1.1, 0.04, s, h - 0.02, d, 14); K.cyl(soil, r * 0.95, r * 0.95, 0.02, s, h + 0.005, d, 12); };
  const bush = (s, d, y0, n, len, spread, wide) => {
    for (let i = 0; i < n; i++) {
      const t = 0.35 + 0.65 * ((i * 0.37) % 1), l = len * (0.65 + 0.35 * ((i * 0.53) % 1)), g = new THREE.SphereGeometry(1, 6, 5);
      g.scale(wide * 0.5, l / 2, 0.012); g.translate(0, l / 2, 0); g.rotateX(t * spread); g.rotateY(i * 2.4); K.at(i % 2 ? leaf : leaf2, g, s, y0, d);
    }
  };
  pot('#a8201c', 0.32, 0.34, 0.2, 0.38); K.cyl(gold, 0.183, 0.17, 0.1, 0.32, 0.2, 0.34, 14); bush(0.32, 0.34, 0.38, 22, 0.5, 0.75, 0.07);
  pot('#f1f0ea', 5.5, 0.36, 0.17, 0.4); bush(5.5, 0.36, 0.4, 24, 0.5, 1.0, 0.12);
  pot('#c01f24', 5.88, 0.42, 0.16, 0.4); bush(5.88, 0.42, 0.4, 22, 0.55, 0.6, 0.07);
  pot('#b8401f', 6.2, 0.34, 0.16, 0.42); K.cyl(gold, 0.147, 0.138, 0.1, 6.2, 0.2, 0.34, 14); bush(6.2, 0.34, 0.42, 22, 0.52, 0.6, 0.07);
  for (const [s, d] of [[5.88, 0.42], [6.2, 0.34]]) {                                        // 紅色小花、盆子上的紅緞帶
    for (let i = 0; i < 8; i++) K.ball(red, 0.022, 0.022, 0.022, s + Math.cos(i * 2.4) * 0.15, 0.62 + (i % 4) * 0.07, d + Math.sin(i * 2.4) * 0.12, 7);
    for (const q of [-1, 1]) K.ring(red, 0.045, 0.018, s + q * 0.055, 0.46, d + 0.18, 0.75);
    K.box(red, 0.04, 0.16, 0.01, s - 0.04, 0.36, d + 0.19); K.box(red, 0.04, 0.14, 0.01, s + 0.05, 0.37, d + 0.19);
  }
}

/* ---------- 耶誕布置 ---------- */
const ginghamMat = () => litMap('gingham', 0.3, 96, 96, (c) => {                              // 黑白格子禮物
  c.fillStyle = '#f4f2ee'; c.fillRect(0, 0, 96, 96);
  c.fillStyle = 'rgba(20,20,22,.6)';
  for (let i = 0; i < 3; i++) { c.fillRect(i * 32 + 8, 0, 16, 96); c.fillRect(0, i * 32 + 8, 96, 16); }
});
const knitMat = () => litMap('knit', 0.3, 64, 64, (c) => {                                    // 雪人的毛線帽
  c.fillStyle = '#c4202a'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#ffffff'; for (let x = 0; x < 64; x += 8) { c.fillRect(x, 20, 4, 4); c.fillRect(x + 4, 40, 4, 4); }
  c.fillStyle = '#3f6a45'; c.fillRect(0, 27, 64, 9);
});
const signMat = (t, bg, ink) => litMap(`sign${t}`, 0.3, 160, 44, (c, w, h) => {
  c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = ink; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2 + 1, w - 12);
});

// 土撥鼠（z：大小；o：hat 'cone'｜'flop'｜'ears'、scarf 圍巾尾巴在哪邊、gift 抱禮物、tail 尾巴在哪邊）；面向外面
function marmot(K, s0, d0, z, o) {
  const fur = lit('#c08a52', 0.3), cream = lit('#f2e6cc', 0.34), brown = lit('#3a2418', 0.2), black = lit('#141210', 0.05), red = lit('#c4141c', 0.34), white = lit('#f6f4f0', 0.34), glow = lit('#ffd66a', 1);
  const S = (du) => s0 + du * z, D = (f) => d0 + f * z;                                      // f：往前（離牆）
  const b = (m, rs, ry, rd, du, y, f, seg) => K.ball(m, rs * z, ry * z, rd * z, S(du), y * z, D(f), seg);
  b(brown, 0.15, 0.27, 0.07, o.tail * 0.33, 0.36, -0.16);                                    // 尾巴
  b(fur, 0.31, 0.37, 0.26, 0, 0.36, 0, 16); b(fur, 0.235, 0.28, 0.2, 0, 0.62, -0.01, 14);    // 身體
  b(cream, 0.235, 0.265, 0.2, 0, 0.3, 0.085, 14);                                            // 肚子
  for (const q of [-1, 1]) b(brown, 0.1, 0.05, 0.12, q * 0.17, 0.05, 0.22, 9);               // 腳
  b(fur, 0.19, 0.2, 0.18, 0, 0.9, 0.02, 14);                                                 // 頭
  b(cream, 0.095, 0.07, 0.06, 0, 0.85, 0.17); b(black, 0.026, 0.02, 0.02, 0, 0.885, 0.225, 8);
  for (const q of [-1, 1]) {
    b(black, 0.02, 0.022, 0.014, q * 0.075, 0.945, 0.185, 8);                                // 眼睛、嘴
    K.tube(black, [[S(0), 0.868 * z, D(0.232)], [S(q * 0.012), 0.848 * z, D(0.232)], [S(q * 0.036), 0.846 * z, D(0.226)]], 0.005 * z, 6);
    if (o.hat !== 'ears') b(brown, 0.055, 0.055, 0.035, q * 0.2, 0.985, 0, 9);               // 耳朵
  }
  // 手
  const paws = o.gift ? [[-0.2, 0.55, 0.2], [0.2, 0.55, 0.2]] : [[-0.07, 0.5, 0.25], [0.1, 0.58, 0.24]];
  paws.forEach(([du, y, f], i) => { const q = i ? 1 : -1; b(fur, 0.08, 0.15, 0.1, q * 0.23, 0.58, 0.06); b(fur, 0.11, 0.06, 0.07, (q * 0.22 + du) / 2, y + 0.01, f - 0.06); b(brown, 0.045, 0.06, 0.04, du, y, f, 9); });
  // 身上的小燈
  for (let i = 0; i < 16; i++) {
    const a = -0.95 + (i * 0.618 % 1) * 1.9, y = 0.12 + (i * 0.37 % 1) * 0.42, r = Math.sqrt(Math.max(0, 1 - ((y - 0.32) / 0.34) ** 2));
    b(glow, 0.011, 0.011, 0.011, Math.sin(a) * 0.25 * r, y, 0.075 + Math.cos(a) * 0.215 * r, 5);
  }
  for (const [du, y, f] of [[-0.12, 1.0, 0.13], [0.1, 1.03, 0.11], [0.15, 0.9, 0.13], [-0.15, 0.85, 0.12], [0.03, 0.7, 0.2], [-0.18, 0.68, 0.12]]) b(glow, 0.01, 0.01, 0.01, du, y, f, 5);
  // 帽子、耳罩
  if (o.hat === 'ears') {
    K.at(red, new THREE.TorusGeometry(0.195 * z, 0.022 * z, 6, 16, Math.PI).rotateY(Math.PI / 2), S(0), 0.92 * z, D(0.02));
    for (const q of [-1, 1]) b(red, 0.06, 0.085, 0.085, q * 0.21, 0.9, 0.02, 10);
  } else {
    K.at(white, new THREE.TorusGeometry(0.155 * z, 0.042 * z, 7, 16).rotateX(Math.PI / 2), S(0), 1.045 * z, D(0.01));
    if (o.hat === 'cone') { K.at(red, new THREE.ConeGeometry(0.165 * z, 0.32 * z, 14), S(0), 1.2 * z, D(0)); b(white, 0.05, 0.05, 0.05, 0, 1.37, 0, 8); }
    else {
      b(red, 0.165, 0.2, 0.16, 0, 1.08, 0, 12);
      K.tube(red, [[S(0.03), 1.16 * z, D(0)], [S(-0.03), 1.3 * z, D(0)], [S(-0.12), 1.34 * z, D(0.01)], [S(-0.19), 1.31 * z, D(0.02)]], 0.075 * z, 10); b(white, 0.06, 0.06, 0.06, -0.24, 1.3, 0.03, 8);
    }
  }
  if (o.scarf) {
    K.at(red, new THREE.TorusGeometry(0.185 * z, 0.06 * z, 7, 18).rotateX(Math.PI / 2), S(0), 0.73 * z, D(0.01));
    const tails = o.scarf === 'R' ? [[0.2, 0.52, 0.18], [0.26, 0.44, 0.15]] : [[-0.13, 0.48, 0.25], [0.1, 0.56, 0.25]];
    tails.forEach(([du, y, f], i) => {
      const h = i ? 0.3 : 0.42; K.box(red, 0.085 * z, h * z, 0.03 * z, S(du), y * z, D(f));
      for (let j = -1; j <= 1; j++) K.box(white, 0.02 * z, 0.08 * z, 0.02 * z, S(du + j * 0.028), (y - h / 2 - 0.03) * z, D(f));
    });
  }
  if (o.gift) {
    K.box(ginghamMat(), 0.34 * z, 0.28 * z, 0.15 * z, S(0), 0.55 * z, D(0.3)); K.box(red, 0.055 * z, 0.285 * z, 0.156 * z, S(0), 0.55 * z, D(0.3));
    for (const q of [-1, 1]) K.ring(red, 0.05 * z, 0.014 * z, S(q * 0.055), 0.72 * z, D(0.3), 0.7);
  }
  // 緞帶綁的地方：禮物左右上角／這隻的手
  return { left: [S(-0.16), 0.68 * z, D(0.36)], right: [S(0.16), 0.68 * z, D(0.36)], paw: o.hat === 'ears' ? [S(-0.07), 0.5 * z, D(0.3)] : [S(0.1), 0.58 * z, D(0.3)] };
}

// 用一層層樹枝做的小樹（白樹、覆雪樹）
function twigTree(K, s0, d0, H, R, y0, mats, trunk) {
  const layers = 9;
  K.rod(trunk, [s0, 0, d0], [s0, H * 0.97, d0], 0.025, 0.012, 6);
  for (let l = 0; l < layers; l++) {
    const t = l / layers, y = y0 + (H - y0) * t, r = R * (1 - t * 0.9), n = Math.max(5, Math.round(11 - l * 0.8));
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + l * 0.5, m = mats[(i + l) % mats.length], ex = Math.cos(a), ez = Math.sin(a), p = 0.55;
      K.rod(m, [s0, y, d0], [s0 + ex * r, y + r * 0.22, d0 + ez * r], 0.035 * (1 - t * 0.5) + 0.008, 0.012, 5);
      for (const q of [-1, 1]) K.rod(m, [s0 + ex * r * p, y + r * 0.22 * p, d0 + ez * r * p], [s0 + Math.cos(a + q * 0.42) * r * 0.92, y + r * 0.34, d0 + Math.sin(a + q * 0.42) * r * 0.92], 0.02, 0.006, 4);
    }
  }
}

export function hallXmas(put, fr, ev, xmasTree) {
  const u0 = fr.L / 2 - WALL_LEN / 2, K = tools(put, u0, ev);
  const gold = lit('#d9ae4c', 0.34), rose = lit('#d98f6a', 0.34), wine = lit('#8e1420', 0.34), silver = lit('#dfe2e6', 0.3), red = lit('#c4161f', 0.34), white = lit('#f4f2ec', 0.36), brown = lit('#5a3826', 0.2), black = lit('#1a1614', 0.08), string = lit('#8a8578', 0.2);

  /* 地上：白毛毯、木頭圍籬 */
  const FENCE = [[0.93, 0.72], [1.08, 1.05], [1.12, 1.45], [1.3, 1.78], [1.7, 1.98], [2.15, 2.02], [2.55, 1.94], [2.85, 1.78], [3.2, 1.72], [3.8, 1.72], [4.5, 1.72], [5.12, 1.7], [5.2, 1.4], [5.22, 1.05]];
  {
    const pts = [[2.2, 0.62], ...FENCE.slice(1), [5.1, 0.7]].map(([s, d]) => new THREE.Vector2(s, d));
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts)), p = g.attributes.position, nm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { p.setXYZ(i, -p.getY(i), 0, p.getX(i)); nm.setXYZ(i, 0, 1, 0); }   // 平放在地上：(s, d) → x＝-d、z＝s
    K.at(lit('#e9dfc8', 0.16), g, 0, 0.022, 0);
  }
  const logs = [lit('#4a3022', 0.14), lit('#553827', 0.14), lit('#3f291e', 0.14)], cut = lit('#8a6a4c', 0.14);
  let n = 0, carry = 0;
  for (let i = 0; i < FENCE.length - 1; i++) {
    const [s1, d1] = FENCE[i], [s2, d2] = FENCE[i + 1], len = Math.hypot(s2 - s1, d2 - d1);
    let t = carry;
    for (; t < len; t += 0.088) {
      const s = s1 + (s2 - s1) * t / len, d = d1 + (d2 - d1) * t / len, h = 0.2 + [0, 0.05, 0.02, 0.08, 0.03][n % 5];
      K.cyl(logs[n % 3], 0.042, 0.044, h, s, h / 2, d, 8); K.cyl(cut, 0.036, 0.036, 0.004, s, h + 0.002, d, 8);
      n++;
    }
    carry = t - len;
  }
  for (const [s, d, m] of [[1.5, 1.75, gold], [2.45, 1.45, wine], [2.62, 1.2, gold], [3.35, 1.6, gold], [4.35, 1.58, gold], [4.42, 1.6, gold], [1.75, 1.45, rose]]) K.ball(m, 0.03, 0.03, 0.03, s, 0.05, d, 8);

  // 整塊布置都擋住（到牆邊、連兩邊的盆栽）：木頭高高低低，只靠木頭擋的話會從矮的那幾根走進去，進去就出不來
  for (const [s1, s2, d] of [[0.1, 0.9, 0.6], [0.86, 1.25, 1.5], [1.1, 2.9, 1.85], [1.6, 2.55, 2.08], [2.5, 2.75, 1.98], [2.7, 5.28, 1.8], [5.2, 6.38, 0.64]]) put.block(u0 + s1, u0 + s2, ev - d, ev + 0.1, 1.0);

  /* 樹：大耶誕樹（furniture.js）、前面的白樹、右邊覆雪小樹（金色花盆） */
  xmasTree(put, fr, u0 + 1.72, ev - 0.82);
  twigTree(K, 2.12, 1.45, 1.15, 0.42, 0.36, [white, lit('#ebe8e2', 0.36)], lit('#e6e6e4', 0.3));
  for (let i = 0; i < 16; i++) { const t = (i * 0.37) % 0.85, r = 0.4 * (1 - t * 0.9), a = i * 2.4; K.ball([rose, white, wine, gold][i % 4], 0.032, 0.032, 0.032, 2.12 + Math.cos(a) * r, 0.4 + t * 0.7, 1.45 + Math.sin(a) * r, 8); }
  K.box(red, 0.09, 0.05, 0.07, 2.0, 0.3, 1.72); K.at(white, new THREE.ConeGeometry(0.075, 0.06, 4).rotateY(Math.PI / 4), 2.0, 0.355, 1.72);   // 白屋頂小紅屋（吊飾）
  K.cyl(gold, 0.13, 0.1, 0.26, 4.78, 0.15, 1.2, 16);
  twigTree(K, 4.78, 1.2, 1.0, 0.36, 0.32, [lit('#dfe6ea', 0.3), lit('#8fa398', 0.22), lit('#cbd6da', 0.3)], lit('#6a6258', 0.15));
  for (let i = 0; i < 18; i++) { const t = (i * 0.37) % 0.85, r = 0.34 * (1 - t * 0.9), a = i * 2.4; K.ball(i % 4 === 3 ? wine : gold, 0.032, 0.032, 0.032, 4.78 + Math.cos(a) * r, 0.36 + t * 0.6, 1.2 + Math.sin(a) * r, 8); }

  /* 三隻土撥鼠＋紅緞帶 */
  const m1 = marmot(K, 2.83, 1.28, 0.82, { hat: 'cone', scarf: 'L', tail: -1 });
  const m2 = marmot(K, 3.5, 1.2, 0.98, { hat: 'flop', gift: true, tail: -1 });
  const m3 = marmot(K, 4.17, 1.28, 0.82, { hat: 'ears', scarf: 'R', tail: 1 });
  const ribbon = (a, b, sag) => {
    for (const dy of [-0.012, 0, 0.012]) K.tube(red, [[a[0], a[1] + dy, a[2]], [(a[0] * 2 + b[0]) / 3, (a[1] * 2 + b[1]) / 3 - sag * 0.9 + dy, (a[2] + b[2]) / 2 + 0.04], [(a[0] + b[0] * 2) / 3, (a[1] + b[1] * 2) / 3 - sag + dy, (a[2] + b[2]) / 2 + 0.04], [b[0], b[1] + dy, b[2]]], 0.011, 18);
  };
  ribbon(m2.left, m1.paw, 0.1); ribbon(m2.right, m3.paw, 0.1);
  K.box(red, 0.03, 0.24, 0.008, m1.paw[0] - 0.02, m1.paw[1] - 0.12, m1.paw[2]); K.box(red, 0.03, 0.2, 0.008, m3.paw[0], m3.paw[1] - 0.1, m3.paw[2]);

  /* 小玩偶 */
  {                                                                                          // 吹號角的小熊（紅高帽）
    const s = 2.48, d = 1.62, fur = lit('#7a6050', 0.28);
    for (const q of [-1, 1]) {
      K.cyl(fur, 0.035, 0.035, 0.14, s + q * 0.04, 0.13, d, 8); K.ball(black, 0.04, 0.03, 0.06, s + q * 0.045, 0.045, d + 0.02, 8);
      K.ball(lit('#6e4438', 0.28), 0.035, 0.08, 0.04, s + q * 0.085, 0.27, d + 0.03, 8);
      K.ball(fur, 0.028, 0.03, 0.02, s + q * 0.07, 0.48, d, 7); K.ball(black, 0.008, 0.009, 0.006, s + q * 0.03, 0.435, d + 0.068, 6); K.ball(wine, 0.03, 0.02, 0.02, s + q * 0.03, 0.355, d + 0.06, 7);
    }
    K.ball(lit('#8a5a48', 0.28), 0.085, 0.11, 0.07, s, 0.27, d, 10); K.ball(fur, 0.08, 0.075, 0.07, s, 0.42, d, 10);
    K.ball(lit('#b08a6a', 0.28), 0.035, 0.025, 0.025, s, 0.4, d + 0.065, 8); K.ball(black, 0.012, 0.01, 0.01, s, 0.41, d + 0.09, 6);
    K.cyl(wine, 0.06, 0.045, 0.08, s, 0.53, d, 12); K.cyl(black, 0.055, 0.055, 0.012, s, 0.487, d, 12);
    K.rod(gold, [s, 0.385, d + 0.09], [s - 0.02, 0.24, d + 0.14], 0.009, 0.012); K.at(gold, new THREE.ConeGeometry(0.04, 0.06, 10), s - 0.022, 0.22, d + 0.145);
  }
  {                                                                                          // 毛線帽雪人
    const s = 2.66, d = 1.7;
    K.ball(white, 0.075, 0.075, 0.07, s, 0.095, d, 10); K.ball(white, 0.062, 0.06, 0.058, s, 0.21, d, 10);
    K.cyl(knitMat(), 0.03, 0.06, 0.11, s + 0.005, 0.305, d, 12); K.cyl(lit('#8a8f94', 0.25), 0.066, 0.066, 0.03, s, 0.25, d, 12); K.ball(white, 0.02, 0.02, 0.02, s + 0.005, 0.37, d, 7);
    for (const q of [-1, 1]) K.ball(black, 0.007, 0.008, 0.005, s + q * 0.02, 0.222, d + 0.055, 6);
    K.ball(lit('#e8884a', 0.3), 0.009, 0.009, 0.02, s, 0.205, d + 0.065, 6); K.ball(lit('#4f7a52', 0.28), 0.065, 0.016, 0.06, s, 0.16, d, 9); K.ball(red, 0.02, 0.035, 0.012, s - 0.05, 0.14, d + 0.06, 7); K.ball(brown, 0.014, 0.014, 0.006, s, 0.1, d + 0.07, 6);
  }
  {                                                                                          // 木牌 Welcome／MERRY／Christmas／HOHOHO
    const s = 2.28, d = 1.8;
    K.box(lit('#9c948a', 0.22), 0.03, 0.36, 0.015, s, 0.2, d); K.box(lit('#b08a5a', 0.22), 0.2, 0.012, 0.08, s, 0.028, d);
    [['Welcome', '#cfc8bd', '#8a2a2a', 0.33, 0.03], ['MERRY', '#b02a34', '#ffffff', 0.265, -0.04], ['Christmas', '#cfc8bd', '#5a2a24', 0.2, 0.02], ['HOHOHO', '#cfc8bd', '#b02a34', 0.135, 0]].forEach(([t, bg, ink, y, ti]) => K.card(signMat(t, bg, ink), 0.18, 0.05, s, y, d + 0.014, ti));
    K.ball(white, 0.025, 0.03, 0.02, s - 0.075, 0.06, d + 0.02, 7); K.at(red, new THREE.ConeGeometry(0.026, 0.07, 8), s - 0.075, 0.115, d + 0.02); K.box(red, 0.04, 0.04, 0.03, s + 0.07, 0.055, d + 0.015);
  }
  {                                                                                          // 廚師帽薑餅人（紅格子圍巾）
    const s = 1.62, d = 1.8, gb = lit('#c98a4e', 0.3);
    K.ball(red, 0.06, 0.075, 0.045, s, 0.1, d, 9); K.ball(gb, 0.07, 0.065, 0.045, s, 0.22, d, 10); K.ball(white, 0.06, 0.035, 0.05, s - 0.03, 0.29, d, 9); K.cyl(black, 0.045, 0.045, 0.012, s - 0.02, 0.265, d, 10);
    for (const q of [-1, 1]) K.ball(black, 0.007, 0.008, 0.005, s + q * 0.022, 0.225, d + 0.045, 6);
    K.ball(red, 0.01, 0.006, 0.005, s, 0.195, d + 0.046, 6); K.tube(white, [[s + 0.01, 0.285, d + 0.04], [s + 0.04, 0.265, d + 0.04], [s + 0.06, 0.235, d + 0.035]], 0.004, 8); K.box(wine, 0.03, 0.1, 0.012, s - 0.02, 0.1, d + 0.05); K.box(wine, 0.12, 0.025, 0.08, s, 0.16, d);
  }
  {                                                                                          // 紅尖帽小鹿（紅鼻子、紅圍巾）
    const s = 1.84, d = 1.83, fur = lit('#e0cdb2', 0.3);
    K.ball(fur, 0.07, 0.08, 0.06, s, 0.1, d, 9); K.ball(fur, 0.055, 0.05, 0.065, s, 0.2, d + 0.02, 10); K.ball(red, 0.014, 0.014, 0.014, s - 0.01, 0.19, d + 0.085, 7);
    K.at(red, new THREE.ConeGeometry(0.05, 0.17, 10), s, 0.33, d); K.cyl(white, 0.055, 0.055, 0.025, s, 0.245, d, 10); K.box(brown, 0.02, 0.06, 0.012, s + 0.06, 0.265, d);
    for (const q of [-1, 1]) K.ball(black, 0.007, 0.008, 0.005, s + q * 0.03, 0.215, d + 0.075, 6);
    K.rod(red, [s + 0.03, 0.15, d + 0.05], [s + 0.16, 0.06, d + 0.06], 0.022, 0.016, 6); K.ball(red, 0.05, 0.02, 0.05, s, 0.15, d + 0.01, 8);
  }

  /* 頂上：松枝花圈、金花紅球、一排吊飾 */
  const pine = [lit('#1f4a2c', 0.14), lit('#2b5f38', 0.14), lit('#183c24', 0.14)];
  for (let i = 0; i < 150; i++) {
    const s = 0.1 + i * (WALL_LEN - 0.2) / 150, a = i * 2.4, r = 0.1 + (i % 4) * 0.025;
    K.rod(pine[i % 3], [s, 2.76, 0.16], [s + Math.sin(i * 1.7) * 0.09, 2.76 + Math.sin(a) * r, 0.16 + Math.cos(a) * r * 0.8], 0.035, 0.008, 5);
  }
  for (let i = 0; i < 24; i++) {
    const s = 1.95 + i * 0.112, y = 2.74 + Math.sin(i * 1.9) * 0.06, d = 0.28;
    if (i % 4 === 1) {                                                                       // 金花
      for (let j = 0; j < 5; j++) { const a = j * Math.PI * 2 / 5; K.ball(gold, 0.04, 0.025, 0.012, s + Math.cos(a) * 0.045, y + Math.sin(a) * 0.045, d, 6); }
      K.ball(lit('#f0cf74', 0.4), 0.02, 0.02, 0.02, s, y, d + 0.015, 6);
    } else if (i % 4 === 3) for (const q of [-1, 1]) K.ring(i % 8 === 3 ? rose : red, 0.034, 0.014, s + q * 0.036, y, d, 0.75);
    else K.ball(i % 3 ? red : gold, 0.028, 0.028, 0.028, s, y, d, 8);
  }
  const ORN = [rose, gold, wine, silver, rose, gold, silver, wine];
  for (let i = 0; i < 44; i++) {
    const s = 0.22 + i * (WALL_LEN - 0.44) / 43 + Math.sin(i * 2.1) * 0.03, d = 0.16 + (i % 3) * 0.07, y = 2.54 - ((i * 0.618) % 1) * 0.34;
    if (Math.abs(s - 3.1) < 0.32) continue;                                                  // 中間留給大鈴鐺
    K.rod(string, [s, 2.7, d], [s, y + 0.03, d], 0.002, 0.002, 3);
    if (i % 4 === 0) { K.at(rose, new THREE.ConeGeometry(0.036, 0.075, 8).rotateX(Math.PI), s, y - 0.035, d); K.at(rose, new THREE.ConeGeometry(0.036, 0.045, 8), s, y + 0.024, d); }   // 水滴形
    else K.ball(ORN[i % 8], 0.034, 0.034, 0.034, s, y, d, 9);
  }

  /* 金色大鈴鐺＋紅緞帶＋兩顆金球 */
  const bellPts = [[0, 0.2], [0.05, 0.195], [0.09, 0.16], [0.105, 0.1], [0.125, 0.04], [0.165, 0], [0.155, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  for (const q of [-1, 1]) K.at(gold, new THREE.LatheGeometry(bellPts, 16).translate(0, -0.2, 0).rotateX(-q * 0.85).rotateZ(-0.35), 3.1 + q * 0.03, 2.5, 0.32 + q * 0.03);
  for (let i = 0; i < 5; i++) { const a = Math.PI * (0.1 + i * 0.2); K.ring(red, 0.055, 0.024, 3.1 + Math.cos(a) * 0.085, 2.53 + Math.sin(a) * 0.05, 0.42, 0.7); }
  for (const [ds, h, t] of [[-0.09, 0.34, 0.1], [0, 0.26, -0.05], [0.09, 0.4, -0.14]]) K.tube(red, [[3.1, 2.5, 0.43], [3.1 + ds * 0.7, 2.5 - h * 0.4, 0.45], [3.1 + ds * 0.9 + t * 0.2, 2.5 - h * 0.75, 0.43], [3.1 + ds * 1.4, 2.5 - h, 0.44]], 0.022, 14);
  K.rod(string, [3.1, 2.72, 0.32], [3.1, 2.55, 0.32], 0.006, 0.006, 4); K.rod(string, [3.1, 2.4, 0.4], [3.1, 1.95, 0.4], 0.003, 0.003, 3);
  for (const [y, r] of [[2.12, 0.05], [1.95, 0.065]]) { K.ball(lit('#a8925a', 0.3), r, r, r, 3.1, y, 0.4, 12); K.ball(red, 0.02, 0.014, 0.02, 3.1, y + r, 0.4, 7); }
}
