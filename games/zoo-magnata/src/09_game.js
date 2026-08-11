/* ==========================================================================
   12. CONSTRUÇÃO — validação e custos
   ========================================================================== */
function dragRect() {
  const d = G.drag, h = G.hover;
  if (!d || !h) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(d.x, h[0]), y = Math.min(d.y, h[1]);
  return { x, y, w: Math.abs(h[0] - d.x) + 1, h: Math.abs(h[1] - d.y) + 1 };
}
/* ---- recintos de forma livre ----
   Um arraste vira: recinto novo (se não encostar em nada) ou ampliação (se
   encostar em exatamente um). Repetindo arrastes dá para montar L, T, U — o
   formato deixa de ser obrigatoriamente retangular. */
const MIN_TILES_RECINTO = 4;

/** tiles do retângulo que estão livres para virar recinto */
function tilesLivresDoRect(r) {
  const out = [];
  for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
    const x = r.x + i, y = r.y + j;
    if (!inB(x, y)) continue;
    const k = IDX(x, y);
    if (world.occ[k] || world.enc[k] || world.path[k]) continue;
    out.push(k);
  }
  return out;
}
/** ids de recinto que o retângulo sobrepõe ou toca ortogonalmente */
function recintosTocados(r) {
  const ids = new Set();
  for (let j = -1; j <= r.h; j++) for (let i = -1; i <= r.w; i++) {
    const foraX = i < 0 || i >= r.w, foraY = j < 0 || j >= r.h;
    if (foraX && foraY) continue;              // cantos diagonais não contam
    const x = r.x + i, y = r.y + j;
    if (!inB(x, y)) continue;
    const id = world.enc[IDX(x, y)];
    if (id) ids.add(id);
  }
  return [...ids];
}
/** o que este arraste faria: {acao, custo, tiles, alvo, motivo} */
function planoDoArraste(r, fenceKey) {
  const livres = tilesLivresDoRect(r);
  const tocados = recintosTocados(r);
  if (tocados.length > 1)
    return { acao: 'swims', motivo: LN('Esse retângulo encosta em 2 recintos — amplie um de cada vez.|That rectangle touches 2 enclosures — extend one at a time.') };
  if (!livres.length)
    return { acao: 'swims', motivo: LN('Nenhum tile livre aqui (já tem trilha, prédio ou recinto).|No free tile here (there is already a path, a building or an enclosure).') };
  if (tocados.length === 1) {
    const e = enclosures.get(tocados[0]);
    const uniao = new Set(e.tiles);
    for (const k of livres) uniao.add(k);
    // paga só o crescimento da cerca; preencher um recanto pode até encurtá-la
    const delta = Math.max(0, contarSegmentos(uniao) - encSegCount(e));
    return {
      acao: 'ampliar', alvo: e, tiles: livres,
      cost: delta * FENCES[e.fence].cost + livres.length * 18,
    };
  }
  if (livres.length < MIN_TILES_RECINTO)
    return { acao: 'swims', motivo: BI`Recinto muito pequeno: precisa de ${MIN_TILES_RECINTO} tiles livres.|Enclosure too small: it needs ${MIN_TILES_RECINTO} free tiles.` };
  const set = new Set(livres);
  return { acao: 'criar', tiles: livres, cost: contarSegmentos(set) * FENCES[fenceKey].cost };
}
const custoCercaDe = e => encSegCount(e) * FENCES[e.fence].cost;

function podeColocar(t, x, y) {
  if (!inB(x, y)) return false;
  const k = IDX(x, y);
  switch (t.cat) {
    case 'caminho':
      return t.key === 'del' ? !!world.path[k] : !world.path[k] && !world.occ[k] && !world.enc[k];
    case 'terreno':
      return !world.occ[k] && !world.path[k];
    case 'build':
      return rectFree(x, y, t.w, t.h);
    case 'deco':
      return tileFree(x, y);
    case 'encobj': {
      const e = enclosures.get(world.enc[k]);
      if (!e || world.occ[k]) return false;
      return true;
    }
    case 'animal':
      return !!world.enc[k];
    case 'demolir':
      return !!(world.occ[k] || world.enc[k] || world.path[k]);
    case 'recinto':
      return true;
  }
  return false;
}
function aplicarFerramenta(x, y, arrastando) {
  const t = G.tool; if (!t || !inB(x, y)) return;
  const k = IDX(x, y);
  if (t.cat === 'caminho') {
    if (t.key === 'del') { if (removePath(x, y)) { earn(6, 'venda'); SFX.toca('demolir'); } return; }
    if (G.money < t.cost) return semGrana();
    if (addPath(x, y)) {
      spend(t.cost, 'obra'); SFX.toca('trilha');
      // uma pincelada inteira = 1 desfazer (o grupo fecha ao soltar o dedo)
      if (!undoGrupo || undoGrupo.kind !== 'trilha') undoGrupo = { kind: 'trilha', cat: 'obra', tiles: [], cost: 0 };
      undoGrupo.tiles.push([x, y]); undoGrupo.cost += t.cost;
    }
  } else if (t.cat === 'terreno') {
    const alvo = TKEYS.indexOf(t.key);
    const raio = G.shift ? 1 : 0;
    for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) continue;
      const nk = IDX(nx, ny);
      if (world.occ[nk] || world.path[nk]) continue;
      if (world.terr[nk] === alvo) continue;
      if (G.money < t.cost) return semGrana();
      const antes = world.terr[nk];
      world.terr[nk] = alvo; spend(t.cost, 'obra'); terrenoMudou(); SFX.toca('terreno');
      if (!undoGrupo || undoGrupo.kind !== 'terreno') undoGrupo = { kind: 'terreno', cat: 'obra', mudancas: [], cost: 0 };
      undoGrupo.mudancas.push([nk, antes, alvo]); undoGrupo.cost += t.cost;
    }
  } else if (t.cat === 'build') {
    if (arrastando) return;
    if (!rectFree(x, y, t.w, t.h)) { toast(LN('🚫 Espaço ocupado|🚫 Space taken'), 'bad'); return; }
    if (G.money < t.cost) return semGrana();
    spend(t.cost, 'obra'); const ob = placeObject(t.key, 'build', x, y); SFX.toca('predio');
    undoRegistrar({ kind: 'objeto', cat: 'obra', id: ob.id, cost: t.cost, rotulo: t.n });
    if (!nearestPathTile(x, y, 4)) toast(LN('⚠️ Sem trilha por perto — visitantes não vão conseguir chegar|⚠️ No path nearby — visitors will not be able to reach it'), 'bad');
  } else if (t.cat === 'deco') {
    if (!tileFree(x, y)) return;
    if (G.money < t.cost) return semGrana();
    spend(t.cost, 'obra'); const od = placeObject(t.key, 'deco', x, y); SFX.toca('predio');
    undoRegistrar({ kind: 'objeto', cat: 'obra', id: od.id, cost: t.cost, rotulo: t.n });
  } else if (t.cat === 'encobj') {
    if (arrastando) return;
    const e = enclosures.get(world.enc[k]);
    if (!e) { toast(LN('🚫 Objetos de recinto só vão dentro de um recinto|🚫 Enclosure objects only go inside an enclosure'), 'bad'); return; }
    if (world.occ[k]) { toast('🚫 Tile ocupado', 'bad'); return; }
    if (G.money < t.cost) return semGrana();
    spend(t.cost, 'obra'); const oe = placeObject(t.key, 'encobj', x, y); SFX.toca('predio');
    undoRegistrar({ kind: 'objeto', cat: 'obra', id: oe.id, cost: t.cost, rotulo: t.n });
  } else if (t.cat === 'animal') {
    if (arrastando) return;
    const e = enclosures.get(world.enc[k]);
    if (!e) { toast(LN('🚫 Clique dentro de um recinto|🚫 Click inside an enclosure'), 'bad'); return; }
    if (comprarPara(t.sp, e)) { select('enc', e); }
  } else if (t.cat === 'demolir') {
    demolirEm(x, y);
  }
}
function semGrana() { SFX.toca('erro'); toast('💸 Caixa insuficiente', 'bad'); }
function demolirEm(x, y) {
  const k = IDX(x, y);
  if (world.occ[k]) {
    const o = objects.get(world.occ[k]);
    if (o) {
      const def = BUILDINGS[o.kind] || DECOS[o.kind] || ENCOBJ[o.kind];
      earn(Math.round((def.cost || 0) * .5), 'venda'); removeObject(o.id); SFX.toca('demolir');
    }
    return;
  }
  if (world.path[k]) {
    if (x === ENTRANCE.x && y === ENTRANCE.y) {
      toast(LN('🚪 A trilha do portão não pode ser removida — é por ali que os visitantes entram.|🚪 The gate path cannot be removed — that is where the visitors come in.'), 'bad');
      return;
    }
    removePath(x, y); earn(6, 'venda'); return;
  }
  if (world.enc[k]) {
    const e = enclosures.get(world.enc[k]);
    if (!e) return;
    if (e.animals.length) { toast(LN('🚫 Tire os animais antes de demolir o recinto|🚫 Take the animals out before demolishing the enclosure'), 'bad'); return; }
    const dev = Math.round(custoCercaDe(e) * .5);
    deleteEnclosure(e.id); earn(dev, 'venda'); SFX.toca('demolir');
    toast('🔨 Recinto demolido (+' + moneyFull(dev) + ')', 'money');
  }
}

/* ---- seleção ---- */
function pickAt(sx, sy) {
  let best = null, bd = 34 * 34;
  const chk = (ent, tipo) => {
    const px = w2sx(ent.x, ent.y), py = w2sy(ent.x, ent.y) - 14 * cam.z;
    const d = dist2(px, py, sx, sy);
    if (d < bd) { bd = d; best = { tipo, ref: ent }; }
  };
  for (const a of G.animals) if (!a.morto) chk(a, 'animal');
  for (const s of G.staff) chk(s, 'staff');
  // visitantes por último: com 200 na tela eles não devem roubar o toque do bicho
  if (!best) { bd = 20 * 20; for (const v of G.visitors) chk(v, 'vis'); }
  if (best) return best;
  const [wx, wy] = s2w(sx, sy);
  const x = Math.floor(wx), y = Math.floor(wy);
  if (!inB(x, y)) return null;
  const k = IDX(x, y);
  if (world.occ[k]) { const o = objects.get(world.occ[k]); if (o && o.cat !== 'encobj') return { kind: 'obj', ref: o }; if (o) return { kind: 'obj', ref: o }; }
  if (world.enc[k]) { const e = enclosures.get(world.enc[k]); if (e) return { kind: 'enc', ref: e }; }
  return null;
}

/* ==========================================================================
   13. INPUT
   ========================================================================== */
const ZMIN = .26, ZMAX = 2.6;
const ptrs = new Map();            // ponteiros ativos: id -> {x,y}
let panning = false, panSX = 0, panSY = 0, panCX = 0, panCY = 0;
let pintando = false;
let pinch = null;                  // gesto de pinça em curso
let tapCand = null;                // candidato a toque curto (= seleção)
let pendenteTool = null;           // 1ª aplicação de ferramenta adiada (toque)
G.hover = null; G.shift = false;

function evPos(e) {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function startPan(sx, sy) {
  panning = true; panSX = sx; panSY = sy; panCX = cam.x; panCY = cam.y;
  cv.style.cursor = 'grabbing';
}
function stopPan() { panning = false; cv.style.cursor = 'crosshair'; }
/** aplica zoom mantendo o ponto (sx,sy) da tela ancorado no mesmo tile */
function zoomAt(fator, sx, sy) {
  const [wx, wy] = s2w(sx, sy);
  cam.z = clamp(cam.z * fator, ZMIN, ZMAX);
  cam.x += sx - w2sx(wx, wy);
  cam.y += sy - w2sy(wx, wy);
}
/** conclui o retângulo de recinto (compartilhado por mouse e toque) */
function fecharArrasteRecinto() {
  if (!(G.drag && G.tool && G.tool.cat === 'recinto')) return;
  const r = dragRect();
  G.drag = null;
  if (r.w < 1 || r.h < 1) return;
  const p = planoDoArraste(r, G.tool.key);
  if (p.acao === 'swims') { toast('🚫 ' + p.motivo, 'bad'); return; }
  if (G.money < p.cost) return semGrana();
  spend(p.cost, 'obra');
  if (p.acao === 'ampliar') {
    encAddTiles(p.alvo, p.tiles); SFX.toca('ampliar');
    undoRegistrar({ kind: 'ampliacao', cat: 'obra', id: p.alvo.id, tiles: [...p.tiles], cost: p.cost });
    select('enc', p.alvo);
    toast(BI`➕ ${p.alvo.name} ampliado para ${encArea(p.alvo)} tiles|➕ ${p.alvo.name} extended to ${encArea(p.alvo)} tiles`, 'good');
  } else {
    const e2 = makeEnclosure(p.tiles, G.tool.key); SFX.toca('construir');
    undoRegistrar({ kind: 'recinto', cat: 'obra', id: e2.id, cost: p.cost });
    select('enc', e2);
    toast(BI`🚧 ${e2.name} construído (${encArea(e2)} tiles) — arraste ao lado para ampliar|🚧 ${e2.name} built (${encArea(e2)} tiles) — drag alongside it to extend`, 'good');
  }
}

/* ==========================================================================
   DESFAZER — as últimas 5 compras (botão ↩️ no HUD ou Ctrl+Z)
   ========================================================================== */
const UNDO_MAX = 5;
let undoGrupo = null;          // pincelada de trilha/terreno em andamento
function undoRegistrar(ent) {
  G.undo.push(ent);
  if (G.undo.length > UNDO_MAX) G.undo.shift();
  atualizarUndoBtn();
}
/** fecha a pincelada atual (chamado ao soltar o ponteiro) */
function undoFecharGrupo() {
  if (!undoGrupo) return;
  const g = undoGrupo; undoGrupo = null;
  if ((g.tiles && g.tiles.length) || (g.mudancas && g.mudancas.length)) undoRegistrar(g);
}
function atualizarUndoBtn() {
  const b = $('#zUndo'); if (!b) return;
  b.disabled = !G.undo.length;
  b.title = G.undo.length ? BI`Desfazer última compra — ${G.undo.length} disponíve${G.undo.length > 1 ? 'is' : 'l'} (Ctrl+Z)|Undo the last purchase — ${G.undo.length} available (Ctrl+Z)`
    : LN('Nada para desfazer (Ctrl+Z)|Nothing to undo (Ctrl+Z)');
}
function desfazerUltima() {
  undoFecharGrupo();
  const ent = G.undo.pop();
  atualizarUndoBtn();
  if (!ent) { SFX.toca('ui'); toast(LN('↩️ Nada para desfazer|↩️ Nothing to undo'), ''); return; }
  const devolve = v => { v = Math.round(v); G.money += v; lgr(ent.cat || 'obra', -v); return v; };
  let msg = '', valor = 0;
  switch (ent.kind) {
    case 'trilha': {
      let n = 0;
      for (const [x, y] of ent.tiles) if (removePath(x, y)) n++;
      if (n) { valor = devolve(ent.cost * n / ent.tiles.length); msg = `Trilha (${n} tile${n > 1 ? 's' : ''})`; }
      else msg = '!' + LN('a trilha já não existe mais|the path is gone already');
      break;
    }
    case 'terreno': {
      let n = 0;
      for (const [k, antes, depois] of ent.mudancas)
        if (world.terr[k] === depois && !world.path[k] && !world.occ[k]) { world.terr[k] = antes; n++; }
      if (n) { terrenoMudou(); valor = devolve(ent.cost * n / ent.mudancas.length); msg = BI`Pintura de terreno (${n} tile${n > 1 ? 's' : ''})|Terrain painting (${n} tile${n > 1 ? 's' : ''})`; }
      else msg = '!' + LN('o terreno já mudou de novo|the terrain has changed again');
      break;
    }
    case 'objeto': {
      const o = objects.get(ent.id);
      if (o) {
        if (G.sel && G.sel.ref === o) deselect();
        removeObject(ent.id); valor = devolve(ent.cost); msg = ent.rotulo;
      } else msg = '!' + ent.rotulo + ' já foi removido';
      break;
    }
    case 'animal': {
      const a = G.animals.find(z => z.id === ent.id);
      if (a && !a.morto) {
        if (G.sel && G.sel.ref === a) deselect();
        G.animals = G.animals.filter(z => z.id !== ent.id);
        G.escaped = G.escaped.filter(z => z.id !== ent.id);
        const e = enclosures.get(a.enc);
        if (e) e.animals = e.animals.filter(z => z.id !== ent.id);
        valor = devolve(ent.cost); msg = BI`${LN(ent.rotulo)} devolvido à loja|${LN(ent.rotulo)} returned to the shop`;
      } else msg = '!' + LN('o animal já não está no plantel|the animal is no longer in the collection');
      break;
    }
    case 'recinto': {
      const e = enclosures.get(ent.id);
      if (!e) { msg = '!' + LN('o recinto já foi demolido|the enclosure has been demolished'); break; }
      if (e.animals.some(a => !a.morto)) { msg = '!' + LN('o recinto tem animais — venda ou transfira antes|the enclosure has animals — sell or transfer them first'); break; }
      if (e.objs.length) { msg = '!o recinto tem objetos dentro — remova antes'; break; }
      if (G.sel && G.sel.ref === e) deselect();
      deleteEnclosure(ent.id); valor = devolve(ent.cost); msg = 'Recinto';
      break;
    }
    case 'ampliacao': {
      const e = enclosures.get(ent.id);
      if (!e) { msg = '!' + LN('o recinto já foi demolido|the enclosure has been demolished'); break; }
      const set = new Set(ent.tiles.filter(k => e.tiles.has(k)));
      if (!set.size) { msg = '!' + LN('a ampliação já não existe|the extension is gone already'); break; }
      if (set.size >= e.tiles.size) { msg = '!desfazer apagaria o recinto inteiro'; break; }
      if (e.objs.some(o => set.has(IDX(o.x, o.y)))) { msg = '!' + LN('há objetos na área ampliada — remova antes|there are objects in the extended area — remove them first'); break; }
      for (const k of set) { e.tiles.delete(k); world.enc[k] = 0; }
      encInvalida(e);
      for (const a of e.animals) {   // bicho que ficou de fora volta para dentro
        if (a.morto) continue;
        if (!e.tiles.has(IDX(clamp(a.x | 0, 0, W - 1), clamp(a.y | 0, 0, H - 1)))) {
          const tl = encTileAleatorio(e);
          if (tl) { a.x = tl[0] + .5; a.y = tl[1] + .5; a.tx = a.x; a.ty = a.y; }
        }
      }
      valor = devolve(ent.cost * set.size / ent.tiles.length);
      msg = BI`Ampliação (${set.size} tile${set.size > 1 ? 's' : ''})|Extension (${set.size} tile${set.size > 1 ? 's' : ''})`;
      break;
    }
    case 'cerca': {
      const e = enclosures.get(ent.id);
      if (!e) { msg = '!' + LN('o recinto já foi demolido|the enclosure has been demolished'); break; }
      if (e.fence !== ent.depois) { msg = '!' + LN('a cerca já foi trocada de novo|the fence has been swapped again'); break; }
      e.fence = ent.antes; valor = devolve(ent.cost); msg = BI`Cerca de volta para ${LN(FENCES[ent.antes].n)}|Fence back to ${LN(FENCES[ent.antes].n)}`;
      break;
    }
  }
  if (msg[0] !== '!') {
    SFX.toca('demolir');
    toast(`↩️ Desfeito: ${msg} — reembolso ${moneyFull(valor)}`, 'good');
    if (typeof refreshInspector === 'function') refreshInspector();
  } else {
    SFX.toca('erro');
    toast(BI`↩️ Não deu para desfazer: ${msg.slice(1)}|↩️ Could not undo: ${msg.slice(1)}`, 'bad');
  }
}

cv.addEventListener('contextmenu', e => e.preventDefault());

cv.addEventListener('pointerdown', e => {
  if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
  const [sx, sy] = evPos(e);
  ptrs.set(e.pointerId, { x: sx, y: sy });

  // Dois dedos: pinça. Cancela o que o primeiro dedo tinha começado — quem
  // abre a mão quer navegar, não desenhar.
  if (ptrs.size === 2) {
    pintando = false; G.drag = null; tapCand = null; pendenteTool = null; stopPan();
    const [a, b] = [...ptrs.values()];
    pinch = { d0: dist(a.x, a.y, b.x, b.y), z0: cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  if (ptrs.size > 2) return;

  if (e.button === 2 || e.button === 1 || (e.button === 0 && G.space)) { startPan(sx, sy); return; }
  if (e.button !== 0) return;

  const [wx, wy] = s2w(sx, sy);
  const x = Math.floor(wx), y = Math.floor(wy);
  G.hover = [x, y];
  if (G.tool) {
    if (G.tool.cat === 'recinto') { G.drag = { x, y }; return; }
    pintando = true;
    // No toque, a primeira aplicação espera o gesto se confirmar como de um
    // dedo (mover ou soltar). Aplicar já no encostar fazia o primeiro dedo de
    // uma pinça deixar trilha/prédio perdido no mapa.
    if (e.pointerType === 'touch') pendenteTool = { x, y };
    else aplicarFerramenta(x, y, false);
  } else {
    // sem ferramenta um dedo arrasta a câmera; se quase não andar, é seleção
    startPan(sx, sy);
    tapCand = { x: sx, y: sy, t: performance.now() };
  }
});

cv.addEventListener('pointermove', e => {
  const [sx, sy] = evPos(e);
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: sx, y: sy });

  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const d = dist(a.x, a.y, b.x, b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (d > 6 && pinch.d0 > 6) {
      const alvo = clamp(pinch.z0 * (d / pinch.d0), ZMIN, ZMAX);
      zoomAt(alvo / cam.z, pinch.mx, pinch.my);
    }
    cam.x += mx - pinch.mx; cam.y += my - pinch.my;   // pinça também desloca
    pinch.mx = mx; pinch.my = my;
    return;
  }
  if (panning) {
    cam.x = panCX + (sx - panSX); cam.y = panCY + (sy - panSY);
    if (tapCand && dist(sx, sy, tapCand.x, tapCand.y) > 11) tapCand = null;
    return;
  }
  const [wx, wy] = s2w(sx, sy);
  const x = Math.floor(wx), y = Math.floor(wy);
  const mudou = !G.hover || G.hover[0] !== x || G.hover[1] !== y;
  G.hover = [x, y];
  if (pintando && G.tool) {
    if (pendenteTool) { aplicarFerramenta(pendenteTool.x, pendenteTool.y, false); pendenteTool = null; }
    if (mudou) aplicarFerramenta(x, y, true);
  }
});

function fimPonteiro(e) {
  const [sx, sy] = evPos(e);
  ptrs.delete(e.pointerId);

  if (pinch) {
    if (ptrs.size < 2) {
      pinch = null;
      const resto = [...ptrs.values()][0];
      if (resto) startPan(resto.x, resto.y); else stopPan();
    }
    return;
  }
  if (panning) {
    stopPan();
    const tap = tapCand && performance.now() - tapCand.t < 500 &&
      dist(sx, sy, tapCand.x, tapCand.y) <= 11;
    tapCand = null;
    if (tap) {
      const p = pickAt(sx, sy);
      // tocar num bicho faz ele responder — é a graça de ter voz por espécie
      if (p) {
        if (p.kind === 'animal') SFX.voz(p.ref.sp, { vol: .3, imediato: true });
        else if (p.kind === 'vis' || p.kind === 'staff') SFX.vozHumana(p.ref, { vol: .26, imediato: true });
        select(p.kind, p.ref);
      }
      else deselect();
    }
    return;
  }
  // toque curto com ferramenta: aplica agora, no soltar
  if (pendenteTool) { aplicarFerramenta(pendenteTool.x, pendenteTool.y, false); pendenteTool = null; }
  fecharArrasteRecinto();
  pintando = false;
  undoFecharGrupo();           // a pincelada acabou: vira 1 item de desfazer
}
cv.addEventListener('pointerup', fimPonteiro);
cv.addEventListener('pointercancel', fimPonteiro);

cv.addEventListener('wheel', e => {
  e.preventDefault();
  const [sx, sy] = evPos(e);
  zoomAt(e.deltaY < 0 ? 1.14 : 1 / 1.14, sx, sy);
}, { passive: false });

/* botões de zoom (toque) — ancoram no centro da tela */
$('#zIn').onclick = () => zoomAt(1.3, VW / 2, VH / 2);
$('#zOut').onclick = () => zoomAt(1 / 1.3, VW / 2, VH / 2);
$('#zMap').onclick = () => { G.miniQuer = !G.miniQuer; atualizarMini(); };
$('#stWarn').onclick = () => openFinance();
$('#stHappy').onclick = () => openSatisfacao();
$('#stRep').onclick = () => openReputacao();
$('#zUndo').onclick = () => desfazerUltima();
const NOME_BOLHA = ['desligados|off', 'só quem está insatisfeito|only the unhappy ones', 'todos|all'];
function ciclarBolhas() {
  G.bolhas = (G.bolhas + 1) % 3;
  $('#zBolha').classList.toggle('on', G.bolhas > 0);
  $('#zBolha').textContent = G.bolhas === 0 ? '💤' : G.bolhas === 1 ? '💭' : '💬';
  toast(BI`💭 Balões de pensamento: ${LN(NOME_BOLHA[G.bolhas])}|💭 Thought bubbles: ${LN(NOME_BOLHA[G.bolhas])}`, '');
}
function atualizarBotaoSom() {
  $('#zSom').textContent = SFX.ligado ? (SFX.vol > .5 ? '🔊' : '🔉') : '🔇';
  $('#zSom').classList.toggle('on', SFX.ligado);
}
function ciclarSom() {
  // 3 estados: cheio -> baixo -> mudo. Preferência é do aparelho, não do save.
  SFX.iniciar();
  if (!SFX.ligado) { SFX.ligado = true; SFX.vol = .65; }
  else if (SFX.vol > .5) SFX.vol = .3;
  else SFX.ligado = false;
  SFX.aplicarVolume(); atualizarBotaoSom();
  try { localStorage.setItem('zoo_som', JSON.stringify({ l: SFX.ligado, v: SFX.vol })); } catch (e) {}
  if (SFX.ligado) SFX.toca('ui');
}
$('#zSom').onclick = ciclarSom;
$('#zBolha').onclick = ciclarBolhas;
$('#zSave').onclick = () => exportarSave();
$('#zLoad').onclick = () => $('#fileSave').click();
$('#fileSave').onchange = ev => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  // vindo do splash não há partida em curso: carrega direto e entra no jogo
  const noSplash = !$('#splash').classList.contains('hidden');
  if (!noSplash && !confirm(BI`Carregar "${f.name}"? O progresso atual será perdido.|Load "${f.name}"? The current progress will be lost.`)) return;
  importarSave(f, ok => {
    if (ok && noSplash) { $('#splash').classList.add('hidden'); setSpeed(1); }
  });
};
/* cancelar a ferramenta ativa sem teclado */
UI.hint.addEventListener('click', e => {
  if (e.target.closest('#hintX')) { setTool(null); G.drag = null; fecharPaleta(); }
});

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key;
  if (k === 'Shift') G.shift = true;
  if (k === ' ') { e.preventDefault(); G.space = true; togglePause(); }
  if (k === 'Escape') { setTool(null); G.drag = null; fecharPaleta(); closeModal(); deselect(); }
  if (k === 'm' || k === 'M') { G.miniQuer = !G.miniQuer; atualizarMini(); }
  if (k === 'b' || k === 'B') ciclarBolhas();
  if ((k === 'z' || k === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); desfazerUltima(); return; }
  if (k === 's' || k === 'S') ciclarSom();
  if (k === 'Delete' || k === 'Backspace') {
    if (G.sel && G.sel.kind === 'obj') { removeObject(G.sel.ref.id); deselect(); }
  }
  if (k >= '1' && k <= '9') { const c = CATS[+k - 1]; if (c) abrirCategoria(c.k); }
  const pan = 60;
  if (k === 'ArrowLeft') cam.x += pan; if (k === 'ArrowRight') cam.x -= pan;
  if (k === 'ArrowUp') cam.y += pan; if (k === 'ArrowDown') cam.y -= pan;
});
addEventListener('keyup', e => { if (e.key === 'Shift') G.shift = false; if (e.key === ' ') G.space = false; });
addEventListener('resize', () => { resize(); ajustarParaTela(); });
addEventListener('orientationchange', () => setTimeout(() => { resize(); ajustarParaTela(); }, 250));

function setSpeed(s) {
  G.speed = s;
  ['sp0', 'sp1', 'sp2', 'sp3'].forEach((id, i) => $('#' + id).classList.toggle('on', [0, 1, 2, 4][i] === s));
}
function togglePause() { setSpeed(G.speed === 0 ? (G.prevSpeed || 1) : (G.prevSpeed = G.speed, 0)); }
$('#sp0').onclick = () => { G.prevSpeed = G.speed || 1; setSpeed(0); };
$('#sp1').onclick = () => setSpeed(1);
$('#sp2').onclick = () => setSpeed(2);
$('#sp3').onclick = () => setSpeed(4);
$('#minicv').onclick = e => {
  const r = e.target.getBoundingClientRect();
  const S = 300 / Math.max(W, H);
  centerOn((e.clientX - r.left) / r.width * 300 / S, (e.clientY - r.top) / r.height * 300 / S);
};

/* ==========================================================================
   14. SIMULAÇÃO
   ========================================================================== */
let spawnAcc = 0;

function taxaVisitantes() {
  if (!pathConnected(ENTRANCE.x, ENTRANCE.y - 1) && !pathConnected(ENTRANCE.x, ENTRANCE.y)) return 0;
  if (G.hour < OPEN_H || G.hour >= CLOSE_H) return 0;
  const atracoes = [...enclosures.values()].reduce((s, e) =>
    s + (encViewSpots(e).length ? e.animals.filter(a => !a.morto).length : 0), 0);
  if (!atracoes) return 0;
  const justo = precoJusto();
  // Queda assintótica, nunca zero: com a subtração linear anterior um ingresso
  // ~2x o preço justo travava a bilheteria em 0 visitantes — estado absorvente,
  // e o jogador não tinha como perceber a causa dentro do jogo.
  const excesso = Math.max(0, G.ticket - justo);
  const precoF = excesso > 0
    ? justo / (justo + excesso * 1.7)
    : clamp(1 + (justo - G.ticket) / Math.max(1, justo) * .45, 1, 1.5);
  const t = (G.hour - OPEN_H) / (CLOSE_H - OPEN_H);
  const horaF = Math.sin(t * Math.PI) ** .7;
  const mk = [1, 1.35, 1.8, 2.5][G.pesquisa.marketing]; // 0 = sem campanha, e não "sem público"
  const base = (1 + Math.pow(G.rep, 1.6)) * Math.min(1 + atracoes * .09, 3.2);
  return base * precoF * horaF * mk; // visitantes por hora de jogo
}

function tick(dt) {
  const gh = dt * (24 / DAY_SEC);
  const hAnt = G.hour;
  G.hour += gh;
  if (G.hour >= 24) { G.hour -= 24; fecharDia(); }

  // spawn de visitantes (teto menor no celular: cada visitante é um sprite
  // desenhado e um BFS ocasional na malha de trilhas)
  const teto = G.maxVis;
  if (G.visitors.length < teto) {
    spawnAcc += taxaVisitantes() * gh;
    while (spawnAcc >= 1 && G.visitors.length < teto) { spawnAcc -= 1; novoVisitante(); }
  } else spawnAcc = 0;

  // recintos
  for (const e of enclosures.values()) {
    const n = e.animals.filter(a => !a.morto).length;
    if (n) {
      e.limpeza = clamp(e.limpeza - gh * .0075 * n / Math.max(3, encArea(e) * .3), 0, 1);
      if (!encHasFeeder(e)) e.comida = 0;
      if (!encHasWater(e)) e.water = 0;
      const F = FENCES[e.fence];
      const press = e.animals.reduce((s, a) => s + Math.max(0, a.sp.danger - F.strength), 0);
      if (press > 0) e.integridade = clamp(e.integridade - gh * .002 * press, 0, 1);
      else e.integridade = clamp(e.integridade + gh * .004, 0, 1);
    }
  }
  let nv = 0; for (const s of G.staff) if (s.kind === 'vet') nv++;
  G.nVets = nv;
  for (const a of G.animals) updAnimal(a, dt, gh);
  // carcaça some 3s depois da morte (dá tempo de ver a notificação)
  G.animals = G.animals.filter(a => !a.morto || (a._t = (a._t || 0) + dt) < 3);
  for (let i = G.visitors.length - 1; i >= 0; i--) updVisitor(G.visitors[i], dt, gh);
  for (const s of G.staff) updStaff(s, dt, gh);

  // juros
  if (G.emprestimo > 0) {
    const j = G.emprestimo * .004 * gh / 24;
    G.emprestimo += j; G.money -= j; lgr('manut', j);
  }
}
function fecharDia() {
  SFX.toca('dia');
  const visitantesDoDia = G.stats.visHoje;   // lido antes do reset abaixo
  G.day++;
  G.ledger.hist.push({ dia: G.day - 1, vis: G.stats.visHoje, saldo: saldo(G.ledger.hoje) });
  if (G.ledger.hist.length > 60) G.ledger.hist.shift();
  for (const k in G.ledger.hoje) G.ledger.hoje[k] = 0;
  G.stats.visHoje = 0; G.stats.entrHoje = 0;
  for (const e of enclosures.values()) e.visitasHoje = 0;

  // contas semanais
  if ((G.day - G.lastBill) >= BILL_EVERY) {
    G.lastBill = G.day;
    let folha = G.staff.reduce((s, x) => s + STAFF_TYPES[x.kind].wage, 0);
    folha += [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].wage : 0), 0);
    const mk = [0, 1500, 5000, 14000][G.pesquisa.marketing];
    spend(folha + mk, 'salario'); SFX.toca('contas');
    toast(BI`🧾 Contas da semana: ${moneyFull(folha + mk)} (folha${mk ? ' + marketing' : ''})|🧾 Weekly bills: ${moneyFull(folha + mk)} (payroll${mk ? ' + marketing' : ''})`, 'money');
  }
  // Se o dia fechou sem visitante, diz o motivo — 1x por dia. Ficar no escuro
  // por dias é indistinguível de um jogo quebrado.
  if (visitantesDoDia === 0 && G.day > 2) {
    const diag = diagnosticoPublico();
    if (diag) toast(diag.em + ' ' + diag.long.replace(/<\/?b>/g, ''), 'bad');
  }
  // avaliações dos visitantes do dia entram como 1 linha agregada no extrato
  const rv = G.stats.repVis || 0;
  if (Math.abs(rv) >= .02) {
    G.repLog.push({ dia: G.day - 1, delta: rv, motivo: BI`Avaliações de ${visitantesDoDia} visitantes|Ratings from ${visitantesDoDia} visitors`, em: rv > 0 ? '🗳️' : '📉' });
    if (G.repLog.length > 60) G.repLog.shift();
  }
  G.stats.repVis = 0;
  // reputação decai devagar rumo à qualidade real do parque
  const alvo = qualidadeParque();
  const antes = G.rep;
  G.rep = clamp(lerp(G.rep, alvo, .12), 0, 5);
  if (Math.abs(G.rep - antes) >= .05) {
    G.repLog.push({
      dia: G.day - 1, delta: G.rep - antes,
      motivo: G.rep > antes ? LN('Qualidade do parque puxando a nota para cima|Park quality pulling the score up') : LN('Qualidade do parque puxando a nota para baixo|Park quality pulling the score down'),
      em: G.rep > antes ? '📈' : '📉',
    });
    if (G.repLog.length > 60) G.repLog.shift();
  }
  salvar(true);

  if (G.money < -120000 && !G.gameOver) {
    G.gameOver = true; setSpeed(0); SFX.toca('falencia');
    openModal(LN('🏚️ Falência|🏚️ Bankruptcy'),
      `<p style="font-size:14px;line-height:1.6">O zoológico quebrou com <b>${moneyFull(G.money)}</b> no vermelho após ${G.day} dias.
       Você recebeu ${G.stats.visTotal.toLocaleString('pt-BR')} visitantes e chegou a ter ${G.animals.filter(a => !a.morto).length} animais.</p>`,
      `<button class="btn g" onclick="localStorage.removeItem('zoo_save');location.reload()">Recomeçar</button>
       <button class="btn" onclick="G.money+=100000;G.gameOver=false;closeModal()">Aceitar resgate de R$ 100.000</button>`);
  }
}
/** choque pontual na reputação + linha no extrato (visível ao clicar em ⭐) */
function repEvento(delta, motivo, em) {
  G.rep = clamp(G.rep + delta, 0, 5);
  G.repLog.push({ dia: G.day, delta, motivo, em });
  if (G.repLog.length > 60) G.repLog.shift();
}
function qualidadeParque() {
  const vivos = G.animals.filter(a => !a.morto);
  if (!vivos.length) return .6;
  const felAn = vivos.reduce((s, a) => s + a.feliz, 0) / vivos.length;
  const variedade = new Set(vivos.map(a => a.sp.id)).size;
  const felVis = G.stats.felicidade;
  const lixoMed = (() => { let s = 0, n = 0; for (let i = 0; i < W * H; i++) if (world.path[i]) { s += world.lixo[i]; n++; } return n ? s / n : 0; })();
  let q = felAn * 1.7 + felVis * 1.9 + Math.min(variedade, 30) / 30 * 1.1 - lixoMed * 1.2;
  q -= G.escaped.length * .25;
  return clamp(q, 0, 5);
}

/* ==========================================================================
   15. SALVAR / CARREGAR
   ========================================================================== */
/** Retrato completo do jogo. Serve ao autosave (localStorage) e à exportação
 *  em arquivo — um só formato para não haver dois "saves" divergindo. */
function snapshotJogo() {
  return {
      v: 1, money: G.money, ticket: G.ticket, day: G.day, hour: G.hour, rep: G.rep,
      repLog: G.repLog,
      lastBill: G.lastBill, emprestimo: G.emprestimo, marketing: G.pesquisa.marketing,
      stats: G.stats, ledger: G.ledger, cam: { x: cam.x, y: cam.y, z: cam.z },
      terr: Array.from(world.terr), path: Array.from(world.path),
      objs: [...objects.values()].map(o => ({ id: o.id, kind: o.kind, cat: o.cat, x: o.x, y: o.y, mult: o.mult, receita: o.receita, vendas: o.vendas, encId: o.encId })),
      encs: [...enclosures.values()].map(e => ({
        id: e.id, fence: e.fence, name: e.name, tiles: [...e.tiles],
        limpeza: e.limpeza, comida: e.comida, water: e.water, integridade: e.integridade,
      })),
      animals: G.animals.filter(a => !a.morto).map(a => ({
        id: a.id, sp: a.sp.id, enc: a.enc, name: a.name, sexo: a.sexo, idade: a.idade,
        fome: a.fome, sede: a.sede, saude: a.saude, feliz: a.feliz, doente: a.doente,
        gravida: a.gravida, fugiu: a.fugiu, x: a.x, y: a.y,
      })),
    staff: G.staff.map(s2 => ({ kind: s2.kind, x: s2.x, y: s2.y, feitos: s2.feitos })),
    uid: _uid,
  };
}
function salvar(silencioso) {
  try {
    localStorage.setItem('zoo_save', JSON.stringify(snapshotJogo()));
    if (!silencioso) toast('💾 Jogo salvo', 'good');
    return true;
  } catch (err) { if (!silencioso) toast(BI`⚠️ Não foi possível salvar: ${err.message}|⚠️ Could not save: ${err.message}`, 'bad'); return false; }
}
function carregar() {
  const raw = localStorage.getItem('zoo_save');
  if (!raw) { toast('Nenhum jogo salvo encontrado', 'bad'); return false; }
  return aplicarSnapshot(raw, 'Jogo carregado');
}
/** Aplica um retrato salvo (do localStorage ou de arquivo importado). */
function aplicarSnapshot(raw, rotulo) {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!s || typeof s.money !== 'number' || !Array.isArray(s.terr))
      throw new Error(LN('não parece um save do Zoo Magnata|that does not look like a Zoo Magnata save'));
    G.money = s.money; G.ticket = s.ticket; G.day = s.day; G.hour = s.hour; G.rep = s.rep;
    G.repLog = Array.isArray(s.repLog) ? s.repLog : [];
    G.undo = []; undoGrupo = null; atualizarUndoBtn();   // ids de outro mundo não valem aqui
    G.lastBill = s.lastBill || 1; G.emprestimo = s.emprestimo || 0;
    G.pesquisa.marketing = s.marketing || 0;
    G.stats = s.stats; G.ledger = s.ledger;
    cam.x = s.cam.x; cam.y = s.cam.y; cam.z = s.cam.z;
    world.terr.set(s.terr); world.path.set(s.path);
    // conserta save antigo em que o tapete do portão foi demolido (travava o zoo)
    if (!world.path[IDX(ENTRANCE.x, ENTRANCE.y)]) {
      world.path[IDX(ENTRANCE.x, ENTRANCE.y)] = 1;
      world.terr[IDX(ENTRANCE.x, ENTRANCE.y)] = TKEYS.indexOf('piso');
      toast(LN('🚪 Recoloquei a trilha do portão — sem ela ninguém conseguia entrar.|🚪 Put the gate path back — without it nobody could get in.'), 'good');
    }
    world.occ.fill(0); world.enc.fill(0); world.bel.fill(0); world.lixo.fill(0);
    objects.clear(); enclosures.clear();
    G.animals = []; G.visitors = []; G.staff = []; G.escaped = [];
    _uid = s.uid || 1;
    for (const e of s.encs) {
      // Save antigo guardava retângulo (x,y,w,h) com o anel externo virando
      // cerca. O interior daquele retângulo vira o conjunto de tiles de agora.
      let tiles = e.tiles;
      if (!Array.isArray(tiles)) {
        tiles = [];
        for (let j = 1; j < e.h - 1; j++) for (let i = 1; i < e.w - 1; i++)
          tiles.push(IDX(e.x + i, e.y + j));
      }
      const en = {
        id: e.id, fence: e.fence, name: e.name, tiles: new Set(),
        animals: [], objs: [], happy: .7, alertas: [],
        limpeza: e.limpeza, comida: e.comida, water: e.water,
        integridade: e.integridade === undefined ? 1 : e.integridade,
      };
      enclosures.set(e.id, en);
      for (const k of tiles) { en.tiles.add(k); world.enc[k] = e.id; }
      encInvalida(en);
    }
    for (const o of s.objs) {
      const def = o.cat === 'build' ? BUILDINGS[o.kind] : o.cat === 'deco' ? DECOS[o.kind] : ENCOBJ[o.kind];
      const ob = { ...o, w: def.w || 1, h: def.h || 1, fila: [], estoque: 1, sujo: 0, hp: 1, receita: o.receita || 0, vendas: o.vendas || 0 };
      for (let j = 0; j < ob.h; j++) for (let i = 0; i < ob.w; i++) world.occ[IDX(ob.x + i, ob.y + j)] = ob.id;
      objects.set(ob.id, ob);
      if (ob.cat === 'deco') applyBeauty(ob, +1);
      if (ob.cat === 'encobj') { const e = enclosures.get(ob.encId); if (e) e.objs.push(ob); }
    }
    for (const a of s.animals) {
      const an = {
        ...a, sp: SPECIES[a.sp], morto: false, tx: a.x, ty: a.y, dir: 1,
        frame: 0, anim: 0, estado: 'parado', espera: rnd(1, 4),
      };
      G.animals.push(an);
      const e = enclosures.get(a.enc);
      if (e && !a.fugiu) e.animals.push(an);
      if (a.fugiu) G.escaped.push(an);
    }
    for (const st of s.staff) { const x = contratar(st.kind); x.x = st.x; x.y = st.y; x.feitos = st.feitos || 0; }
    terrenoMudou(); rebuildNet();   // rebuildNet já incrementa netVer
    deselect(); closeModal();
    toast('📂 ' + (rotulo || 'Jogo carregado') + ' — dia ' + G.day, 'good');
    return true;
  } catch (err) { toast(BI`⚠️ Save inválido: ${err.message}|⚠️ Invalid save: ${err.message}`, 'bad'); return false; }
}

/* ==========================================================================
   15b. EXPORTAR / IMPORTAR ARQUIVO
   ========================================================================== */
function baixarArquivo(name, conteudo, mime) {
  try {
    const blob = new Blob([conteudo], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (err) { toast('⚠️ Download falhou: ' + err.message, 'bad'); return false; }
}
const selo = () => 'dia' + String(G.day).padStart(3, '0') + '-' + relTime(G.hour).replace(':', 'h');

function exportarSave() {
  if (baixarArquivo(`zoo-magnata-${selo()}.json`, JSON.stringify(snapshotJogo()), 'application/json'))
    toast(LN('📥 Save baixado — guarde o arquivo para retomar depois|📥 Save downloaded — keep the file to pick up later'), 'good');
}
function exportarRelatorio() {
  if (baixarArquivo(`zoo-magnata-status-${selo()}.txt`, relatorioTexto(), 'text/plain'))
    toast(LN('📄 Relatório de status baixado|📄 Status report downloaded'), 'good');
}
function importarSave(file, aoConcluir) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let ok = false;
    if (/^\s*[{[]/.test(fr.result)) ok = aplicarSnapshot(fr.result, 'Save importado');
    else toast(LN('⚠️ Esse arquivo não é um save (.json) do jogo|⚠️ That file is not a game save (.json)'), 'bad');
    if (aoConcluir) aoConcluir(ok);
  };
  fr.onerror = () => { toast(LN('⚠️ Não consegui ler o arquivo|⚠️ Could not read the file'), 'bad'); if (aoConcluir) aoConcluir(false); };
  fr.readAsText(file);
}

/** Relatório legível do estado do zoológico — o "status do jogo" em texto. */
function relatorioTexto() {
  const L = [];
  const linha = c => L.push(c);
  const reg = (rot, val) => linha('  ' + rot.padEnd(30, '.') + ' ' + val);
  const barrinha = v => '█'.repeat(Math.round(clamp(v, 0, 1) * 10)).padEnd(10, '░');
  const vivos = G.animals.filter(a => !a.morto);
  const moodV = G.visitors.length ? G.visitors.reduce((s, v) => s + v.mood, 0) / G.visitors.length : G.stats.felicidade;
  const moodA = vivos.length ? vivos.reduce((s, a) => s + a.feliz, 0) / vivos.length : 0;

  linha('ZOO MAGNATA — STATUS');
  linha('='.repeat(64));
  linha(`Dia ${G.day}, ${relTime(G.hour)}${G.hour >= OPEN_H && G.hour < CLOSE_H ? ' (aberto)' : ' (fechado)'}`);
  linha('');
  linha('VISÃO GERAL');
  reg('Caixa', moneyFull(G.money));
  reg('Empréstimo em aberto', moneyFull(G.emprestimo));
  reg('Reputação', G.rep.toFixed(2) + ' / 5.00  ' + barrinha(G.rep / 5));
  reg('Preço do ingresso', moneyFull(G.ticket) + '  (referência: ' + moneyFull(precoJusto()) + ')');
  reg('Marketing', ['nenhum', 'local', 'regional', 'nacional'][G.pesquisa.marketing]);
  reg('Visitantes agora', G.visitors.length);
  reg('Visitantes hoje', G.stats.visHoje);
  reg('Visitantes desde a abertura', G.stats.visTotal);
  reg('Satisfação dos visitantes', Math.round(moodV * 100) + '%  ' + barrinha(moodV));
  reg('Felicidade dos animais', Math.round(moodA * 100) + '%  ' + barrinha(moodA));
  reg('Animais vivos', vivos.length + ' de ' + new Set(vivos.map(a => a.sp.id)).size + ' espécies');
  reg('Recintos', enclosures.size);

  const trava = diagnosticoPublico();
  if (trava) {
    linha('');
    linha('!! O QUE ESTÁ TRAVANDO A BILHETERIA');
    linha('   ' + trava.em + ' ' + trava.long.replace(/<\/?b>/g, ''));
  }

  linha('');
  linha('FINANÇAS — HOJE');
  const h = G.ledger.hoje;
  reg('Ingressos', '+' + moneyFull(h.ingresso));
  reg('Lojas e restaurantes', '+' + moneyFull(h.loja));
  reg('Venda de animais', '+' + moneyFull(h.venda));
  reg('Ração e insumos', '-' + moneyFull(h.feed));
  reg('Salários', '-' + moneyFull(h.wage));
  reg('Manutenção e veterinário', '-' + moneyFull(h.manut));
  reg('Compra de animais', '-' + moneyFull(h.compra));
  reg('Obras', '-' + moneyFull(h.obra));
  reg('SALDO DO DIA', moneyFull(saldo(h)));
  if (G.ledger.hist.length) {
    linha('');
    linha('ÚLTIMOS DIAS');
    for (const d of G.ledger.hist.slice(-10))
      linha(`  dia ${String(d.dia).padStart(3)} · ${String(d.vis).padStart(5)} visitantes · saldo ${moneyFull(d.saldo)}`);
  }

  linha('');
  linha('RECINTOS');
  if (!enclosures.size) linha('  (nenhum)');
  for (const e of enclosures.values()) {
    const av = e.animals.filter(a => !a.morto);
    const fel = av.length ? av.reduce((s, a) => s + a.feliz, 0) / av.length : 0;
    const sp0 = av[0] ? av[0].sp : null;
    linha('');
    linha(`  ${e.name} — ${FENCES[e.fence].n}, ${encArea(e)} tiles, cerca de ${encSegCount(e)} trechos`);
    linha(`    felicidade ${barrinha(fel)} ${Math.round(fel * 100)}%   ` +
      `limpeza ${barrinha(e.limpeza)} ${Math.round(e.limpeza * 100)}%`);
    linha(`    comida    ${barrinha(e.comida)} ${Math.round(e.comida * 100)}%   ` +
      `água    ${barrinha(e.water)} ${Math.round(e.water * 100)}%`);
    const enr = encEnrich(e);
    linha(`    enriquecimento ${barrinha(enr)} ${Math.round(enr * 100)}%   ` +
      `pontos de observação: ${encViewSpots(e).length}`);
    const mix = Object.entries(encMix(e)).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${TERRAIN[k].n} ${Math.round(v * 100)}%`).join(', ');
    linha('    terreno: ' + mix);
    if (sp0) linha('    ideal:   ' + Object.entries(sp0.mix)
      .map(([k, v]) => `${TERRAIN[k].n} ${Math.round(v * 100)}%`).join(', ') + `  (biome ${sp0.biomeName})`);
    linha('    objetos: ' + (e.objs.length ? e.objs.map(o => ENCOBJ[o.kind].n).join(', ') : 'nenhum'));
    for (const a of av)
      linha(`      - ${a.name} (${a.sexo}) ${LN(a.sp.name)}, ${a.idade.toFixed(1)}/${a.sp.lifespan} anos · ` +
        `felicidade ${Math.round(a.feliz * 100)}% · saúde ${Math.round(a.saude * 100)}%` +
        `${a.doente ? ' · DOENTE' : ''}${a.gravida > 0 ? ' · gestante' : ''}` +
        (a.pensa ? ` · pensando: ${a.pensa.txt}` : ''));
    const al = encAlertasHTML(e).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (al) linha('    alertas: ' + al);
  }

  linha('');
  linha('COMÉRCIO E SERVIÇOS');
  const builds = [...objects.values()].filter(o => o.cat === 'build');
  if (!builds.length) linha('  (nenhum)');
  for (const o of builds) {
    const B = BUILDINGS[o.kind];
    linha(`  ${B.n} em (${o.x},${o.y}) · ${objAcessivel(o) ? 'acessível' : 'SEM TRILHA POR PERTO'}` +
      (B.value > 0 ? ` · preço ${moneyFull(precoDe(o))} · ${o.vendas} vendas · lucro ${moneyFull(o.receita)}` : ''));
  }

  linha('');
  linha('EQUIPE');
  let folha = 0;
  for (const k in STAFF_TYPES) {
    const n = G.staff.filter(s => s.kind === k).length;
    if (!n) continue;
    folha += n * STAFF_TYPES[k].wage;
    linha(`  ${n}x ${STAFF_TYPES[k].n} · ${moneyFull(STAFF_TYPES[k].wage)}/semana cada · ` +
      `${G.staff.filter(s => s.kind === k).reduce((s, x) => s + x.feitos, 0)} tarefas feitas`);
  }
  if (!G.staff.length) linha('  (ninguém contratado)');
  folha += builds.reduce((s, o) => s + BUILDINGS[o.kind].wage, 0);
  reg('Folha semanal total', moneyFull(folha));

  const rv = agruparPensamentos(G.visitors, pensamentoVisitante), ra = agruparPensamentos(vivos, pensamentoAnimal);
  const secao = (tit, rank, tot) => {
    linha(''); linha(tit);
    if (!rank.length) { linha('  (ninguém)'); return; }
    for (const r of rank) {
      linha(`  ${r.em} ${r.txt} — ${r.n} (${Math.round(r.n / Math.max(1, tot) * 100)}%)`);
      if (DICAS[r.em] && r.urg >= .45) linha('      -> ' + DICAS[r.em]);
    }
  };
  secao('POR QUE OS VISITANTES ESTÃO ASSIM', rv, G.visitors.length);
  secao('POR QUE OS ANIMAIS ESTÃO ASSIM', ra, vivos.length);

  linha('');
  linha('='.repeat(64));
  linha('Gerado pelo próprio jogo. Para retomar a partida use o save .json.');
  return L.join('\n');
}

/* ==========================================================================
   16. BOOT
   ========================================================================== */
function trilhaInicial() {
  for (let y = H - 1; y >= H - 12; y--) addPath(ENTRANCE.x, y);
  for (let x = ENTRANCE.x - 6; x <= ENTRANCE.x + 6; x++) addPath(x, H - 12);
  for (let x = ENTRANCE.x - 6; x <= ENTRANCE.x + 6; x++) addPath(x, H - 6);
  for (const dx of [-6, 6]) for (let y = H - 12; y <= H - 6; y++) addPath(ENTRANCE.x + dx, y);
  G.ledger.hoje.obra = 0; G.ledger.semana.obra = 0;
}
/** ajusta o que depende do tamanho da tela (boot e a cada rotação/resize) */
function ajustarParaTela() {
  const estreita = window.innerWidth <= 700;
  G.maxVis = estreita ? 110 : window.innerWidth <= 1100 ? 190 : 280;
  // minimapa e botões de zoom: numa tela estreita o mapa sobrepõe o dock, então
  // fica atrás do botão 🗺️; o zoom por botão só aparece onde não há roda
  $('#zoomBtns').classList.toggle('show', IS_TOUCH);
  atualizarMini();
  medirHud();
}
function init() {
  resize();
  genTerrain();
  trilhaInicial();
  rebuildNet();
  cam.z = window.innerWidth <= 700 ? .62 : .85;
  centerOn(ENTRANCE.x, ENTRANCE.y - 14);
  buildDock();
  contratar('trat'); contratar('fax');
  updateHUD();
  G.miniQuer = !isSmall();      // no celular o minimapa começa desligado
  try {
    const pref = JSON.parse(localStorage.getItem('zoo_som') || 'null');
    if (pref) { SFX.ligado = !!pref.l; SFX.vol = +pref.v || .65; }
  } catch (e) {}
  atualizarBotaoSom();
  ajustarParaTela();
  // o HUD muda de altura quando as etiquetas quebram de linha
  if (window.ResizeObserver) new ResizeObserver(medirHud).observe($('#hud'));
  setSpeed(0);          // o relógio só começa quando o jogador sai do splash
  loop(performance.now());
}
let lastT = 0, acc = 0, hudAcc = 0, miniAcc = 0, somAcc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > .25) dt = .25;
  // Trilha desenhada / recinto criado invalidam a malha de caminhos. Consumir a
  // flag aqui (1x por frame) cobre um arraste inteiro com uma única BFS — e sem
  // isso `netVer` nunca mudava, congelando o cache de "quem vê este recinto"
  // vazio para sempre: nenhum recinto virava atração e ninguém visitava o zoo.
  if (G.dirty.net) rebuildNet();
  if (!G.gameOver && G.speed > 0) {
    // passos fixos para a simulação continuar estável em 2x/4x
    acc += dt * G.speed;
    let guard = 0;
    while (acc > 1 / 30 && guard++ < 12) { tick(1 / 30); acc -= 1 / 30; }
  }
  render(now);
  hudAcc += dt;
  if (hudAcc > .2) {
    hudAcc = 0;
    // precoJusto() varre recintos e prédios; os pensamentos consultam por
    // visitante, então guarda o valor em vez de recalcular centenas de vezes
    G.justoCache = precoJusto();
    updateHUD();
    refreshInspector();
  }
  somAcc += dt;
  if (somAcc > .5) {
    somAcc = 0;
    // Vozes de bicho ao fundo, abafadas e esparsas. Sem murmúrio de multidão:
    // o parque fica em silêncio e o que se ouve são os próprios animais.
    if (G.speed > 0 && SFX.ligado) {
      const vivos = G.animals.filter(a => !a.morto);
      const chance = clamp(.02 + vivos.length * .006, 0, .13);
      if (vivos.length && Math.random() < chance)
        SFX.voz(pick(vivos).sp, { vol: .13, distante: true });
    }
  }
  miniAcc += dt;
  if (miniAcc > .5 && $('#mini').classList.contains('show')) { miniAcc = 0; renderMini(); }
}

init();

/* O splash decide entre jogo novo e save — sem confirm() bloqueante, e com o
   relógio parado enquanto ele está na tela. */
let temSave = false;
try { temSave = !!localStorage.getItem('zoo_save'); } catch (e) { temSave = false; }
const comecar = carregarSave => {
  SFX.iniciar();       // 1º gesto do usuário: só aqui o áudio pode nascer
  $('#splash').classList.add('hidden');
  if (carregarSave) carregar();
  setSpeed(1);
};
$('#btnStart').onclick = () => comecar(false);
$('#btnUpload').onclick = () => $('#fileSave').click();
if (temSave) {
  $('#btnStart').innerHTML = LN('Começar do zero 🎟️|Start from scratch 🎟️');
  const b = el('button', 'btn b big', LN('Continuar jogo salvo 📂|Continue saved game 📂'));
  b.onclick = () => comecar(true);
  $('#btnStart').after(b);
}
/* ==========================================================================
   THE TWO FLAGS

   The script tag sits at the end of <body>, so the DOM is already there — no
   DOMContentLoaded needed. `bindText` swaps the inline copy of the splash and
   the HUD; anything this game builds in JavaScript reads LN()/TX() when it
   draws, and the panels redraw on the language change below.
   ========================================================================== */
Slop.mountLangPicker(I18N, { width: 26 });
Slop.bindText(I18N);

const applyPageTitle = () => { document.title = TX('page.title'); };
SAY({
  'page.title': { pt: 'Zoo Magnata — Tycoon de Zoológico', en: 'Zoo Tycoon — Build Your Zoo' },
});
applyPageTitle();
I18N.onChange(() => {
  applyPageTitle();
  // the palette, the inspector and the open modal are all built as HTML
  // strings, so a language change has to rebuild whatever is on screen
  buildDock();
  if (G.tool && G.tool.cat) montarPaleta(G.tool.cat);
  showInspector();
  renderAlertas();
});

// the test bridge — the kit looks for this name
window.__game = { name: 'zoo-magnata', i18n: I18N, G };
