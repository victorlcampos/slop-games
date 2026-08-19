// The chess table.
//
// Everything the player is told is told on the board: the last move stays lit,
// the piece you picked up glows, where it can go is a dot (or a ring, if
// something is standing there), and a king in check sits in a red pool. None of
// that is decoration — it is the difference between a board you can play
// quickly and one you have to squint at.

import { chessPiece } from '../render/pieces.js';
import { easeOut, easeBack, halo, fitText } from '../render/paint.js';
import { PALETTES } from '../theme.js';
import { chess, colorOf, typeOf, squareName, inCheck, kingSquare, VALUE } from '../games/chess.js';
import { grid, cellCentre, cellAt, drawFrame, drawSquares, drawCoords, markSquare } from './board.js';

const P = PALETTES.chess;

export function createChessView() {
  let g = null;

  const view = {
    id: 'chess',

    /** The view is handed a box, not the window: who else is on the table and
     *  how much room they took is the match's business (see seats.js). */
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

      const anim = ui.anim && ui.anim.move && ui.anim.move.from !== undefined ? ui.anim : null;
      const t = anim ? easeOut(anim.t) : 1;

      // the last move, so you can see what the machine just did
      const last = state.last;
      if (last && last.from !== undefined && (!anim || anim.t >= 1)) {
        for (const square of [last.from, last.to]) {
          markSquare(ctx, g, square, flip, 'rgba(232,182,76,0.28)', { style: 'fill' });
        }
      }

      if (ui.sel !== null && ui.sel !== undefined && ui.sel >= 0) {
        markSquare(ctx, g, ui.sel, flip, 'rgba(232,182,76,0.45)', { style: 'fill' });
      }

      // a king in check gets a pool of red under it, not a border: a border on
      // the square competes with the selection, and this has to win
      const checked = inCheck(state) ? kingSquare(state.b, state.turn) : -1;
      if (checked >= 0) {
        const c = cellCentre(g, checked, flip);
        const pool = ctx.createRadialGradient(c.x, c.y, g.cell * 0.1, c.x, c.y, g.cell * 0.62);
        pool.addColorStop(0, 'rgba(224,82,60,0.75)');
        pool.addColorStop(1, 'rgba(224,82,60,0)');
        ctx.fillStyle = pool;
        ctx.fillRect(c.x - g.cell, c.y - g.cell, g.cell * 2, g.cell * 2);
      }

      const moving = anim ? anim.move : null;
      for (let i = 0; i < 64; i++) {
        const v = state.b[i];
        if (!v) continue;
        // the piece that is travelling is drawn last, on top of everything
        if (moving && i === moving.to) continue;
        const c = cellCentre(g, i, flip);
        chessPiece(ctx, typeOf(v), c.x, c.y, g.cell * 0.86, P.pieces[colorOf(v)], {
          facing: colorOf(v) === 0 ? 1 : -1,
        });
      }

      // where the selected piece may go
      for (const move of ui.hints || []) {
        const style = state.b[move.to] || move.ep !== undefined ? 'target' : 'dot';
        markSquare(ctx, g, move.to, flip, 'rgba(20,16,10,0.42)', { style });
        markSquare(ctx, g, move.to, flip, 'rgba(255,236,190,0.5)', { style, alpha: 0.5 });
      }

      if (moving) {
        const from = cellCentre(g, moving.from, flip);
        const to = cellCentre(g, moving.to, flip);
        const v = state.b[moving.to];
        if (v) {
          // a captured piece fades out under the one taking it
          if (moving.cap && anim.t < 0.85) {
            const dying = P.pieces[1 - colorOf(v)];
            ctx.save();
            ctx.globalAlpha = 1 - anim.t / 0.85;
            chessPiece(ctx, typeOf(moving.cap), to.x, to.y, g.cell * 0.86, dying, {
              facing: colorOf(v) === 0 ? -1 : 1,
            });
            ctx.restore();
          }
          const lift = Math.sin(Math.PI * anim.t) * g.cell * 0.12;
          chessPiece(
            ctx,
            typeOf(v),
            from.x + (to.x - from.x) * t,
            from.y + (to.y - from.y) * t - lift,
            g.cell * (0.86 + Math.sin(Math.PI * anim.t) * 0.06),
            P.pieces[colorOf(v)],
            { facing: colorOf(v) === 0 ? 1 : -1 }
          );
        }
      }

      if (ui.result) drawEnd(ctx, g, state, ui);
    },

    /** Which square, or -1. */
    hit(x, y, ui = {}) {
      return g ? cellAt(g, x, y, !!ui.flip) : -1;
    },

    /**
     * The selection machine. Chess is the fussiest of the ten because of
     * promotion: the move is not decided by the two squares alone, so a pawn
     * arriving on the last rank comes back as a *choice* rather than a move,
     * and the match asks the player which piece.
     */
    pick(state, square, sel, legal) {
      if (square < 0) return { sel };
      const mine = state.b[square] && colorOf(state.b[square]) === state.turn;
      if (sel === null || sel === undefined || sel < 0) {
        return mine ? { sel: square } : { sel: null };
      }
      const options = legal.filter((m) => m.from === sel && m.to === square);
      if (!options.length) {
        // tapping another of your own pieces picks that one up instead of
        // "failing" — it is what everybody expects and it saves a tap
        return mine ? { sel: square } : { sel: null };
      }
      if (options.length > 1 && options[0].promo) return { sel: null, promote: options };
      return { sel: null, move: options[0] };
    },

    /** Where the selected piece can go. */
    hints(state, sel, legal) {
      if (sel === null || sel === undefined || sel < 0) return [];
      return legal.filter((m) => m.from === sel);
    },

    /** The little board on the lobby card. */
    thumb(ctx, w, h) {
      g = grid({ x: 0, y: 0, w, h }, 8);
      drawSquares(ctx, g, P.light, P.dark);
      // a handful of pieces rather than a full set: at this size a full board
      // is a grey smudge, and what a card has to say is "this is chess"
      for (const [square, piece] of [[60, 6], [58, 5], [51, 1], [43, 2], [12, 9], [3, 13], [19, 10]]) {
        const c = cellCentre(g, square, false);
        chessPiece(ctx, typeOf(piece), c.x, c.y, g.cell * 0.95, P.pieces[colorOf(piece)], {
          facing: colorOf(piece) === 0 ? 1 : -1,
        });
      }
    },

    /** Read out for the move list in the HUD. */
    notation(state, move) {
      const piece = typeOf(state.b[move.from]);
      const names = { 1: '', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
      if (move.castle) return move.castle === 'k' ? 'O-O' : 'O-O-O';
      const takes = move.cap ? 'x' : '';
      const from = piece === 1 && move.cap ? squareName(move.from)[0] : '';
      const promo = move.promo ? '=' + names[move.promo] : '';
      return names[piece] + from + takes + squareName(move.to) + promo;
    },
  };

  return view;
}

/**
 * What each seat shows: the pieces that side has lost, and how far ahead it is.
 *
 * It lives in the seat panel rather than in a tray beside the board, and that
 * is not only tidiness — a tray has to fit in whatever margin the board left,
 * and on a phone there is no margin. The panel is already sized for content.
 */
export function chessSeat(state, colour) {
  const alive = {};
  const value = [0, 0];
  for (const v of state.b) {
    if (!v) continue;
    const type = typeOf(v);
    const side = colorOf(v);
    if (side === colour) alive[type] = (alive[type] || 0) + 1;
    value[side] += VALUE[type];
  }
  const START = { 5: 1, 4: 2, 3: 2, 2: 2, 1: 8 };
  const lost = [];
  for (const type of [5, 4, 3, 2, 1]) {
    const gone = START[type] - (alive[type] || 0);
    for (let n = 0; n < gone; n++) lost.push(Number(type));
  }
  const lead = value[colour] - value[1 - colour];

  return {
    score: lead > 0 ? '+' + Math.round(lead / 100) : '',
    extra: (ctx, area) => {
      if (!lost.length) return;
      // sized so the whole row fits: a captured-piece tray that scrolls, or
      // clips, is a tray that lies about the material count
      const size = Math.min(area.h * 0.86, (area.w - 6) / Math.max(4, lost.length * 0.58 + 0.5));
      let x = area.x + size * 0.34;
      const y = area.y + area.h * 0.5;
      for (const type of lost) {
        chessPiece(ctx, type, x, y, size, P.pieces[colour], { facing: 1, alpha: 0.92 });
        x += size * 0.58;
      }
    },
  };
}

function drawEnd(ctx, g, state, ui) {
  const over = ui.result;
  if (over.reason !== 'checkmate') return;
  const square = kingSquare(state.b, state.turn);
  const c = cellCentre(g, square, !!ui.flip);
  halo(ctx, c.x, c.y, g.cell * 0.48, '#e0523c', { width: 4, blur: 22 });
}
