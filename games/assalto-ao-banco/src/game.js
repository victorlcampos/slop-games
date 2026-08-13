// One floor, from the front door to the vault.
//
// Everything the player can do to the building is here, and everything the
// building can do back. It knows nothing about canvases: the tests drive this
// module directly, at a fixed step, with no browser anywhere.

import {
  PLAYER, GUARD, CAMERA, VAULT, ROLL, PICKUP, ASSIST, HIT_R, TILE,
  clamp, dist, dist2, makeRng, turnTowards, angleDelta, RAD,
} from './config.js';
import { moveCircle, flowField, castRay, lineOfSight } from './grid.js';
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
    roll: 0,                      // seconds left in the roll
    rollA: 0,
    rollCool: 0,
    speed: 0,                     // how fast he actually moved last step
    combat: 0,                    // seconds the body keeps facing the fight
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
    aimTarget: null,              // the man the gun has found inside where you pointed
    autoTarget: null,             // the threat a bare trigger has locked onto
    focus: null,                  // what he is standing on, and how far the ring has filled
    prompt: null,                 // the body under his feet, if there is one
    useWas: false,
    rollWas: false,

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
        // Started inside the body, not clear of it. A round that appears a full
        // radius ahead of the muzzle is already past anybody standing closer
        // than that, so every point-blank shot missed — and nothing can hit the
        // shooter, because a bullet's targets never include its own side.
        x: from.x + Math.cos(a) * 8,
        y: from.y + Math.sin(a) * 8,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        dmg: damageOverride ?? w.damage,
        tranq: !!w.tranq,
        stagger: w.stagger || 0,
        pierce: side === 'player' ? (w.pierce || 0) : 0,
        hit: null,                     // who it has already gone through
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
        if (b.hit && b.hit.includes(t)) continue;    // already gone through him
        const r = t === player || t.hp !== undefined ? HIT_R : 16;
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
        // a rifle round goes through the first man to reach the second; a
        // pistol round stops in him
        if (b.pierce > 0 && hit.route) {
          b.pierce--;
          b.hit = [...(b.hit || []), hit];
          b.dmg *= 0.8;                              // and arrives a little tired
        } else {
          bullets.splice(i, 1);
          continue;
        }
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
      // a dart does not argue with how much is left in him
      if (b.tranq) {
        fx.spark(b.x, b.y, '#8fd07a', 6, 160);
        killGuard(target, 'tranq');
        return;
      }
      target.hp -= b.dmg;
      target.alert = 1;
      fx.blood(b.x, b.y);
      // a hit that lands hard enough knocks him off his aim: he has to start
      // lining you up again, which is what a shotgun is *for*
      if (b.stagger) {
        target.aim = -b.stagger;
        target.cool = Math.max(target.cool, b.stagger * 0.5);
      }
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

  function killGuard(g, how = 'shot') {
    g.dead = true;
    stats.kills++;
    if (how !== 'tranq') fx.blood(g.x, g.y, 14);
    const body = { x: g.x, y: g.y, a: g.facing, seen: 0, gun: g.gun, id: g.id, tranq: how === 'tranq' };
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
    player.rollCool = Math.max(0, player.rollCool - dt);

    // ---- the roll. Faster than he can walk, and heard across two rooms.
    const rollPressed = !!input.roll && !game.rollWas;
    game.rollWas = !!input.roll;
    if (rollPressed && player.roll <= 0 && player.rollCool <= 0) {
      player.roll = ROLL.time;
      player.rollCool = ROLL.cool + ROLL.time;
      player.rollA = want.x || want.y ? Math.atan2(want.y, want.x) : player.facing;
      player.dragging = null;                 // nobody rolls holding a body
      game.makeNoise(player.x, player.y, ROLL.noise, 'roll');
      game.onRoll?.();
    }

    player.sneaking = !!input.sneak && player.roll <= 0;
    // A heavy gun costs you your feet while it is firing. It is the price the
    // machine gun and the sniper rifle pay for what they do, and it is what
    // stops "the best gun" from also being the most mobile one.
    const heavy = WEAPONS[player.weapon.id].heavy;
    const braced = heavy && player.weapon.cool > 0 ? heavy : 1;
    const top = (player.sneaking ? PLAYER.sneak : PLAYER.speed)
      * (player.dragging ? PLAYER.dragging : 1) * braced;

    if (player.roll > 0) {
      player.roll -= dt;
      // the roll owns the movement while it lasts: steering out of it would
      // make it a speed button rather than a commitment
      player.vx = Math.cos(player.rollA) * PLAYER.speed * ROLL.speed;
      player.vy = Math.sin(player.rollA) * PLAYER.speed * ROLL.speed;
    } else {
      const ax = want.x * top;
      const ay = want.y * top;
      const rate = want.x || want.y ? PLAYER.accel : PLAYER.friction;
      player.vx += clamp(ax - player.vx, -rate * dt, rate * dt);
      player.vy += clamp(ay - player.vy, -rate * dt, rate * dt);
    }

    const moved = moveCircle(grid, player.x, player.y, PLAYER.r, player.vx * dt, player.vy * dt);
    const realDx = moved.x - player.x;
    const realDy = moved.y - player.y;
    player.x = moved.x;
    player.y = moved.y;

    // Footsteps. Sneaking makes none, which is the whole of the stealth budget:
    // you are either fast or quiet.
    const travelled = Math.hypot(realDx, realDy);
    player.speed = dt > 0 ? travelled / dt : 0;
    if (!player.sneaking && travelled > 0.4) {
      player.step += travelled;
      if (player.step > 150) {
        player.step = 0;
        game.makeNoise(player.x, player.y, PLAYER.noiseWalk, 'step');
      }
    }

    // Where he is looking: the aim if there is one, the trigger if it is asking
    // for a target, the direction of travel if neither. A bare trigger — a tap
    // with no drag, the normal shot on a phone — does not fire "wherever he
    // happens to be facing": it turns him onto the nearest threat he can see,
    // all the way round. That is the whole of walking backwards and shooting:
    // flee with one thumb, tap with the other, and the gun does the geometry.
    let want2 = null;
    let pointed = false;
    if (input.aim) {
      want2 = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
      pointed = true;
      game.autoTarget = null;
    } else if (typeof input.aimAngle === 'number') {
      want2 = input.aimAngle;
      pointed = true;
      game.autoTarget = null;
    } else if (input.autoAim) {
      // sticky: the lock holds while the target stays alive and in sight, so a
      // burst does not hop between men mid-stream
      if (!threatVisible(game, game.autoTarget)) game.autoTarget = nearestThreat(game);
      const lock = game.autoTarget;
      want2 = lock ? Math.atan2(lock.y - player.y, lock.x - player.x) : player.facing;
      pointed = true;
    } else {
      game.autoTarget = null;
      // while the fight is fresh the body keeps facing it — backing away does
      // not swing the torch (and the gun) round to where his feet point
      if (travelled > 0.2 && player.combat <= 0) want2 = Math.atan2(realDy, realDx);
    }
    player.combat = pointed ? PLAYER.combatHold : Math.max(0, player.combat - dt);

    // the gun finds the man inside where you pointed it
    game.aimTarget = null;
    if (pointed && player.roll <= 0) {
      if (game.autoTarget) {
        game.aimTarget = game.autoTarget;
      } else {
        const found = assistedAim(game, want2);
        want2 = found.angle;
        game.aimTarget = found.target;
      }
    }
    if (want2 !== null) player.facing = turnTowards(player.facing, want2, PLAYER.turn * dt);

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

  /**
   * The nearest thing he is standing on that is worth standing on. Nothing here
   * has a key of its own: this is the vault's mechanism, scaled down.
   */
  function findFocus() {
    const near = (o) => dist(o.x, o.y, player.x, player.y) <= PLAYER.reach;
    let best = null;
    let bestD = Infinity;
    const offer = (target, kind, need) => {
      const d = dist(target.x, target.y, player.x, player.y);
      if (d < bestD) {
        bestD = d;
        best = { target, kind, need };
      }
    };

    for (const it of game.items) {
      if (it.taken || !near(it)) continue;
      if (it.armAt && stats.time < it.armAt) continue;   // the gun he has just put down
      offer(it, it.kind, it.kind === 'gun' ? PICKUP.gun : it.kind === 'medkit' ? PICKUP.medkit : PICKUP.loot);
    }
    // A panel already ringing is not worth pulling, and skipping it here is
    // also what stops the ring refilling on the panel he is standing on.
    if (!alarm.on) {
      for (const a of game.alarms) {
        if (a.dead || !near(a)) continue;
        offer(a, 'alarm', PICKUP.alarm);
      }
    }
    return best;
  }

  function updateFocus(dt) {
    const found = findFocus();
    if (!found) {
      game.focus = null;
      return;
    }
    // keep the ring where it was if it is the same thing, restart if it is not
    const t = game.focus && game.focus.target === found.target ? game.focus.t : 0;
    const still = player.speed <= PICKUP.stillSpeed;
    game.focus = { ...found, t: clamp(still ? t + dt : t - dt * 1.6, 0, found.need) };
    if (game.focus.t >= found.need) {
      take(found);
      game.focus = null;
    }
  }

  function take({ target, kind }) {
    if (kind === 'alarm') {
      game.raiseAlarm(target, 'player');
      target.pulled++;
      return;
    }
    target.taken = true;
    if (kind === 'gun') {
      const old = player.weapon;
      // the same gun again is ammunition, not a swap — otherwise standing over
      // two dead men with pistols means putting a pistol down to pick a pistol up
      if (target.gun === old.id) {
        const mag = WEAPONS[old.id].mag;
        old.ammo = Number.isFinite(mag) ? Math.min(mag, old.ammo + target.ammo) : old.ammo;
        game.onPick?.(target);
        return;
      }
      player.weapon = { id: target.gun, ammo: target.ammo, cool: 0 };
      if (old.id !== 'silenced' && old.ammo > 0) {
        level.items.push({
          kind: 'gun', gun: old.id, ammo: old.ammo, x: player.x, y: player.y,
          taken: false, armAt: stats.time + PICKUP.armAfter,
        });
      }
    } else if (kind === 'medkit') {
      player.hp = Math.min(player.maxHp, player.hp + target.heal);
    } else {
      stats.money += target.value;
      stats.loot++;
    }
    game.onPick?.(target);
  }

  /** The one thing still on a key: a body will not pick itself up. */
  function findBody() {
    if (player.dragging) return { kind: 'drop' };
    const body = bodies.find((b) => dist(b.x, b.y, player.x, player.y) <= PLAYER.reach);
    return body ? { kind: 'carry', body } : null;
  }

  function doUse() {
    const p = game.prompt;
    if (!p) return;
    if (p.kind === 'drop') player.dragging = null;
    else if (p.kind === 'carry') player.dragging = p.body;
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
    game.prompt = findBody();
    if (pressed) doUse();
    updateFocus(dt);

    // With a target on the gun, the trigger waits for the body to finish the
    // turn: a burst that starts before he is round sprays the wall behind the
    // man. The test is lateral error, not degrees — thirteen degrees is nothing
    // at arm's length and half a corridor at range — so the gate is "would this
    // round actually land". Without a target it fires where he faces, as before.
    if (input.fire) {
      const t = game.aimTarget;
      let lined = true;
      if (t) {
        const off = Math.abs(angleDelta(player.facing, Math.atan2(t.y - player.y, t.x - player.x)));
        lined = off <= ASSIST.settle * RAD
          && Math.sin(off) * dist(player.x, player.y, t.x, t.y) <= HIT_R * 0.85;
      }
      if (lined) playerFires();
    }

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
    rolling: player.roll > 0,
    focus: game.focus ? `${game.focus.kind} ${(game.focus.t / game.focus.need * 100) | 0}%` : null,
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

/** Alive, inside the torch, and with a clear line — the bar every lock obeys. */
function threatVisible(game, t) {
  if (!t || t.dead) return false;
  const p = game.player;
  const reach = Math.min(WEAPONS[p.weapon.id].range, PLAYER.sight);
  if (dist(p.x, p.y, t.x, t.y) > reach) return false;
  return lineOfSight(game.grid, p.x, p.y, t.x, t.y);
}

/**
 * The threat a bare trigger should mean, searched all the way round.
 *
 * Guards first, by distance — a man shooting at you outranks any camera — and
 * only then the devices. It obeys the same two laws as the assist: never
 * beyond what the torch reaches, never through a wall. A tap in an empty room
 * still fires straight ahead; the gun helps, it does not refuse.
 */
export function nearestThreat(game) {
  const p = game.player;
  const reach = Math.min(WEAPONS[p.weapon.id].range, PLAYER.sight);
  const nearest = (list) => {
    const close = list
      .filter((t) => !t.dead && dist(p.x, p.y, t.x, t.y) <= reach)
      .sort((a, b) => dist2(p.x, p.y, a.x, a.y) - dist2(p.x, p.y, b.x, b.y));
    // sorted first, line-of-sight after: the ray is the expensive half
    return close.find((t) => lineOfSight(game.grid, p.x, p.y, t.x, t.y)) || null;
  };
  return nearest(game.guards) || nearest([...game.cameras, ...game.alarms]);
}

/**
 * The man you are pointing at, if you are pointing near one.
 *
 * A lateral tolerance *and* an angular one, because either alone is wrong at
 * one end of the range: sixty pixels off the line of fire is generous at arm's
 * length and invisible across a hall, and seventeen degrees is the reverse.
 * Whichever forgives more, wins — and then the closest to where you actually
 * pointed wins among those.
 *
 * Never further than you can see and never through a wall: a gun that swings
 * onto somebody invisible would hand away the dark, which is the whole game.
 */
export function assistedAim(game, raw) {
  const p = game.player;
  const w = WEAPONS[p.weapon.id];
  const reach = Math.min(w.range, PLAYER.sight);
  const limit = ASSIST.limit * RAD;
  let best = null;
  let bestScore = Infinity;

  // Cameras and panels are on the list too — a thumb cannot hit a box the size
  // of a hand any better than it can hit a man — but they carry a handicap, so
  // a guard near the same line always wins the gun.
  const consider = (t, bias) => {
    if (t.dead) return;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > reach || d < 1) return;
    const off = Math.abs(angleDelta(raw, Math.atan2(t.y - p.y, t.x - p.x)));
    const score = off + bias;
    if (off > limit || score >= bestScore) return;
    if (off > ASSIST.cone * RAD && d * Math.sin(off) > ASSIST.radius) return;
    if (!lineOfSight(game.grid, p.x, p.y, t.x, t.y)) return;
    bestScore = score;
    best = t;
  };

  for (const g of game.guards) consider(g, 0);
  const bias = ASSIST.deviceBias * RAD;
  for (const c of game.cameras) consider(c, bias);
  for (const a of game.alarms) consider(a, bias);

  return best
    ? { angle: Math.atan2(best.y - p.y, best.x - p.x), target: best }
    : { angle: raw, target: null };
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
