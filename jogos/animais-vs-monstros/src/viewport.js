// A tela do jogo — hoje só um adaptador fino sobre o slopkit.
//
// A largura elástica nasceu aqui e virou `slopkit/tela`; o teto adaptativo de
// devicePixelRatio veio de volta do Zoo Magnata junto. Este arquivo continua
// existindo porque o resto do jogo importa `vp`, `margem()` e `ALTURA` — trocar
// isso em vinte lugares não pagaria o barulho.

import { criarTela } from 'slopkit/tela';

export const ALTURA = 720;
export const MOLDURA = 1280;

/** Objeto estável: o resto do jogo guarda a referência e lê os campos. */
export const vp = { L: 1280, A: ALTURA, escala: 1, dpr: 1, toque: false };

let kit = null;

export function ajustar(canvas) {
  if (!kit) kit = criarTela(canvas, { altura: ALTURA, moldura: MOLDURA });
  const mudouLargura = kit.ajustar();
  vp.L = kit.L;
  vp.A = kit.A;
  vp.escala = kit.escala;
  vp.dpr = kit.dpr;
  vp.toque = kit.toque;
  return mudouLargura;
}

export function preparar(ctx) {
  kit.preparar();
  // o kit pode ter reajustado sozinho ao detectar rotação; reflete aqui
  vp.L = kit.L;
  vp.escala = kit.escala;
  vp.dpr = kit.dpr;
  vp.toque = kit.toque;
}

/**
 * Avisa quando a largura lógica muda — inclusive quando quem detecta é o
 * `preparar` do kit, e não o evento de resize.
 */
export function observar(aoMudar) {
  return kit.observar(() => {
    vp.L = kit.L;
    vp.escala = kit.escala;
    vp.dpr = kit.dpr;
    vp.toque = kit.toque;
    aoMudar();
  });
}

export function pontoLogico(canvas, clientX, clientY) {
  return kit.ponto(clientX, clientY);
}

// As telas de menu foram compostas numa prancheta fixa de 1280x720. A batalha
// não usa isto — lá a largura extra é campo de verdade —, mas menu é diagrama:
// precisa caber inteiro.
//
// Tela mais larga que a prancheta: centraliza. Tela mais estreita (um 16:10 dá
// 1152 de largura lógica!): encolhe para caber. Antes disto o mapa-múndi
// simplesmente vazava pela borda direita em qualquer monitor que não fosse 16:9.

function fatorMoldura() {
  return Math.min(1, vp.L / MOLDURA);
}

/** Aplica a moldura no contexto. Devolve o fator, se você precisar dele. */
export function aplicarMoldura(ctx) {
  const k = fatorMoldura();
  ctx.translate((vp.L - MOLDURA * k) / 2, (ALTURA - ALTURA * k) / 2);
  ctx.scale(k, k);
  return k;
}

/** Converte ponto da tela para dentro da moldura — o inverso do de cima. */
export function pontoNaMoldura(x, y) {
  const k = fatorMoldura();
  return {
    x: (x - (vp.L - MOLDURA * k) / 2) / k,
    y: (y - (ALTURA - ALTURA * k) / 2) / k,
  };
}

/** Dentro da moldura a largura é sempre a mesma: é uma prancheta. */
export function larguraMenu() {
  return MOLDURA;
}

/** @deprecated use aplicarMoldura/pontoNaMoldura */
export function margem() {
  return Math.max(0, (vp.L - MOLDURA) / 2);
}

export { ehToque } from 'slopkit/tela';
