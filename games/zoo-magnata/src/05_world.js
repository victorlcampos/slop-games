/* ==========================================================================
   4. BUILDING CATALOGUES
   ========================================================================== */
const FENCES = {
  wood: { n: 'Cerca de Madeira|Wooden Fence', em: '🪵', cost: 55, strength: 1, sight: 1, colour: '#a87a45', height: 13 },
  iron: { n: 'Grade de Ferro|Iron Railing', em: '🔩', cost: 130, strength: 3, sight: .92, colour: '#5e6068', height: 19 },
  stone: { n: 'Muro de Pedra|Stone Wall', em: '🧱', cost: 210, strength: 4, sight: .55, colour: '#9b9a94', height: 20 },
  glass: { n: 'Vidro Blindado|Armoured Glass', em: '🪟', cost: 340, strength: 5, sight: 1, colour: '#a8d8e8', height: 21 },
  electric: { n: 'Cerca Elétrica|Electric Fence', em: '⚡', cost: 430, strength: 6, sight: .96, colour: '#c9a83c', height: 17 },
  aviary: { n: 'Tela de Aviário|Aviary Mesh', em: '🕸️', cost: 265, strength: 3, sight: .86, colour: '#8a9098', height: 34, aviary: 1 },
  aquarium: { n: 'Vidro de Aquário|Aquarium Glass', em: '🌊', cost: 520, strength: 6, sight: 1, colour: '#7ec4dd', height: 24, aquarium: 1 },
};
const BUILDINGS = {
  snackbar: { n: 'Lanchonete|Snack Bar', em: '🍔', w: 2, h: 2, cost: 16000, wage: 140, colour: '#e2543f', supplies: 'hunger', value: 26, unitCost: 7, strength: .45 },
  restaurant: { n: 'Restaurante|Restaurant', em: '🍽️', w: 3, h: 3, cost: 58000, wage: 340, colour: '#b5502a', supplies: 'hunger', value: 68, unitCost: 19, strength: 1 },
  pizzeria: { n: 'Pizzaria|Pizzeria', em: '🍕', w: 2, h: 3, cost: 38000, wage: 240, colour: '#d9782c', supplies: 'hunger', value: 44, unitCost: 13, strength: .8 },
  icecream: { n: 'Sorveteria|Ice Cream Shop', em: '🍦', w: 2, h: 2, cost: 19000, wage: 150, colour: '#f2a8c0', supplies: 'hunger', value: 20, unitCost: 5, strength: .3 },
  popcorn: { n: 'Carrinho de Pipoca|Popcorn Cart', em: '🍿', w: 1, h: 1, cost: 6500, wage: 80, colour: '#f2d43c', supplies: 'hunger', value: 12, unitCost: 3, strength: .22 },
  drinks: { n: 'Quiosque de Bebidas|Drinks Kiosk', em: '🥤', w: 1, h: 2, cost: 11000, wage: 110, colour: '#3fa5e2', supplies: 'thirst', value: 15, unitCost: 3.5, strength: .9 },
  cafe: { n: 'Cafeteria|Café', em: '☕', w: 2, h: 2, cost: 24000, wage: 190, colour: '#8a5a2b', supplies: 'thirst', value: 24, unitCost: 6, strength: 1 },
  waterpoint: { n: 'Bebedouro|Water Fountain', em: '⛲', w: 1, h: 1, cost: 2600, wage: 0, colour: '#7ec4dd', supplies: 'thirst', value: 0, unitCost: 0, strength: .5 },
  toilet: { n: 'Banheiro|Restroom', em: '🚻', w: 2, h: 2, cost: 13000, wage: 90, colour: '#7d8890', supplies: 'toilet', value: 2, unitCost: .6, strength: 1 },
  bench: { n: 'Banco de Praça|Park Bench', em: '🪑', w: 1, h: 1, cost: 900, wage: 0, colour: '#a87a45', supplies: 'energy', value: 0, unitCost: 0, strength: 1 },
  souvenir: { n: 'Loja de Souvenirs|Souvenir Shop', em: '🎁', w: 2, h: 2, cost: 27000, wage: 200, colour: '#9a6ad4', supplies: 'fun', value: 42, unitCost: 11, strength: .6 },
  playground: { n: 'Playground|Playground', em: '🛝', w: 3, h: 3, cost: 21000, wage: 60, colour: '#4fae4a', supplies: 'fun', value: 0, unitCost: 0, strength: 1.4 },
  bin: { n: 'Lixeira|Bin', em: '🗑️', w: 1, h: 1, cost: 450, wage: 0, colour: '#5e6a76', supplies: null, value: 0, unitCost: 0, strength: 0 },
  info: { n: 'Quiosque de Informações|Information Kiosk', em: 'ℹ️', w: 1, h: 1, cost: 5200, wage: 70, colour: '#3fa5e2', supplies: null, value: 0, unitCost: 0, strength: 0 },
  vetpost: { n: 'Posto Veterinário|Veterinary Post', em: '🏥', w: 2, h: 2, cost: 34000, wage: 0, colour: '#f4f2ec', supplies: null, value: 0, unitCost: 0, strength: 0 },
};
const DECOS = {
  tree: { n: 'Árvore|Tree', em: '🌳', cost: 380, beauty: 5, r: 4 },
  pine: { n: 'Pinheiro|Pine', em: '🌲', cost: 420, beauty: 5, r: 4 },
  palm: { n: 'Palmeira|Palm', em: '🌴', cost: 520, beauty: 6, r: 4 },
  bush: { n: 'Arbusto|Bush', em: '🌿', cost: 120, beauty: 2, r: 3 },
  flowers: { n: 'Canteiro de Flores|Flower Bed', em: '🌸', cost: 190, beauty: 4, r: 3 },
  stone: { n: 'Rocha|Rock', em: '🪨', cost: 150, beauty: 1, r: 2 },
  fountain: { n: 'Fonte|Fountain', em: '⛲', cost: 4200, beauty: 14, r: 7 },
  statue: { n: 'Estátua|Statue', em: '🗿', cost: 3100, beauty: 11, r: 6 },
  lamp: { n: 'Poste de Luz|Lamp Post', em: '💡', cost: 640, beauty: 3, r: 5 },
  sign: { n: 'Placa Informativa|Information Sign', em: '🪧', cost: 260, beauty: 2, r: 2 },
};
const ENCOBJ = {
  feeder: { n: 'Comedouro|Feeder', em: '🥣', cost: 900, role: 'food' },
  trough: { n: 'Bebedouro|Water Fountain', em: '🚰', cost: 800, role: 'water' },
  shelter: { n: 'Abrigo|Shelter', em: '🛖', cost: 3200, role: 'shelter', enr: 3 },
  toy: { n: 'Enriquecimento|Enrichment', em: '🎾', cost: 1400, role: 'enrich', enr: 5 },
  log: { n: 'Tronco|Log', em: '🪵', cost: 700, role: 'enrich', enr: 3 },
  rocks: { n: 'Formação Rochosa|Rock Formation', em: '⛰️', cost: 1900, role: 'enrich', enr: 4 },
  planting: { n: 'Vegetação|Planting', em: '🪴', cost: 500, role: 'enrich', enr: 2 },
  pool: { n: 'Piscina|Pool', em: '🏊', cost: 5200, role: 'enrich', enr: 6 },
};
const STAFF_TYPES = {
  keeper: { n: 'Tratador|Keeper', em: '🧑‍🌾', wage: 1400, colour: '#4fae4a', desc: 'Alimenta os animais e limpa os recintos|Feeds the animals and cleans the enclosures' },
  vet: { n: 'Veterinário|Vet', em: '🧑‍⚕️', wage: 2600, colour: '#f4f2ec', desc: 'Cura animais doentes e feridos|Treats sick and injured animals' },
  cleaner: { n: 'Faxineiro|Cleaner', em: '🧹', wage: 900, colour: '#3fa5e2', desc: 'Recolhe lixo das trilhas|Picks litter off the paths' },
  security: { n: 'Segurança|Security', em: '👮', wage: 1600, colour: '#33333a', desc: 'Recaptura fugas e acalma visitantes|Recaptures escapees and calms visitors' },
};

/* ==========================================================================
   5. WORLD
   ========================================================================== */
const IDX = (x, y) => y * W + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

const world = {
  terr: new Uint8Array(W * H),
  path: new Uint8Array(W * H),
  occ: new Int32Array(W * H),   // id de objeto ocupando o tile
  enc: new Int32Array(W * H),   // id do recinto
  beauty: new Float32Array(W * H), // beleza acumulada
  litter: new Float32Array(W * H),// sujeira na trilha
};
const objects = new Map();      // id -> object (building/decoration/enclosure prop)
const enclosures = new Map();   // id -> recinto

function genTerrain() {
  const g = TKEYS.indexOf('grass');
  world.terr.fill(g);
  const blobs = [];
  for (let i = 0; i < 34; i++) {
    blobs.push({
      x: rnd(W), y: rnd(H), r: rnd(3, 9),
      t: TKEYS.indexOf(pick(['woods', 'woods', 'dirt', 'rock', 'water', 'sand', 'grass']))
    });
  }
  for (const b of blobs) {
    for (let y = Math.max(0, b.y - b.r | 0); y < Math.min(H, b.y + b.r + 1); y++)
      for (let x = Math.max(0, b.x - b.r | 0); x < Math.min(W, b.x + b.r + 1); x++) {
        const d = dist(x, y, b.x, b.y);
        if (d < b.r * (.6 + Math.random() * .5)) world.terr[IDX(x, y)] = b.t;
      }
  }
  // a clear entrance plaza
  for (let y = H - 7; y < H; y++) for (let x = ENTRANCE.x - 4; x <= ENTRANCE.x + 4; x++)
    if (inB(x, y)) world.terr[IDX(x, y)] = TKEYS.indexOf('grass');
}

function tileFree(x, y, { allowPath = false, allowEnc = false } = {}) {
  if (!inB(x, y)) return false;
  const i = IDX(x, y);
  if (world.occ[i]) return false;
  if (!allowEnc && world.enc[i]) return false;
  if (!allowPath && world.path[i]) return false;
  return true;
}
function rectFree(x, y, w, h, opt) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!tileFree(x + i, y + j, opt)) return false;
  return true;
}

/* ---- caminhos ---- */
function addPath(x, y) {
  if (!inB(x, y)) return false;
  const i = IDX(x, y);
  if (world.path[i] || world.occ[i] || world.enc[i]) return false;
  world.path[i] = 1;
  world.terr[i] = TKEYS.indexOf('pavement');
  G.dirty.net = true; terrainChanged();
  return true;
}
function removePath(x, y) {
  const i = IDX(x, y);
  if (!world.path[i]) return false;
  // The gate tile is the entrance's "doormat": rebuildNet() seeds its search
  // there. With no path on it the whole network is disconnected and the zoo
  // sits at 0 visitors with no visible sign why. Don't let it be erased.
  if (x === ENTRANCE.x && y === ENTRANCE.y) return false;
  world.path[i] = 0; world.litter[i] = 0;
  world.terr[i] = TKEYS.indexOf('grass');
  G.dirty.net = true; terrainChanged();
  return true;
}

/* ==========================================================================
   ENCLOSURES — a free set of tiles, with the fence on the EDGES
   An enclosure used to be a rectangle whose outer ring became the fence: there
   was no way to build an L shape or to extend it later, and the ring was wasted
   area. Now `e.tiles` is a Set of indices and the fence is derived from the
   borders that face outwards — which allows any shape, incremental extension,
   and turns every paid tile into usable area.
   ========================================================================== */
const SIDES = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']];

function makeEnclosure(tiles, fenceKey) {
  const id = uid();
  const e = {
    id, fence: fenceKey, name: LN('Recinto |Enclosure ') + id, tiles: new Set(),
    animals: [], objs: [], cleanliness: 1, food: 1, water: 1,
    happy: .7, alerts: [], integrity: 1,
  };
  enclosures.set(id, e);
  encAddTiles(e, tiles);
  return e;
}
function encAddTiles(e, tiles) {
  for (const k of tiles) {
    if (world.enc[k]) continue;              // already belongs to someone
    e.tiles.add(k); world.enc[k] = e.id; world.path[k] = 0;
  }
  encInvalidate(e);
}
/** drops the caches derived from the shape */
function encInvalidate(e) {
  e._seg = e._segTile = e._bb = e._arr = e._vs = e._mix = null;
  G.dirty.net = true; terrainChanged();
}
function deleteEnclosure(id) {
  const e = enclosures.get(id); if (!e) return;
  for (const k of e.tiles) world.enc[k] = 0;
  for (const o of e.objs) objects.delete(o.id);
  enclosures.delete(id);
  G.dirty.net = true; terrainChanged();
}
const encArea = e => e.tiles.size;
const encTilesArr = e => e._arr || (e._arr = [...e.tiles]);
/** bounding box + centre, for staff aiming and icons */
function encBBox(e) {
  if (e._bb) return e._bb;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const k of e.tiles) {
    const x = k % W, y = (k / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  return e._bb = { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
}
/** how many edges of a tile set face outwards (= the fence's size) */
function countSegments(set) {
  let n = 0;
  for (const k of set) {
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny) || !set.has(IDX(nx, ny))) n++;
    }
  }
  return n;
}
/** outward edges grouped by tile: Map(idx -> ['N','E',...]) */
function encSegPorTile(e) {
  if (e._segTile) return e._segTile;
  const m = new Map();
  for (const k of e.tiles) {
    const x = k % W, y = (k / W) | 0;
    let l = null;
    for (const [dx, dy, side] of SIDES) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny) || !e.tiles.has(IDX(nx, ny))) (l || (l = [])).push(side);
    }
    if (l) m.set(k, l);
  }
  e._seg = [...m.values()].reduce((s, l) => s + l.length, 0);
  return e._segTile = m;
}
const encSegCount = e => (encSegPorTile(e), e._seg);
/** any tile of the enclosure, as [x, y] */
function encRandomTile(e) {
  const a = encTilesArr(e);
  if (!a.length) return null;
  const k = a[(Math.random() * a.length) | 0];
  return [k % W, (k / W) | 0];
}

/** Terrain composition of the interior. Cached: terrainScore() is called per
 *  animal every tick (and now by the thought bubbles as well), and each call
 *  chamada varria o recinto inteiro. O carimbo de tempo cobre qualquer escrita
 *  in world.terr that has not been through terrainChanged(). */
function encMix(e) {
  const agora = performance.now();
  if (e._mix && e._mixVer === G.terrVer && agora - e._mixT < 1500) return e._mix;
  const m = {}; let n = 0;
  for (const k of e.tiles) { const t = TKEYS[world.terr[k]]; m[t] = (m[t] || 0) + 1; n++; }
  for (const k in m) m[k] /= Math.max(1, n);
  e._mix = m; e._mixVer = G.terrVer; e._mixT = agora;
  return m;
}
/** marks the terrain as changed (invalidating the caches derived from it) */
function terrainChanged() { G.terrVer++; G.dirty.terr = true; }
/** 0..1 — how well the terrain suits the species' biome */
function terrainScore(e, sp) {
  const m = encMix(e); let s = 0, tot = 0;
  for (const k in sp.mix) { const want = sp.mix[k], has = m[k] || 0; s += Math.min(has, want); tot += want; }
  let score = tot > 0 ? s / tot : .5;
  // terreno errado dominante penaliza
  for (const k in m) if (!sp.mix[k] && m[k] > .3) score -= (m[k] - .3) * .5;
  return clamp(score, 0, 1);
}
function encEnrich(e) {
  let v = 0; for (const o of e.objs) v += ENCOBJ[o.kind].enr || 0;
  return clamp(v / (6 + encArea(e) * .18), 0, 1);
}
const encHasFeeder = e => e.objs.some(o => ENCOBJ[o.kind].role === 'food');
const encHasWater = e => e.objs.some(o => ENCOBJ[o.kind].role === 'water');
const encHasShelter = e => e.objs.some(o => ENCOBJ[o.kind].role === 'shelter');

/** Path positions from which the enclosure can be seen.
 *  Only a path the visitor can actually REACH from the gate counts: a
 *  neighbouring path disconnected from the network is no viewing spot at all,
 *  and counting it made the enclosure show up as an attraction that never
 *  received anyone. */
function encViewSpots(e) {
  if (e._vs && e._vsNet === G.netVer) return e._vs;
  const out = [], visto = new Set();
  for (const k of e.tiles) {
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) continue;
      const ni = IDX(nx, ny);
      if (visto.has(ni) || !world.path[ni] || netDist[ni] < 0) continue;
      visto.add(ni); out.push([nx, ny]);
    }
  }
  e._vs = out; e._vsNet = G.netVer;
  return out;
}

/* ---- objetos ---- */
function placeObject(kind, cat, x, y) {
  const def = cat === 'build' ? BUILDINGS[kind] : cat === 'deco' ? DECOS[kind] : ENCOBJ[kind];
  const w = def.w || 1, h = def.h || 1;
  const id = uid();
  const o = { id, kind, cat, x, y, w, h, queue: [], revenue: 0, sales: 0, estoque: 1, dirty: 0, hp: 1 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) world.occ[IDX(x + i, y + j)] = id;
  objects.set(id, o);
  if (cat === 'deco') applyBeauty(o, +1);
  if (cat === 'encobj') { const e = enclosures.get(world.enc[IDX(x, y)]); if (e) { e.objs.push(o); o.encId = e.id; } }
  G.dirty.terr = true;
  return o;
}
function removeObject(id) {
  const o = objects.get(id); if (!o) return;
  if (o.cat === 'deco') applyBeauty(o, -1);
  for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) world.occ[IDX(o.x + i, o.y + j)] = 0;
  if (o.encId) { const e = enclosures.get(o.encId); if (e) e.objs = e.objs.filter(z => z.id !== id); }
  objects.delete(id);
  G.dirty.terr = true;
}
function applyBeauty(o, sign) {
  const d = DECOS[o.kind]; if (!d) return;
  for (let y = Math.max(0, o.y - d.r); y <= Math.min(H - 1, o.y + d.r); y++)
    for (let x = Math.max(0, o.x - d.r); x <= Math.min(W - 1, o.x + d.r); x++) {
      const dd = dist(x, y, o.x, o.y);
      if (dd <= d.r) world.beauty[IDX(x, y)] += sign * d.beauty * (1 - dd / d.r) / 6;
    }
}

/* ---- path network: BFS from the entrance ---- */
const netDist = new Int32Array(W * H);
function rebuildNet() {
  G.dirty.net = false;
  netDist.fill(-1);
  const q = [IDX(ENTRANCE.x, ENTRANCE.y)];
  if (!world.path[q[0]]) { G.netVer++; return; }
  netDist[q[0]] = 0;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++], cx = cur % W, cy = (cur / W) | 0, d = netDist[cur];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = IDX(nx, ny);
      if (!world.path[ni] || netDist[ni] >= 0) continue;
      netDist[ni] = d + 1; q.push(ni);
    }
  }
  G.netVer++;
}
const pathConnected = (x, y) => inB(x, y) && netDist[IDX(x, y)] >= 0;

/** BFS de caminho entre dois tiles de trilha (retorna array de [x,y]) */
const _prev = new Int32Array(W * H);
function findPath(sx, sy, tx, ty) {
  if (!inB(sx, sy) || !inB(tx, ty)) return null;
  const s = IDX(sx, sy), t = IDX(tx, ty);
  if (!world.path[s] || !world.path[t]) return null;
  if (s === t) return [[sx, sy]];
  _prev.fill(-1); _prev[s] = s;
  const q = [s]; let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === t) break;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = IDX(nx, ny);
      if (!world.path[ni] || _prev[ni] >= 0) continue;
      _prev[ni] = cur; q.push(ni);
    }
  }
  if (_prev[t] < 0) return null;
  const out = []; let cur = t;
  while (cur !== s) { out.push([cur % W, (cur / W) | 0]); cur = _prev[cur]; }
  out.push([sx, sy]); out.reverse();
  return out;
}
/** the nearest free path tile to (x,y) */
function nearestPathTile(x, y, maxR = 14) {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx, ny = y + dy;
      if (inB(nx, ny) && world.path[IDX(nx, ny)] && netDist[IDX(nx, ny)] >= 0) return [nx, ny];
    }
  }
  return null;
}