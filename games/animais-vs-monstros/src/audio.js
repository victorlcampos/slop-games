// Sound synthesised entirely in the Web Audio API: no files, not one byte of
// audio in the bundle. The browser only unlocks the context after a click, so
// everything here tolerates being called before that without breaking.
//
// The context, the master volume and the mute come from slopkit — which
// remembers the player's choice. This game was the only one of the four that
// forgot the mute on reload.

import { createSound } from 'slopkit/sound';

const base = createSound({ game: 'animais-vs-monstros', volume: 0.5 });

let ctx = null;
let masterGain = null;
let musicGain = null;
let musicPlaying = false;
let nextBar = 0;
let musicTimer = null;

function ac() {
  const c = base.resume();
  if (!c) return null;
  if (!masterGain) {
    ctx = c;
    masterGain = base.out();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.28;
    musicGain.connect(masterGain);
  }
  return ctx;
}

export function wakeAudio() {
  ac();
}

export function toggleSound() {
  return base.toggle();
}

export function soundOn() {
  return base.on;
}

/** Simplified ADSR envelope — the base of nearly every sound here. */
function envelope(node, start, attack, decay, peak, sustain = 0) {
  node.gain.cancelScheduledValues(start);
  node.gain.setValueAtTime(0.0001, start);
  node.gain.exponentialRampToValueAtTime(peak, start + attack);
  node.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), start + attack + decay);
}

function tone(freq, dur, opts = {}) {
  const c = ac();
  if (!c || !base.on) return;
  const { type = 'sine', volume = 0.3, dest = masterGain, slide = 0, delay = 0 } = opts;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(freq + slide, 20), t + dur);
  envelope(g, t, Math.min(0.01, dur * 0.2), dur, volume);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur, opts = {}) {
  const c = ac();
  if (!c || !base.on) return;
  const { volume = 0.25, cutoff = 1200, filterType = 'lowpass', delay = 0, q = 1 } = opts;
  const t = c.currentTime + delay;
  const samples = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, samples, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = cutoff;
  filter.Q.value = q;
  const g = c.createGain();
  envelope(g, t, 0.005, dur, volume);
  src.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------ effects

export const sfx = {
  click: () => tone(660, 0.06, { type: 'triangle', volume: 0.18 }),
  error: () => {
    tone(180, 0.12, { type: 'square', volume: 0.16 });
    tone(120, 0.16, { type: 'square', volume: 0.14, delay: 0.06 });
  },
  plant: () => {
    noise(0.14, { cutoff: 700, volume: 0.22 });
    tone(320, 0.12, { type: 'sine', volume: 0.22, slide: 120 });
  },
  harvest: () => {
    tone(880, 0.08, { type: 'triangle', volume: 0.24 });
    tone(1320, 0.1, { type: 'triangle', volume: 0.18, delay: 0.05 });
  },
  shot: () => {
    tone(520, 0.07, { type: 'square', volume: 0.12, slide: -220 });
    noise(0.05, { cutoff: 2600, volume: 0.1, filterType: 'highpass' });
  },
  hit: () => {
    noise(0.07, { cutoff: 1800, volume: 0.16 });
    tone(220, 0.06, { type: 'triangle', volume: 0.12 });
  },
  bite: () => {
    noise(0.12, { cutoff: 900, volume: 0.26 });
    tone(140, 0.1, { type: 'sawtooth', volume: 0.16, slide: -60 });
  },
  // the Boto entering or leaving the river. The rising pitch is what makes the
  // low noise read as a splash rather than a thud
  splash: () => {
    noise(0.18, { cutoff: 700, volume: 0.2 });
    tone(180, 0.16, { type: 'sine', volume: 0.14, slide: 260 });
  },
  death: () => {
    tone(300, 0.3, { type: 'sawtooth', volume: 0.2, slide: -240 });
    noise(0.28, { cutoff: 600, volume: 0.18 });
  },
  blast: () => {
    noise(0.5, { cutoff: 400, volume: 0.4 });
    tone(90, 0.4, { type: 'sawtooth', volume: 0.3, slide: -60 });
  },
  ice: () => {
    tone(1400, 0.3, { type: 'sine', volume: 0.16, slide: -900 });
    noise(0.25, { cutoff: 5000, volume: 0.1, filterType: 'highpass' });
  },
  roar: () => {
    tone(110, 0.6, { type: 'sawtooth', volume: 0.3, slide: -50 });
    tone(165, 0.5, { type: 'square', volume: 0.14, slide: -40 });
    noise(0.55, { cutoff: 900, volume: 0.22 });
  },
  boss: () => {
    tone(70, 1.1, { type: 'sawtooth', volume: 0.34, slide: -18 });
    tone(105, 0.9, { type: 'square', volume: 0.16, slide: -20, delay: 0.1 });
    noise(1, { cutoff: 500, volume: 0.24 });
  },
  victory: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', volume: 0.24, delay: i * 0.13 }));
  },
  defeat: () => {
    [392, 349, 294, 220].forEach((f, i) => tone(f, 0.6, { type: 'sawtooth', volume: 0.2, delay: i * 0.18 }));
  },
  coin: () => {
    tone(988, 0.09, { type: 'triangle', volume: 0.22 });
    tone(1319, 0.14, { type: 'triangle', volume: 0.18, delay: 0.07 });
  },
  card: () => {
    noise(0.16, { cutoff: 3200, volume: 0.14, filterType: 'highpass' });
    tone(440, 0.1, { type: 'triangle', volume: 0.14, slide: 220 });
  },
  wave: () => {
    tone(160, 0.5, { type: 'sawtooth', volume: 0.2, slide: 90 });
    tone(240, 0.4, { type: 'square', volume: 0.1, slide: 60, delay: 0.08 });
  },
};

// -------------------------------------------------------------------- music

// A simple little march: a bass in half notes and a pentatonic melody that
// rolls notes from inside the chord. It never repeats the same way, but it
// never leaves the key either.
const PROGRESSION = [
  { bass: 110, notes: [220, 262, 330, 392] },
  { bass: 98, notes: [196, 247, 294, 392] },
  { bass: 87, notes: [175, 220, 262, 349] },
  { bass: 131, notes: [262, 330, 392, 523] },
];

function bar(index, tension) {
  const c = ac();
  if (!c || !base.on) return;
  const chord = PROGRESSION[index % PROGRESSION.length];
  const t0 = nextBar;
  const dur = 2;

  tone(chord.bass, 1.6, { type: 'triangle', volume: 0.2, dest: musicGain, delay: t0 - c.currentTime });

  const steps = tension > 0.5 ? 8 : 4;
  for (let i = 0; i < steps; i++) {
    if (Math.random() > (tension > 0.5 ? 0.45 : 0.6)) continue;
    const note = chord.notes[Math.floor(Math.random() * chord.notes.length)];
    tone(note * (Math.random() < 0.25 ? 2 : 1), 0.22, {
      type: 'square',
      volume: 0.075,
      dest: musicGain,
      delay: t0 - c.currentTime + (i * dur) / steps,
    });
  }
  // the beat
  for (let i = 0; i < 4; i++) {
    noise(0.06, {
      cutoff: i % 2 ? 4000 : 200,
      volume: i % 2 ? 0.05 : 0.12,
      filterType: i % 2 ? 'highpass' : 'lowpass',
      delay: t0 - c.currentTime + i * 0.5,
    });
  }
  nextBar += dur;
}

export function playMusic(tension = 0) {
  const c = ac();
  if (!c || musicPlaying) return;
  musicPlaying = true;
  nextBar = c.currentTime + 0.1;
  let i = 0;
  const step = () => {
    if (!musicPlaying) return;
    // schedule with slack so the audio doesn't stutter when the tab loses focus
    while (nextBar < c.currentTime + 2) bar(i++, tension);
    musicTimer = setTimeout(step, 600);
  };
  step();
}

export function stopMusic() {
  musicPlaying = false;
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
}
