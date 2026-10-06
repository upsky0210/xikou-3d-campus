import * as THREE from 'three';

/* =========================================================
 * 360° 環景檢視器
 * 照片是 2:1 等距長方形（equirectangular），貼在球體內側。
 * 傳送點座標沿用舊網站 A-Frame 的設定：天空球轉 -90°，相機一開始看 -Z。
 * ========================================================= */

const MAX_HIRES = 4;          // 同時保留幾張高解析貼圖（每張約 32MB 顯示記憶體）

export class PanoViewer {
  constructor(data, { onClose, onLocate } = {}) {
    this.onClose = onClose;
    this.onLocate = onLocate;
    this.lang = 'zh';
    this.isOpen = false;

    // 攤平成場景清單
    this.scenes = [];
    for (const spot of data.spots) {
      spot.scenes.forEach((s, i) => this.scenes.push(Object.assign(s, { spot, idx: i })));
    }
    this.byImg = Object.fromEntries(this.scenes.map((s) => [s.img, s]));

    this.el = document.getElementById('pano');
    this.$ = (sel) => this.el.querySelector(sel);
    this.audio = new Audio();
    this.audio.preload = 'none';
    this.audio.onended = () => this.updateAudioBtn();
    this.audio.onpause = () => this.updateAudioBtn();
    this.audio.onplay = () => this.updateAudioBtn();

    this.$('.close').onclick = () => this.close();
    this.$('.locate').onclick = () => { const s = this.current; this.close(); this.onLocate?.(s); };
    this.$('.prev').onclick = () => this.step(-1);
    this.$('.next').onclick = () => this.step(1);
    this.$('.audio').onclick = () => this.toggleAudio();
    this.$('.lang').onclick = () => this.setLang(this.lang === 'zh' ? 'en' : 'zh');
    this.$('.tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) this.show(b.dataset.img); };
    this.$('.more').onclick = () => this.el.classList.toggle('expanded');
    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') this.close();
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.step(1);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.step(-1);
    });
  }

  init() {
    if (this.renderer) return;
    const host = this.$('.canvas');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200);
    this.camera.rotation.order = 'YXZ';
    const geo = new THREE.SphereGeometry(50, 64, 40);
    geo.scale(-1, 1, 1);
    this.sphere = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#222' }));
    this.sphere.rotation.y = -Math.PI / 2;
    this.scene.add(this.sphere);
    this.hotspots = new THREE.Group();
    this.scene.add(this.hotspots);
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();          // img -> { tex, hires }
    this.view = { yaw: 0, pitch: 0, fov: 75, idle: 0 };
    this.raycaster = new THREE.Raycaster();
    this.bindPointer(host);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    if (!this.renderer) return;
    const w = this.el.clientWidth || innerWidth, h = this.el.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  bindPointer(host) {
    const pts = new Map();
    let pinch = 0, down = null;
    host.addEventListener('pointerdown', (e) => {
      host.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      down = { x: e.clientX, y: e.clientY, moved: false };
      this.view.idle = 0;
    });
    host.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) { this.hover(e); return; }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) this.zoom((pinch - d) * 0.15);
        pinch = d;
        return;
      }
      const k = this.view.fov / 75 * 0.0045;
      this.view.yaw += (e.clientX - prev[0]) * k;
      this.view.pitch = Math.max(-1.45, Math.min(1.45, this.view.pitch + (e.clientY - prev[1]) * k));
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      this.view.idle = 0;
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (down && !down.moved && pts.size === 0) this.click(e);
      if (pts.size === 0) down = null;
    };
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY * 0.04); }, { passive: false });
  }

  zoom(d) {
    this.view.fov = Math.max(30, Math.min(95, this.view.fov + d));
    this.camera.fov = this.view.fov;
    this.camera.updateProjectionMatrix();
  }

  ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  }
  hitHotspot(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    return this.raycaster.intersectObjects(this.hotspots.children, false)[0]?.object;
  }
  hover(e) {
    const h = this.hitHotspot(e);
    this.renderer.domElement.style.cursor = h ? 'pointer' : 'grab';
    for (const s of this.hotspots.children) s.userData.hover = s === h;
  }
  click(e) {
    const h = this.hitHotspot(e);
    if (h) this.show(h.userData.to, { keepView: false });
  }

  /* ---------- 開啟 / 切換 ---------- */

  open(img) {
    this.init();
    this.el.hidden = false;
    this.isOpen = true;
    this.resize();
    this.show(img);
    const loop = () => {
      if (!this.isOpen) return;
      this.tick();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.audio.pause();
    this.el.hidden = true;
    this.el.classList.remove('expanded');
    history.replaceState(null, '', location.pathname);
    this.onClose?.(this.current);
  }

  step(d) {
    const i = this.scenes.indexOf(this.current);
    this.show(this.scenes[(i + d + this.scenes.length) % this.scenes.length].img);
  }

  show(img) {
    const s = this.byImg[img];
    if (!s) return;
    const sameSpot = this.current?.spot === s.spot;
    const audioWasPlaying = !this.audio.paused && sameSpot;
    this.current = s;
    this.view.yaw = 0; this.view.pitch = 0; this.view.idle = 0;
    this.el.classList.add('switching');
    setTimeout(() => this.el.classList.remove('switching'), 250);
    this.loadTexture(s);
    this.buildHotspots(s);
    this.renderInfo();
    const src = this.audioSrc(s);
    if (this.audio.dataset.src !== src) {
      this.audio.pause();
      this.audio.src = src; this.audio.dataset.src = src;
      if (audioWasPlaying) this.audio.play().catch(() => {});
    }
    this.updateAudioBtn();
    history.replaceState(null, '', `${location.pathname}?pano=${encodeURIComponent(img)}`);
  }

  loadTexture(s) {
    const set = (tex) => { if (this.current === s) { this.sphere.material.map = tex; this.sphere.material.color.set('#fff'); this.sphere.material.needsUpdate = true; } };
    const c = this.cache.get(s.img);
    if (c?.hires) { set(c.tex); this.$('.loading').hidden = true; return; }
    this.$('.loading').hidden = false;
    // 先用小縮圖墊底，再換成高解析
    this.loader.load(`pano/thumb/${s.img}.webp`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (!this.cache.get(s.img)?.hires) set(t);
    });
    this.loader.load(`pano/${s.img}.webp`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.cache.set(s.img, { tex: t, hires: true });
      this.trimCache();
      set(t);
      if (this.current === s) this.$('.loading').hidden = true;
    });
  }

  trimCache() {
    const keys = [...this.cache.keys()];
    while (keys.length > MAX_HIRES) {
      const k = keys.shift();
      if (k === this.current?.img) continue;
      this.cache.get(k).tex.dispose();
      this.cache.delete(k);
    }
  }

  buildHotspots(s) {
    for (const h of this.hotspots.children) h.material.map.dispose();
    this.hotspots.clear();
    for (const link of s.links || []) {
      const t = this.byImg[link.to];
      if (!t) continue;
      const name = t.spot === s.spot ? `${t.spot.zh} ${t.idx + 1}` : t.spot.zh;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hotspotTexture(this.lang === 'zh' ? name : t.spot.en), depthTest: false }));
      const v = new THREE.Vector3(...link.pos).normalize().multiplyScalar(10);
      sp.position.copy(v);
      sp.scale.set(2.6, 1.3, 1);
      sp.userData = { to: link.to, base: 1 };
      this.hotspots.add(sp);
    }
  }

  renderInfo() {
    const s = this.current, spot = s.spot, zh = this.lang === 'zh';
    this.$('.title b').textContent = zh ? spot.zh : spot.en;
    this.$('.title small').textContent = `${s.floor}${s.est ? (zh ? ' · 位置為估計' : ' · approx. location') : ''}`;
    const tabs = spot.scenes.length > 1
      ? spot.scenes.map((x, i) => `<button data-img="${x.img}" class="${x === s ? 'on' : ''}">${i + 1}</button>`).join('')
      : '';
    this.$('.tabs').innerHTML = tabs;
    const text = (s.text || spot.text);
    this.$('.text').innerHTML = text ? (zh ? text.zh : text.en) : '';
    this.$('.lang').textContent = zh ? 'English' : '中文';
    this.$('.locate').textContent = zh ? '📍 在地圖上' : '📍 On map';
    this.$('.close').textContent = zh ? '✕ 回到 3D 校園' : '✕ Back to 3D';
    this.$('.hint').textContent = zh ? '拖曳看四周 · 點白色箭頭移動 · 滾輪/雙指縮放' : 'Drag to look around · Tap arrows to move · Scroll/pinch to zoom';
    const i = this.scenes.indexOf(s);
    this.$('.count').textContent = `${i + 1} / ${this.scenes.length}`;
  }

  audioSrc(s) {
    const a = s.audio || s.spot.audio;
    return a ? `audio/${this.lang === 'zh' ? 'ch' : 'en'}/${a}.m4a` : '';
  }
  toggleAudio() {
    if (!this.audio.src) return;
    if (this.audio.paused) this.audio.play().catch(() => {}); else this.audio.pause();
  }
  updateAudioBtn() {
    const zh = this.lang === 'zh';
    this.$('.audio').textContent = this.audio.paused ? (zh ? '🔊 聽介紹' : '🔊 Listen') : (zh ? '⏸ 暫停' : '⏸ Pause');
  }
  setLang(l) {
    this.lang = l;
    const playing = !this.audio.paused;
    this.audio.pause();
    const src = this.audioSrc(this.current);
    this.audio.src = src; this.audio.dataset.src = src;
    if (playing) this.audio.play().catch(() => {});
    this.buildHotspots(this.current);
    this.renderInfo();
    this.updateAudioBtn();
  }

  tick() {
    const now = performance.now(), dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.view.idle += dt;
    if (this.view.idle > 5) this.view.yaw -= dt * 0.05;   // 閒置時慢慢轉
    this.camera.rotation.set(this.view.pitch, this.view.yaw, 0);
    const t = now / 1000;
    for (const h of this.hotspots.children) {
      const k = (h.userData.hover ? 1.2 : 1) * (1 + 0.05 * Math.sin(t * 3));
      h.scale.set(2.6 * k, 1.3 * k, 1);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

function hotspotTexture(label) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  // 圓形箭頭
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath(); c.arc(128, 44, 38, 0, Math.PI * 2); c.fill();
  c.lineWidth = 6; c.strokeStyle = '#fff';
  c.beginPath(); c.arc(128, 44, 34, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(128, 22); c.lineTo(150, 54); c.lineTo(106, 54); c.closePath(); c.fill();
  // 名稱
  c.font = '700 26px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(250, c.measureText(label).width + 24);
  c.fillStyle = 'rgba(0,0,0,.55)';
  c.beginPath(); c.roundRect(128 - w / 2, 92, w, 34, 17); c.fill();
  c.fillStyle = '#fff'; c.fillText(label, 128, 110, 236);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
