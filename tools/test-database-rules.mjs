#!/usr/bin/env node
/* 在本機測試 database.rules.json 和連線核心 js/online-net.js（不用連 Firebase）
 *
 *   node tools/test-database-rules.mjs
 *
 * 裡面是一個簡化的 Realtime Database（記憶體），照規則檔判斷讀寫；只支援這份規則用到的語法。
 * 規則真正的語法檢查在 Firebase 主控台按「發布」時。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OnlineNet, cleanName, teacherName, emailKey, packPos, unpackPos, inHours, denyReason } from '../js/online-net.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8')).rules;
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('  ✘ ' + msg); } };

/* ---- 簡化的資料庫 ---- */
const parts = (p) => p.split('/').filter(Boolean);
const get = (o, p) => parts(p).reduce((a, k) => (a == null || typeof a !== 'object' ? null : a[k] ?? null), o);
const clone = (o) => structuredClone(o);
function put(o, p, v) {
  const ks = parts(p), last = ks.pop(); let a = o;
  for (const k of ks) a = (a[k] && typeof a[k] === 'object' ? a[k] : (a[k] = {}));
  if (v === null) delete a[last]; else a[last] = v;
}
const prune = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { prune(o[k]); if (o[k] && typeof o[k] === 'object' && !Object.keys(o[k]).length) delete o[k]; } return o; };
class Str {                                                 // 規則裡的字串：replace 是全部換、matches 用正規表示式
  static wrap(v) { return v; }
}
String.prototype.matches = function (re) { return re.test(this); };
String.prototype.contains = function (x) { return this.includes(x); };
const snap = (root, p) => ({
  val: () => { const v = get(root, p); return v && typeof v === 'object' ? { ...v } : v; },
  exists: () => get(root, p) !== null,
  child: (c) => snap(root, p + '/' + c),
  parent: () => snap(root, '/' + parts(p).slice(0, -1).join('/')),
  isString: () => typeof get(root, p) === 'string', isNumber: () => typeof get(root, p) === 'number', isBoolean: () => typeof get(root, p) === 'boolean',
  hasChildren: (ks) => { const v = get(root, p); return !!v && typeof v === 'object' && (!ks || ks.every((k) => v[k] != null)); },
});
const cache = new Map();
function evalRule(expr, env, vars) {
  if (typeof expr === 'boolean') return expr;
  const names = Object.keys(vars), key = expr + '|' + names;
  if (!cache.has(key)) cache.set(key, new Function('auth', 'now', 'root', 'data', 'newData', ...names, `return (${expr.replace(/\.replace\('/g, ".replaceAll('").replaceAll('===', '===')});`));
  try { return cache.get(key)(env.auth, env.now, env.root, env.data, env.newData, ...names.map((k) => vars[k])) === true; } catch { return false; }
}
function walkRule(p) {                                       // 這條路徑上每一層的規則節點
  const out = [{ node: RULES, path: '/', vars: {} }]; let node = RULES, vars = {}, cur = '';
  for (const k of parts(p)) {
    cur += '/' + k;
    const w = node && Object.keys(node).find((x) => x[0] === '$');
    if (node && k in node) node = node[k]; else if (w) { node = node[w]; vars = { ...vars, [w]: k }; } else node = null;
    out.push({ node, path: cur, vars });
  }
  return out;
}
let CUR = null;
Date.now = () => (CUR ? CUR.time : 0);                         // 連線核心用 Date.now 判斷開放時段：跟假資料庫的時間一致，什麼時候跑測試結果都一樣
class FakeDB {
  constructor() { this.data = {}; this.time = Date.UTC(2026, 10, 25, 2, 0); this.clients = new Set(); CUR = this; }   // 臺灣 10:00
  canRead(auth, p) {
    const root = snap(this.data, '/');
    return walkRule(p).some((r) => r.node && '.read' in r.node && evalRule(r.node['.read'], { auth, now: this.time, root, data: snap(this.data, r.path) }, r.vars));
  }
  // 一次更新好幾個位置（全部過才寫）
  write(auth, changes, admin = false) {
    const next = clone(this.data);
    const res = (v) => (v && typeof v === 'object' ? ('.sv' in v ? this.time : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, res(x)]))) : v);
    for (const [p, v] of Object.entries(changes)) put(next, p, v === null ? null : res(v));
    prune(next);
    if (!admin) for (const p of Object.keys(changes)) {
      const env = (path) => ({ auth, now: this.time, root: snap(this.data, '/'), data: snap(this.data, path), newData: snap(next, path) });
      const chain = walkRule(p);
      if (!chain.some((r) => r.node && '.write' in r.node && evalRule(r.node['.write'], env(r.path), r.vars))) throw Object.assign(new Error('permission_denied write ' + p), { code: 'PERMISSION_DENIED' });
      const val = (r) => {
        if (get(next, r.path) === null) return true;
        if (r.node && '.validate' in r.node && !evalRule(r.node['.validate'], env(r.path), r.vars)) return false;
        const v = get(next, r.path);
        if (v && typeof v === 'object') for (const k of Object.keys(v)) if (!val(walkRule(r.path + '/' + k).at(-1))) return false;
        return true;
      };
      for (const r of chain.slice(0, -1)) if (get(next, r.path) !== null && r.node && '.validate' in r.node && !evalRule(r.node['.validate'], env(r.path), r.vars)) throw Object.assign(new Error('permission_denied validate ' + r.path), { code: 'PERMISSION_DENIED' });
      if (!val(chain.at(-1))) throw Object.assign(new Error('permission_denied validate ' + p), { code: 'PERMISSION_DENIED' });
    }
    const before = this.data; this.data = next;
    for (const c of [...this.clients]) c.notify(before, next);
  }
}
// 假的 firebase-database（每個使用者一份）
function client(db, auth) {
  const c = { subs: new Set(), discon: new Map(), online: false, writes: 0,
    notify(before, next) { for (const s of [...this.subs]) if (s.alive) s.fire(before, next); },
    cut() { if (!this.online) return; this.online = false; const ch = Object.fromEntries([...this.discon.keys()].map((p) => [p, null])); this.discon.clear(); db.clients.delete(this); if (Object.keys(ch).length) db.write(auth, ch); this.info(); },
    info() { for (const s of [...this.subs]) s.info?.(); },
  };
  const S = (key, v) => ({ key, val: () => v });
  const sub = (type, ref, cb, err) => {
    if (ref.startsWith('.info/')) { const s = { alive: true, info: () => cb(S('', ref === '.info/connected' ? c.online : 0)), fire() {} }; c.subs.add(s); s.info(); return () => c.subs.delete(s); }
    if (!db.canRead(auth, ref)) { queueMicrotask(() => err?.(Object.assign(new Error('permission_denied read'), { code: 'PERMISSION_DENIED' }))); return () => {}; }
    const kids = (root) => get(root, ref) || {};
    const s = { alive: true, fire(a, b) {
      if (type === 'value') { if (JSON.stringify(get(a, ref)) !== JSON.stringify(get(b, ref))) cb(S('', get(b, ref))); return; }
      const A = kids(a), B = kids(b);
      for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
        const t = !(k in A) ? 'added' : !(k in B) ? 'removed' : JSON.stringify(A[k]) !== JSON.stringify(B[k]) ? 'changed' : '';
        if (t === type) cb(S(k, t === 'removed' ? A[k] : B[k]));
      }
    } };
    c.subs.add(s);
    if (type === 'value') cb(S('', get(db.data, ref))); if (type === 'added') for (const [k, v] of Object.entries(kids(db.data))) cb(S(k, v));
    return () => { s.alive = false; c.subs.delete(s); };
  };
  c.D = {
    ref: (_, p) => p, serverTimestamp: () => ({ '.sv': 'timestamp' }),
    goOnline: () => { if (c.online) return; c.online = true; db.clients.add(c); c.info(); }, goOffline: () => c.cut(),
    onValue: (r, cb, e) => sub('value', r, cb, e), onChildAdded: (r, cb, e) => sub('added', r, cb, e), onChildChanged: (r, cb, e) => sub('changed', r, cb, e), onChildRemoved: (r, cb, e) => sub('removed', r, cb, e),
    set: async (r, v) => { c.writes++; db.write(auth, { [r]: v }); }, update: async (r, o) => { c.writes++; db.write(auth, Object.fromEntries(Object.entries(o).map(([k, v]) => [`${r}/${k}`, v]))); },
    onDisconnect: (r) => ({ remove: async () => { c.discon.set(r, null); }, cancel: async () => { c.discon.delete(r); } }),
  };
  return c;
}
const A = (uid, email, name, verified = true) => ({ uid, token: { email, email_verified: verified, name } });
const stu = A('s1', 's1@st.skps.tp.edu.tw', '王小明王小明'), stu2 = A('s2', 'S2@st.skps.tp.edu.tw', '陳小華 陳小華'), tea = A('t1', 'teacher.a@skps.tp.edu.tw', '林老師'), boss = A('a1', 'boss.x@skps.tp.edu.tw', '管理員');
const out = A('x1', 'x@gmail.com', '壞人'), fake = A('x2', 'x@evil-skps.tp.edu.tw.com', '壞人'), unv = A('x3', 'x@st.skps.tp.edu.tw', '壞人', false), sub = A('x4', 'x@a.skps.tp.edu.tw', '壞人');
const fresh = (cfg = { on: true, stage: 'all', from: 7, to: 21 }) => { const db = new FakeDB(); db.write(null, { '/online/config': cfg, ['/online/admins/' + emailKey(boss.token.email)]: true }, true); return db; };
const can = (f) => { try { f(); return true; } catch { return false; } };
const card = (o = {}) => ({ n: '王小明', r: 's', g: 'boy', o: 'uniform', f: '3F', t: { '.sv': 'timestamp' }, ...o });
const P = (uid) => `/online/players/${uid}`;

console.log('【名字、格式】');
for (const [a, b] of [['王小明王小明', '王小明'], ['王小明 王小明', '王小明'], ['王小明', '王小明'], ['林老師', '林老師'], ['圓圓', '圓圓'], ['歐陽小明歐陽小明', '歐陽小明'], ['王圓圓王圓圓', '王圓圓'], ['Amy Lin', 'Amy Lin'], ['', '']]) ok(cleanName(a) === b, `cleanName(${a}) → ${cleanName(a)}`);
{ const q = { x: -25.63, z: 6.9, yaw: -0.5, walk: true, h: 1.2 }, u = unpackPos(packPos(q)); ok(Math.abs(u.x - q.x) < 0.01 && u.walk && Math.abs(u.h - 1.2) < 0.01 && Math.abs(((u.yaw - q.yaw) % (Math.PI * 2)) - Math.PI * 2) < 0.02, 'packPos／unpackPos'); ok(unpackPos('1,2') === null && unpackPos('a,b,c,d,e') === null, 'unpackPos 壞資料'); }
ok(inHours({ from: 7, to: 21 }, Date.UTC(2026, 0, 1, 23, 0)) && !inHours({ from: 7, to: 21 }, Date.UTC(2026, 0, 1, 13, 0)) && !inHours({ from: 7, to: 21 }, Date.UTC(2026, 0, 1, 22, 59)), '開放時段（臺灣 7～21 點）');
ok(denyReason(null, {}) === 'off' && denyReason({ on: true, stage: 'test', from: 0, to: 24 }, { now: 0 }) === 'test' && denyReason({ on: true, stage: 'test', from: 0, to: 24 }, { tester: true, now: 0 }) === '', 'denyReason');

console.log('【誰可以進來】');
{
  const db = fresh();
  ok(can(() => db.write(stu, { [P('s1')]: card() })), '學生（名字重複）可以加入');
  ok(can(() => db.write(stu2, { [P('s2')]: card({ n: '陳小華', g: 'girl' }) })), '學生（名字中間有空格、email 大寫）可以加入');
  ok(can(() => db.write(tea, { [P('t1')]: card({ n: '林老師', r: 't' }) })), '老師可以加入');
  for (const [who, t] of [[out, 'gmail'], [fake, '假網域'], [unv, 'email 沒驗證'], [sub, '別的子網域'], [null, '沒登入']]) {
    ok(!can(() => db.write(who, { [P(who?.uid || 'z')]: card({ n: '壞人' }) })), `${t} 不能寫`);
    ok(!db.canRead(who, '/online/players') && !db.canRead(who, '/online/pos/3F') && !db.canRead(who, '/online/config'), `${t} 不能讀`);
  }
  ok(!can(() => db.write(stu, { [P('s2')]: card() })), '不能寫別人的');
  ok(!can(() => db.write(stu, { [P('s2')]: null })), '不能刪別人的');
  ok(!can(() => db.write(stu, { [P('s1')]: card({ n: '陳小華' }) })), '不能冒用名字');
  ok(!can(() => db.write(stu, { [P('s1')]: card({ n: '校長' }) })), '不能自己取名');
  ok(!can(() => db.write(stu, { [P('s1')]: card({ r: 't' }) })), '學生不能冒充老師');
  ok(!can(() => db.write(stu, { [P('s1')]: card({ msg: '罵人的話' }) })), '不能多寫欄位（夾帶文字）');
  ok(!can(() => db.write(stu, { [P('s1')]: card({ o: '罵人' }) })), '服裝欄不能夾帶文字');
  ok(!can(() => db.write(stu, { [P('s1')]: card({ t: 1 }) })), '時間不能亂寫');
  ok(!can(() => db.write(stu, { '/online/pos/3F/s1': '1,2,3,0,0 髒話' })) && !can(() => db.write(stu, { '/online/pos/3F/s1': { a: 1 } })), '位置欄不能夾帶文字');
  ok(can(() => db.write(stu, { '/online/pos/3F/s1': '120,-300,90,1,0' })), '可以寫自己的位置');
  ok(!can(() => db.write(stu, { '/online/pos/4F/s1': '1,2,3,0,0' })), '名牌在 3F，不能同時出現在 4F');
  ok(!can(() => db.write(A('s9', 's9@st.skps.tp.edu.tw', '無名'), { '/online/pos/3F/s9': '1,2,3,0,0' })), '沒有名牌不能有位置（隱形人）');
  ok(!can(() => db.write(stu, { '/online/pos/罵人/s1': '1,2,3,0,0' })), '樓層不能亂寫');
  ok(can(() => db.write(stu, { '/online/pos/3F/s1': null, '/online/pos/4F/s1': '1,2,3,0,0', [P('s1')]: card({ f: '4F' }) })), '換樓層');
  ok(!can(() => db.write(stu, { '/online/junk': 1 })) && !can(() => db.write(stu, { '/junk': 1 })) && !db.canRead(stu, '/') && !db.canRead(stu, '/online'), '其他位置都不行');
  ok(!can(() => db.write(stu, { '/online/players': null })), '不能清掉全部人');
}
console.log('【老師的名字：名＋老師】');
for (const [full, given, want] of [['陳大明', '', '大明老師'], ['陳大明', '大明', '大明老師'], ['陳大明陳大明', '', '大明老師'], ['歐陽小美', '', '小美老師'], ['王明', '', '明老師'], ['林老師', '', '林老師'], ['Amy Lin', '', 'Amy老師'], ['陳大明', '大明大明', '大明老師']]) ok(teacherName(full, given) === want, `teacherName(${full}, ${given}) → ${teacherName(full, given)}`);
{
  const db = fresh(), t2 = A('t2', 't2@skps.tp.edu.tw', '陳大明');
  ok(can(() => db.write(t2, { [P('t2')]: card({ n: '大明老師', r: 't' }) })), '老師用「名＋老師」加入');
  ok(!can(() => db.write(t2, { [P('t2')]: card({ n: '陳大明', r: 't' }) })), '老師不能用全名（一定要加老師）');
  ok(!can(() => db.write(t2, { [P('t2')]: card({ n: '校長老師', r: 't' }) })) && !can(() => db.write(t2, { [P('t2')]: card({ n: '小美老師', r: 't' }) })), '老師不能冒用別人的名字');
  ok(!can(() => db.write(t2, { [P('t2')]: card({ n: '老師', r: 't' }) })), '不能只寫「老師」');
  ok(!can(() => db.write(stu, { [P('s1')]: card({ n: '王小明老師' }) })) && !can(() => db.write(stu, { [P('s1')]: card({ n: '小明老師' }) })), '學生不能加「老師」');
}
console.log('【開關、時段、名單】');
{
  const db = fresh();
  ok(!can(() => db.write(stu, { '/online/config/on': false })) && !can(() => db.write(tea, { '/online/config/on': false })), '學生、一般老師不能動總開關');
  ok(can(() => db.write(boss, { '/online/config/on': false })), '管理員可以關');
  ok(!can(() => db.write(stu, { [P('s1')]: card() })) && !db.canRead(stu, '/online/players'), '關了就不能加入、不能看');
  ok(db.canRead(stu, '/online/config'), '關了還是讀得到設定（畫面要顯示）');
  db.write(boss, { '/online/config': { on: true, stage: 'test', from: 7, to: 21 } });
  ok(!can(() => db.write(stu, { [P('s1')]: card() })), '測試階段：不在名單不能加入');
  ok(can(() => db.write(boss, { [P('a1')]: card({ n: '管理老師', r: 't' }) })), '測試階段：管理員可以');
  ok(!can(() => db.write(stu, { ['/online/testers/' + emailKey(stu.token.email)]: true })) && !can(() => db.write(tea, { ['/online/testers/' + emailKey(stu.token.email)]: true })), '不能自己加名單');
  ok(!can(() => db.write(boss, { ['/online/admins/' + emailKey(stu.token.email)]: true })), '管理員名單網站改不了');
  ok(can(() => db.write(boss, { ['/online/testers/' + emailKey(stu.token.email)]: true, ['/online/testers/' + emailKey(stu2.token.email)]: true })), '管理員加測試名單');
  ok(can(() => db.write(stu, { [P('s1')]: card() })) && can(() => db.write(stu2, { [P('s2')]: card({ n: '陳小華' }) })), '在名單可以加入（大小寫不影響）');
  ok(!db.canRead(stu, '/online/testers') && !db.canRead(stu, '/online/blocked') && !db.canRead(tea, '/online/testers'), '名單只有管理員看得到');
  ok(!can(() => db.write(boss, { '/online/config/stage': 'x' })) && !can(() => db.write(boss, { '/online/config/on': 'yes' })) && !can(() => db.write(boss, { '/online/config/from': 99 })), '設定值要正確');
  db.time = Date.UTC(2026, 10, 25, 14, 0); ok(!can(() => db.write(stu, { [P('s1')]: card() })) && !db.canRead(stu, '/online/players'), '晚上 10 點不行');
  ok(can(() => db.write(stu, { [P('s1')]: null })), '時段外還是可以刪自己的（離開、斷線）');
  db.time = Date.UTC(2026, 10, 25, 2, 0);
  ok(can(() => db.write(boss, { '/online/blocked/s1': '王小明', [P('s1')]: null, '/online/pos/3F/s1': null })), '管理員停用並請出');
  ok(!can(() => db.write(stu, { [P('s1')]: card() })) && !db.canRead(stu, '/online/players'), '停用的人不能加入、不能看');
  ok(!can(() => db.write(stu, { '/online/blocked/s1': null })), '不能自己解除');
  ok(!can(() => db.write(boss, { [P('s2')]: card({ n: '陳小華' }) })), '管理員也不能冒用別人寫資料');
  ok(can(() => db.write(boss, { '/online/blocked/s1': null })) && can(() => db.write(stu, { [P('s1')]: card() })), '解除停用');
}

console.log('【連線核心】');
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
function person(db, auth, over = {}) {
  const c = client(db, auth), s = { at: { f: '3F', x: 0, z: 0, yaw: 0, walk: false, h: 0 }, look: { g: 'boy', o: 'uniform' }, players: new Map(), pos: new Map(), states: [], acts: [], c };
  s.net = new OnlineNet({ D: c.D, db, me: { uid: auth.uid, n: cleanName(auth.token.name), r: /@st\./i.test(auth.token.email) ? 's' : 't', admin: false, tester: false, ...over }, look: () => s.look, where: () => s.at,
    on: { act: (u, v) => s.acts.push([u, v.k]), config: (v) => { s.cfg = v; }, player: (u, v) => (v ? s.players.set(u, v) : s.players.delete(u)), pos: (u, v) => (v ? s.pos.set(u, v) : s.pos.delete(u)), floor: () => s.pos.clear(), state: (a, b) => s.states.push(b ? `${a}:${b}` : a) } });
  return s;
}
{
  const db = fresh(), a = person(db, stu), b = person(db, stu2), t = person(db, tea);
  a.net.join(); await wait(5); b.net.join(); t.net.join(); await wait(5);
  ok(a.states.at(-1) === 'online' && b.states.at(-1) === 'online', '加入成功');
  ok(a.players.get('s2')?.n === '陳小華' && b.players.get('s1')?.n === '王小明' && a.players.get('t1')?.r === 't', '互相看得到名字');
  ok(b.pos.has('s1') && !b.pos.has('s2'), '看得到別人的位置、沒有自己');
  a.at.x = 2; a.at.walk = true; await a.net.tick(); ok(b.pos.get('s1').x === 2 && b.pos.get('s1').walk, '走路同步');
  const w = a.c.writes; await a.net.tick(); a.at.x = 2.05; await a.net.tick(); ok(a.c.writes === w, '沒動、動一點點不傳');
  a.at.f = '4F'; await a.net.tick(); ok(!b.pos.has('s1') && b.players.get('s1').f === '4F' && a.pos.size === 0, '換樓層：看不到了、名單更新');
  b.at.f = '4F'; await b.net.tick(); ok(b.pos.has('s1') && a.pos.has('s2') && !t.pos.has('s2'), '同一層又看得到');
  a.look = { g: 'girl', o: 'basketball-black' }; await a.net.tick(); ok(b.players.get('s1').o === 'basketball-black', '換衣服同步');
  a.c.cut(); await wait(5); ok(!b.players.has('s1') && !b.pos.has('s1') && !JSON.stringify(db.data.online.pos || {}).includes('s1'), '突然斷線：伺服器清乾淨（含換過樓層）');
  a.c.D.goOnline(); await wait(5); ok(b.players.has('s1') && b.pos.has('s1'), '重新連上會補回去');
  const a2 = person(db, stu); a2.at.f = '4F'; a2.net.join(); await wait(5); await a2.net.leave(); await wait(10); ok(b.players.has('s1'), '同帳號兩個分頁，關一個還在');
  db.write(boss, { '/online/blocked/s1': '王小明', [P('s1')]: null, '/online/pos/4F/s1': null }); await wait(10);
  ok(!b.players.has('s1') && a.states.at(-1) === 'left:denied' && !a.net.joined, '被停用：馬上離開、不會自己補回去');
  db.write(boss, { '/online/config/on': false }); await wait(10);
  ok(b.states.at(-1) === 'left:off' && t.states.at(-1) === 'left:off' && !db.data.online.players, '總開關關掉：全部離開、資料清空');
  clearInterval(a.net.timer);
}
{
  const db = fresh({ on: true, stage: 'test', from: 7, to: 21 }), a = person(db, stu); a.net.join(); await wait(10);
  ok(a.states.at(-1).startsWith('left'), '測試階段不在名單：加入失敗');
  db.write(boss, { ['/online/testers/' + emailKey(stu.token.email)]: true });
  const a2 = person(db, stu, { tester: true }); a2.net.join(); await wait(10); ok(a2.states.at(-1) === 'online', '測試名單可以加入');
  await a2.net.leave('user'); await wait(5); ok(!db.data.online.players && a2.states.at(-1) === 'left:user' && !a2.c.online, '自己離開：清乾淨、斷線');
}
console.log('【說話、動作、紀錄】');
{
  const db = fresh(), a = person(db, stu), b = person(db, stu2), c = person(db, A('s3', 's3@st.skps.tp.edu.tw', '李小安')), t = person(db, tea), AT = '/online/act/3F/';
  for (const p of [a, b, c, t]) p.net.join(); await wait(5);
  ok(await a.net.say('s5'), '說一句話');
  await wait(2); ok(b.acts.some(([u, k]) => u === 's1' && k === 's5') && t.acts.some(([u, k]) => u === 's1' && k === 's5') && !a.acts.length, '同一層的同學看得到、自己不重複收到');
  ok(Object.values(db.data.online.log || {}).some((l) => l.u === 's1' && l.n === '王小明' && l.k === 's5' && l.f === '3F'), '紀錄有留（誰、什麼、哪一層）');
  ok(!await a.net.say('a1'), '5 秒內不能再說（本機擋）');
  a.net.lastSay = 0;
  ok(!can(() => db.write(stu, { [AT + 's1']: { k: 'a1', t: { '.sv': 'timestamp' } } })), '規則：4 秒內不能再寫');
  db.time += 5000; ok(await a.net.say('a1'), '過 5 秒可以做動作'); await wait(2); ok(b.acts.at(-1)[1] === 'a1', '動作同步');
  ok(!can(() => db.write(stu, { [AT + 's1']: { k: 'x9', t: { '.sv': 'timestamp' } } })) && !can(() => db.write(stu, { [AT + 's1']: '罵人的話' })) && !can(() => db.write(stu, { [AT + 's1']: { k: 's1', t: { '.sv': 'timestamp' }, msg: '髒話' } })), '規則：只收固定代號、不能夾帶文字');
  db.time += 5000;
  ok(!can(() => db.write(stu, { [AT + 's2']: { k: 's1', t: { '.sv': 'timestamp' } } })), '不能冒用別人說話');
  ok(!can(() => db.write(stu, { '/online/act/4F/s1': { k: 's1', t: { '.sv': 'timestamp' } } })), '樓層和名牌不同不能說');
  ok(!can(() => db.write(A('s9', 's9@st.skps.tp.edu.tw', '無名'), { '/online/act/3F/s9': { k: 's1', t: { '.sv': 'timestamp' } } })), '沒有名牌不能說');
  ok(!can(() => db.write(stu, { '/online/log/1_s1': { u: 's1', n: '校長', k: 's1', f: '3F', t: { '.sv': 'timestamp' } } })) && !can(() => db.write(stu, { '/online/log/1_s1': { u: 's2', n: '陳小華', k: 's1', f: '3F', t: { '.sv': 'timestamp' } } })), '紀錄不能假造名字、不能寫別人的');
  ok(!db.canRead(stu, '/online/log') && !db.canRead(tea, '/online/log') && db.canRead(boss, '/online/log'), '紀錄只有管理員讀得到');
  const id = Object.keys(db.data.online.log)[0];
  ok(!can(() => db.write(stu, { ['/online/log/' + id]: null })) && can(() => db.write(boss, { ['/online/log/' + id]: null })), '紀錄只有管理員刪得掉');
  // 管理員關掉說話：只剩動作
  db.write(boss, { '/online/config/chat': false }); await wait(5); db.time += 5000;
  ok(c.cfg?.chat === false, '大家收得到「說話關了」');
  a.net.lastSay = 0; ok(!await a.net.say('s1') && a.net.joined, '說話關了：說不出來、但不會被踢出去');
  b.net.lastSay = 0; ok(await b.net.say('a2'), '說話關了：動作還可以');
  db.write(boss, { '/online/config/chat': true });
  // 隱藏自己
  await c.net.setHidden(true); await wait(5);
  ok(!db.data.online.players?.s3 && !JSON.stringify(db.data.online.pos || {}).includes('s3') && !b.players.has('s3'), '隱藏自己：別人看不到（名牌、位置都撤掉）');
  ok(c.players.has('s1') || c.players.has('s2'), '隱藏自己：我還是看得到大家');
  c.at.x = 5; await c.net.tick(); ok(!JSON.stringify(db.data.online.pos || {}).includes('s3'), '隱藏時走動不會傳位置');
  c.net.lastSay = 0; ok(!await c.net.say('s1'), '隱藏時不能說話');
  await c.net.setHidden(false); await wait(5); ok(b.players.has('s3') && b.pos.has('s3'), '取消隱藏：又出現了');
  // 離開、斷線：說話也清掉
  await a.net.leave('user'); await wait(5); ok(!db.data.online.act?.['3F']?.s1, '離開：說話的資料清掉');
  b.c.cut(); await wait(5); ok(!db.data.online.act?.['3F']?.s2, '斷線：說話的資料清掉');
  for (const p of [a, b, c, t]) clearInterval(p.net.timer);
}
console.log(fails ? `✘ ${fails}／${n} 項沒過` : `✔ ${n} 項全部通過`);
process.exit(fails ? 1 : 0);
