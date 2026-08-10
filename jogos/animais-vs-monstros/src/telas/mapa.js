// Duas telas em uma: o mundo (para escolher o país) e o país aberto (para
// escolher a fase). Por enquanto só o Brasil está liberado — os outros ficam
// visíveis de propósito, para deixar claro que a campanha continua.

import { forma, elipse, circulo, linha, traco, caixa, texto, medirTexto, quebrarTexto, papel, porSprite, pontosElipse } from '../rabisco.js';
import { TINTA, TINTA_FRACA, CORES, PAPEL, PAPEL_ESCURO, tom, alfa } from '../paleta.js';
import { mapaCacheado, projetar, PAISES } from '../desenho/mundo.js';
import { spriteMonstro } from '../desenho/monstros.js';
import { FASES, CAMPANHA, HUMANOS_BRASIL } from '../dados/fases.js';
import { vp, ALTURA, aplicarMoldura, pontoNaMoldura, larguraMenu } from '../viewport.js';
import { som } from '../audio.js';


const MAPA = { x: 100, y: 118, w: 1080, h: 430 };

/** Posições dos 10 nós da campanha, numa trilha que sobe pelo país. */
const TRILHA = [
  [170, 560], [290, 505], [400, 545], [520, 480], [640, 520],
  [760, 455], [880, 495], [990, 430], [1090, 470], [1160, 380],
];

export function criarMapa(estado, acoes) {
  let MENU_L = larguraMenu();
  let visao = estado.vencidas.length ? 'pais' : 'mundo';
  let t = 0;
  let recado = null;
  let confirmando = false;
  const botoes = [];

  function dizer(txt, cor = TINTA) {
    recado = { txt, cor, t: 3 };
  }

  function atualizar(dt) {
    t += dt;
    if (recado) {
      recado.t -= dt;
      if (recado.t <= 0) recado = null;
    }
  }

  // ------------------------------------------------------------ tela mundo

  function desenharMundo(ctx) {
    texto(ctx, 'O MUNDO TOMADO', MENU_L / 2, 62, { tamanho: 46, alinha: 'center', cor: TINTA });
    texto(ctx, 'Cada país caiu para os próprios monstros. Comece pelo que ainda tem uma fresta.', MENU_L / 2, 92, {
      tamanho: 18, alinha: 'center', cor: TINTA_FRACA,
    });

    ctx.drawImage(mapaCacheado(MAPA.w, MAPA.h, { tomado: true, corMar: '#93b0c4' }), MAPA.x, MAPA.y);
    caixa(ctx, MAPA.x, MAPA.y, MAPA.w, MAPA.h, 8, { cor: TINTA, largura: 3, semente: 5 });

    botoes.length = 0;

    for (const p of PAISES) {
      const [px, py] = projetar(p.lon, p.lat, MAPA.x, MAPA.y, MAPA.w, MAPA.h);
      const concluido = p.id === 'brasil' && estado.vencidas.length >= FASES.length;
      const pulso = 1 + Math.sin(t * 3) * 0.12;

      if (p.liberado) {
        circulo(ctx, px, py, 24 * pulso, { cor: CORES.destaque, largura: 3, alfa: 0.5, semente: 10 });
        circulo(ctx, px, py, 17, {
          cor: TINTA, largura: 3, preenche: concluido ? CORES.bom : CORES.destaque, semente: 11,
        });
        texto(ctx, p.bandeira, px, py + 7, { tamanho: 19, alinha: 'center' });
        texto(ctx, p.nome, px, py + 44, {
          tamanho: 22, alinha: 'center', cor: TINTA, contorno: PAPEL, larguraContorno: 5,
        });
        texto(ctx, concluido ? 'libertado' : `${estado.vencidas.length}/${p.fases} fases`, px, py + 66, {
          tamanho: 15, alinha: 'center', cor: TINTA_FRACA, contorno: PAPEL, larguraContorno: 4,
        });
        botoes.push({ x: px - 40, y: py - 40, w: 80, h: 80, acao: 'abrirPais' });
      } else {
        circulo(ctx, px, py, 13, { cor: '#5b4a52', largura: 2.4, preenche: '#7d6470', semente: 12 });
        texto(ctx, '🔒', px, py + 5, { tamanho: 14, alinha: 'center' });
        texto(ctx, p.nome, px, py + 34, {
          tamanho: 16, alinha: 'center', cor: '#6b5a62', contorno: alfa(PAPEL, 0.7), larguraContorno: 4,
        });
        texto(ctx, p.monstros, px, py + 52, {
          tamanho: 12, alinha: 'center', cor: '#8a7a80', contorno: alfa(PAPEL, 0.6), larguraContorno: 3,
        });
      }
    }

    // placar de humanos
    const libertados = estado.humanos;
    caixa(ctx, MENU_L / 2 - 300, ALTURA - 168, 600, 74, 12, { cor: TINTA, largura: 3, preenche: '#fbf5e6', semente: 20 });
    texto(ctx, 'HUMANOS LIBERTADOS', MENU_L / 2, ALTURA - 142, { tamanho: 15, alinha: 'center', cor: TINTA_FRACA });
    texto(ctx, `${libertados} milhões`, MENU_L / 2, ALTURA - 112, { tamanho: 32, alinha: 'center', cor: CORES.bom });
    const frac = Math.min(1, libertados / HUMANOS_BRASIL);
    ctx.fillStyle = 'rgba(43,38,34,0.15)';
    ctx.fillRect(MENU_L / 2 - 270, ALTURA - 104, 540, 8);
    ctx.fillStyle = CORES.bom;
    ctx.fillRect(MENU_L / 2 - 270, ALTURA - 104, 540 * frac, 8);

    desenharBarraInferior(ctx);
  }

  // ------------------------------------------------------------- tela país

  function desenharPais(ctx) {
    // contorno do Brasil ao fundo, bem de leve
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.drawImage(mapaCacheado(1600, 640, { tomado: false, corMar: 'rgba(0,0,0,0)' }), -380, 60);
    ctx.restore();

    texto(ctx, `${CAMPANHA.bandeira}  ${CAMPANHA.pais}`, MENU_L / 2, 60, { tamanho: 44, alinha: 'center', cor: TINTA });
    texto(ctx, 'Dez fases até a Cuca. Cada uma devolve um pedaço do país.', MENU_L / 2, 90, {
      tamanho: 18, alinha: 'center', cor: TINTA_FRACA,
    });

    botoes.length = 0;

    // a trilha ligando as fases
    const pontos = TRILHA.map(([x, y]) => [x, y]);
    traco(ctx, pontos, { cor: alfa(TINTA, 0.35), largura: 5, semente: 30 });

    FASES.forEach((f, i) => {
      const [x, y] = TRILHA[i];
      const vencida = estado.vencidas.includes(f.n);
      const disponivel = f.n === estado.faseAtual && !vencida;
      const bloqueada = !vencida && !disponivel;
      const chefe = !!f.chefe;
      const raio = chefe ? 40 : 30;

      if (disponivel) {
        circulo(ctx, x, y, raio + 10 + Math.sin(t * 3) * 4, { cor: CORES.destaque, largura: 3, alfa: 0.45, semente: 40 + i });
      }
      circulo(ctx, x, y, raio, {
        cor: TINTA,
        largura: chefe ? 4 : 3,
        preenche: vencida ? CORES.bom : disponivel ? CORES.destaque : '#b8ac96',
        semente: 50 + i,
      });

      if (chefe) {
        porSprite(ctx, spriteMonstro('cuca', 128), x, y - 2, 0.46, false, bloqueada ? 0.5 : 1);
      } else {
        texto(ctx, vencida ? '✓' : String(f.n), x, y + 9, {
          tamanho: vencida ? 30 : 26, alinha: 'center', cor: bloqueada ? '#8a7f6e' : TINTA,
        });
      }

      texto(ctx, f.nome, x, y + raio + 22, {
        tamanho: 15, alinha: 'center', cor: bloqueada ? '#8a7f6e' : TINTA, contorno: PAPEL, larguraContorno: 4,
      });

      if (!bloqueada) botoes.push({ x: x - raio, y: y - raio, w: raio * 2, h: raio * 2, acao: 'jogar', fase: f.n });
    });

    // painel da fase atual
    const atual = FASES.find((f) => f.n === estado.faseAtual) || FASES[FASES.length - 1];
    caixa(ctx, 60, 130, 470, 172, 14, { cor: TINTA, largura: 3, preenche: '#fbf5e6', semente: 60 });
    texto(ctx, `Fase ${atual.n} — ${atual.nome}`, 84, 164, { tamanho: 25, cor: TINTA });
    texto(ctx, atual.local, 84, 188, { tamanho: 15, cor: CORES.destaqueEscuro });
    quebrarTexto(ctx, atual.intro, 420, 17).slice(0, 4).forEach((ln, i) => {
      texto(ctx, ln, 84, 216 + i * 22, { tamanho: 17, cor: TINTA_FRACA });
    });

    // baralho
    caixa(ctx, MENU_L - 400, 130, 340, 92, 12, { cor: TINTA, largura: 2.6, preenche: '#fbf5e6', semente: 70 });
    texto(ctx, 'SEU BARALHO', MENU_L - 380, 158, { tamanho: 14, cor: TINTA_FRACA });
    texto(ctx, `${estado.baralho.length} cartas`, MENU_L - 380, 186, { tamanho: 24, cor: TINTA });
    texto(ctx, `🪙 ${estado.moedas}`, MENU_L - 380, 210, { tamanho: 17, cor: CORES.destaqueEscuro });

    // botão jogar
    const podeJogar = estado.vencidas.length < FASES.length;
    if (podeJogar) {
      caixa(ctx, MENU_L / 2 - 160, ALTURA - 158, 320, 66, 12, { cor: TINTA, largura: 3.4, preenche: CORES.destaque, semente: 80 });
      texto(ctx, `JOGAR FASE ${estado.faseAtual}`, MENU_L / 2, ALTURA - 115, { tamanho: 26, alinha: 'center', cor: TINTA });
      botoes.push({ x: MENU_L / 2 - 160, y: ALTURA - 158, w: 320, h: 66, acao: 'jogar', fase: estado.faseAtual });
    } else {
      texto(ctx, '🎉 Brasil libertado. Os outros países vêm aí.', MENU_L / 2, ALTURA - 122, {
        tamanho: 24, alinha: 'center', cor: CORES.bom,
      });
    }

    // voltar ao mundo
    caixa(ctx, 34, 34, 148, 54, 10, { cor: TINTA, largura: 2.6, preenche: PAPEL_ESCURO, semente: 90 });
    texto(ctx, '← mundo', 108, 68, { tamanho: 19, alinha: 'center', cor: TINTA });
    botoes.push({ x: 34, y: 34, w: 148, h: 54, acao: 'mundo' });

    desenharBarraInferior(ctx);
  }

  // -------------------------------------------------------- barra de baixo

  function desenharBarraInferior(ctx) {
    // 56px de altura: no celular deitado isso dá ~37pt de alvo, contra os 25pt
    // de antes — abaixo disso o dedo erra o botão
    const alt = 56;
    const y = ALTURA - alt - 14;
    const itens = [
      { rot: '💾 baixar save', acao: 'baixar', larg: 186 },
      { rot: '📂 carregar', acao: 'carregar', larg: 158 },
      { rot: acoes.somLigado() ? '🔊 som' : '🔇 som', acao: 'som', larg: 118 },
      { rot: '🎬 rever abertura', acao: 'abertura', larg: 208 },
      // o destrutivo fica por último e sem cor de destaque: quem procura, acha;
      // quem está passando o dedo pela barra, não esbarra
      { rot: '🔄 recomeçar', acao: 'recomecar', larg: 168, discreto: true },
    ];
    let x = 40;
    for (const it of itens) {
      caixa(ctx, x, y, it.larg, alt, 10, {
        cor: it.discreto ? TINTA_FRACA : TINTA,
        largura: 2.6,
        preenche: it.discreto ? '#e8dfcb' : '#f7f0df',
        semente: 100 + x,
      });
      texto(ctx, it.rot, x + it.larg / 2, y + alt / 2 + 6, {
        tamanho: 17, alinha: 'center', cor: it.discreto ? TINTA_FRACA : TINTA,
      });
      botoes.push({ x, y, w: it.larg, h: alt, acao: it.acao });
      x += it.larg + 12;
    }

    if (recado) {
      texto(ctx, recado.txt, MENU_L - 40, y + 9, {
        tamanho: 17, alinha: 'right', cor: recado.cor, alfa: Math.min(1, recado.t),
      });
    }
  }

  // ------------------------------------------------- confirmar recomeço

  /**
   * Apagar progresso é a única ação daqui que não dá para desfazer, então o
   * diálogo diz de cabeça erguida o que se perde e lembra que existe um save
   * para baixar antes. Nada de "tem certeza?" sem número nenhum.
   */
  function desenharConfirmacao(ctx) {
    // véu sobre a tela inteira (o translate já está aplicado)
    ctx.fillStyle = 'rgba(28, 22, 18, 0.72)';
    ctx.fillRect(-vp.L, -ALTURA, vp.L * 3, ALTURA * 3);

    const w = 640;
    const h = 410;
    const x = MENU_L / 2 - w / 2;
    const y = ALTURA / 2 - h / 2;

    caixa(ctx, x, y, w, h, 18, { cor: TINTA, largura: 4, preenche: '#fbf5e6', semente: 900 });
    texto(ctx, 'Recomeçar do zero?', MENU_L / 2, y + 56, { tamanho: 34, alinha: 'center', cor: TINTA });

    const perdas = [
      [`${estado.vencidas.length} de ${FASES.length}`, 'fases vencidas'],
      [`${estado.baralho.length}`, 'cartas no baralho'],
      [`🪙 ${estado.moedas}`, 'moedas'],
      [`${estado.humanos} mi`, 'humanos libertados'],
    ];
    perdas.forEach(([valor, rot], i) => {
      const cx = x + 44 + i * ((w - 88) / 4);
      const cw = (w - 88) / 4 - 10;
      caixa(ctx, cx, y + 82, cw, 68, 8, { cor: TINTA_FRACA, largura: 2, preenche: '#f2e8d2', semente: 910 + i });
      texto(ctx, valor, cx + cw / 2, y + 112, { tamanho: 21, alinha: 'center', cor: CORES.perigo });
      texto(ctx, rot, cx + cw / 2, y + 134, { tamanho: 11, alinha: 'center', cor: TINTA_FRACA });
    });

    quebrarTexto(ctx, 'Isto apaga o progresso guardado neste navegador e a campanha volta ao começo. Se quiser guardar onde está, cancele e use "baixar save" antes.', w - 80, 17)
      .forEach((ln, i) => {
        texto(ctx, ln, MENU_L / 2, y + 186 + i * 24, { tamanho: 17, alinha: 'center', cor: TINTA_FRACA });
      });

    // Cancelar vem primeiro e com destaque: é a saída provável de quem clicou
    // sem querer. O botão que apaga é o vermelho, à direita. 74 de altura para
    // dar ~40pt de alvo no celular deitado.
    const bh = 74;
    const by = y + h - bh - 24;
    caixa(ctx, x + 44, by, 250, bh, 12, { cor: TINTA, largura: 3.2, preenche: CORES.destaque, semente: 930 });
    texto(ctx, 'CANCELAR', x + 44 + 125, by + bh / 2 + 8, { tamanho: 21, alinha: 'center', cor: TINTA });
    botoes.push({ x: x + 44, y: by, w: 250, h: bh, acao: 'cancelarRecomeco' });

    caixa(ctx, x + w - 294, by, 250, bh, 12, { cor: TINTA, largura: 3.2, preenche: '#d98a78', semente: 940 });
    texto(ctx, 'APAGAR TUDO', x + w - 294 + 125, by + bh / 2 + 8, { tamanho: 21, alinha: 'center', cor: '#4a1f18' });
    botoes.push({ x: x + w - 294, y: by, w: 250, h: bh, acao: 'confirmarRecomeco' });
  }

  // ------------------------------------------------------------------ ciclo

  function desenhar(ctx) {
    MENU_L = larguraMenu();
    // o papel cobre a tela real; o conteúdo fica centrado na prancheta
    papel(ctx, vp.L, ALTURA, { base: visao === 'mundo' ? '#e8dcc2' : '#e6dcc4' });
    ctx.save();
    aplicarMoldura(ctx);
    if (visao === 'mundo') desenharMundo(ctx);
    else desenharPais(ctx);
    if (confirmando) {
      // o diálogo é modal: nada atrás dele responde a toque
      botoes.length = 0;
      desenharConfirmacao(ctx);
    }
    ctx.restore();
  }

  function clique(xTela, yTela) {
    // os dois eixos: a moldura desloca e escala, não só desloca
    const { x, y } = pontoNaMoldura(xTela, yTela);
    for (const b of botoes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        som.clique();
        switch (b.acao) {
          case 'abrirPais':
            visao = 'pais';
            return;
          case 'mundo':
            visao = 'mundo';
            return;
          case 'jogar':
            acoes.jogar(b.fase);
            return;
          case 'baixar':
            acoes.baixar();
            dizer('save baixado', CORES.bom);
            return;
          case 'carregar':
            acoes
              .carregar()
              .then(() => dizer('save carregado', CORES.bom))
              .catch((e) => dizer(e.message || 'não deu para carregar', CORES.perigo));
            return;
          case 'som':
            acoes.som();
            return;
          case 'abertura':
            acoes.abertura();
            return;
          case 'recomecar':
            confirmando = true;
            return;
          case 'cancelarRecomeco':
            confirmando = false;
            return;
          case 'confirmarRecomeco':
            confirmando = false;
            acoes.recomecar();
            return;
        }
      }
    }
  }

  // `confirmando` é exposto para o teste esperar o diálogo abrir em vez de dormir
  return { atualizar, desenhar, clique, mover() {}, confirmando: () => confirmando };
}
