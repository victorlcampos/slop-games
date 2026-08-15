// Everything on the field, drawn by hand: five kinds of wall, two kings, two
// siege engines and eight things they throw.
//
// Not one pixel of this comes from a file (rule nº 5), and none of it is a grey
// rectangle either. The look is the one every physics-and-catapult game has
// converged on for a reason: **a heavy ink outline around a saturated fill**.
// The outline is what makes a wall read as an object rather than a region of
// colour, and it is what keeps a castle legible when it is half a screen away
// and on fire.
//
// Three rules hold the style together:
//
//   1. Every solid thing is outlined in `INK`, at `LINE` — no exceptions, or the
//      unoutlined one reads as a hole in the picture.
//   2. Silhouette first, detail second. A block is recognisable by its *top*:
//      stone is crenellated, timber has a shingle roof, iron has a riveted lid,
//      sandbags are tied, crystal comes to a point.
//   3. Nothing is symmetrical if it can help it. The wobble is seeded off the
//      cell, so the same wall looks the same on every frame but no two walls in
//      the castle look alike.

import { CELL, GUN_HEIGHT } from './config.js';
import { material } from './materials.js';

const TAU = Math.PI * 2;

export const INK = '#2a1c14';
export const LINE = 3;

/** roundRect is not everywhere yet, and a path is four lines and four arcs. */
export function rr(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x, y + k);
  ctx.closePath();
}

/** Fill the current path and draw the ink line round it, in that order. */
export function ink(ctx, fill, width = LINE) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * Outline the **union** of a shape made of overlapping pieces.
 *
 * Canvas has no way to stroke the outside of a group of circles, and stroking
 * them one at a time draws every internal edge — which is why the first pass at
 * this had trees and clouds looking like piles of outlined bubbles. The trick is
 * to draw the whole thing in ink first, fattened by a stroke, and then fill the
 * same path in colour on top: what survives is exactly the border.
 */
export function blob(ctx, path, fill, width = LINE) {
  ctx.save();
  path();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = width * 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** A deterministic wobble per cell, so the same wall looks the same every frame. */
function noise(c, r, k = 0) {
  const n = Math.sin((c * 12.9898 + r * 78.233 + k * 37.719) * 43758.5453);
  return n - Math.floor(n);
}

// ------------------------------------------------------------------- walls

/**
 * @param {object} opts
 * @param {string} opts.faction  whose king to draw, if this is the king
 * @param {boolean} opts.top     nothing above it: it gets the decorated lid
 */
export function drawBlock(ctx, b, rect, opts = {}) {
  const m = material(b.m);
  const hurt = 1 - Math.max(0, b.hp) / b.max;
  const { x, y, w, h } = rect;

  ctx.save();
  if (b.shake > 0) {
    ctx.translate((noise(b.c, b.r, 5) - 0.5) * 6 * b.shake, (noise(b.c, b.r, 6) - 0.5) * 6 * b.shake);
  }

  if (b.m === 'king') {
    drawKing(ctx, rect, opts.faction || 'knights', b);
    ctx.restore();
    return;
  }

  if (b.m === 'sand') drawSand(ctx, x, y, w, h, m, b, opts.top);
  else if (b.m === 'wood') drawWood(ctx, x, y, w, h, m, b, opts.top);
  else if (b.m === 'crystal') drawCrystal(ctx, x, y, w, h, m, b, opts.top);
  else if (b.m === 'iron') drawIron(ctx, x, y, w, h, m, b, opts.top);
  else drawStone(ctx, x, y, w, h, m, b, opts.top);

  if (hurt > 0.12) drawCracks(ctx, x, y, w, h, hurt, b);
  if (b.rust > 0) drawRust(ctx, x, y, w, h, b);
  if (b.fire > 0) {
    ctx.save();
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 5);
    ctx.clip();
    ctx.fillStyle = 'rgba(70,18,8,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  ctx.restore();
}

/** The shared body: a rounded, outlined slab with a lit top and a shaded foot. */
function slab(ctx, x, y, w, h, m, radius = 5) {
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, radius);
  ink(ctx, m.side);
  ctx.save();
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, radius);
  ctx.clip();
  ctx.fillStyle = m.face;
  ctx.fillRect(x, y, w, h * 0.62);
  ctx.fillStyle = m.dark;
  ctx.fillRect(x, y + h * 0.84, w, h);
  ctx.restore();
}

function drawStone(ctx, x, y, w, h, m, b, top) {
  slab(ctx, x, y, w, h, m, 6);
  // three courses of masonry, offset by row so a wall is not a grid
  ctx.save();
  rr(ctx, x + 2, y + 2, w - 4, h - 4, 5);
  ctx.clip();
  ctx.strokeStyle = 'rgba(50,38,26,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    ctx.moveTo(x, y + (h * i) / 3);
    ctx.lineTo(x + w, y + (h * i) / 3);
  }
  for (let i = 0; i < 3; i++) {
    const off = (b.r + i) % 2 ? 0.34 : 0.66;
    ctx.moveTo(x + w * off, y + (h * i) / 3);
    ctx.lineTo(x + w * off, y + (h * (i + 1)) / 3);
  }
  ctx.stroke();
  ctx.fillStyle = m.grain;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 3; i++) {
    const n1 = noise(b.c, b.r, i);
    const n2 = noise(b.c, b.r, i + 20);
    ctx.beginPath();
    ctx.ellipse(x + 6 + n1 * (w - 12), y + 6 + n2 * (h - 12), 3 + n1 * 3, 2 + n2 * 2, n1 * 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  if (top) crenellations(ctx, x, y, w, m);
}

/** The tell-tale of a castle: square teeth along the top of the wall. */
function crenellations(ctx, x, y, w, m) {
  const n = 3;
  const tw = w / (n * 2 - 1);
  for (let i = 0; i < n; i++) {
    const tx = x + i * tw * 2;
    rr(ctx, tx + 1, y - 11, tw - 2, 13, 2);
    ink(ctx, m.face, 2.5);
  }
}

function drawWood(ctx, x, y, w, h, m, b, top) {
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 4);
  ink(ctx, m.side);
  ctx.save();
  rr(ctx, x + 2, y + 2, w - 4, h - 4, 4);
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const ph = (h - 3) / 3;
    const py = y + 1.5 + i * ph;
    ctx.fillStyle = i % 2 ? m.face : m.side;
    ctx.fillRect(x, py, w, ph);
    ctx.strokeStyle = m.dark;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const g = noise(b.c, b.r, i);
    ctx.moveTo(x, py + ph * 0.45 + g * 4);
    ctx.quadraticCurveTo(x + w / 2, py + ph * 0.2 + g * 7, x + w, py + ph * 0.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(45,26,12,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, py + ph);
    ctx.lineTo(x + w, py + ph);
    ctx.stroke();
  }
  ctx.restore();
  // iron nails at the corners, which is most of what says "this is built"
  ctx.fillStyle = '#4a3524';
  for (const [px, py] of [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]]) {
    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, TAU);
    ctx.fill();
  }
  if (top) {
    // a shingle roof: two slopes meeting over the middle of the beam
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 1);
    ctx.lineTo(x + w / 2, y - 13);
    ctx.lineTo(x + w + 3, y + 1);
    ctx.closePath();
    ink(ctx, '#8a4a2a', 2.5);
    ctx.strokeStyle = 'rgba(45,26,12,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 13);
    ctx.lineTo(x + w / 2, y + 1);
    ctx.stroke();
  }
}

function drawSand(ctx, x, y, w, h, m, b, top) {
  for (let i = 0; i < 2; i++) {
    const sh = (h - 5) / 2;
    const sy = y + 2.5 + i * sh;
    const off = (noise(b.c, b.r, i) - 0.5) * 5;
    rr(ctx, x + 1.5 + off, sy, w - 3, sh - 1, sh * 0.42);
    ink(ctx, i % 2 ? m.side : m.face, 2.5);
    ctx.strokeStyle = 'rgba(90,66,26,0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let s = 1; s < 4; s++) {
      const sx = x + off + (s * w) / 4;
      ctx.moveTo(sx, sy + 3);
      ctx.lineTo(sx, sy + sh - 4);
    }
    ctx.stroke();
    // the tied ear of the sack, the thing that makes it read as cloth
    ctx.beginPath();
    ctx.ellipse(x + 5 + off, sy + sh / 2, 3, 4.5, 0.5, 0, TAU);
    ink(ctx, m.grain, 2);
  }
  if (top) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 1, w * 0.22, 4, 0, 0, TAU);
    ink(ctx, m.grain, 2);
  }
}

function drawCrystal(ctx, x, y, w, h, m, b, top) {
  // Only the top of a column comes to a point. A stack of pointed gems left a
  // wedge of sky between every pair of them and read as a row of ornaments
  // rather than a wall — the shape has to tile.
  const p = top ? 15 : 2;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 1 - p);
  ctx.lineTo(x + w - 2, y + (top ? h * 0.24 : 4));
  ctx.lineTo(x + w - 2, y + h - 1);
  ctx.lineTo(x + 2, y + h - 1);
  ctx.lineTo(x + 2, y + (top ? h * 0.24 : 4));
  ctx.closePath();
  ink(ctx, m.side);

  ctx.save();
  ctx.clip();
  ctx.fillStyle = m.face;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - p);
  ctx.lineTo(x + w * 0.86, y + h * 0.3);
  ctx.lineTo(x + w * 0.62, y + h);
  ctx.lineTo(x + w * 0.14, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = m.grain;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + h * 0.16);
  ctx.lineTo(x + w * 0.42, y + h * 0.16);
  ctx.lineTo(x + w * 0.34, y + h * 0.82);
  ctx.lineTo(x + w * 0.22, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIron(ctx, x, y, w, h, m, b, top) {
  slab(ctx, x, y, w, h, m, 4);
  ctx.save();
  rr(ctx, x + 2, y + 2, w - 4, h - 4, 4);
  ctx.clip();
  // the seam and the hazard chevron: it should read as manufactured, not quarried
  ctx.strokeStyle = 'rgba(20,28,40,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.56);
  ctx.lineTo(x + w, y + h * 0.56);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,190,60,0.5)';
  for (let i = -1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 11, y + h - 2);
    ctx.lineTo(x + i * 11 + 5, y + h - 2);
    ctx.lineTo(x + i * 11 + 11, y + h - 9);
    ctx.lineTo(x + i * 11 + 6, y + h - 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = m.grain;
  ctx.strokeStyle = 'rgba(20,28,40,0.6)';
  ctx.lineWidth = 1;
  for (const [px, py] of [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]]) {
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  if (top) {
    rr(ctx, x - 2, y - 9, w + 4, 11, 3);
    ink(ctx, m.side, 2.5);
    ctx.fillStyle = '#ffb03a';
    ctx.beginPath();
    ctx.arc(x + w / 2, y - 3.5, 2.6, 0, TAU);
    ctx.fill();
  }
}

function drawCracks(ctx, x, y, w, h, hurt, b) {
  ctx.save();
  // clipped to the cell: a crack wanders two thirds of a block from where it
  // started, and unclipped the deepest ones came out as scratches in the air
  // beside a wall rather than damage to it
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = `rgba(30,20,14,${0.45 + hurt * 0.45})`;
  ctx.lineWidth = 1.4 + hurt * 2.2;
  ctx.lineCap = 'round';
  const n = Math.ceil(hurt * 4);
  for (let i = 0; i < n; i++) {
    const a = noise(b.c, b.r, i + 40) * TAU;
    const cx = x + w / 2 + Math.cos(a) * w * 0.18;
    const cy = y + h / 2 + Math.sin(a) * h * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    let px = cx;
    let py = cy;
    for (let k = 0; k < 3; k++) {
      px += Math.cos(a + (noise(b.c, b.r, i * 3 + k) - 0.5) * 2) * (w * 0.24);
      py += Math.sin(a + (noise(b.c, b.r, i * 3 + k + 9) - 0.5) * 2) * (h * 0.24);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRust(ctx, x, y, w, h, b) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#c0641f';
  for (let i = 0; i < 7; i++) {
    const n1 = noise(b.c, b.r, i + 60);
    const n2 = noise(b.c, b.r, i + 70);
    ctx.beginPath();
    ctx.arc(x + 4 + n1 * (w - 8), y + 4 + n2 * (h - 8), 2.5 + n1 * 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------- kings

/**
 * The crown, with a face on it.
 *
 * Big eyes and a readable expression, because he is the thing the whole match is
 * about and he is one cell tall. The face changes with what is left of him:
 * cheerful, worried, and then not looking at anything.
 */
export function drawKing(ctx, rect, faction, b) {
  const { x, y, w, h } = rect;
  const dead = b && b.hp <= 0;
  const hurt = b ? 1 - Math.max(0, b.hp) / b.max : 0;

  ctx.save();
  ctx.translate(x + w / 2, y + h);
  if (dead) ctx.rotate(0.85);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, -1, w * 0.42, 4, 0, 0, TAU);
  ctx.fill();

  if (faction === 'machines') drawEmperor(ctx, w, h, hurt, dead);
  else drawCrownedKing(ctx, w, h, hurt, dead);
  ctx.restore();
}

/** Two big whites with a pupil that drifts, or two crosses. */
function eyes(ctx, s, dead, hurt, spread = 3.4, size = 2.6) {
  for (const dx of [-spread, spread]) {
    if (dead) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dx * s - 2.2, -2.2);
      ctx.lineTo(dx * s + 2.2, 2.2);
      ctx.moveTo(dx * s + 2.2, -2.2);
      ctx.lineTo(dx * s - 2.2, 2.2);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.ellipse(dx * s, 0, size * s * 0.95, size * s * 1.15, 0, 0, TAU);
    ink(ctx, '#ffffff', 1.6);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(dx * s + (dx > 0 ? 0.7 : -0.2) * s, hurt > 0.5 ? 0.6 * s : 0, size * s * 0.46, 0, TAU);
    ctx.fill();
  }
}

function drawCrownedKing(ctx, w, h, hurt, dead) {
  const s = h / 40;
  // robe
  ctx.beginPath();
  ctx.moveTo(-11 * s, 0);
  ctx.quadraticCurveTo(-10 * s, -14 * s, -7.5 * s, -18 * s);
  ctx.lineTo(7.5 * s, -18 * s);
  ctx.quadraticCurveTo(10 * s, -14 * s, 11 * s, 0);
  ctx.closePath();
  ink(ctx, dead ? '#6d3245' : '#c0335a', 2.5);
  ctx.fillStyle = '#f6ecd2';
  ctx.fillRect(-2.4 * s, -17 * s, 4.8 * s, 16 * s);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-2.4 * s, -17 * s, 4.8 * s, 16 * s);

  // head
  ctx.beginPath();
  ctx.ellipse(0, -22 * s, 7.6 * s, 7 * s, 0, 0, TAU);
  ink(ctx, '#f4cba0', 2.5);
  // beard, which is the silhouette that says "king" at forty pixels
  ctx.beginPath();
  ctx.moveTo(-6.4 * s, -21 * s);
  ctx.quadraticCurveTo(-4.6 * s, -11 * s, 0, -12.5 * s);
  ctx.quadraticCurveTo(4.6 * s, -11 * s, 6.4 * s, -21 * s);
  ctx.quadraticCurveTo(0, -17.5 * s, -6.4 * s, -21 * s);
  ctx.closePath();
  ink(ctx, '#f2ece0', 2);

  ctx.save();
  ctx.translate(0, -23.8 * s);
  eyes(ctx, s, dead, hurt, 3.8, 3);
  ctx.restore();
  if (!dead) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (hurt > 0.5) ctx.arc(0, -18.4 * s, 2 * s, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, -19.6 * s, 2 * s, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // crown
  ctx.beginPath();
  ctx.moveTo(-7.6 * s, -27 * s);
  ctx.lineTo(-7.6 * s, -32.5 * s);
  ctx.lineTo(-3.8 * s, -29.4 * s);
  ctx.lineTo(0, -34.5 * s);
  ctx.lineTo(3.8 * s, -29.4 * s);
  ctx.lineTo(7.6 * s, -32.5 * s);
  ctx.lineTo(7.6 * s, -27 * s);
  ctx.closePath();
  ink(ctx, hurt > 0.6 ? '#c99a16' : '#ffd646', 2.5);
  ctx.fillStyle = '#ff4f6a';
  ctx.beginPath();
  ctx.arc(0, -28.4 * s, 1.4 * s, 0, TAU);
  ctx.fill();
}

function drawEmperor(ctx, w, h, hurt, dead) {
  const s = h / 40;
  // chassis
  rr(ctx, -9 * s, -19 * s, 18 * s, 19 * s, 3 * s);
  ink(ctx, dead ? '#48525f' : '#66788c', 2.5);
  ctx.fillStyle = '#404c5a';
  ctx.fillRect(-9 * s, -10 * s, 18 * s, 2.5 * s);
  // reactor
  ctx.beginPath();
  ctx.arc(0, -14 * s, 2.8 * s, 0, TAU);
  ink(ctx, dead ? '#5c3030' : hurt > 0.5 ? '#ff8a3a' : '#4ce0ff', 2);

  // head
  rr(ctx, -7 * s, -29 * s, 14 * s, 11 * s, 2.6 * s);
  ink(ctx, '#7d8fa6', 2.5);
  // visor with two lamps behind it — the machine version of eyes
  rr(ctx, -5.4 * s, -26.6 * s, 10.8 * s, 5.6 * s, 1.6 * s);
  ink(ctx, '#161d26', 1.8);
  ctx.save();
  ctx.translate(0, -23.8 * s);
  ctx.fillStyle = dead ? '#4a2020' : hurt > 0.5 ? '#ffb03a' : '#4ce0ff';
  if (dead) {
    for (const dx of [-2.6, 2.6]) {
      ctx.save();
      ctx.translate(dx * s, 0);
      ctx.rotate(dx > 0 ? -0.4 : 0.4);
      ctx.fillRect(-1.6 * s, -0.7 * s, 3.2 * s, 1.4 * s);
      ctx.restore();
    }
  } else {
    for (const dx of [-2.6, 2.6]) {
      ctx.beginPath();
      ctx.ellipse(dx * s, 0, 1.9 * s, hurt > 0.5 ? 1 * s : 1.7 * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // a crown of antennae, because an emperor is an emperor
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const dx of [-5, 0, 5]) {
    ctx.moveTo(dx * s, -29 * s);
    ctx.lineTo(dx * s * 1.2, -34.5 * s + Math.abs(dx) * 0.5 * s);
  }
  ctx.stroke();
  ctx.strokeStyle = hurt > 0.6 ? '#c99a16' : '#ffd646';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.arc(dx * s, -34.8 * s + Math.abs(dx) * 0.42 * s, 1.7 * s, 0, TAU);
    ink(ctx, '#ffd646', 1.8);
  }
}

// ------------------------------------------------------------- the engines

/**
 * The siege engine, which now stands on the roof of its own castle.
 *
 * Both are drawn around a pivot at (0, -GUN_HEIGHT) so the arm and the muzzle
 * flash agree with the physics: the shot really does leave the end of the arm.
 */
export function drawLauncher(ctx, L, faction, opts = {}) {
  ctx.save();
  ctx.translate(L.x, L.y);
  ctx.scale(L.dir, 1);
  const a = -L.angle * (Math.PI / 180);
  const recoil = L.recoil || 0;

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, -2, 30, 6, 0, 0, TAU);
  ctx.fill();

  if (faction === 'machines') drawMortar(ctx, a, recoil, opts);
  else drawTrebuchet(ctx, a, recoil, opts);
  ctx.restore();
}

function drawTrebuchet(ctx, a, recoil, opts) {
  const P = -GUN_HEIGHT;
  // the A-frame
  ctx.beginPath();
  ctx.moveTo(-20, -1);
  ctx.lineTo(-4, P);
  ctx.lineTo(4, P);
  ctx.lineTo(20, -1);
  ctx.closePath();
  ink(ctx, '#a05f2c', 3);
  ctx.beginPath();
  ctx.moveTo(-13, -14);
  ctx.lineTo(13, -14);
  ink(ctx, null, 3);
  // the sill it is bolted to
  rr(ctx, -26, -7, 52, 8, 3);
  ink(ctx, '#7a4520', 3);

  // the throwing arm — this is what the player is actually aiming
  ctx.save();
  ctx.translate(0, P);
  ctx.rotate(a + recoil * 0.9);
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(40, 0);
  ink(ctx, null, 6);
  ctx.strokeStyle = '#c98a44';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  // counterweight
  rr(ctx, -30, -8, 16, 16, 4);
  ink(ctx, '#5e5348', 2.5);
  ctx.fillStyle = '#3d352c';
  ctx.fillRect(-26, -4, 8, 3);
  // sling
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(35, 12);
  ctx.stroke();
  if (opts.loaded) {
    ctx.beginPath();
    ctx.arc(34, 14, 6, 0, TAU);
    ink(ctx, '#9aa1a8', 2.5);
  }
  ctx.restore();

  // the banner, which is nine tenths of the personality for four lines of code
  ctx.save();
  ctx.translate(20, -6);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -34);
  ink(ctx, null, 3);
  const wave = Math.sin((opts.time || 0) * 3.6) * 2.5;
  ctx.beginPath();
  ctx.moveTo(1, -34);
  ctx.lineTo(20 + wave, -30);
  ctx.lineTo(13 + wave, -25);
  ctx.lineTo(20 + wave, -20);
  ctx.lineTo(1, -22);
  ctx.closePath();
  ink(ctx, '#c0335a', 2.5);
  ctx.restore();
}

function drawMortar(ctx, a, recoil, opts) {
  const P = -GUN_HEIGHT;
  // tracks
  rr(ctx, -28, -15, 56, 15, 7);
  ink(ctx, '#39434f', 3);
  ctx.fillStyle = '#5c6b7d';
  for (let i = -23; i <= 18; i += 8) {
    rr(ctx, i, -13, 5, 11, 2);
    ctx.fill();
  }
  // hull
  rr(ctx, -19, P - 4, 38, 20, 5);
  ink(ctx, '#63768c', 3);
  // exhaust stack
  rr(ctx, -22, P - 16, 8, 14, 3);
  ink(ctx, '#4a5665', 2.5);
  // core
  ctx.beginPath();
  ctx.arc(-4, P + 4, 4, 0, TAU);
  ink(ctx, '#4ce0ff', 2);

  // the barrel
  ctx.save();
  ctx.translate(2, P);
  ctx.rotate(a);
  const back = recoil * 8;
  rr(ctx, -10 - back, -7, 44, 14, 5);
  ink(ctx, '#55637a', 3);
  rr(ctx, 22 - back, -9, 14, 18, 4);
  ink(ctx, '#7d90a8', 2.5);
  ctx.beginPath();
  ctx.arc(35 - back, 0, 4.5, 0, TAU);
  ink(ctx, '#1c232c', 2);
  if (recoil > 0.1) {
    ctx.fillStyle = `rgba(255,200,110,${recoil * 0.85})`;
    ctx.beginPath();
    ctx.moveTo(36 - back, -9 * recoil);
    ctx.lineTo(36 + 34 * recoil - back, 0);
    ctx.lineTo(36 - back, 9 * recoil);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(2, P, 8, 0, TAU);
  ink(ctx, '#46525f', 2.5);
}

// --------------------------------------------------------------- munitions

export function drawShot(ctx, s, spin) {
  const a = Math.atan2(s.vy, s.vx);
  ctx.save();
  ctx.translate(s.x, s.y);

  switch (s.w) {
    case 'boulder':
    case 'hail': {
      ctx.rotate(spin);
      const r = s.w === 'hail' ? 9 : 12;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ink(ctx, '#a49a86', 3);
      ctx.fillStyle = '#7d7461';
      ctx.beginPath();
      ctx.arc(r * 0.32, r * 0.28, r * 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d6cfbe';
      ctx.beginPath();
      ctx.arc(-r * 0.32, -r * 0.36, r * 0.26, 0, TAU);
      ctx.fill();
      break;
    }
    case 'firepot': {
      ctx.rotate(spin * 0.5);
      rr(ctx, -8, -9, 16, 18, 5);
      ink(ctx, '#a3612f', 3);
      ctx.fillStyle = '#6d3c15';
      ctx.fillRect(-5, -12, 10, 4);
      ctx.beginPath();
      ctx.arc(0, -15, 5 + Math.sin(spin * 6) * 2, 0, TAU);
      ink(ctx, '#ffae2e', 2);
      break;
    }
    case 'ballista': {
      ctx.rotate(a);
      rr(ctx, -18, -2.6, 28, 5.2, 2);
      ink(ctx, '#8a5a2e', 2.5);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(7, -6);
      ctx.lineTo(7, 6);
      ctx.closePath();
      ink(ctx, '#d8dee6', 2.5);
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-26, -6);
      ctx.lineTo(-23, 0);
      ctx.lineTo(-26, 6);
      ctx.closePath();
      ink(ctx, '#f2ece0', 2);
      break;
    }
    case 'railshot': {
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(120,220,255,0.35)';
      ctx.fillRect(-28, -4, 30, 8);
      rr(ctx, -9, -5, 20, 10, 4);
      ink(ctx, '#dff6ff', 2.5);
      ctx.beginPath();
      ctx.arc(5, 0, 3, 0, TAU);
      ink(ctx, '#3ec8ff', 1.6);
      break;
    }
    case 'rustshell': {
      ctx.rotate(a);
      rr(ctx, -12, -6.5, 24, 13, 5);
      ink(ctx, '#7d8a56', 3);
      ctx.beginPath();
      ctx.arc(8, 0, 4, 0, TAU);
      ink(ctx, '#c0641f', 2);
      ctx.fillStyle = '#a3b06a';
      ctx.fillRect(-10, -4, 6, 8);
      break;
    }
    case 'tesla': {
      ctx.fillStyle = 'rgba(120,220,255,0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 14 + Math.sin(spin * 9) * 2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, TAU);
      ink(ctx, '#eaffff', 2);
      ctx.strokeStyle = '#7fe0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const tt = spin * 4 + (i * TAU) / 4;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(tt) * 16, Math.sin(tt) * 16);
      }
      ctx.stroke();
      break;
    }
    default: {
      // the drill
      ctx.rotate(a);
      rr(ctx, -14, -6.5, 20, 13, 4);
      ink(ctx, '#5c6b7d', 3);
      ctx.beginPath();
      ctx.moveTo(21, 0);
      ctx.lineTo(6, -8);
      ctx.lineTo(6, 8);
      ctx.closePath();
      ink(ctx, '#d8dee6', 2.5);
      ctx.strokeStyle = '#8ea3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const o = ((spin * 3 + i) % 3) * 5;
        ctx.moveTo(6 + o, -7 + o * 0.42);
        ctx.lineTo(6 + o, 7 - o * 0.42);
      }
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/** The little pip drawn on the weapon dock — the same munition, half the size. */
export function drawShotIcon(ctx, id, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawShot(ctx, { w: id, x: 0, y: 0, vx: 1, vy: -0.35 }, 0.6);
  ctx.restore();
}

export { CELL };
