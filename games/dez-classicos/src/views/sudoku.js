// The sudoku sheet: paper on a wooden desk, ruled in ink.
//
// The one board here with no opponent, so everything the drawing does is for
// the person solving it. Three of those are worth naming, because each one
// removes a class of mistake rather than decorating:
//
//   * the peer highlight — the row, column and box of the selected square are
//     tinted, which is the exact set of cells a digit has to avoid;
//   * the same-digit highlight — every square already holding the digit you
//     have selected glows, which turns "where can this 7 go" into something you
//     can see rather than scan for;
//   * a wrong digit is written in red **and** left on the board. Bouncing it
//     would hide the mistake; the point is to notice it.

import { roundRect, shadow, fitText, marbleTile, easeOut } from '../render/paint.js';
import { PALETTES } from '../theme.js';
import { sudoku, UNITS } from '../games/sudoku.js';
import { drawFrame, texture } from './board.js';

const P = PALETTES.sudoku;

export function createSudokuView() {
  let g = null;
  let pad = null;

  const view = {
    id: 'sudoku',

    measure(box) {
      // the keypad lives under the grid on a phone and beside it on a monitor
      const beside = box.w > box.h * 1.25;
      const room = beside ? { w: box.w * 0.68, h: box.h } : { w: box.w, h: box.h * 0.78 };
      const side = Math.min(room.w - 24, room.h - 24);
      const x = box.x + (beside ? 8 : (box.w - side) / 2);
      const y = box.y + (beside ? (box.h - side) / 2 : 8);
      g = { x, y, side, cell: side / 9 };
      pad = beside
        ? { x: x + side + 22, y: y + side * 0.08, w: Math.min(box.w - side - 40, side * 0.42), h: side * 0.84, cols: 3 }
        // eleven keys under the grid: six and five, rather than five-five-one
        // with a lone pencil hanging off the bottom
        : { x: box.x + (box.w - side) / 2, y: y + side + 14, w: side, h: box.h - side - 26, cols: 6 };
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      drawFrame(ctx, { x: g.x, y: g.y, w: g.side, h: g.side, cell: g.cell }, P.frame, { rim: 16, radius: 8, inner: false });

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.side, g.side);
      ctx.clip();
      ctx.drawImage(texture('paper', Math.round(g.side), Math.round(g.side), P.paper, {}), g.x, g.y);
      ctx.restore();

      const sel = ui.sel;
      const conflicts = ui.conflicts || new Set();
      const selValue = sel !== null && sel !== undefined && sel >= 0 ? state.grid[sel] : 0;

      // the three highlights, palest first
      if (sel !== null && sel !== undefined && sel >= 0) {
        const peers = new Set();
        for (const unit of UNITS) if (unit.includes(sel)) for (const i of unit) peers.add(i);
        for (const i of peers) {
          if (i === sel) continue;
          paint(ctx, g, i, 'rgba(63,127,191,0.09)');
        }
        if (selValue) {
          for (let i = 0; i < 81; i++) {
            if (state.grid[i] === selValue && i !== sel) paint(ctx, g, i, 'rgba(63,127,191,0.2)');
          }
        }
        paint(ctx, g, sel, 'rgba(63,127,191,0.26)');
      }
      for (const i of conflicts) paint(ctx, g, i, 'rgba(201,64,47,0.22)');

      // the rules: thin between cells, thick between boxes
      ctx.save();
      for (let i = 0; i <= 9; i++) {
        const heavy = i % 3 === 0;
        ctx.strokeStyle = heavy ? 'rgba(43,36,25,0.75)' : 'rgba(43,36,25,0.24)';
        ctx.lineWidth = heavy ? Math.max(2, g.cell * 0.055) : 1;
        ctx.beginPath();
        ctx.moveTo(g.x + i * g.cell, g.y);
        ctx.lineTo(g.x + i * g.cell, g.y + g.side);
        ctx.moveTo(g.x, g.y + i * g.cell);
        ctx.lineTo(g.x + g.side, g.y + i * g.cell);
        ctx.stroke();
      }
      ctx.restore();

      // the digits
      for (let i = 0; i < 81; i++) {
        const x = g.x + (i % 9 + 0.5) * g.cell;
        const y = g.y + (Math.floor(i / 9) + 0.5) * g.cell;
        const value = state.grid[i];
        if (value) {
          const given = !!state.puzzle[i];
          const wrong = !given && value !== state.solution[i];
          const fresh = ui.anim && ui.anim.move && ui.anim.move.at === i ? easeOut(Math.min(1, ui.anim.t * 2)) : 1;
          ctx.save();
          ctx.globalAlpha = 0.25 + fresh * 0.75;
          fitText(ctx, String(value), x, y + g.cell * 0.03, g.cell * 0.9, {
            size: g.cell * (given ? 0.62 : 0.58) * (0.7 + fresh * 0.3),
            weight: given ? 800 : 600,
            colour: wrong ? P.wrong : given ? P.given : P.accent,
            family: given ? 'ui-serif, Georgia, serif' : 'ui-sans-serif, system-ui, sans-serif',
          });
          ctx.restore();
          continue;
        }
        // pencil marks, in their own little three by three
        const notes = state.notes[i];
        if (!notes) continue;
        for (let v = 1; v <= 9; v++) {
          if (!(notes & (1 << (v - 1)))) continue;
          const nx = x + ((v - 1) % 3 - 1) * g.cell * 0.29;
          const ny = y + (Math.floor((v - 1) / 3) - 1) * g.cell * 0.29;
          fitText(ctx, String(v), nx, ny, g.cell * 0.3, {
            size: g.cell * 0.24, weight: 600, colour: P.pencil,
            family: 'ui-sans-serif, system-ui, sans-serif',
          });
        }
      }

      if (ui.hint) {
        const x = g.x + (ui.hint.at % 9 + 0.5) * g.cell;
        const y = g.y + (Math.floor(ui.hint.at / 9) + 0.5) * g.cell;
        ctx.save();
        ctx.strokeStyle = P.solved;
        ctx.lineWidth = 3;
        ctx.shadowColor = P.solved;
        ctx.shadowBlur = 14;
        ctx.strokeRect(x - g.cell / 2 + 2, y - g.cell / 2 + 2, g.cell - 4, g.cell - 4);
        ctx.restore();
      }

      drawPad(ctx, pad, state, ui);
    },

    /** A square, a keypad button (`{ key }`), or nothing. */
    hit(x, y) {
      if (!g) return null;
      if (x >= g.x && x < g.x + g.side && y >= g.y && y < g.y + g.side) {
        const c = Math.floor((x - g.x) / g.cell);
        const r = Math.floor((y - g.y) / g.cell);
        return r * 9 + c;
      }
      const key = padHit(pad, x, y);
      return key === null ? null : { key };
    },

    /** The keypad's buttons, so the match can drive them from the keyboard too. */
    keys: () => padKeys(pad),

    // Sudoku has no opponent and no move list, but it still answers the two
    // questions every view is asked — the match draws every board through the
    // same three calls, and a view that quietly lacks one of them takes the
    // whole frame down. (It did: `view.hints is not a function`, once per
    // frame, on the only board that had no reason to implement it.)
    pick: (state, target) => ({ sel: typeof target === 'number' ? target : null }),
    hints: () => [],

    thumb(ctx, w, h) {
      const side = Math.min(w, h);
      g = { x: (w - side) / 2, y: (h - side) / 2, side, cell: side / 9 };
      ctx.drawImage(marbleTile(Math.round(w), Math.round(h), P.paper), 0, 0, w, h);
      for (let i = 0; i <= 9; i++) {
        const heavy = i % 3 === 0;
        ctx.strokeStyle = heavy ? 'rgba(43,36,25,0.7)' : 'rgba(43,36,25,0.2)';
        ctx.lineWidth = heavy ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(g.x + i * g.cell, g.y);
        ctx.lineTo(g.x + i * g.cell, g.y + side);
        ctx.moveTo(g.x, g.y + i * g.cell);
        ctx.lineTo(g.x + side, g.y + i * g.cell);
        ctx.stroke();
      }
      const digits = [[0, 5], [4, 3], [8, 9], [10, 7], [20, 1], [30, 8], [40, 4], [50, 2], [60, 6], [70, 9], [76, 3], [13, 2], [27, 7]];
      for (const [i, v] of digits) {
        fitText(ctx, String(v), g.x + (i % 9 + 0.5) * g.cell, g.y + (Math.floor(i / 9) + 0.5) * g.cell, g.cell, {
          size: g.cell * 0.66, weight: 800, colour: P.given,
        });
      }
    },
  };
  return view;
}

function paint(ctx, g, i, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(g.x + (i % 9) * g.cell, g.y + Math.floor(i / 9) * g.cell, g.cell, g.cell);
}

/** The nine digits, the rubber and the pencil, as one grid of keys. */
function padKeys(pad) {
  if (!pad) return [];
  const keys = [...'123456789', 'x', 'note'];
  const rows = Math.ceil(keys.length / pad.cols);
  const w = pad.w / pad.cols;
  const h = Math.min(pad.h / rows, w * 1.15);
  return keys.map((key, i) => ({
    key,
    x: pad.x + (i % pad.cols) * w,
    y: pad.y + Math.floor(i / pad.cols) * h,
    w: w - 5,
    h: h - 5,
  }));
}

function padHit(pad, x, y) {
  for (const k of padKeys(pad)) {
    if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) return k.key;
  }
  return null;
}

function drawPad(ctx, pad, state, ui) {
  if (!pad) return;
  // how many of each digit are still missing — a digit that is done is a digit
  // you can stop looking for
  const left = new Array(10).fill(9);
  for (const v of state.grid) if (v) left[v]--;

  for (const k of padKeys(pad)) {
    const done = k.key >= '1' && k.key <= '9' && left[Number(k.key)] <= 0;
    const active = ui.pencil && k.key === 'note';
    ctx.save();
    shadow(ctx, () => {
      roundRect(ctx, k.x, k.y, k.w, k.h, Math.min(10, k.h * 0.24));
      ctx.fillStyle = 'rgba(20,16,10,0.5)';
      ctx.fill();
    }, { blur: 8, y: 3, colour: 'rgba(0,0,0,0.4)' });
    roundRect(ctx, k.x, k.y, k.w, k.h, Math.min(10, k.h * 0.24));
    const grad = ctx.createLinearGradient(k.x, k.y, k.x, k.y + k.h);
    grad.addColorStop(0, active ? '#5b93c9' : done ? 'rgba(210,200,180,0.35)' : P.paper.light);
    grad.addColorStop(1, active ? '#2f6ba3' : done ? 'rgba(180,170,150,0.35)' : P.paper.dark);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,36,25,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const label = k.key === 'x' ? '⌫' : k.key === 'note' ? '✎' : k.key;
    fitText(ctx, label, k.x + k.w / 2, k.y + k.h / 2, k.w * 0.8, {
      size: k.h * 0.5, weight: 700,
      colour: active ? '#ffffff' : done ? 'rgba(43,36,25,0.35)' : P.ink,
      family: 'ui-serif, Georgia, serif',
    });
    if (k.key >= '1' && k.key <= '9' && left[Number(k.key)] > 0) {
      fitText(ctx, String(left[Number(k.key)]), k.x + k.w - 8, k.y + 10, 20, {
        size: Math.max(9, k.h * 0.2), weight: 700, colour: 'rgba(43,36,25,0.45)', align: 'right',
        family: 'ui-sans-serif, system-ui, sans-serif',
      });
    }
    ctx.restore();
  }
}

/** The seat panel for a game with one player: progress and mistakes. */
export function sudokuSeat(state) {
  const filled = state.grid.filter(Boolean).length;
  return {
    score: Math.round((filled / 81) * 100) + '%',
    extra: (ctx, area) => {
      const h = Math.min(10, area.h * 0.32);
      const y = area.y + area.h * 0.5 - h / 2;
      roundRect(ctx, area.x, y, area.w, h, h / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fill();
      roundRect(ctx, area.x, y, Math.max(h, area.w * (filled / 81)), h, h / 2);
      ctx.fillStyle = P.accent;
      ctx.fill();
    },
  };
}
