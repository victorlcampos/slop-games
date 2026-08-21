#!/usr/bin/env node
// Builds every game and assembles the index in dist/.
//
//   node build.mjs              -> build everything
//   node build.mjs zoo-magnata  -> build one game (and the index)
//
// Result: dist/index.html (the index) + dist/<slug>/index.html (each game).
// Everything opens on a double click — the links are relative, so it works over
// file:// exactly as it does on GitHub Pages.

import { build } from 'slopkit/build';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeCatalog } from './omarchy/build.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const GAMES = join(ROOT, 'games');
const DIST = join(ROOT, 'dist');

const filter = process.argv.slice(2);
const kb = (bytes) => (bytes / 1024).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Tag names, in both languages.
 *
 * game.json carries the canonical English slug and the translation lives here,
 * in one place — otherwise every game would repeat "2d" twice and the day a tag
 * is reworded you would have to find all of them.
 */
const TAGS = {
  '2d': { pt: '2d', en: '2d' },
  '3d': { pt: '3d', en: '3d' },
  arcade: { pt: 'arcade', en: 'arcade' },
  artillery: { pt: 'artilharia', en: 'artillery' },
  'board-game': { pt: 'tabuleiro', en: 'board game' },
  'capture-the-flag': { pt: 'captura a bandeira', en: 'capture the flag' },
  'open-world': { pt: 'mundo aberto', en: 'open world' },
  puzzle: { pt: 'quebra-cabeça', en: 'puzzle' },
  racing: { pt: 'corrida', en: 'racing' },
  remake: { pt: 'remake', en: 'remake' },
  roguelike: { pt: 'roguelike', en: 'roguelike' },
  rts: { pt: 'rts', en: 'rts' },
  'run-and-gun': { pt: 'run and gun', en: 'run and gun' },
  simulation: { pt: 'simulação', en: 'simulation' },
  stealth: { pt: 'furtivo', en: 'stealth' },
  strategy: { pt: 'estratégia', en: 'strategy' },
  'tower-defense': { pt: 'tower defense', en: 'tower defense' },
  'turn-based': { pt: 'por turnos', en: 'turn-based' },
  tycoon: { pt: 'tycoon', en: 'tycoon' },
};

const UI = {
  offline: { pt: 'offline', en: 'offline' },
  offlineHint: { pt: 'Roda sem internet', en: 'Runs without internet' },
  online: { pt: 'precisa de rede', en: 'needs network' },
  onlineHint: { pt: 'Precisa de internet', en: 'Needs internet' },
  noDeps: { pt: 'sem dependências', en: 'no dependencies' },
};

/** HTML-escape — game.json is ours, but a stray `&` still has to survive. */
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** `data-pt="…" data-en="…"` for a bilingual field — see bindText in the kit.
 *  The markup renders the English side, which is the product default; bindText
 *  swaps to Portuguese only if the flag asks. */
const both = (value, attr = '') =>
  `data-pt${attr && '-' + attr}="${esc(value.pt)}" data-en${attr && '-' + attr}="${esc(value.en)}"`;

// ------------------------------------------------------------------ catalog
const catalog = readdirSync(GAMES)
  .filter((slug) => {
    try {
      return statSync(join(GAMES, slug, 'game.json')).isFile();
    } catch {
      return false;
    }
  })
  .map((slug) => {
    const meta = JSON.parse(readFileSync(join(GAMES, slug, 'game.json'), 'utf8'));
    if (meta.slug !== slug) {
      throw new Error(`games/${slug}/game.json: the "slug" field says "${meta.slug}", it should say "${slug}"`);
    }
    for (const field of ['name', 'description']) {
      const v = meta[field];
      if (!v || !v.pt || !v.en) {
        throw new Error(`games/${slug}/game.json: "${field}" needs both a "pt" and an "en" — the catalog ships in two languages`);
      }
    }
    // `note` is optional, but a half-translated one reaches the card's tooltip
    if (meta.note && (!meta.note.pt || !meta.note.en)) {
      throw new Error(`games/${slug}/game.json: "note" needs both a "pt" and an "en" — it is shown on the card`);
    }
    for (const tag of meta.tags || []) {
      if (!TAGS[tag]) throw new Error(`games/${slug}/game.json: unknown tag "${tag}" — add it to TAGS in build.mjs`);
    }
    return meta;
  })
  .sort((a, b) => a.name.en.localeCompare(b.name.en, 'en'));

if (!catalog.length) throw new Error('no game found in games/*/game.json');

// The Omarchy plugin reads its list from a generated source file rather than
// from dist/, because the plugin is a clone of this repository and a clone never
// builds. Regenerated from the whole catalog even on a one-game build: the
// panel lists ten games whichever one you happened to rebuild.
const catalogChanged = writeCatalog(catalog);

const toBuild = filter.length ? catalog.filter((g) => filter.includes(g.slug)) : catalog;
for (const slug of filter) {
  if (!catalog.some((g) => g.slug === slug)) throw new Error(`unknown game: ${slug}`);
}

// -------------------------------------------------------------------- build
if (!filter.length) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const game of toBuild) {
  const folder = join(GAMES, game.slug);
  process.stdout.write(`  ${game.emoji}  ${game.name.en} … `);

  execFileSync('npm', ['run', '--silent', 'build'], { cwd: folder, stdio: ['ignore', 'ignore', 'inherit'] });

  const generated = join(folder, 'dist/index.html');
  let size;
  try {
    size = statSync(generated).size;
  } catch {
    throw new Error(`\n${game.slug}: the build produced no dist/index.html — see the contract in CLAUDE.md`);
  }

  // The game has to be self-contained: no <script src> or <link stylesheet>
  // pointing outside the file, or it won't open over file://.
  const html = readFileSync(generated, 'utf8');
  const external =
    html.match(/<script\b[^>]*\bsrc=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bstylesheet[^>]*\bhref=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bhref=["']?(?!data:|#)[^"'>\s]+[^>]*\bstylesheet/i);
  if (external) {
    throw new Error(
      `\n${game.slug}: dist/index.html loads an external file (${external[0].slice(0, 60)}…) — the game has to be one HTML file`
    );
  }

  mkdirSync(join(DIST, game.slug), { recursive: true });
  // The catalog's copy gets the way back; the file in games/<slug>/dist stays
  // pure, for whoever downloads only that.
  writeFileSync(join(DIST, game.slug, 'index.html'), withCatalogExit(html), 'utf8');
  console.log(`${kb(size)} KB`);
}

/**
 * What the published copy of a game gets and the loose download does not: the
 * exit back to the catalog, and the offline cache.
 *
 * The catalog is the installable app and the games run inside its scope. In app
 * mode there is no browser chrome: without an exit, whoever enters a game is
 * stuck — on Android there is still the system button, on iOS there is nothing.
 *
 * The contract is the opposite of injecting a button over the game: **each game
 * says where it wants the exit**, on its own home screen and in its own style,
 * and the catalog merely switches it on. Whoever downloads the game's HTML by
 * itself doesn't get this script, the element stays hidden, and no link is left
 * pointing at a catalog that isn't there.
 *
 *   DOM:    <a data-back-to-catalog hidden>← all games</a>
 *   canvas: read `window.__catalog` and draw it your way
 *
 * The service worker is registered here too, and for the same reason it is
 * injected rather than written into the game: a player can arrive straight at a
 * game's URL, and that visit should be enough to make the whole catalog work
 * offline. The loose download never sees this script, so it stays a file with
 * nothing outside it.
 *
 * The guard is on the protocol, not on `'serviceWorker' in navigator`: over
 * `file://` that property is present (and `isSecureContext` is true), and
 * registering there throws an uncaught `The URL protocol of the current origin
 * ('null') is not supported` on the console of every double click.
 */
function withCatalogExit(html) {
  const script = `<script>
window.__catalog = '../index.html';
addEventListener('DOMContentLoaded', function () {
  var links = document.querySelectorAll('[data-back-to-catalog]');
  for (var i = 0; i < links.length; i++) {
    links[i].href = window.__catalog;
    links[i].hidden = false;
  }
});
if (location.protocol.indexOf('http') === 0 && 'serviceWorker' in navigator) {
  addEventListener('load', function () {
    navigator.serviceWorker.register('../sw.js').catch(function () {});
  });
}
<\/script>`;
  return html.replace('</head>', script + '\n</head>');
}

/**
 * The service worker, stamped with the build it belongs to.
 *
 * The version is a hash of everything published, so an unchanged site produces
 * an unchanged worker (no pointless cache churn) and any change at all produces
 * a new one — which is what lets the fetch handler serve from the cache without
 * ever handing out a stale build: a new version is a new cache, and the old one
 * is deleted the moment it activates.
 */
function writeServiceWorker(files) {
  const hash = createHash('sha256');
  for (const file of files) hash.update(readFileSync(join(DIST, file)));
  const version = hash.digest('hex').slice(0, 12);

  const source = readFileSync(join(ROOT, 'site/sw.js'), 'utf8');
  const list = ['./index.html', ...files.filter((f) => f !== 'index.html').map((f) => './' + f), './app.webmanifest'];
  const sw = source
    .replace('/*__VERSION__*/', () => version)
    .replace('/*__FILES__*/ []', () => JSON.stringify(list, null, 2));

  writeFileSync(join(DIST, 'sw.js'), sw, 'utf8');
  return { version, list };
}

// -------------------------------------------------------------------- index
const cards = catalog
  .map((game) => {
    const [text, generic, kind] = game.offline
      ? [UI.offline, UI.offlineHint, 'offline']
      : [UI.online, UI.onlineHint, 'online'];
    // a game that explains itself in `note` says that instead of the generic
    // line — it is the whole reason the field exists
    const hint = game.note || generic;
    const badge =
      `<span class="badge badge--${kind}" title="${esc(hint.en)}" ` +
      `${both(hint, 'title')} ${both(text)}>${esc(text.en)}</span>`;
    const tags = (game.tags || [])
      .map((t) => `<li ${both(TAGS[t])}>${esc(TAGS[t].en)}</li>`)
      .join('');
    const libs = game.libs.length
      ? `<span class="card__libs">${esc(game.libs.join(' · '))}</span>`
      : `<span class="card__libs" ${both(UI.noDeps)}>${esc(UI.noDeps.en)}</span>`;
    return `        <a class="card" href="./${game.slug}/index.html">
          <span class="card__emoji" aria-hidden="true">${game.emoji}</span>
          <h2 class="card__name" ${both(game.name)}>${esc(game.name.en)}</h2>
          <p class="card__desc" ${both(game.description)}>${esc(game.description.en)}</p>
          <ul class="card__tags">${tags}</ul>
          <footer class="card__foot">${libs}${badge}</footer>
        </a>`;
  })
  .join('\n');

// The index is installable too: adding it to the home screen gives the whole
// catalog behind one icon, and every game opens from there.
await build({
  root: ROOT,
  entry: 'site/index.js',
  template: 'site/index.html',
  out: 'dist/index.html',
  replace: {
    '<!--__GAMES__-->': cards,
    '<!--__TOTAL__-->': String(catalog.length),
  },
  pwa: {
    name: 'slop-games',
    short: 'slop-games',
    description: 'Games that run entirely in the browser.',
    emoji: '🕹️',
    background: '#0c0d12',
    color: '#0c0d12',
    // standalone (not fullscreen): keeps the system status bar, which is where
    // the player reads the clock and the battery while browsing
    display: 'standalone',
    // a real file, not a data: URI — that is the only form in which `start_url`
    // and `scope` survive, and the scope is what puts the games inside the app
    file: 'app.webmanifest',
  },
});

writeFileSync(join(DIST, '.nojekyll'), '', 'utf8');

// The offline cache covers whatever is really in dist/. A one-game build leaves
// the rest of the catalog from the previous run, and a game that was never
// built is not in there to be cached — say so instead of failing on a read.
const published = ['index.html', ...catalog.map((g) => `${g.slug}/index.html`)];
const present = published.filter((f) => {
  try { return statSync(join(DIST, f)).isFile(); } catch { return false; }
});
const { version, list } = writeServiceWorker(present);
for (const missing of published.filter((f) => !present.includes(f))) {
  console.log(`  ⚠ ${missing} is not in dist/ — it will not be available offline until a full build`);
}

console.log(`\n  ✔ dist/index.html  (${catalog.length} games in the catalog)`);
console.log(`  ✔ dist/sw.js       (${list.length} files cached offline, build ${version})`);
if (catalogChanged) console.log('  ✔ omarchy/Catalog.js was out of date and has been rewritten — commit it');
console.log('    Open it on a double click — no server needed.\n');
