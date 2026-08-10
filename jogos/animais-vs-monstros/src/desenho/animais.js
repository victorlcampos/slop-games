// Os 19 bichos, desenhados um a um. Todos olham para a direita, que é de onde
// vem o problema. Espaço de 128x128, chão em y=120, centro em x=64.

import { forma, elipse, circulo, linha, traco, pontosElipse, sprite, hachura, volume } from '../rabisco.js';
import { TINTA, CORES, tom } from '../paleta.js';
import {
  CONTORNO, corpo, olho, olhoMau, orelhaPonta, orelhaRedonda, focinho, pata,
  cauda, penugem, pintas, listras, asa, dentes, chifre,
} from './comum.js';

const P = CONTORNO;

const desenhos = {
  // ------------------------------------------------------------------ esquilo
  esquilo(ctx, s) {
    const cor = '#c47a42';
    cauda(ctx, [[40, 108], [16, 92], [12, 58], [34, 34], [52, 44]], 22, cor, s);
    penugem(ctx, 26, 66, 20, 30, tom(cor, -0.2), s + 9, 10, 6);
    pata(ctx, 52, 120, 16, 10, tom(cor, -0.15), s + 1);
    pata(ctx, 74, 120, 16, 10, tom(cor, -0.15), s + 2);
    corpo(ctx, 64, 88, 26, 30, cor, s + 3);
    forma(ctx, pontosElipse(66, 96, 17, 20, 12), { cor: null, preenche: '#e8cba4', semente: s + 4 });
    orelhaPonta(ctx, 56, 52, 16, cor, s + 5, -0.25);
    orelhaPonta(ctx, 76, 50, 16, cor, s + 6, 0.15);
    corpo(ctx, 68, 58, 22, 21, cor, s + 7);
    forma(ctx, pontosElipse(76, 64, 12, 11, 10), { cor: null, preenche: '#e8cba4', semente: s + 8 });
    olho(ctx, 78, 54, 6, s + 10, { olhar: [0.5, 0] });
    olho(ctx, 62, 55, 5.5, s + 11, { olhar: [0.5, 0] });
    circulo(ctx, 88, 62, 3.5, { cor: null, preenche: TINTA, semente: s + 12 });
    // castanha nas mãos
    elipse(ctx, 84, 84, 10, 9, { ...P, largura: 2.2, preenche: '#a9713c', semente: s + 13 });
    forma(ctx, [[76, 80], [92, 80], [90, 74], [78, 74]], { cor: null, preenche: '#7d4f28', semente: s + 14 });
  },

  // ------------------------------------------------------------------- macaco
  macaco(ctx, s) {
    const cor = '#8e6244';
    cauda(ctx, [[44, 96], [22, 96], [14, 74], [26, 62], [36, 72]], 9, cor, s);
    pata(ctx, 52, 120, 17, 12, tom(cor, -0.15), s + 1);
    pata(ctx, 76, 120, 17, 12, tom(cor, -0.15), s + 2);
    corpo(ctx, 64, 90, 27, 28, cor, s + 3);
    forma(ctx, pontosElipse(66, 94, 18, 20, 12), { cor: null, preenche: '#d9b088', semente: s + 4 });
    orelhaRedonda(ctx, 44, 56, 10, cor, s + 5);
    orelhaRedonda(ctx, 86, 56, 10, cor, s + 6);
    corpo(ctx, 65, 56, 24, 23, cor, s + 7);
    forma(ctx, pontosElipse(68, 60, 17, 17, 12), { cor: null, preenche: '#e5c39c', semente: s + 8 });
    olho(ctx, 60, 53, 6, s + 9, { olhar: [0.6, 0] });
    olho(ctx, 76, 53, 6, s + 10, { olhar: [0.6, 0] });
    elipse(ctx, 68, 66, 5, 3.5, { cor: TINTA, largura: 1.8, preenche: '#b98a63', semente: s + 11 });
    traco(ctx, [[60, 72], [68, 76], [76, 72]], { cor: TINTA, largura: 2, semente: s + 12 });
    // o coco
    circulo(ctx, 92, 88, 12, { ...P, largura: 2.4, preenche: '#6b4a2f', semente: s + 13 });
    circulo(ctx, 88, 84, 2.5, { cor: null, preenche: '#3d2a1a', semente: s + 14 });
    circulo(ctx, 95, 85, 2.5, { cor: null, preenche: '#3d2a1a', semente: s + 15 });
  },

  // ---------------------------------------------------------------- tartaruga
  tartaruga(ctx, s) {
    const casco = '#6f8f4a';
    pata(ctx, 44, 120, 16, 11, '#9ab36e', s + 1);
    pata(ctx, 84, 120, 16, 11, '#9ab36e', s + 2);
    // pescoço e cabeça
    corpo(ctx, 96, 78, 15, 13, '#9ab36e', s + 3);
    forma(ctx, [[80, 88], [98, 84], [98, 96], [80, 98]], { ...P, preenche: '#9ab36e', semente: s + 4 });
    olho(ctx, 100, 74, 5, s + 5, { olhar: [0.5, 0] });
    traco(ctx, [[98, 84], [106, 83]], { cor: TINTA, largura: 2, semente: s + 6 });
    // casco
    forma(ctx, pontosElipse(60, 84, 40, 32, 16), { ...P, largura: 3, preenche: casco, semente: s + 7 });
    for (const [cx, cy, r] of [[60, 74, 13], [40, 88, 11], [60, 98, 11], [80, 88, 11], [44, 68, 8], [78, 68, 8]]) {
      forma(ctx, pontosElipse(cx, cy, r, r * 0.85, 6), {
        cor: tom(casco, -0.35), largura: 2, preenche: tom(casco, 0.12), semente: s + cx,
      });
    }
    forma(ctx, pontosElipse(60, 84, 40, 32, 16), { ...P, largura: 3, cor: TINTA, semente: s + 7 });
  },

  // ------------------------------------------------------------------- abelha
  abelha(ctx, s) {
    const cor = '#e5b93c';
    asa(ctx, 58, 62, 40, 26, 'rgba(220, 238, 245, 0.75)', s + 1, -0.9);
    asa(ctx, 66, 64, 34, 22, 'rgba(220, 238, 245, 0.7)', s + 2, -0.35);
    corpo(ctx, 62, 84, 30, 25, cor, s + 3);
    listras(ctx, 62, 84, 30, 25, '#3c332a', s + 4, 3);
    forma(ctx, pontosElipse(62, 84, 30, 25, 14), { ...P, largura: 2.8, semente: s + 3 });
    // ferrão
    forma(ctx, [[32, 84], [18, 88], [32, 92]], { cor: TINTA, largura: 2, preenche: '#4a423b', semente: s + 5 });
    corpo(ctx, 92, 78, 19, 18, tom(cor, 0.12), s + 6);
    olho(ctx, 98, 72, 6, s + 7, { olhar: [0.5, 0] });
    olho(ctx, 86, 74, 5, s + 8, { olhar: [0.5, 0] });
    traco(ctx, [[94, 84], [100, 88], [106, 84]], { cor: TINTA, largura: 2, semente: s + 9 });
    linha(ctx, 92, 62, 86, 46, { cor: TINTA, largura: 2.2, semente: s + 10 });
    linha(ctx, 100, 62, 106, 48, { cor: TINTA, largura: 2.2, semente: s + 11 });
    circulo(ctx, 85, 44, 4, { cor: null, preenche: TINTA, semente: s + 12 });
    circulo(ctx, 107, 46, 4, { cor: null, preenche: TINTA, semente: s + 13 });
  },

  // ------------------------------------------------------------------- ouriço
  ourico(ctx, s) {
    const cor = '#a8845c';
    // espinhos primeiro, atrás do corpo
    for (let i = 0; i < 22; i++) {
      const a = Math.PI * 1.05 + (i / 21) * Math.PI * 0.95;
      const x = 58 + Math.cos(a) * 36;
      const y = 88 + Math.sin(a) * 32;
      linha(ctx, x, y, x + Math.cos(a) * 17, y + Math.sin(a) * 17, {
        cor: '#5c4a33', largura: 3.2, passadas: 1, semente: s + i * 3,
      });
    }
    corpo(ctx, 58, 90, 38, 30, '#7d6547', s + 1);
    pata(ctx, 48, 120, 13, 9, '#c49a6a', s + 2);
    pata(ctx, 74, 120, 13, 9, '#c49a6a', s + 3);
    corpo(ctx, 94, 92, 19, 17, cor, s + 4);
    forma(ctx, [[104, 86], [118, 94], [104, 100]], { ...P, largura: 2.2, preenche: cor, semente: s + 5 });
    circulo(ctx, 117, 94, 3.5, { cor: null, preenche: TINTA, semente: s + 6 });
    olho(ctx, 98, 86, 5, s + 7, { olhar: [0.6, 0] });
  },

  // ------------------------------------------------------------------- castor
  castor(ctx, s) {
    const cor = '#8a5f3c';
    // cauda achatada
    forma(ctx, pontosElipse(26, 100, 22, 13, 12), { ...P, preenche: '#5f4530', semente: s + 1 });
    for (let i = -2; i <= 2; i++) linha(ctx, 12 + i * 2 + 14, 90, 12 + i * 2 + 14, 110, { cor: '#3f2e20', largura: 1.4, passadas: 1, semente: s + i + 20 });
    pata(ctx, 56, 120, 16, 11, tom(cor, -0.15), s + 2);
    pata(ctx, 80, 120, 16, 11, tom(cor, -0.15), s + 3);
    corpo(ctx, 66, 90, 30, 28, cor, s + 4);
    forma(ctx, pontosElipse(70, 96, 19, 19, 12), { cor: null, preenche: '#c69a6c', semente: s + 5 });
    corpo(ctx, 76, 60, 24, 22, cor, s + 6);
    orelhaRedonda(ctx, 62, 46, 7, cor, s + 7);
    orelhaRedonda(ctx, 88, 46, 7, cor, s + 8);
    olho(ctx, 70, 55, 5.5, s + 9, { olhar: [0.6, 0] });
    olho(ctx, 86, 55, 5.5, s + 10, { olhar: [0.6, 0] });
    elipse(ctx, 90, 66, 6, 4.5, { cor: TINTA, largura: 2, preenche: '#5f4530', semente: s + 11 });
    // os dentes, que são o ponto do castor
    forma(ctx, [[80, 70], [92, 70], [92, 84], [80, 84]], { cor: TINTA, largura: 2, preenche: '#f7f2e7', semente: s + 12 });
    linha(ctx, 86, 70, 86, 84, { cor: TINTA, largura: 1.6, passadas: 1, semente: s + 13 });
    // tronco roído
    elipse(ctx, 36, 118, 18, 8, { ...P, largura: 2.2, preenche: '#7a5a3a', semente: s + 14 });
  },

  // ----------------------------------------------------------------- morcego
  morcego(ctx, s) {
    const cor = '#5b4a63';
    const membrana = '#7d6688';
    forma(ctx, [[62, 78], [26, 58], [16, 76], [30, 74], [24, 92], [42, 84], [58, 94]], { ...P, largura: 2.4, preenche: membrana, semente: s + 1 });
    forma(ctx, [[66, 78], [102, 58], [112, 76], [98, 74], [104, 92], [86, 84], [70, 94]], { ...P, largura: 2.4, preenche: membrana, semente: s + 2 });
    corpo(ctx, 64, 84, 17, 22, cor, s + 3);
    forma(ctx, [[52, 52], [56, 30], [66, 48]], { ...P, largura: 2.2, preenche: cor, semente: s + 4 });
    forma(ctx, [[76, 52], [72, 30], [62, 48]], { ...P, largura: 2.2, preenche: cor, semente: s + 5 });
    corpo(ctx, 64, 60, 19, 17, cor, s + 6);
    olho(ctx, 57, 57, 5, s + 7, { cor: '#f2b03c', pupila: TINTA });
    olho(ctx, 71, 57, 5, s + 8, { cor: '#f2b03c', pupila: TINTA });
    dentes(ctx, 58, 70, 70, 6, s + 9);
  },

  // --------------------------------------------------------------- escorpião
  escorpiao(ctx, s) {
    const cor = '#9c6236';
    // patas primeiro, para ficarem atrás do corpo
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 13;
      traco(ctx, [[x, 100], [x - 8, 110], [x - 12, 122]], { cor: TINTA, largura: 3, semente: s + 20 + i });
      traco(ctx, [[x + 4, 100], [x + 2, 92], [x - 4, 84]], { cor: TINTA, largura: 2.6, semente: s + 30 + i });
    }
    // cauda arqueada por cima, do rabo até o ferrão
    const p = [[36, 96], [20, 74], [26, 48], [48, 34], [72, 36]];
    cauda(ctx, p, 12, cor, s + 1);
    for (const [x, y] of p) circulo(ctx, x, y, 8, { cor: TINTA, largura: 2, preenche: tom(cor, 0.12), semente: s + x });
    forma(ctx, [[72, 36], [92, 30], [76, 48]], { cor: TINTA, largura: 2.2, preenche: '#3f2e20', semente: s + 2 });
    // corpo achatado e comprido
    forma(ctx, pontosElipse(62, 100, 34, 16, 14), { ...P, largura: 2.8, preenche: cor, semente: s + 3 });
    for (let i = 0; i < 4; i++) {
      linha(ctx, 40 + i * 14, 88, 40 + i * 14, 112, { cor: tom(cor, -0.35), largura: 1.8, passadas: 1, semente: s + 40 + i });
    }
    // pinças grandes à frente
    for (const [px, py] of [[104, 90], [102, 110]]) {
      traco(ctx, [[90, py - 4], [px - 10, py]], { cor: TINTA, largura: 4, semente: s + px });
      forma(ctx, [[px - 12, py - 9], [px + 8, py - 12], [px + 16, py - 3], [px + 4, py], [px + 16, py + 6], [px - 2, py + 9], [px - 12, py + 6]], {
        ...P, largura: 2.4, preenche: tom(cor, 0.14), semente: s + px + 1,
      });
    }
    olhoMau(ctx, 76, 94, 4.5, s + 50, '#e0913a');
    olhoMau(ctx, 66, 94, 4, s + 51, '#e0913a');
  },

  // ----------------------------------------------------------------- canguru
  canguru(ctx, s) {
    const cor = '#b4794a';
    // cauda grossa apoiada no chão, atrás
    cauda(ctx, [[48, 96], [24, 108], [8, 118]], 17, tom(cor, -0.12), s + 1);
    // a perna em L: coxa alta e pé comprido no chão — é isso que faz ler canguru
    forma(ctx, [[42, 70], [66, 68], [70, 96], [58, 104], [44, 100]], { ...P, largura: 2.6, preenche: tom(cor, -0.1), semente: s + 2 });
    forma(ctx, [[46, 100], [62, 98], [88, 114], [86, 122], [44, 122]], { ...P, largura: 2.6, preenche: tom(cor, -0.18), semente: s + 3 });
    // tronco inclinado para a frente
    forma(ctx, [[46, 52], [76, 44], [86, 72], [72, 92], [48, 88]], { ...P, largura: 2.8, preenche: cor, semente: s + 4 });
    forma(ctx, pontosElipse(68, 76, 14, 15, 12), { cor: null, preenche: '#dcb98d', semente: s + 5 });
    traco(ctx, [[56, 72], [68, 82], [80, 72]], { cor: tom(cor, -0.32), largura: 2.2, semente: s + 6 });
    // bracinhos curtos, colados no peito
    traco(ctx, [[76, 56], [90, 62], [88, 70]], { cor: TINTA, largura: 4, semente: s + 7 });
    traco(ctx, [[72, 58], [84, 66], [82, 74]], { cor: TINTA, largura: 3.6, semente: s + 8 });
    // cabeça alongada, focinho para a direita
    forma(ctx, [[62, 30], [86, 26], [104, 38], [102, 48], [78, 50], [60, 44]], { ...P, largura: 2.6, preenche: cor, semente: s + 9 });
    // orelhas compridas
    forma(ctx, [[64, 30], [58, 4], [72, 24]], { ...P, largura: 2.2, preenche: cor, semente: s + 10 });
    forma(ctx, [[78, 28], [84, 2], [88, 26]], { ...P, largura: 2.2, preenche: cor, semente: s + 11 });
    forma(ctx, [[80, 24], [83, 8], [86, 24]], { cor: null, preenche: tom(cor, -0.3), semente: s + 12 });
    olho(ctx, 84, 36, 5.5, s + 13, { olhar: [0.6, 0] });
    circulo(ctx, 103, 42, 3.5, { cor: null, preenche: TINTA, semente: s + 14 });
    traco(ctx, [[92, 48], [100, 47]], { cor: TINTA, largura: 2, semente: s + 15 });
  },

  // ------------------------------------------------------------------- gambá
  gamba(ctx, s) {
    const cor = '#3c3630';
    cauda(ctx, [[38, 100], [16, 92], [10, 70]], 16, cor, s + 1);
    pata(ctx, 52, 120, 14, 10, '#2b2622', s + 2);
    pata(ctx, 78, 120, 14, 10, '#2b2622', s + 3);
    corpo(ctx, 64, 92, 32, 26, cor, s + 4);
    // as duas faixas brancas
    forma(ctx, [[40, 78], [88, 74], [90, 86], [42, 88]], { cor: null, preenche: '#efe7d8', semente: s + 5 });
    forma(ctx, pontosElipse(64, 92, 32, 26, 14), { ...P, largura: 2.8, semente: s + 4 });
    corpo(ctx, 96, 92, 18, 16, cor, s + 6);
    forma(ctx, [[104, 88], [120, 94], [104, 99]], { ...P, largura: 2, preenche: '#efe7d8', semente: s + 7 });
    circulo(ctx, 119, 94, 3, { cor: null, preenche: TINTA, semente: s + 8 });
    orelhaRedonda(ctx, 90, 78, 7, '#5c534a', s + 9);
    olho(ctx, 100, 86, 5, s + 10, { olhar: [0.6, 0] });
    // fedor
    for (let i = 0; i < 3; i++) {
      traco(ctx, [[28, 62 - i * 8], [20, 54 - i * 8], [28, 46 - i * 8]], {
        cor: '#8a9b5c', largura: 2, passadas: 1, alfa: 0.6, semente: s + 30 + i,
      });
    }
  },

  // ------------------------------------------------------------------ coruja
  coruja(ctx, s) {
    const cor = '#a08256';
    asa(ctx, 40, 84, 26, 30, tom(cor, -0.2), s + 1, 2.6);
    corpo(ctx, 64, 82, 32, 38, cor, s + 2);
    forma(ctx, pontosElipse(66, 92, 20, 26, 12), { cor: null, preenche: '#d8c39a', semente: s + 3 });
    for (let i = 0; i < 5; i++) {
      traco(ctx, [[52 + i * 7, 96], [55 + i * 7, 102], [58 + i * 7, 96]], { cor: tom(cor, -0.3), largura: 1.6, passadas: 1, semente: s + 10 + i });
    }
    // tufos de orelha
    forma(ctx, [[46, 54], [42, 32], [58, 48]], { ...P, largura: 2.2, preenche: cor, semente: s + 4 });
    forma(ctx, [[82, 54], [88, 32], [70, 48]], { ...P, largura: 2.2, preenche: cor, semente: s + 5 });
    // disco facial e os olhos enormes
    circulo(ctx, 54, 62, 15, { cor: tom(cor, -0.25), largura: 2, preenche: '#e4d3ae', semente: s + 6 });
    circulo(ctx, 76, 62, 15, { cor: tom(cor, -0.25), largura: 2, preenche: '#e4d3ae', semente: s + 7 });
    olho(ctx, 55, 62, 10, s + 8, { olhar: [0.35, 0], cor: '#f2c94c' });
    olho(ctx, 77, 62, 10, s + 9, { olhar: [0.35, 0], cor: '#f2c94c' });
    forma(ctx, [[60, 72], [70, 72], [65, 84]], { cor: TINTA, largura: 2, preenche: '#e0913a', semente: s + 10 });
    pata(ctx, 56, 120, 11, 8, '#e0913a', s + 11);
    pata(ctx, 74, 120, 11, 8, '#e0913a', s + 12);
  },

  // ------------------------------------------------------------------- cobra
  cobra(ctx, s) {
    const cor = '#7c9b4e';
    // corpo enrolado
    forma(ctx, pontosElipse(56, 104, 40, 17, 14), { ...P, largura: 2.8, preenche: cor, semente: s + 1 });
    forma(ctx, pontosElipse(58, 88, 30, 14, 14), { ...P, largura: 2.8, preenche: tom(cor, 0.08), semente: s + 2 });
    for (let i = 0; i < 5; i++) {
      circulo(ctx, 34 + i * 12, 104, 4, { cor: null, preenche: tom(cor, -0.3), semente: s + 10 + i });
    }
    // pescoço erguido e capelo
    forma(ctx, [[70, 88], [96, 66], [92, 40], [76, 38], [62, 56], [58, 82]], { ...P, largura: 2.6, preenche: cor, semente: s + 3 });
    forma(ctx, [[66, 56], [96, 50], [92, 26], [70, 28]], { ...P, largura: 2.4, preenche: tom(cor, 0.15), semente: s + 4 });
    corpo(ctx, 84, 34, 17, 14, cor, s + 5);
    olho(ctx, 90, 30, 5, s + 6, { olhar: [0.5, 0], cor: '#f2c94c' });
    olho(ctx, 76, 32, 4.5, s + 7, { olhar: [0.5, 0], cor: '#f2c94c' });
    // língua bifurcada
    traco(ctx, [[98, 38], [112, 36]], { cor: CORES.perigo, largura: 2, semente: s + 8 });
    traco(ctx, [[112, 36], [120, 32]], { cor: CORES.perigo, largura: 1.8, semente: s + 9 });
    traco(ctx, [[112, 36], [120, 40]], { cor: CORES.perigo, largura: 1.8, semente: s + 10 });
  },

  // ------------------------------------------------------------------ jacaré
  jacare(ctx, s) {
    const cor = '#5f7a44';
    cauda(ctx, [[40, 104], [16, 100], [6, 88]], 16, cor, s + 1);
    corpo(ctx, 58, 102, 38, 17, cor, s + 2);
    pata(ctx, 40, 120, 13, 9, tom(cor, -0.2), s + 3);
    pata(ctx, 76, 120, 13, 9, tom(cor, -0.2), s + 4);
    // placas do dorso
    for (let i = 0; i < 7; i++) {
      const x = 28 + i * 11;
      forma(ctx, [[x, 90], [x + 5, 80], [x + 10, 90]], { cor: tom(cor, -0.35), largura: 1.8, preenche: tom(cor, -0.15), semente: s + 20 + i });
    }
    // focinho comprido
    forma(ctx, [[86, 92], [126, 94], [126, 106], [86, 110]], { ...P, largura: 2.6, preenche: cor, semente: s + 5 });
    forma(ctx, [[88, 104], [126, 104], [126, 110], [88, 112]], { ...P, largura: 2.2, preenche: tom(cor, 0.12), semente: s + 6 });
    dentes(ctx, 92, 104, 124, 6, s + 7);
    olho(ctx, 92, 86, 6, s + 8, { olhar: [0.5, -0.2], cor: '#f2c94c' });
    circulo(ctx, 122, 96, 2.5, { cor: null, preenche: TINTA, semente: s + 9 });
  },

  // ------------------------------------------------------------------- águia
  aguia(ctx, s) {
    const corpoC = '#6b4a30';
    // asa de trás, aberta para a esquerda e para cima
    forma(ctx, [[58, 72], [30, 46], [4, 40], [16, 60], [2, 66], [24, 76], [46, 84]], {
      ...P, largura: 2.4, preenche: tom(corpoC, -0.12), semente: s + 1,
    });
    // corpo
    forma(ctx, [[54, 60], [78, 58], [84, 88], [70, 108], [52, 100]], { ...P, largura: 2.8, preenche: corpoC, semente: s + 2 });
    // penas do peito
    for (let i = 0; i < 3; i++) {
      traco(ctx, [[56 + i * 9, 78], [60 + i * 9, 86], [64 + i * 9, 78]], { cor: tom(corpoC, -0.35), largura: 1.6, passadas: 1, semente: s + 20 + i });
    }
    // asa da frente, aberta para a direita
    forma(ctx, [[76, 66], [104, 44], [126, 40], [116, 60], [128, 68], [106, 78], [82, 84]], {
      ...P, largura: 2.4, preenche: tom(corpoC, 0.14), semente: s + 3,
    });
    // cauda em leque
    forma(ctx, [[56, 98], [40, 116], [66, 112], [72, 100]], { ...P, largura: 2.2, preenche: tom(corpoC, -0.2), semente: s + 4 });
    // cabeça branca
    corpo(ctx, 72, 40, 19, 18, '#f2ece0', s + 5);
    forma(ctx, [[84, 36], [106, 42], [96, 48], [84, 46]], { cor: TINTA, largura: 2.2, preenche: '#e8b23c', semente: s + 6 });
    traco(ctx, [[102, 43], [96, 49]], { cor: TINTA, largura: 2, semente: s + 7 });
    olho(ctx, 78, 35, 5.5, s + 8, { olhar: [0.6, 0], cor: '#f2c94c' });
    // a sobrancelha que dá a cara brava da águia
    traco(ctx, [[70, 28], [86, 31]], { cor: TINTA, largura: 3, semente: s + 9 });
    pata(ctx, 62, 120, 11, 9, '#e8b23c', s + 10);
    pata(ctx, 78, 120, 11, 9, '#e8b23c', s + 11);
  },

  // -------------------------------------------------------------- hipopótamo
  hipopotamo(ctx, s) {
    const cor = '#9c7f88';
    pata(ctx, 42, 120, 18, 12, tom(cor, -0.2), s + 1);
    pata(ctx, 82, 120, 18, 12, tom(cor, -0.2), s + 2);
    corpo(ctx, 56, 92, 40, 28, cor, s + 3);
    // cabeçorra
    corpo(ctx, 94, 88, 30, 26, tom(cor, 0.06), s + 4);
    forma(ctx, [[76, 96], [124, 94], [124, 108], [76, 108]], { ...P, largura: 2.6, preenche: tom(cor, 0.12), semente: s + 5 });
    dentes(ctx, 84, 100, 118, 7, s + 6, false);
    circulo(ctx, 112, 80, 4, { cor: TINTA, largura: 1.8, preenche: tom(cor, -0.3), semente: s + 7 });
    circulo(ctx, 100, 78, 4, { cor: TINTA, largura: 1.8, preenche: tom(cor, -0.3), semente: s + 8 });
    olho(ctx, 92, 68, 6, s + 9, { olhar: [0.5, 0] });
    orelhaRedonda(ctx, 76, 66, 7, cor, s + 10);
  },

  // -------------------------------------------------------------------- onça
  onca(ctx, s) {
    const cor = '#d9a94e';
    cauda(ctx, [[38, 92], [14, 84], [8, 60], [22, 52]], 11, cor, s + 1);
    pata(ctx, 44, 120, 15, 11, cor, s + 2);
    pata(ctx, 80, 120, 15, 11, cor, s + 3);
    corpo(ctx, 60, 92, 36, 24, cor, s + 4);
    pintas(ctx, 60, 92, 36, 24, '#5b4526', s + 5, 9);
    forma(ctx, pontosElipse(60, 92, 36, 24, 14), { ...P, largura: 2.8, semente: s + 4 });
    corpo(ctx, 94, 74, 24, 22, cor, s + 6);
    pintas(ctx, 94, 70, 20, 16, '#5b4526', s + 7, 4);
    orelhaPonta(ctx, 84, 56, 13, cor, s + 8, -0.2);
    orelhaPonta(ctx, 104, 56, 13, cor, s + 9, 0.2);
    forma(ctx, pontosElipse(100, 82, 13, 10, 10), { cor: null, preenche: '#f0dfb4', semente: s + 10 });
    olho(ctx, 88, 72, 6, s + 11, { olhar: [0.6, 0], cor: '#f2c94c' });
    olho(ctx, 104, 72, 6, s + 12, { olhar: [0.6, 0], cor: '#f2c94c' });
    elipse(ctx, 104, 82, 5, 3.5, { cor: TINTA, largura: 2, preenche: '#8a5f3c', semente: s + 13 });
    traco(ctx, [[98, 88], [104, 91], [110, 87]], { cor: TINTA, largura: 2, semente: s + 14 });
    for (const y of [80, 84]) {
      linha(ctx, 112, y, 126, y - 4, { cor: TINTA, largura: 1.4, passadas: 1, semente: s + y });
    }
  },

  // --------------------------------------------------------------- urso polar
  ursopolar(ctx, s) {
    // branco em papel bege some: a sombra azulada por baixo é o que segura a
    // silhueta, e o contorno vai mais grosso que o dos outros bichos.
    const cor = '#fbf7ee';
    const sombraFria = '#c3cfd6';
    const traçoUrso = { ...P, largura: 3.2 };
    pata(ctx, 42, 120, 20, 13, sombraFria, s + 1);
    pata(ctx, 84, 120, 20, 13, sombraFria, s + 2);
    forma(ctx, pontosElipse(58, 88, 40, 32, 14), { ...traçoUrso, preenche: sombraFria, semente: s + 3 });
    forma(ctx, pontosElipse(56, 85, 37, 29, 14), { cor: null, preenche: cor, semente: s + 4 });
    penugem(ctx, 58, 88, 40, 32, sombraFria, s + 5, 16, 6);
    forma(ctx, pontosElipse(96, 68, 26, 24, 12), { ...traçoUrso, preenche: sombraFria, semente: s + 6 });
    forma(ctx, pontosElipse(95, 66, 23, 21, 12), { cor: null, preenche: cor, semente: s + 7 });
    orelhaRedonda(ctx, 84, 50, 9, cor, s + 8);
    orelhaRedonda(ctx, 108, 52, 9, cor, s + 9);
    forma(ctx, [[100, 74], [124, 78], [122, 90], [98, 88]], { ...traçoUrso, largura: 2.6, preenche: sombraFria, semente: s + 10 });
    elipse(ctx, 122, 80, 6, 5, { cor: TINTA, largura: 2, preenche: TINTA, semente: s + 11 });
    olho(ctx, 92, 62, 5.5, s + 12, { olhar: [0.6, 0] });
    olho(ctx, 108, 62, 5.5, s + 13, { olhar: [0.6, 0] });
    // bafo gelado
    for (let i = 0; i < 3; i++) {
      circulo(ctx, 126 - i * 4, 88 + i * 6, 3 + i, { cor: null, preenche: 'rgba(120, 190, 220, 0.55)', semente: s + 30 + i });
    }
  },

  // -------------------------------------------------------------------- leão
  leao(ctx, s) {
    const cor = '#d9a44e';
    const juba = '#b9772e';
    cauda(ctx, [[36, 96], [14, 88], [12, 66]], 8, cor, s + 1);
    circulo(ctx, 20, 62, 8, { ...P, largura: 2.2, preenche: juba, semente: s + 2 });
    pata(ctx, 46, 120, 16, 11, cor, s + 3);
    pata(ctx, 80, 120, 16, 11, cor, s + 4);
    corpo(ctx, 58, 94, 34, 24, cor, s + 5);
    // a juba, em duas camadas de tufos
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = 88 + Math.cos(a) * 32;
      const y = 66 + Math.sin(a) * 32;
      circulo(ctx, x, y, 11, { cor: tom(juba, -0.25), largura: 2, preenche: i % 2 ? juba : tom(juba, -0.12), semente: s + 20 + i });
    }
    corpo(ctx, 88, 66, 25, 23, cor, s + 6);
    forma(ctx, pontosElipse(92, 74, 15, 12, 10), { cor: null, preenche: '#f0dfb4', semente: s + 7 });
    olho(ctx, 82, 62, 6, s + 8, { olhar: [0.6, 0], cor: '#f2c94c' });
    olho(ctx, 98, 62, 6, s + 9, { olhar: [0.6, 0], cor: '#f2c94c' });
    elipse(ctx, 96, 74, 5.5, 4, { cor: TINTA, largura: 2, preenche: '#8a5f3c', semente: s + 10 });
    traco(ctx, [[88, 80], [96, 84], [104, 79]], { cor: TINTA, largura: 2.2, semente: s + 11 });
    dentes(ctx, 90, 84, 104, 5, s + 12);
  },

  // ---------------------------------------------------------------- elefante
  elefante(ctx, s) {
    const cor = '#93949a';
    pata(ctx, 40, 120, 21, 16, tom(cor, -0.15), s + 1);
    pata(ctx, 74, 120, 21, 16, tom(cor, -0.15), s + 2);
    cauda(ctx, [[26, 84], [14, 94], [16, 104]], 6, cor, s + 3);
    corpo(ctx, 54, 84, 38, 32, cor, s + 4);
    // orelhona
    forma(ctx, pontosElipse(86, 66, 26, 30, 12), { ...P, largura: 2.6, preenche: tom(cor, 0.08), semente: s + 5 });
    forma(ctx, pontosElipse(88, 68, 17, 20, 10), { cor: tom(cor, -0.25), largura: 1.8, preenche: null, semente: s + 6 });
    corpo(ctx, 100, 72, 24, 26, cor, s + 7);
    // tromba
    const t = [[104, 90], [116, 100], [118, 114], [110, 120]];
    cauda(ctx, t, 15, cor, s + 8);
    for (let i = 0; i < 3; i++) linha(ctx, 108 + i * 2, 96 + i * 8, 120 + i, 96 + i * 8, { cor: tom(cor, -0.3), largura: 1.6, passadas: 1, semente: s + 40 + i });
    // presas
    forma(ctx, [[92, 92], [86, 108], [96, 96]], { cor: TINTA, largura: 2, preenche: '#f0e9d8', semente: s + 9 });
    forma(ctx, [[114, 90], [122, 104], [116, 92]], { cor: TINTA, largura: 2, preenche: '#f0e9d8', semente: s + 10 });
    olho(ctx, 106, 64, 5.5, s + 11, { olhar: [0.6, 0] });
  },
};

/** Sprite cacheado do animal, já com volume aplicado por cima. */
export function spriteAnimal(id, tamanho = 128) {
  return sprite(`animal:${id}:${tamanho}`, tamanho, tamanho, (ctx, w, h) => {
    ctx.save();
    ctx.scale(w / 128, h / 128);
    const pintar = desenhos[id];
    if (pintar) pintar(ctx, (id.charCodeAt(0) * 37 + id.length * 11) | 0);
    ctx.restore();
    volume(ctx, w, h);
  });
}

export const ANIMAIS_DESENHADOS = Object.keys(desenhos);
