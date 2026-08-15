// Putting the frame together: the field in world coordinates, the interface in
// viewport coordinates, and nothing in between.
//
// The split matters. The field is a fixed 1280x720 stage that gets scaled to
// whatever the window turned out to be, so a castle at column 3 is at column 3
// on every screen. The dock and the top bar are drawn *after* that transform is
// dropped, against the real viewport, so they hug the edges of the screen the
// player actually has and stay the same size on a phone and a monitor.

import { BASE_Y, CELL, COLS, DRIVE_FUEL, GRAVITY, GUN_HEIGHT, POWER_SPEED, ROWS, WIND_MAX } from './config.js';
import { MATERIALS, material } from './materials.js';
import { AMMO_CAP, WEAPONS, specials } from './weapons.js';
import { INK, drawBlock, drawLauncher, drawMinion, drawShot, drawShotIcon, ink } from './art.js';
import { battleLayout, button, hit, label, meter, paletteLayout, panel, shopButtons, textWidth } from './ui.js';
import { t, materialName, weaponName } from './i18n.js';

const TAU = Math.PI * 2;

/**
 * How much of the top-right corner belongs to somebody else.
 *
 * The two flags and the mute button are DOM, fixed to the corner of the window,
 * and they are there on every screen. Anything the canvas writes in that corner
 * is written underneath them — which is exactly what happened to the coin
 * count, and it is invisible until you look at a screenshot.
 */
const CORNER = 134;

export function drawField(ctx, view) {
  const { match, scene, fx, time, cam = { x: 0, y: 0 }, viewW = 1280 } = view;
  scene.drawSky(ctx, cam, viewW);
  // A drill that has broken the crust is *underground*, so it is drawn before
  // the dirt is and the dirt covers it. Drawn after, it slid across the face of
  // the hill in plain sight and read as a shell passing through solid ground.
  for (const s of match.shots) if (s.burrow > 0) drawShot(ctx, s, time * 6);
  scene.drawGround(ctx, cam, viewW);
  scene.drawProps(ctx, cam, viewW);

  for (const side of ['player', 'enemy']) {
    drawCastle(ctx, match, side, match.faction[side], fx, time);
  }

  // the ground war, walking between the two of them
  if (match.minions) {
    for (const mn of match.minions) drawMinion(ctx, mn, time);
  }

  for (const side of ['player', 'enemy']) {
    drawLauncher(ctx, match.launchers[side], match.faction[side], {
      loaded: match.turn === side && !match.flying(),
      time,
    });
    // a puff where it ran into something it could not climb
    const L = match.launchers[side];
    if (L.blocked > 0) {
      ctx.save();
      ctx.globalAlpha = L.blocked * 2;
      ctx.beginPath();
      ctx.arc(L.x + L.dir * 26, L.y - 14, 7, 0, TAU);
      ink(ctx, '#e8dcc0', 2);
      ctx.restore();
    }
  }

  // the ghost of the last shot each side took: the only aiming aid in the game,
  // and the same one a real gunner gets
  for (const side of ['player', 'enemy']) {
    const last = match.lastShot[side];
    if (!last || !last.path.length) continue;
    ctx.save();
    ctx.strokeStyle = side === 'player' ? 'rgba(255,235,180,0.32)' : 'rgba(255,150,150,0.26)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(last.path[0].x, last.path[0].y);
    for (const p of last.path) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }

  drawParticles(ctx, fx);

  for (const s of match.shots) {
    if (s.burrow > 0) continue;
    drawShot(ctx, s, time * 6);
  }

  scene.drawWeather(ctx, cam, viewW);
  drawGusts(ctx, cam, viewW, match.wind, time);
  drawOffscreen(ctx, match, cam);
}

/**
 * The wind, made visible: little comet-streaks riding across the valley in the
 * direction the gauge is pointing, more and faster the harder it blows. Before
 * this the wind existed only as a number on a bar — the shell drifted and the
 * world it drifted through stood perfectly still, which read as the physics
 * being wrong rather than the weather being real.
 *
 * Stateless on purpose: everything is a function of (index, time), so it draws
 * anywhere on the field with nothing to allocate or keep in step.
 */
function drawGusts(ctx, cam, viewW, wind, time) {
  const strength = Math.min(1, Math.abs(wind) / WIND_MAX);
  if (strength < 0.06) return;
  const dir = wind >= 0 ? 1 : -1;
  const n = Math.round(5 + strength * 11);
  const span = viewW + 360;

  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const seed = (i * 127.31) % 1;
    const speed = (90 + (i % 5) * 45) * (0.35 + strength);
    const travel = (seed * 6000 + time * speed) % span;
    const x0 = cam.x - 180 + (dir > 0 ? travel : span - travel);
    const y0 = cam.y + 34 + (((i * 197) % 23) / 23) * 500;
    const len = (30 + (i % 4) * 16) * (0.5 + strength);
    const bob = Math.sin(time * 2.2 + i * 1.9) * 5;

    ctx.globalAlpha = (0.08 + strength * 0.22) * (0.55 + 0.45 * Math.sin(time * 3.1 + i * 2.3));
    ctx.beginPath();
    ctx.moveTo(x0, y0 + bob);
    ctx.quadraticCurveTo(x0 + dir * len * 0.45, y0 + bob - 8, x0 + dir * len, y0 + bob - 2);
    // a curl on the nose, so it reads as a gust and not as a scratch
    ctx.quadraticCurveTo(x0 + dir * (len + 9), y0 + bob - 8, x0 + dir * (len + 4), y0 + bob - 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCastle(ctx, match, side, faction, fx, time) {
  const castle = match.castles[side];
  drawFooting(ctx, castle, side);
  for (const b of castle.blocks()) {
    const rect = castle.rect(b.c, b.r);
    // The top of a column gets the decorated lid — battlements, a shingle roof,
    // a riveted cap. It is what turns a stack of squares into architecture, and
    // it is skipped under the siege engine, which is already standing there.
    const gunCol = Math.floor((match.launchers[side].x - castle.baseX) / CELL);
    const top = !castle.at(b.c, b.r + 1) && b.c !== gunCol;
    drawBlock(ctx, b, rect, { faction, top });
    if (b.fire > 0 && Math.random() < 0.5) fx.flame(rect.x + rect.w / 2, rect.y + 4);
    if (b.rust > 0 && Math.random() < 0.15) fx.rust(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (b.shake > 0) b.shake = Math.max(0, b.shake - 0.03);
  }
  drawBanners(ctx, castle, faction, time, Math.floor((match.launchers[side].x - castle.baseX) / CELL), match.wind);
}

/**
 * The plinth and the shadow the castle sits in.
 *
 * Blocks drawn straight onto turf look like they were dropped there. A course of
 * dressed stone under the bottom row and a soft shadow around it is four lines
 * of code and the difference between a stack of squares and a building with
 * foundations — and because it is drawn per column, a column that has been
 * blown away leaves a gap in the footing too.
 */
function drawFooting(ctx, castle, side) {
  const cols = [];
  for (let c = 0; c < COLS; c++) if (castle.at(c, 0)) cols.push(c);
  if (!cols.length) return;

  ctx.save();
  ctx.fillStyle = 'rgba(24,16,10,0.28)';
  for (const c of cols) {
    ctx.beginPath();
    ctx.ellipse(castle.baseX + c * CELL + CELL / 2, BASE_Y + 7, CELL * 0.72, 9, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  for (const c of cols) {
    const x = castle.baseX + c * CELL;
    ctx.beginPath();
    ctx.moveTo(x - 3, BASE_Y + 11);
    ctx.lineTo(x - 1, BASE_Y - 3);
    ctx.lineTo(x + CELL + 1, BASE_Y - 3);
    ctx.lineTo(x + CELL + 3, BASE_Y + 11);
    ctx.closePath();
    ink(ctx, '#7d7466', 2.5);
  }
}

/**
 * A pennant on the highest tower, which is what says the castle is *held* —
 * and a weathervane now: it streams the way the wind blows, harder in a gale,
 * so the two flags agree with the gauge in the top bar.
 */
function drawBanners(ctx, castle, faction, time, gunCol, wind = 0) {
  let best = -1;
  let bestTop = 2;
  for (let c = 0; c < COLS; c++) {
    if (c === gunCol) continue;
    for (let r = ROWS - 1; r > bestTop; r--) {
      if (castle.at(c, r)) {
        bestTop = r;
        best = c;
        break;
      }
    }
  }
  if (best < 0) return;
  const x = castle.baseX + best * CELL + CELL / 2;
  const y = BASE_Y - (bestTop + 1) * CELL;
  // the flag is drawn pointing -x, so streaming with a rightward wind means
  // flipping it; in a near-calm it falls back to facing away from the enemy
  const gale = Math.abs(wind) > 6;
  const dir = gale ? (wind > 0 ? -1 : 1) : castle.side === 'player' ? 1 : -1;
  ctx.save();
  ctx.translate(x, y - 12);
  ctx.scale(dir, 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, -34);
  ctx.stroke();
  const flutter = 1 + Math.min(1, Math.abs(wind) / WIND_MAX) * 1.4;
  const wave = Math.sin(time * (3.4 + flutter) + best) * 3 * flutter;
  ctx.beginPath();
  ctx.moveTo(1, -34);
  ctx.lineTo(-20 + wave, -29);
  ctx.lineTo(-13 + wave, -24);
  ctx.lineTo(-20 + wave, -19);
  ctx.lineTo(1, -21);
  ctx.closePath();
  ink(ctx, faction === 'machines' ? '#3fb6e0' : '#c0335a', 2.5);
  ctx.restore();
}

function drawParticles(ctx, fx) {
  for (const ring of fx.rings) {
    const k = 1 - ring.life / ring.max;
    ctx.save();
    if (ring.flash && ring.life > ring.max - ring.flash) {
      const f = (ring.life - (ring.max - ring.flash)) / ring.flash;
      ctx.globalAlpha = f;
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r * (0.5 + (1 - f) * 0.9), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = (1 - k) * 0.85;
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 9 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r * (0.35 + k * 1.35), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  for (const b of fx.bolts) {
    const k = b.life / b.max;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#dffaff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#5ac8ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const jx = i === steps ? 0 : (Math.sin(b.seed + i * 3.7) * 18);
      const jy = i === steps ? 0 : (Math.cos(b.seed + i * 2.3) * 18);
      ctx.lineTo(b.x + (b.tx - b.x) * f + jx, b.y + (b.ty - b.y) * f + jy);
    }
    ctx.stroke();
    ctx.restore();
  }
  for (const p of fx.parts) {
    const a = Math.min(1, p.life / (p.max * 0.5));
    ctx.save();
    ctx.globalAlpha = p.kind === 'smoke' ? a * 0.45 : a;
    ctx.fillStyle = p.color;
    if (p.kind === 'chip') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
    } else if (p.kind === 'num') {
      // the number a hit was worth, floating off the block that paid it
      ctx.font = `800 ${p.size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(24,14,8,0.85)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 0.5 + (1 - a) * 1.2 : 1), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** A shell above the top of the view is still a shell: say where it is. */
function drawOffscreen(ctx, match, cam) {
  for (const s of match.shots) {
    if (s.y > cam.y + 8) continue;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s.x, cam.y + 8);
    ctx.lineTo(s.x - 11, cam.y - 12);
    ctx.lineTo(s.x + 11, cam.y - 12);
    ctx.closePath();
    ink(ctx, '#ffd97a', 2.5);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- aiming

/**
 * The first slice of the shot's arc, dotted.
 *
 * Deliberately short. The whole trajectory drawn out turns every turn into
 * reading a line off the screen; a hand's length of it says which way the arm
 * is pointing, and the rest is the gunner's problem.
 */
export function drawAim(ctx, match, side, angle, power) {
  const L = match.launchers[side];
  const w = WEAPONS[match.weapon[side]];
  const a = (angle * Math.PI) / 180;
  const speed = (power / 100) * POWER_SPEED * w.speed;
  let x = L.x + L.dir * Math.cos(a) * 36;
  let y = L.y - GUN_HEIGHT - Math.sin(a) * 36;
  let vx = Math.cos(a) * speed * L.dir;
  let vy = -Math.sin(a) * speed;

  ctx.save();
  ctx.fillStyle = 'rgba(255,240,200,0.85)';
  for (let i = 0; i < 26; i++) {
    vy += GRAVITY * 0.026;
    vx += match.wind * w.wind * 0.026;
    x += vx * 0.026;
    y += vy * 0.026;
    if (i % 2) continue;
    ctx.globalAlpha = 0.95 - i / 30;
    ctx.beginPath();
    ctx.arc(x, y, 4 - i * 0.09, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // and the arm's own line, so the angle is readable at a glance
  ctx.save();
  ctx.strokeStyle = 'rgba(255,220,150,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(L.x, L.y - GUN_HEIGHT);
  ctx.lineTo(L.x + L.dir * Math.cos(a) * 140, L.y - GUN_HEIGHT - Math.sin(a) * 140);
  ctx.stroke();
  ctx.restore();
}

/**
 * The fire button: a round pad with the charge running round its rim.
 *
 * The bar used to be a separate strip in the middle of the screen, which meant
 * the thing you were watching and the thing you were pressing were in two
 * different places. Round the button, the charge is under the thumb that is
 * making it.
 */
export function drawFireButton(ctx, fire, power, charging, live) {
  const { cx, cy, r } = fire;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = !live ? 'rgba(24,22,28,0.55)' : charging ? 'rgba(232,187,74,0.94)' : 'rgba(38,34,44,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // the rim: empty when you are not holding it, and it is the only readout
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, TAU);
  ctx.stroke();
  if (power > 0) {
    ctx.strokeStyle = power > 82 ? '#e8563a' : power > 52 ? '#e8d24a' : '#5fd16a';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 7, -Math.PI / 2, -Math.PI / 2 + (power / 100) * TAU);
    ctx.stroke();
  }
  ctx.restore();

  const ink = !live ? 'rgba(240,232,214,0.4)' : charging ? '#2a2210' : '#f2e7d0';
  if (charging) {
    label(ctx, String(Math.round(power)), cx, cy - 4, { size: 24, align: 'center', color: ink });
    label(ctx, t('hud.release'), cx, cy + 16, { size: 10, weight: 600, align: 'center', color: ink });
  } else {
    label(ctx, t('hud.fire'), cx, cy, { size: 16, align: 'center', color: ink });
  }
}

// -------------------------------------------------------------------- HUD

export function drawBattleHud(ctx, vp, state) {
  const { match, level, phase, power = 0, driving = 0, aiming = 0 } = state;
  const rects = [];
  const L = match.launchers.player;
  const mine = !match.over && match.turn === 'player' && !match.flying();
  const canMove = mine && phase === 'aim';

  // --- top bar
  const barH = 46;
  panel(ctx, 0, -12, vp.W, barH + 12, { r: 0, stroke: null, fill: 'rgba(14,12,18,0.62)' });
  label(ctx, match.over ? '' : match.turn === 'player' ? t('turn.you') : t('turn.foe'), 16, barH / 2 - 2, {
    size: 19, color: match.turn === 'player' ? '#ffe08a' : '#ff9b9b', shadow: true,
  });
  label(ctx, `${t(`lv.${level.id}`)} · ${t('hud.turn', { n: match.turnCount + 1 })}`, vp.W - CORNER, barH / 2 - 2, {
    size: 15, align: 'right', color: '#d8cdb4',
  });
  drawWind(ctx, vp.W / 2, barH / 2 - 2, match.wind);

  drawCrownBar(ctx, 16, barH + 10, match, 'player');
  drawCrownBar(ctx, vp.W - 16 - 190, barH + 14, match, 'enemy');

  const ids = Object.keys(match.ammo.player);
  const bay = battleLayout(vp.W, vp.H, ids);

  // --- the munitions
  for (const r of bay.dock) {
    const ammo = match.ammo.player[r.id];
    const on = match.weapon.player === r.id;
    const off = !(ammo > 0);
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: off ? 'rgba(24,22,28,0.5)' : on ? 'rgba(232,187,74,0.92)' : 'rgba(30,27,36,0.86)',
      stroke: on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)',
      r: 9,
    });
    ctx.save();
    ctx.globalAlpha = off ? 0.35 : 1;
    drawShotIcon(ctx, r.id, r.x + r.w / 2 - 6, r.y + 21, 0.9);
    ctx.restore();
    label(ctx, ammo === Infinity ? t('hud.infinite') : String(ammo), r.x + r.w - 9, r.y + 14, {
      size: 15, align: 'right', color: on ? '#2a2210' : off ? 'rgba(240,232,214,0.4)' : '#ffe08a',
    });
    label(ctx, fit(ctx, weaponName(r.id), r.w - 12, 11), r.x + r.w / 2, r.y + r.h - 13, {
      size: 11, weight: 600, align: 'center', color: on ? '#2a2210' : off ? 'rgba(240,232,214,0.35)' : '#cdc3ae',
    });
    rects.push({ ...r, kind: 'weapon' });
  }

  // --- aim and drive, the right thumb
  const pad = (r, on, dead, glyph, size) => {
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: dead ? 'rgba(24,22,28,0.5)' : on ? 'rgba(232,187,74,0.92)' : 'rgba(30,27,36,0.86)',
      stroke: on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)',
      r: 9,
    });
    label(ctx, glyph, r.x + r.w / 2, r.y + r.h / 2 - 1, {
      size, align: 'center', color: dead ? 'rgba(240,232,214,0.35)' : on ? '#2a2210' : '#f2e7d0',
    });
  };
  for (const r of bay.aim) {
    pad(r, aiming === r.dir, !mine, r.dir > 0 ? '▲' : '▼', 17);
    rects.push({ ...r, kind: 'aim' });
  }
  for (const r of bay.drive) {
    pad(r, driving === r.dir, !canMove || L.fuel <= 0, r.dir < 0 ? '◀' : '▶', 22);
    rects.push({ ...r, kind: 'drive' });
  }

  const fuel = L.fuel / DRIVE_FUEL;
  label(ctx, `${t('hud.fuel')}`, bay.fuel.x, bay.fuel.y - 7, { size: 11, weight: 600, color: '#b9b0a0' });
  label(ctx, `${Math.round(L.angle)}°`, bay.fuel.x + bay.fuel.w, bay.fuel.y - 7, {
    size: 13, align: 'right', color: '#ffe08a',
  });
  meter(ctx, bay.fuel.x, bay.fuel.y, bay.fuel.w, bay.fuel.h, fuel, fuel > 0.35 ? '#6fd36a' : '#e8a24a');

  // --- the one button that ends the turn
  const firing = phase === 'charging';
  drawFireButton(ctx, bay.fire, power, firing, mine);
  rects.push({ ...bay.fire, kind: 'fire' });

  if (state.message) {
    label(ctx, state.message, vp.W / 2, bay.fire.cy - bay.fire.r - 34, {
      size: 16, align: 'center', color: '#ffb27a', shadow: true,
    });
  }

  return rects;
}

function fit(ctx, text, max, size) {
  if (textWidth(ctx, text, size, 600) <= max) return text;
  let s = text;
  while (s.length > 3 && textWidth(ctx, s + '…', size, 600) > max) s = s.slice(0, -1);
  return s + '…';
}

function drawCrownBar(ctx, x, y, match, side) {
  const w = 190;
  const castle = match.castles[side];
  const king = castle.king();
  const frac = king ? Math.max(0, king.hp) / king.max : 0;
  panel(ctx, x, y, w, 38, { fill: 'rgba(14,12,18,0.6)', r: 8 });
  label(ctx, '👑', x + 12, y + 19, { size: 16 });
  label(ctx, t(`king.${match.faction[side]}`), x + 34, y + 12, { size: 11, weight: 600, color: '#cdc3ae' });
  meter(ctx, x + 34, y + 22, w - 46, 10, frac, frac > 0.5 ? '#6fd36a' : frac > 0.22 ? '#e8c24a' : '#e8563a');
}

function drawWind(ctx, cx, cy, wind) {
  const strength = Math.min(1, Math.abs(wind) / WIND_MAX);
  label(ctx, t('hud.wind'), cx - 74, cy, { size: 12, weight: 600, color: '#b9b0a0', align: 'right' });
  const w = 120;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(cx - w / 2, cy - 6, w, 12);
  ctx.fillStyle = wind >= 0 ? '#7fd0ff' : '#ffb07f';
  const len = (w / 2) * strength;
  if (wind >= 0) ctx.fillRect(cx, cy - 6, len, 12);
  else ctx.fillRect(cx - len, cy - 6, len, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2 + 0.5, cy - 5.5, w - 1, 11);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9);
  ctx.lineTo(cx, cy + 9);
  ctx.stroke();
  ctx.restore();
  const dir = wind >= 0 ? '▶' : '◀';
  label(ctx, `${dir} ${Math.abs(wind).toFixed(0)}`, cx + w / 2 + 10, cy, { size: 12, weight: 600, color: '#d8cdb4' });
}

// --------------------------------------------------------------- workshop

export function drawShopGrid(ctx, shop, hover, faction) {
  const castle = shop.castle;
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,26,0.09)';
  ctx.fillRect(castle.baseX, BASE_Y - ROWS * CELL, COLS * CELL, ROWS * CELL);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const rect = castle.rect(c, r);
      ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, rect.w - 1.5, rect.h - 1.5);
    }
  }
  ctx.restore();

  for (const b of castle.blocks()) drawBlock(ctx, b, castle.rect(b.c, b.r), { faction });

  if (hover) {
    const rect = castle.rect(hover.c, hover.r);
    ctx.save();
    if (hover.ok) {
      ctx.globalAlpha = 0.55;
      if (shop.brush === 'erase') {
        ctx.strokeStyle = '#ff6a5a';
        ctx.lineWidth = 3;
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      } else {
        drawBlock(ctx, { c: hover.c, r: hover.r, m: shop.brush, hp: 1, max: 1, fire: 0, rust: 0, shake: 0 }, rect, { faction });
      }
    } else {
      ctx.fillStyle = 'rgba(220,60,50,0.32)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  // the plot line, so the ground under the castle reads as yours
  ctx.save();
  ctx.strokeStyle = 'rgba(255,225,150,0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(castle.baseX, BASE_Y + 1);
  ctx.lineTo(castle.baseX + COLS * CELL, BASE_Y + 1);
  ctx.stroke();
  ctx.restore();
}

export function drawShopHud(ctx, vp, shop, level, opts = {}) {
  const rects = [];

  panel(ctx, 0, -12, vp.W, 58, { r: 0, stroke: null, fill: 'rgba(14,12,18,0.66)' });
  label(ctx, t('shop.title'), 16, 16, { size: 20, color: '#ffe08a', shadow: true });
  label(ctx, `${t(`lv.${level.id}`)} — ${t(`lv.${level.id}.note`)}`, 16, 36, { size: 12, weight: 600, color: '#c8bda6' });

  const coins = `${shop.left()} / ${shop.coins} ${t('shop.coins')}`;
  label(ctx, coins, vp.W - CORNER, 22, { size: 18, align: 'right', color: shop.left() < 0 ? '#ff7a6a' : '#ffe08a' });

  // palette
  const ids = [...Object.keys(MATERIALS), 'king', 'erase'];
  const pal = paletteLayout(vp.W, vp.H, ids);
  for (const r of pal) {
    const on = shop.brush === r.id;
    const cost = r.id === 'king' || r.id === 'erase' ? 0 : MATERIALS[r.id].cost;
    const off = cost > shop.left();
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: off && !on ? 'rgba(24,22,28,0.5)' : on ? 'rgba(232,187,74,0.92)' : 'rgba(30,27,36,0.86)',
      stroke: on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)',
      r: 9,
    });
    const ink = on ? '#2a2210' : off ? 'rgba(240,232,214,0.4)' : '#f2e7d0';
    if (r.id === 'erase') {
      label(ctx, '✖', r.x + r.w / 2, r.y + 20, { size: 18, align: 'center', color: ink });
      label(ctx, fit(ctx, t('shop.erase'), r.w - 8, 11), r.x + r.w / 2, r.y + r.h - 14, { size: 11, weight: 600, align: 'center', color: ink });
    } else if (r.id === 'king') {
      label(ctx, '👑', r.x + r.w / 2, r.y + 20, { size: 18, align: 'center', color: ink });
      label(ctx, fit(ctx, t('shop.king'), r.w - 8, 11), r.x + r.w / 2, r.y + r.h - 14, { size: 11, weight: 600, align: 'center', color: ink });
    } else {
      const swatch = MATERIALS[r.id];
      ctx.save();
      ctx.fillStyle = swatch.face;
      ctx.fillRect(r.x + r.w / 2 - 11, r.y + 8, 22, 16);
      ctx.fillStyle = swatch.side;
      ctx.fillRect(r.x + r.w / 2 - 11, r.y + 20, 22, 4);
      ctx.restore();
      label(ctx, fit(ctx, materialName(r.id), r.w - 8, 11), r.x + r.w / 2, r.y + 36, { size: 11, weight: 600, align: 'center', color: ink });
      label(ctx, `${cost}`, r.x + r.w / 2, r.y + r.h - 13, { size: 13, align: 'center', color: on ? '#2a2210' : off ? '#ff8a7a' : '#ffe08a' });
    }
    rects.push({ ...r, kind: 'brush' });
  }

  drawIntel(ctx, vp, opts.foe, opts.foeFaction);
  rects.push(...drawArmory(ctx, shop));

  // buttons
  const texts = [
    { id: 'auto', text: t('shop.auto') },
    { id: 'clear', text: t('shop.clear') },
    { id: 'fight', text: t('shop.fight') },
  ];
  const btns = shopButtons(ctx, vp.W, vp.H, texts);
  const problem = shop.problem();
  for (const b of btns) {
    button(ctx, b, b.text, { on: b.id === 'fight' && !problem, off: b.id === 'fight' && !!problem });
    rects.push({ ...b, kind: 'shop' });
  }

  // what is in hand, and why the fight button is grey
  const note = problem ? t(`why.${problem}`) : brushNote(shop.brush);
  label(ctx, note, vp.W / 2, btns[0].y - 20, {
    size: 14, align: 'center', color: problem ? '#ff9b8a' : '#d8cdb4', shadow: true,
  });
  if (opts.message) {
    label(ctx, opts.message, vp.W / 2, btns[0].y - 42, { size: 15, align: 'center', color: '#ffb27a', shadow: true });
  }

  return rects;
}

/**
 * What you are building against, in miniature.
 *
 * The enemy plot is most of a map away now, so from the workshop you cannot see
 * it — and "how tall is their wall, and what is it made of" is the only question
 * the workshop is really for. It is the same `drawBlock` the battle uses, at a
 * third of the size, so a wall of iron looks like a wall of iron.
 */
function drawIntel(ctx, vp, foe, faction) {
  if (!foe) return;
  const scale = 0.38;
  const w = COLS * CELL * scale + 20;
  const h = ROWS * CELL * scale + 34;
  // top *left*: the right-hand corner belongs to the flags and the mute button,
  // and on a phone — where the canvas is lying on its side — they land exactly
  // on top of this panel
  const x = 14;
  const y = 62;
  panel(ctx, x, y, w, h, { fill: 'rgba(16,14,22,0.88)', r: 10 });
  label(ctx, t('shop.intel'), x + w / 2, y + 14, { size: 11, weight: 600, align: 'center', color: '#cdc3ae' });

  ctx.save();
  ctx.translate(x + 10, y + h - 10);
  ctx.scale(scale, scale);
  ctx.translate(-foe.baseX, -BASE_Y);
  for (const b of foe.blocks()) {
    drawBlock(ctx, b, foe.rect(b.c, b.r), { faction, top: !foe.at(b.c, b.r + 1) });
  }
  ctx.restore();
}

/**
 * The armory: the same purse as the walls, spent on shells instead.
 *
 * One row per limited munition — icon, name, price, and the count between a −
 * and a + the size of a thumb. It sits under the intel panel on the left,
 * because the top-right corner belongs to the flags (see CORNER) and the plot
 * itself starts further right at every width the game runs at.
 */
function drawArmory(ctx, shop) {
  if (!shop.faction) return [];
  const ids = specials(shop.faction);
  const w = 224;
  const rowH = 46;
  const x = 10;
  const y = 240;
  const h = 30 + ids.length * rowH + 6;
  const rects = [];

  panel(ctx, x, y, w, h, { fill: 'rgba(16,14,22,0.88)', r: 10 });
  label(ctx, t('shop.arsenal'), x + w / 2, y + 15, { size: 11, weight: 600, align: 'center', color: '#cdc3ae' });

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const ry = y + 28 + i * rowH;
    const count = shop.ammo[id] || 0;
    const price = WEAPONS[id].price;

    ctx.save();
    ctx.globalAlpha = count > 0 ? 1 : 0.45;
    drawShotIcon(ctx, id, x + 20, ry + rowH / 2 - 2, 0.6);
    ctx.restore();
    label(ctx, fit(ctx, weaponName(id), 92, 11), x + 38, ry + 13, { size: 11, weight: 600, color: '#e5dcc6' });
    label(ctx, t('shop.each', { n: price }), x + 38, ry + 29, { size: 11, color: '#b3a98f' });

    const minus = { id, kind: 'ammo', delta: -1, x: x + w - 84, y: ry + 4, w: 30, h: 34, pad: 8 };
    const plus = { id, kind: 'ammo', delta: 1, x: x + w - 36, y: ry + 4, w: 30, h: 34, pad: 8 };
    const canSell = count > 0;
    const canBuy = count < AMMO_CAP && price <= shop.left();
    for (const [r2, glyph, live] of [[minus, '−', canSell], [plus, '+', canBuy]]) {
      panel(ctx, r2.x, r2.y, r2.w, r2.h, {
        fill: live ? 'rgba(38,34,44,0.95)' : 'rgba(24,22,28,0.55)',
        stroke: 'rgba(255,255,255,0.16)',
        r: 8,
      });
      label(ctx, glyph, r2.x + r2.w / 2, r2.y + r2.h / 2, {
        size: 18, align: 'center', color: live ? '#f2e7d0' : 'rgba(240,232,214,0.3)',
      });
      rects.push(r2);
    }
    label(ctx, String(count), x + w - 61, ry + rowH / 2 - 2, {
      size: 17, align: 'center', color: count > 0 ? '#ffe08a' : 'rgba(240,232,214,0.4)',
    });
  }
  return rects;
}

function brushNote(brush) {
  if (brush === 'king') return t('shop.hint');
  if (brush === 'erase') return t('shop.hint');
  const m = MATERIALS[brush];
  const span = m.span > 0 ? t('shop.span', { n: m.span }) : t('shop.spanNone');
  return `${materialName(brush)} — ${t(`m.${brush}.note`)} · ${t('shop.hp', { n: m.hp })} · ${span}`;
}

export { hit };
