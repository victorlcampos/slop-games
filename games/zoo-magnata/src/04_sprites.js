/* ==========================================================================
   3. GERADOR PROCEDURAL DE SPRITES
   Espaço local: 128x128, chão em y=116, animal olhando para a direita.
   ========================================================================== */
/* Drawing space: SPR wide, ground at GND.
   PAD é folga ACIMA da moldura: sem ela sobravam 12 unidades sobre o corpo e
   pescoço de girafa (-28) e chifres de cudo/alce/órix (-24 a -9) saíam cortados.
   Todo desenho é relativo a GND, então basta transladar na hora de rasterizar —
   nenhum desenhista precisa saber que a folga existe. */
const SPR = 128, GND = 116, PAD = 48, BOT = 18, SPRH = GND + PAD + BOT, FRAMES = 6;
const spriteCache = new Map();

function lum(hexc) { const [r, g, b] = hex2rgb(hexc); return (r * .299 + g * .587 + b * .114) / 255; }
function inkFor(c1) { return lum(c1) > .28 ? shade(c1, -.62) : '#16120e'; }

/* ---- quadruped presets per body plan ---- */
const QUAD = {
  feline: { bL: 46, bH: 24, bY: 50, legL: 26, legW: 8, neckL: 15, neckA: -.55, neckW: 15, headR: 14, snoutL: 10, snoutH: 10, ear: 'redonda', earS: 9, tail: 'long', tailL: 40, hump: 3 },
  canine: { bL: 44, bH: 21, bY: 48, legL: 27, legW: 7, neckL: 15, neckA: -.6, neckW: 13, headR: 12, snoutL: 15, snoutH: 8, ear: 'ponta', earS: 11, tail: 'bushy', tailL: 32, hump: 2 },
  bear: { bL: 50, bH: 33, bY: 50, legL: 22, legW: 12, neckL: 8, neckA: -.5, neckW: 20, headR: 16, snoutL: 13, snoutH: 12, ear: 'redonda', earS: 8, tail: 'short', tailL: 8, hump: 7 },
  ungulate: { bL: 44, bH: 22, bY: 60, legL: 40, legW: 5, neckL: 26, neckA: -.95, neckW: 11, headR: 11, snoutL: 14, snoutH: 8, ear: 'long', earS: 11, tail: 'short', tailL: 12, hump: 3 },
  bovine: { bL: 52, bH: 30, bY: 54, legL: 30, legW: 9, neckL: 13, neckA: -.5, neckW: 21, headR: 14, snoutL: 14, snoutH: 12, ear: 'long', earS: 9, tail: 'tuft', tailL: 26, hump: 9 },
  equine: { bL: 50, bH: 25, bY: 60, legL: 40, legW: 6, neckL: 26, neckA: -.85, neckW: 14, headR: 11, snoutL: 17, snoutH: 9, ear: 'ponta', earS: 10, tail: 'crina', tailL: 30, hump: 4 },
  swine: { bL: 44, bH: 25, bY: 44, legL: 20, legW: 7, neckL: 8, neckA: -.35, neckW: 17, headR: 12, snoutL: 15, snoutH: 10, ear: 'caida', earS: 10, tail: 'fina', tailL: 12, hump: 6 },
  rodent: { bL: 36, bH: 26, bY: 40, legL: 14, legW: 6, neckL: 5, neckA: -.5, neckW: 16, headR: 14, snoutL: 8, snoutH: 8, ear: 'redonda', earS: 8, tail: 'fina', tailL: 16, hump: 4 },
  camelid: { bL: 46, bH: 24, bY: 60, legL: 40, legW: 6, neckL: 30, neckA: -1.0, neckW: 11, headR: 10, snoutL: 12, snoutH: 8, ear: 'ponta', earS: 7, tail: 'fina', tailL: 14, hump: 4 },
  mustelid: { bL: 44, bH: 18, bY: 32, legL: 12, legW: 6, neckL: 9, neckA: -.5, neckW: 13, headR: 11, snoutL: 10, snoutH: 7, ear: 'redonda', earS: 7, tail: 'bushy', tailL: 28, hump: 2 },
  sloth: { bL: 42, bH: 26, bY: 42, legL: 18, legW: 8, neckL: 10, neckA: -.4, neckW: 15, headR: 12, snoutL: 14, snoutH: 8, ear: 'pequena', earS: 5, tail: 'short', tailL: 10, hump: 5 },
  hippo: { bL: 58, bH: 34, bY: 42, legL: 15, legW: 13, neckL: 6, neckA: -.2, neckW: 24, headR: 17, snoutL: 18, snoutH: 16, ear: 'pequena', earS: 6, tail: 'fina', tailL: 10, hump: 3 },
  rhino: { bL: 58, bH: 34, bY: 48, legL: 22, legW: 13, neckL: 8, neckA: -.3, neckW: 23, headR: 14, snoutL: 20, snoutH: 12, ear: 'ponta', earS: 8, tail: 'fina', tailL: 14, hump: 8 },
  elephant: { bL: 60, bH: 42, bY: 56, legL: 30, legW: 16, neckL: 6, neckA: -.35, neckW: 28, headR: 20, snoutL: 0, snoutH: 0, ear: 'giant', earS: 22, tail: 'fina', tailL: 20, hump: 5 },
  giraffe: { bL: 44, bH: 26, bY: 66, legL: 44, legW: 6, neckL: 56, neckA: -1.15, neckW: 12, headR: 10, snoutL: 12, snoutH: 7, ear: 'ponta', earS: 8, tail: 'fina', tailL: 22, hump: 8 },
};

/* ---- coat patterns ---- */
function applyPattern(c, sp, bodyPath, x0, y0, x1, y1) {
  const p = sp.pattern, c2 = sp.c2, rr = mulberry(hashStr(sp.key) + 7);
  const wdt = x1 - x0, hgt = y1 - y0;
  c.save(); bodyPath(); c.clip();
  c.globalAlpha = .92;
  if (p === 'stripes') {
    c.strokeStyle = c2; c.lineCap = 'round';
    const n = Math.max(4, Math.round(wdt / 9));
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + .5) / n * wdt, w = 2.5 + rr() * 3.4;
      c.lineWidth = w; c.beginPath();
      c.moveTo(x - 3, y0 - 3);
      c.quadraticCurveTo(x + 4 + rr() * 5, y0 + hgt * .5, x - 2, y1 + 3);
      c.stroke();
    }
  } else if (p === 'spots') {
    c.fillStyle = c2;
    for (let i = 0; i < 26; i++) {
      const x = x0 + rr() * wdt, y = y0 + rr() * hgt, r = 1.6 + rr() * 2.6;
      ellipse(c, x, y, r, r * (.75 + rr() * .5)); c.fill();
    }
  } else if (p === 'rosettes') {
    c.strokeStyle = c2; c.fillStyle = c2;
    for (let i = 0; i < 16; i++) {
      const x = x0 + rr() * wdt, y = y0 + rr() * hgt, r = 3 + rr() * 2.6;
      c.lineWidth = 1.9; ellipse(c, x, y, r, r * .85); c.stroke();
      ellipse(c, x, y, r * .3, r * .3); c.fill();
    }
  } else if (p === 'patches' || p === 'mask' || p === 'ruff' || p === 'collar' || p === 'face' || p === 'whiteHead') {
    c.fillStyle = c2;
    for (let i = 0; i < 4; i++) {
      const x = x0 + rr() * wdt, y = y0 + rr() * hgt;
      ellipse(c, x, y, wdt * (.13 + rr() * .16), hgt * (.2 + rr() * .3), rr() * 3); c.fill();
    }
  } else if (p === 'plates') {
    c.strokeStyle = shade(sp.c1, -.3); c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = x0 + (i + .5) / 5 * wdt;
      c.beginPath(); c.moveTo(x, y0 - 4); c.quadraticCurveTo(x + 5, y0 + hgt / 2, x, y1 + 4); c.stroke();
    }
  } else if (p === 'zebra') {
    c.strokeStyle = c2; c.lineWidth = 4; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y = y0 + (i + .5) / 6 * hgt;
      c.beginPath(); c.moveTo(x0 - 3, y); c.lineTo(x0 + wdt * .38, y); c.stroke();
    }
  } else if (p === 'net' || p === 'diamond' || p === 'scale') {
    c.strokeStyle = c2; c.lineWidth = 1.8;
    for (let i = -6; i < 20; i++) {
      c.beginPath(); c.moveTo(x0 + i * 9, y0 - 6); c.lineTo(x0 + i * 9 + hgt + 12, y1 + 6); c.stroke();
      c.beginPath(); c.moveTo(x0 + i * 9, y1 + 6); c.lineTo(x0 + i * 9 + hgt + 12, y0 - 6); c.stroke();
    }
  } else if (p === 'bands') {
    c.strokeStyle = c2; c.lineWidth = 3.5;
    for (let i = 0; i < 7; i++) {
      const x = x0 + (i + .5) / 7 * wdt;
      c.beginPath(); c.moveTo(x, y0 - 4); c.lineTo(x, y1 + 4); c.stroke();
    }
  }
  // a lighter belly (nearly all of them)
  if (p !== 'patches' && p !== 'zebra') {
    c.globalAlpha = .35; c.fillStyle = shade(sp.c1, .42);
    ellipse(c, (x0 + x1) / 2, y1 - hgt * .04, wdt * .42, hgt * .3); c.fill();
  }
  c.restore(); c.globalAlpha = 1;
}

/* ---- chifres / cornos ---- */
function drawHorn(c, x, y, kind, s, col) {
  c.save(); c.translate(x, y); c._ink = '#3a2f22';
  const k = col || '#e2d6b8';
  if (kind === 'straight') { limb(c, 0, 0, 2 * s, -22 * s, 4.5 * s, k); limb(c, -4, 0, -2 * s, -20 * s, 4.5 * s, k); }
  else if (kind === 'lyre') { limb2(c, 0, 0, 9 * s, -14 * s, -2 * s, -24 * s, 4.5 * s, k); limb2(c, -5, 1, 3 * s, -13 * s, -8 * s, -22 * s, 4.5 * s, k); }
  else if (kind === 'curved') { limb2(c, 0, 0, 11 * s, -6 * s, 14 * s, -17 * s, 5 * s, k); limb2(c, -4, 1, -11 * s, -6 * s, -14 * s, -16 * s, 5 * s, k); }
  else if (kind === 'moon') { limb2(c, 0, 0, 15 * s, -3 * s, 19 * s, -14 * s, 4.5 * s, k); limb2(c, -3, 1, -14 * s, -3 * s, -18 * s, -13 * s, 4.5 * s, k); }
  else if (kind === 'boss') {
    c.fillStyle = shade(k, -.35); ellipse(c, 0, -2, 11 * s, 6 * s); c.fill();
    limb2(c, 8 * s, -2, 16 * s, 2 * s, 18 * s, -9 * s, 4.5 * s, k);
    limb2(c, -8 * s, -2, -16 * s, 2 * s, -18 * s, -9 * s, 4.5 * s, k);
  } else if (kind === 'spiral') {
    for (const dir of [1, -1]) {
      c.beginPath(); c.moveTo(dir * 2, 0);
      for (let i = 0; i <= 22; i++) { const t = i / 22; c.lineTo(dir * (2 + Math.sin(t * 9) * 6 * s), -t * 30 * s); }
      c.lineWidth = 6 * s; c.strokeStyle = '#3a2f22'; c.lineCap = 'round'; c.stroke();
      c.lineWidth = 3.6 * s; c.strokeStyle = k; c.stroke();
    }
  } else if (kind === 'branched') {
    for (const dir of [1, -1]) {
      limb(c, dir * 3, 0, dir * 8 * s, -24 * s, 4 * s, k);
      limb(c, dir * 6 * s, -12 * s, dir * 16 * s, -18 * s, 3 * s, k);
      limb(c, dir * 7 * s, -19 * s, dir * 17 * s, -28 * s, 3 * s, k);
    }
  } else if (kind === 'palm') {
    for (const dir of [1, -1]) {
      limb(c, dir * 3, 0, dir * 12 * s, -16 * s, 4 * s, k);
      c.beginPath(); c.ellipse(dir * 19 * s, -20 * s, 11 * s, 7 * s, dir * .5, 0, TAU);
      c.lineWidth = 3.5; c.strokeStyle = '#3a2f22'; c.stroke(); c.fillStyle = k; c.fill();
    }
  }
  c.restore();
}
function drawEar(c, x, y, kind, s, fill, inner) {
  c._ink = inkFor(fill);
  if (kind === 'ponta' || kind === 'tuft') {
    // a wider base and a lower tip: that way the ear meets the skull instead
    // of floating as a loose triangle above the head
    c.beginPath(); c.moveTo(x - s * .8, y + s * .7); c.lineTo(x + s * .1, y - s * 1.02); c.lineTo(x + s * .9, y + s * .55); c.closePath();
    ink(c, fill, 3.6);
    c.beginPath(); c.moveTo(x - s * .3, y + s * .4); c.lineTo(x + s * .08, y - s * .55); c.lineTo(x + s * .48, y + s * .34); c.closePath();
    c.fillStyle = inner; c.fill();
    if (kind === 'tuft') limb(c, x + s * .1, y - s * .98, x + s * .3, y - s * 1.85, 2.4, inkFor(fill));
  } else if (kind === 'giant') {
    ellipse(c, x, y - s * .2, s * .78, s * 1.05, .25); ink(c, fill, 3.6);
    ellipse(c, x, y - s * .2, s * .44, s * .68, .25); c.fillStyle = inner; c.fill();
  } else if (kind === 'caida') {
    ellipse(c, x, y + s * .5, s * .5, s * .95, .35); ink(c, fill, 3.6);
  } else if (kind === 'long') {
    ellipse(c, x, y - s * .1, s * .38, s * 1.0, .35); ink(c, fill, 3.6);
    ellipse(c, x, y - s * .1, s * .18, s * .6, .35); c.fillStyle = inner; c.fill();
  } else { // redonda / pequena
    ellipse(c, x, y, s * .72, s * .72); ink(c, fill, 3.6);
    ellipse(c, x, y, s * .38, s * .38); c.fillStyle = inner; c.fill();
  }
}
function drawTail(c, x, y, kind, len, col, dark, wag) {
  c._ink = inkFor(col);
  const w = wag || 0;
  if (kind === 'none') return;
  if (kind === 'bushy') {
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x - len * .6, y - len * .35 + w, x - len, y - len * .55 + w * 1.6);
    c.lineWidth = 13; c.strokeStyle = c._ink; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 9; c.strokeStyle = col; c.stroke();
  } else if (kind === 'ringed') {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / n, tx = x - len * t, ty = y - len * .55 * Math.sin(t * 2.1) + w * t;
      const t2 = (i + 1) / n, tx2 = x - len * t2, ty2 = y - len * .55 * Math.sin(t2 * 2.1) + w * t2;
      limb(c, tx, ty, tx2, ty2, 8, i % 2 ? dark : col);
    }
  } else if (kind === 'tuft') {
    limb(c, x, y, x - len * .85, y - len * .3 + w, 5, col);
    ellipse(c, x - len * .9, y - len * .34 + w, 6, 6); ink(c, dark, 3.4);
  } else if (kind === 'crina') {
    for (let i = 0; i < 6; i++) limb(c, x, y, x - len * (.7 + i * .05), y + len * (.2 + i * .13) + w, 4, i % 2 ? dark : col);
  } else if (kind === 'paddle') {
    ellipse(c, x - len * .7, y - 2 + w, len * .55, len * .3, -.3); ink(c, dark, 3.6);
  } else if (kind === 'banner') {
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x - len * .7, y - len * .1, x - len, y - len * .5 + w);
    c.lineWidth = 22; c.strokeStyle = c._ink; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 17; c.strokeStyle = dark; c.stroke();
  } else if (kind === 'short' || kind === 'fina') {
    limb(c, x, y, x - len * .8, y - len * .5 + w, kind === 'short' ? 6 : 3.5, col);
  } else { // longa
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x - len * .75, y + len * .12, x - len * .95, y - len * .5 + w);
    c.lineWidth = 9; c.strokeStyle = c._ink; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 5.5; c.strokeStyle = col; c.stroke();
  }
}

/* ---- QUADRUPED (the main draughtsman) ---- */
function drawQuad(c, sp, t) {
  const P = QUAD[sp.plan] || QUAD.feline, o = sp.o;
  const c1 = sp.c1, c2 = sp.c2, dk = shade(c1, -.26), ik = inkFor(c1);
  c._ink = ik;
  const legL = P.legL * (o.longLeg || 1);
  const bCY = GND - legL - P.bH * .5 - 2;
  const bCX = 62;
  const x0 = bCX - P.bL / 2, x1 = bCX + P.bL / 2;
  const sw = Math.sin(t * TAU), sw2 = Math.sin(t * TAU + Math.PI);
  const bob = Math.abs(Math.sin(t * TAU)) * 1.6;

  const bodyPath = () => {
    c.beginPath();
    c.moveTo(x0 - 2, bCY - bob);
    c.bezierCurveTo(x0 + 2, bCY - P.bH * .62 - P.hump - bob, x1 - 8, bCY - P.bH * .62 - bob, x1 + 3, bCY - P.bH * .18 - bob);
    c.bezierCurveTo(x1 + 8, bCY + P.bH * .5 - bob, x1 - 10, bCY + P.bH * .62 - bob, bCX, bCY + P.bH * .6 - bob);
    c.bezierCurveTo(x0 + 8, bCY + P.bH * .62 - bob, x0 - 5, bCY + P.bH * .5 - bob, x0 - 2, bCY - bob);
    c.closePath();
  };
  // hind legs (darker)
  const hipX = x0 + 6, shoX = x1 - 8;
  limb2(c, hipX, bCY + 4 - bob, hipX - 5 + sw2 * 5, GND - legL * .5, hipX + sw2 * 8, GND, P.legW, dk);
  limb2(c, shoX, bCY + 4 - bob, shoX + sw * 4, GND - legL * .5, shoX + sw * 8, GND, P.legW, dk);
  // tail behind the body
  if (P.tail !== 'long') drawTail(c, x0 + 1, bCY - P.bH * .25 - bob, o.tail || P.tail, P.tailL, c1, c2, sw * 3);
  // corpo
  bodyPath(); ink(c, c1, 4.6);
  if (o.furry) { // pelagem longa
    c.strokeStyle = shade(c1, -.18); c.lineWidth = 2.2;
    for (let i = 0; i < 9; i++) {
      const x = x0 + i / 8 * P.bL;
      c.beginPath(); c.moveTo(x, bCY + P.bH * .45 - bob); c.lineTo(x - 3, bCY + P.bH * .72 + 5 - bob); c.stroke();
    }
  }
  applyPattern(c, sp, bodyPath, x0, bCY - P.bH * .6 - bob, x1, bCY + P.bH * .6 - bob);
  if (o.spine) { // porco-espinho
    c.strokeStyle = '#f0eadd'; c.lineWidth = 2.6; c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const x = x0 + rndSeeded(sp, i) * P.bL, y = bCY - P.bH * .5 - bob;
      c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x - 5 - i % 3 * 2, y - 13 - i % 4 * 3); c.stroke();
    }
  }
  // patas dianteiras
  limb2(c, hipX + 5, bCY + 3 - bob, hipX + sw * 5, GND - legL * .5, hipX + sw * 9, GND, P.legW, c1);
  limb2(c, shoX - 3, bCY + 3 - bob, shoX + sw2 * 4, GND - legL * .5, shoX + sw2 * 9, GND, P.legW, c1);
  if (P.tail === 'long') drawTail(c, x0 + 1, bCY - P.bH * .25 - bob, o.tail || P.tail, P.tailL, c1, c2, sw * 4);

  // neck + head
  const hr = P.headR;
  const nA = P.neckA, nL = P.neckL * (o.neck !== undefined ? o.neck : 1);
  const nx = x1 - 4, ny = bCY - P.bH * .35 - bob;
  const hx = nx + Math.cos(nA) * nL, hy = ny + Math.sin(nA) * nL;
  limb(c, nx, ny, hx, hy, P.neckW, c1);
  if (o.mane) { // juba / crina
    const jc = c2;
    if (sp.plan === 'equine') {
      for (let i = 0; i <= 7; i++) {
        const t2 = i / 7, px = lerp(nx, hx, t2), py = lerp(ny, hy, t2);
        limb(c, px, py - P.neckW * .35, px - 5, py - P.neckW * .35 - 9 * o.mane, 4.5, jc);
      }
    } else {
      // a crown of tufts around neck and head, outlined, so the mane actually
      // reads at the size the animal is seen on the map
      const R = (P.neckW * .42 + 11 * o.mane);
      c.beginPath();
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * TAU;
        const px = hx - hr * .18 + Math.cos(a) * R * .95, py = hy + Math.sin(a) * R * .95;
        c.moveTo(px + R * .62, py); c.arc(px, py, R * .62, 0, TAU);
      }
      ink(c, jc, 3.4);
    }
  }
  // corcovas de camelo
  if (o.hump) {
    for (let i = 0; i < o.hump; i++) {
      const cx2 = bCX + (o.hump === 1 ? 0 : (i ? 13 : -13));
      ellipse(c, cx2, bCY - P.bH * .55 - bob, 13, 12); ink(c, c1, 4.4);
    }
  }
  // the elephant's ear goes BEHIND the head, or it becomes a disc over the face
  if (sp.plan === 'elephant') drawEar(c, hx - hr * .5, hy - hr * .05, 'giant', P.earS, shade(c1, -.1), shade(c1, -.28));
  ellipse(c, hx, hy, hr, hr * .92); ink(c, c1, 4.4);
  // focinho
  const fl = P.snoutL * (o.longSnout || 1);
  if (fl > 0) {
    ellipse(c, hx + hr * .72 + fl * .3, hy + hr * .22, fl * .62, P.snoutH * .55, .12); ink(c, mixc(c1, '#ffffff', .12), 4);
    ellipse(c, hx + hr * .72 + fl * .62, hy + hr * .16, 3, 2.4); c.fillStyle = ik; c.fill();
  }
  if (o.tusk && sp.plan !== 'elephant') { // presas (o elefante desenha as suas junto da tromba)
    for (const d of [0, 1]) limb(c, hx + hr * .6, hy + hr * .5, hx + hr * .5 + 10 * o.tusk, hy + hr * .5 - 12 * o.tusk - d * 3, 4.5, '#f2ece0');
  }
  if (o.prong) { // rinoceronte
    c.beginPath(); c.moveTo(hx + hr * .95 + fl * .3, hy + hr * .3);
    c.quadraticCurveTo(hx + hr * 1.5, hy - 12 * o.prong, hx + hr * .95, hy - 22 * o.prong);
    c.lineTo(hx + hr * .55, hy - 2); c.closePath(); ink(c, '#d9d2c2', 4);
  }
  if (o.horn) drawHorn(c, hx - 2, hy - hr * .78, o.horn, o.hornSize || 1);
  if (sp.plan !== 'elephant')
    drawEar(c, hx - hr * .34, hy - hr * .78, o.ear || P.ear, P.earS, c1, shade(c1, -.3));
  // the elephant's trunk
  if (sp.plan === 'elephant') {
    const swg = Math.sin(t * TAU) * 5;
    c.beginPath(); c.moveTo(hx + hr * .5, hy + hr * .3);
    c.quadraticCurveTo(hx + hr * 1.5 + swg, hy + hr * 1.3, hx + hr * 1.05 + swg * 1.6, GND - 6);
    c.lineWidth = 17; c.strokeStyle = ik; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 12.5; c.strokeStyle = c1; c.stroke();
    for (const d of [0, 1]) limb(c, hx + hr * .55, hy + hr * .75, hx + hr * 1.05 + d * 3, hy + hr * 1.5 + 12 * (o.tusk || 1), 5.5, '#f4efe2');
  }
  if (sp.plan === 'giraffe') { // ossicones
    for (const d of [-1, 1]) { limb(c, hx + d * 4, hy - hr * .8, hx + d * 5, hy - hr * 1.9, 3.4, c1); ellipse(c, hx + d * 5, hy - hr * 1.95, 3.2, 3.2); ink(c, c2, 2.6); }
  }
  eye(c, hx + hr * .42, hy - hr * .18, hr * .3 * (o.bigEye ? 1.5 : 1));
  if (o.upright) { /* suricato em pé — marcador */ }
}
function rndSeeded(sp, i) { return mulberry(hashStr(sp.key) + i * 31)(); }

/* ---- PRIMATA ---- */
function drawPrimate(c, sp, t) {
  const c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const s = 1, sw = Math.sin(t * TAU);
  const hipY = GND - 26, bx = 62;
  limb2(c, bx - 6, hipY, bx - 10 + sw * 4, GND - 12, bx - 12 + sw * 6, GND, 9, shade(c1, -.22));
  limb2(c, bx + 6, hipY, bx + 10 - sw * 4, GND - 12, bx + 12 - sw * 6, GND, 9, shade(c1, -.22));
  // tronco
  c.beginPath();
  c.moveTo(bx - 17, hipY + 4); c.bezierCurveTo(bx - 24, hipY - 26, bx - 20, hipY - 44, bx - 4, hipY - 46);
  c.bezierCurveTo(bx + 18, hipY - 46, bx + 22, hipY - 24, bx + 16, hipY + 4); c.closePath();
  ink(c, c1, 4.6);
  const bodyPath = () => ellipse(c, bx, hipY - 22, 20, 26);
  applyPattern(c, sp, bodyPath, bx - 20, hipY - 46, bx + 20, hipY + 2);
  if (sp.o.back === 'silver') { c.save(); bodyPath(); c.clip(); c.fillStyle = '#b8b4ac'; ellipse(c, bx - 3, hipY - 30, 17, 12); c.fill(); c.restore(); }
  // arms
  const aL = sp.o.longArm ? 42 : 30;
  limb2(c, bx - 13, hipY - 36, bx - 24, hipY - 36 + aL * .5, bx - 21 + sw * 5, hipY - 36 + aL, 8, c1);
  limb2(c, bx + 13, hipY - 36, bx + 24, hipY - 36 + aL * .5, bx + 21 - sw * 5, hipY - 36 + aL, 8, c1);
  // head
  const hy = hipY - 58, hx = bx + 2;
  ellipse(c, hx, hy, 15, 15.5); ink(c, c1, 4.4);
  ellipse(c, hx + 2, hy + 5, 10, 8); ink(c, mixc(c2, '#ffffff', .1), 3.4);
  if (sp.o.mane) { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ellipse(c, hx + Math.cos(a) * 15, hy + Math.sin(a) * 15, 7 * sp.o.mane, 7 * sp.o.mane); c.fillStyle = c2; c.fill(); } ellipse(c, hx, hy, 15, 15.5); ink(c, c1, 4.4); ellipse(c, hx + 2, hy + 5, 10, 8); ink(c, mixc(c2, '#fff', .1), 3.4); }
  if (sp.pattern === 'face') { // mandril
    c.fillStyle = c2; ellipse(c, hx - 3, hy + 4, 3.5, 7); c.fill(); ellipse(c, hx + 8, hy + 4, 3.5, 7); c.fill();
    c.fillStyle = '#d64a2a'; ellipse(c, hx + 3, hy + 8, 3, 7); c.fill();
  }
  drawEar(c, hx - 14, hy - 2, 'redonda', 8, c1, shade(c1, -.3));
  drawEar(c, hx + 14, hy - 2, 'redonda', 8, c1, shade(c1, -.3));
  eye(c, hx - 2, hy - 1, 4); eye(c, hx + 7, hy - 1, 4);
  if (sp.o.tail === 'ringed') drawTail(c, bx - 15, hipY - 6, 'ringed', 38, c1, sp.c2, sw * 4);
}

/* ---- CANGURU ---- */
function drawKangaroo(c, sp, t) {
  const c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 60, hop = Math.abs(Math.sin(t * TAU)) * 7;
  const hipY = GND - 30 - hop;
  drawTail(c, bx - 20, hipY + 6, 'short', 8, c1, c2, 0);
  c.beginPath(); c.moveTo(bx - 22, hipY + 8); c.quadraticCurveTo(bx - 46, hipY + 22, bx - 52, GND - 2);
  c.lineWidth = 16; c.strokeStyle = ik; c.lineCap = 'round'; c.stroke(); c.lineWidth = 11.5; c.strokeStyle = c1; c.stroke();
  limb2(c, bx - 6, hipY + 4, bx - 16, hipY + 22 + hop * .3, bx + 6, GND, 12, shade(c1, -.2));
  c.beginPath();
  c.moveTo(bx - 20, hipY + 6); c.bezierCurveTo(bx - 24, hipY - 24, bx - 14, hipY - 40, bx + 2, hipY - 40);
  c.bezierCurveTo(bx + 16, hipY - 38, bx + 18, hipY - 8, bx + 12, hipY + 8); c.closePath(); ink(c, c1, 4.6);
  const bp = () => ellipse(c, bx - 3, hipY - 16, 19, 26);
  applyPattern(c, sp, bp, bx - 22, hipY - 42, bx + 16, hipY + 8);
  limb2(c, bx + 8, hipY - 26, bx + 16, hipY - 16, bx + 12, hipY - 6, 6, c1);
  const hy = hipY - 52, hx = bx + 8;
  limb(c, bx + 4, hipY - 36, hx, hy + 4, 11, c1);
  ellipse(c, hx, hy, 11, 10); ink(c, c1, 4.2);
  ellipse(c, hx + 10, hy + 3, 8, 5.5, .1); ink(c, mixc(c1, '#fff', .1), 3.6);
  ellipse(c, hx + 16, hy + 2, 2.4, 2); c.fillStyle = ik; c.fill();
  drawEar(c, hx - 3, hy - 12, 'long', 12, c1, shade(c1, -.3));
  drawEar(c, hx + 5, hy - 13, 'long', 12, c1, shade(c1, -.3));
  eye(c, hx + 5, hy - 2, 3.6);
}

/* ---- BIRD (ground, flying, water) ---- */
function drawBird(c, sp, t) {
  const o = sp.o, c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const legL = 16 * (o.longLeg || 1), sw = Math.sin(t * TAU);
  const bY = GND - legL - 14, bx = 62;
  limb2(c, bx - 3, bY + 6, bx - 5 + sw * 4, GND - legL * .45, bx - 6 + sw * 7, GND, 4, '#e0a83c');
  limb2(c, bx + 3, bY + 6, bx + 5 - sw * 4, GND - legL * .45, bx + 6 - sw * 7, GND, 4, '#e0a83c');
  if (o.swims) { ellipse(c, bx, GND - 4, 26, 6); c.fillStyle = 'rgba(80,150,190,.5)'; c.fill(); }
  // corpo
  ellipse(c, bx, bY, 24, 17, -.12); ink(c, c1, 4.6);
  const bp = () => { c.beginPath(); c.ellipse(bx, bY, 24, 17, -.12, 0, TAU); };
  applyPattern(c, sp, bp, bx - 24, bY - 17, bx + 24, bY + 17);
  // asa
  const asa = o.wing || 1;
  c.save(); c.translate(bx - 2, bY - 2); c.rotate(sw * .12);
  ellipse(c, 0, 0, 15 * asa, 9 * asa, -.25); ink(c, shade(c1, -.16), 3.6);
  c.restore();
  if (o.tail === 'fan') { // pavão
    for (let i = 0; i < 9; i++) {
      const a = -2.3 + i / 8 * 1.9;
      limb(c, bx - 18, bY + 4, bx - 18 + Math.cos(a) * 46, bY + 4 + Math.sin(a) * 46, 5, i % 2 ? c1 : c2);
      ellipse(c, bx - 18 + Math.cos(a) * 46, bY + 4 + Math.sin(a) * 46, 5, 5); ink(c, '#2f8a7a', 2.4);
    }
  } else if (o.tail === 'long' || o.tail === 'plume') {
    // tail feathers: a short, wide fan, not a thin spear
    for (let i = 0; i < 4; i++) {
      const ang = .18 + i * .16;
      limb(c, bx - 17, bY + 2, bx - 17 - Math.cos(ang) * 34, bY + 2 + Math.sin(ang) * 34, 7 - i, i % 2 ? c2 : c1);
    }
  } else {
    ellipse(c, bx - 24, bY + 3, 11, 7, .35); ink(c, shade(c1, -.2), 3.6);
  }
  // neck + head
  const nl = 16 * (o.neck || 1);
  const hx = bx + 17, hy = bY - 10 - nl;
  limb(c, bx + 12, bY - 6, hx, hy + 4, 9 * (o.neck > 1.2 ? .8 : 1), c1);
  ellipse(c, hx, hy, 10, 9.5); ink(c, o.baldHead || c1, 4.2);
  if (o.crest) {
    for (let i = 0; i < 5; i++) limb(c, hx - 2 + i, hy - 8, hx - 6 + i * 3, hy - 8 - 12 * o.crest, 3, c2);
  }
  // bico
  const bk = o.beak || 'straight', bc = '#e8a82c';
  c.beginPath();
  if (bk === 'hooked') { c.moveTo(hx + 6, hy - 4); c.lineTo(hx + 20, hy - 1); c.quadraticCurveTo(hx + 18, hy + 9, hx + 8, hy + 5); c.closePath(); ink(c, '#e8b83c', 3.4); }
  else if (bk === 'toucan') { c.moveTo(hx + 5, hy - 6); c.quadraticCurveTo(hx + 40, hy - 4, hx + 34, hy + 7); c.quadraticCurveTo(hx + 18, hy + 10, hx + 6, hy + 6); c.closePath(); ink(c, c2, 3.6); }
  else if (bk === 'hornbill') { c.moveTo(hx + 5, hy - 5); c.quadraticCurveTo(hx + 34, hy - 2, hx + 28, hy + 8); c.quadraticCurveTo(hx + 15, hy + 9, hx + 6, hy + 6); c.closePath(); ink(c, c2, 3.6); c.beginPath(); c.ellipse(hx + 16, hy - 9, 12, 5, 0, 0, TAU); ink(c, c2, 3.2); }
  else if (bk === 'long') { c.moveTo(hx + 5, hy - 3); c.lineTo(hx + 32, hy + 1); c.lineTo(hx + 5, hy + 5); c.closePath(); ink(c, bc, 3.2); }
  else if (bk === 'curved') { c.moveTo(hx + 4, hy - 4); c.quadraticCurveTo(hx + 22, hy + 2, hx + 14, hy + 16); c.quadraticCurveTo(hx + 8, hy + 6, hx + 3, hy + 4); c.closePath(); ink(c, '#33302c', 3.2); }
  else if (bk === 'spoon') { c.moveTo(hx + 4, hy - 3); c.lineTo(hx + 22, hy); c.lineTo(hx + 4, hy + 5); c.closePath(); ink(c, '#33302c', 3); c.beginPath(); c.ellipse(hx + 25, hy + 1, 7, 5, 0, 0, TAU); ink(c, '#33302c', 3); }
  else if (bk === 'pouch') { c.moveTo(hx + 4, hy - 4); c.lineTo(hx + 34, hy + 2); c.quadraticCurveTo(hx + 22, hy + 20, hx + 4, hy + 6); c.closePath(); ink(c, bc, 3.4); }
  else if (bk === 'duck') { c.moveTo(hx + 4, hy - 4); c.quadraticCurveTo(hx + 20, hy - 3, hx + 20, hy + 2); c.quadraticCurveTo(hx + 18, hy + 7, hx + 4, hy + 6); c.closePath(); ink(c, c2, 3.4); }
  else if (bk === 'puffin') { c.moveTo(hx + 5, hy - 6); c.quadraticCurveTo(hx + 20, hy, hx + 6, hy + 7); c.closePath(); ink(c, '#e8641c', 3.4); }
  else { c.moveTo(hx + 5, hy - 4); c.lineTo(hx + 19, hy + 1); c.lineTo(hx + 5, hy + 5); c.closePath(); ink(c, bc, 3.2); }
  eye(c, hx + 2, hy - 2, o.bigEye ? 5.5 : 3.4);
}

/* ---- PINGUIM ---- */
function drawPenguin(c, sp, t) {
  const c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 62, sw = Math.sin(t * TAU), bY = GND - 40 + Math.abs(sw) * 1.5;
  for (const d of [-1, 1]) { ellipse(c, bx + d * 8 + sw * d * 3, GND - 3, 8, 4.5); ink(c, '#e8922c', 3); }
  ellipse(c, bx, bY, 20, 30); ink(c, c1, 4.6);
  ellipse(c, bx + 3, bY + 4, 13, 24); ink(c, c2, 3.4);
  for (const d of [-1, 1]) { c.save(); c.translate(bx + d * 18, bY - 2); c.rotate(d * (.25 + sw * .25)); ellipse(c, 0, 6, 5, 15); ink(c, shade(c1, -.1), 3.4); c.restore(); }
  const hy = bY - 34;
  ellipse(c, bx + 1, hy, 15, 14); ink(c, c1, 4.4);
  ellipse(c, bx + 6, hy + 4, 9, 8); ink(c, c2, 3);
  if (sp.o.ruff) { c.beginPath(); c.ellipse(bx + 12, hy + 6, 7, 6, 0, 0, TAU); c.fillStyle = sp.o.ruff; c.fill(); }
  if (sp.o.crest) { for (let i = 0; i < 4; i++) limb(c, bx + 2 - i * 2, hy - 8, bx - 12 - i * 4, hy - 16 - i * 2, 3, '#f2d43c'); }
  c.beginPath(); c.moveTo(bx + 12, hy + 1); c.lineTo(bx + 26, hy + 4); c.lineTo(bx + 12, hy + 7); c.closePath(); ink(c, '#e8922c', 3.2);
  eye(c, bx + 9, hy - 2, 3.4);
}

/* ---- LAGARTO / CROCODILO ---- */
function drawLizard(c, sp, t) {
  const o = sp.o, c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const croc = !!o.croc, bx = 60, sw = Math.sin(t * TAU);
  const bY = GND - (croc ? 10 : 14), bL = croc ? 62 : 42, bH = croc ? 12 : 13;
  for (const d of [-1, 1]) {
    limb2(c, bx + d * bL * .3, bY + 2, bx + d * bL * .3 + d * 12, bY + 8 + sw * d * 2, bx + d * bL * .3 + d * 15, GND, 5, shade(c1, -.2));
  }
  // cauda
  c.beginPath(); c.moveTo(bx - bL * .48, bY);
  c.quadraticCurveTo(bx - bL * .95, bY + 3 + sw * 4, bx - bL * 1.35, bY - 2 + sw * 7);
  c.lineWidth = croc ? 15 : 11; c.strokeStyle = ik; c.lineCap = 'round'; c.stroke();
  c.lineWidth = croc ? 10.5 : 7; c.strokeStyle = c1; c.stroke();
  const bp = () => { c.beginPath(); c.ellipse(bx, bY, bL * .5, bH, 0, 0, TAU); };
  bp(); ink(c, c1, 4.4);
  applyPattern(c, sp, bp, bx - bL * .5, bY - bH, bx + bL * .5, bY + bH);
  if (croc || o.crest) { // crista dorsal
    c.fillStyle = shade(c1, -.3);
    for (let i = 0; i < 9; i++) { const x = bx - bL * .42 + i / 8 * bL * .8; c.beginPath(); c.moveTo(x - 3, bY - bH + 2); c.lineTo(x, bY - bH - 6); c.lineTo(x + 3, bY - bH + 2); c.closePath(); c.fill(); }
  }
  // head
  const fl = (o.longSnout || 1), hx = bx + bL * .52 + (croc ? 12 : 8), hy = bY - 3;
  if (croc) {
    c.beginPath(); c.moveTo(hx - 14, hy - 7); c.lineTo(hx + 22 * fl, hy - 3); c.lineTo(hx + 22 * fl, hy + 3); c.lineTo(hx - 14, hy + 8); c.closePath(); ink(c, c1, 4.2);
    c.strokeStyle = '#fff'; c.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) { const x = hx - 8 + i * 4 * fl; c.beginPath(); c.moveTo(x, hy + 1); c.lineTo(x + 1, hy + 5); c.stroke(); }
    ellipse(c, hx - 8, hy - 8, 5, 4.5); ink(c, c1, 3);
    dotEye(c, hx - 8, hy - 9, 2.6);
  } else {
    ellipse(c, hx, hy, 12 * fl, 8.5); ink(c, c1, 4.2);
    if (o.collar) { c.beginPath(); c.ellipse(hx - 4, hy, 16, 15, 0, 0, TAU); ink(c, c2, 3.4); ellipse(c, hx, hy, 12 * fl, 8.5); ink(c, c1, 4.2); }
    if (o.prong) for (const d of [0, 1]) limb(c, hx + 6 + d * 5, hy - 4, hx + 12 + d * 6, hy - 12, 3, c2);
    dotEye(c, hx + 3, hy - 3, 3);
    limb(c, hx + 11 * fl, hy + 3, hx + 17 * fl, hy + 3, 2, '#d64a4a');
  }
}

/* ---- SERPENTE ---- */
function drawSnake(c, sp, t) {
  const c1 = sp.c1, ik = inkFor(c1); c._ink = ik;
  const cx = 62, cy = GND - 16, ph = t * TAU;
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const a = i / 30 * TAU * 1.55 + ph * .25, r = 30 - i * .72;
    pts.push([cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * .5 - i * .35]);
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => c.lineTo(p[0], p[1]));
  c.lineWidth = 17; c.strokeStyle = ik; c.stroke();
  c.lineWidth = 12.5; c.strokeStyle = c1; c.stroke();
  c.save(); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => c.lineTo(p[0], p[1]));
  c.lineWidth = 12.5; c.stroke(); c.clip();
  c.strokeStyle = sp.c2; c.lineWidth = 3.5;
  for (let i = 0; i < 22; i++) { const p = pts[i]; c.beginPath(); c.arc(p[0], p[1], 5, 0, TAU); c.stroke(); }
  c.restore();
  const hp = pts[pts.length - 1], hx = hp[0], hy = hp[1];
  if (sp.o.hood) { ellipse(c, hx - 6, hy + 2, 15, 13); ink(c, shade(c1, -.12), 4); }
  ellipse(c, hx, hy, 11, 8, -.3); ink(c, c1, 4.2);
  dotEye(c, hx + 3, hy - 3, 2.6);
  c.strokeStyle = '#d64a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx + 9, hy + 1); c.lineTo(hx + 18, hy - 2); c.moveTo(hx + 14, hy - .5); c.lineTo(hx + 18, hy + 3); c.stroke();
  if (sp.o.rattle) { ellipse(c, pts[0][0], pts[0][1], 5, 4); ink(c, '#c9b58a', 3); }
}

/* ---- TARTARUGA ---- */
function drawTurtle(c, sp, t) {
  const c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 60, bY = GND - 16, sw = Math.sin(t * TAU);
  if (sp.o.flipper) {
    for (const d of [-1, 1]) { c.save(); c.translate(bx + d * 20, bY + 6); c.rotate(d * (.6 + sw * .3)); ellipse(c, 0, 8, 6, 16); ink(c, shade(c1, -.15), 3.4); c.restore(); }
  } else {
    for (const d of [-1, 1]) { ellipse(c, bx + d * 18 + sw * d * 3, GND - 4, 8, 5); ink(c, shade(c1, -.15), 3.4); }
  }
  ellipse(c, bx, bY + 8, 30, 9); ink(c, mixc(c1, '#f4ecd8', .5), 3.6); // plastrão
  c.beginPath(); c.ellipse(bx, bY, 30, 20, 0, Math.PI, 0); c.closePath(); ink(c, c2, 4.6);
  c.save(); c.beginPath(); c.ellipse(bx, bY, 30, 20, 0, Math.PI, 0); c.clip();
  c.strokeStyle = shade(c2, -.35); c.lineWidth = 2.4;
  for (let i = 0; i < 5; i++) { const x = bx - 24 + i * 12; c.beginPath(); c.moveTo(x, bY + 2); c.lineTo(x - 3, bY - 22); c.stroke(); }
  c.beginPath(); c.ellipse(bx, bY, 16, 11, 0, Math.PI, 0); c.stroke();
  c.restore();
  const hx = bx + 32, hy = bY - 6 + sw * 1.5;
  limb(c, bx + 24, bY - 2, hx, hy, 9, c1);
  ellipse(c, hx + 3, hy, 9, 7.5); ink(c, c1, 4);
  dotEye(c, hx + 5, hy - 2, 2.6);
  drawTail(c, bx - 29, bY + 2, 'fina', 10, c1, c2, 0);
}

/* ---- AMPHIBIAN ---- */
function drawFrog(c, sp, t) {
  const c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 62, bY = GND - 16, sw = Math.sin(t * TAU) * 2;
  for (const d of [-1, 1]) limb2(c, bx + d * 13, bY + 4, bx + d * 24, bY - 2 + sw, bx + d * 20, GND, 6, shade(c1, -.15));
  for (const d of [-1, 1]) limb2(c, bx + d * 10, bY - 4, bx + d * 19, bY + 6, bx + d * 24, GND, 5, c1);
  ellipse(c, bx, bY, 24, 17); ink(c, c1, 4.6);
  const bp = () => { c.beginPath(); c.ellipse(bx, bY, 24, 17, 0, 0, TAU); };
  applyPattern(c, sp, bp, bx - 24, bY - 17, bx + 24, bY + 17);
  const er = sp.o.bigEye ? 9 : 7;
  for (const d of [-1, 1]) { ellipse(c, bx + d * 9 - 2, bY - 16, er, er); ink(c, c1, 3.6); ellipse(c, bx + d * 9 - 2, bY - 16, er * .62, er * .62); c.fillStyle = sp.o.bigEye ? c2 : '#f2ead8'; c.fill(); ellipse(c, bx + d * 9 - 2, bY - 16, er * .3, er * .42); c.fillStyle = '#191512'; c.fill(); }
  c.strokeStyle = ik; c.lineWidth = 2.4; c.beginPath(); c.arc(bx + 2, bY - 2, 13, .15, 1.0); c.stroke();
  if (sp.o.gills) for (const d of [-1, 1]) for (let i = 0; i < 3; i++) limb(c, bx + d * 14, bY - 10 + i * 4, bx + d * 26, bY - 16 + i * 6, 3, c2);
}

/* ---- FISH / CETACEAN / RAY ---- */
function drawFish(c, sp, t) {
  const o = sp.o, c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 62, bY = GND - 34, sw = Math.sin(t * TAU);
  if (o.ray) { // arraia manta — vista frontal, asas batendo
    c.save(); c.translate(bx, bY);
    const flap = sw * 7;
    // the tail sweeps back; pointing down it touched the ground and the ray
    // turned into a mushroom
    limb(c, -4, 2, -40, 20, 3, shade(c1, -.1));
    const asa = () => {                                     // losango achatado com pontas caídas
      c.beginPath();
      c.moveTo(0, -13);
      c.quadraticCurveTo(-30, -13 - flap, -52, 2 - flap);
      c.quadraticCurveTo(-30, 10, 0, 12);
      c.quadraticCurveTo(30, 10, 52, 2 + flap);
      c.quadraticCurveTo(30, -13 + flap, 0, -13);
      c.closePath();
    };
    asa(); ink(c, c1, 4.6);
    c.save(); asa(); c.clip();
    c.fillStyle = shade(c1, .3); ellipse(c, 0, -4, 15, 9); c.fill();  // dorso mais claro no meio
    c.restore();
    for (const d of [-1, 1]) limb(c, d * 9, -11, d * 14, -21, 4.5, c1); // lobos cefálicos
    dotEye(c, -12, -6, 2.8); dotEye(c, 12, -6, 2.8);
    c.restore(); return;
  }
  const L = o.dolphin ? 34 : 28, Hh = o.spring ? 26 : 16;
  // cauda
  c.save(); c.translate(bx - L, bY); c.rotate(sw * .25);
  c.beginPath();
  if (o.dolphin) { c.moveTo(4, 0); c.lineTo(-16, -9); c.quadraticCurveTo(-8, 0, -16, 9); c.closePath(); }
  else { c.moveTo(4, 0); c.lineTo(-15, -13); c.lineTo(-9, 0); c.lineTo(-15, 13); c.closePath(); }
  ink(c, shade(c1, -.12), 3.8); c.restore();
  // corpo
  c.beginPath();
  c.moveTo(bx - L, bY);
  c.bezierCurveTo(bx - L * .5, bY - Hh, bx + L * .5, bY - Hh * .9, bx + L * (o.longSnout ? 1.35 : 1.05), bY - (o.dolphin ? 2 : 0));
  c.bezierCurveTo(bx + L * .5, bY + Hh * .8, bx - L * .5, bY + Hh, bx - L, bY); c.closePath();
  ink(c, c1, 4.6);
  const bp = () => { c.beginPath(); c.ellipse(bx, bY, L, Hh * .85, 0, 0, TAU); };
  applyPattern(c, sp, bp, bx - L, bY - Hh, bx + L, bY + Hh);
  // barbatana dorsal
  if (o.dorsal !== 0) {
    const bs = o.dorsal || 1;
    c.beginPath(); c.moveTo(bx - 6, bY - Hh * .8); c.quadraticCurveTo(bx + 4, bY - Hh - 14 * bs, bx + 12, bY - Hh * .7); c.closePath(); ink(c, shade(c1, -.15), 3.8);
  }
  // nadadeira peitoral
  c.save(); c.translate(bx + 4, bY + 6); c.rotate(.5 + sw * .2); ellipse(c, 0, 6, 5, 13); ink(c, shade(c1, -.15), 3.4); c.restore();
  if (o.dolphin) { c.strokeStyle = ik; c.lineWidth = 2.4; c.beginPath(); c.arc(bx + L * .78, bY + 2, 9, -.3, .9); c.stroke(); }
  else { c.strokeStyle = ik; c.lineWidth = 2.4; c.beginPath(); c.arc(bx + L * .74, bY + 1, 8, -.2, 1.1); c.stroke(); }
  eye(c, bx + L * .66, bY - 4, 3.4);
}

/* ---- PINNIPED ---- */
function drawSeal(c, sp, t) {
  const c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 60, bY = GND - 15, sw = Math.sin(t * TAU);
  c.save(); c.translate(bx - 28, bY + 2); c.rotate(sw * .18);
  c.beginPath(); c.moveTo(6, 0); c.lineTo(-14, -12); c.lineTo(-8, 0); c.lineTo(-14, 12); c.closePath(); ink(c, shade(c1, -.15), 3.6); c.restore();
  c.beginPath(); c.moveTo(bx - 26, bY);
  c.bezierCurveTo(bx - 18, bY - 22, bx + 14, bY - 22, bx + 22, bY - 26 - sw * 2);
  c.bezierCurveTo(bx + 30, bY + 2, bx + 6, bY + 14, bx - 26, bY); c.closePath(); ink(c, c1, 4.6);
  const bp = () => { c.beginPath(); c.ellipse(bx, bY - 6, 26, 15, -.15, 0, TAU); };
  applyPattern(c, sp, bp, bx - 26, bY - 22, bx + 24, bY + 10);
  c.save(); c.translate(bx - 2, bY + 4); c.rotate(.7 + sw * .15); ellipse(c, 0, 6, 6, 12); ink(c, shade(c1, -.18), 3.4); c.restore();
  const hx = bx + 24, hy = bY - 32 - sw * 2;
  limb(c, bx + 16, bY - 20, hx, hy + 4, 14, c1);
  ellipse(c, hx, hy, 12, 11); ink(c, c1, 4.2);
  if (sp.o.mane) { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ellipse(c, hx + Math.cos(a) * 11, hy + Math.sin(a) * 11, 6, 6); c.fillStyle = shade(c1, -.22); c.fill(); } ellipse(c, hx, hy, 12, 11); ink(c, c1, 4.2); }
  ellipse(c, hx + 8, hy + 4, 7, 5.5); ink(c, mixc(c1, '#fff', .15), 3.2);
  ellipse(c, hx + 13, hy + 3, 2.6, 2.2); c.fillStyle = ik; c.fill();
  if (sp.o.tusk) for (const d of [0, 1]) limb(c, hx + 8, hy + 7, hx + 6 + d * 5, hy + 7 + 16 * sp.o.tusk, 4, '#f2ece0');
  if (sp.o.whiskers) { c.strokeStyle = '#f2ece0'; c.lineWidth = 1.4; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(hx + 9, hy + 3); c.lineTo(hx + 22, hy - 2 + i * 3); c.stroke(); } }
  eye(c, hx + 5, hy - 2, 3.8);
}

/* ---- MORCEGO ---- */
function drawBat(c, sp, t) {
  const c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 62, bY = GND - 42, fl = Math.sin(t * TAU) * .5;
  for (const d of [-1, 1]) {
    c.save(); c.translate(bx + d * 7, bY - 4); c.scale(d, 1); c.rotate(fl * .35);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(20, -14, 40, -4);
    c.quadraticCurveTo(30, 2, 33, 12); c.quadraticCurveTo(24, 4, 20, 14);
    c.quadraticCurveTo(14, 4, 8, 12); c.closePath(); ink(c, c2, 3.8);
    c.strokeStyle = shade(c2, -.3); c.lineWidth = 1.6;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(2, 1); c.lineTo(11 + i * 9, 12 - i * 5); c.stroke(); }
    c.restore();
  }
  ellipse(c, bx, bY, 10, 15); ink(c, c1, 4.2);
  const hy = bY - 17;
  ellipse(c, bx, hy, 10, 9); ink(c, c1, 4);
  drawEar(c, bx - 6, hy - 9, 'ponta', 9, c1, shade(c1, -.3));
  drawEar(c, bx + 6, hy - 9, 'ponta', 9, c1, shade(c1, -.3));
  ellipse(c, bx, hy + 4, 5, 4); ink(c, shade(c1, .18), 2.8);
  dotEye(c, bx - 3.5, hy - 1, 2.4); dotEye(c, bx + 3.5, hy - 1, 2.4);
  for (const d of [-1, 1]) limb(c, bx + d * 4, bY + 13, bx + d * 5, GND - 4, 3, c1);
}

/* ---- INVERTEBRADOS ---- */
function drawBug(c, sp, t) {
  const o = sp.o, c1 = sp.c1, c2 = sp.c2, ik = inkFor(c1); c._ink = ik;
  const bx = 62, bY = GND - 18, sw = Math.sin(t * TAU);
  if (o.butterfly) {
    for (const d of [-1, 1]) {
      c.save(); c.translate(bx, bY - 6); c.scale(d, 1); c.rotate(sw * .2);
      c.beginPath(); c.ellipse(16, -10, 17, 13, -.3, 0, TAU); ink(c, c1, 3.6);
      c.beginPath(); c.ellipse(13, 8, 12, 10, .3, 0, TAU); ink(c, c2, 3.6);
      c.restore();
    }
    ellipse(c, bx, bY - 4, 4, 16); ink(c, '#2f2a24', 3);
    for (const d of [-1, 1]) limb(c, bx, bY - 18, bx + d * 9, bY - 30, 2, '#2f2a24');
    return;
  }
  if (o.spider || o.scorpion) {
    for (let i = 0; i < 4; i++) for (const d of [-1, 1]) {
      const a = -.5 + i * .38;
      limb2(c, bx, bY, bx + d * (16 + i * 3), bY - 12 + i * 4 + sw * 2, bx + d * (24 + i * 5), GND - 2, 3.4, c1);
    }
    ellipse(c, bx - 8, bY, 15, 12); ink(c, c1, 4);
    ellipse(c, bx + 10, bY - 2, 10, 9); ink(c, shade(c1, .1), 3.6);
    if (o.scorpion) {
      for (const d of [-1, 1]) { limb(c, bx + 14, bY + d * 4, bx + 26, bY + d * 9, 4, c2); ellipse(c, bx + 30, bY + d * 11, 6, 4, d * .4); ink(c, c2, 3); }
      const pts = [[bx - 18, bY - 4], [bx - 28, bY - 16], [bx - 26, bY - 30], [bx - 14, bY - 34]];
      for (let i = 0; i < 3; i++) limb(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 6, c2);
      ellipse(c, bx - 10, bY - 34, 5, 5); ink(c, '#d6a02c', 3);
    } else { dotEye(c, bx + 14, bY - 5, 2); dotEye(c, bx + 16, bY - 1, 1.8); }
    return;
  }
  if (o.stick) {
    limb(c, bx - 26, bY + 6, bx + 24, bY - 8, 5, c1);
    for (let i = 0; i < 3; i++) for (const d of [-1, 1]) limb(c, bx - 14 + i * 13, bY + 2 - i * 3, bx - 20 + i * 16, bY + d * 18 - i * 3, 2.4, c2);
    dotEye(c, bx + 22, bY - 9, 2); return;
  }
  if (o.mantis) {
    limb2(c, bx - 4, bY + 4, bx - 14, bY + 12, bx - 20, GND, 3, c1);
    limb2(c, bx + 2, bY + 4, bx + 12, bY + 12, bx + 16, GND, 3, c1);
    c.save(); c.translate(bx, bY); c.rotate(-.35);
    ellipse(c, -12, 4, 18, 8); ink(c, c1, 3.6); c.restore();
    for (const d of [-1, 1]) { limb2(c, bx + 8, bY - 6, bx + 20, bY - 14, bx + 12, bY - 2 + d * 3, 3.4, c2); }
    ellipse(c, bx + 12, bY - 12, 8, 6, -.3); ink(c, c1, 3.4);
    dotEye(c, bx + 15, bY - 15, 2.6); dotEye(c, bx + 9, bY - 15, 2.6);
    return;
  }
  // besouro
  for (let i = 0; i < 3; i++) for (const d of [-1, 1]) limb2(c, bx - 6 + i * 8, bY + 4, bx - 10 + i * 10, bY + 12 + sw * 2, bx - 14 + i * 14, GND, 3.4, '#2f2a24');
  ellipse(c, bx - 2, bY, 22, 15); ink(c, c1, 4.2);
  c.beginPath(); c.moveTo(bx - 22, bY - 2); c.lineTo(bx + 18, bY - 2); c.lineWidth = 2.4; c.strokeStyle = ik; c.stroke();
  ellipse(c, bx + 18, bY - 2, 9, 8); ink(c, shade(c1, -.15), 3.6);
  limb(c, bx + 22, bY - 6, bx + 40, bY - 16, 5, c2);
  limb(c, bx + 22, bY + 1, bx + 38, bY - 6, 4, c2);
  dotEye(c, bx + 20, bY - 5, 2);
}

/* ---- SLOTH / ANTEATER / ARMADILLO ---- */
function drawXenarthra(c, sp, t) {
  if (sp.o.plates) { // tatu
    const c1 = sp.c1, ik = inkFor(c1); c._ink = ik;
    const bx = 60, bY = GND - 16, sw = Math.sin(t * TAU);
    for (const d of [-1, 1]) limb(c, bx + d * 14, bY + 6, bx + d * 15 + sw * d * 3, GND, 6, shade(c1, -.2));
    c.beginPath(); c.ellipse(bx, bY, 27, 17, 0, Math.PI, 0); c.closePath(); ink(c, c1, 4.4);
    c.strokeStyle = shade(c1, -.35); c.lineWidth = 2.6;
    for (let i = 1; i < 6; i++) { const x = bx - 22 + i * 8; c.beginPath(); c.moveTo(x, bY + 1); c.lineTo(x - 2, bY - 18 + Math.abs(i - 3) * 3); c.stroke(); }
    const hx = bx + 30;
    ellipse(c, hx, bY - 4, 11, 7, .12); ink(c, c1, 4);
    drawEar(c, hx - 4, bY - 12, 'long', 7, c1, shade(c1, -.3));
    dotEye(c, hx + 4, bY - 6, 2.4);
    drawTail(c, bx - 27, bY - 2, 'fina', 20, c1, sp.c2, sw * 3);
    return;
  }
  drawQuad(c, sp, t);
}

/* ---- ROTEADOR ---- */
const DRAWER = {
  primate: drawPrimate, kangaroo: drawKangaroo, bird: drawBird, penguin: drawPenguin,
  lizard: drawLizard, snake: drawSnake, turtle: drawTurtle, amphibian: drawFrog,
  fish: drawFish, seal: drawSeal, bat: drawBat, insect: drawBug,
  wader: drawBird, sloth: drawXenarthra,
};
function drawSpecies(c, sp, frame) {
  const t = (frame % FRAMES) / FRAMES;
  c.lineJoin = 'round'; c.lineCap = 'round';
  (DRAWER[sp.plan] || drawQuad)(c, sp, t);
}

/** Measures the highest opaque row of the sprite and keeps it as a fraction of
 *  the frame height. It is what lands the thought bubble just above the animal —
 *  with 219 species of wildly different heights, a fixed offset is always wrong. */
function measureTop(sp, cv) {
  try {
    const c = cv.getContext('2d');
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    for (let y = 0; y < cv.height; y++) {
      const base = y * cv.width * 4;
      for (let x = 0; x < cv.width; x++) {
        if (d[base + x * 4 + 3] > 12) { sp._topN = y / cv.height; return; }
      }
    }
    sp._topN = 0.5;
  } catch (e) { sp._topN = 0.25; }   // canvas sujo: cai num palpite razoável
}
/** the animal's visible height, from the ground to the top of the line, in local units */
const visibleHeight = sp => (GND + PAD) - (sp._topN === undefined ? 40 : sp._topN * SPRH);

/** a ready sprite (canvas) for a species, frame and height in px */
function getSprite(sp, frame, px) {
  const key = sp.id + '|' + frame + '|' + px;
  let cv = spriteCache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  const sc = px / SPR;
  cv.width = Math.ceil(SPR * sc); cv.height = Math.ceil(SPRH * sc);
  const c = cv.getContext('2d');
  c.scale(sc, sc);
  c.translate(0, PAD);              // abre a folga superior
  drawSpecies(c, sp, frame);
  if (sp._topN === undefined) measureTop(sp, cv);
  spriteCache.set(key, cv);
  if (spriteCache.size > 2600) { const k = spriteCache.keys().next().value; spriteCache.delete(k); }
  return cv;
}
/** the sprite's intended height in the world (px at zoom 1).
 *  The exponent compresses the giants: linear, an elephant covered half an enclosure. */
const spriteH = sp => Math.round(26 + 52 * Math.pow(Math.min(sp.scale, 2.3), .85));

/** a NEW canvas with the species' portrait — for putting in the DOM.
 *  Never hand a canvas from spriteCache to the UI: attaching it to the DOM would
 *  tear it out of the cache and the world would stop drawing that species. */
/** A species portrait that fits a maxW x maxH box by construction.
 *  Two reasons not to leave this to CSS:
 *  1) the world frame has 48 units of headroom (horns, necks) — in a portrait
 *     that is an empty band, so the drawing is cropped to its real height;
 *  2) `max-height:100%` does not clamp the canvas inside the shop grid, and the
 *     giraffe (the tallest) spilled 6px out of its box. */
function spriteThumb(sp, maxW, maxH) {
  getSprite(sp, 0, 64);                       // garante a medição de _topN
  const top = (sp._topN === undefined ? .2 : sp._topN) * SPRH;
  const yIni = Math.max(0, top - 5);
  const yEnd = GND + PAD + 5;                 // um respiro abaixo dos pés
  const altLocal = Math.max(10, yEnd - yIni);
  const sc = maxH ? Math.min(maxW / SPR, maxH / altLocal) : maxW / SPR;
  const c2 = document.createElement('canvas');
  c2.width = Math.max(8, Math.round(SPR * sc));
  c2.height = Math.max(8, Math.round(altLocal * sc));
  const c = c2.getContext('2d');
  c.scale(sc, sc);
  c.translate(0, PAD - yIni);
  drawSpecies(c, sp, 0);
  return c2;
}

/* ==========================================================================
   3b. PESSOAS (visitantes e funcionários)
   ========================================================================== */
const PEOPLE_CACHE = new Map();
const SKINS = ['#f2c9a0', '#e0aa78', '#c48a56', '#8a5c38', '#5e3c26', '#f7d9b8'];
const SHIRTS = ['#e2543f', '#3fa5e2', '#4fae4a', '#ffc23c', '#9a6ad4', '#f28ab0', '#2f8a7a', '#e8843c', '#f4f2ec', '#5e6a76'];
const HAIRS = ['#2b2118', '#5e3a20', '#c9a04a', '#8a4a2a', '#3a3a3a', '#d9d2c2'];
const PANTS = ['#3a4a6a', '#5e4a3a', '#33333a', '#6a5a4a', '#4a5a4a'];

/* A fixed cast of visitor looks.
   Sortear cada peça por visitante daria ~79 mil combinações: nenhum sprite
   seria reaproveitado e o cache viveria em despejo. Com um elenco fechado o
   cache fica limitado e ainda há variedade de sobra na multidão. */
const VISITOR_LOOKS = (() => {
  const r = mulberry(20240729), out = [];
  for (let i = 0; i < 22; i++) {
    out.push({
      skin: SKINS[(r() * SKINS.length) | 0],
      shirt: SHIRTS[(r() * SHIRTS.length) | 0],
      pants: PANTS[(r() * PANTS.length) | 0],
      hair: HAIRS[(r() * HAIRS.length) | 0],
      longHair: r() < .45, bald: r() < .08,
      hat: r() < .18 ? SHIRTS[(r() * SHIRTS.length) | 0] : null,
    });
  }
  return out;
})();

function drawPerson(c, o, frame) {
  const t = (frame % FRAMES) / FRAMES, sw = Math.sin(t * TAU);
  const bx = 64, bob = Math.abs(Math.sin(t * TAU)) * 1.2;
  c._ink = '#2c2118';
  const legY = GND - 26;
  limb(c, bx - 3, legY, bx - 4 + sw * 6, GND, 6, o.pants);
  limb(c, bx + 3, legY, bx + 4 - sw * 6, GND, 6, shade(o.pants, -.12));
  // tronco
  roundRectP(c, bx - 11, legY - 30 - bob, 22, 33, 8); ink(c, o.shirt, 4.4);
  if (o.role) { // colete de funcionário
    roundRectP(c, bx - 11, legY - 24 - bob, 22, 14, 4); c.fillStyle = 'rgba(255,255,255,.28)'; c.fill();
  }
  limb(c, bx - 10, legY - 26 - bob, bx - 14 - sw * 5, legY - 8 - bob, 5.5, o.skin);
  limb(c, bx + 10, legY - 26 - bob, bx + 14 + sw * 5, legY - 8 - bob, 5.5, o.skin);
  // head
  const hy = legY - 42 - bob;
  ellipse(c, bx, hy, 11, 12); ink(c, o.skin, 4.4);
  c.save(); ellipse(c, bx, hy, 11, 12); c.clip();
  c.fillStyle = o.hair; ellipse(c, bx, hy - 6 - (o.bald ? 4 : 0), 12, 8); c.fill();
  if (o.longHair) { c.fillStyle = o.hair; roundRectP(c, bx - 12, hy - 6, 24, 18, 6); c.fill(); }
  c.restore();
  if (o.hat) { roundRectP(c, bx - 12, hy - 15, 24, 7, 3); ink(c, o.hat, 3.4); roundRectP(c, bx - 8, hy - 21, 16, 8, 4); ink(c, o.hat, 3.4); }
  dotEye(c, bx - 4, hy, 1.9); dotEye(c, bx + 4, hy, 1.9);
  c.strokeStyle = '#2c2118'; c.lineWidth = 1.8; c.beginPath();
  if (o.mood > .55) c.arc(bx, hy + 3, 4, .3, 2.84);
  else if (o.mood > .3) { c.moveTo(bx - 4, hy + 5); c.lineTo(bx + 4, hy + 5); }
  else c.arc(bx, hy + 8, 4, 3.44, 6);
  c.stroke();
  if (o.role === 'trat') { roundRectP(c, bx - 22, legY - 18, 12, 12, 3); ink(c, '#b5875c', 3.2); }
  if (o.role === 'vet') { roundRectP(c, bx - 22, legY - 18, 12, 11, 3); ink(c, '#f4f2ec', 3.2); c.fillStyle = '#e2543f'; c.fillRect(bx - 18, legY - 15, 4, 6); c.fillRect(bx - 21, legY - 12.5, 10, 3); }
  if (o.role === 'fax') { limb(c, bx - 16, legY - 30, bx - 20, legY - 2, 3, '#8a6a3c'); ellipse(c, bx - 21, legY, 7, 4); ink(c, '#c9b58a', 2.6); }
  if (o.role === 'seg') { roundRectP(c, bx - 11, legY - 30 - bob, 22, 8, 4); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill(); }
}
/** The cache key = everything drawPerson actually draws.
 *  Never use a per-person id: dozens of identical visitors would each take their
 *  own entry and the cache would live in permanent eviction. */
function personKey(o) {
  return [o.skin, o.shirt, o.pants, o.hair, o.longHair ? 1 : 0, o.bald ? 1 : 0,
    o.hat || '-', o.role || '-'].join('|');
}
function getPerson(o, frame, px) {
  const key = personKey(o) + '|' + frame + '|' + px + '|' + (o.mood > .55 ? 2 : o.mood > .3 ? 1 : 0);
  let cv = PEOPLE_CACHE.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  const sc = px / SPR;
  cv.width = Math.ceil(SPR * sc); cv.height = Math.ceil(SPRH * sc);
  const c = cv.getContext('2d'); c.scale(sc, sc);
  c.translate(0, PAD);
  c.lineJoin = 'round'; c.lineCap = 'round';
  drawPerson(c, o, frame);
  PEOPLE_CACHE.set(key, cv);
  if (PEOPLE_CACHE.size > 1800) PEOPLE_CACHE.delete(PEOPLE_CACHE.keys().next().value);
  return cv;
}