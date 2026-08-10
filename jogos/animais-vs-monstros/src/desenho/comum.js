// Peças que quase todo bicho usa. Manter isto aqui é o que torna possível ter
// 30 criaturas desenhadas à mão sem 30 arquivos enormes.

import { forma, elipse, circulo, linha, traco, pontosElipse, semear } from '../rabisco.js';
import { TINTA, CORES, tom } from '../paleta.js';

export const CONTORNO = { cor: TINTA, largura: 2.6, rugosidade: 1.5 };

/** Corpo oval padrão. */
export function corpo(ctx, cx, cy, rx, ry, cor, s, giro = 0) {
  forma(ctx, pontosElipse(cx, cy, rx, ry, 14, giro), { ...CONTORNO, preenche: cor, semente: s });
}

/** Olho com brilho — a alma do bicho está aqui. */
export function olho(ctx, x, y, r, s, opts = {}) {
  const { olhar = [0, 0], fechado = false, cor = '#f7f2e7', pupila = TINTA } = opts;
  if (fechado) {
    traco(ctx, [[x - r, y], [x, y + r * 0.5], [x + r, y]], { ...CONTORNO, largura: 2.2, semente: s });
    return;
  }
  circulo(ctx, x, y, r, { ...CONTORNO, largura: 2, preenche: cor, semente: s });
  const px = x + olhar[0] * r * 0.35;
  const py = y + olhar[1] * r * 0.35;
  circulo(ctx, px, py, r * 0.46, { cor: null, preenche: pupila, semente: s + 3 });
  circulo(ctx, px - r * 0.16, py - r * 0.18, r * 0.16, { cor: null, preenche: '#ffffff', semente: s + 5 });
}

/** Olho de monstro: sem branco, brilho frio. */
export function olhoMau(ctx, x, y, r, s, cor = '#f2b03c') {
  circulo(ctx, x, y, r, { cor: TINTA, largura: 2, preenche: cor, semente: s });
  const p = [[x - r * 0.5, y - r * 0.1], [x + r * 0.5, y - r * 0.1], [x, y + r * 0.9]];
  forma(ctx, p, { cor: null, preenche: TINTA, semente: s + 2 });
}

/** Orelha triangular (gato, esquilo, lobo). */
export function orelhaPonta(ctx, x, y, l, cor, s, giro = 0) {
  const c = Math.cos(giro);
  const sn = Math.sin(giro);
  const rot = (dx, dy) => [x + dx * c - dy * sn, y + dx * sn + dy * c];
  forma(ctx, [rot(-l * 0.5, 0), rot(0, -l), rot(l * 0.5, 0)], { ...CONTORNO, preenche: cor, semente: s });
  forma(ctx, [rot(-l * 0.22, -l * 0.08), rot(0, -l * 0.62), rot(l * 0.22, -l * 0.08)], {
    cor: null,
    preenche: tom(cor, -0.25),
    semente: s + 1,
  });
}

/** Orelha redonda (macaco, urso). */
export function orelhaRedonda(ctx, x, y, r, cor, s) {
  circulo(ctx, x, y, r, { ...CONTORNO, largura: 2.2, preenche: cor, semente: s });
  circulo(ctx, x, y, r * 0.5, { cor: null, preenche: tom(cor, -0.3), semente: s + 1 });
}

/** Focinho com narina e boca. */
export function focinho(ctx, x, y, r, s, cor = TINTA) {
  elipse(ctx, x, y, r, r * 0.75, { cor: TINTA, largura: 2, preenche: cor, semente: s });
  linha(ctx, x, y + r * 0.6, x, y + r * 1.5, { cor: TINTA, largura: 2, semente: s + 1 });
  traco(ctx, [[x - r * 1.5, y + r * 1.5], [x - r * 0.6, y + r * 2], [x, y + r * 1.5]], { cor: TINTA, largura: 2, semente: s + 2 });
  traco(ctx, [[x, y + r * 1.5], [x + r * 0.6, y + r * 2], [x + r * 1.5, y + r * 1.5]], { cor: TINTA, largura: 2, semente: s + 3 });
}

/** Pata simples embaixo do corpo. */
export function pata(ctx, x, y, w, h, cor, s) {
  forma(ctx, [[x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2 * 1.15, y], [x - w / 2 * 1.15, y]], {
    ...CONTORNO,
    largura: 2.2,
    preenche: cor,
    semente: s,
  });
}

/** Cauda curva e grossa. */
export function cauda(ctx, pontos, largura, cor, s) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // miolo pintado
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.beginPath();
  ctx.moveTo(pontos[0][0], pontos[0][1]);
  for (let i = 1; i < pontos.length; i++) {
    const [px, py] = pontos[i - 1];
    const [x, y] = pontos[i];
    ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
  }
  ctx.lineTo(pontos[pontos.length - 1][0], pontos[pontos.length - 1][1]);
  ctx.stroke();
  ctx.restore();
  // contorno rabiscado por cima
  traco(ctx, pontos, { ...CONTORNO, largura: 2.2, semente: s });
}

/** Pelo/penugem: risquinhos na borda de uma elipse. */
export function penugem(ctx, cx, cy, rx, ry, cor, s, qtd = 14, comprimento = 7) {
  for (let i = 0; i < qtd; i++) {
    const a = (i / qtd) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    linha(ctx, x, y, x + Math.cos(a) * comprimento, y + Math.sin(a) * comprimento, {
      cor,
      largura: 2,
      passadas: 1,
      semente: s + i,
    });
  }
}

/** Pintas (onça, gambá, cogumelo). */
export function pintas(ctx, cx, cy, rx, ry, cor, s, qtd = 7) {
  const r = semear('pinta' + s);
  for (let i = 0; i < qtd; i++) {
    const a = (i / qtd) * Math.PI * 2 + (r % 10) * 0.1;
    const d = 0.35 + ((r >> i) & 3) * 0.15;
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    const t = 3 + ((r >> (i * 2)) & 3);
    circulo(ctx, x, y, t, { cor: null, preenche: cor, semente: s + i * 7 });
  }
}

/** Listras (abelha, tigre). */
export function listras(ctx, cx, cy, rx, ry, cor, s, qtd = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < qtd; i++) {
    const x = cx - rx + ((i + 1) * (rx * 2)) / (qtd + 1);
    forma(ctx, [[x - rx * 0.13, cy - ry], [x + rx * 0.13, cy - ry], [x + rx * 0.13, cy + ry], [x - rx * 0.13, cy + ry]], {
      cor: null,
      preenche: cor,
      semente: s + i * 3,
    });
  }
  ctx.restore();
}

/** Asa de pássaro/inseto. */
export function asa(ctx, x, y, comprimento, altura, cor, s, giro = 0, alfa = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.globalAlpha *= alfa;
  forma(ctx, [[0, 0], [comprimento * 0.45, -altura], [comprimento, -altura * 0.35], [comprimento * 0.7, altura * 0.35], [comprimento * 0.2, altura * 0.3]], {
    ...CONTORNO,
    largura: 2.2,
    preenche: cor,
    semente: s,
  });
  ctx.restore();
}

/** Dentes de serra numa boca aberta. */
export function dentes(ctx, x1, y, x2, altura, s, paraBaixo = true) {
  const n = Math.max(3, Math.round((x2 - x1) / 9));
  const passo = (x2 - x1) / n;
  for (let i = 0; i < n; i++) {
    const x = x1 + i * passo;
    const p = paraBaixo
      ? [[x, y], [x + passo, y], [x + passo / 2, y + altura]]
      : [[x, y], [x + passo, y], [x + passo / 2, y - altura]];
    forma(ctx, p, { cor: TINTA, largura: 1.6, preenche: '#f7f2e7', semente: s + i * 5 });
  }
}

/** Chifre curvo. */
export function chifre(ctx, x, y, comprimento, cor, s, giro = -0.6) {
  const p = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const a = giro - t * 1.1;
    p.push([x + Math.cos(a) * comprimento * t, y + Math.sin(a) * comprimento * t]);
  }
  cauda(ctx, p, 8 - 4, cor, s);
}
