#!/usr/bin/env node
// Assembles the Omarchy plugin's own repository into dist-omarchy/.
//
//   npm run omarchy:publish
//
// Why the plugin has a repository of its own, when it started as this one:
// `omarchy plugin add` clones whatever URL it is given, and the marketplace
// runs a static scan over that clone. This repository is a pile of games, and one of
// them — SkiFree — carries a vendored three.js of 1.3 MB. The marketplace scan
// refuses any scanned file over 512 KB and fails closed, so a file that is not
// part of the plugin, never read by it, and only in the clone by accident of
// living in the same repository, sank the listing. It also meant anyone adding
// a bar widget cloned 16 MB of games to get four files.
//
// So the plugin ships as its own repository and this one stays its source. The
// package is built from an explicit list — nothing lands there by being in the
// right folder — and the size guard below is the lesson, kept as code.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPreview } from './preview.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

export const PACKAGE_DIR = join(ROOT, 'dist-omarchy');

/** Where the published plugin lives. The catalog links to it; the tests read it. */
export const PLUGIN_REPO = 'https://github.com/victorlcampos/omarchy-slop-games';

/**
 * What goes in, as `[source, name in the package]`.
 *
 * An explicit list, not a folder copy: omarchy/ also holds the generator, the
 * installer and this file, and a plugin folder that carries build scripts it
 * never runs is a plugin folder nobody can audit at a glance.
 */
export const PLUGIN_FILES = [
  [join(HERE, 'manifest.json'), 'manifest.json'],
  [join(HERE, 'Panel.qml'), 'Panel.qml'],
  [join(HERE, 'Model.js'), 'Model.js'],
  [join(HERE, 'Catalog.js'), 'Catalog.js'],
  [join(HERE, 'README.md'), 'README.md'],
  [join(ROOT, 'LICENSE'), 'LICENSE'],
];

// The marketplace's static-scan limits, mirrored from its own
// scripts/security-baseline-limits.mjs. A scan that hits any of them does not
// warn — it fails the submission, days later, on somebody else's queue.
export const SCAN_FILE_BYTE_LIMIT = 512 * 1024;
export const SCAN_TOTAL_BYTE_LIMIT = 8 * 1024 * 1024;
export const SCAN_FILE_COUNT_LIMIT = 1000;

/**
 * Which files the marketplace actually reads, mirroring its
 * `isSecurityScanPath` plus the two extra ways its snapshot pulls a file in.
 *
 * It matters here because the preview is a megabyte of PNG and the per-file
 * limit is half that — applying the limit to everything would refuse a package
 * the marketplace is perfectly happy with. Text is scanned; an image is not.
 */
const SCANNED_EXTENSIONS = new Set([
  '.bash', '.cjs', '.desktop', '.fish', '.js', '.lua', '.mjs', '.pl', '.py',
  '.qml', '.rb', '.service', '.sh', '.sudoers', '.toml', '.yaml', '.yml', '.zsh',
]);

export function isScanned(name) {
  if (/^readme(\.[^/]+)?$/i.test(name)) return true;   // the root README always is
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return true;                            // extensionless, e.g. LICENSE
  return SCANNED_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/** Throws if the assembled package would fail the marketplace's static scan. */
export function checkScanLimits(all) {
  const files = all.filter((f) => isScanned(f.name));
  const oversized = files.filter((f) => f.bytes > SCAN_FILE_BYTE_LIMIT);
  if (oversized.length) {
    throw new Error(
      `these files are over the marketplace's ${SCAN_FILE_BYTE_LIMIT / 1024} KB per-file scan limit: ` +
        oversized.map((f) => `${f.name} (${Math.round(f.bytes / 1024)} KB)`).join(', ')
    );
  }
  if (files.length > SCAN_FILE_COUNT_LIMIT) {
    throw new Error(`${files.length} files — the marketplace scans at most ${SCAN_FILE_COUNT_LIMIT}`);
  }
  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  if (total > SCAN_TOTAL_BYTE_LIMIT) {
    throw new Error(`${Math.round(total / 1024)} KB — the marketplace scans at most ${SCAN_TOTAL_BYTE_LIMIT / 1024} KB`);
  }
  return { files: files.length, bytes: total };
}

/**
 * Writes dist-omarchy/ and returns what landed in it.
 *
 * `preview: false` skips the screenshot, which is what the test wants: the
 * renderer needs a browser on the machine and the listing is valid without one.
 */
export function publish(target = PACKAGE_DIR, { preview = false } = {}) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  const written = PLUGIN_FILES.map(([source, name]) => {
    cpSync(source, join(target, name));
    return { name, bytes: statSync(join(target, name)).size };
  });

  if (preview) {
    const made = renderPreview(join(target, 'preview.png'));
    if (made) written.push({ name: 'preview.png', bytes: made.bytes });
  }

  // Belt and braces: measure what is really on disk, not what we meant to put
  // there, and refuse to hand over a package that would be rejected.
  const present = readdirSync(target).map((name) => ({ name, bytes: statSync(join(target, name)).size }));
  checkScanLimits(present);
  return written;
}

if (process.argv[1] && process.argv[1].endsWith('omarchy/publish.mjs')) {
  const written = publish(PACKAGE_DIR, { preview: true });
  const kb = (n) => (n / 1024).toFixed(1);
  for (const file of written) console.log(`  ${kb(file.bytes).padStart(7)} KB  ${file.name}`);
  if (!written.some((f) => f.name === 'preview.png')) {
    console.log('    ⚠ no Chrome or Chromium here — published without a preview');
  }
  console.log(`\n  ✔ dist-omarchy/  (${written.length} files)`);
  console.log(`    Push it to ${PLUGIN_REPO} — see omarchy/README.md.\n`);
}
