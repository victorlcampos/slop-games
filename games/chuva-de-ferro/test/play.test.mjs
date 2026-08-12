// The run, played in Node.
//
// Nothing here draws: `createGame` takes a silent fx and the whole thing is
// arithmetic, so a test can live ten minutes on the road in a few milliseconds —
// which is exactly the coverage a game with an endless map needs.

import { scenario, check, checkEqual, run } from 'slopkit/testing';

import { createGame } from '../src/game.js';
import { createWorld, surfaceAt } from '../src/world.js';
import { createSoldier, stepSoldier, heightOf, hurt, heal } from '../src/player.js';
import { OBJECT_BY_ID, spawnObject } from '../src/objects.js';
import { WEAPON_BY_ID, PRIMARY, loadout } from '../src/weapons.js';
import { PLAYER, pressureAt } from '../src/config.js';

const STEP = 1 / 120;
const STILL = { left: false, right: false, jump: false, down: false, up: false, fire: false };
const play = (g, seconds, input = STILL) => {
  for (let t = 0; t < seconds; t += STEP) g.update(STEP, input);
  return g;
};

// ------------------------------------------------------------- the soldier

scenario('he stands on the road, runs, and comes back down when he jumps', () => {
  const world = createWorld(4);
  const s = createSoldier(200);
  s.y = world.groundAt(200);

  stepSoldier(s, STEP, STILL, world);
  check(s.onGround, 'he did not find the road under his feet');
  check(Math.abs(s.y - world.groundAt(s.x)) < 2, `he stands ${(s.y - world.groundAt(s.x)).toFixed(1)} px off the ground`);

  const from = s.x;
  for (let t = 0; t < 1; t += STEP) stepSoldier(s, STEP, { ...STILL, right: true }, world);
  check(s.x > from + 200, `a second of running covered ${(s.x - from).toFixed(0)} px`);
  check(s.facing === 1, 'he ran right facing left');

  stepSoldier(s, STEP, { ...STILL, jump: true }, world);
  check(!s.onGround && s.vy < 0, 'the jump did not leave the ground');
  let peak = s.y;
  for (let t = 0; t < 1.4; t += STEP) {
    stepSoldier(s, STEP, STILL, world);
    peak = Math.min(peak, s.y);
  }
  const height = world.groundAt(s.x) - peak;
  check(height > 120 && height < 320, `the jump reached ${height.toFixed(0)} px`);
  check(s.onGround, 'he never came back down');
});

scenario('crouching makes him short, and a low ceiling makes him crouch', () => {
  const world = createWorld(4);
  const s = createSoldier(200);
  s.y = world.groundAt(200);
  stepSoldier(s, STEP, STILL, world);
  const standing = heightOf(s);

  stepSoldier(s, STEP, { ...STILL, down: true }, world);
  check(s.crouching, 'holding down did not crouch him');
  check(heightOf(s) < standing, `crouched he is ${heightOf(s)} px, standing ${standing}`);
  check(heightOf(s) < PLAYER.h && heightOf(s) === PLAYER.crouchH, 'the crouched height is not the one in the config');

  // walk him into an arch: the road generates them, so find one and stand in it
  const arch = findRoof(world);
  check(arch, 'a kilometre of road with nothing to crouch under');
  s.x = arch.x + arch.w / 2;
  s.y = world.groundAt(s.x);
  stepSoldier(s, STEP, STILL, world);
  check(s.crouching, 'under the arch he stayed standing up');
  check(world.ceilingAt(s.x) < world.groundAt(s.x), 'the arch has no ceiling over the road');
  check(world.groundAt(s.x) - world.ceilingAt(s.x) < PLAYER.h,
    'the arch is tall enough to walk through — it teaches nothing');
});

function findRoof(world) {
  world.ensure(0, 40000);
  for (let i = 2; i < 64; i++) {
    const seg = world.segment(i);
    if (seg.roof.length) return seg.roof[0];
  }
  return null;
}

scenario('a rock is something to jump, not to walk through', () => {
  const world = createWorld(4);
  world.ensure(0, 40000);
  let rock = null;
  for (let i = 2; i < 64 && !rock; i++) {
    const seg = world.segment(i);
    if (seg.solids.length) rock = seg.solids[0];
  }
  check(rock, 'a kilometre of road with nothing to jump');

  const s = createSoldier(rock.x - 60);
  s.y = world.groundAt(s.x);
  for (let t = 0; t < 1.2; t += STEP) stepSoldier(s, STEP, { ...STILL, right: true }, world);
  check(s.x < rock.x + 2, `he walked into the rock and came out at ${s.x.toFixed(0)} (rock at ${rock.x.toFixed(0)})`);
  check(s.blocked, 'the rock did not stop him');

  // over the top: the same rock is a platform
  s.y = rock.y - 10;
  s.vy = 0;
  stepSoldier(s, STEP, STILL, world);
  s.x = rock.x + rock.w / 2;
  for (let t = 0; t < 0.5; t += STEP) stepSoldier(s, STEP, STILL, world);
  check(Math.abs(s.y - rock.y) < 3, `standing on the rock he is at ${s.y.toFixed(0)}, the top is ${rock.y.toFixed(0)}`);
});

scenario('three lives, mercy after a hit, and a medkit that gives one back', () => {
  const s = createSoldier(100);
  checkEqual(s.lives, 3, 'he did not start with three lives');

  check(hurt(s), 'the first hit did not land');
  checkEqual(s.lives, 2, 'the hit cost the wrong number of lives');
  check(!hurt(s), 'a second hit landed during the mercy window');
  checkEqual(s.lives, 2, 'the mercy window did not hold');

  s.invuln = 0;
  check(hurt(s), 'the hit after the window did not land');
  check(heal(s), 'the medkit did nothing');
  checkEqual(s.lives, 2, 'the medkit gave back the wrong amount');
  s.lives = 3;
  check(!heal(s), 'a full soldier took a medkit he did not need');

  s.invuln = 0; hurt(s);
  s.invuln = 0; hurt(s);
  s.invuln = 0; hurt(s);
  check(s.dead && s.lives === 0, `after three hits he is at ${s.lives} lives, dead=${s.dead}`);
});

// ------------------------------------------------------------------ the run

scenario('the road never ends, and the run survives ten minutes of it', () => {
  const g = createGame({ seed: 99 });
  g.soldier.lives = 1e9;                       // this scenario is about the road, not the man
  // and he jumps, because a rock he does not jump is a rock he stands against
  // for ten minutes — which is what the first version of this scenario measured
  play(g, 600, { ...STILL, right: true, jump: true, fire: true });
  check(g.state.time > 599, `the clock stopped at ${g.state.time.toFixed(0)}s`);
  check(g.soldier.x > 20000, `ten minutes of running covered ${Math.round(g.soldier.x)} px`);
  check(g.world.count < 40, `${g.world.count} segments alive — the road is not forgetting what is behind`);
  check(g.objects.length < 200, `${g.objects.length} pieces of cargo on screen at once`);
  check(g.shots.length < 400, `${g.shots.length} shots in flight`);
});

scenario('nothing in a long run ever becomes NaN', () => {
  // the cheapest guard there is against a physics bug: one number goes bad and
  // the whole screen quietly stops drawing
  const g = createGame({ seed: 12345 });
  for (let i = 0; i < 90; i++) {
    play(g, 4, { ...STILL, right: i % 3 !== 0, jump: i % 5 === 0, fire: true, down: i % 7 === 0 });
    const bad = [];
    for (const o of g.objects) if (![o.x, o.y, o.vx, o.vy, o.r, o.hp].every(Number.isFinite)) bad.push(o.id);
    for (const s of g.shots) if (![s.x, s.y, s.vx, s.vy, s.r].every(Number.isFinite)) bad.push('shot:' + s.weapon);
    for (const p of g.pickups) if (![p.x, p.y].every(Number.isFinite)) bad.push('pickup');
    for (const h of g.hazards) if (![h.x, h.y, h.r].every(Number.isFinite)) bad.push('hazard:' + h.kind);
    if (![g.soldier.x, g.soldier.y, g.soldier.vx, g.soldier.vy, g.soldier.aim].every(Number.isFinite)) bad.push('soldier');
    check(bad.length === 0, `after ${Math.round(g.state.time)}s these went non-finite: ${[...new Set(bad)].join(', ')}`);
    if (g.state.phase === 'over') break;
  }
});

scenario('the sky opens slowly: more cargo the longer you last', () => {
  const early = createGame({ seed: 5 });
  play(early, 40);
  const earlyDrops = early.state.killed + early.objects.length;

  const late = createGame({ seed: 5 });
  late.state.time = 300;                      // ten minutes in
  play(late, 40);
  const lateDrops = late.state.killed + late.objects.length;
  check(lateDrops > earlyDrops, `late in the run ${lateDrops} pieces fell against ${earlyDrops} early on`);
  check(pressureAt(0) === 0 && pressureAt(1e6) === 1, 'the pressure curve left its 0..1 range');
});

// -------------------------------------------------------------- the guns

scenario('the trigger spends ammo, and an empty gun goes back to the rifle', () => {
  const g = createGame({ seed: 3 });
  g.state.weapon = loadout(WEAPON_BY_ID.shotgun);
  const full = WEAPON_BY_ID.shotgun.ammo;
  checkEqual(g.ammo(), full, 'the pickup did not come with a full magazine');

  play(g, 0.7, { ...STILL, fire: true });
  check(g.ammo() < full, `after a burst the shotgun still holds ${g.ammo()}`);
  check(g.shots.length > 0, 'the trigger produced no shots');

  play(g, 40, { ...STILL, fire: true });
  checkEqual(g.state.weapon.id, PRIMARY.id, `an empty shotgun left him holding "${g.state.weapon.id}"`);
  check(g.ammo() === Infinity, 'the rifle came back with a magazine');
});

scenario('the rifle never runs out — it is the floor of the whole game', () => {
  const g = createGame({ seed: 3 });
  play(g, 30, { ...STILL, fire: true });
  checkEqual(g.state.weapon.id, PRIMARY.id, 'the rifle was swapped out on its own');
  check(g.ammo() === Infinity, `the rifle is down to ${g.ammo()}`);
});

scenario('every gun fires, hits, and kills what it is pointed at', () => {
  for (const weapon of Object.values(WEAPON_BY_ID)) {
    const g = createGame({ seed: 77 });
    g.objects.length = 0;
    g.state.weapon = loadout(weapon);
    // a crate parked in front of the soldier, at gun height
    const target = spawnObject(OBJECT_BY_ID.crate, g.soldier.x + 150, g.soldier.y - 60);
    target.vy = 0;
    g.objects.push(target);
    let fired = 0;
    for (let t = 0; t < 4 && !target.dead; t += STEP) {
      g.update(STEP, { ...STILL, fire: true });
      fired = Math.max(fired, g.shots.length);
    }
    check(fired > 0 || weapon.kind === 'beam', `${weapon.id}: nothing left the barrel`);
    check(target.dead, `${weapon.id}: four seconds on a crate and it is still there (${target.hp} hp left)`);
  }
});

// ------------------------------------------------------------ the cargo

scenario('what lands stays: a safe becomes the only high ground on the road', () => {
  const g = createGame({ seed: 8 });
  const safe = spawnObject(OBJECT_BY_ID.safe, g.soldier.x + 260, 120);
  g.objects.push(safe);
  play(g, 4);
  check(safe.landed, 'the safe never reached the road');
  check(!safe.dead, `a safe that survived the drop should still be there (${safe.hp} hp)`);
  check(safe.prop, 'the safe did not become something to stand on');

  const top = surfaceAt(g.world, safe.x, 0);
  check(top < g.world.groundAt(safe.x) - 20, `standing on the safe is only ${(g.world.groundAt(safe.x) - top).toFixed(0)} px up`);
});

scenario('an egg sticks where it lands, and a ball keeps bouncing', () => {
  const g = createGame({ seed: 8 });
  const egg = spawnObject(OBJECT_BY_ID.egg, g.soldier.x + 300, 100);
  const ball = spawnObject(OBJECT_BY_ID.ball, g.soldier.x + 500, 100);
  g.objects.push(egg, ball);
  play(g, 3);
  check(egg.landed && !egg.dead, 'the egg did not survive its own landing');
  checkEqual(Math.round(egg.vx), 0, 'the egg slid after it landed');
  check(g.hazards.some((h) => h.kind === 'slime'), 'the egg left no mess behind');

  // measured from the moment it touches down — three seconds later the bounce
  // has already decayed to nothing, and a settled ball is not a bug
  const g2 = createGame({ seed: 8 });
  const ball2 = spawnObject(OBJECT_BY_ID.ball, g2.soldier.x + 500, 100);
  g2.objects.push(ball2);
  for (let t = 0; t < 6 && !ball2.landed; t += STEP) g2.update(STEP, STILL);
  check(ball2.landed, 'the ball never landed');
  const heights = [];
  for (let i = 0; i < 40; i++) { play(g2, 0.03); heights.push(ball2.y); }
  const travel = Math.max(...heights) - Math.min(...heights);
  check(travel > 25, `the ball settled instead of bouncing (${travel.toFixed(0)} px of travel)`);
  check(ball.landed, 'the first ball never landed either');
});

scenario('a barrel takes the neighbours with it', () => {
  const g = createGame({ seed: 8 });
  g.objects.length = 0;
  const barrels = [];
  for (let i = 0; i < 4; i++) {
    const b = spawnObject(OBJECT_BY_ID.barrel, g.soldier.x + 400 + i * 90, 200);
    b.vy = 0;
    g.objects.push(b);
    barrels.push(b);
  }
  g.damage(barrels[0], 99, null);
  check(barrels[0].dead, 'the first barrel survived a direct hit');
  play(g, 0.5);
  const gone = barrels.filter((b) => b.dead).length;
  check(gone >= 3, `one barrel took ${gone} of four with it — the chain did not travel`);
});

scenario('the cargo hurts on the way down, and lets you climb it once it is down', () => {
  const g = createGame({ seed: 8 });
  g.objects.length = 0;
  const anvil = spawnObject(OBJECT_BY_ID.anvil, g.soldier.x, g.soldier.y - 400);
  anvil.vy = 600;
  g.objects.push(anvil);
  play(g, 2);
  check(g.soldier.lives < 3, 'an anvil fell on his head and cost nothing');

  // and now it is furniture: standing next to it does not keep hurting
  const after = g.soldier.lives;
  g.soldier.invuln = 0;
  play(g, 3);
  check(g.soldier.lives === after, 'the landed anvil kept taking lives off him');
});

scenario('a medkit is only offered to somebody who needs it', () => {
  const g = createGame({ seed: 21 });
  g.soldier.lives = 3;
  for (let i = 0; i < 60; i++) {
    const fridge = spawnObject(OBJECT_BY_ID.fridge, g.soldier.x + 300, 200);
    g.objects.push(fridge);
    g.damage(fridge, 99, null);
  }
  check(g.pickups.every((p) => p.kind !== 'medkit'), 'a full soldier was offered a medkit');

  g.soldier.lives = 1;
  let medkits = 0;
  for (let i = 0; i < 120; i++) {
    const fridge = spawnObject(OBJECT_BY_ID.fridge, g.soldier.x + 300, 200);
    g.objects.push(fridge);
    g.damage(fridge, 99, null);
    medkits += g.pickups.filter((p) => p.kind === 'medkit').length;
    g.pickups.length = 0;
  }
  check(medkits > 0, 'a soldier on his last life never saw a medkit');
});

scenario('the run ends when the third life goes, and the score is what is kept', () => {
  let result = null;
  const g = createGame({ seed: 4, onOver: (r) => { result = r; } });
  g.state.score = 4321;
  play(g, 2);
  for (let i = 0; i < 3; i++) { g.soldier.invuln = 0; g.update(STEP, STILL); g.soldier.invuln = 0; hurt(g.soldier); }
  g.update(STEP, STILL);
  checkEqual(g.state.phase, 'over', 'the third life went and the run carried on');
  check(result && result.score >= 4321, `the run ended with ${result && result.score}`);
  check(result.time > 0, 'the run reported no time alive');

  const before = g.state.score;
  play(g, 3, { ...STILL, fire: true });
  checkEqual(g.state.score, before, 'the score kept moving after the run ended');
});

await run('iron rain — the run');
