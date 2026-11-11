/* ---------------- 學校 Google 帳號登入（Firebase，第一階段：登入＋訪客＋存進度） ----------------
   只收學校網域：老師 skps.tp.edu.tw、學生 st.skps.tp.edu.tw（用 email 網域自動判斷身分），其他帳號登入後馬上登出。
   真正擋外人的是 Firestore 安全規則（firestore.rules），這裡的檢查只是讓畫面好懂。
   不登入＝訪客：照樣可以逛、可以玩，進度只留在這台電腦。
   登入後：進度（各遊戲最高分、角色、服裝、護照…，見 SYNC）存在 Firestore users/{uid}，換電腦也接得上；
           語言、畫質、音樂、時間這類「這台電腦的設定」不上傳。
   只存 email、身分、進度，不存姓名。
   作法：app.js 本來就把進度寫在 localStorage，這裡攔 localStorage.setItem，有進度變動就（延遲一下）上傳；
         上傳時先讀雲端那份合併再寫回（mergeSaved），舊電腦不會蓋掉新紀錄。
         登入時用雲端那份蓋掉這台電腦的進度（共用電腦不會混到別人的）；登出時清掉這台電腦的進度。
         遊戲大多在開始時才讀進度，換了資料就重新整理一次。
   Firebase 連不上（例如網路擋掉 gstatic）時不影響逛校園，只是登入按鈕不會出現。
   沒有打開 Firestore 本機快取（persistentLocalCache）：離線排隊的寫入不能先讀雲端再合併，連上線時會直接蓋掉新紀錄；
   這裡的進度本來就在 localStorage，沒傳完的 key 也記著（DIRTY_KEY），不需要第二份。
   快取還會把 email 和進度留在共用電腦的 IndexedDB，登出時又要另外清。 */

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CONFIG = {
  apiKey: 'AIzaSyAvdmygA7eloYU7B84OlKY2dBlSFiJRATc',
  authDomain: 'xikou-3d-campus.firebaseapp.com',
  projectId: 'xikou-3d-campus',
  storageBucket: 'xikou-3d-campus.firebasestorage.app',
  messagingSenderId: '893856603463',
  appId: '1:893856603463:web:a1f0c474504696d5258062',
};
const DOMAINS = { 'skps.tp.edu.tw': 'teacher', 'st.skps.tp.edu.tw': 'student' };
// 要跟著帳號走的進度（其他 campus-* 是這台電腦的設定）
const SYNC = /^campus-(avatar|outfit|outfit-bbgirl|passport|cat-found|sand-castles|rps-wins.*|.+-(best|wins|count))$/;
export const roleOf = (email) => DOMAINS[String(email || '').toLowerCase().split('@')[1]] || null;

const syncKeys = () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (SYNC.test(k)) out.push(k); } } catch { /* 私密模式 */ } return out; };
const snapshot = () => Object.fromEntries(syncKeys().map((k) => [k, localStorage.getItem(k)]));

/* 合併雲端和這台電腦的進度，舊電腦不會蓋掉新紀錄：
   - 分數（-best／-wins／-count 這類）取比較好的值；顏色對對碰記「最少翻牌數」，是取小的
   - 護照是每個章都留（聯集），挑戰尋路次數取大、最快時間取小
   - 其他（角色、服裝）：這台電腦剛改過的 key（dirtyKeys）用這台的，沒改過就用雲端的 */
const SCORE = /^campus-(cat-found|sand-castles|rps-wins.*|.+-(best|wins|count))$/;
const FEWER_IS_BETTER = new Set(['campus-colors-best']);
const PASSPORT = 'campus-passport';
const DIRTY_KEY = 'campus-sync-dirty';
const isProgress = (k) => !/^campus-(avatar|outfit|outfit-bbgirl)$/.test(k);   // 角色、服裝不算進度
const hasProgress = (saved) => Object.keys(saved).some((k) => SYNC.test(k) && isProgress(k));
const positive = (v) => { const n = Number(v); return n > 0 ? n : 0; };   // 壞掉的值、0 都當作沒有紀錄
function mergeScore(k, a, b) {
  const x = positive(a), y = positive(b);
  return String(FEWER_IS_BETTER.has(k) ? (x && y ? Math.min(x, y) : x || y) : Math.max(x, y));
}
function mergePassport(cloud, local) {
  const parse = (s) => { try { return JSON.parse(s) || {}; } catch { return {}; } };
  const c = parse(cloud), l = parse(local), out = { ...l, ...c };
  for (const kind of ['npc', 'pano', 'rooms', 'eggs']) out[kind] = { ...l[kind], ...c[kind] };   // 兩邊都有的章，留雲端那天的日期
  const best = [positive(c.nav?.best), positive(l.nav?.best)].filter(Boolean);
  out.nav = { n: Math.max(positive(c.nav?.n), positive(l.nav?.n)), best: best.length ? Math.min(...best) : 0 };
  return JSON.stringify(out);
}
export function mergeSaved(cloud, local, dirtyKeys = []) {
  const dirty = new Set(dirtyKeys), out = {};
  for (const k of new Set([...Object.keys(cloud), ...Object.keys(local)])) {
    if (!SYNC.test(k)) continue;
    const c = typeof cloud[k] === 'string' ? cloud[k] : undefined, l = local[k];
    if (c === undefined) out[k] = l;
    else if (l === undefined) out[k] = c;
    else if (SCORE.test(k)) out[k] = mergeScore(k, c, l);
    else if (k === PASSPORT) out[k] = mergePassport(c, l);
    else out[k] = dirty.has(k) ? l : c;
  }
  return out;
}
const sameSaved = (a, b) => { const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]); };

export async function initLogin({ T, toast }) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(CONFIG), auth = A.getAuth(app), db = F.getFirestore(app);
  const setItem = Storage.prototype.setItem;
  // 這台電腦改過、還沒上傳成功的 key；也記在 localStorage，關掉分頁、斷網也不會丟，下次登入時補傳
  const dirty = new Set();
  const saveDirty = () => { try { if (dirty.size) setItem.call(localStorage, DIRTY_KEY, JSON.stringify({ uid: user.uid, keys: [...dirty] })); else localStorage.removeItem(DIRTY_KEY); } catch { /* 私密模式 */ } };
  const loadDirty = (uid) => { try { const o = JSON.parse(localStorage.getItem(DIRTY_KEY)); return o?.uid === uid && Array.isArray(o.keys) ? o.keys : []; } catch { return []; } };
  let user = null, role = null, timer = 0;

  // 上傳：進度有變動 1.5 秒後存一次（連續答題不會一直寫）。先讀雲端那份合併再寫回；兩邊一樣就不寫。
  const upload = async () => {
    clearTimeout(timer); timer = 0;
    if (!user || !dirty.size) return;
    const ref = F.doc(db, 'users', user.uid), local = snapshot(), keys = [...dirty];
    try {
      const merged = await F.runTransaction(db, async (tx) => {
        const s = await tx.get(ref), cloud = s.exists() ? s.data().saved || {} : {}, next = mergeSaved(cloud, local, keys);
        if (!s.exists() || !sameSaved(cloud, next)) tx.set(ref, { email: user.email, role, saved: next, updatedAt: F.serverTimestamp() }, { mergeFields: ['email', 'role', 'saved', 'updatedAt'] });   // 不動 seenAt
        return next;
      });
      // 上傳期間又有變動的 key（值已經不一樣）留著下次傳；其他的把合併結果（可能是別台電腦的新紀錄）寫回這台
      const changedSince = (k) => { try { return localStorage.getItem(k) !== (local[k] ?? null); } catch { return false; } };
      for (const k of keys) if (!changedSince(k)) dirty.delete(k);
      saveDirty();
      for (const [k, v] of Object.entries(merged)) if (!dirty.has(k) && !changedSince(k) && local[k] !== v) { try { setItem.call(localStorage, k, v); } catch { /* 私密模式 */ } }
    } catch (e) { console.warn('進度上傳失敗', e); }
  };
  Storage.prototype.setItem = function (k, v) {
    setItem.call(this, k, v);
    if (user && this === localStorage && SYNC.test(k)) { dirty.add(k); saveDirty(); clearTimeout(timer); timer = setTimeout(upload, 1500); }
  };
  // 最後上線時間（seenAt）：打開網站時記一次，之後分頁回到前景、距離上次超過 15 分鐘再記一次；給老師進度頁看
  // 只改 seenAt 這一欄，不動進度。規則還沒更新時會被擋，安靜略過就好
  let seenAt = 0;
  const markSeen = async () => {
    if (!user || document.hidden || Date.now() - seenAt < 15 * 60e3) return;
    seenAt = Date.now();
    try { await F.updateDoc(F.doc(db, 'users', user.uid), { seenAt: F.serverTimestamp() }); }
    catch (e) { console.debug('上線時間沒有記錄', e.code || e); }
  };
  document.addEventListener('visibilitychange', markSeen);
  // 一場遊戲結束就立刻上傳；切走分頁、回到分頁、網路恢復時補傳（upload 沒東西要傳時什麼都不做）
  addEventListener('campus:game-end', upload);
  document.addEventListener('visibilitychange', upload);
  addEventListener('online', upload);

  // 按鈕：上方工具列一顆、首頁一顆
  const topBtn = document.getElementById('loginBtn'), coverBtn = document.querySelector('#cover [data-act=login]');
  const label = (zh, en) => { topBtn.dataset.zh = zh; topBtn.dataset.en = en; topBtn.innerHTML = T(zh, en); };
  // 老師（和 staff 名單裡的學生網域管理者）多一顆「學生進度」按鈕，開 teacher.html
  let canView = false;
  const viewBtn = document.createElement('a');
  viewBtn.className = 'iconbtn'; viewBtn.href = 'teacher.html'; viewBtn.target = '_blank'; viewBtn.rel = 'noopener'; viewBtn.hidden = true;
  viewBtn.style.cssText = 'text-decoration:none;color:inherit'; viewBtn.dataset.zh = '📊 學生進度'; viewBtn.dataset.en = '📊 Student progress';
  topBtn.after(viewBtn);
  const render = () => {
    topBtn.hidden = false; if (coverBtn) coverBtn.parentElement.hidden = !!user;
    viewBtn.hidden = !(user && canView); viewBtn.innerHTML = T('📊 學生進度', '📊 Student progress');
    if (!user) label('🔑 登入', '🔑 Sign in');
    else label(role === 'teacher' ? '🧑‍🏫 老師・登出' : '🎒 學生・登出', role === 'teacher' ? '🧑‍🏫 Teacher · Sign out' : '🎒 Student · Sign out');
    topBtn.title = user ? user.email : T('用學校 Google 帳號登入，進度會存起來', 'Sign in with your school Google account to save progress');
  };
  const signIn = async () => {
    const p = new A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    try { await A.signInWithPopup(auth, p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked') toast(T('瀏覽器擋住了登入視窗，請允許這個網站開彈出式視窗', 'The sign-in popup was blocked. Please allow popups.'));
      else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast(T('登入失敗，請再試一次', 'Sign-in failed. Please try again.'));
    }
  };
  const signOutHere = async () => {
    if (!confirm(T(`要登出 ${user.email} 嗎？\n（進度已經存在雲端，這台電腦上的會清掉）`, `Sign out ${user.email}?
(Your progress is saved in the cloud. The copy on this computer will be cleared.)`))) return;
    await upload();
    if (dirty.size && !confirm(T('還有進度沒有上傳成功（可能是網路問題），現在登出這些進度會不見。確定要登出嗎？', 'Some progress has not been uploaded (possibly a network problem) and will be lost if you sign out now. Sign out anyway?'))) return;
    dirty.clear(); saveDirty();
    for (const k of syncKeys()) localStorage.removeItem(k);
    try { sessionStorage.removeItem('campus-auth-reload'); } catch { /* 私密模式 */ }
    await A.signOut(auth);
    location.reload();
  };
  topBtn.onclick = () => (user ? signOutHere() : signIn());
  if (coverBtn) coverBtn.onclick = signIn;

  A.onAuthStateChanged(auth, async (u) => {
    if (!u) { user = role = null; canView = false; seenAt = 0; render(); return; }
    const r = roleOf(u.email);
    if (!r || !u.emailVerified) {
      await A.signOut(auth);
      toast(T('請用溪口國小的學校帳號登入（@skps.tp.edu.tw 或 @st.skps.tp.edu.tw）', 'Please use your Xikou school account.'));
      return;
    }
    // 用雲端那份進度蓋掉這台電腦的；第一次登入就從頭開始記錄
    let cloud = {};
    try {
      const s = await F.getDoc(F.doc(db, 'users', u.uid));
      if (s.exists()) cloud = s.data().saved || {};
      else await F.setDoc(F.doc(db, 'users', u.uid), { email: u.email, role: r, saved: {}, updatedAt: F.serverTimestamp() });
    } catch (e) {
      console.warn('讀取進度失敗', e);
      await A.signOut(auth);
      toast(T('連不上進度資料庫，先用訪客身分逛逛吧', 'Could not reach the server. Browsing as a guest.'));
      return;
    }
    const before = JSON.stringify(snapshot());
    // 上次沒傳完的（關掉分頁、斷網）是這個帳號自己的，先合併進來；別的帳號留下的不算
    let pending = loadDirty(u.uid);
    // 帳號第一次使用（雲端還沒有進度）：問要不要把這台電腦的訪客進度帶進帳號；角色、服裝是剛選的，不用問，直接留著
    if (!pending.length && !hasProgress(cloud)) {
      const local = Object.keys(snapshot());
      const bring = local.some(isProgress) && confirm(T(
        '這台電腦有訪客時的遊戲進度，要帶進你的帳號嗎？\n\n按「確定」：帶進帳號\n按「取消」：不帶，帳號從頭開始（這台電腦的訪客進度會清掉）',
        'This computer has guest progress. Bring it into your account?\n\nOK: bring it in\nCancel: start fresh (guest progress on this computer will be cleared)'));
      pending = local.filter((k) => (bring || !isProgress(k)) && !(k in cloud));
      if (!bring) for (const k of local) if (isProgress(k)) localStorage.removeItem(k);
    }
    const next = pending.length ? mergeSaved(cloud, snapshot(), pending) : cloud;
    for (const k of syncKeys()) if (!(k in next)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(next)) if (SYNC.test(k) && typeof v === 'string') setItem.call(localStorage, k, v);
    canView = r === 'teacher';
    if (!canView) { try { canView = (await F.getDoc(F.doc(db, 'staff', u.email.toLowerCase()))).exists(); } catch { /* 規則還沒更新、不在名單 */ } }
    user = u; role = r; render();
    for (const k of pending) dirty.add(k);
    saveDirty();
    await upload();
    markSeen();
    // 換了進度：重新整理讓遊戲讀到新的（同一個分頁只重整一次，避免開場自動寫入的值造成一直重整）
    let reloaded = false; try { reloaded = sessionStorage.getItem('campus-auth-reload') === u.uid; sessionStorage.setItem('campus-auth-reload', u.uid); } catch { /* 私密模式 */ }
    if (!reloaded && JSON.stringify(snapshot()) !== before) { location.reload(); return; }
    toast(T(`👋 已登入（${r === 'teacher' ? '老師' : '學生'}），進度會自動存起來`, `👋 Signed in (${r}). Progress will be saved.`));
  });
  render();
}
