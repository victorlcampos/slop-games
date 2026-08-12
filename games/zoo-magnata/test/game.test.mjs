// The Zoo's test, written on slopkit/testing.
//
// It drives a real park instead of poking at functions: lay paths, fence an
// enclosure, buy animals, hire staff, let visitors come in and let the day
// close. Everything below broke at some point during the translation to
// English and was only visible from here — a ledger key that stopped matching
// its call site turned the daily balance into NaN, a voice table keyed on the
// wrong side of `pt|en` silenced every per-species exception, and LN() handed
// each player the language they had just turned off.

import { launchBrowser, open, scenario, check, run } from 'slopkit/testing';
import path from 'node:path';

const GAME = path.resolve(import.meta.dirname, '../dist/index.html');
const browser = await launchBrowser();

/** A park that actually works: a route from the gate, an enclosure people can
 *  see into, food, water, staff and a shop. Anything missing here and nobody
 *  comes through the gate — which is correct behaviour, and a useless test. */
const buildPark = (game) => {
  for (let y = 49; y <= 55; y++) addPath(27, y);
  for (let x = 19; x <= 27; x++) addPath(x, 50);
  // right up against the enclosure's south edge: visitors only see an animal
  // from the path, and an enclosure nobody can see attracts nobody
  for (let x = 19; x <= 25; x++) addPath(x, 49);

  const tiles = [];
  for (let y = 44; y < 49; y++) for (let x = 20; x < 25; x++) tiles.push(IDX(x, y));
  const e = makeEnclosure(tiles, 'wood');

  // buyFor, not newAnimal: it is what registers the animal in the enclosure
  G.money = 5e6;
  buyFor(SPECIES[0], e); buyFor(SPECIES[0], e);
  placeObject('feeder', 'encobj', 21, 45);
  placeObject('trough', 'encobj', 22, 45);
  hire('keeper'); hire('vet'); hire('cleaner'); hire('security');
  placeObject('snackbar', 'build', 22, 51);
  placeObject('bin', 'build', 25, 51);
  setSpeed(4);
};

scenario('a day in the park: visitors come in, the books add up, every panel opens', async () => {
  const g = await open(browser, GAME);
  await g.waitFrames(3);
  await g.exec(() => { document.querySelector('#splash .btn')?.click(); });
  await g.waitFrames(3);

  const started = await g.exec(() => ({ species: SPECIES.length, day: G.day }));
  check(started.species === 219, `219 species, got ${started.species}`);

  await g.exec(buildPark);
  await g.waitUntil(() => G.hour > 11, { timeout: 60000, what: 'the park to reach 11:00' });

  // the day's books have to be read BEFORE it closes — closeDay zeroes `today`
  const open11 = await g.exec(() => ({
    ticket: G.ledger.today.ticket,
    finite: Object.values(G.ledger.today).every(Number.isFinite),
    visitors: G.visitors.length,
  }));
  check(open11.visitors > 0, 'no visitor came through the gate');
  check(open11.ticket > 0, `ticket revenue never reached the ledger (${open11.ticket})`);
  check(open11.finite, 'a ledger entry came out NaN');

  // skip to the edge of midnight so the day really closes
  await g.exec(() => { window.__t0 = G.day; G.hour = 23.4; });
  await g.waitUntil(() => G.day >= window.__t0 + 1, { timeout: 30000, what: 'the day to close' });
  await g.waitFrames(4);

  const closed = await g.exec(() => ({
    day: G.day,
    hist: G.ledger.hist.length,
    finiteHist: G.ledger.hist.filter((h) => Number.isFinite(h.balance)).length,
    states: [...new Set(G.animals.map((a) => a.state))],
  }));
  check(closed.day > started.day, 'the day never turned');
  check(closed.hist > 0 && closed.hist === closed.finiteHist,
    `${closed.hist - closed.finiteHist} of ${closed.hist} history rows are NaN`);
  check(closed.states.every((s) => ['idle', 'walking', 'eating', 'playing'].includes(s)),
    `unknown animal state: ${closed.states}`);

  g.expectNoErrors();
  await g.close();
});

/* The little words only one of the two languages uses. Content words are no
   good — "zoo", "safari" and every species name drag either way — but articles
   and prepositions track the language reliably over a panel's worth of text. */
const PT_MARKERS = /\b(de|da|do|dos|das|que|para|com|não|uma|você|seu|sua|mais|pelo|ao|na|no|os|as|é|em)\b/gi;
const EN_MARKERS = /\b(the|and|with|your|you|for|from|into|are|its|has|this|that|of|to|on|at|is|a|it)\b/gi;
const langOf = (text) => {
  const pt = (text.match(PT_MARKERS) || []).length;
  const en = (text.match(EN_MARKERS) || []).length;
  return { pt, en, guess: pt === en ? null : pt > en ? 'pt' : 'en' };
};

scenario('every panel says something, in both languages', async () => {
  const g = await open(browser, GAME);
  await g.waitFrames(3);
  await g.exec(() => { document.querySelector('#splash .btn')?.click(); });
  await g.waitFrames(3);
  await g.exec(buildPark);
  await g.waitFrames(6);

  const PANELS = ['openFinance', 'openStaff', 'openSatisfaction', 'openReputation', 'openHelp'];
  for (const lang of ['en', 'pt']) {
    await g.setLang(lang);
    for (const name of PANELS) {
      const got = await g.exec((game, fn) => {
        if (typeof window[fn] !== 'function') return 'missing';
        window[fn]();
        const body = document.querySelector('#modalBody');
        const text = body ? body.textContent.trim() : '';
        closeModal();
        // a panel that still shows the bar has an untranslated `pt|en` in it
        if (text.includes('|')) return 'raw pipe: ' + text.slice(text.indexOf('|') - 40, text.indexOf('|') + 20);
        return text.length > 40 ? text : 'empty (' + text.length + ')';
      }, name);
      check(!got.startsWith('missing') && !got.startsWith('empty') && !got.startsWith('raw pipe'),
        `${lang} ${name} -> ${got.slice(0, 90)}`);

      // The panels are where LN() lives, so this is where an inverted LN shows
      // up: the language tag says "en" and the text comes out Portuguese.
      const seen = langOf(got);
      check(seen.guess === lang,
        `${lang} ${name}: the text reads as ${seen.guess || 'neither'} (pt=${seen.pt} en=${seen.en})`);
    }

    const insp = await g.exec(() => {
      select('animal', G.animals[0]);
      const t = document.querySelector('#inspector').textContent;
      return { len: t.length, pipe: t.includes('|') };
    });
    check(insp.len > 30, `${lang}: the inspector came out empty`);
    check(!insp.pipe, `${lang}: the inspector is showing a raw pt|en string`);

    const report = await g.exec(() => reportText());
    check(report.length > 400, `${lang}: the status report came out short (${report.length})`);
    check(!report.includes('|'), `${lang}: the status report has a raw pt|en string`);
  }

  g.expectNoErrors();
  await g.close();
});

scenario('every species resolves to a voice that exists', async () => {
  const g = await open(browser, GAME);
  await g.waitFrames(2);
  const voices = await g.exec(() => ({
    missing: SPECIES.filter((sp) => typeof SFX['_g_' + gestureOf(sp)] !== 'function')
      .map((sp) => sp.key).slice(0, 6),
    // an exception keyed on a name no species carries never fires
    dead: Object.keys(GESTURE_SPECIES).filter((k) => !SPECIES.some((s) => s.key === k)),
    zebra: gestureOf(SPECIES.find((s) => s.key === 'Plains zebra')),
    fox: gestureOf(SPECIES.find((s) => s.key === 'Red fox')),
  }));
  check(!voices.missing.length, `species with no voice: ${voices.missing}`);
  check(!voices.dead.length, `voice exceptions that match no species: ${voices.dead}`);
  check(voices.zebra === 'bray', `the zebra should bray, it does ${voices.zebra}`);
  check(voices.fox === 'bark', `the fox should bark, it does ${voices.fox}`);
  g.expectNoErrors();
  await g.close();
});

scenario('the sprite of a species does not change with the flag', async () => {
  const g = await open(browser, GAME);
  await g.waitFrames(2);
  const keysEn = await g.exec(async (game) => {
    game.i18n.set('en');
    return SPECIES.slice(0, 40).map((s) => s.key);
  });
  const keysPt = await g.exec(async (game) => {
    game.i18n.set('pt');
    return SPECIES.slice(0, 40).map((s) => s.key);
  });
  check(JSON.stringify(keysEn) === JSON.stringify(keysPt),
    'sp.key moved with the language — every sprite seed would change on a flag switch');
  g.expectNoErrors();
  await g.close();
});

/* A save in the shape the game wrote BEFORE the translation to English: both
   the catalogue keys (madeira, lanchonete, trat) and the field names (idade,
   fome, saude) are Portuguese. It used to load looking fine and then fall
   apart — clamp passes NaN through, so within days every animal was NaN,
   reputation was NaN and nobody came through the gate again. */
const LEGACY_SAVE = (world) => ({
  v: 1, money: 150000, ticket: 12, day: 4, hour: 10, rep: 3.1, repLog: [],
  lastBill: 1, loan: 0, marketing: 0,
  stats: { visHoje: 3, visitanteTotal: 40, felicidade: .6, entrHoje: 30 },
  ledger: { hoje: { ingresso: 30 }, semana: { ingresso: 90 }, hist: [] },
  cam: { x: 0, y: 0, z: 1 },
  terr: world.terr, path: world.path,
  objs: [
    { id: 900, kind: 'lanchonete', cat: 'predio', x: 22, y: 51, mult: 1, revenue: 0, sales: 0 },
    { id: 901, kind: 'comedouro', cat: 'encobj', x: 21, y: 45, encId: 800 },
  ],
  encs: [{ id: 800, fence: 'madeira', nome: 'Recinto 800', tiles: world.tiles,
           limpeza: .8, comida: .9, agua: .7, integridade: 1 }],
  animals: [{ id: 810, sp: 0, enc: 800, nome: 'Simba', sexo: 'F', idade: 6,
              fome: .2, sede: .1, saude: 1, feliz: .8, doente: false,
              gravida: 0, fugiu: false, x: 22, y: 46 }],
  staff: [{ tipo: 'trat', x: 27, y: 55, feitos: 5 }],
  uid: 950,
});

scenario('a save written before the rename still opens, and stays a number', async () => {
  const g = await open(browser, GAME);
  await g.waitFrames(3);
  await g.exec(() => { document.querySelector('#splash .btn')?.click(); });
  await g.waitFrames(3);

  const loaded = await g.exec((game, save) => {
    const tiles = [];
    for (let y = 44; y < 49; y++) for (let x = 20; x < 25; x++) tiles.push(IDX(x, y));
    save.terr = Array.from(world.terr);
    save.path = Array.from(world.path);
    save.encs[0].tiles = tiles;
    if (!applySnapshot(save, 'legacy')) return { ok: false };
    const a = G.animals[0], e = [...enclosures.values()][0];
    return {
      ok: true,
      fence: e.fence,
      kinds: [...objects.values()].map((o) => o.kind + '/' + o.cat).sort(),
      staffKind: G.staff[0] && G.staff[0].kind,
      finite: [a.age, a.hunger, a.thirst, a.health, a.happy].every(Number.isFinite),
      sex: a.sex,
    };
  }, LEGACY_SAVE({ terr: [], path: [], tiles: [] }));

  check(loaded.ok, 'the legacy save was rejected outright');
  check(loaded.fence === 'wood', `fence "madeira" became "${loaded.fence}"`);
  check(JSON.stringify(loaded.kinds) === '["feeder/encobj","snackbar/build"]',
    `object kinds came out as ${JSON.stringify(loaded.kinds)}`);
  check(loaded.staffKind === 'keeper', `staff "trat" became "${loaded.staffKind}"`);
  check(loaded.finite && loaded.sex === 'F',
    'the animal lost its Portuguese-named fields — every number would go NaN');

  // the NaN only showed once the simulation touched those fields
  await g.exec(() => { setSpeed(4); window.__d = G.day; });
  await g.waitUntil(() => G.day >= window.__d + 1, { timeout: 60000, what: 'a day to pass' });
  const after = await g.exec(() => ({
    animals: G.animals.every((a) => [a.age, a.hunger, a.health, a.happy].every(Number.isFinite)),
    rep: Number.isFinite(G.rep),
    quality: Number.isFinite(parkQuality()),
    report: !reportText().includes('NaN'),
  }));
  check(after.animals, 'an animal went NaN after a day');
  check(after.rep && after.quality, 'reputation or park quality went NaN');
  check(after.report, 'the status report is printing NaN');

  g.expectNoErrors();
  await g.close();
});

await run('zoo tycoon');
await browser.close();
