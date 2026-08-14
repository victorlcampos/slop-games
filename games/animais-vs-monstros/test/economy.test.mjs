// Economy tests — pure arithmetic, no browser, in milliseconds.
//
// This is where the balancing gets honest: instead of "feels about right",
// every rule becomes a checked number. When somebody moves the prices, this
// says what broke.

import { scenario, check, checkEqual, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';
import { calcReward } from '../src/data/economy.js';
import {
  ANIMALS, BY_ID, STARTER_DECK, cardAtLevel, trainingCost, requiredCards, rollCards, MAX_LEVEL,
  levelCap, toggleActive, buyCard, DECK_LIMIT, SQUAD_MIN,
} from '../src/data/animals.js';
import { MONSTERS, MONSTER_BY_ID } from '../src/data/monsters.js';
import { STAGES, CAMPAIGNS } from '../src/data/stages.js';
import { COUNTRIES } from '../src/draw/worldmap.js';

const testStage = { coins: 300, waves: [1, 2, 3, 4, 5] };

// ------------------------------------------------------------------- levels

scenario('training raises what the card does, without touching the seed cost', () => {
  const monkey1 = cardAtLevel('monkey', 1);
  const monkey3 = cardAtLevel('monkey', 3);
  check(monkey3.damage > monkey1.damage, 'damage has to go up');
  checkEqual(monkey3.cost, monkey1.cost, 'the seed cost does NOT change — that is what makes training worth it');
  check(monkey3.cooldown < monkey1.cooldown, 'at level 3 the card also comes back faster');
});

scenario('each role improves on the attribute that matters to it', () => {
  check(cardAtLevel('squirrel', 2).yield > BY_ID.squirrel.yield, 'a generator produces more');
  check(cardAtLevel('turtle', 2).hp > BY_ID.turtle.hp, 'a wall takes more');
  check(cardAtLevel('hedgehog', 2).spikes > BY_ID.hedgehog.spikes, 'spikes hurt more');
  check(cardAtLevel('scorpion', 2).poison.damage > BY_ID.scorpion.poison.damage, 'stronger poison');
  check(cardAtLevel('lion', 2).stun > BY_ID.lion.stun, 'the roar stuns for longer');
});

scenario('the level never escapes its range, wherever it comes from', () => {
  checkEqual(cardAtLevel('monkey', 99).level, MAX_LEVEL, 'a tampered save does not give level 99');
  checkEqual(cardAtLevel('monkey', 0).level, 1, 'nor level zero');
  checkEqual(cardAtLevel('monkey', -5).level, 1, 'nor a negative one');
  checkEqual(cardAtLevel('does-not-exist', 2), null, 'a missing card returns null, it does not explode');
});

scenario('the base definition is never mutated', () => {
  const originalDamage = BY_ID.monkey.damage;
  cardAtLevel('monkey', 3);
  cardAtLevel('monkey', 3);
  checkEqual(BY_ID.monkey.damage, originalDamage, 'calling twice must not accumulate on the original');
});

scenario('training gets pricier each level, and better cards cost more', () => {
  check(trainingCost('monkey', 2) > trainingCost('monkey', 1), '2→3 costs more than 1→2');
  check(trainingCost('monkey', 3) > trainingCost('monkey', 2), '3→4 costs more than 2→3');
  check(trainingCost('monkey', 4) > trainingCost('monkey', 3), '4→5 costs more than 3→4');
  check(trainingCost('elephant', 1) > trainingCost('bee', 1), 'training the Elephant costs more than the Bee');
  checkEqual(trainingCost('monkey', MAX_LEVEL), null, 'at max level there is nothing to buy');
});

scenario('Japan raises the training ceiling from III to V', () => {
  checkEqual(levelCap([]), 3, 'Brazil alone trains up to III');
  checkEqual(levelCap(['japan']), 5, 'opening Japan unlocks IV and V');
  check(levelCap(['japan', 'whatever']) <= MAX_LEVEL, 'no list of campaigns escapes the absolute cap');
});

scenario('levels IV and V buy muscle, never permanent crowd control', () => {
  // damage, hp and yield keep climbing…
  check(cardAtLevel('monkey', 5).damage > cardAtLevel('monkey', 3).damage, 'level V hits harder than III');
  check(cardAtLevel('squirrel', 5).yield > cardAtLevel('squirrel', 3).yield, 'a level V generator produces more');
  check(cardAtLevel('scorpion', 5).poison.damage > cardAtLevel('scorpion', 3).poison.damage, 'poison is damage — it scales');
  // …but control freezes at the level-III multiplier: a stun that outlasted
  // the Lion's own interval would lock an area forever
  checkEqual(cardAtLevel('lion', 5).stun, cardAtLevel('lion', 3).stun, 'the stun must stop growing at III');
  checkEqual(cardAtLevel('polarbear', 5).slow.duration, cardAtLevel('polarbear', 3).slow.duration, 'and so must the slow');
  const lion5 = cardAtLevel('lion', 5);
  check(lion5.stun < lion5.interval, `a ${lion5.stun}s stun on a ${lion5.interval}s interval is a permanent freeze`);
});

// ------------------------------------------------------------------ the squad

scenario('the squad holds 14, never fewer than 3, and the rule says why it refused', () => {
  // fill it to the brim…
  let deck = ANIMALS.slice(0, DECK_LIMIT - 1).map((a) => a.id);
  const joining = ANIMALS[DECK_LIMIT - 1].id;
  const joined = toggleActive(deck, joining);
  check(joined.deck && joined.deck.length === DECK_LIMIT, 'card 14 should still fit');
  checkEqual(joined.moved, 'field', 'and it lands on the field');

  // …the 15th stays out…
  const overflow = toggleActive(joined.deck, ANIMALS[DECK_LIMIT].id);
  checkEqual(overflow.error, 'full', 'card 15 has to be refused, with the reason');

  // …and the floor holds
  deck = [...STARTER_DECK];
  check(deck.length === SQUAD_MIN, 'the starter squad sits exactly on the floor');
  const under = toggleActive(deck, deck[0]);
  checkEqual(under.error, 'min', 'a battle needs something to plant');

  // benching from a healthy squad works, and is reversible
  const five = ANIMALS.slice(0, 5).map((a) => a.id);
  const benched = toggleActive(five, five[0]);
  checkEqual(benched.moved, 'reserve', 'a healthy squad can bench');
  check(!benched.deck.includes(five[0]), 'the benched card left the field');
  const back = toggleActive(benched.deck, five[0]);
  checkEqual(back.moved, 'field', 'and the bench door swings both ways');
});

scenario('a recruit joins the collection always, the squad only while there is room', () => {
  const state = { owned: ANIMALS.slice(0, DECK_LIMIT).map((a) => a.id), deck: ANIMALS.slice(0, DECK_LIMIT).map((a) => a.id) };
  const late = ANIMALS[DECK_LIMIT].id;
  checkEqual(buyCard(state, late), 'reserve', 'a full squad sends the recruit to the bench');
  check(state.owned.includes(late), 'but the collection always keeps it');
  checkEqual(state.deck.length, DECK_LIMIT, 'the squad did not swell past the limit');

  const roomy = { owned: [...STARTER_DECK], deck: [...STARTER_DECK] };
  checkEqual(buyCard(roomy, 'bee'), 'field', 'with room, a recruit marches straight in');
  check(roomy.deck.includes('bee') && roomy.owned.includes('bee'), 'in both lists');
});

scenario('an alligator on the bench already answers the water requirement', () => {
  const pantanal = STAGES.find((s) => s.n === 4);
  // the collection has the answer — the shop must not force-sell another one,
  // because the squad tab is where this gets fixed
  checkEqual(requiredCards(pantanal, ['squirrel', 'monkey', 'turtle', 'alligator']), [],
    'owning an aquatic (even benched) satisfies the requirement');
});

// ----------------------------------------------------------- water and cast

scenario('an aquatic monster is only called by a stage that has water', () => {
  for (const stage of STAGES) {
    const hasWater = !!(stage.water && stage.water.length);
    for (const wave of stage.waves) {
      for (const [id] of wave.monsters) {
        const def = MONSTER_BY_ID[id];
        check(def, `stage ${stage.n} calls a monster that does not exist: ${id}`);
        if (def.aquatic) {
          check(hasWater, `stage ${stage.n} calls ${id}, who only enters by water, and has no flooded lane`);
        }
      }
    }
  }
});

scenario('whoever comes by water is not immune to whoever defends the water', () => {
  // a flooded lane only accepts aquatic animals, and no aquatic animal has air:
  // a monster that both flew **and** swam would be out of everyone's reach.
  // That was exactly the Iara hole.
  const aquatics = ANIMALS.filter((a) => a.aquatic);
  check(aquatics.length >= 2, 'there has to be an aquatic animal to defend the water');
  check(
    aquatics.some((a) => typeof a.damage === 'number' && a.damage > 0),
    'at least one aquatic animal has to deal damage — a wall on its own only delays'
  );
  for (const id in MONSTER_BY_ID) {
    const def = MONSTER_BY_ID[id];
    check(!(def.aquatic && def.flies), `${id} flies and swims at the same time: nobody can reach it`);
  }
});

scenario('the amphibian debuts where there is water for it to change shape', () => {
  for (const id in MONSTER_BY_ID) {
    if (!MONSTER_BY_ID[id].swap) continue;
    const debut = STAGES.find((s) => s.waves.some((w) => w.monsters.some(([m]) => m === id)));
    check(debut, `${id} changes shape and is called by no stage at all`);
    check(
      debut.water && debut.water.length,
      `${id} debuts in stage ${debut.n}, which has no water — the shape change would never show up`
    );
  }
});

scenario('whoever flies has a buyable answer before it appears', () => {
  // a flier ignores the entire ground defence: only `air` cards answer it. If
  // it debuts before the player could have bought one, the stage is not hard —
  // it is impossible.
  const airCards = ANIMALS.filter((a) => a.air);
  check(airCards.length > 0, 'with no air card, a flying monster has no answer');
  const cheapest = Math.min(...airCards.map((a) => a.price));

  for (const stage of STAGES) {
    const flies = stage.waves.some((w) => w.monsters.some(([id]) => MONSTER_BY_ID[id].flies));
    if (!flies) continue;
    // what the campaign has already paid up to the start of this stage, no change
    const incomeSoFar = STAGES.filter((s) => s.n < stage.n).reduce((sum, s) => sum + s.coins, 0);
    check(
      incomeSoFar >= cheapest,
      `stage ${stage.n} has a flier, but up to it the campaign only paid ${incomeSoFar} and the cheapest air card costs ${cheapest}`
    );
    check(!(stage.water && stage.water.length), `stage ${stage.n} mixes flier and water: over the river nobody reaches it`);
  }
});

scenario('the shop guarantees an aquatic animal before the water stage', () => {
  const pantanal = STAGES.find((s) => s.n === 4);
  const noAquatic = ['squirrel', 'monkey', 'turtle'];
  const required = requiredCards(pantanal, noAquatic);
  check(required.length > 0, 'whoever reaches the Pantanal with no water animal has to see one in the shop');
  check(required.every((id) => BY_ID[id].aquatic), 'the water requirement only asks for water animals');

  checkEqual(requiredCards(pantanal, [...noAquatic, 'alligator']), [], 'whoever has an Alligator needs no nudge');
  checkEqual(requiredCards(STAGES.find((s) => s.n === 1), noAquatic), [], 'a stage with no water requires nothing');
  checkEqual(requiredCards(null, noAquatic), [], 'no next stage, no requirement');

  // and the requirement has to show up in every roll, not on average
  for (let i = 0; i < 200; i++) {
    const offers = rollCards(STARTER_DECK, 3, 600, required);
    checkEqual(offers.length, 3, 'the shop window still has three cards');
    check(new Set(offers).size === 3, 'and no repeated card');
    check(offers.some((id) => required.includes(id)), 'every window before the water needs a water animal');
  }
});

scenario('the shop still checks the wallet when nothing is required', () => {
  for (let i = 0; i < 200; i++) {
    // 140 pays for the second-cheapest card: there is always something buyable to offer
    const offers = rollCards(STARTER_DECK, 3, 140);
    checkEqual(offers.length, 3, 'three offers');
    check(offers.some((id) => BY_ID[id].price <= 140), 'at least one offer affordable right now');
  }
});

// ------------------------------------------------------------------- reward

scenario('winning pays the full stage reward', () => {
  const r = calcReward(testStage, { leftover: 0, currentWave: 4 }, true, true);
  checkEqual(r.base, 300, "the base is the stage's prize");
});

scenario('losing pays, and pays for how long you held', () => {
  const early = calcReward(testStage, { leftover: 0, currentWave: -1 }, false, true);
  const late = calcReward(testStage, { leftover: 0, currentWave: 4 }, false, true);
  check(early.total > 0, 'losing on the first wave still pays something');
  check(late.total > early.total * 2, 'holding to the end has to be worth a lot more');
  check(late.total < 300, 'but never as much as winning');
});

scenario('losing never pays more than winning, at any point of the stage', () => {
  const victory = calcReward(testStage, { leftover: 0, currentWave: 4 }, true, true).total;
  for (let wave = -1; wave < 5; wave++) {
    const defeat = calcReward(testStage, { leftover: 0, currentWave: wave }, false, true).total;
    check(defeat < victory, `wave ${wave}: defeat (${defeat}) should be lower than victory (${victory})`);
  }
});

scenario('leftover seed becomes coin, but with a ceiling', () => {
  const some = calcReward(testStage, { leftover: 100, currentWave: 4 }, true, true);
  checkEqual(some.change, 20, '100 seeds at 5 to 1 = 20 coins');

  const absurd = calcReward(testStage, { leftover: 99999, currentWave: 4 }, true, true);
  checkEqual(absurd.change, 105, 'the ceiling is 35% of the full reward (300 → 105)');
  check(absurd.change < absurd.base, 'hoarding seed can never pay more than playing the stage');
});

scenario('replaying a stage already won pays a lot less', () => {
  const first = calcReward(testStage, { leftover: 0, currentWave: 4 }, true, true);
  const repeat = calcReward(testStage, { leftover: 0, currentWave: 4 }, true, false);
  check(repeat.base < first.base * 0.5, 'otherwise stage 1 becomes a cash machine');
});

// ------------------------------------------------ the campaign's balance

scenario("the campaign doesn't pay for everything — the player has to choose", () => {
  const baseIncome = STAGES.reduce((sum, s) => sum + s.coins, 0);
  const typicalChange = STAGES.reduce(
    (sum, s) => sum + calcReward(s, { leftover: 300, currentWave: 99 }, true, true).change,
    0
  );
  const income = baseIncome + typicalChange;

  const recruitAll = ANIMALS.filter((a) => a.price > 0).reduce((sum, a) => sum + a.price, 0);
  const trainAll = ANIMALS.reduce((sum, a) => {
    let t = 0;
    for (let n = 1; n < MAX_LEVEL; n++) t += trainingCost(a, n);
    return sum + t;
  }, 0);

  check(income < recruitAll + trainAll, 'having everything must not fit the budget — otherwise there is no choice');
  check(income > recruitAll * 0.6, 'but it has to be enough to build a decent deck');
  check(
    trainAll > recruitAll,
    'going deep costs more than going wide: that is what makes specialising a bet'
  );
});

// -------------------------------------------------------------------- i18n

scenario('every card, monster and stage ships in both languages', () => {
  // The data files carry the two languages side by side precisely so this test
  // can exist: half a translation is a bug you only see by switching flags.
  const holes = [
    ...missingKeys(Object.fromEntries(ANIMALS.map((a) => [`animal.${a.id}.name`, a.name]))),
    ...missingKeys(Object.fromEntries(ANIMALS.map((a) => [`animal.${a.id}.desc`, a.desc]))),
    ...missingKeys(Object.fromEntries(ANIMALS.map((a) => [`animal.${a.id}.origin`, a.origin]))),
    ...missingKeys(Object.fromEntries(MONSTERS.map((m) => [`monster.${m.id}.name`, m.name]))),
    ...missingKeys(Object.fromEntries(MONSTERS.map((m) => [`monster.${m.id}.lore`, m.lore]))),
    ...missingKeys(Object.fromEntries(STAGES.map((s) => [`stage.${s.n}.name`, s.name]))),
    ...missingKeys(Object.fromEntries(STAGES.map((s) => [`stage.${s.n}.place`, s.place]))),
    ...missingKeys(Object.fromEntries(STAGES.map((s) => [`stage.${s.n}.intro`, s.intro]))),
    ...missingKeys(Object.fromEntries(STAGES.map((s) => [`stage.${s.n}.note`, s.whatsNew.note]))),
    ...missingKeys(Object.fromEntries(COUNTRIES.map((c) => [`country.${c.id}.name`, c.name]))),
    ...missingKeys(Object.fromEntries(COUNTRIES.map((c) => [`country.${c.id}.monsters`, c.monsters]))),
    ...missingKeys(
      Object.fromEntries(
        CAMPAIGNS.flatMap((c) => [
          [`campaign.${c.id}.country`, c.country],
          [`campaign.${c.id}.tagline`, c.tagline],
          [`campaign.${c.id}.sub`, c.sub],
          [`campaign.${c.id}.finished`, c.finished],
        ])
      )
    ),
  ];
  checkEqual(holes, [], 'these fields exist in one language only');
});

scenario("the boss's lines are translated too", () => {
  const cuca = MONSTER_BY_ID.cuca;
  const holes = missingKeys(Object.fromEntries(cuca.phases.map((p, i) => [`cuca.phase${i}`, p.line])));
  checkEqual(holes, [], 'a boss that speaks has to speak both languages');
});

await run('animals vs monsters economy');
