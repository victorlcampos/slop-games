// What a guard does with what he knows.
//
// Four states, and they are all the same shape: something puts a *goal* on the
// map, he walks to it, and he fires whenever you are in front of him. Keeping
// the shooting out of the state machine is what stops a guard from politely
// finishing his walk while you stand in the doorway.
//
//   patrol       nothing is wrong. Walks his route.
//   investigate  a noise, or you for a moment. Goes to look.
//   call         he is sure — of you, or of a body on the carpet. Runs to the
//                nearest alarm and pulls it. This is the state you shoot.
//   hunt         the alarm is ringing. Goes to wherever you were last seen.

import {
  GUARD, clamp, turnTowards, dist, TILE,
} from './config.js';
import { canSee } from './vision.js';
import { stepAlong, cellOf, centreOf, clearFor, moveCircle, flowField } from './grid.js';
import { WEAPONS } from './weapons.js';

/** How fast he walks, by what he is doing. */
function paceOf(g, plan) {
  if (g.state === 'patrol') return plan.guardSpeed * GUARD.patrolSpeed;
  if (g.state === 'investigate') return plan.guardSpeed * GUARD.investigateSpeed;
  // a man on his way to an alarm runs; you are meant to have to catch him
  return plan.guardSpeed * (g.state === 'call' ? GUARD.callSpeed : 1);
}

export function updateGuard(g, dt, world) {
  if (g.dead) return;
  const { level, player, alarm } = world;
  const plan = level.plan;
  const grid = level.grid;

  g.cool = Math.max(0, g.cool - dt);

  // ------------------------------------------------------------ what he sees
  const sightRange = plan.guardSight * (alarm.on ? 1.2 : 1);
  const seesPlayer =
    !player.dead && canSee(grid, g.x, g.y, g.facing, plan.guardFov, sightRange, player.x, player.y);

  if (seesPlayer) {
    g.alert = clamp(g.alert + GUARD.suspicionUp * dt, 0, 1);
    world.markSeen(player.x, player.y);
  } else {
    g.alert = clamp(g.alert - GUARD.suspicionDown * dt, 0, 1);
  }

  // A body is worth a full alarm, but only once it has been looked at: a
  // corpse glimpsed at the edge of a sweep and instantly forgotten would make
  // dragging one pointless.
  let sawBody = null;
  for (const b of world.bodies) {
    if (canSee(grid, g.x, g.y, g.facing, plan.guardFov, sightRange * 0.8, b.x, b.y)) {
      b.seen = (b.seen || 0) + dt;
      if (b.seen >= GUARD.bodyLock) sawBody = b;
    }
  }

  // ------------------------------------------------------------ what he does
  if (alarm.on) {
    g.state = 'hunt';
    // Re-target only when somebody has actually seen you since the last time
    // this guard looked. Reading `lastKnown` every frame instead re-points him
    // at the same spot for ever, and the moment he arrives he is sent back to
    // the tile he is standing on — five guards vibrating on one corner.
    if (world.lastKnown && g.sawStamp !== world.seenStamp) {
      g.sawStamp = world.seenStamp;
      g.goal = { ...world.lastKnown };
    }
  } else if (g.state === 'call') {
    // Sticky, and that is the point. A guard who drops the errand the moment
    // you step behind a door never reaches a panel, and the alarm becomes
    // something only cameras can raise. Once he is sure, the only things that
    // stop him are the panel and a bullet.
    if (!g.goal) g.goal = nearestAlarm(world, g) || { x: player.x, y: player.y };
  } else if (sawBody || g.alert >= 1) {
    g.state = 'call';
    // no panel left standing: he cannot call it in, so he comes for you
    // himself — which is what makes shooting the panels worth the noise
    g.goal = nearestAlarm(world, g) || { x: player.x, y: player.y };
    world.onGuardAlerted?.(g, sawBody ? 'body' : 'player');
  } else if (seesPlayer) {
    g.state = 'investigate';
    g.goal = { x: player.x, y: player.y };
    g.lost = GUARD.forget;
  }

  if (g.state === 'investigate') {
    g.lost -= dt;
    if (g.lost <= 0) {
      g.state = 'patrol';
      g.goal = null;
    }
  }

  if (g.state === 'patrol' && !g.goal) g.goal = legGoal(g);
  if (g.state === 'hunt' && !g.goal) g.goal = legGoal(g);

  // --------------------------------------------------------------- the walk
  const pace = paceOf(g, plan);
  // A guard planted in a doorway shooting is the normal case — but one who is
  // on his way to the alarm keeps running and fires as he goes. Otherwise he
  // stops the moment he sees you, never reaches the panel, and "shoot him
  // before he calls it in" is a rule nobody ever gets to play.
  const holdToShoot =
    g.state !== 'call' && seesPlayer && dist(g.x, g.y, player.x, player.y) < WEAPONS[g.gun].range * 0.8;

  if (g.goal && !holdToShoot) {
    const arrived = walk(g, dt, pace, grid, world);
    if (arrived) {
      if (g.state === 'patrol') {
        g.wait -= dt;
        if (g.wait <= 0) {
          g.leg = (g.leg + 1) % g.route.length;
          g.goal = legGoal(g);
          g.wait = 0.8 + (g.leg % 3) * 0.5;
        }
      } else if (g.state === 'call') {
        pullNearest(world, g);
      } else {
        g.goal = null;
        if (g.state === 'hunt') g.goal = wanderNear(world, g);
      }
    }
  } else if (holdToShoot) {
    g.vx *= 0.82;
    g.vy *= 0.82;
  }

  // ------------------------------------------------------------ where he looks
  let lookAt = null;
  if (seesPlayer) lookAt = player;
  else if (g.goal && (g.vx || g.vy)) lookAt = { x: g.x + g.vx, y: g.y + g.vy };
  else if (g.state === 'patrol') g.facing += dt * 0.55;      // a slow sweep while standing
  if (lookAt) {
    g.facing = turnTowards(g.facing, Math.atan2(lookAt.y - g.y, lookAt.x - g.x), GUARD.turn * dt);
  }

  // ------------------------------------------------------------------ firing
  if (seesPlayer && dist(g.x, g.y, player.x, player.y) < WEAPONS[g.gun].range) {
    g.aim += dt;
    if (g.aim >= plan.guardAim && g.cool <= 0) {
      // firing on the run costs him the accuracy he would have had standing
      world.guardFires(g, g.state === 'call' ? 3 : 1);
      g.cool = WEAPONS[g.gun].rate;
    }
  } else {
    g.aim = Math.max(0, g.aim - dt * 0.6);
  }
}

/** One step towards `g.goal`. Returns true once he is standing on it. */
function walk(g, dt, pace, grid, world) {
  const goal = g.goal;
  const close = dist(g.x, g.y, goal.x, goal.y);
  if (close < TILE * 0.45) return true;

  let tx = goal.x;
  let ty = goal.y;
  // straight there when he fits, and only then round the corners: a guard that
  // always follows the grid walks the middle of every tile, which looks like a
  // train — and one that ignores his own width walks into the corner
  if (!clearFor(grid, g.x, g.y, goal.x, goal.y, GUARD.r)) {
    const from = cellOf(g.x, g.y);
    const to = cellOf(goal.x, goal.y);
    const field = world.fieldFor(to.cx, to.cy);
    const next = field && stepAlong(field, grid, from.cx, from.cy);
    if (next) {
      const c = centreOf(next.cx, next.cy);
      tx = c.x;
      ty = c.y;
    } else if (!field || field.at(from.cx, from.cy) < 0) {
      // cut off from the goal — nothing to walk to, so stop asking
      g.goal = null;
      return false;
    }
  }

  const a = Math.atan2(ty - g.y, tx - g.x);
  g.vx = Math.cos(a) * pace;
  g.vy = Math.sin(a) * pace;

  // A sidestep that lasts a moment. Nudging for one frame and being pulled
  // straight back by the goal on the next is not an escape, it is a hum — the
  // guard sits on the corner trading one pixel back and forth for ever.
  if (g.slip > 0) {
    g.slip -= dt;
    const s = moveCircle(grid, g.x, g.y, GUARD.r, g.slipX * pace * dt, g.slipY * pace * dt);
    g.x = s.x;
    g.y = s.y;
  }

  const moved = moveCircle(grid, g.x, g.y, GUARD.r, g.vx * dt, g.vy * dt);
  const stuck = Math.abs(moved.x - g.x) < 1e-6 && Math.abs(moved.y - g.y) < 1e-6;
  g.x = moved.x;
  g.y = moved.y;
  if (stuck && g.slip <= 0) {
    const len = Math.hypot(g.vx, g.vy) || 1;
    g.slipX = -g.vy / len;
    g.slipY = g.vx / len;
    g.slip = 0.3;
  }
  return false;
}

function legGoal(g) {
  const c = g.route[g.leg % g.route.length];
  return { ...centreOf(c.cx, c.cy) };
}

/**
 * The nearest panel **on foot**, which is not the nearest panel.
 *
 * Measured in a straight line, a guard picks the one through the wall behind
 * him and walks the long way round the building to get to it — twenty seconds
 * of him jogging past two closer panels. One breadth-first sweep of the floor
 * settles it, and it only happens the moment he becomes sure.
 */
function nearestAlarm(world, g) {
  const panels = world.level.alarms.filter((a) => !a.dead);
  if (!panels.length) return null;
  const from = cellOf(g.x, g.y);
  const field = flowField(world.level.grid, [from]);
  let best = null;
  let bestD = Infinity;
  for (const a of panels) {
    const c = cellOf(a.x, a.y);
    const d = field.at(c.cx, c.cy);
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best ? { x: best.x, y: best.y, alarm: best } : null;
}

function pullNearest(world, g) {
  const a = world.level.alarms.find((p) => !p.dead && dist(p.x, p.y, g.x, g.y) < TILE * 1.2);
  if (a) world.raiseAlarm(a, 'guard');
  g.goal = null;
  g.state = 'hunt';
}

/** Somewhere near where you were, so a hunt does not end in a neat queue. */
function wanderNear(world, g) {
  const at = world.lastKnown || { x: g.x, y: g.y };
  const a = world.rng() * Math.PI * 2;
  const r = TILE * (1 + world.rng() * 3);
  const x = at.x + Math.cos(a) * r;
  const y = at.y + Math.sin(a) * r;
  return world.level.grid.solidAt(x, y) ? { x: at.x, y: at.y } : { x, y };
}

/**
 * Guards do not stand inside each other. Cheap, and it is what keeps a corridor
 * chase from becoming one guard-shaped stack of five.
 */
export function separate(guards, grid) {
  for (let i = 0; i < guards.length; i++) {
    const a = guards[i];
    if (a.dead) continue;
    for (let j = i + 1; j < guards.length; j++) {
      const b = guards[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = GUARD.r * 2;
      if (d > min || d < 1e-4) continue;
      const push = (min - d) / 2;
      const nx = (dx / d) * push;
      const ny = (dy / d) * push;
      // the shove has to obey the walls too: two guards meeting in a one-tile
      // corridor would otherwise push each other straight through it
      nudge(a, -nx, -ny, grid);
      nudge(b, nx, ny, grid);
    }
  }
}

function nudge(g, dx, dy, grid) {
  if (!grid) {
    g.x += dx;
    g.y += dy;
    return;
  }
  const moved = moveCircle(grid, g.x, g.y, GUARD.r, dx, dy);
  g.x = moved.x;
  g.y = moved.y;
}
