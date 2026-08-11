// The frame loop.
//
// Simulation runs in a **fixed step**; drawing runs free. That is not fussiness:
// with a variable dt the same game behaves differently at 60 and at 144 Hz —
// collisions tunnel through, jumps go higher, physics explodes when the tab
// comes back from the background. A fixed step removes all of it.
//
// Where it came from: Zoo Tycoon, the only one of the four that already worked
// this way (an accumulator on a 1/30 step, with a guard against the spiral of
// death). The other three used a clamped raw dt — which works right up until
// the day it doesn't.
//
//   const loop = createLoop({
//     step: 1/60,
//     update: (h) => world.tick(h),   // h is ALWAYS the same value
//     draw: (alpha, dt) => paint(alpha),
//   });
//   loop.start();

export function createLoop(options) {
  const {
    step = 1 / 60,
    update,
    draw,
    // time ceiling per frame: if the tab sat in the background for 30s there is
    // no point simulating 30s at once — the gap is skipped instead
    maxDt = 0.25,
    // most steps allowed in one frame. Without it a slow machine spirals:
    // simulate more, fall further behind, simulate more still, freeze.
    maxSteps = 8,
    speed = 1,
    now = () => performance.now(),
  } = options;

  let running = false;
  let previous = 0;
  let accumulated = 0;
  let raf = null;
  const state = { speed, paused: false, fps: 0, stepsThisFrame: 0 };

  let fpsFrames = 0;
  let fpsTime = 0;

  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    let dt = (t - previous) / 1000;
    previous = t;
    if (!(dt > 0)) dt = 0;
    if (dt > maxDt) dt = maxDt;

    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      state.fps = Math.round(fpsFrames / fpsTime);
      fpsFrames = 0;
      fpsTime = 0;
    }

    if (!state.paused && update) {
      accumulated += dt * state.speed;
      let n = 0;
      while (accumulated >= step && n < maxSteps) {
        update(step);
        accumulated -= step;
        n++;
      }
      state.stepsThisFrame = n;
      // couldn't keep up: drop the backlog instead of piling up a debt that
      // can never be paid
      if (n >= maxSteps) accumulated = 0;
    }

    // what's left in the accumulator, for anyone interpolating their drawing
    if (draw) draw(accumulated / step, dt, state);
  }

  return {
    state,
    start() {
      if (running) return;
      running = true;
      previous = now();
      accumulated = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    pause(v = true) {
      state.paused = v;
    },
    /** 0 freezes, 1 normal, 2 fast-forwards — Zoo uses this for its speed button. */
    setSpeed(v) {
      state.speed = Math.max(0, v);
    },
    get running() {
      return running;
    },
  };
}

/**
 * The loop's arithmetic, browser-free — this is what the test exercises.
 * Returns how many steps would run and what is left in the accumulator.
 */
export function stepsFor(accumulated, dt, step, maxSteps = 8, maxDt = 0.25) {
  const used = Math.min(Math.max(dt, 0), maxDt);
  let acc = accumulated + used;
  let n = 0;
  while (acc >= step && n < maxSteps) {
    acc -= step;
    n++;
  }
  if (n >= maxSteps) acc = 0;
  return { steps: n, rest: acc };
}
