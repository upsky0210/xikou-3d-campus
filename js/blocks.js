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
    // 磨石子（走廊、教室地板，依照片）：灰白底＋深淺碎石點
    terrazzo: () => canvasTex((c, r) => {
      mottle(c, r, '#d9d8d3', { amt: 0.03, n: 120 });
      for (let i = 0; i < 260; i++) { c.fillStyle = ['#8f8e8a', '#f7f7f4', '#b5b3ad', '#6f6e6a'][i % 4]; c.fillRect(r() * S, r() * S, 1 + r() * 1.6, 1 + r() * 1.6); }
    }, 25),
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
    // 碰撞登記：app.js 在擺家具、蓋戶外設施時打開，記下每個方塊的範圍（之後算擋路、擋鏡頭）
    if (Batch.collector && !material.transparent) {
      geometry.computeBoundingBox();
      const b = geometry.boundingBox;
      Batch.collector.push({ x1: b.min.x, y1: b.min.y, z1: b.min.z, x2: b.max.x, y2: b.max.y, z2: b.max.z });
    }
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
Batch.collector = null;

/** 可以互動的設施（籃框、溜滑梯）：蓋場景時登記，app.js 再做互動。座標都是世界座標（公尺） */
export const SPOTS = [];

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

// 上衣前 / 後片貼圖（寬 0.46 × 高 0.6）
function shirtTexture(front) {
  const cv = document.createElement('canvas');
  cv.width = 184; cv.height = 240;
  const c = cv.getContext('2d'), w = 184, h = 240;
  c.fillStyle = '#d42a2a'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,.05)';
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);           // 運動布料細紋
  c.fillStyle = '#9ea2a8';
  const band = 22, sideW = 22;
  for (const sgn of [-1, 1]) {
    // 從領口（中間附近）斜到腋下（外側約 1/3 高），再沿側邊往下
    const x0 = w / 2 + sgn * 34, x1 = sgn < 0 ? 0 : w;
    c.beginPath();
    c.moveTo(x0, 0); c.lineTo(x0 + sgn * band, 0);
    c.lineTo(x1, h * 0.28);
    c.lineTo(x1, h); c.lineTo(x1 - sgn * sideW, h);
    c.lineTo(x1 - sgn * sideW, h * 0.3 + band);
    c.closePath(); c.fill();
  }
  if (front) {
    // 左胸（看的人的右邊）白色名牌：校徽 + 班級
    const px = w * 0.6, py = 30;
    c.fillStyle = '#ffffff'; c.fillRect(px, py, 44, 30);
    c.strokeStyle = '#c22'; c.lineWidth = 2; c.strokeRect(px + 2, py + 2, 40, 26);
    c.fillStyle = '#3a9a4a'; c.beginPath(); c.arc(px + 11, py + 15, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c22'; c.fillRect(px + 21, py + 9, 18, 3); c.fillRect(px + 21, py + 16, 18, 3);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * 方塊學生。gender: 'boy' | 'girl'
 * 制服：紅色 polo 衫（灰色斜條與側片、左胸名牌）＋ 黑色運動短褲（灰色側條）＋ 白襪
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

  // 上衣：紅色 polo（依學校制服照片）
  //   前後片：灰色斜條從領口斜到腋下，再沿兩側一路往下；左胸白色名牌
  //   側面：灰色；袖子：全紅，左袖有綠色小校徽
  const shirtFront = new THREE.MeshLambertMaterial({ map: shirtTexture(true) });
  const shirtBack = new THREE.MeshLambertMaterial({ map: shirtTexture(false) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.26), [trim, trim, polo, polo, shirtBack, shirtFront]);   // +x -x +y -y +z(背) -z(胸)
  torso.position.set(0, 1.0, 0); torso.castShadow = true; g.add(torso);
  box(g, 0.44, 0.07, 0.28, collar, 0, 1.28, 0);             // 領子
  box(g, 0.45, 0.02, 0.285, trim, 0, 1.31, 0);              // 領子上緣灰邊
  box(g, 0.06, 0.15, 0.02, collar, 0, 1.17, -0.135);        // 門襟
  box(g, 0.025, 0.025, 0.02, collar, 0, 1.2, -0.147);       // 鈕扣（同色）
  box(g, 0.025, 0.025, 0.02, collar, 0, 1.13, -0.147);

  // 手臂：短袖（全紅）＋ 手臂（膚色）；左袖綠色小校徽
  const arm = (side) => {
    const p = pivot(side * 0.33, 1.3);
    box(p, 0.2, 0.22, 0.22, polo, 0, -0.11, 0);
    if (side === -1) box(p, 0.01, 0.06, 0.06, cloth('#2e9e4f'), -0.105, -0.08, 0);   // 校徽
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

/* ---------- 方塊人 NPC（老師等，依照片畫的像素臉） ---------- */

/**
 * look = {
 *   face: 16 行 × 16 字的像素臉，pal: 字元 → 顏色（'H' 要是頭髮色）
 *   skin, hair, top（上衣）, pants, stripe（褲子側條，可省略）, shoe
 *   longHair: 長髮披到胸前, shortHair: 短髮露耳朵, spiky: 刺刺頭
 *   longSleeve: 長袖, whistle: 胸前掛哨子, collar: 襯衫領顏色, zip: 外套拉鍊顏色
 *   cat: 貓頭（虎斑條紋、貓耳、鬍鬚、尾巴；pal.h 是條紋色）
 *   patches: 毛色色塊 [[顏色, x, y, w, h], ...]（取代條紋）, ears: [左耳色, 右耳色], whisker: 鬍鬚色
 *   headScale: 頭放大倍數
 * }
 */
export function makeBlockNPC(look) {
  const g = new THREE.Group();
  const cloth = (color) => new THREE.MeshLambertMaterial({ map: BLOCKY ? tex('wool') : null, color });
  const skin = new THREE.MeshLambertMaterial({ color: look.skin });
  const top = cloth(look.top), pants = cloth(look.pants);
  const shoe = new THREE.MeshLambertMaterial({ color: look.shoe });
  const px = (draw) => canvasTex((c) => draw(c), 1, 16, { smooth: false });
  const faceMat = new THREE.MeshLambertMaterial({ map: px((c) => {
    look.face.forEach((row, y) => [...row].forEach((ch, x) => { c.fillStyle = look.pal[ch]; c.fillRect(x, y, 1, 1); }));
  }) });
  const hair = new THREE.MeshLambertMaterial({ map: px((c) => {
    c.fillStyle = look.hair; c.fillRect(0, 0, 16, 16);
    c.fillStyle = look.pal.h || look.hair;
    if (look.patches) for (const [col, x, y, w, h] of look.patches) { c.fillStyle = col; c.fillRect(x, y, w, h); }   // 三花色塊
    else if (look.cat) for (const y of [1, 5, 9, 13]) c.fillRect(0, y, 16, 2);   // 虎斑條紋
    else { c.fillRect(2, 2, 4, 1); c.fillRect(9, 6, 4, 1); c.fillRect(4, 11, 3, 1); }
  }) });

  const box = (parent, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };

  // 短髮：側面露出耳朵、後腦下方露出脖子
  const side = !look.shortHair ? hair : new THREE.MeshLambertMaterial({ map: px((c) => {
    c.fillStyle = look.skin; c.fillRect(0, 0, 16, 16);
    c.fillStyle = look.hair; c.fillRect(0, 0, 16, 5); c.fillRect(0, 5, 5, 3);
    c.fillStyle = look.pal.N || look.skin; c.fillRect(8, 7, 3, 4);           // 耳朵
  }) });
  const back = !look.shortHair ? hair : new THREE.MeshLambertMaterial({ map: px((c) => {
    c.fillStyle = look.skin; c.fillRect(0, 0, 16, 16);
    c.fillStyle = look.hair; c.fillRect(0, 0, 16, 12);
  }) });
  // 頭（含耳朵、鬍鬚、刺刺頭）放在脖子位置的群組裡，headScale 可以把頭放大
  const NECK = 1.32, hg = new THREE.Group();
  hg.position.set(0, NECK, 0); hg.scale.setScalar(look.headScale || 1); g.add(hg);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), [side, side, hair, skin, back, faceMat]);
  head.position.set(0, 1.55 - NECK, 0); head.castShadow = true; hg.add(head);
  if (look.cat) {                                            // 貓耳朵（內側粉紅）＋ 鬍鬚
    [-1, 1].forEach((sx, i) => {
      const ear = look.ears ? new THREE.MeshLambertMaterial({ color: look.ears[i] }) : hair;
      box(hg, 0.13, 0.15, 0.08, ear, sx * 0.15, 1.85 - NECK, -0.06);
      box(hg, 0.07, 0.09, 0.01, new THREE.MeshLambertMaterial({ color: '#f2a7b8' }), sx * 0.15, 1.84 - NECK, -0.105);
      for (const [y, r] of [[1.44, 0.12], [1.41, -0.08]]) {
        const w = box(hg, 0.2, 0.012, 0.012, new THREE.MeshLambertMaterial({ color: look.whisker || '#f5f5f5' }), sx * 0.27, y - NECK, -0.236);
        w.rotation.z = sx * r; w.castShadow = false;
      }
    });
  }
  if (look.spiky) {                                          // 刺刺的短髮
    for (const [x, z, h] of [[-0.14, -0.12, 0.06], [0.02, -0.16, 0.08], [0.15, -0.08, 0.05], [-0.06, 0.05, 0.07], [0.1, 0.12, 0.05]]) box(hg, 0.12, h, 0.12, hair, x, 1.78 - NECK + h / 2, z);
  }
  if (look.beret) {                                         // 貝雷帽：歪一邊、前面有字母 H
    const bm = cloth(look.beret.color), lm = new THREE.MeshLambertMaterial({ color: look.beret.letter });
    const bg = new THREE.Group(); bg.position.set(0.04, 1.8 - NECK, 0); bg.rotation.z = -0.18; hg.add(bg);
    box(bg, 0.5, 0.07, 0.48, bm, 0, 0, 0);
    box(bg, 0.42, 0.06, 0.4, bm, 0.02, 0.06, 0);
    box(bg, 0.05, 0.05, 0.05, bm, 0.02, 0.11, 0);              // 帽頂小蒂頭
    for (const [w, h, x, y] of [[0.022, 0.09, -0.04, 0.03], [0.022, 0.09, 0.04, 0.03], [0.06, 0.02, 0, 0.03]]) box(bg, w, h, 0.01, lm, x, y, -0.245).castShadow = false;
  }
  if (look.longHair) {
    box(g, 0.5, 0.86, 0.1, hair, 0, 1.36, 0.25);            // 背後長髮
    box(g, 0.08, 0.5, 0.42, hair, -0.255, 1.4, 0.02);       // 兩側
    box(g, 0.08, 0.5, 0.42, hair, 0.255, 1.4, 0.02);
    box(g, 0.1, 0.5, 0.06, hair, -0.19, 1.14, -0.16);       // 披到胸前的兩撮
    box(g, 0.1, 0.42, 0.06, hair, 0.19, 1.18, -0.16);
  }

  box(g, 0.46, 0.6, 0.26, top, 0, 1.0, 0);                  // 上衣
  box(g, 0.2, 0.05, 0.27, cloth(look.collar || look.top), 0, 1.3, 0);   // 領子
  if (look.collar) box(g, 0.1, 0.12, 0.02, cloth(look.collar), 0, 1.24, -0.13);   // 領口露出的襯衫
  if (look.tie) {                                           // 領帶
    box(g, 0.07, 0.06, 0.02, cloth(look.tie), 0, 1.22, -0.14);
    box(g, 0.06, 0.24, 0.015, cloth(look.tie), 0, 1.07, -0.137);
  }
  if (look.buttons) for (const y of [0.92, 0.78]) box(g, 0.04, 0.04, 0.015, new THREE.MeshLambertMaterial({ color: look.buttons, emissive: '#5a4300' }), 0.09, y, -0.137);
  if (look.badge) look.badge.forEach((c, i) => box(g, 0.1, 0.018, 0.012, cloth(c), 0.13, 1.16 - i * 0.018, -0.136));   // 胸章
  if (look.zip) box(g, 0.02, 0.5, 0.01, cloth(look.zip), 0, 1.0, -0.135);          // 外套拉鍊
  if (look.whistle) {
    box(g, 0.02, 0.2, 0.01, cloth('#1e88e5'), -0.06, 1.2, -0.135);   // 掛繩
    box(g, 0.02, 0.2, 0.01, cloth('#1e88e5'), 0.06, 1.2, -0.135);
    box(g, 0.08, 0.05, 0.05, new THREE.MeshLambertMaterial({ color: '#d8dde3', emissive: '#555' }), 0, 1.09, -0.15);   // 哨子
  }

  const arm = (side) => {
    const p = pivot(side * 0.33, 1.3);
    if (look.longSleeve) {
      box(p, 0.19, 0.58, 0.21, top, 0, -0.29, 0);
      box(p, 0.16, 0.1, 0.18, skin, 0, -0.63, 0);
    } else {
      box(p, 0.2, 0.22, 0.22, top, 0, -0.11, 0);
      box(p, 0.16, 0.46, 0.18, skin, 0, -0.45, 0);
    }
    return p;
  };
  const armL = arm(-1), armR = arm(1);
  if (look.recorder) {                                      // 左手拿著白色直笛（斜斜往上）
    const rg = new THREE.Group(); rg.position.set(0, -0.6, -0.16); rg.rotation.set(0.25, 0, -0.7); armL.add(rg);
    const wm = new THREE.MeshLambertMaterial({ color: '#f6f1e8' }), hm = new THREE.MeshLambertMaterial({ color: '#2b2b2b' });
    box(rg, 0.05, 0.56, 0.05, wm, 0, 0.12, 0);
    box(rg, 0.065, 0.05, 0.065, wm, 0, 0.36, 0);               // 吹嘴那一節
    box(rg, 0.065, 0.04, 0.065, wm, 0, -0.14, 0);              // 尾端
    for (let k = 0; k < 5; k++) box(rg, 0.022, 0.022, 0.01, hm, 0, 0.26 - k * 0.07, -0.027).castShadow = false;
  }

  box(g, 0.47, 0.12, 0.27, pants, 0, 0.72, 0);
  const leg = (side) => {
    const p = pivot(side * 0.12, 0.7);
    box(p, 0.21, 0.58, 0.22, pants, 0, -0.29, 0);
    if (look.stripe) box(p, 0.02, 0.58, 0.06, cloth(look.stripe), side * 0.11, -0.29, 0);   // 運動褲側條
    box(p, 0.21, 0.09, 0.27, shoe, 0, -0.62, -0.03);
    return p;
  };
  const legL = leg(-1), legR = leg(1);

  if (look.cat) {                                            // 尾巴：從背後往上翹（會擺動）
    const tail = new THREE.Group(); tail.position.set(0, 0.78, 0.13); g.add(tail);
    box(tail, 0.08, 0.08, 0.36, hair, 0, 0.06, 0.16).rotation.x = -0.35;
    box(tail, 0.08, 0.3, 0.08, hair, 0, 0.26, 0.33);
    box(tail, 0.085, 0.08, 0.085, cloth(look.pal.h), 0, 0.42, 0.33);
    g.userData.tail = tail;
  }

  g.userData.limbs = { armL, armR, legL, legR };
  return g;
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
