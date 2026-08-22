// The picture: the playfield on the left, the backglass panel on the right —
// the Space Cadet window, repainted in Omarchy's Tokyo Night.
//
// Everything that never moves (felt, painted art, walls, lanes) is rendered
// once into an offscreen layer at device resolution and blitted per frame;
// the glow-heavy moving parts (bumpers, flippers, ball, lights, panel) are
// drawn live on top. Glow is shadowBlur, and shadowBlur is expensive — the
// split is what keeps a phone at 60.

import { C, TABLE, PANEL, FRAME, H, PLUNGER, RULES, MISSIONS, RANKS } from './config.js';
import { flipperTip } from './table.js';
import { beat } from './audio.js';

const T = TABLE;
const FONT = '"Segoe UI", system-ui, sans-serif';
const MONO = 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace';

export function createRenderer(t) {
  let layer = null;
  let layerKey = '';
  const sparks = [];

  function spark(x, y, color, n = 8, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4, max: 0.4, color });
    }
  }

  function drawStatic(k) {
    const w = Math.ceil(524 * k);
    const h = Math.ceil(H * k);
    layer = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    layer.width = w;
    layer.height = h;
    const g = layer.getContext('2d');
    g.scale(k, k);
    paintTableStatic(g);
  }

  /** now = seconds, for the light animations. */
  function draw(ctx, game, vp, { now = 0, attract = false } = {}) {
    const s = Math.min(1, vp.W / FRAME);
    const ox = (vp.W - FRAME * s) / 2;
    const oy = (H - H * s) / 2;

    paintBackdrop(ctx, vp, now);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    const k = vp.scale * vp.dpr * s;
    const key = k.toFixed(2);
    if (!layer || layerKey !== key) {
      layerKey = key;
      drawStatic(k);
    }
    ctx.drawImage(layer, 0, 0, 524, H);

    paintDynamic(ctx, game, now, attract);
    paintPanel(ctx, game, vp, now, attract, t);

    ctx.restore();
  }

  // ---------------------------------------------------------------- moving parts

  function paintDynamic(ctx, game, now, attract) {
    const { table, state, ball } = game;
    const pulse = (i, span = 3) => (Math.floor(now * 4) + i) % span === 0 ? 1 : 0;

    // rollover lanes: three circle-A lamps
    table.rollovers.forEach((r, i) => {
      const lit = attract ? pulse(i) : r.lit || r.flash > 0;
      drawCircleA(ctx, r.x, r.y, 12, lit ? C.yellow : C.dim, lit ? 2.6 : 1.6, lit ? 14 : 0);
    });

    // drop targets
    for (const tg of table.targets) {
      const glowing = tg.up || tg.flash > 0;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = tg.up ? C.red : 'rgba(86,95,137,0.35)';
      if (glowing) { ctx.shadowColor = C.red; ctx.shadowBlur = 10 + tg.flash * 16; }
      ctx.beginPath();
      ctx.moveTo(tg.x1, tg.y1);
      ctx.lineTo(tg.x2, tg.y2);
      ctx.stroke();
      ctx.restore();
    }

    // slingshots: the kicking face flashes
    for (const sl of table.slings) {
      const f = attract ? pulse(2) * 0.6 : sl.flash;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sl.face.x1, sl.face.y1);
      ctx.lineTo(sl.face.x2, sl.face.y2);
      ctx.lineTo(sl.body[0].x2, sl.body[0].y2);
      ctx.closePath();
      ctx.fillStyle = f > 0 ? `rgba(247,118,142,${0.25 + f * 0.5})` : C.raised;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.red;
      if (f > 0) { ctx.shadowColor = C.red; ctx.shadowBlur = 18 * f; }
      ctx.stroke();
      ctx.restore();
    }

    // pop bumpers
    table.bumpers.forEach((b, i) => {
      const f = attract ? pulse(i) * 0.8 : b.flash;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14 + f * 26;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = f > 0.4 ? b.color : C.tableHi;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = b.color;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 9, 0, Math.PI * 2);
      ctx.strokeStyle = f > 0.4 ? C.bg : b.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawCircleA(ctx, b.x, b.y, 8, f > 0.4 ? C.bg : b.color, 2, 0);
      ctx.restore();
    });

    // the wormhole to the underground
    {
      const hcap = table.hole;
      ctx.save();
      const grad = ctx.createRadialGradient(hcap.x, hcap.y, 2, hcap.x, hcap.y, hcap.r + 4);
      grad.addColorStop(0, '#000');
      grad.addColorStop(1, C.table);
      ctx.beginPath();
      ctx.arc(hcap.x, hcap.y, hcap.r + 3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = C.green;
      ctx.shadowBlur = 10 + hcap.flash * 20;
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(hcap.x, hcap.y, 5 + i * 4, now * 2.4 + (i * Math.PI * 2) / 3, now * 2.4 + (i * Math.PI * 2) / 3 + 1.8);
        ctx.strokeStyle = `rgba(158,206,106,${0.7 - i * 0.18})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.restore();
    }

    // kickback lamp in the left outlane
    {
      const kb = table.kickback;
      const on = kb.lit || kb.flash > 0;
      ctx.save();
      ctx.strokeStyle = on ? C.green : C.dim;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      if (on) { ctx.shadowColor = C.green; ctx.shadowBlur = 10 + 8 * Math.sin(now * 6) + kb.flash * 20; }
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(kb.x - 8, kb.y + 4 - i * 11);
        ctx.lineTo(kb.x, kb.y - 6 - i * 11);
        ctx.lineTo(kb.x + 8, kb.y + 4 - i * 11);
        ctx.stroke();
      }
      ctx.restore();
    }

    // flippers
    for (const f of table.flippers) {
      const tip = flipperTip(f);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = C.blue;
      ctx.shadowBlur = 14;
      ctx.lineWidth = f.r * 2;
      ctx.strokeStyle = C.bright;
      ctx.beginPath();
      ctx.moveTo(f.px, f.py);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = f.r * 2 - 7;
      ctx.strokeStyle = C.blue;
      ctx.beginPath();
      ctx.moveTo(f.px + (tip.x - f.px) * 0.12, f.py + (tip.y - f.py) * 0.12);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.restore();
    }

    // plunger spring
    {
      const resting = state.phase === 'plunger';
      const top = resting ? ball.y + ball.r + 2 : 660;
      const bottom = 698;
      const cx = PLUNGER.x;
      const coils = 7;
      ctx.save();
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      if (state.charge > 0) { ctx.shadowColor = C.orange; ctx.shadowBlur = 12 * state.charge; }
      ctx.beginPath();
      ctx.moveTo(cx, top);
      for (let i = 0; i <= coils; i++) {
        const y = top + ((bottom - top) * i) / coils;
        ctx.lineTo(cx + (i % 2 === 0 ? -9 : 9), y);
      }
      ctx.lineTo(cx, bottom);
      ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.fillRect(cx - 12, bottom, 24, 7);
      if (resting && state.charge > 0) {
        ctx.fillStyle = C.red;
        ctx.fillRect(cx - 14, 706, 28 * state.charge, 4);
      }
      ctx.restore();
    }

    // the ball — chrome under neon
    if (state.phase !== 'over' && state.phase !== 'captured') {
      ctx.save();
      const g2 = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, ball.r + 1);
      g2.addColorStop(0, '#ffffff');
      g2.addColorStop(0.45, C.fg);
      g2.addColorStop(1, '#2a2f45');
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = g2;
      ctx.fill();
      ctx.restore();
    }

    // sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= 1 / 60;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.x += p.vx / 60;
      p.y += p.vy / 60;
      p.vy += 12;
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      ctx.globalAlpha = 1;
    }

    // TILT slams the whole playfield
    if (state.tilt && Math.floor(now * 3) % 2 === 0) {
      ctx.save();
      ctx.font = `900 110px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = C.red;
      ctx.shadowColor = C.red;
      ctx.shadowBlur = 40;
      ctx.fillText('TILT', 262, 420);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- backglass

  function paintPanel(ctx, game, vp, now, attract, t) {
    const { state } = game;
    const x = PANEL.x;
    const w = PANEL.w;
    const cx = x + w / 2;

    ctx.save();
    // cabinet
    roundRect(ctx, x, 12, w, H - 24, 16);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#14141d');
    bgGrad.addColorStop(1, '#101017');
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    // logo
    drawCircleA(ctx, x + 60, 78, 30, C.red, 4.5, 18 + 6 * Math.sin(now * 3));
    ctx.textAlign = 'left';
    ctx.font = `900 46px ${FONT}`;
    ctx.fillStyle = C.bright;
    ctx.shadowColor = C.purple;
    ctx.shadowBlur = 16;
    ctx.fillText(t('panel.title'), x + 108, 92);
    ctx.shadowBlur = 0;
    ctx.font = `italic 15px ${FONT}`;
    ctx.fillStyle = C.dim;
    ctx.fillText(t('panel.sub'), x + 110, 116);

    neonRule(ctx, x + 24, 140, w - 48);

    // score
    label(ctx, t('panel.score'), x + 28, 172);
    ctx.font = `700 58px ${MONO}`;
    ctx.textAlign = 'right';
    const digits = String(Math.floor(state.score));
    ctx.fillStyle = 'rgba(86,95,137,0.35)';
    ctx.fillText('0'.repeat(Math.max(0, 9 - digits.length)), x + w - 28 - measure(ctx, digits), 226);
    ctx.fillStyle = C.cyan;
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 18;
    ctx.fillText(digits, x + w - 28, 226);
    ctx.shadowBlur = 0;

    // balls + multiplier
    label(ctx, t('panel.ball'), x + 28, 268);
    for (let i = 0; i < Math.max(state.balls, 0); i++) {
      ctx.beginPath();
      ctx.arc(x + 40 + i * 30, 292, 9, 0, Math.PI * 2);
      ctx.fillStyle = C.fg;
      ctx.shadowColor = C.blue;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'right';
    label(ctx, t('panel.mult'), x + w - 28, 268, 'right');
    for (let m = 2; m <= RULES.maxMult; m++) {
      const lit = state.mult >= m;
      const bx = x + w - 28 - (RULES.maxMult - m) * 52;
      ctx.font = `800 20px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = lit ? C.yellow : 'rgba(86,95,137,0.4)';
      if (lit) { ctx.shadowColor = C.yellow; ctx.shadowBlur = 12; }
      ctx.fillText('x' + m, bx, 298);
      ctx.shadowBlur = 0;
    }

    neonRule(ctx, x + 24, 322, w - 48);

    // rank
    label(ctx, t('panel.rank'), x + 28, 352);
    ctx.textAlign = 'left';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = C.purple;
    ctx.shadowColor = C.purple;
    ctx.shadowBlur = 10;
    ctx.fillText(t('rank.' + RANKS[state.rank]), x + 28, 384);
    ctx.shadowBlur = 0;

    // mission card
    const m = MISSIONS[state.mission];
    const goal = game.missionGoal();
    roundRect(ctx, x + 24, 404, w - 48, 108, 10);
    ctx.fillStyle = 'rgba(36,40,59,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(158,206,106,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    label(ctx, t('panel.mission') + ` ${state.missionsDone + 1}`, x + 40, 430);
    ctx.textAlign = 'left';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillStyle = C.green;
    ctx.fillText(t('mission.' + m.id), x + 40, 458);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.fillText(t(`mission.${m.id}.how`, { n: goal }), x + 40, 480);
    // progress bar
    const bw = w - 80;
    ctx.fillStyle = 'rgba(13,13,19,0.9)';
    ctx.fillRect(x + 40, 492, bw, 8);
    ctx.fillStyle = C.green;
    ctx.shadowColor = C.green;
    ctx.shadowBlur = 8;
    ctx.fillRect(x + 40, 492, bw * Math.min(1, state.progress / goal), 8);
    ctx.shadowBlur = 0;

    // ticker: event message, or what the machine is waiting for
    ctx.textAlign = 'center';
    ctx.font = `800 24px ${FONT}`;
    let line = null;
    let color = C.yellow;
    if (state.phase === 'over') { line = t('panel.gameOver'); color = C.red; }
    else if (state.msgTimer > 0 && state.message) line = t(state.message.key, state.message.values);
    else if (state.tilt) { line = t('panel.tilt'); color = C.red; }
    else if (state.phase === 'plunger') { line = t('panel.pull'); color = C.fg; }
    else if (state.inPlayfield && state.ballSave > 0) { line = t('panel.save') + ' · ' + Math.ceil(state.ballSave); color = C.cyan; }
    if (line && (state.msgTimer <= 0 || Math.floor(now * 5) % 4 !== 3)) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillText(line, cx, 552);
      ctx.shadowBlur = 0;
    }

    // best
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = C.dim;
    ctx.fillText(`${t('panel.best')}: ${game.best || 0}`, cx, 582);

    // equalizer, dancing to the soundtrack's step clock
    const bars = 22;
    const bw2 = (w - 96) / bars;
    for (let i = 0; i < bars; i++) {
      const ph = beat.step + i;
      const hgt = attract
        ? 6 + 5 * Math.abs(Math.sin(now * 2 + i * 0.6))
        : 5 + 26 * Math.abs(Math.sin(ph * 2.7 + i)) * (0.4 + 0.6 * Math.abs(Math.sin(now * 9 + i)));
      const hue = [C.blue, C.purple, C.cyan, C.green][i % 4];
      ctx.fillStyle = hue;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x + 48 + i * bw2, 646 - hgt, bw2 - 4, hgt);
    }
    ctx.globalAlpha = 1;

    // controls / footer
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = C.dim;
    ctx.fillText(t('panel.freeplay'), cx, 692);

    ctx.restore();
  }

  // ---------------------------------------------------------------- static art

  function paintBackdrop(ctx, vp, now) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b11');
    g.addColorStop(1, C.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vp.W, H);
    // a faint drifting starfield, so an ultrawide's margins aren't dead black
    ctx.fillStyle = 'rgba(169,177,214,0.14)';
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 379.7) % 1) * vp.W + ((i * 97) % vp.W);
      const sy = ((i * 173 + now * (4 + (i % 5))) % H);
      ctx.fillRect((sx % vp.W), sy, 2, 2);
    }
  }

  function paintTableStatic(g) {
    // cabinet edge
    roundRect(g, 4, 0, 516, 718, 14);
    g.fillStyle = '#0b0b10';
    g.fill();
    g.strokeStyle = C.blue;
    g.lineWidth = 2.5;
    g.shadowColor = C.blue;
    g.shadowBlur = 14;
    g.stroke();
    g.shadowBlur = 0;

    // felt
    roundRect(g, 10, 4, 504, 710, 10);
    const felt = g.createLinearGradient(0, 0, 0, H);
    felt.addColorStop(0, C.tableHi);
    felt.addColorStop(0.5, C.table);
    felt.addColorStop(1, '#121218');
    g.fillStyle = felt;
    g.fill();

    g.save();
    roundRect(g, 10, 4, 504, 710, 10);
    g.clip();

    // painted decor: echo arcs of the dome
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(T.arch.cx, T.arch.cy, T.arch.r - 40 - i * 34, Math.PI, Math.PI * 2);
      g.strokeStyle = i % 2 ? 'rgba(187,154,247,0.12)' : 'rgba(122,162,247,0.12)';
      g.lineWidth = 8;
      g.stroke();
    }
    // the big watermark: a circle-A the size of the lower playfield
    g.globalAlpha = 0.05;
    drawCircleA(g, 244, 470, 150, C.bright, 16, 0);
    g.globalAlpha = 1;
    // rays out of the bumper triangle
    g.strokeStyle = 'rgba(125,207,255,0.07)';
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(233 + Math.cos(a) * 60, 263 + Math.sin(a) * 60);
      g.lineTo(233 + Math.cos(a) * 130, 263 + Math.sin(a) * 130);
      g.stroke();
    }
    // inlane chevrons
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const [cxx, dir] of [[123, 1], [365, -1]]) {
      g.strokeStyle = 'rgba(158,206,106,0.5)';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(cxx - 7 * dir, 560 + i * 26);
        g.lineTo(cxx, 572 + i * 26);
        g.lineTo(cxx + 7 * dir, 560 + i * 26);
        g.stroke();
      }
    }
    // outlane warning chevrons
    for (const cxx of [46, 444]) {
      g.strokeStyle = 'rgba(247,118,142,0.45)';
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(cxx - 7, 596 + i * 26);
        g.lineTo(cxx, 608 + i * 26);
        g.lineTo(cxx + 7, 596 + i * 26);
        g.stroke();
      }
    }
    g.restore();

    // the dome wall
    g.beginPath();
    g.arc(T.arch.cx, T.arch.cy, T.arch.r + 5, Math.PI, Math.PI * 2);
    g.strokeStyle = '#2f3450';
    g.lineWidth = 12;
    g.stroke();
    g.beginPath();
    g.arc(T.arch.cx, T.arch.cy, T.arch.r + 5, Math.PI, Math.PI * 2);
    g.strokeStyle = C.line;
    g.lineWidth = 2;
    g.stroke();

    // every capsule wall, three passes: shadow, body, spine
    const walls = staticWalls();
    for (const [width, color] of [[2.4, '#0b0b10'], [2, '#2f3450'], [0.5, C.line]]) {
      g.lineCap = 'round';
      g.strokeStyle = color;
      for (const wl of walls) {
        g.lineWidth = Math.max(1.5, wl.rad * width);
        g.beginPath();
        g.moveTo(wl.x1, wl.y1);
        g.lineTo(wl.x2, wl.y2);
        g.stroke();
      }
    }

    // the deflector posts
    for (const [px, py, pr] of [[438, 322, 9], [396, 250, 8], [62, 232, 8]]) {
      const pg = g.createRadialGradient(px - 2, py - 2, 1, px, py, pr);
      pg.addColorStop(0, C.fg);
      pg.addColorStop(1, '#2a2f45');
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fillStyle = pg;
      g.fill();
      g.strokeStyle = C.cyan;
      g.lineWidth = 1.5;
      g.stroke();
    }

    // target back wall gets a warning tint
    g.strokeStyle = 'rgba(247,118,142,0.5)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(44, 310);
    g.lineTo(102, 442);
    g.stroke();
  }

  // the walls the static layer paints — table.js owns the physics copies; this
  // list only exists because the layer is drawn before any game is created
  function staticWalls() {
    return [
      { x1: T.left, y1: T.arch.cy, x2: T.left, y2: T.bottom, rad: 6 },
      { x1: T.right, y1: T.arch.cy, x2: T.right, y2: 700, rad: 6 },
      { x1: T.laneWall, y1: 700, x2: T.right, y2: 700, rad: 6 },
      { x1: T.laneWall, y1: 300, x2: T.laneWall, y2: T.bottom, rad: 6 },
      { x1: 470, y1: 298, x2: 508, y2: 278, rad: 4 },
      { x1: 136, y1: 56, x2: 136, y2: 140, rad: 5 },
      { x1: 208, y1: 30, x2: 208, y2: 140, rad: 5 },
      { x1: 280, y1: 30, x2: 280, y2: 140, rad: 5 },
      { x1: 352, y1: 56, x2: 352, y2: 140, rad: 5 },
      { x1: 44, y1: 310, x2: 102, y2: 442, rad: 6 },
      { x1: 88, y1: 545, x2: 118, y2: 640, rad: 5 },
      { x1: 118, y1: 640, x2: 154, y2: 662, rad: 5 },
      { x1: 400, y1: 545, x2: 370, y2: 640, rad: 5 },
      { x1: 370, y1: 640, x2: 334, y2: 662, rad: 5 },
    ];
  }

  return { draw, spark };
}

// ---------------------------------------------------------------- helpers

function label(ctx, text, x, y, align = 'left') {
  ctx.textAlign = align;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = C.dim;
  ctx.fillText(String(text).toUpperCase(), x, y);
}

function measure(ctx, text) {
  return ctx.measureText(text).width;
}

function neonRule(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(122,162,247,0)');
  g.addColorStop(0.5, 'rgba(122,162,247,0.8)');
  g.addColorStop(1, 'rgba(122,162,247,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The circle-A, drawn — the A's legs and bar overshoot the circle, as they do
 *  on every wall it was ever sprayed on. */
export function drawCircleA(ctx, x, y, r, color, lw, glow = 0) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  const s = r * 1.25;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.62, y + s * 0.7);
  ctx.lineTo(x, y - s * 0.78);
  ctx.lineTo(x + s * 0.62, y + s * 0.7);
  ctx.moveTo(x - s * 0.78, y + s * 0.22);
  ctx.lineTo(x + s * 0.72, y + s * 0.1);
  ctx.stroke();
  ctx.restore();
}
