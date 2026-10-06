/*
 * 360° 環景導覽資料（素材取自舊版 skpsar 網站）
 *
 * spots：景點（選單上的一項），可以有好幾張環景照（scenes）。
 * scene：
 *   img    圖檔名稱（pano/<img>.webp，縮圖在 pano/thumb/）
 *   floor  在哪一層
 *   at     在 3D 地圖的位置（和 campus-data.js 一樣用平面圖像素）
 *   links  照片裡的「傳送點」：to = 另一張照片的 img，pos = 在照片裡的方向（沿用舊網站的 A-Frame 座標）
 *   text / audio  有寫的話會蓋過景點的預設文字與語音
 * est: true 代表位置是估計的（平面圖上沒有，之後用 Google Earth 校正）
 */
(function () {
  const T = {
    gate: {
      zh: '大家好！歡迎來到我們的學校，你知道溪口國小為什麼叫溪口嗎？<br>我們知道河流是城市之母，有水的地方就有生命。水的源頭來自山，山上豐沛的水源流下來變成溪，而溪口國小的位置就在景美溪和新店溪交會的附近，所以叫做溪口國小。兩條溪在這裡匯合之後，往大稻埕的方向最後流向淡水河、進入臺灣海峽。所以我們除了用「山海溪口」來形容學校的地理位置之外，也代表學校課程的特色，沿著河道踏查、走讀，讓整個城市都成為我們的上課教室。<br><br>溪口國小校門，以彩虹、幸運草為意象，是一所綠意盎然的學校。現在，就請跟著我一起進來學校參觀囉！',
      en: 'Hello, everyone. Welcome to our school, Xikou. Do you know where the name of our school derives from?<br>As we know, the river is the mother of a city and people cannot live without water. The water of the river comes down from the mountains and “Xikou” in Chinese means that our school is located at the confluence of the two rivers, Jingmei River and Xindian River. After the two rivers join together, they flow into the Tamsui River and pour into the Taiwan Strait. So we not only use “山海溪口” to describe the location of our school, it is also the feature of our school curriculum. We can learn everything along the river.<br>Xikou, with the image of a rainbow and a four-leaf clover, is a school full of happiness. Now, let’s visit our school!',
    },
    hall: {
      zh: '穿堂是快樂森林的意象，有大樹、有綠地，還有專屬溪口國小的密碼呦，你找到了嗎？答對囉！就是 75941796。希望小朋友來到溪口都能在健康安全的環境下，開開心心的學習。Change your thoughts and you’ll change your world. 來到溪口就像閱讀一本本的好書，在浩瀚的書海中，打開自己的視野。',
      en: 'The hallway has the image of a happy forest, with big trees and lawns, and there is a secret code which belongs to the Xikou Family only. Can you find the code? That’s right. It’s 75941796. These numbers sound like “happiness is the way we work hard together” in Chinese. There is also a book on the wall that says, “Change your thoughts and you’ll change your world.” We hope that when kids study in Xikou, they can broaden their vision through learning.',
    },
    gender: {
      zh: '圖書館入口牆面，有一位喜歡穿粉色衣服的熊，你看到了嗎？在這幅畫中，是以森林裡的動物作為隱喻，希望我們能打破刻板印象，勇敢做自己，兩性和樂相處，共創快樂生活，迎向自己的夢想。<br>BE GOOD！<br>BE HAPPY！<br>BE YOURSELF！',
      en: 'By the entrance of the library, there is a bear with a pink sweater in the painting on the wall. In this painting, we hope we can break gender stereotypes. Try to be good, be happy and be yourself!',
    },
    lrc: {
      zh: '讀萬卷書行萬里路，學習資源中心是小朋友自主學習的天地，走入這裡，有世界各國的故事繪本等著你，讓我們一起探索，享受閱讀，擁抱世界，迎向更美好的未來！',
      en: '“Reading ten thousand books, together with traveling ten thousand miles, will enhance our knowledge.” The Learning Resources Center is the place for kids to do self-directed learning. Here we have stories and picture books from all over the world. Let’s discover, enjoy reading, embrace the world and look forward to a better future.',
    },
    library: {
      zh: '圖書館裡面藏書豐富，有不同的角落提供給小朋友不同的閱讀體驗，像是文學類、科學類、新書介紹等等。城堡造型的閱讀角落、流雲及彩虹造型的天花板，營造美感的閱讀空間。',
      en: 'There are lots of books in our library, with different categories for kids to read. The castle-shaped reading corner and the cloud- and rainbow-shaped ceiling make our reading experience comfortable.',
    },
    maker: {
      zh: '想像是創意的來源，實踐是創新的可能，幸運方塘是我們的自造基地，「3D 印表機」、「熱昇華轉印機」、「雷射切割機」，舒適明亮的空間，讓我們源源不絕的創意得以轉化為實體。無論是 3D 立體設計、平面轉印創意、教具作品創作，在這裡，我們全校的親師生都能成為一名 MAKER 自造家！',
      en: 'Imagination is the source of creativity and practice is the possibility of innovation. This is our makers’ base. We have 3D printers, a sublimation transfer machine and a laser cutter. We can use our imagination and create everything with these machines. Right here, everyone can be a maker!',
    },
    culture: {
      zh: '多元文化走廊，將窗簾多功能運用，不但能有效遮陽，還能提供各國的人文史地和特色介紹，讓我們更加了解不同國家的文化和風土民情。',
      en: 'In the Multi-culture Hallway, we make good use of the curtains. They not only block the sunlight but also introduce the history and features of different countries.',
    },
    gallery: {
      zh: '溪口情廊，會不定期展覽學生各式各樣不同的學習作品，有個別的作品也有小組、甚至是全班共同的創作，有平面的也有立體的。請看，溪口小朋友的作品是不是很有創意呢？',
      en: 'Xikou Gallery displays all kinds of learning outcomes from different classes. We display creative works made by our students. Sometimes we also have special exhibitions, such as famous artists or aboriginal cultural relics.',
    },
    courtyard: {
      zh: '中庭有生態池、蕨類植物區、香草植物區提供多元的學習素材。角落設置雨撲滿，作為雨水回收、環境保護的教材。<br>我們的綠手指志工會定期修剪校園的花草樹木，照護花葉植栽。生機蓬勃的草地與綠意盎然的校園，令人心曠神怡。',
      en: 'In the courtyard, we have an eco-pond, ferns and herbs for you to look around. We also have rainwater tanks to reuse the rainwater.<br>Our volunteers prune the branches and take care of the plants. The green grass and the clean campus make us feel comfortable.',
    },
    health: {
      zh: '健康中心有一位和藹可親的護理師阿姨，無論你是身體不舒服或受傷，護理師阿姨都會很有耐心的協助你呦，另外還會定期測量身高體重、視力和檢查牙齒，照顧小朋友的身體健康。',
      en: 'We have a kind school nurse in the health center. If you feel unwell or get hurt, she will try her best to make you feel better. She also measures your height and weight, checks your eyesight and helps with dental examinations on schedule.',
    },
    play: {
      zh: '遊戲場週邊綠樹成蔭，不僅是小朋友下課時間的遊戲基地，也是民眾假日運動的場所。充滿挑戰性的遊戲場讓孩子更愛冒險及挑戰。',
      en: 'The play area is surrounded by trees. Not only kids but also people in our community like to challenge themselves on the equipment. Sometimes the kids even have an adventure with their friends!',
    },
    field: {
      zh: '操場設置有彈性纖維跑道，靠近泳池有美麗的櫻花步道、臺灣原生種植物，兩側的木椅和樹蔭，在課堂時間提供學生運動與休憩外，也是假日社區民眾最佳的休閒場所。<br><br>司令臺面對操場，仔細看看牆面的彩色鑲嵌，隱藏著溪口校名呦－XIKOU，你發現了嗎？<br><br>另外，司令臺上方布條是溪口國小的校訓－盡心盡力、愛人如己，希望每一位溪口人都能努力實踐。',
      en: 'There is a beautiful running track on the sports field. Around it we plant cherry trees, ferns and native plants of Taiwan. People can exercise here and rest under the trees.<br>Facing the school building, you can see a stage. Can you find any words on its wall? That’s right — “XIKOU”, the name of our school. Above the stage is our school motto: “Do your best” and “Love your neighbor as yourself.”',
    },
    mrt: {
      zh: '溪仔口捷運站，以綠線和紅線的捷運站景點作為主題，老師在上課時可以帶小朋友到溪仔口捷運站介紹臺北市的各地風景，讓小朋友體驗搭捷運的過程。<br>這裡也是小朋友最愛的學習廊道。我們組合舊有的木頭長桌再利用，放在廊道上，設置休憩座椅。<br>另外還有臺北市捷運地圖，小朋友從捷運路線可以看到不同的景點位置，以及文山區生活地圖，認識自己的生活環境。',
      en: 'Xizaikou MRT Station introduces the sights of Taipei along the Green Line and Red Line. Kids can experience taking the MRT here. The benches are made from old desks, and kids love resting here during recess.<br>There is also an MRT route map showing places in different districts of Taipei, and a map of Wenshan District to learn about our living environment.',
    },
    farm: {
      zh: '小田園是配合臺北市綠屋頂計畫，設置在頂樓和露臺，減少熱島效應的產生。我們依照不同季節，動手種植不同的植物，像是青蔥、胡蘿蔔、小黃瓜等。不但認識有機肥料、體驗烹煮蔬菜，也從當中體驗到農夫刻苦耐勞的精神。',
      en: 'Our little farm is part of Taipei’s green roof project, set on the rooftop and terrace to reduce the heat island effect. We plant different crops in different seasons, such as green onions, carrots and cucumbers. We learn about organic fertilizer, how to cook vegetables, and the hard work of farmers.',
    },
    world: {
      zh: '以「SAY HELLO TO THE WORLD」為主題，裡面包含許多國家的國旗樹，讓學生認識各國不同的打招呼方式。牆上標示世界各地的時間與較為特殊的動物，讓孩子更能認識世界。',
      en: 'There is a world map with the special features of every country. Above it, six clocks show the time in different countries. We can also scan the QR codes on the map and learn to say hello in different languages.',
    },
    stairs: {
      zh: '在樓梯間有各年級學生的畫作和美術課的作品會在這裡展出，提供小朋友互相欣賞、觀摩的機會，可以學習不同的創意和手法，運用在未來的作品中。',
      en: 'When you go up or down the stairs, you can see many beautiful paintings on the wall. Kids can appreciate them and learn new ideas. Next time you pass by, see whether your masterpiece is on the wall!',
    },
    light: {
      zh: '溪口光廊展示學生在自然課和視覺藝術課中完成的作品。我們將各學年自然課單元中的風、光、靜電和雲雨等概念，延伸課程融入科學實驗，製作獨一無二的科學小玩具。',
      en: 'The Xikou Light Gallery displays self-made toys based on scientific principles — wind, light, static electricity, clouds and rain — made in our science and art classes.',
    },
    phalanx: {
      zh: '學習過去，活在當下，憧憬未來，重要的是不要停止發問。——愛因斯坦<br>在方陣教室裡，我們觀察並發現問題，進行自主探究，透過科學積木來操作體驗物理與機械原理，結合機電整合與任務導向的專題引導，在團隊合作中進行問題解決的實作課程，甚至是物聯網等程式設計的課程，藉由程式設計編寫，即可控制燈光、馬達等元件裝置，讓學生學習程式設計，將自己的想法動手製作出來。',
      en: 'Learn from yesterday, live for today, hope for tomorrow. The important thing is not to stop questioning. — Albert Einstein<br>In the Phalanx Classroom, we observe, find problems and try to solve them. We learn programming and use it to control lights and motors, turning our ideas into real things.',
    },
    gym: {
      zh: '高年級同學下課時，最喜歡到活動中心運動或打籃球。同時，我們也會在活動中心辦理全校性或學年各種節慶活動，例如母親節、教師節的慶祝大會、校慶、音樂會等。',
      en: 'Fifth and sixth graders love to play basketball here during recess. We also hold school events in the activity center, such as Mother’s Day and Teacher’s Day celebrations, the school anniversary and concerts.',
    },
    hakka: {
      zh: '古色古香的鄉土教室展現濃濃的客家味，有典雅的油紙傘，農家生活用的桌椅和簑衣，帶我們穿梭時光，漫遊古今。',
      en: 'The decorations in the Heritage and Culture Classroom represent Hakka culture: oiled paper umbrellas, long benches and desks, and a straw rain cape. Entering the classroom feels like traveling back in time!',
    },
  };

  const spots = [
    { id: 'gate', zh: '校門', en: 'Gate', text: T.gate, audio: '1', scenes: [
      { img: '01', floor: '1F', at: [255, 745], links: [{ to: '02', pos: [0, 2, -12] }] },
    ] },
    { id: 'hall', zh: '穿堂', en: 'Hallway', text: T.hall, audio: '2', scenes: [
      { img: '02', floor: '1F', at: [555, 825], links: [{ to: '01', pos: [0, 0, -12] }, { to: '03', pos: [8, 2, 9] }, { to: '10-1', pos: [-6, 2, 10] }] },
    ] },
    { id: 'gender', zh: '國際性平牆', en: 'Wall of Gender Equality', text: T.gender, audio: '3', scenes: [
      { img: '03', floor: '1F', at: [675, 300], links: [{ to: '02', pos: [8, 2, -8] }, { to: '07-3', pos: [-3, 2, -11] }] },
      { img: '07-2', floor: '1F', at: [675, 470] },
    ] },
    { id: 'lrc', zh: '學習資源中心', en: 'Learning Resources Center', text: T.lrc, audio: '4', scenes: [
      { img: '07-3', floor: '1F', at: [760, 262] },
      { img: '04', floor: '1F', at: [930, 262], text: T.library, audio: '5-6' },
      { img: '05', floor: '1F', at: [1100, 262], text: T.library, audio: '5-6' },
    ] },
    { id: 'maker', zh: '幸運方塘（自造基地）', en: 'Makers’ Base', text: T.maker, audio: '7_1', scenes: [
      { img: '06', floor: '1F', at: [1222, 262] },          // 1F 圖書館旁的小教室（105）
    ] },
    { id: 'culture', zh: '多元文化走廊', en: 'Multi-culture Hallway', text: T.culture, audio: '7_2', scenes: [
      { img: '07-1', floor: '1F', at: [1480, 364], est: true },
    ] },
    { id: 'gallery', zh: '溪口情廊', en: 'Xikou Gallery', text: T.gallery, audio: '8-9', scenes: [
      { img: '08', floor: '1F', at: [1330, 364], links: [{ to: '07-1', pos: [-12, 2, 3] }, { to: '09', pos: [13, 1, -0.5] }] },
      { img: '09', floor: '1F', at: [1050, 364], links: [{ to: '08', pos: [1, 2, 12] }] },
    ] },
    { id: 'courtyard', zh: '中庭', en: 'Courtyard', text: T.courtyard, audio: '10', scenes: [
      { img: '10-1', floor: '1F', at: [780, 820], links: [{ to: '02', pos: [7, 4, -10] }, { to: '10-2', pos: [12, 2, 3] }] },
      { img: '10-2', floor: '1F', at: [1100, 820], links: [{ to: '10-1', pos: [-12, 2, -8] }, { to: '10-3', pos: [0, 2, 12] }] },
      { img: '10-3', floor: '1F', at: [1420, 820], links: [{ to: '10-2', pos: [12, 2, 5] }] },
    ] },
    { id: 'health', zh: '健康中心', en: 'Health Center', text: T.health, audio: '11', scenes: [
      { img: '11', floor: '1F', at: [957, 1175] },
    ] },
    { id: 'play', zh: '遊戲場', en: 'Play Area', text: T.play, audio: '12', scenes: [
      { img: '12', floor: '1F', at: [900, 2010], links: [{ to: '14', pos: [-6, 2, -10] }] },   // 游泳池旁邊
    ] },
    { id: 'field', zh: '操場', en: 'Sports Field', text: T.field, audio: '13-14', scenes: [
      { img: '13', floor: '1F', at: [1090, 1585], links: [{ to: '14', pos: [-10, 2, -10] }] },
      { img: '14', floor: '1F', at: [490, 1585], est: true, links: [{ to: '12', pos: [10, 2, -8] }, { to: '13', pos: [0, 2, -12] }] },
    ] },
    { id: 'mrt', zh: '溪仔口捷運站', en: 'Xizaikou MRT Station', text: T.mrt, audio: '15', scenes: [
      { img: '15-1', floor: '2F', at: [850, 364], links: [{ to: '18', pos: [12, 2, 0] }, { to: '17', pos: [-12, 2, 0] }, { to: '15-2', pos: [0, 2, -12] }] },
      { img: '15-2', floor: '2F', at: [1100, 364], links: [{ to: '15-1', pos: [12, 2, 0] }, { to: '15-3', pos: [-12, 2, 0] }] },
      { img: '15-3', floor: '2F', at: [1400, 364], links: [{ to: '15-2', pos: [-12, 2, 0] }, { to: '16', pos: [12, 2, 0] }] },
    ] },
    { id: 'farm', zh: '溪口小田園', en: 'Xikou Little Farm', text: T.farm, audio: '16', scenes: [
      { img: '16', floor: '2F', at: [1620, 240], links: [{ to: '15-3', pos: [12, 2, 3] }] },   // 2F 東北角露臺
      { img: '23', floor: '5F', at: [1622, 830] },          // 至善樓頂樓（504、505、客語教室樓上）
    ] },
    { id: 'world', zh: '國際牆', en: 'International Wall', text: T.world, audio: '17', scenes: [
      { img: '17', floor: '2F', at: [675, 300], est: true, links: [{ to: '15-1', pos: [8, 2, -1] }] },
    ] },
    { id: 'stairs', zh: '階梯畫廊', en: 'Staircase Gallery', text: T.stairs, audio: '18-19', scenes: [
      { img: '18', floor: '2F', at: [557, 530], links: [{ to: '15-1', pos: [0, 5, 12] }] },
      { img: '19', floor: '2F', at: [1620, 1100], est: true },
    ] },
    { id: 'light', zh: '溪口光廊', en: 'Xikou Light Gallery', text: T.light, audio: '20', scenes: [
      { img: '20-1', floor: '3F', at: [850, 364], links: [{ to: '20-2', pos: [0.4, 2, -12] }] },
      { img: '20-2', floor: '3F', at: [1100, 364], links: [{ to: '20-1', pos: [-12, 2, -0.2] }, { to: '20-3', pos: [12, 2, 0] }] },
      { img: '20-3', floor: '3F', at: [1350, 364], links: [{ to: '20-2', pos: [-12, 2, -0.3] }] },
    ] },
    { id: 'phalanx', zh: '方陣教室（科學情境教室）', en: 'Phalanx Classroom', text: T.phalanx, audio: '21', scenes: [
      { img: '21', floor: '3F', at: [580, 665] },
    ] },
    { id: 'gym', zh: '活動中心', en: 'Activity Center', text: T.gym, audio: '22', scenes: [
      { img: '22', floor: '4F', at: [1100, 370] },
    ] },
    { id: 'hakka', zh: '鄉土教室', en: 'Heritage and Culture Classroom', text: T.hakka, audio: '24', scenes: [
      { img: '24', floor: '4F', at: [1620, 672] },
    ] },
  ];

  window.PANO = { spots };
})();
