// What every game in the catalog has to deliver, read off the built file.
//
// This is the floor. It used to open each game in Chrome and look at the
// canvas; it does not any more (CLAUDE.md, section 6 — the runner has no GPU
// and the 3D games draw a frame every few seconds there). What survived the
// move is everything that was never really about the browser: the rules in
// section 1 are properties of the file on disk, and a text search answers them
// in milliseconds instead of minutes.
//
// What it can no longer say is "and it draws". That is the lap by hand before a
// deploy — the one thing a machine with no graphics card was never honest about.

import { scenario, check, checkEqual, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { normalizeSort, sortCatalog } from '../site/catalog.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const catalog = readdirSync(path.join(ROOT, 'games'))
  .filter((slug) => {
    try {
      return statSync(path.join(ROOT, 'games', slug, 'game.json')).isFile();
    } catch {
      return false;
    }
  })
  .map((slug) => JSON.parse(readFileSync(path.join(ROOT, 'games', slug, 'game.json'), 'utf8')));

const built = (slug) => path.join(DIST, slug, 'index.html');
const readBuilt = (slug) => readFileSync(built(slug), 'utf8');

scenario('the build ran, and produced one file per game plus the index', () => {
  check(existsSync(DIST), 'no dist/ at all — run npm run build');
  check(existsSync(path.join(DIST, 'index.html')), 'the catalog index was not generated');
  for (const game of catalog) {
    check(existsSync(built(game.slug)), `${game.slug}: no dist/index.html — run npm run build`);
  }
  check(catalog.length >= 4, `only ${catalog.length} games in the catalog`);
});

for (const game of catalog) {
  const label = `${game.emoji} ${game.name.en}`;

  scenario(`${label}: is a single file that opens on a double click`, () => {
    const html = readBuilt(game.slug);
    // rule nº 2, enforced by machine: over file:// any of these is a game that
    // does not open, or opens without half of itself
    const external =
      html.match(/<script\b[^>]*\bsrc=["']?(?!data:)[^"'>\s]+/i) ||
      html.match(/<link\b[^>]*\bstylesheet[^>]*\bhref=["']?(?!data:)[^"'>\s]+/i) ||
      html.match(/<img\b[^>]*\bsrc=["'](?!data:)[^"'>\s]+/i);
    check(!external, `loads an external resource (${external && external[0].slice(0, 60)})`);
    check(/<title>[^<]+<\/title>/i.test(html), 'the page has no <title>');
    check(/<canvas\b/i.test(html) || /createElement\(['"]canvas/i.test(html),
      'the game never puts a canvas on the page');
    check(/<meta\b[^>]*\bviewport\b/i.test(html), 'no viewport meta — it will be unusable on a phone');
  });

  scenario(`${label}: weighs what it should, with no asset smuggled in`, () => {
    const kb = statSync(built(game.slug)).size / 1024;
    check(kb > 20, `${kb.toFixed(0)} KB — that is too small to be a whole game`);
    check(kb < 2048, `${kb.toFixed(0)} KB — past 2 MB, look for an embedded asset or a bundle that was not minified`);

    // rule nº 5: every sprite, texture and sound is drawn or synthesised at
    // runtime. A base64 image is how that rule dies quietly.
    const html = readBuilt(game.slug);
    const blobs = html.match(/data:(image|audio|video)\/[a-z+]+;base64,[A-Za-z0-9+/=]{2000,}/gi) || [];
    check(blobs.length === 0, `${blobs.length} embedded asset(s) — the assets here are made by code`);
  });

  scenario(`${label}: says who it is, in both languages`, () => {
    check(game.slug && /^[a-z0-9-]+$/.test(game.slug), `"${game.slug}" is not a slug`);
    for (const field of ['name', 'description']) {
      for (const lang of ['en', 'pt']) {
        const value = game[field] && game[field][lang];
        check(typeof value === 'string' && value.trim().length > 0,
          `${field}.${lang} is missing — half a translation only shows up when somebody flips the flag`);
      }
    }
    check(Array.isArray(game.tags) && game.tags.length > 0, 'no tags');
    check(Array.isArray(game.libs), 'libs has to be a list (an empty one is a badge of honour)');
    check(typeof game.offline === 'boolean', 'offline has to say true or false');
    if (game.offline === false) {
      check(game.note && game.note.en && game.note.pt,
        'a game that needs the network has to explain itself, in both languages');
    }
  });

  scenario(`${label}: offers the exit to the catalog, and only inside it`, () => {
    const html = readBuilt(game.slug);
    // The injected activator mentions `__catalog` itself, so searching the whole
    // file always finds it — and a game whose exit rotted would still pass. Cut
    // the activator out first and ask what the *game* offers.
    const own = html.replace(/window\.__catalog = '\.\.\/index\.html';[\s\S]*?<\/script>/, '');
    check(own.includes('data-back-to-catalog') || own.includes('__catalog'),
      'no exit to the catalog — in app mode there is no browser chrome and the player is stuck');
    check(html.includes("window.__catalog = '../index.html'"),
      'the catalog build did not switch the exit on');

    // and the game's own file, downloaded alone, must not point at a catalog
    // that is not there
    const loose = readFileSync(path.join(ROOT, 'games', game.slug, 'dist/index.html'), 'utf8');
    check(!loose.includes("window.__catalog = '../index.html'"),
      'whoever downloads only the game must not get a link to a catalog they do not have');
  });

  scenario(`${label}: is wired to the shared language choice`, () => {
    const html = readBuilt(game.slug);
    check(html.includes('slop:lang'),
      'the game does not use the shared language key, so the flag will not carry over from the index');
    check(html.includes('"pt"') || html.includes("'pt'") || html.includes('data-pt'),
      'nothing in the file mentions Portuguese — the game speaks one language');
    // that the words really change with the flag is the game's own test: it is
    // the only place that can read a dictionary instead of a minified bundle
  });
}

scenario('the index lists every game, and each card points at a file that exists', () => {
  const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/class="card"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const alt = [...html.matchAll(/href="([^"]+)"[^>]*class="card"/g)].map((m) => m[1]);
  const links = hrefs.length ? hrefs : alt;
  check(links.length === catalog.length, `${links.length} cards for ${catalog.length} games`);
  for (const href of links) {
    check(existsSync(path.join(DIST, href)), `broken link on the index: ${href}`);
  }
  // the same escaping the index build does — a name with an `&` in it reaches
  // the page as `&amp;`, and searching for the raw string would say the card is
  // missing when it is right there
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  for (const game of catalog) {
    check(html.includes(esc(game.name.en)) && html.includes(esc(game.name.pt)),
      `${game.slug}: the index does not carry both of its names`);
  }
});

scenario('the index knows when every game joined, from Git rather than its metadata year', () => {
  const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<a class="card"[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);
  const cards = blocks.map((block) => ({
    block,
    slug: block.match(/href="\.\/([^/]+)\/index\.html"/)[1],
    added: block.match(/data-added="([^"]+)"/)[1],
  }));
  check(cards.length === catalog.length, `${cards.length} dated cards for ${catalog.length} games`);

  for (const card of cards) {
    const history = execFileSync(
      'git',
      ['log', '--follow', '--diff-filter=A', '--format=%aI', '--', `games/${card.slug}/game.json`],
      { cwd: ROOT, encoding: 'utf8' }
    ).trim().split(/\r?\n/).filter(Boolean);
    const expected = history.at(-1)?.slice(0, 10);
    check(/^\d{4}-\d{2}-\d{2}$/.test(card.added), `${card.slug}: "${card.added}" is not an ISO day`);
    check(card.added === expected,
      `${card.slug}: card says ${card.added}, first commit says ${expected}`);
    check(card.block.includes(`<time class="card__date" datetime="${expected}"`),
      `${card.slug}: its Git day is data only — the player cannot see it`);
  }

  const days = cards.map((card) => card.added);
  check(days.every((day, index) => index === 0 || days[index - 1] >= day),
    `the first paint is not newest-first: ${days.join(', ')}`);
  // Every published build runs in Actions, where a one-commit checkout would
  // make all older addition dates disappear and trigger the local fallback.
  const workflow = readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  check(/fetch-depth:\s*0/.test(workflow), 'CI checks out a shallow history, so it cannot date the games');
});

scenario('the catalog switches between recent and A–Z in the active language', () => {
  const sample = [
    { id: 'old-z', added: '2026-01-01', name: { en: 'Zebra', pt: 'Abelha' } },
    { id: 'new-b', added: '2026-03-01', name: { en: 'Beta', pt: 'Beta' } },
    { id: 'old-a', added: '2026-01-01', name: { en: 'Alpha', pt: 'Zebra' } },
  ];
  const ids = (items) => items.map((item) => item.id);
  checkEqual(ids(sortCatalog(sample, 'recent', 'en')), ['new-b', 'old-a', 'old-z'],
    'recent order did not use date then English name');
  checkEqual(ids(sortCatalog(sample, 'alpha', 'en')), ['old-a', 'new-b', 'old-z'],
    'English A–Z is out of order');
  checkEqual(ids(sortCatalog(sample, 'alpha', 'pt')), ['old-z', 'new-b', 'old-a'],
    'Portuguese A–Z did not follow the Portuguese names');
  check(normalizeSort('anything') === 'recent', 'a damaged saved choice does not return to recent');

  const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  check(/data-sort="recent"/.test(html) && /data-sort="alpha"/.test(html),
    'the two sort choices never reached the page');
  check(html.includes('slop:catalog-sort'), 'the catalog forgets the chosen order on reload');
});

scenario('the catalog is installable: a manifest, an icon and a scope over the games', () => {
  const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const link = html.match(/<link\b[^>]*rel="manifest"[^>]*href="\.\/([^"]+)"/i);
  // A `data:` manifest is not good enough here and the browser is the one who
  // says so: asked through the devtools protocol it answers `property
  // 'start_url' ignored, URL is invalid`, and the same for `scope`, because the
  // relative URLs inside a manifest resolve against the manifest's own URL.
  // Installed from a game's page instead of the index, that fallback scopes the
  // whole app to that one game.
  check(link, 'the manifest is not a file — as a data: URI it loses start_url and scope');
  const file = path.join(DIST, link[1]);
  check(existsSync(file), `the manifest link points at ${link[1]}, which was not generated`);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  check(manifest.name && manifest.short_name, 'the manifest has no name');
  check(manifest.start_url === './', `start_url is "${manifest.start_url}"`);
  check(manifest.scope === './', `scope is "${manifest.scope}" — the games have to run inside the app`);
  check(manifest.display === 'standalone', `display is "${manifest.display}"`);
  check((manifest.icons || []).length > 0, 'the manifest ships no icon');
  check(/apple-mobile-web-app/i.test(html), 'the meta iOS Safari uses is missing');
});

scenario('the installed app works with no network: a worker holding the whole catalog', () => {
  const sw = path.join(DIST, 'sw.js');
  check(existsSync(sw), 'no dist/sw.js — an installed app with no network shows the dinosaur, one file or not');
  const source = readFileSync(sw, 'utf8');

  // the build stamps both blanks; either one left behind is a worker that
  // caches nothing and never updates
  const version = source.match(/const VERSION = '([^']+)'/);
  check(version && version[1] && !version[1].includes('__'), 'the worker was published without its build version');
  const files = source.match(/const FILES = (\[[\s\S]*?\]);/);
  check(files, 'the worker was published with no file list');
  const cached = JSON.parse(files[1]);

  check(cached[0] === './index.html', `the shell has to come first, not "${cached[0]}"`);
  for (const game of catalog) {
    check(cached.includes(`./${game.slug}/index.html`),
      `${game.slug} is not precached — it would be a dinosaur on a plane`);
  }
  for (const href of cached) {
    check(existsSync(path.join(DIST, href)), `the worker precaches ${href}, which is not in dist/`);
  }

  // the two halves of "it stays current": a page asks the network first, and a
  // new build drops the cache the old one left behind
  check(/navigate/.test(source) && /freshFirst/.test(source),
    'the worker does not treat a page differently — cache-first leaves players on an old build');
  check(/caches\.delete/.test(source), 'nothing ever deletes an old cache');
});

scenario('the offline cache is switched on where there is a server, and nowhere else', () => {
  const index = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  check(/serviceWorker/.test(index) && /register\((["'])\.\/sw\.js\1\)/.test(index),
    'the catalog never registers the worker, so nothing is ever cached');

  for (const game of catalog) {
    const published = readBuilt(game.slug);
    check(/register\((["'])\.\.\/sw\.js\1\)/.test(published),
      `${game.slug}: arriving straight at this game does not prime the cache`);

    // rule nº 3 is the one at risk here: `'serviceWorker' in navigator` is true
    // over file:// (isSecureContext is too), and registering there throws an
    // uncaught "URL protocol of the current origin ('null') is not supported"
    // on the console of everyone who opens the game on a double click
    const guard = published.slice(0, published.indexOf('register('));
    check(/location\.protocol/.test(guard.slice(-400)),
      `${game.slug}: the registration is not guarded on the protocol — over file:// it throws`);

    const loose = readFileSync(path.join(ROOT, 'games', game.slug, 'dist/index.html'), 'utf8');
    check(!/sw\.js/.test(loose),
      `${game.slug}: the loose download points at a worker that only exists in the catalog`);
  }
});

scenario("the kit's own phrases exist in both languages", () => {
  // the exit to the catalog is one of them, and it is written once for every game
  const missing = missingKeys({});
  check(missing.length === 0, `the kit ships half a translation: ${missing.join(', ')}`);
});

await run('catalog');
