// The bank, seen from over your shoulder rather than from a helicopter.
//
// The projection is **oblique**: the floor stays a grid of plain squares, and
// anything with height is drawn *up the screen* from the tile it stands on. A
// wall shows its top and the face turned towards you; a person is a figure
// standing on their tile. It costs one rule everywhere — draw in rows, top of
// the screen first — and buys a building you can read the shape of.
//
// The darkness is one shape: the polygon `vision.js` builds from the player's
// cone is the clip path, and it is the same maths that answers "can that guard
// see you". There is no second system deciding what is visible, which is the
// only way a fog can be fair.

import {
  COLOURS, KIT, TILE, WALL_H, BODY_H, PLAYER, CAMERA, VAULT, clamp,
} from './config.js';
import { WALL, VAULT_FLOOR, HALL, lineOfSight } from './grid.js';
import { visibilityFan } from './vision.js';
import { WEAPONS } from './weapons.js';
import { STICK, useButton, rollButton } from './controls.js';
import { t, i18n } from './i18n.js';

export function createRenderer() {
  const r = {
    camX: 0,
    camY: 0,
    reset() {
      r.camX = 0;
      r.camY = 0;
    },
  };

  r.draw = (ctx, game, vp, opts = {}) => {
    const { W, H } = vp;
    const p = game.player;

    // the camera leads towards where he is looking: on a corridor that is the
    // difference between seeing the corner and arriving at it
    const wantX = p.x + Math.cos(p.facing) * 90 - W / 2;
    const wantY = p.y + Math.sin(p.facing) * 90 - H / 2;
    r.camX += (wantX - r.camX) * Math.min(1, (opts.dt || 1 / 60) * 7);
    r.camY += (wantY - r.camY) * Math.min(1, (opts.dt || 1 / 60) * 7);
    r.camX = clamp(r.camX, -40, Math.max(-40, game.level.width - W + 40));
    r.camY = clamp(r.camY, -40, Math.max(-40, game.level.height - H + 40));

    const shake = opts.fx ? opts.fx.state.shake : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;

    ctx.fillStyle = COLOURS.void;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-Math.round(r.camX) + sx, -Math.round(r.camY) + sy);

    const view = bounds(game.level, r.camX, r.camY, W, H);
    paintRemembered(ctx, game, view);

    ctx.save();
    clipToSight(ctx, game.sight);
    paintFloor(ctx, game, view);
    paintProps(ctx, game, view);
    ctx.restore();

    // Walls and everybody standing between them, in one pass down the screen.
    // A wall is where a ray *stops*, so it falls outside the clip and would
    // never be drawn — it is asked one at a time instead whether the face you
    // would be looking at is visible (see `wallLit`).
    paintStanding(ctx, game, view, opts);

    // The cones are clipped to your own sight too: you see the light where it
    // falls in front of you, not the cone of a man two rooms away.
    ctx.save();
    clipToSight(ctx, game.sight);
    paintCones(ctx, game);
    ctx.restore();

    paintMuzzles(ctx, game);
    paintBullets(ctx, game);
    paintFx(ctx, opts.fx);

    ctx.restore();
    paintHud(ctx, game, vp, opts);
  };

  return r;
}

// ---------------------------------------------------------------- the floor

function bounds(level, camX, camY, W, H) {
  return {
    x0: Math.max(0, Math.floor(camX / TILE) - 1),
    y0: Math.max(0, Math.floor((camY - WALL_H - BODY_H) / TILE) - 1),
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

const floorTone = (kind, cx, cy) => {
  if (kind === VAULT_FLOOR) return (cx + cy) % 2 ? COLOURS.vault : '#5d4e24';
  if (kind === HALL) return (cx + cy) % 2 ? COLOURS.floorAlt : COLOURS.floor;
  return (cx + cy) % 2 ? COLOURS.floor : COLOURS.floorAlt;
};

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

function paintFloor(ctx, game, view) {
  const grid = game.grid;
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      const kind = grid.at(cx, cy);
      if (kind === WALL) continue;
      const x = cx * TILE;
      const y = cy * TILE;
      ctx.fillStyle = floorTone(kind, cx, cy);
      ctx.fillRect(x, y, TILE, TILE);
      // the grout line: what makes a floor read as tiles rather than as paint
      ctx.fillStyle = COLOURS.grout;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillRect(x, y, 1, TILE);
    }
  }
  const e = game.level.entrance;
  ctx.fillStyle = COLOURS.carpet;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(e.x * TILE + 8, e.y * TILE + 8, e.w * TILE - 16, e.h * TILE - 16);
  ctx.globalAlpha = 1;
}

function paintProps(ctx, game, view) {
  for (const pr of game.level.props) {
    if (pr.x < view.x0 * TILE - 80 || pr.x > (view.x1 + 1) * TILE + 80) continue;
    if (pr.y < view.y0 * TILE - 80 || pr.y > (view.y1 + 1) * TILE + 80) continue;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.a);
    if (pr.kind === 'rug') {
      ctx.fillStyle = `rgba(90,45,55,${0.3 + pr.tone * 0.25})`;
      ctx.fillRect(-pr.w / 2, -pr.h / 2, pr.w, pr.h);
      ctx.strokeStyle = 'rgba(200,150,110,0.18)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-pr.w / 2 + 5, -pr.h / 2 + 5, pr.w - 10, pr.h - 10);
    } else if (pr.kind === 'plate') {
      ctx.strokeStyle = `rgba(240,198,90,${0.2 + pr.tone * 0.2})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(-pr.w / 2, -pr.h / 2, pr.w, pr.h);
    } else {
      ctx.fillStyle = 'rgba(20,24,33,0.5)';
      ctx.fillRect(-pr.w / 2, -pr.h / 2, pr.w, pr.h);
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
function paintStanding(ctx, game, view, opts) {
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
      drawWallBlock(ctx, grid, cx, cy);
    }
    const limit = (cy + 1) * TILE;
    while (i < standing.length && standing[i].y < limit) standing[i++].draw();
  }
  while (i < standing.length) standing[i++].draw();
}

/**
 * One wall tile as a block: the top, and the face turned towards you.
 *
 * The courses and the seams are not decoration. A run of eight tiles drawn as
 * one flat colour is a painted bar — you cannot tell how long it is, and a
 * corridor made of two of them has no scale at all. Two courses of masonry and
 * a seam per tile give the eye something to count.
 */
function drawWallBlock(ctx, grid, cx, cy) {
  const x = cx * TILE;
  const y = cy * TILE;
  const faceTop = y + TILE - WALL_H;

  if (!grid.solid(cx, cy + 1)) {
    ctx.fillStyle = COLOURS.wallFace;
    ctx.fillRect(x, faceTop, TILE, WALL_H);
    // two courses, offset on alternate tiles so the joints do not line up
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, faceTop + WALL_H / 2 - 1, TILE, 1);
    const off = cx % 2 ? TILE / 2 : 0;
    ctx.fillRect(x + off, faceTop, 1, WALL_H / 2);
    ctx.fillRect(x + (off + TILE / 2) % TILE, faceTop + WALL_H / 2, 1, WALL_H / 2);
    // the skirting where the wall meets the floor
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y + TILE - 3, TILE, 3);
  }

  ctx.fillStyle = COLOURS.wallTop;
  ctx.fillRect(x, y - WALL_H, TILE, TILE);
  // a light catching the near edge of the top, so it does not read as a hole
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(x, y + TILE - WALL_H - 8, TILE, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x, y - WALL_H, TILE, 5);

  ctx.fillStyle = COLOURS.wallEdge;
  ctx.fillRect(x, faceTop - 2, TILE, 2);                       // the lip, top meets face
  if (!grid.solid(cx, cy - 1)) ctx.fillRect(x, y - WALL_H, TILE, 2);
  if (!grid.solid(cx + 1, cy)) ctx.fillRect(x + TILE - 2, y - WALL_H, 2, TILE);
  if (!grid.solid(cx - 1, cy)) ctx.fillRect(x, y - WALL_H, 2, TILE);
  // the seam between two tiles of the same run, faint enough not to be a crack
  if (grid.solid(cx + 1, cy)) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x + TILE - 1, y - WALL_H, 1, TILE);
  }
}

// --------------------------------------------------------------- the people

/** The shadow every standing thing drops on its own tile. */
function shadow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A figure standing on its tile: feet at (x, y), head at (x, y - BODY_H).
 *
 * The body itself never rotates — a doll seen from the front spun on the spot
 * reads as a spinning doll, not as a man turning. What turns is the arm and the
 * gun in it, and the y of that arm is squashed towards the horizontal, which is
 * what sells an oblique view: pointing "north" is pointing away, and away is
 * short.
 */
function drawDoll(ctx, x, y, facing, kit, o = {}) {
  const lean = o.lean || 0;
  const h = (o.height || BODY_H) * (o.squash || 1);
  const top = y - h;
  const back = Math.sin(facing) < -0.35;          // turned away from you
  const side = Math.abs(Math.cos(facing)) > 0.5;
  const dirX = Math.cos(facing) >= 0 ? 1 : -1;

  shadow(ctx, x, y, 13);

  ctx.save();
  ctx.translate(x, y);
  if (lean) ctx.rotate(lean);

  // legs
  ctx.fillStyle = kit.legs;
  const stride = o.stride || 0;
  ctx.fillRect(-8, -h * 0.42, 6, h * 0.42 + Math.min(0, stride));
  ctx.fillRect(2, -h * 0.42, 6, h * 0.42 - Math.min(0, stride));

  // coat
  ctx.fillStyle = kit.coat;
  ctx.fillRect(-11, -h * 0.86, 22, h * 0.46);
  ctx.fillStyle = kit.coatDark;
  ctx.fillRect(-11, -h * 0.86, 22, 5);
  if (side) {
    // a sliver of shading on the side he is turned away from
    ctx.fillRect(dirX > 0 ? -11 : 5, -h * 0.86, 6, h * 0.46);
  }

  // the arm that holds the gun, swung to the facing and flattened in y
  const ax = Math.cos(facing) * 13;
  const ay = Math.sin(facing) * 6;
  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.7);
  ctx.lineTo(ax, -h * 0.7 + ay);
  ctx.stroke();

  // head
  ctx.fillStyle = kit.skin;
  ctx.beginPath();
  ctx.arc(0, -h - 1, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = kit.head;
  ctx.beginPath();
  ctx.arc(0, -h - 3, 9, Math.PI, 0);
  ctx.fill();
  if (back) {
    // the back of his head: no face, all hair
    ctx.beginPath();
    ctx.arc(0, -h - 1, 9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = COLOURS.ink;
    ctx.fillRect(side ? dirX * 2 - 1 : -4, -h - 2, 2, 2);
    if (!side) ctx.fillRect(2, -h - 2, 2, 2);
  }
  ctx.restore();

  return { hand: { x: x + ax, y: top + (h - h * 0.7) - h + ay + h } };
}

/** The gun in his hands, in silhouette, pointing where he is pointing. */
function drawHeldGun(ctx, x, y, facing, id, scale = 1) {
  ctx.save();
  ctx.translate(x + Math.cos(facing) * 15, y + Math.sin(facing) * 7);
  ctx.rotate(Math.atan2(Math.sin(facing) * 0.55, Math.cos(facing)));
  ctx.scale(scale, scale);
  drawGunShape(ctx, id);
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
  const dark = '#3c4456';
  ctx.fillStyle = steel;
  switch (id) {
    case 'silenced':
      ctx.fillRect(-2, -2, 14, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(12, -3, 12, 6);          // the can on the end
      ctx.fillRect(-2, 1, 4, 7);
      break;
    case 'pistol':
      ctx.fillRect(-2, -2, 17, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(-2, 1, 5, 8);
      break;
    case 'revolver':
      ctx.fillRect(-2, -2, 18, 4);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(4, 0, 4.5, 0, Math.PI * 2);   // the cylinder
      ctx.fill();
      ctx.fillRect(-3, 1, 5, 8);
      break;
    case 'smg':
      ctx.fillRect(-4, -3, 22, 5);
      ctx.fillStyle = dark;
      ctx.fillRect(2, 2, 5, 11);            // the long magazine
      ctx.fillRect(-8, -2, 5, 4);
      break;
    case 'shotgun':
      ctx.fillRect(-8, -3, 34, 5);
      ctx.fillStyle = dark;
      ctx.fillRect(8, 2, 12, 4);            // the pump
      ctx.fillRect(-10, -3, 6, 7);
      break;
    case 'rifle':
      ctx.fillRect(-9, -2.5, 38, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(0, 1, 5, 10);
      ctx.fillRect(-12, -3, 6, 6);
      break;
    case 'sniper':
      ctx.fillRect(-11, -2, 46, 3.5);
      ctx.fillStyle = dark;
      ctx.fillRect(2, -8, 14, 4);           // the scope, up on its rail
      ctx.fillRect(4, -5, 2, 3);
      ctx.fillRect(-14, -3, 7, 6);
      break;
    case 'lmg':
      ctx.fillRect(-8, -3.5, 36, 6);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(4, 6, 7, 0, Math.PI * 2);     // the drum
      ctx.fill();
      ctx.fillRect(-12, -4, 6, 8);
      break;
    case 'dart':
      ctx.fillRect(-2, -1.5, 20, 3);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(6, -4, 3.5, 0, Math.PI * 2);  // the gas bottle
      ctx.fill();
      ctx.fillRect(-3, 0, 4, 7);
      break;
    default:
      ctx.fillRect(-2, -2, 16, 4);
  }
}

function drawPlayer(ctx, game, opts = {}) {
  const p = game.player;
  if (p.dragging) {
    ctx.strokeStyle = 'rgba(126,215,196,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 12);
    ctx.lineTo(p.dragging.x, p.dragging.y - 4);
    ctx.stroke();
  }

  const kit = p.hurt > 0 ? { ...KIT.player, coat: '#e88f86', coatDark: '#b05a52' } : KIT.player;
  if (p.roll > 0) {
    // Curled up and spinning. The lean is what reads as a roll from up here —
    // a figure that keeps standing while it slides reads as ice.
    const k = 1 - p.roll / 0.3;
    drawDoll(ctx, p.x, p.y, p.facing, kit, {
      squash: 0.62,
      lean: Math.sin(k * Math.PI) * (Math.cos(p.rollA) >= 0 ? 0.9 : -0.9),
    });
    return;
  }

  drawDoll(ctx, p.x, p.y, p.facing, kit, { stride: Math.sin(p.step * 0.09) * 4 });
  drawHeldGun(ctx, p.x, p.y - BODY_H * 0.7, p.facing, p.weapon.id);
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(126,215,196,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 17, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (game.focus) ring(ctx, p.x, p.y - BODY_H - 22, 13, game.focus.t / game.focus.need, COLOURS.gold);
  void opts;
}

function drawGuard(ctx, g) {
  const kit = g.state === 'patrol' ? KIT.guardCalm : KIT.guard;
  drawDoll(ctx, g.x, g.y, g.facing, kit, { stride: Math.sin((g.x + g.y) * 0.05) * 3 });
  drawHeldGun(ctx, g.x, g.y - BODY_H * 0.7, g.facing, g.gun);

  if (g.state !== 'patrol') {
    ctx.fillStyle = g.state === 'call' ? COLOURS.alarm : '#ffd88a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.state === 'call' ? '!' : '?', g.x, g.y - BODY_H - 16);
  }
  if (g.hp < g.maxHp) {
    const w = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(g.x - w / 2, g.y - BODY_H - 12, w, 4);
    ctx.fillStyle = COLOURS.alarm;
    ctx.fillRect(g.x - w / 2, g.y - BODY_H - 12, w * Math.max(0, g.hp / g.maxHp), 4);
  }
}

/** A man on the floor is a man lying down: same doll, on its side. */
function drawBody(ctx, b) {
  ctx.fillStyle = 'rgba(142,47,63,0.38)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 2, 24, 12, b.a, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.a);
  ctx.translate(0, -6);
  ctx.rotate(-Math.PI / 2);
  drawDoll(ctx, 0, 0, Math.PI / 2, KIT.body, { squash: 0.78 });
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

  const range = plan.guardSight * (game.alarm.on ? 1.2 : 1);
  for (const g of game.guards) {
    if (g.dead || !reaches(g.x, g.y, range)) continue;
    const hot = g.state === 'call' || g.state === 'hunt';
    cone(ctx, grid, g.x, g.y, g.facing, plan.guardFov, range,
      hot ? 'rgba(255,90,77,0.20)' : g.alert > 0.2 ? 'rgba(255,200,110,0.17)' : 'rgba(255,225,170,0.11)');
  }
  for (const c of game.cameras) {
    if (c.dead || !reaches(c.x, c.y, c.range)) continue;
    cone(ctx, grid, c.x, c.y, c.facing, CAMERA.fov, c.range,
      c.lock > 0 ? 'rgba(255,90,77,0.2)' : 'rgba(143,169,214,0.14)');
  }
}

function cone(ctx, grid, x, y, facing, fov, range, fill) {
  const fan = visibilityFan(grid, x, y, facing, fov, range, 30);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (const q of fan) ctx.lineTo(q.x, q.y);
  ctx.closePath();
  ctx.fill();
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
    const fx = g.x + Math.cos(a) * 22;
    const fy = g.y - BODY_H * 0.7 + Math.sin(a) * 10;
    const grd = ctx.createRadialGradient(fx, fy, 0, fx, fy, 58);
    grd.addColorStop(0, 'rgba(255,214,140,0.85)');
    grd.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(fx, fy, 58, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBullets(ctx, game) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (const b of game.bullets) {
    ctx.strokeStyle = b.side === 'player' ? 'rgba(180,240,225,0.9)' : 'rgba(255,150,110,0.95)';
    ctx.beginPath();
    // drawn at chest height, which is where it left the barrel
    ctx.moveTo(b.x, b.y - 22);
    // the tail is the last twenty milliseconds of flight — a dot at 1700 px/s
    // reads as nothing at all
    ctx.lineTo(b.x - b.vx * 0.02, b.y - 22 - b.vy * 0.02);
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

function paintHud(ctx, game, vp, opts) {
  const { W, H } = vp;
  const p = game.player;
  const stats = game.stats;

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
    // The outer stop has to reach the *corner*, not the bottom edge: stopping
    // at 0.72·H leaves every pixel past it painted at the final alpha, and a
    // 1280×720 corner is a long way past it. The first version of this washed
    // the whole screen red and buried the floor under it.
    const corner = Math.hypot(W, H) / 2;
    const grd = ctx.createRadialGradient(W / 2, H / 2, corner * 0.42, W / 2, H / 2, corner);
    grd.addColorStop(0, 'rgba(255,60,50,0)');
    grd.addColorStop(1, `rgba(255,50,40,${0.05 + k * 0.24})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

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

/** The two sticks where the thumbs left them, and the two round buttons. */
function paintTouch(ctx, touch, vp, game) {
  const ring2 = (x, y, r, alpha) => {
    ctx.strokeStyle = `rgba(232,238,248,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (const s of [touch.stick, touch.trigger]) {
    if (!s.on) continue;
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
  button(rollButton(vp.W, vp.H), '🌀', game.player.rollCool <= 0);
  if (game.prompt) button(useButton(vp.W, vp.H), '✋', true);
}

/** mm:ss, for the cards at the end of a run. */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
