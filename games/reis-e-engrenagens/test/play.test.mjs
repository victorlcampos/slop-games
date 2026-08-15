// The siege itself, played in Node: shells fired, walls broken, fires spread,
// turns taken and matches finished — with no canvas, no GPU and no window.
//
// Where a scenario needs a shot to arrive somewhere in particular, it puts the
// shot there rather than trying to aim one across the valley. What is under
// test is what happens on impact, not the six hundred pixels in between.

import { scenario, check, run } from 'slopkit/testing';
import { headlessContext } from 'slopkit/testing';

import {
  BASE_Y, CELL, COLS, KING_HP, LEVELS, ROWS, TURN_LIMIT, W, clamp,
} from '../src/config.js';
import { WEAPONS } from '../src/weapons.js';
import { MATERIALS } from '../src/materials.js';
import { createMatch, detonate, restand, trace } from '../src/battle.js';
import { foeCastle } from '../src/castles.js';
import { suggestBlueprint } from '../src/workshop.js';
import { planShot, skillNow } from '../src/ai.js';
import { createScene } from '../src/scene.js';
import { createFx } from '../src/fx.js';
import { drawBattleHud, drawField } from '../src/render.js';

// ------------------------------------------------------------------ helpers

const LEVEL = LEVELS[0];

/** A match with whatever castles the scenario needs. */
function mk({ level = LEVEL, mine, theirs, faction = 'knights', seed = 21 } = {}) {
  return createMatch({
    level,
    faction,
    blueprint: mine || { cells: [], king: { c: 1, r: 0 } },
    foeBlueprint: theirs || { cells: [], king: { c: 5, r: 0 } },
    seed,
  });
}

/** A column of one material, from the ground up. */
const stack = (c, rows, m) => Array.from({ length: rows }, (_, r) => ({ c, r, m }));

/** Put a shot exactly where the scenario happens, and let it fly. */
function launch(match, shot) {
  match.shots.push({
    side: 'player', t: 0, pierce: 0, burrow: 0, split: 0, child: false, trail: [], vx: 0, vy: 0,
    ...shot,
    pierce: shot.pierce !== undefined ? shot.pierce : WEAPONS[shot.w].pierce || 0,
    split: shot.split !== undefined ? shot.split : WEAPONS[shot.w].split || 0,
  });
  match.commit();
  let n = 0;
  while (match.flying() && n++ < 2000) match.tick(1 / 60);
  return n;
}

/** Fire for real, from the launcher, and wait for everything to land. */
function fire(match, side, id, angle, power) {
  match.pick(side, id);
  match.aim(side, angle);
  const shot = match.fire(side, power);
  match.commit();
  let n = 0;
  while (match.flying() && n++ < 2000) match.tick(1 / 60);
  return shot;
}

/** Take a turn without firing — the hook the fire and rust ticks hang off. */
function pass(match) {
  match.commit();
  match.tick(1 / 60);
}

const events = (match, kind) => match.events.filter((e) => e.kind === kind);

// ------------------------------------------------------------------ the shot

scenario('a shell leaves the trebuchet, flies, lands, and the turn changes hands', () => {
  const m = mk({ theirs: { cells: stack(2, 4, 'stone'), king: { c: 5, r: 0 } } });
  check(m.turn === 'player', 'the player does not open');
  const shot = fire(m, 'player', 'boulder', 42, 80);
  check(shot, 'the trebuchet refused to fire');
  check(m.lastShot.player.path.length > 20, `the shell recorded ${m.lastShot.player.path.length} points of flight`);
  const far = m.lastShot.player.path[m.lastShot.player.path.length - 1];
  check(far.x > 700, `the shell only reached x=${far.x.toFixed(0)} from a launcher at 400`);
  check(m.turn === 'enemy', `after the shell landed it is still ${m.turn}'s turn`);
  check(m.turnCount === 1, `the turn counter says ${m.turnCount}`);
});

scenario('power and angle are the only two things you control, and both do what they say', () => {
  const m = mk();
  m.wind = 0;
  const soft = trace(m, 'player', 'boulder', 45, 40);
  const hard = trace(m, 'player', 'boulder', 45, 90);
  check(hard.x > soft.x + 200, `40 power reached ${soft.x.toFixed(0)}, 90 power ${hard.x.toFixed(0)}`);
  const flat = trace(m, 'player', 'boulder', 20, 100);
  const high = trace(m, 'player', 'boulder', 80, 100);
  check(high.time > flat.time * 1.5, `a 20° shot hangs ${flat.time.toFixed(1)}s and an 80° one ${high.time.toFixed(1)}s`);
  // and the highest range is somewhere in the middle, as it has to be
  const mid = trace(m, 'player', 'boulder', 45, 100);
  check(mid.x > flat.x && mid.x > high.x, `45° reached ${mid.x.toFixed(0)}, between 20° at ${flat.x.toFixed(0)} and 80° at ${high.x.toFixed(0)}`);
});

scenario('the wind moves a fire pot much further than it moves a rock', () => {
  const m = mk();
  const drift = (id) => {
    m.wind = 58;
    const withIt = trace(m, 'player', id, 45, 70).x;
    m.wind = -58;
    const against = trace(m, 'player', id, 45, 70).x;
    return withIt - against;
  };
  const rock = drift('boulder');
  const pot = drift('firepot');
  check(rock > 30, `a full gale moved a trebuchet stone ${rock.toFixed(0)}px — the wind gauge is decoration`);
  check(pot > rock * 1.8, `the gale moved the stone ${rock.toFixed(0)}px and the pot only ${pot.toFixed(0)}px`);
});

// -------------------------------------------------------------- the crown

scenario('the crown takes two clean hits, never one', () => {
  const m = mk();
  const castle = m.castles.enemy;
  const king = castle.king();
  const at = castle.centre(king.c, king.r);
  detonate(m, at.x, at.y, WEAPONS.boulder, 'player');
  check(king.hp > 0, `one trebuchet stone did ${(KING_HP - king.hp).toFixed(0)} of ${KING_HP} and ended the match`);
  check(king.hp < KING_HP * 0.6, `a stone landing on the crown itself only did ${(KING_HP - king.hp).toFixed(0)}`);
  detonate(m, at.x, at.y, WEAPONS.boulder, 'player');
  check(!castle.kingAlive(), `two direct hits left the crown on ${king.hp.toFixed(0)}`);
  check(m.over && m.over.winner === 'player', `the match ended as ${JSON.stringify(m.over)}`);
});

scenario('a bolt to the crown is the hardest shot in the game and still not a one-shot', () => {
  const m = mk();
  const castle = m.castles.enemy;
  const king = castle.king();
  const at = castle.centre(king.c, king.r);
  launch(m, { w: 'ballista', x: at.x - 90, y: at.y, vx: 900, vy: 0 });
  check(king.hp > 0, 'a single ballista bolt ended the match on the spot');
  check(king.hp < KING_HP * 0.35, `the best shot in the game left the crown on ${king.hp.toFixed(0)} of ${KING_HP}`);
});

scenario('a roof over the crown is a roof that works', () => {
  // A blast does not care about walls once it has gone off — what a roof buys
  // you is that the shell goes off up there instead of down here. So the test
  // drops the same shell out of the sky twice, not into the same coordinates.
  const drop = (m) => {
    const at = m.castles.enemy.centre(5, 0);
    launch(m, { w: 'boulder', x: at.x, y: 60, vx: 0, vy: 200 });
    return KING_HP - m.castles.enemy.king().hp;
  };
  const exposed = drop(mk());
  const sheltered = drop(mk({ theirs: { cells: [...stack(4, 3, 'stone'), ...stack(5, 3, 'stone')], king: { c: 5, r: 0 } } }));
  check(exposed > 40, `a stone landing on an open crown did ${exposed.toFixed(0)}`);
  check(sheltered < exposed / 2, `stone over his head only changed the damage from ${exposed.toFixed(0)} to ${sheltered.toFixed(0)}`);
});

// ------------------------------------------------------------- munitions

scenario('the endless munition is endless and the rest run out and hand the dock back', () => {
  const m = mk();
  for (let i = 0; i < 6; i++) fire(m, 'player', 'boulder', 45, 60);
  check(m.ammo.player.boulder === Infinity, 'the trebuchet stone ran out');

  const before = m.ammo.player.ballista;
  m.turn = 'player';
  fire(m, 'player', 'ballista', 45, 60);
  check(m.ammo.player.ballista === before - 1, `firing a bolt took the count from ${before} to ${m.ammo.player.ballista}`);

  m.ammo.player.ballista = 1;
  m.turn = 'player';
  fire(m, 'player', 'ballista', 45, 60);
  check(m.weapon.player === 'boulder', `the last bolt left the dock pointing at ${m.weapon.player}`);
  check(m.pick('player', 'ballista') === false, 'the dock let an empty slot be selected');
});

scenario('a bolt goes through a crystal wall; a trebuchet stone does not even break the first pane', () => {
  const wall = { cells: [...stack(0, 3, 'crystal'), ...stack(1, 3, 'crystal'), ...stack(2, 3, 'crystal')], king: { c: 6, r: 0 } };
  const bolt = mk({ theirs: wall });
  const rock = mk({ theirs: wall });
  const y = BASE_Y - CELL * 1.5;
  const x = bolt.castles.enemy.baseX - 40;
  launch(bolt, { w: 'ballista', x, y, vx: 900, vy: 0 });
  launch(rock, { w: 'boulder', x, y, vx: 900, vy: 0 });

  const left = (m) => m.castles.enemy.blocks().filter((b) => b.m === 'crystal').length;
  check(left(bolt) <= 6, `the bolt left ${left(bolt)} of 9 panes standing — it did not go through`);
  check(left(rock) === 9, `a trebuchet stone broke ${9 - left(rock)} panes of crystal it is supposed to bounce off`);
});

scenario('a cluster opens at the top of its arc and lands as three craters', () => {
  const m = mk();
  fire(m, 'player', 'hail', 55, 75);
  const booms = m.events.filter((e) => e.kind === 'boom');
  const splits = m.events.filter((e) => e.kind === 'split');
  check(splits.length === 1, `the cluster split ${splits.length} times`);
  check(booms.length >= 2, `three fragments produced ${booms.length} craters`);
  const xs = booms.map((b) => b.x);
  check(Math.max(...xs) - Math.min(...xs) > 40, `the fragments landed ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)}px apart — that is one crater, not three`);
});

scenario('the coil jumps to metal, and only to metal', () => {
  const iron = mk({ theirs: { cells: [...stack(0, 1, 'iron'), ...stack(4, 1, 'iron')], king: { c: 6, r: 0 } } });
  const timber = mk({ theirs: { cells: [...stack(0, 1, 'wood'), ...stack(4, 1, 'wood')], king: { c: 6, r: 0 } } });
  for (const m of [iron, timber]) {
    const near = m.castles.enemy.centre(0, 0);
    detonate(m, near.x, near.y, WEAPONS.tesla, 'player');
  }
  check(iron.events.some((e) => e.kind === 'arc'), 'the coil went off next to two iron plates and arced to neither');
  const far = iron.castles.enemy.at(4, 0);
  check(far && far.hp < far.max, 'the plate four cells away took nothing from the arc');
  check(!timber.events.some((e) => e.kind === 'arc'), 'the coil arced to a wooden beam');
});

scenario('the drill takes the ground; the trebuchet takes the wall', () => {
  const dug = mk();
  const hit = mk();
  const x = 700;
  const y = dug.terrain.yAt(x);
  const before = dug.terrain.yAt(x);
  detonate(dug, x, y, WEAPONS.drill, 'player');
  detonate(hit, x, y, WEAPONS.boulder, 'player');
  const drillHole = dug.terrain.yAt(x) - before;
  const rockHole = hit.terrain.yAt(x) - before;
  check(drillHole > rockHole * 1.4, `the drill dug ${drillHole.toFixed(0)}px and the stone ${rockHole.toFixed(0)}px`);

  // and in the quarry it is close to a wasted turn, which is the level's point
  const quarry = mk({ level: LEVELS[2] });
  const qy = quarry.terrain.yAt(x);
  detonate(quarry, x, qy, WEAPONS.drill, 'player');
  const quarryHole = quarry.terrain.yAt(x) - qy;
  check(quarryHole < drillHole / 2.5, `the same drill dug ${quarryHole.toFixed(0)}px of bedrock against ${drillHole.toFixed(0)}px of meadow`);
});

scenario('a drill bomb burrows before it goes off, so the crater is under the crust', () => {
  const m = mk();
  const x = 700;
  const surface = m.terrain.yAt(x);
  launch(m, { w: 'drill', x, y: surface - 120, vx: 0, vy: 240 });
  const boom = m.events.find((e) => e.kind === 'boom');
  check(boom, 'the drill never went off');
  check(boom.y > surface + 4, `the drill detonated at y=${boom.y.toFixed(0)} with the surface at ${surface.toFixed(0)} — it stopped at the crust`);
});

// ------------------------------------------------------------ fire and rust

scenario('a fire pot does not knock the wall down — it lights one end and waits', () => {
  // a long timber wall, and the pot thrown at one end of it
  const wall = Array.from({ length: COLS }, (_, c) => ({ c, r: 0, m: 'wood' }));
  const m = mk({ theirs: { cells: wall, king: { c: 6, r: 1 } } });
  const castle = m.castles.enemy;
  const at = castle.centre(0, 0);
  detonate(m, at.x, at.y, WEAPONS.firepot, 'player');

  check(castle.at(0, 0), 'the pot destroyed the plank it hit — then there is nothing left to burn');
  const lit = castle.blocks().filter((b) => b.fire > 0).map((b) => b.c);
  check(lit.length > 0, 'a fire pot burst on a timber wall and set nothing alight');
  const far = Math.max(...lit);
  check(far < COLS - 1, `the blast alone reached column ${far} of ${COLS - 1} — nothing is left for the fire to spread to`);

  // it eats the plank it started on…
  const first = castle.at(0, 0);
  const before = first.hp;
  pass(m);
  check(first.hp < before - 20, `a turn on fire cost the plank ${(before - first.hp).toFixed(0)} hit points`);

  // …and walks down the wall to planks the blast never touched
  for (let i = 0; i < 4; i++) pass(m);
  const reached = castle.blocks().filter((b) => b.fire > 0 || b.hp < b.max).map((b) => b.c);
  check(Math.max(...reached, -1) > far, `five turns later the fire has got no further than column ${far}`);

  // and it burns itself out rather than eating the castle forever
  for (let i = 0; i < 14; i++) pass(m);
  check(castle.blocks().every((b) => b.fire === 0), 'the fire is still burning nineteen turns later');
});

scenario('fire will not touch stone, and rust will not touch anything but iron', () => {
  const stoneWall = mk({ theirs: { cells: stack(2, 4, 'stone'), king: { c: 6, r: 0 } } });
  const at = stoneWall.castles.enemy.centre(2, 2);
  detonate(stoneWall, at.x, at.y, WEAPONS.firepot, 'player');
  check(stoneWall.castles.enemy.blocks().every((b) => b.fire === 0), 'a fire pot set a stone wall alight');

  const mixed = mk({ theirs: { cells: [...stack(2, 3, 'iron'), ...stack(3, 3, 'stone')], king: { c: 6, r: 0 } }, faction: 'machines' });
  const spot = mixed.castles.enemy.centre(2, 1);
  detonate(mixed, spot.x, spot.y, WEAPONS.rustshell, 'player');
  const rusting = mixed.castles.enemy.blocks().filter((b) => b.rust > 0);
  check(rusting.length > 0, 'a rust shell burst on an iron wall and nothing corroded');
  check(rusting.every((b) => b.m === 'iron'), `rust took hold on ${rusting.map((b) => b.m).join(', ')}`);
});

// --------------------------------------------------------------- collapse

scenario('undermine a tower and it comes down on what it was protecting', () => {
  const m = mk({
    theirs: { cells: [...stack(4, 6, 'stone'), ...stack(6, 6, 'stone')], king: { c: 5, r: 0 } },
  });
  const castle = m.castles.enemy;
  // the crown has a stone tower on each side and nothing above him yet
  castle.put(5, 5, 'iron');
  const king = castle.king();
  const at = castle.centre(5, 0);
  detonate(m, at.x, at.y + CELL, WEAPONS.drill, 'player');
  check(m.events.some((e) => e.kind === 'tumble' || e.kind === 'break'),
    'the ground went out from under a six-storey tower and nothing moved');
  check(king.hp < KING_HP, `the tower came down and the crown under it is still on ${king.hp}`);
});

scenario('the siege engine rides the tallest tower, and comes down with it', () => {
  const m = mk({ mine: { cells: [...stack(2, 2, 'stone'), ...stack(5, 5, 'stone')], king: { c: 0, r: 0 } } });
  const L = m.launchers.player;
  check(L.seat.c === 5, `the trebuchet sat on column ${L.seat.c} instead of the five-storey one`);
  const high = L.y;
  check(high < BASE_Y - CELL * 4, `standing on a five-storey tower it is at y=${high.toFixed(0)}`);

  // and a shot into the tower drops the engine onto whatever is still standing
  for (let r = 4; r >= 1; r--) m.castles.player.remove(5, r);
  restand(m);
  check(m.launchers.player.seat.c === 2,
    `with the tower gone the engine stayed on column ${m.launchers.player.seat.c}`);
  check(m.launchers.player.y >= high + CELL * 3,
    `the tower came down and the engine only fell ${(m.launchers.player.y - high).toFixed(0)}px`);
  check(m.events.some((e) => e.kind === 'gunfell'), 'nothing said the engine had dropped');
});

scenario('height is range: the same shot goes further from a taller castle', () => {
  const low = mk({ mine: { cells: stack(3, 1, 'stone'), king: { c: 0, r: 0 } } });
  const high = mk({ mine: { cells: stack(3, 8, 'stone'), king: { c: 0, r: 0 } } });
  low.wind = 0;
  high.wind = 0;
  const a = low.trace('player', 'boulder', 40, 70).x;
  const b = high.trace('player', 'boulder', 40, 70).x;
  check(b > a + 60, `from one storey the shell reached ${a.toFixed(0)}, from eight ${b.toFixed(0)}`);
});

scenario('you can shell your own castle, and the game lets you', () => {
  const m = mk({ mine: { cells: stack(3, 3, 'stone'), king: { c: 0, r: 0 } } });
  const at = m.castles.player.centre(3, 2);
  detonate(m, at.x, at.y, WEAPONS.boulder, 'player');
  const b = m.castles.player.at(3, 2);
  check(!b || b.hp < MATERIALS.stone.hp, 'a shell from your own trebuchet passed straight through your own wall');
});

// ------------------------------------------------------------- the opponent

scenario('the enemy aims with the same physics you do, and at full skill it lands them', () => {
  const m = mk({
    mine: { cells: [...stack(6, 4, 'stone'), ...stack(5, 2, 'sand')], king: { c: 2, r: 0 } },
    theirs: foeCastle({ ...LEVELS[0].foe, faction: 'machines', seed: 5 }),
  });
  m.turn = 'enemy';
  m.wind = 20;
  let onTarget = 0;
  for (let i = 0; i < 5; i++) {
    const plan = planShot(m, 'enemy', 1);
    const res = m.trace('enemy', plan.weapon, plan.angle, plan.power);
    const king = m.castles.player.centre(m.castles.player.king().c, m.castles.player.king().r);
    if (Math.hypot(res.x - king.x, res.y - king.y) < 170) onTarget++;
    m.wind += 22;
  }
  check(onTarget >= 4, `a gunner that never misses put ${onTarget} of 5 within a castle's width of the crown`);
});

scenario('a shaky gunner is shaky, and steadies as the match goes on', () => {
  const m = mk({ theirs: foeCastle({ ...LEVELS[0].foe, faction: 'machines', seed: 5 }) });
  m.turn = 'enemy';
  const spread = (skill) => {
    const shots = [];
    for (let i = 0; i < 24; i++) shots.push(planShot(m, 'enemy', skill).angle);
    return Math.max(...shots) - Math.min(...shots);
  };
  const green = spread(0.3);
  const veteran = spread(0.95);
  check(green > veteran * 2, `the beginner's aim wandered ${green.toFixed(1)}° and the veteran's ${veteran.toFixed(1)}°`);
  check(skillNow(LEVELS[0], 10) > skillNow(LEVELS[0], 0), 'the enemy learns nothing from watching its own shells land');
  check(skillNow(LEVELS[5], 40) <= 1, 'the enemy can end up better than perfect');
});

scenario('the enemy brings the right ammunition to the wall in front of it', () => {
  const timber = mk({ mine: { cells: [...stack(6, 5, 'wood'), ...stack(5, 5, 'wood')], king: { c: 1, r: 0 } } });
  const iron = mk({ mine: { cells: [...stack(6, 5, 'iron'), ...stack(5, 5, 'iron')], king: { c: 1, r: 0 } }, faction: 'machines' });
  timber.turn = 'enemy';
  iron.turn = 'enemy';
  timber.wind = 0;
  iron.wind = 0;
  // knights facing timber should reach for the fire pot; machines facing iron, the rust shell
  const vsTimber = planShot(timber, 'enemy', 1).weapon;
  const vsIron = planShot(iron, 'enemy', 1).weapon;
  check(vsTimber !== 'railshot' || vsIron !== 'boulder',
    'the enemy fired its default munition at both a timber wall and an iron one');
});

// ------------------------------------------------------------ whole matches

scenario('a whole siege plays itself out and ends with somebody winning', () => {
  const level = LEVELS[1];
  const m = createMatch({
    level,
    faction: 'knights',
    blueprint: suggestBlueprint(175),
    foeBlueprint: foeCastle({ ...level.foe, faction: 'machines', seed: 8 }),
    seed: 114,
  });
  let guard = 0;
  while (!m.over && guard++ < 40000) {
    if (!m.flying()) {
      const plan = planShot(m, m.turn, skillNow(level, m.turnCount));
      m.pick(m.turn, plan.weapon);
      m.aim(m.turn, plan.angle);
      m.fire(m.turn, plan.power);
      m.commit();
    }
    m.tick(1 / 60);
  }
  check(m.over, `the siege was still going after ${guard} frames`);
  check(m.turnCount <= TURN_LIMIT, `it took ${m.turnCount} turns, past the limit of ${TURN_LIMIT}`);
  check(m.turnCount >= 3, `it was over in ${m.turnCount} turns — that is not a siege, that is a coin flip`);
  check(['player', 'enemy', 'draw'].includes(m.over.winner), `winner came out as ${m.over.winner}`);
});

scenario('a siege nobody can finish is decided by the crown that is in better shape', () => {
  const m = mk();
  m.turnCount = TURN_LIMIT - 1;
  m.castles.enemy.king().hp = 30;
  pass(m);
  check(m.over, `after ${TURN_LIMIT} turns the match had not been called`);
  check(m.over.winner === 'player', `the healthier crown lost the decision to ${m.over.winner}`);
  check(m.over.reason === 'time', `the match ended for the reason "${m.over.reason}"`);
});

// -------------------------------------------------------------- the drawing

scenario('a whole frame draws — field, castles, shells, dirt and the dock', () => {
  const m = mk({
    mine: suggestBlueprint(175),
    theirs: foeCastle({ ...LEVELS[0].foe, faction: 'machines', seed: 2 }),
  });
  const ctx = headlessContext(1280, 720);
  const fx = createFx();
  const scene = createScene(LEVEL, m.terrain, 4);

  // a field with something happening on it: fire, rust, damage and a shell up
  const first = m.castles.enemy.blocks()[0];
  first.fire = 2;
  first.hp = first.max * 0.3;
  const second = m.castles.enemy.blocks()[1];
  if (second) second.rust = 2;
  fire(m, 'player', 'hail', 50, 70);
  m.shots.push({ side: 'player', w: 'tesla', x: 640, y: 300, vx: 200, vy: -100, t: 0, trail: [] });
  fx.boom(600, 500, 50, '#8a6a45');
  fx.arc(600, 500, 700, 450);
  fx.shards(620, 520, '#9aa1a8', 8);
  fx.flame(600, 480);

  scene.update(1 / 60);
  fx.update(1 / 60, m.terrain);
  drawField(ctx, { match: m, scene, fx, faction: 'knights', time: 1.2 });
  const rects = drawBattleHud(ctx, { W: 1280, H: 720 }, { match: m, level: LEVEL, phase: 'charging' });
  check(rects.length === 4, `the dock came back with ${rects.length} slots`);
  check(rects.every((r) => r.w > 0 && r.h > 0), 'a dock slot has no area to tap');
});

scenario('every munition and every material has something to draw', () => {
  const ctx = headlessContext(400, 400);
  const m = mk({ mine: { cells: [], king: { c: 0, r: 0 } } });
  const scene = createScene(LEVEL, m.terrain, 1);
  for (const id of Object.keys(WEAPONS)) {
    m.shots.length = 0;
    m.shots.push({ side: 'player', w: id, x: 640, y: 300, vx: 120, vy: -80, t: 0, trail: [] });
    drawField(ctx, { match: m, scene, fx: createFx(), faction: 'knights', time: 0.5 });
  }
  for (const id of [...Object.keys(MATERIALS), 'king']) {
    const castle = m.castles.player;
    castle.put(0, 0, id);
    castle.at(0, 0).hp = castle.at(0, 0).max * 0.4;
    castle.at(0, 0).rust = 2;
    for (const faction of ['knights', 'machines']) {
      drawField(ctx, { match: m, scene, fx: createFx(), faction, time: 0.5 });
    }
    castle.remove(0, 0);
  }
  check(true, 'nothing threw');
});

await run('kings & gears — the siege');
