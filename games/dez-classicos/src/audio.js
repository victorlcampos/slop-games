// The sounds a wooden table makes, synthesised.
//
// No file ships with this game (rule nº 5), so every noise here is an
// oscillator and a filtered burst of noise. What makes them sound like wood
// rather than like a synthesiser is short envelopes and a *pitched* noise
// burst: a chess piece on a board is a click with a body to it, ten
// milliseconds long, and the body is what the band-pass filter is for.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'dez-classicos', volume: 0.42 });

/** A short burst of filtered noise — the body of every knock on this table. */
function knock(freq, dur, { gain = 0.3, q = 6, type = 'bandpass' } = {}) {
  const ctx = sound.resume();
  if (!ctx || !sound.on) return;
  const t = ctx.currentTime;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // the noise decays inside the buffer, so even a long filter tail dies
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.2);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(sound.out());
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  /** A piece set down. */
  place: () => knock(340, 0.09, { gain: 0.32, q: 3 }),
  /** A piece taken: the same knock, lower and with a second body under it. */
  capture: () => {
    knock(190, 0.16, { gain: 0.4, q: 2 });
    sound.tone(96, 0.1, { type: 'sine', gain: 0.16, slide: -40 });
  },
  /** A disc dropping into the rack. */
  drop: () => {
    knock(520, 0.05, { gain: 0.22, q: 8 });
    setTimeout(() => knock(300, 0.09, { gain: 0.26, q: 4 }), 90);
  },
  /** Reversi's line turning over: a soft rising sweep, once per disc. */
  flip: (i = 0) => sound.tone(420 + i * 30, 0.05, { type: 'triangle', gain: 0.1, delay: i * 0.05 }),
  /** Dice in a cup. */
  dice: () => {
    for (let i = 0; i < 5; i++) setTimeout(() => knock(700 + Math.random() * 500, 0.05, { gain: 0.16, q: 5 }), i * 55);
  },
  /** A seed landing in a pit. */
  seed: (i = 0) => setTimeout(() => knock(820 + (i % 4) * 120, 0.035, { gain: 0.12, q: 9 }), i * 70),
  /** Something is not allowed. */
  deny: () => sound.tone(150, 0.11, { type: 'square', gain: 0.09, slide: -40 }),
  /** A square filled in correctly. */
  write: () => sound.tone(760, 0.05, { type: 'sine', gain: 0.1 }),
  /** A square filled in wrongly. */
  wrong: () => {
    sound.tone(220, 0.14, { type: 'sawtooth', gain: 0.1 });
    sound.tone(210, 0.16, { type: 'sawtooth', gain: 0.08, delay: 0.05 });
  },
  /** The game is over, and you are the reason. */
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      sound.tone(f, 0.24, { type: 'triangle', gain: 0.16, delay: i * 0.09 })
    );
  },
  /** The game is over, and you are not. */
  lose: () => {
    [392, 349.23, 293.66].forEach((f, i) =>
      sound.tone(f, 0.3, { type: 'sine', gain: 0.14, delay: i * 0.13 })
    );
  },
  /** Nobody won. */
  draw: () => {
    sound.tone(392, 0.22, { type: 'sine', gain: 0.12 });
    sound.tone(392, 0.26, { type: 'sine', gain: 0.1, delay: 0.16 });
  },
};
