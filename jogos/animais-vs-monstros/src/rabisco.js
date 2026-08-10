// Motor de desenho "à mão livre": tudo no jogo é desenhado com estas funções.
//
// A ideia é simples — nenhuma linha é reta e nenhum círculo é redondo. Cada
// traço ganha um desvio pseudoaleatório e é desenhado duas vezes, como caneta
// que passa por cima do próprio risco. O desvio vem de um PRNG com semente, e
// não de Math.random(), por dois motivos: a forma fica igual entre um quadro e
// outro (senão tudo ferve na tela) e o mesmo bicho sai idêntico toda vez.
//
// Para "animar" o desenho existe a semente de tempo (veja `quadroAnimado`): ela
// troca poucas vezes por segundo, dando aquele tremido de animação feita em
// papel — de propósito, e só nos personagens.

export const FONTE = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Segoe Print", system-ui, sans-serif';

/** PRNG mulberry32: rápido, determinístico e bom o bastante para tremer traço. */
export function rng(semente) {
  let a = (semente | 0) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de string para semente — deixa nomear a semente ("onca-corpo"). */
export function semear(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Semente que troca ~7x por segundo: o tremido de animação desenhada à mão. */
export function quadroAnimado(tempo, passos = 3) {
  return Math.floor(tempo * 7) % passos;
}

// ---------------------------------------------------------------- primitivas

/** Traça uma linha torta de (x1,y1) a (x2,y2) no path atual. */
function tracar(ctx, x1, y1, x2, y2, r, rugosidade) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const comprimento = Math.hypot(dx, dy);
  const d = Math.min(rugosidade, comprimento / 8 + rugosidade * 0.4);
  const off = () => (r() * 2 - 1) * d;

  ctx.moveTo(x1 + off() * 0.5, y1 + off() * 0.5);
  ctx.quadraticCurveTo(x1 + dx * 0.5 + off(), y1 + dy * 0.5 + off(), x2 + off() * 0.5, y2 + off() * 0.5);
}

/** Monta o path de uma sequência de pontos, torto. */
function caminho(ctx, pontos, r, rugosidade, fechado) {
  if (pontos.length < 2) return;
  const d = rugosidade;
  const off = () => (r() * 2 - 1) * d;

  ctx.moveTo(pontos[0][0] + off(), pontos[0][1] + off());
  for (let i = 1; i < pontos.length; i++) {
    const [px, py] = pontos[i - 1];
    const [x, y] = pontos[i];
    ctx.quadraticCurveTo((px + x) / 2 + off(), (py + y) / 2 + off(), x + off() * 0.6, y + off() * 0.6);
  }
  if (fechado) {
    const [px, py] = pontos[pontos.length - 1];
    const [x, y] = pontos[0];
    ctx.quadraticCurveTo((px + x) / 2 + off(), (py + y) / 2 + off(), x, y);
    ctx.closePath();
  }
}

/**
 * Desenha uma forma fechada a partir de pontos.
 * opts: { cor, largura, preenche, semente, rugosidade, passadas, alfa }
 */
export function forma(ctx, pontos, opts = {}) {
  const {
    cor = '#2b2622',
    largura = 2.4,
    preenche = null,
    semente = 1,
    rugosidade = 1.6,
    passadas = 2,
    alfa = 1,
  } = opts;

  ctx.save();
  ctx.globalAlpha *= alfa;

  if (preenche) {
    const r = rng(semente);
    ctx.beginPath();
    caminho(ctx, pontos, r, rugosidade * 0.7, true);
    ctx.fillStyle = preenche;
    ctx.fill();
  }

  if (cor) {
    ctx.strokeStyle = cor;
    ctx.lineWidth = largura;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let p = 0; p < passadas; p++) {
      const r = rng(semente + p * 977);
      ctx.beginPath();
      caminho(ctx, pontos, r, rugosidade, true);
      ctx.globalAlpha *= p === 0 ? 1 : 0.55;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Linha solta (não fecha). */
export function linha(ctx, x1, y1, x2, y2, opts = {}) {
  const { cor = '#2b2622', largura = 2.4, semente = 1, rugosidade = 1.5, passadas = 2, alfa = 1 } = opts;
  ctx.save();
  ctx.globalAlpha *= alfa;
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';
  for (let p = 0; p < passadas; p++) {
    const r = rng(semente + p * 613);
    ctx.beginPath();
    tracar(ctx, x1, y1, x2, y2, r, rugosidade);
    ctx.globalAlpha *= p === 0 ? 1 : 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Curva por vários pontos, aberta. */
export function traco(ctx, pontos, opts = {}) {
  const { cor = '#2b2622', largura = 2.4, semente = 1, rugosidade = 1.5, passadas = 2, alfa = 1 } = opts;
  ctx.save();
  ctx.globalAlpha *= alfa;
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let p = 0; p < passadas; p++) {
    const r = rng(semente + p * 331);
    ctx.beginPath();
    caminho(ctx, pontos, r, rugosidade, false);
    ctx.globalAlpha *= p === 0 ? 1 : 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Pontos de uma elipse — base de quase todo bicho deste jogo. */
export function pontosElipse(cx, cy, rx, ry, lados = 14, giro = 0) {
  const pontos = [];
  for (let i = 0; i < lados; i++) {
    const a = giro + (i / lados) * Math.PI * 2;
    pontos.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pontos;
}

export function elipse(ctx, cx, cy, rx, ry, opts = {}) {
  const lados = Math.max(8, Math.round((rx + ry) / 4));
  forma(ctx, pontosElipse(cx, cy, rx, ry, Math.min(lados, 20), opts.giro || 0), opts);
}

export function circulo(ctx, cx, cy, r, opts = {}) {
  elipse(ctx, cx, cy, r, r, opts);
}

export function retangulo(ctx, x, y, w, h, opts = {}) {
  forma(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], opts);
}

/** Retângulo com cantos arredondados, útil para cartas e caixas de texto. */
export function caixa(ctx, x, y, w, h, raio, opts = {}) {
  const k = Math.min(raio, w / 2, h / 2);
  const pontos = [
    [x + k, y], [x + w - k, y], [x + w, y + k],
    [x + w, y + h - k], [x + w - k, y + h], [x + k, y + h],
    [x, y + h - k], [x, y + k],
  ];
  forma(ctx, pontos, opts);
}

/** Hachura paralela dentro de um retângulo — sombreado de lápis. */
export function hachura(ctx, x, y, w, h, opts = {}) {
  const { cor = '#2b2622', largura = 1.4, semente = 7, espaco = 7, angulo = -Math.PI / 4, alfa = 0.5 } = opts;
  const r = rng(semente);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha *= alfa;
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';

  const diag = Math.hypot(w, h);
  const dx = Math.cos(angulo);
  const dy = Math.sin(angulo);
  const cx = x + w / 2;
  const cy = y + h / 2;

  for (let d = -diag / 2; d <= diag / 2; d += espaco) {
    const mx = cx - dy * d;
    const my = cy + dx * d;
    ctx.beginPath();
    tracar(ctx, mx - dx * diag * 0.5, my - dy * diag * 0.5, mx + dx * diag * 0.5, my + dy * diag * 0.5, r, 2);
    ctx.stroke();
  }
  ctx.restore();
}

// -------------------------------------------------------------------- texto

/**
 * Texto no estilo do jogo. `contorno` desenha um traço claro por baixo para o
 * texto sobreviver a qualquer fundo.
 */
export function texto(ctx, txt, x, y, opts = {}) {
  const {
    tamanho = 20,
    cor = '#2b2622',
    alinha = 'left',
    base = 'alphabetic',
    peso = '700',
    contorno = null,
    larguraContorno = 4,
    alfa = 1,
    inclina = 0,
  } = opts;

  ctx.save();
  ctx.globalAlpha *= alfa;
  ctx.font = `${peso} ${tamanho}px ${FONTE}`;
  ctx.textAlign = alinha;
  ctx.textBaseline = base;

  if (inclina) {
    ctx.translate(x, y);
    ctx.rotate(inclina);
    x = 0;
    y = 0;
  }

  if (contorno) {
    ctx.lineWidth = larguraContorno;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = contorno;
    ctx.strokeText(txt, x, y);
  }
  ctx.fillStyle = cor;
  ctx.fillText(txt, x, y);
  ctx.restore();
}

/** Mede o texto com a fonte do jogo. */
export function medirTexto(ctx, txt, tamanho = 20, peso = '700') {
  ctx.save();
  ctx.font = `${peso} ${tamanho}px ${FONTE}`;
  const m = ctx.measureText(txt).width;
  ctx.restore();
  return m;
}

/** Quebra o texto em linhas que cabem em `largura`. */
export function quebrarTexto(ctx, txt, largura, tamanho = 20, peso = '700') {
  const palavras = txt.split(' ');
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? atual + ' ' + p : p;
    if (medirTexto(ctx, teste, tamanho, peso) > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// ------------------------------------------------------------------- cenário

/** Textura de papel: fibra, manchas e um leve vinhetado. */
export function papel(ctx, w, h, opts = {}) {
  const { base = '#f2e8d5', semente = 42, manchas = 26 } = opts;
  const r = rng(semente);

  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // manchas de café / envelhecimento
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < manchas; i++) {
    const x = r() * w;
    const y = r() * h;
    const raio = 30 + r() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
    const t = 0.02 + r() * 0.05;
    g.addColorStop(0, `rgba(160, 130, 90, ${t})`);
    g.addColorStop(1, 'rgba(160, 130, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
  }

  // fibras do papel
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#7a6444';
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = r() * w;
    const y = r() * h;
    const c = 8 + r() * 26;
    const a = r() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * c, y + Math.sin(a) * c);
    ctx.stroke();
  }
  ctx.restore();
}

/** Sombra macia no chão, para o bicho não parecer flutuando. */
export function sombra(ctx, cx, cy, rx, ry, alfa = 0.3) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, `rgba(24, 30, 16, ${alfa})`);
  g.addColorStop(0.65, `rgba(24, 30, 16, ${alfa * 0.7})`);
  g.addColorStop(1, 'rgba(24, 30, 16, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Dá volume ao que já está pintado: luz em cima, sombra embaixo e um brilho
 * no ombro esquerdo. Vale para o sprite inteiro de uma vez — `source-atop` só
 * pinta onde já existe desenho, então a silhueta não vaza.
 *
 * É o que separa o boneco chapado do boneco que parece ter corpo. Chame no fim
 * do desenho, depois de todos os traços.
 */
export function volume(ctx, w, h, forca = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';

  // A sombra é fraca de propósito e só entra no terço de baixo: passar disso
  // suja a cor da criatura e todo mundo vira marrom.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(255, 252, 240, ${0.26 * forca})`);
  g.addColorStop(0.4, 'rgba(255, 252, 240, 0)');
  g.addColorStop(0.72, 'rgba(40, 26, 16, 0)');
  g.addColorStop(1, `rgba(40, 26, 16, ${0.17 * forca})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // brilho especular: o toque que faz o bicho parecer polido
  const b = ctx.createRadialGradient(w * 0.36, h * 0.26, 0, w * 0.36, h * 0.26, w * 0.46);
  b.addColorStop(0, `rgba(255, 255, 255, ${0.26 * forca})`);
  b.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

// -------------------------------------------------------------- cache sprite

const cache = new Map();

/**
 * Desenha uma vez num canvas fora da tela e reusa. Sem isso, redesenhar 40
 * bichos rabiscados por quadro derruba o fps — cada traço aqui são duas
 * passadas de curva de Bézier.
 */
export function sprite(chave, largura, altura, pintar) {
  let c = cache.get(chave);
  if (c) return c;

  c = document.createElement('canvas');
  c.width = Math.ceil(largura);
  c.height = Math.ceil(altura);
  const ctx = c.getContext('2d');
  pintar(ctx, c.width, c.height);
  cache.set(chave, c);
  return c;
}

/** Desenha um sprite cacheado centrado em (x, y), com escala e espelho. */
export function porSprite(ctx, spr, x, y, escala = 1, espelha = false, alfa = 1) {
  ctx.save();
  ctx.globalAlpha *= alfa;
  ctx.translate(x, y);
  if (espelha) ctx.scale(-1, 1);
  ctx.scale(escala, escala);
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.restore();
}

export function limparCache() {
  cache.clear();
}
