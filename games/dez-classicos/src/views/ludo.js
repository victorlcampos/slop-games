// The ludo board: a cross of coloured squares on a fifteen by fifteen lattice.
//
// The track is written out below rather than generated, because the shape of a
// ludo board is not a formula — it is a specific fifty-two squares that turn
// four corners, and the entries have to land exactly thirteen apart or the four
// colours do not share the board fairly. With the list spelled out, the rules
// module's `entryOf(p) = p * 13` lands on (1,6), (8,1), (13,8) and (6,13),
// which is where every printed board puts them.

import { roundRect, shadow, disc, fitText, easeOut, halo, noise } from '../render/paint.js';
import { conePawn, die } from '../render/pieces.js';
import { PALETTES } from '../theme.js';
import { ludo, TRACK, LANE, HOME, YARD, PIECES, entryOf, ringSquare, SAFE } from '../games/ludo.js';
import { texture, drawFrame } from './board.js';

const P = PALETTES.ludo;
const N = 15;

/** The 52 shared squares, in travel order, as lattice coordinates. */
const TRACK_CELLS = (() => {
  const out = [];
  const run = (fromCol, fromRow, dCol, dRow, n) => {
    for (let i = 0; i < n; i++) out.push([fromCol + dCol * i, fromRow + dRow * i]);
  };
  run(1, 6, 1, 0, 5);
  run(6, 5, 0, -1, 6);
  out.push([7, 0]);
  run(8, 0, 0, 1, 6);
  run(9, 6, 1, 0, 6);
  out.push([14, 7]);
  run(14, 8, -1, 0, 6);
  run(8, 9, 0, 1, 6);
  out.push([7, 14]);
  run(6, 14, 0, -1, 6);
  run(5, 8, -1, 0, 6);
  out.push([0, 7]);
  out.push([0, 6]);
  return out;
})();

/** Each colour's final column: five squares, then the centre. */
const LANE_CELLS = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];

/** The corner each colour waits in. */
const YARDS = [[0, 0], [9, 0], [9, 9], [0, 9]];

export function createLudoView() {
  let g = null;

  const view = {
    id: 'ludo',

    measure(box) {
      const side = Math.min(box.w, box.h) - 24;
      g = { x: box.x + (box.w - side) / 2, y: box.y + (box.h - side) / 2, side, step: side / N };
      g.r = g.step * 0.36;
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      const cell = (col, row) => ({ x: g.x + col * g.step, y: g.y + row * g.step });
      const centre = (col, row) => ({ x: g.x + (col + 0.5) * g.step, y: g.y + (row + 0.5) * g.step });

      drawFrame(ctx, { x: g.x, y: g.y, w: g.side, h: g.side, cell: g.step }, P.frame, { rim: 20, radius: 12, inner: false });

      // the paper the board is printed on
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.side, g.side);
      ctx.clip();
      const paper = ctx.createLinearGradient(g.x, g.y, g.x + g.side, g.y + g.side);
      paper.addColorStop(0, P.board.light);
      paper.addColorStop(1, P.board.dark);
      ctx.fillStyle = paper;
      ctx.fillRect(g.x, g.y, g.side, g.side);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(120,100,70,${noise(i, 1, 2) * 0.05})`;
        ctx.fillRect(g.x + noise(i, 2, 2) * g.side, g.y + noise(i, 3, 2) * g.side, 2, 2);
      }
      ctx.restore();

      // the four yards
      for (let p = 0; p < 4; p++) {
        const [c0, r0] = YARDS[p];
        const box2 = cell(c0, r0);
        ctx.save();
        roundRect(ctx, box2.x, box2.y, g.step * 6, g.step * 6, g.step * 0.5);
        const grad = ctx.createLinearGradient(box2.x, box2.y, box2.x + g.step * 6, box2.y + g.step * 6);
        grad.addColorStop(0, P.colours[p].light);
        grad.addColorStop(1, P.colours[p].dark);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // the white pad inside, with four dips for the waiting pawns
        roundRect(ctx, box2.x + g.step, box2.y + g.step, g.step * 4, g.step * 4, g.step * 0.4);
        ctx.fillStyle = 'rgba(255,252,244,0.92)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        for (let k = 0; k < PIECES; k++) {
          const spot = yardSpot(g, p, k);
          ctx.save();
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, g.r * 0.92, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fill();
          ctx.strokeStyle = P.colours[p].dark;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // the track
      for (let i = 0; i < TRACK; i++) {
        const [col, row] = TRACK_CELLS[i];
        const p = cell(col, row);
        const entry = i % 13 === 0 ? i / 13 : -1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x, p.y, g.step, g.step);
        ctx.fillStyle = entry >= 0 ? P.colours[entry].base : '#fffdf7';
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,75,50,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        // the eight safe squares carry a star, the way a printed board does
        if (SAFE.has(i) && entry < 0) star(ctx, p.x + g.step / 2, p.y + g.step / 2, g.step * 0.3, 'rgba(120,100,60,0.45)');
      }

      // the four final columns and the centre
      for (let p = 0; p < 4; p++) {
        for (const [col, row] of LANE_CELLS[p]) {
          const s = cell(col, row);
          ctx.save();
          ctx.beginPath();
          ctx.rect(s.x, s.y, g.step, g.step);
          ctx.fillStyle = P.colours[p].base;
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(90,75,50,0.5)';
          ctx.stroke();
          ctx.restore();
        }
      }
      // the home triangle: four wedges meeting in the middle
      const mid = cell(6, 6);
      const size = g.step * 3;
      const cx = mid.x + size / 2;
      const cy = mid.y + size / 2;
      for (let p = 0; p < 4; p++) {
        const corners = [
          [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[1, 0], [1, 1]], [[0, 1], [1, 1]],
        ][p];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (const [ax, ay] of corners) ctx.lineTo(mid.x + ax * size, mid.y + ay * size);
        ctx.closePath();
        ctx.fillStyle = P.colours[[0, 1, 2, 3][p]].base;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.stroke();
      }

      const anim = ui.anim && ui.anim.move && !ui.anim.move.pass ? ui.anim : null;

      // the pawns
      for (let p = 0; p < 4; p++) {
        const yardIndex = [];
        state.pawns[p].forEach((step, k) => {
          if (step === YARD) yardIndex.push(k);
        });
        state.pawns[p].forEach((step, k) => {
          if (anim && anim.player === p && anim.move.pawn === k) return;
          const spot = pawnSpot(g, state, p, k, yardIndex.indexOf(k));
          if (!spot) return;
          conePawn(ctx, spot.x, spot.y, g.step * 1.05, P.colours[p]);
        });
      }

      if (anim) {
        const from = spotOf(g, anim.player, anim.move.from, anim.yardSlot || 0);
        const to = spotOf(g, anim.player, anim.move.to, 0);
        if (from && to) {
          const k = easeOut(Math.min(1, anim.t));
          conePawn(ctx, from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * g.step * 0.6,
            g.step * 1.15, P.colours[anim.player]);
        }
      }

      // which pawns can move with this throw
      for (const hint of ui.hints || []) {
        const spot = spotOf(g, state.turn, hint.from, 0);
        const target = spotOf(g, state.turn, hint.to, 0);
        if (spot) halo(ctx, spot.x, spot.y, g.r * 1.15, '#ffffff', { width: 3, blur: 12, alpha: 0.9 });
        if (target) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(target.x, target.y, g.r * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = P.colours[state.turn].base;
          ctx.fill();
          ctx.restore();
        }
      }

      // the die, in the middle of the cross
      if (state.dice && state.dice.length) {
        die(ctx, cx, cy, g.step * 1.5, state.dice[0], { tilt: 0.08 });
      }
    },

    /** Which pawn a tap picked: the nearest one of yours, within a square. */
    hit(x, y, ui = {}) {
      if (!g) return -1;
      const me = ui.side !== undefined ? ui.side : 0;
      let best = -1;
      let bestD = g.step * 0.9;
      const yardIndex = [];
      (ui.state ? ui.state.pawns[me] : []).forEach((step, k) => {
        if (step === YARD) yardIndex.push(k);
      });
      for (let k = 0; k < PIECES; k++) {
        const spot = ui.state ? pawnSpot(g, ui.state, me, k, yardIndex.indexOf(k)) : null;
        if (!spot) continue;
        const d = Math.hypot(spot.x - x, spot.y - y);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      return best;
    },

    pick(state, pawn, sel, legal) {
      const move = legal.find((m) => m.pawn === pawn);
      return move ? { sel: null, move } : { sel: null };
    },

    hints: (state, sel, legal) => legal.filter((m) => !m.pass),

    thumb(ctx, w, h) {
      const state = ludo.setup();
      state.pawns[0][0] = 6;
      state.pawns[1][0] = 20;
      state.pawns[2][1] = 3;
      state.pawns[3][2] = 40;
      state.dice = [6];
      view.draw(ctx, { x: 0, y: 0, w, h }, state, { hints: [] });
    },
  };
  return view;
}

/** Where a pawn stands: the yard, the track, the final column or home. */
function spotOf(g, player, step, slot = 0) {
  if (step === YARD || step === undefined) return yardSpot(g, player, slot);
  if (step >= HOME) {
    const centre = { x: g.x + 7.5 * g.step, y: g.y + 7.5 * g.step };
    const angle = (player / 4) * Math.PI * 2 + Math.PI / 4;
    return { x: centre.x + Math.cos(angle) * g.step * 0.7, y: centre.y + Math.sin(angle) * g.step * 0.7 };
  }
  if (step >= TRACK - 1) {
    const lane = LANE_CELLS[player][Math.min(4, step - (TRACK - 1))];
    return { x: g.x + (lane[0] + 0.5) * g.step, y: g.y + (lane[1] + 0.5) * g.step };
  }
  const square = ringSquare(player, step);
  const [col, row] = TRACK_CELLS[square];
  return { x: g.x + (col + 0.5) * g.step, y: g.y + (row + 0.5) * g.step };
}

function pawnSpot(g, state, player, index, yardSlot) {
  return spotOf(g, player, state.pawns[player][index], Math.max(0, yardSlot));
}

function yardSpot(g, player, slot) {
  const [c0, r0] = YARDS[player];
  const col = c0 + 1.5 + (slot % 2) * 2;
  const row = r0 + 1.5 + Math.floor(slot / 2) * 2;
  return { x: g.x + (col + 0.5) * g.step, y: g.y + (row + 0.5) * g.step };
}

function star(ctx, cx, cy, r, colour) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.restore();
}

/** How far along each of a player's four pawns is. */
export function ludoSeat(state, colour) {
  const home = state.pawns[colour].filter((s) => s >= HOME).length;
  return {
    score: home + '/' + PIECES,
    extra: (ctx, area) => {
      const w = (area.w - 8) / PIECES;
      state.pawns[colour].forEach((step, i) => {
        const x = area.x + 4 + i * w;
        const share = step === YARD ? 0 : Math.min(1, step / HOME);
        const h = Math.min(9, area.h * 0.34);
        const y = area.y + area.h * 0.5 - h / 2;
        roundRect(ctx, x, y, w - 6, h, h / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fill();
        if (share > 0) {
          roundRect(ctx, x, y, Math.max(h, (w - 6) * share), h, h / 2);
          ctx.fillStyle = PALETTES.ludo.colours[colour].base;
          ctx.fill();
        }
      });
    },
  };
}
