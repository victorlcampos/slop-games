// O mini filme de abertura, em seis cenas.
//
// O roteiro existe para justificar a mecânica: os monstros são as lendas de
// cada povo, os humanos travam de medo porque cresceram ouvindo essas
// histórias, e os bichos são imunes porque ninguém nunca contou nada a eles.
// Daí a campanha ser país a país, com o folclore local como inimigo.

import { forma, elipse, circulo, linha, traco, caixa, texto, quebrarTexto, pontosElipse, porSprite, rng, papel } from '../rabisco.js';
import { TINTA, TINTA_FRACA, CORES, PAPEL, tom, alfa } from '../paleta.js';
import { spriteAnimal } from '../desenho/animais.js';
import { spriteMonstro } from '../desenho/monstros.js';
import { mapaCacheado, projetar, PAISES } from '../desenho/mundo.js';
import { vp, ALTURA, aplicarMoldura, pontoNaMoldura, larguraMenu } from '../viewport.js';
import { som } from '../audio.js';


// Largura da prancheta onde as cenas foram compostas. Atualizada a cada quadro
// por `desenhar`, porque as cenas são objetos de módulo e não enxergam o
// escopo de criarCutscene.
let MENU_L = 1280;

/** Silhueta humana parada — a imagem do medo que paralisa. */
function humano(ctx, x, yBase, altura, cor, s) {
  const k = altura / 100;
  circulo(ctx, x, yBase - 84 * k, 11 * k, { cor: null, preenche: cor, semente: s });
  forma(ctx, [[x - 12 * k, yBase - 72 * k], [x + 12 * k, yBase - 72 * k], [x + 10 * k, yBase - 34 * k], [x - 10 * k, yBase - 34 * k]], {
    cor: null, preenche: cor, semente: s + 1,
  });
  traco(ctx, [[x - 7 * k, yBase - 34 * k], [x - 8 * k, yBase]], { cor, largura: 7 * k, passadas: 1, semente: s + 2 });
  traco(ctx, [[x + 7 * k, yBase - 34 * k], [x + 8 * k, yBase]], { cor, largura: 7 * k, passadas: 1, semente: s + 3 });
  traco(ctx, [[x - 12 * k, yBase - 68 * k], [x - 20 * k, yBase - 42 * k]], { cor, largura: 6 * k, passadas: 1, semente: s + 4 });
  traco(ctx, [[x + 12 * k, yBase - 68 * k], [x + 20 * k, yBase - 42 * k]], { cor, largura: 6 * k, passadas: 1, semente: s + 5 });
}

function morrosSimples(ctx, w, yBase, cor, s, altura, n = 5) {
  const r = rng(s);
  for (let i = 0; i < n; i++) {
    const cx = (i / (n - 1)) * w + (r() - 0.5) * 100;
    forma(ctx, pontosElipse(cx, yBase, 170 + r() * 130, altura * (0.6 + r() * 0.7), 12), {
      cor: tom(cor, -0.3), largura: 2.4, preenche: cor, semente: s + i * 13,
    });
  }
}

function arvoreSilhueta(ctx, x, yBase, altura, cor, s) {
  traco(ctx, [[x, yBase], [x, yBase - altura * 0.55]], { cor, largura: altura * 0.09, passadas: 1, semente: s });
  const r = rng(s + 5);
  for (let i = 0; i < 4; i++) {
    circulo(ctx, x + (r() - 0.5) * altura * 0.4, yBase - altura * (0.62 + r() * 0.3), altura * (0.2 + r() * 0.14), {
      cor: null, preenche: cor, semente: s + i * 9,
    });
  }
}

// -------------------------------------------------------------------- cenas

const CENAS = [
  {
    duracao: 8,
    fala:
      'Durante muito tempo, o mundo foi um lugar comum. As pessoas contavam histórias para assustar as crianças, e as crianças cresciam sabendo que eram só histórias.',
    desenhar(ctx, t) {
      // amanhecer na mata
      const g = ctx.createLinearGradient(0, 0, 0, ALTURA);
      g.addColorStop(0, '#f2c27a');
      g.addColorStop(0.45, '#f7dfae');
      g.addColorStop(1, '#cfd9a0');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);

      const solY = 300 - t * 40;
      circulo(ctx, MENU_L * 0.72, solY, 62, { cor: '#e8a54c', largura: 3, preenche: '#f7e2a0', semente: 3 });

      morrosSimples(ctx, vp.L, 470, '#8fa862', 11, 90, 4);
      morrosSimples(ctx, vp.L, 520, '#6f8f4c', 23, 80, 5);
      ctx.fillStyle = '#7d9a54';
      ctx.fillRect(-vp.L, 500, vp.L * 3, ALTURA - 500 + ALTURA);

      for (let i = 0; i < 6; i++) arvoreSilhueta(ctx, 60 + i * 230, 540, 190, '#4f7a3a', 40 + i * 17);

      // bichos pastando, tranquilos
      const bichos = ['esquilo', 'macaco', 'tartaruga', 'onca'];
      bichos.forEach((id, i) => {
        const x = 190 + i * 290;
        const y = 620 + Math.sin(t * 1.5 + i) * 3;
        porSprite(ctx, spriteAnimal(id, 128), x, y, 0.8);
      });

      // pássaros ao longe
      for (let i = 0; i < 5; i++) {
        const bx = ((t * 30 + i * 120) % (MENU_L + 100)) - 50;
        const by = 150 + i * 26 + Math.sin(t * 2 + i) * 8;
        traco(ctx, [[bx - 10, by], [bx, by - 5], [bx + 10, by]], { cor: alfa(TINTA, 0.5), largura: 2, passadas: 1, semente: 90 + i });
      }
    },
  },

  {
    duracao: 7,
    fala: 'Até a noite em que elas se cansaram de ser só histórias.',
    desenhar(ctx, t) {
      const g = ctx.createLinearGradient(0, 0, 0, ALTURA);
      g.addColorStop(0, '#1a1730');
      g.addColorStop(0.6, '#39294a');
      g.addColorStop(1, '#4a3140');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);

      const r = rng(7);
      for (let i = 0; i < 70; i++) {
        circulo(ctx, r() * vp.L, r() * 420, r() * 1.8 + 0.6, { cor: null, preenche: alfa('#f2ead0', 0.5), semente: 100 + i });
      }

      // a fenda no céu: abre com o tempo
      const abertura = Math.min(1, t / 3.5);
      const cx = MENU_L / 2;
      const pontos = [];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const p = i / n;
        const y = 40 + p * 320;
        const larg = Math.sin(p * Math.PI) * 90 * abertura;
        pontos.push([cx + larg + Math.sin(p * 9) * 14, y]);
      }
      for (let i = n; i >= 0; i--) {
        const p = i / n;
        const y = 40 + p * 320;
        const larg = Math.sin(p * Math.PI) * 90 * abertura;
        pontos.push([cx - larg + Math.sin(p * 9) * 14, y]);
      }
      forma(ctx, pontos, { cor: '#e8703a', largura: 4, preenche: '#f7d451', semente: 5, alfa: 0.95 });
      forma(ctx, pontos.map(([x, y]) => [cx + (x - cx) * 0.5, y]), { cor: null, preenche: '#fff6d0', semente: 6, alfa: 0.9 });

      // luz derramando no chão
      const luz = ctx.createRadialGradient(cx, 360, 20, cx, 460, 460);
      luz.addColorStop(0, `rgba(247, 212, 81, ${0.4 * abertura})`);
      luz.addColorStop(1, 'rgba(247, 212, 81, 0)');
      ctx.fillStyle = luz;
      ctx.fillRect(-vp.L, 120, vp.L * 3, ALTURA - 120 + ALTURA);

      ctx.fillStyle = '#241f2e';
      ctx.fillRect(-vp.L, 560, vp.L * 3, ALTURA - 560 + ALTURA);
      for (let i = 0; i < 6; i++) arvoreSilhueta(ctx, 40 + i * 250, 590, 170, '#151222', 60 + i * 11);

      // as lendas subindo da terra
      const saindo = Math.max(0, (t - 2.5) / 4);
      const elenco = ['corposeco', 'saci', 'curupira', 'mula', 'lobisomem'];
      elenco.forEach((id, i) => {
        const sobe = Math.min(1, saindo * (1 + i * 0.2));
        if (sobe <= 0) return;
        const x = 150 + i * 250;
        const y = 700 - sobe * 110;
        ctx.save();
        ctx.globalAlpha = Math.min(1, sobe * 1.6);
        porSprite(ctx, spriteMonstro(id, 128), x, y, 0.9);
        ctx.restore();
      });
    },
  },

  {
    duracao: 9,
    fala:
      'Não foi uma guerra. Foi mais rápido que isso. Quem cresceu ouvindo o nome daquilo travava na hora de correr — e ficava ali, de olhos abertos, sem conseguir mexer um dedo.',
    desenhar(ctx, t) {
      const g = ctx.createLinearGradient(0, 0, 0, ALTURA);
      g.addColorStop(0, '#5b4a52');
      g.addColorStop(1, '#8a7566');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);

      // cidade
      let x = -20;
      let i = 0;
      while (x < vp.L) {
        const lg = 80 + ((i * 37) % 70);
        const alt = 180 + ((i * 53) % 190);
        forma(ctx, [[x, 520], [x, 520 - alt], [x + lg, 520 - alt], [x + lg, 520]], {
          cor: TINTA, largura: 2.6, preenche: ['#6f6a66', '#7d7671', '#615c58'][i % 3], semente: 200 + i,
        });
        x += lg + 8;
        i++;
      }
      ctx.fillStyle = '#575350';
      ctx.fillRect(-vp.L, 500, vp.L * 3, ALTURA - 500 + ALTURA);

      // humanos paralisados, imóveis mesmo — nada de balanço aqui
      const pessoas = [180, 330, 520, 760, 940, 1120];
      pessoas.forEach((px, j) => {
        humano(ctx, px, 640 + (j % 3) * 18, 120, '#3f3a38', 300 + j * 7);
        // olhos arregalados: dois pontinhos claros
        const k = 1.2;
        circulo(ctx, px - 4 * k, 640 + (j % 3) * 18 - 86 * 1.2, 2.2, { cor: null, preenche: '#f2ead0', semente: 320 + j });
        circulo(ctx, px + 4 * k, 640 + (j % 3) * 18 - 86 * 1.2, 2.2, { cor: null, preenche: '#f2ead0', semente: 321 + j });
      });

      // monstros circulando entre eles
      const passeio = t * 26;
      ['iara', 'bichopapao', 'mapinguari'].forEach((id, j) => {
        const mx = ((passeio + j * 430) % (MENU_L + 260)) - 130;
        porSprite(ctx, spriteMonstro(id, 128), mx, 600 + j * 30, 1.05);
      });

      // o mundo perdendo a cor
      ctx.fillStyle = `rgba(30, 26, 34, ${Math.min(0.45, t * 0.06)})`;
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);
    },
  },

  {
    duracao: 8,
    fala:
      'Em três dias, cada país estava tomado pelos seus próprios monstros. Cada povo, preso exatamente por aquilo que ele mesmo inventou.',
    desenhar(ctx, t) {
      ctx.fillStyle = '#1e2230';
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);

      const mw = 1080;
      const mh = 540;
      const mx = (MENU_L - mw) / 2;
      const my = 90;
      ctx.drawImage(mapaCacheado(mw, mh, { tomado: false, corMar: '#33465c' }), mx, my);

      // as manchas tomando o mundo, uma a uma
      const total = PAISES.length;
      PAISES.forEach((p, i) => {
        const quando = 0.6 + i * 0.85;
        if (t < quando) return;
        const idade = Math.min(1, (t - quando) / 1.2);
        const [px, py] = projetar(p.lon, p.lat, mx, my, mw, mh);
        const raio = 26 + idade * 70;
        const g = ctx.createRadialGradient(px, py, 4, px, py, raio);
        g.addColorStop(0, `rgba(120, 40, 70, ${0.75 * idade})`);
        g.addColorStop(1, 'rgba(120, 40, 70, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, raio, 0, Math.PI * 2);
        ctx.fill();
        circulo(ctx, px, py, 7, { cor: '#f2c94c', largura: 2, preenche: '#c1503f', semente: 500 + i, alfa: idade });
      });

      // véu geral no fim da cena
      const veu = Math.max(0, (t - 5.5) / 2.5);
      ctx.fillStyle = `rgba(90, 24, 52, ${veu * 0.45})`;
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);
    },
  },

  {
    duracao: 10,
    fala:
      'Mas ninguém nunca contou essas histórias para os bichos. Um tatu não sabe o que é uma Cuca. Uma abelha nunca ouviu falar de lobisomem. E não dá para paralisar de medo quem nunca aprendeu a ter.',
    desenhar(ctx, t) {
      ctx.fillStyle = '#10131a';
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);

      // mata escura
      for (let camada = 0; camada < 3; camada++) {
        const cor = ['#151a20', '#1a2028', '#202832'][camada];
        for (let i = 0; i < 8 - camada; i++) {
          arvoreSilhueta(ctx, 20 + i * (MENU_L / (7 - camada)) + camada * 50, 560 + camada * 40, 260 - camada * 40, cor, 600 + camada * 20 + i);
        }
      }

      // primeiro só os olhos, no escuro
      const pares = [
        [190, 470], [340, 520], [520, 460], [700, 510], [880, 470], [1060, 520], [430, 580], [790, 590],
      ];
      const brilho = Math.min(1, t / 2.2);
      const revela = Math.max(0, (t - 4) / 3);
      pares.forEach(([px, py], i) => {
        const pisca = Math.sin(t * 3 + i * 2) > -0.85 ? 1 : 0.1;
        ctx.save();
        ctx.globalAlpha = brilho * pisca * (1 - revela);
        circulo(ctx, px - 9, py, 5, { cor: null, preenche: '#f2c94c', semente: 700 + i });
        circulo(ctx, px + 9, py, 5, { cor: null, preenche: '#f2c94c', semente: 710 + i });
        ctx.restore();
      });

      // e então eles saem da mata
      if (revela > 0) {
        const elenco = ['leao', 'elefante', 'aguia', 'ursopolar', 'canguru', 'jacare', 'coruja', 'abelha'];
        elenco.forEach((id, i) => {
          const [px, py] = pares[i];
          ctx.save();
          ctx.globalAlpha = Math.min(1, revela * 1.4);
          porSprite(ctx, spriteAnimal(id, 128), px, py + 40 - revela * 8, 0.85);
          ctx.restore();
        });
        const luz = ctx.createRadialGradient(MENU_L / 2, 480, 40, MENU_L / 2, 480, 620);
        luz.addColorStop(0, `rgba(242, 201, 76, ${0.14 * revela})`);
        luz.addColorStop(1, 'rgba(242, 201, 76, 0)');
        ctx.fillStyle = luz;
        ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);
      }
    },
  },

  {
    duracao: 9,
    fala: 'Eles vieram de toda parte. E escolheram começar por aqui.',
    titulo: true,
    desenhar(ctx, t) {
      const g = ctx.createLinearGradient(0, 0, 0, ALTURA);
      g.addColorStop(0, '#2d3a52');
      g.addColorStop(0.5, '#c98f5a');
      g.addColorStop(1, '#e8c58a');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);

      circulo(ctx, MENU_L * 0.5, 430, 90, { cor: '#e8a54c', largura: 3, preenche: '#f7e2a0', semente: 800, alfa: 0.9 });
      morrosSimples(ctx, vp.L, 520, '#8a6a4a', 810, 70, 4);
      ctx.fillStyle = '#7a5c40';
      ctx.fillRect(-vp.L, 500, vp.L * 3, ALTURA - 500 + ALTURA);

      // o esquadrão, de costas, olhando o horizonte
      const elenco = ['elefante', 'leao', 'onca', 'ursopolar', 'canguru', 'aguia', 'macaco', 'tartaruga', 'coruja'];
      elenco.forEach((id, i) => {
        const x = 110 + i * 132;
        const y = 600 + (i % 2) * 26;
        const entra = Math.min(1, Math.max(0, (t - 0.3 - i * 0.16) / 0.7));
        if (entra <= 0) return;
        ctx.save();
        ctx.globalAlpha = entra;
        // de costas = espelhados, olhando para dentro do quadro
        porSprite(ctx, spriteAnimal(id, 128), x, y + (1 - entra) * 40, 0.78, true);
        ctx.restore();
      });

      // título
      const tt = Math.max(0, Math.min(1, (t - 3.5) / 1.4));
      if (tt > 0) {
        ctx.save();
        ctx.globalAlpha = tt;
        texto(ctx, 'ANIMAIS', MENU_L / 2, 190 - (1 - tt) * 20, {
          tamanho: 84, alinha: 'center', cor: '#f7e9c8', contorno: TINTA, larguraContorno: 10,
        });
        texto(ctx, 'vs', MENU_L / 2, 240, { tamanho: 34, alinha: 'center', cor: '#f2c94c', contorno: TINTA, larguraContorno: 6 });
        texto(ctx, 'MONSTROS', MENU_L / 2, 320, {
          tamanho: 84, alinha: 'center', cor: '#e8a08a', contorno: TINTA, larguraContorno: 10,
        });
        ctx.restore();
      }
      const st = Math.max(0, Math.min(1, (t - 5.5) / 1.2));
      if (st > 0) {
        texto(ctx, '🇧🇷  A resistência começa no Brasil', MENU_L / 2, 380, {
          tamanho: 27, alinha: 'center', cor: PAPEL, contorno: TINTA, larguraContorno: 5, alfa: st,
        });
      }
    },
  },
];

/**
 * Cria a abertura. `aoTerminar()` dispara no fim ou quando o jogador pula.
 */
export function criarCutscene(aoTerminar) {
  let cena = 0;
  let t = 0;
  let saindo = 0;
  let acabou = false;

  const FADE = 0.7;

  function avancar() {
    if (acabou) return;
    if (cena >= CENAS.length - 1) {
      terminar();
      return;
    }
    cena++;
    t = 0;
    som.clique();
  }

  function terminar() {
    if (acabou) return;
    acabou = true;
    aoTerminar();
  }

  function atualizar(dt) {
    if (acabou) return;
    t += dt;
    if (t >= CENAS[cena].duracao) {
      if (cena >= CENAS.length - 1) terminar();
      else {
        cena++;
        t = 0;
      }
    }
  }

  function desenhar(ctx) {
    MENU_L = larguraMenu();
    const c = CENAS[cena];
    ctx.save();
    aplicarMoldura(ctx);
    c.desenhar(ctx, t);
    ctx.restore();
    ctx.save();
    aplicarMoldura(ctx);

    // fade de entrada e de saída de cada cena
    const entrada = Math.min(1, t / FADE);
    const saida = Math.min(1, (c.duracao - t) / FADE);
    const escuro = 1 - Math.min(entrada, saida);
    if (escuro > 0.001) {
      ctx.fillStyle = `rgba(12, 10, 14, ${escuro})`;
      ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);
    }

    // legenda
    if (c.fala) {
      const linhas = quebrarTexto(ctx, c.fala, 940, 26);
      const h = 30 + linhas.length * 34;
      const y = ALTURA - h - 34;
      const ap = Math.min(1, Math.max(0, (t - 0.35) / 0.6)) * saida;
      ctx.save();
      ctx.globalAlpha = ap;
      caixa(ctx, MENU_L / 2 - 500, y, 1000, h, 14, {
        cor: TINTA, largura: 3, preenche: 'rgba(18, 15, 20, 0.72)', semente: 900 + cena,
      });
      linhas.forEach((ln, i) => {
        texto(ctx, ln, MENU_L / 2, y + 36 + i * 34, { tamanho: 26, alinha: 'center', cor: '#f2ead0' });
      });
      ctx.restore();
    }

    // pular
    texto(ctx, 'clique para avançar  ·  ESC pula a abertura', MENU_L - 24, 30, {
      tamanho: 15, alinha: 'right', cor: 'rgba(242, 234, 208, 0.65)',
    });

    // marcadores de cena
    for (let i = 0; i < CENAS.length; i++) {
      circulo(ctx, MENU_L / 2 - (CENAS.length - 1) * 9 + i * 18, ALTURA - 16, 4.5, {
        cor: null, preenche: i === cena ? '#f2c94c' : 'rgba(242, 234, 208, 0.3)', semente: 950 + i,
      });
    }
    ctx.restore();
  }

  return {
    atualizar,
    desenhar,
    clique: avancar,
    pular: terminar,
  };
}
