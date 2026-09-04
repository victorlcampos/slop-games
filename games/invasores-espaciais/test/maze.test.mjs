// Hungry Maze, played in Node: the map, the turning, the hunt, the fright.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  COLS, ROWS, MAP, tileAt, pelletCount, create, update, drain, isOver,
  draw, CORNERS,
} from '../src/games/maze.js';

const H = 1 / 60;
const HALF = () => 0.5;

/** A game past the ready freeze, with the house clock untouched. */
function awake() {
  const game = create(HALF);
  game.readyT = 0;
  return game;
}

scenario('the map is sound: walled, symmetric, four pills', () => {
  checkEqual(MAP.length, ROWS, `${MAP.length} rows, not ${ROWS}`);
  for (const [i, row] of MAP.entries()) {
    checkEqual(row.length, COLS, `row ${i} is ${row.length} wide, not ${COLS}`);
    check(row === [...row].reverse().join(''), `row ${i} is lopsided — the maze mirrors`);
  }
  for (let c = 0; c < COLS; c++) {
    check(tileAt(c, 0) === '#' && tileAt(c, ROWS - 1) === '#', 'the maze leaks top or bottom');
  }
  for (let r = 0; r < ROWS; r++) {
    check(tileAt(0, r) === '#' && tileAt(COLS - 1, r) === '#', `row ${r} leaks out the side`);
  }
  let powers = 0;
  let doors = 0;
  for (const row of MAP) {
    for (const ch of row) {
      if (ch === 'o') powers++;
      if (ch === 'D') doors++;
    }
  }
  checkEqual(powers, 4, `${powers} power pills, not one per corner`);
  checkEqual(doors, 3, 'the ghost house has no three-wide door');
});

scenario('every pellet can be reached from the start', () => {
  const seen = new Set(['9,10']);
  const queue = [[9, 10]];
  while (queue.length) {
    const [c, r] = queue.pop();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const t = tileAt(c + dx, r + dy);
      const key = (c + dx) + ',' + (r + dy);
      if ((t === '.' || t === 'o' || t === ' ') && !seen.has(key)) {
        seen.add(key);
        queue.push([c + dx, r + dy]);
      }
    }
  }
  const pellets = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tileAt(c, r) === '.' || tileAt(c, r) === 'o') pellets.add(c + ',' + r);
    }
  }
  const lost = [...pellets].filter((p) => !seen.has(p));
  check(lost.length === 0, `${lost.length} pellets walled off: ${lost.slice(0, 5).join(' ')}`);
  check(pelletCount() > 100, `a maze with ${pelletCount()} pellets is a snack, not a maze`);
});

scenario('the eater turns toward its want at the tile center', () => {
  const game = awake();
  game.player = { c: 4, r: 1, dir: 'right', want: 'right' };
  update(game, H, { down: true });
  checkEqual(game.player.dir, 'down', 'an open turn was refused');
  check(game.player.r > 1, 'the turn did not move');
});

scenario('walls stop the eater cold', () => {
  const game = awake();
  game.player = { c: 1, r: 1, dir: 'left', want: 'left' };
  update(game, H, {});
  check(Math.abs(game.player.c - 1) < 1e-9, `the eater entered the wall: ${game.player.c}`);
});

scenario('eating the last pellet clears the maze, then deals a faster one', () => {
  const game = awake();
  game.pellets = new Set(['1,1']);
  game.player = { c: 1, r: 1, dir: 'left', want: 'left' };
  update(game, H, {});
  checkEqual(game.pellets.size, 0, 'the last pellet survived being stood on');
  check(drain(game).some((e) => e.name === 'clear'), 'no clear event left the maze');
  for (let t = 0; t < 2.2; t += H) update(game, H, {});
  checkEqual(game.wave, 2, 'the second maze never came up');
  checkEqual(game.pellets.size, pelletCount(), 'the second maze came up half-eaten');
});

scenario('the power pill turns the hunt: ghosts pay 200, then 400', () => {
  const game = awake();
  game.pellets = new Set(['1,3:P', '9,9']);
  game.player = { c: 1, r: 3, dir: 'left', want: 'left' };
  update(game, H, {});
  check(game.fright > 0, 'the pill frightened nobody');
  check(drain(game).some((e) => e.name === 'power'), 'no power event left the maze');
  const score = game.score;
  const [g0, g1] = game.ghosts;
  for (const g of [g0, g1]) {
    g.state = 'active';
    g.c = 1; g.r = 3;
  }
  update(game, H, {});
  checkEqual(game.score, score + 600, `two ghosts paid ${game.score - score}, not 200 + 400`);
  check(g0.state === 'eyes' && g1.state === 'eyes', 'eaten shadows walk on');
  const kill = drain(game).filter((e) => e.name === 'eatGhost');
  checkEqual(kill.length, 2, 'one ghost died quietly');
});

scenario('a shadow costs a life, three cost the run', () => {
  const game = awake();
  for (let hit = 1; hit <= 3; hit++) {
    game.readyT = 0;
    const g = game.ghosts[0];
    g.state = 'active';
    g.c = game.player.c;
    g.r = game.player.r;
    update(game, H, {});
    checkEqual(game.lives, 3 - hit, `shadow ${hit} cost the wrong number of lives`);
    for (let t = 0; t < 1.4 && game.dying > 0; t += H) update(game, H, {});
  }
  check(isOver(game), 'three shadows did not end the run');
  check(drain(game).some((e) => e.name === 'lose'), 'no lose event left the maze');
});

scenario('eyes fly home and walk back out', () => {
  const game = awake();
  const g = game.ghosts[0];
  g.state = 'eyes';
  g.c = 9; g.r = 4; g.dir = 'down';
  for (let t = 0; t < 3 && g.state === 'eyes'; t += H) update(game, H, {});
  check(g.state !== 'eyes', 'the eyes never came home');
  checkEqual(g.c, 9, 'the eyes came home to the wrong door');
  for (let t = 0; t < 2.5; t += H) update(game, H, {});
  check(g.state === 'active' || g.state === 'leaving', `the shadow stayed in the house: ${g.state}`);
});

scenario('the house opens on a clock, blinky first', () => {
  const game = awake();
  checkEqual(game.ghosts[0].state, 'active', 'blinky does not open outside');
  check(game.ghosts.slice(1).every((g) => g.state === 'house'), 'the house opened early');
  for (let t = 0; t < 2.5; t += H) update(game, H, {});
  check(game.ghosts[1].state !== 'house', 'pinky never left the house');
});

scenario('the four shadows scatter to four corners', () => {
  checkEqual(new Set(Object.values(CORNERS).map(([c, r]) => c + ',' + r)).size, 4,
    'two shadows share a corner');
});

scenario('the whole maze draws without a browser', () => {
  const game = awake();
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: 'Ready!', bannerAlpha: 1 });
});

await run('hungry maze');
