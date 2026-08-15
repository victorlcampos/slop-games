// Sparks, blood, rings and the words that float off a capture.
//
// It exists so the match can say "that hurt" without knowing what a spark looks
// like — which is also why game.js runs in Node: the tests hand it nothing at
// all and the simulation never notices.

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
        t: 0.16 + Math.random() * 0.22, life: 0.38, colour, size: 1.2 + Math.random() * 1.8,
      });
    }
  }

  function blood(x, y, n = 8, colour = '#8e2f3f') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 120 * (0.2 + Math.random());
      bits.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        t: 0.35 + Math.random() * 0.5, life: 0.85, colour, size: 1.6 + Math.random() * 2.4, drag: 4,
      });
    }
  }

  function ring(x, y, r, colour = '#5ce8cf') {
    rings.push({ x, y, r: r * 0.15, max: r, t: 0.6, life: 0.6, colour });
  }

  function float(x, y, text, colour = '#e8eef8') {
    floats.push({ x, y, text, colour, t: 1.2, life: 1.2 });
  }

  function shake(amount) {
    state.shake = Math.min(12, state.shake + amount);
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
      f.y -= 30 * dt;
      if (f.t <= 0) floats.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 24);
  }

  function clear() {
    bits.length = 0;
    rings.length = 0;
    floats.length = 0;
    state.shake = 0;
  }

  return { bits, rings, floats, state, spark, blood, ring, float, shake, update, clear };
}
