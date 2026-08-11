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

  initTouch();
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
