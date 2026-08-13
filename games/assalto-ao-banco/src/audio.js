// Everything you hear, synthesised on the spot. No files, by house rule — and
// in a game about noise it is worth the trouble twice over: the shot you hear
// is the shot the guards heard, and a silenced pistol has to *sound* like one
// or the whole trade stops reading.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'assalto-ao-banco', volume: 0.32 });

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

export const sfx = {
  shot(id) {
    if (id === 'silenced') {
      noise(0.07, 0.22, 900);
      tone('triangle', 240, 0.06, 0.06, 120);
      return;
    }
    if (id === 'shotgun') {
      noise(0.26, 0.5, 2600);
      tone('square', 90, 0.16, 0.16, 40);
      return;
    }
    noise(0.12, 0.38, 2200);
    tone('square', 170, 0.08, 0.12, 60);
  },
  hurt() {
    tone('sawtooth', 200, 0.22, 0.2, 70);
    noise(0.12, 0.2, 700);
  },
  kill() {
    noise(0.3, 0.22, 500);
    tone('triangle', 130, 0.24, 0.1, 50);
  },
  pick() {
    tone('sine', 700, 0.09, 0.14, 1050);
  },
  cash() {
    tone('sine', 880, 0.09, 0.13, 1320);
    tone('sine', 1320, 0.13, 0.1, 1760);
  },
  break() {
    noise(0.16, 0.3, 4200, 'highpass');
  },
  /** Two notes, back and forth: a bell nobody in the building can ignore. */
  alarm() {
    tone('square', 740, 0.28, 0.16, 740);
    setTimeout(() => tone('square', 560, 0.28, 0.16, 560), 240);
  },
  drill() {
    tone('sawtooth', 78, 0.16, 0.07, 66);
  },
  vault() {
    tone('sine', 520, 0.5, 0.16, 780);
    setTimeout(() => tone('sine', 780, 0.7, 0.14, 1040), 160);
  },
  dead() {
    tone('sawtooth', 220, 0.9, 0.2, 55);
  },
};
