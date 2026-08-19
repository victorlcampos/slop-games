// The two (or four) seats around the table, and the room they leave for the board.
//
// Drawn once here rather than in each of the ten views, because it is the same
// furniture every time: who is playing, which colour they have, what the
// machine's level is, and whatever each game counts — captured pieces in chess,
// discs in reversi, seeds in mancala, pips in backgammon.
//
// The layout has two shapes and the switch between them is the whole reason
// this file measures before it draws. On a monitor the board is square and the
// window is not, so there are three hundred wasted pixels either side: the
// seats go there, as tall panels. On a phone held upright there is no side
// room at all, so they become two thin bars above and below. Same information,
// and no game has to know which shape it is in.

import { roundRect, shadow, fitText, disc } from '../render/paint.js';
import { TABLE } from '../theme.js';

const SIDE_MIN = 210;

/**
 * Where the board goes and where the seats go, for this window.
 * `board` is what the view is handed; it never sees the rest.
 */
export function layout(W, H, { top = 8, bottom = 8, wide = SIDE_MIN, solo = false } = {}) {
  const boardHeight = H - top - bottom;
  const spare = W - boardHeight;
  const sideways = spare >= wide * 2 + 40;

  if (sideways) {
    const panel = Math.min(272, Math.max(wide, (spare - 40) / 2));
    // A panel as tall as half the board is a panel with a hole in it. It is
    // sized to what it holds — a name, a level, a count and a row of captured
    // pieces — and sits at the end of the table where that player is: the
    // human low and to the left, the machine high and to the right, which is
    // where they would be if you were looking down at a real one.
    const tall = Math.min(168, Math.max(96, boardHeight * 0.3));
    return {
      sideways: true,
      // a solo game has nobody on the other side of the table, so the board
      // gets that half of the room rather than staring at an empty panel
      board: solo
        ? { x: panel + 20, y: top, w: W - panel - 40, h: boardHeight }
        : { x: panel + 20, y: top, w: W - panel * 2 - 40, h: boardHeight },
      seats: [
        { x: 14, y: top + boardHeight - tall, w: panel, h: tall },
        { x: W - panel - 14, y: top, w: panel, h: tall },
      ],
    };
  }
  // Upright, the board is square and the window is not, so pinning the two bars
  // to the top and bottom of the screen leaves a band of empty felt above and
  // below the board. The board is measured first and the bars are hung off it,
  // which puts everything in one block in the middle of the phone — where a
  // thumb can reach all of it.
  const bar = Math.min(62, H * 0.09);
  const board = Math.min(W - 16, boardHeight - bar * 2 - 16);
  const blockTop = top + Math.max(0, (boardHeight - board - bar * 2 - 16) / 2);
  return {
    sideways: false,
    board: { x: (W - board) / 2, y: blockTop + bar + 8, w: board, h: board },
    seats: [
      { x: (W - board) / 2, y: blockTop + bar + board + 12, w: board, h: bar - 4 },
      { x: (W - board) / 2, y: blockTop, w: board, h: bar - 4 },
    ],
  };
}

/**
 * One seat. `active` lights it up — knowing whose turn it is has to be readable
 * from across the room, so it is a lit panel and a brass edge rather than a
 * word somebody has to find.
 */
export function drawSeat(ctx, box, seat, { active = false, sideways = true, thinking = 0 } = {}) {
  const r = 12;
  ctx.save();
  shadow(ctx, () => {
    roundRect(ctx, box.x, box.y, box.w, box.h, r);
    ctx.fillStyle = 'rgba(12,18,15,0.72)';
    ctx.fill();
  }, { blur: 18, y: 6, colour: 'rgba(0,0,0,0.5)' });

  roundRect(ctx, box.x, box.y, box.w, box.h, r);
  const g = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  g.addColorStop(0, active ? 'rgba(52,72,60,0.95)' : 'rgba(22,34,29,0.9)');
  g.addColorStop(1, active ? 'rgba(28,46,38,0.95)' : 'rgba(14,22,19,0.9)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = active ? TABLE.brass.base : 'rgba(255,235,200,0.12)';
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();

  // The panel is two bands: identity on top, whatever the game counts below.
  // Splitting it explicitly (rather than stacking things at offsets and hoping)
  // is what keeps the captured pieces from landing under the thinking dots.
  const pad = Math.min(14, box.h * 0.16);
  const head = sideways ? Math.min(56, box.h * 0.42) : box.h;
  const chip = Math.min(sideways ? 22 : 16, head * 0.42);
  const cx = box.x + pad + chip;
  const cy = box.y + (sideways ? pad + chip : box.h / 2);
  if (seat.palette) disc(ctx, cx, cy, chip, seat.palette, { rings: 1, lift: 0.5 });

  const textX = cx + chip + 11;
  const room = box.x + box.w - textX - (seat.score ? 58 : 12);
  fitText(ctx, seat.name, textX, cy - (seat.level ? 8 : 0), room, {
    size: sideways ? 18 : 15, weight: 800, align: 'left', colour: TABLE.ink,
    family: 'ui-sans-serif, system-ui, sans-serif',
  });
  if (seat.level) {
    fitText(ctx, seat.level, textX, cy + 11, room, {
      size: sideways ? 12.5 : 11, weight: 600, align: 'left', colour: TABLE.dim,
      family: 'ui-sans-serif, system-ui, sans-serif',
    });
  }

  if (seat.score !== undefined && seat.score !== null && seat.score !== '') {
    fitText(ctx, String(seat.score), box.x + box.w - 14, cy, box.w * 0.32, {
      size: sideways ? 27 : 20, weight: 800, align: 'right', colour: TABLE.brass.light,
    });
  }

  const band = sideways
    ? { x: box.x + pad, y: box.y + head, w: box.w - pad * 2, h: box.h - head - pad * 0.6 }
    : (() => {
        // the bar shape: the band starts after the name and stops before the
        // score. Advancing `x` without taking the same amount off the width is
        // how the ludo panel lost its fourth pawn off the right-hand edge.
        const bx = textX + Math.min(150, room * 0.45);
        return { x: bx, y: box.y + 6, w: Math.max(0, box.x + box.w - bx - 66), h: box.h - 12 };
      })();

  if (seat.extra && band.h > 8 && band.w > 20) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(band.x, band.y, band.w, band.h);
    ctx.clip();
    seat.extra(ctx, band);
    ctx.restore();
  }

  // "thinking": three dots that fill in — a spinner would be a lie, the search
  // has no idea how far along it is. Bottom right, where it never lands on the
  // content the band is already holding.
  if (thinking > 0) {
    const bx = box.x + box.w - 46;
    const by = box.y + box.h - (sideways ? 14 : box.h / 2);
    for (let i = 0; i < 3; i++) {
      const on = Math.floor(thinking * 3) % 3 === i;
      ctx.beginPath();
      ctx.arc(bx + i * 14, by, on ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = on ? TABLE.brass.light : 'rgba(255,235,200,0.26)';
      ctx.fill();
    }
  }
  ctx.restore();
}
