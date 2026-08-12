// Sparks, smoke, blast rings and the line a beam leaves behind.
//
// Nothing here decides anything — it exists so the rest of the game can say
// "that hurt" without knowing how a spark is drawn. It is also why the logic
// modules can run in Node: the tests hand the game a silent version of this.

export function createFx() {
  const bits = [];
  const rings = [];
  const beams = [];
  const floats = [];

  function spark(x, y, colour = '#ffd88a', n = 6, force = 260) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = force * (0.3 + Math.random() * 0.9);
      bits.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        t: 0.25 + Math.random() * 0.4, life: 0.65, colour, size: 1.5 + Math.random() * 2.4,
      });
    }
  }

  function smoke(x, y, n = 5, colour = 'rgba(60,52,44,0.55)') {
    for (let i = 0; i < n; i++) {
      bits.push({
        x, y, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 50,
        t: 0.8 + Math.random() * 0.7, life: 1.5, colour, size: 6 + Math.random() * 10, soft: true,
      });
    }
  }

  function ring(x, y, r, colour = '#ffb055') {
    rings.push({ x, y, r: r * 0.25, max: r, t: 0.34, life: 0.34, colour });
  }

  function beam(x1, y1, x2, y2, colour = '#cfe9ff') {
    beams.push({ x1, y1, x2, y2, t: 0.09, life: 0.09, colour });
  }

  function float(x, y, text, colour = '#f0e4c8') {
    floats.push({ x, y, text, colour, t: 0.9, life: 0.9 });
  }

  function update(dt) {
    for (const b of bits) {
      b.t -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!b.soft) b.vy += 900 * dt;
      b.vx *= 1 - dt * 1.4;
    }
    for (const r of rings) { r.t -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 9); }
    for (const b of beams) b.t -= dt;
    for (const f of floats) { f.t -= dt; f.y -= 40 * dt; }
    prune(bits); prune(rings); prune(beams); prune(floats);
  }

  function prune(list) {
    let w = 0;
    for (let i = 0; i < list.length; i++) if (list[i].t > 0) list[w++] = list[i];
    list.length = w;
  }

  return { bits, rings, beams, floats, spark, smoke, ring, beam, float, update,
    clear() { bits.length = rings.length = beams.length = floats.length = 0; } };
}

/** The same shape, drawing nothing: what a test hands the game. */
export function silentFx() {
  const noop = () => {};
  return { bits: [], rings: [], beams: [], floats: [],
    spark: noop, smoke: noop, ring: noop, beam: noop, float: noop, update: noop, clear: noop };
}
