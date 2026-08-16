// Painting the valley: terrain from a cache, then everything that stands or
// walks, then the HUD. Nothing in here decides anything — it reads the world
// and the layout and puts pixels where they say.

import { BOARD_H, BOARD_W, COLS, HUD_H, ROWS, TILE } from './config.js';
import { GRASS, HALL_C, HALL_R, ROCK, TREE } from './map.js';
import { BUILDINGS, buildingAt, whyNot } from './buildings.js';
import { UNITS } from './units.js';
import { questNow } from './quests.js';
import {
  SQUAD_COLORS, drawBuilding, drawClutter, drawCritter, drawGrassTile, drawLamp,
  drawMountains, drawPathTile, drawRallyFlag, drawRoadFringe, drawRock, drawTree,
  drawUnit, drawVillager, drawWell, drawZombie,
} from './art.js';
import { barLayout } from './ui.js';
import { minimapRect } from './camera.js';

/** The dirt cross through the village — scenery the town is built along. The
 *  vertical road is as wide as the manor it leads to; the crossing lane is a
 *  single cart's width, or the map reads as more road than valley. */
export function isRoad(c, r) {
  return c === HALL_C || c === HALL_C + 1 || r === HALL_R + 2;
}

// ------------------------------------------------------------- terrain cache

/**
 * The ground never moves, so it is painted once per season onto an offscreen
 * canvas and blitted after that — 800 tiles of tufts per frame is the kind
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
      const salt = (c, r) => c * 31 + r * 17;

      // 1 — the ground. The road runs under whatever stands on it: a grass
      // square in the middle of a lane reads as a hole, not as a tree.
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (isRoad(c, r)) {
            const v = c === HALL_C || c === HALL_C + 1;
            const hz = r === HALL_R + 2;
            drawPathTile(ctx, c * TILE, r * TILE, season, salt(c, r), v && hz ? 'x' : v ? 'v' : 'h');
          } else {
            drawGrassTile(ctx, c * TILE, r * TILE, season, salt(c, r));
          }
        }
      }

      // 2 — grass creeping over the road's edges, so the lanes read as worn
      // into the field instead of stamped on it
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!isRoad(c, r)) continue;
          if (c > 0 && !isRoad(c - 1, r)) drawRoadFringe(ctx, c * TILE, r * TILE, season, salt(c, r), 'l');
          if (c < COLS - 1 && !isRoad(c + 1, r)) drawRoadFringe(ctx, c * TILE, r * TILE, season, salt(c, r), 'r');
          if (r > 0 && !isRoad(c, r - 1)) drawRoadFringe(ctx, c * TILE, r * TILE, season, salt(c, r), 'u');
          if (r < ROWS - 1 && !isRoad(c, r + 1)) drawRoadFringe(ctx, c * TILE, r * TILE, season, salt(c, r), 'd');
        }
      }

      // 2b — the range that walls the valley's north, behind the treeline
      drawMountains(ctx, BOARD_W, season, map.seed);

      // 3 — the standing scenery, in its own pass so a canopy may spill over
      // the tile beside it without the next tile painting it out
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const kind = map.tiles[c + r * COLS];
          if (kind === TREE) drawTree(ctx, c * TILE, r * TILE, season, salt(c, r));
          else if (kind === ROCK) drawRock(ctx, c * TILE, r * TILE, season, salt(c, r));
        }
      }

      // 4 — the woods the valley sits in: a scenic tree ring on the south,
      // east and west borders (the north belongs to the mountains). The map
      // keeps these tiles walkable — the horde walks out of a forest now,
      // not off the edge of the world.
      for (let c = 0; c < COLS; c++) {
        const r = ROWS - 1;
        if (isRoad(c, r) || map.tiles[c + r * COLS] !== GRASS) continue;
        const s = salt(c, r);
        if (s % 3 !== 0) drawTree(ctx, c * TILE + ((s * 7) % 11) - 5, r * TILE + ((s * 13) % 9) - 4, season, s);
      }
      for (let r = 0; r < ROWS; r++) {
        for (const c of [0, COLS - 1]) {
          if (isRoad(c, r) || map.tiles[c + r * COLS] !== GRASS) continue;
          const s = salt(c, r);
          if (s % 3 !== 1) drawTree(ctx, c * TILE + ((s * 7) % 11) - 5, r * TILE + ((s * 13) % 9) - 4, season, s);
        }
      }

      // 5 — the village furniture: lamps along the roads, the well and the
      // stores by the manor. Scenery, not state — nothing collides with it.
      for (let r = 2; r < ROWS - 2; r += 5) {
        if (Math.abs(r - (HALL_R + 2)) < 2) continue;
        const left = (r / 5) % 2 < 1;
        const lx = left ? (HALL_C - 0.35) * TILE : (HALL_C + 2.15) * TILE;
        drawLamp(ctx, lx, r * TILE + 8, season);
      }
      for (let c = 4; c < COLS - 3; c += 7) {
        if (Math.abs(c - HALL_C) < 3) continue;
        drawLamp(ctx, c * TILE + 10, (HALL_R + 2 - 0.55) * TILE, season);
      }
      drawWell(ctx, (HALL_C + 2.7) * TILE, (HALL_R - 1.4) * TILE, season);
      drawClutter(ctx, (HALL_C - 1.1) * TILE, (HALL_R + 1.3) * TILE, 1);

      paintedSeason = season;
      paintedMap = map;
      return canvas;
    },
  };
}

// ------------------------------------------------------------------ the board

// The whole board is drawn at 1x into this canvas every frame, then blitted
// under the camera with smoothing off. One resolution for everything is what
// makes it read as pixel art: the old path drew the ground chunky and the
// buildings smooth, and the seam between the two styles was visible.
let scene = null;

function sceneCtx() {
  scene = scene || Object.assign(document.createElement('canvas'), { width: BOARD_W, height: BOARD_H });
  return scene.getContext('2d');
}

export function drawBoard(realCtx, world, tr, cache, { time, fx, tool, hover, villagers, pending, selectedSquad }) {
  const season = world.season();
  const ctx = sceneCtx();
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  ctx.drawImage(cache.get(world.map, season), 0, 0);

  // buildings first, top row first, so a banner overlaps the roof below it
  const sorted = [...world.buildings].sort((a, b) => a.r - b.r);
  const isWall = (c, r) => {
    const b = buildingAt(world, c, r);
    return !!b && b.id === 'wall';
  };
  for (const b of sorted) {
    const opts = {
      built: b.built,
      hurt: b.hurtT > 0,
      season,
      spec: BUILDINGS[b.id],
    };
    if (b.id === 'wall') {
      opts.link = {
        l: isWall(b.c - 1, b.r),
        r: isWall(b.c + 1, b.r),
        u: isWall(b.c, b.r - 1),
        d: isWall(b.c, b.r + 1),
      };
    }
    drawBuilding(ctx, b.id, b.c * TILE, b.r * TILE, opts);
    if (b.hp < BUILDINGS[b.id].hp && b.built >= 1) {
      const spec = BUILDINGS[b.id];
      const frac = Math.max(0, b.hp / spec.hp);
      ctx.fillStyle = 'rgba(20,18,14,0.7)';
      ctx.fillRect(b.c * TILE + 3, b.r * TILE - 5, spec.w * TILE - 6, 4);
      ctx.fillStyle = frac > 0.4 ? '#7fce6a' : '#e0563c';
      ctx.fillRect(b.c * TILE + 3, b.r * TILE - 5, (spec.w * TILE - 6) * frac, 4);
    }
    // the repair crew's hammer: a golden spark over the site being mended
    if (b.repairing && Math.sin(time * 10 + b.uid) > 0) {
      ctx.fillStyle = '#ffd97a';
      const hx = b.c * TILE + BUILDINGS[b.id].w * TILE - 8;
      ctx.fillRect(hx, b.r * TILE - 12, 4, 2);
      ctx.fillRect(hx + 1, b.r * TILE - 15, 2, 4);
    }
  }

  drawSmoke(ctx, world, time);
  world.squads.forEach((s, i) => {
    drawRallyFlag(ctx, s.x * TILE, s.y * TILE, time, SQUAD_COLORS[i % SQUAD_COLORS.length], i === selectedSquad);
  });

  // the walking kind, sorted by y so nearer feet stand in front
  const mobs = [
    ...(villagers || []).map((v) => ({ v, y: v.y })),
    ...world.units.map((u) => ({ u, y: u.y })),
    ...world.zombies.map((z) => ({ z, y: z.y })),
  ].sort((a, b) => a.y - b.y);
  for (const m of mobs) {
    if (m.u) {
      if (m.u.squad === selectedSquad) {
        // the picked squad stands in its own light
        ctx.save();
        ctx.strokeStyle = '#ffd97a';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(m.u.x * TILE, m.u.y * TILE + 10, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawUnit(ctx, m.u, m.u.x * TILE, m.u.y * TILE, time);
    } else if (m.v && (m.v.kind === 'sheep' || m.v.kind === 'chicken')) drawCritter(ctx, m.v, m.v.x * TILE, m.v.y * TILE, time);
    else if (m.v) drawVillager(ctx, m.v, m.v.x * TILE, m.v.y * TILE, time);
    else drawZombie(ctx, m.z, m.z.x * TILE, m.z.y * TILE, time);
  }

  drawFx(ctx, fx);
  if (tool && tool.kind === 'shop') {
    if (pending) drawGhost(ctx, world, tool.id, pending.c, pending.r, time);
    else if (hover) {
      const spec = BUILDINGS[tool.id];
      drawGhost(ctx, world, tool.id,
        Math.floor(hover.x - spec.w / 2 + 0.5), Math.floor(hover.y - spec.h / 2 + 0.5), time);
    }
  }
  if (tool && tool.kind === 'tool' && hover) drawToolMark(ctx, tool.id, hover, time);

  if (season === 'winter') {
    drawSnowfall(ctx, time);
    // winter closes in from the edges — the vignette is the season on screen
    const g = ctx.createRadialGradient(
      BOARD_W / 2, BOARD_H / 2, BOARD_H * 0.45, BOARD_W / 2, BOARD_H / 2, BOARD_W * 0.7
    );
    g.addColorStop(0, 'rgba(180,200,220,0)');
    g.addColorStop(1, 'rgba(150,170,200,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  } else if (season === 'autumn') {
    // a golden cast over the whole valley: the harvest light
    ctx.fillStyle = 'rgba(232,170,60,0.07)';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  }

  // the light: warm at the heart of the valley, cooling toward the treeline.
  // Subtle on purpose — it grades the scene without anyone noticing a filter.
  const light = ctx.createRadialGradient(
    BOARD_W / 2, BOARD_H * 0.44, BOARD_H * 0.4, BOARD_W / 2, BOARD_H / 2, BOARD_W * 0.72
  );
  light.addColorStop(0, 'rgba(255,235,180,0.05)');
  light.addColorStop(1, 'rgba(40,32,60,0.10)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  // one blit under the camera, nearest-neighbour: the whole scene shares one
  // pixel grid, which is what makes it read as pixel art
  realCtx.save();
  realCtx.translate(tr.ox, tr.oy);
  realCtx.scale(tr.k, tr.k);
  realCtx.imageSmoothingEnabled = false;
  realCtx.drawImage(scene, 0, 0);
  realCtx.restore();
}

/**
 * The minimap: the whole valley in a stamp, with the camera's window drawn on
 * it. With the eye down at street level, this is how the player sees the
 * horde crossing the far fields — and tapping it moves the eye there.
 */
export function drawMinimap(ctx, world, cam, viewW, viewH, cache) {
  const r = minimapRect(viewW, viewH);
  ctx.save();
  ctx.fillStyle = 'rgba(24,20,14,0.9)';
  ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  ctx.strokeStyle = 'rgba(200,162,50,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);

  // the live scene, shrunk — the minimap shows the town as it actually looks
  ctx.drawImage(scene || cache.get(world.map, world.season()), r.x, r.y, r.w, r.h);

  const kx = r.w / COLS;
  const ky = r.h / ROWS;
  ctx.fillStyle = '#ffd97a';
  const hall = world.hall();
  if (hall) ctx.fillRect(r.x + hall.c * kx, r.y + hall.r * ky, Math.max(3, 2 * kx), Math.max(3, 2 * ky));
  for (const u of world.units) {
    ctx.fillStyle = '#6fa0ff';
    ctx.fillRect(r.x + u.x * kx - 1, r.y + u.y * ky - 1, 2, 2);
  }
  for (const z of world.zombies) {
    ctx.fillStyle = '#ff5040';
    ctx.fillRect(r.x + z.x * kx - 1.5, r.y + z.y * ky - 1.5, 3, 3);
  }

  // the camera's window over the valley
  const halfW = viewW / (2 * cam.zoom * TILE);
  const halfH = (viewH - HUD_H) / (2 * cam.zoom * TILE);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    r.x + (cam.x - halfW) * kx, r.y + (cam.y - halfH) * ky,
    Math.min(r.w, halfW * 2 * kx), Math.min(r.h, halfH * 2 * ky)
  );
  ctx.restore();
  return r;
}

/**
 * Woodsmoke out of the manor's chimney — stateless, derived from the clock.
 * Many faint puffs on one climbing path: the first version used three big
 * opaque balls, and the topmost read as a grey UFO hovering by the banner.
 */
function drawSmoke(ctx, world, time) {
  const hall = world.hall();
  if (!hall) return;
  const sx = hall.c * TILE + 2 * TILE - 0.45 * TILE + 4;
  const sy = hall.r * TILE - 12;
  ctx.save();
  ctx.fillStyle = '#d8dce0';
  for (let k = 0; k < 6; k++) {
    const p = (time * 0.22 + k / 6) % 1;
    // faint from birth, gone before it detaches into a floating object
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.22;
    const drift = Math.sin(time * 1.1 + k * 2.3 + p * 4) * 3;
    const rr = 1.5 + p * 4;
    ctx.beginPath();
    ctx.arc(sx + drift + p * 8, sy - p * 20, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Snow that needs no state: each flake's fall is a function of the clock. */
function drawSnowfall(ctx, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(240,246,250,0.75)';
  for (let i = 0; i < 60; i++) {
    const speed = 22 + (i % 7) * 5;
    const x = (i * 97 + Math.sin(time * 0.8 + i) * 14 + time * 9) % BOARD_W;
    const y = (i * 61 + time * speed) % BOARD_H;
    const s = 2 + (i % 3);
    ctx.fillRect((x + BOARD_W) % BOARD_W, y, s, s);
  }
  ctx.restore();
}

function drawGhost(ctx, world, id, c, r, time = 0) {
  const spec = BUILDINGS[id];
  const bad = whyNot(world, id, c, r);
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawBuilding(ctx, id, c * TILE, r * TILE, { built: 1, spec });
  ctx.globalAlpha = 0.28 + Math.sin(time * 5) * 0.06;
  ctx.fillStyle = bad ? '#e0563c' : '#7fce6a';
  ctx.fillRect(c * TILE, r * TILE, spec.w * TILE, spec.h * TILE);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = bad ? '#e0563c' : '#7fce6a';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(c * TILE + 1, r * TILE + 1, spec.w * TILE - 2, spec.h * TILE - 2);
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * The place-then-confirm buttons, floating under the pending ghost in screen
 * space. Tap-to-build planted a farm on every mis-tap; now the tap only
 * parks the ghost, and these two buttons are the decision.
 */
export function drawConfirm(ctx, tr, world, id, pending, t, viewW, viewH) {
  const spec = BUILDINGS[id];
  const bad = whyNot(world, id, pending.c, pending.r);
  const gx = tr.ox + (pending.c + spec.w / 2) * TILE * tr.k;
  let gy = tr.oy + (pending.r + spec.h) * TILE * tr.k + 16;

  ctx.save();
  ctx.font = '700 14px system-ui, sans-serif';
  const okText = `✓ ${t('ui.confirm')}`;
  const noText = '✕';
  const okW = ctx.measureText(okText).width + 26;
  const noW = 40;
  const bh = 34;
  const total = okW + 8 + noW;
  // on screen whatever corner the ghost is parked in
  let x0 = Math.max(8, Math.min(gx - total / 2, viewW - total - 8));
  gy = Math.max(44, Math.min(gy, viewH - HUD_H - bh - 8));

  const rects = [
    { kind: 'confirm', x: x0, y: gy, w: okW, h: bh },
    { kind: 'cancel', x: x0 + okW + 8, y: gy, w: noW, h: bh },
  ];

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of rects) {
    const ok = r.kind === 'confirm';
    ctx.fillStyle = ok ? (bad ? 'rgba(90,90,90,0.85)' : 'rgba(63,138,63,0.92)') : 'rgba(160,58,48,0.92)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,12,7,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f5efdd';
    ctx.fillText(ok ? okText : noText, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
  ctx.restore();
  return rects;
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
function fitText(ctx, text, maxW, pxSize) {
  let size = pxSize;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  while (size > 7 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
  }
  return size;
}

export function drawTopBar(ctx, viewW, world, t, status) {
  const pad = 10;
  ctx.save();
  ctx.fillStyle = 'rgba(26,19,12,0.85)';
  ctx.fillRect(0, 0, viewW, 32);
  ctx.fillStyle = 'rgba(200,162,50,0.35)';
  ctx.fillRect(0, 31, viewW, 1);

  let x = pad;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2e7d0';
  ctx.font = '700 13px system-ui, sans-serif';
  const yearText = `${t('hud.year', { n: world.year })} · ${t(`season.${world.season()}`)}`;
  ctx.fillText(yearText, x, 16);
  x += ctx.measureText(yearText).width + 16;

  // each resource carries its per-second rate: "where does wood come from"
  // is answered by the +0.4 sitting next to the number
  const rates = world.rates();
  for (const k of ['food', 'wood', 'stone', 'gold']) {
    drawIcon(ctx, k, x, 10, 12);
    const v = String(Math.floor(world.res[k]));
    ctx.fillStyle = '#f2e7d0';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(v, x + 16, 16);
    x += 16 + ctx.measureText(v).width + 3;
    const r = rates[k];
    if (Math.abs(r) >= 0.005) {
      const rt = `${r > 0 ? '+' : ''}${r.toFixed(1)}`;
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillStyle = r > 0 ? '#8fe08a' : '#e0563c';
      ctx.fillText(rt, x, 17);
      x += ctx.measureText(rt).width;
    }
    x += 12;
  }
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = '#f2e7d0';
  drawIcon(ctx, 'pop', x, 10, 12);
  const popText = `${world.pop}/${world.popCap()}`;
  ctx.fillText(popText, x + 16, 16);
  x += 16 + ctx.measureText(popText).width + 12;
  drawIcon(ctx, 'army', x, 10, 12);
  ctx.fillText(String(world.units.length), x + 16, 16);

  if (status) {
    // right-aligned but clear of the corner: the flags and the mute button
    // live there in the DOM, above the canvas
    ctx.textAlign = 'right';
    ctx.fillStyle = status.color || '#ffd97a';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(status.text, viewW - 130, 16);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** Break `text` on spaces so every line fits `maxW` at the current font. */
function wrap(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The quest panel, top-left like the reference: one goal, one live counter. */
export function drawQuest(ctx, world, t) {
  const q = questNow(world);
  const text = q.id === 'survive'
    ? t('q.survive', { year: q.year })
    : t(`q.${q.id}`, { target: q.target });
  const wMax = 250;

  ctx.save();
  ctx.font = '600 12px system-ui, sans-serif';
  const lines = wrap(ctx, text, wMax - 40);
  const hBox = 30 + lines.length * 15;

  ctx.fillStyle = 'rgba(24,20,14,0.82)';
  ctx.strokeStyle = 'rgba(200,162,50,0.55)';
  ctx.lineWidth = 1.5;
  const x = 10;
  const y = 42;
  ctx.beginPath();
  ctx.roundRect(x, y, wMax, hBox, 6);
  ctx.fill();
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d9c26a';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.fillText(t('q.title').toUpperCase(), x + 12, y + 14);

  // the checkbox with the live count beside it
  ctx.strokeStyle = '#cfc6a8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 12, y + 26, 11, 11);
  if (q.target !== null && q.n >= q.target) {
    ctx.strokeStyle = '#8fe08a';
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 31);
    ctx.lineTo(x + 17, y + 35);
    ctx.lineTo(x + 22, y + 27);
    ctx.stroke();
  }
  ctx.fillStyle = '#eee6cf';
  ctx.font = '600 12px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, x + 30, y + 32 + i * 15));
  if (q.target !== null) {
    ctx.fillStyle = '#d9c26a';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${q.n}/${q.target}`, x + wMax - 10, y + 14);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** One-line toast, centre screen — refusals were invisible in the corner. */
export function drawToast(ctx, viewW, notice) {
  if (!notice) return;
  ctx.save();
  ctx.font = '700 14px system-ui, sans-serif';
  const w = ctx.measureText(notice.text).width + 30;
  const x = viewW / 2 - w / 2;
  const y = 84;
  ctx.fillStyle = 'rgba(24,20,14,0.85)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 30, 15);
  ctx.fill();
  ctx.fillStyle = notice.color || '#ffd97a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(notice.text, viewW / 2, y + 15);
  ctx.restore();
}

/** The banner for the horde, front and centre — a horn nobody sees is wasted. */
export function drawBanner(ctx, viewW, text, time) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pulse = 0.75 + Math.sin(time * 6) * 0.25;
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillStyle = `rgba(224,86,60,${pulse})`;
  ctx.fillText(text, viewW / 2, 130);
  ctx.restore();
}

/** What the selected tool is and what it wants, spelled out above the bar. */
export function drawToolInfo(ctx, viewW, viewH, t, tool) {
  if (!tool) return;
  let name = '';
  let note = '';
  if (tool.kind === 'shop') {
    name = t(`b.${tool.id}`);
    note = t(`b.${tool.id}.note`);
  } else if (tool.kind === 'tool') {
    name = t(`tool.${tool.id}`);
    note = t(`tool.${tool.id}.note`);
  } else {
    return;
  }
  const y = viewH - HUD_H - 26;
  ctx.save();
  ctx.fillStyle = 'rgba(24,20,14,0.82)';
  ctx.fillRect(0, y, viewW, 26);
  ctx.textBaseline = 'middle';
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.fillStyle = '#d9c26a';
  const label = `${name} — `;
  const cx = 12;
  ctx.fillText(label, cx, y + 13);
  const lw = ctx.measureText(label).width;
  const size = fitText(ctx, note, viewW - cx - lw - 16, 12);
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = '#eee6cf';
  ctx.fillText(note, cx + lw, y + 13);
  ctx.restore();
}

export function drawBar(ctx, viewW, viewH, world, t, tool) {
  const rects = barLayout(viewW, viewH);
  ctx.save();
  // a wooden console, not a translucent strip — the UI wears the game's skin
  ctx.fillStyle = '#221912';
  ctx.fillRect(0, viewH - HUD_H, viewW, HUD_H);
  ctx.fillStyle = '#2b2016';
  ctx.fillRect(0, viewH - HUD_H, viewW, 3);
  ctx.fillStyle = 'rgba(200,162,50,0.45)';
  ctx.fillRect(0, viewH - HUD_H, viewW, 1.5);

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

    ctx.fillStyle = active ? 'rgba(200,162,50,0.28)' : 'rgba(64,46,30,0.7)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 5);
    ctx.fill();
    ctx.strokeStyle = active ? '#ffd97a' : 'rgba(18,12,7,0.9)';
    ctx.lineWidth = active ? 2 : 1.5;
    ctx.stroke();
    if (!active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x + 4, r.y + 1.5);
      ctx.lineTo(r.x + r.w - 4, r.y + 1.5);
      ctx.stroke();
    }

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
    drawBuilding(ctx, r.id, -spec.w * TILE * 0.5, r.id === 'tower' ? 14 : -2, { built: 1, spec, season: 'summer' });
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
