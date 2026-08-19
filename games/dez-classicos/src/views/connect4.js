// Four in a row, in the plastic rack everybody had.
//
// The rack is drawn in front of the discs, not behind them: the holes are cut
// out of a translucent blue panel and the pieces sit *inside* it, which is why
// a disc darkens slightly at the rim. Drawing the discs on top instead is the
// giveaway that turns a toy into a spreadsheet with circles.

import { disc, roundRect, shadow, easeBack, halo } from '../render/paint.js';
import { PALETTES, WOOD } from '../theme.js';
import { connect4, COLS, ROWS, dropRow, lineOf } from '../games/connect4.js';
import { drawFrame } from './board.js';

const P = PALETTES.connect4;

export function createConnect4View() {
  let g = null;

  const view = {
    id: 'connect4',

    measure(box) {
      const cell = Math.min((box.w - 40) / COLS, (box.h - 40) / (ROWS + 0.9));
      const w = cell * COLS;
      const h = cell * ROWS;
      g = {
        cell,
        x: box.x + (box.w - w) / 2,
        y: box.y + (box.h - h) / 2 + cell * 0.45,
        w,
        h,
        top: box.y + (box.h - h) / 2 - cell * 0.45,
      };
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      const anim = ui.anim && ui.anim.move ? ui.anim : null;

      // the feet the rack stands in
      shadow(ctx, () => {
        roundRect(ctx, g.x - g.cell * 0.5, g.y + g.h - 6, g.w + g.cell, g.cell * 0.42, 8);
        ctx.fillStyle = WOOD.walnut.base;
        ctx.fill();
      }, { blur: 20, y: 10, colour: 'rgba(0,0,0,0.5)' });

      const discs = [];
      for (let i = 0; i < COLS * ROWS; i++) {
        if (state.b[i]) discs.push({ i, v: state.b[i] });
      }

      // the falling piece, before the rack goes on top of it
      let dropping = null;
      if (anim) {
        const row = Math.floor(anim.move.at !== undefined ? anim.move.at / COLS : dropRow(anim.prev ? anim.prev.b : state.b, anim.move.col));
        const landed = anim.move.col + row * COLS;
        dropping = { col: anim.move.col, row, v: state.b[landed], index: landed };
      }

      for (const d of discs) {
        if (dropping && d.i === dropping.index) continue;
        const col = d.i % COLS;
        const row = Math.floor(d.i / COLS);
        disc(ctx, g.x + (col + 0.5) * g.cell, g.y + (row + 0.5) * g.cell, g.cell * 0.4, P.pieces[d.v - 1], { lift: 0.5 });
      }
      if (dropping) {
        // it falls, and it bounces once — a disc that stops dead reads as a
        // sprite being teleported
        const k = easeBack(Math.min(1, anim.t / 0.75));
        const fromY = g.top - g.cell * 0.5;
        const toY = g.y + (dropping.row + 0.5) * g.cell;
        disc(ctx, g.x + (dropping.col + 0.5) * g.cell, fromY + (toY - fromY) * k, g.cell * 0.4, P.pieces[dropping.v - 1], { lift: 0.8 });
      }

      // the rack itself: one rounded panel with the holes punched out of it
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, g.x - g.cell * 0.22, g.y - g.cell * 0.22, g.w + g.cell * 0.44, g.h + g.cell * 0.44, g.cell * 0.28);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.moveTo(g.x + (c + 0.5) * g.cell + g.cell * 0.42, g.y + (r + 0.5) * g.cell);
          ctx.arc(g.x + (c + 0.5) * g.cell, g.y + (r + 0.5) * g.cell, g.cell * 0.42, 0, Math.PI * 2, true);
        }
      }
      const panel = ctx.createLinearGradient(g.x, g.y, g.x + g.w * 0.5, g.y + g.h);
      panel.addColorStop(0, P.rack.light);
      panel.addColorStop(0.45, P.rack.base);
      panel.addColorStop(1, P.rack.dark);
      ctx.fillStyle = panel;
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // an inner shadow inside every hole, so the disc sits behind the plastic
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cx = g.x + (c + 0.5) * g.cell;
          const cy = g.y + (r + 0.5) * g.cell;
          const ring = ctx.createRadialGradient(cx, cy, g.cell * 0.3, cx, cy, g.cell * 0.44);
          ring.addColorStop(0, 'rgba(0,0,0,0)');
          ring.addColorStop(1, 'rgba(0,0,0,0.4)');
          ctx.beginPath();
          ctx.arc(cx, cy, g.cell * 0.43, 0, Math.PI * 2);
          ctx.fillStyle = ring;
          ctx.fill();
        }
      }

      // the column you are about to drop into
      if (!ui.result) {
        for (const move of ui.hints || []) {
          const cx = g.x + (move.col + 0.5) * g.cell;
          const hover = ui.hover === move.col;
          ctx.save();
          ctx.globalAlpha = hover ? 1 : 0.34;
          disc(ctx, cx, g.top, g.cell * (hover ? 0.36 : 0.26), P.pieces[state.turn], { lift: 0.4 });
          ctx.restore();
        }
      }

      const line = lineOf(state.b);
      if (line) {
        for (const i of line) {
          const cx = g.x + ((i % COLS) + 0.5) * g.cell;
          const cy = g.y + (Math.floor(i / COLS) + 0.5) * g.cell;
          halo(ctx, cx, cy, g.cell * 0.45, '#ffffff', { width: 4, blur: 20, alpha: 0.9 });
        }
      }
    },

    /** A column, from anywhere in it — the whole column is the target, which is
     *  what a finger expects and what the real toy does. */
    hit(x, y) {
      if (!g) return -1;
      if (y < g.top - g.cell || y > g.y + g.h + g.cell) return -1;
      const c = Math.floor((x - g.x) / g.cell);
      return c >= 0 && c < COLS ? c : -1;
    },

    pick(state, col, sel, legal) {
      const move = legal.find((m) => m.col === col);
      return move ? { sel: null, move } : { sel: null };
    },

    hints: (state, sel, legal) => legal,

    thumb(ctx, w, h) {
      view.measure({ x: 0, y: 0, w, h });
      const state = connect4.setup();
      for (const [col, side] of [[3, 0], [3, 1], [2, 1], [4, 0], [3, 0], [2, 0], [4, 1]]) {
        const row = dropRow(state.b, col);
        state.b[row * COLS + col] = side + 1;
      }
      view.draw(ctx, { x: 0, y: 0, w, h }, { ...state, turn: 0 }, { hints: [] });
    },
  };
  return view;
}

export function connect4Seat(state, colour) {
  let n = 0;
  for (const v of state.b) if (v === colour + 1) n++;
  return {
    score: n,
    extra: (ctx, area) => {
      const r = Math.min(area.h * 0.36, area.w / 12);
      for (let i = 0; i < 4; i++) {
        disc(ctx, area.x + r + i * r * 2.3, area.y + area.h * 0.5, r, P.pieces[colour], { lift: 0.3 });
      }
    },
  };
}
