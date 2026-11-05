/* 立體拼圖
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import * as THREE from 'three';
import { faceTeacher } from './common.js?v=302';
import { T, scene, updateVisibility, stopAuto, toast, npcFace, act, gameState } from '../app.js?v=302';

/* ---------------- 立體拼圖：在幼兒園星星班遇到周周老師，小方塊拼成的東西缺了一塊，從 3 塊裡找出拼得上去的那一塊 ----------------
   一回 5 題（從 6 樣東西裡挑）；點按鈕或按 1～3。選錯可以再選（慢慢來沒關係），第一次就選對才算分。
   老師前面的小矮桌上也有一模一樣的立體拼圖，選對了那一塊會從上面放下去 */
const P3D_KEY = 'campus-p3d-best';
const P3D_COL = { r: '#e8505b', y: '#f2c94c', b: '#4a8fd8', g: '#5cbf5a', o: '#b5793e', w: '#f4f1ea', k: '#3a3a3a' };
const p3dRow = (y, z, x0, x1) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y, z]);
// parts：[顏色, 方塊]；miss：拿掉哪一塊；wrong：兩塊干擾的（同顏色、形狀不一樣）
const P3D_ITEMS = [
  { n: '小汽車', en: 'Car', e: '🚗', miss: 2, parts: [['k', [[0, 0, 0], [3, 0, 0], [0, 0, 1], [3, 0, 1]]], ['r', [...p3dRow(1, 0, 0, 3), ...p3dRow(1, 1, 0, 3)]], ['b', [[1, 2, 0], [2, 2, 0], [1, 2, 1], [2, 2, 1]]]],
    wrong: [[[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]], [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1]]] },
  { n: '小房子', en: 'House', e: '🏠', miss: 1, parts: [['y', [...p3dRow(0, 0, 0, 2), ...p3dRow(0, 1, 0, 2), ...p3dRow(1, 0, 0, 2), ...p3dRow(1, 1, 0, 2)]], ['r', [...p3dRow(2, 0, 0, 2), ...p3dRow(2, 1, 0, 2), [1, 3, 0], [1, 3, 1]]]],
    wrong: [[...p3dRow(0, 0, 0, 2), ...p3dRow(0, 1, 0, 2)], [...p3dRow(0, 0, 0, 2), ...p3dRow(0, 1, 0, 2), [0, 1, 0], [0, 1, 1]]] },
  { n: '大樹', en: 'Tree', e: '🌳', miss: 0, parts: [['o', [[1, 0, 1], [1, 1, 1]]], ['g', [...p3dRow(2, 0, 0, 2), ...p3dRow(2, 1, 0, 2), ...p3dRow(2, 2, 0, 2), ...p3dRow(3, 1, 0, 2), [1, 3, 0], [1, 3, 2], [1, 4, 1]]]],
    wrong: [[[0, 0, 0], [0, 1, 0], [0, 2, 0]], [[0, 0, 0], [1, 0, 0]]] },
  { n: '小狗', en: 'Puppy', e: '🐶', miss: 2, parts: [['k', [[0, 0, 0], [2, 0, 0]]], ['o', [[0, 1, 0], [1, 1, 0], [2, 1, 0], [0, 2, 0]]], ['y', [[2, 2, 0], [3, 2, 0], [2, 3, 0]]]],
    wrong: [[[0, 0, 0], [1, 0, 0], [1, 1, 0]], [[0, 0, 0], [1, 0, 0], [2, 0, 0]]] },
  { n: '火箭', en: 'Rocket', e: '🚀', miss: 2, parts: [['b', [[-1, 0, 0], [1, 0, 0], [-1, 1, 0], [1, 1, 0]]], ['w', [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0]]], ['r', [[0, 4, 0], [0, 5, 0]]]],
    wrong: [[[0, 0, 0], [0, 1, 0], [0, 2, 0]], [[0, 0, 0], [1, 0, 0]]] },
  { n: '機器人', en: 'Robot', e: '🤖', miss: 2, parts: [['k', [[0, 0, 0], [2, 0, 0]]], ['b', [...p3dRow(1, 0, 0, 2), ...p3dRow(2, 0, 0, 2)]], ['w', [...p3dRow(3, 0, 0, 2), [1, 4, 0]]]],
    wrong: [[[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]], [[1, 0, 0], ...p3dRow(1, 0, 0, 2)]] },
];
const p3dBox = document.getElementById('p3d');
// 一組方塊（每格 1、黑色細邊框，看得出一格一格）；ghost：缺口（半透明＋橘色框）
const p3dEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), p3dGeo = new THREE.BoxGeometry(1, 1, 1);
function p3dGroup(cubes, col, ghost = false) {
  const g = new THREE.Group();
  const m = ghost ? new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }) : new THREE.MeshLambertMaterial({ color: P3D_COL[col] });
  const lm = new THREE.LineBasicMaterial({ color: ghost ? '#ff7a1a' : '#2b2b2b' });
  for (const [x, y, z] of cubes) {
    const o = new THREE.Mesh(p3dGeo, m); o.position.set(x, y, z); g.add(o);
    const e = new THREE.LineSegments(p3dEdges, lm); e.position.set(x, y, z); g.add(e);
  }
  return g;
}
// 拍成圖片（按鈕和題目用）：另外開一個小畫布，斜上方看過去
let p3dShot = null;
function p3dImage(g, half) {
  if (!p3dShot) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(220, 180); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight('#ffffff', 1.6));
    const d = new THREE.DirectionalLight('#ffffff', 2.2); d.position.set(3, 6, 4); sc.add(d);
    p3dShot = { r, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100) };
  }
  const { r, sc, cam } = p3dShot;
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
  const h = half ?? Math.max(1.6, box.getSize(new THREE.Vector3()).length() * 0.42);
  cam.left = -h * 220 / 180; cam.right = h * 220 / 180; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix();
  cam.position.copy(c).add(new THREE.Vector3(1.1, 0.9, 1.6).normalize().multiplyScalar(30)); cam.lookAt(c);
  sc.add(g); r.render(sc, cam); sc.remove(g);
  return r.domElement.toDataURL();
}
// 老師前面小矮桌上的立體拼圖（每格 9 公分）
const p3dTable = new THREE.Group(); p3dTable.visible = false; scene.add(p3dTable);
function startPuzzle3d(n) {
  stopAuto();
  const $ = (sel) => p3dBox.querySelector(sel);
  const btns = [...p3dBox.querySelectorAll('[data-k]')];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const qs = shuffle(P3D_ITEMS.slice()).slice(0, 5);
  let i = 0, right = 0, best = 0, tries = 0, locked = false, done = false, drop = null;
  try { best = +localStorage.getItem(P3D_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  // 小矮桌在老師正前方 0.9 公尺
  const fx = -Math.sin(n.yaw), fz = -Math.cos(n.yaw), tableY = n.g.position.y + 0.44;
  p3dTable.position.set(n.g.position.x + fx * 0.9, tableY, n.g.position.z + fz * 0.9);
  p3dTable.rotation.y = n.yaw + Math.PI; p3dTable.scale.setScalar(0.09); p3dTable.visible = true;
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const ready = () => {
    locked = false; tries = 0;
    const q = qs[i], [mc, mcubes] = q.parts[q.miss];
    // 整個東西（缺一塊＋缺口）拍一張；桌上的拼圖也換成這一題
    const whole = new THREE.Group();
    q.parts.forEach(([c, cubes], k) => whole.add(p3dGroup(cubes, c, k === q.miss)));
    $('.model').src = p3dImage(whole);
    p3dTable.clear();
    const box = new THREE.Box3().setFromObject(whole), c = box.getCenter(new THREE.Vector3());
    q.parts.forEach(([col, cubes], k) => { if (k !== q.miss) { const g = p3dGroup(cubes, col); g.position.set(-c.x, 0.5 - box.min.y, -c.z); p3dTable.add(g); } });
    q.off = [-c.x, 0.5 - box.min.y, -c.z];
    // 3 個選項：正確那塊＋兩塊干擾，各自拍一張（同樣大小）
    q.opts = shuffle([mcubes, ...q.wrong]);
    btns.forEach((b, k) => {
      b.disabled = false; b.className = '';
      b.innerHTML = `<img alt="" src="${p3dImage(p3dGroup(q.opts[k], mc), 2.2)}"><small>${k + 1}</small>`;
    });
    $('.prog').textContent = T(`第 ${i + 1} / ${qs.length} 題`, `${i + 1} / ${qs.length}`);
    $('.ask').textContent = T(`${q.e} ${q.n}缺了一塊，哪一塊拼得上去？`, `${q.e} The ${q.en.toLowerCase()} is missing a piece. Which one fits?`);
    msg(T('看看缺口（橘色框）的形狀，選一塊！', 'Look at the gap (orange outline) and pick a piece!'));
  };
  const finish = () => {
    done = true; p3dBox.hidden = true; p3dTable.visible = false; p3dTable.clear();
    updateVisibility();
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const answer = (k) => {
    if (locked || done || btns[k].disabled) return;
    const q = qs[i], ok = q.opts[k] === q.parts[q.miss][1];
    tries++;
    if (!ok) {
      btns[k].disabled = true; btns[k].className = 'wrong';
      msg(T('🐢 慢慢來沒關係，再看看缺口的形狀！', '🐢 Take your time. Look at the shape of the gap again!'), 'no');
      npcFace(n, 'surprised', 1.2);
      return;
    }
    locked = true; btns.forEach((b) => (b.disabled = true)); btns[k].className = 'right';
    if (tries === 1) right++;
    // 選對了：那一塊從上面放下去
    const [mc, mcubes] = q.parts[q.miss], g = p3dGroup(mcubes, mc);
    g.position.set(q.off[0], q.off[1] + 6, q.off[2]); p3dTable.add(g);
    drop = { g, y: q.off[1], t: 0 };
    $('.model').src = p3dImage((() => { const w = new THREE.Group(); q.parts.forEach(([c, cubes]) => w.add(p3dGroup(cubes, c))); return w; })());
    msg(tries === 1 ? T(`✅ 拼上去了！${q.e} ${q.n}完成！`, `✅ It fits! The ${q.en.toLowerCase()} is done!`) : T(`✅ 我們一起做到了！${q.e} ${q.n}完成！`, `✅ We did it together! The ${q.en.toLowerCase()} is done!`), 'ok');
    npcFace(n, 'happy', 1.5);
    setTimeout(() => {
      if (done) return;
      if (++i < qs.length) { ready(); return; }
      if (right > best) { best = right; try { localStorage.setItem(P3D_KEY, String(best)); } catch { /* 私密模式 */ } }
      npcFace(n, 'happy', 3);
      finish();
      toast(right === qs.length ? `${T('🌟 5 個都一次就拼對！好厲害！', '🌟 All 5 right on the first try!')}<br>${n.name}：你看，慢慢觀察就做得到！`
        : `${T(`🧩 第一次就拼對 ${right} / ${qs.length} 個（最好紀錄 ${best} 個）`, `🧩 ${right} / ${qs.length} right on the first try (best ${best})`)}<br>${n.name}：慢慢來沒關係，我們一起做，加油～`);
    }, 1700);
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
  gameState.duel = { quit() { finish(); toast(T(`🧩 下次再來找${n.name}玩立體拼圖！`, `🧩 Come back for 3D puzzles with ${n.name}!`)); } };
  act.busy = {
    label: T('🧩 立體拼圖中…', '🧩 3D puzzle…'),
    tick(dt) {                                                           // 選對的那一塊慢慢放下去
      if (!drop) return;
      drop.t = Math.min(1, drop.t + dt / 0.45);
      drop.g.position.y = drop.y + 6 * (1 - drop.t) * (1 - drop.t);
      if (drop.t >= 1) drop = null;
    },
  };
  p3dBox.hidden = false;
  ready();
}

export { p3dGroup, p3dImage };

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  puzzle3d: (s) => startPuzzle3d(s.npc),
};
