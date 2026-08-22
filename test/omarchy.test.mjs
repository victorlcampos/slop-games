// The floor for the Omarchy plugin, read off the package that is published.
//
// Three halves, and none of them needs a compositor:
//
//   1. the manifest, checked the way omarchy-plugin-validate checks it. That
//      script is what stands between a bad manifest and a shell that loads it,
//      and it runs on the machine of whoever types `omarchy plugin add` — long
//      after a push here. Mirroring it means the failure lands on this laptop
//      instead of on somebody else's desktop.
//   2. the marketplace's static-scan limits. Those do not warn: a submission
//      that trips one is refused, days later, on a reviewer's queue. The first
//      one we sent was refused for a 1.3 MB vendored three.js belonging to a
//      game the plugin never reads — which is why the plugin is assembled from
//      an explicit list now, and why this measures the assembled package.
//   3. the rules in omarchy/Model.js, run in a node:vm context exactly like
//      zoo-magnata's test runs a game that lives in global scope. QML is not
//      JavaScript we can import; Model.js is, and it was split off the panel
//      for this.
//
// What is left over is what QML draws, and that is the lap by hand — CLAUDE.md
// section 6 already says why the machine with no graphics card was never honest
// about pixels. The instructions for that lap are in omarchy/README.md.

import { scenario, check, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { renderCatalog } from '../omarchy/catalog.mjs';
import { readGames } from '../omarchy/build.mjs';
import { publish, checkScanLimits, isScanned, SCAN_FILE_BYTE_LIMIT } from '../omarchy/publish.mjs';
import { previewHTML, darker, esc } from '../omarchy/preview.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const games = readGames(ROOT);

// Built here rather than read from dist-omarchy/, so the test says something
// about the code even on a checkout where nobody has run the publisher.
const PACKAGE = mkdtempSync(path.join(tmpdir(), 'slop-plugin-'));
publish(PACKAGE);

const manifest = JSON.parse(readFileSync(path.join(PACKAGE, 'manifest.json'), 'utf8'));
const packaged = readdirSync(PACKAGE).map((name) => ({ name, bytes: statSync(path.join(PACKAGE, name)).size }));

/** Model.js and Catalog.js are plain top-level `var`s — no ESM, no QML. That is
 *  what QML's `import … as` reads, and it is what a vm context evaluates. */
function load(...files) {
  const context = vm.createContext({});
  for (const file of files) {
    vm.runInContext(readFileSync(path.join(PACKAGE, file), 'utf8'), context, { filename: file });
  }
  return context;
}

const model = load('Model.js');
const catalog = load('Catalog.js');

// ------------------------------------------------------------- the wording

scenario('nothing the plugin ships counts the games out loud', () => {
  // Every hand-written string here used to say "ten games". It was true once,
  // stopped being true the moment a game was added, and nothing noticed —
  // because a number in prose has no test unless you write one. The rule is
  // simpler than keeping it in step: the plugin describes the catalog, it does
  // not count it. Catalog.js is exempt; its text is generated from game.json,
  // and a blurb that says "twelve ways to score" is about a table, not a shelf.
  const counted = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|\d+)[ -]+(browser +)?games\b/i;
  for (const file of packaged) {
    if (file.name === 'Catalog.js' || file.name === 'LICENSE') continue;
    const text = readFileSync(path.join(PACKAGE, file.name), 'utf8');
    const hit = text.split('\n').find((line) => counted.test(line));
    check(!hit, `${file.name} hardcodes how many games there are: ${String(hit).trim()}`);
  }
});

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
    check(existsSync(path.join(PACKAGE, file)), `entryPoints.${kind} points at ${file}, which is not in the package`);
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

scenario('nothing in the package is a symlink', () => {
  // The validator refuses a symlink anywhere inside a plugin folder: after the
  // folder lands in the trusted plugins directory, one could point back at any
  // file on disk.
  const links = packaged.filter((f) => lstatSync(path.join(PACKAGE, f.name)).isSymbolicLink());
  check(links.length === 0, `${links.length} symlink(s): ${links.map((l) => l.name).join(', ')}`);
});

scenario('the package is exactly the plugin, and nothing else', () => {
  // The publisher copies a list, so this is what stops the list from growing a
  // build script, a test, or a game by accident.
  const names = packaged.map((f) => f.name).sort();
  check(names.join(' ') === 'Catalog.js LICENSE Model.js Panel.qml README.md manifest.json',
    `the package holds: ${names.join(', ')}`);
});

scenario('the panel answers to the id the shell knows it by', () => {
  // `moduleName` is how a widget finds its own entry in shell.json — its bar
  // position and its saved settings, the EN/PT choice among them. Let it drift
  // from the manifest id and nothing throws: the panel just draws with defaults
  // forever and every click on a flag is forgotten on restart.
  const qml = readFileSync(path.join(PACKAGE, manifest.entryPoints.barWidget), 'utf8');
  const declared = qml.match(/moduleName:\s*"([^"]+)"/);
  check(declared, 'the panel declares no moduleName');
  check(declared && declared[1] === manifest.id,
    `the panel calls itself "${declared && declared[1]}" and the manifest calls it "${manifest.id}"`);
});

scenario('the QML entry point loads only files that travel with it', () => {
  const qml = readFileSync(path.join(PACKAGE, manifest.entryPoints.barWidget), 'utf8');
  const imports = [...qml.matchAll(/^import\s+"([^"]+)"/gm)].map((m) => m[1]);
  check(imports.length >= 2, `the panel imports ${imports.length} local file(s) — expected Model.js and Catalog.js`);
  for (const file of imports) {
    check(existsSync(path.join(PACKAGE, file)), `imports "${file}", which is not in the package`);
  }
  // A private-use glyph pasted into source is invisible in a diff and the first
  // thing an encoding mishap eats. The bar icons are written as escapes.
  const literal = qml.match(/[\uE000-\uF8FF]/u);
  check(!literal, `a literal private-use glyph (U+${literal && literal[0].codePointAt(0).toString(16)}) is in the source — write it as \\uXXXX`);
});

// ----------------------------------------------------------- the marketplace

scenario('the package survives the marketplace static scan', () => {
  // The scan does not warn. Our first submission was refused outright for one
  // 1.3 MB file — SkiFree's vendored three.js, which the plugin never reads and
  // which was only in the clone because the plugin was the whole repository.
  const summary = checkScanLimits(packaged);
  check(packaged.length >= 6, `only ${packaged.length} files in the package`);
  // Fewer than the package holds, and that is the point: manifest.json is not
  // in the marketplace's scanned-extension list, so it never reaches the scan.
  check(summary.files >= 4, `only ${summary.files} of them are scanned at all`);
  const biggest = packaged.slice().sort((a, b) => b.bytes - a.bytes)[0];
  check(biggest.bytes <= SCAN_FILE_BYTE_LIMIT,
    `${biggest.name} is ${Math.round(biggest.bytes / 1024)} KB, over the ${SCAN_FILE_BYTE_LIMIT / 1024} KB per-file limit`);
});

scenario('the listing carries what the marketplace asks of it', () => {
  check(existsSync(path.join(PACKAGE, 'LICENSE')), 'no LICENSE in the package — the marketplace requires a root license file');
  for (const field of ['author', 'description', 'license', 'version']) {
    const value = manifest[field];
    check(typeof value === 'string' && value.trim().length > 0, `manifest.${field} is empty — the listing shows it`);
  }
  check(manifest.version.length <= 64, `the version is ${manifest.version.length} characters, the listing caps it at 64`);

  // "Contains a root README with installation and removal instructions" — the
  // package's README is the published repository's root README.
  const readme = readFileSync(path.join(PACKAGE, 'README.md'), 'utf8');
  check(readme.includes('omarchy plugin add'), 'the README never says how to install the plugin');
  check(readme.includes('omarchy plugin remove'), 'the README never says how to remove the plugin');
  check(/dependenc/i.test(readme), 'the README never mentions dependencies, which the submission checklist claims are documented');
});

scenario('the README says nothing the marketplace reads as an install path', () => {
  // The security baseline scans the README as if every command in it were an
  // installation step, and it does not read prose. Our first scan came back
  // amber on three counts, all of them from this file and none from the code:
  // a `git clone` of the source repository plus `npm install` became "remote
  // source build" and "package management", and the sentence promising the
  // plugin needs no sudo tripped the privilege capability — the line wrapped
  // between "no" and "sudo", so the negation the scanner does understand was on
  // the line above the word it was negating.
  //
  // The plugin genuinely does none of these things. Keeping the words out is
  // what makes the report say so.
  const readme = readFileSync(path.join(PACKAGE, 'README.md'), 'utf8');
  const traps = [
    [/\bgit\s+(?:clone|fetch|pull)\b/i, 'a git clone — the scanner reads it as building from an unpinned remote source'],
    [/\b(?:npm|pnpm|yarn|bun)\s+(?:install|add)\b/i, 'a package-manager install — the scanner reads it as installing software'],
    [/\b(?:sudo|pkexec)\b/i, 'the word sudo — even denying it trips the privilege capability once a line wraps'],
    [/\b(?:curl|wget)\b/i, 'a download command — the scanner reads it as fetching remote code'],
  ];
  for (const [pattern, why] of traps) {
    const hit = readme.match(pattern);
    check(!hit, `the README contains ${hit && `"${hit[0]}"`}: ${why}`);
  }
});

scenario('the preview is drawn from the same ten games the panel reads', () => {
  // The picture is generated, not committed — rule nº 5, the one that keeps this
  // repository free of a binaries folder. Rendering it needs a browser, so what
  // is checked here is the page that gets photographed, which needs nothing.
  const html = previewHTML(catalog.GAMES);
  for (const row of catalog.GAMES) {
    // Escaped, not raw: one of these games is called "Kings & Gears".
    check(html.includes(esc(row.name.en)), `the preview never names ${row.slug}`);
    check(html.includes(row.emoji), `the preview never draws ${row.slug}'s emoji`);
  }
  check(html.includes(`${catalog.GAMES.length} games`), 'the preview does not say how many games there are');
  // The one game that needs a connection wears the badge here too.
  check(html.includes('needs network'), 'the preview drops the badge the panel and the index both show');

  // Qt.darker divides HSV value; an eyeballed RGB scale is what makes a mock-up
  // look almost-but-not-quite like the shell.
  check(darker('#a9b1d6', 1.4) !== '#a9b1d6', 'darker() returned the colour unchanged');
  check(darker('#ffffff', 2) === '#808080', `darker('#ffffff', 2) came out ${darker('#ffffff', 2)}`);
});

scenario('a megabyte of PNG does not count against a text-scan limit', () => {
  // The per-file limit is 512 KB and the preview is about a megabyte. The
  // marketplace never reads it — .png is not in its scanned extensions — so
  // applying the limit to it would refuse a package it is happy with.
  check(!isScanned('preview.png'), 'preview.png would be treated as scanned text');
  check(isScanned('Panel.qml') && isScanned('Model.js'), 'the code has to be scanned');
  check(isScanned('LICENSE'), 'an extensionless file is pulled in by the marketplace snapshot');
  check(isScanned('README.md'), 'the root README is always scanned');
  check(!isScanned('manifest.json'), '.json is not in the scanned extension list');

  const summary = checkScanLimits([
    { name: 'preview.png', bytes: 4 * 1024 * 1024 },
    { name: 'Panel.qml', bytes: 13 * 1024 },
  ]);
  check(summary.files === 1, `${summary.files} files counted — the PNG should not be one of them`);
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
  check(model.dirFromUrl('file:///home/v/.config/omarchy/plugins/x/') === '/home/v/.config/omarchy/plugins/x',
    'the file:// prefix or the trailing slash survived');
  check(model.dirFromUrl('file:///home/v/my%20games/x') === '/home/v/my games/x',
    'a percent-encoded path came back encoded — the probe would then look for a directory called %20');
  // Panel.qml is at the root of the published plugin, so the folder QML reports
  // is the plugin folder — no walking up. Getting this wrong points candidate
  // two at the parent directory, which is silently never there.
  check(model.rootCandidates(model.dirFromUrl('file:///home/v/.config/omarchy/plugins/x/'), '', '/home/v')[0]
    === '/home/v/.config/omarchy/plugins/x/dist',
    'the plugin\'s own dist/ is not where the probe would look');
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

// After run(), not before: scenario() only registers, so the package has to
// still be on disk when run() actually executes them.
await run('omarchy plugin');
rmSync(PACKAGE, { recursive: true, force: true });
