import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* =========================================================
 * 方塊風格：形狀是方塊，材質用程式畫（64x64、平滑濾鏡，細緻不顆粒）
 * 沒有使用任何遊戲的官方素材。
 * STYLE = 'block'（方塊風，預設）或 'classic'（簡約風，純色）
 * 切換：網址加 ?style=classic，或在「說明」裡切換（會記在瀏覽器）
 * ========================================================= */

function readStyle() {
  const q = new URLSearchParams(location.search).get('style');
  if (q === 'block' || q === 'classic') return q;
  try { return localStorage.getItem('campus-style') || 'block'; } catch { return 'block'; }
}
export const STYLE = readStyle();
export const BLOCKY = STYLE === 'block';
export function setStyle(s) {
  try { localStorage.setItem('campus-style', s); } catch { /* 私密模式等情況，忽略 */ }
}

/* ---------- 材質圖 ---------- */

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

const S = 64;   // 每格 1 公尺 = 64 像素
function canvasTex(draw, seed = 1, size = S, { smooth = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, rng(seed), size);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// 柔和的斑駁感：在底色上畫很多半透明小方塊（會繞到另一邊，所以貼起來沒有接縫）
function mottle(c, r, base, { n = 260, amt = 0.06, min = 3, max = 9, alpha = 0.35 } = {}) {
  c.fillStyle = base; c.fillRect(0, 0, S, S);
  c.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    c.fillStyle = shade(base, 1 - amt + r() * amt * 2);
    const w = min + r() * (max - min), x = r() * S, y = r() * S;
    for (const [dx, dy] of [[0, 0], [-S, 0], [0, -S], [-S, -S]]) c.fillRect(x + dx, y + dy, w, w);
  }
  c.globalAlpha = 1;
}

const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const make = {
    grass: () => canvasTex((c, r) => {
      mottle(c, r, '#6fae4f', { amt: 0.08, n: 320 });
      c.globalAlpha = 0.5;
      for (let i = 0; i < 160; i++) {          // 細小的草葉
        c.fillStyle = shade('#8fca63', 0.85 + r() * 0.3);
        c.fillRect(r() * S, r() * S, 1, 2 + r() * 3);
      }
      c.globalAlpha = 1;
    }, 11),
    // 石磚欄杆
    brick: () => canvasTex((c, r) => {
      mottle(c, r, '#bdb8ad', { amt: 0.05 });
      c.fillStyle = 'rgba(80,75,65,.45)';
      for (const y of [0, 16, 32, 48]) c.fillRect(0, y, S, 2);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 16 : 0;
        for (let x = off; x < S + 32; x += 32) c.fillRect(x % S, row * 16, 2, 16);
      }
    }, 14),
    // 木地板：一公尺四片
    planks: () => canvasTex((c, r) => {
      for (let b = 0; b < 4; b++) {
        const base = shade('#c99c64', 0.93 + r() * 0.12);
        c.fillStyle = base; c.fillRect(0, b * 16, S, 16);
        c.globalAlpha = 0.18;
        for (let g = 0; g < 7; g++) { c.fillStyle = shade(base, 0.75); c.fillRect(0, b * 16 + 2 + r() * 12, S, 1); }
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(90,60,30,.45)';
        c.fillRect(0, b * 16 + 15, S, 1);
        c.fillRect(((b * 23) % 48) + 8, b * 16, 1, 16);
      }
    }, 15),
    // 外牆：米色漆面（會再依大樓顏色微調）
    concrete: () => canvasTex((c, r) => {
      mottle(c, r, '#f4f1ea', { amt: 0.025, n: 200, min: 4, max: 14, alpha: 0.5 });
    }, 16),
    // 地磚：一公尺 2x2 塊，細縫
    tile: () => canvasTex((c, r) => {
      mottle(c, r, '#f7f6f2', { amt: 0.025, n: 160 });
      c.fillStyle = 'rgba(0,0,0,.10)';
      for (const v of [0, 32]) { c.fillRect(0, v, S, 1); c.fillRect(v, 0, 1, S); }
    }, 17),
    glass: () => canvasTex((c) => {
      const g = c.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, 'rgba(205,235,255,.55)'); g.addColorStop(1, 'rgba(150,200,235,.45)');
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.moveTo(10, S); c.lineTo(S, 10); c.lineTo(S, 22); c.lineTo(22, S); c.fill();
      c.fillStyle = 'rgba(235,240,245,.95)';                  // 窗框
      c.fillRect(0, 0, S, 3); c.fillRect(0, S - 3, S, 3); c.fillRect(0, 0, 3, S); c.fillRect(S - 3, 0, 3, S);
      c.fillRect(S / 2 - 1, 0, 2, S);
    }, 18),
    log: () => canvasTex((c, r) => {
      mottle(c, r, '#73553a', { amt: 0.08 });
      c.fillStyle = 'rgba(40,25,10,.35)';
      for (let i = 0; i < 9; i++) c.fillRect(r() * S, 0, 2, S);
    }, 19),
    leaves: () => canvasTex((c, r) => {
      c.clearRect(0, 0, S, S);
      for (let i = 0; i < 230; i++) {
        c.fillStyle = shade('#4a9a40', 0.7 + r() * 0.5);
        const x = r() * S, y = r() * S, rad = 2 + r() * 5;
        for (const [dx, dy] of [[0, 0], [-S, 0], [0, -S], [-S, -S]]) { c.beginPath(); c.arc(x + dx, y + dy, rad, 0, Math.PI * 2); c.fill(); }
      }
    }, 20),
    track: () => canvasTex((c, r) => mottle(c, r, '#93414b', { amt: 0.06, n: 400, min: 1, max: 4 }), 21),
    wool: () => canvasTex((c, r) => mottle(c, r, '#f2f2f2', { amt: 0.04, n: 220 }), 22),
    // 屋頂：浪板
    roof: () => canvasTex((c, r) => {
      mottle(c, r, '#f0f0ee', { amt: 0.03 });
      for (let x = 0; x < S; x += 8) {
        const g = c.createLinearGradient(x, 0, x + 8, 0);
        g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(0.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.10)');
        c.fillStyle = g; c.fillRect(x, 0, 8, S);
      }
    }, 23),
    water: () => canvasTex((c, r) => {
      mottle(c, r, '#4a90c8', { amt: 0.08, n: 200 });
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const y = r() * S; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(20, y - 4, 44, y + 4, S, y); c.stroke(); }
    }, 24),
  }[name];
  return (TEX[name] = make());
}

/* ---------- 材質 ---------- */

const MATS = new Map();
/**
 * 取得材質。name 是材質種類，color 用來染色。
 * 簡約風時不貼圖，只用顏色。
 */
export function mat(name, color = '#ffffff', opts = {}) {
  const key = `${name}|${color}|${JSON.stringify(opts)}`;
  if (MATS.has(key)) return MATS.get(key);
  let m;
  if (name === 'glass') {
    m = new THREE.MeshLambertMaterial({
      map: BLOCKY ? tex('glass') : null, color: BLOCKY ? '#ffffff' : '#cfe8ff',
      transparent: true, opacity: BLOCKY ? 0.95 : 0.35, depthWrite: false, side: THREE.DoubleSide,
    });
  } else if (name === 'leaves') {
    m = new THREE.MeshLambertMaterial({ map: BLOCKY ? tex('leaves') : null, color: BLOCKY ? '#ffffff' : '#4f9a4a', alphaTest: 0.5, side: THREE.DoubleSide });
  } else {
    m = new THREE.MeshLambertMaterial({ map: BLOCKY ? tex(name) : null, color, ...opts });
  }
  MATS.set(key, m);
  return m;
}

/* ---------- 幾何：材質會依真實尺寸重複（1 格 = 1 公尺） ---------- */

export function blockBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return g;
}

/** 把同材質的方塊合併成一個網格，減少繪製次數 */
export class Batch {
  constructor() { this.list = new Map(); }
  add(material, geometry) {
    if (!this.list.has(material)) this.list.set(material, []);
    this.list.get(material).push(geometry);
  }
  box(material, w, h, d, x, y, z) {
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return;
    const g = blockBox(w, h, d);
    g.translate(x, y, z);
    this.add(material, g);
  }
  /** 材質整張貼滿每一面（黑板、電視螢幕這種一整張的圖） */
  plain(material, w, h, d, x, y, z) {
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    this.add(material, g);
  }
  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [m, geos] of this.list) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), m);
      mesh.castShadow = cast && !m.transparent;
      mesh.receiveShadow = receive;
      parent.add(mesh);
      meshes.push(mesh);
      geos.forEach((g) => g.dispose());
    }
    this.list.clear();
    return meshes;
  }
}

/* ---------- 方塊人（學生角色，自己設計的造型） ---------- */

const SKIN = '#f1c27d', HAIR = '#2f2116', HAIR2 = '#463222';

// 臉（16x16 像素）：男生短髮、女生有瀏海和腮紅
function faceTexture(gender) {
  return canvasTex((c) => {
    c.fillStyle = SKIN; c.fillRect(0, 0, 16, 16);
    c.fillStyle = HAIR;
    if (gender === 'girl') {
      c.fillRect(0, 0, 16, 4); c.fillRect(0, 4, 2, 10); c.fillRect(14, 4, 2, 10);
      c.fillRect(2, 4, 3, 1); c.fillRect(7, 4, 4, 1); c.fillRect(12, 4, 2, 2);     // 瀏海
    } else {
      c.fillRect(0, 0, 16, 3); c.fillRect(0, 3, 1, 4); c.fillRect(15, 3, 1, 4);
      c.fillRect(1, 3, 4, 1); c.fillRect(9, 3, 5, 1);
    }
    c.fillStyle = '#ffffff'; c.fillRect(3, 8, 3, 2); c.fillRect(10, 8, 3, 2);       // 眼白
    c.fillStyle = '#2b3f6b'; c.fillRect(4, 8, 2, 2); c.fillRect(10, 8, 2, 2);       // 眼珠
    if (gender === 'girl') {
      c.fillStyle = HAIR; c.fillRect(3, 7, 3, 1); c.fillRect(10, 7, 3, 1);          // 睫毛
      c.fillStyle = '#f2a0a0'; c.fillRect(2, 11, 2, 1); c.fillRect(12, 11, 2, 1);   // 腮紅
      c.fillStyle = '#d0605a'; c.fillRect(7, 12, 2, 1);
    } else {
      c.fillStyle = HAIR; c.fillRect(3, 6, 3, 1); c.fillRect(10, 6, 3, 1);          // 眉毛
      c.fillStyle = '#b8614a'; c.fillRect(6, 12, 4, 1);
    }
  }, gender === 'girl' ? 32 : 30, 16, { smooth: false });
}
function hairTexture(gender, side) {
  return canvasTex((c) => {
    c.fillStyle = HAIR; c.fillRect(0, 0, 16, 16);
    c.fillStyle = HAIR2; c.fillRect(2, 2, 4, 1); c.fillRect(9, 5, 4, 1); c.fillRect(4, 10, 3, 1);
    if (side && gender !== 'girl') { c.fillStyle = SKIN; c.fillRect(0, 7, 16, 9); c.fillStyle = '#e0ac6a'; c.fillRect(6, 9, 3, 3); }  // 男生側面露出耳朵
  }, 33, 16, { smooth: false });
}

/**
 * 方塊學生。gender: 'boy' | 'girl'
 * 制服：紅色 polo 衫（灰色滾邊、白色鈕扣）＋ 黑色運動短褲（灰色側條）＋ 白襪
 */
export function makeBlockPerson(gender = 'boy') {
  const g = new THREE.Group();
  const cloth = (color) => new THREE.MeshLambertMaterial({ map: BLOCKY ? tex('wool') : null, color });
  const skin = new THREE.MeshLambertMaterial({ color: SKIN });
  const polo = cloth('#d32f2f'), collar = cloth('#b72525'), white = cloth('#ffffff');
  const trim = cloth('#8b8f96');   // 灰色滾邊（依學校制服照片）
  const shorts = cloth('#1c1c1f'), sock = cloth('#f4f4f4');
  const shoe = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
  const hair = new THREE.MeshLambertMaterial({ map: hairTexture(gender, false) });
  const hairSide = new THREE.MeshLambertMaterial({ map: hairTexture(gender, true) });
  const face = new THREE.MeshLambertMaterial({ map: faceTexture(gender) });

  const box = (parent, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };

  // 頭：前面（-Z）是臉
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), [hairSide, hairSide, hair, skin, hair, face]);
  head.position.set(0, 1.55, 0); head.castShadow = true; g.add(head);
  if (gender === 'girl') {
    box(g, 0.48, 0.52, 0.1, hair, 0, 1.42, 0.25);          // 披肩長髮
    box(g, 0.08, 0.36, 0.3, hair, -0.24, 1.42, 0.06);      // 兩側頭髮
    box(g, 0.08, 0.36, 0.3, hair, 0.24, 1.42, 0.06);
    box(g, 0.12, 0.08, 0.06, cloth('#ff5c8a'), 0.17, 1.74, -0.2);   // 髮夾
  }

  // 上衣：紅色 polo，兩側灰色滾邊
  box(g, 0.46, 0.6, 0.26, polo, 0, 1.0, 0);
  for (const s of [-1, 1]) box(g, 0.02, 0.52, 0.2, trim, s * 0.235, 0.98, 0);   // 側邊灰條
  box(g, 0.44, 0.07, 0.28, collar, 0, 1.28, 0);             // 領子
  box(g, 0.45, 0.025, 0.285, trim, 0, 1.24, 0);             // 領口灰邊
  box(g, 0.06, 0.16, 0.02, collar, 0, 1.15, -0.135);        // 門襟
  box(g, 0.03, 0.03, 0.02, white, 0, 1.19, -0.147);         // 鈕扣
  box(g, 0.03, 0.03, 0.02, white, 0, 1.12, -0.147);

  // 手臂：短袖（紅，袖口和肩線灰邊）＋ 手臂（膚色）
  const arm = (side) => {
    const p = pivot(side * 0.33, 1.3);
    box(p, 0.2, 0.22, 0.22, polo, 0, -0.11, 0);
    box(p, 0.21, 0.04, 0.23, trim, 0, -0.2, 0);             // 袖口
    box(p, 0.02, 0.2, 0.12, trim, side * 0.1, -0.1, 0);     // 袖子外側灰條
    box(p, 0.16, 0.36, 0.18, skin, 0, -0.4, 0);
    box(p, 0.17, 0.1, 0.19, skin, 0, -0.62, 0);
    return p;
  };
  const armL = arm(-1), armR = arm(1);

  // 黑色運動短褲（含腰部）＋ 腿 ＋ 白襪 ＋ 鞋子
  box(g, 0.47, 0.14, 0.27, shorts, 0, 0.71, 0);
  const leg = (side) => {
    const p = pivot(side * 0.12, 0.7);
    box(p, 0.22, 0.26, 0.23, shorts, 0, -0.13, 0);
    box(p, 0.02, 0.24, 0.23, trim, side * 0.115, -0.13, 0);    // 側邊灰條
    box(p, 0.18, 0.24, 0.19, skin, 0, -0.38, 0);
    box(p, 0.19, 0.08, 0.2, sock, 0, -0.54, 0);
    box(p, 0.21, 0.09, 0.27, shoe, 0, -0.62, -0.03);
    return p;
  };
  const legL = leg(-1), legR = leg(1);

  g.userData.limbs = { armL, armR, legL, legR };
  g.userData.gender = gender;
  return g;
}

/** 走路動畫：phase 會隨移動距離增加，amount 0~1 */
export function animatePerson(g, phase, amount) {
  const { armL, armR, legL, legR } = g.userData.limbs;
  const s = Math.sin(phase) * 0.7 * amount;
  armL.rotation.x = s; armR.rotation.x = -s;
  legL.rotation.x = -s; legR.rotation.x = s;
}

/* ---------- 方塊樹 ---------- */

export function addBlockTree(batch, x, z, s = 1) {
  const trunkH = Math.round(3 * s);
  batch.box(mat('log', '#ffffff'), 0.7, trunkH, 0.7, x, trunkH / 2, z);
  const leaves = mat('leaves');
  batch.box(leaves, 3, 2, 3, x, trunkH + 0.6, z);
  batch.box(leaves, 1.8, 1, 1.8, x, trunkH + 2.1, z);
}

/* ---------- 方塊雲 ---------- */

export function makeClouds(count = 18, spread = 260, y = 70) {
  const group = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, emissive: '#ffffff', emissiveIntensity: 0.4 });
  const r = rng(99);
  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const n = 2 + (r() * 4 | 0);
    for (let k = 0; k < n; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(8 + r() * 14, 3, 6 + r() * 10), m);
      b.position.set(k * 7 - n * 3 + r() * 4, 0, r() * 8 - 4);
      cloud.add(b);
    }
    cloud.position.set((r() - 0.5) * spread * 2, y + r() * 15, (r() - 0.5) * spread * 2);
    group.add(cloud);
  }
  group.userData.spread = spread;
  return group;
}

export { tex, canvasTex };
