// Putting the frame together: the field in world coordinates, the interface in
// viewport coordinates, and nothing in between.
//
// The split matters. The field is a fixed 1280x720 stage that gets scaled to
// whatever the window turned out to be, so a castle at column 3 is at column 3
// on every screen. The dock and the top bar are drawn *after* that transform is
// dropped, against the real viewport, so they hug the edges of the screen the
// player actually has and stay the same size on a phone and a monitor.

import { BASE_Y, CELL, COLS, ROWS } from './config.js';
import { MATERIALS, material } from './materials.js';
import { WEAPONS } from './weapons.js';
import { drawBlock, drawLauncher, drawShot, drawShotIcon } from './art.js';
import { button, dockLayout, hit, label, meter, paletteLayout, panel, shopButtons, textWidth } from './ui.js';
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
const CORNER = 116;

export function drawField(ctx, view) {
  const { match, scene, fx, faction, time } = view;
  scene.drawSky(ctx);
  scene.drawGround(ctx);

  for (const side of ['player', 'enemy']) {
    drawCastle(ctx, match, side, match.faction[side], fx, time);
  }

  drawLauncher(ctx, match.launchers.player, match.faction.player, { loaded: match.turn === 'player' && !match.flying() });
  drawLauncher(ctx, match.launchers.enemy, match.faction.enemy, { loaded: match.turn === 'enemy' && !match.flying() });

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
    drawShot(ctx, s, time * 6);
  }

  scene.drawWeather(ctx);
  drawOffscreen(ctx, match);
}

function drawCastle(ctx, match, side, faction, fx, time) {
  const castle = match.castles[side];
  for (const b of castle.blocks()) {
    const rect = castle.rect(b.c, b.r);
    drawBlock(ctx, b, rect, { faction });
    if (b.fire > 0 && Math.random() < 0.5) fx.flame(rect.x + rect.w / 2, rect.y + 4);
    if (b.rust > 0 && Math.random() < 0.15) fx.rust(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (b.shake > 0) b.shake = Math.max(0, b.shake - 0.03);
  }
}

function drawParticles(ctx, fx) {
  for (const ring of fx.rings) {
    const k = 1 - ring.life / ring.max;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r * (0.35 + k * 1.15), 0, TAU);
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
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 0.5 + (1 - a) * 1.2 : 1), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** A shell above the top of the field is still a shell: say where it is. */
function drawOffscreen(ctx, match) {
  for (const s of match.shots) {
    if (s.y > 6) continue;
    ctx.save();
    ctx.fillStyle = 'rgba(255,220,150,0.9)';
    ctx.beginPath();
    ctx.moveTo(s.x, 6);
    ctx.lineTo(s.x - 8, -8);
    ctx.lineTo(s.x + 8, -8);
    ctx.closePath();
    ctx.fill();
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
  const speed = (power / 100) * 690 * w.speed;
  let x = L.x + L.dir * Math.cos(a) * 34;
  let y = L.y - 28 - Math.sin(a) * 34;
  let vx = Math.cos(a) * speed * L.dir;
  let vy = -Math.sin(a) * speed;

  ctx.save();
  ctx.fillStyle = 'rgba(255,240,200,0.85)';
  for (let i = 0; i < 22; i++) {
    vy += 520 * 0.03;
    vx += match.wind * w.wind * 0.03;
    x += vx * 0.03;
    y += vy * 0.03;
    if (i % 2) continue;
    ctx.globalAlpha = 0.9 - i / 26;
    ctx.beginPath();
    ctx.arc(x, y, 3.2 - i * 0.08, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // and the arm's own line, so the angle is readable at a glance
  ctx.save();
  ctx.strokeStyle = 'rgba(255,220,150,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(L.x, L.y - 28);
  ctx.lineTo(L.x + L.dir * Math.cos(a) * 120, L.y - 28 - Math.sin(a) * 120);
  ctx.stroke();
  ctx.restore();
}

/**
 * The gauge, at the bottom of the screen where the thumb and the dock already
 * are. It lived over the trebuchet for a while, which reads beautifully on an
 * empty field and lands on top of your own castle the moment you build one.
 */
export function drawGauge(ctx, vp, power, charging) {
  const w = 260;
  const h = 16;
  const x = (vp.W - w) / 2;
  const y = vp.H - 152;
  panel(ctx, x - 10, y - 10, w + 20, h + 20, { fill: 'rgba(12,10,16,0.72)', r: 10 });
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#5fd16a');
  g.addColorStop(0.55, '#e8d24a');
  g.addColorStop(1, '#e8563a');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, (power / 100) * w, h);
  if (charging) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + (power / 100) * w - 1.5, y - 5, 3, h + 10);
  }
  label(ctx, t('hud.power'), x - 18, y + h / 2, { size: 12, weight: 600, color: '#b9b0a0', align: 'right' });
  label(ctx, String(Math.round(power)), x + w + 18, y + h / 2, { size: 15, color: '#ffe9b8' });
}

// -------------------------------------------------------------------- HUD

export function drawBattleHud(ctx, vp, state) {
  const { match, level, phase, power = 0 } = state;
  const rects = [];

  // --- top bar
  const barH = 46;
  panel(ctx, 0, -12, vp.W, barH + 12, { r: 0, stroke: null, fill: 'rgba(14,12,18,0.62)' });

  const turnText =
    match.over ? '' : match.turn === 'player' ? t('turn.you') : t('turn.foe');
  label(ctx, turnText, 16, barH / 2 - 2, { size: 19, color: match.turn === 'player' ? '#ffe08a' : '#ff9b9b', shadow: true });

  label(ctx, `${t(`lv.${level.id}`)} · ${t('hud.turn', { n: match.turnCount + 1 })}`, vp.W - CORNER, barH / 2 - 2, {
    size: 15, align: 'right', color: '#d8cdb4',
  });

  drawWind(ctx, vp.W / 2, barH / 2 - 2, match.wind);

  // --- the two crowns
  drawCrownBar(ctx, 16, barH + 10, match, 'player', false);
  drawCrownBar(ctx, vp.W - 16 - 190, barH + 14, match, 'enemy', true);

  // --- the dock
  const ids = Object.keys(match.ammo.player);
  const dock = dockLayout(vp.W, vp.H, ids);
  for (const r of dock) {
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
    drawShotIcon(ctx, r.id, r.x + r.w / 2 - 6, r.y + 21, 0.95);
    ctx.restore();
    label(ctx, ammo === Infinity ? t('hud.infinite') : String(ammo), r.x + r.w - 9, r.y + 14, {
      size: 15, align: 'right', color: on ? '#2a2210' : off ? 'rgba(240,232,214,0.4)' : '#ffe08a',
    });
    // the name gets the whole width: squeezed into the gap beside the icon it
    // came out as "Trebuc…" and "Ballista…", which is a dock of four ellipses
    label(ctx, fit(ctx, weaponName(r.id), r.w - 12, 11), r.x + r.w / 2, r.y + r.h - 13, {
      size: 11, weight: 600, align: 'center', color: on ? '#2a2210' : off ? 'rgba(240,232,214,0.35)' : '#cdc3ae',
    });
    rects.push({ ...r, kind: 'weapon' });
  }

  // --- the gauge and what to do next
  if (!match.over && match.turn === 'player' && !match.flying()) {
    drawGauge(ctx, vp, power, phase === 'charging');
    const hintText = phase === 'charging' ? t('hud.tapFire') : t('hud.tapPower');
    const wpx = textWidth(ctx, hintText, 16) + 28;
    panel(ctx, vp.W / 2 - wpx / 2, vp.H - 118, wpx, 30, { fill: 'rgba(12,10,16,0.6)', r: 15 });
    label(ctx, hintText, vp.W / 2, vp.H - 103, { size: 16, align: 'center', color: '#ffe9b8' });
  }

  return rects;
}

function fit(ctx, text, max, size) {
  if (textWidth(ctx, text, size, 600) <= max) return text;
  let s = text;
  while (s.length > 3 && textWidth(ctx, s + '…', size, 600) > max) s = s.slice(0, -1);
  return s + '…';
}

function drawCrownBar(ctx, x, y, match, side, mirror) {
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
  const strength = Math.abs(wind) / 58;
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
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const rect = castle.rect(c, r);
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
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

function brushNote(brush) {
  if (brush === 'king') return t('shop.hint');
  if (brush === 'erase') return t('shop.hint');
  const m = MATERIALS[brush];
  const span = m.span > 0 ? t('shop.span', { n: m.span }) : t('shop.spanNone');
  return `${materialName(brush)} — ${t(`m.${brush}.note`)} · ${t('shop.hp', { n: m.hp })} · ${span}`;
}

export { hit };
