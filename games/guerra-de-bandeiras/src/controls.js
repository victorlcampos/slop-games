// The thumbs. No pad painted in a corner: **where you put your finger is where
// the control appears** — left half walks, right half aims and fires.
//
// It is Infinite Fortress's pad with one thing taken out. There is no sneak
// here, so how far you push the left stick means nothing beyond a direction:
// in a match there is nothing to hide from a patrol route, and a slow walk buys
// you nothing you would not rather spend on being somewhere else.

export const STICK = { dead: 12, max: 76 };
export const AIM = { dead: 14, max: 92 };

/** The left stick's offset, in logical px, as a direction. */
export function moveInput(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < STICK.dead) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * The trigger thumb's offset as an angle — `null` inside the deadzone, which
 * means "keep the barrel where it was": a hand that shakes through a burst
 * should not swing the gun round the field.
 */
export function aimAngle(dx, dy) {
  return Math.hypot(dx, dy) < AIM.dead ? null : Math.atan2(dy, dx);
}

/**
 * The roll, beside the trigger rather than under it: it is the rarer press, and
 * pressing it by accident costs the second of cooldown that was the only thing
 * left to get a stolen flag out of a hot end zone.
 *
 * `grab` is the circle the *finger* is measured against and it is half again
 * the drawn one. That gap is the whole of "I pressed roll and he fired a shot":
 * everywhere on the right half that is not this button **is** the trigger, so a
 * thumb landing twelve pixels outside the ring does not miss a button — it
 * starts a burst, at the exact moment you were trying to get out of one. The
 * drawn circle stays 44, because a ring that big painted over the field reads
 * as furniture; the finger's reaches 66, which is exactly where the trigger's
 * own circle begins (the two centres are 124 apart and the gun's radius is 58),
 * so nothing is taken from the button next door.
 */
export const ROLL_GRAB = 66;

export function rollButton(W, H) {
  return { x: W - 232, y: H - 92, r: 44, grab: ROLL_GRAB };
}

/** The gun takes the corner: it is the button pressed most, and it is also a stick. */
export function fireButton(W, H) {
  return { x: W - 108, y: H - 108, r: 58 };
}

export function createTouchControls(width = () => 1280, height = () => 720) {
  const stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const trigger = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, angle: null, onIcon: false };
  let rollPressed = false;

  function start(id, x, y) {
    const hit = (b, r = b.r) => (x - b.x) ** 2 + (y - b.y) ** 2 <= r * r;
    const gun = fireButton(width(), height());
    // the gun first, then the roll's generous circle: whatever is left of the
    // right half is the trigger, and a near-miss on the roll must not fall into
    // it (see `rollButton`)
    if (!hit(gun) && hit(rollButton(width(), height()), ROLL_GRAB)) {
      rollPressed = true;
      return;
    }
    if (x < width() / 2) {
      if (stick.on) return;
      Object.assign(stick, { on: true, id, ox: x, oy: y, x, y });
      return;
    }
    if (trigger.on) return;
    // a drag that started on the icon is measured from the icon's middle, not
    // from the pixel the thumb happened to land on
    const onIcon = hit(gun);
    Object.assign(trigger, {
      on: true, id, ox: onIcon ? gun.x : x, oy: onIcon ? gun.y : y, x, y, angle: null, onIcon,
    });
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
    Object.assign(stick, { on: false, id: null });
    Object.assign(trigger, { on: false, id: null, angle: null, onIcon: false });
    rollPressed = false;
  }

  function read() {
    const walk = stick.on ? moveInput(stick.x - stick.ox, stick.y - stick.oy) : { x: 0, y: 0 };
    const rolled = rollPressed;
    rollPressed = false;                 // a press, not a hold: read once and gone
    return {
      mx: walk.x,
      my: walk.y,
      aimAngle: trigger.on ? trigger.angle : null,
      // the thumb on the gun *is* the shot; the deadzone only decides whether it
      // has been given a new direction
      fire: trigger.on,
      roll: rolled,
    };
  }

  return { stick, trigger, start, move, end, clear, read };
}
