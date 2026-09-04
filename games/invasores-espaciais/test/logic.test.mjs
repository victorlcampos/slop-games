// The whole match, played in Node: the march, the firing discipline, the
// bunkers, the saucer, the two ways to lose, and both languages.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit';

import {
  PLAY_W, COLS, ROWS, CELL_W, STEP_X, STEP_Y, PLAYER, SHOT, BOLT, SAUCER,
  DEADLINE_Y, INVADER_W, INVADER_H, ROW_SCORE, SHIELD,
} from '../src/config.js';
import {
  createFormation, stepInterval, march, lowestY, spanX, shooters, killAt,
  totalInvaders, BASE_INTERVAL, MIN_INTERVAL,
} from '../src/invaders.js';
import { createShields, damage, impact, remainingCells } from '../src/shields.js';
import {
  createGame, update, drain, nextWave, boltInterval, originX,
} from '../src/game.js';
import { dict } from '../src/i18n.js';
import { createRenderer, breedOf, breedFrame, HUD_Y } from '../src/render.js';

const H = 1 / 60;
/** Deterministic: the middle of every distribution. */
const HALF = () => 0.5;

// ------------------------------------------------------------------ the swarm

scenario('a full swarm, eleven across and five deep', () => {
  const f = createFormation(originX(PLAY_W));
  checkEqual(f.list.length, COLS * ROWS, 'the swarm is not 55 strong');
  checkEqual(f.dir, 1, 'the march does not open to the right');
  for (let row = 0; row < ROWS; row++) {
    const cells = f.list.filter((v) => v.row === row);
    checkEqual(cells.length, COLS, `row ${row} is not eleven across`);
    for (const inv of cells) {
      checkEqual(inv.score, ROW_SCORE[row], `row ${row} pays ${inv.score}, not the table price`);
    }
  }
  // centered on the playfield: the flanks stand the same distance off each wall
  const { min, max } = spanX(f);
  check(Math.abs((min + max) / 2 - (originX(PLAY_W) + 5 * CELL_W)) < 1e-9,
    `the grid sits at ${(min + max) / 2}, not centered`);
});

scenario('the march steps sideways until a wall drops it and turns it', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const f = game.formation;
  // force the step clock over the line
  const tick = () => march(f, f.list.length, 1, 10, { minX: 24, maxX: PLAY_W - 24 });
  const x0 = f.list[0].x;
  const frame0 = f.frame;
  checkEqual(tick(), 'step', 'a step on open ground is not a step');
  checkEqual(f.list[0].x, x0 + STEP_X, `one step moved ${f.list[0].x - x0}, not ${STEP_X}`);
  check(f.frame !== frame0, 'the legs did not shuffle on the step');

  // walk it into the right wall (snapshot the top: the lane heights are the
  // config's business, the test only holds the drop to account)
  const topBefore = Math.min(...f.list.map((v) => v.y));
  let drops = 0;
  for (let i = 0; i < 200 && drops === 0; i++) {
    if (tick() === 'drop') drops++;
  }
  checkEqual(drops, 1, 'the wall never turned the march');
  checkEqual(f.dir, -1, 'the march did not reverse after the drop');
  for (const inv of f.list) check(inv.y >= topBefore + STEP_Y, 'a row stayed behind on the drop');
  const yAfter = f.list[0].y;
  const xAfter = f.list[0].x;
  checkEqual(tick(), 'step', 'the reversed march does not step on');
  check(f.list[0].x < xAfter, 'the reversed march still walks right');
  checkEqual(f.list[0].y, yAfter, 'y moved without a drop');
});

scenario('the last survivor sprints', () => {
  const full = stepInterval(totalInvaders(), 1);
  const one = stepInterval(1, 1);
  check(one < full, `one invader steps every ${one}s, the full swarm every ${full}s`);
  checkEqual(full, BASE_INTERVAL, 'a full swarm on wave 1 does not march the base pace');
  check(stepInterval(totalInvaders(), 3) < full, 'wave 3 does not pace a full swarm up');
  check(stepInterval(1, 99) >= MIN_INTERVAL, 'the floor fell out from under the pace');
});

scenario('only the front rank fires', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const guns = shooters(game.formation);
  checkEqual(guns.length, COLS, `${guns.length} shooters for ${COLS} columns`);
  for (const g of guns) checkEqual(g.row, ROWS - 1, 'a covered invader is holding a gun');
  killAt(game.formation, ROWS - 1, 4);
  const after = shooters(game.formation).find((g) => g.col === 4);
  checkEqual(after.row, ROWS - 2, 'the rank behind did not step up to the gun');
});

scenario('a kill pays the row price, once', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  checkEqual(killAt(game.formation, 0, 0), ROW_SCORE[0], 'the top row did not pay 30');
  checkEqual(killAt(game.formation, 0, 0), 0, 'a corpse paid out twice');
  checkEqual(game.formation.list.length, totalInvaders() - 1, 'the body stayed in formation');
});

// ------------------------------------------------------------------ bunkers

scenario('bunkers are arches with room for the cannon underneath', () => {
  const shields = createShields(PLAY_W);
  checkEqual(shields.length, SHIELD.count, `${shields.length} bunkers, not four`);
  for (const s of shields) {
    // the middle of the bottom rows is hollow — that is where the cannon sits
    const mid = Math.floor(s.cols / 2);
    check(!s.cells[s.rows - 1][mid], 'the arch has no door underneath');
    check(s.cells[2][mid], 'the arch has no roof over the door');
    check(s.cells[3][2], 'the flanks are missing');
  }
  const whole = remainingCells(shields);
  check(whole > 0, 'a fresh line of bunkers is already rubble');
  const before = remainingCells(shields);
  const fallen = damage(shields[0], shields[0].x + shields[0].w / 2, shields[0].y + 20);
  check(fallen > 0, 'a bolt in the middle of a bunker knocked nothing loose');
  checkEqual(remainingCells(shields), before - fallen, 'the count did not follow the crater');
});

scenario('a bolt finds the wall, a shadow finds nothing', () => {
  const [s] = createShields(PLAY_W);
  const midX = s.x + s.w / 2;
  check(impact(s, midX - 2, s.y + 20, 4, 10), 'a bolt through the roof felt nothing');
  check(!impact(s, midX - 2, s.y + s.h - 10, 4, 8), 'the hollow under the arch stopped a bolt');
  check(!impact(s, s.x - 50, s.y, 4, 4), 'a shot ten metres wide of the bunker hit it');
});

// ------------------------------------------------------------------ the cannon

scenario('the cannon moves and respects the walls', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const x0 = game.player.x;
  update(game, H, { left: true });
  check(game.player.x < x0, 'holding left did not move left');
  update(game, 10, { left: true });
  check(game.player.x >= PLAYER.w / 2 + 8, `the cannon left through the left wall: ${game.player.x}`);
  update(game, 10, { right: true });
  check(game.player.x <= PLAY_W - PLAYER.w / 2 - 8, `the cannon left through the right wall: ${game.player.x}`);
});

scenario('one shell in the air — holding fire does not hose the sky', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  // park under open sky: no invader and no bunker above, so the shell flies
  // the whole 0.9 s up and nothing it hits excuses a second shot
  game.player.x = 60;
  for (let t = 0; t < 0.5; t += H) {
    update(game, H, { fire: true });
    check(game.shots.length <= 1, `${game.shots.length} shells in the air at once`);
  }
  checkEqual(game.shotsFired, 1, `half a second of fire loosed ${game.shotsFired} shells`);
});

scenario('a hit pays the row price and kicks up sparks', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const inv = game.formation.list.find((v) => v.row === 2 && v.col === 5);
  game.shots.push({ x: inv.x - SHOT.w / 2, y: inv.y });
  update(game, H, {});
  checkEqual(game.score, ROW_SCORE[2], `a middle-row kill paid ${game.score}`);
  checkEqual(game.killed, 1, 'the kill was not counted');
  check(game.particles.length > 0, 'no sparks where an invader died');
  check(drain(game).some((e) => e.name === 'kill'), 'no kill event left the simulation');
});

// ------------------------------------------------------------------ the war

function slaughter(game) {
  // every invader takes one shell, with the enemy guns tied behind their back
  game.boltClock = 1e9;
  while (game.formation.list.length) {
    game.invuln = 999;
    game.boltClock = 1e9;
    const inv = game.formation.list[0];
    game.shots = [{ x: inv.x - SHOT.w / 2, y: inv.y }];
    update(game, H, {});
  }
  game.invuln = 0;
}

scenario('clearing the swarm brings a meaner wave', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const score = (() => { slaughter(game); return game.score; })();
  check(game.cleared, 'an empty sky did not clear the wave');
  check(drain(game).some((e) => e.name === 'clear'), 'no clear event left the simulation');
  const scoreBefore = score;
  for (let t = 0; t < 3; t += H) update(game, H, {});
  checkEqual(game.wave, 2, 'the second wave never came down');
  checkEqual(game.formation.list.length, totalInvaders(), 'the second wave came down short');
  checkEqual(game.score, scoreBefore, 'the new wave taxed the score');
  check(remainingCells(game.shields) > 200, 'the bunkers were not rebuilt for wave 2');
  check(drain(game).some((e) => e.name === 'wave'), 'no wave event left the simulation');
});

scenario('nextWave keeps the cannon and its score', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  game.score = 450;
  game.lives = 2;
  nextWave(game);
  checkEqual(game.score, 450, 'the wave took the score');
  checkEqual(game.lives, 2, 'the wave took a life');
});

scenario('enemy fire finds the cannon, three times, then the run ends', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  for (let hit = 1; hit <= 3; hit++) {
    game.invuln = 0;
    game.bolts = [{ x: game.player.x - BOLT.w / 2, y: PLAYER.y - 30, vx: 0, vy: BOLT.speed }];
    update(game, H, {});
    checkEqual(game.lives, PLAYER.lives - hit, `hit ${hit} cost the wrong number of lives`);
  }
  check(game.over, 'three bolts did not end the run');
  checkEqual(game.overReason, 'shot', `the run ended by "${game.overReason}", not by fire`);
  check(drain(game).some((e) => e.name === 'lose'), 'no lose event left the simulation');
});

scenario('the swarm crossing the line ends the run at once', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  check(lowestY(game.formation) < DEADLINE_Y, 'the swarm starts past the deadline');
  for (const inv of game.formation.list) inv.y = DEADLINE_Y;
  update(game, H, {});
  check(game.over, 'the swarm crossed the line and the run goes on');
  checkEqual(game.overReason, 'breach', `the run ended by "${game.overReason}", not by breach`);
});

scenario('a bolt and a shell cancel each other out mid-air', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  game.boltClock = 1e9;
  game.invuln = 999;
  game.shots = [{ x: 400, y: 400 }];
  game.bolts = [{ x: 400, y: 400, vx: 0, vy: 0 }];
  update(game, H, {});
  checkEqual(game.shots.length, 0, 'the shell survived the clash');
  checkEqual(game.bolts.length, 0, 'the bolt survived the clash');
  check(drain(game).some((e) => e.name === 'clash'), 'no clash event left the simulation');
});

scenario('your own ceiling eats your own shots', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const [s] = game.shields;
  const before = remainingCells(game.shields);
  game.shots = [{ x: s.x + s.w / 2 - SHOT.w / 2, y: s.y + 24 }];
  update(game, H, {});
  checkEqual(game.shots.length, 0, 'the shell passed through its own bunker');
  check(remainingCells(game.shields) < before, 'the ceiling shows no crater from your own shot');
  checkEqual(game.score, 0, 'shooting your own bunker scored');
});

scenario('bolts chew bunkers from above', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const [s] = game.shields;
  const before = remainingCells(game.shields);
  game.boltClock = 1e9;
  game.invuln = 999;
  game.bolts = [{ x: s.x + s.w / 2, y: s.y - 30, vx: 0, vy: BOLT.speed }];
  for (let t = 0; t < 0.3 && game.bolts.length; t += H) update(game, H, {});
  checkEqual(game.bolts.length, 0, 'the bolt passed through the bunker');
  check(remainingCells(game.shields) < before, 'the bunker shows no crater from above');
});

scenario('the barrage thickens as the swarm thins and the waves pass', () => {
  check(boltInterval(10, 1) < boltInterval(55, 1), 'a dying swarm does not shoot faster');
  check(boltInterval(55, 4) < boltInterval(55, 1), 'wave 4 does not shoot faster than wave 1');
  check(boltInterval(1, 99) >= BOLT.minPeriod, 'the barrage floor fell out');
});

// ------------------------------------------------------------------ the saucer

scenario('the saucer keeps its appointment and pays 300 for a snap shot', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  game.saucerClock = 0.0001;
  update(game, H, {});
  check(game.saucer, 'the saucer stood the cannon up');
  check(drain(game).some((e) => e.name === 'saucer'), 'no saucer event left the simulation');
  game.shots = [{ x: game.saucer.x - SHOT.w / 2, y: SAUCER.y }];
  update(game, H, {});
  check(!game.saucer, 'a dead saucer flies on');
  const kill = drain(game).find((e) => e.name === 'saucerKill');
  check(kill, 'no saucerKill event left the simulation');
  checkEqual(kill.pay, SAUCER.pay[0], `a snap shot paid ${kill.pay}, not 300`);
  checkEqual(game.score, SAUCER.pay[0], `the score shows ${game.score}, not 300`);
});

scenario('spraying at the saucer talks the price down', () => {
  const game = createGame({ playW: PLAY_W, rand: HALF });
  game.saucerClock = 0.0001;
  update(game, H, {});
  for (let i = 0; i < 6; i++) {
    game.cooldown = 0;
    game.shots = [];
    update(game, H, { fire: true });
  }
  check(game.saucer.shotsSince >= 5, 'firing past the saucer did not count the misses');
  game.shots = [{ x: game.saucer.x - SHOT.w / 2, y: SAUCER.y }];
  update(game, H, {});
  const kill = drain(game).find((e) => e.name === 'saucerKill');
  check(kill.pay < SAUCER.pay[0], `six misses still paid the full ${kill.pay}`);
});

// ------------------------------------------------------------------ the lanes

scenario('the HUD ducks under the DOM corner and the lanes keep their gaps', () => {
  // the corner is ~110px wide, ~44px tall: the text top clears it outright
  check(HUD_Y >= 50, `the HUD text top sits at ${HUD_Y}, behind the DOM corner`);
  // the 20px text band ends before the saucer's belly begins
  check(SAUCER.y - SAUCER.h / 2 > HUD_Y + 24,
    `the saucer lane (belly at ${SAUCER.y - SAUCER.h / 2}) flies through the score text`);
  // the swarm followed the saucer down: the lane-to-swarm gap never changed
  const f = createFormation(originX(PLAY_W));
  const top = Math.min(...f.list.map((v) => v.y));
  const gap = (top - INVADER_H / 2) - (SAUCER.y + SAUCER.h / 2);
  check(Math.abs(gap - 28) < 1e-9, `the lane-to-swarm gap is ${gap}, not 28`);
  // wave 2 comes down at the same height as wave 1
  const game = createGame({ playW: PLAY_W, rand: HALF });
  nextWave(game);
  const top2 = Math.min(...game.formation.list.map((v) => v.y));
  checkEqual(top2, top, 'the second wave came down at a different height');
  // the deadline still allows a fair march: eight drops or more from fresh
  const lowest = Math.max(...f.list.map((v) => v.y)) + INVADER_H / 2;
  const drops = Math.floor((DEADLINE_Y - lowest) / STEP_Y);
  check(drops >= 8, `a fresh wave breaches after ${drops} drops`);
});

scenario('cover is the game: bunkers hold, open sky kills', () => {
  // tucked under a bunker, silent and still: the line holds the whole spell
  const dug = createGame({ playW: PLAY_W, rand: HALF });
  dug.player.x = dug.shields[0].x + dug.shields[0].w / 2;
  for (let t = 0; t < 45; t += H) update(dug, H, {});
  check(!dug.over, '45 s under a bunker ended the run anyway');
  checkEqual(dug.lives, PLAYER.lives, 'cover cost a life');
  // the same cannon in the open, under the same sky: the guns find it fast
  const open = createGame({ playW: PLAY_W, rand: HALF });
  open.shields.forEach((s) => s.cells.forEach((row) => row.fill(false)));
  open.player.x = PLAY_W / 2;
  for (let t = 0; t < 45 && !open.over; t += H) update(open, H, {});
  check(open.over, '45 s standing in the open ended nothing');
  checkEqual(open.overReason, 'shot', `the open field killed by "${open.overReason}", not by fire`);
});

// ------------------------------------------------------------------ the words

scenario('everything the player reads exists in both languages', () => {
  const missing = missingKeys(dict);
  check(missing.length === 0, `half-translated keys: ${missing.join(', ')}`);
  for (const [key, side] of Object.entries(dict)) {
    check(side.pt && side.en, `${key} is written in one language`);
    check(side.pt !== side.en, `${key} reads the same twice — one side was pasted`);
  }
});

// ------------------------------------------------------------------ the pixels

const symmetric = (map) => map.every((row) => row === [...row].reverse().join(''));

scenario('the three breeds are symmetric, distinct, and shuffle two frames', () => {
  const seen = new Set();
  for (const row of [0, 1, 2, 3, 4]) {
    const breed = breedOf(row);
    for (const frame of [0, 1]) {
      const map = breedFrame(breed, frame);
      check(map.length > 0 && map.every((r) => r.length === map[0].length),
        `${breed} frame ${frame} is a ragged map`);
      check(symmetric(map), `${breed} frame ${frame} is lopsided — invaders mirror`);
      check(map.some((r) => r.includes('#')), `${breed} frame ${frame} is an empty sky`);
      seen.add(`${breed}:${map.join('/')}`);
    }
    check(breedFrame(breed, 0).join() !== breedFrame(breed, 1).join(),
      `${breed} shuffles nothing between frames`);
  }
  checkEqual(seen.size, 6, 'two breeds share a drawing');
  checkEqual(breedOf(0), 'squid', 'the top row is not the small one');
  checkEqual(breedOf(4), 'octo', 'the bottom row is not the big one');
});

// ------------------------------------------------------------------ the screen

scenario('the whole scene draws, and the pointer maps back onto the field', () => {
  const renderer = createRenderer();
  const game = createGame({ playW: PLAY_W, rand: HALF });
  const ctx = headlessContext();
  renderer.draw(ctx, game, 1280, 1.5, 999, 'Onda 1', 1);   // must not throw
  renderer.drawMenu(ctx, 1280, 1.5, game);                  // must not throw
  // the juice branches: a wobbling saucer, fresh debris, a blinking cannon
  game.saucer = { x: PLAY_W / 2, dir: 1, shotsSince: 0 };
  game.particles.push({ x: 400, y: 400, vx: 60, vy: -120, life: 0.8, age: 0.1, colour: '#ff5a5a' });
  game.bolts.push({ x: 300, y: 300, vx: 0, vy: BOLT.speed });
  game.invuln = 1;
  for (const t of [0, 0.7, 2.3]) renderer.draw(ctx, game, 1280, t, 999, '', 0);
  renderer.draw(ctx, game, 500, 1.1, 999, 'Onda 1', 1);     // narrow: the field shrinks
  // wide: the field sits 1:1, centered
  checkEqual(renderer.toPlayfield(160 + 100, 1280), 100, 'the wide mapping shifted');
  // narrow: the field shrinks and the finger follows it
  const scale = (500 - 16) / PLAY_W;
  const ox = (500 - PLAY_W * scale) / 2;
  const back = renderer.toPlayfield(ox + 480 * scale, 500);
  check(Math.abs(back - 480) < 1e-9, `the narrow mapping lands at ${back}, not 480`);
});

await run('invasores-espaciais');
