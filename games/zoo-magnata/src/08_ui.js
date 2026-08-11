/* ==========================================================================
   11. INTERFACE
   ========================================================================== */
const UI = {
  dock: $('#dock'), pal: $('#palette'), palTitle: $('#palTitle'),
  insp: $('#inspector'), hint: $('#hint'), toasts: $('#toasts'),
  modalBg: $('#modalBg'), modal: $('#modal'), mTitle: $('#modalTitle'),
  mBody: $('#modalBody'), mFoot: $('#modalFoot'),
  cat: null,
};

const isSmall = () => window.innerWidth <= 700;
const IS_TOUCH = matchMedia('(hover:none)').matches || navigator.maxTouchPoints > 0;

/** Which panel arrangement the CSS is applying — it mirrors the media queries.
 *  'drawer'   phone upright: the inspector is a bottom drawer, the palette takes the footer
 *  'tight'    tablet: a side inspector, but the palette would still cross it
 *  'wide'     desktop: the two coexist without touching */
function layoutModo() {
  const w = window.innerWidth, h = window.innerHeight;
  if (h <= 520 && w >= 560) return 'lateralCurto';
  if (w <= 700) return 'drawer';
  if (w <= 1000) return 'tight';
  return 'wide';
}
/** where palette and inspector don't fit together, only one stays open at a time */
function singlePanel() { const m = layoutModo(); return m === 'drawer' || m === 'tight'; }

/** publishes the HUD's real height to the CSS — it varies when the labels break
 *  onto two lines on a phone, and inspector/hint/toasts hang off it */
function medirHud() {
  const h = Math.round($('#hud').getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hudH', h + 'px');
}

function toast(msg, kind) {
  SFX.play(kind === 'good' ? 'buy' : kind === 'money' ? 'coin' : kind === 'bad' ? 'error' : 'ui');
  const t = el('div', 'toast ' + (kind || ''), msg);
  UI.toasts.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .4s,transform .4s'; t.style.opacity = 0; t.style.transform = 'translateX(30px)'; }, 4200);
  setTimeout(() => t.remove(), 4700);
  while (UI.toasts.children.length > 6) UI.toasts.firstChild.remove();
}
function hint(html) { if (!html) { UI.hint.classList.remove('show'); return; } UI.hint.innerHTML = html; UI.hint.classList.add('show'); }

/* ---- HUD ---- */
function updateHUD() {
  $('#vMoney').textContent = money(G.money);
  $('#stMoney').classList.toggle('neg', G.money < 0);
  $('#vDay').textContent = G.day;
  $('#vVis').textContent = G.visitors.length;
  const vivos = G.animals.filter(a => !a.dead);
  $('#vAni').textContent = vivos.length;
  const hp = G.visitors.length ? G.visitors.reduce((s, v) => s + v.mood, 0) / G.visitors.length : G.stats.happiness;
  G.stats.happiness = hp;
  $('#vHappy').textContent = Math.round(hp * 100) + '%';
  $('#vRep').textContent = G.rep.toFixed(1) + '★';
  $('#clockBadge').textContent = relTime(G.hour) + (G.hour >= OPEN_H && G.hour < CLOSE_H ? '' : ' 🌙');

  // A short warning in the HUD. Don't gate it on "zero visitors in the park":
  // right after you cut the path, the people already inside keep leaving and the
  // alert stayed hidden at exactly the moment it mattered.
  const w = $('#stWarn');
  const diag = crowdDiagnosis();
  const mostra = !!diag && diag.key !== 'closed';
  w.classList.toggle('show', mostra);
  if (mostra) {
    $('#vWarn').textContent = diag.short;
    w.querySelector('.ic').textContent = diag.em;
  }
  renderAlerts();
}

/* ---- the manager's alert bar ----
   The problems that want action NOW, grouped by kind. Clicking the chip
   centres the camera on the target; clicking again cycles through the cases. */
const ALERT_DEF = {
  escape: { em: '🚨', n: 'Animal solto|Animal loose', sev: 3 },
  sick: { em: '🤒', n: 'Animal doente|Sick animal', sev: 3 },
  health: { em: '🆘', n: 'Saúde crítica|Critical health', sev: 3 },
  hunger: { em: '🍖', n: 'Recinto sem comida|Enclosure with no food', sev: 2 },
  water: { em: '💧', n: 'Recinto sem água|Enclosure with no water', sev: 2 },
  fence: { em: '🔧', n: 'Cerca se rompendo|Fence breaking', sev: 2 },
  elderly: { em: '⏳', n: 'Animal no fim da vida|Animal near the end of its life', sev: 1 },
  dirty: { em: '🧹', n: 'Recinto imundo|Filthy enclosure', sev: 1 },
  unseen: { em: '👀', n: 'Recinto sem trilha|Enclosure with no path', sev: 1 },
};
let _alSig = '';
const _alCursor = {};
function collectAlerts() {
  const groups = new Map();
  const add = (kind, target, label) => {
    let g = groups.get(kind);
    if (!g) groups.set(kind, g = { kind, targets: [], labels: [] });
    g.targets.push(target); g.labels.push(label);
  };
  for (const a of G.escaped) if (!a.dead) add('escape', [a.x, a.y], LN(a.sp.name));
  for (const a of G.animals) {
    if (a.dead || a.escaped) continue;
    if (a.sick) add('sick', [a.x, a.y], a.name + ' (' + LN(a.sp.name) + ')');
    else if (a.health < .3) add('health', [a.x, a.y], a.name + ' (' + LN(a.sp.name) + ')');
    if (a.age > a.sp.lifespan * .85) add('elderly', [a.x, a.y], a.name + ' (' + LN(a.sp.name) + ')');
  }
  for (const e of enclosures.values()) {
    if (!e.animals.some(a => !a.dead)) continue;
    const bb = encBBox(e), target = [bb.cx, bb.cy];
    if (!encHasFeeder(e) || e.food < .12) add('hunger', target, e.name);
    if (!encHasWater(e) || e.water < .12) add('water', target, e.name);
    if (e.integrity < .5) add('fence', target, e.name);
    if (e.cleanliness < .3) add('dirty', target, e.name);
    if (!encViewSpots(e).length) add('unseen', target, e.name);
  }
  return [...groups.values()]
    .sort((a, b) => ALERT_DEF[b.kind].sev - ALERT_DEF[a.kind].sev || b.targets.length - a.targets.length);
}
function renderAlerts() {
  const ab = $('#alertbar'); if (!ab) return;
  const groups = collectAlerts().slice(0, 6);
  const sig = groups.map(g => g.kind + ':' + g.targets.length).join('|');
  if (sig === _alSig) return;                 // no change, no rebuild
  _alSig = sig;
  ab.innerHTML = '';
  for (const g of groups) {
    const D = ALERT_DEF[g.kind];
    const chip = el('button', 'achip sev' + D.sev,
      `<span>${D.em}</span><span>${esc(LN(D.n))}</span>` +
      (g.targets.length > 1 ? `<span class="n">${g.targets.length}</span>` : ''));
    chip.title = g.labels.slice(0, 6).join(', ') + (g.labels.length > 6 ? '…' : '') + LN(' — toque para localizar| — tap to locate');
    chip.onclick = () => {
      const i = _alCursor[g.kind] = ((_alCursor[g.kind] ?? -1) + 1) % g.targets.length;
      centerOn(g.targets[i][0], g.targets[i][1]);
      toast(D.em + ' ' + esc(g.labels[i]) + (g.targets.length > 1 ? ` (${i + 1}/${g.targets.length})` : ''), '');
    };
    ab.appendChild(chip);
  }
}

/* ---- dock categories ---- */
const CATS = [
  { k: 'path', n: 'Trilhas|Paths', em: '🛣️' },
  { k: 'enclosure', n: 'Recintos|Enclosures', em: '🚧' },
  { k: 'terrain', n: 'Terreno|Terrain', em: '🎨' },
  { k: 'encobj', n: 'No Recinto|In Enclosure', em: '🥣' },
  { k: 'animal', n: 'Animais|Animals', em: '🦁' },
  { k: 'build', n: 'Comércio|Shops', em: '🍔' },
  { k: 'deco', n: 'Decoração|Decor', em: '🌳' },
  { k: 'equipe', n: 'Equipe|Staff', em: '🧑‍🌾' },
  { k: 'financas', n: 'Finanças|Finance', em: '💰' },
  { k: 'demolish', n: 'Demolir|Demolish', em: '🔨' },
];
function buildDock() {
  UI.dock.innerHTML = '';
  for (const c of CATS) {
    const b = el('button', 'btn', `<i>${c.em}</i>${LN(c.n)}`);
    b.dataset.cat = c.k;
    b.onclick = () => openCategory(c.k);
    UI.dock.appendChild(b);
  }
  const bh = el('button', 'btn', '<i>❓</i>Ajuda');
  bh.onclick = openHelp; UI.dock.appendChild(bh);
}
function openCategory(k) {
  if (UI.cat === k) { closePalette(); return; }
  UI.cat = k;
  $$('#dock .btn').forEach(b => b.classList.toggle('on', b.dataset.cat === k));
  if (k === 'animal') { closePalette(); openShop(); return; }
  if (k === 'equipe') { closePalette(); openStaff(); return; }
  if (k === 'financas') { closePalette(); openFinance(); return; }
  if (k === 'demolish') { closePalette(); setTool({ cat: 'demolish', em: '🔨', n: 'Demolir|Demolish' }); return; }
  buildPalette(k);
}
function closePalette() {
  UI.pal.classList.remove('show'); UI.cat = null;
  $$('#dock .btn').forEach(b => b.classList.remove('on'));
  refreshMinimap();
}

function buildPalette(k) {
  if (singlePanel()) deselect();
  UI.pal.classList.add('show');
  refreshMinimap();
  UI.pal.innerHTML = '';
  const title = el('div', '', ''); title.id = 'palTitle';
  UI.pal.appendChild(title);
  const add = (label, em, price, tool, extraHTML) => {
    const d = el('div', 'pitem');
    d.innerHTML = `<span class="em">${em}</span>${label}${price !== null ? `<span class="pr">${moneyFull(price)}</span>` : ''}${extraHTML || ''}`;
    d.onclick = () => { setTool(tool); $$('#palette .pitem').forEach(z => z.classList.remove('on')); d.classList.add('on'); };
    if (G.tool && G.tool.key === tool.key && G.tool.cat === tool.cat) d.classList.add('on');
    UI.pal.appendChild(d);
    return d;
  };
  if (k === 'path') {
    title.textContent = LN('Trilhas — clique e arraste para desenhar o caminho dos visitantes|Paths — click and drag to draw where the visitors walk');
    add(LN('Calçada|Path'), '🛣️', 30, { cat: 'path', key: 'pavement', em: '🛣️', n: 'Calçada|Path', cost: 30 });
    add(LN('Apagar trilha|Erase path'), '🧽', 0, { cat: 'path', key: 'del', em: '🧽', n: 'Apagar trilha|Erase path', cost: 0 });
  } else if (k === 'enclosure') {
    title.textContent = LN('Recintos — arraste um retângulo (mínimo 3×3). O preço cobre a cerca do perímetro.|Enclosures — drag a rectangle (3×3 minimum). The price covers the perimeter fence.');
    for (const key in FENCES) {
      const F = FENCES[key];
      add(F.n, F.em, F.cost, { cat: 'enclosure', key, em: F.em, n: F.n, cost: F.cost },
        BI`<span class="pr">força ${F.strength} · visão ${Math.round(F.sight * 100)}%</span>|<span class="pr">strength ${F.strength} · sight ${Math.round(F.sight * 100)}%</span>`);
    }
  } else if (k === 'terrain') {
    title.textContent = LN('Terreno — pinte dentro dos recintos para bater com o bioma da espécie|Terrain — paint inside the enclosures to match the species\u2019 biome');
    for (const key of TKEYS) {
      if (key === 'pavement') continue;
      const T = TERRAIN[key];
      add(T.n, T.em, T.cost, { cat: 'terrain', key, em: T.em, n: T.n, cost: T.cost });
    }
  } else if (k === 'encobj') {
    title.textContent = LN('Objetos de recinto — comedouro e bebedouro são obrigatórios para manter os animais vivos|Enclosure objects — a feeder and a water trough are required to keep the animals alive');
    for (const key in ENCOBJ) {
      const O = ENCOBJ[key];
      add(O.n, O.em, O.cost, { cat: 'encobj', key, em: O.em, n: O.n, cost: O.cost, w: 1, h: 1 },
        O.enr ? `<span class="pr">enriquecimento +${O.enr}</span>` : '');
    }
  } else if (k === 'build') {
    title.textContent = LN('Comércio e serviços — cada um atende uma necessidade dos visitantes|Shops and services — each one meets a visitor need');
    for (const key in BUILDINGS) {
      const B = BUILDINGS[key];
      add(B.n, B.em, B.cost, { cat: 'build', key, em: B.em, n: B.n, cost: B.cost, w: B.w, h: B.h },
        `<span class="pr">${B.w}×${B.h}${B.supplies ? ' · ' + B.supplies : ''}</span>`);
    }
  } else if (k === 'deco') {
    title.textContent = LN('Decoração — aumenta a beleza da área e o humor de quem passa perto|Decor — raises the beauty of the area and the mood of whoever walks past');
    for (const key in DECOS) {
      const D = DECOS[key];
      add(D.n, D.em, D.cost, { cat: 'deco', key, em: D.em, n: D.n, cost: D.cost, w: 1, h: 1 },
        `<span class="pr">beleza +${D.beauty}</span>`);
    }
  }
}
function setTool(t) {
  if (t) SFX.play('tab');
  G.tool = t; G.drag = null;
  if (!t) { hint(null); return; }
  const tips = {
    caminho: LN('Arraste para desenhar a trilha.|Drag to draw the path.'),
    recinto: t.ampliando
      ? LN('Arraste <b>encostando no recinto</b> para ampliá-lo. Pode repetir para fazer L, T ou U.|Drag <b>touching the enclosure</b> to extend it. Repeat to make an L, a T or a U.')
      : LN('Arraste um retângulo para criar. Depois arraste <b>colado nele</b> para ampliar — o formato não precisa ser quadrado.|Drag a rectangle to create one. Then drag <b>against it</b> to extend — the shape does not have to be square.'),
    terreno: LN('Arraste para pintar o terreno.<span class="ctrlMouse"> <kbd>Shift</kbd> pinta 3×3.</span>|Drag to paint the terrain.<span class="ctrlMouse"> <kbd>Shift</kbd> paints 3×3.</span>'),
    encobj: LN('Coloque dentro de um recinto já construído.|Place it inside an enclosure you already built.'),
    build: LN('Posicione junto a uma trilha para os visitantes conseguirem chegar.|Put it next to a path so visitors can reach it.'),
    deco: LN('Espalhe pelo parque — quanto mais bonito, mais felizes os visitantes.|Scatter it around the park — the prettier it is, the happier the visitors.'),
    animal: BI`Toque num recinto para soltar <b>${t.sp ? LN(t.sp.name) : ''}</b> lá dentro.|Tap an enclosure to release <b>${t.sp ? LN(t.sp.name) : ''}</b> into it.`,
    demolir: LN('Toque no que quiser remover. Recintos devolvem metade do valor da cerca.|Tap whatever you want removed. Enclosures refund half the fence value.'),
  };
  hint(`<span style="font-size:17px">${t.em || '🔧'}</span> <b>${LN(t.n || '')}</b> — ${tips[t.cat] || ''}` +
    `<button class="btn r sm" id="hintX" title="Cancelar ferramenta">✕</button>`);
}

/* ---- modais ---- */
function openModal(title, bodyHTML, footHTML) {
  SFX.play('open');
  UI.mTitle.textContent = title;
  UI.mBody.innerHTML = bodyHTML || '';
  UI.mFoot.innerHTML = footHTML || '';
  UI.modalBg.classList.add('show');
}
function closeModal() {
  if (UI.modalBg.classList.contains('show')) SFX.play('close');
  UI.modalBg.classList.remove('show'); closePalette();
}
$('#modalX').onclick = closeModal;
UI.modalBg.onclick = e => { if (e.target === UI.modalBg) closeModal(); };

/* ---- loja de animais ---- */
let shopFiltro = { q: '', biome: '', diet: '', ord: 'appeal' };
let shopEncId = null;
function openShop(encId) {
  shopEncId = encId || null;
  const e = encId ? enclosures.get(encId) : null;
  const optB = [`<option value="">${LN('Todos os biomas|All biomes')}</option>`]
    .concat(Object.keys(BIOMES).map(k => `<option value="${k}">${BIOMES[k].em} ${LN(BIOMES[k].n)}</option>`)).join('');
  const optD = [`<option value="">${LN('Todas as dietas|All diets')}</option>`]
    .concat(Object.keys(DIETS).map(k => `<option value="${k}">${DIETS[k].em} ${LN(DIETS[k].n)}</option>`)).join('');
  openModal(e ? BI`Comprar animal para ${e.name}|Buy an animal for ${e.name}` : LN('Loja de Animais|Animal Shop'),
    `<div id="shopBar">
       <input type="text" id="shopQ" placeholder="${LN('🔎 Buscar espécie...|🔎 Search species...')}" style="flex:1;min-width:170px">
       <select id="shopB">${optB}</select>
       <select id="shopD">${optD}</select>
       <select id="shopO">
         <option value="appeal">${LN('Ordenar: popularidade|Sort: popularity')}</option>
         <option value="price">${LN('Ordenar: preço ↑|Sort: price ↑')}</option>
         <option value="priceDesc">${LN('Ordenar: preço ↓|Sort: price ↓')}</option>
         <option value="name">${LN('Ordenar: A–Z|Sort: A–Z')}</option>
         <option value="space">${LN('Ordenar: espaço|Sort: space')}</option>
       </select>
       <span id="shopCount" style="font-size:12px;opacity:.6"></span>
     </div>
     <div id="shopGrid"></div>`,
    e ? `<b style="font-size:13px">${e.name}</b> <span style="font-size:12px;opacity:.7">— ${LN(FENCES[e.fence].n)}, ${encArea(e)} ${LN('tiles livres|free tiles')}, ${e.animals.length} ${LN('animais|animals')}</span>`
      : `<span style="font-size:12px;opacity:.75">${LN('Escolha uma espécie e depois toque no recinto onde ela vai morar. Verde = combina com o recinto selecionado.|Pick a species, then tap the enclosure it will live in. Green = a match for the selected enclosure.')}</span>`);
  $('#shopQ').oninput = ev => { shopFiltro.q = ev.target.value; renderShop(); };
  $('#shopB').onchange = ev => { shopFiltro.biome = ev.target.value; renderShop(); };
  $('#shopD').onchange = ev => { shopFiltro.diet = ev.target.value; renderShop(); };
  $('#shopO').onchange = ev => { shopFiltro.ord = ev.target.value; renderShop(); };
  // the filter persists between openings — the controls have to SHOW that.
  // Reopening with cleared controls but the old filter still in force made the
  // list "dwindle" on every visit down to 0 species for no apparent reason.
  $('#shopQ').value = shopFiltro.q;
  $('#shopB').value = shopFiltro.biome;
  $('#shopD').value = shopFiltro.diet;
  $('#shopO').value = shopFiltro.ord;
  renderShop();
}
let shopObserver = null;
function renderShop() {
  const grid = $('#shopGrid'); if (!grid) return;
  grid.innerHTML = '';
  const e = shopEncId ? enclosures.get(shopEncId) : null;
  const q = shopFiltro.q.trim().toLowerCase();
  let list = SPECIES.filter(s =>
    (!q || LN(s.name).toLowerCase().includes(q) || LN(s.biomeName).toLowerCase().includes(q)) &&
    (!shopFiltro.biome || s.biome === shopFiltro.biome) &&
    (!shopFiltro.diet || s.diet === shopFiltro.diet));
  const ord = { appeal: (a, b) => b.appeal - a.appeal || a.price - b.price, price: (a, b) => a.price - b.price, priceDesc: (a, b) => b.price - a.price, name: (a, b) => LN(a.name).localeCompare(LN(b.name)), space: (a, b) => a.space - b.space };
  list = list.slice().sort(ord[shopFiltro.ord]);
  $('#shopCount').textContent = list.length + LN(' espécies| species');
  if (shopObserver) shopObserver.disconnect();
  shopObserver = new IntersectionObserver(ents => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      const d = en.target;
      if (d.dataset.done) continue;
      d.dataset.done = '1';
      shopObserver.unobserve(d);
      // each card is isolated: one problem species must not wipe out the whole shop
      try {
        // measure the real box: it shrinks on a phone (.pic is shorter there)
        const pic = d.querySelector('.pic');
        pic.appendChild(spriteThumb(SPECIES[+d.dataset.sp],
          Math.min(96, pic.clientWidth - 6), pic.clientHeight - 6));
      } catch (err) {
        console.error('Falha ao desenhar', SPECIES[+d.dataset.sp].name, err);
        d.querySelector('.pic').textContent = '🐾';
      }
    }
  }, { root: UI.mBody, rootMargin: '260px' });

  for (const sp of list) {
    const allowed = G.money >= sp.price;
    const combina = e ? terrainScore(e, sp) : null;
    const card = el('div', 'acard' + (allowed ? '' : ' dis'));
    card.dataset.sp = sp.id;
    const bg = combina === null ? '#eef4ea' : combina > .7 ? '#d7f0cf' : combina > .4 ? '#fbf0cf' : '#f8dcd6';
    card.innerHTML =
      `<div class="pic" style="background:${bg}"></div>
       <div class="nm">${esc(LN(sp.name))}</div>
       <div class="mt">${BIOMES[sp.biome].em} ${LN(sp.biomeName)} · ${DIETS[sp.diet].em} ${LN(sp.dietName)}<br>
         ${BI`${sp.space} tiles/animal · grupo ${sp.groupMin}–${sp.groupMax} · ${sp.lifespan} anos|${sp.space} tiles/animal · group ${sp.groupMin}–${sp.groupMax} · ${sp.lifespan} years`}<br>
         ${BI`ração ${moneyFull(sp.feed)}/dia · perigo|feed ${moneyFull(sp.feed)}/day · danger`} ${'⚠️'.repeat(Math.min(sp.danger, 5)) || '—'}</div>
       <div class="ft"><span class="stars">${stars(sp.appeal / 2)}</span><b>${moneyFull(sp.price)}</b></div>`;
    card.onclick = () => {
      if (!allowed) { toast(BI`💸 Dinheiro insuficiente para ${LN(sp.name)}|💸 Not enough money for a ${LN(sp.name)}`, 'bad'); return; }
      if (shopEncId && enclosures.has(shopEncId)) { buyFor(sp, enclosures.get(shopEncId)); closeModal(); }
      else { setTool({ cat: 'animal', key: 'sp' + sp.id, sp, em: '🐾', n: LN(sp.name), cost: sp.price }); closeModal(); }
    };
    grid.appendChild(card);
    shopObserver.observe(card);
  }
}
function buyFor(sp, e) {
  const notice = checkEnclosure(sp, e);
  if (notice.bloqueia) { toast('🚫 ' + notice.msg, 'bad'); return false; }
  if (G.money < sp.price) { toast('💸 Dinheiro insuficiente', 'bad'); return false; }
  spend(sp.price, 'buy');
  const a = newAnimal(sp, e.id);
  e.animals.push(a);
  undoRecord({ kind: 'animal', cat: 'buy', id: a.id, cost: sp.price, label: LN(sp.name) });
  toast(BI`🎉 ${LN(sp.name)} chegou ao ${e.name}!|🎉 A ${LN(sp.name)} arrived at ${e.name}!`, 'good');
  if (notice.msg) toast('⚠️ ' + notice.msg, 'bad');
  return true;
}
function checkEnclosure(sp, e) {
  const F = FENCES[e.fence];
  const kin = e.animals.filter(z => z.sp.id === sp.id).length;
  const outras = new Set(e.animals.map(z => z.sp.id)); outras.delete(sp.id);
  if (outras.size > 0) {
    const carnivoro = sp.diet === 'carn' || e.animals.some(z => z.diet === 'carn');
    if (carnivoro) return { bloqueia: true, msg: LN('Não dá para misturar carnívoros com outras espécies nesse recinto.|You cannot mix carnivores with other species in that enclosure.') };
  }
  if (encArea(e) < sp.space) return { bloqueia: true, msg: BI`${LN(sp.name)} precisa de ${sp.space} tiles e o recinto só tem ${encArea(e)}.|A ${LN(sp.name)} needs ${sp.space} tiles and the enclosure only has ${encArea(e)}.` };
  if (encArea(e) < sp.space * (kin + 1)) return { bloqueia: false, msg: 'O recinto vai ficar tight — a felicidade cai.' };
  if (sp.danger > F.strength) return { bloqueia: false, msg: BI`${LN(FENCES[e.fence].n)} é fraca demais: risco de fuga.|${LN(FENCES[e.fence].n)} is too weak: escape risk.` };
  if (sp.flies && !F.aviary) return { bloqueia: false, msg: LN('Ave sem tela de aviário fica infeliz e pode escapar.|A bird without aviary mesh is unhappy and may escape.') };
  if (sp.aquatic && !F.aquarium) return { bloqueia: false, msg: LN('Espécie aquática pede vidro de aquário.|An aquatic species needs aquarium glass.') };
  if (terrainScore(e, sp) < .35) return { bloqueia: false, msg: BI`Terreno não combina com o bioma ${LN(sp.biomeName)}.|The terrain does not match the ${LN(sp.biomeName)} biome.` };
  return { bloqueia: false, msg: null };
}

/* ---- inspetor ---- */
function bar(label, v, col, extra, key) {
  const p = Math.round(clamp(v, 0, 1) * 100);
  return `<div class="barRow"${key ? ` data-bar="${key}"` : ''}>
    <label><span>${label}</span><span data-v>${extra !== undefined ? extra : p + '%'}</span></label>
    <div class="bar"><i style="width:${p}%;background:${col}"></i></div></div>`;
}
/** updates an existing gauge without rebuilding the DOM around it */
function setBar(key, v, col, extra) {
  const row = UI.insp.querySelector(`[data-bar="${key}"]`);
  if (!row) return;
  const p = Math.round(clamp(v, 0, 1) * 100);
  const i = row.querySelector('i');
  i.style.width = p + '%'; i.style.background = col;
  row.querySelector('[data-v]').textContent = extra !== undefined ? extra : p + '%';
}
const colourFor = v => v > .66 ? '#4fae4a' : v > .33 ? '#ffc23c' : '#e2543f';

function select(kind, ref) {
  G.sel = { kind, ref };
  if (singlePanel()) closePalette();
  showInspector();
}
function deselect() { G.sel = null; UI.insp.classList.remove('show'); zoomBtnsVisiveis(true); refreshMinimap(); }
/** the inspector lives on the same side as the zoom buttons in every layout */
function zoomBtnsVisiveis(v) { $('#zoomBtns').classList.toggle('tapado', !v); }
/** Minimap: `G.wantsMinimap` is the player's wish; whether it shows also depends on
 *  not colliding — in drawer mode the footer is contested by dock, palette and
 *  inspector, and the map is last in the queue. */
function refreshMinimap() {
  const conflita = layoutModo() === 'drawer' &&
    (!!G.sel || UI.pal.classList.contains('show'));
  $('#mini').classList.toggle('show', !!G.wantsMinimap && !conflita);
}
function showInspector() {
  const s = G.sel;
  if (!s) { UI.insp.classList.remove('show'); zoomBtnsVisiveis(true); refreshMinimap(); return; }
  UI.insp.classList.add('show');
  zoomBtnsVisiveis(false);
  refreshMinimap();
  if (s.kind === 'enc') inspEnclosure(s.ref);
  else if (s.kind === 'animal') inspectAnimal(s.ref);
  else if (s.kind === 'obj') inspObject(s.ref);
  else if (s.kind === 'staff') inspStaff(s.ref);
  else if (s.kind === 'vis') inspVisitor(s.ref);
}
/** a signature of what forces a panel rebuild (the rest is just values to update) */
const encSig = e => [e.name, e.fence, e.tiles.size,
  e.animals.filter(a => !a.dead).map(a => a.id).join(','),
  e.objs.map(o => o.kind).join(',')].join('|');
/** the terrain composition as tags — it changes with every stroke, so it is
 *  updated on refresh instead of frozen into the opening HTML */
const encMixHTML = e => Object.entries(encMix(e)).sort((a, b) => b[1] - a[1]).slice(0, 5)
  .map(([k, v]) => `<span class="tag">${TERRAIN[k].em} ${LN(TERRAIN[k].n)} ${Math.round(v * 100)}%</span>`).join('');
function encAlertsHTML(e) {
  const F = FENCES[e.fence];
  const vivos = e.animals.filter(a => !a.dead);
  const sp0 = vivos[0] ? vivos[0].sp : null;
  const alerts = [];
  if (!encHasFeeder(e) && vivos.length) alerts.push(['bad', '🥣 Sem comedouro']);
  if (!encHasWater(e) && vivos.length) alerts.push(['bad', '🚰 Sem bebedouro']);
  if (e.cleanliness < .4) alerts.push(['bad', '💩 Sujo']);
  if (encEnrich(e) < .3 && vivos.length) alerts.push(['warn', '🎾 Pouco enriquecimento']);
  if (sp0 && sp0.danger > F.strength) alerts.push(['bad', '⚠️ Cerca fraca']);
  if (!encViewSpots(e).length) alerts.push(['warn', LN('👀 Sem trilha ao redor — ninguém vê|👀 No path around it — nobody sees in')]);
  if (!alerts.length && vivos.length) alerts.push(['ok', LN('✅ Tudo em ordem|✅ All in order')]);
  return alerts.map(([c, t]) => `<span class="tag ${c}">${t}</span>`).join('');
}
function inspEnclosure(e) {
  if (!enclosures.has(e.id)) { deselect(); return; }
  const F = FENCES[e.fence];
  const vivos = e.animals.filter(a => !a.dead);
  const felic = vivos.length ? vivos.reduce((s, a) => s + a.happy, 0) / vivos.length : 0;
  const sp0 = vivos[0] ? vivos[0].sp : null;
  const ts = sp0 ? terrainScore(e, sp0) : null;
  UI.insp.dataset.sig = encSig(e);

  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:26px">${sp0 ? BIOMES[sp0.biome].em : '🚧'}</div>
      <div><h3>${esc(e.name)}</h3><div class="sub">${F.em} ${F.n} · ${encArea(e)} tiles · cerca de ${encSegCount(e)} trechos</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline" id="iAlerts">${encAlertsHTML(e)}</div>
    ${bar(LN('Felicidade média|Average happiness'), felic, colourFor(felic), undefined, 'felic')}
    ${bar('Limpeza', e.cleanliness, colourFor(e.cleanliness), undefined, 'limp')}
    ${bar(LN('Comida no cocho|Food in the feeder'), e.food, colourFor(e.food), undefined, 'food')}
    ${bar(LN('Água|Water'), e.water, colourFor(e.water), undefined, 'water')}
    ${bar('Enriquecimento', encEnrich(e), colourFor(encEnrich(e)), undefined, 'enr')}
    ${ts !== null ? bar(LN('Terreno x bioma|Terrain vs biome') + ' (' + LN(sp0.biomeName) + ')', ts, colourFor(ts), undefined, 'terr') : ''}
    <h4 class="sec">Terreno</h4><div class="tagline" id="iMix">${encMixHTML(e)}</div>
    ${sp0 ? `<div style="font-size:11px;opacity:.7;margin-top:4px">Ideal: ${Object.entries(sp0.mix).map(([k, v]) => `${TERRAIN[k].em}${Math.round(v * 100)}%`).join(' · ')}</div>` : ''}
    <h4 class="sec">Animais (${vivos.length})</h4>
    <div id="ilist">${vivos.length ? vivos.map(a => `
      <div class="kv" data-a="${a.id}" style="cursor:pointer">
        <span>${a.sick ? '🤒 ' : ''}${esc(a.name)} <small style="opacity:.6">${a.sex === 'M' ? '♂' : '♀'} ${esc(LN(a.sp.name))}, ${a.age.toFixed(1)}a</small></span>
        <b style="color:${colourFor(a.happy)}">${Math.round(a.happy * 100)}%</b>
      </div>`).join('') : '<div style="font-size:12px;opacity:.6">Recinto vazio.</div>'}</div>
    <h4 class="sec">Objetos (${e.objs.length})</h4>
    <div class="tagline">${e.objs.length ? e.objs.map(o => `<span class="tag">${ENCOBJ[o.kind].em} ${LN(ENCOBJ[o.kind].n)}</span>`).join('') : `<span style="font-size:12px;opacity:.6">${LN('Nenhum|None')}</span>`}</div>
    <div class="rowbtns">
      <button class="btn g sm" id="ibuy">🦁 Comprar animal</button>
      <button class="btn b sm" id="igrow">➕ Ampliar</button>
      <button class="btn sm" id="iobj">🥣 Objetos</button>
      <button class="btn sm" id="ipaint">🎨 Terreno</button>
      <button class="btn sm" id="iren">✏️ Renomear</button>
      <button class="btn sm" id="ifence">🚧 Trocar cerca</button>
      <button class="btn r sm" id="idel">🔨 Demolir</button>
    </div>`;
  $('#ix').onclick = deselect;
  $('#ibuy').onclick = () => openShop(e.id);
  $('#igrow').onclick = () => {
    // hands over the tool already carrying this enclosure's fence type
    setTool({ cat: 'enclosure', key: e.fence, em: FENCES[e.fence].em, n: 'Ampliar ' + e.name,
              cost: FENCES[e.fence].cost, ampliando: e.id });
    if (singlePanel()) deselect();
  };
  $('#iobj').onclick = () => { openCategory('encobj'); };
  $('#ipaint').onclick = () => { openCategory('terrain'); };
  $('#iren').onclick = () => {
    const n = prompt(LN('Nome do recinto:|Enclosure name:'), e.name);
    if (n) { e.name = n.slice(0, 28); showInspector(); }
  };
  $('#ifence').onclick = () => swapFence(e);
  $('#idel').onclick = () => {
    if (e.animals.length) { toast(LN('🚫 Venda ou mova os animais antes de demolir|🚫 Sell or move the animals before demolishing'), 'bad'); return; }
    const dev = Math.round(fenceCostOf(e) * .5);
    deleteEnclosure(e.id); earn(dev, 'sell'); deselect();
    toast('🔨 Recinto demolido (+' + moneyFull(dev) + ')', 'money');
  };
  $$('#ilist .kv').forEach(d => d.onclick = () => {
    const a = G.animals.find(z => z.id === +d.dataset.a); if (a) select('animal', a);
  });
}
function swapFence(e) {
  const opts = Object.keys(FENCES).map(k => {
    const F = FENCES[k], cost = encSegCount(e) * F.cost - Math.round(fenceCostOf(e) * .4);
    return `<div class="pitem" data-f="${k}" style="width:118px">
      <span class="em">${F.em}</span>${LN(F.n)}<span class="pr">${moneyFull(Math.max(0, cost))}</span>
      <span class="pr">${BI`força ${F.strength} · visão ${Math.round(F.sight * 100)}%|strength ${F.strength} · visibility ${Math.round(F.sight * 100)}%`}</span></div>`;
  }).join('');
  openModal(LN('Trocar cerca — |Change fence — ') + e.name,
    `<div style="display:flex;gap:8px;flex-wrap:wrap">${opts}</div>
     <p style="font-size:12px;opacity:.7;margin-top:10px">${LN('Você recebe 40% de volta da cerca atual. Força alta evita fugas; visão alta deixa os visitantes enxergarem melhor (e pagarem mais).|You get 40% back on the current fence. High strength stops escapes; high visibility lets visitors see better (and pay more).')}</p>`);
  $$('#modalBody .pitem').forEach(d => d.onclick = () => {
    const k = d.dataset.f;
    const cost = Math.max(0, encSegCount(e) * FENCES[k].cost - Math.round(fenceCostOf(e) * .4));
    if (G.money < cost) { toast(LN('💸 Dinheiro insuficiente|💸 Not enough money'), 'bad'); return; }
    const before = e.fence;
    spend(cost, 'build'); e.fence = k; e.integrity = 1;
    undoRecord({ kind: 'fence', cat: 'build', id: e.id, before, after: k, cost });
    closeModal(); showInspector(); toast(BI`🚧 Cerca trocada para ${LN(FENCES[k].n)}|🚧 Fence changed to ${LN(FENCES[k].n)}`, 'good');
  });
}
const scoreHTML = p => p.items.map(([n, v, w]) =>
  `<div class="kv"><span>${n} <small style="opacity:.5">peso ${Math.round(w * 100)}%</small></span>
    <b style="color:${colourFor(v)}">${Math.round(v * 100)}%</b></div>`).join('');
const animalEstado = a => a.escaped ? '🚨 FUGIU' : a.sick ? '🤒 Doente'
  : a.state === 'eating' ? '🍽️ Comendo' : a.state === 'walking' ? '🚶 Andando' : '😴 Descansando';
const animalSig = a => [a.id, a.enc, a.sick ? 1 : 0, a.pregnant > 0 ? 1 : 0].join('|');

function inspectAnimal(a) {
  if (a.dead) { deselect(); return; }
  const sp = a.sp, p = animalScore(a);
  const e = enclosures.get(a.enc);
  const cv2 = spriteThumb(sp, 46, 46);
  const est = animalEstado(a);
  const pa = a.thought = animalThought(a);
  UI.insp.dataset.sig = animalSig(a);
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" id="iav"></div>
      <div><h3>${esc(a.name)} <small style="font-size:12px">${a.sex === 'M' ? '♂' : '♀'}</small></h3>
        <div class="sub">${esc(LN(sp.name))}</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline">
      <span class="tag" id="iEstado">${est}</span>
      <span class="tag ${pa.urg >= .8 ? 'bad' : pa.urg >= .45 ? 'warn' : 'ok'}" id="iPensa">${pa.em} ${esc(pa.txt)}</span>
      <span class="tag">${BIOMES[sp.biome].em} ${LN(sp.biomeName)}</span>
      <span class="tag">${DIETS[sp.diet].em} ${LN(sp.dietName)}</span>
      ${a.pregnant > 0 ? '<span class="tag ok">🤰 Gestante</span>' : ''}
    </div>
    ${bar('Felicidade', a.happy, colourFor(a.happy), undefined, 'feliz')}
    ${bar(LN('Saúde|Health'), a.health, colourFor(a.health), undefined, 'health')}
    ${bar('Fome', 1 - a.hunger, colourFor(1 - a.hunger), undefined, 'hunger')}
    ${bar('Sede', 1 - a.thirst, colourFor(1 - a.thirst), undefined, 'thirst')}
    ${bar(LN('Idade|Age'), a.age / sp.lifespan, a.age / sp.lifespan > .85 ? '#e2543f' : '#9a6ad4', a.age.toFixed(1) + ' / ' + sp.lifespan + LN(' anos| years'), 'age')}
    <h4 class="sec">${LN('De onde vem a felicidade|Where the happiness comes from')}</h4>
    <div id="iPontos">${scoreHTML(p)}</div>
    <h4 class="sec">${LN('Ficha|Record')}</h4>
    <div class="kv"><span>${LN('Recinto|Enclosure')}</span><b>${e ? esc(e.name) : '—'}</b></div>
    <div class="kv"><span>${LN('Espaço necessário|Space needed')}</span><b>${sp.space} tiles</b></div>
    <div class="kv"><span>${LN('Grupo ideal|Ideal group')}</span><b>${sp.groupMin}–${sp.groupMax}</b></div>
    <div class="kv"><span>${LN('Ração|Feed')}</span><b>${BI`${moneyFull(sp.feed)}/dia|${moneyFull(sp.feed)}/day`}</b></div>
    <div class="kv"><span>${LN('Popularidade|Popularity')}</span><b class="stars">${stars(sp.appeal / 2)}</b></div>
    <div class="kv"><span>${LN('Valor de revenda|Resale value')}</span><b>${moneyFull(resaleValue(a))}</b></div>
    <div class="rowbtns">
      <button class="btn sm" id="ivoz">🔊 Ouvir</button>
      <button class="btn sm" id="igo">🎯 Centralizar</button>
      <button class="btn sm" id="isell">💰 Vender</button>
      <button class="btn sm" id="imove">📦 Transferir</button>
    </div>`;
  $('#iav').appendChild(cv2);
  $('#ix').onclick = deselect;
  $('#ivoz').onclick = () => { SFX.start(); SFX.voz(sp, { vol: .32, now: true }); };
  $('#igo').onclick = () => centerOn(a.x, a.y);
  $('#isell').onclick = () => {
    const v = resaleValue(a);
    if (!confirm(`Vender ${a.name} (${LN(sp.name)}) por ${moneyFull(v)}?`)) return;
    earn(v, 'sell'); a.dead = true;
    if (e) e.animals = e.animals.filter(z => z.id !== a.id);
    G.animals = G.animals.filter(z => z.id !== a.id);
    deselect(); toast('💰 ' + LN(sp.name) + ' vendido por ' + moneyFull(v), 'money');
  };
  $('#imove').onclick = () => transferir(a);
}
const resaleValue = a => Math.round(a.sp.price * clamp(1.05 - a.age / a.sp.lifespan * .6, .25, 1) * (.5 + a.health * .5) * .72);
function transferir(a) {
  const opts = [...enclosures.values()].filter(e => e.id !== a.enc).map(e => {
    const chk = checkEnclosure(a.sp, e);
    return `<div class="pitem" data-e="${e.id}" style="width:auto;min-width:150px;text-align:left;padding:8px 10px;${chk.bloqueia ? 'opacity:.45' : ''}">
      <b>${esc(e.name)}</b><br><span class="pr">${FENCES[e.fence].n} · ${encArea(e)} tiles · ${e.animals.length} animais</span>
      <br><span class="pr" style="color:${chk.bloqueia ? '#bd3f2d' : chk.msg ? '#c98a1c' : '#3b8c38'}">${chk.bloqueia ? '🚫 ' + chk.msg : chk.msg ? '⚠️ ' + chk.msg : '✅ Combina bem'}</span></div>`;
  }).join('');
  openModal(LN('Transferir |Transfer ') + a.name, opts || `<p>${LN('Não há outro recinto construído.|There is no other enclosure built.')}</p>`);
  $$('#modalBody .pitem').forEach(d => d.onclick = () => {
    const e2 = enclosures.get(+d.dataset.e);
    const chk = checkEnclosure(a.sp, e2);
    if (chk.bloqueia) { toast('🚫 ' + chk.msg, 'bad'); return; }
    const e1 = enclosures.get(a.enc);
    if (e1) e1.animals = e1.animals.filter(z => z.id !== a.id);
    e2.animals.push(a); a.enc = e2.id;
    const t = encRandomTile(e2); if (t) { a.x = t[0] + .5; a.y = t[1] + .5; a.tx = a.x; a.ty = a.y; }
    closeModal(); showInspector(); toast(BI`📦 ${a.name} foi para ${e2.name}|📦 ${a.name} moved to ${e2.name}`, 'good');
  });
}
/** The inspector's periodic refresh: it touches the VALUES only.
 *  Rebuilding the panel with innerHTML every 200ms swapped the buttons'
 *  identity mid-tap — mousedown landed on the old button, mouseup on the new
 *  one, and the browser produced no `click`. That was the "I have to click
 *  several times". */
function refreshInspector() {
  const s = G.sel;
  if (!s) return;
  if (s.kind === 'enc') {
    const e = s.ref;
    if (!enclosures.has(e.id)) { deselect(); return; }
    if (UI.insp.dataset.sig !== encSig(e)) { showInspector(); return; }
    const vivos = e.animals.filter(a => !a.dead);
    const felic = vivos.length ? vivos.reduce((x, a) => x + a.happy, 0) / vivos.length : 0;
    setBar('felic', felic, colourFor(felic));
    setBar('limp', e.cleanliness, colourFor(e.cleanliness));
    setBar('food', e.food, colourFor(e.food));
    setBar('water', e.water, colourFor(e.water));
    const enr = encEnrich(e); setBar('enr', enr, colourFor(enr));
    if (vivos[0]) { const t = terrainScore(e, vivos[0].sp); setBar('terr', t, colourFor(t)); }
    const al = $('#iAlerts'); if (al) al.innerHTML = encAlertsHTML(e);
    const mx = $('#iMix'); if (mx) mx.innerHTML = encMixHTML(e);
    for (const row of UI.insp.querySelectorAll('#ilist .kv')) {
      const a = vivos.find(z => z.id === +row.dataset.a); if (!a) continue;
      const b = row.querySelector('b');
      b.textContent = Math.round(a.happy * 100) + '%'; b.style.color = colourFor(a.happy);
    }
  } else if (s.kind === 'animal') {
    const a = s.ref;
    if (a.dead) { deselect(); return; }
    if (UI.insp.dataset.sig !== animalSig(a)) { showInspector(); return; }
    setBar('feliz', a.happy, colourFor(a.happy));
    setBar('health', a.health, colourFor(a.health));
    setBar('hunger', 1 - a.hunger, colourFor(1 - a.hunger));
    setBar('thirst', 1 - a.thirst, colourFor(1 - a.thirst));
    setBar('age', a.age / a.sp.lifespan, a.age / a.sp.lifespan > .85 ? '#e2543f' : '#9a6ad4',
      a.age.toFixed(1) + ' / ' + a.sp.lifespan + ' anos');
    const est = $('#iEstado'); if (est) est.textContent = animalEstado(a);
    const pa = a.thought = animalThought(a);
    const tp = $('#iPensa');
    if (tp) {
      tp.textContent = pa.em + ' ' + pa.txt;
      tp.className = 'tag ' + (pa.urg >= .8 ? 'bad' : pa.urg >= .45 ? 'warn' : 'ok');
    }
    const pts = $('#iPontos'); if (pts) pts.innerHTML = scoreHTML(animalScore(a));
  } else if (s.kind === 'vis') {
    const v = s.ref;
    if (!G.visitors.includes(v)) { deselect(); return; }
    if (UI.insp.dataset.sig !== visitorSignature(v)) { showInspector(); return; }
    setBar('mood', v.mood, colourFor(v.mood));
    for (const k in NEED_INFO) setBar('n_' + k, 1 - v.need[k], colourFor(1 - v.need[k]));
    // recompute while the card is open: the cache lags by up to ~2s and kept
    // contradicting the gauges (it said "dying of thirst" with thirst full)
    const p = v.thought = visitorThought(v);
    const est = $('#iEstado');
    if (est && p) {
      est.textContent = p.em + ' ' + p.txt;
      est.className = 'tag ' + (p.urg >= .8 ? 'bad' : p.urg >= .45 ? 'warn' : 'ok');
    }
    const din = $('#iDin'); if (din) din.textContent = moneyFull(v.money);
    const viu = $('#iViu'); if (viu) viu.textContent = v.seen.size;
  }
}
function inspObject(o) {
  if (!objects.has(o.id)) { deselect(); return; }
  const B = BUILDINGS[o.kind] || DECOS[o.kind] || ENCOBJ[o.kind];
  const isShop = o.cat === 'build' && BUILDINGS[o.kind].value > 0;
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:26px">${B.em}</div>
      <div><h3>${B.n}</h3><div class="sub">${o.w}×${o.h}${BUILDINGS[o.kind] ? ' · fila: ' + o.queue.length : ''}</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    ${isShop ? `
      <h4 class="sec">${LN('Preço de venda|Selling price')}</h4>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="range" id="ipr" min="0" max="250" value="${Math.round((o.mult === undefined ? 1 : o.mult) * 100)}" style="flex:1">
        <b id="iprv" style="min-width:64px;text-align:right">${moneyFull(priceOf(o))}</b>
      </div>
      <div style="font-size:11px;opacity:.65;margin-top:3px">${BI`Custo por unidade: ${moneyFull(BUILDINGS[o.kind].unitCost)}. Preço de referência: ${moneyFull(BUILDINGS[o.kind].value)}. Cobrar muito acima irrita os visitantes.|Cost per unit: ${moneyFull(BUILDINGS[o.kind].unitCost)}. Reference price: ${moneyFull(BUILDINGS[o.kind].value)}. Charging well above it annoys the visitors.`}</div>
      <div class="kv"><span>${LN('Vendas totais|Total sales')}</span><b>${o.sales}</b></div>
      <div class="kv"><span>${LN('Lucro acumulado|Profit to date')}</span><b class="${o.revenue >= 0 ? 'pos' : 'negv'}">${moneyFull(o.revenue)}</b></div>` : ''}
    ${BUILDINGS[o.kind] ? `<div class="kv"><span>${LN('Salário/semana|Wage/week')}</span><b>${moneyFull(BUILDINGS[o.kind].wage)}</b></div>` : ''}
    ${BUILDINGS[o.kind] && BUILDINGS[o.kind].supplies ? `<div class="kv"><span>${LN('Atende|Serves')}</span><b>${LN(NEED_NAMES[BUILDINGS[o.kind].supplies] || BUILDINGS[o.kind].supplies)}</b></div>` : ''}
    ${DECOS[o.kind] ? `<div class="kv"><span>${LN('Beleza|Beauty')}</span><b>${BI`+${DECOS[o.kind].beauty} (raio ${DECOS[o.kind].r})|+${DECOS[o.kind].beauty} (radius ${DECOS[o.kind].r})`}</b></div>` : ''}
    <div class="rowbtns"><button class="btn r sm" id="idel">🔨 Remover (+${moneyFull(Math.round((B.cost || 0) * .5))})</button></div>`;
  $('#ix').onclick = deselect;
  $('#idel').onclick = () => { earn(Math.round((B.cost || 0) * .5), 'sell'); removeObject(o.id); deselect(); };
  if (isShop) {
    const r = $('#ipr');
    r.oninput = () => { o.mult = r.value / 100; $('#iprv').textContent = moneyFull(priceOf(o)); };
  }
}
function inspStaff(s) {
  const T = STAFF_TYPES[s.kind];
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:26px">${T.em}</div>
      <div><h3>${T.n}</h3><div class="sub">${T.desc}</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="kv"><span>${LN('Salário|Wage')}</span><b>${BI`${moneyFull(T.wage)}/semana|${moneyFull(T.wage)}/week`}</b></div>
    <div class="kv"><span>${LN('Tarefas concluídas|Tasks done')}</span><b>${s.done}</b></div>
    <div class="kv"><span>${LN('Fazendo agora|Doing right now')}</span><b>${s.task ? ({ enc: LN('Cuidando de recinto|Tending an enclosure'), animal: LN('Tratando animal|Treating an animal'), litter: LN('Recolhendo lixo|Picking up litter'), fuga: LN('Recapturando fuga|Chasing an escapee') })[s.task.kind] : LN('Patrulhando|Patrolling')}</b></div>
    <div class="rowbtns">
      <button class="btn sm" id="ivoz">${LN('🔊 Ouvir|🔊 Listen')}</button>
      <button class="btn sm" id="igo">${LN('🎯 Centralizar|🎯 Centre')}</button>
      <button class="btn r sm" id="ifire">${LN('👋 Demitir|👋 Fire')}</button>
    </div>`;
  $('#ix').onclick = deselect;
  $('#ivoz').onclick = () => { SFX.start(); SFX.humanVoice(s, { vol: .3, now: true }); };
  $('#igo').onclick = () => centerOn(s.x, s.y);
  $('#ifire').onclick = () => {
    G.staff = G.staff.filter(z => z.id !== s.id); deselect();
    toast(BI`👋 ${LN(T.n)} demitido|👋 ${LN(T.n)} let go`, '');
  };
}

/* ---- the staff panel ---- */
function openStaff() {
  const cont = Object.keys(STAFF_TYPES).map(k => {
    const T = STAFF_TYPES[k], n = G.staff.filter(s => s.kind === k).length;
    // Do NOT use data-t here: it is slopkit's dictionary attribute, and bindText
    // would overwrite the whole card's textContent on a language change.
    return `<div class="pitem" data-staff="${k}" style="width:auto;min-width:210px;text-align:left;padding:10px 12px">
      <span class="em">${T.em}</span><b>${LN(T.n)}</b> <span style="float:right">${n} ${LN('contratados|hired')}</span>
      <div class="pr" style="margin-top:3px">${LN(T.desc)}</div>
      <div class="pr">${BI`Salário: ${moneyFull(T.wage)}/semana|Wage: ${moneyFull(T.wage)}/week`}</div>
      <button class="btn g sm" style="margin-top:7px" data-hire="${k}">${LN('+ Contratar|+ Hire')}</button>
      <button class="btn r sm" style="margin-top:7px" data-fire="${k}" ${n ? '' : 'disabled'}>${LN('− Demitir|− Fire')}</button>
    </div>`;
  }).join('');
  const payroll = G.staff.reduce((s, x) => s + STAFF_TYPES[x.kind].wage, 0)
    + [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].wage : 0), 0);
  openModal(LN('Equipe do zoológico|Zoo staff'),
    `<div style="display:flex;gap:9px;flex-wrap:wrap">${cont}</div>
     <p style="font-size:12px;opacity:.75;margin-top:12px">${LN('Sem <b>tratador</b> os animais passam fome e o recinto fica sujo. Sem <b>veterinário</b> doença vira morte. Sem <b>faxineiro</b> o lixo acumula e irrita os visitantes. Sem <b>segurança</b> uma fuga não é resolvida.|With no <b>keeper</b> the animals go hungry and the enclosure gets filthy. With no <b>vet</b> illness turns into death. With no <b>cleaner</b> litter piles up and annoys the visitors. With no <b>security</b> an escape never gets resolved.')}</p>`,
    `<b>${BI`Folha semanal total: ${moneyFull(payroll)}|Total weekly payroll: ${moneyFull(payroll)}`}</b> <span style="font-size:12px;opacity:.6">${LN('(inclui atendentes das lojas)|(includes shop attendants)')}</span>`);
  $$('[data-hire]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const k = b.dataset.hire, T = STAFF_TYPES[k];
    if (G.money < T.wage) { toast(LN('💸 Sem caixa para o primeiro salário|💸 Not enough cash for the first wage'), 'bad'); return; }
    hire(k); toast('🤝 ' + T.n + ' contratado', 'good'); openStaff();
  });
  $$('[data-fire]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const k = b.dataset.fire;
    const i = G.staff.findIndex(s => s.kind === k);
    if (i >= 0) { G.staff.splice(i, 1); openStaff(); }
  });
}

/* ---- finance ---- */
function openFinance() {
  const L = G.ledger;
  const row = (n, v, neg) => `<tr><td>${n}</td><td class="n ${v ? (neg ? 'negv' : 'pos') : ''}">${neg ? '-' : '+'}${moneyFull(v)}</td></tr>`;
  const weeklyPayroll = G.staff.reduce((s, x) => s + STAFF_TYPES[x.kind].wage, 0)
    + [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].wage : 0), 0);
  const dailyFeed = G.animals.filter(a => !a.dead).reduce((s, a) => s + a.sp.feed, 0);
  const hist = L.hist.slice(-10).reverse();
  const diag = crowdDiagnosis();
  openModal(LN('Finanças|Finance'),
    (diag ? `<div style="display:flex;gap:9px;align-items:center;margin-bottom:13px;padding:10px 12px;
        background:linear-gradient(#ffdcd4,#ffbdae);border:3px solid var(--ink);border-radius:13px;font-size:13px;line-height:1.4">
        <span style="font-size:21px;flex:none">${diag.em}</span><span>${diag.long}</span></div>` : '') +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h4 class="sec" style="margin-top:0">${BI`Hoje (dia ${G.day})|Today (day ${G.day})`}</h4>
        <table class="fin">
          ${row(LN('Ingressos|Tickets'), L.today.ticket)}
          ${row(LN('Lojas e restaurantes|Shops and restaurants'), L.today.shop)}
          ${row(LN('Venda de animais|Animal sales'), L.today.sell)}
          ${row(LN('Ração e insumos|Feed and supplies'), L.today.feed, 1)}
          ${row(LN('Salários|Wages'), L.today.wage, 1)}
          ${row(LN('Manutenção e veterinário|Upkeep and vet'), L.today.upkeep, 1)}
          ${row(LN('Compra de animais|Animal purchases'), L.today.buy, 1)}
          ${row(LN('Obras|Construction'), L.today.build, 1)}
          <tr><th>${LN('Saldo do dia|Balance for the day')}</th><th class="n ${balance(L.today) >= 0 ? 'pos' : 'negv'}">${moneyFull(balance(L.today))}</th></tr>
        </table>
        <h4 class="sec">${LN('Compromissos fixos|Standing commitments')}</h4>
        <table class="fin">
          <tr><td>${LN('Folha salarial|Payroll')}</td><td class="n">${BI`${moneyFull(weeklyPayroll)}/semana|${moneyFull(weeklyPayroll)}/week`}</td></tr>
          <tr><td>${LN('Ração dos animais|Animal feed')}</td><td class="n">${BI`${moneyFull(dailyFeed)}/dia|${moneyFull(dailyFeed)}/day`}</td></tr>
          <tr><td>${LN('Empréstimo em aberto|Outstanding loan')}</td><td class="n">${moneyFull(G.loan)}</td></tr>
        </table>
      </div>
      <div>
        <h4 class="sec" style="margin-top:0">${LN('Preço do ingresso|Ticket price')}</h4>
        <div style="display:flex;align-items:center;gap:9px">
          <input type="range" id="fTicket" min="0" max="${
    // the ceiling follows the zoo: you can always go well past the reference price
    Math.max(140, Math.ceil(fairPrice() * 1.8 / 10) * 10, Math.ceil(G.ticket / 10) * 10)
    }" value="${G.ticket}" style="flex:1">
          <b id="fTicketV" style="min-width:70px;text-align:right">${moneyFull(G.ticket)}</b>
        </div>
        <div id="fTicketHint" style="font-size:11.5px;opacity:.7;margin-top:4px"></div>
        <h4 class="sec">Marketing</h4>
        <div style="font-size:12px;opacity:.75;margin-bottom:6px">${LN('Campanha semanal atrai mais visitantes enquanto estiver ativa.|A weekly campaign pulls in more visitors for as long as it runs.')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[[0, 'Nenhum|None'], [1, 'Local|Local'], [2, 'Regional|Regional'], [3, 'Nacional|National']].map(([i, n]) =>
    `<button class="btn sm ${G.research.marketing === i ? 'on' : ''}" data-mk="${i}">${LN(n)} · ${BI`${moneyFull(MARKETING_COST[i])}/sem|${moneyFull(MARKETING_COST[i])}/wk`}</button>`).join('')}
        </div>
        <h4 class="sec">${LN('Empréstimo|Loan')}</h4>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn b sm" data-loan="50000">${BI`Pegar ${moneyFull(50000)}|Borrow ${moneyFull(50000)}`}</button>
          <button class="btn b sm" data-loan="150000">${BI`Pegar ${moneyFull(150000)}|Borrow ${moneyFull(150000)}`}</button>
          <button class="btn g sm" data-pay="1">${LN('Quitar tudo|Pay it all off')}</button>
        </div>
        <div style="font-size:11.5px;opacity:.7;margin-top:5px">${LN('Juros de 0,4% ao dia sobre o saldo devedor.|Interest of 0.4% a day on the outstanding balance.')}</div>
        <h4 class="sec">${LN('Últimos dias|Recent days')}</h4>
        <table class="fin"><tr><th>${LN('Dia|Day')}</th><th class="n">${LN('Visitantes|Visitors')}</th><th class="n">${LN('Saldo|Balance')}</th></tr>
        ${hist.map(h => `<tr><td>${h.day}</td><td class="n">${h.vis}</td><td class="n ${h.balance >= 0 ? 'pos' : 'negv'}">${moneyFull(h.balance)}</td></tr>`).join('') || `<tr><td colspan="3" style="opacity:.6">${LN('Ainda não fechou um dia|No day has closed yet')}</td></tr>`}
        </table>
      </div>
    </div>`,
    `<b>${LN('Caixa|Cash')}: <span class="${G.money >= 0 ? 'pos' : 'negv'}">${moneyFull(G.money)}</span></b>
     <span style="margin-left:auto;font-size:12px;opacity:.7">${BI`Reputação ${G.rep.toFixed(1)}★ · ${G.animals.filter(a => !a.dead).length} animais · ${enclosures.size} recintos|Reputation ${G.rep.toFixed(1)}★ · ${G.animals.filter(a => !a.dead).length} animals · ${enclosures.size} enclosures`}</span>`);
  const r = $('#fTicket'), rv = $('#fTicketV'), rh = $('#fTicketHint');
  const upd = () => {
    G.ticket = +r.value; rv.textContent = moneyFull(G.ticket);
    const just = fairPrice();
    rh.innerHTML = G.ticket > just * 1.35 ? LN('🔴 Caro demais para o que o zoo oferece — muita gente vai desistir na porta.|🔴 Too dear for what the zoo offers — plenty will give up at the gate.')
      : G.ticket > just * 1.05 ? LN('🟡 Um pouco acima do que o público acha justo.|🟡 A little above what the public considers fair.')
        : G.ticket < just * .55 ? LN('🔵 Barato: lota o parque, mas você deixa dinheiro na mesa.|🔵 Cheap: it fills the park, but you leave money on the table.')
          : LN('🟢 Preço bem calibrado para as atrações atuais.|🟢 Well calibrated for the current attractions.');
    rh.innerHTML += BI` <span style="opacity:.6">(referência: ${moneyFull(just)})</span>| <span style="opacity:.6">(reference: ${moneyFull(just)})</span>`;
  };
  r.oninput = upd; upd();
  $$('[data-mk]').forEach(b => b.onclick = () => { G.research.marketing = +b.dataset.mk; openFinance(); });
  $$('[data-loan]').forEach(b => b.onclick = () => {
    const v = +b.dataset.loan; G.money += v; G.loan += v;
    toast(BI`🏦 Empréstimo de ${moneyFull(v)} liberado|🏦 Loan of ${moneyFull(v)} approved`, 'money'); openFinance();
  });
  $$('[data-pay]').forEach(b => b.onclick = () => {
    const v = Math.min(G.money, G.loan);
    if (v <= 0) { toast('Nada a quitar', ''); return; }
    G.money -= v; G.loan -= v; toast('🏦 Abatido ' + moneyFull(v), 'money'); openFinance();
  });
}
const balance = o => o.ticket + o.shop + o.sell - o.feed - o.wage - o.upkeep - o.buy - o.build;

/** Why has the box office stalled? Returns the first structural reason, in the
 *  order the player needs to solve them — or null if everything is fine.
 *  It exists because zero visitors with no explanation is indistinguishable
 *  from a bug. */
function crowdDiagnosis() {
  // `key` identifies the diagnosis regardless of language — the HUD compares
  // against it instead of against the translated headline
  const D = (em, short, long, key) => ({ em, short, long, key });
  const vivos = G.animals.filter(a => !a.dead && !a.escaped);
  if (!vivos.length)
    return D('🦁', LN('Sem animais|No animals'), LN('<b>Nenhum animal no zoológico.</b> Sem atração ninguém paga ingresso — compre bichos na aba Animais.|<b>No animals in the zoo.</b> With no attraction nobody pays for a ticket — buy some on the Animals tab.'), 'noanimals');
  if (!pathConnected(ENTRANCE.x, ENTRANCE.y))
    return D('🛣️', LN('Portão sem trilha|Gate with no path'), LN('<b>Nenhuma trilha ligada ao portão</b> (base do mapa). Sem caminho a partir da entrada, ninguém consegue entrar.|<b>No path connected to the gate</b> (bottom of the map). With no route from the entrance, nobody can get in.'), 'nopath');
  const visiveis = [...enclosures.values()]
    .filter(e => e.animals.some(a => !a.dead) && encViewSpots(e).length);
  if (!visiveis.length)
    return D('👀', LN('Recinto sem trilha ao lado|Enclosure with no path beside it'), LN('<b>Nenhum recinto tem trilha ao lado.</b> Passe um caminho encostado na cerca — os visitantes só veem o animal de cima da trilha.|<b>No enclosure has a path beside it.</b> Run a path against the fence — visitors only see an animal from the path.'), 'noview');
  const fair = fairPrice();
  if (G.ticket > fair * 1.4)
    return D('🎟️', LN('Ingresso caro demais|Ticket too expensive'), BI`<b>Ingresso de ${moneyFull(G.ticket)} está muito acima do que o público acha justo</b> (~${moneyFull(fair)}). A maioria desiste na porta.|<b>A ${moneyFull(G.ticket)} ticket is well above what the public considers fair</b> (~${moneyFull(fair)}). Most give up at the gate.`, 'pricey');
  if (G.hour < OPEN_H || G.hour >= CLOSE_H)
    return D('🌙', LN('Zoológico fechado|Zoo closed'), BI`O zoológico está fechado (abre às ${OPEN_H}h). Os visitantes voltam de manhã.|The zoo is closed (it opens at ${OPEN_H}:00). The visitors come back in the morning.`, 'closed');
  return null;
}
/** the ticket price the public considers fair, given the collection */
function fairPrice() {
  let v = 4;
  for (const e of enclosures.values()) {
    if (!encViewSpots(e).length) continue;
    const F = FENCES[e.fence];
    for (const a of e.animals) if (!a.dead) v += a.sp.draw * F.sight * (.4 + a.happy * .6) * .55;
  }
  v += [...objects.values()].filter(o => o.cat === 'build' && BUILDINGS[o.kind].supplies).length * .7;
  return Math.round(clamp(v, 4, 260));
}

/* ==========================================================================
   11b. THE SATISFACTION REPORT — where each complaint comes from
   ========================================================================== */
/** what to do about it, indexed by the thought's icon */
const TIPS = {
  '🚻': 'Construa Banheiros perto das trilhas movimentadas.|Build Restrooms near the busy paths.',
  '🥤': 'Um Quiosque de Bebidas ou Bebedouro resolve a sede.|A Drinks Kiosk or a Water Fountain settles the thirst.',
  '🍔': 'Falta comida: Lanchonete, Pizzaria ou Restaurante.|Food is missing: a Snack Bar, Pizzeria or Restaurant.',
  '🍟': 'Espalhe mais pontos de comida ao longo do percurso.|Spread more food stops along the route.',
  '😩': 'Bancos de Praça pelo caminho para o pessoal descansar.|Park Benches along the way so people can rest.',
  '🪑': 'Bancos de Praça reduzem o cansaço de caminhar.|Park Benches take the edge off all that walking.',
  '🤢': 'Contrate Faxineiros e ponha Lixeiras nas trilhas.|Hire Cleaners and put Bins along the paths.',
  '🥱': 'Mais animais de apelo alto, ou um Playground.|More high-appeal animals, or a Playground.',
  '💸': 'Baixe o ingresso em Finanças, ou acrescente atrações.|Lower the ticket in Finance, or add attractions.',
  '😱': 'Contrate Segurança e reforce a cerca do recinto.|Hire Security and strengthen the enclosure fence.',
  '😠': 'Veja os outros motivos da lista — algo está faltando.|Look at the other reasons in the list — something is missing.',
  '😐': 'Nada urgente, mas o parque não empolga: decore e diversifique.|Nothing urgent, but the park is dull: decorate and diversify.',
  '💧': 'Ponha Bebedouro no recinto e tenha um Tratador de plantão.|Put a Water Trough in the enclosure and keep a Keeper on duty.',
  '😖': 'Recinto apertado: amplie ou separe os animais.|Cramped enclosure: extend it or split the animals up.',
  '💩': 'Contrate mais Tratadores — eles limpam os recintos.|Hire more Keepers — they clean the enclosures.',
  '⚠️': LN('Troque por uma cerca mais forte (inspetor do recinto).|Swap in a stronger fence (enclosure inspector).'),
  '🤕': 'Contrate um Veterinário.|Hire a Vet.',
  '🤒': 'Contrate um Veterinário.|Hire a Vet.',
  '👥': 'Compre mais animais da mesma espécie.|Buy more animals of the same species.',
  '😤': 'Grupo grande demais: venda ou transfira alguns.|The group is too big: sell or transfer a few.',
  '🕸️': LN('Troque a cerca por Tela de Aviário.|Swap the fence for Aviary Mesh.'),
  '🌊': 'Troque a cerca por Vidro de Aquário.|Swap the fence for Aquarium Glass.',
  '🏃': 'Contrate Segurança para recapturar o animal.|Hire Security to recapture the animal.',
  '👴': 'Idade avançada — considere trazer animais mais jovens.|Old age — consider bringing in younger animals.',
};
for (const k in FOOD_EM) TIPS[FOOD_EM[k]] = LN('Ponha Comedouro no recinto e tenha um Tratador.|Put a Feeder in the enclosure and hire a Keeper.');
for (const k in BIOMES) TIPS[BIOMES[k].em] = LN('Pinte o terreno do recinto com o bioma pedido (aba Terreno).|Paint the enclosure terrain with the biome it asks for (Terrain tab).');

/** Counts a population's thoughts and returns a ranking.
 *  It computes on the spot for whoever hasn't got one yet: with the game paused
 *  or freshly loaded nobody has been through update, and the report came out
 *  empty with the park full. */
function groupThoughts(lista, fn) {
  const m = new Map();
  for (const ent of lista) {
    const p = ent.thought || (fn ? (ent.thought = fn(ent)) : null); if (!p) continue;
    const k = p.em + '|' + p.txt;
    const r = m.get(k) || { em: p.em, txt: p.txt, urg: p.urg, n: 0 };
    r.n++; m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.urg - a.urg || b.n - a.n);
}
function reasonRow(r, total) {
  const p = Math.round(r.n / Math.max(1, total) * 100);
  const col = r.urg >= .8 ? '#e2543f' : r.urg >= .45 ? '#ffc23c' : '#4fae4a';
  const dica = TIPS[r.em];
  return `<div style="margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:7px;font-size:12.5px">
      <span style="font-size:17px;flex:none">${r.em}</span>
      <span style="flex:1">${esc(r.txt)}</span>
      <b style="flex:none">${r.n}</b>
      <span style="flex:none;opacity:.55;font-size:11px">${p}%</span>
    </div>
    <div class="bar" style="height:9px;margin-top:2px"><i style="width:${p}%;background:${col}"></i></div>
    ${dica && r.urg >= .45 ? `<div style="font-size:11px;opacity:.72;margin-top:3px">💡 ${dica}</div>` : ''}
  </div>`;
}
function openSatisfaction() {
  closePalette();
  const vis = G.visitors;
  const ani = G.animals.filter(a => !a.dead);
  const rv = groupThoughts(vis, visitorThought), ra = groupThoughts(ani, animalThought);
  const moodV = vis.length ? vis.reduce((s, v) => s + v.mood, 0) / vis.length : G.stats.happiness;
  const moodA = ani.length ? ani.reduce((s, a) => s + a.happy, 0) / ani.length : 0;
  const cara = m => m > .75 ? '😄' : m > .55 ? '🙂' : m > .35 ? '😐' : m > .2 ? '🙁' : '😠';
  const bloco = (title, cnt, mood, ranking, empty) => `
    <div>
      <h4 class="sec" style="margin-top:0">${title}</h4>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
        <span style="font-size:31px">${cara(mood)}</span>
        <div><div style="font-size:21px;line-height:1">${Math.round(mood * 100)}%</div>
          <div style="font-size:11px;opacity:.6">${cnt} ${LN('no parque|in the park')}</div></div>
      </div>
      ${ranking.length ? ranking.map(r => reasonRow(r, cnt)).join('') : `<div style="font-size:12px;opacity:.6">${empty}</div>`}
    </div>`;
  openModal(LN('Satisfação — por quê?|Satisfaction — why?'),
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      ${bloco(LN('👥 Visitantes|👥 Visitors'), vis.length, moodV, rv, LN('Ninguém no parque agora.|Nobody in the park right now.'))}
      ${bloco(LN('🐾 Animais|🐾 Animals'), ani.length, moodA, ra, LN('Nenhum animal ainda.|No animals yet.'))}
     </div>
     <h4 class="sec">${LN('Como ler os balões no mapa|How to read the bubbles on the map')}</h4>
     <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px">
       <span class="tag bad">${LN('Fundo vermelho = problema grave|Red background = serious problem')}</span>
       <span class="tag warn">${LN('Amarelo = incomodado|Yellow = bothered')}</span>
       <span class="tag ok">${LN('Verde = satisfeito|Green = content')}</span>
     </div>
     <div style="font-size:12px;opacity:.75;margin-top:8px">
       ${LN('O botão 💭 no topo alterna entre <b>só quem está insatisfeito</b>, <b>todos</b> e <b>desligado</b> (atalho <kbd>B</kbd>). Toque num animal ou visitante para ver a ficha completa.|The 💭 button up top cycles between <b>only the unhappy ones</b>, <b>everyone</b> and <b>off</b> (shortcut <kbd>B</kbd>). Tap an animal or a visitor for the full record.')}
     </div>`,
    `<b>${BI`Satisfação geral: ${Math.round(moodV * 100)}%|Overall satisfaction: ${Math.round(moodV * 100)}%`}</b>
     <span style="margin-left:auto;font-size:12px;opacity:.7">${BI`Reputação ${G.rep.toFixed(1)}★ — é ela que define quanta gente aparece|Reputation ${G.rep.toFixed(1)}★ — it is what decides how many people turn up`}</span>`);
}

/* ---- the reputation panel: where the score comes from ---- */
function openReputation() {
  closePalette();
  const vivos = G.animals.filter(a => !a.dead);
  const felAn = vivos.length ? vivos.reduce((s, a) => s + a.happy, 0) / vivos.length : 0;
  const felVis = G.stats.happiness;
  const variety = new Set(vivos.map(a => a.sp.id)).size;
  let litterS = 0, litterN = 0;
  for (let i = 0; i < W * H; i++) if (world.path[i]) { litterS += world.litter[i]; litterN++; }
  const litterAvg = litterN ? litterS / litterN : 0;
  const target = parkQuality();
  // the same weights as parkQuality(), opened up line by line
  const comp = [
    ['🐾', LN('Bem-estar dos animais|Animal welfare'), felAn, felAn * 1.7],
    ['👥', LN('Satisfação dos visitantes|Visitor satisfaction'), felVis, felVis * 1.9],
    ['🦁', BI`Variedade de espécies (${variety})|Species variety (${variety})`, Math.min(variety, 30) / 30, Math.min(variety, 30) / 30 * 1.1],
    ['🗑️', LN('Lixo nas trilhas|Litter on the paths'), litterAvg, -litterAvg * 1.2],
    ['🚨', BI`Animais soltos agora (${G.escaped.length})|Animals loose right now (${G.escaped.length})`, null, -G.escaped.length * .25],
  ];
  const row = ([em, name, frac, pts]) => `
    <div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:22px;text-align:center">${em}</span>
      <span style="flex:1;font-size:12.5px">${name}</span>
      ${frac === null ? '' : `<div style="width:110px;height:8px;background:#e8e0cc;border-radius:4px;overflow:hidden">
        <div style="width:${Math.round(clamp(frac, 0, 1) * 100)}%;height:100%;background:${pts >= 0 ? '#4fae4a' : '#e2543f'}"></div></div>`}
      <b style="width:56px;text-align:right;font-size:12.5px;color:${pts >= 0 ? '#2f7a2f' : '#b3402f'}">${pts >= 0 ? '+' : ''}${pts.toFixed(2)}★</b>
    </div>`;
  // the statement: a summary by kind + the latest events
  const EVENT_NAMES = { '💀': 'mortes|deaths', '🚨': 'fugas|escapes', '🎉': 'nascimentos|births', '🗳️': 'avaliações do público|public ratings', '📉': 'quedas|drops', '📈': 'subidas|rises' };
  const byKind = new Map();
  for (const r of G.repLog) {
    const g = byKind.get(r.em) || { em: r.em, n: 0, sum: 0 };
    g.n++; g.sum += r.delta; byKind.set(r.em, g);
  }
  const chips = [...byKind.values()].sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))
    .map(g => `<span class="tag ${g.sum >= 0 ? 'ok' : 'bad'}">${g.em} ${g.n}× ${EVENT_NAMES[g.em] ? LN(EVENT_NAMES[g.em]) : ''} (${g.sum >= 0 ? '+' : ''}${g.sum.toFixed(2)}★)</span>`)
    .join('');
  const lista = G.repLog.slice(-12).reverse().map(r => `
    <div style="display:flex;gap:8px;font-size:12.5px;margin:3px 0;align-items:baseline">
      <span style="opacity:.55;width:46px;flex:none">${BI`Dia ${r.day}|Day ${r.day}`}</span><span style="flex:none">${r.em}</span>
      <span style="flex:1">${esc(r.reason)}</span>
      <b style="color:${r.delta >= 0 ? '#2f7a2f' : '#b3402f'}">${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}</b>
    </div>`).join('')
    || `<div style="font-size:12px;opacity:.6">${LN('Nada registrado ainda — mortes, fugas, nascimentos e as avaliações de quem visita entram aqui.|Nothing recorded yet — deaths, escapes, births and visitor ratings all land here.')}</div>`;
  const seta = target > G.rep + .05 ? LN('📈 subindo|📈 rising') : target < G.rep - .05 ? LN('📉 caindo|📉 falling') : LN('➡️ estável|➡️ steady');
  openModal(LN('Reputação — de onde vem a nota|Reputation — where the score comes from'),
    `<div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
      <span style="font-size:34px">⭐</span>
      <div>
        <div style="font-size:24px;line-height:1.1"><b>${G.rep.toFixed(1)}</b><span style="font-size:14px;opacity:.6">/5</span>
          <span class="stars" style="font-size:15px">${stars(G.rep)}</span></div>
        <div style="font-size:12px;opacity:.75">${LN('A nota caminha todo dia rumo à qualidade real do parque:|The score walks a little closer every day to the park&rsquo;s real quality:')}
          <b>${target.toFixed(1)}★</b> — ${seta}</div>
      </div>
    </div>
    <h4 class="sec">${LN('Avaliação contínua (qualidade real)|Continuous rating (real quality)')}</h4>
    ${comp.map(row).join('')}
    <div style="font-size:11.5px;opacity:.65;margin-top:2px">${LN('Soma limitada a 0–5★. Clique em 😊 Satisfação para ver as reclamações ao vivo.|The sum is clamped to 0–5★. Click 😊 Satisfaction to see the complaints live.')}</div>
    <h4 class="sec">${LN('Acontecimentos que mexeram na nota|Events that moved the score')}</h4>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px">${chips || '<span style="font-size:12px;opacity:.6">—</span>'}</div>
    ${lista}`,
    `<b>⭐ ${G.rep.toFixed(1)}</b>
     <span style="margin-left:auto;font-size:12px;opacity:.7">${LN('É a reputação que define quanta gente aparece no portão|Reputation is what decides how many people show up at the gate')}</span>`);
}

/* ---- the visitor inspector ---- */
const NEED_INFO = {
  hunger: ['🍔', 'Fome|Hunger'], thirst: ['🥤', 'Sede|Thirst'], toilet: ['🚻', 'Banheiro|Restroom'],
  energy: ['🪑', 'Cansaço|Tiredness'], fun: ['🎡', 'Vontade de se divertir|Wanting some fun'],
};
/* what a building serves, for the inspector's "Serves" line */
const NEED_NAMES = Object.fromEntries(Object.entries(NEED_INFO).map(([k, v]) => [k, v[1]]));
const visitorSignature = v => v.id + '|' + (v.leaving ? 1 : 0);
function inspVisitor(v) {
  if (!G.visitors.includes(v)) { deselect(); return; }
  UI.insp.dataset.sig = visitorSignature(v);
  const p = v.thought || visitorThought(v);
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:25px">${v.child ? '🧒' : '🧑'}</div>
      <div><h3>${v.child ? LN('Criança|Child') : LN('Visitante|Visitor')}</h3>
        <div class="sub">${v.leaving ? 'Indo embora' : 'Passeando'} · ${v.time.toFixed(1)}h no parque</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline"><span class="tag ${p.urg >= .8 ? 'bad' : p.urg >= .45 ? 'warn' : 'ok'}" id="iEstado">
      ${p.em} ${esc(p.txt)}</span></div>
    ${bar(LN('Satisfação|Satisfaction'), v.mood, colourFor(v.mood), undefined, 'mood')}
    <h4 class="sec">Necessidades (cheio = tranquilo)</h4>
    ${Object.keys(NEED_INFO).map(k => bar(NEED_INFO[k][0] + ' ' + LN(NEED_INFO[k][1]),
      1 - v.need[k], colourFor(1 - v.need[k]), undefined, 'n_' + k)).join('')}
    <h4 class="sec">Carteira e passeio</h4>
    <div class="kv"><span>Dinheiro no bolso</span><b id="iDin">${moneyFull(v.money)}</b></div>
    <div class="kv"><span>${LN('Recintos que já viu|Enclosures seen')}</span><b id="iViu">${v.seen.size}</b></div>
    <div class="kv"><span>${LN('Levando|Carrying')}</span><b>${v.item === 'balloon' ? LN('🎈 Balão|🎈 Balloon') : v.item === 'food' ? LN('🍔 Comida|🍔 Food') : '—'}</b></div>
    <div class="rowbtns">
      <button class="btn sm" id="ivoz">🔊 Ouvir</button>
      <button class="btn sm" id="igo">🎯 Centralizar</button>
    </div>`;
  $('#ix').onclick = deselect;
  $('#ivoz').onclick = () => { SFX.start(); SFX.humanVoice(v, { vol: .3, now: true }); };
  $('#igo').onclick = () => centerOn(v.x, v.y);
}

/* ---- ajuda ---- */
function openHelp() {
  closePalette();
  const li = (pt, en) => `<li>${LN(pt + '|' + en)}</li>`;
  openModal(LN('Como jogar|How to play'),
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:13px;line-height:1.55">
      <div>
        <h4 class="sec" style="margin-top:0">${LN('O ciclo básico|The basic loop')}</h4>
        <ol style="padding-left:17px">
          ${li('<b>Trilhas</b> — desenhe um caminho saindo do portão (base do mapa). Sem trilha ligada ao portão, ninguém entra.',
    '<b>Paths</b> — draw a path out from the gate (bottom of the map). With no path joined to the gate, nobody comes in.')}
          ${li('<b>Recinto</b> — arraste um retângulo (mín. 3×3). O perímetro vira cerca; o miolo é onde o bicho vive.',
    '<b>Enclosure</b> — drag a rectangle (min. 3×3). The perimeter becomes the fence; the middle is where the animal lives.')}
          ${li('<b>Terreno</b> — pinte o miolo com o bioma da espécie (savana quer grama+terra, tundra quer neve...).',
    '<b>Terrain</b> — paint the middle with the species&rsquo; biome (savanna wants grass+dirt, tundra wants snow...).')}
          ${li('<b>Objetos</b> — todo recinto precisa de <b>comedouro</b> e <b>bebedouro</b>. Enriquecimento sobe a felicidade.',
    '<b>Objects</b> — every enclosure needs a <b>feeder</b> and a <b>water trough</b>. Enrichment raises happiness.')}
          ${li('<b>Animais</b> — compre na loja e clique no recinto. Passe trilha ao lado, senão ninguém vê.',
    '<b>Animals</b> — buy in the shop and click the enclosure. Run a path alongside, or nobody sees them.')}
          ${li('<b>Equipe</b> — contrate tratador, veterinário, faxineiro e segurança.',
    '<b>Staff</b> — hire a keeper, a vet, a cleaner and security.')}
          ${li('<b>Comércio</b> — lanchonete, bebida e banheiro perto das trilhas movimentadas.',
    '<b>Shops</b> — snack bar, drinks and restrooms near the busy paths.')}
        </ol>
      </div>
      <div>
        <h4 class="sec" style="margin-top:0">${LN('O que move o dinheiro|What moves the money')}</h4>
        <ul style="padding-left:17px">
          ${li('<b>Ingresso</b>: cobrado na entrada. Cobre acima do "preço justo" e o público some.',
    '<b>Ticket</b>: charged at the gate. Charge above the &ldquo;fair price&rdquo; and the public vanishes.')}
          ${li('<b>Lojas</b>: cada uma tem preço regulável no inspetor. Margem alta afasta, margem baixa lota.',
    '<b>Shops</b>: each has its own price in the inspector. A high margin drives people off, a low one packs them in.')}
          ${li('<b>Reputação</b> sobe com visitante feliz e desce com morte, fuga e sujeira. Ela controla quanta gente aparece.',
    '<b>Reputation</b> rises with happy visitors and falls with death, escapes and filth. It controls how many people turn up.')}
          ${li('<b>Contas</b> caem a cada 7 dias (salários) e a ração é debitada quando o tratador reabastece.',
    '<b>Bills</b> land every 7 days (wages), and feed is charged when the keeper restocks.')}
        </ul>
        <h4 class="sec">${LN('Felicidade do animal|Animal happiness')}</h4>
        <div>${LN('Espaço, bioma correto, tamanho do grupo, enriquecimento, limpeza, saúde, comida e cerca adequada. O inspetor de cada animal mostra a nota item por item — é onde você descobre o que consertar.|Space, the right biome, group size, enrichment, cleanliness, health, food and a suitable fence. Each animal&rsquo;s inspector shows the score line by line — that is where you find out what to fix.')}</div>
        <h4 class="sec">${LN('Atalhos|Shortcuts')}</h4>
        <div>${LN('<kbd>1</kbd>–<kbd>9</kbd> abas · <kbd>Espaço</kbd> pausa · <kbd>Esc</kbd> cancela ferramenta · <kbd>M</kbd> minimapa · botão direito arrasta a câmera · roda dá zoom · <kbd>Del</kbd> demole o selecionado|<kbd>1</kbd>–<kbd>9</kbd> tabs · <kbd>Space</kbd> pauses · <kbd>Esc</kbd> cancels the tool · <kbd>M</kbd> minimap · the right button drags the camera · the wheel zooms · <kbd>Del</kbd> demolishes the selection')}</div>
      </div>
    </div>`,
    `<button class="btn g" id="hOk">${LN('Entendi|Got it')}</button>
     <button class="btn sm" id="hSave">${LN('💾 Salvar aqui|💾 Save here')}</button>
     <button class="btn sm" id="hLoad">${LN('📂 Carregar|📂 Load')}</button>
     <button class="btn b sm" id="hDlSave">${LN('📥 Baixar save (.json)|📥 Download save (.json)')}</button>
     <button class="btn b sm" id="hDlTxt">${LN('📄 Baixar status (.txt)|📄 Download status (.txt)')}</button>
     <button class="btn sm" id="hUp">${LN('📤 Abrir save do arquivo|📤 Open a save file')}</button>
     <button class="btn r sm" id="hReset">${LN('🔄 Recomeçar|🔄 Start over')}</button>`);
  $('#hOk').onclick = closeModal;
  $('#hSave').onclick = () => { saveGame(); };
  $('#hLoad').onclick = () => { if (confirm(LN('Carregar o jogo salvo neste navegador? O progresso atual será perdido.|Load the game saved in this browser? The current progress will be lost.'))) loadGame(); };
  $('#hDlSave').onclick = () => exportSave();
  $('#hDlTxt').onclick = () => exportReport();
  $('#hUp').onclick = () => $('#fileSave').click();   // input permanente, fora do modal
  $('#hReset').onclick = () => { if (confirm(LN('Recomeçar do zero?|Start over from scratch?'))) { localStorage.removeItem('zoo_save'); location.reload(); } };
}