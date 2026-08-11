// The player's skier: downhill physics, jumps, air tricks, crashes and the
// state machine the HUD and the audio consume.

import * as THREE from 'three';
import { createSkier } from './skierModel.js';
import { input, consumeJump } from '../input.js';
import {
  PLAYER, groundHeight, groundNormal, clamp, lerp, damp,
} from '../config.js';

const TWO_PI = Math.PI * 2;

/** Surface height with the ramps taken into account. */
export function surfaceHeight(x, z, ramps) {
  let h = groundHeight(x, z);
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    const dx = x - r.x, dz = z - r.z;
    if (dx > -r.w * 0.5 && dx < r.w * 0.5 && dz > 0 && dz < r.len) {
      const t = dz / r.len;
      const rh = r.y + Math.pow(t, 1.9) * r.h;
      if (rh > h) h = rh;
    }
  }
  return h;
}

export function createPlayer(parent) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  parent.add(root);

  const trickPivot = new THREE.Group();
  trickPivot.rotation.order = 'YXZ';
  trickPivot.position.y = 0.9;
  root.add(trickPivot);

  const model = createSkier({});
  model.group.position.y = -0.9;
  trickPivot.add(model.group);

  const s = {
    x: 0, z: 0, y: 0,
    speed: 0, heading: 0,
    vy: 0, airborne: false, airTime: 0,
    groundY: 0, lastGroundY: 0, vyGround: 0,
    crashed: 0, crashCooldown: 0,
    spin: 0, flip: 0, trickValue: 0, trickNames: [],
    crouch: 0.25, lean: 0, pitch: 0,
    travel: 0, maxSpeed: 0, airMax: 0,
    invuln: 0,
  };

  const nrm = new THREE.Vector3();
  const events = [];

  function reset(startX = 0) {
    s.x = startX; s.z = 0;
    s.groundY = groundHeight(s.x, s.z);
    s.lastGroundY = s.groundY;
    s.y = s.groundY;
    s.speed = 6; s.heading = 0;
    s.vy = 0; s.airborne = false; s.airTime = 0;
    s.crashed = 0; s.crashCooldown = 0;
    s.spin = 0; s.flip = 0; s.trickValue = 0; s.trickNames.length = 0;
    s.crouch = 0.25; s.lean = 0; s.pitch = 0;
    s.travel = 0; s.maxSpeed = 0; s.airMax = 0;
    s.invuln = 1.2;
    trickPivot.rotation.set(0, 0, 0);
    root.position.set(s.x, s.y, s.z);
    root.rotation.set(0, 0, 0);
    events.length = 0;
  }

  function crash(reason) {
    if (s.crashed > 0 || s.invuln > 0) return false;
    s.crashed = PLAYER.crashTime;
    s.speed *= 0.16;
    s.airborne = false;
    s.vy = 0;
    s.spin = s.flip = 0;
    s.trickValue = 0;
    s.trickNames.length = 0;
    events.push({ type: 'crash', reason, x: s.x, y: s.groundY, z: s.z });
    return true;
  }

  function takeOff(vy, source) {
    s.airborne = true;
    s.vy = vy;
    s.airTime = 0;
    s.spin = 0;
    s.flip = 0;
    s.trickValue = 0;
    s.trickNames.length = 0;
    events.push({ type: 'takeoff', power: vy, source, x: s.x, y: s.y, z: s.z });
  }

  function land() {
    const cleanSpin = Math.abs(((s.spin % TWO_PI) + TWO_PI + Math.PI) % TWO_PI - Math.PI);
    const cleanFlip = Math.abs(((s.flip % TWO_PI) + TWO_PI + Math.PI) % TWO_PI - Math.PI);
    const clean = cleanSpin < 1.05 && cleanFlip < 0.95;

    const spins = Math.round(Math.abs(s.spin) / TWO_PI);
    const flips = Math.round(Math.abs(s.flip) / TWO_PI);
    const airBonus = Math.floor(s.airTime * 40);

    s.airborne = false;
    s.vy = 0;

    if (!clean && (spins > 0 || flips > 0 || s.airTime > 0.55)) {
      // spun too far and didn't close it: down you go
      s.spin = s.flip = 0;
      crash('landing');
      return;
    }

    // The trick comes out as numbers, not as a phrase. Physics has no business
    // knowing which language the player picked — game.js turns `spins` and
    // `flips` into words at the moment it draws them.
    let score = airBonus;
    if (spins > 0) score += spins * 180;
    if (flips > 0) score += flips * 260;
    const trick = { spins, flips, longAir: s.airTime > 1.1 };

    s.spin = s.flip = 0;
    trickPivot.rotation.set(0, 0, 0);

    events.push({
      type: 'land', clean, score, trick, airTime: s.airTime,
      x: s.x, y: s.groundY, z: s.z,
    });
    s.airTime = 0;
  }

  /**
   * @param {number} dt
   * @param {object} world  { ramps, colliders }
   * @returns {Array} the frame's events
   */
  function update(dt, world) {
    events.length = 0;
    const ramps = world.ramps || [];

    if (s.invuln > 0) s.invuln -= dt;
    if (s.crashCooldown > 0) s.crashCooldown -= dt;

    const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // ------------------------------------------------------ velocidade
    if (s.crashed > 0) {
      s.crashed -= dt;
      s.speed = damp(s.speed, 0.8, 4.5, dt);
      if (s.crashed <= 0) {
        s.crashed = 0;
        s.crashCooldown = 0.6;
        s.invuln = 0.5;
        s.speed = Math.max(s.speed, 4);
      }
    } else if (!s.airborne) {
      // handling drops a little at high speed
      const agility = lerp(1.25, 0.72, clamp(s.speed / PLAYER.maxSpeed, 0, 1));
      s.heading += turn * PLAYER.turnRate * agility * dt;
      s.heading = clamp(s.heading, -PLAYER.maxTurn, PLAYER.maxTurn);

      const dh = Math.cos(s.heading);
      const across = Math.abs(Math.sin(s.heading));

      let a = PLAYER.accel * dh;
      a -= PLAYER.edgeDrag * s.speed * across;      // carving segura
      a -= PLAYER.drag * s.speed * s.speed;

      const tucking = input.up && !input.down;
      if (tucking) a += 4.5;
      if (input.down) a -= PLAYER.brakeDecel * clamp(s.speed / 6, 0.3, 1);

      s.speed += a * dt;
      const cap = PLAYER.maxSpeed * (tucking ? PLAYER.tuckBonus : 1);
      s.speed = clamp(s.speed, 0, cap);

      // a jump of your own doing
      if (consumeJump() && s.speed > 2) {
        takeOff(PLAYER.jumpImpulse * lerp(0.62, 1, clamp(s.speed / 20, 0, 1)), 'hop');
      }
    } else {
      // ----------------------------------------------------- in the air
      s.airTime += dt;
      s.spin += turn * PLAYER.spinRate * dt;
      const flipIn = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      s.flip += flipIn * PLAYER.flipRate * dt;
      s.heading += turn * 0.35 * dt;
      s.speed -= PLAYER.drag * s.speed * s.speed * 0.4 * dt;
      consumeJump();
    }

    // ----------------------------------------------------- deslocamento
    const dirX = Math.sin(s.heading);
    const dirZ = Math.cos(s.heading);
    s.x += dirX * s.speed * dt;
    s.z += dirZ * s.speed * dt;
    s.travel = Math.max(s.travel, s.z);
    if (s.speed > s.maxSpeed) s.maxSpeed = s.speed;

    // -------------------------------------------------------- vertical
    s.lastGroundY = s.groundY;
    s.groundY = surfaceHeight(s.x, s.z, ramps);
    const vyGroundRaw = dt > 0 ? (s.groundY - s.lastGroundY) / dt : 0;
    s.vyGround = damp(s.vyGround, vyGroundRaw, 18, dt);

    if (s.airborne) {
      s.vy -= PLAYER.gravity * dt;
      s.y += s.vy * dt;
      if (s.y <= s.groundY) {
        s.y = s.groundY;
        land();
      }
      s.airMax = Math.max(s.airMax, s.y - groundHeight(s.x, s.z));
    } else {
      s.y = s.groundY;
      // a natural take-off: does the ballistic arc clear the terrain?
      if (s.crashed <= 0 && s.speed > 7) {
        const T = 0.14;
        const ax = s.x + dirX * s.speed * T;
        const az = s.z + dirZ * s.speed * T;
        const yAhead = surfaceHeight(ax, az, ramps);
        const yBallistic = s.y + s.vyGround * T - 0.5 * PLAYER.gravity * T * T;
        if (yBallistic > yAhead + 0.16) {
          const boost = clamp(-s.vyGround * 0.55, 0, 9);
          takeOff(Math.max(0.9, boost), 'terrain');
        }
      }
    }

    // ------------------------------------------------------- collisions
    const colliders = world.colliders || [];
    if (s.crashed <= 0 && s.invuln <= 0) {
      const air = s.y - groundHeight(s.x, s.z);
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const dx = c.x - s.x, dz = c.z - s.z;
        const rr = c.r + PLAYER.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 > rr * rr) continue;
        if (air > (c.h ?? colliderHeight(c))) continue;      // cleared it
        if (crash(c.type)) {
          // push out of the obstacle: without this the figure falls inside it
          const d = Math.sqrt(d2) || 0.001;
          const push = rr - d + 0.05;
          s.x -= (dx / d) * push;
          s.z -= (dz / d) * push;
          s.y = s.groundY = surfaceHeight(s.x, s.z, ramps);
          events.push({ type: 'hit', collider: c });
          break;
        }
      }
    }

    // --------------------------------------------------------- postura
    const speedN = clamp(s.speed / PLAYER.maxSpeed, 0, 1);
    const targetCrouch = s.crashed > 0 ? 0.7
      : s.airborne ? 0.42
      : input.up ? 0.92
      : input.down ? 0.60
      : 0.16 + speedN * 0.30;
    s.crouch = damp(s.crouch, targetCrouch, 9, dt);

    const targetLean = s.crashed > 0 ? 0 : -turn * 0.42 * clamp(0.35 + speedN, 0, 1);
    s.lean = damp(s.lean, targetLean, 7, dt);

    // tilt to follow the terrain
    groundNormal(s.x, s.z, nrm);
    const terrainPitch = Math.atan2(-nrm.z, nrm.y);
    s.pitch = damp(s.pitch, s.airborne ? terrainPitch * 0.3 : terrainPitch, 8, dt);

    root.position.set(s.x, s.y, s.z);
    root.rotation.y = s.heading;
    root.rotation.x = s.pitch;
    trickPivot.rotation.y = s.spin;
    trickPivot.rotation.x = s.flip;

    model.pose({
      crouch: s.crouch,
      lean: s.lean,
      pitch: s.airborne ? -0.12 : 0,
      t: performance.now() * 0.001,
      speed: speedN,
      airborne: s.airborne,
      crashed: s.crashed > 0 ? clamp(s.crashed / PLAYER.crashTime, 0, 1) : 0,
    });

    return events;
  }

  return {
    state: s, root, model, update, reset, crash,
    get position() { return root.position; },
  };
}

/** Effective height of each obstacle type — decides what can be jumped. */
export function colliderHeight(c) {
  switch (c.type) {
    case 'tree': return 99;
    case 'tower': return 99;
    case 'chalet': return 99;
    case 'rock': return c.r * 1.35 + 0.3;
    case 'stump': return 1.15;
    case 'sign': return 2.3;
    case 'skier': case 'boarder': return 1.7;
    case 'dog': return 0.75;
    default: return 2;
  }
}
