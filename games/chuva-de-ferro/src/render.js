// Everything the player sees, in one pass: sky, dunes, road, the soldier, the
// cargo, the shots and the HUD over all of it.
//
// The camera is the only trick worth naming — the world scrolls under a fixed
// soldier, so every world coordinate is drawn at `x - cam`, and the parallax
// layers move at a fraction of that.

import { COLOURS, H, PLAYER, clamp } from './config.js';
import { heightOf } from './player.js';
import { drawCargo } from './draw/cargo.js';
import { ball, block, groundShadow, outline, polygon, roundRect, shade, text } from './draw/paint.js';
import { pick, t } from './i18n.js';
import { WEAPON_BY_ID } from './weapons.js';
import { STICK, stickInput } from './controls.js';

const STEP = 14;   // how finely the road is sampled, in px

export function createRenderer() {
  let camX = 0;

  function camera(game, W) {
    const want = game.soldier.x - W * 0.34;
    camX += (want - camX) * 0.14;
    return Math.max(0, camX);
  }

  function sky(ctx, W, time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLOURS.skyTop);
    g.addColorStop(0.5, '#9a6a55');
    g.addColorStop(1, COLOURS.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // the freighter that started all this, hanging where it broke
    ctx.save();
    ctx.globalAlpha = 0.5;
    const shipX = W * 0.62 + Math.sin(time * 0.08) * 20;
    ctx.fillStyle = '#1b232c';
    ctx.beginPath();
    ctx.ellipse(shipX, 96 + Math.sin(time * 0.12) * 6, W * 0.34, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f151b';
    ctx.beginPath();
    ctx.ellipse(shipX - W * 0.08, 104, W * 0.1, 18, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#ffb375';
    ctx.beginPath();
    ctx.moveTo(shipX - 30, 120);
    ctx.lineTo(shipX + 30, 120);
    ctx.lineTo(shipX + 200, H);
    ctx.lineTo(shipX - 220, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function dunes(ctx, W, cam) {
    const layers = [
      { k: 0.12, y: 300, amp: 60, step: 240, colour: COLOURS.duneFar },
      { k: 0.28, y: 380, amp: 48, step: 180, colour: COLOURS.duneMid },
      { k: 0.5, y: 452, amp: 34, step: 130, colour: COLOURS.duneNear },
    ];
    for (const l of layers) {
      ctx.beginPath();
      ctx.moveTo(-40, H);
      for (let x = -40; x <= W + 40; x += 20) {
        const wx = (x + cam * l.k) / l.step;
        const y = l.y + Math.sin(wx) * l.amp + Math.sin(wx * 2.3 + 1.7) * l.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 40, H);
      ctx.closePath();
      ctx.fillStyle = l.colour;
      ctx.fill();
    }
  }

  function road(ctx, game, W, cam) {
    const { world } = game;
    ctx.beginPath();
    ctx.moveTo(-STEP, H);
    for (let sx = -STEP; sx <= W + STEP; sx += STEP) {
      ctx.lineTo(sx, world.groundAt(sx + cam));
    }
    ctx.lineTo(W + STEP, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 380, 0, H);
    g.addColorStop(0, COLOURS.groundLit);
    g.addColorStop(0.4, COLOURS.ground);
    g.addColorStop(1, '#4a3a26');
    ctx.fillStyle = g;
    ctx.fill();

    // the lit crest
    ctx.beginPath();
    for (let sx = -STEP; sx <= W + STEP; sx += STEP) {
      const y = world.groundAt(sx + cam);
      if (sx < 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
    }
    ctx.strokeStyle = '#d8b276';
    ctx.lineWidth = 4;
    ctx.stroke();

    // gravel
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 60; i++) {
      const wx = Math.floor((cam - 60) / 37) * 37 + i * 37;
      const y = world.groundAt(wx) + ((wx * 7919) % 40) + 12;
      ctx.fillRect(wx - cam, y, 3 + ((wx * 13) % 4), 2);
    }
  }

  function scenery(ctx, game, cam, W) {
    const { world } = game;
    for (const s of world.solidsNear(cam + W / 2, W)) {
      const x = s.x - cam;
      if (x < -220 || x > W + 220) continue;
      if (s.cargo) continue;                 // landed cargo draws itself, with its own art
      // a boulder, not a headstone: a wide base and a dome, drawn with arcs
      ctx.beginPath();
      ctx.moveTo(x - 4, s.y + s.h);
      ctx.bezierCurveTo(x - 6, s.y + s.h * 0.35, x + s.w * 0.16, s.y - 2, x + s.w * 0.5, s.y);
      ctx.bezierCurveTo(x + s.w * 0.84, s.y + 2, x + s.w + 6, s.y + s.h * 0.4, x + s.w + 4, s.y + s.h);
      ctx.closePath();
      ctx.fillStyle = '#8a7358';
      ctx.fill();
      outline(ctx, 3.5);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,240,210,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + s.w * 0.36, s.y + s.h * 0.34, s.w * 0.3, s.h * 0.22, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(40,26,16,0.28)';
      ctx.beginPath();
      ctx.ellipse(x + s.w * 0.86, s.y + s.h * 0.6, s.w * 0.3, s.h * 0.5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      groundShadow(ctx, x + s.w / 2, s.y + s.h, s.w * 0.6, 0.22);
    }

    for (const r of world.roofNear(cam + W / 2, W)) {
      const x = r.x - cam;
      if (x < -600 || x > W + 600) continue;
      // An overhang, not a slab: a band of rock hanging over the road, thick
      // enough to read as a cave mouth and no thicker. Drawing it up to the top
      // of the screen turned the desert into two brown walls.
      const lip = (i) => world.groundAt(r.x + i) - r.clear + Math.sin(clamp((i + 30) / (r.w + 60), 0, 1) * Math.PI) * 22;
      // thin, and rocky on top: a band 60 px deep reads as an overhang, a band
      // 200 px deep reads as a wall with a hole in it
      const thick = r.kind === 'cave' ? 78 : 58;
      ctx.beginPath();
      ctx.moveTo(x - 40, lip(-40) - thick * 0.5);
      for (let i = -40; i <= r.w + 40; i += 40) {
        const bump = Math.sin((r.x + i) * 0.013) * 14 + Math.sin((r.x + i) * 0.041) * 7;
        ctx.lineTo(x + i, lip(i) - thick - bump);
      }
      ctx.lineTo(x + r.w + 40, lip(r.w + 40) - thick * 0.5);
      ctx.lineTo(x + r.w + 40, lip(r.w + 40));
      for (let i = r.w + 40; i >= -40; i -= 22) ctx.lineTo(x + i, lip(i));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, lip(r.w / 2) - thick, 0, lip(r.w / 2));
      g.addColorStop(0, '#5b4936');
      g.addColorStop(0.7, '#8a7358');
      g.addColorStop(1, '#6a5642');
      ctx.fillStyle = g;
      ctx.fill();
      outline(ctx, 4);

      // the dark under the lip, which is what tells you to duck
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - 40, lip(-40));
      for (let i = -40; i <= r.w + 40; i += 22) ctx.lineTo(x + i, lip(i));
      ctx.lineTo(x + r.w + 40, lip(r.w + 40) + 30);
      ctx.lineTo(x - 40, lip(-40) + 30);
      ctx.closePath();
      ctx.fillStyle = 'rgba(20,12,6,0.35)';
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * The soldier, closer to the sprite this game is quoting: a helmet that reads
   * from across the screen, boots, a vest, and both hands on the rifle so the
   * gun swings with the aim instead of floating beside him.
   */
  function soldierArt(ctx, s, time) {
    const h = heightOf(s);
    const crouch = s.crouching;
    const x = s.x;
    const y = s.y;
    const f = s.facing;
    const blink = s.invuln > 0 && Math.floor(time * 14) % 2 === 0;

    groundShadow(ctx, x, y + 2, crouch ? 26 : 22, 0.42);
    ctx.save();
    if (blink) ctx.globalAlpha = 0.5;

    const running = Math.abs(s.vx) > 8 && s.onGround;
    const ph = s.step * 7.4;
    const swing = running ? Math.sin(ph) : 0;
    const bob = running ? Math.abs(Math.cos(ph)) * 3 : 0;

    const hipY = y - h * (crouch ? 0.34 : 0.46) + bob;
    const chestY = y - h * (crouch ? 0.62 : 0.80) + bob;
    const KHAKI = '#5c6b45';
    const KHAKI_D = '#3f4b2f';
    const BOOT = '#2a2721';

    // ---------------------------------------------------------------- legs
    const leg = (side, lean) => {
      const thigh = h * (crouch ? 0.2 : 0.27);
      const shin = h * (crouch ? 0.16 : 0.24);
      ctx.save();
      ctx.translate(x - f * 2, hipY);
      ctx.rotate(lean);
      block(ctx, -8, 0, 16, thigh, side < 0 ? KHAKI_D : KHAKI, { r: 6 });
      ctx.translate(0, thigh - 2);
      ctx.rotate(crouch ? -1.1 : Math.max(0, -lean) * 1.5 + (s.onGround ? 0 : 0.5));
      block(ctx, -7, 0, 14, shin, side < 0 ? KHAKI_D : KHAKI, { r: 5 });
      block(ctx, -9 + f * 3, shin - 3, 20, 11, BOOT, { r: 4, line: 2.5 });
      ctx.restore();
    };
    leg(-1, swing * 0.62 - (crouch ? 0.5 : 0) + (s.onGround ? 0 : -0.3));
    leg(1, -swing * 0.62 - (crouch ? 0.8 : 0) + (s.onGround ? 0 : 0.35));

    // -------------------------------------------------------------- torso
    const torsoH = h * (crouch ? 0.3 : 0.36);
    ctx.save();
    ctx.translate(x, chestY);
    ctx.rotate(f * (crouch ? 0.22 : 0.06) + (running ? Math.sin(ph * 2) * 0.02 : 0));
    // backpack, behind
    block(ctx, -f * 26, 2, 16, torsoH * 0.8, '#414b33', { r: 5, line: 2.5 });
    block(ctx, -16, -2, 32, torsoH, KHAKI, { r: 8 });
    // webbing
    ctx.fillStyle = 'rgba(20,18,12,0.45)';
    ctx.fillRect(-16, torsoH * 0.45, 32, 6);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-16, torsoH * 0.45, 32, 3);
    // two pouches on the belt
    block(ctx, -14, torsoH * 0.52, 11, 9, '#4a3f2a', { r: 2, line: 2 });
    block(ctx, 3, torsoH * 0.52, 11, 9, '#4a3f2a', { r: 2, line: 2 });
    ctx.restore();

    // --------------------------------------------------------------- head
    const headY = chestY - h * (crouch ? 0.1 : 0.1);
    ctx.save();
    ctx.translate(x + f * 3, headY);
    // jaw and face
    ball(ctx, 0, 0, 12, COLOURS.skin, { line: 2.5 });
    ctx.fillStyle = '#2a2016';
    ctx.beginPath();
    ctx.ellipse(f * 5, -1, 2.4, 3.2, 0, 0, Math.PI * 2);      // the eye
    ctx.fill();
    // helmet: a dome with a real brim, which is the whole silhouette
    ctx.beginPath();
    ctx.ellipse(0, -4, 16, 14, 0, Math.PI, 0);
    ctx.fillStyle = '#4e5b34';
    ctx.fill();
    outline(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(-17, -4);
    ctx.quadraticCurveTo(f * 4, 3, f * 22, -6);
    ctx.lineTo(f * 20, -10);
    ctx.quadraticCurveTo(f * 4, -2, -16, -9);
    ctx.closePath();
    ctx.fillStyle = '#5c6b3c';
    ctx.fill();
    outline(ctx, 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(-4, -11, 8, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // chin strap
    ctx.strokeStyle = '#2b2a20';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -2, 13, 0.5, 2.4);
    ctx.stroke();
    ctx.restore();

    // ---------------------------------------------------------- the rifle
    const shoulder = { x: x + f * 2, y: chestY + torsoH * 0.28 };
    const kick = s.recoil > 0 ? s.recoil * 6 : 0;
    ctx.save();
    ctx.translate(shoulder.x, shoulder.y);
    ctx.rotate(s.aim);
    ctx.scale(1, f);                       // the gun never draws upside down
    ctx.translate(-kick, 0);

    block(ctx, 6, -4, 26, 8, '#4a3c2a', { r: 2 });                           // stock
    block(ctx, 22, -6, 40, 11, '#3d434a', { r: 3 });                        // receiver
    block(ctx, 56, -3, 26, 6, '#2f353b', { r: 2 });                         // barrel
    block(ctx, 34, 4, 10, 14, '#2c3238', { r: 2, line: 2 });                // magazine
    block(ctx, 48, -9, 12, 4, '#2c3238', { r: 1, line: 2 });                // sight
    // rear hand at the grip, front hand on the barrel: both on the gun
    ball(ctx, 30, 6, 6, COLOURS.skin, { line: 2 });
    ball(ctx, 54, 2, 6, COLOURS.skin, { line: 2 });
    // and the arms reaching for them
    ctx.strokeStyle = KHAKI;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, 2); ctx.lineTo(30, 6);
    ctx.moveTo(2, 0); ctx.lineTo(54, 2);
    ctx.stroke();
    ctx.strokeStyle = COLOURS.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (s.muzzle > 0) {
      const k = s.muzzle / 0.06;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9 * k;
      polygon(ctx, [[80, -14 * k], [124 * k + 80, 0], [80, 14 * k]], '#ffcf6a', 0);
      polygon(ctx, [[80, -7 * k], [70 * k + 80, 0], [80, 7 * k]], '#fff6d8', 0);
      ball(ctx, 82, 0, 11 * k, '#fff3c4', { line: 0 });
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();

    // dust: running kicks it up, landing throws it
    if (running && Math.random() < 0.35) {
      dust.push({ x: x - f * 12, y: y - 2, vx: -f * (30 + Math.random() * 40), vy: -20 - Math.random() * 30, t: 0.45, r: 4 + Math.random() * 5 });
    }
    if (s.landed > 0.16) {
      for (let i = 0; i < 7; i++) {
        dust.push({ x, y: y - 2, vx: (Math.random() - 0.5) * 260, vy: -40 - Math.random() * 40, t: 0.55, r: 6 + Math.random() * 7 });
      }
    }
  }

  /** Dust lives in the renderer: it changes nothing and belongs to nobody. */
  const dust = [];
  function dustArt(ctx, dt, cam) {
    for (const d of dust) {
      d.t -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 120 * dt;
      d.r += dt * 14;
      if (d.t <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(0.45, d.t);
      ctx.fillStyle = '#c9a877';
      ctx.beginPath();
      ctx.arc(d.x - cam, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    let w = 0;
    for (let i = 0; i < dust.length; i++) if (dust[i].t > 0) dust[w++] = dust[i];
    dust.length = w;
  }

  function shots(ctx, game, cam, W) {
    for (const s of game.shots) {
      const x = s.x - cam;
      if (x < -80 || x > W + 80) continue;
      if (s.kind === 'flame') {
        ctx.save();
        ctx.globalAlpha = clamp(s.life * 2.2, 0, 0.85);
        ctx.globalCompositeOperation = 'lighter';
        ball(ctx, x, s.y, s.r, s.life > 0.2 ? '#ff9a3c' : '#7a2f18', { line: 0 });
        ctx.restore();
        continue;
      }
      if (s.kind === 'orb') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ball(ctx, x, s.y, s.r, s.colour, { line: 0 });
        ball(ctx, x, s.y, s.r * 0.5, '#ffffff', { line: 0 });
        ctx.restore();
        continue;
      }
      const len = s.kind === 'lobbed' ? 0 : 14;
      const a = Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.translate(x, s.y);
      ctx.rotate(a);
      if (len) {
        ctx.strokeStyle = s.colour;
        ctx.lineWidth = s.kind === 'rocket' ? 5 : 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(2, 0);
        ctx.stroke();
      }
      if (s.kind === 'rocket' || s.kind === 'homing') {
        block(ctx, -6, -4, 14, 8, '#c8cdd4', { r: 3, line: 2 });
        ctx.globalAlpha = 0.8;
        ball(ctx, -10, 0, 5, '#ffb45c', { line: 0 });
      } else if (s.kind === 'lobbed') {
        ball(ctx, 0, 0, 7, s.colour, { line: 2 });
      }
      ctx.restore();
    }
  }

  function pickupsArt(ctx, game, cam, W, time) {
    for (const p of game.pickups) {
      const x = p.x - cam;
      if (x < -60 || x > W + 60) continue;
      const bob = p.landed ? Math.sin(time * 4 + p.x) * 3 : 0;
      groundShadow(ctx, x, p.y + 16, 14, 0.3);
      if (p.kind === 'medkit') {
        block(ctx, x - 15, p.y - 12 + bob, 30, 24, '#e8e2d6', { r: 4 });
        ctx.fillStyle = '#cc3b34';
        ctx.fillRect(x - 3, p.y - 8 + bob, 6, 16);
        ctx.fillRect(x - 10, p.y - 3 + bob, 20, 6);
      } else {
        block(ctx, x - 18, p.y - 13 + bob, 36, 26, '#4f6b3a', { r: 4 });
        block(ctx, x - 12, p.y - 4 + bob, 26, 6, '#2f3a44', { r: 2, line: 2 });
        text(ctx, '★', x, p.y - 16 + bob, { size: 14, align: 'center', colour: '#ffd88a' });
      }
    }
  }

  function hazardsArt(ctx, game, cam, W, time) {
    for (const h of game.hazards) {
      const x = h.x - cam;
      if (x < -60 || x > W + 60) continue;
      if (h.kind === 'slime') {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#7fbf5a';
        ctx.beginPath();
        ctx.ellipse(x, h.y, h.r, h.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (h.kind === 'fire') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const p = (time * 2 + i * 0.25) % 1;
          ctx.globalAlpha = (1 - p) * 0.5;
          ball(ctx, x + Math.sin(time * 6 + i) * 12, h.y - p * 40, 14 * (1 - p * 0.5), '#ff7a3c', { line: 0 });
        }
        ctx.restore();
      } else if (h.kind === 'bolt') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ball(ctx, x, h.y, 7, '#c9b6ff', { line: 0 });
        ctx.restore();
      }
    }
  }

  function effects(ctx, game, cam) {
    const fx = game.fx;
    for (const b of fx.beams) {
      ctx.save();
      ctx.globalAlpha = clamp(b.t / b.life, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = b.colour;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(b.x1 - cam, b.y1);
      ctx.lineTo(b.x2 - cam, b.y2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    }
    for (const r of fx.rings) {
      ctx.save();
      ctx.globalAlpha = clamp(r.t / r.life, 0, 1) * 0.8;
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = 8 * (r.t / r.life);
      ctx.beginPath();
      ctx.arc(r.x - cam, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const b of fx.bits) {
      ctx.save();
      ctx.globalAlpha = clamp(b.t / b.life, 0, 1) * (b.soft ? 0.6 : 1);
      ctx.fillStyle = b.colour;
      if (b.soft) {
        ctx.beginPath();
        ctx.arc(b.x - cam, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(b.x - cam - b.size / 2, b.y - b.size / 2, b.size, b.size);
      }
      ctx.restore();
    }
    for (const f of fx.floats) {
      ctx.save();
      ctx.globalAlpha = clamp(f.t / f.life, 0, 1);
      text(ctx, f.text, f.x - cam, f.y, { size: 20, align: 'center', colour: f.colour });
      ctx.restore();
    }
  }

  function hud(ctx, game, W, best) {
    const s = game.soldier;
    const weapon = WEAPON_BY_ID[game.state.weapon.id];
    const ammo = game.state.weapon.ammo;

    // lives
    for (let i = 0; i < PLAYER.lives; i++) {
      const x = 26 + i * 30;
      ctx.save();
      ctx.globalAlpha = i < s.lives ? 1 : 0.22;
      text(ctx, '❤', x, 40, { size: 26, align: 'center', colour: COLOURS.danger, baseline: 'middle' });
      ctx.restore();
    }

    text(ctx, String(game.state.score).padStart(6, '0'), W / 2, 40,
      { size: 34, align: 'center', colour: COLOURS.hud, baseline: 'middle' });
    text(ctx, t('hud.score'), W / 2, 62, { size: 13, align: 'center', colour: '#b7a68c', baseline: 'middle' });

    // under the score, and never in the top-right: the flags and the mute button
    // live there, and a clock behind them is a clock nobody can read
    text(ctx, clock(game.state.time), W / 2, 92, { size: 26, align: 'center', colour: COLOURS.hud, baseline: 'middle' });
    if (best && (best.time > 0 || best.score > 0)) {
      text(ctx, `${t('hud.best')} ${best.score} · ${clock(best.time)}`, W / 2, 116,
        { size: 13, align: 'center', colour: '#e0cfa8', baseline: 'middle' });
    }

    // the gun and what is left in it
    const name = pick(weapon.name);
    text(ctx, name, 26, H - 34, { size: 20, colour: COLOURS.hud });
    const bar = 190;
    ctx.fillStyle = 'rgba(10,8,6,0.55)';
    roundRect(ctx, 26, H - 26, bar, 12, 6);
    ctx.fill();
    if (ammo === Infinity) {
      text(ctx, '∞', 26 + bar / 2, H - 20, { size: 16, align: 'center', colour: COLOURS.hud, baseline: 'middle' });
    } else {
      const full = weapon.ammo;
      ctx.fillStyle = ammo / full > 0.3 ? '#ffd88a' : COLOURS.danger;
      roundRect(ctx, 26, H - 26, bar * clamp(ammo / full, 0, 1), 12, 6);
      ctx.fill();
      text(ctx, String(ammo), 26 + bar + 12, H - 16, { size: 18, colour: COLOURS.hud });
    }

    // where the finger is pointing: the crosshair IS the aim now
    if (game.aimPoint) {
      const cx = game.aimPoint.x - game.camX;
      const cy = game.aimPoint.y;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#ffd88a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 26, cy);
      ctx.moveTo(cx, cy - 26); ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 26);
      ctx.stroke();
      ctx.restore();
    }

    // what the gun picked on its own, when nobody is pointing
    if (game.state.target && !game.state.target.dead) {
      const tg = game.state.target;
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#ffd88a';
      ctx.lineWidth = 2;
      const r = tg.r + 10;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.moveTo(tg.x - game.camX + Math.cos(a) * r, tg.y + Math.sin(a) * r);
        ctx.lineTo(tg.x - game.camX + Math.cos(a) * (r + 10), tg.y + Math.sin(a) * (r + 10));
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /** A short-lived line under the HUD: what you just picked up, or just lost. */
  function toast(ctx, game, W) {
    const since = game.state.time - game.state.lastPickupT;
    if (!game.state.lastPickup || since > 2.2) return;
    const p = game.state.lastPickup;
    const label = p.kind === 'medkit' ? t('hud.medkit')
      : p.kind === 'dry' ? t('hud.dry')
        : pick(WEAPON_BY_ID[p.id].name);
    ctx.save();
    ctx.globalAlpha = clamp((2.2 - since) * 2, 0, 1);
    text(ctx, label.toUpperCase(), W / 2, 110,
      { size: 22, align: 'center', colour: p.kind === 'dry' ? COLOURS.danger : '#ffd88a' });
    ctx.restore();
  }

  /**
   * The stick, drawn where the thumb put it, and the trigger where the other
   * one is. Nothing is drawn until a finger is down: an empty screen is the
   * point — the controls are wherever you decide to hold the phone.
   */
  function thumbs(ctx, touch, W, time) {
    if (!touch) return;
    ctx.save();
    if (touch.stick.on) {
      const { ox, oy } = touch.stick;
      const dx = touch.stick.x - ox;
      const dy = touch.stick.y - oy;
      const len = Math.hypot(dx, dy);
      const k = len > STICK.max ? STICK.max / len : 1;

      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(ox, oy, STICK.max, 0, Math.PI * 2);
      ctx.fillStyle = '#0d0b09';
      ctx.fill();
      ctx.strokeStyle = '#f0e4c8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // the four directions, lit as they are asked for
      const asked = stickInput(dx, dy);
      const marks = [
        ['◀', -1, 0, asked.left], ['▶', 1, 0, asked.right],
        ['▲', 0, -1, asked.jump], ['▼', 0, 1, asked.down],
      ];
      for (const [icon, mx, my, on] of marks) {
        ctx.globalAlpha = on ? 0.95 : 0.3;
        text(ctx, icon, ox + mx * STICK.max * 0.72, oy + my * STICK.max * 0.72,
          { size: 24, align: 'center', baseline: 'middle', colour: on ? '#ffd88a' : '#f0e4c8', stroke: 3 });
      }

      ctx.globalAlpha = 0.65;
      ball(ctx, ox + dx * k, oy + dy * k, 30, '#e8d7b4', { line: 3 });
    }
    if (touch.trigger.on) {
      ctx.globalAlpha = 0.5 + Math.sin(time * 22) * 0.12;
      ball(ctx, touch.trigger.x, touch.trigger.y, 44, '#d9a253', { line: 3 });
      ctx.globalAlpha = 0.9;
      text(ctx, '✦', touch.trigger.x, touch.trigger.y + 1,
        { size: 34, align: 'center', baseline: 'middle', colour: '#1b160f', stroke: 0 });
    }
    ctx.restore();
  }

  /** The first seconds of a run say where the controls are, then get out. */
  function thumbHint(ctx, game, W, touch) {
    if (!touch || game.state.time > 7 || touch.stick.on || touch.trigger.on) return;
    ctx.save();
    ctx.globalAlpha = clamp((7 - game.state.time) / 3, 0, 0.5);
    text(ctx, t('hud.moveHere'), W * 0.25, H - 120, { size: 22, align: 'center', colour: '#f0e4c8' });
    text(ctx, t('hud.fireHere'), W * 0.75, H - 120, { size: 22, align: 'center', colour: '#f0e4c8' });
    ctx.restore();
  }

  function draw(ctx, game, W, { best, touch, chrome = true } = {}) {
    const cam = camera(game, W);
    game.camX = cam;
    const shakeX = game.state.shake ? (Math.random() - 0.5) * 18 * game.state.shake : 0;
    const shakeY = game.state.shake ? (Math.random() - 0.5) * 12 * game.state.shake : 0;

    sky(ctx, W, game.state.time);
    dunes(ctx, W, cam);

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.save();
    ctx.translate(-cam, 0);

    // shadows first: they are how you read where a crate is going to land
    for (const o of game.objects) {
      if (o.dead || o.def.ufo || o.landed) continue;
      groundShadow(ctx, o.x, game.world.groundAt(o.x), o.r * clamp(1 - (o.y / 800), 0.3, 1), 0.3);
    }
    ctx.restore();

    road(ctx, game, W, cam);
    scenery(ctx, game, cam, W);

    ctx.save();
    ctx.translate(-cam, 0);
    hazardsArt(ctx, game, 0, W + cam, game.state.time);
    for (const o of game.objects) {
      if (o.dead) continue;
      if (o.x - cam < -260 || o.x - cam > W + 260) continue;
      drawCargo(ctx, o);
    }
    ctx.restore();

    pickupsArt(ctx, game, cam, W, game.state.time);

    ctx.save();
    ctx.translate(-cam, 0);
    soldierArt(ctx, game.soldier, game.state.time);
    ctx.restore();

    shots(ctx, game, cam, W);
    dustArt(ctx, 1 / 60, cam);
    effects(ctx, game, cam);
    ctx.restore();

    if (chrome) {
      hud(ctx, game, W, best);
      toast(ctx, game, W);
      thumbHint(ctx, game, W, touch);
      thumbs(ctx, touch, W, game.state.time);
    }
  }

  return { draw, get camX() { return camX; }, reset() { camX = 0; } };
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
