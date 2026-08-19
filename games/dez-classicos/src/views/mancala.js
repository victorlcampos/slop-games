// The mancala board: a plank with fourteen hollows scooped out of it.
//
// Seeds are drawn where they would actually sit — scattered inside the pit, not
// stacked in a neat pile, and each one in its own colour, so a pit with eleven
// seeds looks like eleven seeds and not like a number written on wood. The
// scatter is deterministic (seeded by pit and index), because a handful that
// rearranges itself every frame is a handful nobody can count.

import { hollow, roundRect, shadow, noise, fitText, easeOut } from '../render/paint.js';
import { seed as drawSeed } from '../render/pieces.js';
import { PALETTES } from '../theme.js';
import { mancala, PITS, side as seedsOnSide, stores } from '../games/mancala.js';
import { drawFrame, texture } from './board.js';

const P = PALETTES.mancala;

export function createMancalaView() {
  let g = null;

  const view = {
    id: 'mancala',

    measure(box) {
      // eight columns across: a store, six pits, a store
      const w = Math.min(box.w - 12, (box.h - 30) * 2.6);
      const h = Math.min(box.h - 20, w / 2.6);
      const x = box.x + (box.w - w) / 2;
      const y = box.y + (box.h - h) / 2;
      // 9.6 units across, spelled out: a store at each end (1.4 units of room
      // each) and six pits between them. At 8.4 the end pits and the stores
      // shared the same pixels and the board read as five holes and a smear.
      const unit = w / 9.6;
      g = { x, y, w, h, unit, r: Math.min(unit * 0.45, h * 0.2) };
      return g;
    },

    draw(ctx, box, state, ui = {}) {
      view.measure(box);
      shadow(ctx, () => {
        roundRect(ctx, g.x, g.y, g.w, g.h, g.h * 0.24);
        ctx.fillStyle = P.board.dark;
        ctx.fill();
      }, { blur: 30, y: 14, colour: 'rgba(0,0,0,0.55)' });

      ctx.save();
      roundRect(ctx, g.x, g.y, g.w, g.h, g.h * 0.24);
      ctx.clip();
      ctx.drawImage(texture('wood', Math.round(g.w), Math.round(g.h), P.board, { seed: 8 }), g.x, g.y);
      const sheen = ctx.createLinearGradient(g.x, g.y, g.x + g.w * 0.4, g.y + g.h);
      sheen.addColorStop(0, 'rgba(255,235,200,0.16)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = sheen;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.restore();

      for (let i = 0; i < 14; i++) {
        const spot = pitAt(g, i);
        if (spot.store) {
          // a store is a long hollow, drawn as a stadium of overlapping circles
          ctx.save();
          for (let k = 0; k <= 6; k++) {
            hollow(ctx, spot.x, spot.y - spot.h / 2 + spot.r + (k / 6) * (spot.h - spot.r * 2), spot.r, { depth: 0.6 });
          }
          ctx.restore();
        } else {
          hollow(ctx, spot.x, spot.y, spot.r, { depth: 0.55 });
        }
        drawSeeds(ctx, spot, state.b[i], i);
        if (!spot.store) {
          // the count goes on the outside of its own row: printed below both
          // rows, the far row's number sits between the two and reads as the
          // near one's
          // sized against the pit, not in absolute pixels: the same board is
          // drawn at 168 px on a lobby card, and a 13 px number there is a
          // number bigger than the pit it belongs to
          const size = Math.max(7, Math.min(13, spot.r * 0.52));
          const away = i < 6 ? spot.r + size + 2 : -(spot.r + size);
          fitText(ctx, String(state.b[i]), spot.x, spot.y + away, spot.r * 2, {
            size, weight: 700, colour: 'rgba(255,235,200,0.55)',
          });
        } else {
          const size = Math.max(8, Math.min(16, spot.r * 0.7));
          fitText(ctx, String(state.b[i]), spot.x, spot.y + spot.h / 2 + size, spot.r * 2.4, {
            size, weight: 800, colour: P.accent,
          });
        }
      }

      // where you may sow, and the seed that would land in your store
      if (!ui.result) {
        for (const move of ui.hints || []) {
          const spot = pitAt(g, move.pit);
          ctx.save();
          ctx.strokeStyle = P.accent;
          ctx.globalAlpha = ui.hover === move.pit ? 1 : 0.55;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, spot.r * 1.06, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // the last sowing, as a trail of dots around the board
      const anim = ui.anim && ui.anim.move ? ui.anim : null;
      if (anim) {
        const from = pitAt(g, anim.move.pit);
        const to = pitAt(g, anim.move.end !== undefined ? anim.move.end : anim.move.pit);
        const k = easeOut(Math.min(1, anim.t));
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.6;
        drawSeed(ctx, from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * g.unit * 0.4, g.r * 0.3, P.seeds[2], 0);
        ctx.restore();
      }
    },

    hit(x, y) {
      if (!g) return -1;
      for (let i = 0; i < 14; i++) {
        const spot = pitAt(g, i);
        if (spot.store) continue;
        if (Math.hypot(spot.x - x, spot.y - y) <= spot.r * 1.25) return i;
      }
      return -1;
    },

    pick(state, pit, sel, legal) {
      const move = legal.find((m) => m.pit === pit);
      return move ? { sel: null, move } : { sel: null };
    },

    hints: (state, sel, legal) => legal,

    thumb(ctx, w, h) {
      view.measure({ x: 0, y: 0, w, h });
      const state = mancala.setup();
      state.b[2] = 0;
      state.b[3] = 5;
      state.b[6] = 3;
      state.b[13] = 2;
      view.draw(ctx, { x: 0, y: 0, w, h }, state, { hints: [] });
    },
  };
  return view;
}

/** Where a pit sits. 0-5 are the near row, 7-12 the far one, 6 and 13 the stores. */
function pitAt(g, i) {
  const mid = g.y + g.h / 2;
  const storeR = Math.min(g.unit * 0.5, g.h * 0.17);
  if (i === 6) return { x: g.x + g.unit * 8.75, y: mid, r: storeR, h: g.h * 0.66, store: true };
  if (i === 13) return { x: g.x + g.unit * 0.85, y: mid, r: storeR, h: g.h * 0.66, store: true };
  const near = i < 6;
  const column = near ? i : 12 - i;
  return {
    x: g.x + g.unit * (2.1 + column * 1.12),
    y: mid + (near ? 1 : -1) * g.h * 0.21,
    r: g.r,
    store: false,
  };
}

/**
 * Seeds scattered in a pit. Beyond a dozen they stop being countable however
 * you draw them, so past that the pile is drawn dense and the number under the
 * pit does the counting — which is what a real board's players do too.
 */
function drawSeeds(ctx, spot, count, pit) {
  const shown = Math.min(count, spot.store ? 24 : 14);
  for (let i = 0; i < shown; i++) {
    const a = noise(pit, i, 3) * Math.PI * 2;
    const spread = spot.store ? 0.72 : 0.62;
    const d = Math.sqrt(noise(pit, i + 40, 3)) * spot.r * spread;
    const x = spot.x + Math.cos(a) * d;
    const y = spot.y + Math.sin(a) * d * (spot.store ? (spot.h / spot.r) * 0.42 : 1);
    drawSeed(ctx, x, y, spot.r * (spot.store ? 0.2 : 0.24), P.seeds[(pit * 7 + i) % P.seeds.length], a);
  }
}

export function mancalaSeat(state, colour) {
  const [a, b] = stores(state.b);
  return {
    score: colour === 0 ? a : b,
    extra: (ctx, area) => {
      fitText(ctx, `${seedsOnSide(state.b, colour)}`, area.x + 16, area.y + area.h * 0.5, area.w * 0.5, {
        size: 15, weight: 700, colour: 'rgba(255,235,200,0.6)', align: 'left',
        family: 'ui-sans-serif, system-ui, sans-serif',
      });
      const r = Math.min(6, area.h * 0.2);
      let x = area.x + 46;
      for (let i = 0; i < Math.min(12, seedsOnSide(state.b, colour)); i++) {
        drawSeed(ctx, x, area.y + area.h * 0.5, r, P.seeds[i % P.seeds.length], i);
        x += r * 2.3;
      }
    },
  };
}
