// The reversi table: baize, a grid of thread, and eighty pieces that are white
// on one side and black on the other.
//
// The flip is the game, so it is drawn as a flip: a disc squashed to nothing
// around its vertical axis, the colour swapped at the moment it is edge-on, and
// back out again. The line flips in order, outwards from the piece that was
// just played, because that is the direction the capture actually travels — and
// watching it travel is how a player learns to see the lines.

import { disc, feltTile, roundRect, easeInOut, easeOut, fitText } from '../render/paint.js';
import { PALETTES } from '../theme.js';
import { reversi, movesFor, counts, SIZE } from '../games/reversi.js';
import { grid, cellCentre, cellXY, cellAt, drawFrame, texture, markSquare } from './board.js';

const P = PALETTES.reversi;
const DOTS = [18, 21, 42, 45];

export function createReversiView() {
  let g = null;

  const view = {
    id: 'reversi',

    measure(box) {
      g = grid({ x: box.x + 20, y: box.y + 20, w: box.w - 40, h: box.h - 40 }, SIZE);
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      drawFrame(ctx, g, P.frame);

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.clip();
      ctx.drawImage(texture('felt', 320, 320, P.felt, { seed: 12 }), g.x, g.y, g.w, g.h);
      const pool = ctx.createRadialGradient(g.x + g.w * 0.4, g.y + g.h * 0.32, 20, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.8);
      pool.addColorStop(0, 'rgba(255,255,255,0.1)');
      pool.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = pool;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.restore();

      // the thread: a dark line with a lighter one under it, like stitching
      ctx.save();
      for (let i = 0; i <= SIZE; i++) {
        for (const [colour, offset, width] of [['rgba(0,0,0,0.45)', 0, 1.5], ['rgba(255,255,255,0.09)', 1, 1]]) {
          ctx.strokeStyle = colour;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(g.x + i * g.cell, g.y + offset);
          ctx.lineTo(g.x + i * g.cell, g.y + g.h + offset);
          ctx.moveTo(g.x, g.y + i * g.cell + offset);
          ctx.lineTo(g.x + g.w, g.y + i * g.cell + offset);
          ctx.stroke();
        }
      }
      // the four dots every real board has, at the corners of the middle square
      for (const i of DOTS) {
        const p = cellXY(g, i, false);
        ctx.beginPath();
        ctx.arc(p.x + g.cell, p.y + g.cell, Math.max(2, g.cell * 0.05), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fill();
      }
      ctx.restore();

      const anim = ui.anim && ui.anim.move ? ui.anim : null;
      const flipping = anim && anim.next ? anim.next.flipped || [] : [];
      const placed = anim ? anim.move.at : -1;
      const r = g.cell * 0.4;

      for (let i = 0; i < 64; i++) {
        const v = state.b[i];
        const c = cellCentre(g, i, false);
        const turning = flipping.indexOf(i);

        if (turning >= 0) {
          // the wave travels outwards: each disc starts a beat after the one
          // between it and the piece that was played
          const delay = 0.18 + turning * 0.055;
          const k = Math.max(0, Math.min(1, (anim.t - delay) / 0.34));
          const phase = easeInOut(k);
          const squash = Math.abs(Math.cos(phase * Math.PI));
          const shown = phase < 0.5 ? 3 - v : v;      // the old colour until edge-on
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.scale(Math.max(0.04, squash), 1);
          disc(ctx, 0, 0, r, P.pieces[shown - 1], { lift: 0.7 });
          ctx.restore();
          continue;
        }

        if (!v) continue;
        if (i === placed) {
          const k = easeOut(Math.min(1, anim.t / 0.22));
          ctx.save();
          ctx.globalAlpha = k;
          disc(ctx, c.x, c.y - (1 - k) * g.cell * 0.5, r * (0.7 + k * 0.3), P.pieces[v - 1], { lift: 1 + (1 - k) });
          ctx.restore();
          continue;
        }
        disc(ctx, c.x, c.y, r, P.pieces[v - 1]);
      }

      // where you can play, and how much it would turn: the count is the whole
      // decision in reversi, and it is the one thing a beginner never counts
      if (!ui.result) {
        for (const move of ui.hints || []) {
          const c = cellCentre(g, move.at, false);
          // the disc you would put there, ghosted — and the number of pieces it
          // turns written on it, which is the decision itself and the one thing
          // a beginner never counts
          ctx.save();
          ctx.globalAlpha = 0.34;
          disc(ctx, c.x, c.y, r * 0.82, P.pieces[state.turn], { lift: 0.2 });
          ctx.restore();
          if (move.gain) {
            fitText(ctx, String(move.gain), c.x, c.y, g.cell * 0.5, {
              size: Math.max(11, g.cell * 0.3), weight: 800,
              colour: state.turn === 0 ? 'rgba(28,28,28,0.62)' : 'rgba(255,255,255,0.72)',
            });
          }
        }
      }
    },

    hit: (x, y) => (g ? cellAt(g, x, y, false) : -1),

    pick(state, square, sel, legal) {
      const move = legal.find((m) => m.at === square);
      return move ? { sel: null, move } : { sel: null };
    },

    /** Legal squares, each carrying how many discs it would turn. */
    hints(state, sel, legal) {
      return legal.map((m) => ({ ...m, gain: reversi.apply(state, m).flipped.length }));
    },

    thumb(ctx, w, h) {
      g = grid({ x: 0, y: 0, w, h }, SIZE);
      ctx.drawImage(feltTile(64, 64, P.felt, 12), 0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * g.cell, 0);
        ctx.lineTo(i * g.cell, h);
        ctx.moveTo(0, i * g.cell);
        ctx.lineTo(w, i * g.cell);
        ctx.stroke();
      }
      const r = g.cell * 0.4;
      for (const [i, side] of [[27, 1], [28, 0], [35, 0], [36, 1], [20, 0], [29, 0], [43, 1], [34, 1], [44, 0]]) {
        const c = cellCentre(g, i, false);
        disc(ctx, c.x, c.y, r, P.pieces[side], { lift: 0.5 });
      }
    },
  };
  return view;
}

/** Reversi's seat is a disc count — the score, literally. */
export function reversiSeat(state, colour) {
  const [a, b] = counts(state.b);
  const mine = colour === 0 ? a : b;
  return {
    score: mine,
    extra: (ctx, area) => {
      // a bar showing the share of the board, which reads faster than a number
      const total = a + b || 1;
      const share = mine / total;
      const h = Math.min(12, area.h * 0.4);
      const y = area.y + area.h * 0.5 - h / 2;
      roundRect(ctx, area.x, y, area.w, h, h / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      roundRect(ctx, area.x, y, Math.max(h, area.w * share), h, h / 2);
      ctx.fillStyle = P.pieces[colour].base;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    },
  };
}
