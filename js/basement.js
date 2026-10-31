import * as THREE from 'three';
import { mat } from './blocks.js?v=277';

/* =========================================================
 * 勤學樓地下室（丙梯～丁梯）：交通安全教室
 *   依使用者 10-30 的 37 張照片：長長的一條大廳，兩側黃色壁柱、牆上整面交通安全宣導壁畫，
 *   地上白線、斑馬線、體操墊、跳箱、平衡木、足球門；東端（丁梯那邊）有一台「溪口巴士」。
 *   u：西（丙梯）→ 東（丁梯）；v：北牆 -W/2、南牆 +W/2
 *   壁畫、海報都是用程式畫的示意圖（不是照片），標題照牆上的字。
 * ========================================================= */

const FONT = '"Noto Sans TC","Microsoft JhengHei",sans-serif';
const T = {};
const once = (k, f) => (T[k] ||= f());
function tex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const lam = (key, w, h, draw) => once(key, () => new THREE.MeshLambertMaterial({ map: tex(w, h, draw) }));
const flat = (color) => mat('wool', color);

/* ---------- 畫圖小工具 ---------- */
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function wrap(c, text, x, y, maxW, lh) {
  let line = '', yy = y;
  for (const ch of text) { if (c.measureText(line + ch).width > maxW) { c.fillText(line, x, yy); line = ch; yy += lh; } else line += ch; }
  if (line) { c.fillText(line, x, yy); yy += lh; }
  return yy;
}
const RAINBOW = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
function mascot(c, x, y, r) {                               // 彩虹圈大眼睛（溪口的小吉祥物）：彩虹色圓環、黑瞳孔、兩隻小腳
  RAINBOW.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r * (1 - i * 0.075), 0, 7); c.fill(); });
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * 0.55, 0, 7); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(x + r * 0.1, y + r * 0.05, r * 0.3, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x + r * 0.2, y - r * 0.06, r * 0.1, 0, 7); c.fill();
  c.fillStyle = '#222'; c.beginPath(); c.ellipse(x - r * 0.3, y + r * 1.08, r * 0.22, r * 0.12, 0, 0, 7); c.ellipse(x + r * 0.3, y + r * 1.08, r * 0.22, r * 0.12, 0, 0, 7); c.fill();
}
function car(c, x, y, w, col) {                             // 側面小汽車（x、y 是左下角）
  const h = w * 0.42;
  c.fillStyle = col; rr(c, x, y - h * 0.62, w, h * 0.62, h * 0.12); c.fill();
  c.beginPath(); c.moveTo(x + w * 0.2, y - h * 0.6); c.lineTo(x + w * 0.32, y - h); c.lineTo(x + w * 0.7, y - h); c.lineTo(x + w * 0.82, y - h * 0.6); c.closePath(); c.fill();
  c.fillStyle = '#cfe8f7'; c.beginPath(); c.moveTo(x + w * 0.26, y - h * 0.62); c.lineTo(x + w * 0.35, y - h * 0.92); c.lineTo(x + w * 0.66, y - h * 0.92); c.lineTo(x + w * 0.76, y - h * 0.62); c.closePath(); c.fill();
  c.fillStyle = '#222'; for (const k of [0.24, 0.76]) { c.beginPath(); c.arc(x + w * k, y, h * 0.16, 0, 7); c.fill(); }
}
function bus(c, x, y, w, col) {                             // 側面公車
  const h = w * 0.34;
  c.fillStyle = col; rr(c, x, y - h, w, h, h * 0.1); c.fill();
  c.fillStyle = '#cfe8f7'; for (let i = 0; i < 5; i++) c.fillRect(x + w * (0.06 + i * 0.16), y - h * 0.86, w * 0.12, h * 0.38);
  c.fillStyle = '#fff'; c.fillRect(x + w * 0.88, y - h * 0.9, w * 0.08, h * 0.76);
  c.fillStyle = '#222'; for (const k of [0.2, 0.78]) { c.beginPath(); c.arc(x + w * k, y, h * 0.16, 0, 7); c.fill(); }
}
function person(c, x, y, s, shirt) {                        // 小朋友／行人（腳底中心 x, y）
  c.fillStyle = '#f2c9a0'; c.beginPath(); c.arc(x, y - s * 1.55, s * 0.28, 0, 7); c.fill();
  c.fillStyle = '#3a2a22'; c.beginPath(); c.arc(x, y - s * 1.62, s * 0.28, Math.PI, 0); c.fill();
  c.fillStyle = shirt; rr(c, x - s * 0.3, y - s * 1.25, s * 0.6, s * 0.7, s * 0.1); c.fill();
  c.fillStyle = '#34495e'; c.fillRect(x - s * 0.26, y - s * 0.55, s * 0.22, s * 0.55); c.fillRect(x + s * 0.04, y - s * 0.55, s * 0.22, s * 0.55);
}
function triSign(c, x, y, s) {                              // 警告標誌（紅框黃底三角形）
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y - s * 0.55); c.lineTo(x + s * 0.55, y + s * 0.4); c.lineTo(x - s * 0.55, y + s * 0.4); c.closePath(); c.fill();
  c.strokeStyle = '#d32f2f'; c.lineWidth = s * 0.12; c.lineJoin = 'round'; c.stroke();
  c.fillStyle = '#222'; c.beginPath(); c.arc(x, y + s * 0.02, s * 0.1, 0, 7); c.fill(); c.fillRect(x - s * 0.05, y + s * 0.14, s * 0.1, s * 0.15);
}
function roundSign(c, x, y, r, ring, label, fg = '#222') {
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.strokeStyle = ring; c.lineWidth = r * 0.22; c.stroke();
  if (label) { c.fillStyle = fg; c.font = `900 ${r * 0.9}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y + r * 0.04); }
}
function zebraH(c, x, y, w, h, n) { c.fillStyle = '#fff'; for (let i = 0; i < n; i++) c.fillRect(x + (w / n) * i + w / n * 0.12, y, w / n * 0.62, h); }
function clouds(c, w, y0, n, seed = 7) {
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  c.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = y0 + rnd() * 90; for (const [dx, dy, r] of [[0, 0, 40], [40, -10, 50], [85, 4, 38]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, 7); c.fill(); } }
}
function road(c, x, y, w, h) {
  c.fillStyle = '#6f7479'; c.fillRect(x, y, w, h);
  c.fillStyle = '#fff'; for (let i = 0; i < w; i += 70) c.fillRect(x + i, y + h * 0.48, 36, 5);
  c.fillStyle = '#4caf50'; c.fillRect(x, y - 8, w, 8);
}

/* ---------- 壁畫 ---------- */

// 交通安全 5 大守則／5 大運動（北牆西段，藍天白雲＋下面一條馬路）
const rulesMat = () => lam('b1rules', 2048, 512, (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#9bd0f0'); sky.addColorStop(1, '#e8f5fc');
  c.fillStyle = sky; c.fillRect(0, 0, w, h); clouds(c, w, 120, 9);
  const title = (x, a, num, b) => {
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = `900 56px ${FONT}`;
    c.fillStyle = '#e8573a'; c.fillText(a, x, 62); let xx = x + c.measureText(a).width + 6;
    c.fillStyle = '#2e9a4a'; c.font = `900 84px ${FONT}`; c.fillText(num, xx, 58); xx += c.measureText(num).width + 6;
    c.fillStyle = '#2a5ab0'; c.font = `900 56px ${FONT}`; c.fillText(b, xx, 62);
  };
  title(60, '交通安全', '5', '大守則'); title(1050, '交通安全', '5', '大運動');
  const list = (x, items, cols) => {
    let y = 130; c.font = `600 25px ${FONT}`;
    items.forEach((t, i) => {
      c.fillStyle = cols[i]; c.beginPath(); c.arc(x + 16, y + 3, 14, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = `900 18px ${FONT}`; c.textAlign = 'center'; c.fillText(String(i + 1), x + 16, y + 4);
      c.fillStyle = '#1f3a8a'; c.font = `600 25px ${FONT}`; c.textAlign = 'left'; y = wrap(c, t, x + 42, y + 8, 880, 30) + 6;
    });
  };
  const cols = ['#e8573a', '#2e9a4a', '#2a5ab0', '#f08a1c', '#c0392b'];
  list(60, ['熟悉路權，遵守法規。（路權守法）', '我看得見您，您看得見我，交通最安全。（看見你我）', '謹守安全空間—不作沒有絕對安全把握之交通行為。（安全空間）', '養成利他用路觀—不作妨礙他人安全與方便之交通行為。（利他用路）', '防衛兼顧的安全用路行為—不作事故的製造者，也不成為無辜的事故受害者。（防衛兼顧）'], cols);
  list(1050, ['車頭朝外停車：不撞行人、迅速逃生、方便充電。', '乘客責任：協助駕駛人清醒與專心、全車生命保障。', '下車時向公車及計程車司機說「謝謝」：感恩鼓勵。', '對禮讓行人的車輛駕駛揮手點頭致謝：感謝與感動。', '保護長者及婦孺安全地穿越路口：公平正義與人性。'], cols);
  road(c, 0, 420, w, 70); zebraH(c, 860, 424, 150, 62, 5);
  car(c, 70, 470, 150, '#e0e0e0'); car(c, 300, 470, 130, '#f2c230'); car(c, 1730, 470, 170, '#d93a3a'); bus(c, 520, 470, 220, '#f2c230');
  person(c, 1030, 470, 52, '#e8573a'); person(c, 1075, 470, 46, '#3a8fd0'); person(c, 1120, 470, 50, '#2e9a4a'); person(c, 1500, 470, 52, '#8e44ad');
  mascot(c, 1280, 438, 20);
});

// 周邊安心走廊之愛心服務站商家（北牆，左邊紫色說明、右邊是附近街道地圖和商家照片）
const loveMat = () => lam('b1love', 2048, 540, (c, w, h) => {
  c.fillStyle = '#f1e7d6'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#9a8fd0'; c.fillRect(0, 0, 900, h);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(900, 0); c.bezierCurveTo(820, 160, 980, 330, 900, h); c.lineTo(960, h); c.bezierCurveTo(1040, 330, 880, 160, 960, 0); c.fill();
  c.fillStyle = '#7ec8f0'; c.beginPath(); c.moveTo(900, 0); c.bezierCurveTo(820, 160, 980, 330, 900, h); c.lineTo(980, h); c.bezierCurveTo(1060, 330, 900, 160, 980, 0); c.fill();
  c.fillStyle = '#8cd04a'; c.beginPath(); c.moveTo(980, 0); c.bezierCurveTo(900, 160, 1060, 330, 980, h); c.lineTo(1030, h); c.bezierCurveTo(1110, 330, 950, 160, 1030, 0); c.fill();
  c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = `800 38px ${FONT}`; c.fillText('周邊安心走廊之', 80, 56);
  c.font = `900 70px ${FONT}`; c.fillStyle = '#fff'; c.strokeStyle = '#5a4a9a'; c.lineWidth = 8; c.strokeText('愛心服務站商家', 80, 130); c.fillText('愛心服務站商家', 80, 130);
  c.fillStyle = '#f4f1fb'; rr(c, 60, 180, 780, 250, 24); c.fill();
  c.fillStyle = '#3a3a5a'; c.font = `500 20px ${FONT}`; let y = 205;
  for (const t of ['導護愛心商店協助支援項目：', '1. 協助維護學生上下學之安全，讓學生能快樂、平安的到校學習。', '2. 提供學生緊急事件如地震、火災、家庭暴力…等發生時，緊急避難之處所。', '3. 提供學生安全庇護（毆打、防搶、跟蹤、搭訕…等）。', '4. 當意外事故發生時，記錄相關資料，聯絡學校加以處理。', '5. 電話、雨具等借用服務。']) y = wrap(c, t, 80, y, 740, 24) + 2;
  c.fillStyle = '#f2994a'; for (let i = 0; i < 9; i++) c.fillRect(250 + i * 36, 440, 22, 18);
  c.fillStyle = '#fff'; c.fillRect(250, 458, 320, 60); c.fillStyle = '#7ec8f0'; c.fillRect(300, 468, 56, 50);
  person(c, 150, 520, 56, '#2e9a4a'); person(c, 640, 520, 56, '#2e9a4a'); mascot(c, 90, 470, 30);
  // 地圖：街道、河流、公園、小圖示
  c.fillStyle = '#f6efe0'; c.fillRect(1030, 0, 640, h);
  c.strokeStyle = '#a9aeb3'; c.lineWidth = 16; c.lineCap = 'round';
  for (const [x1, y1, x2, y2] of [[1060, 80, 1640, 40], [1100, 200, 1650, 150], [1070, 330, 1650, 300], [1100, 460, 1640, 420], [1200, 0, 1160, h], [1360, 0, 1330, h], [1520, 0, 1500, h], [1620, 0, 1610, h]]) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  c.fillStyle = '#8cd04a'; rr(c, 1280, 180, 160, 110, 20); c.fill(); c.fillStyle = '#f2994a'; c.beginPath(); c.arc(1360, 235, 36, Math.PI, 0); c.fill();
  c.fillStyle = '#2a5ab0'; c.font = `900 26px ${FONT}`; c.textAlign = 'center'; for (const [x, y] of [[1140, 300], [1420, 360], [1250, 90]]) c.fillText('P', x, y);
  for (const [x, y, col] of [[1180, 130, '#e8573a'], [1400, 100, '#f2994a'], [1560, 260, '#e8573a'], [1260, 400, '#2e9a4a'], [1480, 420, '#3a8fd0']]) { c.fillStyle = col; c.fillRect(x, y, 30, 26); c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 15, y - 16); c.lineTo(x + 34, y); c.fill(); }
  mascot(c, 1380, 40, 20); mascot(c, 1090, 470, 24);
  // 商家照片
  const photos = [[1690, 40, '#c0392b'], [1830, 40, '#7a5a3a'], [1950, 40, '#b8863a'], [1690, 230, '#2e9a4a'], [1830, 230, '#d93a3a'], [1950, 230, '#8a6a5a']];
  for (const [x, y, col] of photos) { c.fillStyle = '#fff'; rr(c, x - 6, y - 6, 124, 164, 14); c.fill(); c.fillStyle = col; rr(c, x, y, 112, 152, 10); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 8, y + 12, 96, 40); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 8, y + 90, 96, 50); }
  c.fillStyle = '#e8d8b8'; for (let i = 0; i < 5; i++) c.fillRect(1700 + i * 66, 440, 44, 80);
  c.fillStyle = '#7bbf4a'; for (let i = 0; i < 6; i++) c.fillRect(1700 + i * 56, 480 + (i % 2) * 14, 36, 40);
});

// 道路標線（南牆，綠底、一條大馬路、一格格的說明框）
const roadMat = () => lam('b1road', 2048, 512, (c, w, h) => {
  c.fillStyle = '#8cc63f'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#74b030'; for (let i = 0; i < 40; i++) c.fillRect(Math.sin(i * 12.9) * 1000 + 1000, (i * 53) % h, 90, 6);
  // 橫向主幹道
  c.fillStyle = '#7b8086'; c.fillRect(0, 230, w, 150);
  c.fillStyle = '#e8b81c'; c.fillRect(0, 300, w, 5); c.fillRect(0, 309, w, 5);
  c.fillStyle = '#fff'; for (let i = 0; i < w; i += 80) { c.fillRect(i, 262, 44, 4); c.fillRect(i + 20, 346, 44, 4); }
  // 十字路口、斑馬線
  c.fillStyle = '#7b8086'; c.fillRect(900, 0, 120, h);
  zebraH(c, 880, 226, 160, 36, 6); zebraH(c, 880, 346, 160, 36, 6);
  c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) c.fillRect(910 + i * 17, 140, 10, 70);
  // 鐵道平交道（斜斜的兩條鐵軌）
  c.strokeStyle = '#555'; c.lineWidth = 8; for (const o of [0, 40]) { c.beginPath(); c.moveTo(1500 + o, 40); c.lineTo(1330 + o, 470); c.stroke(); }
  c.strokeStyle = '#8a6a4a'; c.lineWidth = 6; for (let i = 0; i < 14; i++) { const t = i / 13; c.beginPath(); c.moveTo(1500 - 170 * t - 8, 40 + 430 * t); c.lineTo(1540 - 170 * t + 8, 40 + 430 * t); c.stroke(); }
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(1180, 262); c.lineTo(1260, 262); c.lineTo(1240, 346); c.lineTo(1160, 346); c.closePath(); c.fill();
  c.strokeStyle = '#7b8086'; c.lineWidth = 6; c.beginPath(); c.moveTo(1180, 262); c.lineTo(1240, 346); c.moveTo(1260, 262); c.lineTo(1160, 346); c.stroke();
  // 車子
  car(c, 560, 300, 90, '#d93a3a'); car(c, 1700, 366, 90, '#f2c230'); car(c, 300, 366, 90, '#e0e0e0');
  // 說明框
  const call = (x, y, bw, bh, title) => {
    c.fillStyle = '#fff'; rr(c, x, y, bw, bh, 12); c.fill();
    c.fillStyle = '#222'; c.font = `900 22px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(title, x + 12, y + 8);
    c.fillStyle = '#9aa0a6'; for (let i = 0; i < 3; i++) c.fillRect(x + 12, y + 40 + i * 16, bw - 24, 6);
  };
  call(60, 30, 250, 100, '快慢車道分隔線'); call(340, 30, 250, 100, '左轉待轉區'); call(620, 24, 230, 100, '機車停等區線'); call(1040, 30, 260, 100, '讓路標線'); call(1560, 30, 240, 100, '雙白虛線');
  call(60, 400, 250, 100, '停止線'); call(360, 400, 250, 100, '斑馬線行人穿越道線'); call(660, 400, 220, 100, '黃實線'); call(1040, 400, 300, 100, '近鐵路平交道線'); call(1740, 400, 270, 100, '速度限制標字');
  roundSign(c, 1960, 150, 42, '#d32f2f', '50'); roundSign(c, 480, 175, 36, '#d32f2f', ''); roundSign(c, 1040, 215, 30, '#d32f2f', '');
  c.fillStyle = '#fff'; c.font = `900 40px ${FONT}`; c.textAlign = 'center'; c.fillText('慢', 1850, 330);
  person(c, 930, 120, 44, '#e8573a'); person(c, 1000, 120, 44, '#3a8fd0');
});

// 認識交通標誌（南牆，藍天、四塊標誌表、下面馬路上跑著公車和計程車）
const signsMat = () => lam('b1signs', 2048, 540, (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8fcdf0'); sky.addColorStop(1, '#dff2fc');
  c.fillStyle = sky; c.fillRect(0, 0, w, h); clouds(c, w, 30, 7, 3);
  c.fillStyle = 'rgba(150,180,200,.35)'; for (let i = 0; i < 14; i++) c.fillRect(i * 150, 220 - (i % 3) * 40, 70, 300);
  c.fillStyle = '#222'; c.font = `900 56px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  [...'認識交通標誌'].forEach((ch, i) => c.fillText(ch, 60, 70 + i * 66));
  const panel = (x, pw, head, col) => {
    c.fillStyle = 'rgba(255,255,255,.88)'; rr(c, x, 40, pw, 400, 8); c.fill();
    c.fillStyle = col; c.fillRect(x, 40, pw, 44); c.fillStyle = '#fff'; c.font = `900 26px ${FONT}`; c.fillText(head, x + pw / 2, 63);
    c.fillStyle = '#9aa0a6'; for (let i = 0; i < 3; i++) c.fillRect(x + 16, 100 + i * 12, pw - 32, 5);
  };
  panel(130, 340, '警告標誌', '#d32f2f'); panel(490, 520, '禁制標誌', '#d32f2f'); panel(1030, 400, '指示標誌', '#2e9a4a'); panel(1450, 320, '輔助標誌', '#f08a1c');
  for (let i = 0; i < 6; i++) triSign(c, 190 + (i % 3) * 100, 190 + Math.floor(i / 3) * 110, 62);
  roundSign(c, 540, 200, 34, '#1e5fc4', ''); c.fillStyle = '#d32f2f'; c.beginPath(); for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; c.lineTo(640 + Math.cos(a) * 36, 200 + Math.sin(a) * 36); } c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.font = `900 32px ${FONT}`; c.fillText('停', 640, 202);
  [['#d32f2f', '30'], ['#d32f2f', '60'], ['#d32f2f', ''], ['#d32f2f', ''], ['#d32f2f', ''], ['#d32f2f', '']].forEach(([ring, t], i) => roundSign(c, 540 + (i % 6) * 78, 300 + Math.floor(i / 6) * 80, 30, ring, t));
  for (let i = 0; i < 8; i++) { c.fillStyle = '#1e5fc4'; rr(c, 1060 + (i % 4) * 90, 130 + Math.floor(i / 4) * 130, 62, 84, 8); c.fill(); c.fillStyle = '#fff'; c.fillRect(1074 + (i % 4) * 90, 150 + Math.floor(i / 4) * 130, 34, 40); }
  c.fillStyle = '#f08a1c'; for (const [x, y] of [[1480, 150], [1640, 150], [1480, 280]]) { c.save(); c.translate(x + 30, y + 30); c.rotate(Math.PI / 4); c.fillRect(-26, -26, 52, 52); c.restore(); }
  c.fillStyle = '#16335f'; rr(c, 1490, 350, 250, 70, 8); c.fill(); c.fillStyle = '#fff'; c.font = `900 40px ${FONT}`; c.fillText('↰ ↑ ↱', 1615, 386);
  // 右邊：安全過馬路棋盤
  c.fillStyle = '#7cc04a'; rr(c, 1790, 40, 240, 440, 8); c.fill(); c.fillStyle = '#f2c230'; c.save(); c.translate(1910, 260); c.rotate(0.9); c.fillRect(-190, -26, 380, 52); c.restore();
  c.fillStyle = '#fff'; c.font = `900 22px ${FONT}`; c.fillText('START', 1840, 70); c.fillStyle = '#1e5fc4'; rr(c, 1830, 120, 170, 60, 8); c.fill(); c.fillStyle = '#fff'; c.font = `700 18px ${FONT}`; c.fillText('請說出安全過馬路五步驟 +3步', 1915, 150);
  road(c, 0, 470, w, 70); zebraH(c, 400, 474, 110, 60, 4); bus(c, 760, 520, 190, '#c0392b'); car(c, 1180, 520, 110, '#f2c230'); car(c, 300, 520, 110, '#2a5ab0');
  mascot(c, 90, 470, 34); mascot(c, 600, 480, 24); mascot(c, 1420, 486, 40);
});

// 學習大富翁（南牆東段，綠底的棋盤小孩）
const monopolyMat = () => lam('b1mono', 2048, 512, (c, w, h) => {
  c.fillStyle = '#7ccf8a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#65b878'; for (let i = 0; i < 30; i++) c.fillRect((i * 173) % w, (i * 71) % h, 80, 10);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(220, 120, 120, Math.PI * 1.1, Math.PI * 1.9); c.arc(250, 130, 90, Math.PI * 1.9, Math.PI * 1.1, true); c.fill();
  for (let i = 0; i < 3; i++) { c.fillStyle = RAINBOW[i]; c.lineWidth = 12; c.strokeStyle = RAINBOW[i]; c.beginPath(); c.arc(320, 90, 90 - i * 14, Math.PI, 0); c.stroke(); }
  c.fillStyle = '#fff'; rr(c, 30, 70, 400, 220, 90); c.fill();
  c.fillStyle = '#e8573a'; c.font = `900 76px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('學習', 80, 130);
  c.fillStyle = '#f2994a'; c.font = `900 90px ${FONT}`; c.fillText('大富翁', 90, 225); c.fillStyle = '#3a8fd0'; c.font = `800 22px ${FONT}`; c.fillText('LEARNING MONOPOLY', 260, 100);
  // 彎彎的白色賽道
  c.strokeStyle = '#fff'; c.lineWidth = 62; c.lineCap = 'round'; c.beginPath(); c.moveTo(520, 360); c.arc(640, 300, 120, Math.PI * 0.9, Math.PI * 2.1); c.lineTo(900, 380); c.arc(1010, 300, 120, Math.PI * 0.9, Math.PI * 2.1); c.lineTo(1290, 380); c.stroke();
  c.strokeStyle = '#d6e6dc'; c.lineWidth = 4; c.setLineDash([22, 22]); c.stroke(); c.setLineDash([]);
  for (const [x, y, col] of [[640, 410, '#e8573a'], [1010, 410, '#e8573a'], [1220, 250, '#f2c230']]) roundSign(c, x, y, 36, col, '', '#222');
  roundSign(c, 760, 330, 34, '#d32f2f', ''); roundSign(c, 1140, 150, 34, '#d32f2f', '');
  person(c, 470, 440, 90, '#3a8fd0'); person(c, 560, 440, 84, '#f2994a'); person(c, 1290, 360, 84, '#e8573a'); person(c, 1370, 360, 86, '#3a8fd0'); person(c, 1650, 440, 80, '#2e9a4a'); person(c, 780, 150, 70, '#8e44ad');
  c.fillStyle = '#f6e3a0'; rr(c, 1440, 70, 420, 310, 22); c.fill(); c.fillStyle = '#9a7a2a'; c.font = `900 34px ${FONT}`; c.fillText('Game Rules', 1470, 110);
  c.fillStyle = '#6a5a3a'; c.font = `600 24px ${FONT}`; ['1 Please line up.', '2 Please follow the rules.', '3 Please work with your partners.', '4 Please listen carefully.'].forEach((t, i) => c.fillText(t, 1470, 160 + i * 52));
  c.fillStyle = '#8b5a2b'; c.fillRect(1690, 14, 20, 60); rr(c, 1640, 6, 150, 50, 8); c.fill(); c.fillStyle = '#fff'; c.font = `900 30px ${FONT}`; c.fillText('FINISH', 1652, 32);
  c.fillStyle = '#8fd0f0'; c.beginPath(); c.moveTo(0, 480); c.bezierCurveTo(500, 430, 1500, 500, w, 450); c.lineTo(w, h); c.lineTo(0, h); c.fill();
});

// 留意大型車視線死角及內輪差（北牆東段：橘色大卡車、砂石車、公車側面和 160 公分的行人）
const truckMat = () => lam('b1truck', 2048, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#9fd1ef'); g.addColorStop(0.5, '#a9d6f2'); g.addColorStop(1, '#f2c3a0');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#6a7078'; c.fillRect(0, 430, w, 82); c.fillStyle = '#fff'; c.fillRect(120, 470, 1600, 5);
  c.fillStyle = '#7a5a3a'; rr(c, 30, 40, 470, 70, 10); c.fill(); c.fillStyle = '#fff'; c.font = `900 36px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('當心大型車 視線死角及內輪差', 50, 76);
  // 橘色大卡車（車頭朝右）
  c.fillStyle = '#3a3d42'; rr(c, 420, 150, 340, 250, 10); c.fill();
  c.fillStyle = '#f08a1c'; rr(c, 760, 140, 270, 280, 24); c.fill();
  c.fillStyle = '#2a2f36'; rr(c, 800, 170, 190, 90, 10); c.fill(); c.fillStyle = '#e8e8e8'; for (const x of [800, 920]) rr(c, x, 300, 70, 40, 8), c.fill();
  c.fillStyle = '#222'; for (const x of [560, 700, 880]) { c.beginPath(); c.arc(x, 420, 50, 0, 7); c.fill(); }
  // 砂石車、腳踏車、紅色叉叉
  c.fillStyle = '#f2b81c'; c.beginPath(); c.moveTo(1120, 220); c.lineTo(1330, 190); c.lineTo(1400, 300); c.lineTo(1190, 340); c.closePath(); c.fill();
  c.fillStyle = '#f08a1c'; rr(c, 1330, 260, 100, 80, 10); c.fill();
  c.strokeStyle = '#d32f2f'; c.lineWidth = 10; c.beginPath(); c.moveTo(1090, 330); c.lineTo(1150, 390); c.moveTo(1150, 330); c.lineTo(1090, 390); c.stroke();
  c.fillStyle = '#f08a1c88'; c.beginPath(); c.moveTo(1180, 420); c.lineTo(1420, 360); c.lineTo(1600, 440); c.lineTo(1250, 440); c.fill();
  // 160cm 的人和公車
  c.strokeStyle = '#e8b81c'; c.lineWidth = 6; c.beginPath(); c.moveTo(1560, 130); c.lineTo(1560, 410); c.moveTo(1535, 130); c.lineTo(1585, 130); c.stroke();
  c.fillStyle = '#222'; c.font = `800 26px ${FONT}`; c.textAlign = 'center'; c.fillText('160cm', 1560, 110);
  person(c, 1625, 420, 150, '#e9879b');
  c.fillStyle = '#eceff1'; rr(c, 1720, 150, 330, 290, 20); c.fill(); c.fillStyle = '#2f3a42'; rr(c, 1760, 200, 150, 200, 8); c.fill(); c.fillStyle = '#f08a1c'; c.beginPath(); c.arc(1990, 430, 56, 0, 7); c.fill();
  c.fillStyle = '#e8b81c'; rr(c, 1730, 190, 22, 220, 6); c.fill(); c.fillStyle = '#c0392b'; c.font = `900 26px ${FONT}`; ['A', '柱', '視', '線', '死', '角'].forEach((t, i) => c.fillText(t, 1741, 210 + i * 34));
  person(c, 90, 430, 150, '#3a8fd0'); person(c, 190, 430, 120, '#f2994a'); person(c, 270, 430, 90, '#e8573a');
});

// 認識視覺死角／認識內輪差（北牆東段的大海報，粉紅藍底、一格格的圖解）
const blindPanelMat = () => lam('b1blind', 1200, 540, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#a9d9ee'); g.addColorStop(1, '#f6c8dc');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = '#222'; c.font = `900 40px ${FONT}`; c.fillText('認識', 36, 24);
  c.fillStyle = '#c0392b'; c.font = `900 64px ${FONT}`; c.fillText('視覺死角', 36, 70);
  c.fillStyle = '#c0392b'; c.font = `900 70px ${FONT}`; c.fillText('認識', 560, 22); c.fillStyle = '#f2994a'; c.font = `900 86px ${FONT}`; c.fillText('內輪差', 690, 14);
  c.fillStyle = '#3a3a5a'; c.font = `500 20px ${FONT}`; wrap(c, '「視覺死角」是因為車輛構造上或其他道路上的障礙物擋住駕駛人視線的範圍，以及駕駛人沒有辦法從照後鏡上看的視覺角度和角度內的影像。', 36, 160, 460, 25);
  wrap(c, '「內輪差」是指車輛在轉彎時，前後車輪的行經軌跡所造成的差距。等候穿越道路時，不要靠近交叉路口處站立，因為汽車轉彎時會出現內輪差。', 560, 120, 600, 25);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = '#fff'; rr(c, 40 + i * 168, 330, 156, 180, 10); c.fill();
    c.fillStyle = '#9aa0a6'; c.fillRect(60 + i * 168, 350, 116, 70); c.fillStyle = ['#3a8fd0', '#f2c230', '#d93a3a'][i]; rr(c, 90 + i * 168, 365, 56, 38, 8); c.fill();
    c.strokeStyle = '#d32f2f'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(70 + i * 168, 430); c.lineTo(160 + i * 168, 470); c.stroke(); c.setLineDash([]);
  }
  c.fillStyle = '#fff'; rr(c, 560, 300, 560, 220, 16); c.fill();
  c.fillStyle = '#6f7479'; c.fillRect(580, 320, 520, 90); c.fillStyle = '#4fb3d9'; c.beginPath(); c.moveTo(640, 320); c.lineTo(1060, 320); c.lineTo(1060, 410); c.lineTo(700, 410); c.quadraticCurveTo(640, 410, 640, 350); c.fill();
  c.fillStyle = '#5a3a9a'; rr(c, 760, 330, 160, 40, 6); c.fill(); c.fillStyle = '#2e9a4a'; rr(c, 930, 330, 90, 40, 6); c.fill();
  for (const [x, col, t] of [[600, '#f2994a', '小型車 0.2m'], [800, '#3a8fd0', '大客車 3.5~4.5m'], [980, '#2e9a4a', '聯結車 6~7.5m']]) { c.fillStyle = col; rr(c, x, 430, 150, 30, 8); c.fill(); c.fillStyle = '#fff'; c.font = `700 18px ${FONT}`; c.fillText(t, x + 10, 436); }
  c.fillStyle = '#d32f2f'; c.beginPath(); c.moveTo(1060, 470); c.lineTo(1100, 470); c.lineTo(1080, 440); c.fill();
});

// 公車車廂內部（南牆東段：白牆、車窗、吊環、藍紅座椅、緊急出口）
const busInsideMat = () => lam('b1busin', 1500, 560, (c, w, h) => {
  c.fillStyle = '#eef0f2'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#c9ced3'; c.fillRect(0, 430, w, 130); c.fillStyle = '#4a4f55'; c.fillRect(0, 418, w, 10);
  const win = (x, ww) => { c.fillStyle = '#2a2f36'; c.fillRect(x, 70, ww, 250); c.fillStyle = '#cfe6f4'; c.fillRect(x + 8, 78, ww - 16, 234); };
  [[40, 130], [210, 190], [430, 200], [770, 230], [1040, 200], [1260, 200]].forEach(([x, ww]) => win(x, ww));
  c.strokeStyle = '#8b9096'; c.lineWidth = 6; c.beginPath(); c.moveTo(200, 100); c.lineTo(1450, 100); c.stroke();
  for (let x = 240; x < 1440; x += 70) { if (x > 600 && x < 780) continue; c.strokeStyle = '#8b9096'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, 100); c.lineTo(x, 140); c.stroke(); c.beginPath(); c.arc(x, 156, 14, 0, 7); c.stroke(); }
  c.fillStyle = '#7b8086'; for (const x of [190, 420, 750, 1030, 1250, 1460]) c.fillRect(x, 20, 10, 400);
  const seat = (x, col) => { c.fillStyle = col; rr(c, x, 190, 36, 150, 16); c.fill(); rr(c, x, 300, 130, 40, 14); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 6; c.beginPath(); c.arc(x + 64, 290, 50, Math.PI * 0.1, Math.PI * 0.95); c.stroke(); c.fillStyle = '#8b9096'; c.fillRect(x + 50, 345, 20, 70); };
  [70, 250, 450].forEach((x) => seat(x, '#2a5ab0')); [800, 1060].forEach((x) => seat(x, '#2a5ab0')); [1290, 1430].forEach((x) => seat(x, '#d93a3a'));
  c.fillStyle = '#2e9a4a'; rr(c, 620, 40, 120, 40, 4); c.fill(); c.fillStyle = '#fff'; c.font = `900 22px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('緊急出口', 680, 60);
  c.fillStyle = '#f6f6f6'; c.strokeStyle = '#7b8086'; c.lineWidth = 5; c.fillRect(620, 100, 130, 310); c.strokeRect(620, 100, 130, 310);
  c.fillStyle = '#d32f2f'; c.font = `900 26px ${FONT}`; ['緊', '急', '出', '口'].forEach((t, i) => c.fillText(t, 650, 160 + i * 32));
  c.fillStyle = '#f2c230'; c.fillRect(760, 250, 24, 40); c.fillStyle = '#c0392b'; c.fillRect(1010, 340, 24, 60); c.fillRect(1420, 340, 24, 60);
});

// 乘著希望的翅膀（東端牆上的大壁畫：兩隻白色的鵜鶘、彩虹圈、小鎮和跑道）
const pelicanMat = () => lam('b1pelican', 900, 640, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#6a9ec9'); g.addColorStop(0.55, '#8ab8d8'); g.addColorStop(1, '#f2a04a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#f6e3b0'; c.beginPath(); c.arc(760, 130, 36, 0, 7); c.fill();
  for (let i = 0; i < 6; i++) { c.strokeStyle = RAINBOW[i]; c.lineWidth = 14; c.beginPath(); c.arc(520, 560, 380 - i * 15, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
  c.fillStyle = '#c0392b'; for (let i = 0; i < 6; i++) c.fillRect(380 + i * 70, 430 + (i % 2) * 18, 54, 60);
  c.fillStyle = '#f6efe0'; for (let i = 0; i < 6; i++) { c.fillRect(380 + i * 70, 410 + (i % 2) * 18, 54, 22); }
  c.fillStyle = '#e07a3a'; c.beginPath(); c.moveTo(300, 520); c.bezierCurveTo(500, 470, 700, 540, 900, 450); c.lineTo(900, 640); c.lineTo(300, 640); c.fill();
  const bird = (x, y, s, flip) => {
    c.save(); c.translate(x, y); c.scale(flip ? -s : s, s);
    c.fillStyle = '#fbf8f2'; c.beginPath(); c.ellipse(0, 40, 90, 60, -0.3, 0, 7); c.fill();
    c.beginPath(); c.moveTo(50, 10); c.bezierCurveTo(120, -30, 140, -80, 90, -110); c.lineTo(60, -90); c.bezierCurveTo(70, -50, 30, -20, 20, 10); c.fill();
    c.fillStyle = '#f2b04a'; c.beginPath(); c.moveTo(94, -108); c.lineTo(200, -78); c.lineTo(96, -74); c.fill();
    c.fillStyle = '#222'; c.beginPath(); c.arc(86, -96, 5, 0, 7); c.fill();
    c.fillStyle = '#e8e2d4'; c.beginPath(); c.moveTo(-90, 20); c.bezierCurveTo(-140, -60, -60, -120, 10, -70); c.bezierCurveTo(-20, -30, -40, 0, -60, 40); c.fill();
    c.restore();
  };
  bird(430, 200, 1.1, false); bird(660, 250, 1.0, false);
  c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'top'; c.font = `900 40px ${FONT}`; c.fillText('乘著希望的翅膀', 40, 26);
  c.font = `600 22px ${FONT}`; ['天鵝有他們的大湖，老鷹有他們的高山。', '麻雀有他們的老樹，鸕鷀有他們的水田。', '我們也有可愛又溫暖的家。'].forEach((t, i) => c.fillText(t, 40, 86 + i * 30));
});

// 溪口巴士的前面板（黃底彩虹、大眼睛、「溪口巴士」、車燈和綠色車牌）
const busFrontMat = () => lam('b1busfront', 720, 400, (c, w, h) => {
  c.fillStyle = '#f6e68a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) { c.strokeStyle = RAINBOW[i]; c.lineWidth = 22; c.beginPath(); c.moveTo(0, 60 + i * 20); c.bezierCurveTo(200, 20 + i * 20, 460, 140 + i * 20, w, 60 + i * 20); c.stroke(); }
  mascot(c, 120, 170, 52); mascot(c, 330, 150, 78); mascot(c, 610, 130, 46);
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `900 70px ${FONT}`; c.lineWidth = 7; c.strokeStyle = '#1d4f91';
  [['溪', '#3aa6e0', 410], ['口', '#f2c230', 470], ['巴', '#43a047', 530], ['士', '#e8573a', 590]].forEach(([ch, col, x]) => { c.strokeText(ch, x, 205); c.fillStyle = col; c.fillText(ch, x, 205); });
  for (const x of [40, 520]) { c.fillStyle = '#e8681c'; rr(c, x, 250, 150, 100, 36); c.fill(); c.fillStyle = '#e8eaec'; rr(c, x + 20, 270, 110, 56, 20); c.fill(); }
  c.fillStyle = '#e8eaec'; c.fillRect(0, 360, w, 40); c.fillStyle = '#2e8b57'; rr(c, 250, 340, 220, 56, 6); c.fill(); c.fillStyle = '#fff'; c.font = `800 34px ${FONT}`; c.textAlign = 'center'; c.fillText('XIKOU-520', 360, 369);
});
// 溪口巴士的側面（黃底彩虹條、吉祥物）
const busSideMat = () => lam('b1busside', 1024, 160, (c, w, h) => {
  c.fillStyle = '#f6e68a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) { c.fillStyle = RAINBOW[i]; c.fillRect(0, 70 + i * 6, w, 6); }
  mascot(c, 120, 60, 36); mascot(c, 700, 60, 36); c.fillStyle = '#e8eaec'; c.fillRect(0, 118, w, 42);
});

// 地板：公車座位的貼紙（藍色、紅色的座椅，從上面看）
const floorSeatsMat = () => lam('b1floorseats', 1200, 540, (c, w, h) => {
  c.fillStyle = '#c9ced3'; c.fillRect(0, 0, w, h);
  const seat = (x, y, col) => { c.fillStyle = col; rr(c, x, y, 150, 60, 18); c.fill(); rr(c, x + 6, y + 70, 150, 60, 18); c.fill(); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 8, y + 54, 140, 6); };
  for (let i = 0; i < 4; i++) { seat(40 + i * 190, 30, '#3a6fc4'); seat(40 + i * 190, 300, '#3a6fc4'); }
  seat(840, 30, '#3a6fc4'); seat(1020, 30, '#d9473a'); seat(840, 300, '#d9473a'); seat(1020, 300, '#d9473a');
  c.fillStyle = '#e8c850'; for (let i = 0; i < 4; i++) c.fillRect(600, 230 + i * 8, 120, 4);
});
// 地板：視野死角（深灰色路面上的黃色三角形）
const wedgeMat = () => lam('b1wedge3', 1024, 512, (c, w, h) => {
  c.fillStyle = '#54585f'; c.fillRect(0, 0, w, h);                                                      // 深灰路面
  c.fillStyle = '#f2d23a'; c.beginPath(); c.moveTo(w, h * 0.5); c.lineTo(0, h * 0.02); c.lineTo(0, h * 0.98); c.closePath(); c.fill();   // 黃色三角形：尖端在巴士司機這邊，往外變寬
  c.save(); c.translate(w * 0.36, h * 0.5); c.rotate(Math.PI / 2); c.fillStyle = '#222'; c.font = `900 78px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('視野死角', 0, 0); c.restore();   // 字順著「面對巴士走過來」的方向讀
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w * 0.1, h * 0.8); c.lineTo(w * 0.17, h * 0.66); c.lineTo(w * 0.24, h * 0.8); c.closePath(); c.fill();
  c.strokeStyle = '#d32f2f'; c.lineWidth = 7; c.stroke();
  c.fillStyle = '#d32f2f'; c.font = `900 30px ${FONT}`; c.fillText('!', w * 0.17, h * 0.765);
});
// 竹林圖案的綠色折疊屏風
const bambooMat = () => lam('b1bamboo', 256, 256, (c, w, h) => {
  c.fillStyle = '#9fd3a0'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { const x = i * 30 + 6; c.fillStyle = i % 2 ? '#3a8f4a' : '#58b060'; c.fillRect(x, 0, 18, h); c.fillStyle = '#2a6f3a'; for (let y = 20; y < h; y += 52) c.fillRect(x, y + (i % 3) * 8, 18, 4); }
});

// 天花板：米白底、彩色波浪（粉橘、淡藍、黃）
const ceilingMat = () => { const m = ceilingTex(); m.userData.ceil = true; return m; };
const ceilingTex = () => lam('b1ceil', 4096, 820, (c, w, h) => {
  c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
  const wave = (x0, x1, y0, y1, col, amp = 28, ph = 0) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(x0, y0 + Math.sin(ph) * amp);
    for (let x = x0; x <= x1; x += 24) c.lineTo(x, y0 + Math.sin(ph + x / 120) * amp);
    for (let x = x1; x >= x0; x -= 24) c.lineTo(x, y1 + Math.sin(ph + 1.5 + x / 140) * amp);
    c.closePath(); c.fill();
  };
  const sc = w / 50.3;
  for (const [u0, u1] of [[3, 12], [14, 22], [24, 30]]) { wave(u0 * sc, u1 * sc, 120, 360, '#f6cdb6', 30, u0); wave(u0 * sc + 60, u1 * sc - 40, 300, 520, '#cfe3ee', 26, u0 + 1); wave(u0 * sc + 20, u1 * sc - 80, 480, 700, '#f2c230', 24, u0 + 2); }
  c.fillStyle = '#f2c230'; c.fillRect(40 * sc, 0, 10.3 * sc, 60); c.fillRect(40 * sc, h - 60, 10.3 * sc, 60);
  c.fillStyle = '#fff'; for (let u = 4; u < 50; u += 3) for (const v of [160, 410, 660]) { c.beginPath(); c.arc(u * sc, v, 9, 0, 7); c.fill(); }
});

/* ---------- 主函式 ---------- */

export function trafficBasement(put, fr, room) {
  const L = fr.L, W = fr.W, N = -W / 2, S = W / 2, H = 2.36;
  const white = flat('#f6f4ee'), cream = flat('#f1ead8'), yellow = flat('#f2b705'), green = flat('#3fa85a'), dark = flat('#3a2a2a');
  const grey = flat('#9aa0a6'), steel = flat('#c9ccd0'), blue = flat('#1f56b8'), teal = flat('#3fbf9a'), lightBlue = flat('#6fb3e0'), line = flat('#fbfbfb');
  const doors = (room.doorPts || []).map((d) => ({ side: d.side, ...(() => { const [u, v] = fr.toLocal(d.x, d.z); return { u, v }; })() }));

  /* 地板、牆面、天花板 */
  put(mat('tile', '#cfd2d1'), L, W, 0.012, L / 2, 0, 0);
  for (const wallV of [N, S]) {
    put(cream, L, 0.03, H, L / 2, wallV + (wallV < 0 ? 0.015 : -0.015), 0);
    put(dark, L, 0.05, 0.14, L / 2, wallV + (wallV < 0 ? 0.025 : -0.025), 0);                       // 深咖啡色踢腳板
  }
  // 兩端是黃色的牆；門口那一段（北邊）留開口、門上有橫楣
  for (const [uw, dir] of [[0.015, 1], [L - 0.015, -1]]) {
    const d = doors.find((x) => (uw < 1 ? x.u < 1 : x.u > L - 1));
    const gap = d ? [d.v - 0.9, d.v + 0.9] : [N, N];
    for (const [a, b] of [[N, gap[0]], [gap[1], S]]) if (b - a > 0.05) put(yellow, 0.03, b - a, H, uw, (a + b) / 2, 0);
    if (d) put(yellow, 0.03, 1.8, H - 2.15, uw, d.v, 2.15);
    if (d) for (const sv of [-1, 1]) put(steel, 0.08, 0.08, 2.15, uw + dir * 0.03, d.v + sv * 0.9, 0);
    if (d) put(steel, 0.08, 1.8, 0.08, uw + dir * 0.03, d.v, 2.15);
  }
  put(ceilingMat(), L, W, 0.02, L / 2, 0, H, true);
  // 兩側牆頂的粉橘色大樑、橫跨的白色樑
  for (const wallV of [N, S]) put(flat('#f1cdbb'), L, 0.55, 0.32, L / 2, wallV + (wallV < 0 ? 0.28 : -0.28), H - 0.32);
  const pil = { N: [3.0, 12.4, 21.8, 28.6, 38.0, 44.0], S: [3.0, 12.4, 21.8, 31.2, 40.6] };
  for (const u of [...new Set([...pil.N, ...pil.S])]) put(white, 0.5, W, 0.3, u, 0, H - 0.3);
  // 日光燈
  const lamp = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#f4fbff', emissiveIntensity: 0.9 });
  for (let u = 2.5; u < L - 1; u += 4.2) for (const v of [-2.6, 2.6]) put(lamp, 1.25, 0.32, 0.04, u, v, H - 0.34);

  /* 黃色壁柱（兩側牆，上面有電風扇、闖關站的白紙，邊角貼綠色防撞條） */
  const pilaster = (u, wallV, dir, k) => {
    const pv = wallV + dir * 0.23;
    put(yellow, 1.5, 0.46, H - 0.32, u, pv, 0);
    for (const su of [-0.77, 0.77]) put(green, 0.05, 0.46, 1.1, u + su, pv, 0.2);
    put(white, 0.34, 0.01, 0.42, u - 0.3, pv + dir * 0.235, 1.1);
    put(white, 0.34, 0.01, 0.42, u + 0.3, pv + dir * 0.235, 1.1);
    if (k % 2 === 0) { put.geo(white, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16).rotateX(Math.PI / 2), u, pv + dir * 0.26, 1.85); put(grey, 0.04, 0.04, 0.3, u, pv + dir * 0.26, 1.5); }
  };
  pil.N.forEach((u, k) => pilaster(u, N, 1, k)); pil.S.forEach((u, k) => pilaster(u, S, -1, k));

  /* 北牆壁畫（由西到東：5 大守則、愛心商家、白板、大型車、死角內輪差、公車車廂） */
  const mural = (m, u0, u1, wallV, dir, y0, h) => put(m, u1 - u0, 0.03, h, (u0 + u1) / 2, wallV + dir * 0.06, y0, true);
  mural(rulesMat(), 3.75, 11.65, N, 1, 0.12, 2.0);
  mural(loveMat(), 13.15, 21.05, N, 1, 0.12, 2.1);
  put(flat('#fcfcfa'), 5.1, 0.03, 1.25, 25.2, N + 0.06, 0.95); put(steel, 5.2, 0.05, 0.04, 25.2, N + 0.07, 0.93);                 // 白板
  for (const du of [-0.9, 0.9, 2.2]) put(steel, 0.03, 0.05, 1.25, 25.2 + du, N + 0.07, 0.95);
  mural(truckMat(), 29.35, 37.25, N, 1, 0.12, 2.0);
  mural(blindPanelMat(), 38.75, 43.25, N, 1, 0.12, 2.1);
  // 南牆：道路標線（兩塊）、交通標誌、學習大富翁
  mural(roadMat(), 3.75, 11.65, S, -1, 0.12, 2.0); mural(roadMat(), 13.15, 21.05, S, -1, 0.12, 2.0);
  mural(signsMat(), 22.55, 30.45, S, -1, 0.12, 2.1);
  mural(monopolyMat(), 31.95, 39.85, S, -1, 0.12, 2.0);
  // 愛心商家壁畫前面的小課桌和兩把折疊椅
  const chair = (u, v, face) => { put(white, 0.42, 0.42, 0.04, u, v, 0.42); put(white, 0.04, 0.42, 0.4, u + face * 0.2, v, 0.46); for (const a of [-0.17, 0.17]) for (const b of [-0.17, 0.17]) put(steel, 0.03, 0.03, 0.42, u + a, v + b, 0); };
  chair(16.2, N + 0.9, 0); put(flat('#c9a050'), 0.5, 0.7, 0.04, 16.9, N + 0.8, 0.72); for (const a of [-0.2, 0.2]) for (const b of [-0.3, 0.3]) put(flat('#b88a3a'), 0.04, 0.04, 0.72, 16.9 + a, N + 0.8 + b, 0);
  chair(17.8, N + 0.9, 0);

  /* 公車車廂牆、巴士（東端靠南牆） */
  const bx = 44.4;                                                         // 巴士前面板的位置
  put(busInsideMat(), L - 0.1 - bx, 0.03, 2.2, (bx + L - 0.1) / 2, S - 0.06, 0.12, true);
  put(floorSeatsMat(), L - 0.4 - bx, 2.8, 0.012, (bx + L - 0.2) / 2, S - 1.55, 0.013, true);
  const bw = 2.7;                                                           // 巴士寬度（沿 v）
  const front = (v0, v1, y0, y1, m, plain = false) => put(m, 0.06, v1 - v0, y1 - y0, bx, (v0 + v1) / 2, y0, plain);
  front(S - bw, S - 0.1, 0, 1.15, busFrontMat(), true);
  front(S - bw, S - bw + 0.12, 1.15, 2.3, flat('#2b61b4')); front(S - 0.22, S - 0.1, 1.15, 2.3, flat('#43a047'));                    // 左右柱（彩虹色）
  front(S - bw, S - 0.1, 2.12, 2.3, flat('#f6e68a'));                                                                               // 上面橫梁
  front(S - bw + 0.12, S - 0.22, 1.15, 1.2, flat('#111')); front(S - bw + 0.12, S - 0.22, 2.07, 2.12, flat('#111'));              // 窗框
  put(flat('#2b2b2b'), 0.1, 0.1, 0.5, bx - 0.12, S - bw - 0.12, 1.5);                                                              // 後照鏡
  // 側面（朝北）：矮的黃色車身，前門一個缺口、後面一直到牆；兩個輪子
  const sideV = S - bw;
  put(busSideMat(), 2.6 - 0.9, 0.08, 0.9, bx + 0.9 + (2.6 - 0.9) / 2 + 0.0, sideV, 0.12, true);
  put(busSideMat(), L - 0.2 - (bx + 2.6), 0.08, 0.9, (bx + 2.6 + L - 0.2) / 2, sideV, 0.12, true);
  put(busSideMat(), 0.5, 0.08, 0.9, bx + 0.25, sideV, 0.12, true);
  for (const du of [1.0, 4.1]) put.geo(flat('#2a2a2a'), new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20).rotateX(Math.PI / 2), bx + 0.3 + du, sideV - 0.02, 0.42);
  // 駕駛座：黑色辦公椅、方向盤、電風扇、球
  put(flat('#17181b'), 0.5, 0.5, 0.06, bx + 0.9, S - 1.2, 0.45); put(flat('#17181b'), 0.06, 0.5, 0.7, bx + 1.14, S - 1.2, 0.5); put(flat('#2a2a2a'), 0.06, 0.06, 0.45, bx + 0.9, S - 1.2, 0);
  put.geo(flat('#222'), new THREE.TorusGeometry(0.17, 0.02, 6, 16).rotateY(Math.PI / 2), bx + 0.5, S - 1.2, 1.0);
  put.geo(flat('#e8e2cf'), new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16).rotateZ(Math.PI / 2), bx + 1.9, S - 0.7, 1.15); put(flat('#d8d2bf'), 0.05, 0.05, 1.05, bx + 1.9, S - 0.7, 0);
  put.geo(flat('#d8d8d0'), new THREE.SphereGeometry(0.11, 10, 8), bx + 0.55, S - 0.45, 0.11);
  put(flat('#f2c230'), 0.1, 0.12, 0.2, bx + 0.45, S - 1.9, 1.05);                                                                    // 刷卡機

  /* 東牆：乘著希望的翅膀（巴士北邊） */
  put(pelicanMat(), 0.03, 3.4, 2.3, L - 0.06, N + 6.2, 0.06, true);
  // 視野死角：深灰路面＋黃色三角形（東端通往丁梯的路）
  // 真正的視野死角：從巴士司機座位往前、往外張開的黃色三角形（站在裡面，司機從座位上看不到你）
  const wedgeV = S - 1.55, wedgeLen = 6.2, wedgeW = 3.0;
  put(wedgeMat(), wedgeLen, wedgeW, 0.014, bx - wedgeLen / 2 - 0.1, wedgeV, 0.013, true);
  // 疊起來的兒童塑膠椅（藍、綠）、立在地上的白板、掃具
  [['#3fbf5a', 0], ['#3a6fc4', 1], ['#3fbf5a', 2], ['#3a6fc4', 3]].forEach(([col, k]) => { const u = L - 1.0 - k * 0.55; for (let i = 0; i < 6; i++) put(flat(col), 0.4, 0.4, 0.05, u, N + 7.7, 0.1 + i * 0.1); put(flat(col), 0.04, 0.4, 0.5, u + 0.2, N + 7.7, 0.1); });

  /* 西端（丙梯那邊）：AED、火警警報、足球門、體操墊、竹林屏風、滅火器 */
  put(white, 0.1, 0.5, 0.5, 0.1, S - 3.0, 1.1); put(green, 0.02, 0.2, 0.2, 0.17, S - 3.0, 1.25);                                  // AED
  put(flat('#d93a3a'), 0.08, 0.3, 0.2, 0.1, S - 4.2, 1.2);                                                                           // 警報器
  const goal = (v) => {
    for (const dv of [-1.5, 1.5]) put(steel, 0.05, 0.05, 1.2, 1.2, v + dv, 0);
    put(steel, 0.05, 3.1, 0.05, 1.2, v, 1.15); put(steel, 0.9, 0.04, 0.04, 1.65, v - 1.5, 0); put(steel, 0.9, 0.04, 0.04, 1.65, v + 1.5, 0);
    put(white, 0.02, 3.0, 0.9, 1.65, v, 0.15);
  };
  goal(S - 2.2); goal(S - 3.6);
  const matCol = ['#6fb3e0', '#1f56b8', '#3fbf9a'];
  matCol.forEach((col, i) => put(flat(col), 0.06, 1.6, 1.1, 0.4 + i * 0.07, S - 5.0, 0.02));          // 靠牆立起來的墊子（門在北邊 v≈-2.7，這些都放在南半邊，別擋到門）
  for (let i = 0; i < 4; i++) { put(flat(i % 2 ? '#1f56b8' : '#3fbf9a'), 1.0, 1.6, 0.05, 1.5, S - 4.6, 0.05 * i); }
  put(bambooMat(), 0.08, 1.6, 1.9, 0.5, S - 1.2, 0.1, true);
  put(flat('#d93a3a'), 0.2, 0.2, 0.55, 0.5, S - 1.0, 0); put(flat('#d93a3a'), 0.2, 0.2, 0.55, 0.8, S - 1.0, 0);
  put(flat('#2a5ab0'), 0.35, 0.35, 0.35, 0.5, N + 5.2, 0);                                                                            // 藍色水桶

  /* 地上的線：斑馬線、箭頭、白色邊線、紅色膠帶、黃色膠帶 */
  for (let i = 0; i < 7; i++) put(line, 2.4, 0.6, 0.006, 7.8, -3.9 + i * 1.3, 0.014);
  for (const [u, v] of [[5.2, -1.4], [5.2, 1.8]]) { put(line, 1.1, 0.12, 0.006, u, v, 0.014); put.geo(line, new THREE.CylinderGeometry(0.35, 0.35, 0.006, 3).rotateZ(0), u + 0.7, v, 0.014); }
  const wl = (u, v, du, dv, rot = 0) => { const g = new THREE.BoxGeometry(du, 0.006, dv); put.geo(line, g, u, v, 0.017, rot); };
  wl(14.5, -3.2, 7.0, 0.07); wl(14.5, 3.2, 7.0, 0.07); wl(11.0, 0, 0.07, 6.4); wl(18.0, 0, 0.07, 6.4);
  wl(13.0, -1.6, 4.0, 0.07, 0.5); wl(13.0, 1.6, 4.0, 0.07, -0.5);
  for (let i = 0; i < 5; i++) wl(33.5 + i * 1.0, 2.2, 0.07, 2.6);
  wl(33.5, 0.9, 5.0, 0.07); wl(33.5, 3.5, 5.0, 0.07);
  const red = flat('#d93a3a'), yel = flat('#f2c230');
  wl(9.5, 1.4, 6.0, 0.05, 0.12); wl(21.0, -2.0, 0.05, 2.6, 0.2); wl(36.0, -3.6, 5.0, 0.05, -0.1);
  put.geo(red, new THREE.BoxGeometry(6.0, 0.006, 0.05), 9.5, 1.4, 0.018, 0.12);
  put.geo(yel, new THREE.BoxGeometry(0.4, 0.006, 0.1), 3.4, -0.8, 0.018); put.geo(yel, new THREE.BoxGeometry(0.1, 0.006, 0.4), 3.4, -0.8, 0.018);
  put.geo(yel, new THREE.BoxGeometry(0.4, 0.006, 0.1), 27.6, 2.6, 0.018);

  /* 場中間的體操墊（藍底加淺綠條） */
  put(blue, 4.2, 2.6, 0.045, 24.5, 0.4, 0.014); put(teal, 4.2, 0.5, 0.047, 24.5, -0.3, 0.014); put(teal, 4.2, 0.5, 0.047, 24.5, 1.1, 0.014);
  put(lightBlue, 1.2, 1.2, 0.045, 30.0, -2.4, 0.014); put(blue, 1.2, 1.2, 0.045, 31.2, -2.4, 0.014); put(teal, 1.2, 1.2, 0.045, 30.6, -3.6, 0.014);

  /* 學習大富翁牆腳：立著的藍色墊子、跳箱、平衡木、足球、三角錐、淺藍色地貼 */
  put(flat('#8fd0f0'), 7.8, 1.5, 0.008, 35.9, S - 0.9, 0.013);
  [[32.4, '#1f56b8'], [33.6, '#1f56b8'], [34.8, '#3fbf9a'], [36.0, '#1f56b8'], [37.2, '#3fbf9a']].forEach(([u, col], i) => put(flat(col), 1.2, 0.07, 1.5, u, S - 0.2, 0.06 + (i % 2) * 0.02));
  const vault = (u, v) => { put(flat('#1f56b8'), 1.1, 0.5, 0.36, u, v, 0); put(flat('#e8dcc0'), 1.12, 0.52, 0.12, u, v, 0.36); };
  vault(32.6, S - 1.9); vault(34.1, S - 1.9);
  put(blue, 4.6, 0.12, 0.1, 37.0, S - 1.5, 0.45); for (const du of [-1.8, 1.8]) put(blue, 0.1, 0.1, 0.45, 37.0 + du, S - 1.5, 0);   // 平衡木
  put.geo(flat('#f4f4f2'), new THREE.SphereGeometry(0.11, 10, 8), 38.6, S - 1.2, 0.11);
  put.geo(flat('#f26b1d'), new THREE.ConeGeometry(0.16, 0.5, 12), 39.4, S - 1.4, 0.26);
  // 另一組：疊高的跳箱、淡粉紅的巧拼、立起來的墊子（東端）
  for (let i = 0; i < 3; i++) put(flat('#1f56b8'), 1.4 - i * 0.1, 0.9, 0.3, L - 0.9, N + 8.3 + (i % 2) * 0.05, i * 0.3);
  for (let i = 0; i < 8; i++) put(flat('#f2b6c8'), 1.0, 1.0, 0.04, L - 1.2, N + 9.2, i * 0.04);
  put(flat('#3fbf9a'), 0.06, 1.2, 1.2, L - 0.5, N + 7.4, 0.02);

  /* 站立式電風扇（淺藍色三腳架）、折疊椅 */
  const fan = (u, v) => { put(flat('#6fb3e0'), 0.05, 0.05, 1.2, u, v, 0); for (const a of [-0.3, 0.3]) put(flat('#6fb3e0'), 0.04, 0.5, 0.04, u, v + a * 0.6, 0.0); put.geo(flat('#e8f0f6'), new THREE.CylinderGeometry(0.28, 0.28, 0.06, 18).rotateZ(Math.PI / 2), u, v, 1.35); };
  [[11.0, N + 1.0], [26.8, N + 1.0], [31.0, S - 1.0], [43.0, N + 1.0], [3.4, S - 2.0]].forEach(([u, v]) => fan(u, v));
  chair(1.2, N + 4.1, 0); chair(20.5, S - 0.8, 0);

  /* ---- 互動（app.js 的 doAction 處理）：溪口巴士彩蛋、體操闖關 ---- */
  const W2 = (u, v) => fr.toWorld(u, v);
  put.spot({ kind: 'blindquiz', name: '視野死角大考驗', r: 2.4 }, bx - 5.4, wedgeV, 0);
  put.spot({ kind: 'busquiz', name: '乘車安全小測驗', r: 2.3 }, bx + 4.2, S - 3.5, 0);
  put.spot({ kind: 'gymrun', name: '體操闖關', r: 1.7 }, 35.2, S - 3.7, 0);
  put.spot({ kind: 'bus', name: '溪口巴士', r: 2.7, seat: W2(bx + 0.9, S - 1.2), out: W2(bx - 1.3, S - 1.4),
    tri: [...W2(bx - 0.1, wedgeV), ...W2(bx - 0.1 - wedgeLen, wedgeV - wedgeW / 2), ...W2(bx - 0.1 - wedgeLen, wedgeV + wedgeW / 2)] }, bx - 1.0, S - 1.4, 0);
  // 跳箱、平衡木、場中間的體操墊旁邊也都能開「體操闖關」
  put.spot({ kind: 'gymrun', name: '體操闖關', r: 1.9 }, 33.3, S - 1.9, 0);
  put.spot({ kind: 'gymrun', name: '體操闖關', r: 2.2 }, 37.0, S - 1.5, 0);
  put.spot({ kind: 'gymrun', name: '體操闖關', r: 2.4 }, 24.5, 0.4, 0);
}
