// The thumbs.
//
// No pad painted in a corner: **where you put your finger is where the control
// appears.** Left half of the screen walks, right half aims. Nobody holds a
// phone the same way, and a stick born under the thumb never has to be found.
//
// Two decisions specific to this game:
//
// * **How far you push the left stick is how loud you are.** A gentle push is a
//   creep — slow, and it makes no footsteps; pushing it out is a run. It is the
//   same choice Shift makes on a keyboard, without a second finger.
// * **The right stick aims before it fires.** Touching it turns the man;
//   pushing it out pulls the trigger. On a floor where one loud shot brings
//   four men, a stick that fires the instant it is touched is a trap.

export const STICK = {
  dead: 13,       // below this he is standing still
  run: 46,        // past this he is running, and the floor can hear him
  max: 78,        // the knob stops here
};

export const AIM = {
  dead: 14,       // enough to say which way he is looking…
  fire: 46,       // …and this much more to shoot
  max: 92,
};

/** The left stick's offset, in logical px, turned into a direction and a pace. */
export function moveInput(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < STICK.dead) return { x: 0, y: 0, sneak: false };
  return { x: dx / len, y: dy / len, sneak: len < STICK.run };
}

/** The right stick's offset turned into an aim, and whether it is firing. */
export function aimInput(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < AIM.dead) return { angle: null, fire: false };
  return { angle: Math.atan2(dy, dx), fire: len >= AIM.fire };
}

/**
 * Where the hand button sits. It is drawn in the canvas rather than in the DOM
 * because on an upright phone the canvas is rotated a quarter turn (slopkit's
 * `landscape`), and a DOM button would stay stubbornly the right way up on a
 * game lying on its side.
 */
export function useButton(W, H) {
  return { x: W - 104, y: H - 210, r: 46 };
}

/** The roll, under the thumb that is already on that side of the screen. */
export function rollButton(W, H) {
  return { x: W - 104, y: H - 104, r: 52 };
}

export function createTouchControls(width = () => 1280, height = () => 720) {
  const stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const trigger = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, angle: null };
  let usePressed = false;
  let rollPressed = false;
  let useShown = false;

  function start(id, x, y) {
    const hit = (b) => (x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r;
    if (useShown && hit(useButton(width(), height()))) {
      usePressed = true;
      return;
    }
    if (hit(rollButton(width(), height()))) {
      rollPressed = true;
      return;
    }
    if (x < width() / 2) {
      if (stick.on) return;
      Object.assign(stick, { on: true, id, ox: x, oy: y, x, y });
    } else {
      if (trigger.on) return;
      Object.assign(trigger, { on: true, id, ox: x, oy: y, x, y, angle: null });
    }
  }

  function move(id, x, y) {
    if (stick.on && stick.id === id) {
      stick.x = x;
      stick.y = y;
    }
    if (trigger.on && trigger.id === id) {
      trigger.x = x;
      trigger.y = y;
      const a = aimInput(x - trigger.ox, y - trigger.oy);
      // inside the deadzone he holds the angle he had: a thumb that shakes
      // while firing should not swing the barrel round the room
      if (a.angle !== null) trigger.angle = a.angle;
    }
  }

  function end(id) {
    if (stick.on && stick.id === id) Object.assign(stick, { on: false, id: null });
    if (trigger.on && trigger.id === id) Object.assign(trigger, { on: false, id: null, angle: null });
  }

  function clear() {
    stick.on = false;
    trigger.on = false;
    stick.id = null;
    trigger.id = null;
    trigger.angle = null;
    usePressed = false;
    rollPressed = false;
  }

  /** Tell the pad whether the hand button is on screen this frame. */
  function offerUse(on) {
    useShown = !!on;
    if (!on) usePressed = false;
  }

  function read() {
    const walk = stick.on ? moveInput(stick.x - stick.ox, stick.y - stick.oy) : { x: 0, y: 0, sneak: false };
    const shoot = trigger.on ? aimInput(trigger.x - trigger.ox, trigger.y - trigger.oy) : { angle: null, fire: false };
    const used = usePressed;
    const rolled = rollPressed;
    // presses, not holds: read once and gone
    usePressed = false;
    rollPressed = false;
    return {
      mx: walk.x,
      my: walk.y,
      sneak: walk.sneak,
      aimAngle: trigger.on ? trigger.angle : null,
      fire: shoot.fire,
      use: used,
      roll: rolled,
    };
  }

  return { stick, trigger, start, move, end, clear, read, offerUse };
}
