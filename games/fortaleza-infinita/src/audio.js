// Everything you hear, synthesised on the spot. No files, by house rule — and
// in a game about noise it is worth the trouble twice over: the shot you hear
// is the shot the sentinels heard, and a whisper coil has to *sound* like one
// or the whole trade stops reading.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'fortaleza-infinita', volume: 0.32 });

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

// the one long-lived voice in this file — everything else is fire-and-forget
let siren = null;

export const sfx = {
  shot(id) {
    if (id === 'whisper') {
      // a coil, not a charge: a soft magnetic zip and almost nothing else
      noise(0.06, 0.18, 900);
      tone('sine', 640, 0.07, 0.06, 180);
      return;
    }
    if (id === 'shockwave') {
      noise(0.26, 0.5, 2600);
      tone('square', 90, 0.16, 0.16, 40);
      return;
    }
    if (id === 'railgun') {
      // the rails crack first, the air closes after
      noise(0.2, 0.45, 5200, 'highpass');
      tone('sawtooth', 320, 0.18, 0.14, 40);
      return;
    }
    // the energy weapons: a bark with a falling whine inside it
    noise(0.12, 0.38, 2200);
    tone('square', 170, 0.08, 0.12, 60);
    tone('sine', 980, 0.09, 0.05, 240);
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
  roll() {
    // a body hitting the floor and coming back up: the sound the guards hear
    noise(0.22, 0.24, 420);
    tone('sine', 150, 0.16, 0.09, 90);
  },
  cash() {
    tone('sine', 880, 0.09, 0.13, 1320);
    tone('sine', 1320, 0.13, 0.1, 1760);
  },
  break() {
    noise(0.16, 0.3, 4200, 'highpass');
  },
  /**
   * The siren is the alarm's own voice, and it runs for as long as the node
   * that raised it is alive and ringing: two tones trading places, driven by
   * an LFO rather than a timer, so stopping it is one call and not a cleanup.
   *
   * It is created even while muted — the kit's mute is a zeroed master gain,
   * so a player who unmutes mid-alarm hears the ring they are actually in.
   */
  alarmStart() {
    const out = sound.out();
    if (!out || siren) return;
    const ctx = sound.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const lfo = ctx.createOscillator();
    const sweep = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 660;
    lfo.type = 'square';
    lfo.frequency.value = 1.7;                    // the two-tone trade, per second-ish
    sweep.gain.value = 95;                        // 565 Hz on one beat, 755 on the other
    lfo.connect(sweep).connect(osc.frequency);
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.08);
    osc.connect(amp).connect(out);
    osc.start();
    lfo.start();
    siren = { osc, lfo, amp };
  },

  /** Shooting the ringing node, the timer running out, a card, a death: all end here. */
  alarmStop() {
    if (!siren) return;
    const s = siren;
    siren = null;
    try {
      const now = sound.ctx.currentTime;
      // a fade of a few frames: cutting a square wave mid-cycle is a *pop*
      s.amp.gain.setValueAtTime(Math.max(0.0001, s.amp.gain.value), now);
      s.amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      s.osc.stop(now + 0.12);
      s.lfo.stop(now + 0.12);
    } catch {
      /* the context is already gone — nothing left to silence */
    }
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
