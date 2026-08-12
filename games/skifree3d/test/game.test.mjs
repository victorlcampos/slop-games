// SkiFree's own test, written on slopkit/testing.
//
// It had none. The catalog floor checks a canvas with a nonzero size, and this
// game's canvas exists at the MENU — so it could ship unable to start a run at
// all and every floor scenario would stay green. That is exactly how World
// Drive shipped two commits unable to load a world.
//
// So the first thing here is the most basic: does a run start, does the world
// move, and does the game's only ending happen.

import { launchBrowser, open, scenario, check, run } from 'slopkit/testing';
import path from 'node:path';

const GAME = path.resolve(import.meta.dirname, '../dist/index.html');
const browser = await launchBrowser();

/** Opens the game and leaves the menu behind, riding the given mode. */
async function ride(mode = 'free') {
  const g = await open(browser, GAME, undefined, { bootWait: 2600 });
  await g.exec((gm, m) => gm.game.start(m), mode);
  await g.waitUntil(() => window.__game.game.state.phase === 'playing',
    { timeout: 15000, what: 'the run to start' });
  return g;
}

scenario('a run starts and the mountain actually moves', async () => {
  const g = await ride();
  const t0 = await g.exec((gm) => ({ d: gm.game.player.state.travel, t: gm.game.state.time }));
  await g.wait(2500);
  const t1 = await g.exec((gm) => ({
    d: gm.game.player.state.travel,
    t: gm.game.state.time,
    speed: gm.game.player.state.speed,
    phase: gm.game.state.phase,
  }));
  check(t1.t > t0.t, 'the clock did not advance');
  check(t1.d > t0.d + 10, `the skier covered ${(t1.d - t0.d).toFixed(1)}m in 2.5s`);
  check(t1.speed > 5, `the skier is doing ${t1.speed} — the run is not moving`);
  check(t1.phase === 'playing', `the phase went to "${t1.phase}"`);

  // the HUD is the only place the player reads any of this
  const hud = await g.exec(() => ({
    dist: document.getElementById('s-dist').textContent,
    time: document.getElementById('s-time').textContent,
    speed: document.getElementById('s-speed').textContent,
  }));
  check(/\d/.test(hud.dist) && /\d/.test(hud.time), `the HUD reads ${JSON.stringify(hud)}`);
  check(+hud.speed.replace(/\D/g, '') > 0, `the speedo reads "${hud.speed}"`);

  g.expectNoErrors('free ride');
  await g.close();
});

scenario('every mode rides, and slalom is the only one that lays gates', async () => {
  for (const mode of ['free', 'slalom', 'trees', 'freestyle']) {
    const g = await ride(mode);
    // gates are laid ahead of the skier as the course unrolls, so slalom needs
    // a moment more than "it started"
    if (mode === 'slalom') {
      await g.waitUntil(() => window.__game.game.state.gatesTotal > 0,
        { timeout: 30000, what: 'slalom to lay its first gate' });
    } else {
      await g.wait(1800);
    }
    const m = await g.exec((gm) => ({
      phase: gm.game.state.phase,
      mode: gm.game.state.mode,
      gates: gm.game.state.gatesTotal,
      panel: getComputedStyle(document.getElementById('gates')).display,
    }));
    check(m.phase === 'playing', `${mode}: phase "${m.phase}" after 1.8 s`);
    check(m.mode === mode, `asked for ${mode}, got ${m.mode}`);
    if (mode === 'slalom') {
      check(m.gates > 0, 'slalom laid no gates');
      check(m.panel !== 'none', 'slalom hid its own gates panel');
    } else {
      check(m.gates === 0, `${mode} laid ${m.gates} gates`);
      check(m.panel === 'none', `${mode} is showing the gates panel`);
    }
    g.expectNoErrors(mode);
    await g.close();
  }
});

scenario('the Yeti wakes, catches you, and that is the ending', async () => {
  const g = await ride();
  // he sleeps until 2000 m of travel — put the skier there and let the game
  // wake him the way it does in play, then stop skiing so he closes the gap
  await g.exec((gm) => { gm.game.player.state.travel = 2100; });
  await g.waitUntil(() => window.__game.game.yeti.state.mode === 'chasing',
    { timeout: 30000, what: 'the Yeti to wake' });
  await g.exec((gm) => { gm.game.player.state.speed = 0; gm.game.player.state.maxSpeed = 0.2; });
  await g.waitUntil(() => window.__game.game.state.phase === 'over',
    { timeout: 90000, what: 'the Yeti to finish the job' });

  const over = await g.exec(() => ({
    phase: window.__game.game.state.phase,
    card: document.getElementById('over').style.display !== 'none',
    title: document.getElementById('over-title').textContent,
    dist: document.getElementById('o-dist').textContent,
  }));
  check(over.card, 'the game-over card never appeared');
  check(over.title.length > 5, `the headline reads "${over.title}"`);
  check(/\d/.test(over.dist), `the distance on the card reads "${over.dist}"`);

  g.expectNoErrors('the yeti');
  await g.close();
});

scenario('a record is kept per mode and survives a reload', async () => {
  const g = await ride('slalom');
  await g.exec((gm) => {
    gm.game.player.state.travel = 4321;
    gm.game.state.score = 8888;
  });
  await g.waitUntil(() => window.__game.game.yeti.state.mode === 'chasing',
    { timeout: 30000, what: 'the Yeti to wake' });
  await g.exec((gm) => { gm.game.player.state.speed = 0; gm.game.player.state.maxSpeed = 0.2; });
  await g.waitUntil(() => window.__game.game.state.phase === 'over',
    { timeout: 90000, what: 'the run to end' });
  await g.waitFrames(2);

  const before = await g.exec(() => JSON.parse(localStorage.getItem('skifree3d.best.v1') || 'null'));
  check(before && typeof before === 'object', 'nothing was written to the record');

  await g.page.reload({ waitUntil: 'networkidle2' });
  await g.wait(2200);
  const after = await g.exec(() => JSON.parse(localStorage.getItem('skifree3d.best.v1') || 'null'));
  check(JSON.stringify(after) === JSON.stringify(before), 'the record did not survive the reload');

  g.expectNoErrors('records');
  await g.close();
});

scenario('the mute choice is remembered, like the rest of the catalog', async () => {
  const g = await open(browser, GAME, undefined, { bootWait: 2600 });
  const on = await g.exec((gm) => { gm.game.start('free'); return true; });
  check(on, 'the run did not start');
  // the game binds by `code`, on window
  await g.exec(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm' })));
  await g.waitFrames(2);
  const stored = await g.exec(() => localStorage.getItem('skifree3d:sound'));
  check(stored && JSON.parse(stored).muted === true, `storage holds ${stored}`);

  await g.page.reload({ waitUntil: 'networkidle2' });
  await g.wait(2200);
  const back = await g.exec(() => JSON.parse(localStorage.getItem('skifree3d:sound') || 'null'));
  check(back && back.muted === true, 'the mute choice came back unmuted');
  await g.close();
});

scenario('menu → run → menu, three times, with no wreckage', async () => {
  const g = await open(browser, GAME, undefined, { bootWait: 2600 });
  for (let i = 0; i < 3; i++) {
    await g.exec((gm) => gm.game.start('free'));
    await g.waitUntil(() => window.__game.game.state.phase === 'playing',
      { timeout: 15000, what: `run ${i + 1} to start` });
    await g.wait(900);
    await g.exec((gm) => gm.game.backToMenu());
    await g.waitFrames(2);
    const m = await g.exec((gm) => ({ phase: gm.game.state.phase, hud: document.getElementById('hud').className }));
    check(m.phase === 'menu', `after run ${i + 1} the phase is "${m.phase}"`);
    check(!/\bon\b/.test(m.hud), `run ${i + 1} left the HUD up over the menu`);
  }
  g.expectNoErrors('three runs');
  await g.close();
});

await run('skifree 3d');
await browser.close();
