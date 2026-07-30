/* ==========================================================================
   6. ESTADO GLOBAL
   ========================================================================== */
const G = {
  // ingresso inicial baixo: um zoológico recém-aberto tem pouco a mostrar e
  // um preço alto de largada espantaria o público antes do 1º recinto render
  money: 200000, ticket: 10, day: 1, hour: 8, speed: 1, prevSpeed: 1,
  rep: 2.5, netVer: 0, animais: 0,
  dirty: { terr: true, net: true },
  animals: [], visitors: [], staff: [], escaped: [],
  sel: null,             // seleção atual {tipo, ref}
  tool: null,            // ferramenta ativa
  toolCat: null,
  drag: null,            // arraste de construção
  cam: { x: 0, y: 0, z: 1 },
  stats: { visHoje: 0, visTotal: 0, felicidade: .7, entrHoje: 0 },
  ledger: {
    hoje: { ingresso: 0, loja: 0, racao: 0, salario: 0, manut: 0, compra: 0, venda: 0, obra: 0 },
    semana: { ingresso: 0, loja: 0, racao: 0, salario: 0, manut: 0, compra: 0, venda: 0, obra: 0 },
    hist: [],
  },
  pesquisa: { marketing: 0 },
  maxVis: 280,           // ajustado no boot conforme o tamanho da tela
  bolhas: 1,             // balões de pensamento: 0 off · 1 só problemas · 2 tudo
  terrVer: 0,            // versão do terreno (invalida cache de encMix)
  justoCache: 0,         // preço justo recalculado 1x por segundo
  lastBill: 1,
  emprestimo: 0, jurosDia: 0,
  gameOver: false,
};
function lgr(k, v) { G.ledger.hoje[k] += v; G.ledger.semana[k] += v; }
function spend(v, k) { G.money -= v; lgr(k || 'obra', v); }
function earn(v, k) { G.money += v; lgr(k || 'loja', v); }

/* ==========================================================================
   6b. PENSAMENTOS — o que cada bicho e cada pessoa está achando
   Cada entidade guarda {urg, em, txt}: urgência 0..1, ícone e texto. A urgência
   ordena os candidatos (mostra-se o mais gritante) e decide se o balão aparece
   no modo "só problemas". O ícone é escolhido para ENSINAR: o bicho com fome
   pensa na comida da dieta dele, e o que está no bioma errado mostra o bioma
   que quer — dá para varrer o mapa e saber o que construir.
   ========================================================================== */
const P_ = (urg, em, txt) => ({ urg, em, txt });
const COMIDA_EM = { herb: '🥬', carn: '🥩', oniv: '🍎', pisc: '🐟', inse: '🦗', nect: '🍌' };

function pensamentoAnimal(a) {
  const sp = a.sp, e = enclosures.get(a.enc);
  if (a.fugiu) return P_(1, '🏃', 'Fugiu do recinto!');
  if (a.doente) return P_(.96, '🤒', 'Doente — chame o veterinário');
  if (!e) return P_(.9, '❓', 'Sem recinto');
  if (a.sede > .8) return P_(.93, '💧', 'Sem água no bebedouro');
  if (a.fome > .8) return P_(.91, COMIDA_EM[sp.dieta], 'Sem comida no cocho');
  const F = FENCES[e.fence];
  const irmaos = e.animals.filter(z => z.sp.id === sp.id && !z.morto).length;
  const cand = [];
  if (encArea(e) < sp.espaco * Math.max(1, irmaos) * .85) cand.push([.86, '😖', 'Recinto apertado']);
  if (e.limpeza < .4) cand.push([.78, '💩', 'Recinto sujo']);
  if (sp.perigo > F.forca) cand.push([.74, '⚠️', 'Consegue escapar dessa cerca']);
  if (a.saude < .5) cand.push([.72, '🤕', 'Saúde fraca']);
  if (terrainScore(e, sp) < .5) cand.push([.7, BIOMAS[sp.bioma].em, 'Quer terreno de ' + sp.biomaN]);
  if (irmaos < sp.gmin) cand.push([.66, '👥', `Solitário — quer ${sp.gmin}+ da espécie`]);
  if (irmaos > sp.gmax) cand.push([.62, '😤', 'Grupo grande demais']);
  if (sp.voa && !F.aereo) cand.push([.6, '🕸️', 'Precisa de tela de aviário']);
  if (sp.aquatico && !F.aquatico) cand.push([.6, '🌊', 'Precisa de vidro de aquário']);
  if (encEnrich(e) < .3) cand.push([.55, '🥱', 'Sem nada para fazer']);
  if (a.fome > .5) cand.push([.5, COMIDA_EM[sp.dieta], 'Com fome']);
  if (cand.length) { cand.sort((x, y) => y[0] - x[0]); return P_(...cand[0]); }
  if (a.gravida > 0) return P_(.34, '🤰', 'Gestante');
  if (a.idade / sp.vida > .9) return P_(.32, '👴', 'Bem velhinho');
  if (a.idade < 1) return P_(.26, '🍼', 'Filhote');
  if (a.estado === 'comendo') return P_(.2, '😋', 'Comendo');
  if (a.feliz > .82) return P_(.16, '💚', 'Muito feliz aqui');
  if (a.estado === 'parado') return P_(.12, '😴', 'Descansando');
  return P_(.1, '🙂', 'Tranquilo');
}

function pensamentoVisitante(v) {
  const N = v.need, cand = [];
  const i = IDX(clamp(v.x | 0, 0, W - 1), clamp(v.y | 0, 0, H - 1));
  if (G.escaped.length) cand.push([.99, '😱', 'Tem animal solto no parque!']);
  if (N.banheiro > .85) cand.push([.92, '🚻', 'Preciso de banheiro, urgente']);
  if (N.sede > .85) cand.push([.9, '🥤', 'Morrendo de sede']);
  if (N.fome > .85) cand.push([.88, '🍔', 'Faminto']);
  if (N.energia > .85) cand.push([.82, '😩', 'Exausto, quero sentar']);
  if (world.lixo[i] > .5) cand.push([.8, '🤢', 'Que sujeira nessa trilha']);
  if (v.saindo && v.mood < .3) cand.push([.79, '😠', 'Indo embora irritado']);
  if (N.diversao > .78) cand.push([.7, '🥱', 'Tédio, quero ver mais bicho']);
  if (G.ticket > (G.justoCache || 0) * 1.4) cand.push([.64, '💸', 'Ingresso caro pelo que tem']);
  if (N.banheiro > .6) cand.push([.55, '🚻', 'Procurando banheiro']);
  if (N.sede > .58) cand.push([.53, '🥤', 'Com sede']);
  if (N.fome > .58) cand.push([.52, '🍟', 'Com fome']);
  if (N.energia > .62) cand.push([.46, '🪑', 'Cansado de andar']);
  if (cand.length) { cand.sort((x, y) => y[0] - x[0]); return P_(...cand[0]); }
  if (v.acao > 0 && v.alvo && v.alvo.tipo === 'exib') return P_(.36, '😍', 'Adorando esse animal');
  if (v.item === 'comida') return P_(.24, '😋', 'Comendo algo gostoso');
  if (v.item === 'balao') return P_(.22, '🎈', 'Levando lembrança');
  if (world.bel[i] > 1.5) return P_(.2, '🌸', 'Que parque bonito');
  if (v.mood > .85) return P_(.16, '😄', 'Passeio ótimo');
  if (v.mood > .6) return P_(.12, '🙂', 'Curtindo o dia');
  return P_(.1, '😐', 'Nada de mais');
}

/** recalcula o pensamento de tempo em tempo (não vale fazer isso todo frame) */
function atualizaPensamento(ent, dt, fn) {
  ent.pensaT = (ent.pensaT || 0) - dt;
  if (ent.pensaT > 0 && ent.pensa) return;
  ent.pensaT = rnd(1.1, 1.9);
  ent.pensa = fn(ent);
}

/* ==========================================================================
   7. ANIMAIS
   ========================================================================== */
const NOMES_A = ['Bento', 'Lua', 'Thor', 'Nina', 'Simba', 'Maya', 'Zeca', 'Aurora', 'Duque', 'Pipoca', 'Mel', 'Rex',
  'Íris', 'Bolt', 'Zara', 'Nala', 'Kiko', 'Amora', 'Toby', 'Safira', 'Odin', 'Jade', 'Rocky', 'Fiona',
  'Bruno', 'Cacau', 'Loki', 'Estrela', 'Max', 'Pérola', 'Apolo', 'Sofia', 'Gaia', 'Zeus', 'Bela', 'Fred',
  'Tuca', 'Manu', 'Kaio', 'Lola', 'Otto', 'Vida', 'Índigo', 'Nuvem', 'Brisa', 'Tango', 'Fumaça', 'Canela'];

function novoAnimal(sp, encId, idade) {
  const a = {
    id: uid(), sp, enc: encId,
    nome: pick(NOMES_A), sexo: Math.random() < .5 ? 'M' : 'F',
    idade: idade !== undefined ? idade : rnd(sp.vida * .15, sp.vida * .45),
    fome: rnd(.1, .35), sede: rnd(.1, .35), saude: 1, feliz: .7,
    doente: false, gravida: 0, morto: false, fugiu: false,
    x: 0, y: 0, tx: 0, ty: 0, dir: 1, frame: rndi(0, 5), anim: 0,
    estado: 'parado', espera: rnd(1, 4), fofoca: 0,
  };
  const e = enclosures.get(encId);
  if (e) { const t = encTileAleatorio(e); if (t) { a.x = t[0] + .5; a.y = t[1] + .5; a.tx = a.x; a.ty = a.y; } }
  G.animals.push(a);
  return a;
}
function pontosAnimal(a) { // felicidade decomposta (usada no inspetor)
  const e = enclosures.get(a.enc);
  if (!e) return { total: .3, itens: [] };
  const sp = a.sp;
  const irmaos = e.animals.filter(z => z.sp.id === sp.id && !z.morto);
  const area = encArea(e), precisa = sp.espaco * Math.max(1, irmaos.length);
  const espaco = clamp(area / precisa, 0, 1.35) / 1.35;
  const terr = terrainScore(e, sp);
  const n = irmaos.length;
  const social = n < sp.gmin ? clamp(.35 + n / Math.max(1, sp.gmin) * .55, 0, 1)
    : n > sp.gmax ? clamp(1 - (n - sp.gmax) / sp.gmax * .8, .1, 1) : 1;
  const enr = encEnrich(e);
  const limp = e.limpeza;
  const saude = a.saude;
  const F = FENCES[e.fence];
  const seg = sp.perigo <= F.forca ? 1 : clamp(1 - (sp.perigo - F.forca) * .28, .2, 1);
  const aer = sp.voa && !F.aereo ? .55 : 1;
  const aqu = sp.aquatico && !F.aquatico ? .6 : 1;
  const fome = 1 - clamp(a.fome - .45, 0, .55) / .55 * .9;
  const itens = [
    ['Espaço', espaco, .19], ['Terreno/bioma', terr, .19], ['Convívio', social, .13],
    ['Enriquecimento', enr, .12], ['Limpeza', limp, .11], ['Saúde', saude, .12],
    ['Alimentação', fome, .08], ['Recinto adequado', Math.min(seg, aer, aqu), .06],
  ];
  let total = 0; for (const [, v, w] of itens) total += v * w;
  return { total: clamp(total, 0, 1), itens };
}

function updAnimal(a, dt, gh) {
  if (a.morto) return;
  const sp = a.sp, e = enclosures.get(a.enc);
  // envelhecimento
  a.idade += gh / (24 * YEAR_DAYS);
  const velho = a.idade / sp.vida;
  // fome / sede
  const rate = .028 + sp.esc * .012;
  a.fome = clamp(a.fome + rate * gh * .1, 0, 1);
  a.sede = clamp(a.sede + rate * gh * .13, 0, 1);
  if (e) {
    if (encHasFeeder(e) && e.comida > .05 && a.fome > .35) {
      const q = Math.min(a.fome, gh * .5);
      a.fome -= q; e.comida = clamp(e.comida - q * .1 / Math.max(1, e.animals.length), 0, 1);
      a.estado = 'comendo';
    }
    if (encHasWater(e) && e.agua > .05 && a.sede > .35) {
      const q = Math.min(a.sede, gh * .6);
      a.sede -= q; e.agua = clamp(e.agua - q * .08 / Math.max(1, e.animals.length), 0, 1);
    }
  }
  // saúde
  let dh = 0;
  if (a.fome > .85) dh -= (a.fome - .85) * .9;
  if (a.sede > .85) dh -= (a.sede - .85) * 1.3;
  if (e && e.limpeza < .3) dh -= (.3 - e.limpeza) * .5;
  if (velho > .88) dh -= (velho - .88) * 1.4;
  if (a.doente) dh -= .55;
  if (dh === 0 && !a.doente) dh = .22;
  a.saude = clamp(a.saude + dh * gh * .04, 0, 1);
  // doença
  if (!a.doente && Math.random() < gh * .0016 * (2 - a.saude) * (e ? (2 - e.limpeza) : 2)) {
    a.doente = true;
    toast('🤒 ' + a.nome + ' (' + sp.nome + ') adoeceu!', 'bad');
  }
  // morte
  if (a.saude <= 0 || (velho > 1 && Math.random() < gh * .02)) {
    a.morto = true;
    if (e) e.animals = e.animals.filter(z => z.id !== a.id);
    G.rep = clamp(G.rep - .12, 0, 5);
    toast('💀 ' + a.nome + ' (' + sp.nome + ') morreu' + (velho > 1 ? ' de velhice' : ''), 'bad');
    return;
  }
  // felicidade
  const p = pontosAnimal(a);
  a.feliz = lerp(a.feliz, p.total, clamp(gh * .25, 0, 1));
  // fuga
  if (e && !a.fugiu) {
    const F = FENCES[e.fence];
    if (sp.perigo > F.forca && Math.random() < gh * .0022 * (sp.perigo - F.forca) * (1.4 - a.feliz)) {
      a.fugiu = true; G.escaped.push(a);
      e.animals = e.animals.filter(z => z.id !== a.id);
      toast('🚨 ' + sp.nome + ' FUGIU do recinto!', 'bad');
      G.rep = clamp(G.rep - .3, 0, 5);
    }
  }
  // reprodução
  if (e && !a.fugiu && a.sexo === 'F' && a.feliz > .72 && a.idade > sp.vida * .18 && a.idade < sp.vida * .72) {
    if (a.gravida > 0) {
      a.gravida -= gh;
      if (a.gravida <= 0) {
        const irmaos = e.animals.filter(z => z.sp.id === sp.id).length;
        if (encArea(e) >= sp.espaco * (irmaos + 1) && irmaos < sp.gmax + 2) {
          const f = novoAnimal(sp, e.id, 0.05); e.animals.push(f);
          toast('🎉 Nasceu um filhote de ' + sp.nome + '!', 'good');
          G.rep = clamp(G.rep + .12, 0, 5);
        }
      }
    } else if (Math.random() < gh * .0009 &&
      e.animals.some(z => z.sp.id === sp.id && z.sexo === 'M' && z.idade > sp.vida * .18)) {
      a.gravida = 24 * 8;
    }
  }
  atualizaPensamento(a, dt, pensamentoAnimal);
  // movimento
  moveAnimal(a, dt, gh);
}
function moveAnimal(a, dt, gh) {
  const sp = a.sp;
  a.espera -= dt;
  const e = enclosures.get(a.enc);
  if (a.fugiu) {
    if (a.espera <= 0) {
      a.tx = clamp(a.x + rnd(-8, 8), 1, W - 2); a.ty = clamp(a.y + rnd(-8, 8), 1, H - 2);
      a.espera = rnd(2, 5);
    }
  } else if (e && a.espera <= 0) {
    const t0 = encTileAleatorio(e);
    if (!t0) return;
    let bx = t0[0] + .5, by = t0[1] + .5;
    if (sp.aquatico) { // procura água entre os tiles do recinto
      for (let k = 0; k < 12; k++) {
        const t = encTileAleatorio(e); if (!t) break;
        if (TKEYS[world.terr[IDX(t[0], t[1])]] === 'agua') { bx = t[0] + .5; by = t[1] + .5; break; }
      }
    }
    a.tx = bx; a.ty = by;
    a.espera = rnd(1.5, 6) + (sp.esc > 1.3 ? 2 : 0);
    a.estado = 'andando';
  }
  const d = dist(a.x, a.y, a.tx, a.ty);
  const vel = (a.doente ? .35 : 1) * (.5 + Math.min(sp.esc, 1.4) * .55) * (sp.plano === 'preguica' ? .25 : 1);
  if (d > .08) {
    const s = Math.min(vel * dt, d);
    const nx = a.x + (a.tx - a.x) / d * s, ny = a.y + (a.ty - a.y) / d * s;
    if (a.tx < a.x - .01) a.dir = -1; else if (a.tx > a.x + .01) a.dir = 1;
    a.x = nx; a.y = ny;
    a.anim += dt * (2.2 + vel);
    a.estado = a.doente ? 'doente' : 'andando';
  } else if (a.estado === 'andando') a.estado = 'parado';
  a.frame = Math.floor(a.anim) % FRAMES;
}

/* ==========================================================================
   8. VISITANTES
   ========================================================================== */
function novoVisitante() {
  const crianca = Math.random() < .3;
  const v = {
    id: uid(), tipo: 'vis',
    x: ENTRANCE.x + .5, y: ENTRANCE.y + .5, dir: -1, anim: 0, frame: 0,
    path: null, pi: 0, alvo: null, alvoTipo: null, acao: 0,
    need: { fome: rnd(0, .3), sede: rnd(0, .35), banheiro: rnd(0, .2), energia: rnd(0, .2), diversao: rnd(.3, .6) },
    dinheiro: rnd(40, 260) * (crianca ? .5 : 1),
    mood: clamp(.55 + G.rep * .07 - Math.max(0, G.ticket - 30) * .004, .15, 1),
    vistos: new Set(), tempo: 0, crianca, item: null, indo: false, saindo: false,
    // duração sorteada UMA vez, no nascimento: reavaliar rnd() a cada tick
    // fazia todo mundo ir embora no piso da faixa e ninguém chegava às lojas
    duracao: rnd(6, 11),
    // desvio lateral fixo: sem isso todo mundo pisa no centro do tile e a
    // multidão vira uma fila indiana em cima da trilha
    jx: rnd(-.32, .32), jy: rnd(-.32, .32),
    ...pick(VISITOR_LOOKS),
    balao: pick(SHIRTS),
    escala: crianca ? .72 : 1,
  };
  G.visitors.push(v); G.stats.visHoje++; G.stats.visTotal++;
  earn(G.ticket, 'ingresso'); G.stats.entrHoje += G.ticket;
  return v;
}
function melhorAlvo(v) {
  // urgências
  const N = v.need;
  const ordem = [['banheiro', N.banheiro, 'banheiro'], ['sede', N.sede, 'sede'],
  ['fome', N.fome, 'fome'], ['energia', N.energia, 'energia']];
  ordem.sort((a, b) => b[1] - a[1]);
  for (const [nome, val, supre] of ordem) {
    if (val > .5) {
      const o = achaServico(supre, v);
      if (o) return { tipo: 'obj', ref: o, x: o.x, y: o.y };
      v.mood = clamp(v.mood - .0007 * (val - .6) * 100, 0, 1);
    }
  }
  if (N.diversao > .5 && Math.random() < .4) {
    const o = achaServico('diversao', v);
    if (o && Math.random() < .5) return { tipo: 'obj', ref: o, x: o.x, y: o.y };
  }
  // exibição não vista
  const cands = [];
  for (const e of enclosures.values()) {
    if (!e.animals.length) continue;
    const vs = encViewSpots(e);
    if (!vs.length) continue;
    const peso = (v.vistos.has(e.id) ? .12 : 1) * (1 + e.animals.reduce((s, a) => s + a.sp.apelo, 0) / 12);
    cands.push({ e, vs, peso });
  }
  if (cands.length) {
    let tot = 0; for (const c of cands) tot += c.peso;
    let r = Math.random() * tot;
    for (const c of cands) { r -= c.peso; if (r <= 0) { const s = pick(c.vs); return { tipo: 'exib', ref: c.e, x: s[0], y: s[1] }; } }
  }
  return null;
}
/** O prédio tem trilha alcançável ao lado? Cacheado por versão da malha —
 *  sem isso um visitante escolhia uma loja inalcançável a cada tick, para
 *  sempre, perdendo humor em centenas de tentativas que nunca chegavam. */
function objAcessivel(o) {
  if (o._accNet === G.netVer) return o._acc;
  o._accNet = G.netVer;
  o._acc = !!nearestPathTile(o.x, o.y, 4);
  return o._acc;
}
function achaServico(supre, v) {
  let best = null, bd = 1e9;
  for (const o of objects.values()) {
    if (o.cat !== 'build') continue;
    const B = BUILDINGS[o.kind];
    if (B.supre !== supre) continue;
    if (B.valor > 0 && precoDe(o) > v.dinheiro) continue;
    if (!objAcessivel(o)) continue;
    const d = dist2(o.x, o.y, v.x, v.y) + o.fila.length * 26;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
const precoDe = o => Math.round(BUILDINGS[o.kind].valor * (o.mult === undefined ? 1 : o.mult));

function updVisitor(v, dt, gh) {
  v.tempo += gh;
  // as taxas têm de fechar dentro de uma visita (~5–8 h de jogo), senão
  // ninguém chega a sentir fome e o comércio nunca vende nada
  const N = v.need;
  N.fome = clamp(N.fome + gh * .125, 0, 1);
  N.sede = clamp(N.sede + gh * .16, 0, 1);
  N.banheiro = clamp(N.banheiro + gh * .10, 0, 1);
  N.energia = clamp(N.energia + gh * .085, 0, 1);
  N.diversao = clamp(N.diversao + gh * .07, 0, 1);

  // ambiente afeta humor
  const i = IDX(clamp(v.x | 0, 0, W - 1), clamp(v.y | 0, 0, H - 1));
  let dm = 0;
  dm += clamp(world.bel[i], 0, 3) * .0016;
  dm -= world.lixo[i] * .004;
  dm -= (N.fome > .8 ? .004 : 0) + (N.sede > .8 ? .005 : 0) + (N.banheiro > .85 ? .006 : 0) + (N.energia > .85 ? .003 : 0);
  if (G.escaped.length) dm -= .006 * Math.min(G.escaped.length, 4);
  v.mood = clamp(v.mood + dm * gh * 10, 0, 1);
  // suja o chão
  if (world.path[i] && Math.random() < gh * .06) {
    const temLixeira = [...objects.values()].some(o => o.kind === 'lixeira' && dist2(o.x, o.y, v.x, v.y) < 36);
    world.lixo[i] = clamp(world.lixo[i] + (temLixeira ? .04 : .3), 0, 1);
  }
  atualizaPensamento(v, dt, pensamentoVisitante);
  // Ação em curso tem prioridade sobre a decisão de ir embora: interromper aqui
  // zerava v.alvo no meio da compra e a venda nunca era registrada.
  if (v.acao > 0) { v.acao -= dt; if (v.acao <= 0) concluirAcao(v); return; }
  // ir embora?
  if (!v.saindo && (v.tempo > v.duracao || v.mood < .12 || (G.hour >= CLOSE_H - .5))) {
    v.saindo = true; v.alvo = null; v.path = null;
  }
  // precisa de alvo
  if (!v.path || v.pi >= v.path.length) {
    if (v.saindo) {
      const d = dist(v.x, v.y, ENTRANCE.x + .5, ENTRANCE.y + .5);
      if (d < 1.2) { sairVisitante(v); return; }
      const st = nearestPathTile(v.x | 0, v.y | 0);
      const p = st ? findPath(st[0], st[1], ENTRANCE.x, ENTRANCE.y) : null;
      if (p) { v.path = p; v.pi = 0; } else { sairVisitante(v); return; }
    } else {
      const alvo = melhorAlvo(v);
      if (!alvo) { v.mood = clamp(v.mood - .004 * gh * 10, 0, 1); v.espera = 1; wander(v); return; }
      let tx = alvo.x, ty = alvo.y;
      if (alvo.tipo === 'obj') { const nt = nearestPathTile(alvo.ref.x, alvo.ref.y, 5); if (!nt) { v.mood -= .01; return; } tx = nt[0]; ty = nt[1]; }
      const st = nearestPathTile(v.x | 0, v.y | 0);
      const p = st ? findPath(st[0], st[1], tx, ty) : null;
      if (p) { v.path = p; v.pi = 0; v.alvo = alvo; } else { v.mood = clamp(v.mood - .02, 0, 1); wander(v); }
    }
  }
  // andar
  if (v.path && v.pi < v.path.length) {
    const [px, py] = v.path[v.pi];
    const tx = px + .5 + v.jx, ty = py + .5 + v.jy;
    const d = dist(v.x, v.y, tx, ty);
    const spd = 1.55 * (v.crianca ? .9 : 1) * (1 - N.energia * .28);
    if (d < .1) {
      v.pi++;
      if (v.pi >= v.path.length) { chegou(v); }
    } else {
      const s = Math.min(spd * dt, d);
      if (tx < v.x - .01) v.dir = -1; else if (tx > v.x + .01) v.dir = 1;
      v.x += (tx - v.x) / d * s; v.y += (ty - v.y) / d * s;
      v.anim += dt * 3.4; v.frame = Math.floor(v.anim) % FRAMES;
    }
  }
}
function wander(v) {
  const st = nearestPathTile(v.x | 0, v.y | 0, 6);
  if (!st) return;
  for (let k = 0; k < 8; k++) {
    const tx = clamp(st[0] + rndi(-7, 7), 0, W - 1), ty = clamp(st[1] + rndi(-7, 7), 0, H - 1);
    if (world.path[IDX(tx, ty)]) { const p = findPath(st[0], st[1], tx, ty); if (p) { v.path = p; v.pi = 0; v.alvo = null; return; } }
  }
}
function chegou(v) {
  const a = v.alvo;
  if (!a) return;
  if (a.tipo === 'exib') {
    const e = a.ref;
    if (!enclosures.has(e.id)) { v.alvo = null; return; }
    const F = FENCES[e.fence];
    let q = 0, n = 0;
    for (const an of e.animals) { if (an.morto) continue; q += an.sp.apelo * (.5 + an.feliz * .5); n++; }
    if (n) {
      const bonus = (q / n) * F.visao / 10;
      v.mood = clamp(v.mood + bonus * .16, 0, 1);
      v.need.diversao = clamp(v.need.diversao - bonus * .55, 0, 1);
      if (!v.vistos.has(e.id)) { v.vistos.add(e.id); v.mood = clamp(v.mood + bonus * .1, 0, 1); }
      e.visitasHoje = (e.visitasHoje || 0) + 1;
    } else v.mood = clamp(v.mood - .05, 0, 1);
    v.acao = rnd(1.2, 3);
  } else if (a.tipo === 'obj') {
    const o = a.ref;
    if (!objects.has(o.id)) { v.alvo = null; return; }
    o.fila.push(v.id);
    v.acao = rnd(.8, 2.2);
  }
  v.path = null;
}
function concluirAcao(v) {
  const a = v.alvo;
  v.alvo = null;
  if (!a || a.tipo !== 'obj') return;
  const o = a.ref; if (!objects.has(o.id)) return;
  o.fila = o.fila.filter(z => z !== v.id);
  const B = BUILDINGS[o.kind];
  const preco = precoDe(o);
  if (B.valor > 0) {
    if (v.dinheiro < preco) { v.mood = clamp(v.mood - .06, 0, 1); return; }
    v.dinheiro -= preco; earn(preco, 'loja'); spend(B.custo, 'racao');
    o.receita += preco - B.custo; o.vendas++;
    // percepção de preço: caro demais irrita
    const just = clamp(1 - (preco / Math.max(1, B.valor) - 1) * .7, .1, 1.25);
    v.mood = clamp(v.mood + (just - .75) * .17, 0, 1);
    if (o.kind === 'souvenir') v.item = 'balao';
    else if (B.supre === 'fome') v.item = 'comida';
  }
  if (B.supre) v.need[B.supre] = clamp(v.need[B.supre] - B.forca * .85, 0, 1);
  v.mood = clamp(v.mood + .035, 0, 1);
}
function sairVisitante(v) {
  G.visitors = G.visitors.filter(z => z.id !== v.id);
  const delta = (v.mood - .5) * .0075;
  G.rep = clamp(G.rep + delta, 0, 5);
}

/* ==========================================================================
   9. FUNCIONÁRIOS
   ========================================================================== */
function contratar(tipo) {
  const T = STAFF_TYPES[tipo];
  const s = {
    id: uid(), tipo, tarefa: null, alvo: null, path: null, pi: 0, acao: 0,
    x: ENTRANCE.x + .5, y: ENTRANCE.y + .5, dir: -1, anim: 0, frame: 0,
    skin: pick(SKINS), shirt: T.cor,
    pants: '#3a4048', hair: pick(HAIRS), longHair: Math.random() < .4,
    hat: tipo === 'trat' ? '#8a6a3c' : tipo === 'seg' ? '#2b2b33' : null,
    role: tipo, mood: .8, escala: 1, feitos: 0,
  };
  G.staff.push(s);
  return s;
}
function acharTarefa(s) {
  if (s.tipo === 'trat') {
    let best = null, bd = 1e9;
    for (const e of enclosures.values()) {
      if (!e.animals.length) continue;
      const urg = (1 - e.comida) * (encHasFeeder(e) ? 1.4 : 0) + (1 - e.agua) * (encHasWater(e) ? 1.2 : 0) + (1 - e.limpeza) * 1.6;
      if (urg < .55) continue;
      const bb = encBBox(e);
      const d = dist2(bb.cx, bb.cy, s.x, s.y) / Math.max(.2, urg);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { const bb = encBBox(best); return { tipo: 'enc', ref: best, x: bb.cx | 0, y: bb.cy | 0 }; }
  } else if (s.tipo === 'vet') {
    let best = null, bd = 1e9;
    for (const a of G.animals) {
      if (a.morto || a.fugiu) continue;
      if (!a.doente && a.saude > .55) continue;
      const d = dist2(a.x, a.y, s.x, s.y) / (a.doente ? 3 : 1);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) return { tipo: 'animal', ref: best, x: best.x | 0, y: best.y | 0 };
  } else if (s.tipo === 'fax') {
    let best = null, bd = 1e9;
    for (let k = 0; k < W * H; k++) {
      if (world.lixo[k] < .3) continue;
      const x = k % W, y = (k / W) | 0;
      const d = dist2(x, y, s.x, s.y) / Math.max(.3, world.lixo[k]);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) return { tipo: 'lixo', ref: best, x: best[0], y: best[1] };
  } else if (s.tipo === 'seg') {
    if (G.escaped.length) { const a = G.escaped[0]; return { tipo: 'fuga', ref: a, x: a.x | 0, y: a.y | 0 }; }
  }
  return null;
}
function updStaff(s, dt, gh) {
  if (s.acao > 0) {
    s.acao -= dt;
    if (s.acao <= 0) executarTarefa(s);
    return;
  }
  if (!s.tarefa) {
    s.tarefa = acharTarefa(s);
    s.path = null;
    if (!s.tarefa) { // patrulha
      if (!s.pat || dist(s.x, s.y, s.pat[0], s.pat[1]) < 1) {
        const t = nearestPathTile(rndi(2, W - 3), rndi(2, H - 3), 20) || [ENTRANCE.x, ENTRANCE.y];
        s.pat = [t[0] + .5, t[1] + .5];
      }
      moveTo(s, s.pat[0], s.pat[1], dt, 1.5);
      return;
    }
  }
  const T = s.tarefa;
  const alvoX = (T.tipo === 'animal' || T.tipo === 'fuga') ? T.ref.x : T.x + .5;
  const alvoY = (T.tipo === 'animal' || T.tipo === 'fuga') ? T.ref.y : T.y + .5;
  const d = dist(s.x, s.y, alvoX, alvoY);
  if (d < .8) { s.acao = s.tipo === 'trat' ? 2.2 : s.tipo === 'vet' ? 3 : 1.1; }
  else moveTo(s, alvoX, alvoY, dt, 1.9);
}
function moveTo(s, tx, ty, dt, spd) {
  const d = dist(s.x, s.y, tx, ty);
  if (d < .02) return;
  const st = Math.min(spd * dt, d);
  if (tx < s.x) s.dir = -1; else s.dir = 1;
  s.x += (tx - s.x) / d * st; s.y += (ty - s.y) / d * st;
  s.anim += dt * 3.6; s.frame = Math.floor(s.anim) % FRAMES;
}
function executarTarefa(s) {
  const T = s.tarefa; s.tarefa = null;
  if (!T) return;
  s.feitos++;
  if (T.tipo === 'enc') {
    const e = T.ref; if (!enclosures.has(e.id)) return;
    let custo = 0;
    if (encHasFeeder(e)) { const q = 1 - e.comida; e.comida = 1; custo += q * e.animals.reduce((a, z) => a + z.sp.racao, 0) * .9; }
    if (encHasWater(e)) e.agua = 1;
    e.limpeza = 1;
    if (custo > 0) spend(custo, 'racao');
  } else if (T.tipo === 'animal') {
    const a = T.ref; if (a.morto) return;
    a.doente = false; a.saude = clamp(a.saude + .45, 0, 1);
    spend(320, 'manut');
    toast('💉 ' + a.nome + ' foi tratado pelo veterinário', 'good');
  } else if (T.tipo === 'lixo') {
    world.lixo[IDX(T.ref[0], T.ref[1])] = 0;
  } else if (T.tipo === 'fuga') {
    const a = T.ref; if (!a.fugiu) return;
    a.fugiu = false;
    G.escaped = G.escaped.filter(z => z.id !== a.id);
    const e = enclosures.get(a.enc);
    if (e && enclosures.has(e.id)) {
      e.animals.push(a);
      const t = encTileAleatorio(e); if (t) { a.x = t[0] + .5; a.y = t[1] + .5; a.tx = a.x; a.ty = a.y; }
      toast('🔒 ' + a.sp.nome + ' foi recapturado', 'good');
    } else { a.morto = true; toast('💀 ' + a.sp.nome + ' se perdeu — o recinto não existe mais', 'bad'); }
  }
}
