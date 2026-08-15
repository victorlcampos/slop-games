// Four soldiers who have never heard of you, deciding what to do about the
// flag.
//
// There is no squad brain here and there deliberately isn't one: a coordinator
// that assigns the perfect job to each body plays a flawless, unreadable match.
// Every bot answers the same short list of questions in the same order, and the
// team play falls out of the answers — three of them converge on a carrier
// because a carrier is the first thing on the list, not because anybody told
// them to.
//
// The list, from the top:
//
//   1. Am I holding a flag?               → my own stand, and nothing else matters
//   2. Is somebody running off with ours?  → after them
//   3. Is ours lying on the deck?          → fetch it, and carry it home
//   4. Is one of mine carrying one?        → get between him and the field
//   5. Otherwise → my job: their flag, or the ground around ours

import { BOT_RANGE, botStats, dist, dist2, other, clamp } from './config.js';
import { cellOf, centreOf, stepAlong } from './grid.js';
import { carrierOf, carriedBy, flagPoint } from './match.js';

export function botOrders(game, u, dt) {
  const stats = botStats(game.arena.skill);
  const enemyTeam = other(u.team);
  const goal = chooseGoal(game, u, stats, dt);
  const target = pickTarget(game, u, stats, dt);

  const move = steer(game, u, goal, stats, dt);
  const orders = {
    mx: move.x,
    my: move.y,
    // the same shape the player's thumbs write: an angle and, when there is
    // one, the man it belongs to — which is what makes the trigger wait for the
    // shoulders for a bot exactly as it does for you
    aim: target ? aimAt(game, u, target, stats) : null,
    fire: false,
    roll: false,
  };

  if (target) {
    // The delay is the whole of a bot's "skill". It is time between *seeing*
    // and *firing*, not an accuracy roll: a bot that misses on purpose feels
    // broken, and a bot that is simply slow on the draw feels beatable.
    u.aimT += dt;
    orders.fire = u.aimT >= stats.react;
  } else {
    u.aimT = 0;
  }

  // The roll is spent on the two moments it was built for: getting a stolen
  // flag out of a hot end zone, and closing on the man carrying yours.
  const carrying = !!carriedBy(game, u);
  const hunting = goal.kind === 'chase';
  if ((carrying || hunting) && u.rollCool <= 0 && (move.x || move.y) && game.rng() < dt * 1.6) {
    // a press, not a hold: the roll is edge-triggered, so it has to fall again
    orders.roll = !u.rollWas;
  }

  return orders;
}

/**
 * Assign the standing jobs. The split between the two is the skill dial's — and
 * it is counted over the **whole squad**, the player included.
 *
 * Counting it over the bots alone is what the first draft did, and because the
 * player is one of five bodies on his side, his squad came out one defender
 * short of the enemy's every match from arena four on. It did not read as a bug;
 * it read as the sentinels being better, which is the worst way for a game to
 * be unfair.
 */
export function assignRoles(units, skill) {
  const stats = botStats(skill);
  const squad = [...units].sort((a, b) => a.spawnIndex - b.spawnIndex);
  const guards = Math.round(squad.length * stats.guard);
  // The defending jobs go to the **back of the squad by spawn**, never to
  // whoever happens to be a bot. Handing them out bots-first looks equivalent
  // and is not: the player is one body on his side, so his squad's defenders
  // came from one set of spawns and the enemy's from another — the enemy always
  // had a body starting on its stand and yours never did. On a field that
  // mirrors cell for cell, the two squads have to start as each other's
  // reflection, and body number one is the raider on both sides.
  squad.forEach((u, i) => {
    const from = squad.length - guards;
    u.role = i >= from ? 'defend' : 'attack';
    // its place among the bodies doing that job, 0 upwards — the orbit and the
    // sidestep read this and never an id or a spawn
    u.slot = i >= from ? i - from : i;
  });
  return squad;
}

function chooseGoal(game, u, stats, dt) {
  const enemyTeam = other(u.team);
  const mine = game.flags[u.team];
  const theirs = game.flags[enemyTeam];

  // his own stand answers two different jobs: arriving with their flag is a
  // point, arriving with his own puts it back in the ground
  if (theirs.carrier === u.id || mine.carrier === u.id) {
    return { kind: 'home', ...mine.home };
  }

  const holder = carrierOf(game, u.team);        // whoever has ours, whichever side
  if (holder && holder.team !== u.team) {
    // The standoff, and the reason this clause is not just "defenders chase".
    // Both flags out at once is the state capture the flag deadlocks in: each
    // carrier stands on his own stand, neither can score, and a squad that
    // keeps politely raiding an empty stand will still be there ten minutes
    // later. Ninety seconds of a bot-against-bot match went exactly that way.
    // With both flags in hands the only move on the board is the enemy
    // carrier, so **everybody** goes for him.
    const standoff = theirs.state === 'carried';
    const far = dist(u.x, u.y, holder.x, holder.y);
    if (standoff || u.role === 'defend' || far < 320) {
      return { kind: 'chase', x: holder.x, y: holder.y };
    }
  }

  // Ours on the deck. It does not walk home by itself any more, so this is a
  // job somebody has to take: every defender, anybody close, and — whatever
  // else is happening — the nearest body on the squad. A flag nobody fetches is
  // a squad that cannot score, because a point needs its own flag in its stand.
  if (mine.state === 'dropped') {
    const far = dist(u.x, u.y, mine.x, mine.y);
    if (u.role === 'defend' || far < 420 || nearestFree(game, u, mine) === u) {
      return { kind: 'recover', x: mine.x, y: mine.y };
    }
  }

  // one of ours walking a flag home — either one — is worth walking with
  const friend = carrierOf(game, enemyTeam) || (holder && holder.team === u.team ? holder : null);
  if (friend && friend.id !== u.id && u.role === 'attack'
      && dist(u.x, u.y, friend.x, friend.y) < 520) {
    return { kind: 'escort', x: friend.x, y: friend.y };
  }

  if (u.role === 'attack') {
    const p = flagPoint(game, theirs);
    return { kind: 'raid', x: p.x, y: p.y };
  }

  // A defender standing on the stand is a defender who dies to the first shot
  // of a man he never saw. He walks a slow loop around it instead, which is
  // also what puts him in the doorways rather than in the middle. The lap is
  // timed off `u.slot` — his place among his own squad's defenders — and never
  // off an id or a spawn: see `assignRoles` for what that cost.
  u.orbit += dt * (0.5 + (u.slot % 3) * 0.2);
  const r = 132 + (u.slot % 3) * 56;
  // and the lap is walked **towards the field**, which is a different direction
  // for each side: an orbit that ran east for both squads put one defender in
  // front of his stand and the other behind his at every moment of the match.
  // The arena is a mirror; anything that walks on it has to be one too.
  const forward = u.team === 'human' ? 1 : -1;
  return {
    kind: 'hold',
    x: mine.home.x + Math.cos(u.orbit) * r * forward,
    y: mine.home.y + Math.sin(u.orbit) * r * 0.8,
  };
}

/** The closest body on this squad with its hands free — the one who fetches. */
function nearestFree(game, u, flag) {
  let best = null;
  let bestD = Infinity;
  for (const m of game.units) {
    if (m.dead || m.team !== u.team || carriedBy(game, m)) continue;
    const d = dist(m.x, m.y, flag.x, flag.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/**
 * Which way to walk. Straight at the goal when the line is walkable and short,
 * and along a flow field when it is not — plus a shove away from whoever is
 * standing on top of you, which is what stops four bots becoming one bot with
 * four guns.
 */
function steer(game, u, goal, stats, dt) {
  let dx = goal.x - u.x;
  let dy = goal.y - u.y;
  const far = Math.hypot(dx, dy);

  if (far < 14) return { x: 0, y: 0 };

  const straight = far < 260 && game.walkableLine(u.x, u.y, goal.x, goal.y, u.r);
  if (!straight) {
    const field = game.fieldTo(goal.x, goal.y);
    const here = cellOf(u.x, u.y);
    const next = field && stepAlong(field, game.grid, here.cx, here.cy);
    if (next) {
      const c = centreOf(next.cx, next.cy);
      dx = c.x - u.x;
      dy = c.y - u.y;
    }
  }

  let len = Math.hypot(dx, dy) || 1;
  let vx = dx / len;
  let vy = dy / len;

  // The shove away from a teammate **falls off with distance**, and that is not
  // a polish detail. A constant push cost the game its first bridge match: two
  // bots side by side in front of a one-tile doorway pushed each other exactly
  // as hard as the route pulled them through it, and both stood there for the
  // rest of the match — nobody scored in four hundred seconds. Close enough to
  // touch it still separates them; a body away it is worth nothing.
  const reach = u.r * 2.4;
  for (const mate of game.units) {
    if (mate === u || mate.dead || mate.team !== u.team) continue;
    const d2 = dist2(u.x, u.y, mate.x, mate.y);
    if (d2 > reach * reach || d2 < 1) continue;
    const d = Math.sqrt(d2);
    const push = 0.5 * (1 - d / reach);
    vx += ((u.x - mate.x) / d) * push;
    vy += ((u.y - mate.y) / d) * push;
  }

  len = Math.hypot(vx, vy) || 1;
  let out = { x: vx / len, y: vy / len };

  // And the last resort, for the corner nothing above foresaw: a body that has
  // been asking to move and going nowhere for half a second walks sideways for
  // a moment. Which side it picks comes from its own id, so two bots wedged
  // against each other never pick the same one.
  if (Math.hypot(u.vx, u.vy) < 40) u.stuck += dt;
  else u.stuck = 0;
  if (u.stuck > 0.5) {
    // which way he steps out is his own, but the *handedness* is his side's:
    // a quarter turn one way on the left half is a quarter turn the other way
    // on the right, or the two squads stop being each other's reflection
    const side = (u.slot % 2 ? 1 : -1) * (u.team === 'human' ? 1 : -1);
    out = { x: -out.y * side, y: out.x * side };
    if (u.stuck > 0.9) u.stuck = 0;
  }
  return out;
}

/** The nearest enemy this bot can actually see, inside the reach of its gun. */
function pickTarget(game, u, stats, dt) {
  const reach = Math.min(game.gun(u).range, BOT_RANGE);
  let best = null;
  let bestD = Infinity;
  for (const e of game.units) {
    if (e.dead || e.team === u.team) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d > reach || d > bestD) continue;
    if (!game.visibleTo(u, e.x, e.y)) continue;
    best = e;
    bestD = d;
  }
  // it drops the target the moment the target is gone, but keeps walking at the
  // corner it went round for a moment — `hold` is the length of that moment
  if (!best && u.target && !u.target.dead && u.holdT > 0) {
    u.holdT -= dt;
    return null;
  }
  u.target = best;
  if (best) u.holdT = botStats(game.arena.skill).hold;
  return best;
}

/**
 * Where to point. A bot with `lead` at 1 aims where you are going to be, which
 * is the difference between a rifle you can walk sideways out of and one you
 * cannot.
 */
function aimAt(game, u, target, stats) {
  const gun = game.gun(u);
  const travel = dist(u.x, u.y, target.x, target.y) / gun.speed;
  const k = clamp(stats.lead, 0, 1) * travel;
  const x = target.x + target.vx * k;
  const y = target.y + target.vy * k;
  return { angle: Math.atan2(y - u.y, x - u.x), target };
}
