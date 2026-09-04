// Everything the player sees, drawn from code — no images anywhere.
//
// The three invader breeds are pixel maps painted rect by rect, with a
// two-frame leg shuffle on every march step. Like the originals they are
// mirror-symmetric, and the test suite holds them to it.

import {
  H, PLAY_W, PLAYER, SHOT, BOLT, SAUCER, INVADER_W, INVADER_H,
} from './config.js';
import { t } from './i18n.js';

// ------------------------------------------------------------ pixel invaders

const BREEDS = {
  squid: [
    [
      '...##...',
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '..#..#..',
      '.#.##.#.',
      '#.#..#.#',
    ],
    [
      '...##...',
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '.##..##.',
      '##....##',
      '#......#',
    ],
  ],
  crab: [
    [
      '..#..#..',
      '..#..#..',
      '..####..',
      '.##..##.',
      '########',
      '#.####.#',
      '#.####.#',
      '###..###',
    ],
    [
      '..#..#..',
      '.#....#.',
      '.#....#.',
      '.##..##.',
      '########',
      '.######.',
      '..#..#..',
      '.##..##.',
    ],
  ],
  octo: [
    [
      '...##...',
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '..#..#..',
      '.##..##.',
      '##....##',
    ],
    [
      '...##...',
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '#..##..#',
      '#.#..#.#',
      '..#..#..',
    ],
  ],
};

/** Top row is the small one, the middle two are crabs, the bottom two octopi. */
export function breedOf(row) {
  if (row === 0) return 'squid';
  if (row <= 2) return 'crab';
  return 'octo';
}

function drawMap(ctx, map, cx, cy, w, h, colour) {
  const cols = map[0].length;
  const rows = map.length;
  const px = w / cols;
  const py = h / rows;
  ctx.fillStyle = colour;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (map[r][c] === '#') ctx.fillRect(cx - w / 2 + c * px, cy - h / 2 + r * py, px + 0.5, py + 0.5);
    }
  }
}

export function breedFrame(breed, frame) {
  return BREEDS[breed][frame & 1];
}

// The DOM corner (language flags + sound button, ~110px wide, ~44px tall)
// hangs over the canvas top-right, so the canvas HUD lives under it: text
// top at HUD_Y clears the corner instead of fighting it for the same pixels.
export const HUD_Y = 54;

// ------------------------------------------------------------------ the rest

const CANNON = [
  '......#.......',
  '......#.......',
  '......#.......',
  '....#####.....',
  '....#####.....',
  '.###########..',
  '#############.',
  '#############.',
  '#############.',
];

const SAUCER_MAP = [
  '.....######.....',
  '...##########...',
  '..############..',
  '.##.##.##.##.##.',
  '################',
  '..###..##..###..',
  '...#........#...',
];

function makeStars(seed) {
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
  const stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push({ x: rand(), y: rand(), r: 0.6 + rand() * 1.6, p: rand() * Math.PI * 2 });
  }
  return stars;
}

export function createRenderer() {
  const stars = makeStars(1978);

  function backdrop(ctx, W, time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05050e');
    g.addColorStop(0.75, '#07070f');
    g.addColorStop(1, '#0a1410');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // two depths for free: the bigger (nearer) stars drift down faster, so
    // the sky recedes while the swarm descends to meet the cannon
    for (const s of stars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.8 + s.p));
      const yy = (((s.y * H + time * (3 + s.r * 5)) % H) + H) % H;
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(s.x * W, yy, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    // the cabinet vignette, same glass as the other six machines
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function ground(ctx, W, time) {
    const gy = PLAYER.y + PLAYER.h / 2 + 24;
    // the line the cannon defends breathes a little — a gradient sigh above
    // it, so the eye knows where the invasion must not reach
    const glow = ctx.createLinearGradient(0, gy - 30, 0, gy);
    glow.addColorStop(0, 'rgba(47,174,92,0)');
    glow.addColorStop(1, `rgba(47,174,92,${0.1 + 0.04 * Math.sin(time * 2)})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, gy - 30, W, 30);
    ctx.fillStyle = '#2fae5c';
    ctx.fillRect(0, gy, W, 3);
  }

  function frame(ctx, game, W, time) {
    // the playfield is 960 wide; on a narrower screen it scales down and
    // centers instead of spilling off the edges
    const scale = Math.min(1, (W - 16) / PLAY_W);
    const ox = (W - PLAY_W * scale) / 2;
    ctx.save();
    ctx.translate(ox, 0);
    ctx.scale(scale, scale);
    drawWorld(ctx, game, time);
    ctx.restore();
    return { ox, scale };
  }

  function drawWorld(ctx, game, time) {
    for (const shield of game.shields) {
      const cw = shield.w / shield.cols;
      const ch = shield.h / shield.rows;
      ctx.fillStyle = '#2fae5c';
      for (let r = 0; r < shield.rows; r++) {
        for (let c = 0; c < shield.cols; c++) {
          if (shield.cells[r][c]) ctx.fillRect(shield.x + c * cw, shield.y + r * ch, cw + 0.5, ch + 0.5);
        }
      }
    }

    for (const inv of game.formation.list) {
      const colour = inv.row === 0 ? '#8fd0ff' : inv.row <= 2 ? '#7dff8a' : '#e8ff7d';
      // the march leans into its step and bobs on the way down — a grid that
      // walks reads as alive, a grid that slides reads as a spreadsheet
      const bob = Math.sin(time * 3 + inv.x * 0.02) * 2;
      ctx.save();
      ctx.translate(inv.x, inv.y + bob);
      ctx.rotate(game.formation.dir * 0.07);
      drawMap(ctx, breedFrame(breedOf(inv.row), game.formation.frame),
        0, 0, INVADER_W, INVADER_H, colour);
      ctx.restore();
    }

    if (game.saucer) {
      // a wobbling crossing, banked into its run, engine flickering under it
      const sx = game.saucer.x;
      const sy = SAUCER.y + Math.sin(time * 7) * 4;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 30);
      ctx.fillStyle = '#ffb35a';
      const flick = 6 + 2 * Math.sin(time * 30);
      ctx.fillRect(sx - flick / 2, sy + SAUCER.h / 2 - 2, flick, 4);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.cos(time * 7) * 0.1 * game.saucer.dir);
      drawMap(ctx, SAUCER_MAP, 0, 0, SAUCER.w, SAUCER.h, '#ff5a5a');
      // running lights chase along the rim, symmetric so the bank never skews them
      for (let i = -2; i <= 2; i++) {
        const on = (Math.floor(time * 6) + i) % 2 === 0;
        ctx.globalAlpha = on ? 1 : 0.25;
        ctx.fillStyle = '#ffd88a';
        ctx.fillRect(i * 12 - 2, 1, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    for (const s of game.shots) {
      // a faint halo around the shell so the one shot you own reads at speed
      ctx.fillStyle = 'rgba(125,255,138,0.25)';
      ctx.fillRect(s.x - 2, s.y - 2, SHOT.w + 4, SHOT.h + 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x, s.y, SHOT.w, SHOT.h);
    }

    const zig = Math.floor(time * 11) % 2;
    for (const b of game.bolts) {
      // a soft halo first so the bolt warns before it arrives
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffd88a';
      ctx.fillRect(b.x - 1, b.y - 1, BOLT.w + 2, BOLT.h + 2);
      ctx.globalAlpha = 1;
      const dx = zig ? 2 : -2;
      ctx.fillRect(b.x, b.y, BOLT.w, BOLT.h / 3);
      ctx.fillRect(b.x + dx, b.y + BOLT.h / 3, BOLT.w, BOLT.h / 3);
      ctx.fillRect(b.x, b.y + (2 * BOLT.h) / 3, BOLT.w, BOLT.h / 3 + 1);
    }

    // the cannon blinks while it is getting back on its feet
    const blink = game.invuln > 0 && Math.floor(time * 8) % 2 === 0;
    if (!blink && !game.over) {
      // a pool of light the cannon carries with it, tying it to the line
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(game.player.x - 34, PLAYER.y + PLAYER.h / 2 + 6, 68, 18);
      ctx.globalAlpha = 1;
      drawMap(ctx, CANNON, game.player.x, PLAYER.y, PLAYER.w, PLAYER.h, '#7dff8a');
    }

    for (const p of game.particles) {
      // debris flies as streaks along its own velocity, not as square snow —
      // the crater reads in the smear, the colour in the ember at its head
      const fade = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = p.colour;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function hud(ctx, game, W, best) {
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#d6f4d6';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${t('hud.score')}: ${game.score}`, 16, HUD_Y);
    ctx.textAlign = 'center';
    ctx.fillText(`${t('hud.wave')}: ${game.wave}`, W / 2, HUD_Y);
    ctx.textAlign = 'right';
    ctx.fillText(`${t('hud.best')}: ${best}`, W - 16, HUD_Y);
    // lives as little cannons, bottom-left above the ground line
    ctx.fillStyle = '#7dff8a';
    for (let i = 0; i < game.lives; i++) {
      const x = 24 + i * 30;
      const y = H - 26;
      ctx.fillRect(x, y, 14, 4);
      ctx.fillRect(x + 5, y - 6, 4, 6);
    }
    ctx.textAlign = 'left';
  }

  function banner(ctx, W, text, alpha) {
    if (!text) return;
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillStyle = '#7dff8a';
    ctx.fillText(text, W / 2, H / 2 - 40);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'top';
  }

  return {
    /** Paint the full scene; `bannerText`/`bannerAlpha` overlay a wave message. */
    draw(ctx, game, W, time, best, bannerText, bannerAlpha) {
      backdrop(ctx, W, time);
      ground(ctx, W, time);
      frame(ctx, game, W, time);
      // the ground line above was screen-space; the world draws its own below
      hud(ctx, game, W, best);
      banner(ctx, W, bannerText, bannerAlpha);
    },
    /** The menu keeps the starfield alive behind the card, with a still swarm. */
    drawMenu(ctx, W, time, game) {
      backdrop(ctx, W, time);
      ground(ctx, W, time);
      frame(ctx, game, W, time);
    },
    /** Screen x → playfield x for the pointer mapping. Must match `frame`. */
    toPlayfield(px, W) {
      const scale = Math.min(1, (W - 16) / PLAY_W);
      const ox = (W - PLAY_W * scale) / 2;
      return (px - ox) / scale;
    },
  };
}
