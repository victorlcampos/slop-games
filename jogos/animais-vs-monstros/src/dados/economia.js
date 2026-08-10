// A conta da recompensa, separada da tela para caber num teste de unidade.
//
// Uma função só para vitória e derrota, porque as regras são as mesmas com
// pesos diferentes — duas funções divergiriam na primeira mudança.

/**
 * @param {object} fase    a fase jogada (usa `moedas` e `ondas`)
 * @param {object} resumo  o que a batalha devolveu
 * @param {boolean} venceu
 * @param {boolean} primeiraVez  se a fase ainda não tinha sido vencida
 */
export function calcularRecompensa(fase, resumo, venceu, primeiraVez) {
  const cheia = fase.moedas;

  let base;
  if (venceu) {
    base = cheia;
  } else {
    // Perder paga pelo que você segurou: a fração de ondas que passou. Perder
    // na última onda vale quase três vezes mais que desistir na primeira, e
    // tentar uma fase difícil deixa de ser tempo jogado fora.
    const total = (fase.ondas && fase.ondas.length) || 1;
    const progresso = Math.min(1, Math.max(0, ((resumo.ondaAtual ?? -1) + 1) / total));
    base = Math.round(cheia * (0.12 + 0.23 * progresso));
  }

  // Refazer fase já vencida rende 30%: sem isso a fase 1 vira caixa eletrônico.
  if (!primeiraVez) base = Math.round(base * 0.3);

  // A semente que sobrou vira moeda a 5 por 1. O teto de 35% da recompensa
  // cheia existe para não transformar "não plantar" em estratégia — quem segura
  // semente para converter perde a fase antes de chegar ao caixa.
  const troco = Math.min(Math.floor((resumo.sobra || 0) / 5), Math.round(cheia * 0.35));

  return { base, troco, total: base + troco };
}
