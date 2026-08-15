// The arena, small enough to choose with.
//
// A list of six names tells you nothing: "The Bridge" and "The Gates" are both
// two words and a shape you have to take on trust. The picker draws the real
// grid instead — the same `buildArena` the match is played on, so a card cannot
// drift from the field behind it — with the two stands, the spawns and whatever
// that arena has that the others do not.

import { COLS, ROWS, TILE, KIT, COLOURS } from './config.js';
import { WALL, PIT, BASE_H, BASE_A } from './grid.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} arena from `buildArena`
 * @param {number} w  box width; the map is centred in it
 * @param {number} h  box height
 */
export function drawArenaThumb(ctx, arena, w, h) {
  const size = Math.min(w / COLS, h / ROWS);
  const x0 = (w - COLS * size) / 2;
  const y0 = (h - ROWS * size) / 2;

  ctx.save();
  ctx.translate(x0, y0);

  ctx.fillStyle = arena.dark ? '#0a0e16' : '#2a333d';
  ctx.fillRect(0, 0, COLS * size, ROWS * size);

  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const kind = arena.grid.at(cx, cy);
      if (kind === WALL) ctx.fillStyle = arena.dark ? '#2c3a48' : COLOURS.wallTop;
      else if (kind === PIT) ctx.fillStyle = '#05070b';
      else if (kind === BASE_H) ctx.fillStyle = 'rgba(255,154,77,0.32)';
      else if (kind === BASE_A) ctx.fillStyle = 'rgba(79,224,176,0.32)';
      else continue;
      // a hair over a whole cell: at four pixels a tile, the seam between two
      // wall cells is a bright line through the middle of a wall
      ctx.fillRect(cx * size, cy * size, size + 0.5, size + 0.5);
    }
  }

  const at = (p) => ({ x: (p.x / TILE) * size, y: (p.y / TILE) * size });
  const dot = (p, colour, r) => {
    const q = at(p);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // what makes this arena itself, before the flags: the turrets and the pads
  for (const tur of arena.turrets) dot(tur, '#ff6a5a', Math.max(1.4, size * 0.3));
  for (const pad of arena.pads) {
    const q = at(pad);
    ctx.strokeStyle = '#8fd0ff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(q.x, q.y, Math.max(2, size * 0.5), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const team of ['human', 'alien']) {
    for (const s of arena.spawns[team]) dot(s, 'rgba(255,255,255,0.35)', Math.max(1, size * 0.22));
    // the stand, drawn as the little flag it is: this is the thing both squads
    // are walking towards, and it should be the first thing the eye finds
    const f = at(arena.flags[team]);
    ctx.fillStyle = KIT[team].tint;
    ctx.fillRect(f.x - 0.75, f.y - size * 1.6, 1.5, size * 2.6);
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - size * 1.6);
    ctx.lineTo(f.x + size * 1.5, f.y - size * 1.05);
    ctx.lineTo(f.x, f.y - size * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  if (arena.dark) {
    // the night arena says so without a caption: the light falls off from the
    // middle, which is the only place both squads meet
    const g = ctx.createRadialGradient(
      (COLS * size) / 2, (ROWS * size) / 2, size * 3,
      (COLS * size) / 2, (ROWS * size) / 2, COLS * size * 0.55,
    );
    g.addColorStop(0, 'rgba(5,7,11,0)');
    g.addColorStop(1, 'rgba(5,7,11,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, COLS * size, ROWS * size);
  }

  ctx.restore();
}
