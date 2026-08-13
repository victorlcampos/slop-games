// The floor, seen from three-quarters up, through a torch.
//
// The whole of the darkness is one shape: the polygon `vision.js` builds from
// the player's cone is used as a clip path, and everything drawn inside it is
// lit. There is no second system deciding what is visible — what the renderer
// shows and what the guards' rules call "seen" are the same maths, which is the
// only way the fog can ever be fair.
//
// Walls are drawn row by row, top face lifted: a painter's algorithm down the
// screen, so a nearer wall covers the one behind it and the floor reads as
// having height.

import { COLOURS, TILE, LIFT, PLAYER, CAMERA, VAULT, clamp } from './config.js';
import { WALL, VAULT_FLOOR, HALL, lineOfSight } from './grid.js';
import { visibilityFan } from './vision.js';
import { WEAPONS } from './weapons.js';
import { STICK, useButton } from './controls.js';
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

    // the camera leads slightly towards where he is looking: on a corridor that
    // is the difference between seeing the corner and arriving at it
    const leadX = Math.cos(p.facing) * 90;
    const leadY = Math.sin(p.facing) * 90;
    const wantX = p.x + leadX - W / 2;
    const wantY = p.y + leadY - H / 2;
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

    // ---------------------------------------------------------- what is lit
    ctx.save();
    clipToSight(ctx, game.sight);
    paintFloor(ctx, game, view);
    paintProps(ctx, game, view);
    paintFittings(ctx, game);
    paintItems(ctx, game);
    paintBodies(ctx, game);
    ctx.restore();

    // A wall is where a ray *stops*, so it falls outside the polygon and is
    // never drawn — you get the corridor without the walls that make it. Only
    // the south faces showed, because their lifted tops reach back towards you.
    //
    // The fix that does not work is enlarging the polygon: a ray that skims a
    // corner and is pushed a tile further lands in open space, and the wedge
    // between it and its neighbour paints every wall it crosses, two rooms
    // away. So the walls are asked one at a time instead — is the face you
    // would be looking at visible — and drawn outside the clip.
    paintWalls(ctx, game, view);

    ctx.save();
    clipToSight(ctx, game.sight);
    paintGuards(ctx, game);
    ctx.restore();

    // The cones are clipped to your own sight as well: you see the light where
    // it falls in front of you, not the cone of a man two rooms away.
    ctx.save();
    clipToSight(ctx, game.sight);
    paintCones(ctx, game);
    ctx.restore();

    paintMuzzles(ctx, game);
    paintBullets(ctx, game);
    paintFx(ctx, opts.fx);
    paintPlayer(ctx, game);

    ctx.restore();

    paintHud(ctx, game, vp, opts);
  };

  return r;
}

// --------------------------------------------------------------- the shapes

function bounds(level, camX, camY, W, H) {
  return {
    x0: Math.max(0, Math.floor(camX / TILE) - 1),
    y0: Math.max(0, Math.floor((camY - LIFT) / TILE) - 1),
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
  // the little circle you can feel rather than see, occluded by walls like
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
      if (!seen[cy * grid.cols + cx]) continue;
      if (grid.at(cx, cy) === WALL) continue;
      ctx.fillRect(cx * TILE, cy * TILE, TILE, TILE);
    }
  }
  // remembered walls, flat and colder than the lit ones
  ctx.fillStyle = '#20242f';
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      if (!seen[cy * grid.cols + cx] || grid.at(cx, cy) !== WALL) continue;
      ctx.fillRect(cx * TILE, cy * TILE - LIFT, TILE, TILE + LIFT);
    }
  }
}

function paintFloor(ctx, game, view) {
  const grid = game.grid;
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      const kind = grid.at(cx, cy);
      if (kind === WALL) continue;
      ctx.fillStyle = floorTone(kind, cx, cy);
      ctx.fillRect(cx * TILE, cy * TILE, TILE, TILE);
    }
  }
  // the lobby's carpet, so the way in is recognisable on the way out
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
      ctx.fillStyle = 'rgba(24,28,38,0.55)';
      ctx.fillRect(-pr.w / 2, -pr.h / 2, pr.w, pr.h);
      ctx.fillStyle = 'rgba(120,132,158,0.22)';
      ctx.fillRect(-pr.w / 2, -pr.h / 2, pr.w, 5);
    }
    ctx.restore();
  }
}

/**
 * Is this wall tile one the player can see the face of?
 *
 * At most two casts: the face nearest on x and the one nearest on y. A wall
 * you are standing square to only needs the first.
 */
function wallLit(sight, cx, cy) {
  const x0 = cx * TILE;
  const y0 = cy * TILE;
  const mid = TILE / 2;
  // Just *outside* the face, never inside it. A point one pixel into the tile
  // is inside a wall, and nothing inside a wall is ever visible — the ray stops
  // on the way in. Tested against the inside, this returns false for every wall
  // on the floor and the bank is drawn as rooms with no walls at all.
  const px = sight.x < x0 ? x0 - 1 : sight.x > x0 + TILE ? x0 + TILE + 1 : null;
  const py = sight.y < y0 ? y0 - 1 : sight.y > y0 + TILE ? y0 + TILE + 1 : null;
  if (px !== null && sight.sees(px, y0 + mid)) return true;
  if (py !== null && sight.sees(x0 + mid, py)) return true;
  // he is standing in the tile's own row and column, which means against it
  return px === null && py === null;
}

function paintWalls(ctx, game, view) {
  const grid = game.grid;
  const sight = game.sight;
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      if (grid.at(cx, cy) !== WALL) continue;
      if (!sight || !wallLit(sight, cx, cy)) continue;
      const x = cx * TILE;
      const y = cy * TILE;
      // the front face, only where there is something below to look at it
      if (!grid.solid(cx, cy + 1)) {
        ctx.fillStyle = COLOURS.wall;
        ctx.fillRect(x, y + TILE - LIFT, TILE, LIFT);
      }
      ctx.fillStyle = COLOURS.wallTop;
      ctx.fillRect(x, y - LIFT, TILE, TILE);
      ctx.fillStyle = COLOURS.wallEdge;
      ctx.fillRect(x, y - LIFT, TILE, 3);
      if (!grid.solid(cx + 1, cy)) ctx.fillRect(x + TILE - 2, y - LIFT, 2, TILE);
      if (!grid.solid(cx - 1, cy)) ctx.fillRect(x, y - LIFT, 2, TILE);
    }
  }
}

function paintFittings(ctx, game) {
  const v = game.level.vault;
  ctx.save();
  ctx.translate(v.x, v.y);
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
  if (v.cracked > 0 && v.cracked < 1) {
    ctx.strokeStyle = COLOURS.good;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, VAULT.r + 8, -Math.PI / 2, -Math.PI / 2 + v.cracked * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  for (const a of game.alarms) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.fillStyle = a.dead ? '#3a3f4c' : COLOURS.alarm;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = a.dead ? '#20242f' : '#ffd9c8';
    ctx.fillRect(-4, -5, 8, 10);
    ctx.restore();
  }

  for (const c of game.cameras) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.facing);
    ctx.fillStyle = c.dead ? '#3a3f4c' : COLOURS.camera;
    ctx.fillRect(-7, -6, 16, 12);
    ctx.fillRect(7, -3, 7, 6);
    ctx.restore();
  }
}

function paintItems(ctx, game) {
  for (const it of game.items) {
    if (it.taken) continue;
    ctx.save();
    ctx.translate(it.x, it.y);
    if (it.kind === 'loot') {
      ctx.fillStyle = COLOURS.loot;
      ctx.beginPath();
      ctx.moveTo(-11, 8);
      ctx.lineTo(-7, -7);
      ctx.lineTo(7, -7);
      ctx.lineTo(11, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7a5f12';
      ctx.fillRect(-5, -10, 10, 4);
    } else if (it.kind === 'medkit') {
      ctx.fillStyle = '#e8eef8';
      ctx.fillRect(-10, -8, 20, 16);
      ctx.fillStyle = COLOURS.blood;
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = '#adb7cb';
      ctx.fillRect(-12, -3, 24, 6);
      ctx.fillRect(2, 0, 5, 8);
    }
    ctx.restore();
  }
}

function paintBodies(ctx, game) {
  for (const b of game.bodies) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(142,47,63,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 16, b.a, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(b.a);
    ctx.fillStyle = COLOURS.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4b3a44';
    ctx.beginPath();
    ctx.arc(9, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function personSprite(ctx, x, y, facing, body, dark, r = 15) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 4, r + 3, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(facing);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
  ctx.fill();
  // the gun, so which way he is looking is legible at a glance
  ctx.fillStyle = '#1a1e27';
  ctx.fillRect(r - 5, -3, 16, 6);
  ctx.restore();
}

function paintGuards(ctx, game) {
  for (const g of game.guards) {
    if (g.dead) continue;
    personSprite(ctx, g.x, g.y, g.facing, g.state === 'patrol' ? COLOURS.guardCalm : COLOURS.guard, COLOURS.guardDark);
    if (g.state !== 'patrol') {
      ctx.fillStyle = g.state === 'call' ? COLOURS.alarm : '#ffd88a';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.state === 'call' ? '!' : '?', g.x, g.y - 26);
    }
    if (g.hp < g.maxHp) {
      const w = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(g.x - w / 2, g.y - 24, w, 4);
      ctx.fillStyle = COLOURS.guard;
      ctx.fillRect(g.x - w / 2, g.y - 24, w * Math.max(0, g.hp / g.maxHp), 4);
    }
  }
}

function paintPlayer(ctx, game) {
  const p = game.player;
  if (p.dragging) {
    ctx.strokeStyle = 'rgba(126,215,196,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.dragging.x, p.dragging.y);
    ctx.stroke();
  }
  personSprite(ctx, p.x, p.y, p.facing, p.hurt > 0 ? '#ffb0a8' : COLOURS.player, COLOURS.playerDark, PLAYER.r);
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(126,215,196,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.r + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

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
    const grd = ctx.createRadialGradient(g.x + Math.cos(a) * 18, g.y + Math.sin(a) * 18, 0, g.x, g.y, 60);
    grd.addColorStop(0, 'rgba(255,214,140,0.85)');
    grd.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(a) * 18, g.y + Math.sin(a) * 18, 60, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBullets(ctx, game) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (const b of game.bullets) {
    ctx.strokeStyle = b.side === 'player' ? 'rgba(180,240,225,0.9)' : 'rgba(255,150,110,0.95)';
    ctx.beginPath();
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
  for (const ring of fx.rings) {
    ctx.globalAlpha = clamp(ring.t / ring.life, 0, 1) * 0.6;
    ctx.strokeStyle = ring.colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
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

  // ---- floor and takings, top left
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

  // ---- health and gun, bottom left
  const barW = 250;
  panel(ctx, 16, H - 92, barW + 24, 76);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(28, H - 78, barW, 16);
  ctx.fillStyle = p.hp > 35 ? COLOURS.good : COLOURS.alarm;
  ctx.fillRect(28, H - 78, barW * clamp(p.hp / p.maxHp, 0, 1), 16);
  ctx.fillStyle = COLOURS.hud;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)}`, 28 + barW + 6 - 34, H - 70);
  const gun = t(`gun.${p.weapon.id}`);
  const ammo = Number.isFinite(p.weapon.ammo) ? `${p.weapon.ammo}` : '∞';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`${gun}  ·  ${ammo}`, 28, H - 40);

  // ---- the objective, and how far in you are
  const v = game.level.vault;
  if (v.cracked > 0 && v.cracked < 1) {
    const cx = W / 2;
    const cy = H - 150;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = COLOURS.gold;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + v.cracked * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLOURS.hud;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('hud.drilling'), cx, cy + 56);
  }

  // ---- the prompt. Measured, because "pegar espingarda" and "take shotgun"
  //      are not the same width and a fixed box clips one of them.
  if (game.prompt) {
    const label = promptLabel(game.prompt, opts);
    ctx.font = 'bold 17px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 28;
    const x = W / 2 - w / 2;
    const y = H - 118;
    panel(ctx, x, y, w, 34, 0.72);
    ctx.fillStyle = COLOURS.hud;
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, y + 17);
  }

  // ---- being looked at
  if (game.detection > 0.02) {
    const k = clamp(game.detection, 0, 1);
    // The outer stop has to reach the *corner*, not the bottom edge: stopping
    // at 0.72·H leaves every pixel past it painted at the final alpha, and a
    // 1280×720 corner is a long way past it. The first version of this washed
    // the whole screen red and buried the floor under it.
    ctx.save();
    const corner = Math.hypot(W, H) / 2;
    const grd = ctx.createRadialGradient(W / 2, H / 2, corner * 0.42, W / 2, H / 2, corner);
    grd.addColorStop(0, 'rgba(255,60,50,0)');
    grd.addColorStop(1, `rgba(255,50,40,${0.05 + k * 0.24})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

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
  if (opts.touch) paintTouch(ctx, opts.touch, vp, !!game.prompt);
}

/** The two sticks where the thumbs left them, and the hand button. */
function paintTouch(ctx, touch, vp, hasPrompt) {
  const ring = (x, y, r, alpha) => {
    ctx.strokeStyle = `rgba(232,238,248,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (const s of [touch.stick, touch.trigger]) {
    if (!s.on) continue;
    ring(s.ox, s.oy, STICK.max * 0.62, 0.2);
    const dx = s.x - s.ox;
    const dy = s.y - s.oy;
    const len = Math.min(STICK.max * 0.62, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = 'rgba(232,238,248,0.3)';
    ctx.beginPath();
    ctx.arc(s.ox + Math.cos(a) * len, s.oy + Math.sin(a) * len, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hasPrompt) {
    const b = useButton(vp.W, vp.H);
    ctx.fillStyle = 'rgba(10,12,18,0.55)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ring(b.x, b.y, b.r, 0.45);
    ctx.fillStyle = COLOURS.hud;
    ctx.font = '30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✋', b.x, b.y + 2);
  }
}

function promptLabel(prompt, opts) {
  const key = opts.touch ? 'hud.tap' : 'hud.key';
  const what =
    prompt.kind === 'take' ? t('prompt.take', { gun: t(`gun.${prompt.item.gun}`) })
      : prompt.kind === 'heal' ? t('prompt.heal')
        : prompt.kind === 'grab' ? t('prompt.loot')
          : prompt.kind === 'carry' ? t('prompt.carry')
            : prompt.kind === 'drop' ? t('prompt.drop')
              : t('prompt.pull');
  return `${t(key)} — ${what}`;
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
      const solid = grid.at(cx, cy) === WALL;
      ctx.fillStyle = solid ? 'rgba(120,133,160,0.45)' : 'rgba(200,214,240,0.2)';
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
  ctx.fillStyle = COLOURS.player;
  const px = x + (game.player.x / TILE) * size;
  const py = y + (game.player.y / TILE) * size;
  ctx.fillRect(px - 2, py - 2, 5, 5);
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

/** mm:ss, for the cards at the end of a run. */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
