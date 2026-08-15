// Every noise in here is an oscillator and a gain envelope — there is not an
// audio file in the repository and there is not going to be (rule nº 5).
//
// The mute survives a reload because it lives in the kit's `sound`, which is
// the whole reason that piece exists.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'reis-e-engrenagens', volume: 0.42 });

function noise(dur, { gain = 0.3, freq = 900, q = 0.7, delay = 0, type = 'lowpass' } = {}) {
  const ctx = sound.resume();
  if (!ctx || !sound.on) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime + delay;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(sound.out());
  src.start(t);
  src.stop(t + dur + 0.05);
}

let rollGate = 0;

export const sfx = {
  /** The gauge ticking up: a pitch that follows the bar. */
  tick(power) {
    sound.tone(320 + power * 6, 0.03, { type: 'square', gain: 0.05 });
  },

  /** The engine driving: a low grind that only fires every few frames. */
  roll(fuel) {
    if (rollGate-- > 0) return;
    rollGate = 5;
    sound.tone(70 + (fuel % 40), 0.06, { type: 'square', gain: 0.045 });
  },

  launch(weaponId) {
    if (weaponId === 'railshot' || weaponId === 'tesla') {
      sound.tone(180, 0.12, { type: 'sawtooth', gain: 0.2, slide: 900 });
      noise(0.14, { gain: 0.2, freq: 2400, type: 'highpass' });
    } else {
      sound.tone(140, 0.16, { type: 'triangle', gain: 0.26, slide: -70 });
      noise(0.22, { gain: 0.22, freq: 700 });
    }
  },

  boom(size = 1) {
    noise(0.5 * size, { gain: 0.42, freq: 380 / size });
    sound.tone(70, 0.35 * size, { type: 'sine', gain: 0.32, slide: -40 });
  },

  crack(m) {
    if (m === 'crystal') {
      sound.tone(1400, 0.12, { type: 'triangle', gain: 0.18, slide: 900 });
      noise(0.16, { gain: 0.18, freq: 4200, type: 'highpass' });
    } else if (m === 'iron') {
      sound.tone(220, 0.2, { type: 'square', gain: 0.14, slide: -90 });
    } else {
      noise(0.22, { gain: 0.22, freq: 900 });
    }
  },

  tumble() {
    noise(0.3, { gain: 0.18, freq: 520 });
  },

  arc() {
    sound.tone(1800, 0.16, { type: 'sawtooth', gain: 0.14, slide: -1200 });
    noise(0.18, { gain: 0.16, freq: 5000, type: 'highpass' });
  },

  kinghit() {
    sound.tone(520, 0.3, { type: 'square', gain: 0.22, slide: -320 });
    noise(0.4, { gain: 0.24, freq: 300 });
  },

  place() {
    sound.tone(420, 0.05, { type: 'square', gain: 0.12 });
  },

  deny() {
    sound.tone(150, 0.14, { type: 'square', gain: 0.14, slide: -50 });
  },

  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      sound.tone(f, 0.28, { type: 'triangle', gain: 0.2, delay: i * 0.11 })
    );
  },

  lose() {
    [392, 349, 294, 220].forEach((f, i) =>
      sound.tone(f, 0.34, { type: 'sawtooth', gain: 0.16, delay: i * 0.13 })
    );
  },
};
