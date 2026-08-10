// O folclore brasileiro como inimigo. Todos olham para a esquerda, que é o
// lado para onde avançam. Espaço 128x128, chão em y=122.

import { forma, elipse, circulo, linha, traco, pontosElipse, sprite, volume } from '../rabisco.js';
import { TINTA, CORES, tom } from '../paleta.js';
import { CONTORNO, corpo, olho, olhoMau, orelhaPonta, orelhaRedonda, pata, cauda, penugem, dentes, chifre } from './comum.js';

const P = CONTORNO;

/** Chama desenhada — serve para Boitatá, Mula e a Cuca. */
function chama(ctx, x, y, altura, s, cor = CORES.fogo, corInterna = CORES.fogoClaro) {
  forma(ctx, [[x - altura * 0.3, y], [x - altura * 0.18, y - altura * 0.55], [x, y - altura], [x + altura * 0.2, y - altura * 0.5], [x + altura * 0.32, y]], {
    cor: tom(cor, -0.2), largura: 2, preenche: cor, semente: s,
  });
  forma(ctx, [[x - altura * 0.14, y], [x, y - altura * 0.55], [x + altura * 0.14, y]], {
    cor: null, preenche: corInterna, semente: s + 3,
  });
}

const desenhos = {
  // -------------------------------------------------------------- corpo-seco
  corposeco(ctx, s) {
    const pele = '#9a9382';
    // pernas tortas
    traco(ctx, [[72, 92], [66, 108], [56, 122]], { cor: TINTA, largura: 5, semente: s + 1 });
    traco(ctx, [[80, 92], [84, 108], [78, 122]], { cor: TINTA, largura: 5, semente: s + 2 });
    forma(ctx, [[62, 52], [88, 50], [92, 96], [60, 98]], { ...P, largura: 2.6, preenche: pele, semente: s + 3 });
    // costelas à mostra
    for (let i = 0; i < 4; i++) {
      traco(ctx, [[64, 62 + i * 8], [76, 66 + i * 8], [88, 62 + i * 8]], { cor: tom(pele, -0.35), largura: 1.8, passadas: 1, semente: s + 10 + i });
    }
    traco(ctx, [[62, 60], [44, 74], [38, 92]], { cor: TINTA, largura: 4.5, semente: s + 4 });
    traco(ctx, [[88, 60], [100, 76], [96, 92]], { cor: TINTA, largura: 4.5, semente: s + 5 });
    corpo(ctx, 74, 38, 20, 21, pele, s + 6);
    // olhos afundados
    circulo(ctx, 64, 34, 7, { cor: null, preenche: '#2b2622', semente: s + 7 });
    circulo(ctx, 82, 34, 7, { cor: null, preenche: '#2b2622', semente: s + 8 });
    circulo(ctx, 64, 34, 2.5, { cor: null, preenche: '#c1503f', semente: s + 9 });
    circulo(ctx, 82, 34, 2.5, { cor: null, preenche: '#c1503f', semente: s + 10 });
    traco(ctx, [[64, 48], [74, 52], [84, 48]], { cor: TINTA, largura: 2.2, semente: s + 11 });
    for (let i = 0; i < 4; i++) linha(ctx, 66 + i * 5, 48, 66 + i * 5, 53, { cor: TINTA, largura: 1.4, passadas: 1, semente: s + 20 + i });
  },

  // --------------------------------------------------------------------- saci
  saci(ctx, s) {
    // redemoinho na base
    for (let i = 0; i < 3; i++) {
      const r = 26 - i * 6;
      forma(ctx, pontosElipse(70, 116 - i * 6, r, r * 0.32, 10), {
        cor: '#b0a894', largura: 2, preenche: null, alfa: 0.7, semente: s + i * 4,
      });
    }
    // perna única
    traco(ctx, [[70, 84], [68, 104], [70, 116]], { cor: '#4a3b30', largura: 7, semente: s + 1 });
    forma(ctx, [[58, 46], [86, 44], [90, 88], [56, 90]], { ...P, largura: 2.6, preenche: '#c1503f', semente: s + 2 });
    traco(ctx, [[58, 54], [40, 66], [36, 84]], { cor: '#4a3b30', largura: 5, semente: s + 3 });
    traco(ctx, [[88, 54], [102, 62], [104, 74]], { cor: '#4a3b30', largura: 5, semente: s + 4 });
    corpo(ctx, 72, 34, 19, 19, '#4a3b30', s + 5);
    // gorro
    forma(ctx, [[52, 24], [92, 22], [76, 2], [62, 6]], { cor: TINTA, largura: 2.4, preenche: '#c1503f', semente: s + 6 });
    circulo(ctx, 76, 2, 5, { cor: TINTA, largura: 2, preenche: '#e07a5f', semente: s + 7 });
    olhoMau(ctx, 64, 34, 5, s + 8, '#f2c94c');
    olhoMau(ctx, 80, 34, 5, s + 9, '#f2c94c');
    traco(ctx, [[64, 44], [72, 47], [80, 43]], { cor: TINTA, largura: 2, semente: s + 10 });
    // cachimbo
    linha(ctx, 62, 44, 46, 50, { cor: '#5c4633', largura: 4, semente: s + 11 });
    circulo(ctx, 44, 52, 5, { cor: TINTA, largura: 2, preenche: '#3f3128', semente: s + 12 });
    for (let i = 0; i < 2; i++) circulo(ctx, 40 - i * 6, 44 - i * 6, 3 + i, { cor: null, preenche: 'rgba(200,195,180,0.5)', semente: s + 30 + i });
  },

  // ----------------------------------------------------------------- curupira
  curupira(ctx, s) {
    const pele = '#b5793f';
    // os pés virados para trás — o detalhe que define a lenda
    forma(ctx, [[64, 116], [64, 124], [84, 124], [82, 116]], { ...P, largura: 2.2, preenche: pele, semente: s + 1 });
    forma(ctx, [[76, 112], [76, 120], [96, 120], [94, 112]], { ...P, largura: 2.2, preenche: pele, semente: s + 2 });
    traco(ctx, [[68, 88], [66, 104], [68, 116]], { cor: pele, largura: 7, semente: s + 3 });
    traco(ctx, [[80, 88], [82, 102], [80, 112]], { cor: pele, largura: 7, semente: s + 4 });
    forma(ctx, [[60, 50], [88, 48], [92, 92], [58, 94]], { ...P, largura: 2.6, preenche: pele, semente: s + 5 });
    traco(ctx, [[60, 58], [42, 68], [38, 86]], { cor: pele, largura: 5.5, semente: s + 6 });
    traco(ctx, [[90, 58], [104, 66], [106, 80]], { cor: pele, largura: 5.5, semente: s + 7 });
    corpo(ctx, 72, 36, 20, 20, pele, s + 8);
    // cabeleira de fogo
    for (let i = 0; i < 7; i++) {
      chama(ctx, 54 + i * 7, 24, 20 + (i % 3) * 8, s + 20 + i);
    }
    olhoMau(ctx, 64, 36, 5.5, s + 9, '#7fa85c');
    olhoMau(ctx, 80, 36, 5.5, s + 10, '#7fa85c');
    traco(ctx, [[64, 46], [72, 50], [80, 46]], { cor: TINTA, largura: 2, semente: s + 11 });
    dentes(ctx, 64, 46, 80, 5, s + 12);
  },

  // ------------------------------------------------------------ cabeça de cuia
  cabecadecuia(ctx, s) {
    const pele = '#8a9b7c';
    traco(ctx, [[66, 100], [60, 112], [52, 122]], { cor: TINTA, largura: 5, semente: s + 1 });
    traco(ctx, [[78, 100], [82, 112], [76, 122]], { cor: TINTA, largura: 5, semente: s + 2 });
    forma(ctx, [[62, 70], [84, 68], [88, 104], [60, 106]], { ...P, largura: 2.4, preenche: pele, semente: s + 3 });
    traco(ctx, [[62, 76], [44, 88], [40, 104]], { cor: TINTA, largura: 4, semente: s + 4 });
    traco(ctx, [[86, 76], [100, 86], [98, 100]], { cor: TINTA, largura: 4, semente: s + 5 });
    // a cabeça enorme, que é o nome dele
    circulo(ctx, 72, 40, 34, { ...P, largura: 3, preenche: '#c9a86a', semente: s + 6 });
    forma(ctx, pontosElipse(72, 40, 34, 34, 16), { cor: tom('#c9a86a', -0.3), largura: 1.6, preenche: null, semente: s + 7 });
    linha(ctx, 40, 34, 104, 32, { cor: tom('#c9a86a', -0.35), largura: 2, passadas: 1, semente: s + 8 });
    olhoMau(ctx, 58, 36, 7, s + 9, '#e0913a');
    olhoMau(ctx, 84, 34, 7, s + 10, '#e0913a');
    forma(ctx, [[52, 56], [92, 54], [86, 68], [58, 68]], { cor: TINTA, largura: 2.2, preenche: '#3f3128', semente: s + 11 });
    dentes(ctx, 54, 57, 88, 7, s + 12);
  },

  // ---------------------------------------------------------- mula sem cabeça
  mula(ctx, s) {
    const cor = '#4a4038';
    // patas com ferradura em brasa
    for (const [x, atraso] of [[46, 0], [62, 1], [88, 2], [104, 3]]) {
      traco(ctx, [[x, 82], [x - 2, 102], [x, 118]], { cor: TINTA, largura: 6, semente: s + atraso });
      forma(ctx, [[x - 8, 118], [x + 8, 118], [x + 6, 124], [x - 6, 124]], { cor: TINTA, largura: 2, preenche: CORES.fogo, semente: s + 10 + atraso });
    }
    corpo(ctx, 74, 70, 40, 26, cor, s + 4);
    penugem(ctx, 74, 70, 40, 26, '#2f2822', s + 5, 12, 5);
    // cauda
    cauda(ctx, [[112, 60], [124, 70], [120, 90]], 9, '#2f2822', s + 6);
    // pescoço cortado, com fogo saindo
    forma(ctx, [[42, 66], [58, 50], [46, 40], [32, 56]], { ...P, largura: 2.6, preenche: cor, semente: s + 7 });
    forma(ctx, pontosElipse(39, 48, 13, 9, 10), { cor: TINTA, largura: 2.2, preenche: '#7a2f22', semente: s + 8 });
    for (let i = 0; i < 4; i++) chama(ctx, 30 + i * 7, 46, 26 + (i % 2) * 10, s + 20 + i);
    // sela
    forma(ctx, [[62, 48], [88, 48], [86, 58], [64, 58]], { cor: TINTA, largura: 2, preenche: '#6b4a2f', semente: s + 9 });
  },

  // --------------------------------------------------------------------- iara
  iara(ctx, s) {
    // cauda de peixe
    forma(ctx, [[70, 84], [86, 100], [78, 118], [62, 116], [56, 98]], { ...P, largura: 2.4, preenche: '#4f8a92', semente: s + 1 });
    forma(ctx, [[62, 112], [40, 124], [52, 104]], { ...P, largura: 2.2, preenche: '#3d7791', semente: s + 2 });
    forma(ctx, [[74, 112], [96, 122], [84, 104]], { ...P, largura: 2.2, preenche: '#3d7791', semente: s + 3 });
    for (let i = 0; i < 4; i++) {
      traco(ctx, [[58, 90 + i * 7], [70, 94 + i * 7], [82, 90 + i * 7]], { cor: '#2f5f70', largura: 1.6, passadas: 1, semente: s + 10 + i });
    }
    corpo(ctx, 70, 62, 17, 24, '#c9a07a', s + 4);
    // cabelo longo
    forma(ctx, [[48, 30], [40, 70], [50, 96], [60, 70], [58, 34]], { ...P, largura: 2.2, preenche: '#3d5b3a', semente: s + 5 });
    forma(ctx, [[92, 30], [100, 68], [90, 94], [80, 68], [82, 34]], { ...P, largura: 2.2, preenche: '#3d5b3a', semente: s + 6 });
    corpo(ctx, 70, 32, 19, 20, '#c9a07a', s + 7);
    forma(ctx, [[50, 30], [70, 8], [90, 30], [70, 22]], { ...P, largura: 2.2, preenche: '#4a6b45', semente: s + 8 });
    olho(ctx, 62, 32, 6, s + 9, { olhar: [-0.5, 0], cor: '#cfe6e2' });
    olho(ctx, 78, 32, 6, s + 10, { olhar: [-0.5, 0], cor: '#cfe6e2' });
    traco(ctx, [[64, 44], [70, 41], [76, 44]], { cor: '#8a4a4a', largura: 2, semente: s + 11 });
    // notas do canto
    for (let i = 0; i < 2; i++) {
      const x = 32 - i * 10;
      const y = 44 - i * 14;
      circulo(ctx, x, y, 4, { cor: null, preenche: 'rgba(180, 210, 220, 0.75)', semente: s + 30 + i });
      linha(ctx, x + 3.5, y, x + 3.5, y - 11, { cor: 'rgba(180, 210, 220, 0.75)', largura: 2, passadas: 1, semente: s + 40 + i });
    }
  },

  // ------------------------------------------------------------------ boitatá
  boitata(ctx, s) {
    // corpo serpenteante em chamas
    const p = [[118, 108], [96, 96], [104, 76], [84, 62], [58, 66], [44, 52]];
    cauda(ctx, p, 20, CORES.fogo, s + 1);
    cauda(ctx, p, 11, CORES.fogoClaro, s + 2);
    for (let i = 0; i < p.length; i++) {
      chama(ctx, p[i][0], p[i][1] - 8, 20, s + 10 + i, '#e8703a', '#f7d451');
    }
    corpo(ctx, 40, 44, 20, 16, '#c1503f', s + 3);
    forma(ctx, [[22, 42], [40, 36], [40, 52]], { ...P, largura: 2.2, preenche: '#c1503f', semente: s + 4 });
    olhoMau(ctx, 34, 40, 6, s + 5, '#f7d451');
    olhoMau(ctx, 46, 38, 5, s + 6, '#f7d451');
    traco(ctx, [[22, 44], [10, 40]], { cor: '#f7d451', largura: 2, semente: s + 7 });
    traco(ctx, [[10, 40], [2, 36]], { cor: '#f7d451', largura: 1.8, semente: s + 8 });
    traco(ctx, [[10, 40], [2, 44]], { cor: '#f7d451', largura: 1.8, semente: s + 9 });
  },

  // ---------------------------------------------------------------- lobisomem
  lobisomem(ctx, s) {
    const cor = '#544a42';
    traco(ctx, [[62, 96], [56, 112], [46, 124]], { cor, largura: 9, semente: s + 1 });
    traco(ctx, [[86, 96], [90, 112], [82, 124]], { cor, largura: 9, semente: s + 2 });
    forma(ctx, [[56, 48], [92, 46], [96, 100], [54, 102]], { ...P, largura: 2.8, preenche: cor, semente: s + 3 });
    forma(ctx, pontosElipse(76, 78, 18, 20, 12), { cor: null, preenche: '#7d6f62', semente: s + 4 });
    penugem(ctx, 74, 72, 20, 28, '#3f3830', s + 5, 12, 7);
    // braços com garras
    traco(ctx, [[56, 56], [34, 72], [26, 92]], { cor, largura: 8, semente: s + 6 });
    for (let i = 0; i < 3; i++) traco(ctx, [[26, 92], [18 - i * 3, 102 + i * 3]], { cor: '#e8dcc4', largura: 2.6, semente: s + 20 + i });
    traco(ctx, [[94, 56], [110, 70], [108, 88]], { cor, largura: 8, semente: s + 7 });
    // cabeça de perfil: o focinho é uma cunha que sai do rosto, apontando para
    // baixo e para a esquerda — desenhado antes do crânio, para não cobri-lo
    forma(ctx, [[66, 32], [30, 44], [32, 56], [70, 52]], { ...P, largura: 2.4, preenche: tom(cor, -0.12), semente: s + 11 });
    dentes(ctx, 34, 47, 64, 6, s + 12);
    circulo(ctx, 32, 45, 5, { cor: null, preenche: TINTA, semente: s + 13 });
    traco(ctx, [[38, 38], [56, 34]], { cor: tom(cor, -0.3), largura: 2, passadas: 1, semente: s + 14 });
    corpo(ctx, 78, 32, 23, 22, cor, s + 8);
    orelhaPonta(ctx, 68, 12, 17, cor, s + 9, -0.4);
    orelhaPonta(ctx, 92, 12, 17, cor, s + 10, 0.2);
    olhoMau(ctx, 68, 30, 6, s + 15, '#f2c94c');
    olhoMau(ctx, 86, 30, 6, s + 16, '#f2c94c');
  },

  // --------------------------------------------------------------- mapinguari
  mapinguari(ctx, s) {
    const cor = '#7a5c3a';
    traco(ctx, [[56, 100], [50, 114], [44, 124]], { cor, largura: 12, semente: s + 1 });
    traco(ctx, [[90, 100], [96, 114], [92, 124]], { cor, largura: 12, semente: s + 2 });
    corpo(ctx, 72, 70, 42, 44, cor, s + 3);
    penugem(ctx, 72, 70, 42, 44, '#5c4326', s + 4, 22, 9);
    traco(ctx, [[36, 60], [20, 80], [22, 100]], { cor, largura: 10, semente: s + 5 });
    for (let i = 0; i < 3; i++) traco(ctx, [[22, 100], [14 - i * 3, 110 + i * 3]], { cor: '#e8dcc4', largura: 2.6, semente: s + 20 + i });
    traco(ctx, [[108, 60], [122, 78], [120, 96]], { cor, largura: 10, semente: s + 6 });
    // a boca na barriga
    forma(ctx, pontosElipse(72, 84, 24, 15, 12), { cor: TINTA, largura: 2.6, preenche: '#3f2a1c', semente: s + 7 });
    dentes(ctx, 52, 76, 92, 9, s + 8);
    dentes(ctx, 52, 92, 92, 9, s + 9, false);
    // cabeça pequena com um olho só
    corpo(ctx, 72, 34, 21, 19, cor, s + 10);
    olhoMau(ctx, 72, 32, 10, s + 11, '#c1503f');
    traco(ctx, [[60, 44], [72, 48], [84, 44]], { cor: TINTA, largura: 2.2, semente: s + 12 });
    // fedor
    for (let i = 0; i < 3; i++) {
      traco(ctx, [[104, 40 - i * 9], [112, 32 - i * 9], [104, 24 - i * 9]], { cor: '#8a9b5c', largura: 2, passadas: 1, alfa: 0.55, semente: s + 30 + i });
    }
  },

  // -------------------------------------------------------------- bicho-papão
  bichopapao(ctx, s) {
    // massa escura sem forma fixa
    forma(ctx, [[20, 118], [12, 76], [30, 40], [64, 22], [100, 34], [118, 70], [112, 118]], {
      cor: '#211c26', largura: 3.4, preenche: '#3d3145', semente: s + 1,
    });
    forma(ctx, [[28, 116], [22, 82], [40, 52], [66, 38], [96, 50], [108, 84], [104, 116]], {
      cor: null, preenche: '#4a3b56', semente: s + 2,
    });
    // muitos olhos, tamanhos diferentes
    const olhos = [[46, 60, 9], [72, 52, 12], [96, 68, 7], [58, 84, 6], [86, 90, 8], [36, 88, 5], [70, 74, 5]];
    for (const [x, y, r] of olhos) olhoMau(ctx, x, y, r, s + x, '#f2c94c');
    // bocarra
    forma(ctx, [[36, 100], [96, 98], [86, 118], [46, 118]], { cor: TINTA, largura: 2.6, preenche: '#160f1c', semente: s + 3 });
    dentes(ctx, 38, 101, 94, 11, s + 4);
    dentes(ctx, 44, 117, 88, 10, s + 5, false);
    // fiapos de escuridão
    for (let i = 0; i < 5; i++) {
      traco(ctx, [[14 + i * 26, 24], [10 + i * 26, 10], [18 + i * 26, 4]], { cor: '#3d3145', largura: 3, alfa: 0.75, semente: s + 30 + i });
    }
  },

  // --------------------------------------------------------------------- cuca
  cuca(ctx, s) {
    const pele = '#9aa85c';
    // vestido
    forma(ctx, [[46, 124], [56, 70], [96, 68], [110, 124]], { ...P, largura: 3, preenche: '#6b4a6f', semente: s + 1 });
    for (let i = 0; i < 3; i++) traco(ctx, [[50 + i * 4, 110 - i * 14], [104 - i * 4, 108 - i * 14]], { cor: '#4f3552', largura: 2, passadas: 1, semente: s + 10 + i });
    // braços com unhas
    traco(ctx, [[56, 76], [30, 88], [22, 106]], { cor: pele, largura: 8, semente: s + 2 });
    for (let i = 0; i < 3; i++) traco(ctx, [[22, 106], [12 - i * 2, 116 + i * 3]], { cor: '#e8dcc4', largura: 2.8, semente: s + 20 + i });
    traco(ctx, [[100, 74], [118, 86], [116, 104]], { cor: pele, largura: 8, semente: s + 3 });
    // cabelos amarelos
    for (let i = 0; i < 9; i++) {
      const x = 34 + i * 8;
      traco(ctx, [[x, 44], [x - 6 + (i % 3) * 5, 20], [x + 2, 4]], { cor: '#d9b23c', largura: 4, semente: s + 30 + i });
    }
    // cabeça de jacaré
    corpo(ctx, 74, 42, 28, 24, pele, s + 4);
    forma(ctx, [[52, 36], [14, 44], [14, 58], [54, 56]], { ...P, largura: 2.8, preenche: pele, semente: s + 5 });
    forma(ctx, [[52, 50], [14, 54], [14, 62], [54, 62]], { ...P, largura: 2.4, preenche: tom(pele, 0.12), semente: s + 6 });
    dentes(ctx, 16, 52, 52, 8, s + 7);
    dentes(ctx, 18, 60, 50, 7, s + 8, false);
    for (let i = 0; i < 5; i++) {
      forma(ctx, [[56 + i * 9, 26], [61 + i * 9, 16], [66 + i * 9, 26]], { cor: tom(pele, -0.4), largura: 1.8, preenche: tom(pele, -0.2), semente: s + 40 + i });
    }
    olhoMau(ctx, 58, 34, 8, s + 9, '#e0913a');
    olhoMau(ctx, 84, 30, 8, s + 10, '#e0913a');
  },
};

/** Sprite cacheado do monstro. Volume um pouco mais duro que o dos bichos. */
export function spriteMonstro(id, tamanho = 128) {
  return sprite(`monstro:${id}:${tamanho}`, tamanho, tamanho, (ctx, w, h) => {
    ctx.save();
    ctx.scale(w / 128, h / 128);
    const pintar = desenhos[id];
    if (pintar) pintar(ctx, (id.charCodeAt(0) * 53 + id.length * 17) | 0);
    ctx.restore();
    volume(ctx, w, h, 0.9);
  });
}

export const MONSTROS_DESENHADOS = Object.keys(desenhos);
