// The two tables the whole game is made of, and the road they fall on.
//
// Twenty guns and twenty pieces of cargo is a lot of rows to keep honest by
// eye. Everything here is the kind of mistake a table invites: a weapon with no
// ammo, cargo that lands in a way nothing implements, a name written in one
// language, a road that is different every time you walk it.

import { scenario, check, checkEqual, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';

import { WEAPONS, WEAPON_BY_ID, PRIMARY, DROPPABLE, rollWeapon, loadout } from '../src/weapons.js';
import { OBJECTS, OBJECT_BY_ID, DROPPED, rollObject, spawnObject } from '../src/objects.js';
import { createWorld } from '../src/world.js';
import { dict } from '../src/i18n.js';
import { makeRng, GROUND, PLAYER } from '../src/config.js';
import { STICK, stickInput, createTouchControls } from '../src/controls.js';

const KINDS = ['bullet', 'pellet', 'beam', 'rocket', 'lobbed', 'flame', 'orb', 'homing'];
const LANDINGS = ['break', 'settle', 'bounce', 'roll', 'explode', 'stick'];

// ------------------------------------------------------------- the arsenal

scenario('twenty guns, each one a different answer to the same sky', () => {
  check(WEAPONS.length === 20, `the arsenal has ${WEAPONS.length} guns`);
  const ids = new Set();
  for (const w of WEAPONS) {
    check(!ids.has(w.id), `two guns share the id "${w.id}"`);
    ids.add(w.id);
    check(KINDS.includes(w.kind), `${w.id} fires a "${w.kind}", which nothing implements`);
    check(w.dmg > 0, `${w.id} does ${w.dmg} damage`);
    check(w.rate > 0 && w.rate < 3, `${w.id} fires every ${w.rate}s`);
    check(w.life > 0, `${w.id}: a shot that lives ${w.life}s`);
    check(w.count >= 1, `${w.id} fires ${w.count} projectiles`);
    check(w.tier >= 0 && w.tier <= 4, `${w.id} is tier ${w.tier}`);
    check(/^#[0-9a-f]{6}$/i.test(w.colour), `${w.id} has no colour for its tracer`);
  }

  // no two guns should feel the same: damage per second and reach separate them
  const seen = new Map();
  for (const w of WEAPONS) {
    const dps = Math.round((w.dmg * w.count) / w.rate);
    const shape = `${w.kind}:${dps}:${w.splash}:${w.pierce}`;
    check(!seen.has(shape), `${w.id} and ${seen.get(shape)} are the same gun with two names`);
    seen.set(shape, w.id);
  }
});

scenario('the rifle is the floor: infinite, and the only one that is', () => {
  checkEqual(PRIMARY.id, 'rifle', 'the primary is not the service rifle');
  check(PRIMARY.ammo === Infinity, `the rifle carries ${PRIMARY.ammo} rounds`);
  checkEqual(PRIMARY.tier, 0, 'the rifle can be found in the wreckage');
  for (const w of DROPPABLE) {
    check(Number.isFinite(w.ammo) && w.ammo > 0, `${w.id} is a pickup with ${w.ammo} ammo`);
    check(w.tier >= 1, `${w.id} is a pickup at tier ${w.tier}`);
  }
  checkEqual(DROPPABLE.length, 19, `${DROPPABLE.length} guns can be found`);
  checkEqual(loadout(WEAPON_BY_ID.rocket).ammo, WEAPON_BY_ID.rocket.ammo, 'a pickup arrives half empty');
});

scenario('the wreckage hands out better guns the longer you last', () => {
  const rand = makeRng(11);
  const early = tally(() => rollWeapon(rand, 0));
  const late = tally(() => rollWeapon(rand, 1));
  const tierOf = (id) => WEAPON_BY_ID[id].tier;
  const avg = (t) => [...t.entries()].reduce((sum, [id, n]) => sum + tierOf(id) * n, 0)
    / [...t.values()].reduce((a, b) => a + b, 0);

  check(avg(late) > avg(early), `the tenth minute gives tier ${avg(late).toFixed(2)}, the first ${avg(early).toFixed(2)}`);
  check([...early.keys()].every((id) => tierOf(id) <= 1), 'the first minute handed out a railgun');
  check([...late.keys()].length > 6, 'late in the run the wreckage repeats itself');
});

function tally(pull) {
  const t = new Map();
  for (let i = 0; i < 400; i++) {
    const id = pull().id;
    t.set(id, (t.get(id) || 0) + 1);
  }
  return t;
}

// ------------------------------------------------------------- the manifest

scenario('twenty pieces of cargo, and every one of them lands somehow', () => {
  check(OBJECTS.length >= 20, `the manifest has ${OBJECTS.length} entries`);
  const ids = new Set();
  for (const o of OBJECTS) {
    check(!ids.has(o.id), `two entries share the id "${o.id}"`);
    ids.add(o.id);
    check(LANDINGS.includes(o.land), `${o.id} lands by "${o.land}", which nothing implements`);
    check(o.hp > 0, `${o.id} takes ${o.hp} shots`);
    check(o.r > 8 && o.r < 60, `${o.id} is ${o.r} px of radius`);
    check(o.mass >= 0 && o.mass <= 4, `${o.id} weighs ${o.mass}`);
    check(o.drag >= 0 && o.drag <= 1, `${o.id} has ${o.drag} of drag`);
    check(o.score > 0, `${o.id} is worth ${o.score} points`);
    check(o.drops >= 0 && o.drops <= 1, `${o.id} drops something ${o.drops} of the time`);
    if (o.splits) check(OBJECT_BY_ID[o.splits.into], `${o.id} splits into "${o.splits.into}", which is not in the manifest`);
  }
  check(DROPPED.length >= 19, `only ${DROPPED.length} of them can fall on their own`);
  check(OBJECTS.some((o) => o.solid), 'nothing that lands can be stood on');
  check(OBJECTS.some((o) => o.land === 'bounce'), 'nothing bounces');
  check(OBJECTS.some((o) => o.land === 'explode'), 'nothing explodes');
  check(OBJECTS.some((o) => o.hp >= 25), 'nothing takes a real beating — the safe is the point');
});

scenario('the heavy end of the manifest arrives late, not first', () => {
  const rand = makeRng(3);
  const heavy = (id) => OBJECT_BY_ID[id].mass >= 1.6 || OBJECT_BY_ID[id].hp >= 12;
  const share = (pressure) => {
    let n = 0;
    for (let i = 0; i < 500; i++) if (heavy(rollObject(rand, pressure).id)) n++;
    return n / 500;
  };
  const first = share(0);
  const last = share(1);
  check(last > first * 1.5, `late ${(last * 100).toFixed(0)}% heavy against ${(first * 100).toFixed(0)}% early`);
  check(first > 0.02, 'the first minute never drops anything with weight');
});

scenario('a fresh piece of cargo starts whole and falling', () => {
  const o = spawnObject(OBJECT_BY_ID.safe, 100, 0, 10, 20);
  checkEqual(o.hp, OBJECT_BY_ID.safe.hp, 'it did not arrive at full health');
  checkEqual(o.maxHp, o.hp, 'it does not remember how tough it was');
  check(!o.landed && !o.dead, 'it arrived already finished');
  check(o.frozen === 0 && o.burning === 0 && o.acid === 0, 'it arrived already on fire');
});

// ---------------------------------------------------------------- the road

scenario('the same road twice, and it is never a wall', () => {
  const a = createWorld(42);
  const b = createWorld(42);
  const c = createWorld(43);
  let differ = 0;
  for (let x = 0; x < 30000; x += 137) {
    checkEqualQuiet(a.groundAt(x), b.groundAt(x), `the same seed gave two roads at ${x}`);
    if (Math.abs(a.groundAt(x) - c.groundAt(x)) > 1) differ++;
  }
  check(differ > 100, 'two different seeds gave the same road');

  // the road stays inside the screen, and never climbs faster than a jump
  let steepest = 0;
  for (let x = 0; x < 30000; x += 8) {
    const y = a.groundAt(x);
    check(y > 200 && y < 700, `the road is at ${y.toFixed(0)} at x=${x}`);
    steepest = Math.max(steepest, Math.abs(y - a.groundAt(x + 8)));
  }
  check(steepest < 34, `the road climbs ${steepest.toFixed(1)} px in 8 — that is a wall, not a dune`);
});

function checkEqualQuiet(a, b, message) {
  if (a !== b) check(false, message);
}

scenario('the road is furnished: rocks to jump and roofs to crouch under', () => {
  const world = createWorld(7);
  world.ensure(0, 60000);
  let rocks = 0, roofs = 0;
  for (let i = 0; i < 96; i++) {
    const seg = world.segment(i);
    rocks += seg.solids.length;
    roofs += seg.roof.length;
    check(!(seg.solids.length && seg.roof.length),
      `segment ${i} has a rock under a roof — crouched, that is a trap with no way out`);
  }
  check(rocks > 20, `${rocks} rocks in a kilometre of road`);
  check(roofs > 10, `${roofs} roofs in a kilometre of road`);

  for (let i = 0; i < 96; i++) {
    for (const r of world.segment(i).roof) {
      const mid = r.x + r.w / 2;
      const clear = world.groundAt(mid) - world.ceilingAt(mid);
      check(clear > 0 && clear < PLAYER.h, `a roof with ${clear.toFixed(0)} px of clearance teaches nothing`);
      check(clear > PLAYER.crouchH, `a roof with ${clear.toFixed(0)} px cannot even be crouched under`);
    }
  }
});

scenario('the open road has no ceiling, and says so the right way round', () => {
  const world = createWorld(7);
  world.ensure(0, 4000);
  check(world.ceilingAt(200) === -Infinity, 'the open sky came back as a ceiling');
  check(world.groundAt(200) - world.ceilingAt(200) === Infinity,
    'headroom under the open sky is not infinite — that is what crouched the soldier on an empty road');
});

// -------------------------------------------------------------- the words

scenario('everything the player reads exists in both languages', () => {
  const missing = missingKeys(dict);
  check(missing.length === 0, `half-translated keys: ${missing.join(', ')}`);
  for (const w of WEAPONS) {
    check(w.name.pt && w.name.en, `${w.id}: the gun is named in one language`);
    check(w.note.pt && w.note.en, `${w.id}: the note is written in one language`);
    check(w.note.pt !== w.note.en, `${w.id}: the two notes read the same — one side was pasted`);
  }
  for (const o of OBJECTS) {
    check(o.name.pt && o.name.en, `${o.id}: named in one language only`);
  }
  check(dict['intro.1'].pt !== dict['intro.1'].en, 'the intro is the same sentence twice');
});

// -------------------------------------------------------------- the thumbs

scenario('the stick is born under the thumb and answers in four directions', () => {
  const c = createTouchControls(() => 1200);

  // left half: the stick appears exactly where the finger landed
  c.start(1, 300, 500);
  check(c.stick.on && c.stick.ox === 300 && c.stick.oy === 500, 'the stick did not appear under the thumb');
  checkEqual(c.read(), { left: false, right: false, down: false, jump: false, up: false, fire: false },
    'a thumb resting still asked for something');

  c.move(1, 300 + STICK.turn + 4, 500);
  check(c.read().right && !c.read().left, 'pushing right did not run right');
  c.move(1, 300 - STICK.turn - 4, 500);
  check(c.read().left, 'pushing left did not run left');

  c.move(1, 300, 500 - STICK.up - 4);
  check(c.read().jump && !c.read().down, 'pushing up did not jump');
  c.move(1, 300, 500 + STICK.down + 4);
  check(c.read().down && !c.read().jump, 'pushing down did not crouch');

  // and the diagonal, which is how you walk crouched under a cave
  c.move(1, 300 + STICK.turn + 10, 500 + STICK.down + 10);
  const diagonal = c.read();
  check(diagonal.right && diagonal.down, 'down and forward at once did not crouch-walk');

  c.end(1);
  check(!c.stick.on && !c.read().right, 'the stick stayed on after the finger left');
});

scenario('the right half is the trigger, and the two thumbs are independent', () => {
  const c = createTouchControls(() => 1200);
  c.start(7, 900, 400);
  check(c.trigger.on && c.read().fire, 'a thumb on the right half did not fire');
  check(!c.stick.on, 'the trigger also grabbed the stick');

  c.start(8, 200, 600);
  c.move(8, 200 - STICK.turn - 5, 600);
  const both = c.read();
  check(both.fire && both.left, 'firing while running backwards asked for one or the other');

  c.end(7);
  check(!c.read().fire && c.read().left, 'letting go of the trigger let go of the stick too');
  c.clear();
  check(!c.stick.on && !c.trigger.on, 'clearing left a finger behind');
});

scenario('a thumb that barely moves is a thumb standing still', () => {
  const asked = stickInput(STICK.dead - 2, 0);
  check(!asked.left && !asked.right && !asked.down && !asked.jump,
    'the deadzone is not dead — the soldier would drift under a resting thumb');
  check(stickInput(0, -STICK.up - 1).jump, 'straight up did not jump');
  check(stickInput(0, STICK.down + 1).down, 'straight down did not crouch');
});

await run('iron rain — the tables');
