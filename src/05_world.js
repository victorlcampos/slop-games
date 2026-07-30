/* ==========================================================================
   4. CATÁLOGOS DE CONSTRUÇÃO
   ========================================================================== */
const FENCES = {
  madeira: { n: 'Cerca de Madeira', em: '🪵', cost: 55, forca: 1, visao: 1, cor: '#a87a45', alt: 13 },
  ferro: { n: 'Grade de Ferro', em: '🔩', cost: 130, forca: 3, visao: .92, cor: '#5e6068', alt: 19 },
  pedra: { n: 'Muro de Pedra', em: '🧱', cost: 210, forca: 4, visao: .55, cor: '#9b9a94', alt: 20 },
  vidro: { n: 'Vidro Blindado', em: '🪟', cost: 340, forca: 5, visao: 1, cor: '#a8d8e8', alt: 21 },
  eletrica: { n: 'Cerca Elétrica', em: '⚡', cost: 430, forca: 6, visao: .96, cor: '#c9a83c', alt: 17 },
  aviario: { n: 'Tela de Aviário', em: '🕸️', cost: 265, forca: 3, visao: .86, cor: '#8a9098', alt: 34, aereo: 1 },
  aquario: { n: 'Vidro de Aquário', em: '🌊', cost: 520, forca: 6, visao: 1, cor: '#7ec4dd', alt: 24, aquatico: 1 },
};
const BUILDINGS = {
  lanchonete: { n: 'Lanchonete', em: '🍔', w: 2, h: 2, cost: 16000, salario: 140, cor: '#e2543f', supre: 'fome', valor: 26, custo: 7, forca: .45 },
  restaurante: { n: 'Restaurante', em: '🍽️', w: 3, h: 3, cost: 58000, salario: 340, cor: '#b5502a', supre: 'fome', valor: 68, custo: 19, forca: 1 },
  pizzaria: { n: 'Pizzaria', em: '🍕', w: 2, h: 3, cost: 38000, salario: 240, cor: '#d9782c', supre: 'fome', valor: 44, custo: 13, forca: .8 },
  sorveteria: { n: 'Sorveteria', em: '🍦', w: 2, h: 2, cost: 19000, salario: 150, cor: '#f2a8c0', supre: 'fome', valor: 20, custo: 5, forca: .3 },
  pipoca: { n: 'Carrinho de Pipoca', em: '🍿', w: 1, h: 1, cost: 6500, salario: 80, cor: '#f2d43c', supre: 'fome', valor: 12, custo: 3, forca: .22 },
  bebidas: { n: 'Quiosque de Bebidas', em: '🥤', w: 1, h: 2, cost: 11000, salario: 110, cor: '#3fa5e2', supre: 'sede', valor: 15, custo: 3.5, forca: .9 },
  cafe: { n: 'Cafeteria', em: '☕', w: 2, h: 2, cost: 24000, salario: 190, cor: '#8a5a2b', supre: 'sede', valor: 24, custo: 6, forca: 1 },
  bebedouro: { n: 'Bebedouro', em: '⛲', w: 1, h: 1, cost: 2600, salario: 0, cor: '#7ec4dd', supre: 'sede', valor: 0, custo: 0, forca: .5 },
  banheiro: { n: 'Banheiro', em: '🚻', w: 2, h: 2, cost: 13000, salario: 90, cor: '#7d8890', supre: 'banheiro', valor: 2, custo: .6, forca: 1 },
  banco: { n: 'Banco de Praça', em: '🪑', w: 1, h: 1, cost: 900, salario: 0, cor: '#a87a45', supre: 'energia', valor: 0, custo: 0, forca: 1 },
  souvenir: { n: 'Loja de Souvenirs', em: '🎁', w: 2, h: 2, cost: 27000, salario: 200, cor: '#9a6ad4', supre: 'diversao', valor: 42, custo: 11, forca: .6 },
  playground: { n: 'Playground', em: '🛝', w: 3, h: 3, cost: 21000, salario: 60, cor: '#4fae4a', supre: 'diversao', valor: 0, custo: 0, forca: 1.4 },
  lixeira: { n: 'Lixeira', em: '🗑️', w: 1, h: 1, cost: 450, salario: 0, cor: '#5e6a76', supre: null, valor: 0, custo: 0, forca: 0 },
  info: { n: 'Quiosque de Informações', em: 'ℹ️', w: 1, h: 1, cost: 5200, salario: 70, cor: '#3fa5e2', supre: null, valor: 0, custo: 0, forca: 0 },
  posto: { n: 'Posto Veterinário', em: '🏥', w: 2, h: 2, cost: 34000, salario: 0, cor: '#f4f2ec', supre: null, valor: 0, custo: 0, forca: 0 },
};
const DECOS = {
  arvore: { n: 'Árvore', em: '🌳', cost: 380, beleza: 5, r: 4 },
  pinheiro: { n: 'Pinheiro', em: '🌲', cost: 420, beleza: 5, r: 4 },
  palmeira: { n: 'Palmeira', em: '🌴', cost: 520, beleza: 6, r: 4 },
  arbusto: { n: 'Arbusto', em: '🌿', cost: 120, beleza: 2, r: 3 },
  flores: { n: 'Canteiro de Flores', em: '🌸', cost: 190, beleza: 4, r: 3 },
  pedra: { n: 'Rocha', em: '🪨', cost: 150, beleza: 1, r: 2 },
  fonte: { n: 'Fonte', em: '⛲', cost: 4200, beleza: 14, r: 7 },
  estatua: { n: 'Estátua', em: '🗿', cost: 3100, beleza: 11, r: 6 },
  poste: { n: 'Poste de Luz', em: '💡', cost: 640, beleza: 3, r: 5 },
  placa: { n: 'Placa Informativa', em: '🪧', cost: 260, beleza: 2, r: 2 },
};
const ENCOBJ = {
  comedouro: { n: 'Comedouro', em: '🥣', cost: 900, tipo: 'comida' },
  bebedouro2: { n: 'Bebedouro', em: '🚰', cost: 800, tipo: 'agua' },
  abrigo: { n: 'Abrigo', em: '🛖', cost: 3200, tipo: 'abrigo', enr: 3 },
  brinquedo: { n: 'Enriquecimento', em: '🎾', cost: 1400, tipo: 'enr', enr: 5 },
  tronco: { n: 'Tronco', em: '🪵', cost: 700, tipo: 'enr', enr: 3 },
  rochaE: { n: 'Formação Rochosa', em: '⛰️', cost: 1900, tipo: 'enr', enr: 4 },
  plantaE: { n: 'Vegetação', em: '🪴', cost: 500, tipo: 'enr', enr: 2 },
  piscina: { n: 'Piscina', em: '🏊', cost: 5200, tipo: 'enr', enr: 6 },
};
const STAFF_TYPES = {
  trat: { n: 'Tratador', em: '🧑‍🌾', salario: 1400, cor: '#4fae4a', desc: 'Alimenta os animais e limpa os recintos' },
  vet: { n: 'Veterinário', em: '🧑‍⚕️', salario: 2600, cor: '#f4f2ec', desc: 'Cura animais doentes e feridos' },
  fax: { n: 'Faxineiro', em: '🧹', salario: 900, cor: '#3fa5e2', desc: 'Recolhe lixo das trilhas' },
  seg: { n: 'Segurança', em: '👮', salario: 1600, cor: '#33333a', desc: 'Recaptura fugas e acalma visitantes' },
};

/* ==========================================================================
   5. MUNDO
   ========================================================================== */
const IDX = (x, y) => y * W + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

const world = {
  terr: new Uint8Array(W * H),
  path: new Uint8Array(W * H),
  occ: new Int32Array(W * H),   // id de objeto ocupando o tile
  enc: new Int32Array(W * H),   // id do recinto
  bel: new Float32Array(W * H), // beleza acumulada
  lixo: new Float32Array(W * H),// sujeira na trilha
};
const objects = new Map();      // id -> objeto (prédio/deco/objeto de recinto)
const enclosures = new Map();   // id -> recinto

function genTerrain() {
  const g = TKEYS.indexOf('grama');
  world.terr.fill(g);
  const blobs = [];
  for (let i = 0; i < 34; i++) {
    blobs.push({
      x: rnd(W), y: rnd(H), r: rnd(3, 9),
      t: TKEYS.indexOf(pick(['mata', 'mata', 'terra', 'rocha', 'agua', 'areia', 'grama']))
    });
  }
  for (const b of blobs) {
    for (let y = Math.max(0, b.y - b.r | 0); y < Math.min(H, b.y + b.r + 1); y++)
      for (let x = Math.max(0, b.x - b.r | 0); x < Math.min(W, b.x + b.r + 1); x++) {
        const d = dist(x, y, b.x, b.y);
        if (d < b.r * (.6 + Math.random() * .5)) world.terr[IDX(x, y)] = b.t;
      }
  }
  // praça de entrada limpa
  for (let y = H - 7; y < H; y++) for (let x = ENTRANCE.x - 4; x <= ENTRANCE.x + 4; x++)
    if (inB(x, y)) world.terr[IDX(x, y)] = TKEYS.indexOf('grama');
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
  world.terr[i] = TKEYS.indexOf('piso');
  G.dirty.net = true; terrenoMudou();
  return true;
}
function removePath(x, y) {
  const i = IDX(x, y);
  if (!world.path[i]) return false;
  // O tile do portão é o "tapete" da entrada: rebuildNet() semeia a busca nele.
  // Sem trilha ali a malha inteira fica desconectada e o zoo trava em 0 visitante
  // sem nenhum sinal visível. Não deixa apagar.
  if (x === ENTRANCE.x && y === ENTRANCE.y) return false;
  world.path[i] = 0; world.lixo[i] = 0;
  world.terr[i] = TKEYS.indexOf('grama');
  G.dirty.net = true; terrenoMudou();
  return true;
}

/* ==========================================================================
   RECINTOS — conjunto livre de tiles, cerca nas ARESTAS
   Antes o recinto era um retângulo cujo anel externo virava cerca: não dava
   para fazer forma em L nem ampliar depois, e o anel era área perdida. Agora
   `e.tiles` é um Set de índices e a cerca é derivada das bordas que dão para
   fora — o que permite qualquer formato, ampliação incremental, e faz todo
   tile pago virar área útil.
   ========================================================================== */
const LADOS = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']];

function makeEnclosure(tiles, fenceKey) {
  const id = uid();
  const e = {
    id, fence: fenceKey, nome: 'Recinto ' + id, tiles: new Set(),
    animals: [], objs: [], limpeza: 1, comida: 1, agua: 1,
    happy: .7, alertas: [], integridade: 1,
  };
  enclosures.set(id, e);
  encAddTiles(e, tiles);
  return e;
}
function encAddTiles(e, tiles) {
  for (const k of tiles) {
    if (world.enc[k]) continue;              // já é de alguém
    e.tiles.add(k); world.enc[k] = e.id; world.path[k] = 0;
  }
  encInvalida(e);
}
/** derruba os caches derivados da forma */
function encInvalida(e) {
  e._seg = e._segTile = e._bb = e._arr = e._vs = e._mix = null;
  G.dirty.net = true; terrenoMudou();
}
function deleteEnclosure(id) {
  const e = enclosures.get(id); if (!e) return;
  for (const k of e.tiles) world.enc[k] = 0;
  for (const o of e.objs) objects.delete(o.id);
  enclosures.delete(id);
  G.dirty.net = true; terrenoMudou();
}
const encArea = e => e.tiles.size;
const encTilesArr = e => e._arr || (e._arr = [...e.tiles]);
/** caixa envolvente + centro, para mira de funcionário e ícones */
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
/** quantas arestas de um conjunto de tiles dão para fora (= tamanho da cerca) */
function contarSegmentos(set) {
  let n = 0;
  for (const k of set) {
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of LADOS) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny) || !set.has(IDX(nx, ny))) n++;
    }
  }
  return n;
}
/** arestas externas agrupadas por tile: Map(idx -> ['N','E',...]) */
function encSegPorTile(e) {
  if (e._segTile) return e._segTile;
  const m = new Map();
  for (const k of e.tiles) {
    const x = k % W, y = (k / W) | 0;
    let l = null;
    for (const [dx, dy, lado] of LADOS) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny) || !e.tiles.has(IDX(nx, ny))) (l || (l = [])).push(lado);
    }
    if (l) m.set(k, l);
  }
  e._seg = [...m.values()].reduce((s, l) => s + l.length, 0);
  return e._segTile = m;
}
const encSegCount = e => (encSegPorTile(e), e._seg);
/** um tile qualquer do recinto, como [x, y] */
function encTileAleatorio(e) {
  const a = encTilesArr(e);
  if (!a.length) return null;
  const k = a[(Math.random() * a.length) | 0];
  return [k % W, (k / W) | 0];
}

/** Composição de terreno do interior. Cacheada: terrainScore() é chamado por
 *  animal a cada tick (e agora também pelos balões de pensamento), e cada
 *  chamada varria o recinto inteiro. O carimbo de tempo cobre qualquer escrita
 *  em world.terr que não tenha passado por terrenoMudou(). */
function encMix(e) {
  const agora = performance.now();
  if (e._mix && e._mixVer === G.terrVer && agora - e._mixT < 1500) return e._mix;
  const m = {}; let n = 0;
  for (const k of e.tiles) { const t = TKEYS[world.terr[k]]; m[t] = (m[t] || 0) + 1; n++; }
  for (const k in m) m[k] /= Math.max(1, n);
  e._mix = m; e._mixVer = G.terrVer; e._mixT = agora;
  return m;
}
/** marca que o terreno mudou (invalida caches derivados dele) */
function terrenoMudou() { G.terrVer++; G.dirty.terr = true; }
/** 0..1 — quão bem o terreno atende o bioma da espécie */
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
const encHasFeeder = e => e.objs.some(o => ENCOBJ[o.kind].tipo === 'comida');
const encHasWater = e => e.objs.some(o => ENCOBJ[o.kind].tipo === 'agua');
const encHasShelter = e => e.objs.some(o => ENCOBJ[o.kind].tipo === 'abrigo');

/** Posições de trilha de onde se vê o recinto.
 *  Só vale trilha que o visitante consegue ALCANÇAR a partir do portão: uma
 *  trilha vizinha porém desligada da malha não é ponto de observação nenhum,
 *  e contá-la fazia o recinto aparecer como atração sem nunca receber ninguém. */
function encViewSpots(e) {
  if (e._vs && e._vsNet === G.netVer) return e._vs;
  const out = [], visto = new Set();
  for (const k of e.tiles) {
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of LADOS) {
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
  const o = { id, kind, cat, x, y, w, h, fila: [], receita: 0, vendas: 0, estoque: 1, sujo: 0, hp: 1 };
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
      if (dd <= d.r) world.bel[IDX(x, y)] += sign * d.beleza * (1 - dd / d.r) / 6;
    }
}

/* ---- rede de caminhos: BFS a partir da entrada ---- */
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
/** tile de trilha livre mais próximo de (x,y) */
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
