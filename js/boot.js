/* 啟動與錯誤處理（一般 script，一定比 app.js 早跑）
 * 不支援 WebGL、程式載入失敗、啟動時出錯、等太久：不要一直卡在載入畫面，改顯示提示訊息，並提供不需要 WebGL 的 360° 實景導覽。
 * 網址加 ?nowebgl=1 可以直接看這個畫面（測試用）。
 * app.js 跑完會設 window.__campusBooted = true，之後的錯誤就不歸這裡管。 */
(function () {
  var SLOW_MS = 45000;          // 這麼久還沒好就先給替代方案（校園還是繼續載入，好了會自動把提示收起來）
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang');
  try { lang = lang || sessionStorage.getItem('campus-lang'); } catch (e) { /* 私密模式 */ }
  var EN = lang === 'en';
  var T = function (zh, en) { return EN ? en : zh; };

  function hasWebGL() {
    if (params.get('nowebgl')) return false;
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  var MESSAGE = {
    webgl: T('這台裝置或瀏覽器不支援 WebGL，沒辦法顯示 3D 校園。可以試試更新瀏覽器、改用電腦版 Chrome 或 Edge，或先看 360° 實景導覽。',
      'This device or browser does not support WebGL, so the 3D campus cannot be shown. Try updating your browser or using desktop Chrome or Edge, or take the 360° virtual tour instead.'),
    error: T('3D 校園啟動時出了問題。可以重新整理再試一次，或先看 360° 實景導覽。',
      'Something went wrong while starting the 3D campus. Reload to try again, or take the 360° virtual tour instead.'),
    slow: T('3D 校園載入得比較久，可能是網路或電腦比較慢。可以繼續等，或先看 360° 實景導覽。',
      'The 3D campus is taking a long time to load, possibly because of a slow network or computer. You can keep waiting, or take the 360° virtual tour instead.'),
  };

  var panel = null;
  function show(kind, detail) {
    if (window.__campusBooted) return;
    if (detail) console.error('3D 校園啟動失敗', detail);
    if (panel) {                           // 已經顯示等太久的提示，後來真的出錯：改成出錯的訊息
      panel.querySelector('p').textContent = MESSAGE[kind];
      return;
    }
    if (kind !== 'slow') { var loading = document.getElementById('loading'); if (loading) loading.remove(); }
    panel = document.createElement('div');
    panel.id = 'bootError';
    panel.innerHTML = '<div class="card"><h2>' + T('溪口國小 3D 校園', 'Xikou 3D Campus') + '</h2><p></p><div class="btns">'
      + (window.PANO ? '<button class="tour">📷 ' + T('看 360° 實景導覽', '360° virtual tour') + '</button>' : '')
      + '<button class="again">🔄 ' + T('重新整理', 'Reload') + '</button></div></div>';
    panel.querySelector('p').textContent = MESSAGE[kind];
    panel.querySelector('.again').onclick = function () { location.reload(); };
    if (window.PANO) panel.querySelector('.tour').onclick = openTour;
    document.body.appendChild(panel);
  }

  /* 不需要 WebGL 的實景導覽：環景照片左右捲動看，加上原本的介紹文字 */
  function openTour() {
    var scenes = [];
    window.PANO.spots.forEach(function (spot) {
      spot.scenes.forEach(function (s) { scenes.push({ img: s.img, spot: spot, text: s.text || spot.text }); });
    });
    var box = document.createElement('div');
    box.id = 'bootTour';
    box.innerHTML = '<div class="bar"><button class="back">✕</button><b></b><span class="cnt"></span>'
      + '<button class="prev">‹</button><button class="next">›</button></div>'
      + '<div class="photo"><img alt=""></div><div class="text"></div>';
    var photo = box.querySelector('.photo'), img = box.querySelector('img'), i = 0;
    function go(n) {
      i = (n + scenes.length) % scenes.length;
      var s = scenes[i];
      img.alt = box.querySelector('b').textContent = EN ? s.spot.en : s.spot.zh;
      img.src = 'pano/' + s.img + '.webp';
      box.querySelector('.cnt').textContent = (i + 1) + ' / ' + scenes.length;
      box.querySelector('.text').innerHTML = s.text ? (EN ? s.text.en : s.text.zh) : '';
      photo.scrollLeft = 0;
    }
    img.onload = function () { photo.scrollLeft = (photo.scrollWidth - photo.clientWidth) / 2; };
    box.querySelector('.back').onclick = function () { box.remove(); };
    box.querySelector('.prev').onclick = function () { go(i - 1); };
    box.querySelector('.next').onclick = function () { go(i + 1); };
    document.body.appendChild(box);
    go(0);
  }

  // 啟動期間的錯誤（包含 app.js 裡的 import、new WebGLRenderer 失敗）
  addEventListener('error', function (e) { if (e.message) show('error', e.message); });
  addEventListener('unhandledrejection', function (e) { show('error', e.reason); });

  document.addEventListener('DOMContentLoaded', function () {
    if (!hasWebGL()) { show('webgl'); return; }
    var app = document.createElement('script');
    app.type = 'module';
    app.src = 'js/app.js?v=304';
    app.onerror = function () { show('error', 'js/app.js 或它用到的檔案載入失敗'); };
    document.body.appendChild(app);
    setTimeout(function () { show('slow'); }, SLOW_MS);
    var watch = setInterval(function () {     // 等太久的提示跳出來之後，校園才載好：把提示收起來
      if (!window.__campusBooted) return;
      clearInterval(watch);
      if (panel) panel.remove();
    }, 500);
  });
})();
