import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PanoViewer } from './pano.js?v=64';
import { furnishFloor } from './furniture.js?v=64';
import { poolWallMat, poolStripeMat, poolDoor, buildPool, buildPoolPlayground, buildElevator, makeCat } from './extras.js?v=64';
import { buildField, buildStage, buildFacadeC, buildMuralBlock, buildCourtyard, buildParking, buildFrontYard, buildGuardHouse } from './field.js?v=64';
import { buildCampusWall } from './wall.js?v=64';
import { BLOCKY, STYLE, setStyle, mat, blockBox, Batch, SPOTS, makeBlockPerson, makeBlockNPC, animatePerson, addBlockTree, makeClouds } from './blocks.js?v=64';

/* =========================================================
 * 溪口國小 3D 校園
 * 資料在 campus-data.js；這裡負責建模、走動、樓梯、搜尋與導航
 * ========================================================= */

const D = window.CAMPUS;
const S = D.PX_PER_M, [OX, OY] = D.ORIGIN;
const FLOOR_H = 3.6, WALL_H = 3.0, RAIL_H = 1.1, WALL_T = BLOCKY ? 0.3 : 0.16;
// 建築一樓比戶外地面高（依使用者說明：約司令臺高度）。操場、停車場、中庭、游泳館在地面（y = 0）
const BASE = 1.2;
const LABEL_FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
const CEIL_T = FLOOR_H - WALL_H - 0.3;      // 天花板厚度：牆頂到上一層地板底
const AVATAR_SCALE = 0.8;                 // 角色大小（學生比例，進教室才不會太大）
const PLAYER_R = 0.28, EYE_H = 1.55 * AVATAR_SCALE;
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;

const mx = (px) => (px - OX) / S;
const mz = (py) => (py - OY) / S;
const rectM = (r) => ({ x1: mx(r[0]), z1: mz(r[1]), x2: mx(r[2]), z2: mz(r[3]) });
const inRect = (m, x, z, pad = 0) => x >= m.x1 - pad && x <= m.x2 + pad && z >= m.z1 - pad && z <= m.z2 + pad;

const TYPE_COLORS = {
  class: '#fff1bf', office: '#cfe2ff', special: '#cdeccd', kinder: '#ffd6e8',
  wc: '#dcdcdc', storage: '#e6e0d4', hall: '#ffdcb0', garden: '#a9d68f',
  corridor: '#f1ece3', stair: '#cdb89a', outdoor: '#b9dca0',
};
const TYPE_NAMES = {
  class: '班級教室', office: '行政 / 辦公室', special: '專科教室', kinder: '幼兒園',
  wc: '廁所', storage: '儲藏室', hall: '大型空間', garden: '戶外空間',
};
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const className = (code) => `${CN[+code[0]]}年${CN[+code.slice(1)] ?? +code.slice(1)}班`;

/* ---------------- 資料整理 ---------------- */

const floors = D.floors.map((f, idx) => ({
  ...f, idx, y: f.level * FLOOR_H + BASE, rooms: [], walk: [], segs: [], stairs: [], boxes: [],
  group: new THREE.Group(), labels: new THREE.Group(), navGroup: new THREE.Group(), grid: null,
}));
const floorById = Object.fromEntries(floors.map((f) => [f.id, f]));

const rooms = [];
const usedIds = new Set();
for (const r of D.rooms) {
  const f = floorById[r.floor];
  const room = {
    ...r, f, m: rectM(r.rect),
    display: r.code ? className(r.code) : r.name,
    sub: r.code ? `${r.code} 班 · 教室 ${r.no}` : (r.no ? `教室 ${r.no}` : ''),
  };
  room.cx = (room.m.x1 + room.m.x2) / 2;
  room.cz = (room.m.z1 + room.m.z2) / 2;
  let id = r.code || (r.no ? `${r.floor}-${r.no}` : `${r.floor}-${r.name}`);
  while (usedIds.has(id)) id += '+';
  usedIds.add(id);
  room.id = id;
  rooms.push(room);
  f.rooms.push(room);
  f.walk.push({ m: room.m, kind: 'room', room });
}
for (const f of floors) {
  for (const c of D.corridors[f.id] || []) {
    const o = Array.isArray(c) ? { rect: c } : c;     // 走廊可以只寫座標，或寫成 { rect, noCeil, bleacher }
    f.walk.push({ m: rectM(o.rect), kind: 'corridor', noCeil: o.noCeil, bleacher: o.bleacher });
  }
  if (f.level === 0) f.walk.push({ m: rectM(D.outdoor.walk), kind: 'outdoor' });
}
const stairs = D.stairs.map((s) => ({ ...s, m: rectM(s.rect) }));
for (const s of stairs) {
  s.cx = (s.m.x1 + s.m.x2) / 2; s.cz = (s.m.z1 + s.m.z2) / 2;
  for (const fid of s.floors) {
    floorById[fid].stairs.push(s);
    floorById[fid].walk.push({ m: s.m, kind: 'stair', stair: s });
  }
}

function isWalkable(f, x, z, pad = 0.12) {
  for (const w of f.walk) if (inRect(w.m, x, z, pad)) return true;
  return false;
}

/* ---------------- 樓梯幾何（U 型折返樓梯，可以真的走上去） ----------------
 * 從入口端（靠走廊那端）進去：A 道（左）往上爬半層到最裡面的平台，轉身從 B 道（右）爬回入口端上方，就到上一層。
 * u = 從入口端往裡面的距離，v = 橫向距離（0 在 A 道那側）。入口有一段平地（s0），最裡面是平台（f1～L）。
 */
for (const s of stairs) {
  if (s.elevator) continue;
  const m = s.m, alongX = (m.x2 - m.x1) >= (m.z2 - m.z1);
  // 入口端：哪一端外面接著走廊、房間比較多就是哪一端（資料上的 reverse 只在分不出來時用）
  let lo = 0, hi = 0;
  for (const fid of s.floors) {
    const f = floorById[fid];
    for (let k = 0.1; k < 0.95; k += 0.1) {
      const t = alongX ? m.z1 + (m.z2 - m.z1) * k : m.x1 + (m.x2 - m.x1) * k;
      const hit = (x, z) => f.walk.some((w) => w.kind !== 'outdoor' && w.stair !== s && inRect(w.m, x, z));
      if (alongX ? hit(m.x1 - 0.5, t) : hit(t, m.z1 - 0.5)) lo++;
      if (alongX ? hit(m.x2 + 0.5, t) : hit(t, m.z2 + 0.5)) hi++;
    }
  }
  const dir = lo === hi ? (s.reverse ? -1 : 1) : (lo > hi ? 1 : -1);
  const L = alongX ? m.x2 - m.x1 : m.z2 - m.z1, Wd = alongX ? m.z2 - m.z1 : m.x2 - m.x1;
  const u0 = alongX ? (dir > 0 ? m.x1 : m.x2) : (dir > 0 ? m.z1 : m.z2), v0 = alongX ? m.z1 : m.x1;
  const s0 = Math.min(1.2, L * 0.16), f1 = L - Math.min(1.6, L * 0.22);
  s.g = {
    alongX, L, Wd, s0, f1, dir,
    toUV: (x, z) => (alongX ? [(x - u0) * dir, z - v0] : [(z - u0) * dir, x - v0]),
    toXZ: (u, v) => (alongX ? [u0 + u * dir, v0 + v] : [v0 + v, u0 + u * dir]),
  };
  // 入口中間（導航走到這裡）
  [s.ex, s.ez] = s.g.toXZ(s0 * 0.5, Wd / 2);
}
const stairNext = (s, f) => floorById[s.floors[s.floors.indexOf(f.id) + 1]];
const stairPrev = (s, f) => floorById[s.floors[s.floors.indexOf(f.id) - 1]];
// 樓梯上某一點的高度（相對這層地板）。同一個位置上下可能各有一段樓梯，取最接近目前高度的那段
function stairHeight(s, f, x, z, cur) {
  const g = s.g, [u, v] = g.toUV(x, z), H = FLOOR_H, up = !!stairNext(s, f), down = !!stairPrev(s, f);
  if (u < g.s0) return 0;
  const k = Math.min(1, (u - g.s0) / (g.f1 - g.s0));
  if (u >= g.f1) return up ? H / 2 : -H / 2;                     // 平台
  if (v < g.Wd / 2) return up ? (H / 2) * k : 0;                  // A 道：往上半層
  const c = [];                                                   // B 道：往上（平台→上一層）或往下（這層→下面的平台）
  if (up) c.push(H - (H / 2) * k);
  if (down) c.push(-(H / 2) * k);
  if (!c.length) return 0;
  return c.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a));
}

/* ---------------- 牆與欄杆 ---------------- */

function lighten(hex, amt) {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color('#ffffff'), amt);
}

// 教室、辦公室（每一層）：只有前後（門那面和對面）有窗，左右跟隔壁房間共用的牆是實牆（依使用者說明）
function sideIsSolid(room, s) {
  const doors = room.doors || '';
  const ns = /[NS]/.test(doors), ew = /[EW]/.test(doors);
  if (ns === ew) return false;                                 // 門的方向不明確就照舊
  if (ns ? 'NS'.includes(s) : 'EW'.includes(s)) return false;  // 前後
  const m = room.m, E = 0.3;
  const others = [...rooms.filter((r) => r !== room && r.f === room.f && !r.open && !r.hidden), ...room.f.stairs];
  return others.some((r) => {
    const o = r.m;
    if (s === 'W' || s === 'E') {
      const x = s === 'W' ? m.x1 : m.x2;
      return Math.abs((s === 'W' ? o.x2 : o.x1) - x) < E && Math.min(o.z2, m.z2) - Math.max(o.z1, m.z1) > 1;
    }
    const z = s === 'N' ? m.z1 : m.z2;
    return Math.abs((s === 'N' ? o.z2 : o.z1) - z) < E && Math.min(o.x2, m.x2) - Math.max(o.x1, m.x1) > 1;
  });
}

// 1 樓溪口情廊（敬業樓中間那條走廊）兩側的牆（依照片）：圖書館、會議室是落地窗，其他教室沒有窗，
//   是米白石紋牆＋白框布告欄（黃色牛皮紙、照片、藍色紙花）＋上方一排氣窗。gallery 的值是走廊在 z 的哪一側
// 敬業樓一樓壁畫（依照片）：
//   forestA／forestB：國際性平牆（西側走廊）的森林壁畫；sdg：幸運方塘外牆（世界地圖＋SDGs）；world：油印室外牆（世界地標＋泡泡展示板）
const muralMat = (() => {
  const cache = {};
  const draw = {
    forest(c, w, h, variant) {
      c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h);
      let s = variant === 'A' ? 3 : 9; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 7; i++) {                                         // 淺灰色素描樹
        const x = 60 + rnd() * (w - 120);
        c.strokeStyle = '#b8b8b2'; c.lineWidth = 14; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 6, 20); c.stroke();
        c.lineWidth = 4; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + 4, 60 + k * 30); c.lineTo(x + (k % 2 ? 50 : -50), 30 + k * 30); c.stroke(); }
      }
      for (let i = 0; i < 6; i++) {                                         // 深咖啡色樹幹（有分枝）
        const x = 40 + i * (w - 80) / 5 + (rnd() - 0.5) * 30;
        c.fillStyle = i % 2 ? '#4a3a32' : '#5b4436'; c.fillRect(x - 16, 0, 32, h);
        c.strokeStyle = c.fillStyle; c.lineWidth = 12;
        c.beginPath(); c.moveTo(x, 90); c.lineTo(x + (i % 2 ? 70 : -70), 20); c.stroke();
      }
      c.fillStyle = '#7f9a3a'; for (let i = 0; i < 60; i++) { c.beginPath(); c.ellipse(rnd() * w, rnd() * h * 0.6, 6, 3, rnd() * 3, 0, Math.PI * 2); c.fill(); }   // 葉子
      // 動物：粉紅灰豬、綠色馬／大象、熊
      const pig = (x, y) => { c.fillStyle = '#b9b9bd'; c.beginPath(); c.ellipse(x, y, 34, 30, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f2a7b4'; c.beginPath(); c.ellipse(x + 14, y + 6, 14, 10, 0, 0, Math.PI * 2); c.fill(); c.fillRect(x - 24, y - 50, 10, 26); };
      const green = (x, y) => { c.fillStyle = '#7c9a3a'; c.fillRect(x - 40, y - 20, 80, 40); c.fillRect(x + 30, y - 50, 22, 40); c.fillRect(x - 36, y + 20, 10, 28); c.fillRect(x + 22, y + 20, 10, 28); };
      const bear = (x, y, coat) => { c.fillStyle = coat; c.fillRect(x - 32, y - 10, 64, 80); c.fillStyle = '#5a5a5e'; c.beginPath(); c.arc(x, y - 30, 30, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f4f1ea'; c.fillRect(x - 22, y + 10, 30, 22); };
      if (variant === 'A') { pig(w * 0.42, h * 0.55); green(w * 0.6, h * 0.62); bear(w * 0.86, h * 0.5, '#f2b6c4'); }
      else { bear(w * 0.2, h * 0.55, '#a9c8e6'); pig(w * 0.52, h * 0.6); green(w * 0.74, h * 0.66); }
      c.fillStyle = '#2b2b2b'; c.font = '700 34px sans-serif'; c.textAlign = 'center';
      if (variant === 'A') c.fillText('LIVE YOUR DREAM', w * 0.6, h * 0.36);
      else { c.textAlign = 'left'; c.fillText('BE GOOD.', w * 0.58, h * 0.3); c.fillText('BE HAPPY.', w * 0.58, h * 0.42); c.fillText('BE YOURSELF.', w * 0.58, h * 0.54); }
      c.fillStyle = '#3f3f42';                                             // 下方深灰色小山（立體切板）
      for (const [x, r] of [[w * 0.3, 150], [w * 0.62, 120], [w * 0.9, 110], [w * 0.05, 90]]) { c.beginPath(); c.arc(x, h + 30, r, Math.PI, 0); c.fill(); }
      if (variant === 'A') {                                               // 深色柱子＋牌匾（字太小看不清，只畫金色字行）
        c.fillStyle = '#3c3a3a'; c.fillRect(w * 0.16, 0, 110, h);
        c.fillStyle = '#151515'; c.fillRect(w * 0.16 + 14, h * 0.32, 82, 76);
        c.fillStyle = '#c9a54a'; for (let i = 0; i < 9; i++) c.fillRect(w * 0.16 + 20 + i * 8, h * 0.32 + 6, 3, 64);
      }
    },
    sdg(c, w, h) {
      c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#bfe0f2'; c.beginPath(); c.arc(w * 0.5, h * 1.25, w * 0.42, Math.PI, 0); c.fill();   // 地球弧線
      c.fillStyle = '#d6ebf5'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(w * (0.25 + i * 0.06), h * (0.35 + (i % 3) * 0.08), 30, 14, 0.4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(w * 0.32, h * 0.12, 50, 16, 0, 0, Math.PI * 2); c.fill();   // 雲
      for (let i = 0; i < 3; i++) {                                        // 白框窗戶
        const x = w * 0.34 + i * w * 0.15, y = 8, ww = w * 0.14, hh = h * 0.55;
        c.fillStyle = '#ffffff'; c.fillRect(x, y, ww, hh);
        c.fillStyle = '#c9d6df'; c.fillRect(x + 6, y + 6, ww / 2 - 9, hh * 0.62); c.fillRect(x + ww / 2 + 3, y + 6, ww / 2 - 9, hh * 0.62);
        c.fillRect(x + 6, y + hh * 0.7, ww / 2 - 9, hh * 0.26); c.fillRect(x + ww / 2 + 3, y + hh * 0.7, ww / 2 - 9, hh * 0.26);
      }
      c.fillStyle = '#7fc6e6'; c.fillRect(0, h * 0.62, w, h * 0.38);        // 下方淺藍色波浪帶
      const cols = ['#e5243b', '#dda63a', '#4c9f38', '#c5192d', '#ff3a21', '#26bde2', '#fcc30b', '#a21942', '#fd6925', '#dd1367', '#fd9d24', '#bf8b2e', '#3f7e44', '#0a97d9', '#56c02b', '#00689d', '#19486a'];
      cols.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(w * 0.08 + (i % 9) * w * 0.058, h * (0.72 + Math.floor(i / 9) * 0.15), 15, 0, Math.PI * 2); c.fill(); });
      c.fillStyle = '#1f6fb0'; c.font = '700 22px sans-serif'; c.textAlign = 'left'; c.fillText('SUSTAINABLE DEVELOPMENT GOALS', w * 0.06, h * 0.68);
      c.fillStyle = '#e8923a';                                             // 右邊各國地標剪影
      for (const [x, ww, hh] of [[0.78, 20, 120], [0.84, 60, 50], [0.9, 30, 90], [0.95, 40, 60]]) c.fillRect(w * x, h * 0.62 - hh, ww, hh);
    },
    world(c, w, h) {
      c.fillStyle = '#cfe8e2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2df8a'; c.beginPath(); c.moveTo(w * 0.62, 0); c.quadraticCurveTo(w * 0.75, h * 0.25, w, h * 0.2); c.lineTo(w, 0); c.fill();   // 右上黃色天空
      c.fillStyle = '#eef0f2'; c.fillRect(w * 0.82, h * 0.08, 60, 14); c.fillRect(w * 0.84, h * 0.04, 10, 24);   // 飛機
      c.fillStyle = '#ffffff';                                             // 白色泡泡展示板（一圈圈圓洞）
      c.beginPath(); c.ellipse(w * 0.3, h * 0.5, w * 0.2, h * 0.42, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(w * 0.52, h * 0.42, w * 0.11, h * 0.3, 0, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 14; i++) {
        const x = w * 0.16 + (i % 5) * w * 0.07, y = h * 0.2 + Math.floor(i / 5) * h * 0.27;
        c.fillStyle = '#bfe0d8'; c.beginPath(); c.arc(x, y, 22, 0, Math.PI * 2); c.fill();
        if (i % 2 === 0) { c.fillStyle = '#ffffff'; c.fillRect(x - 14, y - 10, 28, 20); c.fillStyle = '#e8a33a'; c.fillRect(x - 12, y - 8, 24, 5); }
      }
      c.fillStyle = '#6fa8a0';                                             // 地標：台北 101、中正紀念堂、泰姬瑪哈陵
      c.fillRect(w * 0.66, h * 0.15, 26, h * 0.5); c.fillRect(w * 0.6, h * 0.4, 70, 40);
      c.fillStyle = '#e6d9b8'; c.fillRect(w * 0.08, h * 0.03, 70, 30); c.beginPath(); c.arc(w * 0.08 + 35, h * 0.03, 18, Math.PI, 0); c.fill();
      c.fillStyle = '#c0392b'; c.fillRect(w * 0.55, h * 0.82, 60, 24); c.fillStyle = '#2f5aa8'; c.fillRect(w * 0.63, h * 0.82, 56, 24);   // 小火車
      c.fillStyle = '#e5b25a'; c.fillRect(0, h * 0.94, w, h * 0.06);
    },
  };
  return (kind) => cache[kind] ||= new THREE.MeshLambertMaterial({ map: (() => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 320;
    const c = cv.getContext('2d');
    if (kind === 'forestA') draw.forest(c, 1024, 320, 'A'); else if (kind === 'forestB') draw.forest(c, 1024, 320, 'B'); else draw[kind](c, 1024, 320);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })() });
})();
function galleryWall(room, s) {
  if (room.floor !== '1F' || room.building !== 'A') return {};
  // 國際性平牆（西側走廊）：森林壁畫，北邊幸運方塘「BE GOOD」、南邊油印室「LIVE YOUR DREAM」
  if (s === 'W' && Math.abs(room.m.x1 - mx(705)) < 0.3) return { mural: room.name.includes('幸運方塘') ? 'forestB' : 'forestA', face: -1 };
  if (room.name.includes('幸運方塘') && s === 'S') return { mural: 'sdg', face: 1 };     // 世界地圖＋SDGs、前面白色矮櫃
  if (room.name === '油印室' && s === 'N') return { mural: 'world', face: -1 };           // 世界地標＋泡泡展示板
  const north = s === 'S' && Math.abs(room.m.z2 - mz(330)) < 0.3;        // 走廊北邊的教室（南牆面向走廊）
  const south = s === 'N' && Math.abs(room.m.z1 - mz(398)) < 0.3;        // 走廊南邊的教室（北牆面向走廊）
  if (!north && !south) return {};
  if (room.name === '圖書館' || room.name === '會議室') return { fullGlass: true };
  return { gallery: north ? 1 : -1 };
}
const galleryWallMat = (() => {
  let m;
  return () => m ||= new THREE.MeshLambertMaterial({ map: (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#ece5d5'; c.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 16; r++) {                                       // 細長的石紋磚
      const y = r * 4, off = (r % 2) * 9;
      c.fillStyle = 'rgba(150,135,110,.35)'; c.fillRect(0, y, 64, 1);
      for (let x = off; x < 64; x += 18) c.fillRect(x, y, 1, 4);
      for (let k = 0; k < 6; k++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; c.fillRect(Math.random() * 64, y + 1, 4 + Math.random() * 6, 2); }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })() });
})();
const galleryBoardMat = (() => {
  const cache = {};
  return (k) => cache[k] ||= new THREE.MeshLambertMaterial({ map: (() => {
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 264;
    const c = cv.getContext('2d'); let s = 11 + k * 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    c.fillStyle = '#e3c06a'; c.fillRect(0, 0, 384, 264);                   // 黃色牛皮紙
    c.fillStyle = 'rgba(120,80,20,.08)'; for (let i = 0; i < 200; i++) c.fillRect(rnd() * 384, rnd() * 264, 3, 3);
    const top = k === 0 ? 70 : 20;
    if (k === 0) {                                                        // 標題（照片上看得到：溪口、游於藝）
      c.fillStyle = '#c0392b'; c.font = '900 34px "Noto Sans TC", sans-serif'; c.fillText('溪口', 24, 48);
      c.fillStyle = '#ffffff'; c.fillRect(250, 18, 110, 38);
      c.fillStyle = '#2b2b2b'; c.font = '700 24px "Noto Sans TC", sans-serif'; c.fillText('游於藝', 262, 46);
      c.fillStyle = '#2f5aa8'; for (let x = 0; x < 384; x += 16) c.fillRect(x, 252, 10, 6);
    }
    const cols = ['#b9573f', '#7a6a58', '#c98a5a', '#5d6f7d', '#a35a4a', '#8a7d6b'];
    const rows = k === 0 ? 3 : 4, perRow = 4;
    for (let r = 0; r < rows; r++) for (let i = 0; i < perRow; i++) {    // 貼著的活動照片
      const w = 62, h = 44, x = 22 + i * 90 + (rnd() - 0.5) * 18, y = top + r * ((264 - top - 20) / rows) + (rnd() - 0.5) * 8;
      c.fillStyle = '#f4f1ea'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
      c.fillStyle = cols[(r * 4 + i + k) % cols.length]; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, w, h / 3);
    }
    for (let i = 0; i < 6; i++) {                                         // 藍色紙花
      const x = 30 + rnd() * 324, y = 20 + rnd() * 224;
      c.fillStyle = rnd() < 0.5 ? '#2f5fc4' : '#7b7fd6';
      for (let p = 0; p < 5; p++) { const a = p * Math.PI * 2 / 5; c.beginPath(); c.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })() });
})();
function addRoomWalls(room) {
  if (room.endWall === 'E') {
    // 穿堂東端（依照片）：中間一道主題牆，兩側各留約 1.2 公尺通道往中庭
    const { x2, z1, z2 } = room.m, gap = 1.25;
    room.f.segs.push({ ax: x2, az: z1 + gap, bx: x2, bz: z2 - gap, h: WALL_H, color: new THREE.Color('#dddddd'), kind: 'wall', bld: room.building });
  }
  if (room.open) return;
  const f = room.f, { x1, z1, x2, z2 } = room.m;
  const doors = room.doors || '';
  const color = room.building ? lighten(D.buildings[room.building].color, 0.35) : new THREE.Color('#dddddd');
  const side = (s, ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    let gaps = [];
    if (doors.includes(s)) {
      const at = room.doorAt?.[s] || (len > 6.5 ? [0.18, 0.82] : [0.5]);
      const w = room.doorW?.[s] ?? Math.min(1.6, len * 0.45);
      gaps = at.map((c) => [Math.max(0.15, c * len - w / 2), Math.min(len - 0.15, c * len + w / 2)]);
    }
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    // 記下門的位置（掛門牌用）
    for (const [a, b] of gaps) (room.doorPts ||= []).push({ x: ax + ux * (a + b) / 2, z: az + uz * (a + b) / 2, side: s });
    // 挑高的空間（活動中心）：牆一路蓋到上一層的天花板
    const h = room.tall ? FLOOR_H + WALL_H : WALL_H;
    const above = room.tall ? floors[f.idx + 1] : null;
    const solid = sideIsSolid(room, s);
    const gal = galleryWall(room, s);
    const seg = (a, b, extra) => ({ ax: ax + ux * a, az: az + uz * a, bx: ax + ux * b, bz: az + uz * b, h, color, kind: 'wall', bld: room.building, solid, ground: room.ground, ...gal, ...extra });
    const push = (a, b) => {
      if (b - a <= 0.05) return;
      f.segs.push(seg(a, b));
      if (above) above.segs.push(seg(a, b, { noRender: true }));   // 上一層也要擋得住（只算碰撞，不重複畫）
    };
    let t = 0;
    for (const [a, b] of gaps) {
      push(t, a); t = b;
      // 挑高空間的門：門上方補一段牆（門楣），上一層同位置留開口通往看台
      if (room.tall) f.segs.push(seg(a, b, { y0: 2.4, h: FLOOR_H, overhead: true }));
    }
    push(t, len);
  };
  side('N', x1, z1, x2, z1); side('S', x1, z2, x2, z2);
  side('W', x1, z1, x1, z2); side('E', x2, z1, x2, z2);
}

function addRailings(f) {
  if (f.level === 0) return;                         // 1 樓可以走到戶外
  const color = new THREE.Color('#9aa7b0');
  const STEP = 0.25, OUT = 0.3;
  for (const w of f.walk) {
    if (w.kind === 'room' && !w.room.open) continue;
    const { x1, z1, x2, z2 } = w.m;
    const sides = [
      [x1, z1, x2, z1, 0, -1], [x1, z2, x2, z2, 0, 1],
      [x1, z1, x1, z2, -1, 0], [x2, z1, x2, z2, 1, 0],
    ];
    for (const [ax, az, bx, bz, nx, nz] of sides) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / STEP));
      let start = -1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        const open = i < n && !isWalkable(f, px + nx * OUT, pz + nz * OUT, 0);
        if (open && start < 0) start = i;
        if (!open && start >= 0) {
          const t0 = start / n, t1 = i / n;
          const seg = { ax: ax + (bx - ax) * t0, az: az + (bz - az) * t0, bx: ax + (bx - ax) * t1, bz: az + (bz - az) * t1, h: RAIL_H, color, kind: 'rail' };
          // 樓梯間外側是有窗的牆，不是矮欄杆
          if (w.kind === 'stair') Object.assign(seg, { h: WALL_H, kind: 'wall', bld: w.stair.building });
          f.segs.push(seg);
          start = -1;
        }
      }
    }
  }
}

for (const r of rooms) addRoomWalls(r);
// 電梯：三面是牆，門那一面只留門口（都只算碰撞，外觀在 buildElevator 畫）
for (const s of stairs) {
  if (!s.elevator || !s.door) continue;
  const m = s.m, color = new THREE.Color('#d9c9a8');
  for (const fid of s.floors) {
    const f = floorById[fid], add = (ax, az, bx, bz) => f.segs.push({ ax, az, bx, bz, h: WALL_H, color, kind: 'wall', noRender: true });
    add(m.x1, m.z1, m.x2, m.z1); add(m.x1, m.z2, m.x2, m.z2); add(m.x1, m.z1, m.x1, m.z2);
    const zc = (m.z1 + m.z2) / 2;
    add(m.x2, m.z1, m.x2, zc - 0.6); add(m.x2, zc + 0.6, m.x2, m.z2);
  }
}
// 1 樓的樓梯間：資料上標記 wall1F 的那一面是牆（例如丙梯西側，不能直接走到外面）
for (const s of stairs) {
  if (!s.wall1F || !s.floors.includes('1F')) continue;
  const f = floorById['1F'], m = s.m;
  const ends = { W: [m.x1, m.z1, m.x1, m.z2], E: [m.x2, m.z1, m.x2, m.z2], N: [m.x1, m.z1, m.x2, m.z1], S: [m.x1, m.z2, m.x2, m.z2] };
  for (const side of s.wall1F) {
    const [ax, az, bx, bz] = ends[side];
    f.segs.push({ ax, az, bx, bz, h: WALL_H, color: lighten(D.buildings[s.building].color, 0.35), kind: 'wall', bld: s.building });
  }
}
// 樓梯間：中間隔牆（兩道樓梯中間，到平台才能轉身）、兩側和最裡面的牆；
// 最底層擋住 B 道下面（那裡是往上那段樓梯的底下），最頂層擋住 A 道（沒有再往上了）
for (const s of stairs) {
  if (!s.g) continue;
  const g = s.g, color = lighten(D.buildings[s.building]?.color || '#dddddd', 0.35);
  for (const fid of s.floors) {
    const f = floorById[fid];
    const add = (u1, v1, u2, v2, extra) => {
      const [ax, az] = g.toXZ(u1, v1), [bx, bz] = g.toXZ(u2, v2);
      f.segs.push({ ax, az, bx, bz, h: WALL_H, color, kind: 'wall', bld: s.building, solid: true, stairWall: true, ...extra });
    };
    // 中間隔牆：一路蓋到上一層（每層接起來）；最頂層只剩欄杆
    add(g.s0, g.Wd / 2, g.f1, g.Wd / 2, stairNext(s, f) ? { h: FLOOR_H } : { kind: 'rail', h: RAIL_H });
    // 兩側、最裡面（入口那段平地兩側不擋，5F 菜園從側邊出去；隔壁房間的門開在側邊入口附近時也讓開）
    const sideStart = (v) => {
      let u1 = g.s0;
      for (const r of f.rooms) for (const d of r.doorPts || []) {
        const [du, dv] = g.toUV(d.x, d.z);
        if (Math.abs(dv - v) > 0.35 || du < 0 || du > g.L) continue;
        const len = 'NS'.includes(d.side) ? r.m.x2 - r.m.x1 : r.m.z2 - r.m.z1;
        u1 = Math.max(u1, du + (r.doorW?.[d.side] ?? Math.min(1.6, len * 0.45)) / 2);
      }
      return u1;
    };
    add(sideStart(0), 0, g.L, 0, { noRender: true });
    add(sideStart(g.Wd), g.Wd, g.L, g.Wd, { noRender: true });
    add(g.L, 0, g.L, g.Wd, { noRender: true });
    // 1 樓、地下室沒有自動加的欄杆／外牆：樓梯間外圍沒被房間、走廊、別的牆擋住的地方，補上看得到的牆
    if (f.level <= 0) {
      const covered = (x, z) => f.segs.some((q) => !q.noRender && !q.stairWall
        && Math.abs((q.bx - q.ax) * (z - q.az) - (q.bz - q.az) * (x - q.ax)) / Math.hypot(q.bx - q.ax, q.bz - q.az) < 0.05
        && x >= Math.min(q.ax, q.bx) - 0.05 && x <= Math.max(q.ax, q.bx) + 0.05 && z >= Math.min(q.az, q.bz) - 0.05 && z <= Math.max(q.az, q.bz) + 0.05);
      const outside = (x, z) => f.walk.some((w) => w.kind !== 'outdoor' && w.stair !== s && inRect(w.m, x, z));
      for (const [u1, v1, u2, v2, nu, nv] of [[g.s0, 0, g.L, 0, 0, -1], [g.s0, g.Wd, g.L, g.Wd, 0, 1], [g.L, 0, g.L, g.Wd, 1, 0]]) {
        const len = Math.hypot(u2 - u1, v2 - v1), n = Math.max(1, Math.round(len / 0.25));
        let start = -1;
        for (let i = 0; i <= n; i++) {
          const u = u1 + (u2 - u1) * (i / n), v = v1 + (v2 - v1) * (i / n);
          const [x, z] = g.toXZ(u, v), [ox, oz] = g.toXZ(u + nu * 0.3, v + nv * 0.3);
          const open = i < n && !covered(x, z) && !outside(ox, oz);
          if (open && start < 0) start = i;
          if (!open && start >= 0) {
            add(u1 + (u2 - u1) * (start / n), v1 + (v2 - v1) * (start / n), u1 + (u2 - u1) * (i / n), v1 + (v2 - v1) * (i / n), { h: FLOOR_H, solid: false });
            start = -1;
          }
        }
      }
    }
    if (!stairPrev(s, f)) add(g.s0, g.Wd / 2, g.s0, g.Wd, { kind: 'rail', h: RAIL_H });
    if (!stairNext(s, f)) add(g.s0, 0, g.s0, g.Wd / 2, { kind: 'rail', h: RAIL_H });
  }
}
for (const f of floors) addRailings(f);
// 1 樓戶外墊高的地方（司令臺、花台）：{ x1, x2, z1, z2, h }，h 是離地面的高度
const raised = [];
// 一樓「室內」（建築裡：走廊、教室、穿堂、樓梯間）；中庭花園不算
function indoor1F(x, z) {
  for (const w of floorById['1F'].walk) if (w.kind !== 'outdoor' && w.room?.type !== 'garden' && !w.room?.ground && inRect(w.m, x, z)) return true;
  return false;
}
// 一樓走廊、穿堂外面直接通到戶外的邊（這裡會有往下的階梯）：{ ax, az, bx, bz, nx, nz }，n 是往外的方向
let openEdges = null;
function computeOpenEdges() {
  const f = floorById['1F'], out = [], STEP = 0.25;
  for (const w of f.walk) {
    if (w.kind === 'outdoor' || w.kind === 'stair' || w.room?.type === 'garden') continue;
    if (w.kind === 'room' && !w.room.open) continue;             // 有牆的教室不做階梯
    const { x1, z1, x2, z2 } = w.m;
    for (const [ax, az, bx, bz, nx, nz] of [[x1, z1, x2, z1, 0, -1], [x1, z2, x2, z2, 0, 1], [x1, z1, x1, z2, -1, 0], [x2, z1, x2, z2, 1, 0]]) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / STEP));
      let start = -1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, ox = px + nx * 0.4, oz = pz + nz * 0.4;
        const open = i < n && !indoor1F(ox, oz) && isWalkable(f, ox, oz, 0);
        if (open && start < 0) start = i;
        if (!open && start >= 0) {
          out.push({ ax: ax + (bx - ax) * start / n, az: az + (bz - az) * start / n, bx: ax + (bx - ax) * i / n, bz: az + (bz - az) * i / n, nx, nz });
          start = -1;
        }
      }
    }
  }
  return out;
}
const STEP_H = 0.3, STEP_D = 0.32, NSTEP = Math.round(BASE / STEP_H);
// 地面高度（相對於這一層的樓板）：一樓室內 0、戶外 -BASE；司令臺、花台、走廊邊的階梯會比較高
function groundAt(f, x, z) {
  if (f.level !== 0) return 0;
  if (indoor1F(x, z)) return 0;
  let h = -BASE;
  for (const r of raised) if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) h = Math.max(h, r.h - BASE);
  openEdges ||= computeOpenEdges();
  for (const e of openEdges) {
    const d = (x - e.ax) * e.nx + (z - e.az) * e.nz;
    if (d < 0 || d >= NSTEP * STEP_D) continue;
    const t = e.nx ? z : x, a = e.nx ? Math.min(e.az, e.bz) : Math.min(e.ax, e.bx), b = e.nx ? Math.max(e.az, e.bz) : Math.max(e.ax, e.bx);
    if (t < a || t > b) continue;
    h = Math.max(h, -BASE + (NSTEP - Math.floor(d / STEP_D)) * STEP_H);
  }
  return Math.min(0, h);
}
// 一樓的地基（建築底下那一段牆腳）＋走廊、穿堂外面往下的階梯
function buildPlinth() {
  const f = floorById['1F'], b = new Batch();
  const plinth = mat('wool', '#d9cfbd'), stone = mat('wool', '#bdb7ad'), stone2 = mat('wool', '#aaa49a');
  for (const w of f.walk) {
    if (w.kind === 'outdoor' || w.room?.type === 'garden') continue;
    if (w.stair && w.stair.floors.includes('B1')) continue;     // 往地下室的樓梯：底下是空的
    if (w.room?.ground) continue;                               // 警衛室在地面，沒有地基
    const { x1, z1, x2, z2 } = w.m;
    b.box(plinth, x2 - x1, BASE - 0.12, z2 - z1, (x1 + x2) / 2, (BASE - 0.12) / 2, (z1 + z2) / 2);
  }
  openEdges ||= computeOpenEdges();
  for (const e of openEdges) {
    const len = Math.hypot(e.bx - e.ax, e.bz - e.az), cx = (e.ax + e.bx) / 2, cz = (e.az + e.bz) / 2;
    for (let i = 0; i < NSTEP; i++) {
      const h = (NSTEP - i) * STEP_H, d = (i + 0.5) * STEP_D, x = cx + e.nx * d, z = cz + e.nz * d;
      b.box(i % 2 ? stone2 : stone, e.nx ? STEP_D : len, h, e.nx ? len : STEP_D, x, h / 2, z);
    }
  }
  b.build(f.group);
}

// 圍牆的四段（公尺）：西邊避開正門兩側的樹籬（540～1110 像素那段）
function wallRuns() {
  const W = D.outdoor.wall, G = D.outdoor.gate;
  const [x1, z1, x2, z2] = [mx(W.x1), mz(W.y1), mx(W.x2), mz(W.y2)];
  const runs = [
    { ax: x1, az: z1, bx: x2, bz: z1, out: [0, -1] },          // 北
    { ax: x2, az: z1, bx: x2, bz: z2, out: [1, 0] },           // 東
    { ax: x1, az: z2, bx: x2, bz: z2, out: [0, 1] },           // 南
  ];
  // 西邊（正門那面）榕樹比較多：樹種得比較密；正門兩側樹籬那段沒有圍牆，但外面一樣有人行道和榕樹
  const west = { out: [-1, 0], treeGap: 9 };
  if (G && Math.abs(G.x - W.x1) < 1) {
    runs.push({ ax: x1, az: z1, bx: x1, bz: mz(540), ...west }, { ax: x1, az: mz(540), bx: x1, bz: mz(1110), noWall: true, ...west },
      { ax: x1, az: mz(1110), bx: x1, bz: z2, ...west });
  } else runs.push({ ax: x1, az: z1, bx: x1, bz: z2, ...west });
  return runs.map((r) => ({ ...r, street: true }));
}
// 戶外的牆：校門兩側的樹籬、操場南邊那棟建築（都會擋路，也會被導航避開）
{
  const O = D.outdoor, f1 = floorById['1F'];
  if (O.gate) {
    const x = mx(O.gate.x), color = new THREE.Color('#3f8f3a');
    f1.segs.push({ ax: x, az: mz(540), bx: x, bz: mz(O.gate.y1) - 0.7, h: 1.5, color, kind: 'hedge' });
    f1.segs.push({ ax: x, az: mz(O.gate.y2) + 0.7, bx: x, bz: mz(1110), h: 1.5, color, kind: 'hedge', noRender: true });   // 校門南邊：馬賽克壁畫牆（畫在 buildFrontYard）
  }
  if (O.wall) {
    // 校園圍牆：只算碰撞（外觀在 buildCampusWall 畫）；西邊正門那段（樹籬）不重複
    const color = new THREE.Color('#b5b2ab');
    for (const [ax, az, bx, bz] of wallRuns().filter((r) => !r.noWall).map((r) => [r.ax, r.az, r.bx, r.bz])) {
      f1.segs.push({ ax, az, bx, bz, h: 2.5, color, kind: 'wall', noRender: true });
    }
  }
  if (O.pond) {
    // 生態池：池邊擋住（不畫牆，只算碰撞），導航會繞過去
    const m = rectM(O.pond), color = new THREE.Color('#888888');
    for (const [ax, az, bx, bz] of [[m.x1, m.z1, m.x2, m.z1], [m.x1, m.z2, m.x2, m.z2], [m.x1, m.z1, m.x1, m.z2], [m.x2, m.z1, m.x2, m.z2]]) {
      f1.segs.push({ ax, az, bx, bz, h: 0.5, color, kind: 'wall', noRender: true });
    }
  }
  if (O.pool) {
    // 游泳館：白色浪板外牆（依照片），入口在北牆東端的藍色立面；西面是藍白條紋
    const m = rectM(O.pool), color = new THREE.Color('#eeeeee'), h = 6, [d0, d1] = poolDoor(m);
    for (const [ax, az, bx, bz] of [[m.x1, m.z1, d0, m.z1], [d1, m.z1, m.x2, m.z1], [m.x1, m.z2, m.x2, m.z2], [m.x2, m.z1, m.x2, m.z2]]) {
      f1.segs.push({ ax, az, bx, bz, h, color, kind: 'poolwall' });
    }
    f1.segs.push({ ax: m.x1, az: m.z1, bx: m.x1, bz: m.z2, h, color, kind: 'poolstripe' });
    // 入口東邊往北延伸的磁磚矮牆（畫在 extras.js）
    f1.segs.push({ ax: m.x2 - 0.3, az: m.z1 - 0.7, bx: m.x2 - 0.3, bz: m.z1 - 6.7, h: 1.2, color, kind: 'wall', noRender: true });
  }
}

/* ---------------- Three.js 場景 ---------------- */

const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !IS_TOUCH;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = BLOCKY ? '#8fc8ff' : '#bfe3ff';
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 130, 340);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(45, 75, 85);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.47;
orbit.minDistance = 8;
orbit.maxDistance = 220;

// 天空光 + 中性的地面反光（不要偏綠，室內天花板才不會發綠）+ 一點環境光讓室內不會太暗
scene.add(new THREE.HemisphereLight('#ffffff', '#c9bfae', 1.35));
scene.add(new THREE.AmbientLight('#ffffff', 0.45));
const sun = new THREE.DirectionalLight('#fff6e0', 1.6);
sun.position.set(-40, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 90, bottom: -60, near: 1, far: 260 });
scene.add(sun);

// 地面（方塊風：草地方塊，一格一公尺）
// 往地下室的樓梯（B 道＋平台）那裡要挖洞，不然草地會蓋住樓梯
const groundShape = new THREE.Shape([[-300, -300], [300, -300], [300, 300], [-300, 300]].map(([x, y]) => new THREE.Vector2(x, y)));
for (const s of stairs) {
  if (!s.g || !s.floors.includes('1F') || !stairPrev(s, floorById['1F'])) continue;
  const g = s.g, poly = [[g.s0, g.Wd / 2], [g.f1, g.Wd / 2], [g.f1, 0], [g.L, 0], [g.L, g.Wd], [g.s0, g.Wd]];
  groundShape.holes.push(new THREE.Path(poly.map(([u, v]) => { const [x, z] = g.toXZ(u, v); return new THREE.Vector2(x, -z); })));
}
const groundGeo = new THREE.ShapeGeometry(groundShape);
if (!BLOCKY) { const uv = groundGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 600 + 0.5, uv.getY(i) / 600 + 0.5); }
const ground = new THREE.Mesh(groundGeo, mat('grass', BLOCKY ? '#ffffff' : '#a7cf8c'));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

// 鳥瞰時：整個校園是一座浮空的方塊島（參考 DSLab 小島）；走路時外面照常是草地
const ISL = (() => { const w = D.outdoor.wall || { x1: 150, y1: 40, x2: 1960, y2: 2200 }; return { x1: mx(w.x1) - 17, x2: mx(w.x2) + 17, z1: mz(w.y1) - 17, z2: mz(w.y2) + 17 }; })();
{
  // 草地本體改成只鋪到島的範圍（樓梯的洞照舊）
  const top = new THREE.Shape([[ISL.x1, -ISL.z2], [ISL.x2, -ISL.z2], [ISL.x2, -ISL.z1], [ISL.x1, -ISL.z1]].map(([x, y]) => new THREE.Vector2(x, y)));
  top.holes = groundShape.holes;
  const geo = new THREE.ShapeGeometry(top);
  if (!BLOCKY) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 600 + 0.5, uv.getY(i) / 600 + 0.5); }
  ground.geometry.dispose(); ground.geometry = geo;
}
// 島外面的草地（走路時才顯示）
const outerShape = new THREE.Shape([[-300, -300], [300, -300], [300, 300], [-300, 300]].map(([x, y]) => new THREE.Vector2(x, y)));
outerShape.holes.push(new THREE.Path([[ISL.x1, -ISL.z2], [ISL.x1, -ISL.z1], [ISL.x2, -ISL.z1], [ISL.x2, -ISL.z2]].map(([x, y]) => new THREE.Vector2(x, y))));
const outerGeo = new THREE.ShapeGeometry(outerShape);
if (!BLOCKY) { const uv = outerGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 600 + 0.5, uv.getY(i) / 600 + 0.5); }
const outerGround = new THREE.Mesh(outerGeo, ground.material);
outerGround.rotation.x = -Math.PI / 2; outerGround.position.y = -0.05; outerGround.receiveShadow = true;
scene.add(outerGround);
// 島的側面與底部
const islandBody = (() => {
  const g = new THREE.Group();
  // 側面貼圖：一格一公尺。最上面一格是草皮邊、接著泥土、下面是石頭
  const sideTex = (rows) => {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16 * rows.length;
    const c = cv.getContext('2d'); let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    rows.forEach((kind, r) => {
      const base = { grass: '#7a5230', dirt: '#86592f', stone: '#7f7f7f', deep: '#5f5f63' }[kind];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let col = base;
        if (kind === 'grass' && y < 4 + (rnd() < 0.4 ? 1 : 0)) col = rnd() < 0.5 ? '#5fa33a' : '#6fb544';
        const v = (rnd() - 0.5) * 0.22;
        c.fillStyle = col; c.fillRect(x, r * 16 + y, 1, 1);
        c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; c.fillRect(x, r * 16 + y, 1, 1);
      }
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  const layer = (rows, inset, y0) => {
    const H = rows.length, W = ISL.x2 - ISL.x1 - inset * 2, Dp = ISL.z2 - ISL.z1 - inset * 2;
    const geo = new THREE.BoxGeometry(W, H, Dp), uv = geo.attributes.uv;
    const lens = [Dp, Dp, W, W, W, W];                     // +x -x +y -y +z -z 每一面的寬（公尺）
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setX(i, uv.getX(i) * lens[f]); }
    const side = new THREE.MeshLambertMaterial({ map: sideTex(rows) }), cap = new THREE.MeshLambertMaterial({ color: '#5f5f63' });
    const m = new THREE.Mesh(geo, [side, side, cap, cap, side, side]);
    m.position.set((ISL.x1 + ISL.x2) / 2, y0 - H / 2, (ISL.z1 + ISL.z2) / 2);
    g.add(m);
  };
  layer(['grass', 'dirt', 'dirt', 'dirt', 'dirt', 'stone', 'stone', 'stone', 'stone', 'deep', 'deep'], 0, -0.06);
  layer(['stone', 'stone', 'deep', 'deep', 'deep', 'deep'], 6, -11.06);
  layer(['deep', 'deep', 'deep', 'deep', 'deep'], 15, -17.06);
  layer(['deep', 'deep', 'deep', 'deep'], 28, -22.06);
  // 底下垂下來的石塊（方塊）
  let s = 21; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rock = [new THREE.MeshLambertMaterial({ color: '#6c6c70' }), new THREE.MeshLambertMaterial({ color: '#7d5634' }), new THREE.MeshLambertMaterial({ color: '#57575b' })];
  for (let i = 0; i < 70; i++) {
    const inset = 8 + rnd() * 26, t = rnd(), side = (rnd() * 4) | 0, sz = 2 + rnd() * 5, h = 2 + rnd() * 7;
    const W = ISL.x2 - ISL.x1 - inset * 2, Dp = ISL.z2 - ISL.z1 - inset * 2;
    let x = ISL.x1 + inset + t * W, z = ISL.z1 + inset + t * Dp;
    if (side === 0) z = ISL.z1 + inset; else if (side === 1) z = ISL.z2 - inset; else if (side === 2) x = ISL.x1 + inset; else x = ISL.x2 - inset;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sz, h, sz), rock[i % 3]);
    m.position.set(Math.round(x), -17 - h / 2 + rnd() * 2, Math.round(z));
    g.add(m);
  }
  g.visible = false;
  scene.add(g);
  return g;
})();
// 島下面的一層雲
const lowClouds = BLOCKY ? makeClouds(10, 200, -42) : null;
if (lowClouds) { lowClouds.visible = false; scene.add(lowClouds); }
function setIsland(on) {
  outerGround.visible = !on;
  islandBody.visible = on;
  if (lowClouds) lowClouds.visible = on;
}

// 樹（裝飾）
const treeSpots = [
  ...[[220, 980], [1850, 400], [1850, 900], [250, 1500], [1960, 1500], [220, 1900], [1980, 2000], [850, 2120]].map(([x, y]) => [x, y, 1.4]),
];
if (BLOCKY) {
  const tb = new Batch();
  Batch.collector = floors[1].boxes;
  for (const [x, y, s] of treeSpots) addBlockTree(tb, Math.round(mx(x)) + 0.5, Math.round(mz(y)) + 0.5, s);
  Batch.collector = null;
  tb.build(floors[1].group);
} else {
  for (const [x, y, s] of treeSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.6 * s), mat('log', '#8b5a2b'));
    trunk.position.set(mx(x), 0.8 * s, mz(y));
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s, 10, 8), mat('leaves'));
    crown.position.set(mx(x), 2.3 * s, mz(y));
    trunk.castShadow = crown.castShadow = true;
    floors[1].group.add(trunk, crown);
  }
}

// 方塊雲
const clouds = BLOCKY ? makeClouds() : null;
if (clouds) scene.add(clouds);

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const pickables = [];

// 戶外：操場、司令臺、遊戲場（位置為估計）
function buildOutdoor() {
  const O = D.outdoor, g = floors[1].group, est = O.estimated ? '（位置估計）' : '';
  const flat = (geo, color, y, kind = 'concrete') => {
    const m = new THREE.Mesh(geo, mat(kind, color));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
    g.add(m); return m;
  };
  const tiled = (w, d) => {   // 平面也讓材質一格一公尺
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    return geo;
  };
  if (O.track) {
    // 依照片：紅藍相間跑道、中間藍色籃球場、兩端草地圍網
    const cx = mx(O.track.center[0]), cz = mz(O.track.center[1]);
    buildField(g, cx, cz, O.track.size[0] / S / 2, O.track.size[1] / S / 2);
    floors[1].labels.add(makeTag('操場', 'SPORTS FIELD', cx, 0, cz, { accent: '#2d8a57', h: 4.2, stem: 4 }));
  }
  {
    // 中庭：敬業樓、勤學樓面向中庭的立面、會議室前小花台、電腦教室前沙坑（依照片）
    const court = rooms.find((r) => r.name === '中庭');
    if (court) raised.push(...buildCourtyard(g, court.m, FLOOR_H, BASE));
  }
  {
    // 教師停車場：乙梯北邊、敬業樓廁所南邊、圍牆和西側走廊之間的空地
    const px1 = mx(D.outdoor.wall?.x1 ?? 300) + 0.6, px2 = mx(645) - 0.7, pz1 = mz(230) + 0.3, pz2 = mz(475) - 0.4;
    buildParking(g, px1, px2, pz1, pz2);
    floors[1].labels.add(makeTag('教師停車場', 'PARKING', (px1 + px2) / 2, 0, (pz1 + pz2) / 2, { accent: '#2f6fb5', h: 2.6, stem: 3.5 }));
  }
  if (O.facadeC) {
    // 勤學樓背面、思源樓面向操場那面（依照片）
    const F = O.facadeC, st = rectM(O.stage);
    buildFacadeC(g, mx(F.x[0]), mx(F.x[1]), mz(F.y) + WALL_T / 2, 4, FLOOR_H, [st.x1, st.x2], BASE);
    raised.push(...buildMuralBlock(g, mx(F.mural[0]), mx(F.mural[1]), mx(F.mural[2]), mz(F.y) + WALL_T / 2, 4 * FLOOR_H, BASE));
  }
  if (O.pool) {
    // 條紋屋頂建築（牆已經在資料階段加進碰撞），這裡蓋屋頂
    const m = rectM(O.pool);
    raised.push(...buildPool(g, m, stripeRoofTexture(m.x2 - m.x1)));   // 入口階梯可以踩上去
    floors[1].labels.add(makeTag('水漾游泳館', 'SWIMMING POOL', (m.x1 + m.x2) / 2, 6.5, (m.z1 + m.z2) / 2, { accent: '#2f6fb5', h: 3.8, stem: 3 }));
  }
  if (O.wall) {
    // 校園圍牆＋牆外人行道（正門口、起點附近不種樹，免得擋路）
    const G = O.gate, avoid = G ? [[mx(G.x), mz((G.y1 + G.y2) / 2), 5.5]] : [];   // 正門口前面留通道
    buildCampusWall(g, wallRuns(), { avoid });
  }
  if (O.gate) {
    // 正門：兩根白柱子 + 彩虹拱門
    const gx = mx(O.gate.x), z1 = mz(O.gate.y1), z2 = mz(O.gate.y2), zc = (z1 + z2) / 2, half = (z2 - z1) / 2;
    const b = new Batch();
    for (const z of [z1, z2]) {
      b.box(mat('wool', '#f7f7f7'), 1.1, 3.4, 1.1, gx, 1.7, z);
      b.box(mat('wool', '#8e7cc3'), 1.4, 0.4, 1.4, gx, 3.6, z);
      b.box(mat('wool', '#e8d9a8'), 1.0, 0.9, 0.5, gx, 4.25, z);
    }
    const rainbow = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];
    rainbow.forEach((col, i) => {
      const r = half - i * 0.16, N = 28;
      for (let k = 0; k <= N; k++) {
        const t = Math.PI * k / N;
        b.box(mat('wool', col), 0.35, 0.18, 0.4, gx, 3.6 + Math.sin(t) * (1.5 - i * 0.12), zc - Math.cos(t) * r);
      }
    });
    b.build(g);
    floors[1].labels.add(makeTag('正門', 'MAIN GATE', gx - 1, 0, zc, { accent: '#c0392b', h: 3.2, stem: 5.5 }));
    // 校門口一帶（依照片）：左邊汽車停車場車道、右邊機車停車棚與馬賽克壁畫牆、穿堂入口雨遮與招牌
    const hall = rooms.find((r) => r.name === '穿堂'), guard = rooms.find((r) => r.name === '警衛室');
    const T = D.outdoor.track;
    raised.push(...buildFrontYard(g, {
      gx, gz1: z1, gz2: z2, hall: { x1: hall.m.x1, z1: hall.m.z1, z2: hall.m.z2 }, guard: guard.m, base: BASE,
      fieldZ: mz(T.center[1] - T.size[1] / 2), carLot: { z2: mz(475) - 0.4 },
    }));
    buildGuardHouse(g, guard.m, 0);
    floors[1].labels.add(makeTag('機車停車場', 'SCOOTERS', gx + 4, 0, z2 + 9, { accent: '#2f5aa8', h: 2.4, stem: 3.4 }));
  }
  if (O.tower) {
    // 正門左邊那座有圓窗的圓柱塔
    const T = O.tower, r = T.r / S, h = T.floors * FLOOR_H + BASE;
    const geo = new THREE.CylinderGeometry(r, r, h, BLOCKY ? 16 : 32, 1, true, Math.PI, Math.PI);
    if (BLOCKY) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * r, uv.getY(i) * h); }
    const cyl = new THREE.Mesh(geo, mat('concrete', '#efe0bf', { side: THREE.DoubleSide }));
    cyl.position.set(mx(T.cx), h / 2, mz(T.cy));
    cyl.castShadow = cyl.receiveShadow = true;
    g.add(cyl);
    for (let k = 1; k < T.floors; k++) {         // 圓窗
      const win = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), new THREE.MeshLambertMaterial({ color: '#41566b' }));
      win.rotation.z = Math.PI / 2;
      win.position.set(mx(T.cx) - r - 0.02, BASE + k * FLOOR_H + 1.6, mz(T.cy));
      g.add(win);
    }
  }
  if (O.stage) {
    const m = rectM(O.stage);
    raised.push(...buildStage(g, m));
    floors[1].labels.add(makeTag('司令臺', 'STAGE', (m.x1 + m.x2) / 2, 4.9, (m.z1 + m.z2) / 2 + 1, { accent: '#d9730d', h: 3.0, stem: 2.5 }));
  }
  if (O.playground) {
    const m = rectM(O.playground);
    // 遊戲場整組繞中心轉了 180 度：記下的方塊範圍也要跟著轉，碰撞位置才對
    const outer = Batch.collector, local = [];
    Batch.collector = local;
    buildPoolPlayground(g, m);
    Batch.collector = outer;
    const cx2 = m.x1 + m.x2, cz2 = m.z1 + m.z2;
    for (const b of local) outer?.push({ ...b, x1: cx2 - b.x2, x2: cx2 - b.x1, z1: cz2 - b.z2, z2: cz2 - b.z1 });
    floors[1].labels.add(makeTag('遊戲場', 'PLAYGROUND', (m.x1 + m.x2) / 2, 0, (m.z1 + m.z2) / 2, { accent: '#2d8a57', h: 3.0, stem: 6.5 }));
  }
}

function stripeRoofTexture(widthM) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 64;
  const c = cv.getContext('2d');
  const n = Math.round(widthM / 2.2);               // 依空拍：青綠 / 橘色交錯的浪板
  for (let i = 0; i < n; i++) {
    c.fillStyle = i % 2 ? '#d8955a' : '#5fa6a8';
    c.fillRect(i * 512 / n, 0, 512 / n + 1, 64);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const FLOOR_TEX = { class: 'terrazzo', corridor: 'terrazzo', hall: 'planks', storage: 'planks', stair: 'planks', garden: 'grass', kinder: 'wool' };
function floorMat(type, f, room) {
  if (type === 'garden' && f?.level === 4) {
    if (room?.building === 'A') return mat('roof', BLOCKY ? ROOF_COLOR.A : '#c9c9c9');   // 敬業樓藍色屋頂
    return mat('tile', '#cfc8ba');                                                        // 其他頂樓：地磚
  }
  const kind = FLOOR_TEX[type] || 'tile';
  const color = BLOCKY && (kind === 'grass' || kind === 'terrazzo') ? '#ffffff' : (TYPE_COLORS[type] || '#eeeeee');
  return mat(kind, color);
}
// 頂樓菜園：一排排木頭菜箱，上面是土和菜
function addPlanters(f, m) {
  // 依 2 樓小田園照片：一格一格的小木框菜圃，種生菜，隔一格插竹竿支架
  const b = new Batch();
  const wood = mat('planks', '#b98b5a'), soil = mat('wool', '#4a3322'), lettuce = mat('wool', '#6cc04a'), bamboo = mat('wool', '#c8b48a');
  let seed = 7, n = 0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let x = m.x1 + 1.0; x + 0.6 < m.x2 - 0.5; x += 1.9) {
    for (let z = m.z1 + 1.0; z + 1.8 < m.z2 - 0.6; z += 2.5) {
      const cz = z + 0.9;
      b.box(wood, 1.2, 0.4, 1.8, x + 0.6, f.y + 0.2, cz);
      b.box(soil, 1.0, 0.05, 1.6, x + 0.6, f.y + 0.42, cz);
      for (let k = 0; k < 6; k++) {                       // 生菜
        const sz = 0.24 + rnd() * 0.1;
        b.box(lettuce, sz, sz * 0.8, sz, x + 0.35 + (k % 2) * 0.5, f.y + 0.45 + sz * 0.4, cz - 0.55 + Math.floor(k / 2) * 0.55);
      }
      if (n++ % 2 === 0) {                                // 竹竿支架
        for (const [dx, dz] of [[0.15, -0.7], [1.05, -0.7], [0.15, 0.7], [1.05, 0.7]]) b.box(bamboo, 0.04, 1.6, 0.04, x + dx, f.y + 0.4 + 0.8, cz + dz);
        b.box(bamboo, 0.04, 0.04, 1.5, x + 0.15, f.y + 2.0, cz); b.box(bamboo, 0.04, 0.04, 1.5, x + 1.05, f.y + 2.0, cz);
      }
    }
  }
  b.build(f.group);
}
// 看台：靠外牆那側三層階梯（越靠牆越高），靠挑空那側留走道
function addBleachers(f, m, side) {
  const b = new Batch();
  const seatCols = ['#2e6fd8', '#d9a31a', '#d32f2f'];
  const depth = side === 'W' ? m.x2 - m.x1 : m.z2 - m.z1;
  const t = depth * 0.2;
  for (let k = 0; k < 3; k++) {
    const h = 0.75 - k * 0.25, o = t * k + t / 2;       // k=0 最靠牆、最高
    const col = mat('wool', seatCols[k]), base = mat('planks', '#e2c8a0');
    if (side === 'N' || side === 'S') {
      const z = side === 'N' ? m.z1 + o : m.z2 - o, L = m.x2 - m.x1 - 0.6;
      b.box(base, L, h - 0.08, t, (m.x1 + m.x2) / 2, f.y + (h - 0.08) / 2, z);
      b.box(col, L, 0.08, t, (m.x1 + m.x2) / 2, f.y + h - 0.04, z);
    } else {
      const x = m.x1 + o, L = m.z2 - m.z1 - 0.6;
      b.box(base, t, h - 0.08, L, x, f.y + (h - 0.08) / 2, (m.z1 + m.z2) / 2);
      b.box(col, t, 0.08, L, x, f.y + h - 0.04, (m.z1 + m.z2) / 2);
    }
  }
  return b.build(f.group);
}
// 方塊風：外牆用校舍實際的米色，再帶一點各棟的代表色方便辨認
const BEIGE = new THREE.Color('#efe0bf');
function wallMat(bld) {
  const c = !bld ? new THREE.Color('#dddddd')
    : BLOCKY ? BEIGE.clone().lerp(new THREE.Color(D.buildings[bld].color), 0.22)
    : lighten(D.buildings[bld].color, 0.35);
  return mat('concrete', `#${c.getHexString()}`);
}
// 屋頂顏色（依空拍照：敬業樓藍色屋頂，其他是淺灰色浪板）
const ROOF_COLOR = { A: '#6d9fe0', B: '#d8d8d2', C: '#e2e2dc', D: '#d8d8d2' };

// 樓梯間：入口平地、A 道（往上半層）、平台、B 道（再往上半層）；樓梯往下的地方地板是空的
function buildStairwell(f, s) {
  const g = s.g, H = FLOOR_H, up = stairNext(s, f), down = stairPrev(s, f);
  const b = new Batch(), thick = f.level === 0 ? 0.12 : 0.3;
  const floorM = floorMat('stair', f), stepM = mat('planks', BLOCKY ? '#e8d2b0' : '#b39b78'), noseM = mat('wool', '#8d6e4c');
  // (u, v) 範圍內的方塊，y0～y1 是相對這層地板的高度
  const box = (m, u1, v1, u2, v2, y0, y1) => {
    const [ax, az] = g.toXZ(u1, v1), [bx, bz] = g.toXZ(u2, v2);
    b.box(m, Math.abs(bx - ax), y1 - y0, Math.abs(bz - az), (ax + bx) / 2, f.y + (y0 + y1) / 2, (az + bz) / 2);
  };
  const slab = (u1, v1, u2, v2) => box(floorM, u1, v1, u2, v2, -thick + 0.01, 0.01);
  slab(0, 0, g.s0, g.Wd);                                   // 入口平地
  slab(g.s0, 0, g.f1, g.Wd / 2);                             // A 道底下
  if (!down) { slab(g.s0, g.Wd / 2, g.f1, g.Wd); slab(g.f1, 0, g.L, g.Wd); }   // 最底層：整個都有地板
  if (up) {
    const N = 12, d = (g.f1 - g.s0) / N, rise = H / 2 / N, w = WALL_T / 2;
    for (let i = 0; i < N; i++) {
      const ua = g.s0 + i * d;                               // A 道：入口往裡面爬，實心
      box(stepM, ua, 0.05, ua + d, g.Wd / 2 - w, 0, (i + 1) * rise);
      box(noseM, ua, 0.05, ua + 0.06, g.Wd / 2 - w, (i + 1) * rise - 0.04, (i + 1) * rise + 0.005);
      const ub = g.f1 - (i + 1) * d, top = H / 2 + (i + 1) * rise;   // B 道：平台往入口爬，底下是斜的樓板（不是實心，下面還有一段樓梯）
      box(stepM, ub, g.Wd / 2 + w, ub + d, g.Wd - 0.05, top - rise - 0.25, top);
      box(noseM, ub + d - 0.06, g.Wd / 2 + w, ub + d, g.Wd - 0.05, top - 0.04, top + 0.005);
    }
    box(stepM, g.f1, 0.05, g.L - 0.05, g.Wd - 0.05, H / 2 - 0.25, H / 2);   // 平台
  }
  const meshes = b.build(f.group);
  (f.slabs ||= []).push(...meshes);
  // 入口上方的指示牌：左邊上樓、右邊下樓
  const sign = (text, bg, v) => {
    const sp = makeLabel(text, '', 0, 0, 0, { bg, h: 0.55 });
    const [x, z] = g.toXZ(g.s0 * 0.55, v);
    sp.position.set(x, f.y + 2.05, z);
    sp.scale.multiplyScalar(0.55 / sp.scale.y);
    (f.stairSigns ||= new THREE.Group()).add(sp);
  };
  if (up) sign(`▲ 上樓 ${up.id}`, '#2e7d32', g.Wd * 0.25);
  if (down) sign(`▼ 下樓 ${down.id}`, '#1565c0', g.Wd * 0.75);
  if (f.stairSigns && !f.stairSigns.parent) f.group.add(f.stairSigns);
}

function buildFloor(f) {
  for (const w of f.walk) {
    if (w.kind === 'outdoor') continue;
    if (w.stair?.g) { buildStairwell(f, w.stair); continue; }
    const type = w.kind === 'room' ? w.room.type : w.kind;
    const { x1, z1, x2, z2 } = w.m;
    const thick = f.level === 0 ? 0.12 : 0.3;
    const slab = new THREE.Mesh(blockBox(x2 - x1, thick, z2 - z1), floorMat(type, f, w.room));
    const sy = f.level === 0 && (type === 'garden' || w.room?.ground) ? 0 : f.y;   // 一樓中庭、警衛室在地面高度
    slab.position.set((x1 + x2) / 2, sy - thick / 2 + 0.01, (z1 + z2) / 2);
    slab.receiveShadow = true;
    if (w.room) { slab.userData.room = w.room; pickables.push(slab); }
    f.group.add(slab);
    (f.slabs ||= []).push(slab);
    if (w.room?.farm) addPlanters(f, w.m);
    const bl = w.bleacher || w.room?.bleacher;
    if (bl) f.slabs.push(...addBleachers(f, w.m, bl));
  }
  // 天花板 / 屋頂：上面一層沒有蓋到的地方就是屋頂
  const above = floors[f.idx + 1];
  const ceilBatch = new Batch();
  for (const w of f.walk) {
    if (w.kind === 'outdoor' || w.room?.type === 'garden' || w.noCeil || w.room?.noCeil || w.room?.tall) continue;
    if (w.stair?.g && stairNext(w.stair, f)) continue;          // 樓梯間往上是挑空的
    const { x1, z1, x2, z2 } = w.m, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const covered = above && above.walk.some((a) => a.kind !== 'outdoor' && inRect(a.m, cx, cz));
    const bld = w.room?.building;
    const m = covered ? mat('concrete', '#f4f2ec') : mat('roof', BLOCKY ? (ROOF_COLOR[bld] || '#d8d8d2') : '#c9c9c9');
    ceilBatch.box(m, x2 - x1, CEIL_T, z2 - z1, cx, (w.room?.ground ? 0 : f.y) + WALL_H + CEIL_T / 2, cz);
    (f.ceilRects ||= []).push(w.m);                         // 鏡頭用：這裡頭上有天花板
  }
  // 下一層的挑高空間（活動中心）：屋頂蓋在這一層的高度（放在這層的天花板群組，鳥瞰選這層時會拿掉，才看得到看台）
  for (const r of floors[f.idx - 1]?.rooms || []) {
    if (!r.tall) continue;
    const { x1, z1, x2, z2 } = r.m;
    ceilBatch.box(mat('roof', BLOCKY ? (ROOF_COLOR[r.building] || '#d8d8d2') : '#c9c9c9'),
      x2 - x1 + WALL_T, CEIL_T, z2 - z1 + WALL_T, (x1 + x2) / 2, f.y + WALL_H + CEIL_T / 2, (z1 + z2) / 2);
    (f.ceilRects ||= []).push(r.m);
  }
  f.ceil = new THREE.Group();
  f.ceilMeshes = ceilBatch.build(f.ceil);
  f.group.add(f.ceil);
  // 牆：下段實牆、中段玻璃窗、上段實牆；欄杆用石磚
  const batch = new Batch();
  const glass = mat('glass'), railMat = mat('brick', BLOCKY ? '#ffffff' : '#9aa7b0');
  for (const s of f.segs) {
    if (s.noRender) continue;                      // 只用來擋路的牆（例如挑高空間在上一層的部分）
    const horiz = Math.abs(s.az - s.bz) < 1e-6;
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az) + WALL_T;
    const cx = (s.ax + s.bx) / 2, cz = (s.az + s.bz) / 2;
    const yb = f.level === 0 && (s.ground || s.kind === 'poolwall' || s.kind === 'poolstripe' || s.kind === 'hedge') ? 0 : f.y;   // 戶外的牆、警衛室在地面
    const piece = (m, y0, y1, a = -len / 2, b = len / 2) => {
      const mid = (a + b) / 2, L = b - a;
      if (horiz) batch.box(m, L, y1 - y0, WALL_T, cx + mid, yb + (y0 + y1) / 2, cz);
      else batch.box(m, WALL_T, y1 - y0, L, cx, yb + (y0 + y1) / 2, cz + mid);
    };
    if (s.kind === 'rail') {
      piece(railMat, 0, s.h);
      if (BLOCKY && f.level >= 1 && f.level <= 3 && len > 1.6 && !s.stairWall) {      // 欄杆上的花台與植物
        const a = -len / 2 + 0.3, b = len / 2 - 0.3;
        piece(mat('wool', '#8a8f86'), s.h, s.h + 0.12, a, b);
        for (let t = a + 0.2; t < b - 0.2; t += 0.55) piece(mat('leaves'), s.h + 0.12, s.h + 0.42, t, t + 0.4);
      }
      continue;
    }
    if (s.kind === 'hedge') { piece(mat('leaves'), 0, s.h); continue; }
    if (s.kind === 'poolwall') { piece(BLOCKY ? poolWallMat() : mat('wool', '#eeeeee'), 0, s.h); continue; }
    if (s.kind === 'poolstripe') { piece(BLOCKY ? poolStripeMat() : mat('wool', '#7cc3ec'), 0, s.h); continue; }
    const wm = wallMat(s.bld);
    if (s.overhead) { piece(wm, s.y0, s.h); continue; }   // 門楣
    if (s.solid) { piece(wm, 0, s.h); continue; }        // 跟隔壁房間共用的實牆（沒有窗）
    if (s.mural) {                                        // 壁畫牆（敬業樓一樓，依照片）
      piece(wm, 0, s.h);
      const off = s.face * (WALL_T / 2 + 0.02), H = s.h, mm = muralMat(s.mural);
      if (horiz) batch.plain(mm, len - 0.1, H, 0.02, cx, f.y + H / 2, cz + off);
      else batch.plain(mm, 0.02, H, len - 0.1, cx + off, f.y + H / 2, cz);
      if (s.mural === 'sdg' && horiz && len > 2) {         // 白色矮櫃（鞋櫃）
        const bl = Math.min(len - 1.2, 4), bz = cz + s.face * (WALL_T / 2 + 0.25);
        batch.box(mat('wool', '#f4f2ec'), bl, 0.45, 0.42, cx + (len - bl) / 2 - 0.2, f.y + 0.225, bz);
      }
      continue;
    }
    if (s.fullGlass && horiz) {                           // 溪口情廊：圖書館、會議室是落地窗
      piece(wm, 0, 0.12); piece(glass, 0.12, 2.75); piece(wm, 2.75, s.h);
      for (let t = -len / 2 + 0.15; t <= len / 2; t += 1.2) piece(mat('wool', '#e9e6df'), 0.12, 2.75, t - 0.04, t + 0.04);
      continue;
    }
    if (s.gallery && horiz) {                             // 溪口情廊：米白石紋牆、白框布告欄、上方一排氣窗
      piece(galleryWallMat(), 0, 2.45); piece(glass, 2.45, 2.85); piece(mat('wool', '#f1ede4'), 2.85, s.h);
      const nb = Math.floor((len - 0.5) / 2.4), off = s.gallery * (WALL_T / 2 + 0.035);
      for (let i = 0; i < nb; i++) {
        const t = -len / 2 + (len - nb * 2.4) / 2 + 1.2 + i * 2.4, x = cx + t, z = cz + off;
        batch.box(mat('wool', '#f7f7f4'), 1.95, 1.4, 0.07, x, f.y + 1.6, z);
        batch.plain(galleryBoardMat((i + Math.round(cx)) % 3), 1.75, 1.2, 0.02, x, f.y + 1.6, z + s.gallery * 0.045);
      }
      continue;
    }
    if (len < 1.4) { piece(wm, 0, s.h); continue; }
    // 每一層樓高各有一排窗（挑高的牆會有兩排）；窗戶之間每隔約 2.5 公尺一根柱子
    const storeys = s.h > FLOOR_H ? 2 : 1;
    const n = Math.max(1, Math.round(len / 2.5)), pw = 0.3;
    let y = 0;
    for (let k = 0; k < storeys; k++) {
      const b0 = k * FLOOR_H + 1.0, b1 = k * FLOOR_H + 2.2;
      piece(wm, y, b0);
      for (let i = 0; i <= n; i++) {
        const p = -len / 2 + (len * i) / n;
        piece(wm, b0, b1, Math.max(-len / 2, p - pw / 2), Math.min(len / 2, p + pw / 2));
        if (i < n) {
          const a = p + pw / 2, b = -len / 2 + (len * (i + 1)) / n - pw / 2;
          if (b > a) piece(glass, b0, b1, a, b);
        }
      }
      y = b1;
    }
    piece(wm, y, s.h);
  }
  // 電梯；樓梯地面的發光標記（樓梯只標入口那段平地）
  for (const s of f.stairs) {
    if (s.elevator) buildElevator(f.group, s.m, f.y, WALL_H, f.level === 0);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      color: s.elevator ? '#5aa9ff' : '#ff9f1c', transparent: true, opacity: 0.45, depthWrite: false,
    }));
    mark.rotation.x = -Math.PI / 2;
    let [mx0, mz0, sx, sz] = [s.cx, s.cz, s.m.x2 - s.m.x1, s.m.z2 - s.m.z1];
    if (s.g) { [mx0, mz0] = [s.ex, s.ez]; [sx, sz] = s.g.alongX ? [s.g.s0, s.g.Wd] : [s.g.Wd, s.g.s0]; }
    mark.scale.set(sx * 0.9, sz * 0.9, 1);
    mark.position.set(mx0, f.y + 0.03, mz0);
    mark.userData.pulse = true;
    f.group.add(mark);
    f.labels.add(makeLabel(s.id, s.elevator ? '可到 1F～4F' : `${s.floors[0]}～${s.floors.at(-1)}`, mx0, f.y + 2.4, mz0, { bg: s.elevator ? '#2f6fb5' : '#d9730d', h: 1.0 }));
  }
  f.wallMeshes = batch.build(f.group).filter((m) => !m.material.transparent);
  // 教室裝潢 + 門牌
  Batch.collector = f.boxes;                               // 家具：記下範圍，算碰撞用
  f.group.add(furnishFloor(f, WALL_T));
  Batch.collector = null;
  // 房間名稱
  for (const r of f.rooms) {
    if (r.hidden || r.type === 'wc') continue;
    const lbl = makeLabel(r.display, r.sub, r.cx, (r.ground ? 0 : f.y) + 2.3, r.cz, { bg: r.type === 'class' ? '#c2410c' : '#1e3a5f' });
    lbl.userData.room = r;
    pickables.push(lbl);
    f.labels.add(lbl);
  }
  for (const r of f.rooms) if (r.type === 'wc') f.labels.add(makeLabel('🚻', '', r.cx, f.y + 2.0, r.cz, { bg: '#555', h: 0.8 }));
  f.group.add(f.labels, f.navGroup);
  scene.add(f.group);
}

function makeLabel(title, sub, x, y, z, { bg = '#1e3a5f', h = 1.25 } = {}) {
  // 方塊風：像遊戲裡的名牌（半透明黑底、像素字、標題用顏色區分種類）
  const pad = 18, fs1 = BLOCKY ? 54 : 46, fs2 = BLOCKY ? 34 : 28;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const font1 = `700 ${fs1}px ${LABEL_FONT}`;
  const font2 = `500 ${fs2}px ${LABEL_FONT}`;
  ctx.font = font1; const w1 = ctx.measureText(title).width;
  ctx.font = font2; const w2 = sub ? ctx.measureText(sub).width : 0;
  cv.width = Math.ceil(Math.max(w1, w2) + pad * 2);
  cv.height = sub ? fs1 + fs2 + pad * 2 + 6 : fs1 + pad * 2;
  if (BLOCKY) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = bg; ctx.fillRect(0, cv.height - 6, cv.width, 6);
  } else {
    ctx.fillStyle = bg; ctx.globalAlpha = 0.88;
    roundRect(ctx, 0, 0, cv.width, cv.height, 16); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const titleColor = BLOCKY ? `#${lighten(bg, 0.6).getHexString()}` : '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = font1;
  if (BLOCKY) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(title, cv.width / 2 + 3, pad + 1); }
  ctx.fillStyle = titleColor; ctx.fillText(title, cv.width / 2, pad - 2);
  if (sub) { ctx.font = font2; ctx.fillStyle = BLOCKY ? '#e6e6e6' : '#ffe9b3'; ctx.fillText(sub, cv.width / 2, pad + fs1 + 4); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  const hh = sub ? h * 1.45 : h;
  sp.scale.set(hh * cv.width / cv.height, hh, 1);
  sp.position.set(x, y, z);
  sp.renderOrder = 2;
  return sp;
}
// 紙條標籤（參考 DSLab）：米白紙、黑框、左邊色條、上面一段膠帶、下面一根細桿指到地點
function makeTag(title, sub, x, y0, z, { accent = '#c0392b', h = 2.2, stem = 4 } = {}) {
  const pad = 22, fs1 = 58, fs2 = 24, cv = document.createElement('canvas'), c = cv.getContext('2d');
  const f1 = `900 ${fs1}px ${LABEL_FONT}`, f2 = `700 ${fs2}px ${LABEL_FONT}`;
  c.font = f1; const w1 = c.measureText(title).width;
  c.font = f2; const w2 = sub ? c.measureText(sub).width + sub.length * 3 : 0;
  const W = Math.ceil(Math.max(w1, w2) + pad * 2 + 18), H = (sub ? fs1 + fs2 + 14 : fs1) + pad * 2, top = 16;
  cv.width = W + 10; cv.height = H + top + 10;
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(10, top + 10, W, H);                 // 影子
  c.fillStyle = '#fbf6ea'; c.fillRect(0, top, W, H);
  c.strokeStyle = '#2b2b2b'; c.lineWidth = 4; c.strokeRect(2, top + 2, W - 4, H - 4);
  c.fillStyle = accent; c.fillRect(4, top + 4, 12, H - 8);                         // 左邊色條
  c.save(); c.translate(W / 2, top + 2); c.rotate(-0.05);                          // 膠帶
  c.fillStyle = 'rgba(226,138,138,.82)'; c.fillRect(-50, -15, 100, 28);
  c.fillStyle = 'rgba(255,255,255,.25)'; for (let i = -46; i < 50; i += 10) c.fillRect(i, -15, 3, 28);
  c.restore();
  c.textAlign = 'left'; c.textBaseline = 'top';
  c.font = f1; c.fillStyle = '#2b2b2b'; c.fillText(title, pad + 18, top + pad);
  if (sub) { c.font = f2; c.fillStyle = accent; if ('letterSpacing' in c) c.letterSpacing = '3px'; c.fillText(sub, pad + 18, top + pad + fs1 + 10); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.center.set(0.5, 0);
  sp.scale.set(h * cv.width / cv.height, h, 1);
  sp.position.y = stem; sp.renderOrder = 3;
  const ink = new THREE.MeshBasicMaterial({ color: '#2b2b2b' });
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, stem, 0.1), ink); pole.position.y = stem / 2;
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.6), new THREE.MeshBasicMaterial({ color: accent })); dot.position.y = 0.07;
  const grp = new THREE.Group(); grp.position.set(x, y0, z);
  grp.add(pole, dot, sp);
  grp.userData.tag = { sprite: sp, stem: [pole, dot] };
  return grp;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// 大樓名稱（鳥瞰時顯示）
const buildingLabels = new THREE.Group();
const BLD_POS = { A: [1100, 360], B: [1620, 820], C: [1110, 1180], D: [580, 820] };
for (const [k, b] of Object.entries(D.buildings)) {
  const [px, py] = BLD_POS[k];
  const en = { A: 'JING YE', B: 'ZHI SHAN', C: 'QIN XUE', D: 'SI YUAN' }[k] || '', acc = { A: '#c0392b', B: '#2f6fb5', C: '#d9730d', D: '#2d8a57' }[k];
  buildingLabels.add(makeTag(b.name, `${k} 棟 · ${en}`, mx(px), BASE + (k === 'A' ? 5 : 4) * FLOOR_H + 0.8, mz(py), { accent: acc, h: 7, stem: 6 }));
}
scene.add(buildingLabels);

/* ---------------- 玩家 ---------------- */

const player = { x: 0, z: 0, floor: floorById['1F'], yaw: 0, pitch: -0.05, vy: 0, jump: 0 };
// 角色：男學生 / 女學生（記在瀏覽器，下次不用再選）
const AVATAR_KEY = 'campus-avatar';
function savedGender() {
  try { const v = localStorage.getItem(AVATAR_KEY); return v === 'boy' || v === 'girl' ? v : null; } catch { return null; }
}
let avatar = makeBlockPerson(savedGender() || 'boy');
avatar.scale.setScalar(AVATAR_SCALE);
scene.add(avatar);

function setGender(gender) {
  try { localStorage.setItem(AVATAR_KEY, gender); } catch { /* 私密模式，忽略 */ }
  const next = makeBlockPerson(gender);
  next.scale.setScalar(AVATAR_SCALE);
  next.rotation.copy(avatar.rotation);
  next.position.copy(avatar.position);
  next.visible = avatar.visible;
  scene.remove(avatar);
  avatar.traverse((o) => { o.geometry?.dispose(); });
  avatar = next;
  scene.add(avatar);
  document.querySelectorAll('[data-gender]').forEach((b) => b.classList.toggle('on', b.dataset.gender === gender));
}

// 角色預覽圖（選角色畫面用）：另外開一個小畫布拍「大頭照」
function avatarPreviews() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(240, 300);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#c9bfae', 1.6));
  const d = new THREE.DirectionalLight('#ffffff', 1.4); d.position.set(-2, 3, -4); sc.add(d);
  const cam = new THREE.PerspectiveCamera(30, 240 / 300, 0.1, 50);
  cam.position.set(-1.6, 1.6, -3.4); cam.lookAt(0, 0.95, 0);
  const out = {};
  for (const gd of ['boy', 'girl']) {
    const p = makeBlockPerson(gd);
    p.userData.limbs.armR.rotation.x = -0.5;            // 揮手
    p.userData.limbs.armR.rotation.z = 0.5;
    sc.add(p);
    r.render(sc, cam);
    out[gd] = r.domElement.toDataURL('image/png');
    sc.remove(p);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}

function openChooser({ firstTime = false } = {}) {
  const ch = document.getElementById('chooser');
  if (!ch.dataset.ready) {
    const imgs = avatarPreviews();
    ch.querySelectorAll('[data-gender] img').forEach((img) => { img.src = imgs[img.closest('[data-gender]').dataset.gender]; });
    ch.dataset.ready = '1';
  }
  ch.dataset.first = firstTime ? '1' : '';
  ch.hidden = false;
}
document.getElementById('chooser').addEventListener('click', (e) => {
  const b = e.target.closest('[data-gender]');
  const ch = e.currentTarget;
  if (b) {
    setGender(b.dataset.gender);
    ch.hidden = true;
    if (ch.dataset.first) {
      // 第一次選好角色：從校門口出發
      setMode('third');
      const kid = b.dataset.gender === 'girl' ? '👧' : '👦';
      if (coverGo) {                                            // 在封面點了某棟樓：直接到那裡
        const [f, x, z, yaw] = coverGo.go();
        placeAt(f, x, z, yaw);
        toast(`${kid} 來到 ${coverGo.title}！<br><small>點地面就會自己走過去，也可以用 WASD 或搖桿</small>`);
        coverGo = null;
      } else toast(`${kid} 歡迎來到溪口國小！<br><small>點地面就會自己走過去，也可以用 WASD 或搖桿</small>`);
    } else {
      toast('已換好角色！');
    }
  } else if (e.target.closest('[data-act="bird"]')) {
    ch.hidden = true;
    setMode('bird');
  } else if (e.target === ch && !ch.dataset.first) ch.hidden = true;
});

function placeAt(f, x, z, yaw) {
  if (f !== player.floor || Math.hypot(x - player.x, z - player.z) > 1) stopAuto();
  player.floor = f; player.x = x; player.z = z;
  player.gy = groundAt(f, x, z);
  followStairs();
  if (yaw !== undefined) { player.yaw = yaw; avatar.rotation.y = yaw; }
  updateVisibility();
  updateFloorButtons();
}

/* ---------------- 碰撞 ---------------- */

// 空間索引：每 2 公尺一格，記下附近的牆和障礙物（家具、樹、遊樂器材），碰撞和鏡頭只查附近的
const HCELL = 2, HPAD = 0.7;
function buildIndex(f) {
  const idx = new Map();
  const put = (x1, z1, x2, z2, key, item) => {
    for (let i = Math.floor((x1 - HPAD) / HCELL); i <= Math.floor((x2 + HPAD) / HCELL); i++) {
      for (let j = Math.floor((z1 - HPAD) / HCELL); j <= Math.floor((z2 + HPAD) / HCELL); j++) {
        const k = i * 100003 + j;
        let c = idx.get(k);
        if (!c) idx.set(k, (c = { segs: [], obs: [], cam: [] }));
        c[key].push(item);
      }
    }
  };
  for (const s of f.segs) put(Math.min(s.ax, s.bx), Math.min(s.az, s.bz), Math.max(s.ax, s.bx), Math.max(s.az, s.bz), 'segs', s);
  for (const o of f.obs || []) put(o.x1, o.z1, o.x2, o.z2, 'obs', o);
  for (const o of f.camBoxes || []) put(o.x1, o.z1, o.x2, o.z2, 'cam', o);
  f.index = idx;
}
const EMPTY_CELL = { segs: [], obs: [], cam: [] };
const cellAt = (f, x, z) => f.index?.get(Math.floor(x / HCELL) * 100003 + Math.floor(z / HCELL)) || EMPTY_CELL;

// 家具等方塊：腰部以下、夠大的才算擋路（桌椅、櫃子、樹幹、溜滑梯）；細桌腳、地毯、掛在牆上的東西不算
function isObstacle(b, f) {
  const g = f.y + (f.level === 0 ? groundAt(f, (b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2) : 0);
  const y1 = b.y1 - g, y2 = b.y2 - g, w = b.x2 - b.x1, d = b.z2 - b.z1;
  if (y1 > 0.75 || y2 < 0.3) return false;
  if (Math.min(w, d) >= 0.25) return true;
  return Math.max(w, d) >= 0.8 && Math.min(w, d) >= 0.03 && y1 < 0.3 && y2 - y1 >= 0.6;   // 細長的牆、圍網
}

function collide(f, x, z) {
  for (let iter = 0; iter < 3; iter++) {
    const cell = cellAt(f, x, z);
    // 障礙物（方塊）：站在上面（夠矮）或在頭上的不擋
    for (const o of cell.obs) {
      const y1 = o.y1 - f.y, y2 = o.y2 - f.y, py = player.gy || 0;
      if (y2 < py + 0.25 || y1 > py + 1.4) continue;
      const cx = Math.max(o.x1, Math.min(x, o.x2)), cz = Math.max(o.z1, Math.min(z, o.z2));
      const ex = x - cx, ez = z - cz, d = Math.hypot(ex, ez), r = PLAYER_R;
      if (d >= r) continue;
      if (d > 1e-6) { x = cx + ex / d * r; z = cz + ez / d * r; continue; }
      // 中心已經在方塊裡面：往最近的邊推出去
      const out = [[o.x1 - r - x, 0], [o.x2 + r - x, 0], [0, o.z1 - r - z], [0, o.z2 + r - z]];
      const [px, pz] = out.reduce((a, b) => (Math.abs(b[0] + b[1]) < Math.abs(a[0] + a[1]) ? b : a));
      x += px; z += pz;
    }
    for (const s of cell.segs) {
      if (s.overhead) continue;                    // 門楣在頭上，不擋路
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz;
      let t = ((x - s.ax) * dx + (z - s.az) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const cx = s.ax + dx * t, cz = s.az + dz * t;
      const ex = x - cx, ez = z - cz, d = Math.hypot(ex, ez), min = PLAYER_R + WALL_T / 2;
      if (d < min) {
        if (d < 1e-6) { x += min; continue; }
        x = cx + ex / d * min; z = cz + ez / d * min;
      }
    }
  }
  return [x, z];
}

// 一次走太遠（電腦比較慢、又按 Shift 跑步時一格畫面會超過半公尺）會直接穿過牆，所以切成小步一步一步算
function tryMove(dx, dz) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  for (let k = 0; k < n; k++) {
    const f = player.floor, sx = dx / n, sz = dz / n;
    let ok = false;
    for (const [ddx, ddz] of [[sx, sz], [sx, 0], [0, sz]]) {
      const [nx, nz] = collide(f, player.x + ddx, player.z + ddz);
      if (isWalkable(f, nx, nz)) {
        // 正面頂到門框、柱子幾乎走不動：試試斜一點的方向，會順著滑進門口（不用對得很準）
        const L = Math.hypot(sx, sz), fwd = ((nx - player.x) * sx + (nz - player.z) * sz) / L;
        if (fwd < L * 0.25) {
          // 附近有門、而且大概在前進方向上：直接往門口中間走（不用對得很準）
          let door = null, dd = 1.8;
          for (const d of f.doors || []) {
            const ex = d.x - player.x, ez = d.z - player.z, dist = Math.hypot(ex, ez);
            if (dist < dd && dist > 0.05 && (ex * sx + ez * sz) / (dist * L) > 0.3) { dd = dist; door = d; }
          }
          if (door) {
            // 還沒對準門（偏到旁邊）：先走到門正前方 0.9 公尺；對準了就直直走進去
            const side = Math.sign((player.x - door.x) * door.nx + (player.z - door.z) * door.nz) || 1;
            const lat = Math.abs((player.x - door.x) * door.nz - (player.z - door.z) * door.nx);
            const tgt = lat > 0.18 ? { x: door.x + door.nx * side * 0.9, z: door.z + door.nz * side * 0.9 } : { x: door.x - door.nx * side * 0.6, z: door.z - door.nz * side * 0.6 };
            const ex = tgt.x - player.x, ez = tgt.z - player.z, dist = Math.hypot(ex, ez) || 1;
            const [qx, qz] = collide(f, player.x + ex / dist * L, player.z + ez / dist * L);
            if (isWalkable(f, qx, qz) && Math.hypot(tgt.x - qx, tgt.z - qz) < dist - L * 0.05) { player.x = qx; player.z = qz; ok = true; break; }
          }
          // 往兩側試著移一點，再看從那裡能不能往前走（看前面 0.5 公尺），挑往前最多的那一邊
          let best = [nx, nz, fwd];
          for (const a of [0.8, -0.8, 1.3, -1.3]) {
            const c = Math.cos(a), sn = Math.sin(a), rx = (sx * c - sz * sn), rz = (sx * sn + sz * c);
            const [qx, qz] = collide(f, player.x + rx, player.z + rz);
            if (!isWalkable(f, qx, qz)) continue;
            const [px, pz] = collide(f, qx + sx / L * 0.5, qz + sz / L * 0.5);
            const g = ((px - player.x) * sx + (pz - player.z) * sz) / L;
            if (g > best[2] + 0.02) best = [qx, qz, g];
          }
          [player.x, player.z] = best;
        } else { player.x = nx; player.z = nz; }
        ok = true; break;
      }
    }
    if (!ok) return;
    followStairs();
  }
}

/* ---------------- 尋路（格點 A*） ---------------- */

const CELL = 0.5, CLEAR = Math.max(0.34, PLAYER_R + WALL_T / 2 + 0.02);
function getGrid(f) {
  if (f.grid) return f.grid;
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
  for (const w of f.walk) {
    minx = Math.min(minx, w.m.x1); minz = Math.min(minz, w.m.z1);
    maxx = Math.max(maxx, w.m.x2); maxz = Math.max(maxz, w.m.z2);
  }
  minx -= 2; minz -= 2; maxx += 2; maxz += 2;
  const W = Math.ceil((maxx - minx) / CELL), H = Math.ceil((maxz - minz) / CELL);
  const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    free[j * W + i] = isWalkable(f, minx + (i + 0.5) * CELL, minz + (j + 0.5) * CELL, 0) ? 1 : 0;
  }
  for (const s of f.segs) {
    if (s.overhead) continue;
    const i0 = Math.max(0, Math.floor((Math.min(s.ax, s.bx) - CLEAR - minx) / CELL));
    const i1 = Math.min(W - 1, Math.floor((Math.max(s.ax, s.bx) + CLEAR - minx) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(s.az, s.bz) - CLEAR - minz) / CELL));
    const j1 = Math.min(H - 1, Math.floor((Math.max(s.az, s.bz) + CLEAR - minz) / CELL));
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = minx + (i + 0.5) * CELL, z = minz + (j + 0.5) * CELL;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
      if (Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) < CLEAR) free[j * W + i] = 0;
    }
  }
  // 家具、樹：格子中心在方塊（稍微放大）裡面就不能走；放大一點點就好，教室走道才不會被堵死
  for (const o of f.obs || []) {
    const P = 0;
    const i0 = Math.max(0, Math.ceil((o.x1 - P - minx) / CELL - 0.5)), i1 = Math.min(W - 1, Math.floor((o.x2 + P - minx) / CELL - 0.5));
    const j0 = Math.max(0, Math.ceil((o.z1 - P - minz) / CELL - 0.5)), j1 = Math.min(H - 1, Math.floor((o.z2 + P - minz) / CELL - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) free[j * W + i] = 0;
  }
  return (f.grid = { minx, minz, W, H, free });
}

function nearestFree(g, i, j) {
  if (i >= 0 && j >= 0 && i < g.W && j < g.H && g.free[j * g.W + i]) return [i, j];
  for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const a = i + di, b = j + dj;
    if (a >= 0 && b >= 0 && a < g.W && b < g.H && g.free[b * g.W + a]) return [a, b];
  }
  return null;
}

function findPath(f, sx, sz, tx, tz) {
  const g = getGrid(f);
  const toCell = (x, z) => [Math.floor((x - g.minx) / CELL), Math.floor((z - g.minz) / CELL)];
  const s = nearestFree(g, ...toCell(sx, sz)), t = nearestFree(g, ...toCell(tx, tz));
  if (!s || !t) return null;
  const N = g.W * g.H, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const si = s[1] * g.W + s[0], ti = t[1] * g.W + t[0];
  const heap = [];
  const push = (n, fv) => { heap.push([fv, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const hfn = (n) => { const dx = Math.abs(n % g.W - t[0]), dz = Math.abs(((n / g.W) | 0) - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gs[si] = 0; push(si, hfn(si));
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, n] = pop();
    if (closed[n]) continue;
    closed[n] = 1;
    if (n === ti) break;
    const i = n % g.W, j = (n / g.W) | 0;
    for (const [di, dj, c] of dirs) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= g.W || b >= g.H) continue;
      const m = b * g.W + a;
      if (!g.free[m] || closed[m]) continue;
      if (di && dj && (!g.free[j * g.W + a] || !g.free[b * g.W + i])) continue;
      const ng = gs[n] + c;
      if (ng < gs[m]) { gs[m] = ng; from[m] = n; push(m, ng + hfn(m)); }
    }
  }
  if (from[ti] < 0 && ti !== si) return null;
  const cells = [];
  for (let n = ti; n >= 0; n = from[n]) { cells.push(n); if (n === si) break; }
  cells.reverse();
  const pts = cells.map((n) => [g.minx + (n % g.W + 0.5) * CELL, g.minz + (((n / g.W) | 0) + 0.5) * CELL]);
  // 拉直路徑（視線檢查）
  const los = (a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / (CELL * 0.4));
    for (let k = 1; k < n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
      const ci = Math.floor((x - g.minx) / CELL), cj = Math.floor((z - g.minz) / CELL);
      if (!g.free[cj * g.W + ci]) return false;
    }
    return true;
  };
  const out = [pts[0]];
  let k = 0;
  while (k < pts.length - 1) {
    let best = k + 1;
    for (let m = pts.length - 1; m > k + 1; m--) if (los(pts[k], pts[m])) { best = m; break; }
    out.push(pts[best]); k = best;
  }
  let len = 0;
  for (let q = 1; q < out.length; q++) len += Math.hypot(out[q][0] - out[q - 1][0], out[q][1] - out[q - 1][1]);
  return { pts: out, len };
}

/* ---------------- 導航 ---------------- */

const nav = { target: null, legs: [], stair: null };
const pathMat = new THREE.MeshBasicMaterial({ color: '#ffd400' });

function clearNav() {
  for (const f of floors) f.navGroup.clear();
  nav.target = null; nav.legs = []; nav.stair = null;
  document.getElementById('navbar').hidden = true;
}

function drawLeg(f, pts) {
  if (pts.length < 2) return;
  const path = new THREE.CurvePath();
  for (let i = 1; i < pts.length; i++) {
    path.add(new THREE.LineCurve3(new THREE.Vector3(pts[i - 1][0], f.y + 0.15, pts[i - 1][1]), new THREE.Vector3(pts[i][0], f.y + 0.15, pts[i][1])));
  }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, pts.length * 12), BLOCKY ? 0.18 : 0.14, BLOCKY ? 4 : 6, false), pathMat);
  f.navGroup.add(tube);
  // 小箭頭
  const arrowGeo = new THREE.ConeGeometry(0.28, 0.6, 3);
  arrowGeo.rotateX(Math.PI / 2);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
    for (let d = 1.5; d < L - 0.5; d += 3) {
      const a = new THREE.Mesh(arrowGeo, pathMat);
      a.position.set(ax + (bx - ax) * d / L, f.y + 0.3, az + (bz - az) * d / L);
      a.lookAt(bx, f.y + 0.3, bz);
      a.rotateY(Math.PI);
      a.userData.arrow = true;
      f.navGroup.add(a);
    }
  }
}

function addBeacon(f, x, z, color = '#ffd400') {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(x, f.y + 3.5, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, f.y + 0.05, z);
  ring.userData.pulse = true;
  f.navGroup.add(beam, ring);
}

function navigateTo(room) {
  clearNav();
  const pf = player.floor, tf = room.f;
  let best = null;
  if (pf === tf) {
    const p = findPath(pf, player.x, player.z, room.cx, room.cz);
    if (p) best = { legs: [{ f: pf, p }], len: p.len };
  } else {
    for (const s of stairs) {
      if (!s.floors.includes(pf.id) || !s.floors.includes(tf.id)) continue;
      const sx = s.ex ?? s.cx, sz = s.ez ?? s.cz;           // 樓梯：走到入口那段平地
      const a = findPath(pf, player.x, player.z, sx, sz);
      const b = findPath(tf, sx, sz, room.cx, room.cz);
      if (!a || !b) continue;
      const len = a.len + b.len + Math.abs(pf.level - tf.level) * (s.elevator ? 12 : 6);
      if (!best || len < best.len) best = { legs: [{ f: pf, p: a }, { f: tf, p: b }], len, stair: s };
    }
  }
  if (!best) { toast('找不到路線 😢'); return; }
  nav.target = room; nav.legs = best.legs; nav.stair = best.stair || null;
  for (const l of best.legs) drawLeg(l.f, l.p.pts);
  addBeacon(tf, room.cx, room.cz);
  if (nav.stair) addBeacon(pf, nav.stair.ex ?? nav.stair.cx, nav.stair.ez ?? nav.stair.cz, '#ff9f1c');
  updateNavBar();
  if (mode === 'bird') setMode('third');
}

function updateNavBar() {
  const bar = document.getElementById('navbar');
  if (!nav.target) { bar.hidden = true; return; }
  const r = nav.target;
  let msg;
  if (player.floor !== r.f) {
    const s = nav.stair;
    msg = s ? `先沿黃線走到 <b>${s.id}</b>，再${s.elevator ? '搭電梯' : (r.f.level > player.floor.level ? '走上樓梯' : '走下樓梯')}到 <b>${r.f.id}</b>` : `目的地在 ${r.f.id}`;
  } else {
    const d = Math.hypot(player.x - r.cx, player.z - r.cz);
    msg = `沿黃線前往 <b>${r.display}</b>（約 ${Math.round(d)} 公尺）`;
  }
  bar.querySelector('.msg').innerHTML = msg;
  bar.hidden = false;
}

/* ---------------- 模式與可見性 ---------------- */

let mode = 'bird';           // bird | first | third
let viewFloor = 'all';       // 鳥瞰時看哪一層

function setMode(m) {
  mode = m;
  orbit.enabled = m === 'bird';
  avatar.visible = m !== 'first';
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  document.body.classList.toggle('walking', m !== 'bird');
  document.getElementById('stairPanel').hidden = true;
  currentStair = undefined; stairPanelKey = '';
  if (m === 'bird') updatePanoPrompt();
  if (m === 'bird') {
    orbit.target.set(player.x, player.floor.y, player.z);
    camera.position.set(player.x + 30, player.floor.y + 45, player.z + 45);
    viewFloor = player.floor.id;
  }
  updateVisibility();
  updateFloorButtons();
}

function updateVisibility() {
  // 走路時：整棟樓都在（有天花板、有屋頂）；鳥瞰選某一層時：上面的樓層和這層的天花板拿掉，才看得到裡面
  const walking = mode !== 'bird';
  const sel = walking || viewFloor === 'all' ? null : floorById[viewFloor].level;
  const labelLevel = walking ? player.floor.level : sel;
  for (const f of floors) {
    f.group.visible = sel === null || f.level <= sel;
    f.ceil.visible = f.level !== sel;
    f.labels.visible = labelLevel !== null && f.level === labelLevel;
    if (f.stairSigns) f.stairSigns.visible = walking && f === player.floor;
  }
  // 鳥瞰選 B1 時把地面藏起來；走路時地面一直都在（在 B1 時就是天花板）
  ground.visible = walking || sel === null || sel >= 0;
  // 走路時標籤縮小、放低，才不會擋住視線
  const k = mode === 'bird' ? 1 : 0.5;
  for (const f of floors) for (const s of f.labels.children) {
    const tg = s.userData.tag;
    if (tg) {                                                   // 紙條標籤：走路時縮小、拿掉細桿、放在頭上高度
      const sp = tg.sprite;
      sp.userData.base ||= { sx: sp.scale.x, sy: sp.scale.y, y: sp.position.y };
      sp.scale.set(sp.userData.base.sx * k, sp.userData.base.sy * k, 1);
      sp.position.y = sp.userData.base.y;
      for (const o of tg.stem) o.visible = mode === 'bird';
      continue;
    }
    s.userData.base ||= { sx: s.scale.x, sy: s.scale.y, y: s.position.y - f.y };
    s.scale.set(s.userData.base.sx * k, s.userData.base.sy * k, 1);
    s.position.y = f.y + (mode === 'bird' ? s.userData.base.y : 2.45);
  }
  buildingLabels.visible = mode === 'bird' && viewFloor === 'all';
  setIsland(mode === 'bird');
}

function updateFloorButtons() {
  const cur = mode === 'bird' ? viewFloor : player.floor.id;
  document.querySelectorAll('[data-floor]').forEach((b) => b.classList.toggle('on', b.dataset.floor === cur));
  document.getElementById('floorName').textContent = mode === 'bird'
    ? (viewFloor === 'all' ? '全校' : floorById[viewFloor].name)
    : player.floor.name;
}

/* ---------------- 樓梯切換 ---------------- */

// 走在樓梯上：算出腳下的高度；爬超過半層就算到了上一層（往下也一樣），中途不會閃畫面
function stairUnder(f, x, z) {
  for (const s of f.stairs) if (s.g && inRect(s.m, x, z)) return s;
  return null;
}
function followStairs() {
  const f = player.floor, s = stairUnder(f, player.x, player.z);
  player.onStair = s;
  if (!s) return;
  let h = stairHeight(s, f, player.x, player.z, player.gy ?? 0);
  const up = stairNext(s, f), down = stairPrev(s, f);
  if (h > FLOOR_H * 0.6 && up) { h -= FLOOR_H; switchFloor(up); }
  else if (h < -FLOOR_H * 0.45 && down) { h += FLOOR_H; switchFloor(down); }
  player.gy = h;
}
function switchFloor(nf) {
  const upward = nf.level > player.floor.level;
  player.floor = nf;
  updateVisibility();
  updateFloorButtons();
  updateNavBar();
  toast(`${upward ? '⬆' : '⬇'} ${nf.name}`);
}
// 自動爬樓梯：沿著 A 道 → 平台 → B 道走 n 層（delta = 1 往上，-1 往下）
function climbStairs(s, delta, n = 1) {
  const g = s.g, pts = [];
  const P = (u, v) => g.toXZ(u, v), mid = (g.f1 + g.L) / 2, a = g.Wd * 0.25, b = g.Wd * 0.75;
  for (let k = 0; k < n; k++) {
    if (delta > 0) pts.push(P(g.s0 * 0.5, a), P(g.s0 + 0.4, a), P(mid, a), P(mid, b), P(g.s0 + 0.2, b), P(g.s0 * 0.5, b));
    else pts.push(P(g.s0 * 0.5, b), P(g.s0 + 0.4, b), P(mid, b), P(mid, a), P(g.s0 + 0.2, a), P(g.s0 * 0.5, a));
  }
  auto.pts = pts; auto.i = 0; auto.stuck = 0;
  destMark.visible = false;
}

let currentStair = null;
function stairAt() {
  for (const s of player.floor.stairs) if (inRect(s.m, player.x, player.z, 0.2)) return s;
  return null;
}
function changeFloor(delta, n = 1) {
  const s = currentStair;
  if (!s) return;
  const i = s.floors.indexOf(player.floor.id) + delta * n;
  if (i < 0 || i >= s.floors.length) return;
  if (s.g) climbStairs(s, delta, n);                // 樓梯：真的走上去／走下去
  else gotoFloor(floorById[s.floors[i]]);           // 電梯
}
function gotoFloor(f) {
  const fade = document.getElementById('fade');
  fade.classList.add('on');
  setTimeout(() => {
    placeAt(f, player.x, player.z);
    fade.classList.remove('on');
    toast(`${f.name}`);
    updateNavBar();
  }, 180);
}
let stairPanelKey = '';
function updateStairPanel() {
  const s = stairAt();
  const panel = document.getElementById('stairPanel');
  const key = s && mode !== 'bird' ? `${s.id}|${player.floor.id}|${nav.target?.id || ''}` : '';
  currentStair = s;
  if (key === stairPanelKey) return;
  stairPanelKey = key;
  if (!key) { panel.hidden = true; return; }
  const idx = s.floors.indexOf(player.floor.id);
  let html = `<div class="t">${s.id}</div>`;
  if (s.elevator) {
    html += s.floors.map((fid) => `<button data-goto="${fid}" ${fid === player.floor.id ? 'disabled' : ''}>${fid}</button>`).join('');
  } else {
    // 導航中而且目的地在別層：一鍵走到那一層
    const tf = nav.target?.f, ti = tf ? s.floors.indexOf(tf.id) : -1;
    if (ti >= 0 && ti !== idx && Math.abs(ti - idx) > 1) {
      html += `<button data-delta="${Math.sign(ti - idx)}" data-n="${Math.abs(ti - idx)}">🧭 走到 ${tf.id}</button>`;
    }
    if (idx < s.floors.length - 1) html += `<button data-delta="1">▲ 走上 ${s.floors[idx + 1]} <kbd>E</kbd></button>`;
    if (idx > 0) html += `<button data-delta="-1">▼ 走下 ${s.floors[idx - 1]} <kbd>Q</kbd></button>`;
    html += `<div class="hint">也可以直接走上樓梯</div>`;
  }
  panel.innerHTML = html;
  panel.hidden = false;
}
document.getElementById('stairPanel').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.delta) changeFloor(+b.dataset.delta, +(b.dataset.n || 1));
  if (b.dataset.goto) gotoFloor(floorById[b.dataset.goto]);
  currentStair = undefined;
});

/* ---------------- 輸入 ---------------- */

const keys = {};
const settings = { speed: 1.5, sens: 1 };   // 預設移動速度 150%
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || viewer.isOpen) return;
  keys[e.code] = true;
  if (e.code === 'KeyE') { changeFloor(1); currentStair = undefined; }
  if (e.code === 'KeyQ') { changeFloor(-1); currentStair = undefined; }
  if (e.code === 'KeyM') setMode(mode === 'bird' ? 'third' : 'bird');
  if (e.code === 'KeyV' && mode !== 'bird') setMode(mode === 'first' ? 'third' : 'first');
  if (e.code === 'KeyC') { const g = savedGender() === 'girl' ? 'boy' : 'girl'; setGender(g); toast(g === 'girl' ? '👧 換成女學生' : '👦 換成男學生'); }
  if (e.code === 'Space' && mode !== 'bird' && player.jump === 0) { player.vy = 4.2; e.preventDefault(); }
  if (e.code === 'KeyF' && e.repeat) return;
  if (e.code === 'KeyF' && (act.spot || act.busy)) doAction();                 // 靠近籃框、溜滑梯時 F 是互動
  else if (e.code === 'Slash' || e.code === 'KeyF') { if (e.code === 'Slash') e.preventDefault(); openSearch(); }
  if (e.code === 'KeyP') openGallery();
  if (e.code === 'Escape') { closeSearch(); hideInfo(); closeGallery(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// 拖曳轉視角 / 點擊選取
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId };
});
addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  if (mode !== 'bird') {
    const k = 0.0042 * settings.sens;
    player.yaw -= (e.clientX - drag.x) * k;
    player.pitch = Math.max(-1.2, Math.min(0.9, player.pitch - (e.clientY - drag.y) * k));
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
addEventListener('pointerup', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) pick(e);
  drag = null;
});

// 平板、手機：兩指捏合拉近拉遠（第三人稱）
const touches = new Map();
let pinchD = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') touches.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size !== 2 || mode !== 'third') { pinchD = 0; return; }
  const [[ax, ay], [bx, by]] = [...touches.values()], d = Math.hypot(ax - bx, ay - by);
  if (pinchD) cam.zoom = Math.max(1.6, Math.min(10, cam.zoom * pinchD / d));
  pinchD = d;
  drag = null;                                                 // 兩指時不轉視角
});
const endTouch = (e) => { touches.delete(e.pointerId); pinchD = 0; };
addEventListener('pointerup', endTouch);
addEventListener('pointercancel', endTouch);

// 第三人稱：滑鼠滾輪、觸控板拉近拉遠
renderer.domElement.addEventListener('wheel', (e) => {
  if (mode !== 'third') return;
  e.preventDefault();
  cam.zoom = Math.max(1.6, Math.min(10, cam.zoom * (1 + Math.sign(e.deltaY) * 0.12)));
}, { passive: false });

const raycaster = new THREE.Raycaster();
function pick(e) {
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const vis = pickables.filter((o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  const hit = raycaster.intersectObjects(vis, false)[0];
  if (hit?.object.userData.cat) meetCat();
  else if (hit?.object.userData.npc) meetNPC(hit.object.userData.npc);
  else if (hit?.object.userData.pano) openPano(hit.object.userData.pano);
  else if (mode !== 'bird') {                                   // 走路模式：點地面就自動走過去
    const pt = groundPoint(e);
    if (pt) walkTo(pt.x, pt.z);
  }
  else if (hit) showInfo(hit.object.userData.room);
  else hideInfo();
}

/* ---------------- 點地面自動走 ---------------- */

const auto = { pts: null, i: 0, stuck: 0 };
const destMark = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.6, 28), new THREE.MeshBasicMaterial({ color: '#ffd400', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
destMark.rotation.x = -Math.PI / 2; destMark.visible = false; destMark.userData.pulse = true;
scene.add(destMark);
function walkTo(x, z) {
  const f = player.floor;
  const p = findPath(f, player.x, player.z, x, z);
  if (!p || p.pts.length < 2) { toast('走不到那裡 😅'); return; }
  auto.pts = p.pts; auto.i = 1; auto.stuck = 0;
  const [ex, ez] = p.pts.at(-1);
  destMark.position.set(ex, f.y + groundAt(f, ex, ez) + 0.06, ez);
  destMark.visible = true;
}
function stopAuto() { auto.pts = null; destMark.visible = false; }
// 滑鼠點到的地面位置（目前樓層的地板高度）
function groundPoint(e) {
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(player.floor.y + (player.gy || 0)));
  const pt = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, pt)) return null;
  return Math.hypot(pt.x - player.x, pt.z - player.z) < 90 ? pt : null;
}
// 每一格畫面：沿著路線走（有按方向鍵或搖桿就交還給玩家）
function stepAuto(dt) {
  const [tx, tz] = auto.pts[auto.i];
  const dx = tx - player.x, dz = tz - player.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { if (++auto.i >= auto.pts.length) stopAuto(); return 0; }
  const step = Math.min(d, 4 * settings.speed * dt);
  const ox = player.x, oz = player.z;
  tryMove(dx / d * step, dz / d * step);
  const moved = Math.hypot(player.x - ox, player.z - oz);
  const want = Math.atan2(-dx, -dz);
  avatar.rotation.y = want;
  const diff = ((want - player.yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  player.yaw += diff * Math.min(1, dt * 3);                     // 鏡頭慢慢轉到前進方向
  auto.stuck = moved < step * 0.2 ? auto.stuck + dt : 0;
  if (auto.stuck > 0.6) stopAuto();
  return moved;
}

/* ---------------- 小地圖 ---------------- */

const MM = (() => {
  const w = D.outdoor.walk;
  return { px: 4, minx: mx(w[0]) - 10, minz: mz(w[1]) - 10, maxx: mx(w[2]) + 10, maxz: mz(w[3]) + 10, maps: {}, view: 60 };
})();
const MM_ROOM = { class: '#fff1bf', special: '#cdeccd', office: '#cfe2ff', kinder: '#ffd6e8', wc: '#dcdcdc', hall: '#ece6da', garden: '#a7d58a', storage: '#d9d4cb' };
function minimapImage(f) {
  if (MM.maps[f.id]) return MM.maps[f.id];
  const W = Math.ceil((MM.maxx - MM.minx) * MM.px), H = Math.ceil((MM.maxz - MM.minz) * MM.px);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), P = MM.px;
  const X = (x) => (x - MM.minx) * P, Z = (z) => (z - MM.minz) * P;
  const rect = (m, fill, stroke) => {
    c.fillStyle = fill; c.fillRect(X(m.x1), Z(m.z1), (m.x2 - m.x1) * P, (m.z2 - m.z1) * P);
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.strokeRect(X(m.x1), Z(m.z1), (m.x2 - m.x1) * P, (m.z2 - m.z1) * P); }
  };
  c.fillStyle = f.level === 0 ? '#8cc56a' : '#3b4652'; c.fillRect(0, 0, W, H);
  const O = D.outdoor;
  if (f.level === 0) {
    if (O.track) {                                              // 跑道：紅藍外圈、中間藍色球場、兩端草地
      const cx = X(mx(O.track.center[0])), cz = Z(mz(O.track.center[1]));
      const A = O.track.size[0] / S / 2, B = O.track.size[1] / S / 2, Ls = (A - B) * P;
      const stadium = (r) => { c.beginPath(); c.arc(cx + Ls, cz, r * P, -Math.PI / 2, Math.PI / 2); c.arc(cx - Ls, cz, r * P, Math.PI / 2, Math.PI * 1.5); c.closePath(); };
      stadium(B); c.fillStyle = '#c4604f'; c.fill();
      stadium(B - 5); c.fillStyle = '#6aa84f'; c.fill();
      c.fillStyle = '#2d64b3'; c.fillRect(cx - Ls, cz - (B - 5) * P, Ls * 2, (B - 5) * 2 * P);
    }
    if (O.pool) rect(rectM(O.pool), '#3a7cc4', '#20456e');
    if (O.playground) rect(rectM(O.playground), '#5fae4a');
    if (O.stage) rect(rectM(O.stage), '#efdcbc');
    if (O.pond) rect(rectM(O.pond), '#4aa3c9');
    if (O.wall) {                                              // 圍牆
      c.strokeStyle = '#8a6a3c'; c.lineWidth = 3;
      for (const r of wallRuns().filter((q) => !q.noWall)) { c.beginPath(); c.moveTo(X(r.ax), Z(r.az)); c.lineTo(X(r.bx), Z(r.bz)); c.stroke(); }
    }
  }
  for (const w of f.walk) {
    if (w.kind === 'outdoor') continue;
    if (w.kind === 'stair') rect(w.m, w.stair.elevator ? '#7fb3ff' : '#ffb347', '#9a5d16');
    else if (w.room) { if (!w.room.hidden) rect(w.m, MM_ROOM[w.room.type] || '#e8e0d0', '#6d6255'); }
    else rect(w.m, f.level === 0 ? '#ddd6c8' : '#ece6da');
  }
  MM.maps[f.id] = cv;
  return cv;
}
const mmBox = document.getElementById('minimap'), mmCanvas = mmBox.querySelector('canvas'), mmc = mmCanvas.getContext('2d');
let mmFloor = '';
function drawMinimap() {
  if (mode === 'bird') return;
  const f = player.floor, img = minimapImage(f), N = mmCanvas.width, k = N / MM.view, P = MM.px;
  mmc.fillStyle = f.level === 0 ? '#8cc56a' : '#3b4652'; mmc.fillRect(0, 0, N, N);
  const sw = MM.view * P;
  mmc.drawImage(img, (player.x - MM.minx) * P - sw / 2, (player.z - MM.minz) * P - sw / 2, sw, sw, 0, 0, N, N);
  const toS = (x, z) => [N / 2 + (x - player.x) * k, N / 2 + (z - player.z) * k];
  const line = (pts, color, w, dash) => {
    mmc.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = toS(x, z); i ? mmc.lineTo(a, b) : mmc.moveTo(a, b); });
    mmc.strokeStyle = color; mmc.lineWidth = w; mmc.setLineDash(dash || []); mmc.stroke(); mmc.setLineDash([]);
  };
  for (const l of nav.legs) if (l.f === f) line(l.p.pts, '#ffd400', 5);
  if (auto.pts) {
    line([[player.x, player.z], ...auto.pts.slice(auto.i)], '#ffffff', 3, [6, 5]);
    const [a, b] = toS(...auto.pts.at(-1));
    mmc.fillStyle = '#ffd400'; mmc.beginPath(); mmc.arc(a, b, 6, 0, Math.PI * 2); mmc.fill();
  }
  // 自己：紅色箭頭（朝人物面向的方向）
  mmc.save(); mmc.translate(N / 2, N / 2); mmc.rotate(-avatar.rotation.y);
  mmc.fillStyle = '#e53935'; mmc.strokeStyle = '#fff'; mmc.lineWidth = 3;
  mmc.beginPath(); mmc.moveTo(0, -14); mmc.lineTo(10, 10); mmc.lineTo(0, 4); mmc.lineTo(-10, 10); mmc.closePath(); mmc.stroke(); mmc.fill();
  mmc.restore();
  if (mmFloor !== f.id) { mmFloor = f.id; mmBox.querySelector('.fl').textContent = f.id; }
}
// 點小地圖：走到那裡
mmCanvas.addEventListener('pointerdown', (e) => e.stopPropagation());
mmCanvas.addEventListener('click', (e) => {
  const r = mmCanvas.getBoundingClientRect(), k = r.width / MM.view;
  walkTo(player.x + (e.clientX - r.left - r.width / 2) / k, player.z + (e.clientY - r.top - r.height / 2) / k);
});

/* ---------------- 目前位置 ---------------- */

const whereChip = document.getElementById('where');
let whereTick = 0, whereText = '';
function whereAmI() {
  const f = player.floor, x = player.x, z = player.z;
  for (const s of f.stairs) if (inRect(s.m, x, z)) return `${s.id}・${f.id}`;
  const r = rooms.find((r) => r.f === f && !r.hidden && inRect(r.m, x, z));
  const bName = (rm) => (rm?.building ? D.buildings[rm.building].name : '');
  if (r) return r.open && !r.building ? r.name : `${r.display}・${bName(r)} ${f.id}`;
  const inside = f.walk.some((w) => w.kind !== 'outdoor' && inRect(w.m, x, z));
  if (inside) {
    let best = null, bd = Infinity;
    for (const rm of rooms) {
      if (rm.f !== f || !rm.building) continue;
      const d = Math.hypot(rm.cx - x, rm.cz - z);
      if (d < bd) { bd = d; best = rm; }
    }
    return `${bName(best)} ${f.id} 走廊`;
  }
  const O = D.outdoor, near = (rect, pad = 0) => rect && inRect(rectM(rect), x, z, pad);
  if (near(O.pool)) return '水漾游泳館';
  if (near(O.stage, 1)) return '司令臺';
  if (near(O.playground, 1)) return '遊戲場';
  if (near(O.pond, 1)) return '生態池';
  if (O.track) {
    const cx = mx(O.track.center[0]), cz = mz(O.track.center[1]);
    if (Math.abs(x - cx) < O.track.size[0] / S / 2 && Math.abs(z - cz) < O.track.size[1] / S / 2) return '操場';
  }
  if (O.gate && x < mx(O.gate.x) + 2) return '正門口';
  return '校園';
}
function updateWhere(dt) {
  if ((whereTick += dt) < 0.25) return;
  whereTick = 0;
  const t = whereAmI();
  if (t !== whereText) { whereText = t; whereChip.querySelector('span').textContent = t; }
}

// 手機搖桿
const joy = { x: 0, y: 0, id: null };
{
  const base = document.getElementById('joy'), knob = base.querySelector('.knob');
  const move = (e) => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / max; joy.y = dy / max;
  };
  base.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; base.setPointerCapture(e.pointerId); move(e); e.stopPropagation(); });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) move(e); });
  const end = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
}

/* ---------------- UI：資訊卡、搜尋 ---------------- */

const info = document.getElementById('info');
let infoRoom = null;
function showInfo(room) {
  if (!room) return;
  infoRoom = room;
  const b = room.building ? `${room.building} ${D.buildings[room.building].name}` : '';
  info.querySelector('.title').textContent = room.display;
  info.querySelector('.meta').innerHTML = [
    room.code ? `班級代號 ${room.code}` : '', room.no ? `教室 ${room.no}` : '',
    `${b} ${room.f.name}`, TYPE_NAMES[room.type] || '', room.alias ? `又稱：${room.alias}` : '',
  ].filter(Boolean).map((s) => `<span>${s}</span>`).join('');
  info.hidden = false;
}
function hideInfo() { info.hidden = true; infoRoom = null; }
info.addEventListener('click', (e) => {
  const act = e.target.closest('button')?.dataset.act;
  if (!act || !infoRoom) return;
  if (act === 'go') { navigateTo(infoRoom); hideInfo(); }
  if (act === 'tp') { teleportTo(infoRoom); hideInfo(); }
  if (act === 'share') shareRoom(infoRoom);
  if (act === 'close') hideInfo();
});

function teleportTo(room) {
  placeAt(room.f, room.cx, room.cz);
  if (mode === 'bird') setMode('third');
  toast(`已傳送到 ${room.display}`);
  updateNavBar();
}

function shareRoom(room) {
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(room.id)}`;
  navigator.clipboard?.writeText(url).then(() => toast('連結已複製！'), () => prompt('複製這個連結：', url));
}

const searchList = rooms.filter((r) => !r.hidden && r.type !== 'wc');
function searchKeys(r) {
  const k = [r.display, r.name, r.alias, r.code, r.no, r.f.id, r.f.name, r.building && D.buildings[r.building].name, TYPE_NAMES[r.type]];
  if (r.code) {
    const g = r.code[0], c = String(+r.code.slice(1));
    k.push(`${g}年${c}班`, `${g}-${c}`, `${g}0${c}`);
  }
  return k.filter(Boolean).join(' ').toLowerCase();
}
for (const r of searchList) r.keys = searchKeys(r);

const panel = document.getElementById('search');
const input = document.getElementById('q');
const results = document.getElementById('results');
function renderResults() {
  const q = input.value.trim().toLowerCase().replace(/\s+/g, ' ');
  const terms = q ? q.split(' ') : [];
  const list = searchList.filter((r) => terms.every((t) => r.keys.includes(t)));
  const order = Object.fromEntries(floors.map((f) => [f.id, f.level]));
  list.sort((a, b) => order[a.f.id] - order[b.f.id] || (a.code || a.no || '').localeCompare(b.code || b.no || ''));
  const spots = terms.length ? window.PANO.spots.filter((sp) => {
    const k = `${sp.zh} ${sp.en} 360 實景 環景 照片 ${sp.scenes.map((s) => s.floor).join(' ')}`.toLowerCase();
    return terms.every((t) => k.includes(t));
  }) : [];
  const spotHtml = spots.map((sp) => `
    <li data-pano="${sp.scenes[0].img}" class="pano">
      <img src="pano/thumb/${sp.scenes[0].img}.webp" alt="">
      <span class="n">📷 ${sp.zh}</span>
      <span class="s">360° 實景 · ${sp.scenes[0].floor}</span>
      <button>看實景</button>
    </li>`).join('');
  results.innerHTML = spotHtml + (list.length ? list.map((r) => `
    <li data-id="${r.id}">
      <span class="dot" style="background:${TYPE_COLORS[r.type]}"></span>
      <span class="n">${r.display}</span>
      <span class="s">${r.f.id} · ${r.building ? D.buildings[r.building].name : ''}${r.no ? ' · ' + r.no : ''}</span>
      <button data-act="go">帶我去</button>
    </li>`).join('') : (spots.length ? '' : '<li class="empty">找不到，換個關鍵字試試（例如：503、健康中心、音樂）</li>'));
}
function openSearch() { panel.hidden = false; input.focus(); input.select(); renderResults(); }
function closeSearch() { panel.hidden = true; input.blur(); }
input.addEventListener('input', renderResults);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const li = results.querySelector('li[data-id]'); if (li) selectFromList(li.dataset.id, true); }
});
results.addEventListener('click', (e) => {
  const pli = e.target.closest('li[data-pano]');
  if (pli) { openPano(viewer.byImg[pli.dataset.pano]); return; }
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  selectFromList(li.dataset.id, !!e.target.closest('button'));
});
function selectFromList(id, go) {
  const r = rooms.find((x) => x.id === id);
  closeSearch();
  if (go) { navigateTo(r); return; }
  focusRoom(r);
}
function focusRoom(r) {
  if (mode !== 'bird') setMode('bird');
  viewFloor = r.f.id;
  orbit.target.set(r.cx, r.f.y, r.cz);
  camera.position.set(r.cx + 14, r.f.y + 26, r.cz + 22);
  updateVisibility(); updateFloorButtons();
  showInfo(r);
}

document.getElementById('openSearch').onclick = openSearch;
document.getElementById('closeSearch').onclick = closeSearch;
document.getElementById('navbar').querySelector('button').onclick = clearNav;
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

// 樓層按鈕
const floorBar = document.getElementById('floors');
floorBar.innerHTML = `<button data-floor="all">全</button>` + [...floors].reverse().map((f) => `<button data-floor="${f.id}">${f.id}</button>`).join('');
floorBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-floor]');
  if (!b) return;
  if (mode !== 'bird') setMode('bird');
  viewFloor = b.dataset.floor;
  const y = viewFloor === 'all' ? 0 : floorById[viewFloor].y;
  const dy = y - orbit.target.y;
  orbit.target.y += dy; camera.position.y += dy;
  updateVisibility(); updateFloorButtons();
});

// 設定
document.getElementById('speed').oninput = (e) => { settings.speed = e.target.value / 100; document.getElementById('speedV').textContent = e.target.value + '%'; };
document.getElementById('sens').oninput = (e) => { settings.sens = e.target.value / 100; document.getElementById('sensV').textContent = e.target.value + '%'; };
document.querySelectorAll('[data-style]').forEach((b) => {
  b.classList.toggle('on', b.dataset.style === STYLE);
  b.onclick = () => { setStyle(b.dataset.style); location.href = location.pathname; };
});
document.getElementById('helpBtn').onclick = () => (document.getElementById('help').hidden = false);
document.getElementById('help').addEventListener('click', (e) => { if (e.target.id === 'help' || e.target.closest('.close')) e.currentTarget.hidden = true; });

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ---------------- 360° 環景 ---------------- */

const viewer = new PanoViewer(window.PANO, {
  onClose: () => { clock.getDelta(); },
  onLocate: (s) => focusPano(s),
});
const panoScenes = viewer.scenes;
for (const s of panoScenes) {
  s.f = floorById[s.floor];
  s.x = mx(s.at[0]); s.z = mz(s.at[1]);
}

function panoIcon() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  if (BLOCKY) {
    c.fillStyle = '#ffffff'; c.fillRect(8, 8, 112, 112);
    c.fillStyle = '#7b2cbf'; c.fillRect(16, 16, 96, 96);
    c.fillStyle = '#9d4edd'; c.fillRect(16, 16, 96, 12);
  } else {
    c.fillStyle = '#7b2cbf'; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.fill();
    c.lineWidth = 8; c.strokeStyle = '#fff'; c.stroke();
  }
  c.font = '64px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('📷', 64, 70);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPanoMarkers() {
  const iconMat = new THREE.SpriteMaterial({ map: panoIcon(), depthWrite: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: '#9d4edd', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const ringGeo = new THREE.RingGeometry(0.55, 0.8, 32);
  for (const s of panoScenes) {
    const icon = new THREE.Sprite(iconMat);
    icon.scale.set(1.1, 1.1, 1);
    const gAt = s.f.level === 0 ? groundAt(s.f, s.x, s.z) : 0;
    icon.position.set(s.x, s.f.y + gAt + 1.7, s.z);
    icon.userData = { pano: s, bob: Math.random() * 6 };
    icon.renderOrder = 3;
    s.f.group.add(icon);
    pickables.push(icon);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, s.f.y + gAt + 0.04, s.z);
    s.f.group.add(ring);
    if (s.idx === 0) {
      const lbl = makeLabel(`📷 ${s.spot.zh}`, '', s.x, s.f.y + gAt + 3.1, s.z, { bg: '#7b2cbf', h: 0.95 });
      lbl.userData.pano = s;
      pickables.push(lbl);
      s.f.labels.add(lbl);
    }
  }
}

function openPano(s) {
  hideInfo(); closeSearch(); closeGallery();
  document.getElementById('panoPrompt').hidden = true;
  for (const k in keys) keys[k] = false;
  viewer.open(s.img);
}

function focusPano(s) {
  if (mode !== 'bird') setMode('bird');
  viewFloor = s.floor;
  orbit.target.set(s.x, s.f.y, s.z);
  camera.position.set(s.x + 14, s.f.y + 26, s.z + 22);
  updateVisibility(); updateFloorButtons();
  toast(`📷 ${s.spot.zh}（${s.floor}）`);
}

// 走到環景點附近時的提示
let nearPano = null;
function updatePanoPrompt() {
  let best = null, bd = 2.2;
  if (mode !== 'bird') {
    for (const s of panoScenes) {
      if (s.f !== player.floor) continue;
      const d = Math.hypot(s.x - player.x, s.z - player.z);
      if (d < bd) { bd = d; best = s; }
    }
  }
  if (best === nearPano) return;
  nearPano = best;
  const p = document.getElementById('panoPrompt');
  if (!best) { p.hidden = true; return; }
  p.innerHTML = `📷 這裡有 360° 實景：<b>${best.spot.zh}</b> <span class="go">觀看 <kbd>Enter</kbd></span>`;
  p.hidden = false;
}
document.getElementById('panoPrompt').onclick = () => nearPano && openPano(nearPano);
addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && nearPano && !viewer.isOpen && document.activeElement?.tagName !== 'INPUT') openPano(nearPano);
});

// 實景導覽清單
const gallery = document.getElementById('gallery');
function openGallery() {
  const order = Object.fromEntries(floors.map((f) => [f.id, f.level]));
  const spots = window.PANO.spots.slice().sort((a, b) => order[a.scenes[0].floor] - order[b.scenes[0].floor]);
  let html = '', lastFloor = null;
  for (const sp of spots) {
    const s0 = sp.scenes[0];
    if (s0.floor !== lastFloor) { html += `<h3>${floorById[s0.floor].name}</h3>`; lastFloor = s0.floor; }
    html += `<button class="card" data-img="${s0.img}">
      <img src="pano/thumb/${s0.img}.webp" alt="" loading="lazy">
      <span><b>${sp.zh}</b><small>${sp.en}${sp.scenes.length > 1 ? ` · ${sp.scenes.length} 張` : ''}</small></span></button>`;
  }
  gallery.querySelector('.list').innerHTML = html;
  gallery.hidden = false;
}
function closeGallery() { gallery.hidden = true; }
gallery.addEventListener('click', (e) => {
  const c = e.target.closest('[data-img]');
  if (c) openPano(viewer.byImg[c.dataset.img]);
  else if (e.target === gallery || e.target.closest('.close')) closeGallery();
});
document.getElementById('openGallery').onclick = openGallery;

/* ---------------- 橘貓彩蛋（坐在游泳館入口階梯上） ---------------- */

const CAT_KEY = 'campus-cat-found';
const cat = makeCat();
{
  // 依使用者說明：貓咪常坐在游泳館入口（東端）的灰色階梯上、不鏽鋼扶手旁
  const pm = rectM(D.outdoor.pool), [d0, d1] = poolDoor(pm);
  cat.position.set((d0 + d1) / 2 + 0.45, 0.3, pm.z1 - 1.3);   // 中間那一階
  cat.rotation.y = 0;                                          // 面向北邊（操場）
}
floors[1].group.add(cat);
cat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.cat = true; pickables.push(o); } });
let catNear = false;
function meetCat() {
  let first = true;
  try { first = !localStorage.getItem(CAT_KEY); localStorage.setItem(CAT_KEY, '1'); } catch { /* 私密模式，忽略 */ }
  toast(first ? '🐱 喵～你找到了坐在游泳館門口階梯上的橘貓！' : '🐱 喵～又見面了！');
}

/* ---------------- 老師 NPC（依照片畫成方塊人） ---------------- */

const NPCS = [
  {
    name: '呂老師', title: '體育老師',
    hello: '🏃‍♀️ 呂老師：嗨！今天也要來操場動一動喔！',
    // 操場北側直道、起跑線旁，面向球場
    at: () => {
      const T = D.outdoor.track;
      return [mx(T.center[0]) - 6.5, mz(T.center[1]) - T.size[1] / S / 2 + 2.2, Math.PI];
    },
    look: {
      // 依照片：黑色中分長直髮、笑開露牙、磚紅色長袖毛衣；體育老師配運動褲＋哨子
      skin: '#f0c4a6', hair: '#231816', top: '#9a3f2c', pants: '#22252b', stripe: '#f2f2f2', shoe: '#f4f4f4',
      longHair: true, longSleeve: true, whistle: true,
      pal: { H: '#231816', h: '#3a2a26', S: '#f0c4a6', E: '#2a1a14', B: '#f19a8e', M: '#a8352e', T: '#ffffff' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHhHHHHHHHH',
        'HHHHHHHhHHHHHHHH',
        'HHHHHHSSHHHHHHHH',
        'HHHHHSSSSSHHHHHH',
        'HHHSSSSSSSSSHHHH',
        'HHSSSSSSSSSSSSHH',
        'HHSSEESSSSEESSHH',
        'HHSESSESSESSESHH',
        'HHSSSSSSSSSSSSHH',
        'HHSBBSSSSSSBBSHH',
        'HHSSSMMMMMMSSSHH',
        'HHSSSMTTTTMSSSHH',
        'HHSSSSMMMMSSSSHH',
        'HHSSSSSSSSSSSSHH',
        'HHHSSSSSSSSSSHHH',
      ],
    },
  },
  {
    name: '陳老師', title: '體育老師',
    hello: '🏊 陳老師：游泳前記得先暖身，下水要聽哨音喔！',
    // 游泳館裡：泳池西端的池畔（比較寬），面向泳池
    at: () => {
      const pm = rectM(D.outdoor.pool), W = pm.x2 - pm.x1;
      const pw = Math.min(25, W - 10), px = (pm.x1 + pm.x2) / 2 + 2;
      return [px - pw / 2 - 1.6, (pm.z1 + pm.z2) / 2, -Math.PI / 2];
    },
    look: {
      // 依照片：黑色刺刺短髮、一字眉、細長眼、淺淺微笑；黑外套＋白襯衫領（改成運動外套）
      skin: '#e8b896', hair: '#16110f', top: '#1f2229', pants: '#1f2229', stripe: '#f2f2f2', shoe: '#f4f4f4',
      shortHair: true, spiky: true, longSleeve: true, whistle: true, collar: '#ffffff', zip: '#cfd3d8',
      pal: { H: '#16110f', h: '#2b2220', S: '#e8b896', E: '#1a1210', N: '#d4a07e', M: '#b5675a' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHhHHHHHHhHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HSHHSSHHHSSHHSHH',
        'HSSSSSSSSSSSSSSH',
        'SSSSSSSSSSSSSSSS',
        'SSHHHSSSSSSHHHSS',
        'SSSSSSSSSSSSSSSS',
        'SSSEESSSSSSEESSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSNNSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSMMMMMMSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'NSSSSSSSSSSSSSSN',
      ],
    },
  },
  {
    name: '鄧老師', title: '體育組長',
    hello: ['🏀 鄧老師：同學要多運動唷！', '🏀 鄧老師：一起來打球吧！'],
    // 隨機出現：操場北邊那座籃球場，或活動中心（4F）的球場
    places: [
      { floor: '1F', where: '操場籃球場', at: () => { const T = D.outdoor.track; return [mx(T.center[0]) + 3, mz(T.center[1]) - 5.3, Math.PI]; } },
      { floor: '4F', where: '活動中心', at: () => { const r = rooms.find((x) => x.name === '活動中心'); return [r.cx - 2, r.cz + 1.5, Math.PI / 2]; } },
    ],
    at() { return this.places[0].at(); },
    look: {
      // 依照片：深咖啡色短髮（旁分）、淺膚色、細長眼、淺淺微笑；灰綠色 T 恤、白色短褲、紅色哨子（黑色掛繩）
      skin: '#ecbf9c', hair: '#3a2a20', top: '#557d7a', pants: '#f1efe8', stripe: '#9fcfb5', shoe: '#f4f4f4',
      shortHair: true, whistle: true,
      pal: { H: '#3a2a20', h: '#4d392b', S: '#ecbf9c', B: '#3a2a20', E: '#2a1a14', N: '#d6a382', M: '#b06a5c' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHhHHHHHHHHH',
        'HHHHHSSHHHHHHHHH',
        'HHSSSSSSHHHSSSHH',
        'HSSSSSSSSSSSSSSH',
        'SSBBBSSSSSSBBBSS',
        'SSSSSSSSSSSSSSSS',
        'SSSEESSSSSSEESSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSNNSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSMMMMMMSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'NSSSSSSSSSSSSSSN',
      ],
    },
  },
  {
    name: '阿喵老師', title: '電腦老師',
    hello: [
      '🐱 阿喵老師：要專心上課唷！',
      '😾 阿喵老師兇巴巴恰北北！',
      '🚀 阿喵老師：跟你們這些地球人溝通有問題，我要回火星！',
    ],
    // 1 樓電腦教室一（109）外面、靠中庭的走廊（敬業樓南側走廊），面向中庭
    at: () => [mx(1425), mz(565), Math.PI],
    look: {
      // 三花貓（擬人化）：白底＋橘色、黑色色塊，黑框眼鏡、琥珀色眼睛；大頭；淺藍襯衫＋卡其褲
      cat: true, headScale: 1.35, skin: '#fbf8f2', hair: '#fbf8f2', top: '#7fa7d6', collar: '#ffffff', pants: '#9b8a66', shoe: '#5a3d2b',
      longSleeve: true, ears: ['#2a2420', '#e8892b'], whisker: '#6b6b6b',
      patches: [['#e8892b', 0, 0, 7, 8], ['#e8892b', 10, 10, 6, 6], ['#2a2420', 9, 0, 7, 6], ['#2a2420', 0, 11, 5, 5]],
      pal: { W: '#fbf8f2', O: '#e8892b', B: '#2a2420', h: '#2a2420', K: '#141414', L: '#cfe8f7', E: '#e0a800', p: '#111111', P: '#e8899c', M: '#3a3a3a' },
      face: [
        'OOOOOOWWWBBBBBBB',
        'OOOOOWWWWWBBBBBB',
        'OOOOWWWWWWWBBBBB',
        'OOOWWWWWWWWWBBBB',
        'OKKKKKWWWWKKKKKB',
        'OKLEELKKKKLEELKB',
        'WKLEpLKWWKLpELKW',
        'WKKKKKWWWWKKKKKW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWPPWWWWWWW',
        'WWWWWWWMMWWWWWWW',
        'WWWWWWMWWMWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
      ],
    },
  },
];
// 把老師放到某一層的某個位置（名牌跟著走）
function placeNPC(n, f, x, z, yaw) {
  const gy = f.y + groundAt(f, x, z);                                  // 室內在樓板上、戶外在地面
  n.g.position.set(x, gy, z); n.g.rotation.y = yaw; n.yaw = yaw; n.f = f;
  if (n.g.parent !== f.group) f.group.add(n.g);
  n.label ||= makeLabel(n.name, n.title, 0, 0, 0, { bg: '#2d6a4f', h: 0.75 });
  if (n.label.parent !== f.labels) f.labels.add(n.label);
  n.label.position.set(x, gy + 2.45 + ((n.look.headScale || 1) - 1) * 0.9, z);
  n.label.userData.base = null;                                       // 讓 updateVisibility 重新算名牌大小與高度
}
// 有好幾個地方可以出現的老師：隨機挑一個（跟上次不一樣）
function movePlacesNPC(n) {
  let k; do k = Math.random() * n.places.length | 0; while (n.places.length > 1 && k === n.placeIdx);
  n.placeIdx = k;
  const p = n.places[k], [x, z, yaw] = p.at();
  placeNPC(n, floorById[p.floor], x, z, yaw);
}
for (const n of NPCS) {
  n.g = makeBlockNPC(n.look); n.near = false;
  n.g.traverse((o) => { if (o.isMesh) { o.userData.npc = n; pickables.push(o); } });
  if (n.places) movePlacesNPC(n);
  else { const [x, z, yaw] = n.at(); placeNPC(n, floors[1], x, z, yaw); }
}
// hello 可以是好幾句：每次隨機換一句（不會連續兩次一樣）
function meetNPC(n) {
  let line = n.hello;
  if (Array.isArray(n.hello)) {
    let k; do k = Math.random() * n.hello.length | 0; while (n.hello.length > 1 && k === n.last);
    n.last = k; line = n.hello[k];
  }
  const kid = savedGender() === 'girl' ? '👧' : '👦';
  toast(`${kid} 我：${n.name}好！<br>${line}`);                        // 學生遇到老師會先打招呼
}
function updateNPCs(t, dt) {
  for (const n of NPCS) {
    const { armL, armR } = n.g.userData.limbs;
    const dist = Math.hypot(player.x - n.g.position.x, player.z - n.g.position.z);
    const near = mode !== 'bird' && player.floor === n.f && dist < 2.2;
    // 會換地方的老師：每 75 秒換一次（你不在旁邊、也不在同一層的時候才換，不會在眼前突然消失）
    if (n.places) {
      n.moveT = (n.moveT || 0) + dt;
      if (n.moveT > 75 && player.floor !== n.f && !nav.target) { n.moveT = 0; movePlacesNPC(n); updateVisibility(); }
    }
    if (near && !n.near) meetNPC(n);
    n.near = near;
    // 靠近時轉身面向你、舉右手揮一揮；平常輕輕擺手
    const want = near ? Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z) : n.yaw;
    let d = want - n.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    n.g.rotation.y += d * Math.min(1, dt * 6);
    armR.rotation.z += ((near ? 2.6 + Math.sin(t * 8) * 0.35 : 0) - armR.rotation.z) * Math.min(1, dt * 8);
    armL.rotation.x = Math.sin(t * 1.6) * 0.08;
    if (n.g.userData.tail) n.g.userData.tail.rotation.z = Math.sin(t * 2.2) * 0.35;
    if (!near) armR.rotation.x = -armL.rotation.x;
  }
}

/* ---------------- 小鳥：中庭和操場草地上走路、啄地，人靠近就飛走；天上偶爾有一群飛過 ---------------- */

const BIRD_LOOK = {
  // 麻雀、白頭翁、八哥、斑鳩（臺灣校園常見）
  sparrow: { body: '#9a7350', head: '#7a4a2e', belly: '#e6dcc8', wing: '#6b4a32', beak: '#2b2b2b', size: 0.8 },
  bulbul: { body: '#7f8a5a', head: '#1f1f1f', belly: '#e8e6dc', wing: '#6f7a48', beak: '#1f1f1f', cap: '#ffffff', size: 0.9 },
  myna: { body: '#2b2b2e', head: '#1b1b1d', belly: '#3a3a3e', wing: '#2b2b2e', beak: '#f2c230', patch: '#ffffff', size: 1.05 },
  dove: { body: '#b8a79a', head: '#a8968a', belly: '#d8c8bc', wing: '#9a8678', beak: '#3a3030', collar: '#2b2b2b', size: 1.25 },
};
function makeBird(kind) {
  const L = BIRD_LOOK[kind], g = new THREE.Group(), s = L.size;
  const m = (c) => new THREE.MeshLambertMaterial({ color: c });
  const box = (p, w, h, d, c, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), m(c)); o.position.set(x * s, y * s, z * s); o.castShadow = true; p.add(o); return o; };
  const body = new THREE.Group(); g.add(body);
  box(body, 0.12, 0.1, 0.18, L.body, 0, 0.1, 0);
  box(body, 0.1, 0.04, 0.14, L.belly, 0, 0.06, -0.01);
  box(body, 0.06, 0.02, 0.12, L.wing, 0, 0.13, 0.13);                    // 尾巴
  const head = new THREE.Group(); head.position.set(0, 0.17 * s, -0.08 * s); body.add(head);
  box(head, 0.09, 0.08, 0.09, L.head, 0, 0, 0);
  box(head, 0.03, 0.025, 0.05, L.beak, 0, -0.01, -0.06);
  for (const x of [-0.046, 0.046]) box(head, 0.006, 0.015, 0.015, '#111111', x, 0.012, -0.02);
  if (L.cap) box(head, 0.092, 0.03, 0.04, L.cap, 0, 0.02, 0.03);         // 白頭翁的白色後腦
  if (L.patch) box(body, 0.13, 0.03, 0.04, L.patch, 0, 0.11, 0.02);       // 八哥翅膀上的白斑
  if (L.collar) box(head, 0.095, 0.02, 0.04, L.collar, 0, -0.04, 0.03);   // 斑鳩脖子的黑點
  const wings = [];
  for (const side of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(side * 0.06 * s, 0.13 * s, 0); body.add(p);
    box(p, 0.16, 0.012, 0.11, L.wing, side * 0.08, 0, 0);
    p.visible = false; wings.push(p);
  }
  for (const x of [-0.025, 0.025]) box(g, 0.01, 0.06, 0.01, '#d9a46a', x, 0.03, 0);
  g.userData = { body, head, wings, kind };
  return g;
}

const birds = [];
function placeBirds() {
  const f = floors[1], areas = [];
  const court = rooms.find((r) => r.name === '中庭');
  if (court) areas.push({ x1: court.m.x1 + 3, x2: court.m.x2 - 14, z1: court.m.z1 + 4, z2: court.m.z2 - 3 });
  const T = D.outdoor.track;
  if (T) {
    const cx = mx(T.center[0]), cz = mz(T.center[1]), A = T.size[0] / S / 2, B = T.size[1] / S / 2, Ls = A - B, r = B - 6;
    areas.push({ x1: cx - Ls - r + 2, x2: cx - Ls - 2, z1: cz - r * 0.6, z2: cz + r * 0.6 }, { x1: cx + Ls + 2, x2: cx + Ls + r - 2, z1: cz - r * 0.6, z2: cz + r * 0.6 });
  }
  const kinds = ['sparrow', 'sparrow', 'sparrow', 'bulbul', 'bulbul', 'myna', 'dove'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  areas.forEach((a, ai) => {
    for (let i = 0; i < 6; i++) {
      const g = makeBird(kinds[(ai * 3 + i) % kinds.length]);
      const x = rnd(a.x1, a.x2), z = rnd(a.z1, a.z2);
      g.position.set(x, f.y + groundAt(f, x, z), z); g.rotation.y = Math.random() * 6.28;
      f.group.add(g);
      birds.push({ g, area: a, state: 'peck', t: Math.random() * 3, tx: x, tz: z, fly: null });
    }
  });
  // 天上飛過的一群（白頭翁／麻雀），繞著校園飛
  const flock = new THREE.Group(); f.group.add(flock);
  for (let i = 0; i < 7; i++) {
    const g = makeBird(i % 2 ? 'sparrow' : 'bulbul');
    g.userData.wings.forEach((w) => (w.visible = true));
    g.position.set((i % 3) * 1.2 - 1.2, (i % 2) * 0.6, Math.floor(i / 3) * 1.1);
    flock.add(g);
  }
  birds.flock = { g: flock, t: Math.random() * 60 };
}
function updateBirds(t, dt) {
  const f = floors[1];
  const pf = player.floor === f, px = player.x, pz = player.z;
  for (const b of birds) {
    const g = b.g, u = g.userData;
    if (b.state === 'fly') {                                              // 飛到另一片草地
      b.fly.k += dt / b.fly.T;
      const k = Math.min(1, b.fly.k), { sx, sz, ex, ez, sy, ey } = b.fly;
      g.position.set(sx + (ex - sx) * k, sy + (ey - sy) * k + Math.sin(Math.PI * k) * 6, sz + (ez - sz) * k);
      g.rotation.y = Math.atan2(-(ex - sx), -(ez - sz));
      u.wings.forEach((w, i) => { w.visible = true; w.rotation.z = (i ? 1 : -1) * Math.sin(t * 28) * 0.9; });
      if (k >= 1) { b.state = 'peck'; b.t = 1 + Math.random() * 2; u.wings.forEach((w) => (w.visible = false)); }
      continue;
    }
    // 人走太近（2.8 公尺內）：飛走
    if (pf && Math.hypot(px - g.position.x, pz - g.position.z) < 2.8) {
      const others = birds.map((o) => o.area).filter((a) => a !== b.area), a = Math.random() < 0.6 && others.length ? others[Math.random() * others.length | 0] : b.area;
      const ex = a.x1 + Math.random() * (a.x2 - a.x1), ez = a.z1 + Math.random() * (a.z2 - a.z1);
      b.area = a;
      b.fly = { k: 0, T: Math.hypot(ex - g.position.x, ez - g.position.z) / 9 + 0.8, sx: g.position.x, sz: g.position.z, sy: g.position.y, ex, ez, ey: f.y + groundAt(f, ex, ez) };
      b.state = 'fly';
      continue;
    }
    b.t -= dt;
    if (b.state === 'peck') {                                             // 低頭啄一啄、轉頭看
      u.head.rotation.x = Math.max(0, Math.sin(t * 9 + g.id)) * 0.9;
      u.body.rotation.x = Math.max(0, Math.sin(t * 9 + g.id)) * 0.25;
      if (b.t <= 0) {
        b.state = 'hop';
        const a = b.area, r = 1.5 + Math.random() * 2.5, ang = Math.random() * 6.28;
        b.tx = Math.min(a.x2, Math.max(a.x1, g.position.x + Math.cos(ang) * r));
        b.tz = Math.min(a.z2, Math.max(a.z1, g.position.z + Math.sin(ang) * r));
      }
    } else {                                                              // 一跳一跳往前走
      const dx = b.tx - g.position.x, dz = b.tz - g.position.z, d = Math.hypot(dx, dz);
      u.head.rotation.x = 0; u.body.rotation.x = 0;
      if (d < 0.1) { b.state = 'peck'; b.t = 1 + Math.random() * 3; continue; }
      const step = Math.min(d, dt * 1.4);
      g.position.x += dx / d * step; g.position.z += dz / d * step;
      g.position.y = f.y + groundAt(f, g.position.x, g.position.z) + Math.abs(Math.sin(t * 14 + g.id)) * 0.06;
      g.rotation.y = Math.atan2(-dx, -dz);
    }
  }
  // 天上那群：每 40 秒飛過校園一次
  const fl = birds.flock;
  if (fl) {
    fl.t += dt;
    const k = (fl.t % 40) / 14;
    fl.g.visible = k <= 1;
    if (k <= 1) {
      const a = (fl.t / 40 | 0) * 1.7;
      const sx = Math.cos(a) * 110, sz = Math.sin(a) * 110;
      fl.g.position.set(sx * (1 - 2 * k), 16 + Math.sin(k * Math.PI) * 4, sz * (1 - 2 * k) + Math.sin(k * 9) * 3);
      fl.g.rotation.y = Math.atan2(sx, sz);
      fl.g.children.forEach((g, i) => g.userData.wings.forEach((w, j) => (w.rotation.z = (j ? 1 : -1) * Math.sin(t * 24 + i) * 0.9)));
    }
  }
}

/* ---------------- 設施互動：投籃、溜滑梯 ---------------- */

const act = { spot: null, busy: null, shots: 0, makes: 0 };
const actBtn = document.getElementById('actPrompt'), powerBox = document.getElementById('power');
const spotFloor = (sp) => floorByLevel[Math.round(sp.floorY / FLOOR_H)];
function nearestSpot() {
  if (mode === 'bird') return null;
  let best = null, bd = Infinity;
  for (const sp of SPOTS) {
    if (spotFloor(sp) !== player.floor) continue;
    const d = Math.hypot(player.x - sp.x, player.z - sp.z);
    // 籃框：要站在球場那一側、1～8 公尺內；溜滑梯：靠近就可以
    const ok = sp.kind === 'hoop' ? d > 1.0 && d < 8 && (player.x - sp.x) * sp.fx + (player.z - sp.z) * sp.fz > 0.3 : d < sp.r;
    if (ok && d < bd) { bd = d; best = sp; }
  }
  return best;
}
let actLabel = '';
function updateAct(dt) {
  if (act.busy) act.busy.tick(dt);
  act.spot = act.busy ? null : nearestSpot();
  const label = act.busy ? (act.busy.label ?? (act.busy.press ? '🏀 出手！ <kbd>F</kbd>' : ''))
    : act.spot ? (act.spot.kind === 'hoop' ? '🏀 投籃 <kbd>F</kbd>' : act.spot.kind === 'toy' ? `${TOYS[act.spot.toy].icon} 玩${act.spot.name} <kbd>F</kbd>` : `🛝 溜${act.spot.name} <kbd>F</kbd>`) : '';
  if (label !== actLabel) { actLabel = label; actBtn.innerHTML = label; actBtn.hidden = !label; }
}
function doAction() {
  if (act.busy) { act.busy.press?.(); return; }
  if (act.spot?.kind === 'hoop') startShot(act.spot);
  else if (act.spot?.kind === 'slide') startSlide(act.spot);
  else if (act.spot?.kind === 'toy') startToy(act.spot);
}
actBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
actBtn.addEventListener('click', doAction);
const limbs = () => avatar.userData.limbs;
function resetPose() { const L = limbs(); if (L) for (const k of ['armL', 'armR', 'legL', 'legR']) L[k].rotation.set(0, 0, 0); }

/* ---------------- 草地上的童玩：跳繩、扯鈴、小飛機 ---------------- */

const TOYS = {
  rope: { icon: '🪢', name: '跳繩' },
  yoyo: { icon: '🪀', name: '扯鈴' },
  plane: { icon: '✈️', name: '丟小飛機' },
};
// 童玩擺放處（中庭草地、操場兩端草地）：地上放一個小籃子，靠近就可以玩
function placeToys() {
  const b = new Batch(), f = floors[1], spots = [];
  const court = rooms.find((r) => r.name === '中庭');
  if (court) {
    const m = court.m, cx = (m.x1 + m.x2) / 2, cz = (m.z1 + m.z2) / 2;
    spots.push(['rope', cx - 6, cz - 2.5], ['yoyo', cx - 2, cz + 2.5], ['plane', cx - 10, cz + 1.5]);
  }
  const T = D.outdoor.track;
  if (T) {
    const cx = mx(T.center[0]), cz = mz(T.center[1]), A = T.size[0] / S / 2, B = T.size[1] / S / 2, Ls = A - B;
    spots.push(['plane', cx - Ls - 6, cz - 3], ['rope', cx + Ls + 6, cz - 3], ['yoyo', cx + Ls + 6, cz + 3]);
  }
  const basket = { rope: '#e85d75', yoyo: '#3b82f6', plane: '#f2c230' };
  for (const [toy, x, z] of spots) {
    const gy = f.y + groundAt(f, x, z);
    b.box(mat('wool', basket[toy]), 0.5, 0.28, 0.36, x, gy + 0.14, z);          // 小籃子
    b.box(mat('wool', '#ffffff'), 0.42, 0.04, 0.28, x, gy + 0.3, z);
    if (toy === 'rope') b.box(mat('wool', '#f2c230'), 0.08, 0.14, 0.08, x - 0.12, gy + 0.36, z);   // 跳繩握把
    if (toy === 'yoyo') { b.box(mat('wool', '#e53935'), 0.14, 0.14, 0.14, x, gy + 0.38, z); b.box(mat('wool', '#8b5a2b'), 0.5, 0.03, 0.03, x, gy + 0.33, z + 0.08); }
    if (toy === 'plane') { b.box(mat('wool', '#f4f4f2'), 0.08, 0.04, 0.4, x, gy + 0.34, z); b.box(mat('wool', '#f4f4f2'), 0.5, 0.02, 0.12, x, gy + 0.36, z); }
    SPOTS.push({ kind: 'toy', toy, name: TOYS[toy].name, x, z, r: 1.8, floorY: 0 });
  }
  b.build(f.group);
}

// 繩子：從左手繞過腳底到右手（以手的高度為軸旋轉）
function makeRope() {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; pts.push(new THREE.Vector3(-Math.cos(a) * 0.36, -Math.sin(a) * 0.95, 0)); }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 5), new THREE.MeshLambertMaterial({ color: '#e85d75' })));
  return g;
}
function makeDiabolo() {
  const g = new THREE.Group(), red = new THREE.MeshLambertMaterial({ color: '#e53935' });
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.03, 0.12, 12), red); c.rotation.z = s * Math.PI / 2; c.position.x = s * 0.06; g.add(c); }
  return g;
}
function makePlane() {
  const g = new THREE.Group(), w = new THREE.MeshLambertMaterial({ color: '#f4f4f2' }), r = new THREE.MeshLambertMaterial({ color: '#e53935' });
  const add = (m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); g.add(o); };
  add(w, 0, 0, 0, 0.06, 0.05, 0.5); add(w, 0, 0.02, -0.04, 0.55, 0.015, 0.14); add(w, 0, 0.02, 0.22, 0.2, 0.015, 0.06); add(r, 0, 0.06, 0.22, 0.015, 0.1, 0.06); add(r, 0, 0, -0.26, 0.07, 0.06, 0.05);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
const toyProps = { rope: makeRope(), yoyo: makeDiabolo(), sticks: new THREE.Group(), plane: makePlane() };
{
  const stick = new THREE.MeshLambertMaterial({ color: '#8b5a2b' });
  for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.45), stick); o.position.set(s * 0.3, 0.62, -0.25); toyProps.sticks.add(o); }
}
toyProps.yoyoString = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 0.01), new THREE.MeshBasicMaterial({ color: '#f4f4f2' }));
toyProps.plane.scale.setScalar(1.8); toyProps.plane.visible = false; scene.add(toyProps.plane);

function startToy(sp) {
  stopAuto();
  const L = limbs();
  let t = 0;
  if (sp.toy === 'rope') {
    const rope = toyProps.rope; rope.position.set(0, 0.68, 0); avatar.add(rope);
    let count = 0, wasUp = false;
    act.busy = {
      toy: 'rope',
      get label() { return `🪢 跳了 <b>${count}</b> 下　停止 <kbd>F</kbd>`; },
      tick(dt) {
        t += dt;
        const ph = t * Math.PI * 2 * 1.4;                                  // 一秒轉 1.4 圈
        rope.rotation.x = ph;
        const c = Math.cos(ph);                                             // 繩子在腳底時（c≈1）跳最高
        player.jump = Math.max(0, c) * 0.28; player.vy = 0;
        if (L) { L.armL.rotation.z = -0.45; L.armR.rotation.z = 0.45; L.armL.rotation.x = L.armR.rotation.x = -0.35 + Math.sin(ph) * 0.18; L.legL.rotation.x = L.legR.rotation.x = -Math.max(0, c) * 0.25; }
        // 每次繩子過腳底（跳到最高點）算一下
        const up = c > 0.9;
        if (up && !wasUp) { count++; if (count % 10 === 0) toast(`🪢 跳了 ${count} 下！`); }
        wasUp = up;
      },
      press() { this.stop(); },
      stop() { avatar.remove(rope); player.jump = 0; resetPose(); act.busy = null; toast(`🪢 一共跳了 ${count} 下！`); },
    };
  } else if (sp.toy === 'yoyo') {
    const d = toyProps.yoyo, st = toyProps.sticks, str = toyProps.yoyoString;
    avatar.add(d, st, str);
    let toss = -1, tosses = 0;
    act.busy = {
      toy: 'yoyo',
      label: '🪀 往上拋 <kbd>F</kbd>　（走開就停）',
      tick(dt) {
        t += dt;
        d.rotation.x += dt * 30;                                            // 扯鈴一直轉
        const sw = Math.sin(t * 6);
        let y = 0.42 + sw * 0.05;
        if (toss >= 0) {                                                    // 拋起來再接住
          toss += dt;
          const T = 1.3, k = toss / T;
          y = 0.42 + Math.sin(Math.PI * Math.min(1, k)) * 2.6;
          if (k >= 1) { toss = -1; tosses++; toast(`🪀 接住了！（${tosses}）`); }
        }
        d.position.set(0, y, -0.45);
        str.visible = toss < 0;
        str.position.set(0, 0.5 + sw * 0.03, -0.45); str.scale.x = 0.6;
        if (L) { L.armL.rotation.x = -0.9 + sw * 0.35; L.armR.rotation.x = -0.9 - sw * 0.35; L.armL.rotation.z = -0.2; L.armR.rotation.z = 0.2; }
        st.children[0].position.y = 0.62 + sw * 0.12; st.children[1].position.y = 0.62 - sw * 0.12;
        if (Math.hypot(player.x - sp.x, player.z - sp.z) > 3) this.stop();
      },
      press() { if (toss < 0) toss = 0; },
      stop() { avatar.remove(d, st, str); resetPose(); act.busy = null; },
    };
  } else {
    // 小飛機：右手往後拉、往前丟，沿著面向的方向滑翔出去
    const pl = toyProps.plane, f = player.floor, yaw = avatar.rotation.y;
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const start = new THREE.Vector3(player.x, f.y + (player.gy || 0) + 1.5, player.z).addScaledVector(dir, 0.4);
    const dist = 9 + Math.random() * 6, T = 2.6;
    pl.visible = false;
    act.busy = {
      label: '',
      tick(dt) {
        t += dt;
        if (L) L.armR.rotation.x = t < 0.35 ? -2.6 * (t / 0.35) - 0.3 : Math.min(0, -2.9 + (t - 0.35) * 8);
        if (t < 0.35) return;
        const k = Math.min(1, (t - 0.35) / T), gy = f.y + groundAt(f, start.x + dir.x * dist * k, start.z + dir.z * dist * k);
        pl.visible = true;
        pl.position.copy(start).addScaledVector(dir, dist * k);
        pl.position.y = Math.max(gy + 0.05, start.y + Math.sin(Math.PI * k) * 1.6 - k * (start.y - gy));
        pl.rotation.set(0, yaw, 0); pl.rotateX(-Math.cos(Math.PI * k) * 0.35); pl.rotateZ(Math.sin(t * 3) * 0.2);
        if (t > 0.35 + T + 1.2) { pl.visible = false; resetPose(); act.busy = null; toast('✈️ 飛好遠！再丟一次？'); }
      },
    };
  }
}

// 籃球：橘色、黑色線
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshLambertMaterial({ map: (() => {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const c = cv.getContext('2d'); c.fillStyle = '#e8701f'; c.fillRect(0, 0, 128, 64);
  c.strokeStyle = '#2a1508'; c.lineWidth = 3;
  for (const x of [0, 32, 64, 96]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 64); c.stroke(); }
  c.beginPath(); c.moveTo(0, 32); c.lineTo(128, 32); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})() }));
ball.castShadow = true; ball.visible = false;
scene.add(ball);

function startShot(sp) {
  stopAuto();
  const dx = sp.x - player.x, dz = sp.z - player.z, dist = Math.hypot(dx, dz);
  const face = Math.atan2(-dx, -dz);
  avatar.rotation.y = face; player.yaw = face; player.pitch = 0.05;   // 面向籃框，鏡頭在背後
  // 越遠越難：要的力道越大、綠色區域越窄
  const ideal = Math.max(0.3, Math.min(0.82, 0.38 + dist * 0.055)), tol = Math.max(0.05, 0.12 - dist * 0.008);
  powerBox.querySelector('.sweet').style.cssText = `left:${(ideal - tol) * 100}%;width:${tol * 200}%`;
  const bar = powerBox.querySelector('.bar');
  powerBox.hidden = false;
  let t = 0, p = 0;
  act.busy = {
    tick(dt) {
      t += dt; p = (1 - Math.cos(t * 3.4)) / 2; bar.style.left = `${p * 100}%`;
      const L = limbs(); if (L) { L.armL.rotation.x = L.armR.rotation.x = -2.5 - p * 0.4; }   // 舉手準備
    },
    press() { powerBox.hidden = true; shoot(sp, p, ideal, tol); },
  };
}
function shoot(sp, p, ideal, tol) {
  const made = Math.abs(p - ideal) <= tol, err = p - ideal;
  const f = player.floor, sx = player.x, sz = player.z, sy = f.y + (player.gy || 0) + 2.0 * AVATAR_SCALE;
  const dx = sp.x - sx, dz = sp.z - sz, dist = Math.hypot(dx, dz), ux = dx / dist, uz = dz / dist;
  // 沒進：太小力就短、太大力就長（打板），再加一點左右偏
  const side = made ? 0 : (Math.random() - 0.5) * 0.5, over = made ? 0 : Math.max(-1.5, Math.min(0.55, err * 3));
  const tx = sp.x + ux * over - uz * side, tz = sp.z + uz * over + ux * side, ty = sp.y + (made ? 0.12 : 0.05);
  const T = 0.75 + dist * 0.05, G = 9.8, vy = (ty - sy + 0.5 * G * T * T) / T;
  ball.position.set(sx, sy, sz); ball.visible = true;
  act.shots++;
  const L = limbs(); if (L) { L.armL.rotation.x = L.armR.rotation.x = -3.0; }
  let t = 0, phys = null, life = 0;
  act.busy = {
    tick(dt) {
      t += dt;
      if (!phys) {
        const k = Math.min(1, t / T);
        ball.position.set(sx + (tx - sx) * k, sy + vy * t - 0.5 * G * t * t, sz + (tz - sz) * k);
        ball.rotation.x -= dt * 8;
        if (t > 0.35) resetPose();
        if (t < T) return;
        // 到籃框了：進球就從網子掉下去；沒進就彈開
        if (made) { phys = { vx: 0, vy: -1.5, vz: 0 }; act.makes++; toast(`🏀 進球！（${act.makes} / ${act.shots}）`); }
        else {
          phys = { vx: -ux * (over > 0 ? 1.8 : 0.6) + (Math.random() - 0.5), vy: over > 0.25 ? 1.2 : 2.6, vz: -uz * (over > 0 ? 1.8 : 0.6) + (Math.random() - 0.5) };
          toast(err < 0 ? `差一點！力道太小（${act.makes} / ${act.shots}）` : `差一點！力道太大（${act.makes} / ${act.shots}）`);
        }
        return;
      }
      // 掉到地上彈幾下
      life += dt;
      phys.vy -= G * dt;
      ball.position.x += phys.vx * dt; ball.position.y += phys.vy * dt; ball.position.z += phys.vz * dt;
      const floorY = f.y + groundAt(f, ball.position.x, ball.position.z) + 0.13;
      if (ball.position.y < floorY) { ball.position.y = floorY; phys.vy = Math.abs(phys.vy) * 0.55; phys.vx *= 0.7; phys.vz *= 0.7; }
      if (life > 1.6) { ball.visible = false; act.busy = null; }
    },
  };
}

// 溜滑梯：先爬到滑梯頂端，再沿著滑道滑下來
function startSlide(sp) {
  stopAuto();
  const path = sp.path.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const seg = []; let total = 0;
  for (let i = 1; i < path.length; i++) { const l = path[i].distanceTo(path[i - 1]); seg.push(l); total += l; }
  const f = player.floor, from = new THREE.Vector3(player.x, f.y + (player.gy || 0), player.z);
  const CLIMB = 1.1;
  let t = 0, s = 0, v = 2.5;
  const setPos = (p, look) => {
    player.x = p.x; player.z = p.z; player.ride = p.y;
    if (look) {
      const yaw = Math.atan2(-(look.x - p.x), -(look.z - p.z));
      avatar.rotation.y = yaw;
      player.yaw += ((((yaw - player.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.15;   // 鏡頭慢慢跟著轉
    }
  };
  act.busy = {
    tick(dt) {
      t += dt;
      const L = limbs();
      if (t < CLIMB) {                                   // 爬上去
        const k = t / CLIMB, top = path[0];
        const p = new THREE.Vector3().lerpVectors(from, top, k);
        p.y = from.y + (top.y - from.y) * Math.sin(k * Math.PI / 2);
        setPos(p, top.distanceTo(p) > 0.2 ? top : null);
        if (L) { L.armL.rotation.x = -2.6 + Math.sin(t * 14) * 0.5; L.armR.rotation.x = -2.6 - Math.sin(t * 14) * 0.5; L.legL.rotation.x = Math.sin(t * 14) * 0.6; L.legR.rotation.x = -L.legL.rotation.x; }
        return;
      }
      v = Math.min(7, v + dt * 5); s += v * dt;          // 越滑越快
      if (s >= total) {
        const end = path.at(-1);
        player.x = end.x; player.z = end.z; player.ride = null; player.gy = groundAt(f, end.x, end.z);
        resetPose(); act.busy = null;
        toast('🛝 咻～好好玩！');
        return;
      }
      let i = 0, rem = s;
      while (i < seg.length - 1 && rem > seg[i]) rem -= seg[i++];
      const p = new THREE.Vector3().lerpVectors(path[i], path[i + 1], Math.min(1, rem / seg[i]));
      setPos(p, path[i + 1]);
      if (L) { L.legL.rotation.x = L.legR.rotation.x = -1.45; L.armL.rotation.x = L.armR.rotation.x = -0.9; }   // 坐著滑、手往前
    },
  };
}

/* ---------------- 主迴圈 ---------------- */

const clock = new THREE.Clock();
let navTick = 0, walkPhase = 0, walkAmt = 0;


// 第三人稱鏡頭：zoom 是想要的距離（滾輪可調），dist 是實際距離（被擋住時會拉近）
const cam = { zoom: 5.5 * AVATAR_SCALE, dist: 5.5 * AVATAR_SCALE };
const floorByLevel = Object.fromEntries(floors.map((f) => [f.level, f]));
// 這一層在 (x, z) 有沒有地板（樓梯間往下的地方是空的；1 樓到處都是地面）
function slabSolid(f, x, z) {
  for (const w of f.walk) {
    if (!inRect(w.m, x, z)) continue;
    if (!w.stair?.g) { if (w.kind !== 'outdoor' || f.level === 0) return true; continue; }
    const g = w.stair.g, [u, v] = g.toUV(x, z);
    if (u < g.s0 || (v < g.Wd / 2 && u < g.f1) || !stairPrev(w.stair, f)) return true;
    return false;
  }
  return f.level === 0;
}
function camBlocked(x, y, z) {
  const f = floorByLevel[Math.floor((y + 0.02) / FLOOR_H)];
  if (!f) return y < floors[0].y;                          // 最頂樓再上面是天空
  const ly = y - f.y;
  if (ly < 0.06) return slabSolid(f, x, z);                // 地面、樓板
  if (ly > WALL_H - 0.05) {                                // 天花板、上一層的樓板
    if (f.ceilRects?.some((m) => inRect(m, x, z))) return true;
    const above = floors[f.idx + 1];
    if (above && slabSolid(above, x, z)) return true;
  }
  const cell = cellAt(f, x, z), r = WALL_T / 2 + 0.15;
  for (const s of cell.segs) {
    const y0 = s.overhead ? s.y0 : 0;
    if (ly < y0 || ly > s.h) continue;
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
    if (Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) < r) return true;
  }
  if (player.ride != null) return false;                   // 溜滑梯時鏡頭可以穿過遊樂器材，才看得到自己在滑
  for (const o of cell.cam) {
    if (x > o.x1 - 0.12 && x < o.x2 + 0.12 && z > o.z1 - 0.12 && z < o.z2 + 0.12 && y > o.y1 - 0.12 && y < o.y2 + 0.12) return true;
  }
  return false;
}
// 卡住了（在牆裡、家具裡、走不到的地方超過半秒）：移到附近可以走的位置
let stuckT = 0;
function unstick(dt) {
  const f = player.floor;
  let bad = !isWalkable(f, player.x, player.z, 0.05);
  if (!bad) {
    const [nx, nz] = collide(f, player.x, player.z);
    bad = Math.hypot(nx - player.x, nz - player.z) > 0.2;     // 被兩邊夾住推不出去
  }
  stuckT = bad ? stuckT + dt : 0;
  if (stuckT < 0.5) return;
  stuckT = 0;
  const g = getGrid(f), c = nearestFree(g, Math.floor((player.x - g.minx) / CELL), Math.floor((player.z - g.minz) / CELL));
  if (!c) return;
  player.x = g.minx + (c[0] + 0.5) * CELL; player.z = g.minz + (c[1] + 0.5) * CELL;
  followStairs();
}

function update(dt) {
  const t = clock.elapsedTime;
  if (mode !== 'bird') {
    let fx = 0, fz = 0;
    if (keys.KeyW || keys.ArrowUp) fz += 1;
    if (keys.KeyS || keys.ArrowDown) fz -= 1;
    if (keys.KeyA) fx -= 1;
    if (keys.KeyD) fx += 1;
    if (keys.ArrowLeft) player.yaw += 2.2 * dt * settings.sens;
    if (keys.ArrowRight) player.yaw -= 2.2 * dt * settings.sens;
    fx += joy.x; fz -= joy.y;
    if (act.busy?.toy && Math.hypot(fx, fz) > 0.05) act.busy.stop();   // 跳繩、扯鈴：一走開就停
    if (act.busy) fx = fz = 0;                                  // 投籃、溜滑梯時先不能走
    const mag = Math.hypot(fx, fz);
    let moved = 0;
    if (mag > 0.05) {
      const speed = 4 * settings.speed * (keys.ShiftLeft || keys.ShiftRight ? 1.9 : 1) * Math.min(1, mag);
      fx /= mag; fz /= mag;
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      const dx = (-sin * fz + cos * fx) * speed * dt, dz = (-cos * fz - sin * fx) * speed * dt;
      const ox = player.x, oz = player.z;
      tryMove(dx, dz);
      moved = Math.hypot(player.x - ox, player.z - oz);
      avatar.rotation.y = Math.atan2(-dx, -dz);
      if (auto.pts) stopAuto();                                 // 自己動方向鍵就取消自動走
    } else if (auto.pts) {
      moved = stepAuto(dt);
    }
    // 方塊人走路擺手擺腳
    if (avatar.userData.limbs) {
      walkPhase += moved * 3.2;
      walkAmt += ((moved > 0.001 ? 1 : 0) - walkAmt) * Math.min(1, dt * 10);
      if (!act.busy) animatePerson(avatar, walkPhase, walkAmt);
    }
    updateAct(dt);
    // 跳
    if (!act.busy?.label?.includes('跳繩') && (player.vy !== 0 || player.jump > 0)) {
      player.vy -= 12 * dt; player.jump += player.vy * dt;
      if (player.jump <= 0) { player.jump = 0; player.vy = 0; }
    }
    updateStairPanel();
    updatePanoPrompt();
    updateWhere(dt);
    const nearCat = player.floor.level === 0 && Math.hypot(player.x - cat.position.x, player.z - cat.position.z) < 1.8;
    if (nearCat && !catNear) meetCat();
    catNear = nearCat;
    if (nav.target && (navTick += dt) > 0.3) {
      navTick = 0;
      updateNavBar();
      if (player.floor === nav.target.f && (inRect(nav.target.m, player.x, player.z, -0.4) || Math.hypot(player.x - nav.target.cx, player.z - nav.target.cz) < 1.6)) {   // 走進教室就算到（教室中間有桌椅，走不到正中央）
        toast(`🎉 到達 ${nav.target.display}！`);
        clearNav();
      }
    }
  }
  // 司令臺、入口階梯這類墊高的地面：慢慢升降，看起來像踩上去（樓梯上的高度在 followStairs 算好了）
  if (!player.onStair && player.ride == null) {
    const gy = groundAt(player.floor, player.x, player.z);
    player.gy = (player.gy ?? 0) + (gy - (player.gy ?? 0)) * Math.min(1, dt * 12);
  }
  if (mode !== 'bird' && !act.busy) unstick(dt);
  const py = player.ride ?? player.floor.y + player.gy + player.jump;   // ride：溜滑梯時的高度
  avatar.position.set(player.x, py, player.z);

  if (mode === 'first') {
    camera.position.set(player.x, py + EYE_H, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  } else if (mode === 'third') {
    const head = new THREE.Vector3(player.x, py + 1.6 * AVATAR_SCALE, player.z);
    const pitch = Math.max(-0.9, Math.min(0.5, player.pitch - 0.35));
    const dir = new THREE.Vector3(Math.sin(player.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(player.yaw) * Math.cos(pitch));
    // 鏡頭往後拉的路上如果碰到牆、天花板、樹、建築，就停在它前面；拉近要馬上，退回去要慢慢的（才不會一直跳）
    let want = cam.zoom, lv = Math.floor(head.y / FLOOR_H);
    for (let d = 0.3; d <= cam.zoom; d += 0.12) {
      const x = head.x + dir.x * d, y = head.y + dir.y * d, z = head.z + dir.z * d, l = Math.floor(y / FLOOR_H);
      // 穿過一層樓板（樓板很薄，每一小段檢查可能會跳過）：在穿過的那一點檢查有沒有地板
      const crossed = l !== lv && floorByLevel[Math.max(l, lv)] && slabSolid(floorByLevel[Math.max(l, lv)], x, z);
      lv = l;
      if (crossed || camBlocked(x, y, z)) { want = Math.max(0.45, d - 0.3); break; }
    }
    cam.dist = want < cam.dist ? want : cam.dist + (want - cam.dist) * Math.min(1, dt * 3);
    camera.position.copy(head).addScaledVector(dir, cam.dist);
    if (player.ride != null) {                               // 溜滑梯：從側邊拍，看得到整個滑下來的樣子
      const r = avatar.rotation.y;
      camera.position.set(head.x + Math.sin(r) * 2.2 + Math.cos(r) * 4.2, head.y + 1.6, head.z + Math.cos(r) * 2.2 - Math.sin(r) * 4.2);
    }
    camera.lookAt(head);
    avatar.visible = cam.dist > 1.3 || player.ride != null;                         // 鏡頭貼到身上時先把自己藏起來，免得整個畫面都是後腦勺
  } else {
    orbit.update();
  }

  if (floors[1].group.visible) { cat.userData.anim(t); updateBirds(t, dt); }
  updateNPCs(t, dt);
  // 雲慢慢飄
  if (clouds) {
    const sp = clouds.userData.spread;
    for (const c of clouds.children) { c.position.x += dt * 1.5; if (c.position.x > sp) c.position.x = -sp; }
  }
  // 動畫：樓梯標記、導航箭頭、目的地光圈
  const pulse = 0.35 + 0.25 * Math.sin(t * 4);
  for (const f of floors) {
    if (!f.group.visible) continue;
    f.group.traverse((o) => {
      if (o.userData.pulse) o.material.opacity = pulse + 0.2;
      if (o.userData.pano && o.isSprite && o.userData.bob !== undefined) {
        o.position.y = f.y + 1.7 + 0.15 * Math.sin(t * 2.5 + o.userData.bob);
        o.visible = o.position.distanceTo(camera.position) > 2.8;   // 太靠近鏡頭就先藏起來，免得擋住畫面
      }
    });
    for (const a of f.navGroup.children) if (a.userData.arrow) a.position.y = f.y + 0.3 + 0.08 * Math.sin(t * 6 + a.position.x + a.position.z);
  }
}

function loop() {
  requestAnimationFrame(loop);
  if (viewer.isOpen) return;          // 看環景時 3D 校園暫停，省電
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  drawMinimap();
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------------- 碰撞資料整理（全部蓋好之後） ---------------- */

function setupCollision() {
  const f1 = floorById['1F'];
  // 老師 NPC：站著的地方擋一下，不會穿過去
  for (const n of NPCS) {
    if (n.places) continue;
    const p = n.g.position;
    f1.boxes.push({ x1: p.x - 0.25, x2: p.x + 0.25, z1: p.z - 0.2, z2: p.z + 0.2, y1: 0, y2: 1.8 });
  }
  // 正門左邊的圓柱塔（乙梯）：半圓形的外牆
  const T = D.outdoor.tower;
  if (T) {
    const r = T.r / S, cx = mx(T.cx), cz = mz(T.cy), N = 12;
    for (let k = 0; k < N; k++) {
      const a0 = Math.PI + (Math.PI * k) / N, a1 = Math.PI + (Math.PI * (k + 1)) / N;
      f1.segs.push({ ax: cx + r * Math.sin(a0), az: cz + r * Math.cos(a0), bx: cx + r * Math.sin(a1), bz: cz + r * Math.cos(a1),
        h: T.floors * FLOOR_H, color: BEIGE, kind: 'wall', noRender: true });
    }
  }
  // 門口位置（走路頂到門框時會被帶進門）：房間的門＋游泳館大門
  for (const r of rooms) for (const d of r.doorPts || []) {
    const ns = 'NS'.includes(d.side);
    (r.f.doors ||= []).push({ x: d.x, z: d.z, nx: ns ? 0 : 1, nz: ns ? 1 : 0 });   // n：門的法線方向（穿過門的方向）
  }
  if (D.outdoor.pool) { const pm = rectM(D.outdoor.pool), [d0, d1] = poolDoor(pm); (f1.doors ||= []).push({ x: (d0 + d1) / 2, z: pm.z1, nx: 0, nz: 1 }); }
  for (const f of floors) {
    // 1 樓墊高的平台（司令臺、花台、階梯）本身不算擋路，是可以踩上去的地面
    const isGround = (b) => f.level === 0 && b.y2 - f.y <= groundAt(f, (b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2) + 0.2;
    f.obs = f.boxes.filter((b) => isObstacle(b, f) && !isGround(b));
    // 擋鏡頭的：夠大的方塊（樹冠、櫃子、遊樂器材、建築立面）
    f.camBoxes = f.boxes.filter((b) => Math.min(b.x2 - b.x1, b.z2 - b.z1, b.y2 - b.y1) >= 0.3);
    f.grid = null;
    buildIndex(f);
  }
}

/* ---------------- 啟動 ---------------- */

await Promise.all([
  document.fonts?.load('700 46px "Noto Sans TC"'),
  BLOCKY && document.fonts?.load('44px "Cubic 11"', '溪口國小'),
]).catch(() => {});
for (const f of floors) buildFloor(f);
buildPlinth();
Batch.collector = floors[1].boxes;
buildOutdoor();
placeToys();
placeBirds();
Batch.collector = null;
setupCollision();
buildPanoMarkers();

// 起點：正門外面，面向校門（往東）
const G = D.outdoor.gate;
placeAt(floorById['1F'], mx(G.x - 50), mz((G.y1 + G.y2) / 2), -Math.PI / 2);
setMode('third');                // 預設第三人稱（依使用者要求）
viewFloor = 'all';
orbit.target.set(0, 4, 0);
camera.position.set(40, 70, 85);
updateVisibility(); updateFloorButtons();

const params = new URLSearchParams(location.search);
const qRoom = params.get('room') || params.get('go');
if (qRoom) {
  const r = rooms.find((x) => x.id === qRoom || x.code === qRoom || x.no === qRoom || x.name === qRoom);
  if (r) params.get('go') ? navigateTo(r) : focusRoom(r);
}
if (params.get('pano') && viewer.byImg[params.get('pano')]) openPano(viewer.byImg[params.get('pano')]);
document.getElementById('loading').remove();
// 第一次來（而且不是從分享連結進來）：先選角色
// 每次進網站都先選男生／女生（第三人稱）；用 ?room= ?pano= 分享連結進來的就不打擾
document.querySelectorAll('[data-gender]').forEach((b) => b.classList.toggle('on', b.dataset.gender === savedGender()));
document.getElementById('changeAvatar').onclick = () => { document.getElementById('help').hidden = true; openChooser(); };
document.getElementById('avatarBtn').onclick = () => openChooser();

/* ---------------- 首頁封面（參考 DSLab）：用自己的 3D 模型拍一張等角全景，配上紙條標籤 ---------------- */

const COVER_SPOTS = [
  { title: '敬業樓', sub: 'A · JING YE', lift: 40, note: '圖書館、會議室、校長室、電腦教室，五樓活動中心', acc: '#c0392b',
    at: () => [mx(1100), BASE + 5 * FLOOR_H + 1, mz(360)], go: () => [floorById['1F'], mx(1300), mz(364), Math.PI / 2] },
  { title: '至善樓', sub: 'B · ZHI SHAN', note: '幼兒園教室、潛能教室，頂樓菜園', acc: '#2f6fb5',
    at: () => [mx(1620), BASE + 4 * FLOOR_H + 1, mz(820)], go: () => [floorById['1F'], mx(1526), mz(700), 0] },
  { title: '勤學樓', sub: 'C · QIN XUE', note: '學務處、健康中心、幼兒園，樓上是班級教室', acc: '#d9730d',
    at: () => [mx(1110), BASE + 4 * FLOOR_H + 1, mz(1180)], go: () => [floorById['1F'], mx(1100), mz(1082), -Math.PI / 2] },
  { title: '思源樓', sub: 'D · SI YUAN', lift: 84, dx: 10, note: '正門穿堂、教務處、總務處，樓上是班級教室', acc: '#2d8a57',
    at: () => [mx(580), BASE + 4 * FLOOR_H + 1, mz(820)], go: () => [floorById['1F'], mx(560), mz(825), -Math.PI / 2] },
  { title: '操場', sub: 'SPORTS FIELD', lift: 78, dx: -48, note: '跑道、籃球場、司令臺', acc: '#2d8a57',
    at: () => [mx(D.outdoor.track.center[0]), 0, mz(D.outdoor.track.center[1])],
    go: () => { const T = D.outdoor.track; return [floorById['1F'], mx(T.center[0]), mz(T.center[1]), 0]; } },
  { title: '水漾游泳館', sub: 'SWIMMING POOL', lift: 26, dx: 30, note: '室內 25 公尺泳池', acc: '#2f6fb5',
    at: () => { const m = rectM(D.outdoor.pool); return [(m.x1 + m.x2) / 2, 6.5, (m.z1 + m.z2) / 2]; },
    go: () => { const m = rectM(D.outdoor.pool), [d0, d1] = poolDoor(m); return [floorById['1F'], (d0 + d1) / 2, m.z1 - 3, Math.PI]; } },
  { title: '正門', sub: 'MAIN GATE', lift: 20, dx: -46, note: '從這裡走進校園', acc: '#c0392b',
    at: () => [mx(D.outdoor.gate.x), 0, mz((D.outdoor.gate.y1 + D.outdoor.gate.y2) / 2)],
    go: () => [floorById['1F'], mx(D.outdoor.gate.x - 50), mz((D.outdoor.gate.y1 + D.outdoor.gate.y2) / 2), -Math.PI / 2] },
];
let coverGo = null;

// 用正交相機從東南方斜上往下拍整座浮空島（背景換成米白紙色），拍完把場景還原
function renderCover() {
  const W = renderer.domElement.width, H = renderer.domElement.height, aspect = W / H;
  const c0 = new THREE.Vector3((ISL.x1 + ISL.x2) / 2, -8, (ISL.z1 + ISL.z2) / 2);
  const wide = aspect > 1.15;
  const halfH = wide ? 80 : Math.max(80, 92 / aspect);
  const halfW = halfH * aspect, fx = wide ? 0.6 : 0.5;                 // 寬螢幕：島放在右邊一點，左邊留給文字
  const cam = new THREE.OrthographicCamera(-2 * halfW * fx, 2 * halfW * (1 - fx), wide ? halfH : halfH * 1.02, wide ? -halfH : -halfH * 0.98, 1, 2000);
  cam.position.copy(c0).add(new THREE.Vector3(0.62, 0.78, 1).normalize().multiplyScalar(600));
  cam.lookAt(c0);
  cam.updateProjectionMatrix();
  // 暫時換掉的東西
  const saved = { bg: scene.background, fog: scene.fog, avatar: avatar.visible, bl: buildingLabels.visible, clouds: clouds?.visible, dest: destMark.visible };
  const hidden = [];
  scene.background = new THREE.Color('#f3eee3'); scene.fog = null;
  avatar.visible = false; buildingLabels.visible = false; destMark.visible = false;
  if (clouds) clouds.visible = false;
  for (const f of floors) {
    hidden.push([f.group, f.group.visible], [f.labels, f.labels.visible], [f.ceil, f.ceil.visible], [f.navGroup, f.navGroup.visible]);
    f.group.visible = true; f.labels.visible = false; f.ceil.visible = true; f.navGroup.visible = false;
    f.group.traverse((o) => { if (o.userData.pano || o.userData.pulse) { hidden.push([o, o.visible]); o.visible = false; } });
  }
  setIsland(true);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/jpeg', 0.9);
  const pos = COVER_SPOTS.map((s) => { const v = new THREE.Vector3(...s.at()).project(cam); return [(v.x + 1) / 2 * 100, (1 - v.y) / 2 * 100]; });
  // 還原
  scene.background = saved.bg; scene.fog = saved.fog; avatar.visible = saved.avatar; buildingLabels.visible = saved.bl; destMark.visible = saved.dest;
  if (clouds) clouds.visible = saved.clouds;
  for (const [o, v] of hidden) o.visible = v;
  updateVisibility();
  return { url, pos };
}

function openCover() {
  const cv = document.getElementById('cover');
  cv.hidden = false;
  if (!innerWidth || !innerHeight) { setTimeout(openCover, 300); return; }   // 視窗還沒有大小（背景分頁）：等一下再拍
  if (renderer.domElement.width !== Math.floor(innerWidth * renderer.getPixelRatio())) renderer.setSize(innerWidth, innerHeight);
  const { url, pos } = renderCover();
  cv.querySelector('img').src = url;
  const box = cv.querySelector('.tags');
  box.innerHTML = COVER_SPOTS.map((s, i) => `<button class="ctag" data-i="${i}" style="left:${pos[i][0].toFixed(2)}%;top:${pos[i][1].toFixed(2)}%;--acc:${s.acc};--lift:${s.lift || 44}px;--dx:${s.dx || 0}px">
      <b>${s.title}</b><small>${s.sub}</small></button>`).join('');
  cv.querySelector('.list').innerHTML = COVER_SPOTS.map((s, i) => `<button data-i="${i}" style="--acc:${s.acc}">${s.title}</button>`).join('');
  if (cv.dataset.sel) cv.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('on', b.dataset.i === cv.dataset.sel));
}
// 視窗大小改變（轉手機、拉視窗）時重拍封面，紙條位置才會對
let coverTimer = 0;
addEventListener('resize', () => {
  if (document.getElementById('cover').hidden) return;
  clearTimeout(coverTimer); coverTimer = setTimeout(openCover, 150);
});
document.getElementById('cover').addEventListener('click', (e) => {
  const cv = e.currentTarget, t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.i !== undefined) {
    const s = COVER_SPOTS[+t.dataset.i];
    // 先把說明卡換成這一區的介紹，再按一次就進去（跟 DSLab 一樣：點一下看介紹、再點就進去）
    if (cv.dataset.sel !== t.dataset.i) {
      cv.dataset.sel = t.dataset.i;
      cv.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('on', b.dataset.i === t.dataset.i));
      cv.querySelector('.guide h3').textContent = s.title;
      cv.querySelector('.guide p').textContent = s.note;
      cv.querySelector('.guide .go').hidden = false;
      return;
    }
    coverGo = s;
  } else if (t.classList.contains('go')) {
    coverGo = COVER_SPOTS[+cv.dataset.sel];
  } else if (t.dataset.act === 'bird') {
    cv.hidden = true; setMode('bird'); return;
  } else if (t.dataset.act !== 'walk') return;
  cv.hidden = true;
  openChooser({ firstTime: true });
});

// 每次進網站先看封面（用 ?room= ?pano= 分享連結進來的就不打擾）
if (!qRoom && !params.get('pano')) openCover();
loop();

// 除錯用：在主控台可用 __campus 檢查狀態、__campus.step(秒) 手動推進
window.__campus = { rooms, floors, player, nav, navigateTo, placeAt, cat, viewer, panoScenes, openPano, setMode, findPath, camera, orbit, keys, auto, walkTo, stairs, climbStairs, cam, camBlocked, act, SPOTS, doAction,
  step: (sec) => { for (let t = 0; t < sec; t += 1 / 30) update(1 / 30); renderer.render(scene, camera); } };
