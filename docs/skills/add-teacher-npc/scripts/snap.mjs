/* 無畫面截圖（內建瀏覽器窗格隱藏時用）：開本機網站＋無畫面 Chrome／Edge，依 shots.json 站到指定位置拍照
 *
 *   node .claude/skills/add-teacher-npc/scripts/snap.mjs shots.json <輸出資料夾>
 *
 * shots.json 是陣列，每一張：
 *   { "name": "檔名（不含 .png）", "floor": "3F", "x": 0, "z": 0, "yaw": 0, "fp": true, "js": "額外要跑的程式" }
 *   fp：true＝第一人稱（看得比較清楚）；js 裡可以用 c（window.__campus）、f（那一層）、await，
 *   想印出資訊就設 window.__snapInfo。
 *
 * 範例：站到老師前面（看造型和提示文字）、按 F 開遊戲（看第一題）
 *   [
 *    { "name": "npc", "floor": "3F", "x": 0, "z": 0, "yaw": 0, "fp": true,
 *      "js": "const n = c.NPCS.find((x) => x.name === '趙老師'); const p = n.g.position; c.placeAt(f, p.x + 2.2, p.z + 0.3, Math.PI / 2); c.step(0.6);" },
 *    { "name": "game", "floor": "3F", "x": 0, "z": 0, "yaw": 0, "fp": true,
 *      "js": "const n = c.NPCS.find((x) => x.name === '趙老師'); const p = n.g.position; c.placeAt(f, p.x + 1.6, p.z, Math.PI / 2); c.step(0.6); dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true })); await new Promise((r) => setTimeout(r, 2500)); c.step(0.3);" }
 *   ]
 *   注意 placeAt 的面向：老師面向東（-π/2）時，站在老師東邊（x 比較大）、yaw = π/2（面向西）才看得到臉。
 *   x、z 先隨便給，js 裡再用老師的位置 placeAt 一次就好。 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../site');
const OUT = path.resolve(process.argv[3] || '.');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  s.listen(0, '127.0.0.1', () => resolve(s));
});
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
if (!exe) { console.error('找不到 Chrome 或 Edge'); process.exit(1); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
const proc = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--window-size=1000,650', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsBase = await new Promise((resolve) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) resolve(m[1]); }); });
const list = await (await fetch(`http://127.0.0.1:${new URL(wsBase).port}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waiting = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { const [res, rej] = waiting.get(m.id); waiting.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { waiting.set(++id, [res, rej]); ws.send(JSON.stringify({ id, method, params })); });
const run = async (code) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${code} })().then((v) => JSON.stringify(v === undefined ? null : v))`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return JSON.parse(r.result.value);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/` });
  for (let i = 0; i < 120; i++) { await sleep(500); if (await run('return !!window.__campusBooted').catch(() => false)) break; }
  await run(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('走進校園'))?.click(); await new Promise((r) => setTimeout(r, 800));
    document.querySelector('[alt="男學生"]')?.click(); await new Promise((r) => setTimeout(r, 800));
    const st = document.createElement('style'); st.textContent = '#toast{display:none!important}'; document.head.appendChild(st);`);
  const shots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  for (const s of shots) {
    const info = await run(`const c = window.__campus; const f = c.floors.find((x) => x.id === '${s.floor}'); window.__snapInfo = null;
      [...document.querySelectorAll('button')].find((x) => x.textContent.includes('${s.fp ? '第一人稱' : '第三人稱'}'))?.click();
      c.placeAt(f, ${s.x}, ${s.z}, ${s.yaw}); c.step(0.6); ${s.js || ''}
      c.step(0.1); return { x: c.player.x, z: c.player.z, info: window.__snapInfo };`);
    await sleep(400);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, s.name + '.png');
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(file, JSON.stringify(info));
  }
} catch (e) { console.error(e); process.exitCode = 1; }
ws.close(); proc.kill(); srv.close();
setTimeout(() => { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); process.exit(); }, 500);
