// The machine, played in Node: launch, flip, score, shake, tilt, drain.
//
// Everything here drives game.update() at the same fixed step main.js uses —
// there is no canvas and no clock, just the simulation and its numbers.

import { scenario, check, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';
import { createGame } from '../src/game.js';
import { DICT } from '../src/i18n.js';
import { reflect, closestOnSegment, collideSegment } from '../src/physics.js';
import { PLUNGER, RULES, TABLE, PHYS, FLIPPER, MISSIONS, RANKS } from '../src/config.js';
import { flipperTip } from '../src/table.js';

const STEP = 1 / 120;
const IDLE = {};

/** Run `seconds` of game time with a constant input. */
function play(game, seconds, input = IDLE) {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
}

/** Hold the plunger for `pull` seconds, release, and let the ball fly off it. */
function launch(game, pull = 1) {
  play(game, pull, { plunger: true });
  game.update(STEP, {});
  game.update(STEP, {});
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

scenario('the plunger throws harder the longer it is held', () => {
  const weak = createGame({});
  play(weak, 0.05, { plunger: true });
  weak.update(STEP, {});
  const weakV = -weak.ball.vy;

  const strong = createGame({});
  play(strong, 1.2, { plunger: true });
  strong.update(STEP, {});
  const strongV = -strong.ball.vy;

  check(weakV >= PLUNGER.min && weakV < strongV, `a tap threw ${weakV.toFixed(0)}, a full pull ${strongV.toFixed(0)}`);
  check(strongV <= PLUNGER.max + 1, `a full pull threw ${strongV.toFixed(0)}, past the plunger's max`);
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

scenario('a timid pull falls back onto the plunger instead of playing dead', () => {
  const game = createGame({});
  launch(game, 0.02);
  play(game, 4);
  check(game.state.phase === 'plunger', `the weak ball ended in phase "${game.state.phase}"`);
  check(game.state.balls === RULES.balls, 'a failed plunge cost a ball');
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
