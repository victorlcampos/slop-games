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

/** the rectangle's tiles that are free to become an enclosure */
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
/** ids of enclosures the rectangle overlaps or touches orthogonally */
function touchedEnclosures(r) {
  const ids = new Set();
  for (let j = -1; j <= r.h; j++) for (let i = -1; i <= r.w; i++) {
    const outX = i < 0 || i >= r.w, outY = j < 0 || j >= r.h;
    if (outX && outY) continue;              // cantos diagonais não contam
    const x = r.x + i, y = r.y + j;
    if (!inB(x, y)) continue;
    const id = world.enc[IDX(x, y)];
    if (id) ids.add(id);
  }
  return [...ids];
}
/** what this drag would do: {action, cost, tiles, target, reason} */
function planoDoArraste(r, fenceKey) {
  const livres = tilesLivresDoRect(r);
  const tocados = touchedEnclosures(r);
  if (tocados.length > 1)
    return { action: 'swims', reason: LN('Esse retângulo encosta em 2 recintos — amplie um de cada vez.|That rectangle touches 2 enclosures — extend one at a time.') };
  if (!livres.length)
    return { action: 'swims', reason: LN('Nenhum tile livre aqui (já tem trilha, prédio ou recinto).|No free tile here (there is already a path, a building or an enclosure).') };
  if (tocados.length === 1) {
    const e = enclosures.get(tocados[0]);
    const uniao = new Set(e.tiles);
    for (const k of livres) uniao.add(k);
    // you only pay for the fence's growth; filling a nook can even shorten it
    const delta = Math.max(0, countSegments(uniao) - encSegCount(e));
    return {
      action: 'ampliar', target: e, tiles: livres,
      cost: delta * FENCES[e.fence].cost + livres.length * 18,
    };
  }
  if (livres.length < MIN_TILES_RECINTO)
    return { action: 'swims', reason: BI`Recinto muito pequeno: precisa de ${MIN_TILES_RECINTO} tiles livres.|Enclosure too small: it needs ${MIN_TILES_RECINTO} free tiles.` };
  const set = new Set(livres);
  return { action: 'criar', tiles: livres, cost: countSegments(set) * FENCES[fenceKey].cost };
}
const fenceCostOf = e => encSegCount(e) * FENCES[e.fence].cost;

function canPlace(t, x, y) {
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
    if (t.key === 'del') { if (removePath(x, y)) { earn(6, 'sell'); SFX.play('demolir'); } return; }
    if (G.money < t.cost) return semGrana();
    if (addPath(x, y)) {
      spend(t.cost, 'build'); SFX.play('trilha');
      // one whole stroke = 1 undo (the group closes when the finger lifts)
      if (!undoGroup || undoGroup.kind !== 'trilha') undoGroup = { kind: 'trilha', cat: 'build', tiles: [], cost: 0 };
      undoGroup.tiles.push([x, y]); undoGroup.cost += t.cost;
    }
  } else if (t.cat === 'terreno') {
    const target = TKEYS.indexOf(t.key);
    const raio = G.shift ? 1 : 0;
    for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) continue;
      const nk = IDX(nx, ny);
      if (world.occ[nk] || world.path[nk]) continue;
      if (world.terr[nk] === target) continue;
      if (G.money < t.cost) return semGrana();
      const before = world.terr[nk];
      world.terr[nk] = target; spend(t.cost, 'build'); terrainChanged(); SFX.play('terreno');
      if (!undoGroup || undoGroup.kind !== 'terreno') undoGroup = { kind: 'terreno', cat: 'build', changes: [], cost: 0 };
      undoGroup.changes.push([nk, before, target]); undoGroup.cost += t.cost;
    }
  } else if (t.cat === 'build') {
    if (arrastando) return;
    if (!rectFree(x, y, t.w, t.h)) { toast(LN('🚫 Espaço ocupado|🚫 Space taken'), 'bad'); return; }
    if (G.money < t.cost) return semGrana();
    spend(t.cost, 'build'); const ob = placeObject(t.key, 'build', x, y); SFX.play('predio');
    undoRecord({ kind: 'objeto', cat: 'build', id: ob.id, cost: t.cost, label: t.n });
    if (!nearestPathTile(x, y, 4)) toast(LN('⚠️ Sem trilha por perto — visitantes não vão conseguir chegar|⚠️ No path nearby — visitors will not be able to reach it'), 'bad');
  } else if (t.cat === 'deco') {
    if (!tileFree(x, y)) return;
    if (G.money < t.cost) return semGrana();
    spend(t.cost, 'build'); const od = placeObject(t.key, 'deco', x, y); SFX.play('predio');
    undoRecord({ kind: 'objeto', cat: 'build', id: od.id, cost: t.cost, label: t.n });
  } else if (t.cat === 'encobj') {
    if (arrastando) return;
    const e = enclosures.get(world.enc[k]);
    if (!e) { toast(LN('🚫 Objetos de recinto só vão dentro de um recinto|🚫 Enclosure objects only go inside an enclosure'), 'bad'); return; }
    if (world.occ[k]) { toast('🚫 Tile ocupado', 'bad'); return; }
    if (G.money < t.cost) return semGrana();
    spend(t.cost, 'build'); const oe = placeObject(t.key, 'encobj', x, y); SFX.play('predio');
    undoRecord({ kind: 'objeto', cat: 'build', id: oe.id, cost: t.cost, label: t.n });
  } else if (t.cat === 'animal') {
    if (arrastando) return;
    const e = enclosures.get(world.enc[k]);
    if (!e) { toast(LN('🚫 Clique dentro de um recinto|🚫 Click inside an enclosure'), 'bad'); return; }
    if (comprarPara(t.sp, e)) { select('enc', e); }
  } else if (t.cat === 'demolir') {
    demolishAt(x, y);
  }
}
function semGrana() { SFX.play('erro'); toast('💸 Caixa insuficiente', 'bad'); }
function demolishAt(x, y) {
  const k = IDX(x, y);
  if (world.occ[k]) {
    const o = objects.get(world.occ[k]);
    if (o) {
      const def = BUILDINGS[o.kind] || DECOS[o.kind] || ENCOBJ[o.kind];
      earn(Math.round((def.cost || 0) * .5), 'sell'); removeObject(o.id); SFX.play('demolir');
    }
    return;
  }
  if (world.path[k]) {
    if (x === ENTRANCE.x && y === ENTRANCE.y) {
      toast(LN('🚪 A trilha do portão não pode ser removida — é por ali que os visitantes entram.|🚪 The gate path cannot be removed — that is where the visitors come in.'), 'bad');
      return;
    }
    removePath(x, y); earn(6, 'sell'); return;
  }
  if (world.enc[k]) {
    const e = enclosures.get(world.enc[k]);
    if (!e) return;
    if (e.animals.length) { toast(LN('🚫 Tire os animais antes de demolir o recinto|🚫 Take the animals out before demolishing the enclosure'), 'bad'); return; }
    const dev = Math.round(fenceCostOf(e) * .5);
    deleteEnclosure(e.id); earn(dev, 'sell'); SFX.play('demolir');
    toast('🔨 Recinto demolido (+' + moneyFull(dev) + ')', 'money');
  }
}

/* ---- selection ---- */
function pickAt(sx, sy) {
  let best = null, bd = 34 * 34;
  const chk = (ent, kind) => {
    const px = w2sx(ent.x, ent.y), py = w2sy(ent.x, ent.y) - 14 * cam.z;
    const d = dist2(px, py, sx, sy);
    if (d < bd) { bd = d; best = { kind, ref: ent }; }
  };
  for (const a of G.animals) if (!a.dead) chk(a, 'animal');
  for (const s of G.staff) chk(s, 'staff');
  // visitors last: with 200 on screen they must not steal the tap from an animal
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
/** zooms while keeping the screen point (sx,sy) anchored to the same tile */
function zoomAt(fator, sx, sy) {
  const [wx, wy] = s2w(sx, sy);
  cam.z = clamp(cam.z * fator, ZMIN, ZMAX);
  cam.x += sx - w2sx(wx, wy);
  cam.y += sy - w2sy(wx, wy);
}
/** finishes the enclosure rectangle (shared by mouse and touch) */
function endEnclosureDrag() {
  if (!(G.drag && G.tool && G.tool.cat === 'recinto')) return;
  const r = dragRect();
  G.drag = null;
  if (r.w < 1 || r.h < 1) return;
  const p = planoDoArraste(r, G.tool.key);
  if (p.action === 'swims') { toast('🚫 ' + p.reason, 'bad'); return; }
  if (G.money < p.cost) return semGrana();
  spend(p.cost, 'build');
  if (p.action === 'ampliar') {
    encAddTiles(p.target, p.tiles); SFX.play('ampliar');
    undoRecord({ kind: 'ampliacao', cat: 'build', id: p.target.id, tiles: [...p.tiles], cost: p.cost });
    select('enc', p.target);
    toast(BI`➕ ${p.target.name} ampliado para ${encArea(p.target)} tiles|➕ ${p.target.name} extended to ${encArea(p.target)} tiles`, 'good');
  } else {
    const e2 = makeEnclosure(p.tiles, G.tool.key); SFX.play('construir');
    undoRecord({ kind: 'recinto', cat: 'build', id: e2.id, cost: p.cost });
    select('enc', e2);
    toast(BI`🚧 ${e2.name} construído (${encArea(e2)} tiles) — arraste ao lado para ampliar|🚧 ${e2.name} built (${encArea(e2)} tiles) — drag alongside it to extend`, 'good');
  }
}

/* ==========================================================================
   DESFAZER — as últimas 5 compras (botão ↩️ no HUD ou Ctrl+Z)
   ========================================================================== */
const UNDO_MAX = 5;
let undoGroup = null;          // pincelada de trilha/terreno em andamento
function undoRecord(ent) {
  G.undo.push(ent);
  if (G.undo.length > UNDO_MAX) G.undo.shift();
  refreshUndoButton();
}
/** closes the current stroke (called when the pointer lifts) */
function undoCloseGroup() {
  if (!undoGroup) return;
  const g = undoGroup; undoGroup = null;
  if ((g.tiles && g.tiles.length) || (g.changes && g.changes.length)) undoRecord(g);
}
function refreshUndoButton() {
  const b = $('#zUndo'); if (!b) return;
  b.disabled = !G.undo.length;
  b.title = G.undo.length ? BI`Desfazer última compra — ${G.undo.length} disponíve${G.undo.length > 1 ? 'is' : 'l'} (Ctrl+Z)|Undo the last purchase — ${G.undo.length} available (Ctrl+Z)`
    : LN('Nada para desfazer (Ctrl+Z)|Nothing to undo (Ctrl+Z)');
}
function undoLast() {
  undoCloseGroup();
  const ent = G.undo.pop();
  refreshUndoButton();
  if (!ent) { SFX.play('ui'); toast(LN('↩️ Nada para desfazer|↩️ Nothing to undo'), ''); return; }
  const refund = v => { v = Math.round(v); G.money += v; lgr(ent.cat || 'build', -v); return v; };
  let msg = '', value = 0;
  switch (ent.kind) {
    case 'trilha': {
      let n = 0;
      for (const [x, y] of ent.tiles) if (removePath(x, y)) n++;
      if (n) { value = refund(ent.cost * n / ent.tiles.length); msg = `Trilha (${n} tile${n > 1 ? 's' : ''})`; }
      else msg = '!' + LN('a trilha já não existe mais|the path is gone already');
      break;
    }
    case 'terreno': {
      let n = 0;
      for (const [k, before, after] of ent.changes)
        if (world.terr[k] === after && !world.path[k] && !world.occ[k]) { world.terr[k] = before; n++; }
      if (n) { terrainChanged(); value = refund(ent.cost * n / ent.changes.length); msg = BI`Pintura de terreno (${n} tile${n > 1 ? 's' : ''})|Terrain painting (${n} tile${n > 1 ? 's' : ''})`; }
      else msg = '!' + LN('o terreno já mudou de novo|the terrain has changed again');
      break;
    }
    case 'objeto': {
      const o = objects.get(ent.id);
      if (o) {
        if (G.sel && G.sel.ref === o) deselect();
        removeObject(ent.id); value = refund(ent.cost); msg = ent.label;
      } else msg = '!' + ent.label + ' já foi removido';
      break;
    }
    case 'animal': {
      const a = G.animals.find(z => z.id === ent.id);
      if (a && !a.dead) {
        if (G.sel && G.sel.ref === a) deselect();
        G.animals = G.animals.filter(z => z.id !== ent.id);
        G.escaped = G.escaped.filter(z => z.id !== ent.id);
        const e = enclosures.get(a.enc);
        if (e) e.animals = e.animals.filter(z => z.id !== ent.id);
        value = refund(ent.cost); msg = BI`${LN(ent.label)} devolvido à loja|${LN(ent.label)} returned to the shop`;
      } else msg = '!' + LN('o animal já não está no plantel|the animal is no longer in the collection');
      break;
    }
    case 'recinto': {
      const e = enclosures.get(ent.id);
      if (!e) { msg = '!' + LN('o recinto já foi demolido|the enclosure has been demolished'); break; }
      if (e.animals.some(a => !a.dead)) { msg = '!' + LN('o recinto tem animais — venda ou transfira antes|the enclosure has animals — sell or transfer them first'); break; }
      if (e.objs.length) { msg = '!o recinto tem objetos dentro — remova antes'; break; }
      if (G.sel && G.sel.ref === e) deselect();
      deleteEnclosure(ent.id); value = refund(ent.cost); msg = 'Recinto';
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
        if (a.dead) continue;
        if (!e.tiles.has(IDX(clamp(a.x | 0, 0, W - 1), clamp(a.y | 0, 0, H - 1)))) {
          const tl = encTileAleatorio(e);
          if (tl) { a.x = tl[0] + .5; a.y = tl[1] + .5; a.tx = a.x; a.ty = a.y; }
        }
      }
      value = refund(ent.cost * set.size / ent.tiles.length);
      msg = BI`Ampliação (${set.size} tile${set.size > 1 ? 's' : ''})|Extension (${set.size} tile${set.size > 1 ? 's' : ''})`;
      break;
    }
    case 'cerca': {
      const e = enclosures.get(ent.id);
      if (!e) { msg = '!' + LN('o recinto já foi demolido|the enclosure has been demolished'); break; }
      if (e.fence !== ent.after) { msg = '!' + LN('a cerca já foi trocada de novo|the fence has been swapped again'); break; }
      e.fence = ent.before; value = refund(ent.cost); msg = BI`Cerca de volta para ${LN(FENCES[ent.before].n)}|Fence back to ${LN(FENCES[ent.before].n)}`;
      break;
    }
  }
  if (msg[0] !== '!') {
    SFX.play('demolir');
    toast(`↩️ Desfeito: ${msg} — reembolso ${moneyFull(value)}`, 'good');
    if (typeof refreshInspector === 'function') refreshInspector();
  } else {
    SFX.play('erro');
    toast(BI`↩️ Não deu para desfazer: ${msg.slice(1)}|↩️ Could not undo: ${msg.slice(1)}`, 'bad');
  }
}

cv.addEventListener('contextmenu', e => e.preventDefault());

cv.addEventListener('pointerdown', e => {
  if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
  const [sx, sy] = evPos(e);
  ptrs.set(e.pointerId, { x: sx, y: sy });

  // Two fingers: a pinch. It cancels whatever the first finger had started —
  // opening your hand means you want to navigate, not draw.
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
    // On touch, the first application waits for the gesture to confirm itself as
    // one-fingered (a move or a lift). Applying on contact made the first finger
    // of a pinch leave a stray path or building on the map.
    if (e.pointerType === 'touch') pendenteTool = { x, y };
    else aplicarFerramenta(x, y, false);
  } else {
    // with no tool, one finger drags the camera; if it barely moves, it is a selection
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
      const target = clamp(pinch.z0 * (d / pinch.d0), ZMIN, ZMAX);
      zoomAt(target / cam.z, pinch.mx, pinch.my);
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

function pointerEnd(e) {
  const [sx, sy] = evPos(e);
  ptrs.delete(e.pointerId);

  if (pinch) {
    if (ptrs.size < 2) {
      pinch = null;
      const rest = [...ptrs.values()][0];
      if (rest) startPan(rest.x, rest.y); else stopPan();
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
      // tapping an animal makes it answer — that is the point of a voice per species
      if (p) {
        if (p.kind === 'animal') SFX.voz(p.ref.sp, { vol: .3, imediato: true });
        else if (p.kind === 'vis' || p.kind === 'staff') SFX.vozHumana(p.ref, { vol: .26, imediato: true });
        select(p.kind, p.ref);
      }
      else deselect();
    }
    return;
  }
  // a short tap with a tool: apply now, on the lift
  if (pendenteTool) { aplicarFerramenta(pendenteTool.x, pendenteTool.y, false); pendenteTool = null; }
  endEnclosureDrag();
  pintando = false;
  undoCloseGroup();           // a pincelada acabou: vira 1 item de desfazer
}
cv.addEventListener('pointerup', pointerEnd);
cv.addEventListener('pointercancel', pointerEnd);

cv.addEventListener('wheel', e => {
  e.preventDefault();
  const [sx, sy] = evPos(e);
  zoomAt(e.deltaY < 0 ? 1.14 : 1 / 1.14, sx, sy);
}, { passive: false });

/* zoom buttons (touch) — they anchor on the centre of the screen */
$('#zIn').onclick = () => zoomAt(1.3, VW / 2, VH / 2);
$('#zOut').onclick = () => zoomAt(1 / 1.3, VW / 2, VH / 2);
$('#zMap').onclick = () => { G.wantsMinimap = !G.wantsMinimap; refreshMinimap(); };
$('#stWarn').onclick = () => openFinance();
$('#stHappy').onclick = () => openSatisfaction();
$('#stRep').onclick = () => openReputation();
$('#zUndo').onclick = () => undoLast();
const NOME_BOLHA = ['desligados|off', 'só quem está insatisfeito|only the unhappy ones', 'todos|all'];
function cycleBubbles() {
  G.bubbles = (G.bubbles + 1) % 3;
  $('#zBolha').classList.toggle('on', G.bubbles > 0);
  $('#zBolha').textContent = G.bubbles === 0 ? '💤' : G.bubbles === 1 ? '💭' : '💬';
  toast(BI`💭 Balões de pensamento: ${LN(NOME_BOLHA[G.bubbles])}|💭 Thought bubbles: ${LN(NOME_BOLHA[G.bubbles])}`, '');
}
function refreshSoundButton() {
  $('#zSom').textContent = SFX.on ? (SFX.vol > .5 ? '🔊' : '🔉') : '🔇';
  $('#zSom').classList.toggle('on', SFX.on);
}
function ciclarSom() {
  // 3 states: full -> low -> mute. The preference belongs to the device, not the save.
  SFX.iniciar();
  if (!SFX.on) { SFX.on = true; SFX.vol = .65; }
  else if (SFX.vol > .5) SFX.vol = .3;
  else SFX.on = false;
  SFX.aplicarVolume(); refreshSoundButton();
  try { localStorage.setItem('zoo_som', JSON.stringify({ l: SFX.on, v: SFX.vol })); } catch (e) {}
  if (SFX.on) SFX.play('ui');
}
$('#zSom').onclick = ciclarSom;
$('#zBolha').onclick = cycleBubbles;
$('#zSave').onclick = () => exportSave();
$('#zLoad').onclick = () => $('#fileSave').click();
$('#fileSave').onchange = ev => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  // coming from the splash there is no game in progress: load straight in
  const noSplash = !$('#splash').classList.contains('hidden');
  if (!noSplash && !confirm(BI`Carregar "${f.name}"? O progresso atual será perdido.|Load "${f.name}"? The current progress will be lost.`)) return;
  importSave(f, ok => {
    if (ok && noSplash) { $('#splash').classList.add('hidden'); setSpeed(1); }
  });
};
/* cancel the active tool without a keyboard */
UI.hint.addEventListener('click', e => {
  if (e.target.closest('#hintX')) { setTool(null); G.drag = null; closePalette(); }
});

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key;
  if (k === 'Shift') G.shift = true;
  if (k === ' ') { e.preventDefault(); G.space = true; togglePause(); }
  if (k === 'Escape') { setTool(null); G.drag = null; closePalette(); closeModal(); deselect(); }
  if (k === 'm' || k === 'M') { G.wantsMinimap = !G.wantsMinimap; refreshMinimap(); }
  if (k === 'b' || k === 'B') cycleBubbles();
  if ((k === 'z' || k === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoLast(); return; }
  if (k === 's' || k === 'S') ciclarSom();
  if (k === 'Delete' || k === 'Backspace') {
    if (G.sel && G.sel.kind === 'obj') { removeObject(G.sel.ref.id); deselect(); }
  }
  if (k >= '1' && k <= '9') { const c = CATS[+k - 1]; if (c) openCategory(c.k); }
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

function visitorRate() {
  if (!pathConnected(ENTRANCE.x, ENTRANCE.y - 1) && !pathConnected(ENTRANCE.x, ENTRANCE.y)) return 0;
  if (G.hour < OPEN_H || G.hour >= CLOSE_H) return 0;
  const atracoes = [...enclosures.values()].reduce((s, e) =>
    s + (encViewSpots(e).length ? e.animals.filter(a => !a.dead).length : 0), 0);
  if (!atracoes) return 0;
  const fair = fairPrice();
  // An asymptotic fall, never zero: with the previous linear subtraction a ticket
  // ~2x the fair price locked the box office at 0 visitors — an absorbing state,
  // and the player had no way to see the cause from inside the game.
  const excesso = Math.max(0, G.ticket - fair);
  const priceF = excesso > 0
    ? fair / (fair + excesso * 1.7)
    : clamp(1 + (fair - G.ticket) / Math.max(1, fair) * .45, 1, 1.5);
  const t = (G.hour - OPEN_H) / (CLOSE_H - OPEN_H);
  const hourF = Math.sin(t * Math.PI) ** .7;
  const mk = [1, 1.35, 1.8, 2.5][G.research.marketing]; // 0 = sem campanha, e não "sem público"
  const base = (1 + Math.pow(G.rep, 1.6)) * Math.min(1 + atracoes * .09, 3.2);
  return base * priceF * hourF * mk; // visitantes por hora de jogo
}

function tick(dt) {
  const gh = dt * (24 / DAY_SEC);
  const hAnt = G.hour;
  G.hour += gh;
  if (G.hour >= 24) { G.hour -= 24; closeDay(); }

  // visitor spawning (a lower cap on a phone: every visitor is a drawn sprite
  // plus the occasional BFS over the path network)
  const teto = G.maxVis;
  if (G.visitors.length < teto) {
    spawnAcc += visitorRate() * gh;
    while (spawnAcc >= 1 && G.visitors.length < teto) { spawnAcc -= 1; newVisitor(); }
  } else spawnAcc = 0;

  // recintos
  for (const e of enclosures.values()) {
    const n = e.animals.filter(a => !a.dead).length;
    if (n) {
      e.cleanliness = clamp(e.cleanliness - gh * .0075 * n / Math.max(3, encArea(e) * .3), 0, 1);
      if (!encHasFeeder(e)) e.food = 0;
      if (!encHasWater(e)) e.water = 0;
      const F = FENCES[e.fence];
      const press = e.animals.reduce((s, a) => s + Math.max(0, a.sp.danger - F.strength), 0);
      if (press > 0) e.integrity = clamp(e.integrity - gh * .002 * press, 0, 1);
      else e.integrity = clamp(e.integrity + gh * .004, 0, 1);
    }
  }
  let nv = 0; for (const s of G.staff) if (s.kind === 'vet') nv++;
  G.nVets = nv;
  for (const a of G.animals) updAnimal(a, dt, gh);
  // the carcass disappears 3s after death (enough time to see the notification)
  G.animals = G.animals.filter(a => !a.dead || (a._t = (a._t || 0) + dt) < 3);
  for (let i = G.visitors.length - 1; i >= 0; i--) updVisitor(G.visitors[i], dt, gh);
  for (const s of G.staff) updStaff(s, dt, gh);

  // juros
  if (G.loan > 0) {
    const j = G.loan * .004 * gh / 24;
    G.loan += j; G.money -= j; lgr('upkeep', j);
  }
}
function closeDay() {
  SFX.play('dia');
  const visitorsToday = G.stats.visToday;   // read before the reset below
  G.day++;
  G.ledger.hist.push({ day: G.day - 1, vis: G.stats.visToday, balance: balance(G.ledger.today) });
  if (G.ledger.hist.length > 60) G.ledger.hist.shift();
  for (const k in G.ledger.today) G.ledger.today[k] = 0;
  G.stats.visToday = 0; G.stats.gateToday = 0;
  for (const e of enclosures.values()) e.visitsToday = 0;

  // contas semanais
  if ((G.day - G.lastBill) >= BILL_EVERY) {
    G.lastBill = G.day;
    let payroll = G.staff.reduce((s, x) => s + STAFF_TYPES[x.kind].wage, 0);
    payroll += [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].wage : 0), 0);
    const mk = [0, 1500, 5000, 14000][G.research.marketing];
    spend(payroll + mk, 'wage'); SFX.play('contas');
    toast(BI`🧾 Contas da semana: ${moneyFull(payroll + mk)} (folha${mk ? ' + marketing' : ''})|🧾 Weekly bills: ${moneyFull(payroll + mk)} (payroll${mk ? ' + marketing' : ''})`, 'money');
  }
  // If the day closed with no visitors, say why — once a day. Being left in the
  // dark for days is indistinguishable from a broken game.
  if (visitorsToday === 0 && G.day > 2) {
    const diag = crowdDiagnosis();
    if (diag) toast(diag.em + ' ' + diag.long.replace(/<\/?b>/g, ''), 'bad');
  }
  // the day's visitor ratings enter the statement as 1 aggregated row
  const rv = G.stats.repVis || 0;
  if (Math.abs(rv) >= .02) {
    G.repLog.push({ day: G.day - 1, delta: rv, reason: BI`Avaliações de ${visitorsToday} visitantes|Ratings from ${visitorsToday} visitors`, em: rv > 0 ? '🗳️' : '📉' });
    if (G.repLog.length > 60) G.repLog.shift();
  }
  G.stats.repVis = 0;
  // reputation drifts slowly towards the park's real quality
  const target = parkQuality();
  const before = G.rep;
  G.rep = clamp(lerp(G.rep, target, .12), 0, 5);
  if (Math.abs(G.rep - before) >= .05) {
    G.repLog.push({
      day: G.day - 1, delta: G.rep - before,
      reason: G.rep > before ? LN('Qualidade do parque puxando a nota para cima|Park quality pulling the score up') : LN('Qualidade do parque puxando a nota para baixo|Park quality pulling the score down'),
      em: G.rep > before ? '📈' : '📉',
    });
    if (G.repLog.length > 60) G.repLog.shift();
  }
  saveGame(true);

  if (G.money < -120000 && !G.gameOver) {
    G.gameOver = true; setSpeed(0); SFX.play('falencia');
    openModal(LN('🏚️ Falência|🏚️ Bankruptcy'),
      `<p style="font-size:14px;line-height:1.6">O zoológico quebrou com <b>${moneyFull(G.money)}</b> no vermelho após ${G.day} dias.
       Você recebeu ${G.stats.visitorTotal.toLocaleString('pt-BR')} visitantes e chegou a ter ${G.animals.filter(a => !a.dead).length} animais.</p>`,
      `<button class="btn g" onclick="localStorage.removeItem('zoo_save');location.reload()">Recomeçar</button>
       <button class="btn" onclick="G.money+=100000;G.gameOver=false;closeModal()">Aceitar resgate de R$ 100.000</button>`);
  }
}
/** a one-off shock to the reputation + a row in the statement (visible on ⭐) */
function repEvento(delta, reason, em) {
  G.rep = clamp(G.rep + delta, 0, 5);
  G.repLog.push({ day: G.day, delta, reason, em });
  if (G.repLog.length > 60) G.repLog.shift();
}
function parkQuality() {
  const vivos = G.animals.filter(a => !a.dead);
  if (!vivos.length) return .6;
  const felAn = vivos.reduce((s, a) => s + a.happy, 0) / vivos.length;
  const variety = new Set(vivos.map(a => a.sp.id)).size;
  const felVis = G.stats.happiness;
  const lixoMed = (() => { let s = 0, n = 0; for (let i = 0; i < W * H; i++) if (world.path[i]) { s += world.lixo[i]; n++; } return n ? s / n : 0; })();
  let q = felAn * 1.7 + felVis * 1.9 + Math.min(variety, 30) / 30 * 1.1 - lixoMed * 1.2;
  q -= G.escaped.length * .25;
  return clamp(q, 0, 5);
}

/* ==========================================================================
   15. SALVAR / CARREGAR
   ========================================================================== */
/** Keeps only the keys the running game knows, and fills in what the save is
 *  missing. A save written before a field was renamed would otherwise bring the
 *  old name in and leave the new one undefined — and `undefined + 10` is NaN,
 *  which then spreads through every sum that touches it. */
function keepShape(model, saved) {
  const out = {};
  for (const k in model) out[k] = (saved && typeof saved[k] === typeof model[k]) ? saved[k] : model[k];
  return out;
}
function loadLedger(saved) {
  saved = saved || {};
  const fresh = newLedger();
  return {
    today: keepShape(fresh.today, saved.today),
    week: keepShape(fresh.week, saved.week),
    hist: Array.isArray(saved.hist) ? saved.hist.filter(h => h && Number.isFinite(h.balance)) : [],
  };
}

/** A complete snapshot of the game. It serves the autosave (localStorage) and
 *  the file export — one format, so there are never two "saves" drifting apart. */
function gameSnapshot() {
  return {
      v: 1, money: G.money, ticket: G.ticket, day: G.day, hour: G.hour, rep: G.rep,
      repLog: G.repLog,
      lastBill: G.lastBill, loan: G.loan, marketing: G.research.marketing,
      stats: G.stats, ledger: G.ledger, cam: { x: cam.x, y: cam.y, z: cam.z },
      terr: Array.from(world.terr), path: Array.from(world.path),
      objs: [...objects.values()].map(o => ({ id: o.id, kind: o.kind, cat: o.cat, x: o.x, y: o.y, mult: o.mult, revenue: o.revenue, sales: o.sales, encId: o.encId })),
      encs: [...enclosures.values()].map(e => ({
        id: e.id, fence: e.fence, name: e.name, tiles: [...e.tiles],
        cleanliness: e.cleanliness, food: e.food, water: e.water, integrity: e.integrity,
      })),
      animals: G.animals.filter(a => !a.dead).map(a => ({
        id: a.id, sp: a.sp.id, enc: a.enc, name: a.name, sex: a.sex, age: a.age,
        hunger: a.hunger, thirst: a.thirst, health: a.health, happy: a.happy, sick: a.sick,
        pregnant: a.pregnant, escaped: a.escaped, x: a.x, y: a.y,
      })),
    staff: G.staff.map(s2 => ({ kind: s2.kind, x: s2.x, y: s2.y, feitos: s2.feitos })),
    uid: _uid,
  };
}
function saveGame(silencioso) {
  try {
    localStorage.setItem('zoo_save', JSON.stringify(gameSnapshot()));
    if (!silencioso) toast('💾 Jogo salvo', 'good');
    return true;
  } catch (err) { if (!silencioso) toast(BI`⚠️ Não foi possível salvar: ${err.message}|⚠️ Could not save: ${err.message}`, 'bad'); return false; }
}
function loadGame() {
  const raw = localStorage.getItem('zoo_save');
  if (!raw) { toast('Nenhum jogo salvo encontrado', 'bad'); return false; }
  return aplicarSnapshot(raw, 'Jogo carregado');
}
/** Applies a saved snapshot (from localStorage or an imported file). */
function aplicarSnapshot(raw, label) {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!s || typeof s.money !== 'number' || !Array.isArray(s.terr))
      throw new Error(LN('não parece um save do Zoo Magnata|that does not look like a Zoo Magnata save'));
    G.money = s.money; G.ticket = s.ticket; G.day = s.day; G.hour = s.hour; G.rep = s.rep;
    G.repLog = Array.isArray(s.repLog) ? s.repLog : [];
    G.undo = []; undoGroup = null; refreshUndoButton();   // ids de outro mundo não valem aqui
    G.lastBill = s.lastBill || 1; G.loan = s.loan || 0;
    G.research.marketing = s.marketing || 0;
    G.stats = keepShape(newStats(), s.stats); G.ledger = loadLedger(s.ledger);
    cam.x = s.cam.x; cam.y = s.cam.y; cam.z = s.cam.z;
    world.terr.set(s.terr); world.path.set(s.path);
    // fixes an old save where the gate's doormat was demolished (it locked the zoo)
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
      // An old save stored a rectangle (x,y,w,h) with the outer ring becoming the
      // fence. That rectangle's interior becomes today's tile set.
      let tiles = e.tiles;
      if (!Array.isArray(tiles)) {
        tiles = [];
        for (let j = 1; j < e.h - 1; j++) for (let i = 1; i < e.w - 1; i++)
          tiles.push(IDX(e.x + i, e.y + j));
      }
      const en = {
        id: e.id, fence: e.fence, name: e.name, tiles: new Set(),
        animals: [], objs: [], happy: .7, alerts: [],
        cleanliness: e.cleanliness, food: e.food, water: e.water,
        integrity: e.integrity === undefined ? 1 : e.integrity,
      };
      enclosures.set(e.id, en);
      for (const k of tiles) { en.tiles.add(k); world.enc[k] = e.id; }
      encInvalida(en);
    }
    for (const o of s.objs) {
      const def = o.cat === 'build' ? BUILDINGS[o.kind] : o.cat === 'deco' ? DECOS[o.kind] : ENCOBJ[o.kind];
      const ob = { ...o, w: def.w || 1, h: def.h || 1, queue: [], estoque: 1, dirty: 0, hp: 1, revenue: o.revenue || 0, sales: o.sales || 0 };
      for (let j = 0; j < ob.h; j++) for (let i = 0; i < ob.w; i++) world.occ[IDX(ob.x + i, ob.y + j)] = ob.id;
      objects.set(ob.id, ob);
      if (ob.cat === 'deco') applyBeauty(ob, +1);
      if (ob.cat === 'encobj') { const e = enclosures.get(ob.encId); if (e) e.objs.push(ob); }
    }
    for (const a of s.animals) {
      const an = {
        ...a, sp: SPECIES[a.sp], dead: false, tx: a.x, ty: a.y, dir: 1,
        frame: 0, anim: 0, state: 'parado', espera: rnd(1, 4),
      };
      G.animals.push(an);
      const e = enclosures.get(a.enc);
      if (e && !a.escaped) e.animals.push(an);
      if (a.escaped) G.escaped.push(an);
    }
    for (const st of s.staff) { const x = contratar(st.kind); x.x = st.x; x.y = st.y; x.feitos = st.feitos || 0; }
    terrainChanged(); rebuildNet();   // rebuildNet já incrementa netVer
    deselect(); closeModal();
    toast('📂 ' + (label || 'Jogo carregado') + ' — dia ' + G.day, 'good');
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

function exportSave() {
  if (baixarArquivo(`zoo-magnata-${selo()}.json`, JSON.stringify(gameSnapshot()), 'application/json'))
    toast(LN('📥 Save baixado — guarde o arquivo para retomar depois|📥 Save downloaded — keep the file to pick up later'), 'good');
}
function exportReport() {
  if (baixarArquivo(`zoo-magnata-status-${selo()}.txt`, reportText(), 'text/plain'))
    toast(LN('📄 Relatório de status baixado|📄 Status report downloaded'), 'good');
}
function importSave(file, onDone) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let ok = false;
    if (/^\s*[{[]/.test(fr.result)) ok = aplicarSnapshot(fr.result, 'Save importado');
    else toast(LN('⚠️ Esse arquivo não é um save (.json) do jogo|⚠️ That file is not a game save (.json)'), 'bad');
    if (onDone) onDone(ok);
  };
  fr.onerror = () => { toast(LN('⚠️ Não consegui ler o arquivo|⚠️ Could not read the file'), 'bad'); if (onDone) onDone(false); };
  fr.readAsText(file);
}

/** A readable report on the zoo's state — the "game status" as text. */
function reportText() {
  const L = [];
  const row = c => L.push(c);
  const reg = (rot, val) => row('  ' + rot.padEnd(30, '.') + ' ' + val);
  const miniGauge = v => '█'.repeat(Math.round(clamp(v, 0, 1) * 10)).padEnd(10, '░');
  const vivos = G.animals.filter(a => !a.dead);
  const moodV = G.visitors.length ? G.visitors.reduce((s, v) => s + v.mood, 0) / G.visitors.length : G.stats.happiness;
  const moodA = vivos.length ? vivos.reduce((s, a) => s + a.happy, 0) / vivos.length : 0;

  row('ZOO MAGNATA — STATUS');
  row('='.repeat(64));
  row(`Dia ${G.day}, ${relTime(G.hour)}${G.hour >= OPEN_H && G.hour < CLOSE_H ? ' (aberto)' : ' (fechado)'}`);
  row('');
  row('VISÃO GERAL');
  reg('Caixa', moneyFull(G.money));
  reg('Empréstimo em aberto', moneyFull(G.loan));
  reg('Reputação', G.rep.toFixed(2) + ' / 5.00  ' + miniGauge(G.rep / 5));
  reg('Preço do ingresso', moneyFull(G.ticket) + '  (referência: ' + moneyFull(fairPrice()) + ')');
  reg('Marketing', ['nenhum', 'local', 'regional', 'nacional'][G.research.marketing]);
  reg('Visitantes agora', G.visitors.length);
  reg('Visitantes hoje', G.stats.visToday);
  reg('Visitantes desde a abertura', G.stats.visitorTotal);
  reg('Satisfação dos visitantes', Math.round(moodV * 100) + '%  ' + miniGauge(moodV));
  reg('Felicidade dos animais', Math.round(moodA * 100) + '%  ' + miniGauge(moodA));
  reg('Animais vivos', vivos.length + ' de ' + new Set(vivos.map(a => a.sp.id)).size + ' espécies');
  reg('Recintos', enclosures.size);

  const trava = crowdDiagnosis();
  if (trava) {
    row('');
    row('!! O QUE ESTÁ TRAVANDO A BILHETERIA');
    row('   ' + trava.em + ' ' + trava.long.replace(/<\/?b>/g, ''));
  }

  row('');
  row('FINANÇAS — HOJE');
  const h = G.ledger.today;
  reg('Ingressos', '+' + moneyFull(h.ticket));
  reg('Lojas e restaurantes', '+' + moneyFull(h.shop));
  reg('Venda de animais', '+' + moneyFull(h.sell));
  reg('Ração e insumos', '-' + moneyFull(h.feed));
  reg('Salários', '-' + moneyFull(h.wage));
  reg('Manutenção e veterinário', '-' + moneyFull(h.upkeep));
  reg('Compra de animais', '-' + moneyFull(h.buy));
  reg('Obras', '-' + moneyFull(h.build));
  reg('SALDO DO DIA', moneyFull(balance(h)));
  if (G.ledger.hist.length) {
    row('');
    row('ÚLTIMOS DIAS');
    for (const d of G.ledger.hist.slice(-10))
      row(`  dia ${String(d.day).padStart(3)} · ${String(d.vis).padStart(5)} visitantes · saldo ${moneyFull(d.balance)}`);
  }

  row('');
  row('RECINTOS');
  if (!enclosures.size) row('  (nenhum)');
  for (const e of enclosures.values()) {
    const av = e.animals.filter(a => !a.dead);
    const fel = av.length ? av.reduce((s, a) => s + a.happy, 0) / av.length : 0;
    const sp0 = av[0] ? av[0].sp : null;
    row('');
    row(`  ${e.name} — ${FENCES[e.fence].n}, ${encArea(e)} tiles, cerca de ${encSegCount(e)} trechos`);
    row(`    felicidade ${miniGauge(fel)} ${Math.round(fel * 100)}%   ` +
      `limpeza ${miniGauge(e.cleanliness)} ${Math.round(e.cleanliness * 100)}%`);
    row(`    comida    ${miniGauge(e.food)} ${Math.round(e.food * 100)}%   ` +
      `água    ${miniGauge(e.water)} ${Math.round(e.water * 100)}%`);
    const enr = encEnrich(e);
    row(`    enriquecimento ${miniGauge(enr)} ${Math.round(enr * 100)}%   ` +
      `pontos de observação: ${encViewSpots(e).length}`);
    const mix = Object.entries(encMix(e)).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${TERRAIN[k].n} ${Math.round(v * 100)}%`).join(', ');
    row('    terreno: ' + mix);
    if (sp0) row('    ideal:   ' + Object.entries(sp0.mix)
      .map(([k, v]) => `${TERRAIN[k].n} ${Math.round(v * 100)}%`).join(', ') + `  (biome ${sp0.biomeName})`);
    row('    objetos: ' + (e.objs.length ? e.objs.map(o => ENCOBJ[o.kind].n).join(', ') : 'nenhum'));
    for (const a of av)
      row(`      - ${a.name} (${a.sex}) ${LN(a.sp.name)}, ${a.age.toFixed(1)}/${a.sp.lifespan} anos · ` +
        `felicidade ${Math.round(a.happy * 100)}% · saúde ${Math.round(a.health * 100)}%` +
        `${a.sick ? ' · DOENTE' : ''}${a.pregnant > 0 ? ' · gestante' : ''}` +
        (a.pensa ? ` · pensando: ${a.pensa.txt}` : ''));
    const al = encAlertsHTML(e).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (al) row('    alertas: ' + al);
  }

  row('');
  row('COMÉRCIO E SERVIÇOS');
  const builds = [...objects.values()].filter(o => o.cat === 'build');
  if (!builds.length) row('  (nenhum)');
  for (const o of builds) {
    const B = BUILDINGS[o.kind];
    row(`  ${B.n} em (${o.x},${o.y}) · ${objAcessivel(o) ? 'acessível' : 'SEM TRILHA POR PERTO'}` +
      (B.value > 0 ? ` · preço ${moneyFull(priceOf(o))} · ${o.sales} vendas · lucro ${moneyFull(o.revenue)}` : ''));
  }

  row('');
  row('EQUIPE');
  let payroll = 0;
  for (const k in STAFF_TYPES) {
    const n = G.staff.filter(s => s.kind === k).length;
    if (!n) continue;
    payroll += n * STAFF_TYPES[k].wage;
    row(`  ${n}x ${STAFF_TYPES[k].n} · ${moneyFull(STAFF_TYPES[k].wage)}/semana cada · ` +
      `${G.staff.filter(s => s.kind === k).reduce((s, x) => s + x.feitos, 0)} tarefas feitas`);
  }
  if (!G.staff.length) row('  (ninguém contratado)');
  payroll += builds.reduce((s, o) => s + BUILDINGS[o.kind].wage, 0);
  reg('Folha semanal total', moneyFull(payroll));

  const rv = agruparPensamentos(G.visitors, visitorThought), ra = agruparPensamentos(vivos, animalThought);
  const section = (tit, rank, tot) => {
    row(''); row(tit);
    if (!rank.length) { row('  (ninguém)'); return; }
    for (const r of rank) {
      row(`  ${r.em} ${r.txt} — ${r.n} (${Math.round(r.n / Math.max(1, tot) * 100)}%)`);
      if (TIPS[r.em] && r.urg >= .45) row('      -> ' + TIPS[r.em]);
    }
  };
  section('POR QUE OS VISITANTES ESTÃO ASSIM', rv, G.visitors.length);
  section('POR QUE OS ANIMAIS ESTÃO ASSIM', ra, vivos.length);

  row('');
  row('='.repeat(64));
  row('Gerado pelo próprio jogo. Para retomar a partida use o save .json.');
  return L.join('\n');
}

/* ==========================================================================
   16. BOOT
   ========================================================================== */
function startingPath() {
  for (let y = H - 1; y >= H - 12; y--) addPath(ENTRANCE.x, y);
  for (let x = ENTRANCE.x - 6; x <= ENTRANCE.x + 6; x++) addPath(x, H - 12);
  for (let x = ENTRANCE.x - 6; x <= ENTRANCE.x + 6; x++) addPath(x, H - 6);
  for (const dx of [-6, 6]) for (let y = H - 12; y <= H - 6; y++) addPath(ENTRANCE.x + dx, y);
  G.ledger.today.build = 0; G.ledger.week.build = 0;
}
/** adjusts what depends on the screen size (at boot and on every rotate/resize) */
function ajustarParaTela() {
  const estreita = window.innerWidth <= 700;
  G.maxVis = estreita ? 110 : window.innerWidth <= 1100 ? 190 : 280;
  // minimap and zoom buttons: on a narrow screen the map overlaps the dock, so it
  // hides behind the 🗺️ button; button zoom only shows where there is no wheel
  $('#zoomBtns').classList.toggle('show', IS_TOUCH);
  refreshMinimap();
  medirHud();
}
function init() {
  resize();
  genTerrain();
  startingPath();
  rebuildNet();
  cam.z = window.innerWidth <= 700 ? .62 : .85;
  centerOn(ENTRANCE.x, ENTRANCE.y - 14);
  buildDock();
  contratar('trat'); contratar('fax');
  updateHUD();
  G.wantsMinimap = !isSmall();      // no celular o minimapa começa desligado
  try {
    const pref = JSON.parse(localStorage.getItem('zoo_som') || 'null');
    if (pref) { SFX.on = !!pref.l; SFX.vol = +pref.v || .65; }
  } catch (e) {}
  refreshSoundButton();
  ajustarParaTela();
  // the HUD changes height when the labels break onto another line
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
  // the flag here (once a frame) covers a whole drag with a single BFS — and
  // without it `netVer` never changed, freezing the "who sees this enclosure"
  // cache empty forever: no enclosure became an attraction and nobody visited.
  if (G.dirty.net) rebuildNet();
  if (!G.gameOver && G.speed > 0) {
    // fixed steps so the simulation stays stable at 2x/4x
    acc += dt * G.speed;
    let guard = 0;
    while (acc > 1 / 30 && guard++ < 12) { tick(1 / 30); acc -= 1 / 30; }
  }
  render(now);
  hudAcc += dt;
  if (hudAcc > .2) {
    hudAcc = 0;
    // fairPrice() sweeps enclosures and buildings; the thoughts query it per
    // visitor, so cache the value instead of recomputing it hundreds of times
    G.fairCache = fairPrice();
    updateHUD();
    refreshInspector();
  }
  somAcc += dt;
  if (somAcc > .5) {
    somAcc = 0;
    // Animal voices in the background, muffled and sparse. No crowd murmur: the
    // park stays quiet and what you hear are the animals themselves.
    if (G.speed > 0 && SFX.on) {
      const vivos = G.animals.filter(a => !a.dead);
      const chance = clamp(.02 + vivos.length * .006, 0, .13);
      if (vivos.length && Math.random() < chance)
        SFX.voz(pick(vivos).sp, { vol: .13, distante: true });
    }
  }
  miniAcc += dt;
  if (miniAcc > .5 && $('#mini').classList.contains('show')) { miniAcc = 0; renderMini(); }
}

init();

/* The splash chooses between a new game and a save — with no blocking confirm(), and with the
   relógio parado enquanto ele está na tela. */
let temSave = false;
try { temSave = !!localStorage.getItem('zoo_save'); } catch (e) { temSave = false; }
const comecar = loadSaveFile => {
  SFX.iniciar();       // 1º gesto do usuário: só aqui o áudio pode nascer
  $('#splash').classList.add('hidden');
  if (loadSaveFile) loadGame();
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
  if (G.tool && G.tool.cat) buildPalette(G.tool.cat);
  showInspector();
  renderAlerts();
});

// the test bridge — the kit looks for this name
window.__game = { name: 'zoo-magnata', i18n: I18N, G };
