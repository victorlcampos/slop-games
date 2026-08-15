// Pointer and keyboard, turned into the four things this game can be told:
// where you are pointing, that you tapped, that you let go, and which key.
//
// Every coordinate that comes out of here has already been through
// `vp.point`, which is the one place that knows whether the canvas is lying on
// its side. Nothing downstream has to care.

export function createInput(canvas, vp, on) {
  let downAt = null;
  let dragged = false;

  const at = (e) => vp.point(e.clientX, e.clientY);

  const down = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    const p = at(e);
    downAt = p;
    dragged = false;
    on.down && on.down(p.x, p.y, e);
  };

  const move = (e) => {
    const p = at(e);
    if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 8) dragged = true;
    on.move && on.move(p.x, p.y, !!downAt, e);
  };

  const up = (e) => {
    const p = at(e);
    on.up && on.up(p.x, p.y, dragged, e);
    downAt = null;
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Driving is a key you *hold*, not a key you press, so the set of what is
  // currently down has to be kept — `keydown` repeats are the operating system's
  // idea of a repeat rate, not the game's.
  const held = new Set();
  const key = (e) => {
    held.add(e.code);
    if (on.key && on.key(e.code, e)) e.preventDefault();
  };
  const release = (e) => held.delete(e.code);
  // a window that loses focus mid-drive would otherwise drive forever
  const clear = () => held.clear();
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', release);
  window.addEventListener('blur', clear);

  return {
    held,
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', clear);
    },
  };
}

/**
 * The gauge: 0 to 100 and back, forever, until somebody taps.
 *
 * Pure on purpose — "how long does a sweep take" is the kind of number that
 * gets tuned twice a week, and a test that reads it is a test that keeps
 * working afterwards.
 */
export function gaugeAt(elapsed, speed) {
  const p = (elapsed * speed) % 2;
  return (p < 1 ? p : 2 - p) * 100;
}
