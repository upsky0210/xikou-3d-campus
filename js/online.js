/* ---------------- 同學在線上：畫面（方塊人、名牌、小地圖點點、面板、管理員開關）；連線在 online-net.js ----------------
   只有登入的溪口師生，而且按了「加入」才會被看到；按「離開」、關網頁、分頁放到背景 3 分鐘就消失。
   登入後由 auth.js 載入。沒加入之前不開即時連線（免費方案同時 100 個），只用一般的網路請求看一下有沒有開放、幾個人。 */
import * as THREE from 'three';
import { makeBlockPerson, animatePerson, mergeStatic } from './blocks.js?v=351';
import { T, scene, floors, player, avatar, wearing, mode, makeLabel, toast, frameHooks, mapHooks, AVATAR_SCALE } from './app.js?v=351';
import { DB_URL, OnlineNet, cleanName, emailKey, denyReason } from './online-net.js?v=351';

const JOIN_KEY = 'campus-online';                            // 這台電腦上次加入的帳號（記 uid；換人登入不會自動加入）
const MAX_BODY = 24, FAR = 45, LABEL_FAR = 16;               // 最多畫幾個人、多遠就不畫、名牌多遠就不顯示
const floorOf = (id) => floors.find((f) => f.id === id);
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
function dropBody(q) {
  if (q.g) group.remove(q.g);
  if (q.label) { group.remove(q.label); q.label.material.map?.dispose(); q.label.material.dispose(); }
  q.g = q.label = null;
}
function setCard(uid, card) {
  if (!card) { const q = people.get(uid); if (q) { dropBody(q); people.delete(uid); } return; }
  const q = people.get(uid) || { uid, phase: 0, amt: 0 };
  if (q.card && (q.card.g !== card.g || q.card.o !== card.o || q.card.n !== card.n)) dropBody(q);
  q.card = card; people.set(uid, q);
}
function setPos(uid, p) {
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
    q.label.position.set(q.cur.x, y + 2.05 * AVATAR_SCALE, q.cur.z);
    q.label.visible = mode !== 'bird' && q.d < LABEL_FAR;
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
  test: ['還在測試，過一陣子再來看看', 'Still being tested. Come back later.'], denied: ['目前不能加入（已關閉，或這個帳號被停用）', 'You cannot join right now'], error: ['連線出了問題，請再試一次', 'Connection problem. Please try again.'],
};
export function initOnline({ app, user, role, SDK, after }) {
  let cfg = null, me = null, net = null, db = null, D = null, state = 'left', count = null, slowT = 0, hideT = 0, adminOffs = [];
  const btn = document.createElement('button'); btn.className = 'iconbtn'; btn.id = 'onlineBtn'; btn.hidden = true; after.after(btn);
  const box = document.createElement('div'); box.id = 'online'; box.hidden = true; document.body.appendChild(box);
  box.addEventListener('keydown', (e) => e.stopPropagation());
  const nOnline = () => [...people.values()].filter((q) => q.card).length;
  const setBtn = () => {
    const n = state === 'online' ? nOnline() : count;
    btn.dataset.zh = btn.dataset.en = `👥 ${n ?? ''}`.trim(); btn.innerHTML = btn.dataset.zh;
    btn.title = T('同學在線上', 'Who is online'); btn.setAttribute('aria-label', btn.title); btn.classList.toggle('primary', state === 'online');
  };
  const rest = async (p) => { const r = await fetch(`${DB_URL}/${p.split('/').map(encodeURIComponent).join('/')}.json?auth=${await user.getIdToken()}`); if (!r.ok) throw new Error(r.status); return r.json(); };
  const why = () => denyReason(cfg, { ...me, now: net?.now() ?? Date.now() });

  const start = async () => {
    const t = await user.getIdTokenResult(), key = emailKey(user.email);
    me = { uid: user.uid, n: cleanName(t.claims.name || user.displayName), r: role === 'teacher' ? 't' : 's', admin: false, tester: false };
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
  addEventListener('pagehide', () => { if (net?.joined) { net.leave('idle'); idle = true; } });
  addEventListener('pageshow', (e) => { if (e.persisted && idle) { idle = false; join(true); } });

  const floorName = (id) => (id === 'B1' ? T('地下室', 'Basement') : T(`${id[0]} 樓`, id));
  const drawList = () => {
    const ul = box.querySelector('.list'); if (!ul || box.hidden) return;
    const list = [...people.values()].filter((q) => q.card).sort((a, b) => (a.card.r === b.card.r ? a.card.n.localeCompare(b.card.n, 'zh-Hant') : a.card.r === 't' ? -1 : 1));
    ul.innerHTML = list.length ? list.map((q) => `<li><span>${q.card.r === 't' ? '🧑‍🏫' : '🎒'} ${esc(q.card.n)}</span><small>${esc(floorName(q.card.f))}</small>${me.admin ? `<button class="kick" data-uid="${esc(q.uid)}">${T('停用', 'Block')}</button>` : ''}</li>`).join('')
      : `<li class="none">${T('現在沒有其他人，叫同學一起來！', 'Nobody else is here. Invite a friend!')}</li>`;
  };
  function draw() {
    if (box.hidden) return;
    const y = cfg ? why() : 'off', on = state === 'online';
    box.innerHTML = `<div class="hd"><b>${T('👥 同學在線上', '👥 Who is online')}</b><button class="x" aria-label="${T('關閉', 'Close')}">✕</button></div>`
      + (on ? `<p>${T(`你是「${esc(me.n)}」，大家看得到你。同一層樓的同學會出現在校園和小地圖上。`, `You are "${esc(me.n)}". Everyone online can see you.`)}</p><ul class="list"></ul><button class="big leave">${T('離開（別人看不到我）', 'Leave (hide me)')}</button>`
        : state === 'connecting' ? `<p>${T('連線中…', 'Connecting…')}</p><button class="big leave">${T('取消', 'Cancel')}</button>`
          : y && !(me.admin && y === 'test') ? `<p>${T(...REASON[y])}${y === 'hours' ? T(`（${cfg.from}:00～${cfg.to}:00）`, ` (${cfg.from}:00–${cfg.to}:00)`) : ''}</p>`
            : `<p>${T(`加入以後，登入的溪口師生會看到你的名字「${esc(me.n)}」和你在校園的位置。離開或關掉網頁就看不到了，不會留下位置紀錄。`, `After you join, signed-in Xikou teachers and students can see your name "${esc(me.n)}" and where you are. It disappears when you leave or close the page.`)}</p><button class="big join">${T('加入', 'Join')}</button>`)
      + (me.admin ? '<div class="admin"></div>' : '');
    box.querySelector('.x').onclick = () => { box.hidden = true; };
    const j = box.querySelector('.join'), l = box.querySelector('.leave');
    if (j) j.onclick = () => { j.disabled = true; join(); };
    if (l) l.onclick = leave;
    drawList(); drawAdmin();
  }
  btn.onclick = () => { box.hidden = !box.hidden; draw(); if (!box.hidden && me.admin) adminWatch(); };
  box.addEventListener('click', (e) => {
    const k = e.target.closest('.kick'); if (!k) return;
    const q = people.get(k.dataset.uid); if (!q?.card || !confirm(T(`要停用「${q.card.n}」嗎？\n馬上請出，之後也不能加入（可以在下面解除）。`, `Block "${q.card.n}"?`))) return;
    const up = { [`blocked/${q.uid}`]: q.card.n.slice(0, 40), [`players/${q.uid}`]: null };
    for (const f of floors) up[`pos/${f.id}/${q.uid}`] = null;
    D.update(D.ref(db, 'online'), up).catch((err) => toast(T('停用失敗：', 'Failed: ') + esc(err.code || err)));
  });

  /* 管理員：總開關、開放對象、時段、測試名單、停用名單（規則只讓 online/admins 裡的帳號改） */
  let testers = {}, blocked = {};
  async function adminWatch() {
    if (adminOffs.length) return;
    try { await load(); } catch { return; }
    net.keep = true;                                         // 管理員開過管理面板：離開後也保持連線，才能再打開總開關
    if (!net.joined) D.goOnline(db);
    const w = (p, f) => adminOffs.push(D.onValue(D.ref(db, p), (s) => { f(s.val() || null); drawAdmin(); }, () => {}));
    w('online/config', (v) => { cfg = v; }); w('online/testers', (v) => { testers = v || {}; }); w('online/blocked', (v) => { blocked = v || {}; });
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
      <label>時段 <input class="from" type="number" min="0" max="24" value="${c.from}"> 點到 <input class="to" type="number" min="0" max="24" value="${c.to}"> 點</label>
      <div>測試名單<ul class="t">${Object.keys(testers).map((k) => `<li><span>${esc(k.replaceAll(',', '.'))}</span><button data-k="${esc(k)}">移除</button></li>`).join('') || '<li class="none">還沒有人</li>'}</ul>
      <span class="row"><input class="mail" type="email" placeholder="學校帳號 email"><button class="add">加入</button></span></div>
      ${Object.keys(blocked).length ? `<div>停用的帳號<ul class="b">${Object.entries(blocked).map(([u, nm]) => `<li><span>${esc(nm)}</span><button data-u="${esc(u)}">解除</button></li>`).join('')}</ul></div>` : ''}`;
    a.querySelector('.stage').value = c.stage;
    a.querySelector('.sw').onclick = () => save({ on: !c.on });
    a.querySelector('.stage').onchange = (e) => { if (e.target.value === 'all' && !confirm('要開放給全校師生嗎？')) { e.target.value = 'test'; return; } e.target.blur(); save({ stage: e.target.value }); };
    for (const k of ['from', 'to']) a.querySelector('.' + k).onchange = (e) => { const v = Math.max(0, Math.min(24, +e.target.value || 0)); e.target.blur(); save({ [k]: v }); };
    a.querySelector('.add').onclick = () => {
      const m = a.querySelector('.mail').value.trim().toLowerCase();
      if (!/^[^@\s]+@(st\.)?skps\.tp\.edu\.tw$/.test(m)) { toast('請填學校帳號的 email'); return; }
      document.activeElement?.blur?.(); D.set(D.ref(db, `online/testers/${emailKey(m)}`), true).catch((e) => toast('加入失敗：' + esc(e.code || e)));
    };
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
  window.__onlineDemo = { people, stop: () => { clearInterval(timer); for (const b of bots) setCard(b.uid, null); } };
}
