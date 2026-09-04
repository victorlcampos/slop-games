// Asteroid Belt, played in Node: the split, the ship, the wrap, the waves.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  rockCount, rockSpeed, create, update, drain, isOver, draw,
} from '../src/games/rocks.js';
import { PLAY_W, H as WORLD_H } from '../src/config.js';

const H = 1 / 60;
const HALF = () => 0.5;

/** Deterministic but varying: constant 0.5 stacks every rock on the ship. */
function seq() {
  let s = 123456789;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

scenario('four rocks over an empty sky, none on top of the ship', () => {
  const game = create(seq());
  checkEqual(game.rocks.length, rockCount(1), 'wave 1 deals the wrong sky');
  for (const r of game.rocks) {
    checkEqual(r.size, 3, 'wave 1 opens with small rocks');
    check(Math.hypot(r.x - game.ship.x, r.y - game.ship.y) > 150,
      'a rock opened on top of the ship');
    checkEqual(r.verts.length, 9, 'a rock has the wrong number of corners');
  }
  check(rockCount(9) > rockCount(1), 'later waves deal the same sky');
  check(rockCount(99) <= 9, 'the sky crowds without a cap');
});

scenario('bullets split big rocks in two, and small ones just burst', () => {
  const game = create(seq());
  game.invuln = 99; // the ship watches from safety
  const shoot = (rock) => {
    // one rock alone in the sky: the bullet cannot mistake its neighbour
    game.rocks = [rock];
    game.bullets = [{ x: rock.x, y: rock.y, vx: 0, vy: 0, life: 0.9 }];
    update(game, H, {});
  };

  shoot({ ...game.rocks[0] });
  checkEqual(game.rocks.length, 2, 'the big rock did not become two');
  check(game.rocks.every((r) => r.size === 2), 'the children are the wrong size');
  checkEqual(game.score, 20, `a big rock paid ${game.score}, not 20`);
  check(drain(game).some((e) => e.name === 'brick'), 'no split event left the belt');

  shoot({ ...game.rocks[0] });
  check(game.rocks.every((r) => r.size === 1), 'a medium rock did not twin');
  checkEqual(game.score, 70, `two splits paid ${game.score}, not 20 + 50`);

  const pebble = { ...game.rocks[0] };
  shoot(pebble);
  checkEqual(game.rocks.length, 0, 'a lone pebble left something behind');
  checkEqual(game.score, 170, `three splits paid ${game.score}, not 20 + 50 + 100`);
});

scenario('a rock splits the ship: three strikes, then the run', () => {
  const game = create(seq());
  for (let hit = 1; hit <= 3; hit++) {
    game.invuln = 0;
    game.rocks.push({
      x: game.ship.x, y: game.ship.y, vx: 0, vy: 0,
      size: 1, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    });
    update(game, H, {});
    checkEqual(game.lives, 3 - hit, `rock ${hit} cost the wrong number of lives`);
    check(game.invuln > 0, 'the respawn has no grace period');
  }
  check(isOver(game), 'three rocks did not end the run');
  check(drain(game).some((e) => e.name === 'lose'), 'no lose event left the belt');
});

scenario('the edges wrap: nowhere to hide, no corner to die in', () => {
  const game = create(seq());
  game.ship.x = -61;
  update(game, H, {});
  check(game.ship.x > PLAY_W - 5, `the ship did not wrap: ${game.ship.x}`);
  const rock = game.rocks[0];
  rock.vx = 0;
  rock.x = PLAY_W + 200; // deep past the line, past any one-step drift back
  update(game, H, {});
  check(rock.x < 200, `rocks do not wrap: ${rock.x}`);
});

scenario('clearing the sky darkens it again, meaner', () => {
  const game = create(seq());
  game.rocks = [];
  update(game, H, {});
  check(drain(game).some((e) => e.name === 'clear'), 'no clear event left the belt');
  for (let t = 0; t < 2.2; t += H) update(game, H, {});
  checkEqual(game.wave, 2, 'the second belt never came down');
  checkEqual(game.rocks.length, rockCount(2), 'the second belt came down short');
});

scenario('four shells, never five — holding fire respects the magazine', () => {
  const game = create(seq());
  game.rocks = []; // an empty sky: nothing eats the evidence
  game.clearT = 99; // ...and no next wave walks in mid-count
  for (let t = 0; t < 1; t += H) {
    update(game, H, { fire: true });
    check(game.bullets.length <= 4, `${game.bullets.length} shells out with a four-gun ship`);
  }
});

scenario('thrust has a speed limit', () => {
  const game = create(seq());
  for (let t = 0; t < 5; t += H) update(game, H, { up: true });
  check(Math.hypot(game.ship.vx, game.ship.vy) <= 461, 'five seconds of burn broke the limit');
});

scenario('the whole belt draws without a browser', () => {
  const game = create(seq());
  update(game, H, { fire: true, up: true, left: true });
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: 'Onda 2', bannerAlpha: 1 });
});

await run('asteroid belt');
