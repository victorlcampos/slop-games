// Os monstros são as lendas de cada povo que ganharam corpo. Como o Brasil é a
// primeira campanha, aqui o inimigo é o folclore — e é por isso que os humanos
// não conseguem enfrentá-los: eles cresceram ouvindo essas histórias.
//
// velocidade em pixels por segundo (uma coluna do tabuleiro tem ~112px)
// armadura  absorve dano fixo por acerto, até ser quebrada
// voa       só toma dano de animal com `aereo`
// aquatico  só entra pelas fileiras alagadas — e lá briga como todo mundo
// troca     anfíbio: muda de fileira e toma a forma do terreno novo
// oculto    invisível até uma Coruja revelar (ou até morder alguém)
//
// `voa` e `aquatico` não se misturam: quem voa sobre a água fica fora do
// alcance de todo mundo, porque fileira alagada só aceita bicho aquático e
// nenhum bicho aquático é `aereo`. Era o que acontecia com a Iara.
//
// Hoje nenhum monstro voa — a regra continua implementada e vale para quando
// entrar um voador de terra firme, que é onde os bichos `aereo` do baralho
// (Abelha, Morcego, Coruja, Águia) voltam a ter alvo exclusivo.

export const MONSTROS = [
  {
    id: 'corposeco',
    nome: 'Corpo-seco',
    lenda: 'Foi tão ruim em vida que nem a terra quis receber. Voltou andando.',
    vida: 220,
    velocidade: 21,
    dano: 18,
    intervalo: 1,
    valor: 12,
  },
  {
    id: 'saci',
    nome: 'Saci',
    lenda: 'Uma perna, um gorro e a paciência de ninguém. Some no redemoinho e aparece atrás.',
    vida: 150,
    velocidade: 46,
    dano: 14,
    intervalo: 0.9,
    pula: true,
    valor: 16,
  },
  {
    id: 'curupira',
    nome: 'Curupira',
    lenda: 'Pés virados para trás: quem segue o rastro dele anda no sentido errado a vida toda.',
    vida: 190,
    velocidade: 62,
    dano: 16,
    intervalo: 0.8,
    valor: 18,
  },
  {
    id: 'cabecadecuia',
    nome: 'Cabeça de Cuia',
    lenda: 'Cabeçorra de cuia, faminto no rio. Cospe de longe para não precisar chegar perto.',
    vida: 230,
    velocidade: 17,
    dano: 22,
    intervalo: 2,
    distancia: 2.6,
    valor: 20,
  },
  {
    id: 'mula',
    nome: 'Mula sem Cabeça',
    lenda: 'Ferradura em brasa e nenhuma cabeça para ouvir razão. Vem em disparada.',
    vida: 420,
    velocidade: 30,
    dano: 30,
    intervalo: 1.2,
    armadura: 12,
    disparada: { gatilho: 0.5, fator: 2.4 },
    valor: 30,
  },
  {
    id: 'iara',
    nome: 'Iara',
    lenda: 'Canta na beira do rio. Quem escuta, entra na água e não volta.',
    vida: 260,
    velocidade: 27,
    dano: 20,
    intervalo: 1.3,
    aquatico: true,
    valor: 28,
  },
  {
    id: 'boto',
    nome: 'Boto',
    lenda: 'No rio é bicho. Na festa é moço de terno branco que não tira o chapéu por nada — e ninguém desconfia do porquê.',
    vida: 300,
    velocidade: 24,
    dano: 22,
    intervalo: 1.2,
    // O único que atravessa a linha da água: de tempo em tempo passa para a
    // fileira do lado e toma a forma do terreno — boto no rio, homem na terra.
    // Muralha numa fileira só não segura ele, e é isso que ele cobra do
    // jogador: defender a água **e** a margem.
    troca: { intervalo: 5 },
    valor: 30,
  },
  {
    id: 'maedeouro',
    nome: 'Mãe-de-Ouro',
    lenda: 'Bola de fogo que risca o céu de Minas mostrando onde tem ouro. Passa por cima de tudo e de todos.',
    // Voador não morde defesa nenhuma: o `passoMonstros` faz quem tem `voa`
    // ignorar quem está no chão e seguir andando. A ameaça dela não é dano, é
    // a cerca — por isso vida baixa e velocidade alta. Quem tem a resposta
    // derruba rápido; quem não tem, vê ela atravessar o campo inteiro.
    vida: 300,
    velocidade: 40,
    voa: true,
    valor: 32,
  },
  {
    id: 'boitata',
    nome: 'Boitatá',
    lenda: 'Cobra de fogo que guarda a mata. Não distingue mais quem queima.',
    vida: 380,
    velocidade: 19,
    dano: 26,
    intervalo: 1.6,
    distancia: 1.8,
    queima: { dano: 9, duracao: 4 },
    valor: 34,
  },
  {
    id: 'lobisomem',
    nome: 'Lobisomem',
    lenda: 'Sétimo filho homem. Na lua cheia, esquece que um dia foi gente.',
    vida: 520,
    velocidade: 26,
    dano: 34,
    intervalo: 1,
    enfurece: { gatilho: 0.4, fator: 2.2 },
    valor: 38,
  },
  {
    id: 'mapinguari',
    nome: 'Mapinguari',
    lenda: 'Um olho só, boca na barriga e um fedor que chega antes dele.',
    vida: 900,
    velocidade: 14,
    dano: 45,
    intervalo: 1.5,
    armadura: 18,
    valor: 55,
  },
  {
    id: 'bichopapao',
    nome: 'Bicho-papão',
    lenda: 'Mora no escuro embaixo da cama e só existe enquanto ninguém acende a luz.',
    vida: 1400,
    velocidade: 16,
    dano: 50,
    intervalo: 1.4,
    oculto: true,
    escala: 1.5,
    chefinho: true,
    valor: 90,
  },
  {
    id: 'cuca',
    nome: 'Cuca',
    lenda: 'A bruxa-jacaré que nunca dorme. Faz sete anos que ela espera este dia.',
    vida: 5200,
    velocidade: 11,
    dano: 70,
    intervalo: 1.6,
    armadura: 22,
    escala: 2.1,
    chefe: true,
    invoca: { tipos: ['corposeco', 'saci', 'curupira'], intervalo: 9, quantidade: 2 },
    fases: [
      { vida: 0.66, fala: 'Durma, bichinho… durma…' },
      { vida: 0.33, fala: 'SETE ANOS! SETE ANOS EU ESPEREI!' },
    ],
    valor: 400,
  },
];

export const MONSTRO_POR_ID = Object.fromEntries(MONSTROS.map((m) => [m.id, m]));
