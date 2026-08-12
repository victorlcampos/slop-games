// Every sound is made on the spot: noise bursts for the guns, a swept sine for
// the blasts, a plucked chord for the piano and the bell. Rule nº 5 — no file
// ever ships with a game here — and the mute survives a reload through the kit.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'chuva-de-ferro', volume: 0.4 });

/** A short burst of shaped noise: the body of every gun in the game. */
function noise(dur, { gain = 0.3, low = 400, high = 4000, q = 0.9 } = {}) {
  const c = sound.resume();
  if (!c || !sound.on) return;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const fade = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = low;
  band.Q.value = q;
  const sweep = c.createBiquadFilter();
  sweep.type = 'lowpass';
  sweep.frequency.setValueAtTime(high, c.currentTime);
  sweep.frequency.exponentialRampToValueAtTime(Math.max(200, high * 0.15), c.currentTime + dur);
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(band); band.connect(sweep); sweep.connect(g); g.connect(sound.out());
  src.start();
  src.stop(c.currentTime + dur + 0.02);
}

const SHOT = {
  bullet: () => noise(0.09, { gain: 0.26, low: 1100, high: 5200 }),
  pellet: () => noise(0.16, { gain: 0.34, low: 700, high: 4200, q: 0.5 }),
  beam: () => { sound.tone(1500, 0.14, { type: 'square', gain: 0.13, slide: -1100 }); noise(0.07, { gain: 0.14, low: 2600 }); },
  rocket: () => { noise(0.22, { gain: 0.3, low: 300, high: 2200, q: 0.4 }); sound.tone(180, 0.2, { type: 'sawtooth', gain: 0.1, slide: 240 }); },
  lobbed: () => sound.tone(320, 0.12, { type: 'triangle', gain: 0.2, slide: -180 }),
  flame: () => noise(0.12, { gain: 0.1, low: 600, high: 1800, q: 0.3 }),
  orb: () => sound.tone(220, 0.26, { type: 'sine', gain: 0.22, slide: 260 }),
  homing: () => sound.tone(900, 0.18, { type: 'sawtooth', gain: 0.14, slide: 700 }),
};

export const sfx = {
  shot(kind) { (SHOT[kind] || SHOT.bullet)(); },
  hit() { noise(0.05, { gain: 0.16, low: 2000, high: 6000 }); },
  boom() {
    noise(0.5, { gain: 0.45, low: 160, high: 1400, q: 0.3 });
    sound.tone(70, 0.42, { type: 'sine', gain: 0.3, slide: -45 });
  },
  land(mass = 1) {
    noise(0.2, { gain: 0.2 + mass * 0.08, low: 120 + mass * 40, high: 900, q: 0.4 });
  },
  chord(up = true) {
    const base = up ? 262 : 196;
    [1, 1.26, 1.5].forEach((r, i) => sound.tone(base * r, 0.7, { type: 'triangle', gain: 0.12, delay: i * 0.04 }));
  },
  jump() { sound.tone(420, 0.1, { type: 'square', gain: 0.1, slide: 260 }); },
  pickup() { [660, 990].forEach((f, i) => sound.tone(f, 0.12, { type: 'triangle', gain: 0.18, delay: i * 0.07 })); },
  medkit() { [523, 659, 784].forEach((f, i) => sound.tone(f, 0.16, { type: 'sine', gain: 0.2, delay: i * 0.06 })); },
  dry() { sound.tone(180, 0.12, { type: 'square', gain: 0.12, slide: -80 }); },
  hurt() { sound.tone(160, 0.3, { type: 'sawtooth', gain: 0.28, slide: -90 }); noise(0.2, { gain: 0.2, low: 300 }); },
  over() { [392, 330, 262, 196].forEach((f, i) => sound.tone(f, 0.45, { type: 'triangle', gain: 0.22, delay: i * 0.18 })); },
};
