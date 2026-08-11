// Audio: the context, the volume and the mute button.
//
// Three of the four games already kept the mute state in localStorage — Animals
// vs Monsters was the one that forgot the choice on reload. Here it comes free.
//
// Browsers only unlock audio after a user gesture, so everything here tolerates
// being called before that without breaking: the context is born on the first
// `resume()`, which you call on the first click or tap.

export function createSound(cfg = {}) {
  const { game = 'game', volume = 0.5 } = cfg;
  const key = `${game}:sound`;

  let ctx = null;
  let master = null;
  let on = true;

  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) on = JSON.parse(stored).on !== false;
  } catch {
    /* no storage: start unmuted */
  }

  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify({ on }));
    } catch {
      /* private mode */
    }
  }

  const api = {
    get on() {
      return on;
    },
    get ctx() {
      return ctx;
    },

    /** Call on the first user gesture. Before that the browser says no. */
    resume() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = on ? volume : 0;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    },

    /** The node to hang your oscillators off. */
    out() {
      api.resume();
      return master;
    },

    toggle() {
      on = !on;
      if (master) master.gain.value = on ? volume : 0;
      persist();
      return on;
    },

    set(v) {
      on = !!v;
      if (master) master.gain.value = on ? volume : 0;
      persist();
      return on;
    },

    /** A plain beep, so not every game has to write its own. */
    tone(freq, dur = 0.1, { type = 'sine', gain = 0.25, delay = 0, slide = 0 } = {}) {
      const c = api.resume();
      if (!c || !on) return;
      const t = c.currentTime + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(freq + slide, 20), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
  };

  return api;
}
