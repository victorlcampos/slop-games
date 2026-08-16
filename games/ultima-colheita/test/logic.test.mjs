// The town played in Node: founded, fed, starved, walled in and overrun —
// no canvas, no browser, and every check carries the number it saw.

import { scenario, check, checkEqual, run, installHeadlessDom } from 'slopkit/testing';
import { missingKeys } from 'slopkit/i18n';

installHeadlessDom();

const { COLS, ROWS, SEASON_LEN, SEASONS, YEAR_LEN, HORN_LEAD, STEP, START_POP, GROW_EVERY, STARVE_EVERY, TRAIN_TIME, QUEUE_MAX, H } =
  await import('../src/config.js');
const { GRASS, TREE, ROCK, genMap, HALL_C, HALL_R, countAround } = await import('../src/map.js');
const { BUILDINGS, SHOP, whyNot, buildingAt, siteYield } = await import('../src/buildings.js');
const { ZOMBIES, hordeFor, hpScale, gatesFor } = await import('../src/hordes.js');
const { UNITS, makeUnit, makeZombie } = await import('../src/units.js');
const { createWorld } = await import('../src/world.js');
const { freshSave, normalize, bank } = await import('../src/run.js');
const { dict } = await import('../src/i18n.js');
const { barLayout, hit, TOOLS, TRAINABLE } = await import('../src/ui.js');
const { QUESTS, questNow } = await import('../src/quests.js');
const {
  DEFAULT_ZOOM, MAX_ZOOM, cameraTransform, clampCamera, createCamera, fitZoom,
  minimapRect, minimapToBoard, toBoard, zoomAt,
} = await import('../src/camera.js');

/** March a world forward `seconds` at the game's own fixed step. */
function play(world, seconds) {
  for (let t = 0; t < seconds; t += STEP) world.tick(STEP);
}

/** A world on bare grass: combat scenarios should not depend on where the
 *  seed happened to plant a forest. */
function bareWorld() {
  const world = createWorld({ seed: 7 });
  world.map.tiles.fill(GRASS);
  return world;
}

// ------------------------------------------------------------ the two flags

scenario('every phrase exists in both languages', () => {
  const holes = missingKeys(dict);
  check(holes.length === 0, `half a translation: ${holes.join(', ')}`);
});

scenario('everything the game names on screen has a phrase to name it with', () => {
  const wanted = [
    ...SHOP.flatMap((id) => [`b.${id}`, `b.${id}.note`]),
    ...Object.keys(UNITS).map((u) => `u.${u}`),
    ...SEASONS.map((s) => `season.${s}`),
    ...TOOLS.map((tl) => [`tool.${tl}`, `tool.${tl}.note`]).flat(),
    'b.hall', 'b.hall.note',
  ];
  const missing = wanted.filter((k) => !dict[k]);
  check(missing.length === 0, `no dictionary entry for ${missing.join(', ')}`);
});

scenario('every refusal the rules can give is a phrase the player can read', () => {
  // collect the reasons the code can actually return, from the modules' texts —
  // a new `return 'why.x'` with no dictionary entry shows the raw key on screen
  const world = bareWorld();
  const reasons = new Set(['why.edge', 'why.ground', 'why.taken', 'why.needsTrees', 'why.needsRock',
    'why.poor', 'why.keep', 'why.needsBarracks', 'why.needsRange', 'why.queueFull', 'why.noHands', 'why.unknown']);
  check(world.train('nothing') === 'why.unknown', 'the guard phrase is wired');
  const missing = [...reasons].filter((k) => !dict[k]);
  check(missing.length === 0, `refusals with no words: ${missing.join(', ')}`);
});

// ----------------------------------------------------------------- the quests

scenario('every quest has words in both languages, survive included', () => {
  const wanted = [...QUESTS.map((q) => `q.${q.id}`), 'q.survive', 'q.title', 'q.done'];
  const missing = wanted.filter((k) => !dict[k]);
  check(missing.length === 0, `quests with no words: ${missing.join(', ')}`);
});

scenario('the first quest is the sawmill, and building one advances the chain', () => {
  const world = bareWorld();
  check(questNow(world).id === 'sawmill',
    `a new town's first quest is ${questNow(world).id} — the first player got lost exactly here`);
  world.res.wood = 99;
  world.map.tiles[2 + 3 * COLS] = TREE;
  world.place('sawmill', 3, 3);
  world.tick(STEP);
  check(world.events.some((e) => e.kind === 'quest' && e.id === 'sawmill'), 'the done quest went unannounced');
  check(questNow(world).id === 'farm', `the chain moved to ${questNow(world).id}`);
});

scenario('a diligent founder finishes the whole quest chain before the first snow', () => {
  // The promise the economy is tuned to. The founder is scripted and plays
  // by the book: reads the current quest, does exactly that, nothing else.
  // If a cost or a yield drifts out of reach, this goes red before a player
  // ever meets a first winter they could not have prepared for.
  const winterAt = SEASON_LEN * (SEASONS.length - 1);
  for (const seed of [3, 11, 42, 300]) {
    const world = createWorld({ seed });

    // candidate cells sorted by distance from the manor, like a person builds
    const cells = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) cells.push({ c, r });
    }
    cells.sort((a, b) =>
      Math.hypot(a.c - COLS / 2, a.r - ROWS / 2) - Math.hypot(b.c - COLS / 2, b.r - ROWS / 2));
    const tryPlace = (id) => {
      // a resource building goes where its resource is thickest — the note on
      // the button says so, and the founder reads the notes
      const needs = BUILDINGS[id].needs;
      if (needs !== undefined) {
        let best = null;
        let bestN = 0;
        for (const { c, r } of cells) {
          if (whyNot(world, id, c, r) !== null) continue;
          const n = countAround(world.map, c, r, needs);
          if (n > bestN) {
            bestN = n;
            best = { c, r };
            if (n >= 8) break;
          }
        }
        return best ? world.place(id, best.c, best.r) === null : false;
      }
      for (const { c, r } of cells) if (world.place(id, c, r) === null) return true;
      return false;
    };

    let t = 0;
    while (t < winterAt && questNow(world).id !== 'survive') {
      world.tick(STEP);
      t += STEP;
      world.events.length = 0;
      if (Math.abs(t % 1) >= STEP) continue; // act once a second, like a thumb
      const q = questNow(world);
      if (q.id === 'soldiers') {
        // count the training yard too — queueing five recruits for a quest
        // that needs two is how a founder starves their own economy
        if (world.units.length + world.queue.length < q.target) world.train('soldier');
      } else if (q.id === 'walls') tryPlace('wall');
      else tryPlace(q.id);
    }

    check(questNow(world).id === 'survive',
      `seed ${seed}: winter caught the founder on "${questNow(world).id}" (${questNow(world).n}/${questNow(world).target}) `
      + `with f${Math.round(world.res.food)} w${Math.round(world.res.wood)} s${Math.round(world.res.stone)} at t=${t.toFixed(0)}s`);
    check(!world.over, `seed ${seed}: the town fell while following its own tutorial`);
  }
});

scenario('a finished chain settles into surviving the winter', () => {
  const world = bareWorld();
  world.questIdx = QUESTS.length;
  const q = questNow(world);
  check(q.id === 'survive' && q.year === world.year, 'the standing order is missing');
});

// ------------------------------------------------------------------ the rates

scenario('the rates answer where wood comes from', () => {
  const world = bareWorld();
  const idle = world.rates();
  check(idle.wood > 0, `a fresh town forages ${idle.wood} wood`);
  check(idle.food < 0, `six mouths and no farm read ${idle.food} food/s`);

  world.res.wood = 99;
  world.place('farm', 3, 3);
  world.buildings.find((b) => b.id === 'farm').built = 1;
  world.tYear = SEASON_LEN + 1; // summer
  check(world.rates().food > 0, `a summer farm reads ${world.rates().food} food/s`);
  world.tYear = SEASON_LEN * 3 + 1; // winter
  check(world.rates().food < 0, `a winter farm reads ${world.rates().food} food/s`);
});

// ---------------------------------------------------------------- the valley

scenario('the same seed deals the same valley, a different seed does not', () => {
  const a = genMap(42);
  const b = genMap(42);
  const c = genMap(43);
  checkEqual(a.tiles, b.tiles, 'seed 42 dealt two different valleys');
  check(a.tiles.some((t, i) => t !== c.tiles[i]), 'seeds 42 and 43 dealt the same valley');
});

scenario('the valley has wood to cut, rock to break, and a clearing for the manor', () => {
  for (const seed of [1, 7, 99, 1234]) {
    const map = genMap(seed);
    const trees = map.tiles.filter((t) => t === TREE).length;
    const rocks = map.tiles.filter((t) => t === ROCK).length;
    check(trees >= 8, `seed ${seed}: only ${trees} trees — no economy can start`);
    check(rocks >= 3, `seed ${seed}: only ${rocks} rock tiles`);
    for (let dc = 0; dc < 2; dc++) {
      for (let dr = 0; dr < 2; dr++) {
        check(map.tiles[HALL_C + dc + (HALL_R + dr) * COLS] === GRASS,
          `seed ${seed}: the manor's ground is not clear`);
      }
    }
  }
});

scenario('the board edge stays walkable — hordes are born there', () => {
  const map = genMap(5);
  for (let c = 0; c < COLS; c++) {
    check(map.tiles[c] === GRASS && map.tiles[c + (ROWS - 1) * COLS] === GRASS,
      `column ${c} has a blocked edge`);
  }
});

// ------------------------------------------------------------- the buildings

scenario('placement refuses the edge, busy ground, and an empty purse', () => {
  const world = bareWorld();
  check(whyNot(world, 'house', -1, 3) === 'why.edge', 'built off the west edge');
  check(whyNot(world, 'farm', COLS - 1, 3) === 'why.edge', 'a 2x2 farm fit on the last column');
  check(whyNot(world, 'house', HALL_C, HALL_R) === 'why.taken', 'built on top of the manor');
  world.map.tiles[5 + 5 * COLS] = TREE;
  check(whyNot(world, 'house', 5, 5) === 'why.ground', 'built inside a tree');
  world.res.wood = 0;
  check(whyNot(world, 'house', 3, 3) === 'why.poor', 'built a house with no wood');
});

scenario('a sawmill wants trees and a quarry wants rock', () => {
  const world = bareWorld();
  world.res.wood = 999;
  check(whyNot(world, 'sawmill', 3, 3) === 'why.needsTrees', 'a sawmill stood in open grass');
  world.map.tiles[2 + 3 * COLS] = TREE;
  check(whyNot(world, 'sawmill', 3, 3) === null, 'a sawmill refused the tree beside it');
  check(whyNot(world, 'quarry', 10, 10) === 'why.needsRock', 'a quarry stood in open grass');
  world.map.tiles[10 + 9 * COLS] = ROCK;
  check(whyNot(world, 'quarry', 10, 10) === null, 'a quarry refused the rock beside it');
});

scenario('building pays the cost, demolishing returns half, the manor stays', () => {
  const world = bareWorld();
  world.res.stone = 20;
  check(world.place('wall', 3, 3) === null, 'a wall would not stand');
  check(world.res.stone === 20 - BUILDINGS.wall.cost.stone, `stone went to ${world.res.stone}`);
  check(buildingAt(world, 3, 3) !== null, 'the wall is not on the board');
  check(world.demolish(3, 3) === null, 'the wall would not come down');
  check(world.res.stone === 20 - BUILDINGS.wall.cost.stone + Math.floor(BUILDINGS.wall.cost.stone / 2),
    `the rubble returned the wrong stone: ${world.res.stone}`);
  check(world.demolish(HALL_C, HALL_R) === 'why.keep', 'the manor was demolished');
});

scenario('every shop entry has a price, hit points and a footprint', () => {
  for (const id of SHOP) {
    const spec = BUILDINGS[id];
    check(spec.hp > 0, `${id} has no hit points`);
    check(spec.w >= 1 && spec.h >= 1, `${id} has no footprint`);
    check(Object.keys(spec.cost).length > 0, `${id} is free — a price nobody set`);
  }
});

// -------------------------------------------------------------- the economy

scenario('a farm feeds the town in summer and nothing in winter', () => {
  const world = bareWorld();
  world.res.wood = 99;
  world.place('farm', 3, 3);
  world.buildings.find((b) => b.id === 'farm').built = 1;
  // a birth costs food and would mask what the farm does — fill the roofs so
  // this scenario measures the field and nothing else
  world.pop = world.popCap();

  world.tYear = SEASON_LEN + 1; // summer
  const before = world.res.food;
  play(world, 5);
  check(world.res.food > before, `five summer seconds went from ${before} to ${world.res.food}`);

  world.tYear = SEASON_LEN * 3 + 1; // winter — and the horde is not invited
  world.warned = true;
  world.hordeIn = true;
  const winterBefore = world.res.food;
  play(world, 5);
  check(world.res.food < winterBefore,
    `a winter farm still fed the town: ${winterBefore} -> ${world.res.food}`);
});

scenario('a sawmill cuts faster in deep forest than beside one tree', () => {
  const world = bareWorld();
  world.map.tiles[2 + 3 * COLS] = TREE;
  const lone = { id: 'sawmill', c: 3, r: 3 };
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
    if (dc || dr) world.map.tiles[10 + dc + (10 + dr) * COLS] = TREE;
  }
  const deep = { id: 'sawmill', c: 10, r: 10 };
  check(siteYield(world.map, deep) >= siteYield(world.map, lone) * 2,
    `deep forest ${siteYield(world.map, deep)}, lone tree ${siteYield(world.map, lone)}`);
  check(siteYield(world.map, deep) <= 1, 'yield above 1 — the cap is gone');
});

scenario('an understaffed economy slows down instead of running free', () => {
  const world = bareWorld();
  world.res.wood = 999;
  world.place('farm', 3, 3);
  world.place('farm', 6, 3);
  for (const b of world.buildings) b.built = 1;
  world.pop = 2; // four chairs, two villagers
  check(Math.abs(world.efficiency() - 0.5) < 1e-9, `efficiency came out ${world.efficiency()}`);
  world.pop = 20;
  check(world.efficiency() === 1, 'a full crew is not capped at 1');
});

scenario('villagers arrive under a roof and starve without bread', () => {
  const world = bareWorld();
  world.units.length = 0; // the two guards would fill the starting roofs
  world.res.food = 100;
  play(world, GROW_EVERY + 1);
  check(world.pop === START_POP + 1, `a fed town with room grew to ${world.pop}`);

  const starving = bareWorld();
  starving.res.food = 0;
  play(starving, STARVE_EVERY + 1);
  check(starving.pop === START_POP - 1, `an empty granary left ${starving.pop} villagers`);
  check(starving.events.some((e) => e.kind === 'starve'), 'nobody was told about the starving');
});

scenario('growth stops at the roof line, and the army sleeps under it too', () => {
  const world = bareWorld();
  world.res.food = 500;
  world.pop = world.popCap();
  play(world, GROW_EVERY * 3);
  check(world.pop === world.popCap(), `the town grew past its roofs: ${world.pop}/${world.popCap()}`);

  // two guards + a full village = two heads over the roof line: no cradles
  const garrison = bareWorld();
  garrison.res.food = 500;
  garrison.pop = garrison.popCap() - garrison.units.length; // exactly full WITH the army
  const before = garrison.pop;
  play(garrison, GROW_EVERY * 2);
  check(garrison.pop === before,
    `the garrison town grew to ${garrison.pop} heads ${garrison.heads()}/${garrison.popCap()}`);
  // the guards fall: their beds free up and the cradles start again
  garrison.units.length = 0;
  play(garrison, GROW_EVERY + 1);
  check(garrison.pop > before, 'two empty beds and nobody was born');
});

scenario('an army eats deeper into the granary than the same heads farming', () => {
  const idle = bareWorld();
  idle.units.length = 0;
  idle.pop = 8;
  const farmers = -idle.rates().food;

  const armed = bareWorld();
  armed.units.length = 0;
  armed.pop = 4;
  for (let i = 0; i < 4; i++) armed.units.push(makeUnit('soldier', 20, 10));
  const soldiers = -armed.rates().food;
  check(soldiers > farmers * 1.5,
    `eight farmers eat ${farmers.toFixed(2)}/s, four+four with swords eat ${soldiers.toFixed(2)}/s`);
});

scenario('famine climbs the ladder: villagers starve first, then soldiers desert', () => {
  const world = bareWorld();
  world.res.food = 0;
  world.pop = 1;
  world.map.tiles.fill(GRASS);
  play(world, STARVE_EVERY + 1);
  check(world.pop === 0, `the last villager is still standing: pop ${world.pop}`);
  check(world.units.length === 2, 'a soldier left while villagers still starved');

  play(world, STARVE_EVERY + 1);
  check(world.units.length === 1, `the deserters number ${2 - world.units.length}`);
  check(world.events.some((e) => e.kind === 'desert'), 'the desertion went unannounced');
  check(world.zombies.every((z) => !z.risen), 'a deserter rose — nothing killed him');
});

// --------------------------------------------------------------- the army

scenario('training needs the school, the coin and a spare villager', () => {
  const world = bareWorld();
  check(world.train('soldier') === 'why.needsBarracks', 'trained a soldier with no barracks');
  world.res.wood = 999;
  world.res.stone = 999;
  world.res.gold = 999;
  world.res.food = 999;
  world.place('barracks', 3, 3);
  world.buildings.find((b) => b.id === 'barracks').built = 1;

  const pop = world.pop;
  const purse = { ...world.res };
  check(world.train('soldier') === null, 'a funded barracks refused to train');
  check(world.pop === pop - 1, 'the recruit did not come out of the village');
  for (const [k, v] of Object.entries(UNITS.soldier.cost)) {
    check(world.res[k] === purse[k] - v, `training left ${k} at ${world.res[k]}, expected ${purse[k] - v}`);
  }

  const units = world.units.length;
  play(world, TRAIN_TIME + 1);
  check(world.units.length === units + 1, `the yard produced ${world.units.length - units} soldiers`);
  check(world.events.some((e) => e.kind === 'trained'), 'nobody announced the recruit');

  for (let i = 0; i < QUEUE_MAX + 2; i++) world.train('soldier');
  check(world.queue.length <= QUEUE_MAX, `the queue holds ${world.queue.length}`);

  world.pop = 1;
  world.queue.length = 0;
  check(world.train('soldier') === 'why.noHands', 'the last villager was drafted');
});

scenario('the rally flags stay on the board', () => {
  const world = bareWorld();
  world.setRally(-10, 999);
  for (const s of world.squads) {
    check(s.x >= 0 && s.x <= COLS, `a flag went to x=${s.x}`);
    check(s.y >= 0 && s.y <= ROWS, `a flag went to y=${s.y}`);
  }
});

scenario('recruits fill squads of five, and a squad moves alone', () => {
  const world = bareWorld();
  world.res.wood = 999;
  world.res.stone = 999;
  world.res.food = 999;
  world.pop = 30;
  world.place('barracks', 3, 3);
  world.buildings.find((b) => b.id === 'barracks').built = 1;
  for (let i = 0; i < 8; i++) {
    world.train('soldier');
    play(world, TRAIN_TIME + 0.2);
  }
  check(world.units.length === 10, `the yard produced ${world.units.length} of 10`);
  const bySquad = {};
  for (const u of world.units) bySquad[u.squad] = (bySquad[u.squad] || 0) + 1;
  checkEqual(bySquad, { 0: 5, 1: 5 }, 'ten soldiers did not split into two squads of five');
  check(world.squads.length >= 2, `only ${world.squads.length} flags exist`);

  // posting squad 1 across the map moves its five and nobody else
  world.strayT = -9999; // no strays: this scenario is about marching orders
  const before0 = { ...world.squads[0] };
  world.setRally(33, 4, 1);
  checkEqual(world.squads[0], before0, 'squad 0 got dragged along');
  play(world, 16); // the recruits start at the barracks, a long march away
  for (const u of world.units) {
    const flag = world.squads[u.squad];
    check(Math.hypot(u.x - flag.x, u.y - flag.y) < 2.5,
      `a squad-${u.squad} soldier stands ${Math.hypot(u.x - flag.x, u.y - flag.y).toFixed(1)} tiles from his flag`);
  }
});

scenario('a guard the dead kill stands back up with them', () => {
  const world = bareWorld();
  world.units.length = 0;
  const guard = makeUnit('soldier', 10, 10);
  guard.hp = 5; // one bite from gone
  world.units.push(guard);
  const z = makeZombie('brute', 10.4, 10);
  z.hp = 99999;
  world.zombies.push(z);
  play(world, 3);
  check(world.units.length === 0, 'the guard survived what this scenario is about');
  const risen = world.zombies.filter((zz) => zz.risen);
  check(risen.length === 1, `${risen.length} of the dead wear the uniform`);
  check(world.events.some((e) => e.kind === 'turned'), 'the rising went unannounced');
});

scenario('villagers mend the chewed wall in peacetime, for wood and hands', () => {
  const world = bareWorld();
  world.res.stone = 99;
  world.res.wood = 99;
  // an economy running at full crew, so the repair's tax on it is visible
  world.place('farm', 3, 3);
  world.place('farm', 6, 3);
  world.place('farm', 9, 3);
  world.place('wall', 5, 8);
  for (const b of world.buildings) b.built = 1;
  const wall = buildingAt(world, 5, 8);
  wall.hp = 100;

  const woodBefore = world.res.wood;
  play(world, 4);
  check(wall.hp > 100, `four peaceful seconds left the wall at ${wall.hp}`);
  check(world.res.wood < woodBefore + 4, 'the repair cost no wood'); // +hall forage margin
  check(world.repairCount === 1, `the town counts ${world.repairCount} repair crews`);
  const effRepairing = world.efficiency();
  wall.hp = BUILDINGS.wall.hp;
  play(world, 0.2);
  check(world.efficiency() > effRepairing,
    `the repair crew cost the fields nothing (${effRepairing} -> ${world.efficiency()})`);

  // during a horde the streets belong to the fight — a real horde, or the
  // cleared-check would end it on the first tick
  wall.hp = 100;
  world.hordeIn = true;
  world.units.length = 0;
  world.zombies.push(makeZombie('walker', COLS - 2, ROWS - 2));
  const hurt = wall.hp;
  play(world, 3);
  check(Math.abs(wall.hp - hurt) < 1e-9, `a wall healed to ${wall.hp} mid-siege`);
});

// -------------------------------------------------------------- the dead

scenario('the horde grows with the years and with the town it smells', () => {
  check(hordeFor(2, 5).length > hordeFor(1, 5).length, 'year 2 was no worse than year 1');
  check(hordeFor(3, 20).length > hordeFor(3, 2).length, 'a rich town drew no extra dead');
  check(hpScale(5) > hpScale(1), 'five winters did not toughen a walker');
});

scenario('runners join in year 2 and brutes in year 4, not before', () => {
  const y1 = hordeFor(1, 10);
  check(!y1.includes('runner') && !y1.includes('brute'), `year 1 brought ${y1.join(',')}`);
  check(hordeFor(2, 10).includes('runner'), 'year 2 brought no runners');
  check(!hordeFor(3, 10).includes('brute'), 'a brute came a year early');
  check(hordeFor(4, 20).includes('brute'), 'year 4 brought no brute');
});

scenario('the gates are on the edge of the board', () => {
  for (const year of [1, 3, 6]) {
    for (const g of gatesFor(9, year)) {
      const onEdge = g.x <= 1 || g.x >= COLS - 1 || g.y <= 1 || g.y >= ROWS - 1;
      check(onEdge, `year ${year}: a gate opened mid-board at ${g.x},${g.y}`);
    }
  }
});

scenario('the horn sounds before the snow, and the snow brings the horde', () => {
  const world = bareWorld();
  const winterAt = SEASON_LEN * (SEASONS.length - 1);
  world.tYear = winterAt - HORN_LEAD - 0.5;
  play(world, 1);
  check(world.events.some((e) => e.kind === 'horn'), 'the snow came unannounced');
  check(world.zombies.length === 0, 'the horde beat its own horn');

  world.events.length = 0;
  world.tYear = winterAt - 0.005;
  world.tick(STEP);
  check(world.hordeIn, 'winter came and nobody walked in');
  // a bare world holds only the manor, so the count is exactly the formula's —
  // part on the board already, the rest walking in as the procession
  const expected = hordeFor(world.year, world.buildings.length).length;
  check(world.zombies.length > 0, 'the snow started and the board is empty');
  check(world.zombies.length + world.pending.length === expected,
    `the horde numbers ${world.zombies.length}+${world.pending.length}, the formula says ${expected}`);
  check(world.events.some((e) => e.kind === 'horde'), 'the horde arrived unremarked');

  // the procession really arrives: no guards, and the whole count walks the board
  world.units.length = 0;
  play(world, expected * 3);
  check(world.pending.length === 0, `${world.pending.length} of the horde never walked in`);
  check(world.zombies.length === expected, `the board holds ${world.zombies.length} of ${expected}`);
});

scenario('a beaten horde is announced, and the year turns', () => {
  const world = bareWorld();
  world.hordeIn = true;
  world.zombies.push(makeZombie('walker', 5, 5));
  world.zombies[0].hp = 0;
  world.tick(STEP);
  check(!world.hordeIn && world.stats.hordes === 1, 'the cleared horde was not counted');
  check(world.events.some((e) => e.kind === 'cleared'), 'the victory went unannounced');

  world.tYear = YEAR_LEN - 0.005;
  world.warned = true;
  world.tick(STEP);
  check(world.year === 2, `the year is still ${world.year}`);
  check(world.stats.years === 1, `years survived reads ${world.stats.years}`);
  check(world.events.some((e) => e.kind === 'newyear'), 'the new year went unrung');
});

// ------------------------------------------------------------- the fighting

scenario('a zombie eats the wall between it and dinner', () => {
  const world = bareWorld();
  world.units.length = 0; // no guards: this one is about masonry
  world.res.stone = 99;
  world.place('wall', 25, HALL_R + 1);
  const wall = buildingAt(world, 25, HALL_R + 1);
  wall.built = 1;
  world.zombies.push(makeZombie('walker', 27, HALL_R + 1.5));

  play(world, 10);
  check(wall.hp < BUILDINGS.wall.hp, `ten seconds of walker left the wall at ${wall.hp}`);
  const hall = world.hall();
  check(hall.hp === BUILDINGS.hall.hp, 'the manor was bitten through the wall');

  play(world, 60);
  check(!world.buildings.includes(wall), 'a minute of chewing did not bring the wall down');
  check(world.events.some((e) => e.kind === 'collapse'), 'the wall fell silently');
});

scenario('a stray gnawing the far sawmill brings the army running', () => {
  const world = bareWorld();
  world.res.wood = 99;
  world.place('farm', 33, 9);
  const farm = buildingAt(world, 33, 9);
  farm.built = 1;
  // teeth first, flag second: the walker is far outside every guard's aggro
  world.zombies.push(makeZombie('walker', 35.5, 10));
  play(world, 15);
  check(world.zombies.length === 0, 'the stray ate in peace with an army at the flag');
  check(world.buildings.includes(farm), 'the army came too late — the farm is gone');
});

scenario('a wall blocks a zombie chasing the soldier behind it', () => {
  // the nearest-building rule would never exercise this: chasing *prey*, the
  // zombie has no reason to notice the wall except by walking into it
  const world = bareWorld();
  world.units.length = 0;
  world.res.stone = 99;
  world.place('wall', 25, 10);
  const wall = buildingAt(world, 25, 10);
  wall.built = 1;
  const bait = makeUnit('soldier', 23.5, 10.5);
  world.units.push(bait);
  world.zombies.push(makeZombie('walker', 26.3, 10.5));
  world.zombies[0].hp = 500; // the wall is under test, not the fight
  play(world, 4);
  check(wall.hp < BUILDINGS.wall.hp,
    `four seconds of blocked walker left the wall untouched at ${wall.hp}`);
});

scenario('a zombie prefers flesh within reach over timber', () => {
  const world = bareWorld();
  world.units.length = 0;
  const guard = makeUnit('soldier', 11.5, 10);
  guard.hp = 9999; // a training dummy: only the target choice is under test
  world.units.push(guard);
  world.zombies.push(makeZombie('walker', 10.5, 10));
  const z = world.zombies[0];
  z.hp = 9999;
  play(world, 3);
  check(guard.hp < 9999, 'the walker walked past a soldier to bite a building');
});

scenario('two guards put a walker down before it costs them much', () => {
  const world = bareWorld();
  world.zombies.push(makeZombie('walker', world.squads[0].x + 2, world.squads[0].y));
  play(world, 12);
  check(world.zombies.length === 0, 'a lone walker outlived both starting guards');
  check(world.stats.kills === 1, `the books say ${world.stats.kills} kills`);
  check(world.units.length === 2, 'a lone walker killed a guard');
});

scenario('an archer kills from a distance it never closes', () => {
  const world = bareWorld();
  world.units.length = 0;
  const bow = makeUnit('archer', 20, 5);
  world.units.push(bow);
  world.zombies.push(makeZombie('walker', 23, 5));
  world.zombies[0].hp = 20;
  play(world, 6);
  check(world.zombies.length === 0, 'three tiles of range did not kill a soft walker');
  check(world.events.some((e) => e.kind === 'arrow'), 'the kill left no arrows in the air');
});

scenario('a tower shoots on its own', () => {
  const world = bareWorld();
  world.units.length = 0;
  world.res.stone = 99;
  world.res.gold = 99;
  world.place('tower', 25, 5);
  buildingAt(world, 25, 5).built = 1;
  world.zombies.push(makeZombie('walker', 27, 5.5));
  world.zombies[0].hp = 25;
  play(world, 6);
  check(world.zombies.length === 0, 'a walker stood in tower range and lived');
});

scenario('the manor falls and the run is over', () => {
  const world = bareWorld();
  world.units.length = 0;
  world.hall().hp = 10;
  world.zombies.push(makeZombie('brute', HALL_C + 3, HALL_R + 1));
  play(world, 20);
  check(!!world.over, 'the manor is rubble and the game plays on');
  check(world.events.some((e) => e.kind === 'over'), 'the end went unannounced');
  const t = world.tYear;
  world.tick(STEP);
  check(world.tYear === t, 'a finished world is still ticking');
});

// ----------------------------------------------------------------- the vault

scenario('a serialized town comes back whole', () => {
  const world = bareWorld();
  world.res.wood = 99;
  world.res.stone = 99;
  world.place('farm', 3, 3);
  world.place('wall', 8, 8);
  world.zombies.push(makeZombie('runner', 30, 4));
  world.setRally(12, 7);
  play(world, 2);

  const state = world.serialize();
  const again = createWorld({ seed: world.seed, state });
  checkEqual(again.res, world.res, 'the purse changed in the vault');
  check(again.pop === world.pop, `pop came back as ${again.pop}`);
  check(again.buildings.length === world.buildings.length, 'a building stayed behind');
  check(again.zombies.length === 1 && again.zombies[0].kind === 'runner', 'the runner got lost');
  check(Math.abs(again.squads[0].x - 12) < 1e-9, 'the flag moved in the vault');
  check(again.squads.length === world.squads.length, 'a squad flag stayed behind');
  check(again.units.every((u, i) => u.squad === world.units[i].squad), 'a soldier forgot his squad');
  check(again.questIdx === world.questIdx, `the quest chain came back at ${again.questIdx}`);
  checkEqual(again.map.tiles.length, world.map.tiles.length, 'the valley changed size');
});

scenario('a hand-mangled save loses fields, never the run', () => {
  const base = freshSave();
  const s = normalize({ seed: 'potato', best: { years: '3' }, state: 'garbage', sawIntro: 1 }, base);
  check(Number.isFinite(s.seed) && s.seed > 0, `seed came out ${s.seed}`);
  check(s.best.years === 3, `best.years came out ${s.best.years}`);
  check(s.state === null, 'a garbage state was kept');
  check(s.sawIntro === true, 'sawIntro did not coerce');

  const empty = normalize(null, freshSave());
  check(empty.best.years === 0 && empty.state === null, 'a null save did not reset');
});

scenario('the record book keeps the best run', () => {
  const save = freshSave();
  const world = bareWorld();
  world.stats.years = 4;
  world.stats.kills = 120;
  bank(save, world);
  check(save.best.years === 4 && save.best.kills === 120, 'the first run was not banked');
  world.stats.years = 2;
  world.stats.kills = 300;
  bank(save, world);
  check(save.best.years === 4, 'a worse run overwrote the record');
  check(save.best.kills === 300, 'a better kill count was dropped');
});

scenario('a save from a fallen town opens on the end, not on a ghost run', () => {
  const world = bareWorld();
  const state = world.serialize();
  state.buildings = state.buildings.filter((b) => b.id !== 'hall');
  const again = createWorld({ seed: 1, state });
  check(!!again.over, 'a town with no manor resumed as if alive');
});

// -------------------------------------------------------------------- the UI

scenario('the command bar fits the view and every button is reachable', () => {
  for (const viewW of [1040, 1280, 1900]) {
    const rects = barLayout(viewW, H);
    checkEqual(rects.length, 9 + TRAINABLE.length + TOOLS.length, 'a button went missing');
    for (const r of rects) {
      check(r.x >= 0 && r.x + r.w <= viewW, `at ${viewW} wide, ${r.id} sticks out at x=${r.x}`);
      check(r.y >= H - 80 && r.y + r.h <= H, `${r.id} left the bar`);
      check(r.w > 40, `${r.id} is ${r.w}px wide — a thumb cannot hit that`);
    }
    const first = rects[0];
    const found = hit(rects, first.x + first.w / 2, first.y + first.h / 2);
    check(found && found.id === first.id, 'the first button does not answer a tap');
  }
});

scenario('the camera stands low by default and never leaves the valley', () => {
  check(DEFAULT_ZOOM > 1.5, `the default zoom is ${DEFAULT_ZOOM} — the whole point was to come down`);
  const cam = createCamera(0, 0, DEFAULT_ZOOM);
  clampCamera(cam, 1280, H);
  const tr = cameraTransform(cam, 1280, H);
  const corner = toBoard(tr, 0, 0);
  check(corner.x >= -1e-9 && corner.y >= -1e-9,
    `clamped at the corner, the view starts at ${corner.x},${corner.y} — off the board`);
  // and it cannot zoom past the fit floor: the whole board is the widest view
  const wide = createCamera(COLS / 2, ROWS / 2, 0.01);
  clampCamera(wide, 1280, H);
  check(Math.abs(wide.zoom - fitZoom(1280, H)) < 1e-9, `zoomed out to ${wide.zoom}`);
  check(wide.zoom < MAX_ZOOM, 'the fit floor is above the ceiling — the clamp is meaningless');
});

scenario('zooming keeps the tile under the cursor under the cursor', () => {
  const cam = createCamera(COLS / 2, ROWS / 2, DEFAULT_ZOOM);
  const sx = 900;
  const sy = 300;
  const before = toBoard(cameraTransform(cam, 1280, H), sx, sy);
  zoomAt(cam, 1280, H, 1.3, sx, sy);
  const after = toBoard(cameraTransform(cam, 1280, H), sx, sy);
  check(Math.hypot(after.x - before.x, after.y - before.y) < 0.01,
    `the ground slid from ${before.x.toFixed(2)},${before.y.toFixed(2)} to ${after.x.toFixed(2)},${after.y.toFixed(2)}`);
});

scenario('a tap on the minimap lands on the tile it points at', () => {
  const r = minimapRect(1280, H);
  check(r.x > 0 && r.y > 0 && r.y + r.h < H - 80, 'the minimap left the screen or sat on the bar');
  const centre = minimapToBoard(r, r.x + r.w / 2, r.y + r.h / 2);
  check(Math.abs(centre.x - COLS / 2) < 0.5 && Math.abs(centre.y - ROWS / 2) < 0.5,
    `the minimap's centre points at ${centre.x},${centre.y}`);
  const corner = minimapToBoard(r, r.x - 50, r.y - 50);
  check(corner.x === 0 && corner.y === 0, 'a miss outside the stamp escaped the board');
});

// --------------------------------------------------------------- a first year

scenario('a founded town survives its first spring standing still', () => {
  const world = createWorld({ seed: 3 });
  play(world, SEASON_LEN);
  check(!world.over, 'the town fell with nobody attacking it');
  check(world.pop >= START_POP, `spring ended with ${world.pop} villagers`);
  check(world.hall().hp === BUILDINGS.hall.hp, 'something bit the manor in spring');
});

scenario('the first winter is a fight the starting guards can actually have', () => {
  const world = createWorld({ seed: 3 });
  world.tYear = SEASON_LEN * 3 - 0.005;
  world.warned = true;
  play(world, SEASON_LEN);
  check(world.stats.kills > 0, `the guards killed ${world.stats.kills} of the horde`);
});

await run('a última colheita');
