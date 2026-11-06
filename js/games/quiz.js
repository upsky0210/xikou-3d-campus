/* 二選一問答（startFood）：蜜袋鼯、沉浮、熱脹冷縮、史地、交通安全、分數、生活、電子積木
   靠近老師（出現互動提示）時才由 app.js 載入，見 app.js 的 GAME_FILE。 */
import * as THREE from 'three';
import { faceTeacher } from './common.js?v=309';
import { T, rooms, scene, player, avatar, placeAt, updateVisibility, stopAuto, toast, npcFace, act, gameState, blocksBoard } from '../app.js?v=309';

/* ---------------- 蜜袋鼯能吃嗎？：遇到邱老師（教務處的花花、泡泡是她養的），判斷每樣東西蜜袋鼯能不能吃 ----------------
   一回 5 題（能吃、不能吃各 2～3 題，順序打亂）；點按鈕或按 1（可以吃）／2（不能吃），答完老師會說明原因。 */

const FOOD_KEY = 'campus-glider-food-best';
const GLIDER_FOOD = [
  { e: '🍎', n: '蘋果', ok: 1, why: '去皮、去籽、切小塊，是很棒的水果點心。' },
  { e: '🥭', n: '芒果', ok: 1, why: '去皮去籽、切小塊，香香甜甜牠很愛。' },
  { e: '🍌', n: '香蕉', ok: 1, why: '可以吃，但是很甜，一次一小塊就好。' },
  { e: '🫐', n: '藍莓', ok: 1, why: '小小一顆剛好入口，還有很多維生素。' },
  { e: '🍈', n: '哈密瓜', ok: 1, why: '去皮切小塊，水分多又好吃。' },
  { e: '🍉', n: '西瓜', ok: 1, why: '把籽挑掉、切小塊，夏天的好點心。' },
  { e: '🍠', n: '地瓜', ok: 1, why: '要煮熟、不加調味料，切小塊給牠。' },
  { e: '🌽', n: '玉米', ok: 1, why: '煮熟的玉米粒，不加鹽、不加奶油。' },
  { e: '🐛', n: '麵包蟲', ok: 1, why: '蜜袋鼯在野外也會吃昆蟲，這是很重要的蛋白質。' },
  { e: '🦗', n: '蟋蟀', ok: 1, why: '昆蟲是蜜袋鼯天然的食物，補充蛋白質。' },
  { e: '🥚', n: '水煮蛋', ok: 1, why: '煮熟、不加鹽，一小塊就能補充蛋白質。' },
  { e: '🥣', n: '蜜袋鼯專用飼料', ok: 1, why: '專用飼料的營養最均衡，是每天的主食。' },
  { e: '🍫', n: '巧克力', ok: 0, why: '巧克力裡的可可鹼對蜜袋鼯有毒，一點點都不行！' },
  { e: '🧅', n: '洋蔥', ok: 0, why: '洋蔥會傷害蜜袋鼯的紅血球，讓牠生病。' },
  { e: '🧄', n: '大蒜', ok: 0, why: '跟洋蔥一樣，會傷害蜜袋鼯的血液。' },
  { e: '🥑', n: '酪梨', ok: 0, why: '酪梨裡有對很多小動物有毒的成分。' },
  { e: '☕', n: '咖啡', ok: 0, why: '咖啡因會讓牠心跳太快，非常危險！' },
  { e: '🧋', n: '珍珠奶茶', ok: 0, why: '有咖啡因、又加了很多糖，人喝都要少喝了！' },
  { e: '🍬', n: '糖果', ok: 0, why: '太甜了，會蛀牙、變胖，對身體不好。' },
  { e: '🍟', n: '薯條', ok: 0, why: '又油又鹹，蜜袋鼯的身體負擔不了。' },
  { e: '🥤', n: '汽水', ok: 0, why: '糖太多又有氣泡，喝了會不舒服。' },
  { e: '🥛', n: '牛奶', ok: 0, why: '蜜袋鼯消化不了牛奶裡的乳糖，會拉肚子。' },
];
const foodBox = document.getElementById('food');
const GLIDER_Q = { en: { title: 'Can Sugar Gliders Eat It?', yes: 'Yes', no: 'No' }, list: GLIDER_FOOD, key: FOOD_KEY, title: '🐿️ 蜜袋鼯能吃嗎？', icon: '🐿️', yes: ['✅', '可以吃'], no: ['❌', '不能吃'],
  ask: (q) => `🐿️ 蜜袋鼯可以吃「${q.n}」嗎？`, intro: '花花和泡泡肚子餓了！哪些東西蜜袋鼯可以吃呢？',
  endTalk: (sc, n) => (sc === n ? '你是蜜袋鼯小專家！花花和泡泡謝謝你～' : sc >= 3 ? '很不錯喔！記住不能吃的東西，就是愛護小動物！' : '沒關係，記住哪些不能吃，就是愛護小動物唷！'),
  quitTalk: (n) => `🐿️ 下次再來找${n.name}玩！要愛護小動物唷！` };

/* ---------------- 沉浮實驗：在自然教室一遇到丁丁老師，猜猜東西放進水裡會浮還是沉 ----------------
   一回 5 題；答完東西真的掉進實驗桌上的水箱：浮的漂在水面上下晃，沉的慢慢沉到箱底 */
const FLOAT_KEY = 'campus-float-best';
const FLOAT_ITEMS = [
  { e: '🪵', n: '木塊', ok: 1, why: '木頭比水輕（密度比水小），會浮起來。' },
  { e: '🏓', n: '乒乓球', ok: 1, why: '裡面是空氣，又輕又大，會浮在水面。' },
  { e: '🍎', n: '蘋果', ok: 1, why: '蘋果裡面有很多小空氣，所以會浮起來！' },
  { e: '🧊', n: '冰塊', ok: 1, why: '水結冰後體積變大、變輕，所以冰塊會浮。' },
  { e: '🦆', n: '塑膠小鴨', ok: 1, why: '中間是空心的，裝著空氣，會浮。' },
  { e: '🍃', n: '樹葉', ok: 1, why: '樹葉又薄又輕，會漂在水面上。' },
  { e: '🧽', n: '海綿', ok: 1, why: '乾海綿裡有很多空氣，一開始會浮著。' },
  { e: '🍊', n: '橘子（帶皮）', ok: 1, why: '橘子皮裡有很多小氣室，像救生衣一樣讓它浮起來。' },
  { e: '🪨', n: '石頭', ok: 0, why: '石頭比水重（密度比水大），會沉下去。' },
  { e: '🪙', n: '硬幣', ok: 0, why: '金屬很重，小小一枚也會沉到底。' },
  { e: '🔩', n: '螺絲釘', ok: 0, why: '鐵比水重很多，會沉下去。' },
  { e: '🔑', n: '鑰匙', ok: 0, why: '鑰匙是金屬做的，會沉下去。' },
  { e: '📎', n: '迴紋針', ok: 0, why: '鐵做的迴紋針會沉（輕輕平放在水面上，有時候會被表面張力托住喔！）' },
  { e: '🥄', n: '鐵湯匙', ok: 0, why: '金屬湯匙比水重，會沉下去。' },
  { e: '🥚', n: '生雞蛋', ok: 0, why: '新鮮的蛋在清水裡會沉（加很多鹽的鹽水裡就會浮起來喔！）' },
  { e: '🔮', n: '玻璃彈珠', ok: 0, why: '玻璃比水重，彈珠會沉到底。' },
];
const floatTank = (() => {                                             // 實驗桌上的水箱（玻璃＋藍色的水）
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.55), new THREE.MeshLambertMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.25, depthWrite: false }));
  glass.position.y = 0.3; g.add(glass);
  const water = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.46, 0.51), new THREE.MeshLambertMaterial({ color: '#4fa8e8', transparent: true, opacity: 0.5, depthWrite: false }));
  water.position.y = 0.24; g.add(water);
  g.visible = false; scene.add(g);
  return g;
})();
const floatItem = (() => {                                             // 掉進水裡的東西（emoji 小圖）
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(0.32, 0.32, 1); sp.renderOrder = 5; sp.visible = false; scene.add(sp);
  sp.userData.set = (e) => { const c = cv.getContext('2d'); c.clearRect(0, 0, 128, 128); c.font = '96px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 64, 70); tex.needsUpdate = true; };
  return sp;
})();
const FLOAT_Q = { en: { title: 'Sink or Float?', yes: 'Float', no: 'Sink' }, list: FLOAT_ITEMS, key: FLOAT_KEY, title: '🧪 沉浮實驗：浮還是沉？', icon: '🧪', yes: ['🛟', '浮起來'], no: ['⚓', '沉下去'],
  ask: (q) => `🧪 把「${q.n}」放進水裡，會浮起來還是沉下去？`, intro: '我們來做實驗吧！先猜猜看，再放進水裡看看結果！',
  endTalk: (sc, n) => (sc === n ? '全部答對！你是小小科學家！' : sc >= 3 ? '很棒喔！同學們跟我一起做，觀察得很仔細！' : '沒關係，實驗就是要多試幾次！'),
  quitTalk: (n) => `🧪 下次再來找${n.name}做實驗！` };
// 水箱放在丁丁老師前面的大實驗桌上；東西從上面掉下來
FLOAT_Q.start = (n) => {
  const r = rooms.find((x) => x.name === '自然教室一'), f = r.f;
  floatTank.position.set(r.m.x2 - 1.75, f.y + 0.87, r.cz + 0.3); floatTank.visible = true;
  FLOAT_Q.anim = null;
  FLOAT_Q.tick = (dt) => {
    const a = FLOAT_Q.anim; if (!a) return;
    a.t += dt;
    const T = floatTank.position, top = T.y + 0.5, bottom = T.y + 0.14;
    let y;
    if (a.t < 0.5) y = T.y + 1.0 - (a.t / 0.5) ** 2 * (1.0 - 0.48);                       // 掉下來
    else if (a.ok) y = top - 0.02 + Math.sin((a.t - 0.5) * 6) * 0.025 * Math.exp(-(a.t - 0.5));   // 浮在水面晃一晃
    else y = Math.max(bottom, top - (a.t - 0.5) * 0.25);                                  // 慢慢沉到底
    floatItem.position.set(T.x, y, T.z);
  };
};
FLOAT_Q.show = (q) => { floatItem.userData.set(q.e); floatItem.visible = true; FLOAT_Q.anim = null; const T = floatTank.position; floatItem.position.set(T.x, T.y + 1.0, T.z); };
FLOAT_Q.reveal = (q) => { FLOAT_Q.anim = { t: 0, ok: q.ok }; };
FLOAT_Q.end = () => { floatTank.visible = false; floatItem.visible = false; FLOAT_Q.tick = null; };

/* ---------------- 熱脹冷縮：在自然教室二遇到竹竹老師，猜猜東西受熱／遇冷會膨脹還是收縮（固體、液體、氣體都有） ----------------
   一回 5 題；答完實驗桌上的東西真的變大或變小，下面是火焰（加熱）或冰塊（冷卻） */
const HEAT_KEY = 'campus-heat-best';
const HEAT_ITEMS = [
  { e: '🏓', c: '🔥', k: '氣體', n: '凹掉的乒乓球泡熱水', ok: 1, why: '球裡的空氣受熱膨脹，把凹下去的地方撐回來！' },
  { e: '🎈', c: '🔥', k: '氣體', n: '氣球放在大太陽下', ok: 1, why: '氣球裡的空氣受熱膨脹，氣球會變大一點。' },
  { e: '🚲', c: '🔥', k: '氣體', n: '夏天曬太陽的腳踏車輪胎', ok: 1, why: '輪胎裡的空氣受熱膨脹，所以夏天打氣不要打太飽。' },
  { e: '🌡️', c: '🔥', k: '液體', n: '溫度計放進熱水裡', ok: 1, why: '溫度計裡的液體受熱膨脹，紅線就往上升。' },
  { e: '🍲', c: '🔥', k: '液體', n: '裝很滿的湯一直加熱', ok: 1, why: '湯（液體）受熱膨脹，體積變大，就容易溢出來。' },
  { e: '🫙', c: '🔥', k: '固體', n: '轉不開的果醬瓶鐵蓋沖熱水', ok: 1, why: '金屬蓋受熱膨脹，變得鬆一點，就比較好打開。' },
  { e: '🛤️', c: '🔥', k: '固體', n: '夏天的鐵軌', ok: 1, why: '鐵軌受熱膨脹會變長，所以鐵軌中間要留一點縫。' },
  { e: '🔌', c: '🔥', k: '固體', n: '夏天的電線', ok: 1, why: '電線受熱膨脹變長，看起來垂得比較低。' },
  { e: '🎈', c: '❄️', k: '氣體', n: '氣球放進冰箱', ok: 0, why: '氣球裡的空氣遇冷收縮，氣球會變小。' },
  { e: '🧴', c: '❄️', k: '氣體', n: '裝熱水蓋緊的寶特瓶慢慢變涼', ok: 0, why: '瓶子裡的空氣遇冷收縮，瓶子會凹進去。' },
  { e: '🏀', c: '❄️', k: '氣體', n: '冬天放在外面的籃球', ok: 0, why: '球裡的空氣遇冷收縮，籃球摸起來比較軟、比較不彈。' },
  { e: '🌡️', c: '❄️', k: '液體', n: '溫度計放進冰水裡', ok: 0, why: '溫度計裡的液體遇冷收縮，紅線就往下降。' },
  { e: '🧪', c: '❄️', k: '液體', n: '熱水裝滿試管再放涼', ok: 0, why: '水（液體）遇冷收縮，水面會比原來低一點。' },
  { e: '🛤️', c: '❄️', k: '固體', n: '冬天的鐵軌', ok: 0, why: '鐵軌遇冷收縮變短，中間的縫會變寬。' },
  { e: '🔌', c: '❄️', k: '固體', n: '冬天的電線', ok: 0, why: '電線遇冷收縮變短，會拉得比較緊。' },
  { e: '⚫', c: '❄️', k: '固體', n: '加熱後穿不過鐵環的鐵球，放進冷水', ok: 0, why: '鐵球遇冷收縮變小，又可以穿過鐵環了！' },
];
const heatSprite = (size) => {                                        // 實驗桌上的東西、火焰／冰塊（emoji 小圖）
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(size, size, 1); sp.renderOrder = 5; sp.visible = false; scene.add(sp);
  sp.userData.size = size;
  sp.userData.set = (e) => { const c = cv.getContext('2d'); c.clearRect(0, 0, 128, 128); c.font = '96px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 64, 70); tex.needsUpdate = true; };
  return sp;
};
const heatItem = heatSprite(0.36), heatFire = heatSprite(0.24);
const HEAT_Q = { en: { title: 'Heat & Cold: expand or contract?', yes: 'Expand', no: 'Contract' }, list: HEAT_ITEMS, key: HEAT_KEY, title: '🌡️ 熱脹冷縮：膨脹還是收縮？', icon: '🌡️', yes: ['➕', '膨脹'], no: ['➖', '收縮'],
  ask: (q) => `${q.c}「${q.n}」會膨脹還是收縮？（${q.k}）`, intro: '從細節觀察不同的地方！東西變熱、變冷的時候，會變大還是變小呢？',
  endTalk: (sc, n) => (sc === n ? '全部答對！你觀察得好仔細！' : sc >= 3 ? '很棒喔！上課專心，就會越來越厲害！' : '沒關係，記住：受熱膨脹、遇冷收縮！'),
  quitTalk: (n) => `🌡️ 下次再來找${n.name}做實驗！上課要專心唷！` };
// 東西放在竹竹老師前面的大實驗桌上，下面是火焰或冰塊；答完慢慢變大或變小
HEAT_Q.start = (n) => {
  const r = rooms.find((x) => x.name === '自然教室二'), f = r.f;
  HEAT_Q.at = new THREE.Vector3(r.m.x2 - 1.75, f.y + 0.87, r.cz + 0.3);
  HEAT_Q.anim = null;
  HEAT_Q.tick = (dt) => {
    const a = HEAT_Q.anim; if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / 1.2), s = heatItem.userData.size * (1 + (a.ok ? 0.45 : -0.4) * (1 - (1 - k) ** 3));
    heatItem.scale.set(s, s, 1); heatItem.position.y = HEAT_Q.at.y + 0.42 + (s - heatItem.userData.size) / 2;
    heatFire.position.y = HEAT_Q.at.y + 0.13 + Math.sin(a.t * 12) * 0.01;
  };
};
HEAT_Q.show = (q) => {
  const T = HEAT_Q.at, s = heatItem.userData.size; HEAT_Q.anim = null;
  heatItem.userData.set(q.e); heatItem.scale.set(s, s, 1); heatItem.position.set(T.x, T.y + 0.42, T.z); heatItem.visible = true;
  heatFire.userData.set(q.c === '🔥' ? '🔥' : '🧊'); heatFire.position.set(T.x, T.y + 0.13, T.z); heatFire.visible = true;
};
HEAT_Q.reveal = (q) => { HEAT_Q.anim = { t: 0, ok: q.ok }; };
HEAT_Q.end = () => { heatItem.visible = false; heatFire.visible = false; HEAT_Q.tick = null; };

/* ---------------- 臺灣史地大考驗：在學務處遇到高老師，是非題一回 5 題（對、錯各 2～3 題） ---------------- */
const HISTORY_KEY = 'campus-history-best';
const HISTORY_ITEMS = [
  { e: '⛰️', n: '臺灣最高的山是玉山', ok: 1, why: '玉山大約 3952 公尺，是臺灣第一高峰，也是東北亞最高的山。' },
  { e: '🏞️', n: '臺灣最長的河流是濁水溪', ok: 1, why: '濁水溪大約 187 公里，是臺灣最長的河流。' },
  { e: '🌊', n: '日月潭是臺灣最大的天然湖泊', ok: 1, why: '日月潭在南投縣，是臺灣最大的天然湖泊。' },
  { e: '🏝️', n: '澎湖是由很多小島組成的群島', ok: 1, why: '澎湖群島有九十多個大大小小的島嶼。' },
  { e: '☀️', n: '北回歸線有經過嘉義和花蓮', ok: 1, why: '嘉義水上、花蓮瑞穗都有北回歸線標誌。' },
  { e: '🏰', n: '安平古堡（熱蘭遮城）是荷蘭人蓋的', ok: 1, why: '荷蘭人在臺南安平蓋了熱蘭遮城，就是現在的安平古堡。' },
  { e: '⚓', n: '鄭成功打敗荷蘭人，荷蘭人離開臺灣', ok: 1, why: '1662 年鄭成功打敗荷蘭人，荷蘭人離開了臺灣。' },
  { e: '🚂', n: '劉銘傳在臺灣蓋了鐵路', ok: 1, why: '臺灣建省後第一任巡撫劉銘傳，蓋了基隆到新竹的鐵路。' },
  { e: '🛶', n: '蘭嶼的達悟族會划拼板舟', ok: 1, why: '達悟族住在蘭嶼，拼板舟是他們重要的文化。' },
  { e: '🏫', n: '溪口國小在臺北市文山區', ok: 1, why: '我們溪口國小就在臺北市文山區！' },
  { e: '⛰️', n: '臺灣最高的山是阿里山', ok: 0, why: '臺灣最高的山是玉山；阿里山以日出、雲海、森林鐵路有名。' },
  { e: '🏞️', n: '臺灣最長的河流是淡水河', ok: 0, why: '最長的是濁水溪；淡水河流過臺北，是北部最重要的河流。' },
  { e: '🌊', n: '日月潭在花蓮縣', ok: 0, why: '日月潭在南投縣，南投是臺灣唯一不靠海的縣。' },
  { e: '🏖️', n: '墾丁在臺灣的最北邊', ok: 0, why: '墾丁在屏東縣，是臺灣的最南端。' },
  { e: '🧭', n: '臺灣的東邊是臺灣海峽', ok: 0, why: '臺灣東邊是太平洋，西邊才是臺灣海峽。' },
  { e: '🏙️', n: '臺北 101 在高雄市', ok: 0, why: '臺北 101 在臺北市信義區。' },
  { e: '🪨', n: '太魯閣國家公園在臺南市', ok: 0, why: '太魯閣國家公園在花蓮縣，有很壯觀的峽谷。' },
  { e: '🏰', n: '安平古堡是日本人蓋的', ok: 0, why: '安平古堡（熱蘭遮城）是荷蘭人蓋的。' },
];
const HISTORY_Q = { en: { title: 'Taiwan History & Geography', yes: 'True', no: 'False' }, list: HISTORY_ITEMS, key: HISTORY_KEY, title: '🗺️ 臺灣史地大考驗', icon: '🗺️', yes: ['⭕', '對'], no: ['❌', '錯'],
  ask: (q) => `🗺️ 「${q.n}」，對還是錯？`, intro: '要認真學習唷！我們來考考臺灣的歷史和地理，看你知道多少！',
  endTalk: (sc, n) => (sc === n ? '全部答對！你是臺灣史地小博士！' : sc >= 3 ? '很棒喔！要認真學習，出去玩也要注意安全唷！' : '沒關係，多看書、多出去走走，就會越來越認識臺灣！'),
  quitTalk: (n) => `🗺️ 下次再來找${n.name}挑戰！出去玩要注意安全唷！` };

/* ---------------- 交通安全大考驗：在學務處遇到陳老師（生教組長），是非題一回 5 題 ---------------- */
const TRAFFIC_ITEMS = [
  { e: '🚸', n: '過馬路要走斑馬線（行人穿越道）', ok: 1, why: '走斑馬線，開車、騎車的人才看得到你、會讓你先過。' },
  { e: '👀', n: '過馬路前先停下來，左右看清楚有沒有車', ok: 1, why: '「停、看、聽」：停下來、左右看、聽聽有沒有車子的聲音，再過馬路。' },
  { e: '🚦', n: '綠燈亮了，也要注意有沒有轉彎的車子', ok: 1, why: '綠燈時還是會有轉彎的汽車、機車，要看清楚再走。' },
  { e: '🪖', n: '騎腳踏車要戴安全帽', ok: 1, why: '戴安全帽可以保護頭部，跌倒時比較不會受重傷。' },
  { e: '🚗', n: '坐汽車時，坐後座也要繫安全帶', ok: 1, why: '前座、後座都要繫安全帶，緊急煞車時才不會被甩出去。' },
  { e: '🚌', n: '等公車要排隊，等車子停好再上車', ok: 1, why: '車子停好再上下車，才不會跌倒或被夾到。' },
  { e: '🌙', n: '晚上出門穿淺色或有反光條的衣服', ok: 1, why: '淺色和反光的衣服，晚上開車的人比較容易看到你。' },
  { e: '🚪', n: '下車開車門前，先回頭看後面有沒有機車、腳踏車', ok: 1, why: '突然開車門可能撞到後面來的機車，要先看清楚再慢慢開。' },
  { e: '🚂', n: '平交道的警鈴響了、柵欄放下來，要停下來等', ok: 1, why: '警鈴響就是火車快來了，千萬不可以穿越平交道。' },
  { e: '🏃', n: '小綠人在閃了，還沒走的人趕快衝過去', ok: 0, why: '小綠人閃了表示快變紅燈，還沒走的人要等下一個綠燈。' },
  { e: '📱', n: '一邊滑手機一邊過馬路', ok: 0, why: '過馬路要專心看車子，不可以低頭滑手機。' },
  { e: '🙈', n: '在停好的車子後面玩躲貓貓', ok: 0, why: '車子後面是駕駛看不到的地方，車子倒車會撞到人，很危險！' },
  { e: '⚽', n: '球滾到馬路上，馬上衝出去撿', ok: 0, why: '先停下來看車子，請大人幫忙撿，不要直接衝到馬路上。' },
  { e: '🛴', n: '在馬路上騎滑板車、溜直排輪', ok: 0, why: '馬路上有很多車子，要在公園或安全的空地玩。' },
  { e: '🚲', n: '騎腳踏車時雙手放開龍頭，比較帥', ok: 0, why: '雙手要握好龍頭，才能控制方向、隨時煞車。' },
  { e: '🔴', n: '紅燈時，左右看看沒有車就可以過馬路', ok: 0, why: '紅燈就要停下來等，就算沒有車也要遵守交通規則。' },
  { e: '🪟', n: '坐車時把頭和手伸出窗外吹風', ok: 0, why: '頭和手伸出窗外，可能會撞到路邊的東西或其他車子。' },
  { e: '🚌', n: '下公車後，從公車前面或後面突然跑出去過馬路', ok: 0, why: '公車擋住了視線，其他車子看不到你，要等公車開走再走斑馬線。' },
];
const TRAFFIC_Q = { en: { title: 'Traffic Safety Quiz', yes: 'Right', no: 'Wrong' }, list: TRAFFIC_ITEMS, key: 'campus-traffic-best', title: '🚦 交通安全大考驗', icon: '🚦', yes: ['⭕', '對'], no: ['❌', '不對'],
  ask: (q) => `🚦「${q.n}」，這樣做對不對？`, intro: '走廊上不要奔跑，上下樓梯注意安全！我們來考考交通安全，看你知道多少！',
  endTalk: (sc, n) => (sc === n ? '全部答對！你是交通安全小尖兵！' : sc >= 3 ? '很棒喔！上學、放學的路上也要注意安全！' : '沒關係，記住「停、看、聽」，過馬路就安全了！'),
  quitTalk: (n) => `🚦 下次再來找${n.name}挑戰！走廊上不要奔跑喔！` };

/* ---------------- 分數計算：在六年一班遇到黃老師，老師在黑板上算了一題，幫老師檢查「算對還是算錯」 ----------------
   每次隨機出題（異分母加減、分數乘法、分數除法、整數乘分數）；算錯的題目是常見的錯法（分子加分子、分母加分母、除法忘了倒過來…） */
const FRACTION_KEY = 'campus-fraction-best';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
// 約分後寫成「a/b」、「整數」或「帶分數（1又1/6）」
function fracText(n, d) {
  const g = gcd(n, d); n /= g; d /= g;
  if (d === 1) return `${n}`;
  return n > d ? `${Math.floor(n / d)}又${n % d}/${d}` : `${n}/${d}`;
}
// 算式最後一步：先寫沒約分的結果，能約分或化成帶分數才再接「＝…」
const fracTail = (n, d) => { const t = fracText(n, d); return t === `${n}/${d}` ? `${n}/${d}` : `${n}/${d}＝${t}`; };
function makeFractionItems() {
  const ri = (a, b) => a + (Math.random() * (b - a + 1) | 0);
  const pick = (a) => a[Math.random() * a.length | 0];
  const frac = (dens) => { for (;;) { const d = pick(dens), n = ri(1, d - 1); if (gcd(n, d) === 1) return [n, d]; } };
  const same = (a, b) => a[0] * b[1] === b[0] * a[1];
  const one = (want) => {
    for (;;) {
      const kind = pick(['add', 'sub', 'mul', 'div', 'whole']);
      let [n1, d1] = frac([2, 3, 4, 5, 6, 8]), [n2, d2] = frac([2, 3, 4, 5, 6, 8]);
      let ans, wrong, show, why, e;
      if (kind === 'add' || kind === 'sub') {
        if (d1 === d2) continue;
        if (kind === 'sub' && n1 * d2 <= n2 * d1) [n1, d1, n2, d2] = [n2, d2, n1, d1];
        if (kind === 'sub' && n1 * d2 === n2 * d1) continue;
        const L = d1 * d2 / gcd(d1, d2), a = n1 * L / d1, b = n2 * L / d2, s = kind === 'add' ? 1 : -1;
        ans = [a + s * b, L];
        wrong = kind === 'add' ? [n1 + n2, d1 + d2] : [a + s * b + pick([1, -1]), L];       // 分子加分子、分母加分母；或通分後算錯一點
        e = kind === 'add' ? '➕' : '➖';
        show = `${n1}/${d1} ${kind === 'add' ? '＋' : '－'} ${n2}/${d2}`;
        why = `先通分：${n1}/${d1}＝${a}/${L}、${n2}/${d2}＝${b}/${L}，${a}/${L} ${kind === 'add' ? '＋' : '－'} ${b}/${L}＝${fracTail(...ans)}`;
      } else if (kind === 'mul') {
        ans = [n1 * n2, d1 * d2]; wrong = [n1 * n2, d1 + d2]; e = '✖️';
        show = `${n1}/${d1} × ${n2}/${d2}`;
        why = `分子乘分子、分母乘分母：${fracTail(...ans)}`;
      } else if (kind === 'div') {
        ans = [n1 * d2, d1 * n2]; wrong = [n1 * n2, d1 * d2]; e = '➗';                    // 忘了倒過來
        show = `${n1}/${d1} ÷ ${n2}/${d2}`;
        why = `除以一個分數，就是乘它的倒數：${n1}/${d1} × ${d2}/${n2}＝${fracTail(...ans)}`;
      } else {
        const k = ri(2, 5);
        ans = [k * n1, d1]; wrong = [k * n1, k * d1]; e = '✖️';                              // 分子分母都乘了
        show = `${k} × ${n1}/${d1}`;
        why = `整數只乘分子：${k} × ${n1}/${d1}＝${fracTail(...ans)}`;
      }
      if (wrong[0] <= 0 || same(ans, wrong)) continue;
      const res = want ? ans : wrong;
      return { e, n: `${show} ＝ ${fracText(...res)}`, ok: want ? 1 : 0, why: want ? why : `正確答案是 ${fracText(...ans)}。${why}` };
    }
  };
  return [0, 1, 2, 3, 4, 5].flatMap(() => [one(1), one(0)]);
}
const FRACTION_Q = { en: { title: 'Fractions: did the teacher get it right?', yes: 'Right', no: 'Wrong' }, get list() { return makeFractionItems(); }, key: FRACTION_KEY, title: '🧮 分數計算：老師算對了嗎？', icon: '🧮', yes: ['⭕', '算對了'], no: ['❌', '算錯了'],
  ask: () => '🧮 黃老師在黑板上算了這一題，算對還是算錯？', intro: '老師在黑板上算了幾題分數，幫我檢查看看！算的時候要專心，一次做好一件事！',
  endTalk: (sc, n) => (sc === n ? '全部答對！分數難不倒你，六年一班最棒！' : sc >= 3 ? '很不錯喔！記得先通分、再計算，最後約分！' : '沒關係，分數就像切壽司，慢慢想就會懂！'),
  quitTalk: (n) => `🧮 下次再來找${n.name}算分數！` };

/* ---------------- 生活大考驗（低年級）：在一年三班遇到闕老師，「這樣做對不對？」一回 5 題 ---------------- */
const LIFE_KEY = 'campus-life-best';
const LIFE_ITEMS = [
  { e: '🧼', n: '吃飯前先用肥皂洗手', ok: 1, why: '用肥皂把手洗乾淨，細菌就不會跑進肚子裡。' },
  { e: '🚦', n: '過馬路走斑馬線，看清楚紅綠燈', ok: 1, why: '綠燈亮了、左右看看沒有車，再走斑馬線過馬路。' },
  { e: '🙋', n: '上課想說話，先舉手', ok: 1, why: '先舉手，老師叫到再說，大家才聽得清楚。' },
  { e: '♻️', n: '喝完的寶特瓶沖乾淨，再拿去資源回收', ok: 1, why: '沖乾淨再回收，垃圾變資源，地球會更乾淨！' },
  { e: '🦷', n: '睡覺前刷牙', ok: 1, why: '睡前刷牙，牙齒才不會蛀掉。' },
  { e: '🙏', n: '別人幫忙我的時候，說「謝謝」', ok: 1, why: '說謝謝是有禮貌的好孩子！' },
  { e: '🤧', n: '打噴嚏的時候，用衛生紙或手肘遮住', ok: 1, why: '遮住口鼻，病菌才不會傳給別人。' },
  { e: '💧', n: '口渴的時候喝白開水', ok: 1, why: '白開水最健康，身體最需要水。' },
  { e: '🧹', n: '輪到打掃的時候，認真把地掃乾淨', ok: 1, why: '大家一起打掃，教室乾乾淨淨好舒服。' },
  { e: '🏃', n: '下課在走廊上奔跑、追來追去', ok: 0, why: '在走廊跑很容易撞到人、跌倒，要慢慢走。' },
  { e: '🍬', n: '不認識的人給我糖果，就跟他走', ok: 0, why: '不可以跟陌生人走！要馬上告訴老師或爸爸媽媽。' },
  { e: '🔌', n: '手濕濕的去摸插頭', ok: 0, why: '水會導電，濕手摸插頭會觸電，很危險！' },
  { e: '🍱', n: '吃完的便當盒丟在地上', ok: 0, why: '垃圾要丟進垃圾桶，或做好分類回收。' },
  { e: '🧃', n: '每天都用含糖飲料代替喝水', ok: 0, why: '含糖飲料喝太多會蛀牙、變胖，口渴要喝白開水。' },
  { e: '📱', n: '玩手機玩到很晚才睡覺', ok: 0, why: '早睡早起身體好，眼睛也要休息。' },
  { e: '🪑', n: '站在椅子上搖來搖去', ok: 0, why: '椅子會倒下來，很容易受傷！' },
  { e: '🚰', n: '洗完手，水龍頭開著不關', ok: 0, why: '要隨手關緊水龍頭，節約用水。' },
  { e: '🗣️', n: '別人在說話時，一直插嘴', ok: 0, why: '要等別人說完再說，這是好禮貌。' },
];
const LIFE_Q = { en: { title: 'Everyday Life: right or wrong?', yes: 'Right', no: 'Wrong' }, list: LIFE_ITEMS, key: LIFE_KEY, title: '🏠 生活大考驗：這樣做對不對？', icon: '🏠', yes: ['⭕', '對'], no: ['❌', '不對'],
  ask: (q) => `🏠 「${q.n}」，這樣做對不對？`, intro: '我們來看看，你是不是生活小達人！想一想，這樣做對不對？',
  endTalk: (sc, n) => (sc === n ? '全部答對！你是生活小達人！' : sc >= 3 ? '很棒喔！在家裡、在學校都要記得這樣做！' : '沒關係，記住老師說的，下次一定會更好！'),
  quitTalk: (n) => `🏠 下次再來找${n.name}挑戰喔！` };

/* ---------------- 電子積木：方陣教室地板上的積木板，看電路接法猜「燈泡會不會亮」 ----------------
   一回 5 題；答完板子上的燈泡真的亮起來（或不亮）。不用老師，走到積木板旁邊按 F 就能玩 */
const BLOCKS_KEY = 'campus-blocks-best';
// 每一題的電路：parts 從左上順時針排在一個方框上：bat 電池、bat- 電池接反、wire 導線、gap 斷掉、sw0 開關沒按、sw1 開關按下、
//   bulb 燈泡、led LED（正接）、led- LED 接反、plastic 塑膠片、nail 鐵釘、foil 鋁箔、rubber 橡皮筋、short 導線直接接電池兩極
const BLOCKS_ITEMS = [
  { e: '💡', n: '電池＋導線＋燈泡，接成一整圈', parts: ['bat', 'wire', 'bulb', 'wire'], ok: 1, why: '電流從電池出發，繞一圈回到電池，形成「通路」，燈泡就亮了！' },
  { e: '✂️', n: '其中一段導線沒有接上', parts: ['bat', 'gap', 'bulb', 'wire'], ok: 0, why: '中間斷掉就是「斷路」，電流過不去，燈泡不會亮。' },
  { e: '🔘', n: '接了開關，但是開關沒有按下去', parts: ['bat', 'sw0', 'bulb', 'wire'], ok: 0, why: '開關打開時電路是斷的，燈泡不會亮。' },
  { e: '👆', n: '接了開關，開關按下去了', parts: ['bat', 'sw1', 'bulb', 'wire'], ok: 1, why: '開關按下去，電路就接通了，燈泡會亮。' },
  { e: '🔴', n: 'LED 長腳接正極、短腳接負極', parts: ['bat', 'wire', 'led', 'wire'], ok: 1, why: 'LED 有方向性，正接就會亮。' },
  { e: '🔃', n: 'LED 接反了（長腳接負極）', parts: ['bat', 'wire', 'led-', 'wire'], ok: 0, why: 'LED 只讓電流往一個方向走，接反了就不會亮。' },
  { e: '🧲', n: '電路中間接一根鐵釘', parts: ['bat', 'nail', 'bulb', 'wire'], ok: 1, why: '鐵是導體，電可以通過，燈泡會亮。' },
  { e: '🥫', n: '電路中間接一段鋁箔紙', parts: ['bat', 'foil', 'bulb', 'wire'], ok: 1, why: '鋁箔是金屬，是導體，燈泡會亮。' },
  { e: '🧴', n: '電路中間接一片塑膠尺', parts: ['bat', 'plastic', 'bulb', 'wire'], ok: 0, why: '塑膠是絕緣體，電通不過去，燈泡不會亮。' },
  { e: '🎗️', n: '電路中間接一條橡皮筋', parts: ['bat', 'rubber', 'bulb', 'wire'], ok: 0, why: '橡膠是絕緣體，燈泡不會亮。' },
  { e: '⚠️', n: '導線直接把電池正負極接起來，燈泡接在旁邊', parts: ['short', 'wire', 'bulb', 'wire'], ok: 0, why: '這是「短路」，電流不經過燈泡，燈泡不亮，電池還會發燙，很危險！' },
  { e: '🔋', n: '沒有電池，只有導線和燈泡', parts: ['wire', 'wire', 'bulb', 'wire'], ok: 0, why: '沒有電池就沒有電，燈泡不會亮。' },
];
const BLOCKS_Q = { en: { title: 'Electronic Blocks: will the bulb light up?', yes: 'Lights up', no: 'Stays off' }, list: BLOCKS_ITEMS, key: BLOCKS_KEY, title: '🧩 電子積木：燈泡會亮嗎？', icon: '🧩', yes: ['💡', '會亮'], no: ['⚫', '不會亮'],
  ask: (q) => `🧩「${q.n}」，燈泡會亮嗎？`, intro: '看看積木板上的電路，猜猜看燈泡會不會亮！',
  endTalk: (sc, n) => (sc === n ? '全部答對！你是電路小專家！' : sc >= 3 ? '很棒喔！記得：要接成一整圈「通路」燈才會亮！' : '沒關係，再試一次，看清楚電路有沒有接成一圈！'),
  quitTalk: () => '🧩 下次再來玩電子積木！' };
// 開始時站到積木板南邊、低頭看板子（不要站在板子上）
BLOCKS_Q.start = () => { const r = rooms.find((x) => x.name === '方陣教室'); placeAt(r.f, r.cx, r.cz + 2.0, 0); avatar.rotation.y = 0; player.yaw = 0; player.pitch = -0.75; };
BLOCKS_Q.show = (q) => blocksBoard.userData.draw(q.parts, false);
BLOCKS_Q.reveal = (q) => blocksBoard.userData.draw(q.parts, !!q.ok);
BLOCKS_Q.end = () => blocksBoard.userData.draw(null);

function startFood(n, Q = GLIDER_Q) {
  stopAuto();
  const $ = (sel) => foodBox.querySelector(sel);
  const btns = [...foodBox.querySelectorAll('[data-a]')];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nOk = Math.random() < 0.5 ? 2 : 3;                               // 一回 5 題：能吃、不能吃各 2～3 題
  const qs = shuffle([...shuffle(Q.list.filter((q) => q.ok)).slice(0, nOk), ...shuffle(Q.list.filter((q) => !q.ok)).slice(0, 5 - nOk)]);
  let i = 0, score = 0, locked = false, done = false, best = 0;
  try { best = +localStorage.getItem(Q.key) || 0; } catch { /* 私密模式 */ }
  n.playing = true;
  if (n.g) faceTeacher(n);                                            // 電子積木沒有老師
  const yesT = T(Q.yes[1], Q.en.yes), noT = T(Q.no[1], Q.en.no);
  $('.ttl').textContent = T(Q.title, `${Q.icon} ${Q.en.title}`);
  btns.forEach((b) => (b.innerHTML = +b.dataset.a ? `${Q.yes[0]}<small>${yesT} 1</small>` : `${Q.no[0]}<small>${noT} 2</small>`));
  Q.start?.(n);
  const msg = (text, cls = '') => { const m = $('.msg'); m.innerHTML = text; m.className = `msg ${cls}`; };
  const ready = () => {
    locked = false; btns.forEach((b) => (b.disabled = false));
    const q = qs[i];
    $('.round').textContent = T(`第 ${i + 1}／${qs.length} 題・答對 ${score}`, `Question ${i + 1}/${qs.length} · ${score} correct`);
    $('.emo').textContent = q.e; $('.nm').textContent = q.n;
    msg(Q.ask(q)); Q.show?.(q);
  };
  const finish = () => {
    done = true; foodBox.hidden = true; Q.end?.();
    updateVisibility();                                                 // 名牌放回來
    removeEventListener('keydown', onKey, true);
    n.playing = false; act.busy = null; gameState.duel = null;
  };
  const answer = (a) => {
    if (locked || done) return;
    locked = true; btns.forEach((b) => (b.disabled = true));
    const q = qs[i], right = a === q.ok;
    if (right) score++;
    $('.round').textContent = T(`第 ${i + 1}／${qs.length} 題・答對 ${score}`, `Question ${i + 1}/${qs.length} · ${score} correct`);
    msg(`${right ? T('✅ 答對了！', '✅ Correct! ') : T('❌ 答錯囉！', '❌ Wrong! ')}${q.ok ? yesT : noT}：${q.why}`, right ? 'ok' : 'no');
    Q.reveal?.(q);
    if (n.g) npcFace(n, right ? 'happy' : 'surprised', 1.8);
    setTimeout(() => {
      if (done) return;
      if (++i < qs.length) { ready(); return; }
      if (score > best) { best = score; try { localStorage.setItem(Q.key, String(best)); } catch { /* 私密模式 */ } }
      if (n.g) npcFace(n, score >= 4 ? 'happy' : 'wink', 3);
      finish();
      toast(`${T(`${Q.icon} 答對 ${score}／${qs.length} 題！（最佳紀錄：${best} 題）`, `${Q.icon} ${score}/${qs.length} correct! (best ${best})`)}<br>${n.name ? `${n.name}：` : ''}${Q.endTalk(score, qs.length)}`);
    }, 2600);
  };
  const onKey = (e) => {
    const k = { Digit1: 1, Digit2: 0, Numpad1: 1, Numpad2: 0 }[e.code];
    if (k !== undefined) { e.preventDefault(); e.stopPropagation(); answer(k); }
  };
  addEventListener('keydown', onKey, true);
  btns.forEach((b) => (b.onclick = () => answer(+b.dataset.a)));
  $('.quit').onclick = () => gameState.duel?.quit();
  gameState.duel = { quit() { finish(); toast(T(Q.quitTalk(n), `${Q.icon} Come back and play again!`)); } };
  act.busy = { label: '', tick(dt) { Q.tick?.(dt); } };                 // 玩的時候不能走動（視窗在下面，橘色提示鈕先收起來）
  foodBox.hidden = false;
  ready();
  msg(`${n.name}：${Q.intro}`);
}

// app.js 依互動種類（spot.kind）呼叫
export const play = {
  glider: (s) => startFood(s.npc), float: (s) => startFood(s.npc, FLOAT_Q), heat: (s) => startFood(s.npc, HEAT_Q), history: (s) => startFood(s.npc, HISTORY_Q),
  traffic: (s) => startFood(s.npc, TRAFFIC_Q), fraction: (s) => startFood(s.npc, FRACTION_Q), life: (s) => startFood(s.npc, LIFE_Q), blocks: () => startFood({ name: '電子積木' }, BLOCKS_Q),
};
