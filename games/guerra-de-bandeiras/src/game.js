// The match: ten bodies, two flags and whatever is in the air between them.
//
// One thing to know before reading it. **Every soldier goes through the same
// two functions** — `botOrders` writes a set of orders, the player's thumbs
// write the same set, and `applyOrders` is the only thing that moves anybody.
// So a bot cannot walk faster than you, shoot sooner than its own reaction
// allows or turn quicker than your own body does; when the enemy squad wins it
// is because five of them wanted the same thing at once, which is the only kind
// of hard that is worth playing against.

import {
  UNIT, DASH, GUNS, TURRET, PAD, SIGHT, TARGET, REGEN,
  botStats, makeRng, clamp, dist, dist2, other, turnTowards, angleDelta, RAD,
} from './config.js';
import { cellOf, moveCircle, lineOfSight, castRay, flowField } from './grid.js';
import { buildArena } from './arena.js';
import { createFlags, touchFlags, updateFlags, dropFlag, carrierOf, flagPoint, sendHome } from './match.js';
import { botOrders, assignRoles } from './ai.js';

/** How far off the line of fire a body can be and still be picked up by the assist. */
export const ASSIST = { cone: 15 * RAD, range: 1.02 };

const EVENT_LIFE = 3.6;

export function createGame({ arena, phase = 0, team = 'human', fx = null, seed = 1, hooks = {} } = {}) {
  const field = arena || buildArena(phase);
  const rng = makeRng(seed);

  const game = {
    arena: field,
    grid: field.grid,
    flags: createFlags(field),
    units: [],
    bullets: [],
    turrets: field.turrets.map((t, i) => ({
      id: i, team: t.team, x: t.x, y: t.y, hp: TURRET.hp, facing: t.team === 'human' ? 0 : Math.PI,
      cool: 0, dead: false, rebuild: 0, target: null,
    })),
    pads: field.pads,
    score: { human: 0, alien: 0 },
    state: 'playing',                  // playing | won | lost
    winner: null,
    time: 0,
    playerTeam: team,
    player: null,
    events: [],
    stats: { kills: 0, deaths: 0, captures: 0, returns: 0, taken: 0 },
    rng,
    fx,
    ...hooks,
  };

  // ------------------------------------------------------------- the squads
  let nextId = 1;
  for (const side of ['human', 'alien']) {
    for (let i = 0; i < field.squad; i++) {
      const home = field.spawns[side][i % field.spawns[side].length];
      game.units.push({
        id: nextId++,
        team: side,
        bot: !(side === team && i === 0),
        x: home.x, y: home.y, vx: 0, vy: 0,
        facing: side === 'human' ? 0 : Math.PI,
        hp: UNIT.hp,
        r: UNIT.r,
        dead: false,
        respawnT: 0,
        spawnIndex: i,
        role: i === 0 ? 'attack' : 'defend',
        cool: 0,
        dashT: 0, dashCool: 0, dashX: 0, dashY: 0,
        aimT: 0, holdT: 0, stuck: 0, orbit: (i * 1.7) % (Math.PI * 2),
        target: null,
        kills: 0, caps: 0,
        hurt: 0,                       // seconds of the red flash left
        calm: REGEN.delay,             // seconds since the last hit — see REGEN
        stride: 0,
      });
    }
  }
  game.player = game.units.find((u) => !u.bot) || null;
  for (const side of ['human', 'alien']) {
    assignRoles(game.units.filter((u) => u.team === side), field.skill);
  }

  // ------------------------------------------------------------- the basics
  game.unitById = (id) => game.units.find((u) => u.id === id) || null;
  game.gun = (u) => GUNS[u.team];

  game.say = (event) => {
    game.events.push({ ...event, t: EVENT_LIFE, at: game.time });
    if (event.kind === 'captured') game.onCapture?.(event.team);
    else if (event.kind === 'taken') game.onFlagTaken?.(event);
    else if (event.kind === 'returned') game.onFlagHome?.(event);
    else if (event.kind === 'dropped') game.onFlagDropped?.(event);
  };

  /** Book what a soldier just did — the end-of-match card is made of these. */
  game.credit = (u, what) => {
    if (what === 'capture') u.caps++;
    if (u.bot) return;
    if (what === 'capture') game.stats.captures++;
    if (what === 'return') game.stats.returns++;
    if (what === 'kill') game.stats.kills++;
  };

  game.finish = (winner) => {
    if (game.state !== 'playing') return;
    game.winner = winner;
    game.state = winner === game.playerTeam ? 'won' : 'lost';
    game.onEnd?.(game.state, winner);
  };

  /**
   * Who can see what. A clear line, always — plus a range, but only where the
   * arena is dark. Both squads read this same function: a fog that only applied
   * to the player would be a handicap dressed as atmosphere.
   */
  game.visibleTo = (u, x, y) => {
    if (field.dark && dist2(u.x, u.y, x, y) > SIGHT * SIGHT) return false;
    return lineOfSight(game.grid, u.x, u.y, x, y);
  };

  game.teamSees = (team, x, y) => {
    for (const u of game.units) {
      if (u.dead || u.team !== team) continue;
      if (game.visibleTo(u, x, y)) return true;
    }
    for (const t of game.turrets) {
      if (t.dead || t.team !== team) continue;
      if (!field.dark || dist2(t.x, t.y, x, y) <= SIGHT * SIGHT) {
        if (lineOfSight(game.grid, t.x, t.y, x, y)) return true;
      }
    }
    return false;
  };

  /** A line wide enough for a body — three rays, offset by its own width. */
  game.walkableLine = (ax, ay, bx, by, r) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return true;
    const px = (-dy / len) * r;
    const py = (dx / len) * r;
    const steps = Math.ceil(len / 12);
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = ax + dx * k;
      const y = ay + dy * k;
      if (!game.grid.walkableAt(x + px, y + py)) return false;
      if (!game.grid.walkableAt(x - px, y - py)) return false;
      if (!game.grid.walkableAt(x, y)) return false;
    }
    return true;
  };

  /**
   * A route to a point, as a distance field — cached by the goal's **cell**.
   *
   * The field is static and so is the arena, so a field once computed is
   * correct forever: a carrier running across the map re-uses the field of
   * every tile he crosses instead of rebuilding one a frame. The cap is there
   * because a match visits most of the 798 cells eventually and there is no
   * reason to hold them all.
   */
  const fields = new Map();
  game.fieldTo = (x, y) => {
    const c = cellOf(x, y);
    if (!game.grid.walkable(c.cx, c.cy)) {
      // a goal inside a wall (a flag knocked against one, a pad in a pillar)
      // still has to produce a route: aim at the tile the body can stand on
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (game.grid.walkable(c.cx + dx, c.cy + dy)) {
          c.cx += dx;
          c.cy += dy;
          break;
        }
      }
    }
    const key = c.cy * game.grid.cols + c.cx;
    let f = fields.get(key);
    if (!f) {
      f = flowField(game.grid, [c]);
      if (fields.size > 96) fields.clear();
      fields.set(key, f);
    }
    return f;
  };

  // ------------------------------------------------------------- the update
  game.update = (dt, input) => {
    if (game.state !== 'playing') return;
    game.time += dt;

    // Two passes, and this is not a style choice.
    //
    // With one pass — decide and move, body by body — the squad that happens to
    // be later in the array reads positions that have already moved this frame
    // and the squad before it reads positions from the last one. Half a frame of
    // freshness, three pixels at a walk; over thirty bot-against-bot matches it
    // was worth 40% more captures to whoever went last, and reversing the array
    // reversed the result. Everybody decides against the same world, then
    // everybody moves.
    const living = [];
    for (const u of game.units) {
      if (u.dead) {
        u.respawnT -= dt;
        if (u.respawnT <= 0) respawn(game, u);
        continue;
      }
      // Anything that empties a body puts it on the deck, not only a bullet.
      // Nothing in the game does that today, but a body walking around on zero
      // health — healing back up, still carrying a flag — is the kind of state
      // that is invisible until it is a bug report.
      if (u.hp <= 0) {
        kill(game, u, null);
        continue;
      }
      u.cool = Math.max(0, u.cool - dt);
      u.dashCool = Math.max(0, u.dashCool - dt);
      u.hurt = Math.max(0, u.hurt - dt);
      u.calm += dt;
      if (u.calm >= REGEN.delay) u.hp = Math.min(UNIT.hp, u.hp + REGEN.rate * dt);
      living.push(u);
    }
    for (const u of living) {
      u.orders = u.bot ? botOrders(game, u, dt) : playerOrders(game, u, input || {});
    }
    for (const u of living) {
      applyOrders(game, u, u.orders, dt);
      touchFlags(game, u);
      teleport(game, u, dt);
    }

    updateBullets(game, dt);
    updateTurrets(game, dt);
    updateFlags(game, dt);

    for (let i = game.events.length - 1; i >= 0; i--) {
      game.events[i].t -= dt;
      if (game.events[i].t <= 0) game.events.splice(i, 1);
    }
  };

  /** Everything the console (and the tests) want to read in one object. */
  game.snapshot = () => ({
    arena: field.id,
    time: game.time,
    score: { ...game.score },
    state: game.state,
    flags: {
      human: { state: game.flags.human.state, carrier: game.flags.human.carrier },
      alien: { state: game.flags.alien.state, carrier: game.flags.alien.carrier },
    },
    alive: game.units.filter((u) => !u.dead).length,
  });

  return game;
}

// --------------------------------------------------------------- the orders

/**
 * The player's thumbs, in the same shape a bot's brain writes.
 *
 * `autoAim` is the phone: a trigger with no direction on it asks the game for a
 * target instead of firing wherever the body happens to be pointing.
 */
function playerOrders(game, u, input) {
  const orders = { mx: input.mx || 0, my: input.my || 0, aimAt: null, fire: !!input.fire, dash: !!input.dash };
  if (input.aim) orders.aimAt = assistedAim(game, u, input.aim);
  else if (typeof input.aimAngle === 'number') {
    orders.aimAt = { x: u.x + Math.cos(input.aimAngle) * 200, y: u.y + Math.sin(input.aimAngle) * 200 };
  } else if (input.autoAim) {
    const t = nearestVisible(game, u);
    if (t) orders.aimAt = { x: t.x, y: t.y };
  }
  return orders;
}

/**
 * The gun helps. You point at a man, not at a pixel.
 *
 * Inside a cone around where the cursor is, the barrel finds the nearest enemy
 * it could actually see — and only one it could see, because a gun that swings
 * onto somebody invisible in the dark reads as a cheat rather than as help.
 */
export function assistedAim(game, u, aim) {
  const want = Math.atan2(aim.y - u.y, aim.x - u.x);
  const reach = game.gun(u).range * ASSIST.range;
  let best = null;
  let bestOff = ASSIST.cone;
  for (const e of game.units) {
    if (e.dead || e.team === u.team) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d > reach) continue;
    if (!game.visibleTo(u, e.x, e.y)) continue;
    const off = Math.abs(angleDelta(want, Math.atan2(e.y - u.y, e.x - u.x)));
    if (off < bestOff) {
      bestOff = off;
      best = e;
    }
  }
  return best ? { x: best.x, y: best.y, locked: best.id } : aim;
}

function nearestVisible(game, u) {
  let best = null;
  let bestD = game.gun(u).range;
  for (const e of game.units) {
    if (e.dead || e.team === u.team) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bestD && game.visibleTo(u, e.x, e.y)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/** The only thing in the game that moves a body, whoever is asking. */
function applyOrders(game, u, o, dt) {
  const stats = u.bot ? botStats(game.arena.skill) : null;
  const carrying = game.flags[other(u.team)].carrier === u.id;
  const top = UNIT.speed * (carrying ? UNIT.carry : 1) * (stats ? stats.speed : 1);

  if (o.dash && u.dashCool <= 0 && (o.mx || o.my)) {
    const len = Math.hypot(o.mx, o.my) || 1;
    u.dashT = DASH.time;
    u.dashCool = DASH.cool;
    u.dashX = o.mx / len;
    u.dashY = o.my / len;
    game.onDash?.(u);
  }

  let wantX = 0;
  let wantY = 0;
  if (u.dashT > 0) {
    u.dashT -= dt;
    wantX = u.dashX * top * DASH.speed;
    wantY = u.dashY * top * DASH.speed;
  } else {
    const len = Math.hypot(o.mx, o.my);
    if (len > 0.001) {
      wantX = (o.mx / len) * top;
      wantY = (o.my / len) * top;
    }
  }

  const rate = (wantX || wantY ? UNIT.accel : UNIT.friction) * dt;
  u.vx += clamp(wantX - u.vx, -rate, rate);
  u.vy += clamp(wantY - u.vy, -rate, rate);

  const moved = moveCircle(game.grid, u.x, u.y, u.r, u.vx * dt, u.vy * dt);
  if (moved.x === u.x) u.vx = 0;
  if (moved.y === u.y) u.vy = 0;
  u.x = moved.x;
  u.y = moved.y;
  u.stride += Math.hypot(u.vx, u.vy) * dt * 0.05;

  const face = o.aimAt
    ? Math.atan2(o.aimAt.y - u.y, o.aimAt.x - u.x)
    : (u.vx || u.vy ? Math.atan2(u.vy, u.vx) : u.facing);
  u.facing = turnTowards(u.facing, face, UNIT.turn * dt);

  // The shot leaves once the body has finished its turn. Without the gate the
  // first round of every burst goes off mid-swing and misses — which on a phone,
  // where the trigger is a tap, means the tap that should have saved you did
  // nothing at all.
  if (o.fire && u.cool <= 0) {
    const aligned = !o.aimAt || Math.abs(angleDelta(u.facing, face)) < 8 * RAD;
    if (aligned) shoot(game, u, stats);
  }
}

function shoot(game, u, stats) {
  const gun = game.gun(u);
  const spread = gun.spread * (stats ? stats.spread : 1);
  const a = u.facing + (game.rng() - 0.5) * spread * 2;
  u.cool = gun.rate;
  game.bullets.push({
    x: u.x + Math.cos(u.facing) * (u.r + 6),
    y: u.y + Math.sin(u.facing) * (u.r + 6),
    vx: Math.cos(a) * gun.speed,
    vy: Math.sin(a) * gun.speed,
    team: u.team,
    owner: u.id,
    damage: gun.damage,
    life: gun.range / gun.speed,
    kind: gun.id,
  });
  u.vx -= Math.cos(u.facing) * gun.kick * 6;
  u.vy -= Math.sin(u.facing) * gun.kick * 6;
  game.onShot?.(u);
}

// -------------------------------------------------------------- the bullets

function updateBullets(game, dt) {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;

    // A round that only checks where it lands walks through a body at 1000 px/s
    // and a 60 Hz step. It is the segment that hits, never the point.
    const hit = firstHit(game, b, nx, ny);
    if (hit) {
      if (hit.unit) {
        damage(game, hit.unit, b.damage, b);
        game.fx?.blood(hit.x, hit.y, 6, hit.unit.team === 'human' ? '#8e2f3f' : '#3fae74');
      } else if (hit.turret) {
        hurtTurret(game, hit.turret, b.damage);
        game.fx?.spark(hit.x, hit.y, '#ffd88a', 5, 200);
      } else {
        game.fx?.spark(hit.x, hit.y, '#cfe6ff', 4, 180);
      }
      game.bullets.splice(i, 1);
      continue;
    }

    b.x = nx;
    b.y = ny;
    b.life -= dt;
    if (b.life <= 0) game.bullets.splice(i, 1);
  }
}

/**
 * What this step of a bullet ran into first: a wall, an enemy or an enemy
 * turret. Friendly bodies are not in the list — a squad that shoots itself in
 * the back is a squad nobody wants standing behind them, and the alternative
 * (bots refusing to fire past a mate) is an enemy that stops shooting whenever
 * it is winning.
 */
function firstHit(game, b, nx, ny) {
  const dx = nx - b.x;
  const dy = ny - b.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  let bestT = 1;
  let out = null;

  const wall = castRay(game.grid, b.x, b.y, dx / len, dy / len, len);
  if (wall < len) {
    bestT = wall / len;
    out = { x: b.x + dx * bestT, y: b.y + dy * bestT };
  }

  for (const u of game.units) {
    if (u.dead || u.team === b.team) continue;
    const t = segmentHit(b.x, b.y, dx, dy, u.x, u.y, UNIT.hitR);
    if (t !== null && t < bestT) {
      bestT = t;
      out = { x: b.x + dx * t, y: b.y + dy * t, unit: u };
    }
  }
  for (const t2 of game.turrets) {
    if (t2.dead || t2.team === b.team) continue;
    const t = segmentHit(b.x, b.y, dx, dy, t2.x, t2.y, TURRET.r);
    if (t !== null && t < bestT) {
      bestT = t;
      out = { x: b.x + dx * t, y: b.y + dy * t, turret: t2 };
    }
  }
  return out;
}

/** Where a segment first comes within `r` of a point, as a fraction of it. */
export function segmentHit(ax, ay, dx, dy, px, py, r) {
  const fx = ax - px;
  const fy = ay - py;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return null;
  const root = Math.sqrt(disc);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  if (t2 >= 0 && t2 <= 1) return t2;
  if (t1 < 0 && t2 > 1) return 0;              // it started inside the body
  return null;
}

function damage(game, u, amount, from) {
  u.hp -= amount;
  u.hurt = 0.3;
  u.calm = 0;
  game.onHurt?.(u);
  if (u.hp > 0) return;
  const killer = from ? game.unitById(from.owner) : null;
  kill(game, u, killer);
}

function kill(game, u, killer) {
  dropFlag(game, u);
  u.dead = true;
  u.hp = 0;
  u.vx = 0;
  u.vy = 0;
  u.dashT = 0;
  u.respawnT = game.arena.respawn;
  u.target = null;
  game.fx?.blood(u.x, u.y, 12, u.team === 'human' ? '#8e2f3f' : '#3fae74');
  if (killer && killer.team !== u.team) {
    killer.kills++;
    game.credit(killer, 'kill');
  }
  if (!u.bot) game.stats.deaths++;
  game.say({ kind: 'killed', team: u.team, by: killer ? killer.team : null, player: !u.bot });
  game.onKill?.(u, killer);
}

/**
 * Back on your feet, at whichever of your spawns is furthest from the fight.
 *
 * Always using the same one turns an arena into a shooting gallery: the squad
 * that is ahead parks a rifle on it and the match is over. Furthest-from-the-
 * enemy is what gives a losing side the ten seconds it needs to reorganise.
 */
function respawn(game, u) {
  const spots = game.arena.spawns[u.team];
  let best = spots[0];
  let bestScore = -Infinity;
  for (const s of spots) {
    let near = Infinity;
    for (const e of game.units) {
      if (e.dead || e.team === u.team) continue;
      near = Math.min(near, dist(s.x, s.y, e.x, e.y));
    }
    // a tiny bias towards this body's own spawn keeps a squad spread out
    const score = near + (spots.indexOf(s) === u.spawnIndex % spots.length ? 40 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  u.x = best.x;
  u.y = best.y;
  u.hp = UNIT.hp;
  u.dead = false;
  u.vx = 0;
  u.vy = 0;
  u.cool = 0;
  u.aimT = 0;
  u.calm = REGEN.delay;
  u.dashCool = 0;
  u.facing = u.team === 'human' ? 0 : Math.PI;
  game.onRespawn?.(u);
}

// -------------------------------------------------------------- the turrets

function updateTurrets(game, dt) {
  for (const t of game.turrets) {
    if (t.dead) {
      t.rebuild -= dt;
      if (t.rebuild <= 0) {
        t.dead = false;
        t.hp = TURRET.hp;
        game.onTurretUp?.(t);
      }
      continue;
    }
    t.cool = Math.max(0, t.cool - dt);

    let best = null;
    let bestD = TURRET.range;
    for (const u of game.units) {
      if (u.dead || u.team === t.team) continue;
      const d = dist(t.x, t.y, u.x, u.y);
      if (d < bestD && lineOfSight(game.grid, t.x, t.y, u.x, u.y)) {
        best = u;
        bestD = d;
      }
    }
    t.target = best;
    if (!best) continue;

    const want = Math.atan2(best.y - t.y, best.x - t.x);
    t.facing = turnTowards(t.facing, want, TURRET.turn * dt);
    // it has to finish its turn before it fires, which is what makes running
    // straight past one a real option
    if (Math.abs(angleDelta(t.facing, want)) > 6 * RAD || t.cool > 0) continue;

    const a = t.facing + (game.rng() - 0.5) * TURRET.spread * 2;
    t.cool = TURRET.rate;
    game.bullets.push({
      x: t.x + Math.cos(t.facing) * (TURRET.r + 4),
      y: t.y + Math.sin(t.facing) * (TURRET.r + 4),
      vx: Math.cos(a) * TURRET.bulletSpeed,
      vy: Math.sin(a) * TURRET.bulletSpeed,
      team: t.team,
      owner: -1,
      damage: TURRET.damage,
      life: TURRET.range / TURRET.bulletSpeed,
      kind: 'turret',
    });
    game.onTurretShot?.(t);
  }
}

function hurtTurret(game, t, amount) {
  t.hp -= amount;
  if (t.hp > 0) return;
  t.dead = true;
  t.rebuild = TURRET.rebuild;
  t.target = null;
  game.fx?.ring(t.x, t.y, 60, '#ffb45a');
  game.onTurretDown?.(t);
}

// ----------------------------------------------------------------- the gates

function teleport(game, u, dt) {
  u.padCool = Math.max(0, (u.padCool || 0) - dt);
  if (u.padCool > 0 || !game.pads.length) return;
  for (const p of game.pads) {
    if (dist2(u.x, u.y, p.x, p.y) > PAD.r * PAD.r) continue;
    u.x = p.to.x;
    u.y = p.to.y;
    // the cooldown belongs to the body and not to the pad: without it he lands
    // on the far gate and is thrown straight back, forever
    u.padCool = PAD.cool;
    u.vx *= 0.4;
    u.vy *= 0.4;
    game.fx?.ring(p.x, p.y, 46, '#5ce8cf');
    game.onGate?.(u, p);
    return;
  }
}

export { TARGET, carrierOf, flagPoint, sendHome };
