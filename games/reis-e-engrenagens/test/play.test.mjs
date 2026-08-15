// The siege itself, played in Node: shells fired, walls broken, fires spread,
// turns taken and matches finished — with no canvas, no GPU and no window.
//
// Where a scenario needs a shot to arrive somewhere in particular, it puts the
// shot there rather than trying to aim one across the valley. What is under
// test is what happens on impact, not the six hundred pixels in between.

import { scenario, check, run } from 'slopkit/testing';
import { headlessContext } from 'slopkit/testing';

import {
  BASE_Y, CASTLE_X, CELL, COLS, COL_W, DRIVE_FUEL, KING_HP, LEASH, LEVELS, NCOL, ROWS, TURN_LIMIT, W,
} from '../src/config.js';
import { MINIONS, MINION_CAP, WAVE_EVERY, summon } from '../src/minions.js';
import { AMMO_CAP, WEAPONS } from '../src/weapons.js';
import { MATERIALS } from '../src/materials.js';
import { createMatch, detonate, restand, trace } from '../src/battle.js';
import { foeCastle } from '../src/castles.js';
import { suggestBlueprint } from '../src/workshop.js';
import { pickTarget, planDrive, planShot, skillNow } from '../src/ai.js';
import { MACHINE_PROPS, MEDIEVAL_PROPS, createScene, towardMachines } from '../src/scene.js';
import { createFx } from '../src/fx.js';
import { drawBattleHud, drawField, drawShopHud } from '../src/render.js';
import { createWorkshop } from '../src/workshop.js';
import { defaultLoadout } from '../src/weapons.js';

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

scenario('the battle is fought with the rack you paid for, not the shipped one', () => {
  const m = createMatch({
    level: LEVELS[0],
    faction: 'knights',
    blueprint: { cells: [], king: { c: 1, r: 0 } },
    foeBlueprint: { cells: [], king: { c: 5, r: 0 } },
    loadout: { firepot: 0, ballista: 7, hail: 1 },
    seed: 4,
  });
  check(m.ammo.player.boulder === Infinity, 'buying a custom rack cost the endless shot');
  check(m.ammo.player.firepot === 0, `a rack sold down to nothing still holds ${m.ammo.player.firepot} fire pots`);
  check(m.ammo.player.ballista === 7, `seven bolts were bought and ${m.ammo.player.ballista} arrived`);
  check(m.ammo.player.hail === 1, `one cluster was bought and ${m.ammo.player.hail} arrived`);
  check(m.pick('player', 'firepot') === false, 'an empty slot in the rack could still be selected');
});

scenario('the forge gunner arrives with a deeper rack than the meadow one', () => {
  const at = (level) => mk({ level }).ammo.enemy;
  const meadow = at(LEVELS[0]);
  const forge = at(LEVELS[5]);
  for (const id of Object.keys(forge)) {
    if (forge[id] === Infinity) continue;
    check(forge[id] === Math.min(AMMO_CAP, WEAPONS[id].ammo + LEVELS[5].foe.tier),
      `at the forge the enemy has ${forge[id]} ${id} — the tier is supposed to feed the rack`);
    check(forge[id] > meadow[id], `the forge gunner has no more ${id} than the meadow one`);
  }
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

scenario('the ground is solid all the way to the edges of the world', () => {
  // It was not: `solid` checked that x was on the map before it checked the
  // height, so the last hill at each end was hollow and a shell that overshot
  // slid through it and was scored a miss.
  const m = mk();
  for (const x of [-30, 4, W - 4, W + 30]) {
    const y = m.terrain.yAt(x);
    check(m.terrain.solid(x, y + 20), `the ground at x=${x} is not solid 20px below its own surface`);
    check(!m.terrain.solid(x, y - 20), `the air 20px above the ground at x=${x} is solid`);
  }
  // and a shell fired flat at the end of the world stops in it
  const res = m.trace('player', 'boulder', 6, 100);
  check(res.kind !== 'out' || res.x < 0, `a flat shot came back as ${res.kind} at x=${res.x.toFixed(0)}`);
});

scenario('a drill bomb burrows before it goes off, so the crater is under the crust', () => {
  const m = mk();
  const x = 700;
  const surface = m.terrain.yAt(x);
  launch(m, { w: 'drill', x, y: surface - 120, vx: 0, vy: 240 });
  const boom = m.events.find((e) => e.kind === 'boom');
  check(boom, 'the drill never went off');
  check(boom.y > surface + 4, `the drill detonated at y=${boom.y.toFixed(0)} with the surface at ${surface.toFixed(0)} — it stopped at the crust`);
  check(m.events.some((e) => e.kind === 'burrow'), 'nothing marked where it went in');

  // and it does not travel half the map underground on the way. A long burrow
  // is a shell visibly sliding through solid ground, which reads as the
  // collision being broken however deliberate it is.
  const went = m.events.find((e) => e.kind === 'burrow');
  const dug = Math.hypot(boom.x - went.x, boom.y - went.y);
  check(dug < 120, `it tunnelled ${dug.toFixed(0)}px from where it broke the crust`);
  check(dug > 10, `it only got ${dug.toFixed(0)}px in — that is not a burrow, that is a bounce`);
});

scenario('a shell that has broken the crust is no longer on the trail you can see', () => {
  const m = mk();
  fire(m, 'player', 'drill', 45, 62);
  const trail = m.lastShot.player.path;
  const last = trail[trail.length - 1];
  check(trail.length > 10, `the trail recorded ${trail.length} points`);
  check(last.y <= m.terrain.yAt(last.x) + 6,
    `the ghost trail carries on ${(last.y - m.terrain.yAt(last.x)).toFixed(0)}px into the hill`);
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

scenario('the siege engine starts on the tallest tower and comes down with it', () => {
  const m = mk({ mine: { cells: [...stack(2, 2, 'stone'), ...stack(5, 5, 'stone')], king: { c: 0, r: 0 } } });
  const L = m.launchers.player;
  const high = L.y;
  check(Math.abs(L.x - m.castles.player.centre(5, 0).x) < 1,
    `the trebuchet started at x=${L.x.toFixed(0)} instead of over the five-storey column`);
  check(high < BASE_Y - CELL * 4, `standing on a five-storey tower it is at y=${high.toFixed(0)}`);

  // and a shot into the tower drops it onto whatever is left underneath
  for (let r = 4; r >= 1; r--) m.castles.player.remove(5, r);
  restand(m);
  check(m.launchers.player.y >= high + CELL * 3,
    `the tower came down and the engine only fell ${(m.launchers.player.y - high).toFixed(0)}px`);
  check(m.events.some((e) => e.kind === 'gunfell'), 'nothing said the engine had dropped');
});

// -------------------------------------------------------------- driving

scenario('the engine drives, and the tank empties as it goes', () => {
  // a flat one-storey castle, so every step is a flat step and the arithmetic
  // is the arithmetic and not the terrain
  const m = mk({ mine: { cells: Array.from({ length: COLS }, (_, c) => ({ c, r: 0, m: 'stone' })), king: { c: 0, r: 1 } } });
  const L = m.launchers.player;
  check(L.fuel === DRIVE_FUEL, `it starts the turn with ${L.fuel} of ${DRIVE_FUEL}`);
  check(L.y === BASE_Y - CELL, `it is at y=${L.y} rather than on top of a one-cell wall`);
  const from = L.x;
  const moved = m.drive('player', 60);
  check(Math.abs(moved - 60) < 0.01, `asked for 60px and got ${moved.toFixed(1)}`);
  check(Math.abs(L.x - (from + 60)) < 0.01, 'it did not actually move');
  check(L.fuel === DRIVE_FUEL - 60, `60px of flat driving cost ${DRIVE_FUEL - L.fuel}`);

  // it runs dry, and the last step is a short one rather than a refusal
  let total = 60;
  for (let i = 0; i < 40; i++) total += Math.abs(m.drive('player', 8));
  check(L.fuel === 0, `after forty more steps there is still ${L.fuel.toFixed(0)} in the tank`);
  check(total > DRIVE_FUEL * 0.4 && total <= DRIVE_FUEL + 0.01, `one tank covered ${total.toFixed(0)}px`);
  check(m.drive('player', 8) === 0, 'it kept driving on an empty tank');
});

scenario('the engine will not start the siege standing on the crown', () => {
  const m = mk({ mine: { cells: [...stack(1, 2, 'stone'), ...stack(4, 1, 'stone')], king: { c: 1, r: 2 } } });
  const castle = m.castles.player;
  const L = m.launchers.player;
  check(castle.king().r === 2, 'the fixture did not put the crown on top of the tall column');
  check(Math.abs(L.x - castle.centre(4, 0).x) < 1,
    `the tallest column is the crown's own, and the engine parked on it at x=${L.x.toFixed(0)}`);
});

scenario('a tank of fuel is a reposition, not a journey across the map', () => {
  const m = mk();
  const L = m.launchers.player;
  const from = L.x;
  for (let i = 0; i < 60; i++) m.drive('player', 20);
  const gone = L.x - from;
  check(gone > CELL * 3, `a whole tank only moved it ${gone.toFixed(0)}px — that is not a reposition`);
  check(gone < 400, `a whole tank moved it ${gone.toFixed(0)}px, which is halfway to the enemy`);
});

scenario('it climbs a step and refuses a wall', () => {
  // a two-storey tower beside the engine, and a five-storey one beyond it
  const m = mk({
    mine: { cells: [...stack(3, 1, 'stone'), ...stack(4, 2, 'stone'), ...stack(5, 6, 'stone')], king: { c: 0, r: 0 } },
  });
  const castle = m.castles.player;
  const L = m.launchers.player;
  L.x = castle.centre(3, 0).x;
  L.y = BASE_Y - CELL;
  L.fuel = DRIVE_FUEL;

  // one cell up is a step it takes
  for (let i = 0; i < 6; i++) m.drive('player', 6);
  check(L.x > castle.baseX + 4 * CELL, `it did not reach the two-storey column: x=${L.x.toFixed(0)}`);
  check(L.y <= BASE_Y - CELL * 2 + 0.01, `it would not climb one step: it is at y=${L.y.toFixed(0)}`);

  // four cells up is a wall it stops at
  for (let i = 0; i < 30; i++) m.drive('player', 6);
  check(L.x < castle.baseX + 5 * CELL,
    `it drove straight up the face of a four-cell wall to x=${L.x.toFixed(0)}`);
  check(L.blocked > 0, 'nothing recorded that it had run into something');
});

scenario('the engine may not leave its own ground, or drive while a shell is up', () => {
  const m = mk();
  const L = m.launchers.player;
  const bounds = m.leash('player');
  check(bounds.min === CASTLE_X.player - LEASH, 'the leash does not start where the plot does');
  for (let i = 0; i < 200; i++) {
    L.fuel = DRIVE_FUEL;
    m.drive('player', 20);
  }
  check(Math.abs(L.x - bounds.max) < 0.01, `with unlimited fuel it stopped at ${L.x.toFixed(0)}, not ${bounds.max}`);

  L.fuel = DRIVE_FUEL;
  m.shots.push({ side: 'player', w: 'boulder', x: 900, y: 200, vx: 100, vy: 0, t: 0, trail: [] });
  check(m.drive('player', -20) === 0, 'it drove itself out from under its own shell');
});

scenario('every turn hands the side that is up a full tank', () => {
  const m = mk({ theirs: { cells: stack(2, 3, 'stone'), king: { c: 5, r: 0 } } });
  for (let i = 0; i < 30; i++) m.drive('player', 20);
  check(m.launchers.player.fuel === 0, 'the tank did not empty');
  fire(m, 'player', 'boulder', 45, 60);
  check(m.turn === 'enemy', 'the turn did not change hands');
  check(m.launchers.enemy.fuel === DRIVE_FUEL, `the enemy took its turn with ${m.launchers.enemy.fuel} of fuel`);
  check(m.launchers.player.fuel === 0, 'the player refuelled on somebody else\'s turn');
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
  // The pairing matters and the first version of this got it backwards: the
  // knights' answer to timber is the fire pot and the machines' answer to iron
  // is the rust shell, and neither faction has an answer to the other's wall.
  // Asking the machines to counter timber is asking for the default shot, which
  // is exactly what they gave — correctly.
  // and the crown has to be *roofed*, not merely behind the wall: with a clean
  // lob onto an open crown available, the right answer is whatever hits crowns
  // hardest, and the enemy correctly took it
  const wall = (m) => ({
    cells: [0, 1, 2, 3, 4, 5, 6].flatMap((c) => stack(c, 4, m)),
    king: { c: 3, r: 0 },
  });
  const timber = mk({ mine: wall('wood'), faction: 'machines' }); // so the enemy is the knights
  const iron = mk({ mine: wall('iron'), faction: 'knights' }); // so the enemy is the machines
  for (const m of [timber, iron]) {
    m.turn = 'enemy';
    m.wind = 0;
  }
  check(planShot(timber, 'enemy', 1).weapon === 'firepot',
    `facing a timber wall the knights reached for the ${planShot(timber, 'enemy', 1).weapon}`);
  check(planShot(iron, 'enemy', 1).weapon === 'rustshell',
    `facing an iron wall the machines reached for the ${planShot(iron, 'enemy', 1).weapon}`);

  // and against a wall they have no answer to, they save the special and use
  // the shot that never runs out
  const stone = mk({ mine: wall('stone'), faction: 'machines' });
  stone.turn = 'enemy';
  stone.wind = 0;
  check(planShot(stone, 'enemy', 1).weapon === 'boulder',
    `with nothing that suits stone the knights still spent a special: ${planShot(stone, 'enemy', 1).weapon}`);
});

scenario('thinking about a turn changes nothing whatsoever about the world', () => {
  // This is the bug that made the opponent look broken: the drill's collision
  // announced itself with an event, so every ghost drill the AI *considered*
  // threw a spray of dirt onto the real battlefield — a hundred and forty of
  // them per turn, along trajectories nobody fired, at spots that never got a
  // crater because nothing had actually landed there. It reads exactly like
  // "the bot's shots pass through the ground and do nothing".
  const m = mk({
    mine: suggestBlueprint(400),
    theirs: foeCastle({ ...LEVELS[0].foe, faction: 'machines', seed: 3 }),
  });
  m.turn = 'enemy';
  m.take();

  const before = {
    ground: m.terrain.snapshot(),
    hp: [...m.castles.player.blocks(), ...m.castles.enemy.blocks()].map((b) => b.hp),
    where: Object.values(m.launchers).map((L) => `${L.x.toFixed(2)},${L.y.toFixed(2)},${L.angle.toFixed(2)},${L.fuel}`),
    ammo: JSON.stringify(m.ammo),
    shots: m.shots.length,
  };

  planShot(m, 'enemy', 0.6);

  const said = m.take();
  check(said.length === 0, `planning a shot announced ${said.length} things to the world: ${said.map((e) => e.kind).join(', ')}`);
  check(m.terrain.snapshot().every((y, i) => y === before.ground[i]), 'planning a shot moved the ground');
  const hp = [...m.castles.player.blocks(), ...m.castles.enemy.blocks()].map((b) => b.hp);
  check(hp.length === before.hp.length && hp.every((v, i) => v === before.hp[i]), 'planning a shot damaged a wall');
  check(Object.values(m.launchers).every((L, i) =>
    `${L.x.toFixed(2)},${L.y.toFixed(2)},${L.angle.toFixed(2)},${L.fuel}` === before.where[i]),
    'planning a shot moved or re-aimed an engine');
  check(JSON.stringify(m.ammo) === before.ammo, 'planning a shot spent ammunition');
  check(m.shots.length === before.shots, 'planning a shot left something in the air');
});

scenario('every third turn the gunner goes for the tower under your gun, not the crown', () => {
  // the player's engine seats itself on the five-storey column at 5
  const m = mk({ mine: { cells: stack(5, 5, 'stone'), king: { c: 0, r: 0 } } });
  const king = m.castles.player.centre(0, 0);

  m.turnCount = 2; // the counter-battery slot in the schedule
  const counter = pickTarget(m, 'enemy');
  check(counter.counter === true, 'with an engine perched on five storeys of stone, turn three still aimed at the crown');
  check(Math.abs(counter.x - m.launchers.player.x) < CELL,
    `the counter-battery shot aims at x=${counter.x.toFixed(0)} with the engine at ${m.launchers.player.x.toFixed(0)}`);

  m.turnCount = 3; // off the schedule: back to the crown
  const direct = pickTarget(m, 'enemy');
  check(Math.hypot(direct.x - king.x, direct.y - king.y) < 1,
    `off the counter-battery turn it aims at ${direct.x.toFixed(0)},${direct.y.toFixed(0)} instead of the crown`);

  // an engine on bare ground offers nothing to knock down — the crown it is
  const flat = mk();
  flat.turnCount = 2;
  check(!pickTarget(flat, 'enemy').counter, 'it tried to counter-batter an engine standing on the dirt');
});

scenario('the enemy climbs back onto its own tower after you shoot it off', () => {
  const m = mk({ theirs: { cells: [...stack(2, 1, 'stone'), ...stack(5, 5, 'stone')], king: { c: 6, r: 0 } } });
  const L = m.launchers.enemy;
  check(planDrive(m, 'enemy') === 0, 'it wants to drive away from the seat it started on');

  // knock the tower down to one storey and put it on the far side of the castle
  for (let r = 4; r >= 1; r--) m.castles.enemy.remove(5, r);
  L.x = m.castles.enemy.centre(0, 0).x;
  check(planDrive(m, 'enemy') !== 0, 'stranded at the wrong end of its castle it decided to stay there');
  for (let i = 0; i < 80; i++) {
    L.fuel = DRIVE_FUEL;
    const dir = planDrive(m, 'enemy');
    if (!dir) break;
    m.drive('enemy', dir * 8);
  }
  check(Math.abs(L.x - m.castles.enemy.centre(2, 0).x) < CELL,
    `it drove to x=${L.x.toFixed(0)} instead of the tallest column it has left`);
});

// ------------------------------------------------------------ the ground war

/** Let the ground war walk for a while, with no shots in the air. */
function march(m, seconds) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) m.tick(1 / 60);
}

scenario('each siege musters its column, and the campaign unlocks new kinds', () => {
  const kinds = (m, side) => m.minions.filter((x) => x.side === side).map((x) => x.kind);

  const meadow = mk(); // stage 0, player knights vs machines
  check(kinds(meadow, 'player').length === 2 && kinds(meadow, 'player').every((k) => k === 'squire'),
    `at the meadow the kingdom fields ${kinds(meadow, 'player').join(', ')}`);
  check(kinds(meadow, 'enemy').every((k) => k === 'scrapper'),
    `at the meadow the machines field ${kinds(meadow, 'enemy').join(', ')}`);

  const dunes = mk({ level: LEVELS[1] });
  check(kinds(dunes, 'player').includes('sapper'), 'the second siege did not unlock the sapper');
  check(kinds(dunes, 'enemy').includes('spider'), 'the second siege did not unlock the spider');

  const scrapyard = mk({ level: LEVELS[3] });
  check(kinds(scrapyard, 'player').includes('ram'), 'the fourth siege did not unlock the ram');
  check(kinds(scrapyard, 'enemy').includes('mole'), 'the fourth siege did not unlock the mole');
});

scenario('waves keep coming on the turn clock, and the field never floods', () => {
  const m = mk();
  const count = (side) => m.minions.filter((x) => x.side === side).length;
  check(count('player') === 2 && count('enemy') === 2, `the opening wave is ${count('player')}v${count('enemy')}`);

  m.minions.length = 0;
  for (let i = 0; i < WAVE_EVERY - 1; i++) pass(m);
  check(m.minions.length === 0, `a wave mustered ${m.minions.length} walkers before its turn`);
  pass(m);
  check(count('player') === 2 && count('enemy') === 2, `on the beat the wave came out ${count('player')}v${count('enemy')}`);

  for (let i = 0; i < WAVE_EVERY * 4; i++) pass(m);
  check(count('player') <= MINION_CAP && count('enemy') <= MINION_CAP,
    `after five waves the field holds ${count('player')}v${count('enemy')} against a cap of ${MINION_CAP}`);
});

scenario('a walker marches to the enemy wall and starts eating it', () => {
  const m = mk({ theirs: { cells: stack(0, 2, 'stone'), king: { c: 5, r: 0 } } });
  m.minions.length = 0;
  const walker = summon(m, 'squire', 'player', CASTLE_X.enemy - 200);
  const block = m.castles.enemy.at(0, 0);
  const before = block.hp;

  march(m, 8);
  check(walker.x > CASTLE_X.enemy - 40, `eight seconds in it has only reached x=${walker.x.toFixed(0)}`);
  check(block.hp < before, 'it stood at the wall and bit nothing');
  check(m.events.some((e) => e.kind === 'mhit'), 'the bites made no sound for the renderer');

  // and a wall bitten through falls like a wall shelled through
  block.hp = 4;
  march(m, 2);
  check(!m.castles.enemy.at(0, 0) || m.castles.enemy.at(0, 0) !== block,
    'the plank it chewed through is still standing');
});

scenario('an enemy walker blocks the column, and a shell into it frees the march', () => {
  const m = mk();
  m.minions.length = 0;
  const mine = summon(m, 'squire', 'player', 1100);
  const theirs = summon(m, 'scrapper', 'enemy', 1130);

  march(m, 0.5);
  check(mine.fighting, 'nose to nose with an enemy walker it kept strolling');
  const held = mine.x;
  march(m, 0.5);
  check(mine.x === held, `locked in a fight it still advanced ${(mine.x - held).toFixed(1)}px`);

  // the shell lands just past the blocker: it dies, ours survives, march resumes
  detonate(m, theirs.x + 20, theirs.y - 10, WEAPONS.boulder, 'player');
  check(!m.minions.includes(theirs), 'a trebuchet stone landed on the blocker and it shrugged');
  check(m.minions.includes(mine), 'the shell meant to free the column killed it too');
  march(m, 2);
  check(mine.x > held + 40, `freed, it advanced ${(mine.x - held).toFixed(0)}px in two seconds`);
});

scenario('a steep face stops a walker, a spider climbs it, and a sapper digs through', () => {
  const m = mk({ level: LEVELS[1] });
  m.minions.length = 0;
  // a designed ramp: 200px of height gained over 80px is a slope of 2.5 —
  // over anything's walking limit except the spider's
  const face = (x) => {
    if (x < 1200 || x > 1440) return BASE_Y;
    if (x < 1280) return BASE_Y - ((x - 1200) / 80) * 200;
    if (x <= 1360) return BASE_Y - 200;
    return BASE_Y - ((1440 - x) / 80) * 200;
  };
  for (let i = 0; i < NCOL; i++) m.terrain.h[i] = face(i * COL_W);

  const walker = summon(m, 'squire', 'player', 1100);
  march(m, 6);
  check(walker.stuck && walker.x < 1220, `the squire is at x=${walker.x.toFixed(0)}, stuck=${walker.stuck} — a 2.5 slope should stop it`);

  // a moderate hillside is for everybody — the phone screenshot of a column
  // refusing a walkable slope is the bug this check keeps dead
  const mild = mk({ level: LEVELS[1] });
  mild.minions.length = 0;
  const gentle = (x) => {
    if (x < 1200 || x > 1440) return BASE_Y;
    if (x < 1300) return BASE_Y - ((x - 1200) / 100) * 120; // slope 1.2
    if (x <= 1340) return BASE_Y - 120;
    return BASE_Y - ((1440 - x) / 100) * 120;
  };
  for (let i = 0; i < NCOL; i++) mild.terrain.h[i] = gentle(i * COL_W);
  const hiker = summon(mild, 'squire', 'player', 1100);
  march(mild, 12);
  check(!hiker.stuck && hiker.x > 1360,
    `twelve seconds in the squire is at x=${hiker.x.toFixed(0)}, stuck=${hiker.stuck} — a 1.2 hillside should be a walk`);

  // the spider gets the hill to itself, or it would stop to fight the squire
  const m1 = mk({ level: LEVELS[1] });
  m1.minions.length = 0;
  for (let i = 0; i < NCOL; i++) m1.terrain.h[i] = face(i * COL_W);
  const spider = summon(m1, 'spider', 'enemy', 1560);
  march(m1, 14);
  check(spider.x < 1180, `the spider should be over the hill by now; it is at x=${spider.x.toFixed(0)}`);

  // the sapper answers the same hill by going through it
  const m2 = mk({ level: LEVELS[1] });
  m2.minions.length = 0;
  for (let i = 0; i < NCOL; i++) m2.terrain.h[i] = face(i * COL_W);
  const sapper = summon(m2, 'sapper', 'player', 1140);
  march(m2, 4);
  check(sapper.underground, `four seconds in the sapper is at x=${sapper.x.toFixed(0)} and still above ground`);
  check(m2.events.some((e) => e.kind === 'mdig'), 'the tunnelling threw no dirt for the renderer');
  march(m2, 12);
  check(!sapper.underground && sapper.x > 1350,
    `sixteen seconds in the sapper is at x=${sapper.x.toFixed(0)}, underground=${sapper.underground} — it should be out the far side`);
});

scenario('walkers at its gate change what the gunner spends the turn on', () => {
  const m = mk();
  m.minions.length = 0;
  const cx = CASTLE_X.enemy + (COLS * CELL) / 2;
  summon(m, 'squire', 'player', cx - 170);
  summon(m, 'squire', 'player', cx - 140);
  const at = pickTarget(m, 'enemy');
  check(at.defend === true, 'two walkers at the gate and the gunner still aims across the valley');
  check(Math.abs(at.x - (cx - 155)) < 40, `it aims at x=${at.x.toFixed(0)} with the column at ${(cx - 155).toFixed(0)}`);

  // one walker is not worth a turn of artillery
  m.minions.length = 0;
  summon(m, 'squire', 'player', cx - 170);
  check(!pickTarget(m, 'enemy').defend, 'a single walker hijacked the whole turn');
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

// -------------------------------------------------------------- the valley

scenario('the valley takes sides: machinery thickens toward the machines, heraldry toward the kingdom', () => {
  // the blend is a pure function of x and of who holds which castle
  check(towardMachines(0, 'enemy') === 0 && towardMachines(W, 'enemy') === 1,
    'with the machines on the right, the left end of the field is not fully medieval');
  check(towardMachines(0, 'player') === 1 && towardMachines(W, 'player') === 0,
    'flipping the crowns did not flip the blend');

  const m = mk();
  const census = (scene, pool, lo, hi) =>
    scene.props.filter((p) => p.x >= lo && p.x < hi && pool.includes(p.kind)).length;
  const third = W / 3;

  // machines defending the right: their third of the valley is where the
  // gears and vents cluster, and the kingdom's third is where the pennants do
  const right = createScene(LEVELS[0], m.terrain, 9, { machinesSide: 'enemy' });
  check(census(right, MACHINE_PROPS, 2 * third, W) > census(right, MACHINE_PROPS, 0, third),
    `machines on the right, but their third grows ${census(right, MACHINE_PROPS, 2 * third, W)} machines against ${census(right, MACHINE_PROPS, 0, third)} on the kingdom's`);
  check(census(right, MEDIEVAL_PROPS, 0, third) > 0,
    "the kingdom's third of the valley has not a single pennant or pillar in it");
  check(census(right, MEDIEVAL_PROPS, 0, third) >= census(right, MEDIEVAL_PROPS, 2 * third, W),
    'the heraldry is thicker at the machine end than at the kingdom end');

  // and the whole gradient mirrors when the player takes the machines
  const left = createScene(LEVELS[0], m.terrain, 9, { machinesSide: 'player' });
  check(census(left, MACHINE_PROPS, 0, third) > census(left, MACHINE_PROPS, 2 * third, W),
    'with the machines defending the left plot the industry stayed on the right');
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
  const rects = drawBattleHud(ctx, { W: 1280, H: 720 }, { match: m, level: LEVEL, phase: 'charging', power: 40, driving: 0 });
  check(rects.filter((r) => r.kind === 'weapon').length === 4, `the dock came back with ${rects.length} slots`);
  check(rects.filter((r) => r.kind === 'drive').length === 2, 'the drive pads are not on the screen');
  check(rects.every((r) => r.w > 0 && r.h > 0), 'a control has no area to tap');
});

scenario('the armory rows keep their buttons apart and leave the count its own column', () => {
  // the first cut centred the count inside the − button, and on a phone the
  // row read as one mangled "−3" key — this keeps the three columns three
  const m = mk();
  const shop = createWorkshop({
    blueprint: null, coins: 400, terrain: m.terrain, faction: 'knights', loadout: defaultLoadout('knights'),
  });
  const ctx = headlessContext(1280, 720);
  const rects = drawShopHud(ctx, { W: 1280, H: 720 }, shop, LEVELS[0], {}).filter((r) => r.kind === 'ammo');
  check(rects.length === 6, `three munitions should make six buttons, not ${rects.length}`);

  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      check(!overlap(rects[i], rects[j]), `armory buttons ${i} and ${j} overlap`);
    }
  }
  for (const id of Object.keys(shop.ammo)) {
    const pair = rects.filter((r) => r.id === id).sort((a, b) => a.x - b.x);
    const gap = pair[1].x - (pair[0].x + pair[0].w);
    check(gap >= 18, `${id}: only ${gap.toFixed(0)}px between − and + — the count has nowhere to live`);
  }
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
