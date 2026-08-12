// The run itself: the freighter overhead, the cargo coming down, the soldier
// under it. No canvas is touched here — everything in this file is arithmetic,
// which is what lets the tests play whole minutes of it in Node.

import { CARGO, GRAVITY, PLAYER, clamp, makeRng, pressureAt } from './config.js';
import { createWorld, surfaceAt } from './world.js';
import { createSoldier, stepSoldier, aimAt, muzzleOf, hurt, heal, heightOf } from './player.js';
import { OBJECT_BY_ID, rollObject, spawnObject } from './objects.js';
import { WEAPON_BY_ID, PRIMARY, rollWeapon, loadout } from './weapons.js';
import { fire, updateShots } from './shots.js';
import { silentFx } from './fx.js';

/** The saucer that does the dropping — not in the manifest, it IS the manifest. */
const UFO = {
  id: 'ufo', hp: 14, r: 40, mass: 0, drag: 0, land: 'break', solid: false,
  contact: 0, drops: 0.5, score: 300, weight: 0, circuit: true, ufo: true,
  name: { pt: 'Disco de carga', en: 'Cargo saucer' },
};

export function createGame(options = {}) {
  const fx = options.fx || silentFx();
  const seed = options.seed || 20260812;
  const rng = makeRng(seed);
  const world = createWorld(seed);
  const soldier = createSoldier(160);
  soldier.y = world.groundAt(soldier.x);

  const objects = [];
  const shots = [];
  const pickups = [];
  const hazards = [];        // puddles, fire, anything left on the road

  const state = {
    phase: 'playing',        // playing | over
    time: 0,
    score: 0,
    killed: 0,
    dropIn: CARGO.first,
    weapon: loadout(PRIMARY),
    cool: 0,
    target: null,
    best: null,
    shake: 0,
    lastPickup: null,
    lastPickupT: 0,
  };

  const ctx = {
    world, objects, shots, fx, rand: rng,
    damage: (o, amount, shot) => damage(o, amount, shot),
    boom: (x, y, r, dmg, shot) => boom(x, y, r, dmg, shot),
  };

  // ------------------------------------------------------------------ cargo

  function spawnDrop() {
    const pressure = pressureAt(state.time);
    const ahead = 260 + rng() * 520;
    const x = soldier.x + (rng() < 0.78 ? ahead : -ahead * 0.5);
    // the saucer comes in first and lets go of the cargo a moment later
    const ufo = spawnObject(UFO, x, 70 + rng() * 60);
    ufo.vx = (rng() < 0.5 ? -1 : 1) * (70 + rng() * 90);
    ufo.carry = rollObject(rng, pressure);
    ufo.dropIn = 0.5 + rng() * 0.7;
    ufo.leaveIn = 6 + rng() * 4;
    objects.push(ufo);
  }

  function release(ufo) {
    const def = ufo.carry;
    const o = spawnObject(def, ufo.x, ufo.y + 30, ufo.vx * 0.4, def.fast ? 420 : 40);
    objects.push(o);
    ufo.carry = null;
    fx.smoke(ufo.x, ufo.y + 20, 3);
  }

  // ------------------------------------------------------------- the damage

  function damage(o, amount, shot) {
    if (o.dead) return;
    const effect = shot && shot.effect;
    if (effect === 'freeze') o.frozen = Math.max(o.frozen, 3.5);
    if (effect === 'burn') o.burning = Math.max(o.burning, 2.2);
    if (effect === 'acid') o.acid = Math.max(o.acid, 3);
    if (effect === 'nail') o.pinned = Math.max(o.pinned, 0.45);
    if (effect === 'emp' && o.def.circuit) amount = o.maxHp * 99;
    o.hp -= amount;
    o.hit = 0.12;
    fx.spark(o.x, o.y, shot ? shot.colour : '#ffd88a', 3, 180);
    if (o.hp <= 0) destroy(o, shot);
  }

  function destroy(o, shot) {
    if (o.dead) return;
    o.dead = true;
    state.killed++;
    const points = Math.round(o.def.score * (o.landed ? 0.4 : 1));
    state.score += points;
    fx.float(o.x, o.y - o.r, '+' + points);
    fx.spark(o.x, o.y, '#ffd0a0', 12, 320);
    fx.smoke(o.x, o.y, 4);

    if (o.def.blast) boom(o.x, o.y, o.def.blast, 12, { fromCargo: true, dmg: o.def.blastDmg || 1 });
    if (o.def.fire) hazards.push({ kind: 'fire', x: o.x, y: surfaceAt(world, o.x, o.y), r: 46, t: 6 });
    if (o.def.splits) {
      const kid = OBJECT_BY_ID[o.def.splits.into] || UFO;
      for (let i = 0; i < o.def.splits.n; i++) {
        const a = -Math.PI / 2 + (i - (o.def.splits.n - 1) / 2) * 0.7;
        objects.push(spawnObject(kid, o.x, o.y, Math.cos(a) * 190, Math.sin(a) * 130));
      }
    }
    rollDrop(o);
  }

  function rollDrop(o) {
    const luck = pressureAt(state.time);
    if (o.def.alwaysWeapon || rng() < o.def.drops) {
      const medic = o.def.medic || 0.14;
      if (!o.def.alwaysWeapon && rng() < medic && soldier.lives < PLAYER.lives) {
        pickups.push(makePickup('medkit', o.x, o.y));
        return;
      }
      const weapon = rollWeapon(rng, luck);
      pickups.push(makePickup('weapon', o.x, o.y, weapon.id));
    }
  }

  function makePickup(kind, x, y, weapon = null) {
    return { kind, weapon, x, y, vx: (rng() - 0.5) * 90, vy: -180, landed: false, t: 26 };
  }

  function boom(x, y, r, dmg, shot) {
    fx.ring(x, y, r);
    fx.smoke(x, y, 5);
    state.shake = Math.max(state.shake, Math.min(1, r / 200));
    for (const o of objects) {
      if (o.dead) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d > r + o.r) continue;
      const falloff = 1 - clamp((d - o.r) / r, 0, 1);
      damage(o, Math.max(1, Math.round(dmg * falloff)), shot && shot.fromCargo ? null : shot);
    }
    const dp = Math.hypot(soldier.x - x, soldier.y - heightOf(soldier) / 2 - y);
    if (dp < r * 0.8) hurt(soldier, (shot && shot.dmg) || 1);
  }

  // ------------------------------------------------------------- one object

  function stepObject(o, dt) {
    o.age += dt;
    if (o.hit > 0) o.hit -= dt;

    if (o.def.ufo) return stepUfo(o, dt);

    if (o.burning > 0) { o.burning -= dt; if (o.age % 0.4 < dt) damage(o, 1, null); }
    if (o.acid > 0) { o.acid -= dt; if (o.age % 0.5 < dt) damage(o, 1, null); }
    if (o.dead) return;

    if (o.pinned > 0) { o.pinned -= dt; o.vx = 0; o.vy = 0; return; }

    if (!o.landed) {
      const frozen = o.frozen > 0;
      const drag = frozen ? 0 : o.def.drag;
      const mass = o.def.mass || 1;
      if (o.def.hover && !frozen) {
        o.vy += GRAVITY * 0.08 * dt;
        o.vy = Math.min(o.vy, 90);
        o.vx += Math.sign(soldier.x - o.x) * 40 * dt;
        if (o.def.shoots) {
          o.shootIn -= dt;
          if (o.shootIn <= 0) {
            o.shootIn = o.def.shoots;
            const a = Math.atan2(soldier.y - heightOf(soldier) / 2 - o.y, soldier.x - o.x);
            hazards.push({ kind: 'bolt', x: o.x, y: o.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 7, t: 3 });
          }
        }
      } else {
        o.vy += GRAVITY * (frozen ? 1.4 : mass * 0.55) * dt;
        o.vy = Math.min(o.vy, CARGO.terminal * (frozen ? 1.6 : 1) * (1 - drag * 0.85));
      }
      if (o.frozen > 0) o.frozen -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.spin += o.spinRate * dt * (o.def.land === 'roll' ? 2 : 0.6);

      const floor = surfaceAt(world, o.x, o.y) - o.r;
      if (o.y >= floor) {
        o.y = floor;
        land(o);
      }
      return;
    }

    // already on the road
    if (o.def.land === 'roll') {
      o.vx += Math.sign(soldier.x - o.x) * 60 * dt;
      o.vx = clamp(o.vx, -260, 260);
      o.x += o.vx * dt;
      o.spin += o.vx * dt * 0.02;
      o.y = surfaceAt(world, o.x, o.y) - o.r;
    } else if (o.def.land === 'bounce' && Math.abs(o.vy) > 20) {
      o.vy += GRAVITY * 0.7 * dt;
      o.y += o.vy * dt;
      o.x += o.vx * dt;
      const floor = surfaceAt(world, o.x, o.y) - o.r;
      if (o.y >= floor) {
        o.y = floor;
        o.vy = -Math.abs(o.vy) * (o.def.bounce || 0.6);
        o.vx *= 0.9;
        if (Math.abs(o.vy) < 90) o.vy = 0;
        fx.spark(o.x, o.y + o.r, '#a08a6a', 3, 120);
      }
    }
  }

  function land(o) {
    const frozen = o.frozen > 0;
    o.landed = true;
    o.vy = frozen ? 0 : o.vy;
    fx.smoke(o.x, o.y + o.r * 0.6, 3);
    state.shake = Math.max(state.shake, Math.min(0.7, (o.def.mass || 1) * 0.22));

    if (frozen) { destroy(o, null); return; }          // frozen cargo shatters

    switch (o.def.land) {
      case 'break':
        destroy(o, null);
        break;
      case 'explode':
        destroy(o, null);
        break;
      case 'bounce':
        o.vy = -Math.abs(o.vy) * (o.def.bounce || 0.6);
        break;
      case 'stick':
        o.vx = 0;
        if (o.def.puddle) hazards.push({ kind: 'slime', x: o.x, y: o.y + o.r * 0.7, r: o.r, t: 14 });
        break;
      case 'roll':
        o.vx = (o.vx || 0) + (soldier.x > o.x ? 90 : -90);
        break;
      case 'settle':
      default:
        o.vx = 0;
        // under a cave there is no room for it to stand, and a safe wedged in
        // there would seal the road for a soldier who cannot jump
        if (o.def.solid && world.ceilingAt(o.x) > -Infinity) { destroy(o, null); break; }
        if (o.def.solid) {
          // from here on it is part of the road: you can stand on it
          const w = o.r * 1.8;
          const h = o.def.low ? o.r * 0.9 : o.r * 1.7;
          o.prop = world.addProp({
            kind: o.def.id, x: o.x - w / 2, y: o.y + o.r - h, w, h, cargo: o,
          });
        }
        break;
    }
  }

  function stepUfo(o, dt) {
    o.x += o.vx * dt;
    o.y += Math.sin(o.age * 2) * 12 * dt;
    if (o.carry) {
      o.dropIn -= dt;
      if (o.dropIn <= 0) release(o);
    }
    o.leaveIn -= dt;
    if (o.leaveIn <= 0) {
      o.vy = -90;
      o.y += o.vy * dt;
      if (o.y < -120) o.dead = true;
    }
  }

  // -------------------------------------------------------------- the road

  function stepHazards(dt) {
    for (const h of hazards) {
      h.t -= dt;
      if (h.kind === 'bolt') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (h.y >= surfaceAt(world, h.x, h.y)) { h.t = 0; fx.spark(h.x, h.y, '#b9f', 4); }
      }
      const dx = Math.abs(h.x - soldier.x);
      const dy = Math.abs(h.y - (soldier.y - heightOf(soldier) / 2));
      if (dx < h.r + PLAYER.w / 2 && dy < h.r + heightOf(soldier) / 2) {
        if (hurt(soldier, 1)) fx.spark(soldier.x, soldier.y - 40, '#e2593f', 8);
        if (h.kind === 'bolt') h.t = 0;
      }
    }
    let w = 0;
    for (let i = 0; i < hazards.length; i++) if (hazards[i].t > 0) hazards[w++] = hazards[i];
    hazards.length = w;
  }

  function stepPickups(dt) {
    for (const p of pickups) {
      p.t -= dt;
      if (!p.landed) {
        p.vy += GRAVITY * 0.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const floor = surfaceAt(world, p.x, p.y) - 14;
        if (p.y >= floor) { p.y = floor; p.landed = true; p.vx = 0; p.vy = 0; }
      }
      const dx = Math.abs(p.x - soldier.x);
      const dy = Math.abs(p.y - (soldier.y - heightOf(soldier) / 2));
      if (dx < 40 && dy < 60 && !soldier.dead) take(p);
    }
    let w = 0;
    for (let i = 0; i < pickups.length; i++) if (pickups[i].t > 0) pickups[w++] = pickups[i];
    pickups.length = w;
  }

  function take(p) {
    p.t = 0;
    if (p.kind === 'medkit') {
      if (heal(soldier, 1)) {
        fx.float(soldier.x, soldier.y - 90, '+1', '#8fd07a');
        state.lastPickup = { kind: 'medkit' };
      } else {
        state.score += 150;
        fx.float(soldier.x, soldier.y - 90, '+150');
      }
    } else {
      const weapon = WEAPON_BY_ID[p.weapon] || PRIMARY;
      state.weapon = state.weapon.id === weapon.id
        ? { ...state.weapon, ammo: state.weapon.ammo + weapon.ammo }
        : loadout(weapon);
      state.lastPickup = { kind: 'weapon', id: weapon.id };
      fx.float(soldier.x, soldier.y - 96, weapon.id, '#ffd88a');
    }
    state.lastPickupT = state.time;
  }

  // ------------------------------------------------------------- the trigger

  function pullTrigger(dt, held) {
    const weapon = WEAPON_BY_ID[state.weapon.id];
    if (state.cool > 0) state.cool -= dt;
    if (weapon.spin) {
      state.weapon.spin = clamp(state.weapon.spin + (held ? dt : -dt * 2) / weapon.spin, 0, 1);
    }
    if (!held || soldier.dead) return false;
    if (state.cool > 0) return false;

    const rate = weapon.rate * (weapon.spin ? 1 + (1 - state.weapon.spin) * 2.2 : 1);
    state.cool = rate;
    fire(ctx, weapon, muzzleOf(soldier), soldier.aim);
    soldier.recoil = 1;
    soldier.muzzle = 0.06;
    if (state.weapon.ammo !== Infinity) {
      state.weapon.ammo -= 1;
      if (state.weapon.ammo <= 0) {
        state.weapon = loadout(PRIMARY);
        state.lastPickup = { kind: 'dry' };
        state.lastPickupT = state.time;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- the run

  function update(dt, input) {
    if (state.phase === 'over') return state;
    state.time += dt;

    world.ensure(soldier.x - 900, soldier.x + 2400);
    stepSoldier(soldier, dt, input, world);
    state.target = aimAt(soldier, objects, input);
    pullTrigger(dt, input.fire);

    state.dropIn -= dt;
    if (state.dropIn <= 0) {
      const p = pressureAt(state.time);
      state.dropIn = CARGO.gapStart + (CARGO.gapEnd - CARGO.gapStart) * p;
      spawnDrop();
    }

    for (const o of objects) stepObject(o, dt);
    updateShots(shots, dt, ctx);
    stepHazards(dt);
    stepPickups(dt);
    contact();

    // forget what is far behind: an endless road cannot keep everything
    let w = 0;
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      if (o.dead || o.x < soldier.x - 1800) continue;
      objects[w++] = o;
    }
    objects.length = w;

    fx.update(dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);

    if (soldier.dead && state.phase === 'playing') finish();
    return state;
  }

  /** Cargo touching the soldier — falling cargo hurts more than cargo at rest. */
  function contact() {
    if (soldier.dead || soldier.invuln > 0) return;
    const cy = soldier.y - heightOf(soldier) / 2;
    for (const o of objects) {
      if (o.dead || o.def.ufo) continue;
      const dx = Math.abs(o.x - soldier.x);
      const dy = Math.abs(o.y - cy);
      if (dx > o.r + PLAYER.w / 2 || dy > o.r + heightOf(soldier) / 2) continue;
      // a crate drifting past does not hurt: it is the weight coming down fast
      const falling = !o.landed && o.vy > 380;
      if (o.landed && !o.def.contact) continue;
      if (o.landed && o.def.solid) continue;               // you climb those, not die on them
      if (falling || o.def.contact) {
        if (hurt(soldier, falling ? o.def.contact || 1 : 1)) {
          fx.spark(soldier.x, cy, '#e2593f', 10, 300);
          state.shake = Math.max(state.shake, 0.6);
        }
      }
    }
  }

  function finish() {
    state.phase = 'over';
    state.best = { score: state.score, time: state.time };
    if (options.onOver) options.onOver({ score: state.score, time: state.time, killed: state.killed });
  }

  return {
    state, world, soldier, objects, shots, pickups, hazards, fx,
    update, damage, boom, spawnDrop,
    /** the gun as the HUD needs it */
    weapon: () => WEAPON_BY_ID[state.weapon.id],
    ammo: () => state.weapon.ammo,
  };
}
