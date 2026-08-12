// The battle, played in Node.
//
// This game's simulation and its drawing live in the same modules — creating a
// battle builds its sprite cache — so the kit's headless DOM goes in first and
// the strokes fall on a canvas that keeps nothing. After that the battle is an
// object with `update`, `press` and `release`, and a test can play a stage
// without a browser: plant, spawn a horde, and read what happened.
//
// The three scenarios that found real bugs while playing are here — the Iara
// coming down a dry lane, the Mother of Gold that nothing could reach, the Boto
// that changed shape at the waterline — because those are exactly the rules
// that break when the balance is touched.

import { installHeadlessDom, scenario, check, checkEqual, run } from 'slopkit/testing';

installHeadlessDom({ width: 1280, height: 720 });

const { createBattle } = await import('../src/screens/battle.js');
const { STAGES } = await import('../src/data/stages.js');
const { cardAtLevel, STARTER_DECK } = await import('../src/data/animals.js');
const { MONSTER_BY_ID } = await import('../src/data/monsters.js');

const STEP = 1 / 60;

/** Builds a battle on `stage`, already funded and with the stage's own waves silenced. */
function open(stageIndex, deck = STARTER_DECK) {
  let ended = null;
  const battle = createBattle(STAGES[stageIndex], deck, (won, summary) => { ended = { won, summary }; });
  const st = battle.st;
  st.seeds = 9999;
  st.notice = null;
  st.monsters.length = 0;
  st.queued.length = 0;
  st.nextWave = 1e9;              // only what a scenario asks for shows up
  return { battle, st, get ended() { return ended; } };
}

const tick = (b, seconds) => { for (let t = 0; t < seconds; t += STEP) b.battle.update(STEP); };

/** Plants `id` at the given screen y (a monster's y names its lane). */
function plant(b, id, x, y, level = 1) {
  b.st.selected = cardAtLevel(id, level);
  b.st.cooldowns[id] = 0;
  b.battle.release(x, y);
  return b.st.planted[b.st.planted.length - 1];
}

// ----------------------------------------------------------------- planting

scenario('planting costs seeds and puts the animal on the field', () => {
  const b = open(1);
  b.st.seeds = 100;
  const card = cardAtLevel(STARTER_DECK[0], 1);
  const before = b.st.seeds;

  const p = plant(b, card.id, 600, 400);
  check(p, 'nothing was planted');
  checkEqual(p.def.id, card.id, 'another animal went in');
  checkEqual(b.st.seeds, before - card.cost, 'the seeds did not come out of the wallet');
  check(p.hp === p.maxHp && p.hp > 0, `it went in with ${p.hp}/${p.maxHp} hp`);

  // the cell is taken now
  const again = b.st.planted.length;
  plant(b, card.id, 600, 400);
  checkEqual(b.st.planted.length, again, 'two animals went into the same cell');
});

scenario('a card on cooldown cannot be planted again straight away', () => {
  const b = open(1);
  const card = cardAtLevel(STARTER_DECK[0], 1);
  plant(b, card.id, 600, 300);
  check(b.st.cooldowns[card.id] > 0, 'planting did not start the cooldown');

  // same card, another cell, with the cooldown still running
  b.st.selected = cardAtLevel(card.id, 1);
  const count = b.st.planted.length;
  b.battle.release(700, 400);
  checkEqual(b.st.planted.length, count, 'the cooldown did not hold the second plant back');

  tick(b, card.cooldown + 0.5);
  checkEqual(b.st.cooldowns[card.id], 0, 'the cooldown never ran out');
});

// ------------------------------------------------------------------- combat

scenario('an animal kills what comes down its lane, and the seeds come in', () => {
  const b = open(1, ['monkey']);
  const p = plant(b, 'monkey', 500, 400);
  check(p, 'the monkey was never planted');

  b.st.queued.push({ kind: 'corposeco', when: 0, row: p.row });
  tick(b, 0.2);
  const monster = b.st.monsters[0];
  check(monster, 'no monster came in');
  checkEqual(monster.row, p.row, 'the monster came down another lane');

  const hp0 = monster.hp;
  tick(b, 30);
  const alive = b.st.monsters.find((m) => m.id === monster.id);
  check(!alive || alive.hp < hp0, `the monster was never hit (${hp0} hp, still ${alive && alive.hp})`);
  check(b.st.killed > 0 || !alive, 'nothing died and nothing was hurt');
});

scenario('the fence is the defeat: a monster that gets through ends the stage', () => {
  const b = open(1);
  b.st.queued.push({ kind: 'corposeco', when: 0, row: 2 });
  tick(b, 0.2);
  const m = b.st.monsters[0];
  check(m, 'no monster came in');

  m.x = 0;                                    // already at the fence
  tick(b, 3);
  check(b.st.over, 'a monster walked past the fence and the stage carried on');
  check(!b.st.won, 'walking past the fence counted as a win');
});

// -------------------------------------------------------------- the water

scenario('a flooded lane only takes what swims', () => {
  const pantanal = STAGES.findIndex((s) => (s.water || []).length > 0);
  check(pantanal >= 0, 'no stage in the campaign has water');
  const stage = STAGES[pantanal];
  const b = open(pantanal, ['alligator', 'monkey']);

  // the lane's y comes from the game itself: an Iara asked for on a dry row
  // still enters by the water, and her y names the flooded lane
  b.st.queued.push({ kind: 'iara', when: 0, row: 0 });
  b.st.queued.push({ kind: 'iara', when: 0, row: 2 });
  b.st.queued.push({ kind: 'iara', when: 0, row: 4 });
  tick(b, 0.2);
  check(b.st.monsters.length === 3, `${b.st.monsters.length} Iaras came in`);
  const iaras = [...b.st.monsters];
  for (const m of iaras) {
    check(stage.water.includes(m.row),
      `the Iara came down lane ${m.row}, which is dry — water is ${stage.water}`);
  }

  const wet = iaras[0].y;
  // the dry lane's y comes from the game too — a walking monster keeps the row
  // it was asked for, and its y is the middle of that lane. Working it out from
  // the field height instead was wrong by the height of the HUD.
  const dryRow = [0, 1, 2, 3, 4].find((r) => !stage.water.includes(r));
  b.st.queued.push({ kind: 'corposeco', when: 0, row: dryRow });
  tick(b, 0.2);
  const walker = b.st.monsters.find((m) => m.row === dryRow);
  check(walker, `nothing would walk down the dry lane ${dryRow}`);
  const dry = walker.y;

  const swimmer = plant(b, 'alligator', 600, wet);
  check(swimmer && stage.water.includes(swimmer.row), 'the alligator would not go into the water');

  const before = b.st.planted.length;
  b.st.selected = cardAtLevel('monkey', 1);
  b.st.cooldowns.monkey = 0;
  b.battle.release(700, wet);
  checkEqual(b.st.planted.length, before, 'a monkey was planted in the middle of the river');

  // and on dry land the monkey goes in as usual
  b.st.selected = cardAtLevel('monkey', 1);
  b.st.cooldowns.monkey = 0;
  b.battle.release(700, dry);
  check(b.st.planted.length === before + 1, 'the monkey would not go on dry land either');
});

scenario('what swims reaches what floats — the bite the game did not deliver', () => {
  const pantanal = STAGES.findIndex((s) => (s.water || []).length > 0);
  const b = open(pantanal, ['alligator']);
  b.st.queued.push({ kind: 'iara', when: 0, row: STAGES[pantanal].water[0] });
  tick(b, 0.2);
  const iara = b.st.monsters[0];
  check(iara, 'the Iara never came in');

  const gator = plant(b, 'alligator', 600, iara.y);
  check(gator, 'the alligator was never planted');
  iara.x = gator.x + 40;                       // right on top of him

  const hp0 = iara.hp;
  tick(b, 20);
  const alive = b.st.monsters.find((m) => m.id === iara.id);
  check(!alive || alive.hp < hp0, 'in the water, nobody could touch the Iara');
});

// --------------------------------------------------------------- the flying

scenario('what flies is only brought down by whoever reaches high', () => {
  const flyer = Object.values(MONSTER_BY_ID).find((m) => m.flies);
  check(flyer, 'no monster in the game flies');

  // an animal that cannot reach high is helpless against it…
  const ground = open(1, ['monkey']);
  const g = plant(ground, 'monkey', 500, 400);
  ground.st.queued.push({ kind: flyer.id, when: 0, row: g.row });
  tick(ground, 0.2);
  const high = ground.st.monsters[0];
  check(high, 'the flyer never came in');
  check(high.flying || high.def.flies, 'the flyer came in walking');
  const hpGround = high.hp;
  high.x = g.x + 30;
  tick(ground, 6);
  const stillUp = ground.st.monsters.find((m) => m.id === high.id);
  check(stillUp && stillUp.hp === hpGround,
    'an animal with no reach hit something flying over its head');

  // …and one that does reach high brings it down
  const air = open(1, ['owl']);
  const t = plant(air, 'owl', 500, 400);
  check(t, 'the owl was never planted (is it still in the deck?)');
  air.st.queued.push({ kind: flyer.id, when: 0, row: t.row });
  tick(air, 0.2);
  const target = air.st.monsters[0];
  const hpAir = target.hp;
  target.x = t.x + 30;
  tick(air, 20);
  const survivor = air.st.monsters.find((m) => m.id === target.id);
  check(!survivor || survivor.hp < hpAir, 'nothing in the deck could bring the flyer down');
});

// ------------------------------------------------------------- the seeds

scenario('dragging a finger picks up the seeds on the way', () => {
  const b = open(1);
  b.st.drops.length = 0;
  for (const x of [400, 520, 640]) b.st.drops.push({ x, y: 320, targetY: 320, value: 25, t: 9, spin: 0 });
  b.st.pickupGain = 0;

  b.battle.press(370, 320);
  for (let x = 370; x <= 670; x += 30) b.battle.move(x, 320);
  b.battle.release(670, 320);

  checkEqual(b.st.pickupGain, 75, 'the three seeds on the way should come in');
  checkEqual(b.st.drops.filter((d) => !d.dead).length, 0, 'none should be left behind');
});

scenario('clearing every wave wins the stage', async () => {
  const b = open(1);
  b.st.currentWave = STAGES[1].waves.length - 1;
  b.st.queued.length = 0;
  b.st.monsters.length = 0;
  tick(b, 20);
  check(b.st.over, 'with nothing left to fight the stage never ended');
  check(b.st.won, 'clearing the last wave did not count as a win');

  // the campaign is told after the victory jingle, not in the same frame
  await new Promise((r) => setTimeout(r, 1800));
  check(b.ended && b.ended.won, 'the battle never told the campaign it was won');
  check(b.ended.summary.waves === STAGES[1].waves.length, 'the summary lost count of the waves');
});

// ------------------------------------------------------- upright and sideways

scenario('a phone held upright gets the board laid on its side, not a wall', async () => {
  // The game used to cover itself with "turn your device", which asks the player
  // to unlock rotation before they can play. Upright, the canvas is turned
  // instead — and everything downstream has to follow: what the game sees is a
  // landscape viewport, and a finger has to land where it looks.
  const { createViewport, turnedPoint } = await import('slopkit/viewport');
  const canvas = { style: {}, width: 0, height: 0, getContext: () => ({ setTransform() {}, clearRect() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }) };

  globalThis.innerWidth = 390;      // a phone, upright
  globalThis.innerHeight = 844;
  const vp = createViewport(canvas, { height: 720, frame: 1280, landscape: true });

  check(vp.turned, 'the canvas was not turned on an upright phone');
  check(vp.W > 1280, `upright it sees ${vp.W} of world — the board needs nine columns`);
  check(canvas.style.transform.includes('rotate(90deg)'), `the canvas transform is "${canvas.style.transform}"`);
  check(canvas.style.transform.includes('translate(390px'), 'the turned canvas was not slid back into the window');
  check(parseInt(canvas.style.width, 10) === 844 && parseInt(canvas.style.height, 10) === 390,
    `the turned canvas is ${canvas.style.width} x ${canvas.style.height}`);

  // a tap near the bottom of the phone is a tap near the left of the board
  const bottomLeft = vp.point(10, 800);
  check(bottomLeft.x > 1400, `a tap at the bottom of the phone landed at x ${bottomLeft.x.toFixed(0)}`);
  check(bottomLeft.y > 690, `and at y ${bottomLeft.y.toFixed(0)} — it should be near the bottom of the board`);
  checkEqual(vp.point(10, 800), turnedPoint(10, 800, 390, vp.scale), 'the two roads to a point disagree');

  // held the right way round, nothing is turned and no transform is left behind
  globalThis.innerWidth = 844;
  globalThis.innerHeight = 390;
  vp.resize();
  check(!vp.turned, 'a phone already lying down was turned again');
  check(!canvas.style.transform, `a transform survived the turn back: "${canvas.style.transform}"`);
});

await run('animals vs monsters — battle');
