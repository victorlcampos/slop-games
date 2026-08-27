import { COLS, H, HIDDEN_ROWS, VISIBLE_ROWS } from './config.js';
import { PALETTE, SHAPES, pieceCells } from './pieces.js';
import { t } from './i18n.js';

const TAU = Math.PI * 2;

export function layoutFor(W) {
  const mobile = W < 760;
  const cell = mobile
    ? Math.min((W - 34) / COLS, (H - 210) / VISIBLE_ROWS)
    : Math.min(37.2, (W - 360) / COLS, (H - 142) / VISIBLE_ROWS);
  const boardW = cell * COLS;
  const boardH = cell * VISIBLE_ROWS;
  return {
    mobile, cell, boardW, boardH,
    x: (W - boardW) / 2,
    y: mobile ? 120 : (H - boardH) / 2 + 4,
  };
}

function rounded(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function gear(ctx, x, y, radius, teeth, angle, color = '#59402d', alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = i * Math.PI / teeth;
    const r = i % 2 ? radius * 0.78 : radius;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#100f0d';
  ctx.lineWidth = Math.max(2, radius * 0.07);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.45, 0, TAU);
  ctx.fillStyle = '#171a18';
  ctx.fill();
  ctx.strokeStyle = '#9b7041';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.13, 0, TAU);
  ctx.fillStyle = '#c8954e';
  ctx.fill();
  ctx.restore();
}

function pipe(ctx, x, y, w, h, bend = 0) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (bend) {
    ctx.lineTo(x + w * 0.6, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.4);
  }
  ctx.lineTo(x + w, y + h);
  ctx.strokeStyle = '#241d18';
  ctx.lineWidth = 20;
  ctx.stroke();
  ctx.strokeStyle = '#7c5634';
  ctx.lineWidth = 13;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,202,116,0.28)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

export function drawBackdrop(ctx, W, time = 0) {
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.45, Math.max(W, H) * 0.72);
  bg.addColorStop(0, '#25352f');
  bg.addColorStop(0.45, '#121c1b');
  bg.addColorStop(1, '#070a0b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Iron sheets, their seams and rivets make the empty menu part of the same
  // foundry as the board instead of a separate splash screen.
  ctx.strokeStyle = 'rgba(195,139,72,0.1)';
  ctx.lineWidth = 2;
  for (let x = 70; x < W; x += 210) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 110; y < H; y += 190) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(217,160,87,0.22)';
  for (let x = 70; x < W; x += 210) {
    for (let y = 110; y < H; y += 190) {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
    }
  }

  pipe(ctx, -12, 56, Math.max(80, W * 0.14), 0, 0);
  pipe(ctx, W - Math.max(95, W * 0.16), H - 70, Math.max(100, W * 0.18), 0, 0);
  pipe(ctx, W - 42, 20, 0, 180, 0);

  gear(ctx, W * 0.11, H * 0.23, 64, 14, time * 0.16, '#3a3026', 0.46);
  gear(ctx, W * 0.9, H * 0.68, 88, 17, -time * 0.11, '#403326', 0.42);
  gear(ctx, W * 0.12, H * 0.79, 42, 11, -time * 0.22, '#2f322d', 0.38);
  gear(ctx, W * 0.82, H * 0.16, 36, 10, time * 0.27, '#4f3926', 0.33);

  // Slow translucent steam, made from overlapping circles rather than an image.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 12; i++) {
    const phase = (time * (0.035 + (i % 3) * 0.008) + i * 0.173) % 1;
    const side = i % 2;
    const x = side ? W - 28 - (i % 4) * 13 : 24 + (i % 4) * 13;
    const y = H - phase * H * 0.9;
    const radius = 18 + phase * 48;
    const mist = ctx.createRadialGradient(x, y, 0, x, y, radius);
    mist.addColorStop(0, `rgba(181,211,196,${0.06 * (1 - phase)})`);
    mist.addColorStop(1, 'rgba(181,211,196,0)');
    ctx.fillStyle = mist;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  }
  ctx.restore();

  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.38)');
  shade.addColorStop(0.35, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
}

function rivet(ctx, x, y, r = 3) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
  g.addColorStop(0, '#fff0b0');
  g.addColorStop(0.32, '#b67d37');
  g.addColorStop(1, '#382316');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function panel(ctx, x, y, w, h, title = '') {
  ctx.save();
  rounded(ctx, x, y, w, h, 12);
  const metal = ctx.createLinearGradient(x, y, x + w, y + h);
  metal.addColorStop(0, 'rgba(77,61,45,0.96)');
  metal.addColorStop(0.45, 'rgba(29,35,32,0.97)');
  metal.addColorStop(1, 'rgba(64,43,31,0.96)');
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.strokeStyle = '#bf8a49';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,224,151,0.22)';
  ctx.lineWidth = 1;
  rounded(ctx, x + 5, y + 5, w - 10, h - 10, 8);
  ctx.stroke();
  for (const [rx, ry] of [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]]) rivet(ctx, rx, ry, 2.6);
  if (title) {
    ctx.fillStyle = '#e7bd72';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + w / 2, y + 18);
  }
  ctx.restore();
}

export function drawBlock(ctx, type, x, y, size, { alpha = 1, ghost = false } = {}) {
  const p = PALETTE[type];
  const gap = Math.max(1.2, size * 0.055);
  const xx = x + gap;
  const yy = y + gap;
  const s = size - gap * 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  rounded(ctx, xx, yy, s, s, Math.max(3, size * 0.13));
  if (ghost) {
    ctx.strokeStyle = p.glow;
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.setLineDash([size * 0.18, size * 0.11]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha *= 0.12;
    ctx.fillStyle = p.face;
    ctx.fill();
    ctx.restore();
    return;
  }

  const face = ctx.createLinearGradient(xx, yy, xx + s, yy + s);
  face.addColorStop(0, p.light);
  face.addColorStop(0.28, p.face);
  face.addColorStop(1, p.dark);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.strokeStyle = '#151311';
  ctx.lineWidth = Math.max(1.5, size * 0.065);
  ctx.stroke();

  rounded(ctx, xx + s * 0.18, yy + s * 0.18, s * 0.64, s * 0.64, Math.max(2, size * 0.08));
  ctx.fillStyle = 'rgba(24,22,19,0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,239,180,0.32)';
  ctx.lineWidth = 1;
  ctx.stroke();

  rivet(ctx, xx + s * 0.2, yy + s * 0.2, Math.max(1.2, size * 0.045));
  rivet(ctx, xx + s * 0.8, yy + s * 0.8, Math.max(1.2, size * 0.045));
  ctx.strokeStyle = 'rgba(255,255,220,0.28)';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(xx + s * 0.28, yy + s * 0.72);
  ctx.lineTo(xx + s * 0.72, yy + s * 0.28);
  ctx.stroke();
  ctx.restore();
}

function preview(ctx, type, x, y, w, h, maxCell = 22) {
  if (!type) return;
  const shape = SHAPES[type][0];
  const minX = Math.min(...shape.map((p) => p[0]));
  const maxX = Math.max(...shape.map((p) => p[0]));
  const minY = Math.min(...shape.map((p) => p[1]));
  const maxY = Math.max(...shape.map((p) => p[1]));
  const cell = Math.min(maxCell, w / (maxX - minX + 1), h / (maxY - minY + 1));
  const ox = x + (w - (maxX - minX + 1) * cell) / 2 - minX * cell;
  const oy = y + (h - (maxY - minY + 1) * cell) / 2 - minY * cell;
  for (const [px, py] of shape) drawBlock(ctx, type, ox + px * cell, oy + py * cell, cell);
}

function stat(ctx, x, y, label, value, align = 'left') {
  ctx.textAlign = align;
  ctx.fillStyle = '#a98f6e';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#ffe1a0';
  ctx.font = '900 25px ui-monospace, SFMono-Regular, Consolas, monospace';
  ctx.fillText(String(value), x, y + 27);
}

function drawBoard(ctx, game, layout) {
  const { x, y, cell, boardW, boardH } = layout;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  rounded(ctx, x - 13, y - 13, boardW + 26, boardH + 26, 13);
  ctx.fillStyle = '#120f0d';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = '#bd8040';
  ctx.lineWidth = 7;
  rounded(ctx, x - 9, y - 9, boardW + 18, boardH + 18, 10);
  ctx.stroke();
  ctx.strokeStyle = '#f0c477';
  ctx.lineWidth = 1.5;
  rounded(ctx, x - 5, y - 5, boardW + 10, boardH + 10, 7);
  ctx.stroke();

  const well = ctx.createLinearGradient(x, y, x + boardW, y + boardH);
  well.addColorStop(0, '#07100f');
  well.addColorStop(0.55, '#0c1514');
  well.addColorStop(1, '#160e0b');
  ctx.fillStyle = well;
  ctx.fillRect(x, y, boardW, boardH);

  ctx.strokeStyle = 'rgba(207,173,112,0.075)';
  ctx.lineWidth = 1;
  for (let cx = 1; cx < COLS; cx++) {
    ctx.beginPath(); ctx.moveTo(x + cx * cell, y); ctx.lineTo(x + cx * cell, y + boardH); ctx.stroke();
  }
  for (let cy = 1; cy < VISIBLE_ROWS; cy++) {
    ctx.beginPath(); ctx.moveTo(x, y + cy * cell); ctx.lineTo(x + boardW, y + cy * cell); ctx.stroke();
  }

  for (let by = HIDDEN_ROWS; by < game.board.length; by++) {
    for (let bx = 0; bx < COLS; bx++) {
      const type = game.board[by][bx];
      if (type) drawBlock(ctx, type, x + bx * cell, y + (by - HIDDEN_ROWS) * cell, cell);
    }
  }

  if (game.active && game.phase !== 'over') {
    const ghost = { ...game.active, y: game.active.y + game.ghost() };
    for (const [bx, by] of pieceCells(ghost)) {
      if (by >= HIDDEN_ROWS) drawBlock(ctx, ghost.type, x + bx * cell, y + (by - HIDDEN_ROWS) * cell, cell, { ghost: true, alpha: 0.72 });
    }
    for (const [bx, by] of pieceCells(game.active)) {
      if (by >= HIDDEN_ROWS) drawBlock(ctx, game.active.type, x + bx * cell, y + (by - HIDDEN_ROWS) * cell, cell);
    }
  }

  for (const [rx, ry] of [[x - 8, y - 8], [x + boardW + 8, y - 8], [x - 8, y + boardH + 8], [x + boardW + 8, y + boardH + 8]]) rivet(ctx, rx, ry, 5);
  ctx.restore();
}

function pressureGauge(ctx, x, y, w, level) {
  const value = Math.min(1, ((level - 1) % 10 + 1) / 10);
  panel(ctx, x, y, w, 84, t('hud.level'));
  ctx.save();
  ctx.fillStyle = '#0c1110';
  rounded(ctx, x + 14, y + 37, w - 28, 17, 8);
  ctx.fill();
  const fill = ctx.createLinearGradient(x + 14, 0, x + w - 14, 0);
  fill.addColorStop(0, '#4bd7c9');
  fill.addColorStop(0.64, '#e2b34c');
  fill.addColorStop(1, '#e65037');
  ctx.fillStyle = fill;
  rounded(ctx, x + 16, y + 39, Math.max(8, (w - 32) * value), 13, 7);
  ctx.fill();
  ctx.fillStyle = '#fff0b1';
  ctx.font = '900 18px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(level), x + w / 2, y + 74);
  ctx.restore();
}

function drawDesktopHud(ctx, game, layout, W) {
  const leftX = layout.x - 176;
  const rightX = layout.x + layout.boardW + 24;
  const panelW = Math.max(136, Math.min(152, leftX - 18));
  panel(ctx, leftX, layout.y + 6, panelW, 132, t('hud.hold'));
  preview(ctx, game.holdType, leftX + 14, layout.y + 38, panelW - 28, 88, 25);

  panel(ctx, leftX, layout.y + 154, panelW, 170);
  stat(ctx, leftX + 16, layout.y + 182, t('hud.score'), game.score);
  stat(ctx, leftX + 16, layout.y + 244, t('hud.lines'), game.lines);
  pressureGauge(ctx, leftX, layout.y + 340, panelW, game.level);

  const rightW = Math.min(154, Math.max(132, W - rightX - 18));
  panel(ctx, rightX, layout.y + 6, rightW, 315, t('hud.next'));
  game.next.slice(0, 4).forEach((type, i) => {
    preview(ctx, type, rightX + 14, layout.y + 34 + i * 67, rightW - 28, 57, i ? 17 : 23);
    if (i < 3) {
      ctx.strokeStyle = 'rgba(235,190,111,0.16)';
      ctx.beginPath();
      ctx.moveTo(rightX + 13, layout.y + 97 + i * 67);
      ctx.lineTo(rightX + rightW - 13, layout.y + 97 + i * 67);
      ctx.stroke();
    }
  });

  if (game.combo > 0) {
    ctx.fillStyle = '#ffd36c';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('hud.combo', { n: game.combo + 1 }), rightX + rightW / 2, layout.y + 360);
  }
  if (game.backToBack) {
    ctx.fillStyle = '#72e6d5';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText(t('hud.b2b'), rightX + rightW / 2, layout.y + 386);
  }
}

function drawMobileHud(ctx, game, layout, W) {
  // The DOM tools occupy the first forty pixels at the right. This second row
  // keeps the next-piece window clear of the flags, guitar and pause valve.
  panel(ctx, 8, 46, 105, 62, t('hud.hold'));
  preview(ctx, game.holdType, 18, 68, 85, 33, 12);
  panel(ctx, W - 126, 46, 118, 62, t('hud.next'));
  preview(ctx, game.next[0], W - 116, 68, 98, 33, 12);
  stat(ctx, W / 2, 51, t('hud.score'), game.score, 'center');
  ctx.fillStyle = '#ad9878';
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${t('hud.lines')} ${game.lines}  ·  ${t('hud.level')} ${game.level}`, W / 2, 101);
}

function drawFx(ctx, fx, layout) {
  if (!fx) return;
  const { x, y, cell, boardW } = layout;
  ctx.save();
  for (const ring of fx.rings) {
    const p = 1 - ring.life / ring.max;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.strokeStyle = p < 0.5 ? '#fff1a1' : '#ff6537';
    ctx.lineWidth = (3 + p * 16) * (1 - p);
    ctx.beginPath();
    ctx.moveTo(x - p * 55, y + ring.y * cell);
    ctx.lineTo(x + boardW + p * 55, y + ring.y * cell);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx.particles) {
    const life = Math.max(0, p.life / p.max);
    const px = x + p.x * cell;
    const py = y + p.y * cell;
    const size = Math.max(1, p.size * cell);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle);
    ctx.globalAlpha = Math.min(1, life * 1.6);
    if (p.kind === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = life * 0.18;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, size * (1.5 - life * 0.4), 0, TAU); ctx.fill();
    } else if (p.kind === 'gear') {
      ctx.globalCompositeOperation = 'source-over';
      gear(ctx, 0, 0, size, 7, 0, p.color, life);
    } else if (p.kind === 'shard') {
      ctx.fillStyle = p.color;
      ctx.fillRect(-size, -size * 0.45, size * 2, size * 0.9);
    } else {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.2, size * 0.7);
      ctx.beginPath();
      ctx.moveTo(-p.vx * cell * 0.025, -p.vy * cell * 0.025);
      ctx.lineTo(0, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawBanner(ctx, fx, layout) {
  if (!fx || !fx.banner) return;
  const b = fx.banner;
  const p = 1 - b.life / b.max;
  const alpha = Math.min(1, b.life * 4) * Math.min(1, p * 6);
  const y = layout.y + layout.boardH * 0.42 - Math.sin(Math.min(1, p) * Math.PI) * 16;
  let label = b.key === 'hud.level' ? `${t('hud.level')} ${b.value}` : t(b.key);
  if (b.detail && b.detail.perfect) label += ` · ${t('hud.perfect')}`;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${layout.mobile ? 25 : 34}px Georgia, serif`;
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#17110c';
  ctx.strokeText(label, layout.x + layout.boardW / 2, y);
  ctx.fillStyle = b.detail && b.detail.count === 4 ? '#fff09a' : '#ffbd62';
  ctx.fillText(label, layout.x + layout.boardW / 2, y);
  ctx.restore();
}

function paused(ctx, W) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,7,7,0.76)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe0a0';
  ctx.font = '900 31px Georgia, serif';
  ctx.fillText(t('hud.pause'), W / 2, H * 0.46);
  ctx.fillStyle = '#b7a58c';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(t('hud.pauseHint'), W / 2, H * 0.46 + 36);
  ctx.restore();
}

export function drawGame(ctx, game, W, fx, time = 0) {
  drawBackdrop(ctx, W, time);
  if (!game) return;
  const layout = layoutFor(W);
  const shake = fx ? fx.shake * layout.cell * 0.11 : 0;
  ctx.save();
  if (shake) ctx.translate(Math.sin(time * 79) * shake, Math.cos(time * 67) * shake * 0.7);
  drawBoard(ctx, game, layout);
  if (layout.mobile) drawMobileHud(ctx, game, layout, W);
  else drawDesktopHud(ctx, game, layout, W);
  drawFx(ctx, fx, layout);
  drawBanner(ctx, fx, layout);
  ctx.restore();

  if (fx && fx.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = fx.flash * 0.22;
    ctx.fillStyle = '#ffd96f';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (game.phase === 'paused') paused(ctx, W);
}
