// The machine, played in Node: launch, flip, score, shake, tilt, drain.
//
// Everything here drives game.update() at the same fixed step main.js uses —
// there is no canvas and no clock, just the simulation and its numbers.

import { scenario, check, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';
import { createGame } from '../src/game.js';
import { DICT } from '../src/i18n.js';
import { reflect, closestOnSegment, collideSegment } from '../src/physics.js';
import { PLUNGER, plungerSpeed, RULES, TABLE, PHYS, FLIPPER, MISSIONS, RANKS } from '../src/config.js';
import { flipperTip } from '../src/table.js';

const STEP = 1 / 120;
const IDLE = {};

/** Run `seconds` of game time with a constant input. */
function play(game, seconds, input = IDLE) {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
}

/** Hold the plunger for `pull` seconds, release, and let the spring do its work. */
function launch(game, pull = 1) {
  play(game, pull, { plunger: true });
  play(game, 0.1);
}

/** The fastest the ball goes up the lane over the next `seconds`. */
function peakLaunch(game, seconds = 0.3) {
  let peak = 0;
  for (let t = 0; t < seconds; t += STEP) {
    game.update(STEP, {});
    peak = Math.min(peak, game.ball.vy);
  }
  return -peak;
}

/** Park the ball in open field, mid-table — wherever the launch bounced it. */
function settle(game) {
  game.state.phase = 'play';
  game.state.holeTimer = 0;
  game.ball.x = 244;
  game.ball.y = 480;
  game.ball.vx = 0;
  game.ball.vy = 0;
}


/** Is (x,y) somewhere a ball could actually be, or is it inside the furniture? */
function clearOfEverything(tbl, x, y, r = PHYS.ballR) {
  const segs = [...tbl.walls, tbl.plunger.face, ...tbl.targets];
  for (const s of tbl.slings) segs.push(s.face, ...s.body);
  for (const f of tbl.flippers) {
    const tip = flipperTip(f);
    segs.push({ x1: f.px, y1: f.py, x2: tip.x, y2: tip.y, rad: f.r });
  }
  for (const s of segs) {
    const q = closestOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
    if (Math.hypot(x - q.x, y - q.y) < r + (s.rad || 0) + 0.5) return false;
  }
  for (const p of [...tbl.posts, ...tbl.bumpers]) if (Math.hypot(x - p.x, y - p.y) < r + p.r + 0.5) return false;
  // and not sealed inside a slingshot, which is a triangle with no way in
  for (const s of tbl.slings) {
    const behind = (x - s.face.x1) * s.n.x + (y - s.face.y1) * s.n.y < 0;
    const lo = Math.min(s.face.y1, s.face.y2) - 12;
    const hi = Math.max(s.face.y1, s.face.y2) + 12;
    if (behind && y > lo && y < hi) return false;
  }
  return true;
}

// ------------------------------------------------------------------ physics

scenario('a reflection keeps the speed it was given', () => {
  const ball = { vx: 0, vy: 300 };
  reflect(ball, 0, -1, 1);
  check(Math.abs(ball.vy + 300) < 1e-9, `bounced at ${ball.vy}, expected -300`);
  const leaving = { vx: 0, vy: -50 };
  check(reflect(leaving, 0, -1, 1) === 0, 'a ball already leaving the surface was reflected anyway');
});

scenario('a capsule pushes the ball out on the side it came from', () => {
  const ball = { x: 10, y: 4, vx: 0, vy: 60, r: 9 };
  const hit = collideSegment(ball, { x1: 0, y1: 10, x2: 20, y2: 10, rad: 3 });
  check(hit > 0, 'no contact reported');
  check(ball.y <= 10 - 3 - 9 + 0.01, `ball left inside the wall at y=${ball.y.toFixed(2)}`);
  check(ball.vy < 0, `still moving into the wall at vy=${ball.vy.toFixed(1)}`);
  const q = closestOnSegment(30, 0, 0, 10, 20, 10);
  check(q.x === 20 && q.y === 10, `closest point clamped to (${q.x},${q.y})`);
});

// ------------------------------------------------------------------ the plunger

scenario('the rod draws the ball down the lane with it', () => {
  const game = createGame({});
  const rest = game.ball.y;
  play(game, PLUNGER.pullTime, { plunger: true });
  const face = game.table.plunger.face.y1;
  check(game.table.plunger.p > PLUNGER.travel - 0.5, `a full hold only drew the rod back ${game.table.plunger.p.toFixed(1)}px`);
  check(game.ball.y > rest + PLUNGER.travel - 1, `the ball stayed at ${game.ball.y.toFixed(1)} while the rod went to ${face.toFixed(1)}`);
  check(
    Math.abs(game.ball.y - (face - PHYS.ballR - PLUNGER.tipRad)) < 0.6,
    `the ball is ${(face - game.ball.y).toFixed(1)}px off a rod it should be resting on`,
  );
});

scenario('the spring gives back exactly what was put into it', () => {
  // A pull of p leaves the stop at p*sqrt(k) and the ball is carried, not
  // struck, so the ball leaves at that speed — every partial pull in between
  // follows from the same spring with nothing to tune.
  const speeds = [0.15, 0.3, PLUNGER.pullTime].map((hold) => {
    const game = createGame({});
    play(game, hold, { plunger: true });
    const pull = game.table.plunger.p;
    return { pull, got: peakLaunch(game), want: plungerSpeed(pull) };
  });
  for (const s of speeds) {
    check(Math.abs(s.got - s.want) < s.want * 0.05 + 15,
      `a ${s.pull.toFixed(0)}px pull threw ${s.got.toFixed(0)}, the spring holds ${s.want.toFixed(0)}`);
  }
  check(speeds[0].got < speeds[1].got && speeds[1].got < speeds[2].got,
    `harder pulls did not throw harder: ${speeds.map((s) => s.got.toFixed(0)).join(' < ')}`);
});

scenario('a full pull sends the ball over the arch into the playfield', () => {
  const game = createGame({});
  launch(game, 1.2);
  // watch the whole flight: the ball may legitimately drain into the saver's
  // arms inside this window, so the snapshot that matters is the crossing
  let entered = false;
  let saverArmed = false;
  for (let t = 0; t < 2.5; t += STEP) {
    game.update(STEP, {});
    if (game.state.inPlayfield && game.ball.x < TABLE.laneWall) entered = true;
    if (game.state.ballSave > 0) saverArmed = true;
  }
  check(entered, `the ball never crossed into the playfield — it ended at (${game.ball.x.toFixed(0)}, ${game.ball.y.toFixed(0)})`);
  check(saverArmed, 'entering play never armed the ball saver');
});

scenario('a timid pull comes back down the lane and lands on the rod', () => {
  // The bug this replaces: the ball used to be *teleported* back onto the
  // plunger, which on screen is a ball passing straight through the spring.
  const game = createGame({});
  const rest = game.ball.y;
  play(game, 0.1, { plunger: true });
  game.update(STEP, {});
  let jump = 0;
  let last = game.ball.y;
  let rose = 0;
  for (let t = 0; t < 4; t += STEP) {
    game.update(STEP, {});
    jump = Math.max(jump, Math.abs(game.ball.y - last));
    rose = Math.max(rose, rest - game.ball.y);
    last = game.ball.y;
  }
  check(rose > 4, `the weak plunge moved the ball ${rose.toFixed(1)}px`);
  check(jump < 12, `the ball moved ${jump.toFixed(1)}px in one step — something put it there`);
  check(Math.abs(game.ball.y - rest) < 1, `it settled at ${game.ball.y.toFixed(1)} instead of on the rod at ${rest.toFixed(1)}`);
  check(game.state.phase === 'plunger', `the weak ball ended in phase "${game.state.phase}"`);
  check(game.state.balls === RULES.balls, 'a failed plunge cost a ball');
});

scenario('the rod is a wall even when nobody is touching it', () => {
  const game = createGame({});
  launch(game, PLUNGER.pullTime);
  play(game, 6); // it is out in the playfield now; drop a ball back down the lane
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.ball.x = PLUNGER.x;
  game.ball.y = 420;
  game.ball.vx = 0;
  game.ball.vy = 300;
  play(game, 2);
  check(game.ball.y < PLUNGER.restY, `the ball fell to ${game.ball.y.toFixed(0)}, past a rod resting at ${PLUNGER.restY}`);
  check(game.state.balls === RULES.balls, 'a ball in the shooter lane drained');
});

scenario('a launch finds the table, not the drain', () => {
  // Where the deflector post above the wormhole stands decides what every
  // launch does, and it is not obvious by eye: one position twelve pixels away
  // from the one in the table sent nine launches in ten down the right-hand
  // side and out of the outlane without touching a single scoring thing. This
  // fires every pull strength that clears the lane, with nobody on the
  // flippers, and counts how many find something.
  const LIVE = ['bumper', 'sling', 'target', 'hole', 'rollover', 'spinner', 'orbit'];
  let cleared = 0;
  let found = 0;
  for (let hold = 0.4; hold <= PLUNGER.pullTime; hold += 0.01) {
    const seen = [];
    const game = createGame({ onEvent: (e) => seen.push(e) });
    play(game, hold, { plunger: true });
    play(game, 8);
    if (!game.state.inPlayfield && !seen.includes('drain') && !seen.includes('save')) continue;
    cleared++;
    if (seen.some((e) => LIVE.includes(e))) found++;
  }
  check(cleared > 8, `only ${cleared} pull strengths reached the playfield at all`);
  check(found / cleared > 0.35, `${found} of ${cleared} launches touched anything scoring on the way down`);
});

// ------------------------------------------------------------------ flippers

scenario('a pressed flipper travels to its raised angle and back', () => {
  const game = createGame({});
  const f = game.table.flippers[0];
  play(game, 0.5, { left: true });
  check(Math.abs(f.angle - FLIPPER.up) < 1e-6, `held, the flipper sits at ${f.angle.toFixed(2)} instead of ${FLIPPER.up}`);
  play(game, 0.5);
  check(Math.abs(f.angle - FLIPPER.rest) < 1e-6, `released, the flipper sits at ${f.angle.toFixed(2)} instead of ${FLIPPER.rest}`);
});

scenario('a flip throws a ball resting on the flipper up the table', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  const f = game.table.flippers[0];
  const tip = flipperTip(f);
  // park the ball on the arm, halfway out
  game.ball.x = (f.px + tip.x) / 2;
  game.ball.y = (f.py + tip.y) / 2 - game.ball.r - f.r - 0.5;
  game.ball.vx = 0;
  game.ball.vy = 20;
  play(game, 0.25, { left: true });
  check(game.ball.vy < -200, `the flip sent the ball at vy=${game.ball.vy.toFixed(0)} — not a throw`);
});

// ------------------------------------------------------------------ scoring

scenario('a bumper pays, kicks, and counts toward the barricades mission', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  const b = game.table.bumpers[0];
  game.ball.x = b.x;
  game.ball.y = b.y - b.r - game.ball.r + 2; // overlapping from above
  game.ball.vx = 0;
  game.ball.vy = 120;
  game.update(STEP, {});
  check(game.state.score >= RULES.score.bumper, `the bumper paid ${game.state.score}`);
  check(game.ball.vy < 0, `the bumper never kicked — vy=${game.ball.vy.toFixed(0)}`);
  check(game.state.progress === 1, `mission progress at ${game.state.progress}`);
});

scenario('lighting all three lanes raises the multiplier and resets the lights', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  for (const r of game.table.rollovers) {
    game.ball.x = r.x;
    game.ball.y = r.y;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.update(STEP, {});
    game.ball.y = 400; // leave the sensor between passes
    game.update(STEP, {});
    game.ball.vy = 0;
  }
  check(game.state.mult === 2, `the multiplier is x${game.state.mult}`);
  check(game.table.rollovers.every((r) => !r.lit), 'the lanes never reset for the next lap');
  const paid = RULES.score.rollover * 3 + RULES.score.lanesDone;
  check(game.state.score >= paid, `three lanes and the bonus paid ${game.state.score}, expected at least ${paid}`);
});

scenario('the multiplier multiplies what the table pays', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.mult = 3;
  const before = game.state.score;
  const b = game.table.bumpers[1];
  game.ball.x = b.x;
  game.ball.y = b.y - b.r - game.ball.r + 2;
  game.ball.vy = 120;
  game.update(STEP, {});
  check(game.state.score - before === RULES.score.bumper * 3,
    `at x3 the bumper paid ${game.state.score - before}`);
});

scenario('dropping the whole target bank pays the bonus and re-arms the kickback', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.table.kickback.lit = false;
  for (const tg of game.table.targets) {
    game.ball.x = (tg.x1 + tg.x2) / 2 + 12;
    game.ball.y = (tg.y1 + tg.y2) / 2 - 6;
    game.ball.vx = -260;
    game.ball.vy = 0;
    play(game, 0.1);
    check(!tg.up, `target ${tg.id} is still standing`);
  }
  const floor = RULES.score.target * 3 + RULES.score.bank;
  check(game.state.score >= floor, `the bank paid ${game.state.score}, expected at least ${floor}`);
  check(game.table.kickback.lit, 'clearing the bank never re-armed the kickback');
  play(game, 1.5);
  check(game.table.targets.every((tg) => tg.up), 'the bank never stood back up');
});

scenario('the wormhole swallows the ball, pays, and spits it back out', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.ball.x = game.table.hole.x;
  game.ball.y = game.table.hole.y;
  game.ball.vx = 0;
  game.ball.vy = 30;
  game.update(STEP, {});
  check(game.state.phase === 'captured', `the hole never captured — phase "${game.state.phase}"`);
  check(game.state.score >= RULES.score.hole, `the hole paid ${game.state.score}`);
  play(game, 1.2);
  check(game.state.phase === 'play', 'the hole never let go');
  const speed = Math.hypot(game.ball.vx, game.ball.vy);
  check(speed > 300, `ejected at ${speed.toFixed(0)} px/s — barely a spit`);
});

scenario('the lit kickback rescues an outlane ball, once', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.ballSave = 0;
  check(game.table.kickback.lit, 'the kickback starts unlit');
  game.ball.x = game.table.kickback.x;
  game.ball.y = game.table.kickback.y - 20;
  game.ball.vx = 0;
  game.ball.vy = 200;
  play(game, 0.15);
  check(game.ball.vy < 0, `the kickback never fired — vy=${game.ball.vy.toFixed(0)}`);
  check(!game.table.kickback.lit, 'the kickback stayed lit after firing');
  check(game.state.balls === RULES.balls, 'the rescued ball was counted as drained');
});

// ------------------------------------------------------------------ sensors

/** Drop the ball onto a sensor and take it away again. */
function sweep(game, s, vx = 0, vy = 60) {
  game.ball.x = s.x;
  game.ball.y = s.y;
  game.ball.vx = vx;
  game.ball.vy = vy;
  game.update(STEP, {});
  game.ball.x = 250;
  game.ball.y = 470;
  game.update(STEP, {});
}

scenario('the spinner pays by how hard it was hit', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  const slow = createGame({});
  slow.state.phase = 'play';
  slow.state.inPlayfield = true;

  sweep(game, game.table.spinner, 900, 0);
  sweep(slow, slow.table.spinner, 60, 0);
  check(game.state.score > slow.state.score,
    `a fast pass paid ${game.state.score} and a slow one ${slow.state.score}`);
  check(slow.state.score >= RULES.score.spinner * 5, `the slow pass paid only ${slow.state.score}`);
  check(game.state.progress === 0 || game.state.mission !== 0, 'the spinner advanced the bumper mission');
});

scenario('a spinner still in the sensor is not a spinner hit every frame', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.ball.x = game.table.spinner.x;
  game.ball.y = game.table.spinner.y;
  game.ball.vx = 0;
  game.ball.vy = 0;
  for (let i = 0; i < 40; i++) game.update(STEP, {});
  check(game.state.score < RULES.score.spinner * 25,
    `parked on the spinner it racked up ${game.state.score}`);
});

scenario('the orbit needs both ends of it, in the same trip', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  const [left, right] = game.table.loops;

  sweep(game, left);
  const half = game.state.score;
  sweep(game, right);
  check(game.state.score - half >= RULES.score.orbit, `the full orbit paid ${game.state.score - half}`);

  // and the same end twice is not an orbit
  const before = game.state.score;
  sweep(game, left);
  sweep(game, left);
  check(game.state.score - before < RULES.score.orbit, 'one end, hit twice, counted as a lap');
});

scenario('the orbit forgets a half-lap the player never finished', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  const [left, right] = game.table.loops;
  sweep(game, left);
  play(game, RULES.loopWindow + 0.5);
  const before = game.state.score;
  sweep(game, right);
  check(game.state.score - before < RULES.score.orbit,
    `a lap left half-finished for ${RULES.loopWindow}s still paid ${game.state.score - before}`);
});

scenario('lighting both inlanes re-arms the kickback', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.table.kickback.lit = false;
  for (const r of game.table.inlanes) sweep(game, r);
  check(game.table.kickback.lit, 'both inlanes lit and the kickback stayed cold');
  check(game.table.inlanes.every((r) => !r.lit), 'the inlanes never reset for the next pass');
  check(game.state.score >= RULES.score.inlane * 2 + RULES.score.inlanesDone,
    `the pair paid ${game.state.score}`);
});

scenario('an outlane pays something on the way out', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  sweep(game, game.table.outlanes[0]);
  check(game.state.score >= RULES.score.outlane, `the outlane paid ${game.state.score}`);
});

scenario('a tilted machine pays for none of it', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.tilt = true;
  sweep(game, game.table.spinner, 900, 0);
  sweep(game, game.table.inlanes[0]);
  sweep(game, game.table.outlanes[0]);
  sweep(game, game.table.loops[0]);
  sweep(game, game.table.loops[1]);
  check(game.state.score === 0, `tilted, the new shots still paid ${game.state.score}`);
});

// ------------------------------------------------------------------ traps

/**
 * The bug this section exists for: a ball dropped into the mouth between the
 * two slingshots bounced from one to the other and never came down. Each kick
 * *replaced* the velocity with a fixed one, so the ball left every slingshot at
 * exactly the speed and angle it left the last one — gravity had been feeding
 * the tangential component all the way down the table and the kick threw it
 * away. Twenty-one thousand slingshot hits in thirty simulated seconds, and a
 * player watching a ball they could not lose and could not use.
 */
scenario('a ball in the mouth of the slingshots always comes down', () => {
  const worst = { slings: 0, alive: 0, at: null };
  for (let x = 190; x <= 300; x += 10) {
    for (const vx of [-260, -90, 0, 90, 260]) {
      let slings = 0;
      const game = createGame({ onEvent: (e) => { if (e === 'sling') slings++; } });
      game.state.phase = 'play';
      game.state.inPlayfield = true;
      game.state.ballSave = 0;
      game.ball.x = x;
      game.ball.y = 520;
      game.ball.vx = vx;
      game.ball.vy = 60;
      let alive = 0;
      for (let t = 0; t < 25; t += STEP) {
        game.update(STEP, {});
        if (game.state.phase !== 'play') break;
        alive = t;
      }
      if (slings > worst.slings) Object.assign(worst, { slings, alive, at: `${x} @ ${vx}` });
      check(game.state.phase !== 'play' || alive < 24.9,
        `dropped at x=${x} moving ${vx}, the ball was still up there after 25s (${slings} slingshot hits)`);
    }
  }
  check(worst.slings < 60, `one drop rang the slingshots ${worst.slings} times (${worst.at})`);
});

scenario('a slingshot does not fire at a ball behind it', () => {
  // A ball cannot legitimately get inside the wedge — but if one ever does,
  // the coil kicking it further in, every step, is a game that has stopped.
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  let fired = 0;
  const watched = createGame({ onEvent: (e) => { if (e === 'sling') fired++; } });
  watched.state.phase = 'play';
  watched.state.inPlayfield = true;
  watched.state.ballSave = 0;
  const sl = watched.table.slings[0];
  watched.ball.x = 158;
  watched.ball.y = 598; // inside the wedge, behind the kicking face
  watched.ball.vx = 0;
  watched.ball.vy = 0;
  play(watched, 2);
  check(fired === 0, `the coil fired ${fired} times at a ball sitting behind it`);
  check(sl.face.x1 === 142, 'the left slingshot moved — this scenario is aimed at the wrong wedge');
  check(game.state.score === 0, 'the untouched control game scored');
});

scenario('a coil cannot fire faster than it resets', () => {
  let fired = 0;
  const game = createGame({ onEvent: (e) => { if (e === 'sling') fired++; } });
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.ballSave = 0;
  const face = game.table.slings[0].face;
  // hold the ball against the rubber for a second, re-seating it every step
  for (let t = 0; t < 1; t += STEP) {
    game.ball.x = (face.x1 + face.x2) / 2 + 8;
    game.ball.y = (face.y1 + face.y2) / 2 - 4;
    game.ball.vx = -300;
    game.ball.vy = 120;
    game.update(STEP, {});
  }
  const ceiling = Math.ceil(1 / PHYS.coilReset) + 1;
  check(fired <= ceiling, `held against the rubber for a second the coil fired ${fired} times, ceiling is ${ceiling}`);
  check(fired > 0, 'held against the rubber for a second the coil never fired at all');
});

scenario('the machine goes looking for a ball that stops going anywhere', () => {
  let searches = 0;
  const game = createGame({ onEvent: (e) => { if (e === 'search') searches++; } });
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.ballSave = 0;
  // Pin it in open felt, away from every flipper, until the machine notices.
  // The pin is released the moment it does — holding the ball still through
  // the shove would be measuring the test's grip, not the machine's.
  let waited = 0;
  for (let t = 0; t < RULES.ballSearch + 2 && searches === 0; t += STEP) {
    game.ball.x = 250;
    game.ball.y = 470;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.update(STEP, {});
    waited = t;
  }
  check(searches >= 1, `the ball sat still for ${(RULES.ballSearch + 2).toFixed(0)}s and the machine never looked for it`);
  check(waited >= RULES.ballSearch - 1, `the machine went looking after only ${waited.toFixed(1)}s of stillness`);
  const speed = Math.hypot(game.ball.vx, game.ball.vy);
  check(speed > 200, `the search fired but only shoved the ball at ${speed.toFixed(0)}`);
  play(game, 1.5);
  check(Math.hypot(game.ball.x - 250, game.ball.y - 470) > RULES.searchBox,
    `a second after the search the ball is still at ${game.ball.x.toFixed(0)},${game.ball.y.toFixed(0)}`);
});

scenario('a ball cradled on a flipper is not a lost ball', () => {
  // Holding the ball on a raised flipper is the most useful thing a player can
  // do with one. A ball search that shakes it loose is the machine taking the
  // game away from somebody who is playing it well.
  let searches = 0;
  const game = createGame({ onEvent: (e) => { if (e === 'search') searches++; } });
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.ballSave = 0;
  const f = game.table.flippers[0];
  play(game, 0.3, { left: true });
  const tip = flipperTip(f);
  for (let t = 0; t < RULES.ballSearch + 3; t += STEP) {
    game.ball.x = (f.px + tip.x) / 2;
    game.ball.y = (f.py + tip.y) / 2 - game.ball.r - f.r + 1;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.update(STEP, { left: true });
  }
  check(searches === 0, `a held ball was shaken off the flipper ${searches} time(s)`);
});

scenario('a wedged ball touching a flapping flipper is still looked for', () => {
  // The exemption above used to apply to a flipper at rest, and it reset the
  // clock rather than pausing it — so a ball wedged anywhere near a flipper
  // the player was flapping had its timer zeroed on every press and was never
  // searched for. That is a ball stuck for eighty-four seconds.
  let searches = 0;
  const game = createGame({ onEvent: (e) => { if (e === 'search') searches++; } });
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.ballSave = 0;
  const f = game.table.flippers[0];
  for (let t = 0; t < RULES.ballSearch + 4; t += STEP) {
    game.ball.x = f.px;
    game.ball.y = f.py - game.ball.r - f.r + 1;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.update(STEP, { left: Math.floor(t * 5) % 2 === 0 });
  }
  check(searches > 0, 'the machine never went looking for a ball pinned on the flipper pivot');
});

scenario('nowhere on the lower table is a place a ball can come to rest', () => {
  // The regression test for every trap a player has reported. Put a dead ball
  // everywhere one could legally be, and give the whole machine — geometry
  // first, ball search as the last resort — twelve seconds to give it back. A
  // pinball table that keeps the ball has stopped being a game.
  const probe = createGame({}).table;
  const stuck = [];
  let tried = 0;
  for (let x = 22; x <= 468; x += 8) {
    for (let y = 480; y <= 660; y += 10) {
      if (!clearOfEverything(probe, x, y)) continue;
      tried++;
      const game = createGame({});
      game.state.phase = 'play';
      game.state.inPlayfield = true;
      game.state.ballSave = 0;
      game.ball.x = x;
      game.ball.y = y;
      game.ball.vx = 0;
      game.ball.vy = 0;
      let gone = false;
      for (let t = 0; t < 12; t += STEP) {
        game.update(STEP, {});
        if (game.state.balls < RULES.balls || game.state.phase !== 'play') { gone = true; break; }
      }
      if (!gone && stuck.length < 6) stuck.push(`(${x},${y}) -> (${game.ball.x.toFixed(0)},${game.ball.y.toFixed(0)})`);
    }
  }
  check(tried > 500, `only ${tried} of the lower table was reachable — the probe is measuring nothing`);
  check(stuck.length === 0, `a ball came to rest at ${stuck.join('  ')}`);
});

// ------------------------------------------------------------------ tilt

scenario('three shoves is a TILT: dead flippers, no pay, cleared by the drain', () => {
  const game = createGame({});
  launch(game, 1.2);
  play(game, 1.5);
  check(game.state.inPlayfield, 'the ball never reached the playfield');
  settle(game);
  game.update(STEP, { nudgeL: true });
  game.update(STEP, { nudgeR: true });
  check(!game.state.tilt, 'two shoves already tilted the machine');
  game.update(STEP, { nudgeL: true });
  check(game.state.tilt, 'three quick shoves did not tilt');

  const before = game.state.score;
  const b = game.table.bumpers[0];
  game.ball.x = b.x;
  game.ball.y = b.y - b.r - game.ball.r + 2;
  game.ball.vy = 120;
  game.update(STEP, {});
  check(game.state.score === before, `a tilted machine paid ${game.state.score - before}`);

  game.update(STEP, { left: true });
  const f = game.table.flippers[0];
  check(f.target === FLIPPER.rest, 'a tilted flipper still answers the button');

  game.state.ballSave = 0;
  game.ball.x = 244;
  game.ball.y = TABLE.drainY + 1;
  game.ball.vy = 400;
  game.update(STEP, {});
  check(!game.state.tilt, 'the drain never cleared the tilt');
  check(game.state.balls === RULES.balls - 1, `the drain cost ${RULES.balls - game.state.balls} balls`);
});

// ------------------------------------------------------------------ balls, save, game over

scenario('the ball saver gives a drained ball back; a late drain costs it', () => {
  const game = createGame({});
  launch(game, 1.2);
  play(game, 1.5);
  check(game.state.ballSave > 0, 'the saver never armed');
  settle(game);
  game.ball.y = TABLE.drainY + 1;
  game.ball.vy = 400;
  game.update(STEP, {});
  check(game.state.balls === RULES.balls, 'the saver let the ball go');
  check(game.state.phase === 'plunger', 'the saved ball never came back to the plunger');

  // drain again after the saver has run out
  launch(game, 1.2);
  play(game, 1.5);
  settle(game);
  game.state.ballSave = 0;
  game.ball.y = TABLE.drainY + 1;
  game.ball.vy = 400;
  game.update(STEP, {});
  check(game.state.balls === RULES.balls - 1, `the late drain left ${game.state.balls} balls`);
});

scenario('three drains is game over, and the multiplier dies with each ball', () => {
  const game = createGame({});
  for (let i = 0; i < RULES.balls; i++) {
    launch(game, 1.2);
    play(game, 1.5);
    settle(game);
    game.state.ballSave = 0;
    game.state.mult = 4;
    game.ball.y = TABLE.drainY + 1;
    game.ball.vy = 400;
    game.update(STEP, {});
    if (i < RULES.balls - 1) check(game.state.mult === 1, `ball ${i + 1} drained with the multiplier still x${game.state.mult}`);
  }
  check(game.state.phase === 'over', `after ${RULES.balls} drains the phase is "${game.state.phase}"`);
});

scenario('a big enough score buys the extra ball, exactly once', () => {
  const game = createGame({});
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  game.state.score = RULES.extraBallAt - 1;
  const b = game.table.bumpers[0];
  game.ball.x = b.x;
  game.ball.y = b.y - b.r - game.ball.r + 2;
  game.ball.vy = 120;
  game.update(STEP, {});
  check(game.state.balls === RULES.balls + 1, `the threshold paid ${game.state.balls} balls`);
  game.state.score = RULES.extraBallAt * 3;
  game.ball.x = b.x;
  game.ball.y = b.y - b.r - game.ball.r + 2;
  game.ball.vy = 120;
  game.update(STEP, {});
  check(game.state.balls === RULES.balls + 1, 'the extra ball paid twice');
});

// ------------------------------------------------------------------ missions

scenario('finishing a mission promotes, pays, and queues the next one', () => {
  const events = [];
  const game = createGame({ onEvent: (t2) => events.push(t2) });
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  const goal = game.missionGoal();
  const b = game.table.bumpers[0];
  let guard = 0;
  while (game.state.mission === 0 && guard++ < goal * 40) {
    game.ball.x = b.x;
    game.ball.y = b.y - b.r - game.ball.r + 2;
    game.ball.vx = 0;
    game.ball.vy = 120;
    game.update(STEP, {});
    play(game, 0.05); // drift clear so the next touch is a fresh hit
    game.ball.vx = 0;
  }
  check(game.state.mission === 1, `after ${guard} hits the mission is still ${game.state.mission}`);
  check(game.state.rank === 1, `the promotion left rank at ${game.state.rank}`);
  check(events.includes('mission'), 'no mission event ever fired');
  check(game.state.score >= RULES.score.mission, `the mission paid ${game.state.score}`);
});

scenario('a full lap of missions raises the level, and the goals scale', () => {
  const game = createGame({});
  game.state.mission = MISSIONS.length - 1;
  game.state.rank = RANKS.length - 1;
  game.state.phase = 'play';
  game.state.inPlayfield = true;
  const before = game.missionGoal();
  game.state.progress = before - 1;
  // the last mission watches slings — fake the hit through its watcher
  const s = game.table.slings[0];
  game.ball.x = (s.face.x1 + s.face.x2) / 2 + 10;
  game.ball.y = (s.face.y1 + s.face.y2) / 2 - 10;
  game.ball.vx = -300;
  game.ball.vy = 100;
  play(game, 0.1);
  check(game.state.level === 2, `the lap left the level at ${game.state.level}`);
  check(game.state.mission === 0, 'the cycle never wrapped');
  check(game.missionGoal() === MISSIONS[0].count * 2, `level 2 asks for ${game.missionGoal()}`);
  check(game.state.rank === RANKS.length - 1, 'the top rank overflowed');
});

// ------------------------------------------------------------------ language

scenario('every phrase exists in both languages, missions and ranks included', () => {
  const holes = missingKeys(DICT);
  check(holes.length === 0, `half-translated: ${holes.join(', ')}`);
  for (const m of MISSIONS) {
    check(DICT['mission.' + m.id], `mission ${m.id} has no name`);
    check(DICT[`mission.${m.id}.how`], `mission ${m.id} has no instructions`);
  }
  for (const r of RANKS) check(DICT['rank.' + r], `rank ${r} has no name`);
});

await run('anarchy pinball');
