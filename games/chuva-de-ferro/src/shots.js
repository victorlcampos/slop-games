// What leaves the barrel.
//
// Eight behaviours cover the twenty guns, which is the point of keeping the
// weapons a table: a new gun is a row, not a branch. A beam is resolved the
// moment the trigger goes, everything else is a body that flies.

import { GRAVITY, clamp } from './config.js';
import { surfaceAt } from './world.js';

/**
 * Pulls the trigger. `ctx` is what the shot is allowed to touch:
 *   { world, objects, shots, fx, damage(obj, dmg, shot), boom(x, y, r, dmg, shot), rand }
 * Returns true when a shot really left — the caller spends the ammo on that.
 */
export function fire(ctx, weapon, from, aim, extra = {}) {
  const { shots, rand } = ctx;
  const base = {
    weapon: weapon.id, kind: weapon.kind, dmg: weapon.dmg, colour: weapon.colour,
    pierce: weapon.pierce, splash: weapon.splash, life: weapon.life,
    effect: weapon.effect, knock: weapon.knock || 0, hits: 0, dead: false,
    proximity: weapon.proximity || 0, ...extra,
  };

  if (weapon.kind === 'beam') {
    resolveBeam(ctx, weapon, from, aim, base);
    return true;
  }

  const n = weapon.count || 1;
  for (let i = 0; i < n; i++) {
    const spread = weapon.spread ? (rand() - 0.5) * weapon.spread * 2 : 0;
    const a = aim + spread + (weapon.kind === 'homing' ? (i - (n - 1) / 2) * 0.22 : 0);
    const speed = weapon.speed * (weapon.kind === 'pellet' ? 0.85 + rand() * 0.3 : 1);
    shots.push({
      ...base,
      x: from.x, y: from.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: weapon.life * (weapon.kind === 'pellet' ? 0.8 + rand() * 0.4 : 1),
      target: null,
      bounces: weapon.effect === 'bounce' ? 3 : 0,
      r: weapon.kind === 'orb' ? 18 : weapon.kind === 'rocket' ? 8 : weapon.kind === 'flame' ? 16 : 4,
    });
  }
  return true;
}

/** A straight line, resolved at once: everything on it takes the hit. */
function resolveBeam(ctx, weapon, from, aim, base) {
  const dx = Math.cos(aim);
  const dy = Math.sin(aim);
  const reach = 2200;
  const hit = [];
  for (const o of ctx.objects) {
    if (o.dead) continue;
    const px = o.x - from.x;
    const py = o.y - from.y;
    const along = px * dx + py * dy;
    if (along < 0 || along > reach) continue;
    const off = Math.abs(px * dy - py * dx);
    if (off > o.r + 6) continue;
    hit.push({ o, along });
  }
  hit.sort((a, b) => a.along - b.along);
  const limit = weapon.pierce >= 99 ? hit.length : weapon.pierce + 1;
  let last = { x: from.x + dx * reach, y: from.y + dy * reach };
  for (let i = 0; i < Math.min(limit, hit.length); i++) {
    const o = hit[i].o;
    ctx.damage(o, weapon.dmg, base);
    if (weapon.splash) ctx.boom(o.x, o.y, weapon.splash, Math.round(weapon.dmg * 0.4), base);
    last = { x: o.x, y: o.y };
  }
  if (weapon.effect === 'chain' && hit.length) chain(ctx, weapon, hit[0].o, base);
  ctx.fx.beam(from.x, from.y, last.x, last.y, weapon.colour);
}

/** The lightning's hop from one piece of cargo to the next. */
function chain(ctx, weapon, first, base) {
  let current = first;
  const seen = new Set([current]);
  for (let jump = 0; jump < (weapon.chainJumps || 3); jump++) {
    let next = null;
    let best = weapon.chainRange || 240;
    for (const o of ctx.objects) {
      if (o.dead || seen.has(o)) continue;
      const d = Math.hypot(o.x - current.x, o.y - current.y);
      if (d < best) { best = d; next = o; }
    }
    if (!next) return;
    ctx.fx.beam(current.x, current.y, next.x, next.y, weapon.colour);
    ctx.damage(next, Math.round(weapon.dmg * 0.75), base);
    seen.add(next);
    current = next;
  }
}

/** Everything in flight, one step. */
export function updateShots(shots, dt, ctx) {
  for (const s of shots) {
    if (s.dead) continue;
    s.life -= dt;
    if (s.life <= 0) {
      if (s.splash) ctx.boom(s.x, s.y, s.splash, s.dmg, s);
      s.dead = true;
      continue;
    }

    if (s.kind === 'lobbed') s.vy += GRAVITY * 0.62 * dt;
    if (s.kind === 'orb') { s.vx *= 1 - dt * 0.4; s.vy *= 1 - dt * 0.4; }
    if (s.kind === 'flame') {
      s.vx *= 1 - dt * 2.4;
      s.vy = s.vy * (1 - dt * 2.4) - 120 * dt;      // fire climbs
      s.r += dt * 40;
    }
    if (s.kind === 'homing') steer(s, ctx, dt);

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // the ground: some rounds bounce off it, the rest end there
    const floor = surfaceAt(ctx.world, s.x, s.y);
    if (s.y >= floor) {
      if (s.bounces > 0) {
        s.bounces--;
        s.y = floor - 1;
        s.vy = -Math.abs(s.vy) * 0.62;
        s.vx *= 0.86;
        ctx.fx.spark(s.x, floor, s.colour, 4);
      } else {
        if (s.splash) ctx.boom(s.x, s.y, s.splash, s.dmg, s);
        else ctx.fx.spark(s.x, floor, s.colour, 5);
        s.dead = true;
        continue;
      }
    }
    if (s.y < -400) { s.dead = true; continue; }

    // and what it was aimed at
    for (const o of ctx.objects) {
      if (o.dead || s.dead) continue;
      const reach = o.r + s.r;
      if ((o.x - s.x) ** 2 + (o.y - s.y) ** 2 > reach * reach) continue;
      if (s.proximity) continue;                      // flak waits for the fuse below
      ctx.damage(o, s.dmg, s);
      if (s.knock) { o.vx += Math.sign(s.vx) * s.knock * 0.02; o.vy -= s.knock * 0.01; }
      if (s.splash) ctx.boom(s.x, s.y, s.splash, Math.round(s.dmg * 0.6), s);
      s.hits++;
      if (s.hits > s.pierce) { s.dead = true; break; }
    }

    // flak: a proximity fuse looks for something to be near, then bursts
    if (s.proximity && !s.dead) {
      for (const o of ctx.objects) {
        if (o.dead) continue;
        const d = Math.hypot(o.x - s.x, o.y - s.y);
        if (d < s.proximity) {
          ctx.boom(s.x, s.y, s.splash, s.dmg, s);
          s.dead = true;
          break;
        }
      }
    }
  }

  // compact: shots are the busiest array in the game
  let write = 0;
  for (let i = 0; i < shots.length; i++) if (!shots[i].dead) shots[write++] = shots[i];
  shots.length = write;
}

/** A homing needle looking for work. */
function steer(s, ctx, dt) {
  if (!s.target || s.target.dead) {
    let best = 1400;
    s.target = null;
    for (const o of ctx.objects) {
      if (o.dead) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < best) { best = d; s.target = o; }
    }
  }
  if (!s.target) return;
  const want = Math.atan2(s.target.y - s.y, s.target.x - s.x);
  const now = Math.atan2(s.vy, s.vx);
  let delta = want - now;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const turn = clamp(delta, -4 * dt, 4 * dt);
  const speed = Math.hypot(s.vx, s.vy) * (1 + dt * 0.8);
  s.vx = Math.cos(now + turn) * speed;
  s.vy = Math.sin(now + turn) * speed;
}
