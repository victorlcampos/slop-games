// The field seen from almost directly above, through the eyes of the soldier
// you are driving.
//
// **The camera is Infinite Fortress's**: it sits on him, the field is bigger
// than the screen, and there is no clamp at the edges. And so is the darkness —
// the polygon `vision.js` builds is the clip path, and it is the same maths
// that answers "can that sentinel see you". There is no second system deciding
// what is visible, which is the only way a fog can be fair.
//
// The one difference from the Fortress is how wide the eyes open. On a lit
// arena the cone is the full circle, so what you get is the room you are
// standing in — the walls do all the hiding. On the night arena it is a torch.
// Either way, the field you are not looking at is still drawn, cold and flat:
// this is your own arena and you know its shape. What you do not get is who is
// standing in it.

import {
  COLOURS, KIT, TILE, COLS, ROWS, ARENA_W, ARENA_H, HUD_H, TARGET, UNIT, TURRET, PAD, ROLL, ASSIST,
  cameraFor, viewWidth, clamp, other, dist, RAD,
} from './config.js';
import { WALL, PIT, BASE_H, BASE_A } from './grid.js';
import { createSight } from './vision.js';
import { carriedBy } from './match.js';
import { ARMOURY, STANDARD, byId } from './weapons.js';
import { t, arenaName } from './i18n.js';
import { STICK, fireButton, rollButton } from './controls.js';

const LIP = 13;                         // how far a wall's top sits above its face
const HEAD_LIFT = 7;                    // how far a head floats over its shoulders

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function createRenderer() {
  const r = {
    arena: null,
    litImg: null,                       // the field as it looks with the light on it
    coldImg: null,                      // and as your squad remembers it
    scale: 1,
    camX: 0,
    camY: 0,
    reset() {
      r.arena = null;
      r.litImg = null;
      r.coldImg = null;
    },
  };

  r.draw = (ctx, game, vp, opts = {}) => {
    const H = vp.H;
    const W = viewWidth(vp);             // what the window can really show, not vp.W
    const fx = opts.fx || null;
    const eye = game.player && !game.player.dead ? game.player : anchor(game);

    const cam = cameraFor(eye.x, eye.y, W, H);
    r.camX = cam.x;
    r.camY = cam.y;

    ctx.fillStyle = COLOURS.void;
    ctx.fillRect(0, 0, W, H);

    if (r.arena !== game.arena) {
      r.arena = game.arena;
      r.scale = (vp.scale || 1) * (vp.dpr || 1) > 1.25 && ARENA_W * ARENA_H < 4e6 ? 2 : 1;
      r.litImg = bakeField(game, r.scale, false);
      r.coldImg = bakeField(game, r.scale, true);
    }

    const shake = fx ? fx.state.shake : 0;
    ctx.save();
    // not rounded: the camera has to be *exactly* the one `screenToWorld` uses,
    // or the cursor and the man it is pointing at drift apart by the rounding
    ctx.translate(
      -r.camX + (shake ? (Math.random() - 0.5) * shake : 0),
      -r.camY + (shake ? (Math.random() - 0.5) * shake : 0)
    );

    // the whole field, cold: the map your squad carries in its head
    ctx.drawImage(r.coldImg, 0, 0, ARENA_W, ARENA_H);

    // and inside the shape it can see, the same field with the light on
    const fans = squadSight(game);
    ctx.save();
    clipTo(ctx, fans);
    ctx.drawImage(r.litImg, 0, 0, ARENA_W, ARENA_H);
    paintStands(ctx, game);
    paintPads(ctx, game);
    paintDrops(ctx, game);
    paintTurrets(ctx, game);
    paintFlags(ctx, game);
    paintUnits(ctx, game);
    paintBullets(ctx, game);
    ctx.restore();

    // Outside the light, three things are still drawn: the stands, which do not
    // move; your own squad, which you are in radio contact with; and whoever is
    // running off with your flag — a carrier nobody can find is a match that
    // stops being playable.
    paintStands(ctx, game, true);
    for (const u of game.units) {
      if (u.dead) continue;
      const flag = carriedBy(game, u);
      if (u.team === game.playerTeam) drawUnit(ctx, game, u, flag);
      // whoever is walking off with your flag shows through the wall: a carrier
      // nobody can find is a match that stops being playable
      else if (flag && flag.team === game.playerTeam && !game.teamSees(game.playerTeam, u.x, u.y)) {
        drawGhostCarrier(ctx, game, u, flag);
      }
    }
    if (game.player && !game.player.dead) paintReticle(ctx, game.player);

    if (fx) paintFx(ctx, fx);
    ctx.restore();

    paintHud(ctx, game, vp, W);
    paintMinimap(ctx, game, W);
    paintShop(ctx, game, W, H);
    if (opts.touch) paintTouch(ctx, opts.touch, W, H);
  };

  return r;
}

/** Whose eyes the camera borrows while you are waiting to come back. */
function anchor(game) {
  const mates = game.units.filter((u) => !u.dead && u.team === game.playerTeam);
  const carrier = mates.find((u) => game.flags[other(u.team)].carrier === u.id);
  return carrier || mates[0] || game.player || { x: ARENA_W / 2, y: ARENA_H / 2 };
}

// ------------------------------------------------------------------- baking

function bakeField(game, scale, cold) {
  const img = makeCanvas(ARENA_W * scale, ARENA_H * scale);
  const g = img.getContext('2d');
  g.scale(scale, scale);
  paintGround(g, game, cold ? COLD : null);
  paintWalls(g, game, cold ? COLD : null);
  return img;
}

/**
 * The palette of a floor you are remembering rather than looking at.
 *
 * It is a **second bake with its own colours**, not the lit one under a black
 * wash. A wash keeps the ratio between the floor and the wall tops, and those
 * two are close to begin with: dimmed to a quarter they became the same grey,
 * and the maze — the one arena where knowing where the walls are is the whole
 * game — read as an empty black room.
 */
const COLD = {
  floor: '#141a21', floorAlt: '#171d25', grout: '#0d1116',
  wallFace: '#1a222c', wallTop: '#374757',
};

function paintGround(ctx, game, cold) {
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
        // the lip of the hole, only where there is floor above it: what makes a
        // pit read as depth instead of as a black tile
        if (grid.at(cx, cy - 1) !== PIT) {
          ctx.fillStyle = COLOURS.pitEdge;
          ctx.fillRect(x, y, TILE, 7);
        }
        const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
        if (!cold && h % 5 === 0) {
          ctx.fillStyle = 'rgba(92,232,207,0.08)';
          ctx.fillRect(x + (h % 40), y + ((h >> 4) % 48), 4, 4);
        }
        continue;
      }

      ctx.fillStyle = (cx + cy) % 2
        ? (cold ? cold.floor : COLOURS.floor)
        : (cold ? cold.floorAlt : COLOURS.floorAlt);
      ctx.fillRect(x, y, TILE, TILE);

      if (kind === BASE_H || kind === BASE_A) {
        const kit = KIT[kind === BASE_H ? 'human' : 'alien'];
        ctx.fillStyle = cold ? shade(kit.base, 0.5) : kit.base;
        ctx.fillRect(x, y, TILE, TILE);
        if (!cold) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        }
      }

      // wear, seeded by the cell, so the same arena is scuffed the same way
      const h = ((cx * 374761393) ^ (cy * 668265263)) >>> 0;
      if (!cold) {
        const j = (h % 9) - 4;
        if (j > 0) {
          ctx.fillStyle = `rgba(255,255,255,${j * 0.011})`;
          ctx.fillRect(x, y, TILE, TILE);
        } else if (j < 0) {
          ctx.fillStyle = `rgba(0,0,0,${-j * 0.013})`;
          ctx.fillRect(x, y, TILE, TILE);
        }
        if (h % 7 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(x + ((h >> 5) % 38), y + ((h >> 9) % 52) + 6, 22, 3);
        }
      }

      ctx.fillStyle = cold ? cold.grout : COLOURS.grout;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillRect(x, y, 1, TILE);
    }
  }
}

function paintWalls(ctx, game, cold) {
  const grid = game.grid;
  // rows down the screen, so a lip covers the block behind it
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      if (grid.at(cx, cy) !== WALL) continue;
      const x = cx * TILE;
      const y = cy * TILE;
      if (grid.at(cx, cy + 1) !== WALL) {
        ctx.fillStyle = cold ? cold.wallFace : COLOURS.wallFace;
        ctx.fillRect(x, y + TILE - LIP, TILE, LIP + 3);
      }
      ctx.fillStyle = cold ? cold.wallTop : COLOURS.wallTop;
      ctx.fillRect(x, y - LIP, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y - LIP, TILE, 3);
      ctx.strokeStyle = COLOURS.wallEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y - LIP + 0.5, TILE - 1, TILE - 1);
    }
  }
}

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// -------------------------------------------------------------------- sight

/**
 * The shape the player's squad can see: one fan per living body, each one
 * stopped by walls, plus the turrets that are still standing.
 *
 * Teammates share their eyes. In the Fortress there was one man and one torch;
 * a match where only your own counted would be four people you never see again,
 * and the minimap would be a lie.
 */
const SEEN = new WeakMap();

/**
 * A fan is a hundred and forty fresh objects, and there are five of them: at
 * sixty frames a second that is enough allocation to give a phone a
 * garbage-collector hitch every few seconds, felt as a stutter while standing
 * still. So a body's fan is kept until the body has actually moved or turned
 * enough to change it — under two pixels and half a degree change nothing the
 * eye could catch. (The Fortress learned this the same way.)
 */
function sightOf(game, body, eyes) {
  const was = SEEN.get(body);
  // A body that has not moved keeps its shape; one that has gets a new one the
  // same frame. The threshold used to be two pixels and half a degree, which is
  // where the shimmer people saw was coming from: the light lagged behind the
  // walk and then jumped a step. It costs nothing to hold it this tight now,
  // because the fan is rebuilt into the buffer it already owns.
  if (was && was.eyes === eyes
    && (body.x - was.x) ** 2 + (body.y - was.y) ** 2 < 0.01
    && Math.abs(body.facing - was.facing) < 0.0005) {
    return was.sight;
  }
  const sight = createSight(game.grid, body.x, body.y, body.facing || 0, eyes, was && was.sight);
  SEEN.set(body, { x: body.x, y: body.y, facing: body.facing || 0, eyes, sight });
  return sight;
}

const TURRET_EYES = { fov: 360, sight: TURRET.range, near: 0 };

function squadSight(game) {
  const fans = [];
  for (const u of game.units) {
    if (u.dead || u.team !== game.playerTeam) continue;
    fans.push(sightOf(game, u, game.eyes));
  }
  for (const t2 of game.turrets) {
    if (t2.dead || t2.team !== game.playerTeam) continue;
    fans.push(sightOf(game, t2, TURRET_EYES));
  }
  return fans;
}

function clipTo(ctx, fans) {
  if (!fans.length) {
    ctx.beginPath();
    ctx.rect(0, 0, 0, 0);
    ctx.clip();
    return;
  }
  ctx.beginPath();
  for (const s of fans) {
    ring(ctx, s.fan, s.x, s.y);
    if (s.nearFan) ring(ctx, s.nearFan, s.x, s.y);
  }
  ctx.clip();
}

/** One fan as a closed loop. Both rings are wound the same way: the clip is their union. */
function ring(ctx, fan, x, y) {
  if (!fan || !fan.count) return;
  const p = fan.points;
  ctx.moveTo(x, y);
  for (let i = 0; i < fan.count; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
  ctx.closePath();
}

// ------------------------------------------------------------- the fittings

function paintStands(ctx, game, faint = false) {
  const pulse = 0.5 + 0.5 * Math.sin(game.time * 2.2);
  for (const team of ['human', 'alien']) {
    const stand = game.flags[team].home;
    const kit = KIT[team];
    ctx.save();
    ctx.globalAlpha = faint ? 0.4 : 1;
    ctx.translate(stand.x, stand.y);
    ctx.strokeStyle = kit.tint;
    ctx.globalAlpha *= 0.35 + pulse * 0.25;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = faint ? 0.08 : 0.14 + pulse * 0.08;
    ctx.fillStyle = kit.tint;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = faint ? 0.5 : 1;
    ctx.fillStyle = COLOURS.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
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
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, PAD.r - i * 12 + k * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = COLOURS.energy;
    ctx.beginPath();
    ctx.arc(0, 0, PAD.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * A gun on the deck: its own silhouette, a ring that closes as it rots, and a
 * shard-coloured glow so it reads as something worth walking over.
 */
function paintDrops(ctx, game) {
  for (const d of game.drops) {
    const k = clamp(d.life / 26, 0, 1);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(game.time * 4 + d.x);
    ctx.fillStyle = COLOURS.energy;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLOURS.energy;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.stroke();
    ctx.rotate(-0.5);
    drawGunShape(ctx, d.id, KIT[d.team]);
    ctx.restore();
  }
}

/**
 * Each gun as an outline, drawn from the grip and pointing right.
 *
 * The body of it is `ink` on the field, where it sits on top of a lit floor,
 * and `steel` on the armoury's cards, where ink on a black panel is a gun you
 * cannot see you are being offered.
 */
function drawGunShape(ctx, id, kit, body = COLOURS.ink) {
  ctx.fillStyle = body;
  if (id === 'scatter') {
    ctx.fillRect(-10, -4, 22, 8);
    ctx.fillStyle = kit.trim;
    ctx.fillRect(8, -5, 5, 10);
  } else if (id === 'repeater') {
    ctx.fillRect(-11, -3, 24, 6);
    ctx.fillStyle = body;
    ctx.fillRect(-4, 2, 7, 6);
    ctx.fillStyle = kit.trim;
    ctx.fillRect(11, -2, 3, 4);
  } else if (id === 'lance') {
    ctx.fillRect(-13, -2.5, 30, 5);
    ctx.fillStyle = kit.trim;
    ctx.fillRect(12, -4, 4, 8);
    ctx.fillRect(-13, -1, 4, 2);
  } else {
    ctx.fillRect(-9, -2.5, 20, 5);
  }
}

function paintTurrets(ctx, game) {
  for (const t2 of game.turrets) {
    const kit = KIT[t2.team];
    ctx.save();
    ctx.translate(t2.x, t2.y);

    if (t2.dead) {
      ctx.strokeStyle = 'rgba(150,165,185,0.5)';
      ctx.lineWidth = 3;
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
    ctx.ellipse(2, 5, TURRET.r, TURRET.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.steel;
    ctx.beginPath();
    ctx.arc(0, 0, TURRET.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.dark;
    ctx.beginPath();
    ctx.arc(0, 0, TURRET.r - 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(t2.facing);
    ctx.fillStyle = COLOURS.ink;
    ctx.fillRect(4, -5, 26, 10);
    ctx.fillStyle = kit.tint;
    ctx.fillRect(24, -3, 6, 6);
    ctx.restore();

    const k = clamp(t2.hp / TURRET.hp, 0, 1);
    if (k < 1) bar(ctx, t2.x - 18, t2.y - TURRET.r - 12, 36, 4, k, kit.tint);
  }
}

function paintFlags(ctx, game) {
  for (const team of ['human', 'alien']) {
    const flag = game.flags[team];
    if (flag.state === 'carried') continue;      // it is drawn on the back that carries it
    const lift = flag.state === 'home' ? 0 : 3 + Math.sin(game.time * 5) * 2;
    drawBanner(ctx, flag.x, flag.y - lift, KIT[team], game.time, flag.state === 'dropped');
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
  ctx.ellipse(2, 9, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (urgent) {
    // a flag on the deck is on a clock, and the clock has to be visible from
    // across the room
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 8);
    ctx.fillStyle = kit.tint;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = COLOURS.steel;
  ctx.fillRect(-2, -28, 4, 36);
  const wave = Math.sin(time * 4) * 3;
  ctx.fillStyle = kit.tint;
  ctx.beginPath();
  ctx.moveTo(2, -27);
  ctx.lineTo(21 + wave, -19);
  ctx.lineTo(2, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.moveTo(2, -17);
  ctx.lineTo(12 + wave * 0.5, -14);
  ctx.lineTo(2, -10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// -------------------------------------------------------------- the soldiers

function paintUnits(ctx, game) {
  const order = game.units.filter((u) => !u.dead).sort((a, b) => a.y - b.y);
  for (const u of order) {
    if (u.team !== game.playerTeam && !game.teamSees(game.playerTeam, u.x, u.y)) continue;
    drawUnit(ctx, game, u, carriedBy(game, u));
  }
}

/**
 * A soldier, seen from almost directly above and fitting inside their own tile.
 *
 * The shoulders, the arms and the gun are drawn in the body's own frame, so
 * they turn with it — which from up here is what a man turning looks like. The
 * one thing that does *not* turn is the head: it is lifted a few pixels up the
 * screen and given its own shadow, and that little parallax is the whole of the
 * third dimension. It is enough to stop him being a disc, and small enough that
 * where he is drawn and where he is standing are the same place — which is what
 * makes aiming at him and hitting him the same act.
 */
function drawUnit(ctx, game, u, flag) {
  const kit = KIT[u.team];
  const mine = u.team === game.playerTeam;
  const you = u === game.player;

  if (you) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (mine) {
    ctx.save();
    ctx.strokeStyle = kit.tint;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 3, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // The roll, drawn as a roll: he tucks and goes over once, along the line he
  // threw himself down. The body turns a full circle in the 0.3s it lasts and
  // squashes at the halfway point — the moment he is on his shoulder — and the
  // head goes round with it instead of floating above a spinning body.
  const rolling = u.roll > 0;
  const over = rolling ? 1 - u.roll / ROLL.time : 0;          // 0 → 1 through the roll
  const tuck = rolling ? 1 - 0.42 * Math.sin(over * Math.PI) : 1;
  const bodyAngle = rolling ? u.rollA + over * Math.PI * 2 : u.facing;

  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.rotate(bodyAngle);
  if (rolling) ctx.scale(tuck, tuck * 0.86);

  const stride = rolling ? 0 : Math.sin(u.stride * 0.09) * 3;
  ctx.fillStyle = kit.legs;
  ctx.fillRect(-13, -11 + stride, 9, 7);
  ctx.fillRect(-13, 4 - stride, 9, 7);

  // Shoulders: wider across than deep. That one proportion is what makes a
  // figure seen from above read as facing somewhere.
  ctx.fillStyle = u.hurt > 0 ? '#ff9d9d' : kit.coat;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = u.hurt > 0 ? '#e07070' : kit.coatDark;
  ctx.beginPath();
  ctx.ellipse(-5, 0, 8, 15, 0, 0, Math.PI * 2);   // the back, in its own shade
  ctx.fill();
  ctx.fillStyle = kit.tint;
  ctx.fillRect(5, -4, 5, 8);                      // the collar, in the team's colour

  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(3, side * 11);
    ctx.lineTo(15, side * 5);
    ctx.stroke();
  }
  // the gun he is actually holding, so a bought one is visible from across the
  // room — that is most of what tells you the fight you are walking into
  ctx.fillStyle = COLOURS.ink;
  if (u.weapon && u.weapon.id !== STANDARD) {
    ctx.save();
    ctx.translate(20, 0);
    drawGunShape(ctx, u.weapon.id, kit);
    ctx.restore();
  } else if (u.team === 'human') {
    ctx.fillRect(13, -2.4, 20, 4.8);
    ctx.fillStyle = kit.trim;
    ctx.fillRect(29, -1.6, 4, 3.2);
  } else {
    ctx.beginPath();
    ctx.moveTo(13, -4.5);
    ctx.lineTo(31, -1.8);
    ctx.lineTo(31, 1.8);
    ctx.lineTo(13, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = kit.trim;
    ctx.beginPath();
    ctx.arc(26, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // the head, in screen space and a few pixels up: the whole third dimension.
  // Mid-roll it comes down to the deck with the rest of him — a head hovering
  // over a body that is going over is the one thing that would give it away.
  const lift = HEAD_LIFT * (rolling ? 1 - 0.8 * Math.sin(over * Math.PI) : 1);
  const hx = u.x + Math.cos(bodyAngle) * 3 * tuck;
  const hy = u.y + Math.sin(bodyAngle) * 3 * tuck - lift;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(u.x + Math.cos(bodyAngle) * 3, u.y + Math.sin(bodyAngle) * 3 + 1, 8 * tuck, 6 * tuck, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(bodyAngle);
  if (rolling) ctx.scale(tuck, tuck);
  if (kit.hat === 'helmet') {
    ctx.fillStyle = kit.skin;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.head;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, Math.PI * 0.42, Math.PI * 1.58);
    ctx.fill();
    ctx.fillStyle = kit.trim;
    ctx.fillRect(-2, -7.5, 3.5, 15);
  } else {
    // a sentinel's head: one smooth cranium, longer than it is wide, and the
    // two black eyes that do all the seeing on that side
    ctx.fillStyle = kit.head;
    ctx.beginPath();
    ctx.ellipse(-1, 0, 8.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.ink;
    ctx.beginPath();
    ctx.ellipse(4.5, -3.4, 2.6, 1.7, 0.5, 0, Math.PI * 2);
    ctx.ellipse(4.5, 3.4, 2.6, 1.7, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (flag) drawBanner(ctx, u.x - 9, u.y - 10, KIT[flag.team], game.time, false);

  // health, only once it means something: a bar over everybody all the time is
  // ten bars, and ten bars is a HUD sitting on top of the game
  const k = clamp(u.hp / UNIT.hp, 0, 1);
  if (k < 1) bar(ctx, u.x - 16, u.y - 30, 32, 4, k, mine ? kit.tint : '#ff6a5a');
}

/** Whoever has your flag, seen through the wall: the one thing the fog gives away. */
function drawGhostCarrier(ctx, game, u, flag) {
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.25 * Math.sin(game.time * 6);
  ctx.strokeStyle = KIT[flag.team].tint;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(u.x, u.y, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = KIT[u.team].coatDark;
  ctx.beginPath();
  ctx.arc(u.x, u.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawBanner(ctx, u.x - 9, u.y - 10, KIT[flag.team], game.time, false);
}

/**
 * The brackets: what the gun has, and how far it still has to turn.
 *
 * They close as the shoulders come round, and the round leaves when they shut —
 * which is the same gate the trigger obeys, drawn rather than explained.
 */
function paintReticle(ctx, p) {
  const t2 = p.aimTarget;
  if (!t2 || t2.dead) return;
  const off = Math.abs(((Math.atan2(t2.y - p.y, t2.x - p.x) - p.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const k = clamp(off / (ASSIST.settle * RAD), 0, 1);
  const r = 20 + k * 14;
  ctx.save();
  ctx.strokeStyle = k > 0.02 ? 'rgba(255,217,160,0.75)' : 'rgba(92,232,207,0.95)';
  ctx.lineWidth = 2;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(t2.x + sx * r, t2.y + sy * r - sy * 8);
    ctx.lineTo(t2.x + sx * r, t2.y + sy * r);
    ctx.lineTo(t2.x + sx * r - sx * 8, t2.y + sy * r);
    ctx.stroke();
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, k, colour) {
  ctx.fillStyle = 'rgba(6,8,12,0.72)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w * k, h);
}

function paintBullets(ctx, game) {
  for (const b of game.bullets) {
    if (b.kind === 'scatter') {
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (b.kind === 'lance') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = '#eaf6ff';
      ctx.fillRect(-22, -1.6, 44, 3.2);
      ctx.fillStyle = 'rgba(140,220,255,0.5)';
      ctx.fillRect(-30, -0.8, 60, 1.6);
      ctx.restore();
      continue;
    }
    const len = b.kind === 'blaster' ? 14 : b.kind === 'repeater' ? 12 : 18;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    if (b.kind === 'blaster') {
      ctx.fillStyle = '#8ff0dc';
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'turret') {
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(-8, -1.5, 16, 3);
    } else {
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(-len / 2, -1.6, len, 3.2);
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
  ctx.textAlign = 'left';
}

// ----------------------------------------------------------------- the HUD

function paintHud(ctx, game, vp, W) {
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

  // the ticker, newest at the bottom. A kill has no line: with ten bodies on
  // the field a feed of them is a wall of text over the only thing worth
  // watching.
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px system-ui, sans-serif';
  const lines = game.events.filter((e) => e.kind !== 'killed').slice(-4);
  lines.forEach((e, i) => {
    ctx.globalAlpha = clamp(e.t / 1.2, 0, 1);
    ctx.fillStyle = e.kind === 'captured' ? KIT[e.team].tint
      : e.team === game.playerTeam ? '#ff9d9d' : COLOURS.hud;
    ctx.fillText(t(`log.${e.kind}`, { team: t(`side.${e.team}`) }), 14, HUD_H + 22 + i * 18);
  });
  ctx.globalAlpha = 1;

  const player = game.player;
  if (!player) return;

  if (player.dead) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(6,8,12,0.55)';
    ctx.fillRect(0, HUD_H, W, vp.H - HUD_H);
    ctx.fillStyle = COLOURS.hud;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(t('hud.respawn', { n: Math.max(0, player.respawnT).toFixed(1) }), W / 2, vp.H / 2);
    ctx.textAlign = 'left';
    return;
  }

  const flag = carriedBy(game, player);
  if (flag) {
    const own = flag.team === player.team;
    const home = game.flags[player.team].state === 'home';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = own || home ? KIT[player.team].tint : '#ff6a5a';
    ctx.fillText(t(own ? 'hud.rescuing' : 'hud.carrying'), W / 2, vp.H - 26);
    if (!own && !home) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#ff9d9d';
      ctx.fillText(t('hud.blocked'), W / 2, vp.H - 8);
    }
    ctx.textAlign = 'left';
  }

  // your own health, bottom left, where a glance costs nothing — and under it
  // the roll, which is the only thing you have that is ever on a clock
  bar(ctx, 14, vp.H - 24, 132, 8, clamp(player.hp / UNIT.hp, 0, 1),
    player.hp > 35 ? KIT[player.team].tint : '#ff6a5a');
  const ready = clamp(1 - player.rollCool / (ROLL.cool + ROLL.time), 0, 1);
  bar(ctx, 14, vp.H - 34, 132, 4, ready, ready < 1 ? 'rgba(159,178,196,0.5)' : COLOURS.energy);

  // what he has been paid, and what is in his hands: the two numbers the
  // armoury is played with
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = COLOURS.energy;
  ctx.fillText(`◆ ${player.shards}`, 14, vp.H - 44);
  const gun = game.gun(player);
  ctx.fillStyle = player.weapon.id === STANDARD ? COLOURS.dim : COLOURS.hud;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(
    player.weapon.id === STANDARD
      ? t(`gun.${gun.id}`)
      : `${t(`gun.${gun.id}`)} · ${player.weapon.ammo}`,
    90, vp.H - 44
  );
}

function scoreBlock(ctx, x, team, score, game, align) {
  const kit = KIT[team];
  const flag = game.flags[team];
  ctx.textAlign = align;
  ctx.fillStyle = kit.tint;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(t(`side.${team}`), x, 20);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = flag.state === 'home' ? COLOURS.dim : '#ff9d9d';
  ctx.fillText(
    flag.state === 'home' ? t('hud.flagHome') : flag.state === 'carried' ? t('hud.flagOut') : t('hud.flagDown'),
    x, 36
  );

  // the pips: ten of them, filled as the side scores, so the state of the match
  // is a shape and not a number to be read
  // half as many pips as there were, so each one can be twice as legible
  const dir = align === 'right' ? -1 : 1;
  for (let i = 0; i < TARGET; i++) {
    const px = x + dir * (14 + i * 20);
    ctx.fillStyle = i < score ? kit.tint : 'rgba(255,255,255,0.13)';
    ctx.fillRect(px + (dir < 0 ? -16 : 0), 41, 16, 6);
  }
  ctx.textAlign = 'left';
}

/**
 * The map in the corner, which the camera made necessary: with the field bigger
 * than the screen, "where is everybody" has to be answerable without it.
 *
 * It shows what you are entitled to know — the walls, both stands, your own
 * squad — plus every enemy your squad can actually see, and the one it cannot:
 * whoever is carrying your flag.
 */
function paintMinimap(ctx, game, W) {
  const size = Math.max(3, Math.round(196 / COLS));
  const w = COLS * size;
  const h = ROWS * size;
  const x = W - w - 16;
  const y = HUD_H + 14;

  ctx.save();
  ctx.fillStyle = 'rgba(8,11,16,0.72)';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6.5, y - 6.5, w + 13, h + 13);

  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const kind = game.grid.at(cx, cy);
      if (kind === WALL) ctx.fillStyle = 'rgba(120,133,160,0.45)';
      else if (kind === PIT) ctx.fillStyle = 'rgba(4,6,10,0.8)';
      else if (kind === BASE_H) ctx.fillStyle = 'rgba(255,154,77,0.16)';
      else if (kind === BASE_A) ctx.fillStyle = 'rgba(79,224,176,0.16)';
      else continue;
      ctx.fillRect(x + cx * size, y + cy * size, size, size);
    }
  }

  const dot = (wx, wy, colour, r = 2.5) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x + (wx / TILE) * size, y + (wy / TILE) * size, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const team of ['human', 'alien']) {
    const f = game.flags[team];
    const p = f.state === 'carried' ? game.unitById(f.carrier) : f;
    if (p) dot(p.x, p.y, KIT[team].tint, f.state === 'home' ? 3.5 : 4.5);
  }
  for (const u of game.units) {
    if (u.dead) continue;
    if (u.team === game.playerTeam) dot(u.x, u.y, u === game.player ? '#ffffff' : KIT[u.team].tint, u === game.player ? 3.4 : 2.4);
    else if (game.teamSees(game.playerTeam, u.x, u.y)) dot(u.x, u.y, '#ff6a5a', 2.4);
  }
  ctx.restore();
}

/** A line of text shrunk until it fits the space it was given. */
function fitText(ctx, text, x, y, width, size, colour) {
  let px = size;
  ctx.fillStyle = colour;
  do {
    ctx.font = `${px}px system-ui, sans-serif`;
    if (ctx.measureText(text).width <= width || px <= 8) break;
    px -= 1;
  } while (px > 8);
  ctx.fillText(text, x, y);
}

/**
 * Where the three cards of the armoury sit. Exported because the thumb has to
 * hit the same rectangles the eye sees, and two copies of a layout are two
 * layouts.
 */
export function shopCards(W, H) {
  const w = 196;
  const gap = 10;
  const total = ARMOURY.length * w + (ARMOURY.length - 1) * gap;
  const x0 = W / 2 - total / 2;
  const y = H - 92;
  return ARMOURY.map((gun, i) => ({ gun, x: x0 + i * (w + gap), y, w, h: 62 }));
}

/**
 * The armoury, which only exists while you are standing on your own ground.
 *
 * It is drawn where a menu would be in the way of nothing: along the bottom,
 * over your own end zone, in the seconds you are already spending walking back
 * to your stand.
 */
function paintShop(ctx, game, W, H) {
  const p = game.player;
  if (!p || p.dead || !game.inBase(p)) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = COLOURS.energy;
  ctx.fillText(t('shop.title'), W / 2, H - 106);

  for (const card of shopCards(W, H)) {
    const afford = p.shards >= card.gun.cost;
    const held = p.weapon.id === card.gun.id;
    ctx.globalAlpha = afford ? 1 : 0.45;
    ctx.fillStyle = 'rgba(8,11,16,0.82)';
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = held ? COLOURS.energy : afford ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = held ? 2 : 1;
    ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);

    ctx.save();
    ctx.translate(card.x + 30, card.y + 26);
    ctx.scale(1.5, 1.5);
    drawGunShape(ctx, card.gun.id, KIT[p.team], COLOURS.steel);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.fillStyle = COLOURS.hud;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`${ARMOURY.indexOf(card.gun) + 1}. ${t(`gun.${card.gun.id}`)}`, card.x + 56, card.y + 20);
    // the note is measured, never assumed: "everything at once, up close" and
    // "tudo de uma vez, de perto" are not the same width, and a card that fits
    // one paints the other over its neighbour
    fitText(ctx, t(`gun.${card.gun.id}.note`), card.x + 56, card.y + 36, card.w - 66, 11, COLOURS.dim);
    ctx.fillStyle = afford ? COLOURS.energy : '#ff9d9d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`◆ ${card.gun.cost}`, card.x + 56, card.y + 53);
    ctx.fillStyle = COLOURS.dim;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`${card.gun.ammo} ${t('hud.ammo')}`, card.x + 112, card.y + 53);
    ctx.textAlign = 'center';
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOURS.dim;
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(t('shop.hint'), W / 2, H - 18);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ---------------------------------------------------------------- the thumbs

function paintTouch(ctx, touch, W, H) {
  if (touch.stick.on) {
    const dx = touch.stick.x - touch.stick.ox;
    const dy = touch.stick.y - touch.stick.oy;
    const len = Math.min(STICK.max, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    ring2(ctx, touch.stick.ox, touch.stick.oy, STICK.max, 0.16);
    ring2(ctx, touch.stick.ox + Math.cos(a) * len, touch.stick.oy + Math.sin(a) * len, 26, 0.34);
  }
  const gun = fireButton(W, H);
  const roll = rollButton(W, H);
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
  ctx.arc(roll.x, roll.y, roll.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOURS.hud;
  ctx.fillText('🌀', roll.x, roll.y + 8);
  ctx.textAlign = 'left';
  ctx.restore();
}

function ring2(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLOURS.hud;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * A point on the screen, in the field — the exact inverse of the camera.
 *
 * Computed from where the player is *now*, not from the camera the last frame
 * was drawn with. Reading the renderer's copy costs one frame of lag, which is
 * small — and is the same lag, in the same direction, that made aiming while
 * running feel like dragging the cursor along behind him.
 */
export function screenToWorld(sx, sy, vp, player) {
  const cam = cameraFor(player ? player.x : ARENA_W / 2, player ? player.y : ARENA_H / 2, viewWidth(vp), vp.H);
  return { x: sx + cam.x, y: sy + cam.y };
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
