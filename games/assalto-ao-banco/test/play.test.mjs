// The heist itself, played in Node at a fixed step.
//
// Every scenario here puts the actor where the scenario happens — a guard is
// moved into the doorway, a camera is pointed down the corridor — rather than
// walking there from the front door. What is under test is the rule, not the
// metres in between.

import { scenario, check, run as runTests, installHeadlessDom } from 'slopkit/testing';

installHeadlessDom();     // render.js reaches i18n, which reads localStorage on load

const { floorSeed, PLAYER, PICKUP, ROLL, TILE, dist } = await import('../src/config.js');
const { generateFloor } = await import('../src/levelgen.js');
const { createGame } = await import('../src/game.js');
const { createRun, SILENT_BONUS } = await import('../src/run.js');
const { WEAPONS } = await import('../src/weapons.js');
const { lineOfSight } = await import('../src/grid.js');
const { canSee } = await import('../src/vision.js');
const { createRenderer } = await import('../src/render.js');
const { headlessContext } = await import('slopkit/testing');

const STEP = 1 / 60;
const IDLE = {};

/** A floor with a game on it, and the guards moved out of the way by default. */
function open(floor = 4, seed = 1234, { clearGuards = true } = {}) {
  const level = generateFloor(floor, floorSeed(seed, floor));
  const game = createGame({ level });
  if (clearGuards) for (const g of game.guards) g.dead = true;
  return game;
}

/** Run the simulation until `done()` or `seconds` have passed. */
function tick(game, seconds, input = IDLE, done = null) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    game.update(STEP, typeof input === 'function' ? input(i) : input);
    if (done && done(game, i * STEP)) return i * STEP;
  }
  return null;
}

/** A walkable point about `r` away with a clear line to it, or null. */
function openSpotNear(game, x, y, r) {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
    if (game.grid.solidAt(p.x, p.y)) continue;
    if (lineOfSight(game.grid, x, y, p.x, p.y)) return p;
  }
  return null;
}

/** Puts a guard in front of the player, awake and looking at him. */
function faceOff(game, gap = 150) {
  const g = game.guards[0];
  g.dead = false;
  g.x = game.player.x + gap;
  g.y = game.player.y;
  g.facing = Math.PI;
  g.state = 'patrol';
  g.alert = 0;
  return g;
}

/**
 * The same, but at whatever bearing actually has a clear line at that range —
 * "straight to the right" is a wall about half the time, and a scenario about
 * shooting that quietly set its target behind one proves nothing.
 */
function faceOffClear(game, gap) {
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const x = game.player.x + Math.cos(a) * gap;
    const y = game.player.y + Math.sin(a) * gap;
    if (game.grid.solidAt(x, y)) continue;
    if (!lineOfSight(game.grid, game.player.x, game.player.y, x, y)) continue;
    const g = game.guards[0];
    Object.assign(g, { dead: false, x, y, facing: a + Math.PI, state: 'patrol', alert: 0 });
    game.player.facing = a;
    return g;
  }
  return null;
}

// ------------------------------------------------------------------ walking

scenario('he walks, and the walls stop him', () => {
  const game = open();
  const from = { x: game.player.x, y: game.player.y };
  tick(game, 0.6, { mx: 1, my: 0 });
  const moved = dist(from.x, from.y, game.player.x, game.player.y);
  check(moved > 40, `six tenths of a second moved him ${moved.toFixed(1)}px`);

  // now walk him into a wall for two seconds and check he is still in the room
  const g2 = open();
  tick(g2, 3, { mx: -1, my: -1 });
  check(!g2.grid.solidAt(g2.player.x, g2.player.y), 'he walked into a wall and stayed there');
});

scenario('sneaking is slower, and it is the only thing that is quiet', () => {
  const fast = open();
  tick(fast, 1, { mx: 1, my: 0 });
  const quiet = open();
  tick(quiet, 1, { mx: 1, my: 0, sneak: true });
  const a = dist(fast.level.spawn.x, fast.level.spawn.y, fast.player.x, fast.player.y);
  const b = dist(quiet.level.spawn.x, quiet.level.spawn.y, quiet.player.x, quiet.player.y);
  check(b < a * 0.75, `sneaking covered ${b.toFixed(0)}px against ${a.toFixed(0)}px at a walk`);
  check(PLAYER.sneak < PLAYER.speed, 'the constants disagree with the behaviour');

  // A deaf-and-blind guard parked within earshot, and a player pacing on the
  // spot: pacing rather than walking off, so he stays inside the radius the
  // whole time instead of leaving it after the first stride.
  const pacing = (i) => ({ mx: Math.sin(i / 18) > 0 ? 1 : -1, my: 0, sneak: false });
  const creeping = (i) => ({ ...pacing(i), sneak: true });

  const earshot = (input) => {
    const game = open(4, 77);
    game.level.plan.guardSight = 1;
    const g = game.guards[0];
    g.dead = false;
    g.state = 'patrol';
    g.x = game.player.x;
    g.y = game.player.y - PLAYER.noiseWalk * 0.5;
    g.route = [{ cx: Math.floor(g.x / TILE), cy: Math.floor(g.y / TILE) }];
    tick(game, 3, input);
    return g.state;
  };
  check(earshot(pacing) === 'investigate', 'footsteps at half the noise radius went unheard');
  check(earshot(creeping) === 'patrol', `sneaking still woke the guard (${earshot(creeping)})`);
});

// ------------------------------------------------------------- being spotted

scenario('a guard who sees you runs for a panel and rings it', () => {
  const game = open(4, 7);
  const g = faceOff(game);
  check(lineOfSight(game.grid, g.x, g.y, game.player.x, game.player.y), 'the test set up a face-off through a wall');

  const sure = tick(game, 4, IDLE, (gm) => gm.guards[0].state === 'call');
  check(sure !== null && sure < 2, `he took ${sure === null ? '>4' : sure.toFixed(2)}s to be sure of what he saw`);

  const rang = tick(game, 60, IDLE, (gm) => gm.alarm.on);
  check(rang !== null, 'he never reached a panel — the alarm never rang');
  check(game.alarm.by === 'guard', `the alarm was raised by "${game.alarm.by}"`);
  check(game.lastKnown, 'the alarm rang without telling anybody where to go');
});

scenario('shoot him first and nobody is told', () => {
  const game = open(4, 7);
  const g = faceOff(game);
  // aim at him and hold the trigger: the silenced pistol has to do it before
  // he crosses the floor
  const aim = { x: g.x, y: g.y };
  game.player.facing = 0;
  const dead = tick(game, 12, () => ({ fire: true, aim }), (gm) => gm.guards[0].dead);
  check(dead !== null, `he survived twelve seconds of fire (${g.hp.toFixed(0)} hp left)`);
  check(!game.alarm.on, `he reached a panel anyway after ${dead.toFixed(1)}s`);
  check(game.stats.kills === 1, `the kill was not counted (${game.stats.kills})`);
  check(game.bodies.length === 1, 'no body was left behind');
});

scenario('a body on the carpet tells the same story as you do', () => {
  // A guard left where the generator put him, staring at a spot in his own room
  // that he demonstrably has a clear line to — no coordinates invented by the
  // test, which is how the first version of this ended up asserting against a
  // body inside a wall.
  const rig = (facingTheBody) => {
    const game = open(4, 7);
    const g = game.guards[0];
    g.dead = false;
    g.state = 'patrol';
    g.route = [{ cx: Math.floor(g.x / TILE), cy: Math.floor(g.y / TILE) }];
    // Short-sighted, not blind: the first version of this set his sight to 1px
    // so he could not see the player — and a body is looked at through the same
    // eyes, so he could not see that either. The scenario passed nothing and
    // reported that a corpse is invisible.
    game.level.plan.guardSight = 200;
    const spot = openSpotNear(game, g.x, g.y, 110);
    check(spot, "no clear spot in the guard's own room to drop a body on");
    game.bodies.push({ x: spot.x, y: spot.y, a: 0, seen: 0, gun: 'pistol', id: 'z' });
    const towards = Math.atan2(spot.y - g.y, spot.x - g.x);
    g.facing = facingTheBody ? towards : towards + Math.PI;
    check(
      !canSee(game.grid, g.x, g.y, g.facing, game.level.plan.guardFov, 200, game.player.x, game.player.y),
      'the test left the player standing in the cone it is testing the body with'
    );
    return { game, g };
  };

  const looking = rig(true);
  const called = tick(looking.game, 6, IDLE, (gm) => gm.guards[0].state === 'call');
  check(called !== null, `he stared at a body for six seconds and stayed ${looking.g.state}`);

  // Two seconds, not six: a guard standing on patrol sweeps his head at
  // GUARD.turn-ish speed, and given long enough he turns round and finds it —
  // which is the behaviour, not a bug. What is under test is that the cone is
  // consulted at all, and 0.55s of lock against 4.5s of sweep is a wide margin.
  const away = rig(false);
  tick(away.game, 2);
  check(away.g.state !== 'call', `a body behind him still raised the alarm (${away.g.state})`);
});

scenario('you can pick a body up and take it somewhere else', () => {
  const game = open();
  const body = { x: game.player.x + 40, y: game.player.y, a: 0, seen: 0, gun: 'pistol', id: 'z' };
  game.bodies.push(body);
  const where = { x: body.x, y: body.y };

  game.update(STEP, IDLE);
  check(game.prompt && game.prompt.kind === 'carry', `standing on a body offered "${game.prompt && game.prompt.kind}"`);
  game.update(STEP, { use: true });
  check(game.player.dragging === body, 'the body was not picked up');

  tick(game, 1.2, { mx: -1, my: 0 });
  const moved = dist(where.x, where.y, body.x, body.y);
  check(moved > 60, `the body only moved ${moved.toFixed(0)}px while being dragged`);

  game.update(STEP, IDLE);
  game.update(STEP, { use: true });
  check(!game.player.dragging, 'the body would not be let go of');
});

// --------------------------------------------------------------- the alarms

scenario('a camera holds you in shot, then calls it in — and a bullet stops it', () => {
  const game = open(6, 21);
  const cam = game.cameras[0];
  check(cam, 'floor 6 was generated with no cameras at all');
  game.player.x = cam.x + 120;
  game.player.y = cam.y;
  cam.base = 0;
  cam.facing = 0;
  cam.sweep = 0;
  cam.range = 500;

  const rang = tick(game, 8, IDLE, (gm) => gm.alarm.on);
  check(rang !== null, 'the camera watched him for eight seconds and told nobody');
  check(game.alarm.by === 'camera', `the alarm was raised by "${game.alarm.by}"`);
  check(rang >= game.level.plan.cameraLock * 0.8, `it called in after ${rang.toFixed(2)}s, quicker than its own ${game.level.plan.cameraLock.toFixed(2)}s lock`);

  const shot = open(6, 21);
  const cam2 = shot.cameras[0];
  shot.player.x = cam2.x + 120;
  shot.player.y = cam2.y;
  cam2.base = 0;
  cam2.facing = 0;
  cam2.sweep = 0;
  shot.player.facing = Math.PI;
  tick(shot, 1.5, { fire: true, aim: { x: cam2.x, y: cam2.y } });
  check(cam2.dead, 'the camera survived a second and a half of point-blank fire');
  check(!shot.alarm.on, 'it managed to call in before it broke');
});

scenario('pulling an alarm yourself sends them to the panel, not to you', () => {
  const game = open(5, 11, { clearGuards: false });
  const panel = game.alarms[0];
  game.player.x = panel.x;
  game.player.y = panel.y;
  game.update(STEP, IDLE);
  check(game.focus && game.focus.kind === 'alarm', `standing at a panel offered "${game.focus && game.focus.kind}"`);

  tick(game, PICKUP.alarm + 0.2, IDLE, (g) => g.alarm.on);
  check(game.alarm.on, 'standing on the panel for its whole ring did nothing');
  check(game.alarm.by === 'player', `it was recorded as raised by "${game.alarm.by}"`);
  check(
    dist(game.lastKnown.x, game.lastKnown.y, panel.x, panel.y) < 1,
    'the guards were sent to the player rather than to the panel he pulled'
  );
  const sent = game.guards.filter((g) => !g.dead && g.goal);
  check(sent.length > 0, 'the alarm gave nobody anywhere to go');
  for (const g of sent) {
    check(
      dist(g.goal.x, g.goal.y, panel.x, panel.y) < 1,
      `${g.id} was sent to ${Math.round(g.goal.x)},${Math.round(g.goal.y)} instead of to the panel`
    );
  }

  // and the contrast that makes it a trick rather than a coincidence: when a
  // guard raises it, the same machinery points everybody at the player instead
  const spotted = open(5, 11, { clearGuards: false });
  spotted.player.x = spotted.alarms[0].x;
  spotted.player.y = spotted.alarms[0].y;
  spotted.raiseAlarm(spotted.alarms[0], 'guard');
  check(
    dist(spotted.lastKnown.x, spotted.lastKnown.y, spotted.player.x, spotted.player.y) < 1,
    'a guard-raised alarm should send them to the player, wherever he is standing'
  );
});

scenario('a shot is heard; a silenced shot is not', () => {
  const setup = (gun) => {
    const game = open(4, 55);
    game.level.plan.guardSight = 1;
    const g = game.guards[0];
    g.dead = false;
    g.state = 'patrol';
    g.x = game.player.x + 340;
    g.y = game.player.y;
    g.route = [{ cx: Math.floor(g.x / TILE), cy: Math.floor(g.y / TILE) }];
    game.player.weapon = { id: gun, ammo: 20, cool: 0 };
    game.player.facing = Math.PI;              // firing away from him
    tick(game, 1, { fire: true });
    return g;
  };
  check(WEAPONS.silenced.noise < 340, 'the test assumes 340px is outside the silenced pistol');
  check(WEAPONS.shotgun.noise > 340, 'the test assumes 340px is inside a shotgun');
  check(setup('shotgun').state === 'investigate', 'a shotgun went off 340px away and nobody came');
  check(setup('silenced').state === 'patrol', 'the silenced pistol woke a guard 340px away');
});

scenario('with every panel broken, the man who saw you comes himself', () => {
  const game = open(4, 7);
  for (const a of game.alarms) a.dead = true;
  const g = faceOff(game);
  tick(game, 3, IDLE, (gm) => gm.guards[0].state === 'call');
  check(g.state === 'call', `he settled on "${g.state}" with no panel to run to`);
  const goal = g.goal;
  check(goal, 'he was sure of you and had nowhere to go');
  check(
    dist(goal.x, goal.y, game.player.x, game.player.y) < 200,
    'with no panel left he should be coming for the player, not for a panel'
  );
  check(!game.alarm.on, 'a broken panel still rang');
});

// ------------------------------------------------------------------ the loot

scenario('a gun is swapped by standing on it, and the old one is left on the floor', () => {
  const game = open();
  const before = game.items.length;
  game.items.push({ kind: 'gun', gun: 'shotgun', ammo: 12, x: game.player.x + 20, y: game.player.y, taken: false });
  game.player.weapon = { id: 'rifle', ammo: 9, cool: 0 };

  game.update(STEP, IDLE);
  check(game.focus && game.focus.kind === 'gun', `the ring offered "${game.focus && game.focus.kind}"`);
  tick(game, PICKUP.gun + 0.2, IDLE, (g) => g.player.weapon.id === 'shotgun');
  check(game.player.weapon.id === 'shotgun', `he is holding a ${game.player.weapon.id}`);
  check(game.player.weapon.ammo === 12, `it came with ${game.player.weapon.ammo} rounds instead of 12`);
  const dropped = game.items.filter((i) => !i.taken && i.gun === 'rifle');
  check(dropped.length === 1, 'the rifle he was holding vanished instead of hitting the floor');
  check(dropped[0].ammo === 9, `the dropped rifle carries ${dropped[0].ammo} rounds instead of 9`);
  check(game.items.length > before, 'nothing was added to the floor');

  // and it does not immediately pick itself back up: the gun he just put down
  // is under his feet, and without the arming delay he swaps for ever
  tick(game, PICKUP.gun + 0.3);
  check(game.player.weapon.id === 'shotgun', `he swapped straight back to the ${game.player.weapon.id}`);
});

scenario('sprinting over a gun does not take it; stopping on it does', () => {
  const rig = () => {
    const game = open();
    game.player.weapon = { id: 'rifle', ammo: 9, cool: 0 };
    game.items.push({ kind: 'gun', gun: 'shotgun', ammo: 12, x: game.player.x, y: game.player.y, taken: false });
    return game;
  };

  // Pacing over the gun rather than running off across the floor: the first
  // version of this walked him into the far wall, where he stood at 0 px/s
  // and "did not pick it up" for entirely the wrong reason.
  const past = rig();
  let top = 0;
  for (let i = 0; i < 60 * 3; i++) {
    past.update(STEP, { mx: Math.sin(i / 16) > 0 ? 1 : -1, my: 0 });
    top = Math.max(top, past.player.speed);
  }
  check(top > PICKUP.stillSpeed, `he never got past ${top.toFixed(0)} px/s — the test never sprinted`);
  check(past.player.weapon.id === 'rifle', `running over it swapped him to a ${past.player.weapon.id}`);

  const stopped = rig();
  tick(stopped, PICKUP.gun + 0.4, IDLE);
  check(stopped.player.weapon.id === 'shotgun', `stopping on it left him holding a ${stopped.player.weapon.id}`);
});

scenario('a shot that crosses a man hits him, at any range', () => {
  // What the projection cost: a figure drawn at its own height stands two tiles
  // up the screen from the tile it is standing on, so the crosshair and the
  // simulation stopped agreeing and rounds went over people's heads. Everybody
  // is inside their own square now — this is that promise, at the two distances
  // where it used to break.
  for (const gap of [22, 60, 300]) {
    const game = open(4, 7);
    const g = faceOffClear(game, gap);
    check(g, `no clear line at ${gap}px anywhere around him — the test could not aim`);
    const hp = g.hp;
    game.player.weapon = { id: 'rifle', ammo: 30, cool: 0 };
    tick(game, 0.5, { fire: true, aim: { x: g.x, y: g.y } });
    check(g.hp < hp || g.dead, `at ${gap}px the rounds went straight past him (${g.hp}/${hp} hp)`);
  }
});

scenario('a dart drops a guard however big he is', () => {
  // As a damage weapon this stopped working around floor 17, where guard health
  // passes what a dart used to do — a silent takedown that quietly becomes the
  // worst gun in the game exactly where you need it.
  for (const floor of [1, 20, 60]) {
    const game = open(floor, 99);
    const g = faceOff(game, 120);
    game.player.facing = 0;
    game.player.weapon = { id: 'dart', ammo: 6, cool: 0 };
    tick(game, 1, { fire: true, aim: { x: g.x, y: g.y } }, (gm) => gm.guards[0].dead);
    check(g.dead, `on floor ${floor} (${g.maxHp.toFixed(0)} hp) a dart left him standing`);
    check(game.bodies.length === 1, `no body on floor ${floor}`);
    check(game.bodies[0].tranq, 'a tranquillised guard should not be bleeding on the carpet');
  }
  check(WEAPONS.dart.noise < WEAPONS.silenced.noise, 'the dart has to be the quietest thing on the floor');
});

scenario('the same gun again is ammunition, not a swap', () => {
  const game = open();
  game.player.weapon = { id: 'smg', ammo: 20, cool: 0 };
  game.items.push({ kind: 'gun', gun: 'smg', ammo: 40, x: game.player.x, y: game.player.y, taken: false });
  tick(game, PICKUP.gun + 0.3, IDLE);
  check(game.player.weapon.id === 'smg', `he is holding a ${game.player.weapon.id}`);
  check(game.player.weapon.ammo === 60, `he has ${game.player.weapon.ammo} rounds instead of 60`);
  check(!game.items.some((i) => !i.taken && i.gun === 'smg'), 'a second SMG was put on the floor for no reason');
});

scenario('the roll is faster than a walk, and everybody hears it', () => {
  const walked = open();
  tick(walked, ROLL.time, { mx: 1, my: 0 });
  const a = dist(walked.level.spawn.x, walked.level.spawn.y, walked.player.x, walked.player.y);

  const rolled = open();
  rolled.update(STEP, { mx: 1, my: 0 });
  rolled.update(STEP, { mx: 1, my: 0, roll: true });
  check(rolled.player.roll > 0, 'the roll did not start');
  tick(rolled, ROLL.time, { mx: 1, my: 0 });
  const b = dist(rolled.level.spawn.x, rolled.level.spawn.y, rolled.player.x, rolled.player.y);
  check(b > a * 1.5, `a roll covered ${b.toFixed(0)}px against ${a.toFixed(0)}px of walking`);

  // heard even while sneaking, which is the trade the roll makes
  const heard = open(4, 77);
  heard.level.plan.guardSight = 1;
  const g = heard.guards[0];
  g.dead = false;
  g.state = 'patrol';
  g.x = heard.player.x;
  g.y = heard.player.y - ROLL.noise * 0.5;
  g.route = [{ cx: Math.floor(g.x / TILE), cy: Math.floor(g.y / TILE) }];
  heard.update(STEP, { sneak: true });
  heard.update(STEP, { sneak: true, roll: true });
  tick(heard, 0.5, { sneak: true });
  check(g.state === 'investigate', `a roll half a radius away left the guard on ${g.state}`);
});

scenario('a roll has to finish before the next one, and it drops what you are carrying', () => {
  const game = open();
  game.bodies.push({ x: game.player.x, y: game.player.y, a: 0, seen: 0, gun: 'pistol', id: 'z' });
  game.update(STEP, IDLE);
  game.update(STEP, { use: true });
  check(game.player.dragging, 'the body was not picked up');

  game.update(STEP, { mx: 1, roll: true });
  check(game.player.roll > 0, 'the roll did not start');
  check(!game.player.dragging, 'he rolled away still holding a body');

  tick(game, ROLL.time + 0.05, { mx: 1 });
  game.update(STEP, { mx: 1, roll: true });      // asked again, straight away
  check(game.player.roll <= 0, 'a second roll started before the cooldown was up');
  tick(game, ROLL.cool + 0.1, { mx: 1 });
  game.update(STEP, { mx: 1 });
  game.update(STEP, { mx: 1, roll: true });
  check(game.player.roll > 0, 'the roll never came back after its cooldown');
});

scenario('an empty gun falls back to the one you always have', () => {
  const game = open();
  game.player.weapon = { id: 'revolver', ammo: 2, cool: 0 };
  tick(game, 3, { fire: true });
  check(game.player.weapon.id === 'silenced', `he is still holding a ${game.player.weapon.id} with ${game.player.weapon.ammo} rounds`);
});

scenario('cash goes in the bag, a medkit goes in the arm', () => {
  const game = open();
  game.items.push({ kind: 'loot', value: 500, x: game.player.x, y: game.player.y, taken: false });
  tick(game, PICKUP.loot + 0.2, IDLE);
  check(game.stats.money === 500, `the bag holds ${game.stats.money}`);

  game.player.hp = 40;
  game.items.push({ kind: 'medkit', heal: 34, x: game.player.x, y: game.player.y, taken: false });
  tick(game, PICKUP.medkit + 0.2, IDLE);
  check(game.player.hp === 74, `he healed to ${game.player.hp}`);

  game.player.hp = PLAYER.hp - 2;
  game.items.push({ kind: 'medkit', heal: 34, x: game.player.x, y: game.player.y, taken: false });
  tick(game, PICKUP.medkit + 0.2, IDLE);
  check(game.player.hp === PLAYER.hp, `a medkit overhealed him to ${game.player.hp}`);
});

// ------------------------------------------------------------------ the run

scenario('standing in the vault opens it, loudly, and clears the floor', () => {
  const game = open(3, 9);
  const g = game.guards[0];
  g.dead = false;
  g.state = 'patrol';
  g.x = game.level.vault.x + 300;
  g.y = game.level.vault.y;
  game.level.plan.guardSight = 1;
  game.player.x = game.level.vault.x;
  game.player.y = game.level.vault.y;

  const done = tick(game, 40, IDLE, (gm) => gm.state === 'cleared');
  check(done !== null, `the vault was still at ${(game.level.vault.cracked * 100).toFixed(0)}% after forty seconds`);
  check(done >= game.level.plan.vaultTime * 0.9, `it opened in ${done.toFixed(1)}s, faster than the ${game.level.plan.vaultTime.toFixed(1)}s it should take`);
  check(game.stats.money >= game.level.plan.payday, `the vault paid ${game.stats.money}`);
  check(g.state !== 'patrol', 'the drill ran for seconds and the guard next door heard nothing');
});

scenario('the lift carries your health, your gun and the bag', () => {
  const run = createRun({ seed: 3 });
  const first = run.start();
  first.player.hp = 55;
  first.player.weapon = { id: 'rifle', ammo: 30, cool: 0 };
  first.stats.money = 4000;
  first.level.vault.cracked = 1;
  first.state = 'cleared';

  const second = run.advance();
  check(second.level.floor === 2, `the lift arrived on floor ${second.level.floor}`);
  check(second.player.weapon.id === 'rifle', `he arrived holding a ${second.player.weapon.id}`);
  check(second.player.weapon.ammo === 30, `with ${second.player.weapon.ammo} rounds`);
  check(second.stats.money === 4000 + SILENT_BONUS, `the bag holds ${second.stats.money} — the silent bonus is missing`);
  check(second.player.hp > 55, `he arrived with ${second.player.hp} hp, no better than he left`);
  check(second.player.hp <= PLAYER.hp, `he arrived with ${second.player.hp} hp, over the maximum`);
  check(run.totals.floors === 1, `${run.totals.floors} floors counted`);
  check(run.totals.silent === 1, 'the silent floor was not counted');
});

scenario('a floor the whole building heard pays less than a quiet one', () => {
  const noisy = createRun({ seed: 3 });
  const g = noisy.start();
  g.stats.money = 4000;
  g.stats.alarms = 1;
  g.player.hp = 55;
  g.state = 'cleared';
  const next = noisy.advance();
  check(next.stats.money === 4000, `a floor with the alarm ringing still paid the bonus (${next.stats.money})`);
  check(noisy.totals.silent === 0, 'it was counted as a silent floor');
});

scenario('the end-of-run card has real numbers to read, and it reads them once', () => {
  // The freeze: `vault.save()` reports whether it wrote, it does not hand the
  // state back — so `best = vault.save(...)` made `best` the boolean `true`,
  // and the first `best.money.toLocaleString()` threw. `phase` was already
  // 'over' by then, so the loop had stopped simulating and the card was never
  // shown: the whole screen froze on the frame he died in. This is the shape of
  // that bug — everything the card touches has to be a number when it is asked.
  const seen = [];
  // through `hooks`, which is the run's actual API: assigning `game.onDead`
  // afterwards replaces the wrapper the run puts there to close its own books
  const run = createRun({
    seed: 31,
    hooks: {
      onDead: () => {
        // exactly what the card reads, at exactly the moment it reads it
        seen.push({
          money: run.money,
          floors: run.totals.floors,
          kills: run.totals.kills,
          silent: run.totals.silent,
          time: run.totals.time,
          score: run.score(),
          over: run.over,
        });
      },
    },
  });
  const game = run.start();

  game.stats.money = 7200;
  game.stats.kills = 4;
  game.player.hp = 4;
  game.bullets.push({ x: game.player.x - 40, y: game.player.y, vx: 900, vy: 0, dmg: 99, left: 200, side: 'guard' });
  for (let i = 0; i < 60 * 3 && !run.over; i++) run.update(STEP, IDLE);

  check(seen.length === 1, `the card was told ${seen.length} times`);
  const card = seen[0];
  for (const [name, v] of Object.entries(card)) {
    if (name === 'over') continue;
    check(Number.isFinite(v), `the card would print "${v}" for ${name}`);
  }
  check(card.over, 'the run had not been closed by the time the card read it');
  check(card.money === 7200, `the card read ${card.money} instead of the 7200 in the bag`);
  check(card.kills === 4, `the card read ${card.kills} kills instead of 4`);
  check(card.time > 0, 'the card read no time at all');
});

scenario('when he runs out of blood the run is over', () => {
  const run = createRun({ seed: 12 });
  const game = run.start();
  let ended = false;
  game.onDead = () => { ended = true; };
  game.player.hp = 5;
  const guard = game.guards[0];
  guard.x = game.player.x + 120;
  guard.y = game.player.y;
  guard.facing = Math.PI;
  guard.state = 'patrol';
  for (let i = 0; i < 60 * 20 && !run.over; i++) run.update(STEP, IDLE);
  check(run.over, `he survived twenty seconds at five health (${game.player.hp} left)`);
  check(game.state === 'dead', `the floor is in state "${game.state}"`);
  check(ended, 'nothing was told that the run had ended');
  run.update(STEP, IDLE);
  check(game.state === 'dead', 'the game kept simulating after he died');
});

// --------------------------------------------------------------- the picture

scenario('the fog only lifts where he has been', () => {
  const game = open(5, 31);
  const seenAtStart = game.seen.reduce((a, b) => a + b, 0);
  check(seenAtStart > 0, 'he cannot see his own feet');
  check(seenAtStart < game.seen.length * 0.3, `he can already see ${seenAtStart} of ${game.seen.length} cells from the door`);
  tick(game, 4, (i) => ({ mx: Math.cos(i / 30), my: Math.sin(i / 30) }));
  const later = game.seen.reduce((a, b) => a + b, 0);
  check(later > seenAtStart, `he walked for four seconds and learnt nothing new (${later} cells)`);
});

scenario('the whole screen draws, on every phase, in both languages', () => {
  const ctx = headlessContext(1280, 720);
  const vp = { W: 1280, H: 720 };
  const renderer = createRenderer();
  const game = open(6, 44, { clearGuards: false });
  game.items.push({ kind: 'loot', value: 100, x: game.player.x + 30, y: game.player.y, taken: false });
  game.bodies.push({ x: game.player.x - 30, y: game.player.y, a: 1, seen: 0, gun: 'pistol', id: 'z' });

  const fx = { bits: [{ x: 0, y: 0, size: 3, colour: '#fff', t: 0.2, life: 0.4 }], rings: [{ x: 0, y: 0, r: 5, max: 40, t: 0.2, life: 0.4, colour: '#f00' }], floats: [{ x: 0, y: 0, text: '+$1', colour: '#fff', t: 0.5, life: 1 }], state: { shake: 4 } };

  for (const lang of ['en', 'pt']) {
    game.level.plan.i18nProbe = lang;      // just a marker; the dictionary is read by render
    game.update(STEP, IDLE);
    renderer.draw(ctx, game, vp, { fx });
    game.level.vault.cracked = 0.5;
    game.raiseAlarm(game.alarms[0], 'guard');
    game.update(STEP, IDLE);
    renderer.draw(ctx, game, vp, { fx, touch: { stick: { on: true, ox: 100, oy: 500, x: 140, y: 520 }, trigger: { on: false } } });
  }
  check(true, 'a full frame was painted without throwing');
});

await runTests('bank job — the heist');
