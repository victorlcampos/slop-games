// Liga o DOM: menu, busca, loading, HUD, toasts
import { fetchWithTimeout } from './net.js';

const $ = id => document.getElementById(id);

export const PRESETS = [
  { label: '🇺🇸 São Francisco — Lombard St', lat: 37.80202, lon: -122.41955, hint: 'ladeiras!' },
  { label: '🇲🇨 Mônaco — Monte Carlo', lat: 43.74025, lon: 7.42664 },
  { label: '🇧🇷 Rio — Copacabana', lat: -22.96888, lon: -43.18647 },
  { label: '🇫🇷 Paris — Arco do Triunfo', lat: 48.87380, lon: 2.29500 },
  { label: '🇯🇵 Tóquio — Shibuya', lat: 35.65951, lon: 139.70049 },
  { label: '🇺🇸 Nova York — Times Square', lat: 40.75797, lon: -73.98554 },
];

const STAGES = [
  ['osm', 'Ruas e prédios (OpenStreetMap)'],
  ['dem', 'Elevação do terreno (satélite)'],
  ['sat', 'Imagens de satélite'],
  ['build', 'Construindo o mundo 3D'],
];
const WEIGHTS = { osm: 0.4, dem: 0.12, sat: 0.33, build: 0.15 };

export class UI {
  constructor() {
    this.progress = {};
    this._toastT = null;
  }

  bind({ onDrive, picker }) {
    this.picker = picker;

    // presets
    const box = $('presets');
    PRESETS.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.preset = i;
      b.textContent = p.label;
      b.addEventListener('click', () => {
        picker.setCenter(p.lat, p.lon, 16);
        onDrive(p.lat, p.lon, p.label.replace(/^..\s/, ''));
      });
      box.appendChild(b);
    });

    $('btn-drive').addEventListener('click', () => {
      const c = picker.getCenter();
      onDrive(c.lat, c.lon, this._searchLabel || null);
    });
    $('zin').addEventListener('click', () => picker.setZoom(picker.zoom + 1));
    $('zout').addEventListener('click', () => picker.setZoom(picker.zoom - 1));

    // busca (Photon com fallback Nominatim)
    const inp = $('search');
    const res = $('results');
    let deb = null;
    inp.addEventListener('input', () => {
      clearTimeout(deb);
      const q = inp.value.trim();
      if (q.length < 3) { res.classList.remove('show'); return; }
      deb = setTimeout(() => this._search(q), 450);
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(deb); this._search(inp.value.trim()); }
    });
    document.addEventListener('click', e => {
      if (!res.contains(e.target) && e.target !== inp) res.classList.remove('show');
    });

    $('btn-retry').addEventListener('click', () => { if (this._retry) this._retry(); });
    $('btn-load-back').addEventListener('click', () => { location.reload(); });
  }

  async _search(q) {
    const res = $('results');
    res.innerHTML = '<div class="ritem dim">Buscando…</div>';
    res.classList.add('show');
    let items = [];
    try {
      const r = await fetchWithTimeout('https://photon.komoot.io/api/?limit=6&q=' + encodeURIComponent(q), {}, 9000);
      const j = await r.json();
      items = (j.features || []).map(f => ({
        lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
        label: [f.properties.name, f.properties.city || f.properties.county, f.properties.state, f.properties.country]
          .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      }));
    } catch (e) { /* tenta nominatim */ }
    if (!items.length) {
      try {
        const r = await fetchWithTimeout('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' + encodeURIComponent(q), {}, 9000);
        const j = await r.json();
        items = j.map(f => ({ lat: +f.lat, lon: +f.lon, label: f.display_name }));
      } catch (e) { /* nada */ }
    }
    if (!items.length) {
      res.innerHTML = '<div class="ritem dim">Nada encontrado. Tente outro termo ou navegue no mapa.</div>';
      return;
    }
    res.innerHTML = '';
    for (const it of items) {
      const d = document.createElement('div');
      d.className = 'ritem';
      d.textContent = it.label;
      d.addEventListener('click', () => {
        this.picker.setCenter(it.lat, it.lon, 16);
        this._searchLabel = it.label.split(',')[0];
        res.classList.remove('show');
      });
      res.appendChild(d);
    }
  }

  // ---- telas ----
  showMenu() {
    $('menu').classList.remove('hide');
    $('loading').classList.add('hide');
    $('hud').classList.add('hide');
    $('touch').classList.add('hide');
    setTimeout(() => this.picker && this.picker.resize(), 30);
  }

  showLoading(label) {
    this.progress = {};
    $('menu').classList.add('hide');
    $('loading').classList.remove('hide');
    $('hud').classList.add('hide');
    $('load-err').classList.add('hide');
    $('load-steps').classList.remove('hide');
    $('load-title').textContent = label ? `Indo para ${label}…` : 'Preparando o mundo…';
    const ul = $('load-steps');
    ul.innerHTML = '';
    for (const [key, txt] of STAGES) {
      const li = document.createElement('li');
      li.id = 'st-' + key;
      li.innerHTML = `<span class="dot"></span><span>${txt}</span><em></em>`;
      ul.appendChild(li);
    }
    this.setBar(0);
  }

  setProgress(stage, frac, note) {
    this.progress[stage] = Math.max(this.progress[stage] || 0, Math.min(1, frac));
    const li = $('st-' + stage);
    if (li) {
      li.classList.toggle('done', this.progress[stage] >= 1);
      li.classList.add('active');
      if (note) li.querySelector('em').textContent = note;
      if (this.progress[stage] >= 1) li.querySelector('em').textContent = '';
    }
    let total = 0;
    for (const k in WEIGHTS) total += (this.progress[k] || 0) * WEIGHTS[k];
    this.setBar(total);
  }

  setBar(f) { $('load-bar').style.width = (f * 100).toFixed(1) + '%'; }

  showLoadError(msg, retry) {
    this._retry = retry;
    $('load-steps').classList.add('hide');
    const e = $('load-err');
    e.classList.remove('hide');
    $('load-err-msg').textContent = msg;
  }

  showHUD(touch) {
    $('menu').classList.add('hide');
    $('loading').classList.add('hide');
    $('hud').classList.remove('hide');
    $('touch').classList.toggle('hide', !touch);
  }

  setSpeed(kmh) { $('speed').textContent = Math.round(kmh); }
  setStreet(name, place) {
    $('street').textContent = name || 'sem nome';
    $('place').textContent = place || '';
  }

  toast(msg, ms = 2600) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  setEdgeWarning(on) { $('edge').classList.toggle('show', !!on); }
  toggleHelp(force) { $('help').classList.toggle('hide', force === undefined ? undefined : !force); }
}
