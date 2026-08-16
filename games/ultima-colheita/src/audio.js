// Every sound is an oscillator with an opinion. The context, the volume and
// the persisted mute come from the kit; this file only decides what the town
// sounds like.

import { createSound } from 'slopkit/sound';

export const sound = createSound({ game: 'ultima-colheita', volume: 0.4 });

export const sfx = {
  place() {
    sound.tone(220, 0.07, { type: 'square', gain: 0.12 });
    sound.tone(330, 0.06, { type: 'square', gain: 0.1, delay: 0.05 });
  },
  deny() {
    sound.tone(140, 0.12, { type: 'sawtooth', gain: 0.1, slide: -40 });
  },
  demolish() {
    sound.tone(90, 0.2, { type: 'sawtooth', gain: 0.14, slide: -50 });
  },
  rally() {
    sound.tone(392, 0.08, { type: 'triangle', gain: 0.12 });
    sound.tone(523, 0.1, { type: 'triangle', gain: 0.12, delay: 0.07 });
  },
  trained() {
    sound.tone(330, 0.08, { type: 'triangle', gain: 0.14 });
    sound.tone(494, 0.12, { type: 'triangle', gain: 0.14, delay: 0.08 });
  },
  born() {
    sound.tone(660, 0.09, { type: 'sine', gain: 0.1, slide: 120 });
  },
  starve() {
    sound.tone(180, 0.3, { type: 'sine', gain: 0.12, slide: -60 });
  },
  arrow() {
    sound.tone(900, 0.05, { type: 'triangle', gain: 0.05, slide: -300 });
  },
  clash() {
    sound.tone(500, 0.04, { type: 'square', gain: 0.06, slide: 200 });
  },
  bite() {
    sound.tone(110, 0.08, { type: 'sawtooth', gain: 0.07, slide: -30 });
  },
  die() {
    sound.tone(160, 0.18, { type: 'sawtooth', gain: 0.1, slide: -80 });
  },
  unitdie() {
    sound.tone(240, 0.25, { type: 'sine', gain: 0.13, slide: -120 });
  },
  /** The horn: two long fifths — the sound the whole game is built around. */
  horn() {
    sound.tone(196, 0.7, { type: 'sawtooth', gain: 0.16 });
    sound.tone(294, 0.7, { type: 'sawtooth', gain: 0.12, delay: 0.75 });
    sound.tone(196, 1.1, { type: 'sawtooth', gain: 0.18, delay: 1.5 });
  },
  bell() {
    sound.tone(784, 0.5, { type: 'sine', gain: 0.12 });
    sound.tone(588, 0.7, { type: 'sine', gain: 0.1, delay: 0.4 });
  },
  cleared() {
    sound.tone(392, 0.12, { type: 'triangle', gain: 0.14 });
    sound.tone(494, 0.12, { type: 'triangle', gain: 0.14, delay: 0.12 });
    sound.tone(588, 0.2, { type: 'triangle', gain: 0.16, delay: 0.24 });
  },
  over() {
    sound.tone(220, 0.5, { type: 'sawtooth', gain: 0.16, slide: -80 });
    sound.tone(147, 1.2, { type: 'sawtooth', gain: 0.16, slide: -40, delay: 0.5 });
  },
};
