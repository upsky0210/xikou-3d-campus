/* 幼兒園與各科老師的題庫小遊戲（kgPlay、mcGame）
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import { faceTeacher } from './common.js?v=303';
import { p3dGroup, p3dImage } from './puzzle3d.js?v=303';
import { D, T, mx, mz, floors, rooms, player, avatar, placeAt, updateVisibility, stopAuto, toast, placeNPC, npcFace, act, spotFloor, gameState } from '../app.js?v=303';

/* ---------------- 幼兒園小遊戲（共用一個面板 #kg）：動物疊疊樂（小粉老師）、空間方塊（雅如老師）、串珠遊戲（何何老師）、
   摺紙遊戲（喵喵老師）、炒菜遊戲（高阿姨）。每個遊戲只寫自己的玩法，開始／結束／Esc／紀錄交給 kgPlay ---------------- */
const kgBox = document.getElementById('kg');
const kgShuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
// G：{ key（紀錄）, title, label（玩的時候按鈕上的字）, bye（中途結束的話）, start(ctx) }
function kgPlay(n, G) {
  stopAuto();
  const $ = (sel) => kgBox.querySelector(sel);
  let done = false, best = 0;
  try { best = +localStorage.getItem(G.key) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  if (!G.noFace) faceTeacher(n);                                       // noFace：B1 的巴士、體操遊戲沒有老師，不用把人移到老師前面
  const ctx = {
    n, best, stage: $('.stage'),
    prog: (t) => { $('.prog').textContent = t; },
    ask: (t) => { $('.ask').innerHTML = t; },
    msg: (t, cls = '') => { const m = $('.msg'); m.innerHTML = t; m.className = `msg ${cls}`; },
    face: (ex, sec = 1.5) => npcFace(n, ex, sec),
    // buttons：[{ html, on, cls }]；第 i 顆也可以按數字鍵 i+1
    buttons: (list) => {
      const box = $('.btns'); box.innerHTML = '';
      ctx.btnEls = list.map((b, i) => {
        const el = document.createElement('button'); el.innerHTML = b.html; if (b.cls) el.className = b.cls;
        el.onclick = () => { if (!done && !el.disabled) b.on(el, i); }; box.appendChild(el); return el;
      });
      return ctx.btnEls;
    },
    later: (fn, ms) => setTimeout(() => { if (!done) fn(); }, ms),
    // 玩完：score 比紀錄高就存起來，最後跳出老師的話
    end: (score, text) => {
      if (score > best) { best = score; try { localStorage.setItem(G.key, String(best)); } catch { /* 私密模式 */ } }
      ctx.face('happy', 3); finish(); toast(text(best));
    },
    onKey: null, tick: null,
  };
  const finish = () => {
    done = true; kgBox.hidden = true; ctx.stage.innerHTML = '';
    updateVisibility();
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; gameState.duel = null;
    ctx.onStop?.();                                                    // 食農教育：從小田園回學務處
  };
  const onKey = (e) => {
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); gameState.duel?.quit(); return; }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m && ctx.btnEls?.[+m[1] - 1]) { e.preventDefault(); e.stopPropagation(); ctx.btnEls[+m[1] - 1].click(); return; }
    if (ctx.onKey?.(e)) { e.preventDefault(); e.stopPropagation(); }
  };
  addEventListener('keydown', onKey, true);
  $('.quit').onclick = () => gameState.duel?.quit();
  $('.ttl').textContent = `${T(...G.title)}・${n.name}`;
  gameState.duel = { quit() { finish(); toast(G.bye(n)); } };
  act.busy = { label: T(...G.label), tick(dt) { ctx.tick?.(dt); } };
  ctx.prog(''); ctx.ask(''); ctx.msg(''); $('.btns').innerHTML = ''; ctx.stage.onclick = null;
  kgBox.hidden = false;
  G.start(ctx);
}
const KG_GAMES = { get stack() { return KG_STACK; }, get cubes() { return KG_CUBES; }, get beads() { return KG_BEADS; }, get fold() { return KG_FOLD; }, get cook() { return KG_COOK; },
  get darkchess() { return KG_DARKCHESS; }, get shrink() { return KG_SHRINK; }, get bugs() { return KG_BUGS; }, get animalcall() { return KG_ANIMALCALL; }, get toyhome() { return KG_TOYHOME; }, get shadow() { return KG_SHADOW; }, get farm() { return KG_FARM; }, get prep() { return KG_PREP; }, get mood() { return KG_MOOD; }, get library() { return KG_LIB; }, get notes() { return KG_NOTES; }, get weather() { return KG_WEATHER; }, get tones() { return KG_TONES; }, get add4() { return KG_ADD4; }, get perim() { return KG_PERIM; }, get weave() { return KG_WEAVE; }, get go() { return KG_GO; }, get cut() { return KG_CUT; }, get decimal() { return KG_DECIMAL; }, get shapes() { return KG_SHAPES; }, get throw() { return KG_THROW; }, get units() { return KG_UNITS; }, get geo() { return KG_GEO; } };
const kgCanvas = (ctx, w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; ctx.stage.innerHTML = ''; ctx.stage.appendChild(cv); return cv; };

/* ---- 動物疊疊樂（小粉老師，太陽班）：上面的動物積木左右移動，按「放下」（F／空白鍵）疊上去；疊歪太多會倒，倒了 3 次就結束，疊到 10 層全對 ---- */
const STACK_ANIMALS = ['🐘', '🦒', '🐼', '🐰', '🐻', '🐷', '🐸', '🐱', '🐶', '🦁', '🐯', '🐨'];
const STACK_COLS = ['#ffd166', '#06d6a0', '#ef476f', '#7fc8e8', '#f4a261', '#c3a6ff'];
const KG_STACK = {
  key: 'campus-kg-stack-best', title: ['🐘 動物疊疊樂', '🐘 Animal Stacking'], label: ['🐘 動物疊疊樂中…', '🐘 Stacking…'],
  bye: (n) => T(`🐘 下次再來找${n.name}玩疊疊樂！`, `🐘 Come back to stack animals with ${n.name}!`),
  start(ctx) {
    const W = 300, H = 260, BW = 74, BH = 34, GOAL = 10;
    const cv = kgCanvas(ctx, W, H), c = cv.getContext('2d');
    const tower = [{ x: W / 2, a: '🧸', col: '#d9b98a' }];                // 最下面是木頭底座
    let cur = null, falls = 0, fall = null, t = 0;
    const next = () => { cur = { x: BW / 2, dir: 1, a: STACK_ANIMALS[tower.length % STACK_ANIMALS.length], col: STACK_COLS[tower.length % STACK_COLS.length], drop: null }; };
    const speed = () => 70 + tower.length * 14;
    const block = (x, y, a, col) => {
      c.fillStyle = col; c.fillRect(x - BW / 2, y, BW, BH); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.strokeRect(x - BW / 2 + 1, y + 1, BW - 2, BH - 2);
      c.font = '24px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(a, x, y + BH / 2 + 1);
    };
    const draw = () => {
      c.fillStyle = '#fff6e0'; c.fillRect(0, 0, W, H);
      const shift = Math.max(0, tower.length - 5) * BH;                   // 疊高了畫面往下捲
      c.fillStyle = '#e6d3b5'; c.fillRect(0, H - 14 + shift, W, 14);
      tower.forEach((b, i) => block(b.x, H - 14 - (i + 1) * BH + shift, b.a, b.col));
      if (fall) { c.save(); c.translate(fall.x, fall.y); c.rotate(fall.r); block(0, -BH / 2, fall.a, fall.col); c.restore(); }
      if (cur) block(cur.x, cur.drop ? cur.drop.y : 16, cur.a, cur.col);
    };
    const place = () => {
      if (!cur || cur.drop || fall) return;
      cur.drop = { y: 16 };
    };
    const shift = () => Math.max(0, tower.length - 5) * BH;
    ctx.tick = (dt) => {
      t += dt;
      if (cur && !cur.drop) { cur.x += cur.dir * speed() * dt; if (cur.x > W - BW / 2) { cur.x = W - BW / 2; cur.dir = -1; } if (cur.x < BW / 2) { cur.x = BW / 2; cur.dir = 1; } }
      if (cur?.drop) {
        cur.drop.y += 520 * dt;
        const land = H - 14 - (tower.length + 1) * BH + shift();
        if (cur.drop.y >= land) {
          const top = tower[tower.length - 1], dx = cur.x - top.x;
          if (Math.abs(dx) <= BW * 0.6) {                                  // 疊上去了
            tower.push({ x: cur.x, a: cur.a, col: cur.col }); cur = null;
            ctx.prog(T(`疊了 ${tower.length - 1} 層`, `${tower.length - 1} stacked`));
            if (tower.length - 1 >= GOAL) {
              ctx.msg(T('🎉 疊到 10 層了！好穩喔！', '🎉 10 animals high! So steady!'), 'ok'); ctx.face('happy', 2); draw();
              return void ctx.later(() => ctx.end(GOAL, (b) => `${T('🐘 動物疊疊樂：疊到 10 層！', '🐘 Animal Stacking: 10 high!')}<br>${ctx.n.name}：好棒！玩完記得把玩具送回家，它們也要休息喔。`), 1400);
            }
            ctx.msg(Math.abs(dx) < 8 ? T('✨ 剛剛好！', '✨ Perfect!') : T('👍 疊上去了！', '👍 It stayed!'), 'ok');
            next();
          } else {                                                          // 歪太多，掉下去
            fall = { x: cur.x, y: cur.drop.y + BH / 2, r: 0, vx: Math.sign(dx) * 90, vy: -40, a: cur.a, col: cur.col }; cur = null;
            falls++; ctx.face('surprised', 1.2);
            ctx.msg(T(`😮 倒了！倒了也沒關係，我們再試一次！（還有 ${3 - falls} 次）`, `😮 It fell! That's okay, let's try again! (${3 - falls} left)`), 'no');
          }
        }
      }
      if (fall) {
        fall.vy += 600 * dt; fall.x += fall.vx * dt; fall.y += fall.vy * dt; fall.r += Math.sign(fall.vx) * 4 * dt;
        if (fall.y > H + 60) {
          fall = null;
          if (falls >= 3) {
            const h = tower.length - 1;
            draw();
            return void ctx.end(h, (b) => `${T(`🐘 疊了 ${h} 層（最高紀錄 ${b} 層）`, `🐘 ${h} stacked (best ${b})`)}<br>${ctx.n.name}：疊疊樂要慢慢放、輕輕放，下次一定更高！`);
          }
          next();
        }
      }
      draw();
    };
    ctx.onKey = (e) => { if (e.code === 'KeyF' || e.code === 'Space') { place(); return true; } return false; };
    cv.onclick = place;
    ctx.buttons([{ html: T('⬇️ 放下 <small>F／空白鍵</small>', '⬇️ Drop <small>F / Space</small>'), on: place }]);
    ctx.ask(T('動物積木左右移動，對準下面那塊再放下！疊到 10 層就成功', 'Line the animal up with the one below, then drop it! Stack 10 to win'));
    ctx.prog(T('疊了 0 層', '0 stacked'));
    next(); draw();
  },
};

/* ---- 空間方塊（雅如老師，彩虹班）：方塊疊高高、排長長，數數看有幾個（一排看得到每一個）；一回 5 題 ---- */
const KG_CUBES = {
  key: 'campus-kg-cubes-best', title: ['🧊 空間方塊', '🧊 Block Count'], label: ['🧊 空間方塊中…', '🧊 Counting blocks…'],
  bye: (n) => T(`🧊 下次再來找${n.name}數方塊！`, `🧊 Come back to count blocks with ${n.name}!`),
  start(ctx) {
    const cols = ['r', 'y', 'b', 'g', 'o'];
    let i = 0, right = 0, tries = 0;
    const make = (k) => {                                                   // 越後面越難：欄位越多、越高
      const nc = Math.min(5, 2 + (k >> 1) + (Math.random() < 0.5 ? 1 : 0)), hs = [];
      for (let j = 0; j < nc; j++) hs.push(1 + (Math.random() * Math.min(3, 1 + k) | 0));
      if (Math.random() < 0.3) hs.fill(1);                                   // 有時候是排長長的一排
      return hs;
    };
    const ask = () => {
      tries = 0;
      const hs = make(i), total = hs.reduce((a, b) => a + b, 0), col = cols[i % cols.length];
      const cubes = hs.flatMap((h, x) => Array.from({ length: h }, (_, y) => [x, y, 0]));
      ctx.stage.innerHTML = `<img alt="" src="${p3dImage(p3dGroup(cubes, col))}">`;
      const opts = new Set([total]);
      while (opts.size < 3) { const d = total + kgShuffle([-2, -1, 1, 2])[0]; if (d > 0) opts.add(d); }
      const list = kgShuffle([...opts]);
      ctx.prog(T(`第 ${i + 1} / 5 題`, `${i + 1} / 5`));
      ctx.ask(hs.every((h) => h === 1) ? T('方塊排長長，一共有幾個？', 'The blocks are in a long row. How many?') : T('方塊疊高高，一共有幾個？', 'The blocks are stacked up. How many?'));
      ctx.msg(T('一個一個慢慢數～', 'Count them one by one~'));
      ctx.buttons(list.map((v) => ({ html: `${v}<small>${list.indexOf(v) + 1}</small>`, on: (el) => {
        tries++;
        if (v !== total) { el.disabled = true; el.className = 'wrong'; ctx.face('surprised', 1); return ctx.msg(T('再數一次看看，有不會的地方舉手問老師就好囉！', "Count again. If you're stuck, just ask the teacher!"), 'no'); }
        el.className = 'right'; ctx.btnEls.forEach((b) => (b.disabled = true));
        if (tries === 1) right++;
        ctx.face('happy'); ctx.msg(T(`✅ 對！一共有 ${total} 個方塊`, `✅ Yes! ${total} blocks`), 'ok');
        ctx.later(() => (++i < 5 ? ask() : ctx.end(right, (b) => `${T(`🧊 一次就數對 ${right} / 5 題（最好紀錄 ${b} 題）`, `🧊 ${right} / 5 right on the first try (best ${b})`)}<br>${ctx.n.name}：方塊可以疊高高、也可以排長長，你好會數！`)), 1400);
      } })));
    };
    ask();
  },
};

/* ---- 串珠遊戲（何何老師，月亮班）：看珠子的規律，下一顆是什麼顏色？一回 5 題（規律越來越難） ---- */
const BEADS = { r: '#e53935', y: '#fbc02d', b: '#1e88e5', g: '#43a047', p: '#8e24aa' };
const BEAD_NAME = { r: ['紅色', 'red'], y: ['黃色', 'yellow'], b: ['藍色', 'blue'], g: ['綠色', 'green'], p: ['紫色', 'purple'] };
const KG_BEADS = {
  key: 'campus-kg-beads-best', title: ['📿 串珠遊戲', '📿 Bead Patterns'], label: ['📿 串珠遊戲中…', '📿 Beading…'],
  bye: (n) => T(`📿 下次再來找${n.name}串珠子！`, `📿 Come back to string beads with ${n.name}!`),
  start(ctx) {
    const PATS = [['A', 'B'], ['A', 'A', 'B'], ['A', 'B', 'B'], ['A', 'B', 'C'], ['A', 'A', 'B', 'B'], ['A', 'B', 'C', 'C']];
    let i = 0, right = 0, tries = 0;
    const bead = (k, q) => `<span class="bead${q ? ' q' : ''}" style="background:${q ? '#fff' : BEADS[k]}">${q ? '?' : ''}</span>`;
    const ask = () => {
      tries = 0;
      const pat = PATS[Math.min(PATS.length - 1, i + (Math.random() < 0.4 ? 1 : 0))];
      const keys = kgShuffle(Object.keys(BEADS)), map = { A: keys[0], B: keys[1], C: keys[2] };
      const len = pat.length * 2 + 1 + (Math.random() * pat.length | 0), seq = Array.from({ length: len + 1 }, (_, j) => map[pat[j % pat.length]]);
      const ans = seq[len];
      ctx.stage.innerHTML = `<div class="string">${seq.slice(0, len).map((k) => bead(k)).join('')}${bead(ans, true)}</div>`;
      const opts = kgShuffle([ans, ...kgShuffle(keys.filter((k) => k !== ans)).slice(0, 2)]);
      ctx.prog(T(`第 ${i + 1} / 5 題`, `${i + 1} / 5`));
      ctx.ask(T('串珠要一顆一顆來，下一顆是什麼顏色？', 'One bead at a time. What color comes next?'));
      ctx.msg(T('看看顏色怎麼重複，你發現規律了嗎？', 'How do the colors repeat? Can you find the pattern?'));
      ctx.buttons(opts.map((k, j) => ({ html: `${bead(k)}<small>${T(BEAD_NAME[k][0], BEAD_NAME[k][1])} ${j + 1}</small>`, on: (el) => {
        tries++;
        if (k !== ans) { el.disabled = true; el.className = 'wrong'; ctx.face('surprised', 1); return ctx.msg(T('沒關係，從頭再看一次規律！', "That's okay. Look at the pattern from the start again!"), 'no'); }
        el.className = 'right'; ctx.btnEls.forEach((b) => (b.disabled = true));
        if (tries === 1) right++;
        ctx.stage.querySelector('.q').outerHTML = bead(ans);
        ctx.face('happy'); ctx.msg(T(`✅ 對！是${BEAD_NAME[ans][0]}`, `✅ Right! It's ${BEAD_NAME[ans][1]}`), 'ok');
        ctx.later(() => (++i < 5 ? ask() : ctx.end(right, (b) => `${T(`📿 一次就答對 ${right} / 5 題（最好紀錄 ${b} 題）`, `📿 ${right} / 5 right on the first try (best ${b})`)}<br>${ctx.n.name}：你好有耐心，規律都被你找到了！`)), 1400);
      } })));
    };
    ask();
  },
};

/* ---- 摺紙遊戲（喵喵老師，彩虹班）：跟著老師一步一步摺小狗、小貓，每一步選「摺好會變成哪一個」；兩隻都摺完就結束 ---- */
const FOLD = (() => {
  const P = (pts, dark) => ({ pts, dark });
  const sq = [P([[50, 5], [95, 50], [50, 95], [5, 50]])];
  const triDown = [P([[5, 25], [95, 25], [50, 90]])];
  const triUp = [P([[50, 10], [95, 75], [5, 75]])];
  const rect = [P([[10, 30], [90, 30], [90, 70], [10, 70]])];
  const dogEars = [P([[5, 25], [95, 25], [50, 90]]), P([[5, 25], [28, 25], [16, 64]], true), P([[95, 25], [72, 25], [84, 64]], true)];
  const catEars = [P([[15, 38], [85, 38], [50, 92]]), P([[15, 38], [34, 38], [18, 8]], true), P([[85, 38], [66, 38], [82, 8]], true)];
  const dogChin = [P([[5, 25], [95, 25], [62, 76], [38, 76]]), P([[38, 76], [62, 76], [50, 64]], true), P([[5, 25], [28, 25], [16, 64]], true), P([[95, 25], [72, 25], [84, 64]], true)];
  const catTop = [P([[15, 46], [85, 46], [50, 92]]), P([[15, 46], [34, 46], [18, 14]], true), P([[85, 46], [66, 46], [82, 14]], true)];
  return {
    dog: { n: ['小狗', 'puppy'], e: '🐶', col: '#f4a261', dk: '#c97a3c', face: [50, 48], steps: [
      { say: ['角對角：上面的角摺到下面的角', 'Corner to corner: fold the top corner down to the bottom'], ok: triDown, wrong: [rect, triUp] },
      { say: ['兩邊的角往下摺，變成垂垂的耳朵', 'Fold both side corners down to make floppy ears'], ok: dogEars, wrong: [catEars, triDown] },
      { say: ['下面的尖角往上摺一點點，壓平', 'Fold the bottom tip up a little and press it flat'], ok: dogChin, wrong: [dogEars, catTop] },
    ] },
    cat: { n: ['小貓', 'kitty'], e: '🐱', col: '#f2a6c4', dk: '#c9739a', face: [50, 62], steps: [
      { say: ['角對角：上面的角摺到下面的角', 'Corner to corner: fold the top corner down to the bottom'], ok: triDown, wrong: [triUp, rect] },
      { say: ['兩邊的角往上摺，變成尖尖的耳朵', 'Fold both side corners up to make pointy ears'], ok: catEars, wrong: [dogEars, triDown] },
      { say: ['上面的邊往後摺一點，邊對邊壓平', 'Fold the top edge back a little, edge to edge'], ok: catTop, wrong: [catEars, dogChin] },
    ] },
    sq,
  };
})();
function drawFold(shape, craft, face = false) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 100;
  const c = cv.getContext('2d');
  for (const { pts, dark } of shape) {
    c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    c.fillStyle = dark ? craft.dk : craft.col; c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
  }
  if (face) {                                                                // 畫上眼睛、鼻子、嘴巴
    const [x, y] = craft.face;
    c.fillStyle = '#222'; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * 12, y - 6, 3.5, 0, 7); c.fill(); }
    c.beginPath(); c.arc(x, y + 4, 3.5, 0, 7); c.fill();
    c.strokeStyle = '#222'; c.lineWidth = 1.8; c.beginPath(); c.arc(x - 4, y + 9, 4, 0, Math.PI); c.stroke(); c.beginPath(); c.arc(x + 4, y + 9, 4, 0, Math.PI); c.stroke();
  }
  return cv.toDataURL();
}
const KG_FOLD = {
  key: 'campus-kg-fold-best', title: ['🐶 摺紙遊戲', '🐶 Origami'], label: ['🐶 摺紙中…', '🐶 Folding…'],
  bye: (n) => T(`🐶 下次再來找${n.name}摺紙！`, `🐶 Come back for origami with ${n.name}!`),
  start(ctx) {
    const crafts = kgShuffle(['dog', 'cat']).map((k) => FOLD[k]);
    let ci = 0, si = 0, right = 0, tries = 0;
    const total = crafts.reduce((a, cr) => a + cr.steps.length, 0);
    const show = (shape, cr, face) => { ctx.stage.innerHTML = `<img class="fold" alt="" src="${drawFold(shape, cr, face)}">`; };
    const step = () => {
      tries = 0;
      const cr = crafts[ci], st = cr.steps[si];
      show(si ? cr.steps[si - 1].ok : FOLD.sq, cr);
      ctx.prog(T(`${cr.e} 摺${cr.n[0]}・第 ${si + 1} / ${cr.steps.length} 步`, `${cr.e} Folding a ${cr.n[1]} · Step ${si + 1} / ${cr.steps.length}`));
      ctx.ask(T(...st.say));
      ctx.msg(T('摺好會變成哪一個？', 'What will it look like after folding?'));
      const opts = kgShuffle([st.ok, ...st.wrong]);
      ctx.buttons(opts.map((sh, j) => ({ html: `<img alt="" src="${drawFold(sh, cr)}"><small>${j + 1}</small>`, on: (el) => {
        tries++;
        if (sh !== st.ok) { el.disabled = true; el.className = 'wrong'; ctx.face('surprised', 1); return ctx.msg(T('再想一想～角對角、邊對邊喔！', 'Think again~ corner to corner, edge to edge!'), 'no'); }
        el.className = 'right'; ctx.btnEls.forEach((b) => (b.disabled = true));
        if (tries === 1) right++;
        show(st.ok, cr); ctx.face('happy');
        ctx.msg(T('✅ 對！壓平一點，作品會更漂亮喔', '✅ Right! Press it flat to make it neater'), 'ok');
        ctx.later(() => {
          if (++si < cr.steps.length) return step();
          show(st.ok, cr, true); ctx.buttons([]);                              // 一隻摺好了：畫上臉
          ctx.ask(T(`${cr.e} ${cr.n[0]}摺好了！畫上眼睛和鼻子～`, `${cr.e} The ${cr.n[1]} is done! Add eyes and a nose~`));
          ctx.msg(T('做好的作品可以帶回家送給爸爸媽媽！', 'You can take it home for your family!'), 'ok');
          ctx.later(() => {
            if (++ci < crafts.length) { si = 0; return step(); }
            ctx.end(right, (b) => `${T(`🐶 摺好小狗和小貓！一次就選對 ${right} / ${total} 步（最好紀錄 ${b} 步）`, `🐶 Puppy and kitty done! ${right} / ${total} steps right on the first try (best ${b})`)}<br>${ctx.n.name}：角對角、邊對邊，你摺得好漂亮！`);
          }, 1800);
        }, 1300);
      } })));
    };
    step();
  },
};

/* ---- 炒菜遊戲（高阿姨，廚房）：先洗手，再選這道菜要的材料放進鍋子，翻炒 5 下就上菜；一回 3 道菜 ---- */
const COOK_DISHES = [
  { n: ['番茄炒蛋', 'Tomato and egg'], need: ['🍅', '🥚'] },
  { n: ['炒青菜', 'Stir-fried greens'], need: ['🥬', '🧄'] },
  { n: ['蔬菜炒飯', 'Veggie fried rice'], need: ['🍚', '🥚', '🥕', '🌽'] },
  { n: ['玉米炒蛋', 'Corn and egg'], need: ['🌽', '🥚'] },
  { n: ['紅蘿蔔炒高麗菜', 'Cabbage and carrot'], need: ['🥬', '🥕'] },
];
const COOK_ALL = ['🍅', '🥚', '🥬', '🧄', '🍚', '🥕', '🌽', '🍄', '🧅', '🍌', '🍬', '🍦'];
const KG_COOK = {
  key: 'campus-kg-cook-best', title: ['🍳 炒菜遊戲', '🍳 Cooking'], label: ['🍳 炒菜中…', '🍳 Cooking…'],
  bye: (n) => T(`🍳 下次再來找${n.name}炒菜！`, `🍳 Come back to cook with ${n.name}!`),
  start(ctx) {
    const dishes = kgShuffle(COOK_DISHES.slice()).slice(0, 3);
    let di = 0, perfect = 0, miss = 0, inWok = [], stirs = 0, shake = 0;
    const wok = () => {
      ctx.stage.innerHTML = `<div class="wok${shake ? ' shake' : ''}"><div class="pan">${inWok.map((e) => `<span>${e}</span>`).join('')}</div></div>`;
    };
    const stir = () => {
      if (stirs >= 5) return;
      stirs++; shake = 1; wok(); setTimeout(() => { shake = 0; if (!kgBox.hidden) wok(); }, 160);
      ctx.msg(T(`翻炒 ${stirs} / 5`, `Stir ${stirs} / 5`), 'ok');
      if (stirs < 5) return;
      const d = dishes[di]; if (!miss) perfect++;
      ctx.buttons([]); ctx.face('happy');
      ctx.ask(T(`🍽️「${d.n[0]}」上菜了！好香～`, `🍽️ "${d.n[1]}" is ready! Smells great~`));
      ctx.msg(T('今天的菜很好吃喔，都要吃光光！', "Today's food is yummy. Eat it all up!"), 'ok');
      ctx.later(() => (++di < dishes.length ? dish() : ctx.end(perfect, (b) => `${T(`🍳 做好 3 道菜！材料一次就全選對 ${perfect} 道（最好紀錄 ${b} 道）`, `🍳 3 dishes done! ${perfect} with all the right ingredients first try (best ${b})`)}<br>${ctx.n.name}：吃完把碗放回來，謝謝你！`)), 1700);
    };
    const dish = () => {
      const d = dishes[di]; inWok = []; stirs = 0; miss = 0; wok();
      ctx.prog(T(`第 ${di + 1} / 3 道`, `Dish ${di + 1} / 3`));
      ctx.ask(T(`今天做「${d.n[0]}」，要放哪些材料？`, `Let's make "${d.n[1]}". Which ingredients go in?`));
      ctx.msg(T('青菜也要吃，不可以挑食喔！', "Eat your veggies too, don't be picky!"));
      const opts = kgShuffle([...d.need, ...kgShuffle(COOK_ALL.filter((e) => !d.need.includes(e))).slice(0, 6 - d.need.length)]);
      ctx.buttons(opts.map((e, j) => ({ html: `${e}<small>${j + 1}</small>`, on: (el) => {
        if (!d.need.includes(e)) { el.disabled = true; el.className = 'wrong'; miss++; ctx.face('surprised', 1); return ctx.msg(T(`「${d.n[0]}」不用放 ${e} 喔！`, `"${d.n[1]}" doesn't need ${e}!`), 'no'); }
        el.disabled = true; el.className = 'right'; inWok.push(e); wok();
        if (inWok.length < d.need.length) return ctx.msg(T(`放進 ${e} 了！還差 ${d.need.length - inWok.length} 樣`, `${e} is in! ${d.need.length - inWok.length} more`), 'ok');
        ctx.msg(T('材料都放好了，開始炒！', 'All in. Start stir-frying!'), 'ok');
        ctx.buttons([{ html: T('🍳 翻炒 <small>F</small>', '🍳 Stir <small>F</small>'), on: stir }]);
      } })));
    };
    ctx.onKey = (e) => { if (e.code === 'KeyF' && stirs < 5 && ctx.btnEls?.length === 1 && inWok.length) { stir(); return true; } return false; };
    wok();
    ctx.ask(T('吃飯前、煮飯前都要先洗手！', 'Wash your hands before cooking and eating!'));
    ctx.buttons([{ html: T('🧼 先洗手 <small>1</small>', '🧼 Wash hands <small>1</small>'), on: () => { ctx.msg(T('🫧 洗乾淨了！', '🫧 All clean!'), 'ok'); ctx.later(dish, 700); ctx.buttons([]); } }]);
  },
};


/* ---- 暗棋（小靜老師，星星班）：4×8 棋盤 32 顆棋子全部蓋著。第一次翻到什麼顏色你就是那一邊；
   每回合翻一顆，或把自己的棋子走一格（上下左右）；大吃小（帥＞仕＞相＞俥＞傌＞炮＞兵），兵可以吃帥、帥不能吃兵；
   炮要隔一顆棋子才能吃（直線、距離不限）。吃光對方就贏；60 步都沒有吃子就和局 ---- */
const DC_NAMES = { r: ['帥', '仕', '相', '俥', '傌', '炮', '兵'], b: ['將', '士', '象', '車', '馬', '包', '卒'] };
const DC_RANK = [7, 6, 5, 4, 3, 2, 1];                                     // 名字的順序對應的大小
const DC_COUNT = [1, 2, 2, 2, 2, 2, 5];
const KG_DARKCHESS = {
  key: 'campus-kg-darkchess-wins', title: ['♟️ 暗棋', '♟️ Dark Chess'], label: ['♟️ 下暗棋中…', '♟️ Playing dark chess…'],
  bye: (n) => T(`♟️ 下次再來找${n.name}下暗棋！`, `♟️ Come back for dark chess with ${n.name}!`),
  start(ctx) {
    const R = 4, C = 8;
    const pieces = [];
    for (const side of ['r', 'b']) DC_COUNT.forEach((cnt, k) => { for (let i = 0; i < cnt; i++) pieces.push({ side, k, up: false }); });
    const board = kgShuffle(pieces);                                       // board[r*C+c]：棋子或 null
    let me = null, ai = null, turn = 'me', sel = -1, quiet = 0, over = false;
    const rank = (p) => DC_RANK[p.k];
    const canEat = (a, b) => {                                             // a 能不能吃 b（不看炮的規則）
      if (!b || !b.up || a.side === b.side) return false;
      if (a.k === 0 && b.k === 6) return false;                            // 帥不能吃兵
      if (a.k === 6 && b.k === 0) return true;                             // 兵可以吃帥
      return rank(a) >= rank(b);
    };
    const rc = (i) => [Math.floor(i / C), i % C];
    // 某顆棋子的所有走法：[到哪, 是不是吃子]
    const movesOf = (i) => {
      const p = board[i], [r, c] = rc(i), out = [];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
        const j = nr * C + nc, q = board[j];
        if (!q) out.push([j, false]);
        else if (p.k !== 5 && canEat(p, q)) out.push([j, true]);
        if (p.k === 5) {                                                   // 炮：往這個方向找，跳過一顆之後遇到的第一顆
          let jumped = false;
          for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < R && cc >= 0 && cc < C; rr += dr, cc += dc) {
            const t = board[rr * C + cc]; if (!t) continue;
            if (!jumped) { jumped = true; continue; }
            if (t.up && t.side !== p.side) out.push([rr * C + cc, true]);
            break;
          }
        }
      }
      return out;
    };
    const left = (side) => board.filter((p) => p && p.side === side).length;
    const nameOf = (p) => DC_NAMES[p.side][p.k];
    const sideName = (s) => (s === 'r' ? T('紅色', 'Red') : T('黑色', 'Black'));
    const draw = () => {
      ctx.stage.innerHTML = `<div class="dc">${board.map((p, i) => {
        const cls = !p ? 'e' : !p.up ? 'd' : p.side;
        const tgt = sel >= 0 && movesOf(sel).some(([j]) => j === i);
        return `<button data-i="${i}" class="${cls}${i === sel ? ' sel' : ''}${tgt ? ' tgt' : ''}">${p && p.up ? nameOf(p) : ''}</button>`;
      }).join('')}</div>`;
      ctx.stage.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => click(+b.dataset.i)));
      ctx.prog(me ? T(`你是${sideName(me)}・${sideName(me)} ${left(me)} 顆、${sideName(ai)} ${left(ai)} 顆`, `You: ${sideName(me)} · ${left(me)} vs ${left(ai)}`) : T('先翻一顆棋子', 'Flip a piece first'));
    };
    const finishCheck = () => {
      if (!me) return false;
      const lost = (s) => !left(s) || (!board.some((p) => p && !p.up) && !board.some((p, i) => p && p.side === s && movesOf(i).length));
      if (lost(ai)) { over = true; draw(); ctx.face('surprised', 2); ctx.msg(T('🎉 你贏了！', '🎉 You win!'), 'ok'); ctx.later(() => ctx.end(ctx.best + 1, (b) => `${T(`♟️ 你贏了${ctx.n.name}！（已經贏 ${b} 次）`, `♟️ You beat ${ctx.n.name}! (${b} wins)`)}<br>${ctx.n.name}：好厲害！下棋要先想一想再動手喔！`), 1500); return true; }
      if (lost(me)) { over = true; draw(); ctx.face('happy', 2); ctx.msg(T(`${ctx.n.name}贏了！`, `${ctx.n.name} wins!`), 'no'); ctx.later(() => ctx.end(0, () => `${T(`♟️ ${ctx.n.name}贏了！`, `♟️ ${ctx.n.name} wins!`)}<br>${ctx.n.name}：輸了沒關係，我們再下一盤！`), 1500); return true; }
      if (quiet >= 60) { over = true; draw(); ctx.msg(T('🤝 60 步都沒有吃子，和局！', '🤝 60 moves with no capture. A draw!')); ctx.later(() => ctx.end(0, () => `${T(`♟️ 跟${ctx.n.name}和局！`, `♟️ A draw with ${ctx.n.name}!`)}<br>${ctx.n.name}：下得很好喔，旗鼓相當！`), 1500); return true; }
      return false;
    };
    const doMove = (from, to) => { const eat = !!board[to]; board[to] = board[from]; board[from] = null; quiet = eat ? 0 : quiet + 1; return eat; };
    const aiTurn = () => {
      turn = 'ai'; ctx.msg(T(`${ctx.n.name}想一想…`, `${ctx.n.name} is thinking…`));
      ctx.later(() => {
        if (over) return;
        const mine = board.map((p, i) => (p && p.up && p.side === ai ? i : -1)).filter((i) => i >= 0);
        const all = mine.flatMap((i) => movesOf(i).map(([j, eat]) => ({ i, j, eat })));
        const danger = (j, p) => board.some((q, k) => q && q.up && q.side === me && (k !== j) && movesOf(k).some(([t, e]) => t === j && e) && canEat(q, p));
        const eats = all.filter((m) => m.eat).sort((a, b) => rank(board[b.j]) - rank(board[a.j]));
        const downs = board.map((p, i) => (p && !p.up ? i : -1)).filter((i) => i >= 0);
        let text = '';
        if (eats.length && Math.random() < 0.85) {                         // 能吃就吃（偶爾會漏看）
          const m = eats[0], q = board[m.j]; doMove(m.i, m.j); text = T(`${ctx.n.name}用${nameOf(board[m.j])}吃掉你的${nameOf(q)}！`, `${ctx.n.name} captured your ${nameOf(q)}!`);
        } else {
          const threatened = mine.filter((i) => board.some((q, k) => q && q.up && q.side === me && movesOf(k).some(([t, e]) => t === i && e)));
          const escape = threatened.flatMap((i) => movesOf(i).filter(([j, e]) => !e).map(([j]) => ({ i, j }))).find((m) => !danger(m.j, board[m.i]));
          if (escape && Math.random() < 0.7) { doMove(escape.i, escape.j); text = T(`${ctx.n.name}把${nameOf(board[escape.j])}移開了`, `${ctx.n.name} moved away`); }
          else if (downs.length && (Math.random() < 0.75 || !all.length)) { const i = downs[Math.random() * downs.length | 0]; board[i].up = true; quiet++; text = T(`${ctx.n.name}翻開一顆：${nameOf(board[i])}`, `${ctx.n.name} flipped ${nameOf(board[i])}`); }
          else if (all.length) { const safe = all.filter((m) => !m.eat && !danger(m.j, board[m.i])); const m = (safe.length ? safe : all)[Math.random() * (safe.length || all.length) | 0]; doMove(m.i, m.j); text = T(`${ctx.n.name}走了一步`, `${ctx.n.name} moved`); }
        }
        turn = 'me'; draw();
        if (!finishCheck()) ctx.msg(`${text}${T('　換你了！', '　Your turn!')}`);
      }, 800);
    };
    const click = (i) => {
      if (over || turn !== 'me') return;
      const p = board[i];
      if (sel >= 0) {
        const mv = movesOf(sel).find(([j]) => j === i);
        if (mv) {
          const q = board[i], eat = doMove(sel, i); sel = -1; draw();
          if (eat) { ctx.face('surprised', 1); ctx.msg(T(`吃掉了${nameOf(q)}！`, `Captured ${nameOf(q)}!`), 'ok'); }
          if (!finishCheck()) aiTurn();
          return;
        }
        sel = -1;
      }
      if (p && !p.up) {                                                    // 翻棋
        p.up = true; quiet++;
        if (!me) { me = p.side; ai = me === 'r' ? 'b' : 'r'; ctx.msg(T(`翻到${nameOf(p)}，你是${sideName(me)}！`, `You flipped ${nameOf(p)}. You are ${sideName(me)}!`), 'ok'); }
        draw(); if (!finishCheck()) aiTurn();
        return;
      }
      if (p && p.up && p.side === me) { sel = i; draw(); ctx.msg(movesOf(i).length ? T('選一個亮起來的格子', 'Pick a highlighted square') : T('這顆現在不能走', "This piece can't move now")); return; }
      draw();
    };
    ctx.ask(T('翻棋子或走一步；大吃小，兵可以吃帥，炮要隔一顆才能吃', 'Flip or move one step. Bigger beats smaller; soldiers beat the general; cannons jump to capture'));
    ctx.msg(T(`${ctx.n.name}：你先翻一顆！`, `${ctx.n.name}: You flip first!`));
    draw();
  },
};

/* ---- 熱縮片（小米老師，月亮班）：選一張圖案，用顏色把每一塊塗滿，放進烤箱縮小變成吊飾 ---- */
const SHRINK_TPL = (() => {
  const P = (f) => { const p = new Path2D(); f(p); return p; };
  const star = (cx, cy, R1, R2) => P((p) => { for (let i = 0; i < 10; i++) { const r = i % 2 ? R2 : R1, a = -Math.PI / 2 + i * Math.PI / 5; p[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); } p.closePath(); });
  return [
    { n: ['星星', 'Star'], e: '⭐', regions: [star(100, 105, 85, 36), P((p) => p.arc(100, 105, 22, 0, 7))] },
    { n: ['愛心', 'Heart'], e: '❤️', regions: [
      P((p) => { p.moveTo(100, 60); p.bezierCurveTo(85, 25, 25, 30, 30, 85); p.bezierCurveTo(35, 125, 80, 150, 100, 175); p.closePath(); }),
      P((p) => { p.moveTo(100, 60); p.bezierCurveTo(115, 25, 175, 30, 170, 85); p.bezierCurveTo(165, 125, 120, 150, 100, 175); p.closePath(); }) ] },
    { n: ['小貓', 'Kitty'], e: '🐱', regions: [
      P((p) => { p.moveTo(42, 70); p.lineTo(55, 18); p.lineTo(85, 52); p.closePath(); }), P((p) => { p.moveTo(158, 70); p.lineTo(145, 18); p.lineTo(115, 52); p.closePath(); }),
      P((p) => p.ellipse(100, 108, 70, 62, 0, 0, 7)), P((p) => { p.moveTo(92, 112); p.lineTo(108, 112); p.lineTo(100, 122); p.closePath(); }) ] },
    { n: ['小魚', 'Fish'], e: '🐟', regions: [
      P((p) => { p.moveTo(150, 100); p.lineTo(190, 65); p.lineTo(190, 135); p.closePath(); }), P((p) => p.ellipse(92, 100, 70, 45, 0, 0, 7)), P((p) => p.arc(62, 92, 9, 0, 7)) ] },
  ];
})();
const SHRINK_COLS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#f48fb1', '#6d4c41'];
const KG_SHRINK = {
  key: 'campus-kg-shrink-count', title: ['🔥 熱縮片', '🔥 Shrink Art'], label: ['🔥 做熱縮片中…', '🔥 Making shrink art…'],
  bye: (n) => T(`🔥 下次再來找${n.name}做熱縮片！`, `🔥 Come back to make shrink art with ${n.name}!`),
  start(ctx) {
    let tpl = null, fills = [], color = SHRINK_COLS[0], bake = -1;
    const cv = kgCanvas(ctx, 200, 200), c = cv.getContext('2d');
    const paint = (k = 1, curl = 0) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = bake >= 0 ? `rgba(255,${160 + 60 * k | 0},90,1)` : '#fbfbf8'; c.fillRect(0, 0, 200, 200);
      if (!tpl) return;
      c.setTransform(k, 0, 0, k * (1 - curl), 100 * (1 - k), 100 * (1 - k * (1 - curl)));
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(100, 22, 14, 0, 7); c.fill();       // 打洞的地方
      tpl.regions.forEach((r, i) => { c.fillStyle = fills[i] || 'rgba(255,255,255,.6)'; c.fill(r); c.lineWidth = 3 / Math.max(k, 0.5); c.strokeStyle = '#333'; c.stroke(r); });
      c.strokeStyle = '#999'; c.lineWidth = 2; c.beginPath(); c.arc(100, 22, 6, 0, 7); c.stroke();
    };
    const palette = () => ctx.buttons([
      ...SHRINK_COLS.map((col) => ({ html: `<span class="dot" style="background:${col}"></span>`, cls: col === color ? 'on' : '', on: () => { color = col; palette(); } })),
      { html: T('🔥 烤', '🔥 Bake'), cls: 'wide', on: startBake },
    ]);
    const startBake = () => {
      if (fills.filter(Boolean).length < tpl.regions.length) return ctx.msg(T('還有地方沒塗到喔，每一塊都塗上顏色！', 'Some parts are still blank. Color every part!'), 'no');
      ctx.buttons([]); bake = 0; ctx.ask(T('🔥 放進烤箱…看它慢慢縮小、變厚！', '🔥 Into the oven… watch it shrink and get thicker!')); ctx.msg('');
    };
    cv.onclick = (e) => {
      if (!tpl || bake >= 0) return;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 200 / r.width, y = (e.clientY - r.top) * 200 / r.height;
      for (let i = tpl.regions.length - 1; i >= 0; i--) if (c.isPointInPath(tpl.regions[i], x, y)) { fills[i] = color; paint(); return; }
    };
    ctx.tick = (dt) => {
      if (bake < 0) return;
      bake += dt;
      const t = Math.min(1, bake / 2.4), k = 1 - 0.55 * t, curl = Math.sin(t * Math.PI) * 0.35;   // 先捲起來再攤平
      paint(k, curl);
      if (t >= 1 && bake < 100) {
        bake = 100; ctx.face('happy', 2);
        c.setTransform(1, 0, 0, 1, 0, 0); c.strokeStyle = '#b0b4b8'; c.lineWidth = 3;               // 鑰匙圈
        c.beginPath(); c.arc(100, 22, 13, 0, 7); c.stroke(); c.beginPath(); c.moveTo(100, 9); c.lineTo(100, 0); c.stroke();
        ctx.ask(T(`${tpl.e} ${tpl.n[0]}吊飾完成了！變得小小的、硬硬的`, `${tpl.e} Your ${tpl.n[1].toLowerCase()} charm is done! Small and hard now`));
        ctx.msg(T('剛烤好很燙，要等它涼了再摸喔！', "It's hot from the oven. Wait until it cools down!"), 'ok');
        ctx.later(() => ctx.end(ctx.best + 1, (b) => `${T(`🔥 做好${tpl.n[0]}熱縮片吊飾！（已經做了 ${b} 個）`, `🔥 ${tpl.n[1]} charm done! (${b} made)`)}<br>${ctx.n.name}：好漂亮！可以掛在書包上喔～`), 2200);
      }
    };
    ctx.ask(T('選一張圖案', 'Pick a design'));
    ctx.msg(T('慢慢塗，不要塗出線外喔～', 'Color slowly and stay inside the lines~'));
    paint();
    ctx.buttons(SHRINK_TPL.map((t) => ({ html: `${t.e}<small>${T(...t.n)}</small>`, on: () => {
      tpl = t; fills = []; paint(); palette();
      ctx.ask(T(`先選顏色，再點${t.n[0]}的每一塊塗上去，塗滿再按「烤」`, `Pick a color, then tap each part of the ${t.n[1].toLowerCase()}. Bake when it's all colored`));
    } })));
  },
};

/* ---- 昆蟲放大鏡（禎禎老師，太陽班）：草叢裡藏著 5 隻小昆蟲（小小的、被草擋住、會動），
   用滑鼠／手指拖曳放大鏡（鍵盤用方向鍵），放大鏡裡會放大看清楚；在放大鏡裡點昆蟲（或按 F）就解鎖牠的生態小檔案 ---- */
const BUGS = [
  { e: '🐞', n: ['瓢蟲', 'Ladybug'], f: ['背上有圓圓的點點，會吃蚜蟲，是農夫的好朋友。', 'Spots on its back! It eats aphids and helps farmers.'] },
  { e: '🦋', n: ['蝴蝶', 'Butterfly'], f: ['用長長捲捲的嘴巴吸花蜜，翅膀上有好多小鱗片。', 'It sips nectar with a long curly mouth. Its wings are covered in tiny scales.'] },
  { e: '🐜', n: ['螞蟻', 'Ant'], f: ['力氣好大，可以搬比自己重很多的東西，喜歡大家住在一起。', 'Super strong! It carries things much heavier than itself and lives in a big family.'] },
  { e: '🐝', n: ['蜜蜂', 'Bee'], f: ['幫花朵傳花粉，還會做甜甜的蜂蜜。', 'It carries pollen between flowers and makes sweet honey.'] },
  { e: '🦗', n: ['蟋蟀', 'Cricket'], f: ['用翅膀摩擦發出「唧唧」的聲音，後腳很會跳。', 'It rubs its wings to chirp, and its back legs are great jumpers.'] },
  { e: '🐛', n: ['毛毛蟲', 'Caterpillar'], f: ['吃好多好多葉子，長大以後會變成蝴蝶或蛾。', 'It eats lots of leaves and grows up into a butterfly or moth.'] },
  { e: '🪲', n: ['甲蟲', 'Beetle'], f: ['身體有一層硬硬的殼，像穿了盔甲一樣。', 'It has a hard shell, like wearing armor.'] },
];
const KG_BUGS = {
  key: 'campus-kg-bugs-count', title: ['🔍 昆蟲放大鏡', '🔍 Bug Magnifier'], label: ['🔍 找昆蟲中…', '🔍 Looking for bugs…'],
  bye: (n) => T(`🔍 下次再來找${n.name}找昆蟲！`, `🔍 Come back to look for bugs with ${n.name}!`),
  start(ctx) {
    const W = 300, H = 220, LR = 44, Z = 2.6;                              // 放大鏡半徑、放大倍數
    const cv = kgCanvas(ctx, W, H), c = cv.getContext('2d');
    cv.style.touchAction = 'none'; cv.style.cursor = 'none';
    let seed = Math.random() * 1e6 | 0;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // 草叢分兩層：後面（底色＋草）、前面（擋在昆蟲前面的草葉）
    const layer = (front) => {
      const L = document.createElement('canvas'); L.width = W; L.height = H; const g = L.getContext('2d');
      if (!front) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fd27a'); gr.addColorStop(1, '#4f8f3a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      for (let i = 0; i < (front ? 150 : 110); i++) {
        const x = rnd() * W, y = H * (0.15 + rnd() * 0.95), h = 18 + rnd() * 40, lean = (rnd() - 0.5) * 18;
        g.strokeStyle = ['#2f6b2a', '#3e8a33', '#5aa83f', '#6fbf4a'][i % 4]; g.lineWidth = 2 + rnd() * 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); g.stroke();
      }
      if (!front) for (let i = 0; i < 10; i++) { g.fillStyle = ['#fff6a8', '#ffffff', '#f7b0d0'][i % 3]; g.beginPath(); g.arc(rnd() * W, rnd() * H, 2.5, 0, 7); g.fill(); }   // 小花
      return L;
    };
    const back = layer(false), front = layer(true);
    const bugs = kgShuffle(BUGS.slice()).slice(0, 5).map((b, k) => ({ ...b, x: 30 + rnd() * (W - 60), y: 40 + rnd() * (H - 70), ph: rnd() * 6, found: false, k }));
    const lens = { x: W / 2, y: H / 2 };
    let t = 0, found = 0, done = false;
    const bugPos = (b) => [b.x + Math.sin(t * 1.3 + b.ph) * 4, b.y + Math.cos(t * 0.9 + b.ph) * 2];   // 慢慢動來動去
    const scene = (sz, frontAlpha) => {
      c.drawImage(back, 0, 0);
      c.font = `${sz}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const b of bugs) { const [x, y] = bugPos(b); c.globalAlpha = b.found ? 1 : 0.9; c.fillText(b.e, x, y); if (b.found) { c.strokeStyle = '#ffd400'; c.lineWidth = 2 / (sz / 12); c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke(); } }
      c.globalAlpha = frontAlpha; c.drawImage(front, 0, 0); c.globalAlpha = 1;
    };
    const draw = () => {
      scene(12, 1);
      // 放大鏡：圓形裡面放大，草葉變淡、昆蟲看得清楚
      c.save(); c.beginPath(); c.arc(lens.x, lens.y, LR, 0, 7); c.clip();
      c.translate(lens.x, lens.y); c.scale(Z, Z); c.translate(-lens.x, -lens.y);
      scene(12, 0.18); c.restore();
      c.strokeStyle = '#6b4a2a'; c.lineWidth = 6; c.beginPath(); c.arc(lens.x, lens.y, LR, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(lens.x, lens.y, LR - 6, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
      c.strokeStyle = '#6b4a2a'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(lens.x + LR * 0.72, lens.y + LR * 0.72); c.lineTo(lens.x + LR * 1.25, lens.y + LR * 1.25); c.stroke();
    };
    // 放大鏡裡看到的昆蟲（點的位置換算回草叢座標）
    const bugAt = (px, py) => {
      if (Math.hypot(px - lens.x, py - lens.y) > LR) return null;
      const sx = lens.x + (px - lens.x) / Z, sy = lens.y + (py - lens.y) / Z;
      return bugs.find((b) => !b.found && Math.hypot(bugPos(b)[0] - sx, bugPos(b)[1] - sy) < 9) || null;
    };
    const inLens = () => bugs.find((b) => !b.found && Math.hypot(bugPos(b)[0] - lens.x, bugPos(b)[1] - lens.y) < LR / Z) || null;
    const catchBug = (b) => {
      if (!b || done) return;
      b.found = true; found++; ctx.face('happy', 1.2);
      ctx.prog(T(`找到 ${found} / 5 隻`, `${found} / 5 found`));
      ctx.ask(`${b.e} ${T(...b.n)}`);
      ctx.msg(`📒 ${T(...b.f)}`, 'ok');
      if (found >= 5) { done = true; ctx.later(() => ctx.end(ctx.best + 1, (best) => `${T(`🔍 5 隻昆蟲都找到了！（已經探險 ${best} 次）`, `🔍 Found all 5 bugs! (${best} explorations)`)}<br>${ctx.n.name}：你是小小昆蟲博士！昆蟲都有 6 隻腳喔～`), 3200); }
    };
    const toCanvas = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    let dragging = false, downAt = null;
    cv.onpointerdown = (e) => { dragging = true; downAt = toCanvas(e); cv.setPointerCapture?.(e.pointerId); };
    cv.onpointermove = (e) => { if (!dragging && e.pointerType !== 'mouse') return; [lens.x, lens.y] = toCanvas(e); };
    cv.onpointerup = (e) => {
      dragging = false; const p = toCanvas(e);
      if (downAt && Math.hypot(p[0] - downAt[0], p[1] - downAt[1]) < 6) catchBug(bugAt(...p) || inLens());   // 點一下（沒有拖）＝抓這隻
      downAt = null;
    };
    const keyMove = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    ctx.onKey = (e) => {
      const m = keyMove[e.code]; if (m) { lens.x = Math.max(0, Math.min(W, lens.x + m[0] * 12)); lens.y = Math.max(0, Math.min(H, lens.y + m[1] * 12)); return true; }
      if (e.code === 'KeyF' || e.code === 'Space') { catchBug(inLens()); return true; }
      return false;
    };
    ctx.tick = (dt) => { t += dt; draw(); };
    ctx.prog(T('找到 0 / 5 隻', '0 / 5 found'));
    ctx.ask(T('草叢裡有東西在動…拿放大鏡找找看！', 'Something is moving in the grass… use the magnifier!'));
    ctx.msg(T('拖曳放大鏡（或按方向鍵），看到昆蟲就點牠（或按 F）', 'Drag the magnifier (or use arrow keys). Tap a bug when you see it (or press F)'));
    draw();
  },
};

/* ---- 影子配對（球球老師，彩虹班）：看黑黑的影子，猜是哪一個；一回 5 題 ---- */
const SHADOW_ITEMS = ['🐘', '🦒', '🐇', '🐢', '🐟', '🦋', '🐓', '🐈', '🦆', '🐌', '🚲', '✈️', '🚗', '🎸', '☂️', '🍎', '🍌', '🍐', '🏠', '🌳', '⭐', '🔑', '✂️', '⚽', '🎈', '🍦', '🧸', '🦕'];
function shadowImage(emo) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 120;
  const c = cv.getContext('2d');
  c.font = '92px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(emo, 60, 66);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = '#1d1d24'; c.fillRect(0, 0, 120, 120);   // 只留形狀，塗成黑影
  return cv.toDataURL();
}
const KG_SHADOW = {
  key: 'campus-kg-shadow-best', title: ['🔦 影子配對', '🔦 Shadow Match'], label: ['🔦 影子配對中…', '🔦 Matching shadows…'],
  bye: (n) => T(`🔦 下次再來找${n.name}猜影子！`, `🔦 Come back to match shadows with ${n.name}!`),
  start(ctx) {
    const qs = kgShuffle(SHADOW_ITEMS.slice()).slice(0, 5);
    let i = 0, right = 0, tries = 0;
    const ask = () => {
      tries = 0;
      const ans = qs[i], opts = kgShuffle([ans, ...kgShuffle(SHADOW_ITEMS.filter((e) => e !== ans)).slice(0, 2)]);
      ctx.stage.innerHTML = `<img class="shadow" alt="" src="${shadowImage(ans)}">`;
      ctx.prog(T(`第 ${i + 1} / 5 題`, `${i + 1} / 5`));
      ctx.ask(T('這是誰的影子？', 'Whose shadow is this?'));
      ctx.msg(T('看看形狀，耳朵、尾巴、輪子在哪裡？', 'Look at the shape. Where are the ears, tail or wheels?'));
      ctx.buttons(opts.map((e, j) => ({ html: `${e}<small>${j + 1}</small>`, on: (el) => {
        tries++;
        if (e !== ans) { el.disabled = true; el.className = 'wrong'; ctx.face('surprised', 1); return ctx.msg(T('形狀不太一樣喔，再看一次！', "The shape doesn't match. Look again!"), 'no'); }
        el.className = 'right'; ctx.btnEls.forEach((b) => (b.disabled = true));
        if (tries === 1) right++;
        ctx.stage.innerHTML = `<span class="reveal">${ans}</span>`; ctx.face('happy');
        ctx.msg(T('✅ 答對了！影子就是它！', "✅ That's right! It's the shadow's owner!"), 'ok');
        ctx.later(() => (++i < 5 ? ask() : ctx.end(right, (b) => `${T(`🔦 一次就猜對 ${right} / 5 題（最好紀錄 ${b} 題）`, `🔦 ${right} / 5 right on the first try (best ${b})`)}<br>${ctx.n.name}：你的眼睛好厲害！`)), 1300);
      } })));
    };
    ask();
  },
};


/* ---- 白雲班（2 歲專班）的兩個小遊戲：題目很短、按鈕大大的、選錯也沒關係，一回 5 題 ---- */
// 老師唸出來（有中文語音才唸）
function kgSay(text) {
  try {
    if (!window.speechSynthesis) return;
    const v = speechSynthesis.getVoices().find((x) => /^zh/i.test(x.lang));
    if (!v && speechSynthesis.getVoices().length) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = v?.lang || 'zh-TW'; if (v) u.voice = v; u.rate = 0.85; u.pitch = 1.2;
    speechSynthesis.speak(u);
  } catch { /* 不支援就算了 */ }
}
// 共用：一題一個大圖示＋2～3 個大按鈕，選錯可以再選
function toddlerQuiz(ctx, qs, { ask, say, opt, ok, end }) {
  let i = 0, right = 0, tries = 0;
  const next = () => {
    tries = 0;
    const q = qs[i];
    ctx.prog(T(`第 ${i + 1} / ${qs.length} 題`, `${i + 1} / ${qs.length}`));
    ctx.stage.innerHTML = `<span class="big">${q.show}</span>`;
    ctx.ask(ask(q)); ctx.msg('');
    kgSay(say(q)); ctx.stage.onclick = () => kgSay(say(q));                // 點圖示再聽一次
    ctx.buttons(q.opts.map((o, j) => ({ html: `${opt(o)}<small>${j + 1}</small>`, cls: 'huge', on: (el) => {
      tries++;
      if (o !== q.ans) { el.disabled = true; el.className = 'huge wrong'; ctx.face('surprised', 1); ctx.msg(T('再找找看～', 'Try again~'), 'no'); return; }
      el.className = 'huge right'; ctx.btnEls.forEach((b) => (b.disabled = true));
      if (tries === 1) right++;
      ctx.face('happy'); ctx.msg(ok(q), 'ok'); kgSay(T('好棒！', 'Great!'));
      ctx.later(() => (++i < qs.length ? next() : ctx.end(right, end(right))), 1500);
    } })));
  };
  next();
}

/* ---- 是誰在叫？（Anya 老師，白雲班）：老師學動物叫，選出是哪一隻 ---- */
const TODDLER_ANIMALS = [['🐶', '狗狗', '汪汪汪', 'Woof woof'], ['🐱', '貓咪', '喵喵喵', 'Meow meow'], ['🐮', '牛牛', '哞～哞～', 'Moo'], ['🐷', '豬豬', '齁齁齁', 'Oink oink'],
  ['🐔', '公雞', '咕咕咕～', 'Cock-a-doodle-doo'], ['🦆', '鴨鴨', '呱呱呱', 'Quack quack'], ['🐑', '羊咩咩', '咩～咩～', 'Baa'], ['🐸', '青蛙', '呱呱～呱呱～', 'Ribbit']];
const KG_ANIMALCALL = {
  key: 'campus-kg-animalcall-best', title: ['🐶 是誰在叫？', '🐶 Who Says That?'], label: ['🐶 聽動物叫聲…', '🐶 Animal sounds…'],
  bye: (n) => T(`🐶 下次再來找${n.name}聽動物叫！`, `🐶 Come back for animal sounds with ${n.name}!`),
  start(ctx) {
    // 青蛙和鴨鴨都是「呱呱」，不要同一題出現
    const qs = kgShuffle(TODDLER_ANIMALS.slice()).slice(0, 5).map((a, k) => {
      const others = kgShuffle(TODDLER_ANIMALS.filter((b) => b !== a && !(a[2].startsWith('呱') && b[2].startsWith('呱')))).slice(0, k < 2 ? 1 : 2);
      return { ans: a, opts: kgShuffle([a, ...others]), show: '🔊' };
    });
    toddlerQuiz(ctx, qs, {
      ask: (q) => T(`「${q.ans[2]}」是誰在叫？`, `"${q.ans[3]}" Who says that?`),
      say: (q) => q.ans[2],
      opt: (o) => o[0],
      ok: (q) => T(`對！${q.ans[1]}${q.ans[2]}～`, `Yes! The ${q.ans[1]} says ${q.ans[3]}~`),
      end: (r) => (b) => `${T(`🐶 聽出 ${r} / 5 隻動物（最好紀錄 ${b} 隻）`, `🐶 ${r} / 5 animals (best ${b})`)}<br>${ctx.n.name}：哇～耳朵好棒！我們一起拍拍手！`,
    });
  },
};

/* ---- 玩具回家囉（欣欣老師，白雲班）：把玩具放進一樣顏色的籃子 ---- */
const TODDLER_COLORS = [['紅色', 'red', '#e53935', ['🍎', '🚒', '🎈']], ['黃色', 'yellow', '#fdd835', ['🍌', '⭐', '🐥']], ['藍色', 'blue', '#1e88e5', ['🧢', '🐳', '🫐']], ['綠色', 'green', '#43a047', ['🐸', '🦖', '🥦']]];
const KG_TOYHOME = {
  key: 'campus-kg-toyhome-best', title: ['🧺 玩具回家囉', '🧺 Toys Go Home'], label: ['🧺 收玩具中…', '🧺 Tidying up…'],
  bye: (n) => T(`🧺 下次再來找${n.name}收玩具！`, `🧺 Come back to tidy toys with ${n.name}!`),
  start(ctx) {
    const qs = Array.from({ length: 5 }, (_, k) => {
      const ans = TODDLER_COLORS[Math.random() * TODDLER_COLORS.length | 0];
      const others = kgShuffle(TODDLER_COLORS.filter((c) => c !== ans)).slice(0, k < 2 ? 1 : 2);
      return { ans, opts: kgShuffle([ans, ...others]), show: ans[3][Math.random() * 3 | 0] };
    });
    toddlerQuiz(ctx, qs, {
      ask: (q) => T(`${q.show} 要回哪一個籃子？`, `${q.show} Which basket does it go in?`),
      say: (q) => T(`${q.ans[0]}的玩具，要回家囉`, 'Time for the toy to go home'),
      opt: (o) => `<span class="basket" style="background:${o[2]}"></span>`,
      ok: (q) => T(`放進${q.ans[0]}的籃子，玩具回家了！`, `Into the ${q.ans[1]} basket. The toy is home!`),
      end: (r) => (b) => `${T(`🧺 送 ${r} / 5 個玩具回家（最好紀錄 ${b} 個）`, `🧺 ${r} / 5 toys home (best ${b})`)}<br>${ctx.n.name}：玩具都回家了，好乾淨喔！謝謝你～`,
    });
  },
};

/* ---- 食農教育（林老師，學務處衛生組長）：一起瞬間移動到 2 樓小田園，回答小黃瓜、番茄、小白菜…怎麼種，一回 5 題；玩完一起回學務處 ---- */
// a[0] 是正確答案
const FARM_ITEMS = [
  { e: '🥒', q: '小黃瓜長大會長出藤蔓，種的時候要準備什麼？', a: ['搭支架或網子讓它往上爬', '用塑膠袋把它包起來', '把長出來的藤全部剪掉'], why: '小黃瓜會用捲鬚抓住支架往上爬，果實才不會躺在土上爛掉。' },
  { e: '🥒', q: '小黃瓜什麼時候採收最好吃？', a: ['長到大約手掌長、還嫩嫩的時候', '放到變黃、變很大以後', '剛開花的時候'], why: '小黃瓜要趁嫩採收；放太久會變黃、變老，種子也會變硬。' },
  { e: '🍅', q: '番茄長高、結了很多果實，莖快要倒下來了，怎麼辦？', a: ['插支柱，把莖輕輕綁在柱子上', '把果實全部摘掉', '把莖壓到土裡面'], why: '番茄結果實會越來越重，綁在支柱上才站得穩。' },
  { e: '🍅', q: '番茄喜歡種在什麼樣的地方？', a: ['陽光充足、排水好的地方', '陰暗潮濕的角落', '一直泡在水裡'], why: '番茄很喜歡曬太陽；土太濕，根會爛掉。' },
  { e: '🍅', q: '番茄的葉子和莖中間長出小小的「側芽」，常常會怎麼做？', a: ['把側芽摘掉，讓養分留給果實', '在側芽上撒鹽', '用膠帶把側芽包起來'], why: '摘掉太多的側芽，養分就能集中，番茄會長得比較大顆。' },
  { e: '🥬', q: '小白菜要怎麼播種？', a: ['把種子撒在土上，再蓋一層薄薄的土', '把種子埋到很深很深的地方', '把種子泡在水裡就好'], why: '小白菜的種子很小，蓋太厚的土，芽會鑽不出來。' },
  { e: '🥬', q: '小白菜從播種到可以採收，大概要多久？', a: ['大約一個月', '大約一年', '三天'], why: '小白菜長得很快，大約一個月左右就可以採收。' },
  { e: '🥬', q: '小白菜的葉子上有很多小洞洞，可能是什麼原因？', a: ['有菜蟲在吃葉子', '被太陽曬出洞來', '被雨滴打出洞來'], why: '菜蟲最喜歡吃小白菜！可以把蟲抓走，或蓋上防蟲網。' },
  { e: '🌱', q: '小苗長得太擠、太密了，要怎麼辦？', a: ['拔掉一些小苗，留空間給其他的苗', '再多撒一些種子', '全部拔掉重新種'], why: '這叫「疏苗」。每棵菜都有足夠的空間，才會長得又大又好。' },
  { e: '💧', q: '怎麼知道菜園需不需要澆水？', a: ['摸摸看土，乾乾的再澆', '每個小時都澆一次', '等葉子枯掉了再澆'], why: '土乾了再澆水；水澆太多，根反而會爛掉。' },
  { e: '☀️', q: '一天當中，什麼時候澆水比較好？', a: ['早上或傍晚', '中午太陽最大的時候', '半夜'], why: '早上或傍晚比較涼，水不會一下子就被曬乾。' },
  { e: '🧅', q: '青蔥可以怎麼種？', a: ['把帶根的蔥白插進土裡', '把蔥的綠色葉子剪下來種', '把整把蔥曬乾再種'], why: '留下帶根的蔥白種進土裡，就會再長出新的蔥。' },
  { e: '🥕', q: '胡蘿蔔要怎麼種比較好？', a: ['種子直接撒在菜園裡，不要移來移去', '把胡蘿蔔切片埋進土裡', '種在很硬、很多石頭的土裡'], why: '胡蘿蔔吃的是根，移植或土裡石頭多，根就會長得歪歪的、分岔。' },
  { e: '🍠', q: '地瓜最常用什麼方法種？', a: ['剪一段地瓜藤，插進土裡', '把地瓜葉曬乾撒在土上', '把地瓜皮埋進土裡'], why: '地瓜藤插進土裡很快就會長根，這叫「扦插」。' },
  { e: '🪱', q: '在菜園的土裡看到蚯蚓，代表什麼？', a: ['土壤很健康、很鬆軟', '菜快要死掉了', '要趕快噴農藥'], why: '蚯蚓會鬆土、幫忙分解落葉，是菜園的好朋友。' },
  { e: '🍂', q: '落葉和果皮可以拿來做什麼，讓菜長得更好？', a: ['做成堆肥（有機肥料）', '燒掉', '丟進水溝'], why: '落葉、果皮慢慢分解，就變成有營養的堆肥。' },
];
const KG_FARM = {
  key: 'campus-farm-best', title: ['🌱 食農教育：小田園種菜', '🌱 Little Farm'], label: ['🌱 在小田園種菜…', '🌱 Farming…'],
  bye: (n) => T(`🌱 下次再來找${n.name}種菜！`, `🌱 Come back to farm with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, farm = rooms.find((x) => x.name === '露臺（小田園）');
    // 瞬間移動到 2 樓小田園：老師站在第一、二排菜圃中間的走道，學生在東邊 1.9 公尺面向老師（都不要站在菜圃上）
    const home = { f: n.f, x: n.g.position.x, z: n.g.position.z, yaw: n.yaw };
    // 回來時：站在老師正前方 1.6 公尺、面向老師（學務處走道很窄，不要用遊戲開始時站的位置）
    home.px = home.x - Math.sin(home.yaw) * 1.6; home.pz = home.z - Math.cos(home.yaw) * 1.6; home.pyaw = home.yaw + Math.PI;
    const tx = farm.m.x1 + 2.55, tz = farm.m.z1 + 3.15;
    placeNPC(n, farm.f, tx, tz, -Math.PI / 2); n.label.visible = false;
    placeAt(farm.f, tx + 1.9, tz, Math.PI / 2); avatar.rotation.y = Math.PI / 2; player.yaw = Math.PI / 2 + 0.42; player.pitch = -0.15;
    ctx.onStop = () => {
      placeNPC(n, home.f, home.x, home.z, home.yaw); n.label.visible = true;
      placeAt(home.f, home.px, home.pz, home.pyaw);
    };
    const qs = kgShuffle(FARM_ITEMS.slice()).slice(0, 5);
    let i = 0, right = 0;
    const next = () => {
      const q = qs[i];
      ctx.prog(T(`第 ${i + 1} / ${qs.length} 題`, `${i + 1} / ${qs.length}`));
      ctx.stage.innerHTML = `<span class="big">${q.e}</span>`;
      ctx.ask(q.q); ctx.msg(i ? '' : T('我們到 2 樓小田園了！一起來學怎麼種菜～', 'We are at the Little Farm!'));
      const opts = kgShuffle(q.a.map((t, k) => ({ t, ok: !k })));
      ctx.buttons(opts.map((o, j) => ({ html: `${o.t}<small>${j + 1}</small>`, cls: 'opt', on: (el) => {
        ctx.btnEls.forEach((b) => (b.disabled = true));
        ctx.btnEls[opts.findIndex((x) => x.ok)].className = 'opt right';
        if (o.ok) { right++; ctx.face('happy'); ctx.msg(`⭕ ${T('答對了！', 'Correct! ')}${q.why}`, 'ok'); }
        else { el.className = 'opt wrong'; ctx.face('surprised', 1); ctx.msg(`❌ ${q.why}`, 'no'); }
        ctx.later(() => (++i < qs.length ? next() : ctx.end(right, (b) => `${T(`🌱 答對 ${right} / 5 題（最好紀錄 ${b} 題）`, `🌱 ${right} / 5 correct (best ${b})`)}<br>${n.name}：${right >= 4 ? '你是小田園的小農夫！' : '種菜要有耐心，我們下次再來照顧它們！'}回學務處囉～`)), 2800);
      } })));
    };
    next();
  },
};

/* ---- 英文小文法 in・on・at（Jack 老師，3F 英語教室二）：空間和時間的介系詞，一回 5 題，三個選項固定 in／on／at ---- */
// a：正確答案（'in' | 'on' | 'at'）
const PREP_ITEMS = [
  { e: '📦🐱', q: 'The cat is ___ the box.', zh: '貓咪在箱子裡面。', a: 'in', why: '在「裡面」用 in。' },
  { e: '📕', q: 'The book is ___ the desk.', zh: '書在桌子上面。', a: 'on', why: '放在「上面」、貼著表面用 on。' },
  { e: '🚏', q: 'I wait ___ the bus stop.', zh: '我在公車站等車。', a: 'at', why: '一個「點」、一個地點用 at。' },
  { e: '🖼️', q: 'The picture is ___ the wall.', zh: '照片掛在牆上。', a: 'on', why: '貼在表面上（牆壁）用 on。' },
  { e: '🏙️', q: 'I live ___ Taipei.', zh: '我住在台北。', a: 'in', why: '城市、國家這種大範圍用 in。' },
  { e: '🏫', q: 'We study ___ school.', zh: '我們在學校讀書。', a: 'at', why: '在學校上課這種「地點」用 at school。' },
  { e: '🐟', q: 'The fish are ___ the water.', zh: '魚在水裡面。', a: 'in', why: '在「裡面」用 in。' },
  { e: '🚪', q: 'Someone is ___ the door.', zh: '有人在門口。', a: 'at', why: '在某個「點」（門口）用 at。' },
  { e: '🛋️', q: 'The dog is ___ the sofa.', zh: '狗狗在沙發上。', a: 'on', why: '在「上面」用 on。' },
  { e: '⏰', q: 'School starts ___ 8 o\'clock.', zh: '學校 8 點上課。', a: 'at', why: '幾點幾分（時刻）用 at。' },
  { e: '📅', q: 'I go swimming ___ Monday.', zh: '我星期一去游泳。', a: 'on', why: '星期幾用 on。' },
  { e: '🎂', q: 'My birthday is ___ May.', zh: '我的生日在五月。', a: 'in', why: '月份用 in。' },
  { e: '🌅', q: 'I get up early ___ the morning.', zh: '我早上很早起床。', a: 'in', why: '早上、下午、晚上用 in the morning / afternoon / evening。' },
  { e: '🌙', q: 'I see the stars ___ night.', zh: '我晚上看星星。', a: 'at', why: '晚上要說 at night（固定用法）。' },
  { e: '🎄', q: 'We open gifts ___ Christmas Day.', zh: '我們在聖誕節當天拆禮物。', a: 'on', why: '某一天（特定日子）用 on。' },
  { e: '❄️', q: 'It snows ___ winter.', zh: '冬天會下雪。', a: 'in', why: '季節用 in。' },
  { e: '🍱', q: 'We eat lunch ___ noon.', zh: '我們中午吃午餐。', a: 'at', why: '中午 at noon，跟時刻一樣用 at。' },
  { e: '🗓️', q: 'Teachers\' Day is ___ September 28th.', zh: '教師節在 9 月 28 日。', a: 'on', why: '幾月幾日（日期）用 on。' },
  { e: '🕰️', q: 'My grandpa was born ___ 1960.', zh: '我爺爺 1960 年出生。', a: 'in', why: '年份用 in。' },
  { e: '🎒', q: 'My pencil is ___ my bag.', zh: '我的鉛筆在書包裡。', a: 'in', why: '在「裡面」用 in。' },
];
const KG_PREP = {
  key: 'campus-prep-best', title: ['📍 英文小文法 in・on・at', '📍 in / on / at'], label: ['📍 in・on・at…', '📍 in / on / at…'],
  bye: (n) => T(`📍 下次再來找${n.name}練英文！`, `📍 Come back to practice with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, qs = kgShuffle(PREP_ITEMS.slice()).slice(0, 5);
    let i = 0, right = 0;
    const next = () => {
      const q = qs[i];
      ctx.prog(T(`第 ${i + 1} / ${qs.length} 題`, `${i + 1} / ${qs.length}`));
      ctx.stage.innerHTML = `<span class="big">${q.e}</span>`;
      ctx.ask(`${q.q}<br><small>${q.zh}</small>`);
      ctx.msg(i ? '' : T('Eyes on me! 小提示：裡面、大範圍用 in，上面、星期幾和日期用 on，一個點、幾點鐘用 at。', 'Eyes on me! in / on / at?'));
      const opts = ['in', 'on', 'at'];
      ctx.buttons(opts.map((t, j) => ({ html: `${t}<small>${j + 1}</small>`, cls: 'opt', on: (el) => {
        ctx.btnEls.forEach((b) => (b.disabled = true));
        ctx.btnEls[opts.indexOf(q.a)].className = 'opt right';
        const full = q.q.replace('___', `<b>${q.a}</b>`);
        if (t === q.a) { right++; ctx.face('happy'); ctx.msg(`⭕ ${T('Good job! ', 'Good job! ')}${full}　${q.why}`, 'ok'); }
        else { el.className = 'opt wrong'; ctx.face('surprised', 1); ctx.msg(`❌ ${full}　${q.why}`, 'no'); }
        ctx.later(() => (++i < qs.length ? next() : ctx.end(right, (b) => `${T(`📍 答對 ${right} / 5 題（最好紀錄 ${b} 題）`, `📍 ${right} / 5 correct (best ${b})`)}<br>${n.name}：${right >= 4 ? 'Excellent! in、on、at 你都分得很清楚！' : 'Good try! 多練習幾次就會了，Keep going!'}`)), 2800);
      } })));
    };
    next();
  },
};

/* ---- 三選一題庫遊戲（共用）：一回 5 題，答完說明為什麼；items 的 a[0] 是正確答案（按鈕順序會打亂） ---- */
function mcGame({ key, title, label, icon, items, intro, good, keep }) {
  return {
    key, title, label,
    bye: (n) => T(`${icon} 下次再來找${n.name}玩！`, `${icon} Come back and play with ${n.name}!`),
    start(ctx) {
      const n = ctx.n, qs = kgShuffle(items.slice()).slice(0, 5);
      let i = 0, right = 0;
      const next = () => {
        const q = qs[i];
        ctx.prog(T(`第 ${i + 1} / ${qs.length} 題`, `${i + 1} / ${qs.length}`));
        ctx.stage.innerHTML = `<span class="big">${q.e}</span>`;
        ctx.ask(q.q); ctx.msg(i ? '' : intro());
        const opts = kgShuffle(q.a.map((t, k) => ({ t, ok: !k })));
        ctx.buttons(opts.map((o, j) => ({ html: `${o.t}<small>${j + 1}</small>`, cls: 'opt', on: (el) => {
          ctx.btnEls.forEach((b) => (b.disabled = true));
          ctx.btnEls[opts.findIndex((x) => x.ok)].className = 'opt right';
          if (o.ok) { right++; ctx.face('happy'); ctx.msg(`⭕ ${T('答對了！', 'Correct! ')}${q.why}`, 'ok'); }
          else { el.className = 'opt wrong'; ctx.face('surprised', 1); ctx.msg(`❌ ${q.why}`, 'no'); }
          ctx.later(() => (++i < qs.length ? next() : ctx.end(right, (b) => `${T(`${icon} 答對 ${right} / 5 題（最好紀錄 ${b} 題）`, `${icon} ${right} / 5 correct (best ${b})`)}<br>${n.name}：${right >= 4 ? good : keep}`)), 2800);
        } })));
      };
      next();
    },
  };
}

/* ---- 數學單位量詞大考驗（陳老師，六年三班導師） ---- */
const UNITS_ITEMS = [
  { e: '📏', q: '教室的長度大約是 8 ＿＿', a: ['公尺', '公分', '公里'], why: '教室大約 8 公尺長；8 公分只有手指那麼長，8 公里要走很久很久。' },
  { e: '✏️', q: '一枝鉛筆大約長 18 ＿＿', a: ['公分', '公尺', '公里'], why: '鉛筆大約 18 公分長，比一個手掌再長一點。' },
  { e: '🚄', q: '從臺北到高雄，高鐵的路程大約 350 ＿＿', a: ['公里', '公尺', '公分'], why: '很遠的距離用公里；1 公里就是 1000 公尺。' },
  { e: '🏃', q: '操場跑道跑一圈大約 400 ＿＿', a: ['公尺', '公分', '公里'], why: '標準跑道一圈是 400 公尺，跑 2.5 圈就是 1 公里。' },
  { e: '📄', q: '一張 A4 紙的長邊大約 30 ＿＿', a: ['公分', '公尺', '公里'], why: 'A4 紙的長邊大約 30 公分，跟一把 30 公分的直尺差不多長。' },
  { e: '🧃', q: '一瓶礦泉水大約有 600 ＿＿', a: ['毫升', '公升', '公克'], why: '一瓶礦泉水 600 毫升，也就是 0.6 公升。' },
  { e: '🥛', q: '一杯牛奶大約有 240 ＿＿', a: ['毫升', '公升', '公斤'], why: '一杯牛奶 240 毫升；1 公升 ＝ 1000 毫升，大約是四杯多。' },
  { e: '🪣', q: '一桶大桶裝飲用水大約有 19 ＿＿', a: ['公升', '毫升', '公克'], why: '大桶裝的水大約 19 公升，也就是 19000 毫升。' },
  { e: '🍎', q: '一顆蘋果大約重 200 ＿＿', a: ['公克', '公斤', '公噸'], why: '一顆蘋果大約 200 公克；5 顆蘋果才有 1 公斤。' },
  { e: '🥚', q: '一顆雞蛋大約重 60 ＿＿', a: ['公克', '公斤', '公噸'], why: '雞蛋大約 60 公克，一盒 10 顆大約 600 公克。' },
  { e: '🎒', q: '一個書包大約重 3 ＿＿', a: ['公斤', '公克', '公噸'], why: '書包大約 3 公斤；3 公克只有一顆小小的紐扣那麼輕。' },
  { e: '🐘', q: '一頭大象大約重 5 ＿＿', a: ['公噸', '公斤', '公克'], why: '大象很重，大約 5 公噸；1 公噸 ＝ 1000 公斤。' },
  { e: '🚗', q: '一輛小客車大約重 1.5 ＿＿', a: ['公噸', '公斤', '公克'], why: '小客車大約 1.5 公噸，也就是 1500 公斤。' },
  { e: '⏱️', q: '學校一堂課大約 40 ＿＿', a: ['分鐘', '秒', '小時'], why: '一堂課大約 40 分鐘；40 秒太短，40 小時比一天還長。' },
  { e: '🧱', q: '一塊邊長 30 公分的方形磁磚，面積是 900 ＿＿', a: ['平方公分', '平方公尺', '公分'], why: '30 × 30 ＝ 900，面積的單位要用「平方」，所以是 900 平方公分。' },
  { e: '⚽', q: '一個足球場的面積大約 7000 ＿＿', a: ['平方公尺', '公尺', '公升'], why: '足球場約 105 公尺 × 68 公尺，面積大約 7000 平方公尺。' },
  { e: '🧊', q: '邊長 1 公分的小方塊，體積是 1 ＿＿', a: ['立方公分', '平方公分', '公分'], why: '立體的大小（體積）要用「立方」；1 立方公分的水剛好是 1 毫升。' },
  { e: '🛣️', q: '1 公里 ＝ ＿＿ 公尺', a: ['1000', '100', '10'], why: '1 公里 ＝ 1000 公尺。' },
  { e: '📐', q: '1 公尺 ＝ ＿＿ 公分', a: ['100', '10', '1000'], why: '1 公尺 ＝ 100 公分。' },
  { e: '⚖️', q: '1 公斤 ＝ ＿＿ 公克', a: ['1000', '100', '10'], why: '1 公斤 ＝ 1000 公克。' },
  { e: '🥤', q: '1 公升 ＝ ＿＿ 毫升', a: ['1000', '100', '10'], why: '1 公升 ＝ 1000 毫升。' },
  { e: '🚛', q: '1 公噸 ＝ ＿＿ 公斤', a: ['1000', '100', '10000'], why: '1 公噸 ＝ 1000 公斤。' },
  { e: '🌾', q: '1 公頃 ＝ ＿＿ 平方公尺', a: ['10000', '100', '1000'], why: '1 公頃是邊長 100 公尺的正方形，100 × 100 ＝ 10000 平方公尺。' },
  { e: '🏠', q: '「坪」是臺灣常用的面積單位，1 坪大約是 ＿＿ 平方公尺', a: ['3.3', '33', '0.33'], why: '1 坪約 3.3 平方公尺；100 坪就是 330 平方公尺，真的很大，回家像爬山！' },
];
const KG_UNITS = mcGame({
  key: 'campus-units-best', title: ['📏 數學單位量詞大考驗', '📏 Math Units Quiz'], label: ['📏 數學單位大考驗…', '📏 Math Units…'], icon: '📏', items: UNITS_ITEMS,
  intro: () => T('想一想，這個東西大概有多長、多重、多大？先看清楚單位喔！', 'Think: how long, heavy or big is it? Check the unit first!'),
  good: '你的單位觀念很棒，算數學不會被單位騙到！', keep: '試試看，再想一想，單位多看幾次就記住了！',
});

/* ---- 臺灣地理大考驗（姚姚老師，教學組長）：五大山脈、五大地形、三大河流 ---- */
// 臺灣的輪廓（簡化的經緯度折線；沒有臺灣的表情符號，🗾 是日本）
const TAIWAN_SVG = (() => {
  const P = [[121.54, 25.30], [121.75, 25.28], [121.92, 25.13], [122.00, 25.00], [121.92, 24.80], [121.85, 24.60], [121.75, 24.30], [121.62, 24.00], [121.55, 23.70],
    [121.45, 23.30], [121.35, 23.00], [121.20, 22.75], [121.05, 22.55], [120.88, 22.30], [120.85, 22.00], [120.75, 21.90], [120.65, 22.05], [120.60, 22.35], [120.45, 22.55],
    [120.30, 22.62], [120.20, 22.85], [120.10, 23.10], [120.10, 23.35], [120.15, 23.55], [120.18, 23.75], [120.25, 23.95], [120.40, 24.15], [120.55, 24.35], [120.70, 24.55],
    [120.85, 24.78], [121.00, 25.00], [121.25, 25.12], [121.45, 25.25]];
  const pts = P.map(([lo, la]) => `${((lo - 120) * 0.917 * 52 + 8).toFixed(1)},${((25.4 - la) * 52 + 6).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 112 196" height="96" style="vertical-align:middle"><polygon points="${pts}" fill="#58c08a" stroke="#2f7d57" stroke-width="4" stroke-linejoin="round"/></svg>`;
})();
const GEO_ITEMS = [
  { e: '⛰️', q: '臺灣最長的山脈是哪一條？', a: ['中央山脈', '雪山山脈', '海岸山脈'], why: '中央山脈像臺灣的「脊梁」，從北到南縱貫全島，是最長的山脈。' },
  { e: '🏔️', q: '玉山是臺灣的最高峰，它在哪一條山脈？', a: ['玉山山脈', '中央山脈', '阿里山山脈'], why: '玉山主峰海拔約 3952 公尺，位在玉山山脈，是臺灣最高的山峰。' },
  { e: '❄️', q: '雪山是臺灣第二高峰，它在哪一條山脈？', a: ['雪山山脈', '玉山山脈', '海岸山脈'], why: '雪山在雪山山脈，海拔約 3886 公尺，冬天有時會下雪。' },
  { e: '🌊', q: '位在臺灣東部、靠近太平洋的山脈是？', a: ['海岸山脈', '雪山山脈', '阿里山山脈'], why: '海岸山脈在花蓮、臺東的東邊，面對太平洋。' },
  { e: '🌲', q: '有名的阿里山神木、森林鐵路，在哪一條山脈？', a: ['阿里山山脈', '玉山山脈', '雪山山脈'], why: '阿里山位在嘉義，屬於阿里山山脈。' },
  { e: '🧭', q: '下面哪一個「不是」臺灣的五大山脈？', a: ['大屯山脈', '海岸山脈', '中央山脈'], why: '五大山脈是中央山脈、雪山山脈、玉山山脈、阿里山山脈、海岸山脈。大屯山是火山群。' },
  { e: '🔢', q: '臺灣一共有幾大山脈？', a: ['五條', '三條', '七條'], why: '臺灣有五大山脈：中央、雪山、玉山、阿里山、海岸山脈。' },
  { e: '🏞️', q: '下面哪一個「不是」臺灣的五大地形？', a: ['沙漠', '盆地', '臺地'], why: '臺灣五大地形是山地、丘陵、臺地、平原、盆地，沒有沙漠。' },
  { e: '⛺', q: '四周被山圍著、中間比較低的地形，叫做什麼？', a: ['盆地', '平原', '臺地'], why: '像臺北盆地，四周高、中間低，就是盆地。' },
  { e: '🌾', q: '地勢平坦、適合種稻和蓋房子的地形是？', a: ['平原', '山地', '丘陵'], why: '平原地勢平坦，臺灣的城市和稻田大多在平原上。' },
  { e: '🏘️', q: '桃園的林口，頂部平坦、四周比較陡的地形，叫做什麼？', a: ['臺地', '盆地', '平原'], why: '頂部平坦、像一座高高的平台，叫做臺地，林口臺地就是代表。' },
  { e: '🌄', q: '高度比山地矮、坡度比較平緩的地形是？', a: ['丘陵', '平原', '盆地'], why: '丘陵比山地矮、坡度比較緩，像苗栗、新竹一帶就有很多丘陵。' },
  { e: '🧗', q: '海拔高、坡度陡，像中央山脈這樣的地形叫做？', a: ['山地', '臺地', '平原'], why: '海拔高、坡度又陡的地方是山地。' },
  { e: TAIWAN_SVG, q: '宜蘭平原在臺灣的哪個方向？', a: ['東北部', '西南部', '西北部'], why: '宜蘭在臺灣的東北部，那裡有一片三角形的蘭陽平原。' },
  { e: '🌅', q: '花蓮、臺東之間，夾在海岸山脈和中央山脈中間、又長又窄的地方叫什麼？', a: ['花東縱谷', '嘉南平原', '臺北盆地'], why: '花東縱谷在海岸山脈和中央山脈中間，是一條又長又窄的平坦谷地。' },
  { e: '🌊', q: '臺灣最長的河流是？', a: ['濁水溪', '淡水河', '高屏溪'], why: '濁水溪全長約 187 公里，是臺灣最長的河流。' },
  { e: TAIWAN_SVG, q: '臺灣流域面積最大的河流是？', a: ['高屏溪', '濁水溪', '淡水河'], why: '高屏溪流經高雄、屏東，流域面積是臺灣最大的。' },
  { e: '🏙️', q: '流經臺北盆地，出海口在新北淡水的河流是？', a: ['淡水河', '濁水溪', '高屏溪'], why: '淡水河流經臺北、新北，在淡水流入臺灣海峽。' },
  { e: '📍', q: '高屏溪流經哪兩個縣市？', a: ['高雄、屏東', '臺北、新北', '臺中、彰化'], why: '高屏溪的名字就是「高雄」加「屏東」。' },
  { e: '🧭', q: '濁水溪大部分的河水往哪裡流？', a: ['西邊的臺灣海峽', '東邊的太平洋', '北邊的東海'], why: '濁水溪流經南投、彰化、雲林，往西流進臺灣海峽。' },
  { e: '💦', q: '臺灣的河流為什麼大多又短又急？', a: ['山高、地形陡，河水很快從山上流到海邊', '因為臺灣很少下雨', '因為河流被水壩全部攔住'], why: '臺灣山高坡陡，島又很窄，河水從山上很快就流到海邊，所以又短又急。' },
  { e: '🗻', q: '下面哪一個是臺灣的最高峰？', a: ['玉山', '雪山', '阿里山'], why: '玉山主峰海拔約 3952 公尺，是臺灣最高的山。' },
];
const KG_GEO = mcGame({
  key: 'campus-geo-best', title: ['🗺️ 臺灣地理大考驗', '🗺️ Taiwan Geography Quiz'], label: ['🗺️ 臺灣地理大考驗…', '🗺️ Taiwan Geography…'], icon: '🗺️', items: GEO_ITEMS,
  intro: () => T('五大山脈、五大地形、三大河流，你都記得嗎？', 'Five mountain ranges, five landforms, three rivers. Do you remember them?'),
  good: '你對臺灣的山、地形和河流好熟悉，是地理小達人！', keep: '多看看地圖，下次一定更厲害！',
});

/* ================= B1 交通安全教室的三個小遊戲（沒有老師，主人是「溪口巴士」或「體操墊」，所以用 pseudoHost 假裝成一位 NPC） ================= */
const pseudoHost = (name, sp) => ({ name, f: spotFloor(sp), yaw: 0, playing: false, g: { position: { x: sp.x, z: sp.z }, rotation: {}, userData: { setFace() {} } } });

/* ---- 視野死角大考驗：從上往下看一輛巴士，三位小朋友站在不同的地方，選出「司機看不到」的那一位，一回 5 題 ---- */
const BLIND_BLIND = [
  { p: [150, 84], why: '貼著車頭正前面：被車頭和儀表板擋住，司機從座位上看不到！' }, { p: [124, 85], why: '貼著車頭正前面：被車頭和儀表板擋住，司機從座位上看不到！' },
  { p: [174, 84], why: '貼著車頭正前面：被車頭和儀表板擋住，司機從座位上看不到！' },
  { p: [202, 150], why: '右側靠近車身：被 A 柱和車身擋住，轉彎時最危險（這叫內輪差）！' }, { p: [202, 196], why: '右側靠近車身：被 A 柱和車身擋住，轉彎時最危險（這叫內輪差）！' },
  { p: [150, 238], why: '車尾後面：貼著車尾，司機連後照鏡都看不到！' }, { p: [124, 238], why: '車尾後面：貼著車尾，司機連後照鏡都看不到！' },
];
const BLIND_SEEN = [[60, 60], [240, 60], [150, 22], [50, 130], [70, 200], [100, 34], [215, 26], [252, 150], [40, 240], [255, 215], [210, 60]];
const KG_BLIND = {
  key: 'campus-blindquiz-best', title: ['🚌 視野死角大考驗', '🚌 Blind Spot Quiz'], label: ['🚌 視野死角大考驗…', '🚌 Blind Spot Quiz…'], noFace: true,
  bye: (n) => T('🚌 下次再來考考視野死角！', '🚌 Come back for another blind spot quiz!'),
  start(ctx) {
    const W = 300, H = 262, cv = kgCanvas(ctx, W, H), c = cv.getContext('2d');
    let i = 0, right = 0, round = null;
    const draw = (reveal, pick) => {
      c.fillStyle = '#8d9298'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#fff'; for (let y = 6; y < H; y += 34) c.fillRect(W / 2 - 2, y, 4, 18);
      if (reveal) {                                                             // 揭曉：死角（橘）和看得到的範圍（淺綠）
        c.fillStyle = 'rgba(120,220,120,.22)'; c.fillRect(0, 0, W, 66); c.fillRect(0, 66, 100, H - 66); c.fillRect(218, 0, 82, 120);
        c.fillStyle = 'rgba(255,140,0,.55)'; c.fillRect(100, 66, 100, 30); c.fillRect(180, 110, 38, 126); c.fillRect(108, 220, 84, 34);
      }
      c.fillStyle = '#f2c230'; c.fillRect(120, 96, 60, 124); c.strokeStyle = '#222'; c.lineWidth = 3; c.strokeRect(120, 96, 60, 124);   // 巴士（上面是車頭）
      c.fillStyle = '#cfe8f7'; c.fillRect(126, 100, 48, 14); c.fillStyle = '#e6edf1'; for (let k = 0; k < 4; k++) c.fillRect(126, 126 + k * 22, 48, 14);
      c.fillStyle = '#222'; c.beginPath(); c.arc(133, 108, 5, 0, 7); c.fill(); c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('司機', 150, 106 + 12); c.fillText('▲ 車頭', 150, 90);
      round.kids.forEach((k, j) => {
        c.font = '28px sans-serif'; c.textBaseline = 'middle'; c.fillText('🧒', k.p[0], k.p[1]);
        c.fillStyle = reveal && k.blind ? '#e0480a' : '#1d4f91'; c.beginPath(); c.arc(k.p[0] + 16, k.p[1] - 14, 10, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.font = '900 12px sans-serif'; c.fillText('ABC'[j], k.p[0] + 16, k.p[1] - 14);
      });
    };
    const next = () => {
      const bl = BLIND_BLIND[(Math.random() * BLIND_BLIND.length) | 0];
      const seen = kgShuffle(BLIND_SEEN.slice()).filter(([x, y]) => Math.hypot(x - bl.p[0], y - bl.p[1]) > 60).slice(0, 2);
      round = { kids: kgShuffle([{ p: bl.p, blind: true, why: bl.why }, { p: seen[0] }, { p: seen[1] }]) };
      ctx.prog(T(`第 ${i + 1} / 5 題`, `${i + 1} / 5`)); ctx.ask('哪一位小朋友，司機從座位上<b>看不到</b>？'); ctx.msg(i ? '' : '你是司機，仔細看看每個人站的位置！');
      draw(false);
      ctx.buttons(round.kids.map((k, j) => ({ html: `🧒 ${'ABC'[j]}<small>${j + 1}</small>`, on: (el) => {
        ctx.btnEls.forEach((b) => (b.disabled = true));
        const ok = k.blind; draw(true);
        ctx.btnEls[round.kids.findIndex((x) => x.blind)].className = 'right';
        if (ok) { right++; ctx.msg(`⭕ 答對了！${round.kids.find((x) => x.blind).why}`, 'ok'); } else { el.className = 'wrong'; ctx.msg(`❌ 橘色是死角：${round.kids.find((x) => x.blind).why}`, 'no'); }
        ctx.later(() => (++i < 5 ? next() : ctx.end(right, (b) => `${T(`🚌 答對 ${right} / 5 題（最好紀錄 ${b} 題）`, `🚌 ${right} / 5 correct (best ${b})`)}<br>${right >= 4 ? '你知道大型車的死角在哪裡了，要離它遠一點喔！' : '貼近車頭、右側車身、車尾後面都是死角，記起來！'}`)), 3000);
      } })));
    };
    next();
  },
};

/* ---- 體操闖關：跳箱、平衡木、前滾翻的圖示從右邊跑過來，在跑道標線附近按對應的動作（1 跳箱、2 平衡木、3 前滾翻）；10 個關卡 ---- */
const KG_GYMRUN = {
  key: 'campus-gymrun-best', title: ['🏃 體操闖關', '🏃 Gym Course'], label: ['🏃 體操闖關中…', '🏃 Gym Course…'], noFace: true,
  bye: () => T('🏃 下次再來挑戰體操闖關！', '🏃 Come back for the gym course!'),
  start(ctx) {
    const W = 320, H = 200, GY = 150, HIT = 70, N = 10;
    const cv = kgCanvas(ctx, W, H), c = cv.getContext('2d');
    const KIND = [{ n: '跳箱', e: '🟦', col: '#1f56b8' }, { n: '平衡木', e: '➖', col: '#c0392b' }, { n: '前滾翻', e: '🟩', col: '#3fbf9a' }];
    const obs = Array.from({ length: N }, (_, i) => ({ t: (Math.random() * 3) | 0, x: 330 + i * 120, done: 0 }));   // done：0 還沒、1 成功、-1 失敗
    let ok = 0, moved = 0, anim = null, flash = 0, resolved = 0;
    const press = (t) => {
      const o = obs.find((q) => !q.done && q.x < 190 && q.x > 10);
      if (!o) return;
      if (Math.abs(o.x - HIT) <= 42 && o.t === t) { o.done = 1; ok++; anim = { t, k: 0 }; ctx.msg(['跳過去了！', '平衡木走穩了！', '漂亮的前滾翻！'][t], 'ok'); }
      else { o.done = -1; flash = 0.35; ctx.msg(o.t === t ? '太早或太晚了，要在白線附近按！' : `這是${KIND[o.t].n}，要按 ${o.t + 1}！`, 'no'); }
      resolved++;
    };
    ctx.buttons(KIND.map((k, j) => ({ html: `${['🤸', '🤸‍♀️', '🤾'][j]} ${k.n}<small>${j + 1}</small>`, on: () => press(j) })));
    ctx.prog(T(`0 / ${N} 關`, `0 / ${N}`)); ctx.ask('東西到白線時，按對應的動作！'); ctx.msg('1 跳箱　2 平衡木　3 前滾翻');
    ctx.tick = (dt) => {
      const sp = 78 + moved * 0.012; moved += sp * dt;
      for (const o of obs) { if (o.done) { o.x -= sp * dt; continue; } o.x -= sp * dt; if (o.x < 14) { o.done = -1; resolved++; flash = 0.35; ctx.msg('錯過了！', 'no'); } }
      if (anim) { anim.k += dt; if (anim.k > 0.6) anim = null; }
      flash = Math.max(0, flash - dt);
      c.fillStyle = flash > 0 ? '#ffe3dc' : '#eaf6ff'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#d9d9d2'; c.fillRect(0, GY, W, H - GY); c.fillStyle = '#fff'; c.fillRect(HIT - 2, GY - 70, 4, 76);
      c.fillStyle = '#666'; c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.fillText('白線', HIT, GY + 18);
      for (const o of obs) {
        if (o.x < -40 || o.x > W + 40) continue; const k = KIND[o.t];
        c.globalAlpha = o.done === 1 ? 0.3 : 1; c.fillStyle = k.col;
        if (o.t === 0) c.fillRect(o.x - 22, GY - 34, 44, 34); else if (o.t === 1) { c.fillRect(o.x - 34, GY - 20, 68, 7); c.fillRect(o.x - 28, GY - 14, 6, 14); c.fillRect(o.x + 22, GY - 14, 6, 14); } else c.fillRect(o.x - 32, GY - 8, 64, 8);
        c.globalAlpha = 1; c.fillStyle = '#222'; c.font = '700 12px sans-serif'; c.fillText(k.n, o.x, GY - 42 + (o.t === 1 ? 14 : 0));
        if (o.done === 1) { c.font = '18px sans-serif'; c.fillText('✅', o.x, GY - 60); } else if (o.done === -1) { c.font = '18px sans-serif'; c.fillText('❌', o.x, GY - 60); }
      }
      let ry = GY - 22, rot = 0;
      if (anim) { const k = anim.k / 0.6; if (anim.t === 0) ry -= Math.sin(k * Math.PI) * 52; else if (anim.t === 1) ry -= 8; else rot = k * Math.PI * 2; }
      c.save(); c.translate(HIT, ry); c.rotate(rot); c.font = '34px sans-serif'; c.textBaseline = 'middle'; c.fillText('🧒', 0, 0); c.restore();
      ctx.prog(T(`${ok} / ${N} 關成功`, `${ok} / ${N}`));
      if (resolved >= N && !ctx.over) { ctx.over = true; ctx.later(() => ctx.end(ok, (b) => `${T(`🏃 闖過 ${ok} / ${N} 關（最好紀錄 ${b} 關）`, `🏃 ${ok} / ${N} (best ${b})`)}<br>${ok >= 8 ? '體操小達人！動作又準又穩！' : '再練習幾次，動作會更熟練喔！'}`), 700); }
    };
  },
};

/* ---- 乘車安全小測驗：搭公車、校車、遊覽車的安全禮儀（共用三選一題庫） ---- */
const BUSQ_ITEMS = [
  { e: '🚌', q: '公車來了，上車的時候要怎麼做？', a: ['排隊，讓下車的人先下，再依序上車', '大家一起擠，搶位子', '從後門衝上去'], why: '排隊上車、先下後上，大家都比較安全。' },
  { e: '🤚', q: '公車開動的時候，站著的人要？', a: ['抓緊吊環或扶手', '雙手插口袋', '在車廂裡跑來跑去'], why: '車子突然煞車，沒有抓好的人很容易跌倒受傷。' },
  { e: '🛑', q: '公車還沒停穩，可以站起來走到車門嗎？', a: ['不可以，等車子停穩再起身', '可以，先去門口占位置', '可以，邊走邊玩手機'], why: '車子還在動，起身很容易跌倒。' },
  { e: '🔔', q: '想要下車，要怎麼通知司機？', a: ['在到站前先按下車鈴', '大聲尖叫', '站在司機旁邊一直敲'], why: '到站前就按下車鈴，司機才有時間靠站。' },
  { e: '🙋', q: '在車廂裡可以大聲吵鬧、追逐嗎？', a: ['不可以，會讓司機分心', '可以，大家都開心', '沒人看到就可以'], why: '司機要專心開車，吵鬧會很危險。' },
  { e: '👵', q: '看到老人、孕婦、抱小嬰兒的人上車，要？', a: ['主動讓座', '假裝睡著', '把書包放在座位上占位'], why: '讓座是一種貼心和禮貌。' },
  { e: '🎒', q: '搭車的時候，書包要放哪裡？', a: ['放在腿上或座位下面，不擋走道', '放在走道中間', '掛在車門口'], why: '擋住走道會害別人跌倒，也影響緊急逃生。' },
  { e: '🚗', q: '搭乘小客車、遊覽車，後座也要？', a: ['繫上安全帶', '不用，後座很安全', '站起來看風景'], why: '發生事故時，沒繫安全帶的人會被甩出去。' },
  { e: '🪟', q: '手和頭可以伸出車窗外嗎？', a: ['不可以，很危險', '可以，吹吹風', '可以，向路人揮手'], why: '可能被路邊的東西或別的車撞到。' },
  { e: '🚏', q: '下車以後，要過馬路，應該怎麼做？', a: ['等公車開走，看清楚兩邊都沒車再走', '從公車前面直接衝過去', '從公車屁股後面衝過去'], why: '公車會擋住視線，也可能有車從旁邊過來。' },
  { e: '🧍', q: '下車以後，站在哪裡等最安全？', a: ['人行道上，離車子遠一點', '站在車頭的正前面', '站在車尾的正後面'], why: '車頭前面、車尾後面都是司機的視野死角。' },
  { e: '🚌', q: '為什麼不要站在大型車的車頭前或車尾後？', a: ['那裡是司機的視野死角，看不到你', '因為地板很髒', '因為會被拍照'], why: '司機看不到你，一起步或倒車就可能撞到。' },
];
const KG_BUSQ = mcGame({
  key: 'campus-busq-best', title: ['🚌 乘車安全小測驗', '🚌 Bus Safety Quiz'], label: ['🚌 乘車安全小測驗…', '🚌 Bus Safety…'], icon: '🚌', items: BUSQ_ITEMS,
  intro: () => T('搭公車、校車的時候，怎麼做最安全？', 'How do you stay safe on the bus?'),
  good: '你是乘車安全小達人，搭車一定平平安安！', keep: '多想一想怎麼做最安全，下次一定更棒！',
});
KG_BUSQ.noFace = true;

/* ---- 情緒覺察（雅雅老師，輔導老師）：「今天心情如何？」不計分、沒有對錯。
   先選心理感受（舒服／不舒服），再選生理能量（充滿活力／無力），落在四個顏色圈圈的哪一個：
   紅＝不舒服＋充滿活力、黃＝舒服＋充滿活力、藍＝不舒服＋無力、綠＝舒服＋無力。護照只記「做了幾次」，不記心情 ---- */
const MOOD_Q = {
  'bad-high': { col: '#ff5a5a', name: '紅色', face: '😠', msg: '心裡不舒服、身體卻很有力氣——可能是生氣、緊張或著急。先深呼吸：吸 4 秒、吐 6 秒，做 3 次。再把感覺說出來，或找信任的大人聊聊。' },
  'good-high': { col: '#ffd84d', name: '黃色', face: '😄', msg: '心裡舒服、身體也充滿活力——可能是開心、興奮、期待！把這份好心情分享給朋友，也可以幫身邊的人加油。' },
  'bad-low': { col: '#33b4ff', name: '藍色', face: '😢', msg: '心裡不舒服、身體也沒力氣——可能是難過、疲累或失望。先休息一下、喝點水。想說的時候，隨時可以來輔導室找我，或跟信任的大人說。' },
  'good-low': { col: '#7ed957', name: '綠色', face: '😌', msg: '心裡舒服、身體放鬆——可能是平靜、滿足、安心。好好享受這種感覺，記得它是什麼樣子，不舒服的時候就可以想起來。' },
};
const KG_MOOD = {
  key: 'campus-mood-count', title: ['💗 情緒覺察', '💗 Mood Check-in'], label: ['💗 情緒覺察中…', '💗 Mood check-in…'],
  bye: (n) => T(`💗 隨時歡迎再來找${n.name}聊聊～`, `💗 Come back and talk with ${n.name} anytime!`),
  start(ctx) {
    const W = 300, H = 250, cv = kgCanvas(ctx, W, H), c = cv.getContext('2d');
    let plays = 0;
    const spots = { 'bad-high': [106, 76], 'good-high': [194, 76], 'bad-low': [106, 182], 'good-low': [194, 182] };
    const draw = (sel) => {
      c.fillStyle = '#fffaf3'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath(); c.moveTo(150, 14); c.lineTo(150, H - 14); c.moveTo(14, 129); c.lineTo(W - 14, 129); c.stroke();
      c.font = '700 11px sans-serif'; c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('⚡ 充滿活力', 150, 10); c.fillText('🔋 無力', 150, H - 8); c.textAlign = 'left'; c.fillText('💔 不舒服', 6, 118); c.textAlign = 'right'; c.fillText('💗 舒服', W - 6, 118);
      for (const [k, [x, y]] of Object.entries(spots)) {
        const q = MOOD_Q[k], on = sel === k;
        c.globalAlpha = !sel || on ? 1 : 0.28; c.fillStyle = q.col; c.beginPath(); c.arc(x, y, on ? 50 : 44, 0, 7); c.fill();
        if (on) { c.strokeStyle = '#222'; c.lineWidth = 4; c.stroke(); c.font = '44px sans-serif'; c.textAlign = 'center'; c.fillText(q.face, x, y + 2); }
        c.globalAlpha = 1;
      }
    };
    const step1 = () => {
      draw(null); ctx.prog(''); ctx.ask('你的<b>心理感受</b>是舒服，還是不舒服？'); ctx.msg(plays ? '' : '先深呼吸一下，感受自己現在的狀態。沒有對錯，每一種感覺都可以。');
      ctx.buttons([{ html: '💗 舒服<small>1</small>', on: () => step2('good') }, { html: '💔 不舒服<small>2</small>', on: () => step2('bad') }]);
    };
    const step2 = (feel) => {
      ctx.ask('你的<b>身體能量</b>是充滿活力，還是無力？'); ctx.msg(feel === 'good' ? '心裡舒服的感覺，很好～' : '心裡不舒服也沒關係，我們一起看看。');
      ctx.buttons([{ html: '⚡ 充滿活力<small>1</small>', on: () => result(`${feel}-high`) }, { html: '🔋 無力<small>2</small>', on: () => result(`${feel}-low`) }]);
    };
    const result = (k) => {
      const q = MOOD_Q[k]; plays++; draw(k);
      ctx.ask(`你現在在<b>${q.name}</b>圈圈 ${q.face}`); ctx.msg(q.msg);
      ctx.buttons([{ html: '🔁 再做一次<small>1</small>', on: step1 }, { html: '👋 結束<small>2</small>', on: () => ctx.end(ctx.best + plays, () => `${T('💗 謝謝你說出現在的心情！', '💗 Thank you for sharing!')}<br>${ctx.n.name}：${T('每一種心情都是正常的，想聊聊隨時來找我。', 'Every feeling is okay. Come talk to me anytime.')}`) }]);
    };
    step1();
  },
};

/* ---- 整理圖書館（方老師，圖書館管理員）：把書放回正確的書架區。分區照「中國圖書分類法」的大類，用小朋友看得懂的說法 ---- */
const LIB_ITEMS = [
  { e: '🦕', q: '《神奇的恐龍化石》要放回哪一區？', a: ['科學', '藝術', '語文'], why: '動物、植物、恐龍、天文、數學都放在「科學」區。' },
  { e: '🌌', q: '《宇宙與星星》要放回哪一區？', a: ['科學', '史地', '社會'], why: '天文、宇宙是自然科學，放在「科學」區。' },
  { e: '🔢', q: '《數學小偵探》要放回哪一區？', a: ['科學', '語文', '藝術'], why: '數學也是科學的一種，放在「科學」區。' },
  { e: '🍳', q: '《兒童烹飪食譜》要放回哪一區？', a: ['應用科技', '史地', '語文'], why: '烹飪、種植、電腦、醫藥這些生活裡的技術，放在「應用科技」區。' },
  { e: '💻', q: '《Scratch 程式入門》要放回哪一區？', a: ['應用科技', '藝術', '史地'], why: '電腦和程式屬於「應用科技」區。' },
  { e: '🌱', q: '《種菜小達人》要放回哪一區？', a: ['應用科技', '語文', '藝術'], why: '種菜、養動物（農業）放在「應用科技」區。' },
  { e: '🚦', q: '《交通安全小百科》要放回哪一區？', a: ['社會', '科學', '藝術'], why: '交通、法律、教育、禮儀這些和人與社會有關的，放在「社會」區。' },
  { e: '🎓', q: '《臺灣的學校生活》要放回哪一區？', a: ['社會', '科學', '語文'], why: '教育、學校、風俗放在「社會」區。' },
  { e: '🏯', q: '《臺灣歷史故事》要放回哪一區？', a: ['史地', '科學', '藝術'], why: '歷史、地理、旅遊放在「史地」區。' },
  { e: '🗺️', q: '《世界地圖大冒險》要放回哪一區？', a: ['史地', '應用科技', '語文'], why: '地圖、各國的介紹屬於「史地」區。' },
  { e: '📖', q: '《國語注音小學堂》要放回哪一區？', a: ['語文', '科學', '史地'], why: '國語、英語、文字、文學、童話都放在「語文」區。' },
  { e: '🧚', q: '《格林童話》要放回哪一區？', a: ['語文', '藝術', '社會'], why: '童話、小說、詩是文學，放在「語文」區。' },
  { e: '🎹', q: '《認識樂器》要放回哪一區？', a: ['藝術', '科學', '語文'], why: '音樂、繪畫、攝影、美勞放在「藝術」區。' },
  { e: '🎨', q: '《水彩畫入門》要放回哪一區？', a: ['藝術', '應用科技', '社會'], why: '畫畫、美勞屬於「藝術」區。' },
  { e: '📕', q: '《兒童百科全書》要放回哪一區？', a: ['總類', '科學', '語文'], why: '百科全書、字典、辭典、報紙雜誌這種什麼都有的工具書，放在「總類」區。' },
  { e: '📚', q: '《國語辭典》要放回哪一區？', a: ['總類', '語文', '史地'], why: '辭典是查資料用的工具書，放在「總類」區。' },
];
const KG_LIB = mcGame({
  key: 'campus-library-best', title: ['📚 整理圖書館', '📚 Shelve the Books'], label: ['📚 整理圖書館…', '📚 Shelving books…'], icon: '📚', items: LIB_ITEMS,
  intro: () => T('幫我把書放回正確的書架區。看書名，想一想它在講什麼！', 'Put each book back on the right shelf. Think about what it is about!'),
  good: '謝謝你，你是圖書館小幫手！', keep: '沒關係，多看幾次分類牌就記住了。',
});

/* ---- 音符小遊戲（吳老師，音樂老師）：看五線譜上的音符，說出是 Do Re Mi 的哪一個；再認識音符是幾拍 ---- */
const NOTE_NAMES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', '高音 Do'];
const noteSvg = (step, wide = 150) => {          // step：從 Do（第一線下面的 C4）算起往上第幾格（半格＝一個音）
  const y = (s) => 80 - s * 5, cx = 92;
  const lines = [70, 60, 50, 40, 30].map((ly) => `<line x1="8" y1="${ly}" x2="${wide - 8}" y2="${ly}" stroke="#222" stroke-width="1.5"/>`).join('');
  const ledger = step === 0 ? `<line x1="${cx - 14}" y1="80" x2="${cx + 14}" y2="80" stroke="#222" stroke-width="1.5"/>` : '';
  return `<svg viewBox="0 0 ${wide} 100" width="${wide}" height="100" style="vertical-align:middle;background:#fffdf6;border:2px solid #222;border-radius:4px">${lines}${ledger}<text x="12" y="62" font-size="11" font-weight="700" fill="#555">高音譜表</text><ellipse cx="${cx}" cy="${y(step)}" rx="8" ry="6" fill="#222" transform="rotate(-18 ${cx} ${y(step)})"/><line x1="${cx + 7}" y1="${y(step)}" x2="${cx + 7}" y2="${y(step) - 28}" stroke="#222" stroke-width="2"/></svg>`;
};
const noteLen = (kind) => {                       // 音符的樣子：全音符（空心、沒有桿）、二分（空心＋桿）、四分（實心＋桿）、八分（實心＋桿＋旗子）
  const hollow = kind === 'whole' || kind === 'half', stem = kind !== 'whole', flag = kind === 'eighth';
  return `<svg viewBox="0 0 80 80" width="80" height="80" style="vertical-align:middle;background:#fffdf6;border:2px solid #222;border-radius:4px"><ellipse cx="36" cy="56" rx="${kind === 'whole' ? 14 : 11}" ry="${kind === 'whole' ? 9 : 8}" fill="${hollow ? '#fffdf6' : '#222'}" stroke="#222" stroke-width="3" transform="rotate(-18 36 56)"/>${stem ? '<line x1="46" y1="54" x2="46" y2="14" stroke="#222" stroke-width="3"/>' : ''}${flag ? '<path d="M46 14 Q64 20 58 40" fill="none" stroke="#222" stroke-width="3"/>' : ''}</svg>`;
};
const NOTES_ITEMS = [
  ...NOTE_NAMES.map((nm, i) => ({
    e: noteSvg(i), q: '這個音符唱起來是哪一個音？',
    a: [nm, ...NOTE_NAMES.filter((x) => x !== nm).sort((p, q) => Math.abs(NOTE_NAMES.indexOf(p) - i) - Math.abs(NOTE_NAMES.indexOf(q) - i)).slice(0, 2)],
    why: `這是「${nm}」。音符在五線譜上的位置越高，聲音就越高；Do Re Mi Fa Sol La Si 一格一格往上爬。`,
  })),
  { e: noteLen('whole'), q: '這個空心、沒有桿子的音符叫什麼？', a: ['全音符', '二分音符', '四分音符'], why: '全音符是空心的、沒有桿子，要唱 4 拍。' },
  { e: noteLen('half'), q: '這個空心、有桿子的音符叫什麼？', a: ['二分音符', '全音符', '八分音符'], why: '二分音符是空心、有桿子，要唱 2 拍。' },
  { e: noteLen('quarter'), q: '這個實心、有桿子的音符叫什麼？', a: ['四分音符', '二分音符', '全音符'], why: '四分音符是實心、有桿子，要唱 1 拍，像走路的一步。' },
  { e: noteLen('eighth'), q: '這個實心、桿子上還有旗子的音符叫什麼？', a: ['八分音符', '四分音符', '二分音符'], why: '八分音符有一面小旗子，只要唱半拍，是四分音符的一半。' },
  { e: '🥁', q: '二分音符要唱幾拍？', a: ['2 拍', '1 拍', '4 拍'], why: '全音符 4 拍、二分音符 2 拍、四分音符 1 拍、八分音符半拍。' },
  { e: '🎼', q: '一首歌每一小節有 4 拍，一個全音符剛好唱幾個小節？', a: ['1 小節', '2 小節', '半個小節'], why: '全音符 4 拍，剛好一整個 4 拍的小節。' },
];
const KG_NOTES = mcGame({
  key: 'campus-notes-best', title: ['🎼 音符小遊戲', '🎼 Music Notes'], label: ['🎼 音符小遊戲…', '🎼 Music notes…'], icon: '🎼', items: NOTES_ITEMS,
  intro: () => T('看看五線譜上的音符，是 Do Re Mi 的哪一個？還有它要唱幾拍呢？', 'Which note is it, and how many beats?'),
  good: '你的音感很棒，積極學習、喜樂成長！', keep: '沒關係，認識自己、接納自己，多看幾次就會了！',
});

/* ---- 心情晴雨天（林老師，專輔老師）：「今天心裡的天氣是什麼？」不計分、沒有對錯，也不記心情，只記做了幾次。
   選一種天氣 → 老師用天氣的比喻回應；下雨、打雷、起霧的話，可以再按「等雨停」看到雨過天晴出彩虹 ---- */
const WX_SKY = {
  sun:   { icon: '☀️', name: '晴天', sky: ['#7fd0ff', '#cdeeff'], msg: '今天心裡是大晴天！把這份好心情記下來，也可以分享給身邊的人，讓他們也暖暖的。' },
  cloud: { icon: '⛅', name: '多雲', sky: ['#a9c9e6', '#e4eef6'], msg: '有一點悶、有一點不確定。多雲的日子很普通也很正常，不用急著變晴，慢慢來就好。' },
  rain:  { icon: '🌧️', name: '下雨', sky: ['#7b8da3', '#b9c4d1'], msg: '心裡下著雨，可能是難過或委屈。哭一哭沒關係，雨會把心裡的灰塵洗乾淨。願意的話，跟我說說發生什麼事。', clear: true },
  storm: { icon: '⛈️', name: '雷雨', sky: ['#4a5568', '#8591a3'], msg: '心裡在打雷，可能是很生氣或很害怕。先找個安全的地方，慢慢深呼吸。雷雨很大，但都會過去，我陪你。', clear: true },
  fog:   { icon: '🌫️', name: '起霧', sky: ['#aeb7bf', '#dfe3e6'], msg: '心裡起霧了，看不清楚自己怎麼了。沒關係，霧會慢慢散，我們可以一起把它看清楚。', clear: true },
};
const KG_WEATHER = {
  key: 'campus-weather-count', title: ['🌤️ 心情晴雨天', '🌤️ Weather Mood'], label: ['🌤️ 心情晴雨天…', '🌤️ Weather mood…'],
  bye: (n) => T(`🌈 隨時歡迎再來找${n.name}聊聊～`, `🌈 Come back and talk with ${n.name} anytime!`),
  start(ctx) {
    const W = 300, H = 190, cv = kgCanvas(ctx, W, H), c = cv.getContext('2d');
    let plays = 0;
    const cloud = (x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 18 * s, 0, 7); c.arc(x + 20 * s, y + 4 * s, 14 * s, 0, 7); c.arc(x - 20 * s, y + 5 * s, 13 * s, 0, 7); c.fillRect(x - 22 * s, y + 4 * s, 44 * s, 14 * s); c.fill(); };
    const draw = (k, rainbow) => {
      const s = WX_SKY[k] || WX_SKY.cloud, g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.sky[0]); g.addColorStop(1, s.sky[1]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (rainbow) { ['#ff5a5a', '#ff9f43', '#ffd84d', '#7ed957', '#33b4ff', '#7a5cff'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 9; c.beginPath(); c.arc(150, 170, 120 - i * 9, Math.PI, 0); c.stroke(); }); }
      if (rainbow || k === 'sun') { c.fillStyle = '#ffd84d'; c.beginPath(); c.arc(rainbow ? 252 : 220, 52, 30, 0, 7); c.fill(); }
      if (k === 'cloud') { cloud(100, 70, 1.2, '#fff'); cloud(210, 100, 1, '#fdfdfd'); }
      if (k === 'rain' || k === 'storm') {
        cloud(110, 54, 1.4, k === 'storm' ? '#4b5362' : '#8e99a8'); cloud(210, 70, 1.2, k === 'storm' ? '#5a6272' : '#a0aab8');
        c.strokeStyle = '#d9ecff'; c.lineWidth = 3; for (let i = 0; i < 26; i++) { const x = 20 + (i * 37) % 270, y = 90 + (i * 53) % 90; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5, y + 12); c.stroke(); }
        if (k === 'storm') { c.fillStyle = '#ffe14d'; c.beginPath(); c.moveTo(165, 82); c.lineTo(145, 122); c.lineTo(162, 122); c.lineTo(150, 160); c.lineTo(188, 108); c.lineTo(168, 108); c.closePath(); c.fill(); }
      }
      if (k === 'fog') { for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(255,255,255,${0.35 + i * 0.08})`; c.fillRect(10 + (i % 2) * 24, 30 + i * 28, W - 40 - (i % 2) * 24, 16); } }
      if (rainbow) cloud(60, 160, 0.8, '#fff');
      c.font = '40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; if (!rainbow) c.fillText(s.icon, 44, 40);
    };
    const step1 = () => {
      draw('cloud'); ctx.prog(''); ctx.ask('<b>今天你心裡的天氣</b>是什麼？'); ctx.msg(plays ? '' : '閉上眼睛想一想，現在心裡是什麼天氣？沒有對錯，每一種天氣都是正常的。');
      ctx.buttons(Object.entries(WX_SKY).map(([k, s], i) => ({ html: `${s.icon} ${s.name}<small>${i + 1}</small>`, on: () => result(k) })));
    };
    const result = (k) => {
      const s = WX_SKY[k]; plays++; draw(k);
      ctx.ask(`你心裡的天氣是 <b>${s.name}</b> ${s.icon}`); ctx.msg(s.msg);
      const bs = [];
      if (s.clear) bs.push({ html: '🌈 等雨停<small>1</small>', on: () => clearUp() });
      bs.push({ html: `🔁 再選一次<small>${bs.length + 1}</small>`, on: step1 }, { html: `👋 結束<small>${bs.length + 2}</small>`, on: done });
      ctx.buttons(bs);
    };
    const clearUp = () => {
      draw('sun', true); ctx.ask('雨過天晴 🌈'); ctx.msg('生命中的裂痕，都是為了讓光可以照入。壞天氣會過去，你也會慢慢變好。');
      ctx.buttons([{ html: '🔁 再選一次<small>1</small>', on: step1 }, { html: '👋 結束<small>2</small>', on: done }]);
    };
    const done = () => ctx.end(ctx.best + plays, () => `${T('🌈 謝謝你說出心裡的天氣！', '🌈 Thank you for sharing!')}<br>${ctx.n.name}：${T('不管今天是晴天還是雨天，都可以來找我聊聊。', 'Sunny or rainy, you can always come talk to me.')}`);
    step1();
  },
};

/* ---- 小數點的遊戲（黃老師，四年二班）：四年級的小數（讀法、位值、比大小、加減、單位換算），一回 5 題 ---- */
const DECIMAL_ITEMS = [
  { e: '⚖️', q: '0.5 和 0.45，哪一個比較大？', a: ['0.5', '0.45', '一樣大'], why: '0.5 ＝ 0.50，50 個 0.01 比 45 個 0.01 多，所以 0.5 比較大。不是位數多就比較大喔！' },
  { e: '🔍', q: '3.27 的「2」在哪一位？', a: ['十分位', '個位', '百分位'], why: '小數點右邊第一位是十分位，第二位是百分位。3.27 的 2 在十分位，代表 0.2。' },
  { e: '🔍', q: '12.34 的百分位是哪一個數字？', a: ['4', '3', '2'], why: '小數點右邊第二位是百分位，所以是 4，代表 0.04。' },
  { e: '🗣️', q: '0.07 要怎麼讀？', a: ['零點零七', '零點七', '七點零'], why: '小數點後面一個一個數字讀：零點零七。' },
  { e: '➕', q: '1.5 ＋ 2.3 ＝ ？', a: ['3.8', '3.5', '4.8'], why: '小數點對齊再加：1.5 ＋ 2.3 ＝ 3.8。' },
  { e: '➕', q: '1.9 ＋ 0.1 ＝ ？', a: ['2', '1.10', '2.1'], why: '9 個 0.1 再加 1 個 0.1 是 10 個 0.1，就是 1，所以 1.9 ＋ 0.1 ＝ 2。' },
  { e: '➖', q: '5 － 1.2 ＝ ？', a: ['3.8', '4.2', '4.8'], why: '把 5 想成 5.0，小數點對齊：5.0 － 1.2 ＝ 3.8。' },
  { e: '➖', q: '0.8 － 0.35 ＝ ？', a: ['0.45', '0.55', '0.5'], why: '0.8 ＝ 0.80，0.80 － 0.35 ＝ 0.45。' },
  { e: '📏', q: '2.5 公尺 ＝ ＿＿ 公分', a: ['250', '25', '2500'], why: '1 公尺 ＝ 100 公分，2.5 公尺就是 250 公分。' },
  { e: '🎒', q: '4.5 公斤 ＝ ＿＿ 公克', a: ['4500', '450', '45'], why: '1 公斤 ＝ 1000 公克，4.5 公斤就是 4500 公克。' },
  { e: '🍕', q: '一個披薩平分成 10 片，吃掉 3 片，吃掉的是幾個披薩？', a: ['0.3', '3.0', '0.03'], why: '10 片裡的 3 片是十分之三，寫成小數是 0.3。' },
  { e: '🪙', q: '0.25 寫成分數是多少？', a: ['四分之一', '二十五分之一', '五分之二'], why: '0.25 ＝ 一百分之二十五 ＝ 四分之一。' },
  { e: '🟰', q: '0.6 和 0.60 比，結果是？', a: ['一樣大', '0.60 比較大', '0.6 比較大'], why: '小數最後面的 0 可以拿掉，0.60 ＝ 0.6，一樣大。' },
  { e: '📶', q: '0.8、0.08、0.88 裡面，最小的是哪一個？', a: ['0.08', '0.8', '0.88'], why: '先比十分位：0.08 的十分位是 0，最小。' },
  { e: '🏃', q: '跑 100 公尺，小明花 15.8 秒，小華花 16.2 秒，誰比較快？', a: ['小明', '小華', '一樣快'], why: '跑一樣的距離，花的時間越少越快：15.8 比 16.2 少，小明比較快。' },
  { e: '💯', q: '1 裡面有幾個 0.01？', a: ['100 個', '10 個', '1000 個'], why: '1 ＝ 100 個 0.01，就像 1 元 ＝ 100 個 1 分。' },
];
const KG_DECIMAL = mcGame({
  key: 'campus-decimal-best', title: ['🔢 小數點的遊戲', '🔢 Decimals'], label: ['🔢 小數點的遊戲…', '🔢 Decimals…'], icon: '🔢', items: DECIMAL_ITEMS,
  intro: () => T('小數點像一道小小的門，門右邊是十分位、百分位。仔細看清楚再回答！', 'The decimal point is a little door: tenths and hundredths live on the right!'),
  good: '你是小數點高手，快樂開心每一天！', keep: '慢慢來，把小數點對齊，就不會算錯了！',
});

/* ---- 形狀顏色對對碰（楊老師，潛能老師）：12 張牌翻兩張，形狀「和」顏色都一樣才是一對（同形狀不同色、同色不同形狀都不算）。
   沒有時間限制；全部配完看翻錯幾次給星星（3 次以內 3 顆、6 次以內 2 顆、其他 1 顆） ---- */
const SHAPE_KINDS = { circle: '圓形', square: '正方形', triangle: '三角形', star: '星形', heart: '愛心', diamond: '菱形' };
const SHAPE_COLS = { red: ['#e8505b', '紅色'], blue: ['#4a8fd8', '藍色'], yellow: ['#f2c94c', '黃色'], green: ['#5cbf5a', '綠色'] };
const shapeSvg = (k, col) => {
  const s = { stroke: '#2b2b2b', w: 3 }, fill = `fill="${col}" stroke="${s.stroke}" stroke-width="${s.w}" stroke-linejoin="round"`;
  const g = k === 'circle' ? `<circle cx="30" cy="30" r="20" ${fill}/>`
    : k === 'square' ? `<rect x="11" y="11" width="38" height="38" ${fill}/>`
    : k === 'triangle' ? `<polygon points="30,8 52,50 8,50" ${fill}/>`
    : k === 'star' ? `<polygon points="30,6 36,23 54,23 40,34 45,52 30,41 15,52 20,34 6,23 24,23" ${fill}/>`
    : k === 'heart' ? `<path d="M30 52 C8 36 6 22 16 15 C23 10 29 14 30 20 C31 14 37 10 44 15 C54 22 52 36 30 52 Z" ${fill}/>`
    : `<polygon points="30,6 52,30 30,54 8,30" ${fill}/>`;
  return `<svg viewBox="0 0 60 60" width="46" height="46">${g}</svg>`;
};
const KG_SHAPES = {
  key: 'campus-shapes-best', title: ['🔷 形狀顏色對對碰', '🔷 Shape & Color Match'], label: ['🔷 形狀顏色對對碰…', '🔷 Shape match…'],
  bye: (n) => T(`🔷 下次再來找${n.name}玩對對碰！`, `🔷 Come back and match with ${n.name}!`),
  start(ctx) {
    const kinds = kgShuffle(Object.keys(SHAPE_KINDS)).slice(0, 3), cols = kgShuffle(Object.keys(SHAPE_COLS)).slice(0, 2);
    const pairs = kinds.flatMap((k) => cols.map((c) => ({ k, c })));       // 3 種形狀 × 2 種顏色 ＝ 6 對：一定會有同形狀不同色的牌來考驗
    const cards = kgShuffle([...pairs, ...pairs].map((p) => ({ ...p, up: false, done: false })));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,58px);gap:6px;justify-content:center;margin:2px auto';
    ctx.stage.innerHTML = ''; ctx.stage.appendChild(grid);
    let open = [], miss = 0, matched = 0, lock = false;
    const paint = (cd) => {
      cd.el.innerHTML = cd.up || cd.done ? shapeSvg(cd.k, SHAPE_COLS[cd.c][0]) : '<span style="font-size:26px">🌱</span>';
      cd.el.style.cssText = `width:58px;height:58px;padding:0;border:3px solid #2b2b2b;border-radius:8px;cursor:pointer;display:grid;place-items:center;background:${cd.done ? '#e8f7e4' : cd.up ? '#fffdf6' : '#8fc7a8'};opacity:${cd.done ? 0.75 : 1}`;
    };
    const flip = (cd) => {
      if (lock || cd.up || cd.done) return;
      cd.up = true; paint(cd); open.push(cd);
      if (open.length < 2) return;
      const [a, b] = open; open = [];
      if (a.k === b.k && a.c === b.c) {
        a.done = b.done = true; paint(a); paint(b); matched++; ctx.face('happy');
        ctx.msg(`⭕ ${SHAPE_COLS[a.c][1]}的${SHAPE_KINDS[a.k]}，配對成功！`, 'ok'); ctx.prog(T(`配對 ${matched} / 6`, `${matched} / 6 pairs`));
        if (matched === 6) {
          const stars = miss <= 3 ? 3 : miss <= 6 ? 2 : 1;
          ctx.later(() => ctx.end(stars, (bst) => `${T(`🔷 全部配對完成！翻錯 ${miss} 次，得到 ${'⭐'.repeat(stars)}（最好紀錄 ${bst} 顆星）`, `🔷 All matched! ${miss} misses, ${stars} star(s) (best ${bst})`)}<br>${ctx.n.name}：${stars === 3 ? '眼睛好利！每一顆小種子都有長成大樹的力量！' : '你很專心喔！多玩幾次，記憶力會越來越好！'}`), 1200);
        }
      } else {
        miss++; lock = true; ctx.face('surprised', 1);
        const why = a.k === b.k ? '形狀一樣，可是顏色不一樣喔！' : a.c === b.c ? '顏色一樣，可是形狀不一樣喔！' : '形狀和顏色都不一樣，再記一記位置！';
        ctx.msg(`❌ ${why}`, 'no');
        ctx.later(() => { a.up = b.up = false; paint(a); paint(b); lock = false; }, 1000);
      }
    };
    for (const cd of cards) { cd.el = document.createElement('button'); cd.el.onclick = () => flip(cd); paint(cd); grid.appendChild(cd.el); }
    ctx.prog(T('配對 0 / 6', '0 / 6 pairs'));
    ctx.ask(T('翻兩張牌：<b>形狀和顏色都一樣</b>才是一對！', 'Flip two cards: same <b>shape and color</b> make a pair!'));
    ctx.msg(T('先記住每張牌的位置，慢慢來沒關係～', 'Remember where each card is. Take your time!'));
    ctx.buttons([]);
  },
};

/* ---- 操場投球（張校長）：在穿堂找校長，一起瞬間移動到操場溜滑梯旁的草地（throwAt）；玩完回穿堂。
   瞄準器先左右移動（按一次固定左右），再上下移動（再按一次投出去）；離靶心越近分數越高，一回 5 球 ---- */
const KG_THROW = {
  key: 'campus-throw-best', title: ['⚾ 操場投球', '⚾ Ball Toss'], label: ['⚾ 在操場投球…', '⚾ Ball toss…'],
  bye: (n) => T(`⚾ 下次再來找${n.name}練投球！`, `⚾ Come back and practice with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, Tk = D.outdoor.track;
    const home = { f: n.f, x: n.g.position.x, z: n.g.position.z, yaw: n.yaw };
    home.px = home.x - Math.sin(home.yaw) * 1.6; home.pz = home.z - Math.cos(home.yaw) * 1.6; home.pyaw = home.yaw + Math.PI;
    const [tx, tz] = n.throwAt ? n.throwAt() : [mx(Tk.center[0]) - 4, mz(Tk.center[1]) + 3];
    placeNPC(n, floors[1], tx, tz, -Math.PI / 2); n.label.visible = false;
    placeAt(floors[1], tx + 1.9, tz, Math.PI / 2); avatar.rotation.y = Math.PI / 2; player.yaw = Math.PI / 2 + 0.42; player.pitch = -0.1;
    ctx.onStop = () => { placeNPC(n, home.f, home.x, home.z, home.yaw); n.label.visible = true; placeAt(home.f, home.px, home.pz, home.pyaw); };

    const W = 300, H = 220, CX = 150, CY = 100, RINGS = [[18, 10, '#e8505b'], [36, 8, '#ffffff'], [54, 6, '#4a8fd8'], [72, 4, '#ffffff'], [90, 2, '#2b2b2b']];
    const cv = kgCanvas(ctx, W, H), c = cv.getContext('2d');
    let ball = 0, total = 0, phase = 'x', t = 0, ax = CX, ay = CY, fly = null, marks = [];
    const speed = () => 2.2 + ball * 0.35;
    const draw = () => {
      c.fillStyle = '#7cc46a'; c.fillRect(0, 0, W, H); c.fillStyle = '#b8865a'; c.fillRect(0, H - 22, W, 22);
      for (let i = RINGS.length - 1; i >= 0; i--) { const [r, , col] = RINGS[i]; c.fillStyle = col; c.beginPath(); c.arc(CX, CY, r, 0, 7); c.fill(); c.strokeStyle = '#2b2b2b'; c.lineWidth = 1.5; c.stroke(); }
      for (const [x, y] of marks) { c.fillStyle = '#f4e9c8'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.strokeStyle = '#7a5a2a'; c.stroke(); }
      if (!fly && ball < 5) {
        c.strokeStyle = '#ffde3b'; c.lineWidth = 3;
        if (phase === 'x') { c.beginPath(); c.moveTo(ax, 4); c.lineTo(ax, H - 26); c.stroke(); }
        else { c.beginPath(); c.moveTo(ax, 4); c.lineTo(ax, H - 26); c.moveTo(4, ay); c.lineTo(W - 4, ay); c.stroke(); c.beginPath(); c.arc(ax, ay, 9, 0, 7); c.stroke(); }
      }
      if (fly) { const k = fly.k, x = CX + (fly.x - CX) * k, y = (H - 10) + (fly.y - (H - 10)) * k - Math.sin(k * Math.PI) * 60; c.fillStyle = '#fffdf2'; c.beginPath(); c.arc(x, y, 12 - k * 6, 0, 7); c.fill(); c.strokeStyle = '#c0392b'; c.lineWidth = 2; c.stroke(); }
    };
    const press = () => {
      if (fly || ball >= 5) return;
      if (phase === 'x') { phase = 'y'; t = 0; ctx.msg(T('左右固定了！再按一次，上下對準就投出去！', 'Locked left-right! Press again to throw!')); return; }
      fly = { x: ax, y: ay, k: 0 };
    };
    ctx.tick = (dt) => {
      t += dt;
      if (!fly && ball < 5) { if (phase === 'x') ax = CX + 125 * Math.sin(t * speed()); else ay = CY + 88 * Math.sin(t * speed() * 1.15); }
      if (fly) {
        fly.k = Math.min(1, fly.k + dt * 2.2);
        if (fly.k >= 1) {
          const d = Math.hypot(fly.x - CX, fly.y - CY), hit = RINGS.find(([r]) => d <= r), pt = hit ? hit[1] : 0;
          marks.push([fly.x, fly.y]); total += pt; ball++; fly = null; phase = 'x'; t = Math.random() * 3;
          ctx.prog(T(`第 ${ball} / 5 球・${total} 分`, `Ball ${ball} / 5 · ${total} pts`));
          if (pt >= 10) { ctx.face('happy'); ctx.msg(T('🎯 正中靶心！10 分！', '🎯 Bullseye! 10 points!'), 'ok'); }
          else if (pt) ctx.msg(T(`👍 ${pt} 分！`, `👍 ${pt} points!`), 'ok');
          else { ctx.face('surprised', 1); ctx.msg(T('😮 沒投中，沒關係，再熱身一次！', '😮 Missed! Warm up and try again!'), 'no'); }
          if (ball >= 5) ctx.later(() => ctx.end(total, (b) => `${T(`⚾ 5 球共 ${total} 分（最好紀錄 ${b} 分）`, `⚾ ${total} points in 5 balls (best ${b})`)}<br>${n.name}：${total >= 30 ? '投得真準！校長給你拍拍手！' : '多練習幾次，一定會越投越準！'}`), 1300);
        }
      }
      draw();
    };
    ctx.onKey = (e) => { if (e.code === 'KeyF' || e.code === 'Space') { press(); return true; } return false; };
    cv.onclick = press;
    ctx.buttons([{ html: T('⚾ 投球 <small>F／空白鍵</small>', '⚾ Throw <small>F / Space</small>'), on: press }]);
    ctx.ask(T('我們到操場了！黃線移到靶心時按一次，再按一次就投出去', 'We are at the field! Press when the line is on the bullseye, then press again to throw'));
    ctx.prog(T('第 0 / 5 球・0 分', 'Ball 0 / 5 · 0 pts'));
    draw();
  },
};

/* ---- 注音聲調大挑戰（顏老師，一年二班）：看字和注音，選它是第幾聲（一聲不標、二聲ˊ、三聲ˇ、四聲ˋ、輕聲˙），一回 6 題 ---- */
// t：1～4 聲、0 是輕聲；w 有兩個字的時候，hi 是要問的那個字
const TONE_ITEMS = [
  { e: '👩', w: '媽', zy: 'ㄇㄚ', t: 1 }, { e: '🌾', w: '麻', zy: 'ㄇㄚ', t: 2 }, { e: '🐴', w: '馬', zy: 'ㄇㄚ', t: 3 }, { e: '😠', w: '罵', zy: 'ㄇㄚ', t: 4 },
  { e: '🌸', w: '花', zy: 'ㄏㄨㄚ', t: 1 }, { e: '🐟', w: '魚', zy: 'ㄩ', t: 2 }, { e: '🐶', w: '狗', zy: 'ㄍㄡ', t: 3 }, { e: '🐰', w: '兔', zy: 'ㄊㄨ', t: 4 },
  { e: '🐱', w: '貓', zy: 'ㄇㄠ', t: 1 }, { e: '🐑', w: '羊', zy: 'ㄧㄤ', t: 2 }, { e: '🐦', w: '鳥', zy: 'ㄋㄧㄠ', t: 3 }, { e: '🐘', w: '象', zy: 'ㄒㄧㄤ', t: 4 },
  { e: '📕', w: '書', zy: 'ㄕㄨ', t: 1 }, { e: '🐮', w: '牛', zy: 'ㄋㄧㄡ', t: 2 }, { e: '💧', w: '水', zy: 'ㄕㄨㄟ', t: 3 }, { e: '🌙', w: '月', zy: 'ㄩㄝ', t: 4 },
  { e: '⛰️', w: '山', zy: 'ㄕㄢ', t: 1 }, { e: '⚪', w: '白', zy: 'ㄅㄞ', t: 2 }, { e: '🍚', w: '米', zy: 'ㄇㄧ', t: 3 }, { e: '💪', w: '大', zy: 'ㄉㄚ', t: 4 },
  { e: '🪑', w: '桌子', hi: 1, zy: 'ㄗ', t: 0 }, { e: '👩', w: '媽媽', hi: 1, zy: 'ㄇㄚ', t: 0 }, { e: '🧑‍🤝‍🧑', w: '我們', hi: 1, zy: 'ㄇㄣ', t: 0 },
];
const TONE_NAME = ['輕聲', '一聲', '二聲', '三聲', '四聲'], TONE_MARK = ['˙', '', 'ˊ', 'ˇ', 'ˋ'];
const TONE_HINT = ['輕輕短短地唸', '平平的，像飛機飛直直', '往上揚，像在問問題', '先下來再上去，彎彎的', '從高往下，像在生氣'];
const toneZy = (q) => (q.t === 0 ? `˙${q.zy}` : q.zy + TONE_MARK[q.t]);
const KG_TONES = {
  key: 'campus-tones-best', title: ['🔤 注音聲調大挑戰', '🔤 Zhuyin Tones'], label: ['🔤 注音聲調大挑戰…', '🔤 Zhuyin tones…'],
  bye: (n) => T(`🔤 下次再來找${n.name}練聲調！`, `🔤 Come back and practice tones with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, N = 6, qs = kgShuffle(TONE_ITEMS.slice()).slice(0, N);
    let i = 0, right = 0;
    const word = (q) => [...q.w].map((ch, k) => (q.w.length === 1 || k === q.hi ? `<b style="color:#d63a3a">${ch}</b>` : ch)).join('');
    const next = () => {
      const q = qs[i];
      ctx.prog(T(`第 ${i + 1} / ${N} 題`, `${i + 1} / ${N}`));
      ctx.stage.innerHTML = `<span class="big">${q.e}</span><div style="font-size:30px;font-weight:700;margin-top:4px">${word(q)}　<span style="color:#1f5f9a">${q.zy}</span><span style="color:#999">？</span></div>`;
      ctx.ask(q.w.length > 1 ? `「${q.w}」的「${q.w[q.hi]}」是第幾聲？` : `「${q.w}」是第幾聲？`);
      ctx.msg(i ? '' : T('唸唸看，聲音是平平的、往上的、彎彎的，還是往下的？', 'Say it out loud: flat, rising, dipping or falling?'));
      const order = [1, 2, 3, 4, 0];
      ctx.buttons(order.map((t, j) => ({ html: `${TONE_NAME[t]} ${t === 1 ? '（不標）' : TONE_MARK[t]}<small>${j + 1}</small>`, cls: 'opt', on: (el) => {
        ctx.btnEls.forEach((b) => (b.disabled = true));
        ctx.btnEls[order.indexOf(q.t)].className = 'opt right';
        const why = `「${q.w.length > 1 ? q.w[q.hi] : q.w}」唸 ${toneZy(q)}，是${TONE_NAME[q.t]}：${TONE_HINT[q.t]}。`;
        if (t === q.t) { right++; ctx.face('happy'); ctx.msg(`⭕ ${T('答對了！', 'Correct! ')}${why}`, 'ok'); }
        else { el.className = 'opt wrong'; ctx.face('surprised', 1); ctx.msg(`❌ ${why}`, 'no'); }
        ctx.later(() => (++i < N ? next() : ctx.end(right, (b) => `${T(`🔤 答對 ${right} / ${N} 題（最好紀錄 ${b} 題）`, `🔤 ${right} / ${N} correct (best ${b})`)}<br>${n.name}：${right >= 5 ? '聲調唸得好準！點亮童心，我們一起前進！' : '慢慢來，老師用耐心陪你，多唸幾次就會了！'}`)), 2600);
      } })));
    };
    next();
  },
};

/* ---- 四位數的加減法（黃老師，三年一班）：每回隨機出 6 題（加法 3 題、減法 3 題，其中 2 題是應用題），
   一定有進位或退位；錯的選項是「忘了進位／退位」「大減小倒過來減」這些常見的算錯 ---- */
const ADD4_STORY = {
  add: [(a, b) => `圖書館原本有 ${a} 本書，又買了 ${b} 本，現在一共有幾本？`, (a, b) => `早上賣出 ${a} 張票，下午賣出 ${b} 張票，一天賣出幾張？`],
  sub: [(a, b) => `存錢筒有 ${a} 元，買文具花了 ${b} 元，還剩下幾元？`, (a, b) => `一條路長 ${a} 公尺，已經走了 ${b} 公尺，還要走幾公尺？`],
};
const add4Gen = (op) => {
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const dig = (x) => [...String(x).padStart(4, '0')].map(Number);
  for (;;) {
    let a, b, ans, slip;
    if (op === 'add') {
      a = rnd(1000, 8000); b = rnd(1000, 9999 - a); ans = a + b;
      const A = dig(a), B = dig(b);
      if (!A.some((d, k) => d + B[k] >= 10)) continue;                               // 要有進位
      slip = Number(A.map((d, k) => (d + B[k]) % 10).join(''));                          // 忘了進位
    } else {
      a = rnd(2000, 9999); b = rnd(1000, a - 1); ans = a - b;
      const A = dig(a), B = dig(b);
      if (!A.some((d, k) => d < B[k])) continue;                                         // 要有退位
      slip = Number(A.map((d, k) => Math.abs(d - B[k])).join(''));                        // 不夠減就倒過來大減小
    }
    const opts = [ans], add = (x) => { if (x > 0 && x <= 9999 && !opts.includes(x)) opts.push(x); };
    add(slip);
    for (const d of kgShuffle([10, -10, 100, -100, 1000, -1000])) { if (opts.length >= 3) break; add(ans + d); }
    if (opts.length < 3) continue;
    return { a, b, op, ans, opts };
  }
};
const KG_ADD4 = {
  key: 'campus-add4-best', title: ['➕ 四位數的加減法', '➕ 4-Digit Add & Subtract'], label: ['➕ 四位數的加減法…', '➕ 4-digit math…'],
  bye: (n) => T(`➕ 下次再來找${n.name}算數學！`, `➕ Come back and do math with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, N = 6;
    const story = kgShuffle([0, 1, 2, 3, 4, 5]).slice(0, 2);
    const qs = kgShuffle(['add', 'add', 'add', 'sub', 'sub', 'sub']).map((op, k) => ({ ...add4Gen(op), story: story.includes(k) }));
    let i = 0, right = 0;
    const sign = (q) => (q.op === 'add' ? '＋' : '－');
    const next = () => {
      const q = qs[i], col = (x) => String(x).padStart(4, ' ').replace(/ /g, '&nbsp;');
      ctx.prog(T(`第 ${i + 1} / ${N} 題`, `${i + 1} / ${N}`));
      ctx.stage.innerHTML = `${q.story ? `<div style="font-size:16px;margin-bottom:6px">${ADD4_STORY[q.op][Math.floor(Math.random() * 2)](q.a, q.b)}</div>` : ''}`
        + `<div style="display:inline-block;font:700 30px/1.25 ui-monospace,Consolas,monospace;text-align:right;letter-spacing:4px">`
        + `${col(q.a)}<br><span style="color:#1f5f9a">${sign(q)}</span>${col(q.b)}<div style="border-top:3px solid #2b2b2b;margin-top:2px">？</div></div>`;
      ctx.ask(T(`${q.a} ${sign(q)} ${q.b} ＝ ？`, `${q.a} ${q.op === 'add' ? '+' : '-'} ${q.b} = ?`));
      ctx.msg(i ? '' : T('從個位開始，一位一位對齊來算！', 'Line up the digits and start from the ones place!'));
      const opts = kgShuffle(q.opts.slice());
      ctx.buttons(opts.map((v, j) => ({ html: `${v}<small>${j + 1}</small>`, cls: 'opt', on: (el) => {
        ctx.btnEls.forEach((b) => (b.disabled = true));
        ctx.btnEls[opts.indexOf(q.ans)].className = 'opt right';
        const why = q.op === 'add'
          ? `${q.a} ＋ ${q.b} ＝ ${q.ans}。滿十要進位到前一位，可以用 ${q.ans} － ${q.b} ＝ ${q.a} 驗算。`
          : `${q.a} － ${q.b} ＝ ${q.ans}。不夠減要向前一位借 1 當 10，可以用 ${q.ans} ＋ ${q.b} ＝ ${q.a} 驗算。`;
        if (v === q.ans) { right++; ctx.face('happy'); ctx.msg(`⭕ ${T('答對了！', 'Correct! ')}${why}`, 'ok'); }
        else { el.className = 'opt wrong'; ctx.face('surprised', 1); ctx.msg(`❌ ${why}`, 'no'); }
        ctx.later(() => (++i < N ? next() : ctx.end(right, (b) => `${T(`➕ 答對 ${right} / ${N} 題（最好紀錄 ${b} 題）`, `➕ ${right} / ${N} correct (best ${b})`)}<br>${n.name}：${right >= 5 ? '好專心、好細心！你是加減法高手！' : '有耐心再算一次，記得驗算就會越來越準！'}`)), 3000);
      } })));
    };
    next();
  },
};

/* ---- 周長和面積（李老師，五年二班）：六種圖形各一題，數字隨機、周長和面積各半，一回 6 題；圖是示意、不照比例。
   三角形、梯形、平行四邊形的邊長用 3-4-5 的倍數，斜邊和高才會是整數；錯的選項是「忘了除以 2」「拿斜邊當高」這些常見的算錯 ---- */
const PERIM_NUM = (x) => String(Number(x.toFixed(2)));
const perimSvg = (body) => `<svg viewBox="0 0 220 120" width="220" height="120" font-size="13" font-weight="700" fill="#333" text-anchor="middle">${body}</svg>`;
const PERIM_SHAPE = 'fill="#cfe6f7" stroke="#1f5f9a" stroke-width="3" stroke-linejoin="round"';
const PERIM_DASH = 'stroke="#d63a3a" stroke-width="2" stroke-dasharray="5 4"';
const PERIM_GEN = {
  square() {
    const s = 4 + (Math.random() * 12 | 0);
    return { name: '正方形', svg: perimSvg(`<rect x="65" y="15" width="90" height="90" ${PERIM_SHAPE}/><text x="110" y="65">邊長 ${s}</text>`),
      p: 4 * s, a: s * s, pw: [s * s, 2 * s], aw: [4 * s, 2 * s], pf: `邊長 × 4 ＝ ${s} × 4`, af: `邊長 × 邊長 ＝ ${s} × ${s}` };
  },
  rect() {
    const a = 7 + (Math.random() * 9 | 0), b = 3 + (Math.random() * 4 | 0);
    return { name: '長方形', svg: perimSvg(`<rect x="35" y="25" width="150" height="70" ${PERIM_SHAPE}/><text x="110" y="18">長 ${a}</text><text x="110" y="65">寬 ${b}</text>`),
      p: 2 * (a + b), a: a * b, pw: [a * b, a + b], aw: [2 * (a + b), a + b], pf: `（長 ＋ 寬）× 2 ＝（${a} ＋ ${b}）× 2`, af: `長 × 寬 ＝ ${a} × ${b}` };
  },
  tri() {
    const k = 1 + (Math.random() * 3 | 0), b = 6 * k, s = 5 * k, h = 4 * k;
    return { name: '三角形', svg: perimSvg(`<polygon points="110,12 35,100 185,100" ${PERIM_SHAPE}/><line x1="110" y1="12" x2="110" y2="100" ${PERIM_DASH}/><text x="124" y="66" fill="#d63a3a">高 ${h}</text><text x="110" y="116">底 ${b}</text><text x="48" y="52">邊 ${s}</text><text x="172" y="52">邊 ${s}</text>`),
      p: b + 2 * s, a: b * h / 2, pw: [b + s, b + 2 * h], aw: [b * h, b + h], pf: `三個邊加起來 ＝ ${b} ＋ ${s} ＋ ${s}`, af: `底 × 高 ÷ 2 ＝ ${b} × ${h} ÷ 2` };
  },
  trap() {
    const k = 1 + (Math.random() * 2 | 0), t = 2 * (1 + (Math.random() * 4 | 0)), b = t + 6 * k, s = 5 * k, h = 4 * k;
    return { name: '梯形', svg: perimSvg(`<polygon points="75,20 145,20 190,100 30,100" ${PERIM_SHAPE}/><line x1="110" y1="20" x2="110" y2="100" ${PERIM_DASH}/><text x="124" y="66" fill="#d63a3a">高 ${h}</text><text x="110" y="14">上底 ${t}</text><text x="110" y="116">下底 ${b}</text><text x="34" y="60">腰 ${s}</text><text x="186" y="60">腰 ${s}</text>`),
      p: t + b + 2 * s, a: (t + b) * h / 2, pw: [t + b + 2 * h, t + b + s], aw: [(t + b) * h, t * h], pf: `四個邊加起來 ＝ ${t} ＋ ${b} ＋ ${s} ＋ ${s}`, af: `（上底 ＋ 下底）× 高 ÷ 2 ＝（${t} ＋ ${b}）× ${h} ÷ 2` };
  },
  para() {
    const k = 1 + (Math.random() * 2 | 0), b = 6 + (Math.random() * 10 | 0), s = 5 * k, h = 4 * k;
    return { name: '平行四邊形', svg: perimSvg(`<polygon points="70,20 195,20 150,100 25,100" ${PERIM_SHAPE}/><line x1="110" y1="20" x2="110" y2="100" ${PERIM_DASH}/><text x="124" y="66" fill="#d63a3a">高 ${h}</text><text x="88" y="116">底 ${b}</text><text x="28" y="56">邊 ${s}</text>`),
      p: 2 * (b + s), a: b * h, pw: [2 * (b + h), b + s], aw: [b * s, b * h / 2], pf: `（底 ＋ 斜邊）× 2 ＝（${b} ＋ ${s}）× 2`, af: `底 × 高 ＝ ${b} × ${h}（是高，不是斜邊喔）` };
  },
  circle() {
    const r = [3, 4, 5, 6, 10][Math.random() * 5 | 0];
    return { name: '圓形', svg: perimSvg(`<circle cx="110" cy="60" r="48" ${PERIM_SHAPE}/><line x1="110" y1="60" x2="158" y2="60" ${PERIM_DASH}/><text x="134" y="52" fill="#d63a3a">半徑 ${r}</text>`),
      p: 2 * r * 3.14, a: r * r * 3.14, pw: [r * 3.14, r * r * 3.14], aw: [2 * r * 3.14, 4 * r * r * 3.14], pf: `直徑 × 圓周率 ＝ ${2 * r} × 3.14`, af: `半徑 × 半徑 × 圓周率 ＝ ${r} × ${r} × 3.14`, pi: true };
  },
};
const KG_PERIM = {
  key: 'campus-perim-best', title: ['📐 周長和面積', '📐 Perimeter & Area'], label: ['📐 周長和面積…', '📐 Perimeter & area…'],
  bye: (n) => T(`📐 下次再來找${n.name}算周長和面積！`, `📐 Come back and practice with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, kinds = kgShuffle(Object.keys(PERIM_GEN)), N = kinds.length;
    const asks = kgShuffle(['p', 'p', 'p', 'a', 'a', 'a']);
    let i = 0, right = 0;
    const next = () => {
      const q = PERIM_GEN[kinds[i]](), isP = asks[i] === 'p', word = isP ? '周長' : '面積', unit = isP ? '公分' : '平方公分', ansV = isP ? q.p : q.a;
      const opts = [ansV];
      for (const w of [...(isP ? q.pw : q.aw), ansV + (q.pi ? 3.14 : 2), ansV + (q.pi ? 6.28 : 4)]) if (opts.length < 3 && w > 0 && !opts.some((v) => Math.abs(v - w) < 0.001)) opts.push(w);
      kgShuffle(opts);
      ctx.prog(T(`第 ${i + 1} / ${N} 題`, `${i + 1} / ${N}`));
      ctx.stage.innerHTML = q.svg;
      ctx.ask(`這個${q.name}的${word}是多少？（單位：公分${q.pi ? '，圓周率用 3.14' : ''}）`);
      ctx.msg(i ? '' : T('周長是繞一圈的長度，面積是裡面有多大。圖只是示意，要看標的數字喔！', 'Perimeter goes around; area fills the inside. Read the numbers!'));
      ctx.buttons(opts.map((v, j) => ({ html: `${PERIM_NUM(v)} ${unit}<small>${j + 1}</small>`, cls: 'opt', on: (el) => {
        ctx.btnEls.forEach((b) => (b.disabled = true));
        ctx.btnEls[opts.indexOf(ansV)].className = 'opt right';
        const why = `${word} ＝ ${isP ? q.pf : q.af} ＝ ${PERIM_NUM(ansV)} ${unit}。`;
        if (v === ansV) { right++; ctx.face('happy'); ctx.msg(`⭕ ${T('答對了！', 'Correct! ')}${why}`, 'ok'); }
        else { el.className = 'opt wrong'; ctx.face('surprised', 1); ctx.msg(`❌ ${why}`, 'no'); }
        ctx.later(() => (++i < N ? next() : ctx.end(right, (b) => `${T(`📐 答對 ${right} / ${N} 題（最好紀錄 ${b} 題）`, `📐 ${right} / ${N} correct (best ${b})`)}<br>${n.name}：${right >= 5 ? '太厲害了，連老師都要跟你學！' : '沒關係，老師也是一步一步學的，我們再練一次！'}`)), 3200);
      } })));
    };
    next();
  },
};

/* ---- 紙編織杯墊（方老師）：照著左邊的範本，點右邊的格子翻面（直條在上／橫條在上），編完 3 個杯墊。
   不會失敗，多翻幾次也編得出來；全部編完看多翻了幾次給星星（4 次以內 3 顆、10 次以內 2 顆、其他 1 顆） ---- */
const WEAVE_PATTERNS = [
  ['平紋', '10101/01010/10101/01010/10101'], ['斜紋', '11001/01100/00110/10011/11001'], ['菱形', '00100/01110/11111/01110/00100'],
  ['叉叉', '10001/01010/00100/01010/10001'], ['回字', '11111/10001/10101/10001/11111'], ['條紋', '11111/00000/11111/00000/11111'],
];
const WEAVE_COLS = [['#e8505b', '#fbe3a0'], ['#2f7fc1', '#f6efe0'], ['#3f9a5a', '#f6d44c'], ['#8a5ac0', '#f3c6d8']];
const weaveCell = (on, col, px) => `width:${px}px;height:${px}px;padding:0;border:0;border-radius:0;background:${on
  ? `linear-gradient(90deg,${col[0]} 12%,rgba(255,255,255,.25) 50%,${col[0]} 88%),${col[0]}`
  : `linear-gradient(0deg,${col[1]} 12%,rgba(0,0,0,.12) 50%,${col[1]} 88%),${col[1]}`};box-shadow:inset 0 0 0 1px rgba(0,0,0,.28)`;
const KG_WEAVE = {
  key: 'campus-weave-best', title: ['🧵 紙編織杯墊', '🧵 Paper Weaving'], label: ['🧵 編紙杯墊…', '🧵 Weaving…'],
  bye: (n) => T(`🧵 下次再來找${n.name}編杯墊！`, `🧵 Come back and weave with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, N = 3, pats = kgShuffle(WEAVE_PATTERNS.slice()).slice(0, N), cols = kgShuffle(WEAVE_COLS.slice());
    let i = 0, extra = 0;
    const next = () => {
      const [pname, str] = pats[i], want = str.split('/').map((r) => [...r].map((c) => c === '1')), col = cols[i];
      const mine = want.map((r) => r.map(() => false));
      const need = want.flat().filter(Boolean).length;
      let clicks = 0;
      const grid = (px) => { const g = document.createElement('div'); g.style.cssText = `display:grid;grid-template-columns:repeat(5,${px}px);border:3px solid #6b4a2a;border-radius:4px`; return g; };
      const sample = grid(20); want.flat().forEach((v) => { const d = document.createElement('div'); d.style.cssText = weaveCell(v, col, 20); sample.appendChild(d); });
      const board = grid(36);
      const check = () => want.every((r, y) => r.every((v, x) => v === mine[y][x]));
      mine.forEach((r, y) => r.forEach((_, x) => {
        const b = document.createElement('button'); b.style.cssText = weaveCell(false, col, 36) + ';cursor:pointer';
        b.onclick = () => {
          if (check()) return;
          mine[y][x] = !mine[y][x]; b.style.cssText = weaveCell(mine[y][x], col, 36) + ';cursor:pointer'; clicks++;
          if (!check()) return;
          extra += Math.max(0, clicks - need); ctx.face('happy');
          ctx.msg(`⭕ ${T(`${pname}杯墊編好了！`, 'Mat finished!')}`, 'ok');
          ctx.later(() => {
            if (++i < N) return next();
            const stars = extra <= 4 ? 3 : extra <= 10 ? 2 : 1;
            ctx.end(stars, (bst) => `${T(`🧵 編好 ${N} 個杯墊，得到 ${'⭐'.repeat(stars)}（最好紀錄 ${bst} 顆星）`, `🧵 ${N} mats woven: ${stars} star(s) (best ${bst})`)}<br>${n.name}：每一個都是獨一無二的作品，你好棒！`);
          }, 1500);
        };
        board.appendChild(b);
      }));
      const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:14px;align-items:center;justify-content:center';
      const lab = (txt, el) => { const d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:12px;color:#666'; d.textContent = txt; d.appendChild(el); return d; };
      wrap.append(lab('範本', sample), lab('我的杯墊', board));
      ctx.stage.innerHTML = ''; ctx.stage.appendChild(wrap);
      ctx.prog(T(`第 ${i + 1} / ${N} 個杯墊`, `Mat ${i + 1} / ${N}`));
      ctx.ask(`照著範本編「${pname}」杯墊：點格子把紙條翻面！`);
      ctx.msg(i ? '' : T('編錯沒關係，再點一次就翻回來了。', 'Made a mistake? Click again to flip it back.'));
      ctx.buttons([]);
    };
    next();
  },
};

/* ---- 圍棋入門（吳老師，六年五班）：先一步一步教「氣」和「吃子」，再用 7 路小棋盤下吃子棋，先吃到 3 顆就贏。
   真正的圍棋是比誰圍的地多，吃子棋是初學者常用的入門玩法；吃到顆數就結束，所以不用處理打劫 ---- */
const goNeighbors = (x, y, N) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N);
const goGroup = (bd, x, y) => {      // 連在一起的整塊棋和它的氣
  const N = bd.length, c = bd[y][x], seen = new Set([`${x},${y}`]), stones = [[x, y]], libs = new Set();
  for (let i = 0; i < stones.length; i++) for (const [a, b] of goNeighbors(stones[i][0], stones[i][1], N)) {
    if (!bd[b][a]) libs.add(`${a},${b}`);
    else if (bd[b][a] === c && !seen.has(`${a},${b}`)) { seen.add(`${a},${b}`); stones.push([a, b]); }
  }
  return { stones, libs };
};
// 試下一步：回傳新棋盤和吃掉幾顆；沒有氣又吃不到子（自殺）就回傳 null
const goPlay = (bd, x, y, c) => {
  if (bd[y][x]) return null;
  const nb = bd.map((r) => r.slice()), N = bd.length, foe = c === 'X' ? 'O' : 'X';
  nb[y][x] = c;
  let took = 0;
  for (const [a, b] of goNeighbors(x, y, N)) {
    if (nb[b][a] !== foe) continue;
    const g = goGroup(nb, a, b);
    if (!g.libs.size) { g.stones.forEach(([u, v]) => { nb[v][u] = ''; }); took += g.stones.length; }
  }
  if (!goGroup(nb, x, y).libs.size) return null;
  return { bd: nb, took };
};
const goSvg = (bd, { marks = [], last = null } = {}) => {
  const N = bd.length, size = 238, cell = size / N, at = (i) => cell * (i + 0.5);
  let h = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#e3b76a;border-radius:6px;display:block;cursor:pointer">`;
  for (let i = 0; i < N; i++) h += `<line x1="${at(0)}" y1="${at(i)}" x2="${at(N - 1)}" y2="${at(i)}" stroke="#5a3a18" stroke-width="1.5"/><line x1="${at(i)}" y1="${at(0)}" x2="${at(i)}" y2="${at(N - 1)}" stroke="#5a3a18" stroke-width="1.5"/>`;
  const r = cell * 0.43;
  bd.forEach((row, y) => row.forEach((c, x) => {
    if (c) h += `<circle cx="${at(x)}" cy="${at(y)}" r="${r}" fill="${c === 'X' ? '#222' : '#f8f8f4'}" stroke="${c === 'X' ? '#000' : '#888'}" stroke-width="1.5"/>`;
  }));
  // 記號：green 氣、red 不能下、ring 被叫吃
  for (const [x, y, kind] of marks) {
    if (kind === 'green') h += `<circle cx="${at(x)}" cy="${at(y)}" r="${cell * 0.2}" fill="#3fbf5a" stroke="#176b2c" stroke-width="1.5"/>`;
    else if (kind === 'ring') h += `<circle cx="${at(x)}" cy="${at(y)}" r="${r}" fill="none" stroke="#e8352a" stroke-width="3"/>`;
    else h += `<path d="M${at(x) - cell * 0.2} ${at(y) - cell * 0.2}L${at(x) + cell * 0.2} ${at(y) + cell * 0.2}M${at(x) + cell * 0.2} ${at(y) - cell * 0.2}L${at(x) - cell * 0.2} ${at(y) + cell * 0.2}" stroke="#e8352a" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (last) h += `<circle cx="${at(last[0])}" cy="${at(last[1])}" r="${cell * 0.12}" fill="${bd[last[1]][last[0]] === 'X' ? '#fff' : '#222'}"/>`;
  bd.forEach((row, y) => row.forEach((_, x) => { h += `<rect data-x="${x}" data-y="${y}" x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="transparent"/>`; }));
  return h + '</svg>';
};
const goBoard = (rows) => rows.map((r) => [...r].map((c) => (c === '.' ? '' : c)));
const GO_LESSONS = [
  { ask: '第一步：棋子下在哪裡？', msg: '圍棋黑棋先下，兩個人輪流下。棋子要下在線和線的交叉點上，不是格子裡面，下了就不能移動。點棋盤任何一個交叉點試試看！', rows: ['.....', '.....', '.....', '.....', '.....'], any: true, done: '對了，下在交叉點上！' },
  { ask: '什麼是「氣」？', msg: '棋子上下左右相鄰的空點就是它的「氣」，斜的不算。綠點就是這顆白棋的氣，在中間有 4 口氣。', rows: ['.....', '.....', '..O..', '.....', '.....'], marks: [[2, 1, 'green'], [2, 3, 'green'], [1, 2, 'green'], [3, 2, 'green']] },
  { ask: '在邊邊和角落，氣比較少', msg: '上面那顆白棋靠邊，只有 3 口氣；左下角那顆只有 2 口氣。所以棋子在角落比較容易被吃掉。', rows: ['..O..', '.....', '.....', '.....', 'O....'], marks: [[1, 0, 'green'], [3, 0, 'green'], [2, 1, 'green'], [0, 3, 'green'], [1, 4, 'green']] },
  { ask: '吃子：把氣全部堵住！', msg: '棋子的氣全部被堵住，就會被吃掉、拿出棋盤。這顆白棋只剩一口氣了，點那個位置把它吃掉！', rows: ['.....', '..X..', '.XO..', '..X..', '.....'], target: [3, 2], done: '吃到了！白棋沒有氣，就被拿走了。' },
  { ask: '角落的棋更好吃', msg: '角落的白棋只剩一口氣。找找看，要下在哪裡才吃得到？', rows: ['OX...', '.....', '.....', '.....', '.....'], target: [0, 1], done: '沒錯！角落只要兩顆就能把它圍住。' },
  { ask: '連在一起的棋，氣是一起算的', msg: '兩顆白棋連在一起是一家人，要把整塊的氣都堵住才吃得掉。它們只剩一口氣了，一次吃兩顆！', rows: ['.....', '.XX..', 'XOO..', '.XX..', '.....'], target: [3, 2], done: '太棒了，一次吃掉兩顆！' },
  { ask: '被「叫吃」了，快逃！', msg: '只剩一口氣的棋叫「被叫吃」。你的黑棋快被吃掉了！往那口氣的方向接一顆棋出去，氣就變多了。', rows: ['.....', '..O..', '.OXO.', '.....', '.....'], target: [2, 3], done: '逃出來了！兩顆黑棋連起來，現在有 3 口氣。' },
  { ask: '不能下的地方', msg: '紅叉的位置四周都被白棋堵住，下去馬上沒有氣，所以不能下。不過，如果下去可以吃掉對方的棋，就可以下。', rows: ['.O...', 'O....', '.....', '.....', '.....'], marks: [[0, 0, 'x']] },
];
const KG_GO = {
  key: 'campus-go-wins', title: ['⚫ 圍棋入門', '⚫ Intro to Go'], label: ['⚫ 學圍棋中…', '⚫ Learning Go…'],
  bye: (n) => T(`⚫ 下次再來找${n.name}下圍棋！`, `⚫ Come back for Go with ${n.name}!`),
  start(ctx) {
    const n = ctx.n, GOAL = 3;
    const show = (bd, opt, onPick) => {
      ctx.stage.innerHTML = goSvg(bd, opt);
      ctx.stage.firstChild.onclick = (e) => { const d = e.target.dataset; if (d?.x !== undefined) onPick(+d.x, +d.y); };
    };
    const lesson = (i) => {
      if (i >= GO_LESSONS.length) return game();
      const L = GO_LESSONS[i], bd = goBoard(L.rows), go = () => lesson(i + 1);
      ctx.prog(T(`教學 ${i + 1} / ${GO_LESSONS.length}`, `Lesson ${i + 1} / ${GO_LESSONS.length}`));
      ctx.ask(L.ask); ctx.msg(L.msg);
      const nextBtn = () => ctx.buttons([{ html: i + 1 < GO_LESSONS.length ? '下一步' : '開始下棋！', cls: 'wide', on: go }]);
      if (!L.any && !L.target) { show(bd, { marks: L.marks }, () => {}); return nextBtn(); }
      ctx.buttons([]);
      let solved = false;
      show(bd, { marks: L.marks }, (x, y) => {
        if (solved) return;
        if (L.target && (x !== L.target[0] || y !== L.target[1])) { ctx.face('surprised', 1); return ctx.msg(`不是這裡喔，再找找看！${L.msg}`, 'no'); }
        const r = goPlay(bd, x, y, 'X');
        if (!r) return;
        solved = true; ctx.face('happy');
        ctx.stage.innerHTML = goSvg(r.bd, { last: [x, y] }); ctx.msg(`⭕ ${L.done}`, 'ok'); nextBtn();
      });
    };
    const game = () => {
      const N = 7;
      let bd = Array.from({ length: N }, () => Array(N).fill('')), mine = 0, foe = 0, last = null, busy = false, over = false;
      const moves = (b, c) => { const out = []; b.forEach((row, y) => row.forEach((_, x) => { const r = goPlay(b, x, y, c); if (r) out.push({ x, y, ...r }); })); return out; };
      const atari = (b, c) => { const hit = []; b.forEach((row, y) => row.forEach((v, x) => { if (v === c && goGroup(b, x, y).libs.size === 1) hit.push([x, y]); })); return hit; };
      const draw = () => {
        const rings = [...atari(bd, 'X'), ...atari(bd, 'O')].map(([x, y]) => [x, y, 'ring']);
        show(bd, { marks: rings, last }, pick);
        ctx.prog(T(`你吃 ${mine} 顆・老師吃 ${foe} 顆（先吃到 ${GOAL} 顆贏）`, `You ${mine} · Teacher ${foe} (first to ${GOAL})`));
      };
      const finish = (txt, won) => {
        over = true; draw(); ctx.face(won ? 'surprised' : 'happy', 2);
        ctx.later(() => ctx.end(won ? ctx.best + 1 : 0, (b) => `${txt}（贏老師 ${b} 次）<br>${n.name}：${won ? '好厲害！你已經會看氣了！' : '沒關係，多看幾次「氣」就會越來越強！'}`), 1200);
      };
      const noMove = () => finish(mine === foe ? '⚫ 棋盤下滿了，平手！' : mine > foe ? '⚫ 棋盤下滿了，你吃得比較多，你贏了！' : '⚫ 棋盤下滿了，老師吃得比較多。', mine > foe);
      // 老師：能吃就吃、自己被叫吃就逃、再來才叫吃對方；偶爾會看漏，小朋友才有機會贏
      const teacher = () => {
        const list = moves(bd, 'O');
        if (!list.length) return noMove();
        const sloppy = Math.random() < 0.3, mineAtari = atari(bd, 'O').length;
        let bestM = null, bestS = -Infinity;
        for (const m of list) {
          const libs = goGroup(m.bd, m.x, m.y).libs.size;
          let sc = Math.random() * 4 + (goNeighbors(m.x, m.y, N).length === 4 ? 2 : 0);
          if (goNeighbors(m.x, m.y, N).some(([a, b]) => bd[b][a] === 'X')) sc += 3;
          if (libs === 1 && !m.took) sc -= 30;
          if (!sloppy) {
            if (m.took) sc += 100 + m.took;
            if (mineAtari && atari(m.bd, 'O').length < mineAtari) sc += 50;
            if (libs >= 2 && atari(m.bd, 'X').length > atari(bd, 'X').length) sc += 20;
          }
          if (sc > bestS) { bestS = sc; bestM = m; }
        }
        bd = bestM.bd; foe += bestM.took; last = [bestM.x, bestM.y]; busy = false;
        if (foe >= GOAL) { ctx.msg(`老師吃到 ${GOAL} 顆了！`, 'no'); return finish(`⚫ 這盤老師贏了（你吃 ${mine} 顆）`, false); }
        draw();
        if (!moves(bd, 'X').length) return noMove();
        ctx.msg(bestM.took ? `老師吃掉你 ${bestM.took} 顆！` : atari(bd, 'X').length ? '紅圈的黑棋被叫吃了，快救它！' : atari(bd, 'O').length ? '紅圈的白棋只剩一口氣，吃掉它！' : '換你下。', bestM.took || atari(bd, 'X').length ? 'no' : 'ok');
      };
      function pick(x, y) {
        if (busy || over) return;
        if (bd[y][x]) return ctx.msg('這裡已經有棋子了。', 'no');
        const r = goPlay(bd, x, y, 'X');
        if (!r) return ctx.msg('這裡下去會沒有氣，不能下喔！', 'no');
        bd = r.bd; mine += r.took; last = [x, y];
        if (r.took) ctx.face('surprised', 1);
        if (mine >= GOAL) { ctx.msg(`你吃到 ${GOAL} 顆了！`, 'ok'); return finish(`⚫ 你贏了！吃到 ${mine} 顆（老師吃 ${foe} 顆）`, true); }
        busy = true; draw(); ctx.msg(r.took ? `⭕ 吃掉 ${r.took} 顆！老師想想…` : '老師想想…', r.took ? 'ok' : '');
        ctx.later(teacher, 700);
      }
      ctx.ask('吃子棋：你下黑棋，先吃到 3 顆就贏！');
      ctx.msg('紅圈代表那塊棋只剩一口氣。');
      ctx.buttons([{ html: '再看一次教學', cls: 'wide', on: () => lesson(0) }]);
      draw();
    };
    ctx.prog('');
    ctx.ask('圍棋入門：吃子棋');
    ctx.msg('真正的圍棋是比誰圍的地比較大，初學者通常先從「吃子」開始學。沒下過的話，先看教學喔！');
    ctx.stage.innerHTML = '<span class="big">⚫⚪</span>';
    ctx.buttons([{ html: '先看教學', cls: 'wide', on: () => lesson(0) }, { html: '直接下棋', cls: 'wide', on: game }]);
  },
};

/* ---- 剪紙猜一猜（陳主任，輔導室）：紙對摺後剪掉幾格，猜打開以後是哪一張（正確的是沿摺線左右對稱），一回 6 題。
   另外兩個選項：右半邊沒有鏡射、整張上下顛倒 ---- */
const cutSvg = (cells, w, cellPx, fold) => {
  const h = cells.length;
  let s = `<svg viewBox="0 0 ${w * cellPx} ${h * cellPx}" width="${w * cellPx}" height="${h * cellPx}"><rect width="${w * cellPx}" height="${h * cellPx}" fill="#d6333f"/>`;
  cells.forEach((r, y) => r.forEach((v, x) => { if (v) s += `<rect x="${x * cellPx}" y="${y * cellPx}" width="${cellPx}" height="${cellPx}" fill="#fffdf6"/>`; }));
  s += `<rect x="1" y="1" width="${w * cellPx - 2}" height="${h * cellPx - 2}" fill="none" stroke="#8a1c25" stroke-width="2"/>`;   // 紙的外框：剪到邊邊時才看得出紙的形狀
  if (fold) s += `<line x1="${w * cellPx - 1}" y1="0" x2="${w * cellPx - 1}" y2="${h * cellPx}" stroke="#222" stroke-width="2" stroke-dasharray="5 4"/>`;
  return s + '</svg>';
};
const cutRound = () => {
  const W = 3, H = 5;
  for (;;) {
    const half = Array.from({ length: H }, () => Array.from({ length: W }, () => Math.random() < 0.38));
    const good = half.map((r) => [...r, ...[...r].reverse()]);
    const noMirror = half.map((r) => [...r, ...r]);
    const upside = [...good].reverse();
    const key = (g) => g.map((r) => r.map(Number).join('')).join('/');
    if (new Set([key(good), key(noMirror), key(upside)]).size < 3) continue;
    const holes = half.flat().filter(Boolean).length;
    if (holes < 4 || holes > 9) continue;
    return { half, good, noMirror, upside };
  }
};
const KG_CUT = {
  key: 'campus-cut-best', title: ['✂️ 剪紙猜一猜', '✂️ Paper Cutting'], label: ['✂️ 剪紙猜一猜…', '✂️ Paper cutting…'],
  bye: (n) => T(`✂️ 你很棒唷！下次再來找${n.name}剪紙！`, `✂️ Great job! Come back to ${n.name} for more!`),
  start(ctx) {
    const n = ctx.n, N = 6;
    let i = 0, right = 0;
    const next = () => {
      const q = cutRound(), opts = kgShuffle([q.good, q.noMirror, q.upside]);
      ctx.prog(T(`第 ${i + 1} / ${N} 題`, `${i + 1} / ${N}`));
      ctx.stage.innerHTML = `<div style="text-align:center;font-size:12px;color:#666">虛線是摺線，白色是剪掉的地方<br>${cutSvg(q.half, 3, 14, true)}</div>`;
      ctx.ask('沿著虛線打開以後，會是哪一張？');
      ctx.msg('');
      ctx.buttons(opts.map((g, j) => ({ html: `${cutSvg(g, 6, 12, false)}<small>${j + 1}</small>`, on: (el) => {
        ctx.btnEls.forEach((b) => (b.disabled = true));
        ctx.btnEls[opts.indexOf(q.good)].classList.add('right');
        if (g === q.good) { right++; ctx.face('happy'); ctx.msg(`⭕ ${T('答對了！你很棒唷！摺線兩邊就像照鏡子一樣。', 'Correct! Both sides mirror each other.')}`, 'ok'); }
        else { el.classList.add('wrong'); ctx.face('surprised', 1); ctx.msg(`❌ ${T('加加油！摺線兩邊會像照鏡子一樣，上面和下面的位置不會變。', 'Keep going! Both sides mirror across the fold.')}`, 'no'); }
        ctx.later(() => (++i < N ? next() : ctx.end(right, (b) => `${T(`✂️ 答對 ${right} / ${N} 題（最好紀錄 ${b} 題）`, `✂️ ${right} / ${N} correct (best ${b})`)}<br>${n.name}：${right >= 5 ? '你很棒唷，繼續努力！' : '加加油，你一定可以的！'}`)), 2200);
      } })));
    };
    next();
  },
};

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  blindquiz: (s) => kgPlay(pseudoHost('溪口巴士', s), KG_BLIND), busquiz: (s) => kgPlay(pseudoHost('溪口巴士', s), KG_BUSQ), gymrun: (s) => kgPlay(pseudoHost('體操墊', s), KG_GYMRUN),
};
for (const kind of Object.keys(KG_GAMES)) play[kind] = (s) => kgPlay(s.npc, KG_GAMES[kind]);
