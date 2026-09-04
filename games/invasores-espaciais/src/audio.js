// Every sound synthesised from oscillators and noise — never an audio file.
// The kit owns the context, the master gain and the persisted mute; this file
// only hangs voices off `sound.out()`.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'invasores-espaciais', volume: 0.4 });

function tone(freq, dur, type = 'square', slide = 0, when = 0) {
  if (!sound.on) return;
  const out = sound.out();
  if (!out) return;
  const ctx = sound.ctx;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(0.5, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, filterFreq = 1200, when = 0) {
  if (!sound.on) return;
  const out = sound.out();
  if (!out) return;
  const ctx = sound.ctx;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(t0);
}

/** The four-note descending march thump, pitched by how far the swarm has come. */
export const sfx = {
  shoot() { tone(880, 0.12, 'square', -660); },
  kill() { noise(0.18, 2400); tone(320, 0.15, 'sawtooth', -220); },
  drop() { tone(90, 0.14, 'sine', -30); },
  clash() { noise(0.08, 4000); },
  shieldChip() { noise(0.06, 900); },
  boom() { noise(0.5, 700); tone(140, 0.4, 'sawtooth', -100); },
  saucer() { tone(1200, 0.5, 'sine', 400); },
  saucerKill() { tone(400, 0.3, 'square', 800); noise(0.25, 3000); },
  clear() { tone(523, 0.12, 'square'); tone(659, 0.12, 'square', 0, 0.12); tone(784, 0.2, 'square', 0, 0.24); },
  wave() { tone(196, 0.15, 'sawtooth'); tone(196, 0.15, 'sawtooth', 0, 0.2); },
  // ---- the six machines that moved in next door
  munch() { tone(420 + Math.random() * 120, 0.06, 'square', -120); },
  power() { tone(150, 0.4, 'sawtooth', 500); },
  eatGhost() { tone(200, 0.25, 'square', 600); noise(0.15, 2500); },
  paddle() { tone(300, 0.07, 'square', 120); },
  brick() { noise(0.1, 3000); tone(500, 0.08, 'square', -150); },
  eat() { tone(660, 0.09, 'sine', 220); },
  shootRock() { tone(700, 0.1, 'sawtooth', -400); },
  explodeBig() { noise(0.4, 600); tone(100, 0.35, 'sawtooth', -60); },
  hop() { tone(350, 0.06, 'square', 150); },
  splash() { noise(0.3, 800); tone(220, 0.25, 'sine', -140); },
  goal() { tone(523, 0.1, 'square'); tone(784, 0.18, 'square', 0, 0.1); },
  wall() { tone(180, 0.08, 'square', -40); },
  rally() { tone(440, 0.05, 'square', 60); },
  lose() { tone(330, 0.25, 'sawtooth', -120, 0); tone(220, 0.25, 'sawtooth', -80, 0.25); tone(147, 0.5, 'sawtooth', -60, 0.5); },
  breach() { tone(110, 0.8, 'sawtooth', -70); noise(0.7, 500); },
};

/** Route drained game events to their voices. */
export function playEvents(events) {
  for (const e of events) {
    const fn = sfx[e.name];
    if (fn) fn(e);
  }
}
