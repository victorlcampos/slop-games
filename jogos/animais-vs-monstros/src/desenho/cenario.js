// Os fundos das fases. Cada bioma é uma função que pinta o mundo atrás do
// tabuleiro; o campo em si (as faixas das fileiras) vem por cima, em batalha.js.
//
// Regra que vale para todos: o horizonte fica no alto (HZ ≈ 30% da altura) e o
// resto é chão liso. Cenário grande no meio do campo fica bonito na galeria e
// atrapalha o jogo — a leitura do tabuleiro vem antes da paisagem. Por isso os
// elementos são pequenos, ancorados no horizonte, e o chão só tem textura fraca.
//
// O fundo inteiro é caro de desenhar, então cada um é pintado uma vez num
// canvas fora da tela e reaproveitado.

import { forma, elipse, circulo, linha, traco, pontosElipse, sprite, rng, papel } from '../rabisco.js';
import { TINTA, CORES, tom, alfa } from '../paleta.js';
import { CONTORNO } from './comum.js';

const P = CONTORNO;
// O horizonte fica bem no alto: o campo tem 5 fileiras e todas precisam cair
// sobre o chão. Com o horizonte no meio, as duas de cima ficariam "no céu".
const HORIZONTE = 0.16;

function ceu(ctx, w, h, cores) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  cores.forEach((c, i) => g.addColorStop(i / (cores.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function morros(ctx, w, yBase, cor, s, altura, quantidade = 5) {
  const r = rng(s);
  for (let i = 0; i < quantidade; i++) {
    const cx = (i / (quantidade - 1)) * w + (r() - 0.5) * 90;
    forma(ctx, pontosElipse(cx, yBase, 150 + r() * 140, altura * (0.6 + r() * 0.7), 12), {
      cor: tom(cor, -0.25), largura: 2.4, preenche: cor, semente: s + i * 13,
    });
  }
}

function arvore(ctx, x, yBase, altura, corCopa, s, corTronco = '#6b4a2f') {
  const lt = altura * 0.11;
  forma(ctx, [[x - lt, yBase], [x - lt * 0.6, yBase - altura * 0.55], [x + lt * 0.6, yBase - altura * 0.55], [x + lt, yBase]], {
    ...P, largura: 2, preenche: corTronco, semente: s,
  });
  const r = rng(s + 7);
  for (let i = 0; i < 4; i++) {
    circulo(ctx, x + (r() - 0.5) * altura * 0.42, yBase - altura * (0.62 + r() * 0.3), altura * (0.2 + r() * 0.16), {
      cor: tom(corCopa, -0.3), largura: 2.2, preenche: i % 2 ? corCopa : tom(corCopa, -0.1), semente: s + i * 9,
    });
  }
}

function palmeira(ctx, x, yBase, altura, s, corFolha = '#5d8a3f') {
  traco(ctx, [[x, yBase], [x - altura * 0.08, yBase - altura * 0.55], [x + altura * 0.04, yBase - altura]], {
    cor: '#8a6a44', largura: Math.max(3, altura * 0.075), semente: s,
  });
  const topo = [x + altura * 0.04, yBase - altura];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const cx = topo[0] + Math.cos(a) * altura * 0.36;
    const cy = topo[1] + Math.sin(a) * altura * 0.2 + altura * 0.08;
    forma(ctx, [[topo[0], topo[1]], [(topo[0] + cx) / 2, (topo[1] + cy) / 2 - altura * 0.1], [cx, cy], [(topo[0] + cx) / 2, (topo[1] + cy) / 2 + altura * 0.04]], {
      cor: tom(corFolha, -0.3), largura: 1.8, preenche: i % 2 ? corFolha : tom(corFolha, -0.12), semente: s + i * 11,
    });
  }
}

function cacto(ctx, x, yBase, altura, s) {
  const cor = '#5f7a44';
  const larg = altura * 0.13;
  forma(ctx, [[x - larg, yBase], [x - larg, yBase - altura], [x + larg, yBase - altura], [x + larg, yBase]], {
    ...P, largura: 2.2, preenche: cor, semente: s,
  });
  for (const lado of [-1, 1]) {
    const y = yBase - altura * (0.5 + (lado > 0 ? 0.16 : 0));
    forma(ctx, [
      [x + lado * larg, y], [x + lado * larg * 3.2, y], [x + lado * larg * 3.2, y - altura * 0.3],
      [x + lado * larg * 1.9, y - altura * 0.3], [x + lado * larg * 1.9, y - altura * 0.05], [x + lado * larg, y - altura * 0.05],
    ], { ...P, largura: 2, preenche: tom(cor, -0.08), semente: s + lado * 5 });
  }
}

function predio(ctx, x, yBase, largura, altura, s, acesas = false) {
  const cor = ['#8f8b84', '#a09489', '#7d7a75'][Math.abs(s) % 3];
  forma(ctx, [[x, yBase], [x, yBase - altura], [x + largura, yBase - altura], [x + largura, yBase]], {
    ...P, largura: 2.2, preenche: cor, semente: s,
  });
  const r = rng(s + 3);
  const cols = Math.max(2, Math.floor(largura / 24));
  const linhas = Math.max(2, Math.floor(altura / 26));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < linhas; j++) {
      const jx = x + 7 + i * ((largura - 12) / cols);
      const jy = yBase - altura + 10 + j * ((altura - 16) / linhas);
      const luz = acesas && r() < 0.4;
      forma(ctx, [[jx, jy], [jx + 8, jy], [jx + 8, jy + 11], [jx, jy + 11]], {
        cor: tom(cor, -0.35), largura: 1.3, preenche: luz ? '#f2c94c' : tom(cor, -0.22), semente: s + i * 7 + j,
      });
    }
  }
}

/** Capim rasteiro — usado com alfa baixo, só para o chão não ficar chapado. */
function moita(ctx, x, y, largura, cor, s, escala = 1) {
  const r = rng(s);
  for (let i = 0; i < 5; i++) {
    const px = x + (r() - 0.5) * largura;
    const alt = (8 + r() * 14) * escala;
    traco(ctx, [[px, y], [px + (r() - 0.5) * 6, y - alt * 0.6], [px + (r() - 0.5) * 10, y - alt]], {
      cor, largura: 1.8, passadas: 1, semente: s + i * 3,
    });
  }
}

function nuvem(ctx, x, y, escala, s, cor = '#fbf7ee') {
  const r = rng(s);
  for (let i = 0; i < 4; i++) {
    circulo(ctx, x + i * 22 * escala - 30 * escala, y + (r() - 0.5) * 10 * escala, (14 + r() * 10) * escala, {
      cor: 'rgba(43,38,34,0.15)', largura: 1.8, preenche: cor, semente: s + i * 5,
    });
  }
}

/** Cerca branca de quintal, na linha do horizonte. */
function cercaBranca(ctx, w, y, altura, s) {
  const passo = altura * 0.62;
  for (let x = -passo; x < w + passo; x += passo) {
    forma(ctx, [
      [x, y], [x, y - altura * 0.78], [x + passo * 0.28, y - altura], [x + passo * 0.56, y - altura * 0.78], [x + passo * 0.56, y],
    ], { cor: '#8a8f7a', largura: 1.8, preenche: '#f4f1e4', semente: s + x });
  }
  // travessas
  for (const t of [0.34, 0.68]) {
    forma(ctx, [[-10, y - altura * t], [w + 10, y - altura * t], [w + 10, y - altura * t + altura * 0.14], [-10, y - altura * t + altura * 0.14]], {
      cor: '#8a8f7a', largura: 1.6, preenche: '#e8e4d4', semente: s + t * 100,
    });
  }
}

/** Textura fraca de chão, espalhada por toda a área jogável. */
function chao(ctx, w, h, hz, cor, corCapim, s, densidade = 30) {
  ctx.fillStyle = cor;
  ctx.fillRect(0, hz, w, h - hz);
  ctx.save();
  ctx.globalAlpha = 0.3;
  const r = rng(s);
  for (let i = 0; i < densidade; i++) {
    moita(ctx, r() * w, hz + 10 + r() * (h - hz - 10), 30, corCapim, s + i * 7, 0.85);
  }
  ctx.restore();
}

// ------------------------------------------------------------------- biomas

const biomas = {
  mata(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#6fc2e8', '#a3dcf0', '#d4eddc']);
    for (let i = 0; i < 4; i++) nuvem(ctx, 120 + i * 340, hz * 0.3 + (i % 2) * 26, 1, 100 + i);
    morros(ctx, w, hz, '#6aa347', 11, h * 0.1, 5);
    chao(ctx, w, h, hz, '#7cb342', '#4f8a2c', 200);
    for (let i = 0; i < 7; i++) arvore(ctx, 40 + i * (w / 6.5), hz + 6, h * (0.15 + (i % 3) * 0.025), '#4a8f32', 40 + i * 17);
    cercaBranca(ctx, w, hz + 4, h * 0.055, 210);
  },

  cerrado(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#dfd08a', '#ecdfa8', '#efe0b4']);
    for (let i = 0; i < 3; i++) nuvem(ctx, 200 + i * 420, hz * 0.28, 1.1, 150 + i, '#fdf8e8');
    morros(ctx, w, hz, '#b39a5c', 31, h * 0.08, 4);
    chao(ctx, w, h, hz, '#c2a866', '#a89552', 300, 36);
    for (let i = 0; i < 6; i++) {
      const x = 70 + i * (w / 5.5);
      const alt = h * 0.14;
      traco(ctx, [[x, hz + 4], [x + 10, hz + 4 - alt * 0.4], [x - 6, hz + 4 - alt * 0.72], [x + 4, hz + 4 - alt]], {
        cor: '#6b5232', largura: 6, semente: 60 + i,
      });
      for (let j = 0; j < 3; j++) {
        circulo(ctx, x + (j - 1) * alt * 0.24, hz + 4 - alt * 1.06 - (j % 2) * alt * 0.12, alt * 0.2, {
          cor: '#5a6b34', largura: 2, preenche: '#78894a', semente: 70 + i * 4 + j,
        });
      }
    }
  },

  pantanal(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#bcd9e6', '#dbe9dd', '#e2e6c8']);
    for (let i = 0; i < 4; i++) nuvem(ctx, 90 + i * 330, hz * 0.3 + (i % 3) * 22, 1, 400 + i);
    morros(ctx, w, hz, '#8aa564', 41, h * 0.07, 4);
    chao(ctx, w, h, hz, '#93a862', '#6f8f46', 500, 32);
    // poças que não atrapalham a leitura das fileiras
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      forma(ctx, pontosElipse(120 + i * (w / 4.6), hz + 30 + (i % 2) * 40, 90, 20, 12), {
        cor: CORES.aguaEscura, largura: 1.8, preenche: alfa(CORES.agua, 0.6), semente: 50 + i,
      });
    }
    ctx.restore();
    for (let i = 0; i < 5; i++) palmeira(ctx, 60 + i * (w / 4.5), hz + 8, h * 0.16, 80 + i * 9, '#4f7a3a');
  },

  caatinga(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#f2e2c0', '#f7ecd2', '#f2e4c4']);
    circulo(ctx, w * 0.8, hz * 0.36, 36, { cor: '#e8c76a', largura: 2.6, preenche: '#f7e9a8', semente: 9 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      linha(ctx, w * 0.8 + Math.cos(a) * 44, hz * 0.36 + Math.sin(a) * 44, w * 0.8 + Math.cos(a) * 58, hz * 0.36 + Math.sin(a) * 58, {
        cor: '#e8c76a', largura: 2.4, passadas: 1, semente: 20 + i,
      });
    }
    morros(ctx, w, hz, '#c69a6c', 61, h * 0.07, 4);
    chao(ctx, w, h, hz, '#d4a97a', '#b58a5c', 600, 18);
    // chão rachado, de leve
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 20; i++) {
      const x = (i * 137) % w;
      const y = hz + 30 + (i % 7) * ((h - hz) / 7);
      traco(ctx, [[x, y], [x + 40, y + 10], [x + 70, y + 3]], { cor: '#a87d52', largura: 1.8, passadas: 1, semente: 610 + i });
    }
    ctx.restore();
    for (let i = 0; i < 5; i++) cacto(ctx, 80 + i * (w / 4.6), hz + 8, h * (0.11 + (i % 3) * 0.02), 90 + i * 7);
  },

  amazonia(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#7fa88e', '#9dbf9a', '#aec7a0']);
    morros(ctx, w, hz, '#3f6b3f', 71, h * 0.09, 5);
    chao(ctx, w, h, hz, '#537a44', '#3f6b38', 950, 34);
    // mata em três camadas, comprimida junto ao horizonte
    for (let camada = 0; camada < 3; camada++) {
      const y = hz + camada * 10;
      const cor = ['#3d6136', '#48713d', '#557f45'][camada];
      for (let i = 0; i < 9 - camada; i++) {
        arvore(ctx, 20 + i * (w / (8 - camada)) + camada * 40, y, h * (0.17 - camada * 0.025), cor, 800 + camada * 20 + i);
      }
    }
    // cipós descendo do topo
    for (let i = 0; i < 8; i++) {
      const x = (i * 167) % w;
      traco(ctx, [[x, 0], [x + 12, hz * 0.35], [x - 6, hz * 0.7]], { cor: '#3f5f38', largura: 2.4, alfa: 0.75, semente: 900 + i });
    }
  },

  praia(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#1e2a4a', '#37456b', '#55617e']);
    circulo(ctx, w * 0.84, hz * 0.34, 26, { cor: '#d9cfa8', largura: 2.2, preenche: '#f2ead0', semente: 3 });
    circulo(ctx, w * 0.87, hz * 0.29, 21, { cor: null, preenche: '#37456b', semente: 4 });
    const r = rng(1234);
    for (let i = 0; i < 50; i++) {
      circulo(ctx, r() * w, r() * hz * 0.85, r() * 1.6 + 0.6, { cor: null, preenche: alfa('#f2ead0', 0.4 + r() * 0.5), semente: 1000 + i });
    }
    // faixa de mar logo abaixo do horizonte
    ctx.fillStyle = '#2f4f66';
    ctx.fillRect(0, hz, w, h * 0.07);
    for (let i = 0; i < 14; i++) {
      traco(ctx, [[i * (w / 13) - 20, hz + 12 + (i % 3) * 8], [i * (w / 13) + 30, hz + 16 + (i % 3) * 8], [i * (w / 13) + 70, hz + 12 + (i % 3) * 8]], {
        cor: alfa('#9fc4d4', 0.55), largura: 1.8, passadas: 1, semente: 1100 + i,
      });
    }
    chao(ctx, w, h, hz + h * 0.07, '#c9b48c', '#a89268', 1150, 14);
    for (let i = 0; i < 5; i++) palmeira(ctx, 70 + i * (w / 4.4), hz + h * 0.08, h * 0.16, 1200 + i * 11, '#3f5f38');
  },

  cidade(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#8e97a6', '#a8adb4', '#bab5aa']);
    for (let i = 0; i < 3; i++) nuvem(ctx, 160 + i * 400, hz * 0.26, 1.2, 1300 + i, '#d6d2c8');
    let x = -20;
    let i = 0;
    while (x < w) {
      const lg = 56 + ((i * 37) % 46);
      predio(ctx, x, hz + 4, lg, h * (0.1 + ((i * 53) % 100) / 900), 1400 + i);
      x += lg + 6;
      i++;
    }
    // asfalto
    ctx.fillStyle = '#5f5c58';
    ctx.fillRect(0, hz, w, h - hz);
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let j = 0; j < 16; j++) {
      forma(ctx, [[j * (w / 15), hz + 14], [j * (w / 15) + 40, hz + 14], [j * (w / 15) + 40, hz + 20], [j * (w / 15), hz + 20]], {
        cor: null, preenche: '#d9cfa8', semente: 1500 + j,
      });
    }
    // manchas de óleo
    const r = rng(1550);
    for (let k = 0; k < 14; k++) {
      elipse(ctx, r() * w, hz + 30 + r() * (h - hz - 40), 20 + r() * 30, 8 + r() * 10, {
        cor: null, preenche: '#4a4744', semente: 1560 + k,
      });
    }
    ctx.restore();
  },

  serra(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#93a6b5', '#b4c0c4', '#c4c9bc']);
    for (let camada = 0; camada < 3; camada++) {
      const base = hz - camada * 4;
      const alturaPico = h * (0.17 - camada * 0.04);
      const cor = ['#5d6b74', '#6e7b80', '#7f8a86'][camada];
      const pontos = [[-20, base]];
      for (let i = 0; i <= 7; i++) {
        pontos.push([i * (w / 7) - 40 + camada * 30, base - alturaPico * (0.5 + ((i * 7 + camada) % 5) / 6)]);
        pontos.push([i * (w / 7) + w / 14 - 40 + camada * 30, base - alturaPico * 0.12]);
      }
      pontos.push([w + 20, base], [w + 20, base + 30], [-20, base + 30]);
      forma(ctx, pontos, { cor: tom(cor, -0.3), largura: 2.2, preenche: cor, semente: 1700 + camada });
    }
    chao(ctx, w, h, hz, '#6b7a55', '#5c6b46', 1900, 30);
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * (w / 5.5);
      const alt = h * 0.15;
      linha(ctx, x, hz + 6, x, hz + 6 - alt, { cor: '#5c4633', largura: 5, semente: 1800 + i });
      for (let j = 0; j < 5; j++) {
        const yy = hz + 6 - alt * 0.31 - j * alt * 0.185;
        const meia = alt * (0.35 - j * 0.03);
        forma(ctx, [[x - meia, yy], [x, yy - alt * 0.17], [x + meia, yy]], {
          cor: '#33502f', largura: 2, preenche: '#3f6138', semente: 1810 + i * 6 + j,
        });
      }
    }
  },

  cristo(ctx, w, h) {
    const hz = h * HORIZONTE;
    ceu(ctx, w, hz, ['#241d38', '#4a3355', '#6b4453']);
    const r = rng(77);
    for (let i = 0; i < 60; i++) {
      circulo(ctx, r() * w, r() * hz * 0.9, r() * 1.6 + 0.6, { cor: null, preenche: alfa('#f2ead0', 0.35 + r() * 0.5), semente: 2000 + i });
    }
    morros(ctx, w, hz, '#3a3149', 2110, h * 0.08, 5);
    // Pão de Açúcar
    forma(ctx, [[w * 0.08, hz], [w * 0.14, hz - h * 0.16], [w * 0.2, hz]], {
      cor: '#2f2740', largura: 2.4, preenche: '#3d3350', semente: 2100,
    });

    // o Cristo, no alto à direita, acima da linha dos prédios.
    // `e` é a unidade do desenho: a estátua toda tem ~122 unidades de altura,
    // e queremos que ela ocupe metade da faixa de céu.
    const cx = w * 0.76;
    const base = hz - 4;
    const e = (hz * 0.62) / 122;
    const g = ctx.createRadialGradient(cx, base, 6, cx, base - 60 * e, 130 * e);
    g.addColorStop(0, 'rgba(242, 201, 76, 0.32)');
    g.addColorStop(1, 'rgba(242, 201, 76, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 150 * e, base - 190 * e, 300 * e, 210 * e);
    forma(ctx, [[cx - 38 * e, base], [cx - 28 * e, base - 30 * e], [cx + 28 * e, base - 30 * e], [cx + 38 * e, base]], { cor: '#2b2438', largura: 2, preenche: '#4f4560', semente: 2300 });
    forma(ctx, [[cx - 17 * e, base - 30 * e], [cx - 13 * e, base - 110 * e], [cx + 13 * e, base - 110 * e], [cx + 17 * e, base - 30 * e]], { cor: '#2b2438', largura: 2, preenche: '#9a90ac', semente: 2310 });
    forma(ctx, [[cx - 72 * e, base - 106 * e], [cx + 72 * e, base - 106 * e], [cx + 72 * e, base - 94 * e], [cx - 72 * e, base - 94 * e]], { cor: '#2b2438', largura: 2, preenche: '#9a90ac', semente: 2320 });
    circulo(ctx, cx, base - 122 * e, 11 * e, { cor: '#2b2438', largura: 2, preenche: '#9a90ac', semente: 2330 });

    // cidade acesa na faixa logo abaixo do horizonte
    let x = -10;
    let i = 0;
    while (x < w) {
      const lg = 24 + ((i * 29) % 26);
      predio(ctx, x, hz + h * 0.05, lg, h * (0.03 + ((i * 41) % 60) / 1400), 2200 + i, true);
      x += lg + 4;
      i++;
    }
    chao(ctx, w, h, hz + h * 0.05, '#3a3a44', '#4a4a54', 2400, 16);
  },
};

/** Fundo da fase, cacheado. */
export function fundoDaFase(nome, largura, altura) {
  return sprite(`cenario:${nome}:${largura}x${altura}`, largura, altura, (ctx, w, h) => {
    const pintar = biomas[nome] || biomas.mata;
    pintar(ctx, w, h);
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.globalCompositeOperation = 'multiply';
    papel(ctx, w, h, { semente: 5 });
    ctx.restore();
  });
}

export const BIOMAS = Object.keys(biomas);
