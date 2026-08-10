/* ==========================================================================
   0. UTILITÁRIOS
   ========================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => (v - a) / (b - a);
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const dist2 = (x1, y1, x2, y2) => (x2 - x1) ** 2 + (y2 - y1) ** 2;
let _uid = 1; const uid = () => _uid++;

// PRNG determinístico (para gerar sprites idênticos por espécie)
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---- cores ---- */
function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
const rgb2hex = (r, g, b) =>
  '#' + ((1 << 24) + (clamp(r | 0, 0, 255) << 16) + (clamp(g | 0, 0, 255) << 8) + clamp(b | 0, 0, 255)).toString(16).slice(1);

function shade(hexc, amt) { // amt<0 escurece, >0 clareia
  const [r, g, b] = hex2rgb(hexc);
  if (amt >= 0) return rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgb2hex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}
function mixc(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
const outlineOf = c => shade(c, -0.62);

/* ---- formatação ---- */
function money(v) {
  const neg = v < 0; v = Math.abs(Math.round(v));
  let s;
  if (v >= 1e6) s = (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + ' mi';
  else s = v.toLocaleString('pt-BR');
  return (neg ? '-R$ ' : 'R$ ') + s;
}
const moneyFull = v => (v < 0 ? '-R$ ' : 'R$ ') + Math.abs(Math.round(v)).toLocaleString('pt-BR');
const pct = v => Math.round(v * 100) + '%';
function stars(n) { // n 0..5, meio ponto
  const f = Math.floor(n), h = n - f >= .5;
  return '★'.repeat(f) + (h ? '⯨' : '') + '☆'.repeat(clamp(5 - f - (h ? 1 : 0), 0, 5));
}
function relTime(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/* ---- DOM ---- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---- canvas helpers ---- */
function ellipse(c, x, y, rx, ry, rot) {
  c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU);
}
function roundRectP(c, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** desenha forma com preenchimento + contorno cartoon */
function ink(c, fill, lw) {
  if (lw !== 0) { c.lineWidth = lw || 4.5; c.strokeStyle = c._ink || '#000'; c.stroke(); }
  c.fillStyle = fill; c.fill();
}
/** membro grosso arredondado */
function limb(c, x1, y1, x2, y2, w, fill) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.lineWidth = w + 4.4; c.strokeStyle = c._ink; c.stroke();
  c.lineWidth = w; c.strokeStyle = fill; c.stroke();
}
/** membro em 2 segmentos (joelho) */
function limb2(c, x1, y1, xk, yk, x2, y2, w, fill) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(xk, yk); c.lineTo(x2, y2);
  c.lineWidth = w + 4.4; c.strokeStyle = c._ink; c.stroke();
  c.lineWidth = w; c.strokeStyle = fill; c.stroke();
}
function curveShape(c, pts, close) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
    c.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
  }
  const L = pts.length - 1;
  c.quadraticCurveTo(pts[L][0], pts[L][1], pts[L][0], pts[L][1]);
  if (close) c.closePath();
}
/** olho cartoon: branco + pupila + brilho */
function eye(c, x, y, r, look) {
  look = look || 0;
  ellipse(c, x, y, r, r * 1.05); c.fillStyle = '#fff'; c.fill();
  c.lineWidth = 2.4; c.strokeStyle = c._ink; c.stroke();
  ellipse(c, x + r * .22 + look, y + r * .08, r * .48, r * .58); c.fillStyle = '#241a12'; c.fill();
  ellipse(c, x + r * .42 + look, y - r * .28, r * .19, r * .19); c.fillStyle = '#fff'; c.fill();
}
/** olho simples (ponto) — bichos pequenos */
function dotEye(c, x, y, r) {
  ellipse(c, x, y, r, r); c.fillStyle = '#241a12'; c.fill();
  ellipse(c, x + r * .3, y - r * .35, r * .34, r * .34); c.fillStyle = '#fff'; c.fill();
}

/* ==========================================================================
   1. CONSTANTES DO MUNDO
   ========================================================================== */
const W = 56, H = 56;             // tamanho do mapa em tiles
const TW = 64, TH = 32;           // tile isométrico
const ENTRANCE = { x: 27, y: 55 }; // portão (borda sul)

const DAY_SEC = 110;              // segundos reais por dia de jogo a 1x
const OPEN_H = 8, CLOSE_H = 20;   // horário de funcionamento
const YEAR_DAYS = 2;              // dias de jogo por "ano de vida" do animal
const BILL_EVERY = 7;             // contas a cada N dias

/* Terrenos */
const TERRAIN = {
  grama: { n: 'Grama', c: '#77c257', c2: '#68b04a', cost: 6, em: '🌿' },
  mata: { n: 'Mata', c: '#4e9143', c2: '#438038', cost: 12, em: '🌳' },
  terra: { n: 'Terra', c: '#b9905c', c2: '#a87f4d', cost: 5, em: '🟫' },
  areia: { n: 'Areia', c: '#e8d29a', c2: '#dcc086', cost: 8, em: '🏜️' },
  rocha: { n: 'Rocha', c: '#9b9a94', c2: '#8b8a84', cost: 14, em: '🪨' },
  neve: { n: 'Neve', c: '#eaf2f7', c2: '#d8e6ef', cost: 18, em: '❄️' },
  agua: { n: 'Água', c: '#4fa8db', c2: '#3f96c8', cost: 22, em: '💧' },
  piso: { n: 'Calçada', c: '#d9cdb6', c2: '#cabda4', cost: 10, em: '🧱' },
};
const TKEYS = Object.keys(TERRAIN);

/* Biomas: mistura ideal de terreno + clima */
const BIOMAS = {
  savana: { n: 'Savana', mix: { grama: .55, terra: .3, rocha: .15 }, temp: 'quente', em: '🌾' },
  floresta: { n: 'Floresta Temperada', mix: { mata: .45, grama: .4, terra: .15 }, temp: 'ameno', em: '🌲' },
  selva: { n: 'Floresta Tropical', mix: { mata: .6, grama: .25, agua: .15 }, temp: 'quente', em: '🌴' },
  deserto: { n: 'Deserto', mix: { areia: .7, rocha: .3 }, temp: 'quente', em: '🌵' },
  tundra: { n: 'Tundra', mix: { neve: .65, rocha: .2, agua: .15 }, temp: 'frio', em: '🧊' },
  montanha: { n: 'Montanha', mix: { rocha: .6, neve: .2, grama: .2 }, temp: 'frio', em: '⛰️' },
  pantanal: { n: 'Pantanal', mix: { agua: .45, grama: .3, mata: .25 }, temp: 'quente', em: '🐊' },
  pradaria: { n: 'Pradaria', mix: { grama: .8, terra: .2 }, temp: 'ameno', em: '🌱' },
  costa: { n: 'Costa Rochosa', mix: { agua: .45, rocha: .3, areia: .25 }, temp: 'frio', em: '🪨' },
  aquatico: { n: 'Aquário', mix: { agua: .9, rocha: .1 }, temp: 'ameno', em: '🌊' },
  caverna: { n: 'Caverna', mix: { rocha: .8, terra: .2 }, temp: 'ameno', em: '🕳️' },
};

/* Dietas: custo diário de ração por unidade de tamanho */
const DIETA = {
  herb: { n: 'Herbívoro', custo: 7, em: '🥬' },
  carn: { n: 'Carnívoro', custo: 19, em: '🥩' },
  oniv: { n: 'Onívoro', custo: 11, em: '🍎' },
  pisc: { n: 'Piscívoro', custo: 16, em: '🐟' },
  inse: { n: 'Insetívoro', custo: 9, em: '🦗' },
  nect: { n: 'Frugívoro', custo: 8, em: '🍌' },
};
