// The swarm's seat at the collection counter: the original game, untouched,
// behind the registry protocol. Its simulation and its painter stay where
// they are (and its tests keep importing them from there).

import { PLAY_W } from '../config.js';
import { createGame, update, drain } from '../game.js';
import { createRenderer } from '../render.js';

const renderer = createRenderer();

export function create(rand = Math.random) {
  return createGame({ playW: PLAY_W, rand });
}

export { update, drain };

export function isOver(state) {
  return state.over;
}

export function draw(ctx, state, view) {
  renderer.draw(ctx, state, view.W, view.time, view.best, view.banner, view.bannerAlpha);
}
