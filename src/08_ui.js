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
  const mostra = !!diag && diag.curto !== 'Zoológico fechado';
  w.classList.toggle('show', mostra);
  if (mostra) {
    $('#vWarn').textContent = diag.curto;
    w.querySelector('.ic').textContent = diag.em;
  }
}

/* ---- categorias do dock ---- */
const CATS = [
  { k: 'caminho', n: 'Trilhas', em: '🛣️' },
  { k: 'recinto', n: 'Recintos', em: '🚧' },
  { k: 'terreno', n: 'Terreno', em: '🎨' },
  { k: 'encobj', n: 'No Recinto', em: '🥣' },
  { k: 'animal', n: 'Animais', em: '🦁' },
  { k: 'build', n: 'Comércio', em: '🍔' },
  { k: 'deco', n: 'Decoração', em: '🌳' },
  { k: 'equipe', n: 'Equipe', em: '🧑‍🌾' },
  { k: 'financas', n: 'Finanças', em: '💰' },
  { k: 'demolir', n: 'Demolir', em: '🔨' },
];
function buildDock() {
  UI.dock.innerHTML = '';
  for (const c of CATS) {
    const b = el('button', 'btn', `<i>${c.em}</i>${c.n}`);
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
  if (k === 'demolir') { fecharPaleta(); setTool({ cat: 'demolir', em: '🔨', n: 'Demolir' }); return; }
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
    title.textContent = 'Trilhas — clique e arraste para desenhar o caminho dos visitantes';
    add('Calçada', '🛣️', 30, { cat: 'caminho', key: 'piso', em: '🛣️', n: 'Calçada', cost: 30 });
    add('Apagar trilha', '🧽', 0, { cat: 'caminho', key: 'del', em: '🧽', n: 'Apagar trilha', cost: 0 });
  } else if (k === 'recinto') {
    title.textContent = 'Recintos — arraste um retângulo (mínimo 3×3). O preço cobre a cerca do perímetro.';
    for (const key in FENCES) {
      const F = FENCES[key];
      add(F.n, F.em, F.cost, { cat: 'recinto', key, em: F.em, n: F.n, cost: F.cost },
        `<span class="pr">força ${F.forca} · visão ${Math.round(F.visao * 100)}%</span>`);
    }
  } else if (k === 'terreno') {
    title.textContent = 'Terreno — pinte dentro dos recintos para bater com o bioma da espécie';
    for (const key of TKEYS) {
      if (key === 'piso') continue;
      const T = TERRAIN[key];
      add(T.n, T.em, T.cost, { cat: 'terreno', key, em: T.em, n: T.n, cost: T.cost });
    }
  } else if (k === 'encobj') {
    title.textContent = 'Objetos de recinto — comedouro e bebedouro são obrigatórios para manter os animais vivos';
    for (const key in ENCOBJ) {
      const O = ENCOBJ[key];
      add(O.n, O.em, O.cost, { cat: 'encobj', key, em: O.em, n: O.n, cost: O.cost, w: 1, h: 1 },
        O.enr ? `<span class="pr">enriquecimento +${O.enr}</span>` : '');
    }
  } else if (k === 'build') {
    title.textContent = 'Comércio e serviços — cada um atende uma necessidade dos visitantes';
    for (const key in BUILDINGS) {
      const B = BUILDINGS[key];
      add(B.n, B.em, B.cost, { cat: 'build', key, em: B.em, n: B.n, cost: B.cost, w: B.w, h: B.h },
        `<span class="pr">${B.w}×${B.h}${B.supre ? ' · ' + B.supre : ''}</span>`);
    }
  } else if (k === 'deco') {
    title.textContent = 'Decoração — aumenta a beleza da área e o humor de quem passa perto';
    for (const key in DECOS) {
      const D = DECOS[key];
      add(D.n, D.em, D.cost, { cat: 'deco', key, em: D.em, n: D.n, cost: D.cost, w: 1, h: 1 },
        `<span class="pr">beleza +${D.beleza}</span>`);
    }
  }
}
function setTool(t) {
  if (t) SFX.toca('aba');
  G.tool = t; G.drag = null;
  if (!t) { hint(null); return; }
  const dicas = {
    caminho: 'Arraste para desenhar a trilha.',
    recinto: t.ampliando
      ? 'Arraste <b>encostando no recinto</b> para ampliá-lo. Pode repetir para fazer L, T ou U.'
      : 'Arraste um retângulo para criar. Depois arraste <b>colado nele</b> para ampliar — o formato não precisa ser quadrado.',
    terreno: 'Arraste para pintar o terreno.<span class="ctrlMouse"> <kbd>Shift</kbd> pinta 3×3.</span>',
    encobj: 'Coloque dentro de um recinto já construído.',
    build: 'Posicione junto a uma trilha para os visitantes conseguirem chegar.',
    deco: 'Espalhe pelo parque — quanto mais bonito, mais felizes os visitantes.',
    animal: `Toque num recinto para soltar <b>${t.sp ? t.sp.nome : ''}</b> lá dentro.`,
    demolir: 'Toque no que quiser remover. Recintos devolvem metade do valor da cerca.',
  };
  hint(`<span style="font-size:17px">${t.em || '🔧'}</span> <b>${t.n || ''}</b> — ${dicas[t.cat] || ''}` +
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
let shopFiltro = { q: '', bioma: '', dieta: '', ord: 'apelo' };
let shopEncId = null;
function openShop(encId) {
  shopEncId = encId || null;
  const e = encId ? enclosures.get(encId) : null;
  const optB = ['<option value="">Todos os biomas</option>']
    .concat(Object.keys(BIOMAS).map(k => `<option value="${k}">${BIOMAS[k].em} ${BIOMAS[k].n}</option>`)).join('');
  const optD = ['<option value="">Todas as dietas</option>']
    .concat(Object.keys(DIETA).map(k => `<option value="${k}">${DIETA[k].em} ${DIETA[k].n}</option>`)).join('');
  openModal(e ? `Comprar animal para ${e.nome}` : 'Loja de Animais',
    `<div id="shopBar">
       <input type="text" id="shopQ" placeholder="🔎 Buscar espécie..." style="flex:1;min-width:170px">
       <select id="shopB">${optB}</select>
       <select id="shopD">${optD}</select>
       <select id="shopO">
         <option value="apelo">Ordenar: popularidade</option>
         <option value="preco">Ordenar: preço ↑</option>
         <option value="precoD">Ordenar: preço ↓</option>
         <option value="nome">Ordenar: A–Z</option>
         <option value="espaco">Ordenar: espaço</option>
       </select>
       <span id="shopCount" style="font-size:12px;opacity:.6"></span>
     </div>
     <div id="shopGrid"></div>`,
    e ? `<b style="font-size:13px">${e.nome}</b> <span style="font-size:12px;opacity:.7">— ${FENCES[e.fence].n}, ${encArea(e)} tiles livres, ${e.animals.length} animais</span>`
      : `<span style="font-size:12px;opacity:.75">Escolha uma espécie e depois toque no recinto onde ela vai morar. Verde = combina com o recinto selecionado.</span>`);
  $('#shopQ').oninput = ev => { shopFiltro.q = ev.target.value.toLowerCase(); renderShop(); };
  $('#shopB').onchange = ev => { shopFiltro.bioma = ev.target.value; renderShop(); };
  $('#shopD').onchange = ev => { shopFiltro.dieta = ev.target.value; renderShop(); };
  $('#shopO').onchange = ev => { shopFiltro.ord = ev.target.value; renderShop(); };
  renderShop();
}
let shopObserver = null;
function renderShop() {
  const grid = $('#shopGrid'); if (!grid) return;
  grid.innerHTML = '';
  const e = shopEncId ? enclosures.get(shopEncId) : null;
  let list = SPECIES.filter(s =>
    (!shopFiltro.q || s.nome.toLowerCase().includes(shopFiltro.q) || s.biomaN.toLowerCase().includes(shopFiltro.q)) &&
    (!shopFiltro.bioma || s.bioma === shopFiltro.bioma) &&
    (!shopFiltro.dieta || s.dieta === shopFiltro.dieta));
  const ord = { apelo: (a, b) => b.apelo - a.apelo || a.preco - b.preco, preco: (a, b) => a.preco - b.preco, precoD: (a, b) => b.preco - a.preco, nome: (a, b) => a.nome.localeCompare(b.nome), espaco: (a, b) => a.espaco - b.espaco };
  list = list.slice().sort(ord[shopFiltro.ord]);
  $('#shopCount').textContent = list.length + ' espécies';
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
        console.error('Falha ao desenhar', SPECIES[+d.dataset.sp].nome, err);
        d.querySelector('.pic').textContent = '🐾';
      }
    }
  }, { root: UI.mBody, rootMargin: '260px' });

  for (const sp of list) {
    const pode = G.money >= sp.preco;
    const combina = e ? terrainScore(e, sp) : null;
    const card = el('div', 'acard' + (pode ? '' : ' dis'));
    card.dataset.sp = sp.id;
    const bg = combina === null ? '#eef4ea' : combina > .7 ? '#d7f0cf' : combina > .4 ? '#fbf0cf' : '#f8dcd6';
    card.innerHTML =
      `<div class="pic" style="background:${bg}"></div>
       <div class="nm">${esc(sp.nome)}</div>
       <div class="mt">${BIOMAS[sp.bioma].em} ${sp.biomaN} · ${DIETA[sp.dieta].em} ${sp.dietaN}<br>
         ${sp.espaco} tiles/animal · grupo ${sp.gmin}–${sp.gmax} · ${sp.vida} anos<br>
         ração ${moneyFull(sp.racao)}/dia · perigo ${'⚠️'.repeat(Math.min(sp.perigo, 5)) || '—'}</div>
       <div class="ft"><span class="stars">${stars(sp.apelo / 2)}</span><b>${moneyFull(sp.preco)}</b></div>`;
    card.onclick = () => {
      if (!pode) { toast('💸 Dinheiro insuficiente para ' + sp.nome, 'bad'); return; }
      if (shopEncId && enclosures.has(shopEncId)) { comprarPara(sp, enclosures.get(shopEncId)); closeModal(); }
      else { setTool({ cat: 'animal', key: 'sp' + sp.id, sp, em: '🐾', n: sp.nome, cost: sp.preco }); closeModal(); }
    };
    grid.appendChild(card);
    shopObserver.observe(card);
  }
}
function comprarPara(sp, e) {
  const aviso = checarRecinto(sp, e);
  if (aviso.bloqueia) { toast('🚫 ' + aviso.msg, 'bad'); return false; }
  if (G.money < sp.preco) { toast('💸 Dinheiro insuficiente', 'bad'); return false; }
  spend(sp.preco, 'compra');
  const a = novoAnimal(sp, e.id);
  e.animals.push(a);
  toast(`🎉 ${sp.nome} chegou ao ${e.nome}!`, 'good');
  if (aviso.msg) toast('⚠️ ' + aviso.msg, 'bad');
  return true;
}
function checarRecinto(sp, e) {
  const F = FENCES[e.fence];
  const irmaos = e.animals.filter(z => z.sp.id === sp.id).length;
  const outras = new Set(e.animals.map(z => z.sp.id)); outras.delete(sp.id);
  if (outras.size > 0) {
    const carnivoro = sp.dieta === 'carn' || e.animals.some(z => z.dieta === 'carn');
    if (carnivoro) return { bloqueia: true, msg: 'Não dá para misturar carnívoros com outras espécies nesse recinto.' };
  }
  if (encArea(e) < sp.espaco) return { bloqueia: true, msg: `${sp.nome} precisa de ${sp.espaco} tiles e o recinto só tem ${encArea(e)}.` };
  if (encArea(e) < sp.espaco * (irmaos + 1)) return { bloqueia: false, msg: 'O recinto vai ficar apertado — a felicidade cai.' };
  if (sp.perigo > F.forca) return { bloqueia: false, msg: `${FENCES[e.fence].n} é fraca demais: risco de fuga.` };
  if (sp.voa && !F.aereo) return { bloqueia: false, msg: 'Ave sem tela de aviário fica infeliz e pode escapar.' };
  if (sp.aquatico && !F.aquatico) return { bloqueia: false, msg: 'Espécie aquática pede vidro de aquário.' };
  if (terrainScore(e, sp) < .35) return { bloqueia: false, msg: `Terreno não combina com o bioma ${sp.biomaN}.` };
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
  if (s.tipo === 'enc') inspEnclosure(s.ref);
  else if (s.tipo === 'animal') inspAnimal(s.ref);
  else if (s.tipo === 'obj') inspObject(s.ref);
  else if (s.tipo === 'staff') inspStaff(s.ref);
  else if (s.tipo === 'vis') inspVisitor(s.ref);
}
/** assinatura do que exige reconstruir o painel (o resto é só valor a atualizar) */
const encSig = e => [e.nome, e.fence, e.tiles.size,
  e.animals.filter(a => !a.morto).map(a => a.id).join(','),
  e.objs.map(o => o.kind).join(',')].join('|');
/** composição do terreno em tags — muda a cada pincelada, então é atualizada
 *  no refresh em vez de ficar congelada no HTML da abertura */
const encMixHTML = e => Object.entries(encMix(e)).sort((a, b) => b[1] - a[1]).slice(0, 5)
  .map(([k, v]) => `<span class="tag">${TERRAIN[k].em} ${TERRAIN[k].n} ${Math.round(v * 100)}%</span>`).join('');
function encAlertasHTML(e) {
  const F = FENCES[e.fence];
  const vivos = e.animals.filter(a => !a.morto);
  const sp0 = vivos[0] ? vivos[0].sp : null;
  const alertas = [];
  if (!encHasFeeder(e) && vivos.length) alertas.push(['bad', '🥣 Sem comedouro']);
  if (!encHasWater(e) && vivos.length) alertas.push(['bad', '🚰 Sem bebedouro']);
  if (e.limpeza < .4) alertas.push(['bad', '💩 Sujo']);
  if (encEnrich(e) < .3 && vivos.length) alertas.push(['warn', '🎾 Pouco enriquecimento']);
  if (sp0 && sp0.perigo > F.forca) alertas.push(['bad', '⚠️ Cerca fraca']);
  if (!encViewSpots(e).length) alertas.push(['warn', '👀 Sem trilha ao redor — ninguém vê']);
  if (!alertas.length && vivos.length) alertas.push(['ok', '✅ Tudo em ordem']);
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
      <div class="av" style="font-size:26px">${sp0 ? BIOMAS[sp0.bioma].em : '🚧'}</div>
      <div><h3>${esc(e.nome)}</h3><div class="sub">${F.em} ${F.n} · ${encArea(e)} tiles · cerca de ${encSegCount(e)} trechos</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline" id="iAlerts">${encAlertasHTML(e)}</div>
    ${bar('Felicidade média', felic, corDe(felic), undefined, 'felic')}
    ${bar('Limpeza', e.limpeza, corDe(e.limpeza), undefined, 'limp')}
    ${bar('Comida no cocho', e.comida, corDe(e.comida), undefined, 'comida')}
    ${bar('Água', e.agua, corDe(e.agua), undefined, 'agua')}
    ${bar('Enriquecimento', encEnrich(e), corDe(encEnrich(e)), undefined, 'enr')}
    ${ts !== null ? bar('Terreno x bioma (' + sp0.biomaN + ')', ts, corDe(ts), undefined, 'terr') : ''}
    <h4 class="sec">Terreno</h4><div class="tagline" id="iMix">${encMixHTML(e)}</div>
    ${sp0 ? `<div style="font-size:11px;opacity:.7;margin-top:4px">Ideal: ${Object.entries(sp0.mix).map(([k, v]) => `${TERRAIN[k].em}${Math.round(v * 100)}%`).join(' · ')}</div>` : ''}
    <h4 class="sec">Animais (${vivos.length})</h4>
    <div id="ilist">${vivos.length ? vivos.map(a => `
      <div class="kv" data-a="${a.id}" style="cursor:pointer">
        <span>${a.doente ? '🤒 ' : ''}${esc(a.nome)} <small style="opacity:.6">${a.sexo === 'M' ? '♂' : '♀'} ${esc(a.sp.nome)}, ${a.idade.toFixed(1)}a</small></span>
        <b style="color:${corDe(a.feliz)}">${Math.round(a.feliz * 100)}%</b>
      </div>`).join('') : '<div style="font-size:12px;opacity:.6">Recinto vazio.</div>'}</div>
    <h4 class="sec">Objetos (${e.objs.length})</h4>
    <div class="tagline">${e.objs.length ? e.objs.map(o => `<span class="tag">${ENCOBJ[o.kind].em} ${ENCOBJ[o.kind].n}</span>`).join('') : '<span style="font-size:12px;opacity:.6">Nenhum</span>'}</div>
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
    setTool({ cat: 'recinto', key: e.fence, em: FENCES[e.fence].em, n: 'Ampliar ' + e.nome,
              cost: FENCES[e.fence].cost, ampliando: e.id });
    if (painelUnico()) deselect();
  };
  $('#iobj').onclick = () => { abrirCategoria('encobj'); };
  $('#ipaint').onclick = () => { abrirCategoria('terreno'); };
  $('#iren').onclick = () => {
    const n = prompt('Nome do recinto:', e.nome);
    if (n) { e.nome = n.slice(0, 28); showInspector(); }
  };
  $('#ifence').onclick = () => trocarCerca(e);
  $('#idel').onclick = () => {
    if (e.animals.length) { toast('🚫 Venda ou mova os animais antes de demolir', 'bad'); return; }
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
      <span class="em">${F.em}</span>${F.n}<span class="pr">${moneyFull(Math.max(0, custo))}</span>
      <span class="pr">força ${F.forca} · visão ${Math.round(F.visao * 100)}%</span></div>`;
  }).join('');
  openModal('Trocar cerca — ' + e.nome,
    `<div style="display:flex;gap:8px;flex-wrap:wrap">${opts}</div>
     <p style="font-size:12px;opacity:.7;margin-top:10px">Você recebe 40% de volta da cerca atual. Força alta evita fugas; visão alta deixa os visitantes enxergarem melhor (e pagarem mais).</p>`);
  $$('#modalBody .pitem').forEach(d => d.onclick = () => {
    const k = d.dataset.f;
    const custo = Math.max(0, encSegCount(e) * FENCES[k].cost - Math.round(custoCercaDe(e) * .4));
    if (G.money < custo) { toast('💸 Dinheiro insuficiente', 'bad'); return; }
    spend(custo, 'obra'); e.fence = k; e.integridade = 1;
    closeModal(); showInspector(); toast('🚧 Cerca trocada para ' + FENCES[k].n, 'good');
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
      <div><h3>${esc(a.nome)} <small style="font-size:12px">${a.sexo === 'M' ? '♂' : '♀'}</small></h3>
        <div class="sub">${esc(sp.nome)}</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline">
      <span class="tag" id="iEstado">${est}</span>
      <span class="tag ${pa.urg >= .8 ? 'bad' : pa.urg >= .45 ? 'warn' : 'ok'}" id="iPensa">${pa.em} ${esc(pa.txt)}</span>
      <span class="tag">${BIOMAS[sp.bioma].em} ${sp.biomaN}</span>
      <span class="tag">${DIETA[sp.dieta].em} ${sp.dietaN}</span>
      ${a.gravida > 0 ? '<span class="tag ok">🤰 Gestante</span>' : ''}
    </div>
    ${bar('Felicidade', a.feliz, corDe(a.feliz), undefined, 'feliz')}
    ${bar('Saúde', a.saude, corDe(a.saude), undefined, 'saude')}
    ${bar('Fome', 1 - a.fome, corDe(1 - a.fome), undefined, 'fome')}
    ${bar('Sede', 1 - a.sede, corDe(1 - a.sede), undefined, 'sede')}
    ${bar('Idade', a.idade / sp.vida, a.idade / sp.vida > .85 ? '#e2543f' : '#9a6ad4', a.idade.toFixed(1) + ' / ' + sp.vida + ' anos', 'idade')}
    <h4 class="sec">De onde vem a felicidade</h4>
    <div id="iPontos">${pontosHTML(p)}</div>
    <h4 class="sec">Ficha</h4>
    <div class="kv"><span>Recinto</span><b>${e ? esc(e.nome) : '—'}</b></div>
    <div class="kv"><span>Espaço necessário</span><b>${sp.espaco} tiles</b></div>
    <div class="kv"><span>Grupo ideal</span><b>${sp.gmin}–${sp.gmax}</b></div>
    <div class="kv"><span>Ração</span><b>${moneyFull(sp.racao)}/dia</b></div>
    <div class="kv"><span>Popularidade</span><b class="stars">${stars(sp.apelo / 2)}</b></div>
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
    if (!confirm(`Vender ${a.nome} (${sp.nome}) por ${moneyFull(v)}?`)) return;
    earn(v, 'venda'); a.morto = true;
    if (e) e.animals = e.animals.filter(z => z.id !== a.id);
    G.animals = G.animals.filter(z => z.id !== a.id);
    deselect(); toast('💰 ' + sp.nome + ' vendido por ' + moneyFull(v), 'money');
  };
  $('#imove').onclick = () => transferir(a);
}
const valorRevenda = a => Math.round(a.sp.preco * clamp(1.05 - a.idade / a.sp.vida * .6, .25, 1) * (.5 + a.saude * .5) * .72);
function transferir(a) {
  const opts = [...enclosures.values()].filter(e => e.id !== a.enc).map(e => {
    const chk = checarRecinto(a.sp, e);
    return `<div class="pitem" data-e="${e.id}" style="width:auto;min-width:150px;text-align:left;padding:8px 10px;${chk.bloqueia ? 'opacity:.45' : ''}">
      <b>${esc(e.nome)}</b><br><span class="pr">${FENCES[e.fence].n} · ${encArea(e)} tiles · ${e.animals.length} animais</span>
      <br><span class="pr" style="color:${chk.bloqueia ? '#bd3f2d' : chk.msg ? '#c98a1c' : '#3b8c38'}">${chk.bloqueia ? '🚫 ' + chk.msg : chk.msg ? '⚠️ ' + chk.msg : '✅ Combina bem'}</span></div>`;
  }).join('');
  openModal('Transferir ' + a.nome, opts || '<p>Não há outro recinto construído.</p>');
  $$('#modalBody .pitem').forEach(d => d.onclick = () => {
    const e2 = enclosures.get(+d.dataset.e);
    const chk = checarRecinto(a.sp, e2);
    if (chk.bloqueia) { toast('🚫 ' + chk.msg, 'bad'); return; }
    const e1 = enclosures.get(a.enc);
    if (e1) e1.animals = e1.animals.filter(z => z.id !== a.id);
    e2.animals.push(a); a.enc = e2.id;
    const t = encTileAleatorio(e2); if (t) { a.x = t[0] + .5; a.y = t[1] + .5; a.tx = a.x; a.ty = a.y; }
    closeModal(); showInspector(); toast('📦 ' + a.nome + ' foi para ' + e2.nome, 'good');
  });
}
/** Atualização periódica do inspetor: mexe SÓ nos valores.
 *  Reconstruir o painel com innerHTML a cada 200ms trocava os botões de
 *  identidade no meio do toque — mousedown ia no botão antigo, mouseup no novo,
 *  e o navegador não gerava `click`. Era o "tenho que clicar várias vezes". */
function refreshInspector() {
  const s = G.sel;
  if (!s) return;
  if (s.tipo === 'enc') {
    const e = s.ref;
    if (!enclosures.has(e.id)) { deselect(); return; }
    if (UI.insp.dataset.sig !== encSig(e)) { showInspector(); return; }
    const vivos = e.animals.filter(a => !a.morto);
    const felic = vivos.length ? vivos.reduce((x, a) => x + a.feliz, 0) / vivos.length : 0;
    setBar('felic', felic, corDe(felic));
    setBar('limp', e.limpeza, corDe(e.limpeza));
    setBar('comida', e.comida, corDe(e.comida));
    setBar('agua', e.agua, corDe(e.agua));
    const enr = encEnrich(e); setBar('enr', enr, corDe(enr));
    if (vivos[0]) { const t = terrainScore(e, vivos[0].sp); setBar('terr', t, corDe(t)); }
    const al = $('#iAlerts'); if (al) al.innerHTML = encAlertasHTML(e);
    const mx = $('#iMix'); if (mx) mx.innerHTML = encMixHTML(e);
    for (const row of UI.insp.querySelectorAll('#ilist .kv')) {
      const a = vivos.find(z => z.id === +row.dataset.a); if (!a) continue;
      const b = row.querySelector('b');
      b.textContent = Math.round(a.feliz * 100) + '%'; b.style.color = corDe(a.feliz);
    }
  } else if (s.tipo === 'animal') {
    const a = s.ref;
    if (a.morto) { deselect(); return; }
    if (UI.insp.dataset.sig !== animalSig(a)) { showInspector(); return; }
    setBar('feliz', a.feliz, corDe(a.feliz));
    setBar('saude', a.saude, corDe(a.saude));
    setBar('fome', 1 - a.fome, corDe(1 - a.fome));
    setBar('sede', 1 - a.sede, corDe(1 - a.sede));
    setBar('idade', a.idade / a.sp.vida, a.idade / a.sp.vida > .85 ? '#e2543f' : '#9a6ad4',
      a.idade.toFixed(1) + ' / ' + a.sp.vida + ' anos');
    const est = $('#iEstado'); if (est) est.textContent = animalEstado(a);
    const pa = a.pensa = pensamentoAnimal(a);
    const tp = $('#iPensa');
    if (tp) {
      tp.textContent = pa.em + ' ' + pa.txt;
      tp.className = 'tag ' + (pa.urg >= .8 ? 'bad' : pa.urg >= .45 ? 'warn' : 'ok');
    }
    const pts = $('#iPontos'); if (pts) pts.innerHTML = pontosHTML(pontosAnimal(a));
  } else if (s.tipo === 'vis') {
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
  const isShop = o.cat === 'build' && BUILDINGS[o.kind].valor > 0;
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
      <div style="font-size:11px;opacity:.65;margin-top:3px">Custo por unidade: ${moneyFull(BUILDINGS[o.kind].custo)}. Preço de referência: ${moneyFull(BUILDINGS[o.kind].valor)}. Cobrar muito acima irrita os visitantes.</div>
      <div class="kv"><span>Vendas totais</span><b>${o.vendas}</b></div>
      <div class="kv"><span>Lucro acumulado</span><b class="${o.receita >= 0 ? 'pos' : 'negv'}">${moneyFull(o.receita)}</b></div>` : ''}
    ${BUILDINGS[o.kind] ? `<div class="kv"><span>Salário/semana</span><b>${moneyFull(BUILDINGS[o.kind].salario)}</b></div>` : ''}
    ${BUILDINGS[o.kind] && BUILDINGS[o.kind].supre ? `<div class="kv"><span>Atende</span><b>${BUILDINGS[o.kind].supre}</b></div>` : ''}
    ${DECOS[o.kind] ? `<div class="kv"><span>Beleza</span><b>+${DECOS[o.kind].beleza} (raio ${DECOS[o.kind].r})</b></div>` : ''}
    <div class="rowbtns"><button class="btn r sm" id="idel">🔨 Remover (+${moneyFull(Math.round((B.cost || 0) * .5))})</button></div>`;
  $('#ix').onclick = deselect;
  $('#idel').onclick = () => { earn(Math.round((B.cost || 0) * .5), 'venda'); removeObject(o.id); deselect(); };
  if (isShop) {
    const r = $('#ipr');
    r.oninput = () => { o.mult = r.value / 100; $('#iprv').textContent = moneyFull(precoDe(o)); };
  }
}
function inspStaff(s) {
  const T = STAFF_TYPES[s.tipo];
  UI.insp.innerHTML = `
    <div class="ihead">
      <div class="av" style="font-size:26px">${T.em}</div>
      <div><h3>${T.n}</h3><div class="sub">${T.desc}</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="kv"><span>Salário</span><b>${moneyFull(T.salario)}/semana</b></div>
    <div class="kv"><span>Tarefas concluídas</span><b>${s.feitos}</b></div>
    <div class="kv"><span>Fazendo agora</span><b>${s.tarefa ? ({ enc: 'Cuidando de recinto', animal: 'Tratando animal', lixo: 'Recolhendo lixo', fuga: 'Recapturando fuga' })[s.tarefa.tipo] : 'Patrulhando'}</b></div>
    <div class="rowbtns">
      <button class="btn sm" id="igo">🎯 Centralizar</button>
      <button class="btn r sm" id="ifire">👋 Demitir</button>
    </div>`;
  $('#ix').onclick = deselect;
  $('#igo').onclick = () => centerOn(s.x, s.y);
  $('#ifire').onclick = () => {
    G.staff = G.staff.filter(z => z.id !== s.id); deselect();
    toast('👋 ' + T.n + ' demitido', '');
  };
}

/* ---- equipe ---- */
function openStaff() {
  const cont = Object.keys(STAFF_TYPES).map(k => {
    const T = STAFF_TYPES[k], n = G.staff.filter(s => s.tipo === k).length;
    return `<div class="pitem" data-t="${k}" style="width:auto;min-width:210px;text-align:left;padding:10px 12px">
      <span class="em">${T.em}</span><b>${T.n}</b> <span style="float:right">${n} contratados</span>
      <div class="pr" style="margin-top:3px">${T.desc}</div>
      <div class="pr">Salário: ${moneyFull(T.salario)}/semana</div>
      <button class="btn g sm" style="margin-top:7px" data-hire="${k}">+ Contratar</button>
      <button class="btn r sm" style="margin-top:7px" data-fire="${k}" ${n ? '' : 'disabled'}>− Demitir</button>
    </div>`;
  }).join('');
  const folha = G.staff.reduce((s, x) => s + STAFF_TYPES[x.tipo].salario, 0)
    + [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].salario : 0), 0);
  openModal('Equipe do zoológico',
    `<div style="display:flex;gap:9px;flex-wrap:wrap">${cont}</div>
     <p style="font-size:12px;opacity:.75;margin-top:12px">Sem <b>tratador</b> os animais passam fome e o recinto fica sujo. Sem <b>veterinário</b> doença vira morte. Sem <b>faxineiro</b> o lixo acumula e irrita os visitantes. Sem <b>segurança</b> uma fuga não é resolvida.</p>`,
    `<b>Folha semanal total: ${moneyFull(folha)}</b> <span style="font-size:12px;opacity:.6">(inclui atendentes das lojas)</span>`);
  $$('[data-hire]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const k = b.dataset.hire, T = STAFF_TYPES[k];
    if (G.money < T.salario) { toast('💸 Sem caixa para o primeiro salário', 'bad'); return; }
    contratar(k); toast('🤝 ' + T.n + ' contratado', 'good'); openStaff();
  });
  $$('[data-fire]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const k = b.dataset.fire;
    const i = G.staff.findIndex(s => s.tipo === k);
    if (i >= 0) { G.staff.splice(i, 1); openStaff(); }
  });
}

/* ---- finanças ---- */
function openFinance() {
  const L = G.ledger;
  const linha = (n, v, neg) => `<tr><td>${n}</td><td class="n ${v ? (neg ? 'negv' : 'pos') : ''}">${neg ? '-' : '+'}${moneyFull(v)}</td></tr>`;
  const folhaSem = G.staff.reduce((s, x) => s + STAFF_TYPES[x.tipo].salario, 0)
    + [...objects.values()].reduce((s, o) => s + (BUILDINGS[o.kind] ? BUILDINGS[o.kind].salario : 0), 0);
  const racaoDia = G.animals.filter(a => !a.morto).reduce((s, a) => s + a.sp.racao, 0);
  const hist = L.hist.slice(-10).reverse();
  const diag = diagnosticoPublico();
  openModal('Finanças',
    (diag ? `<div style="display:flex;gap:9px;align-items:center;margin-bottom:13px;padding:10px 12px;
        background:linear-gradient(#ffdcd4,#ffbdae);border:3px solid var(--ink);border-radius:13px;font-size:13px;line-height:1.4">
        <span style="font-size:21px;flex:none">${diag.em}</span><span>${diag.longo}</span></div>` : '') +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h4 class="sec" style="margin-top:0">Hoje (dia ${G.day})</h4>
        <table class="fin">
          ${linha('Ingressos', L.hoje.ingresso)}
          ${linha('Lojas e restaurantes', L.hoje.loja)}
          ${linha('Venda de animais', L.hoje.venda)}
          ${linha('Ração e insumos', L.hoje.racao, 1)}
          ${linha('Salários', L.hoje.salario, 1)}
          ${linha('Manutenção e veterinário', L.hoje.manut, 1)}
          ${linha('Compra de animais', L.hoje.compra, 1)}
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
          <input type="range" id="fTicket" min="0" max="140" value="${G.ticket}" style="flex:1">
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
    rh.innerHTML = G.ticket > just * 1.35 ? '🔴 Caro demais para o que o zoo oferece — muita gente vai desistir na porta.'
      : G.ticket > just * 1.05 ? '🟡 Um pouco acima do que o público acha justo.'
        : G.ticket < just * .55 ? '🔵 Barato: lota o parque, mas você deixa dinheiro na mesa.'
          : '🟢 Preço bem calibrado para as atrações atuais.';
    rh.innerHTML += ` <span style="opacity:.6">(referência: ${moneyFull(just)})</span>`;
  };
  r.oninput = upd; upd();
  $$('[data-mk]').forEach(b => b.onclick = () => { G.pesquisa.marketing = +b.dataset.mk; openFinance(); });
  $$('[data-loan]').forEach(b => b.onclick = () => {
    const v = +b.dataset.loan; G.money += v; G.emprestimo += v;
    toast('🏦 Empréstimo de ' + moneyFull(v) + ' liberado', 'money'); openFinance();
  });
  $$('[data-pay]').forEach(b => b.onclick = () => {
    const v = Math.min(G.money, G.emprestimo);
    if (v <= 0) { toast('Nada a quitar', ''); return; }
    G.money -= v; G.emprestimo -= v; toast('🏦 Abatido ' + moneyFull(v), 'money'); openFinance();
  });
}
const saldo = o => o.ingresso + o.loja + o.venda - o.racao - o.salario - o.manut - o.compra - o.obra;

/** Por que a bilheteria está parada? Devolve o primeiro motivo estrutural, na
 *  ordem em que o jogador precisa resolver — ou null se está tudo certo.
 *  Existe porque zero visitante sem explicação é indistinguível de bug. */
function diagnosticoPublico() {
  const D = (em, curto, longo) => ({ em, curto, longo });
  const vivos = G.animals.filter(a => !a.morto && !a.fugiu);
  if (!vivos.length)
    return D('🦁', 'Sem animais', '<b>Nenhum animal no zoológico.</b> Sem atração ninguém paga ingresso — compre bichos na aba Animais.');
  if (!pathConnected(ENTRANCE.x, ENTRANCE.y))
    return D('🛣️', 'Portão sem trilha', '<b>Nenhuma trilha ligada ao portão</b> (base do mapa). Sem caminho a partir da entrada, ninguém consegue entrar.');
  const visiveis = [...enclosures.values()]
    .filter(e => e.animals.some(a => !a.morto) && encViewSpots(e).length);
  if (!visiveis.length)
    return D('👀', 'Recinto sem trilha ao lado', '<b>Nenhum recinto tem trilha ao lado.</b> Passe um caminho encostado na cerca — os visitantes só veem o animal de cima da trilha.');
  const justo = precoJusto();
  if (G.ticket > justo * 1.4)
    return D('🎟️', 'Ingresso caro demais', `<b>Ingresso de ${moneyFull(G.ticket)} está muito acima do que o público acha justo</b> (~${moneyFull(justo)}). A maioria desiste na porta.`);
  if (G.hour < OPEN_H || G.hour >= CLOSE_H)
    return D('🌙', 'Zoológico fechado', `O zoológico está fechado (abre às ${OPEN_H}h). Os visitantes voltam de manhã.`);
  return null;
}
/** preço de ingresso que o público considera justo, dado o acervo */
function precoJusto() {
  let v = 4;
  for (const e of enclosures.values()) {
    if (!encViewSpots(e).length) continue;
    const F = FENCES[e.fence];
    for (const a of e.animals) if (!a.morto) v += a.sp.atracao * F.visao * (.4 + a.feliz * .6) * .55;
  }
  v += [...objects.values()].filter(o => o.cat === 'build' && BUILDINGS[o.kind].supre).length * .7;
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
  '🥱': 'Mais animais de apelo alto, ou um Playground.',
  '💸': 'Baixe o ingresso em Finanças, ou acrescente atrações.',
  '😱': 'Contrate Segurança e reforce a cerca do recinto.',
  '😠': 'Veja os outros motivos da lista — algo está faltando.',
  '😐': 'Nada urgente, mas o parque não empolga: decore e diversifique.',
  '💧': 'Ponha Bebedouro no recinto e tenha um Tratador de plantão.',
  '😖': 'Recinto apertado: amplie ou separe os animais.',
  '💩': 'Contrate mais Tratadores — eles limpam os recintos.',
  '⚠️': 'Troque por uma cerca mais forte (inspetor do recinto).',
  '🤕': 'Contrate um Veterinário.',
  '🤒': 'Contrate um Veterinário.',
  '👥': 'Compre mais animais da mesma espécie.',
  '😤': 'Grupo grande demais: venda ou transfira alguns.',
  '🕸️': 'Troque a cerca por Tela de Aviário.',
  '🌊': 'Troque a cerca por Vidro de Aquário.',
  '🏃': 'Contrate Segurança para recapturar o animal.',
  '👴': 'Idade avançada — considere trazer animais mais jovens.',
};
for (const k in COMIDA_EM) DICAS[COMIDA_EM[k]] = 'Ponha Comedouro no recinto e tenha um Tratador.';
for (const k in BIOMAS) DICAS[BIOMAS[k].em] = 'Pinte o terreno do recinto com o bioma pedido (aba Terreno).';

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
          <div style="font-size:11px;opacity:.6">${cnt} ${cnt === 1 ? 'no parque' : 'no parque'}</div></div>
      </div>
      ${ranking.length ? ranking.map(r => linhaMotivo(r, cnt)).join('') : `<div style="font-size:12px;opacity:.6">${vazio}</div>`}
    </div>`;
  openModal('Satisfação — por quê?',
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      ${bloco('👥 Visitantes', vis.length, moodV, rv, 'Ninguém no parque agora.')}
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
      <div><h3>${v.crianca ? 'Criança' : 'Visitante'}</h3>
        <div class="sub">${v.saindo ? 'Indo embora' : 'Passeando'} · ${v.tempo.toFixed(1)}h no parque</div></div>
      <button class="btn r closeX" id="ix">✕</button>
    </div>
    <div class="tagline"><span class="tag ${p.urg >= .8 ? 'bad' : p.urg >= .45 ? 'warn' : 'ok'}" id="iEstado">
      ${p.em} ${esc(p.txt)}</span></div>
    ${bar('Satisfação', v.mood, corDe(v.mood), undefined, 'mood')}
    <h4 class="sec">Necessidades (cheio = tranquilo)</h4>
    ${Object.keys(NEED_INFO).map(k => bar(NEED_INFO[k][0] + ' ' + NEED_INFO[k][1],
      1 - v.need[k], corDe(1 - v.need[k]), undefined, 'n_' + k)).join('')}
    <h4 class="sec">Carteira e passeio</h4>
    <div class="kv"><span>Dinheiro no bolso</span><b id="iDin">${moneyFull(v.dinheiro)}</b></div>
    <div class="kv"><span>Recintos que já viu</span><b id="iViu">${v.vistos.size}</b></div>
    <div class="kv"><span>Levando</span><b>${v.item === 'balao' ? '🎈 Balão' : v.item === 'comida' ? '🍔 Comida' : '—'}</b></div>
    <div class="rowbtns"><button class="btn sm" id="igo">🎯 Centralizar</button></div>`;
  $('#ix').onclick = deselect;
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
          <li><b>Terreno</b> — pinte o miolo com o bioma da espécie (savana quer grama+terra, tundra quer neve...).</li>
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
        <div>Espaço, bioma correto, tamanho do grupo, enriquecimento, limpeza, saúde, comida e cerca adequada. O inspetor de cada animal mostra a nota item por item — é onde você descobre o que consertar.</div>
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
  $('#hLoad').onclick = () => { if (confirm('Carregar o jogo salvo neste navegador? O progresso atual será perdido.')) carregar(); };
  $('#hDlSave').onclick = () => exportarSave();
  $('#hDlTxt').onclick = () => exportarRelatorio();
  $('#hUp').onclick = () => $('#fileSave').click();   // input permanente, fora do modal
  $('#hReset').onclick = () => { if (confirm('Recomeçar do zero?')) { localStorage.removeItem('zoo_save'); location.reload(); } };
}
