// The floor for the Omarchy plugin, read off the files the shell will read.
//
// Two halves, and neither of them needs a compositor:
//
//   1. the manifest, checked the way omarchy-plugin-validate checks it. That
//      script is what stands between a bad manifest and a shell that loads it,
//      and it runs on the machine of whoever types `omarchy plugin add` — long
//      after a push here. Mirroring it means the failure lands on this laptop
//      instead of on somebody else's desktop.
//   2. the rules in Model.js, loaded into a node:vm context exactly like
//      zoo-magnata's test loads its global-scope game. QML is not JavaScript we
//      can import, but Model.js is: it was split off the panel for this.
//
// What is left over is what QML draws, and that is the lap by hand — CLAUDE.md
// section 6 already says why the machine with no graphics card was never honest
// about pixels. The instructions for that lap are in omarchy/README.md.

import { scenario, check, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { renderCatalog } from '../omarchy/catalog.mjs';
import { readGames } from '../omarchy/build.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const games = readGames(ROOT);

/** Model.js and Catalog.js are plain top-level `var`s — no ESM, no QML. That is
 *  what QML's `import … as` reads, and it is what a vm context evaluates. */
function load(...files) {
  const context = vm.createContext({});
  for (const file of files) {
    vm.runInContext(readFileSync(path.join(ROOT, 'omarchy', file), 'utf8'), context, { filename: file });
  }
  return context;
}

const model = load('Model.js');
const catalog = load('Catalog.js');

// ------------------------------------------------------------- the manifest

scenario('the manifest says what omarchy-plugin-validate demands', () => {
  check(manifest.schemaVersion === 1, `schemaVersion is ${JSON.stringify(manifest.schemaVersion)}, the registry only knows 1`);
  for (const field of ['id', 'name', 'version', 'kinds', 'entryPoints']) {
    check(manifest[field] !== undefined, `no "${field}" — the validator refuses the install`);
  }
  check(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.id), `"${manifest.id}" is not a valid plugin id`);
  check(!manifest.id.includes('..'), `"${manifest.id}" contains ".."`);
  check(!manifest.id.startsWith('omarchy.'), `"${manifest.id}" claims the reserved omarchy.* namespace`);
  check(Array.isArray(manifest.kinds) && manifest.kinds.length > 0, 'kinds has to be a non-empty array');
  check(manifest.entryPoints && typeof manifest.entryPoints === 'object', 'entryPoints has to be an object');
});

scenario('every entry point is a relative path to a file that is really there', () => {
  for (const [kind, file] of Object.entries(manifest.entryPoints)) {
    check(typeof file === 'string' && file.length > 0, `entryPoints.${kind} is empty`);
    check(!file.startsWith('/'), `entryPoints.${kind} is absolute: ${file}`);
    check(!file.includes('..'), `entryPoints.${kind} escapes the plugin folder: ${file}`);
    check(!file.includes('\n'), `entryPoints.${kind} contains a newline`);
    check(existsSync(path.join(ROOT, file)), `entryPoints.${kind} points at ${file}, which does not exist`);
  }
});

scenario('each kind brings the entry point that kind is loaded through', () => {
  // A kind with no entry point installs, enables and does nothing — the bar
  // falls back to the built-in and the only trace is a line on the console.
  const forKind = {
    bar: 'bar', 'bar-widget': 'barWidget', menu: 'menu', overlay: 'overlay', panel: 'panel', service: 'service',
  };
  for (const kind of manifest.kinds) {
    check(forKind[kind], `unknown kind "${kind}"`);
    check(manifest.entryPoints[forKind[kind]], `kind "${kind}" needs entryPoints.${forKind[kind]}`);
  }
  if (manifest.barWidget && manifest.barWidget.defaultSection !== undefined) {
    check(['left', 'center', 'right'].includes(manifest.barWidget.defaultSection),
      `barWidget.defaultSection is "${manifest.barWidget.defaultSection}" — left, center or right`);
  }
});

scenario('nothing that ships in the clone is a symlink', () => {
  // The validator refuses a symlink anywhere inside a plugin folder, and the
  // plugin folder is this repository. node_modules is full of them (npm
  // workspaces links slopkit) and never leaves this machine, so the question is
  // exactly "what does git carry" — mode 120000 is git's word for a symlink.
  const listing = execFileSync('git', ['ls-files', '-s'], { cwd: ROOT, encoding: 'utf8' });
  const links = listing.split('\n').filter((line) => line.startsWith('120000')).map((l) => l.split('\t')[1]);
  check(links.length === 0, `git tracks ${links.length} symlink(s): ${links.slice(0, 3).join(', ')}`);
});

scenario('the QML entry point loads only files that travel with it', () => {
  const qml = readFileSync(path.join(ROOT, manifest.entryPoints.barWidget), 'utf8');
  const dir = path.dirname(path.join(ROOT, manifest.entryPoints.barWidget));
  const imports = [...qml.matchAll(/^import\s+"([^"]+)"/gm)].map((m) => m[1]);
  check(imports.length >= 2, `the panel imports ${imports.length} local file(s) — expected Model.js and Catalog.js`);
  for (const file of imports) {
    check(existsSync(path.join(dir, file)), `imports "${file}", which is not next to it`);
  }
  // A private-use glyph pasted into source is invisible in a diff and the first
  // thing an encoding mishap eats. The bar icons are written as escapes.
  const literal = qml.match(/[\uE000-\uF8FF]/u);
  check(!literal, `a literal private-use glyph (U+${literal && literal[0].codePointAt(0).toString(16)}) is in the source — write it as \\uXXXX`);
});

scenario('the panel answers to the id the shell knows it by', () => {
  // `moduleName` is how a widget finds its own entry in shell.json — its bar
  // position and its saved settings, the EN/PT choice among them. Let it drift
  // from the manifest id and nothing throws: the panel just draws with defaults
  // forever and every click on a flag is forgotten on restart.
  const qml = readFileSync(path.join(ROOT, manifest.entryPoints.barWidget), 'utf8');
  const declared = qml.match(/moduleName:\s*"([^"]+)"/);
  check(declared, 'the panel declares no moduleName');
  check(declared && declared[1] === manifest.id,
    `the panel calls itself "${declared && declared[1]}" and the manifest calls it "${manifest.id}"`);
});

scenario('the listing carries what the marketplace asks of it', () => {
  // omarchyplugins.com refuses a submission without these, and the refusal
  // arrives days later on somebody else's review queue. They are properties of
  // the repository, so they are checkable here.
  check(existsSync(path.join(ROOT, 'LICENSE')), 'no LICENSE at the root — the marketplace requires a root license file');
  for (const field of ['author', 'description', 'license', 'version']) {
    const value = manifest[field];
    check(typeof value === 'string' && value.trim().length > 0, `manifest.${field} is empty — the listing shows it`);
  }
  check(manifest.version.length <= 64, `the version is ${manifest.version.length} characters, the listing caps it at 64`);

  // "Contains a root README with installation and removal instructions" — the
  // root one, not omarchy/README.md, which is where they would naturally go.
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  check(readme.includes('omarchy plugin add'), 'the root README never says how to install the plugin');
  check(readme.includes('omarchy plugin remove'), 'the root README never says how to remove the plugin');
});

// -------------------------------------------------------------- the catalog

scenario('Catalog.js is in step with games/*/game.json', () => {
  const onDisk = readFileSync(path.join(ROOT, 'omarchy/Catalog.js'), 'utf8');
  check(onDisk === renderCatalog(games), 'omarchy/Catalog.js is stale — run npm run omarchy and commit it');
});

scenario('the panel gets every game, in both languages', () => {
  check(Array.isArray(catalog.GAMES), 'Catalog.js does not declare a top-level GAMES');
  check(catalog.GAMES.length === games.length,
    `${catalog.GAMES.length} games in the plugin, ${games.length} in games/`);
  for (const row of catalog.GAMES) {
    check(games.some((g) => g.slug === row.slug), `"${row.slug}" is not a game in this repository`);
    check(typeof row.emoji === 'string' && row.emoji.length > 0, `${row.slug}: no emoji`);
    for (const field of ['name', 'blurb']) {
      for (const lang of ['en', 'pt']) {
        const value = row[field] && row[field][lang];
        check(typeof value === 'string' && value.trim().length > 0,
          `${row.slug}: ${field}.${lang} is missing — half a translation only shows up when somebody flips the flag`);
      }
    }
    // One line in a panel row, not a paragraph: the blurb is the first sentence.
    check(row.blurb.en.length <= 160, `${row.slug}: the English blurb is ${row.blurb.en.length} characters — too long for a row`);
    check(row.blurb.pt.length <= 160, `${row.slug}: the Portuguese blurb is ${row.blurb.pt.length} characters — too long for a row`);
  }
});

scenario("the plugin's own phrases exist in both languages", () => {
  const holes = missingKeys(model.TEXT);
  check(holes.length === 0, `missing translations: ${holes.join(', ')}`);
});

// ----------------------------------------------------------------- the rules

scenario('a Portuguese desktop gets Portuguese, everybody else gets English', () => {
  check(model.language('pt_BR', '') === 'pt', 'pt_BR did not get Portuguese');
  check(model.language('pt_PT', '') === 'pt', 'pt_PT did not get Portuguese');
  check(model.language('en_US', '') === 'en', 'en_US did not get English');
  // English is the product default — the fallback only decides what a French or
  // Japanese visitor sees.
  check(model.language('fr_FR', '') === 'en', 'a French locale should fall back to English');
  check(model.language('ja_JP', undefined) === 'en', 'an unset override should not break the fallback');
  // …and a flag clicked in the footer wins over the system.
  check(model.language('en_US', 'pt') === 'pt', 'the saved choice lost to the locale');
  check(model.language('pt_BR', 'en') === 'en', 'the saved choice lost to the locale');
  check(model.language('pt_BR', 'de') === 'pt', 'a junk override should be ignored, not obeyed');
});

scenario('a phrase fills its holes and never shows a raw key', () => {
  check(model.t('subtitle', 'en', { n: 10 }) === '10 games · one HTML file each',
    `the English subtitle came out "${model.t('subtitle', 'en', { n: 10 })}"`);
  check(model.t('subtitle', 'pt', { n: 10 }).startsWith('10 jogos'),
    `the Portuguese subtitle came out "${model.t('subtitle', 'pt', { n: 10 })}"`);
  check(model.t('openCatalog', 'pt') === 'Abrir o catálogo', 'the Portuguese side of openCatalog is wrong');
  check(model.pick({ en: 'Play' }, 'pt') === 'Play', 'a missing Portuguese side should fall back to English, not to empty');
});

scenario('a game opens from disk when there is a disk, and from the web when there is not', () => {
  const SITE = catalog.SITE;
  check(model.gameUrl('zoo-magnata', '', SITE) === `${SITE}/zoo-magnata/`,
    `with no local copy it built ${model.gameUrl('zoo-magnata', '', SITE)}`);
  check(model.catalogUrl('', SITE) === `${SITE}/`, `the catalog URL came out ${model.catalogUrl('', SITE)}`);

  check(model.gameUrl('zoo-magnata', '/home/v/dist', SITE) === 'file:///home/v/dist/zoo-magnata/index.html',
    `a local game came out ${model.gameUrl('zoo-magnata', '/home/v/dist', SITE)}`);
  check(model.catalogUrl('/home/v/dist/', SITE) === 'file:///home/v/dist/index.html',
    'a trailing slash on the root should not double up in the URL');

  // Somebody's home directory has a space in it, and a browser handed a raw one
  // opens a file that is not there.
  check(model.gameUrl('skifree3d', '/home/v/my games', SITE) === 'file:///home/v/my%20games/skifree3d/index.html',
    `a path with a space came out ${model.gameUrl('skifree3d', '/home/v/my games', SITE)}`);

  check(model.isLocal('/home/v/dist'), 'a path should read as local');
  check(!model.isLocal(''), 'no root at all is not local');
  check(!model.isLocal(SITE), 'the published site is not local');
});

scenario('the launcher opens a window, not a browser tab', () => {
  const command = model.launchCommand('file:///tmp/x/index.html');
  check(command[0] === 'omarchy-launch-webapp', `it would run ${command[0]}`);
  check(command.length === 2 && command[1] === 'file:///tmp/x/index.html', 'the URL is not the only argument');
});

scenario('the probe looks in the right places, in the right order', () => {
  const candidates = model.rootCandidates('/plug', '/env/dist', '/home/v');
  check(candidates[0] === '/env/dist', `SLOP_GAMES_DIR should win, got ${candidates[0]}`);
  check(candidates[1] === '/plug/dist', `the plugin's own build should come second, got ${candidates[1]}`);
  check(candidates[2] === '/home/v/.local/share/slop-games', `npm run omarchy:install writes the third, got ${candidates[2]}`);
  check(model.rootCandidates('/plug', '', '/home/v').length === 2, 'an unset env var should drop out, not become ""');

  const command = model.probeCommand(candidates);
  check(command[0] === 'bash' && command[1] === '-c', 'the probe is not a bash -c');
  check(command[3] === 'slop-games', 'the $0 slot has to be filled or the first candidate lands there');
  check(command.slice(4).join('|') === candidates.join('|'), 'the candidates are not the arguments');
});

scenario('the probe really finds the first directory that exists', () => {
  // The one thing here that runs the actual shell: a script that silently picks
  // the wrong branch is a panel that opens the internet with the games sitting
  // on disk, and no error anywhere.
  const box = mkdtempSync(path.join(tmpdir(), 'slop-omarchy-'));
  try {
    const second = path.join(box, 'second');
    const spaced = path.join(box, 'with space');
    mkdirSync(second, { recursive: true });
    mkdirSync(spaced, { recursive: true });
    writeFileSync(path.join(second, 'index.html'), '<!doctype html>');
    writeFileSync(path.join(spaced, 'index.html'), '<!doctype html>');

    const probe = (dirs) => {
      const command = model.probeCommand(dirs);
      try {
        return execFileSync(command[0], command.slice(1), { encoding: 'utf8' }).trim();
      } catch {
        return '';
      }
    };

    check(probe([path.join(box, 'missing'), second]) === second,
      'it did not skip a candidate that is not there');
    check(probe([second, spaced]) === second, 'it did not stop at the first hit');
    check(probe([spaced]) === spaced, 'a path with a space came back wrong — the candidates must stay argv');
    check(probe([path.join(box, 'nope')]) === '', 'with nothing on disk it has to answer empty, not a path');
    // A directory without the catalog in it is somebody else's folder.
    mkdirSync(path.join(box, 'empty'), { recursive: true });
    check(probe([path.join(box, 'empty'), second]) === second, 'an empty directory should not count as a copy');
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
});

scenario('the cursor wraps at both ends and survives an empty list', () => {
  check(model.moveCursor(0, 1, 10) === 1, 'down from the first row');
  check(model.moveCursor(9, 1, 10) === 0, 'down from the last row should come back to the top');
  check(model.moveCursor(0, -1, 10) === 9, 'up from the first row should land on the last');
  check(model.moveCursor(3, 0, 10) === 3, 'no movement should not move');
  check(model.moveCursor(4, 1, 0) === 0, 'an empty list must not produce a negative or NaN index');
});

scenario('the plugin folder is found from the file QML is running', () => {
  check(model.dirFromUrl('file:///home/v/.config/omarchy/plugins/x/omarchy/') === '/home/v/.config/omarchy/plugins/x/omarchy',
    'the file:// prefix or the trailing slash survived');
  check(model.dirFromUrl('file:///home/v/my%20games/omarchy') === '/home/v/my games/omarchy',
    'a percent-encoded path came back encoded — the probe would then look for a directory called %20');
  check(model.parentDir('/home/v/plugins/x/omarchy') === '/home/v/plugins/x', 'the parent of the QML folder is the plugin root');
  check(model.parentDir('/a') === '/', 'walking off the top should stop at the root, not produce ""');
});

scenario('what the panel would open is really in dist/, when dist/ has been built', () => {
  // Only when there is a build to check against: on a fresh clone this is a
  // no-op rather than a failure, because dist/ is not in git.
  const dist = path.join(ROOT, 'dist');
  if (!existsSync(path.join(dist, 'index.html'))) {
    check(true, 'no dist/ to check against — run npm run build for this one to say anything');
    return;
  }
  for (const row of catalog.GAMES) {
    const url = model.gameUrl(row.slug, dist, catalog.SITE);
    const file = decodeURI(url.replace(/^file:\/\//, ''));
    check(existsSync(file), `${row.slug}: the panel would open ${file}, which is not there`);
  }
  check(existsSync(decodeURI(model.catalogUrl(dist, catalog.SITE).replace(/^file:\/\//, ''))),
    'the catalog button would open an index that is not there');
});

await run('omarchy plugin');
