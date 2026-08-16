// Every sprite in the game, drawn out of rectangles at draw time — no image
// ships with the file (CLAUDE.md, rule nº 5). The look is chunky on purpose:
// a tile is 32 logical pixels and the board can be scaled to 0.8 on a phone,
// so anything finer than a 2px stroke would dissolve anyway.

import { TILE } from './config.js';

/** The ground, by season — winter is the horde's colour scheme on purpose. */
export const GROUND = {
  spring: { base: '#5f9c40', spot: '#549238', edge: '#4c8632' },
  summer: { base: '#71a144', spot: '#67973c', edge: '#5c8c36' },
  autumn: { base: '#8f9445', spot: '#83883c', edge: '#767c36' },
  winter: { base: '#c7cfd4', spot: '#bcc6cc', edge: '#aeb9c0' },
};

const px = (n) => Math.round(n);

export function drawGrassTile(ctx, x, y, season, salt) {
  const g = GROUND[season];
  ctx.fillStyle = g.base;
  ctx.fillRect(x, y, TILE, TILE);
  // two freckles per tile, salted by position so the field is not a checkerboard
  ctx.fillStyle = g.spot;
  ctx.fillRect(x + ((salt * 7) % 22) + 3, y + ((salt * 13) % 20) + 4, 4, 3);
  ctx.fillRect(x + ((salt * 17) % 18) + 6, y + ((salt * 29) % 22) + 3, 3, 3);
}

export function drawTree(ctx, x, y, season, salt) {
  const s = TILE;
  const trunk = '#6b4a2b';
  const crown = season === 'winter' ? '#3f6b46' : season === 'autumn' ? '#7c8b3a' : '#3e7a35';
  const lit = season === 'winter' ? '#54815a' : season === 'autumn' ? '#94a04a' : '#549346';
  const wob = (salt % 5) - 2;
  ctx.fillStyle = trunk;
  ctx.fillRect(x + s / 2 - 2, y + s * 0.55, 4, s * 0.38);
  ctx.fillStyle = crown;
  ctx.fillRect(x + 4 + wob, y + 8, s - 8, s * 0.55);
  ctx.fillRect(x + 8 + wob, y + 2, s - 16, s * 0.35);
  ctx.fillStyle = lit;
  ctx.fillRect(x + 7 + wob, y + 10, s * 0.32, s * 0.2);
  if (season === 'winter') {
    ctx.fillStyle = '#e8eef2';
    ctx.fillRect(x + 6 + wob, y + 2, s - 14, 4);
  }
}

export function drawRock(ctx, x, y, season, salt) {
  const s = TILE;
  ctx.fillStyle = '#7d8087';
  ctx.fillRect(x + 4, y + 10, s - 8, s - 16);
  ctx.fillStyle = '#94979e';
  ctx.fillRect(x + 8, y + 6, s - 16, s - 18);
  ctx.fillStyle = '#63666d';
  ctx.fillRect(x + 6 + (salt % 6), y + s - 12, s - 14, 5);
  if (season === 'winter') {
    ctx.fillStyle = '#e8eef2';
    ctx.fillRect(x + 8, y + 6, s - 16, 3);
  }
}

// ------------------------------------------------------------- the buildings

const WOOD = '#7a5230';
const WOOD_DARK = '#5d3d22';
const ROOF = '#8a3f2e';
const ROOF_LIT = '#a54f38';
const STONE = '#8d9097';
const STONE_DARK = '#6e7178';
const STRAW = '#c8a34e';

/**
 * One entry per building id. Each paints into a w×h tile box at (x, y) with
 * tile size `s`; `f` is the raise fraction — a half-built thing is scaffolding.
 */
const BUILDERS = {
  hall(ctx, x, y, s) {
    const w = s * 2;
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x + 2, y + s * 0.7, w - 4, s * 1.24);
    ctx.fillStyle = STONE;
    ctx.fillRect(x + 5, y + s * 0.76, w - 10, s * 1.1);
    ctx.fillStyle = ROOF;
    ctx.fillRect(x, y + s * 0.28, w, s * 0.5);
    ctx.fillStyle = ROOF_LIT;
    ctx.fillRect(x, y + s * 0.28, w, s * 0.14);
    // the banner that says "this is the one you cannot lose"
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x + w / 2 - 1, y - s * 0.25, 3, s * 0.6);
    ctx.fillStyle = '#c8a232';
    ctx.fillRect(x + w / 2 + 2, y - s * 0.22, s * 0.4, s * 0.22);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x + w / 2 - s * 0.22, y + s * 1.3, s * 0.44, s * 0.64);
  },
  house(ctx, x, y, s) {
    ctx.fillStyle = WOOD;
    ctx.fillRect(x + 3, y + s * 0.45, s - 6, s * 0.5);
    ctx.fillStyle = STRAW;
    ctx.fillRect(x + 1, y + s * 0.16, s - 2, s * 0.36);
    ctx.fillStyle = '#a9873c';
    ctx.fillRect(x + 1, y + s * 0.16, s - 2, s * 0.1);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x + s / 2 - 3, y + s * 0.62, 6, s * 0.33);
  },
  farm(ctx, x, y, s, f, opts) {
    const w = s * 2;
    const season = opts.season || 'spring';
    ctx.fillStyle = '#6e4f2e';
    ctx.fillRect(x + 2, y + 2, w - 4, s * 2 - 4);
    // the crop is the season made visible: green shoots, tall gold, stubble, snow
    const crop = { spring: '#7fae4a', summer: '#c8b558', autumn: '#d9a940', winter: '#dfe6ea' }[season];
    ctx.fillStyle = crop;
    for (let i = 0; i < 4; i++) {
      const rowH = season === 'spring' ? 5 : season === 'winter' ? 3 : 8;
      ctx.fillRect(x + 5, y + 6 + i * (s / 2) - rowH / 2 + 6, w - 10, rowH);
    }
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x + w - s * 0.5, y + 3, 4, s * 0.4);
  },
  sawmill(ctx, x, y, s) {
    ctx.fillStyle = WOOD;
    ctx.fillRect(x + 2, y + s * 0.35, s - 4, s * 0.6);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x + 2, y + s * 0.35, s - 4, s * 0.14);
    // the log pile is the sign over the door
    ctx.fillStyle = '#9a6b3a';
    ctx.fillRect(x + 5, y + s * 0.1, s - 10, 5);
    ctx.fillRect(x + 8, y + s * 0.1 - 5, s - 16, 5);
  },
  quarry(ctx, x, y, s) {
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x + 2, y + s * 0.4, s - 4, s * 0.55);
    ctx.fillStyle = STONE;
    ctx.fillRect(x + 6, y + s * 0.18, s - 12, s * 0.4);
    ctx.fillStyle = '#4f5259';
    ctx.fillRect(x + s / 2 - 4, y + s * 0.55, 8, s * 0.4);
  },
  market(ctx, x, y, s) {
    ctx.fillStyle = WOOD;
    ctx.fillRect(x + 3, y + s * 0.5, s - 6, s * 0.45);
    // a striped awning is what says "shop" in one glance
    ctx.fillStyle = '#b8433a';
    ctx.fillRect(x + 1, y + s * 0.2, s - 2, s * 0.3);
    ctx.fillStyle = '#e8e2d0';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 + i * 10, y + s * 0.2, 5, s * 0.3);
  },
  barracks(ctx, x, y, s) {
    const w = s * 2;
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x + 2, y + s * 0.5, w - 4, s * 1.45);
    ctx.fillStyle = STONE;
    ctx.fillRect(x + 5, y + s * 0.56, w - 10, s * 1.3);
    ctx.fillStyle = ROOF;
    ctx.fillRect(x, y + s * 0.2, w, s * 0.4);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x + w / 2 - s * 0.25, y + s * 1.3, s * 0.5, s * 0.66);
    // crossed training swords by the door
    ctx.strokeStyle = '#d8d3c2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y + s * 0.8);
    ctx.lineTo(x + s * 0.7, y + s * 1.2);
    ctx.moveTo(x + s * 0.7, y + s * 0.8);
    ctx.lineTo(x + s * 0.3, y + s * 1.2);
    ctx.stroke();
  },
  range(ctx, x, y, s) {
    const w = s * 2;
    ctx.fillStyle = WOOD;
    ctx.fillRect(x + 2, y + s * 1.1, w - 4, s * 0.85);
    ctx.fillStyle = STRAW;
    ctx.fillRect(x + 2, y + s * 0.8, w - 4, s * 0.34);
    // the target butt: three rings on a straw disc
    const cx = x + w - s * 0.55;
    const cy = y + s * 0.5;
    for (const [rad, col] of [[s * 0.34, '#e8e2d0'], [s * 0.22, '#b8433a'], [s * 0.1, '#e8e2d0']]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  wall(ctx, x, y, s) {
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x, y + 4, s, s - 4);
    ctx.fillStyle = STONE;
    ctx.fillRect(x + 2, y + 7, s - 4, s - 12);
    // crenellation: three teeth
    ctx.fillStyle = STONE_DARK;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * ((s - 4) / 3) + 1, y, (s - 4) / 3 - 3, 7);
  },
  tower(ctx, x, y, s) {
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x + 5, y + 2, s - 10, s - 4);
    ctx.fillStyle = STONE;
    ctx.fillRect(x + 8, y + 5, s - 16, s - 10);
    ctx.fillStyle = STONE_DARK;
    for (let i = 0; i < 2; i++) ctx.fillRect(x + 6 + i * (s - 16), y - 3, 6, 6);
    ctx.fillStyle = '#2e3138';
    ctx.fillRect(x + s / 2 - 2, y + 9, 4, 6);
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
    painter(ctx, x, y, TILE, f, opts);
    ctx.restore();
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    const spec = opts.spec || { w: 1, h: 1 };
    ctx.strokeRect(x + 1, y + 1, spec.w * TILE - 2, spec.h * TILE - 2);
    ctx.setLineDash([]);
    return;
  }
  painter(ctx, x, y, TILE, f, opts);
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
  ctx.fillStyle = skin;
  ctx.fillRect(px(x - 3), px(y - 11), 7, 7);
  ctx.fillStyle = head;
  ctx.fillRect(px(x - 4), px(y - 13), 9, 4);
}

export function drawUnit(ctx, u, x, y, time) {
  const bob = Math.round(Math.sin(time * 9 + u.id) * 1.5);
  if (u.kind === 'soldier') {
    body(ctx, x, y, bob, { tunic: '#5b6c9e', head: '#9aa4b8' });
    ctx.fillStyle = '#d8d3c2'; // the sword arm
    ctx.fillRect(px(x + 5), px(y - 8), 2, 10);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(px(x - 9), px(y - 3), 4, 8); // the shield
  } else {
    body(ctx, x, y, bob, { tunic: '#5e7a3c', head: '#46602c' });
    ctx.strokeStyle = '#c8a34e'; // the bow
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(x + 7), px(y - 3), 5, -Math.PI / 2.2, Math.PI / 2.2);
    ctx.stroke();
  }
  drawHpPip(ctx, x, y - 16, u.hp / (u.kind === 'soldier' ? 60 : 40));
}

export function drawZombie(ctx, z, x, y, time) {
  const lurch = Math.round(Math.sin(time * 5 + z.wob) * 2);
  const size = z.kind === 'brute' ? 1.5 : z.kind === 'runner' ? 0.85 : 1;
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
