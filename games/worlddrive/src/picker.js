// Mini "slippy map" para escolher o ponto de largada (tiles OSM, pan/zoom)
import { lon2tx, lat2ty, tx2lon, ty2lat, clamp } from './geo.js';

const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

export class MapPicker {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lat = -22.96888; this.lon = -43.18647; this.zoom = 16;
    this.tiles = new Map(); // 'z/x/y' -> {img|null, ok}
    this.dragging = false;
    this._raf = null;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => {
      this.dragging = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      const s = Math.pow(2, this.zoom) * 256;
      let cx = lon2tx(this.lon, this.zoom) * 256 - dx * (window.devicePixelRatio > 1 ? 1 : 1);
      let cy = lat2ty(this.lat, this.zoom) * 256 - dy;
      this.lon = tx2lon(cx / 256, this.zoom);
      this.lat = clamp(ty2lat(cy / 256, this.zoom), -85, 85);
      this.render();
    });
    const up = e => { this.dragging = false; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const now = performance.now();
      if (this._wheelT && now - this._wheelT < 180) return;
      this._wheelT = now;
      this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => this.setZoom(this.zoom + 1));

    new ResizeObserver(() => this.resize()).observe(canvas.parentElement || canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 4) return;
    this.canvas.width = Math.round(r.width);
    this.canvas.height = Math.round(r.height);
    this.render();
  }

  setZoom(z) { this.zoom = clamp(Math.round(z), 3, 19); this.render(); }
  setCenter(lat, lon, zoom) {
    this.lat = clamp(lat, -85, 85); this.lon = lon;
    if (zoom) this.zoom = clamp(zoom, 3, 19);
    this.render();
  }
  getCenter() { return { lat: this.lat, lon: this.lon }; }

  _tile(z, x, y) {
    const max = Math.pow(2, z);
    if (y < 0 || y >= max) return null;
    x = ((x % max) + max) % max;
    const key = z + '/' + x + '/' + y;
    let t = this.tiles.get(key);
    if (!t) {
      t = { img: null, ok: false };
      this.tiles.set(key, t);
      if (this.tiles.size > 500) { // limpeza simples
        const it = this.tiles.keys();
        for (let i = 0; i < 150; i++) this.tiles.delete(it.next().value);
        this.tiles.set(key, t);
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { t.img = img; t.ok = true; this.render(); };
      img.onerror = () => {};
      img.src = TILE_URL(z, x, y);
    }
    return t;
  }

  render() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this._draw(); });
  }

  _draw() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    if (!W) return;
    ctx.fillStyle = '#1a1e26';
    ctx.fillRect(0, 0, W, H);
    const z = this.zoom;
    const cx = lon2tx(this.lon, z) * 256, cy = lat2ty(this.lat, z) * 256;
    const x0 = Math.floor((cx - W / 2) / 256), x1 = Math.floor((cx + W / 2) / 256);
    const y0 = Math.floor((cy - H / 2) / 256), y1 = Math.floor((cy + H / 2) / 256);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this._tile(z, tx, ty);
        const px = Math.round(tx * 256 - cx + W / 2);
        const py = Math.round(ty * 256 - cy + H / 2);
        if (t && t.ok) {
          ctx.drawImage(t.img, px, py);
        } else {
          // pai ampliado enquanto carrega
          const max = Math.pow(2, z - 1);
          const wx = ((tx >> 1) % max + max) % max;
          const p = z > 3 ? this.tiles.get((z - 1) + '/' + wx + '/' + (ty >> 1)) : null;
          if (p && p.ok) {
            ctx.drawImage(p.img, (tx & 1) * 128, (ty & 1) * 128, 128, 128, px, py, 256, 256);
          } else {
            ctx.fillStyle = '#232833';
            ctx.fillRect(px, py, 256, 256);
          }
        }
      }
    }
  }
}
