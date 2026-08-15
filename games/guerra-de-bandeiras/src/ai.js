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
//   2. Am I nearly dead with a gun on me?  → back off and let it knit
//   3. Is somebody running off with ours?  → after them
//   4. Is ours lying on the deck?          → fetch it, and carry it home
//   5. Is there a gun on the deck worth more than mine, and is it on my way?
//   6. Is one of mine carrying one?        → get between him and the field
//   7. Otherwise → my job: their flag by my own lane, or the ground around ours
//
// What stops all that reading as one bot copied five times is the last line and
// the three below it: **a raider crosses by his own lane**, a body under fire
// strafes rather than walking into it, a body that has just been hit rolls, and
// a body standing on its own ground with shards in its pocket goes shopping.
// None of that changes what a bot wants; all of it changes what watching one
// looks like.

import { ARENA_W, BOT_RANGE, HALF, ROWS, TILE, UNIT, botStats, dist, dist2, other, clamp } from './config.js';
import { cellOf, centreOf, stepAlong } from './grid.js';
import { carrierOf, carriedBy, flagPoint } from './match.js';
import { ARMOURY, STANDARD, worth } from './weapons.js';

export function botOrders(game, u, dt) {
  const stats = botStats(game.arena.skill);
  const enemyTeam = other(u.team);
  shop(game, u);
  const goal = chooseGoal(game, u, stats, dt);
  const target = pickTarget(game, u, stats, dt);

  const move = steer(game, u, goal, stats, dt, target);
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

  // The roll is spent on three moments: getting a stolen flag out of a hot end
  // zone, closing on the man carrying yours, and **the second after being hit**
  // — which is the one that reads as somebody reacting rather than walking.
  const carrying = !!carriedBy(game, u);
  const hunting = goal.kind === 'chase';
  const stung = u.hurt > 0 && u.hp < UNIT.hp * 0.75;
  const wants = (carrying || hunting ? dt * 1.6 : 0) + (stung ? dt * 2.4 * stats.lead : 0);
  if (u.rollCool <= 0 && (move.x || move.y) && game.rng() < wants) {
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

  // Nearly dead, with somebody shooting at him: he backs off towards his own
  // ground and lets the bleeding stop. It is the same body five seconds later
  // instead of a respawn timer, and it is why REGEN exists.
  if (AI_FLAGS.retreat && u.hp < UNIT.hp * 0.34 && u.target && !atHome(u)) {
    return { kind: 'retreat', x: mine.home.x, y: mine.home.y };
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

  // a better gun lying on the deck, near enough to be worth the detour
  // …but only one that is nearly under his feet **and on his way**. A soldier
  // who turns round for a gun is a soldier not crossing the field for the flag,
  // and measured against a squad that ignores them entirely, detouring cost a
  // tenth of the captures on its own.
  let bestGun = null;
  let bestGunD = 220;
  const ahead = u.team === 'human' ? 1 : -1;
  for (const d of game.drops) {
    if (worth(d.id) <= worth(u.weapon.id)) continue;
    if (u.role === 'attack' && (d.x - u.x) * ahead < -TILE) continue;
    const far = dist(u.x, u.y, d.x, d.y);
    if (far < bestGunD) {
      bestGunD = far;
      bestGun = d;
    }
  }
  if (bestGun && AI_FLAGS.loot) return { kind: 'loot', x: bestGun.x, y: bestGun.y };

  // one of ours walking a flag home — either one — is worth walking with
  const friend = carrierOf(game, enemyTeam) || (holder && holder.team === u.team ? holder : null);
  if (friend && friend.id !== u.id && u.role === 'attack'
      && dist(u.x, u.y, friend.x, friend.y) < 520) {
    return { kind: 'escort', x: friend.x, y: friend.y };
  }

  if (u.role === 'attack') {
    const p = flagPoint(game, theirs);
    // **Each raider comes at the stand from his own side of it.** The first
    // draft sent them to a gap on the centre line and then to the flag, which
    // looked right and cost the match a third of its captures: a dogleg in the
    // middle of a run is a second and a half of walking away from where you are
    // going. The variety that is worth paying for is at the other end — three
    // bodies arriving from three directions rather than in single file — and it
    // costs nothing, because the detour only exists while they are still far
    // enough out for it to be free.
    const far = dist(u.x, u.y, p.x, p.y);
    if (AI_FLAGS.lanes && far > 260) {
      const lanes = lanesOf(game.arena).length;
      const a = ((u.lane % lanes) / lanes) * Math.PI * 2;
      return { kind: 'raid', x: p.x + Math.cos(a) * 150, y: p.y + Math.sin(a) * 150 };
    }
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

/**
 * Standing on his own ground with shards in his pocket: he buys.
 *
 * Which gun is not the same answer for every body, and that is on purpose —
 * a squad that all bought the lance is a squad that fights the same way at
 * every range. A defender takes the shortest gun he can get, a raider the
 * longest, and everybody tops up the one they already like rather than
 * hoarding for the next one up.
 */
function shop(game, u) {
  if (!game.inBase(u) || u.dead) return;
  const held = worth(u.weapon.id);
  const wants = u.role === 'defend' ? ['scatter', 'repeater', 'lance'] : ['lance', 'repeater', 'scatter'];
  // top the current one up before trading up: a gun with two rounds in it is a
  // starting gun that is about to surprise him
  const low = u.weapon.id !== STANDARD && u.weapon.ammo <= ARMOURY.find((w) => w.id === u.weapon.id).ammo * 0.25;
  const order = low ? [u.weapon.id, ...wants] : wants;
  for (const id of order) {
    const w = ARMOURY.find((g) => g.id === id);
    if (!w || u.shards < w.cost) continue;
    if (!low && worth(id) <= held) continue;
    game.buy(u, id);
    return;
  }
}

/**
 * The three ways across, worked out from the field itself: the open stretches
 * of the centre line, top to bottom.
 *
 * Raiders pick one each and keep it until they die. It is the cheapest variety
 * there is — the same five bots with the same list of wants stop arriving in
 * single file down the same corridor, which is what "the bots are repetitive"
 * looks like from the outside.
 */
export const AI_FLAGS = { lanes: true, loot: true, retreat: true, strafe: true, rethink: true };

const LANES = new WeakMap();

export function lanesOf(arena) {
  const kept = LANES.get(arena);
  if (kept) return kept;
  const out = [];
  let run = [];
  // A long open stretch is not one way across, it is three. Splitting it is
  // what makes the lanes mean anything on the arenas whose middle is a hall:
  // measured by the gaps alone, Twin Corridors has exactly one, and five
  // raiders given "the gap" arrive in single file.
  const flush = () => {
    if (!run.length) return;
    const n = Math.max(1, Math.min(3, Math.round(run.length / 4)));
    for (let i = 0; i < n; i++) {
      out.push(centreOf(HALF, run[Math.floor(((i + 0.5) / n) * run.length)]));
    }
    run = [];
  };
  for (let cy = 1; cy < ROWS - 1; cy++) {
    if (arena.grid.walkable(HALF - 1, cy) && arena.grid.walkable(HALF, cy)) run.push(cy);
    else flush();
  }
  flush();
  LANES.set(arena, out.length ? out : [centreOf(HALF, Math.floor(ROWS / 2))]);
  return LANES.get(arena);
}

/** Which half of the field is this body's own. */
const atHome = (u) => (u.team === 'human' ? u.x < ARENA_W / 2 : u.x > ARENA_W / 2);

/**
 * What a body decides to be, each time it comes back.
 *
 * The jobs were handed out once at the start, and a squad whose shape never
 * changes plays the same match from 0-0 to 9-9. This is the cheapest way to
 * make it answer what is happening: with our flag out somebody usually turns
 * round, two goals behind somebody usually goes forward, and the rest keep the
 * split the arena asked for. It also re-rolls his lane, so a raider who died
 * coming through the middle comes back down the side.
 */
export function reconsider(game, u, rng = Math.random) {
  if (!AI_FLAGS.rethink) return u.role;
  // The lane **rotates**: he comes back at the enemy stand from the next side
  // round rather than the one he died on. It is deliberately not drawn from a
  // hat — a squad picking lanes at random clumps two or three onto the same one
  // and they die together.
  u.lane = (u.lane + 1) % lanesOf(game.arena).length;
  return u.role;
}

// And the job he comes back to is the job he had. Three versions of "let him
// answer what is happening" are in the history of this file and every one of
// them cost the match half its captures, because every one of them was a
// ratchet: weighted towards defence while a flag was out, counting only the
// defenders still standing, or promoting an attacker whenever the one defender
// was on the respawn clock. A squad of four has one defender and loses him
// every twenty seconds, so "nobody is minding the stand" is true most of the
// time and the whole squad walks home to mind it. The split is set once, by
// `assignRoles`, from the arena's own dial — and a bot that cannot decide what
// it is is not a more interesting bot, it is a bot that never arrives.

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
function steer(game, u, goal, stats, dt, target) {
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

  // A body in a firefight does not walk into it in a straight line. Close in,
  // he slides around the man he is shooting at, and the side he slides to flips
  // every second or so — which is both harder to hit and the thing that makes
  // two bots meeting look like a fight rather than a collision.
  if (AI_FLAGS.strafe && target && dist2(u.x, u.y, target.x, target.y) < 210 * 210) {
    u.strafe -= dt;
    if (u.strafe <= 0) {
      u.strafe = 0.8 + game.rng() * 0.9;
      u.strafeSide = -u.strafeSide;
    }
    const ax = target.x - u.x;
    const ay = target.y - u.y;
    const al = Math.hypot(ax, ay) || 1;
    vx += (-ay / al) * u.strafeSide * 0.55;
    vy += (ax / al) * u.strafeSide * 0.55;
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
