// A three-piece rock loop built at runtime: clipped sawtooths are the guitar,
// a square wave is the bass, and filtered noise becomes hats and snare. Nothing
// is decoded, downloaded or stored outside this module.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'tetris-a-vapor', volume: 0.34 });

const BPM = 148;
const STEP = 60 / BPM / 4;
const RIFF = [0, null, 0, 3, 5, null, 3, 0, 7, null, 5, 3, 0, 0, 10, 7];

let bus = null;
let noiseBuffer = null;
let curve = null;

function ensure() {
  const c = sound.resume();
  if (!c) return null;
  if (!bus) {
    bus = c.createGain();
    bus.gain.value = 0.42;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    bus.connect(comp);
    comp.connect(sound.out());

    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    curve = new Float32Array(256);
    for (let i = 0; i < curve.length; i++) {
      const x = i * 2 / (curve.length - 1) - 1;
      curve[i] = Math.tanh(x * 4.5);
    }
  }
  return c;
}

function envelope(c, when, duration, gain) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  return g;
}

function guitar(freq, when, duration = STEP * 1.7, gain = 0.1) {
  const c = ensure();
  if (!c) return;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, when);
  filter.frequency.exponentialRampToValueAtTime(650, when + duration);
  filter.Q.value = 1.1;
  const drive = c.createWaveShaper();
  drive.curve = curve;
  drive.oversample = '2x';
  const g = envelope(c, when, duration, gain);
  filter.connect(drive); drive.connect(g); g.connect(bus);
  for (const [ratio, detune] of [[2, -5], [3, 4]]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * ratio, when);
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }
}

function bass(freq, when) {
  const c = ensure();
  if (!c) return;
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  const g = envelope(c, when, STEP * 1.8, 0.12);
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, when);
  filter.type = 'lowpass';
  filter.frequency.value = 280;
  osc.connect(filter); filter.connect(g); g.connect(bus);
  osc.start(when); osc.stop(when + STEP * 1.9);
}

function noiseHit(when, duration, { gain = 0.08, highpass = 500, lowpass = 12000 } = {}) {
  const c = ensure();
  if (!c || !noiseBuffer) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const hi = c.createBiquadFilter();
  hi.type = 'highpass'; hi.frequency.value = highpass;
  const lo = c.createBiquadFilter();
  lo.type = 'lowpass'; lo.frequency.value = lowpass;
  const g = envelope(c, when, duration, gain);
  src.connect(hi); hi.connect(lo); lo.connect(g); g.connect(bus);
  src.start(when, Math.random() * 0.6, duration + 0.02);
  src.stop(when + duration + 0.03);
}

function kick(when, gain = 0.18) {
  const c = ensure();
  if (!c) return;
  const osc = c.createOscillator();
  const g = envelope(c, when, 0.14, gain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(145, when);
  osc.frequency.exponentialRampToValueAtTime(46, when + 0.12);
  osc.connect(g); g.connect(bus);
  osc.start(when); osc.stop(when + 0.16);
}

function scheduleStep(index, when) {
  const note = RIFF[index];
  const root = 82.41;
  if (note !== null) {
    const freq = root * Math.pow(2, note / 12);
    guitar(freq, when, index === 15 ? STEP * 3 : STEP * 1.65);
    bass(freq, when);
  } else if (index % 2 === 0) {
    bass(root, when);
  }
  if ([0, 4, 8, 11, 12].includes(index)) kick(when);
  if (index === 4 || index === 12) noiseHit(when, 0.16, { gain: 0.13, highpass: 700, lowpass: 6500 });
  noiseHit(when, index % 4 === 2 ? 0.065 : 0.035, { gain: index % 2 ? 0.032 : 0.05, highpass: 5200 });
}

export const music = (() => {
  let playing = false;
  let step = 0;
  let nextAt = 0;
  return {
    start() {
      const c = ensure();
      if (!c) return;
      playing = true;
      step = 0;
      nextAt = c.currentTime + 0.04;
    },
    stop() {
      playing = false;
      nextAt = 0;
    },
    update() {
      const c = sound.ctx;
      if (!playing || !c || !sound.on) return;
      if (nextAt < c.currentTime - 0.25) nextAt = c.currentTime + 0.03;
      while (nextAt < c.currentTime + 0.14) {
        scheduleStep(step, nextAt);
        step = (step + 1) % RIFF.length;
        nextAt += STEP;
      }
    },
    get playing() { return playing; },
  };
})();

function blast(duration = 0.28, gain = 0.16) {
  const c = ensure();
  if (!c || !sound.on) return;
  noiseHit(c.currentTime, duration, { gain, highpass: 90, lowpass: 2400 });
  kick(c.currentTime, gain * 0.9);
}

export const sfx = {
  move() { sound.tone(170, 0.025, { type: 'square', gain: 0.035 }); },
  rotate() {
    sound.tone(330, 0.045, { type: 'square', gain: 0.055, slide: 80 });
    sound.tone(495, 0.04, { type: 'square', gain: 0.035, delay: 0.025 });
  },
  hold() { sound.tone(220, 0.11, { type: 'triangle', gain: 0.08, slide: -70 }); },
  lock() { sound.tone(72, 0.09, { type: 'square', gain: 0.12, slide: -24 }); },
  drop(distance = 1) {
    sound.tone(130 + Math.min(distance, 14) * 5, 0.12, { type: 'sawtooth', gain: 0.09, slide: -80 });
  },
  clear(count = 1) {
    blast(0.2 + count * 0.08, 0.12 + count * 0.025);
    const chord = count === 4 ? [196, 294, 392, 587] : [262, 330, 392].slice(0, Math.max(1, count));
    chord.forEach((freq, i) => sound.tone(freq, 0.3, { type: 'sawtooth', gain: 0.08, delay: i * 0.045, slide: 35 }));
  },
  level() {
    [220, 330, 440, 660].forEach((freq, i) => sound.tone(freq, 0.28, { type: 'square', gain: 0.075, delay: i * 0.07 }));
  },
  over() {
    music.stop();
    blast(0.65, 0.2);
    [196, 165, 147, 110].forEach((freq, i) => sound.tone(freq, 0.42, { type: 'sawtooth', gain: 0.1, delay: i * 0.16, slide: -35 }));
  },
};
