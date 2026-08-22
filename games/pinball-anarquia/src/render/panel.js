// The score, in the two places it can live.
//
//   beside  — the full backglass, standing to the right of the machine
//   upright — a display across the top of a phone, and one row of readouts
//
// Both are the same three pieces (display, readouts, mission), laid out for
// the room they have. The dot-matrix underneath is shared: it sizes itself
// from the box it is given, and composes more or fewer lines depending on how
// many rows of lamps that box turned out to have.

import { C, RULES, MISSIONS, RANKS } from '../config.js';
import { beat } from '../audio.js';
import { dots, gridSprite, paintDots } from './dmd.js';
import { makeCanvas } from './util.js';
import { alpha, mix, glow, roundRect, circleA } from './util.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
const PI = Math.PI;
const PITCH = 5; // the size a lamp wants to be, in logical pixels

let grid = null;
let gridKey = '';

export function paintScore(ctx, game, layout, now, attract, t, k = 1) {
  if (layout.mode === 'upright') upright(ctx, game, layout, now, attract, t);
  else beside(ctx, game, layout, now, attract, t, k);
}

// ---------------------------------------------------------------- upright

function upright(ctx, game, layout, now, attract, t) {
  const { dmd, strip } = layout;
  const s = game.state;

  display(ctx, game, dmd, now, attract, t, true);

  // one row: rank on the left, mission and its bar in the middle, ball and
  // multiplier on the right. On a phone this is the whole backglass.
  const y = strip.y;
  const midY = y + 15;

  ctx.textAlign = 'left';
  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = mix(C.purple, '#ffffff', 0.3);
  ctx.fillText(t('rank.' + RANKS[s.rank]), strip.x + 2, midY);

  ctx.textAlign = 'right';
  for (let i = 0; i < Math.max(s.balls, 0); i++) {
    const bx = strip.x + strip.w - 6 - i * 15;
    glow(ctx, C.blue, bx, midY - 5, 14, 0.5);
    ctx.beginPath();
    ctx.arc(bx, midY - 5, 5.5, 0, PI * 2);
    ctx.fillStyle = C.bright;
    ctx.fill();
  }

  // mission or message, whichever the machine is saying
  const line = say(game, now, attract, t);
  ctx.textAlign = 'center';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = line.color;
  ctx.fillText(clip(ctx, line.text, strip.w - 12), strip.x + strip.w / 2, y + 34);

  // progress, wall to wall
  const goal = game.missionGoal();
  const done = Math.min(1, s.progress / goal);
  const by = y + 43;
  ctx.fillStyle = 'rgba(6,7,14,0.9)';
  roundRect(ctx, strip.x, by, strip.w, 6, 3);
  ctx.fill();
  if (done > 0) {
    glow(ctx, C.green, strip.x + (strip.w * done) / 2, by + 3, strip.w * done * 0.5, 0.45);
    ctx.fillStyle = mix(C.green, '#ffffff', 0.2);
    roundRect(ctx, strip.x, by, Math.max(6, strip.w * done), 6, 3);
    ctx.fill();
  }
}

/** Trim to fit, with an ellipsis — a phone's row has no second line. */
function clip(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 4 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

// ---------------------------------------------------------------- beside

/**
 * The backglass beside the machine.
 *
 * Most of it is a picture of a box and never changes, and painting that box —
 * two large gradient fills, a logo, a rule and half a dozen labels — was
 * costing more per frame than the entire playfield. It is baked into a layer
 * keyed by its size and by the words on it, so it is rebuilt when the window
 * resizes or the flag changes, and blitted every other frame.
 */
let chrome = null;
let chromeKey = '';

function beside(ctx, game, layout, now, attract, t, k) {
  const { panel } = layout;
  const { state } = game;
  const x = panel.x;
  const w = panel.w;
  const yBase = 386;
  const dmdBox = { x: x + 22, y: 116, w: w - 44, h: 232 };

  const key = `${w}x${panel.h}@${k.toFixed(2)}:${t('panel.rank')}|${t('panel.mission')}|${t('panel.sub')}|${t('panel.freeplay')}`;
  if (chromeKey !== key) {
    chromeKey = key;
    chrome = makeCanvas(Math.ceil(w * k), Math.ceil(panel.h * k));
    const g = chrome.getContext('2d');
    // absolute coordinates keep working inside the layer
    g.setTransform(k, 0, 0, k, -x * k, -panel.y * k);
    cabinet(g, panel);
    header(g, x, w, t);
    label(g, 'BALL', x + 26, yBase);
    label(g, 'MULTIPLIER', x + w - 26, yBase, 'right');
    label(g, t('panel.rank').toUpperCase(), x + 26, yBase + 56);
    missionFrame(g, x, w, yBase + 106);
    displayGlass(g, dmdBox, k);
    g.textAlign = 'center';
    g.font = `13px ${FONT}`;
    g.fillStyle = alpha(C.dim, 0.9);
    g.fillText(t('panel.freeplay'), x + w / 2, 694);
  }
  ctx.drawImage(chrome, x, panel.y, w, panel.h);

  logoPulse(ctx, x, now);
  display(ctx, game, dmdBox, now, attract, t);
  ballsAndMult(ctx, state, x, w, yBase);
  rankPlate(ctx, state, x, w, yBase + 56, t);
  missionCard(ctx, game, x, w, yBase + 106, t);
  equalizer(ctx, x, w, 662, now, attract);
}

function cabinet(ctx, panel) {
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 18);
  const body = ctx.createLinearGradient(panel.x, 0, panel.x + panel.w, 720);
  body.addColorStop(0, '#151622');
  body.addColorStop(0.5, '#101018');
  body.addColorStop(1, '#0b0b12');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = alpha(C.blue, 0.4);
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, panel.x + 5, panel.y + 5, panel.w - 10, panel.h - 10, 14);
  ctx.strokeStyle = alpha('#000000', 0.7);
  ctx.lineWidth = 3;
  ctx.stroke();
}

function logoPulse(ctx, x, now) {
  glow(ctx, C.red, x + 54, 58, 44, 0.5 + 0.2 * Math.sin(now * 3), true);
  circleA(ctx, x + 54, 58, 25, mix(C.red, '#ffffff', 0.25), 4);
}

function header(ctx, x, w, t) {
  ctx.textAlign = 'left';
  ctx.font = `900 ${Math.min(40, (w - 120) / 4.6)}px ${FONT}`;
  const grad = ctx.createLinearGradient(0, 38, 0, 74);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, C.bright);
  grad.addColorStop(1, C.purple);
  ctx.fillStyle = grad;
  ctx.fillText('ANARCHY', x + 94, 68);
  ctx.font = `italic 12px ${FONT}`;
  ctx.fillStyle = alpha(C.dim, 0.95);
  ctx.fillText(t('panel.sub'), x + 96, 87);

  neonRule(ctx, x + 22, 100, w - 44);
}

function ballsAndMult(ctx, state, x, w, y) {
  for (let i = 0; i < Math.max(state.balls, 0); i++) {
    const bx = x + 38 + i * 28;
    glow(ctx, C.blue, bx, y + 23, 20, 0.5);
    const g = ctx.createRadialGradient(bx - 3, y + 20, 1, bx, y + 23, 9);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, C.fg);
    g.addColorStop(1, '#232840');
    ctx.beginPath();
    ctx.arc(bx, y + 23, 8.5, 0, PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  for (let m = 2; m <= RULES.maxMult; m++) {
    const lit = state.mult >= m;
    const bx = x + w - 38 - (RULES.maxMult - m) * 44;
    if (lit) glow(ctx, C.yellow, bx, y + 18, 26, 0.7);
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = lit ? mix(C.yellow, '#ffffff', 0.35) : alpha(C.dim, 0.5);
    ctx.fillText('x' + m, bx, y + 26);
  }
}

function rankPlate(ctx, state, x, w, y, t) {
  const name = t('rank.' + RANKS[state.rank]);
  ctx.textAlign = 'left';
  ctx.font = `800 25px ${FONT}`;
  glow(ctx, C.purple, x + 28 + ctx.measureText(name).width / 2, y + 20, 52, 0.35);
  ctx.fillStyle = mix(C.purple, '#ffffff', 0.3);
  ctx.fillText(name, x + 26, y + 30);

  const pipW = (w - 52) / RANKS.length;
  for (let i = 0; i < RANKS.length; i++) {
    ctx.fillStyle = i <= state.rank ? alpha(C.purple, 0.85) : alpha(C.line, 0.6);
    roundRect(ctx, x + 26 + i * pipW, y + 40, pipW - 6, 5, 2.5);
    ctx.fill();
  }
}

function missionFrame(ctx, x, w, y) {
  roundRect(ctx, x + 22, y, w - 44, 108, 12);
  const card = ctx.createLinearGradient(x, y, x, y + 108);
  card.addColorStop(0, 'rgba(36,40,59,0.7)');
  card.addColorStop(1, 'rgba(20,22,34,0.7)');
  ctx.fillStyle = card;
  ctx.fill();
  ctx.strokeStyle = alpha(C.green, 0.45);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function missionCard(ctx, game, x, w, y, t) {
  const s = game.state;
  const m = MISSIONS[s.mission];
  const goal = game.missionGoal();

  label(ctx, `${t('panel.mission')} ${s.missionsDone + 1}  ·  LV ${s.level}`, x + 38, y + 24);
  ctx.textAlign = 'left';
  ctx.font = `800 21px ${FONT}`;
  ctx.fillStyle = mix(C.green, '#ffffff', 0.2);
  ctx.fillText(clip(ctx, t('mission.' + m.id), w - 76), x + 38, y + 50);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = alpha(C.fg, 0.9);
  ctx.fillText(clip(ctx, t(`mission.${m.id}.how`, { n: goal }), w - 76), x + 38, y + 71);

  const bw = w - 76;
  ctx.fillStyle = 'rgba(6,7,14,0.9)';
  roundRect(ctx, x + 38, y + 82, bw, 9, 4.5);
  ctx.fill();
  const done = Math.min(1, s.progress / goal);
  if (done > 0) {
    glow(ctx, C.green, x + 38 + (bw * done) / 2, y + 86, bw * done * 0.6, 0.5);
    ctx.fillStyle = mix(C.green, '#ffffff', 0.2);
    roundRect(ctx, x + 38, y + 82, Math.max(9, bw * done), 9, 4.5);
    ctx.fill();
  }
  ctx.textAlign = 'right';
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = alpha(C.dim, 0.95);
  ctx.fillText(`${s.progress} / ${goal}`, x + w - 38, y + 78);
}

function equalizer(ctx, x, w, y, now, attract) {
  const bars = 22;
  const bw = (w - 76) / bars;
  const hues = [C.blue, C.purple, C.cyan, C.green, C.magenta];
  for (let i = 0; i < bars; i++) {
    const ph = beat.step + i;
    const h = attract
      ? 7 + 6 * Math.abs(Math.sin(now * 2 + i * 0.5))
      : 6 + 30 * Math.abs(Math.sin(ph * 2.7 + i)) * (0.35 + 0.65 * Math.abs(Math.sin(now * 9 + i)));
    const color = hues[i % hues.length];
    const bx = x + 38 + i * bw;
    ctx.fillStyle = alpha(color, 0.92);
    ctx.fillRect(bx, y - h, bw - 4, h);
  }
  ctx.fillStyle = alpha(C.line, 0.7);
  ctx.fillRect(x + 38, y + 1, w - 76, 2);
}

// ---------------------------------------------------------------- the display

/**
 * The dot-matrix, sized to whatever box it was handed.
 *
 * How many lamps fit decides what it can say: a backglass has room for the
 * score, a status line and a sentence; the strip across the top of a phone has
 * room for the score, and the sentence goes underneath it in ordinary type.
 */
function dmdShape(box) {
  const cols = Math.max(24, Math.round(box.w / PITCH));
  const pitch = box.w / cols;
  const rows = Math.max(10, Math.floor(box.h / pitch));
  return { cols, pitch, rows, dh: rows * pitch };
}

/** The unlit half of the display: its glass, and every dot it has, dark. */
function displayGlass(ctx, box) {
  const { cols, pitch, rows, dh } = dmdShape(box);
  roundRect(ctx, box.x - 9, box.y - 9, box.w + 18, dh + 18, 8);
  ctx.fillStyle = '#05060b';
  ctx.fill();
  ctx.strokeStyle = alpha(C.line, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();
  const gk = `${cols}x${rows}@${pitch.toFixed(2)}`;
  if (gridKey !== gk) {
    grid = gridSprite(cols, rows, pitch, 'rgba(122,162,247,0.07)');
    gridKey = gk;
  }
  ctx.drawImage(grid, box.x, box.y);
}

function display(ctx, game, box, now, attract, t, withGlass = false) {
  const { cols, pitch, rows, dh } = dmdShape(box);
  if (withGlass) displayGlass(ctx, box);

  const lines = ticker(game, now, attract, t, rows >= 30);
  const key = `${lines.score}|${lines.left}|${lines.msg}`;

  const bits = dots(cols, rows, key, (g) => {
    g.font = `bold ${Math.max(7, Math.round(rows * 0.2))}px Arial, sans-serif`;
    g.textAlign = 'left';
    g.fillText(lines.left, 2, Math.round(rows * 0.21));

    const scoreSize = rows >= 30 ? [24, 21, 18, 16, 14] : [17, 15, 13, 11];
    const sc = fit(g, [lines.score], cols - 4, scoreSize);
    g.font = `bold ${sc.size}px Arial, sans-serif`;
    g.textAlign = 'right';
    g.fillText(lines.score, cols - 2, rows >= 30 ? 27 : rows - 2);

    if (!lines.msg) return;
    // The two forms get their own sizes and their own baselines. Sharing them
    // is what clipped the wrapped second line off the bottom of the display:
    // a size that fits one line across does not fit two down.
    g.textAlign = 'center';
    const one = fit(g, [lines.msg], cols - 4, [13, 12, 11, 10]);
    if (one.fitted) {
      g.font = `bold ${one.size}px Arial, sans-serif`;
      g.fillText(lines.msg, cols / 2, rows - 2);
    } else {
      const two = fit(g, [wrapCandidates(lines.msg)], cols - 4, [10, 9, 8, 7]);
      g.font = `bold ${two.size}px Arial, sans-serif`;
      g.fillText(two.lines[0], cols / 2, rows - 11);
      g.fillText(two.lines[1] || '', cols / 2, rows - 2);
    }
  });

  glow(ctx, lines.color, box.x + box.w / 2, box.y + dh / 2, box.w * 0.34, 0.22);
  paintDots(ctx, bits, cols, rows, box.x, box.y, pitch, lines.color);

  const sheen = ctx.createLinearGradient(0, box.y, 0, box.y + dh);
  sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(box.x, box.y, box.w, dh);
}

/** What the machine is saying right now, and what colour it burns. */
function say(game, now, attract, t) {
  const s = game.state;
  if (attract) return { text: t('panel.pull'), color: C.cyan };
  if (s.phase === 'over') return { text: t('panel.gameOver'), color: C.red };
  if (s.msgTimer > 0 && s.message) return { text: t(s.message.key, s.message.values), color: C.yellow };
  if (s.tilt) return { text: t('panel.tilt'), color: C.red };
  if (s.phase === 'plunger') return { text: t('panel.pull'), color: C.cyan };
  if (s.inPlayfield && s.ballSave > 0) return { text: `${t('panel.save')} ${Math.ceil(s.ballSave)}`, color: C.cyan };
  return { text: t('mission.' + MISSIONS[s.mission].id), color: C.green };
}

function ticker(game, now, attract, t, roomForMessage) {
  const s = game.state;
  const score = String(Math.floor(s.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const left = attract ? 'FREE PLAY' : `${t('panel.ball').toUpperCase()} ${s.ballInPlay}  x${s.mult}`;
  if (!roomForMessage) return { score, left, msg: '', color: C.purple };

  if (attract) {
    const beatIdx = Math.floor(now / 2.4) % 3;
    return {
      score,
      left,
      msg: [t('panel.title') + ' PINBALL', t('panel.pull').toUpperCase(), t('panel.sub').toUpperCase()][beatIdx],
      color: C.purple,
    };
  }
  const line = say(game, now, attract, t);
  return { score, left, msg: line.text.toUpperCase(), color: line.color };
}

// ---------------------------------------------------------------- fitting

/** The largest of `sizes` at which every line fits inside `maxW`. */
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
