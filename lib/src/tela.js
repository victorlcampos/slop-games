// Tela elástica: o canvas ocupa a janela inteira, em qualquer proporção.
//
// A altura lógica é fixa — é ela que define o tamanho de tudo que você desenha:
// personagem, fileira, fonte, botão. A **largura lógica** é que varia,
// acompanhando o formato da janela. Num ultrawide você enxerga mais mundo; num
// 4:3, menos. Ninguém vê barra preta e nada estica.
//
// De onde veio: a ideia de largura elástica é do Animais vs Monstros; o teto
// adaptativo de devicePixelRatio é do Zoo Magnata, que descobriu na marra que
// renderizar um traço cartoon em DPR 3 triplica a área de pintura sem ganho
// visível — e derruba o fps de celular.

const PADRAO = {
  altura: 720,
  larguraMin: 1040,
  larguraMax: 1900,
  // acima de 2 o ganho some num traço cartoon; em celular pequeno até 2 pesa
  tetoDPR: 2,
  tetoDPRCelular: 1.6,
  larguraCelular: 900,
};

export function criarTela(canvas, opcoes = {}) {
  const cfg = { ...PADRAO, ...opcoes };
  const ctx = canvas.getContext('2d', { alpha: opcoes.alpha !== false });

  // últimas medidas com que `ajustar` rodou; `preparar` compara para detectar
  // rotação que o evento não entregou a tempo
  let ultimaLargura = -1;
  let ultimaAltura = -1;
  let aoMudarLargura = null;

  const tela = {
    canvas,
    ctx,
    L: cfg.altura * (16 / 9),
    A: cfg.altura,
    escala: 1,
    dpr: 1,
    toque: ehToque(),
    /** Prancheta de referência para telas de menu compostas em largura fixa. */
    moldura: opcoes.moldura || 1280,
  };

  /** Quanto a prancheta anda para a direita quando a tela é mais larga. */
  tela.margem = () => Math.max(0, (tela.L - tela.moldura) / 2);
  /** Largura útil de uma tela de menu (nunca maior que a prancheta). */
  tela.larguraMenu = () => Math.min(tela.L, tela.moldura);

  /**
   * Recalcula tudo a partir do tamanho atual da janela.
   * Devolve true se a **largura lógica mudou** — quem cacheia cenário por
   * largura precisa saber disso para repintar.
   */
  tela.ajustar = () => {
    const larguraCSS = Math.max(1, window.innerWidth);
    const alturaCSS = Math.max(1, window.innerHeight);

    const teto = tela.toque && larguraCSS <= cfg.larguraCelular ? cfg.tetoDPRCelular : cfg.tetoDPR;
    const dpr = Math.min(window.devicePixelRatio || 1, teto);

    const antes = tela.L;
    tela.L = Math.round(
      Math.min(cfg.larguraMax, Math.max(cfg.larguraMin, (larguraCSS / alturaCSS) * cfg.altura))
    );
    tela.A = cfg.altura;
    tela.dpr = dpr;
    tela.toque = ehToque();
    tela.escala = alturaCSS / cfg.altura;

    canvas.width = Math.round(larguraCSS * dpr);
    canvas.height = Math.round(alturaCSS * dpr);
    canvas.style.width = larguraCSS + 'px';
    canvas.style.height = alturaCSS + 'px';

    ultimaLargura = larguraCSS;
    ultimaAltura = alturaCSS;
    return tela.L !== antes;
  };

  /**
   * Prepara o contexto do quadro. Depois disto, desenhe em coordenadas lógicas.
   *
   * Antes de desenhar, confere se a janela mudou de tamanho sem ter avisado.
   * Não é paranoia: girar o celular dispara `resize` e `orientationchange`, mas
   * em vários navegadores móveis o evento chega **antes** de `innerWidth` e
   * `innerHeight` valerem o valor novo — e um ajuste feito com as medidas
   * velhas deixa a escala errada.
   *
   * Como é a escala que converte toque em coordenada de jogo, o sintoma disso
   * não é tela torta: é **o jogo parar de responder ao dedo** depois de girar,
   * funcionando normalmente para quem já abriu na posição certa. Duas
   * comparações por quadro resolvem sem depender de evento nenhum chegar na
   * hora certa.
   */
  tela.preparar = () => {
    if (window.innerWidth !== ultimaLargura || window.innerHeight !== ultimaAltura) {
      const mudouLargura = tela.ajustar();
      if (mudouLargura && aoMudarLargura) aoMudarLargura(tela);
    }
    const k = tela.escala * tela.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, tela.L, tela.A);
  };

  /** Converte um ponto de evento (clientX/clientY) para coordenada lógica. */
  tela.ponto = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / tela.escala, y: (clientY - r.top) / tela.escala };
  };

  /**
   * Liga o redimensionamento automático. `aoMudarLargura` só dispara quando a
   * largura lógica muda de verdade — `orientationchange` no celular chega antes
   * de o tamanho novo valer, daí o atraso.
   */
  tela.observar = (aoMudar) => {
    aoMudarLargura = aoMudar;
    const responder = () => {
      if (tela.ajustar() && aoMudarLargura) aoMudarLargura(tela);
    };
    window.addEventListener('resize', responder);
    window.addEventListener('orientationchange', () => setTimeout(responder, 250));
    return () => {
      window.removeEventListener('resize', responder);
      aoMudarLargura = null;
    };
  };

  tela.ajustar();
  return tela;
}

export function ehToque() {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
}

/**
 * Cálculo puro por trás de `ajustar`, exposto para teste sem navegador.
 * Devolve a largura lógica e o dpr efetivo.
 */
export function medir(larguraCSS, alturaCSS, dprBruto, toque, opcoes = {}) {
  const cfg = { ...PADRAO, ...opcoes };
  const teto = toque && larguraCSS <= cfg.larguraCelular ? cfg.tetoDPRCelular : cfg.tetoDPR;
  return {
    L: Math.round(Math.min(cfg.larguraMax, Math.max(cfg.larguraMin, (larguraCSS / alturaCSS) * cfg.altura))),
    A: cfg.altura,
    dpr: Math.min(dprBruto || 1, teto),
    escala: alturaCSS / cfg.altura,
  };
}
