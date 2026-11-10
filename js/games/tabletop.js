/* 剪刀石頭布、顏色對對碰、21 點、OOXX
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import { faceTeacher } from './common.js?v=318';
import { T, scene, makeLabel, updateVisibility, stopAuto, toast, npcFace, act, gameState } from '../app.js?v=318';

/* ---------------- 剪刀石頭布：在五年一班遇到 Poyen 老師，可以猜拳（三戰兩勝，平手重來） ----------------
   點按鈕或按 1／2／3 出拳；喊完「剪刀、石頭、布！」一起亮出來，老師頭上也會冒出他出的拳。 */
const RPS_KEY = 'campus-rps-wins';
const RPS = [{ e: '✌️', n: '剪刀', en: 'Scissors' }, { e: '✊', n: '石頭', en: 'Rock' }, { e: '🖐️', n: '布', en: 'Paper' }];
const rpsN = (h) => T(RPS[h].n, RPS[h].en);
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
    $('.round').textContent = me >= 2 || them >= 2 ? T('比賽結束', 'Game over') : T(`第 ${round + 1} 局`, `Round ${round + 1}`);
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
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const choose = (h) => {
    if (locked) return;
    locked = true; btns.forEach((b) => (b.disabled = true));
    clearHand();
    $('.me').classList.add('shake'); $('.them').classList.add('shake');
    $('.me').textContent = '✊'; $('.them').textContent = '✊';
    msg(T('剪刀、石頭、布！', 'Rock, paper, scissors!'));
    // 老師一起甩手：舉起右手上下擺
    let t = 0;
    act.busy = { label: T('✂️ 剪刀石頭布…', '✂️ Rock, paper, scissors…'), tick(dt) { t += dt; nL.armR.rotation.x = 1.6 + Math.sin(t * 20) * 0.45; } };
    setTimeout(() => {
      if (done) return;                                                // 中途按了結束
      const tHand = Math.random() * 3 | 0, r = (h - tHand + 3) % 3;   // 0 平手、1 你贏、2 老師贏
      $('.me').classList.remove('shake'); $('.them').classList.remove('shake');
      $('.me').textContent = RPS[h].e; $('.them').textContent = RPS[tHand].e;
      nL.armR.rotation.x = 1.9;
      popHand(tHand);
      act.busy = { label: T('✂️ 剪刀石頭布中…', '✂️ Rock-paper-scissors…'), tick() {} };
      if (r === 0) { msg(T(`平手！都出${RPS[h].n}，再來一次！`, `Tie! Both chose ${RPS[h].en}. Again!`)); npcFace(n, 'wink', 1.6); }
      else if (r === 1) { me++; round++; msg(T(`✅ ${RPS[h].n}贏${RPS[tHand].n}！你贏這局！`, `✅ ${RPS[h].en} beats ${RPS[tHand].en}! You win this round!`), 'ok'); npcFace(n, 'sad', 1.8); }
      else { them++; round++; msg(T(`❌ ${RPS[tHand].n}贏${RPS[h].n}！${n.name}贏這局`, `❌ ${RPS[tHand].en} beats ${RPS[h].en}! ${n.name} wins this round`), 'no'); npcFace(n, 'tongue', 1.8); }
      show();
      if (me < 2 && them < 2) { setTimeout(() => { if (!done) ready(); }, 1300); return; }
      // 三戰兩勝結束
      setTimeout(() => {
        if (done) return;
        if (me > them) { wins++; try { localStorage.setItem(n.rpsKey || RPS_KEY, String(wins)); } catch { /* 私密模式 */ } }
        npcFace(n, me > them ? 'surprised' : 'happy', 3);
        finish();
        toast(me > them ? `${T(`🏆 你贏了！${me}：${them}（已經贏${n.name} ${wins} 次）`, `🏆 You win! ${me}:${them} (beat ${n.name} ${wins}×)`)}<br>${n.name}：${n.rpsTalk?.win ?? '好厲害！'}`
          : `${T(`😝 ${n.name}贏了！${them}：${me}`, `😝 ${n.name} wins! ${them}:${me}`)}<br>${n.name}：${n.rpsTalk?.lose ?? '再接再厲！'}`);
      }, 1500);
    }, 900);
  };
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); choose(k); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b) => (b.onclick = () => choose(+b.dataset.h)));
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(T(`✂️ 下次再來找${n.name}猜拳！`, `✂️ Come back to play with ${n.name}!`)); } };
  act.busy = { label: T('✂️ 剪刀石頭布中…', '✂️ Rock-paper-scissors…'), tick() {} };                 // 猜拳時不能走動
  rpsBox.hidden = false;
  msg(`${n.name}：${n.rpsTalk?.start ?? '來猜拳吧！先贏兩局的人獲勝！'}`);
  ready();
}

/* ---------------- 顏色對對碰：在六年五班遇到丁老師，翻牌配對（混色） ----------------
   12 張牌蓋著：6 張是「兩種顏色混在一起」，6 張是混出來的顏色。一次翻兩張，混色和結果配成一對就留著；
   全部配完看翻了幾次，記錄最少次數。 */
const COLOR_KEY = 'campus-colors-best';
const COLOR_MIX = [
  { a: ['#e53935', '紅', 'Red'], b: ['#fdd835', '黃', 'Yellow'], c: ['#fb8c00', '橙色', 'Orange'] },
  { a: ['#fdd835', '黃', 'Yellow'], b: ['#1e88e5', '藍', 'Blue'], c: ['#43a047', '綠色', 'Green'] },
  { a: ['#e53935', '紅', 'Red'], b: ['#1e88e5', '藍', 'Blue'], c: ['#8e24aa', '紫色', 'Purple'] },
  { a: ['#e53935', '紅', 'Red'], b: ['#ffffff', '白', 'White'], c: ['#f8a5c2', '粉紅色', 'Pink'] },
  { a: ['#1e88e5', '藍', 'Blue'], b: ['#ffffff', '白', 'White'], c: ['#8ecdf5', '淺藍色', 'Light blue'] },
  { a: ['#212121', '黑', 'Black'], b: ['#ffffff', '白', 'White'], c: ['#9e9e9e', '灰色', 'Grey'] },
];
const cmBox = document.getElementById('cm');
function startColors(n) {
  stopAuto();
  const $ = (sel) => cmBox.querySelector(sel);
  const grid = $('.grid');
  let best = 0, flips = 0, matched = 0, open = [], lock = false, done = false;
  try { best = +localStorage.getItem(COLOR_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  const dot = (c) => `<i style="background:${c[0]}"></i>`;
  const cards = COLOR_MIX.flatMap((m, k) => [
    { k, html: `${dot(m.a)}<b>＋</b>${dot(m.b)}<small>${m.a[1]}＋${m.b[1]}</small>` },
    { k, html: `<i class="big" style="background:${m.c[0]}"></i><small>${m.c[1]}</small>` },
  ]);
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [cards[i], cards[j]] = [cards[j], cards[i]]; }
  grid.innerHTML = '';
  cards.forEach((cd) => {
    const b = document.createElement('button'); b.className = 'cc'; b.innerHTML = '<span class="q">🎨</span>';
    b.onclick = () => flip(cd, b); grid.appendChild(b);
  });
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const show = () => { $('.flips').textContent = T(`翻了 ${flips} 次${best ? `・最少 ${best} 次` : ''}`, `Flips: ${flips}${best ? ` · best ${best}` : ''}`); };
  const finish = () => {
    done = true; cmBox.hidden = true;
    updateVisibility();
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const flip = (cd, b) => {
    if (lock || done || b.classList.contains('up')) return;
    b.classList.add('up'); b.innerHTML = cd.html;
    open.push([cd, b]);
    if (open.length < 2) return;
    flips++; show();
    const [[c1, b1], [c2, b2]] = open; open = [];
    if (c1.k === c2.k) {
      matched++; b1.classList.add('ok'); b2.classList.add('ok');
      const m = COLOR_MIX[c1.k];
      msg(T(`✅ 答對了！${m.a[1]}色＋${m.b[1]}色＝${m.c[1]}`, `✅ Correct! ${m.a[2]} + ${m.b[2]} = ${m.c[2]}`), 'ok'); npcFace(n, 'happy', 1.5);
      if (matched === COLOR_MIX.length) {
        if (!best || flips < best) { best = flips; try { localStorage.setItem(COLOR_KEY, String(best)); } catch { /* 私密模式 */ } }
        npcFace(n, 'surprised', 3);
        setTimeout(() => { if (done) return; finish(); toast(`${T(`🎨 全部配對完成！翻了 ${flips} 次（最少紀錄：${best} 次）`, `🎨 All matched! ${flips} flips (best ${best})`)}<br>${n.name}：${flips <= 8 ? '哇！你是調色小天才！' : '好棒！下次記住每張牌的位置，會更快喔！'}`); }, 1500);
      }
    } else {
      lock = true; msg(T('❌ 不是一對，記住它們的位置！', '❌ Not a pair. Remember where they are!'), 'no'); npcFace(n, 'wink', 1.2);
      setTimeout(() => { if (done) return; for (const x of [b1, b2]) { x.classList.remove('up'); x.innerHTML = '<span class="q">🎨</span>'; } lock = false; msg(T('再翻兩張看看！', 'Flip two more!')); }, 1100);
    }
  };
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(T(`🎨 下次再來找${n.name}玩顏色對對碰！`, `🎨 Come back for Color Match with ${n.name}!`)); } };
  act.busy = { label: T('🎨 顏色對對碰中…', '🎨 Color Match…'), tick() {} };
  $('.who').textContent = n.name;
  cmBox.hidden = false;
  show();
  msg(`${n.name}：翻兩張牌，找出「混色」和「混出來的顏色」配成一對！`);
}

/* ---------------- 撲克牌 21 點：在六年二班遇到蔡老師，老師當莊家 ----------------
   你和老師各發兩張牌（老師一張蓋著）；按「要牌」（1）多拿一張、「停牌」（2）就換老師。點數加起來最接近 21 的贏，超過 21 就爆掉。
   A 算 1 或 11、J Q K 算 10；老師不到 17 點一定要再拿牌。 */
const BJ_KEY = 'campus-blackjack-wins';
const bjBox = document.getElementById('bj');
function startBlackjack(n) {
  stopAuto();
  const $ = (sel) => bjBox.querySelector(sel);
  let wins = 0, deck = [], me = [], them = [], phase = 'play', done = false, timer = 0;
  try { wins = +localStorage.getItem(BJ_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  const SUITS = [['♠', '#222'], ['♥', '#d32f2f'], ['♦', '#d32f2f'], ['♣', '#222']], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const newDeck = () => { deck = SUITS.flatMap((s) => RANKS.map((r) => ({ r, s }))); for (let i = deck.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; } };
  const val = (r) => (r === 'A' ? 1 : 'JQK'.includes(r) ? 10 : +r);
  const total = (h) => { let t = h.reduce((s, c) => s + val(c.r), 0); if (h.some((c) => c.r === 'A') && t + 10 <= 21) t += 10; return t; };
  const cardHtml = (c, hide) => (hide ? '<span class="card back">🂠</span>' : `<span class="card" style="color:${c.s[1]}">${c.s[0]}${c.r}</span>`);
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const draw = () => {
    const hide = phase === 'play';
    $('.them .cards').innerHTML = them.map((c, i) => cardHtml(c, hide && i === 1)).join('');
    $('.them .pt').textContent = hide ? `${val(them[0].r) === 1 ? 'A' : val(them[0].r)} ＋ ？` : T(`${total(them)} 點`, `${total(them)} pts`);
    $('.me .cards').innerHTML = me.map((c) => cardHtml(c)).join('');
    $('.me .pt').textContent = T(`${total(me)} 點`, `${total(me)} pts`);
    $('.wins').textContent = T(`贏老師 ${wins} 次`, `Beat the teacher ${wins}×`);
    $('.hit').hidden = $('.stand').hidden = phase !== 'play';
    $('.again').hidden = phase !== 'over';
  };
  const finish = () => {
    done = true; clearTimeout(timer); bjBox.hidden = true;
    updateVisibility();
    removeEventListener('keydown', onKey, true);
    for (const k of ['armL', 'armR']) n.g.userData.limbs[k].rotation.set(0, 0, 0);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const over = (text, cls, face, win) => {
    phase = 'over';
    if (win) { wins++; try { localStorage.setItem(BJ_KEY, String(wins)); } catch { /* 私密模式 */ } }
    draw(); msg(text, cls); npcFace(n, face, 2.5);
  };
  const settle = () => {
    const a = total(me), b = total(them);
    if (b > 21) over(T(`🎉 ${n.name} ${b} 點爆掉了！你贏了！`, `🎉 ${n.name} busts with ${b}! You win!`), 'ok', 'surprised', true);
    else if (a > b) over(T(`🎉 你 ${a} 點、${n.name} ${b} 點，你贏了！`, `🎉 You ${a}, ${n.name} ${b}. You win!`), 'ok', 'sad', true);
    else if (a < b) over(T(`😝 你 ${a} 點、${n.name} ${b} 點，老師贏了！`, `😝 You ${a}, ${n.name} ${b}. The teacher wins!`), 'no', 'tongue');
    else over(T(`🤝 都是 ${a} 點，平手！`, `🤝 Both ${a}. A tie!`), '', 'wink');
  };
  // 老師翻牌，不到 17 點就一張一張拿
  const dealerTurn = () => {
    phase = 'dealer'; draw(); msg(T(`${n.name}翻牌：${total(them)} 點`, `${n.name} reveals: ${total(them)} pts`));
    const step = () => {
      if (done) return;
      if (total(them) < 17) {
        them.push(deck.pop()); n.g.userData.limbs.armR.rotation.x = 1.2; draw(); msg(T(`${n.name}再拿一張…${total(them)} 點`, `${n.name} takes another card… ${total(them)} pts`));
        timer = setTimeout(() => { n.g.userData.limbs.armR.rotation.x = 0; step(); }, 800);
      } else settle();
    };
    timer = setTimeout(step, 800);
  };
  const deal = () => {
    newDeck(); me = [deck.pop(), deck.pop()]; them = [deck.pop(), deck.pop()]; phase = 'play';
    draw();
    if (total(me) === 21) { phase = 'dealer'; draw(); if (total(them) === 21) over(T('🤝 兩個人都是 21 點，平手！', '🤝 Both have 21. A tie!'), '', 'surprised'); else over(T('🌟 一拿到就是 21 點！你贏了！', '🌟 Blackjack! You win!'), 'ok', 'surprised', true); return; }
    msg(T('要再拿一張牌（要牌），還是不拿了（停牌）？', 'Take another card (Hit) or stop (Stand)?'));
  };
  const hit = () => {
    if (phase !== 'play') return;
    me.push(deck.pop()); draw();
    const t = total(me);
    if (t > 21) over(T(`💥 ${t} 點，超過 21 點爆掉了！老師贏了`, `💥 ${t}, over 21. Bust! The teacher wins`), 'no', 'tongue');
    else if (t === 21) dealerTurn();
    else msg(T(`你現在 ${t} 點，要牌還是停牌？`, `You have ${t}. Hit or stand?`));
  };
  const stand = () => { if (phase === 'play') dealerTurn(); };
  const onKey = (e) => {
    if (e.code === 'Digit1' || e.code === 'Numpad1') { e.preventDefault(); e.stopPropagation(); phase === 'over' ? deal() : hit(); }
    else if (e.code === 'Digit2' || e.code === 'Numpad2') { e.preventDefault(); e.stopPropagation(); stand(); }
  };
  addEventListener('keydown', onKey, true);
  $('.hit').onclick = hit; $('.stand').onclick = stand; $('.again').onclick = deal;
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(T(`🃏 下次再來找${n.name}玩 21 點！（已經贏老師 ${wins} 次）`, `🃏 Come back for Blackjack with ${n.name}! (beat the teacher ${wins}×)`)); } };
  act.busy = { label: T('🃏 21 點進行中…', '🃏 Blackjack…'), tick() {} };
  $('.who').textContent = n.name;
  bjBox.hidden = false;
  deal();
  if (phase === 'play') msg(`${n.name}：比比看誰最接近 21 點，超過就爆掉喔！要牌還是停牌？`);
}

/* ---------------- OOXX（井字遊戲）：在三年四班遇到杜老師，你畫 ⭕ 先下、老師畫 ❌ ----------------
   點格子或按 1～9（跟格子上的數字一樣）；先連成一條線（橫、直、斜）就贏。簡易版：老師有時候會忘記擋你。 */

const OOXX_KEY = 'campus-ooxx-wins';
const OOXX_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ooxxBox = document.getElementById('ooxx');
function startOoxx(n) {
  stopAuto();
  const $ = (sel) => ooxxBox.querySelector(sel);
  const cells = [...ooxxBox.querySelectorAll('.cell')];
  const b = Array(9).fill('');
  let locked = false, done = false, wins = 0;
  try { wins = +localStorage.getItem(OOXX_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  const nL = n.g.userData.limbs;
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const draw = (line) => cells.forEach((c, i) => {
    c.textContent = b[i] === 'O' ? '⭕' : b[i] === 'X' ? '❌' : '';
    c.dataset.k = i + 1;
    c.disabled = locked || !!b[i];
    c.classList.toggle('win', !!line?.includes(i));
  });
  const lineOf = (who) => OOXX_LINES.find((L) => L.every((i) => b[i] === who));
  // 下在哪一格可以連成一條線（自己贏，或擋住對方）
  const finishing = (who) => { for (const L of OOXX_LINES) { const e = L.filter((i) => !b[i]); if (e.length === 1 && L.filter((i) => b[i] === who).length === 2) return e[0]; } return -1; };
  const teacherPick = () => {
    let k = finishing('X');
    if (k < 0 && Math.random() < 0.65) k = finishing('O');                // 簡易版：35% 的時候會忘記擋
    if (k < 0 && !b[4] && Math.random() < 0.5) k = 4;
    if (k < 0) { const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0); k = free[Math.random() * free.length | 0]; }
    return k;
  };
  const finish = () => {
    done = true; ooxxBox.hidden = true;
    updateVisibility();                                                 // 名牌放回來
    removeEventListener('keydown', onKey, true);
    for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const end = (text, cls, face, toastText, line) => {
    locked = true; draw(line); msg(text, cls); npcFace(n, face, 3);
    setTimeout(() => { if (done) return; finish(); toast(toastText); }, 1800);
  };
  const choose = (i) => {
    if (locked || done || b[i]) return;
    b[i] = 'O';
    let L = lineOf('O');
    if (L) {
      wins++; try { localStorage.setItem(OOXX_KEY, String(wins)); } catch { /* 私密模式 */ }
      return end(T('✅ 連成一條線！你贏了！', '✅ Three in a row! You win!'), 'ok', 'surprised', `${T(`🏆 你贏了${n.name}！（已經贏 ${wins} 次）`, `🏆 You beat ${n.name}! (${wins} wins)`)}<br>${n.name}：好厲害！上課也要這麼專心唷！`, L);
    }
    if (b.every(Boolean)) return end(T('🤝 格子下滿了，平手！', '🤝 The board is full. A tie!'), '', 'happy', `${T(`🤝 跟${n.name}平手！`, `🤝 A tie with ${n.name}!`)}<br>${n.name}：專心寫、小心檢查，下次一定贏！`);
    locked = true; draw();
    msg(T(`${n.name}想一想…`, `${n.name} is thinking…`));
    nL.armR.rotation.x = 1.4;                                           // 老師舉手準備畫
    setTimeout(() => {
      if (done) return;
      const k = teacherPick(); b[k] = 'X';
      nL.armR.rotation.x = 0;
      L = lineOf('X');
      if (L) return end(T(`❌ ${n.name}連成一條線了！`, `❌ ${n.name} got three in a row!`), 'no', 'tongue', `${T(`😝 ${n.name}贏了！`, `😝 ${n.name} wins!`)}<br>${n.name}：沒關係，下次要小心檢查喔！`, L);
      if (b.every(Boolean)) return end(T('🤝 格子下滿了，平手！', '🤝 The board is full. A tie!'), '', 'happy', `${T(`🤝 跟${n.name}平手！`, `🤝 A tie with ${n.name}!`)}<br>${n.name}：專心寫、小心檢查，下次一定贏！`);
      locked = false; draw();
      msg(T('換你了！點一格（或按 1～9）', 'Your turn! Tap a square (or press 1–9)'));
    }, 800);
  };
  const onKey = (e) => {
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) { e.preventDefault(); e.stopPropagation(); choose(+m[1] - 1); }
  };
  addEventListener('keydown', onKey, true);
  cells.forEach((c, i) => (c.onclick = () => choose(i)));
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(T(`⭕ 下次再來找${n.name}玩 OOXX！`, `⭕ Come back for tic-tac-toe with ${n.name}!`)); } };
  act.busy = { label: T('⭕ OOXX 比賽中…', '⭕ Tic-tac-toe…'), tick() {} };                 // 比賽時不能走動
  $('.who').textContent = n.name;
  ooxxBox.hidden = false;
  draw();
  msg(`${n.name}：你是 ⭕ 先下，連成一條線就贏！`);
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  rps: (s) => startRps(s.npc), ooxx: (s) => startOoxx(s.npc), blackjack: (s) => startBlackjack(s.npc), colors: (s) => startColors(s.npc),
};
