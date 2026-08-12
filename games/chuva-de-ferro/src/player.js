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
  const roof = world.ceilingAt(s.x);
  const ground = surfaceAt(world, s.x, s.y);
  const headroom = ground - roof;
  const mustDuck = s.onGround && headroom < PLAYER.h;
  s.crouching = (input.down && s.onGround) || mustDuck;

  const speed = PLAYER.speed * (s.crouching ? 0.45 : 1) * (s.onGround ? 1 : PLAYER.air);
  s.vx = wants * speed;

  if (input.jump && s.onGround && !mustDuck) {
    s.vy = -PLAYER.jump;
    s.onGround = false;
  }

  s.vy += GRAVITY * dt;
  const nextX = s.x + s.vx * dt;

  // Walls: a rock you did not jump stops you where it starts. Anything low
  // enough is a step instead — an anvil that landed inside a cave, where nobody
  // can jump, would otherwise be the end of the run.
  s.blocked = false;
  const feet = s.y;
  const head = s.y - heightOf(s);
  const half = PLAYER.w / 2;
  for (const solid of world.solidsNear(s.x, 200)) {
    const top = solid.y;
    const bottom = solid.y + solid.h;
    if (feet <= top + 6 || head >= bottom) continue;         // above it or under it
    if (nextX + half <= solid.x || nextX - half >= solid.x + solid.w) continue;
    if (s.onGround && feet - top <= PLAYER.stepUp) { s.y = top; continue; }
    if (s.x <= solid.x) { s.x = solid.x - half; s.blocked = true; }
    else if (s.x >= solid.x + solid.w) { s.x = solid.x + solid.w + half; s.blocked = true; }
  }
  if (!s.blocked) s.x = nextX;
  if (s.x < 40) s.x = 40;                                     // the road only goes one way

  s.y += s.vy * dt;

  // the floor: the road, or the top of whatever landed there
  const floor = surfaceAt(world, s.x, s.y - s.vy * dt);
  if (s.y >= floor) {
    if (!s.onGround && s.vy > 0) s.landed = true;
    s.y = floor;
    s.vy = 0;
    s.onGround = true;
  } else {
    s.onGround = false;
  }

  // a low ceiling in the air: bump the head instead of clipping through the rock
  const roofHere = world.ceilingAt(s.x);
  if (s.y - heightOf(s) < roofHere && s.vy < 0) {
    s.y = roofHere + heightOf(s);
    s.vy = 0;
  }

  s.step += Math.abs(s.vx) * dt * 0.02;
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
  if (input.up) {
    s.aim = -Math.PI / 2;
    return null;
  }
  const shoulder = s.y - heightOf(s) * 0.72;
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
