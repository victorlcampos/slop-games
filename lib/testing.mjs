// The test kit: a runner and the two stubs a game needs to run outside a
// browser. No puppeteer, no Chrome, no canvas — nothing here opens a window.
//
// It used to drive real Chrome. That went away when the runner turned out not
// to have a graphics card: with software WebGL a 3D game draws about one frame
// every three seconds, so any scenario that played the game measured the
// machine rather than the code (see CLAUDE.md, section 6). What is left is what
// was always doing the work — plain functions, called with plain arguments,
// answering in milliseconds.
//
//   import { scenario, check, run } from 'slopkit/testing';
//
//   scenario('the skier goes downhill', () => {
//     const p = createPlayer(new THREE.Group());
//     p.reset(0);
//     for (let t = 0; t < 2; t += 1 / 60) p.update(1 / 60, { ramps: [], colliders: [] });
//     check(p.state.travel > 10, `two seconds covered ${p.state.travel} m`);
//   });
//
//   await run('my game');

// -------------------------------------------------------------- the stubs

/**
 * A 2D context that accepts every call and draws nothing.
 *
 * Game logic and drawing live in the same modules here — a battle builds its
 * sprite cache the moment it is created — so a headless test needs somewhere
 * for those strokes to go. Everything answers, nothing is kept: the measurable
 * bits (`measureText`, `canvas`) return plausible numbers so a layout that
 * measures its own text still lands somewhere sensible.
 */
export function headlessContext(width = 300, height = 150) {
  const canvas = { width, height };
  const ctx = new Proxy(
    { canvas, measureText: (t) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8 }) },
    {
      get(target, key) {
        if (key in target) return target[key];
        // a gradient, a pattern, an image: whatever it is, it accepts more calls
        return (...args) => (key === 'createLinearGradient' || key === 'createRadialGradient'
          || key === 'createPattern' || key === 'getImageData'
          ? headlessContext(args[2] || 1, args[3] || 1)
          : undefined);
      },
      set() { return true; },
    }
  );
  return ctx;
}

/**
 * Puts the handful of browser globals a game touches at load onto `globalThis`,
 * and answers `document.createElement('canvas')` with something that has a 2D
 * context. Call it before importing the game's modules.
 *
 * It is deliberately thin: it is not a DOM, and a test that needs one is a test
 * about the DOM — which is the part that is checked by hand before a deploy.
 */
export function installHeadlessDom({ width = 1280, height = 720 } = {}) {
  const el = () => ({
    style: {}, dataset: {}, children: [], width, height,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, removeChild() {}, addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute: () => null, getBoundingClientRect: () => ({ x: 0, y: 0, width, height }),
    getContext(kind) { return kind === '2d' ? headlessContext(this.width, this.height) : null; },
  });

  const store = new Map();
  const g = globalThis;
  g.document ??= {
    createElement: el, getElementById: el, querySelector: el, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, body: el(), documentElement: el(),
    fonts: { ready: Promise.resolve() },
  };
  g.window ??= g;
  g.innerWidth ??= width;
  g.innerHeight ??= height;
  g.devicePixelRatio ??= 1;
  g.addEventListener ??= () => {};
  g.removeEventListener ??= () => {};
  g.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  g.requestAnimationFrame ??= () => 0;
  g.cancelAnimationFrame ??= () => {};
  g.navigator ??= { language: 'en', languages: ['en'] };
  g.localStorage ??= {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  return g;
}

// ------------------------------------------------------------- the runner

const cases = [];
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
    } catch (err) {
      failures++;
      console.log(`  ✗ ${c.name}`);
      console.log(`     ${String(err.message).split('\n').join('\n     ')}`);
    }
  }
  console.log(failures ? `\n  ${failures} of ${cases.length} failed\n` : `\n  ✔ ${cases.length} scenarios passed\n`);
  if (failures) process.exitCode = 1;
  return failures === 0;
}
