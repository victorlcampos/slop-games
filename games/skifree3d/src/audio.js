// Sound 100% synthesised in WebAudio: wind, ski friction, impacts, gates and
// the Yeti's roar. No audio file involved.

let ctx = null;
let master = null;
let started = false;
/* The choice is remembered, like the other three games do. It used to live
   only in this module, so every reload came back unmuted — and CLAUDE.md
   §2b credits "persisted mute" to the kit precisely because forgetting it
   was the one thing Animals got wrong before the kit existed. */
const MUTE_KEY = 'skifree3d:sound';
let muted = (() => {
  try { return JSON.parse(localStorage.getItem(MUTE_KEY) || 'null')?.muted === true; }
  catch (e) { return false; }
})();

let noiseBuffer = null;
const loops = {};

function makeNoiseBuffer(seconds = 2) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // slightly pink noise: lower, less hiss
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function makeLoop({ type, freq, q, gain }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;

  const g = ctx.createGain();
  g.gain.value = 0;

  src.connect(filter).connect(g).connect(master);
  src.start();
  return { src, filter, gain: g, target: gain };
}

export function initAudio() {
  if (started) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;

  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.85;
  master.connect(ctx.destination);

  noiseBuffer = makeNoiseBuffer(2.5);

  loops.wind = makeLoop({ type: 'lowpass', freq: 420, q: 0.7, gain: 0 });
  loops.ski = makeLoop({ type: 'bandpass', freq: 1400, q: 0.9, gain: 0 });
  loops.carve = makeLoop({ type: 'bandpass', freq: 3200, q: 2.2, gain: 0 });

  started = true;
  return true;
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.05);
  try { localStorage.setItem(MUTE_KEY, JSON.stringify({ muted })); } catch (e) { /* private mode */ }
  return muted;
}

export function isMuted() { return muted; }

/** Fits the continuous loops to the player's state. */
export function updateAudio(dt, { speed = 0, maxSpeed = 34, carve = 0, airborne = false, crashed = false }) {
  if (!started || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const v = Math.min(speed / maxSpeed, 1.2);

  const windGain = Math.pow(v, 2.1) * 0.34 + (airborne ? 0.06 : 0);
  loops.wind.gain.gain.setTargetAtTime(windGain, t, 0.12);
  loops.wind.filter.frequency.setTargetAtTime(320 + v * 900, t, 0.15);

  const skiGain = airborne || crashed ? 0.0 : (0.05 + v * 0.22);
  loops.ski.gain.gain.setTargetAtTime(skiGain, t, 0.08);
  loops.ski.filter.frequency.setTargetAtTime(700 + v * 1800, t, 0.1);

  const carveGain = airborne || crashed ? 0 : Math.abs(carve) * v * 0.20;
  loops.carve.gain.gain.setTargetAtTime(carveGain, t, 0.06);
  loops.carve.filter.frequency.setTargetAtTime(2200 + Math.abs(carve) * 2600, t, 0.08);
}

// --------------------------------------------------------------- efeitos
function burst({ duration = 0.3, freq = 800, q = 1, type = 'bandpass', vol = 0.5, decay = 0.25 }) {
  if (!started || ctx.state !== 'running') return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;

  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;

  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + duration + 0.05);
}

function tone({ freq = 440, to = null, duration = 0.2, type = 'sine', vol = 0.25, delay = 0, attack = 0.01 }) {
  if (!started || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  const t = ctx.currentTime + delay;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export const sfx = {
  jump() {
    burst({ duration: 0.24, freq: 1600, q: 0.8, vol: 0.22, type: 'highpass' });
    tone({ freq: 240, to: 520, duration: 0.18, type: 'sine', vol: 0.12 });
  },
  land(power = 1) {
    burst({ duration: 0.34, freq: 380, q: 0.6, vol: 0.28 * power, type: 'lowpass' });
    tone({ freq: 110, to: 55, duration: 0.22, type: 'sine', vol: 0.2 * power });
  },
  crash() {
    burst({ duration: 0.6, freq: 900, q: 0.5, vol: 0.5, type: 'lowpass' });
    burst({ duration: 0.35, freq: 2400, q: 1.2, vol: 0.22, type: 'bandpass' });
    tone({ freq: 160, to: 42, duration: 0.45, type: 'triangle', vol: 0.28 });
  },
  gate() {
    tone({ freq: 880, duration: 0.10, type: 'sine', vol: 0.16 });
    tone({ freq: 1320, duration: 0.13, type: 'sine', vol: 0.13, delay: 0.06 });
  },
  miss() {
    tone({ freq: 200, to: 120, duration: 0.26, type: 'square', vol: 0.11 });
  },
  trick(level = 1) {
    const base = 520;
    for (let i = 0; i <= level && i < 4; i++) {
      tone({ freq: base * Math.pow(1.26, i), duration: 0.16, type: 'triangle', vol: 0.14, delay: i * 0.07 });
    }
  },
  roar() {
    if (!started || ctx.state !== 'running') return;
    const t = ctx.currentTime;

    // a low body with vibrato
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 1.1);

    const vib = ctx.createOscillator();
    vib.frequency.value = 13;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 16;
    vib.connect(vibGain).connect(osc.frequency);

    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(280, t + 1.2);
    f.Q.value = 4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.09);
    g.gain.setValueAtTime(0.42, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);

    osc.connect(f).connect(g).connect(master);
    osc.start(t); vib.start(t);
    osc.stop(t + 1.45); vib.stop(t + 1.45);

    // a growl on top
    burst({ duration: 1.1, freq: 420, q: 0.8, vol: 0.3, type: 'lowpass' });
  },
  chomp() {
    burst({ duration: 0.12, freq: 500, q: 1.5, vol: 0.45, type: 'lowpass' });
    tone({ freq: 90, to: 40, duration: 0.2, type: 'square', vol: 0.3 });
    setTimeout(() => {
      burst({ duration: 0.12, freq: 500, q: 1.5, vol: 0.45, type: 'lowpass' });
      tone({ freq: 80, to: 36, duration: 0.2, type: 'square', vol: 0.3 });
    }, 190);
  },
  bark() {
    tone({ freq: 420, to: 260, duration: 0.12, type: 'sawtooth', vol: 0.14 });
    tone({ freq: 380, to: 240, duration: 0.11, type: 'sawtooth', vol: 0.12, delay: 0.18 });
  },
  start() {
    tone({ freq: 523, duration: 0.14, type: 'triangle', vol: 0.16 });
    tone({ freq: 659, duration: 0.14, type: 'triangle', vol: 0.16, delay: 0.11 });
    tone({ freq: 784, duration: 0.30, type: 'triangle', vol: 0.18, delay: 0.22 });
  },
  gameOver() {
    tone({ freq: 392, to: 330, duration: 0.5, type: 'triangle', vol: 0.2 });
    tone({ freq: 262, to: 196, duration: 0.9, type: 'sine', vol: 0.22, delay: 0.28 });
  },
};

export function silence() {
  if (!started) return;
  const t = ctx.currentTime;
  for (const k in loops) loops[k].gain.gain.setTargetAtTime(0, t, 0.08);
}
