/* 小遊戲共用的小工具
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import { isWalkable, canGo, rooms, player, avatar, placeAt } from '../app.js?v=357';

// 面對面的小遊戲（猜拳、直笛）：站到老師斜前方 2.2 公尺（偏右一點），鏡頭才不會被自己擋住老師；
//   先把這層的名牌收起來，老師轉過來面向你、放下打招呼的手
function faceTeacher(n) {
  const T = n.g.position, fx = -Math.sin(n.yaw), fz = -Math.cos(n.yaw), rx = -fz, rz = fx;
  let px = T.x + fx * 2.2 + rx * 1.0, pz = T.z + fz * 2.2 + rz * 1.0;
  if (!isWalkable(n.f, px, pz, 0)) { px = T.x + fx * 2.2 - rx * 1.0; pz = T.z + fz * 2.2 - rz * 1.0; }
  // 那個位置被家具擋住（例如潛能教室三的電視櫃）：換近一點、空著的位置；都不行就照舊
  if (!canGo(n.f, px, pz)) {
    const rm = rooms.find((r) => r.f === n.f && T.x > r.m.x1 && T.x < r.m.x2 && T.z > r.m.z1 && T.z < r.m.z2);      // 要在同一間，不要隔著牆
    const alt = [[2.2, -1], [1.8, 0.7], [1.8, -0.7], [1.5, 0.4], [1.5, -0.4], [1.3, 0.3], [1.3, -0.3]].map(([f, r]) => [T.x + fx * f + rx * r, T.z + fz * f + rz * r]).find(([x, z]) => canGo(n.f, x, z) && (!rm || (x > rm.m.x1 && x < rm.m.x2 && z > rm.m.z1 && z < rm.m.z2)));
    if (alt) [px, pz] = alt;
  }
  const faceYaw = Math.atan2(-(T.x - px), -(T.z - pz));
  placeAt(n.f, px, pz, faceYaw); avatar.rotation.y = faceYaw; player.pitch = -0.05;
  player.yaw = faceYaw + 0.42;                                         // 角色面向老師，鏡頭偏一點角度，老師就在角色旁邊、不會被擋住
  n.f.labels.visible = false;
  n.g.rotation.y = Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z);
  for (const k of ['armL', 'armR']) n.g.userData.limbs[k].rotation.set(0, 0, 0);
}

export { faceTeacher };
