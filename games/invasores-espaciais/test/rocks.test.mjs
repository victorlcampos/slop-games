// Asteroid Belt, played in Node: the split, the ship, the wrap, the waves.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  rockCount, rockSpeed, create, update, drain, isOver, draw,
  saucerPeriod, saucerSpeed, saucerPay,
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
  game.saucerT = 999; // the crossing pest sits this one out
  game.rocks = []; // an empty sky: nothing eats the evidence
  game.clearT = 99; // ...and no next wave walks in mid-count
  for (let t = 0; t < 1; t += H) {
    update(game, H, { fire: true });
    check(game.bullets.length <= 4, `${game.bullets.length} shells out with a four-gun ship`);
  }
});

scenario('thrust has a speed limit', () => {
  const game = create(seq());
  game.saucerT = 999; // a lone ship, no interruptions
  for (let t = 0; t < 5; t += H) update(game, H, { up: true });
  check(Math.hypot(game.ship.vx, game.ship.vy) <= 461, 'five seconds of burn broke the limit');
});

scenario('the whole belt draws without a browser', () => {
  const game = create(seq());
  update(game, H, { fire: true, up: true, left: true });
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: 'Onda 2', bannerAlpha: 1 });
});

scenario('respawn clears the neighbourhood and grants three seconds', () => {
  const game = create(seq());
  game.saucerT = 999;
  game.invuln = 0;
  game.rocks.push({
    x: game.ship.x, y: game.ship.y, vx: 0, vy: 0,
    size: 1, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  });
  update(game, H, {});
  checkEqual(game.lives, 2, 'the killing rock cost the wrong number of lives');
  check(game.invuln > 2.9 && game.invuln <= 3, `grace is ${game.invuln}, not three seconds`);
  checkEqual(game.ship.x, PLAY_W / 2, 'the respawn is not back at centre');
  checkEqual(game.ship.y, WORLD_H / 2, 'the respawn is not back at centre');
  checkEqual(game.ship.vx, 0, 'the respawn keeps the dead drift');
  const nearest = Math.min(...game.rocks.map((r) => Math.hypot(r.x - game.ship.x, r.y - game.ship.y)));
  check(nearest > 150, `a rock waits ${nearest.toFixed(0)}px from the respawn`);
  for (let t = 0; t < 0.5; t += H) update(game, H, {});
  checkEqual(game.lives, 2, 'the respawn died standing still inside its own grace');
});

scenario('split children stay outrunnable, even on wave 9', () => {
  // forty aimed splits against a fast parent: the cap is a tail bound, so
  // sample the tail, not the middle.
  let top = 0;
  for (let k = 0; k < 40; k++) {
    const game = create(seq());
    game.invuln = 99;
    game.saucerT = 999;
    game.wave = 9;
    game.rocks = [{
      x: 480, y: 360, vx: 150, vy: 0,
      size: 3, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    }];
    game.bullets = [{ x: 480, y: 360, vx: 0, vy: 0, life: 0.9 }];
    update(game, H, {});
    for (const r of game.rocks) top = Math.max(top, Math.hypot(r.vx, r.vy));
  }
  check(top <= 240, `a wave 9 pebble runs ${top.toFixed(0)}px/s — nothing outruns that`);
});

scenario('thrust sheds sparks, shatter sheds debris, death sheds a burst', () => {
  const exhaust = create(seq());
  exhaust.invuln = 99;
  exhaust.saucerT = 999;
  for (let t = 0; t < 0.5; t += H) update(exhaust, H, { up: true });
  check(exhaust.particles.length > 0, 'half a second of burn left no sparks');

  const debris = (size) => {
    const game = create(seq());
    game.invuln = 99;
    game.saucerT = 999;
    const rock = {
      x: 480, y: 360, vx: 0, vy: 0,
      size, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    };
    game.rocks = [rock];
    game.bullets = [{ x: 480, y: 360, vx: 0, vy: 0, life: 0.9 }];
    update(game, H, {});
    return game.particles.length;
  };
  const big = debris(3);
  const med = debris(2);
  const small = debris(1);
  check(big > med && med > small, `debris does not scale with size: ${big}/${med}/${small}`);
  checkEqual(big, 16, `a big shatter shed ${big} sparks, not 16`);
  checkEqual(med, 12, `a medium shatter shed ${med} sparks, not 12`);
  checkEqual(small, 8, `a small burst shed ${small} sparks, not 8`);

  const death = create(seq());
  death.saucerT = 999;
  death.invuln = 0;
  death.rocks.push({
    x: death.ship.x, y: death.ship.y, vx: 0, vy: 0,
    size: 1, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  });
  update(death, H, {});
  checkEqual(death.lives, 2, 'the setup rock missed the ship');
  checkEqual(death.particles.length, 46, `the blast shed ${death.particles.length} sparks, not 46`);

  // sparks are mortal: three quiet seconds leave a clean sky
  death.clearT = 99; // freeze the waves, not the sparks
  for (let t = 0; t < 3; t += H) update(death, H, {});
  checkEqual(death.particles.length, 0, 'three seconds did not clear the sparks');

  // and bounded: a crowded sky plus one more shatter never overflows
  const cap = create(seq());
  cap.invuln = 99;
  cap.saucerT = 999;
  for (let i = 0; i < 410; i++) {
    cap.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 5, max: 5, color: '#fff', size: 2 });
  }
  cap.rocks = [{
    x: 480, y: 360, vx: 0, vy: 0,
    size: 3, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  }];
  cap.bullets = [{ x: 480, y: 360, vx: 0, vy: 0, life: 0.9 }];
  update(cap, H, {});
  check(cap.particles.length <= 400, `the spark tray holds ${cap.particles.length}, past its bound`);
});

scenario('the saucer keeps its appointment, sooner on later waves', () => {
  check(saucerPeriod(6) < saucerPeriod(1), 'later waves call the saucer no sooner');
  check(saucerPeriod(99) >= 6, 'the saucer never stops coming');
  check(saucerSpeed(6) > saucerSpeed(1), 'later saucers drift no faster');
  check(saucerSpeed(99) <= 200, 'a late saucer outruns its own bolts');
  const game = create(seq());
  game.invuln = 99;
  game.saucerT = 0.01;
  update(game, H, {});
  check(game.saucer !== null, 'the appointment passed with no saucer');
  check(drain(game).some((e) => e.name === 'saucer'), 'no saucer event left the belt');
  // one crossing at a time: two seconds hold exactly one appointment
  for (let t = 0; t < 2; t += H) update(game, H, {});
  check(!drain(game).some((e) => e.name === 'saucer'), 'a second saucer crossed mid-crossing');
});

scenario('the saucer drifts across and wraps the seam', () => {
  const game = create(seq());
  game.invuln = 99;
  game.saucerT = 0.01;
  update(game, H, {});
  const dir = Math.sign(game.saucer.vx);
  check(dir !== 0, 'the saucer hangs still');
  const cruise = saucerSpeed(game.wave);
  check(Math.abs(Math.abs(game.saucer.vx) - cruise) < cruise * 0.15,
    `the saucer cruises at ${Math.abs(game.saucer.vx).toFixed(0)}, not ~${cruise}`);
  const vx = game.saucer.vx;
  const x0 = game.saucer.x;
  update(game, H, {});
  check(Math.abs((game.saucer.x - x0) - vx * H) < 1e-9, 'the saucer does not hold its line');
  // parked past the edge, it re-enters from the far side like everything else
  game.saucer.x = dir > 0 ? PLAY_W + 59.5 : -59.5;
  update(game, H, {});
  check(dir > 0 ? game.saucer.x < 0 : game.saucer.x > PLAY_W,
    `the saucer did not wrap: ${game.saucer.x.toFixed(1)}`);
});

scenario('saucers shoot slow aimed bolts, few and dodgeable', () => {
  const game = create(seq());
  game.invuln = 99;
  game.saucerT = 999;
  game.ship.x = 700;
  game.ship.y = 360;
  game.ship.vx = 0;
  game.ship.vy = 0;
  game.saucer = { x: 100, y: 360, vx: 140, fireT: 0, life: 12 };
  update(game, H, {});
  checkEqual(game.sbolts.length, 1, 'a saucer with a loaded gun held its fire');
  const bolt = game.sbolts[0];
  checkEqual(Math.hypot(bolt.vx, bolt.vy).toFixed(0), '250', 'saucer bolts are not slow');
  check(bolt.vx > 0 && Math.abs(bolt.vy) < 60,
    `the bolt flies ${bolt.vx.toFixed(0)},${bolt.vy.toFixed(0)} — not at the ship`);
  check(drain(game).some((e) => e.name === 'shoot'), 'no shot event left the saucer');
  // a full watch: the sky never fills with red
  const watch = create(seq());
  watch.invuln = 99;
  watch.saucerT = 0.01;
  for (let t = 0; t < 14; t += H) {
    update(watch, H, {});
    check(watch.sbolts.length <= 3, `${watch.sbolts.length} saucer bolts out — dodgeable no more`);
  }
});

scenario('bolts die on rocks, kill on ships', () => {
  const rock = {
    x: 200, y: 200, vx: 0, vy: 0,
    size: 3, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  };
  const blocked = create(seq());
  blocked.invuln = 99;
  blocked.saucerT = 999;
  blocked.rocks = [{ ...rock }];
  blocked.sbolts = [{ x: 200, y: 200, vx: 0, vy: 0, life: 3 }];
  update(blocked, H, {});
  checkEqual(blocked.sbolts.length, 0, 'the rock did not eat the bolt');
  checkEqual(blocked.rocks.length, 1, 'the bolt chipped the rock it died on');
  checkEqual(blocked.score, 0, 'a dead bolt scored');

  const hit = create(seq());
  hit.saucerT = 999;
  hit.invuln = 0;
  hit.rocks = [{ ...rock, x: 100, y: 100 }];
  hit.sbolts = [{ x: hit.ship.x, y: hit.ship.y, vx: 0, vy: 0, life: 3 }];
  update(hit, H, {});
  checkEqual(hit.lives, 2, 'a bolt on the bridge cost no life');
  checkEqual(hit.sbolts.length, 0, 'the killing bolt flew on');
});

scenario('cracking the saucer pays 200 to 300, meaner waves pay more', () => {
  const crack = (wave) => {
    const game = create(seq());
    game.invuln = 99;
    game.saucerT = 999;
    game.wave = wave;
    game.saucer = { x: 300, y: 300, vx: 140, fireT: 99, life: 12 };
    game.bullets = [{ x: 300, y: 300, vx: 0, vy: 0, life: 0.9 }];
    update(game, H, {});
    return game;
  };
  const early = crack(1);
  checkEqual(early.score, 200, `wave 1 paid ${early.score}, not 200`);
  check(early.saucer === null, 'the cracked saucer flies on');
  const kill = drain(early).find((e) => e.name === 'saucerKill');
  check(kill && kill.pay === 200, 'no priced saucerKill event left the belt');
  check(early.saucerT > 0, 'the next appointment was never made');
  const late = crack(9);
  checkEqual(late.score, 300, `wave 9 paid ${late.score}, not 300`);
  check(late.score >= early.score, 'later waves pay the saucer no better');
  for (let wave = 1; wave <= 12; wave++) {
    const pay = saucerPay(wave);
    check(pay >= 200 && pay <= 300, `wave ${wave} pays ${pay}, outside 200–300`);
  }
});

scenario('ramming the pest wrecks you both, unpaid', () => {
  const game = create(seq());
  game.saucerT = 999;
  game.invuln = 0;
  game.saucer = { x: game.ship.x, y: game.ship.y, vx: 140, fireT: 99, life: 12 };
  update(game, H, {});
  checkEqual(game.lives, 2, 'ramming the saucer cost no life');
  check(game.saucer === null, 'the rammed saucer flies on');
  checkEqual(game.score, 0, 'ramming paid like marksmanship');
  check(!drain(game).some((e) => e.name === 'saucerKill'), 'ramming paid a killer bonus');
});

scenario('the blast clears bolts too, and the saucer leaves with the wave', () => {
  const game = create(seq());
  game.saucerT = 999;
  game.invuln = 0;
  game.rocks.push({
    x: game.ship.x, y: game.ship.y, vx: 0, vy: 0,
    size: 1, spin: 0, rot: 0, verts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  });
  game.sbolts = [
    { x: game.ship.x + 20, y: game.ship.y, vx: 0, vy: 0, life: 3 },
    { x: 100, y: 100, vx: 0, vy: 0, life: 3 },
  ];
  update(game, H, {});
  checkEqual(game.lives, 2, 'the setup rock missed the ship');
  checkEqual(game.sbolts.length, 1, 'the blast left a bolt parked on the respawn');
  check(Math.hypot(game.sbolts[0].x - game.ship.x, game.sbolts[0].y - game.ship.y) > 150,
    'the surviving bolt sits inside the cleared neighbourhood');

  const wave = create(seq());
  wave.invuln = 99;
  wave.saucer = { x: 400, y: 300, vx: 140, fireT: 99, life: 12 };
  wave.sbolts = [{ x: 400, y: 300, vx: 0, vy: 0, life: 3 }];
  wave.rocks = [];
  update(wave, H, {});
  check(drain(wave).some((e) => e.name === 'clear'), 'no clear event left the belt');
  for (let t = 0; t < 2.2; t += H) update(wave, H, {});
  checkEqual(wave.wave, 2, 'the second belt never came down');
  check(wave.saucer === null, 'the old saucer rode into the new wave');
  checkEqual(wave.sbolts.length, 0, 'old bolts rode into the new wave');
  check(wave.saucerT > 0, 'the new wave set no saucer appointment');
});

scenario('the full circus draws without a browser', () => {
  const game = create(seq());
  game.invuln = 99;
  game.saucer = { x: 400, y: 300, vx: 140, fireT: 99, life: 12 };
  game.sbolts = [{ x: 410, y: 300, vx: -250, vy: 0, life: 3 }];
  update(game, H, { fire: true, up: true, left: true });
  check(game.particles.length > 0, 'a burning ship sheds no sparks to draw');
  draw(headlessContext(), game, { time: 0.25, W: 1280, best: 999, banner: '', bannerAlpha: 0 });
});

await run('asteroid belt');
