// Testes da economia — conta pura, sem navegador, em milissegundos.
//
// É aqui que o balanceamento fica honesto: em vez de "acho que está bom", cada
// regra vira um número verificado. Quando alguém mexer nos preços, isto avisa o
// que quebrou.

import { cenario, conferir, conferirIgual, rodar } from 'slopkit/testes';
import { calcularRecompensa } from '../src/dados/economia.js';
import {
  ANIMAIS, POR_ID, BARALHO_INICIAL, cartaNoNivel, custoDeTreino, cartasExigidas, sortearCartas, NIVEL_MAX,
} from '../src/dados/animais.js';
import { MONSTRO_POR_ID } from '../src/dados/monstros.js';
import { FASES } from '../src/dados/fases.js';

const faseTeste = { moedas: 300, ondas: [1, 2, 3, 4, 5] };

// ------------------------------------------------------------------ níveis

cenario('treinar aumenta o que a carta faz, sem mexer no custo em sementes', () => {
  const macaco1 = cartaNoNivel('macaco', 1);
  const macaco3 = cartaNoNivel('macaco', 3);
  conferir(macaco3.dano > macaco1.dano, 'o dano tem de subir');
  conferirIgual(macaco3.custo, macaco1.custo, 'o custo em sementes NÃO muda — é o que faz treinar valer');
  conferir(macaco3.recarga < macaco1.recarga, 'no nível 3 a carta também volta mais rápido');
});

cenario('cada papel melhora no atributo que importa para ele', () => {
  conferir(cartaNoNivel('esquilo', 2).produz > POR_ID.esquilo.produz, 'gerador produz mais');
  conferir(cartaNoNivel('tartaruga', 2).vida > POR_ID.tartaruga.vida, 'parede aguenta mais');
  conferir(cartaNoNivel('ourico', 2).espinhos > POR_ID.ourico.espinhos, 'espinho dói mais');
  conferir(cartaNoNivel('escorpiao', 2).veneno.dano > POR_ID.escorpiao.veneno.dano, 'veneno mais forte');
  conferir(cartaNoNivel('leao', 2).atordoa > POR_ID.leao.atordoa, 'rugido atordoa por mais tempo');
});

cenario('o nível não escapa da faixa, venha de onde vier', () => {
  conferirIgual(cartaNoNivel('macaco', 99).nivel, NIVEL_MAX, 'save adulterado não dá nível 99');
  conferirIgual(cartaNoNivel('macaco', 0).nivel, 1, 'nem nível zero');
  conferirIgual(cartaNoNivel('macaco', -5).nivel, 1, 'nem negativo');
  conferirIgual(cartaNoNivel('nao-existe', 2), null, 'carta inexistente devolve null, não explode');
});

cenario('a definição base nunca é mutada', () => {
  const danoOriginal = POR_ID.macaco.dano;
  cartaNoNivel('macaco', 3);
  cartaNoNivel('macaco', 3);
  conferirIgual(POR_ID.macaco.dano, danoOriginal, 'chamar duas vezes não pode acumular no original');
});

cenario('treinar fica mais caro a cada nível, e cartas melhores custam mais', () => {
  conferir(custoDeTreino('macaco', 2) > custoDeTreino('macaco', 1), '2→3 custa mais que 1→2');
  conferir(custoDeTreino('elefante', 1) > custoDeTreino('abelha', 1), 'treinar o Elefante custa mais que a Abelha');
  conferirIgual(custoDeTreino('macaco', NIVEL_MAX), null, 'no nível máximo não há o que comprar');
});

// ------------------------------------------------------------ água e elenco

cenario('monstro aquático só é chamado por fase que tem água', () => {
  for (const fase of FASES) {
    const temAgua = !!(fase.agua && fase.agua.length);
    for (const onda of fase.ondas) {
      for (const [id] of onda.monstros) {
        const def = MONSTRO_POR_ID[id];
        conferir(def, `fase ${fase.n} chama um monstro que não existe: ${id}`);
        if (def.aquatico) {
          conferir(temAgua, `fase ${fase.n} chama ${id}, que só entra pela água, e não tem fileira alagada`);
        }
      }
    }
  }
});

cenario('quem vem pela água não é imune a quem defende a água', () => {
  // fileira alagada só aceita bicho aquático, e nenhum bicho aquático é aéreo:
  // um monstro que voasse **e** nadasse ficaria fora do alcance de todo mundo.
  // Era exatamente o buraco da Iara.
  const aquaticos = ANIMAIS.filter((a) => a.aquatico);
  conferir(aquaticos.length >= 2, 'precisa haver bicho aquático para defender a água');
  conferir(
    aquaticos.some((a) => typeof a.dano === 'number' && a.dano > 0),
    'pelo menos um bicho aquático precisa causar dano — parede sozinha só adia'
  );
  for (const id in MONSTRO_POR_ID) {
    const def = MONSTRO_POR_ID[id];
    conferir(!(def.aquatico && def.voa), `${id} voa e nada ao mesmo tempo: ninguém alcança ele`);
  }
});

cenario('quem voa tem resposta comprável antes de aparecer', () => {
  // um voador ignora defesa de chão inteira: só as cartas `aereo` respondem.
  // Se ele estreia antes de o jogador ter podido comprar uma, a fase não é
  // difícil — é impossível.
  const aereos = ANIMAIS.filter((a) => a.aereo);
  conferir(aereos.length > 0, 'sem carta aérea, monstro voador não tem resposta');
  const maisBarata = Math.min(...aereos.map((a) => a.preco));

  for (const fase of FASES) {
    const voa = fase.ondas.some((o) => o.monstros.some(([id]) => MONSTRO_POR_ID[id].voa));
    if (!voa) continue;
    // o que a campanha já pagou até o começo desta fase, sem contar troco
    const rendaAte = FASES.filter((f) => f.n < fase.n).reduce((s, f) => s + f.moedas, 0);
    conferir(
      rendaAte >= maisBarata,
      `fase ${fase.n} tem voador, mas até ela a campanha só pagou ${rendaAte} e a carta aérea mais barata custa ${maisBarata}`
    );
    conferir(!(fase.agua && fase.agua.length), `fase ${fase.n} mistura voador e água: sobre o rio ninguém alcança ele`);
  }
});

cenario('a vitrine garante bicho aquático antes da fase da água', () => {
  const pantanal = FASES.find((f) => f.n === 4);
  const semAquatico = ['esquilo', 'macaco', 'tartaruga'];
  const exigidas = cartasExigidas(pantanal, semAquatico);
  conferir(exigidas.length > 0, 'quem chega no Pantanal sem bicho de água precisa ver um na loja');
  conferir(exigidas.every((id) => POR_ID[id].aquatico), 'a exigência da água só pede bicho de água');

  conferirIgual(cartasExigidas(pantanal, [...semAquatico, 'jacare']), [], 'quem já tem Jacaré não precisa de empurrão');
  conferirIgual(cartasExigidas(FASES.find((f) => f.n === 1), semAquatico), [], 'fase sem água não exige nada');
  conferirIgual(cartasExigidas(null, semAquatico), [], 'sem próxima fase, sem exigência');

  // e a exigência tem de aparecer na vitrine em toda tentativa, não na média
  for (let i = 0; i < 200; i++) {
    const ofertas = sortearCartas(BARALHO_INICIAL, 3, 600, exigidas);
    conferirIgual(ofertas.length, 3, 'a vitrine continua com três cartas');
    conferir(new Set(ofertas).size === 3, 'e sem carta repetida');
    conferir(ofertas.some((id) => exigidas.includes(id)), 'toda vitrine antes da água precisa ter um bicho de água');
  }
});

cenario('a vitrine continua olhando o bolso quando não há exigência', () => {
  for (let i = 0; i < 200; i++) {
    // 140 paga a segunda carta mais barata: sempre há algo comprável para ofertar
    const ofertas = sortearCartas(BARALHO_INICIAL, 3, 140);
    conferirIgual(ofertas.length, 3, 'três ofertas');
    conferir(ofertas.some((id) => POR_ID[id].preco <= 140), 'ao menos uma oferta comprável agora');
  }
});

// -------------------------------------------------------------- recompensa

cenario('vencer paga a recompensa cheia da fase', () => {
  const r = calcularRecompensa(faseTeste, { sobra: 0, ondaAtual: 4 }, true, true);
  conferirIgual(r.base, 300, 'a base é o prêmio da fase');
});

cenario('perder paga, e paga por quanto você segurou', () => {
  const cedo = calcularRecompensa(faseTeste, { sobra: 0, ondaAtual: -1 }, false, true);
  const tarde = calcularRecompensa(faseTeste, { sobra: 0, ondaAtual: 4 }, false, true);
  conferir(cedo.total > 0, 'perder na primeira onda ainda paga alguma coisa');
  conferir(tarde.total > cedo.total * 2, 'segurar até o fim tem de valer bem mais');
  conferir(tarde.total < 300, 'mas nunca tanto quanto vencer');
});

cenario('perder nunca rende mais que vencer, em nenhum ponto da fase', () => {
  const vitoria = calcularRecompensa(faseTeste, { sobra: 0, ondaAtual: 4 }, true, true).total;
  for (let onda = -1; onda < 5; onda++) {
    const derrota = calcularRecompensa(faseTeste, { sobra: 0, ondaAtual: onda }, false, true).total;
    conferir(derrota < vitoria, `onda ${onda}: derrota (${derrota}) devia ser menor que vitória (${vitoria})`);
  }
});

cenario('a semente que sobra vira moeda, mas com teto', () => {
  const pouca = calcularRecompensa(faseTeste, { sobra: 100, ondaAtual: 4 }, true, true);
  conferirIgual(pouca.troco, 20, '100 sementes a 5 por 1 = 20 moedas');

  const absurda = calcularRecompensa(faseTeste, { sobra: 99999, ondaAtual: 4 }, true, true);
  conferirIgual(absurda.troco, 105, 'o teto é 35% da recompensa cheia (300 → 105)');
  conferir(absurda.troco < absurda.base, 'guardar semente nunca pode render mais que jogar a fase');
});

cenario('refazer fase já vencida rende bem menos', () => {
  const primeira = calcularRecompensa(faseTeste, { sobra: 0, ondaAtual: 4 }, true, true);
  const repetida = calcularRecompensa(faseTeste, { sobra: 0, ondaAtual: 4 }, true, false);
  conferir(repetida.base < primeira.base * 0.5, 'senão a fase 1 vira caixa eletrônico');
});

// ------------------------------------------------- o balanço da campanha

cenario('a campanha não paga tudo — o jogador precisa escolher', () => {
  const rendaBase = FASES.reduce((s, f) => s + f.moedas, 0);
  const trocoTipico = FASES.reduce(
    (s, f) => s + calcularRecompensa(f, { sobra: 300, ondaAtual: 99 }, true, true).troco,
    0
  );
  const renda = rendaBase + trocoTipico;

  const recrutarTudo = ANIMAIS.filter((a) => a.preco > 0).reduce((s, a) => s + a.preco, 0);
  const treinarTudo = ANIMAIS.reduce((s, a) => {
    let t = 0;
    for (let n = 1; n < NIVEL_MAX; n++) t += custoDeTreino(a, n);
    return s + t;
  }, 0);

  conferir(renda < recrutarTudo + treinarTudo, 'ter tudo não pode caber no orçamento — senão não há escolha');
  conferir(renda > recrutarTudo * 0.6, 'mas precisa dar para montar um baralho decente');
  conferir(
    treinarTudo > recrutarTudo,
    'aprofundar custa mais que abrir o leque: é o que torna a especialização uma aposta'
  );
});

await rodar('economia de animais vs monstros');
