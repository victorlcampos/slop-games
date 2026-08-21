#!/usr/bin/env node
// Copies the built catalog to where the plugin looks for it.
//
//   npm run build && npm run omarchy:install
//
// Why this exists at all: `omarchy plugin add` clones the repository and never
// builds it — it "never runs anything from the plugin, never executes an
// install hook" — so a fresh install has the ten game.json and none of the ten
// HTML files, and the panel falls back to the published site. That is fine, and
// the service worker there makes it offline after the first open.
//
// This is for the other case: you have the repository, you built it, and you
// want the plugin to open the files you just made instead of the internet. The
// destination is the third candidate in Model.rootCandidates(), so nothing has
// to be configured — the panel probes for it on every open.
//
// A copy, not a symlink: `omarchy plugin validate` refuses a symlink anywhere
// inside a plugin folder, and this lands next to one.

import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const TARGET = process.env.SLOP_GAMES_DIR || join(homedir(), '.local/share/slop-games');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('  ✗ no dist/index.html — run npm run build first');
  process.exit(1);
}

rmSync(TARGET, { recursive: true, force: true });
cpSync(DIST, TARGET, { recursive: true });

console.log(`  ✔ ${TARGET}`);
console.log('    The bar widget picks it up the next time you open it.\n');
