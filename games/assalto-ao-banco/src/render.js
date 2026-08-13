// The bank, seen from almost directly above and tipped just a little.
//
// Everybody fits inside their own square, which is the rule that matters: what
// you aim at and what the simulation shoots at have to be the same place. The
// tilt is carried by two small things — a lip on every wall, and a head drawn
// a few pixels above its own shoulders with its own shadow. Walls and people
// are still painted in rows down the screen, so the lip covers what is behind.
//
// The darkness is one shape: the polygon `vision.js` builds from the player's
// cone is the clip path, and it is the same maths that answers "can that guard
// see you". There is no second system deciding what is visible, which is the
// only way a fog can be fair.

import {
  COLOURS, KIT, TILE, WALL_H, HEAD_LIFT, ROLL, PLAYER, CAMERA, VAULT, ASSIST, RAD,
  clamp, angleDelta,
} from './config.js';
import { WALL, VAULT_FLOOR, HALL, lineOfSight } from './grid.js';
import { visibilityFan } from './vision.js';
import { WEAPONS } from './weapons.js';
import { STICK, useButton, rollButton, fireButton } from './controls.js';
import { t, i18n } from './i18n.js';

// ------------------------------------------------- the sprites, baked once
//
// Radial gradients are the most expensive thing a weak GPU is asked to do
// here, and the old renderer rebuilt and refilled up to four of them across
// the whole screen every frame — the falloff, the vignette, the alarm wash,
// every muzzle flash. Each is now painted once into a small offscreen canvas
// and blitted, which is the cheapest operation a canvas has.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function radialSprite(size, rgb, stops) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, a] of stops) grd.addColorStop(at, `rgba(${rgb},${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

// one light profile shared by every cone: bright at the lamp, gone at the edge
const CONE_STOPS = [[0, 1], [0.55, 0.62], [1, 0]];

let RADIALS = null;
function radials() {
  if (!RADIALS) {
    RADIALS = {
      // the torch falloff: same stops the old per-frame gradient carried
      falloff: radialSprite(512, '7,8,12', [[0, 0], [0.22, 0], [0.735, 0.18], [1, 0.56]]),
      // a breath of warm light at his feet — a torch, not a fluorescent tube
      glow: radialSprite(256, '255,205,150', [[0, 0.1], [0.55, 0.04], [1, 0]]),
      muzzle: radialSprite(128, '255,195,120', [[0, 0.85], [1, 0]]),
      coneCalm: radialSprite(256, '255,225,170', CONE_STOPS),
      coneWary: radialSprite(256, '255,200,110', CONE_STOPS),
      coneHot: radialSprite(256, '255,90,77', CONE_STOPS),
      coneCam: radialSprite(256, '143,169,214', CONE_STOPS),
    };
  }
  return RADIALS;
}

// Wall blocks depend only on which neighbours are open and the tile's parity —
// thirty-two variants for the whole game, shared across floors and runs.
const WALL_SPRITES = new Map();

export function createRenderer() {
  const r = {
    camX: 0,
    camY: 0,
    level: null,                 // the floor the bake below belongs to
    floorImg: null,
    floorScale: 1,
    shade: { W: 0, H: 0, vignette: null, wash: null },
    reset() {
      r.camX = 0;
      r.camY = 0;
      r.level = null;
      r.floorImg = null;
    },
  };

  r.draw = (ctx, game, vp, opts = {}) => {
    const { W, H } = vp;
    const p = game.player;

    const cam = cameraFor(p.x, p.y, W, H);
    r.camX = cam.x;
    r.camY = cam.y;

    const shake = opts.fx ? opts.fx.state.shake : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;

    ctx.fillStyle = COLOURS.void;
    ctx.fillRect(0, 0, W, H);

    // The whole static floor — tiles, patterns, furniture — is painted once per
    // level into an offscreen and blitted from then on. What used to be some
    // fifteen hundred little fills a frame is one drawImage.
    if (r.level !== game.level) {
      r.level = game.level;
      r.floorScale = bakeScale(vp, game.grid);
      r.floorImg = bakeFloor(game, r.floorScale);
    }

    ctx.save();
    // not rounded: the camera has to be *exactly* the one `screenToWorld` uses,
    // or the cursor and the man it is pointing at drift apart by the rounding
    ctx.translate(-r.camX + sx, -r.camY + sy);

    const view = bounds(game.level, r.camX, r.camY, W, H);
    paintRemembered(ctx, game, view);

    ctx.save();
    clipToSight(ctx, game.sight);
    const bx = view.x0 * TILE;
    const by = view.y0 * TILE;
    const bw = (view.x1 - view.x0 + 1) * TILE;
    const bh = (view.y1 - view.y0 + 1) * TILE;
    const S = r.floorScale;
    ctx.drawImage(r.floorImg, bx * S, by * S, bw * S, bh * S, bx, by, bw, bh);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(radials().glow, p.x - 230, p.y - 230, 460, 460);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Walls and everybody standing between them, in one pass down the screen.
    // A wall is where a ray *stops*, so it falls outside the clip and would
    // never be drawn — it is asked one at a time instead whether the face you
    // would be looking at is visible (see `wallLit`).
    paintStanding(ctx, game, view, opts, r.floorScale);

    // The cones are clipped to your own sight too: you see the light where it
    // falls in front of you, not the cone of a man two rooms away.
    ctx.save();
    clipToSight(ctx, game.sight);
    paintCones(ctx, game);
    ctx.restore();

    // The torch falls off. Without this the lit area is a flat slab of colour
    // with a polygon edge round it — with it, the far end of a corridor is a
    // suggestion and the tile under your feet is bright, which is what makes
    // the dark feel like dark rather than like a stencil.
    paintFalloff(ctx, game, view);

    paintMuzzles(ctx, game);
    paintBullets(ctx, game);
    paintFx(ctx, opts.fx);
    if (game.aimTarget) paintReticle(ctx, game.aimTarget, p);

    ctx.restore();
    paintHud(ctx, game, vp, opts, r);
  };

  return r;
}

// ---------------------------------------------------------------- the camera

/**
 * Where the world is, given where he is: he is in the middle of the screen and
 * he stays there.
 *
 * It used to lead ninety pixels towards where he was looking, and ease into
 * that over a few frames. Both looked good and both were wrong, because the
 * mouse is a *fixed point on the screen*: the direction he aims is the vector
 * from wherever he is drawn to wherever the cursor is. Let him drift off centre
 * and that vector changes as he walks — start running and the cursor slides
 * behind him, so aiming forward means chasing the pointer up the screen. There
 * is nothing to tune here. He is at the centre, and the aim is the vector from
 * the centre to the cursor, always.
 *
 * There is deliberately no clamp at the edges of the floor either: a clamp is
 * exactly the same bug in the two places it bites. Nothing is lost by letting
 * the view run off the edge, because everything out there is unlit anyway.
 */
export function cameraFor(px, py, W, H) {
  return { x: px - W / 2, y: py - H / 2 };
}

/** A point on the screen, in the world — the exact inverse of the above. */
export function screenToWorld(sx, sy, px, py, W, H) {
  const cam = cameraFor(px, py, W, H);
  return { x: sx + cam.x, y: sy + cam.y };
}

// ---------------------------------------------------------------- the floor

function bounds(level, camX, camY, W, H) {
  return {
    x0: Math.max(0, Math.floor(camX / TILE) - 1),
    y0: Math.max(0, Math.floor((camY - WALL_H - 40) / TILE) - 1),
    x1: Math.min(level.grid.cols - 1, Math.floor((camX + W) / TILE) + 1),
    y1: Math.min(level.grid.rows - 1, Math.floor((camY + H) / TILE) + 2),
  };
}

function clipToSight(ctx, sight) {
  if (!sight) return;
  ctx.beginPath();
  ctx.moveTo(sight.x, sight.y);
  for (const q of sight.fan) ctx.lineTo(q.x, q.y);
  ctx.closePath();
  // the little circle you feel rather than see, occluded by walls like
  // everything else — both rings wound the same way, so the clip is the union
  if (sight.nearFan && sight.nearFan.length) {
    ctx.moveTo(sight.nearFan[0].x, sight.nearFan[0].y);
    for (const q of sight.nearFan) ctx.lineTo(q.x, q.y);
    ctx.closePath();
  }
  ctx.clip();
}

/**
 * What a tile is made of. Four materials and a corridor, each with its own
 * pattern — a chequer for marble, planks for wood, a plain slab for lino — so
 * you can tell a lobby from a records room from the floor alone, which is most
 * of what tells you where you are when you can only see one room at a time.
 */
const MATERIAL = [
  { a: '#3f4657', b: '#3a4152', pattern: 'plain' },     // stone: the corridors
  { a: '#525c72', b: '#485166', pattern: 'chequer' },   // marble
  { a: '#4e4131', b: '#463a2c', pattern: 'plank' },     // wood
  { a: '#454c5c', b: '#414755', pattern: 'plain' },     // lino
  { a: '#6b5a2a', b: '#5d4e24', pattern: 'chequer' },   // the vault
];

function paintRemembered(ctx, game, view) {
  const grid = game.grid;
  const seen = game.seen;
  ctx.fillStyle = COLOURS.remembered;
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      if (!seen[cy * grid.cols + cx] || grid.at(cx, cy) === WALL) continue;
      ctx.fillRect(cx * TILE, cy * TILE, TILE, TILE);
    }
  }
  // remembered walls keep their block, flat and colder than the lit ones, so
  // the map you carry in your head has the same shape as the one you can see
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      if (!seen[cy * grid.cols + cx] || grid.at(cx, cy) !== WALL) continue;
      const x = cx * TILE;
      const y = cy * TILE;
      if (!grid.solid(cx, cy + 1)) {
        ctx.fillStyle = '#12151d';
        ctx.fillRect(x, y + TILE - WALL_H, TILE, WALL_H);
      }
      ctx.fillStyle = '#242a38';
      ctx.fillRect(x, y - WALL_H, TILE, TILE);
    }
  }
}

/**
 * How big the floor bake is drawn. Matches the density of the screen it will
 * be blitted onto — crisp on a hi-dpi desktop — but capped by area, because a
 * deep floor at 2x is a hundred megabytes of canvas nobody will zoom into.
 */
function bakeScale(vp, grid) {
  const dev = (vp.scale || 1) * (vp.dpr || 1);
  let s = dev > 1.25 ? 2 : 1;
  if (grid.cols * grid.rows * TILE * TILE * s * s > 22e6) s = 1;
  return s;
}

function bakeFloor(game, scale) {
  const grid = game.grid;
  const img = makeCanvas(grid.cols * TILE * scale, grid.rows * TILE * scale);
  const g = img.getContext('2d');
  g.scale(scale, scale);
  const all = { x0: 0, y0: 0, x1: grid.cols - 1, y1: grid.rows - 1 };
  paintFloor(g, game, all);
  paintProps(g, game, all);
  return img;
}

function paintFloor(ctx, game, view) {
  const grid = game.grid;
  const material = game.level.material;
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      const kind = grid.at(cx, cy);
      if (kind === WALL) continue;
      const x = cx * TILE;
      const y = cy * TILE;
      const m = MATERIAL[kind === VAULT_FLOOR ? 4 : (material ? material[cy * grid.cols + cx] : 0)];
      ctx.fillStyle = (cx + cy) % 2 ? m.a : m.b;
      ctx.fillRect(x, y, TILE, TILE);

      // Wear and tone, seeded by the cell so every visit paints the same floor.
      // This runs once per level into the bake, so it can afford to be generous
      // — it is what stops sixty identical tiles reading as wallpaper.
      const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
      const j = (h % 9) - 4;
      if (j > 0) {
        ctx.fillStyle = `rgba(255,255,255,${j * 0.012})`;
        ctx.fillRect(x, y, TILE, TILE);
      } else if (j < 0) {
        ctx.fillStyle = `rgba(0,0,0,${-j * 0.015})`;
        ctx.fillRect(x, y, TILE, TILE);
      }

      if (m.pattern === 'plank') {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        for (let i = 1; i < 4; i++) ctx.fillRect(x, y + i * 16, TILE, 1);
        ctx.fillRect(x + ((cx * 29 + cy * 13) % 3) * 21, y, 1, TILE);
        // every few boards, one lies a shade darker — sawn from another tree
        if (h % 5 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(x, y + ((h >> 3) % 4) * 16, TILE, 16);
        }
      } else if (m.pattern === 'chequer') {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(x + 2, y + 2, 28, 28);
        ctx.fillRect(x + 34, y + 34, 28, 28);
        // a faint vein wandering across the odd slab of marble
        if (h % 7 === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + ((h >> 4) % 48), y);
          ctx.quadraticCurveTo(x + ((h >> 6) % 64), y + 32, x + ((h >> 8) % 48) + 8, y + TILE);
          ctx.stroke();
        }
      } else if (h % 11 === 0) {
        // the corridors are the used floors: a scuff where the trolleys turn
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x + ((h >> 5) % 38), y + ((h >> 9) % 52) + 6, 22, 3);
      }

      // the grout line: what makes a floor read as tiles rather than as paint
      ctx.fillStyle = COLOURS.grout;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillRect(x, y, 1, TILE);
    }
  }
}

/** A slab of furniture with a lit top and a shadow: the whole vocabulary. */
function slab(ctx, w, h, top, side, lift = 5) {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = side;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = top;
  ctx.fillRect(-w / 2, -h / 2 - lift, w, h);
}

function paintProps(ctx, game, view) {
  for (const pr of game.level.props) {
    if (pr.x < view.x0 * TILE - 80 || pr.x > (view.x1 + 1) * TILE + 80) continue;
    if (pr.y < view.y0 * TILE - 80 || pr.y > (view.y1 + 1) * TILE + 80) continue;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.a);
    ctx.scale(pr.size, pr.size);
    switch (pr.kind) {
      case 'desk':
        slab(ctx, 52, 30, '#5a4227', '#3a2b1a');
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-24, -13, 16, 20);            // the drawers
        ctx.fillStyle = '#8b6b3e';
        ctx.fillRect(-22, -6, 12, 2);
        break;
      case 'counter':
        slab(ctx, 76, 24, '#5b4a2e', '#3a2f1d', 7);
        ctx.fillStyle = '#8f7440';
        ctx.fillRect(-38, -19, 76, 3);             // the brass rail
        break;
      case 'cabinet':
        slab(ctx, 32, 26, '#4a5162', '#2b303c');
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-14, -12, 28, 1);
        ctx.fillRect(-14, -4, 28, 1);
        ctx.fillStyle = '#98a3b8';
        ctx.fillRect(-3, -9, 6, 2);
        break;
      case 'chair':
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d3346';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#584a63';
        ctx.fillRect(-11, -12, 22, 6);             // the back
        break;
      case 'plant':
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(2, 4, 14, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6a4a32';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + pr.tone * 3;
          ctx.fillStyle = i % 2 ? '#3f7a48' : '#2f5f38';
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 7, Math.sin(a) * 7 - 5, 8, 5, a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'bench':
        slab(ctx, 60, 18, '#4d3a24', '#2f2416', 4);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(-30, -6, 60, 1);
        break;
      case 'crate':
        slab(ctx, 34, 30, '#6b5836', '#3f3320');
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-17, -20);
        ctx.lineTo(17, 5);
        ctx.moveTo(17, -20);
        ctx.lineTo(-17, 5);
        ctx.stroke();
        break;
      case 'monitor':
        slab(ctx, 30, 20, '#232833', '#171b24', 6);
        ctx.fillStyle = pr.tone > 0.5 ? '#3f6ea0' : '#2f5580';
        ctx.fillRect(-12, -24, 24, 12);            // the screen, faintly on
        break;
      case 'rug':
        ctx.fillStyle = `rgba(104,46,56,${0.4 + pr.tone * 0.25})`;
        ctx.fillRect(-46, -32, 92, 64);
        ctx.strokeStyle = 'rgba(210,160,110,0.2)';
        ctx.lineWidth = 3;
        ctx.strokeRect(-40, -26, 80, 52);
        break;
      default:                                     // 'plate', the vault's inlay
        ctx.strokeStyle = `rgba(240,198,90,${0.25 + pr.tone * 0.2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(-30, -22, 60, 44);
    }
    ctx.restore();
  }
}

// ------------------------------------------------------ everything standing

/**
 * Is this wall tile one the player can see the face of?
 *
 * At most two casts: the face nearest on x and the one nearest on y. The points
 * are just *outside* the tile, never inside it — a point one pixel into a wall
 * is inside a wall, nothing inside a wall is ever visible, and asking that way
 * draws the bank as rooms with no walls at all.
 */
function wallLit(sight, cx, cy) {
  const x0 = cx * TILE;
  const y0 = cy * TILE;
  const mid = TILE / 2;
  const px = sight.x < x0 ? x0 - 1 : sight.x > x0 + TILE ? x0 + TILE + 1 : null;
  const py = sight.y < y0 ? y0 - 1 : sight.y > y0 + TILE ? y0 + TILE + 1 : null;
  if (px !== null && sight.sees(px, y0 + mid)) return true;
  if (py !== null && sight.sees(x0 + mid, py)) return true;
  return px === null && py === null;
}

/**
 * The walls, and everybody between them, in one walk down the screen.
 *
 * Row by row: the wall blocks of the row, then whoever is standing in it. A
 * figure north of a wall is drawn before it and the wall covers their legs; a
 * figure south of it is drawn after and stands in front. That is the whole of
 * the depth in an oblique view, and doing it in two separate passes instead is
 * how you get a guard walking through the front of a counter.
 */
function paintStanding(ctx, game, view, opts, wallScale = 1) {
  const grid = game.grid;
  const sight = game.sight;
  const standing = [];
  const add = (y, draw) => standing.push({ y, draw });

  const lit = (x, y) => !sight || sight.sees(x, y);

  const v = game.level.vault;
  if (lit(v.x, v.y)) add(v.y, () => drawVault(ctx, v));

  for (const it of game.items) {
    if (it.taken || !lit(it.x, it.y)) continue;
    add(it.y, () => drawItem(ctx, it, game));
  }
  for (const b of game.bodies) {
    if (!lit(b.x, b.y)) continue;
    add(b.y, () => drawBody(ctx, b));
  }
  for (const a of game.alarms) {
    if (!lit(a.x, a.y)) continue;
    add(a.y, () => drawPanel(ctx, a, game));
  }
  for (const c of game.cameras) {
    if (!lit(c.x, c.y)) continue;
    add(c.y, () => drawCamera(ctx, c));
  }
  for (const g of game.guards) {
    if (g.dead || !lit(g.x, g.y)) continue;
    add(g.y, () => drawGuard(ctx, g));
  }
  const p = game.player;
  add(p.y, () => drawPlayer(ctx, game, opts));

  standing.sort((a, b) => a.y - b.y);

  let i = 0;
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      if (grid.at(cx, cy) !== WALL) continue;
      if (sight && !wallLit(sight, cx, cy)) continue;
      const img = wallSprite(grid, cx, cy, wallScale);
      ctx.drawImage(img, cx * TILE, cy * TILE - WALL_H, TILE, TILE + WALL_H);
    }
    const limit = (cy + 1) * TILE;
    while (i < standing.length && standing[i].y < limit) standing[i++].draw();
  }
  while (i < standing.length) standing[i++].draw();
}

/**
 * A wall block's picture depends only on which neighbours are open and on the
 * tile's parity — thirty-two variants for the whole game. Each is painted once
 * into a sprite; twelve fills per wall per frame become one blit.
 */
function wallSprite(grid, cx, cy, scale) {
  const key =
    (grid.solid(cx, cy + 1) ? 1 : 0) |
    (grid.solid(cx, cy - 1) ? 2 : 0) |
    (grid.solid(cx + 1, cy) ? 4 : 0) |
    (grid.solid(cx - 1, cy) ? 8 : 0) |
    (cx % 2 ? 16 : 0) |
    (scale === 2 ? 32 : 0);
  let img = WALL_SPRITES.get(key);
  if (!img) {
    img = makeCanvas(TILE * scale, (TILE + WALL_H) * scale);
    const g = img.getContext('2d');
    g.scale(scale, scale);
    g.translate(0, WALL_H);       // the sprite's origin is the tile's top-left
    drawWallBlock(g, {
      south: !!(key & 1), north: !!(key & 2), east: !!(key & 4), west: !!(key & 8), odd: !!(key & 16),
    });
    WALL_SPRITES.set(key, img);
  }
  return img;
}

/**
 * One wall tile as a block: the top, and the face turned towards you.
 *
 * The courses and the seams are not decoration. A run of eight tiles drawn as
 * one flat colour is a painted bar — you cannot tell how long it is, and a
 * corridor made of two of them has no scale at all. Two courses of masonry and
 * a seam per tile give the eye something to count.
 */
function drawWallBlock(ctx, n) {
  const faceTop = TILE - WALL_H;

  if (!n.south) {
    ctx.fillStyle = COLOURS.wallFace;
    ctx.fillRect(0, faceTop, TILE, WALL_H);
    // two courses, offset on alternate tiles so the joints do not line up
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, faceTop + WALL_H / 2 - 1, TILE, 1);
    const off = n.odd ? TILE / 2 : 0;
    ctx.fillRect(off, faceTop, 1, WALL_H / 2);
    ctx.fillRect((off + TILE / 2) % TILE, faceTop + WALL_H / 2, 1, WALL_H / 2);
    // the skirting where the wall meets the floor
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, TILE - 3, TILE, 3);
  }

  ctx.fillStyle = COLOURS.wallTop;
  ctx.fillRect(0, -WALL_H, TILE, TILE);
  // a light catching the near edge of the top, so it does not read as a hole
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, TILE - WALL_H - 8, TILE, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, -WALL_H, TILE, 5);

  ctx.fillStyle = COLOURS.wallEdge;
  ctx.fillRect(0, faceTop - 2, TILE, 2);                       // the lip, top meets face
  if (!n.north) ctx.fillRect(0, -WALL_H, TILE, 2);
  if (!n.east) ctx.fillRect(TILE - 2, -WALL_H, 2, TILE);
  if (!n.west) ctx.fillRect(0, -WALL_H, 2, TILE);
  // the seam between two tiles of the same run, faint enough not to be a crack
  if (n.east) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(TILE - 1, -WALL_H, 1, TILE);
  }
}

// --------------------------------------------------------------- the people

/** The shadow every standing thing drops on its own tile. */
function shadow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A person, seen from almost directly above and fitting inside their own tile.
 *
 * The shoulders, the arms and the gun are drawn in the man's own frame, so they
 * turn with him — which from up here is what a man turning looks like. The one
 * thing that does *not* turn is the head: it is lifted a few pixels up the
 * screen and given its own shadow, and that little parallax is the whole of the
 * third dimension. It is enough to stop him being a disc, and small enough that
 * where he is drawn and where he is standing are the same place — which is what
 * makes aiming at him and hitting him the same act.
 */
function drawPerson(ctx, x, y, facing, kit, o = {}) {
  const k = o.scale || 1;
  const cos = Math.cos(facing);
  const sin = Math.sin(facing);

  shadow(ctx, x, y, 15 * k);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facing);
  ctx.scale(k, k);

  // boots, poking out behind the shoulders as he walks
  const stride = o.stride || 0;
  ctx.fillStyle = kit.legs;
  ctx.fillRect(-13, -11 + stride, 9, 7);
  ctx.fillRect(-13, 4 - stride, 9, 7);

  // the pack on his back, if he is carrying one
  if (o.bag) {
    ctx.fillStyle = kit.bag || '#3a3f52';
    ctx.beginPath();
    ctx.roundRect(-19, -10, 11, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-19, -2, 11, 3);
  }

  // Shoulders: wider across than deep. That one proportion is what makes a
  // figure seen from above read as facing somewhere — a circle with a gun
  // sticking out of it reads as a circle with a gun sticking out of it.
  ctx.fillStyle = kit.coat;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = kit.coatDark;
  ctx.beginPath();
  ctx.ellipse(-5, 0, 8, 15, 0, 0, Math.PI * 2);   // the back, in its own shade
  ctx.fill();
  if (kit.vest) {
    ctx.fillStyle = kit.vest;
    ctx.beginPath();
    ctx.roundRect(-6, -11, 13, 22, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-6, -2, 13, 3);
  }
  ctx.fillStyle = kit.trim;
  ctx.fillRect(5, -3, 4, 6);                       // the collar, catching the light

  // arms out in front, holding whatever he is holding
  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(3, side * 11);
    ctx.lineTo(15, side * 5);
    ctx.stroke();
  }
  if (o.gun) {
    ctx.save();
    ctx.translate(13, 0);
    ctx.scale(0.92, 0.92);
    drawGunShape(ctx, o.gun);
    ctx.restore();
  }
  ctx.restore();

  // The head, in screen space and a few pixels up. Drawn after the body and
  // never rotated with it, so it reads as being above the shoulders rather
  // than beside them.
  const hx = x + cos * 3;
  const hy = y + sin * 3 - HEAD_LIFT * k;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + cos * 3, y + sin * 3 + 1, 8 * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(facing);
  ctx.scale(k, k);
  ctx.fillStyle = kit.skin;
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  // the top of the head: whatever he has on it, seen from above
  ctx.fillStyle = kit.head;
  if (kit.hat === 'cap') {
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, Math.PI * 0.5, Math.PI * 1.5);   // the crown
    ctx.fill();
    ctx.fillRect(0, -6, 5, 12);                         // the peak, pointing forward
    ctx.fillStyle = kit.trim;
    ctx.fillRect(1.5, -2, 3, 4);                        // the badge on it
  } else if (kit.hat === 'helmet') {
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.trim;
    ctx.fillRect(-7, -1.5, 14, 3);                      // the ridge over the top
    ctx.fillStyle = COLOURS.ink;
    ctx.fillRect(4, -4, 3, 8);                          // the visor
  } else {
    // a balaclava with a strip of face showing, which is what a bank robber
    // looks like from directly overhead
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.skin;
    ctx.fillRect(2.5, -4.5, 4.5, 9);
    ctx.fillStyle = COLOURS.ink;
    ctx.fillRect(3.5, -3.5, 2, 2.5);
    ctx.fillRect(3.5, 1, 2, 2.5);
  }
  ctx.restore();
}

/**
 * Every gun as a silhouette, drawn pointing right from the grip at (0,0).
 *
 * They are told apart by outline alone: on the floor there is no label, and in
 * a corridor lit by a torch there is no time to read one.
 */
export function drawGunShape(ctx, id) {
  const steel = COLOURS.steel;
  const black = '#2f3542';
  const wood = '#7a5230';
  const wear = '#5f6b82';
  const set = (c) => { ctx.fillStyle = c; };

  switch (id) {
    case 'silenced':
      set(black); ctx.fillRect(-3, 1, 5, 8);              // the grip
      set(steel); ctx.fillRect(-2, -2, 14, 4);
      set(wear); ctx.fillRect(12, -3.5, 13, 7);           // the can, fatter than the barrel
      set(black); ctx.fillRect(22, -3.5, 3, 7);
      break;
    case 'pistol':
      set(black); ctx.fillRect(-3, 1, 6, 9);
      set(steel); ctx.fillRect(-2, -2.5, 18, 5);
      set(black); ctx.fillRect(-1, -2.5, 4, 5);           // the ejection port
      break;
    case 'revolver':
      set(wood); ctx.fillRect(-4, 1, 6, 9);               // wooden grips
      set(steel); ctx.fillRect(-2, -2, 19, 4);
      set(wear); ctx.beginPath(); ctx.arc(4, 0, 5, 0, Math.PI * 2); ctx.fill();
      set(black); ctx.beginPath(); ctx.arc(4, 0, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'smg':
      set(black); ctx.fillRect(-9, -2, 6, 4);             // the folded stock
      ctx.fillRect(-4, -3.5, 22, 6);
      ctx.fillRect(2, 2, 5, 12);                          // the long magazine
      set(wear); ctx.fillRect(10, -1.5, 10, 3);
      break;
    case 'shotgun':
      set(wood); ctx.fillRect(-12, -3.5, 9, 7);           // the butt
      set(black); ctx.fillRect(-4, -3, 30, 5);
      set(wood); ctx.fillRect(8, 2, 13, 4);               // the pump
      set(wear); ctx.fillRect(20, -3, 8, 5);
      break;
    case 'rifle':
      set(wood); ctx.fillRect(-13, -3, 10, 6);
      set(black); ctx.fillRect(-5, -2.5, 34, 4.5);
      ctx.fillRect(0, 1, 5, 11);
      set(wear); ctx.fillRect(20, -1.5, 10, 3);
      break;
    case 'sniper':
      set(wood); ctx.fillRect(-16, -3, 12, 6);
      set(black); ctx.fillRect(-6, -2, 44, 3.5);
      ctx.fillRect(0, 1, 4, 9);
      set(wear); ctx.fillRect(1, -9, 16, 4.5);            // the scope on its rail
      set(black); ctx.fillRect(3, -5.5, 2, 3); ctx.fillRect(13, -5.5, 2, 3);
      break;
    case 'lmg':
      set(black); ctx.fillRect(-13, -4, 7, 8);
      ctx.fillRect(-8, -4, 34, 7);
      set(wear); ctx.beginPath(); ctx.arc(4, 7, 8, 0, Math.PI * 2); ctx.fill();  // the drum
      set(black); ctx.beginPath(); ctx.arc(4, 7, 3, 0, Math.PI * 2); ctx.fill();
      set(wear); ctx.fillRect(20, -2, 10, 3);
      break;
    case 'dart':
      set('#3f4a3a'); ctx.fillRect(-4, 0, 5, 8);
      set('#6d7a5e'); ctx.fillRect(-2, -1.5, 21, 3);      // olive, not gunmetal
      set(wear); ctx.beginPath(); ctx.arc(6, -4.5, 4, 0, Math.PI * 2); ctx.fill();  // gas bottle
      set('#e08a3a'); ctx.fillRect(17, -2, 4, 4);         // the orange tip
      break;
    default:
      set(steel); ctx.fillRect(-2, -2, 16, 4);
  }
}

function drawPlayer(ctx, game, opts = {}) {
  const p = game.player;
  if (p.dragging) {
    ctx.strokeStyle = 'rgba(126,215,196,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.dragging.x, p.dragging.y);
    ctx.stroke();
  }

  const kit = p.hurt > 0 ? { ...KIT.player, coat: '#e88f86', coatDark: '#b05a52' } : KIT.player;
  if (p.roll > 0) {
    // tucked in and spinning: smaller, faster, and no gun in his hands
    const spin = (1 - p.roll / ROLL.time) * Math.PI * 2;
    drawPerson(ctx, p.x, p.y, p.rollA + spin, kit, { scale: 0.78, bag: game.stats.loot > 0 });
    return;
  }

  drawPerson(ctx, p.x, p.y, p.facing, kit, {
    stride: Math.sin(p.step * 0.09) * 3,
    gun: p.weapon.id,
    bag: game.stats.loot > 0,
  });
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(126,215,196,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 19, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (game.focus) ring(ctx, p.x, p.y - 30, 13, game.focus.t / game.focus.need, COLOURS.gold);
  void opts;
}

/** The uniform he is in, which is also how far down the building he works. */
function guardKit(g) {
  const base = g.state === 'patrol' ? KIT.guardCalm : KIT.guard;
  const tier = WEAPONS[g.gun] ? WEAPONS[g.gun].tier : 0;
  if (tier >= 3) return { ...base, hat: 'helmet', vest: '#2b3140' };
  if (tier === 2) return { ...base, hat: 'cap', vest: '#39303c' };
  return { ...base, hat: 'cap' };
}

function drawGuard(ctx, g) {
  drawPerson(ctx, g.x, g.y, g.facing, guardKit(g), {
    stride: Math.sin((g.x + g.y) * 0.05) * 3,
    gun: g.gun,
  });

  if (g.state !== 'patrol') {
    ctx.fillStyle = g.state === 'call' ? COLOURS.alarm : '#ffd88a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.state === 'call' ? '!' : '?', g.x, g.y - 28);
  }
  if (g.hp < g.maxHp) {
    const w = 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(g.x - w / 2, g.y - 22, w, 4);
    ctx.fillStyle = COLOURS.alarm;
    ctx.fillRect(g.x - w / 2, g.y - 22, w * Math.max(0, g.hp / g.maxHp), 4);
  }
}

/** A man on the floor: face down, arms out, and no head lifted off it. */
function drawBody(ctx, b) {
  if (!b.tranq) {
    ctx.fillStyle = 'rgba(142,47,63,0.35)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 2, 25, 17, b.a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.a);
  ctx.fillStyle = KIT.body.legs;
  ctx.fillRect(-16, -8, 10, 6);
  ctx.fillRect(-16, 2, 10, 6);
  ctx.fillStyle = KIT.body.coat;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 13, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = KIT.body.skin;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, side * 8);
    ctx.lineTo(9, side * 12);          // arms flung out
    ctx.stroke();
  }
  ctx.fillStyle = KIT.body.head;
  ctx.beginPath();
  ctx.arc(11, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawItem(ctx, it, game) {
  const bob = Math.sin((it.x + it.y) * 0.05 + game.stats.time * 2) * 2;
  shadow(ctx, it.x, it.y, 10);
  if (it.kind === 'loot') {
    const y = it.y - 12 + bob;
    ctx.fillStyle = COLOURS.loot;
    ctx.beginPath();
    ctx.moveTo(it.x - 11, y + 11);
    ctx.lineTo(it.x - 7, y - 5);
    ctx.lineTo(it.x + 7, y - 5);
    ctx.lineTo(it.x + 11, y + 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a5f12';
    ctx.fillRect(it.x - 5, y - 9, 10, 5);
  } else if (it.kind === 'medkit') {
    const y = it.y - 14 + bob;
    ctx.fillStyle = '#e8eef8';
    ctx.fillRect(it.x - 10, y, 20, 14);
    ctx.fillStyle = '#b9c4d6';
    ctx.fillRect(it.x - 10, y + 14, 20, 4);
    ctx.fillStyle = COLOURS.blood;
    ctx.fillRect(it.x - 2, y + 3, 4, 9);
    ctx.fillRect(it.x - 6, y + 6, 12, 3);
  } else {
    ctx.save();
    ctx.translate(it.x - 8, it.y - 8 + bob);
    ctx.rotate(-0.35);
    ctx.scale(0.85, 0.85);
    drawGunShape(ctx, it.gun);
    ctx.restore();
  }
  const f = game.focus;
  if (f && f.target === it) ring(ctx, it.x, it.y - 26, 14, f.t / f.need, COLOURS.gold);
}

/** Bolted to the wall behind it, so it is drawn up the wall's face. */
function drawPanel(ctx, a, game) {
  const onWall = Math.sin(a.facing) > 0.5 ? WALL_H * 0.7 : 10;
  const y = a.y - onWall;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(a.x - 11, y - 12, 22, 26);
  ctx.fillStyle = a.dead ? '#3a3f4c' : COLOURS.alarm;
  ctx.fillRect(a.x - 9, y - 10, 18, 22);
  ctx.fillStyle = a.dead ? '#20242f' : '#ffd9c8';
  ctx.fillRect(a.x - 4, y - 5, 8, 11);
  if (!a.dead && game.alarm.on) {
    ctx.fillStyle = `rgba(255,90,77,${0.3 + Math.abs(Math.sin(game.alarm.ring * 6)) * 0.5})`;
    ctx.beginPath();
    ctx.arc(a.x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  const f = game.focus;
  if (f && f.target === a) ring(ctx, a.x, y - 26, 14, f.t / f.need, COLOURS.alarm);
}

function drawCamera(ctx, c) {
  const y = c.y - WALL_H * 0.75;
  ctx.save();
  ctx.translate(c.x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-9, -8, 18, 16);
  ctx.rotate(c.facing);
  ctx.fillStyle = c.dead ? '#3a3f4c' : COLOURS.camera;
  ctx.fillRect(-7, -6, 15, 12);
  ctx.fillRect(7, -3, 8, 6);
  if (!c.dead) {
    ctx.fillStyle = c.lock > 0 ? COLOURS.alarm : '#5f7ba8';
    ctx.fillRect(-6, -5, 3, 3);
  }
  ctx.restore();
}

function drawVault(ctx, v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 6, VAULT.r, VAULT.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -14);
  ctx.fillStyle = COLOURS.vaultLit;
  ctx.beginPath();
  ctx.arc(0, 0, VAULT.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2415';
  ctx.beginPath();
  ctx.arc(0, 0, VAULT.r - 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOURS.gold;
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + v.cracked * 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
    ctx.lineTo(Math.cos(a) * (VAULT.r - 14), Math.sin(a) * (VAULT.r - 14));
    ctx.stroke();
  }
  ctx.restore();
  if (v.cracked > 0 && v.cracked < 1) ring(ctx, v.x, v.y - 14, VAULT.r + 10, v.cracked, COLOURS.good);
}

/** Distance falloff on everything already drawn, centred on the torch. */
function paintFalloff(ctx, game, view) {
  const p = game.player;
  const r = PLAYER.sight;
  const x0 = view.x0 * TILE - TILE;
  const y0 = view.y0 * TILE - TILE;
  const x1 = x0 + (view.x1 - view.x0 + 3) * TILE;
  const y1 = y0 + (view.y1 - view.y0 + 3) * TILE;
  // the sprite carries the gradient; beyond its square the falloff has already
  // bottomed out, so the rest of the view is four flat bands at the final stop
  ctx.drawImage(radials().falloff, p.x - r, p.y - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(7,8,12,0.56)';
  const lx = Math.max(x0, p.x - r);
  const rx = Math.min(x1, p.x + r);
  if (p.x - r > x0) ctx.fillRect(x0, y0, p.x - r - x0, y1 - y0);
  if (p.x + r < x1) ctx.fillRect(p.x + r, y0, x1 - (p.x + r), y1 - y0);
  if (p.y - r > y0) ctx.fillRect(lx, y0, rx - lx, p.y - r - y0);
  if (p.y + r < y1) ctx.fillRect(lx, p.y + r, rx - lx, y1 - (p.y + r));
}

/**
 * The man the gun has found. Without this the assist is invisible and reads as
 * the game shooting where it likes — with it, it reads as the gun helping.
 *
 * The brackets sit wide while the body is still turning and close as it lines
 * up — which is also the answer to "why has my shot not left yet": the gun
 * holds its fire until the brackets shut (see `ASSIST.settle`).
 */
function paintReticle(ctx, g, p) {
  const off = Math.abs(angleDelta(p.facing, Math.atan2(g.y - p.y, g.x - p.x)));
  const open = clamp(off / (45 * RAD), 0, 1);
  const t = 19 + open * 14;
  ctx.strokeStyle = `rgba(255,238,160,${0.85 - open * 0.35})`;
  ctx.lineWidth = 2.5;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(g.x + sx * t, g.y + sy * t - 6 * sy);
    ctx.lineTo(g.x + sx * t, g.y + sy * t);
    ctx.lineTo(g.x + sx * t - 6 * sx, g.y + sy * t);
    ctx.stroke();
  }
}

/** The one shape every timer in this game uses: the vault's, at every size. */
function ring(ctx, x, y, r, k, colour) {
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + clamp(k, 0, 1) * Math.PI * 2);
  ctx.stroke();
}

// ---------------------------------------------------------------- the cones

function paintCones(ctx, game) {
  const grid = game.grid;
  const plan = game.level.plan;
  const p = game.player;
  // Everything here is clipped to the player's own sight, so a cone that cannot
  // reach it cannot show — and casting thirty rays for each of sixteen guards
  // to draw nothing is most of a frame on a phone.
  const reaches = (x, y, range) => (x - p.x) ** 2 + (y - p.y) ** 2 < (range + PLAYER.sight) ** 2;

  const s = radials();
  const range = plan.guardSight * (game.alarm.on ? 1.2 : 1);
  for (const g of game.guards) {
    if (g.dead || !reaches(g.x, g.y, range)) continue;
    const hot = g.state === 'call' || g.state === 'hunt';
    cone(ctx, grid, g.x, g.y, g.facing, plan.guardFov, range,
      hot ? s.coneHot : g.alert > 0.2 ? s.coneWary : s.coneCalm,
      hot ? 0.3 : g.alert > 0.2 ? 0.25 : 0.17);
  }
  for (const c of game.cameras) {
    if (c.dead || !reaches(c.x, c.y, c.range)) continue;
    cone(ctx, grid, c.x, c.y, c.facing, CAMERA.fov, c.range,
      c.lock > 0 ? s.coneHot : s.coneCam, c.lock > 0 ? 0.3 : 0.2);
  }
}

/**
 * The lamp's light, not a stencil of it: the fan clips a radial sprite, so the
 * cone is bright at the eye and gone at the edge — a torch beam, where the old
 * flat fill read as a painted slice of floor.
 */
function cone(ctx, grid, x, y, facing, fov, range, sprite, alpha) {
  const fan = visibilityFan(grid, x, y, facing, fov, range, 30);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (const q of fan) ctx.lineTo(q.x, q.y);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - range, y - range, range * 2, range * 2);
  ctx.restore();
}

/**
 * A muzzle flash is light, and light is visible wherever there is a line to it
 * — cone or no cone. Without this, being shot at from the dark has no picture
 * at all: the health bar drops and the screen says nothing about why.
 */
function paintMuzzles(ctx, game) {
  const p = game.player;
  for (const g of game.guards) {
    if (g.dead || g.cool < WEAPONS[g.gun].rate * 0.55) continue;
    if (!lineOfSight(game.grid, p.x, p.y, g.x, g.y)) continue;
    const a = g.facing;
    const fx = g.x + Math.cos(a) * 16;
    const fy = g.y + Math.sin(a) * 16;
    ctx.drawImage(radials().muzzle, fx - 58, fy - 58, 116, 116);
  }
}

function paintBullets(ctx, game) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (const b of game.bullets) {
    ctx.strokeStyle = b.side === 'player' ? 'rgba(180,240,225,0.9)' : 'rgba(255,150,110,0.95)';
    ctx.beginPath();
    // Drawn on the floor plane, which is exactly where it travels. Lifting the
    // tracer to chest height looks better and lies: the round is then somewhere
    // other than where it is tested, and shots that visibly cross a man miss.
    ctx.moveTo(b.x, b.y);
    // the tail is the last twenty milliseconds of flight — a dot at 1700 px/s
    // reads as nothing at all
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function paintFx(ctx, fx) {
  if (!fx) return;
  for (const b of fx.bits) {
    ctx.globalAlpha = clamp(b.t / b.life, 0, 1);
    ctx.fillStyle = b.colour;
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }
  for (const r of fx.rings) {
    ctx.globalAlpha = clamp(r.t / r.life, 0, 1) * 0.6;
    ctx.strokeStyle = r.colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const f of fx.floats) {
    ctx.globalAlpha = clamp(f.t / f.life, 0, 1);
    ctx.fillStyle = f.colour;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ----------------------------------------------------------------- the HUD

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10,12,18,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(140,155,185,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

/**
 * The two screen-sized gradients the HUD wears — the corner vignette and the
 * red "being looked at" wash — baked at quarter resolution when the viewport
 * changes size, and stretched over the frame from then on. The blit's own
 * smoothing hides the low resolution completely; a gradient has no detail.
 */
function shadeFor(r, W, H) {
  if (r.shade.W === W && r.shade.H === H && r.shade.vignette) return r.shade;
  const q = 4;
  const bake = (rgb, from, to, edge) => {
    const c = makeCanvas(W / q, H / q);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(W / 2 / q, H / 2 / q, from / q, W / 2 / q, H / 2 / q, to / q);
    grd.addColorStop(0, `rgba(${rgb},0)`);
    grd.addColorStop(1, `rgba(${rgb},${edge})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W / q, H / q);
    return c;
  };
  const d = Math.hypot(W, H);
  r.shade = {
    W,
    H,
    vignette: bake('0,0,0', d * 0.34, d * 0.56, 0.32),
    // baked at full strength; `globalAlpha` turns the detection level into it
    wash: bake('255,50,40', (d / 2) * 0.42, d / 2, 1),
  };
  return r.shade;
}

function paintHud(ctx, game, vp, opts, r) {
  const { W, H } = vp;
  const p = game.player;
  const stats = game.stats;
  const shade = shadeFor(r, W, H);

  // A corner vignette, first: over the world and under every panel. Drawn after
  // the HUD instead, it dims the very things that have to stay readable.
  ctx.drawImage(shade.vignette, 0, 0, W, H);

  ctx.textBaseline = 'middle';

  // ---- floor and takings.
  //
  // Held upright the canvas is turned a quarter turn, but the flags and the
  // mute button are DOM and stay where they are — over the *game's* top-left
  // corner, which is the screen's top-right. So this panel steps out of the way
  // by the width of those controls, which on a turned screen is along x.
  const inset = vp.turned ? 74 : 0;
  ctx.textAlign = 'left';
  panel(ctx, 16 + inset, 16, 250, 62);
  ctx.fillStyle = COLOURS.hud;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(t('hud.floor', { n: game.level.floor }), 28 + inset, 38);
  ctx.fillStyle = COLOURS.loot;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`$ ${stats.money.toLocaleString(i18n.lang === 'pt' ? 'pt-BR' : 'en-US')}`, 28 + inset, 64);

  // ---- health, and the gun in his hands drawn rather than named twice
  const barW = 250;
  panel(ctx, 16, H - 100, barW + 24, 84);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(28, H - 88, barW, 16);
  ctx.fillStyle = p.hp > 35 ? COLOURS.good : COLOURS.alarm;
  ctx.fillRect(28, H - 88, barW * clamp(p.hp / p.maxHp, 0, 1), 16);
  ctx.fillStyle = COLOURS.hud;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)}`, 28 + barW - 28, H - 80);

  ctx.save();
  ctx.translate(44, H - 46);
  ctx.scale(0.9, 0.9);
  drawGunShape(ctx, p.weapon.id);
  ctx.restore();
  const ammo = Number.isFinite(p.weapon.ammo) ? `${p.weapon.ammo}` : '∞';
  ctx.fillStyle = COLOURS.hud;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(`${t(`gun.${p.weapon.id}`)}  ·  ${ammo}`, 96, H - 44);

  // ---- what he is standing on, named. Measured, because "pegar espingarda"
  //      and "take the shotgun" are not the same width.
  if (game.focus || game.prompt) {
    const label = game.focus ? focusLabel(game.focus) : promptLabel(game.prompt, opts);
    ctx.font = 'bold 17px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 28;
    const x = W / 2 - w / 2;
    const y = H - 124;
    panel(ctx, x, y, w, 34, 0.72);
    ctx.fillStyle = COLOURS.hud;
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, y + 17);
  }

  if (game.level.vault.cracked > 0 && game.level.vault.cracked < 1) {
    ctx.fillStyle = COLOURS.hud;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('hud.drilling'), W / 2, H - 160);
  }

  // ---- being looked at
  if (game.detection > 0.02) {
    const k = clamp(game.detection, 0, 1);
    ctx.globalAlpha = 0.05 + k * 0.24;
    ctx.drawImage(shade.wash, 0, 0, W, H);
    ctx.globalAlpha = 1;

    if (game.detector) {
      const a = Math.atan2(game.detector.y - p.y, game.detector.x - p.x);
      const rr = Math.min(W, H) * 0.31;
      ctx.save();
      ctx.translate(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr);
      ctx.rotate(a);
      ctx.fillStyle = `rgba(255,80,66,${0.35 + k * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  if (game.alarm.on) {
    const pulse = 0.35 + Math.abs(Math.sin(game.alarm.ring * 4)) * 0.45;
    ctx.fillStyle = `rgba(255,70,58,${pulse})`;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('hud.alarm'), W / 2, 40);
  }

  paintMinimap(ctx, game, vp);
  paintCompass(ctx, game, vp);
  if (opts.touch) paintTouch(ctx, opts.touch, vp, game);
}

function focusLabel(f) {
  if (f.kind === 'alarm') return t('prompt.pull');
  if (f.kind === 'gun') return t('prompt.take', { gun: t(`gun.${f.target.gun}`) });
  if (f.kind === 'medkit') return t('prompt.heal');
  return t('prompt.loot');
}

function promptLabel(prompt, opts) {
  const key = opts.touch ? 'hud.tap' : 'hud.key';
  return `${t(key)} — ${t(prompt.kind === 'drop' ? 'prompt.drop' : 'prompt.carry')}`;
}

/**
 * The floor as you remember it, and nothing else: the guards are not on it.
 * A map that shows where everybody is standing is a different game — this one
 * is about not knowing.
 */
function paintMinimap(ctx, game, vp) {
  const grid = game.grid;
  // a constant width whatever the floor's size: a fixed cell makes the first
  // floor a stamp and the fortieth a poster
  const size = Math.max(3, Math.round(184 / grid.cols));
  const w = grid.cols * size;
  const h = grid.rows * size;
  const x = vp.W - w - 20;
  const y = 20;
  panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.62);
  for (let cy = 0; cy < grid.rows; cy++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      if (!game.seen[cy * grid.cols + cx]) continue;
      ctx.fillStyle = grid.at(cx, cy) === WALL ? 'rgba(120,133,160,0.45)' : 'rgba(200,214,240,0.2)';
      ctx.fillRect(x + cx * size, y + cy * size, size, size);
    }
  }
  const v = game.level.vault;
  if (game.seen[v.cy * grid.cols + v.cx]) {
    ctx.fillStyle = COLOURS.gold;
    ctx.fillRect(x + v.cx * size - 2, y + v.cy * size - 2, size + 4, size + 4);
  }
  for (const a of game.alarms) {
    const cx = Math.floor(a.x / TILE);
    const cy = Math.floor(a.y / TILE);
    if (!game.seen[cy * grid.cols + cx]) continue;
    ctx.fillStyle = a.dead ? 'rgba(120,133,160,0.6)' : COLOURS.alarm;
    ctx.fillRect(x + cx * size, y + cy * size, size, size);
  }
  ctx.fillStyle = KIT.player.trim;
  ctx.fillRect(x + (game.player.x / TILE) * size - 2, y + (game.player.y / TILE) * size - 2, 5, 5);
}

/** Which way the vault is, from the middle of the screen. Always on. */
function paintCompass(ctx, game, vp) {
  const p = game.player;
  const v = game.level.vault;
  const a = Math.atan2(v.y - p.y, v.x - p.x);
  const rr = Math.min(vp.W, vp.H) * 0.2;
  ctx.save();
  ctx.translate(vp.W / 2 + Math.cos(a) * rr, vp.H / 2 + Math.sin(a) * rr);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(240,198,90,0.5)';
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-6, -7);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The two sticks where the thumbs left them, and the three round buttons. */
function paintTouch(ctx, touch, vp, game) {
  const ring2 = (x, y, r, alpha) => {
    ctx.strokeStyle = `rgba(232,238,248,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  const gun = fireButton(vp.W, vp.H);
  const firing = touch.trigger.on;

  for (const s of [touch.stick, touch.trigger]) {
    if (!s.on) continue;
    // A drag that started on the icon already has a face — the reticle lights up
    // and grows a barrel. Painting the stick's ring and knob on top of it only
    // puts three circles and an arrow in the same corner.
    if (s.onIcon) continue;
    ring2(s.ox, s.oy, STICK.max * 0.62, 0.2);
    const dx = s.x - s.ox;
    const dy = s.y - s.oy;
    const len = Math.min(STICK.max * 0.62, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = 'rgba(232,238,248,0.3)';
    ctx.beginPath();
    ctx.arc(s.ox + Math.cos(a) * len, s.oy + Math.sin(a) * len, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  const button = (b, glyph, ready) => {
    ctx.fillStyle = `rgba(10,12,18,${ready ? 0.55 : 0.3})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ring2(b.x, b.y, b.r, ready ? 0.45 : 0.18);
    ctx.globalAlpha = ready ? 1 : 0.4;
    ctx.fillStyle = COLOURS.hud;
    ctx.font = '28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(glyph, b.x, b.y + 2);
    ctx.globalAlpha = 1;
  };
  paintFireIcon(ctx, gun, firing, touch.trigger.angle);
  button(rollButton(vp.W, vp.H), '🌀', game.player.rollCool <= 0);
  if (game.prompt) button(useButton(vp.W, vp.H), '✋', true);
}

/**
 * The trigger, drawn rather than typed: 🔫 is a water pistol on half the phones
 * in the world and a gun on the other half, and a reticle says "this is where
 * you shoot from" in every language the catalog speaks.
 *
 * It lights up while it is held, and grows a barrel pointing the way the thumb
 * has dragged — so the icon is also the readout that tells you the drag took.
 */
function paintFireIcon(ctx, b, firing, angle) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = firing ? 'rgba(255,70,58,0.3)' : 'rgba(10,12,18,0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.fill();

  const tint = firing ? 'rgba(255,148,138,0.95)' : 'rgba(232,238,248,0.6)';
  ctx.strokeStyle = tint;
  ctx.fillStyle = tint;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.stroke();

  // the reticle: a ring with four ticks through it and a dot in the middle
  const r = b.r * 0.46;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
    ctx.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  if (typeof angle === 'number') {
    ctx.rotate(angle);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(b.r + 4, 0);
    ctx.lineTo(b.r - 8, -8);
    ctx.lineTo(b.r - 8, 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** mm:ss, for the cards at the end of a run. */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
