// The soldier: run, jump, crouch, and the arm that decides where the shot goes.
//
// The aim is the one thing that is not a key. The threat comes from above and a
// phone has no second thumb for a reticle, so the gun looks after itself: it
// picks the nearest piece of cargo inside its range, favouring what is about to
// land on the soldier's head, and points there. Holding "up" overrides it and
// aims straight up — the one shot the auto-aim cannot guess.

import { GRAVITY, PLAYER, clamp } from './config.js';
import { surfaceAt } from './world.js';

export function createSoldier(x = 120) {
  return {
    x, y: 0, vx: 0, vy: 0,
    facing: 1,
    onGround: false,
    crouching: false,
    lives: PLAYER.lives,
    invuln: 0,
    aim: -Math.PI / 2,        // radians, screen space (-y is up)
    recoil: 0,
    step: 0,                  // run-cycle phase
    muzzle: 0,
    dead: false,
    blocked: false,
    coyote: 0,                // grace after leaving the ground
    buffered: 0,              // a jump asked for a moment too early
    heldJump: false,
    landed: 0,                // counts down after a landing, for the dust
  };
}

/** Head height right now — crouching is what gets you under an arch. */
export const heightOf = (s) => (s.crouching ? PLAYER.crouchH : PLAYER.h);

/**
 * One step of the soldier. `input` is { left, right, jump, down }, already
 * debounced by whoever is driving (keyboard or thumb).
 */
export function stepSoldier(s, dt, input, world) {
  const wants = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (wants) s.facing = wants;

  // crouching: asked for, or forced by a ceiling that is too low to stand under
  const roof = world.ceilingAt(s.x, s.y);
  const ground = surfaceAt(world, s.x, s.y);
  const headroom = ground - roof;
  const mustDuck = s.onGround && headroom < PLAYER.h;
  s.crouching = (input.down && s.onGround) || mustDuck;

  // Movement is a shove, not a switch: he leans into a run and slides a little
  // when he stops. A velocity assigned straight from the key made him feel like
  // a cursor — the difference between "moving" and "running" is all in here.
  const top = PLAYER.speed * (s.crouching ? 0.45 : 1) * (s.onGround ? 1 : PLAYER.air);
  const push = s.onGround ? PLAYER.accel : PLAYER.airAccel;
  if (wants) {
    s.vx += wants * push * dt;
    if (Math.abs(s.vx) > top) s.vx = wants * top;
  } else if (s.onGround) {
    const drop = PLAYER.friction * dt;
    s.vx = Math.abs(s.vx) <= drop ? 0 : s.vx - Math.sign(s.vx) * drop;
  }

  // coyote time and a jump buffer: the two things that separate a jump that
  // answers from a jump that argues
  if (s.onGround) s.coyote = PLAYER.coyote; else s.coyote = Math.max(0, s.coyote - dt);
  if (input.jump && !s.heldJump) s.buffered = PLAYER.buffer;
  else s.buffered = Math.max(0, s.buffered - dt);
  s.heldJump = !!input.jump;

  if (s.buffered > 0 && s.coyote > 0 && !mustDuck) {
    s.vy = -PLAYER.jump;
    s.onGround = false;
    s.coyote = 0;
    s.buffered = 0;
    s.jumping = true;
  }
  // a short tap is a short hop
  if (s.jumping && !input.jump && s.vy < -PLAYER.jump * PLAYER.cut) {
    s.vy = -PLAYER.jump * PLAYER.cut;
    s.jumping = false;
  }
  if (s.vy >= 0) s.jumping = false;

  s.vy += GRAVITY * dt;
  let nextX = s.x + s.vx * dt;

  // Walls: a rock you did not jump stops you where it starts. Anything low
  // enough is a step instead — an anvil that landed inside a cave, where nobody
  // can jump, would otherwise be the end of the run. Blocking clamps `nextX`
  // to the wall's face instead of freezing him where he stands, and a soldier
  // who somehow woke up INSIDE a box (a safe landing around him) is pushed out
  // through the nearest face — the old version left him wedged there for good.
  s.blocked = false;
  const half = PLAYER.w / 2;
  for (const solid of world.solidsNear(s.x, 200)) {
    const top = solid.y;
    const bottom = solid.y + solid.h;
    const feet = s.y;
    if (feet <= top + 6 || feet - heightOf(s) >= bottom) continue;   // above it or under it
    if (nextX + half <= solid.x || nextX - half >= solid.x + solid.w) continue;
    if (s.onGround && feet - top <= PLAYER.stepUp) { s.y = top; continue; }
    if (s.x + half <= solid.x + 1) {
      nextX = solid.x - half;                                 // walking into the left face
      s.blocked = true;
    } else if (s.x - half >= solid.x + solid.w - 1) {
      nextX = solid.x + solid.w + half;                       // into the right face
      s.blocked = true;
    } else {
      const throughLeft = s.x + half - solid.x;               // wedged: shortest way out
      const throughRight = solid.x + solid.w - (s.x - half);
      nextX = throughLeft <= throughRight ? solid.x - half : solid.x + solid.w + half;
      s.blocked = true;
    }
  }
  s.x = nextX;
  if (s.x < 40) s.x = 40;                                     // the road only goes one way

  s.y += s.vy * dt;

  // the floor: the road, the top of whatever landed there, or the arch's back
  const floor = surfaceAt(world, s.x, s.y - s.vy * dt);
  if (s.y >= floor) {
    if (!s.onGround && s.vy > 240) s.landed = 0.18;      // a landing worth a puff of dust
    s.y = floor;
    s.vy = 0;
    s.onGround = true;
  } else {
    s.onGround = false;
  }

  // a low ceiling in the air: bump the head instead of clipping through the rock
  const roofHere = world.ceilingAt(s.x, s.y);
  if (s.y - heightOf(s) < roofHere && s.vy < 0) {
    s.y = roofHere + heightOf(s);
    s.vy = 0;
  }

  // the run cycle in radians: at full speed roughly three strides a second.
  // (0.02 with a 7.4 multiplier downstream gave him fifty — the Sonic legs)
  s.step += Math.abs(s.vx) * dt * 0.032;
  if (s.landed > 0) s.landed -= dt;
  if (s.invuln > 0) s.invuln -= dt;
  if (s.recoil > 0) s.recoil = Math.max(0, s.recoil - dt * 6);
  if (s.muzzle > 0) s.muzzle = Math.max(0, s.muzzle - dt);
  return s;
}

/** Where the barrel is, in world coordinates. */
export function muzzleOf(s) {
  const shoulder = s.y - heightOf(s) * (s.crouching ? 0.62 : 0.72);
  return {
    x: s.x + Math.cos(s.aim) * 30,
    y: shoulder + Math.sin(s.aim) * 30,
  };
}

/**
 * Points the gun. Returns the chosen target, if any — the HUD draws a reticle on
 * it, which is what makes the auto-aim feel like a decision instead of a cheat.
 */
export function aimAt(s, objects, input) {
  const shoulder = s.y - heightOf(s) * 0.72;

  // A thumb pushing the right stick is an angle, not a place: the gun points
  // where the thumb is pushed. (On a desktop the mouse is a place — there the
  // cursor is not sitting on top of what you are shooting at.)
  if (input.aimAngle !== null && input.aimAngle !== undefined) {
    s.aim = input.aimAngle;
    s.facing = Math.cos(s.aim) >= 0 ? 1 : -1;
    return null;
  }
  // holding the trigger without pushing: the gun keeps the angle it had
  if (input.aiming) return null;

  if (input.aim) {
    const dx = input.aim.x - s.x;
    const dy = input.aim.y - shoulder;
    if (Math.hypot(dx, dy) > 12) {
      s.aim = Math.atan2(dy, dx);
      s.facing = Math.cos(s.aim) >= 0 ? 1 : -1;
      return null;
    }
  }
  if (input.up) {
    s.aim = -Math.PI / 2;
    return null;
  }
  let best = null;
  let bestScore = Infinity;
  for (const o of objects) {
    if (o.dead || o.landed) continue;
    const dx = o.x - s.x;
    const dy = o.y - shoulder;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.aimRange) continue;
    // what is coming down on top of you counts as nearer than it is
    const overhead = Math.abs(dx) < 220 && dy < 0 ? 0.45 : 1;
    const behind = dx * s.facing < 0 ? 1.6 : 1;
    const score = dist * overhead * behind;
    if (score < bestScore) { bestScore = score; best = o; }
  }
  if (best) {
    s.aim = Math.atan2(best.y - shoulder, best.x - s.x);
    if (Math.cos(s.aim) !== 0) s.facing = Math.cos(s.aim) >= 0 ? 1 : -1;
  } else {
    s.aim = s.facing > 0 ? -0.35 : Math.PI + 0.35;
  }
  return best;
}

/** A hit taken. Returns true when it cost a life. */
export function hurt(s, amount = 1) {
  if (s.invuln > 0 || s.dead) return false;
  s.lives -= amount;
  s.invuln = PLAYER.invuln;
  s.vy = Math.min(s.vy, -320);
  if (s.lives <= 0) {
    s.lives = 0;
    s.dead = true;
  }
  return true;
}

export function heal(s, amount = 1) {
  const before = s.lives;
  s.lives = clamp(s.lives + amount, 0, PLAYER.lives);
  return s.lives !== before;
}
