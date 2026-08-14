// The run, played in Node.
//
// Nothing here draws: `createGame` takes a silent fx and the whole thing is
// arithmetic, so a test can live ten minutes on the road in a few milliseconds —
// which is exactly the coverage a game with an endless map needs.

import { scenario, check, checkEqual, run } from 'slopkit/testing';

import { createGame } from '../src/game.js';
import { createWorld, surfaceAt, insideTerrain } from '../src/world.js';
import { createSoldier, stepSoldier, heightOf, hurt, heal } from '../src/player.js';
import { OBJECT_BY_ID, spawnObject } from '../src/objects.js';
import { WEAPON_BY_ID, PRIMARY, loadout } from '../src/weapons.js';
import { fire, updateShots } from '../src/shots.js';
import { silentFx } from '../src/fx.js';
import { freshBest, mergeBest } from '../src/records.js';
import { clock } from '../src/render.js';
import { PLAYER, makeRng, pressureAt } from '../src/config.js';

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

  // held, the jump is a full one; the button is read on its edge, so a player
  // who leans on it does not pogo
  const floor = world.groundAt(s.x);
  let peak = s.y;
  for (let t = 0; t < 1.4; t += STEP) {
    stepSoldier(s, STEP, { ...STILL, jump: t < 0.35 }, world);
    peak = Math.min(peak, s.y);
  }
  const height = floor - peak;
  check(height > 120 && height < 340, `the jump reached ${height.toFixed(0)} px`);
  check(s.onGround, 'he never came back down');
});

scenario('a tap is a hop, a hold is a jump, and the edge of a ledge forgives', () => {
  const world = createWorld(4);
  const tap = createSoldier(300);
  tap.y = world.groundAt(300);
  const held = createSoldier(300);
  held.y = world.groundAt(300);

  let tapPeak = tap.y, heldPeak = held.y;
  for (let t = 0; t < 1.4; t += STEP) {
    stepSoldier(tap, STEP, { ...STILL, jump: t < 0.06 }, world);
    stepSoldier(held, STEP, { ...STILL, jump: t < 0.4 }, world);
    tapPeak = Math.min(tapPeak, tap.y);
    heldPeak = Math.min(heldPeak, held.y);
  }
  const short = world.groundAt(300) - tapPeak;
  const full = world.groundAt(300) - heldPeak;
  check(full > short * 1.6, `a tap reached ${short.toFixed(0)} px and a hold ${full.toFixed(0)} — the same jump`);
  check(short > 30, `a tap barely left the ground (${short.toFixed(0)} px)`);

  // coyote time: a jump asked for just after the ground ran out still happens
  const late = createSoldier(300);
  late.y = world.groundAt(300);
  for (let i = 0; i < 6; i++) stepSoldier(late, STEP, STILL, world);   // stands, charging the grace
  late.onGround = false;                       // and steps off something
  late.y -= 10;
  stepSoldier(late, STEP, { ...STILL, jump: true }, world);
  check(late.vy < -400, `a jump inside the coyote window came out at ${late.vy.toFixed(0)}`);
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

scenario('the back of an arch is ground: he can stand on the thing he ducks under', () => {
  const world = createWorld(4);
  const arch = findRoof(world);
  check(arch, 'a kilometre of road with no arch');
  const mid = arch.x + arch.w / 2;
  const top = world.groundAt(mid) - arch.clear - arch.thick;

  // reachable at all: the band's top has to be inside a jump's height
  check(world.groundAt(mid) - top < 200, `the arch top is ${(world.groundAt(mid) - top).toFixed(0)} px up — no jump reaches it`);

  const s = createSoldier(mid);
  s.y = top;
  for (let t = 0; t < 0.5; t += STEP) stepSoldier(s, STEP, STILL, world);
  check(s.onGround, 'standing on the arch he fell through it');
  check(Math.abs(s.y - top) < 3, `on the arch his feet are at ${s.y.toFixed(0)}, the band top is ${top.toFixed(0)}`);
  check(!s.crouching, 'on top of the arch he crouched under his own floor');
});

scenario('a shot ends at the rock it hits — the obstacle blocks fire the way it blocks you', () => {
  const world = createWorld(4);
  world.ensure(0, 40000);
  let rock = null;
  for (let i = 2; i < 64 && !rock; i++) {
    const seg = world.segment(i);
    if (seg.solids.length && seg.solids[0].h > 60) rock = seg.solids[0];
  }
  check(rock, 'no rock tall enough to shoot at');

  // a crate parked behind the rock, dead centre of its body
  const midY = rock.y + rock.h / 2;
  const crate = spawnObject(OBJECT_BY_ID.crate, rock.x + rock.w + 120, midY);
  const objects = [crate];
  const shots = [];
  let dealt = 0;
  const ctx = {
    world, objects, shots, fx: silentFx(), rand: makeRng(9),
    damage: (o, amount) => { dealt += amount; },
    boom: () => {},
  };
  check(insideTerrain(world, rock.x + rock.w / 2, midY), 'the rock has no body for a shot to hit');

  // a bullet, fired flat through the rock's belly
  fire(ctx, WEAPON_BY_ID.rifle, { x: rock.x - 160, y: midY }, 0);
  for (let t = 0; t < 1.5; t += STEP) updateShots(shots, STEP, ctx);
  checkEqual(dealt, 0, `the bullet went through the rock and dealt ${dealt}`);
  checkEqual(shots.length, 0, 'the bullet is still flying inside the rock');

  // and a marksman beam, which resolves at once: it stops at the rock too
  fire(ctx, WEAPON_BY_ID.marksman, { x: rock.x - 160, y: midY }, 0);
  checkEqual(dealt, 0, `the beam came out the far side of the rock and dealt ${dealt}`);
});

scenario('a destroyed safe stops being a wall: no ghost footprint on the road', () => {
  const g = createGame({ seed: 8 });
  const safe = spawnObject(OBJECT_BY_ID.safe, g.soldier.x + 260, 120);
  g.objects.push(safe);
  play(g, 4);
  check(safe.landed && safe.prop, 'the safe never became furniture');
  const ground = g.world.groundAt(safe.x);
  check(surfaceAt(g.world, safe.x, 0) < ground - 20, 'the landed safe is not high ground');

  g.damage(safe, 999, null);
  check(safe.dead, 'a point-blank 999 left the safe standing');
  check(!g.world.solidsNear(safe.x, 100).some((s) => s.cargo === safe),
    'the dead safe left its footprint behind — an invisible wall over its own pickup');
  check(Math.abs(surfaceAt(g.world, safe.x, 0) - ground) < 1,
    'the road under the dead safe did not come back');
});

scenario('a safe that lands around him leaves him beside it, not wedged inside', () => {
  const g = createGame({ seed: 8 });
  g.objects.length = 0;
  const safe = spawnObject(OBJECT_BY_ID.safe, g.soldier.x, g.soldier.y - 500);
  g.objects.push(safe);
  play(g, 3);
  check(safe.landed && safe.prop, 'the safe never landed');
  const p = safe.prop;
  const half = PLAYER.w / 2;
  const s = g.soldier;
  check(s.x + half <= p.x + 1 || s.x - half >= p.x + p.w - 1,
    `he is still inside the safe (soldier at ${s.x.toFixed(0)}, safe ${p.x.toFixed(0)}..${(p.x + p.w).toFixed(0)})`);
  check(s.onGround && Math.abs(s.y - surfaceAt(g.world, s.x, 0)) < 3,
    'shoved out of the safe he is not standing on the road');
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
  // and he taps the jump, the way a player does — the button is read on its
  // edge, so leaning on it clears exactly one rock and then stands there
  for (let t = 0; t < 600; t += STEP) {
    g.update(STEP, { ...STILL, right: true, jump: Math.floor(t * 2) % 2 === 0, fire: true });
  }
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

// ------------------------------------------------------------- the record

scenario('the end-of-run card has numbers to read, and the record keeps them', () => {
  // The bug: `vault.save()` reports whether it wrote, it does not hand the
  // state back — so `best = vault.save(...)` made `best` the boolean `true`,
  // and the card read "best: undefined · NaN:NaN". Everything the card touches
  // has to still be a number after a run has been filed.
  const first = mergeBest(freshBest(), { score: 14814.4, time: 119.7, killed: 99 });
  checkEqual(first.best.score, 14814, `the record kept ${first.best.score}`);
  checkEqual(first.best.time, 119.7, `the record kept ${first.best.time} s`);
  checkEqual(first.best.runs, 1, 'the first run was not counted');
  check(first.record, 'the first run over zero was not a record');
  checkEqual(clock(first.best.time), '01:59', `the card would print ${clock(first.best.time)}`);

  // a worse run keeps the record, and each axis is kept on its own: a bigger
  // score does not erase a longer life
  const second = mergeBest(first.best, { score: 20000, time: 40 });
  checkEqual(second.best.score, 20000, `the bigger score was lost (${second.best.score})`);
  checkEqual(second.best.time, 119.7, `the longer run was erased (${second.best.time})`);
  check(second.record, 'a bigger score was not called a record');
  checkEqual(second.best.runs, 2, `${second.best.runs} runs counted after two`);

  const third = mergeBest(second.best, { score: 10, time: 10 });
  check(!third.record, 'a run beaten on both axes was announced as a record');
  checkEqual(third.best.score, 20000, `the record fell to ${third.best.score}`);
});

scenario('a record read off a broken save is still a number', () => {
  // `true` is exactly what the old bug left in the variable, and a save two
  // versions old is the same problem with better manners
  for (const junk of [true, null, undefined, 'best', { score: NaN, time: -3 }, { score: '9' }]) {
    const merged = mergeBest(junk, { score: 500, time: 12 });
    check(Number.isFinite(merged.best.score) && Number.isFinite(merged.best.time),
      `${JSON.stringify(junk)} produced ${merged.best.score} · ${merged.best.time}`);
    checkEqual(clock(merged.best.time), '00:12', `the card would print ${clock(merged.best.time)}`);
  }
  // and a run that reports nothing does not take the record down with it
  const kept = mergeBest({ score: 800, time: 30, runs: 4 }, {});
  checkEqual(kept.best.score, 800, `an empty result rewrote the record as ${kept.best.score}`);
  check(!kept.record, 'an empty result was announced as a record');
});

scenario('the clock never says NaN', () => {
  checkEqual(clock(undefined), '00:00', `clock(undefined) said ${clock(undefined)}`);
  checkEqual(clock(NaN), '00:00', `clock(NaN) said ${clock(NaN)}`);
  checkEqual(clock(-5), '00:00', `clock(-5) said ${clock(-5)}`);
  checkEqual(clock(659.9), '10:59', `clock(659.9) said ${clock(659.9)}`);
});

await run('iron rain — the run');
