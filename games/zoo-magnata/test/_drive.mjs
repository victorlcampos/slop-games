/* Drives the Zoo for real: builds, runs the sim fast, opens every panel in both
   languages, and fails on any console error. */
import { launchBrowser, open, scenario, check, run } from 'slopkit/testing';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve('/Users/victorcampos/Workspace/slop-games/games/zoo-magnata/dist/index.html');
const browser = await launchBrowser();

scenario('the zoo runs, simulates and opens every panel in both languages', async () => {
  const g = await open(browser, FILE);
  await g.waitFrames(3);

  // leaves the splash and lets the clock run
  await g.exec(() => { document.querySelector('#splash .btn')?.click(); setSpeed(1); });
  await g.waitFrames(3);

  const started = await g.exec(() => ({ species: SPECIES.length, day: G.day, money: G.money }));
  check(started.species === 219, `219 species, got ${started.species}`);

  // a working park: paths, an enclosure, an animal, staff, a shop
  await g.exec(() => {
    for (let y = 50; y <= 55; y++) addPath(27, y);
    for (let x = 20; x <= 27; x++) addPath(x, 50);
    const tiles = [];
    for (let y = 44; y < 49; y++) for (let x = 20; x < 25; x++) tiles.push(IDX(x, y));
    const e = makeEnclosure(tiles, 'madeira');
    newAnimal(SPECIES[0], e.id, 4);
    newAnimal(SPECIES[0], e.id, 5);
    placeObject('comedouro', 'encobj', 21, 45);
    placeObject('bebedouro', 'encobj', 22, 45);
    hire('trat'); hire('vet'); hire('fax'); hire('seg');
    placeObject('lanchonete', 'build', 22, 51);
    placeObject('lixeira', 'build', 25, 51);
    setSpeed(4);
  });

  // one full in-game day at 4x (~28 s of wall clock)
  await g.exec(() => { window.__t0 = G.day; });
  await g.waitUntil(() => G.day >= window.__t0 + 1, 90000);
  await g.waitFrames(10);

  const after = await g.exec(() => ({
    day: G.day,
    visitors: G.visitors.length,
    balanceIsNumber: Number.isFinite(balance(G.ledger.today)),
    ticket: G.ledger.today.ticket,
    hist: G.ledger.hist.map(h => h.balance).filter(Number.isFinite).length,
    histAll: G.ledger.hist.length,
    thoughts: G.visitors.filter(v => v.thought).length,
    states: [...new Set(G.animals.map(a => a.state))],
  }));
  check(after.day > started.day, 'the day did not turn');
  check(after.balanceIsNumber, 'the daily balance is not a number');
  check(after.ticket > 0, `ticket revenue never reached the ledger (${after.ticket})`);
  check(after.hist === after.histAll, `${after.histAll - after.hist} history rows are NaN`);
  check(after.visitors > 0, 'no visitors came in');
  check(after.states.every(s => ['idle', 'walking', 'eating', 'playing'].includes(s)),
    `unknown animal state: ${after.states}`);

  // every panel, in both languages
  const panels = ['openFinance', 'openStaff', 'openSatisfaction', 'openReputation', 'openHelp'];
  for (const lang of ['en', 'pt']) {
    await g.exec((l) => window.__game.i18n.set(l), lang);
    await g.waitFrames(2);
    for (const p of panels) {
      const ok = await g.exec((name) => {
        if (typeof window[name] !== 'function') return 'missing:' + name;
        window[name]();
        const m = document.querySelector('#modalBody');
        const text = m ? m.textContent.trim() : '';
        closeModal && closeModal();
        return text.length > 40 ? 'ok' : 'empty:' + name + ':' + text.length;
      }, p);
      check(ok === 'ok', `${lang} ${p} -> ${ok}`);
    }
    // the inspector of an animal and of an enclosure
    const insp = await g.exec(() => {
      const e = [...enclosures.values()][0];
      select('enc', e);
      const a = G.animals[0];
      select('animal', a);
      return document.querySelector('#inspector, #insp')?.textContent.length || 0;
    });
    check(insp > 30, `${lang}: the inspector came out empty (${insp})`);
  }

  // the text report the game exports
  const report = await g.exec(() => (typeof reportText === 'function' ? reportText().length : -1));
  check(report === -1 || report > 200, `the report came out short (${report})`);

  g.expectNoErrors();
  await g.close();
});

await run('zoo drive');
