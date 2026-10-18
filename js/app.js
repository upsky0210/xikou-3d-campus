import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PanoViewer } from './pano.js?v=162';
import { furnishFloor } from './furniture.js?v=162';
import { poolWallMat, poolStripeMat, poolDoor, buildPool, buildPoolPlayground, buildElevator, makeCat, makeGlider, makeTurtle, makeHamster } from './extras.js?v=162';
import { buildField, buildStage, buildFacadeC, buildMuralBlock, buildCourtyard, buildParking, buildFrontYard, buildGuardHouse } from './field.js?v=162';
import { buildCampusWall } from './wall.js?v=162';
import { BLOCKY, STYLE, setStyle, mat, blockBox, Batch, SPOTS, makeBlockPerson, makeBlockNPC, NPC_FACES, makeRacket, makeShuttle, animatePerson, addBlockTree, makeClouds } from './blocks.js?v=162';

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
  if (room.solidSides?.includes(s)) return true;                // 資料指定的實牆（例如外面有壁畫）
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
// 溪口情廊的白色壁柱：從西端（mx(705)）起每 4.4 公尺一根（buildPhotoScenes 蓋）；布告欄放在柱子之間
const GALLERY_PIL = 4.4;
// 「溪口 開學快樂」紙箱人像作品牆：南側牆（電腦教室一外面）第 8～9 根壁柱之間
const galleryArt = () => ({ x1: mx(705) + GALLERY_PIL * 8, x2: mx(705) + GALLERY_PIL * 9 });
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
    // 穿堂東端（依照片）：中間一道主題牆，兩側各留約 1.2 公尺通道往中庭；endWallX：牆退到走廊東邊（背面貼齊走廊邊、靠著生態池）
    const { z1, z2 } = room.m, gap = 1.25;
    const x = room.endWallX ? mx(room.endWallX) - WALL_T / 2 - 0.01 : room.m.x2;
    room.endWallM = x;                                                  // furniture.js 用來貼主題牆、壁畫
    room.f.segs.push({ ax: x, az: z1 + gap, bx: x, bz: z2 - gap, h: WALL_H, color: new THREE.Color('#dddddd'), kind: 'wall', bld: room.building, endWall: true });
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
        // 樓梯間：外面是露天的地方（小田園）也要有牆，樓梯兩側才不會懸空
        const ox = px + nx * OUT, oz = pz + nz * OUT;
        const open = i < n && (w.kind === 'stair'
          ? !f.walk.some((a) => a !== w && a.kind !== 'outdoor' && !a.room?.open && inRect(a.m, ox, oz))
          : !isWalkable(f, ox, oz, 0));
        if (open && start < 0) start = i;
        if (!open && start >= 0) {
          const t0 = start / n, t1 = i / n;
          const seg = { ax: ax + (bx - ax) * t0, az: az + (bz - az) * t0, bx: ax + (bx - ax) * t1, bz: az + (bz - az) * t1, h: RAIL_H, color, kind: 'rail' };
          // 樓梯間外側是有窗的牆，不是矮欄杆；一路蓋到上一層（不留縫）。甲梯面向小田園那面是壁畫牆（沒有窗，依照片）
          if (w.kind === 'stair') Object.assign(seg, { h: FLOOR_H, kind: 'wall', bld: w.stair.building, solid: w.stair.id === '甲梯' && nz === -1 });
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
            add(u1 + (u2 - u1) * (start / n), v1 + (v2 - v1) * (start / n), u1 + (u2 - u1) * (i / n), v1 + (v2 - v1) * (i / n), { h: FLOOR_H, solid: s.id === '乙梯' && f.level < 0 });   // 乙梯 B1 那段（依照片）：實牆沒有窗
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
// 走廊邊有牆擋著（穿堂主題牆）的地方不長階梯
const onEndWall = (f, x, z) => f.segs.some((s) => s.endWall && Math.abs(s.ax - x) < WALL_T && z >= Math.min(s.az, s.bz) - 0.3 && z <= Math.max(s.az, s.bz) + 0.3);
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
        const open = i < n && !indoor1F(ox, oz) && isWalkable(f, ox, oz, 0) && !onEndWall(f, px, pz);
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
// 往地下室的樓梯那裡要挖洞，不然草地會蓋住樓梯（整個樓梯間都挖：B1 那段往下走時，上面那片草地會擋在眼前；
//   1 樓那層本來就有入口平地、A 道底下的樓板，從上面看不會穿幫）
const groundShape = new THREE.Shape([[-300, -300], [300, -300], [300, 300], [-300, 300]].map(([x, y]) => new THREE.Vector2(x, y)));
for (const s of stairs) {
  if (!s.g || !s.floors.includes('1F') || !stairPrev(s, floorById['1F'])) continue;
  const g = s.g, poly = [[0, 0], [g.L, 0], [g.L, g.Wd], [0, g.Wd]];
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
    const guardRoom = rooms.find((r) => r.name === '警衛室'), wc = rooms.find((r) => r.f.id === '1F' && r.name === '廁所' && r.building === 'A');
    const foresters = buildParking(g, px1, px2, pz1, pz2, { guardZ: guardRoom ? guardRoom.m.z1 : undefined, shedX2: wc ? wc.m.x1 - 0.3 : undefined });   // 資源回收場到敬業樓廁所旁
    // 彩蛋：點兩台森林人會閃大燈、按喇叭
    for (const fo of foresters || []) fo.g.traverse((o) => { if (o.isMesh) { o.userData.car = fo; pickables.push(o); } });
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
  // 依 2 樓小田園照片（10-15 新照片）：六角形地磚上一格一格的木框菜圃，種小白菜，每格插一支白色名牌
  const b = new Batch();
  const wood = mat('planks', '#a87a4e'), soil = mat('wool', '#4a3322'), leaf = mat('wool', '#6fc23c'), leaf2 = mat('wool', '#8fd456');
  const stem = mat('wool', '#d9efb8'), tag = mat('wool', '#f6f6f2'), stick = mat('wool', '#e8e8e4');
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let x = m.x1 + 1.0; x + 0.6 < m.x2 - 0.5; x += 1.9) {
    for (let z = m.z1 + 1.0; z + 1.8 < m.z2 - 0.6; z += 2.5) {
      const cz = z + 0.9;
      b.box(wood, 1.2, 0.4, 1.8, x + 0.6, f.y + 0.2, cz);
      b.box(soil, 1.0, 0.05, 1.6, x + 0.6, f.y + 0.42, cz);
      for (let k = 0; k < 8; k++) {                       // 小白菜：淺綠梗＋往外翻的大葉子
        const px = x + 0.33 + (k % 2) * 0.54, pz = cz - 0.6 + Math.floor(k / 2) * 0.4, h = 0.22 + rnd() * 0.1;
        b.box(stem, 0.1, h * 0.6, 0.1, px, f.y + 0.45 + h * 0.3, pz);
        b.box(k % 3 ? leaf : leaf2, 0.3, 0.06, 0.16, px, f.y + 0.45 + h * 0.7, pz - 0.06);
        b.box(k % 3 ? leaf2 : leaf, 0.16, 0.06, 0.3, px + 0.05, f.y + 0.45 + h * 0.75, pz + 0.05);
        b.box(leaf, 0.14, h, 0.06, px - 0.05, f.y + 0.45 + h * 0.6, pz);
      }
      b.box(stick, 0.02, 0.32, 0.02, x + 1.05, f.y + 0.6, cz - 0.82);   // 白色名牌
      b.box(tag, 0.13, 0.17, 0.015, x + 1.05, f.y + 0.82, cz - 0.82);
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
  // 挑高空間（活動中心，依照片）自己的天花板：米白色波浪板（一條條高低交錯）、深灰鋼架、圓形燈；
  //   放在這層的天花板群組，鳥瞰時拿掉才看得到球場
  for (const r of f.rooms || []) {
    if (!r.tall) continue;
    const { x1, z1, x2, z2 } = r.m, top = f.y + FLOOR_H + WALL_H - 0.12, cz = (z1 + z2) / 2;
    const cream = mat('wool', '#efe6cf'), steel = mat('wool', '#4a4e55');
    const lamp = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#fffbe8', emissiveIntensity: 1 });
    const n = Math.round((x2 - x1) / 3), dx = (x2 - x1) / n;
    for (let i = 0; i < n; i++) ceilBatch.box(cream, dx + 0.02, 0.06, z2 - z1, x1 + (i + 0.5) * dx, top - (i % 2) * 0.35, cz);
    for (let z = z1 + 2.5; z < z2 - 1; z += 4.8) ceilBatch.box(steel, x2 - x1, 0.3, 0.25, (x1 + x2) / 2, top - 0.75, z);
    for (let i = 1; i < n; i += 2) for (let z = z1 + 4.9; z < z2 - 2; z += 4.8) ceilBatch.box(lamp, 0.35, 0.08, 0.35, x1 + (i + 0.5) * dx, top - 0.45, z);
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
      // 布告欄只放在兩根壁柱中間（一格最多兩片），南側作品牆那一格空下來
      const off = s.gallery * (WALL_T / 2 + 0.035), BW = 1.95, p0 = mx(705), art = galleryArt();
      const xa = cx - len / 2 + 0.1, xb = cx + len / 2 - 0.1, z = cz + off;
      for (let k = Math.floor((xa - p0) / GALLERY_PIL); k * GALLERY_PIL + p0 < xb; k++) {
        const a = Math.max(xa, p0 + k * GALLERY_PIL + 0.2), b = Math.min(xb, p0 + (k + 1) * GALLERY_PIL - 0.2);
        if (s.gallery < 0 && a < art.x2 && b > art.x1) continue;
        const nb = Math.min(2, Math.floor((b - a + 0.1) / (BW + 0.1)));
        for (let i = 0; i < nb; i++) {
          const x = (a + b) / 2 + (i - (nb - 1) / 2) * (BW + 0.1);
          batch.box(mat('wool', '#f7f7f4'), BW, 1.4, 0.07, x, f.y + 1.6, z);
          batch.plain(galleryBoardMat((k * 2 + i) % 3), 1.75, 1.2, 0.02, x, f.y + 1.6, z + s.gallery * 0.045);
        }
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

// 「優先搭電梯」：勾選後跨樓層只走電梯；電梯到不了時才走樓梯，並說明原因
const ELEV_KEY = 'campus-prefer-elevator';
let preferElevator = false;
try { preferElevator = localStorage.getItem(ELEV_KEY) === '1'; } catch { /* 私密模式 */ }
const elevBox = document.getElementById('preferElevator');
elevBox.checked = preferElevator;
elevBox.addEventListener('change', () => {
  preferElevator = elevBox.checked;
  try { localStorage.setItem(ELEV_KEY, preferElevator ? '1' : '0'); } catch { /* 私密模式 */ }
  if (nav.target) navigateTo(nav.target);   // 正在導航：馬上換路線
});
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
    let bestElev = null;
    for (const s of stairs) {
      if (!s.floors.includes(pf.id) || !s.floors.includes(tf.id)) continue;
      const sx = s.ex ?? s.cx, sz = s.ez ?? s.cz;           // 樓梯：走到入口那段平地
      const a = findPath(pf, player.x, player.z, sx, sz);
      const b = findPath(tf, sx, sz, room.cx, room.cz);
      if (!a || !b) continue;
      const len = a.len + b.len + Math.abs(pf.level - tf.level) * (s.elevator ? 12 : 6);
      const r = { legs: [{ f: pf, p: a }, { f: tf, p: b }], len, stair: s };
      if (!best || len < best.len) best = r;
      if (s.elevator && (!bestElev || len < bestElev.len)) bestElev = r;
    }
    if (preferElevator) {
      if (bestElev) best = bestElev;
      else if (best) {
        const ef = stairs.filter((s) => s.elevator).flatMap((s) => s.floors);
        const why = ef.length ? `電梯只到 ${ef[0]}～${ef.at(-1)}` : '學校沒有電梯';
        toast(`🛗 ${why}，到 ${tf.id} 這次要走樓梯`);
      }
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
    const s = nav.stair, d = remainingLen();
    msg = s ? `先沿黃線走到 <b>${s.id}</b>${d != null ? `（還有約 ${Math.round(d)} 公尺）` : ''}，再${s.elevator ? '搭電梯' : (r.f.level > player.floor.level ? '走上樓梯' : '走下樓梯')}到 <b>${r.f.id}</b>` : `目的地在 ${r.f.id}`;
  } else {
    const d = remainingLen() ?? Math.hypot(player.x - r.cx, player.z - r.cz);
    msg = `沿黃線前往 <b>${r.display}</b>（還有約 ${Math.round(d)} 公尺）`;
  }
  bar.querySelector('.msg').innerHTML = msg;
  bar.hidden = false;
}

// 這一層黃線還剩多長：找出角色在黃線上最近的位置，從那裡加到這一段的終點
function remainingLen() {
  const pts = nav.legs.find((l) => l.f === player.floor)?.p.pts;
  if (!pts || pts.length < 2) return null;
  let bi = 0, bt = 0, bd = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((player.x - ax) * dx + (player.z - az) * dz) / L2));
    const d = Math.hypot(player.x - (ax + dx * t), player.z - (az + dz * t));
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const seg = (i) => Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let len = bd + seg(bi) * (1 - bt);
  for (let i = bi + 1; i < pts.length; i++) len += seg(i);
  return len;
}

/* ---------------- 模式與可見性 ---------------- */

let mode = 'bird';           // bird | first | third
let viewFloor = 'all';       // 鳥瞰時看哪一層

function setMode(m) {
  mode = m;
  orbit.enabled = m === 'bird';
  avatar.visible = m !== 'first';
  document.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === m); b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
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
  if (e.code === 'Space' && act.busy?.badminton) { e.preventDefault(); if (!e.repeat) doAction(); return; }   // 打羽球：空白鍵也是揮拍
  if (e.code === 'Space' && mode !== 'bird' && player.jump === 0) { player.vy = 4.2; e.preventDefault(); }
  if (e.code === 'KeyF' && e.repeat) return;
  if (e.code === 'KeyF' && (act.spot || act.busy)) doAction();                 // F 只負責互動（投籃、溜滑梯、找老師玩…）
  if (e.code === 'Slash') { e.preventDefault(); openSearch(); }                 // 找教室只用 /
  if (e.code === 'KeyP') openGallery();
  if (e.code === 'Escape') { closeSearch(); hideInfo(); closeGallery(); act.busy?.badminton && act.busy.stop(); duel?.quit(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
// 切換分頁、視窗失焦時放開所有按鍵（不然 keyup 收不到，角色會一直走）
const releaseKeys = () => { for (const k in keys) keys[k] = false; };
addEventListener('blur', releaseKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseKeys(); });

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
  else if (hit?.object.userData.turtle) meetTurtle();
  else if (hit?.object.userData.glider) meetGlider(hit.object.userData.glider);
  else if (hit?.object.userData.npc) {                       // 點老師：打招呼，再隨機做個鬼臉
    const n = hit.object.userData.npc;
    meetNPC(n); npcFace(n, FUNNY_FACES[Math.random() * FUNNY_FACES.length | 0]);
  }
  else if (hit?.object.userData.car) honkCar(hit.object.userData.car);
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
      <button aria-label="看實景：${sp.zh}">看實景</button>
    </li>`).join('');
  results.innerHTML = spotHtml + (list.length ? list.map((r) => `
    <li data-id="${r.id}">
      <span class="dot" style="background:${TYPE_COLORS[r.type]}"></span>
      <span class="n">${r.display}</span>
      <span class="s">${r.f.id} · ${r.building ? D.buildings[r.building].name : ''}${r.no ? ' · ' + r.no : ''}</span>
      <button data-act="go" aria-label="帶我去：${r.display}（${r.f.id}）">帶我去</button>
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

/* ---------------- 背景音樂：溪口校歌（循環播放） ----------------
   瀏覽器不讓網頁自己出聲，等第一次點擊／按鍵才開始；右上（實景導覽左邊）「🎵 校歌」可以開關（記在這台電腦）。
   看 360° 實景（有語音導覽）、玩直笛記憶時先暫停，結束再接著播。 */

const BGM_KEY = 'campus-bgm';
const bgm = new Audio('audio/bgm/school-song.m4a');
bgm.loop = true; bgm.volume = 0.25; bgm.preload = 'none';
const bgmBtn = document.getElementById('bgmBtn');
const bgmHolds = new Set();                                             // 暫停的原因（實景、直笛）
let bgmOn = true, bgmUnlocked = false;
try { bgmOn = localStorage.getItem(BGM_KEY) !== '0'; } catch { /* 私密模式 */ }
function bgmUpdate() {
  bgmBtn.classList.toggle('off', !bgmOn); bgmBtn.setAttribute('aria-pressed', String(bgmOn));
  bgmBtn.title = bgmOn ? '關掉校歌' : '播放校歌';
  bgmBtn.querySelector('i').textContent = bgmOn ? '🎵' : '🔇';
  if (bgmOn && bgmUnlocked && !bgmHolds.size) bgm.play().catch(() => {});
  else bgm.pause();
}
function bgmHold(why, on) { if (on) bgmHolds.add(why); else bgmHolds.delete(why); bgmUpdate(); }
bgmBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  bgmOn = !bgmOn; bgmUnlocked = true;
  try { localStorage.setItem(BGM_KEY, bgmOn ? '1' : '0'); } catch { /* 私密模式 */ }
  bgmUpdate();
});
const bgmUnlock = (e) => {
  if (bgmUnlocked || e.target.closest?.('#bgmBtn')) return;            // 第一下就按校歌鈕：交給按鈕自己處理
  bgmUnlocked = true; bgmUpdate();
  removeEventListener('pointerdown', bgmUnlock, true); removeEventListener('keydown', bgmUnlock, true);
};
addEventListener('pointerdown', bgmUnlock, true); addEventListener('keydown', bgmUnlock, true);
bgmUpdate();

/* ---------------- 360° 環景 ---------------- */

const viewer = new PanoViewer(window.PANO, {
  onClose: () => { clock.getDelta(); bgmHold('pano', false); },
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
  bgmHold('pano', true);
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

/* ---------------- 彩蛋：點停車場的森林人，閃兩下大燈、叭叭兩聲 ---------------- */

let honkAudio = null;
function honkCar(car) {
  if (car.busy) return;
  car.busy = true;
  const set = (on) => car.lights.forEach((l) => l.material.emissive.set(on ? '#fff3b0' : '#000000'));
  [0, 260, 520, 780].forEach((t, i) => setTimeout(() => set(i % 2 === 0), t));
  setTimeout(() => { set(false); car.busy = false; }, 1040);
  try {
    honkAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const ac = honkAudio, t0 = ac.currentTime;
    for (const st of [0, 0.26]) {                                   // 兩短聲：兩個音疊在一起比較像汽車喇叭
      const gain = ac.createGain(); gain.connect(ac.destination);
      gain.gain.setValueAtTime(0, t0 + st); gain.gain.linearRampToValueAtTime(0.12, t0 + st + 0.02);
      gain.gain.setValueAtTime(0.12, t0 + st + 0.16); gain.gain.linearRampToValueAtTime(0, t0 + st + 0.2);
      for (const hz of [415, 523]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = hz; o.connect(gain); o.start(t0 + st); o.stop(t0 + st + 0.21); }
    }
  } catch { /* 沒有聲音就只閃燈 */ }
}

/* ---------------- 小寵物：蜜袋鼯（五年四班 1 隻、1F 教務處 2 隻）、倉鼠羞羞（3F 輔導室） ---------------- */

const GLIDERS = [
  {
    look: 'cream', name: '米果',
    hello: '🐿️ 我是米果，五年四班養的蜜袋鼯！<br>正窩在藍色袋子裡，抱著點心啃啃啃～',
    // 老師桌在教室前面（南）、不靠門的那一側（東）
    at: () => { const r = rooms.find((x) => x.code === '504'); return [r.f, r.m.x2 - 1.3, r.m.z2 - 1.45, 0.78, 0.5]; },
  },
  {
    look: 'grey', name: '花花',
    hello: '🐿️ 我是花花！<br>灰色的毛、背上一條黑線，尾巴蓬蓬的～',
    // 教務處：靠窗那排北邊、粉紅色椅子的那張 OA 桌（桌子中心約在西側 2.1 m、北牆往南 2 m）
    at: () => { const r = rooms.find((x) => x.name === '教務處'); return [r.f, r.cx - 2.27, r.m.z1 + 1.5, 0.76, Math.PI / 2 + 0.25]; },
  },
  {
    look: 'pale', name: '泡泡',
    hello: '🐿️ 我是泡泡！<br>正抱著點心吃，不要跟我搶喔～',
    at: () => { const r = rooms.find((x) => x.name === '教務處'); return [r.f, r.cx - 2.27, r.m.z1 + 2.5, 0.76, Math.PI / 2 - 0.25]; },
  },
  {
    make: makeHamster, name: '羞羞',
    hello: '🐹 我是倉鼠羞羞，住在輔導室的透明小屋裡！<br>有點害羞，所以都躲在粉紅色小熊屋裡偷看你～',
    // 3F 輔導室（依空景照片）：東邊休息區最北邊那張小桌子上的透明倉鼠籠裡，面向西邊
    at: () => {
      const r = rooms.find((x) => x.name === '輔導室'), inset = WALL_T / 2 + 0.02, W = r.m.x2 - r.m.x1 - inset * 2;
      return [r.f, r.cx + W / 2 - 0.33 + 0.05, r.m.z1 + inset + 1.85, 0.77, Math.PI / 2];   // 跟 furniture.js counselingRoom 的籠子同一個位置
    },
  },
];
for (const gl of GLIDERS) {
  const [f, x, z, top, yaw] = gl.at();
  gl.g = (gl.make || makeGlider)(gl.look); gl.f = f; gl.near = false;
  gl.g.position.set(x, f.y + groundAt(f, x, z) + top, z);
  gl.g.rotation.y = yaw;
  f.group.add(gl.g);
  gl.g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.glider = gl; pickables.push(o); } });
}
function meetGlider(gl) { toast(gl.hello); }

/* ---------------- 生態池的烏龜：兩隻（一隻在水裡繞圈游、一隻趴在石頭上曬太陽），池邊可以餵食，一天最多餵兩次 ---------------- */

const TURTLE_KEY = 'campus-turtle-feed', FEED_MAX = 2;
const pondM = D.outdoor.pond ? rectM(D.outdoor.pond) : null;
const turtles = [];
let feed = null;                                     // 正在吃：{ x, z, pellets: [...], t }
if (pondM) {
  const rim = 0.35, ix1 = pondM.x1 + rim, ix2 = pondM.x2 - rim, iz1 = pondM.z1 + rim, iz2 = pondM.z2 - rim;
  const rock = [pondM.x2 - rim - 0.4, pondM.z1 + rim + 0.4, 0.3 + 0.245];   // 跟 furniture.js 池裡的大石頭同一個位置（石頭頂面高度）
  for (const [i, col] of [[0, '#4f7f3a'], [1, '#5d6b3a']]) {
    const g = makeTurtle(col);
    const t = { g, i, home: i === 1 ? rock : null, th: 0, mode: i === 1 ? 'rest' : 'swim', box: [ix1, ix2, iz1, iz2] };
    if (t.home) { g.position.set(t.home[0], t.home[2], t.home[1]); g.rotation.y = 2.4; }
    else g.position.set((ix1 + ix2) / 2 + (ix2 - ix1) / 2 * 0.62, 0.27, (iz1 + iz2) / 2);   // 從繞圈路線的起點開始游
    floors[1].group.add(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.turtle = true; pickables.push(o); } });
    turtles.push(t);
  }
}
const pondCenter = () => [(pondM.x1 + pondM.x2) / 2, (pondM.z1 + pondM.z2) / 2];
function pondSpot() {
  if (!pondM || mode === 'bird' || player.floor !== floors[1]) return null;
  const dx = Math.max(pondM.x1 - player.x, 0, player.x - pondM.x2), dz = Math.max(pondM.z1 - player.z, 0, player.z - pondM.z2);
  return Math.hypot(dx, dz) < 1.6 ? { kind: 'feed' } : null;
}
function meetTurtle() { toast(turtles.length ? '🐢 生態池的烏龜正在慢慢游泳～<br>走到池邊按 F 可以餵牠們（一天最多兩次喔）' : ''); }
function feedTurtles() {
  if (feed) { toast('🐢 烏龜正在吃，等牠們吃完再說～'); return; }
  const today = new Date().toLocaleDateString('sv');
  let rec = { d: today, n: 0 };
  try { const o = JSON.parse(localStorage.getItem(TURTLE_KEY) || 'null'); if (o?.d === today) rec = o; } catch { /* 私密模式 */ }
  if (rec.n >= FEED_MAX) {
    toast('🐢 烏龜已經吃飽飽了！<br>再餵牠們會太撐，吃不完的飼料還會汙染水源唷～明天再來吧！');
    return;
  }
  rec.n++;
  try { localStorage.setItem(TURTLE_KEY, JSON.stringify(rec)); } catch { /* 私密模式 */ }
  // 飼料撒在離你最近的水面上
  const [ix1, ix2, iz1, iz2] = turtles[0].box;
  const fx = Math.min(ix2 - 0.3, Math.max(ix1 + 0.3, player.x)), fz = Math.min(iz2 - 0.3, Math.max(iz1 + 0.3, player.z));
  const pm = new THREE.MeshLambertMaterial({ color: '#8b5a2b' }), pellets = [];
  for (let k = 0; k < 10; k++) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.035), pm);
    o.position.set(fx + (Math.random() - 0.5) * 0.4, 0.31, fz + (Math.random() - 0.5) * 0.4);
    floors[1].group.add(o); pellets.push(o);
  }
  feed = { x: fx, z: fz, pellets, t: 0 };
  for (const t of turtles) t.mode = 'go';
  toast(rec.n < FEED_MAX ? `🐢 你撒了一小把飼料，烏龜游過來吃得好開心！<br>（今天還可以再餵 ${FEED_MAX - rec.n} 次）`
    : '🐢 烏龜吃得飽飽的～今天就餵到這裡囉！<br>餵太多吃不完，會汙染水源喔！');
}
function updateTurtles(t, dt) {
  for (const tu of turtles) {
    const g = tu.g, [ix1, ix2, iz1, iz2] = tu.box, cx = (ix1 + ix2) / 2, cz = (iz1 + iz2) / 2;
    let tx, tz, ty = 0.27, speed = 0.18, paddle = 1;
    if (tu.mode === 'swim') {                                       // 沿著池子繞橢圓慢慢游
      tu.th += dt * 0.22;
      tx = cx + (ix2 - ix1) / 2 * 0.62 * Math.cos(tu.th); tz = cz + (iz2 - iz1) / 2 * 0.7 * Math.sin(tu.th); speed = 0.3;
    } else if (tu.mode === 'rest') {                                // 趴在石頭上，偶爾探頭
      [tx, tz, ty] = [tu.home[0], tu.home[1], tu.home[2]]; paddle = 0;
      g.userData.head.position.z = -0.2 - Math.max(0, Math.sin(t * 0.7 + tu.i)) * 0.04;
    } else if (tu.mode === 'go' || tu.mode === 'eat') {             // 游去吃飼料（兩隻一左一右）
      tx = feed.x + (tu.i ? 0.22 : -0.22); tz = feed.z + 0.05; speed = 0.35;
    } else {                                                       // back：吃完回去（石頭那隻爬回石頭）
      if (tu.home) [tx, tz] = [tu.home[0], tu.home[1]];
      else { tu.mode = 'swim'; tu.th = Math.atan2((g.position.z - cz) / ((iz2 - iz1) / 2 * 0.7), (g.position.x - cx) / ((ix2 - ix1) / 2 * 0.62)); continue; }
    }
    const dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz);
    if (d > 0.02) {
      const step = Math.min(d, speed * dt);
      g.position.x += dx / d * step; g.position.z += dz / d * step;
      const yaw = Math.atan2(-dx, -dz); let dy = yaw - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      g.rotation.y += dy * Math.min(1, dt * 3);
    } else if (tu.mode === 'go') tu.mode = 'eat';
    else if (tu.mode === 'back') { tu.mode = 'rest'; }
    // 在石頭上／水裡的高度（從石頭滑下水、爬回石頭）
    const onRock = tu.home && Math.hypot(g.position.x - tu.home[0], g.position.z - tu.home[1]) < 0.2;
    const wantY = onRock ? tu.home[2] : ty === 0.27 ? 0.27 + Math.sin(t * 2 + tu.i) * 0.008 : ty;
    g.position.y += (wantY - g.position.y) * Math.min(1, dt * 4);
    g.userData.legs.forEach((l, k) => { l.rotation.y = paddle * Math.sin(t * 5 + k * 1.6) * 0.5; });
    if (tu.mode === 'eat') g.userData.head.position.z = -0.2 - (Math.sin(t * 9) > 0 ? 0.05 : 0);   // 伸頭吃
    else if (tu.mode !== 'rest') g.userData.head.position.z = -0.2;
  }
  if (feed) {                                                       // 飼料一顆一顆被吃掉
    feed.t += dt;
    const eating = turtles.some((tu) => tu.mode === 'eat');
    if (eating && feed.pellets.length && feed.t > 0.5) { feed.t = 0; feed.pellets.pop().removeFromParent(); }
    for (const o of feed.pellets) o.position.y = 0.31 + Math.sin(t * 3 + o.position.x * 20) * 0.006;
    if (!feed.pellets.length) { feed = null; for (const tu of turtles) tu.mode = 'back'; }
  }
}

/* ---------------- 老師 NPC（依照片畫成方塊人） ---------------- */

// 樂樂棒球場（操場遊戲場西邊草地）：本壘在南、投手丘在北（打出去的球往操場飛）；校長的位置會用到，要先宣告
const BB = { home: { x: -28, z: 77 }, mound: { x: -28, z: 70.5 }, side: 7 };
// Teacher Angela 在科任教師辦公室站的地方
const ANGELA_OFFICE = { x: (r) => r.cx + 1.2, z: (r) => r.cz + 2.6 };   // 靠門口那片空地（辦公桌之間太窄，猜拳時學生站不下）
const NPCS = [
  {
    name: '呂老師', title: '體育老師', game: 'badminton',
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
    name: '鄧老師', title: '體育組長', game: 'shootout',
    hello: ['🏀 鄧老師：同學要多運動唷！', '🏀 鄧老師：一起來打球吧！'],
    // 隨機出現：操場北邊那座籃球場，或活動中心（4F）的球場
    places: [
      { floor: '1F', where: '操場籃球場', game: true, at: () => { const T = D.outdoor.track; return [mx(T.center[0]) + 3, mz(T.center[1]) - 5.3, Math.PI]; } },
      { floor: '4F', where: '活動中心', game: true, at: () => { const r = rooms.find((x) => x.name === '活動中心'); return [r.cx - 2, r.cz + 1.5, Math.PI / 2]; } },
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
  {
    name: '小瑜老師', title: '音樂老師', game: 'recorder',
    hello: ['🎵 小瑜老師：今天一起來吹直笛吧！', '🎶 小瑜老師：上課前先把直笛擦乾淨唷！', '👍 小瑜老師：唱得很好聽，讚！',
      '🎵 小瑜老師：要不要來玩直笛記憶？老師吹一段，你照著吹回去！'],
    // 3 樓音樂教室二（304）前面、鋼琴旁邊，面向學生（東）；在這裡可以玩直笛記憶
    places: [
      { floor: '3F', where: '音樂教室二', game: true, at: () => { const r = rooms.find((x) => x.name === '音樂教室二'); return [r.m.x1 + 1.9, r.cz + 0.9, -Math.PI / 2]; } },
    ],
    look: {
      // 依圖：棕色貝雷帽（白色 H）、橘棕色長直髮（旁分瀏海）、大大的棕色眼睛、腮紅、開口笑；
      // 棕色西裝外套＋白襯衫＋紅領帶、金色鈕扣、綠白黃胸章；手拿白色直笛
      skin: '#f8dcc4', hair: '#b8662a', top: '#6e5233', pants: '#4f3c26', shoe: '#3a2a20',
      longHair: true, longSleeve: true, collar: '#ffffff', tie: '#d6334a', buttons: '#e8c22a',
      badge: ['#2e8b57', '#ffffff', '#e8c22a'], beret: { color: '#6e5233', letter: '#f4efe4' }, holdL: 'recorder',
      pal: { H: '#b8662a', h: '#d98b45', S: '#f8dcc4', E: '#4a2412', e: '#9b5a2e', W: '#ffffff', B: '#f4a5a0', M: '#8e2a2a', T: '#e86a6a' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHhHHHHHHhHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHSSHHHHH',
        'HHHHHHHSSSSSSHHH',
        'HHHHSSSSSSSSSSHH',
        'HHSSSSSSSSSSSSHH',
        'HHSEEESSSSEEESHH',
        'HHSEWeSSSSEWeSHH',
        'HHSEeeSSSSEeeSHH',
        'HHBBSSSSSSSSBBHH',
        'HHSSSSMMMMSSSSHH',
        'HHSSSSMTTMSSSSHH',
        'HHSSSSSMMSSSSSHH',
        'HHSSSSSSSSSSSSHH',
        'HHHSSSSSSSSSSHHH',
      ],
    },
  },
  {
    name: '陳老師', title: '五年四班導師', game: 'badminton',
    hello: ['🏸 陳老師：下課一起來打羽球吧！', '🏸 陳老師：五年四班的同學，作業交了沒？', '🐿️ 陳老師：小聲一點，蜜袋鼯在睡覺喔！'],
    // 隨機出現：4 樓五年四班（418 室）教室前面（至善樓教室前後對調，黑板在南）面向學生，
    //   或 4F 活動中心東半邊（面向西，可以打羽球；教室裡不行）
    places: [
      { floor: '4F', where: '五年四班', at: () => { const r = rooms.find((x) => x.code === '504'); return [r.cx - 0.6, r.m.z2 - 1.6, 0]; } },
      { floor: '4F', where: '活動中心', game: true, at: () => { const r = rooms.find((x) => x.name === '活動中心'); return [r.cx + 6, r.cz - 4, Math.PI / 2]; } },
    ],
    look: {
      // 依圖：黑色及肩直髮、齊瀏海、棕色大眼睛、淺淺微笑；紅色連帽 T（白色抽繩、大口袋）；左手羽球拍、右手羽毛球
      skin: '#f6d2b8', hair: '#151212', top: '#c8202a', pants: '#2b2b30', shoe: '#f4f4f4',
      longHair: true, longSleeve: true, hoodie: '#ffffff', holdL: 'racket', holdR: 'shuttle',
      pal: { H: '#151212', h: '#2c2626', S: '#f6d2b8', E: '#2a1610', e: '#7a4426', W: '#ffffff', B: '#f2b0a0', N: '#e2a98c', M: '#c0645a' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHhHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHhHHHHHHHHHHhHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHSSSSSSSSSSSSHH',
        'HHSEEESSSSEEESHH',
        'HHSEWeSSSSEWeSHH',
        'HHSEeeSSSSEeeSHH',
        'HHSSSSSNNSSSSSHH',
        'HHBBSSSSSSSSBBHH',
        'HHSSSSMMMMSSSSHH',
        'HHSSSSSSSSSSSSHH',
        'HHHSSSSSSSSSSHHH',
        'HHHHSSSSSSSSHHHH',
      ],
    },
  },
  {
    name: 'Ashley 老師', title: '輔導組長', game: 'words',
    hello: ['📝 Ashley 老師：要不要和 Ashley 老師練習背單字？', '📝 Ashley 老師：要不要和 Ashley 老師練習背單字？<br>💬 有心事也可以來輔導室找我聊聊喔！',
      '📝 Ashley 老師：要不要和 Ashley 老師練習背單字？<br>🐹 練完可以去輔導室看倉鼠羞羞喔！'],
    // 隨機出現：3 樓輔導室（327）外面的走廊（兩扇門中間，面向走廊），或 2 樓英語教室一（210）前面講台旁（面向學生）；兩個地方都可以練單字
    places: [
      { floor: '3F', where: '輔導室外', game: true, at: () => { const r = rooms.find((x) => x.name === '輔導室'); return [r.m.x1 - 0.65, r.cz, Math.PI / 2]; } },
      { floor: '2F', where: '英語教室一', game: true, at: () => { const r = rooms.find((x) => x.name === '英語教室一'); return [r.m.x1 + 1.3, r.cz + 1.2, -Math.PI / 2]; } },
    ],
    look: {
      // 依照片：深咖啡色頭髮往後綁（低髮髻、臉旁兩撮，帶一點紅棕色）、笑開露牙、淺膚色；淺藍綠色無袖上衣、紫色識別證掛繩
      skin: '#f4d6c2', hair: '#3b2418', top: '#7fd3dc', pants: '#2f3440', shoe: '#e9e4dc',
      bun: true, sleeveless: true, lanyard: '#6a3fc0',
      pal: { H: '#3b2418', h: '#7a4a32', S: '#f4d6c2', B: '#3b2418', E: '#1e120c', N: '#e3b8a0', R: '#f2aaa2', M: '#c0605a', T: '#ffffff' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHhHHHHHHHHHH',
        'HHHHHHHHHHHHhHHH',
        'HHHHSSSHHHHHHHHH',
        'HHHSSSSSSSHHHHHH',
        'HHSSSSSSSSSSSHHH',
        'HSSSSSSSSSSSSSSH',
        'HSSBBBSSSSBBBSSH',
        'SSSEESSSSSSEESSS',
        'SSSEESSSSSSEESSS',
        'SSSSSSSNNSSSSSSS',
        'SRRSSSSSSSSSSRRS',
        'SSSSMMMMMMMMSSSS',
        'SSSSMTTTTTTMSSSS',
        'SSSSSMMMMMMSSSSS',
        'SSSSSSSSSSSSSSSS',
      ],
    },
  },
  {
    name: '哈囉老師', title: '美勞老師', game: 'paint',
    hello: ['🎨 哈囉老師：哈囉～今天想畫什麼動物呢？', '🎨 哈囉老師：顏色沒有對錯，大膽塗上你喜歡的顏色！',
      '🖍️ 哈囉老師：要不要來幫小動物穿上新衣服？', '🎨 哈囉老師：哈囉哈囉！美勞教室今天開張囉～'],
    // 3 樓美勞教室（311）前面講台旁，面向學生（東）；在這裡可以玩著色
    places: [
      { floor: '3F', where: '美勞教室', game: true, at: () => { const r = rooms.find((x) => x.name === '美勞教室'); return [r.m.x1 + 1.4, r.cz + 1.3, -Math.PI / 2]; } },
    ],
    look: {
      // 依照片：米色毛線帽（頂端毛球）、咖啡色長直髮、笑開露牙；紅白圍巾（米白那端有紅色蝴蝶結）、
      //   卡其色鋪棉背心＋咖啡色外套袖子、酒紅色長裙＋深色內搭、白色球鞋、米色斜背包；美勞老師手拿水彩筆
      skin: '#f6d6c0', hair: '#5a3423', top: '#c49a6c', sleeve: '#9c6b45', pants: '#2b2b30', shoe: '#f4f4f4',
      longHair: true, longSleeve: true, beanie: '#d8c4a8', beanieCuff: '#cdb698', scarf: ['#d32f2f', '#f2e6da'],
      skirt: '#8e2a3a', bag: '#dccbbd', holdR: 'brush',
      pal: { K: '#d8c4a8', k: '#c4ae90', H: '#5a3423', h: '#7a4a32', S: '#f6d6c0', E: '#2a1610', W: '#ffffff', N: '#e8b89e', B: '#f2a7a0', M: '#b84a4a', T: '#ffffff' },
      face: [
        'KKKKKKKKKKKKKKKK',
        'KkKKkKKkKKkKKkKK',
        'KKKKKKKKKKKKKKKK',
        'kkkkkkkkkkkkkkkk',
        'HHHHHHSSSHHHHHHH',
        'HHHSSSSSSSSSSHHH',
        'HHSSSSSSSSSSSSHH',
        'HHSEESSSSSSEESHH',
        'HHSEWSSSSSSEWSHH',
        'HHSSSSSNNSSSSSHH',
        'HHBBSSSSSSSSBBHH',
        'HHSSSMMMMMMSSSHH',
        'HHSSSMTTTTMSSSHH',
        'HHSSSSMMMMSSSSHH',
        'HHSSSSSSSSSSSSHH',
        'HHHSSSSSSSSSSHHH',
      ],
    },
  },
  {
    name: 'Poyen 老師', title: '五年一班導師', game: 'rps',
    rpsTalk: { start: '來猜拳吧！先贏兩局的人獲勝！', win: '好厲害！記得睡午覺，下午才有精神哦！', lose: '再接再厲！先去睡個午覺養精神吧！' },
    hello: ['😴 Poyen 老師：小朋友，睡午覺，下午才有精神哦！', '😴 Poyen 老師：小朋友，睡午覺，下午才有精神哦！<br>✂️ 要不要來猜個拳？'],
    // 4 樓五年一班（413 室）教室前面、電視旁邊（勤學樓教室黑板在西邊），面向學生（東）；老師桌在南邊，站北邊一點
    places: [
      { floor: '4F', where: '五年一班', game: true, at: () => { const r = rooms.find((x) => x.code === '501'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
    ],
    look: {
      // 依照片：深藍色 Nike 棒球帽（藍綠色勾勾）、黑色短髮、黑框方眼鏡、笑開露牙；螢光綠連帽拉鍊外套（藍色抽繩）、牛仔褲、黑色斜背包
      skin: '#efc9a8', hair: '#1b1714', top: '#8fdc2c', pants: '#5a7fb8', shoe: '#3a3a3a',
      shortHair: true, longSleeve: true, hoodie: '#2a4fb8', pocket: '#84cf26', zip: '#6b7a5a', bag: '#1d1d1f',
      cap: { color: '#1f2a4a', logo: '#2fc4c4' },
      pal: { H: '#1b1714', h: '#2c2622', S: '#efc9a8', B: '#1b1714', K: '#151515', E: '#1e130d', N: '#ddb08e', M: '#9c3b34', T: '#ffffff' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HSSSSSSSSSSSSSSH',
        'HSSSSSSSSSSSSSSH',
        'SBBBSSSSSSSSBBBS',
        'SKKKKKKSSKKKKKKS',
        'SKSSSSKKKKSSSSKS',
        'SKSEESKSSKSEESKS',
        'SKKKKKKSSKKKKKKS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSNNSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSMMMMMMMMMMSSS',
        'SSSMTTTTTTTTMSSS',
        'SSSSMMMMMMMMSSSS',
        'SSSSSSSSSSSSSSSS',
      ],
    },
  },
  {
    name: '邱老師', title: '註冊組長', game: 'glider',
    hello: ['🌱 邱老師：我們來觀察植物！', '🐿️ 邱老師：要愛護小動物唷！', '🐿️ 邱老師：要愛護小動物唷！<br>你知道蜜袋鼯能吃什麼、不能吃什麼嗎？'],
    // 隨機出現：1 樓教務處（花花、泡泡就是她養的；站在櫃台後面、粉紅椅子那排桌子北邊的走道，面向門口，學生在櫃台外就能跟她玩），
    //   或 3 樓思科教室前面；兩個地方都可以玩
    places: [
      { floor: '1F', where: '教務處', game: true, at: () => { const r = rooms.find((x) => x.name === '教務處'); return [r.cx - 0.1, r.m.z1 + 1.0, -Math.PI / 2]; } },
      { floor: '3F', where: '思科教室', game: true, at: () => { const r = rooms.find((x) => x.name === '思科教室'); return [r.m.x1 + 1.4, r.cz + 1.2, -Math.PI / 2]; } },
    ],
    look: {
      // 依照片：深棕黑色長直髮、齊瀏海、溫柔微笑；玫瑰粉紅色翻領短袖洋裝（腰帶、打褶長裙）
      skin: '#f6d8c6', hair: '#2a1b1b', top: '#b85a6c', pants: '#f0cdb8', shoe: '#5a4038',
      longHair: true, collar: '#c96d80', skirt: '#b85a6c',
      pal: { H: '#2a1b1b', h: '#4a2e2c', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#b8505a' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHhHHHHHHhHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHhHHHHhHHHhHHH',
        'HHSSSSSSSSSSSSHH',
        'HHSEEESSSSEEESHH',
        'HHSEWeSSSSEWeSHH',
        'HHSSSSSSSSSSSSHH',
        'HHSSSSSNNSSSSSHH',
        'HHBBSSSSSSSSBBHH',
        'HHSSSMSSSSMSSSHH',
        'HHSSSSMMMMSSSSHH',
        'HHHSSSSSSSSSSHHH',
        'HHHHSSSSSSSSHHHH',
      ],
    },
  },
  {
    name: '張校長', title: '校長', game: 'baseball',
    hello: ['😊 張校長：小朋友好！', '👍 張校長：你好棒！今天也要開開心心學習喔！', '🌟 張校長：遇到困難不要怕，努力就是最棒的！',
      '📚 張校長：多讀書、多運動，健康又快樂！', '🤝 張校長：有禮貌、會幫助別人，就是溪口的好孩子！'],
    // 隨機出現：1 樓穿堂（從正門進來，面向校門迎接小朋友），或操場遊戲場西邊的草地（換上棒球裝，在投手丘上，可以玩樂樂棒球）
    places: [
      { floor: '1F', where: '穿堂', at: () => { const r = rooms.find((x) => x.name === '穿堂'); return [r.cx - 1.2, r.cz + 1.8, Math.PI / 2]; } },
      // 樂樂棒球先保留（使用者測過覺得太難揮棒、學生站姿要改成側對校長）：之後要開放就把這行加回去
      // { floor: '1F', where: '樂樂棒球場', game: true, outfit: 'baseball', at: () => [BB.mound.x, BB.mound.z, Math.PI] },
    ],
    // 棒球裝：深藍棒球帽、白色球衣（深藍鈕扣）、白色球褲
    outfits: { baseball: { cap: { color: '#1f3a7a', logo: '#ffffff' }, top: '#f6f6f2', pants: '#f0efe8', longSleeve: false, collar: null, tie: null, buttons: '#1f3a7a', shoe: '#1d1d1f' } },
    look: {
      // 依照片：黑色短髮（旁分）、細框眼鏡、笑容；深灰藍色西裝、淺藍襯衫、紫藍格紋領帶
      skin: '#efc8a8', hair: '#1c1816', top: '#3b4454', pants: '#3b4454', shoe: '#1d1d1f',
      shortHair: true, longSleeve: true, collar: '#a9cbee', tie: '#6a5aa8', buttons: '#2b313c',
      pal: { H: '#1c1816', h: '#3a2e28', S: '#efc8a8', K: '#8a8f96', E: '#1e130d', N: '#ddb08e', M: '#9c3b34', T: '#ffffff' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHhHHHHHHH',
        'HSSSHHHHHHHHHHSH',
        'SSSSSSSSSSHHHSSS',
        'SSSSSSSSSSSSSSSS',
        'SKKKKKSSSSKKKKKS',
        'SKSEESKKKKSEESKS',
        'SKKKKKSSSSKKKKKS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSNNSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSMMMMMMMMMMSSS',
        'SSSSMTTTTTTMSSSS',
        'SSSSSMMMMMMSSSSS',
        'SSSSSSSSSSSSSSSS',
      ],
    },
  },
  {
    name: 'Teacher Angela', title: '英文老師', game: 'rps',
    hello: ['🔤 Teacher Angela：快樂學英文！Happy English!', '👍 Teacher Angela：說得很標準，你好棒！Good job!',
      "✂️ Teacher Angela：Let's play rock-paper-scissors! 要不要來猜拳？"],
    rpsTalk: { start: 'Rock, paper, scissors! 先贏兩局的人獲勝！', win: 'Wow, you win! 說得很標準、猜拳也好厲害，你好棒！', lose: 'I win! 沒關係，再接再厲，Keep trying!' },
    rpsKey: 'campus-rps-wins-angela',
    // 隨機出現：2 樓英語教室一（210）前面講台旁（Ashley 老師站另一邊），或 2 樓科任教師辦公室；兩個地方都可以猜拳
    places: [
      { floor: '2F', where: '英語教室一', game: true, at: () => { const r = rooms.find((x) => x.name === '英語教室一'); return [r.m.x1 + 1.3, r.cz - 1.4, -Math.PI / 2]; } },
      { floor: '2F', where: '科任教師辦公室', game: true, at: () => { const r = rooms.find((x) => x.name === '科任教師辦公室'); return [ANGELA_OFFICE.x(r), ANGELA_OFFICE.z(r), Math.PI / 2]; } },   // 面向辦公室裡面（西）
    ],
    look: {
      // 依照片：深棕色長直髮、豹紋髮箍（粉紅蝴蝶結）、溫柔微笑；鼠尾草綠針織開襟外套＋灰色 Polo 衫、深灰百褶裙、咖啡色斜背包
      skin: '#f6d8c6', hair: '#3a2418', top: '#9aa58a', pants: '#f0d2c0', shoe: '#3a3a3a',
      longHair: true, longSleeve: true, collar: '#c4c4c0', buttons: '#7a8070', skirt: '#4a4d55', bag: '#7a3a2a',
      pal: { H: '#3a2418', h: '#5a3a26', L: '#c8965a', l: '#4a2e1a', P: '#f29ab8', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#c0605a' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HLLlLLLLLPPPLlLH',
        'LlLLLlLLLPPPLLlL',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHhHHHHHHH',
        'HHHSSSSSSSSSSHHH',
        'HHSSSSSSSSSSSSHH',
        'HHSEEESSSSEEESHH',
        'HHSEWeSSSSEWeSHH',
        'HHSSSSSSSSSSSSHH',
        'HHSSSSSNNSSSSSHH',
        'HHBBSSSSSSSSBBHH',
        'HHSSSSMMMMSSSSHH',
        'HHSSSSSSSSSSSSHH',
        'HHHSSSSSSSSSSHHH',
        'HHHHSSSSSSSSHHHH',
      ],
    },
  },
  {
    name: '林老師', title: '三年五班導師', game: 'pingpong',
    hello: ['🤫 林老師：請保持安靜～', '🤣 林老師：我昨天又夢到我在上數學課了🤣', '⛰️ 林老師：爬山很快樂喔！一起來爬山',
      '🏓 林老師：要不要一起去地下室打桌球？'],
    // 2 樓三年五班（226 室）教室前面（至善樓教室前後對調，黑板在南），面向學生
    places: [
      { floor: '2F', where: '三年五班', game: true, at: () => { const r = rooms.find((x) => x.code === '305'); return [r.cx - 0.6, r.m.z2 - 1.6, 0]; } },
    ],
    look: {
      // 依照片：深棕色長捲髮（旁分瀏海）、大大的笑容；白色洋裝
      skin: '#f6d8c6', hair: '#3a2218', top: '#f7f4ee', pants: '#f6d8c6', shoe: '#efe8dc',
      longHair: true, skirt: '#f7f4ee',
      pal: { H: '#3a2218', h: '#5a3424', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#c0605a', T: '#ffffff' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHhHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHSSHHHHHHHH',
        'HHHHSSSSSHHHHHHH',
        'HHHSSSSSSSSSSHHH',
        'HHSSSSSSSSSSSSHH',
        'HHSEEESSSSEEESHH',
        'HHSEWeSSSSEWeSHH',
        'HHSSSSSSSSSSSSHH',
        'HHSSSSSNNSSSSSHH',
        'HHBBSSSSSSSSBBHH',
        'HHSSSMMMMMMSSSHH',
        'HHSSSMTTTTMSSSHH',
        'HHHSSSMMMMSSSHHH',
        'HHHHSSSSSSSSHHHH',
      ],
    },
  },
  {
    name: '丁丁老師', title: '自然老師', game: 'float',
    hello: ['🧪 丁丁老師：我們來做實驗吧！', '🤫 丁丁老師：請保持安靜，不要講話。', '🔬 丁丁老師：同學們跟我一起做！', '🛟 丁丁老師：要不要來做沉浮實驗？'],
    // 2 樓自然教室一（204）前面：站在白板和大實驗桌中間，隔著實驗桌面向學生（西）
    places: [
      { floor: '2F', where: '自然教室一', game: true, at: () => { const r = rooms.find((x) => x.name === '自然教室一'); return [r.m.x2 - 0.75, r.cz + 0.3, Math.PI / 2]; } },   // 教室前後鏡射：白板在東，面向西
    ],
    look: {
      // 依照片：黑色平頭短髮、圓臉、淡淡微笑；灰藍色 Polo 衫（裡面黑色內衣）、黑色長褲
      skin: '#e8bf9c', hair: '#1c1816', top: '#7f8fb8', pants: '#1f1f22', shoe: '#2a2a2a',
      shortHair: true, collar: '#7f8fb8', buttons: '#eef0f4',
      pal: { H: '#1c1816', h: '#2e2622', S: '#e8bf9c', B: '#2a2018', E: '#1e130d', N: '#d4a684', M: '#9c4a3e' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHhHHHHhHHHHhHHH',
        'HHHHHHHHHHHHHHHH',
        'SHSSSSSSSSSSSSHS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSBBBSSSSSSBBBSS',
        'SSSSSSSSSSSSSSSS',
        'SSSEESSSSSSEESSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSNNSSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSMSSSSMSSSSS',
        'SSSSSSMMMMSSSSSS',
        'SSSSSSSSSSSSSSSS',
        'SSSSSSSSSSSSSSSS',
      ],
    },
  },
  {
    name: '竹竹老師', title: '自然老師', game: 'heat',
    hello: ['📖 竹竹老師：上課要專心唷！', '🔍 竹竹老師：從細節觀察不同的地方！', '🌡️ 竹竹老師：要不要來玩熱脹冷縮？'],
    // 2 樓自然教室二（205）前面：跟自然教室一一樣的配置（白板在東），站在白板和大實驗桌中間，面向學生（西）
    places: [
      { floor: '2F', where: '自然教室二', game: true, at: () => { const r = rooms.find((x) => x.name === '自然教室二'); return [r.m.x2 - 0.75, r.cz + 0.3, Math.PI / 2]; } },
    ],
    look: {
      // 依照片：黑色長直髮（中分）、細框圓眼鏡、燦爛笑容；米黃色短袖 T 恤、淺灰色運動長褲、白色手錶
      skin: '#f2cfb4', hair: '#1c1614', top: '#f1e9c8', pants: '#b9bcc2', shoe: '#e8e8e8',
      longHair: true,
      pal: { H: '#1c1614', h: '#2e2420', S: '#f2cfb4', K: '#b8b0a8', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f0b0a8', N: '#e2b296', M: '#b8505a', T: '#ffffff' },
      face: [
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHhHHHHHHHH',
        'HHHHHHHSHHHHHHHH',
        'HHHHHHSSSHHHHHHH',
        'HHHHHSSSSSHHHHHH',
        'HHHSSSSSSSSSSHHH',
        'HHKKKKSSSSKKKKHH',
        'HHKEEKKKKKKEEKHH',
        'HHKEWKSSSSKEWKHH',
        'HHKKKKSSSSKKKKHH',
        'HHSSSSSNNSSSSSHH',
        'HHBBSSSSSSSSBBHH',
        'HHSSMMMMMMMMSSHH',
        'HHSSSMTTTTMSSSHH',
        'HHHSSSMMMMSSSHHH',
        'HHHHSSSSSSSSHHHH',
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
function useOutfit(n, name) {
  n.models ||= { base: n.g };
  const key = name || 'base';
  if (!n.models[key]) {
    const g = makeBlockNPC({ ...n.look, ...n.outfits[name] });
    g.traverse((o) => { if (o.isMesh) { o.userData.npc = n; pickables.push(o); } });
    n.models[key] = g;
  }
  const g = n.models[key];
  if (g === n.g) return;
  n.g.removeFromParent(); n.g = g;
}
function movePlacesNPC(n) {
  let k; do k = Math.random() * n.places.length | 0; while (n.places.length > 1 && k === n.placeIdx);
  n.placeIdx = k;
  const p = n.places[k], [x, z, yaw] = p.at();
  if (n.outfits) useOutfit(n, p.outfit);                               // 有的地點要換衣服（校長去打樂樂棒球換棒球裝）
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
  npcFace(n, 'happy');                                                  // 老師笑開
}
// 換表情，過幾秒自動變回平常的臉
function npcFace(n, ex, sec = 2.5) { n.exprT = sec; n.g.userData.setFace(ex); }
const FUNNY_FACES = ['wink', 'tongue', 'surprised', 'happy', 'sleepy'];
function updateNPCs(t, dt) {
  for (const n of NPCS) {
    // 表情：有指定表情就維持幾秒；平常每 2～6 秒眨一下眼
    n.blinkT ??= 2 + Math.random() * 4;
    if (n.exprT > 0) { n.exprT -= dt; if (n.exprT <= 0) n.g.userData.setFace('normal'); }
    else if ((n.blinkT -= dt) < 0) {
      n.g.userData.setFace('blink');
      if (n.blinkT < -0.14) { n.g.userData.setFace('normal'); n.blinkT = 2 + Math.random() * 4; }
    }
    if (n.playing) continue;                                          // 正在跟你玩小遊戲：由遊戲控制
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
// 走近自然教室二的倉鼠飼養箱（大實驗桌靠門那端）時跳一次提示；走開再回來會再跳
//（竹竹老師就站在旁邊，她打招呼的訊息會先跳；等那則消失再跳倉鼠的）
let hamsterNear = false, hamsterWait = false;
function hamsterHint() {
  const r = rooms.find((x) => x.name === '自然教室二');
  const near = !act.busy && mode !== 'bird' && player.floor === r.f && Math.hypot(player.x - (r.m.x2 - 1.6), player.z - (r.cz + 1.0)) < 1.4;
  if (near && !hamsterNear) hamsterWait = performance.now() + 500;     // 稍等一下，讓老師的招呼先跳
  if (!near) hamsterWait = false;
  if (hamsterWait && performance.now() > hamsterWait && !document.getElementById('toast').classList.contains('on')) { hamsterWait = false; toast('🐹 這是竹竹老師的倉鼠奶茶'); }
  hamsterNear = near;
}
function updateAct(dt) {
  hamsterHint();
  if (act.busy) act.busy.tick(dt);
  act.spot = act.busy ? null : badmintonSpot() || pondSpot() || nearestSpot();   // 靠近老師時打羽球優先（活動中心也有籃框）
  const sp = act.spot;
  const label = act.busy ? (act.busy.label ?? (act.busy.press ? '🏀 出手！ <kbd>F</kbd>' : ''))
    : !sp ? ''
    : sp.kind === 'hoop' ? '🏀 投籃 <kbd>F</kbd>'
    : sp.kind === 'toy' ? `${TOYS[sp.toy].icon} 玩${sp.name} <kbd>F</kbd>`
    : sp.kind === 'badminton' ? `🏸 跟${sp.npc.name}打羽球 <kbd>F</kbd>`
    : sp.kind === 'pingpong' ? `🏓 好啊！跟${sp.npc.name}去地下室打桌球 <kbd>F</kbd>`
    : sp.kind === 'shootout' ? `🏀 跟${sp.npc.name}比投籃 <kbd>F</kbd>`
    : sp.kind === 'words' ? `📝 跟${sp.npc.name}練英文單字 <kbd>F</kbd>`
    : sp.kind === 'rps' ? `✂️ 跟${sp.npc.name}猜拳 <kbd>F</kbd>`
    : sp.kind === 'recorder' ? `🎵 跟${sp.npc.name}玩直笛記憶 <kbd>F</kbd>`
    : sp.kind === 'baseball' ? `⚾ 跟${sp.npc.name}玩樂樂棒球 <kbd>F</kbd>`
    : sp.kind === 'heat' ? `🌡️ 跟${sp.npc.name}玩熱脹冷縮 <kbd>F</kbd>`
    : sp.kind === 'float' ? `🧪 跟${sp.npc.name}做沉浮實驗 <kbd>F</kbd>`
    : sp.kind === 'glider' ? `🐿️ 跟${sp.npc.name}玩「蜜袋鼯能吃嗎？」 <kbd>F</kbd>`
    : sp.kind === 'paint' ? `🎨 跟${sp.npc.name}畫畫 <kbd>F</kbd>`
    : sp.kind === 'feed' ? '🐢 餵烏龜 <kbd>F</kbd>'
    : `🛝 溜${sp.name} <kbd>F</kbd>`;
  if (label !== actLabel) { actLabel = label; actBtn.innerHTML = label; actBtn.hidden = !label; }
  placeQuit();
}
function doAction() {
  if (act.busy) { act.busy.press?.(); return; }
  if (act.spot?.kind === 'hoop') startShot(act.spot);
  else if (act.spot?.kind === 'slide') startSlide(act.spot);
  else if (act.spot?.kind === 'toy') startToy(act.spot);
  else if (act.spot?.kind === 'badminton') startBadminton(act.spot.npc);
  else if (act.spot?.kind === 'pingpong') startPingpong(act.spot.npc);
  else if (act.spot?.kind === 'shootout') startShootout(act.spot.npc);
  else if (act.spot?.kind === 'words') startWords(act.spot.npc);
  else if (act.spot?.kind === 'rps') startRps(act.spot.npc);
  else if (act.spot?.kind === 'recorder') startFlute(act.spot.npc);
  else if (act.spot?.kind === 'glider') startFood(act.spot.npc);
  else if (act.spot?.kind === 'float') startFood(act.spot.npc, FLOAT_Q);
  else if (act.spot?.kind === 'heat') startFood(act.spot.npc, HEAT_Q);
  else if (act.spot?.kind === 'baseball') startBaseball(act.spot.npc);
  else if (act.spot?.kind === 'paint') startPaint(act.spot.npc);
  else if (act.spot?.kind === 'feed') feedTurtles();
}
actBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
actBtn.addEventListener('click', doAction);
const quitBtn = document.getElementById('quitGame');
function quitGame() {
  if (act.busy?.badminton) { const pp = act.busy.pp; act.busy.stop(); toast(pp ? '🏓 下次再來打桌球！' : '🏸 下次再來打羽球！'); }
  else duel?.quit();
}
quitBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
quitBtn.addEventListener('click', quitGame);
// 放在橘色按鈕右邊；右邊擠不下（手機）就放在它上面
function placeQuit() {
  const show = !!(act.busy?.badminton || (duel && quizBox.hidden && paintBox.hidden && rpsBox.hidden && fluteBox.hidden && foodBox.hidden && bbBox.hidden));   // 單字、著色、猜拳、直笛、蜜袋鼯、棒球有自己的結束鈕
  if (quitBtn.hidden === show) quitBtn.hidden = !show;
  if (!show) return;
  const r = actBtn.getBoundingClientRect(), q = quitBtn.getBoundingClientRect();
  if (r.right + 10 + q.width < innerWidth - 8) { quitBtn.style.left = `${r.right + 10}px`; quitBtn.style.top = `${r.top + (r.height - q.height) / 2}px`; }
  else { quitBtn.style.left = `${Math.max(8, r.left + (r.width - q.width) / 2)}px`; quitBtn.style.top = `${r.top - q.height - 10}px`; }
}
const limbs = () => avatar.userData.limbs;
function resetPose() { const L = limbs(); if (L) for (const k of ['armL', 'armR', 'legL', 'legR']) L[k].rotation.set(0, 0, 0); }

/* ---------------- 羽球小遊戲：在操場或活動中心遇到會打羽球的老師，就可以跟老師對打 ----------------
   架起球網、學生站到 6 公尺外；左右移動接球（A D／← →／搖桿），羽毛球飛到身邊時按 F／空白鍵（手機按橘色按鈕）揮拍。
   時機抓得很準就是「殺球」；漏接就結束，記錄最高來回數。 */

const BADMINTON_KEY = 'campus-badminton-best';
const shuttle = makeShuttle(); shuttle.scale.setScalar(1.8); shuttle.visible = false; scene.add(shuttle);
const myRacket = makeRacket(), npcRacket = makeRacket();
for (const r of [myRacket, npcRacket]) { r.position.set(0, -0.6, 0); r.rotation.x = Math.PI; }   // 接在手上，當成手臂的延伸
const badmintonNet = (() => {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const c = cv.getContext('2d'); c.strokeStyle = 'rgba(25,25,25,.9)';
  for (let x = 0; x <= 256; x += 4) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, 32); c.stroke(); }
  for (let y = 0; y <= 32; y += 4) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(256, y + 0.5); c.stroke(); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 0.76), new THREE.MeshLambertMaterial({ map: tx, transparent: true, side: THREE.DoubleSide }));
  net.position.y = 1.17; g.add(net);
  const white = new THREE.MeshLambertMaterial({ color: '#f4f4f4' }), pole = new THREE.MeshLambertMaterial({ color: '#c9ccd1' });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.05, 0.02), white); tape.position.y = 1.55; g.add(tape);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.06), pole); p.position.set(sx * 3.08, 0.775, 0); g.add(p); }
  g.visible = false; scene.add(g);
  return g;
})();
// 老師可不可以在這裡打：呂老師一直在操場；陳老師只有在活動中心的時候可以（教室裡不行）
//（鄧老師的投籃比賽也用同一套：game＝'shootout'）
const canPlayGame = (n) => !!n.game && !n.playing && (!n.places || !!n.places[n.placeIdx]?.game);
function badmintonSpot() {
  if (mode === 'bird') return null;
  for (const n of NPCS) {
    if (canPlayGame(n) && player.floor === n.f && Math.hypot(player.x - n.g.position.x, player.z - n.g.position.z) < 2.6) return { kind: n.game, npc: n };
  }
  return null;
}
// 羽球／桌球共用的參數（startBadminton 的第二個參數）
const BAD = { D: 6, Dmin: 3.5, net: badmintonNet, mine: myRacket, theirs: npcRacket, ball: shuttle, key: BADMINTON_KEY, icon: '🏸', ballName: '羽毛球',
  myH: 1.2, npcH: 1.95, arc: 2.0, T0: 1.65, Tmin: 0.85, spread: 2.2, side: 2.6, speed: 4.6, reach: 1.0, smash: '殺球' };

/* ---------------- 桌球：在三年五班遇到林老師，說「好啊」就一起瞬間移動到 B1 桌球教室那張球桌開打 ----------------
   跟羽球一樣左右移動、球飛到身邊時揮拍；打完（或按結束）兩個人一起回到教室 */
const ppBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
ppBall.visible = false; scene.add(ppBall);
const makePaddle = () => {                                             // 桌球拍：紅色拍面、木頭握把
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 16).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#d32f2f' }));
  face.position.y = -0.2; g.add(face);
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.025), new THREE.MeshLambertMaterial({ color: '#c08a4a' })); h.position.y = -0.06; g.add(h);
  g.position.set(0, -0.6, 0); g.rotation.x = Math.PI;
  return g;
};
const myPaddle = makePaddle(), npcPaddle = makePaddle();
// B1 那張比賽用的球桌（furniture.js tableTennisHall 也在 u=8.7、v=2.5 放了一張）
const ppTable = () => { const r = rooms.find((x) => x.name === '桌球教室'); return { f: r.f, x: (r.m.x1 + r.m.x2) / 2 + 2.5, z: r.m.z1 + WALL_T / 2 + 0.02 + 8.7 }; };
function startPingpong(n) {
  stopAuto();
  const home = { f: n.f, pos: n.g.position.clone(), yaw: n.yaw, px: player.x, pz: player.z, pyaw: player.yaw };
  const T = ppTable();
  toast(`🏓 ${n.name}：好！我們去地下室桌球教室！`);
  // 瞬間移動：老師站球桌西邊、面向東；學生由 startBadminton 放到球桌東邊
  placeNPC(n, T.f, T.x - 2.35, T.z, -Math.PI / 2);
  n.label.visible = false;
  startBadminton(n, { ...BAD, D: 4.7, Dmin: 4.7, net: null, mine: myPaddle, theirs: npcPaddle, ball: ppBall, key: 'campus-pingpong-best', icon: '🏓', ballName: '桌球',
    myH: 0.95, npcH: 0.95, arc: 0.32, T0: 1.05, Tmin: 0.6, spread: 0.6, side: 0.9, speed: 3.2, reach: 0.65, smash: '殺球', pp: true,
    onStop() {
      setTimeout(() => {                                               // 打完：一起回教室
        placeNPC(n, home.f, home.pos.x, home.pos.z, home.yaw); n.label.visible = true;
        placeAt(home.f, home.px, home.pz, home.pyaw);
        toast(`🏓 回到教室囉！${n.name}：請保持安靜～`);
      }, 400);
    } });
}
function startBadminton(n, P = BAD) {
  stopAuto();
  const f = n.f, T0 = n.g.position.clone(), yaw0 = n.yaw;
  // 球場方向＝老師面向的方向；學生站 6 公尺外（站不下就近一點）
  const ux = -Math.sin(yaw0), uz = -Math.cos(yaw0);
  let D = P.D;
  while (D > P.Dmin && !isWalkable(f, T0.x + ux * D, T0.z + uz * D, 0.3)) D -= 0.5;
  const rx = uz, rz = -ux;                                            // 學生面向老師時的「右手邊」
  const P0 = { x: T0.x + ux * D, z: T0.z + uz * D };
  const ground = (x, z) => f.y + groundAt(f, x, z);
  const face = Math.atan2(ux, uz);                                    // 學生面向老師
  let me = 0, them = 0, themTo = 0;                                   // 左右偏移（公尺）
  const myAt = () => [P0.x + rx * me, P0.z + rz * me];
  const npcAt = () => [T0.x + rx * them, T0.z + rz * them];
  const mx0 = T0.x + ux * D / 2, mz0 = T0.z + uz * D / 2;
  if (P.net) { P.net.position.set(mx0, ground(mx0, mz0), mz0); P.net.rotation.y = Math.atan2(-rz, rx); P.net.visible = true; }
  placeAt(f, P0.x, P0.z, face); avatar.rotation.y = face; player.pitch = 0.08;
  const L = limbs(); L?.armR.add(P.mine);
  const nL = n.g.userData.limbs, nArm = n.look.holdL === 'racket' ? nL.armL : nL.armR;   // 陳老師本來就左手拿拍
  if (nArm === nL.armR || P.pp) nArm.add(P.theirs);
  n.playing = true;
  const tFace = Math.atan2(-ux, -uz);                                 // 老師面向學生
  n.g.rotation.y = tFace;
  let best = 0; try { best = +localStorage.getItem(P.key) || 0; } catch { /* 私密模式 */ }
  const touch = matchMedia('(pointer: coarse)').matches;
  toast(touch ? `${P.icon} 用搖桿左右移動，${P.ballName}飛到身邊時按橘色按鈕揮拍！` : `${P.icon} 用 A D 或 ← → 左右移動，${P.ballName}飛到身邊時按 F 或空白鍵揮拍！`);

  let rally = 0, t = 0, fl = null, swing = 9, npcSwing = 9, phase = 0, moving = 0, over = 0, serveAt = 1.6;
  const SEX = P.myH;                                                   // 學生擊球高度（學生比例比較小）
  // 羽毛球飛行：a → b 直線＋拋物線（H＝最高點比直線高多少）；k>1 之後沿著同一條拋物線繼續往下掉
  const launch = (a, b, T, H, toMe) => { fl = { a, b, T, H, t: 0, toMe, hit: false }; P.ball.visible = true; };
  const flAt = (k) => {
    const { a, b, H } = fl;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 4 * H * k * (1 - k), a[2] + (b[2] - a[2]) * k];
  };
  const npcShot = () => {
    // 老師回球：越打越快、越打越刁
    const off = (Math.random() * 2 - 1) * Math.min(P.spread, 0.6 * P.spread / 2.2 + rally * 0.18 * P.spread / 2.2);
    const [nx, nz] = npcAt();
    const T = Math.max(P.Tmin, P.T0 - rally * 0.06 * P.T0 / 1.65);
    launch([nx, ground(nx, nz) + P.npcH, nz], [P0.x + rx * off, ground(P0.x, P0.z) + SEX, P0.z + rz * off], T, P.arc, true);
    npcSwing = 0;
  };
  const end = () => {
    over = 1;
    if (rally > best) { best = rally; try { localStorage.setItem(P.key, String(best)); } catch { /* 私密模式 */ } }
  };
  act.busy = {
    badminton: true, pp: !!P.pp,
    get label() { return over ? `${P.icon} 來回 <b>${rally}</b> 球　最高 ${best}` : `${P.icon} 揮拍 <kbd>F</kbd>　來回 <b>${rally}</b>　最高 ${best}`; },
    tick(dt) {
      t += dt;
      if (mode === 'bird' || player.floor !== f) { this.stop(); return; }
      // 左右移動
      if (!over) {
        let mv = 0;
        if (keys.KeyA || keys.ArrowLeft) mv -= 1;
        if (keys.KeyD || keys.ArrowRight) mv += 1;
        mv += joy.x;
        mv = Math.max(-1, Math.min(1, mv));
        me = Math.max(-P.side, Math.min(P.side, me + mv * P.speed * dt));
        if (Math.abs(mv) > 0.05) phase += dt * 9;
        moving += ((Math.abs(mv) > 0.05 ? 1 : 0) - moving) * Math.min(1, dt * 10);
      }
      const [px, pz] = myAt();
      player.x = px; player.z = pz; player.gy = groundAt(f, px, pz);
      player.yaw = face; avatar.rotation.y = face;
      // 老師跑去接球
      them += Math.max(-6 * dt, Math.min(6 * dt, themTo - them));
      const [nx, nz] = npcAt();
      n.g.position.set(nx, ground(nx, nz), nz); n.g.rotation.y = tFace;
      // 手臂：學生準備姿勢／揮拍；老師也一樣
      swing += dt; npcSwing += dt;
      const arm = (a, s) => {
        if (s < 0.25) { a.rotation.set(-2.2 - (s / 0.25) * 2.4, 0, 0.15); return; }      // 由上往前揮下去
        a.rotation.set(-2.2, 0, 0.35);                                                     // 舉拍準備
      };
      if (L) {
        animatePerson(avatar, phase, over ? 0 : moving);
        arm(L.armR, swing);
      }
      arm(nArm, npcSwing);
      // 發球
      if (!fl && !over) { if (t > serveAt) npcShot(); return; }
      if (!fl) { if (over && (over += dt) > 2.2) this.stop(); return; }
      fl.t += dt;
      const k = fl.t / fl.T, p = flAt(k), q = flAt(k + 0.01);
      P.ball.position.set(p[0], p[1], p[2]);
      const v = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize();
      P.ball.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v);       // 球頭在前面
      if (!fl.toMe && k >= 1) {                                       // 老師接到了，打回來
        npcShot();
        return;
      }
      if (fl.toMe && !over && fl.t > fl.T + 0.18) end();          // 來不及了
      if (p[1] <= ground(p[0], p[2]) + 0.04) {                          // 掉到地上
        P.ball.position.y = ground(p[0], p[2]) + 0.04;
        fl = null;
        if (!over) end();
        npcFace(n, 'happy', 3);                                           // 老師笑了
        toast(rally > 0 && rally >= best ? `${P.icon} 漏接了！來回 ${rally} 球，新紀錄！🎉` : `${P.icon} 漏接了！這局來回 ${rally} 球（最高 ${best} 球）`);
      }
    },
    press() {
      if (over) return;
      if (swing < 0.3) return;                                        // 揮拍中
      swing = 0;
      if (!fl || !fl.toMe || fl.hit) return;
      const tl = fl.T - fl.t, [px, pz] = myAt(), d = Math.hypot(fl.b[0] - px, fl.b[2] - pz);
      if (tl > 0.3 || tl < -0.18 || d > P.reach) return;                  // 太早、太晚、太遠：揮空
      fl.hit = true; rally++;
      const smash = Math.abs(tl) < 0.08 && d < P.reach * 0.6;
      const off = (Math.random() * 2 - 1) * P.spread * 0.8;
      themTo = off;
      const [qx, qz] = [T0.x + rx * off, T0.z + rz * off];
      const sp = P.ball.position;
      launch([sp.x, sp.y, sp.z], [qx, ground(qx, qz) + P.npcH, qz], smash ? P.T0 * 0.42 : P.T0 * 0.8, smash ? P.arc * 0.18 : P.arc * 1.1, false);
      if (smash) { toast(`💥 ${P.smash}！（來回 ${rally} 球）`); npcFace(n, 'surprised', 1.4); }
      else if (rally % 5 === 0) { toast(`${P.icon} 好球！來回 ${rally} 球`); npcFace(n, 'happy', 1.4); }
    },
    stop() {
      P.mine.removeFromParent(); P.theirs.removeFromParent();
      P.ball.visible = false; if (P.net) P.net.visible = false;
      n.playing = false; n.g.position.copy(T0); n.g.rotation.y = yaw0;
      for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);
      resetPose(); act.busy = null;
      P.onStop?.();
    },
  };
}

/* ---------------- 投籃比賽：跟鄧老師輪流投 5 球（操場籃球場、活動中心） ----------------
   站在罰球線附近；你用原本的力道條投籃，老師自動投（大約八成命中）；投完比分數。 */

const SHOOTOUT_KEY = 'campus-shootout-wins', SHOOTOUT_N = 5;
let duel = null;
function startShootout(n) {
  stopAuto();
  const f = n.f, T0 = n.g.position.clone(), yaw0 = n.yaw;
  // 找老師附近（同一層）最近的籃框
  let sp = null, bd = Infinity;
  for (const h of SPOTS) {
    if (h.kind !== 'hoop' || spotFloor(h) !== f) continue;
    const d = Math.hypot(h.x - T0.x, h.z - T0.z);
    if (d < bd) { bd = d; sp = h; }
  }
  if (!sp) { toast('這裡沒有籃框耶！'); return; }
  // 你站罰球線（籃框前 4.2 公尺），老師站在旁邊 1.4 公尺
  const D = 4.2, rx = -sp.fz, rz = sp.fx;
  const P = { x: sp.x + sp.fx * D, z: sp.z + sp.fz * D };
  let side = 1.4;
  if (!isWalkable(f, P.x + rx * side, P.z + rz * side, 0.3)) side = -1.4;
  const Q = { x: P.x + rx * side, z: P.z + rz * side };
  const faceHoop = (x, z) => Math.atan2(-(sp.x - x), -(sp.z - z));
  placeAt(f, P.x, P.z, faceHoop(P.x, P.z)); avatar.rotation.y = player.yaw;
  n.playing = true;
  const nL = n.g.userData.limbs;
  for (const key of ['armL', 'armR']) nL[key].rotation.set(0, 0, 0);   // 放下打招呼的手
  const stand = () => { n.g.position.set(Q.x, f.y + groundAt(f, Q.x, Q.z), Q.z); n.g.rotation.y = faceHoop(Q.x, Q.z); };
  stand();
  let me = 0, them = 0, k = 0, wins = 0;
  try { wins = +localStorage.getItem(SHOOTOUT_KEY) || 0; } catch { /* 私密模式 */ }
  const score = () => `你 <b>${me}</b>：<b>${them}</b> ${n.name}`;
  // 等一下再做下一步（用 act.busy 計時，畫面上顯示比分）
  const wait = (sec, label, next) => { let t = 0; act.busy = { label, tick(dt) { if ((t += dt) > sec) next(); } }; };
  const finish = () => {
    duel = null;
    n.playing = false; n.g.position.copy(T0); n.g.rotation.y = yaw0;
    for (const key of ['armL', 'armR']) nL[key].rotation.set(0, 0, 0);
    act.busy = null;
  };
  const myTurn = () => {
    k++;
    placeAt(f, P.x, P.z, faceHoop(P.x, P.z));
    startShot(sp, {
      quiet: true,
      label: `🏀 第 ${k} / ${SHOOTOUT_N} 球，出手！ <kbd>F</kbd>　${score()}`,
      onDone: (made) => {
        if (made) me++;
        toast(made ? `🏀 你投進了！（${me}：${them}）` : `😣 你沒進（${me}：${them}）`);
        npcFace(n, made ? 'surprised' : 'tongue', 1.5);
        wait(1.0, `🏀 換${n.name}投　${score()}`, theirTurn);
      },
    });
  };
  const theirTurn = () => {
    // 老師舉手瞄準一下再出手
    let t = 0;
    act.busy = {
      label: `🏀 ${n.name}瞄準中…　${score()}`,
      tick(dt) {
        t += dt;
        nL.armL.rotation.x = nL.armR.rotation.x = -2.5 - Math.min(1, t / 0.6) * 0.4;
        if (t < 0.7) return;
        const y = n.g.position.y + 2.05;
        shoot(sp, 0, 0, 0, {
          quiet: true, made: Math.random() < 0.8, limbs: nL, from: { x: Q.x, y, z: Q.z },
          label: `🏀 ${n.name}出手！　${score()}`,
          onDone: (made) => {
            if (made) them++;
            toast(made ? `🏀 ${n.name}投進了！（${me}：${them}）` : `${n.name}沒進！（${me}：${them}）`);
            npcFace(n, made ? 'happy' : 'sad', 1.6);
            if (k < SHOOTOUT_N) wait(1.0, `🏀 換你投　${score()}`, myTurn);
            else wait(1.2, `🏁 比賽結束　${score()}`, () => {
              if (me > them) { wins++; try { localStorage.setItem(SHOOTOUT_KEY, String(wins)); } catch { /* 私密模式 */ } }
              toast(me > them ? `🏆 你贏了！${me}：${them}（已經贏${n.name} ${wins} 次）`
                : me === them ? `🤝 平手！${me}：${them}，再比一次？` : `💪 ${n.name}贏了 ${them}：${me}，再接再厲！`);
              finish();
              npcFace(n, me > them ? 'sad' : me === them ? 'wink' : 'happy', 3);
            });
          },
        });
      },
    };
  };
  duel = { quit() { powerBox.hidden = true; ball.visible = false; finish(); toast('🏀 比賽中止'); } };
  toast(`🏀 投籃比賽！你跟${n.name}輪流投 ${SHOOTOUT_N} 球，進比較多球的贏。<br>綠色區域時按 F 出手！`);
  wait(1.2, `🏀 準備…　${score()}`, myTurn);
}

/* ---------------- 英文單字小測驗：遇到 Ashley 老師（輔導室外走廊、2F 英語教室一）可以練背單字 ----------------
   看中文和圖示，用鍵盤打出英文單字，按 Enter 送出；每次隨機考 3～5 個（顏色、動物、文具）。
   答錯可以再試一次（提示會多給一個字母），第二次還錯就公布答案。答完會唸出發音。 */

const WORDS_KEY = 'campus-words-best';
const WORD_BANK = {
  顏色: [['red', '紅色', '🔴'], ['blue', '藍色', '🔵'], ['green', '綠色', '🟢'], ['yellow', '黃色', '🟡'], ['orange', '橘色', '🟠'],
    ['purple', '紫色', '🟣'], ['pink', '粉紅色', '🌸'], ['black', '黑色', '⚫'], ['white', '白色', '⚪'], ['brown', '咖啡色', '🟤']],
  動物: [['cat', '貓', '🐱'], ['dog', '狗', '🐶'], ['bird', '鳥', '🐦'], ['fish', '魚', '🐟'], ['rabbit', '兔子', '🐰'], ['tiger', '老虎', '🐯'],
    ['monkey', '猴子', '🐵'], ['elephant', '大象', '🐘'], ['pig', '豬', '🐷'], ['duck', '鴨子', '🦆'], ['lion', '獅子', '🦁'], ['bear', '熊', '🐻'], ['hamster', '倉鼠', '🐹']],
  文具: [['pen', '原子筆', '🖊️'], ['pencil', '鉛筆', '✏️'], ['eraser', '橡皮擦', '🧽'], ['ruler', '尺', '📏'], ['book', '書', '📕'],
    ['glue', '膠水', '🧴'], ['scissors', '剪刀', '✂️'], ['crayon', '蠟筆', '🖍️'], ['notebook', '筆記本', '📓'], ['bag', '書包', '🎒']],
};
const quizBox = document.getElementById('quiz'), quizInput = quizBox.querySelector('input');
// 唸英文發音（瀏覽器支援才唸）
function sayEnglish(word) {
  try {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch { /* 不支援就算了 */ }
}
function startWords(n) {
  stopAuto();
  // 隨機抽 3～5 個不重複的單字（各類混在一起）
  const all = Object.entries(WORD_BANK).flatMap(([cat, list]) => list.map(([en, zh, emo]) => ({ en, zh, emo, cat })));
  for (let i = all.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [all[i], all[j]] = [all[j], all[i]]; }
  const qs = all.slice(0, 3 + (Math.random() * 3 | 0));
  let k = 0, tries = 0, right = 0, locked = false;
  n.playing = true;
  const face = Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z);
  n.g.rotation.y = face;                                                // 老師面向你
  const $ = (sel) => quizBox.querySelector(sel);
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const hint = () => {
    const w = qs[k].en, show = Math.min(w.length - 1, 1 + tries);    // 先給第一個字母，答錯再多給一個
    $('.hint').textContent = w.split('').map((c, i) => (i < show ? c : '_')).join(' ');
  };
  const ask = () => {
    const q = qs[k];
    tries = 0; locked = false;
    $('.cat').textContent = q.cat; $('.prog').textContent = `第 ${k + 1} / ${qs.length} 題`;
    $('.emo').textContent = q.emo; $('.q').textContent = q.zh;
    hint(); msg('');
    quizInput.value = ''; quizInput.disabled = false;
    setTimeout(() => { quizInput.value = ''; quizInput.focus(); }, 60);   // 等按 F 的那一下結束再對準輸入框，F 才不會被打進去
  };
  const next = () => {
    k++;
    if (k < qs.length) { ask(); return; }
    let best = 0;
    try { best = +localStorage.getItem(WORDS_KEY) || 0; if (right > best) localStorage.setItem(WORDS_KEY, String(right)); } catch { /* 私密模式 */ }
    const perfect = right === qs.length;
    finish();
    toast(perfect ? `🌟 全對！${right} / ${qs.length}<br>${n.name}：Great job！你好棒！`
      : `📝 答對 ${right} / ${qs.length} 題<br>${n.name}：Good try！下次再來練習喔！`);
  };
  const reveal = (ok) => {
    const q = qs[k];
    locked = true; quizInput.disabled = true;
    $('.hint').textContent = q.en.split('').join(' ');
    npcFace(n, ok ? 'happy' : 'sad', 1.8);
    msg(ok ? `✅ 答對了！<b>${q.en}</b> = ${q.zh}` : `答案是 <b>${q.en}</b>（${q.zh}），記起來囉！`, ok ? 'ok' : 'no');
    sayEnglish(q.en);
    setTimeout(next, ok ? 1300 : 2200);
  };
  const submit = () => {
    if (locked) return;
    const a = quizInput.value.trim().toLowerCase();
    if (!a) { msg('先打英文單字再送出喔！', 'no'); quizInput.focus(); return; }
    if (a === qs[k].en) { right++; reveal(true); return; }
    tries++;
    if (tries < 2) { hint(); msg('❌ 不太對，看提示再試一次！', 'no'); quizInput.select(); return; }
    reveal(false);
  };
  const finish = () => {
    quizBox.hidden = true; quizInput.blur();
    n.playing = false; act.busy = null; duel = null;
    quizInput.onkeydown = null;
  };
  $('.go').onclick = submit;
  $('.skip').onclick = () => { if (!locked) reveal(false); };
  $('.quit').onclick = () => duel?.quit();
  quizInput.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') duel?.quit();
  };
  duel = { quit() { finish(); toast(`📝 下次再來找${n.name}練單字喔！`); } };
  act.busy = { label: '📝 單字測驗中…', tick() {} };                 // 測驗時不能走動
  quizBox.hidden = false;
  $('.tip').textContent = `${n.name}：Let's practice！看中文打出英文單字 🔊 答完會唸出發音`;
  ask();
}

/* ---------------- 剪刀石頭布：在五年一班遇到 Poyen 老師，可以猜拳（三戰兩勝，平手重來） ----------------
   點按鈕或按 1／2／3 出拳；喊完「剪刀、石頭、布！」一起亮出來，老師頭上也會冒出他出的拳。 */

// 面對面的小遊戲（猜拳、直笛）：站到老師斜前方 2.2 公尺（偏右一點），鏡頭才不會被自己擋住老師；
//   先把這層的名牌收起來，老師轉過來面向你、放下打招呼的手
function faceTeacher(n) {
  const T = n.g.position, fx = -Math.sin(n.yaw), fz = -Math.cos(n.yaw), rx = -fz, rz = fx;
  let px = T.x + fx * 2.2 + rx * 1.0, pz = T.z + fz * 2.2 + rz * 1.0;
  if (!isWalkable(n.f, px, pz, 0)) { px = T.x + fx * 2.2 - rx * 1.0; pz = T.z + fz * 2.2 - rz * 1.0; }
  const faceYaw = Math.atan2(-(T.x - px), -(T.z - pz));
  placeAt(n.f, px, pz, faceYaw); avatar.rotation.y = faceYaw; player.pitch = -0.05;
  player.yaw = faceYaw + 0.42;                                         // 角色面向老師，鏡頭偏一點角度，老師就在角色旁邊、不會被擋住
  n.f.labels.visible = false;
  n.g.rotation.y = Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z);
  for (const k of ['armL', 'armR']) n.g.userData.limbs[k].rotation.set(0, 0, 0);
}

const RPS_KEY = 'campus-rps-wins';
const RPS = [{ e: '✌️', n: '剪刀' }, { e: '✊', n: '石頭' }, { e: '🖐️', n: '布' }];
const rpsBox = document.getElementById('rps');
function startRps(n) {
  stopAuto();
  const $ = (sel) => rpsBox.querySelector(sel);
  const btns = [...rpsBox.querySelectorAll('[data-h]')];
  let me = 0, them = 0, round = 0, wins = 0, locked = false, bubble = null, done = false;
  try { wins = +localStorage.getItem(n.rpsKey || RPS_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  const nL = n.g.userData.limbs;
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const show = () => {
    $('.who').textContent = n.name;
    $('.score').textContent = `${me} ： ${them}`;
    $('.round').textContent = me >= 2 || them >= 2 ? '比賽結束' : `第 ${round + 1} 局`;
  };
  // 老師頭上的拳（名牌下面）
  const popHand = (h) => {
    clearHand();
    bubble = makeLabel(RPS[h].e, '', n.g.position.x, n.g.position.y + 2.45, n.g.position.z, { bg: '#8fdc2c', h: 0.7 });
    scene.add(bubble);
  };
  const clearHand = () => { if (bubble) { scene.remove(bubble); bubble.material.map?.dispose(); bubble.material.dispose(); bubble = null; } };
  const ready = () => {
    locked = false; btns.forEach((b) => (b.disabled = false));
    $('.me').textContent = '❔'; $('.them').textContent = '❔';
    $('.me').classList.remove('shake'); $('.them').classList.remove('shake');
    show();
  };
  const finish = () => {
    done = true; rpsBox.hidden = true; clearHand();
    updateVisibility();                                                 // 名牌放回來
    removeEventListener('keydown', onKey, true);
    for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);
    n.playing = false; act.busy = null; duel = null;
  };
  const choose = (h) => {
    if (locked) return;
    locked = true; btns.forEach((b) => (b.disabled = true));
    clearHand();
    $('.me').classList.add('shake'); $('.them').classList.add('shake');
    $('.me').textContent = '✊'; $('.them').textContent = '✊';
    msg('剪刀、石頭、布！');
    // 老師一起甩手：舉起右手上下擺
    let t = 0;
    act.busy = { label: '✂️ 剪刀石頭布…', tick(dt) { t += dt; nL.armR.rotation.x = 1.6 + Math.sin(t * 20) * 0.45; } };
    setTimeout(() => {
      if (done) return;                                                // 中途按了結束
      const tHand = Math.random() * 3 | 0, r = (h - tHand + 3) % 3;   // 0 平手、1 你贏、2 老師贏
      $('.me').classList.remove('shake'); $('.them').classList.remove('shake');
      $('.me').textContent = RPS[h].e; $('.them').textContent = RPS[tHand].e;
      nL.armR.rotation.x = 1.9;
      popHand(tHand);
      act.busy = { label: '✂️ 剪刀石頭布中…', tick() {} };
      if (r === 0) { msg(`平手！都出${RPS[h].n}，再來一次！`); npcFace(n, 'wink', 1.6); }
      else if (r === 1) { me++; round++; msg(`✅ ${RPS[h].n}贏${RPS[tHand].n}！你贏這局！`, 'ok'); npcFace(n, 'sad', 1.8); }
      else { them++; round++; msg(`❌ ${RPS[tHand].n}贏${RPS[h].n}！${n.name}贏這局`, 'no'); npcFace(n, 'tongue', 1.8); }
      show();
      if (me < 2 && them < 2) { setTimeout(() => { if (!done) ready(); }, 1300); return; }
      // 三戰兩勝結束
      setTimeout(() => {
        if (done) return;
        if (me > them) { wins++; try { localStorage.setItem(n.rpsKey || RPS_KEY, String(wins)); } catch { /* 私密模式 */ } }
        npcFace(n, me > them ? 'surprised' : 'happy', 3);
        finish();
        toast(me > them ? `🏆 你贏了！${me}：${them}（已經贏${n.name} ${wins} 次）<br>${n.name}：${n.rpsTalk?.win ?? '好厲害！'}`
          : `😝 ${n.name}贏了！${them}：${me}<br>${n.name}：${n.rpsTalk?.lose ?? '再接再厲！'}`);
      }, 1500);
    }, 900);
  };
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); choose(k); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b) => (b.onclick = () => choose(+b.dataset.h)));
  $('.quit').onclick = () => duel?.quit();
  duel = { quit() { finish(); toast(`✂️ 下次再來找${n.name}猜拳！`); } };
  act.busy = { label: '✂️ 剪刀石頭布中…', tick() {} };                 // 猜拳時不能走動
  rpsBox.hidden = false;
  msg(`${n.name}：${n.rpsTalk?.start ?? '來猜拳吧！先贏兩局的人獲勝！'}`);
  ready();
}

/* ---------------- 直笛記憶：在音樂教室二遇到小瑜老師，老師吹一段，你照順序吹回去（每過一關多一個音） ----------------
   用直笛最先學的五個音 Sol La Si 高音Do 高音Re；點按鈕或按 1～5。吹錯了老師會再吹一次（兩顆愛心），第二次錯就結束，記錄最高關數。 */

const FLUTE_KEY = 'campus-flute-best';
// 高音直笛（聽起來比譜高八度）：G5 A5 B5 C6 D6；f 是指法：後面拇指孔｜前面 7 個孔，1 是按住
const FLUTE = [
  { n: 'Sol', abc: 'G', hz: 784.0, c: '#ef5350', f: '1|1110000' },
  { n: 'La', abc: 'A', hz: 880.0, c: '#ffa726', f: '1|1100000' },
  { n: 'Si', abc: 'B', hz: 987.8, c: '#fdd835', f: '1|1000000' },
  { n: 'Do', hi: true, abc: 'C', hz: 1046.5, c: '#66bb6a', f: '1|0100000' },
  { n: 'Re', hi: true, abc: 'D', hz: 1174.7, c: '#42a5f5', f: '0|0100000' },
];
const fluteName = (k) => (FLUTE[k].hi ? '高音' : '') + FLUTE[k].n;
let fluteAudio = null;
// 用 WebAudio 合成直笛聲：正弦波＋一點點高八度泛音、輕輕的顫音、柔和的起音
function fluteNote(hz, dur = 0.45) {
  try {
    fluteAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const ac = fluteAudio, t = ac.currentTime + 0.01;
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator();
    const g = ac.createGain(), g2 = ac.createGain(), lg = ac.createGain();
    o.type = 'sine'; o.frequency.value = hz;
    o2.type = 'triangle'; o2.frequency.value = hz * 2; g2.gain.value = 0.06;
    lfo.frequency.value = 5.5; lg.gain.value = hz * 0.004;
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.05);
    g.gain.setValueAtTime(0.18, t + Math.max(0.06, dur - 0.1)); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.03); }
  } catch { /* 沒有音效也能玩 */ }
}
const fluteBox = document.getElementById('flute');
// 五個音的按鈕：唱名、音名＋按鍵、指法圖（左邊那顆是後面的拇指孔）
fluteBox.querySelector('.keys').innerHTML = FLUTE.map((x, k) => {
  const [th, fr] = x.f.split('|');
  const holes = `<i class="th ${th === '1' ? 'on' : ''}"></i>` + [...fr].map((h) => `<i class="${h === '1' ? 'on' : ''}"></i>`).join('');
  return `<button data-k="${k}" style="--c:${x.c}"><b>${x.hi ? '<small>高音</small>' : ''}${x.n}</b><span class="fing">${holes}</span><small>${x.abc}・${k + 1}</small></button>`;
}).join('');
function startFlute(n) {
  stopAuto(); bgmHold('flute', true);                                   // 聽老師吹直笛時，校歌先停
  const $ = (sel) => fluteBox.querySelector(sel);
  const btns = [...fluteBox.querySelectorAll('[data-k]')];
  let best = 0, seq = [], pos = 0, lives = 2, done = false, listening = false, bubble = null;
  try { best = +localStorage.getItem(FLUTE_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  const nL = n.g.userData.limbs;
  const level = () => seq.length - 2;                                   // 第 1 關 3 個音
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const show = () => {
    $('.lv').textContent = `第 ${level()} 關`;
    $('.lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(2 - lives);
    $('.best').textContent = best ? `🏅 最佳紀錄：第 ${best} 關` : '🏅 還沒有紀錄，加油！';
    $('.prog').innerHTML = seq.map((k, i) => `<i style="${i < pos ? `background:${FLUTE[k].c}` : ''}"></i>`).join('');
  };
  const setBtns = (on) => btns.forEach((b) => (b.disabled = !on));
  const light = (k, ms) => { const b = btns[k]; b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), ms); };
  const clearNote = () => { if (bubble) { scene.remove(bubble); bubble.material.map?.dispose(); bubble.material.dispose(); bubble = null; } };
  const popNote = (k) => {                                              // 老師頭上冒出音符
    clearNote();
    bubble = makeLabel(`♪ ${fluteName(k)}`, '', n.g.position.x, n.g.position.y + 2.45, n.g.position.z, { bg: FLUTE[k].c, h: 0.45 });
    scene.add(bubble);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // 舉起直笛到嘴邊（左手拿直笛、右手扶著下面；直笛是左手最後一個子物件，吹的時候轉成吹嘴朝嘴巴、笛尾朝前下方）
  const flute = nL.armL.children.at(-1), restRot = flute.rotation.clone();
  const blow = (on) => {
    nL.armL.rotation.set(on ? 1.15 : 0, 0, on ? 0.55 : 0); nL.armR.rotation.set(on ? 0.95 : 0, 0, on ? -0.35 : 0);
    if (on) flute.rotation.set(-0.5, 0, -0.7); else flute.rotation.copy(restRot);
  };
  const teacherPlays = async () => {
    listening = false; setBtns(false); pos = 0; show();
    msg(`🎵 ${n.name}吹給你聽，仔細聽喔…`);
    blow(true);
    await wait(800);
    const step = Math.max(400, 650 - seq.length * 20);                // 越後面吹得越快一點
    for (const k of seq) {
      if (done) return;
      fluteNote(FLUTE[k].hz, step / 1000 * 0.85); light(k, step * 0.8); popNote(k);
      nL.armR.rotation.x = 0.95 + (k - 2) * 0.04;                       // 右手跟著音高動一動
      await wait(step);
    }
    clearNote(); blow(false);
    if (done) return;
    listening = true; setBtns(true);
    msg(`換你吹！照順序按出這 ${seq.length} 個音`);
  };
  const addNote = () => {                                               // 隨機加一個音（不要同一個音連續出現三次）
    let k;
    do k = Math.random() * FLUTE.length | 0; while (seq.length >= 2 && seq.at(-1) === k && seq.at(-2) === k);
    seq.push(k);
  };
  const press = (k) => {
    if (!listening) return;
    fluteNote(FLUTE[k].hz, 0.35); light(k, 260);
    if (k === seq[pos]) {
      pos++; show();
      if (pos < seq.length) return;
      listening = false; setBtns(false);
      if (level() > best) { best = level(); try { localStorage.setItem(FLUTE_KEY, String(best)); } catch { /* 私密模式 */ } }
      npcFace(n, 'happy', 1.6);
      msg(['✅ 全部吹對了！', '✅ 好好聽！', '✅ 音感真好！'][Math.random() * 3 | 0] + '下一關多一個音', 'ok');
      setTimeout(() => { if (done) return; addNote(); teacherPlays(); }, 1500);
      return;
    }
    lives--; listening = false; setBtns(false); show();
    if (lives > 0) {
      npcFace(n, 'surprised', 1.6);
      msg(`❌ 第 ${pos + 1} 個音應該是 ${fluteName(seq[pos])}，老師再吹一次給你聽`, 'no');
      setTimeout(() => { if (!done) teacherPlays(); }, 1800);
      return;
    }
    npcFace(n, 'sad', 1.8);
    msg(`❌ 第 ${pos + 1} 個音應該是 ${fluteName(seq[pos])}`, 'no');
    const lv = level() - 1;
    setTimeout(() => {
      if (done) return;
      npcFace(n, 'happy', 3);
      finish();
      toast(lv > 0 ? `🎵 你過了 ${lv} 關！（最佳紀錄：第 ${best} 關）<br>${n.name}：很棒喔！回家多練習，下次挑戰更長的旋律！`
        : `🎵 ${n.name}：沒關係，多聽幾次就記得了，再來挑戰一次吧！`);
    }, 1600);
  };
  const finish = () => {
    done = true; fluteBox.hidden = true; clearNote(); blow(false); bgmHold('flute', false);
    updateVisibility();                                                 // 名牌放回來
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; duel = null;
  };
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); press(k); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b) => (b.onclick = () => press(+b.dataset.k)));
  $('.quit').onclick = () => duel?.quit();
  duel = { quit() { finish(); toast(`🎵 下次再來找${n.name}吹直笛！`); } };
  act.busy = { label: '', tick() {} };                                  // 玩的時候不能走動（視窗在下面，橘色提示鈕先收起來）
  fluteBox.hidden = false;
  for (let i = 0; i < 3; i++) addNote();
  msg(`${n.name}：老師先吹，你照順序吹回去喔！`);
  show(); setBtns(false);
  setTimeout(() => { if (!done) teacherPlays(); }, 1200);
}

/* ---------------- 蜜袋鼯能吃嗎？：遇到邱老師（教務處的花花、泡泡是她養的），判斷每樣東西蜜袋鼯能不能吃 ----------------
   一回 5 題（能吃、不能吃各 2～3 題，順序打亂）；點按鈕或按 1（可以吃）／2（不能吃），答完老師會說明原因。 */

const FOOD_KEY = 'campus-glider-food-best';
const GLIDER_FOOD = [
  { e: '🍎', n: '蘋果', ok: 1, why: '去皮、去籽、切小塊，是很棒的水果點心。' },
  { e: '🥭', n: '芒果', ok: 1, why: '去皮去籽、切小塊，香香甜甜牠很愛。' },
  { e: '🍌', n: '香蕉', ok: 1, why: '可以吃，但是很甜，一次一小塊就好。' },
  { e: '🫐', n: '藍莓', ok: 1, why: '小小一顆剛好入口，還有很多維生素。' },
  { e: '🍈', n: '哈密瓜', ok: 1, why: '去皮切小塊，水分多又好吃。' },
  { e: '🍉', n: '西瓜', ok: 1, why: '把籽挑掉、切小塊，夏天的好點心。' },
  { e: '🍠', n: '地瓜', ok: 1, why: '要煮熟、不加調味料，切小塊給牠。' },
  { e: '🌽', n: '玉米', ok: 1, why: '煮熟的玉米粒，不加鹽、不加奶油。' },
  { e: '🐛', n: '麵包蟲', ok: 1, why: '蜜袋鼯在野外也會吃昆蟲，這是很重要的蛋白質。' },
  { e: '🦗', n: '蟋蟀', ok: 1, why: '昆蟲是蜜袋鼯天然的食物，補充蛋白質。' },
  { e: '🥚', n: '水煮蛋', ok: 1, why: '煮熟、不加鹽，一小塊就能補充蛋白質。' },
  { e: '🥣', n: '蜜袋鼯專用飼料', ok: 1, why: '專用飼料的營養最均衡，是每天的主食。' },
  { e: '🍫', n: '巧克力', ok: 0, why: '巧克力裡的可可鹼對蜜袋鼯有毒，一點點都不行！' },
  { e: '🧅', n: '洋蔥', ok: 0, why: '洋蔥會傷害蜜袋鼯的紅血球，讓牠生病。' },
  { e: '🧄', n: '大蒜', ok: 0, why: '跟洋蔥一樣，會傷害蜜袋鼯的血液。' },
  { e: '🥑', n: '酪梨', ok: 0, why: '酪梨裡有對很多小動物有毒的成分。' },
  { e: '☕', n: '咖啡', ok: 0, why: '咖啡因會讓牠心跳太快，非常危險！' },
  { e: '🧋', n: '珍珠奶茶', ok: 0, why: '有咖啡因、又加了很多糖，人喝都要少喝了！' },
  { e: '🍬', n: '糖果', ok: 0, why: '太甜了，會蛀牙、變胖，對身體不好。' },
  { e: '🍟', n: '薯條', ok: 0, why: '又油又鹹，蜜袋鼯的身體負擔不了。' },
  { e: '🥤', n: '汽水', ok: 0, why: '糖太多又有氣泡，喝了會不舒服。' },
  { e: '🥛', n: '牛奶', ok: 0, why: '蜜袋鼯消化不了牛奶裡的乳糖，會拉肚子。' },
];
const foodBox = document.getElementById('food');
const GLIDER_Q = { list: GLIDER_FOOD, key: FOOD_KEY, title: '🐿️ 蜜袋鼯能吃嗎？', icon: '🐿️', yes: ['✅', '可以吃'], no: ['❌', '不能吃'],
  ask: (q) => `🐿️ 蜜袋鼯可以吃「${q.n}」嗎？`, intro: '花花和泡泡肚子餓了！哪些東西蜜袋鼯可以吃呢？',
  endTalk: (sc, n) => (sc === n ? '你是蜜袋鼯小專家！花花和泡泡謝謝你～' : sc >= 3 ? '很不錯喔！記住不能吃的東西，就是愛護小動物！' : '沒關係，記住哪些不能吃，就是愛護小動物唷！'),
  quitTalk: (n) => `🐿️ 下次再來找${n.name}玩！要愛護小動物唷！` };

/* ---------------- 沉浮實驗：在自然教室一遇到丁丁老師，猜猜東西放進水裡會浮還是沉 ----------------
   一回 5 題；答完東西真的掉進實驗桌上的水箱：浮的漂在水面上下晃，沉的慢慢沉到箱底 */
const FLOAT_KEY = 'campus-float-best';
const FLOAT_ITEMS = [
  { e: '🪵', n: '木塊', ok: 1, why: '木頭比水輕（密度比水小），會浮起來。' },
  { e: '🏓', n: '乒乓球', ok: 1, why: '裡面是空氣，又輕又大，會浮在水面。' },
  { e: '🍎', n: '蘋果', ok: 1, why: '蘋果裡面有很多小空氣，所以會浮起來！' },
  { e: '🧊', n: '冰塊', ok: 1, why: '水結冰後體積變大、變輕，所以冰塊會浮。' },
  { e: '🦆', n: '塑膠小鴨', ok: 1, why: '中間是空心的，裝著空氣，會浮。' },
  { e: '🍃', n: '樹葉', ok: 1, why: '樹葉又薄又輕，會漂在水面上。' },
  { e: '🧽', n: '海綿', ok: 1, why: '乾海綿裡有很多空氣，一開始會浮著。' },
  { e: '🍊', n: '橘子（帶皮）', ok: 1, why: '橘子皮裡有很多小氣室，像救生衣一樣讓它浮起來。' },
  { e: '🪨', n: '石頭', ok: 0, why: '石頭比水重（密度比水大），會沉下去。' },
  { e: '🪙', n: '硬幣', ok: 0, why: '金屬很重，小小一枚也會沉到底。' },
  { e: '🔩', n: '螺絲釘', ok: 0, why: '鐵比水重很多，會沉下去。' },
  { e: '🔑', n: '鑰匙', ok: 0, why: '鑰匙是金屬做的，會沉下去。' },
  { e: '📎', n: '迴紋針', ok: 0, why: '鐵做的迴紋針會沉（輕輕平放在水面上，有時候會被表面張力托住喔！）' },
  { e: '🥄', n: '鐵湯匙', ok: 0, why: '金屬湯匙比水重，會沉下去。' },
  { e: '🥚', n: '生雞蛋', ok: 0, why: '新鮮的蛋在清水裡會沉（加很多鹽的鹽水裡就會浮起來喔！）' },
  { e: '🔮', n: '玻璃彈珠', ok: 0, why: '玻璃比水重，彈珠會沉到底。' },
];
const floatTank = (() => {                                             // 實驗桌上的水箱（玻璃＋藍色的水）
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.55), new THREE.MeshLambertMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.25, depthWrite: false }));
  glass.position.y = 0.3; g.add(glass);
  const water = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.46, 0.51), new THREE.MeshLambertMaterial({ color: '#4fa8e8', transparent: true, opacity: 0.5, depthWrite: false }));
  water.position.y = 0.24; g.add(water);
  g.visible = false; scene.add(g);
  return g;
})();
const floatItem = (() => {                                             // 掉進水裡的東西（emoji 小圖）
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(0.32, 0.32, 1); sp.renderOrder = 5; sp.visible = false; scene.add(sp);
  sp.userData.set = (e) => { const c = cv.getContext('2d'); c.clearRect(0, 0, 128, 128); c.font = '96px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 64, 70); tex.needsUpdate = true; };
  return sp;
})();
const FLOAT_Q = { list: FLOAT_ITEMS, key: FLOAT_KEY, title: '🧪 沉浮實驗：浮還是沉？', icon: '🧪', yes: ['🛟', '浮起來'], no: ['⚓', '沉下去'],
  ask: (q) => `🧪 把「${q.n}」放進水裡，會浮起來還是沉下去？`, intro: '我們來做實驗吧！先猜猜看，再放進水裡看看結果！',
  endTalk: (sc, n) => (sc === n ? '全部答對！你是小小科學家！' : sc >= 3 ? '很棒喔！同學們跟我一起做，觀察得很仔細！' : '沒關係，實驗就是要多試幾次！'),
  quitTalk: (n) => `🧪 下次再來找${n.name}做實驗！` };
// 水箱放在丁丁老師前面的大實驗桌上；東西從上面掉下來
FLOAT_Q.start = (n) => {
  const r = rooms.find((x) => x.name === '自然教室一'), f = r.f;
  floatTank.position.set(r.m.x2 - 1.75, f.y + 0.87, r.cz + 0.3); floatTank.visible = true;
  FLOAT_Q.anim = null;
  FLOAT_Q.tick = (dt) => {
    const a = FLOAT_Q.anim; if (!a) return;
    a.t += dt;
    const T = floatTank.position, top = T.y + 0.5, bottom = T.y + 0.14;
    let y;
    if (a.t < 0.5) y = T.y + 1.0 - (a.t / 0.5) ** 2 * (1.0 - 0.48);                       // 掉下來
    else if (a.ok) y = top - 0.02 + Math.sin((a.t - 0.5) * 6) * 0.025 * Math.exp(-(a.t - 0.5));   // 浮在水面晃一晃
    else y = Math.max(bottom, top - (a.t - 0.5) * 0.25);                                  // 慢慢沉到底
    floatItem.position.set(T.x, y, T.z);
  };
};
FLOAT_Q.show = (q) => { floatItem.userData.set(q.e); floatItem.visible = true; FLOAT_Q.anim = null; const T = floatTank.position; floatItem.position.set(T.x, T.y + 1.0, T.z); };
FLOAT_Q.reveal = (q) => { FLOAT_Q.anim = { t: 0, ok: q.ok }; };
FLOAT_Q.end = () => { floatTank.visible = false; floatItem.visible = false; FLOAT_Q.tick = null; };

/* ---------------- 熱脹冷縮：在自然教室二遇到竹竹老師，猜猜東西受熱／遇冷會膨脹還是收縮（固體、液體、氣體都有） ----------------
   一回 5 題；答完實驗桌上的東西真的變大或變小，下面是火焰（加熱）或冰塊（冷卻） */
const HEAT_KEY = 'campus-heat-best';
const HEAT_ITEMS = [
  { e: '🏓', c: '🔥', k: '氣體', n: '凹掉的乒乓球泡熱水', ok: 1, why: '球裡的空氣受熱膨脹，把凹下去的地方撐回來！' },
  { e: '🎈', c: '🔥', k: '氣體', n: '氣球放在大太陽下', ok: 1, why: '氣球裡的空氣受熱膨脹，氣球會變大一點。' },
  { e: '🚲', c: '🔥', k: '氣體', n: '夏天曬太陽的腳踏車輪胎', ok: 1, why: '輪胎裡的空氣受熱膨脹，所以夏天打氣不要打太飽。' },
  { e: '🌡️', c: '🔥', k: '液體', n: '溫度計放進熱水裡', ok: 1, why: '溫度計裡的液體受熱膨脹，紅線就往上升。' },
  { e: '🍲', c: '🔥', k: '液體', n: '裝很滿的湯一直加熱', ok: 1, why: '湯（液體）受熱膨脹，體積變大，就容易溢出來。' },
  { e: '🫙', c: '🔥', k: '固體', n: '轉不開的果醬瓶鐵蓋沖熱水', ok: 1, why: '金屬蓋受熱膨脹，變得鬆一點，就比較好打開。' },
  { e: '🛤️', c: '🔥', k: '固體', n: '夏天的鐵軌', ok: 1, why: '鐵軌受熱膨脹會變長，所以鐵軌中間要留一點縫。' },
  { e: '🔌', c: '🔥', k: '固體', n: '夏天的電線', ok: 1, why: '電線受熱膨脹變長，看起來垂得比較低。' },
  { e: '🎈', c: '❄️', k: '氣體', n: '氣球放進冰箱', ok: 0, why: '氣球裡的空氣遇冷收縮，氣球會變小。' },
  { e: '🧴', c: '❄️', k: '氣體', n: '裝熱水蓋緊的寶特瓶慢慢變涼', ok: 0, why: '瓶子裡的空氣遇冷收縮，瓶子會凹進去。' },
  { e: '🏀', c: '❄️', k: '氣體', n: '冬天放在外面的籃球', ok: 0, why: '球裡的空氣遇冷收縮，籃球摸起來比較軟、比較不彈。' },
  { e: '🌡️', c: '❄️', k: '液體', n: '溫度計放進冰水裡', ok: 0, why: '溫度計裡的液體遇冷收縮，紅線就往下降。' },
  { e: '🧪', c: '❄️', k: '液體', n: '熱水裝滿試管再放涼', ok: 0, why: '水（液體）遇冷收縮，水面會比原來低一點。' },
  { e: '🛤️', c: '❄️', k: '固體', n: '冬天的鐵軌', ok: 0, why: '鐵軌遇冷收縮變短，中間的縫會變寬。' },
  { e: '🔌', c: '❄️', k: '固體', n: '冬天的電線', ok: 0, why: '電線遇冷收縮變短，會拉得比較緊。' },
  { e: '⚫', c: '❄️', k: '固體', n: '加熱後穿不過鐵環的鐵球，放進冷水', ok: 0, why: '鐵球遇冷收縮變小，又可以穿過鐵環了！' },
];
const heatSprite = (size) => {                                        // 實驗桌上的東西、火焰／冰塊（emoji 小圖）
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(size, size, 1); sp.renderOrder = 5; sp.visible = false; scene.add(sp);
  sp.userData.size = size;
  sp.userData.set = (e) => { const c = cv.getContext('2d'); c.clearRect(0, 0, 128, 128); c.font = '96px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 64, 70); tex.needsUpdate = true; };
  return sp;
};
const heatItem = heatSprite(0.36), heatFire = heatSprite(0.24);
const HEAT_Q = { list: HEAT_ITEMS, key: HEAT_KEY, title: '🌡️ 熱脹冷縮：膨脹還是收縮？', icon: '🌡️', yes: ['➕', '膨脹'], no: ['➖', '收縮'],
  ask: (q) => `${q.c}「${q.n}」會膨脹還是收縮？（${q.k}）`, intro: '從細節觀察不同的地方！東西變熱、變冷的時候，會變大還是變小呢？',
  endTalk: (sc, n) => (sc === n ? '全部答對！你觀察得好仔細！' : sc >= 3 ? '很棒喔！上課專心，就會越來越厲害！' : '沒關係，記住：受熱膨脹、遇冷收縮！'),
  quitTalk: (n) => `🌡️ 下次再來找${n.name}做實驗！上課要專心唷！` };
// 東西放在竹竹老師前面的大實驗桌上，下面是火焰或冰塊；答完慢慢變大或變小
HEAT_Q.start = (n) => {
  const r = rooms.find((x) => x.name === '自然教室二'), f = r.f;
  HEAT_Q.at = new THREE.Vector3(r.m.x2 - 1.75, f.y + 0.87, r.cz + 0.3);
  HEAT_Q.anim = null;
  HEAT_Q.tick = (dt) => {
    const a = HEAT_Q.anim; if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / 1.2), s = heatItem.userData.size * (1 + (a.ok ? 0.45 : -0.4) * (1 - (1 - k) ** 3));
    heatItem.scale.set(s, s, 1); heatItem.position.y = HEAT_Q.at.y + 0.42 + (s - heatItem.userData.size) / 2;
    heatFire.position.y = HEAT_Q.at.y + 0.13 + Math.sin(a.t * 12) * 0.01;
  };
};
HEAT_Q.show = (q) => {
  const T = HEAT_Q.at, s = heatItem.userData.size; HEAT_Q.anim = null;
  heatItem.userData.set(q.e); heatItem.scale.set(s, s, 1); heatItem.position.set(T.x, T.y + 0.42, T.z); heatItem.visible = true;
  heatFire.userData.set(q.c === '🔥' ? '🔥' : '🧊'); heatFire.position.set(T.x, T.y + 0.13, T.z); heatFire.visible = true;
};
HEAT_Q.reveal = (q) => { HEAT_Q.anim = { t: 0, ok: q.ok }; };
HEAT_Q.end = () => { heatItem.visible = false; heatFire.visible = false; HEAT_Q.tick = null; };

function startFood(n, Q = GLIDER_Q) {
  stopAuto();
  const $ = (sel) => foodBox.querySelector(sel);
  const btns = [...foodBox.querySelectorAll('[data-a]')];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nOk = Math.random() < 0.5 ? 2 : 3;                               // 一回 5 題：能吃、不能吃各 2～3 題
  const qs = shuffle([...shuffle(Q.list.filter((q) => q.ok)).slice(0, nOk), ...shuffle(Q.list.filter((q) => !q.ok)).slice(0, 5 - nOk)]);
  let i = 0, score = 0, locked = false, done = false, best = 0;
  try { best = +localStorage.getItem(Q.key) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  $('.ttl').textContent = Q.title;
  btns.forEach((b) => (b.innerHTML = +b.dataset.a ? `${Q.yes[0]}<small>${Q.yes[1]} 1</small>` : `${Q.no[0]}<small>${Q.no[1]} 2</small>`));
  Q.start?.(n);
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const ready = () => {
    locked = false; btns.forEach((b) => (b.disabled = false));
    const q = qs[i];
    $('.round').textContent = `第 ${i + 1}／${qs.length} 題・答對 ${score}`;
    $('.emo').textContent = q.e; $('.nm').textContent = q.n;
    msg(Q.ask(q)); Q.show?.(q);
  };
  const finish = () => {
    done = true; foodBox.hidden = true; Q.end?.();
    updateVisibility();                                                 // 名牌放回來
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; duel = null;
  };
  const answer = (a) => {
    if (locked || done) return;
    locked = true; btns.forEach((b) => (b.disabled = true));
    const q = qs[i], right = a === q.ok;
    if (right) score++;
    $('.round').textContent = `第 ${i + 1}／${qs.length} 題・答對 ${score}`;
    msg(`${right ? '✅ 答對了！' : '❌ 答錯囉！'}${q.ok ? Q.yes[1] : Q.no[1]}：${q.why}`, right ? 'ok' : 'no');
    Q.reveal?.(q);
    npcFace(n, right ? 'happy' : 'surprised', 1.8);
    setTimeout(() => {
      if (done) return;
      if (++i < qs.length) { ready(); return; }
      if (score > best) { best = score; try { localStorage.setItem(Q.key, String(best)); } catch { /* 私密模式 */ } }
      npcFace(n, score >= 4 ? 'happy' : 'wink', 3);
      finish();
      toast(`${Q.icon} 答對 ${score}／${qs.length} 題！（最佳紀錄：${best} 題）<br>${n.name}：${Q.endTalk(score, qs.length)}`);
    }, 2600);
  };
  const onKey = (e) => {
    const k = { Digit1: 1, Digit2: 0, Numpad1: 1, Numpad2: 0 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); answer(k); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b) => (b.onclick = () => answer(+b.dataset.a)));
  $('.quit').onclick = () => duel?.quit();
  duel = { quit() { finish(); toast(Q.quitTalk(n)); } };
  act.busy = { label: '', tick(dt) { Q.tick?.(dt); } };                 // 玩的時候不能走動（視窗在下面，橘色提示鈕先收起來）
  foodBox.hidden = false;
  ready();
  msg(`${n.name}：${Q.intro}`);
}

/* ---------------- 樂樂棒球（投打對決）：操場遊戲場西邊草地，張校長投球、你來打 ----------------
   看準球飛到本壘的時機按 F（或「揮棒」）：越準打越遠（全壘打、二壘安打、一壘安打），太早太晚是界外或揮空；
   偏掉的壞球不要揮，四壞球保送；三好球出局，三出局結束，記錄最高得分。 */

const BB_KEY = 'campus-baseball-best';
function buildBaseballField() {
  const f = floors[1], b = new Batch(), white = mat('wool', '#f8f8f4'), dirt = mat('wool', '#b8865a');
  const gy = (x, z) => f.y + groundAt(f, x, z);
  const H = BB.home, d = BB.side / Math.SQRT2;
  const bases = [[H.x + d, H.z - d], [H.x, H.z - 2 * d], [H.x - d, H.z - d]];
  b.box(dirt, 2.6, 0.03, 2.6, H.x, gy(H.x, H.z) + 0.015, H.z);                                        // 本壘區的紅土
  b.box(white, 0.43, 0.04, 0.43, H.x, gy(H.x, H.z) + 0.035, H.z);                                       // 本壘板
  for (const [x, z] of bases) { b.box(dirt, 1.6, 0.03, 1.6, x, gy(x, z) + 0.015, z); b.box(white, 0.38, 0.08, 0.38, x, gy(x, z) + 0.05, z); }
  const M2 = BB.mound; b.box(dirt, 2.0, 0.06, 2.0, M2.x, gy(M2.x, M2.z) + 0.03, M2.z); b.box(white, 0.6, 0.07, 0.15, M2.x, gy(M2.x, M2.z) + 0.04, M2.z);
  // 白色邊線：本壘往一壘、三壘
  for (const [x, z] of [bases[0], bases[2]]) {
    const len = Math.hypot(x - H.x, z - H.z), m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, len), white);
    m.position.set((x + H.x) / 2, gy(H.x, H.z) + 0.035, (z + H.z) / 2); m.rotation.y = Math.atan2(x - H.x, z - H.z); f.group.add(m);
  }
  b.build(f.group);
  f.labels.add(makeLabel('樂樂棒球場', 'T-BALL', H.x, gy(H.x, H.z) + 2.6, H.z + 1.5, { bg: '#1f3a7a', h: 0.8 }));
}
const bbBox = document.getElementById('bb');
const bbBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshLambertMaterial({ color: '#fffdf2' }));
bbBall.visible = false; scene.add(bbBall);
const myBat = (() => {                                                 // 木頭球棒：接在右手，當成手臂的延伸
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: '#d9a35a' }), grip = new THREE.MeshLambertMaterial({ color: '#2b2b2b' });
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), grip); h.position.y = -0.1; g.add(h);
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.6, 10), wood); br.position.y = -0.55; g.add(br);
  g.position.set(0, -0.62, 0);
  return g;
})();
function startBaseball(n) {
  stopAuto();
  const f = n.f, $ = (sel) => bbBox.querySelector(sel), H = BB.home;
  const gy = (x, z) => f.y + groundAt(f, x, z);
  const T0 = n.g.position.clone(), yaw0 = n.yaw;
  let best = 0; try { best = +localStorage.getItem(BB_KEY) || 0; } catch { /* 私密模式 */ }
  // 學生站在本壘旁邊（打擊區），面向投手丘；鏡頭在後面
  const bx = H.x - 0.75, bz = H.z + 0.15;
  placeAt(f, bx, bz, 0); avatar.rotation.y = 0; player.yaw = 0.18; player.pitch = -0.06;
  n.playing = true; n.g.rotation.y = Math.PI;
  const L = limbs(), nL = n.g.userData.limbs;
  if (L) { L.armR.add(myBat); L.armR.rotation.order = 'YXZ'; }
  let strikes = 0, balls = 0, outs = 0, runs = 0, bases = [0, 0, 0], done = false;
  let t = 0, nextAt = 1.4, wind = -1, pitch = null, hit = null, swingT = 9, over = 0;
  const dots = (k, n2, col) => (k = Math.min(k, n2), '●'.repeat(k)).replace(/●/g, `<i style="color:${col}">●</i>`) + '○'.repeat(n2 - k);
  const show = () => {
    $('.runs').innerHTML = `得分 <b>${runs}</b>　最高 ${best}`;
    $('.s').innerHTML = dots(strikes, 2, '#f2b134'); $('.b').innerHTML = dots(balls, 3, '#3fbf5a'); $('.o').innerHTML = dots(outs, 2, '#e8573a');
    $('.bases').textContent = `壘包 ${['一', '二', '三'].map((x, i) => (bases[i] ? '◆' : '◇') + x).join(' ')}`;
  };
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const advance = (k) => {                                               // 跑者往前 k 個壘，打者上 k 壘（k=4 全壘打）
    const nb = [0, 0, 0];
    for (let i = 2; i >= 0; i--) if (bases[i]) { if (i + k >= 3) runs++; else nb[i + k] = 1; }
    if (k >= 4) runs++; else nb[k - 1] = 1;
    bases = nb;
  };
  const walk = () => {                                                   // 保送：被擠到的跑者才往前
    const nb = [...bases];
    if (nb[0]) { if (nb[1]) { if (nb[2]) runs++; nb[2] = 1; } nb[1] = 1; }
    nb[0] = 1; bases = nb;
  };
  const newBatter = () => { strikes = 0; balls = 0; };
  const out = (text) => {
    outs++; newBatter();
    msg(`${text}　出局！`, 'no'); npcFace(n, 'wink', 1.6);
    if (outs >= 3) {
      over = 1;
      if (runs > best) { best = runs; try { localStorage.setItem(BB_KEY, String(best)); } catch { /* 私密模式 */ } }
      setTimeout(() => {
        if (done) return;
        finish();
        toast(runs > 0 ? `⚾ 三出局！你拿下 <b>${runs}</b> 分（最高 ${best} 分）<br>${n.name}：打得真好！你好棒，下次再來挑戰！`
          : `⚾ 三出局！這次沒有得分<br>${n.name}：沒關係，看準球再揮，你一定可以的！`);
      }, 1800);
    }
  };
  const strike = (text) => { if (++strikes >= 3) out(`${text}　三振`); else { msg(`${text}　好球！`, 'no'); } };
  // 投球：從校長手上飛到本壘前方（好球在本壘上，壞球偏到外面）
  const throwBall = () => {
    const wide = Math.random() < 0.22, T = 0.95 + Math.random() * 0.45;
    const s0 = T0, a = [s0.x + 0.3, gy(s0.x, s0.z) + 1.55, s0.z + 0.4];
    const b2 = [H.x + (wide ? (Math.random() < 0.5 ? -1 : 1) * 1.1 : (Math.random() - 0.5) * 0.25), gy(H.x, H.z) + 0.75 + (wide ? 0.3 : 0), H.z - 0.1];
    pitch = { a, b: b2, T, t: 0, wide, swung: false }; bbBall.visible = true;
  };
  const ballAt = (P, k) => [P.a[0] + (P.b[0] - P.a[0]) * k, P.a[1] + (P.b[1] - P.a[1]) * k + 4 * (P.h || 0.25) * k * (1 - k), P.a[2] + (P.b[2] - P.a[2]) * k];
  // 打出去：依結果飛不同遠、不同高
  const fly = (kind) => {
    const p = bbBall.position, ang = kind === 'foul' ? (Math.random() < 0.5 ? -1 : 1) * (1.15 + Math.random() * 0.3) : (Math.random() - 0.5) * 0.7;
    const dist = { hr: 42, two: 22, one: 11, foul: 12 }[kind], h = { hr: 14, two: 6, one: 1.2, foul: 5 }[kind];
    const tx = p.x + Math.sin(ang) * dist, tz = p.z - Math.cos(ang) * dist;
    hit = { a: [p.x, p.y, p.z], b: [tx, gy(tx, tz) + 0.11, tz], T: { hr: 2.4, two: 1.7, one: 1.0, foul: 1.2 }[kind], t: 0, h };
  };
  const judge = (dtArr) => {                                              // dtArr：揮棒時間 − 球到本壘的時間
    const e = Math.abs(dtArr);
    if (pitch.wide) { strike('😅 壞球不要揮喔！揮棒落空'); return; }
    if (e < 0.06) { fly('hr'); advance(4); newBatter(); msg('💥 全壘打！！', 'ok'); npcFace(n, 'surprised', 2); toast(`⚾ 全壘打！${n.name}：哇！你好棒！`); return; }
    if (e < 0.12) { fly('two'); advance(2); newBatter(); msg('⚾ 二壘安打！', 'ok'); npcFace(n, 'happy', 1.8); return; }
    if (e < 0.2) { fly('one'); advance(1); newBatter(); msg('⚾ 一壘安打！', 'ok'); npcFace(n, 'happy', 1.6); return; }
    if (e < 0.28) { fly('foul'); if (strikes < 2) strikes++; msg(dtArr < 0 ? '界外球！（揮太早了）' : '界外球！（揮太晚了）'); return; }
    strike(dtArr < 0 ? '揮太早了，揮棒落空' : '揮太晚了，揮棒落空');
  };
  const finish = () => {
    done = true; bbBox.hidden = true; bbBall.visible = false;
    myBat.removeFromParent(); if (L) L.armR.rotation.order = 'XYZ';
    n.playing = false; n.g.position.copy(T0); n.g.rotation.y = yaw0;
    for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);
    resetPose(); act.busy = null; duel = null;
  };
  act.busy = {
    label: '',                                                              // 揮棒鈕在上面的視窗裡（F 也可以）
    tick(dt) {
      if (done) return;
      t += dt; swingT += dt;
      player.x = bx; player.z = bz; avatar.rotation.y = 0;
      // 學生：準備姿勢（球棒扛在右後方）→ 揮棒（往左前方掃過去）
      if (L) {
        const s = Math.min(1, swingT / 0.22);
        L.armR.rotation.set(1.45 - (swingT < 0.22 ? 0 : 0.2), swingT < 0.6 ? 1.3 - 2.9 * s : 1.3, 0);
        L.armL.rotation.set(0.9, 0.5, 0);
      }
      // 校長：準備投球（舉手）→ 出手
      if (!pitch && !hit && !over && t > nextAt && wind < 0) wind = 0;
      if (wind >= 0) {
        wind += dt;
        nL.armR.rotation.set(-2.4 + wind * 2.5, 0, 0);
        if (wind > 0.55) { wind = -1; throwBall(); nL.armR.rotation.set(1.2, 0, 0); }
      }
      if (pitch) {
        pitch.t += dt;
        const k = pitch.t / pitch.T, p = ballAt(pitch, k);
        bbBall.position.set(...p);
        if (k > 1.35) {                                                     // 沒有揮（或揮空）：球過去了
          if (!pitch.swung) {
            if (pitch.wide) { if (++balls >= 4) { walk(); newBatter(); msg('四壞球保送！走上一壘 🚶', 'ok'); } else msg('壞球！看得好 👀'); }
            else strike('🙈 沒揮棒');
          }
          pitch = null; bbBall.visible = false; nextAt = t + 1.5; nL.armR.rotation.set(0, 0, 0); show();
        }
      }
      if (hit) {
        hit.t += dt;
        const k = Math.min(1, hit.t / hit.T);
        bbBall.position.set(...ballAt({ a: hit.a, b: hit.b, h: hit.h }, k));
        if (hit.t > hit.T + 0.6) { hit = null; bbBall.visible = false; nextAt = t + 1.0; show(); }
      }
    },
    press() {
      if (done || over || swingT < 0.5) return;
      swingT = 0;
      if (!pitch || pitch.swung) return;
      const dtArr = pitch.t - pitch.T;
      if (dtArr < -0.35) return;                                              // 球還很遠：只是空揮一下
      pitch.swung = true;
      judge(dtArr);
      if (hit) { pitch = null; nL.armR.rotation.set(0, 0, 0); }
      show();
    },
  };
  $('.swing').onclick = () => act.busy?.press?.();
  $('.quit').onclick = () => duel?.quit();
  duel = { quit() { finish(); toast(`⚾ 下次再來找${n.name}打樂樂棒球！`); } };
  bbBox.hidden = false;
  msg(`${n.name}：小朋友好！看準球飛到本壘再揮棒，壞球不要揮喔！`);
  show();
}

/* ---------------- 著色小遊戲：在美勞教室遇到哈囉老師，幫動物線稿塗顏色 ----------------
   動物線稿用程式畫在 400×400 的畫布上；先把「被黑線圍起來的區塊」編號，點一下就把整塊塗成選的顏色（可以一直換色重塗） */

const paintBox = document.getElementById('paint'), paintCv = paintBox.querySelector('canvas');
const PAINT_KEY = 'campus-paint-count';
const PAINT_COLORS = ['#e53935', '#fb8c00', '#fdd835', '#9ccc65', '#43a047', '#4fc3f7', '#1e88e5', '#8e24aa', '#f48fb1', '#8d6e63', '#ffe0b2', '#9e9e9e', '#424242', '#ffffff'];
// 動物線稿（黑線）：用 SVG 路徑畫，後畫的部位先塗白再描邊，前後交疊才會遮住（不會有線穿過去）
const ANIMALS = (() => {
  const kit = (c) => {
    const k = {
      S: (d, w = 4.5) => { c.lineWidth = w; c.stroke(typeof d === 'string' ? new Path2D(d) : d); },
      F: (d, w = 4.5) => { const p = typeof d === 'string' ? new Path2D(d) : d; c.fillStyle = '#fff'; c.fill(p); c.lineWidth = w; c.stroke(p); },
      E: (x, y, rx, ry, rot = 0, w = 4.5) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); k.F(p, w); },
      dot: (x, y, rx, ry = rx) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = '#222'; c.fill(); },
      shine: (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); },
      clip: (d, fn) => { c.save(); c.clip(new Path2D(d)); fn(); c.restore(); },   // 只畫在某個形狀裡面（條紋不會超出身體）
      eye: (x, y, r) => { k.dot(x, y, r, r * 1.15); k.shine(x - r * 0.35, y - r * 0.4, r * 0.35); },
      sun: (x, y, r) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; k.S(`M${x + Math.cos(a) * (r + 8)} ${y + Math.sin(a) * (r + 8)} L${x + Math.cos(a) * (r + 22)} ${y + Math.sin(a) * (r + 22)}`, 3.5); } k.E(x, y, r, r); },
      cloud: (x, y) => k.F(`M${x - 46} ${y + 14} C${x - 62} ${y - 6} ${x - 34} ${y - 22} ${x - 20} ${y - 10} C${x - 14} ${y - 36} ${x + 22} ${y - 36} ${x + 26} ${y - 12} C${x + 46} ${y - 22} ${x + 64} ${y} ${x + 48} ${y + 14} Z`, 3.5),
      grass: (x, y) => k.S(`M${x} ${y} l5 -16 l5 16 l5 -12 l5 12 l5 -18 l5 18`, 3),
      flower: (x, y, s = 1, ground = y + 60 * s) => {
        k.S(`M${x} ${y} C${x - 4} ${y + 25 * s} ${x + 4} ${ground - 20 * s} ${x} ${ground}`, 3.5);
        k.F(`M${x} ${y + 34 * s} C${x + 22 * s} ${y + 18 * s} ${x + 34 * s} ${y + 30 * s} ${x + 30 * s} ${y + 34 * s} C${x + 20 * s} ${y + 44 * s} ${x + 8 * s} ${y + 42 * s} ${x} ${y + 34 * s} Z`, 3);
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; k.E(x + Math.cos(a) * 12 * s, y + Math.sin(a) * 12 * s, 10 * s, 7 * s, a, 3.5); }
        k.E(x, y, 8 * s, 8 * s, 0, 3.5);
      },
    };
    return k;
  };
  return [
    ['貓咪', (c) => {
      const k = kit(c);
      k.S('M20 352 L380 352');
      k.E(78, 318, 30, 30); k.S('M56 300 C70 320 92 330 104 322 M52 322 C70 338 92 342 106 336 M66 292 C82 306 100 304 108 300', 3); k.S('M100 340 C130 360 150 330 170 346', 3);   // 毛線球
      k.F('M262 322 C330 334 344 262 312 238 C302 230 292 238 298 248 C320 270 306 312 260 306 Z');   // 尾巴
      k.F('M136 344 C114 286 136 214 200 208 C264 214 286 286 264 344 Z');                            // 身體
      k.E(200, 292, 34, 42);                                                                            // 肚子
      k.S('M176 250 C172 290 172 318 176 336 M224 250 C228 290 228 318 224 336', 4);                  // 前腳
      k.E(170, 340, 22, 11); k.E(230, 340, 22, 11);
      k.S('M160 338 L160 346 M170 338 L170 347 M220 338 L220 347 M230 338 L230 346', 2.5);
      k.F('M132 132 L126 64 L182 104 Z'); k.F('M268 132 L274 64 L218 104 Z');                          // 耳朵
      k.F('M140 120 L137 84 L168 106 Z', 3); k.F('M260 120 L263 84 L232 106 Z', 3);
      k.E(200, 160, 82, 68);                                                                            // 頭
      k.S('M184 100 L186 116 M200 96 L200 114 M216 100 L214 116', 3.5);                                // 額頭花紋
      k.E(168, 156, 15, 18); k.E(232, 156, 15, 18); k.eye(168, 158, 7); k.eye(232, 158, 7);
      k.F('M191 182 L209 182 L200 192 Z', 3.5);
      k.S('M200 192 C196 202 186 204 180 198 M200 192 C204 202 214 204 220 198', 3.5);
      k.E(146, 186, 13, 8, 0, 3); k.E(254, 186, 13, 8, 0, 3);
      k.S('M150 176 L98 166 M150 186 L96 188 M150 196 L100 208 M250 176 L302 166 M250 186 L304 188 M250 196 L300 208', 2.5);
      k.F('M146 222 C180 240 220 240 254 222 L256 234 C220 252 180 252 144 234 Z', 3.5);                // 項圈
      k.E(200, 252, 11, 11, 0, 3.5); k.S('M192 252 L208 252', 2.5);
    }],
    ['小狗', (c) => {
      const k = kit(c);
      k.S('M20 352 L380 352');
      k.F('M60 330 C48 320 54 306 66 312 L120 312 C132 306 138 320 126 330 C138 340 132 354 120 348 L66 348 C54 354 48 340 60 330 Z', 3.5);   // 骨頭
      k.F('M250 300 C300 296 316 252 300 232 C292 224 282 232 288 240 C298 258 286 284 246 286 Z');   // 尾巴
      k.F('M140 344 C124 284 148 218 200 214 C252 218 276 284 260 344 Z');                            // 身體
      k.E(228, 276, 18, 14, 0, 3.5); k.E(160, 300, 12, 10, 0, 3.5);                                   // 斑點
      k.S('M178 256 C174 290 174 320 178 338 M222 256 C226 290 226 320 222 338', 4);
      k.E(172, 342, 22, 11); k.E(228, 342, 22, 11);
      k.F('M150 222 C182 238 218 238 250 222 L252 234 C218 250 182 250 148 234 Z', 3.5);              // 項圈＋名牌
      k.F('M200 244 l12 10 l-12 14 l-12 -14 Z', 3.5);
      k.F('M142 118 C98 108 82 196 112 222 C132 236 152 200 150 160 Z');                              // 垂耳
      k.F('M258 118 C302 108 318 196 288 222 C268 236 248 200 250 160 Z');
      k.E(200, 150, 72, 64);                                                                            // 頭
      k.E(234, 134, 22, 18, 0.3, 3.5);                                                                  // 眼睛上的斑
      k.E(200, 182, 38, 28);                                                                            // 嘴巴
      k.E(172, 142, 10, 11); k.E(232, 136, 10, 11); k.eye(172, 143, 6); k.eye(232, 137, 6);
      k.dot(200, 170, 13, 9); k.shine(195, 167, 3);
      k.S('M200 179 L200 192 M200 192 C192 200 182 198 180 190 M200 192 C208 200 218 198 220 190', 3.5);
      k.F('M193 198 C193 214 207 214 207 198 Z', 3);                                                    // 舌頭
    }],
    ['兔子', (c) => {
      const k = kit(c);
      k.S('M20 352 L380 352');
      for (const x of [40, 90, 300, 345]) k.grass(x, 352);
      k.flower(340, 270, 0.9, 352);
      k.E(268, 312, 20, 18);                                                                            // 尾巴
      k.F('M142 344 C126 278 152 204 200 200 C248 204 274 278 258 344 Z');                            // 身體
      k.E(200, 284, 32, 44);
      k.E(166, 340, 32, 13); k.E(234, 340, 32, 13);
      k.F('M180 120 C150 46 162 18 182 26 C200 38 198 86 194 118 Z'); k.F('M220 120 C250 46 238 18 218 26 C200 38 202 86 206 118 Z');   // 耳朵
      k.S('M182 108 C170 66 172 44 180 40 M218 108 C230 66 228 44 220 40', 3);
      k.E(200, 152, 60, 52);
      k.E(176, 146, 9, 11); k.E(224, 146, 9, 11); k.eye(176, 147, 6); k.eye(224, 147, 6);
      k.F('M193 166 L207 166 L200 174 Z', 3);
      k.S('M200 174 L200 182 M200 182 C195 188 188 188 186 184 M200 182 C205 188 212 188 214 184', 3);
      k.E(160, 172, 11, 7, 0, 3); k.E(240, 172, 11, 7, 0, 3);
      k.S('M168 170 L130 164 M168 178 L132 182 M232 170 L270 164 M232 178 L268 182', 2.5);
      // 抱著紅蘿蔔
      k.F('M184 236 L214 236 C216 270 206 300 199 312 C192 300 182 270 184 236 Z');
      k.S('M188 252 L198 252 M206 268 L196 268 M190 284 L200 284', 2.5);
      k.F('M199 236 C188 214 176 214 178 224 C182 232 192 234 199 236 Z', 3); k.F('M199 236 C210 214 222 214 220 224 C216 232 206 234 199 236 Z', 3);
      k.E(176, 244, 14, 10); k.E(224, 244, 14, 10);                                                     // 小手
    }],
    ['小魚', (c) => {
      const k = kit(c);
      k.S('M0 366 C50 354 100 372 150 362 C200 352 250 372 300 362 C340 354 370 366 400 360');           // 沙地
      k.S('M40 400 C28 360 58 340 44 300 C32 268 54 252 46 222', 4); k.S('M62 400 C74 366 50 346 66 314 C78 290 60 270 70 250', 4);   // 海草
      k.F('M330 372 l8 -18 l8 18 l18 2 l-14 12 l6 18 l-18 -10 l-18 10 l6 -18 l-14 -12 Z', 3.5);          // 海星
      for (const [x, y, r] of [[96, 96, 10], [74, 64, 7], [92, 38, 5], [330, 70, 9], [350, 42, 6]]) k.E(x, y, r, r, 0, 3);
      k.F('M290 196 L362 136 C346 176 346 216 362 256 Z');                                            // 尾巴
      k.S('M300 190 L346 160 M300 200 L344 200 M300 210 L346 240', 2.5);
      k.F('M150 136 C176 84 232 90 252 150 Z');                                                         // 背鰭
      k.F('M164 264 C180 300 214 300 224 262 Z');
      const body = 'M84 200 C112 118 244 108 296 198 C244 290 112 282 84 200 Z';
      k.F(body);                                                                                        // 身體
      k.clip(body, () => k.S('M150 110 C168 176 168 226 150 290 M214 100 C232 176 232 226 214 300', 4));   // 條紋
      k.S('M128 162 C140 190 140 214 128 240', 3.5);                                                    // 鰓
      k.F('M176 214 C196 200 214 214 204 238 C196 246 182 236 176 214 Z', 3.5);                        // 胸鰭
      k.E(116, 188, 15, 15); k.eye(117, 189, 8);
      k.S('M86 206 C92 212 100 212 104 206', 3.5);
      for (const [x, y] of [[250, 172], [264, 196], [250, 220], [276, 182], [276, 210]]) k.S(`M${x} ${y} C${x + 8} ${y + 4} ${x + 8} ${y + 12} ${x} ${y + 14}`, 2.5);   // 鱗片
    }],
    ['小鳥', (c) => {
      const k = kit(c);
      k.sun(64, 64, 26); k.cloud(300, 64);
      k.F('M16 302 C120 294 260 306 392 296 L392 316 C260 326 120 316 16 322 Z');                     // 樹枝
      k.S('M120 312 C112 330 104 340 92 346', 4);
      for (const [x, y, s] of [[70, 302, 1], [330, 298, -1], [100, 346, 1]]) k.F(`M${x} ${y} C${x + s * -6} ${y - 30} ${x + s * 24} ${y - 40} ${x + s * 30} ${y - 26} C${x + s * 30} ${y - 10} ${x + s * 14} ${y} ${x} ${y} Z`, 3.5);   // 葉子
      k.S('M204 286 L200 306 M196 306 L204 306 M228 286 L230 306 M226 306 L236 306', 3.5);              // 腳
      k.F('M128 244 L58 214 L72 242 L54 258 L128 266 Z');                                               // 尾巴
      k.S('M120 250 L74 236 M120 258 L72 254', 2.5);
      k.F('M122 234 C120 168 196 146 246 166 C296 186 300 254 254 282 C206 304 126 296 122 234 Z');  // 身體
      k.S('M160 280 C200 292 240 280 262 252', 3.5);                                                    // 肚子
      k.F('M154 214 C184 182 234 196 244 234 C214 254 172 250 154 214 Z');                             // 翅膀
      k.S('M178 222 C196 210 214 214 226 230 M170 232 C188 228 206 232 216 242', 2.5);
      k.E(258, 150, 44, 42);                                                                            // 頭
      k.F('M296 140 L336 152 L296 166 Z', 3.5); k.S('M298 153 L320 153', 2.5);
      k.E(270, 140, 8, 9); k.eye(271, 141, 5); k.E(272, 168, 10, 7, 0, 3);
      k.S('M242 112 C238 96 250 88 256 100 M256 108 C258 92 272 92 270 106', 3);                       // 頭上的毛
    }],
    ['烏龜', (c) => {
      const k = kit(c);
      k.sun(340, 60, 24); k.cloud(90, 64);
      k.S('M20 330 L380 330');
      k.grass(352, 330); k.grass(150, 330);
      k.flower(26, 276, 0.7, 330);
      k.F('M70 260 L46 280 L76 280 Z', 3.5);                                                           // 尾巴
      k.E(112, 300, 30, 20); k.E(288, 300, 30, 20);                                                     // 腳
      k.S('M96 310 L96 318 M112 312 L112 320 M128 310 L128 318 M272 310 L272 318 M288 312 L288 320 M304 310 L304 318', 2.5);
      k.F('M330 252 C350 222 396 226 394 258 C392 286 352 290 334 276 Z');                            // 頭
      k.E(366, 246, 8, 9); k.eye(367, 247, 5); k.S('M372 268 C380 272 388 268 390 262', 3);
      const shell = 'M74 266 C78 148 322 148 326 266 Z';
      k.F(shell);                                                                                       // 殼
      k.F('M62 266 L338 266 L332 286 L68 286 Z', 4);
      for (const x of [100, 140, 180, 220, 260, 300]) k.S(`M${x} 266 L${x} 286`, 2.5);
      k.clip(shell, () => k.S('M170 196 L120 172 M230 196 L280 172 M170 230 L100 262 M230 230 L300 262 M200 176 L200 120 M200 248 L200 270', 4));   // 殼上的分格（只在殼裡面）
      k.F('M170 196 L200 176 L230 196 L230 230 L200 248 L170 230 Z', 4);                               // 中間六角形
      k.F('M134 210 L150 204 L156 222 L142 230 L128 222 Z', 3); k.F('M266 210 L250 204 L244 222 L258 230 L272 222 Z', 3);
    }],
    ['蝴蝶', (c) => {
      const k = kit(c);
      k.S('M20 372 L380 372');
      k.flower(70, 300, 1, 372); k.flower(332, 290, 1.1, 372); k.grass(150, 372); k.grass(230, 372);
      for (const s of [-1, 1]) {
        const m = (x) => 200 + s * x;
        k.F(`M${m(4)} 168 C${m(50)} 58 ${m(170)} 56 ${m(162)} 140 C${m(156)} 204 ${m(60)} 218 ${m(4)} 204 Z`);   // 上翅
        k.F(`M${m(4)} 212 C${m(56)} 214 ${m(118)} 246 ${m(98)} 304 C${m(78)} 346 ${m(12)} 318 ${m(4)} 246 Z`);   // 下翅
        k.E(m(104), 132, 30, 24, s * 0.4); k.E(m(104), 132, 13, 10, s * 0.4, 3.5);
        k.E(m(56), 184, 14, 12, 0, 3.5); k.E(m(66), 270, 22, 16, s * -0.5); k.E(m(52), 298, 8, 8, 0, 3);
        for (const [x, y] of [[150, 96], [158, 120], [146, 160]]) k.E(m(x), y, 6, 6, 0, 3);
      }
      k.S('M196 112 C186 80 168 64 156 60 M204 112 C214 80 232 64 244 60', 3.5); k.E(154, 58, 7, 7, 0, 3.5); k.E(246, 58, 7, 7, 0, 3.5);
      k.E(200, 214, 13, 86); k.E(200, 118, 17, 16);
      for (const y of [168, 194, 220, 246, 272]) k.S(`M190 ${y} L210 ${y}`, 2.5);
      k.dot(194, 116, 3); k.dot(206, 116, 3);
    }],
    ['倉鼠羞羞', (c) => {
      const k = kit(c);
      for (const [x, y, r] of [[60, 330, 0.5], [340, 320, -0.4], [330, 360, 0.2]]) k.F(`M${x} ${y - 14} C${x + 10} ${y - 6} ${x + 9} ${y + 8} ${x} ${y + 14} C${x - 9} ${y + 8} ${x - 10} ${y - 6} ${x} ${y - 14} Z`, 3);   // 地上的葵花子
      k.F('M70 90 C70 76 88 72 92 86 C96 72 114 76 114 90 C114 104 92 116 92 116 C92 116 70 104 70 90 Z', 3.5);   // 愛心
      k.E(132, 132, 26, 26); k.E(268, 132, 26, 26); k.E(132, 132, 13, 13, 0, 3); k.E(268, 132, 13, 13, 0, 3);   // 耳朵
      k.F('M200 116 C292 116 322 198 316 262 C310 330 262 356 200 356 C138 356 90 330 84 262 C78 198 108 116 200 116 Z');   // 身體
      k.S('M200 120 L200 150 M188 124 L190 146 M212 124 L210 146', 3);                                 // 頭頂的毛
      k.F('M136 262 C136 214 264 214 264 262 C264 326 136 326 136 262 Z', 4);                          // 白肚子
      k.E(164, 196, 12, 14); k.E(236, 196, 12, 14); k.eye(164, 197, 8); k.eye(236, 197, 8);
      k.F('M193 214 L207 214 L200 222 Z', 3);
      k.S('M200 222 C196 230 188 230 186 225 M200 222 C204 230 212 230 214 225', 3);
      k.E(136, 226, 17, 11, 0, 3); k.E(264, 226, 17, 11, 0, 3);
      k.S('M150 212 L112 204 M150 220 L114 224 M250 212 L288 204 M250 220 L286 224', 2.5);
      k.F('M200 242 C216 256 213 284 200 296 C187 284 184 256 200 242 Z', 3.5); k.S('M200 250 L200 288', 2.5);   // 抱著葵花子
      k.E(176, 266, 13, 10, 0, 3.5); k.E(224, 266, 13, 10, 0, 3.5);
      k.E(156, 350, 28, 13); k.E(244, 350, 28, 13);
    }],
    ['游泳館的橘貓', (c) => {
      const k = kit(c);
      k.F('M0 0 L400 0 L400 196 L0 196 Z', 3.5);                                                       // 游泳館藍色泡泡牆
      for (const [x, y, r] of [[34, 40, 22], [92, 110, 18], [40, 156, 14], [320, 44, 20], [372, 112, 16], [300, 150, 12], [150, 28, 12], [260, 22, 10]]) k.E(x, y, r, r, 0, 3.5);
      k.F('M0 196 L400 196 L400 400 L0 400 Z', 4.5);                                                   // 階梯（三階）
      k.S('M0 300 L400 300 M0 366 L400 366', 4.5); k.S('M0 312 L400 312 M0 378 L400 378', 2.5);
      k.S('M350 120 L350 300 M380 120 L380 300', 4.5); k.F('M340 112 L390 112 L390 126 L340 126 Z', 3.5);   // 不鏽鋼扶手
      const body = 'M96 294 C84 214 128 176 200 174 C272 176 316 214 304 294 Z';
      k.F(body);                                                                                        // 香箱坐的身體
      k.clip(body, () => k.S('M112 218 C130 230 132 256 118 280 M288 218 C270 230 268 256 282 280 M134 192 C152 206 156 228 146 246 M266 192 C248 206 244 228 254 246', 4));   // 身上的虎斑
      const tail = 'M100 286 C150 306 250 306 300 286 C312 294 312 306 300 312 C250 330 150 330 100 312 C88 304 88 294 100 286 Z';
      k.F(tail);                                                                                        // 尾巴繞在前面
      k.clip(tail, () => k.S('M250 290 L246 330 M272 288 L268 326 M228 292 L224 330', 3.5));
      for (const x of [170, 230]) { k.E(x, 296, 24, 13); k.S(`M${x - 8} 290 L${x - 8} 300 M${x + 8} 290 L${x + 8} 300`, 2.5); }   // 前腳
      k.F('M132 132 L124 62 L180 102 Z'); k.F('M268 132 L276 62 L220 102 Z');                          // 耳朵
      k.F('M140 120 L136 84 L166 104 Z', 3); k.F('M260 120 L264 84 L234 104 Z', 3);
      k.E(200, 150, 84, 66);                                                                            // 頭
      k.S('M180 92 L184 112 M200 88 L200 110 M220 92 L216 112', 4);                                    // 額頭花紋
      k.S('M154 148 C162 138 174 138 182 148 M218 148 C226 138 238 138 246 148', 4.5);                 // 瞇瞇眼（曬太陽好舒服）
      k.F('M191 168 L209 168 L200 178 Z', 3.5); k.S('M200 178 C195 188 186 188 182 182 M200 178 C205 188 214 188 218 182', 3.5);
      k.E(146, 172, 14, 9, 0, 3); k.E(254, 172, 14, 9, 0, 3);
      k.S('M150 164 L94 154 M150 176 L92 180 M250 164 L306 154 M250 176 L308 180', 2.5);
    }],
    ['蜜袋鼯米果', (c) => {
      const k = kit(c);
      for (const [x, y] of [[60, 70], [340, 60], [330, 150], [70, 170]]) k.F(`M${x} ${y - 14} L${x + 4} ${y - 4} L${x + 14} ${y} L${x + 4} ${y + 4} L${x} ${y + 14} L${x - 4} ${y + 4} L${x - 14} ${y} L${x - 4} ${y - 4} Z`, 3);   // 小星星
      k.F('M300 300 C352 310 362 360 326 386 C314 394 300 386 308 374 C332 350 322 320 292 318 Z');   // 蓬蓬的尾巴（垂在袋子外面）
      k.S('M316 330 C326 338 330 350 326 362', 2.5);
      k.E(150, 112, 30, 36, -0.3); k.E(250, 112, 30, 36, 0.3); k.E(150, 116, 16, 22, -0.3, 3); k.E(250, 116, 16, 22, 0.3, 3);   // 大耳朵
      k.F('M128 250 C120 196 150 150 200 150 C250 150 280 196 272 250 Z');                            // 身體
      k.E(200, 160, 66, 56);                                                                            // 頭
      k.E(170, 156, 20, 22); k.E(230, 156, 20, 22); k.dot(170, 158, 15, 17); k.dot(230, 158, 15, 17);
      k.shine(164, 150, 6); k.shine(224, 150, 6); k.shine(175, 166, 2.5); k.shine(235, 166, 2.5);
      k.F('M192 186 L208 186 L200 194 Z', 3); k.S('M200 194 C196 200 190 200 188 196 M200 194 C204 200 210 200 212 196', 3);
      k.E(160, 192, 12, 8, 0, 3); k.E(240, 192, 12, 8, 0, 3);
      k.S('M170 184 L136 178 M170 192 L138 196 M230 184 L264 178 M230 192 L262 196', 2.5);
      k.E(200, 236, 24, 24, 0, 4); for (const [x, y] of [[192, 228], [208, 232], [198, 244], [210, 246]]) k.dot(x, y, 2.5);   // 抱著的點心餅乾
      k.E(176, 236, 12, 10, 0, 3.5); k.E(224, 236, 12, 10, 0, 3.5);                                   // 小手
      k.F('M96 254 C96 380 304 380 304 254 Z');                                                         // 藍色保暖袋
      k.E(200, 254, 106, 18, 0, 4.5);
      k.clip('M96 254 C96 380 304 380 304 254 Z', () => { for (let x = 120; x <= 290; x += 24) k.S(`M${x} 270 C${x - 4} 310 ${x - 4} 340 ${x} 380`, 2.5); });   // 刷毛布紋
      k.F('M184 300 C184 288 196 288 200 298 C204 288 216 288 216 300 C216 312 200 322 200 322 C200 322 184 312 184 300 Z', 3);   // 袋子上的愛心
    }],
  ];
})();
const PAINT_PRAISE = ['🌈 哇！這配色好有創意，老師好喜歡！', '👏 塗得好仔細，連小地方都沒漏掉！', '🎨 你是小小藝術家！這張可以貼在教室後面的作品牆喔！',
  '✨ 顏色搭得好漂亮，看起來好開心！', '💖 老師要把這張拍照收藏起來～'];
function startPaint(n) {
  stopAuto();
  const W = 400, cx = paintCv.getContext('2d', { willReadFrequently: true });
  const $ = (sel) => paintBox.querySelector(sel);
  const msg = (t, cls = '') => { const m = $('.msg'); m.innerHTML = t; m.style.color = cls === 'no' ? '#c0392b' : cls === 'ok' ? '#1b8a3a' : ''; };
  let k = Math.random() * ANIMALS.length | 0, color = PAINT_COLORS[0], label, line, base, colors, fills = 0, first = true;
  // 畫線稿 → 找出黑線、把其他地方依「被線圍起來」分區編號
  const load = () => {
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, W);
    cx.lineWidth = 6; cx.lineJoin = cx.lineCap = 'round'; cx.strokeStyle = '#222';
    ANIMALS[k][1](cx);
    base = cx.getImageData(0, 0, W, W);
    const d = base.data, N = W * W;
    line = new Uint8Array(N); label = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) line[i] = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 420 ? 1 : 0;
    let L = 0; const st = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (line[i] || label[i] >= 0) continue;
      let sp = 0; st[sp++] = i; label[i] = L;
      while (sp) {
        const j = st[--sp], x = j % W, y = (j / W) | 0;
        for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < W - 1 ? j + W : -1]) if (q >= 0 && !line[q] && label[q] < 0) { label[q] = L; st[sp++] = q; }
      }
      L++;
    }
    colors = new Array(L).fill(null);
    $('.name').textContent = `今天畫：${ANIMALS[k][0]}`;
    msg(first ? `${n.name}：哈囉！幫這隻${ANIMALS[k][0]}穿上漂亮的顏色吧～<br>點一個顏色，再點圖裡的空白處就能塗上去！` : '點一個顏色，再點圖裡的空白處就能塗上去！');
    first = false;
    draw();
  };
  const draw = () => {
    const out = cx.createImageData(W, W), o = out.data, d = base.data;
    for (let i = 0; i < W * W; i++) {
      const c = !line[i] && colors[label[i]];
      if (c) { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; }
      else { o[i * 4] = d[i * 4]; o[i * 4 + 1] = d[i * 4 + 1]; o[i * 4 + 2] = d[i * 4 + 2]; }
      o[i * 4 + 3] = 255;
    }
    cx.putImageData(out, 0, 0);
  };
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const fillAt = (e) => {
    const r = paintCv.getBoundingClientRect();
    let x = Math.round((e.clientX - r.left) / r.width * W), y = Math.round((e.clientY - r.top) / r.height * W);
    // 點到黑線上：找最近的空白處
    let idx = -1;
    for (let rr = 0; rr <= 6 && idx < 0; rr++) for (let dy = -rr; dy <= rr && idx < 0; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
      const j = yy * W + xx; if (!line[j]) { idx = j; break; }
    }
    if (idx < 0) return;
    colors[label[idx]] = color === '#ffffff' ? null : rgb(color);
    draw();
    if (++fills % 5 === 0) npcFace(n, 'happy', 1.2);
  };
  // 調色盤
  $('.pal').innerHTML = PAINT_COLORS.map((c) => `<button data-c="${c}" style="background:${c}" title="${c === '#ffffff' ? '橡皮擦（白色）' : c}"></button>`).join('');
  const pick = (c) => { color = c; paintBox.querySelectorAll('.pal button').forEach((b) => b.classList.toggle('on', b.dataset.c === c)); };
  $('.pal').onclick = (e) => { const b = e.target.closest('button'); if (b) pick(b.dataset.c); };
  pick(color);
  paintCv.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); fillAt(e); };
  const colored = () => colors.filter(Boolean).length;
  $('.next').onclick = () => { k = (k + 1) % ANIMALS.length; load(); };
  $('.clear').onclick = () => { colors.fill(null); draw(); msg('重新開始！'); };
  $('.save').onclick = () => { const a = document.createElement('a'); a.download = `${ANIMALS[k][0]}著色.png`; a.href = paintCv.toDataURL('image/png'); a.click(); msg('📥 圖片存好了！', 'ok'); };
  $('.done').onclick = () => {
    if (colored() < 3) { msg('還有好多地方是白白的，再多塗幾個顏色吧！', 'no'); npcFace(n, 'surprised', 1.2); return; }
    let cnt = 1; try { cnt = (+localStorage.getItem(PAINT_KEY) || 0) + 1; localStorage.setItem(PAINT_KEY, String(cnt)); } catch { /* 私密模式 */ }
    const name = ANIMALS[k][0];
    finish();
    npcFace(n, 'happy', 3);
    toast(`${PAINT_PRAISE[Math.random() * PAINT_PRAISE.length | 0]}<br>🖼️ ${name}完成！這是你在美勞教室畫的第 ${cnt} 張作品`);
  };
  $('.quit').onclick = () => duel?.quit();
  // 著色時鍵盤只留 Esc（不要按到 E／Q 換樓層、C 換角色）
  const keyGuard = (e) => { e.stopPropagation(); if (e.code === 'Escape') duel?.quit(); };
  addEventListener('keydown', keyGuard, true);
  const finish = () => {
    paintBox.hidden = true; removeEventListener('keydown', keyGuard, true);
    n.playing = false; act.busy = null; duel = null;
  };
  n.playing = true;
  n.g.rotation.y = Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z);   // 老師面向你
  duel = { quit() { finish(); toast(`🎨 ${n.name}：下次再來畫畫喔！`); } };
  act.busy = { label: '🎨 著色中…', tick() {} };
  paintBox.hidden = false;
  load();
}

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

function startShot(sp, ctx = {}) {
  stopAuto();
  const dx = sp.x - player.x, dz = sp.z - player.z, dist = Math.hypot(dx, dz);
  const face = Math.atan2(-dx, -dz);
  avatar.rotation.y = face; player.yaw = face; player.pitch = 0.05;   // 面向籃框，鏡頭在背後
  // 越遠越難：要的力道越大、綠色區域越窄
  const ideal = Math.max(0.3, Math.min(0.82, 0.38 + dist * 0.055)), tol = Math.max(0.05, 0.12 - dist * 0.008);
  powerBox.querySelector('.sweet').style.cssText = `left:${(ideal - tol) * 100}%;width:${tol * 200}%`;
  const bar = powerBox.querySelector('.bar');
  bar.style.left = '0%';                                              // 從 0 開始（不要停在上一球的位置）
  powerBox.hidden = false;
  let t = 0, p = 0;
  act.busy = {
    tick(dt) {
      t += dt; p = (1 - Math.cos(t * 3.4)) / 2; bar.style.left = `${p * 100}%`;
      const L = limbs(); if (L) { L.armL.rotation.x = L.armR.rotation.x = -2.5 - p * 0.4; }   // 舉手準備
    },
    label: ctx.label,
    press() { powerBox.hidden = true; shoot(sp, p, ideal, tol, ctx); },
  };
}
// ctx：from（老師投的位置與出手高度）、made（老師投進沒，事先決定）、limbs（誰的手）、quiet（不要一般的進球提示）、onDone（球落地後）
function shoot(sp, p, ideal, tol, ctx = {}) {
  const auto = ctx.made !== undefined;
  const made = auto ? ctx.made : Math.abs(p - ideal) <= tol, err = auto ? (made ? 0 : (Math.random() < 0.5 ? -0.2 : 0.2)) : p - ideal;
  const f = player.floor, sx = ctx.from?.x ?? player.x, sz = ctx.from?.z ?? player.z, sy = ctx.from ? ctx.from.y : f.y + (player.gy || 0) + 2.0 * AVATAR_SCALE;
  const dx = sp.x - sx, dz = sp.z - sz, dist = Math.hypot(dx, dz), ux = dx / dist, uz = dz / dist;
  // 沒進：太小力就短、太大力就長（打板），再加一點左右偏
  const side = made ? 0 : (Math.random() - 0.5) * 0.5, over = made ? 0 : Math.max(-1.5, Math.min(0.55, err * 3));
  const tx = sp.x + ux * over - uz * side, tz = sp.z + uz * over + ux * side, ty = sp.y + (made ? 0.12 : 0.05);
  const T = 0.75 + dist * 0.05, G = 9.8, vy = (ty - sy + 0.5 * G * T * T) / T;
  ball.position.set(sx, sy, sz); ball.visible = true;
  if (!ctx.quiet) act.shots++;
  const L = ctx.limbs || limbs(); if (L) { L.armL.rotation.x = L.armR.rotation.x = -3.0; }
  const relax = () => { if (ctx.limbs) for (const k of ['armL', 'armR']) ctx.limbs[k].rotation.set(0, 0, 0); else resetPose(); };
  let t = 0, phys = null, life = 0;
  act.busy = {
    label: ctx.label,
    tick(dt) {
      t += dt;
      if (!phys) {
        const k = Math.min(1, t / T);
        ball.position.set(sx + (tx - sx) * k, sy + vy * t - 0.5 * G * t * t, sz + (tz - sz) * k);
        ball.rotation.x -= dt * 8;
        if (t > 0.35) relax();
        if (t < T) return;
        // 到籃框了：進球就從網子掉下去；沒進就彈開
        if (made) { phys = { vx: 0, vy: -1.5, vz: 0 }; if (!ctx.quiet) { act.makes++; toast(`🏀 進球！（${act.makes} / ${act.shots}）`); } }
        else {
          phys = { vx: -ux * (over > 0 ? 1.8 : 0.6) + (Math.random() - 0.5), vy: over > 0.25 ? 1.2 : 2.6, vz: -uz * (over > 0 ? 1.8 : 0.6) + (Math.random() - 0.5) };
          if (!ctx.quiet) toast(err < 0 ? `差一點！力道太小（${act.makes} / ${act.shots}）` : `差一點！力道太大（${act.makes} / ${act.shots}）`);
        }
        return;
      }
      // 掉到地上彈幾下
      life += dt;
      phys.vy -= G * dt;
      ball.position.x += phys.vx * dt; ball.position.y += phys.vy * dt; ball.position.z += phys.vz * dt;
      const floorY = f.y + groundAt(f, ball.position.x, ball.position.z) + 0.13;
      if (ball.position.y < floorY) { ball.position.y = floorY; phys.vy = Math.abs(phys.vy) * 0.55; phys.vx *= 0.7; phys.vz *= 0.7; }
      if (life > 1.6) { ball.visible = false; act.busy = null; ctx.onDone?.(made); }
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
    for (const gl of GLIDERS) {
      const near = mode !== 'bird' && player.floor === gl.f && Math.hypot(player.x - gl.g.position.x, player.z - gl.g.position.z) < 1.3;
      if (near && !gl.near) meetGlider(gl);
      gl.near = near;
    }
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

  if (floors[1].group.visible) { cat.userData.anim(t); updateBirds(t, dt); updateTurtles(t, dt); }
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

// 每秒最多畫 60 張：高更新率螢幕（120、144、165Hz）不用跟著多畫，CPU / 顯示卡才不會狂轉
const MAX_FPS = 60, FRAME_MS = 1000 / MAX_FPS;
let nextFrame = 0;
function loop(now = performance.now()) {
  requestAnimationFrame(loop);
  if (now < nextFrame - FRAME_MS * 0.25) return;            // 還沒到下一張的時間（留一點寬容，60Hz 螢幕才不會誤跳）
  nextFrame = Math.max(nextFrame + FRAME_MS, now);          // 累加排程，平均剛好 60 張；落後太多就從現在重新算
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
/* ---------------- 依 10-15 新照片：小田園一帶、溪口情廊入口 ----------------
   甲梯外牆（面向 2F 小田園）：馬賽克壁畫「溪」「口」兩個字＋揮毛筆的人，牆腳一長條「印象溪口」水彩布條；小田園地面六角形地磚
   2F 舞蹈教室東牆（隔著走廊面向小田園）：木紋牆＋房子形狀的小黑板「溪口園藝小尖兵」、飲水機、「溪口小農夫」二十四節氣看板、木長凳
   1F 溪口情廊東端（甲梯下來往停車場方向）：白色歐式門框＋「XIKOU GALLERY」字；情廊裡木紋地磚、白色壁柱、黃色拱、軌道燈 */
const photoTex = (w, h, draw, opt = {}) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opt.repeat); }
  return new THREE.MeshLambertMaterial({ map: t, transparent: !!opt.alpha, alphaTest: opt.alpha ? 0.3 : 0 });
};
// 貼在牆上的平面：(x, y, z) 中心、寬 w 高 h，rotY：0 面向 +z、π 面向 -z、π/2 面向 +x、-π/2 面向 -x
function wallPic(f, m, x, y, z, w, h, rotY) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.position.set(x, y, z); p.rotation.y = rotY; p.receiveShadow = true;
  f.group.add(p);
  return p;
}
// 小磁磚格子（背景）
function tileGrid(c, w, h, base, line, step) {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  c.fillStyle = line;
  for (let x = 0; x < w; x += step) c.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += step) c.fillRect(0, y, w, 1);
}
function buildPhotoScenes() {
  const f1 = floorById['1F'], f2 = floorById['2F'];
  // ---- 甲梯外牆壁畫（北面，面向小田園） ----
  {
    const z = mz(330) - WALL_T / 2 - 0.03, x = mx((1555 + 1690) / 2), W = (1690 - 1555) / S;
    const mural = photoTex(512, 650, (c, w, h) => {
      tileGrid(c, w, h, '#e7e1d3', 'rgba(150,140,120,.35)', 8);
      // 左上：「溪」字（淺黃底、黑色毛筆字）
      c.fillStyle = '#efe6c4'; c.fillRect(40, 40, 170, 130);
      c.fillStyle = '#1d1b1a'; c.font = '700 110px "Noto Serif TC", "Noto Sans TC", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('溪', 125, 108);
      c.fillStyle = '#efe6c4'; c.fillRect(40, 180, 170, 130);                // 下面一格「口」
      c.fillStyle = '#1d1b1a'; c.fillText('口', 125, 248);
      // 右下：揮大毛筆的人（淺黃底、黑紅色大筆觸、綠色草地）
      const X = 230, Y = 210, PW = 230, PH = 400;
      c.fillStyle = '#efe6c4'; c.fillRect(X, Y, PW, PH);
      c.lineCap = 'round';
      c.strokeStyle = '#1d1b1a'; c.lineWidth = 34; c.beginPath(); c.arc(X + 120, Y + 120, 80, Math.PI * 0.55, Math.PI * 1.75); c.stroke();
      c.strokeStyle = '#b8212b'; c.lineWidth = 28; c.beginPath(); c.arc(X + 128, Y + 112, 74, Math.PI * 1.35, Math.PI * 1.95); c.stroke();
      c.strokeStyle = '#1d1b1a'; c.lineWidth = 6; c.beginPath(); c.moveTo(X + 120, Y + 190); c.lineTo(X + 95, Y + 130); c.stroke();   // 筆桿
      c.fillStyle = '#d9a07a'; c.fillRect(X + 108, Y + 185, 30, 60);                                  // 身體
      c.fillStyle = '#1d1b1a'; c.fillRect(X + 105, Y + 240, 36, 22);
      c.beginPath(); c.moveTo(X + 108, Y + 258); c.lineTo(X + 80, Y + 330); c.lineTo(X + 94, Y + 334); c.lineTo(X + 122, Y + 268); c.fill();
      c.beginPath(); c.moveTo(X + 128, Y + 258); c.lineTo(X + 150, Y + 334); c.lineTo(X + 164, Y + 330); c.lineTo(X + 140, Y + 262); c.fill();
      c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(X + 122, Y + 176, 13, 0, Math.PI * 2); c.fill();   // 頭
      c.fillStyle = '#3f8a3a'; for (let i = 0; i < 14; i++) c.fillRect(X + 20 + i * 14, Y + 330 + (i % 3) * 6, 26, 6);
      c.fillStyle = '#7cbf5a'; for (let i = 0; i < 8; i++) c.fillRect(X + 40 + i * 20, Y + 346, 18, 5);
    });
    // 壁畫跨 2～4 樓：依樓層切成幾段，各自掛在那一層（只顯示到某層時，上面不會浮在半空中）
    const y0 = f2.y + 2.7, y1 = f2.y + 9.3;
    for (const f of floors) {
      const a = Math.max(y0, f.y), b = Math.min(y1, f.y + FLOOR_H);
      if (b - a < 0.01) continue;
      const t = mural.map.clone(); t.needsUpdate = true;
      t.repeat.set(1, (b - a) / (y1 - y0)); t.offset.set(0, (a - y0) / (y1 - y0));
      wallPic(f, new THREE.MeshLambertMaterial({ map: t }), x - 0.2, (a + b) / 2, z, 5.2, b - a, Math.PI);
    }
    // 牆腳：「印象溪口」水彩風景布條
    const banner = photoTex(1024, 160, (c, w, h) => {
      c.fillStyle = '#f4f6f4'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#b9d7e6'; for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(120 + i * 140, 120, 110, 40, 0, Math.PI, 0); c.fill(); }
      c.fillStyle = '#9cc7a0'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(80 + i * 115, 140, 70, 26, 0, Math.PI, 0); c.fill(); }
      c.fillStyle = '#5f8f4a'; for (let i = 0; i < 18; i++) { const tx = 60 + i * 55 + (i % 3) * 8; c.fillRect(tx, 96, 3, 30); c.beginPath(); c.arc(tx + 1, 92, 10, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#c0504d'; c.fillRect(780, 100, 26, 20); c.fillStyle = '#7a4a2a'; c.fillRect(784, 112, 6, 8);   // 小房子
      c.fillStyle = '#7b4fa8'; c.font = '700 40px "Noto Sans TC", sans-serif'; c.fillText('溪口', 70, 110);
      c.fillStyle = '#4f8fc0'; c.font = '700 22px "Noto Sans TC", sans-serif'; c.fillText('印象', 40, 50);
      c.fillStyle = 'rgba(80,90,100,.55)'; for (let r = 0; r < 3; r++) c.fillRect(380, 18 + r * 14, 260, 4);   // 小字（看不清楚，畫成字行）
      c.fillRect(700, 22, 200, 4); c.fillRect(720, 36, 160, 4);
    });
    wallPic(f2, banner, x, f2.y + 0.95, z - 0.03, W - 0.2, 1.2, Math.PI);
    // 小田園地面：六角形地磚
    const t = rectM([1555, 150, 1690, 330]);
    const hex = photoTex(128, 111, (c, w, h) => {
      c.fillStyle = '#9a958c'; c.fillRect(0, 0, w, h);
      const R = 32, hexAt = (cx, cy) => { c.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; c.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); } c.closePath(); c.fill(); };
      c.fillStyle = '#c3beb3';
      for (const [cx, cy] of [[0, 0], [96, 0], [48, 55.5], [0, 111], [96, 111], [144, 55.5], [-48, 55.5]]) hexAt(cx, cy);
    }, { repeat: [(t.x2 - t.x1) / 1.3, (t.z2 - t.z1) / 1.12] });
    const floorP = new THREE.Mesh(new THREE.PlaneGeometry(t.x2 - t.x1, t.z2 - t.z1), hex);
    floorP.rotation.x = -Math.PI / 2; floorP.position.set((t.x1 + t.x2) / 2, f2.y + 0.016, (t.z1 + t.z2) / 2); floorP.receiveShadow = true;
    f2.group.add(floorP);
  }
  // ---- 2F 舞蹈教室東牆（面向小田園）：由南往北 消防警報、木紋牆＋小黑板、飲水機、二十四節氣看板＋木長凳 ----
  {
    const x = mx(1510) + WALL_T / 2 + 0.03, zS = mz(330), gy = f2.y;
    const chalk = photoTex(700, 660, (c, w, h) => {
      c.fillStyle = '#c9a682'; c.fillRect(0, 0, w, h);                                            // 木紋牆
      c.fillStyle = 'rgba(120,85,50,.18)'; for (let x0 = 0; x0 < w; x0 += 9) c.fillRect(x0, 0, 2, h);
      c.fillStyle = '#4caf50'; c.font = '700 30px "Noto Sans TC", sans-serif'; c.fillText('夢想小豆苗', 70, 50);
      c.fillStyle = '#6a8f3a'; c.fillRect(40, 20, 6, 50);
      // 房子形狀的黑板（白框）
      const house = (pad) => { c.beginPath(); c.moveTo(60 + pad, 230); c.lineTo(350, 70 + pad * 1.2); c.lineTo(640 - pad, 230); c.lineTo(640 - pad, 640); c.lineTo(60 + pad, 640); c.closePath(); };
      c.fillStyle = '#f4f4f0'; house(0); c.fill();
      c.fillStyle = '#1e2222'; house(16); c.fill();
      c.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 30; i++) c.fillRect(90 + Math.random() * 500, 240 + Math.random() * 380, 60, 8);
      c.font = '700 44px "Noto Sans TC", sans-serif'; c.textAlign = 'center';
      ['溪', '口', '園', '藝', '小', '尖', '兵'].forEach((t, i) => { c.fillStyle = ['#cfe8ee', '#f2a7b8', '#f4f4f0', '#f4f4f0', '#f4f4f0', '#f4f4f0', '#f6e7a8'][i]; c.fillText(t, 170 + i * 62, 215 - (i === 1 ? 6 : 0)); });
      c.strokeStyle = '#f4f4f0'; c.lineWidth = 3; c.strokeRect(200, 250, 330, 100);
      c.fillStyle = '#f4f4f0'; c.font = '24px "Noto Sans TC", sans-serif';
      c.fillText('生活裡的自給自足', 365, 290); c.fillText('藏在每一片向光而生的綠意中', 365, 330);
      c.fillStyle = '#e8d8b8'; c.fillRect(250, 360, 230, 10);
      // 左邊彩虹年輪、右邊仙人掌、下面一排山
      ['#e57373', '#ffb74d', '#fff176', '#81c784', '#64b5f6', '#ba68c8'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); c.arc(150, 380, 70 - i * 8, 0, Math.PI * 2); c.stroke(); });
      c.fillStyle = '#d8d8d8'; c.beginPath(); c.arc(150, 380, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9ccc9c'; c.fillRect(555, 290, 30, 160); c.fillRect(528, 330, 22, 50); c.fillRect(590, 310, 22, 60);
      c.strokeStyle = '#f4f4f0'; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(200 + i * 85, 640); c.quadraticCurveTo(240 + i * 85, 440, 280 + i * 85, 640); c.stroke(); }
    });
    wallPic(f2, chalk, x, gy + 1.45, zS - 1.95, 2.8, 2.64, Math.PI / 2);
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.25), new THREE.MeshLambertMaterial({ color: '#c62828' }));
    fire.position.set(x + 0.05, gy + 1.3, zS - 0.3); f2.group.add(fire);
    // 飲水機（不鏽鋼）
    const steel = new THREE.MeshLambertMaterial({ color: '#b9bec4' });
    const disp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.35, 0.55), steel); disp.position.set(x + 0.23, gy + 0.675, zS - 3.65); disp.castShadow = true; f2.group.add(disp);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.45), new THREE.MeshLambertMaterial({ color: '#7d848b' })); tray.position.set(x + 0.48, gy + 0.85, zS - 3.65); f2.group.add(tray);
    // 二十四節氣看板
    const terms = [['立春', '春分', '立夏', '夏至', '立秋', '秋分', '立冬', '冬至'], ['雨水', '清明', '小滿', '小暑', '處暑', '寒露', '小雪', '小寒'], ['驚蟄', '穀雨', '芒種', '大暑', '白露', '霜降', '大雪', '大寒']];
    const board = photoTex(1024, 380, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#f4ead8'); g.addColorStop(1, '#f6d6b8'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7fbf4a'; c.beginPath(); c.arc(40, 40, 60, 0, Math.PI * 2); c.fill();             // 左上樹葉
      [['溪', '#f08a24', 60, 120, 40], ['口', '#f08a24', 120, 92, 34], ['小', '#d9433a', 170, 140, 26], ['農', '#d9433a', 215, 130, 26], ['夫', '#d9433a', 258, 140, 26]].forEach(([t, col, cx, cy, r]) => {
        c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff'; c.font = `700 ${r * 1.2}px "Noto Sans TC", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, cx, cy + 2);
      });
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      c.fillStyle = '#3d4f8a'; c.font = '700 20px "Noto Sans TC", sans-serif'; c.fillText('舞動季節的樂章', 90, 200); c.fillText('——慢學習、深體驗', 120, 226);
      c.fillStyle = 'rgba(60,60,60,.55)'; for (let r = 0; r < 5; r++) c.fillRect(40, 244 + r * 12, 220, 4);
      const cols = ['#d9433a', '#f08a24', '#4c9f38', '#2e86c1', '#8e44ad', '#c0392b', '#16a085', '#7f8c8d'];
      terms.forEach((row, r) => row.forEach((t, i) => {
        const cx = 320 + i * 86, cy = 50 + r * 82;
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, cy, 16, 0, Math.PI * 2); c.fill();
        c.fillStyle = cols[(i + r) % cols.length]; c.beginPath(); c.arc(cx, cy, 11, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2b2b2b'; c.font = '700 19px "Noto Sans TC", sans-serif'; c.fillText(t, cx + 20, cy + 7);
        c.fillStyle = 'rgba(60,60,60,.45)'; c.fillRect(cx - 16, cy + 22, 70, 3); c.fillRect(cx - 16, cy + 30, 60, 3);
      }));
      // 下面：綠色山丘、白色柵欄、戴斗笠插秧的小農夫、右邊金黃色稻穗
      c.fillStyle = '#9fd36a'; c.beginPath(); c.ellipse(260, 380, 360, 90, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#6fb64a'; c.beginPath(); c.ellipse(560, 390, 300, 70, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#d6edf2'; c.fillRect(420, 330, 220, 50);
      c.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) c.fillRect(380 + i * 16, 300, 7, 34); c.fillRect(376, 310, 96, 5);
      c.fillStyle = '#d8b26a'; c.beginPath(); c.moveTo(560, 278); c.lineTo(610, 262); c.lineTo(660, 278); c.fill();   // 斗笠
      c.fillStyle = '#c0392b'; c.fillRect(592, 280, 34, 30); c.fillStyle = '#2b2b2b'; c.fillRect(596, 310, 26, 22);
      c.fillStyle = '#e8b830'; for (let i = 0; i < 24; i++) { const sx = 720 + i * 13; c.fillRect(sx, 250 + (i % 4) * 12, 5, 130); }
    });
    wallPic(f2, board, x, gy + 2.0, zS - 5.45, 4.0, 1.48, Math.PI / 2);
    const tiles = photoTex(256, 72, (c, w, h) => tileGrid(c, w, h, '#e9dcc0', 'rgba(140,120,90,.45)', 8));
    wallPic(f2, tiles, x, gy + 0.62, zS - 5.45, 4.1, 1.18, Math.PI / 2);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 2.0), new THREE.MeshLambertMaterial({ color: '#d9bf98' }));
    bench.position.set(x + 0.3, gy + 0.21, zS - 5.9); bench.castShadow = true; f2.group.add(bench);
  }
  // ---- 2F 教師會辦公室朝中庭的外牆（依照片）：彩色文化石磚（米白、灰藍、淺咖啡），兩扇門中間掛「樂學方堂 Learning Paradise」 ----
  {
    const r = rooms.find((x) => x.name === '教師會辦公室'), f = r.f, H = 2.95, z = r.m.z2 + WALL_T / 2 + 0.02;
    const brick = photoTex(256, 256, (c, w, h) => {
      const cols = ['#e8dcc4', '#d9c4a0', '#b9c2c8', '#c9b49a', '#efe6d4', '#a8b4bc', '#cdb08a', '#e0d0b6'];
      c.fillStyle = '#d8d2c6'; c.fillRect(0, 0, w, h);
      for (let row = 0; row < 16; row++) for (let k = -1; k < 6; k++) {
        const x = k * 50 + (row % 2) * 25, y = row * 16;
        c.fillStyle = cols[(row * 7 + k * 3 + (k * row) % 5) % cols.length]; c.fillRect(x + 1, y + 1, 47, 14);
        c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(x + 1 + (row * k * 13) % 30, y + 4, 10, 2);   // 磚面的紋路
      }
    }, { repeat: [1, 1] });
    brick.map.wrapS = brick.map.wrapT = THREE.RepeatWrapping;
    const ds = (r.doorPts || []).filter((d) => d.side === 'S').map((d) => d.x).sort((a, b) => a - b), dw = 0.8;
    const cuts = [r.m.x1 + 0.05, ...ds.flatMap((x) => [x - dw, x + dw]), r.m.x2 - 0.05];
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i], b = cuts[i + 1]; if (b - a < 0.1) continue;
      const m = brick.clone(); m.map = brick.map.clone(); m.map.repeat.set(b - a, H); m.map.needsUpdate = true;
      wallPic(f, m, (a + b) / 2, f.y + H / 2, z, b - a, H, 0);
    }
    // 門楣上方也貼磚
    for (const x of ds) { const m = brick.clone(); m.map = brick.map.clone(); m.map.repeat.set(dw * 2, H - 2.25); m.map.needsUpdate = true; wallPic(f, m, x, f.y + 2.25 + (H - 2.25) / 2, z, dw * 2, H - 2.25, 0); }
    const sign = photoTex(640, 220, (c, w, h) => {
      c.fillStyle = '#4a2418'; c.font = '900 120px "Noto Sans TC", "Microsoft JhengHei", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillText('樂學方堂', w / 2 + 5, 79);
      c.fillStyle = '#5a2a1c'; c.fillText('樂學方堂', w / 2, 74);
      c.fillStyle = '#3a1a14'; c.fillRect(70, 150, 500, 58);
      c.fillStyle = '#ffffff'; c.font = '700 40px "Comic Sans MS", "Noto Sans TC", sans-serif'; c.fillText('Learning Paradise', w / 2, 180);
    }, { alpha: true });
    const mid = ds.length >= 2 ? (ds[0] + ds[1]) / 2 : (r.m.x1 + r.m.x2) / 2;
    wallPic(f, sign, mid, f.y + 1.75, z + 0.02, 2.6, 0.9, 0);
  }
  // ---- 2F 國際牆（依照片）：敬業樓西側走廊兩面牆（面向西）。北段：「SAY HELLO TO THE WORLD!」國旗樹＋兩幅世界地圖、上面一排各國時鐘；
  //   南段：南北美洲＋大大的臺灣（小朋友用各國語言打招呼）。地圖用簡化的大陸形狀重畫 ----
  {
    const f2b = floorById['2F'], xw = mx(705) - WALL_T / 2 - 0.03, H = 2.7;
    const ocean = (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3fa4dc'); g.addColorStop(1, '#6cc4ee');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
      for (let i = 0; i < 60; i++) { const x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.arc(x, y, 14 + Math.random() * 20, 0, Math.PI); c.stroke(); }
      c.fillStyle = '#2a86c4';
      for (let i = 0; i < 14; i++) { const x = Math.random() * w; c.beginPath(); c.moveTo(x, h); c.quadraticCurveTo(x + 10, h - 60 - Math.random() * 40, x + 4, h - 90); c.lineTo(x + 10, h); c.fill(); }   // 下面的海草
    };
    // 大陸：多邊形、淺藍描邊、裡面再分幾塊顏色、小地標
    const land = (c, ox, oy, w, h, pts, cols) => {
      c.save(); c.beginPath();
      const P = pts.map(([x, y]) => [ox + x * w, oy + y * h]), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      c.moveTo(...mid(P.at(-1), P[0])); P.forEach((p, i) => c.quadraticCurveTo(p[0], p[1], ...mid(p, P[(i + 1) % P.length])));   // 圓滑的海岸線
      c.closePath();
      c.strokeStyle = '#bfe6fb'; c.lineWidth = 10; c.stroke(); c.fillStyle = cols[0]; c.fill(); c.clip();
      for (let i = 1; i < cols.length; i++) { const p = pts[i % pts.length]; c.fillStyle = cols[i]; c.beginPath(); c.arc(ox + (p[0] * 0.6 + 0.2) * w, oy + p[1] * h, 0.22 * Math.min(w, h), 0, 7); c.fill(); }
      for (let i = 0; i < 26; i++) { const p = pts[i % pts.length]; c.fillStyle = ['#ffffff', '#c0392b', '#6a4a2a', '#2e7d32', '#f1c40f'][i % 5]; c.fillRect(ox + (p[0] * 0.7 + 0.15 * (i % 3)) * w, oy + (p[1] * 0.8 + 0.06 * (i % 4)) * h, 6, 8); }
      c.restore();
    };
    const label = (c, x, y, zh, en, size = 26) => {
      c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.strokeStyle = '#1d5a8a'; c.lineWidth = 5;
      c.font = `900 ${size}px "Noto Sans TC", sans-serif`; c.strokeText(zh, x, y); c.fillText(zh, x, y);
      c.font = `900 ${Math.round(size * 0.62)}px "Arial Black", sans-serif`; c.strokeText(en, x, y + size * 0.85); c.fillText(en, x, y + size * 0.85);
    };
    const C = {
      eu: [[0.1, 0.3], [0.45, 0.1], [0.62, 0.3], [0.5, 0.62], [0.2, 0.7]],
      as: [[0.02, 0.32], [0.4, 0.05], [0.95, 0.12], [0.85, 0.45], [0.6, 0.85], [0.42, 0.7], [0.15, 0.6]],
      af: [[0.05, 0.12], [0.75, 0.08], [0.95, 0.4], [0.6, 0.95], [0.4, 0.85], [0.2, 0.42]],
      oc: [[0.05, 0.3], [0.6, 0.05], [0.95, 0.45], [0.7, 0.95], [0.1, 0.75]],
      na: [[0.02, 0.25], [0.35, 0.05], [0.95, 0.15], [0.78, 0.55], [0.5, 0.75], [0.4, 0.98], [0.25, 0.7], [0.1, 0.5]],
      sa: [[0.15, 0.02], [0.75, 0.1], [0.98, 0.35], [0.55, 0.75], [0.35, 0.98], [0.25, 0.55]],
      gl: [[0.1, 0.1], [0.9, 0.05], [0.7, 0.85], [0.3, 0.95]],
    };
    const north = photoTex(1500, 540, (c, w, h) => {
      ocean(c, w, h);
      // 國旗樹
      c.fillStyle = '#8a5a3a'; c.beginPath(); c.moveTo(150, h - 40); c.lineTo(180, 300); c.lineTo(205, 300); c.lineTo(235, h - 40); c.fill();
      c.strokeStyle = '#8a5a3a'; c.lineWidth = 12;
      for (const [x, y] of [[110, 230], [280, 240], [190, 180]]) { c.beginPath(); c.moveTo(192, 310); c.lineTo(x, y); c.stroke(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(195, 190, 175, 140, 0, 0, 7); c.fill();
      const flag = [['#c8102e', '#ffffff'], ['#002868', '#bf0a30'], ['#de2910', '#ffde00'], ['#000000', '#dd0000', '#ffce00'], ['#009246', '#ffffff', '#ce2b37'],
        ['#fe0000', '#000095'], ['#ffffff', '#bc002d'], ['#0055a4', '#ffffff', '#ef4135'], ['#006847', '#ffffff', '#ce1126'], ['#00843d', '#ffcd00']];
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * 7, r = Math.sqrt(Math.random()), x = 195 + Math.cos(a) * r * 150, y = 190 + Math.sin(a) * r * 115, fl = flag[i % flag.length];
        c.save(); c.translate(x, y); c.rotate((Math.random() - 0.5) * 0.5);
        fl.forEach((col, k) => { c.fillStyle = col; c.fillRect(-18, -12 + k * 24 / fl.length, 36, 24 / fl.length + 0.5); });
        c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; c.strokeRect(-18, -12, 36, 24); c.restore();
      }
      c.fillStyle = '#ffffff'; c.strokeStyle = '#1d5a8a'; c.lineWidth = 5; c.font = '900 26px "Arial Black", sans-serif'; c.textAlign = 'center';
      c.strokeText('SAY HELLO TO THE WORLD!', 195, 52); c.fillText('SAY HELLO TO THE WORLD!', 195, 52);
      c.fillStyle = '#ffffff'; c.font = '900 22px "Noto Sans TC", sans-serif';
      [...'我要向全世界打招呼'].forEach((ch, i) => c.fillText(ch, 205, 330 + i * 22));
      // 第一幅：歐洲、亞洲、非洲、大洋洲
      land(c, 420, 70, 160, 140, C.eu, ['#f2a0b0', '#9b7ad6', '#f2c14e', '#7cc38a']); label(c, 470, 70, '歐洲', 'EUROPE');
      land(c, 560, 90, 270, 220, C.as, ['#8fd36a', '#f2a03a', '#9b7ad6', '#f2c14e']); label(c, 700, 115, '亞洲', 'ASIA');
      land(c, 430, 230, 180, 230, C.af, ['#f2a03a', '#8fd36a', '#c98a3a']); label(c, 400, 400, '非洲', 'AFRICA');
      land(c, 700, 340, 120, 100, C.oc, ['#f2a03a', '#e8762b']); label(c, 750, 470, '大洋洲', 'OCEANIA');
      // 第二幅：歐亞非在左、美洲在右（太平洋在中間）
      land(c, 880, 100, 90, 80, C.eu, ['#8fd36a', '#f2a0b0']); land(c, 930, 80, 180, 160, C.as, ['#3f9a4a', '#f2a03a', '#8a6ad6']);
      land(c, 870, 200, 110, 150, C.af, ['#f2a03a', '#8fd36a']); land(c, 1080, 300, 80, 70, C.oc, ['#e8762b']);
      land(c, 1230, 70, 200, 190, C.na, ['#3f9a4a', '#f2c14e', '#8a6ad6']); land(c, 1330, 280, 100, 170, C.sa, ['#8fd36a', '#f2c14e']); land(c, 1400, 40, 70, 70, C.gl, ['#f2c14e']);
      label(c, 1240, 200, '北美洲', 'North America', 20); label(c, 1340, 380, '南美洲', 'South America', 20); label(c, 1140, 470, '南極洲', 'Antarctica', 20);
      c.fillStyle = '#ffffff'; c.fillRect(880, 490, 420, 50);                      // 南極洲的冰（還有企鵝）
      for (let i = 0; i < 6; i++) { const x = 920 + i * 60; c.fillStyle = '#1d1d1d'; c.beginPath(); c.ellipse(x, 490, 10, 18, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, 494, 6, 12, 0, 0, 7); c.fill(); }
      c.fillStyle = '#ffffff'; c.font = '900 16px "Arial Black", sans-serif';
      c.fillText('PACIFIC OCEAN', 1160, 260); c.fillText('ARCTIC OCEAN', 1140, 60); c.fillText('INDIAN OCEAN', 1010, 330);
    });
    const south = photoTex(1640, 540, (c, w, h) => {
      ocean(c, w, h);
      land(c, 120, 60, 520, 330, C.na, ['#f2c14e', '#8a6ad6', '#c0392b', '#3f9a4a']); land(c, 560, 30, 260, 180, C.gl, ['#ffffff', '#e8eef2']);
      land(c, 560, 300, 260, 240, C.sa, ['#8fd36a', '#9b4ad6', '#f2c14e']);
      label(c, 270, 90, '北美洲', 'NORTH AMERICA', 30); label(c, 560, 470, '南美洲', 'SOUTH AMERICA', 30);
      // 臺灣（黃綠色、大大的），上面一圈各國語言的「你好」
      const tw = [[1310, 60], [1400, 40], [1430, 90], [1390, 260], [1330, 420], [1270, 520], [1230, 470], [1180, 330], [1220, 170]];
      c.beginPath(); tw.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.strokeStyle = '#bfe6fb'; c.lineWidth = 12; c.stroke(); c.fillStyle = '#c9dc4a'; c.fill();
      label(c, 1160, 40, '臺灣', 'TAIWAN', 30);
      const hi = [['Apa khabar?', 1300, 60], ['ជំរាបសួរ', 1450, 70], ['こんにちは', 1360, 125], ['Halo', 1190, 140], ['안녕하세요', 1390, 190], ['Mabuhay', 1170, 200],
        ['สวัสดีครับ', 1300, 230], ['Bonjour', 1140, 285], ['Xin chào', 1320, 290], ['မင်္ဂလာပါ', 1110, 330], ['Hello', 1260, 335], ['Hola', 1150, 400], ['नमस्ते', 1330, 390]];
      for (const [t, x, y] of hi) {
        c.font = '700 18px "Noto Sans TC", sans-serif'; const tw2 = c.measureText(t).width + 18;
        c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x, y, tw2 / 2, 17, 0, 0, 7); c.fill();
        c.fillStyle = '#222'; c.textAlign = 'center'; c.fillText(t, x, y + 6);
      }
      for (const [x, y, sh] of [[1240, 110, '#e53935'], [1200, 250, '#1e88e5'], [1350, 250, '#fdd835'], [1240, 420, '#43a047'], [1290, 470, '#8e24aa'], [1180, 360, '#fb8c00']]) {   // 小朋友
        c.fillStyle = '#f5c99a'; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(x, y - 3, 11, Math.PI, 0); c.fill();
        c.fillStyle = sh; c.fillRect(x - 8, y + 10, 16, 18); c.fillStyle = '#34495e'; c.fillRect(x - 7, y + 28, 5, 12); c.fillRect(x + 2, y + 28, 5, 12);
      }
      c.fillStyle = '#ffffff';
      for (const [x, y] of [[300, 430], [980, 420]]) { c.beginPath(); c.ellipse(x, y, 60, 22, 0, 0, 7); c.ellipse(x + 40, y + 10, 45, 18, 0, 0, 7); c.fill(); }
    });
    const segN = [mz(195), mz(330)], segS = [mz(398), mz(545)];
    wallPic(f2b, north, xw, f2b.y + 0.1 + H / 2, (segN[0] + segN[1]) / 2, segN[1] - segN[0] - 0.2, H, -Math.PI / 2);
    wallPic(f2b, south, xw, f2b.y + 0.1 + H / 2, (segS[0] + segS[1]) / 2, segS[1] - segS[0] - 0.2, H, -Math.PI / 2);
    // 北段上面一排各國時鐘
    const clockFace = (k) => photoTex(64, 64, (c) => {
      c.fillStyle = ['#ffffff', '#e8f0ff', '#fff2f2', '#ffffff', '#f2fff2', '#ffffff'][k]; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill();
      c.strokeStyle = '#1d1d1d'; c.lineWidth = 4; c.stroke(); c.lineWidth = 3;
      c.beginPath(); c.moveTo(32, 32); c.lineTo(32 + Math.cos(k) * 18, 32 + Math.sin(k) * 18); c.moveTo(32, 32); c.lineTo(32 + Math.cos(k * 2.3) * 12, 32 + Math.sin(k * 2.3) * 12); c.stroke();
    }, { alpha: true });
    for (let k = 0; k < 6; k++) wallPic(f2b, clockFace(k), xw - 0.03, f2b.y + 2.45, segN[0] + (segN[1] - segN[0]) * (0.48 + k * 0.085), 0.36, 0.36, -Math.PI / 2);
    // 牆前地上的彩色圓點
    ['#8e44ad', '#f1c40f', '#27ae60', '#2e5ab0', '#8e44ad'].forEach((col, i) => {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshLambertMaterial({ color: col }));
      dot.rotation.x = -Math.PI / 2; dot.position.set(xw - 0.9 - (i % 2) * 0.4, f2b.y + 0.02, segN[0] + 1.2 + i * 1.3); f2b.group.add(dot);
    });
  }
  // ---- 乙梯往 B1（依照片）：沿著樓梯斜度的黃褐色磨石子腰牆（上面一排黃色圓點）＋灰色飾帶＋扶手，牆上掛一張張彩色海報；
  //   最下面一段（往上那段樓梯底下、放書包的地方）牆上是「行人專心走／馬路如虎口」老虎標語＋斑馬線，牆邊排著書包 ----
  {
    const fB = floorById['B1'], s = fB.stairs.find((x) => x.id === '乙梯'), g = s.g, H = FLOOR_H;
    const k01 = (u) => Math.max(0, Math.min(1, (u - g.s0) / (g.f1 - g.s0)));
    const yA = (u) => (u <= g.s0 ? 0 : u >= g.f1 ? H / 2 : (H / 2) * k01(u));          // A 道（北側）的階梯高度
    const yBunder = (u) => H / 2 + (H / 2) * (1 - k01(u)) - 0.25;                       // B 道（南側）樓梯底面
    const wainTex = photoTex(256, 256, (c, w, h) => {
      c.fillStyle = '#c9a86a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) { c.fillStyle = ['#b08e52', '#ddc28a', '#a07a44'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      c.fillStyle = '#f2e04a'; for (const x of [64, 192]) { c.beginPath(); c.ellipse(x, 52, 30, 36, 0, 0, 7); c.fill(); }
    }, { repeat: [1, 1] });
    const greyTex = photoTex(128, 32, (c, w, h) => {
      c.fillStyle = '#8b9093'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) { c.fillStyle = i % 2 ? '#6e7376' : '#b5b9bb'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      c.fillStyle = '#1d1d1d'; c.fillRect(0, h - 3, w, 3);
    }, { repeat: [1, 1] });
    // 斜面四邊形：沿著牆從 u1 到 u2，下緣高度 y(u)，往上 hh；z 是牆面位置
    const band = (m, u1, u2, yFn, y0, hh, v) => {
      const pts = [], uvs = [], N = 10;
      for (let i = 0; i <= N; i++) {
        const u = u1 + (u2 - u1) * i / N, [x, z] = g.toXZ(u, v), y = fB.y + yFn(u) + y0;
        pts.push(x, y, z, x, y + hh, z); uvs.push(u, 0, u, hh);
      }
      const geo = new THREE.BufferGeometry(), idx = [];
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, m); m.side = THREE.DoubleSide; mesh.receiveShadow = true; fB.group.add(mesh);
    };
    const vN = WALL_T / 2 + 0.03, vM = g.Wd / 2 - WALL_T / 2 - 0.03;                   // 北牆、中間那道牆（兩段樓梯中間）朝北的牆面（牆有厚度，要貼在牆面外側）
    band(wainTex, 0, g.L, yA, 0, 1.0, vN); band(greyTex, 0, g.L, yA, 1.0, 0.16, vN);
    band(wainTex, g.s0, g.f1, yA, 0, 1.0, vM); band(greyTex, g.s0, g.f1, yA, 1.0, 0.16, vM);
    // 北牆扶手（不鏽鋼）
    const steel = new THREE.MeshLambertMaterial({ color: '#c9ccd0' });
    for (let i = 0; i < 12; i++) {
      const u1 = g.s0 + (g.f1 - g.s0) * i / 12, u2 = g.s0 + (g.f1 - g.s0) * (i + 1) / 12, [x1, z] = g.toXZ(u1, 0.1), [x2] = g.toXZ(u2, 0.1);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x2 - x1, yA(u2) - yA(u1)) + 0.02, 0.04, 0.04), steel);
      rail.position.set((x1 + x2) / 2, fB.y + (yA(u1) + yA(u2)) / 2 + 0.85, z); rail.rotation.z = Math.atan2(yA(u2) - yA(u1), x2 - x1); fB.group.add(rail);
    }
    // 北牆：沿著樓梯掛的彩色海報（袋子形狀的彩色框＋中間一張宣導海報）
    const posterTex = (col, k) => photoTex(160, 230, (c, w, h) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(10, 30); c.lineTo(w - 10, 30); c.lineTo(w - 4, h - 6); c.lineTo(4, h - 6); c.closePath(); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 4; c.stroke(); c.beginPath(); c.moveTo(6, h - 60); c.lineTo(w - 6, h - 60); c.stroke();
      c.fillStyle = '#555'; c.fillRect(w / 2 - 4, 0, 8, 32);
      c.fillStyle = '#fbfaf2'; c.fillRect(24, 44, w - 48, 110);
      c.fillStyle = ['#3a8fd0', '#e8762b', '#6a4a2a', '#2e9a4a'][k % 4]; c.beginPath(); c.arc(w / 2, 95, 30, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(34, 50, w - 68, 8); c.fillRect(34, 136, w - 68, 6);
    }, { alpha: true });
    ['#d63a3a', '#3fbf5a', '#f2d23a', '#7ac8e8', '#e85a3a', '#3fbf5a'].forEach((col, k) => {
      const u = 1.6 + k * 1.25, [x, z] = g.toXZ(u, vN + 0.01);
      wallPic(fB, posterTex(col, k), x, fB.y + yA(u) + 1.75, z, 0.55, 0.8, 0);
    });
    // 中間那道牆朝北那面（走下來在右手邊、從 B1 往上看在左手邊）：「行人專心走 ／ 馬路如虎口」＋兩隻黃色老虎＋斑馬線，左右各一張海報（綠框、藍框）
    const slogan = photoTex(1360, 520, (c, w, h) => {
      const circles = (x, chars) => chars.forEach((ch, i) => {
        c.fillStyle = ['#e8573a', '#f08a3a', '#f2d23a', '#7fd17a', '#7fd17a'][i]; c.beginPath(); c.arc(x, 60 + i * 98, 46, 0, 7); c.fill();
        c.fillStyle = '#111'; c.font = '900 64px "Noto Sans TC", "Microsoft JhengHei", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, x, 62 + i * 98);
      });
      circles(520, [...'行人專心走']); circles(840, [...'馬路如虎口']);
      c.fillStyle = '#7d7d7d'; c.beginPath(); c.moveTo(610, 40); c.lineTo(750, 40); c.lineTo(770, 480); c.lineTo(590, 480); c.fill();   // 斑馬線
      c.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { const y = 52 + i * 72; c.fillRect(618 - i * 3, y, 124 + i * 6, 58); }
      const tiger = (x, flip) => {
        c.save(); c.translate(x, 0); c.scale(flip ? -1 : 1, 1);
        c.fillStyle = '#f2d23a'; c.beginPath(); c.moveTo(-90, 460); c.bezierCurveTo(-110, 300, -40, 150, 40, 140); c.lineTo(70, 120); c.lineTo(90, 200); c.lineTo(60, 260); c.lineTo(90, 440); c.closePath(); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.ellipse(20, 190, 12, 9, 0, 0, 7); c.fill();
        c.strokeStyle = '#2a5ab0'; c.lineWidth = 7; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-60 + i * 18, 300); c.lineTo(-30 + i * 18, 380); c.stroke(); }
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(70, 230); c.lineTo(90, 245); c.lineTo(66, 252); c.fill();
        c.restore();
      };
      tiger(330, false); tiger(1030, true);
      const board = (x, col) => { c.fillStyle = col; c.fillRect(x, 90, 150, 300); c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(x, 90, 150, 300); c.fillStyle = '#fbfaf2'; c.fillRect(x + 14, 110, 122, 150); c.fillStyle = '#8a6a4a'; c.beginPath(); c.arc(x + 75, 190, 34, 0, 7); c.fill(); };
      board(20, '#7fd99a'); board(1190, '#7cc8ea');
    }, { alpha: true });
    {
      const u = 3.0, [x, z] = g.toXZ(u, vM - 0.01);
      wallPic(fB, slogan, x, fB.y + yA(u) + 1.85, z, 3.2, 1.22, Math.PI);                // 面向北（-z）
    }
    // B1 樓梯口的平地：靠牆排著書包（滾輪書包、運動提袋）
    const bagCols = ['#e8506a', '#3a3a3a', '#2a5ab0', '#c0392b'];
    bagCols.forEach((col, i) => {
      const [x, z] = g.toXZ(0.35, g.Wd - 0.35 - i * 0.42);
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45 + (i % 3) * 0.08, 0.24), new THREE.MeshLambertMaterial({ color: col }));
      bag.position.set(x, fB.y + bag.geometry.parameters.height / 2, z); bag.castShadow = true; fB.group.add(bag);
      if (i % 2 === 0) { const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), steel); h2.position.set(x, fB.y + 0.75, z + 0.08); fB.group.add(h2); }
    });
  }
  // ---- 3F「秋天的信」壁畫（依照片）：團輔室東牆、正對潛能教室一和二的門；整面畫到天花板，下面三分之一是馬賽克小磁磚 ----
  //   左邊秋天的樹（兔子穿紅毛衣靠著樹、松鼠）、中間池塘＋踏腳石＋青蛙、遠方綠色山丘、紅屋頂小屋、柏樹、涼亭、蝴蝶；
  //   上面是詩（林武憲〈秋天的信〉）：只畫標題和作者，詩句用毛筆字的筆畫表示，不抄全文
  {
    const f3 = floorById['3F'], r = rooms.find((x) => x.name === '團輔室' && x.f === f3);
    const W = r.m.z2 - r.m.z1, H = 2.98;
    const tex = photoTex(2048, 748, (c, w, h) => {
      let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      const sky = c.createLinearGradient(0, 0, 0, h * 0.5); sky.addColorStop(0, '#e6f1ee'); sky.addColorStop(1, '#bfe0ee');
      c.fillStyle = sky; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(rnd() * w, 60 + rnd() * 200, 60 + rnd() * 90, 18 + rnd() * 16, 0, 0, 7); c.fill(); }
      const hill = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], h); for (let i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.lineTo(pts.at(-2), h); c.closePath(); c.fill(); };
      // 遠山（右邊淺綠大山坡）、左邊深綠山
      c.lineJoin = 'round';
      hill([300, 400, 560, 300, 800, 290, 1000, 330, 1100, 380], '#5f9a62');
      hill([800, 420, 1100, 340, 1400, 300, 1700, 270, 2048, 250, 2048, 420], '#a8cf7a');
      c.fillStyle = 'rgba(90,150,70,.35)'; for (let i = 0; i < 500; i++) c.fillRect(1050 + rnd() * 1000, 270 + rnd() * 140, 6, 2);   // 山坡上的草
      for (const [x, y] of [[1000, 350], [1150, 315], [1450, 290], [1700, 268], [1860, 262]]) for (let k = 0; k < 5; k++) { c.fillStyle = '#3f7a45'; c.beginPath(); c.ellipse(x + k * 12, y - 6, 6, 12, 0, 0, 7); c.fill(); }   // 山稜線的小樹
      // 中景一排樹＋草地
      hill([0, 450, 400, 430, 900, 440, 1400, 450, 2048, 440], '#7dbb52');
      for (let x = 700; x < 1330; x += 22) { c.fillStyle = ['#5d9a3a', '#86b44a', '#c2b23e'][Math.floor(rnd() * 3)]; c.beginPath(); c.arc(x, 425 - rnd() * 8, 16, 0, 7); c.fill(); c.fillStyle = '#5a4020'; c.fillRect(x - 1, 430, 3, 14); }
      // 紅屋頂小屋、三棵柏樹、一排黃綠小樹、涼亭
      c.fillStyle = '#e0a347'; c.fillRect(1340, 410, 70, 34); c.fillStyle = '#b32f3a'; c.beginPath(); c.moveTo(1330, 412); c.lineTo(1350, 388); c.lineTo(1420, 388); c.lineTo(1420, 412); c.fill();
      c.fillStyle = '#6a3a1a'; c.fillRect(1362, 424, 12, 20);
      for (const x of [1470, 1505, 1540]) { c.fillStyle = '#2f7a3a'; c.beginPath(); c.ellipse(x, 400, 14, 50, 0, 0, 7); c.fill(); }
      for (let i = 0; i < 6; i++) { const x = 1620 + i * 45; c.fillStyle = '#b8a83e'; c.beginPath(); c.ellipse(x, 410, 10, 28, 0, 0, 7); c.fill(); c.fillStyle = '#6a4a20'; c.fillRect(x - 1, 434, 3, 10); }
      c.fillStyle = '#a7452a'; c.beginPath(); c.moveTo(1880, 412); c.lineTo(1905, 395); c.lineTo(1935, 412); c.fill(); c.fillRect(1886, 412, 5, 30); c.fillRect(1924, 412, 5, 30);
      // 前景草地、蜿蜒小路
      hill([0, 470, 600, 470, 1000, 480, 2048, 470], '#6db04a');
      c.strokeStyle = '#b07a44'; c.lineWidth = 22; c.lineCap = 'round'; c.beginPath(); c.moveTo(1560, 446); c.bezierCurveTo(1480, 470, 1590, 500, 1470, 545); c.stroke();   // 從小屋往下走到池塘邊
      // 池塘（左邊到中間、往右下延伸）
      c.fillStyle = '#9fcbe6'; c.beginPath(); c.moveTo(200, 520); c.bezierCurveTo(600, 490, 900, 500, 1150, 530); c.bezierCurveTo(1400, 560, 1700, 560, 2048, 570); c.lineTo(2048, h); c.lineTo(450, h); c.bezierCurveTo(350, 650, 250, 580, 200, 520); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; for (let i = 0; i < 26; i++) { const x = 400 + rnd() * 1600, y = 540 + rnd() * 190; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 50 + rnd() * 60, y); c.stroke(); }
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 5; c.beginPath(); c.moveTo(560, 505); c.bezierCurveTo(800, 495, 1000, 505, 1150, 530); c.stroke();   // 對岸的土
      for (const [x, y] of [[700, 620], [760, 655], [850, 640], [920, 670]]) { c.fillStyle = '#9a6a3a'; c.beginPath(); c.ellipse(x, y, 45, 12, 0, 0, 7); c.fill(); }   // 踏腳石
      for (const [x, s2] of [[1300, 1], [1480, 0.75]]) {                                // 石頭上的青蛙
        c.fillStyle = '#a99a6a'; c.beginPath(); c.ellipse(x, 720, 110 * s2, 45, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#2f9a45'; c.beginPath(); c.ellipse(x + 10 * s2, 668, 42 * s2, 30 * s2, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(x - 25 * s2, 650, 22 * s2, 18 * s2, 0, 0, 7); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x - 30 * s2, 668, 12 * s2, 10 * s2, 0, 0, 7); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.arc(x - 26 * s2, 642, 4 * s2, 0, 7); c.fill();
      }
      // 左邊：秋天的樹（橘紅樹葉）、靠著樹的兔子（紅毛衣、紫褲子）、穿吊帶褲的松鼠
      c.fillStyle = '#6db04a'; c.beginPath(); c.moveTo(0, 480); c.lineTo(250, 470); c.bezierCurveTo(320, 560, 420, 640, 520, h); c.lineTo(0, h); c.fill();
      c.fillStyle = '#7a5434'; c.beginPath(); c.moveTo(150, h); c.lineTo(185, 330); c.lineTo(215, 330); c.lineTo(240, h); c.fill(); c.fillRect(200, 290, 12, 60);
      c.strokeStyle = '#7a5434'; c.lineWidth = 12; c.beginPath(); c.moveTo(205, 380); c.lineTo(300, 290); c.stroke(); c.beginPath(); c.moveTo(200, 360); c.lineTo(120, 290); c.stroke();
      for (let i = 0; i < 260; i++) {
        const a = rnd() * 7, rr = Math.sqrt(rnd()) * 200, x = 220 + Math.cos(a) * rr * 1.2, y = 280 + Math.sin(a) * rr * 0.7;
        c.fillStyle = ['#c0582a', '#d98a2b', '#a8432a', '#e0a53a', '#8a3a24'][Math.floor(rnd() * 5)]; c.fillRect(x, y, 9, 7);
      }
      c.fillStyle = '#8a6a4a'; c.beginPath(); c.ellipse(260, 470, 16, 24, 0, 0, 7); c.fill(); c.fillRect(250, 430, 6, 26); c.fillRect(264, 428, 6, 26);   // 兔子頭、耳朵
      c.fillStyle = '#b8344a'; c.fillRect(242, 492, 40, 38); c.fillStyle = '#7a6aa8'; c.fillRect(244, 530, 36, 26);
      c.fillStyle = '#9a6a3a'; c.beginPath(); c.ellipse(420, 600, 16, 18, 0, 0, 7); c.fill(); c.fillRect(410, 574, 6, 14); c.fillRect(424, 574, 6, 14);   // 松鼠
      c.fillStyle = '#3a5aa8'; c.fillRect(406, 616, 28, 26); c.fillStyle = '#9a6a3a'; c.beginPath(); c.ellipse(385, 625, 22, 10, -0.4, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(420, 606, 6, 5, 0, 0, 7); c.fill();
      // 右邊：高高的樹（貼著牆角）
      c.fillStyle = '#4f8f4a'; c.beginPath(); c.ellipse(w - 70, 340, 70, 300, 0, 0, 7); c.fill();
      c.fillStyle = '#6a4a2a'; c.fillRect(w - 76, 560, 12, 190);
      // 蝴蝶、飛雁、飄落的葉子
      for (const [x, y, col] of [[1700, 478, '#f2cf3a'], [1820, 500, '#f0a43a']]) { c.fillStyle = col; c.beginPath(); c.ellipse(x - 10, y, 12, 8, 0.5, 0, 7); c.ellipse(x + 10, y, 12, 8, -0.5, 0, 7); c.fill(); }
      c.strokeStyle = '#333'; c.lineWidth = 3;
      for (const [x, y] of [[760, 250], [800, 265], [775, 285], [815, 300], [790, 320]]) { c.beginPath(); c.moveTo(x - 12, y); c.quadraticCurveTo(x - 5, y - 8, x, y); c.quadraticCurveTo(x + 5, y - 8, x + 12, y); c.stroke(); }
      for (let i = 0; i < 18; i++) {
        const x = 300 + rnd() * 1500, y = 300 + rnd() * 400, a = rnd() * 3;
        c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = '#c4622a'; c.beginPath(); c.ellipse(0, 0, 18, 10, 0, 0, 7); c.fill(); c.strokeStyle = '#7a3a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-18, 0); c.lineTo(18, 0); c.stroke(); c.restore();
      }
      // 詩：標題「秋天的信」、作者林武憲；詩句只畫成黑色毛筆字的筆畫
      c.fillStyle = '#1d1b1a'; c.font = '700 96px "Noto Serif TC", "Noto Sans TC", serif'; c.textBaseline = 'middle';
      c.fillText('秋 天 的 信', 640, 70);
      c.font = '700 34px "Noto Sans TC", sans-serif'; c.fillText('林武憲', 1860, 350);
      const lines = (x0, y0, n, len, size) => {
        for (let l = 0; l < n; l++) for (let k = 0; k < len[l % len.length]; k++) {
          const x = x0 + k * size * 1.05, y = y0 + l * size * 1.35;
          c.fillStyle = '#1d1b1a';
          for (let q = 0; q < 3; q++) c.fillRect(x + rnd() * size * 0.6, y - size * 0.4 + rnd() * size * 0.7, size * (0.2 + rnd() * 0.4), Math.max(3, size * 0.1));
          c.fillRect(x + size * 0.4 + rnd() * 4, y - size * 0.4, Math.max(3, size * 0.1), size * 0.8);
        }
      };
      lines(110, 100, 5, [8, 5, 4, 10, 4], 26);        // 左上角那段
      lines(540, 150, 3, [10, 10, 11], 40);            // 標題下面那段
      lines(1250, 120, 3, [8, 10, 10], 44);            // 右上那段
      // 下面三分之一：馬賽克小磁磚的格線
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5;
      for (let x = 0; x < w; x += 9) { c.beginPath(); c.moveTo(x, h * 0.66); c.lineTo(x, h); c.stroke(); }
      for (let y = h * 0.66; y < h; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    });
    // 牆面朝東（+x），貼在團輔室東牆外側；看的人面向西，左手邊是南（+z）＝畫面左邊
    wallPic(f3, tex, r.m.x2 + WALL_T / 2 + 0.02, f3.y + H / 2, (r.m.z1 + r.m.z2) / 2, W - 0.1, H, Math.PI / 2);
  }
  // ---- 1F 溪口情廊：「溪口 開學快樂」紙箱人像作品牆（依照片：學生用面紙盒做的方塊人像，疊在矮木台上） ----
  //   照片裡有學生名字，不放照片；人像都用程式重新畫（頭髮、眼睛、嘴巴、衣服隨機組合）
  {
    const COLS = 15, ROWS = 6, BWd = 0.26, BH = 0.3, BD = 0.22, CW = 112, CH = 128;
    const art = galleryArt(), xc = (art.x1 + art.x2) / 2, zw = mz(398) - WALL_T / 2, gy = f1.y, benchH = 0.38;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    // 頂排：左邊 3 個人像、粉紅「溪」「口」、紅底黃字「開學快樂」、右邊 6 個人像
    const top = [null, null, null, ['溪', '#f19ab0', '#22325e'], ['口', '#f19ab0', '#22325e'], ['開', '#d4202c', '#f6d32b'], ['學', '#d4202c', '#f6d32b'], ['快', '#d4202c', '#f6d32b'], ['樂', '#d4202c', '#f6d32b']];
    while (top.length < COLS) top.push(null);
    const atlas = photoTex(CW * COLS, CH * ROWS, (c) => {
      const face = (x, y, w, h) => {
        const skin = pick(['#f2b47c', '#efac72', '#f5c18e', '#eaa66c']);
        c.fillStyle = skin; c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x + w - 6, y, 6, h);                     // 紙箱側邊的陰影
        // 衣服（下面 22%）：領口、號碼、籃球、蝴蝶結
        const sy = y + h * 0.78, shirt = pick(['#ffffff', '#2a5aa8', '#d23a3a', '#7b4bb0', '#f2a7c0', '#1f2d4d', '#f1d14a', '#3aa0c8', '#3b3b3b']);
        c.fillStyle = shirt; c.fillRect(x, sy, w, h - (sy - y));
        const deco = rnd();
        if (deco < 0.25) { c.fillStyle = skin; c.beginPath(); c.moveTo(x + w / 2 - 12, sy); c.lineTo(x + w / 2, sy + 14); c.lineTo(x + w / 2 + 12, sy); c.fill(); }
        else if (deco < 0.4) { c.fillStyle = shirt === '#ffffff' ? '#d23a3a' : '#ffffff'; c.font = '900 20px sans-serif'; c.textAlign = 'center'; c.fillText(String(10 + Math.floor(rnd() * 25)), x + w / 2, sy + 22); }
        else if (deco < 0.52) { c.fillStyle = '#e8762b'; c.beginPath(); c.arc(x + w * 0.75, sy + 14, 9, 0, 7); c.fill(); c.strokeStyle = '#5a2a0a'; c.lineWidth = 1.5; c.stroke(); }
        else if (deco < 0.64) { c.fillStyle = pick(['#d21f3c', '#f2c02c', '#58b368']); c.beginPath(); c.moveTo(x + w / 2, sy + 6); c.lineTo(x + w / 2 - 12, sy); c.lineTo(x + w / 2 - 12, sy + 12); c.closePath(); c.moveTo(x + w / 2, sy + 6); c.lineTo(x + w / 2 + 12, sy); c.lineTo(x + w / 2 + 12, sy + 12); c.closePath(); c.fill(); }
        // 頭髮：上面一片＋瀏海（平的、刺刺的、旁分），有的有兩側長髮
        const hair = pick(['#1b1716', '#1b1716', '#1b1716', '#2b1d16', '#5a3a22']), hh = h * (0.18 + rnd() * 0.14);
        c.fillStyle = hair; c.fillRect(x, y, w, hh);
        const st = rnd();
        if (st < 0.35) for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x + i * w / 6, y + hh - 1); c.lineTo(x + (i + 0.5) * w / 6, y + hh + 10 + rnd() * 6); c.lineTo(x + (i + 1) * w / 6, y + hh - 1); c.fill(); }
        else if (st < 0.6) { c.beginPath(); c.moveTo(x, y + hh); c.lineTo(x + w * 0.65, y + hh); c.lineTo(x, y + hh + 18); c.fill(); }
        else if (st < 0.75) { c.fillRect(x, y, 12, h * 0.7); c.fillRect(x + w - 12, y, 12, h * 0.7); }
        // 眼睛：圓點、白眼珠、笑瞇瞇、> <、一條線、大圓眼
        const ey = y + hh + (h * 0.68 - hh) * 0.42, ex = [x + w * 0.3, x + w * 0.7], et = Math.floor(rnd() * 6);
        c.fillStyle = '#1b1716'; c.strokeStyle = '#1b1716'; c.lineWidth = 3; c.lineCap = 'round';
        for (const [k, cx2] of ex.entries()) {
          if (et === 0) { c.beginPath(); c.arc(cx2, ey, 4, 0, 7); c.fill(); }
          else if (et === 1) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx2, ey, 8, 10, 0, 0, 7); c.fill(); c.fillStyle = '#1b1716'; c.beginPath(); c.arc(cx2 + (k ? -2 : 2), ey + 2, 4.5, 0, 7); c.fill(); }
          else if (et === 2) { c.beginPath(); c.arc(cx2, ey + 3, 6, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
          else if (et === 3) { c.beginPath(); const d = k ? -1 : 1; c.moveTo(cx2 - 5 * d, ey - 5); c.lineTo(cx2 + 4 * d, ey); c.lineTo(cx2 - 5 * d, ey + 5); c.stroke(); }
          else if (et === 4) { c.beginPath(); c.moveTo(cx2 - 7, ey); c.lineTo(cx2 + 7, ey); c.stroke(); }
          else { c.fillStyle = '#fff'; c.beginPath(); c.arc(cx2, ey, 9, 0, 7); c.fill(); c.fillStyle = '#1b1716'; c.beginPath(); c.arc(cx2, ey, 6, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx2 - 2, ey - 2, 2, 0, 7); c.fill(); }
          c.fillStyle = '#1b1716';
        }
        if (rnd() < 0.5) { c.lineWidth = 3; for (const cx2 of ex) { c.beginPath(); c.moveTo(cx2 - 7, ey - 13); c.lineTo(cx2 + 7, ey - 14 + rnd() * 3); c.stroke(); } }   // 眉毛
        if (rnd() < 0.4) { c.fillStyle = 'rgba(240,110,120,.55)'; for (const cx2 of ex) { c.beginPath(); c.ellipse(cx2 + (cx2 < x + w / 2 ? -4 : 4), ey + 13, 7, 4, 0, 0, 7); c.fill(); } }   // 腮紅
        // 嘴巴：微笑、張大嘴、小圓嘴、一條線、吐舌頭
        const my = y + h * 0.66, mt = Math.floor(rnd() * 5);
        c.strokeStyle = '#8e2a2a'; c.fillStyle = '#c0392b'; c.lineWidth = 3;
        if (mt === 0) { c.beginPath(); c.arc(x + w / 2, my - 8, 10, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); }
        else if (mt === 1) { c.beginPath(); c.moveTo(x + w / 2 - 12, my - 6); c.lineTo(x + w / 2 + 12, my - 6); c.arc(x + w / 2, my - 6, 12, 0, Math.PI); c.fill(); }
        else if (mt === 2) { c.beginPath(); c.ellipse(x + w / 2, my - 4, 4, 5, 0, 0, 7); c.fill(); }
        else if (mt === 3) { c.beginPath(); c.moveTo(x + w / 2 - 8, my - 4); c.lineTo(x + w / 2 + 8, my - 4); c.stroke(); }
        else { c.beginPath(); c.arc(x + w / 2, my - 8, 9, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); c.fillStyle = '#f07a8a'; c.fillRect(x + w / 2 - 4, my - 1, 8, 7); }
      };
      for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
        const x = k * CW, y = r * CH, t = r === 0 && top[k];
        if (t) {                                                        // 標題字的紙箱
          c.fillStyle = t[1]; c.fillRect(x, y, CW, CH); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x + CW - 6, y, 6, CH);
          c.fillStyle = t[2]; c.font = '900 92px "Noto Sans TC", "Microsoft JhengHei", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(t[0], x + CW / 2, y + CH / 2 + 4); c.textBaseline = 'alphabetic';
        } else face(x, y, CW, CH);
      }
    });
    const kraft = new THREE.MeshLambertMaterial({ color: '#d9a066' }), hairTop = new THREE.MeshLambertMaterial({ color: '#1d1918' });
    const keep = Batch.collector; Batch.collector = f1.boxes;          // 木台和紙箱會擋路
    const b = new Batch(), fb = new Batch();
    const W = COLS * BWd;
    b.box(new THREE.MeshLambertMaterial({ color: '#b98a5a' }), W + 0.2, benchH, BD + 0.14, xc, gy + benchH / 2, zw - (BD + 0.14) / 2 - 0.02);   // 矮木台
    Batch.collector = keep;
    for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
      const rr = ROWS - 1 - r;                                          // r=0 是最上面那排；k=0 在看的人左手邊（+x）
      const x = xc + W / 2 - (k + 0.5) * BWd + (rnd() - 0.5) * 0.02, y = gy + benchH + rr * BH + BH / 2;
      const zc = zw - 0.04 - BD / 2 - rnd() * 0.04;
      b.box(r === 0 && top[k] ? new THREE.MeshLambertMaterial({ color: top[k][1] }) : kraft, BWd - 0.012, BH - 0.006, BD, x, y, zc);
      if (r === ROWS - 1 || (r > 0 && rnd() < 0.85)) b.box(hairTop, BWd - 0.02, 0.006, BD - 0.02, x, y + BH / 2, zc);   // 頂面的黑頭髮（看得到的上排才明顯）
      const g = new THREE.PlaneGeometry(BWd - 0.012, BH - 0.006), uv = g.attributes.uv;
      for (let i = 0; i < 4; i++) uv.setXY(i, (k + uv.getX(i)) / COLS, 1 - (r + 1 - uv.getY(i)) / ROWS);
      g.rotateY(Math.PI); g.translate(x, y, zc - BD / 2 - 0.002);
      fb.add(atlas, g);
    }
    b.build(f1.group); fb.build(f1.group, { cast: false });
    f1.boxes.push({ x1: xc - W / 2, x2: xc + W / 2, z1: zw - BD - 0.1, z2: zw, y1: gy, y2: gy + benchH + ROWS * BH });
  }
  // ---- 1F 溪口情廊：東端白色歐式門框＋XIKOU GALLERY；裡面木紋地磚、壁柱、黃色拱、軌道燈 ----
  {
    const xg = mx(1507), z1 = mz(330), z2 = mz(398), zc = (z1 + z2) / 2, gy = f1.y, CW = z2 - z1;
    const white = new THREE.MeshLambertMaterial({ color: '#f6f5f1' });
    const b = new Batch();
    // 門框：兩根壁柱、橫楣、上面招牌牆
    for (const zz of [z1 + 0.22, z2 - 0.22]) { b.box(white, 0.3, 2.2, 0.4, xg, gy + 1.1, zz); b.box(white, 0.36, 0.12, 0.46, xg, gy + 2.2, zz); }
    b.build(f1.group);
    const header = photoTex(1024, 256, (c, w, h) => {
      c.fillStyle = '#f6f5f1'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e6e4de'; c.fillRect(0, 196, w, 60);                                  // 橫楣
      c.fillStyle = '#d0cdc5'; for (let x0 = 20; x0 < w; x0 += 48) { c.beginPath(); c.arc(x0, 226, 9, 0, Math.PI * 2); c.fill(); c.fillRect(x0 + 14, 222, 18, 6); }
      c.fillStyle = '#ebe9e3'; c.fillRect(300, 20, 424, 26);                               // 上面的雕花飾板
      c.fillStyle = '#d6d3cb'; c.beginPath(); c.ellipse(512, 22, 46, 22, 0, Math.PI, 0); c.fill();
      c.strokeStyle = '#cfccc4'; c.lineWidth = 4; for (const sx of [-1, 1]) { c.beginPath(); c.arc(512 + sx * 70, 30, 18, 0, Math.PI * 2); c.stroke(); }
      const word = 'XIKOU GALLERY', cols = ['#c0392b', '#3a3a3a', '#9a9a9a'];
      c.font = '900 92px "Arial Black", Impact, sans-serif'; c.textBaseline = 'middle';
      let total = 0; const ws = [...word].map((ch) => { const m = c.measureText(ch).width + 4; total += m; return m; });
      let xx = (w - total) / 2;
      [...word].forEach((ch, i) => { c.fillStyle = cols[(i * 2 + (i > 5 ? 1 : 0)) % 3]; c.fillText(ch, xx, 120); c.fillStyle = 'rgba(246,245,241,.9)'; if (ch !== ' ') c.fillRect(xx, 116, ws[i] - 4, 5); xx += ws[i]; });   // 鏤空字（中間一道縫）
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, CW), [header, white, white, white, white, white]);
    head.position.set(xg, gy + 2.62, zc); f1.group.add(head);
    // 情廊木紋地磚
    const plank = photoTex(256, 256, (c, w, h) => {
      const cs = ['#8b7d6b', '#a49582', '#7a6d5e', '#958775', '#6f6354'];
      for (let r = 0; r < 16; r++) for (let k = -1; k < 3; k++) { c.fillStyle = cs[(r * 3 + k + 5) % cs.length]; c.fillRect(k * 128 + (r % 2) * 64, r * 16, 126, 15); }
    }, { repeat: [(xg - mx(705)) / 4, CW / 4] });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(xg - mx(705), CW), plank);
    fp.rotation.x = -Math.PI / 2; fp.position.set((mx(705) + xg) / 2, gy + 0.016, zc); fp.receiveShadow = true; f1.group.add(fp);
    // 壁柱＋天花板橫樑＋黃色拱（避開門口）、兩排軌道燈
    const doorsX = rooms.filter((r) => r.f === f1).flatMap((r) => (r.doorPts || []).filter((d) => d.z > z1 - 0.3 && d.z < z2 + 0.3).map((d) => d.x));
    const lb = new Batch(), beam = new THREE.MeshLambertMaterial({ color: '#8a8478' }), yellow = new THREE.MeshLambertMaterial({ color: '#e8d38a' });
    const rail = new THREE.MeshLambertMaterial({ color: '#2b2b2b' }), lamp = new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#ffd680', emissiveIntensity: 0.9 });
    const top = gy + WALL_H;
    for (let xx = mx(705) + GALLERY_PIL; xx < xg - 1; xx += GALLERY_PIL) {
      lb.box(beam, 0.3, 0.14, CW, xx, top - 0.07, zc);
      if (doorsX.some((dx) => Math.abs(dx - xx) < 1.1)) continue;
      for (const s of [1, -1]) {
        const zw = s > 0 ? z1 + WALL_T / 2 : z2 - WALL_T / 2;
        lb.box(white, 0.32, 2.3, 0.14, xx, gy + 1.15, zw + s * 0.07);
        for (let k = 0; k < 6; k++) {                                   // 黃色拱：從壁柱頂往天花板彎過去（方塊拼成弧線）
          const a = (k + 0.5) / 6 * Math.PI / 2, r = 0.62;
          lb.box(yellow, 0.1, 0.12, 0.12, xx, gy + 2.3 + Math.sin(a) * r * 0.9, zw + s * (0.07 + (1 - Math.cos(a)) * r));
        }
      }
    }
    for (const dz of [-0.85, 0.85]) {
      lb.box(rail, xg - mx(705) - 1, 0.03, 0.04, (mx(705) + xg) / 2, top - 0.02, zc + dz);
      for (let xx = mx(705) + 1.2; xx < xg - 0.5; xx += 1.6) { lb.box(rail, 0.08, 0.14, 0.08, xx, top - 0.1, zc + dz); lb.box(lamp, 0.07, 0.02, 0.07, xx, top - 0.18, zc + dz); }
    }
    lb.build(f1.group);
  }
  // ---- 2F 溪仔口捷運站（依 360 照片 15-1～3）：西端綠色站名牌「溪仔口站 XIZAIKOU STATION」（大眼睛標誌、黃色 2）；
  //   牆下半米黃小磁磚、窗戶上方淺綠；前半段窗下兩條長壁畫（北：河邊風景紅拱橋帆船、南：捷運路線圖）；
  //   東半段像捷運車廂：兩邊整排淺木色長椅、椅背上一格格圓角「車窗」畫框，北牆「文山區」地圖、南牆「臺北市捷運地圖」大壁畫、滅火器；
  //   天花板藍綠／黃綠拱形色帶、兩排軌道燈；地上中間紅褐色磨石子直線 ----
  {
    const f2 = floorById['2F'], gy = f2.y, xa = mx(705), xe = mx(1510), xm = (xa + xe) / 2, z1 = mz(330), z2 = mz(398), zc = (z1 + z2) / 2, CW = z2 - z1;
    const zn = z1 + WALL_T / 2 + 0.03, zs = z2 - WALL_T / 2 - 0.03, top = gy + WALL_H;
    const doorsX = (side) => rooms.filter((r) => r.f === f2).flatMap((r) => (r.doorPts || []).filter((d) => Math.abs(d.z - (side < 0 ? z1 : z2)) < 0.4).map((d) => d.x)).sort((p, q) => p - q);
    // [a, b] 這一段牆扣掉門口（門兩邊各留 g 公尺），回傳一段段
    const runs = (side, a, b, g = 0.85, min = 0.8) => { const out = []; let s0 = a;
      for (const d of doorsX(side)) { if (d < a - g || d > b + g) continue; if (d - g > s0 + min) out.push([s0, d - g]); s0 = Math.max(s0, d + g); }
      if (b > s0 + min) out.push([s0, b]); return out; };
    const L = (c) => new THREE.MeshLambertMaterial({ color: c });
    const b = new Batch();
    b.box(L('#a8705a'), xe - xa, 0.01, 0.3, (xa + xe) / 2, gy + 0.018, zc);                      // 地上紅褐色磨石子直線
    // 牆下半米黃小磁磚（貼在兩面牆上，門口空出來）
    const tile = photoTex(64, 64, (c, w, h) => tileGrid(c, w, h, '#e9d9a6', '#d2c08a', 8), { repeat: [1, 1] });
    for (const [side, zw, rot] of [[-1, zn, 0], [1, zs, Math.PI]]) for (const [a, c2] of runs(side, xa + 0.5, xe - 0.3, 0.6, 0.3)) {
      const m = tile.clone(); m.map = tile.map.clone(); m.map.repeat.set((c2 - a) / 0.5, 0.7 / 0.5); m.map.needsUpdate = true;
      wallPic(f2, m, (a + c2) / 2, gy + 0.35, zw, c2 - a, 0.7, rot);
    }
    // 天花板：藍綠／黃綠拱形色帶（橫過天花板、兩邊往下一小段）＋兩排軌道燈
    const teal = L('#3fb8b0'), lime = L('#c8dc5a'), rail = L('#e8e8e4'), lamp = new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#ffd680', emissiveIntensity: 0.9 });
    for (let x = xa + 1.5, k = 0; x < xe - 0.5; x += 3.2, k++) {
      const m = x > xm ? (k % 2 ? teal : lime) : lime;
      b.box(m, 0.35, 0.05, CW - 0.2, x, top - 0.03, zc);
      for (const zz of [zn + 0.03, zs - 0.03]) b.box(m, 0.35, 0.45, 0.04, x, top - 0.25, zz);
    }
    for (const dz of [-0.8, 0.8]) {
      b.box(rail, xe - xa - 1, 0.03, 0.04, (xa + xe) / 2, top - 0.02, zc + dz);
      for (let x = xa + 1.2; x < xe - 0.5; x += 2.2) { b.box(rail, 0.08, 0.14, 0.08, x, top - 0.1, zc + dz); b.box(lamp, 0.07, 0.02, 0.07, x, top - 0.18, zc + dz); }
    }
    // 東半段：兩邊整排淺木色長椅（避開門口）、椅背上的圓角車窗畫框
    const wood = L('#e9cf98'), woodDk = L('#d4b47a');
    const windowsTex = (k) => photoTex(512, 128, (c, w, h) => {
      c.fillStyle = '#efdcae'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 125, kk = (i + k) % 6;
        c.fillStyle = '#5a4a3a'; c.beginPath(); c.roundRect(x, 12, 110, 100, 16); c.fill();
        const g = c.createLinearGradient(0, 18, 0, 106); g.addColorStop(0, ['#8fd3f4', '#a8e0ff', '#bfe3c0', '#9fd0f0', '#ffe2a8', '#c8e6c9'][kk]); g.addColorStop(1, ['#7cc36a', '#e8c070', '#5a9a4a', '#4a8ac0', '#d8885a', '#7a9a6a'][kk]);
        c.fillStyle = g; c.beginPath(); c.roundRect(x + 6, 18, 98, 88, 12); c.fill();
        if (kk % 3 === 0) { for (const dx of [30, 70]) { c.fillStyle = '#f2c79a'; c.beginPath(); c.arc(x + dx, 60, 13, 0, 7); c.fill(); c.fillStyle = '#4a2a1a'; c.fillRect(x + dx - 13, 44, 26, 8); c.fillStyle = ['#e74c3c', '#3498db'][dx > 50 ? 1 : 0]; c.fillRect(x + dx - 11, 74, 22, 26); } }   // 卡通小朋友
        else if (kk % 3 === 1) { c.fillStyle = '#c0392b'; c.fillRect(x + 30, 50, 50, 40); c.fillStyle = '#7a2a1a'; c.beginPath(); c.moveTo(x + 24, 52); c.lineTo(x + 55, 30); c.lineTo(x + 86, 52); c.fill(); }   // 廟／建築
        else { c.fillStyle = '#6a8a5a'; c.beginPath(); c.moveTo(x + 6, 100); c.lineTo(x + 40, 40); c.lineTo(x + 70, 80); c.lineTo(x + 104, 50); c.lineTo(x + 104, 106); c.lineTo(x + 6, 106); c.fill(); }   // 山
      }
    });
    const keepC = Batch.collector; Batch.collector = f2.boxes;                 // 長椅、滅火器會擋路
    let wk = 0;
    for (const [side, zw] of [[-1, zn], [1, zs]]) for (const [a, c2] of runs(side, xm + 1.2, xe - 1.0)) {
      const zb = zw - side * 0.25, len = c2 - a;
      b.box(wood, len, 0.06, 0.5, (a + c2) / 2, gy + 0.42, zb - side * 0.05);                    // 座位
      b.box(woodDk, len, 0.4, 0.04, (a + c2) / 2, gy + 0.2, zb - side * 0.28);                   // 座位前緣
      for (let x = a + 0.05; x <= c2 - 0.04; x += Math.max(0.6, len / Math.ceil(len / 1.5))) b.box(woodDk, 0.04, 0.4, 0.5, x, gy + 0.2, zb - side * 0.05);   // 隔板
      b.box(wood, len, 0.75, 0.06, (a + c2) / 2, gy + 0.8, zw - side * 0.04);                    // 椅背
      for (let x = a; x < c2 - 0.5; x += 2.0) { const w = Math.min(2.0, c2 - x); wallPic(f2, windowsTex(wk++), x + w / 2, gy + 0.82, zw - side * 0.08, w - 0.05, 0.5, side < 0 ? 0 : Math.PI); }
    }
    // 滅火器（北牆，長椅開始的地方）
    b.box(L('#c62828'), 0.5, 0.12, 0.25, xm + 0.7, gy + 0.06, zn + 0.15);
    for (const dx of [-0.1, 0.1]) b.box(L('#d32f2f'), 0.15, 0.5, 0.15, xm + 0.7 + dx, gy + 0.37, zn + 0.15);
    Batch.collector = keepC;
    b.build(f2.group);
    // 前半段窗下的兩條長壁畫（北：河邊風景、南：捷運路線圖），門口斷開
    const river = photoTex(1024, 96, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe6fb'); g.addColorStop(0.55, '#e8f6ff'); g.addColorStop(0.56, '#4aa8de'); g.addColorStop(1, '#2a86c4'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7cc36a'; for (let x = 0; x < w; x += 140) { c.beginPath(); c.ellipse(x + 60, 54, 70, 22, 0, Math.PI, 0); c.fill(); }
      c.strokeStyle = '#d32f2f'; c.lineWidth = 6; for (const x0 of [200, 700]) { c.beginPath(); c.arc(x0, 70, 50, Math.PI, 0); c.stroke(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x0 + i * 20, 70); c.lineTo(x0 + i * 20, 70 - Math.sqrt(2500 - (i * 20) ** 2)); c.stroke(); } }
      c.fillStyle = '#ffffff'; for (const x0 of [420, 880]) { c.beginPath(); c.moveTo(x0, 70); c.lineTo(x0, 30); c.lineTo(x0 + 22, 70); c.fill(); c.fillStyle = '#e8762b'; c.fillRect(x0 - 14, 70, 40, 8); c.fillStyle = '#ffffff'; }
    });
    const route = photoTex(1024, 96, (c, w, h) => {
      c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, w, h);
      const cols = ['#e3002c', '#008659', '#f8b61c', '#0070bd', '#c48c31'];
      for (let i = 0; i < 3; i++) { c.fillStyle = cols[i]; c.fillRect(0, 34 + i * 10, w, 6); }
      for (let x = 30; x < w; x += 70) { c.fillStyle = '#ffffff'; c.strokeStyle = '#555'; c.lineWidth = 3; c.beginPath(); c.arc(x, 46, 9, 0, 7); c.fill(); c.stroke(); c.fillStyle = cols[(x / 70 | 0) % 5]; c.fillRect(x - 24, 12, 48, 14); c.fillStyle = '#7cc36a'; c.fillRect(x - 30, 76, 60, 10); }
    });
    for (const [side, zw, rot, m] of [[-1, zn, 0, river], [1, zs, Math.PI, route]]) for (const [a, c2] of runs(side, xa + 1.0, xm - 0.5)) wallPic(f2, m, (a + c2) / 2, gy + 0.88, zw - side * 0.005, c2 - a, 0.32, rot);
    // 東半段兩大面壁畫：北牆「文山區」（動物園、捷運列車）、南牆「臺北市捷運地圖」
    const wenshan = photoTex(640, 256, (c, w, h) => {
      c.fillStyle = '#9fd36a'; c.fillRect(0, 0, w, h); c.fillStyle = '#d8eef8'; c.fillRect(0, 0, w, 60);
      c.fillStyle = '#5fb04a'; c.beginPath(); c.moveTo(60, 230); c.quadraticCurveTo(160, 40, 360, 70); c.quadraticCurveTo(560, 90, 600, 230); c.fill();
      c.fillStyle = '#e74c3c'; c.font = '900 34px "Noto Sans TC", sans-serif'; c.fillText('文山區', 20, 44);
      c.fillStyle = '#f2c14e'; c.fillRect(400, 60, 16, 70); c.beginPath(); c.ellipse(430, 140, 40, 22, 0, 0, 7); c.fill();   // 長頸鹿
      c.fillStyle = '#9aa0a8'; c.beginPath(); c.ellipse(510, 150, 50, 32, 0, 0, 7); c.fill();                       // 大象
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(330, 120, 22, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(320, 114, 6, 0, 7); c.arc(340, 114, 6, 0, 7); c.fill();   // 熊貓
      c.fillStyle = '#d8a040'; c.beginPath(); c.arc(560, 200, 26, 0, 7); c.fill();                                // 獅子
      c.fillStyle = '#f4f4f0'; c.fillRect(30, 180, 140, 46); c.fillStyle = '#2a6ab8'; c.fillRect(30, 196, 140, 8); c.fillStyle = '#5a6a7a'; for (let i = 0; i < 4; i++) c.fillRect(42 + i * 32, 184, 22, 10);   // 捷運列車
      c.fillStyle = '#f7a8c0'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(220 + i * 18, 225 - (i % 2) * 10, 9, 0, 7); c.fill(); }   // 櫻花
    });
    const taipei = photoTex(640, 256, (c, w, h) => {
      c.fillStyle = '#e8f4d8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9fd36a'; c.beginPath(); c.moveTo(0, h); c.quadraticCurveTo(200, 150, 640, 210); c.lineTo(640, h); c.fill();
      c.fillStyle = '#c0392b'; c.font = '900 32px "Noto Sans TC", sans-serif'; c.fillText('臺北市', 20, 40); c.fillText('捷運地圖', 20, 78);
      c.strokeStyle = '#4aa8de'; c.lineWidth = 16; c.beginPath(); c.moveTo(200, 0); c.quadraticCurveTo(260, 120, 200, 256); c.stroke();   // 河
      const lines = [['#e3002c', [[220, 40], [330, 110], [460, 120], [600, 60]]], ['#008659', [[260, 230], [340, 140], [470, 90], [560, 20]]], ['#f8b61c', [[300, 20], [380, 130], [420, 240]]], ['#0070bd', [[230, 130], [400, 160], [620, 150]]], ['#c48c31', [[330, 60], [430, 60], [500, 200]]]];
      for (const [col, pts] of lines) { c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
      c.fillStyle = '#5a6a7a'; c.fillRect(540, 70, 14, 110); c.fillStyle = '#3a8a5a'; for (let i = 0; i < 6; i++) c.fillRect(536, 70 + i * 18, 22, 6);   // 101
      c.fillStyle = '#ffffff'; c.fillRect(80, 170, 60, 40); c.fillStyle = '#2a4aa8'; c.beginPath(); c.moveTo(70, 172); c.lineTo(110, 140); c.lineTo(150, 172); c.fill();   // 中正紀念堂
      c.fillStyle = '#e8344a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(30 + i * 30, 230, 12, 0, 7); c.fill(); }   // 花
    });
    for (const [side, zw, rot, m] of [[-1, zn, 0, wenshan], [1, zs, Math.PI, taipei]]) {
      const seg = runs(side, xm - 3.6, xm + 1.0, 0.9, 2.0)[0];
      if (seg) wallPic(f2, m, (seg[0] + seg[1]) / 2, gy + 1.7, zw - side * 0.006, Math.min(3.6, seg[1] - seg[0]), 1.45, rot);
    }
    // 西端站名牌（面向西）：綠底「溪仔口站 XIZAIKOU STATION」＋大眼睛標誌＋右上黃色「2」
    const sign = photoTex(1024, 200, (c, w, h) => {
      c.fillStyle = '#1f7a5a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f5d020'; c.beginPath(); c.moveTo(w - 170, 0); c.lineTo(w, 0); c.lineTo(w, h); c.closePath(); c.fill();
      c.fillStyle = '#1f3a2a'; c.font = '900 120px Arial, sans-serif'; c.textAlign = 'center'; c.fillText('2', w - 60, h - 30);
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(150, 100, 70, 56, 0, 0, 7); c.fill(); c.fillStyle = '#e8762b'; c.beginPath(); c.arc(170, 100, 34, 0, 7); c.fill(); c.fillStyle = '#1d1d1d'; c.beginPath(); c.arc(176, 100, 18, 0, 7); c.fill();   // 大眼睛
      c.fillStyle = '#ffffff'; c.font = '900 92px "Noto Sans TC", "Microsoft JhengHei", sans-serif'; c.fillText('溪仔口站', 500, 108);
      c.font = '700 36px Arial, sans-serif'; c.fillText('XIZAIKOU STATION', 500, 165);
    });
    wallPic(f2, sign, xa - 0.05, top - 0.38, zc, CW, 0.72, -Math.PI / 2);
    { const sb = new Batch(); sb.box(L('#1f7a5a'), 0.06, 0.72, CW, xa - 0.01, top - 0.38, zc); sb.build(f2.group); }   // 站名牌背面
  }
  // ---- 3F 溪口光廊（依 360 照片 20-1～3）：西端綠色門框「Xi-Kou Optics Hallway」＋創作大師／自造基地、門口白色斑馬紋；
  //   門框外兩面牆：北邊藍色彩虹看板、南邊橘色看板（地上彩色圓點）；進去是五道紫色拱門隧道（兩側銀灰色鏡牆、腳架）；
  //   再往東是長走廊：天花板黃色燈槽和藍色發光板交錯、北牆「生活的藝術」＋馬賽克畫作、滅火器；南牆木紋波浪板＋大電視、小展示框；
  //   地上中間一條紅褐色磨石子直線；東端圓形色塊 ----
  {
    const f3 = floorById['3F'], gy = f3.y, xa = mx(705), xe = mx(1510), z1 = mz(330), z2 = mz(398), zc = (z1 + z2) / 2, CW = z2 - z1;
    const zn = z1 + WALL_T / 2 + 0.03, zs = z2 - WALL_T / 2 - 0.03, top = gy + WALL_H;
    const doorsX = (side) => rooms.filter((r) => r.f === f3).flatMap((r) => (r.doorPts || []).filter((d) => Math.abs(d.z - (side < 0 ? z1 : z2)) < 0.4).map((d) => d.x));
    const freeAt = (side, x, half) => doorsX(side).every((d) => Math.abs(d - x) > half + 0.7);
    const L = (c) => new THREE.MeshLambertMaterial({ color: c });
    const glow = (c, e, k = 0.8) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: k });
    const b = new Batch();
    // 地上：中間紅褐色磨石子直線、門口白色斑馬紋
    b.box(L('#a8705a'), xe - xa, 0.01, 0.3, (xa + xe) / 2, gy + 0.018, zc);
    for (let k = 0; k < 5; k++) b.box(L('#f4f4f0'), 0.5, 0.012, 0.4, xa + 0.6, gy + 0.02, z1 + 0.5 + k * (CW - 1) / 4);
    // 門框外（A_west 走廊）南邊地上的彩色圓點
    for (let k = 0; k < 10; k++) b.box(L(['#e53935', '#1e88e5', '#fdd835', '#43a047'][k % 4]), 0.18, 0.01, 0.18, xa - 0.4 - (k % 3) * 0.55, gy + 0.02, z2 + 0.6 + Math.floor(k / 3) * 0.7);
    // 綠色門框：兩根柱子＋上面厚厚的橫楣
    const green = L('#1f9a6a');
    for (const zz of [z1 + 0.3, z2 - 0.3]) b.box(green, 0.45, WALL_H, 0.6, xa + 0.22, gy + WALL_H / 2, zz);
    b.box(green, 0.45, 0.6, CW, xa + 0.22, top - 0.3, zc);
    // 紫色拱門隧道：五道，兩側銀灰色鏡牆、腳架
    const tunnel0 = xa + 1.6, tunnel1 = xa + 5.4;
    const mirror = L('#c3c8cf');
    for (const [side, zw] of [[-1, zn], [1, zs]]) {
      if (freeAt(side, (tunnel0 + tunnel1) / 2, (tunnel1 - tunnel0) / 2 - 0.6)) b.box(mirror, tunnel1 - tunnel0, 2.2, 0.03, (tunnel0 + tunnel1) / 2, gy + 0.35 + 1.1, zw - side * 0.02);
      const tx = tunnel0 + 1.0, tz = zw - side * 0.5;
      b.box(L('#222222'), 0.03, 1.3, 0.03, tx, gy + 0.65, tz); b.box(L('#222222'), 0.12, 0.1, 0.1, tx, gy + 1.35, tz);
      for (const [dx, dz] of [[-0.18, 0], [0.12, 0.14], [0.12, -0.14]]) b.box(L('#222222'), 0.02, 0.02, 0.02, tx + dx, gy + 0.01, tz + dz);
    }
    b.build(f3.group);
    const archGeo = (w, h, ow, oh) => {
      const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
      const hole = new THREE.Path(); hole.moveTo(-ow / 2, 0); hole.lineTo(-ow / 2, oh - ow / 2); hole.absarc(0, oh - ow / 2, ow / 2, Math.PI, 0, true); hole.lineTo(ow / 2, 0); hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false }); g.rotateY(Math.PI / 2);
      return g;
    };
    for (let k = 0; k < 5; k++) {
      const t = k / 4, m = L(['#b7a9e0', '#a99ad6', '#9d8ccc', '#a99ad6', '#b7a9e0'][k]);
      const a = new THREE.Mesh(archGeo(CW - 0.25, WALL_H - 0.05, 2.1 - Math.abs(t - 0.5) * 0.4, 2.6 - Math.abs(t - 0.5) * 0.3), m);
      a.position.set(tunnel0 + t * (tunnel1 - tunnel0) - 0.11, gy, zc); a.castShadow = true; f3.group.add(a);
    }
    // 長走廊天花板：黃色燈槽和藍色發光板交錯
    const lb = new Batch(), yel = glow('#ffd84a', '#f2c200', 0.7), blu = glow('#2fa8e8', '#1a8fd8', 0.8);
    for (let x = tunnel1 + 0.4; x < xe - 1.2; x += 2.4) {
      lb.box(yel, 0.6, 0.1, CW - 0.2, x + 0.3, top - 0.06, zc);
      lb.box(blu, 1.7, 0.04, CW - 1.4, x + 1.5, top - 0.03, zc);
      lb.box(yel, 1.7, 0.18, 0.5, x + 1.5, top - 0.1, z1 + 0.35); lb.box(yel, 1.7, 0.18, 0.5, x + 1.5, top - 0.1, z2 - 0.35);
    }
    // 北牆滅火器
    const fx = tunnel1 + 1.0;
    lb.box(L('#d32f2f'), 0.16, 0.45, 0.16, fx, gy + 0.32, zn + 0.1); lb.box(L('#c62828'), 0.3, 0.1, 0.3, fx, gy + 0.05, zn + 0.16);
    lb.build(f3.group);
    // 門框招牌：綠底金色英文草寫字；兩根柱子的直式字
    const sign = photoTex(1024, 160, (c, w, h) => {
      c.fillStyle = '#1f9a6a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2c94c'; c.font = 'italic 700 74px "Brush Script MT", "Segoe Script", cursive'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('Xi-Kou Optics Hallway', w / 2, h / 2 + 4);
    });
    wallPic(f3, sign, xa - 0.005, top - 0.3, zc, CW, 0.6, -Math.PI / 2);
    const vert = (txt, col, bg) => photoTex(128, 512, (c, w, h) => {
      c.fillStyle = bg; c.fillRect(0, 0, w, h);
      c.fillStyle = col; c.font = '900 96px "Noto Sans TC", "Microsoft JhengHei", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      [...txt].forEach((ch, i) => c.fillText(ch, w / 2, 64 + i * 122));
    });
    wallPic(f3, vert('創作大師', '#e8344a', '#1f9a6a'), xa - 0.005, gy + 1.7, z1 + 0.3, 0.5, 2.0, -Math.PI / 2);
    wallPic(f3, vert('自造基地', '#2a3a8a', '#ffffff'), xa + 0.7, gy + 1.6, zs, 0.45, 1.8, Math.PI);
    // 門框外兩面牆的看板（面向西）
    const rainbow = photoTex(512, 160, (c, w, h) => {
      c.fillStyle = '#3aa0d8'; c.fillRect(0, 0, w, h);
      ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 8; c.beginPath(); c.moveTo(20, 120 - i * 9); c.quadraticCurveTo(w / 2, 10 - i * 4, w - 20, 60 - i * 9); c.stroke(); });
      for (let i = 0; i < 10; i++) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(40 + i * 48, 128, 14, 0, 7); c.fill(); }
    });
    wallPic(f3, rainbow, xa - WALL_T / 2 - 0.03, gy + 1.7, z1 - 1.9, 3.2, 1.0, -Math.PI / 2);
    const orange = photoTex(512, 200, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#f39c12'); g.addColorStop(0.6, '#f5d020'); g.addColorStop(1, '#6abf69'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { c.fillStyle = '#fffdf6'; c.beginPath(); c.arc(70 + i * 75, 100 + (i % 2) * 30, 30, 0, 7); c.fill(); c.fillStyle = ['#e57373', '#81c784', '#ffb74d'][i % 3]; c.fillRect(56 + i * 75, 88 + (i % 2) * 30, 28, 22); }
    });
    wallPic(f3, orange, xa - WALL_T / 2 - 0.03, gy + 1.6, z2 + 1.9, 3.2, 1.25, -Math.PI / 2);
    // 北牆：「生活的藝術」＋一排學生的馬賽克畫作（避開門口）
    const art = photoTex(512, 128, (c, w, h) => { c.fillStyle = '#4a3a6a'; c.font = '900 92px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('生活的藝術', w / 2, h / 2); }, { alpha: true });
    const mosaic = (k) => photoTex(128, 160, (c, w, h) => {
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { c.fillStyle = ['#f4d03f', '#e67e22', '#3498db', '#27ae60', '#e74c3c', '#9b59b6', '#ecf0f1'][(x * 7 + y * 3 + k * 5 + ((x * y) >> 5)) % 7]; c.fillRect(x + 1, y + 1, 14, 14); }
    });
    let ax = tunnel1 + 2.0;
    // 窗戶下面那段牆（窗台以下）才貼得下
    if (freeAt(-1, ax + 0.8, 0.9)) wallPic(f3, art, ax + 0.8, gy + 0.72, zn, 1.8, 0.45, 0);
    for (let k = 0, x = ax + 2.3; k < 8 && x < xe - 1; x += 0.95) { if (!freeAt(-1, x, 0.4)) continue; wallPic(f3, mosaic(k), x, gy + 0.62, zn, 0.6, 0.6, 0); k++; }
    // 南牆：木紋波浪板（避開門口一段段）＋大電視、小展示框
    const wave = photoTex(512, 160, (c, w, h) => {
      c.fillStyle = '#b8743a'; c.beginPath(); c.moveTo(0, 30); for (let x = 0; x <= w; x += 16) c.lineTo(x, 18 + Math.sin(x / 120) * 7);
      for (let x = w; x >= 0; x -= 16) c.lineTo(x, 142 + Math.sin(x / 120 + 1) * 7); c.closePath(); c.fill();
      c.fillStyle = 'rgba(90,50,20,.18)'; for (let y = 30; y < 140; y += 6) c.fillRect(0, y, w, 1);
    }, { alpha: true });
    const segs = [], dz = doorsX(1).sort((p, q) => p - q);
    let s0 = tunnel1 + 1.0;
    for (const d of dz) { if (d < s0 - 0.8) continue; if (d - 0.9 > s0 + 1.5) segs.push([s0, d - 0.9]); s0 = Math.max(s0, d + 0.9); }
    if (xe - 0.8 > s0 + 1.5) segs.push([s0, xe - 0.8]);
    const tb = new Batch();
    segs.forEach(([a, c2], i) => {
      wallPic(f3, wave, (a + c2) / 2, gy + 1.5, zs, c2 - a, 1.6, Math.PI);
      if (i === 0) { const tx = a + Math.min(2.2, (c2 - a) / 2); tb.box(L('#111111'), 1.9, 1.1, 0.08, tx, gy + 1.45, zs - 0.05); tb.box(glow('#1d2a3a', '#0a1420', 0.3), 1.8, 1.0, 0.01, tx, gy + 1.45, zs - 0.095); }
      for (let x = a + 0.6; x < c2 - 0.4; x += 2.6) if (i > 0 || x > a + 3.6) tb.box(L('#f4f4f0'), 0.4, 0.5, 0.03, x, gy + 1.5, zs - 0.03);
    });
    tb.build(f3.group);
    // 東端：圓形色塊（看不清楚是什麼，先做色塊；那裡沒有牆，用兩條細線吊在天花板下）
    { const wb = new Batch(); for (const d of [-0.25, 0.25]) wb.box(L('#555555'), 0.01, 0.3, 0.01, xe - 0.3, top - 0.15, zc + d); wb.build(f3.group); }
    wallPic(f3, photoTex(128, 128, (c, w, h) => { c.fillStyle = '#7fb8a8'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.fillStyle = '#c8e6dc'; c.beginPath(); c.arc(64, 64, 40, 0, 7); c.fill(); }, { alpha: true }), xe - 0.3, top - 0.7, zc, 0.8, 0.8, -Math.PI / 2);
  }
}
for (const f of floors) buildFloor(f);
buildPhotoScenes();
buildPlinth();
Batch.collector = floors[1].boxes;
buildOutdoor();
placeToys();
// buildBaseballField();   // 樂樂棒球先保留：校長回穿堂，球場也先不畫
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
window.__campus = { NPCS, movePlacesNPC, shuttle, rooms, floors, player, nav, navigateTo, placeAt, cat, viewer, panoScenes, openPano, setMode, findPath, camera, orbit, keys, auto, walkTo, stairs, climbStairs, cam, camBlocked, act, SPOTS, doAction,
  step: (sec) => { for (let t = 0; t < sec; t += 1 / 30) update(1 / 30); renderer.render(scene, camera); } };
