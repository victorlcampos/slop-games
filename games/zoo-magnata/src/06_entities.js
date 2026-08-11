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
  stats: { visHoje: 0, visitorTotal: 0, happiness: .7, entrHoje: 0 },
  ledger: {
    hoje: { ticket: 0, loja: 0, feed: 0, wage: 0, manut: 0, compra: 0, venda: 0, obra: 0 },
    week: { ticket: 0, loja: 0, feed: 0, wage: 0, manut: 0, compra: 0, venda: 0, obra: 0 },
    hist: [],
  },
  research: { marketing: 0 },
  repLog: [],            // extrato de choques na reputação (painel ⭐)
  nVets: 0,              // veterinários no quadro (contado no tick; acelera cria)
  undo: [],              // últimas compras desfazíveis (não persiste no save)
  maxVis: 280,           // ajustado no boot conforme o tamanho da tela
  bubbles: 1,             // balões de pensamento: 0 off · 1 só problemas · 2 tudo
  terrVer: 0,            // versão do terreno (invalida cache de encMix)
  fairCache: 0,         // preço justo recalculado 1x por segundo
  lastBill: 1,
  loan: 0, dailyInterest: 0,
  gameOver: false,
};
function lgr(k, v) { G.ledger.hoje[k] += v; G.ledger.week[k] += v; }
function spend(v, k) { G.money -= v; lgr(k || 'obra', v); }
function earn(v, k) { G.money += v; lgr(k || 'loja', v); }

/* ==========================================================================
   6b. PENSAMENTOS — o que cada bicho e cada pessoa está achando
   Cada entidade guarda {urg, em, txt}: urgência 0..1, ícone e texto. A urgência
   ordena os candidatos (mostra-se o mais gritante) e decide se o balão aparece
   no modo "só problemas". O ícone é escolhido para ENSINAR: o bicho com fome
   pensa na comida da diet dele, e o que está no biome errado mostra o biome
   que quer — dá para varrer o mapa e saber o que construir.
   ========================================================================== */
const P_ = (urg, em, txt) => ({ urg, em, txt });
const COMIDA_EM = { herb: '🥬', carn: '🥩', omni: '🍎', pisc: '🐟', inse: '🦗', frug: '🍌' };

function animalThought(a) {
  const sp = a.sp, e = enclosures.get(a.enc);
  if (a.escaped) return P_(1, '🏃', LN('Fugiu do recinto!|Escaped the enclosure!'));
  if (a.sick) return P_(.96, '🤒', LN('Doente — chame o veterinário|Sick — call the vet'));
  if (!e) return P_(.9, '❓', LN('Sem recinto|No enclosure'));
  if (a.thirst > .8) return P_(.93, '💧', LN('Sem água no bebedouro|No water in the trough'));
  if (a.hunger > .8) return P_(.91, COMIDA_EM[sp.diet], LN('Sem comida no cocho|No food in the feeder'));
  const F = FENCES[e.fence];
  const irmaos = e.animals.filter(z => z.sp.id === sp.id && !z.dead).length;
  const cand = [];
  if (encArea(e) < sp.space * Math.max(1, irmaos) * .85) cand.push([.86, '😖', LN('Recinto apertado|Cramped enclosure')]);
  if (e.cleanliness < .4) cand.push([.78, '💩', LN('Recinto sujo|Dirty enclosure')]);
  if (sp.danger > F.strength) cand.push([.74, '⚠️', LN('Consegue escapar dessa cerca|Could get past this fence')]);
  if (a.health < .5) cand.push([.72, '🤕', LN('Saúde fraca|Poor health')]);
  if (terrainScore(e, sp) < .5) cand.push([.7, BIOMES[sp.biome].em, LN('Quer terreno de |Wants ') + LN(sp.biomeName) + LN('| terrain')]);
  if (irmaos < sp.groupMin) cand.push([.66, '👥', BI`Solitário — quer ${sp.groupMin}+ da espécie|Lonely — wants ${sp.groupMin}+ of its kind`]);
  if (irmaos > sp.groupMax) cand.push([.62, '😤', LN('Grupo grande demais|Group too large')]);
  if (sp.flies && !F.aviary) cand.push([.6, '🕸️', LN('Precisa de tela de aviário|Needs aviary mesh')]);
  if (sp.aquatic && !F.aquarium) cand.push([.6, '🌊', LN('Precisa de vidro de aquário|Needs aquarium glass')]);
  if (encEnrich(e) < .3) cand.push([.55, '🥱', LN('Sem nada para fazer|Nothing to do')]);
  if (a.hunger > .5) cand.push([.5, COMIDA_EM[sp.diet], LN('Com fome|Hungry')]);
  if (cand.length) { cand.sort((x, y) => y[0] - x[0]); return P_(...cand[0]); }
  if (a.pregnant > 0) return P_(.34, '🤰', 'Gestante');
  if (a.age / sp.lifespan > .9) return P_(.32, '👴', 'Bem velhinho');
  if (a.age < 1) return P_(.26, '🍼', 'Filhote');
  if (a.state === 'brincando') return P_(.18, '⚽', 'Brincando!');
  if (a.state === 'comendo') return P_(.2, '😋', 'Comendo');
  if (a.happy > .82) return P_(.16, '💚', 'Muito feliz aqui');
  if (a.state === 'parado') return P_(.12, '😴', 'Descansando');
  return P_(.1, '🙂', 'Tranquilo');
}

function visitorThought(v) {
  const N = v.need, cand = [];
  const i = IDX(clamp(v.x | 0, 0, W - 1), clamp(v.y | 0, 0, H - 1));
  if (G.escaped.length) cand.push([.99, '😱', 'Tem animal solto no parque!']);
  if (N.banheiro > .85) cand.push([.92, '🚻', 'Preciso de banheiro, urgente']);
  if (N.thirst > .85) cand.push([.9, '🥤', 'Morrendo de sede']);
  if (N.hunger > .85) cand.push([.88, '🍔', 'Faminto']);
  if (N.energia > .85) cand.push([.82, '😩', 'Exausto, quero sentar']);
  if (world.lixo[i] > .5) cand.push([.8, '🤢', 'Que sujeira nessa trilha']);
  if (v.saindo && v.mood < .3) cand.push([.79, '😠', 'Indo embora irritado']);
  if (N.diversao > .78) cand.push([.7, '🥱', 'Tédio, quero ver mais bicho']);
  if (G.ticket > (G.fairCache || 0) * 1.4) cand.push([.64, '💸', 'Ingresso caro pelo que tem']);
  if (N.banheiro > .6) cand.push([.55, '🚻', 'Procurando banheiro']);
  if (N.thirst > .58) cand.push([.53, '🥤', 'Com sede']);
  if (N.hunger > .58) cand.push([.52, '🍟', LN('Com fome|Hungry')]);
  if (N.energia > .62) cand.push([.46, '🪑', 'Cansado de andar']);
  if (cand.length) { cand.sort((x, y) => y[0] - x[0]); return P_(...cand[0]); }
  if (v.action > 0 && v.target && v.target.kind === 'exib') return P_(.36, '😍', LN('Adorando esse animal|Loving this animal'));
  if (v.item === 'comida') return P_(.24, '😋', 'Comendo algo gostoso');
  if (v.item === 'balao') return P_(.22, '🎈', 'Levando lembrança');
  if (world.bel[i] > 1.5) return P_(.2, '🌸', 'Que parque bonito');
  if (v.mood > .85) return P_(.16, '😄', 'Passeio ótimo');
  if (v.mood > .6) return P_(.12, '🙂', 'Curtindo o dia');
  return P_(.1, '😐', 'Nada de mais');
}

/** recalcula o pensamento de tempo em tempo (não vale fazer isso todo frame) */
function refreshThought(ent, dt, fn) {
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

function newAnimal(sp, encId, age) {
  const a = {
    id: uid(), sp, enc: encId,
    name: pick(NOMES_A), sex: Math.random() < .5 ? 'M' : 'F',
    age: age !== undefined ? age : rnd(sp.lifespan * .15, sp.lifespan * .45),
    hunger: rnd(.1, .35), thirst: rnd(.1, .35), health: 1, happy: .7,
    sick: false, pregnant: 0, dead: false, escaped: false,
    x: 0, y: 0, tx: 0, ty: 0, dir: 1, frame: rndi(0, 5), anim: 0,
    state: 'parado', espera: rnd(1, 4), fofoca: 0,
  };
  const e = enclosures.get(encId);
  if (e) { const t = encTileAleatorio(e); if (t) { a.x = t[0] + .5; a.y = t[1] + .5; a.tx = a.x; a.ty = a.y; } }
  G.animals.push(a);
  return a;
}
function animalScore(a) { // felicidade decomposta (usada no inspetor)
  const e = enclosures.get(a.enc);
  if (!e) return { total: .3, itens: [] };
  const sp = a.sp;
  const irmaos = e.animals.filter(z => z.sp.id === sp.id && !z.dead);
  const area = encArea(e), needs = sp.space * Math.max(1, irmaos.length);
  const space = clamp(area / needs, 0, 1.35) / 1.35;
  const terr = terrainScore(e, sp);
  const n = irmaos.length;
  const social = n < sp.groupMin ? clamp(.35 + n / Math.max(1, sp.groupMin) * .55, 0, 1)
    : n > sp.groupMax ? clamp(1 - (n - sp.groupMax) / sp.groupMax * .8, .1, 1) : 1;
  const enr = encEnrich(e);
  const limp = e.cleanliness;
  const health = a.health;
  const F = FENCES[e.fence];
  const seg = sp.danger <= F.strength ? 1 : clamp(1 - (sp.danger - F.strength) * .28, .2, 1);
  const aer = sp.flies && !F.aviary ? .55 : 1;
  const aqu = sp.aquatic && !F.aquarium ? .6 : 1;
  const hunger = 1 - clamp(a.hunger - .45, 0, .55) / .55 * .9;
  const itens = [
    [LN('Espaço|Space'), space, .19], [LN('Terreno/bioma|Terrain/biome'), terr, .19], [LN('Convívio|Company'), social, .13],
    [LN('Enriquecimento|Enrichment'), enr, .12], [LN('Limpeza|Cleanliness'), limp, .11], [LN('Saúde|Health'), health, .12],
    [LN('Alimentação|Feeding'), hunger, .08], [LN('Recinto adequado|Suitable enclosure'), Math.min(seg, aer, aqu), .06],
  ];
  let total = 0; for (const [, v, w] of itens) total += v * w;
  return { total: clamp(total, 0, 1), itens };
}

function updAnimal(a, dt, gh) {
  if (a.dead) return;
  const sp = a.sp, e = enclosures.get(a.enc);
  // envelhecimento
  a.age += gh / (24 * YEAR_DAYS);
  const old = a.age / sp.lifespan;
  // fome / sede
  const rate = .028 + sp.scale * .012;
  a.hunger = clamp(a.hunger + rate * gh * .1, 0, 1);
  a.thirst = clamp(a.thirst + rate * gh * .13, 0, 1);
  if (e) {
    if (encHasFeeder(e) && e.food > .05 && a.hunger > .35) {
      const q = Math.min(a.hunger, gh * .5);
      a.hunger -= q; e.food = clamp(e.food - q * .1 / Math.max(1, e.animals.length), 0, 1);
      a.state = 'comendo';
    }
    if (encHasWater(e) && e.water > .05 && a.thirst > .35) {
      const q = Math.min(a.thirst, gh * .6);
      a.thirst -= q; e.water = clamp(e.water - q * .08 / Math.max(1, e.animals.length), 0, 1);
    }
  }
  // saúde
  let dh = 0;
  if (a.hunger > .85) dh -= (a.hunger - .85) * .9;
  if (a.thirst > .85) dh -= (a.thirst - .85) * 1.3;
  if (e && e.cleanliness < .3) dh -= (.3 - e.cleanliness) * .5;
  if (old > .88) dh -= (old - .88) * 1.4;
  if (a.sick) dh -= .55;
  if (dh === 0 && !a.sick) dh = .22;
  a.health = clamp(a.health + dh * gh * .04, 0, 1);
  // doença
  if (!a.sick && Math.random() < gh * .0016 * (2 - a.health) * (e ? (2 - e.cleanliness) : 2)) {
    a.sick = true; SFX.play('doente');
    toast(BI`🤒 ${a.name} (${LN(sp.name)}) adoeceu!|🤒 ${a.name} (${LN(sp.name)}) has fallen ill!`, 'bad');
  }
  // morte
  if (a.health <= 0 || (old > 1 && Math.random() < gh * .02)) {
    a.dead = true;
    if (e) e.animals = e.animals.filter(z => z.id !== a.id);
    repEvento(-.12, old > 1
      ? BI`${a.name} (${LN(sp.name)}) morreu de velhice|${a.name} (${LN(sp.name)}) died of old age`
      : BI`${a.name} (${LN(sp.name)}) morreu|${a.name} (${LN(sp.name)}) died`, '💀');
    SFX.play('morte');
    toast(old > 1
      ? BI`💀 ${a.name} (${LN(sp.name)}) morreu de velhice|💀 ${a.name} (${LN(sp.name)}) died of old age`
      : BI`💀 ${a.name} (${LN(sp.name)}) morreu|💀 ${a.name} (${LN(sp.name)}) died`, 'bad');
    return;
  }
  // felicidade
  const p = animalScore(a);
  a.happy = lerp(a.happy, p.total, clamp(gh * .25, 0, 1));
  // fuga
  if (e && !a.escaped) {
    const F = FENCES[e.fence];
    if (sp.danger > F.strength && Math.random() < gh * .0022 * (sp.danger - F.strength) * (1.4 - a.happy)) {
      a.escaped = true; G.escaped.push(a); SFX.play('alarme');
      e.animals = e.animals.filter(z => z.id !== a.id);
      toast(BI`🚨 ${LN(sp.name)} FUGIU do recinto!|🚨 A ${LN(sp.name)} ESCAPED the enclosure!`, 'bad');
      repEvento(-.3, BI`${LN(sp.name)} fugiu do recinto|A ${LN(sp.name)} escaped the enclosure`, '🚨');
    }
  }
  // reprodução — precisa de casal adulto da espécie no recinto. A taxa varia
  // por espécie (vida curta e bando grande procriam mais) e sobe com
  // veterinários no quadro. A fórmula antiga (0.0009/h fixo, gestação de 8
  // dias, felicidade > .72) dava ~1 cria por vida — ninguém via nascimento.
  if (e && !a.escaped && a.sex === 'F' && a.happy > .62 && a.health > .5 &&
    a.age > sp.lifespan * .18 && a.age < sp.lifespan * .72) {
    if (a.pregnant > 0) {
      a.pregnant -= gh;
      if (a.pregnant <= 0) {
        const irmaos = e.animals.filter(z => z.sp.id === sp.id && !z.dead).length;
        if (encArea(e) >= sp.space * (irmaos + 1) && irmaos < sp.groupMax + 2) {
          const f = newAnimal(sp, e.id, 0.02); e.animals.push(f); SFX.play('nascimento');
          toast(BI`🎉 Nasceu um filhote de ${LN(sp.name)}!|🎉 A baby ${LN(sp.name)} was born!`, 'good');
          repEvento(+.12, BI`Nasceu um filhote de ${LN(sp.name)}|A baby ${LN(sp.name)} was born`, '🎉');
        }
      }
    } else {
      const fert = 5 / (sp.lifespan * YEAR_DAYS * 24)          // ~2-3 crias por vida
        * clamp(sp.gmax / 6, .6, 2)                        // bando procria mais
        * (1 + .25 * Math.min(G.nVets, 4));                // programa de cria dos vets
      if (Math.random() < gh * fert &&
        e.animals.some(z => z.sp.id === sp.id && z.sex === 'M' && !z.dead && z.age > sp.lifespan * .18)) {
        a.pregnant = 24 * clamp(sp.lifespan * .08, 1.5, 5);     // gestação proporcional
      }
    }
  }
  refreshThought(a, dt, animalThought);
  // movimento
  moveAnimal(a, dt, gh);
}
function moveAnimal(a, dt, gh) {
  const sp = a.sp;
  a.espera -= dt;
  const e = enclosures.get(a.enc);
  if (a.escaped) {
    if (a.espera <= 0) {
      a.tx = clamp(a.x + rnd(-8, 8), 1, W - 2); a.ty = clamp(a.y + rnd(-8, 8), 1, H - 2);
      a.espera = rnd(2, 5);
    }
  } else if (e && a.espera <= 0) {
    a.indoBrincar = 0;
    const t0 = encTileAleatorio(e);
    if (!t0) return;
    let bx = t0[0] + .5, by = t0[1] + .5;
    if (sp.aquatic) { // procura água entre os tiles do recinto
      for (let k = 0; k < 12; k++) {
        const t = encTileAleatorio(e); if (!t) break;
        if (TKEYS[world.terr[IDX(t[0], t[1])]] === 'water') { bx = t[0] + .5; by = t[1] + .5; break; }
      }
    } else if (Math.random() < .3) {
      // de vez em quando o passeio é até um brinquedo (bola, tronco, piscina)
      const brs = e.objs.filter(o => o.kind === 'brinquedo' || o.kind === 'tronco' || o.kind === 'piscina');
      if (brs.length) {
        const o = pick(brs);
        bx = o.x + .5 + rnd(-.3, .3); by = o.y + .5 + rnd(-.3, .3);
        a.indoBrincar = o.id;
      }
    }
    a.tx = bx; a.ty = by;
    a.espera = rnd(1.5, 6) + (sp.scale > 1.3 ? 2 : 0);
    a.state = 'andando';
  }
  const d = dist(a.x, a.y, a.tx, a.ty);
  // na água anda-se devagar (aquático deslancha)
  const ti = IDX(clamp(a.x | 0, 0, W - 1), clamp(a.y | 0, 0, H - 1));
  const inWater = TKEYS[world.terr[ti]] === 'water';
  const vel = (a.sick ? .35 : 1) * (.5 + Math.min(sp.scale, 1.4) * .55) * (sp.plan === 'sloth' ? .25 : 1)
    * (inWater ? (sp.aquatico ? 1.15 : sp.plano === 'pernalta' ? .8 : .55) : 1);
  if (d > .08) {
    const s = Math.min(vel * dt, d);
    const nx = a.x + (a.tx - a.x) / d * s, ny = a.y + (a.ty - a.y) / d * s;
    if (a.tx < a.x - .01) a.dir = -1; else if (a.tx > a.x + .01) a.dir = 1;
    a.x = nx; a.y = ny;
    a.anim += dt * (2.2 + vel);
    a.state = a.sick ? 'doente' : 'andando';
  } else if (a.state === 'andando') {
    // chegou: se o destino era um brinquedo que segue ali, fica brincando
    const target = a.indoBrincar && e && e.objs.find(o => o.id === a.indoBrincar);
    if (target && dist(a.x, a.y, target.x + .5, target.y + .5) < 1.3) {
      a.state = 'brincando';
      a.dir = Math.sign(target.x - target.y - (a.x - a.y)) || a.dir;   // de frente para ele
    } else a.state = 'parado';
    a.indoBrincar = 0;
  }
  a.frame = Math.floor(a.anim) % FRAMES;
}

/* ==========================================================================
   8. VISITANTES
   ========================================================================== */
function newVisitor() {
  const child = Math.random() < .3;
  const v = {
    id: uid(), kind: 'vis',
    x: ENTRANCE.x + .5, y: ENTRANCE.y + .5, dir: -1, anim: 0, frame: 0,
    path: null, pi: 0, target: null, targetKind: null, action: 0,
    need: { hunger: rnd(0, .3), thirst: rnd(0, .35), banheiro: rnd(0, .2), energia: rnd(0, .2), diversao: rnd(.3, .6) },
    money: rnd(40, 260) * (child ? .5 : 1),
    mood: clamp(.55 + G.rep * .07 - Math.max(0, G.ticket - 30) * .004, .15, 1),
    vistos: new Set(), time: 0, child, item: null, indo: false, saindo: false,
    // duração sorteada UMA vez, no nascimento: reavaliar rnd() a cada tick
    // fazia todo mundo ir embora no piso da faixa e ninguém chegava às lojas
    duration: rnd(6, 11),
    // desvio lateral fixo: sem isso todo mundo pisa no centro do tile e a
    // multidão vira uma fila indiana em cima da trilha
    jx: rnd(-.32, .32), jy: rnd(-.32, .32),
    ...pick(VISITOR_LOOKS),
    balao: pick(SHIRTS),
    zoomScale: child ? .72 : 1,
  };
  G.visitors.push(v); G.stats.visHoje++; G.stats.visitorTotal++;
  earn(G.ticket, 'ingresso'); G.stats.entrHoje += G.ticket;
  return v;
}
function bestTarget(v) {
  // urgências
  const N = v.need;
  const ordem = [['banheiro', N.banheiro, 'banheiro'], ['sede', N.thirst, 'sede'],
  ['fome', N.hunger, 'fome'], ['energia', N.energia, 'energia']];
  ordem.sort((a, b) => b[1] - a[1]);
  for (const [name, val, supre] of ordem) {
    if (val > .5) {
      const o = achaServico(supre, v);
      if (o) return { kind: 'obj', ref: o, x: o.x, y: o.y };
      v.mood = clamp(v.mood - .0007 * (val - .6) * 100, 0, 1);
    }
  }
  if (N.diversao > .5 && Math.random() < .4) {
    const o = achaServico('diversao', v);
    if (o && Math.random() < .5) return { kind: 'obj', ref: o, x: o.x, y: o.y };
  }
  // exibição não vista
  const cands = [];
  for (const e of enclosures.values()) {
    if (!e.animals.length) continue;
    const vs = encViewSpots(e);
    if (!vs.length) continue;
    const peso = (v.vistos.has(e.id) ? .12 : 1) * (1 + e.animals.reduce((s, a) => s + a.sp.appeal, 0) / 12);
    cands.push({ e, vs, peso });
  }
  if (cands.length) {
    let tot = 0; for (const c of cands) tot += c.peso;
    let r = Math.random() * tot;
    for (const c of cands) { r -= c.peso; if (r <= 0) { const s = pick(c.vs); return { kind: 'exib', ref: c.e, x: s[0], y: s[1] }; } }
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
    if (B.supplies !== supre) continue;
    if (B.value > 0 && priceOf(o) > v.money) continue;
    if (!objAcessivel(o)) continue;
    const d = dist2(o.x, o.y, v.x, v.y) + o.queue.length * 26;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
const priceOf = o => Math.round(BUILDINGS[o.kind].value * (o.mult === undefined ? 1 : o.mult));

function updVisitor(v, dt, gh) {
  v.time += gh;
  // as taxas têm de fechar dentro de uma visita (~5–8 h de jogo), senão
  // ninguém chega a sentir fome e o comércio nunca vende nada
  const N = v.need;
  N.hunger = clamp(N.hunger + gh * .125, 0, 1);
  N.thirst = clamp(N.thirst + gh * .16, 0, 1);
  N.banheiro = clamp(N.banheiro + gh * .10, 0, 1);
  N.energia = clamp(N.energia + gh * .085, 0, 1);
  N.diversao = clamp(N.diversao + gh * .07, 0, 1);

  // ambiente afeta humor
  const i = IDX(clamp(v.x | 0, 0, W - 1), clamp(v.y | 0, 0, H - 1));
  let dm = 0;
  dm += clamp(world.bel[i], 0, 3) * .0016;
  dm -= world.lixo[i] * .004;
  dm -= (N.hunger > .8 ? .004 : 0) + (N.thirst > .8 ? .005 : 0) + (N.banheiro > .85 ? .006 : 0) + (N.energia > .85 ? .003 : 0);
  if (G.escaped.length) dm -= .006 * Math.min(G.escaped.length, 4);
  v.mood = clamp(v.mood + dm * gh * 10, 0, 1);
  // suja o chão
  if (world.path[i] && Math.random() < gh * .06) {
    const temLixeira = [...objects.values()].some(o => o.kind === 'lixeira' && dist2(o.x, o.y, v.x, v.y) < 36);
    world.lixo[i] = clamp(world.lixo[i] + (temLixeira ? .04 : .3), 0, 1);
  }
  refreshThought(v, dt, visitorThought);
  // Ação em curso tem prioridade sobre a decisão de ir embora: interromper aqui
  // zerava v.alvo no meio da compra e a venda nunca era registrada.
  if (v.action > 0) { v.action -= dt; if (v.action <= 0) finishAction(v); return; }
  // ir embora?
  if (!v.saindo && (v.time > v.duration || v.mood < .12 || (G.hour >= CLOSE_H - .5))) {
    v.saindo = true; v.target = null; v.path = null;
  }
  // precisa de alvo
  if (!v.path || v.pi >= v.path.length) {
    if (v.saindo) {
      const d = dist(v.x, v.y, ENTRANCE.x + .5, ENTRANCE.y + .5);
      if (d < 1.2) { visitorLeaves(v); return; }
      const st = nearestPathTile(v.x | 0, v.y | 0);
      const p = st ? findPath(st[0], st[1], ENTRANCE.x, ENTRANCE.y) : null;
      if (p) { v.path = p; v.pi = 0; } else { visitorLeaves(v); return; }
    } else {
      const target = bestTarget(v);
      if (!target) { v.mood = clamp(v.mood - .004 * gh * 10, 0, 1); v.espera = 1; wander(v); return; }
      let tx = target.x, ty = target.y;
      if (target.kind === 'obj') { const nt = nearestPathTile(target.ref.x, target.ref.y, 5); if (!nt) { v.mood -= .01; return; } tx = nt[0]; ty = nt[1]; }
      const st = nearestPathTile(v.x | 0, v.y | 0);
      const p = st ? findPath(st[0], st[1], tx, ty) : null;
      if (p) { v.path = p; v.pi = 0; v.target = target; } else { v.mood = clamp(v.mood - .02, 0, 1); wander(v); }
    }
  }
  // andar
  if (v.path && v.pi < v.path.length) {
    const [px, py] = v.path[v.pi];
    const tx = px + .5 + v.jx, ty = py + .5 + v.jy;
    const d = dist(v.x, v.y, tx, ty);
    const spd = 1.55 * (v.child ? .9 : 1) * (1 - N.energia * .28);
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
    if (world.path[IDX(tx, ty)]) { const p = findPath(st[0], st[1], tx, ty); if (p) { v.path = p; v.pi = 0; v.target = null; return; } }
  }
}
function chegou(v) {
  const a = v.target;
  if (!a) return;
  if (a.kind === 'exib') {
    const e = a.ref;
    if (!enclosures.has(e.id)) { v.target = null; return; }
    const F = FENCES[e.fence];
    let q = 0, n = 0;
    for (const an of e.animals) { if (an.dead) continue; q += an.sp.appeal * (.5 + an.happy * .5); n++; }
    if (n) {
      const bonus = (q / n) * F.sight / 10;
      v.mood = clamp(v.mood + bonus * .16, 0, 1);
      v.need.diversao = clamp(v.need.diversao - bonus * .55, 0, 1);
      if (!v.vistos.has(e.id)) { v.vistos.add(e.id); v.mood = clamp(v.mood + bonus * .1, 0, 1); }
      e.visitsToday = (e.visitsToday || 0) + 1;
    } else v.mood = clamp(v.mood - .05, 0, 1);
    v.action = rnd(1.2, 3);
    // vira de frente para o recinto (eixo x da tela ∝ x−y do mundo)
    const bb = encBBox(e);
    v.dir = Math.sign(bb.cx - bb.cy - (v.x - v.y)) || v.dir;
  } else if (a.kind === 'obj') {
    const o = a.ref;
    if (!objects.has(o.id)) { v.target = null; return; }
    o.queue.push(v.id);
    v.action = rnd(.8, 2.2);
    v.dir = Math.sign(o.x + o.w / 2 - (o.y + o.h / 2) - (v.x - v.y)) || v.dir;
  }
  v.path = null;
}
function finishAction(v) {
  const a = v.target;
  v.target = null;
  if (!a || a.kind !== 'obj') return;
  const o = a.ref; if (!objects.has(o.id)) return;
  o.queue = o.queue.filter(z => z !== v.id);
  const B = BUILDINGS[o.kind];
  const price = priceOf(o);
  if (B.value > 0) {
    if (v.money < price) { v.mood = clamp(v.mood - .06, 0, 1); return; }
    v.money -= price; earn(price, 'loja'); spend(B.unitCost, 'feed'); SFX.play('moeda');
    o.revenue += price - B.unitCost; o.sales++;
    // percepção de preço: caro demais irrita
    const just = clamp(1 - (price / Math.max(1, B.value) - 1) * .7, .1, 1.25);
    v.mood = clamp(v.mood + (just - .75) * .17, 0, 1);
    if (o.kind === 'souvenir') v.item = 'balao';
    else if (B.supplies === 'fome') v.item = 'comida';
  }
  if (B.supplies) v.need[B.supplies] = clamp(v.need[B.supplies] - B.strength * .85, 0, 1);
  v.mood = clamp(v.mood + .035, 0, 1);
}
function visitorLeaves(v) {
  G.visitors = G.visitors.filter(z => z.id !== v.id);
  const delta = (v.mood - .5) * .0075;
  G.rep = clamp(G.rep + delta, 0, 5);
  // acumula para o extrato do painel ⭐ (1 linha agregada por dia, não 1 por visitante)
  G.stats.repVis = (G.stats.repVis || 0) + delta;
}

/* ==========================================================================
   9. FUNCIONÁRIOS
   ========================================================================== */
function contratar(kind) {
  const T = STAFF_TYPES[kind];
  const s = {
    id: uid(), kind, task: null, target: null, path: null, pi: 0, action: 0,
    x: ENTRANCE.x + .5, y: ENTRANCE.y + .5, dir: -1, anim: 0, frame: 0,
    skin: pick(SKINS), shirt: T.colour,
    pants: '#3a4048', hair: pick(HAIRS), longHair: Math.random() < .4,
    hat: kind === 'trat' ? '#8a6a3c' : kind === 'seg' ? '#2b2b33' : null,
    role: kind, mood: .8, zoomScale: 1, feitos: 0,
  };
  G.staff.push(s);
  return s;
}
function findTask(s) {
  if (s.kind === 'trat') {
    let best = null, bd = 1e9;
    for (const e of enclosures.values()) {
      if (!e.animals.length) continue;
      const urg = (1 - e.food) * (encHasFeeder(e) ? 1.4 : 0) + (1 - e.water) * (encHasWater(e) ? 1.2 : 0) + (1 - e.cleanliness) * 1.6;
      if (urg < .55) continue;
      const bb = encBBox(e);
      const d = dist2(bb.cx, bb.cy, s.x, s.y) / Math.max(.2, urg);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { const bb = encBBox(best); return { kind: 'enc', ref: best, x: bb.cx | 0, y: bb.cy | 0 }; }
  } else if (s.kind === 'vet') {
    let best = null, bd = 1e9;
    for (const a of G.animals) {
      if (a.dead || a.escaped) continue;
      if (!a.sick && a.health > .55) continue;
      const d = dist2(a.x, a.y, s.x, s.y) / (a.sick ? 3 : 1);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) return { kind: 'animal', ref: best, x: best.x | 0, y: best.y | 0 };
  } else if (s.kind === 'fax') {
    let best = null, bd = 1e9;
    for (let k = 0; k < W * H; k++) {
      if (world.lixo[k] < .3) continue;
      const x = k % W, y = (k / W) | 0;
      const d = dist2(x, y, s.x, s.y) / Math.max(.3, world.lixo[k]);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) return { kind: 'lixo', ref: best, x: best[0], y: best[1] };
  } else if (s.kind === 'seg') {
    if (G.escaped.length) { const a = G.escaped[0]; return { kind: 'fuga', ref: a, x: a.x | 0, y: a.y | 0 }; }
  }
  return null;
}
function updStaff(s, dt, gh) {
  if (s.action > 0) {
    s.action -= dt;
    if (s.action <= 0) runTask(s);
    return;
  }
  if (!s.task) {
    s.task = findTask(s);
    s.path = null;
    if (!s.task) { // patrulha
      if (!s.pat || dist(s.x, s.y, s.pat[0], s.pat[1]) < 1) {
        const t = nearestPathTile(rndi(2, W - 3), rndi(2, H - 3), 20) || [ENTRANCE.x, ENTRANCE.y];
        s.pat = [t[0] + .5, t[1] + .5];
      }
      moveTo(s, s.pat[0], s.pat[1], dt, 1.5);
      return;
    }
  }
  const T = s.task;
  const alvoX = (T.kind === 'animal' || T.kind === 'fuga') ? T.ref.x : T.x + .5;
  const alvoY = (T.kind === 'animal' || T.kind === 'fuga') ? T.ref.y : T.y + .5;
  const d = dist(s.x, s.y, alvoX, alvoY);
  if (d < .8) { s.action = s.kind === 'trat' ? 2.2 : s.kind === 'vet' ? 3 : 1.1; }
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
function runTask(s) {
  const T = s.task; s.task = null;
  if (!T) return;
  s.feitos++;
  if (T.kind === 'enc') {
    const e = T.ref; if (!enclosures.has(e.id)) return;
    let cost = 0;
    if (encHasFeeder(e)) { const q = 1 - e.food; e.food = 1; cost += q * e.animals.reduce((a, z) => a + z.sp.feed, 0) * .9; }
    if (encHasWater(e)) e.water = 1;
    e.cleanliness = 1;
    if (cost > 0) spend(cost, 'feed');
  } else if (T.kind === 'animal') {
    const a = T.ref; if (a.dead) return;
    a.sick = false; a.health = clamp(a.health + .45, 0, 1);
    spend(320, 'manut');
    toast(BI`💉 ${a.name} foi tratado pelo veterinário|💉 ${a.name} was treated by the vet`, 'good');
  } else if (T.kind === 'lixo') {
    world.lixo[IDX(T.ref[0], T.ref[1])] = 0;
  } else if (T.kind === 'fuga') {
    const a = T.ref; if (!a.escaped) return;
    a.escaped = false;
    G.escaped = G.escaped.filter(z => z.id !== a.id);
    const e = enclosures.get(a.enc);
    if (e && enclosures.has(e.id)) {
      e.animals.push(a);
      const t = encTileAleatorio(e); if (t) { a.x = t[0] + .5; a.y = t[1] + .5; a.tx = a.x; a.ty = a.y; }
      toast(BI`🔒 ${LN(a.LN(sp.name))} foi recapturado|🔒 The ${LN(a.LN(sp.name))} was recaptured`, 'good');
    } else { a.dead = true; toast(BI`💀 ${LN(a.LN(sp.name))} se perdeu — o recinto não existe mais|💀 The ${LN(a.LN(sp.name))} was lost — its enclosure is gone`, 'bad'); }
  }
}