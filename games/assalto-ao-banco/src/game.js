// One floor, from the front door to the vault.
//
// Everything the player can do to the building is here, and everything the
// building can do back. It knows nothing about canvases: the tests drive this
// module directly, at a fixed step, with no browser anywhere.

import {
  PLAYER, GUARD, CAMERA, VAULT, TILE, clamp, dist, makeRng, turnTowards,
} from './config.js';
import { moveCircle, flowField, castRay } from './grid.js';
import { canSee, createSight, rememberSeen } from './vision.js';
import { updateGuard, separate } from './guards.js';
import { WEAPONS, createLoadout, droppedAmmo } from './weapons.js';

const silent = { spark() {}, blood() {}, ring() {}, float() {}, tracer() {}, shake() {} };

export function createGame(opts) {
  const {
    level,
    fx = silent,
    hp = PLAYER.hp,
    money = 0,
    loadout = createLoadout(),
    seed = level.seed ^ 0x5bf03635,
  } = opts;

  const grid = level.grid;
  const rng = makeRng(seed >>> 0 || 1);

  const player = {
    x: level.spawn.x,
    y: level.spawn.y,
    vx: 0,
    vy: 0,
    facing: 0,
    r: PLAYER.r,
    hp,
    maxHp: PLAYER.hp,
    dead: false,
    hurt: 0,
    weapon: { ...loadout },
    dragging: null,
    step: 0,
    sneaking: false,
  };

  const seen = new Uint8Array(grid.cols * grid.rows);
  const fields = new Map();
  const bodies = [];
  const bullets = [];
  const noises = [];

  const alarm = { on: false, timer: 0, source: null, by: null, ring: 0 };
  const stats = { money, kills: 0, alarms: 0, loot: 0, time: 0, shots: 0, explored: 0 };

  const game = {
    level,
    grid,
    player,
    guards: level.guards,
    cameras: level.cameras,
    alarms: level.alarms,
    items: level.items,
    bodies,
    bullets,
    noises,
    alarm,
    stats,
    seen,
    rng,
    fx,
    state: 'playing',            // playing | cleared | dead
    lastKnown: null,
    seenStamp: 0,                 // bumped every time anybody sees you
    sight: null,
    detection: 0,                 // 0..1, "somebody is looking at you"
    detector: null,               // and this is where they are standing
    prompt: null,                 // what `use` would do right now
    useWas: false,

    /** A route to a cell, computed once and shared by everybody heading there. */
    fieldFor(cx, cy) {
      const key = cy * grid.cols + cx;
      let f = fields.get(key);
      if (!f) {
        if (grid.solid(cx, cy)) return null;
        f = flowField(grid, [{ cx, cy }]);
        // the cache is per-goal and goals are cells, so it is bounded by the
        // floor — the clear is only here to stop a long alarm from holding
        // every cell of the biggest map at once
        if (fields.size > 96) fields.clear();
        fields.set(key, f);
      }
      return f;
    },

    markSeen(x, y) {
      game.lastKnown = { x, y };
      game.seenStamp++;
      if (alarm.on) alarm.timer = GUARD.alarmHold;
    },

    raiseAlarm(source, by) {
      const first = !alarm.on;
      alarm.on = true;
      alarm.timer = GUARD.alarmHold;
      alarm.source = source;
      alarm.by = by;
      if (first) stats.alarms++;
      // Who pulled it decides where everybody runs. A guard or a camera sends
      // them to you; you send them to the panel — which is the only reason to
      // ever pull one yourself.
      game.lastKnown = by === 'player' ? { x: source.x, y: source.y } : { x: player.x, y: player.y };
      game.seenStamp++;
      fx.ring(source.x, source.y, 200, '#ff5a4d');
      game.onAlarm?.(by);
    },

    /** Sound, which unlike sight goes through walls. */
    makeNoise(x, y, radius, kind = 'shot') {
      if (radius <= 0) return;
      noises.push({ x, y, r: radius, t: 0.5, life: 0.5 });
      const reach = radius * level.plan.guardHearing;
      for (const g of game.guards) {
        if (g.dead) continue;
        if (dist(g.x, g.y, x, y) > reach) continue;
        if (g.state === 'call' || g.state === 'hunt') continue;
        g.state = 'investigate';
        g.goal = { x, y };
        g.lost = GUARD.forget;
        g.alert = Math.max(g.alert, kind === 'drill' ? 0.55 : 0.3);
      }
    },

    guardFires(g, spread = 1) {
      const w = WEAPONS[g.gun];
      fire(g, w, Math.atan2(player.y - g.y, player.x - g.x), 'guard', level.plan.guardDamage, spread);
    },
  };

  // ------------------------------------------------------------------ firing

  function fire(from, w, angle, side, damageOverride, spread = 1) {
    for (let i = 0; i < w.pellets; i++) {
      const a = angle + (rng() - 0.5) * w.spread * spread * 2;
      bullets.push({
        x: from.x + Math.cos(a) * (PLAYER.r + 4),
        y: from.y + Math.sin(a) * (PLAYER.r + 4),
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        dmg: damageOverride ?? w.damage,
        left: w.range,
        side,
      });
    }
    fx.spark(from.x + Math.cos(angle) * 20, from.y + Math.sin(angle) * 20, '#ffd88a', 3, 120);
    game.makeNoise(from.x, from.y, w.noise, 'shot');
    stats.shots += side === 'player' ? 1 : 0;
  }

  function playerFires() {
    const slot = player.weapon;
    const w = WEAPONS[slot.id];
    if (slot.cool > 0 || slot.ammo <= 0) return;
    fire(player, w, player.facing, 'player');
    slot.cool = w.rate;
    if (Number.isFinite(slot.ammo)) slot.ammo--;
    if (slot.ammo <= 0) {
      // an empty gun is dropped for the one you always have, rather than
      // leaving you holding a club in front of four men with rifles
      player.weapon = createLoadout();
      game.onDry?.();
    }
    game.onShot?.(w);
  }

  // ------------------------------------------------------------- the world

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const stepX = b.vx * dt;
      const stepY = b.vy * dt;
      const x2 = b.x + stepX;
      const y2 = b.y + stepY;
      let hit = null;
      let hitT = 1;

      const targets = b.side === 'player'
        ? [...game.guards.filter((g) => !g.dead), ...game.cameras.filter((c) => !c.dead), ...game.alarms.filter((a) => !a.dead)]
        : [player];
      for (const t of targets) {
        const r = t === player ? PLAYER.r : t.hp !== undefined ? GUARD.r : 16;
        const at = segHit(b.x, b.y, x2, y2, t.x, t.y, r);
        if (at !== null && at < hitT) {
          hitT = at;
          hit = t;
        }
      }

      // the wall is a target too, and the nearest one wins
      const wall = wallHit(b.x, b.y, stepX, stepY);
      if (wall !== null && (hit === null || wall < hitT)) {
        fx.spark(b.x + stepX * wall, b.y + stepY * wall, '#9aa4bb', 4, 200);
        bullets.splice(i, 1);
        continue;
      }

      if (hit) {
        applyHit(hit, b);
        bullets.splice(i, 1);
        continue;
      }

      b.x = x2;
      b.y = y2;
      b.left -= Math.hypot(stepX, stepY);
      if (b.left <= 0) bullets.splice(i, 1);
    }
  }

  /** How far into this step the bullet meets a wall, as 0..1, or null. */
  function wallHit(x, y, dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const t = castRay(grid, x, y, dx / len, dy / len, len);
    return t < len ? t / len : null;
  }

  function applyHit(target, b) {
    if (target === player) {
      hurtPlayer(b.dmg);
      return;
    }
    if (target.hp !== undefined && target.route) {
      target.hp -= b.dmg;
      target.alert = 1;
      fx.blood(b.x, b.y);
      if (target.hp <= 0) killGuard(target);
      else {
        // being shot at from somewhere is as good as seeing you
        target.state = 'call';
        target.goal = null;
        game.markSeen(player.x, player.y);
      }
      return;
    }
    // a camera or a panel: one bullet and it is scrap, which is the trade —
    // quiet with a silenced pistol, an announcement with anything else
    target.dead = true;
    fx.spark(target.x, target.y, '#8fa9d6', 8, 300);
    game.onBreak?.(target);
  }

  function hurtPlayer(dmg) {
    if (player.dead) return;
    player.hp -= dmg;
    player.hurt = PLAYER.hitFlash;
    fx.shake(6);
    fx.blood(player.x, player.y);
    game.onHurt?.(dmg);
    if (player.hp <= 0) {
      player.hp = 0;
      player.dead = true;
      game.state = 'dead';
      game.onDead?.();
    }
  }

  function killGuard(g) {
    g.dead = true;
    stats.kills++;
    fx.blood(g.x, g.y, 14);
    const body = { x: g.x, y: g.y, a: g.facing, seen: 0, gun: g.gun, id: g.id };
    bodies.push(body);
    if (rng() < 0.75) {
      level.items.push({
        kind: 'gun', gun: g.gun, ammo: droppedAmmo(g.gun, rng, 0.4),
        x: g.x + (rng() - 0.5) * 20, y: g.y + (rng() - 0.5) * 20, taken: false,
      });
    }
    if (player.dragging && player.dragging.id === g.id) player.dragging = null;
    game.onKill?.(g);
  }

  function updateCameras(dt) {
    for (const c of game.cameras) {
      if (c.dead) continue;
      c.sweep += dt * CAMERA.rate;
      c.facing = c.base + Math.sin(c.sweep) * CAMERA.sweep * (Math.PI / 180);
      const sees =
        !player.dead && canSee(grid, c.x, c.y, c.facing, CAMERA.fov, c.range, player.x, player.y);
      if (sees) {
        c.lock += dt;
        if (c.lock >= level.plan.cameraLock) {
          game.raiseAlarm(c, 'camera');
          c.lock = 0;
        }
      } else {
        c.lock = Math.max(0, c.lock - dt * 0.7);
      }
    }
  }

  function updateAlarm(dt) {
    if (!alarm.on) return;
    alarm.ring += dt;
    alarm.timer -= dt;
    if (alarm.timer <= 0) {
      alarm.on = false;
      alarm.source = null;
      for (const g of game.guards) {
        if (g.dead) continue;
        g.state = 'investigate';
        g.lost = GUARD.forget;
      }
    }
  }

  // ---------------------------------------------------------------- the player

  function movePlayer(dt, input) {
    const want = normalise(input.mx || 0, input.my || 0);
    player.sneaking = !!input.sneak;
    const top = (player.sneaking ? PLAYER.sneak : PLAYER.speed) * (player.dragging ? PLAYER.dragging : 1);
    const ax = want.x * top;
    const ay = want.y * top;
    const rate = want.x || want.y ? PLAYER.accel : PLAYER.friction;
    player.vx += clamp(ax - player.vx, -rate * dt, rate * dt);
    player.vy += clamp(ay - player.vy, -rate * dt, rate * dt);

    const moved = moveCircle(grid, player.x, player.y, PLAYER.r, player.vx * dt, player.vy * dt);
    const realDx = moved.x - player.x;
    const realDy = moved.y - player.y;
    player.x = moved.x;
    player.y = moved.y;

    // Footsteps. Sneaking makes none, which is the whole of the stealth budget:
    // you are either fast or quiet.
    const travelled = Math.hypot(realDx, realDy);
    if (!player.sneaking && travelled > 0.4) {
      player.step += travelled;
      if (player.step > 150) {
        player.step = 0;
        game.makeNoise(player.x, player.y, PLAYER.noiseWalk, 'step');
      }
    }

    // where he is looking: the aim if there is one, the direction of travel if not
    let want2 = null;
    if (input.aim) want2 = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
    else if (typeof input.aimAngle === 'number') want2 = input.aimAngle;
    else if (travelled > 0.2) want2 = Math.atan2(realDy, realDx);
    if (want2 !== null) player.facing = turnTowards(player.facing, want2, 14 * dt);

    if (player.dragging) dragBody(dt);
  }

  function dragBody(dt) {
    const b = player.dragging;
    const behind = player.facing + Math.PI;
    const tx = player.x + Math.cos(behind) * 34;
    const ty = player.y + Math.sin(behind) * 34;
    const moved = moveCircle(grid, b.x, b.y, 12, (tx - b.x) * Math.min(1, dt * 12), (ty - b.y) * Math.min(1, dt * 12));
    b.x = moved.x;
    b.y = moved.y;
    b.a = behind;
    // a body that gets left behind a corner is dropped rather than teleported
    if (dist(b.x, b.y, player.x, player.y) > TILE * 1.8) player.dragging = null;
  }

  /** What the `use` button would do, and the label the HUD shows for it. */
  function findPrompt() {
    const near = (o) => dist(o.x, o.y, player.x, player.y) <= PLAYER.reach;
    const item = game.items.find((i) => !i.taken && near(i));
    if (item) return { kind: item.kind === 'gun' ? 'take' : item.kind === 'medkit' ? 'heal' : 'grab', item };
    if (player.dragging) return { kind: 'drop' };
    const body = bodies.find((b) => near(b));
    if (body) return { kind: 'carry', body };
    const panel = game.alarms.find((a) => !a.dead && near(a));
    if (panel) return { kind: 'pull', panel };
    return null;
  }

  function doUse() {
    const p = game.prompt;
    if (!p) return;
    if (p.item) {
      const it = p.item;
      it.taken = true;
      if (it.kind === 'gun') {
        const old = player.weapon;
        player.weapon = { id: it.gun, ammo: it.ammo, cool: 0 };
        if (old.id !== 'silenced' && old.ammo > 0) {
          level.items.push({ kind: 'gun', gun: old.id, ammo: old.ammo, x: player.x, y: player.y, taken: false });
        }
      } else if (it.kind === 'medkit') {
        player.hp = Math.min(player.maxHp, player.hp + it.heal);
      } else {
        stats.money += it.value;
        stats.loot++;
      }
      game.onPick?.(it);
      return;
    }
    if (p.kind === 'drop') {
      player.dragging = null;
      return;
    }
    if (p.kind === 'carry') {
      player.dragging = p.body;
      return;
    }
    if (p.kind === 'pull') {
      game.raiseAlarm(p.panel, 'player');
      p.panel.pulled++;
    }
  }

  function updateVault(dt) {
    const v = level.vault;
    if (dist(player.x, player.y, v.x, v.y) > VAULT.r) return;
    v.cracked = Math.min(1, v.cracked + dt / level.plan.vaultTime);
    // the drill is the loudest thing on the floor, and it runs for as long as
    // the floor number says: the last stretch is always a fight or a sprint
    if (rng() < dt * 4) game.makeNoise(v.x, v.y, 460, 'drill');
    if (v.cracked >= 1 && game.state === 'playing') {
      game.state = 'cleared';
      stats.money += level.plan.payday;
      game.onCleared?.();
    }
  }

  // ------------------------------------------------------------------ update

  game.update = (dt, input = {}) => {
    if (game.state !== 'playing') return;
    stats.time += dt;
    player.hurt = Math.max(0, player.hurt - dt);
    player.weapon.cool = Math.max(0, player.weapon.cool - dt);

    movePlayer(dt, input);

    const pressed = !!input.use && !game.useWas;
    game.useWas = !!input.use;
    game.prompt = findPrompt();
    if (pressed) doUse();

    if (input.fire) playerFires();

    for (const g of game.guards) updateGuard(g, dt, game);
    separate(game.guards, grid);
    updateCameras(dt);
    updateBullets(dt);
    updateAlarm(dt);
    updateVault(dt);

    for (let i = noises.length - 1; i >= 0; i--) {
      noises[i].t -= dt;
      if (noises[i].t <= 0) noises.splice(i, 1);
    }
    for (const b of bodies) b.seen = Math.max(0, b.seen - dt * 0.5);

    // what the player can see, and what is looking back
    game.sight = createSight(grid, player.x, player.y, player.facing, PLAYER);
    stats.explored += rememberSeen(grid, seen, game.sight);

    let worst = 0;
    let who = null;
    for (const g of game.guards) {
      if (g.dead || g.alert <= worst) continue;
      worst = g.alert;
      who = g;
    }
    for (const c of game.cameras) {
      const v = c.dead ? 0 : c.lock / level.plan.cameraLock;
      if (v > worst) {
        worst = v;
        who = c;
      }
    }
    game.detection = alarm.on ? 1 : clamp(worst, 0, 1);
    game.detector = who;
  };

  /** Everything the HUD and the tests want to read, in one place. */
  game.snapshot = () => ({
    floor: level.floor,
    hp: player.hp,
    money: stats.money,
    weapon: player.weapon.id,
    ammo: player.weapon.ammo,
    alarm: alarm.on,
    cracked: level.vault.cracked,
    kills: stats.kills,
    alive: game.guards.filter((g) => !g.dead).length,
    state: game.state,
  });

  game.sight = createSight(grid, player.x, player.y, player.facing, PLAYER);
  rememberSeen(grid, seen, game.sight);

  return game;
}

// ------------------------------------------------------------------ helpers

function normalise(x, y) {
  const len = Math.hypot(x, y);
  if (len <= 1e-4) return { x: 0, y: 0 };
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/**
 * Where along a step a bullet meets a circle, as 0..1, or null.
 *
 * A rifle round covers 28 px in a frame and a guard is 30 px across, so a
 * point test misses him about as often as it finds him. This is the sweep.
 */
export function segHit(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 1e-9 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r ? t : null;
}
