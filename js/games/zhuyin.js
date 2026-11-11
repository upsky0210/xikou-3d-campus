/* 注音符號大闖關
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import { faceTeacher } from './common.js?v=324';
import { T, updateVisibility, stopAuto, toast, npcFace, act, gameState } from '../app.js?v=324';

/* ---------------- 注音符號大闖關：在一年一班遇到林老師，三關、每關 4 題、三顆愛心 ----------------
   第一關「找聲母」：這個字是哪個注音開頭？　第二關「拼拼看」：哪一個是正確的拼音？　第三關「第幾聲」。
   三個選項（點按鈕或按 1／2／3），答錯扣一顆愛心，愛心用完就結束；記錄最多闖到第幾關。 */
const ZHUYIN_KEY = 'campus-zhuyin-best';
// 單字：圖、字、注音（不含聲調）、聲調 1～4；i 是聲母（沒有聲母的字不出第一關）
const ZY_WORDS = [
  ['🐱', '貓', 'ㄇㄠ', 1], ['🐶', '狗', 'ㄍㄡ', 3], ['🐮', '牛', 'ㄋㄧㄡ', 2], ['🐦', '鳥', 'ㄋㄧㄠ', 3], ['🐷', '豬', 'ㄓㄨ', 1],
  ['🐔', '雞', 'ㄐㄧ', 1], ['📖', '書', 'ㄕㄨ', 1], ['🌸', '花', 'ㄏㄨㄚ', 1], ['🐻', '熊', 'ㄒㄩㄥ', 2], ['🍬', '糖', 'ㄊㄤ', 2],
  ['🌳', '樹', 'ㄕㄨ', 4], ['🥚', '蛋', 'ㄉㄢ', 4], ['🍵', '茶', 'ㄔㄚ', 2], ['🚗', '車', 'ㄔㄜ', 1], ['🐑', '羊', 'ㄧㄤ', 2],
  ['🐟', '魚', 'ㄩ', 2], ['🐴', '馬', 'ㄇㄚ', 3], ['🍚', '米', 'ㄇㄧ', 3], ['⛰️', '山', 'ㄕㄢ', 1], ['🚪', '門', 'ㄇㄣ', 2],
  ['💧', '水', 'ㄕㄨㄟ', 3], ['🔥', '火', 'ㄏㄨㄛ', 3], ['🌧️', '雨', 'ㄩ', 3], ['⚽', '球', 'ㄑㄧㄡ', 2], ['⛵', '船', 'ㄔㄨㄢ', 2],
  ['✏️', '筆', 'ㄅㄧ', 3], ['🦐', '蝦', 'ㄒㄧㄚ', 1], ['💡', '燈', 'ㄉㄥ', 1], ['🧊', '冰', 'ㄅㄧㄥ', 1], ['🎒', '包', 'ㄅㄠ', 1],
].map(([e, w, py, t]) => ({ e, w, py, t, i: 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ'.includes(py[0]) ? py[0] : '' }));
// 容易搞混的聲母（同一組）、韻母
const ZY_INIT = ['ㄅㄆㄇㄈ', 'ㄉㄊㄋㄌ', 'ㄍㄎㄏ', 'ㄐㄑㄒ', 'ㄓㄔㄕㄖ', 'ㄗㄘㄙ'];
const ZY_FINAL = { 'ㄠ': 'ㄡ', 'ㄡ': 'ㄠ', 'ㄢ': 'ㄤ', 'ㄤ': 'ㄢ', 'ㄣ': 'ㄥ', 'ㄥ': 'ㄣ', 'ㄞ': 'ㄟ', 'ㄟ': 'ㄞ', 'ㄛ': 'ㄜ', 'ㄜ': 'ㄛ', 'ㄚ': 'ㄛ', 'ㄧ': 'ㄩ', 'ㄩ': 'ㄧ', 'ㄨ': 'ㄛ' };
const ZY_TONE = ['', '', 'ˊ', 'ˇ', 'ˋ'], ZY_TONE_NAME = ['', '一聲', '二聲', '三聲', '四聲'];
const zyText = (py, t) => py + ZY_TONE[t];
function makeZhuyinLevel(lv) {
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = shuffle(ZY_WORDS.filter((w) => lv !== 1 || w.i)).slice(0, 4);
  return pool.map((w) => {
    let ans, opts;
    if (lv === 1) {                                                    // 找聲母：同一組裡挑兩個當干擾
      const grp = ZY_INIT.find((g) => g.includes(w.i));
      ans = w.i; opts = [ans, ...shuffle([...grp].filter((c) => c !== ans)).slice(0, 2)];
      return { w, ask: `「${w.w}」是哪個注音開頭？`, ans, opts: shuffle(opts), why: `${w.w}：${zyText(w.py, w.t)}，開頭是「${w.i}」` };
    }
    if (lv === 2) {                                                    // 拼拼看：換一個聲母、換一個韻母
      ans = zyText(w.py, w.t);
      const set = new Set([ans]);
      if (w.i) { const grp = ZY_INIT.find((g) => g.includes(w.i)), o = shuffle([...grp].filter((c) => c !== w.i))[0]; set.add(zyText(o + w.py.slice(1), w.t)); }
      const last = w.py.at(-1);
      if (ZY_FINAL[last]) set.add(zyText(w.py.slice(0, -1) + ZY_FINAL[last], w.t));
      for (const t of shuffle([1, 2, 3, 4])) { if (set.size >= 3) break; set.add(zyText(w.py, t)); }   // 不夠三個就換聲調
      opts = shuffle([...set].slice(0, 3));
      return { w, ask: `「${w.w}」要怎麼拼？`, ans, opts, why: `${w.w}：${ans}` };
    }
    ans = ZY_TONE_NAME[w.t];                                           // 第幾聲
    opts = shuffle([ans, ...shuffle([1, 2, 3, 4].filter((t) => t !== w.t)).slice(0, 2).map((t) => ZY_TONE_NAME[t])]);
    return { w, ask: `「${w.w}」${w.py} 是第幾聲？`, ans, opts, why: `${w.w}：${zyText(w.py, w.t)}，是${ans}` };
  });
}
const zyBox = document.getElementById('zy');
function startZhuyin(n) {
  stopAuto();
  const $ = (sel) => zyBox.querySelector(sel);
  const btns = [...zyBox.querySelectorAll('[data-k]')];
  const LV = ['', '找聲母', '拼拼看', '第幾聲'], LV_EN = ['', 'Find the initial', 'Spell it', 'Which tone?'];
  let lv = 1, qs = makeZhuyinLevel(1), i = 0, hearts = 3, best = 0, locked = false, done = false;
  try { best = +localStorage.getItem(ZHUYIN_KEY) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  faceTeacher(n);
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const save = (v) => { if (v > best) { best = v; try { localStorage.setItem(ZHUYIN_KEY, String(best)); } catch { /* 私密模式 */ } } };
  const ready = () => {
    locked = false;
    const q = qs[i];
    $('.lv').textContent = T(`第 ${lv} 關・${LV[lv]}（${i + 1}／${qs.length}）`, `Level ${lv} · ${LV_EN[lv]} (${i + 1}/${qs.length})`);
    $('.hearts').textContent = '❤️'.repeat(hearts) + '🤍'.repeat(3 - hearts);
    $('.emo').textContent = q.w.e; $('.word').textContent = q.w.w;
    $('.ask').textContent = q.ask;
    btns.forEach((b, k) => { b.disabled = false; b.className = ''; b.innerHTML = `${q.opts[k]}<small>${k + 1}</small>`; });
  };
  const finish = () => {
    done = true; zyBox.hidden = true;
    updateVisibility();
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const answer = (k) => {
    if (locked || done) return;
    locked = true; btns.forEach((b) => (b.disabled = true));
    const q = qs[i], right = q.opts[k] === q.ans;
    btns[q.opts.indexOf(q.ans)].className = 'right';
    if (!right) { btns[k].className = 'wrong'; hearts--; }
    $('.hearts').textContent = '❤️'.repeat(hearts) + '🤍'.repeat(3 - hearts);
    msg(`${right ? T('✅ 答對了！', '✅ Correct! ') : T('❌ 答錯囉！', '❌ Wrong! ')}${q.why}`, right ? 'ok' : 'no');
    npcFace(n, right ? 'happy' : 'surprised', 1.5);
    setTimeout(() => {
      if (done) return;
      if (!hearts) {
        save(lv - 1); npcFace(n, 'wink', 3); finish();
        toast(`${T(`🔤 闖到第 ${lv} 關，愛心用完了！（最好紀錄：過了 ${best} 關）`, `🔤 Out of hearts at level ${lv}! (best: ${best} cleared)`)}<br>${n.name}：沒關係，多念幾次就會記住了！`); return;
      }
      if (++i < qs.length) { ready(); return; }
      if (lv === 3) {
        save(3); npcFace(n, 'happy', 3); finish();
        toast(`${T('🏅 三關全部過關！你是注音小達人！', '🏅 All 3 levels cleared! Zhuyin master!')}<br>${n.name}：好棒！給你一個大大的讚！`); return;
      }
      save(lv); lv++; qs = makeZhuyinLevel(lv); i = 0;
      msg(T(`🎉 過關了！接下來第 ${lv} 關：${LV[lv]}`, `🎉 Level cleared! Next: level ${lv} · ${LV_EN[lv]}`), 'ok');
      setTimeout(() => { if (!done) ready(); }, 1200);
    }, 1800);
  };
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); answer(k); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b, k) => (b.onclick = () => answer(k)));
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(T(`🔤 下次再來找${n.name}闖關！`, `🔤 Come back for the challenge with ${n.name}!`)); } };
  act.busy = { label: T('🔤 注音闖關中…', '🔤 Zhuyin challenge…'), tick() {} };
  zyBox.hidden = false;
  ready();
  msg(`${n.name}：一共三關，答錯會少一顆愛心，加油！`);
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  zhuyin: (s) => startZhuyin(s.npc),
};
