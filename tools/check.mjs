#!/usr/bin/env node
/* 全校自動檢查：推上去之前跑一次，不用任何模型、不用安裝套件（Node 22＋電腦裡的 Chrome 或 Edge）
 *
 *   node tools/check.mjs                 全部檢查（約幾分鐘）
 *   node tools/check.mjs --quick         只做不用開瀏覽器的檢查（語法、版本號、不該上傳的檔案）
 *   node tools/check.mjs --rooms 502,604 只掃這幾間（班級代號或房間名稱的一部分），改完一間教室時用
 *   node tools/check.mjs --all           不看已知清單，把目前所有問題都列出來
 *   node tools/check.mjs --update        把這次看到的結果存成「已知清單」（tools/check-baseline.json）
 *   node tools/check.mjs --live          推上去以後：等 GitHub Pages 真的換成本機這一版（最多等 6 分鐘）
 *
 * 檢查項目：
 *   1. 每個 .js 語法正確；全站 ?v= 版本號一致；site 裡沒有不該上傳的檔案（pdf、zip、_backup）
 *   2. 網站開得起來：沒有程式錯誤、沒有找不到的檔案
 *   3. 卡住掃描：每間房間每 10 公分放一個人，八個方向都走不出 30 公分的位置＝卡住；
 *      再從周圍實際走走看，走得進去、而且按方向鍵 4 秒還出不來（也沒被自動救出）的才算問題；
 *      走不進去的小縫不算（加 --gaps 可以列出來）
 *   4. 每扇門：從門外 1 公尺自動走進房間，進得了門（離門超過 1.2 公尺）才算過
 *      自動走路：從門口走到房間裡每隔 1.5 公尺的位置（找得到路卻走不到＝路線穿過比人窄的縫）
 *   5. 每位老師：站的位置算得出來、站在走得到的地板上、小遊戲有對應的檔案
 *
 * 「已知清單」：以前就有、確認過不影響的位置（走不進去的小縫等）。只有清單以外「新出現」的才算沒過。
 * 結束碼：0＝通過，1＝有新問題。 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'tools', 'check-baseline.json');
const LIVE_URL = 'https://upsky0210.github.io/xikou-3d-campus/';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const only = (argOf('--rooms') || '').split(',').map((s) => s.trim()).filter(Boolean);

const problems = [];                                  // 新問題（會讓檢查不通過）
const notes = [];                                     // 提醒（不影響結果）
const ok = (msg) => console.log('  ✔ ' + msg);
const bad = (msg) => { console.log('  ✘ ' + msg); problems.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const jsFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? jsFiles(p) : e.name.endsWith('.js') ? [p] : [];
});
const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');
const localVersion = () => +(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/\?v=(\d+)/) || [])[1];

/* ---------------- --live：等線上換成這一版 ---------------- */
async function waitLive() {
  const v = localVersion();
  console.log(`等 GitHub Pages 換成 ?v=${v} …`);
  for (let i = 0; i < 24; i++) {
    try {
      const html = await (await fetch(`${LIVE_URL}index.html?x=${Date.now()}`, { cache: 'no-store' })).text();
      const live = +(html.match(/\?v=(\d+)/) || [])[1];
      if (live === v) { console.log(`✔ 線上已經是 ?v=${v}`); return 0; }
      process.stdout.write(`  線上還是 ?v=${live}（${i * 15} 秒）\r`);
    } catch (e) { process.stdout.write(`  連不上（${e.message}）\r`); }
    await sleep(15000);
  }
  console.log(`\n✘ 等了 6 分鐘，線上還不是 ?v=${v}。GitHub 部署可能卡住或失敗：到 repo 的 Actions 頁面看，必要時再推一次。`);
  return 1;
}

/* ---------------- 1. 不用開瀏覽器的檢查 ---------------- */
function staticChecks() {
  console.log('\n【1】語法、版本號、檔案');
  const files = jsFiles(path.join(ROOT, 'js'));
  // 一般的 node --check 抓不到「多一個 }」，要當成模組從標準輸入讀
  const broken = files.filter((f) => f.indexOf(`${path.sep}vendor${path.sep}`) < 0).map((f) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f) });
    return r.status ? `${rel(f)}：${String(r.stderr).split('\n').filter((l) => /Error/.test(l))[0] || '語法錯誤'}` : null;
  }).filter(Boolean);
  broken.length ? broken.forEach((b) => bad('語法錯誤 ' + b)) : ok(`${files.length} 個 .js 語法正確`);

  const vers = new Map();
  for (const f of [path.join(ROOT, 'index.html'), path.join(ROOT, 'teacher.html'), ...files]) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\?v=(\d+)/g)) (vers.get(m[1]) || vers.set(m[1], new Set()).get(m[1])).add(rel(f));
  }
  if (vers.size === 1) ok(`版本號一致（?v=${[...vers.keys()][0]}）`);
  else bad('版本號不一致：' + [...vers].map(([v, s]) => `?v=${v}（${[...s].slice(0, 3).join('、')}${s.size > 3 ? '…' : ''}）`).join('；') + ' → 執行 node tools/bump-version.mjs');

  // 不可以上傳的東西（平面圖 PDF 有 IP/MAC、壓縮檔、備份）
  const g = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  const tracked = g.status === 0 ? g.stdout.split('\n').filter(Boolean) : [];
  const forbid = tracked.filter((f) => /\.(pdf|zip|7z|rar|skp)$/i.test(f) || /(^|\/)_backup(\/|$)/.test(f));
  forbid.length ? bad('這些檔案不應該在 site 裡：' + forbid.join('、')) : ok(`沒有不該上傳的檔案（共 ${tracked.length} 個檔案）`);
}

/* ---------------- 本機網站＋無畫面瀏覽器 ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
function findBrowser() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find((p) => p && fs.existsSync(p));
}
async function launch() {
  const exe = findBrowser();
  if (!exe) throw new Error('找不到 Chrome 或 Edge（可以用環境變數 CHROME_PATH 指定）');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-check-'));
  const proc = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--window-size=800,550', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsBase = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('瀏覽器沒有啟動')), 20000);
    proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
    proc.on('exit', () => reject(new Error('瀏覽器一啟動就關掉了')));
  });
  const port = new URL(wsBase).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('連不上瀏覽器')); });
  let id = 0; const waiting = new Map(), handlers = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { const [res, rej] = waiting.get(m.id); waiting.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) handlers.forEach((h) => h(m.method, m.params));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { waiting.set(++id, [res, rej]); ws.send(JSON.stringify({ id, method, params })); });
  // 在頁面裡執行一段程式，拿回結果（一律用 JSON 傳回來）
  const run = async (code) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${code} })().then((v) => JSON.stringify(v === undefined ? null : v))`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return JSON.parse(r.result.value);
  };
  const close = () => { try { ws.close(); } catch { /* 已經關了 */ } proc.kill(); setTimeout(() => fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }), 500).unref?.(); };
  return { send, run, on: (h) => handlers.push(h), close };
}

/* ---------------- 放進頁面裡跑的檢查程式 ---------------- */
const PAGE = String.raw`
window.__chk = (() => {
  const c = window.__campus, p = c.player;
  const rid = (r) => r.f.id + ' ' + (r.code ? r.code + ' ' : '') + (r.name || r.no || '（沒有名稱）');
  const r2 = (v) => Math.round(v * 100) / 100;
  // 3. 卡住掃描：能站的位置（地板可走、沒有卡在家具裡），往八個方向各走 0.4 公尺，最遠走不到 0.3 公尺＝卡住
  function stuckAt(x, z) {
    let far = 0;
    for (let b = 0; b < 8 && far < 0.3; b++) {
      p.x = x; p.z = z;
      const a = b / 8 * Math.PI * 2;
      for (let k = 0; k < 8; k++) c.tryMove(Math.cos(a) * 0.05, Math.sin(a) * 0.05);
      far = Math.max(far, Math.hypot(p.x - x, p.z - z));
    }
    return far < 0.3;
  }
  function traps(i) {
    const r = c.rooms[i], f = r.f, m = r.m, G = 0.1, pts = [];
    p.floor = f;
    for (let x = m.x1 + 0.25; x < m.x2 - 0.2; x += G) for (let z = m.z1 + 0.25; z < m.z2 - 0.2; z += G) {
      if (!c.isWalkable(f, x, z)) continue;
      p.gy = c.groundAt(f, x, z);
      if (!c.clearAt(f, x, z)) continue;
      if (stuckAt(x, z)) pts.push([x, z]);
    }
    // 連在一起的點算同一處
    const groups = [];
    for (const q of pts) {
      const g = groups.find((g) => g.some((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) < 0.16));
      g ? g.push(q) : groups.push([q]);
    }
    return groups.map((g) => ({ room: rid(r), x: r2(g.reduce((s, o) => s + o[0], 0) / g.length), z: r2(g.reduce((s, o) => s + o[1], 0) / g.length), n: g.length, enter: canEnter(f, g) })).map((t) => ({ ...t, out: t.enter ? getsOut(f, t.x, t.z) : false }));
  }
  // 這個卡住的位置，人真的走得進去嗎？從周圍 0.8 公尺內「走得動」的每個位置，往 16 個方向走 1.2 公尺（走路、跑步兩種步伐），
  //   中途會不會滑進去（直直走進去、或沿著家具邊緣滑進去都算）。走不進去的只是家具之間的小縫，不會有人卡在那裡
  function canEnter(f, g) {
    // 走到卡住點旁邊 0.25 公尺內，就地再測一次「這裡走不走得出去」（人被家具推到的位置不一定剛好在格點上）
    const hit = () => {
      if (!g.some((o) => Math.hypot(o[0] - p.x, o[1] - p.z) < 0.25)) return false;
      const x = p.x, z = p.z, s = stuckAt(x, z);
      p.x = x; p.z = z;
      return s;
    };
    const cx = g.reduce((s, o) => s + o[0], 0) / g.length, cz = g.reduce((s, o) => s + o[1], 0) / g.length;
    for (let x = cx - 0.8; x <= cx + 0.8; x += 0.1) for (let z = cz - 0.8; z <= cz + 0.8; z += 0.1) {
      if (g.some((o) => Math.hypot(o[0] - x, o[1] - z) < 0.12)) continue;
      p.gy = c.groundAt(f, x, z);
      if (!c.canGo(f, x, z)) continue;
      for (const step of [0.05, 0.075, 0.1]) for (let b = 0; b < 16; b++) {
        p.x = x; p.z = z;
        const a = b / 16 * Math.PI * 2;
        for (let k = 0; k < 1.2 / step; k++) { c.tryMove(Math.cos(a) * step, Math.sin(a) * step); if (hit()) return true; }
      }
    }
    return false;
  }
  // 真的按方向鍵會怎樣？站在卡住的位置，上下左右各按住 4 秒：走得出去，或被「卡住自動救出」帶到旁邊（離開 1 公尺以上）就不算問題
  function getsOut(f, x, z) {
    for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
      c.placeAt(f, x, z, 0);
      c.keys[k] = true; c.tick(4); c.keys[k] = false; c.tick(0.1);
      if (p.floor !== f || Math.hypot(p.x - x, p.z - z) > 1) return true;
    }
    return false;
  }
  // 4. 每扇門：門外 1 公尺 → 自動走到房間裡面（中心被桌子佔住就找中心附近站得住的地方）
  const OUT = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  function doors(i) {
    const r = c.rooms[i], f = r.f, out = [];
    for (const d of r.doorPts || []) {
      const [nx, nz] = OUT[d.side] || [0, 0], key = { room: rid(r), side: d.side, x: r2(d.x), z: r2(d.z) };
      p.floor = f; p.gy = 0;
      const start = [1.0, 0.8, 1.3, 0.6].map((k) => [d.x + nx * k, d.z + nz * k]).find(([x, z]) => c.canGo(f, x, z));
      if (!start) { out.push({ ...key, skip: '門外沒有站得住的地方' }); continue; }
      let tgt = null;
      for (let rad = 0; rad <= 2.5 && !tgt; rad += 0.25) for (let a = 0; a < (rad ? 12 : 1) && !tgt; a++) {
        const x = r.cx + Math.cos(a / 12 * Math.PI * 2) * rad, z = r.cz + Math.sin(a / 12 * Math.PI * 2) * rad;
        if (x > r.m.x1 + 0.4 && x < r.m.x2 - 0.4 && z > r.m.z1 + 0.4 && z < r.m.z2 - 0.4 && c.canGo(f, x, z)) tgt = [x, z];
      }
      if (!tgt) { out.push({ ...key, skip: '房間中間找不到站得住的地方' }); continue; }
      c.placeAt(f, start[0], start[1]);
      if (!c.findPath(f, start[0], start[1], tgt[0], tgt[1])) { out.push({ ...key, fail: '找不到路' }); continue; }
      c.walkTo(tgt[0], tgt[1]);
      for (let t = 0; t < 60 && c.auto.pts; t++) c.tick(0.5);
      const left = Math.hypot(p.x - tgt[0], p.z - tgt[1]);
      // 過門就算數：人在房間裡、離門超過 1.2 公尺（目的地在課桌中間時，自動走路會停在桌子旁邊，那不是門的問題）
      const inside = p.floor === f && p.x > r.m.x1 && p.x < r.m.x2 && p.z > r.m.z1 && p.z < r.m.z2 && Math.hypot(p.x - d.x, p.z - d.z) > 1.2;
      if (!inside && (p.floor !== f || left > 1.0)) out.push({ ...key, fail: '只走到離門 ' + Math.hypot(p.x - d.x, p.z - d.z).toFixed(1) + ' 公尺（' + (p.x > r.m.x1 && p.x < r.m.x2 && p.z > r.m.z1 && p.z < r.m.z2 ? '房間裡' : '房間外') + '）就停了' });
      else out.push({ ...key, ok: 1 });
    }
    return out;
  }
  // 4b. 自動走路（點地面、帶我去）：從第一扇門外走到房間裡每隔 1.5 公尺的位置。找得到路卻走不到＝路線穿過比人還窄的縫
  function walks(i) {
    const r = c.rooms[i], f = r.f, d = (r.doorPts || [])[0], out = [];
    if (!d) return { n: 0, out };
    const [nx, nz] = OUT[d.side] || [0, 0];
    p.floor = f; p.gy = 0;
    const start = [1.0, 0.8, 1.3, 0.6].map((k) => [d.x + nx * k, d.z + nz * k]).find(([x, z]) => c.canGo(f, x, z));
    if (!start) return { n: 0, out };
    let n = 0;
    for (let x = r.m.x1 + 0.6; x < r.m.x2 - 0.5; x += 1.5) for (let z = r.m.z1 + 0.6; z < r.m.z2 - 0.5; z += 1.5) {
      p.floor = f; p.gy = c.groundAt(f, x, z);
      if (!c.canGo(f, x, z)) continue;
      c.placeAt(f, start[0], start[1]);
      if (!c.findPath(f, start[0], start[1], x, z)) continue;
      n++;
      c.walkTo(x, z);
      if (!c.auto.pts) continue;
      // 路線的終點（目的地被家具圍住時，路線只會帶到最近、站得下的地方，那不算走不到）
      const [ex, ez] = c.auto.pts.at(-1);
      for (let t = 0; t < 80 && c.auto.pts; t++) c.tick(0.5);
      const left = Math.hypot(p.x - ex, p.z - ez);
      if (p.floor !== f || left > 0.6) out.push({ room: rid(r), x: r2(x), z: r2(z), sx: r2(p.x), sz: r2(p.z), left: r2(left) });
    }
    return { n, out };
  }
  // 5. 每位老師
  function npcs() {
    const out = [];
    for (const n of c.NPCS) {
      const who = n.name + '（' + (n.title || '') + '）';
      if (n.game && !c.GAME_FILE[n.game]) out.push(who + '：小遊戲「' + n.game + '」沒有對應的檔案（app.js 的 GAME_FILE）');
      const places = n.places ? n.places.map((q) => [c.floors.find((f) => f.id === q.floor), q.at, q.where || q.floor]) : [[c.floors[1], n.at, '1F']];
      for (const [f, at, where] of places) {
        let v;
        try { v = at(); } catch (e) { out.push(who + ' 在「' + where + '」：位置算不出來（' + e.message + '）'); continue; }
        if (!f) { out.push(who + ' 在「' + where + '」：找不到樓層'); continue; }
        if (!v || !v.slice(0, 3).every(Number.isFinite)) { out.push(who + ' 在「' + where + '」：位置不是數字'); continue; }
        if (!c.isWalkable(f, v[0], v[1])) out.push(who + ' 在「' + where + '」：站的地方不是可以走的地板（' + v[0].toFixed(1) + ', ' + v[1].toFixed(1) + '）');
      }
    }
    return { count: c.NPCS.length, out };
  }
  return { traps, doors, walks, npcs, list: () => c.rooms.map((r, i) => ({ i, id: rid(r), code: r.code || '', name: r.name || '', type: r.type, doors: (r.doorPts || []).length, area: (r.m.x2 - r.m.x1) * (r.m.z2 - r.m.z1) })) };
})();`;

/* ---------------- 2～5. 開瀏覽器的檢查 ---------------- */
async function browserChecks() {
  const srv = await serve(), origin = `http://127.0.0.1:${srv.address().port}`;
  const b = await launch();
  const errors = [], missing = [];
  b.on((method, q) => {
    if (method === 'Runtime.exceptionThrown') errors.push(q.exceptionDetails.exception?.description?.split('\n')[0] || q.exceptionDetails.text);
    if (method === 'Runtime.consoleAPICalled' && q.type === 'error') errors.push(q.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    if (method === 'Network.responseReceived' && q.response.url.startsWith(origin) && q.response.status >= 400) missing.push(`${q.response.status} ${q.response.url.slice(origin.length)}`);
  });
  try {
    await b.send('Runtime.enable'); await b.send('Network.enable'); await b.send('Page.enable');
    console.log('\n【2】網站開得起來');
    await b.send('Page.navigate', { url: `${origin}/?r=502` });
    let booted = false;
    for (let i = 0; i < 120 && !booted; i++) { await sleep(500); booted = await b.run('return !!window.__campusBooted').catch(() => false); }
    if (!booted) { bad('等了 60 秒網站還沒開好' + (errors.length ? '：' + errors[0] : '')); return; }
    // 封面 → 選角色
    await b.run(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('走進校園'))?.click(); await new Promise((r) => setTimeout(r, 800));
      document.querySelector('[alt="男學生"]')?.click(); await new Promise((r) => setTimeout(r, 800)); window.__campus.tick(0.3);`);
    await b.run(PAGE + '; return 1');
    // 天氣、登入要連外面的服務，連不上不算網站的錯
    const real = errors.filter((e) => !/Raycaster\.camera|firebase|gstatic|open-meteo|Failed to fetch|net::ERR/i.test(e));
    real.length ? [...new Set(real)].slice(0, 8).forEach((e) => bad('程式錯誤：' + e)) : ok('沒有程式錯誤');
    missing.length ? [...new Set(missing)].forEach((m) => bad('找不到檔案：' + m)) : ok('沒有找不到的檔案');

    const base = fs.existsSync(BASELINE) && !has('--all') ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { traps: [], doors: [] };
    let rooms = await b.run('return __chk.list()');
    if (only.length) rooms = rooms.filter((r) => only.some((k) => r.code === k || r.name.includes(k)));
    if (only.length && !rooms.length) { bad(`找不到房間：${only.join('、')}`); return; }

    console.log(`\n【3】卡住掃描（${rooms.length} 間）`);
    const traps = [];
    for (const [k, r] of rooms.entries()) {
      process.stdout.write(`  ${k + 1}/${rooms.length} ${r.id}                    \r`);
      traps.push(...await b.run(`return __chk.traps(${r.i})`));
    }
    process.stdout.write(' '.repeat(60) + '\r');
    const knownT = (t) => base.traps.some((o) => o.room === t.room && Math.hypot(o.x - t.x, o.z - t.z) < 0.35);
    const newT = traps.filter((t) => !knownT(t));
    const realT = newT.filter((t) => t.enter && !t.out), gaps = traps.filter((t) => !t.enter), saved = traps.filter((t) => t.enter && t.out);
    realT.length ? realT.forEach((t) => bad(`會卡住：${t.room}（x ${t.x}, z ${t.z}，${t.n} 個點）`))
      : ok(`沒有會卡住出不來的位置（擠得進去但走得出來或會自動救出 ${saved.length} 處、走不進去的小縫 ${gaps.length} 處、已知清單 ${traps.filter((t) => t.enter && !t.out).length} 處）`);
    // 新出現的小縫：模擬走不進去，但昨天沒有、今天有，代表剛改的家具擠出一個縫，提醒看一下（不算沒過）
    const newGaps = newT.filter((t) => !t.enter || t.out);
    if (newGaps.length) notes.push(`新出現 ${newGaps.length} 處家具之間的小縫（模擬走不進去，但建議看一下是不是太擠）：` + newGaps.slice(0, 6).map((t) => `${t.room}（x ${t.x}, z ${t.z}）`).join('；') + (newGaps.length > 6 ? '…' : ''));
    if (has('--gaps')) gaps.forEach((t) => console.log(`    小縫：${t.room}（x ${t.x}, z ${t.z}）`));

    console.log(`\n【4】每扇門走進去（${rooms.reduce((s, r) => s + r.doors, 0)} 扇）`);
    const doors = [];
    for (const [k, r] of rooms.entries()) {
      if (!r.doors) continue;
      process.stdout.write(`  ${k + 1}/${rooms.length} ${r.id}                    \r`);
      doors.push(...await b.run(`return __chk.doors(${r.i})`));
    }
    process.stdout.write(' '.repeat(60) + '\r');
    const failD = doors.filter((d) => d.fail), skipD = doors.filter((d) => d.skip);
    const knownD = (d) => base.doors.some((o) => o.room === d.room && o.side === d.side && Math.hypot(o.x - d.x, o.z - d.z) < 0.35);
    const newD = failD.filter((d) => !knownD(d));
    newD.length ? newD.forEach((d) => bad(`門走不進去：${d.room} ${d.side} 側的門（x ${d.x}, z ${d.z}）：${d.fail}`))
      : ok(`${doors.filter((d) => d.ok).length} 扇門都走得進去（已知走不到的 ${failD.length} 扇、沒辦法測的 ${skipD.length} 扇）`);
    if (skipD.length) notes.push(`沒辦法測的門 ${skipD.length} 扇：` + skipD.slice(0, 5).map((d) => `${d.room} ${d.side}（${d.skip}）`).join('；') + (skipD.length > 5 ? '…' : ''));

    console.log('\n【4b】自動走路：從門口走到房間各處');
    const walks = []; let walkN = 0;
    for (const [k, r] of rooms.entries()) {
      if (!r.doors || r.area > 600) continue;                      // 中庭這種大空地不測（太久，而且沒有家具縫）
      process.stdout.write(`  ${k + 1}/${rooms.length} ${r.id}                    \r`);
      const w = await b.run(`return __chk.walks(${r.i})`);
      walkN += w.n; walks.push(...w.out);
    }
    process.stdout.write(' '.repeat(60) + '\r');
    const knownW = (w) => (base.walks || []).some((o) => o.room === w.room && Math.hypot(o.x - w.x, o.z - w.z) < 0.35);
    const newW = walks.filter((w) => !knownW(w));
    newW.length ? newW.forEach((w) => bad(`自動走路走不到：${w.room} 要去（x ${w.x}, z ${w.z}），半路停在（x ${w.sx}, z ${w.sz}），離路線終點還有 ${w.left} 公尺`))
      : ok(`${walkN - walks.length} 個位置都走得到（已知走不到的 ${walks.length} 個）`);

    if (!only.length) {
      console.log('\n【5】每位老師');
      const n = await b.run('return __chk.npcs()');
      n.out.length ? n.out.forEach((m) => bad(m)) : ok(`${n.count} 位老師的位置和小遊戲都正常`);
    }

    if (has('--update')) {
      // 只掃部分房間時，其他房間的已知清單保留
      const scanned = new Set(rooms.map((r) => r.id));
      const keep = (list) => (only.length ? list.filter((o) => !scanned.has(o.room)) : []);
      const out = { note: '自動檢查的已知清單（node tools/check.mjs --update 產生）。在這裡的位置不會再報；修好以後重新 --update 就會消失。',
        traps: [...keep(base.traps), ...traps.map(({ room, x, z, n, enter, out }) => ({ room, x, z, n, enter, out }))],
        doors: [...keep(base.doors), ...failD.map(({ room, side, x, z, fail }) => ({ room, side, x, z, fail }))],
        walks: [...keep(base.walks || []), ...walks] };
      fs.writeFileSync(BASELINE, JSON.stringify(out, null, 1) + '\n');
      console.log(`\n已知清單已更新：會卡住出不來 ${out.traps.filter((t) => t.enter && !t.out).length} 處、小縫 ${out.traps.filter((t) => !t.enter || t.out).length} 處、走不到的門 ${out.doors.length} 扇、自動走路走不到 ${out.walks.length} 個（${rel(BASELINE)}）`);
      problems.length = 0;
    }
  } finally { b.close(); srv.close(); }
}

/* ---------------- 主程式 ---------------- */
const t0 = Date.now();
if (has('--live')) process.exit(await waitLive());
console.log(`溪口國小 3D 校園　自動檢查（?v=${localVersion()}）`);
staticChecks();
if (!has('--quick')) {
  try { await browserChecks(); } catch (e) { bad('檢查中斷：' + e.message); }
}
console.log('\n' + '─'.repeat(40));
notes.forEach((n) => console.log('提醒：' + n));
console.log(problems.length ? `✘ 沒有通過：${problems.length} 個新問題（上面打 ✘ 的）` : '✔ 全部通過');
console.log(`花了 ${Math.round((Date.now() - t0) / 1000)} 秒`);
process.exit(problems.length ? 1 : 0);
