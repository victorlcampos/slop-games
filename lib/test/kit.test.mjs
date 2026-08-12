// slopkit's tests. The sums that matter — how many steps the loop takes, what
// width the viewport picks, what normalisation does to an old save — are pure
// functions on purpose, precisely so they fit in a test with no browser.

import { scenario, check, checkEqual, run } from '../testing.mjs';
import { measure, turnedPoint } from '../src/viewport.js';
import { stepsFor } from '../src/loop.js';
import { createI18n, pickLang, interpolate, missingKeys } from '../src/i18n.js';
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
