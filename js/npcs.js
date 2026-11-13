/* 老師 NPC 資料（依照片畫成方塊人）：名字、職稱、台詞、站的位置、小遊戲、外觀與臉
 *   2026-11-11 從 app.js 搬出來：加老師、改台詞、換站位只要改這個檔案。
 *
 * 每位老師的欄位：
 *   name / title      名牌上的名字、職稱
 *   game              靠近按 F 玩的小遊戲種類（要在 app.js 的 GAME_FILE 裡）
 *   hello             靠近時隨機說的話
 *   at()              固定站的位置 → [x, z, 面向]（面向 0＝北、Math.PI＝南、-Math.PI/2＝東、Math.PI/2＝西）
 *   places[]          會換地方的老師：{ floor, where, game, outfit, at() }，每次進網站隨機挑一個
 *   outfits           換裝（places[].outfit 指定用哪一套）
 *   look              外觀：顏色、頭髮、配件、pal（臉的調色盤）、face（16×16 點陣，一行 16 個字）
 *
 * 站位要用到教室位置，所以這裡是一個函式：app.js 建好教室（rooms）以後呼叫 makeNPCS(ctx) 拿到清單。
 * 改完一定要跑 node tools/check.mjs（會檢查每位老師站得到、小遊戲有檔案）。 */
import { poolWater } from './extras.js?v=327';

export function makeNPCS({ D, rooms, mx, mz, S, rectM }) {
  // Teacher Angela 在科任教師辦公室站的地方
  // 思源樓（D）教室門在東、教室前後對調：黑板在南，老師站在黑板前面、面向學生（北）
  const D_CLASS_FRONT = (r) => [r.cx - 0.6, r.m.z2 - 1.6, 0];
  const ANGELA_OFFICE = { x: (r) => r.cx + 1.2, z: (r) => r.cz + 3.3 };   // 南邊黑板前那條走道（辦公桌之間太窄，猜拳時學生站不下）
  return [
    {
      name: '呂老師', title: '體育老師', game: 'badminton',
      hello: '🏃‍♀️ 呂老師：嗨！今天也要來操場動一動喔！',
      // 操場北側直道、起跑線旁，面向球場
      at: () => {
        const T = D.outdoor.track;
        return [mx(T.center[0]) - 6.5, mz(T.center[1]) - T.size[1] / S / 2 + 2.2, Math.PI];
      },
      look: {
        // 依照片：黑色中分長直髮、笑開露牙、磚紅色長袖毛衣；體育老師配運動褲＋哨子
        skin: '#f0c4a6', hair: '#231816', top: '#9a3f2c', pants: '#22252b', stripe: '#f2f2f2', shoe: '#f4f4f4',
        longHair: true, longSleeve: true, whistle: true,
        pal: { H: '#231816', h: '#3a2a26', S: '#f0c4a6', E: '#2a1a14', B: '#f19a8e', M: '#a8352e', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHSSHHHHHHHH',
          'HHHHHSSSSSHHHHHH',
          'HHHSSSSSSSSSHHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSEESSSSEESSHH',
          'HHSESSESSESSESHH',
          'HHSSSSSSSSSSSSHH',
          'HHSBBSSSSSSBBSHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHSSSSMMMMSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '陳老師', title: '體育老師', game: 'swim',
      hello: '🏊 陳老師：游泳前記得先暖身，下水要聽哨音喔！',
      // 游泳館裡：泳池西端的池畔（比較寬），面向泳池
      at: () => { const P = poolWater(rectM(D.outdoor.pool)); return [P.x - P.w / 2 - 1.6, P.z, -Math.PI / 2]; },
      look: {
        // 依照片：黑色刺刺短髮、一字眉、細長眼、淺淺微笑；黑外套＋白襯衫領（改成運動外套）
        skin: '#e8b896', hair: '#16110f', top: '#1f2229', pants: '#1f2229', stripe: '#f2f2f2', shoe: '#f4f4f4',
        shortHair: true, spiky: true, longSleeve: true, whistle: true, collar: '#ffffff', zip: '#cfd3d8',
        pal: { H: '#16110f', h: '#2b2220', S: '#e8b896', E: '#1a1210', N: '#d4a07e', M: '#b5675a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHhHHHHHHhHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HSHHSSHHHSSHHSHH',
          'HSSSSSSSSSSSSSSH',
          'SSSSSSSSSSSSSSSS',
          'SSHHHSSSSSSHHHSS',
          'SSSSSSSSSSSSSSSS',
          'SSSEESSSSSSEESSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'NSSSSSSSSSSSSSSN',
        ],
      },
    },
    {
      name: '鄧老師', title: '體育組長', game: 'shootout',
      hello: ['🏀 鄧老師：同學要多運動唷！', '🏀 鄧老師：一起來打球吧！'],
      // 隨機出現：操場北邊那座籃球場，或活動中心（4F）的球場
      places: [
        { floor: '1F', where: '操場籃球場', game: true, at: () => { const T = D.outdoor.track; return [mx(T.center[0]) + 3, mz(T.center[1]) - 5.3, Math.PI]; } },
        { floor: '4F', where: '活動中心', game: true, at: () => { const r = rooms.find((x) => x.name === '活動中心'); return [r.cx - 2, r.cz + 1.5, Math.PI / 2]; } },
      ],
      at() { return this.places[0].at(); },
      look: {
        // 依照片：深咖啡色短髮（旁分）、淺膚色、細長眼、淺淺微笑；灰綠色 T 恤、白色短褲、紅色哨子（黑色掛繩）
        skin: '#ecbf9c', hair: '#3a2a20', top: '#557d7a', pants: '#f1efe8', stripe: '#9fcfb5', shoe: '#f4f4f4',
        shortHair: true, whistle: true,
        pal: { H: '#3a2a20', h: '#4d392b', S: '#ecbf9c', B: '#3a2a20', E: '#2a1a14', N: '#d6a382', M: '#b06a5c' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHhHHHHHHHHH',
          'HHHHHSSHHHHHHHHH',
          'HHSSSSSSHHHSSSHH',
          'HSSSSSSSSSSSSSSH',
          'SSBBBSSSSSSBBBSS',
          'SSSSSSSSSSSSSSSS',
          'SSSEESSSSSSEESSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'NSSSSSSSSSSSSSSN',
        ],
      },
    },
    {
      name: '阿喵老師', title: '電腦老師',
      hello: [
        '🐱 阿喵老師：要專心上課唷！',
        '😾 阿喵老師兇巴巴恰北北！',
        '🚀 阿喵老師：跟你們這些地球人溝通有問題，我要回火星！',
      ],
      // 1 樓電腦教室一（109）外面、靠中庭的走廊（敬業樓南側走廊），面向中庭
      at: () => [mx(1425), mz(565), Math.PI],
      look: {
        // 三花貓（擬人化）：白底＋橘色、黑色色塊，黑框眼鏡、琥珀色眼睛；大頭；淺藍襯衫＋卡其褲
        cat: true, headScale: 1.35, skin: '#fbf8f2', hair: '#fbf8f2', top: '#7fa7d6', collar: '#ffffff', pants: '#9b8a66', shoe: '#5a3d2b',
        longSleeve: true, ears: ['#2a2420', '#e8892b'], whisker: '#6b6b6b',
        patches: [['#e8892b', 0, 0, 7, 8], ['#e8892b', 10, 10, 6, 6], ['#2a2420', 9, 0, 7, 6], ['#2a2420', 0, 11, 5, 5]],
        pal: { W: '#fbf8f2', O: '#e8892b', B: '#2a2420', h: '#2a2420', K: '#141414', L: '#cfe8f7', E: '#e0a800', p: '#111111', P: '#e8899c', M: '#3a3a3a' },
        face: [
          'OOOOOOWWWBBBBBBB',
          'OOOOOWWWWWBBBBBB',
          'OOOOWWWWWWWBBBBB',
          'OOOWWWWWWWWWBBBB',
          'OKKKKKWWWWKKKKKB',
          'OKLEELKKKKLEELKB',
          'WKLEpLKWWKLpELKW',
          'WKKKKKWWWWKKKKKW',
          'WWWWWWWWWWWWWWWW',
          'WWWWWWWPPWWWWWWW',
          'WWWWWWWMMWWWWWWW',
          'WWWWWWMWWMWWWWWW',
          'WWWWWWWWWWWWWWWW',
          'WWWWWWWWWWWWWWWW',
          'WWWWWWWWWWWWWWWW',
          'WWWWWWWWWWWWWWWW',
        ],
      },
    },
    {
      name: '小瑜老師', title: '音樂老師', game: 'recorder',
      hello: ['🎵 小瑜老師：今天一起來吹直笛吧！', '🎶 小瑜老師：上課前先把直笛擦乾淨唷！', '👍 小瑜老師：唱得很好聽，讚！',
        '🎵 小瑜老師：要不要來玩直笛記憶？老師吹一段，你照著吹回去！'],
      // 3 樓音樂教室二（304）前面、鋼琴旁邊（11-03 前後鏡射：電視、鋼琴在東邊，階梯在西邊），面向學生（西）；在這裡可以玩直笛記憶
      places: [
        { floor: '3F', where: '音樂教室二', game: true, at: () => { const r = rooms.find((x) => x.name === '音樂教室二'); return [r.m.x2 - 1.9, r.cz + 0.9, Math.PI / 2]; } },
      ],
      look: {
        // 依圖：棕色貝雷帽（白色 H）、橘棕色長直髮（旁分瀏海）、大大的棕色眼睛、腮紅、開口笑；
        // 棕色西裝外套＋白襯衫＋紅領帶、金色鈕扣、綠白黃胸章；手拿白色直笛
        skin: '#f8dcc4', hair: '#b8662a', top: '#6e5233', pants: '#4f3c26', shoe: '#3a2a20',
        longHair: true, longSleeve: true, collar: '#ffffff', tie: '#d6334a', buttons: '#e8c22a',
        badge: ['#2e8b57', '#ffffff', '#e8c22a'], beret: { color: '#6e5233', letter: '#f4efe4' }, holdL: 'recorder',
        pal: { H: '#b8662a', h: '#d98b45', S: '#f8dcc4', E: '#4a2412', e: '#9b5a2e', W: '#ffffff', B: '#f4a5a0', M: '#8e2a2a', T: '#e86a6a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHhHHHHHHhHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSHHHHH',
          'HHHHHHHSSSSSSHHH',
          'HHHHSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSEeeSSSSEeeSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSSMMMMSSSSHH',
          'HHSSSSMTTMSSSSHH',
          'HHSSSSSMMSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '陳老師', title: '五年四班導師', game: 'badminton',
      hello: ['🏸 陳老師：下課一起來打羽球吧！', '🏸 陳老師：五年四班的同學，作業交了沒？', '🐿️ 陳老師：小聲一點，蜜袋鼯在睡覺喔！'],
      // 隨機出現：4 樓五年四班（418 室）教室前面（至善樓教室前後對調，黑板在南）面向學生，
      //   或 4F 活動中心東半邊（面向西，可以打羽球；教室裡不行）
      places: [
        { floor: '4F', where: '五年四班', at: () => { const r = rooms.find((x) => x.code === '504'); return [r.cx - 0.6, r.m.z2 - 1.6, 0]; } },
        { floor: '4F', where: '活動中心', game: true, at: () => { const r = rooms.find((x) => x.name === '活動中心'); return [r.cx + 6, r.cz - 4, Math.PI / 2]; } },
      ],
      look: {
        // 依圖：黑色及肩直髮、齊瀏海、棕色大眼睛、淺淺微笑；紅色連帽 T（白色抽繩、大口袋）；左手羽球拍、右手羽毛球
        skin: '#f6d2b8', hair: '#151212', top: '#c8202a', pants: '#2b2b30', shoe: '#f4f4f4',
        longHair: true, longSleeve: true, hoodie: '#ffffff', holdL: 'racket', holdR: 'shuttle',
        pal: { H: '#151212', h: '#2c2626', S: '#f6d2b8', E: '#2a1610', e: '#7a4426', W: '#ffffff', B: '#f2b0a0', N: '#e2a98c', M: '#c0645a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHhHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHhHHHHHHHHHHhHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSEeeSSSSEeeSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSSMMMMSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: 'Ashley 老師', title: '輔導組長', game: 'words',
      hello: ['📝 Ashley 老師：要不要和 Ashley 老師練習背單字？', '📝 Ashley 老師：要不要和 Ashley 老師練習背單字？<br>💬 有心事也可以來輔導室找我聊聊喔！',
        '📝 Ashley 老師：要不要和 Ashley 老師練習背單字？<br>🐹 練完可以去輔導室看倉鼠羞羞喔！'],
      // 隨機出現：3 樓輔導室（327）外面的走廊（兩扇門中間，面向走廊），或 2 樓英語教室一（210）前面講台旁（面向學生）；兩個地方都可以練單字
      places: [
        { floor: '3F', where: '輔導室外', game: true, at: () => { const r = rooms.find((x) => x.name === '輔導室'); return [r.m.x1 - 0.65, r.cz, Math.PI / 2]; } },
        { floor: '2F', where: '英語教室一', game: true, at: () => { const r = rooms.find((x) => x.name === '英語教室一'); return [r.m.x1 + 1.3, r.cz + 1.2, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：深咖啡色頭髮往後綁（低髮髻、臉旁兩撮，帶一點紅棕色）、笑開露牙、淺膚色；淺藍綠色無袖上衣、紫色識別證掛繩
        skin: '#f4d6c2', hair: '#3b2418', top: '#7fd3dc', pants: '#2f3440', shoe: '#e9e4dc',
        bun: true, sleeveless: true, lanyard: '#6a3fc0',
        pal: { H: '#3b2418', h: '#7a4a32', S: '#f4d6c2', B: '#3b2418', E: '#1e120c', N: '#e3b8a0', R: '#f2aaa2', M: '#c0605a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHHHHHH',
          'HHHHHHHHHHHHhHHH',
          'HHHHSSSHHHHHHHHH',
          'HHHSSSSSSSHHHHHH',
          'HHSSSSSSSSSSSHHH',
          'HSSSSSSSSSSSSSSH',
          'HSSBBBSSSSBBBSSH',
          'SSSEESSSSSSEESSS',
          'SSSEESSSSSSEESSS',
          'SSSSSSSNNSSSSSSS',
          'SRRSSSSSSSSSSRRS',
          'SSSSMMMMMMMMSSSS',
          'SSSSMTTTTTTMSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '哈囉老師', title: '美勞老師', game: 'paint',
      hello: ['🎨 哈囉老師：哈囉～今天想畫什麼動物呢？', '🎨 哈囉老師：顏色沒有對錯，大膽塗上你喜歡的顏色！',
        '🖍️ 哈囉老師：要不要來幫小動物穿上新衣服？', '🎨 哈囉老師：哈囉哈囉！美勞教室今天開張囉～'],
      // 3 樓美勞教室（311）前面講台旁，面向學生（東）；在這裡可以玩著色
      places: [
        { floor: '3F', where: '美勞教室', game: true, at: () => { const r = rooms.find((x) => x.name === '美勞教室'); return [r.m.x1 + 1.4, r.cz + 1.3, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：米色毛線帽（頂端毛球）、咖啡色長直髮、笑開露牙；紅白圍巾（米白那端有紅色蝴蝶結）、
        //   卡其色鋪棉背心＋咖啡色外套袖子、酒紅色長裙＋深色內搭、白色球鞋、米色斜背包；美勞老師手拿水彩筆
        skin: '#f6d6c0', hair: '#5a3423', top: '#c49a6c', sleeve: '#9c6b45', pants: '#2b2b30', shoe: '#f4f4f4',
        longHair: true, longSleeve: true, beanie: '#d8c4a8', beanieCuff: '#cdb698', scarf: ['#d32f2f', '#f2e6da'],
        skirt: '#8e2a3a', bag: '#dccbbd', holdR: 'brush',
        pal: { K: '#d8c4a8', k: '#c4ae90', H: '#5a3423', h: '#7a4a32', S: '#f6d6c0', E: '#2a1610', W: '#ffffff', N: '#e8b89e', B: '#f2a7a0', M: '#b84a4a', T: '#ffffff' },
        face: [
          'KKKKKKKKKKKKKKKK',
          'KkKKkKKkKKkKKkKK',
          'KKKKKKKKKKKKKKKK',
          'kkkkkkkkkkkkkkkk',
          'HHHHHHSSSHHHHHHH',
          'HHHSSSSSSSSSSHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEESSSSSSEESHH',
          'HHSEWSSSSSSEWSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHSSSSMMMMSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: 'Poyen 老師', title: '五年一班導師', game: 'rps',
      rpsTalk: { start: '來猜拳吧！先贏兩局的人獲勝！', win: '好厲害！記得睡午覺，下午才有精神哦！', lose: '再接再厲！先去睡個午覺養精神吧！' },
      hello: ['😴 Poyen 老師：小朋友，睡午覺，下午才有精神哦！', '😴 Poyen 老師：小朋友，睡午覺，下午才有精神哦！<br>✂️ 要不要來猜個拳？'],
      // 4 樓五年一班（413 室）教室前面、電視旁邊（勤學樓教室黑板在西邊），面向學生（東）；老師桌在南邊，站北邊一點
      places: [
        { floor: '4F', where: '五年一班', game: true, at: () => { const r = rooms.find((x) => x.code === '501'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：深藍色 Nike 棒球帽（藍綠色勾勾）、黑色短髮、黑框方眼鏡、笑開露牙；牛仔褲、黑色斜背包。衣服是五年一班的班服（使用者 11-06 給的設計稿，前面 42TH、後面 ONE）
        skin: '#efc9a8', hair: '#1b1714', top: '#b5e1f8', pants: '#5a7fb8', shoe: '#3a3a3a',
        shortHair: true, bag: '#1d1d1f', teeImg: { front: 'img/class501/tee-front.webp', back: 'img/class501/tee-back.webp' },
        cap: { color: '#1f2a4a', logo: '#2fc4c4' },
        pal: { H: '#1b1714', h: '#2c2622', S: '#efc9a8', B: '#1b1714', K: '#151515', E: '#1e130d', N: '#ddb08e', M: '#9c3b34', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HSSSSSSSSSSSSSSH',
          'HSSSSSSSSSSSSSSH',
          'SBBBSSSSSSSSBBBS',
          'SKKKKKKSSKKKKKKS',
          'SKSSSSKKKKSSSSKS',
          'SKSEESKSSKSEESKS',
          'SKKKKKKSSKKKKKKS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSMMMMMMMMMMSSS',
          'SSSMTTTTTTTTMSSS',
          'SSSSMMMMMMMMSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '邱老師', title: '註冊組長', game: 'glider',
      hello: ['🌱 邱老師：我們來觀察植物！', '🐿️ 邱老師：要愛護小動物唷！', '🐿️ 邱老師：要愛護小動物唷！<br>你知道蜜袋鼯能吃什麼、不能吃什麼嗎？'],
      // 隨機出現：1 樓教務處（花花、泡泡就是她養的；站在櫃台後面、粉紅椅子那排桌子北邊的走道，面向門口，學生在櫃台外就能跟她玩），
      //   或 3 樓思科教室前面；兩個地方都可以玩
      places: [
        { floor: '1F', where: '教務處', game: true, at: () => { const r = rooms.find((x) => x.name === '教務處'); return [r.cx - 0.1, r.m.z1 + 1.0, -Math.PI / 2]; } },
        { floor: '3F', where: '思科教室', game: true, at: () => { const r = rooms.find((x) => x.name === '思科教室'); return [r.m.x1 + 1.4, r.cz + 1.2, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：深棕黑色長直髮、齊瀏海、溫柔微笑；玫瑰粉紅色翻領短袖洋裝（腰帶、打褶長裙）
        skin: '#f6d8c6', hair: '#2a1b1b', top: '#b85a6c', pants: '#f0cdb8', shoe: '#5a4038',
        longHair: true, collar: '#c96d80', skirt: '#b85a6c',
        pal: { H: '#2a1b1b', h: '#4a2e2c', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#b8505a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHHhHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHhHHHHhHHHhHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMSSSSMSSSHH',
          'HHSSSSMMMMSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '張校長', title: '校長', game: 'throw',
      throwAt: () => [-22.5, 72.5],                                       // 操場遊樂場（螺旋、直管溜滑梯）西邊的草地
      hello: ['😊 張校長：小朋友好！', '👍 張校長：你好棒！今天也要開開心心學習喔！', '🌟 張校長：遇到困難不要怕，努力就是最棒的！',
        '📚 張校長：多讀書、多運動，健康又快樂！', '🤝 張校長：有禮貌、會幫助別人，就是溪口的好孩子！'],
      // 隨機出現：1 樓穿堂（從正門進來，面向校門迎接小朋友），或操場遊戲場西邊的草地（換上棒球裝，在投手丘上，可以玩樂樂棒球）
      places: [
        { floor: '1F', where: '穿堂', game: true, at: () => { const r = rooms.find((x) => x.name === '穿堂'); return [r.cx - 1.2, r.cz + 1.8, Math.PI / 2]; } },
        // 樂樂棒球先保留（使用者測過覺得太難揮棒、學生站姿要改成側對校長）：之後要開放就把這行加回去
        // { floor: '1F', where: '樂樂棒球場', game: true, outfit: 'baseball', at: () => [BB.mound.x, BB.mound.z, Math.PI] },
      ],
      // 棒球裝：深藍棒球帽、白色球衣（深藍鈕扣）、白色球褲
      outfits: { baseball: { cap: { color: '#1f3a7a', logo: '#ffffff' }, top: '#f6f6f2', pants: '#f0efe8', longSleeve: false, collar: null, tie: null, buttons: '#1f3a7a', shoe: '#1d1d1f' } },
      look: {
        // 依照片：黑色短髮（旁分）、細框眼鏡、笑容；深灰藍色西裝、淺藍襯衫、紫藍格紋領帶
        skin: '#efc8a8', hair: '#1c1816', top: '#3b4454', pants: '#3b4454', shoe: '#1d1d1f',
        shortHair: true, longSleeve: true, collar: '#a9cbee', tie: '#6a5aa8', buttons: '#2b313c',
        pal: { H: '#1c1816', h: '#3a2e28', S: '#efc8a8', K: '#8a8f96', E: '#1e130d', N: '#ddb08e', M: '#9c3b34', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHhHHHHHHH',
          'HSSSHHHHHHHHHHSH',
          'SSSSSSSSSSHHHSSS',
          'SSSSSSSSSSSSSSSS',
          'SKKKKKSSSSKKKKKS',
          'SKSEESKKKKSEESKS',
          'SKKKKKSSSSKKKKKS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSMMMMMMMMMMSSS',
          'SSSSMTTTTTTMSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: 'Teacher Angela', title: '英文老師', game: 'rps',
      hello: ['🔤 Teacher Angela：快樂學英文！Happy English!', '👍 Teacher Angela：說得很標準，你好棒！Good job!',
        "✂️ Teacher Angela：Let's play rock-paper-scissors! 要不要來猜拳？"],
      rpsTalk: { start: 'Rock, paper, scissors! 先贏兩局的人獲勝！', win: 'Wow, you win! 說得很標準、猜拳也好厲害，你好棒！', lose: 'I win! 沒關係，再接再厲，Keep trying!' },
      rpsKey: 'campus-rps-wins-angela',
      // 隨機出現：2 樓英語教室一（210）前面講台旁（Ashley 老師站另一邊），或 2 樓科任教師辦公室；兩個地方都可以猜拳
      places: [
        { floor: '2F', where: '英語教室一', game: true, at: () => { const r = rooms.find((x) => x.name === '英語教室一'); return [r.m.x1 + 1.3, r.cz - 1.4, -Math.PI / 2]; } },
        { floor: '2F', where: '科任教師辦公室', game: true, at: () => { const r = rooms.find((x) => x.name === '科任教師辦公室'); return [ANGELA_OFFICE.x(r), ANGELA_OFFICE.z(r), Math.PI / 2]; } },   // 面向辦公室裡面（西）
      ],
      look: {
        // 依照片：深棕色長直髮、豹紋髮箍（粉紅蝴蝶結）、溫柔微笑；鼠尾草綠針織開襟外套＋灰色 Polo 衫、深灰百褶裙、咖啡色斜背包
        skin: '#f6d8c6', hair: '#3a2418', top: '#9aa58a', pants: '#f0d2c0', shoe: '#3a3a3a',
        longHair: true, longSleeve: true, collar: '#c4c4c0', buttons: '#7a8070', skirt: '#4a4d55', bag: '#7a3a2a',
        pal: { H: '#3a2418', h: '#5a3a26', L: '#c8965a', l: '#4a2e1a', P: '#f29ab8', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#c0605a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HLLlLLLLLPPPLlLH',
          'LlLLLlLLLPPPLLlL',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHhHHHHHHH',
          'HHHSSSSSSSSSSHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSSMMMMSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: 'Joanne 老師', title: '英文老師', game: 'listen',
      hello: ["👋 Joanne 老師：Hello! I'm Teacher Joanne. 一起來練英文聽力吧！", '👂 Joanne 老師：Listen carefully! 仔細聽，你一定聽得懂！',
        "😊 Joanne 老師：How are you today? 回答 I'm fine, thank you! 就對了～", "💧 Joanne 老師：Don't forget to drink water! 下課記得喝水喔！"],
      // 隨機出現：3 樓英語教室二（310）前面講台旁，或 2 樓科任教師辦公室（Teacher Angela 也會出現在那裡，Joanne 站在她北邊）；兩個地方都可以玩聽力
      places: [
        { floor: '3F', where: '英語教室二', game: true, at: () => { const r = rooms.find((x) => x.name === '英語教室二'); return [r.m.x1 + 1.3, r.cz - 0.4, -Math.PI / 2]; } },
        { floor: '2F', where: '科任教師辦公室', game: true, at: () => { const r = rooms.find((x) => x.name === '科任教師辦公室'); return [ANGELA_OFFICE.x(r), ANGELA_OFFICE.z(r) - 3.3, Math.PI / 2]; } },   // 兩區辦公桌中間的走道（離 Angela 3.3 公尺，名牌才不會黏在一起）
      ],
      look: {
        // 依照片：淺咖啡色頭髮往後綁（臉旁兩撮）、笑開露牙；白色短袖 T 恤＋灰色細格紋吊帶洋裝（前面一排扣子、黑色細皮帶）、拿著深藍色水壺
        skin: '#f3d2bc', hair: '#7a5236', top: '#8f8b84', pants: '#f3d2bc', shoe: '#e9e4dc',
        bun: true, tee: '#f7f7f4', collar: '#f7f7f4', buttonRow: '#5e5a54', belt: '#1a1a1a', shortSkirt: '#8f8b84', holdR: 'bottle',
        pal: { H: '#7a5236', h: '#9a6c48', S: '#f3d2bc', E: '#2a1810', W: '#ffffff', B: '#f2aaa2', N: '#e3b39c', M: '#c0605a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHhHHHHHHHHH',
          'HHHHHSSSHHHHHHHH',
          'HHHSSSSSSSHHHHHH',
          'HHSSSSSSSSSSSHHH',
          'HSSSSSSSSSSSSSSH',
          'HSSEEESSSSEEESSH',
          'HSSEWESSSSEWESSH',
          'HSSSSSSSSSSSSSSH',
          'HSSSSSSNNSSSSSSH',
          'HSBBSSSSSSSSBBSH',
          'HSSSMMMMMMMMSSSH',
          'HSSSSMTTTTMSSSSH',
          'HSSSSSMMMMSSSSSH',
          'HSSSSSSSSSSSSSSH',
        ],
      },
    },
    {
      name: '陳老師', title: '六年三班導師', game: 'units',
      hello: ['🏠 陳老師：我家有 100 坪，回家像爬山！', '🤔 陳老師：試試看，再想一想，是這樣算的嗎…', '📏 陳老師：公分、公尺、公里，單位不一樣，差很多喔！',
        '⚖️ 陳老師：算數學要先看清楚單位，再開始算！', '📐 陳老師：要不要來挑戰「數學單位量詞大考驗」？'],
      // 4 樓思源樓六年三班（603 室）教室前面，面向學生
      places: [
        { floor: '4F', where: '六年三班', game: true, at: () => { const r = rooms.find((x) => x.code === '603'); return D_CLASS_FRONT(r); } },
      ],
      look: {
        // 依照片：黑色短髮（照使用者要求，不戴帽子）、笑得很開心；做成卡通愛探險的 Dora 風格——齊下巴的鮑伯頭＋整齊的直瀏海；
        //   青綠色短袖 T 恤、卡其色長褲
        skin: '#ecc5a4', hair: '#18120f', top: '#47c4b0', pants: '#c8b28a', shoe: '#6b4a33',
        bob: true,
        pal: { H: '#18120f', h: '#2c211b', S: '#ecc5a4', E: '#1e130d', e: '#4a2a1c', W: '#ffffff', B: '#f2a89a', N: '#d9a98a', M: '#a8453f', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHhHHHHHhHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSMTTTTTTMSSHH',
          'HHHSSMMMMMMSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '姚姚老師', title: '教學組長', game: 'geo',
      hello: ['📚 姚姚老師：上課要專心聽，不懂的地方要舉手問老師喔！', '🗺️ 姚姚老師：臺灣雖然不大，卻有高高的山、長長的河，還有好多種地形！',
        '⛰️ 姚姚老師：臺灣最高的山是玉山，你去過嗎？', '🌊 姚姚老師：要不要來挑戰「臺灣地理大考驗」？五大山脈、五大地形、三大河流都考喔！'],
      // 1 樓教務處門口（東牆那扇門外面的走廊）：站在門的南邊、貼著牆，不擋住進出的門，面向走廊
      places: [
        { floor: '1F', where: '教務處門口', game: true, at: () => { const r = rooms.find((x) => x.name === '教務處'); const d = r.doorPts.find((p) => p.side === 'E'); return [d.x + 0.85, d.z + 1.9, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：棕色長直髮（旁分瀏海）、淺淺的微笑；奶油色羅紋 V 領短袖上衣（中間一排金色鈕扣）、米色格紋寬褲
        skin: '#f4d4bf', hair: '#6a4030', top: '#efdcae', pants: '#dccdab', shoe: '#8a8478',
        longHair: true, topButtons: '#c9a24a', skirt: '#d9c9a8', skirtPlaid: ['#e0d2b2', '#c9b690'],
        pal: { H: '#6a4030', h: '#85553c', S: '#f4d4bf', E: '#2a1810', e: '#6b3a26', W: '#ffffff', B: '#f2b2a8', N: '#e3b39c', M: '#c0605a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHSSHHH',
          'HHHHHHHSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMSSSSMSSSHH',
          'HHSSSSMMMMSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '雅雅老師', title: '輔導老師', game: 'mood',
      hello: ['💗 雅雅老師：每天都要保持好心情喔！', '💬 雅雅老師：不開心的事情，都可以來跟我說～', '🫶 雅雅老師：每一種心情都是正常的，說出來會比較輕鬆。',
        '🌈 雅雅老師：要不要來做「情緒覺察」？看看今天的心情是什麼顏色！'],
      // 隨機出現：3 樓輔導室（327）裡面（長桌東邊的空地），或 3 樓諮商室（309）外面的走廊；兩個地方都可以做情緒覺察
      places: [
        { floor: '3F', where: '輔導室', game: true, at: () => { const r = rooms.find((x) => x.name === '輔導室'); return [r.m.x1 + 5.0, r.m.z1 + 5.9, Math.PI / 2]; } },    // 輔導室很擠：這是長桌東邊、中間比較空的地方（四周離家具都有 0.7 公尺以上），從西邊門進來順著走道就走得到
        { floor: '3F', where: '諮商室外走廊', game: true, at: () => { const r = rooms.find((x) => x.name === '諮商室'); return [r.m.x1 + 0.9, r.m.z1 - 0.95, Math.PI]; } },
      ],
      look: {
        // 依照片：咖啡棕色及肩中長髮（有瀏海、旁分）、圓框深色眼鏡、溫柔的微笑；黑色短袖 T 恤（袖子微微蓬）、卡其色長褲
        skin: '#f2d2bc', hair: '#6a4330', top: '#1b1b1e', pants: '#b8996f', shoe: '#e8e2d6',
        bob: true, collar: '#1b1b1e',
        pal: { H: '#6a4330', h: '#7d5240', S: '#f2d2bc', K: '#8a766a', E: '#2a1610', W: '#ffffff', B: '#eeb0a6', N: '#e6b8a2', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEWKSSKEEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '方老師', title: '圖書館管理員', game: 'library',
      // 話很少，每一句都很短
      hello: ['📚 方老師：記得要準時還書唷！', '🆕 方老師：有新的書籍入館囉！', '🤫 方老師：圖書館請小聲～', '📖 方老師：要不要幫我整理圖書館？'],
      // 1 樓圖書館（103）：借還櫃台旁邊的空地
      places: [
        { floor: '1F', where: '圖書館', game: true, at: () => { const r = rooms.find((x) => x.name === '圖書館'); return [r.m.x1 + 3.0, r.cz + 0.3, Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色短髮（瀏海斜斜蓋額頭、露耳朵）、黑色粗框眼鏡、淡淡的微笑、臉乾乾淨淨沒有鬍子；
        //   淺灰藍色圓領短袖 T 恤（左胸一小塊藍色布標）、淺藍色牛仔褲
        skin: '#eac4a4', hair: '#2b221d', top: '#c4d2e0', pants: '#a9c3dc', shoe: '#e8e2d6',
        shortHair: true, minis: ['#4a8fd0'],
        pal: { H: '#2b221d', h: '#3d322b', S: '#eac4a4', K: '#2a2a30', E: '#1e130d', W: '#ffffff', N: '#d9a98a', M: '#a8504a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHHhHHH',
          'HHHHHHHHHHHHHHHH',
          'SHHHHHHHHHHHSSHS',
          'SSSHHSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SKKKKKSSSSKKKKKS',
          'SKSEESKKKKSEESKS',
          'SKKKKKSSSSKKKKKS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSMMMMMSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '吳老師', title: '音樂老師', game: 'notes',
      hello: ['🎵 吳老師：認識自己，接納自己。', '🌱 吳老師：積極學習，喜樂成長！', '🎶 吳老師：音樂可以讓心情變得很好喔～',
        '🎼 吳老師：要不要來玩音符小遊戲？看看你認不認得這些音符！'],
      // 3 樓音樂教室一（303）前面
      places: [
        { floor: '3F', where: '音樂教室一', game: true, at: () => { const r = rooms.find((x) => x.name === '音樂教室一'); return [r.m.x1 + 1.9, r.cz + 0.9, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色及肩直髮（旁分）、細框眼鏡、開心的微笑；黑色 V 領洋裝（袖子短短蓬蓬的、長到腳踝）、黑色鞋子
        skin: '#f0cdb4', hair: '#1c1614', top: '#16161a', pants: '#16161a', shoe: '#16161a',
        longHair: true, skirt: '#16161a', collar: '#16161a',
        pal: { H: '#1c1614', h: '#30262a', S: '#f0cdb4', K: '#7a6e66', E: '#2a1610', W: '#ffffff', B: '#eeb0a6', N: '#e0b49c', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEWKSSKEEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSSTTTTSSSSHH',
          'HHHSSSSMMSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '林老師', title: '專輔老師', game: 'weather',
      hello: ['🌤️ 林老師：生命中的裂痕，都是為了讓光可以照入。', '🌈 林老師：下雨的日子，後面也會有彩虹喔。', '💬 林老師：不管今天是晴天還是雨天，都可以來跟我說說。',
        '☁️ 林老師：要不要來玩「心情晴雨天」？看看今天心裡的天氣是什麼！'],
      // 3 樓輔導室（327）外面的走廊（門在西邊，走廊在輔導室西側）
      places: [
        { floor: '3F', where: '輔導室外走廊', game: true, at: () => { const r = rooms.find((x) => x.name === '輔導室'); return [r.m.x1 - 1.0, r.cz - 1.6, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：深棕黑色超長捲髮（披過胸前）、淺淺的微笑；黑色無袖上衣、細項鍊
        skin: '#f3d8c6', hair: '#2e2019', top: '#17171a', pants: '#2b2b30', shoe: '#e8e2d6',
        longHair: true, sleeveless: true, necklace: '#c9c9d2',
        pal: { H: '#2e2019', h: '#43302a', S: '#f3d8c6', E: '#2a1610', e: '#6a4430', W: '#ffffff', B: '#f2b6a8', N: '#e4b8a2', M: '#c0645a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSEeeSSSSEeeSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSSSNNSSSSSHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSSMTTMSSSSHH',
          'HHHSSSSMMSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '林老師', title: '五年三班導師', game: 'factor',
      hello: ['🌟 林老師：你今天也很努力，老師都有看到喔！', '💪 林老師：錯了沒關係，再試一次就會更進步！', '😊 林老師：相信自己，你一定做得到！',
        '🔢 林老師：要不要來挑戰因數與倍數？'],
      // 4 樓勤學樓五年三班（415 室）：跟五年二班同一排、黑板在西邊，老師站講台旁、面向東邊的學生
      places: [
        { floor: '4F', where: '五年三班', game: true, at: () => { const r = rooms.find((x) => x.code === '503'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片（操場跑道拍的）：黑色長髮過肩、齊瀏海、淺淺的微笑；粉紫框眼鏡（淺灰色鏡片）；
        //   粉紫色和米白色寬橫條紋長袖針織毛衣（粉紫色小立領）、深藍色牛仔褲（鞋子照片沒拍到；左手的白色智慧手錶太小沒做）
        skin: '#f0cdb4', hair: '#231a16', top: '#f3ece8', pants: '#2f3f63', shoe: '#e6e6e6',
        longHair: true, longSleeve: true, topStripes: '#b4648f', stripeH: 0.07, collar: '#b4648f',
        pal: { H: '#231a16', h: '#3a2a22', S: '#f0cdb4', K: '#b87a9a', E: '#2a1610', W: '#d9d6d6', B: '#eeb0a6', N: '#e2b49c', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHSHHHHHHHHHHSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEWKSSKEEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '黃老師', title: '四年二班導師', game: 'decimal',
      hello: ['😊 黃老師：快樂開心每一天！', '🌞 黃老師：早安！今天也要笑咪咪的喔～', '🔢 黃老師：0.5 和 0.45 哪個比較大？想一想再回答！',
        '📐 黃老師：要不要來玩小數點的遊戲？'],
      // 3 樓思源樓四年二班（315 室）：思源樓教室黑板在南，老師站講台旁、面向學生
      places: [
        { floor: '3F', where: '四年二班', game: true, at: () => { const r = rooms.find((x) => x.code === '402'); return D_CLASS_FRONT(r); } },
      ],
      look: {
        // 依照片：咖啡棕色齊下巴鮑伯頭（厚厚的齊瀏海）、溫柔的微笑；黑色鏤空針織短袖上衣
        skin: '#efc9ae', hair: '#6e4128', top: '#1a1a1d', pants: '#2b2b30', shoe: '#3a3030',
        bob: true, collar: '#1a1a1d',
        pal: { H: '#6e4128', h: '#8a5636', S: '#efc9ae', E: '#2a1610', e: '#6a4430', W: '#ffffff', B: '#eeb0a6', N: '#e0b49c', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHhHHHHHHHHhHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '楊老師', title: '潛能老師', game: 'shapes',
      hello: ['🌱 楊老師：每一顆小種子，都有長成大樹的力量！', '😄 楊老師：慢慢來沒關係，我們一步一步來～', '👏 楊老師：你今天好棒，給自己拍拍手！',
        '🔷 楊老師：要不要來玩「形狀顏色對對碰」？'],
      // 3 樓潛能教室四（306）
      places: [
        { floor: '3F', where: '潛能教室四', game: true, at: () => { const r = rooms.find((x) => x.name === '潛能教室四'); return [r.cx + 0.25, r.cz - 2.3, 0]; } },    // 一進門右手邊的空地（中間長桌、兩側櫃子都不擋），面向門口
      ],
      look: {
        // 依照片：深棕色微捲短鮑伯頭（短短的齊瀏海）、開心大笑露出牙齒；黑色皮外套（翻領、拉鍊）、裡面白色高領上衣
        skin: '#e8c0a0', hair: '#3a2418', top: '#1c1a1a', pants: '#2f3a4a', shoe: '#2a2a2a',
        bob: true, longSleeve: true, collar: '#f2f0ea', zip: '#8a8a8a',
        pal: { H: '#3a2418', h: '#5a3424', S: '#e8c0a0', E: '#1e130d', e: '#5a3424', W: '#ffffff', B: '#eaa898', N: '#d9a98a', M: '#b04848', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHhHHHHHHHhHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHSHHSHHHSHHSHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSMTTTTTTMSSHH',
          'HHHSSMMMMMMSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '李老師', title: '實習老師', game: 'shootout',
      hello: ['💪 李老師：每一次練習，都是在為更好的自己熱身！', '🏀 李老師：下課要不要一起去操場比投籃？', '😊 李老師：我是實習老師，請多多指教！',
        '🏃 李老師：跑跳之前，記得先暖身喔！'],
      // 2 樓勤學樓一年一班（220 室）：實習老師站在教室後面看大家上課；按 F 一起瞬間移動到操場籃球場比投籃（跟鄧老師一樣），玩完再回教室
      shootAt: () => { const T = D.outdoor.track; return [mx(T.center[0]) - 3, mz(T.center[1]) - 5.3, Math.PI]; },
      places: [
        { floor: '2F', where: '一年一班', game: true, at: () => { const r = rooms.find((x) => x.code === '101'); return [r.m.x2 - 1.0, r.cz, Math.PI / 2]; } },    // 教室後面（對齊中間那排課桌，不擋桌子間的走道），面向黑板
      ],
      look: {
        // 依照片：黑色短髮（兩側推短、上面有層次）、表情淡定；深橄欖棕色羅紋短袖 Henley 衫（領口幾顆扣子）、
        //   米白色寬褲、黑色編織皮帶、銀色項鍊、咖啡色斜背包
        skin: '#e8bf9c', hair: '#141212', top: '#5a5245', pants: '#f1ede2', shoe: '#e8e2d6',
        shortHair: true, topButtons: '#e8e2d6', belt: '#1a1a1a', necklace: '#d9d9df', bag: '#6b4a32',
        pal: { H: '#141212', h: '#2a2424', S: '#e8bf9c', E: '#1e130d', e: '#4a2e20', W: '#ffffff', N: '#d6a888', M: '#b86a5e' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHhHHHH',
          'HHHHHHHHHHHHHHHH',
          'SHHHHHHHHHHHHHHS',
          'SSSHHSSSSHSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSEEESSSSSSEEESS',
          'SSEWeSSSSSSEWeSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '顏老師', title: '一年二班導師', game: 'tones',
      hello: ['💗 顏老師：以愛築基，用耐心陪伴你們成長！', '✨ 顏老師：點亮童心，跟孩子一同前進～', '😊 顏老師：慢慢來沒關係，老師陪你一起練習！',
        '🔤 顏老師：一聲平平、二聲往上、三聲彎彎、四聲往下，要不要來玩注音聲調大挑戰？'],
      // 2 樓勤學樓一年二班（221 室）：跟一年一班一樣，老師站講台旁、面向學生
      places: [
        { floor: '2F', where: '一年二班', game: true, at: () => { const r = rooms.find((x) => x.code === '102'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：深棕色頭髮往後綁成低馬尾（額頭露出來、旁分）、開心的笑容；深藍色短袖 T 恤、深藍色寬褲、白色條紋襪、灰色球鞋
        skin: '#efc6aa', hair: '#4a2c20', top: '#1b2440', pants: '#1b2440', shoe: '#c8c8cc',
        bun: true, collar: '#1b2440',
        pal: { H: '#4a2c20', h: '#5e3a2a', S: '#efc6aa', E: '#2a1610', e: '#5a3424', W: '#ffffff', B: '#eeb0a6', N: '#dfb094', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '黃老師', title: '三年一班導師', game: 'add4',
      hello: ['🎯 黃老師：做事要專心、細心、還要有耐心喔！', '😊 黃老師：算數學不用急，一位一位慢慢來～', '✏️ 黃老師：算完記得驗算，細心就不會粗心！',
        '➕ 黃老師：要不要來挑戰四位數的加減法？'],
      // 3 樓勤學樓三年一班（321 室）：跟一年二班一樣的教室，老師站講台旁、面向學生
      places: [
        { floor: '3F', where: '三年一班', game: true, at: () => { const r = rooms.find((x) => x.code === '301'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色及肩直髮（旁分、沒有瀏海）、黑色細框圓眼鏡、開心露齒的笑容；白色短袖 T 恤（袖口反摺）、米白色寬褲（鞋子照片沒拍到）
        skin: '#f1cdb6', hair: '#231a16', top: '#f7f7f4', pants: '#ece5d6', shoe: '#e6e6e6',
        lob: true,
        pal: { H: '#231a16', h: '#33261f', S: '#f1cdb6', K: '#34343a', E: '#2a1610', W: '#ffffff', B: '#f0aca4', N: '#e2b29a', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHhHHHHHH',
          'HHHHHHHHHSHHHHHH',
          'HHHHHHHSSSSHHHHH',
          'HHHHSSSSSSSSSHHH',
          'HHHSSSSSSSSSSSHH',
          'HHSKKKSSSSKKKSHH',
          'HHKSSSKKKKSSSKHH',
          'HHKSESKSSKSESKHH',
          'HHSKKKSSSSKKKSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMWWWWWWMSSHH',
          'HHSSSMMMMMMSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '駱老師', title: '五年五班導師', game: 'rhetoric',
      hello: ['📖 駱老師：今天的國語課文，你讀熟了嗎？', '✏️ 駱老師：寫作文時加一點修辭，句子就會變得好生動喔！',
        '😊 駱老師：五年五班的大家，下課記得多喝水！', '🔍 駱老師：要不要來當修辭小偵探？'],
      // 4 樓至善樓五年五班（419 室）：教室前後對調、黑板在南，老師站講台、面向北邊的學生（跟五年四班一樣）
      places: [
        { floor: '4F', where: '五年五班', game: true, at: () => { const r = rooms.find((x) => x.code === '505'); return [r.cx + 0.6, r.m.z2 - 1.6, 0]; } },
      ],
      look: {
        // 依照片：黑色及肩髮、側分瀏海、開心露齒的笑容；白色寬鬆長袖襯衫、細金項鍊、牛仔褲（鞋子照片沒拍到）
        skin: '#f3d6c4', hair: '#241914', top: '#f6f4ef', pants: '#4d6d98', shoe: '#e6e6e6',
        lob: true, longSleeve: true, necklace: '#d2ad62',
        pal: { H: '#241914', h: '#3a2a22', S: '#f3d6c4', E: '#2a1610', e: '#5a3424', W: '#ffffff', B: '#f0b2a6', N: '#e4b8a0', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHhSHHH',
          'HHHHHHHHHhSSSSHH',
          'HHSSHHHHhSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMWWWWWWMSSHH',
          'HHSSSMMMMMMSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '李老師', title: '五年二班導師', game: 'perim',
      hello: ['🌱 李老師：我也是新老師，我們一起學習、一起進步！', '😊 李老師：有不懂的地方儘管問，問問題一點都不丟臉！', '📏 李老師：周長是繞一圈的長度，面積是裡面有多大，別搞混囉～',
        '📐 李老師：要不要來挑戰周長和面積？'],
      // 4 樓勤學樓五年二班（414 室）：黑板在西邊，老師站講台旁、面向東邊的學生
      //   兩套造型隨機出現（使用者 11-10）：米白色針織毛衣、黑色短袖 T 恤＋牛仔長裙（照片裡抱著狗，但使用者說不要抱狗）
      places: [
        { floor: '4F', where: '五年二班', game: true, at: () => { const r = rooms.find((x) => x.code === '502'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
        { floor: '4F', where: '五年二班', game: true, outfit: 'denim', at: () => { const r = rooms.find((x) => x.code === '502'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      outfits: {
        denim: { top: '#1c1c20', longSleeve: false, skirt: '#4f74a6', pants: '#4f74a6', shoe: '#f2f2ee' },
      },
      look: {
        // 依照片：深咖啡色長直髮（中分、兩側順著臉）、淺淺的微笑；米白色針織毛衣（褲子、鞋子照片沒拍到）
        skin: '#f3d3bd', hair: '#4a2f20', top: '#efe8da', pants: '#5a6478', shoe: '#e6e6e6',
        longHair: true, longSleeve: true,
        pal: { H: '#4a2f20', h: '#5e3d2b', S: '#f3d3bd', E: '#2a1610', e: '#5a3424', W: '#ffffff', B: '#efb4a8', N: '#e4b8a0', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHSHHHHHHHH',
          'HHHHHHSSSHHHHHHH',
          'HHHHHSSSSSHHHHHH',
          'HHHSSSSSSSSSSHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '方老師', title: '資料組長', game: 'weave',
      hello: ['🌟 方老師：每一件作品都是獨一無二的，你的也是！', '💪 方老師：做錯沒關係，重來一次又多學會一招！', '👏 方老師：你今天又比昨天進步一點點了，真棒！',
        '🧵 方老師：要不要來編一個紙杯墊？'],
      // 隨機出現：3 樓輔導室外走廊（南邊那扇門再過去一點，面向走廊北邊），或 3 樓美勞教室（東邊展示架前、面向長桌）
      places: [
        { floor: '3F', where: '輔導室外走廊', game: true, at: () => { const r = rooms.find((x) => x.name === '輔導室'); return [r.m.x1 - 1.0, r.cz + 4.2, 0]; } },
        { floor: '3F', where: '美勞教室', game: true, at: () => { const r = rooms.find((x) => x.name === '美勞教室'); return [r.cx + 3.2, r.cz, Math.PI / 2]; } },
      ],
      look: {
        // 依照片：紅棕色過肩頭髮（旁分、側邊瀏海）、細的淺金色框眼鏡、淺淺的微笑；白色短上衣、敞開的深灰色薄外套、淺藍牛仔褲、米白色斜背包（鞋子照片沒拍到）
        skin: '#f0cdb4', hair: '#6b3a24', top: '#f4f2ec', pants: '#a9c4da', shoe: '#e6e6e6',
        longHair: true, longSleeve: true, openShirt: '#4a4c52', sleeve: '#4a4c52', bag: '#d9d8cf',
        pal: { H: '#6b3a24', h: '#814a30', S: '#f0cdb4', K: '#b09a70', E: '#2a1610', W: '#ffffff', B: '#efb4a8', N: '#e0b49c', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHHHHHH',
          'HHHHHSHHHHHHHHHH',
          'HHHHSSSSHHHHHHHH',
          'HHHSSSSSSSHHHHHH',
          'HHSSSSSSSSSSSHHH',
          'HHSKKKSSSSKKKSHH',
          'HHKSSSKKKKSSSKHH',
          'HHKSESKSSKSESKHH',
          'HHSKKKSSSSKKKSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '吳老師', title: '實習老師', game: 'gomoku',
      hello: ['🙋 吳老師：我是來實習的吳老師，請大家多多指教！', '⚫ 吳老師：我的專長是圍棋，今天先來下簡單的五子棋吧！', '⚪ 吳老師：一邊連線，也要一邊擋對手喔！',
        '🤔 吳老師：要不要來下一盤五子棋？'],
      // 4 樓勤學樓六年五班（412 室）：導師丁老師在前面講台，實習老師站教室後面、面向黑板（跟一年一班的李老師一樣）
      places: [
        { floor: '4F', where: '六年五班', game: true, at: () => { const r = rooms.find((x) => x.code === '605'); return [r.m.x2 - 1.0, r.cz, Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色短髮、細框眼鏡；白色短袖 T 恤、藍色識別證掛繩、黑色寬版工作褲、灰白色球鞋
        skin: '#edc8aa', hair: '#17130f', top: '#f4f4f0', pants: '#1c1c20', shoe: '#c8c8cc',
        shortHair: true, lanyard: '#27408b',
        pal: { H: '#17130f', h: '#2a241e', S: '#edc8aa', K: '#34343a', E: '#1e130d', W: '#ffffff', N: '#d9ab8c', M: '#a8504a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHhHHHHHHHHhHHHH',
          'SSSSSSSSSSSSSSSS',
          'SSSKKKSSSSKKKSSS',
          'SSKSSSKKKKSSSKSS',
          'SSKSESKSSKSESKSS',
          'SSSKKKSSSSKKKSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '陳主任', title: '輔導主任', game: 'cut',
      hello: ['👍 陳主任：你很棒唷，繼續努力！', '💪 陳主任：加加油，你一定可以的！', '🌟 陳主任：慢慢來，你已經做得很好了！',
        '✂️ 陳主任：要不要來剪紙？猜猜打開以後是什麼樣子！'],
      // 3 樓輔導室（327）裡面：南邊那扇門進來的空地，面向辦公室
      places: [
        { floor: '3F', where: '輔導室', game: true, at: () => { const r = rooms.find((x) => x.name === '輔導室'); return [r.m.x1 + 1.0, r.cz + 1.75, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：棕色帶紅的及肩短髮（旁分）、深色細框眼鏡、開心的笑容；寬鬆的白色短袖 T 恤（褲子、鞋子照片沒拍到）
        skin: '#efc9ae', hair: '#74452c', top: '#f6f6f2', pants: '#3a4252', shoe: '#e6e6e6',
        lob: true,
        pal: { H: '#74452c', h: '#8a5636', S: '#efc9ae', K: '#34343a', E: '#2a1610', W: '#ffffff', B: '#eeb0a6', N: '#dfb094', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHhHHHHHHHHH',
          'HHHHHHSHHHHHHHHH',
          'HHHHHSSSSHHHHHHH',
          'HHHHSSSSSSSSHHHH',
          'HHHSSSSSSSSSSSHH',
          'HHSKKKSSSSKKKSHH',
          'HHKSSSKKKKSSSKHH',
          'HHKSESKSSKSESKHH',
          'HHSKKKSSSSKKKSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMWWWWWWMSSHH',
          'HHSSSMMMMMMSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '吳老師', title: '特教組長', game: 'nature',
      // 暫定台詞（使用者說她很有耐心和愛心），等使用者確認
      hello: ['🌱 吳老師：慢慢來，老師等你。', '💛 吳老師：不會沒關係，我們一起想一想。', '🤗 吳老師：每個人都有自己的步調，你已經很棒了。',
        '🔬 吳老師：要不要來玩「自然小觀察」？答錯也沒關係喔！'],
      // 3 樓輔導室（327）裡面：北邊那扇門進來，收納櫃和辦公桌之間的走道東段，面向門口
      places: [
        { floor: '3F', where: '輔導室', game: true, at: () => { const r = rooms.find((x) => x.name === '輔導室'); return [r.m.x1 + 4.2, r.m.z1 + 1.8, Math.PI / 2]; } },
      ],
      look: {
        // 依照片：深棕色長髮、旁分斜瀏海、髮尾偏紅棕；深藍白粗橫條紋長袖 V 領毛衣、裡面深色上衣（褲子、鞋子照片沒拍到）
        skin: '#efc8ab', hair: '#2a1a14', top: '#f1efe8', pants: '#2f3542', shoe: '#3a3a40',
        longHair: true, longSleeve: true, topStripes: '#2f5273', stripeH: 0.07, collar: '#2a2428',
        pal: { H: '#2a1a14', h: '#4a2a1c', S: '#efc8ab', K: '#3a2418', E: '#20130d', W: '#ffffff', B: '#eeb4a6', N: '#dfb094', M: '#b8505a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHhHHHHHH',
          'HHHHHHHHHHHSHHHH',
          'HHHHHHHHHHSSSHHH',
          'HHHHHHHHSSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHHSSSSSSSSSSHH',
          'HHHKKKSSSSKKKSHH',
          'HHSWESSSSSWESSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBSSSSSSSSSSBHH',
          'HHSSSSMMMMSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: 'Jack 老師', title: '英文老師', game: 'prep',
      hello: ['🤫 Jack 老師：來，安靜囉～', '👀 Jack 老師：Eyes on me! 眼睛看老師這邊～', '👂 Jack 老師：Listen carefully! 仔細聽喔！',
        '✋ Jack 老師：Raise your hand! 想回答的請舉手！', '📍 Jack 老師：in、on、at 你分得清楚嗎？要不要來挑戰？'],
      // 3 樓英語教室二（310）前面講台旁（Joanne 老師站北邊），面向學生
      places: [
        { floor: '3F', where: '英語教室二', game: true, at: () => { const r = rooms.find((x) => x.name === '英語教室二'); return [r.m.x1 + 1.3, r.cz + 1.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色短髮（瀏海蓋額頭）、細金屬圓框眼鏡、微笑；米白色短袖 T 恤（胸前一排小圖案）外面敞開穿灰色長袖襯衫
        skin: '#f1cfb8', hair: '#1a1616', top: '#f1e8d6', pants: '#3a3d44', shoe: '#2a2a2a',
        shortHair: true, longSleeve: true, sleeve: '#8b8f93', openShirt: '#8b8f93', minis: ['#4a8fd0', '#222222', '#e0602e'],
        pal: { H: '#1a1616', h: '#2c2626', S: '#f1cfb8', K: '#b8a890', E: '#1e130d', W: '#ffffff', N: '#ddb096', M: '#a8504a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHHhHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'SHHHSHHHHSHHHHHS',
          'SSSSSSSSSSSSSSSS',
          'SKKKKKSSSSKKKKKS',
          'SKSEESKKKKSEESKS',
          'SKKKKKSSSSKKKKKS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSMSSSSSSMSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '林老師', title: '三年五班導師', game: 'pingpong',
      hello: ['🤫 林老師：請保持安靜～', '🤣 林老師：我昨天又夢到我在上數學課了🤣', '⛰️ 林老師：爬山很快樂喔！一起來爬山',
        '🏓 林老師：要不要一起去地下室打桌球？'],
      // 2 樓三年五班（226 室）教室前面（至善樓教室前後對調，黑板在南），面向學生
      places: [
        { floor: '2F', where: '三年五班', game: true, at: () => { const r = rooms.find((x) => x.code === '305'); return [r.cx - 0.6, r.m.z2 - 1.6, 0]; } },
      ],
      look: {
        // 依照片：深棕色長捲髮（旁分瀏海）、大大的笑容；白色洋裝
        skin: '#f6d8c6', hair: '#3a2218', top: '#f7f4ee', pants: '#f6d8c6', shoe: '#efe8dc',
        longHair: true, skirt: '#f7f4ee',
        pal: { H: '#3a2218', h: '#5a3424', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#c0605a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHSSHHHHHHHH',
          'HHHHSSSSSHHHHHHH',
          'HHHSSSSSSSSSSHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '丁丁老師', title: '自然老師', game: 'float',
      hello: ['🧪 丁丁老師：我們來做實驗吧！', '🤫 丁丁老師：請保持安靜，不要講話。', '🔬 丁丁老師：同學們跟我一起做！', '🛟 丁丁老師：要不要來做沉浮實驗？'],
      // 2 樓自然教室一（204）前面：站在白板和大實驗桌中間，隔著實驗桌面向學生（西）
      places: [
        { floor: '2F', where: '自然教室一', game: true, at: () => { const r = rooms.find((x) => x.name === '自然教室一'); return [r.m.x2 - 0.75, r.cz + 0.3, Math.PI / 2]; } },   // 教室前後鏡射：白板在東，面向西
      ],
      look: {
        // 依照片：黑色平頭短髮、圓臉、淡淡微笑；灰藍色 Polo 衫（裡面黑色內衣）、黑色長褲
        skin: '#e8bf9c', hair: '#1c1816', top: '#7f8fb8', pants: '#1f1f22', shoe: '#2a2a2a',
        shortHair: true, collar: '#7f8fb8', buttons: '#eef0f4',
        pal: { H: '#1c1816', h: '#2e2622', S: '#e8bf9c', B: '#2a2018', E: '#1e130d', N: '#d4a684', M: '#9c4a3e' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHhHHHHhHHHHhHHH',
          'HHHHHHHHHHHHHHHH',
          'SHSSSSSSSSSSSSHS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSBBBSSSSSSBBBSS',
          'SSSSSSSSSSSSSSSS',
          'SSSEESSSSSSEESSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSMSSSSMSSSSS',
          'SSSSSSMMMMSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '竹竹老師', title: '自然老師', game: 'heat',
      hello: ['📖 竹竹老師：上課要專心唷！', '🔍 竹竹老師：從細節觀察不同的地方！', '🌡️ 竹竹老師：要不要來玩熱脹冷縮？'],
      // 2 樓自然教室二（205）前面：跟自然教室一一樣的配置（白板在東），站在白板和大實驗桌中間，面向學生（西）
      places: [
        { floor: '2F', where: '自然教室二', game: true, at: () => { const r = rooms.find((x) => x.name === '自然教室二'); return [r.m.x2 - 0.75, r.cz + 0.3, Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色長直髮（中分）、細框圓眼鏡、燦爛笑容；米黃色短袖 T 恤、淺灰色運動長褲、白色手錶
        skin: '#f2cfb4', hair: '#1c1614', top: '#f1e9c8', pants: '#b9bcc2', shoe: '#e8e8e8',
        longHair: true,
        pal: { H: '#1c1614', h: '#2e2420', S: '#f2cfb4', K: '#b8b0a8', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f0b0a8', N: '#e2b296', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHhHHHHHHHH',
          'HHHHHHHSHHHHHHHH',
          'HHHHHHSSSHHHHHHH',
          'HHHHHSSSSSHHHHHH',
          'HHHSSSSSSSSSSHHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEKKKKKKEEKHH',
          'HHKEWKSSSSKEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '杜老師', title: '三年四班導師', game: 'ooxx',
      hello: ['📖 杜老師：小朋友要專心上課唷！', '✏️ 杜老師：大家跟我一起念：專心寫、小心檢查！', '⭕ 杜老師：要不要跟老師玩 OOXX？'],
      // 3 樓三年四班（326 室）教室前面（至善樓教室前後對調，黑板在南），面向學生
      places: [
        { floor: '3F', where: '三年四班', game: true, at: () => { const r = rooms.find((x) => x.code === '304'); return [r.cx - 0.6, r.m.z2 - 1.6, 0]; } },
      ],
      look: {
        // 依照片：黑色長直髮（旁分、沒有瀏海）、燦爛笑容露牙；白色短袖 T 恤（黑色線條花朵圖案）、抱著紅玫瑰粉色花束
        skin: '#f6d8c6', hair: '#1a1514', top: '#f2f1ee', pants: '#4a4d55', shoe: '#3a3a3a',
        longHair: true, print: '#3a3a3a', holdL: 'bouquet',
        pal: { H: '#1a1514', h: '#2e2422', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#c0505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHHHHHH',
          'HHHHHSSSSSHHHHHH',
          'HHHHSSSSSSSSHHHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '陳老師', title: '生教組長', game: 'traffic',
      hello: ['🚶 陳老師：走廊上不要奔跑喔！', '🪜 陳老師：上下樓梯要靠右走，注意安全！', '🚦 陳老師：過馬路要看紅綠燈、走斑馬線！', '🚦 陳老師：要不要來挑戰「交通安全大考驗」？'],
      // 1 樓學務處：中間那條東西向走道，站在自己座位旁邊，面向東邊的走道
      places: [
        { floor: '1F', where: '學務處', game: true, at: () => { const r = rooms.find((x) => x.name === '學務處'); return [r.m.x1 + 4.6, r.m.z1 + 3.6, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色短髮、開口大笑；淺水藍色短袖 Polo 衫、深藍色識別證掛繩、卡其色長褲、深色鞋子
        skin: '#e9c3a4', hair: '#151313', top: '#8ad6dc', pants: '#c9b48c', shoe: '#3a302c',
        shortHair: true, collar: '#8ad6dc', lanyard: '#1e2f6a',
        pal: { H: '#151313', h: '#2a2422', S: '#e9c3a4', B: '#1e1612', E: '#1e130d', N: '#d4a684', M: '#8a3a34', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHhHHHHHhHHHHH',
          'HHHHHHHHHHHHHHHH',
          'SHSSSSSSSSSSSSHS',
          'SSSSSSSSSSSSSSSS',
          'SSBBBSSSSSSBBBSS',
          'SSSSSSSSSSSSSSSS',
          'SSSEESSSSSSEESSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSMMMMMMMMSSSS',
          'SSSSMTTTTTTMSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '林老師', title: '衛生組長', game: 'farm',
      hello: ['🍱 林老師：營養午餐有青菜、有魚肉，均衡飲食身體好！', '🧹 林老師：保持環境整潔，垃圾要做好分類喔！', '🦷 林老師：吃完午餐記得刷牙！', '🌱 林老師：要不要跟我去 2 樓小田園種菜？'],
      // 1 樓學務處：東邊那條南北向走道（自己座位旁邊），面向北邊
      places: [
        { floor: '1F', where: '學務處', game: true, at: () => { const r = rooms.find((x) => x.name === '學務處'); return [r.m.x2 - 1.6, r.m.z1 + 5.6, 0]; } },
      ],
      look: {
        // 依照片：深咖啡色及肩短髮（旁分）、細金屬框眼鏡、溫和微笑；淺粉膚色短袖襯衫（翻領）外面套灰褐色針織 V 領背心（米白滾邊）、
        //   黑色細斜背帶、深咖啡色寬褲裙、灰色運動鞋
        skin: '#f4d4bf', hair: '#2e211d', top: '#ead2bf', pants: '#2a2224', shoe: '#8e9298',
        bob: true, collar: '#ead2bf', vest: ['#8b7e73', '#f3ebdf'], skirt: '#3d2224', bag: '#2a2a2a',
        pal: { H: '#2e211d', h: '#3e2c26', S: '#f4d4bf', K: '#a89888', E: '#2a1610', W: '#ffffff', B: '#eeb0a6', N: '#e6b8a2', M: '#b8505a' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHSSSHH',
          'HHHHHHHSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKKSSKKKKKHH',
          'HHKEEWKKKKEEWKHH',
          'HHKKKKKSSKKKKKHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSMMMMMMSSSHH',
          'HHHSSSSSSSSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '高老師', title: '訓育組長', game: 'history',
      hello: ['📚 高老師：要認真學習唷！', '⚠️ 高老師：出去玩要注意安全！', '🗺️ 高老師：要不要來挑戰「臺灣史地大考驗」？'],
      // 1 樓學務處：西邊那扇北門進來，站在門和白板中間（辦公座位西邊），面向門口（北）
      places: [
        { floor: '1F', where: '學務處', game: true, at: () => { const r = rooms.find((x) => x.name === '學務處'); return [r.m.x1 + 1.2, r.m.z1 + 2.8, 0]; } },
      ],
      look: {
        // 依照片：黑色齊下巴短鮑伯頭（旁分瀏海）、黑框方眼鏡、開心笑容；淡藍紫色 V 領襯衫（長袖捲起）、黑色短裙，手上拿一本雜誌
        skin: '#f6d8c6', hair: '#1c1616', top: '#8fa3d8', pants: '#f2d0bc', shoe: '#2a2a2a',
        bob: true, longSleeve: true, collar: '#8fa3d8', shortSkirt: '#1d1d20', holdL: 'magazine',
        pal: { H: '#1c1616', h: '#33282a', S: '#f6d8c6', K: '#1a1a1a', E: '#2a1610', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#c0505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHSSSHH',
          'HHHHHHHHSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKKSSKKKKKHH',
          'HHKEEWKKKKEEWKHH',
          'HHKKKKKSSKKKKKHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHSSSSMMMMSSSSHH',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '黃老師', title: '六年一班導師', game: 'fraction',
      hello: ['☝️ 黃老師：做事情要專心，一次做好一件事！', '🍣 黃老師：分數就像切壽司，切得越多塊，每一塊就越小喔！', '💪 黃老師：六年一班，加油！',
        '🧮 黃老師：老師在黑板上算了幾題分數，要不要來幫我檢查？'],
      // 4 樓思源樓六年一班（406 室）教室前面，面向學生
      places: [
        { floor: '4F', where: '六年一班', game: true, at: () => { const r = rooms.find((x) => x.code === '601'); return D_CLASS_FRONT(r); } },
      ],
      look: {
        // 依照片：黑色短髮、橘色頭巾綁額頭、紅色變形蟲領巾；黃色短袖 T 恤套紫色長袖、胸前不織布壽司拼貼，比「一」的手勢
        skin: '#eac2a0', hair: '#1c1816', top: '#f6b81e', pants: '#2a2a30', shoe: '#2a2a2a',
        shortHair: true, longSleeve: true, sleeve: '#5b4f9e', headband: '#f39a6b', neckerchief: '#d8262e', sushi: true,
        pal: { H: '#1c1816', h: '#2e2622', S: '#eac2a0', B: '#2a2018', E: '#1e130d', N: '#d4a684', M: '#9c4a3e' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HSSSSSSSSSSSSSSH',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSBBBSSSSSSBBBSS',
          'SSSSSSSSSSSSSSSS',
          'SSSEESSSSSSEESSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSMMMMMMSSSSS',
          'SSSSSSMMMMSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '蔡老師', title: '六年二班導師', game: 'blackjack',
      hello: ['✌️ 蔡老師：今天也要開開心心的喔！', '📝 蔡老師：作業寫完要記得檢查，再交給老師！', '🧸 蔡老師：同學之間要互相幫忙！',
        '🃏 蔡老師：要不要跟老師玩一局撲克牌 21 點？順便練習加法！'],
      // 4 樓思源樓六年二班（407 室）教室前面，面向學生
      places: [
        { floor: '4F', where: '六年二班', game: true, at: () => { const r = rooms.find((x) => x.code === '602'); return D_CLASS_FRONT(r); } },
      ],
      look: {
        // 依照片：黑色長直髮、齊瀏海、紅色變形蟲頭巾、燦爛笑容；白色高領長袖外面套深灰色短袖 T 恤（咖啡色小熊圖案）、黑色長褲
        skin: '#f6d8c6', hair: '#1a1515', top: '#64676c', pants: '#1d1d20', shoe: '#2a2a2a',
        longHair: true, longSleeve: true, sleeve: '#f4f4f2', collar: '#f4f4f2', headband: '#d8262e', bear: true,
        pal: { H: '#1a1515', h: '#2e2424', S: '#f6d8c6', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f2b2b0', N: '#e6b8a2', M: '#c0505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHhHHHHhHHHhHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '戴老師', title: '六年四班導師', game: 'pingpong', ppBack: '流完汗記得喝水，休息一下再上課！',
      hello: ['📸 戴老師：笑一個！老師幫你拍張照～', '🏃 戴老師：下課多出去走走，運動流汗身體好！', '🙌 戴老師：六年四班，一起加油！',
        '🏓 戴老師：要不要一起去地下室打桌球？', '🎭 戴老師：偶爾換個造型，換個心情！'],
      // 4 樓勤學樓六年四班（411 室）：跟五年一班一樣黑板在西邊，老師站講台旁、面向東邊的學生
      //   兩套造型輪流出現（使用者 10-30：今天穿得特別帥，新版和舊版都留著）：平常的相機老師、鬼滅風的「半紅半花紋和服外褂」角色扮演
      places: [
        { floor: '4F', where: '六年四班', game: true, at: () => { const r = rooms.find((x) => x.code === '604'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
        { floor: '4F', where: '六年四班', game: true, outfit: 'cosplay', at: () => { const r = rooms.find((x) => x.code === '604'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      // 角色扮演造型（依照片）：黑色立領制服（金色扣子、白色腰帶）、黑色燈籠褲、黑色工作靴；外面披半紅半綠橘花紋的和服外褂
      outfits: {
        cosplay: { neckerchief: null, camera: false, top: '#17171b', collar: '#17171b', topButtons: '#d9b020', belt: '#f4f4f2', pants: '#17171b', shoe: '#1d1d20', haori: ['#c8102e', '#3f9a3a', '#f2a21c', '#1f5f6a', '#e8603a'], sleeve: '#17171b' },
      },
      look: {
        // 依照片：黑色短髮（往上抓）、燦爛笑容；藍綠色短袖 T 恤、紅色變形蟲領巾、脖子掛著黑色相機（米灰色背帶）
        skin: '#eec7a6', hair: '#1a1614', top: '#1f9a96', pants: '#2a2a30', shoe: '#2a2a2a',
        shortHair: true, neckerchief: '#d8262e', camera: true,
        pal: { H: '#1a1614', h: '#2e2622', S: '#eec7a6', B: '#1a1614', E: '#1e130d', N: '#d8ac8a', M: '#9c3b34', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHhHHHHHHhHHHH',
          'HHHHHHHHHHHHHHHH',
          'HSSHHHHHHHHHSSSH',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSBBBSSSSSSBBBSS',
          'SSSSSSSSSSSSSSSS',
          'SSSEESSSSSSEESSS',
          'SSSSSSSSSSSSSSSS',
          'SSSSSSSNNSSSSSSS',
          'SSSSSSSSSSSSSSSS',
          'SSSMMMMMMMMMMSSS',
          'SSSMTTTTTTTTMSSS',
          'SSSSMMMMMMMMSSSS',
          'SSSSSSSSSSSSSSSS',
        ],
      },
    },
    {
      name: '丁老師', title: '六年五班導師', game: 'colors',
      hello: ['🖐️ 丁老師：嗨！給老師一個擊掌！', '🌈 丁老師：每個人都有自己的顏色，都很棒喔！', '📖 丁老師：上課前，先把課本準備好！',
        '🎨 丁老師：要不要來玩「顏色對對碰」？猜猜看兩種顏色混在一起會變成什麼！'],
      // 4 樓勤學樓六年五班（412 室）：黑板在西邊，老師站講台旁、面向東邊的學生
      places: [
        { floor: '4F', where: '六年五班', game: true, at: () => { const r = rooms.find((x) => x.code === '605'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色長直髮（旁分、沒有瀏海）、溫柔笑容；深藍黑色短袖 T 恤套深藍紫長袖、紅色變形蟲領巾
        skin: '#f4d4bf', hair: '#1a1515', top: '#1e2130', pants: '#1e2130', shoe: '#2a2a2a',
        longHair: true, longSleeve: true, sleeve: '#2c2c5e', neckerchief: '#d8262e',
        pal: { H: '#1a1515', h: '#2e2424', S: '#f4d4bf', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f0b0a8', N: '#e2b296', M: '#c0505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHhHHHHHHHHHH',
          'HHHHHHSSSSHHHHHH',
          'HHHHHSSSSSSSHHHH',
          'HHHHSSSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHHSSSSSSSSHHHH',
        ],
      },
    },
    {
      name: '林老師', title: '一年一班導師', game: 'zhuyin',
      hello: ['🎒 林老師：小朋友早安！今天也要乖乖上課喔！', '✋ 林老師：要發言先舉手，老師叫到再說話！', '🧼 林老師：吃飯前要記得洗手喔！',
        '🔤 林老師：ㄅㄆㄇ都學會了嗎？來玩「注音符號大闖關」！'],
      // 2 樓勤學樓一年一班（220 室）：黑板在西邊，老師站講台旁、面向東邊的學生
      places: [
        { floor: '2F', where: '一年一班', game: true, at: () => { const r = rooms.find((x) => x.code === '101'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：深棕色及肩短髮（旁分瀏海）、溫柔笑容；黑色無袖娃娃裝上衣、領口掛太陽眼鏡、斜背小包（酒紅背帶）、寬版牛仔褲、白球鞋
        skin: '#f4d4bf', hair: '#3a2a22', top: '#1c1c20', pants: '#5f7fae', shoe: '#f2f2ee',
        bob: true, sleeveless: true, shades: true, bag: '#5a2232',
        pal: { H: '#3a2a22', h: '#54402f', S: '#f4d4bf', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#f0b0a8', N: '#e2b296', M: '#c0505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHSSSSHH',
          'HHHHHHHSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSSMMMMMMSSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '闕老師', title: '一年三班導師', game: 'life',
      hello: ['😊 闕老師：小朋友好！見到人要記得打招呼喔！', '🚶 闕老師：走廊上要慢慢走，不要奔跑！', '🦷 闕老師：吃完東西記得刷牙、漱口！',
        '🏠 闕老師：要不要來挑戰「生活大考驗」？看看你是不是生活小達人！'],
      // 2 樓勤學樓一年三班（222 室）：黑板在西邊，老師站講台旁、面向東邊的學生
      places: [
        { floor: '2F', where: '一年三班', game: true, at: () => { const r = rooms.find((x) => x.code === '103'); return [r.m.x1 + 1.3, r.cz - 0.8, -Math.PI / 2]; } },
      ],
      look: {
        // 依照片：黑色短髮（旁分、蓋住耳朵）、親切笑容；米白色短袖連身洋裝（打褶長裙到小腿），空手（照片裡的紅色紙袋不放）
        skin: '#f2d2bc', hair: '#1c1616', top: '#f3ead3', pants: '#f3ead3', shoe: '#e8dcc8',
        bob: true, skirt: '#f3ead3',
        pal: { H: '#1c1616', h: '#33282a', S: '#f2d2bc', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '周周老師', title: '星星班老師', game: 'puzzle3d',
      hello: ['🐢 周周老師：慢慢來沒關係！', '🤝 周周老師：我們一起做，加油～', '🧩 周周老師：要不要來玩立體拼圖？'],
      // 1F 幼兒園星星班（125 室）：白板在南牆，站在白板前、面向北邊的教室，前面那張小矮桌放立體拼圖
      places: [
        { floor: '1F', where: '星星班', game: true, at: () => { const r = rooms.find((x) => x.name === '星星班'); return [r.cx + 0.3, r.m.z2 - 1.35, 0]; } },
      ],
      look: {
        // 依照片：黑色及肩短髮、細框眼鏡、笑容；黑色短袖 T 恤、細繩項鍊（黑色圓墜子）、深藍粉橘米色漩渦花紋寬褲、黑鞋
        skin: '#f1cdb2', hair: '#1c1616', top: '#1c1c1e', pants: '#3a4258', shoe: '#1c1c1e',
        bob: true, widePants: true, necklace: '#3a2a22', pantsPrint: ['#e6d8c4', '#22304f', '#d98a7a', '#3a4a7a', '#b9a58a'],
        pal: { H: '#1c1616', h: '#33282a', S: '#f1cdb2', K: '#4a3f3c', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEKKKKKKEEKHH',
          'HHKEWKSSSSKEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '小粉老師', title: '太陽班老師', game: 'stack',
      hello: ['☀️ 小粉老師：早安！今天也是陽光滿滿的一天喔～', '🐘 小粉老師：疊疊樂要慢慢放、輕輕放，倒了也沒關係，我們再試一次！', '🧸 小粉老師：玩完記得把玩具送回家，它們也要休息喔。'],
      // 1F 幼兒園太陽班（126 室）：白板在南牆，站在白板前、面向教室
      places: [{ floor: '1F', where: '太陽班', game: true, at: () => { const r = rooms.find((x) => x.name === '太陽班'); return [r.cx + 0.3, r.m.z2 - 1.35, 0]; } }],
      look: {
        // 依照片：棕色長髮綁馬尾、白色長袖上衣、深藍格紋背心連身裙
        skin: '#f2d2bc', hair: '#5a3a28', top: '#2c3556', pants: '#2c3556', shoe: '#2a2a2a',
        bun: true, tee: '#f7f5ef', sleeve: '#f7f5ef', longSleeve: true, skirt: '#2c3556', skirtPlaid: ['#2c3556', '#8a96b8'],
        pal: { H: '#5a3a28', h: '#6e4a34', S: '#f2d2bc', K: '#5a3a28', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '雅如老師', title: '彩虹班老師', game: 'cubes',
      hello: ['🌈 雅如老師：歡迎來彩虹班！你最喜歡哪一個顏色呢？', '🧊 雅如老師：方塊可以疊高高、也可以排長長，想一想要怎麼拼？', '🙋 雅如老師：有不會的地方，舉手問老師就好囉。'],
      // 1F 幼兒園彩虹班（122 室）：白板在西牆，站在白板前、面向教室（東）
      places: [{ floor: '1F', where: '彩虹班', game: true, at: () => { const r = rooms.find((x) => x.name === '彩虹班'); return [r.m.x1 + 1.35, r.cz + 0.3, -Math.PI / 2]; } }],
      look: {
        // 依照片：黑色長直髮有瀏海、圓框眼鏡；白色開襟毛衣＋黑色內搭、紅色長裙
        skin: '#f2d2bc', hair: '#1c1616', top: '#f4f1ea', pants: '#c81e1e', shoe: '#2a2a2a',
        longHair: true, longSleeve: true, collar: '#1c1c1e', buttonRow: '#d8d4cc', skirt: '#c81e1e',
        pal: { H: '#1c1616', h: '#33282a', S: '#f2d2bc', K: '#b8a68a', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHSSSSSSSSSSSSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEKKKKKKEEKHH',
          'HHKEWKSSSSKEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '何何老師', title: '月亮班老師', game: 'beads',
      hello: ['🌙 何何老師：你好呀，月亮班的小朋友都很有耐心喔。', '📿 何何老師：串珠要一顆一顆來，紅色、黃色、再一顆紅色……你發現規律了嗎？', '😴 何何老師：午睡時間到了就要安靜躺好，養足精神再來玩。'],
      // 1F 幼兒園月亮班（123 室）：白板在西牆，站在白板前、面向教室（東）
      places: [{ floor: '1F', where: '月亮班', game: true, at: () => { const r = rooms.find((x) => x.name === '月亮班'); return [r.m.x1 + 1.35, r.cz + 0.3, -Math.PI / 2]; } }],
      look: {
        // 依照片：及肩棕黑短髮、米色毛衣、白色襯衫領、黑色長裙
        skin: '#f2d2bc', hair: '#3a2a22', top: '#e6dccb', pants: '#1c1c1e', shoe: '#2a2a2a',
        bob: true, longSleeve: true, collar: '#ffffff', skirt: '#1c1c1e',
        pal: { H: '#3a2a22', h: '#4a362c', S: '#f2d2bc', K: '#3a2a22', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '喵喵老師', title: '彩虹班老師', game: 'fold',
      hello: ['🐱 喵喵老師：歡迎！今天我們來摺紙，你想摺什麼？', '📐 喵喵老師：角對角、邊對邊，壓平一點，作品會更漂亮喔。', '🎁 喵喵老師：做好的作品可以帶回家送給爸爸媽媽。'],
      // 1F 幼兒園彩虹班：站在後面（東牆）綠色布告欄前、面向教室（西），跟雅如老師分開站
      places: [{ floor: '1F', where: '彩虹班', game: true, at: () => { const r = rooms.find((x) => x.name === '彩虹班'); return [r.m.x2 - 1.35, r.cz - 0.6, Math.PI / 2]; } }],
      look: {
        // 依照片：黑色短鮑伯頭、細框眼鏡；酒紅色連帽拉鍊外套＋紅色內搭、咖啡色長褲
        skin: '#f2d2bc', hair: '#1c1616', top: '#6e1a22', pants: '#6a4a34', shoe: '#2a2a2a',
        bob: true, longSleeve: true, hoodie: '#e8e2d8', pocket: '#6e1a22', zip: '#c9cdd1', collar: '#d62828',
        pal: { H: '#1c1616', h: '#33282a', S: '#f2d2bc', K: '#c9b8a8', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEKKKKKKEEKHH',
          'HHKEWKSSSSKEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '高阿姨', title: '幼兒園廚房', game: 'cook',
      hello: ['🍲 高阿姨：今天的菜很好吃喔，都要吃光光！', '🥬 高阿姨：青菜也要吃，不可以挑食，身體才會長高高。', '🧼 高阿姨：吃飯前記得先洗手，吃完把碗放回來，謝謝你！'],
      // 1F 幼兒園中央廚房：站在北邊大灶前、面向中間的備料台
      places: [{ floor: '1F', where: '幼兒園中央廚房', game: true, at: () => { const r = rooms.find((x) => x.name === '幼兒園中央廚房'); return [r.cx + 2.2, r.m.z1 + 1.75, Math.PI]; } }],
      look: {
        // 依照片：短髮、黑框眼鏡；咖啡色高領、黑色長袖上衣、灰色牛仔褲
        skin: '#f0cdb4', hair: '#3a2620', top: '#1c1c22', pants: '#8a8e94', shoe: '#2a2a2a',
        shortHair: true, longSleeve: true, collar: '#8a6a52',
        pal: { H: '#3a2620', h: '#4a3228', S: '#f0cdb4', K: '#1a1a1a', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEKKKKKKEEKHH',
          'HHKEWKSSSSKEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '小靜老師', title: '星星班老師', game: 'darkchess',
      hello: ['⭐ 小靜老師：星星班的小朋友，今天也要閃閃發亮喔！', '🧸 小靜老師：玩具要輪流玩，大家一起分享～', '🤫 小靜老師：說話小小聲，耳朵仔細聽。', '♟️ 小靜老師：要不要跟老師下暗棋？翻翻看是什麼棋子！'],
      // 1F 幼兒園星星班：站在後面（北牆）綠色布告欄前、面向教室，跟前面的周周老師分開
      places: [{ floor: '1F', where: '星星班', game: true, at: () => { const r = rooms.find((x) => x.name === '星星班'); return [r.cx - 0.6, r.m.z1 + 1.42, Math.PI]; } }],
      look: {
        // 依照片：棕色長直髮有瀏海；淺綠色長袖大學 T、黑色高領內搭、藍色牛仔褲
        skin: '#f2d2bc', hair: '#5a3a2a', top: '#a8d8d0', pants: '#4a6a9a', shoe: '#2a2a2a',
        longHair: true, longSleeve: true, collar: '#1c1c1e',
        pal: { H: '#5a3a2a', h: '#6e4a34', S: '#f2d2bc', K: '#3a3a3a', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '小米老師', title: '月亮班老師', game: 'shrink',
      hello: ['🌙 小米老師：哈囉！今天心情怎麼樣呀？', '🖍️ 小米老師：慢慢塗，不要塗出線外喔～', '🙌 小米老師：做完記得把彩色筆蓋子蓋好喔！', '🔥 小米老師：要不要來做熱縮片？放進烤箱會變小喔！'],
      // 1F 幼兒園月亮班：站在後面（東牆）綠色布告欄前、面向教室（西），跟前面的何何老師分開
      places: [{ floor: '1F', where: '月亮班', game: true, at: () => { const r = rooms.find((x) => x.name === '月亮班'); return [r.m.x2 - 1.35, r.cz - 0.6, Math.PI / 2]; } }],
      look: {
        // 依照片：黑色長直髮、齊瀏海；淺藍色上衣、白色長裙
        skin: '#f2d2bc', hair: '#1c1616', top: '#a9c4e0', pants: '#f4f2ee', shoe: '#e8e4dc',
        longHair: true, longSleeve: true, skirt: '#f4f2ee',
        pal: { H: '#1c1616', h: '#33282a', S: '#f2d2bc', K: '#3a3a3a', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '禎禎老師', title: '太陽班老師', game: 'bugs',
      hello: ['☀️ 禎禎老師：早安！記得跟爸爸媽媽說再見了嗎？', '🧥 禎禎老師：天氣變涼了，出去玩要穿外套喔！', '🍱 禎禎老師：吃飯要細嚼慢嚥，吃完再去玩～', '🔍 禎禎老師：拿起放大鏡，草叢裡藏著什麼小昆蟲呢？'],
      // 1F 幼兒園太陽班：站在後面（北牆）綠色布告欄前、面向教室，跟前面的小粉老師分開
      places: [{ floor: '1F', where: '太陽班', game: true, at: () => { const r = rooms.find((x) => x.name === '太陽班'); return [r.cx - 0.6, r.m.z1 + 1.42, Math.PI]; } }],
      look: {
        // 依照片：紅棕色及肩捲髮、旁分瀏海；米白色毛衣（黑色橫條紋）、紅黑格子長裙
        skin: '#f2d2bc', hair: '#6a3424', top: '#f2ece0', pants: '#8a2a22', shoe: '#2a2a2a',
        bob: true, longSleeve: true, topStripes: '#1c1c1e', skirt: '#8a2a22', skirtPlaid: ['#a8322a', '#1c1c1c'],
        pal: { H: '#6a3424', h: '#7e4430', S: '#f2d2bc', K: '#3a3a3a', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHSSSSSSHH',
          'HHHHSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '球球老師', title: '太陽班老師', game: 'shadow',
      hello: ['☀️ 球球老師：太陽班的小朋友最棒了！', '💧 球球老師：玩完要記得喝水、上廁所喔。', '🧹 球球老師：用完的東西要放回原來的地方喔～', '🔦 球球老師：影子黑黑的，你猜得出來是什麼嗎？'],
      // 1F 幼兒園太陽班（使用者 10-28 更正）：站在教室中間走道（小粉老師在前面、禎禎老師在後面），面向窗戶那邊的桌子
      places: [{ floor: '1F', where: '太陽班', game: true, at: () => { const r = rooms.find((x) => x.name === '太陽班'); return [r.cx - 0.5, r.m.z2 - 4.37, -Math.PI / 2]; } }],
      look: {
        // 依照片：棕色齊肩鮑伯頭、旁分瀏海；米色高領、綠色連帽 T（白色抽繩）、深藍色牛仔褲
        skin: '#f0cdb4', hair: '#8a5a3a', top: '#2f7d4f', pants: '#2a3a5a', shoe: '#2a2a2a',
        bob: true, longSleeve: true, hoodie: '#f4f4f0', pocket: '#2f7d4f', collar: '#d8c8a8',
        pal: { H: '#8a5a3a', h: '#9a6a48', S: '#f0cdb4', K: '#3a3a3a', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHSSSSSSHH',
          'HHHHSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: 'Anya 老師', title: '白雲班老師', game: 'animalcall',
      hello: ['👋 Anya 老師：哈囉～小朋友早安！今天我們一起玩好不好？', '🙌 Anya 老師：玩具玩完要跟它說再見，放回家喔～', '👏 Anya 老師：我們一起拍拍手～拍拍手！', '🐶 Anya 老師：汪汪汪～是誰在叫呀？一起來聽聽看！'],
      // 1F 幼兒園白雲班（2 歲專班）：站在教室前段靠窗那邊、面向門口（西）
      places: [{ floor: '1F', where: '白雲班', game: true, at: () => { const r = rooms.find((x) => x.name.startsWith('白雲班')); return [r.cx + 2.0, r.m.z1 + 2.2, Math.PI / 2]; } }],
      look: {
        // 依照片：黑色頭髮往後綁、笑得很開心；白色短袖 T 恤外面套粉紅白格子長圍裙、淺藍色寬褲（圍裙上的卡通圖案不畫）
        skin: '#e8c2a4', hair: '#1c1616', top: '#f4c6d4', pants: '#a9bcd4', shoe: '#e8e8e8',
        bun: true, tee: '#fbf7f0', shortSkirt: '#f4c6d4', widePants: true,
        pal: { H: '#1c1616', h: '#33282a', S: '#e8c2a4', K: '#1c1616', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHSSSSHHHHHH',
          'HHHHSSSSSSSSHHHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSEEESSSSEEESHH',
          'HHSEWeSSSSEWeSHH',
          'HHSSSSSSSSSSSSHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
    {
      name: '欣欣老師', title: '白雲班老師', game: 'toyhome',
      hello: ['😊 欣欣老師：早安～跟老師說早安！', '🙌 欣欣老師：洗手手，搓搓搓，沖沖水～', '😴 欣欣老師：吃飽飽、睡飽飽，長高高！', '🧺 欣欣老師：玩具要回家囉，幫它們找一樣顏色的籃子！'],
      // 1F 幼兒園白雲班：站在教室後段靠窗那邊、面向門口（西），跟 Anya 老師分開
      places: [{ floor: '1F', where: '白雲班', game: true, at: () => { const r = rooms.find((x) => x.name.startsWith('白雲班')); return [r.cx + 2.0, r.m.z2 - 1.8, Math.PI / 2]; } }],
      look: {
        // 依照片：深咖啡色長捲髮、黑色圓框眼鏡；白色短袖 T 恤外面套灰色直條紋長圍裙、黑色寬褲
        skin: '#f2d2bc', hair: '#2a1e1a', top: '#5e6066', pants: '#1c1c1e', shoe: '#2a2a2a',
        longHair: true, tee: '#fbf7f0', shortSkirt: '#5e6066', widePants: true,
        pal: { H: '#2a1e1a', h: '#3a2a24', S: '#f2d2bc', K: '#2a2a2a', E: '#2a1610', e: '#6b3a26', W: '#ffffff', B: '#eeb0a6', N: '#e0b096', M: '#b8505a', T: '#ffffff' },
        face: [
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHHHHHHHH',
          'HHHHHHHHHSSSSSHH',
          'HHHHHHSSSSSSSSHH',
          'HHHSSSSSSSSSSSHH',
          'HHKKKKSSSSKKKKHH',
          'HHKEEKKKKKKEEKHH',
          'HHKEWKSSSSKEWKHH',
          'HHKKKKSSSSKKKKHH',
          'HHSSSSSNNSSSSSHH',
          'HHBBSSSSSSSSBBHH',
          'HHSSMMMMMMMMSSHH',
          'HHSSSMTTTTMSSSHH',
          'HHHSSSMMMMSSSHHH',
          'HHHSSSSSSSSSSHHH',
        ],
      },
    },
  ];
}
