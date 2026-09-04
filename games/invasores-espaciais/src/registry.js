// The collection: seven arcade homages behind one neon sign.
//
// Every game speaks the same protocol, which is what lets the shell stay dumb:
// menu lists them, the loop routes to the selected one, the save keeps one
// best per id.
//
//   create(rand)          fresh state (playW comes from config, not the caller)
//   update(state, h, input)
//   draw(ctx, state, view)  view = { time, W, best, banner, bannerAlpha }
//   drain(state)          side-effect events for the speaker
//   isOver(state)         the run is finished and the card can come up
//
// `state` always carries score, lives and over. A 'banner' event carries
// ready-translated text for the shell to flash over the canvas.

import { PLAY_W } from './config.js';
import * as swarm from './games/swarm.js';
import * as maze from './games/maze.js';
import * as blocks from './games/blocks.js';
import * as snake from './games/snake.js';
import * as rocks from './games/rocks.js';
import * as hopper from './games/hopper.js';
import * as bounce from './games/bounce.js';

const MODULES = { swarm, maze, blocks, snake, rocks, hopper, bounce };

export const ORDER = ['swarm', 'maze', 'blocks', 'snake', 'rocks', 'hopper', 'bounce'];

export function gameIds() {
  return [...ORDER];
}

/** The module behind an id, or null for a bad id (a hand-edited save). */
export function loadGame(id) {
  return MODULES[id] || null;
}

export function blankBests() {
  const bests = {};
  for (const id of ORDER) bests[id] = 0;
  return bests;
}

/** A fresh run of every game, one after another — the shell's smoke test. */
export function smokeAll(rand) {
  const out = [];
  for (const id of ORDER) out.push(MODULES[id].create(rand));
  return out;
}

export { PLAY_W };
