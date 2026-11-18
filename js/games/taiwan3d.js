/* 立體臺灣地形拼圖（趙老師，四年三班導師）
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。畫面借用周周老師立體拼圖的面板（#p3d），加上 .tw 樣式。
   第一關「拼拼看」：臺灣立體地形分成 5 塊（北部、中部、南部、花蓮、臺東），每次缺一塊，從 3 塊裡找出拼得上去的那一塊；選錯可以再選，第一次就選對才算分。
   第二關「地形小問答」：完成的臺灣插一支小旗子，那裡是什麼地形？（山地、平原、盆地、台地、縱谷…）3 題。
   老師前面的小桌子上也有一模一樣的立體臺灣，選對了那一塊會從上面放下去。
   地形是依大約的經緯度做的示意（一格約 5 公里，高度分 6 層、有放大），不是精確的地圖。 */
import * as THREE from 'three';
import { faceTeacher } from './common.js?v=341';
import { T, scene, updateVisibility, stopAuto, toast, npcFace, act, gameState } from '../app.js?v=341';

const KEY = 'campus-twpuzzle-best';

/* ---------------- 地形資料（大約的經緯度） ---------------- */
// 海岸線：從富貴角順時針
const COAST = [[121.54, 25.30], [121.74, 25.15], [121.92, 25.03], [122.00, 25.01], [121.86, 24.86], [121.83, 24.70], [121.86, 24.59], [121.80, 24.45], [121.74, 24.33],
  [121.62, 24.00], [121.56, 23.80], [121.50, 23.55], [121.42, 23.30], [121.35, 23.10], [121.22, 22.90], [121.14, 22.75], [121.00, 22.58], [120.90, 22.35], [120.86, 22.10],
  [120.85, 21.92], [120.74, 21.93], [120.70, 22.05], [120.62, 22.30], [120.48, 22.45], [120.30, 22.58], [120.22, 22.75], [120.14, 22.95], [120.07, 23.10], [120.12, 23.35],
  [120.15, 23.55], [120.20, 23.75], [120.32, 23.95], [120.45, 24.15], [120.60, 24.38], [120.76, 24.60], [120.90, 24.82], [121.02, 25.02], [121.20, 25.10], [121.40, 25.19]];
// 中央山脈的稜線（北→南）、海岸山脈、花東縱谷
const SPINE = [[121.62, 24.82], [121.42, 24.52], [121.27, 24.15], [121.12, 23.80], [120.98, 23.45], [120.90, 23.00], [120.83, 22.50], [120.80, 22.05]];
const VALLEY = [[121.58, 23.95], [121.33, 23.40], [121.15, 22.85]];
const COASTAL = [[121.62, 23.92], [121.40, 23.40], [121.22, 22.86]];
const KX = 111.32 * Math.cos(23.7 * Math.PI / 180), KY = 110.6;        // 1 度大約幾公里
const km = (a, b) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);
function distLine(p, line) {                                            // 點到折線的距離（公里）
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i][0] * KX, ay = line[i][1] * KY, bx = line[i + 1][0] * KX, by = line[i + 1][1] * KY, px = p[0] * KX, py = p[1] * KY;
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(px - ax - dx * t, py - ay - dy * t));
  }
  return best;
}
const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const crestLon = (lat) => {                                             // 這個緯度的中央山脈稜線經度
  for (let i = 0; i < SPINE.length - 1; i++) { const [x1, y1] = SPINE[i], [x2, y2] = SPINE[i + 1]; if (lat <= y1 && lat >= y2) return x1 + (x2 - x1) * (y1 - lat) / (y1 - y2); }
  return lat > SPINE[0][1] ? SPINE[0][0] : SPINE[SPINE.length - 1][0];
};
const bump = (p, c, h, r) => h * Math.exp(-((km(p, c) / r) ** 2));
function elev(p) {                                                      // 大約的海拔（公尺）
  const [lon, lat] = p, east = lon > crestLon(lat), ds = distLine(p, SPINE);
  const peak = lat > 24.45 ? 3200 - (lat - 24.45) / 0.4 * 1700 : lat > 23.0 ? 3300 : 1000 + (lat - 22.05) / 0.95 * 2300;
  let h = peak * Math.exp(-((ds / (east ? 15 : 20)) ** 2)) + 650 * Math.exp(-((ds / 34) ** 2)) + 25;
  h += bump(p, [120.96, 23.47], 900, 9) + bump(p, [121.23, 24.38], 800, 9);   // 玉山、雪山
  if (lat < 23.95 && lat > 22.85) {
    if (distLine(p, VALLEY) < 3.5) h = Math.min(h, 80);                 // 花東縱谷
    h = Math.max(h, 1100 * Math.exp(-((distLine(p, COASTAL) / 4) ** 2)));   // 海岸山脈
  }
  if (km(p, [121.52, 25.04]) < 9) h = 15;                               // 臺北盆地
  h = Math.max(h, bump(p, [121.56, 25.17], 1100, 6));                   // 陽明山（大屯火山群）
  if (km(p, [121.36, 25.07]) < 7) h = Math.max(Math.min(h, 260), 260);  // 林口台地
  if (km(p, [121.74, 24.70]) < 11) h = Math.min(h, 30);                 // 蘭陽平原
  return h;
}
const LEVELS = [100, 500, 1000, 2000, 3000];
const LCOL = ['#6fbf5f', '#a9d16a', '#e7d27c', '#d9a35a', '#b2723f', '#8c5a3c'];
const levelOf = (h) => LEVELS.filter((v) => h >= v).length;
const hUnits = (lv) => 0.35 + lv * 0.55;
// 分成 5 塊（依國發會的北、中、南、東部，東部再分花蓮、臺東）
const REGIONS = [
  { id: 'north', n: '北部', en: 'North', who: '基隆、臺北、新北、桃園、新竹、宜蘭', whoEn: 'Keelung, Taipei, New Taipei, Taoyuan, Hsinchu, Yilan' },
  { id: 'central', n: '中部', en: 'Central', who: '苗栗、臺中、彰化、南投、雲林', whoEn: 'Miaoli, Taichung, Changhua, Nantou, Yunlin' },
  { id: 'south', n: '南部', en: 'South', who: '嘉義、臺南、高雄、屏東', whoEn: 'Chiayi, Tainan, Kaohsiung, Pingtung' },
  { id: 'hualien', n: '花蓮', en: 'Hualien', who: '東部的花蓮縣', whoEn: 'Hualien County in the east' },
  { id: 'taitung', n: '臺東', en: 'Taitung', who: '東部的臺東縣', whoEn: 'Taitung County in the east' },
];
function regionOf([lon, lat]) {
  if (lon > crestLon(lat) && lat > 22.3) return lat >= 24.33 ? 'north' : lat >= 23.2 ? 'hualien' : 'taitung';
  return lat >= 24.6 ? 'north' : lat >= 23.5 ? 'central' : 'south';
}
// 一格 5 公里：cells = [{ i, j, x, z, lv, r }]（x 向東、z 向南）
const STEP = 5, LON0 = 120.0, LAT1 = 25.35;
const CELLS = [];
for (let j = 0; LAT1 - j * STEP / KY > 21.85; j++) for (let i = 0; LON0 + i * STEP / KX < 122.05; i++) {
  const p = [LON0 + (i + 0.5) * STEP / KX, LAT1 - (j + 0.5) * STEP / KY];
  if (!inside(p, COAST)) continue;
  CELLS.push({ i, j, lv: levelOf(elev(p)), r: regionOf(p) });
}
const CI = CELLS.reduce((s, c) => s + c.i, 0) / CELLS.length, CJ = CELLS.reduce((s, c) => s + c.j, 0) / CELLS.length;
CELLS.forEach((c) => { c.x = c.i - CI; c.z = c.j - CJ; });
const toXZ = ([lon, lat]) => [(lon - LON0) * KX / STEP - 0.5 - CI, (LAT1 - lat) * KY / STEP - 0.5 - CJ];
const topAt = (p) => { const [x, z] = toXZ(p); let best = null, d = Infinity; for (const c of CELLS) { const e = Math.hypot(c.x - x, c.z - z); if (e < d) { d = e; best = c; } } return [x, hUnits(best.lv), z]; };

/* ---------------- 3D 模型 ---------------- */
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const ghostMat = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.45, depthWrite: false });
const landMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
// 一塊（或整個臺灣）：每格一根柱子，高度＝地形層數、顏色＝分層設色；ghost：缺口（扁扁的橘色）
function piece(ids, ghost = false) {
  const cells = CELLS.filter((c) => ids.includes(c.r));
  const m = new THREE.InstancedMesh(boxGeo, ghost ? ghostMat : landMat, cells.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  cells.forEach((c, k) => {
    const h = ghost ? 0.12 : hUnits(c.lv);
    o.position.set(c.x, h / 2, c.z); o.scale.set(0.96, h, 0.96); o.updateMatrix(); m.setMatrixAt(k, o.matrix);
    if (!ghost) m.setColorAt(k, col.set(LCOL[c.lv]));
  });
  const g = new THREE.Group(); g.add(m);
  return g;
}
function flag([x, y, z]) {                                              // 紅色小旗子
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 8), new THREE.MeshLambertMaterial({ color: '#f4f4f4' }));
  pole.position.set(0, 4.5, 0); g.add(pole);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.8, 0.3), new THREE.MeshLambertMaterial({ color: '#e8312f', emissive: '#a01010', emissiveIntensity: 0.3 }));
  cloth.position.set(2.3, 7.6, 0); g.add(cloth);
  g.position.set(x, y, z);
  return g;
}
// 拍成圖片：從正南方的斜上方往下看（北在上面），縮放到剛好放得下
let shot = null;
function image(g, w = 200, h = 240) {
  if (!shot) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight('#ffffff', 1.5));
    const d = new THREE.DirectionalLight('#ffffff', 2.0); d.position.set(-4, 8, 3); sc.add(d);
    shot = { r, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000) };
  }
  const { r, sc, cam } = shot;
  r.setSize(w, h);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
  cam.position.copy(c).add(new THREE.Vector3(0, 1.8, 0.75).normalize().multiplyScalar(300)); cam.lookAt(c); cam.updateMatrixWorld();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;     // 八個角投影到鏡頭上，算出要拍多大
  for (const ix of [box.min.x, box.max.x]) for (const iy of [box.min.y, box.max.y]) for (const iz of [box.min.z, box.max.z]) {
    const v = new THREE.Vector3(ix, iy, iz).applyMatrix4(cam.matrixWorldInverse);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max((y1 - y0) / 2, (x1 - x0) / 2 * h / w) * 1.06;
  cam.left = cx - half * w / h; cam.right = cx + half * w / h; cam.top = cy + half; cam.bottom = cy - half; cam.updateProjectionMatrix();
  sc.add(g); r.render(sc, cam); sc.remove(g);
  return r.domElement.toDataURL();
}

/* ---------------- 地形小問答 ---------------- */
const QUIZ = [
  { at: [120.96, 23.47], q: '插旗子的地方是臺灣最高的山，它叫什麼？', a: ['玉山', '雪山', '陽明山'], why: '玉山大約 3952 公尺，是臺灣最高的山。' },
  { at: [121.15, 23.95], q: '插旗子的地方在臺灣中間，又長又高的山脈叫什麼？', a: ['中央山脈', '海岸山脈', '大屯山'], why: '中央山脈從北到南貫穿臺灣，被稱為「臺灣的屋脊」。' },
  { at: [120.30, 23.30], q: '插旗子的地方又低又平，是什麼地形？', a: ['平原', '山地', '盆地'], why: '這裡是嘉南平原，是臺灣最大的平原，很適合種稻米。' },
  { at: [121.52, 25.04], q: '插旗子的地方四周被山圍著、中間低低的，是什麼地形？', a: ['盆地', '平原', '台地'], why: '這裡是臺北盆地，四周有山圍起來，中間比較低。' },
  { at: [121.36, 25.07], q: '插旗子的地方比旁邊高、上面平平的，是什麼地形？', a: ['台地', '盆地', '山地'], why: '這裡是林口台地，比四周高，上面卻很平坦。' },
  { at: [121.33, 23.40], q: '插旗子的地方夾在兩條山脈中間，長長的低地叫什麼？', a: ['花東縱谷', '嘉南平原', '臺北盆地'], why: '花東縱谷在中央山脈和海岸山脈中間，又長又窄。' },
  { at: [121.74, 24.70], q: '插旗子的地方在宜蘭，是什麼地形？', a: ['平原', '盆地', '山地'], why: '這裡是蘭陽平原，是蘭陽溪帶來的泥沙堆出來的平原。' },
  { at: null, q: '看看整個立體臺灣，高山大多在哪裡？', a: ['中間偏東邊', '西邊海邊', '北邊海邊'], why: '臺灣的山脈大多在中間偏東，西邊比較多平原和台地。' },
];

/* ---------------- 遊戲 ---------------- */
const box = document.getElementById('p3d');
const table = new THREE.Group(); table.visible = false; scene.add(table);
const SCALE = 0.012;                                                    // 桌上的立體臺灣：一格 1.2 公分（全長大約 1 公尺）
function startTaiwan(n) {
  stopAuto();
  const $ = (s) => box.querySelector(s);
  const btns = [...box.querySelectorAll('[data-k]')];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const order = shuffle(REGIONS.slice()), quiz = shuffle(QUIZ.slice()).slice(0, 3);
  const total = order.length + quiz.length;
  let step = 0, right = 0, best = 0, tries = 0, locked = false, done = false, drop = null, placed = [];
  try { best = +localStorage.getItem(KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  box.classList.add('tw');
  const title = box.querySelector('.top > span > span'), oldTitle = title.textContent;
  title.textContent = T('🗺️ 立體臺灣地形拼圖・', '🗺️ Taiwan Terrain Puzzle · ');
  // 老師前面 1 公尺放一張小桌子，上面是立體臺灣（北邊朝老師）
  const fx = -Math.sin(n.yaw), fz = -Math.cos(n.yaw);
  table.clear();
  const tg = new THREE.Group(); table.add(tg);
  const wood = new THREE.MeshLambertMaterial({ color: '#c79a62' });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 1.15), wood); top.position.y = 0.6; table.add(top);
  for (const sx of [-0.32, 0.32]) for (const sz of [-0.52, 0.52]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), wood); leg.position.set(sx, 0.3, sz); table.add(leg); }
  tg.position.y = 0.625; tg.scale.setScalar(SCALE);
  table.position.set(n.g.position.x + fx * 1.0, n.g.position.y, n.g.position.z + fz * 1.0);
  table.rotation.y = n.yaw + Math.PI; table.visible = true;
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const prog = () => ($('.prog').textContent = T(`第 ${step + 1} / ${total} 題`, `${step + 1} / ${total}`));
  const all = REGIONS.map((r) => r.id);
  const rebuildTable = (extra) => { tg.clear(); tg.add(piece(placed)); if (extra) tg.add(extra); };
  // 第一關：缺一塊
  const readyPiece = () => {
    locked = false; tries = 0;
    const r = order[step], rest = all.filter((id) => id !== r.id);
    placed = rest.slice();
    const whole = new THREE.Group(); whole.add(piece(rest)); whole.add(piece([r.id], true));
    $('.model').src = image(whole);
    rebuildTable();
    const others = shuffle(rest.slice()).slice(0, 2);
    r.opts = shuffle([r.id, ...others]);
    btns.forEach((b, k) => { b.disabled = false; b.className = ''; b.innerHTML = `<img alt="" src="${image(piece([r.opts[k]]), 120, 120)}"><small>${k + 1}</small>`; });
    prog();
    $('.ask').textContent = T('🗺️ 立體臺灣缺了一塊，哪一塊拼得上去？', '🗺️ Taiwan is missing a piece. Which one fits?');
    msg(T('看看橘色缺口的形狀和位置，選一塊！', 'Look at the shape of the orange gap and pick a piece!'));
  };
  // 第二關：插旗子問地形
  const readyQuiz = () => {
    locked = false;
    const q = quiz[step - order.length];
    const fl = q.at ? flag(topAt(q.at)) : null;
    const whole = new THREE.Group(); whole.add(piece(all)); if (fl) whole.add(fl);
    $('.model').src = image(whole);
    rebuildTable(q.at ? flag(topAt(q.at)) : null);
    q.opts = shuffle(q.a.map((t, k) => ({ t, ok: !k })));
    btns.forEach((b, k) => { b.disabled = false; b.className = 'txt'; b.innerHTML = `${q.opts[k].t}<small>${k + 1}</small>`; });
    prog();
    $('.ask').textContent = T(`🚩 ${q.q}`, `🚩 ${q.q}`);
    msg(step === order.length ? T('臺灣拼好了！接下來考考你地形～', 'Taiwan is complete! Now a few landform questions.') : '');
  };
  const ready = () => (step < order.length ? readyPiece() : readyQuiz());
  const next = (ms) => setTimeout(() => {
    if (done) return;
    if (++step < total) { ready(); return; }
    if (right > best) { best = right; try { localStorage.setItem(KEY, String(best)); } catch { /* 私密模式 */ } }
    npcFace(n, 'happy', 3);
    finish();
    toast(`${T(`🗺️ 立體臺灣地形拼圖：答對 ${right} / ${total} 題（最好紀錄 ${best} 題）`, `🗺️ Taiwan terrain puzzle: ${right} / ${total} (best ${best})`)}<br>${n.name}：${right >= total - 1 ? '認真學習、專心做事，你做到了！' : '專心看、慢慢想，下次一定更好！'}`);
  }, ms);
  const finish = () => {
    done = true; box.hidden = true; box.classList.remove('tw'); title.textContent = oldTitle; table.visible = false; tg.clear();
    updateVisibility();
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const answer = (k) => {
    if (locked || done || btns[k].disabled) return;
    if (step < order.length) {
      const r = order[step], ok = r.opts[k] === r.id;
      tries++;
      if (!ok) {
        btns[k].disabled = true; btns[k].className = 'wrong';
        msg(T('🤔 再看看缺口在臺灣的哪裡、是什麼形狀！', '🤔 Look again at where the gap is and its shape!'), 'no');
        npcFace(n, 'surprised', 1.2);
        return;
      }
      locked = true; btns.forEach((b) => (b.disabled = true)); btns[k].className = 'right';
      if (tries === 1) right++;
      placed = all.slice();
      const g = piece([r.id]); g.position.y = 25; tg.add(g); drop = { g, t: 0 };
      $('.model').src = image(piece(all));
      msg(`✅ ${T(`拼上去了！這是<b>${r.n}</b>（${r.who}）`, `It fits! This is the <b>${r.en}</b> (${r.whoEn})`)}`, 'ok');
      npcFace(n, 'happy', 1.5);
      next(2200);
      return;
    }
    const q = quiz[step - order.length], o = q.opts[k];
    locked = true; btns.forEach((b) => (b.disabled = true));
    btns[q.opts.findIndex((x) => x.ok)].className = 'txt right';
    if (o.ok) { right++; msg(`⭕ ${T('答對了！', 'Correct! ')}${q.why}`, 'ok'); npcFace(n, 'happy', 1.5); }
    else { btns[k].className = 'txt wrong'; msg(`❌ ${q.why}`, 'no'); npcFace(n, 'surprised', 1.2); }
    next(3000);
  };
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); answer(k); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); gameState.duel?.quit(); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b, k) => (b.onclick = () => answer(k)));
  $('.quit').onclick = () => gameState.duel?.quit();
  $('.who').textContent = n.name;
  gameState.duel = { quit() { finish(); toast(T(`🗺️ 下次再來找${n.name}拼立體臺灣！`, `🗺️ Come back for the Taiwan puzzle with ${n.name}!`)); } };
  act.busy = {
    label: T('🗺️ 立體臺灣地形拼圖中…', '🗺️ Taiwan terrain puzzle…'),
    tick(dt) {                                                           // 選對的那一塊慢慢放下去
      if (!drop) return;
      drop.t = Math.min(1, drop.t + dt / 0.5);
      drop.g.position.y = 25 * (1 - drop.t) * (1 - drop.t);
      if (drop.t >= 1) drop = null;
    },
  };
  box.hidden = false;
  ready();
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  twpuzzle: (s) => startTaiwan(s.npc),
};
