// The shell: seven machines behind one protocol, one save, two languages.

import { scenario, check, checkEqual, headlessContext, installHeadlessDom, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';

import { gameIds, loadGame, blankBests, smokeAll } from '../src/registry.js';
import { initial, normalize, createVault } from '../src/savegame.js';
import { dict } from '../src/i18n.js';

const HALF = () => 0.5;
const VIEW = { time: 1.5, W: 1280, best: 999, banner: 'Onda 1', bannerAlpha: 1 };

scenario('seven machines, each speaking the protocol', () => {
  checkEqual(gameIds().length, 7, `${gameIds().length} machines, not seven`);
  checkEqual(new Set(gameIds()).size, 7, 'two machines share an id');
  check(!loadGame('pac-man'), 'a trademarked id resolves');
  for (const id of gameIds()) {
    const m = loadGame(id);
    check(m, `${id} does not resolve`);
    for (const fn of ['create', 'update', 'draw', 'drain', 'isOver']) {
      checkEqual(typeof m[fn], 'function', `${id} does not speak ${fn}()`);
    }
    const game = m.create(HALF);
    checkEqual(game.score, 0, `${id} opens with points on the board`);
    check(game.lives >= 1, `${id} opens dead`);
    check(!m.isOver(game), `${id} opens already over`);
  }
});

scenario('every machine paints without a browser', () => {
  const states = smokeAll(HALF);
  checkEqual(states.length, 7, 'the smoke test deals the wrong arcade');
  states.forEach((game, i) => {
    const m = loadGame(gameIds()[i]);
    m.update(game, 1 / 60, { left: true, right: true, up: true, down: true, fire: true });
    m.drain(game);
    m.draw(headlessContext(), game, VIEW); // must not throw, all seven
  });
});

scenario('an old save still opens: the swarm score moves over, the rest zero', () => {
  const base = initial();
  // the swarm-only days: a lone score
  const moved = normalize({ score: 450, runs: 3 }, base);
  checkEqual(moved.bests.swarm, 450, 'the old score did not move over');
  checkEqual(moved.runs, 3, 'the run count did not survive');
  check(gameIds().every((id) => id === 'swarm' || moved.bests[id] === 0),
    'a new machine opened with points');
  // garbage in, zeros out — never the run
  checkEqual(normalize(null, base), base, 'nothing did not load as fresh');
  checkEqual(normalize('high score!!!', base), base, 'a love letter did not load as fresh');
  const bad = normalize({ bests: { maze: -5, bogus: 100, snake: 'lots' }, runs: -2 }, base);
  checkEqual(bad.bests.maze, 0, 'a negative best survived');
  check(!('bogus' in bad.bests), 'a hand-edited machine survived');
  checkEqual(bad.bests.snake, 0, 'a word survived as a score');
  checkEqual(bad.runs, 0, 'negative runs survived');
  // a full modern save round-trips untouched
  const full = { bests: { swarm: 1, maze: 2, blocks: 3, snake: 4, rocks: 5, hopper: 6, bounce: 7 }, runs: 9 };
  checkEqual(normalize(full, base), full, 'a good save came back changed');
});

scenario('the vault writes and reads through the browser stub', () => {
  installHeadlessDom();
  const vault = createVault();
  const fresh = vault.load();
  checkEqual(fresh.bests.swarm, 0, 'a fresh vault is not zeros');
  vault.save({ bests: { ...fresh.bests, maze: 1200 }, runs: 1 });
  const back = createVault().load();
  checkEqual(back.bests.maze, 1200, 'the maze best did not survive a reload');
  checkEqual(back.runs, 1, 'the run count did not survive a reload');
});

scenario('the collection reads twice: names, pitches and controls, times seven', () => {
  const missing = missingKeys(dict);
  check(missing.length === 0, `half-translated keys: ${missing.join(', ')}`);
  for (const id of gameIds()) {
    for (const field of ['name', 'desc', 'controls']) {
      const key = `games.${id}.${field}`;
      check(dict[key], `${key} is missing entirely`);
      check(dict[key].pt && dict[key].en, `${key} is written in one language`);
      check(dict[key].pt !== dict[key].en, `${key} reads the same twice`);
    }
  }
  for (const [key, side] of Object.entries(dict)) {
    check(side.pt && side.en, `${key} is written in one language`);
    check(side.pt !== side.en, `${key} reads the same twice — one side was pasted`);
  }
});

await run('neon arcade — the shell');
