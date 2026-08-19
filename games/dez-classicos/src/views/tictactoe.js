// Noughts and crosses, cut into slate.
//
// The one game here small enough that the drawing has to carry it: nine squares
// and two symbols is not much to look at, so the board is a slab of slate with
// the grid chiselled into it and the marks go on in chalk — drawn stroke by
// stroke, the way somebody would actually draw them, rather than appearing.

import { roundRect, shadow, easeOut, noise } from '../render/paint.js';
import { PALETTES, WOOD } from '../theme.js';
import { LINES, lineOf } from '../games/tictactoe.js';
import { grid, cellCentre, cellAt, drawFrame, texture } from './board.js';

const P = PALETTES.tictactoe;

export function createTicTacToeView() {
  let g = null;

  const view = {
    id: 'tictactoe',

    measure(box) {
      const side = Math.min(box.w, box.h) * 0.88;
      g = grid({ x: box.x + (box.w - side) / 2, y: box.y + (box.h - side) / 2, w: side, h: side }, 3);
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      drawFrame(ctx, g, WOOD.walnut, { rim: 26, radius: 14 });

      // the slate
      ctx.save();
      roundRect(ctx, g.x, g.y, g.w, g.h, 6);
      ctx.clip();
      const slab = ctx.createLinearGradient(g.x, g.y, g.x + g.w * 0.6, g.y + g.h);
      slab.addColorStop(0, P.slate.light);
      slab.addColorStop(0.5, P.slate.base);
      slab.addColorStop(1, P.slate.dark);
      ctx.fillStyle = slab;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      // grain: slate is layered, so the speckle runs in bands
      for (let i = 0; i < 220; i++) {
        const x = g.x + noise(i, 1, 3) * g.w;
        const y = g.y + noise(i, 2, 3) * g.h;
        ctx.fillStyle = `rgba(${noise(i, 3, 3) > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + noise(i, 4, 3) * 0.05})`;
        ctx.fillRect(x, y, noise(i, 5, 3) * 26 + 4, 1.4);
      }
      ctx.restore();

      // the grid, chiselled: a dark groove with a lit lip below it
      const line = (i) => {
        ctx.beginPath();
        ctx.moveTo(g.x + g.cell * i, g.y + 8);
        ctx.lineTo(g.x + g.cell * i, g.y + g.h - 8);
        ctx.moveTo(g.x + 8, g.y + g.cell * i);
        ctx.lineTo(g.x + g.w - 8, g.y + g.cell * i);
      };
      for (const i of [1, 2]) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = Math.max(3, g.cell * 0.045);
        ctx.translate(0, 2);
        line(i);
        ctx.stroke();
        ctx.translate(0, -2);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        line(i);
        ctx.stroke();
        ctx.restore();
      }

      const anim = ui.anim && ui.anim.move ? ui.anim : null;
      for (let i = 0; i < 9; i++) {
        const cell = state.b[i];
        if (!cell) continue;
        const c = cellCentre(g, i, false);
        const drawn = anim && anim.move.at === i ? easeOut(anim.t) : 1;
        chalkMark(ctx, cell - 1, c.x, c.y, g.cell * 0.62, drawn, i);
      }

      // Where you may play. It was a faint version of the mark itself, and on a
      // screenshot that read as a move already made — a ghost nought is still a
      // nought. A chalk dot says "free square" and cannot be mistaken for play.
      if (!ui.result) {
        for (const move of ui.hints || []) {
          const c = cellCentre(g, move.at, false);
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(c.x, c.y, g.cell * 0.055, 0, Math.PI * 2);
          ctx.fillStyle = P.chalk;
          ctx.fill();
          ctx.restore();
        }
      }

      const winning = lineOf(state.b);
      if (winning) {
        const a = cellCentre(g, winning[0], false);
        const b = cellCentre(g, winning[2], false);
        const t = ui.result ? easeOut(Math.min(1, (ui.sinceEnd || 1) * 2)) : 1;
        ctx.save();
        ctx.strokeStyle = P.accent;
        ctx.lineCap = 'round';
        ctx.lineWidth = g.cell * 0.09;
        ctx.shadowColor = P.accent;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        ctx.stroke();
        ctx.restore();
      }
    },

    hit: (x, y) => (g ? cellAt(g, x, y, false) : -1),

    pick(state, square, sel, legal) {
      const move = legal.find((m) => m.at === square);
      return move ? { sel: null, move } : { sel: null };
    },

    hints: (state, sel, legal) => legal,

    thumb(ctx, w, h) {
      g = grid({ x: 0, y: 0, w, h }, 3);
      const slab = ctx.createLinearGradient(0, 0, w, h);
      slab.addColorStop(0, P.slate.light);
      slab.addColorStop(1, P.slate.dark);
      ctx.fillStyle = slab;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = Math.max(2, w * 0.016);
      for (const i of [1, 2]) {
        ctx.beginPath();
        ctx.moveTo(g.cell * i, 6);
        ctx.lineTo(g.cell * i, h - 6);
        ctx.moveTo(6, g.cell * i);
        ctx.lineTo(w - 6, g.cell * i);
        ctx.stroke();
      }
      for (const [i, side] of [[0, 0], [4, 1], [8, 0], [2, 1], [6, 0]]) {
        const c = cellCentre(g, i, false);
        chalkMark(ctx, side, c.x, c.y, g.cell * 0.6, 1, i);
      }
    },
  };
  return view;
}

/**
 * A chalk cross or nought, drawn `progress` of the way.
 *
 * Chalk is three strokes of the same line with a jitter: one wide and faint,
 * one narrow and bright, one dusty. That is what a stick of chalk leaves on
 * slate, and a single clean stroke reads as vector art.
 */
function chalkMark(ctx, side, cx, cy, size, progress, seed = 0) {
  const colour = P.marks[side];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const passes = [
    { w: size * 0.2, a: 0.16, o: 1.6 },
    { w: size * 0.12, a: 0.95, o: 0 },
    { w: size * 0.05, a: 0.35, o: -1.4 },
  ];

  for (const pass of passes) {
    ctx.globalAlpha = pass.a;
    ctx.strokeStyle = colour;
    ctx.lineWidth = pass.w;
    ctx.beginPath();
    if (side === 0) {
      const r = size * 0.5;
      const jitter = (k) => (noise(seed, k, 7) - 0.5) * size * 0.06;
      // a hand-drawn cross: two strokes, and the second starts only when the
      // first has finished
      const first = Math.min(1, progress * 2);
      const second = Math.max(0, progress * 2 - 1);
      if (first > 0) {
        ctx.moveTo(cx - r + jitter(1) + pass.o, cy - r + jitter(2));
        ctx.lineTo(cx - r + 2 * r * first + jitter(3) + pass.o, cy - r + 2 * r * first + jitter(4));
      }
      if (second > 0) {
        ctx.moveTo(cx + r + jitter(5) + pass.o, cy - r + jitter(6));
        ctx.lineTo(cx + r - 2 * r * second + jitter(7) + pass.o, cy - r + 2 * r * second + jitter(8));
      }
    } else {
      const r = size * 0.46;
      const from = -Math.PI * 0.55;
      // a circle drawn by hand does not close cleanly, and it wobbles
      const steps = 40;
      for (let i = 0; i <= steps * progress; i++) {
        const a = from + (i / steps) * Math.PI * 2.06;
        const wobble = 1 + (noise(seed, i, 11) - 0.5) * 0.07;
        const x = cx + Math.cos(a) * r * wobble + pass.o;
        const y = cy + Math.sin(a) * r * wobble * 0.98;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function tictactoeSeat(state, colour) {
  return {
    extra: (ctx, area) => {
      const size = Math.min(area.h * 0.8, 32);
      chalkMark(ctx, colour, area.x + size * 0.6, area.y + area.h * 0.5, size, 1, colour + 3);
    },
  };
}
