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
// * **Touching the right half is already a shot.** It fired only past half a
//   push before, so that a floor could not be woken by a thumb brushing the
//   glass — and what that actually produced was a player pushing the stick out
//   and wondering why nothing had happened. A mouse fires on the click; the
//   thumb fires on the touch. What is left of the caution is that the gun is
//   the only thing on the right that behaves this way: roll and hand are
//   buttons, and they are tested first.
// * **The trigger has a face.** A stick with nothing drawn under it is
//   invisible until you have already found it, so the gun sits in the corner as
//   a reticle you can see: press it to fire, drag off it to swing the barrel.
//   Anywhere else on the right does the same thing, anchored where you landed.

export const STICK = {
  dead: 13,       // below this he is standing still
  run: 46,        // past this he is running, and the floor can hear him
  max: 78,        // the knob stops here
};

export const AIM = {
  dead: 14,       // under this the barrel stays where it was
  max: 92,
};

/** The left stick's offset, in logical px, turned into a direction and a pace. */
export function moveInput(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < STICK.dead) return { x: 0, y: 0, sneak: false };
  return { x: dx / len, y: dy / len, sneak: len < STICK.run };
}

/**
 * The trigger thumb's offset turned into an aim — `null` while it is inside the
 * deadzone, which means "keep the angle you had": a hand that shakes through a
 * burst should not swing the barrel round the room.
 */
export function aimAngle(dx, dy) {
  return Math.hypot(dx, dy) < AIM.dead ? null : Math.atan2(dy, dx);
}

/**
 * Where the hand button sits. It is drawn in the canvas rather than in the DOM
 * because on an upright phone the canvas is rotated a quarter turn (slopkit's
 * `landscape`), and a DOM button would stay stubbornly the right way up on a
 * game lying on its side.
 */
export function useButton(W, H) {
  return { x: W - 116, y: H - 250, r: 46 };
}

/** The roll, beside the trigger rather than under it: it is the rarer press. */
export function rollButton(W, H) {
  return { x: W - 248, y: H - 96, r: 46 };
}

/**
 * The gun. It takes the corner because it is the button pressed most, and it is
 * the biggest because it is also a stick: the thumb lands on it, the shot goes
 * off, and dragging away from it turns the man.
 */
export function fireButton(W, H) {
  return { x: W - 116, y: H - 116, r: 62 };
}

export function createTouchControls(width = () => 1280, height = () => 720) {
  const stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const trigger = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, angle: null, onIcon: false };
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
      return;
    }
    if (trigger.on) return;
    // A drag that started on the icon is measured from the icon's middle, not
    // from the pixel the thumb happened to land on: pull it left and the barrel
    // goes left, however far off centre the press was.
    const gun = fireButton(width(), height());
    const onIcon = hit(gun);
    const ox = onIcon ? gun.x : x;
    const oy = onIcon ? gun.y : y;
    Object.assign(trigger, { on: true, id, ox, oy, x, y, angle: null, onIcon });
  }

  function move(id, x, y) {
    if (stick.on && stick.id === id) {
      stick.x = x;
      stick.y = y;
    }
    if (trigger.on && trigger.id === id) {
      trigger.x = x;
      trigger.y = y;
      const a = aimAngle(x - trigger.ox, y - trigger.oy);
      if (a !== null) trigger.angle = a;
    }
  }

  function end(id) {
    if (stick.on && stick.id === id) Object.assign(stick, { on: false, id: null });
    if (trigger.on && trigger.id === id) Object.assign(trigger, { on: false, id: null, angle: null, onIcon: false });
  }

  function clear() {
    stick.on = false;
    trigger.on = false;
    stick.id = null;
    trigger.id = null;
    trigger.angle = null;
    trigger.onIcon = false;
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
      // the thumb is on the gun, so the gun is going off — the deadzone only
      // decides whether he has been told a new direction, never whether he shoots
      fire: trigger.on,
      use: used,
      roll: rolled,
    };
  }

  return { stick, trigger, start, move, end, clear, read, offerUse };
}
