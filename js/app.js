import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PanoViewer } from './pano.js?v=13';
import { furnishFloor } from './furniture.js?v=13';
import { BLOCKY, STYLE, setStyle, mat, blockBox, Batch, makeBlockPerson, animatePerson, addBlockTree, makeClouds } from './blocks.js?v=13';

/* =========================================================
 * 溪口國小 3D 校園
 * 資料在 campus-data.js；這裡負責建模、走動、樓梯、搜尋與導航
 * ========================================================= */

const D = window.CAMPUS;
const S = D.PX_PER_M, [OX, OY] = D.ORIGIN;
const FLOOR_H = 3.6, WALL_H = 3.0, RAIL_H = 1.1, WALL_T = BLOCKY ? 0.3 : 0.16;
const LABEL_FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
const CEIL_T = FLOOR_H - WALL_H - 0.3;      // 天花板厚度：牆頂到上一層地板底
const PLAYER_R = 0.28, EYE_H = 1.45;
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
  ...f, idx, y: f.level * FLOOR_H, rooms: [], walk: [], segs: [], stairs: [],
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

/* ---------------- 牆與欄杆 ---------------- */

function lighten(hex, amt) {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color('#ffffff'), amt);
}

function addRoomWalls(room) {
  if (room.open) return;
  const f = room.f, { x1, z1, x2, z2 } = room.m;
  const doors = room.doors || '';
  const color = room.building ? lighten(D.buildings[room.building].color, 0.35) : new THREE.Color('#dddddd');
  const side = (s, ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    let gaps = [];
    if (doors.includes(s)) {
      const at = room.doorAt?.[s] || (len > 6.5 ? [0.18, 0.82] : [0.5]);
      const w = Math.min(1.6, len * 0.45);
      gaps = at.map((c) => [Math.max(0.15, c * len - w / 2), Math.min(len - 0.15, c * len + w / 2)]);
    }
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    // 記下門的位置（掛門牌用）
    for (const [a, b] of gaps) (room.doorPts ||= []).push({ x: ax + ux * (a + b) / 2, z: az + uz * (a + b) / 2, side: s });
    // 挑高的空間（活動中心）：牆一路蓋到上一層的天花板
    const h = room.tall ? FLOOR_H + WALL_H : WALL_H;
    const above = room.tall ? floors[f.idx + 1] : null;
    const seg = (a, b, extra) => ({ ax: ax + ux * a, az: az + uz * a, bx: ax + ux * b, bz: az + uz * b, h, color, kind: 'wall', bld: room.building, ...extra });
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
for (const f of floors) addRailings(f);

// 戶外的牆：校門兩側的樹籬、操場南邊那棟建築（都會擋路，也會被導航避開）
{
  const O = D.outdoor, f1 = floorById['1F'];
  if (O.gate) {
    const x = mx(O.gate.x), color = new THREE.Color('#3f8f3a');
    f1.segs.push({ ax: x, az: mz(540), bx: x, bz: mz(O.gate.y1) - 0.7, h: 1.5, color, kind: 'hedge' });
    f1.segs.push({ ax: x, az: mz(O.gate.y2) + 0.7, bx: x, bz: mz(1110), h: 1.5, color, kind: 'hedge' });
  }
  if (O.pool) {
    const m = rectM(O.pool), color = new THREE.Color('#dddddd'), h = 6;
    for (const [ax, az, bx, bz] of [[m.x1, m.z1, m.x2, m.z1], [m.x1, m.z2, m.x2, m.z2], [m.x1, m.z1, m.x1, m.z2], [m.x2, m.z1, m.x2, m.z2]]) {
      f1.segs.push({ ax, az, bx, bz, h, color, kind: 'wall', bld: null });
    }
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
const groundGeo = new THREE.PlaneGeometry(600, 600);
if (BLOCKY) { const uv = groundGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 600, uv.getY(i) * 600); }
const ground = new THREE.Mesh(groundGeo, mat('grass', BLOCKY ? '#ffffff' : '#a7cf8c'));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

// 樹（裝飾）
const treeSpots = [
  ...[[800, 650], [1000, 640], [1400, 660], [790, 980], [1420, 990], [1180, 1000]].map(([x, y], i) => [x, y, 1 + (i % 3) * 0.2]),
  ...[[380, 300], [220, 980], [1850, 400], [1850, 900], [250, 1500], [1960, 1500], [220, 1900], [1980, 2000], [850, 2120]].map(([x, y]) => [x, y, 1.4]),
];
if (BLOCKY) {
  const tb = new Batch();
  for (const [x, y, s] of treeSpots) addBlockTree(tb, Math.round(mx(x)) + 0.5, Math.round(mz(y)) + 0.5, s);
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
    const cx = mx(O.track.center[0]), cz = mz(O.track.center[1]);
    const a = O.track.size[0] / S / 2, b = O.track.size[1] / S / 2, lane = 6;
    const outer = new THREE.Shape(); outer.absellipse(0, 0, a, b, 0, Math.PI * 2);
    const hole = new THREE.Path(); hole.absellipse(0, 0, a - lane, b - lane, 0, Math.PI * 2, true);
    outer.holes.push(hole);
    flat(new THREE.ShapeGeometry(outer, 64), BLOCKY ? '#ffffff' : '#93414b', 0.02, 'track').position.set(cx, 0.02, cz);
    const inner = new THREE.Shape(); inner.absellipse(0, 0, a - lane, b - lane, 0, Math.PI * 2);
    flat(new THREE.ShapeGeometry(inner, 64), BLOCKY ? '#ffffff' : '#7cbf5a', 0.03, 'grass').position.set(cx, 0.03, cz);
    // 中間的籃球場
    const [kw, kh] = O.track.court || [0.55, 0.8];
    const cw = (a - lane) * 2 * kw, ch = (b - lane) * 2 * kh;
    const court = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshLambertMaterial({ map: courtTexture() }));
    court.rotation.x = -Math.PI / 2; court.position.set(cx, 0.04, cz); court.receiveShadow = true;
    g.add(court);
    floors[1].labels.add(makeLabel('操場', est, cx, 3, cz, { bg: '#2d6a4f', h: 1.6 }));
  }
  if (O.pool) {
    // 條紋屋頂建築（牆已經在資料階段加進碰撞），這裡蓋屋頂
    const m = rectM(O.pool);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(m.x2 - m.x1, 0.4, m.z2 - m.z1), new THREE.MeshLambertMaterial({ map: stripeRoofTexture(m.x2 - m.x1) }));
    roof.position.set((m.x1 + m.x2) / 2, 6.2, (m.z1 + m.z2) / 2);
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    floors[1].labels.add(makeLabel('游泳池', '', (m.x1 + m.x2) / 2, 8.5, (m.z1 + m.z2) / 2, { bg: '#2f6fb5', h: 1.4 }));
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
    floors[1].labels.add(makeLabel('正門', '溪口國小', gx - 1, 6.2, zc, { bg: '#c2410c', h: 1.2 }));
  }
  if (O.tower) {
    // 正門左邊那座有圓窗的圓柱塔
    const T = O.tower, r = T.r / S, h = T.floors * FLOOR_H;
    const geo = new THREE.CylinderGeometry(r, r, h, BLOCKY ? 16 : 32, 1, true, Math.PI, Math.PI);
    if (BLOCKY) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * r, uv.getY(i) * h); }
    const cyl = new THREE.Mesh(geo, mat('concrete', '#efe0bf', { side: THREE.DoubleSide }));
    cyl.position.set(mx(T.cx), h / 2, mz(T.cy));
    cyl.castShadow = cyl.receiveShadow = true;
    g.add(cyl);
    for (let k = 1; k < T.floors; k++) {         // 圓窗
      const win = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), new THREE.MeshLambertMaterial({ color: '#41566b' }));
      win.rotation.z = Math.PI / 2;
      win.position.set(mx(T.cx) - r - 0.02, k * FLOOR_H + 1.6, mz(T.cy));
      g.add(win);
    }
  }
  if (O.stage) {
    const m = rectM(O.stage);
    const st = new THREE.Mesh(blockBox(m.x2 - m.x1, 1.2, m.z2 - m.z1), mat('brick', '#f0dcc0'));
    st.position.set((m.x1 + m.x2) / 2, 0.6, (m.z1 + m.z2) / 2);
    st.castShadow = st.receiveShadow = true;
    g.add(st);
    floors[1].labels.add(makeLabel('司令臺', est, (m.x1 + m.x2) / 2, 3, (m.z1 + m.z2) / 2, { bg: '#2d6a4f', h: 1.2 }));
  }
  if (O.playground) {
    const m = rectM(O.playground);
    flat(tiled(m.x2 - m.x1, m.z2 - m.z1), '#3d5a80', 0.02, 'wool').position.set((m.x1 + m.x2) / 2, 0.02, (m.z1 + m.z2) / 2);
    const colors = ['#ef476f', '#ffd166', '#06d6a0'];
    for (let i = 0; i < 3; i++) {
      const h = 1 + i;
      const post = new THREE.Mesh(blockBox(1, h, 1), mat('wool', colors[i]));
      post.position.set(m.x1 + (i + 1) * (m.x2 - m.x1) / 4, h / 2, (m.z1 + m.z2) / 2);
      post.castShadow = true;
      g.add(post);
    }
    floors[1].labels.add(makeLabel('遊戲場', est, (m.x1 + m.x2) / 2, 3.5, (m.z1 + m.z2) / 2, { bg: '#2d6a4f', h: 1.2 }));
  }
}

function courtTexture() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 560;
  const c = cv.getContext('2d');
  c.fillStyle = '#3f8f86'; c.fillRect(0, 0, 1024, 560);
  c.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 500; i++) c.fillRect(Math.random() * 1024, Math.random() * 560, 4, 4);
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 6;
  c.strokeRect(30, 30, 964, 500);
  c.beginPath(); c.moveTo(512, 30); c.lineTo(512, 530); c.stroke();
  c.beginPath(); c.arc(512, 280, 70, 0, Math.PI * 2); c.stroke();
  for (const side of [0, 1]) {
    const x0 = side ? 994 : 30, dir = side ? -1 : 1;
    c.strokeRect(side ? x0 - 200 : x0, 200, 200, 160);                 // 禁區
    c.beginPath(); c.arc(x0 + dir * 200, 280, 70, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x0 + dir * 50, 280, 230, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2, false); c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
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

const FLOOR_TEX = { class: 'planks', hall: 'planks', storage: 'planks', stair: 'planks', garden: 'grass', kinder: 'wool' };
function floorMat(type, f, room) {
  if (type === 'garden' && f?.level === 4) {
    if (room?.building === 'A') return mat('roof', BLOCKY ? ROOF_COLOR.A : '#c9c9c9');   // 敬業樓藍色屋頂
    return mat('tile', '#cfc8ba');                                                        // 其他頂樓：地磚
  }
  const kind = FLOOR_TEX[type] || 'tile';
  const color = BLOCKY && kind === 'grass' ? '#ffffff' : (TYPE_COLORS[type] || '#eeeeee');
  return mat(kind, color);
}
// 頂樓菜園：一排排木頭菜箱，上面是土和菜
function addPlanters(f, m) {
  const b = new Batch();
  const wood = mat('planks', '#b98b5a'), soil = mat('wool', '#5b3f2a'), crop = mat('leaves');
  const cols = Math.max(1, Math.floor((m.x2 - m.x1 - 1) / 2.2));
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < cols; i++) {
    const x = m.x1 + 1.3 + i * 2.2;
    for (let z = m.z1 + 1.2; z + 3.5 < m.z2 - 0.8; z += 4.6) {
      b.box(wood, 1.1, 0.45, 3.6, x, f.y + 0.225, z + 1.8);
      b.box(soil, 0.9, 0.05, 3.4, x, f.y + 0.47, z + 1.8);
      for (let k = 0; k < 6; k++) {
        const s = 0.25 + rnd() * 0.2;
        b.box(crop, s, s, s, x - 0.2 + (k % 2) * 0.4, f.y + 0.5 + s / 2, z + 0.4 + Math.floor(k / 2) * 1.3);
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

function buildFloor(f) {
  for (const w of f.walk) {
    if (w.kind === 'outdoor') continue;
    const type = w.kind === 'room' ? w.room.type : w.kind;
    const { x1, z1, x2, z2 } = w.m;
    const thick = f.level === 0 ? 0.12 : 0.3;
    const slab = new THREE.Mesh(blockBox(x2 - x1, thick, z2 - z1), floorMat(type, f, w.room));
    slab.position.set((x1 + x2) / 2, f.y - thick / 2 + 0.01, (z1 + z2) / 2);
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
    const { x1, z1, x2, z2 } = w.m, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const covered = above && above.walk.some((a) => a.kind !== 'outdoor' && inRect(a.m, cx, cz));
    const bld = w.room?.building;
    const m = covered ? mat('concrete', '#f4f2ec') : mat('roof', BLOCKY ? (ROOF_COLOR[bld] || '#d8d8d2') : '#c9c9c9');
    ceilBatch.box(m, x2 - x1, CEIL_T, z2 - z1, cx, f.y + WALL_H + CEIL_T / 2, cz);
  }
  // 下一層的挑高空間（活動中心）：屋頂蓋在這一層的高度（放在這層的天花板群組，鳥瞰選這層時會拿掉，才看得到看台）
  for (const r of floors[f.idx - 1]?.rooms || []) {
    if (!r.tall) continue;
    const { x1, z1, x2, z2 } = r.m;
    ceilBatch.box(mat('roof', BLOCKY ? (ROOF_COLOR[r.building] || '#d8d8d2') : '#c9c9c9'),
      x2 - x1 + WALL_T, CEIL_T, z2 - z1 + WALL_T, (x1 + x2) / 2, f.y + WALL_H + CEIL_T / 2, (z1 + z2) / 2);
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
    const piece = (m, y0, y1, a = -len / 2, b = len / 2) => {
      const mid = (a + b) / 2, L = b - a;
      if (horiz) batch.box(m, L, y1 - y0, WALL_T, cx + mid, f.y + (y0 + y1) / 2, cz);
      else batch.box(m, WALL_T, y1 - y0, L, cx, f.y + (y0 + y1) / 2, cz + mid);
    };
    if (s.kind === 'rail') { piece(railMat, 0, s.h); continue; }
    if (s.kind === 'hedge') { piece(mat('leaves'), 0, s.h); continue; }
    const wm = wallMat(s.bld);
    if (s.overhead) { piece(wm, s.y0, s.h); continue; }   // 門楣
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
  // 樓梯（裝飾用的階梯）
  for (const s of f.stairs) {
    const nextIdx = s.floors.indexOf(f.id) + 1;
    if (s.elevator) {
      batch.box(mat('glass'), s.m.x2 - s.m.x1, WALL_H, s.m.z2 - s.m.z1, s.cx, f.y + WALL_H / 2, s.cz);
    } else if (nextIdx < s.floors.length) {
      const along = (s.m.x2 - s.m.x1) > (s.m.z2 - s.m.z1) ? 'x' : 'z';
      const L = along === 'x' ? s.m.x2 - s.m.x1 : s.m.z2 - s.m.z1;
      const Wd = (along === 'x' ? s.m.z2 - s.m.z1 : s.m.x2 - s.m.x1) * 0.45;
      const N = 12, stepMat = mat('planks', BLOCKY ? '#e8d2b0' : '#b39b78');
      for (let i = 0; i < N; i++) {
        const h = ((i + 1) / N) * FLOOR_H * 0.5;
        const pos = (along === 'x' ? s.m.x1 : s.m.z1) + (i + 0.5) * (L / N);
        if (along === 'x') batch.box(stepMat, L / N, h, Wd, pos, f.y + h / 2, s.m.z1 + Wd / 2 + 0.1);
        else batch.box(stepMat, Wd, h, L / N, s.m.x1 + Wd / 2 + 0.1, f.y + h / 2, pos);
      }
    }
    // 樓梯地面的發光標記
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      color: s.elevator ? '#5aa9ff' : '#ff9f1c', transparent: true, opacity: 0.45, depthWrite: false,
    }));
    mark.rotation.x = -Math.PI / 2;
    mark.scale.set((s.m.x2 - s.m.x1) * 0.9, (s.m.z2 - s.m.z1) * 0.9, 1);
    mark.position.set(s.cx, f.y + 0.03, s.cz);
    mark.userData.pulse = true;
    f.group.add(mark);
    f.labels.add(makeLabel(s.id, s.elevator ? '可到 1F～4F' : `${s.floors[0]}～${s.floors.at(-1)}`, s.cx, f.y + 2.4, s.cz, { bg: s.elevator ? '#2f6fb5' : '#d9730d', h: 1.0 }));
  }
  f.wallMeshes = batch.build(f.group).filter((m) => !m.material.transparent);
  // 教室裝潢 + 門牌
  f.group.add(furnishFloor(f, WALL_T));
  // 房間名稱
  for (const r of f.rooms) {
    if (r.hidden || r.type === 'wc') continue;
    const lbl = makeLabel(r.display, r.sub, r.cx, f.y + 2.3, r.cz, { bg: r.type === 'class' ? '#c2410c' : '#1e3a5f' });
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
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// 大樓名稱（鳥瞰時顯示）
const buildingLabels = new THREE.Group();
const BLD_POS = { A: [1100, 360], B: [1620, 820], C: [1110, 1180], D: [580, 820] };
for (const [k, b] of Object.entries(D.buildings)) {
  const [px, py] = BLD_POS[k];
  buildingLabels.add(makeLabel(`${k} ${b.name}`, '', mx(px), 4 * FLOOR_H + 5, mz(py), { bg: '#333', h: 3.2 }));
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
scene.add(avatar);

function setGender(gender) {
  try { localStorage.setItem(AVATAR_KEY, gender); } catch { /* 私密模式，忽略 */ }
  const next = makeBlockPerson(gender);
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
      toast(`${b.dataset.gender === 'girl' ? '👧' : '👦'} 歡迎來到溪口國小！<br><small>用 WASD 或左下搖桿走進校門</small>`);
    } else {
      toast('已換好角色！');
    }
  } else if (e.target === ch && !ch.dataset.first) ch.hidden = true;
});

function placeAt(f, x, z, yaw) {
  player.floor = f; player.x = x; player.z = z;
  if (yaw !== undefined) { player.yaw = yaw; avatar.rotation.y = yaw; }
  updateVisibility();
  updateFloorButtons();
}

/* ---------------- 碰撞 ---------------- */

function collide(f, x, z) {
  for (let iter = 0; iter < 2; iter++) {
    for (const s of f.segs) {
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

function tryMove(dx, dz) {
  const f = player.floor;
  const cand = [[dx, dz], [dx, 0], [0, dz]];
  for (const [ddx, ddz] of cand) {
    const [nx, nz] = collide(f, player.x + ddx, player.z + ddz);
    if (isWalkable(f, nx, nz)) { player.x = nx; player.z = nz; return; }
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
      const a = findPath(pf, player.x, player.z, s.cx, s.cz);
      const b = findPath(tf, s.cx, s.cz, room.cx, room.cz);
      if (!a || !b) continue;
      const len = a.len + b.len + Math.abs(pf.level - tf.level) * (s.elevator ? 12 : 6);
      if (!best || len < best.len) best = { legs: [{ f: pf, p: a }, { f: tf, p: b }], len, stair: s };
    }
  }
  if (!best) { toast('找不到路線 😢'); return; }
  nav.target = room; nav.legs = best.legs; nav.stair = best.stair || null;
  for (const l of best.legs) drawLeg(l.f, l.p.pts);
  addBeacon(tf, room.cx, room.cz);
  if (nav.stair) addBeacon(pf, nav.stair.cx, nav.stair.cz, '#ff9f1c');
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
    msg = s ? `先沿黃線走到 <b>${s.id}</b>，再${s.elevator ? '搭' : '走'}到 <b>${r.f.id}</b>` : `目的地在 ${r.f.id}`;
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
  currentStair = undefined;
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
  }
  // 鳥瞰選 B1 時把地面藏起來；走路時地面一直都在（在 B1 時就是天花板）
  ground.visible = walking || sel === null || sel >= 0;
  // 走路時標籤縮小、放低，才不會擋住視線
  const k = mode === 'bird' ? 1 : 0.5;
  for (const f of floors) for (const s of f.labels.children) {
    s.userData.base ||= { sx: s.scale.x, sy: s.scale.y, y: s.position.y - f.y };
    s.scale.set(s.userData.base.sx * k, s.userData.base.sy * k, 1);
    s.position.y = f.y + (mode === 'bird' ? s.userData.base.y : 2.45);
  }
  buildingLabels.visible = mode === 'bird' && viewFloor === 'all';
}

function updateFloorButtons() {
  const cur = mode === 'bird' ? viewFloor : player.floor.id;
  document.querySelectorAll('[data-floor]').forEach((b) => b.classList.toggle('on', b.dataset.floor === cur));
  document.getElementById('floorName').textContent = mode === 'bird'
    ? (viewFloor === 'all' ? '全校' : floorById[viewFloor].name)
    : player.floor.name;
}

/* ---------------- 樓梯切換 ---------------- */

let currentStair = null;
function stairAt() {
  for (const s of player.floor.stairs) if (inRect(s.m, player.x, player.z, 0.2)) return s;
  return null;
}
function changeFloor(delta) {
  const s = currentStair;
  if (!s) return;
  const i = s.floors.indexOf(player.floor.id) + delta;
  if (i < 0 || i >= s.floors.length) return;
  gotoFloor(floorById[s.floors[i]]);
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
function updateStairPanel() {
  const s = stairAt();
  if (s === currentStair) return;
  currentStair = s;
  const panel = document.getElementById('stairPanel');
  if (!s || mode === 'bird') { panel.hidden = true; return; }
  const idx = s.floors.indexOf(player.floor.id);
  let html = `<div class="t">${s.id}</div>`;
  if (s.elevator) {
    html += s.floors.map((fid) => `<button data-goto="${fid}" ${fid === player.floor.id ? 'disabled' : ''}>${fid}</button>`).join('');
  } else {
    if (idx < s.floors.length - 1) html += `<button data-delta="1">▲ 上樓到 ${s.floors[idx + 1]} <kbd>E</kbd></button>`;
    if (idx > 0) html += `<button data-delta="-1">▼ 下樓到 ${s.floors[idx - 1]} <kbd>Q</kbd></button>`;
  }
  panel.innerHTML = html;
  panel.hidden = false;
}
document.getElementById('stairPanel').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.delta) changeFloor(+b.dataset.delta);
  if (b.dataset.goto) gotoFloor(floorById[b.dataset.goto]);
  currentStair = undefined;
});

/* ---------------- 輸入 ---------------- */

const keys = {};
const settings = { speed: 1, sens: 1 };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || viewer.isOpen) return;
  keys[e.code] = true;
  if (e.code === 'KeyE') { changeFloor(1); currentStair = undefined; }
  if (e.code === 'KeyQ') { changeFloor(-1); currentStair = undefined; }
  if (e.code === 'KeyM') setMode(mode === 'bird' ? 'third' : 'bird');
  if (e.code === 'KeyV' && mode !== 'bird') setMode(mode === 'first' ? 'third' : 'first');
  if (e.code === 'Space' && mode !== 'bird' && player.jump === 0) { player.vy = 4.2; e.preventDefault(); }
  if (e.code === 'Slash' || e.code === 'KeyF') { if (e.code === 'Slash') e.preventDefault(); openSearch(); }
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

const raycaster = new THREE.Raycaster();
function pick(e) {
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const vis = pickables.filter((o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  const hit = raycaster.intersectObjects(vis, false)[0];
  if (hit?.object.userData.pano) openPano(hit.object.userData.pano);
  else if (hit) showInfo(hit.object.userData.room);
  else hideInfo();
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
    icon.position.set(s.x, s.f.y + 1.7, s.z);
    icon.userData = { pano: s, bob: Math.random() * 6 };
    icon.renderOrder = 3;
    s.f.group.add(icon);
    pickables.push(icon);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, s.f.y + 0.04, s.z);
    s.f.group.add(ring);
    if (s.idx === 0) {
      const lbl = makeLabel(`📷 ${s.spot.zh}`, '', s.x, s.f.y + 3.1, s.z, { bg: '#7b2cbf', h: 0.95 });
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

/* ---------------- 主迴圈 ---------------- */

const clock = new THREE.Clock();
const camRay = new THREE.Raycaster();
let navTick = 0, walkPhase = 0, walkAmt = 0;

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
    }
    // 方塊人走路擺手擺腳
    if (avatar.userData.limbs) {
      walkPhase += moved * 3.2;
      walkAmt += ((moved > 0.001 ? 1 : 0) - walkAmt) * Math.min(1, dt * 10);
      animatePerson(avatar, walkPhase, walkAmt);
    }
    // 跳
    if (player.vy !== 0 || player.jump > 0) {
      player.vy -= 12 * dt; player.jump += player.vy * dt;
      if (player.jump <= 0) { player.jump = 0; player.vy = 0; }
    }
    updateStairPanel();
    updatePanoPrompt();
    if (nav.target && (navTick += dt) > 0.3) {
      navTick = 0;
      updateNavBar();
      if (player.floor === nav.target.f && Math.hypot(player.x - nav.target.cx, player.z - nav.target.cz) < 1.6) {
        toast(`🎉 到達 ${nav.target.display}！`);
        clearNav();
      }
    }
  }
  const py = player.floor.y + player.jump;
  avatar.position.set(player.x, py, player.z);

  if (mode === 'first') {
    camera.position.set(player.x, py + EYE_H, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  } else if (mode === 'third') {
    const head = new THREE.Vector3(player.x, py + 1.6, player.z);
    const pitch = Math.max(-0.9, Math.min(0.5, player.pitch - 0.35));
    const dir = new THREE.Vector3(Math.sin(player.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(player.yaw) * Math.cos(pitch));
    let dist = 5.5;
    if (player.floor.wallMeshes) {
      camRay.set(head, dir); camRay.far = dist;
      const above = floors[player.floor.idx + 1];
      const hit = camRay.intersectObjects([...player.floor.wallMeshes, ...player.floor.ceilMeshes, ...(above?.slabs || [])], false)[0];
      if (hit) dist = Math.max(0.8, hit.distance - 0.25);
    }
    camera.position.copy(head).addScaledVector(dir, dist);
    camera.lookAt(head);
  } else {
    orbit.update();
  }

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
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------------- 啟動 ---------------- */

await Promise.all([
  document.fonts?.load('700 46px "Noto Sans TC"'),
  BLOCKY && document.fonts?.load('44px "Cubic 11"', '溪口國小'),
]).catch(() => {});
for (const f of floors) buildFloor(f);
buildOutdoor();
buildPanoMarkers();

// 起點：正門外面，面向校門（往東）
const G = D.outdoor.gate;
placeAt(floorById['1F'], mx(G.x - 50), mz((G.y1 + G.y2) / 2), -Math.PI / 2);
setMode('bird');
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
if (!savedGender() && !qRoom && !params.get('pano')) openChooser({ firstTime: true });
document.querySelectorAll('[data-gender]').forEach((b) => b.classList.toggle('on', b.dataset.gender === savedGender()));
document.getElementById('changeAvatar').onclick = () => { document.getElementById('help').hidden = true; openChooser(); };
loop();

// 除錯用：在主控台可用 __campus 檢查狀態、__campus.step(秒) 手動推進
window.__campus = { rooms, floors, player, nav, navigateTo, placeAt, viewer, panoScenes, openPano, setMode, findPath, camera, orbit, keys,
  step: (sec) => { for (let t = 0; t < sec; t += 1 / 30) update(1 / 30); renderer.render(scene, camera); } };
