// The match itself, played in Node at a fixed step.
//
// Every scenario puts the actor where the scenario happens — a carrier is set
// down next to his own stand, a turret is pointed at somebody — rather than
// walking there from the spawn. What is under test is the rule, not the metres
// in between.
//
// The exception is the last three, which play whole matches between two squads
// of bots. Those are here because the things they measure cannot be checked any
// other way: that a match *ends*, that both sides score, and that neither side
// of a mirrored field wins by being itself.

import { scenario, check, run as runTests, installHeadlessDom } from 'slopkit/testing';

installHeadlessDom();      // render.js reaches i18n, which reads localStorage on load

const {
  UNIT, GUNS, FLAG, TURRET, PAD, REGEN, TARGET, PHASES, ARENA_W, ARENA_H, ROLL, TILE, VISION,
  BOT_RANGE, dist, other, viewWidth, cameraFor, angleDelta, RAD,
} = await import('../src/config.js');
const { buildArena } = await import('../src/arena.js');
const { createGame, assistedAim, nearestThreat, segmentHit } = await import('../src/game.js');
const { ARMOURY, REWARD, STANDARD, byId, worth } = await import('../src/weapons.js');
const { AI_FLAGS, lanesOf, reconsider } = await import('../src/ai.js');
const { carrierOf, flagPoint } = await import('../src/match.js');
const { createRenderer, screenToWorld } = await import('../src/render.js');
const { createTouchControls, moveInput, aimAngle, fireButton, rollButton } = await import('../src/controls.js');
const { createFx } = await import('../src/fx.js');
const { headlessContext } = await import('slopkit/testing');

const STEP = 1 / 60;
const IDLE = {};

/** A match with every bot asleep, so a scenario is the only thing happening. */
function open(phase = 0, { quiet = true, team = 'human', seed = 5 } = {}) {
  const game = createGame({ arena: buildArena(phase), team, seed });
  if (quiet) {
    for (const u of game.units) {
      if (u === game.player) continue;
      u.dead = true;
      u.respawnT = 1e6;                 // asleep, not respawning
    }
  }
  return game;
}

function tick(game, seconds, input = IDLE, done = null) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    game.update(STEP, typeof input === 'function' ? input(i) : input);
    if (done && done(game, i * STEP)) return i * STEP;
  }
  return null;
}

// ------------------------------------------------------------- the flag rules

scenario('a flag carried home is a point', () => {
  const game = open();
  const me = game.player;
  const theirs = game.flags.alien;
  me.x = theirs.x;
  me.y = theirs.y;
  tick(game, 0.2);
  check(theirs.state === 'carried' && theirs.carrier === me.id, 'standing on the enemy stand did not take the flag');

  const home = game.flags.human.home;
  me.x = home.x;
  me.y = home.y;
  tick(game, 0.2);
  check(game.score.human === 1, `carrying it home scored ${game.score.human}`);
  check(theirs.state === 'home', 'the flag did not go back to its own stand after the point');
  check(game.stats.captures === 1, 'the capture was not booked to the player');
});

scenario('you cannot score while your own flag is out of its stand', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const thief = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== thief) { u.dead = true; u.respawnT = 1e6; }
  // the sentinel takes ours, and stops where he is
  thief.x = game.flags.human.x;
  thief.y = game.flags.human.y;
  tick(game, 0.1);
  check(game.flags.human.state === 'carried', 'the sentinel did not pick our flag up');

  me.x = game.flags.alien.x;
  me.y = game.flags.alien.y;
  tick(game, 0.1);
  me.x = game.flags.human.home.x;
  me.y = game.flags.human.home.y;
  tick(game, 0.5);
  check(game.score.human === 0, 'a point was scored with our own flag in enemy hands');
  check(game.flags.alien.carrier === me.id, 'the flag left our hands without scoring');
});

scenario('your own flag has to be carried back: touching it is not enough', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const thief = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== thief) { u.dead = true; u.respawnT = 1e6; }

  // the sentinel takes ours and is shot down halfway
  thief.x = game.flags.human.x;
  thief.y = game.flags.human.y;
  tick(game, 0.1);
  const where = { x: game.flags.human.home.x + TILE * 4, y: game.flags.human.home.y };
  check(game.grid.walkableAt(where.x, where.y), 'the test dropped it inside a wall');
  thief.x = where.x;
  thief.y = where.y;
  thief.hp = 0;
  tick(game, 0.05);
  const mine = game.flags.human;
  check(mine.state === 'dropped', `our flag is ${mine.state} after the thief went down`);

  // walking over it picks it up — it does not fly home
  me.x = mine.x;
  me.y = mine.y;
  tick(game, 0.1);
  check(mine.state === 'carried' && mine.carrier === me.id,
    `touching our own flag left it ${mine.state} — it should be in his hands`);
  check(dist(mine.home.x, mine.home.y, me.x, me.y) > 100,
    'the test picked it up on the stand, which proves nothing');

  // and it stays out however long nobody walks it back
  tick(game, 6);
  check(mine.state === 'carried', 'the flag went home without anybody carrying it');

  // it is home when he is
  me.x = mine.home.x;
  me.y = mine.home.y;
  tick(game, 0.1);
  check(mine.state === 'home', 'walking it to the stand did not put it back');
  check(game.stats.returns === 1, 'the walk home was not booked as a rescue');

  // with it home, the point counts again
  me.x = game.flags.alien.x;
  me.y = game.flags.alien.y;
  tick(game, 0.1);
  me.x = game.flags.human.home.x;
  me.y = game.flags.human.home.y;
  tick(game, 0.2);
  check(game.score.human === 1, 'the run did not score once our flag was back in its stand');
});

scenario('nobody carries two flags', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const thief = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== thief) { u.dead = true; u.respawnT = 1e6; }

  // ours is on the deck, right next to theirs — the worst case for the rule
  thief.x = game.flags.human.x;
  thief.y = game.flags.human.y;
  tick(game, 0.1);
  thief.x = game.flags.alien.home.x - TILE;
  thief.y = game.flags.alien.home.y;
  thief.hp = 0;
  tick(game, 0.05);
  check(game.flags.human.state === 'dropped', 'our flag is not on the deck');

  me.x = game.flags.human.x;
  me.y = game.flags.human.y;
  tick(game, 0.1);
  check(game.flags.human.carrier === me.id, 'he did not pick our flag up');
  me.x = game.flags.alien.home.x;
  me.y = game.flags.alien.home.y;
  tick(game, 0.2);
  check(game.flags.alien.state === 'home',
    'he picked up their flag with ours already in his hands');
});

scenario('a dead carrier drops the flag where he fell, and the pit keeps nothing', () => {
  const game = open(1);          // the bridge: the arena with somewhere to lose it
  const me = game.player;
  const take = () => {
    me.x = game.flags.alien.x;
    me.y = game.flags.alien.y;
    tick(game, 0.1);
  };
  take();
  check(game.flags.alien.carrier === me.id, 'the flag was not taken');

  // shot on the bridge: it lands under him, and anybody can pick it up
  me.x = game.arena.spawns.alien[0].x - 200;
  me.y = game.arena.spawns.alien[0].y;
  check(game.grid.walkableAt(me.x, me.y), 'the test put him inside a wall');
  me.hp = 0;
  tick(game, 0.05);
  const flag = game.flags.alien;
  check(flag.state === 'dropped', `the flag is ${flag.state} after the carrier died`);
  check(game.grid.walkableAt(flag.x, flag.y), 'the flag landed somewhere nobody can reach');
  check(dist(flag.x, flag.y, me.x, me.y) < 40, 'the flag did not land where the body did');

  // shot over the pit: it goes back to its stand instead of being handed to
  // whoever shot him
  tick(game, 5);
  me.dead = false;
  me.hp = UNIT.hp;
  take();
  check(game.flags.alien.carrier === me.id, 'the flag was not taken the second time');
  me.x = ARENA_W / 2;
  me.y = 64;
  check(!game.grid.walkableAt(me.x, me.y), 'the test did not put him over the pit');
  me.hp = 0;
  tick(game, 0.05);
  check(game.flags.alien.state === 'home', `a flag lost over the pit is ${game.flags.alien.state}`);
});

scenario('a flag nobody comes back for stays exactly where it fell', () => {
  const game = open();
  const me = game.player;
  me.x = game.flags.alien.x;
  me.y = game.flags.alien.y;
  tick(game, 0.1);
  const spot = { x: me.x, y: me.y };
  me.hp = 0;
  tick(game, 0.05);
  const flag = game.flags.alien;
  check(flag.state === 'dropped', 'it was not dropped');
  tick(game, 30);
  check(flag.state === 'dropped', 'it walked home on its own after thirty seconds');
  check(dist(flag.x, flag.y, spot.x, spot.y) < TILE, 'it wandered off on its own');
  check(flag.timer > 25, 'nothing is counting how long it has lain there');
});

scenario('a match ends at ten, and the winner is whoever got there', () => {
  const game = open();
  let ended = null;
  game.onEnd = (state, winner) => { ended = { state, winner }; };
  const me = game.player;
  for (let i = 0; i < TARGET; i++) {
    me.x = game.flags.alien.x;
    me.y = game.flags.alien.y;
    tick(game, 0.1);
    me.x = game.flags.human.home.x;
    me.y = game.flags.human.home.y;
    tick(game, 0.1);
  }
  check(game.score.human === TARGET, `the run scored ${game.score.human}`);
  check(game.state === 'won', `the match is ${game.state} at ${TARGET} points`);
  check(ended && ended.winner === 'human', 'nobody was told the match had finished');
  const before = game.time;
  tick(game, 1);
  check(game.time === before, 'the match kept simulating after it was over');
});

// -------------------------------------------------------------- the shooting

scenario('a shot crosses the room, hits a body and stops at a wall', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const foe = game.units.find((u) => u.team === 'alien');
  // asleep, not respawning: bodies that come back four seconds later join in,
  // and their rounds get read as the ones under test
  for (const u of game.units) if (u !== me && u !== foe) { u.dead = true; u.respawnT = 1e6; }

  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  me.facing = 0;
  foe.x = lane.x + 260;
  foe.y = lane.y;
  foe.dead = false;
  foe.hp = UNIT.hp;
  foe.bot = false;                 // he stands still and takes it

  tick(game, 1.6, { fire: true, aim: { x: foe.x, y: foe.y } });
  check(foe.hp < UNIT.hp, 'a second of point-blank fire did nothing');
  check(foe.hp < UNIT.hp - 20, `a second and a half of fire took ${(UNIT.hp - foe.hp).toFixed(0)} points off him`);

  // and a wall eats the round
  const wall = behind_wall(game, me);
  const before = foe.hp;
  foe.x = wall.x;
  foe.y = wall.y;
  tick(game, 1.5, { fire: true, aim: { x: foe.x, y: foe.y } });
  check(foe.hp === before, 'a round went through a wall');
});

scenario('nobody shoots his own squad in the back', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const mate = game.units.find((u) => u.team === me.team && u !== me);
  for (const u of game.units) if (u !== me && u !== mate) { u.dead = true; u.respawnT = 1e6; }
  mate.dead = false;
  mate.bot = false;
  mate.hp = UNIT.hp;
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  mate.x = lane.x + 240;
  mate.y = lane.y;
  tick(game, 1.5, { fire: true, aim: { x: mate.x, y: mate.y } });
  check(mate.hp === UNIT.hp, `a teammate took ${(UNIT.hp - mate.hp).toFixed(0)} points of friendly fire`);
});

scenario('the gun finds the man you pointed at, and never one behind a wall', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const foe = game.units.find((u) => u.team === 'alien');
  // asleep, not respawning: bodies that come back four seconds later join in,
  // and their rounds get read as the ones under test
  for (const u of game.units) if (u !== me && u !== foe) { u.dead = true; u.respawnT = 1e6; }
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  foe.dead = false;
  foe.x = lane.x + 320;
  foe.y = lane.y + 40;             // seven degrees off the straight line

  const raw = (x, y) => Math.atan2(y - me.y, x - me.x);
  const near = assistedAim(game, me, raw(lane.x + 320, lane.y - 10));
  check(near.target === foe, 'the assist did not find a body fifty pixels off the line of fire');
  check(Math.abs(near.angle - raw(foe.x, foe.y)) < 1e-6, 'the assist found him and pointed somewhere else');

  const away = assistedAim(game, me, raw(lane.x, lane.y + 400));
  check(!away.target, 'the assist swung the barrel at somebody the cursor was nowhere near');

  // and never through a wall: put him on the other side of one
  const wall = behind_wall(game, me);
  foe.x = wall.x;
  foe.y = wall.y;
  const blind = assistedAim(game, me, raw(foe.x, foe.y));
  check(!blind.target, 'the assist locked onto a body through a wall');
  check(!nearestThreat(game, me), 'a bare trigger found a man through a wall');
});

/**
 * Where a body is looking, in degrees off where it should be — the number every
 * scenario about the barrel reports when it fails.
 */
const offBy = (facing, want) => Math.abs(angleDelta(facing, want)) / RAD;
const at = (u, x, y) => Math.atan2(y - u.y, x - u.x);

scenario('with nobody on the trigger he watches the man in front, not the one behind', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const foe = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== foe) { u.dead = true; u.respawnT = 1e6; }
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  me.facing = 0;                             // eyes on him, the fight just over
  foe.dead = false;
  foe.hp = UNIT.hp;
  foe.bot = false;                           // no brain: he stands where he is put
  const spot = { x: lane.x + 300, y: lane.y };
  const stand = (o) => () => { foe.x = spot.x; foe.y = spot.y; foe.vx = 0; foe.vy = 0; return o; };

  // backing away from him with both hands off the gun: the shoulders stay on
  // the fight, which is the whole of walking backwards out of one
  tick(game, 1, stand({ mx: -1, my: 0 }));
  check(offBy(me.facing, at(me, spot.x, spot.y)) < 4,
    `backing away from a man in plain sight he ended up looking ${offBy(me.facing, at(me, spot.x, spot.y)).toFixed(0)}° off him`);

  // a man BEHIND him in plain sight does not steer the walk. The lit arenas
  // see 360° and 900px, so "he can see him" alone had the soldier crossing the
  // whole field backwards, staring at somebody off the player's screen — the
  // walking-backwards bug, as reported from a phone. One second of walking so
  // he stays inside `BOT_RANGE` the whole way: past it the other bar takes
  // over, and this check would no longer be the cone's.
  me.x = lane.x;
  me.facing = Math.PI;
  me.combat = 0;
  tick(game, 1, stand({ mx: -1, my: 0 }));
  check(dist(me.x, me.y, spot.x, spot.y) < BOT_RANGE, 'the test walked him out of range, so the cone was never the bar');
  check(offBy(me.facing, Math.PI) < 6,
    `walking west with a man behind him he faces ${offBy(me.facing, Math.PI).toFixed(0)}° off his feet`);

  // and too far to be a fight is too far to stare at: in front, in plain
  // sight, but past the line a fight starts at, the feet keep the shoulders
  me.x = spot.x - BOT_RANGE - 60;
  me.y = spot.y;
  me.facing = 0;                             // square on to him, only far
  me.combat = 0;
  check(game.visibleTo(me, spot.x, spot.y), 'the test wants him visible, only far');
  tick(game, 1, stand({ mx: -1, my: 0 }));
  check(offBy(me.facing, Math.PI) < 6,
    `walking away from a man a screen away he faces ${offBy(me.facing, Math.PI).toFixed(0)}° off his feet`);

  // and with the field empty he looks where his feet are going — the last
  // half of the rule, and the one that stops him staring at a ghost
  foe.dead = true;
  foe.respawnT = 1e6;
  me.x = lane.x;
  tick(game, 2.4, { mx: -1, my: 0 });
  check(offBy(me.facing, Math.PI) < 6,
    `with nobody in sight, walking west, he faces ${offBy(me.facing, Math.PI).toFixed(0)}° off it`);
});

scenario('a burst that loses its man keeps pouring rounds where he was', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const aliens = game.units.filter((u) => u.team === 'alien');
  const foe = aliens[0];
  const second = aliens[1];
  for (const u of game.units) if (u !== me && u !== foe && u !== second) { u.dead = true; u.respawnT = 1e6; }
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  const spot = { x: lane.x + 300, y: lane.y };
  const back = { x: lane.x - 300, y: lane.y };   // a second man, the other way
  const wall = behind_wall(game, me);
  for (const u of [foe, second]) { u.dead = false; u.hp = 1e6; u.bot = false; }
  // A body with no brain is driven by the orders under test, so it shoots back
  // the moment the scenario holds the trigger. A cooldown that never runs out
  // is what makes it furniture: what is being measured is one barrel.
  const stand = (o, where) => () => {
    foe.x = where.x;
    foe.y = where.y;
    second.x = back.x;
    second.y = back.y;
    foe.vx = foe.vy = second.vx = second.vy = 0;
    foe.cool = second.cool = 1e6;
    return o;
  };

  tick(game, 0.4, stand({ fire: true }, spot));
  check(me.aimTarget === foe, 'a bare trigger did not take the man standing in front of it');
  const held = me.facing;

  // he steps behind a wall and the finger stays down
  tick(game, 0.9, stand({ fire: true }, wall));
  check(offBy(me.facing, held) < 3,
    `the man went out of sight and the barrel swung ${offBy(me.facing, held).toFixed(0)}° off the doorway he went through`);
  check(me.aimTarget !== second, 'a burst that lost its man handed the barrel to somebody behind you');

  // a new press is what asks for a new man
  tick(game, 0.3, stand({}, wall));
  tick(game, 0.5, stand({ fire: true }, wall));
  check(me.aimTarget === second, 'a fresh press did not go looking for a man of its own');
});

scenario('the barrel keeps a man the gun in your hands cannot reach', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const foe = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== foe) { u.dead = true; u.respawnT = 1e6; }
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  me.weapon = { id: 'scatter', ammo: 24 };   // 420 px of reach, against 900 of eyes
  foe.dead = false;
  foe.hp = 1e6;
  foe.bot = false;
  const spot = { x: lane.x + 300, y: lane.y };
  const stand = (o) => () => { foe.x = spot.x; foe.y = spot.y; foe.vx = 0; foe.vy = 0; return o; };

  tick(game, 0.3, stand({ fire: true }));
  check(me.aimTarget === foe, 'the trigger did not take a man well inside the scatter');

  // now he backs out past what the shells reach, and the finger stays down
  spot.x = lane.x + 700;
  tick(game, 0.6, stand({ fire: true }));
  check(byId('scatter').range < 700 && game.eyes.sight > 700, 'the scenario is no longer between the two ranges');
  check(me.aimTarget === foe,
    'backing away past the gun\'s reach dropped the lock on a man still in plain sight');
  check(offBy(me.facing, at(me, spot.x, spot.y)) < 3,
    `the barrel ended up ${offBy(me.facing, at(me, spot.x, spot.y)).toFixed(0)}° off a man it can see`);
});

/**
 * The middle of a long clear stretch, found rather than assumed — so a scenario
 * that needs room around a body gets it whatever the layout is doing today.
 */
function open_lane(game) {
  let best = { x: TILE * 2, y: TILE * 2, run: 0 };
  for (let cy = 1; cy < 16; cy++) {
    const y = cy * TILE + TILE / 2;
    let run = 0;
    for (let cx = 1; cx < 27; cx++) {
      run = game.grid.walkable(cx, cy) ? run + 1 : 0;
      if (run > best.run) best = { x: (cx - run / 2) * TILE + TILE / 2, y, run };
    }
  }
  return best;
}

/**
 * A walkable point with a wall between it and this body — and a **thick** one.
 *
 * A point that is merely round a corner is not a fair test of "a round does not
 * go through a wall": the round leaves twenty pixels in front of him and with a
 * spread on it, so it can turn a corner the line of sight could not. This wants
 * a real slab in the way, so it counts how much of the line is inside one.
 */
function behind_wall(game, u) {
  let best = null;
  let bestSolid = 0;
  for (let cy = 1; cy < 16; cy++) {
    for (let cx = 1; cx < 27; cx++) {
      if (!game.grid.walkable(cx, cy)) continue;
      const x = cx * TILE + TILE / 2;
      const y = cy * TILE + TILE / 2;
      const d = dist(u.x, u.y, x, y);
      if (d > 620 || d < 110 || game.visibleTo(u, x, y)) continue;
      let solid = 0;
      for (let i = 1; i < 20; i++) {
        const k = i / 20;
        if (!game.grid.walkableAt(u.x + (x - u.x) * k, u.y + (y - u.y) * k)) solid++;
      }
      if (solid > bestSolid) {
        bestSolid = solid;
        best = { x, y };
      }
    }
  }
  check(bestSolid >= 3, `the thickest wall the test could find between two open points is ${bestSolid}/20 of the line`);
  return best || { x: u.x, y: u.y };
}

scenario('a segment finds what a point would have flown straight past', () => {
  // 1000 px/s at a 60 Hz step is a seventeen-pixel jump: a body is twelve
  check(segmentHit(0, 0, 100, 0, 50, 0, 12) !== null, 'a segment straight through a body missed it');
  check(segmentHit(0, 0, 100, 0, 50, 30, 12) === null, 'a segment hit something 30 pixels off the line');
  check(segmentHit(0, 0, 100, 0, 200, 0, 12) === null, 'a segment hit something past its own end');
  const t = segmentHit(0, 0, 100, 0, 50, 0, 12);
  check(t > 0.3 && t < 0.45, `the hit landed at ${t.toFixed(2)} of the way along, not at the body`);
});

scenario('the roll is a shove, a commitment and a wait', () => {
  const game = open();
  const me = game.player;
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;

  // half a second of walking, then the same half second with the roll pressed
  tick(game, 0.5, { mx: 1, my: 0 });
  const walked = me.x - lane.x;
  me.x = lane.x;
  me.vx = 0;
  tick(game, 0.5, (i) => ({ mx: 1, my: 0, roll: i === 0 }));
  const rolled = me.x - lane.x;
  check(rolled > walked * 1.25, `the roll covered ${rolled.toFixed(0)}px against a walk's ${walked.toFixed(0)}px`);
  check(me.rollCool > 0, 'the roll costs nothing, so there is no reason ever to walk');

  // held down, it does not repeat: it is a press
  const before = me.x;
  tick(game, ROLL.cool + ROLL.time + 0.2, { mx: 1, my: 0, roll: true });
  const held = me.x - before;
  me.x = before;
  me.vx = 0;
  tick(game, 0.1, IDLE);              // let the button up: the roll is an edge
  tick(game, ROLL.cool + ROLL.time + 0.2, (i) => ({ mx: 1, my: 0, roll: i === 0 || i === 90 }));
  check(me.x - before > held, 'holding the roll rolls as often as tapping it');

  // and it is drawable: the tumble reads `roll` and `rollA`, so both have to be
  // there and `roll` has to run down rather than sit at its full value
  tick(game, 1.2, IDLE);
  tick(game, 0.05, (i) => ({ mx: 1, my: 0, roll: i === 0 }));
  check(me.roll > 0 && me.roll <= ROLL.time, `mid-roll the clock reads ${me.roll.toFixed(2)}`);
  check(typeof me.rollA === 'number', 'nothing says which way he threw himself');
  const at = me.roll;
  tick(game, 0.1, { mx: 1, my: 0 });
  check(me.roll < at, 'the roll clock does not run down, so the tumble would freeze');
});

scenario('by day you see the whole room, and never through a wall', () => {
  const game = open(0);                      // a lit arena
  const me = game.player;
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  me.facing = 0;                             // looking east

  const behind = { x: lane.x - TILE * 2, y: lane.y };
  check(game.grid.walkableAt(behind.x, behind.y), 'the test looked into a wall');
  check(game.visibleTo(me, behind.x, behind.y),
    'a man two tiles behind him in the same room is invisible in daylight');
  check(game.visibleTo(me, lane.x, lane.y - 100) || game.visibleTo(me, lane.x, lane.y + 100),
    'nothing to either side of him is visible either — the day cone is not a circle');

  const wall = behind_wall(game, me);
  check(!game.visibleTo(me, wall.x, wall.y), 'daylight goes through a wall');
  check(dist(me.x, me.y, wall.x, wall.y) < VISION.day.sight,
    'the test only proved he cannot see past his own range');
});

scenario('at night it is a torch: what is behind you is behind you', () => {
  const game = open(PHASES.findIndex((p) => p.id === 'maze'));
  const me = game.player;
  me.facing = 0;
  const ahead = { x: me.x + 120, y: me.y };
  const behind = { x: me.x - 300, y: me.y };
  const beside = { x: me.x, y: me.y - 300 };

  check(game.grid.walkableAt(ahead.x, ahead.y), 'the test looked into a wall');
  check(game.visibleTo(me, ahead.x, ahead.y), 'the torch does not light what is in front of him');
  check(!game.visibleTo(me, behind.x, behind.y), 'the torch lights what is behind him');
  check(!game.visibleTo(me, beside.x, beside.y), 'the torch lights the whole side of the corridor');

  // and the small circle you feel rather than see, which the day does without
  const touching = { x: me.x - VISION.night.near * 0.5, y: me.y };
  check(game.visibleTo(me, touching.x, touching.y), 'he cannot feel what he is standing against');
  check(VISION.day.near === 0, 'daylight has a near circle, which it has no use for');
});

scenario('a body left alone knits itself together; one under fire does not', () => {
  const game = open();
  const me = game.player;
  me.hp = 40;
  me.calm = 0;
  tick(game, REGEN.delay - 1);
  check(me.hp === 40, 'he healed while the shooting was still going on');
  tick(game, 2);
  check(me.hp > 40, `${REGEN.delay + 1}s of quiet healed nothing`);
  check(me.hp <= UNIT.hp, 'he healed past full');
});

scenario('a soldier comes back where his squad is, at full health', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  me.hp = 0;
  tick(game, 0.05);
  check(me.dead, 'he is not down');
  check(game.stats.deaths === 1, 'the death was not booked');
  tick(game, game.arena.respawn - 0.5);
  check(me.dead, 'he came back early');
  tick(game, 1);
  check(!me.dead && me.hp === UNIT.hp, `he came back with ${me.hp} health`);
  const spots = game.arena.spawns.human;
  check(spots.some((s) => dist(s.x, s.y, me.x, me.y) < 2), 'he came back somewhere that is not a spawn');
});

// ------------------------------------------------------------- the armoury

scenario('a body down pays in shards, and one carrying a flag pays more', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const foe = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== foe) { u.dead = true; u.respawnT = 1e6; }
  foe.dead = false;
  foe.hp = 1;
  check(me.shards === 0, 'he started with shards in his pocket');

  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  foe.x = lane.x + 120;
  foe.y = lane.y;
  foe.bot = false;
  tick(game, 0.6, { fire: true, aim: { x: foe.x, y: foe.y } });
  check(foe.dead, 'the shot did not land');
  check(me.shards === REWARD.kill, `a body down paid ${me.shards}`);

  // and again with our flag on his back
  tick(game, game.arena.respawn + 0.2);
  foe.x = game.flags.human.x;
  foe.y = game.flags.human.y;
  tick(game, 0.1);
  check(game.flags.human.carrier === foe.id, 'he did not take the flag');
  foe.hp = 1;
  me.x = foe.x - 120;
  me.y = foe.y;
  tick(game, 0.6, { fire: true, aim: { x: foe.x, y: foe.y } });
  check(me.shards === REWARD.kill * 2 + REWARD.carrierKill,
    `stopping a flag paid ${me.shards - REWARD.kill}, not ${REWARD.kill + REWARD.carrierKill}`);
});

scenario('the armoury opens on your own ground and nowhere else', () => {
  const game = open();
  const me = game.player;
  const gun = ARMOURY[0];
  me.shards = gun.cost;

  // out in the field: no
  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  check(!game.inBase(me), 'the test stood him in his own base');
  check(!game.buy(me, gun.id), 'he bought a gun standing in the middle of the field');
  check(me.weapon.id === STANDARD, 'he is holding something he could not have');

  // on his own ground: yes
  me.x = game.flags.human.home.x;
  me.y = game.flags.human.home.y;
  check(game.inBase(me), 'his own stand is not his own ground');
  check(game.buy(me, gun.id), 'he could not buy on his own ground');
  check(me.weapon.id === gun.id && me.weapon.ammo === gun.ammo, 'the gun arrived empty');
  check(me.shards === 0, `he was charged ${gun.cost - me.shards}`);

  // and not twice on one purse
  check(!game.buy(me, gun.id), 'he bought a second one with an empty pocket');
});

scenario('a bought gun runs out, and hands you back your own', () => {
  const game = open();
  const me = game.player;
  const gun = byId('repeater');
  me.shards = gun.cost;
  me.x = game.flags.human.home.x;
  me.y = game.flags.human.home.y;
  game.buy(me, gun.id);
  check(me.weapon.ammo === gun.ammo, 'it did not come full');

  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  let dry = false;
  game.onDry = () => { dry = true; };
  // fire until it gives up rather than for a computed number of seconds: the
  // cooldown is counted in whole steps, so the real rate is a shade slower than
  // the one on the card and the arithmetic comes up short
  const emptied = tick(game, 30, { fire: true, aimAngle: 0 }, () => dry);
  check(dry, 'nobody was told the gun had run out');
  check(emptied > gun.rate * gun.ammo * 0.8, `it emptied in ${emptied && emptied.toFixed(1)}s, which is faster than it can fire`);
  check(me.weapon.id === STANDARD, `he is still holding the ${me.weapon.id}`);
  check(game.gun(me).id === GUNS.human.id, 'the gun in his hands is not his own side\'s');
});

scenario('die with a gun and it lands on the deck, for anybody', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const foe = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== foe) { u.dead = true; u.respawnT = 1e6; }

  me.shards = 1000;
  me.x = game.flags.human.home.x;
  me.y = game.flags.human.home.y;
  game.buy(me, 'lance');
  tick(game, 0.4, { fire: true, aimAngle: 0 });          // spend a round, so it is not full
  const left = me.weapon.ammo;
  check(left < byId('lance').ammo, 'the test did not fire it');

  const lane = open_lane(game);
  me.x = lane.x;
  me.y = lane.y;
  me.hp = 0;
  tick(game, 0.05);
  check(game.drops.length === 1, `${game.drops.length} guns on the deck`);
  check(game.drops[0].id === 'lance' && game.drops[0].ammo === left,
    'it landed with a different gun or a different magazine');
  check(dist(game.drops[0].x, game.drops[0].y, lane.x, lane.y) < TILE, 'it landed somewhere else entirely');

  // the sentinel who was standing there walks over it, and it is his
  foe.dead = false;
  foe.bot = false;
  foe.x = game.drops[0].x;
  foe.y = game.drops[0].y;
  tick(game, 0.1);
  check(foe.weapon.id === 'lance' && foe.weapon.ammo === left, 'the enemy could not pick it up');
  check(game.drops.length === 0, 'it is still lying there as well');

  // and he swaps up, never down
  game.drops.push({ x: foe.x, y: foe.y, id: 'scatter', ammo: 20, life: 20, team: 'human' });
  tick(game, 0.1);
  check(foe.weapon.id === 'lance', 'he put down a lance for a scattergun');
});

scenario('the two sides shop from the same shelf', () => {
  // the starting guns are the one place the sides differ, and they are tuned
  // against each other; an armoury with a per-side table would have to be tuned
  // twice and would drift on the first edit
  for (const gun of ARMOURY) {
    check(gun.cost > 0 && gun.ammo > 0, `${gun.id} is free or bottomless`);
    check(worth(gun.id) === gun.cost, `${gun.id} is not worth what it costs`);
    const perShot = gun.damage * (gun.pellets || 1);
    check(perShot < UNIT.hp, `${gun.id} puts a body down in one shot`);
    check(gun.range >= 400, `${gun.id} reaches ${gun.range}px, which is not a gun`);
  }
  const ids = ARMOURY.map((g) => g.id);
  check(new Set(ids).size === ids.length, 'two guns share an id');
  check(!ids.includes(STANDARD), 'the gun you already have is on sale');
});

// ------------------------------------------------------- the arenas' own toys

scenario('a turret guards its stand, can be shot down, and comes back', () => {
  const phase = PHASES.findIndex((p) => p.id === 'turrets');
  const game = open(phase, { quiet: false, team: 'alien' });
  const turret = game.turrets.find((t) => t.team === 'human');
  // the other one is not part of this scenario: left standing it keeps firing
  // and the "a dead turret stops" check reads its rounds as the dead one's
  for (const t of game.turrets) if (t !== turret) { t.dead = true; t.rebuild = 1e6; }
  const victim = game.units.find((u) => u.team === 'alien');
  // asleep, not respawning: bodies that come back four seconds later are what
  // made "a dead turret stopped firing" fail — the rounds were theirs
  for (const u of game.units) if (u !== victim) { u.dead = true; u.respawnT = 1e6; }
  victim.dead = false;
  victim.hp = UNIT.hp;
  victim.bot = false;
  victim.x = turret.x + 150;
  victim.y = turret.y;
  tick(game, 2.5);
  check(victim.hp < UNIT.hp, 'the turret watched an enemy stand in front of it for two seconds');

  turret.hp = 1;
  game.bullets.push({
    x: turret.x - 60, y: turret.y, vx: 900, vy: 0, team: 'alien', owner: victim.id,
    damage: 20, life: 1, kind: 'blaster',
  });
  tick(game, 0.2);
  check(turret.dead, 'the turret cannot be shot down');
  const hp = victim.hp;
  tick(game, 2);
  check(victim.hp === hp, 'a dead turret kept firing');
  tick(game, TURRET.rebuild);
  check(!turret.dead && turret.hp === TURRET.hp, 'the turret never came back');
});

scenario('a gate throws you across the field, once', () => {
  const phase = PHASES.findIndex((p) => p.id === 'gates');
  const game = open(phase);
  const me = game.player;
  const pad = game.pads[0];
  me.x = pad.x;
  me.y = pad.y;
  tick(game, 0.05);
  check(dist(me.x, me.y, pad.to.x, pad.to.y) < 2, 'the gate did not move him');
  check(Math.abs(me.x - pad.x) > ARENA_W / 2, 'the gate dropped him on the same half he stepped in from');
  // he is standing on the far gate now, and it must not throw him straight back
  tick(game, 0.4);
  check(dist(me.x, me.y, pad.to.x, pad.to.y) < 40, 'the far gate bounced him straight back');
  check(me.padCool > 0, 'nothing stops the two gates passing him back and forth forever');
});

scenario('the dark arena is dark for both squads, and only for that arena', () => {
  const dark = open(PHASES.findIndex((p) => p.id === 'maze'));
  const me = dark.player;
  const far = { x: me.x + 600, y: me.y };
  check(!dark.visibleTo(me, far.x, far.y), 'the maze is not dark: he can see 600 pixels down it');

  const lit = open(0);
  const him = lit.player;
  him.x = 100;
  him.y = 112;
  check(lit.visibleTo(him, 900, 112), 'the corridors arena went dark');
});

// ---------------------------------------------------------------- the squads

scenario('two squads of bots play a whole match, and it ends', () => {
  const game = createGame({ arena: buildArena(5), team: 'human', seed: 21 });
  for (const u of game.units) u.bot = true;
  const stop = tick(game, 800, IDLE, (g) => g.state !== 'playing');
  check(stop !== null, `nobody reached ${TARGET} in thirteen minutes — the arena is a stalemate`);
  check(Math.max(game.score.human, game.score.alien) === TARGET, `the match ended at ${game.score.human}-${game.score.alien}`);
  check(stop < 700, `the match took ${stop.toFixed(0)}s — two squads of bots, with nobody playing well`);
});

scenario('both squads score, and the field does not favour either end of it', () => {
  // Mirrored arenas, identical brains: any lasting gap here is a bug, and two
  // of them were. The first was the update order — whoever moved last read
  // fresher positions and won 40% more. The second was the guns: the blaster
  // was a fifth of a degree tighter, which is a better chance of hitting on
  // every shot ever fired.
  let human = 0;
  let alien = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const game = createGame({ arena: buildArena(seed % PHASES.length), team: 'human', seed: seed * 17 });
    for (const u of game.units) u.bot = true;
    tick(game, 180, IDLE, (g) => g.state !== 'playing');
    human += game.score.human;
    alien += game.score.alien;
  }
  const total = human + alien;
  check(total >= 12, `only ${total} captures in six squad-against-squad matches — nobody is playing`);
  check(human > 0 && alien > 0, `${human}-${alien}: one side never scored at all`);
  const share = Math.min(human, alien) / total;
  check(share > 0.25, `${human}-${alien} across six arenas — one side has an edge the other has not`);
});

scenario('a bot walks round a wall instead of standing against it', () => {
  // the bridge, which is where this failed: two bots wedged shoulder to shoulder
  // in front of a one-tile doorway and stood there for four hundred seconds
  const game = createGame({ arena: buildArena(1), team: 'human', seed: 3 });
  for (const u of game.units) u.bot = true;
  const raider = game.units.find((u) => u.team === 'human' && u.role === 'attack');
  const start = raider.x;
  let best = start;
  tick(game, 20, IDLE, () => {
    for (const u of game.units) if (u.team === 'human' && !u.dead) best = Math.max(best, u.x);
    return false;
  });
  check(best > ARENA_W * 0.82, `the raid stalled ${(ARENA_W - best).toFixed(0)}px short of the enemy stand`);
});

// ------------------------------------------------------------------ the brain

scenario('a squad does not arrive in single file', () => {
  const game = createGame({ arena: buildArena(5), team: 'human', seed: 9 });
  for (const u of game.units) u.bot = true;
  const lanes = lanesOf(game.arena);
  check(lanes.length >= 2, `${lanes.length} way(s) across the field`);

  // the raiders of one squad, an hour into a fight, should not all be crossing
  // at the same height
  tick(game, 25);
  const raiders = game.units.filter((u) => u.team === 'human' && u.role === 'attack' && !u.dead);
  check(raiders.length >= 2, `only ${raiders.length} raiders to look at`);
  const lanesUsed = new Set(raiders.map((u) => u.lane % lanes.length));
  check(lanesUsed.size >= 2 || raiders.length < 3,
    `${raiders.length} raiders and ${lanesUsed.size} lane(s) between them`);

  // and a body that dies comes back on the next one round, never the same
  const one = raiders[0];
  const before = one.lane;
  reconsider(game, one, () => 0.5);
  check(one.lane !== before, 'he came back down the lane he died in');
  check(one.role === 'attack', 'his job changed while nothing about the squad did');
});

scenario('a bot backs off when it is nearly dead, and shops when it is home', () => {
  const game = createGame({ arena: buildArena(0), team: 'human', seed: 4 });
  for (const u of game.units) u.bot = true;
  const raider = game.units.find((u) => u.team === 'human' && u.role === 'attack');
  const foe = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== raider && u !== foe) { u.dead = true; u.respawnT = 1e6; }

  // nearly dead, deep in their half, with a gun on him: he goes the other way
  raider.x = ARENA_W * 0.75;
  raider.y = game.flags.alien.home.y;
  raider.hp = 20;
  foe.x = raider.x + 160;
  foe.y = raider.y;
  foe.dead = false;
  const startX = raider.x;
  tick(game, 1.6);
  check(raider.dead || raider.x < startX, `at twenty health he walked on to ${raider.x.toFixed(0)} from ${startX.toFixed(0)}`);

  // and standing on his own ground with shards in his pocket, he buys
  const shopper = game.units.find((u) => u.team === 'human' && !u.dead) || raider;
  shopper.dead = false;
  shopper.hp = 100;
  shopper.shards = 1000;
  shopper.x = game.flags.human.home.x;
  shopper.y = game.flags.human.home.y;
  tick(game, 0.3);
  check(shopper.weapon.id !== STANDARD, 'he stood in the armoury with a thousand shards and bought nothing');
  check(shopper.shards < 1000, 'he was not charged for it');
});

scenario('the brain\'s dials are all on, and each one is a decision that was measured', () => {
  // They are a measuring harness, not a config: every one of them is on in the
  // game, and the tests above and the notes in ai.js are what they were for.
  for (const [name, on] of Object.entries(AI_FLAGS)) {
    check(on === true, `the ${name} behaviour is switched off in the shipped game`);
  }
});

// ------------------------------------------------------------- what is drawn

scenario('every arena draws, in both the light and the dark', () => {
  const ctx = headlessContext(1280, 720);
  const vp = { W: 1280, H: 720, scale: 1, dpr: 1, ctx };
  const renderer = createRenderer();
  const fx = createFx();
  const touch = createTouchControls(() => 1280, () => 720);
  for (let i = 0; i < PHASES.length; i++) {
    const game = createGame({ arena: buildArena(i), team: i % 2 ? 'alien' : 'human', seed: 4, fx });
    for (const u of game.units) u.bot = true;
    tick(game, 6);                    // long enough for flags, bullets and bodies to be everywhere
    fx.spark(300, 300);
    fx.blood(320, 300);
    fx.ring(340, 300, 40);
    fx.float(360, 300, '+1');
    renderer.reset();
    renderer.draw(ctx, game, vp, { fx, touch });
    // and again with a dead player, which is the other half of the HUD
    game.player.dead = true;
    game.player.respawnT = 2;
    renderer.draw(ctx, game, vp, { fx, touch: null });
    check(true, `${PHASES[i].id} drew`);
  }
});

scenario('a point on the screen is the point on the field the cursor is over', () => {
  const game = open();
  const me = game.player;
  me.x = 900;
  me.y = 600;
  for (const W of [1040, 1280, 1900]) {
    globalThis.window.innerWidth = W;
    globalThis.window.innerHeight = 720;
    const vp = { W, H: 720, scale: 1, turned: false };
    // the middle of what is left of the screen under the scoreboard is him
    const mid = screenToWorld(W / 2, 48 + (720 - 48) / 2, vp, me);
    check(Math.abs(mid.x - me.x) < 0.001 && Math.abs(mid.y - me.y) < 0.001,
      `the middle of a ${W}-wide screen is ${mid.x.toFixed(0)},${mid.y.toFixed(0)} and he is at ${me.x},${me.y}`);
    // and a pixel to the right is a pixel to the right, at any width
    const right = screenToWorld(W / 2 + 100, 48 + (720 - 48) / 2, vp, me);
    check(Math.abs(right.x - me.x - 100) < 0.001, 'the cursor and the field disagree about a hundred pixels');
  }

  // the case viewWidth exists for: a 4:3 window shows less than the kit's floor
  globalThis.window.innerWidth = 1024;
  globalThis.window.innerHeight = 768;
  const squat = { W: 1040, H: 720, scale: 768 / 720, turned: false };
  check(Math.round(viewWidth(squat)) === 960, `a 1024x768 window shows ${viewWidth(squat).toFixed(0)} logical pixels, not 960`);
  const cam = cameraFor(me.x, me.y, viewWidth(squat), 720);
  check(Math.abs(cam.x + 960 / 2 - me.x) < 0.001, 'on a 4:3 window the camera is not centred on what the glass shows');
});

scenario('the thumbs walk, aim and roll', () => {
  const walk = moveInput(0, 60);
  check(Math.abs(walk.y - 1) < 0.01 && Math.abs(walk.x) < 0.01, 'pushing the stick down does not walk down');
  check(moveInput(3, 3).x === 0, 'a thumb resting on the glass walks');
  check(aimAngle(2, 2) === null, 'a shaking hand swings the barrel');
  check(Math.abs(aimAngle(60, 0)) < 0.01, 'dragging right does not point right');

  const touch = createTouchControls(() => 1280, () => 720);
  const gun = fireButton(1280, 720);
  touch.start(1, gun.x, gun.y);
  check(touch.read().fire, 'a thumb on the trigger is not a shot');
  touch.move(1, gun.x - 60, gun.y);
  check(Math.abs(Math.abs(touch.read().aimAngle) - Math.PI) < 0.1, 'dragging left off the trigger does not aim left');
  touch.end(1);
  check(!touch.read().fire, 'the gun kept firing after the thumb left');

  const roll = rollButton(1280, 720);
  touch.start(2, roll.x, roll.y);
  check(touch.read().roll, 'the roll button does nothing');
  check(!touch.read().roll, 'the roll button repeats itself while held — the roll is a press');

  // Everywhere on the right half that is not the roll button is the trigger, so
  // a thumb that lands just outside the ring does not miss a button: it fires
  // the shot you were rolling away from. The finger's circle is bigger than the
  // drawn one for exactly that.
  touch.start(4, roll.x + roll.r + 14, roll.y);
  const nearMiss = touch.read();
  check(nearMiss.roll, 'a thumb fourteen pixels off the ring did not roll');
  check(!nearMiss.fire, 'a near-miss on the roll button fired a round');
  touch.end(4);
  // and it takes nothing from the trigger next door
  touch.start(5, gun.x - gun.r + 2, gun.y);
  check(touch.read().fire, 'the roll button ate the near edge of the trigger');
  touch.end(5);
  touch.start(3, 200, 400);
  const walked = touch.read();
  check(walked.mx === 0 && walked.my === 0, 'the stick moved before the thumb did');
});

await runTests('flag war — the match');
