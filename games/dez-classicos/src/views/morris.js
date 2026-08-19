// The morris board: three squares inside each other, joined at the middles,
// cut into a plank.
//
// Everything here is engraved rather than drawn — the lines are grooves with a
// lit lip, and the points are shallow holes. That is what the real thing is: a
// board somebody cut, not a diagram somebody printed. It also solves a problem
// a printed diagram has, which is that a piece standing on a printed dot hides
// it; a piece sitting in a hole looks like it belongs there.

import { disc, hollow, engrave, halo } from '../render/paint.js';
import { PALETTES } from '../theme.js';
import { morris, MILLS, ADJ, POINTS, millAt, count } from '../games/morris.js';
import { drawFrame, texture } from './board.js';
import { cellOf } from '../games/shared.js';

const P = PALETTES.morris;

/** The 24 points, on a 7x7 lattice — three nested rings plus the four spokes. */
const LATTICE = [
  [0, 0], [3, 0], [6, 0],
  [1, 1], [3, 1], [5, 1],
  [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4],
  [1, 5], [3, 5], [5, 5],
  [0, 6], [3, 6], [6, 6],
];

export function createMorrisView() {
  let g = null;

  const view = {
    id: 'morris',

    measure(box) {
      // room for the frame *and* for the two stacks of pieces still in hand,
      // which stand outside the playing area on either side
      const side = Math.min(box.w - 92, box.h - 56);
      const step = side / 6;
      g = { x: box.x + (box.w - side) / 2, y: box.y + (box.h - side) / 2, side, step, r: step * 0.3 };
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      const at = (i) => ({ x: g.x + LATTICE[i][0] * g.step, y: g.y + LATTICE[i][1] * g.step });
      const frame = { x: g.x, y: g.y, w: g.side, h: g.side, cell: g.step, cols: 6, rows: 6 };
      drawFrame(ctx, frame, P.frame, { rim: 26, radius: 12, inner: false });

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x - 6, g.y - 6, g.side + 12, g.side + 12);
      ctx.clip();
      ctx.drawImage(texture('wood', Math.round(g.side + 12), Math.round(g.side + 12), P.board, { seed: 6 }), g.x - 6, g.y - 6);
      ctx.restore();

      // the three squares and the four spokes, engraved
      engrave(ctx, (c) => {
        for (const ring of [0, 1, 2]) {
          const a = at([0, 3, 6][ring]);
          const b = at([2, 5, 8][ring]);
          c.rect(a.x, a.y, b.x - a.x, b.x - a.x);
        }
        for (const [from, to] of [[1, 7], [9, 11], [12, 14], [16, 22]]) {
          const a = at(from);
          const b = at(to);
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
        }
      }, { width: Math.max(3, g.step * 0.07) });

      for (let i = 0; i < POINTS; i++) {
        const p = at(i);
        hollow(ctx, p.x, p.y, g.r * 0.62, { depth: 0.45 });
      }

      // a mill just closed: the line it closed stays lit while the player picks
      // which piece to take
      for (const mill of MILLS) {
        const cell = state.b[mill[0]];
        if (!cell || state.b[mill[1]] !== cell || state.b[mill[2]] !== cell) continue;
        const a = at(mill[0]);
        const b = at(mill[2]);
        ctx.save();
        ctx.strokeStyle = P.accent;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = Math.max(3, g.step * 0.08);
        ctx.lineCap = 'round';
        ctx.shadowColor = P.accent;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }

      const anim = ui.anim && ui.anim.move ? ui.anim : null;
      const moving = anim && anim.move.from !== undefined ? anim.move : null;

      for (let i = 0; i < POINTS; i++) {
        const cell = state.b[i];
        if (!cell) continue;
        if (moving && i === moving.to) continue;
        const p = at(i);
        disc(ctx, p.x, p.y, g.r, P.pieces[cell - 1], { rings: 1 });
      }

      if (moving) {
        const a = at(moving.from);
        const b = at(moving.to);
        const k = Math.min(1, anim.t / 0.8);
        const cell = state.b[moving.to];
        disc(ctx, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, g.r, P.pieces[cell - 1], { rings: 1, lift: 1.5 });
      }

      for (const hint of ui.hints || []) {
        const p = at(hint.at);
        ctx.save();
        ctx.globalAlpha = hint.take ? 0.9 : 0.42;
        if (hint.take) {
          halo(ctx, p.x, p.y, g.r * 1.15, '#e0523c', { width: 3, blur: 14 });
        } else {
          disc(ctx, p.x, p.y, g.r * 0.62, P.pieces[state.turn], { lift: 0.2 });
        }
        ctx.restore();
      }

      if (ui.sel !== null && ui.sel !== undefined && ui.sel >= 0) {
        const p = at(ui.sel);
        halo(ctx, p.x, p.y, g.r * 1.2, P.accent, { width: 3, blur: 16 });
      }

      // the pieces still in hand, stacked outside the frame on each player's
      // side — a stack that grows upwards, so the top of it is the next one out
      for (const player of [0, 1]) {
        const x = player === 0 ? g.x - 34 : g.x + g.side + 34;
        const step = Math.min(g.r * 0.62, (g.side - g.r * 2) / 9);
        for (let i = 0; i < state.hand[player]; i++) {
          disc(ctx, x, g.y + g.side - g.r - i * step, g.r * 0.7, P.pieces[player], { rings: 0, lift: 0.3 });
        }
      }
    },

    /** Nearest point within half a step, so a fat finger still lands somewhere. */
    hit(x, y) {
      if (!g) return -1;
      let best = -1;
      let bestD = g.step * 0.48;
      for (let i = 0; i < POINTS; i++) {
        const p = { x: g.x + LATTICE[i][0] * g.step, y: g.y + LATTICE[i][1] * g.step };
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },

    /**
     * Three phases in one selection machine.
     *
     * `sel` carries the phase: a number is a picked-up piece, and the object
     * `{ pending }` is a move waiting for the player to say which enemy piece
     * it takes. Closing a mill is two clicks, and it has to be — the rules give
     * the choice to the player, and a machine that chose for them would be
     * playing half their turn.
     */
    pick(state, point, sel, legal) {
      if (point < 0) return { sel };
      if (sel && sel.pending) {
        const move = legal.find((m) => same(m, sel.pending) && m.take === point);
        return move ? { sel: null, move } : { sel };
      }

      const placing = state.hand[state.turn] > 0;
      if (placing) {
        const options = legal.filter((m) => m.at === point);
        if (!options.length) return { sel: null };
        if (options.length === 1 && options[0].take === undefined) return { sel: null, move: options[0] };
        return { sel: { pending: { at: point } } };
      }

      if (sel === null || sel === undefined || sel < 0 || typeof sel !== 'number') {
        return legal.some((m) => m.from === point) ? { sel: point } : { sel: null };
      }
      const options = legal.filter((m) => m.from === sel && m.to === point);
      if (!options.length) return legal.some((m) => m.from === point) ? { sel: point } : { sel: null };
      if (options.length === 1 && options[0].take === undefined) return { sel: null, move: options[0] };
      return { sel: { pending: { from: sel, to: point } } };
    },

    hints(state, sel, legal) {
      if (sel && sel.pending) {
        return legal.filter((m) => same(m, sel.pending)).map((m) => ({ at: m.take, take: true }));
      }
      if (typeof sel === 'number' && sel >= 0) {
        return legal.filter((m) => m.from === sel).map((m) => ({ at: m.to }));
      }
      if (state.hand[state.turn] > 0) {
        const seen = new Set();
        return legal.filter((m) => m.at !== undefined && !seen.has(m.at) && seen.add(m.at)).map((m) => ({ at: m.at }));
      }
      return [];
    },

    thumb(ctx, w, h) {
      const side = Math.min(w, h) * 0.9;
      g = { x: (w - side) / 2, y: (h - side) / 2, side, step: side / 6, r: (side / 6) * 0.3 };
      ctx.drawImage(texture('wood', Math.round(w), Math.round(h), P.board, { seed: 6 }), 0, 0, w, h);
      const at = (i) => ({ x: g.x + LATTICE[i][0] * g.step, y: g.y + LATTICE[i][1] * g.step });
      engrave(ctx, (c) => {
        for (const ring of [0, 1, 2]) {
          const a = at([0, 3, 6][ring]);
          const b = at([2, 5, 8][ring]);
          c.rect(a.x, a.y, b.x - a.x, b.x - a.x);
        }
        for (const [from, to] of [[1, 7], [9, 11], [12, 14], [16, 22]]) {
          const p = at(from);
          const q = at(to);
          c.moveTo(p.x, p.y);
          c.lineTo(q.x, q.y);
        }
      }, { width: Math.max(2, g.step * 0.06) });
      for (const [i, side2] of [[0, 0], [1, 0], [2, 0], [9, 1], [10, 1], [4, 1], [21, 0], [23, 1], [16, 1]]) {
        const p = at(i);
        disc(ctx, p.x, p.y, g.r, P.pieces[side2], { rings: 1 });
      }
    },
  };
  return view;
}

const same = (move, pending) =>
  pending.at !== undefined ? move.at === pending.at : move.from === pending.from && move.to === pending.to;

export function morrisSeat(state, colour) {
  const onBoard = count(state.b, colour);
  return {
    score: onBoard + state.hand[colour],
    extra: (ctx, area) => {
      const total = onBoard + state.hand[colour];
      const r = Math.min(area.h * 0.4, (area.w - 6) / Math.max(9, total * 1.2) / 2 + 2);
      let x = area.x + r + 2;
      for (let i = 0; i < total; i++) {
        ctx.save();
        // the ones still in hand are drawn dimmer than the ones in play
        if (i >= onBoard) ctx.globalAlpha = 0.45;
        disc(ctx, x, area.y + area.h * 0.5, r, P.pieces[colour], { lift: 0.3 });
        ctx.restore();
        x += r * 2.25;
      }
    },
  };
}
