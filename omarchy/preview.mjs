#!/usr/bin/env node
// Draws the marketplace preview — the panel as it sits on an Omarchy bar.
//
//   npm run omarchy:publish      (renders it into dist-omarchy/preview.png)
//
// Rule nº 5 of this repository is that assets are made by code, and that is why
// there is not one image in git. A marketplace listing wants a picture, so this
// generates one instead of committing one: the layout below is the panel's own
// geometry, the colours are Omarchy's Tokyo Night theme read off its own
// colors.toml, and the rows come from Catalog.js — the same file the panel
// reads, so the preview cannot advertise a game that is not there.
//
// It is a rendering, not a photograph. The honest thing it buys over a mock-up
// is that every number in it — font sizes, spacings, the 420px content width —
// is the number Panel.qml uses, and `Qt.darker` is reimplemented rather than
// eyeballed, so the greys are the greys the shell paints.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Omarchy's Tokyo Night, from themes/tokyo-night/colors.toml. */
export const THEME = {
  background: '#1a1b26',
  darker: '#0e0e14',
  lighter: '#24283b',
  foreground: '#a9b1d6',
  dim: '#565f89',
  accent: '#7aa2f7',
  green: '#9ece6a',
  yellow: '#e0af68',
  red: '#f7768e',
};

/**
 * Qt.darker, which the panel uses for every secondary line.
 *
 * It divides HSV value by the factor — not RGB, which is what an eyeballed
 * "make it 30% darker" does and why hand-picked greys never quite match.
 */
export function darker(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / factor;
  const s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const seg = Math.floor(h / 60) % 6;
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  return '#' + rgb.map((u) => Math.round((u + m) * 255).toString(16).padStart(2, '0')).join('');
}

/** Every game, read from the file the panel itself reads. */
export function readCatalog(dir = HERE) {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(join(dir, 'Catalog.js'), 'utf8'), context, { filename: 'Catalog.js' });
  return context.GAMES;
}

/** Exported because the test asserts against the escaped text, not the raw name:
 *  one game here is called "Kings & Gears". */
export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** nf-fa-gamepad as a path, because the Nerd Font is not installed everywhere. */
const GAMEPAD = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M17.5 6h-11A5.5 5.5 0 0 0 1 11.5v1A4.5 4.5 0 0 0 5.5 17c1.3 0 2-.6 2.8-1.4l.7-.7c.3-.3.7-.4 1-.4h4c.3 0 .7.1 1 .4l.7.7c.8.8 1.5 1.4 2.8 1.4a4.5 4.5 0 0 0 4.5-4.5v-1A5.5 5.5 0 0 0 17.5 6ZM8 12.6H6.6V14H5.2v-1.4H3.8v-1.4h1.4V9.8h1.4v1.4H8v1.4Zm7.6 1.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm2.4-3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z"/>
</svg>`;

/**
 * The page that gets photographed.
 *
 * Every measurement is Panel.qml's: contentWidth 420, popupPadding 14, column
 * spacing 12, rowPaddingX 12, and the font scale where body is 12px.
 */
export function previewHTML(games, { lang = 'en' } = {}) {
  const fg = THEME.foreground;
  const rows = games.map((game, i) => {
    // One row wears the keyboard cursor, because a panel photographed with
    // nothing selected does not show that it has one.
    const cursor = i === 2;
    const badge = game.offline
      ? ''
      : `<span class="badge">needs network</span>`;
    return `<div class="row${cursor ? ' cursor' : ''}">
      <span class="emoji">${esc(game.emoji)}</span>
      <span class="text">
        <span class="name">${esc(game.name[lang])}${badge}</span>
        <span class="blurb">${esc(game.blurb[lang])}</span>
      </span>
    </div>`;
  }).join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1000px; height: 800px; overflow: hidden; }
  body {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
    /* the wallpaper: a dark Tokyo Night wash, so the panel is read against
       something, the way it is on a desktop */
    background:
      radial-gradient(700px 520px at 22% 18%, #2a3050 0%, transparent 70%),
      radial-gradient(600px 520px at 4% 96%, #1d2a44 0%, transparent 68%),
      linear-gradient(150deg, #171a2b 0%, ${THEME.darker} 68%);
    color: ${fg};
    -webkit-font-smoothing: antialiased;
  }

  /* ---- the bar: 26px tall, which is Style.bar.sizeHorizontal ---- */
  .bar {
    height: 26px; display: flex; align-items: center; gap: 18px;
    padding: 0 10px; background: ${THEME.background}; font-size: 12px;
  }
  .bar .spacer { flex: 1; }
  .ws { display: flex; gap: 7px; color: ${darker(fg, 1.6)}; }
  .ws b { color: ${fg}; font-weight: 600; }
  .slot { display: flex; align-items: center; gap: 6px; color: ${fg}; }
  .slot svg { width: 14px; height: 14px; }
  .slot.open { color: ${THEME.accent}; }

  /* ---- the panel ---- */
  .panel {
    position: absolute; top: 31px; right: 5px;   /* Style.gapsOut = 5 */
    width: 448px;                                 /* 420 content + 14 padding each side */
    padding: 14px;
    background: ${THEME.background};
    border: 2px solid ${THEME.accent};
    display: flex; flex-direction: column; gap: 12px;
    box-shadow: 0 18px 50px rgba(0,0,0,.55);
  }

  .hero { display: flex; align-items: center; gap: 14px; }
  .hero svg { width: 24px; height: 24px; color: ${fg}; }
  .hero .title { font-size: 14px; font-weight: 700; }
  .hero .sub { font-size: 10px; color: ${darker(fg, 1.4)}; margin-top: 2px; }

  .rule { height: 1px; background: ${fg}1f; }

  .list { display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; }
  .row.cursor { background: ${fg}14; border: 1px solid ${fg}40; padding: 5px 7px; }
  .emoji { font-size: 16px; line-height: 1; width: 20px; text-align: center; }
  .text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
  .name { font-size: 11px; font-weight: 700; display: flex; align-items: baseline; gap: 6px; }
  .badge { font-size: 10px; font-weight: 400; color: ${darker(fg, 1.6)}; }
  .blurb {
    font-size: 10px; color: ${darker(fg, 1.5)}; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }

  .cta {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 11px; padding: 7px; border: 1px solid ${fg}66;
  }
  .cta svg { width: 12px; height: 12px; }

  .foot { display: flex; align-items: center; justify-content: space-between; }
  .foot .where { font-size: 10px; color: ${darker(fg, 1.4)}; }
  .foot .hint { font-size: 10px; color: ${darker(fg, 1.8)}; margin-top: 2px; }
  .flags { display: flex; gap: 6px; }
  .flag { font-size: 10px; padding: 3px 8px; border: 1px solid ${fg}66; }
  .flag.on { background: ${fg}2e; }
</style>

<div class="bar">
  <span class="ws"><b>1</b><span>2</span><span>3</span></span>
  <span class="spacer"></span>
  <span class="slot">Fri 21 Aug 11:42</span>
  <span class="spacer"></span>
  <span class="slot open">${GAMEPAD}</span>
  <span class="slot">98%</span>
</div>

<div class="panel">
  <div class="hero">
    ${GAMEPAD}
    <div>
      <div class="title">slop-games</div>
      <div class="sub">${games.length} games · one HTML file each</div>
    </div>
  </div>

  <div class="rule"></div>
  <div class="list">
${rows}
  </div>
  <div class="rule"></div>

  <div class="cta">Open the catalog</div>

  <div class="foot">
    <div>
      <div class="where">playing from the web</div>
      <div class="hint">↑↓ pick · ⏎ play</div>
    </div>
    <div class="flags"><span class="flag on">EN</span><span class="flag">PT</span></div>
  </div>
</div>
`;
}

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

/**
 * The browser that takes the picture, or null when there is none to be had.
 *
 * `CHROME_PATH` is honoured first because the machine most likely to be missing
 * a system Chrome is the one that has a perfectly good headless one sitting in
 * a Playwright cache — and skipping the listing's picture on a machine that
 * could take it is a worse default than looking in one more place.
 */
export function findChrome(env = process.env) {
  if (env.CHROME_PATH && existsSync(env.CHROME_PATH)) return env.CHROME_PATH;
  return CHROME.find((path) => existsSync(path)) || null;
}

/**
 * Renders the preview to `out`. Returns null when there is no picture to be
 * had — the listing works without one (the marketplace falls back to its own),
 * so this is a skipped step, not a failed publish.
 *
 * That "not a failed publish" has to hold for a browser that is *there and does
 * not work*, not only for a browser that is missing. A container running as
 * root has a Chromium that refuses to start, and letting it throw took the
 * whole package down over a picture the marketplace was willing to supply.
 */
export function renderPreview(out, { games = readCatalog(), scale = 2 } = {}) {
  const chrome = findChrome();
  if (!chrome) return null;

  const box = mkdtempSync(join(tmpdir(), 'slop-preview-'));
  try {
    const page = join(box, 'preview.html');
    writeFileSync(page, previewHTML(games), 'utf8');
    execFileSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      // Chromium refuses to run as root without this, and says so on stderr we
      // are not reading. Only as root: nobody else should be handing it out.
      ...(typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : []),
      `--force-device-scale-factor=${scale}`,
      '--window-size=1000,800',
      `--screenshot=${out}`,
      `file://${page}`,
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch {
    return null;
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
  return existsSync(out) ? { bytes: statSync(out).size, width: 1000 * scale, height: 800 * scale } : null;
}

if (process.argv[1] && process.argv[1].endsWith('omarchy/preview.mjs')) {
  const out = process.argv[2] || join(HERE, '..', 'dist-omarchy', 'preview.png');
  const made = renderPreview(out);
  console.log(made
    ? `  ✔ ${out}  (${made.width}×${made.height}, ${(made.bytes / 1024).toFixed(0)} KB)`
    : '  ⚠ no Chrome or Chromium found — the listing will use the marketplace fallback preview');
}
