// The backglass: the lit box beside the table where the machine talks to you.
//
// The Space Cadet window put its score and its running commentary in a
// dot-matrix strip, and that display is doing more work than it looks like:
// it is the only part of a pinball machine that can say a whole sentence, so
// it is where the missions, the warnings and the bragging live.

import { C, PANEL, RULES, MISSIONS, RANKS } from '../config.js';
import { beat } from '../audio.js';
import { dots, gridSprite, paintDots } from './dmd.js';
import { alpha, mix, glow, roundRect, circleA } from './util.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
const PI = Math.PI;

// The display, in lamps. Everything about its layout is in dot units.
const COLS = 112;
const ROWS = 46;

let grid = null;

export function paintPanel(ctx, game, now, attract, t) {
  const { state } = game;
  const x = PANEL.x;
  const w = PANEL.w;
  const cx = x + w / 2;

  cabinet(ctx, x, w);
  header(ctx, x, w, now);
  display(ctx, game, x, w, now, attract, t);

  const yBase = 400;
  ballsAndMult(ctx, state, x, w, yBase);
  rankPlate(ctx, state, x, w, yBase + 58, t);
  missionCard(ctx, game, x, w, yBase + 108, t);
  equalizer(ctx, x, w, 664, now, attract);

  ctx.textAlign = 'center';
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = alpha(C.dim, 0.9);
  ctx.fillText(t('panel.freeplay'), cx, 692);
}

// ---------------------------------------------------------------- shell

function cabinet(ctx, x, w) {
  roundRect(ctx, x, 10, w, 700, 18);
  const body = ctx.createLinearGradient(x, 0, x + w, 720);
  body.addColorStop(0, '#151622');
  body.addColorStop(0.5, '#101018');
  body.addColorStop(1, '#0b0b12');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = alpha(C.blue, 0.4);
  ctx.lineWidth = 2;
  ctx.stroke();
  // an inner bevel, so the box has a thickness
  roundRect(ctx, x + 5, 15, w - 10, 690, 14);
  ctx.strokeStyle = alpha('#000000', 0.7);
  ctx.lineWidth = 3;
  ctx.stroke();
}

function header(ctx, x, w, now) {
  const cy = 62;
  glow(ctx, C.red, x + 62, cy, 62, 0.45 + 0.12 * Math.sin(now * 3));
  circleA(ctx, x + 62, cy, 28, mix(C.red, '#ffffff', 0.25), 4.5);

  ctx.textAlign = 'left';
  ctx.font = `900 42px ${FONT}`;
  const grad = ctx.createLinearGradient(x + 110, 40, x + 110, 82);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, C.bright);
  grad.addColorStop(1, C.purple);
  ctx.fillStyle = grad;
  ctx.fillText('ANARCHY', x + 108, 74);
  ctx.font = `italic 13px ${FONT}`;
  ctx.fillStyle = alpha(C.dim, 0.95);
  ctx.fillText('pinball liberation front', x + 110, 94);

  neonRule(ctx, x + 24, 108, w - 48);
}

// ---------------------------------------------------------------- the DMD

function display(ctx, game, x, w, now, attract, t) {
  const { state } = game;
  const pitch = (w - 52) / COLS;
  const dx = x + 26;
  const dy = 124;
  const dw = COLS * pitch;
  const dh = ROWS * pitch;

  // the glass
  roundRect(ctx, dx - 10, dy - 10, dw + 20, dh + 20, 8);
  ctx.fillStyle = '#05060b';
  ctx.fill();
  ctx.strokeStyle = alpha(C.line, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();

  if (!grid || grid.width !== Math.ceil(COLS * pitch)) {
    grid = gridSprite(COLS, ROWS, pitch, 'rgba(122,162,247,0.07)');
  }
  ctx.drawImage(grid, dx, dy);

  // What the machine has to say, in the order it would say it.
  const lines = ticker(game, now, attract, t);
  const key = `${lines.score}|${lines.left}|${lines.msg}`;

  const bits = dots(COLS, ROWS, key, (g) => {
    g.font = 'bold 9px Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText(lines.left, 2, 9);

    // the score is fitted too: nine digits with thousands spaces is a much
    // wider string than four, and a display cannot scroll a number
    const score = fit(g, [lines.score], COLS - 4, [24, 21, 18, 16, 14]);
    g.font = `bold ${score.size}px Arial, sans-serif`;
    g.textAlign = 'right';
    g.fillText(lines.score, COLS - 2, 27);

    // A dot-matrix line has a hard width, and every phrase here exists in two
    // languages of different lengths — so the display shrinks the message
    // until it fits, and breaks it in two when shrinking alone would make it
    // unreadable. The first pass of this simply clipped, and Portuguese was
    // the language that lost its words.
    // The two forms get their own sizes and their own baselines. Sharing them
    // is what clipped the wrapped second line straight off the bottom of the
    // display: a size that fits one line across does not fit two down.
    g.textAlign = 'center';
    const one = fit(g, [lines.msg], COLS - 4, [13, 12, 11, 10]);
    if (one.fitted) {
      g.font = `bold ${one.size}px Arial, sans-serif`;
      g.fillText(lines.msg, COLS / 2, 44);
    } else {
      const two = fit(g, [wrapCandidates(lines.msg)], COLS - 4, [10, 9, 8, 7]);
      g.font = `bold ${two.size}px Arial, sans-serif`;
      g.fillText(two.lines[0], COLS / 2, 36);
      g.fillText(two.lines[1] || '', COLS / 2, 45);
    }
  });

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, lines.color, dx + dw / 2, dy + dh / 2, dw * 0.62, 0.18);
  ctx.restore();
  paintDots(ctx, bits, COLS, ROWS, dx, dy, pitch, lines.color);

  // scanline sheen across the glass
  const sheen = ctx.createLinearGradient(0, dy, 0, dy + dh);
  sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(dx, dy, dw, dh);
}

/** The three things on the display, and what colour they burn. */
function ticker(game, now, attract, t) {
  const s = game.state;
  const score = String(Math.floor(s.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (attract) {
    const beatIdx = Math.floor(now / 2.4) % 3;
    return {
      score: score === '0' ? '0' : score,
      left: t('panel.freeplay').toUpperCase(),
      msg: [t('panel.title') + ' PINBALL', t('panel.pull').toUpperCase(), t('panel.sub').toUpperCase()][beatIdx],
      color: C.purple,
    };
  }

  const left = `${t('panel.ball').toUpperCase()} ${s.ballInPlay}   ${'x' + s.mult}`;
  let msg = '';
  let color = C.purple;

  if (s.phase === 'over') {
    msg = t('panel.gameOver').toUpperCase();
    color = C.red;
  } else if (s.msgTimer > 0 && s.message) {
    msg = t(s.message.key, s.message.values).toUpperCase();
    color = C.yellow;
  } else if (s.tilt) {
    msg = t('panel.tilt');
    color = C.red;
  } else if (s.phase === 'plunger') {
    msg = t('panel.pull').toUpperCase();
    color = C.cyan;
  } else if (s.inPlayfield && s.ballSave > 0) {
    msg = `${t('panel.save').toUpperCase()} ${Math.ceil(s.ballSave)}`;
    color = C.cyan;
  } else {
    msg = t('mission.' + MISSIONS[s.mission].id).toUpperCase();
  }
  return { score, left, msg, color };
}

// ---------------------------------------------------------------- readouts

function ballsAndMult(ctx, state, x, w, y) {
  label(ctx, 'BALL', x + 28, y);
  for (let i = 0; i < Math.max(state.balls, 0); i++) {
    const bx = x + 40 + i * 30;
    glow(ctx, C.blue, bx, y + 24, 22, 0.5);
    const g = ctx.createRadialGradient(bx - 3, y + 21, 1, bx, y + 24, 10);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, C.fg);
    g.addColorStop(1, '#232840');
    ctx.beginPath();
    ctx.arc(bx, y + 24, 9, 0, PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  label(ctx, 'MULTIPLIER', x + w - 28, y, 'right');
  for (let m = 2; m <= RULES.maxMult; m++) {
    const lit = state.mult >= m;
    const bx = x + w - 40 - (RULES.maxMult - m) * 52;
    if (lit) glow(ctx, C.yellow, bx, y + 20, 30, 0.7);
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = lit ? mix(C.yellow, '#ffffff', 0.35) : alpha(C.dim, 0.5);
    ctx.fillText('x' + m, bx, y + 28);
  }
}

function rankPlate(ctx, state, x, w, y, t) {
  label(ctx, t('panel.rank').toUpperCase(), x + 28, y);
  const name = t('rank.' + RANKS[state.rank]);
  ctx.textAlign = 'left';
  ctx.font = `800 27px ${FONT}`;
  glow(ctx, C.purple, x + 30 + ctx.measureText(name).width / 2, y + 22, 90, 0.3);
  ctx.fillStyle = mix(C.purple, '#ffffff', 0.3);
  ctx.fillText(name, x + 28, y + 32);

  // the ladder, as pips: how far up a hierarchy you are while dismantling it
  const pipW = (w - 56) / RANKS.length;
  for (let i = 0; i < RANKS.length; i++) {
    const px = x + 28 + i * pipW;
    const on = i <= state.rank;
    ctx.fillStyle = on ? alpha(C.purple, 0.85) : alpha(C.line, 0.6);
    roundRect(ctx, px, y + 42, pipW - 6, 5, 2.5);
    ctx.fill();
  }
}

function missionCard(ctx, game, x, w, y, t) {
  const s = game.state;
  const m = MISSIONS[s.mission];
  const goal = game.missionGoal();

  roundRect(ctx, x + 24, y, w - 48, 108, 12);
  const card = ctx.createLinearGradient(x, y, x, y + 108);
  card.addColorStop(0, 'rgba(36,40,59,0.7)');
  card.addColorStop(1, 'rgba(20,22,34,0.7)');
  ctx.fillStyle = card;
  ctx.fill();
  ctx.strokeStyle = alpha(C.green, 0.45);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  label(ctx, `${t('panel.mission')} ${s.missionsDone + 1}  ·  LV ${s.level}`, x + 42, y + 26);
  ctx.textAlign = 'left';
  ctx.font = `800 23px ${FONT}`;
  ctx.fillStyle = mix(C.green, '#ffffff', 0.2);
  ctx.fillText(t('mission.' + m.id), x + 42, y + 54);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = alpha(C.fg, 0.9);
  ctx.fillText(t(`mission.${m.id}.how`, { n: goal }), x + 42, y + 76);

  const bw = w - 84;
  ctx.fillStyle = 'rgba(6,7,14,0.9)';
  roundRect(ctx, x + 42, y + 88, bw, 9, 4.5);
  ctx.fill();
  const done = Math.min(1, s.progress / goal);
  if (done > 0) {
    glow(ctx, C.green, x + 42 + (bw * done) / 2, y + 92, bw * done * 0.6, 0.5);
    ctx.fillStyle = mix(C.green, '#ffffff', 0.2);
    roundRect(ctx, x + 42, y + 88, Math.max(9, bw * done), 9, 4.5);
    ctx.fill();
  }
  ctx.textAlign = 'right';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = alpha(C.dim, 0.95);
  ctx.fillText(`${s.progress} / ${goal}`, x + w - 42, y + 84);
}

/** The lamps dancing to the soundtrack's own step clock. */
function equalizer(ctx, x, w, y, now, attract) {
  const bars = 26;
  const bw = (w - 100) / bars;
  const hues = [C.blue, C.purple, C.cyan, C.green, C.magenta];
  for (let i = 0; i < bars; i++) {
    const ph = beat.step + i;
    const h = attract
      ? 7 + 6 * Math.abs(Math.sin(now * 2 + i * 0.5))
      : 6 + 34 * Math.abs(Math.sin(ph * 2.7 + i)) * (0.35 + 0.65 * Math.abs(Math.sin(now * 9 + i)));
    const color = hues[i % hues.length];
    const bx = x + 50 + i * bw;
    glow(ctx, color, bx + bw / 2 - 2, y - h / 2, bw * 1.6, 0.28);
    ctx.fillStyle = alpha(color, 0.9);
    ctx.fillRect(bx, y - h, bw - 4, h);
  }
  ctx.fillStyle = alpha(C.line, 0.7);
  ctx.fillRect(x + 50, y + 1, w - 100, 2);
}

// ---------------------------------------------------------------- fitting

/**
 * The largest of `sizes` at which every line fits inside `maxW`.
 * Falls through to the smallest rather than failing: a slightly cramped line
 * is still readable, and an exception here would take the whole frame down.
 */
function fit(g, candidates, maxW, sizes) {
  for (const size of sizes) {
    g.font = `bold ${size}px Arial, sans-serif`;
    for (const lines of candidates) {
      const arr = Array.isArray(lines) ? lines : [lines];
      if (arr.every((l) => g.measureText(l).width <= maxW)) return { size, lines: arr, fitted: true };
    }
  }
  const last = candidates[candidates.length - 1];
  return { size: sizes[sizes.length - 1], lines: Array.isArray(last) ? last : [last], fitted: false };
}

/** Split at the word nearest the middle, so neither half is a stub. */
function wrapCandidates(text) {
  const words = String(text).split(' ');
  if (words.length < 2) return [text, ''];
  let cut = 1;
  let best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < best) {
      best = d;
      cut = i;
    }
  }
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

// ---------------------------------------------------------------- bits

function label(ctx, text, x, y, align = 'left') {
  ctx.textAlign = align;
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = alpha(C.dim, 0.95);
  ctx.fillText(String(text).toUpperCase(), x, y);
}

function neonRule(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, alpha(C.blue, 0));
  g.addColorStop(0.5, alpha(C.blue, 0.85));
  g.addColorStop(1, alpha(C.blue, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 2);
}
