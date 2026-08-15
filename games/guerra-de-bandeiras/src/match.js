// The rules of capture the flag, and nothing else.
//
// They live apart from the shooting on purpose: everything in here is a
// decision a referee would make — who is holding what, what counts as a point,
// what happens to a flag whose carrier is face down on the deck — and every one
// of them is a rule a test can hold to account without a bullet in the air.
//
// The rule that shapes the whole match is the third one down: **a capture only
// counts while your own flag is in its stand.** Without it two squads sprint
// past each other for ten minutes and the score ends level; with it, somebody
// on every side has to turn round and go home.

import { FLAG, TARGET, TILE, dist, other } from './config.js';
import { cellOf, centreOf } from './grid.js';

export function createFlags(arena) {
  const make = (team) => ({
    team,
    home: { ...arena.flags[team] },
    state: 'home',                     // home | carried | dropped
    x: arena.flags[team].x,
    y: arena.flags[team].y,
    carrier: null,                     // the unit id holding it
    timer: 0,                          // how long it has been lying on the deck
  });
  return { human: make('human'), alien: make('alien') };
}

/** Where a flag is right now — its stand, its carrier, or the deck. */
export function flagPoint(game, flag) {
  if (flag.state === 'carried') {
    const u = game.unitById(flag.carrier);
    if (u) return { x: u.x, y: u.y };
  }
  return { x: flag.x, y: flag.y };
}

export function sendHome(game, flag, reason = 'returned') {
  flag.state = 'home';
  flag.x = flag.home.x;
  flag.y = flag.home.y;
  flag.carrier = null;
  flag.timer = 0;
  if (reason) game.say({ kind: reason, team: flag.team });
}

/**
 * The flag leaves a dead carrier's hands where he fell.
 *
 * Unless he fell over the pit, and then it goes straight home. Sliding it to
 * the nearest ledge was the first answer and it is worse than it sounds: on the
 * bridge that is two hundred pixels sideways, so a carrier shot over the void
 * *hands the flag forward* to whoever killed him. A flag that falls into the
 * dark is a flag back in its stand, which is what everybody expects anyway.
 */
export function dropFlag(game, unit) {
  const flag = game.flags[other(unit.team)];
  if (flag.state !== 'carried' || flag.carrier !== unit.id) return;
  const c = cellOf(unit.x, unit.y);
  if (!game.grid.walkable(c.cx, c.cy)) {
    sendHome(game, flag, 'returned');
    return;
  }
  const spot = centreOf(c.cx, c.cy);
  // it slides out of his hands, but never off its own tile
  flag.state = 'dropped';
  flag.carrier = null;
  flag.timer = 0;
  flag.x = spot.x + Math.max(-TILE * 0.3, Math.min(TILE * 0.3, unit.x - spot.x));
  flag.y = spot.y + Math.max(-TILE * 0.3, Math.min(TILE * 0.3, unit.y - spot.y));
  game.say({ kind: 'dropped', team: flag.team });
}

/**
 * Everything a body walking around does to a flag, resolved in the order a
 * referee would: you return your own before you pick up theirs, and you can
 * only score with the one you are actually carrying.
 */
export function touchFlags(game, unit) {
  if (unit.dead) return;
  const mine = game.flags[unit.team];
  const theirs = game.flags[other(unit.team)];

  // yours, lying on the deck: touching it sends it home, and that is what
  // re-opens your own end zone
  if (mine.state === 'dropped' && dist(unit.x, unit.y, mine.x, mine.y) <= FLAG.returnR + unit.r) {
    sendHome(game, mine, 'returned');
    game.credit(unit, 'return');
  }

  // theirs, in its stand or on the deck: you are carrying it now
  if ((theirs.state === 'home' || theirs.state === 'dropped')
      && dist(unit.x, unit.y, theirs.x, theirs.y) <= FLAG.pickR + unit.r) {
    theirs.state = 'carried';
    theirs.carrier = unit.id;
    theirs.timer = 0;
    game.say({ kind: 'taken', team: theirs.team, by: unit.team });
  }

  // and home with it — but only if your own is where it belongs
  if (theirs.state === 'carried' && theirs.carrier === unit.id) {
    const stand = mine.home;
    if (dist(unit.x, unit.y, stand.x, stand.y) <= FLAG.capR && mine.state === 'home') {
      sendHome(game, theirs, null);
      game.score[unit.team]++;
      game.credit(unit, 'capture');
      game.say({ kind: 'captured', team: unit.team });
      if (game.score[unit.team] >= TARGET) game.finish(unit.team);
    }
  }
}

/** A flag nobody came back for walks home by itself. */
export function updateFlags(game, dt) {
  for (const team of ['human', 'alien']) {
    const flag = game.flags[team];
    if (flag.state !== 'dropped') continue;
    flag.timer += dt;
    if (flag.timer >= FLAG.dropTime) sendHome(game, flag, 'returned');
  }
}

/** Who is carrying the flag of `team`, if anybody. */
export function carrierOf(game, team) {
  const flag = game.flags[team];
  return flag.state === 'carried' ? game.unitById(flag.carrier) : null;
}

export { TARGET };
