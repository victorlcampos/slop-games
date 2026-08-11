// As cartas. O elenco é do mundo inteiro — a resistência é global, só a
// campanha é que começa no Brasil.
//
// custo    = sementes gastas na batalha
// preco    = moedas na loja entre fases (0 = já vem no baralho inicial)
// recarga  = segundos até a carta poder ser jogada de novo
// papel    = como a criatura se comporta em campo:
//   gerador  produz sementes sozinho
//   atirador dispara pela fileira
//   parede   segura a fileira no peito
//   corpo    bate em quem chega perto
//   area     efeito em volta (gelo, atordoamento)
//   bomba    uso único, some depois de agir
//
// aereo    = acerta monstro que flutua (quem não tem, erra feio)
// aquatico = pode ser posto em fileira alagada

export const ANIMAIS = [
  // ------------------------------------------------------------ o baralho inicial
  {
    id: 'esquilo',
    nome: 'Esquilo',
    origem: 'Canadá',
    papel: 'gerador',
    custo: 50,
    preco: 0,
    recarga: 5,
    vida: 70,
    intervalo: 7,
    produz: 25,
    descricao: 'Enterra e desenterra castanha o dia todo. Sem ele, não sai nada do chão.',
  },
  {
    id: 'macaco',
    nome: 'Macaco',
    origem: 'Congo',
    papel: 'atirador',
    custo: 100,
    preco: 0,
    recarga: 5,
    vida: 80,
    intervalo: 1.5,
    dano: 22,
    projetil: 'coco',
    descricao: 'Joga coco com pontaria de quem treinou a vida toda acertando primo.',
  },
  {
    id: 'tartaruga',
    nome: 'Tartaruga',
    origem: 'Galápagos',
    papel: 'parede',
    custo: 50,
    preco: 0,
    recarga: 8,
    vida: 480,
    descricao: 'Não ataca, não corre, não reclama. Só fica ali sendo casco.',
  },

  // ------------------------------------------------------------------- na loja
  {
    id: 'abelha',
    nome: 'Abelha',
    origem: 'Eslovênia',
    papel: 'atirador',
    custo: 150,
    preco: 120,
    recarga: 6,
    vida: 45,
    intervalo: 0.45,
    dano: 9,
    aereo: true,
    projetil: 'ferrao',
    descricao: 'Ferroada atrás de ferroada. Alcança o que voa, porque também voa.',
  },
  {
    id: 'ourico',
    nome: 'Ouriço',
    origem: 'Alemanha',
    papel: 'parede',
    custo: 100,
    preco: 140,
    recarga: 8,
    vida: 320,
    espinhos: 18,
    descricao: 'Parede que dói. Quem morde, se arrepende no mesmo segundo.',
  },
  {
    id: 'castor',
    nome: 'Castor',
    origem: 'Canadá',
    papel: 'gerador',
    custo: 150,
    preco: 160,
    recarga: 7,
    vida: 110,
    intervalo: 6,
    produz: 40,
    descricao: 'Rói, empilha, represa e ainda sobra madeira para vender.',
  },
  {
    id: 'morcego',
    nome: 'Morcego',
    origem: 'México',
    papel: 'atirador',
    custo: 125,
    preco: 150,
    recarga: 5,
    vida: 55,
    intervalo: 1.1,
    dano: 20,
    aereo: true,
    projetil: 'eco',
    descricao: 'Enxerga no escuro e no nevoeiro. Grito que corta o ar e o monstro.',
  },
  {
    id: 'escorpiao',
    nome: 'Escorpião',
    origem: 'Egito',
    papel: 'atirador',
    custo: 150,
    preco: 190,
    recarga: 7,
    vida: 70,
    intervalo: 2.2,
    dano: 12,
    veneno: { dano: 7, duracao: 5 },
    descricao: 'O ferrão mal arranha. O que vem depois é que resolve.',
  },
  {
    id: 'canguru',
    nome: 'Canguru',
    origem: 'Austrália',
    papel: 'corpo',
    custo: 175,
    preco: 200,
    recarga: 8,
    vida: 260,
    intervalo: 1.6,
    dano: 40,
    empurra: 70,
    descricao: 'Coice que devolve o monstro para onde ele veio.',
  },
  {
    id: 'gamba',
    nome: 'Gambá',
    origem: 'Estados Unidos',
    papel: 'bomba',
    custo: 125,
    preco: 170,
    recarga: 12,
    vida: 60,
    raio: 1.4,
    dano: 320,
    descricao: 'Solta o fedor e leva junto tudo que estiver por perto. Inclusive ele.',
  },
  {
    id: 'coruja',
    nome: 'Coruja',
    origem: 'Grécia',
    papel: 'atirador',
    custo: 175,
    preco: 210,
    recarga: 7,
    vida: 85,
    intervalo: 1.7,
    dano: 30,
    aereo: true,
    revela: true,
    projetil: 'pena',
    descricao: 'Enxerga o que a névoa esconde. O resto da fileira agradece.',
  },
  {
    id: 'cobra',
    nome: 'Cobra',
    origem: 'Índia',
    papel: 'atirador',
    custo: 175,
    preco: 230,
    recarga: 8,
    vida: 75,
    intervalo: 2.4,
    dano: 34,
    perfura: true,
    projetil: 'cuspe',
    descricao: 'Cospe reto e não pergunta quantos estão na frente. Pega todos.',
  },
  {
    id: 'jacare',
    nome: 'Jacaré',
    origem: 'Flórida',
    papel: 'corpo',
    custo: 200,
    preco: 240,
    recarga: 9,
    vida: 340,
    intervalo: 1.4,
    dano: 55,
    aquatico: true,
    descricao: 'Fica de tocaia fingindo tronco. Aí fecha a boca.',
  },
  {
    id: 'aguia',
    nome: 'Águia',
    origem: 'Mongólia',
    papel: 'atirador',
    custo: 225,
    preco: 260,
    recarga: 8,
    vida: 95,
    intervalo: 1.9,
    dano: 55,
    aereo: true,
    prioridadeAerea: true,
    projetil: 'garra',
    descricao: 'Mergulha do alto em quem acha que voar era vantagem.',
  },
  {
    id: 'hipopotamo',
    nome: 'Hipopótamo',
    origem: 'Tanzânia',
    papel: 'parede',
    custo: 225,
    preco: 280,
    recarga: 10,
    vida: 620,
    aquatico: true,
    descricao: 'Boia parado feito pedra. Uma pedra de duas toneladas e mau humor.',
  },
  {
    id: 'onca',
    nome: 'Onça',
    origem: 'Brasil',
    papel: 'corpo',
    custo: 275,
    preco: 380,
    recarga: 10,
    vida: 300,
    intervalo: 0.9,
    dano: 60,
    descricao: 'Não espera o monstro chegar: dá dois passos à frente e resolve.',
    avanca: true,
  },
  {
    id: 'ursopolar',
    nome: 'Urso Polar',
    origem: 'Groenlândia',
    papel: 'area',
    custo: 250,
    preco: 340,
    recarga: 12,
    vida: 400,
    intervalo: 4,
    raio: 1.8,
    lentidao: { fator: 0.45, duracao: 4 },
    dano: 18,
    descricao: 'O sopro dele congela o chão. Monstro apressado vira monstro devagar.',
  },
  {
    id: 'leao',
    nome: 'Leão',
    origem: 'Quênia',
    papel: 'area',
    custo: 300,
    preco: 440,
    recarga: 14,
    vida: 380,
    intervalo: 6,
    raio: 2.6,
    atordoa: 2.5,
    dano: 45,
    descricao: 'Um rugido e a fileira inteira para para lembrar quem manda aqui.',
  },
  {
    id: 'elefante',
    nome: 'Elefante',
    origem: 'Índia',
    papel: 'parede',
    custo: 300,
    preco: 520,
    recarga: 14,
    vida: 900,
    intervalo: 3,
    dano: 30,
    empurra: 110,
    descricao: 'A muralha que empurra de volta. Nada passa por cima de elefante.',
  },
];

export const POR_ID = Object.fromEntries(ANIMAIS.map((a) => [a.id, a]));

/** As três cartas com que todo mundo começa. */
export const BARALHO_INICIAL = ANIMAIS.filter((a) => a.preco === 0).map((a) => a.id);

/**
 * As cartas que a vitrine da loja **precisa** oferecer antes de uma fase.
 *
 * Hoje só a água manda alguma coisa aqui, e manda por um motivo duro: a partir
 * da fase 4 a Iara desce pela fileira alagada, e ali só entra bicho aquático.
 * Quem chega sem nenhum não tem o que plantar naquela fileira — a vitrine é
 * sorteada e pode simplesmente nunca ter mostrado um Jacaré.
 *
 * Devolve vazio quando o baralho já resolve a exigência.
 */
export function cartasExigidas(fase, baralho = []) {
  if (!fase || !fase.agua || !fase.agua.length) return [];
  const aquaticos = ANIMAIS.filter((a) => a.aquatico);
  if (aquaticos.some((a) => baralho.includes(a.id))) return [];
  return aquaticos.map((a) => a.id);
}

/**
 * Sorteia até 3 cartas que o jogador ainda não tem.
 *
 * O sorteio olha o bolso: se ele pode pagar por alguma coisa, ao menos uma das
 * ofertas é comprável agora. Sortear os três recrutas caros logo na primeira
 * fase transforma a recompensa em vitrine — o jogador vence e não leva nada.
 *
 * `exigidas` fura a fila: são as cartas sem as quais a próxima fase não tem
 * defesa possível (hoje, o bicho aquático antes da fase da água). Sorte não
 * pode ser o que decide se a fase seguinte é jogável.
 */
export function sortearCartas(baralho, quantas = 3, moedas = 0, exigidas = []) {
  const faltam = ANIMAIS.filter((a) => a.preco > 0 && !baralho.includes(a.id));
  if (!faltam.length) return [];

  const sorteadas = [];
  const obrigatorias = faltam.filter((a) => exigidas.includes(a.id));
  if (obrigatorias.length) {
    sorteadas.push(obrigatorias[Math.floor(Math.random() * obrigatorias.length)].id);
  }

  const acessiveis = faltam.filter((a) => a.preco <= moedas && !sorteadas.includes(a.id));
  if (acessiveis.length && sorteadas.length < quantas) {
    sorteadas.push(acessiveis[Math.floor(Math.random() * acessiveis.length)].id);
  }

  // o resto sai da metade mais barata do que sobrou, para a vitrine ficar
  // ambiciosa sem virar impossível
  const pilha = faltam.filter((a) => !sorteadas.includes(a.id)).sort((a, b) => a.preco - b.preco);
  const janela = pilha.slice(0, Math.max(quantas, Math.ceil(pilha.length * 0.65)));
  while (sorteadas.length < quantas && janela.length) {
    sorteadas.push(janela.splice(Math.floor(Math.random() * janela.length), 1)[0].id);
  }

  // se a janela acabou antes, completa com qualquer uma que reste
  const sobra = faltam.filter((a) => !sorteadas.includes(a.id));
  while (sorteadas.length < quantas && sobra.length) {
    sorteadas.push(sobra.splice(Math.floor(Math.random() * sobra.length), 1)[0].id);
  }
  return sorteadas;
}

// ------------------------------------------------------------------- níveis

/**
 * Treinar uma carta melhora o que ela já faz — e **não muda o custo em
 * sementes**. É esse detalhe que faz a melhoria valer a pena: a mesma semente
 * em campo passa a render mais. Se o custo subisse junto, treinar seria só
 * inflação com outro nome.
 *
 * O nível 3 também encurta a recarga: além de mais forte, a carta volta antes.
 */
export const NIVEL_MAX = 3;

export const NIVEIS = [
  { n: 1, forca: 1, recarga: 1, rotulo: '' },
  { n: 2, forca: 1.35, recarga: 0.9, rotulo: 'II' },
  { n: 3, forca: 1.8, recarga: 0.75, rotulo: 'III' },
];

/** O que a força multiplica. Custo e intervalo ficam de fora, de propósito. */
const ESCALA = ['vida', 'dano', 'produz', 'espinhos', 'empurra'];

/**
 * A carta como ela está em campo, no nível em que o jogador a treinou.
 * Devolve sempre um objeto novo: ninguém deve mutar a definição base.
 */
export function cartaNoNivel(idOuCarta, nivel = 1) {
  const base = typeof idOuCarta === 'string' ? POR_ID[idOuCarta] : idOuCarta;
  if (!base) return null;
  const n = Math.min(Math.max(1, nivel | 0), NIVEL_MAX);
  const info = NIVEIS[n - 1];
  const c = { ...base, nivel: n, rotuloNivel: info.rotulo };

  for (const attr of ESCALA) {
    if (typeof c[attr] === 'number') c[attr] = Math.round(c[attr] * info.forca);
  }
  // veneno e lentidão são objetos: escala só o que machuca
  if (c.veneno) c.veneno = { ...c.veneno, dano: Math.round(c.veneno.dano * info.forca) };
  if (c.lentidao) c.lentidao = { ...c.lentidao, duracao: +(c.lentidao.duracao * info.forca).toFixed(1) };
  if (c.atordoa) c.atordoa = +(c.atordoa * info.forca).toFixed(1);
  c.recarga = +(base.recarga * info.recarga).toFixed(1);

  return c;
}

/**
 * Quanto custa subir uma carta para o próximo nível.
 *
 * A conta sai do valor da própria carta, então treinar um Elefante custa mais
 * que treinar um Esquilo — e mais que recrutar uma carta média. É a escolha do
 * jogo: aprofundar o que você tem ou abrir o leque.
 *
 * As três cartas iniciais não têm preço (vêm de graça), então usam um valor de
 * referência para não sair treinamento a preço de banana.
 */
const VALOR_INICIAL = 150;
const FATOR = { 2: 0.7, 3: 1.2 };

export function custoDeTreino(idOuCarta, nivelAtual) {
  const base = typeof idOuCarta === 'string' ? POR_ID[idOuCarta] : idOuCarta;
  if (!base) return null;
  const proximo = (nivelAtual | 0) + 1;
  if (proximo > NIVEL_MAX) return null;
  return Math.round((base.preco || VALOR_INICIAL) * FATOR[proximo]);
}
