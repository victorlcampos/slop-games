// Painting the valley: terrain from a cache, then everything that stands or
// walks, then the HUD. Nothing in here decides anything — it reads the world
// and the layout and puts pixels where they say.

import { BOARD_H, BOARD_W, COLS, HUD_H, ROWS, TILE } from './config.js';
import { GRASS, ROCK, TREE } from './map.js';
import { BUILDINGS, whyNot } from './buildings.js';
import { UNITS } from './units.js';
import {
  drawBuilding, drawGrassTile, drawRallyFlag, drawRock, drawTree, drawUnit, drawZombie,
} from './art.js';
import { barLayout } from './ui.js';

/**
 * How the board fits the screen: scaled down when the viewport is narrower
 * than it, centred when wider. The command bar keeps the bottom strip.
 */
export function boardTransform(viewW, viewH) {
  const k = Math.min(1, viewW / BOARD_W, (viewH - HUD_H) / BOARD_H);
  return {
    k,
    ox: (viewW - BOARD_W * k) / 2,
    oy: Math.max(0, (viewH - HUD_H - BOARD_H * k) / 2),
  };
}

/** A screen point into tile coordinates (fractional). */
export function toBoard(tr, x, y) {
  return { x: (x - tr.ox) / (tr.k * TILE), y: (y - tr.oy) / (tr.k * TILE) };
}

// ------------------------------------------------------------- terrain cache

/**
 * The ground never moves, so it is painted once per season onto an offscreen
 * canvas and blitted after that — 800 tiles of freckles per frame is the kind
 * of spend a phone notices.
 */
export function createTerrainCache() {
  let canvas = null;
  let paintedSeason = null;
  let paintedMap = null;
  return {
    get(map, season) {
      if (canvas && paintedSeason === season && paintedMap === map) return canvas;
      canvas = canvas || Object.assign(document.createElement('canvas'), { width: BOARD_W, height: BOARD_H });
      const ctx = canvas.getContext('2d');
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const salt = c * 31 + r * 17;
          drawGrassTile(ctx, c * TILE, r * TILE, season, salt);
          const kind = map.tiles[c + r * COLS];
          if (kind === TREE) drawTree(ctx, c * TILE, r * TILE, season, salt);
          else if (kind === ROCK) drawRock(ctx, c * TILE, r * TILE, season, salt);
        }
      }
      paintedSeason = season;
      paintedMap = map;
      return canvas;
    },
  };
}

// ------------------------------------------------------------------ the board

export function drawBoard(ctx, world, tr, cache, { time, fx, tool, hover }) {
  const season = world.season();
  ctx.save();
  ctx.translate(tr.ox, tr.oy);
  ctx.scale(tr.k, tr.k);

  ctx.drawImage(cache.get(world.map, season), 0, 0);

  // buildings first, top row first, so a banner overlaps the roof below it
  const sorted = [...world.buildings].sort((a, b) => a.r - b.r);
  for (const b of sorted) {
    drawBuilding(ctx, b.id, b.c * TILE, b.r * TILE, {
      built: b.built,
      hurt: b.hurtT > 0,
      season,
      spec: BUILDINGS[b.id],
    });
    if (b.hp < BUILDINGS[b.id].hp && b.built >= 1) {
      const spec = BUILDINGS[b.id];
      const frac = Math.max(0, b.hp / spec.hp);
      ctx.fillStyle = 'rgba(20,18,14,0.7)';
      ctx.fillRect(b.c * TILE + 3, b.r * TILE - 5, spec.w * TILE - 6, 4);
      ctx.fillStyle = frac > 0.4 ? '#7fce6a' : '#e0563c';
      ctx.fillRect(b.c * TILE + 3, b.r * TILE - 5, (spec.w * TILE - 6) * frac, 4);
    }
  }

  drawRallyFlag(ctx, world.rally.x * TILE, world.rally.y * TILE, time);

  // the walking kind, sorted by y so nearer feet stand in front
  const mobs = [
    ...world.units.map((u) => ({ u, y: u.y, unit: true })),
    ...world.zombies.map((z) => ({ z, y: z.y })),
  ].sort((a, b) => a.y - b.y);
  for (const m of mobs) {
    if (m.unit) drawUnit(ctx, m.u, m.u.x * TILE, m.u.y * TILE, time);
    else drawZombie(ctx, m.z, m.z.x * TILE, m.z.y * TILE, time);
  }

  drawFx(ctx, fx);
  if (tool && tool.kind === 'shop' && hover) drawGhost(ctx, world, tool.id, hover);
  if (tool && tool.kind === 'tool' && hover) drawToolMark(ctx, tool.id, hover, time);

  // winter closes in from the edges — the vignette is the season on screen
  if (season === 'winter') {
    const g = ctx.createRadialGradient(
      BOARD_W / 2, BOARD_H / 2, BOARD_H * 0.45, BOARD_W / 2, BOARD_H / 2, BOARD_W * 0.7
    );
    g.addColorStop(0, 'rgba(180,200,220,0)');
    g.addColorStop(1, 'rgba(150,170,200,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  }

  ctx.restore();
}

function drawGhost(ctx, world, id, hover) {
  const spec = BUILDINGS[id];
  const c = Math.floor(hover.x - spec.w / 2 + 0.5);
  const r = Math.floor(hover.y - spec.h / 2 + 0.5);
  const bad = whyNot(world, id, c, r);
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawBuilding(ctx, id, c * TILE, r * TILE, { built: 1, spec });
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = bad ? '#e0563c' : '#7fce6a';
  ctx.fillRect(c * TILE, r * TILE, spec.w * TILE, spec.h * TILE);
  ctx.restore();
}

function drawToolMark(ctx, id, hover, time) {
  const x = Math.floor(hover.x) * TILE;
  const y = Math.floor(hover.y) * TILE;
  if (id === 'demolish') {
    ctx.strokeStyle = '#e0563c';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  } else {
    ctx.save();
    ctx.globalAlpha = 0.7;
    drawRallyFlag(ctx, hover.x * TILE, hover.y * TILE, time);
    ctx.restore();
  }
}

// ------------------------------------------------------------------------ fx

function drawFx(ctx, fx) {
  for (const f of fx) {
    const a = f.t / f.max;
    if (f.kind === 'arrow') {
      // the arrow is a moving dash along its line, not the whole line at once
      const p = 1 - a;
      const x = f.x + (f.tx - f.x) * p;
      const y = f.y + (f.ty - f.y) * p;
      const d = Math.hypot(f.tx - f.x, f.ty - f.y) || 1;
      ctx.strokeStyle = '#e8e2d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x * TILE, y * TILE);
      ctx.lineTo((x - ((f.tx - f.x) / d) * 0.3) * TILE, (y - ((f.ty - f.y) / d) * 0.3) * TILE);
      ctx.stroke();
    } else if (f.kind === 'puff') {
      ctx.save();
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = f.color;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + f.seed;
        const rr = (1 - a) * 12;
        ctx.fillRect(f.x * TILE + Math.cos(ang) * rr - 2, f.y * TILE + Math.sin(ang) * rr - 2, 4, 4);
      }
      ctx.restore();
    } else if (f.kind === 'flash') {
      ctx.save();
      ctx.globalAlpha = a * 0.6;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x * TILE, f.y * TILE, 6 + (1 - a) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ----------------------------------------------------------------- the icons

/** Tiny resource glyphs, drawn — an emoji here would be at the mercy of the
 *  player's OS, and the Windows flag lesson already cost one round of bugs. */
export function drawIcon(ctx, kind, x, y, s = 12) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'food') {
    ctx.fillStyle = '#d9a940';
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, s / 2, s / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a8792a';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((s / 3) * i, s * 0.25);
      ctx.lineTo((s / 3) * i - 2, s * 0.75);
      ctx.stroke();
    }
  } else if (kind === 'wood') {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(0, s * 0.25, s, s * 0.5);
    ctx.fillStyle = '#c8a34e';
    ctx.beginPath();
    ctx.ellipse(s * 0.9, s / 2, s * 0.14, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'stone') {
    ctx.fillStyle = '#8d9097';
    ctx.beginPath();
    ctx.moveTo(s * 0.15, s * 0.85);
    ctx.lineTo(0, s * 0.45);
    ctx.lineTo(s * 0.35, s * 0.15);
    ctx.lineTo(s * 0.85, s * 0.2);
    ctx.lineTo(s, s * 0.65);
    ctx.lineTo(s * 0.7, s * 0.85);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'gold') {
    ctx.fillStyle = '#c8a232';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8cf7a';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'pop') {
    ctx.fillStyle = '#e3b58a';
    ctx.fillRect(s * 0.25, 0, s * 0.5, s * 0.4);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(s * 0.15, s * 0.45, s * 0.7, s * 0.55);
  } else if (kind === 'army') {
    ctx.fillStyle = '#9aa4b8';
    ctx.fillRect(s * 0.15, 0, s * 0.7, s * 0.55);
    ctx.fillStyle = '#5b6c9e';
    ctx.fillRect(s * 0.15, s * 0.55, s * 0.7, s * 0.45);
  }
  ctx.restore();
}

// -------------------------------------------------------------------- the HUD

/** Fit `text` into `maxW`, shrinking the font before clipping ever happens —
 *  "Archery range" and "Campo de arco" are not the same length. */
function fitText(ctx, text, maxW, px) {
  let size = px;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  while (size > 7 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
  }
  return size;
}

export function drawTopBar(ctx, viewW, world, t, notice) {
  const pad = 10;
  ctx.save();
  ctx.fillStyle = 'rgba(20,18,14,0.66)';
  ctx.fillRect(0, 0, viewW, 30);

  let x = pad;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2e7d0';
  ctx.font = '700 13px system-ui, sans-serif';
  const yearText = `${t('hud.year', { n: world.year })} · ${t(`season.${world.season()}`)}`;
  ctx.fillText(yearText, x, 15);
  x += ctx.measureText(yearText).width + 18;

  ctx.font = '600 13px system-ui, sans-serif';
  for (const k of ['food', 'wood', 'stone', 'gold']) {
    drawIcon(ctx, k, x, 9, 12);
    const v = String(Math.floor(world.res[k]));
    ctx.fillStyle = '#f2e7d0';
    ctx.fillText(v, x + 16, 15);
    x += 16 + ctx.measureText(v).width + 14;
  }
  drawIcon(ctx, 'pop', x, 9, 12);
  const popText = `${world.pop}/${world.popCap()}`;
  ctx.fillText(popText, x + 16, 15);
  x += 16 + ctx.measureText(popText).width + 14;
  drawIcon(ctx, 'army', x, 9, 12);
  ctx.fillText(String(world.units.length), x + 16, 15);

  if (notice) {
    ctx.textAlign = 'right';
    ctx.fillStyle = notice.color || '#ffd97a';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(notice.text, viewW - pad, 15);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** The horde banner, front and centre — a horn nobody sees is a horn wasted. */
export function drawBanner(ctx, viewW, text, time) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pulse = 0.75 + Math.sin(time * 6) * 0.25;
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillStyle = `rgba(224,86,60,${pulse})`;
  ctx.fillText(text, viewW / 2, 54);
  ctx.restore();
}

export function drawBar(ctx, viewW, viewH, world, t, tool) {
  const rects = barLayout(viewW, viewH);
  ctx.save();
  ctx.fillStyle = 'rgba(20,18,14,0.88)';
  ctx.fillRect(0, viewH - HUD_H, viewW, HUD_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const r of rects) {
    const active = tool && tool.kind === r.kind && tool.id === r.id;
    let enabled = true;
    let name = '';
    let cost = null;
    if (r.kind === 'shop') {
      name = t(`b.${r.id}`);
      cost = BUILDINGS[r.id].cost;
      enabled = Object.entries(cost).every(([k, v]) => world.res[k] >= v);
    } else if (r.kind === 'train') {
      name = t(`u.${r.id}`);
      cost = UNITS[r.id].cost;
      enabled = world.buildings.some((b) => BUILDINGS[b.id].trains === r.id && b.built >= 1)
        && Object.entries(cost).every(([k, v]) => world.res[k] >= v) && world.pop > 1;
    } else {
      name = t(`tool.${r.id}`);
    }

    ctx.fillStyle = active ? 'rgba(255,217,122,0.22)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = active ? '#ffd97a' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.save();
    if (!enabled) ctx.globalAlpha = 0.38;
    drawButtonIcon(ctx, r, world);

    const size = fitText(ctx, name, r.w - 6, 11);
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.fillStyle = '#f2e7d0';
    ctx.fillText(name, r.x + r.w / 2, r.y + r.h - (cost ? 16 : 6));

    if (cost) {
      let parts = Object.entries(cost);
      // three costs (the archer's) must fit the narrowest button the layout
      // ever deals — 24px a part keeps them inside at minWidth
      const wEach = 24;
      let cx = r.x + r.w / 2 - (parts.length * wEach) / 2;
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      for (const [k, v] of parts) {
        drawIcon(ctx, k, cx, r.y + r.h - 13, 9);
        ctx.fillStyle = world.res[k] >= v ? '#cfc2a6' : '#e0563c';
        ctx.fillText(String(v), cx + 11, r.y + r.h - 5);
        cx += wEach;
      }
      ctx.textAlign = 'center';
    }
    ctx.restore();

    // the queue badge on a training button: how many are on the yard
    if (r.kind === 'train') {
      const n = world.queue.filter((q) => q.kind === r.id).length;
      if (n > 0) {
        ctx.fillStyle = '#ffd97a';
        ctx.beginPath();
        ctx.arc(r.x + r.w - 10, r.y + 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e1810';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.fillText(String(n), r.x + r.w - 10, r.y + 13);
      }
    }
  }
  ctx.restore();
  return rects;
}

function drawButtonIcon(ctx, r, world) {
  const cx = r.x + r.w / 2;
  const cy = r.y + 6;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.62, 0.62);
  if (r.kind === 'shop') {
    const spec = BUILDINGS[r.id];
    drawBuilding(ctx, r.id, -spec.w * TILE * 0.5, -2, { built: 1, spec, season: 'summer' });
  } else if (r.kind === 'train') {
    drawUnit(ctx, { id: 3, kind: r.id, hp: 999 }, 0, 18, 0);
  } else if (r.id === 'demolish') {
    ctx.strokeStyle = '#e0563c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(10, 22);
    ctx.moveTo(10, 2);
    ctx.lineTo(-10, 22);
    ctx.stroke();
  } else {
    drawRallyFlag(ctx, -4, 26, 0);
  }
  ctx.restore();
}
