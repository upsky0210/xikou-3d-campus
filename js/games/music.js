/* 直笛記憶、節奏划水
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import * as THREE from 'three';
import { poolWater } from '../extras.js?v=311';
import { faceTeacher } from './common.js?v=311';
import { D, T, BASE, rectM, groundAt, scene, camera, makeLabel, player, wearing, avatar, placeAt, mode, setMode, updateVisibility, stopAuto, toast, bgmHold, npcFace, act, limbs, resetPose, gameState, fmtSec } from '../app.js?v=311';

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
const fluteName = (k) => (FLUTE[k].hi ? T('高音', 'high ') : '') + FLUTE[k].n;
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
  return `<button data-k="${k}" style="--c:${x.c}"><b>${x.hi ? `<small>${T('高音', 'high')}</small>` : ''}${x.n}</b><span class="fing">${holes}</span><small>${x.abc}・${k + 1}</small></button>`;
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
    $('.lv').textContent = T(`第 ${level()} 關`, `Level ${level()}`);
    $('.lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(2 - lives);
    $('.best').textContent = best ? T(`🏅 最佳紀錄：第 ${best} 關`, `🏅 Best: level ${best}`) : T('🏅 還沒有紀錄，加油！', '🏅 No record yet. You can do it!');
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
    msg(T(`🎵 ${n.name}吹給你聽，仔細聽喔…`, `🎵 ${n.name} is playing. Listen carefully…`));
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
    msg(T(`換你吹！照順序按出這 ${seq.length} 個音`, `Your turn! Play these ${seq.length} notes in order`));
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
      msg(T(['✅ 全部吹對了！', '✅ 好好聽！', '✅ 音感真好！'][Math.random() * 3 | 0] + '下一關多一個音', ['✅ All correct! ', '✅ Beautiful! ', '✅ Great ear! '][Math.random() * 3 | 0] + 'Next level adds one note'), 'ok');
      setTimeout(() => { if (done) return; addNote(); teacherPlays(); }, 1500);
      return;
    }
    lives--; listening = false; setBtns(false); show();
    if (lives > 0) {
      npcFace(n, 'surprised', 1.6);
      msg(T(`❌ 第 ${pos + 1} 個音應該是 ${fluteName(seq[pos])}，老師再吹一次給你聽`, `❌ Note ${pos + 1} should be ${fluteName(seq[pos])}. The teacher will play it again`), 'no');
      setTimeout(() => { if (!done) teacherPlays(); }, 1800);
      return;
    }
    npcFace(n, 'sad', 1.8);
    msg(T(`❌ 第 ${pos + 1} 個音應該是 ${fluteName(seq[pos])}`, `❌ Note ${pos + 1} should be ${fluteName(seq[pos])}`), 'no');
    const lv = level() - 1;
    setTimeout(() => {
      if (done) return;
      npcFace(n, 'happy', 3);
      finish();
      toast(lv > 0 ? `${T(`🎵 你過了 ${lv} 關！（最佳紀錄：第 ${best} 關）`, `🎵 You cleared ${lv} level${lv > 1 ? 's' : ''}! (best: level ${best})`)}<br>${n.name}：很棒喔！回家多練習，下次挑戰更長的旋律！`
        : `🎵 ${n.name}：沒關係，多聽幾次就記得了，再來挑戰一次吧！`);
    }, 1600);
  };
  const finish = () => {
    done = true; fluteBox.hidden = true; clearNote(); blow(false); bgmHold('flute', false);
    updateVisibility();                                                 // 名牌放回來
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); press(k); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b) => (b.onclick = () => press(+b.dataset.k)));
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(T(`🎵 下次再來找${n.name}吹直笛！`, `🎵 Come back to play the recorder with ${n.name}!`)); } };
  act.busy = { label: '', tick() {} };                                  // 玩的時候不能走動（視窗在下面，橘色提示鈕先收起來）
  fluteBox.hidden = false;
  for (let i = 0; i < 3; i++) addNote();
  msg(`${n.name}：老師先吹，你照順序吹回去喔！`);
  show(); setBtns(false);
  setTimeout(() => { if (!done) teacherPlays(); }, 1200);
}

/* ---------------- 節奏划水：游泳館的陳老師（體育老師）帶你下水游自由式 ----------------
   左右手輪流划水，每划 4 下換一次氣（← →／A D 划手，空白鍵／↑ 換氣；手機按下面三個大按鈕）。
   練習：一個一個來、不計時，按錯也沒關係；挑戰：提示滑到圈圈時按，算準確率和最多連續配合，中途節奏會變快、變慢。
   前進距離由遊戲控制：對到拍子的那一下游 1 公尺，沒對到只前進一點點，所以亂按、狂按都不會比較快。
   只有玩這個遊戲時才下水（平常泳池邊有擋，不能走到水面上）。 */

const SWIM_KEY = 'campus-swim-best';
const SWIM_LEN = 25, SWIM_BREATH = 4;                                  // 25 公尺；每划幾下換一次氣（可以請陳老師決定）
const SWIM_PERFECT = 0.1, SWIM_GOOD = 0.22, SWIM_LOOK = 2.4;           // 挑戰：判定範圍（秒）、提示提早幾秒出現
// 挑戰的節奏：游到幾公尺以前、每一拍隔幾秒（中段變快、快到終點前放慢、最後衝刺）
const SWIM_TEMPO = [[8, 0.8], [15, 0.62], [20, 0.9], [SWIM_LEN, 0.68]];
const SWIM_PRACTICE_BEAT = 0.9;                                        // 練習：圈圈跟著這個拍子閃（只是參考，不計時）
// 陳老師說的話：暫定文字，之後由阿喵老師改寫（老師的台詞只有中文）
const SWIM_SAY = {
  intro: '先做好暖身！左右手輪流划水，划幾下要記得換氣。你要先練習，還是直接挑戰？',
  go: '聽到哨音就出發！',
  steady: '節奏很穩，游得很漂亮！',
  uneven: '游到了！下一次划水的節奏可以更平均。',
  practice: '熟練以後，試試看挑戰模式！',
  quit: '沒關係，下次再來游！',
};
const SWIM_CUE = { L: ['⬅️', '左手', 'Left'], R: ['➡️', '右手', 'Right'], B: ['💨', '換氣', 'Breathe'] };
const SWIM_RING = 12;                                                  // 圈圈在提示列的位置（%）
const swimBox = document.getElementById('swim');
let swimAudio = null;
// 音效（WebAudio 合成）：哨音、拍子、划水聲、換氣
function swimSound(kind) {
  try {
    swimAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const ac = swimAudio, t = ac.currentTime + 0.01;
    if (ac.state === 'suspended') ac.resume();
    const g = ac.createGain(); g.connect(ac.destination);
    if (kind === 'splash' || kind === 'breath') {                       // 水聲：一小段濾過的雜訊
      const len = kind === 'splash' ? 0.18 : 0.3, buf = ac.createBuffer(1, ac.sampleRate * len | 0, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ac.createBufferSource(), flt = ac.createBiquadFilter();
      src.buffer = buf; flt.type = kind === 'splash' ? 'bandpass' : 'lowpass'; flt.frequency.value = kind === 'splash' ? 1400 : 700;
      src.connect(flt); flt.connect(g); g.gain.value = kind === 'splash' ? 0.25 : 0.12;
      src.start(t);
      return;
    }
    const o = ac.createOscillator(); o.connect(g);
    if (kind === 'whistle') {                                          // 哨音：高音加上快速顫動
      const lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 28; lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.75);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.03); g.gain.setValueAtTime(0.13, t + 0.65); g.gain.linearRampToValueAtTime(0, t + 0.72);
      o.start(t); o.stop(t + 0.75);
      return;
    }
    o.type = 'sine'; o.frequency.value = kind === 'tickB' ? 660 : 1050;   // 拍子：短短的「嗒」（換氣那拍低一點）
    g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.start(t); o.stop(t + 0.08);
  } catch { /* 沒有音效也能玩 */ }
}
// 水花：白色小方塊往上噴、再掉下來
const swimDrops = [], dropGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07), dropMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
function swimSplash(x, y, z, n = 7, power = 1) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.set(x, y, z); scene.add(m);
    swimDrops.push({ m, vx: (Math.random() - 0.5) * 1.6, vy: (1.4 + Math.random() * 1.4) * power, vz: (Math.random() - 0.5) * 1.6, life: 0.6 });
  }
}
function updateSwimDrops(dt) {
  for (let i = swimDrops.length - 1; i >= 0; i--) {
    const p = swimDrops[i];
    p.life -= dt; p.vy -= 9.8 * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.m.scale.setScalar(Math.max(0.1, p.life / 0.6));
    if (p.life <= 0) { scene.remove(p.m); swimDrops.splice(i, 1); }
  }
}
const swimQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], AXIS_X = new THREE.Vector3(1, 0, 0), AXIS_Y = new THREE.Vector3(0, 1, 0);
function startSwim(n) {
  stopAuto();
  const $ = (sel) => swimBox.querySelector(sel);
  const f = n.f, P = poolWater(rectM(D.outdoor.pool));
  const lane = 2, laneZ = P.z - P.d / 2 + (P.d / P.lanes) * (lane + 0.5);   // 第 3 水道：老師前面，鏡頭在南邊的池面上
  const waterY = f.y - BASE + 0.03;                                     // 戶外地面比一樓低 BASE，水面在地面上一點點
  const x0 = P.x - P.w / 2 + 0.15, x1 = P.x + P.w / 2 - 1.95;           // 腳從 x0 出發；伸直的手碰到對面池壁就是終點
  const deck = { x: n.g.position.x + 0.8, z: laneZ };                    // 老師旁邊、水道前的池畔
  const YAW = -Math.PI / 2, prevMode = mode;                            // 往東游
  const nL = n.g.userData.limbs;
  let best = 0, md = null, phase = 'menu', t = 0, t0 = 0, beatT = 0;
  let dist = 0, shown = 0, cues = [], cur = 0, strokes = 0, hand = 'L', lastKind = '';
  let perfect = 0, good = 0, judged = 0, extra = 0, combo = 0, maxCombo = 0;
  const offs = [], presses = [], arm = { L: null, R: null };
  let roll = 0, rollGoal = 0, breathT = 0, kick = 0, dive = 0, dressed = null;
  try { best = +localStorage.getItem(SWIM_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);    // 放下打招呼的手
  if (mode === 'first') setMode('third');                              // 第一人稱看不到自己在游，先換成第三人稱
  placeAt(f, deck.x, deck.z, YAW); player.yaw = YAW + 0.6; player.pitch = -0.1;
  f.labels.visible = false;
  n.g.rotation.y = Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z);

  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const show = () => {
    $('.md').textContent = md ? (md === 'practice' ? T('練習', 'Practice') : T('挑戰', 'Challenge')) : '';
    $('.dist').textContent = `${Math.min(SWIM_LEN, Math.floor(shown))} / ${SWIM_LEN} m`;
    $('.lane i').style.left = `${Math.min(100, shown / SWIM_LEN * 100)}%`;
    $('.best').textContent = best ? T(`🏅 挑戰最佳：準確率 ${best}%`, `🏅 Best challenge: ${best}% accuracy`) : T('🏅 還沒有挑戰紀錄，加油！', '🏅 No challenge record yet. You can do it!');
  };
  const pulse = () => { const r = $('.ring'); r.classList.remove('pulse'); void r.offsetWidth; r.classList.add('pulse'); };
  const pendingStrokes = () => cues.reduce((s, c) => s + (!c.done && c.k !== 'B' ? 1 : 0), 0);
  const nextKind = () => {
    if (strokes > 0 && strokes % SWIM_BREATH === 0 && lastKind !== 'B') return (lastKind = 'B');
    const k = hand; hand = hand === 'L' ? 'R' : 'L'; strokes++;
    return (lastKind = k);
  };
  const addCue = (time) => {
    const k = nextKind(), el = document.createElement('i');
    el.className = `cue ${k}`; el.textContent = SWIM_CUE[k][0];
    $('.cues').append(el);
    cues.push({ k, t: time, el, done: false });
  };
  // 練習：排在圈圈後面一個一個等；挑戰：照時間從右邊滑過來
  const layout = (now) => {
    for (let i = cur; i < cues.length; i++) {
      const c = cues[i];
      const x = md === 'practice' ? SWIM_RING + (i - cur) * 20 : SWIM_RING + (c.t - now) / SWIM_LOOK * (96 - SWIM_RING);
      c.el.style.left = `${x}%`; c.el.classList.toggle('next', i === cur);
    }
  };
  const flash = (k) => { const b = $(`.pads [data-k="${k}"]`); b?.classList.add('lit'); setTimeout(() => b?.classList.remove('lit'), 120); };
  // 划一下：那隻手轉一圈（從前面往下划、從背後回到前面），身體跟著側一點，手入水的地方噴水花
  const stroke = (k, ok) => {
    arm[k] = 0; rollGoal = k === 'L' ? 0.3 : -0.3; kick = 1;
    dist += ok ? 1 : 0.35;
    swimSound('splash');
    swimSplash(avatar.position.x + 1.7, waterY + 0.05, laneZ + (k === 'L' ? -0.26 : 0.26), ok ? 7 : 3, ok ? 1 : 0.6);
  };
  const judge = (c, ok) => {
    c.done = true; cur++;
    c.el.classList.add(ok ? 'hit' : 'miss'); setTimeout(() => c.el.remove(), 350);
    if (c.k === 'B') { if (ok) { breathT = 0.55; swimSound('breath'); } }
    else stroke(c.k, ok);
    if (dist >= SWIM_LEN) arrive();
  };
  const press = (k) => {
    if (phase !== 'swim') return;
    flash(k);
    const now = t - t0, c = cues[cur];
    if (!c) return;
    if (md === 'practice') {                                            // 練習：按錯只提醒，不扣分、不計時
      if (c.k !== k) { msg(T(`這一下要按「${SWIM_CUE[c.k][0]} ${SWIM_CUE[c.k][1]}」`, `This one is "${SWIM_CUE[c.k][0]} ${SWIM_CUE[c.k][2]}"`), 'no'); return; }
      presses.push(now); msg('');
      judge(c, true);
      return;
    }
    if (c.t - now > SWIM_GOOD) { extra++; combo = 0; msg(T('太急了！等提示到圈圈再按', 'Too early! Wait until it reaches the circle'), 'no'); return; }
    const off = now - c.t, ok = c.k === k;
    judged++;
    if (ok) {
      offs.push(off); combo++; maxCombo = Math.max(maxCombo, combo);
      if (Math.abs(off) <= SWIM_PERFECT) { perfect++; msg(T(`🎯 準！${combo > 2 ? `連續 ${combo} 下` : ''}`, `🎯 Perfect! ${combo > 2 ? `${combo} in a row` : ''}`), 'ok'); }
      else { good++; msg(T(`👍 好！${off < 0 ? '有一點急' : '有一點慢'}`, `👍 Good! ${off < 0 ? 'A little early' : 'A little late'}`), 'ok'); }
    } else { combo = 0; msg(T(`這一下是「${SWIM_CUE[c.k][0]} ${SWIM_CUE[c.k][1]}」`, `That one was "${SWIM_CUE[c.k][0]} ${SWIM_CUE[c.k][2]}"`), 'no'); }
    judge(c, ok);
  };
  const accuracy = () => Math.round(100 * (perfect + good * 0.7) / Math.max(1, judged + extra));
  // 節奏穩不穩：挑戰看每一下跟拍子差多少；練習看兩下之間隔得平不平均（停很久的不算）
  const steady = () => {
    if (md === 'challenge') {
      if (offs.length < 5 || accuracy() < 75) return false;
      const m = offs.reduce((a, b) => a + b, 0) / offs.length;
      return Math.sqrt(offs.reduce((a, b) => a + (b - m) ** 2, 0) / offs.length) < 0.08;
    }
    const gaps = presses.slice(1).map((p, i) => p - presses[i]).filter((g) => g < 4);
    if (gaps.length < 5) return false;
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length) / m < 0.3;
  };
  const arrive = () => {
    phase = 'end';
    for (const c of cues) if (!c.done) c.el.remove();
    const sec = t - t0, ok = steady(), acc = accuracy();
    let line;
    if (md === 'challenge') {
      const rec = acc > best;
      if (rec) { best = acc; try { localStorage.setItem(SWIM_KEY, String(best)); } catch { /* 私密模式 */ } }
      line = T(`🏁 到終點了！準確率 ${acc}%・最多連續 ${maxCombo} 下・${fmtSec(sec)}${rec ? '・新紀錄！' : ''}`,
        `🏁 You made it! Accuracy ${acc}% · Best streak ${maxCombo} · ${fmtSec(sec)}${rec ? ' · New record!' : ''}`);
    } else line = T(`🏁 游完 ${SWIM_LEN} 公尺了！用了 ${fmtSec(sec)}`, `🏁 You swam ${SWIM_LEN} m! Time: ${fmtSec(sec)}`);
    msg(line, 'ok'); show();
    npcFace(n, 'happy', 3);
    swimSound('whistle');
    setTimeout(() => {
      if (phase !== 'end') return;
      finish();
      toast(`${line}<br>${n.name}：${ok ? SWIM_SAY.steady : SWIM_SAY.uneven}${md === 'practice' ? SWIM_SAY.practice : ''}`);
    }, 2600);
  };
  const begin = (m) => {
    md = m; phase = 'dive'; dive = 0;
    $('.modes').hidden = true; $('.pads').hidden = false;
    $('.track').classList.toggle('timed', m === 'challenge');
    msg(`${n.name}：${SWIM_SAY.go}`);
    show();
  };
  // 每一格畫面
  const tick = (dt) => {
    t += dt;
    updateSwimDrops(dt);
    if (dressed !== avatar) { avatar.userData.setOutfit?.('swim'); dressed = avatar; }   // 換上泳裝（中途換角色也照樣穿）
    if (phase === 'menu') return;
    const L = limbs();
    if (phase === 'dive') {                                             // 從池畔跳進水道，身體轉成趴著
      dive = Math.min(1, dive + dt / 0.9);
      const k = dive, y0 = f.y + groundAt(f, deck.x, deck.z);
      player.x = deck.x + (x0 - deck.x) * k; player.z = laneZ;
      player.ride = y0 + (waterY - y0) * k + Math.sin(k * Math.PI) * 0.5;
      if (L) { L.armL.rotation.set(Math.PI * k, 0, 0); L.armR.rotation.set(Math.PI * k, 0, 0); }
      if (k > 0.85 && !beatT) { beatT = 1; swimSplash(player.x + 1.2, waterY + 0.05, laneZ, 12, 1.2); swimSound('splash'); }
      if (k >= 1) { phase = 'ready'; beatT = 0; msg(T('預備…', 'Ready…')); nL.armR.rotation.set(-2.6, 0, 0.2); }
    } else if (phase === 'ready') {                                     // 老師舉手吹哨，出發
      beatT += dt;
      if (beatT > 1.0) {
        nL.armR.rotation.set(0, 0, 0);
        swimSound('whistle'); phase = 'swim'; t0 = t; beatT = 0;
        msg(md === 'practice' ? T('照提示按，按對就往前游，不用急', 'Press what the circle shows. No rush!') : T('提示滑到圈圈時按！', 'Press when the icon reaches the circle!'));
      }
    } else if (phase === 'swim') {
      const now = t - t0;
      if (md === 'practice') {
        while (cues.length - cur < 5 && dist + pendingStrokes() < SWIM_LEN) addCue(0);
        if ((beatT += dt) > SWIM_PRACTICE_BEAT) { beatT = 0; pulse(); }
      } else {
        while (dist + pendingStrokes() < SWIM_LEN && (!cues.length || cues.at(-1).t < now + SWIM_LOOK)) {
          const last = cues.at(-1);
          addCue(last ? Math.max(last.t + SWIM_TEMPO.find(([m]) => dist + pendingStrokes() < m)[1], now + SWIM_LOOK * 0.5) : now + 1.4);
        }
        for (let i = cur; i < cues.length; i++) {
          const c = cues[i];
          if (!c.ticked && now >= c.t) { c.ticked = true; swimSound(c.k === 'B' ? 'tickB' : 'tick'); pulse(); }
        }
        const c = cues[cur];
        if (c && now > c.t + SWIM_GOOD) {                               // 錯過了
          judged++; combo = 0;
          msg(c.k === 'B' ? T('💨 忘了換氣！', '💨 You forgot to breathe!') : T('慢了一拍，跟著拍子划', 'A beat late. Follow the rhythm'), 'no');
          judge(c, false);
        }
      }
      if (phase === 'swim') layout(now);
    }
    // 游泳的樣子：前進、手臂划圈、腳踢水、身體側轉（換氣時轉比較多，臉朝鏡頭這邊）
    if (phase === 'ready' || phase === 'swim' || phase === 'end') {
      shown += (dist - shown) * Math.min(1, dt * 3); show();
      player.x = x0 + (x1 - x0) * Math.min(1, shown / SWIM_LEN); player.z = laneZ;
      player.ride = waterY + Math.sin(t * 3) * 0.02;
      if (L) {
        for (const k of ['L', 'R']) {
          const a = k === 'L' ? L.armL : L.armR;
          if (arm[k] != null) { arm[k] = Math.min(1, arm[k] + dt / 0.55); const e = arm[k] * arm[k] * (3 - 2 * arm[k]); a.rotation.set(Math.PI - 2 * Math.PI * e, 0, 0); if (arm[k] >= 1) arm[k] = null; }
          else a.rotation.set(Math.PI, 0, 0);
        }
        kick = Math.max(phase === 'end' ? 0 : 0.35, kick - dt * 0.8);
        L.legL.rotation.x = Math.sin(t * 16) * 0.3 * kick; L.legR.rotation.x = -L.legL.rotation.x;
      }
      breathT = Math.max(0, breathT - dt);
      if (!arm.L && !arm.R) rollGoal = 0;
      roll += ((breathT > 0 ? -1.2 : rollGoal) - roll) * Math.min(1, dt * 9);
    }
    if (phase !== 'menu' && phase !== 'dive' || dive > 0) {
      const pitch = phase === 'dive' ? -Math.PI / 2 * dive : -Math.PI / 2;
      avatar.quaternion.copy(swimQ[0].setFromAxisAngle(AXIS_Y, YAW)).multiply(swimQ[1].setFromAxisAngle(AXIS_X, pitch)).multiply(swimQ[2].setFromAxisAngle(AXIS_Y, roll));
    }
    n.g.rotation.y = Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z);   // 老師一直看著你游
  };
  // 鏡頭：從池邊斜後方看，人在畫面上半部（下面是遊戲面板）
  const cam = () => {
    const ax = avatar.position.x;
    camera.position.set(ax - 2.2, waterY + 3.0, laneZ + 5.0);
    camera.lookAt(ax + 1.6, waterY - 1.2, laneZ + 0.8);
  };
  const finish = () => {
    phase = 'done'; swimBox.hidden = true; $('.cues').innerHTML = '';
    removeEventListener('keydown', onKey, true);
    for (const p of swimDrops) scene.remove(p.m);
    swimDrops.length = 0;
    avatar.quaternion.identity(); resetPose(); avatar.userData.setOutfit?.(wearing(avatar.userData.gender));   // 換回原本的衣服
    player.ride = null; player.pitch = -0.1;
    placeAt(f, deck.x, deck.z, YAW); player.yaw = YAW + 0.6;              // 回到池畔（會順便把名牌放回來）
    if (prevMode === 'first') setMode('first');
    nL.armR.rotation.set(0, 0, 0);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const onKey = (e) => {
    const k = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', Space: 'B', ArrowUp: 'B', KeyW: 'B' }[e.code];
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (!e.repeat) press(k);
  };
  addEventListener('keydown', onKey, true);
  $('.modes').innerHTML = `<button data-m="practice"><b>🐢 ${T('練習', 'Practice')}</b><small>${T('一個一個來，不計時', 'One at a time, no timer')}</small></button>`
    + `<button data-m="challenge"><b>⏱️ ${T('挑戰', 'Challenge')}</b><small>${T('跟著拍子划，算準確率', 'Keep the beat, score accuracy')}</small></button>`;
  $('.pads').innerHTML = [['L', '#4f8fe8', '←'], ['B', '#3cc1a8', T('空白鍵', 'Space')], ['R', '#f2a03a', '→']]
    .map(([k, c, key]) => `<button data-k="${k}" style="--c:${c}">${SWIM_CUE[k][0]}<small>${T(SWIM_CUE[k][1], SWIM_CUE[k][2])} ${key}</small></button>`).join('');
  $('.modes').querySelectorAll('button').forEach((b) => (b.onclick = () => begin(b.dataset.m)));
  $('.pads').querySelectorAll('button').forEach((b) => (b.onpointerdown = (e) => { e.preventDefault(); press(b.dataset.k); }));
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { const was = phase; finish(); toast(was === 'menu' ? T(`🏊 下次再來找${n.name}游泳！`, `🏊 Come back to swim with ${n.name}!`) : `${T('🏊 先上岸休息', '🏊 Out of the pool for now')}<br>${n.name}：${SWIM_SAY.quit}`); } };
  act.busy = { label: '', tick, cam: () => { if (phase !== 'menu') cam(); } };   // 玩的時候不能走動；下水以後換成游泳的鏡頭
  $('.modes').hidden = false; $('.pads').hidden = true; $('.cues').innerHTML = '';
  swimBox.hidden = false;
  msg(`${n.name}：${SWIM_SAY.intro}`);
  show();
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  recorder: (s) => startFlute(s.npc), swim: (s) => startSwim(s.npc),
};
