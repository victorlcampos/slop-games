// The whole field, all the time.
//
// There is no camera in this game and that is the drawing's first constraint:
// the arena is 1216 by 672 logical pixels and it is painted at once, so a
// soldier is ten pixels across and has to be readable at that size against
// four other bodies and a wall. Everything below serves that — the two squads
// are opposite ends of the palette, a flag is the only thing on the field with
// a banner, and the man you are driving is the only one standing in a ring of
// light.
//
// The static half of the field (tiles, walls, pits, stands) is baked once per
// arena into an offscreen canvas and blitted. What used to be some eight
// hundred little fills a frame is one drawImage.

import {
  COLOURS, KIT, TILE, COLS, ROWS, ARENA_W, ARENA_H, HUD_H, TARGET, SIGHT, UNIT, TURRET, PAD,
  boardTransform, viewWidth, clamp, other,
} from './config.js';
import { WALL, PIT, BASE_H, BASE_A, castRay } from './grid.js';
import { t, arenaName } from './i18n.js';
import { STICK, fireButton, dashButton } from './controls.js';

const LIP = 7;                          // how far a wall's top sits above its face

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function createRenderer() {
  const r = {
    arena: null,
    floorImg: null,
    scale: 1,
    reset() {
      r.arena = null;
      r.floorImg = null;
    },
  };

  r.draw = (ctx, game, vp, opts = {}) => {
    const H = vp.H;
    const W = viewWidth(vp);            // what the window can really show, not vp.W
    const fx = opts.fx || null;
    const board = boardTransform(W, H);

    ctx.fillStyle = COLOURS.void;
    ctx.fillRect(0, 0, W, H);

    if (r.arena !== game.arena) {
      r.arena = game.arena;
      r.scale = (vp.scale || 1) * (vp.dpr || 1) > 1.25 ? 2 : 1;
      r.floorImg = bakeField(game, r.scale);
    }

    const shake = fx ? fx.state.shake : 0;
    ctx.save();
    ctx.translate(
      board.ox + (shake ? (Math.random() - 0.5) * shake : 0),
      board.oy + (shake ? (Math.random() - 0.5) * shake : 0)
    );
    ctx.scale(board.scale, board.scale);

    const dark = game.arena.dark;
    // In the dark arena the field is drawn twice: once flat and cold, which is
    // what your squad remembers, and once inside the shape it can actually see.
    ctx.drawImage(r.floorImg, 0, 0, ARENA_W, ARENA_H);
    if (dark) {
      ctx.fillStyle = 'rgba(5,7,11,0.74)';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    }

    ctx.save();
    if (dark) clipToSquadSight(ctx, game);
    if (dark) ctx.drawImage(r.floorImg, 0, 0, ARENA_W, ARENA_H);
    paintStands(ctx, game);
    paintPads(ctx, game);
    paintTurrets(ctx, game, dark);
    paintFlags(ctx, game);
    paintUnits(ctx, game, dark);
    paintBullets(ctx, game, dark);
    ctx.restore();

    // Outside the light, two things are still drawn: your own squad, which you
    // are in radio contact with, and whoever is running off with your flag —
    // a carrier nobody can find is a match that stops being playable.
    if (dark) {
      paintStands(ctx, game);
      for (const u of game.units) {
        if (u.dead) continue;
        const carrying = game.flags[other(u.team)].carrier === u.id;
        if (u.team === game.playerTeam) drawUnit(ctx, game, u, carrying);
        else if (carrying) drawGhostCarrier(ctx, game, u);
      }
    }

    if (fx) paintFx(ctx, fx);
    ctx.restore();

    paintHud(ctx, game, vp, board, W);
    if (opts.touch) paintTouch(ctx, opts.touch, W, H);
  };

  return r;
}

// ------------------------------------------------------------------- baking

function bakeField(game, scale) {
  const img = makeCanvas(ARENA_W * scale, ARENA_H * scale);
  const g = img.getContext('2d');
  g.scale(scale, scale);
  paintGround(g, game);
  paintWalls(g, game);
  return img;
}

function paintGround(ctx, game) {
  const grid = game.grid;
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const kind = grid.at(cx, cy);
      if (kind === WALL) continue;
      const x = cx * TILE;
      const y = cy * TILE;

      if (kind === PIT) {
        ctx.fillStyle = COLOURS.pit;
        ctx.fillRect(x, y, TILE, TILE);
        // the lip of the hole, only where there is floor above it: what makes
        // a pit read as depth instead of as a black tile
        if (grid.at(cx, cy - 1) !== PIT) {
          ctx.fillStyle = COLOURS.pitEdge;
          ctx.fillRect(x, y, TILE, 5);
        }
        const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
        if (h % 7 === 0) {
          ctx.fillStyle = 'rgba(92,232,207,0.07)';
          ctx.fillRect(x + (h % 20), y + ((h >> 4) % 24), 3, 3);
        }
        continue;
      }

      ctx.fillStyle = (cx + cy) % 2 ? COLOURS.floor : COLOURS.floorAlt;
      ctx.fillRect(x, y, TILE, TILE);

      if (kind === BASE_H || kind === BASE_A) {
        const kit = KIT[kind === BASE_H ? 'human' : 'alien'];
        ctx.fillStyle = kit.base;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      }

      // wear, seeded by the cell, so the same arena is scuffed the same way
      const h = ((cx * 374761393) ^ (cy * 668265263)) >>> 0;
      if (h % 5 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(x + (h % 18), y + ((h >> 5) % 22), 9, 2);
      }

      ctx.fillStyle = COLOURS.grout;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillRect(x, y, 1, TILE);
    }
  }
}

function paintWalls(ctx, game) {
  const grid = game.grid;
  // rows down the screen, so a lip covers the block behind it
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      if (grid.at(cx, cy) !== WALL) continue;
      const x = cx * TILE;
      const y = cy * TILE;
      if (grid.at(cx, cy + 1) !== WALL) {
        ctx.fillStyle = COLOURS.wallFace;
        ctx.fillRect(x, y + TILE - LIP, TILE, LIP + 2);
      }
      ctx.fillStyle = COLOURS.wallTop;
      ctx.fillRect(x, y - LIP, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y - LIP, TILE, 2);
      ctx.strokeStyle = COLOURS.wallEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y - LIP + 0.5, TILE - 1, TILE - 1);
    }
  }
}

// -------------------------------------------------------------------- sight

/**
 * The shape the player's squad can see, as one clip path: a fan per living
 * body, each one stopped by walls. Teammates share their eyes — a match where
 * only your own torch counted would be four people you never see again.
 */
function clipToSquadSight(ctx, game) {
  ctx.beginPath();
  for (const u of game.units) {
    if (u.dead || u.team !== game.playerTeam) continue;
    fanPath(ctx, game, u.x, u.y, SIGHT);
  }
  for (const t2 of game.turrets) {
    if (t2.dead || t2.team !== game.playerTeam) continue;
    fanPath(ctx, game, t2.x, t2.y, SIGHT * 0.8);
  }
  ctx.clip();
}

// Seventy-two rays, not forty. A fan drawn with too few of them does not read
// as a soft edge: every pair of rays that lands on different walls becomes a
// long thin triangle, and the light around a body in the maze looked like a
// starfish. This is the one place in the game that is worth a few hundred
// raycasts a frame.
function fanPath(ctx, game, x, y, range, rays = 72) {
  for (let i = 0; i <= rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const d = castRay(game.grid, x, y, dx, dy, range);
    const px = x + dx * d;
    const py = y + dy * d;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ------------------------------------------------------------- the fittings

function paintStands(ctx, game) {
  const pulse = 0.5 + 0.5 * Math.sin(game.time * 2.2);
  for (const team of ['human', 'alien']) {
    const stand = game.flags[team].home;
    const kit = KIT[team];
    ctx.save();
    ctx.translate(stand.x, stand.y);
    ctx.strokeStyle = kit.tint;
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.12 + pulse * 0.08;
    ctx.fillStyle = kit.tint;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOURS.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintPads(ctx, game) {
  for (const p of game.pads) {
    const k = 0.5 + 0.5 * Math.sin(game.time * 3 + p.x * 0.01);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = COLOURS.energy;
    ctx.globalAlpha = 0.35 + k * 0.35;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, PAD.r - i * 7 + k * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = COLOURS.energy;
    ctx.beginPath();
    ctx.arc(0, 0, PAD.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintTurrets(ctx, game, dark) {
  for (const t2 of game.turrets) {
    const kit = KIT[t2.team];
    ctx.save();
    ctx.translate(t2.x, t2.y);

    if (t2.dead) {
      // the mount, empty, with the rebuild filling it back up
      ctx.strokeStyle = 'rgba(150,165,185,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, TURRET.r, 0, Math.PI * 2);
      ctx.stroke();
      const k = 1 - t2.rebuild / TURRET.rebuild;
      ctx.strokeStyle = kit.tint;
      ctx.beginPath();
      ctx.arc(0, 0, TURRET.r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1, 3, TURRET.r, TURRET.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOURS.steel;
    ctx.beginPath();
    ctx.arc(0, 0, TURRET.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.dark;
    ctx.beginPath();
    ctx.arc(0, 0, TURRET.r - 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(t2.facing);
    ctx.fillStyle = COLOURS.ink;
    ctx.fillRect(2, -3, 18, 6);
    ctx.fillStyle = kit.tint;
    ctx.fillRect(16, -2, 4, 4);
    ctx.restore();

    // what is left of it, over the barrel
    const k = clamp(t2.hp / TURRET.hp, 0, 1);
    if (k < 1) bar(ctx, t2.x - 12, t2.y - TURRET.r - 8, 24, 3, k, kit.tint);
  }
}

function paintFlags(ctx, game) {
  for (const team of ['human', 'alien']) {
    const flag = game.flags[team];
    if (flag.state === 'carried') continue;      // it is drawn on the back that carries it
    const kit = KIT[team];
    const lift = flag.state === 'home' ? 0 : 2 + Math.sin(game.time * 5) * 1.5;
    drawBanner(ctx, flag.x, flag.y - lift, kit, game.time, flag.state === 'dropped');
  }
}

/**
 * The banner: a pole, a triangle and a shadow. It is the only triangle on the
 * field, which is what lets you find one in a crowd of round shoulders.
 */
function drawBanner(ctx, x, y, kit, time, urgent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(1, 6, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (urgent) {
    // a flag on the deck is on a clock, and the clock has to be visible from
    // across the field
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 8);
    ctx.fillStyle = kit.tint;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = COLOURS.steel;
  ctx.fillRect(-1.5, -18, 3, 24);
  const wave = Math.sin(time * 4) * 2;
  ctx.fillStyle = kit.tint;
  ctx.beginPath();
  ctx.moveTo(1.5, -17);
  ctx.lineTo(14 + wave, -12);
  ctx.lineTo(1.5, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.moveTo(1.5, -11);
  ctx.lineTo(8 + wave * 0.5, -9);
  ctx.lineTo(1.5, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// -------------------------------------------------------------- the soldiers

function paintUnits(ctx, game, dark) {
  const order = game.units.filter((u) => !u.dead).sort((a, b) => a.y - b.y);
  for (const u of order) {
    if (dark && u.team !== game.playerTeam && !game.teamSees(game.playerTeam, u.x, u.y)) continue;
    drawUnit(ctx, game, u, game.flags[other(u.team)].carrier === u.id);
  }
}

function drawUnit(ctx, game, u, carrying) {
  const kit = KIT[u.team];
  const mine = u.team === game.playerTeam;
  const you = u === game.player;

  // the ring under your own body: with ten identical soldiers on screen, this
  // is the only thing that answers "which one am I"
  if (you) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (mine) {
    ctx.save();
    ctx.strokeStyle = kit.tint;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(u.x + 1, u.y + 3, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.rotate(u.facing);

  const stride = Math.sin(u.stride * 6) * 2;
  ctx.fillStyle = kit.legs;
  ctx.fillRect(-9, -7 + stride, 6, 5);
  ctx.fillRect(-9, 2 - stride, 6, 5);

  ctx.fillStyle = u.hurt > 0 ? '#ff9d9d' : kit.coat;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = u.hurt > 0 ? '#e07070' : kit.coatDark;
  ctx.beginPath();
  ctx.ellipse(-3.5, 0, 5.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // the collar in the team's colour, at the front: from above it is the first
  // thing you see of somebody coming round a corner
  ctx.fillStyle = kit.tint;
  ctx.fillRect(3, -2.4, 4, 4.8);

  // arms and gun
  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(2, side * 7);
    ctx.lineTo(10, side * 3.5);
    ctx.stroke();
  }
  ctx.fillStyle = COLOURS.ink;
  if (u.team === 'human') {
    ctx.fillRect(9, -1.6, 13, 3.2);
    ctx.fillStyle = kit.trim;
    ctx.fillRect(19, -1, 3, 2);
  } else {
    ctx.beginPath();
    ctx.moveTo(9, -3);
    ctx.lineTo(20, -1.2);
    ctx.lineTo(20, 1.2);
    ctx.lineTo(9, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = kit.trim;
    ctx.beginPath();
    ctx.arc(17, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // the head, in screen space and a few pixels up: the whole third dimension
  const hx = u.x + Math.cos(u.facing) * 2;
  const hy = u.y + Math.sin(u.facing) * 2 - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(u.x + Math.cos(u.facing) * 2, u.y + Math.sin(u.facing) * 2 + 1, 5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(u.facing);
  if (kit.hat === 'helmet') {
    ctx.fillStyle = kit.skin;
    ctx.beginPath();
    ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.head;
    ctx.beginPath();
    ctx.arc(0, 0, 4.8, Math.PI * 0.4, Math.PI * 1.6);
    ctx.fill();
    ctx.fillStyle = kit.trim;
    ctx.fillRect(-1, -4.8, 2, 9.6);
  } else {
    // a sentinel's head: one smooth cranium, longer than it is wide, and the
    // two black eyes that do all the seeing on that side
    ctx.fillStyle = kit.head;
    ctx.beginPath();
    ctx.ellipse(-0.6, 0, 5.4, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.ink;
    ctx.beginPath();
    ctx.ellipse(2.8, -2, 1.6, 1, 0.5, 0, Math.PI * 2);
    ctx.ellipse(2.8, 2, 1.6, 1, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (carrying) {
    const enemyKit = KIT[other(u.team)];
    drawBanner(ctx, u.x - 6, u.y - 8, enemyKit, game.time, false);
  }

  // health, only once it means something: a bar over everybody all the time is
  // ten bars, and ten bars is a HUD sitting on top of the game
  const k = clamp(u.hp / UNIT.hp, 0, 1);
  if (k < 1) bar(ctx, u.x - 11, u.y - 20, 22, 3, k, mine ? kit.tint : '#ff6a5a');
}

/** Whoever has your flag, seen through the wall: the one cheat the dark allows. */
function drawGhostCarrier(ctx, game, u) {
  const kit = KIT[u.team];
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(game.time * 6);
  ctx.strokeStyle = KIT[other(u.team)].tint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(u.x, u.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = kit.coatDark;
  ctx.beginPath();
  ctx.arc(u.x, u.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawBanner(ctx, u.x - 6, u.y - 8, KIT[other(u.team)], game.time, false);
}

function bar(ctx, x, y, w, h, k, colour) {
  ctx.fillStyle = 'rgba(6,8,12,0.72)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w * k, h);
}

function paintBullets(ctx, game, dark) {
  for (const b of game.bullets) {
    if (dark && !game.teamSees(game.playerTeam, b.x, b.y)) continue;
    const len = b.kind === 'blaster' ? 10 : 14;
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    if (b.kind === 'blaster') {
      ctx.fillStyle = '#8ff0dc';
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'turret') {
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(-6, -1, 12, 2);
    } else {
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(-len / 2, -1.2, len, 2.4);
    }
    ctx.restore();
  }
}

function paintFx(ctx, fx) {
  for (const b of fx.bits) {
    ctx.globalAlpha = clamp(b.t / b.life, 0, 1);
    ctx.fillStyle = b.colour;
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }
  for (const r of fx.rings) {
    ctx.globalAlpha = clamp(r.t / r.life, 0, 1) * 0.7;
    ctx.strokeStyle = r.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const f of fx.floats) {
    ctx.globalAlpha = clamp(f.t / f.life, 0, 1);
    ctx.fillStyle = f.colour;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ----------------------------------------------------------------- the HUD

function paintHud(ctx, game, vp, board, W) {
  const mid = W / 2;

  ctx.fillStyle = 'rgba(8,11,16,0.9)';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, HUD_H - 1, W, 1);

  // Your side is always on the left of the scoreboard, whichever colour you
  // picked. The alternative — humans always left — makes the player read the
  // colours before the numbers, every time.
  const mineTeam = game.playerTeam;
  const theirsTeam = other(mineTeam);
  scoreBlock(ctx, mid - 150, mineTeam, game.score[mineTeam], game, 'right');
  scoreBlock(ctx, mid + 150, theirsTeam, game.score[theirsTeam], game, 'left');

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOURS.hud;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(`${game.score[mineTeam]} — ${game.score[theirsTeam]}`, mid, 22);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLOURS.dim;
  ctx.fillText(`${arenaName(game.arena.id)} · ${t('menu.arena')} ${game.arena.index + 1}/6 · ${TARGET}`, mid, 38);

  // the event ticker, newest at the bottom, over the board's own top-left
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px system-ui, sans-serif';
  // a kill has no line: with ten bodies on the field a feed of them is a wall
  // of text over the only thing worth watching
  const lines = game.events.filter((e) => e.kind !== 'killed').slice(-4);
  lines.forEach((e, i) => {
    ctx.globalAlpha = clamp(e.t / 1.2, 0, 1);
    ctx.fillStyle = eventColour(e, game);
    ctx.fillText(eventText(e), board.ox + 12, HUD_H + 22 + i * 18);
  });
  ctx.globalAlpha = 1;

  const player = game.player;
  if (!player) return;

  if (player.dead) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(6,8,12,0.6)';
    ctx.fillRect(0, HUD_H, W, vp.H - HUD_H);
    ctx.fillStyle = COLOURS.hud;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(t('hud.respawn', { n: Math.max(0, player.respawnT).toFixed(1) }), W / 2, vp.H / 2);
    ctx.textAlign = 'left';
    return;
  }

  const carrying = game.flags[other(player.team)].carrier === player.id;
  if (carrying) {
    const home = game.flags[player.team].state === 'home';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = home ? KIT[player.team].tint : '#ff6a5a';
    ctx.fillText(t('hud.carrying'), W / 2, vp.H - 26);
    if (!home) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#ff9d9d';
      ctx.fillText(t('hud.blocked'), W / 2, vp.H - 8);
    }
    ctx.textAlign = 'left';
  }

  // your own health, bottom left, where a glance costs nothing
  bar(ctx, board.ox + 12, vp.H - 20, 132, 8, clamp(player.hp / UNIT.hp, 0, 1),
    player.hp > 35 ? KIT[player.team].tint : '#ff6a5a');
}

function scoreBlock(ctx, x, team, score, game, align) {
  const kit = KIT[team];
  const flag = game.flags[team];
  const label = t(`side.${team}`);
  ctx.textAlign = align;
  ctx.fillStyle = kit.tint;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(label, x, 20);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = flag.state === 'home' ? COLOURS.dim : '#ff9d9d';
  ctx.fillText(
    flag.state === 'home' ? t('hud.flagHome') : flag.state === 'carried' ? t('hud.flagOut') : t('hud.flagDown'),
    x, 36
  );

  // the pips: ten of them, filled as the side scores, so the state of the match
  // is a shape and not a number to be read
  const dir = align === 'right' ? -1 : 1;
  for (let i = 0; i < TARGET; i++) {
    const px = x + dir * (14 + i * 11) - (align === 'right' ? 0 : 0);
    ctx.fillStyle = i < score ? kit.tint : 'rgba(255,255,255,0.13)';
    ctx.fillRect(px + (dir < 0 ? -8 : 0), 42, 8, 4);
  }
  ctx.textAlign = 'left';
}

function eventText(e) {
  return t(`log.${e.kind}`, { team: t(`side.${e.team}`) });
}

function eventColour(e, game) {
  if (e.kind === 'captured') return KIT[e.team].tint;
  return e.team === game.playerTeam ? '#ff9d9d' : COLOURS.hud;
}

// ---------------------------------------------------------------- the thumbs

function paintTouch(ctx, touch, W, H) {
  if (touch.stick.on) {
    const dx = touch.stick.x - touch.stick.ox;
    const dy = touch.stick.y - touch.stick.oy;
    const len = Math.min(STICK.max, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    ring(ctx, touch.stick.ox, touch.stick.oy, STICK.max, 0.16);
    ring(ctx, touch.stick.ox + Math.cos(a) * len, touch.stick.oy + Math.sin(a) * len, 26, 0.34);
  }
  const gun = fireButton(W, H);
  const dash = dashButton(W, H);
  ctx.save();
  ctx.globalAlpha = touch.trigger.on ? 0.5 : 0.24;
  ctx.strokeStyle = COLOURS.hud;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(gun.x, gun.y, gun.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gun.x - 16, gun.y);
  ctx.lineTo(gun.x + 16, gun.y);
  ctx.moveTo(gun.x, gun.y - 16);
  ctx.lineTo(gun.x, gun.y + 16);
  ctx.stroke();
  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  ctx.arc(dash.x, dash.y, dash.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOURS.hud;
  ctx.fillText('🌀', dash.x, dash.y + 8);
  ctx.textAlign = 'left';
  ctx.restore();
}

function ring(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLOURS.hud;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A point on the screen, in the field — the exact inverse of the transform. */
export function screenToWorld(sx, sy, vp) {
  const board = boardTransform(viewWidth(vp), vp.H);
  return { x: (sx - board.ox) / board.scale, y: (sy - board.oy) / board.scale };
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
