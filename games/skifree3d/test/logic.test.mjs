// SkiFree's test, in Node, with no browser and no graphics card.
//
// The game cannot be PLAYED on CI — SwiftShader draws it at about one frame
// every three seconds, and a scenario that holds the controls ends up measuring
// the runner (see CLAUDE.md, section 6). But none of that is in the way here:
// the mountain, the skier, the Yeti and the gates are plain modules that import
// straight into Node, and everything a maintenance change is likely to break —
// the physics, the state machine, where the gates fall — is arithmetic.
//
// So this is the game's guard: it runs in milliseconds, it fails when the game
// stops working, and it never opens a window. What it does NOT cover is the
// drawing; the catalog floor opens the real file and checks the canvas, and the
// rest is a run down the mountain by hand before a deploy.

import { installHeadlessDom, scenario, check, run } from 'slopkit/testing';
import * as THREE from 'three';

installHeadlessDom();

import { PLAYER, YETI, MODES, SLOPE, groundHeight } from '../src/config.js';
import { createPlayer } from '../src/entities/player.js';
import { createYeti } from '../src/entities/yeti.js';
import { createProps, BAND } from '../src/world/props.js';
import { input, releaseAll, initInput, onCommand, consumeJump } from '../src/input.js';
import { planSteps, MAX_STEP, MAX_STEPS } from '../src/loop.js';
import { fovForAspect, deviceTier, TIERS, MAX_FOV } from '../src/render/display.js';

const STEP = 1 / 60;

/** A scene root the entities can hang from — no renderer involved. */
const stage = () => new THREE.Group();

/** Runs the real loop for `seconds`, at a fixed step. */
function ski(player, seconds, world = { ramps: [], colliders: [] }) {
  for (let t = 0; t < seconds; t += STEP) player.update(STEP, world);
}

// ------------------------------------------------------------- the mountain

scenario('the mountain goes downhill, and always the same way', () => {
  // Every part of the game asks this function where the ground is — the mesh,
  // the physics, the props and the AI. If two of them disagreed, the skier
  // would float or sink; if it stopped being deterministic, nothing would.
  check(groundHeight(0, 0) === groundHeight(0, 0), 'the terrain is not deterministic');
  check(groundHeight(12.5, 340) === groundHeight(12.5, 340), 'the terrain is not deterministic');

  const top = groundHeight(0, 0);
  const bottom = groundHeight(0, 900);
  check(bottom < top - 900 * SLOPE * 0.5, `900 m down the hill only dropped ${(top - bottom).toFixed(0)} m`);

  // and the undulation stays within the bounds the camera and the props assume
  let maxOff = 0;
  for (let z = 0; z < 2000; z += 37) {
    for (let x = -140; x <= 140; x += 29) {
      maxOff = Math.max(maxOff, Math.abs(groundHeight(x, z) + SLOPE * z));
    }
  }
  check(maxOff < 60, `the slope wanders ${maxOff.toFixed(0)} m off its own average`);
});

scenario('every mode is playable, and only slalom lays gates', () => {
  const names = Object.keys(MODES);
  check(names.length >= 4, `only ${names.length} modes`);
  for (const [name, m] of Object.entries(MODES)) {
    check(m.yetiWake > 0, `${name} never wakes the Yeti`);
    check(m.treeDensity >= 0 && m.rockDensity >= 0, `${name} has a negative density`);
    check(typeof m.gates === 'boolean', `${name} does not say whether it has gates`);
  }
  const withGates = names.filter((n) => MODES[n].gates);
  check(withGates.length === 1 && withGates[0] === 'slalom',
    `gates are laid by ${withGates.join(', ') || 'nobody'}`);
});

// ---------------------------------------------------------------- the skier

scenario('the skier accelerates down the fall line and settles at a top speed', () => {
  releaseAll();
  const player = createPlayer(stage());
  player.reset(0);
  const start = player.state.speed;

  ski(player, 2);
  check(player.state.speed > start + 4, `two seconds only got to ${player.state.speed.toFixed(1)} m/s`);
  check(player.state.travel > 10, `two seconds covered ${player.state.travel.toFixed(1)} m`);

  ski(player, 40);
  const top = player.state.speed;
  check(top <= PLAYER.maxSpeed + 0.001, `${top.toFixed(1)} m/s is past the cap of ${PLAYER.maxSpeed}`);
  check(top > PLAYER.maxSpeed * 0.7, `the drag settles it at ${top.toFixed(1)} m/s, far short of the cap`);

  // travel only ever grows: it is the distance on the HUD and on the record
  const before = player.state.travel;
  ski(player, 1);
  check(player.state.travel > before, 'the distance stopped counting');
});

scenario('tucking is faster than flat out, and the brake stops him', () => {
  releaseAll();
  const flat = createPlayer(stage());
  flat.reset(0);
  ski(flat, 12);

  // "Up" is two things: a tuck on the ground and a backflip in the air. Holding
  // it through the jumps this mountain throws at you lands the skier on his
  // head — the first version of this scenario did exactly that and read the six
  // crashes as "tucking is slower". So it is released for the airtime, which is
  // what a player does.
  const tucked = createPlayer(stage());
  tucked.reset(0);
  for (let t = 0; t < 12; t += STEP) {
    input.up = !tucked.state.airborne;
    tucked.update(STEP, { ramps: [], colliders: [] });
  }
  input.up = false;
  check(tucked.state.speed > flat.state.speed,
    `tucked ${tucked.state.speed.toFixed(1)} vs flat ${flat.state.speed.toFixed(1)} m/s`);
  check(tucked.state.speed <= PLAYER.maxSpeed * PLAYER.tuckBonus + 0.001,
    `tucking got past its own cap at ${tucked.state.speed.toFixed(1)} m/s`);

  const flying = flat.state.speed;
  input.down = true;
  ski(flat, 3);
  input.down = false;
  check(flat.state.speed < 6, `three seconds on the brake from ${flying.toFixed(1)} left him at ` +
    `${flat.state.speed.toFixed(1)} m/s`);
  releaseAll();
});

scenario('a tree stops the run without ending it', () => {
  releaseAll();
  const player = createPlayer(stage());
  player.reset(0);
  ski(player, 4);                       // the first seconds are invulnerable
  const speed = player.state.speed;

  const s = player.state;
  const tree = { x: s.x, z: s.z + speed * 0.2, r: 1.2, type: 'tree' };
  const world = { ramps: [], colliders: [tree] };
  let crashed = false;
  for (let i = 0; i < 60 && !crashed; i++) {
    const events = player.update(STEP, world);
    crashed = events.some((e) => e.type === 'crash');
  }
  check(crashed, 'skiing into a tree did not crash');
  check(player.state.speed < speed * 0.5, `the crash left him at ${player.state.speed.toFixed(1)} m/s`);

  // and he gets up: a crash is a setback, the Yeti is the ending
  ski(player, 4);
  check(player.state.crashed === 0, 'the skier never got up');
  check(player.state.speed > 4, `he got up at ${player.state.speed.toFixed(1)} m/s`);
});

// ----------------------------------------------------------------- the Yeti

/** The bit of the player the Yeti is given. */
const prey = (z, travel, speed = 0) => ({ x: 0, z, travel, speed, crashed: 0 });

scenario('the Yeti sleeps until the wake distance, then comes from behind', () => {
  const yeti = createYeti(stage());
  yeti.update(STEP, prey(500, 500), YETI.wakeDistance);
  check(yeti.state.mode === 'sleeping', `he woke at 500 m ("${yeti.state.mode}")`);

  yeti.update(STEP, prey(2000, YETI.wakeDistance), YETI.wakeDistance);
  check(yeti.state.mode === 'chasing', `at the wake distance he is "${yeti.state.mode}"`);
  check(yeti.state.z < 2000, 'he showed up in front of the skier');
  check(Math.abs(2000 - yeti.state.z - YETI.spawnGap) < 20,
    `he spawned ${(2000 - yeti.state.z).toFixed(0)} m behind instead of ${YETI.spawnGap}`);
  check(yeti.consumeWake(), 'the wake-up was never announced — no roar, no warning');
});

scenario('he catches a skier who stops, and that is the only ending', () => {
  const yeti = createYeti(stage());
  let z = 2000;
  yeti.update(STEP, prey(z, 2000), 2000);

  let caught = false;
  for (let i = 0; i < 60 * 30 && !caught; i++) {
    caught = yeti.update(STEP, prey(z, 2000), 2000) === 'caught';
  }
  check(caught, 'a standing skier was never caught');
  check(yeti.state.mode === 'eating', `after the catch he is "${yeti.state.mode}"`);
  check(yeti.state.distance < YETI.catchRadius + 0.5,
    `he "caught" him from ${yeti.state.distance.toFixed(1)} m`);
});

scenario('outrun him and he gives up — then comes back angrier', () => {
  const yeti = createYeti(stage());
  yeti.update(STEP, prey(2000, 2000), 2000);
  const firstSpeed = yeti.state.speed;

  // the skier is already far past the gap he tolerates
  yeti.update(STEP, prey(2000 + YETI.giveUpGap + 40, 2200), 2000);
  check(yeti.state.mode === 'retreating', `he stayed "${yeti.state.mode}" beyond the give-up gap`);

  // he sinks into the snow, waits, and comes back
  for (let i = 0; i < 60 * (1.2 + YETI.returnDelay) + 10; i++) {
    yeti.update(STEP, prey(3000, 3000), 2000);
  }
  check(yeti.state.mode === 'chasing', `after the wait he is "${yeti.state.mode}"`);
  check(yeti.state.aggression >= 1, 'he came back exactly as slow as before');
  check(yeti.state.speed > firstSpeed, `he came back at ${yeti.state.speed} vs ${firstSpeed}`);
});

// ---------------------------------------------------------------- the gates

scenario('slalom lays one gate every 42 m, past the clear opening stretch', () => {
  const material = new THREE.MeshBasicMaterial();
  const props = createProps(stage(), material, { ...MODES.slalom });
  props.update(600);

  const gates = [];
  for (const band of props.bands.values()) gates.push(...band.gates);
  check(gates.length > 0, 'slalom laid no gates at all');

  const zs = gates.map((g) => g.z).sort((a, b) => a - b);
  for (const z of zs) check(z % 42 === 0, `a gate landed at ${z} m, off the 42 m grid`);
  for (let i = 1; i < zs.length; i++) {
    check(zs[i] - zs[i - 1] === 42, `two gates ${zs[i] - zs[i - 1]} m apart`);
  }
  check(zs[0] >= 70, `the first gate is at ${zs[0]} m, inside the clear opening stretch`);
  for (const g of gates) {
    check(g.halfW > 3 && g.halfW < 9, `a gate ${(g.halfW * 2).toFixed(1)} m wide`);
    check(Math.abs(g.x) < 60, `a gate ${g.x.toFixed(0)} m off the piste`);
  }
});

scenario('the other modes lay none, and every band carries its own obstacles', () => {
  const material = new THREE.MeshBasicMaterial();
  for (const name of ['free', 'trees', 'freestyle']) {
    const props = createProps(stage(), material, { ...MODES[name] });
    props.update(600);
    let gates = 0, colliders = 0;
    for (const band of props.bands.values()) {
      gates += band.gates.length;
      colliders += band.colliders.length;
    }
    check(gates === 0, `${name} laid ${gates} gates`);
    check(colliders > 0, `${name} put nothing on the mountain to dodge`);
  }
});

scenario('the world follows the skier and lets go of what is behind', () => {
  const material = new THREE.MeshBasicMaterial();
  const props = createProps(stage(), material, { ...MODES.free });
  props.update(0);
  const atStart = [...props.bands.keys()];

  props.update(4000);
  const far = [...props.bands.keys()];
  check(far.length > 0, 'the mountain ran out of bands');
  check(far.length <= atStart.length + 2, `${far.length} bands alive against ${atStart.length} at the start`);
  check(Math.min(...far) * BAND > 3000, 'the bands from the top of the mountain were never released');
});

// ------------------------------------------------------- the frame's budget

scenario('a slow frame is subdivided, not thrown away', () => {
  // The old loop clamped dt to 1/20 and dropped the rest, so a phone drawing
  // 6 fps ran the mountain at a third of real time — which is what "1 second
  // takes more than 1 second" was.
  const at = (fps) => planSteps(1 / fps);

  const smooth = at(60);
  check(smooth.steps === 1 && Math.abs(smooth.h - 1 / 60) < 1e-9,
    `at 60 fps the loop took ${smooth.steps} steps of ${smooth.h.toFixed(4)}s`);
  check(smooth.dropped === 0, 'a 60 fps frame lost simulation time');

  for (const fps of [60, 30, 20, 12, 8, 5]) {
    const { steps, h, dropped } = at(fps);
    check(h <= MAX_STEP + 1e-9, `at ${fps} fps a single step was ${h.toFixed(3)}s`);
    check(steps <= MAX_STEPS, `at ${fps} fps the frame asked for ${steps} steps`);
    check(dropped < 1e-9, `at ${fps} fps the game lost ${(dropped * 1000).toFixed(0)} ms of its own time`);
  }

  // and the ceiling is a ceiling: past it the game slows down instead of
  // spiralling into ever longer frames
  const stall = planSteps(3);
  check(stall.steps === MAX_STEPS && stall.dropped > 0,
    `a 3 s frame asked for ${stall.steps} steps and ${stall.dropped.toFixed(2)}s were left over`);
  check(planSteps(0).steps === 0 && planSteps(-1).steps === 0, 'a frame with no time in it still ran a step');
});

scenario('the skier covers the same ground however slow the machine is', () => {
  // the real guard behind the arithmetic above: two machines, same mountain
  const run = (fps, seconds) => {
    const p = createPlayer(stage());
    p.reset(0);
    for (let t = 0; t < seconds; t += 1 / fps) {
      const { steps, h } = planSteps(1 / fps);
      for (let i = 0; i < steps; i++) p.update(h, { ramps: [], colliders: [] });
    }
    return p.state.travel;
  };

  const fast = run(60, 6);
  const slow = run(8, 6);              // a phone in trouble
  check(fast > 60, `six seconds at 60 fps only covered ${fast.toFixed(0)} m`);
  check(Math.abs(slow - fast) / fast < 0.05,
    `at 8 fps the run covered ${slow.toFixed(0)} m against ${fast.toFixed(0)} m at 60`);
});

// ---------------------------------------------------------- the window fit

scenario('a portrait window widens the lens instead of zooming in', () => {
  const wide = fovForAspect(58, 16 / 9);
  check(wide === 58, `the design window changed the fov to ${wide.toFixed(1)}°`);
  check(fovForAspect(58, 21 / 9) === 58, 'an ultrawide window widened the vertical fov as well');

  // what the horizontal angle actually is, which is what the player sees
  const horizontal = (fov, aspect) =>
    (Math.atan(Math.tan((fov * Math.PI) / 360) * aspect) * 360) / Math.PI;

  const design = horizontal(58, 16 / 9);
  const phone = 9 / 19.5;
  const before = horizontal(58, phone);
  const after = horizontal(fovForAspect(58, phone), phone);
  check(before < design * 0.4, `the untouched portrait fov was already ${before.toFixed(0)}° wide`);
  check(after > before * 1.4, `portrait went from ${before.toFixed(0)}° to ${after.toFixed(0)}° across`);
  check(fovForAspect(58, phone) <= MAX_FOV, 'the vertical fov blew past the fisheye ceiling');

  // and it never narrows: a narrower window can only ever see more vertically
  let prev = 58;
  for (const aspect of [16 / 9, 4 / 3, 1, 3 / 4, 9 / 16]) {
    const v = fovForAspect(58, aspect);
    check(v >= prev - 1e-9, `aspect ${aspect.toFixed(2)} pulled the fov back to ${v.toFixed(1)}°`);
    prev = v;
  }
});

scenario('a phone is not offered a desktop of post-processing', () => {
  const phone = deviceTier({ coarse: true, minSide: 390, cores: 6 });
  const tablet = deviceTier({ coarse: true, minSide: 834, cores: 8 });
  const laptop = deviceTier({ coarse: false, minSide: 800, cores: 8 });
  const quad = deviceTier({ coarse: false, minSide: 900, cores: 4 });
  const netbook = deviceTier({ coarse: false, minSide: 768, cores: 2 });
  check(phone === 0, `a 390 px touch screen landed on tier ${phone}`);
  check(tablet === 1, `an iPad landed on tier ${tablet}`);
  check(laptop === 2, `a laptop landed on tier ${laptop}`);
  check(quad === 2, `a four-core desktop was demoted to tier ${quad} before a frame was measured`);
  check(netbook === 1, `a two-core machine landed on tier ${netbook}`);

  // ambient occlusion is ~35% of the frame: the phone must not start with it on
  check(TIERS[phone].quality < 2, 'the phone starts with the ambient occlusion pass');
  check(TIERS[laptop].quality === 2, 'the desktop lost the ambient occlusion pass');
  for (let i = 1; i < TIERS.length; i++) {
    check(TIERS[i].maxPixelRatio >= TIERS[i - 1].maxPixelRatio
      && TIERS[i].snowflakes >= TIERS[i - 1].snowflakes
      && TIERS[i].shadowMapSize >= TIERS[i - 1].shadowMapSize,
      `tier ${i} (${TIERS[i].name}) asks for less than tier ${i - 1}`);
  }
  // DPR 3 on a phone is nine times the fill rate of DPR 1, for a picture nobody
  // can tell apart at arm's length
  check(TIERS[0].maxPixelRatio <= 1.5, `a phone still renders at ${TIERS[0].maxPixelRatio}x`);
});

// ----------------------------------------------------------------- controls

/** A target that keeps the listeners, the way a window would. */
function keyboard() {
  const handlers = new Map();
  const target = {
    addEventListener: (type, fn) => handlers.set(type, fn),
    removeEventListener: () => {},
  };
  initInput(target);
  return {
    press: (code) => handlers.get('keydown')({ code, preventDefault() {} }),
    lift: (code) => handlers.get('keyup')({ code, preventDefault() {} }),
    blur: () => handlers.get('blur')(),
  };
}

scenario('the keys move the skier, and both layouts do the same thing', () => {
  const k = keyboard();
  releaseAll();
  for (const [code, flag] of [['ArrowLeft', 'left'], ['KeyA', 'left'], ['ArrowRight', 'right'],
    ['KeyD', 'right'], ['ArrowUp', 'up'], ['KeyW', 'up'], ['ArrowDown', 'down'], ['KeyS', 'down']]) {
    k.press(code);
    check(input[flag], `${code} did not set "${flag}"`);
    k.lift(code);
    check(!input[flag], `${code} stayed pressed after the key came up`);
  }
});

scenario('a jump is an edge, consumed once', () => {
  const k = keyboard();
  releaseAll();
  k.press('Space');
  check(input.jump, 'space did not arm the jump');
  check(consumeJump(), 'the jump was never offered to the player');
  check(!consumeJump(), 'one press jumped twice');
  k.lift('Space');
  check(!input.jump, 'space stayed down');
});

scenario('losing focus lets go of every key', () => {
  const k = keyboard();
  k.press('ArrowLeft');
  k.press('ArrowUp');
  k.blur();
  check(!input.left && !input.up, 'the skier keeps turning after the window loses focus');
});

scenario('a command key runs its command and nothing else', () => {
  const k = keyboard();
  let pauses = 0;
  onCommand('KeyP', () => { pauses++; });
  k.press('KeyP');
  check(pauses === 1, `the pause key fired ${pauses} times`);
  check(!input.left && !input.right, 'a command key also moved the skier');
  k.press('KeyZ');   // nothing is bound to it
  check(pauses === 1, 'an unbound key ran the last command again');
  releaseAll();
});

await run('skifree 3d — logic');
