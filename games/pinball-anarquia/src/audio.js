// The soundtrack and the cabinet noises, all synthesised — rule nº 5.
//
// The Space Cadet table never shut up: a driving loop under the game and a
// noise for everything the ball touched. Same here. The music is a lookahead
// scheduler over a 2-bar riff in A minor — bass, arpeggio, hat and kick — and
// every effect is an oscillator with an envelope, routed through the kit's
// persisted-mute master gain.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'pinball-anarquia', volume: 0.5 });

// ------------------------------------------------------------------ music

const BPM = 132;
const STEP = 60 / BPM / 4; // sixteenth
// two bars, sixteenths; 0 = rest. Frequencies, A minor with a raised edge.
const A2 = 110, C3 = 130.81, D3 = 146.83, E3 = 164.81, G3 = 196, A3 = 220;
const BASS = [
  A2, 0, A2, 0, C3, 0, A2, 0, D3, 0, C3, 0, E3, 0, D3, C3,
  A2, 0, A2, 0, C3, 0, A2, 0, G3, 0, E3, 0, D3, 0, C3, 0,
];
const ARP = [
  0, A3, 0, C3 * 2, 0, E3 * 2, 0, A3 * 2, 0, G3 * 2, 0, E3 * 2, 0, C3 * 2, 0, A3,
  0, 0, A3, 0, C3 * 2, 0, E3 * 2, 0, 0, G3 * 2, 0, E3 * 2, 0, D3 * 2, 0, 0,
];

let musicOn = false;
let timer = null;
let nextTime = 0;
let stepIndex = 0;
export let beat = { step: 0, at: 0 }; // the renderer reads this for the equalizer

function scheduleStep(ctx, out, when, i) {
  const bass = BASS[i % BASS.length];
  if (bass) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = bass;
    g.gain.setValueAtTime(0.11, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + STEP * 1.7);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + STEP * 1.8);
  }
  const arp = ARP[i % ARP.length];
  if (arp) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = arp;
    g.gain.setValueAtTime(0.035, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + STEP * 0.9);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + STEP);
  }
  if (i % 2 === 0) {
    // hat: a sliver of noise
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
    const s = ctx.createBufferSource();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    g.gain.value = i % 8 === 4 ? 0.05 : 0.025;
    s.buffer = buf;
    s.connect(f).connect(g).connect(out);
    s.start(when);
  }
  if (i % 4 === 0) {
    // kick: a sine dropping an octave, fast
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.09);
    g.gain.setValueAtTime(0.22, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + 0.14);
  }
}

export function startMusic() {
  if (musicOn) return;
  const ctx = sound.resume();
  if (!ctx) return;
  musicOn = true;
  nextTime = ctx.currentTime + 0.05;
  stepIndex = 0;
  timer = setInterval(() => {
    const out = sound.out();
    if (!out) return;
    // schedule everything due in the next 120ms — survives a busy main thread
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleStep(ctx, out, nextTime, stepIndex);
      beat = { step: stepIndex, at: nextTime };
      stepIndex++;
      nextTime += STEP;
    }
  }, 30);
}

export function stopMusic() {
  musicOn = false;
  if (timer) clearInterval(timer);
  timer = null;
}

// ------------------------------------------------------------------ cabinet

export const sfx = {
  flipper: () => sound.tone(95, 0.06, { type: 'square', gain: 0.2 }),
  flipperHit: () => sound.tone(180, 0.05, { type: 'triangle', gain: 0.15 }),
  bumper: () => {
    sound.tone(660, 0.08, { type: 'square', gain: 0.22, slide: 180 });
    sound.tone(1320, 0.05, { type: 'sine', gain: 0.1 });
  },
  sling: () => sound.tone(330, 0.07, { type: 'sawtooth', gain: 0.18, slide: 90 }),
  rollover: () => sound.tone(880, 0.1, { type: 'sine', gain: 0.18, slide: 220 }),
  lanes: () => [523, 659, 784, 1047].forEach((f, i) => sound.tone(f, 0.09, { gain: 0.16, delay: i * 0.07 })),
  target: () => sound.tone(523, 0.06, { type: 'square', gain: 0.2, slide: -120 }),
  bank: () => [392, 523, 659].forEach((f, i) => sound.tone(f, 0.14, { type: 'square', gain: 0.15, delay: i * 0.05 })),
  hole: () => sound.tone(440, 0.5, { type: 'sine', gain: 0.2, slide: -380 }),
  eject: () => sound.tone(220, 0.18, { type: 'sawtooth', gain: 0.2, slide: 440 }),
  launch: () => sound.tone(160, 0.3, { type: 'sawtooth', gain: 0.2, slide: 640 }),
  skill: () => [880, 1109, 1319].forEach((f, i) => sound.tone(f, 0.1, { gain: 0.18, delay: i * 0.06 })),
  save: () => [659, 880].forEach((f, i) => sound.tone(f, 0.12, { gain: 0.18, delay: i * 0.08 })),
  kickback: () => sound.tone(140, 0.22, { type: 'square', gain: 0.24, slide: 500 }),
  nudge: () => sound.tone(70, 0.05, { type: 'sine', gain: 0.25 }),
  tilt: () => {
    sound.tone(110, 0.7, { type: 'sawtooth', gain: 0.25, slide: -60 });
    sound.tone(117, 0.7, { type: 'sawtooth', gain: 0.25, slide: -60 });
  },
  drain: () => sound.tone(220, 0.5, { type: 'sawtooth', gain: 0.2, slide: -160 }),
  extra: () => [523, 659, 784, 1047, 1319].forEach((f, i) => sound.tone(f, 0.12, { gain: 0.18, delay: i * 0.07 })),
  mission: () => [440, 554, 659, 880, 659, 880, 1109].forEach((f, i) => sound.tone(f, 0.13, { type: 'square', gain: 0.14, delay: i * 0.08 })),
  over: () => [330, 262, 220, 165].forEach((f, i) => sound.tone(f, 0.22, { type: 'sawtooth', gain: 0.16, delay: i * 0.14 })),
};
