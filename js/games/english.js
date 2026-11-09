/* 英文單字、英文聽力
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import { faceTeacher } from './common.js?v=314';
import { T, player, updateVisibility, stopAuto, toast, bgmHold, npcFace, act, gameState } from '../app.js?v=314';

/* ---------------- 英文單字小測驗：遇到 Ashley 老師（輔導室外走廊、2F 英語教室一）可以練背單字 ----------------
   看中文和圖示，用鍵盤打出英文單字，按 Enter 送出；每次隨機考 3～5 個（顏色、動物、文具）。
   答錯可以再試一次（提示會多給一個字母），第二次還錯就公布答案。答完會唸出發音。 */

const WORDS_KEY = 'campus-words-best';
const CAT_EN = { 顏色: 'Colors', 動物: 'Animals', 文具: 'Stationery', 水果食物: 'Fruit & Food', 天氣: 'Weather', 身體: 'Body', 交通工具: 'Transport' };
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
    $('.cat').textContent = T(q.cat, CAT_EN[q.cat]); $('.prog').textContent = T(`第 ${k + 1} / ${qs.length} 題`, `Question ${k + 1} / ${qs.length}`);
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
    toast(perfect ? `${T('🌟 全對！', '🌟 All correct! ')}${right} / ${qs.length}<br>${n.name}：Great job！你好棒！`
      : `${T(`📝 答對 ${right} / ${qs.length} 題`, `📝 ${right} / ${qs.length} correct`)}<br>${n.name}：Good try！下次再來練習喔！`);
  };
  const reveal = (ok) => {
    const q = qs[k];
    locked = true; quizInput.disabled = true;
    $('.hint').textContent = q.en.split('').join(' ');
    npcFace(n, ok ? 'happy' : 'sad', 1.8);
    msg(ok ? T(`✅ 答對了！<b>${q.en}</b> = ${q.zh}`, `✅ Correct! <b>${q.en}</b> = ${q.zh}`) : T(`答案是 <b>${q.en}</b>（${q.zh}），記起來囉！`, `The answer is <b>${q.en}</b> (${q.zh}). Remember it!`), ok ? 'ok' : 'no');
    sayEnglish(q.en);
    setTimeout(next, ok ? 1300 : 2200);
  };
  const submit = () => {
    if (locked) return;
    const a = quizInput.value.trim().toLowerCase();
    if (!a) { msg(T('先打英文單字再送出喔！', 'Type the English word first!'), 'no'); quizInput.focus(); return; }
    if (a === qs[k].en) { right++; reveal(true); return; }
    tries++;
    if (tries < 2) { hint(); msg(T('❌ 不太對，看提示再試一次！', '❌ Not quite. Check the hint and try again!'), 'no'); quizInput.select(); return; }
    reveal(false);
  };
  const finish = () => {
    quizBox.hidden = true; quizInput.blur();
    n.playing = false; act.busy = null; gameState.duel = null;
    quizInput.onkeydown = null;
  };
  $('.go').onclick = submit;
  $('.skip').onclick = () => { if (!locked) reveal(false); };
  $('.quit').onclick = () => gameState.duel?.quit();
  quizInput.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') gameState.duel?.quit();
  };
  gameState.duel = { quit() { finish(); toast(T(`📝 下次再來找${n.name}練單字喔！`, `📝 Come back to practice words with ${n.name}!`)); } };
  act.busy = { label: T('📝 單字測驗中…', '📝 Word quiz…'), tick() {} };                 // 測驗時不能走動
  quizBox.hidden = false;
  $('.tip').textContent = T(`${n.name}：Let's practice！看中文打出英文單字 🔊 答完會唸出發音`, `${n.name}: Let's practice! Read the Chinese and type the English word 🔊 You'll hear it after you answer`);
  ask();
}

/* ---------------- 英文聽力「聽聽看，是哪一個？」：遇到 Joanne 老師（3F 英語教室二、2F 科任教師辦公室） ----------------
   老師唸一個英文單字，從 4 個圖示選出來（點按鈕或按 1～4）；一回 5 題、3 顆愛心，記錄最多答對幾題。
   🔊 重聽（R）、🐢 慢慢唸（S）、👀 看字。題目跟 Ashley 老師的單字測驗（顏色、動物、文具）錯開，練的是「聽」。
   瀏覽器不能唸英文（沒有語音）時，直接把單字顯示出來，變成看字選圖。 */
const LISTEN_KEY = 'campus-listen-best';
const LISTEN_BANK = {
  水果食物: [['apple', '蘋果', '🍎'], ['banana', '香蕉', '🍌'], ['grapes', '葡萄', '🍇'], ['watermelon', '西瓜', '🍉'], ['strawberry', '草莓', '🍓'],
    ['bread', '麵包', '🍞'], ['egg', '蛋', '🥚'], ['milk', '牛奶', '🥛'], ['cake', '蛋糕', '🍰'], ['pizza', '披薩', '🍕'], ['rice', '飯', '🍚'], ['ice cream', '冰淇淋', '🍦']],
  天氣: [['sunny', '晴天', '☀️'], ['rainy', '下雨', '🌧️'], ['cloudy', '多雲', '☁️'], ['snowy', '下雪', '❄️'], ['windy', '颳風', '🌬️'], ['rainbow', '彩虹', '🌈']],
  身體: [['eye', '眼睛', '👁️'], ['ear', '耳朵', '👂'], ['nose', '鼻子', '👃'], ['mouth', '嘴巴', '👄'], ['hand', '手', '✋'], ['foot', '腳', '🦶'], ['tooth', '牙齒', '🦷']],
  交通工具: [['bus', '公車', '🚌'], ['car', '汽車', '🚗'], ['bike', '腳踏車', '🚲'], ['train', '火車', '🚆'], ['airplane', '飛機', '✈️'], ['boat', '船', '⛵'],
    ['taxi', '計程車', '🚕'], ['MRT', '捷運', '🚇'], ['scooter', '機車', '🛵']],
};
const listenBox = document.getElementById('listen');
// 這台電腦能不能唸英文（語音清單還沒載入時先當作可以，唸不出來學生可以按「看字」）
const canSpeakEnglish = () => {
  if (!window.speechSynthesis) return false;
  const vs = speechSynthesis.getVoices();
  return !vs.length || vs.some((v) => /^en/i.test(v.lang));
};
function speakListen(word, slow) {
  try {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; u.rate = slow ? 0.55 : 0.85;
    speechSynthesis.speak(u);
  } catch { /* 不支援就算了 */ }
}
function startListen(n) {
  stopAuto(); bgmHold('listen', true);                                  // 聽英文時校歌先停
  const $ = (sel) => listenBox.querySelector(sel);
  const btns = [...listenBox.querySelectorAll('[data-k]')];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 5 題：每題從同一類挑 3 個當干擾選項（同類比較像，才是真的在聽）
  const all = Object.entries(LISTEN_BANK).flatMap(([cat, list]) => list.map(([en, zh, emo]) => ({ en, zh, emo, cat })));
  const qs = shuffle(all.slice()).slice(0, 5).map((w) => {
    const others = shuffle(all.filter((o) => o.cat === w.cat && o.en !== w.en)).slice(0, 3);
    return { w, opts: shuffle([w, ...others]) };
  });
  const voice = canSpeakEnglish();
  let i = 0, hearts = 3, right = 0, best = 0, locked = false, done = false, peek = !voice;
  try { best = +localStorage.getItem(LISTEN_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const showWord = () => { $('.word').textContent = peek ? qs[i].w.en : '？？？'; };
  const say = (slow) => { if (!done && !locked) { speakListen(qs[i].w.en, slow); npcFace(n, 'happy', 0.8); } };
  const ready = () => {
    locked = false;
    const q = qs[i];
    peek = !voice;
    $('.prog').textContent = T(`第 ${i + 1} / ${qs.length} 題・${q.w.cat}`, `Question ${i + 1} / ${qs.length} · ${CAT_EN[q.w.cat]}`);
    $('.hearts').textContent = '❤️'.repeat(hearts) + '🤍'.repeat(3 - hearts);
    showWord();
    btns.forEach((b, k) => { b.disabled = false; b.className = ''; b.innerHTML = `${q.opts[k].emo}<small>${k + 1}</small>`; });
    msg(voice ? T('👂 仔細聽，是哪一個？', '👂 Listen carefully. Which one is it?') : T('這台電腦不能唸英文，看單字選選看！', "This computer can't speak English. Read the word and choose!"));
    setTimeout(() => say(false), 350);
  };
  const finish = () => {
    done = true; listenBox.hidden = true;
    try { speechSynthesis?.cancel(); } catch { /* 不支援就算了 */ }
    updateVisibility(); bgmHold('listen', false);
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const answer = (k) => {
    if (locked || done) return;
    locked = true; btns.forEach((b) => (b.disabled = true));
    const q = qs[i], ok = q.opts[k] === q.w;
    btns[q.opts.indexOf(q.w)].className = 'right';
    if (ok) right++; else { btns[k].className = 'wrong'; hearts--; }
    peek = true; showWord();
    $('.hearts').textContent = '❤️'.repeat(hearts) + '🤍'.repeat(3 - hearts);
    msg(ok ? `✅ Great! <b>${q.w.en}</b> = ${q.w.emo} ${q.w.zh}` : T(`❌ 是 <b>${q.w.en}</b> ${q.w.emo}（${q.w.zh}），再聽一次記起來！`, `❌ It's <b>${q.w.en}</b> ${q.w.emo} (${q.w.zh}). Listen once more and remember it!`), ok ? 'ok' : 'no');
    npcFace(n, ok ? 'happy' : 'surprised', 1.5);
    speakListen(q.w.en, false);
    setTimeout(() => {
      if (done) return;
      if (hearts && ++i < qs.length) { ready(); return; }
      if (right > best) { best = right; try { localStorage.setItem(LISTEN_KEY, String(best)); } catch { /* 私密模式 */ } }
      npcFace(n, right === qs.length ? 'happy' : 'wink', 3);
      finish();
      toast(right === qs.length ? `${T('🌟 5 題全對！你的耳朵超厲害！', '🌟 All 5 correct! Great ears!')}<br>${n.name}：Excellent! You're a great listener!`
        : !hearts ? `${T(`🎧 愛心用完了，答對 ${right} 題（最好紀錄 ${best} 題）`, `🎧 Out of hearts. ${right} correct (best ${best})`)}<br>${n.name}：Good try! 多聽幾次就會越來越熟喔！`
        : `${T(`🎧 答對 ${right} / ${qs.length} 題（最好紀錄 ${best} 題）`, `🎧 ${right} / ${qs.length} correct (best ${best})`)}<br>${n.name}：Nice job! 下次再來挑戰全對！`);
    }, ok ? 1500 : 2300);
  };
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); answer(k); return; }
    if (e.code === 'KeyR') { e.preventDefault(); e.stopPropagation(); say(false); }
    else if (e.code === 'KeyS') { e.preventDefault(); e.stopPropagation(); say(true); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); gameState.duel?.quit(); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b, k) => (b.onclick = () => answer(k)));
  $('.again').onclick = () => say(false);
  $('.slow').onclick = () => say(true);
  $('.peek').onclick = () => { if (!locked) { peek = true; showWord(); } };
  $('.quit').onclick = () => gameState.duel?.quit();
  $('.who').textContent = n.name;
  gameState.duel = { quit() { finish(); toast(T(`🎧 下次再來找${n.name}練聽力喔！`, `🎧 Come back for more listening with ${n.name}!`)); } };
  act.busy = { label: T('🎧 英文聽力中…', '🎧 Listening…'), tick() {} };                  // 玩的時候不能走動
  listenBox.hidden = false;
  ready();
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  words: (s) => startWords(s.npc), listen: (s) => startListen(s.npc),
};
