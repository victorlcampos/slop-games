import { HIDDEN_ROWS } from './config.js';
import { PALETTE } from './pieces.js';

export function createFx(rng = Math.random) {
  const fx = {
    particles: [],
    rings: [],
    shake: 0,
    flash: 0,
    banner: null,
  };

  function particle(data) {
    fx.particles.push({
      x: 5, y: 10, vx: 0, vy: 0, gravity: 5, life: 1, max: 1,
      size: 0.1, spin: 0, angle: rng() * Math.PI * 2, kind: 'spark', color: '#ffd36c',
      ...data,
    });
  }

  function lock(cells) {
    for (const cell of cells) {
      for (let i = 0; i < 2; i++) {
        particle({
          x: cell.x + 0.5,
          y: cell.y - HIDDEN_ROWS + 0.85,
          vx: (rng() - 0.5) * 2.5,
          vy: -1 - rng() * 2,
          life: 0.3 + rng() * 0.2,
          max: 0.5,
          size: 0.05 + rng() * 0.05,
          color: PALETTE[cell.type].light,
        });
      }
    }
    fx.shake = Math.max(fx.shake, 0.12);
  }

  function clear(event) {
    for (const cell of event.cells) {
      const palette = PALETTE[cell.type] || PALETTE.O;
      for (let i = 0; i < 7; i++) {
        const hot = i < 3;
        particle({
          x: cell.x + rng(),
          y: cell.y - HIDDEN_ROWS + rng(),
          vx: (rng() - 0.5) * (5 + event.count * 1.3),
          vy: -2 - rng() * (4 + event.count),
          gravity: 7.5,
          life: 0.65 + rng() * 0.65,
          max: 1.3,
          size: hot ? 0.045 + rng() * 0.07 : 0.12 + rng() * 0.12,
          kind: hot ? 'spark' : (i === 6 && rng() > 0.45 ? 'gear' : 'shard'),
          color: hot ? (rng() > 0.35 ? '#fff3a6' : '#ff7b35') : palette.face,
          spin: (rng() - 0.5) * 12,
        });
      }
      particle({
        x: cell.x + rng(), y: cell.y - HIDDEN_ROWS + 0.6,
        vx: (rng() - 0.5) * 1.3, vy: -0.8 - rng(), gravity: -0.2,
        life: 0.9 + rng() * 0.6, max: 1.5, size: 0.22 + rng() * 0.18,
        kind: 'smoke', color: rng() > 0.5 ? '#8b7668' : '#52545a',
      });
    }
    for (const row of event.rows) fx.rings.push({ y: row - HIDDEN_ROWS + 0.5, life: 0.5, max: 0.5 });
    fx.shake = Math.min(1, 0.36 + event.count * 0.16);
    fx.flash = Math.min(1, 0.25 + event.count * 0.12);
    fx.banner = { key: `clear.${event.count}`, life: 1.15, max: 1.15, detail: event };
    if (fx.particles.length > 1200) fx.particles.splice(0, fx.particles.length - 1200);
  }

  function level(level) {
    fx.banner = { key: 'hud.level', value: level, life: 1.4, max: 1.4 };
    fx.flash = 0.5;
    for (let i = 0; i < 70; i++) {
      particle({
        x: rng() * 10, y: 20 + rng() * 2, vx: (rng() - 0.5) * 2,
        vy: -4 - rng() * 7, gravity: 6, life: 1 + rng(), max: 2,
        size: 0.04 + rng() * 0.08, color: rng() > 0.5 ? '#ffd96c' : '#60e4d8',
      });
    }
  }

  fx.handle = (event) => {
    if (event.type === 'lock') lock(event.cells);
    if (event.type === 'clear') clear(event);
    if (event.type === 'level') level(event.level);
    if (event.type === 'drop') fx.shake = Math.max(fx.shake, Math.min(0.45, event.distance * 0.025));
    if (event.type === 'over') {
      fx.shake = 1;
      fx.flash = 0.75;
    }
  };

  fx.update = (dt) => {
    const h = Math.max(0, Math.min(0.1, dt));
    for (const p of fx.particles) {
      p.life -= h;
      p.vy += p.gravity * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
      p.angle += p.spin * h;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const ring of fx.rings) ring.life -= h;
    fx.rings = fx.rings.filter((ring) => ring.life > 0);
    if (fx.banner) {
      fx.banner.life -= h;
      if (fx.banner.life <= 0) fx.banner = null;
    }
    fx.shake = Math.max(0, fx.shake - h * 2.8);
    fx.flash = Math.max(0, fx.flash - h * 2.1);
  };

  fx.clear = () => {
    fx.particles.length = 0;
    fx.rings.length = 0;
    fx.shake = 0;
    fx.flash = 0;
    fx.banner = null;
  };

  return fx;
}
