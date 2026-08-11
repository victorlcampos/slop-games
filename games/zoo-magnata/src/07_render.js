/* ==========================================================================
   10. ISOMETRIC RENDERING
   ========================================================================== */
const cv = $('#cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const cam = G.cam;

const TOFF_X = (H - 1) * TW / 2 + TW / 2;
const TCW = (W + H) * TW / 2, TCH = (W + H) * TH / 2 + 40;
let terrCv = null, terrCtx = null;

function resize() {
  // Phones report DPR 3: rendering at that triples the fill area of hundreds of
  // sprites per frame with no visible gain on a cartoon outline.
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

/* ---- cached terrain ----
   Everything here is redrawn only when G.dirty.terr goes up; frame to frame it
   just blits the canvas. Three layers: the base (diamonds + texture), organic
   fringes
   entre terrenos, e a rede de trilhas com meio-fio, curvas e entradas de loja. */
const T_GRAMA = TKEYS.indexOf('grass'), T_WATER = TKEYS.indexOf('water'), T_PISO = TKEYS.indexOf('pavement');
const AGUA_FUNDA = shade(TERRAIN.water.c2, -.12);
/* a softened alternate tone: pure c2 made too strong a checkerboard on the lawn */
const TOM2 = {}; for (const k of TKEYS) TOM2[k] = mixc(TERRAIN[k].c, TERRAIN[k].c2, .6);
const PISO_C = TERRAIN.pavement.c, PISO_C2 = TERRAIN.pavement.c2;
const GUIA = shade(PISO_C, -.3);                 // meio-fio da trilha
const BRIDGE_C = '#b08a55', BRIDGE_G = '#5e4326';  // a path over water = a wooden bridge
const TRAIL_W = .56;                                // path width, as a fraction of a tile
/* whoever has the higher priority pushes fringes over its neighbour (paving is
   left out:
   a paved path has a straight edge) */
const FRANJA_PRIO = { water: 0, sand: 1, dirt: 2, rock: 3, snow: 4, grass: 5, woods: 6 };
const _eff = new Uint8Array(W * H);              // terreno "efetivo": trilha herda o entorno
/* replays tile i's c/c2 tone choice (the same seed as the base pass) */
const tileAlt = i => mulberry(i * 2654435761 >>> 0)() < .5;
const pavedAt = (x, y) => inB(x, y) && world.path[IDX(x, y)] === 1;
const pick2 = (r, a) => a[(r() * a.length) | 0];   // a deterministic pick

/** the terrain under a path = the commonest of the 8 neighbours (paths don't count) */
function underlayOf(x, y) {
  const cont = {};
  let best = T_GRAMA, bn = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (!inB(nx, ny)) continue;
    const t = world.terr[IDX(nx, ny)];
    if (t === T_PISO) continue;
    const v = (cont[t] || 0) + 1; cont[t] = v;
    if (v > bn) { bn = v; best = t; }
  }
  return best;
}

function buildTerrain() {
  if (!terrCv) {
    terrCv = document.createElement('canvas');
    terrCv.width = TCW; terrCv.height = TCH;
    terrCtx = terrCv.getContext('2d');
  }
  const c = terrCtx;
  c.clearRect(0, 0, TCW, TCH);
  c.lineJoin = 'round';
  for (let i = 0; i < W * H; i++) _eff[i] = world.terr[i];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = IDX(x, y);
    if (world.path[i]) _eff[i] = underlayOf(x, y);
  }
  const water = (x, y) => !inB(x, y) || _eff[IDX(x, y)] === T_WATER;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = IDX(x, y), tk = TKEYS[_eff[i]], T = TERRAIN[tk];
    // the tile's centre: w2s(x+.5, y+.5) — fences, buildings and animals use the
    // same convention; centring on w2s(x,y) left the terrain half a tile off them
    const sx = (x - y) * TW / 2 + TOFF_X, sy = (x + y + 1) * TH / 2 + 6;
    const r = mulberry(i * 2654435761 >>> 0);
    // diamante
    c.beginPath();
    c.moveTo(sx, sy - TH / 2); c.lineTo(sx + TW / 2, sy); c.lineTo(sx, sy + TH / 2); c.lineTo(sx - TW / 2, sy); c.closePath();
    const alt = r() < .5;
    const deep = tk === 'water' && water(x, y - 1) && water(x + 1, y) && water(x, y + 1) && water(x - 1, y);
    const baseColour = deep ? AGUA_FUNDA : alt ? T.c : TOM2[tk];
    c.fillStyle = baseColour;
    c.fill();
    // textura
    c.save(); c.clip();
    if (tk === 'grass' || tk === 'woods') {
      c.strokeStyle = shade(T.c, tk === 'woods' ? -.16 : .1); c.lineWidth = 1.6;
      for (let k = 0; k < (tk === 'woods' ? 6 : 4); k++) {
        const px = sx - 26 + r() * 52, py = sy - 12 + r() * 24;
        c.beginPath(); c.moveTo(px, py + 4); c.lineTo(px + (r() - .5) * 4, py - 3); c.stroke();
      }
      if (tk === 'woods') {                       // dossel: manchas de sombra
        c.fillStyle = 'rgba(20,40,16,.10)';
        for (let k = 0; k < 2; k++) { c.beginPath(); c.ellipse(sx - 18 + r() * 36, sy - 8 + r() * 16, 7 + r() * 5, 4 + r() * 3, r(), 0, TAU); c.fill(); }
      } else if (r() < .1) {                     // florzinha ocasional
        const px = sx - 20 + r() * 40, py = sy - 9 + r() * 18;
        c.fillStyle = pick2(r, ['#fff', '#ffd95e', '#f2a8c0', '#e8e6ff']);
        for (let p = 0; p < 4; p++) { const a = p / 4 * TAU + .6; c.beginPath(); c.arc(px + Math.cos(a) * 1.7, py + Math.sin(a) * 1.2, 1.25, 0, TAU); c.fill(); }
        c.fillStyle = '#e8a01c'; c.beginPath(); c.arc(px, py, 1, 0, TAU); c.fill();
      } else if (r() < .16) {                    // seixo
        c.fillStyle = 'rgba(90,95,80,.4)';
        c.beginPath(); c.ellipse(sx - 18 + r() * 36, sy - 8 + r() * 16, 2.2, 1.4, r(), 0, TAU); c.fill();
      }
    } else if (tk === 'water') {
      c.strokeStyle = 'rgba(255,255,255,.42)'; c.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const py = sy - 6 + k * 9 + r() * 3;
        c.beginPath(); c.moveTo(sx - 16, py); c.quadraticCurveTo(sx - 4, py - 3, sx + 6, py); c.stroke();
      }
      if (!deep && !world.path[i] && r() < .2) { // lily pads in the shallows
        const n = 1 + (r() < .35 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const px = sx - 13 + r() * 26, py = sy - 6 + r() * 12;
          const rf = 3.4 + r() * 2.2;
          c.fillStyle = '#4d9c46';
          c.beginPath(); c.ellipse(px, py, rf, rf * .55, 0, 0, TAU); c.fill();
          const a = r() * TAU;                   // recorte da folha
          c.fillStyle = baseColour;
          c.beginPath(); c.moveTo(px, py);
          c.lineTo(px + Math.cos(a) * rf * 1.2, py + Math.sin(a) * rf * .7);
          c.lineTo(px + Math.cos(a + .8) * rf * 1.2, py + Math.sin(a + .8) * rf * .7);
          c.closePath(); c.fill();
          if (r() < .3) { c.fillStyle = '#f2a8c0'; c.beginPath(); c.arc(px + 1, py - 1.4, 1.3, 0, TAU); c.fill(); }
        }
      }
    } else if (tk === 'sand') {
      c.fillStyle = shade(T.c, -.1);
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(sx - 24 + r() * 48, sy - 11 + r() * 22, 1.3, 0, TAU); c.fill(); }
    } else if (tk === 'rock') {
      c.fillStyle = shade(T.c, -.14);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(sx - 20 + r() * 40, sy - 8 + r() * 16, 5 + r() * 4, 3 + r() * 2, r(), 0, TAU); c.fill(); }
    } else if (tk === 'snow') {
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(sx - 22 + r() * 44, sy - 10 + r() * 20, 1.6 + r() * 2, 0, TAU); c.fill(); }
      if (r() < .3) {                            // a glint
        const px = sx - 16 + r() * 32, py = sy - 8 + r() * 16;
        c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(px - 2.6, py); c.lineTo(px + 2.6, py); c.moveTo(px, py - 2); c.lineTo(px, py + 2); c.stroke();
      }
    } else if (tk === 'pavement') {
      c.strokeStyle = 'rgba(120,100,70,.3)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(sx - TW / 2, sy); c.lineTo(sx, sy - TH / 2); c.moveTo(sx, sy + TH / 2); c.lineTo(sx + TW / 2, sy); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(sx - TW / 2 + 2, sy); c.lineTo(sx, sy - TH / 2 + 1); c.lineTo(sx + TW / 2 - 2, sy); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.1)';
      c.beginPath(); c.moveTo(sx - TW / 2 + 2, sy); c.lineTo(sx, sy + TH / 2 - 1); c.lineTo(sx + TW / 2 - 2, sy); c.stroke();
    } else if (tk === 'dirt') {
      c.fillStyle = shade(T.c, -.12);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(sx - 20 + r() * 40, sy - 8 + r() * 16, 4, 2, 0, 0, TAU); c.fill(); }
    }
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 1; c.stroke();
  }
  mapEmbankment(c);
  /* from here on the drawing is in WORLD coordinates (1 unit = 1 tile):
     the matrix projects to isometric and flattens strokes and ellipses in the
     right proportion — a circle becomes the ground's 2:1 ellipse for free */
  c.save();
  c.setTransform(TW / 2, TH / 2, -TW / 2, TH / 2, TOFF_X, 6);
  terrainFringes(c);
  drawPaths(c);
  medalhoesDePraca(c);
  shopDoors(c);
  enclosureWear(c);
  c.restore();
  G.dirty.terr = false;
}

/** a paved medallion at the centre of each plaza (a contiguous interior region) */
function medalhoesDePraca(c) {
  const interior = [], isInt = new Set();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!pavedAt(x, y)) continue;
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++)
      if (!pavedAt(x + dx, y + dy)) { ok = false; break; }
    if (ok) { interior.push(IDX(x, y)); isInt.add(IDX(x, y)); }
  }
  if (!interior.length) return;
  const visto = new Set();
  c.lineWidth = .05; c.strokeStyle = 'rgba(115,95,65,.4)'; c.fillStyle = 'rgba(115,95,65,.4)';
  for (const start of interior) {
    if (visto.has(start)) continue;
    let sx = 0, sy = 0, n = 0, best = start, dm = 1e9;
    const comp = [], q = [start]; visto.add(start);
    while (q.length) {
      const k = q.pop(); comp.push(k);
      sx += k % W + .5; sy += ((k / W) | 0) + .5; n++;
      for (const [dx, dy] of SIDES) {
        const j = IDX(k % W + dx, ((k / W) | 0) + dy);
        if (isInt.has(j) && !visto.has(j)) { visto.add(j); q.push(j); }
      }
    }
    let cx = sx / n, cy = sy / n;
    // in a concave plaza the centroid can fall outside: anchor on the nearest interior tile
    for (const k of comp) {
      const d = dist2(k % W + .5, ((k / W) | 0) + .5, cx, cy);
      if (d < dm) { dm = d; best = k; }
    }
    if (dm > .6) { cx = best % W + .5; cy = ((best / W) | 0) + .5; }
    c.beginPath(); c.arc(cx, cy, .55, 0, TAU); c.stroke();
    c.beginPath(); c.arc(cx, cy, .3, 0, TAU); c.stroke();
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + TAU / 8;
      c.beginPath(); c.arc(cx + Math.cos(a) * .43, cy + Math.sin(a) * .43, .05, 0, TAU); c.fill();
    }
  }
}

/** packed dirt under the enclosure equipment */
function enclosureWear(c) {
  for (const o of objects.values()) {
    if (o.cat !== 'encobj' || o.kind === 'pool' || o.kind === 'planting') continue;
    const r = mulberry(o.id * 2654435761 >>> 0);
    c.fillStyle = 'rgba(122,90,52,.18)';
    c.beginPath(); c.arc(o.x + .5, o.y + .5, .42 + r() * .12, 0, TAU); c.fill();
    c.fillStyle = 'rgba(122,90,52,.12)';
    c.beginPath(); c.arc(o.x + .5 + (r() - .5) * .5, o.y + .5 + (r() - .5) * .5, .3, 0, TAU); c.fill();
  }
}

/* ---- an embankment under the map's visible faces: the park becomes a plateau ---- */
function mapEmbankment(c) {
  const alt = 15;
  const L = [1, 6 + H * TH / 2], B = [TOFF_X, 6 + (W + H) * TH / 2], R = [TCW - 1, 6 + W * TH / 2];
  const r = mulberry(987654321);
  for (const [A, Z, tom] of [[L, B, -.12], [B, R, .04]]) {
    c.beginPath();
    c.moveTo(A[0], A[1]); c.lineTo(Z[0], Z[1]);
    c.lineTo(Z[0], Z[1] + alt); c.lineTo(A[0], A[1] + alt);
    c.closePath();
    c.fillStyle = shade('#8a6a42', tom); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.4; c.stroke();
    // striations and pebbles in the earth
    c.strokeStyle = 'rgba(60,42,22,.25)'; c.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) {
      const t = r();
      const px = A[0] + (Z[0] - A[0]) * t, py = A[1] + (Z[1] - A[1]) * t;
      c.beginPath(); c.moveTo(px, py + 2.5 + r() * 3); c.lineTo(px + (r() - .5) * 2.5, py + alt - 2.5 - r() * 4); c.stroke();
    }
    c.fillStyle = 'rgba(60,42,22,.3)';
    for (let i = 0; i < 26; i++) {
      const t = r();
      const px = A[0] + (Z[0] - A[0]) * t, py = A[1] + (Z[1] - A[1]) * t;
      c.beginPath(); c.ellipse(px, py + 4 + r() * (alt - 8), 1.8 + r() * 1.6, 1.2 + r(), 0, 0, TAU); c.fill();
    }
    // a line of grass leaning over the corner
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(A[0], A[1] + 1); c.lineTo(Z[0], Z[1] + 1); c.stroke();
  }
}

/* ---- organic fringes between terrains ---- */
function terrainFringes(c) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = IDX(x, y), a = _eff[i], ka = TKEYS[a];
    if (a === T_PISO) continue;
    const pa = FRANJA_PRIO[ka];
    for (let s = 0; s < 4; s++) {
      const [dx, dy] = SIDES[s];
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) continue;
      const j = IDX(nx, ny), b = _eff[j], kb = TKEYS[b];
      if (b === a || b === T_PISO || FRANJA_PRIO[kb] <= pa) continue;
      // a shared edge; the neighbour "invades" this tile with blobs
      const hor = dy !== 0;                        // N/S: aresta corre no eixo x
      const ex = dx === 1 ? x + 1 : x, ey = dy === 1 ? y + 1 : y;
      const r = mulberry((i * 4 + s) * 2246822519 >>> 0);
      const NB = TERRAIN[kb];
      c.fillStyle = tileAlt(j) ? NB.c : TOM2[kb];
      for (let k = 0; k < 3; k++) {
        const t = .2 + k * .3 + (r() - .5) * .12;
        const rl = .15 + r() * .12, rp = .07 + r() * .06;
        ellipse(c, hor ? ex + t : ex, hor ? ey : ey + t, hor ? rl : rp, hor ? rp : rl);
        c.fill();
      }
      if (a === T_WATER) {                          // foam at the shore, on the water side
        c.strokeStyle = 'rgba(255,255,255,.38)'; c.lineWidth = .05; c.lineCap = 'round';
        c.beginPath();
        if (hor) {
          const yy = ey - dy * .12;
          c.moveTo(ex + .1, yy);
          c.quadraticCurveTo(ex + .3, yy - dy * .06, ex + .5, yy);
          c.quadraticCurveTo(ex + .7, yy - dy * .06, ex + .9, yy);
        } else {
          const xx = ex - dx * .12;
          c.moveTo(xx, ey + .1);
          c.quadraticCurveTo(xx - dx * .06, ey + .3, xx, ey + .5);
          c.quadraticCurveTo(xx - dx * .06, ey + .7, xx, ey + .9);
        }
        c.stroke();
      }
    }
  }
}

/* ---- paths: a continuous band with curves ---- */
function pathLinks(x, y) {
  const con = [pavedAt(x, y - 1), pavedAt(x + 1, y), pavedAt(x, y + 1), pavedAt(x - 1, y)];
  if (x === ENTRANCE.x && y === ENTRANCE.y) con[2] = true;   // the path leaves through the gate
  return con;
}
/** a tile's outline: a curve at the turns, arms from the centre at the crossings */
function tracePath(c, x, y, con) {
  const cx = x + .5, cy = y + .5;
  const M = [[cx, y], [x + 1, cy], [cx, y + 1], [x, cy]];   // bocas N E S W
  if (x === ENTRANCE.x && y === ENTRANCE.y) M[2] = [cx, y + .7]; // para sob o tapete
  const n = con[0] + con[1] + con[2] + con[3];
  c.beginPath();
  if (n === 2 && !(con[0] && con[2]) && !(con[1] && con[3])) {
    const k = [0, 1, 2, 3].filter(k => con[k]);
    c.moveTo(M[k[0]][0], M[k[0]][1]);
    c.quadraticCurveTo(cx, cy, M[k[1]][0], M[k[1]][1]);
  } else if (n === 0) {
    c.moveTo(cx - .01, cy); c.lineTo(cx + .01, cy);         // bolota isolada
  } else {
    for (let k = 0; k < 4; k++) if (con[k]) { c.moveTo(cx, cy); c.lineTo(M[k][0], M[k][1]); }
  }
}
/** a plaza's inner corners: with the diagonal paved, it closes the quarter tile */
function cantosDePraca(c, x, y, con) {
  const cx = x + .5, cy = y + .5;
  for (const [a, b, kx, ky] of [[0, 1, x + 1, y], [1, 2, x + 1, y + 1], [2, 3, x, y + 1], [3, 0, x, y]]) {
    if (!con[a] || !con[b]) continue;
    if (!pavedAt(kx - (kx === x ? 1 : 0), ky - (ky === y ? 1 : 0))) continue;
    c.beginPath();
    c.moveTo(cx, cy); c.lineTo(kx, cy); c.lineTo(kx, ky); c.lineTo(cx, ky); c.closePath();
    c.fill();
  }
}
function pathDetails(c, x, y, con, bridge) {
  const cx = x + .5, cy = y + .5;
  const r = mulberry(IDX(x, y) * 1597334677 >>> 0);
  c.lineCap = 'butt';
  for (let k = 0; k < 4; k++) {
    if (!con[k]) continue;
    const [dx, dy] = SIDES[k];
    if (bridge) {                                  // planks laid across
      c.strokeStyle = 'rgba(80,55,28,.4)'; c.lineWidth = .035;
      for (const t of [.16, .34]) {
        const px = cx + dx * t, py = cy + dy * t;
        c.beginPath(); c.moveTo(px - dy * .24, py - dx * .24); c.lineTo(px + dy * .24, py + dx * .24); c.stroke();
      }
    } else {                                      // a paving joint
      c.strokeStyle = 'rgba(60,45,25,.12)'; c.lineWidth = .028;
      const t = .3 + r() * .1;
      const px = cx + dx * t, py = cy + dy * t;
      c.beginPath(); c.moveTo(px - dy * .2, py - dx * .2); c.lineTo(px + dy * .2, py + dx * .2); c.stroke();
    }
  }
  if (!bridge && r() < .3) {
    c.fillStyle = 'rgba(60,45,25,.1)';
    ellipse(c, cx + (r() - .5) * .3, cy + (r() - .5) * .3, .045, .03); c.fill();
  }
  c.lineCap = 'round';
}
/** a viewing esplanade: the pavement widens right up to the enclosure fence */
function mirante(c, x, y, dirs, folga) {
  for (const s of dirs) {
    let x0, y0, x1, y1;
    if (s === 0) { x0 = x - folga; x1 = x + 1 + folga; y0 = y + .08 - folga; y1 = y + .5; }
    else if (s === 2) { x0 = x - folga; x1 = x + 1 + folga; y0 = y + .5; y1 = y + .92 + folga; }
    else if (s === 3) { y0 = y - folga; y1 = y + 1 + folga; x0 = x + .08 - folga; x1 = x + .5; }
    else { y0 = y - folga; y1 = y + 1 + folga; x0 = x + .5; x1 = x + .92 + folga; }
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
}
function drawPaths(c) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  const encAo = (x, y) => inB(x, y) && world.enc[IDX(x, y)] > 0;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = IDX(x, y);
    if (!world.path[i]) continue;
    const mir = [];
    for (let s = 0; s < 4; s++) { const [dx, dy] = SIDES[s]; if (encAo(x + dx, y + dy)) mir.push(s); }
    tiles.push([x, y, pathLinks(x, y), _eff[i] === T_WATER, mir]);
  }
  // first the outline (the kerb) of them all, then the fill: the cores cover the
  // internal edges and the network becomes a continuous band
  for (const [x, y, con, bridge, mir] of tiles) {
    c.strokeStyle = bridge ? BRIDGE_G : GUIA; c.lineWidth = TRAIL_W + .1;
    tracePath(c, x, y, con); c.stroke();
    c.fillStyle = bridge ? BRIDGE_G : GUIA;
    cantosDePraca(c, x, y, con);
    if (mir.length) mirante(c, x, y, mir, .05);
  }
  for (const [x, y, con, bridge, mir] of tiles) {
    c.strokeStyle = bridge ? BRIDGE_C : tileAlt(IDX(x, y)) ? PISO_C : PISO_C2; c.lineWidth = TRAIL_W;
    tracePath(c, x, y, con); c.stroke();
    c.fillStyle = c.strokeStyle;
    cantosDePraca(c, x, y, con);
    if (mir.length) mirante(c, x, y, mir, 0);
  }
  for (const [x, y, con, bridge] of tiles) pathDetails(c, x, y, con, bridge);
}

/* ---- entrances: the pavement widens in a curve up to the door ---- */
function gateFlare(c, e1x, e1y, e2x, e2y, vx, vy, colour, guideColour) {
  // e1→e2 = the door's edge; (vx,vy) points from that edge into the path tile.
  // The fan starts at the band's EDGE (.5−WIDTH/2 from the door) and opens to the
  // door — anchoring it on the path's axis made the side kerb cross the whole band.
  const mx = (e1x + e2x) / 2, my = (e1y + e2y) / 2;
  const ux = e2x - e1x, uy = e2y - e1y;
  const edge = .5 - TRAIL_W / 2;
  const B1 = [mx - ux * .3 + vx * (edge + .06), my - uy * .3 + vy * (edge + .06)];
  const B2 = [mx + ux * .3 + vx * (edge + .06), my + uy * .3 + vy * (edge + .06)];
  const S1 = [mx - ux * .33 + vx * edge, my - uy * .33 + vy * edge];
  const S2 = [mx + ux * .33 + vx * edge, my + uy * .33 + vy * edge];
  const A1 = [e1x + ux * .07, e1y + uy * .07], A2 = [e2x - ux * .07, e2y - uy * .07];
  const Q1 = [mx - ux * .38 + vx * .08, my - uy * .38 + vy * .08];
  const Q2 = [mx + ux * .38 + vx * .08, my + uy * .38 + vy * .08];
  c.beginPath();
  c.moveTo(B1[0], B1[1]); c.lineTo(S1[0], S1[1]); c.quadraticCurveTo(Q1[0], Q1[1], A1[0], A1[1]);
  c.lineTo(A2[0], A2[1]); c.quadraticCurveTo(Q2[0], Q2[1], S2[0], S2[1]); c.lineTo(B2[0], B2[1]);
  c.closePath();
  c.fillStyle = colour; c.fill();
  c.strokeStyle = guideColour; c.lineWidth = .055; c.lineCap = 'round';
  c.beginPath(); c.moveTo(S1[0], S1[1]); c.quadraticCurveTo(Q1[0], Q1[1], A1[0], A1[1]); c.stroke();
  c.beginPath(); c.moveTo(S2[0], S2[1]); c.quadraticCurveTo(Q2[0], Q2[1], A2[0], A2[1]); c.stroke();
}
function doormat(c, mx, my, ux, uy, vx, vy, colour) {
  const cx = mx + vx * .12, cy = my + vy * .12;
  c.fillStyle = colour;
  c.beginPath();
  c.moveTo(cx - ux * .24 - vx * .06, cy - uy * .24 - vy * .06);
  c.lineTo(cx + ux * .24 - vx * .06, cy + uy * .24 - vy * .06);
  c.lineTo(cx + ux * .24 + vx * .06, cy + uy * .24 + vy * .06);
  c.lineTo(cx - ux * .24 + vx * .06, cy - uy * .24 + vy * .06);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = .022;
  c.beginPath(); c.moveTo(cx - ux * .16, cy - uy * .16); c.lineTo(cx + ux * .16, cy + uy * .16); c.stroke();
}
/** Door openings on the visible faces (S/E). An EVEN-width façade with both
 *  middle paths present gets a door centred on where the tiles meet — otherwise a
 *  2x2 shop's door sits off-centre. `c` is the opening's centre coordinate;
 *  `tiles` are the path tiles in front of it. */
function portaSpec(o) {
  const spec = { S: null, E: null };
  const Y = o.y + o.h, X = o.x + o.w;
  if (!(o.w & 1)) {
    const m = o.x + o.w / 2;
    if (pavedAt(m - 1, Y) && pavedAt(m, Y)) spec.S = { c: m, tiles: [m - 1, m] };
  }
  if (!spec.S) { const m = o.x + ((o.w - 1) >> 1); if (pavedAt(m, Y)) spec.S = { c: m + .5, tiles: [m] }; }
  if (!(o.h & 1)) {
    const m = o.y + o.h / 2;
    if (pavedAt(X, m - 1) && pavedAt(X, m)) spec.E = { c: m, tiles: [m - 1, m] };
  }
  if (!spec.E) { const m = o.y + ((o.h - 1) >> 1); if (pavedAt(X, m)) spec.E = { c: m + .5, tiles: [m] }; }
  return spec;
}
function shopDoors(c) {
  for (const o of objects.values()) {
    if (o.cat !== 'build' || o.kind === 'bin' || o.kind === 'bench' || o.kind === 'waterpoint') continue;
    const B = BUILDINGS[o.kind];
    const spec = portaSpec(o), Y = o.y + o.h, X = o.x + o.w;
    // only the S and E faces: they are the visible ones in isometric — behind, the roof covers
    if (spec.S) {
      const i = IDX(spec.S.tiles[0], Y);
      const bridge = _eff[i] === T_WATER;             // a path over water: a wooden deck
      gateFlare(c, spec.S.c - .5, Y, spec.S.c + .5, Y, 0, 1,
        bridge ? BRIDGE_C : tileAlt(i) ? PISO_C : PISO_C2, bridge ? BRIDGE_G : GUIA);
      doormat(c, spec.S.c, Y, 1, 0, 0, 1, shade(B.colour, -.18));
    }
    if (spec.E) {
      const i = IDX(X, spec.E.tiles[0]);
      const bridge = _eff[i] === T_WATER;
      gateFlare(c, X, spec.E.c - .5, X, spec.E.c + .5, 1, 0,
        bridge ? BRIDGE_C : tileAlt(i) ? PISO_C : PISO_C2, bridge ? BRIDGE_G : GUIA);
      doormat(c, X, spec.E.c, 0, 1, 1, 0, shade(B.colour, -.18));
    }
  }
  // the gate's red carpet
  const ex = ENTRANCE.x, ey = ENTRANCE.y + 1;
  c.fillStyle = '#c23b2c';
  c.beginPath();
  c.moveTo(ex + .22, ey - .68); c.lineTo(ex + .78, ey - .68);
  c.lineTo(ex + .9, ey - .01); c.lineTo(ex + .1, ey - .01);
  c.closePath(); c.fill();
  c.strokeStyle = '#8a2f22'; c.lineWidth = .045; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = .03;
  c.beginPath(); c.moveTo(ex + .28, ey - .5); c.lineTo(ex + .72, ey - .5);
  c.moveTo(ex + .26, ey - .38); c.lineTo(ex + .74, ey - .38); c.stroke();
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
function badgeQueue(c, o, z, sx, sy) {
  if (!o.queue || !o.queue.length) return;
  c.font = Math.max(8, 10 * z) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#fff'; c.strokeStyle = '#2f2113'; c.lineWidth = 3;
  c.strokeText('👥' + o.queue.length, sx, sy); c.fillText('👥' + o.queue.length, sx, sy);
}
/* furniture actually drawn (a box with an emoji doesn't do it justice) */
function drawBanco(c, o, z) {
  const P = (ax, ay) => [w2sx(o.x + ax, o.y + ay), w2sy(o.x + ax, o.y + ay)];
  const s = z, sh = P(.5, .5);
  ellipse(c, sh[0], sh[1] + 2 * s, 14 * s, 6 * s); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
  const up = 7 * s, top = 16 * s;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = '#4a3520'; c.lineWidth = 3 * s;
  for (const [ax, ay] of [[.22, .52], [.78, .52]]) {
    const p = P(ax, ay);
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] - up); c.stroke();
  }
  const e1 = P(.14, .38), e2 = P(.86, .38);
  c.lineWidth = 2.6 * s;
  c.beginPath(); c.moveTo(e1[0], e1[1] - up); c.lineTo(e1[0], e1[1] - top);
  c.moveTo(e2[0], e2[1] - up); c.lineTo(e2[0], e2[1] - top); c.stroke();
  isoPoly(c, [[e1[0], e1[1] - top + 5.5 * s], [e2[0], e2[1] - top + 5.5 * s], [e2[0], e2[1] - top], [e1[0], e1[1] - top]]);
  c.fillStyle = '#b98a55'; c.fill(); c.lineWidth = 2 * s; c.stroke();
  const A = P(.14, .36), Bq = P(.86, .36), Cq = P(.86, .68), D = P(.14, .68);
  isoPoly(c, [[A[0], A[1] - up], [Bq[0], Bq[1] - up], [Cq[0], Cq[1] - up], [D[0], D[1] - up]]);
  c.fillStyle = '#c9a06a'; c.fill(); c.stroke();
  c.strokeStyle = 'rgba(74,53,32,.45)'; c.lineWidth = 1.2 * s;
  for (const tt of [.4, .62]) {
    c.beginPath();
    c.moveTo(A[0] + (D[0] - A[0]) * tt, A[1] - up + (D[1] - A[1]) * tt);
    c.lineTo(Bq[0] + (Cq[0] - Bq[0]) * tt, Bq[1] - up + (Cq[1] - Bq[1]) * tt);
    c.stroke();
  }
  badgeQueue(c, o, z, sh[0], sh[1] - 26 * s);
}
function drawBin(c, o, z) {
  const p = [w2sx(o.x + .5, o.y + .5), w2sy(o.x + .5, o.y + .5)], s = z;
  ellipse(c, p[0], p[1] + s, 8 * s, 4 * s); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
  c.fillStyle = '#5e6a76'; c.strokeStyle = '#39424c'; c.lineWidth = 2 * s; c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(p[0] - 6 * s, p[1] - 15 * s); c.lineTo(p[0] - 5 * s, p[1] - s);
  c.quadraticCurveTo(p[0], p[1] + 2.5 * s, p[0] + 5 * s, p[1] - s);
  c.lineTo(p[0] + 6 * s, p[1] - 15 * s);
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2 * s;
  c.beginPath(); c.moveTo(p[0] - 5 * s, p[1] - 9 * s); c.quadraticCurveTo(p[0], p[1] - 7.5 * s, p[0] + 5 * s, p[1] - 9 * s); c.stroke();
  ellipse(c, p[0], p[1] - 15 * s, 6.4 * s, 3 * s); c.fillStyle = '#39424c'; c.fill();
  ellipse(c, p[0], p[1] - 16 * s, 4.6 * s, 2.1 * s); c.fillStyle = '#4a545e'; c.fill();
  c.strokeStyle = '#39424c'; c.lineWidth = 1.4 * s; c.stroke();
}
function drawBebedouroPub(c, o, z) {
  const p = [w2sx(o.x + .5, o.y + .5), w2sy(o.x + .5, o.y + .5)], s = z;
  ellipse(c, p[0], p[1] + s, 8 * s, 4 * s); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
  c.fillStyle = '#8fa3ad'; c.strokeStyle = '#5a6b74'; c.lineWidth = 2 * s; c.lineJoin = 'round';
  roundRectP(c, p[0] - 3.4 * s, p[1] - 13 * s, 6.8 * s, 13 * s, 2 * s); c.fill(); c.stroke();
  ellipse(c, p[0], p[1] - 13 * s, 7 * s, 3.4 * s); c.fillStyle = '#c9d4da'; c.fill(); c.stroke();
  ellipse(c, p[0], p[1] - 13 * s, 5 * s, 2.2 * s); c.fillStyle = '#4fa8db'; c.fill();
  const h = Math.abs(Math.sin(_now / 400)) * 1.4 * s;
  c.strokeStyle = 'rgba(170,225,250,.95)'; c.lineWidth = 1.5 * s;
  c.beginPath(); c.moveTo(p[0] + 2 * s, p[1] - 14 * s);
  c.quadraticCurveTo(p[0], p[1] - 18 * s - h, p[0] - 2 * s, p[1] - 14 * s); c.stroke();
  badgeQueue(c, o, z, p[0], p[1] - 24 * s);
}
function drawPlayground(c, o, z) {
  const P = (ax, ay) => [w2sx(o.x + ax, o.y + ay), w2sy(o.x + ax, o.y + ay)];
  const s = z;
  // areinha de amortecimento
  isoPoly(c, [P(.12, .12), P(2.88, .12), P(2.88, 2.88), P(.12, 2.88)]);
  c.fillStyle = '#ecd9a8'; c.fill();
  c.strokeStyle = 'rgba(120,100,70,.35)'; c.lineWidth = 2 * s; c.stroke();
  // a tower with a slide
  drawIsoBox(c, o.x + .35, o.y + .45, .75, .75, 17, '#e2543f', shade('#e2543f', .26), z);
  const R1 = P(1.1, .55), R2 = P(1.1, 1.1), G1 = P(2.1, .75), G2 = P(2.1, 1.2);
  isoPoly(c, [[R1[0], R1[1] - 15 * s], [R2[0], R2[1] - 15 * s], [G2[0], G2[1]], [G1[0], G1[1]]]);
  c.fillStyle = '#3fa5e2'; c.fill();
  c.strokeStyle = '#20618c'; c.lineWidth = 2 * s; c.lineJoin = 'round'; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.4 * s;
  c.beginPath();
  c.moveTo((R1[0] + R2[0]) / 2, (R1[1] + R2[1]) / 2 - 15 * s);
  c.lineTo((G1[0] + G2[0]) / 2, (G1[1] + G2[1]) / 2); c.stroke();
  // a swing: a frame + two seats swinging
  const E1 = P(.75, 2.35), E2 = P(2.3, 2.35), gauge = 26 * s;
  c.strokeStyle = '#8a5a2b'; c.lineCap = 'round'; c.lineWidth = 3 * s;
  for (const [ex, ey] of [[.75, 2.35], [2.3, 2.35]]) {
    const T = P(ex, ey);
    const p1 = P(ex - .02, ey - .24), p2 = P(ex + .02, ey + .24);
    c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(T[0], T[1] - gauge); c.lineTo(p2[0], p2[1]); c.stroke();
  }
  c.lineWidth = 3.2 * s;
  c.beginPath(); c.moveTo(E1[0], E1[1] - gauge); c.lineTo(E2[0], E2[1] - gauge); c.stroke();
  for (let k = 0; k < 2; k++) {
    const t = k ? .68 : .32;
    const bx = E1[0] + (E2[0] - E1[0]) * t, by = E1[1] + (E2[1] - E1[1]) * t - gauge;
    const ang = Math.sin(_now / 680 + k * 2.4) * .38;
    const sx2 = bx + Math.sin(ang) * 15 * s, sy2 = by + Math.cos(ang) * 15 * s;
    c.strokeStyle = '#5a6b74'; c.lineWidth = 1.2 * s;
    c.beginPath(); c.moveTo(bx - 2.5 * s, by); c.lineTo(sx2 - 2.5 * s, sy2);
    c.moveTo(bx + 2.5 * s, by); c.lineTo(sx2 + 2.5 * s, sy2); c.stroke();
    c.strokeStyle = '#6b4420'; c.lineWidth = 2.8 * s;
    c.beginPath(); c.moveTo(sx2 - 3.5 * s, sy2); c.lineTo(sx2 + 3.5 * s, sy2); c.stroke();
  }
  const cM = P(1.5, 1.5);
  badgeQueue(c, o, z, cM[0], cM[1] - 44 * s);
}
function drawBuilding(c, o, z) {
  const B = BUILDINGS[o.kind];
  if (o.kind === 'bench') return drawBanco(c, o, z);
  if (o.kind === 'bin') return drawBin(c, o, z);
  if (o.kind === 'waterpoint') return drawBebedouroPub(c, o, z);
  if (o.kind === 'playground') return drawPlayground(c, o, z);
  const hgt = o.kind === 'popcorn' ? 22 : 30 + (o.h > 2 ? 8 : 0);
  const g = drawIsoBox(c, o.x, o.y, o.w, o.h, hgt, B.colour, shade(B.colour, .26), z);
  const decorado = o.kind !== 'bin' && o.kind !== 'bench';
  const spec = decorado ? portaSpec(o) : { S: null, E: null };
  const aceso = G.hour < 6.5 || G.hour > 18;
  // windows on the visible faces (they light up at night)
  if (hgt >= 24 && decorado) {
    const wLo = g.up * .32, wHi = g.up * .58;
    const winFill = aceso ? '#ffdf8f' : shade(B.colour, -.36);
    const janela = (ax, ay, bx, by) => {
      const A = [w2sx(ax, ay), w2sy(ax, ay)], D = [w2sx(bx, by), w2sy(bx, by)];
      isoPoly(c, [[A[0], A[1] - wLo], [D[0], D[1] - wLo], [D[0], D[1] - wHi], [A[0], A[1] - wHi]]);
      c.fillStyle = winFill; c.fill();
      c.strokeStyle = shade(B.colour, -.55); c.lineWidth = 1.3 * z; c.stroke();
    };
    for (let t = 0; t < o.w; t++) {
      const tx = o.x + t;
      if (spec.S && spec.S.tiles.includes(tx)) {              // a porta fica aqui:
        if (spec.S.tiles.length === 2)                        // janelinhas ladeando
          janela(tx + (tx === spec.S.tiles[0] ? .16 : .5), o.y + o.h,
            tx + (tx === spec.S.tiles[0] ? .5 : .84), o.y + o.h);
        continue;
      }
      janela(tx + .3, o.y + o.h, tx + .7, o.y + o.h);
    }
    for (let t = 0; t < o.h; t++) {
      const ty = o.y + t;
      if (spec.E && spec.E.tiles.includes(ty)) {
        if (spec.E.tiles.length === 2)
          janela(o.x + o.w, ty + (ty === spec.E.tiles[0] ? .16 : .5),
            o.x + o.w, ty + (ty === spec.E.tiles[0] ? .5 : .84));
        continue;
      }
      janela(o.x + o.w, ty + .3, o.x + o.w, ty + .7);
    }
  }
  // a door on the face giving onto the path (only the visible S and E faces)
  if (decorado) {
    const pAlt = Math.min(16 * z, hgt * z * .68);
    const porta = (ax, ay, bx, by) => {
      const A = [w2sx(ax, ay), w2sy(ax, ay)], D = [w2sx(bx, by), w2sy(bx, by)];
      isoPoly(c, [A, D, [D[0], D[1] - pAlt], [A[0], A[1] - pAlt]]);
      c.fillStyle = shade(B.colour, -.48); c.fill();
      c.strokeStyle = shade(B.colour, -.62); c.lineWidth = 1.6 * z; c.stroke();
    };
    if (spec.S) porta(spec.S.c - .22, o.y + o.h, spec.S.c + .22, o.y + o.h);
    if (spec.E) porta(o.x + o.w, spec.E.c - .22, o.x + o.w, spec.E.c + .22);
  }
  // a striped awning on the shops, on both front faces
  if (B.value > 0 && hgt > 20) {
    const toldoFace = (P, Q) => {
      c.save();
      isoPoly(c, [[P[0], P[1] - g.up], [Q[0], Q[1] - g.up], [Q[0], Q[1] - g.up + 10 * z], [P[0], P[1] - g.up + 10 * z]]);
      c.clip(); c.fillStyle = '#f6f3ea'; c.fill();
      c.fillStyle = mixc(B.colour, '#ffffff', .35);
      const n = Math.max(4, Math.round(Math.hypot(Q[0] - P[0], Q[1] - P[1]) / (9 * z)) & ~1);
      for (let i = 0; i < n; i += 2) {
        const t0 = i / n, t1 = (i + 1) / n;
        const ax = P[0] + (Q[0] - P[0]) * t0, ay = P[1] + (Q[1] - P[1]) * t0 - g.up;
        const bx = P[0] + (Q[0] - P[0]) * t1, by = P[1] + (Q[1] - P[1]) * t1 - g.up;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by);
        c.lineTo(bx, by + 10 * z); c.lineTo(ax, ay + 10 * z); c.closePath(); c.fill();
      }
      c.restore();
      c.strokeStyle = shade(B.colour, -.4); c.lineWidth = 1.5 * z;
      c.beginPath(); c.moveTo(P[0], P[1] - g.up + 10 * z); c.lineTo(Q[0], Q[1] - g.up + 10 * z); c.stroke();
    };
    toldoFace(g.R, g.B); toldoFace(g.L, g.B);
  }
  // the roof's overhang (the eaves) on top of everything
  if (hgt >= 20) {
    const e = .08;
    const ro = [[o.x - e, o.y - e], [o.x + o.w + e, o.y - e], [o.x + o.w + e, o.y + o.h + e], [o.x - e, o.y + o.h + e]]
      .map(p => [w2sx(p[0], p[1]), w2sy(p[0], p[1]) - g.up]);
    c.lineWidth = Math.max(1.2, 2.4 * z); c.strokeStyle = shade(B.colour, -.55); c.lineJoin = 'round';
    isoPoly(c, ro); c.fillStyle = shade(B.colour, .26); c.fill(); c.stroke();
    const ri = [[o.x + .18, o.y + .18], [o.x + o.w - .18, o.y + .18], [o.x + o.w - .18, o.y + o.h - .18], [o.x + .18, o.y + o.h - .18]]
      .map(p => [w2sx(p[0], p[1]), w2sy(p[0], p[1]) - g.up]);
    isoPoly(c, ri); c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1.5 * z; c.stroke();
  }
  // a chimney with smoke on the kitchens
  if (B.supplies === 'hunger' && o.kind !== 'icecream' && hgt >= 22) {
    const px = w2sx(o.x + .36, o.y + .36), py = w2sy(o.x + .36, o.y + .36) - g.up;
    c.fillStyle = shade(B.colour, -.28); c.strokeStyle = shade(B.colour, -.58); c.lineWidth = 1.4 * z;
    roundRectP(c, px - 3 * z, py - 10 * z, 6 * z, 11 * z, 1.6 * z); c.fill(); c.stroke();
    c.fillStyle = shade(B.colour, -.45);
    roundRectP(c, px - 3.8 * z, py - 11.6 * z, 7.6 * z, 2.6 * z, 1.2 * z); c.fill();
    if (z > .45) {
      for (let kf = 0; kf < 3; kf++) {
        const t = (_now / 1500 + kf / 3 + (o.id % 10) * .1) % 1;
        c.globalAlpha = (1 - t) * .25;
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(px + Math.sin(t * 5 + o.id) * 2.6 * z, py - 12 * z - t * 20 * z, (2 + t * 3.4) * z, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  }
  // a sign with an emoji
  const cx = (g.T[0] + g.B[0]) / 2, cy = (g.T[1] + g.B[1]) / 2 - g.up - 6 * z;
  const fs = Math.max(9, 17 * z * Math.min(1.4, o.w * .6 + .5));
  c.font = fs + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(B.em, cx, cy - fs * .1);
  // fila
  if (o.queue.length) {
    c.font = Math.max(8, 10 * z) + 'px system-ui'; c.fillStyle = '#fff';
    c.strokeStyle = '#2f2113'; c.lineWidth = 3;
    const tx = cx, ty = g.T[1] - g.up - 12 * z;
    c.strokeText('👥' + o.queue.length, tx, ty); c.fillText('👥' + o.queue.length, tx, ty);
  }
}
function drawDeco(c, o, z) {
  const sx = w2sx(o.x + .5, o.y + .5), sy = w2sy(o.x + .5, o.y + .5);
  const k = o.kind, s = z;
  c.lineJoin = 'round'; c.lineCap = 'round';
  ellipse(c, sx, sy + 2 * z, 15 * z, 7 * z); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
  const ik = '#2f3a20';
  if (k === 'tree' || k === 'pine' || k === 'palm') {
    c.strokeStyle = '#6b4420'; c.lineWidth = 7 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (k === 'palm' ? 5 * s : 0), sy - 30 * s); c.stroke();
    if (k === 'pine') {
      c.fillStyle = '#3c7a34'; c.strokeStyle = '#285424'; c.lineWidth = 2.4 * s;
      for (let i = 0; i < 3; i++) {
        const yy = sy - 22 * s - i * 13 * s, ww = (20 - i * 4) * s;
        c.beginPath(); c.moveTo(sx - ww, yy); c.lineTo(sx, yy - 20 * s); c.lineTo(sx + ww, yy); c.closePath(); c.fill(); c.stroke();
      }
    } else if (k === 'palm') {
      const sw = Math.sin(_now / 1500 + o.id * 1.7) * 1.6 * s;   // brisa
      c.strokeStyle = '#2f7a4a'; c.lineWidth = 5 * s;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * .1 - i / 5 * Math.PI * .8;
        c.beginPath(); c.moveTo(sx + 5 * s, sy - 30 * s);
        c.quadraticCurveTo(sx + 5 * s + Math.cos(a) * 20 * s + sw, sy - 40 * s + Math.sin(a) * 12 * s,
          sx + 5 * s + Math.cos(a) * 30 * s + sw * 1.6, sy - 28 * s + Math.sin(a) * 8 * s);
        c.stroke();
      }
      c.fillStyle = '#c9862c'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sx + 3 * s + i * 4 * s, sy - 28 * s, 3 * s, 0, TAU); c.fill(); }
    } else {
      const sw = Math.sin(_now / 1500 + o.id * 1.7) * 1.4 * s;   // brisa
      c.strokeStyle = ik; c.lineWidth = 3 * s;
      const blobs = [[0, -40, 19], [-14, -32, 14], [14, -32, 14], [0, -52, 13]];
      c.beginPath(); for (const [dx, dy, r] of blobs) {
        const bx = sx + dx * s + sw * (-dy - 28) / 24;           // the top sways more
        c.moveTo(bx + r * s, sy + dy * s); c.arc(bx, sy + dy * s, r * s, 0, TAU);
      }
      c.fillStyle = '#4c9a3f'; c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.2)';
      c.beginPath(); c.arc(sx - 7 * s + sw, sy - 48 * s, 7 * s, 0, TAU); c.fill();
    }
  } else if (k === 'bush') {
    c.strokeStyle = ik; c.lineWidth = 2.6 * s; c.fillStyle = '#4c9a3f';
    c.beginPath();
    for (const [dx, dy, r] of [[0, -10, 12], [-9, -6, 9], [9, -6, 9]]) { c.moveTo(sx + dx * s + r * s, sy + dy * s); c.arc(sx + dx * s, sy + dy * s, r * s, 0, TAU); }
    c.fill(); c.stroke();
  } else if (k === 'flowers') {
    c.fillStyle = '#4c9a3f'; ellipse(c, sx, sy - 3 * s, 16 * s, 8 * s); c.fill();
    const r2 = mulberry(o.id * 77);
    for (let i = 0; i < 7; i++) {
      const px = sx + (r2() - .5) * 28 * s, py = sy - 4 * s - r2() * 8 * s;
      c.fillStyle = ['#e2543f', '#ffc23c', '#f28ab0', '#9a6ad4', '#fff'][i % 5];
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; c.beginPath(); c.arc(px + Math.cos(a) * 2.6 * s, py + Math.sin(a) * 2.6 * s, 2.1 * s, 0, TAU); c.fill(); }
      c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(px, py, 1.6 * s, 0, TAU); c.fill();
    }
    if (s > .5 && !(G.hour < 6.5 || G.hour > 19)) { // borboleta rondando o canteiro
      const t = _now / 1000 + o.id * 2.3;
      const bx = sx + Math.cos(t * 1.1) * 15 * s, by = sy - 15 * s - Math.sin(t * 1.9) * 6 * s;
      const wing = Math.abs(Math.sin(t * 14)) * .8 + .2;
      c.fillStyle = ['#e8a01c', '#7ab4e0', '#e2749f'][o.id % 3];
      ellipse(c, bx - 2 * s * wing, by, 2.2 * s * wing, 1.5 * s, .5); c.fill();
      ellipse(c, bx + 2 * s * wing, by, 2.2 * s * wing, 1.5 * s, -.5); c.fill();
      c.fillStyle = '#3a2d20'; ellipse(c, bx, by, .8 * s, 1.6 * s); c.fill();
    } else if (s > .5) {                            // a firefly at night
      const t = _now / 1400 + o.id;
      const fx = sx + Math.cos(t * .9) * 16 * s, fy = sy - 12 * s - Math.sin(t * 1.7) * 8 * s;
      const puls = .4 + .6 * Math.abs(Math.sin(_now / 480 + o.id));
      c.globalAlpha = puls * .9;
      c.fillStyle = '#e4f78e';
      c.beginPath(); c.arc(fx, fy, 1.7 * s, 0, TAU); c.fill();
      c.globalAlpha = puls * .3;
      c.beginPath(); c.arc(fx, fy, 5.5 * s, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
  } else if (k === 'stone') {
    c.strokeStyle = '#5e5b56'; c.lineWidth = 2.6 * s; c.fillStyle = '#9b9a94';
    c.beginPath(); c.moveTo(sx - 15 * s, sy); c.lineTo(sx - 9 * s, sy - 15 * s); c.lineTo(sx + 5 * s, sy - 17 * s);
    c.lineTo(sx + 15 * s, sy - 4 * s); c.lineTo(sx + 8 * s, sy + 2 * s); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(sx - 8 * s, sy - 14 * s); c.lineTo(sx + 4 * s, sy - 16 * s); c.lineTo(sx, sy - 8 * s); c.closePath(); c.fill();
  } else if (k === 'fountain') {
    c.strokeStyle = '#8a8781'; c.lineWidth = 3 * s;
    ellipse(c, sx, sy - 4 * s, 22 * s, 11 * s); c.fillStyle = '#c9c4bc'; c.fill(); c.stroke();
    ellipse(c, sx, sy - 4 * s, 16 * s, 7.5 * s); c.fillStyle = '#4fa8db'; c.fill();
    c.strokeStyle = '#8a8781'; ellipse(c, sx, sy - 12 * s, 6 * s, 3 * s); c.fillStyle = '#c9c4bc'; c.fill(); c.stroke();
    c.strokeStyle = 'rgba(160,220,245,.9)'; c.lineWidth = 2.4 * s;
    for (const d of [-1, 1]) {
      const sw = Math.sin(_now / 300 + d * 1.3) * 1.5 * s;   // the jet swaying
      c.beginPath(); c.moveTo(sx, sy - 16 * s);
      c.quadraticCurveTo(sx + d * 12 * s + sw, sy - 26 * s, sx + d * 15 * s + sw, sy - 6 * s);
      c.stroke();
      for (let kd = 0; kd < 2; kd++) {                       // gotas caindo
        const t = (_now / 620 + kd / 2 + (d + 1) / 4) % 1;
        const qx = lerp(lerp(sx, sx + d * 12 * s + sw, t), lerp(sx + d * 12 * s + sw, sx + d * 15 * s + sw, t), t);
        const qy = lerp(lerp(sy - 16 * s, sy - 26 * s, t), lerp(sy - 26 * s, sy - 6 * s, t), t);
        c.globalAlpha = 1 - t * .7;
        c.fillStyle = '#cfeafa'; c.beginPath(); c.arc(qx, qy, 1.3 * s, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    }
  } else if (k === 'statue') {
    c.strokeStyle = '#6a6762'; c.lineWidth = 2.6 * s; c.fillStyle = '#b5b0a6';
    isoPoly(c, [[sx - 14 * s, sy], [sx, sy - 7 * s], [sx + 14 * s, sy], [sx, sy + 7 * s]]); c.fill(); c.stroke();
    c.fillStyle = '#c9c4bc'; roundRectP(c, sx - 7 * s, sy - 34 * s, 14 * s, 28 * s, 4 * s); c.fill(); c.stroke();
    c.beginPath(); c.arc(sx, sy - 40 * s, 8 * s, 0, TAU); c.fill(); c.stroke();
  } else if (k === 'lamp') {
    c.strokeStyle = '#4a4640'; c.lineWidth = 4 * s;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 38 * s); c.stroke();
    c.fillStyle = G.hour < 7 || G.hour > 18 ? '#ffe08a' : '#d9d2c2';
    c.beginPath(); c.arc(sx, sy - 42 * s, 6.5 * s, 0, TAU); c.fill(); c.stroke();
    if (G.hour < 7 || G.hour > 18) { c.fillStyle = 'rgba(255,224,138,.18)'; c.beginPath(); c.arc(sx, sy - 42 * s, 26 * s, 0, TAU); c.fill(); }
  } else if (k === 'sign') {
    c.strokeStyle = '#6b4420'; c.lineWidth = 3.4 * s;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 18 * s); c.stroke();
    c.fillStyle = '#d9b878'; roundRectP(c, sx - 12 * s, sy - 32 * s, 24 * s, 16 * s, 3 * s); c.fill(); c.stroke();
  }
}
/** an isometric basin with a wall: the base of the troughs (feeder/water) */
function baciaIso(c, sx, sy, rx, ry, alt, wallColour, edgeColour, bgColour, s) {
  // the side wall: the bottom half of the rim, extruded to the ground
  c.fillStyle = wallColour; c.strokeStyle = shade(wallColour, -.5); c.lineWidth = 2.4 * s;
  c.beginPath();
  c.moveTo(sx - rx, sy - alt);
  c.lineTo(sx - rx, sy);
  c.ellipse(sx, sy, rx, ry, 0, Math.PI, 0, true);   // the lower arc, on the ground
  c.lineTo(sx + rx, sy - alt);
  c.ellipse(sx, sy - alt, rx, ry, 0, 0, Math.PI);   // volta pela boca
  c.closePath(); c.fill(); c.stroke();
  // boca
  ellipse(c, sx, sy - alt, rx, ry); c.fillStyle = edgeColour; c.fill(); c.stroke();
  ellipse(c, sx, sy - alt, rx * .78, ry * .72); c.fillStyle = bgColour; c.fill();
}
function drawEncObj(c, o, z) {
  const sx = w2sx(o.x + .5, o.y + .5), sy = w2sy(o.x + .5, o.y + .5), s = z;
  const e = enclosures.get(o.encId);
  if (o.kind !== 'toy') {                     // the ball casts its own shadow
    ellipse(c, sx, sy + 2 * s, 13 * s, 6 * s); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
  }
  c.lineWidth = 2.6 * s; c.lineJoin = 'round'; c.lineCap = 'round';
  if (o.kind === 'feeder') {
    // a wooden trough; the feed goes from green (full) to red (running out)
    baciaIso(c, sx, sy - 2 * s, 13 * s, 6.5 * s, 7 * s, '#8a6a45', '#a87f52', '#54432c', s);
    const nivel = e ? e.food : 1;
    if (nivel > .05) {
      c.fillStyle = mixc('#c94a2a', '#7ac44a', nivel);
      ellipse(c, sx, sy - 9.5 * s - nivel * 1.5 * s, 9.5 * s, 4.2 * s); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 0; i < 4; i++) {
        const rr = mulberry(o.id * 31 + i);
        c.beginPath(); c.arc(sx - 6 * s + rr() * 12 * s, sy - 10 * s + rr() * 3 * s, 1.1 * s, 0, TAU); c.fill();
      }
    }
  } else if (o.kind === 'trough') {
    baciaIso(c, sx, sy - 2 * s, 12.5 * s, 6 * s, 6 * s, '#8b8a84', '#9b9a94', '#4a4e55', s);
    const nivel = e ? e.water : 1;
    if (nivel > .05) {
      c.fillStyle = '#4fa8db';
      ellipse(c, sx, sy - 8.5 * s - nivel * 1.2 * s, 9 * s, 4 * s); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4 * s;
      const g = Math.sin(_now / 700 + o.id) * 2 * s;
      c.beginPath(); c.moveTo(sx - 4 * s + g, sy - 9.5 * s); c.quadraticCurveTo(sx + g, sy - 11 * s, sx + 4 * s + g, sy - 9.5 * s); c.stroke();
    }
  } else if (o.kind === 'shelter') {
    // a hut: wooden walls, a gabled thatch roof and a dark door
    const P = (ax, ay) => [w2sx(o.x + ax, o.y + ay), w2sy(o.x + ax, o.y + ay)];
    const A = P(.08, .08), B = P(.92, .08), C = P(.92, .92), D = P(.08, .92);
    const up = 15 * s, ap = 30 * s;
    const cx2 = (A[0] + C[0]) / 2, cy2 = (A[1] + C[1]) / 2;
    c.strokeStyle = '#4a3520'; c.lineWidth = 2.2 * s;
    // the visible walls (S and E)
    isoPoly(c, [D, C, [C[0], C[1] - up], [D[0], D[1] - up]]); c.fillStyle = '#8a6a45'; c.fill(); c.stroke();
    isoPoly(c, [B, C, [C[0], C[1] - up], [B[0], B[1] - up]]); c.fillStyle = '#a87f52'; c.fill(); c.stroke();
    // a door on the S face
    const dm = P(.5, .92);
    c.fillStyle = '#3a2a18';
    c.beginPath(); c.moveTo(dm[0] - 4 * s, dm[1]); c.lineTo(dm[0] - 4 * s, dm[1] - 8.5 * s);
    c.quadraticCurveTo(dm[0], dm[1] - 12 * s, dm[0] + 4 * s, dm[1] - 8.5 * s); c.lineTo(dm[0] + 4 * s, dm[1]);
    c.closePath(); c.fill();
    // a pyramidal thatch roof with a short eave (a long one swallowed the walls)
    const top = [cx2, cy2 - ap];
    const beiral = .07;
    const A2 = P(-beiral, -beiral), B2 = P(1 + beiral, -beiral), C2 = P(1 + beiral, 1 + beiral), D2 = P(-beiral, 1 + beiral);
    c.strokeStyle = '#4a3520';
    c.beginPath(); c.moveTo(D2[0], D2[1] - up); c.lineTo(C2[0], C2[1] - up); c.lineTo(top[0], top[1]); c.closePath();
    c.fillStyle = '#c9a558'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(B2[0], B2[1] - up); c.lineTo(C2[0], C2[1] - up); c.lineTo(top[0], top[1]); c.closePath();
    c.fillStyle = '#b8924a'; c.fill(); c.stroke();
    // wisps of thatch
    c.strokeStyle = 'rgba(74,53,32,.4)'; c.lineWidth = 1.2 * s;
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      c.beginPath();
      c.moveTo(D2[0] + (C2[0] - D2[0]) * t, D2[1] - up + (C2[1] - D2[1]) * t);
      c.lineTo(top[0] + (D2[0] + (C2[0] - D2[0]) * t - top[0]) * .25, top[1] + (D2[1] - up + (C2[1] - D2[1]) * t - top[1]) * .25);
      c.stroke();
    }
  } else if (o.kind === 'toy') {
    // a play ball; it goes frantic when an animal comes to play with it
    const near = e && e.animals.some(a2 =>
      !a2.dead && a2.state === 'playing' && dist2(a2.x, a2.y, o.x + .5, o.y + .5) < 2.9);
    const q = Math.abs(Math.sin(_now / (near ? 210 : 420) + o.id * 1.3));
    const rol = near ? Math.sin(_now / 330 + o.id) * 6 * s : 0;
    const bx = sx + rol;
    const by = sy - 8.5 * s - q * (near ? 9 : 5) * s;
    ellipse(c, bx, sy, (7 - q * 1.6) * s, (3.4 - q * .8) * s);   // its own shadow
    c.fillStyle = 'rgba(0,0,0,.14)'; c.fill();
    c.fillStyle = '#ffc23c'; c.strokeStyle = '#8a5a1c'; c.lineWidth = 2.4 * s;
    c.beginPath(); c.arc(bx, by, 8 * s, 0, TAU); c.fill(); c.stroke();
    c.save();
    c.beginPath(); c.arc(bx, by, 8 * s, 0, TAU); c.clip();
    c.fillStyle = '#e2543f';
    c.beginPath(); c.ellipse(bx, by + 1.5 * s, 9.5 * s, 3.4 * s, rol * .04 - .18, 0, TAU); c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.65)';
    c.beginPath(); c.arc(bx - 2.8 * s, by - 3 * s, 2 * s, 0, TAU); c.fill();
  } else if (o.kind === 'log') {
    // a fallen log: a round body, bark, grain and a shoot
    c._ink = '#4a3520';
    limb(c, sx - 15 * s, sy - 7 * s, sx + 13 * s, sy - 3 * s, 10 * s, '#a87a45');
    c.strokeStyle = 'rgba(74,53,32,.5)'; c.lineWidth = 1.4 * s;
    c.beginPath(); c.moveTo(sx - 12 * s, sy - 9.5 * s); c.lineTo(sx + 8 * s, sy - 6.5 * s);
    c.moveTo(sx - 11 * s, sy - 4.5 * s); c.lineTo(sx + 6 * s, sy - 1.5 * s); c.stroke();
    ellipse(c, sx + 13.5 * s, sy - 3 * s, 4.6 * s, 5.6 * s, .12);
    c.fillStyle = '#d9b878'; c.fill(); c.strokeStyle = '#4a3520'; c.lineWidth = 2 * s; c.stroke();
    c.strokeStyle = '#a87f52'; c.lineWidth = 1.2 * s;
    ellipse(c, sx + 13.5 * s, sy - 3 * s, 2.6 * s, 3.2 * s, .12); c.stroke();
    c.strokeStyle = '#2f6a2f'; c.lineWidth = 2 * s;
    c.beginPath(); c.moveTo(sx - 6 * s, sy - 11 * s); c.quadraticCurveTo(sx - 5 * s, sy - 16 * s, sx - 1.5 * s, sy - 16.5 * s); c.stroke();
    c.fillStyle = '#4c9a3f';
    ellipse(c, sx - .5 * s, sy - 16.5 * s, 2.6 * s, 1.7 * s, -.4); c.fill();
  } else if (o.kind === 'rocks') {
    // a formation: a big faceted boulder + a companion + a pebble
    c.strokeStyle = '#55524d'; c.lineWidth = 2.4 * s; c.fillStyle = '#9b9a94';
    c.beginPath();
    c.moveTo(sx - 17 * s, sy - 1 * s); c.lineTo(sx - 13 * s, sy - 14 * s); c.lineTo(sx - 4 * s, sy - 20 * s);
    c.lineTo(sx + 7 * s, sy - 17 * s); c.lineTo(sx + 13 * s, sy - 6 * s); c.lineTo(sx + 8 * s, sy + 2 * s);
    c.lineTo(sx - 9 * s, sy + 3 * s); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c3bfb6';                       // face iluminada
    c.beginPath(); c.moveTo(sx - 13 * s, sy - 14 * s); c.lineTo(sx - 4 * s, sy - 20 * s);
    c.lineTo(sx + 1 * s, sy - 9 * s); c.lineTo(sx - 8 * s, sy - 6 * s); c.closePath(); c.fill();
    c.fillStyle = '#7d7b75';                       // face na sombra
    c.beginPath(); c.moveTo(sx + 1 * s, sy - 9 * s); c.lineTo(sx + 7 * s, sy - 17 * s);
    c.lineTo(sx + 13 * s, sy - 6 * s); c.lineTo(sx + 8 * s, sy + 2 * s); c.closePath(); c.fill();
    c.fillStyle = '#8b8a84'; c.strokeStyle = '#55524d';
    c.beginPath(); c.moveTo(sx + 9 * s, sy + 1 * s); c.lineTo(sx + 12 * s, sy - 6 * s);
    c.lineTo(sx + 18 * s, sy - 4 * s); c.lineTo(sx + 19 * s, sy + 2 * s); c.closePath(); c.fill(); c.stroke();
    ellipse(c, sx - 14 * s, sy + 3 * s, 3 * s, 1.8 * s); c.fillStyle = '#8b8a84'; c.fill(); c.stroke();
  } else if (o.kind === 'planting') {
    // a leafy bush: fanned leaves, two tones, berries
    const rr = mulberry(o.id * 53);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * .92 + i / 6 * Math.PI * .84;
      const L = (13 + rr() * 5) * s;
      const ex = sx + Math.cos(a) * L, ey = sy - 4 * s + Math.sin(a) * L * .75;
      c.fillStyle = i % 2 ? '#4c9a3f' : '#3c7a34';
      c.strokeStyle = '#274d22'; c.lineWidth = 1.6 * s;
      c.save();
      c.translate((sx + ex) / 2, (sy - 3 * s + ey) / 2);
      c.rotate(Math.atan2(ey - (sy - 3 * s), ex - sx));
      ellipse(c, 0, 0, L * .52, 3.6 * s); c.fill(); c.stroke();
      c.restore();
    }
    c.fillStyle = '#2f5a28'; ellipse(c, sx, sy - 3 * s, 4 * s, 2.4 * s); c.fill();
    c.fillStyle = '#e2543f';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sx - 4 * s + i * 4 * s, sy - 8 * s - (i % 2) * 3 * s, 1.5 * s, 0, TAU); c.fill(); }
  } else if (o.kind === 'pool') {
    // a sunken pool: a stone rim, water with a bottom and a moving glint
    c.strokeStyle = '#7a7770'; c.lineWidth = 2.2 * s;
    isoPoly(c, [[sx, sy - 18 * s], [sx + 32 * s, sy - 2 * s], [sx, sy + 14 * s], [sx - 32 * s, sy - 2 * s]]);
    c.fillStyle = '#c9c4bc'; c.fill(); c.stroke();
    isoPoly(c, [[sx, sy - 14.5 * s], [sx + 25 * s, sy - 2 * s], [sx, sy + 10.5 * s], [sx - 25 * s, sy - 2 * s]]);
    c.fillStyle = '#4fa8db'; c.fill();
    isoPoly(c, [[sx, sy - 9 * s], [sx + 14 * s, sy - 2 * s], [sx, sy + 5 * s], [sx - 14 * s, sy - 2 * s]]);
    c.fillStyle = '#3f96c8'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.8 * s;
    const g = Math.sin(_now / 800 + o.id) * 5 * s;
    c.beginPath(); c.moveTo(sx - 12 * s + g, sy - 4 * s); c.quadraticCurveTo(sx + g, sy - 8 * s, sx + 12 * s + g, sy - 4 * s); c.stroke();
    c.beginPath(); c.moveTo(sx - 8 * s - g, sy + 2 * s); c.quadraticCurveTo(sx - g, sy - 1 * s, sx + 8 * s - g, sy + 2 * s); c.stroke();
    // degrauzinho
    c.fillStyle = '#b5b0a6'; c.strokeStyle = '#7a7770'; c.lineWidth = 1.6 * s;
    isoPoly(c, [[sx - 20 * s, sy - 8 * s], [sx - 14 * s, sy - 5 * s], [sx - 18 * s, sy - 3 * s], [sx - 24 * s, sy - 6 * s]]);
    c.fill(); c.stroke();
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
  const dano = 1 - e.integrity;
  for (const [A, B] of segs) {
    if (F.aquarium || F.colour === '#a8d8e8') { // vidro
      isoPoly(c, [A, B, [B[0], B[1] - alt], [A[0], A[1] - alt]]);
      c.fillStyle = 'rgba(168,216,232,.34)'; c.fill();
      c.strokeStyle = '#7ec4dd'; c.lineWidth = 2 * z; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.4 * z;
      c.beginPath(); c.moveTo(A[0] + (B[0] - A[0]) * .25, A[1] + (B[1] - A[1]) * .25 - 3 * z);
      c.lineTo(A[0] + (B[0] - A[0]) * .35, A[1] + (B[1] - A[1]) * .35 - alt + 4 * z); c.stroke();
    } else if (e.fence === 'stone') {
      isoPoly(c, [A, B, [B[0], B[1] - alt], [A[0], A[1] - alt]]);
      c.fillStyle = F.colour; c.fill();
      c.strokeStyle = shade(F.colour, -.35); c.lineWidth = 1.8 * z; c.stroke();
      c.strokeStyle = shade(F.colour, -.2); c.lineWidth = 1.2 * z;
      for (let i = 1; i < 3; i++) {
        const t = i / 3;
        c.beginPath(); c.moveTo(A[0], A[1] - alt * t); c.lineTo(B[0], B[1] - alt * t); c.stroke();
      }
    } else if (e.fence === 'aviary') {
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
    } else { // wood / iron / electric
      c.strokeStyle = shade(F.colour, -.42); c.lineWidth = 4.2 * z; c.lineCap = 'round';
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(A[0], A[1] - alt); c.stroke();
      c.beginPath(); c.moveTo(B[0], B[1]); c.lineTo(B[0], B[1] - alt); c.stroke();
      c.strokeStyle = F.colour; c.lineWidth = 2.6 * z;
      c.beginPath(); c.moveTo(A[0], A[1] - 1); c.lineTo(A[0], A[1] - alt); c.stroke();
      c.beginPath(); c.moveTo(B[0], B[1] - 1); c.lineTo(B[0], B[1] - alt); c.stroke();
      const nb = e.fence === 'iron' ? 4 : 2;
      for (let i = 1; i <= nb; i++) {
        const yy = alt * (i / (nb + .6)) + 2 * z;
        c.strokeStyle = e.fence === 'electric' ? '#f2d43c' : F.colour;
        c.lineWidth = (e.fence === 'electric' ? 1.6 : 3) * z;
        c.beginPath(); c.moveTo(A[0], A[1] - yy); c.lineTo(B[0], B[1] - yy); c.stroke();
      }
      if (e.fence === 'iron') {
        c.strokeStyle = F.colour; c.lineWidth = 1.8 * z;
        for (let i = 1; i < 4; i++) {
          const t = i / 4, px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t;
          c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - alt); c.stroke();
        }
      }
      if (e.fence === 'electric') {              // the occasional spark
        const hs = (x * 73856093 ^ y * 19349663) >>> 0;
        if (((_now / 90 | 0) + hs) % 34 < 2) {
          const t = ((hs >> 8) % 100) / 100 * .6 + .2;
          const px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t - alt * .55;
          c.fillStyle = 'rgba(255,244,170,.45)';
          c.beginPath(); c.arc(px, py - z, 4.5 * z, 0, TAU); c.fill();
          c.strokeStyle = '#fff7c0'; c.lineWidth = 1.6 * z;
          c.beginPath(); c.moveTo(px - 3 * z, py); c.lineTo(px - z, py - 3 * z);
          c.lineTo(px + z, py + z); c.lineTo(px + 3 * z, py - 2.5 * z); c.stroke();
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
/** Draws a 128x128 sprite (ground at GND) anchored by the feet at (sx,sy).
 *  `height` is the intended on-screen height in px for the 128 local units. */
function blitSprite(c, spr, sx, sy, alt, dir) {
  const k = alt / SPR;                      // px de tela por unidade local
  c.save();
  c.translate(sx, sy);
  if (dir < 0) c.scale(-1, 1);
  // the sprite's ground is (GND+PAD) units from the top of the frame
  c.drawImage(spr, -alt / 2, -(GND + PAD) * k, alt, SPRH * k);
  c.restore();
}
function drawAnimal(c, a, z) {
  const sx = w2sx(a.x, a.y), sy = w2sy(a.x, a.y);
  const hp = spriteH(a.sp);              // altura base em px (zoom 1)
  // a calf is born at half size and grows until ~1/4 of its life
  const cres = clamp(.5 + .5 * a.age / (a.sp.lifespan * .22), .5, 1);
  const alt = hp * z * cres;             // altura na tela
  const px = clamp(Math.round(alt / 8) * 8, 24, 240); // the cache resolution, in steps
  // what is it standing on? (painted water or an enclosure pool)
  const ti = IDX(clamp(a.x | 0, 0, W - 1), clamp(a.y | 0, 0, H - 1));
  const oc = world.occ[ti] && objects.get(world.occ[ti]);
  const inWater = world.terr[ti] === T_WATER || (oc && oc.kind === 'pool');
  const swimming = inWater && a.sp.plan !== 'wader';   // pernalta vadeia; o resto nada
  const parado = a.state === 'idle' || a.state === 'playing' || a.state === 'eating';
  const spr = getSprite(a.sp, parado && !swimming ? 0 : a.frame, px);
  if (swimming) {
    // the body sunk to the waterline, with bobbing and a wake
    const bob = Math.sin(_now / 430 + a.id * 1.7) * 1.4 * z;
    const merg = alt * .32 + bob;
    c.save();
    c.beginPath(); c.rect(sx - alt, sy - alt * 3, alt * 2, alt * 3 + 1.2 * z);
    c.clip();
    blitSprite(c, spr, sx, sy + merg, alt, a.dir);
    c.restore();
    // the waterline and its ripples
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5 * z;
    ellipse(c, sx, sy, alt * .33, alt * .13); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2 * z;
    for (let k = 0; k < 2; k++) {
      const t = (_now / 900 + a.id * .37 + k / 2) % 1;
      c.globalAlpha = (1 - t) * .45;
      ellipse(c, sx, sy, alt * (.36 + t * .3), alt * (.14 + t * .13)); c.stroke();
    }
    c.globalAlpha = 1;
    if (a.state === 'walking') {        // a V-shaped wake behind
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.4 * z; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(sx - a.dir * alt * .28, sy - 2 * z);
      c.quadraticCurveTo(sx - a.dir * alt * .55, sy - 3 * z, sx - a.dir * alt * .8, sy - 5.5 * z);
      c.moveTo(sx - a.dir * alt * .28, sy + 2 * z);
      c.quadraticCurveTo(sx - a.dir * alt * .55, sy + 3 * z, sx - a.dir * alt * .8, sy + 5 * z);
      c.stroke();
    }
    bubbleQueue(a, sx, sy + merg - visibleHeight(a.sp) * (alt / SPR), z);
    return;
  }
  // the play jump / the mouthful of food
  let hop = 0;
  if (a.state === 'playing') hop = Math.abs(Math.sin(_now / 175 + a.id * 2.1)) * 4 * z;
  else if (a.state === 'eating') hop = -Math.abs(Math.sin(_now / 300 + a.id)) * 1.6 * z;
  const kSombra = 1 - hop * .022 / Math.max(z, .001);
  ellipse(c, sx, sy, hp * .26 * z * cres * Math.max(.7, kSombra), hp * .12 * z * cres * Math.max(.7, kSombra));
  c.fillStyle = 'rgba(0,0,0,.24)'; c.fill();
  if (inWater && z > .45) {               // a wading bird: rings on the water
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.2 * z;
    for (let k = 0; k < 2; k++) {
      const t = (_now / 1100 + a.id * .37 + k / 2) % 1;
      c.globalAlpha = (1 - t) * .5;
      ellipse(c, sx, sy, (6 + t * 16) * z, (3 + t * 8) * z); c.stroke();
    }
    c.globalAlpha = 1;
  }
  blitSprite(c, spr, sx, sy - hop, alt, a.dir);
  if (a.state === 'eating' && z > .5) { // farelos caindo do focinho
    c.fillStyle = 'rgba(96,66,34,.75)';
    for (let k = 0; k < 3; k++) {
      const t = (_now / 500 + k / 3 + a.id * .21) % 1;
      c.globalAlpha = 1 - t;
      c.beginPath();
      c.arc(sx + a.dir * alt * (.2 + k * .04), sy - alt * .22 + t * alt * .2, 1.1 * z, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  bubbleQueue(a, sx, sy - hop - visibleHeight(a.sp) * (alt / SPR), z);
}
/* ---- thought bubbles ---- */
const bubbles = [];
const BUBBLE_MAX = 42;        // the ceiling of bubbles drawn per frame
const BUBBLE_DIST = 30;       // minimum distance between two bubbles, in screen px
/** queues the bubble; the triage by urgency and spacing happens at draw time */
function bubbleQueue(ent, sx, syTop, z) {
  if (!G.bubbles || z < .42 || !ent.thought) return;
  if (G.bubbles === 1 && ent.thought.urg < .45) return;
  bubbles.push({ sx, sy: syTop - 6 * z, p: ent.thought, z });
}
function drawBubbles(c, agora) {
  if (!bubbles.length) return;
  // Urgency first: with the cap applied in draw order, the ones that showed up
  // were whoever came first in the depth queue — an animal in trouble at the back
  // lost its bubble to a visitor "enjoying the day".
  bubbles.sort((a, b) => b.p.urg - a.p.urg);
  const aceitos = [];
  const dmin = BUBBLE_DIST * BUBBLE_DIST;
  for (const b of bubbles) {
    if (aceitos.length >= BUBBLE_MAX) break;
    // in a crowd, one bubble every ~30px: otherwise the queue becomes an illegible mural
    let near = false;
    for (const a of aceitos) if (dist2(a.sx, a.sy, b.sx, b.sy) < dmin) { near = true; break; }
    if (!near) aceitos.push(b);
  }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  for (const b of aceitos) {
    const z = b.z, u = b.p.urg;
    const fundo = u >= .8 ? '#ffd2c8' : u >= .45 ? '#ffeec2' : '#e8f6dd';
    const edge = u >= .8 ? '#bd3f2d' : u >= .45 ? '#c98a1c' : '#3b8c38';
    const w = 25 * z, h = 22 * z;
    const bob = Math.sin(agora / 520 + b.sx * .05) * 1.6 * z;
    const x = b.sx, y = b.sy + bob;
    c.lineWidth = Math.max(1, 2.2 * z);
    c.strokeStyle = edge; c.fillStyle = fundo;
    roundRectP(c, x - w / 2, y - h, w, h, 7 * z); c.fill(); c.stroke();
    // the thought trail (two small dots descending to the head)
    c.beginPath(); c.arc(x - 1.5 * z, y + 3.2 * z, 2.5 * z, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(x - 3.5 * z, y + 8 * z, 1.5 * z, 0, TAU); c.fill(); c.stroke();
    c.font = Math.round(13.5 * z) + 'px system-ui';
    c.fillText(b.p.em, x, y - h / 2 + .5 * z);
  }
  bubbles.length = 0;
}
function drawPersonEnt(c, p, z) {
  const sx = w2sx(p.x, p.y), sy = w2sy(p.x, p.y);
  const hp = 46 * (p.zoomScale || 1);
  const alt = hp * z;
  ellipse(c, sx, sy, 8 * z, 4 * z); c.fillStyle = 'rgba(0,0,0,.22)'; c.fill();
  const spr = getPerson(p, p.frame, clamp(Math.round(alt / 8) * 8, 24, 140));
  blitSprite(c, spr, sx, sy, alt, p.dir);
  // an item in hand stays out of the cached sprite (it would triple the variants)
  if (p.item && z > .45) {
    const k = alt / SPR, hx = sx + p.dir * 16 * k, hy = sy - 42 * k;
    c.lineJoin = 'round'; c._ink = '#2c2118';
    if (p.item === 'balloon') {
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
  if (!p.role) bubbleQueue(p, sx, sy - hp * z * .95, z);   // staff do not think out loud
}

/* ---- render principal ---- */
const drawList = [];
let _now = 0;                 // the frame clock, for animations outside the signature
function render(now) {
  _now = now;
  if (G.dirty.terr) buildTerrain();
  ctx.clearRect(0, 0, VW, VH);
  // sky: a gradient + stars + clouds behind (the map is a plateau floating in it)
  const night = G.hour < 6.5 || G.hour > 19;
  const ceu = ctx.createLinearGradient(0, 0, 0, VH);
  if (night) { ceu.addColorStop(0, '#18263c'); ceu.addColorStop(1, '#2b3d52'); }
  else { ceu.addColorStop(0, '#9ce0bb'); ceu.addColorStop(1, '#7bc79e'); }
  ctx.fillStyle = ceu; ctx.fillRect(0, 0, VW, VH);
  if (night) {
    for (let i = 0; i < 64; i++) {
      const h = (i * 2654435761) >>> 0;
      const px = (h % 9973) / 9973 * VW, py = ((h >> 12) % 9973) / 9973 * VH;
      const tw = .35 + .65 * Math.abs(Math.sin(now / 1400 + i * 1.7));
      ctx.globalAlpha = .5 * tw;
      ctx.fillStyle = '#dce8f2';
      ctx.fillRect(px, py, i % 7 ? 1.4 : 2.2, i % 7 ? 1.4 : 2.2);
    }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 4; i++) {                  // nuvens do fundo
    const cw = VW * (.16 + (i % 3) * .07);
    const px = ((i * .29 + .07) * VW + now * (.004 + i * .0012)) % (VW + cw * 2) - cw;
    const py = VH * (.1 + ((i * 37) % 50) / 100 * .5);
    ctx.fillStyle = night ? 'rgba(200,215,235,.05)' : 'rgba(255,255,255,.16)';
    ellipse(ctx, px, py, cw * .5, cw * .14); ctx.fill();
    ellipse(ctx, px - cw * .24, py + cw * .04, cw * .28, cw * .1); ctx.fill();
    ellipse(ctx, px + cw * .22, py + cw * .03, cw * .3, cw * .11); ctx.fill();
  }

  const z = cam.z;
  ctx.save();
  ctx.translate(cam.x - TOFF_X * z, cam.y - 6 * z);
  ctx.scale(z, z);
  ctx.drawImage(terrCv, 0, 0);
  ctx.restore();
  // cloud shadows drifting over the ground (clipped to the plateau)
  if (!night) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w2sx(0, 0), w2sy(0, 0)); ctx.lineTo(w2sx(W, 0), w2sy(W, 0));
    ctx.lineTo(w2sx(W, H), w2sy(W, H)); ctx.lineTo(w2sx(0, H), w2sy(0, H));
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = 'rgba(25,45,35,.06)';
    for (let i = 0; i < 4; i++) {
      const wx = ((i * 19.3 + now * (.0011 + i * .0004)) % (W + 44)) - 22;
      const wy = ((i * 27.7 + now * .0007) % (H + 44)) - 22;
      const sx = w2sx(wx, wy), sy = w2sy(wx, wy), s = (110 + (i % 3) * 55) * z;
      ellipse(ctx, sx, sy, s, s * .42); ctx.fill();
      ellipse(ctx, sx - s * .55, sy + s * .12, s * .55, s * .25); ctx.fill();
      ellipse(ctx, sx + s * .5, sy - s * .1, s * .6, s * .28); ctx.fill();
    }
    ctx.restore();
  }

  // the visible band of tiles (the screen's 4 corners in world coordinates)
  const cs = [s2w(0, 0), s2w(VW, 0), s2w(VW, VH), s2w(0, VH)];
  const x0 = clamp(Math.floor(Math.min(...cs.map(p => p[0])) - 3), 0, W - 1);
  const x1 = clamp(Math.ceil(Math.max(...cs.map(p => p[0])) + 3), 0, W - 1);
  const y0 = clamp(Math.floor(Math.min(...cs.map(p => p[1])) - 3), 0, H - 1);
  const y1 = clamp(Math.ceil(Math.max(...cs.map(p => p[1])) + 3), 0, H - 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = IDX(x, y), l = world.litter[i];
    if (l > .18) {
      const sx = w2sx(x + .5, y + .5), sy = w2sy(x + .5, y + .5);
      ctx.font = Math.round(11 * z) + 'px system-ui';
      ctx.globalAlpha = clamp(l, .3, 1); ctx.fillText('🗑', sx, sy); ctx.globalAlpha = 1;
    }
    // reflections that flicker on and off in the water
    if (world.terr[i] === T_WATER && z > .5) {
      const h = (i * 2654435761) >>> 0;
      const tw = Math.sin(now / 800 + (h & 1023) * .006);
      if (tw > .25) {
        const gx = x + .25 + ((h >> 10) & 255) / 512, gy = y + .25 + ((h >> 18) & 255) / 512;
        const sx = w2sx(gx, gy), sy = w2sy(gx, gy);
        ctx.globalAlpha = (tw - .25) * .5;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3 * z; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx - 3.5 * z, sy); ctx.lineTo(sx + 3.5 * z, sy); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // a jumping fish, only in deep water and only now and then
      if (z > .6) {
        const ft = (now / 1000 + ((h >> 4) & 1023) * .07) % 11;
        if (ft < .85 &&
          (!inB(x, y - 1) || world.terr[IDX(x, y - 1)] === T_WATER) &&
          (!inB(x + 1, y) || world.terr[IDX(x + 1, y)] === T_WATER) &&
          (!inB(x, y + 1) || world.terr[IDX(x, y + 1)] === T_WATER) &&
          (!inB(x - 1, y) || world.terr[IDX(x - 1, y)] === T_WATER)) {
          const p = ft / .85;
          const sx = w2sx(x + .5, y + .5), sy = w2sy(x + .5, y + .5);
          const fx = sx - 9 * z + p * 18 * z, fy = sy - Math.sin(p * Math.PI) * 13 * z;
          const ang = Math.atan2(-Math.cos(p * Math.PI) * 1.2, 1);
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(ang);
          ctx.fillStyle = '#3e6f9e';
          ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * z, 1.5 * z, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-3 * z, 0); ctx.lineTo(-5.4 * z, -1.6 * z); ctx.lineTo(-5.4 * z, 1.6 * z); ctx.closePath(); ctx.fill();
          ctx.restore();
          if (p < .22 || p > .78) {              // a splash going in and coming out
            const px2 = p < .22 ? sx - 9 * z : sx + 9 * z;
            ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1.2 * z;
            ctx.beginPath(); ctx.moveTo(px2 - 2.5 * z, sy - 1.5 * z); ctx.lineTo(px2 - 1 * z, sy - 3.5 * z);
            ctx.moveTo(px2 + 2.5 * z, sy - 1.5 * z); ctx.lineTo(px2 + 1 * z, sy - 3.5 * z); ctx.stroke();
          }
        }
      }
    }
  }

  // builds the list with depth
  let n = 0;
  const push = (d, t, r) => { drawList[n] = drawList[n] || {}; const o = drawList[n]; o.d = d; o.t = t; o.r = r; n++; };
  for (const e of enclosures.values()) {
    for (const [k, lados] of encSegPorTile(e)) {
      const x = k % W, y = (k / W) | 0;
      if (x < x0 - 2 || x > x1 + 2 || y < y0 - 2 || y > y1 + 2) continue;
      // N/W go BEHIND the animal standing on the tile; S/E go in front. With the
      // old fence ring this didn't matter (nobody stood on it).
      const fundo = lados.filter(l => l === 'N' || l === 'W');
      const front = lados.filter(l => l === 'S' || l === 'E');
      if (fundo.length) push(x + y - .45, 'fence', { x, y, e, lados: fundo });
      if (front.length) push(x + y + .45, 'fence', { x, y, e, lados: front });
    }
  }
  for (const o of objects.values()) {
    if (o.x < x0 - 4 || o.x > x1 + 3 || o.y < y0 - 4 || o.y > y1 + 3) continue;
    push(o.x + o.y + (o.w + o.h) * .5 - .5, o.cat, o);
  }
  for (const a of G.animals) {
    if (a.dead) continue;
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
  drawEntrance(ctx, z, now);
  passaros(ctx, now, night);
  drawBubbles(ctx, now);       // over the entities, or it disappears behind them
  drawAvisos(ctx, z);
  drawSelection(ctx, z);
  drawGhost(ctx, z);

  // noite
  if (night) {
    const k = G.hour < 6.5 ? clamp((6.5 - G.hour) / 2.5, 0, 1) : clamp((G.hour - 19) / 3, 0, 1);
    ctx.fillStyle = 'rgba(24,34,66,' + (k * .46).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
    luzesNoturnas(ctx, z, k, x0, x1, y0, y1);
  } else if (G.hour < 8.5) {
    ctx.fillStyle = 'rgba(255,170,90,' + ((8.5 - G.hour) * .12).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
}
/** pools of warm light over the darkening — lamp posts and lit façades */
function luzesNoturnas(c, z, k, x0, x1, y0, y1) {
  for (const o of objects.values()) {
    if (o.x < x0 - 4 || o.x > x1 + 3 || o.y < y0 - 4 || o.y > y1 + 3) continue;
    if (o.cat === 'deco' && o.kind === 'lamp') {
      const sx = w2sx(o.x + .5, o.y + .5), sy = w2sy(o.x + .5, o.y + .5);
      const g = c.createRadialGradient(sx, sy, 2 * z, sx, sy, 40 * z);
      g.addColorStop(0, 'rgba(255,214,120,' + (.30 * k).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,214,120,0)');
      c.fillStyle = g;
      ellipse(c, sx, sy, 42 * z, 21 * z); c.fill();
    } else if (o.cat === 'build') {
      const B = BUILDINGS[o.kind];
      if (!B.wage && B.value <= 0) continue;   // only what has people inside
      const px = o.x + o.w * .82, py = o.y + o.h * .82;   // quina da frente
      c.fillStyle = 'rgba(255,224,138,' + (.10 * k).toFixed(3) + ')';
      ellipse(c, w2sx(px, py), w2sy(px, py) + 6 * z, (o.w + o.h) * 11 * z, (o.w + o.h) * 5 * z);
      c.fill();
    }
  }
}
/** a flock of birds crossing the sky every so often */
function passaros(c, now, night) {
  if (night) return;
  const ciclo = Math.floor(now / 26000);
  const t = (now % 26000) / 1000;
  if (t > 11) return;
  const r = mulberry(ciclo * 977 + 13);
  const p = t / 11;
  const y0 = VH * (.12 + r() * .35);
  const x0 = -80 + p * (VW + 160);
  c.strokeStyle = 'rgba(40,50,60,.55)'; c.lineWidth = 1.7; c.lineCap = 'round';
  const nB = 3 + (ciclo % 3);
  for (let i = 0; i < nB; i++) {
    const bx = x0 - i * 24 - (i % 2) * 6, by = y0 + (i % 2 ? 13 : 0) + i * 2.5 + Math.sin(p * 26 + i) * 3;
    const flap = Math.sin(now / 110 + i * 1.3) * 3;
    c.beginPath();
    c.moveTo(bx - 6, by - flap * .4);
    c.quadraticCurveTo(bx - 2, by + flap, bx, by);
    c.quadraticCurveTo(bx + 2, by + flap, bx + 6, by - flap * .4);
    c.stroke();
  }
}
function drawEntrance(c, z, now) {
  const x = ENTRANCE.x, y = ENTRANCE.y;
  const T = [w2sx(x, y), w2sy(x, y)], R = [w2sx(x + 1, y), w2sy(x + 1, y)];
  const up = 46 * z;
  // wooden posts with a stone base
  c.lineCap = 'round';
  for (const P of [T, R]) {
    c.fillStyle = '#8b8a84';
    ellipse(c, P[0], P[1], 5.5 * z, 2.8 * z); c.fill();
    c.strokeStyle = '#3f2a12'; c.lineWidth = 7.4 * z;
    c.beginPath(); c.moveTo(P[0], P[1]); c.lineTo(P[0], P[1] - up); c.stroke();
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 4.4 * z;
    c.beginPath(); c.moveTo(P[0], P[1] - 2 * z); c.lineTo(P[0], P[1] - up + 2 * z); c.stroke();
  }
  // an arch joining the posts
  const mx = (T[0] + R[0]) / 2, top = Math.min(T[1], R[1]) - up - 20 * z;
  const arco = () => { c.beginPath(); c.moveTo(T[0], T[1] - up); c.quadraticCurveTo(mx, top, R[0], R[1] - up); };
  c.strokeStyle = '#3f2a12'; c.lineWidth = 6.2 * z; arco(); c.stroke();
  c.strokeStyle = '#a87a45'; c.lineWidth = 3.2 * z; arco(); c.stroke();
  // bunting hung from the arch
  const colours = ['#e2543f', '#ffc23c', '#3fa5e2', '#4fae4a', '#f28ab0', '#9a6ad4'];
  for (let i = 0; i < 6; i++) {
    const t = (i + 1) / 7;
    const qx = lerp(lerp(T[0], mx, t), lerp(mx, R[0], t), t);
    const qy = lerp(lerp(T[1] - up, top, t), lerp(top, R[1] - up, t), t) + 2 * z;
    const sw = Math.sin(now / 620 + i * 1.1) * 1.2 * z;
    c.fillStyle = colours[i];
    c.beginPath(); c.moveTo(qx - 3 * z, qy); c.lineTo(qx + 3 * z, qy);
    c.lineTo(qx + sw * .5, qy + 7 * z + Math.abs(sw) * .5); c.closePath(); c.fill();
  }
  // a sign hanging in the opening
  const bal = Math.sin(now / 900) * .9 * z;
  const py = Math.min(T[1], R[1]) - up + 2 * z + bal;
  c.strokeStyle = '#3f2a12'; c.lineWidth = 1.4 * z;
  c.beginPath();
  c.moveTo(mx - 14 * z, py + 3 * z); c.lineTo(mx - 10 * z, py - 8 * z);
  c.moveTo(mx + 14 * z, py + 3 * z); c.lineTo(mx + 10 * z, py - 8 * z);
  c.stroke();
  c.fillStyle = '#e2543f'; c.strokeStyle = '#8a2f22'; c.lineWidth = 2.4 * z;
  roundRectP(c, mx - 21 * z, py + 2 * z, 42 * z, 16 * z, 4.5 * z);
  c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(8.5 * z) + 'px system-ui';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('ZOO', mx, py + 10 * z);
}
/** A warning bubble over an enclosure that has animals but no path beside it —
 *  the commonest cause of "a full zoo and not one visitor". */
function drawAvisos(c, z) {
  if (z < .35) return;
  for (const e of enclosures.values()) {
    if (!e.animals.some(a => !a.dead)) continue;
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
  if (s.kind === 'enc') {
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
  } else if (s.kind === 'obj') {
    const o = s.ref;
    isoPoly(c, [[w2sx(o.x, o.y), w2sy(o.x, o.y)], [w2sx(o.x + o.w, o.y), w2sy(o.x + o.w, o.y)],
    [w2sx(o.x + o.w, o.y + o.h), w2sy(o.x + o.w, o.y + o.h)], [w2sx(o.x, o.y + o.h), w2sy(o.x, o.y + o.h)]]);
    c.stroke();
  } else if (s.kind === 'animal' || s.kind === 'staff' || s.kind === 'vis') {
    const a = s.ref;
    const r = s.kind === 'animal' ? 22 : 13;
    c.beginPath(); c.ellipse(w2sx(a.x, a.y), w2sy(a.x, a.y), r * z, r * .5 * z, 0, 0, TAU); c.stroke();
  }
  c.setLineDash([]);
}
function drawGhost(c, z) {
  const t = G.tool; if (!t || !G.hover) return;
  const [hx, hy] = G.hover;
  c.globalAlpha = .62;
  if (G.drag && (t.cat === 'enclosure')) {
    const r = dragRect();
    const p = dragPlan(r, t.key);
    // green = a new enclosure · gold = extending the neighbour · red = not allowed
    const colour = p.action === 'criar' ? ['#4fae4a', 'rgba(79,174,74,.26)', '#1f5a1c']
      : p.action === 'extend' ? ['#e8a01c', 'rgba(255,194,60,.3)', '#7a5210']
        : ['#e2543f', 'rgba(226,84,63,.24)', '#8a2f22'];
    c.strokeStyle = colour[0]; c.lineWidth = 3 * z; c.fillStyle = colour[1];
    // paints only the tiles that really go in (the rest of the rectangle is taken)
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
    const rot = p.action === 'criar' ? `Novo recinto · ${p.tiles.length} tiles · ${moneyFull(p.cost)}`
      : p.action === 'extend' ? `Ampliar ${p.target.name} · +${p.tiles.length} tiles · ${moneyFull(p.cost)}`
        : p.reason;
    c.fillStyle = colour[2]; c.font = 'bold ' + Math.round(12.5 * z) + 'px system-ui';
    c.textAlign = 'center';
    const mx = w2sx(r.x + r.w / 2, r.y + r.h / 2), my = w2sy(r.x + r.w / 2, r.y + r.h / 2);
    c.strokeStyle = 'rgba(255,253,246,.85)'; c.lineWidth = 4 * z;
    c.strokeText(rot, mx, my); c.fillText(rot, mx, my);
    c.globalAlpha = .62;
  } else {
    const w = t.w || 1, h = t.h || 1;
    const ok = canPlace(t, hx, hy);
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
// a reused buffer: allocating canvas+ImageData twice a second pressures the GC
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
  // buildings and the gate
  for (const o of objects.values()) {
    if (o.cat !== 'build') continue;
    mctx.fillStyle = BUILDINGS[o.kind].colour;
    mctx.fillRect(o.x * S, o.y * S, Math.max(2.4, o.w * S), Math.max(2.4, o.h * S));
  }
  mctx.fillStyle = '#ffc23c';
  mctx.fillRect(ENTRANCE.x * S - 2, ENTRANCE.y * S - 1, S + 4, 4);
  // viewport
  const c0 = s2w(0, 0), c1 = s2w(VW, 0), c2 = s2w(VW, VH), c3 = s2w(0, VH);
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 3;
  mctx.beginPath();
  mctx.moveTo(c0[0] * S, c0[1] * S); mctx.lineTo(c1[0] * S, c1[1] * S);
  mctx.lineTo(c2[0] * S, c2[1] * S); mctx.lineTo(c3[0] * S, c3[1] * S); mctx.closePath(); mctx.stroke();
  mctx.fillStyle = '#e2543f';
  for (const v of G.visitors) mctx.fillRect(v.x * S - 1, v.y * S - 1, 2.5, 2.5);
}