// The draughts table.
//
// Brazilian draughts is a capturing game, and the board has to say so: every
// jump in the chosen line is drawn as a hop, the pieces it takes stay on the
// board until the whole chain lands, and the compulsory capture is shown by
// simply not offering anything else. A player who has been told "you must
// capture" by a popup has been told; a player who sees only capture targets
// light up has understood.

import { disc, easeOut, halo } from '../render/paint.js';
import { draughtsCrown } from '../render/pieces.js';
import { PALETTES } from '../theme.js';
import { checkers, ownerOf, isKing, census } from '../games/checkers.js';
import { grid, cellCentre, cellAt, drawFrame, drawSquares, drawCoords, markSquare } from './board.js';

const P = PALETTES.checkers;

export function createCheckersView() {
  let g = null;

  const view = {
    id: 'checkers',

    measure(box) {
      g = grid({ x: box.x + 20, y: box.y + 20, w: box.w - 40, h: box.h - 40 }, 8);
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      const flip = !!ui.flip;
      view.measure(box);
      drawFrame(ctx, g, P.frame);
      drawSquares(ctx, g, P.light, P.dark);
      drawCoords(ctx, g, flip);

      const anim = ui.anim && ui.anim.move && ui.anim.move.path ? ui.anim : null;
      const moving = anim ? anim.move : null;

      if (state.last && state.last.path && !anim) {
        for (const square of [state.last.path[0], state.last.path[state.last.path.length - 1]]) {
          markSquare(ctx, g, square, flip, 'rgba(232,182,76,0.3)', { style: 'fill' });
        }
      }
      if (ui.sel !== null && ui.sel !== undefined && ui.sel >= 0) {
        markSquare(ctx, g, ui.sel, flip, 'rgba(232,182,76,0.45)', { style: 'fill' });
      }

      const r = g.cell * 0.38;
      for (let i = 0; i < 64; i++) {
        const v = state.b[i];
        if (!v) continue;
        if (moving && i === moving.path[moving.path.length - 1]) continue;
        const owner = ownerOf(v);
        const c = cellCentre(g, i, flip);
        // a piece already taken this move stays on the board, greying out as
        // the chain runs over it — it is what makes a triple capture readable
        const doomed = moving && moving.caps.includes(i);
        ctx.save();
        if (doomed) ctx.globalAlpha = Math.max(0, 1 - anim.t * 1.6);
        disc(ctx, c.x, c.y, r, P.pieces[owner], { rings: 2 });
        if (isKing(v)) draughtsCrown(ctx, c.x, c.y, r * 0.62, P.pieces[owner]);
        ctx.restore();
      }

      for (const move of ui.hints || []) {
        const to = move.path[move.path.length - 1];
        markSquare(ctx, g, to, flip, move.caps.length ? 'rgba(224,82,60,0.85)' : 'rgba(20,16,10,0.42)', {
          style: move.caps.length ? 'target' : 'dot',
        });
        // the pieces this line would take, ringed, so a player can compare two
        // captures before committing to one
        for (const cap of move.caps) markSquare(ctx, g, cap, flip, 'rgba(224,82,60,0.5)', { style: 'ring' });
      }

      if (moving) {
        // hop from square to square along the path, not in a straight line to
        // the end: a five-piece capture drawn as one slide is unreadable
        const legs = moving.path.length - 1;
        const at = Math.min(legs - 0.0001, anim.t * legs);
        const leg = Math.floor(at);
        const k = easeOut(at - leg);
        const a = cellCentre(g, moving.path[leg], flip);
        const b = cellCentre(g, moving.path[leg + 1], flip);
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k - Math.sin(Math.PI * (at - leg)) * g.cell * (moving.caps.length ? 0.34 : 0.12);
        const v = state.b[moving.path[moving.path.length - 1]];
        const owner = ownerOf(v);
        disc(ctx, x, y, r * 1.04, P.pieces[owner], { rings: 2, lift: 1.6 });
        if (isKing(v)) draughtsCrown(ctx, x, y, r * 0.62, P.pieces[owner]);
      }

      if (ui.result && ui.result.winner !== null && ui.result.winner !== undefined) {
        for (let i = 0; i < 64; i++) {
          if (ownerOf(state.b[i]) !== ui.result.winner) continue;
          const c = cellCentre(g, i, flip);
          halo(ctx, c.x, c.y, r * 1.1, P.accent, { width: 3, blur: 16, alpha: 0.7 });
        }
      }
    },

    hit: (x, y, ui = {}) => (g ? cellAt(g, x, y, !!ui.flip) : -1),

    /**
     * Picking a move. Two things are deliberate here:
     *
     *   * only pieces that have a legal move can be picked up, which under the
     *     compulsory-capture rule means only the ones that must capture;
     *   * a chain is chosen by its **last** square. Two chains that end on the
     *     same square take the same number of pieces (the maximum rule saw to
     *     that), so the first is as good as the second — and asking a player to
     *     click five squares to spell out a forced sequence is a worse game.
     */
    pick(state, square, sel, legal) {
      if (square < 0) return { sel };
      const owns = ownerOf(state.b[square]) === state.turn;
      if (sel === null || sel === undefined || sel < 0) {
        return owns && legal.some((m) => m.path[0] === square) ? { sel: square } : { sel: null };
      }
      const move = legal.find((m) => m.path[0] === sel && m.path[m.path.length - 1] === square);
      if (move) return { sel: null, move };
      return owns && legal.some((m) => m.path[0] === square) ? { sel: square } : { sel: null };
    },

    hints: (state, sel, legal) =>
      sel === null || sel === undefined || sel < 0 ? [] : legal.filter((m) => m.path[0] === sel),

    thumb(ctx, w, h) {
      g = grid({ x: 0, y: 0, w, h }, 8);
      drawSquares(ctx, g, P.light, P.dark);
      const r = g.cell * 0.38;
      for (const [i, side, king] of [[17, 1, false], [26, 0, false], [35, 1, false], [44, 0, true], [53, 0, false], [8, 1, true]]) {
        const c = cellCentre(g, i, false);
        disc(ctx, c.x, c.y, r, P.pieces[side], { rings: 2 });
        if (king) draughtsCrown(ctx, c.x, c.y, r * 0.62, P.pieces[side]);
      }
    },
  };
  return view;
}

/** The seat shows what is left, not what was taken: in draughts the count that
 *  matters is how many pieces you still have, and whether any is a king. */
export function checkersSeat(state, colour) {
  const [a, b] = census(state.b);
  const mine = colour === 0 ? a : b;
  return {
    score: mine.men + mine.kings,
    extra: (ctx, area) => {
      const total = mine.men + mine.kings;
      if (!total) return;
      // sized so all twelve fit: the row is the count, and a row that runs off
      // the panel is a count that lies
      const r = Math.min(area.h * 0.42, (area.w - 6) / (total * 2.2 + 0.4));
      let x = area.x + r + 2;
      const y = area.y + area.h * 0.5;
      for (let i = 0; i < mine.kings; i++) {
        disc(ctx, x, y, r, P.pieces[colour], { rings: 1, lift: 0.4 });
        draughtsCrown(ctx, x, y, r * 0.62, P.pieces[colour]);
        x += r * 2.2;
      }
      for (let i = 0; i < mine.men; i++) {
        disc(ctx, x, y, r, P.pieces[colour], { rings: 1, lift: 0.4 });
        x += r * 2.2;
      }
    },
  };
}
