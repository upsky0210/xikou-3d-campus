/* ---------------- 同學在線上：連線核心（不碰畫面，畫面在 online.js） ----------------
   Firebase Realtime Database。資料：
     online/config            { on 總開關, stage 'test'｜'all', from, to 開放時段（臺灣時間，幾點到幾點） }
     online/admins/{email}    管理員（只能在主控台新增；email 小寫、「.」換成「,」）
     online/testers/{email}   測試階段可以加入的帳號
     online/blocked/{uid}     停用的帳號
     online/players/{uid}     { n 名字, r 's' 學生｜'t' 老師, g 'boy'｜'girl', o 服裝, f 樓層, t 加入時間 }
     online/pos/{樓層}/{uid}  "x,z,面向,走路,高度"（公分、公分、角度、0/1、公分）
     online/act/{樓層}/{uid}  { k 說的話或動作的代號, t 時間 }：只能從固定的幾句話和幾個動作選（SAY／ACT），不能打字；同一人至少隔 4 秒
     online/log/{id}          { u uid, n 名字, k 代號, f 樓層, t 時間 }：每次說話、動作都記一筆，只有管理員看得到，保存約一學期
   位置只訂閱自己那一層、走動才傳、最多每 0.5 秒一次（免費方案每月下載 10 GB）。
   斷線、關分頁：伺服器自動刪掉 players 和 pos（onDisconnect），不留位置紀錄。
   真正擋人的是 database.rules.json（貼到主控台才生效），這裡的檢查只是讓畫面好懂。 */
export const DB_URL = 'https://xikou-3d-campus-default-rtdb.asia-southeast1.firebasedatabase.app';
export const SEND_MS = 500;
export const SAY_GAP = 5000;                       // 同一個人兩次說話／動作至少隔幾毫秒（規則裡是 4000，留一點誤差）
export const KEEP_DAYS = 190;                      // 紀錄保存天數（約一學期）
export const CODE = /^(a[1-4]|s[1-5])$/;           // 說話 s1～s5、動作 a1～a4
export const emailKey = (e) => String(e || '').toLowerCase().replaceAll('.', ',');

// 學生帳號當初「姓」「名」都填了全名，Google 會顯示成「王小明王小明」：前後一樣就只取一半
export function cleanName(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim(), [a, b, ...rest] = t.split(' ');
  if (b !== undefined && !rest.length && a === b && a.length >= 2) return a;
  const h = t.length / 2;
  return h >= 2 && Number.isInteger(h) && t.slice(0, h) === t.slice(h) ? t.slice(0, h) : t;
}
// 老師（skps.tp.edu.tw）顯示「名＋老師」（例如 陳大明 → 大明老師），學生才不會直接叫老師全名。
//   given：Google 帳號的「名」（登入時拿到、存在這台電腦）；沒有就從全名去掉姓（複姓算兩個字）
const COMPOUND = ['歐陽', '司馬', '諸葛', '上官', '司徒', '東方', '張簡', '范姜', '周黃', '張廖', '簡張', '江謝', '劉張', '陳吳', '黃林'];
export function teacherName(full, given) {
  let g = cleanName(given);
  if (!g) {
    const n = cleanName(full);
    if (n.endsWith('老師')) return n;
    if (/^[一-鿿]{2,5}$/.test(n)) g = n.slice(n.length >= 4 && COMPOUND.some((c) => n.startsWith(c)) ? 2 : 1);
    else g = n.split(' ')[0];
  }
  return !g ? '' : g.endsWith('老師') ? g : g + '老師';
}
// 現在（毫秒）是不是在開放時段：臺灣時間 from 點到 to 點
export const inHours = (cfg, now) => { const h = ((now + 8 * 3600e3) % 86400e3) / 3600e3; return h >= cfg.from && h < cfg.to; };
// 這個人現在可不可以加入；回傳 '' 可以，或原因
export function denyReason(cfg, { admin, tester, now }) {
  if (!cfg || cfg.on !== true) return 'off';
  if (cfg.stage !== 'all' && !admin && !tester) return 'test';
  return inHours(cfg, now) ? '' : 'hours';
}
export const packPos = (p) => `${Math.round(p.x * 100)},${Math.round(p.z * 100)},${((Math.round(p.yaw * 180 / Math.PI) % 360) + 360) % 360},${p.walk ? 1 : 0},${Math.round(p.h * 100)}`;
export function unpackPos(s) {
  const a = String(s).split(',').map(Number);
  return a.length === 5 && a.every(Number.isFinite) ? { x: a[0] / 100, z: a[1] / 100, yaw: a[2] * Math.PI / 180, walk: a[3] === 1, h: a[4] / 100 } : null;
}

/* D：firebase-database 的函式；db：getDatabase(app, DB_URL)；me：{ uid, n, r, admin, tester }
   look()：{ g, o }；where()：{ f, x, z, yaw, walk, h }；on：{ player(uid, 資料或 null), pos(uid, 資料或 null), floor(), state(狀態, 原因) } */
export class OnlineNet {
  constructor({ D, db, me, look, where, on }) {
    Object.assign(this, { D, db, me, look, where, on });
    this.joined = false; this.connected = false; this.offs = []; this.posOffs = []; this.offset = 0; this.floor = null; this.sent = ''; this.look0 = ''; this.cfg = null; this.hidden = false; this.lastSay = 0;
  }
  ref(p) { return this.D.ref(this.db, p); }
  now() { return Date.now() + this.offset; }
  join() {
    if (this.joined) return;
    const { D } = this, fail = (e) => this.leave(String(e?.code || e).toLowerCase().includes('permission') ? 'denied' : 'error');
    this.joined = true; this.hidden = false; this.floor = this.where().f; this.sent = '';
    this.on.state('connecting');
    D.goOnline(this.db);
    this.offs.push(
      D.onValue(this.ref('.info/serverTimeOffset'), (s) => { this.offset = s.val() || 0; }),
      D.onValue(this.ref('online/config'), (s) => { this.cfg = s.val(); this.on.config?.(this.cfg); this.check(); }, fail),
      D.onChildAdded(this.ref('online/players'), (s) => this.on.player(s.key, s.val()), fail),
      D.onChildChanged(this.ref('online/players'), (s) => this.on.player(s.key, s.val()), fail),
      D.onChildRemoved(this.ref('online/players'), (s) => {
        this.on.player(s.key, null);
        if (s.key === this.me.uid && this.joined && this.connected && !this.hidden) this.announce();      // 同一個帳號開兩個分頁，關掉其中一個：把自己補回去
      }, fail),
      D.onValue(this.ref('.info/connected'), (s) => {
        this.connected = s.val() === true;
        if (this.connected) this.announce(); else if (this.joined) this.on.state('connecting');
      }),
    );
    this.subFloor();
    this.timer = setInterval(() => this.tick(), SEND_MS);
  }
  check() {
    if (!this.joined || !this.cfg) return;
    const why = denyReason(this.cfg, { ...this.me, now: this.now() });
    if (why) this.leave(why);
  }
  subFloor() {
    const { D } = this;
    this.posOffs.splice(0).forEach((f) => f());
    this.on.floor();
    const r = this.ref(`online/pos/${this.floor}`), put = (s) => { if (s.key !== this.me.uid) this.on.pos(s.key, unpackPos(s.val())); }, err = () => {};
    this.posOffs.push(D.onChildAdded(r, put, err), D.onChildChanged(r, put, err), D.onChildRemoved(r, (s) => this.on.pos(s.key, null), err));
    const a = this.ref(`online/act/${this.floor}`), say = (s) => { if (s.key !== this.me.uid && s.val()) this.on.act?.(s.key, s.val()); };
    this.posOffs.push(D.onChildAdded(a, say, err), D.onChildChanged(a, say, err));
  }
  card() { const l = this.look(); this.look0 = `${l.g}/${l.o}`; return { n: this.me.n, r: this.me.r, g: l.g, o: l.o, f: this.floor, t: this.D.serverTimestamp() }; }
  async announce() {
    const { D, me } = this, w = this.where();
    try {
      // 先登記「斷線就刪」，再把自己放上去
      await Promise.all([D.onDisconnect(this.ref(`online/players/${me.uid}`)).remove(), D.onDisconnect(this.ref(`online/pos/${this.floor}/${me.uid}`)).remove(), D.onDisconnect(this.ref(`online/act/${this.floor}/${me.uid}`)).remove()]);
      if (!this.joined) return;
      if (this.hidden) { this.on.state('online'); return; }                              // 隱藏自己：連著線看別人，但不把自己放上去
      const str = packPos(w);
      await D.update(this.ref('online'), { [`players/${me.uid}`]: this.card(), [`pos/${this.floor}/${me.uid}`]: str });
      this.sent = str;
      if (this.joined) this.on.state('online');
    } catch (e) { console.warn('加入線上失敗', e); this.leave('denied'); }
  }
  async tick() {
    if (!this.joined) return;
    this.check();
    if (!this.joined || !this.connected) return;
    if (this.hidden) { this.floor = this.where().f === this.floor ? this.floor : this.moveFloorHidden(); return; }
    const { D, me } = this, w = this.where(), l = this.look();
    try {
      if (w.f !== this.floor) {                                                        // 換樓層：舊的位置刪掉、改訂閱新的那一層
        const old = this.floor; this.floor = w.f; this.sent = packPos(w); this.subFloor();
        await Promise.all([D.onDisconnect(this.ref(`online/pos/${w.f}/${me.uid}`)).remove(), D.onDisconnect(this.ref(`online/act/${w.f}/${me.uid}`)).remove()]);
        await D.update(this.ref('online'), { [`pos/${old}/${me.uid}`]: null, [`act/${old}/${me.uid}`]: null, [`pos/${w.f}/${me.uid}`]: this.sent, [`players/${me.uid}`]: this.card() });
        await Promise.all([D.onDisconnect(this.ref(`online/pos/${old}/${me.uid}`)).cancel(), D.onDisconnect(this.ref(`online/act/${old}/${me.uid}`)).cancel()]);
      } else if (`${l.g}/${l.o}` !== this.look0) {                                      // 換角色、換衣服
        await D.set(this.ref(`online/players/${me.uid}`), this.card());
      } else {
        const str = packPos(w);
        if (str !== this.sent && this.moved(str)) { this.sent = str; await D.set(this.ref(`online/pos/${this.floor}/${me.uid}`), str); }
      }
    } catch (e) { console.warn('位置沒有送出', e); if (String(e?.code || e).toLowerCase().includes('permission')) this.leave('denied'); }
  }
  moveFloorHidden() { this.floor = this.where().f; this.subFloor(); return this.floor; }
  // 隱藏自己／讓大家看到：隱藏就把名牌和位置撤掉（連線還在，看得到別人）；回來時重新放上去
  async setHidden(h) {
    if (!this.joined || this.hidden === h) return;
    this.hidden = h;
    if (h) { if (this.connected) try { await this.D.update(this.ref('online'), { [`players/${this.me.uid}`]: null, [`pos/${this.floor}/${this.me.uid}`]: null, [`act/${this.floor}/${this.me.uid}`]: null }); } catch (e) { console.debug('隱藏時清除失敗', e); } }
    else if (this.connected) { this.floor = this.where().f; this.subFloor(); await this.announce(); }
  }
  // 說一句話、做一個動作（只收固定的代號）；回傳 true＝送出了，false＝太快、沒連上或被規則擋住
  async say(k) {
    if (!this.joined || !this.connected || this.hidden || !CODE.test(k)) return false;
    const now = Date.now();
    if (now - this.lastSay < SAY_GAP) return false;
    this.lastSay = now;
    const { D, me } = this, t = D.serverTimestamp(), f = this.floor;
    try {
      await D.update(this.ref('online'), { [`act/${f}/${me.uid}`]: { k, t }, [`log/${this.now()}_${me.uid}`]: { u: me.uid, n: me.n, k, f, t } });
      return true;
    } catch (e) { console.warn('說話沒有送出', e); this.lastSay = 0; return false; }              // 被規則擋住（例如管理員關了說話）不算斷線，不要離開
  }
  // 動得夠多才傳：走超過 15 公分、轉超過 20 度、開始或停下、跳起來
  moved(str) {
    const a = unpackPos(this.sent), b = unpackPos(str);
    if (!a) return true;
    const turn = Math.abs(((b.yaw - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return Math.hypot(a.x - b.x, a.z - b.z) > 0.15 || turn > 0.35 || a.walk !== b.walk || Math.abs(a.h - b.h) > 0.15;
  }
  async leave(why = '') {
    if (!this.joined) return;
    const { D, me } = this;
    this.joined = false; clearInterval(this.timer);
    this.offs.splice(0).forEach((f) => f()); this.posOffs.splice(0).forEach((f) => f());
    this.on.floor(); this.on.state('left', why);
    try {
      if (this.connected) await Promise.race([D.update(this.ref('online'), { [`players/${me.uid}`]: null, [`pos/${this.floor}/${me.uid}`]: null, [`act/${this.floor}/${me.uid}`]: null }), new Promise((r) => setTimeout(r, 2000))]);
    } catch (e) { console.debug('離開時清除失敗，斷線後伺服器會清', e); }
    this.connected = false;
    if (!this.joined && !this.keep) D.goOffline(this.db);                                             // 斷線：伺服器把這個人刪掉，也空出一個連線名額
  }
}
