// SCRATCH — bindText hazard auditor. Delete when done.
// Snapshot every [data-pt]/[data-en]/[data-t]/[data-*-attr] element's text and
// attributes, flip the language, snapshot again, diff.
import { launchBrowser, open, DEVICES, wait } from 'slopkit/testing';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const DIST = path.join(ROOT, 'dist');

const SNAP = () => {
  const ATTRS = ['title', 'placeholder', 'alt', 'aria-label', 'value', 'content'];
  const LANGS = ['en', 'pt'];
  const sel = [
    '[data-t]',
    ...LANGS.map((l) => `[data-${l}]`),
    ...ATTRS.map((a) => `[data-t-${a}]`),
    ...LANGS.flatMap((l) => ATTRS.map((a) => `[data-${l}-${a}]`)),
  ].join(',');
  const pathOf = (el) => {
    const bits = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== document.documentElement) {
      const p = n.parentNode;
      const i = p ? Array.prototype.indexOf.call(p.children, n) : 0;
      bits.unshift(`${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}[${i}]`);
      n = p;
    }
    return bits.join('>');
  };
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const rec = {
      path: pathOf(el),
      id: el.id || '',
      text: el.textContent,
      decl: {},
      attrs: {},
      declAttrs: {},
      visible: !!(el.getClientRects().length),
    };
    for (const l of LANGS) {
      const v = el.getAttribute(`data-${l}`);
      if (v !== null) rec.decl[l] = v;
    }
    rec.tKey = el.getAttribute('data-t') || null;
    for (const a of ATTRS) {
      for (const l of LANGS) {
        const v = el.getAttribute(`data-${l}-${a}`);
        if (v !== null) {
          rec.declAttrs[`${l}:${a}`] = v;
          rec.attrs[a] = el.getAttribute(a);
        }
      }
      const tk = el.getAttribute(`data-t-${a}`);
      if (tk) {
        rec.declAttrs[`t:${a}`] = tk;
        rec.attrs[a] = el.getAttribute(a);
      }
    }
    out.push(rec);
  }
  return out;
};

function diff(slug, state, a, b, langA, langB, tA, tB) {
  const rows = [];
  const byPath = new Map(b.map((r) => [r.path, r]));
  for (const before of a) {
    const after = byPath.get(before.path);
    if (!after) {
      rows.push(`  [GONE] ${before.path}`);
      continue;
    }
    // --- text ---
    const hasPair = Object.keys(before.decl).length > 0;
    if (hasPair) {
      const wantA = before.decl[langA];
      const wantB = after.decl[langB];
      const okA = wantA === undefined || before.text === wantA;
      const okB = wantB === undefined || after.text === wantB;
      if (!okA || !okB) {
        rows.push(
          `  [TEXT-MISMATCH] ${before.path} vis=${after.visible}\n` +
            `      on ${langA}: text=${JSON.stringify(before.text)} declared=${JSON.stringify(wantA)}\n` +
            `      on ${langB}: text=${JSON.stringify(after.text)} declared=${JSON.stringify(wantB)}`
        );
      }
    }
    if (before.tKey) {
      const wantA = tA[before.tKey];
      const wantB = tB[before.tKey];
      if (before.text !== wantA || after.text !== wantB) {
        rows.push(
          `  [DATA-T-MISMATCH] ${before.path} key=${before.tKey} vis=${after.visible}\n` +
            `      on ${langA}: text=${JSON.stringify(before.text)} t()=${JSON.stringify(wantA)}\n` +
            `      on ${langB}: text=${JSON.stringify(after.text)} t()=${JSON.stringify(wantB)}`
        );
      }
    }
    // --- attributes ---
    for (const [k, declared] of Object.entries(before.declAttrs)) {
      const [side, attr] = k.split(':');
      if (side === 't') {
        const wantA = tA[declared];
        const wantB = tB[declared];
        if (before.attrs[attr] !== wantA || after.attrs[attr] !== wantB) {
          rows.push(
            `  [ATTR-T-MISMATCH] ${before.path} @${attr} key=${declared}\n` +
              `      on ${langA}: ${JSON.stringify(before.attrs[attr])} vs t()=${JSON.stringify(wantA)}\n` +
              `      on ${langB}: ${JSON.stringify(after.attrs[attr])} vs t()=${JSON.stringify(wantB)}`
          );
        }
      } else if (side === langA) {
        if (before.attrs[attr] !== declared) {
          rows.push(
            `  [ATTR-MISMATCH] ${before.path} @${attr} on ${langA}: ` +
              `${JSON.stringify(before.attrs[attr])} declared=${JSON.stringify(declared)}`
          );
        }
      } else if (side === langB) {
        if (after.attrs[attr] !== declared) {
          rows.push(
            `  [ATTR-MISMATCH] ${before.path} @${attr} on ${langB}: ` +
              `${JSON.stringify(after.attrs[attr])} declared=${JSON.stringify(declared)}`
          );
        }
      }
    }
  }
  // elements that only appeared after
  const byPathA = new Set(a.map((r) => r.path));
  for (const after of b) if (!byPathA.has(after.path)) rows.push(`  [NEW] ${after.path}`);

  console.log(`\n--- ${slug} :: ${state} (${langA} -> ${langB}) : ${a.length} declared elements ---`);
  if (rows.length) console.log(rows.join('\n'));
  else console.log('  clean');
}

const browser = await launchBrowser();

async function audit(slug, state, g, drive) {
  if (drive) await drive(g);
  await g.setLang('en');
  await g.waitFrames(3);
  const a = await g.page.evaluate(SNAP);
  const tA = await g.exec((gm) => {
    const d = gm.i18n.dict, o = {};
    for (const k of Object.keys(d)) o[k] = gm.i18n.t(k);
    return o;
  });
  await g.setLang('pt');
  await g.waitFrames(3);
  const b = await g.page.evaluate(SNAP);
  const tB = await g.exec((gm) => {
    const d = gm.i18n.dict, o = {};
    for (const k of Object.keys(d)) o[k] = gm.i18n.t(k);
    return o;
  });
  diff(slug, state, a, b, 'en', 'pt', tA, tB);
}

// ---------------------------------------------------------------- boot state
for (const slug of ['zoo-magnata', 'skifree3d', 'worlddrive', 'animais-vs-monstros']) {
  const g = await open(browser, path.join(DIST, slug, 'index.html'), DEVICES.desktop, { bootWait: 2600 });
  await audit(slug, 'boot', g);
  g.expectNoErrors(slug);
  await g.close();
}

// index
{
  const g = await open(browser, path.join(DIST, 'index.html'), DEVICES.desktop, { bootWait: 1200 });
  await audit('index', 'boot', g);
  await g.close();
}

// ---------------------------------------------------- zoo, past the splash
{
  const g = await open(browser, path.join(DIST, 'zoo-magnata/index.html'), DEVICES.desktop, { bootWait: 2600 });
  await g.page.evaluate(() => document.querySelector('#btnStart').click());
  await wait(1500);
  await audit('zoo-magnata', 'IN GAME (past splash)', g);
  const pickerState = await g.page.evaluate(() => {
    const p = document.querySelector('[data-lang-picker]');
    const r = p.getBoundingClientRect();
    const cs = getComputedStyle(p);
    const splash = document.querySelector('#splash');
    return {
      splashHidden: splash.classList.contains('hidden'),
      splashDisplay: getComputedStyle(splash).display,
      splashPointer: getComputedStyle(splash).pointerEvents,
      pickerW: r.width, pickerH: r.height,
      pickerPointer: cs.pointerEvents, pickerVis: cs.visibility,
      buttons: p.querySelectorAll('button').length,
    };
  });
  console.log('\n--- zoo picker after leaving splash ---');
  console.log(JSON.stringify(pickerState, null, 2));
  await g.close();
}

// ---------------------------------------------------- skifree, in a run + over
{
  const g = await open(browser, path.join(DIST, 'skifree3d/index.html'), DEVICES.desktop, { bootWait: 3000 });
  await g.page.evaluate(() => document.querySelector('#btn-start').click());
  await wait(2500);
  await audit('skifree3d', 'IN RUN', g);
  const st = await g.page.evaluate(() => {
    const p = document.querySelector('[data-lang-picker]');
    const r = p.getBoundingClientRect();
    return { w: r.width, h: r.height, pointer: getComputedStyle(p).pointerEvents,
             menuDisplay: getComputedStyle(document.querySelector('#menu')).display };
  });
  console.log('\n--- skifree picker during a run ---\n' + JSON.stringify(st));
  await g.close();
}

// ---------------------------------------------------- worlddrive: loading screen
{
  const g = await open(browser, path.join(DIST, 'worlddrive/index.html'), DEVICES.desktop, { bootWait: 2500 });
  const st = await g.page.evaluate(() => {
    const p = document.querySelector('[data-lang-picker]');
    const r = p.getBoundingClientRect();
    return { w: r.width, h: r.height, pointer: getComputedStyle(p).pointerEvents, buttons: p.querySelectorAll('button').length };
  });
  console.log('\n--- worlddrive picker at menu ---\n' + JSON.stringify(st));
  await g.close();
}

await browser.close();
