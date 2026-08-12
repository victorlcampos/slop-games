// World Drive's own test, written on slopkit/testing.
//
// The smoke test beside this one drives a real city off the real Overpass API.
// It is a good test and a terrible gate — a third-party server that queues and
// rate-limits cannot be allowed to hold the catalog hostage, so CI runs it with
// continue-on-error.
//
// This one is the opposite: the network is cut on purpose. What it proves is
// that the loading path FAILS GRACEFULLY — an error card, a retry button, no
// uncaught exception. That distinction matters: a dropped line once made
// setProgress throw on the first byte back, the retry loop swallowed it as
// "the servers are busy", and the game simply never finished loading. The
// catalog floor passed, because the floor never starts a load.
//
// What is NOT here is the drive itself. A scenario that loaded a canned world
// and held the throttle went red on CI reading "the car reached 9 km/h" — with
// software WebGL a frame costs a large fraction of a second, so a few seconds
// of holding W buy about a metre of road. Driving is checked by hand before a
// deploy, and by `test:network` when the real Overpass answers.

import { launchBrowser, open, scenario, check, run } from 'slopkit/testing';
import path from 'node:path';

const GAME = path.resolve(import.meta.dirname, '../dist/index.html');
const browser = await launchBrowser();

/** Opens the game with every outbound request refused. */
async function openOffline() {
  const g = await open(browser, GAME, undefined, { bootWait: 2200 });
  await g.page.setRequestInterception(true);
  g.page.on('request', (r) => (r.url().startsWith('http') ? r.abort() : r.continue()));
  return g;
}

/* Cutting the network makes Chrome log a failed request per attempt. Those are
   the point of the test, not a fault — what must stay empty is everything else,
   and above all any uncaught exception. */
const NETWORK_NOISE = /net::ERR_|Failed to load resource|Access to fetch|CORS policy/;
function expectOnlyNetworkErrors(g, label) {
  const real = g.errors.filter((e) => !NETWORK_NOISE.test(e));
  if (real.length) throw new Error(`${label} threw ${real.length} non-network error(s):\n  ${real.slice(0, 6).join('\n  ')}`);
}

scenario('starting a load with no network fails gracefully, not by throwing', async () => {
  const g = await openOffline();
  await g.page.waitForSelector('#menu:not(.hide)', { timeout: 15000 });

  await g.exec(() => document.querySelector('[data-preset="0"]').click());
  await g.waitUntil(
    () => !document.getElementById('load-err').classList.contains('hide'),
    { timeout: 60000, what: 'the load to give up and show its error card' }
  );

  const card = await g.exec(() => ({
    message: document.getElementById('load-err-msg').textContent,
    retry: !!document.getElementById('btn-retry'),
    state: window.WD && window.WD.state,
  }));
  check(card.message.length > 20, `the error card says "${card.message}"`);
  check(!card.message.includes('undefined') && !card.message.includes('NaN'),
    `the error card leaked an internal value: "${card.message}"`);
  check(card.retry, 'the error card offers no way to try again');

  // this is the check that would have caught the broken load: the failure has
  // to come from the network, not from the game falling over on the way there
  expectOnlyNetworkErrors(g, 'offline load');
  await g.close();
});

scenario('the error card speaks the language of the moment', async () => {
  const g = await openOffline();
  await g.page.waitForSelector('#menu:not(.hide)', { timeout: 15000 });
  await g.exec(() => document.querySelector('[data-preset="0"]').click());
  await g.waitUntil(
    () => !document.getElementById('load-err').classList.contains('hide'),
    { timeout: 60000, what: 'the error card' }
  );

  const seen = {};
  for (const lang of ['en', 'pt']) {
    await g.setLang(lang);
    await g.waitFrames(2);
    seen[lang] = await g.exec(() => document.getElementById('load-err-msg').textContent);
  }
  check(seen.en !== seen.pt, 'the error card did not follow the flag');
  check(!seen.en.includes('|') && !seen.pt.includes('|'), 'a raw pt|en string reached the card');
  // the card stays on screen until the player acts, so it is not a place where
  // "it will be right next time" is good enough
  check(/servers|Overpass/i.test(seen.en), `the English card reads "${seen.en}"`);
  check(/servidores|Overpass/i.test(seen.pt), `the Portuguese card reads "${seen.pt}"`);

  expectOnlyNetworkErrors(g, 'error card language');
  await g.close();
});

scenario('the menu works offline: presets, search and the language picker', async () => {
  const g = await openOffline();
  await g.page.waitForSelector('#menu:not(.hide)', { timeout: 15000 });

  const menu = await g.exec(() => ({
    presets: document.querySelectorAll('#presets .chip').length,
    flags: document.querySelectorAll('[data-lang-picker] button').length,
    exit: !!document.querySelector('[data-back-to-catalog]'),
  }));
  check(menu.presets >= 4, `${menu.presets} preset chips`);
  check(menu.flags === 2, `${menu.flags} flags instead of 2`);

  // a search with the geocoders refused must say so, not hang or throw
  await g.exec(() => {
    const input = document.getElementById('search');
    input.value = 'nowhere at all';
    input.dispatchEvent(new Event('input'));
  });
  await g.waitUntil(
    () => /\S/.test(document.getElementById('results').textContent),
    { timeout: 30000, what: 'the search to answer' }
  );
  const results = await g.exec(() => document.getElementById('results').textContent);
  check(!results.includes('undefined'), `the search panel reads "${results}"`);

  expectOnlyNetworkErrors(g, 'offline menu');
  await g.close();
});

await run('world drive');
await browser.close();
