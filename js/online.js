/* ---------------- 同學在線上：畫面（方塊人、名牌、小地圖點點、面板、管理員開關）；連線在 online-net.js ----------------
   只有登入的溪口師生，而且按了「加入」才會被看到；按「離開」、關網頁、分頁放到背景 3 分鐘就消失。
   登入後由 auth.js 載入。沒加入之前不開即時連線（免費方案同時 100 個），只用一般的網路請求看一下有沒有開放、幾個人。 */
import * as THREE from 'three';
import { makeBlockPerson, animatePerson, mergeStatic } from './blocks.js?v=359';
import { T, scene, floors, player, avatar, wearing, mode, makeLabel, toast, frameHooks, mapHooks, AVATAR_SCALE } from './app.js?v=359';
import { DB_URL, SAY_GAP, KEEP_DAYS, OnlineNet, cleanName, teacherName, emailKey, denyReason } from './online-net.js?v=359';

const JOIN_KEY = 'campus-online';                            // 這台電腦上次加入的帳號（記 uid；換人登入不會自動加入）
const MAX_BODY = 24, FAR = 45, LABEL_FAR = 16;               // 最多畫幾個人、多遠就不畫、名牌多遠就不顯示
const floorOf = (id) => floors.find((f) => f.id === id);

/* ---- 說話、動作：只能選這幾個（代號存在資料庫，各人用自己的語言顯示）。要改話：改這裡，同時改 docs/交接.md ---- */
export const SAY = { s1: ['👋 嗨！你好！', "👋 Hi there!"], s2: ['😊 你也在這裡呀！', '😊 You are here too!'], s3: ['🏫 一起逛校園吧！', "🏫 Let's explore the campus!"], s4: ['👍 你好厲害！', "👍 You're awesome!"], s5: ['🍚 肚子餓了，我想吃點心！', "🍚 I'm hungry. I want a snack!"] };
export const ACT = { a1: ['👋', '揮手', 'Wave', 3], a2: ['🙌', '擊掌', 'High five', 2.4], a3: ['🙇', '鞠躬', 'Bow', 2.2], a4: ['🕺', '跳舞', 'Dance', 4] };   // [圖示, 中文, 英文, 持續幾秒]
const SHOW_SEC = 5;                                          // 說的話顯示幾秒
const bubbleText = (k) => (SAY[k] ? T(...SAY[k]) : `${ACT[k][0]} ${T(ACT[k][1], ACT[k][2])}`);
const makeBubble = (k) => makeLabel(bubbleText(k), '', 0, 0, 0, { bg: SAY[k] ? '#c98a00' : '#8a4ad8', h: 0.36 });
const BUBBLE_UP = 0.42;                                      // 說話泡泡在名牌上面多高（公尺）

/* 動作：把手腳、身體轉到指定的姿勢（t＝動作開始後幾秒）；結束回傳 false 並把姿勢還原。手臂的轉軸：x＝往前後擺、z＝往兩側舉 */
function pose(g, k, t) {
  const { armL, armR, legL, legR } = g.userData.limbs, dur = ACT[k][3], on = t < dur;
  g.rotation.order = 'YXZ';
  if (!on) { armL.rotation.z = armR.rotation.z = 0; g.rotation.x = g.rotation.z = 0; return false; }
  const e = Math.min(1, t * 5, (dur - t) * 5);                // 開頭、結尾 0.2 秒慢慢進出，不會突然跳
  if (k === 'a1') { armR.rotation.x = 0; armR.rotation.z = (2.5 + Math.sin(t * 11) * 0.35) * e * ARM_SIDE; }
  else if (k === 'a2') { armL.rotation.x = armR.rotation.x = -Math.PI * 0.95 * e; armL.rotation.z = armR.rotation.z = 0; g.position.y += Math.abs(Math.sin(t * 7)) * 0.12 * e; }
  else if (k === 'a3') g.rotation.x = -Math.sin(Math.min(1, t / dur) * Math.PI) * 0.7;   // 鞠躬：往前彎（臉在 -z，所以是負的）
  else { const w = Math.sin(t * 8); armL.rotation.x = -Math.PI * 0.8 * e * (w > 0 ? 1 : 0.2); armR.rotation.x = -Math.PI * 0.8 * e * (w > 0 ? 0.2 : 1); legL.rotation.x = w * 0.5 * e; legR.rotation.x = -w * 0.5 * e; g.rotation.z = Math.sin(t * 4) * 0.12 * e; g.position.y += Math.abs(w) * 0.1 * e; }
  return true;
}
const ARM_SIDE = 1;                                           // 右手舉到側邊要轉的方向（1 或 -1，看畫面調）

/* ---- 不看這個人（只存在這台電腦，換電腦要重設） ---- */
const MUTE_KEY = 'campus-online-muted';
const muted = new Map(); try { for (const [u, n] of JSON.parse(localStorage.getItem(MUTE_KEY) || '[]')) muted.set(u, n); } catch { /* 沒有就算了 */ }
const saveMuted = () => { try { localStorage.setItem(MUTE_KEY, JSON.stringify([...muted])); } catch { /* 私密模式 */ } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ---- 別人的方塊人 ---- */
const people = new Map();                                    // uid → { card, pos, g, label, … }
const group = new THREE.Group(); scene.add(group);
const protos = {};
// 同一種角色＋服裝只做一次，其他人共用形狀和材質（複製很便宜）；每個部位的小方塊先合併，一個人只要十幾次繪圖
function cloneBody(g, o) {
  const key = `${g}/${o}`;
  if (!protos[key]) {
    const p = makeBlockPerson(g === 'girl' ? 'girl' : 'boy');
    p.userData.setOutfit(o);
    for (const [k, v] of Object.entries(p.userData.limbs)) v.name = k;
    const groups = []; p.traverse((x) => { if (x.isGroup) groups.push(x); });
    for (const grp of groups) {
      for (const m of grp.children.filter((x) => x.isMesh && !x.visible)) grp.remove(m);
      mergeStatic(grp.children.filter((x) => x.isMesh && !Array.isArray(x.material)), grp, 1000);
    }
    p.traverse((x) => { x.castShadow = false; });
    p.userData = {}; p.scale.setScalar(AVATAR_SCALE);
    protos[key] = p;
  }
  const c = protos[key].clone(true);
  c.userData.limbs = Object.fromEntries(['armL', 'armR', 'legL', 'legR'].map((k) => [k, c.getObjectByName(k)]));
  return c;
}
const dropLabel = (l) => { group.remove(l); l.material.map?.dispose(); l.material.dispose(); };
function dropBody(q) {
  if (q.say?.label) { dropLabel(q.say.label); q.say.label = null; }
  if (q.g) group.remove(q.g);
  if (q.label) { group.remove(q.label); q.label.material.map?.dispose(); q.label.material.dispose(); }
  q.g = q.label = null;
}
function setCard(uid, card) {
  if (card && muted.has(uid)) card = null;                    // 不看的人：當作不在
  if (!card) { const q = people.get(uid); if (q) { dropBody(q); people.delete(uid); } return; }
  const q = people.get(uid) || { uid, phase: 0, amt: 0 };
  if (q.card && (q.card.g !== card.g || q.card.o !== card.o || q.card.n !== card.n)) dropBody(q);
  q.card = card; people.set(uid, q);
}
function setPos(uid, p) {
  if (muted.has(uid)) p = null;
  const q = people.get(uid) || { uid, phase: 0, amt: 0 };
  people.set(uid, q);
  if (!p) { q.to = q.cur = null; dropBody(q); if (!q.card) people.delete(uid); return; }
  const far = !q.cur || Math.hypot(q.cur.x - p.x, q.cur.z - p.z) > 8;
  q.to = p; q.from = far ? { ...p } : { ...q.cur }; q.cur = far ? { ...p } : q.cur; q.t = 0;
}
const clearPos = () => { for (const q of people.values()) { q.to = q.cur = null; dropBody(q); } };
const turnTo = (a, b, k) => a + ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * k;
let order = [], orderT = 0;
frameHooks.push((dt) => {
  if (!people.size) return;
  const f = player.floor;
  if ((orderT -= dt) <= 0) {                                 // 每 0.3 秒排一次：離我最近的 MAX_BODY 個人才畫
    orderT = 0.3;
    order = [...people.values()].filter((q) => q.cur && q.card);
    for (const q of order) q.d = Math.hypot(q.cur.x - player.x, q.cur.z - player.z);
    order.sort((a, b) => a.d - b.d);
    order.forEach((q, i) => { const show = i < MAX_BODY && q.d < FAR; if (!show && q.g) dropBody(q); q.show = show; });
  }
  for (const q of order) {
    if (!q.cur || !q.card || !q.to) continue;
    // 補間：位置每 0.5 秒才來一次，中間畫順
    q.t = Math.min(1, q.t + dt / 0.6);
    const ox = q.cur.x, oz = q.cur.z;
    q.cur.x = q.from.x + (q.to.x - q.from.x) * q.t; q.cur.z = q.from.z + (q.to.z - q.from.z) * q.t; q.cur.h = q.from.h + (q.to.h - q.from.h) * q.t;
    q.cur.yaw = turnTo(q.cur.yaw, q.to.yaw, Math.min(1, dt * 9));
    if (!q.show) continue;
    if (!q.g) {
      q.g = cloneBody(q.card.g, q.card.o); group.add(q.g);
      q.label = makeLabel(`${q.card.r === 't' ? '🧑‍🏫 ' : ''}${q.card.n}`, '', 0, 0, 0, { bg: q.card.r === 't' ? '#2d6a4f' : '#2f6fb5', h: 0.34 }); group.add(q.label);
    }
    const moved = Math.hypot(q.cur.x - ox, q.cur.z - oz);
    q.phase += moved * 3.2; q.amt += ((moved > 0.002 ? 1 : 0) - q.amt) * Math.min(1, dt * 10);
    animatePerson(q.g, q.phase, q.amt);
    const y = f.y + q.cur.h;
    q.g.position.set(q.cur.x, y, q.cur.z); q.g.rotation.y = q.cur.yaw;
    if (q.act) { if (!pose(q.g, q.act.k, (performance.now() - q.act.t0) / 1000)) q.act = null; }
    q.label.position.set(q.cur.x, y + 2.05 * AVATAR_SCALE, q.cur.z);
    q.label.visible = mode !== 'bird' && q.d < LABEL_FAR;
    if (q.say) {
      if (performance.now() - q.say.t0 > SHOW_SEC * 1000) { if (q.say.label) dropLabel(q.say.label); q.say = null; }
      else {
        if (!q.say.label) { q.say.label = makeBubble(q.say.k); group.add(q.say.label); }
        q.say.label.position.set(q.cur.x, y + 2.05 * AVATAR_SCALE + BUBBLE_UP, q.cur.z); q.say.label.visible = q.label.visible;
      }
    }
  }
});
// 小地圖：藍點＝學生、綠點＝老師
mapHooks.push((c, toS, N) => {
  for (const q of people.values()) {
    if (!q.cur || !q.card) continue;
    const [a, b] = toS(q.cur.x, q.cur.z);
    if (a < -6 || b < -6 || a > N + 6 || b > N + 6) continue;
    c.beginPath(); c.arc(a, b, 5.5, 0, Math.PI * 2); c.fillStyle = q.card.r === 't' ? '#2d8a57' : '#2f6fd6'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
  }
});

// 收到別人說的話、做的動作（代號不認識、這個人被我設成不看，就不理）
function receiveAct(uid, k) {
  const q = people.get(uid);
  if (!q?.card || muted.has(uid) || !(SAY[k] || ACT[k])) return;
  if (ACT[k]) q.act = { k, t0: performance.now() };
  if (k === 'a2') highFive(uid);
  if (q.say?.label) dropLabel(q.say.label);
  q.say = { k, t0: performance.now(), label: null };
}

/* ---- 我自己：動作、泡泡 ---- */
const mine = { act: null, say: null, x: 0, z: 0 };
frameHooks.push(() => {
  if (mine.act) {
    if (Math.hypot(player.x - mine.x, player.z - mine.z) > 0.3) { mine.act.t0 = -1e9; }        // 走開就停
    if (!pose(avatar, mine.act.k, (performance.now() - mine.act.t0) / 1000)) mine.act = null;
  }
  if (mine.say) {
    if (performance.now() - mine.say.t0 > SHOW_SEC * 1000 || mode === 'first') { dropLabel(mine.say.label); mine.say = null; }
    else mine.say.label.position.set(avatar.position.x, avatar.position.y + 2.05 * AVATAR_SCALE + 0.1, avatar.position.z);
  }
});
function showMine(k) {
  mine.x = player.x; mine.z = player.z;
  if (ACT[k]) mine.act = { k, t0: performance.now() };
  if (k === 'a2') highFive('me');
  if (mine.say) { dropLabel(mine.say.label); mine.say = null; }
  if (mode !== 'first') { const label = makeBubble(k); group.add(label); mine.say = { label, t0: performance.now() }; }
}

/* ---- 擊掌彩蛋：兩個人站得近（2.6 公尺內）、3 秒內都做「擊掌」→ 兩人轉向對方、中間噴彩帶＋拍手聲
   不用另外傳資料：每台電腦看自己收到的動作各自判斷，旁邊的同學也看得到彩帶 ---- */
const HF_MS = 3000, HF_DIST = 2.6, HF_KEY = 'campus-online-highfive-count';
const hfRecent = [];
const posOf = (who) => (who === 'me' ? { x: player.x, z: player.z, y: player.floor.y + (player.gy || 0) } : (() => { const q = people.get(who); return q?.cur ? { x: q.cur.x, z: q.cur.z, y: player.floor.y + (q.cur.h || 0) } : null; })());
const faceYaw = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
function highFive(who) {
  const now = performance.now(), at = posOf(who);
  if (!at) return;
  for (let i = hfRecent.length - 1; i >= 0; i--) if (now - hfRecent[i].t > HF_MS) hfRecent.splice(i, 1);
  const mate = hfRecent.find((r) => r.who !== who && !r.used && Math.hypot(r.x - at.x, r.z - at.z) < HF_DIST);
  if (!mate) { hfRecent.push({ who, t: now, ...at }); return; }
  mate.used = true;
  const pb = posOf(mate.who) || mate;
  burst((at.x + pb.x) / 2, Math.max(at.y, pb.y) + 1.75 * AVATAR_SCALE, (at.z + pb.z) / 2);
  // 兩個人轉向對方（我自己：直接轉；別人：在我的畫面上轉過來，他那邊也會轉、位置更新時傳過來）
  for (const [w, o] of [[who, pb], [mate.who, at]]) {
    if (w === 'me') { avatar.rotation.y = faceYaw(posOf('me'), o); continue; }
    const q = people.get(w); if (q?.to) { q.to.yaw = faceYaw(q.cur, o); }
  }
  const other = who === 'me' ? mate.who : mate.who === 'me' ? who : null;
  if (other) {
    clap();
    let n = 1; try { n = (+localStorage.getItem(HF_KEY) || 0) + 1; localStorage.setItem(HF_KEY, String(n)); } catch { /* 私密模式 */ }
    const nm = people.get(other)?.card?.n || T('同學', 'a friend');
    toast(T(`🙌 跟${esc(nm)}擊掌成功！（第 ${n} 次）`, `🙌 High five with ${esc(nm)}! (#${n})`));
  }
}
// 彩帶：一把小方塊往上噴、慢慢轉著落下，1.8 秒後收掉
const confetti = [], CONF_COL = ['#ff4d6d', '#ffd23f', '#3ec1d3', '#7bd389', '#b07cff', '#ff9f1c', '#ffffff'];
const confGeo = new THREE.BoxGeometry(0.07, 0.07, 0.015);
const confMat = CONF_COL.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
function burst(x, y, z) {
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(confGeo, confMat[i % confMat.length]), a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 2.2;
    m.position.set(x, y, z); m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    m.userData = { v: new THREE.Vector3(Math.cos(a) * s * 0.6, 2.4 + Math.random() * 2.4, Math.sin(a) * s * 0.6), w: (Math.random() - 0.5) * 14, life: 1.8 };
    group.add(m); confetti.push(m);
  }
}
frameHooks.push((dt) => {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const m = confetti[i], u = m.userData;
    u.life -= dt; u.v.y -= 6 * dt; u.v.multiplyScalar(1 - dt * 1.5);
    m.position.addScaledVector(u.v, dt); m.rotation.x += u.w * dt; m.rotation.y += u.w * 0.7 * dt;
    if (u.life <= 0) { group.remove(m); confetti.splice(i, 1); }
  }
});
// 拍手聲＋叮（WebAudio，現場合成，不用下載音檔）
let hfAudio = null;
function clap() {
  try {
    hfAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const a = hfAudio, t = a.currentTime;
    const n = a.createBuffer(1, a.sampleRate * 0.12, a.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = n; bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8; g.gain.value = 0.6;
    src.connect(bp).connect(g).connect(a.destination); src.start(t);
    [1318.5, 1760, 2093].forEach((f, i) => {
      const o = a.createOscillator(), gg = a.createGain(); o.type = 'triangle'; o.frequency.value = f;
      gg.gain.setValueAtTime(0, t + 0.08 + i * 0.07); gg.gain.linearRampToValueAtTime(0.12, t + 0.1 + i * 0.07); gg.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + i * 0.07);
      o.connect(gg).connect(a.destination); o.start(t + 0.08 + i * 0.07); o.stop(t + 0.6 + i * 0.07);
    });
  } catch { /* 沒有聲音也沒關係 */ }
}

/* ---- 我自己的狀態（給連線用） ---- */
const look = () => ({ g: avatar.userData.gender, o: wearing(avatar.userData.gender) });
let last = { x: 0, z: 0, t: 0 };
function where() {
  const now = performance.now(), walk = Math.hypot(player.x - last.x, player.z - last.z) > 0.05;
  if (now - last.t > 200) last = { x: player.x, z: player.z, t: now };
  return { f: player.floor.id, x: player.x, z: player.z, yaw: avatar.rotation.y, walk, h: Math.max(-9, Math.min(30, (player.ride != null ? player.ride - player.floor.y : (player.gy || 0) + (player.jump || 0)))) };
}

/* ---- 面板 ---- */
const REASON = {
  off: ['「同學在線上」目前關閉', 'Online mode is closed right now'], hours: ['現在不是開放時間', 'Online mode is not open at this hour'],
  test: ['還在測試，過一陣子再來看看', 'Still being tested. Come back later.'], denied: ['目前不能加入（已關閉，或這個帳號被停用）', 'You cannot join right now'],
  afk: ['閒置太久，先離開了。要的話再按「加入」', 'You were away for a while, so you left. Press Join to come back.'], error: ['連線出了問題，請再試一次', 'Connection problem. Please try again.'],
};
export function initOnline({ app, user, role, SDK, after }) {
  let cfg = null, me = null, net = null, db = null, D = null, state = 'left', count = null, slowT = 0, hideT = 0, adminOffs = [];
  const btn = document.createElement('button'); btn.className = 'iconbtn'; btn.id = 'onlineBtn'; btn.hidden = true; after.after(btn);
  const box = document.createElement('div'); box.id = 'online'; box.hidden = true; document.body.appendChild(box);
  box.addEventListener('keydown', (e) => e.stopPropagation());
  // 說話、動作的小列：加入以後出現在畫面下方；點 💬 選一句話、點 🙌 選一個動作（不能打字）
  const bar = document.createElement('div'); bar.id = 'onlineBar'; bar.hidden = true; document.body.appendChild(bar);
  let menu = '', coolT = 0;
  bar.addEventListener('keydown', (e) => e.stopPropagation());
  const updateBar = () => {
    const on = state === 'online' && !!net && !net.hidden, chat = cfg?.chat !== false;
    bar.hidden = !on; if (!on) { menu = ''; return; }
    const cool = Date.now() < coolT;
    const list = menu === 'say' ? Object.keys(SAY).map((k) => `<button data-k="${k}">${esc(T(...SAY[k]))}</button>`) : menu === 'act' ? Object.keys(ACT).map((k) => `<button data-k="${k}">${ACT[k][0]} ${esc(T(ACT[k][1], ACT[k][2]))}</button>`) : [];
    bar.innerHTML = (list.length ? `<div class="menu">${list.join('')}</div>` : '')
      + `<div class="row2">${chat ? `<button class="iconbtn m ${menu === 'say' ? 'on' : ''}" data-m="say" ${cool ? 'disabled' : ''}>💬 ${T('說話', 'Say')}</button>` : ''}<button class="iconbtn m ${menu === 'act' ? 'on' : ''}" data-m="act" ${cool ? 'disabled' : ''}>🙌 ${T('動作', 'Act')}</button></div>`;
  };
  bar.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return; b.blur();
    if (b.dataset.m) { menu = menu === b.dataset.m ? '' : b.dataset.m; updateBar(); return; }
    if (!b.dataset.k) return;
    const k = b.dataset.k; menu = ''; coolT = Date.now() + SAY_GAP; updateBar(); setTimeout(updateBar, SAY_GAP + 50);
    if (await net.say(k)) showMine(k); else { coolT = 0; toast(T('👥 現在送不出去，等一下再試', '👥 Could not send. Try again in a moment.')); updateBar(); }
  });
  const nOnline = () => [...people.values()].filter((q) => q.card).length;
  const setBtn = () => {
    const n = state === 'online' ? nOnline() : count;
    btn.dataset.zh = btn.dataset.en = `👥 ${n ?? ''}`.trim(); btn.innerHTML = btn.dataset.zh;
    btn.title = T('同學在線上', 'Who is online'); btn.setAttribute('aria-label', btn.title); btn.classList.toggle('primary', state === 'online'); updateBar();
  };
  const rest = async (p) => { const r = await fetch(`${DB_URL}/${p.split('/').map(encodeURIComponent).join('/')}.json?auth=${await user.getIdToken()}`); if (!r.ok) throw new Error(r.status); return r.json(); };
  const why = () => denyReason(cfg, { ...me, now: net?.now() ?? Date.now() });

  const start = async () => {
    const t = await user.getIdTokenResult(), key = emailKey(user.email);
    let given = ''; try { const o = JSON.parse(localStorage.getItem('campus-given-name')); if (o?.uid === user.uid) given = o.g; } catch { /* 沒有就算了 */ }
    const full = t.claims.name || user.displayName;
    me = { uid: user.uid, n: role === 'teacher' ? teacherName(full, given) : cleanName(full), r: role === 'teacher' ? 't' : 's', admin: false, tester: false };
    [cfg, me.admin, me.tester] = await Promise.all([rest('online/config').catch(() => null), rest(`online/admins/${key}`).then((v) => v === true).catch(() => false), rest(`online/testers/${key}`).then((v) => v === true).catch(() => false)]);
    const y = why();
    if (!me.n || (!me.admin && (y === 'off' || y === 'test'))) return;                 // 沒開放：不顯示按鈕
    btn.hidden = false;
    if (!y) count = await rest('online/players').then((v) => Object.keys(v || {}).length).catch(() => null);
    setBtn();
    let again = false; try { again = localStorage.getItem(JOIN_KEY) === user.uid; } catch { /* 私密模式 */ }
    if (again && !y) join(true);
  };
  const load = async () => {
    if (D) return;
    D = await import(SDK + 'firebase-database.js');
    db = D.getDatabase(app, DB_URL);
    net = new OnlineNet({ D, db, me, look, where, on: {
      player: (uid, v) => { if (uid !== me.uid) { setCard(uid, v); setBtn(); drawList(); } },
      pos: setPos, floor: clearPos,
      config: (c) => { cfg = c; updateBar(); },
      act: (uid, v) => { if (net.now() - v.t <= 6000) receiveAct(uid, v.k); },      // 太舊的（剛進來時留在那裡的）不演
      state: (s, reason) => {
        state = s; clearTimeout(slowT);
        if (s === 'connecting') slowT = setTimeout(() => toast(T('👥 連線比較久，可能是人數滿了或網路擋住，先自己逛逛吧', '👥 Connecting is taking a while. The server may be full or blocked.')), 12000);
        if (s === 'left') { for (const uid of [...people.keys()]) setCard(uid, null); if (reason && reason !== 'user' && reason !== 'idle') toast('👥 ' + T(...(REASON[reason] || REASON.error))); }
        setBtn(); draw();
      },
    } });
  };
  const join = async (auto) => {
    try { await load(); } catch (e) { console.warn('連線元件沒有載入', e); if (!auto) toast(T(...REASON.error)); return; }
    try { localStorage.setItem(JOIN_KEY, user.uid); } catch { /* 私密模式 */ }
    net.join();
  };
  const leave = () => { try { localStorage.removeItem(JOIN_KEY); } catch { /* 私密模式 */ } net?.leave('user'); };
  // 分頁放到背景 3 分鐘：先離開（空出名額），回來再自動加入
  let idle = false;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(hideT);
    if (document.hidden) hideT = setTimeout(() => { if (net?.joined) { idle = true; net.leave('idle'); } }, 180e3);
    else if (idle) { idle = false; join(true); }
  });
  // 閒置太久就請出去：IDLE_MIN 分鐘沒有按鍵、滑鼠、觸控，人也沒走動（蓋上螢幕、人離開座位，分頁卻沒有進背景的情況）
  const IDLE_MIN = 5; let lastIn = Date.now(), lastXZ = [player.x, player.z];
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']) addEventListener(ev, () => { lastIn = Date.now(); }, { passive: true, capture: true });
  setInterval(() => {
    if (Math.hypot(player.x - lastXZ[0], player.z - lastXZ[1]) > 0.5) { lastXZ = [player.x, player.z]; lastIn = Date.now(); }
    if (net?.joined && Date.now() - lastIn > IDLE_MIN * 60e3) { try { localStorage.removeItem(JOIN_KEY); } catch { /* 私密模式 */ } net.leave('afk'); }
  }, 15e3);
  addEventListener('pagehide', () => { if (net?.joined) { net.leave('idle'); idle = true; } });
  addEventListener('pageshow', (e) => { if (e.persisted && idle) { idle = false; join(true); } });

  const floorName = (id) => (id === 'B1' ? T('地下室', 'Basement') : T(`${id[0]} 樓`, id));
  const drawList = () => {
    const ul = box.querySelector('.list'); if (!ul || box.hidden) return;
    const list = [...people.values()].filter((q) => q.card).sort((a, b) => (a.card.r === b.card.r ? a.card.n.localeCompare(b.card.n, 'zh-Hant') : a.card.r === 't' ? -1 : 1));
    ul.innerHTML = list.length ? list.map((q) => `<li><span>${q.card.r === 't' ? '🧑‍🏫' : '🎒'} ${esc(q.card.n)}</span><small>${esc(floorName(q.card.f))}</small><button class="mute" data-uid="${esc(q.uid)}">${T('不看', 'Mute')}</button>${me.admin ? `<button class="kick" data-uid="${esc(q.uid)}">${T('停用', 'Block')}</button>` : ''}</li>`).join('')
      : `<li class="none">${T('現在沒有其他人，叫同學一起來！', 'Nobody else is here. Invite a friend!')}</li>`;
  };
  function draw() {
    if (box.hidden) return;
    const y = cfg ? why() : 'off', on = state === 'online';
    box.innerHTML = `<div class="hd"><b>${T('👥 同學在線上', '👥 Who is online')}</b><button class="x" aria-label="${T('關閉', 'Close')}">✕</button></div>`
      + (on ? `<p>${T(`你是「${esc(me.n)}」，大家看得到你。同一層樓的同學會出現在校園和小地圖上。`, `You are "${esc(me.n)}". Everyone online can see you.`)}</p><ul class="list"></ul>${muted.size ? `<div class="muted"><small>${T('不看的人', 'Muted')}</small> ${[...muted].map(([u, n]) => `<button data-u="${esc(u)}">${esc(n)} ✕</button>`).join(' ')}</div>` : ''}<button class="big hide">${net?.hidden ? T('👀 讓大家看到我', 'Show me again') : T('🙈 隱藏自己（我看得到大家）', 'Hide me (I can still see everyone)')}</button>${net?.hidden ? `<p><small>${T('現在別人看不到你，你也不能說話。', 'Others cannot see you now, and you cannot talk.')}</small></p>` : ''}<button class="big leave">${T('離開（別人看不到我）', 'Leave (hide me)')}</button>`
        : state === 'connecting' ? `<p>${T('連線中…', 'Connecting…')}</p><button class="big leave">${T('取消', 'Cancel')}</button>`
          : y && !(me.admin && y === 'test') ? `<p>${T(...REASON[y])}${y === 'hours' ? T(`（${cfg.from}:00～${cfg.to}:00）`, ` (${cfg.from}:00–${cfg.to}:00)`) : ''}</p>`
            : `<p>${T(`加入以後，登入的溪口師生會看到你的名字「${esc(me.n)}」和你在校園的位置。離開或關掉網頁就看不到了，不會留下位置紀錄。`, `After you join, signed-in Xikou teachers and students can see your name "${esc(me.n)}" and where you are. It disappears when you leave or close the page.`)}</p><button class="big join">${T('加入', 'Join')}</button>`)
      + (me.admin ? '<div class="admin"></div>' : '');
    box.querySelector('.x').onclick = () => { box.hidden = true; };
    const j = box.querySelector('.join'), l = box.querySelector('.leave');
    if (j) j.onclick = () => { j.disabled = true; join(); };
    if (l) l.onclick = leave;
    const h = box.querySelector('.hide'); if (h) h.onclick = async () => { h.disabled = true; await net.setHidden(!net.hidden); draw(); updateBar(); };
    box.querySelectorAll('.muted [data-u]').forEach((x) => { x.onclick = () => { muted.delete(x.dataset.u); saveMuted(); toast(T('👥 取消不看了，對方動一動就會再出現', 'Unmuted. They will show up again soon.')); draw(); }; });
    drawList(); drawAdmin();
  }
  btn.onclick = () => { box.hidden = !box.hidden; draw(); if (!box.hidden && me.admin) adminWatch(); };
  box.addEventListener('click', (e) => {
    const m = e.target.closest('.mute');
    if (m) { const q = people.get(m.dataset.uid); if (q?.card && confirm(T(`不看「${q.card.n}」嗎？\n你的畫面上就不會出現這個人和他說的話（只有你看不到，不會通知對方）。`, `Mute "${q.card.n}"? You will not see them or what they say.`))) { muted.set(q.uid, q.card.n); saveMuted(); setCard(q.uid, null); setPos(q.uid, null); setBtn(); draw(); } return; }
    const k = e.target.closest('.kick'); if (!k) return;
    const q = people.get(k.dataset.uid); if (!q?.card || !confirm(T(`要停用「${q.card.n}」嗎？\n馬上請出，之後也不能加入（可以在下面解除）。`, `Block "${q.card.n}"?`))) return;
    const up = { [`blocked/${q.uid}`]: q.card.n.slice(0, 40), [`players/${q.uid}`]: null };
    for (const f of floors) up[`pos/${f.id}/${q.uid}`] = null;
    D.update(D.ref(db, 'online'), up).catch((err) => toast(T('停用失敗：', 'Failed: ') + esc(err.code || err)));
  });

  /* 管理員：總開關、開放對象、時段、測試名單、停用名單（規則只讓 online/admins 裡的帳號改） */
  let testers = {}, blocked = {}, logRows = '';
  const when = (t) => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  async function loadLog() {
    try {
      const snap = await D.get(D.query(D.ref(db, 'online/log'), D.orderByChild('t'), D.limitToLast(50))), rows = [];
      snap.forEach((c) => { rows.unshift(c.val()); });
      logRows = rows.map((l) => `<li><span>${esc(when(l.t))} ${esc(l.n)}　${SAY[l.k] ? '💬 ' + esc(SAY[l.k][0]) : ACT[l.k] ? ACT[l.k][0] + ' ' + esc(ACT[l.k][1]) : esc(l.k)}</span><small>${esc(floorName(l.f))}</small></li>`).join('') || '<li class="none">還沒有紀錄</li>';
    } catch (e) { logRows = '<li class="none">讀不到紀錄：' + esc(e.code || e) + '</li>'; }
    drawAdmin();
  }
  async function purgeLog() {                                  // 清掉太舊的（保存約一學期）
    try {
      const snap = await D.get(D.query(D.ref(db, 'online/log'), D.orderByChild('t'), D.endAt(Date.now() - KEEP_DAYS * 864e5), D.limitToFirst(300))), up = {};
      snap.forEach((c) => { up[c.key] = null; });
      if (Object.keys(up).length) await D.update(D.ref(db, 'online/log'), up);
    } catch (e) { console.debug('清舊紀錄失敗', e); }
  }
  async function adminWatch() {
    if (adminOffs.length) return;
    try { await load(); } catch { return; }
    net.keep = true;                                         // 管理員開過管理面板：離開後也保持連線，才能再打開總開關
    if (!net.joined) D.goOnline(db);
    const w = (p, f) => adminOffs.push(D.onValue(D.ref(db, p), (s) => { f(s.val() || null); drawAdmin(); }, () => {}));
    purgeLog();
    w('online/config', (v) => { cfg = v; updateBar(); }); w('online/testers', (v) => { testers = v || {}; }); w('online/blocked', (v) => { blocked = v || {}; });
  }
  const save = (patch) => {
    const next = { on: false, stage: 'test', from: 7, to: 21, ...cfg, ...patch };
    return D.set(D.ref(db, 'online/config'), next).then(() => { cfg = next; draw(); }).catch((e) => toast(T('設定失敗：', 'Failed: ') + esc(e.code || e)));
  };
  function drawAdmin() {
    const a = box.querySelector('.admin'); if (!a || box.hidden) return;
    if (a.contains(document.activeElement) && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) return;   // 正在填，不要重畫
    const c = { on: false, stage: 'test', from: 7, to: 21, ...cfg };
    a.innerHTML = `<b>🔧 管理</b><button class="big sw ${c.on ? 'off' : ''}">${c.on ? '總開關：開著（按一下全部關掉）' : '總開關：關著（按一下打開）'}</button>
      <label>開放對象 <select class="stage"><option value="test">只有測試名單</option><option value="all">全校師生</option></select></label>
      <label>說話 <select class="chat"><option value="1">開（5 句話＋4 個動作）</option><option value="0">關（只留動作）</option></select></label>
      <label>時段 <input class="from" type="number" min="0" max="24" value="${c.from}"> 點到 <input class="to" type="number" min="0" max="24" value="${c.to}"> 點</label>
      <div>測試名單<ul class="t">${Object.keys(testers).map((k) => `<li><span>${esc(k.replaceAll(',', '.'))}</span><button data-k="${esc(k)}">移除</button></li>`).join('') || '<li class="none">還沒有人</li>'}</ul>
      <span class="row"><input class="mail" type="email" placeholder="學校帳號 email"><button class="add">加入</button></span></div>
      <div><button class="logbtn">📜 看紀錄（最近 50 筆）</button><ul class="lg">${logRows}</ul><small>每次打開管理面板，會自動清掉 ${KEEP_DAYS} 天前的紀錄。</small></div>
      ${Object.keys(blocked).length ? `<div>停用的帳號<ul class="b">${Object.entries(blocked).map(([u, nm]) => `<li><span>${esc(nm)}</span><button data-u="${esc(u)}">解除</button></li>`).join('')}</ul></div>` : ''}`;
    a.querySelector('.stage').value = c.stage; a.querySelector('.chat').value = c.chat === false ? '0' : '1';
    a.querySelector('.sw').onclick = () => save({ on: !c.on });
    a.querySelector('.stage').onchange = (e) => { if (e.target.value === 'all' && !confirm('要開放給全校師生嗎？')) { e.target.value = 'test'; return; } e.target.blur(); save({ stage: e.target.value }); };
    a.querySelector('.chat').onchange = (e) => { const v = e.target.value === '1'; e.target.blur(); save({ chat: v }); };
    for (const k of ['from', 'to']) a.querySelector('.' + k).onchange = (e) => { const v = Math.max(0, Math.min(24, +e.target.value || 0)); e.target.blur(); save({ [k]: v }); };
    a.querySelector('.add').onclick = () => {
      const m = a.querySelector('.mail').value.trim().toLowerCase();
      if (!/^[^@\s]+@(st\.)?skps\.tp\.edu\.tw$/.test(m)) { toast('請填學校帳號的 email'); return; }
      document.activeElement?.blur?.(); D.set(D.ref(db, `online/testers/${emailKey(m)}`), true).catch((e) => toast('加入失敗：' + esc(e.code || e)));
    };
    a.querySelector('.logbtn').onclick = loadLog;
    a.querySelectorAll('.t [data-k]').forEach((b) => { b.onclick = () => D.remove(D.ref(db, `online/testers/${b.dataset.k}`)); });
    a.querySelectorAll('.b [data-u]').forEach((b) => { b.onclick = () => D.remove(D.ref(db, `online/blocked/${b.dataset.u}`)); });
  }
  start().catch((e) => console.warn('同學在線上沒有載入', e));
}

/* 本機測試用（網址 ?onlinedemo=30，只在 localhost 有效）：放幾個假的同學走來走去，看畫面、測效能 */
export function demo(n) {
  const NAMES = ['王小明', '陳小華', '林小美', '張小強', '李小安', '黃小婷'], FITS = ['uniform', 'basketball', 'recorder', 'dance', 'swimteam'];
  const bots = Array.from({ length: n }, (_, i) => ({ uid: 'bot' + i, a: i * 2.4, r: 2 + (i % 8), x: player.x, z: player.z }));
  bots.forEach((b, i) => setCard(b.uid, { n: NAMES[i % 6] + (i > 5 ? i : ''), r: i % 11 === 10 ? 't' : 's', g: i % 2 ? 'girl' : 'boy', o: FITS[i % 5], f: player.floor.id }));
  const step = () => bots.forEach((b) => { b.a += 0.35; const x = b.x + Math.cos(b.a) * b.r, z = b.z + Math.sin(b.a) * b.r; setPos(b.uid, { x, z, yaw: -b.a - Math.PI, walk: true, h: player.gy || 0 }); });
  step(); const timer = setInterval(step, 500);
  window.__onlineDemo = { people, receiveAct, showMine, pose, confetti, stop: () => { clearInterval(timer); for (const b of bots) setCard(b.uid, null); } };
}
