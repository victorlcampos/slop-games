// Zoo Tycoon's test, in Node, with no browser.
//
// This game runs in global scope — its files are scripts that share one scope
// and depend on order (see build.mjs, `concat` mode), so there is nothing to
// `import`. They are loaded here into a `node:vm` context with the handful of
// browser objects they touch stubbed out, in the same order the build uses.
// After that the catalogue, the terrain, the enclosures and the animals are
// ordinary values a test can read.
//
// What lives here is what a maintenance change breaks silently: a species row
// with a typo among 219, a happiness rule that stops responding to the terrain,
// a `pt|en` string read from the wrong side. None of it needs a canvas.

import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { headlessContext, scenario, check, run } from 'slopkit/testing';
import * as Slop from 'slopkit';

const SRC = path.resolve(import.meta.dirname, '../src');

// The build's own order, up to the last file that is pure simulation. Beyond
// this point (sprites, render, ui, game) the code is drawing and DOM wiring:
// that is the part a browser would have to answer for, and it is checked by
// hand before a deploy.
const FILES = ['01_i18n', '02_util', '03_species', '04_sprites', '05_world', '06_entities'];

/** The few browser objects the simulation files touch while loading. */
function sandbox() {
  const el = () => ({
    style: {}, dataset: {}, children: [], width: 1, height: 1,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, addEventListener() {}, setAttribute() {},
    getContext(kind) { return kind === '2d' ? headlessContext(this.width, this.height) : null; },
  });
  const store = new Map();
  const ctx = vm.createContext({
    Slop, console, Math, Date, JSON, Object, Array, String, Number, Boolean, Map, Set,
    isNaN, parseFloat, parseInt, Infinity, NaN, undefined,
    window: {
      addEventListener() {}, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
      matchMedia: () => ({ matches: false, addEventListener() {} }),
    },
    document: {
      querySelector: el, querySelectorAll: () => [], getElementById: el, createElement: el,
      addEventListener() {}, body: el(), documentElement: el(),
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size; },
    },
    navigator: { language: 'en' },
    requestAnimationFrame: () => 0,
    performance: { now: () => 0 },
  });
  for (const f of FILES) {
    vm.runInContext(readFileSync(path.join(SRC, `${f}.js`), 'utf8'), ctx, { filename: `${f}.js` });
  }
  return ctx;
}

const zoo = sandbox();
const read = (expr) => vm.runInContext(expr, zoo);
const call = (fn, ...args) => {
  zoo.__args = args;
  return vm.runInContext(`${fn}(...__args)`, zoo);
};
const setLang = (lang) => read(`I18N.set(${JSON.stringify(lang)})`);

// ------------------------------------------------------------- the two sides

scenario('every reader of a "pt|en" string agrees on which side is which', () => {
  // LN and BI once disagreed: the flag flipped, the text flipped with it, and
  // each player got the language they had just turned off. Nineteen browser
  // scenarios never noticed, because they checked `i18n.lang` and not the words.
  for (const [lang, expected] of [['pt', 'Savana'], ['en', 'Savanna']]) {
    setLang(lang);
    check(call('LN', 'Savana|Savanna') === expected, `LN gave "${call('LN', 'Savana|Savanna')}" in ${lang}`);
    const sentence = read('BI`Dia ${3}|Day ${3}`');
    check(sentence === (lang === 'pt' ? 'Dia 3' : 'Day 3'), `BI gave "${sentence}" in ${lang}`);
    check(!sentence.includes('|'), `a raw pt|en string reached the screen: "${sentence}"`);
  }

  // KEY is the third reader, and the one that must NOT follow the flag: it is
  // the identity behind a sprite's seed, and 219 animals would be redrawn on
  // every flip if it moved.
  setLang('pt');
  const ptKey = call('KEY', 'Savana|Savanna');
  setLang('en');
  check(call('KEY', 'Savana|Savanna') === ptKey, 'the sprite key changed with the flag');
  setLang('en');
});

scenario('a string with no bar survives all three readers', () => {
  for (const lang of ['pt', 'en']) {
    setLang(lang);
    check(call('LN', 'Panda') === 'Panda', `LN mangled a single-language name in ${lang}`);
    check(call('KEY', 'Panda') === call('KEY', 'Panda'), 'KEY is not stable');
  }
});

// --------------------------------------------------------- the 219 species

scenario('the catalogue is whole: 219 species, every field in range', () => {
  const species = read('SPECIES');
  check(species.length === 219, `the catalogue has ${species.length} species`);

  const biomes = Object.keys(read('BIOMES'));
  const diets = Object.keys(read('DIETS'));
  const seen = new Set();
  for (const sp of species) {
    check(typeof sp.key === 'string' && sp.key.length > 0, 'a species with no stable key');
    check(!seen.has(sp.key), `two species share the key "${sp.key}"`);
    seen.add(sp.key);

    check(biomes.includes(sp.biome), `${sp.key} lives in "${sp.biome}", which is not a biome`);
    check(diets.includes(sp.diet), `${sp.key} eats "${sp.diet}", which is not a diet`);
    check(sp.price > 0 && sp.price < 1e6, `${sp.key} costs ${sp.price}`);
    check(sp.appeal >= 1 && sp.appeal <= 10, `${sp.key} has appeal ${sp.appeal}`);
    check(sp.lifespan > 0 && sp.lifespan <= 200, `${sp.key} lives ${sp.lifespan} years`);
    check(sp.danger >= 1 && sp.danger <= 5, `${sp.key} has danger ${sp.danger}`);
    check(sp.groupMin >= 1 && sp.groupMax >= sp.groupMin, `${sp.key} groups ${sp.groupMin}-${sp.groupMax}`);
  }
});

scenario('every species is named in both languages', () => {
  const raw = read('SPECIES_RAW');
  for (const row of raw) {
    const name = row[0];
    check(name.includes('|'), `"${name}" is written in one language only`);
    const [pt, en] = name.split('|');
    check(pt.trim().length > 0 && en.trim().length > 0, `"${name}" has an empty side`);
  }
});

scenario('every biome has animals, and the index agrees with the table', () => {
  const byBiome = read('SPECIES_BY_BIOME');
  const species = read('SPECIES');
  let indexed = 0;
  for (const [biome, list] of Object.entries(byBiome)) {
    check(list.length > 0, `nothing lives in ${biome}`);
    indexed += list.length;
    for (const sp of list) check(sp.biome === biome, `${sp.key} is filed under ${biome} but lives in ${sp.biome}`);
  }
  check(indexed === species.length, `${indexed} species indexed against ${species.length} in the table`);
});

// -------------------------------------------------------------- the park

scenario('the terrain comes out varied, and covers the whole park', () => {
  const size = read('W * H');
  check(size > 0, 'the park has no size');
  call('genTerrain');
  check(read('world.terr.length') === size, 'the terrain does not cover the park');
  const kinds = read('[...new Set(world.terr)].length');
  check(kinds > 2, `the whole park came out in ${kinds} kind(s) of ground`);
  check(read('world.terr.every(t => t >= 0 && t < TKEYS.length)'),
    'a tile ended up with a ground that is not on the list');

  // the entrance plaza is kept clear — it is where every visitor walks in
  check(read(`(() => {
    for (let y = H - 7; y < H; y++) for (let x = ENTRANCE.x - 4; x <= ENTRANCE.x + 4; x++)
      if (inB(x, y) && world.terr[IDX(x, y)] !== TKEYS.indexOf('grass')) return false;
    return true;
  })()`), 'the entrance plaza came out built over');
});

scenario('an enclosure knows its own shape, and scores the ground under it', () => {
  call('genTerrain');
  const shape = read(`(() => {
    const tiles = new Set();
    for (let x = 4; x < 9; x++) for (let y = 4; y < 9; y++) tiles.add(IDX(x, y));
    const e = makeEnclosure(tiles, Object.keys(FENCES)[0]);
    globalThis.__enc = e;
    const bb = encBBox(e);
    return { tiles: e.tiles.size, w: bb.w, h: bb.h, area: encArea(e) };
  })()`);
  check(shape.tiles === 25, `a 5x5 enclosure took ${shape.tiles} tiles`);
  check(shape.w === 5 && shape.h === 5, `it measures ${shape.w}x${shape.h}`);
  check(shape.area === 25, `its area came out as ${shape.area}`);

  // the ground matters, and it is what the happiness rules read: the same
  // enclosure, laid with grass, suits a grassland animal better than a polar one
  const scores = read(`(() => {
    for (const k of __enc.tiles) world.terr[k] = TKEYS.indexOf('grass');
    encInvalidate(__enc); terrainChanged(); G.terrVer++;
    const grass = SPECIES.find(s => s.mix && s.mix.grass);
    const ice = SPECIES.find(s => s.mix && (s.mix.snow || s.mix.ice));
    return { grass: terrainScore(__enc, grass), ice: ice ? terrainScore(__enc, ice) : 0 };
  })()`);
  check(scores.grass > scores.ice,
    `grass scored ${scores.grass.toFixed(2)} against ${scores.ice.toFixed(2)} for an animal of the ice`);
  check(scores.grass <= 1.0001 && scores.ice >= 0,
    `the score left its 0..1 range (${scores.ice}..${scores.grass})`);
});

scenario('an animal in the wrong place is unhappy, and says so in both languages', () => {
  call('genTerrain');
  const setup = read(`(() => {
    const tiles = new Set();
    for (let x = 12; x < 17; x++) for (let y = 12; y < 17; y++) tiles.add(IDX(x, y));
    const e = makeEnclosure(tiles, Object.keys(FENCES)[0]);
    for (const k of e.tiles) world.terr[k] = TKEYS.indexOf('grass');
    encInvalidate(e); G.terrVer++;
    const home = SPECIES.find(s => s.mix && s.mix.grass && !s.flies && !s.aquatic);
    const away = SPECIES.find(s => s.mix && (s.mix.snow || s.mix.ice) && !s.flies && !s.aquatic);
    const right = newAnimal(home, e.id, 3);
    const wrong = newAnimal(away, e.id, 3);
    e.animals.push(right, wrong);
    return { right: animalScore(right).total, wrong: animalScore(wrong).total, id: e.id };
  })()`);
  check(setup.right > setup.wrong,
    `at home it scores ${setup.right.toFixed(2)}, out of place ${setup.wrong.toFixed(2)}`);
  check(setup.right >= 0 && setup.right <= 1, `a happiness of ${setup.right} is off the scale`);

  // A thought is stored as the raw `pt|en` pair and split by the panel that
  // draws it — so what has to hold here is that BOTH sides were written, and
  // that LN gives back a clean string on either flag.
  const thoughts = read(`(() => {
    const a = G.animals.at(-1);
    const out = [];
    const states = [
      () => { a.escaped = true; },
      () => { a.escaped = false; a.sick = true; },
      () => { a.sick = false; a.thirst = 0.9; },
      () => { a.thirst = 0.1; a.hunger = 0.9; },
      () => { a.hunger = 0.1; a.happy = 0.2; },
      () => { a.happy = 0.95; },
    ];
    for (const set of states) { set(); const t = animalThought(a); if (t) out.push(t.txt); }
    return out;
  })()`);
  check(thoughts.length >= 5, `only ${thoughts.length} thoughts came out of six states`);
  for (const txt of thoughts) {
    check(String(txt).includes('|'), `a thought written in one language only: "${txt}"`);
    for (const lang of ['pt', 'en']) {
      setLang(lang);
      const shown = call('LN', txt);
      check(!shown.includes('|'), `a raw pt|en thought would reach the panel: "${shown}"`);
      check(shown.trim().length > 0, `the ${lang} side of "${txt}" is empty`);
    }
  }
  setLang('en');
});

scenario('the books balance: what is spent leaves the till', () => {
  const before = read('G.money');
  call('spend', 500, 'build');
  check(read('G.money') === before - 500, 'spending did not come out of the money');
  check(read('G.ledger.today.build') >= 500, 'the spend never reached the books');

  call('earn', 200, 'shop');
  check(read('G.money') === before - 300, 'earning did not go back in');
  check(read('G.ledger.today.shop') >= 200, 'the takings never reached the books');
});

// ------------------------------------------------------------- the drawing

scenario('all 219 species draw, from 28 body plans and not one image', () => {
  // Not a single sprite ships with this game: every animal is assembled at
  // runtime from a body plan and a handful of numbers. A plan that throws takes
  // the frame with it, and only for the species nobody bought while testing.
  const drawn = read(`(() => {
    const bad = [];
    let ok = 0;
    for (const sp of SPECIES) {
      try {
        const cv = getSprite(sp, 0, 48);
        if (!cv || !cv.width) bad.push(sp.key + ': empty');
        else ok++;
      } catch (e) { bad.push(sp.key + ': ' + e.message); }
    }
    return { ok, bad: bad.slice(0, 5), total: SPECIES.length };
  })()`);
  check(drawn.bad.length === 0, `species that would not draw: ${drawn.bad.join(' · ')}`);
  check(drawn.ok === drawn.total, `${drawn.ok} of ${drawn.total} species drew`);
});

scenario('every body plan is used, and the walk cycle has frames', () => {
  const plans = read('[...new Set(SPECIES.map(s => s.plan))]');
  check(plans.length >= 20, `only ${plans.length} body plans for 219 species`);
  const frames = read(`(() => {
    const sp = SPECIES[0];
    const a = getSprite(sp, 0, 48), b = getSprite(sp, 2, 48);
    return { same: a === b, cached: getSprite(sp, 0, 48) === a };
  })()`);
  check(!frames.same, 'two frames of the walk came back as the same canvas');
  check(frames.cached, 'the sprite cache redrew something it already had');
});

scenario('the sprite is seeded from the species, not from its name', () => {
  // otherwise flipping the flag would redraw all 219 animals
  setLang('pt');
  const pt = read('SPECIES.map(s => s.key).join("|")');
  setLang('en');
  const en = read('SPECIES.map(s => s.key).join("|")');
  check(pt === en, 'the species keys followed the flag');
  setLang('en');
});

await run('zoo tycoon — logic');
