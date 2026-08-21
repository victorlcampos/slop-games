#!/usr/bin/env node
// Writes omarchy/Catalog.js — the ten games, in two languages, as QML can read
// them.
//
//   node omarchy/build.mjs        (npm run omarchy)
//
// The root build calls writeCatalog() with the catalog it has already validated,
// so `npm run build` keeps this file in step without reading game.json twice.
// Run standalone it reads them itself, which is what makes the generator usable
// on its own — and what test/omarchy.test.mjs leans on.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCatalog } from './catalog.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

export const CATALOG_FILE = join(HERE, 'Catalog.js');

/** Every games/<slug>/game.json, unvalidated — the root build does that part. */
export function readGames(root = ROOT) {
  const games = join(root, 'games');
  return readdirSync(games)
    .filter((slug) => {
      try {
        return statSync(join(games, slug, 'game.json')).isFile();
      } catch {
        return false;
      }
    })
    .map((slug) => JSON.parse(readFileSync(join(games, slug, 'game.json'), 'utf8')));
}

/** Returns true when the file on disk changed, so the build can say so. */
export function writeCatalog(games = readGames()) {
  const next = renderCatalog(games);
  let current = '';
  try {
    current = readFileSync(CATALOG_FILE, 'utf8');
  } catch {
    /* first run */
  }
  if (current === next) return false;
  writeFileSync(CATALOG_FILE, next, 'utf8');
  return true;
}

// Only when run directly — importing this from the root build must not write.
if (process.argv[1] && process.argv[1].endsWith('omarchy/build.mjs')) {
  const games = readGames();
  const changed = writeCatalog(games);
  console.log(`  ✔ omarchy/Catalog.js  (${games.length} games${changed ? '' : ', unchanged'})`);
}
