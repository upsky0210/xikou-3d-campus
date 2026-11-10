/* 著色本
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import { T, player, stopAuto, toast, npcFace, act, gameState } from '../app.js?v=317';

/* ---------------- 著色小遊戲：在美勞教室遇到哈囉老師，幫動物線稿塗顏色 ----------------
   動物線稿用程式畫在 400×400 的畫布上；先把「被黑線圍起來的區塊」編號，點一下就把整塊塗成選的顏色（可以一直換色重塗） */

const paintBox = document.getElementById('paint'), paintCv = paintBox.querySelector('canvas');
const PAINT_KEY = 'campus-paint-count';
const PAINT_COLORS = ['#e53935', '#fb8c00', '#fdd835', '#9ccc65', '#43a047', '#4fc3f7', '#1e88e5', '#8e24aa', '#f48fb1', '#8d6e63', '#ffe0b2', '#9e9e9e', '#424242', '#ffffff'];
// 動物線稿（黑線）：用 SVG 路徑畫，後畫的部位先塗白再描邊，前後交疊才會遮住（不會有線穿過去）
const ANIMALS = (() => {
  const kit = (c) => {
    const k = {
      S: (d, w = 4.5) => { c.lineWidth = w; c.stroke(typeof d === 'string' ? new Path2D(d) : d); },
      F: (d, w = 4.5) => { const p = typeof d === 'string' ? new Path2D(d) : d; c.fillStyle = '#fff'; c.fill(p); c.lineWidth = w; c.stroke(p); },
      E: (x, y, rx, ry, rot = 0, w = 4.5) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); k.F(p, w); },
      dot: (x, y, rx, ry = rx) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = '#222'; c.fill(); },
      shine: (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); },
      clip: (d, fn) => { c.save(); c.clip(new Path2D(d)); fn(); c.restore(); },   // 只畫在某個形狀裡面（條紋不會超出身體）
      eye: (x, y, r) => { k.dot(x, y, r, r * 1.15); k.shine(x - r * 0.35, y - r * 0.4, r * 0.35); },
      sun: (x, y, r) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; k.S(`M${x + Math.cos(a) * (r + 8)} ${y + Math.sin(a) * (r + 8)} L${x + Math.cos(a) * (r + 22)} ${y + Math.sin(a) * (r + 22)}`, 3.5); } k.E(x, y, r, r); },
      cloud: (x, y) => k.F(`M${x - 46} ${y + 14} C${x - 62} ${y - 6} ${x - 34} ${y - 22} ${x - 20} ${y - 10} C${x - 14} ${y - 36} ${x + 22} ${y - 36} ${x + 26} ${y - 12} C${x + 46} ${y - 22} ${x + 64} ${y} ${x + 48} ${y + 14} Z`, 3.5),
      grass: (x, y) => k.S(`M${x} ${y} l5 -16 l5 16 l5 -12 l5 12 l5 -18 l5 18`, 3),
      flower: (x, y, s = 1, ground = y + 60 * s) => {
        k.S(`M${x} ${y} C${x - 4} ${y + 25 * s} ${x + 4} ${ground - 20 * s} ${x} ${ground}`, 3.5);
        k.F(`M${x} ${y + 34 * s} C${x + 22 * s} ${y + 18 * s} ${x + 34 * s} ${y + 30 * s} ${x + 30 * s} ${y + 34 * s} C${x + 20 * s} ${y + 44 * s} ${x + 8 * s} ${y + 42 * s} ${x} ${y + 34 * s} Z`, 3);
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; k.E(x + Math.cos(a) * 12 * s, y + Math.sin(a) * 12 * s, 10 * s, 7 * s, a, 3.5); }
        k.E(x, y, 8 * s, 8 * s, 0, 3.5);
      },
    };
    return k;
  };
  return [
    ['貓咪', (c) => {
      const k = kit(c);
      k.S('M20 352 L380 352');
      k.E(78, 318, 30, 30); k.S('M56 300 C70 320 92 330 104 322 M52 322 C70 338 92 342 106 336 M66 292 C82 306 100 304 108 300', 3); k.S('M100 340 C130 360 150 330 170 346', 3);   // 毛線球
      k.F('M262 322 C330 334 344 262 312 238 C302 230 292 238 298 248 C320 270 306 312 260 306 Z');   // 尾巴
      k.F('M136 344 C114 286 136 214 200 208 C264 214 286 286 264 344 Z');                            // 身體
      k.E(200, 292, 34, 42);                                                                            // 肚子
      k.S('M176 250 C172 290 172 318 176 336 M224 250 C228 290 228 318 224 336', 4);                  // 前腳
      k.E(170, 340, 22, 11); k.E(230, 340, 22, 11);
      k.S('M160 338 L160 346 M170 338 L170 347 M220 338 L220 347 M230 338 L230 346', 2.5);
      k.F('M132 132 L126 64 L182 104 Z'); k.F('M268 132 L274 64 L218 104 Z');                          // 耳朵
      k.F('M140 120 L137 84 L168 106 Z', 3); k.F('M260 120 L263 84 L232 106 Z', 3);
      k.E(200, 160, 82, 68);                                                                            // 頭
      k.S('M184 100 L186 116 M200 96 L200 114 M216 100 L214 116', 3.5);                                // 額頭花紋
      k.E(168, 156, 15, 18); k.E(232, 156, 15, 18); k.eye(168, 158, 7); k.eye(232, 158, 7);
      k.F('M191 182 L209 182 L200 192 Z', 3.5);
      k.S('M200 192 C196 202 186 204 180 198 M200 192 C204 202 214 204 220 198', 3.5);
      k.E(146, 186, 13, 8, 0, 3); k.E(254, 186, 13, 8, 0, 3);
      k.S('M150 176 L98 166 M150 186 L96 188 M150 196 L100 208 M250 176 L302 166 M250 186 L304 188 M250 196 L300 208', 2.5);
      k.F('M146 222 C180 240 220 240 254 222 L256 234 C220 252 180 252 144 234 Z', 3.5);                // 項圈
      k.E(200, 252, 11, 11, 0, 3.5); k.S('M192 252 L208 252', 2.5);
    }],
    ['小狗', (c) => {
      const k = kit(c);
      k.S('M20 352 L380 352');
      k.F('M60 330 C48 320 54 306 66 312 L120 312 C132 306 138 320 126 330 C138 340 132 354 120 348 L66 348 C54 354 48 340 60 330 Z', 3.5);   // 骨頭
      k.F('M250 300 C300 296 316 252 300 232 C292 224 282 232 288 240 C298 258 286 284 246 286 Z');   // 尾巴
      k.F('M140 344 C124 284 148 218 200 214 C252 218 276 284 260 344 Z');                            // 身體
      k.E(228, 276, 18, 14, 0, 3.5); k.E(160, 300, 12, 10, 0, 3.5);                                   // 斑點
      k.S('M178 256 C174 290 174 320 178 338 M222 256 C226 290 226 320 222 338', 4);
      k.E(172, 342, 22, 11); k.E(228, 342, 22, 11);
      k.F('M150 222 C182 238 218 238 250 222 L252 234 C218 250 182 250 148 234 Z', 3.5);              // 項圈＋名牌
      k.F('M200 244 l12 10 l-12 14 l-12 -14 Z', 3.5);
      k.F('M142 118 C98 108 82 196 112 222 C132 236 152 200 150 160 Z');                              // 垂耳
      k.F('M258 118 C302 108 318 196 288 222 C268 236 248 200 250 160 Z');
      k.E(200, 150, 72, 64);                                                                            // 頭
      k.E(234, 134, 22, 18, 0.3, 3.5);                                                                  // 眼睛上的斑
      k.E(200, 182, 38, 28);                                                                            // 嘴巴
      k.E(172, 142, 10, 11); k.E(232, 136, 10, 11); k.eye(172, 143, 6); k.eye(232, 137, 6);
      k.dot(200, 170, 13, 9); k.shine(195, 167, 3);
      k.S('M200 179 L200 192 M200 192 C192 200 182 198 180 190 M200 192 C208 200 218 198 220 190', 3.5);
      k.F('M193 198 C193 214 207 214 207 198 Z', 3);                                                    // 舌頭
    }],
    ['兔子', (c) => {
      const k = kit(c);
      k.S('M20 352 L380 352');
      for (const x of [40, 90, 300, 345]) k.grass(x, 352);
      k.flower(340, 270, 0.9, 352);
      k.E(268, 312, 20, 18);                                                                            // 尾巴
      k.F('M142 344 C126 278 152 204 200 200 C248 204 274 278 258 344 Z');                            // 身體
      k.E(200, 284, 32, 44);
      k.E(166, 340, 32, 13); k.E(234, 340, 32, 13);
      k.F('M180 120 C150 46 162 18 182 26 C200 38 198 86 194 118 Z'); k.F('M220 120 C250 46 238 18 218 26 C200 38 202 86 206 118 Z');   // 耳朵
      k.S('M182 108 C170 66 172 44 180 40 M218 108 C230 66 228 44 220 40', 3);
      k.E(200, 152, 60, 52);
      k.E(176, 146, 9, 11); k.E(224, 146, 9, 11); k.eye(176, 147, 6); k.eye(224, 147, 6);
      k.F('M193 166 L207 166 L200 174 Z', 3);
      k.S('M200 174 L200 182 M200 182 C195 188 188 188 186 184 M200 182 C205 188 212 188 214 184', 3);
      k.E(160, 172, 11, 7, 0, 3); k.E(240, 172, 11, 7, 0, 3);
      k.S('M168 170 L130 164 M168 178 L132 182 M232 170 L270 164 M232 178 L268 182', 2.5);
      // 抱著紅蘿蔔
      k.F('M184 236 L214 236 C216 270 206 300 199 312 C192 300 182 270 184 236 Z');
      k.S('M188 252 L198 252 M206 268 L196 268 M190 284 L200 284', 2.5);
      k.F('M199 236 C188 214 176 214 178 224 C182 232 192 234 199 236 Z', 3); k.F('M199 236 C210 214 222 214 220 224 C216 232 206 234 199 236 Z', 3);
      k.E(176, 244, 14, 10); k.E(224, 244, 14, 10);                                                     // 小手
    }],
    ['小魚', (c) => {
      const k = kit(c);
      k.S('M0 366 C50 354 100 372 150 362 C200 352 250 372 300 362 C340 354 370 366 400 360');           // 沙地
      k.S('M40 400 C28 360 58 340 44 300 C32 268 54 252 46 222', 4); k.S('M62 400 C74 366 50 346 66 314 C78 290 60 270 70 250', 4);   // 海草
      k.F('M330 372 l8 -18 l8 18 l18 2 l-14 12 l6 18 l-18 -10 l-18 10 l6 -18 l-14 -12 Z', 3.5);          // 海星
      for (const [x, y, r] of [[96, 96, 10], [74, 64, 7], [92, 38, 5], [330, 70, 9], [350, 42, 6]]) k.E(x, y, r, r, 0, 3);
      k.F('M290 196 L362 136 C346 176 346 216 362 256 Z');                                            // 尾巴
      k.S('M300 190 L346 160 M300 200 L344 200 M300 210 L346 240', 2.5);
      k.F('M150 136 C176 84 232 90 252 150 Z');                                                         // 背鰭
      k.F('M164 264 C180 300 214 300 224 262 Z');
      const body = 'M84 200 C112 118 244 108 296 198 C244 290 112 282 84 200 Z';
      k.F(body);                                                                                        // 身體
      k.clip(body, () => k.S('M150 110 C168 176 168 226 150 290 M214 100 C232 176 232 226 214 300', 4));   // 條紋
      k.S('M128 162 C140 190 140 214 128 240', 3.5);                                                    // 鰓
      k.F('M176 214 C196 200 214 214 204 238 C196 246 182 236 176 214 Z', 3.5);                        // 胸鰭
      k.E(116, 188, 15, 15); k.eye(117, 189, 8);
      k.S('M86 206 C92 212 100 212 104 206', 3.5);
      for (const [x, y] of [[250, 172], [264, 196], [250, 220], [276, 182], [276, 210]]) k.S(`M${x} ${y} C${x + 8} ${y + 4} ${x + 8} ${y + 12} ${x} ${y + 14}`, 2.5);   // 鱗片
    }],
    ['小鳥', (c) => {
      const k = kit(c);
      k.sun(64, 64, 26); k.cloud(300, 64);
      k.F('M16 302 C120 294 260 306 392 296 L392 316 C260 326 120 316 16 322 Z');                     // 樹枝
      k.S('M120 312 C112 330 104 340 92 346', 4);
      for (const [x, y, s] of [[70, 302, 1], [330, 298, -1], [100, 346, 1]]) k.F(`M${x} ${y} C${x + s * -6} ${y - 30} ${x + s * 24} ${y - 40} ${x + s * 30} ${y - 26} C${x + s * 30} ${y - 10} ${x + s * 14} ${y} ${x} ${y} Z`, 3.5);   // 葉子
      k.S('M204 286 L200 306 M196 306 L204 306 M228 286 L230 306 M226 306 L236 306', 3.5);              // 腳
      k.F('M128 244 L58 214 L72 242 L54 258 L128 266 Z');                                               // 尾巴
      k.S('M120 250 L74 236 M120 258 L72 254', 2.5);
      k.F('M122 234 C120 168 196 146 246 166 C296 186 300 254 254 282 C206 304 126 296 122 234 Z');  // 身體
      k.S('M160 280 C200 292 240 280 262 252', 3.5);                                                    // 肚子
      k.F('M154 214 C184 182 234 196 244 234 C214 254 172 250 154 214 Z');                             // 翅膀
      k.S('M178 222 C196 210 214 214 226 230 M170 232 C188 228 206 232 216 242', 2.5);
      k.E(258, 150, 44, 42);                                                                            // 頭
      k.F('M296 140 L336 152 L296 166 Z', 3.5); k.S('M298 153 L320 153', 2.5);
      k.E(270, 140, 8, 9); k.eye(271, 141, 5); k.E(272, 168, 10, 7, 0, 3);
      k.S('M242 112 C238 96 250 88 256 100 M256 108 C258 92 272 92 270 106', 3);                       // 頭上的毛
    }],
    ['烏龜', (c) => {
      const k = kit(c);
      k.sun(340, 60, 24); k.cloud(90, 64);
      k.S('M20 330 L380 330');
      k.grass(352, 330); k.grass(150, 330);
      k.flower(26, 276, 0.7, 330);
      k.F('M70 260 L46 280 L76 280 Z', 3.5);                                                           // 尾巴
      k.E(112, 300, 30, 20); k.E(288, 300, 30, 20);                                                     // 腳
      k.S('M96 310 L96 318 M112 312 L112 320 M128 310 L128 318 M272 310 L272 318 M288 312 L288 320 M304 310 L304 318', 2.5);
      k.F('M330 252 C350 222 396 226 394 258 C392 286 352 290 334 276 Z');                            // 頭
      k.E(366, 246, 8, 9); k.eye(367, 247, 5); k.S('M372 268 C380 272 388 268 390 262', 3);
      const shell = 'M74 266 C78 148 322 148 326 266 Z';
      k.F(shell);                                                                                       // 殼
      k.F('M62 266 L338 266 L332 286 L68 286 Z', 4);
      for (const x of [100, 140, 180, 220, 260, 300]) k.S(`M${x} 266 L${x} 286`, 2.5);
      k.clip(shell, () => k.S('M170 196 L120 172 M230 196 L280 172 M170 230 L100 262 M230 230 L300 262 M200 176 L200 120 M200 248 L200 270', 4));   // 殼上的分格（只在殼裡面）
      k.F('M170 196 L200 176 L230 196 L230 230 L200 248 L170 230 Z', 4);                               // 中間六角形
      k.F('M134 210 L150 204 L156 222 L142 230 L128 222 Z', 3); k.F('M266 210 L250 204 L244 222 L258 230 L272 222 Z', 3);
    }],
    ['蝴蝶', (c) => {
      const k = kit(c);
      k.S('M20 372 L380 372');
      k.flower(70, 300, 1, 372); k.flower(332, 290, 1.1, 372); k.grass(150, 372); k.grass(230, 372);
      for (const s of [-1, 1]) {
        const m = (x) => 200 + s * x;
        k.F(`M${m(4)} 168 C${m(50)} 58 ${m(170)} 56 ${m(162)} 140 C${m(156)} 204 ${m(60)} 218 ${m(4)} 204 Z`);   // 上翅
        k.F(`M${m(4)} 212 C${m(56)} 214 ${m(118)} 246 ${m(98)} 304 C${m(78)} 346 ${m(12)} 318 ${m(4)} 246 Z`);   // 下翅
        k.E(m(104), 132, 30, 24, s * 0.4); k.E(m(104), 132, 13, 10, s * 0.4, 3.5);
        k.E(m(56), 184, 14, 12, 0, 3.5); k.E(m(66), 270, 22, 16, s * -0.5); k.E(m(52), 298, 8, 8, 0, 3);
        for (const [x, y] of [[150, 96], [158, 120], [146, 160]]) k.E(m(x), y, 6, 6, 0, 3);
      }
      k.S('M196 112 C186 80 168 64 156 60 M204 112 C214 80 232 64 244 60', 3.5); k.E(154, 58, 7, 7, 0, 3.5); k.E(246, 58, 7, 7, 0, 3.5);
      k.E(200, 214, 13, 86); k.E(200, 118, 17, 16);
      for (const y of [168, 194, 220, 246, 272]) k.S(`M190 ${y} L210 ${y}`, 2.5);
      k.dot(194, 116, 3); k.dot(206, 116, 3);
    }],
    ['倉鼠羞羞', (c) => {
      const k = kit(c);
      for (const [x, y, r] of [[60, 330, 0.5], [340, 320, -0.4], [330, 360, 0.2]]) k.F(`M${x} ${y - 14} C${x + 10} ${y - 6} ${x + 9} ${y + 8} ${x} ${y + 14} C${x - 9} ${y + 8} ${x - 10} ${y - 6} ${x} ${y - 14} Z`, 3);   // 地上的葵花子
      k.F('M70 90 C70 76 88 72 92 86 C96 72 114 76 114 90 C114 104 92 116 92 116 C92 116 70 104 70 90 Z', 3.5);   // 愛心
      k.E(132, 132, 26, 26); k.E(268, 132, 26, 26); k.E(132, 132, 13, 13, 0, 3); k.E(268, 132, 13, 13, 0, 3);   // 耳朵
      k.F('M200 116 C292 116 322 198 316 262 C310 330 262 356 200 356 C138 356 90 330 84 262 C78 198 108 116 200 116 Z');   // 身體
      k.S('M200 120 L200 150 M188 124 L190 146 M212 124 L210 146', 3);                                 // 頭頂的毛
      k.F('M136 262 C136 214 264 214 264 262 C264 326 136 326 136 262 Z', 4);                          // 白肚子
      k.E(164, 196, 12, 14); k.E(236, 196, 12, 14); k.eye(164, 197, 8); k.eye(236, 197, 8);
      k.F('M193 214 L207 214 L200 222 Z', 3);
      k.S('M200 222 C196 230 188 230 186 225 M200 222 C204 230 212 230 214 225', 3);
      k.E(136, 226, 17, 11, 0, 3); k.E(264, 226, 17, 11, 0, 3);
      k.S('M150 212 L112 204 M150 220 L114 224 M250 212 L288 204 M250 220 L286 224', 2.5);
      k.F('M200 242 C216 256 213 284 200 296 C187 284 184 256 200 242 Z', 3.5); k.S('M200 250 L200 288', 2.5);   // 抱著葵花子
      k.E(176, 266, 13, 10, 0, 3.5); k.E(224, 266, 13, 10, 0, 3.5);
      k.E(156, 350, 28, 13); k.E(244, 350, 28, 13);
    }],
    ['游泳館的橘貓', (c) => {
      const k = kit(c);
      k.F('M0 0 L400 0 L400 196 L0 196 Z', 3.5);                                                       // 游泳館藍色泡泡牆
      for (const [x, y, r] of [[34, 40, 22], [92, 110, 18], [40, 156, 14], [320, 44, 20], [372, 112, 16], [300, 150, 12], [150, 28, 12], [260, 22, 10]]) k.E(x, y, r, r, 0, 3.5);
      k.F('M0 196 L400 196 L400 400 L0 400 Z', 4.5);                                                   // 階梯（三階）
      k.S('M0 300 L400 300 M0 366 L400 366', 4.5); k.S('M0 312 L400 312 M0 378 L400 378', 2.5);
      k.S('M350 120 L350 300 M380 120 L380 300', 4.5); k.F('M340 112 L390 112 L390 126 L340 126 Z', 3.5);   // 不鏽鋼扶手
      const body = 'M96 294 C84 214 128 176 200 174 C272 176 316 214 304 294 Z';
      k.F(body);                                                                                        // 香箱坐的身體
      k.clip(body, () => k.S('M112 218 C130 230 132 256 118 280 M288 218 C270 230 268 256 282 280 M134 192 C152 206 156 228 146 246 M266 192 C248 206 244 228 254 246', 4));   // 身上的虎斑
      const tail = 'M100 286 C150 306 250 306 300 286 C312 294 312 306 300 312 C250 330 150 330 100 312 C88 304 88 294 100 286 Z';
      k.F(tail);                                                                                        // 尾巴繞在前面
      k.clip(tail, () => k.S('M250 290 L246 330 M272 288 L268 326 M228 292 L224 330', 3.5));
      for (const x of [170, 230]) { k.E(x, 296, 24, 13); k.S(`M${x - 8} 290 L${x - 8} 300 M${x + 8} 290 L${x + 8} 300`, 2.5); }   // 前腳
      k.F('M132 132 L124 62 L180 102 Z'); k.F('M268 132 L276 62 L220 102 Z');                          // 耳朵
      k.F('M140 120 L136 84 L166 104 Z', 3); k.F('M260 120 L264 84 L234 104 Z', 3);
      k.E(200, 150, 84, 66);                                                                            // 頭
      k.S('M180 92 L184 112 M200 88 L200 110 M220 92 L216 112', 4);                                    // 額頭花紋
      k.S('M154 148 C162 138 174 138 182 148 M218 148 C226 138 238 138 246 148', 4.5);                 // 瞇瞇眼（曬太陽好舒服）
      k.F('M191 168 L209 168 L200 178 Z', 3.5); k.S('M200 178 C195 188 186 188 182 182 M200 178 C205 188 214 188 218 182', 3.5);
      k.E(146, 172, 14, 9, 0, 3); k.E(254, 172, 14, 9, 0, 3);
      k.S('M150 164 L94 154 M150 176 L92 180 M250 164 L306 154 M250 176 L308 180', 2.5);
    }],
    ['蜜袋鼯米果', (c) => {
      const k = kit(c);
      for (const [x, y] of [[60, 70], [340, 60], [330, 150], [70, 170]]) k.F(`M${x} ${y - 14} L${x + 4} ${y - 4} L${x + 14} ${y} L${x + 4} ${y + 4} L${x} ${y + 14} L${x - 4} ${y + 4} L${x - 14} ${y} L${x - 4} ${y - 4} Z`, 3);   // 小星星
      k.F('M300 300 C352 310 362 360 326 386 C314 394 300 386 308 374 C332 350 322 320 292 318 Z');   // 蓬蓬的尾巴（垂在袋子外面）
      k.S('M316 330 C326 338 330 350 326 362', 2.5);
      k.E(150, 112, 30, 36, -0.3); k.E(250, 112, 30, 36, 0.3); k.E(150, 116, 16, 22, -0.3, 3); k.E(250, 116, 16, 22, 0.3, 3);   // 大耳朵
      k.F('M128 250 C120 196 150 150 200 150 C250 150 280 196 272 250 Z');                            // 身體
      k.E(200, 160, 66, 56);                                                                            // 頭
      k.E(170, 156, 20, 22); k.E(230, 156, 20, 22); k.dot(170, 158, 15, 17); k.dot(230, 158, 15, 17);
      k.shine(164, 150, 6); k.shine(224, 150, 6); k.shine(175, 166, 2.5); k.shine(235, 166, 2.5);
      k.F('M192 186 L208 186 L200 194 Z', 3); k.S('M200 194 C196 200 190 200 188 196 M200 194 C204 200 210 200 212 196', 3);
      k.E(160, 192, 12, 8, 0, 3); k.E(240, 192, 12, 8, 0, 3);
      k.S('M170 184 L136 178 M170 192 L138 196 M230 184 L264 178 M230 192 L262 196', 2.5);
      k.E(200, 236, 24, 24, 0, 4); for (const [x, y] of [[192, 228], [208, 232], [198, 244], [210, 246]]) k.dot(x, y, 2.5);   // 抱著的點心餅乾
      k.E(176, 236, 12, 10, 0, 3.5); k.E(224, 236, 12, 10, 0, 3.5);                                   // 小手
      k.F('M96 254 C96 380 304 380 304 254 Z');                                                         // 藍色保暖袋
      k.E(200, 254, 106, 18, 0, 4.5);
      k.clip('M96 254 C96 380 304 380 304 254 Z', () => { for (let x = 120; x <= 290; x += 24) k.S(`M${x} 270 C${x - 4} 310 ${x - 4} 340 ${x} 380`, 2.5); });   // 刷毛布紋
      k.F('M184 300 C184 288 196 288 200 298 C204 288 216 288 216 300 C216 312 200 322 200 322 C200 322 184 312 184 300 Z', 3);   // 袋子上的愛心
    }],
  ];
})();
const PAINT_EN = { 貓咪: 'Cat', 小狗: 'Puppy', 兔子: 'Rabbit', 小魚: 'Fish', 小鳥: 'Bird', 烏龜: 'Turtle', 蝴蝶: 'Butterfly', 倉鼠羞羞: 'Shyshy the hamster', 游泳館的橘貓: 'The pool cat', 蜜袋鼯米果: 'Mi-guo the sugar glider' };
const paintName = (k) => T(ANIMALS[k][0], PAINT_EN[ANIMALS[k][0]] || ANIMALS[k][0]);
const PAINT_PRAISE = ['🌈 哇！這配色好有創意，老師好喜歡！', '👏 塗得好仔細，連小地方都沒漏掉！', '🎨 你是小小藝術家！這張可以貼在教室後面的作品牆喔！',
  '✨ 顏色搭得好漂亮，看起來好開心！', '💖 老師要把這張拍照收藏起來～'];
function startPaint(n) {
  stopAuto();
  const W = 400, cx = paintCv.getContext('2d', { willReadFrequently: true });
  const $ = (sel) => paintBox.querySelector(sel);
  const msg = (t, cls = '') => { const m = $('.msg'); m.innerHTML = t; m.style.color = cls === 'no' ? '#c0392b' : cls === 'ok' ? '#1b8a3a' : ''; };
  let k = Math.random() * ANIMALS.length | 0, color = PAINT_COLORS[0], label, line, base, colors, fills = 0, first = true;
  // 畫線稿 → 找出黑線、把其他地方依「被線圍起來」分區編號
  const load = () => {
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, W);
    cx.lineWidth = 6; cx.lineJoin = cx.lineCap = 'round'; cx.strokeStyle = '#222';
    ANIMALS[k][1](cx);
    base = cx.getImageData(0, 0, W, W);
    const d = base.data, N = W * W;
    line = new Uint8Array(N); label = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) line[i] = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 420 ? 1 : 0;
    let L = 0; const st = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (line[i] || label[i] >= 0) continue;
      let sp = 0; st[sp++] = i; label[i] = L;
      while (sp) {
        const j = st[--sp], x = j % W, y = (j / W) | 0;
        for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < W - 1 ? j + W : -1]) if (q >= 0 && !line[q] && label[q] < 0) { label[q] = L; st[sp++] = q; }
      }
      L++;
    }
    colors = new Array(L).fill(null);
    $('.name').textContent = T(`今天畫：${ANIMALS[k][0]}`, `Today: ${paintName(k)}`);
    msg(first ? `${n.name}：哈囉！幫這隻${ANIMALS[k][0]}穿上漂亮的顏色吧～<br>${T('點一個顏色，再點圖裡的空白處就能塗上去！', 'Pick a color, then tap a blank area to fill it!')}` : T('點一個顏色，再點圖裡的空白處就能塗上去！', 'Pick a color, then tap a blank area to fill it!'));
    first = false;
    draw();
  };
  const draw = () => {
    const out = cx.createImageData(W, W), o = out.data, d = base.data;
    for (let i = 0; i < W * W; i++) {
      const c = !line[i] && colors[label[i]];
      if (c) { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; }
      else { o[i * 4] = d[i * 4]; o[i * 4 + 1] = d[i * 4 + 1]; o[i * 4 + 2] = d[i * 4 + 2]; }
      o[i * 4 + 3] = 255;
    }
    cx.putImageData(out, 0, 0);
  };
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const fillAt = (e) => {
    const r = paintCv.getBoundingClientRect();
    let x = Math.round((e.clientX - r.left) / r.width * W), y = Math.round((e.clientY - r.top) / r.height * W);
    // 點到黑線上：找最近的空白處
    let idx = -1;
    for (let rr = 0; rr <= 6 && idx < 0; rr++) for (let dy = -rr; dy <= rr && idx < 0; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
      const j = yy * W + xx; if (!line[j]) { idx = j; break; }
    }
    if (idx < 0) return;
    colors[label[idx]] = color === '#ffffff' ? null : rgb(color);
    draw();
    if (++fills % 5 === 0) npcFace(n, 'happy', 1.2);
  };
  // 調色盤
  $('.pal').innerHTML = PAINT_COLORS.map((c) => `<button data-c="${c}" style="background:${c}" title="${c === '#ffffff' ? T('橡皮擦（白色）', 'Eraser (white)') : c}"></button>`).join('');
  const pick = (c) => { color = c; paintBox.querySelectorAll('.pal button').forEach((b) => b.classList.toggle('on', b.dataset.c === c)); };
  $('.pal').onclick = (e) => { const b = e.target.closest('button'); if (b) pick(b.dataset.c); };
  pick(color);
  paintCv.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); fillAt(e); };
  const colored = () => colors.filter(Boolean).length;
  $('.next').onclick = () => { k = (k + 1) % ANIMALS.length; load(); };
  $('.clear').onclick = () => { colors.fill(null); draw(); msg(T('重新開始！', 'Start over!')); };
  $('.save').onclick = () => { const a = document.createElement('a'); a.download = `${ANIMALS[k][0]}著色.png`; a.href = paintCv.toDataURL('image/png'); a.click(); msg(T('📥 圖片存好了！', '📥 Picture saved!'), 'ok'); };
  $('.done').onclick = () => {
    if (colored() < 3) { msg(T('還有好多地方是白白的，再多塗幾個顏色吧！', 'Lots of white spots left. Add a few more colors!'), 'no'); npcFace(n, 'surprised', 1.2); return; }
    let cnt = 1; try { cnt = (+localStorage.getItem(PAINT_KEY) || 0) + 1; localStorage.setItem(PAINT_KEY, String(cnt)); } catch { /* 私密模式 */ }
    const name = ANIMALS[k][0];
    finish();
    npcFace(n, 'happy', 3);
    toast(`${PAINT_PRAISE[Math.random() * PAINT_PRAISE.length | 0]}<br>${T(`🖼️ ${name}完成！這是你在美勞教室畫的第 ${cnt} 張作品`, `🖼️ ${PAINT_EN[name] || name} finished! That's drawing #${cnt} in the art room`)}`);
  };
  $('.quit').onclick = () => gameState.duel?.quit();
  // 著色時鍵盤只留 Esc（不要按到 E／Q 換樓層、C 換角色）
  const keyGuard = (e) => { e.stopPropagation(); if (e.code === 'Escape') gameState.duel?.quit(); };
  addEventListener('keydown', keyGuard, true);
  const finish = () => {
    paintBox.hidden = true; removeEventListener('keydown', keyGuard, true);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  n.playing = true;
  n.g.rotation.y = Math.atan2(n.g.position.x - player.x, n.g.position.z - player.z);   // 老師面向你
  gameState.duel = { quit() { finish(); toast(`🎨 ${n.name}：下次再來畫畫喔！`); } };
  act.busy = { label: T('🎨 著色中…', '🎨 Coloring…'), tick() {} };
  paintBox.hidden = false;
  load();
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  paint: (s) => startPaint(s.npc),
};
