// Keyboard + touch. Exposes a simple state the player reads every frame.

export const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,   // rising edge, consumed by the player
};

const actions = new Map([
  ['ArrowLeft', 'left'], ['KeyA', 'left'],
  ['ArrowRight', 'right'], ['KeyD', 'right'],
  ['ArrowUp', 'up'], ['KeyW', 'up'],
  ['ArrowDown', 'down'], ['KeyS', 'down'],
  ['Space', 'jump'],
]);

const commandHandlers = new Map();

/** Registers a command key (pause, camera, and so on). */
export function onCommand(code, fn) {
  commandHandlers.set(code, fn);
}

export function initInput(target = window) {
  target.addEventListener('keydown', (e) => {
    const a = actions.get(e.code);
    if (a) {
      e.preventDefault();
      if (!input[a] && a === 'jump') input.jumpPressed = true;
      input[a] = true;
      return;
    }
    const cmd = commandHandlers.get(e.code);
    if (cmd) { e.preventDefault(); cmd(e); }
  }, { passive: false });

  target.addEventListener('keyup', (e) => {
    const a = actions.get(e.code);
    if (a) { e.preventDefault(); input[a] = false; }
  }, { passive: false });

  // release everything if the window loses focus (or the skier turns by itself)
  target.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  lockZoom();
  initTouch();
}

/**
 * A game is not a document, and a phone browser does not know that: two fingers
 * on the screen while turning, or a double tap on the jump zone, and Safari
 * magnifies the page. The canvas comes back blurry and three times too close,
 * the HUD is pushed off the visible area, and nothing the player can do inside
 * the game undoes it — which is exactly what "it zoomed in by itself" is.
 *
 * `maximum-scale=1` in the meta is not enough (iOS has ignored it since iOS 10),
 * so the gestures themselves are refused: `gesture*` is Safari's pinch, and a
 * `touchstart` carrying a second finger is everybody else's.
 */
function lockZoom() {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc || !doc.addEventListener) return;
  const stop = (e) => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    doc.addEventListener(type, stop, { passive: false });
  }
  doc.addEventListener('dblclick', stop, { passive: false });
  doc.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}

export function releaseAll() {
  input.left = input.right = input.up = input.down = input.jump = false;
}

export function consumeJump() {
  const p = input.jumpPressed;
  input.jumpPressed = false;
  return p;
}

// ---------------------------------------------------------------- touch
function initTouch() {
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const pad = document.getElementById('touch');
  if (!isTouch || !pad) return;

  pad.classList.add('on');
  const active = new Map();   // pointerId -> action

  const setAct = (act, on) => {
    if (act === 'jump') {
      if (on && !input.jump) input.jumpPressed = true;
      input.jump = on;
    } else {
      input[act] = on;
    }
  };

  pad.querySelectorAll('.zone').forEach((zone) => {
    const act = zone.dataset.act;
    zone.addEventListener('pointerdown', (e) => {
      zone.setPointerCapture(e.pointerId);
      active.set(e.pointerId, act);
      setAct(act, true);
    });
    const end = (e) => {
      const a = active.get(e.pointerId);
      if (a) { setAct(a, false); active.delete(e.pointerId); }
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  });

  // dragging up in the top half = tuck
  window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}
