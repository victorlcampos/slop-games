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

/** Qual arranjo de painéis o CSS está aplicando — espelha as media queries.
 *  'gaveta'      celular em pé: inspetor é gaveta inferior, paleta ocupa o rodapé
 *  'lateralCurto' paisagem baixa: inspetor lateral de 250px, dock encurtado
 *  'apertado'    tablet: inspetor lateral, mas a paleta ainda cruzaria com ele
 *  'amplo'       desktop: os dois convivem sem se tocar */
function layoutModo() {
  const w = window.innerWidth, h = window.innerHeight;
  if (h <= 520 && w >= 560) return 'lateralCurto';
  if (w <= 700) return 'gaveta';
  if (w <= 1000) return 'apertado';
  return 'amplo';
}
/** onde paleta e inspetor não cabem juntos, só um fica aberto por vez */
function painelUnico() { const m = layoutModo(); return m === 'gaveta' || m === 'apertado'; }

/** publica a altura real do HUD para o CSS — ela varia quando as etiquetas
 *  quebram em duas linhas no celular, e inspetor/dica/toasts pendem dela */
function medirHud() {
  const h = Math.round($('#hud').getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hudH', h + 'px');
}

function toast(msg, kind) {
  SFX.toca(kind === 'good' ? 'compra' : kind === 'money' ? 'moeda' : kind === 'bad' ? 'erro' : 'ui');
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
  const vivos = G.animals.filter(a => !a.morto);
  $('#vAni').textContent = vivos.length;
  const hp = G.visitors.length ? G.visitors.reduce((s, v) => s + v.mood, 0) / G.visitors.length : G.stats.felicidade;
  G.stats.felicidade = hp;
  $('#vHappy').textContent = Math.round(hp * 100) + '%';
  $('#vRep').textContent = G.rep.toFixed(1) + '★';
  $('#clockBadge').textContent = relTime(G.hour) + (G.hour >= OPEN_H && G.hour < CLOSE_H ? '' : ' 🌙');

  // Aviso curto no HUD. Não condicionar a "zero visitantes no parque": quando
  // você acabou de cortar a trilha, o pessoal que já entrou continua saindo e o
  // alerta ficava escondido justamente na hora em que ele importa.
  const w = $('#stWarn');
  const diag = diagnosticoPublico();
  const mostra = !!diag && diag.key !== 'closed';
  w.classList.toggle('show', mostra);
  if (mostra) {
    $('#vWarn').textContent = diag.curto;
    w.querySelector('.ic').textContent = diag.em;
  }
  renderAlertas();
}

/* ---- barra de alertas do gerente ----
   Os problemas que pedem ação AGORA, agrupados por tipo. Clicar no chip
   centraliza a câmera no alvo; clicar de novo cicla entre os casos. */
const ALERTA_DEF = {
  fuga: { em: '🚨', n: 'Animal solto', sev: 3 },
  doente: { em: '🤒', n: 'Animal doente', sev: 3 },
  saude: { em: '🆘', n: 'Saúde crítica', sev: 3 },
  fome: { em: '🍖', n: 'Recinto sem comida', sev: 2 },
  water: { em: '💧', n: 'Recinto sem água', sev: 2 },
  cerca: { em: '🔧', n: 'Cerca se rompendo', sev: 2 },
  idoso: { em: '⏳', n: 'Animal no fim da vida', sev: 1 },
  sujo: { em: '🧹', n: 'Recinto imundo', sev: 1 },
  vista: { em: '👀', n: 'Recinto sem trilha', sev: 1 },
};
let _alSig = '';
const _alCursor = {};
function coletarAlertas() {
  const grupos = new Map();
  const add = (tipo, alvo, rotulo) => {
    let g = grupos.get(tipo);
    if (!g) grupos.set(tipo, g = { tipo, alvos: [], rotulos: [] });
    g.alvos.push(alvo); g.rotulos.push(rotulo);
  };
  for (const a of G.escaped) if (!a.morto) add('fuga', [a.x, a.y], LN(a.sp.name));
  for (const a of G.animals) {
    if (a.morto || a.fugiu) continue;
    if (a.doente) add('doente', [a.x, a.y], a.name + ' (' + LN(a.sp.name) + ')');
    else if (a.saude < .3) add('saude', [a.x, a.y], a.name + ' (' + LN(a.sp.name) + ')');
    if (a.idade > a.sp.lifespan * .85) add('idoso', [a.x, a.y], a.name + ' (' + LN(a.sp.name) + ')');
  }
  for (const e of enclosures.values()) {
    if (!e.animals.some(a => !a.morto)) continue;
    const bb = encBBox(e), alvo = [bb.cx, bb.cy];
    if (!encHasFeeder(e) || e.comida < .12) add('fome', alvo, e.name);
    if (!encHasWater(e) || e.water < .12) add('water', alvo, e.name);
    if (e.integridade < .5) add('cerca', alvo, e.name);
    if (e.limpeza < .3) add('sujo', alvo, e.name);
    if (!encViewSpots(e).length) add('vista', alvo, e.name);
  }
  return [...grupos.values()]
    .sort((a, b) => ALERTA_DEF[b.kind].sev - ALERTA_DEF[a.kind].sev || b.alvos.length - a.alvos.length);
}
function renderAlertas() {
  const ab = $('#alertbar'); if (!ab) return;
  const grupos = coletarAlertas().slice(0, 6);
  const sig = grupos.map(g => g.kind + ':' + g.alvos.length).join('|');
  if (sig === _alSig) return;                 // sem mudança, sem reconstruir
  _alSig = sig;
  ab.innerHTML = '';
  for (const g of grupos) {
    const D = ALERTA_DEF[g.kind];
    const chip = el('button', 'achip sev' + D.sev,
      `<span>${D.em}</span><span>${esc(LN(D.n))}</span>` +
      (g.alvos.length > 1 ? `<span class="n">${g.alvos.length}</span>` : ''));
    chip.title = g.rotulos.slice(0, 6).join(', ') + (g.rotulos.length > 6 ? '…' : '') + ' — toque para localizar';
    chip.onclick = () => {
      const i = _alCursor[g.kind] = ((_alCursor[g.kind] ?? -1) + 1) % g.alvos.length;
      centerOn(g.alvos[i][0], g.alvos[i][1]);
      toast(D.em + ' ' + esc(g.rotulos[i]) + (g.alvos.length > 1 ? ` (${i + 1}/${g.alvos.length})` : ''), '');
    };
    ab.appendChild(chip);
  }
}

/* ---- categorias do dock ---- */
const CATS = [
  { k: 'caminho', n: 'Trilhas|Paths', em: '🛣️' },
  { k: 'recinto', n: 'Recintos|Enclosures', em: '🚧' },
  { k: 'terreno', n: 'Terreno|Terrain', em: '🎨' },
  { k: 'encobj', n: 'No Recinto|In Enclosure', em: '🥣' },
  { k: 'animal', n: 'Animais|Animals', em: '🦁' },
  { k: 'build', n: 'Comércio|Shops', em: '🍔' },
  { k: 'deco', n: 'Decoração|Decor', em: '🌳' },
  { k: 'equipe', n: 'Equipe|Staff', em: '🧑‍🌾' },
  { k: 'financas', n: 'Finanças|Finance', em: '💰' },
  { k: 'demolir', n: 'Demolir|Demolish', em: '🔨' },
];
function buildDock() {
  UI.dock.innerHTML = '';
  for (const c of CATS) {
    const b = el('button', 'btn', `<i>${c.em}</i>${LN(c.n)}`);
    b.dataset.cat = c.k;
    b.onclick = () => abrirCategoria(c.k);
    UI.dock.appendChild(b);
  }
  const bh = el('button', 'btn', '<i>❓</i>Ajuda');
  bh.onclick = openHelp; UI.dock.appendChild(bh);
}
function abrirCategoria(k) {
  if (UI.cat === k) { fecharPaleta(); return; }
  UI.cat = k;
  $$('#dock .btn').forEach(b => b.classList.toggle('on', b.dataset.cat === k));
  if (k === 'animal') { fecharPaleta(); openShop(); return; }
  if (k === 'equipe') { fecharPaleta(); openStaff(); return; }
  if (k === 'financas') { fecharPaleta(); openFinance(); return; }
  if (k === 'demolir') { fecharPaleta(); setTool({ cat: 'demolir', em: '🔨', n: 'Demolir|Demolish' }); return; }
  montarPaleta(k);
}
function fecharPaleta() {
  UI.pal.classList.remove('show'); UI.cat = null;
  $$('#dock .btn').forEach(b => b.classList.remove('on'));
  atualizarMini();
}

function montarPaleta(k) {
  if (painelUnico()) deselect();
  UI.pal.classList.add('show');
  atualizarMini();
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
  if (k === 'caminho') {
    title.textContent = LN('Trilhas — clique e arraste para desenhar o caminho dos visitantes|Paths — click and drag to draw where the visitors walk');
    add(LN('Calçada|Path'), '🛣️', 30, { cat: 'caminho', key: 'piso', em: '🛣️', n: 'Calçada|Path', cost: 30 });
    add(LN('Apagar trilha|Erase path'), '🧽', 0, { cat: 'caminho', key: 'del', em: '🧽', n: 'Apagar trilha|Erase path', cost: 0 });
  } else if (k === 'recinto') {
    title.textContent = LN('Recintos — arraste um retângulo (mínimo 3×3). O preço cobre a cerca do perímetro.|Enclosures — drag a rectangle (3×3 minimum). The price covers the perimeter fence.');
    for (const key in FENCES) {
      const F = FENCES[key];
      add(F.n, F.em, F.cost, { cat: 'recinto', key, em: F.em, n: F.n, cost: F.cost },
        BI`<span class="pr">força ${F.strength} · visão ${Math.round(F.sight * 100)}%</span>|<span class="pr">strength ${F.strength} · sight ${Math.round(F.sight * 100)}%</span>`);
    }
  } else if (k === 'terreno') {
    title.textContent = LN('Terreno — pinte dentro dos recintos para bater com o bioma da espécie|Terrain — paint inside the enclosures to match the species\u2019 biome');
    for (const key of TKEYS) {
      if (key === 'piso') continue;
      const T = TERRAIN[key];
      add(T.n, T.em, T.cost, { cat: 'terreno', key, em: T.em, n: T.n, cost: T.cost });
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
  if (t) SFX.toca('aba');
  G.tool = t; G.drag = null;
  if (!t) { hint(null); return; }
  const dicas = {
    caminho: LN('Arraste para desenhar a trilha.|Drag to draw the path.'),
    recinto: t.ampliando
      ? LN('Arraste <b>encostando no recinto</b> para ampliá-lo. Pode repetir para fazer L, T ou U.|Drag <b>touching the enclosure</b> to extend it. Repeat to make an L, a T or a U.')
      : LN('Arraste um retângulo para criar. Depois arraste <b>colado nele</b> para ampliar — o formato não precisa ser quadrado.|Drag a rectangle to create one. Then drag <b>against it</b> to extend — the shape does not have to be square.'),
    terreno: LN('Arraste para pintar o terreno.<span class="ctrlMouse"> <kbd>Shift</kbd> pinta 3×3.</span>|Drag to paint the terrain.<span class="ctrlMouse"> <kbd>Shift</kbd> paints 3×3.</span>'),
    encobj: LN('Coloque dentro de um recinto já construído.|Place it inside an enclosure you already built.'),
    build: LN('Posicione junto a uma trilha para os visitantes conseguirem chegar.|Put it next to a path so visitors can reach it.'),
    deco: LN('Espalhe pelo parque — quanto mais bonito, mais felizes os visitantes.|Scatter it around the park — the prettier it is, the happier the visitors.'),
    animal: BI`Toque num recinto para soltar <b>${t.sp ? LN(t.LN(sp.name)) : ''}</b> lá dentro.|Tap an enclosure to release <b>${t.sp ? LN(t.LN(sp.name)) : ''}</b> into it.`,
    demolir: LN('Toque no que quiser remover. Recintos devolvem metade do valor da cerca.|Tap whatever you want removed. Enclosures refund half the fence value.'),
  };
  hint(`<span style="font-size:17px">${t.em || '🔧'}</span> <b>${LN(t.n || '')}</b> — ${dicas[t.cat] || ''}` +
    `<button class="btn r sm" id="hintX" title="Cancelar ferramenta">✕</button>`);
}

/* ---- modais ---- */
function openModal(title, bodyHTML, footHTML) {
  SFX.toca('abrir');
  UI.mTitle.textContent = title;
  UI.mBody.innerHTML = bodyHTML || '';
  UI.mFoot.innerHTML = footHTML || '';
  UI.modalBg.classList.add('show');
}
function closeModal() {
  if (UI.modalBg.classList.contains('show')) SFX.toca('fechar');
  UI.modalBg.classList.remove('show'); fecharPaleta();
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
         <option value="appeal">Ordenar: popularidade</option>
         <option value="price">Ordenar: preço ↑</option>
         <option value="precoD">Ordenar: preço ↓</option>
         <option value="name">Ordenar: A–Z</option>
         <option value="space">Ordenar: espaço</option>
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
  // o filtro persiste entre aberturas — os controles precisam MOSTRAR isso.
  // Reabrir com controles zerados mas filtro antigo valendo fazia a lista
  // "minguar" a cada visita até 0 espécies sem motivo aparente.
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
    (!q || s.name.toLowerCase().includes(q) || s.biomeName.toLowerCase().includes(q)) &&
    (!shopFiltro.biome || s.biome === shopFiltro.biome) &&
    (!shopFiltro.diet || s.diet === shopFiltro.diet));
  const ord = { appeal: (a, b) => b.appeal - a.appeal || a.price - b.price, price: (a, b) => a.price - b.price, precoD: (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name), space: (a, b) => a.space - b.space };
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
      // cada card é isolado: uma espécie problemática não pode apagar a loja inteira
      try {
        // mede a caixa real: ela encolhe no celular (.pic tem altura menor lá)
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
    const pode = G.money >= sp.price;
    const combina = e ? terrainScore(e, sp) : null;
    const card = el('div', 'acard' + (pode ? '' : ' dis'));
    card.dataset.sp = sp.id;
    const bg = combina === null ? '#eef4ea' : combina > .7 ? '#d7f0cf' : combina > .4 ? '#fbf0cf' : '#f8dcd6';
    card.innerHTML =
      `<div class="pic" style="background:${bg}"></div>
       <div class="nm">${esc(LN(sp.name))}</div>
       <div class="mt">${BIOMES[sp.biome].em} ${sp.biomeName} · ${DIETS[sp.diet].em} ${sp.dietName}<br>
         ${sp.space} tiles/animal · grupo ${sp.groupMin}–${sp.groupMax} · ${sp.lifespan} anos<br>
         ração ${moneyFull(sp.feed)}/dia · danger ${'⚠️'.repeat(Math.min(sp.danger, 5)) || '—'}</div>
       <div class="ft"><span class="stars">${stars(sp.appeal / 2)}</span><b>${moneyFull(sp.price)}</b></div>`;
    card.onclick = () => {
      if (!pode) { toast(BI`💸 Dinheiro insuficiente para ${LN(sp.name)}|💸 Not enough money for a ${LN(sp.name)}`, 'bad'); return; }
      if (shopEncId && enclosures.has(shopEncId)) { comprarPara(sp, enclosures.get(shopEncId)); closeModal(); }
      else { setTool({ cat: 'animal', key: 'sp' + sp.id, sp, em: '🐾', n: LN(sp.name), cost: sp.price }); closeModal(); }
    };
    grid.appendChild(card);
    shopObserver.observe(card);
  }
}
function comprarPara(sp, e) {
  const aviso = checarRecinto(sp, e);
  if (aviso.bloqueia) { toast('🚫 ' + aviso.msg, 'bad'); return false; }
  if (G.money < sp.price) { toast('💸 Dinheiro insuficiente', 'bad'); return false; }
  spend(sp.price, 'compra');
  const a = novoAnimal(sp, e.id);
  e.animals.push(a);
  undoRegistrar({ kind: 'animal', cat: 'compra', id: a.id, cost: sp.price, rotulo: LN(sp.name) });
  toast(BI`🎉 ${LN(sp.name)} chegou ao ${e.name}!|🎉 A ${LN(sp.name)} arrived at ${e.name}!`, 'good');
  if (aviso.msg) toast('⚠️ ' + aviso.msg, 'bad');
  return true;
}
function checarRecinto(sp, e) {
  const F = FENCES[e.fence];
  const irmaos = e.animals.filter(z => z.sp.id === sp.id).length;
  const outras = new Set(e.animals.map(z => z.sp.id)); outras.delete(sp.id);
  if (outras.size > 0) {
    const carnivoro = sp.diet === 'carn' || e.animals.some(z => z.diet === 'carn');
    if (carnivoro) return { bloqueia: true, msg: LN('Não dá para misturar carnívoros com outras espécies nesse recinto.|You cannot mix carnivores with other species in that enclosure.') };
  }
  if (encArea(e) < sp.space) return { bloqueia: true, msg: BI`${LN(sp.name)} precisa de ${sp.space} tiles e o recinto só tem ${encArea(e)}.|A ${LN(sp.name)} needs ${sp.space} tiles and the enclosure only has ${encArea(e)}.` };
  if (encArea(e) < sp.space * (irmaos + 1)) return { bloqueia: false, msg: 'O recinto vai ficar apertado — a felicidade cai.' };
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
/** atualiza uma barra já existente sem recriar o DOM em volta */
function setBar(key, v, col, extra) {
  const row = UI.insp.querySelector(`[data-bar="${key}"]`);
  if (!row) return;
  const p = Math.round(clamp(v, 0, 1) * 100);
  const i = row.querySelector('i');
  i.style.width = p + '%'; i.style.background = col;
  row.querySelector('[data-v]').textContent = extra !== undefined ? extra : p + '%';
}
const corDe = v => v > .66 ? '#4fae4a' : v > .33 ? '#ffc23c' : '#e2543f';

function select(tipo, ref) {
  G.sel = { tipo, ref };
  if (painelUnico()) fecharPaleta();
  showInspector();
}
function deselect() { G.sel = null; UI.insp.classList.remove('show'); zoomBtnsVisiveis(true); atualizarMini(); }
/** o inspetor mora no mesmo lado dos botões de zoom em todos os layouts */
function zoomBtnsVisiveis(v) { $('#zoomBtns').classList.toggle('tapado', !v); }
/** Minimapa: `G.miniQuer` é a vontade do jogador; a exibição também depende de
 *  não colidir — no modo gaveta o rodapé é disputado por dock, paleta e
 *  inspetor, e o mapa é o último da fila. */
function atualizarMini() {
  const conflita = layoutModo() === 'gaveta' &&
    (!!G.sel || UI.pal.classList.contains('show'));
  $('#mini').classList.toggle('show', !!G.miniQuer && !conflita);
}
function showInspector() {
  const s = G.sel;
  if (!s) { UI.insp.classList.remove('show'); zoomBtnsVisiveis(true); atualizarMini(); return; }
  UI.insp.classList.add('show');
  zoomBtnsVisiveis(false);
  atualizarMini();
  if (s.kind === 'enc') inspEnclosure(s.ref);
  else if (s.kind === 'animal') inspAnimal(s.ref);
  else if (s.kind === 'obj') inspObject(s.ref);
  else if (s.kind === 'staff') inspStaff(s.ref);
  else if (s.kind === 'vis') inspVisitor(s.ref);
}
/** assinatura do que exige reconstruir o painel (o resto é só valor a atualizar) */
const encSig = e => [e.name, e.fence, e.tiles.size,
  e.animals.filter(a => !a.morto).map(a => a.id).join(','),
  e.objs.map(o => o.kind).join(',')].join('|');
/** composição do terreno em tags — muda a cada pincelada, então é atualizada
 *  no refresh em vez de ficar congelada no HTML da abertura */
const encMixHTML = e => Object.entries(encMix(e)).sort((a, b) => b[1] - a[1]).slice(0, 5)
  .map(([k, v]) => `<span class="tag">${TERRAIN[k].em} ${LN(TERRAIN[k].n)} ${Math.round(v * 100)}%</span>`).join('');
function encAlertasHTML(e) {
  const F = FENCES[e.fence];
  const vivos = e.animals.filter(a => !a.morto);
  const sp0 = vivos[0] ? vivos[0].sp : null;
  const alertas = [];
  if (!encHasFeeder(e) && vivos.length) alertas.push(['bad', '🥣 Sem comedouro']);
  if (!encHasWater(e) && vivos.length) alertas.push(['bad', '🚰 Sem bebedouro']);
  if (e.limpeza < .4) alertas.push(['bad', '💩 Sujo']);
  if (encEnrich(e) < .3 && vivos.length) alertas.push(['warn', '🎾 Pouco enriquecimento']);
  if (sp0 && sp0.danger > F.strength) alertas.push(['bad', '⚠️ Cerca fraca']);
  if (!encViewSpots(e).length) alertas.push(['warn', LN('👀 Sem trilha ao redor — ninguém vê|👀 No path around it — nobody sees in')]);
  if (!alertas.length && vivos.length) alertas.push(['ok', LN('✅ Tudo em ordem|✅ All in order')]);
  return alertas.map(([c, t]) => `<span class="tag ${c}">${t}</span>`).join('');
}
function inspEnclosure(e) {
  if (!enclosures.has(e.id)) { deselect(); return; }
  const F = FENCES[e.fence];
  const vivos = e.animals.filter(a => !a.morto);
  const felic = vivos.length ? vivos.reduce((s, a) => s + a.feliz, 0) / vivos.length : 0;
  const sp0 = vivos[0] ? vivos[0].sp : null;
  const ts = sp0 ? terrainScore(e, sp0) : null;
  UI.insp.dataset.sig = encSig(e);

  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:26px">${sp0 ? BIOMES[sp0.biome].em : '🚧'}</div>
      <div><h3>${esc(e.name)}</h3><div class="sub">${F.em} ${F.n} · ${encArea(e)} tiles · cerca de ${encSegCount(e)} trechos</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline" id="iAlerts">${encAlertasHTML(e)}</div>
    ${bar(LN('Felicidade média|Average happiness'), felic, corDe(felic), undefined, 'felic')}
    ${bar('Limpeza', e.limpeza, corDe(e.limpeza), undefined, 'limp')}
    ${bar(LN('Comida no cocho|Food in the feeder'), e.comida, corDe(e.comida), undefined, 'comida')}
    ${bar(LN('Água|Water'), e.water, corDe(e.water), undefined, 'water')}
    ${bar('Enriquecimento', encEnrich(e), corDe(encEnrich(e)), undefined, 'enr')}
    ${ts !== null ? bar('Terreno x biome (' + sp0.biomeName + ')', ts, corDe(ts), undefined, 'terr') : ''}
    <h4 class="sec">Terreno</h4><div class="tagline" id="iMix">${encMixHTML(e)}</div>
    ${sp0 ? `<div style="font-size:11px;opacity:.7;margin-top:4px">Ideal: ${Object.entries(sp0.mix).map(([k, v]) => `${TERRAIN[k].em}${Math.round(v * 100)}%`).join(' · ')}</div>` : ''}
    <h4 class="sec">Animais (${vivos.length})</h4>
    <div id="ilist">${vivos.length ? vivos.map(a => `
      <div class="kv" data-a="${a.id}" style="cursor:pointer">
        <span>${a.doente ? '🤒 ' : ''}${esc(a.name)} <small style="opacity:.6">${a.sexo === 'M' ? '♂' : '♀'} ${esc(LN(a.sp.name))}, ${a.idade.toFixed(1)}a</small></span>
        <b style="color:${corDe(a.feliz)}">${Math.round(a.feliz * 100)}%</b>
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
    // já entrega a ferramenta com o tipo de cerca deste recinto
    setTool({ cat: 'recinto', key: e.fence, em: FENCES[e.fence].em, n: 'Ampliar ' + e.name,
              cost: FENCES[e.fence].cost, ampliando: e.id });
    if (painelUnico()) deselect();
  };
  $('#iobj').onclick = () => { abrirCategoria('encobj'); };
  $('#ipaint').onclick = () => { abrirCategoria('terreno'); };
  $('#iren').onclick = () => {
    const n = prompt(LN('Nome do recinto:|Enclosure name:'), e.name);
    if (n) { e.name = n.slice(0, 28); showInspector(); }
  };
  $('#ifence').onclick = () => trocarCerca(e);
  $('#idel').onclick = () => {
    if (e.animals.length) { toast(LN('🚫 Venda ou mova os animais antes de demolir|🚫 Sell or move the animals before demolishing'), 'bad'); return; }
    const dev = Math.round(custoCercaDe(e) * .5);
    deleteEnclosure(e.id); earn(dev, 'venda'); deselect();
    toast('🔨 Recinto demolido (+' + moneyFull(dev) + ')', 'money');
  };
  $$('#ilist .kv').forEach(d => d.onclick = () => {
    const a = G.animals.find(z => z.id === +d.dataset.a); if (a) select('animal', a);
  });
}
function trocarCerca(e) {
  const opts = Object.keys(FENCES).map(k => {
    const F = FENCES[k], custo = encSegCount(e) * F.cost - Math.round(custoCercaDe(e) * .4);
    return `<div class="pitem" data-f="${k}" style="width:118px">
      <span class="em">${F.em}</span>${LN(F.n)}<span class="pr">${moneyFull(Math.max(0, custo))}</span>
      <span class="pr">força ${F.strength} · visão ${Math.round(F.sight * 100)}%</span></div>`;
  }).join('');
  openModal(LN('Trocar cerca — |Change fence — ') + e.name,
    `<div style="display:flex;gap:8px;flex-wrap:wrap">${opts}</div>
     <p style="font-size:12px;opacity:.7;margin-top:10px">Você recebe 40% de volta da cerca atual. Força alta evita fugas; visão alta deixa os visitantes enxergarem melhor (e pagarem mais).</p>`);
  $$('#modalBody .pitem').forEach(d => d.onclick = () => {
    const k = d.dataset.f;
    const custo = Math.max(0, encSegCount(e) * FENCES[k].cost - Math.round(custoCercaDe(e) * .4));
    if (G.money < custo) { toast('💸 Dinheiro insuficiente', 'bad'); return; }
    const antes = e.fence;
    spend(custo, 'obra'); e.fence = k; e.integridade = 1;
    undoRegistrar({ kind: 'cerca', cat: 'obra', id: e.id, antes, depois: k, custo });
    closeModal(); showInspector(); toast(BI`🚧 Cerca trocada para ${LN(FENCES[k].n)}|🚧 Fence changed to ${LN(FENCES[k].n)}`, 'good');
  });
}
const pontosHTML = p => p.itens.map(([n, v, w]) =>
  `<div class="kv"><span>${n} <small style="opacity:.5">peso ${Math.round(w * 100)}%</small></span>
    <b style="color:${corDe(v)}">${Math.round(v * 100)}%</b></div>`).join('');
const animalEstado = a => a.fugiu ? '🚨 FUGIU' : a.doente ? '🤒 Doente'
  : a.estado === 'comendo' ? '🍽️ Comendo' : a.estado === 'andando' ? '🚶 Andando' : '😴 Descansando';
const animalSig = a => [a.id, a.enc, a.doente ? 1 : 0, a.gravida > 0 ? 1 : 0].join('|');

function inspAnimal(a) {
  if (a.morto) { deselect(); return; }
  const sp = a.sp, p = pontosAnimal(a);
  const e = enclosures.get(a.enc);
  const cv2 = spriteThumb(sp, 46, 46);
  const est = animalEstado(a);
  const pa = a.pensa = pensamentoAnimal(a);
  UI.insp.dataset.sig = animalSig(a);
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" id="iav"></div>
      <div><h3>${esc(a.name)} <small style="font-size:12px">${a.sexo === 'M' ? '♂' : '♀'}</small></h3>
        <div class="sub">${esc(LN(sp.name))}</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline">
      <span class="tag" id="iEstado">${est}</span>
      <span class="tag ${pa.urg >= .8 ? 'bad' : pa.urg >= .45 ? 'warn' : 'ok'}" id="iPensa">${pa.em} ${esc(pa.txt)}</span>
      <span class="tag">${BIOMES[sp.biome].em} ${sp.biomeName}</span>
      <span class="tag">${DIETS[sp.diet].em} ${sp.dietName}</span>
      ${a.gravida > 0 ? '<span class="tag ok">🤰 Gestante</span>' : ''}
    </div>
    ${bar('Felicidade', a.feliz, corDe(a.feliz), undefined, 'feliz')}
    ${bar(LN('Saúde|Health'), a.saude, corDe(a.saude), undefined, 'saude')}
    ${bar('Fome', 1 - a.fome, corDe(1 - a.fome), undefined, 'fome')}
    ${bar('Sede', 1 - a.sede, corDe(1 - a.sede), undefined, 'sede')}
    ${bar('Idade', a.idade / sp.lifespan, a.idade / sp.lifespan > .85 ? '#e2543f' : '#9a6ad4', a.idade.toFixed(1) + ' / ' + sp.lifespan + ' anos', 'idade')}
    <h4 class="sec">De onde vem a felicidade</h4>
    <div id="iPontos">${pontosHTML(p)}</div>
    <h4 class="sec">Ficha</h4>
    <div class="kv"><span>Recinto</span><b>${e ? esc(e.name) : '—'}</b></div>
    <div class="kv"><span>Espaço necessário</span><b>${sp.space} tiles</b></div>
    <div class="kv"><span>Grupo ideal</span><b>${sp.groupMin}–${sp.groupMax}</b></div>
    <div class="kv"><span>Ração</span><b>${moneyFull(sp.feed)}/dia</b></div>
    <div class="kv"><span>Popularidade</span><b class="stars">${stars(sp.appeal / 2)}</b></div>
    <div class="kv"><span>Valor de revenda</span><b>${moneyFull(valorRevenda(a))}</b></div>
    <div class="rowbtns">
      <button class="btn sm" id="ivoz">🔊 Ouvir</button>
      <button class="btn sm" id="igo">🎯 Centralizar</button>
      <button class="btn sm" id="isell">💰 Vender</button>
      <button class="btn sm" id="imove">📦 Transferir</button>
    </div>`;
  $('#iav').appendChild(cv2);
  $('#ix').onclick = deselect;
  $('#ivoz').onclick = () => { SFX.iniciar(); SFX.voz(sp, { vol: .32, imediato: true }); };
  $('#igo').onclick = () => centerOn(a.x, a.y);
  $('#isell').onclick = () => {
    const v = valorRevenda(a);
    if (!confirm(`Vender ${a.name} (${LN(sp.name)}) por ${moneyFull(v)}?`)) return;
    earn(v, 'venda'); a.morto = true;
    if (e) e.animals = e.animals.filter(z => z.id !== a.id);
    G.animals = G.animals.filter(z => z.id !== a.id);
    deselect(); toast('💰 ' + LN(sp.name) + ' vendido por ' + moneyFull(v), 'money');
  };
  $('#imove').onclick = () => transferir(a);
}
const valorRevenda = a => Math.round(a.sp.price * clamp(1.05 - a.idade / a.sp.lifespan * .6, .25, 1) * (.5 + a.saude * .5) * .72);
function transferir(a) {
  const opts = [...enclosures.values()].filter(e => e.id !== a.enc).map(e => {
    const chk = checarRecinto(a.sp, e);
    return `<div class="pitem" data-e="${e.id}" style="width:auto;min-width:150px;text-align:left;padding:8px 10px;${chk.bloqueia ? 'opacity:.45' : ''}">
      <b>${esc(e.name)}</b><br><span class="pr">${FENCES[e.fence].n} · ${encArea(e)} tiles · ${e.animals.length} animais</span>
      <br><span class="pr" style="color:${chk.bloqueia ? '#bd3f2d' : chk.msg ? '#c98a1c' : '#3b8c38'}">${chk.bloqueia ? '🚫 ' + chk.msg : chk.msg ? '⚠️ ' + chk.msg : '✅ Combina bem'}</span></div>`;
  }).join('');
  openModal(LN('Transferir |Transfer ') + a.name, opts || `<p>${LN('Não há outro recinto construído.|There is no other enclosure built.')}</p>`);
  $$('#modalBody .pitem').forEach(d => d.onclick = () => {
    const e2 = enclosures.get(+d.dataset.e);
    const chk = checarRecinto(a.sp, e2);
    if (chk.bloqueia) { toast('🚫 ' + chk.msg, 'bad'); return; }
    const e1 = enclosures.get(a.enc);
    if (e1) e1.animals = e1.animals.filter(z => z.id !== a.id);
    e2.animals.push(a); a.enc = e2.id;
    const t = encTileAleatorio(e2); if (t) { a.x = t[0] + .5; a.y = t[1] + .5; a.tx = a.x; a.ty = a.y; }
    closeModal(); showInspector(); toast(BI`📦 ${a.name} foi para ${e2.name}|📦 ${a.name} moved to ${e2.name}`, 'good');
  });
}
/** Atualização periódica do inspetor: mexe SÓ nos valores.
 *  Reconstruir o painel com innerHTML a cada 200ms trocava os botões de
 *  identidade no meio do toque — mousedown ia no botão antigo, mouseup no novo,
 *  e o navegador não gerava `click`. Era o "tenho que clicar várias vezes". */
function refreshInspector() {
  const s = G.sel;
  if (!s) return;
  if (s.kind === 'enc') {
    const e = s.ref;
    if (!enclosures.has(e.id)) { deselect(); return; }
    if (UI.insp.dataset.sig !== encSig(e)) { showInspector(); return; }
    const vivos = e.animals.filter(a => !a.morto);
    const felic = vivos.length ? vivos.reduce((x, a) => x + a.feliz, 0) / vivos.length : 0;
    setBar('felic', felic, corDe(felic));
    setBar('limp', e.limpeza, corDe(e.limpeza));
    setBar('comida', e.comida, corDe(e.comida));
    setBar('water', e.water, corDe(e.water));
    const enr = encEnrich(e); setBar('enr', enr, corDe(enr));
    if (vivos[0]) { const t = terrainScore(e, vivos[0].sp); setBar('terr', t, corDe(t)); }
    const al = $('#iAlerts'); if (al) al.innerHTML = encAlertasHTML(e);
    const mx = $('#iMix'); if (mx) mx.innerHTML = encMixHTML(e);
    for (const row of UI.insp.querySelectorAll('#ilist .kv')) {
      const a = vivos.find(z => z.id === +row.dataset.a); if (!a) continue;
      const b = row.querySelector('b');
      b.textContent = Math.round(a.feliz * 100) + '%'; b.style.color = corDe(a.feliz);
    }
  } else if (s.kind === 'animal') {
    const a = s.ref;
    if (a.morto) { deselect(); return; }
    if (UI.insp.dataset.sig !== animalSig(a)) { showInspector(); return; }
    setBar('feliz', a.feliz, corDe(a.feliz));
    setBar('saude', a.saude, corDe(a.saude));
    setBar('fome', 1 - a.fome, corDe(1 - a.fome));
    setBar('sede', 1 - a.sede, corDe(1 - a.sede));
    setBar('idade', a.idade / a.sp.lifespan, a.idade / a.sp.lifespan > .85 ? '#e2543f' : '#9a6ad4',
      a.idade.toFixed(1) + ' / ' + a.sp.lifespan + ' anos');
    const est = $('#iEstado'); if (est) est.textContent = animalEstado(a);
    const pa = a.pensa = pensamentoAnimal(a);
    const tp = $('#iPensa');
    if (tp) {
      tp.textContent = pa.em + ' ' + pa.txt;
      tp.className = 'tag ' + (pa.urg >= .8 ? 'bad' : pa.urg >= .45 ? 'warn' : 'ok');
    }
    const pts = $('#iPontos'); if (pts) pts.innerHTML = pontosHTML(pontosAnimal(a));
  } else if (s.kind === 'vis') {
    const v = s.ref;
    if (!G.visitors.includes(v)) { deselect(); return; }
    if (UI.insp.dataset.sig !== visitanteSig(v)) { showInspector(); return; }
    setBar('mood', v.mood, corDe(v.mood));
    for (const k in NEED_INFO) setBar('n_' + k, 1 - v.need[k], corDe(1 - v.need[k]));
    // recalcula na ficha aberta: o cache tem até ~2s de atraso e ficava
    // contradizendo as barras (dizia "morrendo de sede" com a sede cheia)
    const p = v.pensa = pensamentoVisitante(v);
    const est = $('#iEstado');
    if (est && p) {
      est.textContent = p.em + ' ' + p.txt;
      est.className = 'tag ' + (p.urg >= .8 ? 'bad' : p.urg >= .45 ? 'warn' : 'ok');
    }
    const din = $('#iDin'); if (din) din.textContent = moneyFull(v.dinheiro);
    const viu = $('#iViu'); if (viu) viu.textContent = v.vistos.size;
  }
}
function inspObject(o) {
  if (!objects.has(o.id)) { deselect(); return; }
  const B = BUILDINGS[o.kind] || DECOS[o.kind] || ENCOBJ[o.kind];
  const isShop = o.cat === 'build' && BUILDINGS[o.kind].value > 0;
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:26px">${B.em}</div>
      <div><h3>${B.n}</h3><div class="sub">${o.w}×${o.h}${BUILDINGS[o.kind] ? ' · fila: ' + o.fila.length : ''}</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    ${isShop ? `
      <h4 class="sec">Preço de venda</h4>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="range" id="ipr" min="0" max="250" value="${Math.round((o.mult === undefined ? 1 : o.mult) * 100)}" style="flex:1">
        <b id="iprv" style="min-width:64px;text-align:right">${moneyFull(precoDe(o))}</b>
      </div>
      <div style="font-size:11px;opacity:.65;margin-top:3px">Custo por unidade: ${moneyFull(BUILDINGS[o.kind].unitCost)}. Preço de referência: ${moneyFull(BUILDINGS[o.kind].value)}. Cobrar muito acima irrita os visitantes.</div>
      <div class="kv"><span>Vendas totais</span><b>${o.vendas}</b></div>
      <div class="kv"><span>Lucro acumulado</span><b class="${o.receita >= 0 ? 'pos' : 'negv'}">${moneyFull(o.receita)}</b></div>` : ''}
    ${BUILDINGS[o.kind] ? `<div class="kv"><span>${LN('Salário/semana|Wage/week')}</span><b>${moneyFull(BUILDINGS[o.kind].wage)}</b></div>` : ''}
    ${BUILDINGS[o.kind] && BUILDINGS[o.kind].supplies ? `<div class="kv"><span>Atende</span><b>${BUILDINGS[o.kind].supplies}</b></div>` : ''}
    ${DECOS[o.kind] ? `<div class="kv"><span>Beleza</span><b>+${DECOS[o.kind].beauty} (raio ${DECOS[o.kind].r})</b></div>` : ''}
    <div class="rowbtns"><button class="btn r sm" id="idel">🔨 Remover (+${moneyFull(Math.round((B.cost || 0) * .5))})</button></div>`;
  $('#ix').onclick = deselect;
  $('#idel').onclick = () => { earn(Math.round((B.cost || 0) * .5), 'venda'); removeObject(o.id); deselect(); };
  if (isShop) {
    const r = $('#ipr');
    r.oninput = () => { o.mult = r.value / 100; $('#iprv').textContent = moneyFull(precoDe(o)); };
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
    <div class="kv"><span>Salário</span><b>${moneyFull(T.wage)}/semana</b></div>
    <div class="kv"><span>Tarefas concluídas</span><b>${s.feitos}</b></div>
    <div class="kv"><span>Fazendo agora</span><b>${s.tarefa ? ({ enc: LN('Cuidando de recinto|Tending an enclosure'), animal: LN('Tratando animal|Treating an animal'), lixo: LN('Recolhendo lixo|Picking up litter'), fuga: LN('Recapturando fuga|Chasing an escapee') })[s.tarefa.kind] : LN('Patrulhando|Patrolling')}</b></div>
    <div class="rowbtns">
      <button class="btn sm" id="ivoz">🔊 Ouvir</button>
      <button class="btn sm" id="igo">🎯 Centralizar</button>
      <button class="btn r sm" id="ifire">👋 Demitir</button>
    </div>`;
  $('#ix').onclick = deselect;
  $('#ivoz').onclick = () => { SFX.iniciar(); SFX.vozHumana(s, { vol: .3, imediato: true }); };
  $('#igo').onclick = () => centerOn(s.x, s.y);
  $('#ifire').onclick = () => {
    G.staff = G.staff.filter(z => z.id !== s.id); deselect();
    toast('👋 ' + T.n + ' demitido', '');
  };
}

/* ---- equipe ---- */
function openStaff() {
  const cont = Object.keys(STAFF_TYPES).map(k => {
    const T = STAFF_TYPES[k], n = G.staff.filter(s => s.kind === k).length;
    return `<div class="pitem" data-t="${k}" style="width:auto;min-width:210px;text-align:left;padding:10px 12px">
      <span class="em">${T.em}</span><b>${LN(T.n)}</b> <span style="float:right">${n} ${LN('contratados|hired')}</span>
      <div class="pr" style="margin-top:3px">${T.desc}</div>
      <div class="pr">Salário: ${moneyFull(T.wage)}/semana</div>
      <button class="btn g sm" style="margin-top:7px" data-hire="${k}">+ Contratar</button>
      <button class="btn r sm" style="margin-top:7px" data-fire="${k}" ${n ? '' : 'disabled'}>− Demitir</button>
    </div>`;
  }).join('');
  const folha = G.staff.reduce((s, x) => s + STAFF_TYPES[x.kind].wage, 0)
    + [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].wage : 0), 0);
  openModal(LN('Equipe do zoológico|Zoo staff'),
    `<div style="display:flex;gap:9px;flex-wrap:wrap">${cont}</div>
     <p style="font-size:12px;opacity:.75;margin-top:12px">Sem <b>tratador</b> os animais passam fome e o recinto fica sujo. Sem <b>veterinário</b> doença vira morte. Sem <b>faxineiro</b> o lixo acumula e irrita os visitantes. Sem <b>segurança</b> uma fuga não é resolvida.</p>`,
    `<b>Folha semanal total: ${moneyFull(folha)}</b> <span style="font-size:12px;opacity:.6">(inclui atendentes das lojas)</span>`);
  $$('[data-hire]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const k = b.dataset.hire, T = STAFF_TYPES[k];
    if (G.money < T.wage) { toast(LN('💸 Sem caixa para o primeiro salário|💸 Not enough cash for the first wage'), 'bad'); return; }
    contratar(k); toast('🤝 ' + T.n + ' contratado', 'good'); openStaff();
  });
  $$('[data-fire]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const k = b.dataset.fire;
    const i = G.staff.findIndex(s => s.kind === k);
    if (i >= 0) { G.staff.splice(i, 1); openStaff(); }
  });
}

/* ---- finanças ---- */
function openFinance() {
  const L = G.ledger;
  const linha = (n, v, neg) => `<tr><td>${n}</td><td class="n ${v ? (neg ? 'negv' : 'pos') : ''}">${neg ? '-' : '+'}${moneyFull(v)}</td></tr>`;
  const folhaSem = G.staff.reduce((s, x) => s + STAFF_TYPES[x.kind].wage, 0)
    + [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].wage : 0), 0);
  const racaoDia = G.animals.filter(a => !a.morto).reduce((s, a) => s + a.sp.feed, 0);
  const hist = L.hist.slice(-10).reverse();
  const diag = diagnosticoPublico();
  openModal(LN('Finanças|Finance'),
    (diag ? `<div style="display:flex;gap:9px;align-items:center;margin-bottom:13px;padding:10px 12px;
        background:linear-gradient(#ffdcd4,#ffbdae);border:3px solid var(--ink);border-radius:13px;font-size:13px;line-height:1.4">
        <span style="font-size:21px;flex:none">${diag.em}</span><span>${diag.long}</span></div>` : '') +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h4 class="sec" style="margin-top:0">Hoje (dia ${G.day})</h4>
        <table class="fin">
          ${linha('Ingressos', L.hoje.ingresso)}
          ${linha(LN('Lojas e restaurantes|Shops and restaurants'), L.hoje.loja)}
          ${linha(LN('Venda de animais|Animal sales'), L.hoje.venda)}
          ${linha(LN('Ração e insumos|Feed and supplies'), L.hoje.feed, 1)}
          ${linha(LN('Salários|Wages'), L.hoje.wage, 1)}
          ${linha(LN('Manutenção e veterinário|Upkeep and vet'), L.hoje.manut, 1)}
          ${linha(LN('Compra de animais|Animal purchases'), L.hoje.compra, 1)}
          ${linha('Obras', L.hoje.obra, 1)}
          <tr><th>Saldo do dia</th><th class="n ${saldo(L.hoje) >= 0 ? 'pos' : 'negv'}">${moneyFull(saldo(L.hoje))}</th></tr>
        </table>
        <h4 class="sec">Compromissos fixos</h4>
        <table class="fin">
          <tr><td>Folha salarial</td><td class="n">${moneyFull(folhaSem)}/semana</td></tr>
          <tr><td>Ração dos animais</td><td class="n">${moneyFull(racaoDia)}/dia</td></tr>
          <tr><td>Empréstimo em aberto</td><td class="n">${moneyFull(G.emprestimo)}</td></tr>
        </table>
      </div>
      <div>
        <h4 class="sec" style="margin-top:0">Preço do ingresso</h4>
        <div style="display:flex;align-items:center;gap:9px">
          <input type="range" id="fTicket" min="0" max="${
    // o teto acompanha o zoo: sempre dá para passar bem do preço de referência
    Math.max(140, Math.ceil(precoJusto() * 1.8 / 10) * 10, Math.ceil(G.ticket / 10) * 10)
    }" value="${G.ticket}" style="flex:1">
          <b id="fTicketV" style="min-width:70px;text-align:right">${moneyFull(G.ticket)}</b>
        </div>
        <div id="fTicketHint" style="font-size:11.5px;opacity:.7;margin-top:4px"></div>
        <h4 class="sec">Marketing</h4>
        <div style="font-size:12px;opacity:.75;margin-bottom:6px">Campanha semanal atrai mais visitantes enquanto estiver ativa.</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn sm ${G.pesquisa.marketing === 0 ? 'on' : ''}" data-mk="0">Nenhum · R$ 0</button>
          <button class="btn sm ${G.pesquisa.marketing === 1 ? 'on' : ''}" data-mk="1">Local · R$ 1.500/sem</button>
          <button class="btn sm ${G.pesquisa.marketing === 2 ? 'on' : ''}" data-mk="2">Regional · R$ 5.000/sem</button>
          <button class="btn sm ${G.pesquisa.marketing === 3 ? 'on' : ''}" data-mk="3">Nacional · R$ 14.000/sem</button>
        </div>
        <h4 class="sec">Empréstimo</h4>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn b sm" data-loan="50000">Pegar R$ 50.000</button>
          <button class="btn b sm" data-loan="150000">Pegar R$ 150.000</button>
          <button class="btn g sm" data-pay="1">Quitar tudo</button>
        </div>
        <div style="font-size:11.5px;opacity:.7;margin-top:5px">Juros de 0,4% ao dia sobre o saldo devedor.</div>
        <h4 class="sec">Últimos dias</h4>
        <table class="fin"><tr><th>Dia</th><th class="n">Visitantes</th><th class="n">Saldo</th></tr>
        ${hist.map(h => `<tr><td>${h.dia}</td><td class="n">${h.vis}</td><td class="n ${h.saldo >= 0 ? 'pos' : 'negv'}">${moneyFull(h.saldo)}</td></tr>`).join('') || '<tr><td colspan="3" style="opacity:.6">Ainda não fechou um dia</td></tr>'}
        </table>
      </div>
    </div>`,
    `<b>Caixa: <span class="${G.money >= 0 ? 'pos' : 'negv'}">${moneyFull(G.money)}</span></b>
     <span style="margin-left:auto;font-size:12px;opacity:.7">Reputação ${G.rep.toFixed(1)}★ · ${G.animals.filter(a => !a.morto).length} animais · ${enclosures.size} recintos</span>`);
  const r = $('#fTicket'), rv = $('#fTicketV'), rh = $('#fTicketHint');
  const upd = () => {
    G.ticket = +r.value; rv.textContent = moneyFull(G.ticket);
    const just = precoJusto();
    rh.innerHTML = G.ticket > just * 1.35 ? LN('🔴 Caro demais para o que o zoo oferece — muita gente vai desistir na porta.|🔴 Too dear for what the zoo offers — plenty will give up at the gate.')
      : G.ticket > just * 1.05 ? LN('🟡 Um pouco acima do que o público acha justo.|🟡 A little above what the public considers fair.')
        : G.ticket < just * .55 ? LN('🔵 Barato: lota o parque, mas você deixa dinheiro na mesa.|🔵 Cheap: it fills the park, but you leave money on the table.')
          : LN('🟢 Preço bem calibrado para as atrações atuais.|🟢 Well calibrated for the current attractions.');
    rh.innerHTML += BI` <span style="opacity:.6">(referência: ${moneyFull(just)})</span>| <span style="opacity:.6">(reference: ${moneyFull(just)})</span>`;
  };
  r.oninput = upd; upd();
  $$('[data-mk]').forEach(b => b.onclick = () => { G.pesquisa.marketing = +b.dataset.mk; openFinance(); });
  $$('[data-loan]').forEach(b => b.onclick = () => {
    const v = +b.dataset.loan; G.money += v; G.emprestimo += v;
    toast(BI`🏦 Empréstimo de ${moneyFull(v)} liberado|🏦 Loan of ${moneyFull(v)} approved`, 'money'); openFinance();
  });
  $$('[data-pay]').forEach(b => b.onclick = () => {
    const v = Math.min(G.money, G.emprestimo);
    if (v <= 0) { toast('Nada a quitar', ''); return; }
    G.money -= v; G.emprestimo -= v; toast('🏦 Abatido ' + moneyFull(v), 'money'); openFinance();
  });
}
const saldo = o => o.ingresso + o.loja + o.venda - o.feed - o.wage - o.manut - o.compra - o.obra;

/** Por que a bilheteria está parada? Devolve o primeiro motivo estrutural, na
 *  ordem em que o jogador precisa resolver — ou null se está tudo certo.
 *  Existe porque zero visitante sem explicação é indistinguível de bug. */
function diagnosticoPublico() {
  // `key` identifies the diagnosis regardless of language — the HUD compares
  // against it instead of against the translated headline
  const D = (em, curto, longo, key) => ({ em, curto, longo, key });
  const vivos = G.animals.filter(a => !a.morto && !a.fugiu);
  if (!vivos.length)
    return D('🦁', LN('Sem animais|No animals'), LN('<b>Nenhum animal no zoológico.</b> Sem atração ninguém paga ingresso — compre bichos na aba Animais.|<b>No animals in the zoo.</b> With no attraction nobody pays for a ticket — buy some on the Animals tab.'), 'noanimals');
  if (!pathConnected(ENTRANCE.x, ENTRANCE.y))
    return D('🛣️', LN('Portão sem trilha|Gate with no path'), LN('<b>Nenhuma trilha ligada ao portão</b> (base do mapa). Sem caminho a partir da entrada, ninguém consegue entrar.|<b>No path connected to the gate</b> (bottom of the map). With no route from the entrance, nobody can get in.'), 'nopath');
  const visiveis = [...enclosures.values()]
    .filter(e => e.animals.some(a => !a.morto) && encViewSpots(e).length);
  if (!visiveis.length)
    return D('👀', LN('Recinto sem trilha ao lado|Enclosure with no path beside it'), LN('<b>Nenhum recinto tem trilha ao lado.</b> Passe um caminho encostado na cerca — os visitantes só veem o animal de cima da trilha.|<b>No enclosure has a path beside it.</b> Run a path against the fence — visitors only see an animal from the path.'), 'noview');
  const justo = precoJusto();
  if (G.ticket > justo * 1.4)
    return D('🎟️', LN('Ingresso caro demais|Ticket too expensive'), BI`<b>Ingresso de ${moneyFull(G.ticket)} está muito acima do que o público acha justo</b> (~${moneyFull(justo)}). A maioria desiste na porta.|<b>A ${moneyFull(G.ticket)} ticket is well above what the public considers fair</b> (~${moneyFull(justo)}). Most give up at the gate.`, 'pricey');
  if (G.hour < OPEN_H || G.hour >= CLOSE_H)
    return D('🌙', LN('Zoológico fechado|Zoo closed'), BI`O zoológico está fechado (abre às ${OPEN_H}h). Os visitantes voltam de manhã.|The zoo is closed (it opens at ${OPEN_H}:00). The visitors come back in the morning.`, 'closed');
  return null;
}
/** preço de ingresso que o público considera justo, dado o acervo */
function precoJusto() {
  let v = 4;
  for (const e of enclosures.values()) {
    if (!encViewSpots(e).length) continue;
    const F = FENCES[e.fence];
    for (const a of e.animals) if (!a.morto) v += a.sp.draw * F.sight * (.4 + a.feliz * .6) * .55;
  }
  v += [...objects.values()].filter(o => o.cat === 'build' && BUILDINGS[o.kind].supplies).length * .7;
  return Math.round(clamp(v, 4, 260));
}

/* ==========================================================================
   11b. RELATÓRIO DE SATISFAÇÃO — de onde vem cada reclamação
   ========================================================================== */
/** o que fazer a respeito, indexado pelo ícone do pensamento */
const DICAS = {
  '🚻': 'Construa Banheiros perto das trilhas movimentadas.',
  '🥤': 'Um Quiosque de Bebidas ou Bebedouro resolve a sede.',
  '🍔': 'Falta comida: Lanchonete, Pizzaria ou Restaurante.',
  '🍟': 'Espalhe mais pontos de comida ao longo do percurso.',
  '😩': 'Bancos de Praça pelo caminho para o pessoal descansar.',
  '🪑': 'Bancos de Praça reduzem o cansaço de caminhar.',
  '🤢': 'Contrate Faxineiros e ponha Lixeiras nas trilhas.',
  '🥱': 'Mais animais de appeal alto, ou um Playground.',
  '💸': 'Baixe o ingresso em Finanças, ou acrescente atrações.',
  '😱': 'Contrate Segurança e reforce a cerca do recinto.',
  '😠': 'Veja os outros motivos da lista — algo está faltando.',
  '😐': 'Nada urgente, mas o parque não empolga: decore e diversifique.',
  '💧': 'Ponha Bebedouro no recinto e tenha um Tratador de plantão.',
  '😖': 'Recinto apertado: amplie ou separe os animais.',
  '💩': 'Contrate mais Tratadores — eles limpam os recintos.',
  '⚠️': LN('Troque por uma cerca mais forte (inspetor do recinto).|Swap in a stronger fence (enclosure inspector).'),
  '🤕': 'Contrate um Veterinário.',
  '🤒': 'Contrate um Veterinário.',
  '👥': 'Compre mais animais da mesma espécie.',
  '😤': 'Grupo grande demais: venda ou transfira alguns.',
  '🕸️': LN('Troque a cerca por Tela de Aviário.|Swap the fence for Aviary Mesh.'),
  '🌊': 'Troque a cerca por Vidro de Aquário.',
  '🏃': 'Contrate Segurança para recapturar o animal.',
  '👴': 'Idade avançada — considere trazer animais mais jovens.',
};
for (const k in COMIDA_EM) DICAS[COMIDA_EM[k]] = LN('Ponha Comedouro no recinto e tenha um Tratador.|Put a Feeder in the enclosure and hire a Keeper.');
for (const k in BIOMES) DICAS[BIOMES[k].em] = LN('Pinte o terreno do recinto com o bioma pedido (aba Terreno).|Paint the enclosure terrain with the biome it asks for (Terrain tab).');

/** Conta os pensamentos de uma população e devolve ranking.
 *  Calcula na hora quem ainda não tem: com o jogo pausado ou recém-carregado
 *  ninguém passou pelo update, e o relatório saía vazio com o parque cheio. */
function agruparPensamentos(lista, fn) {
  const m = new Map();
  for (const ent of lista) {
    const p = ent.pensa || (fn ? (ent.pensa = fn(ent)) : null); if (!p) continue;
    const k = p.em + '|' + p.txt;
    const r = m.get(k) || { em: p.em, txt: p.txt, urg: p.urg, n: 0 };
    r.n++; m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.urg - a.urg || b.n - a.n);
}
function linhaMotivo(r, total) {
  const p = Math.round(r.n / Math.max(1, total) * 100);
  const col = r.urg >= .8 ? '#e2543f' : r.urg >= .45 ? '#ffc23c' : '#4fae4a';
  const dica = DICAS[r.em];
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
function openSatisfacao() {
  fecharPaleta();
  const vis = G.visitors;
  const ani = G.animals.filter(a => !a.morto);
  const rv = agruparPensamentos(vis, pensamentoVisitante), ra = agruparPensamentos(ani, pensamentoAnimal);
  const moodV = vis.length ? vis.reduce((s, v) => s + v.mood, 0) / vis.length : G.stats.felicidade;
  const moodA = ani.length ? ani.reduce((s, a) => s + a.feliz, 0) / ani.length : 0;
  const cara = m => m > .75 ? '😄' : m > .55 ? '🙂' : m > .35 ? '😐' : m > .2 ? '🙁' : '😠';
  const bloco = (titulo, cnt, mood, ranking, vazio) => `
    <div>
      <h4 class="sec" style="margin-top:0">${titulo}</h4>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
        <span style="font-size:31px">${cara(mood)}</span>
        <div><div style="font-size:21px;line-height:1">${Math.round(mood * 100)}%</div>
          <div style="font-size:11px;opacity:.6">${cnt} ${LN('no parque|in the park')}</div></div>
      </div>
      ${ranking.length ? ranking.map(r => linhaMotivo(r, cnt)).join('') : `<div style="font-size:12px;opacity:.6">${vazio}</div>`}
    </div>`;
  openModal(LN('Satisfação — por quê?|Satisfaction — why?'),
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      ${bloco(LN('👥 Visitantes|👥 Visitors'), vis.length, moodV, rv, LN('Ninguém no parque agora.|Nobody in the park right now.'))}
      ${bloco('🐾 Animais', ani.length, moodA, ra, 'Nenhum animal ainda.')}
     </div>
     <h4 class="sec">Como ler os balões no mapa</h4>
     <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px">
       <span class="tag bad">Fundo vermelho = problema grave</span>
       <span class="tag warn">Amarelo = incomodado</span>
       <span class="tag ok">Verde = satisfeito</span>
     </div>
     <div style="font-size:12px;opacity:.75;margin-top:8px">
       O botão 💭 no topo alterna entre <b>só quem está insatisfeito</b>, <b>todos</b> e <b>desligado</b>
       (atalho <kbd>B</kbd>). Toque num animal ou visitante para ver a ficha completa.
     </div>`,
    `<b>Satisfação geral: ${Math.round(moodV * 100)}%</b>
     <span style="margin-left:auto;font-size:12px;opacity:.7">Reputação ${G.rep.toFixed(1)}★ — é ela que define quanta gente aparece</span>`);
}

/* ---- painel de reputação: de onde vem a nota ---- */
function openReputacao() {
  fecharPaleta();
  const vivos = G.animals.filter(a => !a.morto);
  const felAn = vivos.length ? vivos.reduce((s, a) => s + a.feliz, 0) / vivos.length : 0;
  const felVis = G.stats.felicidade;
  const variedade = new Set(vivos.map(a => a.sp.id)).size;
  let lixoS = 0, lixoN = 0;
  for (let i = 0; i < W * H; i++) if (world.path[i]) { lixoS += world.lixo[i]; lixoN++; }
  const lixoMed = lixoN ? lixoS / lixoN : 0;
  const alvo = qualidadeParque();
  // os mesmos pesos de qualidadeParque(), abertos linha a linha
  const comp = [
    ['🐾', 'Bem-estar dos animais', felAn, felAn * 1.7],
    ['👥', 'Satisfação dos visitantes', felVis, felVis * 1.9],
    ['🦁', BI`Variedade de espécies (${variedade})|Species variety (${variedade})`, Math.min(variedade, 30) / 30, Math.min(variedade, 30) / 30 * 1.1],
    ['🗑️', 'Lixo nas trilhas', lixoMed, -lixoMed * 1.2],
    ['🚨', `Animais soltos agora (${G.escaped.length})`, null, -G.escaped.length * .25],
  ];
  const linha = ([em, name, frac, pts]) => `
    <div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:22px;text-align:center">${em}</span>
      <span style="flex:1;font-size:12.5px">${name}</span>
      ${frac === null ? '' : `<div style="width:110px;height:8px;background:#e8e0cc;border-radius:4px;overflow:hidden">
        <div style="width:${Math.round(clamp(frac, 0, 1) * 100)}%;height:100%;background:${pts >= 0 ? '#4fae4a' : '#e2543f'}"></div></div>`}
      <b style="width:56px;text-align:right;font-size:12.5px;color:${pts >= 0 ? '#2f7a2f' : '#b3402f'}">${pts >= 0 ? '+' : ''}${pts.toFixed(2)}★</b>
    </div>`;
  // extrato: resumo por tipo + últimos acontecimentos
  const NOME_EV = { '💀': 'mortes', '🚨': 'fugas', '🎉': 'nascimentos', '🗳️': 'avaliações do público', '📉': 'quedas', '📈': 'subidas' };
  const porTipo = new Map();
  for (const r of G.repLog) {
    const g = porTipo.get(r.em) || { em: r.em, n: 0, soma: 0 };
    g.n++; g.soma += r.delta; porTipo.set(r.em, g);
  }
  const chips = [...porTipo.values()].sort((a, b) => Math.abs(b.soma) - Math.abs(a.soma))
    .map(g => `<span class="tag ${g.soma >= 0 ? 'ok' : 'bad'}">${g.em} ${g.n}× ${NOME_EV[g.em] || ''} (${g.soma >= 0 ? '+' : ''}${g.soma.toFixed(2)}★)</span>`)
    .join('');
  const lista = G.repLog.slice(-12).reverse().map(r => `
    <div style="display:flex;gap:8px;font-size:12.5px;margin:3px 0;align-items:baseline">
      <span style="opacity:.55;width:46px;flex:none">Dia ${r.dia}</span><span style="flex:none">${r.em}</span>
      <span style="flex:1">${esc(r.motivo)}</span>
      <b style="color:${r.delta >= 0 ? '#2f7a2f' : '#b3402f'}">${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}</b>
    </div>`).join('')
    || `<div style="font-size:12px;opacity:.6">${LN('Nada registrado ainda — mortes, fugas, nascimentos e as avaliações de quem visita entram aqui.|Nothing recorded yet — deaths, escapes, births and visitor ratings all land here.')}</div>`;
  const seta = alvo > G.rep + .05 ? LN('📈 subindo|📈 rising') : alvo < G.rep - .05 ? LN('📉 caindo|📉 falling') : LN('➡️ estável|➡️ steady');
  openModal(LN('Reputação — de onde vem a nota|Reputation — where the score comes from'),
    `<div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
      <span style="font-size:34px">⭐</span>
      <div>
        <div style="font-size:24px;line-height:1.1"><b>${G.rep.toFixed(1)}</b><span style="font-size:14px;opacity:.6">/5</span>
          <span class="stars" style="font-size:15px">${stars(G.rep)}</span></div>
        <div style="font-size:12px;opacity:.75">A nota caminha todo dia rumo à qualidade real do parque:
          <b>${alvo.toFixed(1)}★</b> — ${seta}</div>
      </div>
    </div>
    <h4 class="sec">Avaliação contínua (qualidade real)</h4>
    ${comp.map(linha).join('')}
    <div style="font-size:11.5px;opacity:.65;margin-top:2px">Soma limitada a 0–5★. Clique em 😊 Satisfação para ver as reclamações ao vivo.</div>
    <h4 class="sec">Acontecimentos que mexeram na nota</h4>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px">${chips || '<span style="font-size:12px;opacity:.6">—</span>'}</div>
    ${lista}`,
    `<b>⭐ ${G.rep.toFixed(1)}</b>
     <span style="margin-left:auto;font-size:12px;opacity:.7">É a reputação que define quanta gente aparece no portão</span>`);
}

/* ---- inspetor de visitante ---- */
const NEED_INFO = {
  fome: ['🍔', 'Fome'], sede: ['🥤', 'Sede'], banheiro: ['🚻', 'Banheiro'],
  energia: ['🪑', 'Cansaço'], diversao: ['🎡', 'Vontade de se divertir'],
};
const visitanteSig = v => v.id + '|' + (v.saindo ? 1 : 0);
function inspVisitor(v) {
  if (!G.visitors.includes(v)) { deselect(); return; }
  UI.insp.dataset.sig = visitanteSig(v);
  const p = v.pensa || pensamentoVisitante(v);
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:25px">${v.crianca ? '🧒' : '🧑'}</div>
      <div><h3>${v.crianca ? LN('Criança|Child') : LN('Visitante|Visitor')}</h3>
        <div class="sub">${v.saindo ? 'Indo embora' : 'Passeando'} · ${v.tempo.toFixed(1)}h no parque</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline"><span class="tag ${p.urg >= .8 ? 'bad' : p.urg >= .45 ? 'warn' : 'ok'}" id="iEstado">
      ${p.em} ${esc(p.txt)}</span></div>
    ${bar(LN('Satisfação|Satisfaction'), v.mood, corDe(v.mood), undefined, 'mood')}
    <h4 class="sec">Necessidades (cheio = tranquilo)</h4>
    ${Object.keys(NEED_INFO).map(k => bar(NEED_INFO[k][0] + ' ' + NEED_INFO[k][1],
      1 - v.need[k], corDe(1 - v.need[k]), undefined, 'n_' + k)).join('')}
    <h4 class="sec">Carteira e passeio</h4>
    <div class="kv"><span>Dinheiro no bolso</span><b id="iDin">${moneyFull(v.dinheiro)}</b></div>
    <div class="kv"><span>Recintos que já viu</span><b id="iViu">${v.vistos.size}</b></div>
    <div class="kv"><span>${LN('Levando|Carrying')}</span><b>${v.item === 'balao' ? LN('🎈 Balão|🎈 Balloon') : v.item === 'comida' ? LN('🍔 Comida|🍔 Food') : '—'}</b></div>
    <div class="rowbtns">
      <button class="btn sm" id="ivoz">🔊 Ouvir</button>
      <button class="btn sm" id="igo">🎯 Centralizar</button>
    </div>`;
  $('#ix').onclick = deselect;
  $('#ivoz').onclick = () => { SFX.iniciar(); SFX.vozHumana(v, { vol: .3, imediato: true }); };
  $('#igo').onclick = () => centerOn(v.x, v.y);
}

/* ---- ajuda ---- */
function openHelp() {
  fecharPaleta();
  openModal('Como jogar',
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:13px;line-height:1.55">
      <div>
        <h4 class="sec" style="margin-top:0">O ciclo básico</h4>
        <ol style="padding-left:17px">
          <li><b>Trilhas</b> — desenhe um caminho saindo do portão (base do mapa). Sem trilha ligada ao portão, ninguém entra.</li>
          <li><b>Recinto</b> — arraste um retângulo (mín. 3×3). O perímetro vira cerca; o miolo é onde o bicho vive.</li>
          <li><b>Terreno</b> — pinte o miolo com o biome da espécie (savana quer grama+terra, tundra quer neve...).</li>
          <li><b>Objetos</b> — todo recinto precisa de <b>comedouro</b> e <b>bebedouro</b>. Enriquecimento sobe a felicidade.</li>
          <li><b>Animais</b> — compre na loja e clique no recinto. Passe trilha ao lado, senão ninguém vê.</li>
          <li><b>Equipe</b> — contrate tratador, veterinário, faxineiro e segurança.</li>
          <li><b>Comércio</b> — lanchonete, bebida e banheiro perto das trilhas movimentadas.</li>
        </ol>
      </div>
      <div>
        <h4 class="sec" style="margin-top:0">O que move o dinheiro</h4>
        <ul style="padding-left:17px">
          <li><b>Ingresso</b>: cobrado na entrada. Cobre acima do "preço justo" e o público some.</li>
          <li><b>Lojas</b>: cada uma tem preço regulável no inspetor. Margem alta afasta, margem baixa lota.</li>
          <li><b>Reputação</b> sobe com visitante feliz e desce com morte, fuga e sujeira. Ela controla quanta gente aparece.</li>
          <li><b>Contas</b> caem a cada 7 dias (salários) e a ração é debitada quando o tratador reabastece.</li>
        </ul>
        <h4 class="sec">Felicidade do animal</h4>
        <div>Espaço, biome correto, tamanho do grupo, enriquecimento, limpeza, saúde, comida e cerca adequada. O inspetor de cada animal mostra a nota item por item — é onde você descobre o que consertar.</div>
        <h4 class="sec">Atalhos</h4>
        <div><kbd>1</kbd>–<kbd>9</kbd> abas · <kbd>Espaço</kbd> pausa · <kbd>Esc</kbd> cancela ferramenta · <kbd>M</kbd> minimapa · botão direito arrasta a câmera · roda dá zoom · <kbd>Del</kbd> demole o selecionado</div>
      </div>
    </div>`,
    `<button class="btn g" id="hOk">Entendi</button>
     <button class="btn sm" id="hSave">💾 Salvar aqui</button>
     <button class="btn sm" id="hLoad">📂 Carregar</button>
     <button class="btn b sm" id="hDlSave">📥 Baixar save (.json)</button>
     <button class="btn b sm" id="hDlTxt">📄 Baixar status (.txt)</button>
     <button class="btn sm" id="hUp">📤 Abrir save do arquivo</button>
     <button class="btn r sm" id="hReset">🔄 Recomeçar</button>`);
  $('#hOk').onclick = closeModal;
  $('#hSave').onclick = () => { salvar(); };
  $('#hLoad').onclick = () => { if (confirm(LN('Carregar o jogo salvo neste navegador? O progresso atual será perdido.|Load the game saved in this browser? The current progress will be lost.'))) carregar(); };
  $('#hDlSave').onclick = () => exportarSave();
  $('#hDlTxt').onclick = () => exportarRelatorio();
  $('#hUp').onclick = () => $('#fileSave').click();   // input permanente, fora do modal
  $('#hReset').onclick = () => { if (confirm(LN('Recomeçar do zero?|Start over from scratch?'))) { localStorage.removeItem('zoo_save'); location.reload(); } };
}