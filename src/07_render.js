/* ==========================================================================
   10. RENDERIZAÇÃO ISOMÉTRICA
   ========================================================================== */
const cv = $('#cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const cam = G.cam;

const TOFF_X = (H - 1) * TW / 2 + TW / 2;
const TCW = (W + H) * TW / 2, TCH = (W + H) * TH / 2 + 40;
let terrCv = null, terrCtx = null;

function resize() {
  // Celulares reportam DPR 3: renderizar nisso triplica a área de pintura de
  // centenas de sprites por frame sem ganho visível num traço cartoon.
  const tetoDPR = (IS_TOUCH && window.innerWidth <= 900) ? 1.6 : 2;
  DPR = Math.min(window.devicePixelRatio || 1, tetoDPR);
  VW = cv.clientWidth; VH = cv.clientHeight;
  cv.width = Math.floor(VW * DPR); cv.height = Math.floor(VH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (typeof medirHud === 'function') medirHud();
}
const w2sx = (x, y) => (x - y) * (TW / 2) * cam.z + cam.x;
const w2sy = (x, y) => (x + y) * (TH / 2) * cam.z + cam.y;
function s2w(sx, sy) {
  const ax = (sx - cam.x) / cam.z, ay = (sy - cam.y) / cam.z;
  return [(ay / (TH / 2) + ax / (TW / 2)) / 2, (ay / (TH / 2) - ax / (TW / 2)) / 2];
}
function centerOn(x, y) { cam.x = VW / 2 - (x - y) * (TW / 2) * cam.z; cam.y = VH / 2 - (x + y) * (TH / 2) * cam.z; }

/* ---- terreno em cache ---- */
function buildTerrain() {
  if (!terrCv) {
    terrCv = document.createElement('canvas');
    terrCv.width = TCW; terrCv.height = TCH;
    terrCtx = terrCv.getContext('2d');
  }
  const c = terrCtx;
  c.clearRect(0, 0, TCW, TCH);
  c.lineJoin = 'round';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = IDX(x, y), tk = TKEYS[world.terr[i]], T = TERRAIN[tk];
    const sx = (x - y) * TW / 2 + TOFF_X, sy = (x + y) * TH / 2 + 6;
    const r = mulberry(i * 2654435761 >>> 0);
    // diamante
    c.beginPath();
    c.moveTo(sx, sy - TH / 2); c.lineTo(sx + TW / 2, sy); c.lineTo(sx, sy + TH / 2); c.lineTo(sx - TW / 2, sy); c.closePath();
    const alt = r() < .5;
    c.fillStyle = alt ? T.c : T.c2; c.fill();
    // textura
    c.save(); c.clip();
    if (tk === 'grama' || tk === 'mata') {
      c.strokeStyle = shade(T.c, tk === 'mata' ? -.16 : .1); c.lineWidth = 1.6;
      for (let k = 0; k < (tk === 'mata' ? 6 : 4); k++) {
        const px = sx - 26 + r() * 52, py = sy - 12 + r() * 24;
        c.beginPath(); c.moveTo(px, py + 4); c.lineTo(px + (r() - .5) * 4, py - 3); c.stroke();
      }
    } else if (tk === 'agua') {
      c.strokeStyle = 'rgba(255,255,255,.42)'; c.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const py = sy - 6 + k * 9 + r() * 3;
        c.beginPath(); c.moveTo(sx - 16, py); c.quadraticCurveTo(sx - 4, py - 3, sx + 6, py); c.stroke();
      }
    } else if (tk === 'areia') {
      c.fillStyle = shade(T.c, -.1);
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(sx - 24 + r() * 48, sy - 11 + r() * 22, 1.3, 0, TAU); c.fill(); }
    } else if (tk === 'rocha') {
      c.fillStyle = shade(T.c, -.14);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(sx - 20 + r() * 40, sy - 8 + r() * 16, 5 + r() * 4, 3 + r() * 2, r(), 0, TAU); c.fill(); }
    } else if (tk === 'neve') {
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(sx - 22 + r() * 44, sy - 10 + r() * 20, 1.6 + r() * 2, 0, TAU); c.fill(); }
    } else if (tk === 'piso') {
      c.strokeStyle = 'rgba(120,100,70,.3)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(sx - TW / 2, sy); c.lineTo(sx, sy - TH / 2); c.moveTo(sx, sy + TH / 2); c.lineTo(sx + TW / 2, sy); c.stroke();
    } else if (tk === 'terra') {
      c.fillStyle = shade(T.c, -.12);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(sx - 20 + r() * 40, sy - 8 + r() * 16, 4, 2, 0, 0, TAU); c.fill(); }
    }
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 1; c.stroke();
  }
  G.dirty.terr = false;
}

/* ---- primitivas iso ---- */
function isoPoly(c, pts) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}
function drawIsoBox(c, x, y, w, h, hgt, col, roofCol, z) {
  const T = [w2sx(x, y), w2sy(x, y)], R = [w2sx(x + w, y), w2sy(x + w, y)];
  const B = [w2sx(x + w, y + h), w2sy(x + w, y + h)], L = [w2sx(x, y + h), w2sy(x, y + h)];
  const up = hgt * z;
  c.lineWidth = Math.max(1.2, 2.4 * z); c.strokeStyle = shade(col, -.55); c.lineJoin = 'round';
  // sombra
  isoPoly(c, [T, R, B, L]); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
  // parede esquerda
  isoPoly(c, [L, B, [B[0], B[1] - up], [L[0], L[1] - up]]);
  c.fillStyle = shade(col, -.22); c.fill(); c.stroke();
  // parede direita
  isoPoly(c, [R, B, [B[0], B[1] - up], [R[0], R[1] - up]]);
  c.fillStyle = col; c.fill(); c.stroke();
  // telhado
  isoPoly(c, [[T[0], T[1] - up], [R[0], R[1] - up], [B[0], B[1] - up], [L[0], L[1] - up]]);
  c.fillStyle = roofCol; c.fill(); c.stroke();
  return { T, R, B, L, up };
}

/* ---- objetos ---- */
function drawBuilding(c, o, z) {
  const B = BUILDINGS[o.kind];
  const hgt = o.kind === 'banco' || o.kind === 'lixeira' || o.kind === 'bebedouro' ? 12 :
    o.kind === 'playground' ? 20 : o.kind === 'pipoca' ? 22 : 30 + (o.h > 2 ? 8 : 0);
  const g = drawIsoBox(c, o.x, o.y, o.w, o.h, hgt, B.cor, shade(B.cor, .26), z);
  // toldo listrado nas lojas
  if (B.valor > 0 && o.w >= 1 && hgt > 20) {
    const y0 = g.B[1] - g.up - 2 * z;
    c.save();
    isoPoly(c, [[g.R[0], g.R[1] - g.up], [g.B[0], g.B[1] - g.up], [g.B[0], g.B[1] - g.up + 11 * z], [g.R[0], g.R[1] - g.up + 11 * z]]);
    c.clip(); c.fillStyle = '#f4f2ec'; c.fill();
    c.fillStyle = shade(B.cor, .06);
    for (let i = 0; i < 12; i++) c.fillRect(g.R[0] + i * 9 * z, g.R[1] - g.up, 4.5 * z, 40 * z);
    c.restore();
  }
  // placa com emoji
  const cx = (g.T[0] + g.B[0]) / 2, cy = (g.T[1] + g.B[1]) / 2 - g.up - 6 * z;
  const fs = Math.max(9, 17 * z * Math.min(1.4, o.w * .6 + .5));
  c.font = fs + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(B.em, cx, cy - fs * .1);
  // fila
  if (o.fila.length) {
    c.font = Math.max(8, 10 * z) + 'px system-ui'; c.fillStyle = '#fff';
    c.strokeStyle = '#2f2113'; c.lineWidth = 3;
    const tx = cx, ty = g.T[1] - g.up - 12 * z;
    c.strokeText('👥' + o.fila.length, tx, ty); c.fillText('👥' + o.fila.length, tx, ty);
  }
}
function drawDeco(c, o, z) {
  const sx = w2sx(o.x + .5, o.y + .5), sy = w2sy(o.x + .5, o.y + .5);
  const k = o.kind, s = z;
  c.lineJoin = 'round'; c.lineCap = 'round';
  ellipse(c, sx, sy + 2 * z, 15 * z, 7 * z); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
  const ik = '#2f3a20';
  if (k === 'arvore' || k === 'pinheiro' || k === 'palmeira') {
    c.strokeStyle = '#6b4420'; c.lineWidth = 7 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (k === 'palmeira' ? 5 * s : 0), sy - 30 * s); c.stroke();
    if (k === 'pinheiro') {
      c.fillStyle = '#3c7a34'; c.strokeStyle = '#285424'; c.lineWidth = 2.4 * s;
      for (let i = 0; i < 3; i++) {
        const yy = sy - 22 * s - i * 13 * s, ww = (20 - i * 4) * s;
        c.beginPath(); c.moveTo(sx - ww, yy); c.lineTo(sx, yy - 20 * s); c.lineTo(sx + ww, yy); c.closePath(); c.fill(); c.stroke();
      }
    } else if (k === 'palmeira') {
      c.strokeStyle = '#2f7a4a'; c.lineWidth = 5 * s;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * .1 - i / 5 * Math.PI * .8;
        c.beginPath(); c.moveTo(sx + 5 * s, sy - 30 * s);
        c.quadraticCurveTo(sx + 5 * s + Math.cos(a) * 20 * s, sy - 40 * s + Math.sin(a) * 12 * s,
          sx + 5 * s + Math.cos(a) * 30 * s, sy - 28 * s + Math.sin(a) * 8 * s);
        c.stroke();
      }
      c.fillStyle = '#c9862c'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sx + 3 * s + i * 4 * s, sy - 28 * s, 3 * s, 0, TAU); c.fill(); }
    } else {
      c.strokeStyle = ik; c.lineWidth = 3 * s;
      const blobs = [[0, -40, 19], [-14, -32, 14], [14, -32, 14], [0, -52, 13]];
      c.beginPath(); for (const [dx, dy, r] of blobs) { c.moveTo(sx + dx * s + r * s, sy + dy * s); c.arc(sx + dx * s, sy + dy * s, r * s, 0, TAU); }
      c.fillStyle = '#4c9a3f'; c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.2)';
      c.beginPath(); c.arc(sx - 7 * s, sy - 48 * s, 7 * s, 0, TAU); c.fill();
    }
  } else if (k === 'arbusto') {
    c.strokeStyle = ik; c.lineWidth = 2.6 * s; c.fillStyle = '#4c9a3f';
    c.beginPath();
    for (const [dx, dy, r] of [[0, -10, 12], [-9, -6, 9], [9, -6, 9]]) { c.moveTo(sx + dx * s + r * s, sy + dy * s); c.arc(sx + dx * s, sy + dy * s, r * s, 0, TAU); }
    c.fill(); c.stroke();
  } else if (k === 'flores') {
    c.fillStyle = '#4c9a3f'; ellipse(c, sx, sy - 3 * s, 16 * s, 8 * s); c.fill();
    const r2 = mulberry(o.id * 77);
    for (let i = 0; i < 7; i++) {
      const px = sx + (r2() - .5) * 28 * s, py = sy - 4 * s - r2() * 8 * s;
      c.fillStyle = ['#e2543f', '#ffc23c', '#f28ab0', '#9a6ad4', '#fff'][i % 5];
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; c.beginPath(); c.arc(px + Math.cos(a) * 2.6 * s, py + Math.sin(a) * 2.6 * s, 2.1 * s, 0, TAU); c.fill(); }
      c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(px, py, 1.6 * s, 0, TAU); c.fill();
    }
  } else if (k === 'pedra') {
    c.strokeStyle = '#5e5b56'; c.lineWidth = 2.6 * s; c.fillStyle = '#9b9a94';
    c.beginPath(); c.moveTo(sx - 15 * s, sy); c.lineTo(sx - 9 * s, sy - 15 * s); c.lineTo(sx + 5 * s, sy - 17 * s);
    c.lineTo(sx + 15 * s, sy - 4 * s); c.lineTo(sx + 8 * s, sy + 2 * s); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(sx - 8 * s, sy - 14 * s); c.lineTo(sx + 4 * s, sy - 16 * s); c.lineTo(sx, sy - 8 * s); c.closePath(); c.fill();
  } else if (k === 'fonte') {
    c.strokeStyle = '#8a8781'; c.lineWidth = 3 * s;
    ellipse(c, sx, sy - 4 * s, 22 * s, 11 * s); c.fillStyle = '#c9c4bc'; c.fill(); c.stroke();
    ellipse(c, sx, sy - 4 * s, 16 * s, 7.5 * s); c.fillStyle = '#4fa8db'; c.fill();
    c.strokeStyle = '#8a8781'; ellipse(c, sx, sy - 12 * s, 6 * s, 3 * s); c.fillStyle = '#c9c4bc'; c.fill(); c.stroke();
    c.strokeStyle = 'rgba(160,220,245,.9)'; c.lineWidth = 2.4 * s;
    for (const d of [-1, 1]) { c.beginPath(); c.moveTo(sx, sy - 16 * s); c.quadraticCurveTo(sx + d * 12 * s, sy - 26 * s, sx + d * 15 * s, sy - 6 * s); c.stroke(); }
  } else if (k === 'estatua') {
    c.strokeStyle = '#6a6762'; c.lineWidth = 2.6 * s; c.fillStyle = '#b5b0a6';
    isoPoly(c, [[sx - 14 * s, sy], [sx, sy - 7 * s], [sx + 14 * s, sy], [sx, sy + 7 * s]]); c.fill(); c.stroke();
    c.fillStyle = '#c9c4bc'; roundRectP(c, sx - 7 * s, sy - 34 * s, 14 * s, 28 * s, 4 * s); c.fill(); c.stroke();
    c.beginPath(); c.arc(sx, sy - 40 * s, 8 * s, 0, TAU); c.fill(); c.stroke();
  } else if (k === 'poste') {
    c.strokeStyle = '#4a4640'; c.lineWidth = 4 * s;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 38 * s); c.stroke();
    c.fillStyle = G.hour < 7 || G.hour > 18 ? '#ffe08a' : '#d9d2c2';
    c.beginPath(); c.arc(sx, sy - 42 * s, 6.5 * s, 0, TAU); c.fill(); c.stroke();
    if (G.hour < 7 || G.hour > 18) { c.fillStyle = 'rgba(255,224,138,.18)'; c.beginPath(); c.arc(sx, sy - 42 * s, 26 * s, 0, TAU); c.fill(); }
  } else if (k === 'placa') {
    c.strokeStyle = '#6b4420'; c.lineWidth = 3.4 * s;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 18 * s); c.stroke();
    c.fillStyle = '#d9b878'; roundRectP(c, sx - 12 * s, sy - 32 * s, 24 * s, 16 * s, 3 * s); c.fill(); c.stroke();
  }
}
function drawEncObj(c, o, z) {
  const sx = w2sx(o.x + .5, o.y + .5), sy = w2sy(o.x + .5, o.y + .5), s = z;
  const e = enclosures.get(o.encId);
  ellipse(c, sx, sy + 2 * s, 13 * s, 6 * s); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
  c.lineWidth = 2.6 * s; c.lineJoin = 'round';
  if (o.kind === 'comedouro') {
    c.strokeStyle = '#5e4a30'; c.fillStyle = '#8a6a45';
    ellipse(c, sx, sy - 5 * s, 15 * s, 8 * s); c.fill(); c.stroke();
    const nivel = e ? e.comida : 1;
    if (nivel > .05) { c.fillStyle = mixc('#c94a2a', '#7ac44a', nivel); ellipse(c, sx, sy - 6 * s, 11 * s * (.4 + nivel * .6), 5 * s * (.4 + nivel * .6)); c.fill(); }
  } else if (o.kind === 'bebedouro2') {
    c.strokeStyle = '#5e6068'; c.fillStyle = '#9b9a94';
    ellipse(c, sx, sy - 5 * s, 14 * s, 7.5 * s); c.fill(); c.stroke();
    const nivel = e ? e.agua : 1;
    if (nivel > .05) { c.fillStyle = '#4fa8db'; ellipse(c, sx, sy - 6 * s, 10 * s, 5 * s * (.3 + nivel * .7)); c.fill(); }
  } else if (o.kind === 'abrigo') {
    drawIsoBox(c, o.x, o.y, 1, 1, 20, '#a87a45', '#7a5230', z);
  } else if (o.kind === 'brinquedo') {
    c.strokeStyle = '#2f6a2f'; c.fillStyle = '#ffc23c';
    c.beginPath(); c.arc(sx, sy - 9 * s, 9 * s, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(sx, sy - 9 * s, 9 * s, .6, 2.6); c.stroke();
  } else if (o.kind === 'tronco') {
    c.strokeStyle = '#5e4a30'; c.fillStyle = '#a87a45';
    roundRectP(c, sx - 18 * s, sy - 12 * s, 36 * s, 12 * s, 6 * s); c.fill(); c.stroke();
    c.fillStyle = '#c9a06a'; ellipse(c, sx + 17 * s, sy - 6 * s, 4 * s, 6 * s); c.fill(); c.stroke();
  } else if (o.kind === 'rochaE') {
    c.strokeStyle = '#5e5b56'; c.fillStyle = '#9b9a94';
    c.beginPath(); c.moveTo(sx - 20 * s, sy); c.lineTo(sx - 12 * s, sy - 22 * s); c.lineTo(sx + 6 * s, sy - 26 * s);
    c.lineTo(sx + 20 * s, sy - 6 * s); c.closePath(); c.fill(); c.stroke();
  } else if (o.kind === 'plantaE') {
    c.strokeStyle = '#2f6a2f'; c.fillStyle = '#4c9a3f';
    for (let i = 0; i < 5; i++) { const a = -1.9 + i * .45; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + Math.cos(a) * 14 * s, sy - 20 * s, sx + Math.cos(a) * 20 * s, sy - 6 * s); c.fill(); c.stroke(); }
  } else if (o.kind === 'piscina') {
    c.strokeStyle = '#3f96c8'; c.fillStyle = '#4fa8db';
    isoPoly(c, [[sx, sy - 16 * s], [sx + 30 * s, sy], [sx, sy + 16 * s], [sx - 30 * s, sy]]); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2 * s;
    c.beginPath(); c.moveTo(sx - 14 * s, sy - 2 * s); c.quadraticCurveTo(sx, sy - 7 * s, sx + 14 * s, sy - 2 * s); c.stroke();
  }
}
/* ---- cerca ---- */
function drawFenceTile(c, x, y, e, z, lados) {
  const F = FENCES[e.fence], alt = F.alt * z;
  const P = (ax, ay) => [w2sx(ax, ay), w2sy(ax, ay)];
  const segs = [];
  for (const l of lados) {
    if (l === 'N') segs.push([P(x, y), P(x + 1, y)]);
    else if (l === 'S') segs.push([P(x, y + 1), P(x + 1, y + 1)]);
    else if (l === 'W') segs.push([P(x, y), P(x, y + 1)]);
    else if (l === 'E') segs.push([P(x + 1, y), P(x + 1, y + 1)]);
  }
  const dano = 1 - e.integridade;
  for (const [A, B] of segs) {
    if (F.aquatico || F.cor === '#a8d8e8') { // vidro
      isoPoly(c, [A, B, [B[0], B[1] - alt], [A[0], A[1] - alt]]);
      c.fillStyle = 'rgba(168,216,232,.34)'; c.fill();
      c.strokeStyle = '#7ec4dd'; c.lineWidth = 2 * z; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.4 * z;
      c.beginPath(); c.moveTo(A[0] + (B[0] - A[0]) * .25, A[1] + (B[1] - A[1]) * .25 - 3 * z);
      c.lineTo(A[0] + (B[0] - A[0]) * .35, A[1] + (B[1] - A[1]) * .35 - alt + 4 * z); c.stroke();
    } else if (e.fence === 'pedra') {
      isoPoly(c, [A, B, [B[0], B[1] - alt], [A[0], A[1] - alt]]);
      c.fillStyle = F.cor; c.fill();
      c.strokeStyle = shade(F.cor, -.35); c.lineWidth = 1.8 * z; c.stroke();
      c.strokeStyle = shade(F.cor, -.2); c.lineWidth = 1.2 * z;
      for (let i = 1; i < 3; i++) {
        const t = i / 3;
        c.beginPath(); c.moveTo(A[0], A[1] - alt * t); c.lineTo(B[0], B[1] - alt * t); c.stroke();
      }
    } else if (e.fence === 'aviario') {
      c.strokeStyle = 'rgba(138,144,152,.75)'; c.lineWidth = 1.1 * z;
      for (let i = 0; i <= 4; i++) {
        const t = i / 4, px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - alt); c.stroke();
      }
      for (let i = 1; i <= 3; i++) {
        const yy = alt * i / 3.2;
        c.beginPath(); c.moveTo(A[0], A[1] - yy); c.lineTo(B[0], B[1] - yy); c.stroke();
      }
      c.strokeStyle = '#5e6068'; c.lineWidth = 2.6 * z;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(A[0], A[1] - alt); c.stroke();
    } else { // madeira / ferro / elétrica
      c.strokeStyle = shade(F.cor, -.42); c.lineWidth = 4.2 * z; c.lineCap = 'round';
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(A[0], A[1] - alt); c.stroke();
      c.beginPath(); c.moveTo(B[0], B[1]); c.lineTo(B[0], B[1] - alt); c.stroke();
      c.strokeStyle = F.cor; c.lineWidth = 2.6 * z;
      c.beginPath(); c.moveTo(A[0], A[1] - 1); c.lineTo(A[0], A[1] - alt); c.stroke();
      c.beginPath(); c.moveTo(B[0], B[1] - 1); c.lineTo(B[0], B[1] - alt); c.stroke();
      const nb = e.fence === 'ferro' ? 4 : 2;
      for (let i = 1; i <= nb; i++) {
        const yy = alt * (i / (nb + .6)) + 2 * z;
        c.strokeStyle = e.fence === 'eletrica' ? '#f2d43c' : F.cor;
        c.lineWidth = (e.fence === 'eletrica' ? 1.6 : 3) * z;
        c.beginPath(); c.moveTo(A[0], A[1] - yy); c.lineTo(B[0], B[1] - yy); c.stroke();
      }
      if (e.fence === 'ferro') {
        c.strokeStyle = F.cor; c.lineWidth = 1.8 * z;
        for (let i = 1; i < 4; i++) {
          const t = i / 4, px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t;
          c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - alt); c.stroke();
        }
      }
    }
    if (dano > .35) {
      c.strokeStyle = 'rgba(200,60,40,.8)'; c.lineWidth = 2 * z;
      c.beginPath(); c.moveTo(A[0] + 4, A[1] - alt * .3); c.lineTo(B[0] - 6, B[1] - alt * .8); c.stroke();
    }
  }
}

/* ---- entidades ---- */
/** Desenha um sprite 128x128 (chão em GND) ancorado nos pés em (sx,sy).
 *  `alt` é a altura desejada em px na tela para as 128 unidades locais. */
function blitSprite(c, spr, sx, sy, alt, dir) {
  const k = alt / SPR;                      // px de tela por unidade local
  c.save();
  c.translate(sx, sy);
  if (dir < 0) c.scale(-1, 1);
  // o chão do sprite está em (GND+PAD) unidades a partir do topo da moldura
  c.drawImage(spr, -alt / 2, -(GND + PAD) * k, alt, SPRH * k);
  c.restore();
}
function drawAnimal(c, a, z) {
  const sx = w2sx(a.x, a.y), sy = w2sy(a.x, a.y);
  const hp = spriteH(a.sp);              // altura base em px (zoom 1)
  const alt = hp * z;                    // altura na tela
  const px = clamp(Math.round(alt / 8) * 8, 24, 240); // resolução do cache, em degraus
  ellipse(c, sx, sy, hp * .26 * z, hp * .12 * z); c.fillStyle = 'rgba(0,0,0,.24)'; c.fill();
  const spr = getSprite(a.sp, a.estado === 'parado' ? 0 : a.frame, px);
  blitSprite(c, spr, sx, sy, alt, a.dir);
  filaBolhas(a, sx, sy - alturaVisivel(a.sp) * (alt / SPR), z);
}
/* ---- balões de pensamento ---- */
const bolhas = [];
const BOLHA_MAX = 42;        // teto de balões desenhados por frame
const BOLHA_DIST = 30;       // distância mínima entre dois balões, em px de tela
/** enfileira o balão; a triagem por urgência e espaçamento é feita no desenho */
function filaBolhas(ent, sx, syTopo, z) {
  if (!G.bolhas || z < .42 || !ent.pensa) return;
  if (G.bolhas === 1 && ent.pensa.urg < .45) return;
  bolhas.push({ sx, sy: syTopo - 6 * z, p: ent.pensa, z });
}
function drawBolhas(c, agora) {
  if (!bolhas.length) return;
  // Urgência primeiro: com o teto aplicado na ordem de desenho, quem aparecia
  // era quem estava na frente na fila de profundidade — um bicho em apuros no
  // fundo perdia o balão para um visitante "curtindo o dia".
  bolhas.sort((a, b) => b.p.urg - a.p.urg);
  const aceitos = [];
  const dmin = BOLHA_DIST * BOLHA_DIST;
  for (const b of bolhas) {
    if (aceitos.length >= BOLHA_MAX) break;
    // em multidão, um balão a cada ~30px: senão a fila vira um mural ilegível
    let perto = false;
    for (const a of aceitos) if (dist2(a.sx, a.sy, b.sx, b.sy) < dmin) { perto = true; break; }
    if (!perto) aceitos.push(b);
  }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  for (const b of aceitos) {
    const z = b.z, u = b.p.urg;
    const fundo = u >= .8 ? '#ffd2c8' : u >= .45 ? '#ffeec2' : '#e8f6dd';
    const borda = u >= .8 ? '#bd3f2d' : u >= .45 ? '#c98a1c' : '#3b8c38';
    const w = 25 * z, h = 22 * z;
    const bob = Math.sin(agora / 520 + b.sx * .05) * 1.6 * z;
    const x = b.sx, y = b.sy + bob;
    c.lineWidth = Math.max(1, 2.2 * z);
    c.strokeStyle = borda; c.fillStyle = fundo;
    roundRectP(c, x - w / 2, y - h, w, h, 7 * z); c.fill(); c.stroke();
    // rastro de pensamento (duas bolinhas descendo até a cabeça)
    c.beginPath(); c.arc(x - 1.5 * z, y + 3.2 * z, 2.5 * z, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(x - 3.5 * z, y + 8 * z, 1.5 * z, 0, TAU); c.fill(); c.stroke();
    c.font = Math.round(13.5 * z) + 'px system-ui';
    c.fillText(b.p.em, x, y - h / 2 + .5 * z);
  }
  bolhas.length = 0;
}
function drawPersonEnt(c, p, z) {
  const sx = w2sx(p.x, p.y), sy = w2sy(p.x, p.y);
  const hp = 46 * (p.escala || 1);
  const alt = hp * z;
  ellipse(c, sx, sy, 8 * z, 4 * z); c.fillStyle = 'rgba(0,0,0,.22)'; c.fill();
  const spr = getPerson(p, p.frame, clamp(Math.round(alt / 8) * 8, 24, 140));
  blitSprite(c, spr, sx, sy, alt, p.dir);
  // item na mão fica fora do sprite cacheado (senão triplicaria as variantes)
  if (p.item && z > .45) {
    const k = alt / SPR, hx = sx + p.dir * 16 * k, hy = sy - 42 * k;
    c.lineJoin = 'round'; c._ink = '#2c2118';
    if (p.item === 'balao') {
      c.strokeStyle = '#8a7a5e'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(hx, hy + 8 * k); c.lineTo(hx + p.dir * 7 * k, hy - 30 * k); c.stroke();
      ellipse(c, hx + p.dir * 8 * k, hy - 39 * k, 9 * k, 10 * k); ink(c, p.balao, 3 * k);
    } else {
      roundRectP(c, hx - 5 * k, hy + 4 * k, 10 * k, 9 * k, 3 * k); ink(c, '#e8b45c', 2.6 * k);
    }
  }
  if (p.role && z > .55) {
    c.font = Math.round(11 * z) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillText(STAFF_TYPES[p.role].em, sx, sy - hp * z * .92);
  }
  if (!p.role) filaBolhas(p, sx, sy - hp * z * .95, z);   // funcionário não pensa alto
}

/* ---- render principal ---- */
const drawList = [];
function render(now) {
  if (G.dirty.terr) buildTerrain();
  ctx.clearRect(0, 0, VW, VH);
  // céu / fundo
  const noite = G.hour < 6.5 || G.hour > 19;
  ctx.fillStyle = noite ? '#2b3d4f' : '#8ed3ad';
  ctx.fillRect(0, 0, VW, VH);

  const z = cam.z;
  ctx.save();
  ctx.translate(cam.x - TOFF_X * z, cam.y - 6 * z);
  ctx.scale(z, z);
  ctx.drawImage(terrCv, 0, 0);
  ctx.restore();

  // faixa de tiles visível (os 4 cantos da tela em coordenadas de mundo)
  const cs = [s2w(0, 0), s2w(VW, 0), s2w(VW, VH), s2w(0, VH)];
  const x0 = clamp(Math.floor(Math.min(...cs.map(p => p[0])) - 3), 0, W - 1);
  const x1 = clamp(Math.ceil(Math.max(...cs.map(p => p[0])) + 3), 0, W - 1);
  const y0 = clamp(Math.floor(Math.min(...cs.map(p => p[1])) - 3), 0, H - 1);
  const y1 = clamp(Math.ceil(Math.max(...cs.map(p => p[1])) + 3), 0, H - 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const l = world.lixo[IDX(x, y)];
    if (l > .18) {
      const sx = w2sx(x + .5, y + .5), sy = w2sy(x + .5, y + .5);
      ctx.font = Math.round(11 * z) + 'px system-ui';
      ctx.globalAlpha = clamp(l, .3, 1); ctx.fillText('🗑', sx, sy); ctx.globalAlpha = 1;
    }
  }

  // monta lista com profundidade
  let n = 0;
  const push = (d, t, r) => { drawList[n] = drawList[n] || {}; const o = drawList[n]; o.d = d; o.t = t; o.r = r; n++; };
  for (const e of enclosures.values()) {
    for (const [k, lados] of encSegPorTile(e)) {
      const x = k % W, y = (k / W) | 0;
      if (x < x0 - 2 || x > x1 + 2 || y < y0 - 2 || y > y1 + 2) continue;
      // N/W ficam ATRÁS do bicho que pisa no tile; S/E ficam na frente. Com o
      // anel de cerca antigo isso não importava (ninguém pisava nele).
      const fundo = lados.filter(l => l === 'N' || l === 'W');
      const frente = lados.filter(l => l === 'S' || l === 'E');
      if (fundo.length) push(x + y - .45, 'fence', { x, y, e, lados: fundo });
      if (frente.length) push(x + y + .45, 'fence', { x, y, e, lados: frente });
    }
  }
  for (const o of objects.values()) {
    if (o.x < x0 - 4 || o.x > x1 + 3 || o.y < y0 - 4 || o.y > y1 + 3) continue;
    push(o.x + o.y + (o.w + o.h) * .5 - .5, o.cat, o);
  }
  for (const a of G.animals) {
    if (a.morto) continue;
    if (a.x < x0 - 3 || a.x > x1 + 3 || a.y < y0 - 3 || a.y > y1 + 3) continue;
    push(a.x + a.y, 'animal', a);
  }
  for (const v of G.visitors) {
    if (v.x < x0 - 2 || v.x > x1 + 2 || v.y < y0 - 2 || v.y > y1 + 2) continue;
    push(v.x + v.y, 'person', v);
  }
  for (const s of G.staff) {
    if (s.x < x0 - 2 || s.x > x1 + 2 || s.y < y0 - 2 || s.y > y1 + 2) continue;
    push(s.x + s.y, 'person', s);
  }
  const list = drawList.slice(0, n);
  list.sort((a, b) => a.d - b.d);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const it of list) {
    if (it.t === 'fence') drawFenceTile(ctx, it.r.x, it.r.y, it.r.e, z, it.r.lados);
    else if (it.t === 'build') drawBuilding(ctx, it.r, z);
    else if (it.t === 'deco') drawDeco(ctx, it.r, z);
    else if (it.t === 'encobj') drawEncObj(ctx, it.r, z);
    else if (it.t === 'animal') drawAnimal(ctx, it.r, z);
    else if (it.t === 'person') drawPersonEnt(ctx, it.r, z);
  }
  drawEntrance(ctx, z);
  drawBolhas(ctx, now);       // por cima das entidades, senão some atrás delas
  drawAvisos(ctx, z);
  drawSelection(ctx, z);
  drawGhost(ctx, z);

  // noite
  if (noite) {
    const k = G.hour < 6.5 ? clamp((6.5 - G.hour) / 2.5, 0, 1) : clamp((G.hour - 19) / 3, 0, 1);
    ctx.fillStyle = 'rgba(24,34,66,' + (k * .46).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
  } else if (G.hour < 8.5) {
    ctx.fillStyle = 'rgba(255,170,90,' + ((8.5 - G.hour) * .12).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
}
function drawEntrance(c, z) {
  const x = ENTRANCE.x, y = ENTRANCE.y;
  const T = [w2sx(x, y), w2sy(x, y)], R = [w2sx(x + 1, y), w2sy(x + 1, y)];
  const up = 40 * z;
  c.strokeStyle = '#6b4420'; c.lineWidth = 6 * z; c.lineCap = 'round';
  c.beginPath(); c.moveTo(T[0], T[1]); c.lineTo(T[0], T[1] - up); c.stroke();
  c.beginPath(); c.moveTo(R[0], R[1]); c.lineTo(R[0], R[1] - up); c.stroke();
  c.fillStyle = '#e2543f'; c.strokeStyle = '#8a2f22'; c.lineWidth = 2.6 * z;
  roundRectP(c, Math.min(T[0], R[0]) - 6 * z, Math.min(T[1], R[1]) - up - 14 * z,
    Math.abs(R[0] - T[0]) + 12 * z, 20 * z, 5 * z);
  c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(9 * z) + 'px system-ui';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('ZOO', (T[0] + R[0]) / 2, (T[1] + R[1]) / 2 - up - 4 * z);
}
/** Balão de aviso sobre recinto que tem animal mas nenhuma trilha ao lado —
 *  a causa mais comum de "zoológico cheio e nenhum visitante". */
function drawAvisos(c, z) {
  if (z < .35) return;
  for (const e of enclosures.values()) {
    if (!e.animals.some(a => !a.morto)) continue;
    if (encViewSpots(e).length) continue;
    const bb = encBBox(e);
    const cx = w2sx(bb.cx, bb.cy);
    const cy = w2sy(bb.cx, bb.cy) - 30 * z;
    const bob = Math.sin(performance.now() / 400) * 3 * z;
    const w = 26 * z, h = 22 * z;
    c.lineJoin = 'round';
    roundRectP(c, cx - w / 2, cy - h + bob, w, h, 6 * z);
    c.fillStyle = '#ffcfc4'; c.fill();
    c.strokeStyle = '#bd3f2d'; c.lineWidth = 2.4 * z; c.stroke();
    c.beginPath();
    c.moveTo(cx - 5 * z, cy + bob); c.lineTo(cx, cy + 6 * z + bob); c.lineTo(cx + 5 * z, cy + bob);
    c.closePath(); c.fillStyle = '#ffcfc4'; c.fill(); c.stroke();
    c.font = Math.round(13 * z) + 'px system-ui';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('👀', cx, cy - h / 2 + bob);
  }
}
function drawSelection(c, z) {
  const s = G.sel; if (!s) return;
  c.strokeStyle = '#ffc23c'; c.lineWidth = 3 * z; c.setLineDash([7 * z, 5 * z]);
  if (s.tipo === 'enc') {
    const e = s.ref;
    c.beginPath();
    for (const [k, lados] of encSegPorTile(e)) {
      const x = k % W, y = (k / W) | 0;
      for (const l of lados) {
        const a = l === 'S' ? [x, y + 1] : l === 'E' ? [x + 1, y] : [x, y];
        const b = l === 'N' ? [x + 1, y] : l === 'S' ? [x + 1, y + 1] : l === 'E' ? [x + 1, y + 1] : [x, y + 1];
        c.moveTo(w2sx(a[0], a[1]), w2sy(a[0], a[1]));
        c.lineTo(w2sx(b[0], b[1]), w2sy(b[0], b[1]));
      }
    }
    c.stroke();
  } else if (s.tipo === 'obj') {
    const o = s.ref;
    isoPoly(c, [[w2sx(o.x, o.y), w2sy(o.x, o.y)], [w2sx(o.x + o.w, o.y), w2sy(o.x + o.w, o.y)],
    [w2sx(o.x + o.w, o.y + o.h), w2sy(o.x + o.w, o.y + o.h)], [w2sx(o.x, o.y + o.h), w2sy(o.x, o.y + o.h)]]);
    c.stroke();
  } else if (s.tipo === 'animal' || s.tipo === 'staff' || s.tipo === 'vis') {
    const a = s.ref;
    const r = s.tipo === 'animal' ? 22 : 13;
    c.beginPath(); c.ellipse(w2sx(a.x, a.y), w2sy(a.x, a.y), r * z, r * .5 * z, 0, 0, TAU); c.stroke();
  }
  c.setLineDash([]);
}
function drawGhost(c, z) {
  const t = G.tool; if (!t || !G.hover) return;
  const [hx, hy] = G.hover;
  c.globalAlpha = .62;
  if (G.drag && (t.cat === 'recinto')) {
    const r = dragRect();
    const p = planoDoArraste(r, t.key);
    // verde = recinto novo · dourado = ampliação do vizinho · vermelho = não dá
    const cor = p.acao === 'criar' ? ['#4fae4a', 'rgba(79,174,74,.26)', '#1f5a1c']
      : p.acao === 'ampliar' ? ['#e8a01c', 'rgba(255,194,60,.3)', '#7a5210']
        : ['#e2543f', 'rgba(226,84,63,.24)', '#8a2f22'];
    c.strokeStyle = cor[0]; c.lineWidth = 3 * z; c.fillStyle = cor[1];
    // pinta só os tiles que realmente entram (o resto do retângulo é ocupado)
    if (p.tiles) {
      for (const k of p.tiles) {
        const x = k % W, y = (k / W) | 0;
        isoPoly(c, [[w2sx(x, y), w2sy(x, y)], [w2sx(x + 1, y), w2sy(x + 1, y)],
        [w2sx(x + 1, y + 1), w2sy(x + 1, y + 1)], [w2sx(x, y + 1), w2sy(x, y + 1)]]);
        c.fill();
      }
    }
    isoPoly(c, [[w2sx(r.x, r.y), w2sy(r.x, r.y)], [w2sx(r.x + r.w, r.y), w2sy(r.x + r.w, r.y)],
    [w2sx(r.x + r.w, r.y + r.h), w2sy(r.x + r.w, r.y + r.h)], [w2sx(r.x, r.y + r.h), w2sy(r.x, r.y + r.h)]]);
    c.stroke();
    c.globalAlpha = 1;
    const rot = p.acao === 'criar' ? `Novo recinto · ${p.tiles.length} tiles · ${moneyFull(p.custo)}`
      : p.acao === 'ampliar' ? `Ampliar ${p.alvo.nome} · +${p.tiles.length} tiles · ${moneyFull(p.custo)}`
        : p.motivo;
    c.fillStyle = cor[2]; c.font = 'bold ' + Math.round(12.5 * z) + 'px system-ui';
    c.textAlign = 'center';
    const mx = w2sx(r.x + r.w / 2, r.y + r.h / 2), my = w2sy(r.x + r.w / 2, r.y + r.h / 2);
    c.strokeStyle = 'rgba(255,253,246,.85)'; c.lineWidth = 4 * z;
    c.strokeText(rot, mx, my); c.fillText(rot, mx, my);
    c.globalAlpha = .62;
  } else {
    const w = t.w || 1, h = t.h || 1;
    const ok = podeColocar(t, hx, hy);
    c.strokeStyle = ok ? '#4fae4a' : '#e2543f'; c.lineWidth = 2.6 * z;
    c.fillStyle = ok ? 'rgba(79,174,74,.3)' : 'rgba(226,84,63,.3)';
    isoPoly(c, [[w2sx(hx, hy), w2sy(hx, hy)], [w2sx(hx + w, hy), w2sy(hx + w, hy)],
    [w2sx(hx + w, hy + h), w2sy(hx + w, hy + h)], [w2sx(hx, hy + h), w2sy(hx, hy + h)]]);
    c.fill(); c.stroke();
    if (t.em) {
      c.globalAlpha = .9; c.font = Math.round(20 * z) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t.em, w2sx(hx + w / 2, hy + h / 2), w2sy(hx + w / 2, hy + h / 2) - 10 * z);
    }
  }
  c.globalAlpha = 1;
}

/* ---- minimapa ---- */
const mcv = $('#minicv'), mctx = mcv.getContext('2d');
// buffer reaproveitado: alocar canvas+ImageData 2x por segundo pressiona o GC
const _mtmp = document.createElement('canvas');
_mtmp.width = W; _mtmp.height = H;
const _mtmpCtx = _mtmp.getContext('2d');
const _mimg = _mtmpCtx.createImageData(W, H);
function renderMini() {
  const S = 300 / Math.max(W, H);
  mctx.fillStyle = '#77c257'; mctx.fillRect(0, 0, 300, 300);
  const img = _mimg;
  for (let i = 0; i < W * H; i++) {
    const t = TKEYS[world.terr[i]];
    let col = TERRAIN[t].c;
    if (world.enc[i]) col = shade(col, -.22);
    const [r, g, b] = hex2rgb(col);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  _mtmpCtx.putImageData(img, 0, 0);
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(_mtmp, 0, 0, 300, 300);
  // viewport
  const c0 = s2w(0, 0), c1 = s2w(VW, 0), c2 = s2w(VW, VH), c3 = s2w(0, VH);
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 3;
  mctx.beginPath();
  mctx.moveTo(c0[0] * S, c0[1] * S); mctx.lineTo(c1[0] * S, c1[1] * S);
  mctx.lineTo(c2[0] * S, c2[1] * S); mctx.lineTo(c3[0] * S, c3[1] * S); mctx.closePath(); mctx.stroke();
  mctx.fillStyle = '#e2543f';
  for (const v of G.visitors) mctx.fillRect(v.x * S - 1, v.y * S - 1, 2.5, 2.5);
}
