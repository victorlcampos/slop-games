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
  UNIT, GUNS, FLAG, TURRET, PAD, REGEN, TARGET, PHASES, ARENA_W, dist, other, viewWidth, boardTransform,
} = await import('../src/config.js');
const { buildArena } = await import('../src/arena.js');
const { createGame, assistedAim, segmentHit } = await import('../src/game.js');
const { carrierOf, flagPoint } = await import('../src/match.js');
const { createRenderer, screenToWorld } = await import('../src/render.js');
const { createTouchControls, moveInput, aimAngle, fireButton, dashButton } = await import('../src/controls.js');
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

  // put ours back and the same run counts
  thief.hp = 0;
  tick(game, 0.1);
  const mine = game.flags.human;
  me.x = mine.x;
  me.y = mine.y;
  tick(game, 0.2);
  check(mine.state === 'home', 'touching our own dropped flag did not send it home');
  me.x = mine.home.x;
  me.y = mine.home.y;
  tick(game, 0.2);
  check(game.score.human === 1, 'the same run did not score once our flag was home');
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

scenario('a flag nobody comes back for walks home by itself', () => {
  const game = open();
  const me = game.player;
  me.x = game.flags.alien.x;
  me.y = game.flags.alien.y;
  tick(game, 0.1);
  me.hp = 0;
  tick(game, 0.05);
  check(game.flags.alien.state === 'dropped', 'it was not dropped');
  tick(game, FLAG.dropTime - 1);
  check(game.flags.alien.state === 'dropped', `it went home after ${FLAG.dropTime - 1}s, before its time`);
  tick(game, 1.5);
  check(game.flags.alien.state === 'home', `it was still on the deck ${FLAG.dropTime + 0.5}s later`);
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
  for (const u of game.units) if (u !== me && u !== foe) u.dead = true;

  me.x = 300;
  me.y = 112;                      // the open lane along the top of the corridors
  foe.x = 480;
  foe.y = 112;
  foe.dead = false;
  foe.hp = UNIT.hp;
  foe.bot = false;                 // he stands still and takes it
  me.facing = 0;

  tick(game, 1.2, { fire: true, aim: { x: foe.x, y: foe.y } });
  check(foe.hp < UNIT.hp, 'a second of point-blank fire did nothing');
  check(foe.hp < UNIT.hp - 20, `a second of fire took ${(UNIT.hp - foe.hp).toFixed(0)} points off him`);

  // and a wall eats the round: the same shot through the lane divider
  const before = foe.hp;
  me.x = 300;
  me.y = 240;
  foe.x = 300;
  foe.y = 480;                     // straight through the separators
  tick(game, 1, { fire: true, aim: { x: foe.x, y: foe.y } });
  check(foe.hp === before, 'a round went through a wall');
});

scenario('nobody shoots his own squad in the back', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const mate = game.units.find((u) => u.team === me.team && u !== me);
  for (const u of game.units) if (u !== me && u !== mate) u.dead = true;
  mate.dead = false;
  mate.bot = false;
  mate.hp = UNIT.hp;
  me.x = 300;
  me.y = 112;
  mate.x = 460;
  mate.y = 112;
  tick(game, 1.5, { fire: true, aim: { x: mate.x, y: mate.y } });
  check(mate.hp === UNIT.hp, `a teammate took ${(UNIT.hp - mate.hp).toFixed(0)} points of friendly fire`);
});

scenario('the gun finds the man you pointed at, and never one in the dark', () => {
  const game = open(0, { quiet: false });
  const me = game.player;
  const foe = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== me && u !== foe) u.dead = true;
  me.x = 300;
  me.y = 112;
  foe.x = 460;
  foe.y = 130;
  foe.dead = false;

  const near = assistedAim(game, me, { x: 455, y: 100 });
  check(near.locked === foe.id, 'the assist did not find a body 15 pixels off the cursor');
  const far = assistedAim(game, me, { x: 300, y: 600 });
  check(!far.locked, 'the assist swung the barrel at somebody the cursor was nowhere near');

  foe.x = 300;
  foe.y = 480;                     // behind the lane divider
  const blind = assistedAim(game, me, { x: foe.x, y: foe.y });
  check(!blind.locked, 'the assist locked onto a body through a wall');
});

scenario('a segment finds what a point would have flown straight past', () => {
  // 1000 px/s at a 60 Hz step is a seventeen-pixel jump: a body is twelve
  check(segmentHit(0, 0, 100, 0, 50, 0, 12) !== null, 'a segment straight through a body missed it');
  check(segmentHit(0, 0, 100, 0, 50, 30, 12) === null, 'a segment hit something 30 pixels off the line');
  check(segmentHit(0, 0, 100, 0, 200, 0, 12) === null, 'a segment hit something past its own end');
  const t = segmentHit(0, 0, 100, 0, 50, 0, 12);
  check(t > 0.3 && t < 0.45, `the hit landed at ${t.toFixed(2)} of the way along, not at the body`);
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

// ------------------------------------------------------- the arenas' own toys

scenario('a turret guards its stand, can be shot down, and comes back', () => {
  const phase = PHASES.findIndex((p) => p.id === 'turrets');
  const game = open(phase, { quiet: false, team: 'alien' });
  const turret = game.turrets.find((t) => t.team === 'human');
  const victim = game.units.find((u) => u.team === 'alien');
  for (const u of game.units) if (u !== victim) u.dead = true;
  victim.dead = false;
  victim.hp = UNIT.hp;
  victim.bot = false;
  victim.x = turret.x + 90;
  victim.y = turret.y;
  tick(game, 2.5);
  check(victim.hp < UNIT.hp, 'the turret watched an enemy stand in front of it for two seconds');

  turret.hp = 1;
  game.bullets.push({
    x: turret.x - 40, y: turret.y, vx: 900, vy: 0, team: 'alien', owner: victim.id,
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
  const game = createGame({ arena: buildArena(0), team: 'human', seed: 21 });
  for (const u of game.units) u.bot = true;
  const stop = tick(game, 400, IDLE, (g) => g.state !== 'playing');
  check(stop !== null, `nobody reached ${TARGET} in four hundred seconds — the arena is a stalemate`);
  check(Math.max(game.score.human, game.score.alien) === TARGET, `the match ended at ${game.score.human}-${game.score.alien}`);
  check(stop < 360, `the match took ${stop.toFixed(0)}s`);
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
    tick(game, 100, IDLE, (g) => g.state !== 'playing');
    human += game.score.human;
    alien += game.score.alien;
  }
  const total = human + alien;
  check(total >= 12, `only ${total} captures in six squad-against-squad matches — nobody is playing`);
  check(human > 0 && alien > 0, `${human}-${alien}: one side never scored at all`);
  const share = Math.min(human, alien) / total;
  check(share > 0.28, `${human}-${alien} across six arenas — one side has an edge the other has not`);
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
  for (const W of [1040, 1280, 1900]) {
    globalThis.window.innerWidth = W;      // the window and the logical width agree
    globalThis.window.innerHeight = 720;
    const vp = { W, H: 720, scale: 1, turned: false };
    const p = screenToWorld(W / 2, 384, vp);
    check(Math.abs(p.x - ARENA_W / 2) < 2, `the middle of a ${W}-wide screen is at ${p.x.toFixed(0)} on the field`);
    check(p.y > 0 && p.y < 672, `the field's y came out at ${p.y.toFixed(0)}`);
  }

  // and the case the whole helper exists for: a 4:3 window, where the kit's
  // 1040-wide floor is eighty pixels more than the glass can show
  globalThis.window.innerWidth = 1024;
  globalThis.window.innerHeight = 768;
  const squat = { W: 1040, H: 720, scale: 768 / 720, turned: false };
  check(Math.round(viewWidth(squat)) === 960, `a 1024x768 window shows ${viewWidth(squat).toFixed(0)} logical pixels, not 960`);
  const board = boardTransform(viewWidth(squat), 720);
  check(board.ox + ARENA_W * board.scale <= 960.5, 'the field runs off the right of a 4:3 window');
  // the right edge of the glass lands just past the right edge of the field —
  // the board keeps a hair of margin, and everything inside it is on screen
  const edge = screenToWorld(960, 384, squat);
  check(edge.x >= ARENA_W && edge.x < ARENA_W + 40,
    `the right edge of the glass is at ${edge.x.toFixed(0)} on a field ${ARENA_W} wide`);
});

scenario('the thumbs walk, aim and dash', () => {
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

  const dash = dashButton(1280, 720);
  touch.start(2, dash.x, dash.y);
  check(touch.read().dash, 'the dash button does nothing');
  check(!touch.read().dash, 'the dash button repeats itself while held');
  touch.start(3, 200, 400);
  const walked = touch.read();
  check(walked.mx === 0 && walked.my === 0, 'the stick moved before the thumb did');
});

await runTests('flag war — the match');
