// Teclado + controles touch
export class Input {
  constructor() {
    this.keys = new Set();
    this.handlers = {};   // ação -> cb (reset, camera, reload, mute, help, menu)
    this.touch = { throttle: 0, steer: 0, handbrake: false, active: false };

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.add(e.code);
      const map = { KeyR: 'reset', KeyC: 'camera', KeyN: 'reload', KeyM: 'mute', KeyH: 'help', Escape: 'menu' };
      if (map[e.code] && this.handlers[map[e.code]]) this.handlers[map[e.code]]();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  on(action, cb) { this.handlers[action] = cb; }

  bindTouch(el) {
    // el contém botões [data-t]: left,right,gas,brake,hb
    const state = { left: false, right: false, gas: false, brake: false, hb: false };
    for (const btn of el.querySelectorAll('[data-t]')) {
      const k = btn.dataset.t;
      const on = e => { e.preventDefault(); state[k] = true; btn.classList.add('on'); this.touch.active = true; };
      const off = e => { e.preventDefault(); state[k] = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    }
    this._touchState = state;
  }

  read() {
    const k = this.keys;
    let throttle = 0, steer = 0, handbrake = false;
    if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) steer -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) steer += 1;
    if (k.has('Space')) handbrake = true;
    const t = this._touchState;
    if (t) {
      if (t.gas) throttle += 1;
      if (t.brake) throttle -= 1;
      if (t.left) steer -= 1;
      if (t.right) steer += 1;
      if (t.hb) handbrake = true;
    }
    return { throttle: Math.max(-1, Math.min(1, throttle)), steer: Math.max(-1, Math.min(1, steer)), handbrake };
  }
}
