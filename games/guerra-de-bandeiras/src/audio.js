// Everything you hear, synthesised on the spot — house rule nº 5, and here it
// carries information too: **the two sides do not sound alike.** A match is ten
// bodies you cannot all watch at once, and the difference between a human rifle
// (dry, high, short) and a sentinel blaster (low, swept, wet) is how you know
// whether the fight two rooms away is going your way without looking at it.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'guerra-de-bandeiras', volume: 0.3 });

function tone(kind, freq, seconds, gain, sweepTo) {
  const out = sound.out();
  if (!out || !sound.on) return;
  const ctx = sound.ctx;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = kind;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), ctx.currentTime + seconds);
  amp.gain.setValueAtTime(gain, ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
  osc.connect(amp).connect(out);
  osc.start();
  osc.stop(ctx.currentTime + seconds + 0.02);
}

function noise(seconds, gain, cut = 1800, type = 'lowpass') {
  const out = sound.out();
  if (!out || !sound.on) return;
  const ctx = sound.ctx;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = cut;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
  src.connect(filter).connect(amp).connect(out);
  src.start();
}

/**
 * A shot the player fired is louder than a shot fired across the field.
 *
 * Without it a five-a-side match is a wall of gunfire with your own rifle
 * somewhere inside it, and you cannot tell whether you are hitting anything.
 */
const near = (mine) => (mine ? 1 : 0.36);

export const sfx = {
  shot(team, mine) {
    const k = near(mine);
    if (team === 'human') {
      noise(0.05, 0.24 * k, 3200, 'highpass');
      tone('square', 380, 0.05, 0.09 * k, 130);
    } else {
      noise(0.09, 0.16 * k, 1400);
      tone('sawtooth', 220, 0.14, 0.11 * k, 60);
    }
  },
  turret() {
    noise(0.06, 0.1, 2200);
    tone('triangle', 300, 0.08, 0.05, 110);
  },
  hurt() {
    noise(0.16, 0.3, 900);
    tone('sawtooth', 180, 0.14, 0.1, 70);
  },
  kill() {
    noise(0.24, 0.24, 1500);
    tone('triangle', 260, 0.2, 0.09, 60);
  },
  roll() {
    noise(0.16, 0.14, 1200, 'bandpass');
  },
  gate() {
    tone('sine', 320, 0.22, 0.1, 980);
    tone('sine', 480, 0.2, 0.05, 1300);
  },
  // The three notices the whole match hangs off get three unmistakable
  // shapes: taken rises, home falls, a capture is a chord.
  taken(mine) {
    tone('square', mine ? 520 : 300, 0.16, 0.1, mine ? 880 : 420);
  },
  home(mine) {
    tone('triangle', mine ? 620 : 380, 0.2, 0.09, mine ? 300 : 190);
  },
  capture(mine) {
    const base = mine ? 440 : 260;
    tone('sine', base, 0.3, 0.1);
    tone('sine', base * 1.5, 0.34, 0.08);
    tone('sine', base * 2, 0.4, 0.06);
  },
  spawn() {
    tone('sine', 200, 0.18, 0.06, 520);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone('sine', f, 0.34, 0.11), i * 130));
  },
  lose() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone('triangle', f, 0.4, 0.1), i * 180));
  },
  click() {
    tone('square', 520, 0.05, 0.05, 360);
  },
};
