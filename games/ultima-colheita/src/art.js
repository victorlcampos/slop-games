// Every sprite in the game, drawn out of rectangles at draw time — no image
// ships with the file (CLAUDE.md, rule nº 5). The vocabulary is the reference
// the game was pitched with: saturated grass, dirt roads, timber-framed walls
// under fat textured roofs, and a drop shadow under everything that stands —
// the shadow is half of what makes flat rectangles read as a *place*.

import { TILE } from './config.js';

// ------------------------------------------------------------------ palette

const PLASTER = '#e8d9b0';
const TIMBER = '#6b4a2b';
const TIMBER_DARK = '#4e3620';
const STONE = '#9a9da6';
const STONE_DARK = '#73767f';
const STONE_LINE = '#5d6068';
const SHINGLE = '#96422e';
const SHINGLE_LIT = '#b25a3a';
const SHINGLE_DARK = '#6e2f22';
const THATCH = '#d0a94e';
const THATCH_LIT = '#e0bd66';
const THATCH_DARK = '#a37f38';
const SHADOW = 'rgba(30,26,16,0.30)';

/** The ground, by season — winter is the horde's colour scheme on purpose. */
export const GROUND = {
  spring: { base: '#63a24b', dark: '#579343', lit: '#75b258', blade: '#4c8639' },
  summer: { base: '#74a648', dark: '#699a40', lit: '#86b656', blade: '#5c8c36' },
  autumn: { base: '#98984a', dark: '#8a8b41', lit: '#aaa75a', blade: '#7c7c38' },
  winter: { base: '#cdd6da', dark: '#c0cbd1', lit: '#dde5e8', blade: '#a9b8bf' },
};

const DIRT = { base: '#997a55', dark: '#8b6e4b', lit: '#a8895f' };

// ------------------------------------------------------------------- ground

export function drawGrassTile(ctx, x, y, season, salt) {
  const g = GROUND[season];
  // a soft checker keeps the field from reading as one flat sheet
  ctx.fillStyle = (salt >> 2) % 2 ? g.base : g.dark;
  ctx.fillRect(x, y, TILE, TILE);
  // tufts and lit patches, salted by position so they never march in step
  ctx.fillStyle = g.lit;
  ctx.fillRect(x + ((salt * 7) % 22) + 3, y + ((salt * 13) % 20) + 4, 5, 3);
  ctx.fillRect(x + ((salt * 23) % 16) + 8, y + ((salt * 5) % 22) + 2, 3, 2);
  ctx.fillStyle = g.blade;
  const bx = x + ((salt * 17) % 20) + 4;
  const by = y + ((salt * 29) % 18) + 6;
  ctx.fillRect(bx, by, 2, 5);
  ctx.fillRect(bx + 3, by + 2, 2, 4);
  if (season === 'winter' && salt % 3 === 0) {
    ctx.fillStyle = '#e9eff2';
    ctx.fillRect(x + ((salt * 11) % 18) + 2, y + ((salt * 19) % 16) + 4, 9, 5);
  }
}

/** The dirt road through the village — pure scenery, everything builds on it. */
export function drawPathTile(ctx, x, y, season, salt) {
  ctx.fillStyle = (salt >> 1) % 2 ? DIRT.base : DIRT.dark;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = DIRT.lit;
  ctx.fillRect(x + ((salt * 13) % 20) + 3, y + ((salt * 7) % 20) + 4, 6, 3);
  ctx.fillStyle = 'rgba(90,66,45,0.35)';
  ctx.fillRect(x + ((salt * 19) % 22) + 2, y + ((salt * 11) % 22) + 3, 3, 3);
  ctx.fillRect(x + ((salt * 29) % 16) + 9, y + ((salt * 23) % 18) + 8, 3, 2);
  if (season === 'winter') {
    ctx.fillStyle = 'rgba(233,239,242,0.5)';
    ctx.fillRect(x, y, TILE, 4);
  }
}

export function drawTree(ctx, x, y, season, salt) {
  const s = TILE;
  const wob = (salt % 5) - 2;
  const cx = x + s / 2 + wob;
  // the shadow ties the tree to the ground it stands on
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + s / 2, y + s - 3, s * 0.42, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const dark = season === 'winter' ? '#2c4f34' : season === 'autumn' ? '#5f7030' : '#2e5b2b';
  const mid = season === 'winter' ? '#3c6644' : season === 'autumn' ? '#7c8b3a' : '#3f7a35';
  const lit = season === 'winter' ? '#4f7d57' : season === 'autumn' ? '#98a44c' : '#5ba04a';

  if (salt % 3 === 0) {
    // a pine: stacked shelves narrowing to a tip, taller than its tile
    ctx.fillStyle = TIMBER_DARK;
    ctx.fillRect(cx - 2, y + s * 0.72, 5, s * 0.26);
    const tiers = [
      [x + 1 + wob, y + s * 0.52, s - 2, s * 0.26],
      [x + 4 + wob, y + s * 0.28, s - 8, s * 0.28],
      [x + 8 + wob, y + s * 0.06, s - 16, s * 0.26],
      [x + 12 + wob, y - s * 0.1, s - 24, s * 0.2],
    ];
    tiers.forEach(([tx, ty, tw, th], i) => {
      ctx.fillStyle = i % 2 ? mid : dark;
      ctx.fillRect(tx, ty, tw, th);
    });
    ctx.fillStyle = lit;
    ctx.fillRect(x + 6 + wob, y + s * 0.32, s * 0.2, s * 0.1);
    if (season === 'winter') {
      ctx.fillStyle = '#e9eff2';
      tiers.forEach(([tx, ty, tw]) => ctx.fillRect(tx, ty, tw, 3));
    }
    return;
  }

  // a broadleaf: a fat stacked canopy that spills past its tile
  ctx.fillStyle = TIMBER;
  ctx.fillRect(cx - 3, y + s * 0.55, 6, s * 0.42);
  ctx.fillStyle = TIMBER_DARK;
  ctx.fillRect(cx - 3, y + s * 0.55, 2, s * 0.42);
  ctx.fillStyle = dark;
  ctx.fillRect(x - 2 + wob, y + s * 0.3, s + 4, s * 0.4);
  ctx.fillRect(x + 2 + wob, y + s * 0.12, s - 4, s * 0.3);
  ctx.fillStyle = mid;
  ctx.fillRect(x + 1 + wob, y + s * 0.02, s - 2, s * 0.42);
  ctx.fillRect(x - 3 + wob, y + s * 0.26, s * 0.42, s * 0.3);
  ctx.fillStyle = lit;
  ctx.fillRect(x + 4 + wob, y + s * 0.06, s * 0.44, s * 0.24);
  ctx.fillRect(x + 1 + wob, y + s * 0.32, s * 0.22, s * 0.14);
  if (season === 'winter') {
    ctx.fillStyle = '#e9eff2';
    ctx.fillRect(x + 1 + wob, y + s * 0.02, s - 2, 4);
    ctx.fillRect(x - 2 + wob, y + s * 0.28, s * 0.32, 3);
  }
}

export function drawRock(ctx, x, y, season, salt) {
  const s = TILE;
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + s / 2, y + s - 5, s * 0.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x + 3, y + 12, s - 6, s - 18);
  ctx.fillRect(x + 10, y + 6, s - 16, 10);
  ctx.fillStyle = STONE;
  ctx.fillRect(x + 6, y + 9, s - 16, s - 20);
  ctx.fillStyle = '#b4b7bf';
  ctx.fillRect(x + 8, y + 8 + (salt % 3), 7, 5);
  ctx.fillStyle = STONE_LINE;
  ctx.fillRect(x + 7 + (salt % 6), y + s - 13, s - 16, 2);
  ctx.fillRect(x + 13, y + 12, 2, s - 22);
  if (season === 'winter') {
    ctx.fillStyle = '#e9eff2';
    ctx.fillRect(x + 8, y + 6, s - 14, 3);
  }
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

/** A fat roof with a lit ridge, plank lines and an eave shadow. */
function roof(ctx, x, y, w, h, kind = 'shingle') {
  const [base, litC, darkC] = kind === 'thatch'
    ? [THATCH, THATCH_LIT, THATCH_DARK]
    : [SHINGLE, SHINGLE_LIT, SHINGLE_DARK];
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = litC;
  ctx.fillRect(x, y, w, Math.max(3, h * 0.22));
  ctx.fillStyle = darkC;
  ctx.fillRect(x, y + h - 3, w, 3);
  for (let lx = x + 6; lx < x + w - 3; lx += 8) ctx.fillRect(lx, y + 3, 1, h - 5);
}

function door(ctx, x, y, w, h) {
  ctx.fillStyle = TIMBER_DARK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = TIMBER;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 1);
  ctx.fillStyle = TIMBER_DARK;
  ctx.fillRect(x + w / 2, y + 1, 1, h - 1);
}

function windowPane(ctx, x, y, w = 6, h = 6) {
  ctx.fillStyle = TIMBER_DARK;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#8fb6c9';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#c6dde8';
  ctx.fillRect(x, y, w / 2, h / 2);
}

// ------------------------------------------------------------- the buildings

/**
 * One entry per building id. Each paints into a w×h tile box at (x, y) with
 * tile size `s`; `opts.season` skins the crops, `opts.link` joins walls.
 */
const BUILDERS = {
  hall(ctx, x, y, s, opts) {
    // the manor breaks the grid upward: at two tiles flat it read as a kiosk,
    // and the one building the whole run hangs on deserves the skyline
    const w = s * 2;
    const h = s * 2;
    shadow(ctx, x, y, w, h);
    stoneWall(ctx, x + 1, y + s * 0.9, w - 2, s * 1.06);
    timberWall(ctx, x + 1, y + s * 0.4, w - 2, s * 0.54);
    roof(ctx, x - 3, y - s * 0.16, w + 6, s * 0.58, 'shingle');
    // the chimney the smoke rises from (the smoke itself is the renderer's)
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x + w - s * 0.45, y - s * 0.42, 9, s * 0.34);
    ctx.fillStyle = STONE;
    ctx.fillRect(x + w - s * 0.45 + 1, y - s * 0.42, 7, 3);
    door(ctx, x + w / 2 - 6, y + s * 1.44, 13, s * 0.5);
    windowPane(ctx, x + s * 0.3, y + s * 1.14, 7, 8);
    windowPane(ctx, x + w - s * 0.55, y + s * 1.14, 7, 8);
    windowPane(ctx, x + s * 0.5, y + s * 0.52, 7, 7);
    windowPane(ctx, x + w - s * 0.72, y + s * 0.52, 7, 7);
    // the banner that says "this is the one you cannot lose"
    ctx.fillStyle = TIMBER_DARK;
    ctx.fillRect(x + w / 2 - 1, y - s * 0.6, 3, s * 0.5);
    ctx.fillStyle = '#c8a232';
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 2, y - s * 0.58);
    ctx.lineTo(x + w / 2 + 2 + s * 0.46, y - s * 0.46);
    ctx.lineTo(x + w / 2 + 2, y - s * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SHADOW;
    ctx.fillRect(x + 3, y + s * 0.44, w - 6, 2);
  },
  house(ctx, x, y, s) {
    shadow(ctx, x + 1, y, s - 2, s);
    timberWall(ctx, x + 2, y + s * 0.42, s - 4, s * 0.52);
    roof(ctx, x, y + s * 0.08, s, s * 0.38, 'thatch');
    door(ctx, x + s / 2 - 4, y + s * 0.6, 8, s * 0.34);
    windowPane(ctx, x + s * 0.16, y + s * 0.56, 5, 5);
  },
  farm(ctx, x, y, s, opts) {
    const w = s * 2;
    const season = opts.season || 'spring';
    ctx.fillStyle = '#7a5a36';
    ctx.fillRect(x + 1, y + 1, w - 2, s * 2 - 2);
    ctx.fillStyle = '#6a4d2e';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 3, y + 4 + i * (s / 2), w - 6, 3);
    // the crop is the season made visible: sprouts, tall gold, sheaves, snow
    const crop = { spring: '#84c25a', summer: '#cbb75a', autumn: '#dcae42', winter: '#dfe6ea' }[season];
    ctx.fillStyle = crop;
    for (let i = 0; i < 4; i++) {
      const ry = y + 8 + i * (s / 2);
      if (season === 'spring') {
        for (let px2 = x + 5; px2 < x + w - 6; px2 += 7) ctx.fillRect(px2, ry, 3, 4);
      } else if (season === 'winter') {
        ctx.fillRect(x + 4, ry, w - 8, 3);
      } else {
        ctx.fillRect(x + 4, ry - 2, w - 8, 7);
        ctx.fillStyle = season === 'autumn' ? '#b98d2e' : '#a8973e';
        for (let px2 = x + 8; px2 < x + w - 6; px2 += 9) ctx.fillRect(px2, ry - 2, 1, 7);
        ctx.fillStyle = crop;
      }
    }
    // fence posts around the plot, like every field in the reference
    ctx.fillStyle = TIMBER;
    for (let px2 = x + 2; px2 <= x + w - 4; px2 += 10) ctx.fillRect(px2, y - 2, 3, 6);
    ctx.fillRect(x + 1, y - 1, w - 2, 2);
  },
  sawmill(ctx, x, y, s) {
    shadow(ctx, x + 1, y, s - 2, s);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x + 2, y + s * 0.34, s - 4, s * 0.6);
    ctx.fillStyle = TIMBER_DARK;
    for (let ly = y + s * 0.42; ly < y + s * 0.9; ly += 6) ctx.fillRect(x + 2, ly, s - 4, 2);
    roof(ctx, x, y + s * 0.06, s, s * 0.32, 'shingle');
    // the log pile is the sign over the door
    ctx.fillStyle = '#9a6b3a';
    ctx.fillRect(x + s - 12, y + s * 0.55, 10, 4);
    ctx.fillRect(x + s - 10, y + s * 0.47, 8, 4);
    ctx.fillStyle = '#c8a34e';
    ctx.fillRect(x + s - 4, y + s * 0.55, 2, 4);
    ctx.fillStyle = '#d8d3c2';
    ctx.beginPath();
    ctx.arc(x + 8, y + s * 0.52, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TIMBER_DARK; // the blade's teeth
    ctx.beginPath();
    ctx.arc(x + 8, y + s * 0.52, 2, 0, Math.PI * 2);
    ctx.fill();
  },
  quarry(ctx, x, y, s) {
    ctx.fillStyle = '#6e7178';
    ctx.fillRect(x + 1, y + 6, s - 2, s - 8);
    ctx.fillStyle = '#54575e';
    ctx.fillRect(x + 4, y + 10, s - 8, s - 14);
    ctx.fillStyle = STONE;
    ctx.fillRect(x + 7, y + s - 12, 8, 6);
    ctx.fillRect(x + s - 13, y + 12, 7, 6);
    // the hoist frame over the pit
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x + 3, y + 2, 3, s * 0.5);
    ctx.fillRect(x + s - 6, y + 2, 3, s * 0.5);
    ctx.fillRect(x + 3, y + 2, s - 6, 3);
    ctx.fillStyle = '#3a3229';
    ctx.fillRect(x + s / 2 - 1, y + 5, 1, 8);
  },
  market(ctx, x, y, s) {
    shadow(ctx, x + 1, y, s - 2, s);
    timberWall(ctx, x + 2, y + s * 0.5, s - 4, s * 0.44);
    // a striped awning is what says "shop" in one glance
    ctx.fillStyle = '#b8433a';
    ctx.fillRect(x, y + s * 0.16, s, s * 0.34);
    ctx.fillStyle = '#e8e2d0';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * 10, y + s * 0.16, 5, s * 0.34);
    ctx.fillStyle = SHINGLE_DARK;
    ctx.fillRect(x, y + s * 0.46, s, 2);
    // crates of goods by the counter
    ctx.fillStyle = '#a8823f';
    ctx.fillRect(x + 3, y + s * 0.72, 8, 8);
    ctx.fillStyle = TIMBER_DARK;
    ctx.strokeStyle = TIMBER_DARK;
    ctx.strokeRect(x + 3.5, y + s * 0.72 + 0.5, 7, 7);
  },
  barracks(ctx, x, y, s) {
    const w = s * 2;
    shadow(ctx, x, y, w, s * 2);
    stoneWall(ctx, x + 1, y + s * 0.5, w - 2, s * 1.45);
    // crenellated top instead of a roof: this is a fort, not a cottage
    ctx.fillStyle = STONE_DARK;
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * ((w - 8) / 4), y + s * 0.36, 8, 10);
    door(ctx, x + w / 2 - 6, y + s * 1.5, 13, s * 0.44);
    windowPane(ctx, x + s * 0.3, y + s * 0.9, 5, 8);
    windowPane(ctx, x + w - s * 0.45, y + s * 0.9, 5, 8);
    // crossed training swords by the door
    ctx.strokeStyle = '#d8d3c2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.55, y + s * 1.0);
    ctx.lineTo(x + s * 0.95, y + s * 1.4);
    ctx.moveTo(x + s * 0.95, y + s * 1.0);
    ctx.lineTo(x + s * 0.55, y + s * 1.4);
    ctx.stroke();
    ctx.fillStyle = '#b8433a';
    ctx.fillRect(x + w - s * 0.4, y + s * 0.1, 3, s * 0.34);
    ctx.beginPath();
    ctx.moveTo(x + w - s * 0.4 + 3, y + s * 0.12);
    ctx.lineTo(x + w - s * 0.4 + 3 + 10, y + s * 0.2);
    ctx.lineTo(x + w - s * 0.4 + 3, y + s * 0.28);
    ctx.closePath();
    ctx.fill();
  },
  range(ctx, x, y, s) {
    const w = s * 2;
    shadow(ctx, x, y + s, w, s);
    timberWall(ctx, x + 1, y + s * 1.2, w * 0.45, s * 0.74);
    roof(ctx, x - 1, y + s * 0.9, w * 0.5, s * 0.34, 'thatch');
    // the target butt: rings on a straw disc, with practice arrows in it
    const cx = x + w - s * 0.55;
    const cy = y + s * 0.55;
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(cx, y + s * 1.1, s * 0.34, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TIMBER;
    ctx.fillRect(cx - 2, cy, 4, s * 0.55);
    for (const [rad, col] of [[s * 0.34, '#e8e2d0'], [s * 0.22, '#b8433a'], [s * 0.1, '#e8e2d0']]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = TIMBER_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 12);
    ctx.lineTo(cx - 2, cy - 3);
    ctx.stroke();
    // a hay bale beside the lane
    ctx.fillStyle = THATCH;
    ctx.fillRect(x + w * 0.5, y + s * 1.5, 12, 9);
    ctx.fillStyle = THATCH_DARK;
    ctx.fillRect(x + w * 0.5, y + s * 1.5 + 3, 12, 2);
  },
  wall(ctx, x, y, s, opts) {
    const link = opts.link || {};
    shadow(ctx, x + 1, y, s - 2, s);
    // the body reaches into every linked neighbour so a run of walls reads as
    // one rampart instead of a row of crates
    const x0 = link.l ? x : x + 3;
    const x1 = link.r ? x + s : x + s - 3;
    const y0 = link.u ? y : y + 5;
    const y1 = link.d ? y + s : y + s - 2;
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = STONE;
    ctx.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 6);
    ctx.fillStyle = STONE_LINE;
    ctx.fillRect(x0 + 2, y + s * 0.45, x1 - x0 - 4, 1);
    ctx.fillRect(x + s * 0.5, y0 + 2, 1, y1 - y0 - 8);
    // crenellation: teeth along the top edge unless a wall stands above
    if (!link.u) {
      ctx.fillStyle = '#aab0b8';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * ((s - 6) / 3) + 1, y, (s - 6) / 3 - 3, 6);
    }
  },
  tower(ctx, x, y, s) {
    // the tower stands taller than its tile — it is allowed to break the grid
    shadow(ctx, x + 2, y, s - 4, s);
    stoneWall(ctx, x + 5, y - 8, s - 10, s + 4);
    ctx.fillStyle = STONE_DARK;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 + i * ((s - 12) / 2), y - 14, 6, 8);
    ctx.fillStyle = '#2e3138';
    ctx.fillRect(x + s / 2 - 2, y - 2, 4, 7); // the arrow slit
    ctx.fillStyle = '#c8a232';
    ctx.fillRect(x + s / 2 - 1, y - 22, 2, 9);
    ctx.beginPath();
    ctx.moveTo(x + s / 2 + 1, y - 21);
    ctx.lineTo(x + s / 2 + 9, y - 17.5);
    ctx.lineTo(x + s / 2 + 1, y - 14);
    ctx.closePath();
    ctx.fill();
  },
};

export function drawBuilding(ctx, id, x, y, opts = {}) {
  const f = opts.built ?? 1;
  const painter = BUILDERS[id];
  if (!painter) return;
  if (f < 1) {
    // scaffolding: the outline of what is coming, filling from the ground up
    ctx.save();
    ctx.globalAlpha = 0.35 + f * 0.5;
    painter(ctx, x, y, TILE, opts);
    ctx.restore();
    ctx.strokeStyle = '#f2e7d0';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    const spec = opts.spec || { w: 1, h: 1 };
    ctx.strokeRect(x + 1, y + 1, spec.w * TILE - 2, spec.h * TILE - 2);
    ctx.setLineDash([]);
    // the pole and cloth of a building site
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x + 4, y + 2, 2, 12);
    ctx.fillStyle = '#c8a232';
    ctx.fillRect(x + 6, y + 3, 7, 5);
    return;
  }
  painter(ctx, x, y, TILE, opts);
  if (opts.hurt) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ff5a3c';
    const spec = opts.spec || { w: 1, h: 1 };
    ctx.fillRect(x, y, spec.w * TILE, spec.h * TILE);
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
 * profession adds. `bob` is the walk cycle the caller derives from time.
 */
function body(ctx, x, y, bob, { tunic, skin = '#e3b58a', head = tunic }) {
  ctx.fillStyle = '#3a3229';
  ctx.fillRect(px(x - 4), px(y + 6 + bob), 3, 4);
  ctx.fillRect(px(x + 1), px(y + 6 - bob), 3, 4);
  ctx.fillStyle = tunic;
  ctx.fillRect(px(x - 5), px(y - 4), 10, 11);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(px(x - 5), px(y + 3), 10, 3);
  ctx.fillStyle = skin;
  ctx.fillRect(px(x - 3), px(y - 11), 7, 7);
  ctx.fillStyle = head;
  ctx.fillRect(px(x - 4), px(y - 13), 9, 4);
}

export function drawUnit(ctx, u, x, y, time) {
  const bob = Math.round(Math.sin(time * 9 + u.id) * 1.5);
  mobShadow(ctx, x, y);
  if (u.kind === 'soldier') {
    body(ctx, x, y, bob, { tunic: '#5b6c9e', head: '#aab3c4' });
    ctx.fillStyle = '#aab3c4'; // the helmet's nose guard
    ctx.fillRect(px(x - 1), px(y - 11), 2, 4);
    ctx.fillStyle = '#d8d3c2'; // the sword arm
    ctx.fillRect(px(x + 5), px(y - 9), 2, 11);
    ctx.fillRect(px(x + 4), px(y - 2), 4, 2);
    ctx.fillStyle = '#7a5230'; // the shield
    ctx.fillRect(px(x - 10), px(y - 4), 5, 9);
    ctx.fillStyle = '#c8a232';
    ctx.fillRect(px(x - 9), px(y - 1), 3, 3);
  } else {
    body(ctx, x, y, bob, { tunic: '#5e7a3c', head: '#46602c' });
    ctx.strokeStyle = '#c8a34e'; // the bow
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(x + 7), px(y - 3), 5, -Math.PI / 2.2, Math.PI / 2.2);
    ctx.stroke();
    ctx.strokeStyle = '#d8d3c2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(x + 7), px(y - 8));
    ctx.lineTo(px(x + 7), px(y + 2));
    ctx.stroke();
    ctx.fillStyle = '#8a674f'; // the quiver
    ctx.fillRect(px(x - 8), px(y - 8), 3, 8);
  }
  drawHpPip(ctx, x, y - 16, u.hp / (u.kind === 'soldier' ? 60 : 40));
}

/** A townsperson going about their day — pure scenery, the sim never sees them. */
export function drawVillager(ctx, v, x, y, time) {
  const bob = Math.round(Math.sin(time * 8 + v.seed * 7) * 1.5);
  mobShadow(ctx, x, y, 7);
  const tunics = ['#8a5a3a', '#6e7a4a', '#7a4a5a', '#5a6a7a'];
  body(ctx, x, y, bob, { tunic: tunics[v.seed % tunics.length], head: '#5d3d22' });
  if (v.seed % 3 === 0) {
    ctx.fillStyle = '#c8a34e'; // a bundle of hay on the shoulder
    ctx.fillRect(px(x + 4), px(y - 8), 6, 4);
  }
}

export function drawZombie(ctx, z, x, y, time) {
  const lurch = Math.round(Math.sin(time * 5 + z.wob) * 2);
  const size = z.kind === 'brute' ? 1.5 : z.kind === 'runner' ? 0.85 : 1;
  mobShadow(ctx, x, y, 9 * size);
  ctx.save();
  ctx.translate(px(x), px(y));
  ctx.scale(size, size);
  ctx.rotate(Math.sin(time * 3 + z.wob) * 0.08);
  ctx.fillStyle = '#3a3229';
  ctx.fillRect(-4, 6 + lurch, 3, 4);
  ctx.fillRect(1, 6 - lurch, 3, 4);
  ctx.fillStyle = z.kind === 'brute' ? '#5a7247' : '#6f8f52'; // dead flesh
  ctx.fillRect(-5, -4, 10, 11);
  ctx.fillStyle = '#4a3f33'; // what is left of the clothes
  ctx.fillRect(-5, 0, 10, 4);
  ctx.fillStyle = '#87a468';
  ctx.fillRect(-3, -11, 7, 7);
  ctx.fillStyle = '#2e1f1a'; // the eyes are two pits
  ctx.fillRect(-2, -9, 2, 2);
  ctx.fillRect(2, -9, 2, 2);
  // one arm out in front: the walk that says what it wants
  ctx.fillStyle = '#6f8f52';
  ctx.fillRect(5, -3 + lurch, 6, 3);
  ctx.restore();
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
  ctx.fillStyle = '#5d3d22';
  ctx.fillRect(px(x), px(y - 22), 2, 22);
  const wave = Math.sin(time * 6) * 2;
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 22);
  ctx.lineTo(x + 15, y - 18 + wave);
  ctx.lineTo(x + 2, y - 13);
  ctx.closePath();
  ctx.fill();
}
