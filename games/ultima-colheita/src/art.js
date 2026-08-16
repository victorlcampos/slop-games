// Every sprite in the game, drawn out of rectangles at draw time — no image
// ships with the file (CLAUDE.md, rule nº 5).
//
// The style contract, learned by putting screenshots beside the reference:
// everything that stands gets a dark outline and a drop shadow, everything is
// painted at 1x and upscaled nearest-neighbour (the scene canvas in render.js
// owns that), and the ground is never plain — a field carries flowers, a road
// carries cart ruts, a roof carries its winter snow.

import { TILE } from './config.js';

// ------------------------------------------------------------------ palette

const OUTLINE = '#241b10';
const PLASTER = '#ecdcb2';
const TIMBER = '#6b4a2b';
const TIMBER_DARK = '#4e3620';
const STONE = '#9a9da6';
const STONE_DARK = '#73767f';
const STONE_LINE = '#5d6068';
const SHINGLE = '#9c4430';
const SHINGLE_LIT = '#b85c3c';
const SHINGLE_DARK = '#702f22';
const THATCH = '#d2ab50';
const THATCH_LIT = '#e2bf68';
const THATCH_DARK = '#a5813a';
const SNOW = '#eef3f6';
const SHADOW = 'rgba(30,26,16,0.32)';

/** The ground, by season — winter is the horde's colour scheme on purpose. */
export const GROUND = {
  spring: { base: '#63a24b', dark: '#5f9e48', lit: '#75b258', blade: '#4c8639' },
  summer: { base: '#74a648', dark: '#70a145', lit: '#86b656', blade: '#5c8c36' },
  autumn: { base: '#98984a', dark: '#949447', lit: '#aaa75a', blade: '#7c7c38' },
  winter: { base: '#cdd6da', dark: '#c9d3d7', lit: '#dde5e8', blade: '#a9b8bf' },
};

const DIRT = { base: '#997a55', dark: '#8f7250', lit: '#a8895f', rut: 'rgba(90,66,45,0.4)' };

// ------------------------------------------------------------- the outliner

// Two scratch canvases, reused for every outlined sprite: A holds the sprite,
// B its silhouette. Ninety small blits a frame is nothing; what mattered was
// never allocating in the draw loop.
let scrA = null;
let scrB = null;

function scratchPair(w, h) {
  if (!scrA || scrA.width < w || scrA.height < h) {
    const W = Math.max(w, scrA ? scrA.width : 0);
    const H = Math.max(h, scrA ? scrA.height : 0);
    scrA = Object.assign(document.createElement('canvas'), { width: W, height: H });
    scrB = Object.assign(document.createElement('canvas'), { width: W, height: H });
  }
  return [scrA, scrB];
}

/**
 * Paint `paint(c)` (drawing from local origin) at (x, y) with a 1px dark
 * outline around its silhouette — the single biggest thing that makes flat
 * rectangles read as *sprites*. `w`, `h` bound the drawing, origin included;
 * allow slack for anything that spills (a pine's tip, a tower's flag).
 */
export function outlined(ctx, x, y, w, h, paint, color = OUTLINE) {
  const pad = 2;
  const W = Math.ceil(w + pad * 2);
  const H = Math.ceil(h + pad * 2);
  const [a, b] = scratchPair(W, H);
  const ca = a.getContext('2d');
  const cb = b.getContext('2d');

  ca.clearRect(0, 0, W, H);
  ca.save();
  ca.translate(pad, pad);
  paint(ca);
  ca.restore();

  cb.clearRect(0, 0, W, H);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    cb.drawImage(a, 0, 0, W, H, dx, dy, W, H);
  }
  cb.globalCompositeOperation = 'source-in';
  cb.fillStyle = color;
  cb.fillRect(0, 0, W, H);
  cb.globalCompositeOperation = 'source-over';

  ctx.drawImage(b, 0, 0, W, H, x - pad, y - pad, W, H);
  ctx.drawImage(a, 0, 0, W, H, x - pad, y - pad, W, H);
}

// ------------------------------------------------------------------- ground

export function drawGrassTile(ctx, x, y, season, salt) {
  const g = GROUND[season];
  // a soft diagonal checker keeps the field from reading as one flat sheet —
  // the salt is c*31 + r*17, so its parity IS (c+r)'s, which is the checker
  ctx.fillStyle = salt % 2 ? g.base : g.dark;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = g.lit;
  ctx.fillRect(x + ((salt * 7) % 22) + 3, y + ((salt * 13) % 20) + 4, 5, 3);
  ctx.fillRect(x + ((salt * 23) % 16) + 8, y + ((salt * 5) % 22) + 2, 3, 2);
  ctx.fillStyle = g.blade;
  const bx = x + ((salt * 17) % 20) + 4;
  const by = y + ((salt * 29) % 18) + 6;
  ctx.fillRect(bx, by, 2, 5);
  ctx.fillRect(bx + 3, by + 2, 2, 4);

  // life in the margins: flowers while things grow, leaves as they fall,
  // patches of old snow once nothing does
  if ((season === 'spring' || season === 'summer') && salt % 7 === 3) {
    const fx = x + ((salt * 11) % 18) + 5;
    const fy = y + ((salt * 19) % 16) + 6;
    const petal = salt % 2 ? '#f2ede0' : '#e2788a';
    ctx.fillStyle = petal;
    ctx.fillRect(fx - 2, fy, 2, 2);
    ctx.fillRect(fx + 2, fy, 2, 2);
    ctx.fillRect(fx, fy - 2, 2, 2);
    ctx.fillRect(fx, fy + 2, 2, 2);
    ctx.fillStyle = '#e8c04a';
    ctx.fillRect(fx, fy, 2, 2);
  } else if (season === 'autumn' && salt % 5 === 1) {
    ctx.fillStyle = salt % 2 ? '#c07a35' : '#a3622c';
    ctx.fillRect(x + ((salt * 13) % 22) + 4, y + ((salt * 7) % 20) + 5, 3, 2);
    ctx.fillRect(x + ((salt * 23) % 18) + 6, y + ((salt * 17) % 18) + 9, 2, 2);
  } else if (season === 'winter' && salt % 3 === 0) {
    ctx.fillStyle = SNOW;
    ctx.fillRect(x + ((salt * 11) % 18) + 2, y + ((salt * 19) % 16) + 4, 9, 5);
  }
}

/**
 * The dirt road through the village. `axis` is 'v', 'h' or 'x' (a crossing):
 * the cart ruts run along it, because a road is something carts have used.
 */
export function drawPathTile(ctx, x, y, season, salt, axis = 'v') {
  ctx.fillStyle = salt % 2 ? DIRT.base : DIRT.dark;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = DIRT.lit;
  ctx.fillRect(x + ((salt * 13) % 20) + 3, y + ((salt * 7) % 20) + 4, 6, 3);
  ctx.fillStyle = 'rgba(90,66,45,0.35)';
  ctx.fillRect(x + ((salt * 19) % 22) + 2, y + ((salt * 11) % 22) + 3, 3, 3);
  ctx.fillRect(x + ((salt * 29) % 16) + 9, y + ((salt * 23) % 18) + 8, 3, 2);

  ctx.fillStyle = DIRT.rut;
  if (axis === 'v' || axis === 'x') {
    ctx.fillRect(x + 8, y, 3, TILE);
    ctx.fillRect(x + TILE - 11, y, 3, TILE);
  }
  if (axis === 'h' || axis === 'x') {
    ctx.fillRect(x, y + 9, TILE, 3);
    ctx.fillRect(x, y + TILE - 12, TILE, 3);
  }
  if (season === 'winter') {
    ctx.fillStyle = 'rgba(238,243,246,0.55)';
    ctx.fillRect(x, y, TILE, 4);
    ctx.fillRect(x + ((salt * 7) % 20), y + 12, 8, 3);
  }
}

/** Grass creeping over a road edge — `side` is which edge of the tile. */
export function drawRoadFringe(ctx, x, y, season, salt, side) {
  const g = GROUND[season];
  ctx.fillStyle = salt % 2 ? g.base : g.dark;
  const bites = [4 + (salt % 5), 14 + ((salt * 3) % 6), 24 + ((salt * 7) % 5)];
  for (const b of bites) {
    const len = 5 + ((salt + b) % 4);
    if (side === 'l') ctx.fillRect(x, y + b, 3, len);
    else if (side === 'r') ctx.fillRect(x + TILE - 3, y + b, 3, len);
    else if (side === 'u') ctx.fillRect(x + b, y, len, 3);
    else ctx.fillRect(x + b, y + TILE - 3, len, 3);
  }
}

export function drawTree(ctx, x, y, season, salt) {
  const s = TILE;
  const wob = (salt % 5) - 2;
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + s / 2, y + s - 3, s * 0.42, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const dark = season === 'winter' ? '#2c4f34' : season === 'autumn' ? '#5f7030' : '#2e5b2b';
  const mid = season === 'winter' ? '#3c6644' : season === 'autumn' ? '#7c8b3a' : '#3f7a35';
  const lit = season === 'winter' ? '#4f7d57' : season === 'autumn' ? '#98a44c' : '#5ba04a';

  if (salt % 3 === 0) {
    // a pine: stacked shelves narrowing to a tip, taller than its tile
    outlined(ctx, x - 2, y - s * 0.2, s + 4, s * 1.3, (c) => {
      const ox = 2 - wob < 0 ? 0 : 2;
      c.fillStyle = TIMBER_DARK;
      c.fillRect(s / 2 + wob, s * 0.92, 5, s * 0.34);
      const tiers = [
        [3 + wob + ox, s * 0.72, s - 4, s * 0.26],
        [6 + wob + ox, s * 0.48, s - 10, s * 0.28],
        [10 + wob + ox, s * 0.26, s - 18, s * 0.26],
        [14 + wob + ox, s * 0.1, s - 26, s * 0.2],
      ];
      tiers.forEach(([tx, ty, tw, th], i) => {
        c.fillStyle = i % 2 ? mid : dark;
        c.fillRect(tx, ty, tw, th);
      });
      c.fillStyle = lit;
      c.fillRect(8 + wob + ox, s * 0.52, s * 0.2, s * 0.1);
      if (season === 'winter') {
        c.fillStyle = SNOW;
        tiers.forEach(([tx, ty, tw]) => c.fillRect(tx, ty, tw, 3));
      }
    });
    return;
  }

  // a broadleaf: a fat stacked canopy that spills past its tile
  outlined(ctx, x - 4, y - 3, s + 8, s + 4, (c) => {
    c.fillStyle = TIMBER;
    c.fillRect(s / 2 + 1 + wob, s * 0.58, 6, s * 0.42);
    c.fillStyle = TIMBER_DARK;
    c.fillRect(s / 2 + 1 + wob, s * 0.58, 2, s * 0.42);
    c.fillStyle = dark;
    c.fillRect(2 + wob, s * 0.33, s + 4, s * 0.4);
    c.fillRect(6 + wob, s * 0.15, s - 4, s * 0.3);
    c.fillStyle = mid;
    c.fillRect(5 + wob, s * 0.05, s - 2, s * 0.42);
    c.fillRect(1 + wob, s * 0.29, s * 0.42, s * 0.3);
    c.fillStyle = lit;
    c.fillRect(8 + wob, s * 0.09, s * 0.44, s * 0.24);
    c.fillRect(5 + wob, s * 0.35, s * 0.22, s * 0.14);
    // a few leaf pixels past the edge sell the mass as foliage, not a box
    c.fillStyle = mid;
    c.fillRect(wob + s * 0.1, s * 0.02, 4, 3);
    c.fillRect(wob + s * 0.85, s * 0.2, 4, 3);
    if (season === 'winter') {
      c.fillStyle = SNOW;
      c.fillRect(5 + wob, s * 0.05, s - 2, 4);
      c.fillRect(1 + wob, s * 0.27, s * 0.32, 3);
    }
  });
}

export function drawRock(ctx, x, y, season, salt) {
  const s = TILE;
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + s / 2, y + s - 5, s * 0.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  outlined(ctx, x + 1, y + 3, s - 2, s - 6, (c) => {
    c.fillStyle = STONE_DARK;
    c.fillRect(2, 9, s - 6, s - 18);
    c.fillRect(9, 3, s - 16, 10);
    c.fillStyle = STONE;
    c.fillRect(5, 6, s - 16, s - 20);
    c.fillStyle = '#b4b7bf';
    c.fillRect(7, 5 + (salt % 3), 7, 5);
    c.fillStyle = STONE_LINE;
    c.fillRect(6 + (salt % 6), s - 16, s - 16, 2);
    c.fillRect(12, 9, 2, s - 22);
    if (season === 'winter') {
      c.fillStyle = SNOW;
      c.fillRect(7, 3, s - 14, 3);
    }
  });
}

// ------------------------------------------------------------- scene props

/**
 * The range that closes the valley's north side — the reference frames its
 * village in peaks, and a border of trees alone read as a hedge, not a place.
 * Painted once into the terrain cache, behind the treeline.
 */
/** One jagged skyline: points from (0..boardW), heights dealt by the seed. */
function ridgeline(boardW, skirt, seed, drop, scale) {
  const pts = [];
  const step = 16;
  for (let i = 0, x = 0; x <= boardW + step; i++, x += step) {
    const s1 = (seed * 31 + i * 47) % 23;
    const s2 = (seed * 17 + i * 73) % 31;
    const peaky = i % 4 === 1 || i % 7 === 5;
    const h = (20 + s1 + (peaky ? 34 + s2 : s2 * 0.4)) * scale;
    pts.push({ x: Math.min(x, boardW), y: Math.max(5 + drop, skirt - h) });
  }
  return pts;
}

export function drawMountains(ctx, boardW, season, seed = 7) {
  // The skirt sits two and a half tiles in: the range must clear the top HUD
  // or the player only ever sees its feet. The dead from the north walk out
  // from behind the peaks — the minimap is how you watch them coming.
  const skirt = 80;
  const winter = season === 'winter';

  // two ridges, far then near — one silhouette behind another is what makes
  // a range read as deep instead of as a paper cutout
  const layers = [
    { seed: seed + 5, drop: 0, scale: 0.72, rock: winter ? '#97a2ad' : '#7e838d', shade: 0.1, snow: false, outline: false, base: 8 },
    { seed, drop: 0, scale: 1, rock: winter ? '#aeb8c1' : '#9aa0aa', shade: 0.14, snow: true, outline: true, base: 0 },
  ];

  ctx.fillStyle = winter ? '#8b96a1' : '#70757f';
  ctx.fillRect(0, 0, boardW, skirt);

  for (const L of layers) {
    const pts = ridgeline(boardW, skirt - L.base, L.seed, L.drop, L.scale);
    // the body: ridge down to the skirt
    ctx.fillStyle = L.rock;
    ctx.beginPath();
    ctx.moveTo(0, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(boardW, skirt);
    ctx.lineTo(0, skirt);
    ctx.closePath();
    ctx.fill();
    // every east-falling slope is in its own shadow
    ctx.fillStyle = `rgba(20,16,26,${L.shade})`;
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i + 1].y <= pts[i].y) continue;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.lineTo(pts[i + 1].x, skirt);
      ctx.lineTo(pts[i].x, skirt);
      ctx.closePath();
      ctx.fill();
    }
    // snow draped along the ridge — that is what "far away" looks like
    if (L.snow) {
      ctx.fillStyle = SNOW;
      ctx.beginPath();
      ctx.moveTo(0, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      for (let i = pts.length - 1; i >= 0; i--) {
        ctx.lineTo(pts[i].x + 2, Math.min(skirt - 6, pts[i].y + 9));
      }
      ctx.closePath();
      ctx.fill();
    }
    if (L.outline) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  // the range's foot fades into the valley floor
  ctx.fillStyle = 'rgba(36,27,16,0.25)';
  ctx.fillRect(0, skirt - 2, boardW, 4);

  // pines against the skirts, the way the reference stands them
  for (let i = 0; i < 14; i++) {
    const salt = (seed * 17 + i * 41) % 113;
    const px2 = (i / 14) * boardW + (salt % 30) - 15;
    drawTree(ctx, px2, skirt - 22 + (salt % 10), season, 3 * ((salt % 7) + 1));
  }
}

/** A lamp post at a road's edge — the reference lines its roads with them. */
export function drawLamp(ctx, x, y, season) {
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 26, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  outlined(ctx, x - 5, y - 14, 16, 42, (c) => {
    c.fillStyle = TIMBER_DARK;
    c.fillRect(6, 8, 3, 32);
    c.fillRect(3, 8, 9, 3);
    c.fillStyle = '#3a3229';
    c.fillRect(4, 0, 7, 9);
    c.fillStyle = '#ffd97a';
    c.fillRect(5, 2, 5, 6);
    c.fillStyle = '#fff3c8';
    c.fillRect(6, 3, 2, 3);
    if (season === 'winter') {
      c.fillStyle = SNOW;
      c.fillRect(3, 0, 9, 2);
    }
  });
}

/** The village well: stone ring, posts, a little roof and the bucket rope. */
export function drawWell(ctx, x, y, season) {
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + 12, y + 24, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  outlined(ctx, x - 3, y - 12, 30, 40, (c) => {
    c.fillStyle = STONE_DARK;
    c.fillRect(2, 16, 22, 10);
    c.fillStyle = STONE;
    c.fillRect(4, 18, 18, 6);
    c.fillStyle = '#1d2a33';
    c.fillRect(7, 18, 12, 4);
    c.fillStyle = TIMBER_DARK;
    c.fillRect(3, 4, 2, 14);
    c.fillRect(21, 4, 2, 14);
    c.fillStyle = season === 'winter' ? SNOW : SHINGLE;
    c.fillRect(0, 0, 26, 5);
    c.fillStyle = '#3a3229';
    c.fillRect(12, 5, 1, 9);
    c.fillStyle = TIMBER;
    c.fillRect(10, 12, 5, 4);
  });
}

/** Barrels and a crate — the clutter that makes a yard look worked in. */
export function drawClutter(ctx, x, y, salt) {
  outlined(ctx, x, y, 24, 16, (c) => {
    c.fillStyle = '#8a5f33';
    c.fillRect(0, 4, 9, 11);
    c.fillStyle = '#9c7040';
    c.fillRect(1, 5, 7, 9);
    c.fillStyle = '#5e421f';
    c.fillRect(0, 7, 9, 2);
    c.fillRect(0, 11, 9, 2);
    if (salt % 2) {
      c.fillStyle = '#a8823f';
      c.fillRect(11, 6, 10, 9);
      c.fillStyle = '#8a6a30';
      c.fillRect(11, 6, 10, 2);
      c.fillStyle = TIMBER_DARK;
      c.fillRect(15, 6, 2, 9);
    }
  });
}

// ---------------------------------------------------------- shared builders

function shadow(ctx, x, y, w, h) {
  ctx.fillStyle = SHADOW;
  ctx.fillRect(x + 2, y + h - 4, w - 2, 5);
}

/** A timber-framed wall: plaster panel, beams around and across it. */
function timberWall(ctx, x, y, w, h) {
  ctx.fillStyle = PLASTER;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(120,90,50,0.18)';
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillStyle = TIMBER;
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + w - 3, y, 3, h);
  if (w > 22) ctx.fillRect(x + w / 2 - 1, y, 3, h);
  if (w > 40) {
    ctx.fillRect(x + w / 4, y, 2, h);
    ctx.fillRect(x + (w * 3) / 4, y, 2, h);
  }
}

function stoneWall(ctx, x, y, w, h) {
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = STONE;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = STONE_LINE;
  for (let ly = y + 6; ly < y + h - 3; ly += 7) ctx.fillRect(x + 2, ly, w - 4, 1);
  for (let i = 0; i < Math.floor(w / 12); i++) {
    ctx.fillRect(x + 6 + i * 12 + ((i % 2) * 5), y + 3 + (i % 2) * 7, 1, 5);
  }
}

/**
 * A fat roof: lit ridge, staggered courses like laid shingle, eave shadow —
 * and its winter snow, because a roof that ignores the season breaks the lie.
 */
function roof(ctx, x, y, w, h, kind = 'shingle', season = 'summer') {
  const [base, litC, darkC] = kind === 'thatch'
    ? [THATCH, THATCH_LIT, THATCH_DARK]
    : [SHINGLE, SHINGLE_LIT, SHINGLE_DARK];
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = litC;
  ctx.fillRect(x, y, w, Math.max(3, h * 0.22));
  ctx.fillStyle = darkC;
  ctx.fillRect(x, y + h - 3, w, 3);
  // staggered courses: rows of short dashes, offset like brickwork
  for (let row = 0; row < 3; row++) {
    const ry = y + h * 0.3 + row * (h * 0.22);
    if (ry > y + h - 4) break;
    for (let lx = x + 3 + (row % 2) * 5; lx < x + w - 4; lx += 10) {
      ctx.fillRect(lx, ry, 6, 1);
    }
  }
  if (season === 'winter') {
    ctx.fillStyle = SNOW;
    ctx.fillRect(x, y, w, Math.max(4, h * 0.3));
    ctx.fillRect(x + w * 0.15, y + h * 0.3, w * 0.2, 3);
    ctx.fillRect(x + w * 0.6, y + h * 0.3, w * 0.25, 3);
  }
}

function door(ctx, x, y, w, h) {
  ctx.fillStyle = TIMBER_DARK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = TIMBER;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 1);
  ctx.fillStyle = TIMBER_DARK;
  ctx.fillRect(x + w / 2, y + 1, 1, h - 1);
  ctx.fillStyle = '#c8a232';
  ctx.fillRect(x + w - 3, y + h / 2, 1, 2);
}

function windowPane(ctx, x, y, w = 6, h = 6) {
  ctx.fillStyle = TIMBER_DARK;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#8fb6c9';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#c6dde8';
  ctx.fillRect(x, y, w / 2, h / 2);
}

/** A fence run with posts and two rails — every field in the reference. */
function fence(ctx, x, y, w) {
  ctx.fillStyle = TIMBER;
  ctx.fillRect(x, y + 2, w, 2);
  ctx.fillRect(x, y + 6, w, 2);
  ctx.fillStyle = TIMBER_DARK;
  for (let px2 = x; px2 <= x + w - 3; px2 += 10) ctx.fillRect(px2, y, 3, 10);
}

// ------------------------------------------------------------- the buildings

/**
 * One entry per building id. Each paints into a w×h tile box from the local
 * origin; `opts.season` skins crops and roofs, `opts.link` joins walls.
 * They draw into the outliner's scratch, so local coordinates only.
 */
const BUILDERS = {
  hall(c, s, opts) {
    const w = s * 2;
    const season = opts.season || 'summer';
    stoneWall(c, 1, s * 0.9, w - 2, s * 1.06);
    timberWall(c, 1, s * 0.4, w - 2, s * 0.54);
    roof(c, -3, -s * 0.16, w + 6, s * 0.58, 'shingle', season);
    c.fillStyle = STONE_DARK;
    c.fillRect(w - s * 0.45, -s * 0.42, 9, s * 0.34);
    c.fillStyle = STONE;
    c.fillRect(w - s * 0.45 + 1, -s * 0.42, 7, 3);
    door(c, w / 2 - 6, s * 1.44, 13, s * 0.5);
    windowPane(c, s * 0.3, s * 1.14, 7, 8);
    windowPane(c, w - s * 0.55, s * 1.14, 7, 8);
    windowPane(c, s * 0.5, s * 0.52, 7, 7);
    windowPane(c, w - s * 0.72, s * 0.52, 7, 7);
    // the banner that says "this is the one you cannot lose"
    c.fillStyle = TIMBER_DARK;
    c.fillRect(w / 2 - 1, -s * 0.6, 3, s * 0.5);
    c.fillStyle = '#c8a232';
    c.beginPath();
    c.moveTo(w / 2 + 2, -s * 0.58);
    c.lineTo(w / 2 + 2 + s * 0.46, -s * 0.46);
    c.lineTo(w / 2 + 2, -s * 0.34);
    c.closePath();
    c.fill();
    c.fillStyle = SHADOW;
    c.fillRect(3, s * 0.44, w - 6, 2);
  },
  house(c, s, opts) {
    timberWall(c, 2, s * 0.42, s - 4, s * 0.52);
    roof(c, 0, s * 0.08, s, s * 0.38, 'thatch', opts.season);
    door(c, s / 2 - 4, s * 0.6, 8, s * 0.34);
    windowPane(c, s * 0.14, s * 0.56, 5, 5);
    // the woodpile by the door: somebody lives here
    c.fillStyle = '#9a6b3a';
    c.fillRect(s - 10, s * 0.78, 8, 3);
    c.fillRect(s - 9, s * 0.68, 7, 3);
    c.fillStyle = '#c8a34e';
    c.fillRect(s - 4, s * 0.78, 2, 3);
  },
  farm(c, s, opts) {
    const w = s * 2;
    const season = opts.season || 'spring';
    c.fillStyle = '#7a5a36';
    c.fillRect(1, 3, w - 2, s * 2 - 4);
    c.fillStyle = '#6a4d2e';
    for (let i = 0; i < 4; i++) c.fillRect(3, 6 + i * (s / 2), w - 6, 3);
    for (let i = 0; i < 4; i++) {
      const ry = 10 + i * (s / 2);
      if (season === 'spring') {
        // sprouts: little green Vs poking out of the furrow
        c.fillStyle = '#84c25a';
        for (let px2 = 6; px2 < w - 8; px2 += 8) {
          c.fillRect(px2, ry, 2, 3);
          c.fillRect(px2 + 3, ry - 1, 2, 4);
        }
      } else if (season === 'summer') {
        // wheat standing tall, heads catching the light
        c.fillStyle = '#cbb75a';
        c.fillRect(4, ry - 3, w - 8, 8);
        c.fillStyle = '#e2d174';
        for (let px2 = 6; px2 < w - 8; px2 += 6) c.fillRect(px2, ry - 3, 2, 3);
      } else if (season === 'autumn') {
        // the pumpkin harvest — the year's one crop of colour
        c.fillStyle = '#d9a940';
        c.fillRect(4, ry, w - 8, 3);
        for (let px2 = 7; px2 < w - 10; px2 += 11) {
          c.fillStyle = '#d2691e';
          c.fillRect(px2, ry - 4, 7, 6);
          c.fillStyle = '#e8853a';
          c.fillRect(px2 + 1, ry - 3, 2, 4);
          c.fillStyle = '#4a6a2c';
          c.fillRect(px2 + 3, ry - 6, 2, 3);
        }
      } else {
        c.fillStyle = '#dfe6ea';
        c.fillRect(4, ry, w - 8, 3);
      }
    }
    fence(c, 0, -3, w);
    fence(c, 0, s * 2 - 6, w);
    // side rails close the pen — a field fenced on two sides reads as a gap
    c.fillStyle = TIMBER;
    c.fillRect(0, 0, 2, s * 2 - 2);
    c.fillRect(w - 2, 0, 2, s * 2 - 2);
    c.fillStyle = TIMBER_DARK;
    for (let py = 2; py < s * 2 - 6; py += 12) {
      c.fillRect(0, py, 3, 4);
      c.fillRect(w - 3, py, 3, 4);
    }
  },
  sawmill(c, s, opts) {
    c.fillStyle = TIMBER;
    c.fillRect(2, s * 0.34, s - 4, s * 0.6);
    c.fillStyle = TIMBER_DARK;
    for (let ly = s * 0.42; ly < s * 0.9; ly += 6) c.fillRect(2, ly, s - 4, 2);
    roof(c, 0, s * 0.06, s, s * 0.32, 'shingle', opts.season);
    c.fillStyle = '#9a6b3a';
    c.fillRect(s - 12, s * 0.55, 10, 4);
    c.fillRect(s - 10, s * 0.47, 8, 4);
    c.fillStyle = '#c8a34e';
    c.fillRect(s - 4, s * 0.55, 2, 4);
    c.fillStyle = '#d8d3c2';
    c.beginPath();
    c.arc(8, s * 0.52, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = TIMBER_DARK;
    c.beginPath();
    c.arc(8, s * 0.52, 2, 0, Math.PI * 2);
    c.fill();
  },
  quarry(c, s) {
    c.fillStyle = '#6e7178';
    c.fillRect(1, 6, s - 2, s - 8);
    c.fillStyle = '#54575e';
    c.fillRect(4, 10, s - 8, s - 14);
    c.fillStyle = STONE;
    c.fillRect(7, s - 12, 8, 6);
    c.fillRect(s - 13, 12, 7, 6);
    c.fillStyle = TIMBER;
    c.fillRect(3, 2, 3, s * 0.5);
    c.fillRect(s - 6, 2, 3, s * 0.5);
    c.fillRect(3, 2, s - 6, 3);
    c.fillStyle = '#3a3229';
    c.fillRect(s / 2 - 1, 5, 1, 8);
  },
  market(c, s, opts) {
    timberWall(c, 2, s * 0.5, s - 4, s * 0.44);
    c.fillStyle = '#b8433a';
    c.fillRect(0, s * 0.16, s, s * 0.34);
    c.fillStyle = '#ece5d2';
    for (let i = 0; i < 3; i++) c.fillRect(3 + i * 10, s * 0.16, 5, s * 0.34);
    if (opts.season === 'winter') {
      c.fillStyle = SNOW;
      c.fillRect(0, s * 0.16, s, 4);
    }
    c.fillStyle = SHINGLE_DARK;
    c.fillRect(0, s * 0.46, s, 2);
    c.fillStyle = '#a8823f';
    c.fillRect(3, s * 0.72, 8, 8);
    c.fillStyle = '#8a6a30';
    c.fillRect(3, s * 0.72, 8, 2);
    // the goods on the counter: apples out front
    c.fillStyle = '#c0392b';
    c.fillRect(13, s * 0.76, 3, 3);
    c.fillRect(17, s * 0.76, 3, 3);
    c.fillRect(15, s * 0.73, 3, 3);
  },
  barracks(c, s, opts) {
    const w = s * 2;
    stoneWall(c, 1, s * 0.5, w - 2, s * 1.45);
    c.fillStyle = STONE_DARK;
    for (let i = 0; i < 5; i++) c.fillRect(2 + i * ((w - 8) / 4), s * 0.36, 8, 10);
    if (opts.season === 'winter') {
      c.fillStyle = SNOW;
      for (let i = 0; i < 5; i++) c.fillRect(2 + i * ((w - 8) / 4), s * 0.36, 8, 3);
    }
    door(c, w / 2 - 6, s * 1.5, 13, s * 0.44);
    windowPane(c, s * 0.3, s * 0.9, 5, 8);
    windowPane(c, w - s * 0.45, s * 0.9, 5, 8);
    // a war banner over the gate: red cloth, gold boss, swallow-tailed
    c.fillStyle = TIMBER_DARK;
    c.fillRect(w / 2 - 7, s * 1.0, 15, 2);
    c.fillStyle = '#a03a30';
    c.fillRect(w / 2 - 5, s * 1.04, 11, 12);
    c.beginPath();
    c.moveTo(w / 2 - 5, s * 1.04 + 12);
    c.lineTo(w / 2 - 5 + 3, s * 1.04 + 16);
    c.lineTo(w / 2, s * 1.04 + 12);
    c.lineTo(w / 2 + 3, s * 1.04 + 16);
    c.lineTo(w / 2 + 6, s * 1.04 + 12);
    c.closePath();
    c.fill();
    c.fillStyle = '#c8a232';
    c.fillRect(w / 2 - 1, s * 1.08, 3, 3);
    c.fillStyle = '#b8433a';
    c.fillRect(w - s * 0.4, s * 0.1, 3, s * 0.34);
    c.beginPath();
    c.moveTo(w - s * 0.4 + 3, s * 0.12);
    c.lineTo(w - s * 0.4 + 13, s * 0.2);
    c.lineTo(w - s * 0.4 + 3, s * 0.28);
    c.closePath();
    c.fill();
  },
  range(c, s, opts) {
    const w = s * 2;
    timberWall(c, 1, s * 1.2, w * 0.45, s * 0.74);
    roof(c, -1, s * 0.9, w * 0.5, s * 0.34, 'thatch', opts.season);
    const cx = w - s * 0.55;
    const cy = s * 0.55;
    c.fillStyle = TIMBER;
    c.fillRect(cx - 2, cy, 4, s * 0.55);
    for (const [rad, col] of [[s * 0.34, '#ece5d2'], [s * 0.22, '#b8433a'], [s * 0.1, '#ece5d2']]) {
      c.fillStyle = col;
      c.beginPath();
      c.arc(cx, cy, rad, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = TIMBER_DARK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 8, cy - 12);
    c.lineTo(cx - 2, cy - 3);
    c.moveTo(cx + 9, cy - 8);
    c.lineTo(cx + 3, cy - 1);
    c.stroke();
    c.fillStyle = THATCH;
    c.fillRect(w * 0.5, s * 1.5, 12, 9);
    c.fillStyle = THATCH_DARK;
    c.fillRect(w * 0.5, s * 1.53 + 3, 12, 2);
  },
  wall(c, s, opts) {
    const link = opts.link || {};
    // the body reaches into every linked neighbour so a run of walls reads as
    // one rampart instead of a row of crates
    const x0 = link.l ? -2 : 3;
    const x1 = link.r ? s + 2 : s - 3;
    const y0 = link.u ? -2 : 5;
    const y1 = link.d ? s + 2 : s - 2;
    c.fillStyle = STONE_DARK;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = STONE;
    c.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 6);
    // volume: a lit west edge and a shaded east edge, so a long vertical run
    // reads as a rampart with faces instead of a flat grey column
    c.fillStyle = '#b3b8c0';
    c.fillRect(x0 + 2, y0 + 2, 3, y1 - y0 - 6);
    c.fillStyle = STONE_LINE;
    c.fillRect(x1 - 5, y0 + 2, 3, y1 - y0 - 6);
    c.fillRect(x0 + 2, s * 0.45, x1 - x0 - 4, 1);
    c.fillRect(s * 0.5, y0 + 2, 1, y1 - y0 - 8);
    // mortar courses across the body
    for (let ly = Math.max(y0 + 6, 6); ly < y1 - 6; ly += 9) {
      c.fillRect(x0 + 4, ly, x1 - x0 - 8, 1);
    }
    if (!link.u) {
      c.fillStyle = '#aab0b8';
      for (let i = 0; i < 3; i++) c.fillRect(3 + i * ((s - 6) / 3) + 1, 0, (s - 6) / 3 - 3, 6);
      if (opts.season === 'winter') {
        c.fillStyle = SNOW;
        for (let i = 0; i < 3; i++) c.fillRect(3 + i * ((s - 6) / 3) + 1, 0, (s - 6) / 3 - 3, 2);
      }
    }
  },
  tower(c, s, opts) {
    // the tower stands taller than its tile — it is allowed to break the grid
    stoneWall(c, 5, -8, s - 10, s + 4);
    c.fillStyle = STONE_DARK;
    for (let i = 0; i < 3; i++) c.fillRect(4 + i * ((s - 12) / 2), -14, 6, 8);
    if (opts.season === 'winter') {
      c.fillStyle = SNOW;
      for (let i = 0; i < 3; i++) c.fillRect(4 + i * ((s - 12) / 2), -14, 6, 3);
    }
    c.fillStyle = '#2e3138';
    c.fillRect(s / 2 - 2, -2, 4, 7);
    c.fillStyle = '#c8a232';
    c.fillRect(s / 2 - 1, -22, 2, 9);
    c.beginPath();
    c.moveTo(s / 2 + 1, -21);
    c.lineTo(s / 2 + 9, -17.5);
    c.lineTo(s / 2 + 1, -14);
    c.closePath();
    c.fill();
  },
};

/** How far past its tile box each building may draw — the outliner's slack. */
const OVERFLOW = { hall: 24, tower: 26, wall: 4, range: 6, farm: 6 };

export function drawBuilding(ctx, id, x, y, opts = {}) {
  const f = opts.built ?? 1;
  const painter = BUILDERS[id];
  if (!painter) return;
  const spec = opts.spec || { w: 1, h: 1 };
  const over = OVERFLOW[id] || 8;
  const w = spec.w * TILE;
  const h = spec.h * TILE;

  if (f < 1) {
    // scaffolding: the outline of what is coming, filling from the ground up
    ctx.save();
    ctx.globalAlpha = 0.35 + f * 0.5;
    outlined(ctx, x - over, y - over, w + over * 2, h + over * 2, (c) => {
      c.translate(over, over);
      painter(c, TILE, opts);
    });
    ctx.restore();
    ctx.strokeStyle = '#f2e7d0';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x + 4, y + 2, 2, 12);
    ctx.fillStyle = '#c8a232';
    ctx.fillRect(x + 6, y + 3, 7, 5);
    return;
  }

  shadow(ctx, x, y, w, h);
  outlined(ctx, x - over, y - over, w + over * 2, h + over * 2, (c) => {
    c.translate(over, over);
    painter(c, TILE, opts);
  });
  if (opts.hurt) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

// ----------------------------------------------------------- the walking kind

function mobShadow(ctx, x, y, w = 9) {
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x, y + 10, w, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

const px = (n) => Math.round(n);

/**
 * Villager-shaped things share one body: boots, tunic, head, and whatever the
 * profession adds. Local coordinates, centred on (10, 16) — the outliner
 * places it.
 */
function body(c, bob, { tunic, skin = '#e3b58a', head = tunic }) {
  c.fillStyle = '#3a3229';
  c.fillRect(6, 22 + bob, 3, 4);
  c.fillRect(11, 22 - bob, 3, 4);
  c.fillStyle = tunic;
  c.fillRect(5, 12, 10, 11);
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(5, 19, 10, 3);
  c.fillStyle = skin;
  c.fillRect(7, 5, 7, 7);
  c.fillStyle = head;
  c.fillRect(6, 3, 9, 4);
  // two dot eyes: the difference between a figure and a doll
  c.fillStyle = '#2b2118';
  c.fillRect(8, 8, 1, 2);
  c.fillRect(12, 8, 1, 2);
}

export function drawUnit(ctx, u, x, y, time) {
  const bob = Math.round(Math.sin(time * 9 + u.id) * 1.5);
  mobShadow(ctx, x, y);
  outlined(ctx, x - 13, y - 18, 28, 34, (c) => {
    c.translate(3, 2);
    if (u.kind === 'soldier') {
      body(c, bob, { tunic: '#5b6c9e', head: '#aab3c4' });
      c.fillStyle = '#aab3c4';
      c.fillRect(9, 5, 2, 4);
      c.fillStyle = '#b8433a'; // the plume
      c.fillRect(9, 0, 3, 4);
      c.fillStyle = '#d8d3c2'; // the sword arm
      c.fillRect(15, 7, 2, 11);
      c.fillRect(14, 14, 4, 2);
      c.fillStyle = '#7a5230';
      c.fillRect(0, 12, 5, 9);
      c.fillStyle = '#c8a232';
      c.fillRect(1, 15, 3, 3);
    } else {
      body(c, bob, { tunic: '#5e7a3c', head: '#46602c' });
      c.strokeStyle = '#c8a34e';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(17, 13, 5, -Math.PI / 2.2, Math.PI / 2.2);
      c.stroke();
      c.strokeStyle = '#d8d3c2';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(17, 8);
      c.lineTo(17, 18);
      c.stroke();
      c.fillStyle = '#8a674f';
      c.fillRect(2, 8, 3, 8);
    }
  });
  drawHpPip(ctx, x, y - 16, u.hp / (u.kind === 'soldier' ? 60 : 40));
}

/** A townsperson going about their day — pure scenery, the sim never sees them. */
export function drawVillager(ctx, v, x, y, time) {
  const bob = Math.round(Math.sin(time * 8 + v.seed * 7) * 1.5);
  mobShadow(ctx, x, y, 7);
  const tunics = ['#8a5a3a', '#6e7a4a', '#7a4a5a', '#5a6a7a'];
  outlined(ctx, x - 12, y - 18, 26, 34, (c) => {
    c.translate(2, 2);
    body(c, bob, { tunic: tunics[v.seed % tunics.length], head: '#5d3d22' });
    if (v.seed % 3 === 0) {
      c.fillStyle = '#c8a34e';
      c.fillRect(14, 7, 6, 4);
    }
  });
}

/** The livestock: a sheep or a chicken pecking around the yards. */
export function drawCritter(ctx, v, x, y, time) {
  const bob = Math.round(Math.sin(time * 6 + v.seed * 5) * 1);
  if (v.kind === 'sheep') {
    mobShadow(ctx, x, y - 2, 8);
    outlined(ctx, x - 10, y - 12, 22, 20, (c) => {
      c.fillStyle = '#3a3229';
      c.fillRect(4, 12 + bob, 2, 4);
      c.fillRect(13, 12 - bob, 2, 4);
      c.fillStyle = '#ece8dd';
      c.fillRect(2, 3, 15, 10);
      c.fillRect(4, 1, 11, 3);
      c.fillStyle = '#d9d3c4';
      c.fillRect(2, 10, 15, 3);
      c.fillStyle = '#4a3f33';
      c.fillRect(0, 5, 5, 5);
      c.fillStyle = '#2b2118';
      c.fillRect(1, 6, 1, 2);
    });
  } else {
    mobShadow(ctx, x, y + 2, 4);
    outlined(ctx, x - 6, y - 6, 14, 14, (c) => {
      c.fillStyle = '#e8a53a';
      c.fillRect(4, 9 + bob, 1, 3);
      c.fillRect(7, 9 - bob, 1, 3);
      c.fillStyle = '#f2ede0';
      c.fillRect(2, 3, 8, 7);
      c.fillRect(7, 1, 4, 5);
      c.fillStyle = '#c0392b';
      c.fillRect(8, 0, 2, 2);
      c.fillStyle = '#e8a53a';
      c.fillRect(11, 3, 2, 1);
      c.fillStyle = '#2b2118';
      c.fillRect(9, 2, 1, 1);
    });
  }
}

/** Three tints of dead flesh — a horde in one colour reads as one creature. */
const FLESH = ['#6f8f52', '#7d9a63', '#67885b'];

export function drawZombie(ctx, z, x, y, time) {
  const lurch = Math.round(Math.sin(time * 5 + z.wob) * 2);
  const size = z.kind === 'brute' ? 1.5 : z.kind === 'runner' ? 0.85 : 1;
  mobShadow(ctx, x, y, 9 * size);
  const flesh = z.kind === 'brute' ? '#5a7247' : FLESH[z.id % FLESH.length];
  outlined(ctx, x - 13 * size, y - 16 * size, 28 * size, 32 * size, (c) => {
    c.scale(size, size);
    c.translate(13, 14);
    c.rotate(Math.sin(time * 3 + z.wob) * 0.08);
    c.fillStyle = '#3a3229';
    c.fillRect(-4, 6 + lurch, 3, 4);
    c.fillRect(1, 6 - lurch, 3, 4);
    c.fillStyle = flesh;
    c.fillRect(-5, -4, 10, 11);
    c.fillStyle = '#4a3f33';
    c.fillRect(-5, 0, 10, 4);
    // an old wound once it has taken a beating
    if (z.hp < z.max * 0.6) {
      c.fillStyle = '#7a3a30';
      c.fillRect(-3, -2, 4, 3);
    }
    if (z.kind === 'brute') {
      // a scrap of pauldron the man it was still wears
      c.fillStyle = STONE_DARK;
      c.fillRect(-7, -5, 5, 5);
      c.fillStyle = STONE;
      c.fillRect(-6, -4, 3, 3);
    }
    c.fillStyle = '#87a468';
    c.fillRect(-3, -11, 7, 7);
    c.fillStyle = '#2e1f1a';
    c.fillRect(-2, -9, 2, 2);
    c.fillRect(2, -9, 2, 2);
    c.fillStyle = flesh;
    c.fillRect(5, -3 + lurch, 6, 3);
  });
  if (z.hp < z.max) drawHpPip(ctx, x, y - 16 * size, z.hp / z.max, '#b8433a');
}

function drawHpPip(ctx, x, y, frac, color = '#7fce6a') {
  if (frac >= 1) return;
  ctx.fillStyle = 'rgba(20,18,14,0.7)';
  ctx.fillRect(px(x - 7), px(y), 14, 3);
  ctx.fillStyle = color;
  ctx.fillRect(px(x - 7), px(y), Math.max(1, Math.round(14 * Math.max(0, frac))), 3);
}

export function drawRallyFlag(ctx, x, y, time) {
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 2, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const wave = Math.sin(time * 6) * 2;
  outlined(ctx, x - 2, y - 25, 20, 28, (c) => {
    c.fillStyle = '#5d3d22';
    c.fillRect(2, 1, 2, 22);
    c.fillStyle = '#c0392b';
    c.beginPath();
    c.moveTo(4, 1);
    c.lineTo(17, 5 + wave);
    c.lineTo(4, 10);
    c.closePath();
    c.fill();
  });
}
