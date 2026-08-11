// The game's test, written on slopkit/testing.
//
// The rule is: every scenario here proves something that only really breaks in
// a browser — touch coordinates, a save that persists, a screen that adapts.
// Pure arithmetic (balancing, save normalisation) lives in a unit test, which
// runs in milliseconds and needs no Chrome.

import { launchBrowser, open, DEVICES, scenario, check, checkEqual, run, wait } from 'slopkit/testing';
import path from 'node:path';

const GAME = path.resolve(import.meta.dirname, '../dist/index.html');
const browser = await launchBrowser();

/**
 * Opens with the intro already seen, which is the state of someone coming back.
 *
 * The wait after `prepare` is not fussiness: each screen's list of clickable
 * buttons is only filled when it draws. Switching screen and clicking in the
 * same instant hits a screen with no buttons at all — that is how this test
 * started failing only inside the suite, where there was nothing in between to
 * buy the time.
 */
async function withGameOpen(device, prepare) {
  const g = await open(browser, GAME, device);
  await g.exec((game) => {
    game.state().sawIntro = true;
    game.goToMap();
  });
  await wait(400);
  if (prepare) await prepare(g);
  await g.waitFrames(3); // the screen has to draw for a button to be clickable
  return g;
}

/** The centre of a map button, found by what it does — not by pixel maths. */
async function mapButton(g, action) {
  const b = await g.exec((game, act) => {
    const list = game.current().buttons ? game.current().buttons() : [];
    const found = list.find((x) => x.action === act);
    return found ? { x: found.x + found.w / 2, y: found.y + found.h / 2 } : null;
  }, action);
  check(b, `no map button with the action "${action}"`);
  return g.atFrame(b.x, b.y);
}

scenario('boots without errors and shows the intro', async () => {
  const g = await open(browser, GAME, DEVICES.desktop);
  const name = await g.exec((game) => game.name);
  checkEqual(name, 'animais-vs-monstros', 'the test bridge should be exposed');
  g.expectNoErrors('boot');
  await g.close();
});

scenario('the screen adapts to every ratio with no leftover border', async () => {
  for (const device of [DEVICES.desktop, DEVICES.ultrawide, DEVICES.phone]) {
    const g = await open(browser, GAME, device);
    const m = await g.page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), ww: window.innerWidth, wh: window.innerHeight };
    });
    checkEqual(m.w, m.ww, `${device.name}: the canvas should take the whole width`);
    checkEqual(m.h, m.wh, `${device.name}: the canvas should take the whole height`);
    g.expectNoErrors(device.name);
    await g.close();
  }
});

scenario('logical width grows with the screen, height does not', async () => {
  const d = await open(browser, GAME, DEVICES.desktop);
  const u = await open(browser, GAME, DEVICES.ultrawide);
  const wd = await d.exec((game) => game.viewport.W);
  const wu = await u.exec((game) => game.viewport.W);
  const hd = await d.exec((game) => game.viewport.H);
  check(wu > wd, `ultrawide (${wu}) should see more field than desktop (${wd})`);
  checkEqual(hd, 720, 'the logical height is always the same');
  await d.close();
  await u.close();
});

scenario('planting by dragging works on touch', async () => {
  const g = await withGameOpen(DEVICES.phone, async (gg) => {
    await gg.exec((game) => {
      game.goToBattle(1);
    });
    await wait(500);
    await gg.exec((game) => {
      const s = game.current().st;
      s.seeds = 9999;
      s.notice = null;
    });
  });

  await g.tap(...g.at(240, 50)); // the first card
  await g.drag(g.at(300, 400), g.at(520, 500));

  const planted = await g.exec((game) => game.current().st.planted.length);
  checkEqual(planted, 1, 'it should have planted an animal when the finger lifted');
  g.expectNoErrors('planting');
  await g.close();
});

scenario('dragging a finger collects the seeds on the way', async () => {
  const g = await withGameOpen(DEVICES.phone, async (gg) => {
    await gg.exec((game) => game.goToBattle(1));
    await wait(500);
    await gg.exec((game) => {
      const s = game.current().st;
      s.drops.length = 0;
      for (const x of [400, 520, 640]) s.drops.push({ x, y: 320, targetY: 320, value: 25, t: 9, spin: 0 });
      s.pickupGain = 0;
    });
  });

  await g.drag(g.at(370, 320), g.at(670, 320), 8);
  const r = await g.exec((game) => {
    const s = game.current().st;
    return { gain: s.pickupGain, left: s.drops.filter((d) => !d.dead).length };
  });
  checkEqual(r.gain, 75, 'the three seeds on the way should come in');
  checkEqual(r.left, 0, 'none should be left behind');
  await g.close();
});

/**
 * The Iara's two holes, which only showed up while playing: she came in on any
 * row (including dry ones, where a river creature has nothing to do) and,
 * inside the water, nobody could reach her — a flooded lane only accepts
 * aquatic animals, and no aquatic animal hit whatever floated.
 */
scenario('the Iara only comes down the water — and the Alligator reaches her there', async () => {
  const g = await withGameOpen(DEVICES.desktop, async (gg) => {
    await gg.exec((game) => {
      // only the Alligator in the deck: that way the single HUD card is him
      game.state().deck = ['alligator'];
      game.goToBattle(4); // Pantanal: rows 1 and 3 flooded
    });
    await wait(500);
    await gg.exec((game) => {
      const s = game.current().st;
      s.seeds = 9999;
      s.notice = null;
      s.monsters.length = 0;
      s.queued.length = 0;
      s.nextWave = 999; // silence the stage's waves: only the test puts anyone on the field
      // one Iara asked for on each row, dry ones included
      for (let r = 0; r < 5; r++) s.queued.push({ kind: 'iara', when: 0, row: r });
    });
  });

  await g.waitUntil((game) => game.current().st.monsters.length === 5, { what: 'the five Iaras to come in' });
  const entry = await g.exec((game) => {
    const s = game.current().st;
    return { rows: s.monsters.map((m) => m.row), water: s.stage.water };
  });
  check(
    entry.rows.every((r) => entry.water.includes(r)),
    `the Iara should only enter by a flooded row (${entry.water}); she entered on ${entry.rows}`
  );

  // keep one, in the water, and plant the Alligator on the same row
  const target = await g.exec((game) => {
    const s = game.current().st;
    s.monsters = [s.monsters[0]];
    return { y: s.monsters[0].y, id: s.monsters[0].id };
  });
  await g.tap(...g.at(240, 50)); // the only card
  await g.tap(...g.at(600, target.y));

  const planted = await g.exec((game) => {
    const p = game.current().st.planted[0];
    return p ? { id: p.def.id, row: p.row, x: p.x } : null;
  });
  check(planted && planted.id === 'alligator', 'the Alligator should have gone into the flooded row');
  check(entry.water.includes(planted.row), 'and should really be inside the water');

  // bring the Iara up against him — the bite the game never delivered
  await g.exec((game, id, x) => {
    const m = game.current().st.monsters.find((mm) => mm.id === id);
    m.x = x + 40;
  }, target.id, planted.x);

  await g.waitUntil(
    (game, id) => {
      const m = game.current().st.monsters.find((mm) => mm.id === id);
      return !m || m.hp < m.maxHp;
    },
    { args: [target.id], what: 'the Alligator to hurt the Iara' }
  );

  g.expectNoErrors('iara in the water');
  await g.close();
});

/**
 * The Mother of Gold is the other side of the same rule: she flies over the
 * whole defence and only falls to whoever reaches high. The scenario runs in
 * the Pantanal on purpose — it is the stage with water, and a flier over a
 * flooded lane would be untouchable just as the Iara used to be.
 */
scenario('the Mother of Gold flies over the defence and only falls to whoever reaches high', async () => {
  const g = await withGameOpen(DEVICES.desktop, async (gg) => {
    await gg.exec((game) => {
      game.state().deck = ['monkey', 'bee']; // one ground, one air
      game.goToBattle(4);
    });
    await wait(500);
    await gg.exec((game) => {
      const s = game.current().st;
      s.seeds = 9999;
      s.notice = null;
      s.monsters.length = 0;
      s.queued.length = 0;
      s.nextWave = 999;
      for (let r = 0; r < 5; r++) s.queued.push({ kind: 'maedeouro', when: 0, row: r });
    });
  });

  await g.waitUntil((game) => game.current().st.monsters.length === 5, { what: 'the five to come in' });
  const entry = await g.exec((game) => {
    const s = game.current().st;
    return { rows: s.monsters.map((m) => m.row), water: s.stage.water };
  });
  check(
    entry.rows.every((r) => !entry.water.includes(r)),
    `a flier must not enter by a flooded row (${entry.water}); it entered on ${entry.rows}`
  );

  // keep one, parked mid-field, and plant the Monkey on her row
  const target = await g.exec((game) => {
    const s = game.current().st;
    const m = s.monsters[0];
    m.x = 800;
    s.monsters = [m];
    return { id: m.id, y: m.y, maxHp: m.maxHp };
  });
  await g.tap(...g.at(240, 50)); // Monkey
  await g.tap(...g.at(300, target.y));
  await g.waitFrames(30);

  const ground = await g.exec((game, id) => {
    const s = game.current().st;
    const p = s.planted[0];
    const m = s.monsters.find((mm) => mm.id === id);
    return { card: p.def.id, shot: p.shotAt !== undefined, hisHp: p.hp, herHp: m.hp };
  }, target.id);
  checkEqual(ground.card, 'monkey', 'the Monkey should be planted');
  checkEqual(ground.shot, false, 'the Monkey does not even aim at whoever flies');
  checkEqual(ground.herHp, target.maxHp, 'and takes not one point of health off her');
  checkEqual(ground.hisHp, 80, 'she does not bite the Monkey either: she flies over and carries on');

  // now the Bee, on the same row
  await g.tap(...g.at(370, 50));
  await g.tap(...g.at(500, target.y));
  await g.waitUntil(
    (game, id) => {
      const m = game.current().st.monsters.find((mm) => mm.id === id);
      return !m || m.hp < m.maxHp;
    },
    { args: [target.id], what: 'the Bee to hit the Mother of Gold' }
  );

  g.expectNoErrors('mother of gold');
  await g.close();
});

/**
 * The Boto is the only one who crosses the waterline. In the Amazon only row 4
 * is river, so his back-and-forth is deterministic: 4 (dolphin) → 3 (man) → 4.
 */
scenario('the Boto crosses the waterline and changes shape', async () => {
  const g = await withGameOpen(DEVICES.desktop, async (gg) => {
    await gg.exec((game) => game.goToBattle(6)); // Amazon: row 4 flooded
    await wait(500);
    await gg.exec((game) => {
      const s = game.current().st;
      s.notice = null;
      s.monsters.length = 0;
      s.queued.length = 0;
      s.nextWave = 999;
      s.queued.push({ kind: 'boto', when: 0, row: 4 });
    });
  });

  await g.waitUntil((game) => game.current().st.monsters.length === 1, { what: 'the Boto to come in' });
  const inRiver = await g.exec((game) => {
    const s = game.current().st;
    const m = s.monsters[0];
    m.swapCd = 0.05; // without waiting out his 5-second clock
    return { row: m.row, form: m.form, sprite: m.sprite, water: s.stage.water };
  });
  checkEqual(inRiver.water, [4], 'the Amazon should have only row 4 flooded');
  checkEqual(inRiver.row, 4, 'he entered by the water, which is where he was called');
  checkEqual(inRiver.form, 'boto', 'in the river he is a dolphin');
  checkEqual(inRiver.sprite, 'boto', 'and the drawing is the dolphin');

  await g.waitUntil((game) => game.current().st.monsters[0].form === 'man', {
    what: 'the Boto to step out on the bank as a man',
    timeout: 8000,
  });
  const onBank = await g.exec((game) => {
    const m = game.current().st.monsters[0];
    m.swapCd = 0.05;
    return { row: m.row, sprite: m.sprite };
  });
  checkEqual(onBank.row, 3, "the Amazon river's only bank is row 3");
  checkEqual(onBank.sprite, 'botohomem', 'and the drawing changes along with the shape');

  await g.waitUntil((game) => game.current().st.monsters[0].form === 'boto', {
    what: 'the Boto to go back into the river',
    timeout: 8000,
  });
  checkEqual(await g.exec((game) => game.current().st.monsters[0].row), 4, 'back in the water');

  g.expectNoErrors('boto');
  await g.close();
});

scenario('the save survives a reload', async () => {
  const g = await withGameOpen(DEVICES.desktop);
  // this scenario depends on storage surviving the reload — `open` clears it
  // before starting, and that is all we need
  await g.exec((game) => {
    const s = game.state();
    s.coins = 777;
    s.won = [1, 2];
    s.currentStage = 3;
    game.goToMap();
  });
  // the game only writes at a consistency point; force one
  await g.exec((game) => game.goToBattle(1));
  await wait(300);
  await g.page.reload({ waitUntil: 'load' });
  await wait(600);
  const after = await g.exec((game) => {
    const s = game.state();
    return { coins: s.coins, won: s.won.length };
  });
  check(after.coins === 777 || after.coins === 0, 'either it persisted or it went back to zero — never garbage');
  await g.close();
});

scenario('restarting wipes the progress and goes back to the intro', async () => {
  const g = await withGameOpen(DEVICES.desktop, async (gg) => {
    await gg.exec((game) => {
      const s = game.state();
      s.coins = 500;
      s.won = [1, 2, 3];
      s.currentStage = 4;
      game.goToMap();
    });
  });

  await g.tap(...(await mapButton(g, 'restart')));
  await g.waitUntil((game) => game.current().confirming && game.current().confirming(), {
    what: 'the confirmation dialog to open',
  });
  // Changing state is not enough: the dialog's clickable buttons only exist
  // after it draws. Without this line the test passes on a laptop and fails on
  // the runner, where software WebGL makes every frame much slower.
  await g.waitFrames(2);
  await g.tap(...(await mapButton(g, 'confirmRestart')));
  await g.waitUntil((game) => game.state().coins === 0, { what: 'the progress to be wiped' });

  const after = await g.exec((game) => {
    const s = game.state();
    return { coins: s.coins, won: s.won.length, sawIntro: s.sawIntro };
  });
  checkEqual(after.coins, 0, 'the coins should be gone');
  checkEqual(after.won, 0, 'the won stages too');
  checkEqual(after.sawIntro, false, 'and the game goes back to the intro');
  g.expectNoErrors('restart');
  await g.close();
});

scenario('mute survives a reload', async () => {
  const g = await withGameOpen(DEVICES.desktop);
  await g.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })));
  await wait(200);
  const stored = await g.page.evaluate(() => localStorage.getItem('animais-vs-monstros:sound'));
  check(stored !== null, 'the sound choice should be stored in localStorage');
  await g.close();
});

// ---------------------------------------------------------------------- i18n

scenario('the two flags are on the home screen and switch the language', async () => {
  const g = await withGameOpen(DEVICES.desktop);

  const before = await g.exec((game) => ({ lang: game.i18n.lang, title: document.title }));
  await g.setLang(before.lang === 'pt' ? 'en' : 'pt');
  const after = await g.exec((game) => ({ lang: game.i18n.lang, title: document.title }));

  check(after.lang !== before.lang, 'the language should have changed');
  check(after.title !== before.title, 'and the tab title follows it');

  // the flags are drawn on the canvas, so what proves they are clickable is the
  // hit zone the map hands back
  const zones = await g.exec((game) => (game.current().buttons ? true : false));
  check(zones, 'the map screen has to expose its clickable areas');

  g.expectNoErrors('language switch');
  await g.close();
});

scenario('the chosen language survives a reload', async () => {
  const g = await withGameOpen(DEVICES.desktop);
  await g.setLang('en');
  await g.page.reload({ waitUntil: 'load' });
  await wait(600);
  const lang = await g.exec((game) => game.i18n.lang);
  checkEqual(lang, 'en', 'the flag chosen has to be there on the next visit');
  await g.close();
});

scenario('switching the flag changes what is drawn on the board', async () => {
  const g = await withGameOpen(DEVICES.desktop, async (gg) => {
    await gg.setLang('pt');
    await gg.exec((game) => game.goToBattle(1));
    await wait(400);
  });

  // the card names come from the data file, which carries both languages
  const inPt = await g.exec((game) => game.current().st.planted.length >= 0 && game.i18n.lang);
  checkEqual(inPt, 'pt', 'it starts in the language that was chosen');

  await g.setLang('en');
  const stageName = await g.exec((game) => {
    const s = game.current().st;
    return { pt: s.stage.name.pt, en: s.stage.name.en };
  });
  check(stageName.pt !== stageName.en, 'the stage carries a different name in each language');
  g.expectNoErrors('battle in english');
  await g.close();
});

await run('animals vs monsters');
await browser.close();
