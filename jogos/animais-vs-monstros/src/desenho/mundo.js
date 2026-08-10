// Mapa-múndi rabiscado. Os contornos são listas de (longitude, latitude) —
// grosseiros de propósito, no espírito de mapa desenhado de memória, mas
// geográficos o bastante para qualquer um achar o Brasil de primeira.

import { forma, traco, circulo, texto, sprite } from '../rabisco.js';
import { TINTA, CORES, tom, alfa } from '../paleta.js';

const CONTINENTES = {
  americaNorte: [
    [-168, 65], [-160, 71], [-140, 70], [-120, 70], [-100, 69], [-85, 70], [-75, 74], [-60, 75],
    [-56, 60], [-65, 50], [-70, 45], [-75, 36], [-81, 25], [-90, 29], [-97, 26], [-105, 20],
    [-95, 15], [-84, 10], [-78, 8], [-83, 16], [-96, 19], [-110, 24], [-118, 33], [-125, 42],
    [-125, 50], [-135, 58], [-150, 60], [-165, 55],
  ],
  groenlandia: [
    [-45, 60], [-53, 65], [-56, 71], [-50, 78], [-40, 83], [-24, 82], [-19, 76], [-26, 70], [-36, 64],
  ],
  americaSul: [
    [-81, 0], [-79, -5], [-75, -14], [-70, -18], [-70, -23], [-72, -31], [-73, -41], [-75, -50],
    [-69, -55], [-64, -55], [-62, -49], [-58, -39], [-56, -34], [-48, -25], [-40, -21], [-35, -8],
    [-35, -5], [-44, -2], [-50, 1], [-52, 5], [-60, 8], [-70, 12], [-76, 9], [-79, 7],
  ],
  africa: [
    [-17, 15], [-17, 22], [-10, 30], [0, 36], [10, 37], [20, 32], [32, 31], [35, 24], [43, 12],
    [51, 12], [48, 4], [42, -3], [40, -11], [35, -20], [32, -26], [25, -34], [18, -35], [12, -18],
    [9, -1], [5, 5], [-5, 5], [-10, 10],
  ],
  eurasia: [
    [-10, 36], [-9, 44], [0, 49], [5, 58], [10, 64], [25, 71], [40, 68], [60, 70], [80, 74],
    [100, 76], [120, 73], [140, 72], [160, 68], [175, 65], [179, 62], [160, 57], [145, 50],
    [140, 45], [130, 42], [126, 35], [120, 30], [110, 20], [105, 10], [100, 6], [95, 16],
    [90, 22], [80, 20], [72, 21], [68, 25], [60, 25], [55, 20], [50, 13], [43, 13], [35, 25],
    [32, 31], [28, 36], [20, 40], [12, 45], [4, 43], [-5, 36],
  ],
  oceania: [
    [113, -22], [114, -28], [118, -35], [129, -32], [137, -35], [141, -38], [147, -39], [150, -37],
    [153, -28], [146, -19], [142, -11], [135, -12], [130, -11], [125, -14], [118, -20],
  ],
  japao: [[130, 33], [136, 35], [141, 40], [145, 44], [141, 43], [136, 36], [131, 32]],
  madagascar: [[43, -12], [50, -15], [50, -24], [45, -25], [43, -19]],
  britanica: [[-6, 50], [-2, 51], [1, 53], [-1, 58], [-5, 58], [-6, 54]],
  novaZelandia: [[166, -46], [172, -43], [175, -37], [178, -38], [174, -41], [170, -46]],
};

/** Converte (longitude, latitude) para pixel dentro de um retângulo. */
export function projetar(lon, lat, x, y, w, h) {
  return [x + ((lon + 180) / 360) * w, y + ((90 - lat) / 180) * h];
}

/** Onde fica cada país da campanha, e o estado dele. */
export const PAISES = [
  {
    id: 'brasil',
    nome: 'Brasil',
    bandeira: '🇧🇷',
    lon: -51,
    lat: -12,
    liberado: true,
    fases: 10,
    monstros: 'folclore brasileiro',
  },
  { id: 'mexico', nome: 'México', bandeira: '🇲🇽', lon: -102, lat: 23, liberado: false, fases: 10, monstros: 'La Llorona, El Cucuy' },
  { id: 'japao', nome: 'Japão', bandeira: '🇯🇵', lon: 138, lat: 36, liberado: false, fases: 10, monstros: 'yōkai' },
  { id: 'nigeria', nome: 'Nigéria', bandeira: '🇳🇬', lon: 8, lat: 9, liberado: false, fases: 10, monstros: 'Madame Koi Koi' },
  { id: 'irlanda', nome: 'Irlanda', bandeira: '🇮🇪', lon: -8, lat: 53, liberado: false, fases: 10, monstros: 'banshee, pooka' },
  { id: 'india', nome: 'Índia', bandeira: '🇮🇳', lon: 79, lat: 22, liberado: false, fases: 10, monstros: 'rakshasa' },
];

/**
 * Desenha o mapa. `opts.escurecido` pinta os países ainda tomados; `opts.brilho`
 * é o país que pulsa (o disponível).
 */
export function desenharMapa(ctx, x, y, w, h, opts = {}) {
  const {
    corTerra = '#c9b48c',
    corBorda = TINTA,
    corMar = '#a8c4d4',
    tomado = true,
    semente = 1,
  } = opts;

  // mar
  ctx.fillStyle = corMar;
  ctx.fillRect(x, y, w, h);
  // meridianos e paralelos, de leve
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let lon = -150; lon <= 150; lon += 30) {
    const [px] = projetar(lon, 0, x, y, w, h);
    traco(ctx, [[px, y], [px, y + h]], { cor: TINTA, largura: 1, passadas: 1, semente: semente + lon });
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, py] = projetar(0, lat, x, y, w, h);
    traco(ctx, [[x, py], [x + w, py]], { cor: TINTA, largura: 1, passadas: 1, semente: semente + lat });
  }
  ctx.restore();

  // continentes
  let i = 0;
  for (const nome in CONTINENTES) {
    const pontos = CONTINENTES[nome].map(([lon, lat]) => projetar(lon, lat, x, y, w, h));
    forma(ctx, pontos, {
      cor: corBorda,
      largura: 2.2,
      preenche: tomado ? tom(corTerra, -0.3) : corTerra,
      semente: semente + i * 37,
      rugosidade: 2.2,
    });
    i++;
  }
}

/** Mapa cacheado — o contorno é caro e não muda. */
export function mapaCacheado(largura, altura, opts = {}) {
  const chave = `mapa:${largura}x${altura}:${opts.tomado ? 'tomado' : 'livre'}:${opts.corTerra || ''}`;
  return sprite(chave, largura, altura, (ctx, w, h) => {
    desenharMapa(ctx, 0, 0, w, h, opts);
  });
}
