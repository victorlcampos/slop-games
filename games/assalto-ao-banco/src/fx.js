// Sparks, blood, rings and the numbers that float off a bag of cash.
//
// It exists so the simulation can say "that hurt" without knowing what a spark
// looks like — which is also why game.js runs in Node: the tests hand it a
// silent version of this and nothing notices.

export function createFx() {
  const bits = [];
  const rings = [];
  const floats = [];
  const state = { shake: 0 };

  function spark(x, y, colour = '#ffd88a', n = 6, force = 240) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = force * (0.3 + Math.random() * 0.9);
      bits.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        t: 0.18 + Math.random() * 0.26, life: 0.44, colour, size: 1.4 + Math.random() * 2,
      });
    }
  }

  function blood(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 130 * (0.2 + Math.random());
      bits.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        t: 0.4 + Math.random() * 0.5, life: 0.9, colour: '#8e2f3f', size: 2 + Math.random() * 3, drag: 4,
      });
    }
  }

  function ring(x, y, r, colour = '#ff5a4d') {
    rings.push({ x, y, r: r * 0.15, max: r, t: 0.7, life: 0.7, colour });
  }

  function float(x, y, text, colour = '#f0c65a') {
    floats.push({ x, y, text, colour, t: 1.1, life: 1.1 });
  }

  function shake(amount) {
    state.shake = Math.min(14, state.shake + amount);
  }

  function update(dt) {
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.t -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const drag = Math.exp(-(b.drag || 7) * dt);
      b.vx *= drag;
      b.vy *= drag;
      if (b.t <= 0) bits.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t -= dt;
      r.r += (r.max - r.r) * Math.min(1, dt * 5);
      if (r.t <= 0) rings.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t -= dt;
      f.y -= 34 * dt;
      if (f.t <= 0) floats.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 26);
  }

  function clear() {
    bits.length = 0;
    rings.length = 0;
    floats.length = 0;
    state.shake = 0;
  }

  return { bits, rings, floats, state, spark, blood, ring, float, shake, update, clear };
}
