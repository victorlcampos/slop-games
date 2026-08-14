// slopkit's tests. The sums that matter — how many steps the loop takes, what
// width the viewport picks, what normalisation does to an old save — are pure
// functions on purpose, precisely so they fit in a test with no browser.

import { scenario, check, checkEqual, run } from '../testing.mjs';
import { measure, turnedPoint } from '../src/viewport.js';
import { stepsFor } from '../src/loop.js';
import { createI18n, pickLang, interpolate, missingKeys } from '../src/i18n.js';
import { createRecords, freshRecord, normalizeRecord, mergeRecord } from '../src/records.js';
import { KIT_PHRASES } from '../src/phrases.js';
import { LANGS } from '../src/langs.js';

// --------------------------------------------------------------- viewport

scenario('viewport: width follows the window aspect ratio', () => {
  checkEqual(measure(1920, 1080, 1, false).W, 1280, '16:9 should give 1280');
  check(measure(2560, 1080, 1, false).W > 1280, 'ultrawide should see more world');
  check(measure(1024, 768, 1, false).W < 1280, '4:3 should see less');
  checkEqual(measure(1920, 1080, 1, false).H, 720, 'the logical height is fixed');
});

scenario('viewport: width has a floor and a ceiling', () => {
  checkEqual(measure(4000, 800, 1, false).W, 1900, 'ultra-ultrawide has to stop growing');
  checkEqual(measure(600, 900, 1, false).W, 1040, 'a narrow screen needs a floor');
});

scenario('viewport: a landscape-only board is laid on its side upright', () => {
  // A phone held upright, on a game whose board only works lying down: the two
  // measurements are swapped and the game gets the landscape it needs. Asking
  // the player to unlock rotation was a wall in front of the game.
  const upright = measure(390, 844, 3, true, { landscape: true });
  check(upright.turned, 'the canvas was not turned on an upright phone');
  check(upright.W > 1280, `laid on its side it sees ${upright.W} of world`);
  checkEqual(upright.H, 720, 'the logical height moved');
  check(Math.abs(upright.scale - 390 / 720) < 1e-9, 'the scale followed the wrong side');

  // held the right way round, nothing is turned and nothing changes
  const landscape = measure(844, 390, 3, true, { landscape: true });
  check(!landscape.turned, 'a phone already lying down was turned again');
  checkEqual(landscape.W, upright.W, 'the same phone sees a different world in each hand');

  // and a game that never asked for it is left alone
  check(!measure(390, 844, 3, true).turned, 'a game that plays upright was turned anyway');
});

scenario('viewport: a finger on a turned canvas lands where it looks', () => {
  // 390x844 upright, laid on its side: scale = 390/720
  const scale = 390 / 720;
  const topLeft = turnedPoint(0, 0, 390, scale);      // top-left of the phone…
  check(Math.abs(topLeft.x) < 1e-9 && Math.abs(topLeft.y - 720) < 1e-6,
    `the top-left corner came out at (${topLeft.x.toFixed(1)}, ${topLeft.y.toFixed(1)})`);

  // …is the bottom-left of the game, and the phone's bottom-right is the top-right
  const bottomRight = turnedPoint(390, 844, 390, scale);
  check(Math.abs(bottomRight.y) < 1e-6, `the far corner came out at y ${bottomRight.y.toFixed(1)}`);
  check(bottomRight.x > 1500, `the far corner came out at x ${bottomRight.x.toFixed(0)}`);

  // the middle of the screen is the middle of the game, whichever way it is held
  const middle = turnedPoint(195, 422, 390, scale);
  check(Math.abs(middle.y - 360) < 1e-6, `the middle came out at y ${middle.y.toFixed(1)}`);
});

scenario('viewport: phone DPR is capped harder than desktop', () => {
  checkEqual(measure(844, 390, 3, true).dpr, 1.6, 'a small phone at DPR 3 should drop to 1.6');
  checkEqual(measure(1440, 900, 2, false).dpr, 2, 'a retina desktop stays at 2');
  checkEqual(measure(1180, 820, 3, true).dpr, 2, 'a big tablet is not a small phone');
  checkEqual(measure(1440, 900, 1, false).dpr, 1, 'no retina, no inventing');
});

scenario('viewport: scale turns screen into logical coordinates', () => {
  const m = measure(1920, 1080, 1, false);
  checkEqual(m.scale, 1.5, '1080 of height for 720 logical = 1.5');
});

// ------------------------------------------------------------------- loop

scenario('loop: a fixed step gives the right number of steps', () => {
  checkEqual(stepsFor(0, 1 / 60, 1 / 60).steps, 1, 'one 60Hz frame = one step');
  checkEqual(stepsFor(0, 1 / 30, 1 / 60).steps, 2, 'a slow frame = two steps');
  checkEqual(stepsFor(0, 1 / 144, 1 / 60).steps, 0, 'too fast a frame does not close a step yet');
});

scenario('loop: the remainder becomes a step next frame, losing no time', () => {
  const step = 1 / 60;
  let rest = 0;
  let total = 0;
  // twenty 144Hz frames should add up to the same simulated time as real time
  for (let i = 0; i < 20; i++) {
    const r = stepsFor(rest, 1 / 144, step);
    total += r.steps;
    rest = r.rest;
  }
  const simulated = total * step + rest;
  const real = 20 / 144;
  check(Math.abs(simulated - real) < 1e-9, `simulated time (${simulated}) should match real time (${real})`);
});

scenario('loop: the guard stops the spiral of death', () => {
  // the tab came back from the background 30 seconds late
  const r = stepsFor(0, 30, 1 / 60, 8);
  check(r.steps <= 8, 'never more than the step ceiling');
  checkEqual(r.rest, 0, 'the backlog is dropped, not turned into unpayable debt');
});

scenario('loop: a mad dt does not break the arithmetic', () => {
  checkEqual(stepsFor(0, -5, 1 / 60).steps, 0, 'a negative dt (clock went back) simulates nothing');
  check(stepsFor(0, Infinity, 1 / 60).steps <= 8, 'an infinite dt does not hang');
});

// ------------------------------------------------------------------- save

/** Reimplements the part of createSave that does not depend on localStorage. */
function sanitizeWith(normalize, initial, raw, version = 2) {
  const base = initial();
  const s = normalize(raw, base) || base;
  s.version = version;
  return s;
}

const sampleInitial = () => ({ version: 2, coins: 0, items: [], level: 1 });
const sampleNormalize = (raw, base) => {
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  s.coins = Number.isFinite(s.coins) ? Math.max(0, Math.floor(s.coins)) : 0;
  s.items = Array.isArray(s.items) ? s.items : [];
  s.level = Number.isFinite(s.level) ? Math.min(Math.max(1, s.level), 10) : 1;
  return s;
};

scenario('save: an old version gains the new fields instead of breaking', () => {
  const old = { coins: 50 }; // saved before items and level existed
  const s = sanitizeWith(sampleNormalize, sampleInitial, old);
  checkEqual(s.coins, 50, 'what existed is preserved');
  checkEqual(s.items, [], 'what was missing gets the default');
  checkEqual(s.level, 1, 'same');
  checkEqual(s.version, 2, "and the save is restamped with today's version");
});

scenario('save: garbage in the file does not become invalid state', () => {
  checkEqual(sanitizeWith(sampleNormalize, sampleInitial, null).coins, 0, 'null');
  checkEqual(sanitizeWith(sampleNormalize, sampleInitial, 'hi').coins, 0, 'string');
  checkEqual(sanitizeWith(sampleNormalize, sampleInitial, { coins: 'lots' }).coins, 0, 'wrong type');
  checkEqual(sanitizeWith(sampleNormalize, sampleInitial, { coins: -9 }).coins, 0, 'negative');
  checkEqual(sanitizeWith(sampleNormalize, sampleInitial, { level: 999 }).level, 10, 'out of range');
  checkEqual(sanitizeWith(sampleNormalize, sampleInitial, { items: 'not a list' }).items, [], 'fake list');
});

scenario('save: the exported snapshot is the autosave snapshot', () => {
  const state = sampleNormalize({ coins: 120, items: ['a'], level: 3 }, sampleInitial());
  const exported = JSON.parse(JSON.stringify({ ...state, game: 'sample', version: 2 }));
  const reimported = sanitizeWith(sampleNormalize, sampleInitial, exported);
  checkEqual(reimported.coins, state.coins, 'a round trip preserves coins');
  checkEqual(reimported.items, state.items, 'a round trip preserves items');
  checkEqual(reimported.level, state.level, 'a round trip preserves level');
});

// ---------------------------------------------------------------- records

const IRON = { game: 'iron', axes: { score: { round: true }, time: {} } };
const FORT = {
  game: 'fort',
  axes: { money: { round: true }, floor: {}, silent: { race: false } },
  extra: { intro: (v) => (v ? 1 : 0) },
};

scenario('records: each axis is kept on its own, and the runs are counted', () => {
  const first = mergeRecord(IRON, freshRecord(IRON), { score: 14814.4, time: 119.7 });
  checkEqual(first.best, { score: 14814, time: 119.7, runs: 1 }, 'the first run was not filed whole');
  check(first.record, 'the first run over zero was not a record');

  // a bigger score does not erase a longer life: two axes, two records
  const second = mergeRecord(IRON, first.best, { score: 20000, time: 40 });
  checkEqual(second.best.score, 20000, `the bigger score was lost (${second.best.score})`);
  checkEqual(second.best.time, 119.7, `the longer run was erased (${second.best.time})`);
  checkEqual(second.beaten, ['score'], `beaten said ${JSON.stringify(second.beaten)}`);

  const third = mergeRecord(IRON, second.best, { score: 10, time: 10 });
  check(!third.record, 'a run beaten on both axes was announced as a record');
  checkEqual(third.best.runs, 3, `${third.best.runs} runs counted after three`);
  checkEqual(third.previous.score, 20000, 'the card cannot show what the record was before');
});

scenario('records: a kept number is not always a raced one', () => {
  const quiet = mergeRecord(FORT, freshRecord(FORT), { money: 4000, floor: 0, silent: 1 });
  checkEqual(quiet.best.silent, 1, 'the silent floor was not kept');
  checkEqual(quiet.beaten, ['money'], `a non-racing axis announced a record (${quiet.beaten})`);
  // and what a run does not decide survives the run
  const seen = normalizeRecord(FORT, { ...quiet.best, intro: 1 });
  checkEqual(mergeRecord(FORT, seen, { money: 10 }).best.intro, 1, 'the cutscene has to be watched again');
});

scenario('records: nothing off a broken save reaches the card as NaN', () => {
  // `true` is exactly what `best = vault.save(...)` used to leave behind
  for (const junk of [true, null, undefined, 'best', 42, { score: NaN, time: -3 }, { score: '9' }]) {
    const merged = mergeRecord(IRON, junk, { score: 500, time: 12 });
    check(Number.isFinite(merged.best.score) && Number.isFinite(merged.best.time),
      `${JSON.stringify(junk) ?? 'undefined'} produced ${merged.best.score} · ${merged.best.time}`);
    checkEqual(merged.best.runs, 1, 'a broken save lost the run count too');
  }
  // a run that reports nothing does not take the record down with it
  const kept = mergeRecord(IRON, { score: 800, time: 30, runs: 4 }, {});
  checkEqual(kept.best.score, 800, `an empty result rewrote the record as ${kept.best.score}`);
  check(!kept.record, 'an empty result was announced as a record');
  checkEqual(kept.best.runs, 5, `${kept.best.runs} runs after filing an empty one`);
});

scenario('records: an open record races fields the game never declared', () => {
  // SkiFree keeps one score per mode, and the modes are not known here
  const spec = { game: 'ski', open: true, runs: false };
  const a = mergeRecord(spec, null, { classic: 3000 });
  checkEqual(a.best, { classic: 3000 }, 'the mode was not opened');
  check(a.record && a.beaten[0] === 'classic', 'the first score in a mode was not a record');
  const b = mergeRecord(spec, a.best, { slalom: 1200 });
  checkEqual(b.best, { classic: 3000, slalom: 1200 }, 'a second mode dropped the first');
  const c = mergeRecord(spec, b.best, { classic: 10 });
  check(!c.record, 'a worse run in a known mode was called a record');
  checkEqual(c.previous.classic, 3000, 'the card cannot say what the mode record was');
  // and a mode this build has never heard of survives a load
  checkEqual(normalizeRecord(spec, { retired: 90 }).retired, 90, 'an unknown mode was thrown away');
  checkEqual(normalizeRecord(spec, { classic: 'lots' }).classic, undefined, 'a non-number became a record');
});

scenario('records: file() hands back the record, never a boolean', () => {
  // the whole reason this module exists: `vault.save()` answers whether it
  // wrote, and two games read that answer as their record
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    const records = createRecords(IRON);
    const filed = records.file({ score: 1200.6, time: 61 });
    checkEqual(typeof filed.best, 'object', `file() handed back a ${typeof filed.best}`);
    checkEqual(records.best.score, 1201, `the record in hand is ${records.best.score}`);
    check(store.has('iron.best.v1'), 'nothing reached the disk');
    check(!('updatedAt' in records.best), 'the vault stamped the object the HUD draws');

    // a second game reads what the first one wrote — this is the run after a reload
    const reloaded = createRecords(IRON);
    checkEqual(reloaded.best.score, 1201, `the record came back as ${reloaded.best.score}`);
    checkEqual(Object.keys(reloaded.best).sort(), ['runs', 'score', 'time'],
      `the record came back carrying ${Object.keys(reloaded.best).join(', ')}`);
    checkEqual(reloaded.best.runs, 1, `${reloaded.best.runs} runs came back`);
    checkEqual(reloaded.file({ score: 1, time: 1 }).best.score, 1201, 'a bad run reset the record');
    checkEqual(reloaded.set({ score: 5 }).score, 1201, 'set() let a field go backwards');
    checkEqual(reloaded.clear().score, 0, 'clear() left the record behind');
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

// ------------------------------------------------------------------- i18n

scenario('i18n: the language is the choice, then the browser, then the fallback', () => {
  checkEqual(pickLang('en', ['pt-BR'], 'pt'), 'en', 'a stored choice beats the browser');
  checkEqual(pickLang(null, ['en-US', 'pt-BR'], 'pt'), 'en', 'no choice yet: ask the browser');
  checkEqual(pickLang(null, ['fr-FR', 'de'], 'en'), 'en', 'a language we do not ship falls back');
  checkEqual(pickLang('klingon', [], 'en'), 'en', 'a stored value we do not ship is ignored');
  checkEqual(pickLang(null, [], 'en'), 'en', 'no signal at all: fallback');
});

scenario('i18n: region tags still find the language', () => {
  checkEqual(pickLang(null, ['pt-PT'], 'en'), 'pt', 'Portugal is still Portuguese');
  checkEqual(pickLang(null, ['EN-gb'], 'pt'), 'en', 'case does not matter');
});

scenario('i18n: placeholders get filled, unknown ones stay visible', () => {
  checkEqual(interpolate('Score: {n}', { n: 7 }), 'Score: 7', 'the value goes in');
  checkEqual(interpolate('{a} and {b}', { a: 1, b: 2 }), '1 and 2', 'more than one');
  checkEqual(interpolate('Score: {n}', {}), 'Score: {n}', 'a hole stays visible, never "undefined"');
  checkEqual(interpolate('nothing here', { n: 1 }), 'nothing here', 'nothing to fill');
});

scenario('i18n: translates, and says which key is missing instead of "undefined"', () => {
  const i18n = createI18n({
    preferred: ['pt-BR'],
    dict: {
      play: { pt: 'Jogar', en: 'Play' },
      score: { pt: 'Pontos: {n}', en: 'Score: {n}' },
    },
  });
  checkEqual(i18n.lang, 'pt', 'a pt-BR browser starts in Portuguese');
  checkEqual(i18n.t('play'), 'Jogar', 'translates');
  checkEqual(i18n.t('score', { n: 3 }), 'Pontos: 3', 'translates and interpolates');
  i18n.set('en');
  checkEqual(i18n.t('play'), 'Play', 'switching language switches the text');
  checkEqual(i18n.t('nope'), 'nope', 'a missing key shows itself, not "undefined"');
});

scenario('i18n: plural forms follow n', () => {
  const i18n = createI18n({
    preferred: ['en'],
    dict: { lives: { pt: ['1 vida', '{n} vidas'], en: ['1 life', '{n} lives'] } },
  });
  checkEqual(i18n.t('lives', { n: 1 }), '1 life', 'singular');
  checkEqual(i18n.t('lives', { n: 4 }), '4 lives', 'plural');
  i18n.set('pt');
  checkEqual(i18n.t('lives', { n: 1 }), '1 vida', 'singular in Portuguese');
  checkEqual(i18n.t('lives', { n: 4 }), '4 vidas', 'plural in Portuguese');
});

scenario('i18n: toggle flips between the two flags and notifies', () => {
  const i18n = createI18n({ preferred: ['pt'], dict: {} });
  const seen = [];
  const off = i18n.onChange((l) => seen.push(l));
  i18n.toggle();
  i18n.toggle();
  checkEqual(seen, ['en', 'pt'], 'every change is announced once');
  off();
  i18n.toggle();
  checkEqual(seen.length, 2, 'unsubscribing really unsubscribes');
});

scenario('i18n: setting the same language twice is not a change', () => {
  const i18n = createI18n({ preferred: ['pt'], dict: {} });
  let n = 0;
  i18n.onChange(() => n++);
  i18n.set('pt');
  checkEqual(n, 0, 'no event for staying put');
  i18n.set('martian');
  checkEqual(n, 0, 'no event for a language we do not ship');
  checkEqual(i18n.lang, 'pt', 'and the language did not move');
});

scenario('i18n: a half-translated dictionary is caught, not shipped', () => {
  const holes = missingKeys({
    ok: { pt: 'Certo', en: 'Right' },
    half: { pt: 'Só em português' },
  });
  checkEqual(holes, ['half.en'], 'the missing side is named');
});

scenario("i18n: the kit's own phrases exist in both languages", () => {
  checkEqual(missingKeys(KIT_PHRASES), [], 'no kit phrase may ship in one language only');
  const i18n = createI18n({ preferred: ['en'], dict: {} });
  checkEqual(i18n.t('slop.backToCatalog'), '🕹️ all games', 'games get the exit phrase for free');
  i18n.set('pt');
  checkEqual(i18n.t('slop.backToCatalog'), '🕹️ todos os jogos', 'in both languages');
});

scenario('i18n: a game can override a kit phrase', () => {
  const i18n = createI18n({
    preferred: ['pt'],
    dict: { 'slop.backToCatalog': { pt: '← voltar', en: '← back' } },
  });
  checkEqual(i18n.t('slop.backToCatalog'), '← voltar', "the game's wording wins");
});

scenario('i18n: English is the default, and both languages have a flag', () => {
  checkEqual(LANGS, ['en', 'pt'], 'two languages, two flags — English first');
  checkEqual(pickLang(null, [], undefined), 'en', 'no signal at all lands on English');
  checkEqual(pickLang(null, ['pt-BR'], undefined), 'pt', 'but a Portuguese browser still gets Portuguese');
});

await run('slopkit');
