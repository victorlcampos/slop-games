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

import { launchBrowser, open, scenario, check, run } from 'slopkit/testing';
import path from 'node:path';

const GAME = path.resolve(import.meta.dirname, '../dist/index.html');
const browser = await launchBrowser();

/* A flat 256x256 terrarium tile, generated once and inlined — rule nº 5 says
   assets are made by code, and a test has no business downloading one. */
const FLAT_TILE = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAB+UlEQVR42u3TMQ0AAAzDsEIv9N7DMBtCpKTwWCTAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAbAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGgGs8MBaBo6VkSAAAAABJRU5ErkJggg==';

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

scenario('a world loads and the car drives — with the streets served locally', async () => {
  const g = await open(browser, GAME, undefined, { bootWait: 2200 });
  await g.page.setRequestInterception(true);

  // The success path is what the gate could not reach: both offline scenarios
  // drive the FAILURE path, and the smoke test that drives the real one is
  // outside `npm test` because it depends on a public API. So Overpass is
  // answered here from a canned grid — a real response shape, no network — and
  // the elevation and satellite tiles are simply refused, which the loader is
  // expected to survive.
  const OSM = (() => {
    const lat = -22.96888, lon = -43.18647;
    const d = 0.0009;
    const ways = [];
    let id = 1;
    // a plain grid of named streets: enough for a road index and a spawn
    for (let i = -3; i <= 3; i++) {
      ways.push({
        type: 'way', id: id++, tags: { highway: 'residential', name: `Rua ${i + 4}` },
        geometry: [
          { lat: lat + i * d, lon: lon - 4 * d },
          { lat: lat + i * d, lon: lon + 4 * d },
        ],
      });
      ways.push({
        type: 'way', id: id++, tags: { highway: 'residential', name: `Avenida ${i + 4}` },
        geometry: [
          { lat: lat - 4 * d, lon: lon + i * d },
          { lat: lat + 4 * d, lon: lon + i * d },
        ],
      });
    }
    return JSON.stringify({ version: 0.6, elements: ways });
  })();

  g.page.on('request', (r) => {
    const url = r.url();
    if (url.includes('overpass')) {
      // the page origin is `null` over file://, so the canned answer needs the
      // same CORS header the real server sends
      return r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: OSM });
    }
    // a flat 256x256 tile stands in for the elevation and satellite imagery:
    // the loader treats missing elevation as fatal, and this test is about the
    // road network and the drive, not about the terrain being interesting
    if (url.endsWith('.png') || url.endsWith('.jpg')) {
      return r.respond({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: Buffer.from(FLAT_TILE, 'base64') });
    }
    if (url.startsWith('http')) return r.abort();
    return r.continue();
  });

  await g.page.waitForSelector('#menu:not(.hide)', { timeout: 15000 });
  await g.exec(() => document.querySelector('[data-preset="2"]').click());

  await g.waitUntil(() => window.WD && window.WD.state === 'driving',
    { timeout: 90000, what: 'the world to load and the drive to start' });

  const world = await g.exec(() => ({
    roads: window.WD.world.stats.roads,
    spawn: window.WD.world.spawn.name,
    hud: !document.getElementById('hud').classList.contains('hide'),
    loading: document.getElementById('loading').classList.contains('hide'),
  }));
  check(world.roads > 0, `the world came back with ${world.roads} roads`);
  check(world.hud && world.loading, 'the HUD never replaced the loading card');

  // and it has to actually move
  await g.page.keyboard.down('KeyW');
  await g.wait(2500);
  await g.page.keyboard.up('KeyW');
  const driving = await g.exec(() => ({
    speed: +document.getElementById('speed').textContent,
    street: document.getElementById('street').textContent,
  }));
  check(driving.speed > 10, `the car reached ${driving.speed} km/h`);
  check(driving.street.length > 0, 'the HUD names no street');

  expectOnlyNetworkErrors(g, 'canned world');
  await g.close();
});

await run('world drive');
await browser.close();
