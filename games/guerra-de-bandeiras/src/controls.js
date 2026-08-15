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
 */
export function rollButton(W, H) {
  return { x: W - 232, y: H - 92, r: 44 };
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
    const hit = (b) => (x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r;
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
    // a drag that started on the icon is measured from the icon's middle, not
    // from the pixel the thumb happened to land on
    const gun = fireButton(width(), height());
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
