/*
 * 溪口國小 3D 校園資料
 * 來源：溪口平面圖樓層資訊_260803.pdf（115 學年度）
 *
 * 座標單位是「平面圖像素」（PDF 以 200dpi 輸出、縮成 2000px 寬時的位置），
 * 程式會用 PX_PER_M 換算成公尺。要修改教室位置時，照平面圖量座標即可。
 *
 * rect: [x1, y1, x2, y2]   （y 往下 = 往勤學樓方向）
 * no:   教室編號（牆上的門牌，平面圖灰字）
 * code: 115 學年度班級代號（平面圖粗體黑字，例如 203 = 二年三班）
 * doors: 哪幾面牆有門  N=敬業樓方向 S=勤學樓方向 W=思源樓方向 E=至善樓方向
 */
(function () {
  const PX_PER_M = 18;           // 一般教室約 9m x 7.5m ≈ 160px x 135px
  const ORIGIN = [1100, 700];    // 中庭中心附近當作原點

  const floors = [
    { id: 'B1', name: '地下室', level: -1 },
    { id: '1F', name: '1 樓', level: 0 },
    { id: '2F', name: '2 樓', level: 1 },
    { id: '3F', name: '3 樓', level: 2 },
    { id: '4F', name: '4 樓', level: 3 },
    { id: '5F', name: '5 樓', level: 4 },
  ];

  const buildings = {
    A: { name: '敬業樓', color: '#e9c46a' },
    B: { name: '至善樓', color: '#8ecae6' },
    C: { name: '勤學樓', color: '#f4a3a3' },
    D: { name: '思源樓', color: '#95d5b2' },
  };

  // ---- 樓梯 / 電梯（可在樓層間移動） ----
  const stairs = [
    { id: '甲梯', rect: [1555, 330, 1690, 400], floors: ['B1', '1F', '2F', '3F', '4F'], building: 'B' },
    { id: '乙梯', rect: [470, 475, 645, 585], floors: ['B1', '1F', '2F', '3F', '4F', '5F'], building: 'D' },
    { id: '丙梯', rect: [515, 1060, 645, 1145], floors: ['1F', '2F', '3F', '4F'], building: 'C' },
    { id: '丁梯', rect: [1555, 1060, 1690, 1145], floors: ['1F', '2F', '3F', '4F', '5F'], building: 'B' },   // 5F = 至善樓頂樓菜園（推測從丁梯上去）
    { id: '電梯', rect: [575, 1175, 645, 1215], floors: ['1F', '2F', '3F', '4F'], elevator: true },
  ];

  // ---- 走廊（可走、沒有牆） ----
  const C = {
    A_north: [705, 150, 1555, 195],
    A_mid: [705, 330, 1555, 398],
    A_south: [645, 545, 1555, 585],
    A_west: [645, 150, 705, 545],
    D: [645, 585, 705, 1060],
    C: [645, 1060, 1555, 1105],
    B: [1510, 150, 1555, 1060],
    lobby: [575, 1145, 645, 1245],   // 丙梯旁的電梯間
  };
  const corridors = {
    B1: [],
    '1F': [C.A_north, C.A_mid, C.A_south, C.A_west, C.D, C.C, [1505, 150, 1548, 1060], C.lobby],
    '2F': [C.A_north, C.A_mid, C.A_south, C.A_west, C.D, C.C, C.B, C.lobby],
    '3F': [C.A_north, C.A_mid, C.A_south, C.A_west, C.D, C.C, C.B, C.lobby],
    '4F': [[645, 150, 705, 585], C.D, C.C, C.B, C.lobby],
    // 5F：活動中心看台（環繞中間挑空），西邊接乙梯
    //   noCeil：沒有自己的天花板（活動中心整個是挑高兩層，屋頂另外蓋）
    //   bleacher：看台階梯往哪一側升高
    '5F': [
      [645, 150, 705, 585],
      { rect: [705, 150, 1510, 218], noCeil: true, bleacher: 'N' },
      { rect: [705, 517, 1510, 585], noCeil: true, bleacher: 'S' },
      { rect: [1370, 218, 1510, 517], noCeil: true },
    ],
  };

  // ---- 房間 ----
  const rooms = [];
  function R(floor, b, rect, o) { rooms.push(Object.assign({ floor, building: b, rect }, o)); }

  // 共用：每層的廁所
  for (const f of ['1F', '2F', '3F', '4F']) {
    R(f, 'A', [465, 150, 645, 230], { name: '廁所', type: 'wc', doors: 'E' });
    R(f, 'C', [515, 1145, 575, 1245], { name: '廁所', type: 'wc', doors: 'N' });
    R(f, 'B', [1555, 1145, 1690, 1245], { name: '廁所', type: 'wc', doors: 'N' });
  }

  // B1
  R('B1', 'A', [645, 150, 1555, 560], { no: 'B1A01', name: '桌球教室', type: 'special', doors: 'WE',
    doorAt: { W: [0.93], E: [0.52] } });   // 門對準乙梯、甲梯（0~1 = 沿著牆的位置）

  // 1F
  R('1F', 'A', [705, 195, 1185, 330], { no: '103', name: '圖書館', type: 'special', doors: 'S' });
  R('1F', 'A', [1185, 195, 1260, 330], { no: '105', name: '幸運方塘（自造基地）', alias: '研討室', type: 'special', doors: 'S' });
  R('1F', 'A', [1260, 195, 1505, 330], { no: '106', name: '托育中心', type: 'kinder', doors: 'S' });
  R('1F', 'A', [705, 398, 770, 545], { no: '113', name: '油印室', type: 'office', doors: 'S' });
  R('1F', 'A', [770, 398, 865, 545], { no: '112', name: '人事室・會計室', type: 'office', doors: 'S' });
  R('1F', 'A', [865, 398, 1100, 545], { no: '111', name: '會議室', type: 'office', doors: 'NS' });
  R('1F', 'A', [1100, 398, 1260, 545], { name: '校長室', type: 'office', doors: 'S' });
  R('1F', 'A', [1260, 398, 1345, 545], { no: '110', name: '資訊室', type: 'office', doors: 'NS' });
  R('1F', 'A', [1345, 398, 1505, 545], { no: '109', name: '電腦教室一', type: 'special', doors: 'NS' });
  R('1F', 'B', [1548, 150, 1685, 330], { name: '（未標示空間）', type: 'storage', doors: 'W', hidden: true });
  R('1F', 'B', [1548, 400, 1685, 580], { name: '廁所', type: 'wc', doors: 'W' });
  R('1F', 'B', [1548, 595, 1680, 750], { no: '127', name: '白雲班（幼 2 歲）', type: 'kinder', doors: 'W' });
  R('1F', 'B', [1548, 755, 1680, 905], { no: '126', name: '太陽班', type: 'kinder', doors: 'W' });
  R('1F', 'B', [1548, 910, 1680, 1060], { no: '125', name: '星星班', type: 'kinder', doors: 'W' });
  R('1F', 'D', [512, 585, 645, 745], { no: '114', name: '總務處', type: 'office', doors: 'E' });
  R('1F', 'D', [465, 745, 645, 905], { no: '115', name: '穿堂', type: 'hall', doors: 'WE', open: true, endWall: 'E' });
  R('1F', 'D', [512, 905, 645, 1060], { no: '116', name: '教務處', type: 'office', doors: 'E' });
  R('1F', 'D', [330, 585, 410, 740], { no: '117', name: '警衛室', type: 'office', doors: 'E' });
  R('1F', 'C', [715, 1105, 800, 1245], { no: '119', name: '家長會', type: 'office', doors: 'N' });
  R('1F', 'C', [800, 1105, 880, 1245], { no: '119-1', name: '器材室', type: 'storage', doors: 'N' });
  R('1F', 'C', [880, 1105, 1035, 1245], { no: '120', name: '健康中心', type: 'office', doors: 'N' });
  R('1F', 'C', [1035, 1105, 1190, 1245], { no: '121', name: '學務處', type: 'office', doors: 'N' });
  R('1F', 'C', [1190, 1105, 1350, 1245], { no: '122', name: '彩虹班', type: 'kinder', doors: 'N' });
  R('1F', 'C', [1350, 1105, 1505, 1245], { no: '123', name: '月亮班', type: 'kinder', doors: 'N' });
  R('1F', null, [705, 585, 1505, 1060], { name: '中庭', type: 'garden', open: true });

  // 2F
  R('2F', 'A', [705, 195, 865, 330], { no: '203', name: '律動教室', type: 'special', doors: 'S' });
  R('2F', 'A', [865, 195, 1055, 330], { no: '204', name: '自然教室一', type: 'special', doors: 'S' });
  R('2F', 'A', [1055, 195, 1160, 330], { name: '（準備室）', type: 'storage', doors: 'S', hidden: true });
  R('2F', 'A', [1160, 195, 1350, 330], { no: '205', name: '自然教室二', type: 'special', doors: 'S' });
  R('2F', 'A', [1350, 195, 1510, 330], { no: '206', name: '舞蹈教室', type: 'special', doors: 'S' });
  R('2F', 'A', [705, 398, 865, 545], { no: '212', name: '教師會辦公室', type: 'office', doors: 'N' });
  R('2F', 'A', [865, 398, 1190, 545], { no: '211', name: '視聽教室', type: 'special', doors: 'NS' });
  R('2F', 'A', [1190, 398, 1350, 545], { no: '210', name: '英語教室一', type: 'special', doors: 'NS' });
  R('2F', 'A', [1350, 398, 1510, 545], { no: '209', name: '幼兒多功能活動室一', type: 'kinder', doors: 'NS' });
  R('2F', 'B', [1555, 150, 1690, 330], { name: '露臺（小田園）', type: 'garden', open: true, farm: true });
  R('2F', 'B', [1555, 400, 1690, 480], { name: '廁所', type: 'wc', doors: 'W' });
  R('2F', 'B', [1555, 480, 1690, 585], { no: '208', name: '幼兒園辦公室', type: 'office', doors: 'W' });
  R('2F', 'B', [1555, 595, 1690, 750], { no: '227', name: '幼兒多功能活動室二', type: 'kinder', doors: 'W' });
  R('2F', 'B', [1555, 755, 1690, 905], { no: '226', code: '305', type: 'class', doors: 'W' });
  R('2F', 'B', [1555, 910, 1690, 1060], { no: '225', code: '104', type: 'class', doors: 'W' });
  R('2F', 'D', [515, 585, 645, 745], { no: '213', name: '科任教師辦公室', type: 'office', doors: 'E' });
  R('2F', 'D', [515, 745, 645, 905], { no: '214', code: '201', type: 'class', doors: 'E' });
  R('2F', 'D', [515, 905, 645, 1060], { no: '215', code: '202', type: 'class', doors: 'E' });
  R('2F', 'C', [720, 1105, 880, 1245], { no: '218', code: '203', type: 'class', doors: 'N' });
  R('2F', 'C', [880, 1105, 1040, 1245], { no: '219', code: '204', type: 'class', doors: 'N' });
  R('2F', 'C', [1040, 1105, 1195, 1245], { no: '220', code: '101', type: 'class', doors: 'N' });
  R('2F', 'C', [1195, 1105, 1355, 1245], { no: '221', code: '102', type: 'class', doors: 'N' });
  R('2F', 'C', [1355, 1105, 1510, 1245], { no: '222', code: '103', type: 'class', doors: 'N' });

  // 3F
  R('3F', 'A', [705, 195, 945, 330], { no: '303', name: '音樂教室一', type: 'special', doors: 'S' });
  R('3F', 'A', [945, 195, 1105, 330], { no: '304', name: '音樂教室二', type: 'special', doors: 'S' });
  R('3F', 'A', [1105, 195, 1345, 330], { no: '305', name: '電腦教室二', type: 'special', doors: 'S' });
  R('3F', 'A', [1345, 195, 1425, 330], { no: '306', name: '潛能教室四', type: 'special', doors: 'S' });
  R('3F', 'A', [1425, 195, 1510, 330], { no: '306', name: '潛能教室三', type: 'special', doors: 'S' });
  R('3F', 'A', [705, 398, 870, 545], { no: '312', name: '思科教室', alias: '自然教室三', type: 'special', doors: 'NS' });
  R('3F', 'A', [870, 398, 1105, 545], { no: '311', name: '美勞教室', type: 'special', doors: 'NS' });
  R('3F', 'A', [1105, 398, 1345, 545], { no: '310', name: '英語教室二', type: 'special', doors: 'NS' });
  R('3F', 'A', [1345, 398, 1430, 545], { no: '309', name: '諮商室', type: 'office', doors: 'N' });
  R('3F', 'A', [1430, 398, 1510, 545], { no: '309-1', name: '團輔室', type: 'office', doors: 'N' });
  R('3F', 'B', [1555, 400, 1690, 480], { no: '307', name: '潛能教室二', type: 'special', doors: 'W' });
  R('3F', 'B', [1555, 480, 1690, 585], { no: '308', name: '潛能教室一', type: 'special', doors: 'W' });
  R('3F', 'B', [1555, 595, 1690, 750], { no: '327', name: '輔導室', type: 'office', doors: 'W' });
  R('3F', 'B', [1555, 755, 1690, 905], { no: '326', code: '304', type: 'class', doors: 'W' });
  R('3F', 'B', [1555, 910, 1690, 1060], { no: '325', code: '303', type: 'class', doors: 'W' });
  R('3F', 'D', [515, 585, 645, 745], { no: '313', name: '方陣教室', alias: '科學情境教室', type: 'special', doors: 'E' });
  R('3F', 'D', [515, 745, 645, 905], { no: '314', code: '401', type: 'class', doors: 'E' });
  R('3F', 'D', [515, 905, 645, 1060], { no: '315', code: '402', type: 'class', doors: 'E' });
  R('3F', 'C', [720, 1105, 880, 1245], { no: '318', code: '403', type: 'class', doors: 'N' });
  R('3F', 'C', [880, 1105, 1040, 1245], { no: '319', code: '404', type: 'class', doors: 'N' });
  R('3F', 'C', [1040, 1105, 1195, 1245], { no: '320', code: '405', type: 'class', doors: 'N' });
  R('3F', 'C', [1195, 1105, 1355, 1245], { no: '321', code: '301', type: 'class', doors: 'N' });
  R('3F', 'C', [1355, 1105, 1510, 1245], { no: '322', code: '302', type: 'class', doors: 'N' });

  // 4F
  R('4F', 'A', [705, 150, 1510, 585], { name: '活動中心', type: 'hall', doors: 'WE', tall: true });   // 挑高兩層（4F 球場 + 5F 看台）
  R('4F', 'B', [1555, 400, 1690, 480], { no: '404', name: '儲藏室（教具）', type: 'storage', doors: 'W' });
  R('4F', 'B', [1555, 480, 1690, 585], { no: '405', name: '儲藏室（資訊設備）', type: 'storage', doors: 'W' });
  R('4F', 'B', [1555, 595, 1690, 750], { no: '420', name: '客語教室', type: 'special', doors: 'W' });
  R('4F', 'B', [1555, 755, 1690, 905], { no: '419', code: '505', type: 'class', doors: 'W' });
  R('4F', 'B', [1555, 910, 1690, 1060], { no: '418', code: '504', type: 'class', doors: 'W' });
  R('4F', 'D', [515, 585, 645, 745], { no: '406', code: '601', type: 'class', doors: 'E' });
  R('4F', 'D', [515, 745, 645, 905], { no: '407', code: '602', type: 'class', doors: 'E' });
  R('4F', 'D', [515, 905, 645, 1060], { no: '408', code: '603', type: 'class', doors: 'E' });
  R('4F', 'C', [720, 1105, 880, 1245], { no: '411', code: '604', type: 'class', doors: 'N' });
  R('4F', 'C', [880, 1105, 1040, 1245], { no: '412', code: '605', type: 'class', doors: 'N' });
  R('4F', 'C', [1040, 1105, 1195, 1245], { no: '413', code: '501', type: 'class', doors: 'N' });
  R('4F', 'C', [1195, 1105, 1355, 1245], { no: '414', code: '502', type: 'class', doors: 'N' });
  R('4F', 'C', [1355, 1105, 1510, 1245], { no: '415', code: '503', type: 'class', doors: 'N' });

  // 5F：活動中心看台（西側；北、南、東側在上面的走廊資料）
  R('5F', 'A', [705, 218, 773, 517], { name: '活動中心看台', type: 'hall', open: true, noCeil: true, bleacher: 'W' });
  R('5F', 'B', [1555, 595, 1690, 1065], { name: '頂樓菜園', type: 'garden', open: true, farm: true });   // 504、505、客語教室的樓上

  // ---- 戶外（平面圖上沒有；依 2026-10 使用者提供的空拍圖與街景估計） ----
  const outdoor = {
    walk: [150, 40, 1960, 2200],                 // 1 樓可以走動的戶外範圍
    // 操場：緊鄰勤學樓南側，跑道東西向、寬度約等於整個校舍，中間是籃球場、兩端草地
    track: { center: [1090, 1585], size: [1320, 590], court: [0.55, 0.8] },
    stage: [1030, 1245, 1190, 1290],             // 司令臺：勤學樓正中央朝操場（1F 平面圖上的弧形）
    playground: [760, 1905, 1040, 2120],         // 遊戲場：游泳池旁邊（西側）
    pool: [1070, 1890, 1950, 2160],              // 游泳池：操場南邊條紋屋頂的建築
    gate: { x: 300, y1: 770, y2: 880 },          // 正門（思源樓穿堂正西方，彩虹拱門；警衛室在門內）
    tower: { cx: 530, cy: 530, r: 74, floors: 5 },   // 正門左邊的圓柱塔（乙梯）
    estimated: true,
  };

  window.CAMPUS = { PX_PER_M, ORIGIN, floors, buildings, stairs, corridors, rooms, outdoor,
    source: '溪口平面圖樓層資訊_260803.pdf（115 學年度）' };
})();
