// Game testing kit: opens the HTML over file://, drives the game and checks the
// result. Runs in Node with puppeteer-core and the system Chrome.
//
// Two things here exist because of scars:
//
// 1. `at()` turns a logical game coordinate into a screen coordinate. Doing that
//    sum by eye (width/1280) failed twice during development — once because the
//    canvas was centred with bars, once because the logical width became
//    elastic. The test chased a game bug that was a test bug. Here the numbers
//    always come from the game itself.
//
// 2. `open()` collects pageerror and console.error from before the load. An
//    error thrown during boot never shows up if you register the listener after.
//
//   const g = await open(browser, file, DEVICES.desktop);
//   await g.exec((game) => game.goToLevel(3));
//   await g.tap(...g.at(640, 400));
//   g.expectNoErrors();

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Find the machine's Chrome. `puppeteer-core` doesn't download a browser — which
 * is exactly what keeps this repo light — so somebody has to say where it is.
 * The order covers a developer's machine and a CI runner with no configuration.
 */
export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) if (existsSync(c)) return c;

  // last resort: ask the PATH
  for (const name of ['google-chrome', 'chromium', 'chrome']) {
    try {
      const found = execSync(`command -v ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      if (found) return found;
    } catch {
      /* not on the PATH */
    }
  }

  throw new Error(
    "couldn't find Chrome. Install Google Chrome or point at the binary:\n" +
      '  CHROME=/path/to/chrome npm test'
  );
}

export const CHROME = process.env.CHROME || null;

export const DEVICES = {
  desktop: { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, hasTouch: false, isMobile: false },
  ultrawide: { name: 'ultrawide', width: 2560, height: 1080, deviceScaleFactor: 1, hasTouch: false, isMobile: false },
  retina: { name: 'retina', width: 1440, height: 900, deviceScaleFactor: 2, hasTouch: false, isMobile: false },
  phone: { name: 'phone landscape', width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  phonePortrait: { name: 'phone portrait', width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  tablet: { name: 'tablet', width: 1180, height: 820, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};

export async function launchBrowser(options = {}) {
  const onCI = !!process.env.CI;
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: [
      '--touch-events=enabled',
      '--mute-audio',
      '--no-first-run',
      // On CI: no sandbox (the runner is root) and software WebGL.
      // Careful with `--disable-gpu` here — it takes WebGL down with it, and the
      // 3D games then create no context at all: the test reports "no canvas" as
      // if the game were broken. SwiftShader renders on the CPU and fixes it.
      ...(onCI
        ? [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ]
        : []),
      ...(options.args || []),
    ],
    ...options,
  });
}

/**
 * Open the game and return a handful of conveniences around the page.
 *
 * @param {string} file absolute path to index.html
 * @param {object} device one of DEVICES
 * @param {object} options { bridge: name of the global the game exposes }
 */
export async function open(browser, file, device = DEVICES.desktop, options = {}) {
  // `clearData` defaults to true on purpose: every file:// page shares one
  // localStorage, so without it a scenario inherits the previous one's save and
  // passes (or fails) for reasons that have nothing to do with what it tests.
  const { bridge = '__game', bootWait = 500, clearData = true } = options;
  const page = await browser.newPage();
  const errors = [];

  // A page left open keeps rendering. With software WebGL that is not a leak,
  // it is a brake on everything that comes next: one failed 3D scenario, whose
  // `close()` never ran, starved the four after it until even `goto` timed out.
  // The runner closes whatever is still open when a scenario ends.
  openPages.add(page);
  page.once('close', () => openPages.delete(page));

  // On CI Chrome renders in software: the first paint of a 3D game takes long
  // enough that the default 30 s can expire on the navigation alone.
  if (process.env.CI) {
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(90000);
  }

  // before the goto: a boot error counts too
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('console: ' + m.text());
  });

  await page.setViewport({
    width: device.width,
    height: device.height,
    deviceScaleFactor: device.deviceScaleFactor,
    hasTouch: device.hasTouch,
    isMobile: device.isMobile,
    isLandscape: device.width > device.height,
  });
  await page.goto('file://' + file, { waitUntil: 'load' });
  if (clearData) {
    // clear and reload: the game has to boot with empty storage, otherwise it
    // already loaded the previous scenario's save before we wiped it.
    // The reload only happens when there WAS something to clear — a boot of a
    // 3D game under software WebGL costs a dozen seconds, and paying it twice
    // per scenario to wipe a storage nobody wrote to is a dozen seconds a
    // scenario for nothing.
    const had = await page.evaluate(() => {
      try {
        const n = localStorage.length + sessionStorage.length;
        localStorage.clear();
        sessionStorage.clear();
        return n;
      } catch {
        return 0; /* storage blocked: nothing to clear, nothing to reload for */
      }
    });
    if (had) {
      errors.length = 0;
      await page.reload({ waitUntil: 'load' });
    }
  }
  await wait(bootWait);

  /** Canvas rectangle and logical scale, read from the game itself. */
  async function metrics() {
    return page.evaluate((bridgeName) => {
      const c = document.querySelector('canvas');
      const r = c ? c.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
      const g = window[bridgeName];
      const vp = g && (g.viewport || g.vp);
      return {
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        // if the game doesn't expose its viewport, fall back to the canvas size
        W: (vp && vp.W) || (c && c.width) || r.width,
        H: (vp && vp.H) || (c && c.height) || r.height,
      };
    }, bridge);
  }

  let m = await metrics();

  const game = {
    page,
    errors,
    device,

    /** Re-read the rectangle — call after rotating or resizing. */
    async remeasure() {
      m = await metrics();
      return m;
    },

    /**
     * Logical game coordinate → screen coordinate to click or tap.
     * Spread `...game.at(x, y)` straight into the mouse/touch methods.
     */
    at(x, y) {
      return [m.rect.x + (x / m.W) * m.rect.w, m.rect.y + (y / m.H) * m.rect.h];
    },

    /**
     * The same, for content drawn on a fixed-size board (menu screens). The
     * board centres when the viewport is bigger and **shrinks** when it is
     * smaller — a 16:10 monitor gives 1152 of logical width, below the 1280 of
     * board. Ignoring that shrink makes the tap land in the wrong place.
     */
    atFrame(x, y, frame = 1280, frameHeight = 720) {
      const k = Math.min(1, m.W / frame);
      return game.at((m.W - frame * k) / 2 + x * k, (m.H - frameHeight * k) / 2 + y * k);
    },

    get width() {
      return m.W;
    },
    get height() {
      return m.H;
    },

    /** Clicks or taps, depending on the device. */
    async tap(x, y) {
      if (device.hasTouch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await wait(120);
    },

    /** Dragging: on touch it is the game's main gesture. */
    async drag(from, to, steps = 6) {
      const [x1, y1] = from;
      const [x2, y2] = to;
      const touch = device.hasTouch;
      if (touch) await page.touchscreen.touchStart(x1, y1);
      else await page.mouse.move(x1, y1), await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        const x = x1 + ((x2 - x1) * i) / steps;
        const y = y1 + ((y2 - y1) * i) / steps;
        if (touch) await page.touchscreen.touchMove(x, y);
        else await page.mouse.move(x, y);
        await wait(50);
      }
      if (touch) await page.touchscreen.touchEnd();
      else await page.mouse.up();
      await wait(150);
    },

    /** Run a function inside the game, receiving the bridge as its argument. */
    exec(fn, ...args) {
      return page.evaluate(
        (bridgeName, body, extras) => {
          // eslint-disable-next-line no-new-func
          const f = new Function(
            'game',
            ...extras.map((_, i) => 'a' + i),
            `return (${body})(game, ${extras.map((_, i) => 'a' + i).join(', ')})`
          );
          return f(window[bridgeName], ...extras);
        },
        bridge,
        fn.toString(),
        args
      );
    },

    /** Flip the game's language through its bridge. */
    async setLang(lang) {
      const ok = await game.exec((g, l) => {
        if (!g || !g.i18n) return false;
        g.i18n.set(l);
        return g.i18n.lang === l;
      }, lang);
      if (!ok) throw new Error(`the game doesn't expose i18n on its bridge — can't switch to "${lang}"`);
      return game.waitFrames(2);
    },

    wait,

    /**
     * Wait for the game to draw N frames. It is the honest way to say "let the
     * screen show up": a lot of things (the list of clickable buttons, for one)
     * only exist after the first draw, and sleeping a fixed time is a bet on
     * machine speed — on CI, Chrome renders in software and takes much longer
     * than your laptop.
     *
     * Requires `frames()` on the game's bridge; without it, falls back to a
     * short sleep.
     *
     * The default budget follows the number of frames asked for, and doubles on
     * CI. A flat 4 s was itself a bet on machine speed: `waitFrames(30)` needs
     * 7.5 fps to fit in it, which a busy runner does not always have, and the
     * scenario then failed for the one reason this helper exists to remove.
     */
    async waitFrames(n = 2, timeout = (process.env.CI ? 800 : 400) * Math.max(n, 5)) {
      const hasCounter = await game.exec((g) => typeof g.frames === 'function');
      if (!hasCounter) return wait(200);
      const start = await game.exec((g) => g.frames());
      return game.waitUntil((g, target) => g.frames() >= target, {
        timeout,
        what: `the game to draw ${n} frames`,
        args: [start + n],
      });
    },

    /**
     * Wait for a condition to come true inside the game, instead of guessing a
     * `sleep`. A test that sleeps a fixed time passes on your machine and fails
     * on CI — or, worse, passes alone and fails inside the suite.
     *
     * A predicate that throws counts as "not yet": right after a reload the
     * bridge does not exist, and `() => g.game.state.phase` is a TypeError for
     * the first few hundred milliseconds. Waiting for something to appear is
     * the whole point — the timeout is what reports the failure.
     */
    async waitUntil(fn, { timeout = 4000, interval = 100, what = 'the condition', args = [] } = {}) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        try {
          if (await game.exec(fn, ...args)) return true;
        } catch {
          /* not there yet */
        }
        await wait(interval);
      }
      throw new Error(`waited ${timeout}ms and ${what} never happened`);
    },

    async screenshot(file) {
      await page.screenshot({ path: file });
      return file;
    },

    /** Fail the test if any error showed up in the console or on the page. */
    expectNoErrors(label = '') {
      if (errors.length) {
        const head = errors.slice(0, 6).join('\n  ');
        throw new Error(`${label || 'the game'} threw ${errors.length} error(s):\n  ${head}`);
      }
    },

    close: () => page.close(),
  };

  return game;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// -------------------------------------------------------- mini test runner

const cases = [];
const openPages = new Set();
let current = null;

export function scenario(name, fn) {
  cases.push({ name, fn });
}

export function check(condition, message) {
  if (!condition) throw new Error(message || 'condition was false');
  if (current) current.checks++;
}

export function checkEqual(received, expected, message) {
  const a = JSON.stringify(received);
  const b = JSON.stringify(expected);
  check(a === b, `${message || 'values differ'}\n     expected: ${b}\n     received: ${a}`);
}

/** A file name from a scenario's name: what the CI artifact is called. */
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/**
 * Photograph and close whatever the scenario left open. The screenshot is the
 * artifact CI uploads on failure — it says in one second what the log doesn't
 * say in twenty — and the close is what keeps one failure from slowing every
 * scenario after it.
 */
async function closeLeftovers(shot) {
  // beside the test file that is running, whether it was started from the
  // repository root or from the game's own folder — that is the path CI globs
  const dir = process.argv[1] ? path.dirname(process.argv[1]) : process.cwd();
  let i = 0;
  for (const page of [...openPages]) {
    try {
      if (shot && !page.isClosed()) {
        await page.screenshot({ path: path.join(dir, `${shot}${i++ ? '-' + i : ''}.png`) });
      }
    } catch {
      /* a screenshot is a bonus, never the reason a run stops */
    }
    try {
      if (!page.isClosed()) await page.close();
    } catch {
      /* already gone */
    }
    openPages.delete(page);
  }
}

/** Run everything registered with `scenario`. Exits with code 1 on failure. */
export async function run(title = 'tests') {
  console.log(`\n  ${title}\n`);
  let failures = 0;
  for (const c of cases) {
    current = { checks: 0 };
    const t0 = Date.now();
    try {
      await c.fn();
      console.log(`  ✓ ${c.name}  (${current.checks} checks, ${Date.now() - t0}ms)`);
      await closeLeftovers(null);
    } catch (err) {
      failures++;
      console.log(`  ✗ ${c.name}`);
      console.log(`     ${String(err.message).split('\n').join('\n     ')}`);
      await closeLeftovers(slugify(c.name));
    }
  }
  console.log(failures ? `\n  ${failures} of ${cases.length} failed\n` : `\n  ✔ ${cases.length} scenarios passed\n`);
  if (failures) process.exitCode = 1;
  return failures === 0;
}
