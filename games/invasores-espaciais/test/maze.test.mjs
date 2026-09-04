// Hungry Maze, played in Node: the map, the turning, the hunt, the fright.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  COLS, ROWS, MAP, tileAt, pelletCount, create, update, drain, isOver,
  draw, CORNERS, chaseTarget, ghostTarget, chooseDir, speedOf, frightTime,
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

scenario('blinky runs straight at the eater, scatter still sends him home', () => {
  const game = awake();
  game.player = { c: 9, r: 10, dir: 'left', want: 'left' };
  game.mode = 'chase';
  const blinky = game.ghosts.find((g) => g.name === 'blinky');
  blinky.state = 'active';
  const [tc, tr] = ghostTarget(game, blinky);
  checkEqual(tc + ',' + tr, '9,10', `blinky wants ${tc},${tr}, not the eater`);
  game.mode = 'scatter';
  const [sc, sr] = ghostTarget(game, blinky);
  checkEqual(sc + ',' + sr, CORNERS.blinky.join(','), 'scatter lost blinky\'s corner');
});

scenario('pinky sets the ambush four tiles ahead of the mouth', () => {
  const game = awake();
  game.player = { c: 5, r: 9, dir: 'right', want: 'right' };
  const pinky = game.ghosts.find((g) => g.name === 'pinky');
  const [tc, tr] = chaseTarget(game, pinky);
  checkEqual(tc + ',' + tr, '9,9', `pinky wants ${tc},${tr}, not four ahead`);
  game.player.dir = 'up';
  const [uc, ur] = chaseTarget(game, pinky);
  checkEqual(uc + ',' + ur, '5,5', `pinky wants ${uc},${ur} facing up, not four ahead`);
});

scenario('inky flanks across blinky, never just tails the eater', () => {
  const game = awake();
  game.player = { c: 9, r: 10, dir: 'left', want: 'left' };
  const blinky = game.ghosts.find((g) => g.name === 'blinky');
  const inky = game.ghosts.find((g) => g.name === 'inky');
  blinky.c = 5; blinky.r = 5;
  // pivot two ahead of the eater (7,10), mirrored across blinky (5,5)
  const [tc, tr] = chaseTarget(game, inky);
  checkEqual(tc + ',' + tr, '9,15', `inky wants ${tc},${tr}, not the flank 9,15`);
  const [bc, br] = chaseTarget(game, blinky);
  check(`${tc},${tr}` !== `${bc},${br}`, 'inky tails blinky\'s target instead of flanking');
});

scenario('clyde is shy up close and bold from far away', () => {
  const game = awake();
  game.player = { c: 9, r: 10, dir: 'left', want: 'left' };
  const clyde = game.ghosts.find((g) => g.name === 'clyde');
  clyde.c = 9; clyde.r = 10;
  const [nc, nr] = chaseTarget(game, clyde);
  checkEqual(nc + ',' + nr, CORNERS.clyde.join(','), `clyde on top of the eater wants ${nc},${nr}, not his corner`);
  clyde.c = 1; clyde.r = 1;
  const [fc, fr] = chaseTarget(game, clyde);
  checkEqual(fc + ',' + fr, '9,10', `clyde twelve tiles out wants ${fc},${fr}, not the chase`);
});

scenario('at one crossing, chase turns in and fright turns away', () => {
  const game = awake();
  game.player = { c: 1, r: 1, dir: 'left', want: 'left' };
  game.mode = 'chase';
  const g = game.ghosts[0];
  g.name = 'blinky';
  g.state = 'active';
  g.c = 4; g.r = 1; g.dir = 'left';
  game.fright = 0;
  checkEqual(chooseDir(game, g), 'left', 'chase did not turn toward the eater');
  game.fright = 7;
  checkEqual(chooseDir(game, g), 'down', 'fright did not turn away from the eater');
});

scenario('frightened ghosts flee: the setup that kills in chase stays safe in fright', () => {
  /** The eater pinned facing the wall, one hunter three tiles out. */
  const setup = (fright) => {
    const game = awake();
    game.player = { c: 1, r: 1, dir: 'left', want: 'left' };
    game.ghosts.forEach((gh, i) => {
      if (i === 0) { gh.state = 'active'; gh.c = 4; gh.r = 1; gh.dir = 'left'; }
      else { gh.state = 'house'; gh.houseT = 9999; }
    });
    game.mode = 'chase';
    game.modeIdx = 5;
    game.modeClock = Infinity;
    game.fright = fright;
    return game;
  };
  const run = (game, seconds) => {
    let sum = 0;
    let n = 0;
    let contact = false;
    for (let t = 0; t < seconds; t += H) {
      update(game, H, {});
      if (drain(game).some((e) => e.name === 'eatGhost') || game.dying > 0 || game.lives < 3) {
        contact = true;
        break;
      }
      sum += Math.hypot(game.ghosts[0].c - game.player.c, game.ghosts[0].r - game.player.r);
      n++;
    }
    return { avg: n ? sum / n : 0, contact, end: Math.hypot(game.ghosts[0].c - 4, game.ghosts[0].r - 1) };
  };
  const hunted = run(setup(0), 4);
  const scared = run(setup(7), 4);
  check(hunted.contact, 'the chasing shadow never reached the eater in 4s');
  check(!scared.contact, 'the frightened shadow blundered into the eater');
  check(scared.avg > hunted.avg, `fright avg ${scared.avg.toFixed(2)} is not above chase avg ${hunted.avg.toFixed(2)}`);
  check(scared.avg > 5, `fright avg ${scared.avg.toFixed(2)} never got clear of the eater`);
  check(scared.end > 2, `the frightened shadow moved ${scared.end.toFixed(2)} tiles in 4s — frozen ghosts flee nowhere`);
});

scenario('a fleeing shadow can still be run down inside one fright', () => {
  const game = awake();
  game.pellets = new Set(['9,9']);
  game.player = { c: 1, r: 3, dir: 'right', want: 'right' };
  game.ghosts.forEach((gh, i) => {
    if (i === 0) { gh.state = 'active'; gh.c = 5; gh.r = 3; gh.dir = 'right'; }
    else { gh.state = 'house'; gh.houseT = 9999; }
  });
  game.mode = 'chase';
  game.modeIdx = 5;
  game.modeClock = Infinity;
  game.fright = 7;
  let caught = -1;
  for (let t = 0; t < 7; t += H) {
    update(game, H, { right: true });
    if (drain(game).some((e) => e.name === 'eatGhost')) { caught = t; break; }
  }
  check(caught >= 0, 'four tiles up with double speed, the eater never caught the ghost in 7s');
  check(caught > 0.2, `the catch took ${caught.toFixed(2)}s — that is a statue, not a chase`);
});

scenario('the hunt stays a step slower than the eater, every wave', () => {
  for (let wave = 1; wave <= 12; wave++) {
    const s = speedOf(wave);
    check(s.ghost < s.player, `wave ${wave}: hunter ${s.ghost.toFixed(2)} caught the eater ${s.player.toFixed(2)}`);
    check(s.fright < s.player, `wave ${wave}: edible ${s.fright.toFixed(2)} outruns the eater ${s.player.toFixed(2)} — eating is impossible`);
    check(s.fright > 0 && s.eyes > s.player, `wave ${wave}: bad speed trio ${s.fright}/${s.player}/${s.eyes}`);
  }
  checkEqual(frightTime(1), 7, 'the first fright is not 7s');
  check(frightTime(12) === 2, `the late fright never bottoms out at 2s (${frightTime(12)})`);
});

scenario('blinky opens onto open floor, not inside the wall', () => {
  check(tileAt(9, 5) !== '#', `blinky's doorstep (9,5) is a wall "${tileAt(9, 5)}"`);
  const game = awake();
  checkEqual(game.ghosts[0].c + ',' + game.ghosts[0].r, '9,5', 'blinky does not open on the doorstep');
});

scenario('death buys a safe return: no instant re-death', () => {
  const game = awake();
  game.ghosts[0].state = 'active';
  game.ghosts[0].c = game.player.c;
  game.ghosts[0].r = game.player.r;
  update(game, H, {});
  const lives = game.lives;
  for (let t = 0; t < 1.4 && game.dying > 0; t += H) update(game, H, {});
  game.readyT = 0;
  for (let t = 0; t < 4; t += H) {
    update(game, H, {});
    drain(game);
    if (game.dying > 0 || game.lives < lives) break;
  }
  check(game.lives === lives && game.dying <= 0, 'the eater died again within 4s of respawning, hands off the keys');
});

scenario('the dying, flashing and ready states all paint without a browser', () => {
  const game = awake();
  game.dying = 1.0;
  game.fright = 1.5;
  game.readyT = 1.0;
  draw(headlessContext(), game, { time: 1.9, W: 1280, best: 999, banner: 'Ready!', bannerAlpha: 1 });
  game.dying = 0.1;
  game.fright = 0.2;
  draw(headlessContext(), game, { time: 7.7, W: 1280, best: 999, banner: '', bannerAlpha: 0 });
});

await run('hungry maze');
