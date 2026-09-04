// Hungry Maze: the yellow circle eats the maze while four shadows hunt it.
//
// Tile-based, like 1978's descendants: the eater and the shadows glide cell
// to cell, turning only at tile centers. Shadows alternate scatter/chase on a
// clock, turn blue and edible under the power pill (the chain pays 200·2ⁿ),
// and come back as eyes when eaten. Everything is pure simulation — the shell
// draws it through `draw`.

import { PLAY_W } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

export const COLS = 19;
export const ROWS = 15;
export const CELL = 44;
export const OX = (PLAY_W - COLS * CELL) / 2;
export const OY = 34;

export const MAP = [
  '###################',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o...............o#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.#.#DDD#.#.####',
  '#....#.#   #.#....#',
  '####.#.#   #.#.####',
  '#....#.#####.#....#',
  '#.##.#.......#.##.#',
  '###.#.#.###.#.#.###',
  '#o..#....#....#..o#',
  '#........#........#',
  '###################',
];

const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const CORNERS = {  blinky: [COLS - 2, 1],
  pinky: [1, 1],
  inky: [COLS - 2, ROWS - 2],
  clyde: [1, ROWS - 2],
};
const COLOURS = { blinky: '#ff5555', pinky: '#ffaaee', inky: '#55eeff', clyde: '#ffaa55' };
const RELEASE = { blinky: 0, pinky: 2, inky: 5, clyde: 8 };
const CYCLE = [
  ['scatter', 7], ['chase', 20], ['scatter', 7], ['chase', 20], ['scatter', 5], ['chase', Infinity],
];

export function tileAt(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
  return MAP[r][c];
}

function walkable(c, r, ghost, out) {
  const t = tileAt(c, r);
  if (t === '#') return false;
  if (t === 'D') return !!ghost && !!out;
  return true;
}

function allPellets() {
  const set = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = MAP[r][c];
      if (t === '.' || t === 'o') set.add(c + ',' + r + (t === 'o' ? ':P' : ''));
    }
  }
  return set;
}

export function pelletCount() {
  return allPellets().size;
}

function speedOf(wave) {
  return {
    player: 7.6 + wave * 0.3,
    ghost: 7.0 + wave * 0.35,
    fright: 4.2,
    eyes: 12,
  };
}

function frightTime(wave) {
  return Math.max(2, 7 - (wave - 1) * 0.8);
}

export function create(rand = Math.random) {
  const game = {
    wave: 1,
    rand,
    score: 0,
    lives: 3,
    over: false,
    events: [],
    pellets: allPellets(),
    player: null,
    ghosts: [],
    mode: 'scatter',
    modeIdx: 0,
    modeClock: CYCLE[0][1],
    fright: 0,
    chain: 0,
    readyT: 2,
    dying: 0,
    clearT: 0,
  };
  resetActors(game);
  return game;
}

function emit(game, name, data) {
  game.events.push({ name, ...data });
}

export function drain(game) {
  const out = game.events;
  game.events = [];
  return out;
}

export function isOver(game) {
  return game.over;
}

function resetActors(game) {
  game.player = { c: 9, r: 10, dir: 'left', want: 'left' };
  game.ghosts = Object.keys(CORNERS).map((name) => {
    // blinky opens outside, on the doorstep; the rest wait in the house
    if (name === 'blinky') {
      return { name, c: 9, r: 5, dir: 'left', state: 'active', houseT: 0 };
    }
    return { name, c: 9, r: 7, dir: 'up', state: 'house', houseT: RELEASE[name] };
  });
  game.mode = 'scatter';
  game.modeIdx = 0;
  game.modeClock = CYCLE[0][1];
  game.fright = 0;
  game.chain = 0;
}

// ---- movement: glide to the tile center, then turn or stop

function nearCenter(a, win) {
  return Math.abs(a.c - Math.round(a.c)) < win && Math.abs(a.r - Math.round(a.r)) < win;
}

function snap(a) {
  a.c = Math.round(a.c);
  a.r = Math.round(a.r);
}

/**
 * Glide toward the next tile center. At the center, `decide` picks the way
 * on; `solid` says what blocks. The snap window follows the speed — a fast
 * shadow covers 0.2 cells a step and would otherwise stride past its turn.
 */
function stepActor(a, speed, h, decide, solid) {
  const win = Math.max(0.09, speed * h * 0.75);
  const tc = Math.round(a.c);
  const tr = Math.round(a.r);
  if (nearCenter(a, win)) {
    snap(a);
    const picked = decide(tc, tr, a.dir);
    if (picked) a.dir = picked;
  }
  const [dx, dy] = DIRS[a.dir];
  const nc = Math.round(a.c + dx * 0.6);
  const nr = Math.round(a.r + dy * 0.6);
  if (solid(nc, nr) && nearCenter(a, win)) {
    snap(a);
    return;
  }
  a.c += dx * speed * h;
  a.r += dy * speed * h;
}

function ghostTarget(game, g) {
  if (g.state === 'eyes') return [9, 6];
  if (game.fright > 0) return null; // frightened: wander
  if (game.mode === 'scatter') return CORNERS[g.name];
  return [game.player.c, game.player.r];
}

function chooseDir(game, g) {
  const tc = Math.round(g.c);
  const tr = Math.round(g.r);
  const target = ghostTarget(game, g);
  // the door only opens for eyes coming home — the hunt never walks back in
  const solid = (c, r) => !walkable(c, r, true, g.state === 'eyes');
  const options = Object.keys(DIRS).filter((d) => {
    if (d === OPP[g.dir]) return false;
    const [dx, dy] = DIRS[d];
    return !solid(tc + dx, tr + dy);
  });
  if (!options.length) return OPP[g.dir];
  if (!target) return options[Math.floor(game.rand() * options.length)];
  let best = options[0];
  let bestD = Infinity;
  for (const d of options) {
    const [dx, dy] = DIRS[d];
    const dist = (tc + dx - target[0]) ** 2 + (tr + dy - target[1]) ** 2;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best;
}

export function update(game, h, input = {}) {
  if (game.over) return;
  if (game.readyT > 0) {
    game.readyT -= h;
    if (game.readyT <= 0) emit(game, 'banner', { text: '' });
    return;
  }
  if (game.clearT > 0) {
    game.clearT -= h;
    if (game.clearT <= 0) {
      game.wave += 1;
      game.pellets = allPellets();
      resetActors(game);
      game.readyT = 1.2;
      emit(game, 'banner', { text: t('wave.next', { n: game.wave }) });
      emit(game, 'wave');
    }
    return;
  }
  if (game.dying > 0) {
    game.dying -= h;
    if (game.dying <= 0) {
      if (game.lives <= 0) {
        game.over = true;
        emit(game, 'lose');
      } else {
        resetActors(game);
        game.readyT = 1.2;
      }
    }
    return;
  }

  const speeds = speedOf(game.wave);

  // the mode clock only runs while somebody is hunting
  if (game.fright > 0) {
    game.fright -= h;
    if (game.fright <= 0) game.chain = 0;
  } else {
    game.modeClock -= h;
    if (game.modeClock <= 0 && game.modeIdx < CYCLE.length - 1) {
      game.modeIdx += 1;
      game.mode = CYCLE[game.modeIdx][0];
      game.modeClock = CYCLE[game.modeIdx][1];
      for (const g of game.ghosts) if (g.state === 'active') g.dir = OPP[g.dir];
    }
  }

  // the eater turns toward the want, now or at the next center
  const p = game.player;
  for (const d of ['up', 'down', 'left', 'right']) {
    if (input[d]) p.want = d;
  }
  if (input.swipe && DIRS[input.swipe]) p.want = input.swipe;
  stepActor(p, speeds.player, h, (tc, tr, dir) => {
    if (p.want !== dir) {
      const [dx, dy] = DIRS[p.want];
      if (walkable(tc + dx, tr + dy)) return p.want;
    }
    return null;
  }, (c, r) => !walkable(c, r));

  // eat whatever is underfoot
  const key = Math.round(p.c) + ',' + Math.round(p.r);
  if (game.pellets.has(key)) {
    game.pellets.delete(key);
    game.score += 10;
    emit(game, 'munch');
  } else if (game.pellets.has(key + ':P')) {
    game.pellets.delete(key + ':P');
    game.score += 50;
    game.fright = frightTime(game.wave);
    game.chain = 0;
    for (const g of game.ghosts) if (g.state === 'active') g.dir = OPP[g.dir];
    emit(game, 'power');
  }

  // the shadows
  for (const g of game.ghosts) {
    if (g.state === 'house') {
      g.houseT -= h;
      if (g.houseT <= 0) {
        g.state = 'leaving';
        g.c = 9; g.r = 7; g.dir = 'up';
      }
      continue;
    }
    if (g.state === 'leaving') {
      g.r -= 6 * h;
      if (g.r <= 5.6) {
        g.r = 5; g.c = 9; g.dir = 'left'; g.state = 'active';
      }
      continue;
    }
    const sp = g.state === 'eyes' ? speeds.eyes : game.fright > 0 ? speeds.fright : speeds.ghost;
    const solid = (c, r) => !walkable(c, r, true, g.state === 'eyes');
    stepActor(g, sp, h, () => chooseDir(game, g), solid);
    if (g.state === 'eyes' && Math.round(g.c) === 9 && Math.round(g.r) === 6) {
      g.state = 'house';
      g.houseT = 1.5;
      g.c = 9; g.r = 7;
    }
  }

  // teeth meet
  for (const g of game.ghosts) {
    if (g.state !== 'active') continue;
    const d = Math.hypot(g.c - p.c, g.r - p.r);
    if (d < 0.6) {
      if (game.fright > 0) {
        const pay = 200 * 2 ** game.chain;
        game.chain += 1;
        game.score += pay;
        g.state = 'eyes';
        emit(game, 'eatGhost', { pay });
      } else {
        game.lives -= 1;
        game.dying = 1.2;
        emit(game, 'boom');
        break;
      }
    }
  }

  if (game.pellets.size === 0) {
    game.clearT = 2;
    emit(game, 'banner', { text: t('maze.clear') });
    emit(game, 'clear');
  }
}

// ---- painting

const stars = makeStars(1980);

function cellXY(c, r) {
  return [OX + (c + 0.5) * CELL, OY + (r + 0.5) * CELL];
}

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    `${t('hud.level')} ${game.wave}`,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    // walls glow neon blue; the door glows pink
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = MAP[r][c];
        const x = OX + c * CELL;
        const y = OY + r * CELL;
        if (tile === '#') {
          ctx.fillStyle = '#0a0a2e';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.strokeStyle = '#3344ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
        } else if (tile === 'D') {
          ctx.fillStyle = '#ffaaee';
          ctx.fillRect(x + 4, y + CELL / 2 - 2, CELL - 8, 4);
        } else if (game.pellets.has(c + ',' + r)) {
          const [px, py] = cellXY(c, r);
          ctx.fillStyle = '#ffd88a';
          ctx.fillRect(px - 2, py - 2, 4, 4);
        } else if (game.pellets.has(c + ',' + r + ':P')) {
          const [px, py] = cellXY(c, r);
          const pulse = 5 + 2 * Math.sin(view.time * 6);
          ctx.fillStyle = '#ffd88a';
          ctx.beginPath();
          ctx.arc(px, py, pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // the eater, mid-chomp
    const [px, py] = cellXY(game.player.c, game.player.r);
    const pr = CELL * 0.38;
    const dying = game.dying > 0;
    const mouth = dying ? (1.2 - game.dying) * 2.4 : Math.abs(Math.sin(view.time * 12)) * 0.32;
    const [pdx, pdy] = DIRS[game.player.dir] || [1, 0];
    const ang = Math.atan2(pdy, pdx);
    ctx.fillStyle = '#ffee00';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, pr, ang + mouth, ang + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();

    for (const g of game.ghosts) {
      if (g.state === 'house' || g.state === 'leaving') {
        const [gx, gy] = cellXY(g.c, g.r);
        paintGhostBody(ctx, gx, gy, COLOURS[g.name], view.time, g.dir);
        continue;
      }
      if (g.state === 'eyes') {
        paintEyes(ctx, ...cellXY(g.c, g.r), g.dir);
        continue;
      }
      const frightened = game.fright > 0;
      const flash = frightened && game.fright < 2 && Math.floor(view.time * 6) % 2 === 0;
      const [gx, gy] = cellXY(g.c, g.r);
      paintGhostBody(ctx, gx, gy, frightened ? (flash ? '#ffffff' : '#2222ff') : COLOURS[g.name], view.time, g.dir);
      if (!frightened) paintEyes(ctx, gx, gy, g.dir);
      else paintFrightFace(ctx, gx, gy);
    }

    // lives as little eaters under the maze
    for (let i = 0; i < game.lives; i++) {
      const x = OX + 20 + i * 34;
      const y = OY + ROWS * CELL + 26;
      ctx.fillStyle = '#ffee00';
      ctx.beginPath();
      ctx.arc(x, y, 11, 0.3, Math.PI * 2 - 0.3);
      ctx.lineTo(x, y);
      ctx.fill();
    }

    if (game.readyT > 0 && !game.over) {
      ctx.textAlign = 'center';
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillStyle = '#ffee00';
      ctx.fillText(t('maze.ready'), OX + (COLS * CELL) / 2, OY + ROWS * CELL + 26);
      ctx.textAlign = 'left';
    }
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}

function paintGhostBody(ctx, x, y, colour, time, dir) {
  const r = CELL * 0.36;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.2, r, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - r, y - r * 0.2, r * 2, r * 1.1);
  const waves = 4;
  const wobble = Math.sin(time * 10 + x) * 1.5;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.9);
  for (let i = 0; i <= waves; i++) {
    const wx = x - r + (i / waves) * r * 2;
    ctx.lineTo(wx, y + r * 0.9 - (i % 2 === 0 ? 3 : 0) + wobble * 0.3);
  }
  ctx.lineTo(x + r, y - r * 0.2);
  ctx.closePath();
  ctx.fill();
  void dir;
}

function paintEyes(ctx, x, y, dir) {
  const r = CELL * 0.36;
  const [dx, dy] = DIRS[dir] || [0, 0];
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.35 + dx * 2, y - r * 0.25 + dy * 2, r * 0.32, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35 + dx * 2, y - r * 0.25 + dy * 2, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2222ff';
  ctx.beginPath();
  ctx.arc(x - r * 0.35 + dx * 4, y - r * 0.25 + dy * 4, r * 0.16, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35 + dx * 4, y - r * 0.25 + dy * 4, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function paintFrightFace(ctx, x, y) {
  const r = CELL * 0.36;
  ctx.fillStyle = '#ffcccc';
  ctx.fillRect(x - r * 0.5, y - r * 0.3, r * 0.25, r * 0.25);
  ctx.fillRect(x + r * 0.25, y - r * 0.3, r * 0.25, r * 0.25);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y + r * 0.35);
  for (let i = 0; i < 4; i++) ctx.lineTo(x - r * 0.55 + (i + 0.5) * r * 0.28, y + r * (i % 2 ? 0.2 : 0.45));
  ctx.strokeStyle = '#ffcccc';
  ctx.lineWidth = 2;
  ctx.stroke();
}
