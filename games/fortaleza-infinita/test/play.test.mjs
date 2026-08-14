// The escape itself, played in Node at a fixed step.
//
// Every scenario here puts the actor where the scenario happens — a guard is
// moved into the doorway, a camera is pointed down the corridor — rather than
// walking there from the front door. What is under test is the rule, not the
// metres in between.

import { scenario, check, run as runTests, installHeadlessDom } from 'slopkit/testing';

installHeadlessDom();     // render.js reaches i18n, which reads localStorage on load

const game_config = await import('../src/config.js');
const { floorSeed, PLAYER, PICKUP, ROLL, TILE, GUARD, dist, angleDelta } = game_config;
const { generateFloor } = await import('../src/levelgen.js');
const { createGame, assistedAim } = await import('../src/game.js');
const { createRun, silentBonus } = await import("../src/run.js");
const { WEAPONS, dps } = await import('../src/weapons.js');
const { lineOfSight } = await import('../src/grid.js');
const { canSee } = await import('../src/vision.js');
const { createRenderer, cameraFor, screenToWorld } = await import('../src/render.js');
const { createTouchControls, fireButton, rollButton, useButton, AIM } = await import('../src/controls.js');
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
  // Track him and hold the trigger, the way a player does: the whisper coil
  // has to finish him before he crosses the floor. Aiming at the spot he was
  // standing on when the scenario started is not a test of the gun, it is a
  // test of whether he stayed still — and he does not, he runs for the alarm.
  game.player.facing = 0;
  const dead = tick(game, 12, () => ({ fire: true, aim: { x: g.x, y: g.y } }), (gm) => gm.guards[0].dead);
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
    game.bodies.push({ x: spot.x, y: spot.y, a: 0, seen: 0, gun: 'blaster', id: 'z' });
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
  const body = { x: game.player.x + 40, y: game.player.y, a: 0, seen: 0, gun: 'blaster', id: 'z' };
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

/** Stand him in front of a node, in the open, and let the gun do the rest. */
function shootNode(game, node) {
  game.player.x = node.x + Math.cos(node.facing) * 46;
  game.player.y = node.y + Math.sin(node.facing) * 46;
  game.player.facing = Math.atan2(node.y - game.player.y, node.x - game.player.x);
  game.player.weapon = { id: 'blaster', ammo: 30, cool: 0 };
  tick(game, 1.2, { fire: true, aim: { x: node.x, y: node.y } }, () => node.dead);
}

scenario('the siren starts with the alarm, and shooting the ringing node ends it', () => {
  // These hooks are what main.js hangs the actual sound off — the WebAudio
  // graph itself is a browser thing, but *when it starts and stops* is a rule,
  // and rules live here.
  const game = open(5, 11);
  for (const c of game.cameras) c.dead = true;    // nobody re-raises mid-test
  const heard = [];
  game.onAlarm = () => heard.push('start');
  game.onAlarmSilenced = () => heard.push('silenced');
  game.onAlarmOff = () => heard.push('off');

  const [ringing, other] = game.alarms;
  check(ringing && other, `the ring has ${game.alarms.length} node(s) and the test needs two`);
  game.raiseAlarm(ringing, 'player');
  check(heard.includes('start'), 'the alarm went up and the siren was never asked for');

  // a node that is NOT the one ringing is scrap, not silence
  shootNode(game, other);
  check(other.dead, 'the second node survived point-blank fire');
  check(!heard.includes('silenced'), 'breaking a mute node stopped a siren it was not making');

  // the one that IS ringing is both
  shootNode(game, ringing);
  check(ringing.dead, 'the ringing node survived point-blank fire');
  check(heard.includes('silenced'), 'the ringing node is dead and the siren was never told');
  check(game.alarm.on, 'silencing the siren should not call off the hunt');

  // and left alone, the timer ends the ring — and says so
  const quiet = open(5, 11);
  for (const c of quiet.cameras) c.dead = true;
  const events = [];
  quiet.onAlarmOff = () => events.push('off');
  quiet.raiseAlarm(quiet.alarms[0], 'player');
  tick(quiet, GUARD.alarmHold + 1, IDLE);
  check(!quiet.alarm.on, `the alarm is still on after ${GUARD.alarmHold + 1}s of nobody seeing anything`);
  check(events.includes('off'), 'the alarm timed out and the siren was never told');
});

scenario('a shot is heard; a whisper shot is not', () => {
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
  check(WEAPONS.whisper.noise < 340, 'the test assumes 340px is outside the whisper coil');
  check(WEAPONS.shockwave.noise > 340, 'the test assumes 340px is inside a shockwave');
  check(setup('shockwave').state === 'investigate', 'a shockwave went off 340px away and nobody came');
  check(setup('whisper').state === 'patrol', 'the whisper coil woke a guard 340px away');
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
  game.items.push({ kind: 'gun', gun: 'shockwave', ammo: 12, x: game.player.x + 20, y: game.player.y, taken: false });
  game.player.weapon = { id: 'lance', ammo: 9, cool: 0 };

  game.update(STEP, IDLE);
  check(game.focus && game.focus.kind === 'gun', `the ring offered "${game.focus && game.focus.kind}"`);
  tick(game, PICKUP.gun + 0.2, IDLE, (g) => g.player.weapon.id === 'shockwave');
  check(game.player.weapon.id === 'shockwave', `he is holding a ${game.player.weapon.id}`);
  check(game.player.weapon.ammo === 12, `it came with ${game.player.weapon.ammo} rounds instead of 12`);
  const dropped = game.items.filter((i) => !i.taken && i.gun === 'lance');
  check(dropped.length === 1, 'the lance he was holding vanished instead of hitting the floor');
  check(dropped[0].ammo === 9, `the dropped lance carries ${dropped[0].ammo} rounds instead of 9`);
  check(game.items.length > before, 'nothing was added to the floor');

  // and it does not immediately pick itself back up: the gun he just put down
  // is under his feet, and without the arming delay he swaps for ever
  tick(game, PICKUP.gun + 0.3);
  check(game.player.weapon.id === 'shockwave', `he swapped straight back to the ${game.player.weapon.id}`);
});

scenario('sprinting over a gun does not take it; stopping on it does', () => {
  const rig = () => {
    const game = open();
    game.player.weapon = { id: 'lance', ammo: 9, cool: 0 };
    game.items.push({ kind: 'gun', gun: 'shockwave', ammo: 12, x: game.player.x, y: game.player.y, taken: false });
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
  check(past.player.weapon.id === 'lance', `running over it swapped him to a ${past.player.weapon.id}`);

  const stopped = rig();
  tick(stopped, PICKUP.gun + 0.4, IDLE);
  check(stopped.player.weapon.id === 'shockwave', `stopping on it left him holding a ${stopped.player.weapon.id}`);
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
    game.player.weapon = { id: 'lance', ammo: 30, cool: 0 };
    tick(game, 0.5, { fire: true, aim: { x: g.x, y: g.y } });
    check(g.hp < hp || g.dead, `at ${gap}px the rounds went straight past him (${g.hp}/${hp} hp)`);
  }
});

scenario('a stasis dart drops a guard however big he is', () => {
  // As a damage weapon this stopped working around floor 17, where guard health
  // passes what a stasis dart used to do — a silent takedown that quietly becomes the
  // worst gun in the game exactly where you need it.
  for (const floor of [1, 20, 60]) {
    const game = open(floor, 99);
    const g = faceOff(game, 120);
    game.player.facing = 0;
    game.player.weapon = { id: 'stasis', ammo: 6, cool: 0 };
    tick(game, 1, { fire: true, aim: { x: g.x, y: g.y } }, (gm) => gm.guards[0].dead);
    check(g.dead, `on floor ${floor} (${g.maxHp.toFixed(0)} hp) a stasis dart left him standing`);
    check(game.bodies.length === 1, `no body on floor ${floor}`);
    check(game.bodies[0].tranq, 'a tranquillised guard should not be bleeding on the carpet');
  }
  check(WEAPONS.stasis.noise < WEAPONS.whisper.noise, 'the stasis dart has to be the quietest thing on the floor');
});

scenario('the same gun again is ammunition, not a swap', () => {
  const game = open();
  game.player.weapon = { id: 'needler', ammo: 20, cool: 0 };
  game.items.push({ kind: 'gun', gun: 'needler', ammo: 40, x: game.player.x, y: game.player.y, taken: false });
  tick(game, PICKUP.gun + 0.3, IDLE);
  check(game.player.weapon.id === 'needler', `he is holding a ${game.player.weapon.id}`);
  check(game.player.weapon.ammo === 60, `he has ${game.player.weapon.ammo} rounds instead of 60`);
  check(!game.items.some((i) => !i.taken && i.gun === 'needler'), 'a second needler was put on the floor for no reason');
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
  game.bodies.push({ x: game.player.x, y: game.player.y, a: 0, seen: 0, gun: 'blaster', id: 'z' });
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
  game.player.weapon = { id: 'ioncannon', ammo: 2, cool: 0 };
  tick(game, 3, { fire: true });
  check(game.player.weapon.id === 'whisper', `he is still holding a ${game.player.weapon.id} with ${game.player.weapon.ammo} rounds`);
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
  first.player.weapon = { id: 'lance', ammo: 30, cool: 0 };
  first.stats.money = 4000;
  first.level.vault.cracked = 1;
  first.state = 'cleared';

  const second = run.advance();
  check(second.level.floor === 2, `the lift arrived on floor ${second.level.floor}`);
  check(second.player.weapon.id === 'lance', `he arrived holding a ${second.player.weapon.id}`);
  check(second.player.weapon.ammo === 30, `with ${second.player.weapon.ammo} rounds`);
  check(second.stats.money === 4000 + silentBonus(1), `the bag holds ${second.stats.money} — the silent bonus is missing`);
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

// ------------------------------------------------------------------ the aim

scenario('the gun finds the man inside where you pointed it', () => {
  const game = open(4, 7);
  const g = faceOffClear(game, 260);
  check(g, 'no clear line to set the scenario up on');
  const straight = Math.atan2(g.y - game.player.y, g.x - game.player.x);

  // pointed a good ten degrees wide of him, which is a normal thumb
  const wide = { x: game.player.x + Math.cos(straight + 0.18) * 400, y: game.player.y + Math.sin(straight + 0.18) * 400 };
  game.update(STEP, { aim: wide });
  check(game.aimTarget === g, 'the gun did not find him at ten degrees off');
  check(
    Math.abs(game.player.facing - straight) < Math.abs(straight + 0.18 - straight),
    'it found him and then aimed somewhere else'
  );

  // and a shot fired from there lands
  const hp = g.hp;
  tick(game, 0.6, { fire: true, aim: wide });
  check(g.hp < hp || g.dead, `pointed ten degrees wide, every round missed (${g.hp}/${hp})`);
});

scenario('a bare trigger turns him onto the man behind and holds fire until he is round', () => {
  const game = open(4, 7);
  const g = faceOffClear(game, 240);
  check(g, 'no clear line to set the scenario up on');
  const at = Math.atan2(g.y - game.player.y, g.x - game.player.x);
  // running the other way, which is exactly the kiting case on a phone
  game.player.facing = at + Math.PI;

  game.update(STEP, { autoAim: true, fire: true });
  check(game.aimTarget === g, 'the trigger did not find the man behind him');
  check(game.stats.shots === 0, 'it fired while still facing away — that round hits the wall ahead');

  const hp = g.hp;
  tick(game, 1.4, { autoAim: true, fire: true });
  check(game.stats.shots > 0, 'he came round and the gun never fired');
  check(g.hp < hp || g.dead, `he is round and firing and the man is untouched (${g.hp}/${hp})`);
});

scenario('a bare trigger with nobody visible fires straight ahead', () => {
  const game = open(4, 7);              // every guard dead…
  for (const c of game.cameras) c.dead = true;
  for (const a of game.alarms) a.dead = true;            // …and every device scrap
  const before = game.stats.shots;
  game.update(STEP, { autoAim: true, fire: true });
  check(game.aimTarget === null, 'it locked something on a floor with nothing left to shoot');
  check(game.stats.shots > before, 'the gun refused to fire with nothing on the lock');
});

scenario('the fight is remembered while he backs away', () => {
  const game = open(4, 7);
  const g = faceOffClear(game, 240);
  check(g, 'no clear line to set the scenario up on');
  const at = Math.atan2(g.y - game.player.y, g.x - game.player.x);
  game.player.facing = at;
  game.update(STEP, { autoAim: true, fire: true });     // one shot, fight begun

  // now flee the other way with no aim at all: for a moment the body keeps
  // facing the fight, so the next tap does not fire up the corridor
  const off = () => Math.abs(angleDelta(at, game.player.facing));
  const flee = { mx: -Math.cos(at), my: -Math.sin(at) };
  tick(game, 0.5, flee);
  check(off() < 0.4, `half a second of fleeing swung him ${off().toFixed(2)} rad off the fight`);

  // and once the fight has gone cold, his feet own his eyes again — wherever
  // the walls let them take him, which is why this measures the release and
  // not the exact angle of the corridor he ends up sliding along
  tick(game, 1.6, flee);
  check(off() > 0.6, `two seconds on he still faces the fight (${off().toFixed(2)} rad off)`);
});

scenario('the assist finds a camera, and a man near the same line outranks it', () => {
  const game = open(4, 7);
  const p = game.player;
  const cam = game.cameras[0];
  check(cam, 'floor 4 came up with no cameras');
  // stand the camera in the open, dead ahead
  cam.dead = false;
  cam.x = p.x + 200;
  cam.y = p.y;
  const at = 0;
  const found = assistedAim(game, at);
  check(found.target === cam, 'pointed straight at a camera and the gun ignored it');

  // wake a guard a few degrees off the same line: he shoots back, he wins
  const g = game.guards[0];
  Object.assign(g, { dead: false, x: p.x + 195, y: p.y + 14, state: 'patrol', alert: 0 });
  const both = assistedAim(game, at);
  check(both.target === g, 'a camera outranked the man who shoots back');
});

scenario('a bare trigger reaches the camera when no guard is left', () => {
  const game = open(4, 7);
  const p = game.player;
  const cam = game.cameras[0];
  check(cam, 'floor 4 came up with no cameras');
  cam.dead = false;
  cam.x = p.x + 180;
  cam.y = p.y;
  game.player.facing = Math.PI;                          // looking away from it
  tick(game, 0.8, { autoAim: true, fire: true });
  check(cam.dead, 'held the trigger for most of a second and the camera still watches');
});

scenario('the assist does not aim at what you cannot see', () => {
  const game = open(4, 7);
  const g = faceOffClear(game, 200);
  check(g, 'no clear line to set the scenario up on');
  const at = { x: g.x, y: g.y };

  game.update(STEP, { aim: at });
  check(game.aimTarget === g, 'it did not find him in the open');

  // the same man, now beyond the torch
  const far = open(4, 7);
  const g2 = far.guards[0];
  g2.dead = false;
  g2.x = far.player.x + PLAYER.sight + 200;
  g2.y = far.player.y;
  far.update(STEP, { aim: { x: g2.x, y: g2.y } });
  check(!far.aimTarget, 'it locked onto a man further away than the player can see');

  // and a man behind him
  const behind = open(4, 7);
  const g3 = faceOffClear(behind, 200);
  const away = Math.atan2(g3.y - behind.player.y, g3.x - behind.player.x) + Math.PI;
  behind.update(STEP, { aim: { x: behind.player.x + Math.cos(away) * 300, y: behind.player.y + Math.sin(away) * 300 } });
  check(!behind.aimTarget, 'it spun the gun round to a man behind him');
});

// ---------------------------------------------------------------- the guns

scenario('the gun you start with is the worst gun in a fight, by a distance', () => {
  const quiet = dps(WEAPONS.whisper);
  for (const w of Object.values(WEAPONS)) {
    if (w.id === 'whisper' || w.id === 'stasis') continue;
    const ratio = dps(w) / quiet;
    check(ratio >= 3, `the ${w.id} is only ${ratio.toFixed(1)}x the starting coil — nobody would carry it`);
    check(w.mag >= 20, `the ${w.id} carries ${w.mag} rounds, too few to be worth the noise`);
  }
  check(dps(WEAPONS.shredder) > dps(WEAPONS.blaster), 'a shredder should out-shoot a blaster');
});

scenario('every gun does something no other gun does', () => {
  const has = (k) => Object.values(WEAPONS).filter((w) => w[k]).map((w) => w.id);
  check(has('tranq').length === 1, `${has('tranq').length} guns tranquillise`);
  check(has('pierce').length >= 2, 'nothing goes through a man');
  check(has('heavy').length >= 2, 'no gun costs you your feet');
  check(has('stagger').length >= 2, 'no gun knocks a man off his aim');
  check(WEAPONS.railgun.pierce > WEAPONS.lance.pierce, 'the railgun should out-punch the lance');
  check(WEAPONS.shockwave.range < WEAPONS.lance.range * 0.6, 'the shockwave is meant to be a close-quarters gun');
  check(WEAPONS.shredder.heavy < WEAPONS.shockwave.heavy, 'the shredder should be the heaviest thing to carry');
});

scenario('a lance round goes through the first man to reach the second', () => {
  const game = open(6, 5);
  const a = faceOffClear(game, 150);
  check(a, 'no clear line to line two men up on');
  const dir = Math.atan2(a.y - game.player.y, a.x - game.player.x);
  const b = game.guards[1];
  check(b, 'this floor has only one guard');

  // second in the queue at whatever distance down the same line is actually
  // open — picking one and hoping puts him in a wall about half the time
  let placed = null;
  for (const d of [260, 230, 300, 200, 340]) {
    const x = game.player.x + Math.cos(dir) * d;
    const y = game.player.y + Math.sin(dir) * d;
    if (game.grid.solidAt(x, y)) continue;
    if (!lineOfSight(game.grid, game.player.x, game.player.y, x, y)) continue;
    placed = { x, y };
    break;
  }
  check(placed, 'nowhere behind the first man to put the second');
  b.dead = false;
  b.x = placed.x;
  b.y = placed.y;

  game.player.weapon = { id: 'railgun', ammo: 9, cool: 0 };
  const hpB = b.hp;
  tick(game, 0.3, { fire: true, aim: { x: a.x, y: a.y } });
  check(a.hp < a.maxHp || a.dead, 'the first man was not hit at all');
  check(b.hp < hpB || b.dead, `the round stopped in the first man (${b.hp}/${hpB} on the second)`);
});

scenario('a heavy gun costs you your feet while it fires', () => {
  const light = open();
  light.player.weapon = { id: 'blaster', ammo: 60, cool: 0 };
  tick(light, 1.2, { mx: 1, my: 0, fire: true });
  const a = dist(light.level.spawn.x, light.level.spawn.y, light.player.x, light.player.y);

  const heavy = open();
  heavy.player.weapon = { id: 'shredder', ammo: 200, cool: 0 };
  tick(heavy, 1.2, { mx: 1, my: 0, fire: true });
  const b = dist(heavy.level.spawn.x, heavy.level.spawn.y, heavy.player.x, heavy.player.y);
  check(b < a * 0.8, `firing the shredder on the move covered ${b.toFixed(0)}px against ${a.toFixed(0)}px with a blaster`);
});

scenario('staying quiet is worth more the deeper you go, not less', () => {
  const { plan } = game_config;
  for (const floor of [1, 5, 20]) {
    const bonus = silentBonus(floor);
    const payday = plan(floor).payday;
    check(bonus > payday * 0.25, `on floor ${floor} the silent bonus is ${bonus} against a ${payday} payday — not worth the trouble`);
  }
  check(silentBonus(20) > silentBonus(1) * 5, 'the bonus has to grow with the floors');
});

// ---------------------------------------------------------------- the camera

scenario('he is in the middle of the screen wherever he is standing', () => {
  const W = 1280;
  const H = 720;
  // including the corners of the floor, where a clamped camera used to shove
  // him off centre without ever saying so
  for (const [px, py] of [[0, 0], [640, 360], [2400, 1700], [-200, 90], [50, 2000]]) {
    const cam = cameraFor(px, py, W, H);
    const onScreen = { x: px - cam.x, y: py - cam.y };
    check(
      Math.abs(onScreen.x - W / 2) < 1e-9 && Math.abs(onScreen.y - H / 2) < 1e-9,
      `standing at ${px},${py} he is drawn at ${onScreen.x.toFixed(1)},${onScreen.y.toFixed(1)} and not at ${W / 2},${H / 2}`
    );
  }
});

scenario('the aim is the vector from the middle of the screen to the cursor', () => {
  // The complaint this exists for: a camera that leads or eases leaves him off
  // centre, so where he aims stops being where the cursor is — and as he runs
  // the pointer slides behind him.
  const W = 1280;
  const H = 720;
  const cursor = { x: 900, y: 200 };
  const wanted = Math.atan2(cursor.y - H / 2, cursor.x - W / 2);

  let previous = null;
  for (let step = 0; step < 40; step++) {
    const px = 300 + step * 37.5;          // running right, fast
    const py = 900 - step * 11;
    const w = screenToWorld(cursor.x, cursor.y, px, py, W, H);
    const got = Math.atan2(w.y - py, w.x - px);
    check(
      Math.abs(got - wanted) < 1e-9,
      `after ${step} steps of running the same cursor aims at ${(got * 180 / Math.PI).toFixed(1)}° instead of ${(wanted * 180 / Math.PI).toFixed(1)}°`
    );
    if (previous !== null) check(Math.abs(got - previous) < 1e-9, 'the aim moved while only he did');
    previous = got;
  }
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

// ---------------------------------------------------------------- the thumbs

const pad = () => createTouchControls(() => 1280, () => 720);

scenario('a touch on the right half is already a shot', () => {
  const t = pad();
  t.start(1, 900, 400);
  const r = t.read();
  check(r.fire === true, 'the thumb is on the right half and the gun has not gone off');
  check(r.aimAngle === null, `a touch that has not moved was read as an aim (${r.aimAngle})`);
  t.end(1);
  check(t.read().fire === false, 'it kept firing after the thumb left the glass');
});

scenario('the gun icon is a stick: pulling on it turns the barrel', () => {
  const t = pad();
  const gun = fireButton(1280, 720);
  // the thumb lands off the middle of the icon, which is what a thumb does
  t.start(1, gun.x + 20, gun.y + 14);
  check(t.read().fire === true, 'pressing the icon did not fire');

  // and then pulls straight up from the icon's middle. Measured from where the
  // finger landed instead, this same drag reads about 0.2 rad off.
  t.move(1, gun.x, gun.y - 80);
  const r = t.read();
  check(Math.abs(r.aimAngle + Math.PI / 2) < 0.01, `pulled straight up off the icon and the barrel went to ${r.aimAngle.toFixed(2)}`);
  check(r.fire === true, 'the shot stopped the moment it was being aimed');
});

scenario('a thumb that shakes mid-burst does not swing the barrel round the room', () => {
  const t = pad();
  t.start(1, 900, 400);
  t.move(1, 900, 300);                        // aimed straight up
  const aimed = t.read().aimAngle;
  check(Math.abs(aimed + Math.PI / 2) < 0.01, `pulled up and got ${aimed}`);
  t.move(1, 900 + AIM.dead - 2, 400);         // and back inside the deadzone
  const r = t.read();
  check(r.aimAngle === aimed, `the barrel swung from ${aimed.toFixed(2)} to ${String(r.aimAngle)} on a thumb that came home`);
  check(r.fire === true, 'and it stopped firing on the way');
});

scenario('the roll and the hand are pressed, not fired', () => {
  const t = pad();
  const roll = rollButton(1280, 720);
  t.start(1, roll.x, roll.y);
  let r = t.read();
  check(r.roll === true && r.fire === false, `the roll button fired the gun (roll=${r.roll}, fire=${r.fire})`);

  const hand = useButton(1280, 720);
  t.offerUse(true);
  t.start(2, hand.x, hand.y);
  r = t.read();
  check(r.use === true && r.fire === false, `the hand button fired the gun (use=${r.use}, fire=${r.fire})`);

  // with no body at his feet the hand is not on screen, and that patch of glass
  // is the trigger like the rest of the right half
  t.offerUse(false);
  t.start(3, hand.x, hand.y);
  check(t.read().fire === true, 'the hidden hand button went on swallowing the shot');
});

scenario('the three buttons keep off each other, on every width the frame gives', () => {
  for (const W of [1152, 1280, 1600]) {
    const H = 720;
    const all = [['gun', fireButton(W, H)], ['roll', rollButton(W, H)], ['hand', useButton(W, H)]];
    for (const [name, b] of all) {
      check(b.x + b.r <= W && b.y + b.r <= H, `the ${name} button hangs off the screen at ${W}x${H}`);
      check(b.x - b.r > W / 2, `the ${name} button reaches into the walking half at ${W}x${H}`);
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const [an, a] = all[i];
        const [bn, b] = all[j];
        const gap = dist(a.x, a.y, b.x, b.y) - a.r - b.r;
        check(gap > 0, `${an} and ${bn} overlap by ${(-gap).toFixed(0)}px at ${W}x${H}`);
      }
    }
  }
});

scenario('a tap with no drag still points, and the gun finds the man', () => {
  const game = open(4, 7);
  const g = faceOffClear(game, 220);
  check(g, 'no clear line to set the scenario up on');
  const hp = g.hp;
  // what main.js hands the game for a thumb that has touched and not dragged:
  // the trigger down, and the angle he is already facing
  tick(game, 0.8, () => ({ fire: true, aimAngle: game.player.facing }));
  check(game.aimTarget === g, 'the tap pointed at nothing, so the assist had nothing to find');
  check(g.hp < hp || g.dead, `the tap fired and he is untouched (${g.hp}/${hp})`);
});

scenario('the whole screen draws, on every phase, in both languages', () => {
  const ctx = headlessContext(1280, 720);
  const vp = { W: 1280, H: 720 };
  const renderer = createRenderer();
  const game = open(6, 44, { clearGuards: false });
  game.items.push({ kind: 'loot', value: 100, x: game.player.x + 30, y: game.player.y, taken: false });
  game.bodies.push({ x: game.player.x - 30, y: game.player.y, a: 1, seen: 0, gun: 'blaster', id: 'z' });

  const fx = { bits: [{ x: 0, y: 0, size: 3, colour: '#fff', t: 0.2, life: 0.4 }], rings: [{ x: 0, y: 0, r: 5, max: 40, t: 0.2, life: 0.4, colour: '#f00' }], floats: [{ x: 0, y: 0, text: '+$1', colour: '#fff', t: 0.5, life: 1 }], state: { shake: 4 } };

  for (const lang of ['en', 'pt']) {
    game.level.plan.i18nProbe = lang;      // just a marker; the dictionary is read by render
    game.update(STEP, IDLE);
    renderer.draw(ctx, game, vp, { fx });
    game.level.vault.cracked = 0.5;
    game.raiseAlarm(game.alarms[0], 'guard');
    game.update(STEP, IDLE);
    renderer.draw(ctx, game, vp, { fx, touch: { stick: { on: true, ox: 100, oy: 500, x: 140, y: 520 }, trigger: { on: false } } });
    // and the trigger held, dragged off the icon: the reticle lights up and grows
    // a barrel, which is a branch of its own
    const gun = fireButton(vp.W, vp.H);
    renderer.draw(ctx, game, vp, {
      fx,
      touch: {
        stick: { on: false },
        trigger: { on: true, onIcon: true, ox: gun.x, oy: gun.y, x: gun.x - 40, y: gun.y - 30, angle: -2.5 },
      },
    });
  }
  check(true, 'a full frame was painted without throwing');
});

await runTests('infinite fortress — the escape');
