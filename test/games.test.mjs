// What every game in the catalog has to deliver, whatever the technology.
//
// Each game can (and should) have its own test in `games/<slug>/test/`,
// exercising its own play. This one is the floor: if it fails, the game is
// broken for whoever opened the file, whatever else it does.

import { launchBrowser, open, DEVICES, scenario, check, run, wait } from 'slopkit/testing';
import { missingKeys } from 'slopkit';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const catalog = readdirSync(path.join(ROOT, 'games'))
  .filter((slug) => {
    try {
      return statSync(path.join(ROOT, 'games', slug, 'game.json')).isFile();
    } catch {
      return false;
    }
  })
  .map((slug) => JSON.parse(readFileSync(path.join(ROOT, 'games', slug, 'game.json'), 'utf8')));

const browser = await launchBrowser();

for (const game of catalog) {
  const file = path.join(DIST, game.slug, 'index.html');
  const label = `${game.emoji} ${game.name.en}`;

  scenario(`${label}: opens over file:// and draws`, async () => {
    check(existsSync(file), `${game.slug}: no dist — run npm run build`);
    const g = await open(browser, file, DEVICES.desktop, { bootWait: 2200 });
    const painted = await g.page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { error: 'no canvas' };
      return { error: null, w: c.width, h: c.height, title: document.title };
    });
    check(!painted.error, `${game.slug}: ${painted.error}`);
    check(painted.w > 0 && painted.h > 0, `${game.slug}: canvas with zero size`);
    check(!!painted.title, `${game.slug}: page with no <title>`);
    g.expectNoErrors(game.slug);
    await g.close();
  });

  scenario(`${label}: is one file, fetching nothing from outside`, async () => {
    const html = readFileSync(file, 'utf8');
    const external =
      html.match(/<script\b[^>]*\bsrc=["']?(?!data:)[^"'>\s]+/i) ||
      html.match(/<link\b[^>]*\bstylesheet[^>]*\bhref=["']?(?!data:)[^"'>\s]+/i);
    check(!external, `${game.slug}: loads an external resource (${external && external[0].slice(0, 50)})`);
  });

  scenario(`${label}: fills the screen at any ratio`, async () => {
    for (const device of [DEVICES.desktop, DEVICES.phone]) {
      const g = await open(browser, file, device, { bootWait: 1800 });
      const m = await g.page.evaluate(() => {
        const c = document.querySelector('canvas');
        const r = c.getBoundingClientRect();
        // upright, some games hide the canvas and ask for a turn: that counts
        const hidden = r.width === 0 && r.height === 0;
        return { hidden, w: r.width, h: r.height, ww: window.innerWidth, wh: window.innerHeight };
      });
      if (!m.hidden) {
        const spareH = m.wh - m.h;
        const spareW = m.ww - m.w;
        check(
          spareH <= m.wh * 0.15 && spareW <= m.ww * 0.15,
          `${game.slug} on ${device.name}: ${Math.round(spareW)}x${Math.round(spareH)}px of border left over`
        );
      }
      await g.close();
    }
  });
}

scenario('rotating the device does not break touch', async () => {
  // The symptom that motivated this test: open upright, rotate, and the game
  // stops answering the finger — while whoever opened it already in landscape
  // played normally.
  const g = await open(browser, path.join(DIST, 'animais-vs-monstros/index.html'), DEVICES.phonePortrait, {
    bootWait: 900,
  });
  await g.page.setViewport({
    width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true,
  });
  await wait(700);

  const m = await g.page.evaluate(() => {
    const v = window.__game.viewport;
    return {
      scale: +v.scale.toFixed(3),
      expected: +(window.innerHeight / 720).toFixed(3),
      overlay: getComputedStyle(document.getElementById('rotate')).pointerEvents,
    };
  });
  check(
    m.scale === m.expected,
    `after rotating the scale became ${m.scale}, it should be ${m.expected} — the touch would land in the wrong place`
  );
  check(m.overlay === 'none', 'the rotate notice must not intercept touch when it disappears');
  await g.close();
});

scenario('the catalog is installable and its scope covers the games', async () => {
  const g = await open(browser, path.join(DIST, 'index.html'), DEVICES.phone, { bootWait: 900 });
  const m = await g.page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return { error: 'the index has no manifest' };
    let man;
    try {
      man = await (await fetch(link.href)).json();
    } catch (e) {
      return { error: 'unreadable manifest: ' + e.message };
    }
    return {
      error: null,
      name: man.name,
      scope: man.scope,
      start: man.start_url,
      display: man.display,
      icons: (man.icons || []).length,
      ios: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
    };
  });
  check(!m.error, String(m.error));
  check(m.scope === './', `scope "${m.scope}" has to cover the games' subfolders`);
  check(m.display === 'standalone', `display is "${m.display}"`);
  check(m.icons >= 2, 'it needs a 192 and a 512 icon');
  check(m.ios, "the meta iOS Safari uses is missing");
  g.expectNoErrors('catalog');
  await g.close();
});

scenario('every game has an exit to the catalog on its home screen', async () => {
  for (const game of catalog) {
    const html = readFileSync(path.join(DIST, game.slug, 'index.html'), 'utf8');
    // The injected activator mentions `__catalog` itself, so searching the whole
    // file always finds it — and a game whose exit rotted would still pass. Cut
    // the activator out first and ask what the *game* offers.
    const own = html.replace(/window\.__catalog = '\.\.\/index\.html';[\s\S]*?<\/script>/, '');
    const hasDom = own.includes('data-back-to-catalog');
    const hasCanvas = own.includes('__catalog');
    check(
      hasDom || hasCanvas,
      `${game.slug}: no exit to the catalog — in app mode there is no browser chrome and the player is stuck`
    );
    // the definition, not the read: Animals reads `window.__catalog` in its own
    // code, and that is not the same as the catalog having switched the exit on
    check(
      html.includes("window.__catalog = '../index.html'"),
      `${game.slug}: the catalog build did not switch the exit on`
    );
  }

  // the game's file outside the catalog gets no activator, so nothing shows up
  const loose = readFileSync(path.join(ROOT, 'games', catalog[0].slug, 'dist/index.html'), 'utf8');
  check(
    !loose.includes("window.__catalog = '../index.html'"),
    'whoever downloads only the game must not get a link to a catalog they do not have'
  );
});

scenario('the exit shows up and leads back', async () => {
  // the two paths of the contract: a DOM link (every game with an HTML menu)
  // and a button drawn on canvas
  for (const game of catalog) {
    const file = path.join(DIST, game.slug, 'index.html');
    // the declared element, not the selector from the script the build injects —
    // that one shows up in every game, including those drawing the exit on canvas
    if (!/<a\b[^>]*\bdata-back-to-catalog\b/.test(readFileSync(file, 'utf8'))) continue;

    const g = await open(browser, file, DEVICES.desktop, { bootWait: 3200 });
    const m = await g.page.evaluate(() => {
      const l = document.querySelector('[data-back-to-catalog]');
      if (!l) return { error: 'no link' };
      const r = l.getBoundingClientRect();
      return {
        error: null,
        visible: !l.hidden && r.width > 0,
        onScreen: r.y >= 0 && r.y + r.height <= innerHeight,
        href: l.getAttribute('href'),
        color: getComputedStyle(l).color,
      };
    });
    check(!m.error, `${game.slug}: ${m.error}`);
    check(m.visible, `${game.slug}: the exit should be visible inside the catalog`);
    check(m.onScreen, `${game.slug}: the exit is outside the visible area`);
    check(m.href === '../index.html', `${game.slug}: it points at "${m.href}"`);
    // An <a> with no `color` in the CSS inherits the browser's link blue. That
    // already happened here in three games at once: over a dark background,
    // unreadable. The exit has to wear the game's own button.
    check(
      m.color !== 'rgb(0, 0, 238)',
      `${game.slug}: the exit ended up the default link blue — it needs the game's own style`
    );
    await g.close();
  }

  // in Animals the exit is drawn on canvas: check that it exists on the bar
  const a = await open(browser, path.join(DIST, 'animais-vs-monstros/index.html'), DEVICES.desktop, {
    bootWait: 900,
  });
  await a.exec((game) => {
    game.state().sawIntro = true;
    game.goToMap();
  });
  await a.waitFrames(3);
  const hasButton = await a.exec(
    (game) => !!window.__catalog && game.current().buttons().some((b) => b.action === 'catalog')
  );
  check(hasButton, 'animais-vs-monstros: the map bar should offer the way back');
  await a.close();
});

scenario('the index lists every game and each link exists', async () => {
  const g = await open(browser, path.join(DIST, 'index.html'), DEVICES.desktop, { bootWait: 800 });
  const cards = await g.page.$$eval('.card', (els) => els.map((e) => e.getAttribute('href')));
  check(cards.length === catalog.length, `${cards.length} cards for ${catalog.length} games`);
  for (const href of cards) {
    check(existsSync(path.join(DIST, href)), `broken link on the index: ${href}`);
  }
  g.expectNoErrors('index');
  await g.close();
});

// --------------------------------------------------------------------- i18n

// One page per game, both checks on it: the suite already opens ~30 tabs, and
// the 3D games hold a WebGL context each — an extra pass was enough to take
// the browser down mid-run.
scenario('every game offers the two flags and really switches', async () => {
  for (const game of catalog) {
    const file = path.join(DIST, game.slug, 'index.html');
    const g = await open(browser, file, DEVICES.desktop, { bootWait: 2600 });

    const before = await g.exec((gm) => (gm && gm.i18n ? gm.i18n.lang : null));
    check(before, `${game.slug}: no i18n on the bridge — the flags cannot be tested`);

    // the picker is either two DOM buttons or two flags drawn on the canvas;
    // what every game owes is the *switch*, so that is what is checked here
    const other = before === 'pt' ? 'en' : 'pt';
    await g.setLang(other);
    const after = await g.exec((gm) => gm.i18n.lang);
    check(after === other, `${game.slug}: asked for "${other}" and stayed on "${after}"`);

    // and the choice lands in the key the whole catalog shares
    const stored = await g.page.evaluate(() => localStorage.getItem('slop:lang'));
    check(stored === other, `${game.slug}: stored "${stored}" instead of "${other}"`);

    if (readFileSync(file, 'utf8').includes('data-lang-picker')) {
      // a game may host the picker in more than one place — the Zoo carries it
      // on the splash AND in the HUD, because its splash never comes back — so
      // this counts per host rather than per page
      const hosts = await g.page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-lang-picker]')).map((host) => ({
          shown: host.getBoundingClientRect().width > 0,
          flags: Array.from(host.querySelectorAll('button')).map((b) => ({
            visible: b.getBoundingClientRect().width > 0,
            hasImage: !!b.querySelector('img') && b.querySelector('img').src.startsWith('data:image/png'),
          })),
        }))
      );
      check(hosts.length >= 1, `${game.slug}: the picker was never mounted`);
      for (const host of hosts) {
        check(host.flags.length === 2, `${game.slug}: a picker has ${host.flags.length} flags instead of 2`);
        // a host inside a hidden panel measures zero, and that is fine — what
        // must never happen is a flag with no width in a picker that IS shown
        if (host.shown) {
          check(host.flags.every((f) => f.visible), `${game.slug}: a flag rendered with zero width`);
        }
        // the flags are painted by code and inlined as a data URI — rule nº 5,
        // and the reason the picker doesn't rely on the 🇧🇷 emoji
        check(host.flags.every((f) => f.hasImage), `${game.slug}: a flag came without its drawn image`);
      }
    }

    g.expectNoErrors(`${game.slug} language switch`);
    await g.close();
  }
});

/* Counts the little words that only one of the two languages uses. Content
   words are no good — a game's own vocabulary drags them either way — but
   articles and prepositions track the language reliably at this length. */
const PT_MARKERS = /\b(de|da|do|dos|das|que|para|com|não|uma|você|seu|sua|mais|pelo|ao|na|no|os|as|é)\b/gi;
const EN_MARKERS = /\b(the|and|with|your|you|for|from|into|are|its|has|this|that|of|to|on|at|is)\b/gi;
const score = (text) => ({
  pt: (text.match(PT_MARKERS) || []).length,
  en: (text.match(EN_MARKERS) || []).length,
});

scenario('the flag actually changes which language is on screen', async () => {
  for (const game of catalog) {
    const g = await open(browser, path.join(DIST, game.slug, 'index.html'), DEVICES.desktop, { bootWait: 2600 });

    // Whatever the game draws on its home screen: the DOM for the games with a
    // DOM menu, and `screenText()` from the bridge for the ones that draw their
    // menu on canvas. A game that offers neither is skipped, not failed.
    const read = () => g.exec((gm) => {
      const canvasText = gm && typeof gm.screenText === 'function' ? gm.screenText() : '';
      return (document.body.innerText || '') + ' ' + canvasText;
    });

    await g.setLang('en');
    await g.waitFrames(3);
    const en = score(await read());
    await g.setLang('pt');
    await g.waitFrames(3);
    const pt = score(await read());

    // too little text to judge (a canvas-only menu with no bridge for it)
    if (en.en + en.pt < 6 || pt.en + pt.pt < 6) {
      await g.close();
      continue;
    }
    // This is the check that was missing while LN() was inverted: the language
    // tag flipped and the *text* flipped with it — to the wrong side.
    check(en.en > en.pt,
      `${game.slug}: on "en" the screen reads more Portuguese than English (pt=${en.pt} en=${en.en})`);
    check(pt.pt > pt.en,
      `${game.slug}: on "pt" the screen reads more English than Portuguese (pt=${pt.pt} en=${pt.en})`);

    g.expectNoErrors(`${game.slug} language content`);
    await g.close();
  }
});

scenario('no game shows a raw pt|en string or a missing dictionary key', async () => {
  for (const game of catalog) {
    const g = await open(browser, path.join(DIST, game.slug, 'index.html'), DEVICES.desktop, { bootWait: 2600 });

    for (const lang of ['en', 'pt']) {
      await g.setLang(lang);
      await g.waitFrames(3);

      // A bar that reaches the screen means somebody built a bilingual value
      // into the HTML without splitting it. It reads as garbage in BOTH
      // languages, which is why it survived every check that only compared the
      // two sides against each other.
      const raw = await g.exec((gm) => {
        const canvas = gm && typeof gm.screenText === 'function' ? gm.screenText() : '';
        const text = (document.body.innerText || '') + '\n' + canvas;
        return text.split('\n').filter((l) => /\S\|\S/.test(l)).slice(0, 3);
      });
      check(!raw.length, `${game.slug} (${lang}): raw pt|en on screen — ${JSON.stringify(raw)}`);

      // A one-sided dictionary entry never shows a raw key: t() falls back to
      // the other language and the player silently gets the wrong one, so
      // missingKeys over the shipped dictionary is the only thing that sees it.
      const dict = await g.exec((gm) => (gm && gm.i18n ? gm.i18n.dict : null));
      check(dict, `${game.slug}: the bridge exposes no dictionary to check`);
      const holes = missingKeys(dict || {});
      check(!holes.length, `${game.slug}: dictionary entries missing a language — ${JSON.stringify(holes.slice(0, 5))}`);
    }

    g.expectNoErrors(`${game.slug} raw strings`);
    await g.close();
  }
});

scenario('the index ships in both languages and remembers the choice', async () => {
  const g = await open(browser, path.join(DIST, 'index.html'), DEVICES.desktop, { bootWait: 800 });
  // the picker is built in JavaScript: wait for it instead of betting on bootWait,
  // which by this point in the suite is racing thirty already-opened tabs
  await g.page.waitForSelector('[data-lang-picker] button', { timeout: 5000 });

  // Which language it starts in is not fixed: English is the default, but a
  // browser asking for Portuguese gets Portuguese — and the machine running
  // this test may well be one. So the scenario reads where it landed and
  // switches to the *other* flag, which is the contract either way.
  const first = await g.page.evaluate(() => ({
    flags: Array.from(document.querySelectorAll('[data-lang-picker] button')).map((e) => e.dataset.lang),
    lang: window.__game.i18n.lang,
    name: document.querySelector('.card__name').textContent,
  }));
  check(first.flags.length === 2, `the index should offer two flags, it offered ${first.flags.length}`);
  check(first.flags.includes('pt') && first.flags.includes('en'), `the flags are ${first.flags}`);

  const other = first.lang === 'en' ? 'pt' : 'en';
  // one evaluate for the click and the read: under the load of a full suite the
  // extra protocol round trips were enough to lose the target
  const second = await g.page.evaluate((lang) => {
    document.querySelector(`[data-lang-picker] button[data-lang="${lang}"]`).click();
    return { name: document.querySelector('.card__name').textContent, stored: localStorage.getItem('slop:lang') };
  }, other);
  check(first.name !== second.name, `switching to "${other}" should change the card name`);
  check(second.stored === other, `the choice should be stored under the shared key, it was "${second.stored}"`);

  // and the language has to survive a reload — it is the same key every game reads
  await g.page.reload({ waitUntil: 'load' });
  await wait(500);
  const afterReload = await g.page.evaluate(() => document.querySelector('.card__name').textContent);
  check(afterReload === second.name, 'the chosen language has to be there on the next visit');
  g.expectNoErrors('index i18n');
  await g.close();
});

await run('catalog');
await browser.close();
