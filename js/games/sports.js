/* 羽球、桌球、投籃比賽、樂樂棒球
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import * as THREE from 'three';
import { mat, Batch, SPOTS, makeRacket, makeShuttle, animatePerson } from '../blocks.js?v=309';
import { T, WALL_T, floors, rooms, isWalkable, groundAt, scene, makeLabel, player, avatar, placeAt, mode, keys, stopAuto, joy, toast, BB, placeNPC, npcFace, act, powerBox, spotFloor, limbs, resetPose, gameState, ball, startShot, shoot } from '../app.js?v=309';

/* ---------------- 羽球小遊戲：在操場或活動中心遇到會打羽球的老師，就可以跟老師對打 ----------------
   架起球網、學生站到 6 公尺外；左右移動接球（A D／← →／搖桿），羽毛球飛到身邊時按 F／空白鍵（手機按橘色按鈕）揮拍。
   時機抓得很準就是「殺球」；漏接就結束，記錄最高來回數。 */

const BADMINTON_KEY = 'campus-badminton-best';
const shuttle = makeShuttle(); shuttle.scale.setScalar(1.8); shuttle.visible = false; scene.add(shuttle);
const myRacket = makeRacket(), npcRacket = makeRacket();
for (const r of [myRacket, npcRacket]) { r.position.set(0, -0.6, 0); r.rotation.x = Math.PI; }   // 接在手上，當成手臂的延伸
const badmintonNet = (() => {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const c = cv.getContext('2d'); c.strokeStyle = 'rgba(25,25,25,.9)';
  for (let x = 0; x <= 256; x += 4) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, 32); c.stroke(); }
  for (let y = 0; y <= 32; y += 4) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(256, y + 0.5); c.stroke(); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 0.76), new THREE.MeshLambertMaterial({ map: tx, transparent: true, side: THREE.DoubleSide }));
  net.position.y = 1.17; g.add(net);
  const white = new THREE.MeshLambertMaterial({ color: '#f4f4f4' }), pole = new THREE.MeshLambertMaterial({ color: '#c9ccd1' });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.05, 0.02), white); tape.position.y = 1.55; g.add(tape);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.06), pole); p.position.set(sx * 3.08, 0.775, 0); g.add(p); }
  g.visible = false; scene.add(g);
  return g;
})();
// 羽球／桌球共用的參數（startBadminton 的第二個參數）
const BAD = { D: 6, Dmin: 3.5, net: badmintonNet, mine: myRacket, theirs: npcRacket, ball: shuttle, key: BADMINTON_KEY, icon: '🏸', ballName: '羽毛球', ballNameEn: 'shuttlecock',
  myH: 1.2, npcH: 1.95, arc: 2.0, T0: 1.65, Tmin: 0.85, spread: 2.2, side: 2.6, speed: 4.6, reach: 1.0, smash: '殺球' };

/* ---------------- 桌球：在三年五班遇到林老師，說「好啊」就一起瞬間移動到 B1 桌球教室那張球桌開打 ----------------
   跟羽球一樣左右移動、球飛到身邊時揮拍；打完（或按結束）兩個人一起回到教室 */
const ppBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
ppBall.visible = false; scene.add(ppBall);
const makePaddle = () => {                                             // 桌球拍：一面紅、一面黑，木頭握把
  const g = new THREE.Group();
  // 拍面朝前後（從學生背後、老師正面都看得到整個圓；側著的話只剩一條線）；方塊人手大，拍子做大一點
  for (const [col, z] of [['#d32f2f', 0.012], ['#222222', -0.012]]) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.024, 20).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: col }));
    face.position.set(0, -0.27, z); g.add(face);
  }
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.04), new THREE.MeshLambertMaterial({ color: '#c08a4a' })); h.position.y = -0.06; g.add(h);
  g.position.set(0, -0.5, 0);                                          // 從手掌往外伸（不要翻轉，翻了拍面會縮回手臂裡被蓋住）
  return g;
};
const myPaddle = makePaddle(), npcPaddle = makePaddle();
// B1 那張比賽用的球桌（furniture.js tableTennisHall 也在 u=8.7、v=2.5 放了一張）
const ppTable = () => { const r = rooms.find((x) => x.name === '桌球教室'); return { f: r.f, x: (r.m.x1 + r.m.x2) / 2 + 2.5, z: r.m.z1 + WALL_T / 2 + 0.02 + 8.7 }; };
function startPingpong(n) {
  stopAuto();
  const home = { f: n.f, pos: n.g.position.clone(), yaw: n.yaw, px: player.x, pz: player.z, pyaw: player.yaw };
  const tb = ppTable();                                                // 不要叫 T：會蓋掉中英文切換的 T()
  toast(`🏓 ${n.name}：好！我們去地下室桌球教室！`);
  // 瞬間移動：老師站球桌西邊、面向東；學生由 startBadminton 放到球桌東邊
  placeNPC(n, tb.f, tb.x - 2.35, tb.z, -Math.PI / 2);
  n.label.visible = false;
  startBadminton(n, { ...BAD, D: 4.7, Dmin: 4.7, net: null, mine: myPaddle, theirs: npcPaddle, ball: ppBall, key: 'campus-pingpong-best', icon: '🏓', ballName: '桌球', ballNameEn: 'ball',
    myH: 0.95, npcH: 0.95, arc: 0.32, T0: 1.05, Tmin: 0.6, spread: 0.6, side: 0.9, speed: 3.2, reach: 0.65, smash: '殺球', pp: true,
    onStop() {
      setTimeout(() => {                                               // 打完：一起回教室
        placeNPC(n, home.f, home.pos.x, home.pos.z, home.yaw); n.label.visible = true;
        placeAt(home.f, home.px, home.pz, home.pyaw);
        toast(`${T('🏓 回到教室囉！', '🏓 Back to the classroom!')}${n.name}：${n.ppBack ?? '請保持安靜～'}`);
      }, 400);
    } });
}
function startBadminton(n, P = BAD) {
  stopAuto();
  const f = n.f, T0 = n.g.position.clone(), yaw0 = n.yaw;
  // 球場方向＝老師面向的方向；學生站 6 公尺外（站不下就近一點）
  const ux = -Math.sin(yaw0), uz = -Math.cos(yaw0);
  let D = P.D;
  while (D > P.Dmin && !isWalkable(f, T0.x + ux * D, T0.z + uz * D, 0.3)) D -= 0.5;
  const rx = uz, rz = -ux;                                            // 學生面向老師時的「右手邊」
  const P0 = { x: T0.x + ux * D, z: T0.z + uz * D };
  const ground = (x, z) => f.y + groundAt(f, x, z);
  const face = Math.atan2(ux, uz);                                    // 學生面向老師
  let me = 0, them = 0, themTo = 0;                                   // 左右偏移（公尺）
  const myAt = () => [P0.x + rx * me, P0.z + rz * me];
  const npcAt = () => [T0.x + rx * them, T0.z + rz * them];
  const mx0 = T0.x + ux * D / 2, mz0 = T0.z + uz * D / 2;
  if (P.net) { P.net.position.set(mx0, ground(mx0, mz0), mz0); P.net.rotation.y = Math.atan2(-rz, rx); P.net.visible = true; }
  placeAt(f, P0.x, P0.z, face); avatar.rotation.y = face; player.pitch = 0.08;
  const L = limbs(); L?.armR.add(P.mine);
  const nL = n.g.userData.limbs, nArm = n.look.holdL === 'racket' ? nL.armL : nL.armR;   // 陳老師本來就左手拿拍
  if (nArm === nL.armR || P.pp) nArm.add(P.theirs);
  n.playing = true;
  for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);    // 放下打招呼的手（左手拿拍的老師，右手才不會一直舉著）
  const tFace = Math.atan2(-ux, -uz);                                 // 老師面向學生
  n.g.rotation.y = tFace;
  let best = 0; try { best = +localStorage.getItem(P.key) || 0; } catch { /* 私密模式 */ }
  const touch = matchMedia('(pointer: coarse)').matches;
  toast(touch ? T(`${P.icon} 用搖桿左右移動，${P.ballName}飛到身邊時按橘色按鈕揮拍！`, `${P.icon} Move left and right with the joystick. Press the orange button when the ${P.ballNameEn} comes!`)
    : T(`${P.icon} 用 A D 或 ← → 左右移動，${P.ballName}飛到身邊時按 F 或空白鍵揮拍！`, `${P.icon} Move with A D or ← →. Press F or Space to swing when the ${P.ballNameEn} comes!`));

  let rally = 0, t = 0, fl = null, swing = 9, npcSwing = 9, phase = 0, moving = 0, over = 0, serveAt = 1.6;
  const SEX = P.myH;                                                   // 學生擊球高度（學生比例比較小）
  // 羽毛球飛行：a → b 直線＋拋物線（H＝最高點比直線高多少）；k>1 之後沿著同一條拋物線繼續往下掉
  const launch = (a, b, T, H, toMe) => { fl = { a, b, T, H, t: 0, toMe, hit: false }; P.ball.visible = true; };
  const flAt = (k) => {
    const { a, b, H } = fl;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 4 * H * k * (1 - k), a[2] + (b[2] - a[2]) * k];
  };
  const npcShot = () => {
    // 老師回球：越打越快、越打越刁
    const off = (Math.random() * 2 - 1) * Math.min(P.spread, 0.6 * P.spread / 2.2 + rally * 0.18 * P.spread / 2.2);
    const [nx, nz] = npcAt();
    const T = Math.max(P.Tmin, P.T0 - rally * 0.06 * P.T0 / 1.65);
    launch([nx, ground(nx, nz) + P.npcH, nz], [P0.x + rx * off, ground(P0.x, P0.z) + SEX, P0.z + rz * off], T, P.arc, true);
    npcSwing = 0;
  };
  const end = () => {
    over = 1;
    if (rally > best) { best = rally; try { localStorage.setItem(P.key, String(best)); } catch { /* 私密模式 */ } }
  };
  act.busy = {
    badminton: true, pp: !!P.pp,
    get label() { return over ? T(`${P.icon} 來回 <b>${rally}</b> 球　最高 ${best}`, `${P.icon} Rally <b>${rally}</b>　Best ${best}`) : T(`${P.icon} 揮拍 <kbd>F</kbd>　來回 <b>${rally}</b>　最高 ${best}`, `${P.icon} Swing <kbd>F</kbd>　Rally <b>${rally}</b>　Best ${best}`); },
    tick(dt) {
      t += dt;
      if (mode === 'bird' || player.floor !== f) { this.stop(); return; }
      // 左右移動
      if (!over) {
        let mv = 0;
        if (keys.KeyA || keys.ArrowLeft) mv -= 1;
        if (keys.KeyD || keys.ArrowRight) mv += 1;
        mv += joy.x;
        mv = Math.max(-1, Math.min(1, mv));
        me = Math.max(-P.side, Math.min(P.side, me + mv * P.speed * dt));
        if (Math.abs(mv) > 0.05) phase += dt * 9;
        moving += ((Math.abs(mv) > 0.05 ? 1 : 0) - moving) * Math.min(1, dt * 10);
      }
      const [px, pz] = myAt();
      player.x = px; player.z = pz; player.gy = groundAt(f, px, pz);
      player.yaw = face; avatar.rotation.y = face;
      // 老師跑去接球
      them += Math.max(-6 * dt, Math.min(6 * dt, themTo - them));
      const [nx, nz] = npcAt();
      n.g.position.set(nx, ground(nx, nz), nz); n.g.rotation.y = tFace;
      // 手臂：學生準備姿勢／揮拍；老師也一樣
      swing += dt; npcSwing += dt;
      const arm = (a, s) => {
        if (s < 0.25) { a.rotation.set(-2.2 - (s / 0.25) * 2.4, 0, 0.15); return; }      // 由上往前揮下去
        a.rotation.set(-2.2, 0, 0.35);                                                     // 舉拍準備
      };
      if (L) {
        animatePerson(avatar, phase, over ? 0 : moving);
        arm(L.armR, swing);
      }
      arm(nArm, npcSwing);
      // 發球
      if (!fl && !over) { if (t > serveAt) npcShot(); return; }
      if (!fl) { if (over && (over += dt) > 2.2) this.stop(); return; }
      fl.t += dt;
      const k = fl.t / fl.T, p = flAt(k), q = flAt(k + 0.01);
      P.ball.position.set(p[0], p[1], p[2]);
      const v = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize();
      P.ball.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v);       // 球頭在前面
      if (!fl.toMe && k >= 1) {                                       // 老師接到了，打回來
        npcShot();
        return;
      }
      if (fl.toMe && !over && fl.t > fl.T + 0.18) end();          // 來不及了
      if (p[1] <= ground(p[0], p[2]) + 0.04) {                          // 掉到地上
        P.ball.position.y = ground(p[0], p[2]) + 0.04;
        fl = null;
        if (!over) end();
        npcFace(n, 'happy', 3);                                           // 老師笑了
        toast(rally > 0 && rally >= best ? T(`${P.icon} 漏接了！來回 ${rally} 球，新紀錄！🎉`, `${P.icon} Missed! Rally of ${rally}, new record! 🎉`) : T(`${P.icon} 漏接了！這局來回 ${rally} 球（最高 ${best} 球）`, `${P.icon} Missed! Rally of ${rally} (best ${best})`));
      }
    },
    press() {
      if (over) return;
      if (swing < 0.3) return;                                        // 揮拍中
      swing = 0;
      if (!fl || !fl.toMe || fl.hit) return;
      const tl = fl.T - fl.t, [px, pz] = myAt(), d = Math.hypot(fl.b[0] - px, fl.b[2] - pz);
      if (tl > 0.3 || tl < -0.18 || d > P.reach) return;                  // 太早、太晚、太遠：揮空
      fl.hit = true; rally++;
      const smash = Math.abs(tl) < 0.08 && d < P.reach * 0.6;
      const off = (Math.random() * 2 - 1) * P.spread * 0.8;
      themTo = off;
      const [qx, qz] = [T0.x + rx * off, T0.z + rz * off];
      const sp = P.ball.position;
      launch([sp.x, sp.y, sp.z], [qx, ground(qx, qz) + P.npcH, qz], smash ? P.T0 * 0.42 : P.T0 * 0.8, smash ? P.arc * 0.18 : P.arc * 1.1, false);
      if (smash) { toast(T(`💥 ${P.smash}！（來回 ${rally} 球）`, `💥 Smash! (rally ${rally})`)); npcFace(n, 'surprised', 1.4); }
      else if (rally % 5 === 0) { toast(T(`${P.icon} 好球！來回 ${rally} 球`, `${P.icon} Nice! Rally ${rally}`)); npcFace(n, 'happy', 1.4); }
    },
    stop() {
      P.mine.removeFromParent(); P.theirs.removeFromParent();
      P.ball.visible = false; if (P.net) P.net.visible = false;
      n.playing = false; n.g.position.copy(T0); n.g.rotation.y = yaw0;
      for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);
      resetPose(); act.busy = null;
      P.onStop?.();
    },
  };
}

/* ---------------- 投籃比賽：跟鄧老師輪流投 5 球（操場籃球場、活動中心） ----------------
   站在罰球線附近；你用原本的力道條投籃，老師自動投（大約八成命中）；投完比分數。 */

const SHOOTOUT_KEY = 'campus-shootout-wins', SHOOTOUT_N = 5;
function startShootout(n) {
  stopAuto();
  // shootAt：老師在教室裡（李老師），先一起瞬間移動到操場籃球場；比完（或中止）再回教室
  let home = null;
  if (n.shootAt && n.f !== floors[1]) {
    home = { f: n.f, x: n.g.position.x, z: n.g.position.z, yaw: n.yaw };
    const [x, z, yaw] = n.shootAt(); placeNPC(n, floors[1], x, z, yaw); n.label.visible = false;
  }
  const goHome = () => {
    if (!home) return;
    placeNPC(n, home.f, home.x, home.z, home.yaw); n.label.visible = true;
    placeAt(home.f, home.x - Math.sin(home.yaw) * 1.6, home.z - Math.cos(home.yaw) * 1.6, home.yaw + Math.PI);
    home = null;
  };
  const f = n.f, T0 = n.g.position.clone(), yaw0 = n.yaw;
  // 找老師附近（同一層）最近的籃框
  let sp = null, bd = Infinity;
  for (const h of SPOTS) {
    if (h.kind !== 'hoop' || spotFloor(h) !== f) continue;
    const d = Math.hypot(h.x - T0.x, h.z - T0.z);
    if (d < bd) { bd = d; sp = h; }
  }
  if (!sp) { toast(T('這裡沒有籃框耶！', 'There is no hoop here!')); return; }
  // 你站罰球線（籃框前 4.2 公尺），老師站在旁邊 1.4 公尺
  const D = 4.2, rx = -sp.fz, rz = sp.fx;
  const P = { x: sp.x + sp.fx * D, z: sp.z + sp.fz * D };
  let side = 1.4;
  if (!isWalkable(f, P.x + rx * side, P.z + rz * side, 0.3)) side = -1.4;
  const Q = { x: P.x + rx * side, z: P.z + rz * side };
  const faceHoop = (x, z) => Math.atan2(-(sp.x - x), -(sp.z - z));
  placeAt(f, P.x, P.z, faceHoop(P.x, P.z)); avatar.rotation.y = player.yaw;
  n.playing = true;
  const nL = n.g.userData.limbs;
  for (const key of ['armL', 'armR']) nL[key].rotation.set(0, 0, 0);   // 放下打招呼的手
  const stand = () => { n.g.position.set(Q.x, f.y + groundAt(f, Q.x, Q.z), Q.z); n.g.rotation.y = faceHoop(Q.x, Q.z); };
  stand();
  let me = 0, them = 0, k = 0, wins = 0;
  try { wins = +localStorage.getItem(SHOOTOUT_KEY) || 0; } catch { /* 私密模式 */ }
  const score = () => `${T('你', 'You')} <b>${me}</b>：<b>${them}</b> ${n.name}`;
  // 等一下再做下一步（用 act.busy 計時，畫面上顯示比分）
  const wait = (sec, label, next) => { let t = 0; act.busy = { label, tick(dt) { if ((t += dt) > sec) next(); } }; };
  const finish = () => {
    gameState.duel = null;
    n.playing = false; n.g.position.copy(T0); n.g.rotation.y = yaw0;
    for (const key of ['armL', 'armR']) nL[key].rotation.set(0, 0, 0);
    act.busy = null;
    goHome();
  };
  const myTurn = () => {
    k++;
    placeAt(f, P.x, P.z, faceHoop(P.x, P.z));
    startShot(sp, {
      quiet: true,
      label: T(`🏀 第 ${k} / ${SHOOTOUT_N} 球，出手！ <kbd>F</kbd>　${score()}`, `🏀 Shot ${k} / ${SHOOTOUT_N}, shoot! <kbd>F</kbd>　${score()}`),
      onDone: (made) => {
        if (made) me++;
        toast(made ? T(`🏀 你投進了！（${me}：${them}）`, `🏀 You scored! (${me}:${them})`) : T(`😣 你沒進（${me}：${them}）`, `😣 You missed (${me}:${them})`));
        npcFace(n, made ? 'surprised' : 'tongue', 1.5);
        wait(1.0, T(`🏀 換${n.name}投　${score()}`, `🏀 ${n.name}'s turn　${score()}`), theirTurn);
      },
    });
  };
  const theirTurn = () => {
    // 老師舉手瞄準一下再出手
    let t = 0;
    act.busy = {
      label: T(`🏀 ${n.name}瞄準中…　${score()}`, `🏀 ${n.name} is aiming…　${score()}`),
      tick(dt) {
        t += dt;
        nL.armL.rotation.x = nL.armR.rotation.x = -2.5 - Math.min(1, t / 0.6) * 0.4;
        if (t < 0.7) return;
        const y = n.g.position.y + 2.05;
        shoot(sp, 0, 0, 0, {
          quiet: true, made: Math.random() < 0.8, limbs: nL, from: { x: Q.x, y, z: Q.z },
          label: T(`🏀 ${n.name}出手！　${score()}`, `🏀 ${n.name} shoots!　${score()}`),
          onDone: (made) => {
            if (made) them++;
            toast(made ? T(`🏀 ${n.name}投進了！（${me}：${them}）`, `🏀 ${n.name} scored! (${me}:${them})`) : T(`${n.name}沒進！（${me}：${them}）`, `${n.name} missed! (${me}:${them})`));
            npcFace(n, made ? 'happy' : 'sad', 1.6);
            if (k < SHOOTOUT_N) wait(1.0, T(`🏀 換你投　${score()}`, `🏀 Your turn　${score()}`), myTurn);
            else wait(1.2, T(`🏁 比賽結束　${score()}`, `🏁 Game over　${score()}`), () => {
              if (me > them) { wins++; try { localStorage.setItem(SHOOTOUT_KEY, String(wins)); } catch { /* 私密模式 */ } }
              toast(me > them ? T(`🏆 你贏了！${me}：${them}（已經贏${n.name} ${wins} 次）`, `🏆 You win! ${me}:${them} (beat ${n.name} ${wins}×)`)
                : me === them ? T(`🤝 平手！${me}：${them}，再比一次？`, `🤝 A tie! ${me}:${them}. Play again?`) : T(`💪 ${n.name}贏了 ${them}：${me}，再接再厲！`, `💪 ${n.name} wins ${them}:${me}. Keep trying!`));
              finish();
              npcFace(n, me > them ? 'sad' : me === them ? 'wink' : 'happy', 3);
            });
          },
        });
      },
    };
  };
  gameState.duel = { quit() { powerBox.hidden = true; ball.visible = false; finish(); toast(T('🏀 比賽中止', '🏀 Game stopped')); } };
  toast(T(`🏀 投籃比賽！你跟${n.name}輪流投 ${SHOOTOUT_N} 球，進比較多球的贏。<br>綠色區域時按 F 出手！`, `🏀 Shootout! You and ${n.name} take turns for ${SHOOTOUT_N} shots each. Most baskets wins.<br>Press F in the green zone!`));
  wait(1.2, T(`🏀 準備…　${score()}`, `🏀 Get ready…　${score()}`), myTurn);
}

/* ---------------- 樂樂棒球（投打對決）：操場遊戲場西邊草地，張校長投球、你來打 ----------------
   看準球飛到本壘的時機按 F（或「揮棒」）：越準打越遠（全壘打、二壘安打、一壘安打），太早太晚是界外或揮空；
   偏掉的壞球不要揮，四壞球保送；三好球出局，三出局結束，記錄最高得分。 */

const BB_KEY = 'campus-baseball-best';
function buildBaseballField() {
  const f = floors[1], b = new Batch(), white = mat('wool', '#f8f8f4'), dirt = mat('wool', '#b8865a');
  const gy = (x, z) => f.y + groundAt(f, x, z);
  const H = BB.home, d = BB.side / Math.SQRT2;
  const bases = [[H.x + d, H.z - d], [H.x, H.z - 2 * d], [H.x - d, H.z - d]];
  b.box(dirt, 2.6, 0.03, 2.6, H.x, gy(H.x, H.z) + 0.015, H.z);                                        // 本壘區的紅土
  b.box(white, 0.43, 0.04, 0.43, H.x, gy(H.x, H.z) + 0.035, H.z);                                       // 本壘板
  for (const [x, z] of bases) { b.box(dirt, 1.6, 0.03, 1.6, x, gy(x, z) + 0.015, z); b.box(white, 0.38, 0.08, 0.38, x, gy(x, z) + 0.05, z); }
  const M2 = BB.mound; b.box(dirt, 2.0, 0.06, 2.0, M2.x, gy(M2.x, M2.z) + 0.03, M2.z); b.box(white, 0.6, 0.07, 0.15, M2.x, gy(M2.x, M2.z) + 0.04, M2.z);
  // 白色邊線：本壘往一壘、三壘
  for (const [x, z] of [bases[0], bases[2]]) {
    const len = Math.hypot(x - H.x, z - H.z), m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, len), white);
    m.position.set((x + H.x) / 2, gy(H.x, H.z) + 0.035, (z + H.z) / 2); m.rotation.y = Math.atan2(x - H.x, z - H.z); f.group.add(m);
  }
  b.build(f.group);
  f.labels.add(makeLabel('樂樂棒球場', 'T-BALL', H.x, gy(H.x, H.z) + 2.6, H.z + 1.5, { bg: '#1f3a7a', h: 0.8 }));
}
const bbBox = document.getElementById('bb');
const bbBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshLambertMaterial({ color: '#fffdf2' }));
bbBall.visible = false; scene.add(bbBall);
const myBat = (() => {                                                 // 木頭球棒：接在右手，當成手臂的延伸
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: '#d9a35a' }), grip = new THREE.MeshLambertMaterial({ color: '#2b2b2b' });
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), grip); h.position.y = -0.1; g.add(h);
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.6, 10), wood); br.position.y = -0.55; g.add(br);
  g.position.set(0, -0.62, 0);
  return g;
})();
function startBaseball(n) {
  stopAuto();
  const f = n.f, $ = (sel) => bbBox.querySelector(sel), H = BB.home;
  const gy = (x, z) => f.y + groundAt(f, x, z);
  const T0 = n.g.position.clone(), yaw0 = n.yaw;
  let best = 0; try { best = +localStorage.getItem(BB_KEY) || 0; } catch { /* 私密模式 */ }
  // 學生站在本壘旁邊（打擊區），面向投手丘；鏡頭在後面
  const bx = H.x - 0.75, bz = H.z + 0.15;
  placeAt(f, bx, bz, 0); avatar.rotation.y = 0; player.yaw = 0.18; player.pitch = -0.06;
  n.playing = true; n.g.rotation.y = Math.PI;
  const L = limbs(), nL = n.g.userData.limbs;
  if (L) { L.armR.add(myBat); L.armR.rotation.order = 'YXZ'; }
  let strikes = 0, balls = 0, outs = 0, runs = 0, bases = [0, 0, 0], done = false;
  let t = 0, nextAt = 1.4, wind = -1, pitch = null, hit = null, swingT = 9, over = 0;
  const dots = (k, n2, col) => (k = Math.min(k, n2), '●'.repeat(k)).replace(/●/g, `<i style="color:${col}">●</i>`) + '○'.repeat(n2 - k);
  const show = () => {
    $('.runs').innerHTML = `得分 <b>${runs}</b>　最高 ${best}`;
    $('.s').innerHTML = dots(strikes, 2, '#f2b134'); $('.b').innerHTML = dots(balls, 3, '#3fbf5a'); $('.o').innerHTML = dots(outs, 2, '#e8573a');
    $('.bases').textContent = `壘包 ${['一', '二', '三'].map((x, i) => (bases[i] ? '◆' : '◇') + x).join(' ')}`;
  };
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const advance = (k) => {                                               // 跑者往前 k 個壘，打者上 k 壘（k=4 全壘打）
    const nb = [0, 0, 0];
    for (let i = 2; i >= 0; i--) if (bases[i]) { if (i + k >= 3) runs++; else nb[i + k] = 1; }
    if (k >= 4) runs++; else nb[k - 1] = 1;
    bases = nb;
  };
  const walk = () => {                                                   // 保送：被擠到的跑者才往前
    const nb = [...bases];
    if (nb[0]) { if (nb[1]) { if (nb[2]) runs++; nb[2] = 1; } nb[1] = 1; }
    nb[0] = 1; bases = nb;
  };
  const newBatter = () => { strikes = 0; balls = 0; };
  const out = (text) => {
    outs++; newBatter();
    msg(`${text}　出局！`, 'no'); npcFace(n, 'wink', 1.6);
    if (outs >= 3) {
      over = 1;
      if (runs > best) { best = runs; try { localStorage.setItem(BB_KEY, String(best)); } catch { /* 私密模式 */ } }
      setTimeout(() => {
        if (done) return;
        finish();
        toast(runs > 0 ? `⚾ 三出局！你拿下 <b>${runs}</b> 分（最高 ${best} 分）<br>${n.name}：打得真好！你好棒，下次再來挑戰！`
          : `⚾ 三出局！這次沒有得分<br>${n.name}：沒關係，看準球再揮，你一定可以的！`);
      }, 1800);
    }
  };
  const strike = (text) => { if (++strikes >= 3) out(`${text}　三振`); else { msg(`${text}　好球！`, 'no'); } };
  // 投球：從校長手上飛到本壘前方（好球在本壘上，壞球偏到外面）
  const throwBall = () => {
    const wide = Math.random() < 0.22, T = 0.95 + Math.random() * 0.45;
    const s0 = T0, a = [s0.x + 0.3, gy(s0.x, s0.z) + 1.55, s0.z + 0.4];
    const b2 = [H.x + (wide ? (Math.random() < 0.5 ? -1 : 1) * 1.1 : (Math.random() - 0.5) * 0.25), gy(H.x, H.z) + 0.75 + (wide ? 0.3 : 0), H.z - 0.1];
    pitch = { a, b: b2, T, t: 0, wide, swung: false }; bbBall.visible = true;
  };
  const ballAt = (P, k) => [P.a[0] + (P.b[0] - P.a[0]) * k, P.a[1] + (P.b[1] - P.a[1]) * k + 4 * (P.h || 0.25) * k * (1 - k), P.a[2] + (P.b[2] - P.a[2]) * k];
  // 打出去：依結果飛不同遠、不同高
  const fly = (kind) => {
    const p = bbBall.position, ang = kind === 'foul' ? (Math.random() < 0.5 ? -1 : 1) * (1.15 + Math.random() * 0.3) : (Math.random() - 0.5) * 0.7;
    const dist = { hr: 42, two: 22, one: 11, foul: 12 }[kind], h = { hr: 14, two: 6, one: 1.2, foul: 5 }[kind];
    const tx = p.x + Math.sin(ang) * dist, tz = p.z - Math.cos(ang) * dist;
    hit = { a: [p.x, p.y, p.z], b: [tx, gy(tx, tz) + 0.11, tz], T: { hr: 2.4, two: 1.7, one: 1.0, foul: 1.2 }[kind], t: 0, h };
  };
  const judge = (dtArr) => {                                              // dtArr：揮棒時間 − 球到本壘的時間
    const e = Math.abs(dtArr);
    if (pitch.wide) { strike('😅 壞球不要揮喔！揮棒落空'); return; }
    if (e < 0.06) { fly('hr'); advance(4); newBatter(); msg('💥 全壘打！！', 'ok'); npcFace(n, 'surprised', 2); toast(`⚾ 全壘打！${n.name}：哇！你好棒！`); return; }
    if (e < 0.12) { fly('two'); advance(2); newBatter(); msg('⚾ 二壘安打！', 'ok'); npcFace(n, 'happy', 1.8); return; }
    if (e < 0.2) { fly('one'); advance(1); newBatter(); msg('⚾ 一壘安打！', 'ok'); npcFace(n, 'happy', 1.6); return; }
    if (e < 0.28) { fly('foul'); if (strikes < 2) strikes++; msg(dtArr < 0 ? '界外球！（揮太早了）' : '界外球！（揮太晚了）'); return; }
    strike(dtArr < 0 ? '揮太早了，揮棒落空' : '揮太晚了，揮棒落空');
  };
  const finish = () => {
    done = true; bbBox.hidden = true; bbBall.visible = false;
    myBat.removeFromParent(); if (L) L.armR.rotation.order = 'XYZ';
    n.playing = false; n.g.position.copy(T0); n.g.rotation.y = yaw0;
    for (const k of ['armL', 'armR']) nL[k].rotation.set(0, 0, 0);
    resetPose(); act.busy = null; gameState.duel = null;
  };
  act.busy = {
    label: '',                                                              // 揮棒鈕在上面的視窗裡（F 也可以）
    tick(dt) {
      if (done) return;
      t += dt; swingT += dt;
      player.x = bx; player.z = bz; avatar.rotation.y = 0;
      // 學生：準備姿勢（球棒扛在右後方）→ 揮棒（往左前方掃過去）
      if (L) {
        const s = Math.min(1, swingT / 0.22);
        L.armR.rotation.set(1.45 - (swingT < 0.22 ? 0 : 0.2), swingT < 0.6 ? 1.3 - 2.9 * s : 1.3, 0);
        L.armL.rotation.set(0.9, 0.5, 0);
      }
      // 校長：準備投球（舉手）→ 出手
      if (!pitch && !hit && !over && t > nextAt && wind < 0) wind = 0;
      if (wind >= 0) {
        wind += dt;
        nL.armR.rotation.set(-2.4 + wind * 2.5, 0, 0);
        if (wind > 0.55) { wind = -1; throwBall(); nL.armR.rotation.set(1.2, 0, 0); }
      }
      if (pitch) {
        pitch.t += dt;
        const k = pitch.t / pitch.T, p = ballAt(pitch, k);
        bbBall.position.set(...p);
        if (k > 1.35) {                                                     // 沒有揮（或揮空）：球過去了
          if (!pitch.swung) {
            if (pitch.wide) { if (++balls >= 4) { walk(); newBatter(); msg('四壞球保送！走上一壘 🚶', 'ok'); } else msg('壞球！看得好 👀'); }
            else strike('🙈 沒揮棒');
          }
          pitch = null; bbBall.visible = false; nextAt = t + 1.5; nL.armR.rotation.set(0, 0, 0); show();
        }
      }
      if (hit) {
        hit.t += dt;
        const k = Math.min(1, hit.t / hit.T);
        bbBall.position.set(...ballAt({ a: hit.a, b: hit.b, h: hit.h }, k));
        if (hit.t > hit.T + 0.6) { hit = null; bbBall.visible = false; nextAt = t + 1.0; show(); }
      }
    },
    press() {
      if (done || over || swingT < 0.5) return;
      swingT = 0;
      if (!pitch || pitch.swung) return;
      const dtArr = pitch.t - pitch.T;
      if (dtArr < -0.35) return;                                              // 球還很遠：只是空揮一下
      pitch.swung = true;
      judge(dtArr);
      if (hit) { pitch = null; nL.armR.rotation.set(0, 0, 0); }
      show();
    },
  };
  $('.swing').onclick = () => act.busy?.press?.();
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(`⚾ 下次再來找${n.name}打樂樂棒球！`); } };
  bbBox.hidden = false;
  msg(`${n.name}：小朋友好！看準球飛到本壘再揮棒，壞球不要揮喔！`);
  show();
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  badminton: (s) => startBadminton(s.npc), pingpong: (s) => startPingpong(s.npc), shootout: (s) => startShootout(s.npc), baseball: (s) => startBaseball(s.npc),
};
