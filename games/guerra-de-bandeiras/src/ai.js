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
//   1. Am I holding their flag?          → home, and nothing else matters
//   2. Is somebody running off with ours? → after them
//   3. Is ours lying on the deck?         → touch it, that re-opens our end zone
//   4. Is one of mine carrying theirs?    → get between him and the field
//   5. Otherwise → my job: their flag, or the ground around ours

import { BOT_RANGE, botStats, dist, dist2, other, clamp } from './config.js';
import { cellOf, centreOf, stepAlong } from './grid.js';
import { carrierOf, flagPoint } from './match.js';

export function botOrders(game, u, dt) {
  const stats = botStats(game.arena.skill);
  const enemyTeam = other(u.team);
  const goal = chooseGoal(game, u, stats, dt);
  const target = pickTarget(game, u, stats, dt);

  const move = steer(game, u, goal, stats, dt);
  const orders = {
    mx: move.x,
    my: move.y,
    aimAt: target ? aimPoint(game, u, target, stats) : null,
    fire: false,
    dash: false,
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

  // The dash is spent on the two moments it was built for: getting a stolen
  // flag out of a hot end zone, and closing on the man carrying yours.
  const carrying = game.flags[enemyTeam].carrier === u.id;
  const hunting = goal.kind === 'chase';
  if ((carrying || hunting) && u.dashCool <= 0 && (move.x || move.y) && game.rng() < dt * 1.6) {
    orders.dash = true;
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
  // the player is always the raider, so he goes to the back of the queue and
  // the defending jobs are handed out to the bots first
  const squad = [...units].sort((a, b) => Number(b.bot) - Number(a.bot));
  const guards = Math.round(squad.length * stats.guard);
  squad.forEach((u, i) => {
    u.role = i < guards ? 'defend' : 'attack';
  });
  return squad;
}

function chooseGoal(game, u, stats, dt) {
  const enemyTeam = other(u.team);
  const mine = game.flags[u.team];
  const theirs = game.flags[enemyTeam];

  if (theirs.carrier === u.id) {
    return { kind: 'home', ...mine.home };
  }

  const raider = carrierOf(game, u.team);        // whoever is running off with ours
  if (raider) {
    // The standoff, and the reason this clause is not just "defenders chase".
    // Both flags out at once is the state capture the flag deadlocks in: each
    // carrier stands on his own stand, neither can score, and a squad that
    // keeps politely raiding an empty stand will still be there ten minutes
    // later. Ninety seconds of a bot-against-bot match went exactly that way.
    // With both flags in hands the only move on the board is the enemy
    // carrier, so **everybody** goes for him.
    const standoff = theirs.state === 'carried';
    const far = dist(u.x, u.y, raider.x, raider.y);
    if (standoff || u.role === 'defend' || far < 320) return { kind: 'chase', x: raider.x, y: raider.y };
  }

  if (mine.state === 'dropped') {
    const far = dist(u.x, u.y, mine.x, mine.y);
    if (u.role === 'defend' || far < 340) return { kind: 'recover', x: mine.x, y: mine.y };
  }

  const friend = carrierOf(game, enemyTeam);     // one of ours, holding theirs
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
  // also what puts him in the doorways rather than in the middle. The loop
  // advances with the clock and not with the frame: on a 144 Hz screen he
  // would otherwise pace his own base almost three times as fast.
  u.orbit += dt * (0.5 + (u.id % 3) * 0.2);
  const r = 96 + ((u.id * 37) % 60);
  return {
    kind: 'hold',
    x: mine.home.x + Math.cos(u.orbit) * r,
    y: mine.home.y + Math.sin(u.orbit) * r * 0.8,
  };
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
    const side = u.id % 2 ? 1 : -1;
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
function aimPoint(game, u, target, stats) {
  const gun = game.gun(u);
  const travel = dist(u.x, u.y, target.x, target.y) / gun.speed;
  const k = clamp(stats.lead, 0, 1) * travel;
  return { x: target.x + target.vx * k, y: target.y + target.vy * k };
}
