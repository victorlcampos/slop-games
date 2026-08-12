// The thumbs.
//
// There are no buttons drawn in fixed places: **where you put your finger is
// where the control appears.** The screen is split down the middle — the left
// half is the stick, the right half is the trigger — and a stick that is born
// under the thumb never has to be found, which is the whole problem with a pad
// painted at a fixed corner of a phone nobody holds the same way.
//
// Pushing the left stick up jumps and pushing it down crouches, so walking
// crouched under a cave is one thumb held diagonally.
//
// The right half is the same idea for the gun: **it is a stick, not a cursor.**
// Where the thumb lands is the centre, and the direction it is pushed is the
// direction the soldier aims — push up and he shoots straight up. Aiming at the
// literal pixel under the finger means the hand covers the thing being shot at,
// and on a phone that is most of the screen.

/** How far from where the finger landed each direction starts. */
/** The aim stick: how far it has to move before it turns the gun. */
export const AIM = { dead: 16, max: 90 };

export const STICK = {
  dead: 14,      // below this the stick is centred and nothing is asked for
  turn: 18,      // sideways: left/right
  up: 30,        // pushing up: jump
  down: 26,      // pushing down: crouch
  max: 78,       // the knob stops here — past it the finger is just far away
};

/**
 * A stick offset (finger minus origin, in logical px) turned into what the
 * soldier is being asked to do. Pure, because "the controls feel wrong" is not
 * a thing you want to debug by hand on a phone.
 */
export function stickInput(dx, dy) {
  const out = { left: false, right: false, down: false, jump: false };
  if (Math.hypot(dx, dy) < STICK.dead) return out;
  if (dx <= -STICK.turn) out.left = true;
  else if (dx >= STICK.turn) out.right = true;
  if (dy <= -STICK.up) out.jump = true;
  else if (dy >= STICK.down) out.down = true;
  return out;
}

/**
 * Tracks the fingers. `width` is the logical width, and it is read on every
 * touch so a resize (or a phone turned in the hand) cannot leave the split in
 * the wrong place.
 */
export function createTouchControls(width = () => 1280) {
  const stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const trigger = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, angle: null };

  function start(id, x, y) {
    if (x < width() / 2) {
      if (stick.on) return;
      stick.on = true; stick.id = id; stick.ox = x; stick.oy = y; stick.x = x; stick.y = y;
    } else {
      if (trigger.on) return;
      trigger.on = true; trigger.id = id; trigger.ox = x; trigger.oy = y;
      trigger.x = x; trigger.y = y; trigger.angle = null;
    }
  }

  function move(id, x, y) {
    if (stick.on && stick.id === id) { stick.x = x; stick.y = y; }
    if (trigger.on && trigger.id === id) {
      trigger.x = x; trigger.y = y;
      const dx = x - trigger.ox;
      const dy = y - trigger.oy;
      // inside the deadzone the gun holds the angle it had: a thumb that shakes
      // while firing should not swing the barrel around
      if (Math.hypot(dx, dy) >= AIM.dead) trigger.angle = Math.atan2(dy, dx);
    }
  }

  function end(id) {
    if (stick.on && stick.id === id) { stick.on = false; stick.id = null; }
    if (trigger.on && trigger.id === id) { trigger.on = false; trigger.id = null; trigger.angle = null; }
  }

  function clear() {
    stick.on = trigger.on = false;
    stick.id = trigger.id = null;
    trigger.angle = null;
  }

  /** What the fingers are asking for, right now. */
  function read() {
    const asked = stick.on ? stickInput(stick.x - stick.ox, stick.y - stick.oy)
      : { left: false, right: false, down: false, jump: false };
    return {
      ...asked,
      up: false,
      fire: trigger.on,
      // null means "leave the gun where it is" — the game keeps its last angle
      aimAngle: trigger.on ? trigger.angle : null,
      aiming: trigger.on,
    };
  }

  return { stick, trigger, start, move, end, clear, read };
}
