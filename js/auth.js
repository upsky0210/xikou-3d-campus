/* ---------------- 學校 Google 帳號登入（Firebase，第一階段：登入＋訪客＋存進度） ----------------
   只收學校網域：老師 skps.tp.edu.tw、學生 st.skps.tp.edu.tw（用 email 網域自動判斷身分），其他帳號登入後馬上登出。
   真正擋外人的是 Firestore 安全規則（firestore.rules），這裡的檢查只是讓畫面好懂。
   不登入＝訪客：照樣可以逛、可以玩，進度只留在這台電腦。
   登入後：進度（各遊戲最高分、角色、服裝、護照…，見 SYNC）存在 Firestore users/{uid}，換電腦也接得上；
           語言、畫質、音樂、時間這類「這台電腦的設定」不上傳。
   只存 email、身分、進度，不存姓名。
   作法：app.js 本來就把進度寫在 localStorage，這裡攔 localStorage.setItem，有進度變動就（延遲一下）上傳；
         登入時用雲端那份蓋掉這台電腦的進度（共用電腦不會混到別人的）；登出時清掉這台電腦的進度。
         遊戲大多在開始時才讀進度，換了資料就重新整理一次。
   Firebase 連不上（例如網路擋掉 gstatic）時不影響逛校園，只是登入按鈕不會出現。 */

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

export async function initLogin({ T, toast }) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(CONFIG), auth = A.getAuth(app), db = F.getFirestore(app);
  let user = null, role = null, timer = 0;

  // 上傳：進度有變動 1.5 秒後存一次（連續答題不會一直寫）
  const upload = async () => {
    timer = 0;
    if (!user) return;
    try {
      await F.setDoc(F.doc(db, 'users', user.uid), { email: user.email, role, saved: snapshot(), updatedAt: F.serverTimestamp() });
    } catch (e) { console.warn('進度上傳失敗', e); }
  };
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    setItem.call(this, k, v);
    if (user && this === localStorage && SYNC.test(k)) { clearTimeout(timer); timer = setTimeout(upload, 1500); }
  };
  addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); upload(); } });

  // 按鈕：上方工具列一顆、首頁一顆
  const topBtn = document.getElementById('loginBtn'), coverBtn = document.querySelector('#cover [data-act=login]');
  const label = (zh, en) => { topBtn.dataset.zh = zh; topBtn.dataset.en = en; topBtn.innerHTML = T(zh, en); };
  const render = () => {
    topBtn.hidden = false; if (coverBtn) coverBtn.parentElement.hidden = !!user;
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
    if (!confirm(T(`要登出 ${user.email} 嗎？\n（進度已經存在雲端，這台電腦上的會清掉）`, `Sign out ${user.email}?`))) return;
    if (timer) { clearTimeout(timer); await upload(); }
    for (const k of syncKeys()) localStorage.removeItem(k);
    try { sessionStorage.removeItem('campus-auth-reload'); } catch { /* 私密模式 */ }
    await A.signOut(auth);
    location.reload();
  };
  topBtn.onclick = () => (user ? signOutHere() : signIn());
  if (coverBtn) coverBtn.onclick = signIn;

  A.onAuthStateChanged(auth, async (u) => {
    if (!u) { user = role = null; render(); return; }
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
    for (const k of syncKeys()) if (!(k in cloud)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(cloud)) if (SYNC.test(k) && typeof v === 'string') setItem.call(localStorage, k, v);
    user = u; role = r; render();
    // 換了進度：重新整理讓遊戲讀到新的（同一個分頁只重整一次，避免開場自動寫入的值造成一直重整）
    let reloaded = false; try { reloaded = sessionStorage.getItem('campus-auth-reload') === u.uid; sessionStorage.setItem('campus-auth-reload', u.uid); } catch { /* 私密模式 */ }
    if (!reloaded && JSON.stringify(snapshot()) !== before) { location.reload(); return; }
    if (!reloaded || JSON.stringify(snapshot()) !== before) upload();
    toast(T(`👋 已登入（${r === 'teacher' ? '老師' : '學生'}），進度會自動存起來`, `👋 Signed in (${r}). Progress will be saved.`));
  });
  render();
}
