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

// ---------------------------------------------------------------- the yōkai
//
// Japan's cast each carries a mechanic of its own, and each one here is the
// rule as the stage note promises it — not the drawing.

const stageIdx = (n) => STAGES.findIndex((s) => s.n === n);

scenario('the Kappa spills his bowl at half health and turns slow', () => {
  const b = open(stageIdx(12), ['monkey']);
  b.st.queued.push({ kind: 'kappa', when: 0, row: 1 });
  tick(b, 0.2);
  const kappa = b.st.monsters[0];
  check(kappa, 'no Kappa came in');
  check(!kappa.spilled, 'the bowl arrived already spilled');

  const x0 = kappa.x;
  tick(b, 1);
  const fullStride = x0 - kappa.x;

  kappa.hp = kappa.maxHp * 0.4;
  tick(b, 0.1);
  check(kappa.spilled, 'half health should tip the bowl');
  const x1 = kappa.x;
  tick(b, 1);
  const spiltStride = x1 - kappa.x;
  check(spiltStride < fullStride * 0.7,
    `spilled he walked ${spiltStride.toFixed(1)} against ${fullStride.toFixed(1)} with the bowl full`);
});

scenario('the Kitsune splits into illusions that pay nothing and die with her', () => {
  const b = open(stageIdx(13), ['monkey']);
  b.st.queued.push({ kind: 'kitsune', when: 0, row: 2 });
  tick(b, 0.2);
  const fox = b.st.monsters[0];
  check(fox, 'no Kitsune came in');

  // she casts on stepping into the board
  tick(b, 4);
  const ghosts = b.st.monsters.filter((m) => m.illusion);
  check(ghosts.length === 2, `${ghosts.length} illusions appeared — the legend says two`);
  check(ghosts.every((g) => g.hp === 1), 'an illusion dies at one hit, so it starts at 1 hp');

  // killing one — through the game's own death path — pays no seed, counts no kill
  const seeds0 = b.st.seeds;
  const killed0 = b.st.killed;
  ghosts[0].dots.push({ damage: 9999, t: 1, pool: 0 });
  // and an illusion reaching the fence is smoke, not defeat
  ghosts[1].x = 100;
  tick(b, 1);
  check(!b.st.over, 'an illusion crossed the fence and the stage ended');
  checkEqual(b.st.seeds, seeds0, 'smoke paid seeds');
  checkEqual(b.st.killed, killed0, 'smoke went on the scoreboard');

  // and the survivors vanish the moment the real fox falls
  b.st.queued.push({ kind: 'kitsune', when: 0, row: 2 });
  tick(b, 4.2);
  const fox2 = b.st.monsters.find((m) => m.def.illusions && !m.illusion && !m.dead && m.id !== fox.id);
  check(fox2, 'the second Kitsune never came in');
  const hers = b.st.monsters.filter((m) => m.illusion && m.owner === fox2.id);
  check(hers.length === 2, `the second fox cast ${hers.length} copies`);
  fox2.dots.push({ damage: 99999, t: 1, pool: 0 });
  tick(b, 0.5);
  check(b.st.monsters.every((m) => m.owner !== fox2.id), 'the copies outlived the caster');
});

scenario('the Tengu flies over the wall, lands behind it, and only then can anyone hit him', () => {
  const b = open(stageIdx(14), ['turtle', 'monkey']);
  b.st.queued.push({ kind: 'tengu', when: 0, row: 2 });
  tick(b, 0.2);
  const tengu = b.st.monsters[0];
  check(tengu, 'no Tengu came in');
  check(tengu.flying, 'a Tengu enters flying');

  const wall = plant(b, 'turtle', 700, tengu.y);
  check(wall, 'the turtle was never planted');

  // still short of the wall: airborne
  tengu.x = wall.x + 80;
  tick(b, 0.1);
  check(tengu.flying, 'he landed before crossing the wall');

  // past it: feet on the ground, an ordinary brawler now
  tengu.x = wall.x - 80;
  tick(b, 0.1);
  check(!tengu.flying, 'crossing the front line should bring him down');

  const hp0 = tengu.hp;
  const gun = plant(b, 'monkey', 400, tengu.y);
  check(gun, 'the monkey was never planted');
  tengu.x = gun.x + 200;
  tengu.stunned = 9; // hold him still so the coconut has someone to hit
  tick(b, 3);
  check(tengu.hp < hp0 || tengu.dead, 'landed, the ground shooter still could not touch him');
});

scenario("the Rokurokubi stops at the wall but her neck eats whoever hides behind it", () => {
  const b = open(stageIdx(15), ['turtle', 'squirrel']);
  b.st.queued.push({ kind: 'rokurokubi', when: 0, row: 2 });
  tick(b, 0.2);
  const neck = b.st.monsters[0];
  check(neck, 'no Rokurokubi came in');

  const wall = plant(b, 'turtle', 700, neck.y);
  const prey = plant(b, 'squirrel', 590, neck.y);
  check(wall && prey, 'the lane was never set up');

  neck.x = wall.x + 50;
  const wallHp = wall.hp;
  const preyHp = prey.hp;
  tick(b, 4);
  check(prey.hp < preyHp, 'the neck never reached past the wall');
  checkEqual(wall.hp, wallHp, 'she bit the wall instead — the neck exists to skip it');
});

scenario('the Yuki-onna freezes the defenders — except the one who lives in hot springs', () => {
  const b = open(stageIdx(16), ['monkey', 'snowmonkey']);
  b.st.queued.push({ kind: 'yukionna', when: 0, row: 2 });
  tick(b, 0.2);
  const yuki = b.st.monsters[0];
  check(yuki, 'no Yuki-onna came in');

  const cold = plant(b, 'monkey', 600, yuki.y);
  const warm = plant(b, 'snowmonkey', 480, yuki.y);
  check(cold && warm, 'the pair was never planted');

  yuki.x = cold.x + 120;
  tick(b, 7);
  check(cold.frozen > 0, 'her breath froze nobody');
  checkEqual(warm.frozen, 0, 'the Snow Monkey is warm — her cold cannot bite him');

  // frozen solid means not shooting: no shot leaves while the ice holds
  b.st.shots.length = 0;
  cold.frozen = 2;
  warm.hp = 0; // only the frozen one left
  tick(b, 0.5);
  check(b.st.shots.every((sh) => false) || b.st.shots.length === 0, 'a frozen shooter kept firing');
});

scenario('the Nurikabe swallows piercing shots and no kick moves it', () => {
  const b = open(stageIdx(18), ['snake', 'kangaroo']);
  b.st.queued.push({ kind: 'nurikabe', when: 0, row: 2 });
  b.st.queued.push({ kind: 'karakasa', when: 0, row: 2 });
  tick(b, 0.2);
  const wall = b.st.monsters.find((m) => m.def.id === 'nurikabe');
  const behind = b.st.monsters.find((m) => m.def.id === 'karakasa');
  check(wall && behind, 'the pair never came in');

  const gun = plant(b, 'snake', 400, wall.y);
  check(gun, 'the snake was never planted');
  wall.x = gun.x + 300;
  behind.x = gun.x + 400;
  wall.stunned = 30;
  behind.stunned = 30;

  const hp0 = behind.hp;
  tick(b, 6);
  check(wall.hp < wall.maxHp, 'the snake never even hit the wall');
  checkEqual(behind.hp, hp0, 'a piercing shot went THROUGH the living wall');

  // and the kangaroo's kick moves everyone but him
  const roo = plant(b, 'kangaroo', 600, wall.y);
  check(roo, 'the kangaroo was never planted');
  wall.stunned = 0;
  wall.x = roo.x + 60;
  const wx = wall.x;
  tick(b, 2);
  check(wall.x <= wx + 1, `the kick pushed the wall from ${wx.toFixed(0)} to ${wall.x.toFixed(0)}`);
});

scenario("the Oni's club reaches the cell behind whoever it bites", () => {
  const b = open(stageIdx(17), ['turtle', 'squirrel']);
  b.st.queued.push({ kind: 'oni', when: 0, row: 2 });
  tick(b, 0.2);
  const oni = b.st.monsters[0];
  check(oni, 'no Oni came in');

  const front = plant(b, 'turtle', 700, oni.y);
  check(front, 'the turtle was never planted');
  // the neighbour cell behind the turtle, found from the game's own geometry
  const gap = plant(b, 'squirrel', front.x - 112, oni.y);
  check(gap && gap.col === front.col - 1, 'the squirrel is not in the cell behind the wall');

  oni.x = front.x + 50;
  const backHp = gap.hp;
  tick(b, 4);
  check(front.hp < front.maxHp, 'the Oni never swung');
  check(gap.hp < backHp, 'the smash never reached the cell behind');
});

scenario('the Onryō walks untouchable while phased, and returns in another lane', () => {
  const b = open(stageIdx(20), ['monkey']);
  b.st.queued.push({ kind: 'onryo', when: 0, row: 2 });
  tick(b, 0.2);
  const boss = b.st.monsters.find((m) => m.def.boss);
  check(boss, 'no Onryō came in');

  boss.phased = 2;
  const hp0 = boss.hp;
  const row0 = boss.row;
  const gun = plant(b, 'monkey', 400, boss.y);
  check(gun, 'the monkey was never planted');
  boss.x = gun.x + 250;
  tick(b, 1);
  checkEqual(boss.hp, hp0, 'a shot touched the intangible');

  tick(b, 1.5); // the phase runs out mid-way here
  check(boss.row !== row0, 'he came back in the same lane he left');
});

scenario('a boss calls backup under its own name, in both languages', async () => {
  const { i18n } = await import('../src/i18n.js');
  // The Onryō announced "the Cuca called for backup" for a whole campaign: the
  // line was written once, in Brazil, and the second boss inherited it. The
  // notice is a function on purpose, so read it the way the screen does.
  const said = (stage, kind) => {
    const b = open(stageIdx(stage), ['monkey']);
    b.st.queued.push({ kind, when: 0, row: 2 });
    tick(b, 0.2);
    const boss = b.st.monsters.find((m) => m.def.boss);
    check(boss, `no ${kind} came in`);
    b.st.notice = null;
    boss.summonCd = 0.1;            // the next call, without waiting out the cycle
    tick(b, 0.4);
    check(b.st.notice, `${kind} never called anybody`);
    const field = b.st.notice.field;
    return typeof field === 'function' ? field() : field[i18n.lang];
  };

  for (const lang of ['en', 'pt']) {
    i18n.set(lang);
    const cuca = said(10, 'cuca');
    const onryo = said(20, 'onryo');
    check(cuca.includes('Cuca'), `the Cuca's backup line reads "${cuca}" in ${lang}`);
    check(onryo.includes('Onryō'), `the Onryō's backup line reads "${onryo}" in ${lang}`);
    check(!onryo.includes('Cuca'), `in ${lang} the Onryō is still calling for the Cuca: "${onryo}"`);
  }
  i18n.set('en');
});

// ------------------------------------------------------- the Japan recruits

scenario('the Tanuki cheats death exactly once', () => {
  const b = open(stageIdx(11), ['tanuki']);
  b.st.queued.push({ kind: 'karakasa', when: 0, row: 2 });
  tick(b, 0.2);
  const monster = b.st.monsters[0];

  const tanuki = plant(b, 'tanuki', 600, monster.y);
  check(tanuki, 'the tanuki was never planted');
  monster.x = tanuki.x + 40;

  tanuki.hp = 1; // the next bite would be the end
  tick(b, 2);
  check(tanuki.tricked, 'the killing blow should have hit a statue');
  check(tanuki.hp > 0, 'the trick left him dead anyway');
  check(tanuki.hp <= tanuki.maxHp * 0.5 + 1, 'the trick brings back half, not a full heal');

  tanuki.hp = 1;
  tick(b, 3);
  check(b.st.planted.every((p) => p.id !== tanuki.id) || tanuki.hp <= 0,
    'the trick worked twice — once is the whole bargain');
});

scenario('the Crane covers its own lane and both neighbours', () => {
  const b = open(stageIdx(11), ['crane']);
  // three monsters, three lanes, all held in front of the crane
  for (const row of [1, 2, 3]) b.st.queued.push({ kind: 'karakasa', when: 0, row });
  tick(b, 0.2);
  check(b.st.monsters.length === 3, `${b.st.monsters.length} monsters came in`);
  const middle = b.st.monsters.find((m) => m.row === 2);

  const crane = plant(b, 'crane', 400, middle.y);
  check(crane, 'the crane was never planted');
  for (const m of b.st.monsters) { m.stunned = 30; m.x = crane.x + 300; }

  tick(b, 3);
  const rows = new Set(b.st.shots.map((sh) => sh.row));
  for (const m of b.st.monsters) rows.add(m.row); // shots may have landed already
  const hurt = b.st.monsters.filter((m) => m.hp < m.maxHp).map((m) => m.row);
  check(hurt.includes(1) && hurt.includes(2) && hurt.includes(3),
    `only lanes [${hurt.join(', ')}] were hit — a crane covers all three`);
});

scenario('a snowball slows whoever it hits', () => {
  const b = open(stageIdx(16), ['snowmonkey']);
  b.st.queued.push({ kind: 'karakasa', when: 0, row: 2 });
  tick(b, 0.2);
  const target = b.st.monsters[0];

  const monkey = plant(b, 'snowmonkey', 400, target.y);
  check(monkey, 'the snow monkey was never planted');
  target.x = monkey.x + 300;
  target.stunned = 3;

  tick(b, 3);
  check(target.frozen > 0 || target.dead, 'a snowball landed and nothing slowed down');
});

scenario('the Koi is the first shooter who fights from inside the river', () => {
  const stage = STAGES.find((s) => s.n === 12);
  const b = open(stageIdx(12), ['koi', 'monkey']);
  b.st.queued.push({ kind: 'kappa', when: 0, row: 0 });
  tick(b, 0.2);
  const kappa = b.st.monsters[0];
  check(stage.water.includes(kappa.row), 'the Kappa should enter by the water');

  const koi = plant(b, 'koi', 500, kappa.y);
  check(koi && stage.water.includes(koi.row), 'the koi would not go into the water');

  kappa.x = koi.x + 300;
  kappa.stunned = 5;
  tick(b, 3);
  check(kappa.hp < kappa.maxHp || kappa.dead, 'in the river, the koi never fired a jet');
});

// ------------------------------------------------- unlocks and the old save

scenario('the shop only rolls the Japan recruits after the crossing', async () => {
  const { shopPool, rollCards } = await import('../src/data/animals.js');
  const japanIds = ['tanuki', 'crane', 'snowmonkey', 'koi'];

  // before Japan: two hundred windows and not one Japanese card
  for (let i = 0; i < 200; i++) {
    const offers = rollCards(STARTER_DECK, 3, 9999);
    check(!offers.some((id) => japanIds.includes(id)), `${offers} offered Japan before the crossing`);
  }

  // after: they are in the pool, and the window can produce them
  const pool = shopPool(['japan']);
  check(japanIds.every((id) => pool.some((a) => a.id === id)), 'the crossing did not unlock the recruits');
  const everything = ANIMALS_COUNT_GUARD();
  function ANIMALS_COUNT_GUARD() {
    let seen = false;
    for (let i = 0; i < 400 && !seen; i++) {
      seen = rollCards(STARTER_DECK, 3, 9999, [], pool).some((id) => japanIds.includes(id));
    }
    return seen;
  }
  check(everything, '400 windows after the crossing and no Japanese card ever showed up');
});

scenario('a save that beat Brazil wakes up pointing at Japan', async () => {
  const Save = await import('../src/save.js');
  const beaten = {
    ...Save.freshSave(),
    won: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    currentStage: 10, // written by the version that ended at the Cuca
    sawIntro: true,
  };
  localStorage.setItem('animais-vs-monstros:save', JSON.stringify(beaten));
  const s = Save.load();
  checkEqual(s.currentStage, 11, 'the old save should walk forward to the first Japan stage');
  checkEqual(s.sawJapanIntro, false, 'the crossing film still owes this player a showing');
  localStorage.removeItem('animais-vs-monstros:save');
});

scenario('a save from before the squad limit keeps its collection and fields 14', async () => {
  const Save = await import('../src/save.js');
  const { ANIMALS, DECK_LIMIT } = await import('../src/data/animals.js');
  const everything = ANIMALS.filter((a) => !a.unlock).map((a) => a.id); // the 19 Brazil cards
  const hoarder = {
    ...Save.freshSave(),
    deck: everything, // written when `deck` WAS the collection
    levels: { monkey: 5, elephant: 2 }, // level V without Japan: not buyable
    won: [1, 2, 3],
    sawIntro: true,
  };
  delete hoarder.owned;
  localStorage.setItem('animais-vs-monstros:save', JSON.stringify(hoarder));
  const s = Save.load();
  checkEqual(s.owned.length, everything.length, 'the collection lost cards in the move');
  checkEqual(s.deck.length, DECK_LIMIT, `the squad should cap at ${DECK_LIMIT}, got ${s.deck.length}`);
  check(s.deck.every((id) => s.owned.includes(id)), 'the squad fields a card nobody owns');
  checkEqual(s.levels.monkey, 3, 'level V on a Brazil-only save is a level that could not be bought');

  // the same levels survive intact once Japan is genuinely open
  const traveller = { ...hoarder, won: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
  localStorage.setItem('animais-vs-monstros:save', JSON.stringify(traveller));
  const s2 = Save.load();
  checkEqual(s2.levels.monkey, 5, 'with Japan open, level V is legitimate and stays');
  localStorage.removeItem('animais-vs-monstros:save');
});

await run('animals vs monsters — battle');
