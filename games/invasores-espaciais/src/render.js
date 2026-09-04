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
    for (const s of stars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.8 + s.p));
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  function ground(ctx, W) {
    ctx.fillStyle = '#2fae5c';
    ctx.fillRect(0, PLAYER.y + PLAYER.h / 2 + 24, W, 3);
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
      drawMap(ctx, breedFrame(breedOf(inv.row), game.formation.frame),
        inv.x, inv.y, INVADER_W, INVADER_H, colour);
    }

    if (game.saucer) {
      drawMap(ctx, SAUCER_MAP, game.saucer.x, SAUCER.y, SAUCER.w, SAUCER.h, '#ff5a5a');
    }

    ctx.fillStyle = '#ffffff';
    for (const s of game.shots) ctx.fillRect(s.x, s.y, SHOT.w, SHOT.h);

    const zig = Math.floor(time * 11) % 2;
    for (const b of game.bolts) {
      ctx.fillStyle = '#ffd88a';
      const dx = zig ? 2 : -2;
      ctx.fillRect(b.x, b.y, BOLT.w, BOLT.h / 3);
      ctx.fillRect(b.x + dx, b.y + BOLT.h / 3, BOLT.w, BOLT.h / 3);
      ctx.fillRect(b.x, b.y + (2 * BOLT.h) / 3, BOLT.w, BOLT.h / 3 + 1);
    }

    // the cannon blinks while it is getting back on its feet
    const blink = game.invuln > 0 && Math.floor(time * 8) % 2 === 0;
    if (!blink && !game.over) {
      drawMap(ctx, CANNON, game.player.x, PLAYER.y, PLAYER.w, PLAYER.h, '#7dff8a');
    }

    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function hud(ctx, game, W, best) {
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#d6f4d6';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${t('hud.score')}: ${game.score}`, 16, 12);
    ctx.textAlign = 'center';
    ctx.fillText(`${t('hud.wave')}: ${game.wave}`, W / 2, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${t('hud.best')}: ${best}`, W - 16, 12);
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
      ground(ctx, W);
      frame(ctx, game, W, time);
      // the ground line above was screen-space; the world draws its own below
      hud(ctx, game, W, best);
      banner(ctx, W, bannerText, bannerAlpha);
    },
    /** The menu keeps the starfield alive behind the card, with a still swarm. */
    drawMenu(ctx, W, time, game) {
      backdrop(ctx, W, time);
      ground(ctx, W);
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
