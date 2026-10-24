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

// 合併靜止的物件（效能）：同一層樓、同一區（40 公尺一格）、外觀設定一樣（只有顏色不同）的方塊合成一個，
//   顏色改存在每個頂點上，看起來完全一樣；一張畫面要下的繪圖指令從上千次降到幾百次，學校的內顯電腦才跑得順。
//   分區合併是為了保留「畫面外的不畫」：整層樓黏成一大塊的話，轉頭背對的東西也會每張都畫。
//   呼叫的人負責挑「放著就不會再動」的物件（會動、可以點、半透明、有 userData 標記的都不要傳進來）。
const MERGED_MATS = new Map();
export function mergeStatic(meshes, target, cell = 40) {
  const bins = new Map(), bb = new THREE.Box3(), c = new THREE.Vector3();
  for (const o of meshes) {
    const m = o.material, g = o.geometry;
    o.updateMatrix();
    if (!g.boundingBox) g.computeBoundingBox();
    bb.copy(g.boundingBox).applyMatrix4(o.matrix).getCenter(c);
    const look = [m.map?.uuid ?? '-', m.side, m.alphaTest, m.emissive.getHex(), m.emissiveMap?.uuid ?? '-', m.fog, m.flatShading,
      m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.depthTest, m.depthWrite, o.castShadow, o.receiveShadow, o.renderOrder].join('|');
    const key = `${look}|${Math.floor(c.x / cell)},${Math.floor(c.z / cell)}`;
    if (!bins.has(key)) bins.set(key, { look, list: [] });
    bins.get(key).list.push(o);
  }
  let made = 0, removed = 0;
  for (const { look, list } of bins.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      g.clearGroups(); g.morphAttributes = {};
      g.applyMatrix4(o.matrix);
      const n = g.attributes.position.count;
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
      const col = new Float32Array(n * 3), { r, g: gr, b } = o.material.color;   // 材質顏色（線性色彩空間）直接搬到頂點
      for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gr; col[i * 3 + 2] = b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;                                    // 頂點資料格式對不上就維持原樣
    let mat = MERGED_MATS.get(look);
    if (!mat) { mat = list[0].material.clone(); mat.color.set('#ffffff'); mat.vertexColors = true; MERGED_MATS.set(look, mat); }
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.renderOrder = list[0].renderOrder;
    target.add(mesh); made++;
    for (const o of list) { o.removeFromParent(); removed++; }
  }
  return { made, removed };
}

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

// 校隊隊服（圓領 T 恤，依使用者提供的照片；都不印號碼）
//   籃球隊：男生紅底白字；女生同款，黑底橘字或白底藍字。左胸白色橢圓「Xi Kou」灌籃標誌，背後書法「韌性」＋Basketball 半顆球
//   直笛隊：紫色。正面一隻抱著直笛的米白色小熊，背後圓形徽章（兩支交叉的直笛、態度／責任／榮譽、看樂譜的小孩）＋「溪口音樂校隊精神」
const TEES = {
  basketball: { bg: '#d7182a', fg: '#ffffff', draw: basketballPrint },
  'basketball-black': { bg: '#1c1c1f', fg: '#f28a1e', draw: basketballPrint },
  'basketball-white': { bg: '#f2f2ee', fg: '#1f5fbf', draw: basketballPrint },
  recorder: { bg: '#4b2486', fg: '#efe6d4', ink: '#1f1d2b', draw: recorderPrint },
};
function basketballPrint(c, w, front, { fg }) {
  c.strokeStyle = c.fillStyle = fg; c.lineCap = c.lineJoin = 'round';
  if (front) {
    const cx = w * 0.66, cy = 64;
    c.lineWidth = 3.5; c.beginPath(); c.ellipse(cx, cy, 34, 23, -0.12, 0, Math.PI * 2); c.stroke();
    c.font = 'italic 700 13px "Comic Sans MS", "Segoe Print", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Xi Kou', cx - 9, cy + 1);
    // 灌籃的人（剪影）：手往上伸到橢圓頂端
    c.beginPath(); c.arc(cx + 21, cy - 11, 3.6, 0, Math.PI * 2); c.fill();
    c.lineWidth = 5; c.beginPath(); c.moveTo(cx + 20, cy - 6); c.lineTo(cx + 18, cy + 6); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(cx + 21, cy - 5); c.lineTo(cx + 29, cy - 22); c.stroke();
    c.beginPath(); c.moveTo(cx + 19, cy - 4); c.lineTo(cx + 12, cy + 3); c.stroke();
    c.beginPath(); c.moveTo(cx + 18, cy + 6); c.lineTo(cx + 13, cy + 17); c.lineTo(cx + 9, cy + 15); c.stroke();
    c.beginPath(); c.moveTo(cx + 18, cy + 6); c.lineTo(cx + 27, cy + 13); c.lineTo(cx + 32, cy + 19); c.stroke();
  } else {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 66px "DFKai-SB", "BiauKai", "標楷體", "KaiTi", "STKaiti", serif';
    c.fillText('韌', w * 0.42, 100); c.fillText('性', w * 0.42, 172);
    // 右上：半顆籃球＋斜斜的 Basketball
    const bx = w * 0.7, by = 46;
    c.lineWidth = 3; c.beginPath(); c.arc(bx, by, 19, Math.PI * 0.95, Math.PI * 2.3); c.stroke();
    c.beginPath(); c.moveTo(bx - 19, by); c.lineTo(bx + 19, by); c.stroke();
    c.beginPath(); c.moveTo(bx, by - 19); c.quadraticCurveTo(bx + 9, by, bx + 3, by + 18); c.stroke();
    c.save(); c.translate(w * 0.58, 70); c.rotate(0.38);
    c.font = 'italic 700 12px "Comic Sans MS", "Segoe Print", sans-serif'; c.fillText('Basketball', 0, 0);
    c.restore();
  }
}
// 一支直笛（中心 x, y、長 len、角度 a）：米白色管身、黑色吹口和指孔
function recorderShape(c, x, y, len, a, { fg, ink }, wid = 13) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = fg; c.strokeStyle = ink; c.lineWidth = 2;
  c.beginPath(); c.rect(-wid / 2, -len / 2, wid, len); c.fill(); c.stroke();
  c.fillStyle = ink;
  c.fillRect(-wid / 2, -len / 2, wid, len * 0.12);                                       // 吹口
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(0, -len * 0.12 + i * len * 0.09, wid * 0.22, 0, Math.PI * 2); c.fill(); }
  c.fillRect(-wid / 2, len * 0.36, wid, 3);
  c.restore();
}
function recorderPrint(c, w, front, P) {
  const { fg, ink } = P;
  c.lineCap = c.lineJoin = 'round';
  if (front) {
    // 抱著直笛的小熊
    c.fillStyle = fg; c.strokeStyle = ink; c.lineWidth = 2.5;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(w / 2 + s * 38, 52, 14, 0, Math.PI * 2); c.fill(); c.stroke(); }   // 耳朵
    c.beginPath(); c.ellipse(w / 2, 172, 52, 56, 0, 0, Math.PI * 2); c.fill(); c.stroke();                         // 身體
    c.beginPath(); c.ellipse(w / 2, 86, 50, 40, 0, 0, Math.PI * 2); c.fill(); c.stroke();                          // 頭
    for (const s of [-1, 1]) {                                                                                     // 耳朵裡的三角形
      c.beginPath(); c.moveTo(w / 2 + s * 44, 48); c.lineTo(w / 2 + s * 32, 46); c.lineTo(w / 2 + s * 34, 58); c.closePath(); c.stroke();
    }
    c.fillStyle = ink;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(w / 2 + s * 17, 84, 5.5, 0, Math.PI * 2); c.fill(); }           // 眼睛
    c.beginPath(); c.moveTo(w / 2 - 6, 96); c.lineTo(w / 2 + 6, 96); c.lineTo(w / 2, 104); c.closePath(); c.stroke();   // 嘴巴
    c.lineWidth = 1.5;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(w / 2 + s * (30 + i * 3), 92); c.lineTo(w / 2 + s * (28 + i * 3), 98); c.stroke(); }   // 腮紅
    recorderShape(c, w / 2 + 6, 186, 76, 0.85, P, 12);
    c.lineWidth = 2.5; c.strokeStyle = ink;
    c.beginPath(); c.arc(w / 2 - 22, 168, 11, 0.2, Math.PI * 1.1); c.stroke();                                    // 兩隻手
    c.beginPath(); c.arc(w / 2 + 26, 162, 11, -0.6, Math.PI * 0.9); c.stroke();
  } else {
    // 圓形徽章：兩支交叉的直笛、三個圖示（態度／責任／榮譽）、看樂譜的小孩
    const cx = w / 2, cy = 100, r = 70;
    c.fillStyle = fg; c.strokeStyle = ink; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(cx, cy, r - 6, 0, Math.PI * 2); c.stroke();
    recorderShape(c, cx, cy + 4, 130, -0.62, P, 17);
    recorderShape(c, cx, cy + 4, 130, 0.62, P, 17);
    c.fillStyle = fg; c.strokeStyle = ink; c.lineWidth = 2;
    for (const [x, y] of [[cx, cy - 46], [cx - 44, cy - 2], [cx + 44, cy - 2]]) { c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.fillStyle = ink;
    c.beginPath(); c.moveTo(cx - 52, cy + 6); c.lineTo(cx - 44, cy - 10); c.lineTo(cx - 36, cy + 6); c.fill();      // 山（態度）
    c.fillRect(cx - 5, cy - 52, 10, 12);                                                                            // 拳頭（責任）
    c.beginPath(); c.arc(cx + 44, cy - 4, 6, 0, Math.PI * 2); c.fill(); c.fillRect(cx + 40, cy + 1, 3, 9); c.fillRect(cx + 45, cy + 1, 3, 9);   // 獎章（榮譽）
    c.font = '700 10px "Noto Sans TC", "Microsoft JhengHei", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('責任', cx, cy - 26); c.fillText('態度', cx - 44, cy - 22); c.fillText('榮譽', cx + 44, cy - 22);
    c.fillStyle = fg; c.beginPath(); c.arc(cx, cy + 42, 9, 0, Math.PI * 2); c.fill(); c.stroke();                 // 小孩的頭
    c.fillRect(cx - 14, cy + 51, 28, 18); c.strokeRect(cx - 14, cy + 51, 28, 18); c.beginPath(); c.moveTo(cx, cy + 51); c.lineTo(cx, cy + 69); c.stroke();   // 樂譜
    c.fillStyle = fg; c.font = '900 14px "DFKai-SB", "標楷體", "Noto Serif TC", serif';
    c.fillText('溪口音樂校隊精神', cx, cy + r + 16);
  }
}
const teeTexCache = {};
function teeTexture(kind, front) {
  return (teeTexCache[kind + front] ||= (() => {
    const P = TEES[kind], cv = document.createElement('canvas'), S = 2, w = 184;
    cv.width = w * S; cv.height = 240 * S;
    const c = cv.getContext('2d');
    c.scale(S, S);
    c.fillStyle = P.bg; c.fillRect(0, 0, w, 240);
    c.fillStyle = 'rgba(0,0,0,.05)';
    for (let y = 0; y < 240; y += 4) c.fillRect(0, y, w, 1);             // 排汗布細紋
    P.draw(c, w, front, P);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  })());
}

/** 選角色畫面的服裝按鈕：key → [中文, English]（泳裝是游泳小遊戲自動換的，不在這裡）；
 *  籃球隊女生有兩款（BB_GIRL），男生只有紅色那款 */
export const OUTFITS = { uniform: ['制服', 'Uniform'], basketball: ['籃球隊', 'Basketball team'], recorder: ['直笛隊', 'Recorder team'] };
export const BB_GIRL = { black: ['黑底橘字', 'Black & orange'], white: ['白底藍字', 'White & blue'] };
/** 實際穿哪一套（女生的籃球隊要看選哪一款） */
export const outfitFor = (o, gender, bbGirl = 'black') => (o === 'basketball' && gender === 'girl' ? `basketball-${bbGirl in BB_GIRL ? bbGirl : 'black'}` : o);

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
  // 換裝：swim＝泳裝（游泳小遊戲用，保守款：男生短袖水母衣＋短泳褲、女生連身泳裝，深藍色）；其他＝校隊隊服（TEES）
  const navy = cloth('#1d2b57'), girl = gender === 'girl';
  const outfit = [];                                         // [方塊, 制服材質, { 服裝: 材質（null＝藏起來；沒寫＝跟制服一樣） }]
  const dress = (mesh, alt) => { outfit.push([mesh, mesh.material, alt]); return mesh; };
  const teeKinds = girl ? ['basketball-black', 'basketball-white', 'recorder'] : ['basketball', 'recorder'];
  const teeSide = Object.fromEntries(teeKinds.map((k) => [k, cloth(TEES[k].bg)]));
  const tees = (f) => Object.fromEntries(teeKinds.map((k) => [k, f(k)]));   // 每一套隊服各用什麼材質
  // swim(方塊, 泳裝材質, 隊服材質)：隊服材質可以是 (k) => 材質；沒給＝穿隊服時跟制服一樣
  const swim = (mesh, m, tee) => dress(mesh, { swim: m, ...(tee === undefined ? {} : tees(typeof tee === 'function' ? tee : () => tee)) });

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
  swim(torso, navy, (k) => [teeSide[k], teeSide[k], teeSide[k], teeSide[k],
    new THREE.MeshLambertMaterial({ map: teeTexture(k, false) }), new THREE.MeshLambertMaterial({ map: teeTexture(k, true) })]);
  // 隊服是圓領 T 恤：polo 領、門襟、鈕扣都拿掉
  swim(box(g, 0.44, 0.07, 0.28, collar, 0, 1.28, 0), null, null);             // 領子
  swim(box(g, 0.45, 0.02, 0.285, trim, 0, 1.31, 0), null, null);              // 領子上緣灰邊
  swim(box(g, 0.06, 0.15, 0.02, collar, 0, 1.17, -0.135), null, null);        // 門襟
  swim(box(g, 0.025, 0.025, 0.02, collar, 0, 1.2, -0.147), null, null);       // 鈕扣（同色）
  swim(box(g, 0.025, 0.025, 0.02, collar, 0, 1.13, -0.147), null, null);
  dress(box(g, 0.47, 0.03, 0.27, polo, 0, 1.3, 0), { swim: null, uniform: null, ...tees((k) => teeSide[k]) });   // 圓領（只有隊服有）

  // 手臂：短袖（全紅）＋ 手臂（膚色）；左袖綠色小校徽
  const arm = (side) => {
    const p = pivot(side * 0.33, 1.3);
    swim(box(p, 0.2, 0.22, 0.22, polo, 0, -0.11, 0), girl ? skin : navy, (k) => teeSide[k]);   // 連身泳裝露手臂；水母衣是短袖
    if (side === -1) swim(box(p, 0.01, 0.06, 0.06, cloth('#2e9e4f'), -0.105, -0.08, 0), null, null);   // 校徽
    box(p, 0.16, 0.36, 0.18, skin, 0, -0.4, 0);
    box(p, 0.17, 0.1, 0.19, skin, 0, -0.62, 0);
    return p;
  };
  const armL = arm(-1), armR = arm(1);

  // 黑色運動短褲（含腰部）＋ 腿 ＋ 白襪 ＋ 鞋子
  swim(box(g, 0.47, 0.14, 0.27, shorts, 0, 0.71, 0), navy);
  const leg = (side) => {
    const p = pivot(side * 0.12, 0.7);
    swim(box(p, 0.22, 0.26, 0.23, shorts, 0, -0.13, 0), girl ? skin : navy);   // 短泳褲；連身泳裝只到腰下
    swim(box(p, 0.02, 0.24, 0.23, trim, side * 0.115, -0.13, 0), null);    // 側邊灰條
    box(p, 0.18, 0.24, 0.19, skin, 0, -0.38, 0);
    swim(box(p, 0.19, 0.08, 0.2, sock, 0, -0.54, 0), skin);                  // 游泳打赤腳
    swim(box(p, 0.21, 0.09, 0.27, shoe, 0, -0.62, -0.03), skin);
    return p;
  };
  const legL = leg(-1), legR = leg(1);

  g.userData.limbs = { armL, armR, legL, legR };
  g.userData.gender = gender;
  // kind：'uniform'（制服）、'swim'（泳裝）、TEES 裡的隊服（女生的籃球隊用 outfitFor 換成 basketball-black／white）
  g.userData.setOutfit = (kind = 'uniform') => {
    for (const [mesh, uni, alt] of outfit) {
      const m = kind in alt ? alt[kind] : uni;
      mesh.visible = !!m; if (m) mesh.material = m;
    }
  };
  g.userData.setOutfit('uniform');
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
 *   bun: 頭髮往後綁成低髮髻（臉旁留兩撮）, lanyard: 識別證掛繩顏色, sleeveless: 無袖
 *   cap: { color, logo } 棒球帽（帽簷朝前、前面一個勾勾標誌）, pocket: 連帽 T 口袋顏色
 * }
 */
export function makeBlockNPC(look) {
  const g = new THREE.Group();
  const cloth = (color) => new THREE.MeshLambertMaterial({ map: BLOCKY ? tex('wool') : null, color });
  const skin = new THREE.MeshLambertMaterial({ color: look.skin });
  const top = cloth(look.top), pants = cloth(look.pants);
  const shoe = new THREE.MeshLambertMaterial({ color: look.shoe });
  const px = (draw) => canvasTex((c) => draw(c), 1, 16, { smooth: false });
  // 表情（參考學生美勞作品「方塊人像」）：從原本的臉自動找出眼睛、嘴巴再改畫，各表情的貼圖用到才做
  const drawFace = faceDrawer(look), faces = {};
  const faceTex = (ex) => (faces[ex] ||= px((c) => drawFace(c, ex)));
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex('normal') });
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
  if (look.cap) {                                           // 棒球帽：帽身、往前伸的帽簷、前面的勾勾標誌、頂上小鈕扣
    const cm = cloth(look.cap.color), lm = new THREE.MeshLambertMaterial({ color: look.cap.logo || '#ffffff' });
    box(hg, 0.5, 0.17, 0.5, cm, 0, 1.79 - NECK, 0.01);
    box(hg, 0.44, 0.12, 0.44, cm, 0, 1.9 - NECK, 0.02);
    box(hg, 0.46, 0.035, 0.24, cm, 0, 1.715 - NECK, -0.33);     // 帽簷
    box(hg, 0.05, 0.03, 0.05, cm, 0, 1.97 - NECK, 0.02);
    const sw = box(hg, 0.15, 0.03, 0.01, lm, 0.01, 1.8 - NECK, -0.252); sw.rotation.z = 0.35; sw.castShadow = false;   // 勾勾
    box(hg, 0.05, 0.03, 0.01, lm, -0.07, 1.785 - NECK, -0.252).castShadow = false;
  }
  if (look.longHair) {
    box(g, 0.5, 0.86, 0.1, hair, 0, 1.36, 0.25);            // 背後長髮
    box(g, 0.08, 0.5, 0.42, hair, -0.255, 1.4, 0.02);       // 兩側
    box(g, 0.08, 0.5, 0.42, hair, 0.255, 1.4, 0.02);
    box(g, 0.1, 0.5, 0.06, hair, -0.19, 1.14, -0.16);       // 披到胸前的兩撮
    box(g, 0.1, 0.42, 0.06, hair, 0.19, 1.18, -0.16);
  }
  if (look.headband) {                                      // 綁在額頭的頭巾（後面打結、垂兩小片）
    const hm = cloth(look.headband);
    box(hg, 0.49, 0.09, 0.49, hm, 0, 1.69 - NECK, 0);
    box(hg, 0.1, 0.08, 0.06, hm, 0, 1.69 - NECK, 0.26);
    for (const s of [-1, 1]) { const t = box(hg, 0.05, 0.12, 0.03, hm, s * 0.04, 1.62 - NECK, 0.27); t.rotation.z = s * 0.3; }
  }
  if (look.neckerchief) {                                   // 綁在脖子上的領巾：繞一圈、前面打結垂下兩角
    const nm = cloth(look.neckerchief);
    box(g, 0.34, 0.07, 0.3, nm, 0, 1.31, 0);
    box(g, 0.08, 0.07, 0.03, nm, 0, 1.26, -0.15);
    for (const s of [-1, 1]) { const t = box(g, 0.07, 0.16, 0.02, nm, s * 0.04, 1.17, -0.145); t.rotation.z = s * 0.25; }
  }
  if (look.bob) {                                           // 齊下巴的短鮑伯頭：後面、兩側蓋到下巴
    box(g, 0.5, 0.44, 0.08, hair, 0, 1.56, 0.25);
    box(g, 0.07, 0.4, 0.44, hair, -0.255, 1.56, 0.02);
    box(g, 0.07, 0.4, 0.44, hair, 0.255, 1.56, 0.02);
  }
  if (look.bun) {                                           // 往後綁的低髮髻＋臉旁兩撮
    box(g, 0.22, 0.2, 0.14, hair, 0, 1.42, 0.29);
    box(g, 0.14, 0.12, 0.06, hair, 0, 1.43, 0.38);
    box(g, 0.04, 0.24, 0.04, hair, -0.215, 1.42, -0.19);
    box(g, 0.04, 0.2, 0.04, hair, 0.215, 1.44, -0.19);
  }

  box(g, 0.46, 0.6, 0.26, top, 0, 1.0, 0);                  // 上衣
  box(g, 0.2, 0.05, 0.27, cloth(look.collar || look.top), 0, 1.3, 0);   // 領子
  if (look.collar) box(g, 0.1, 0.12, 0.02, cloth(look.collar), 0, 1.24, -0.13);   // 領口露出的襯衫
  if (look.tee) {                                           // 吊帶洋裝：上胸露出底下的 T 恤，兩條吊帶繞過肩膀
    box(g, 0.47, 0.16, 0.27, cloth(look.tee), 0, 1.22, 0);
    for (const s of [-1, 1]) box(g, 0.06, 0.17, 0.275, top, s * 0.13, 1.22, 0);
  }
  if (look.buttonRow) {                                     // 洋裝前面一整排扣子（上衣到裙子）
    const bm = new THREE.MeshLambertMaterial({ color: look.buttonRow });
    for (const y of [1.06, 0.95, 0.84]) box(g, 0.035, 0.035, 0.012, bm, 0, y, -0.136);
    if (look.shortSkirt || look.skirt) for (const y of [0.68, 0.56, 0.44]) box(g, 0.035, 0.035, 0.012, bm, 0, y, -0.156);
  }
  if (look.belt) {                                          // 細皮帶＋銀色皮帶扣
    box(g, 0.48, 0.045, 0.28, cloth(look.belt), 0, 0.82, 0);
    box(g, 0.07, 0.045, 0.012, new THREE.MeshLambertMaterial({ color: '#c9cdd1', emissive: '#333' }), 0, 0.82, -0.145);
  }
  if (look.tie) {                                           // 領帶
    box(g, 0.07, 0.06, 0.02, cloth(look.tie), 0, 1.22, -0.14);
    box(g, 0.06, 0.24, 0.015, cloth(look.tie), 0, 1.07, -0.137);
  }
  if (look.buttons) for (const y of [0.92, 0.78]) box(g, 0.04, 0.04, 0.015, new THREE.MeshLambertMaterial({ color: look.buttons, emissive: '#5a4300' }), 0.09, y, -0.137);
  if (look.badge) look.badge.forEach((c, i) => box(g, 0.1, 0.018, 0.012, cloth(c), 0.13, 1.16 - i * 0.018, -0.136));   // 胸章
  if (look.hoodie) {                                        // 連帽 T：背後的帽子、白色抽繩、前面大口袋
    box(g, 0.4, 0.2, 0.1, top, 0, 1.25, 0.17);
    for (const x of [-0.06, 0.06]) box(g, 0.02, 0.16, 0.012, cloth(look.hoodie), x, 1.18, -0.136);
    box(g, 0.3, 0.13, 0.015, cloth(look.pocket || '#a8161f'), 0, 0.8, -0.137);
  }
  if (look.zip) box(g, 0.02, 0.5, 0.01, cloth(look.zip), 0, 1.0, -0.135);          // 外套拉鍊
  if (look.sushi) {                                         // 胸前的不織布壽司拼貼（淺藍底、鮭魚、玉子燒、海苔捲）
    const P = (w, h, c, x, y) => box(g, w, h, 0.01, cloth(c), x, y, -0.135 - (c === '#8fc8ec' ? 0 : 0.006));
    P(0.2, 0.17, '#8fc8ec', -0.06, 0.84);
    P(0.08, 0.035, '#f08060', -0.11, 0.89); P(0.08, 0.035, '#f6d24a', -0.1, 0.83); P(0.06, 0.03, '#f08060', -0.02, 0.8);
    P(0.04, 0.04, '#222222', -0.03, 0.89);
    P(0.06, 0.035, '#f6d24a', -0.0, 0.85);
  }
  if (look.shades) {                                        // 掛在領口的太陽眼鏡
    const sm = cloth('#1c1c22');
    for (const s of [-1, 1]) box(g, 0.07, 0.05, 0.012, sm, 0.04 + s * 0.045, 1.2, -0.14);
    box(g, 0.03, 0.012, 0.012, sm, 0.04, 1.215, -0.14);
  }
  if (look.camera) {                                        // 脖子上掛的相機：兩條米灰色背帶（咖啡色皮扣）垂到肚子前、黑色小相機
    const sm = cloth('#b8b0a0'), lm = cloth('#8a5a3a');
    for (const s of [-1, 1]) { box(g, 0.05, 0.42, 0.012, sm, s * 0.12, 1.08, -0.138); box(g, 0.055, 0.06, 0.014, lm, s * 0.12, 0.92, -0.139); }
    box(g, 0.2, 0.12, 0.08, cloth('#1c1c1e'), 0, 0.82, -0.17);
    box(g, 0.07, 0.07, 0.04, cloth('#2e2e32'), 0.02, 0.81, -0.22);
  }
  if (look.bear) {                                          // T 恤上的咖啡色小熊圖案（耳朵、眼睛、淺色嘴巴）
    const P = (w, h, c, x, y, dz = 0) => box(g, w, h, 0.01, cloth(c), x, y, -0.135 - dz);
    P(0.18, 0.15, '#8a5a32', -0.02, 0.98); P(0.05, 0.05, '#8a5a32', -0.1, 1.07); P(0.05, 0.05, '#8a5a32', 0.06, 1.07);
    P(0.025, 0.025, '#1a1a1a', -0.06, 1.0, 0.006); P(0.025, 0.025, '#1a1a1a', 0.02, 1.0, 0.006);
    P(0.07, 0.05, '#e8c89a', -0.02, 0.94, 0.006); P(0.025, 0.02, '#1a1a1a', -0.02, 0.955, 0.012);
  }
  if (look.print) {                                         // T 恤上的黑色線條圖案（一片長長的花瓣：外框＋中間葉脈＋花莖，在右下）
    const pm = cloth(look.print), P = (w, h, x, y) => box(g, w, h, 0.01, pm, x, y, -0.135);
    P(0.012, 0.16, 0.04, 0.98); P(0.012, 0.16, 0.14, 0.98);
    P(0.06, 0.012, 0.09, 1.08); P(0.012, 0.012, 0.053, 1.068); P(0.012, 0.012, 0.127, 1.068);
    P(0.06, 0.012, 0.09, 0.89); P(0.012, 0.012, 0.053, 0.902); P(0.012, 0.012, 0.127, 0.902);
    P(0.008, 0.14, 0.09, 0.98);
    P(0.012, 0.13, 0.09, 0.82);
  }
  if (look.lanyard) {                                       // 識別證：掛繩斜斜到胸前、白色卡片
    for (const sd of [-1, 1]) { const b = box(g, 0.03, 0.3, 0.012, cloth(look.lanyard), sd * 0.075, 1.15, -0.136); b.rotation.z = sd * 0.25; }
    box(g, 0.14, 0.17, 0.014, new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0, 0.93, -0.14);
    box(g, 0.14, 0.04, 0.016, cloth(look.lanyard), 0, 0.995, -0.14);
  }
  if (look.beanie) {                                        // 毛線帽：帽身＋反折帽緣＋頂端毛球
    const bm = cloth(look.beanie);
    box(hg, 0.5, 0.16, 0.5, bm, 0, 1.84 - NECK, 0);
    box(hg, 0.52, 0.08, 0.52, cloth(look.beanieCuff || look.beanie), 0, 1.76 - NECK, 0);
    box(hg, 0.14, 0.12, 0.14, bm, 0, 1.97 - NECK, 0);
  }
  if (look.scarf) {                                         // 圍巾：繞脖子一圈，兩端垂在胸前
    const [a, b2] = look.scarf.map((c) => cloth(c));
    box(g, 0.5, 0.11, 0.32, a, 0, 1.31, 0);
    box(g, 0.11, 0.42, 0.03, b2, -0.11, 1.08, -0.15); box(g, 0.1, 0.36, 0.03, a, 0.1, 1.11, -0.152);
    box(g, 0.08, 0.06, 0.032, a, -0.11, 1.0, -0.153);                 // 米白那端上的紅色蝴蝶結
  }
  if (look.bag) {                                           // 斜背包：背帶從右肩斜到左腰，小包包在腰側
    const strap = box(g, 0.03, 0.66, 0.015, cloth(look.bag), 0.02, 1.03, -0.14); strap.rotation.z = -0.62;
    box(g, 0.22, 0.17, 0.09, cloth(look.bag), -0.2, 0.76, -0.12);
  }
  if (look.skirt) box(g, 0.5, 0.62, 0.3, cloth(look.skirt), 0, 0.42, 0);   // 長裙（蓋到腳踝）
  if (look.shortSkirt) box(g, 0.5, 0.4, 0.3, cloth(look.shortSkirt), 0, 0.6, 0);   // 膝上短裙
  if (look.whistle) {
    box(g, 0.02, 0.2, 0.01, cloth('#1e88e5'), -0.06, 1.2, -0.135);   // 掛繩
    box(g, 0.02, 0.2, 0.01, cloth('#1e88e5'), 0.06, 1.2, -0.135);
    box(g, 0.08, 0.05, 0.05, new THREE.MeshLambertMaterial({ color: '#d8dde3', emissive: '#555' }), 0, 1.09, -0.15);   // 哨子
  }

  const arm = (side) => {
    const p = pivot(side * 0.33, 1.3);
    if (look.longSleeve) {
      box(p, 0.19, 0.58, 0.21, look.sleeve ? cloth(look.sleeve) : top, 0, -0.29, 0);   // sleeve：背心底下的外套袖子
      box(p, 0.16, 0.1, 0.18, skin, 0, -0.63, 0);
    } else {
      if (look.sleeveless) box(p, 0.17, 0.68, 0.18, skin, 0, -0.34, 0);   // 無袖：整條手臂
      else {
        box(p, 0.2, 0.22, 0.22, look.tee ? cloth(look.tee) : top, 0, -0.11, 0);   // 吊帶洋裝：短袖是底下 T 恤的顏色
        box(p, 0.16, 0.46, 0.18, skin, 0, -0.45, 0);
      }
    }
    return p;
  };
  const armL = arm(-1), armR = arm(1);
  // 手上拿的東西（holdL 左手、holdR 右手）：直笛、羽球拍、羽毛球
  const holdItem = (armP, kind) => {
    const rg = new THREE.Group(); armP.add(rg);
    const M = (color) => new THREE.MeshLambertMaterial({ color });
    if (kind === 'recorder') {                              // 白色直笛（斜斜往上）
      rg.position.set(0, -0.6, -0.16); rg.rotation.set(0.25, 0, -0.7);
      const wm = M('#f6f1e8'), hm = M('#2b2b2b');
      box(rg, 0.05, 0.56, 0.05, wm, 0, 0.12, 0);
      box(rg, 0.065, 0.05, 0.065, wm, 0, 0.36, 0);             // 吹嘴那一節
      box(rg, 0.065, 0.04, 0.065, wm, 0, -0.14, 0);            // 尾端
      for (let k = 0; k < 5; k++) box(rg, 0.022, 0.022, 0.01, hm, 0, 0.26 - k * 0.07, -0.027).castShadow = false;
    } else if (kind === 'racket') {                         // 黑色羽球拍（直直立起來）
      rg.position.set(0, -0.64, -0.12); rg.rotation.set(-0.5, 0, 0); rg.add(makeRacket());
    } else if (kind === 'brush') {                          // 水彩筆（木頭筆桿、銀色筆箍、沾了顏料的筆毛）
      rg.position.set(0, -0.64, -0.1); rg.rotation.set(-0.7, 0, 0);
      box(rg, 0.025, 0.3, 0.025, M('#c98b4a'), 0, 0.08, 0);
      box(rg, 0.03, 0.05, 0.03, M('#c9cdd1'), 0, 0.25, 0);
      box(rg, 0.035, 0.07, 0.035, M('#e53935'), 0, 0.31, 0);
    } else if (kind === 'shuttle') {                        // 羽毛球（球頭朝上）
      rg.position.set(0, -0.7, -0.08); rg.add(makeShuttle());
    } else if (kind === 'paperbag') {                       // 紅色紙提袋（白字），提在手上垂下來
      rg.position.set(0, -0.72, 0);
      box(rg, 0.012, 0.12, 0.012, M('#b71c1c'), 0, -0.02, -0.03); box(rg, 0.012, 0.12, 0.012, M('#b71c1c'), 0, -0.02, 0.03);
      box(rg, 0.1, 0.36, 0.26, M('#e53935'), 0, -0.26, 0);
      box(rg, 0.105, 0.2, 0.03, M('#fbe9e7'), 0, -0.26, -0.06);
    } else if (kind === 'bottle') {                         // 深藍色水壺（握著上面的提把，壺身垂在手下面）
      rg.position.set(0, -0.7, 0);
      box(rg, 0.03, 0.08, 0.1, M('#1c1c1e'), 0, -0.02, 0);                 // 提把
      box(rg, 0.13, 0.06, 0.13, M('#1c1c1e'), 0, -0.09, 0);                // 瓶蓋
      box(rg, 0.12, 0.34, 0.12, M('#3b4c66'), 0, -0.29, 0);                // 壺身
      box(rg, 0.122, 0.04, 0.122, M('#8fa3bf'), 0, -0.36, 0);             // 刻度那圈淺色
    } else if (kind === 'magazine') {                       // 雜誌（彩色封面朝前，斜斜拿在手上）
      rg.position.set(0.02, -0.62, -0.2); rg.rotation.set(0, 0, -0.35);
      box(rg, 0.3, 0.4, 0.02, M('#eef3f6'), 0, 0.12, 0);
      box(rg, 0.26, 0.24, 0.005, M('#e8823a'), 0.0, 0.17, -0.012);
      box(rg, 0.1, 0.12, 0.006, M('#c0392b'), 0.07, 0.2, -0.014);
      box(rg, 0.26, 0.04, 0.005, M('#3a8fd0'), 0, 0.3, -0.012);
    } else if (kind === 'bouquet') {                        // 花束：粉白包裝紙、紅玫瑰＋粉色洋桔梗、小雛菊、紅緞帶（抱在胸前斜斜往上）
      rg.position.set(0.16, -0.42, -0.24); rg.rotation.set(-0.45, 0, -0.35);
      box(rg, 0.16, 0.3, 0.16, M('#f3dcd6'), 0, 0.02, 0);
      box(rg, 0.32, 0.14, 0.3, M('#f7ece8'), 0, 0.22, 0);
      box(rg, 0.17, 0.06, 0.17, M('#c62828'), 0, -0.08, 0);
      const flowers = [['#c62828', -0.08, -0.07], ['#c62828', 0.08, 0.06], ['#f4b6c8', 0.08, -0.07], ['#f4b6c8', -0.08, 0.07], ['#c62828', 0, 0]];
      for (const [c, x, z] of flowers) box(rg, 0.11, 0.1, 0.11, M(c), x, 0.33, z);
      for (const [x, z] of [[-0.14, 0], [0.14, 0.01], [0, -0.14], [0.01, 0.14]]) {
        box(rg, 0.06, 0.02, 0.06, M('#ffffff'), x, 0.34, z);
        box(rg, 0.025, 0.025, 0.025, M('#f2c400'), x, 0.355, z);
      }
    }
  };
  if (look.holdL) holdItem(armL, look.holdL);
  if (look.holdR) holdItem(armR, look.holdR);


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
  g.userData.setFace = (ex) => { const m = faceTex(NPC_FACES.includes(ex) ? ex : 'normal'); if (faceMat.map !== m) faceMat.map = m; };
  // 合併每個部位裡的小方塊（效能）：身體、頭、手、腳、尾巴、手上拿的東西各自合成幾塊，關節照樣可以擺動作；
  //   頭（六面不同材質）不合併，換表情照常。全校幾十位老師，一張畫面可以少下幾百次繪圖指令
  const groups = []; g.traverse((o) => { if (o.isGroup) groups.push(o); });
  for (const grp of groups) {
    mergeStatic(grp.children.filter((o) => o.isMesh && !o.children.length && !Array.isArray(o.material)
      && o.material.isMeshLambertMaterial && !o.material.transparent), grp, 1000);
  }
  return g;
}

// NPC 的表情：平常、眨眼、開心笑、眨眼吐舌、驚訝、難過、想睡、吐舌頭
export const NPC_FACES = ['normal', 'blink', 'happy', 'wink', 'surprised', 'sad', 'sleepy', 'tongue'];
function faceDrawer(look) {
  const rows = look.face, pal = look.pal;
  const skin = look.cat ? 'W' : 'S', eyeCh = look.cat ? 'Ep' : 'EWep', eyeBg = look.cat ? 'L' : skin;
  // 找出符合條件的像素範圍（左眼、右眼、嘴巴）
  const box = (test) => {
    let b = null;
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (!test(ch, x, y)) return;
      b ||= { x0: x, x1: x, y0: y, y1: y };
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
    }));
    return b;
  };
  const eyes = [box((ch, x) => x < 8 && eyeCh.includes(ch)), box((ch, x) => x >= 8 && eyeCh.includes(ch))];
  const mouth = box((ch, x, y) => y >= 9 && 'MT'.includes(ch));
  const dark = pal.E || '#222222', mc = pal.M || dark, tongue = '#e8607a', inside = '#5a1e22';
  return (c, ex) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); }));
    const dot = (col, x, y, w = 1, h = 1) => { if (w > 0 && h > 0) { c.fillStyle = col; c.fillRect(x, y, w, h); } };
    const W = (b) => b.x1 - b.x0 + 1, H = (b) => b.y1 - b.y0 + 1;
    const clear = (b, bg) => dot(pal[bg], b.x0, b.y0, W(b), H(b));
    // 眼睛
    const closed = (b, low) => { if (!b) return; clear(b, eyeBg); dot(dark, b.x0, low ? b.y1 : b.y0 + (H(b) >> 1), W(b), 1); };   // 閉眼：一條線
    const arch = (b) => {                                                  // 笑瞇瞇：∩
      if (!b) return;
      clear(b, eyeBg);
      const y = b.y0 + (H(b) >= 3 ? 1 : 0);
      dot(dark, b.x0, y, W(b), 1); dot(dark, b.x0 - 1, y + 1); dot(dark, b.x1 + 1, y + 1);
    };
    // 嘴巴
    const m = mouth;
    const mw = m ? W(m) : 0, cx = m ? m.x0 + ((mw - 2) >> 1) : 0;
    const grin = () => {                                                   // 張嘴大笑
      clear(m, skin);
      dot(mc, m.x0, m.y0, mw, 1);
      dot(mc, m.x0, m.y0 + 1, mw, 1); dot(inside, m.x0 + 1, m.y0 + 1, mw - 2, 1); dot(tongue, cx, m.y0 + 1, 2, 1);
      dot(mc, m.x0 + 1, m.y0 + 2, mw - 2, 1);
    };
    const oh = () => {                                                     // 驚訝：O
      clear(m, skin);
      const sz = mw >= 4 ? 3 : 2, ox = m.x0 + ((mw - sz) >> 1);
      dot(mc, ox, m.y0, sz, sz); if (sz === 3) dot(inside, ox + 1, m.y0 + 1);
    };
    const frown = () => { clear(m, skin); dot(mc, m.x0 + 1, m.y0, mw - 2, 1); dot(mc, m.x0, m.y0 + 1); dot(mc, m.x1, m.y0 + 1); };
    const flat = () => { clear(m, skin); dot(mc, m.x0 + 1, m.y0 + (H(m) >> 1), Math.max(1, mw - 2), 1); };
    const tongueOut = () => { clear(m, skin); dot(mc, m.x0, m.y0, mw, 1); dot(tongue, cx, m.y0 + 1, 2, 2); };
    if (ex === 'blink') { closed(eyes[0]); closed(eyes[1]); }
    else if (ex === 'happy') { arch(eyes[0]); arch(eyes[1]); if (m) grin(); }
    else if (ex === 'wink') { closed(eyes[1]); if (m) tongueOut(); }
    else if (ex === 'surprised') { if (m) oh(); }
    else if (ex === 'sad') { if (m) frown(); }
    else if (ex === 'sleepy') { closed(eyes[0], true); closed(eyes[1], true); if (m) flat(); }
    else if (ex === 'tongue') { if (m) tongueOut(); }
  };
}

/* ---------- 羽球拍（握把在原點、拍面往 +y）、羽毛球（球頭在下、羽毛往 +y） ---------- */

export function makeRacket() {
  const g = new THREE.Group(), bk = new THREE.MeshLambertMaterial({ color: '#1f1f22' });
  const box = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bk); m.position.set(x, y, 0); g.add(m); return m; };
  box(0.045, 0.2, 0.045, 0, 0);                                // 握把
  box(0.018, 0.26, 0.018, 0, 0.23);                            // 拍桿
  const cy = 0.5, rw = 0.2, rh = 0.26;                          // 拍框（方塊拼成的橢圓）
  box(0.02, rh - 0.08, 0.02, -rw / 2, cy); box(0.02, rh - 0.08, 0.02, rw / 2, cy);
  box(rw - 0.06, 0.02, 0.02, 0, cy + rh / 2); box(rw - 0.06, 0.02, 0.02, 0, cy - rh / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(0.04, 0.04, 0.02, sx * (rw / 2 - 0.02), cy + sy * (rh / 2 - 0.02));
  const net = new THREE.Mesh(new THREE.PlaneGeometry(rw - 0.01, rh - 0.01), new THREE.MeshLambertMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  net.position.set(0, cy, 0); g.add(net);
  return g;
}
export function makeShuttle() {
  const g = new THREE.Group();
  const cork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), new THREE.MeshLambertMaterial({ color: '#f4f2ec' }));
  cork.position.y = 0.02; g.add(cork);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.052), new THREE.MeshLambertMaterial({ color: '#222222' }));
  band.position.y = 0.045; g.add(band);
  const fe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.09, 8, 1, true), new THREE.MeshLambertMaterial({ color: '#fbfaf5', side: THREE.DoubleSide }));
  fe.position.y = 0.095; g.add(fe);
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
