// The backgammon board: two halves, twenty-four points, a bar down the middle
// and a tray at the side.
//
// The layout is the standard one and the numbering follows the rules module:
// point 0 sits at the bottom right, 23 at the top right, so player one travels
// anticlockwise from 23 down to 0 and bears off at the bottom right. Getting
// that mapping wrong is invisible until somebody plays a real game and the
// pieces walk the wrong way.
//
// Checkers stack up to five and then carry a number, which is what a real board
// does: past five they are just a column with a count.

import { disc, roundRect, shadow, fitText, easeOut, halo } from '../render/paint.js';
import { die } from '../render/pieces.js';
import { PALETTES } from '../theme.js';
import { backgammon, owner, pips, BAR, OFF, POINTS, CHECKERS } from '../games/backgammon.js';
import { drawFrame, texture } from './board.js';

const P = PALETTES.backgammon;

export function createBackgammonView() {
  let g = null;

  const view = {
    id: 'backgammon',

    measure(box) {
      const w = Math.min(box.w - 16, (box.h - 24) * 1.34);
      const h = Math.min(box.h - 16, w / 1.34);
      const x = box.x + (box.w - w) / 2;
      const y = box.y + (box.h - h) / 2;
      const bar = w * 0.07;
      const tray = w * 0.075;
      // the gap is explicit: with the play area sized to whatever was left, the
      // twelfth point ended flush against the tray and looked clipped
      const play = w - bar - tray - w * 0.055;
      const column = play / 12;
      g = { x, y, w, h, bar, tray, column, spike: h * 0.42, r: Math.min(column * 0.44, h * 0.075) };
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      shadow(ctx, () => {
        roundRect(ctx, g.x, g.y, g.w, g.h, 12);
        ctx.fillStyle = P.frame.dark;
        ctx.fill();
      }, { blur: 32, y: 14, colour: 'rgba(0,0,0,0.55)' });

      ctx.save();
      roundRect(ctx, g.x, g.y, g.w, g.h, 12);
      ctx.clip();
      ctx.drawImage(texture('wood', Math.round(g.w), Math.round(g.h), P.frame, { seed: 14 }), g.x, g.y);
      // the playing surface, inset
      const inset = { x: g.x + g.w * 0.015, y: g.y + g.h * 0.02, w: g.w - g.w * 0.03, h: g.h - g.h * 0.04 };
      ctx.drawImage(texture('wood', Math.round(inset.w), Math.round(inset.h), P.board, { seed: 21 }), inset.x, inset.y);
      ctx.restore();

      // the bar
      const barX = g.x + g.w * 0.015 + g.column * 6;
      ctx.save();
      ctx.drawImage(texture('wood', Math.round(g.bar), Math.round(g.h), P.frame, { seed: 5 }), barX, g.y + g.h * 0.02, g.bar, g.h - g.h * 0.04);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, g.y + g.h * 0.02, g.bar, g.h - g.h * 0.04);
      ctx.restore();

      // the twenty-four spikes
      for (let i = 0; i < POINTS; i++) {
        const p = pointAt(g, i, barX);
        const colour = P.points[i % 2];
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p.x - g.column * 0.44, p.base);
        ctx.lineTo(p.x + g.column * 0.44, p.base);
        ctx.lineTo(p.x, p.base + (p.top ? g.spike : -g.spike));
        ctx.closePath();
        const grad = ctx.createLinearGradient(p.x - g.column * 0.44, p.base, p.x + g.column * 0.44, p.base + (p.top ? g.spike : -g.spike));
        grad.addColorStop(0, colour.light);
        grad.addColorStop(0.6, colour.base);
        grad.addColorStop(1, colour.dark);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // the tray, where borne-off checkers go
      const trayX = g.x + g.w - g.tray - g.w * 0.015;
      ctx.save();
      roundRect(ctx, trayX, g.y + g.h * 0.03, g.tray, g.h - g.h * 0.06, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,200,0.15)';
      ctx.stroke();
      ctx.restore();

      const anim = ui.anim && ui.anim.move && !ui.anim.move.pass ? ui.anim : null;

      for (let i = 0; i < POINTS; i++) {
        const n = state.pts[i];
        if (!n) continue;
        const player = owner(n);
        let count = Math.abs(n);
        if (anim && anim.move.to === i) count--;
        drawStack(ctx, g, pointAt(g, i, barX), player, count);
      }

      for (const player of [0, 1]) {
        for (let k = 0; k < state.bar[player]; k++) {
          const y = g.y + g.h / 2 + (player === 0 ? 1 : -1) * (g.r * 1.1 + k * g.r * 1.6);
          disc(ctx, barX + g.bar / 2, y, g.r, P.pieces[player], { rings: 1 });
        }
        for (let k = 0; k < state.off[player]; k++) {
          const y = player === 0
            ? g.y + g.h - g.h * 0.06 - k * g.r * 0.5
            : g.y + g.h * 0.06 + k * g.r * 0.5;
          ctx.save();
          roundRect(ctx, trayX + 4, y - g.r * 0.22, g.tray - 8, g.r * 0.4, 3);
          ctx.fillStyle = P.pieces[player].base;
          ctx.fill();
          ctx.strokeStyle = P.pieces[player].edge;
          ctx.stroke();
          ctx.restore();
        }
      }

      if (anim) {
        const from = anim.move.from === BAR
          ? { x: barX + g.bar / 2, y: g.y + g.h / 2 }
          : stackSpot(g, pointAt(g, anim.move.from, barX), Math.abs(anim.prev ? anim.prev.pts[anim.move.from] : 1));
        const to = anim.move.to === OFF
          ? { x: trayX + g.tray / 2, y: state.turn === 0 ? g.y + g.h * 0.9 : g.y + g.h * 0.1 }
          : stackSpot(g, pointAt(g, anim.move.to, barX), Math.abs(state.pts[anim.move.to]));
        const k = easeOut(Math.min(1, anim.t));
        const player = anim.player !== undefined ? anim.player : owner(state.pts[anim.move.to] || 1);
        disc(ctx, from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * g.h * 0.06,
          g.r, P.pieces[player], { rings: 1, lift: 1.6 });
      }

      // the dice, in the half whose turn it is
      const dice = state.dice || [];
      if (dice.length) {
        const size = Math.min(g.column * 0.9, g.h * 0.11);
        const half = state.turn === 0 ? 0.72 : 0.28;
        const startX = barX + g.bar + g.column * 1.4;
        dice.forEach((value, i) => {
          die(ctx, startX + i * size * 1.35, g.y + g.h * half, size, value, { tilt: (i - 0.5) * 0.12 });
        });
      }

      // where the selected checker can go
      for (const hint of ui.hints || []) {
        if (hint.to === OFF) {
          halo(ctx, trayX + g.tray / 2, state.turn === 0 ? g.y + g.h * 0.85 : g.y + g.h * 0.15, g.r, P.accent, { width: 3, blur: 14 });
          continue;
        }
        const p = pointAt(g, hint.to, barX);
        const spot = stackSpot(g, p, Math.abs(state.pts[hint.to] || 0));
        ctx.save();
        ctx.globalAlpha = 0.55;
        disc(ctx, spot.x, spot.y, g.r * 0.8, P.pieces[state.turn], { lift: 0.2 });
        ctx.restore();
      }

      if (ui.sel !== null && ui.sel !== undefined) {
        const p = ui.sel === BAR ? { x: barX + g.bar / 2, base: g.y + g.h / 2, top: state.turn === 1 } : pointAt(g, ui.sel, barX);
        const spot = ui.sel === BAR ? { x: p.x, y: p.base } : stackSpot(g, p, Math.abs(state.pts[ui.sel] || 1));
        halo(ctx, spot.x, spot.y, g.r * 1.15, P.accent, { width: 3, blur: 16 });
      }
    },

    /** A point, the bar, or the tray. */
    hit(x, y) {
      if (!g) return null;
      const barX = g.x + g.w * 0.015 + g.column * 6;
      if (x >= barX && x <= barX + g.bar) return BAR;
      const trayX = g.x + g.w - g.tray - g.w * 0.015;
      if (x >= trayX) return OFF;
      for (let i = 0; i < POINTS; i++) {
        const p = pointAt(g, i, barX);
        if (Math.abs(x - p.x) > g.column * 0.5) continue;
        const inTop = p.top ? y >= p.base && y <= p.base + g.spike + g.r : y <= p.base && y >= p.base - g.spike - g.r;
        if (inTop) return i;
      }
      return null;
    },

    /**
     * Backgammon is played one die at a time here, so a click is a whole move
     * as long as it is unambiguous — and when two dice both reach the square
     * you tapped, the smaller one is spent first. That is not arbitrary: using
     * the small die first keeps the larger one free, which is what a player
     * wanting the other order would have to click twice to say.
     */
    pick(state, target, sel, legal) {
      if (target === null) return { sel };
      if (state.bar[state.turn] > 0) {
        const options = legal.filter((m) => m.from === BAR && m.to === target);
        if (options.length) return { sel: null, move: options.sort((a, b) => a.die - b.die)[0] };
        return { sel: BAR };
      }
      if (sel === null || sel === undefined) {
        return legal.some((m) => m.from === target) ? { sel: target } : { sel: null };
      }
      const options = legal.filter((m) => m.from === sel && m.to === target);
      if (options.length) return { sel: null, move: options.sort((a, b) => a.die - b.die)[0] };
      return legal.some((m) => m.from === target) ? { sel: target } : { sel: null };
    },

    hints(state, sel, legal) {
      if (state.bar[state.turn] > 0) return legal.filter((m) => m.from === BAR);
      if (sel === null || sel === undefined) return [];
      return legal.filter((m) => m.from === sel);
    },

    thumb(ctx, w, h) {
      view.draw(ctx, { x: 0, y: 0, w, h }, backgammon.setup(), { hints: [] });
    },
  };
  return view;
}

/** Where a point's spike starts, and which way it grows. */
function pointAt(g, i, barX) {
  const left = g.x + g.w * 0.015;
  const top = i >= 12;
  // 0..5 bottom right, 6..11 bottom left, 12..17 top left, 18..23 top right
  let column;
  if (i < 6) column = 11 - i;
  else if (i < 12) column = 11 - i;
  else column = i - 12;
  const x = left + column * g.column + g.column / 2 + (column >= 6 ? g.bar : 0);
  return { x, base: top ? g.y + g.h * 0.03 : g.y + g.h - g.h * 0.03, top, index: i };
}

function stackSpot(g, p, count) {
  const k = Math.min(count, 5);
  const dir = p.top ? 1 : -1;
  return { x: p.x, y: p.base + dir * (g.r + k * g.r * 1.7) };
}

function drawStack(ctx, g, p, player, count) {
  const dir = p.top ? 1 : -1;
  const shown = Math.min(count, 5);
  for (let k = 0; k < shown; k++) {
    disc(ctx, p.x, p.base + dir * (g.r + k * g.r * 1.7), g.r, P.pieces[player], { rings: 1, lift: 0.5 });
  }
  if (count > 5) {
    fitText(ctx, String(count), p.x, p.base + dir * (g.r + (shown - 1) * g.r * 1.7), g.r * 1.6, {
      size: g.r * 0.95, weight: 800, colour: player === 0 ? '#3a2a18' : '#f4e6c8',
    });
  }
}

/** The pip count — the one number every backgammon player watches. */
export function backgammonSeat(state, colour) {
  return {
    score: pips(state, colour),
    extra: (ctx, area) => {
      const off = state.off[colour];
      const r = Math.min(area.h * 0.3, (area.w - 10) / 32);
      for (let i = 0; i < CHECKERS; i++) {
        const x = area.x + r + i * r * 2.1;
        ctx.save();
        ctx.globalAlpha = i < off ? 1 : 0.22;
        disc(ctx, x, area.y + area.h * 0.5, r, P.pieces[colour], { lift: 0.2 });
        ctx.restore();
      }
    },
  };
}
