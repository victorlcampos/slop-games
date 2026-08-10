// Entre uma fase e outra: o que você ganhou e três cartas sorteadas para
// comprar. O sorteio só tira do que você ainda não tem — quando o baralho
// fica completo, a recompensa vira moeda extra.

import { forma, circulo, linha, caixa, texto, quebrarTexto, papel, porSprite } from '../rabisco.js';
import { TINTA, TINTA_FRACA, CORES, PAPEL, PAPEL_ESCURO, alfa } from '../paleta.js';
import { spriteAnimal } from '../desenho/animais.js';
import { ANIMAIS, POR_ID, cartaNoNivel, custoDeTreino, NIVEL_MAX, NIVEIS } from '../dados/animais.js';
import { vp, ALTURA, aplicarMoldura, pontoNaMoldura, larguraMenu } from '../viewport.js';
import { som } from '../audio.js';


/**
 * O que o treino muda, em número. "Fica mais forte" não ajuda ninguém a
 * decidir entre gastar 105 no Macaco ou 147 na Coruja.
 */
function descreverGanho(antes, depois) {
  if (antes.papel === 'gerador') return `${antes.produz} → ${depois.produz} sementes`;
  if (antes.papel === 'parede') return `${antes.vida} → ${depois.vida} de vida`;
  if (typeof antes.dano === 'number') return `${antes.dano} → ${depois.dano} de dano`;
  if (typeof antes.vida === 'number') return `${antes.vida} → ${depois.vida} de vida`;
  return 'mais forte';
}

const PAPEIS = {
  gerador: 'produz sementes',
  atirador: 'ataca de longe',
  parede: 'segura a fileira',
  corpo: 'bate de perto',
  area: 'efeito em área',
  bomba: 'explode uma vez',
};

/**
 * Sorteia até 3 cartas que o jogador ainda não tem.
 *
 * O sorteio olha o bolso: se ele pode pagar por alguma coisa, ao menos uma das
 * ofertas é comprável agora. Sortear os três recrutas caros logo na primeira
 * fase transforma a recompensa em vitrine — o jogador vence e não leva nada.
 */
export function sortearCartas(baralho, quantas = 3, moedas = 0) {
  const faltam = ANIMAIS.filter((a) => a.preco > 0 && !baralho.includes(a.id));
  if (!faltam.length) return [];

  const sorteadas = [];
  const acessiveis = faltam.filter((a) => a.preco <= moedas);
  if (acessiveis.length) {
    sorteadas.push(acessiveis[Math.floor(Math.random() * acessiveis.length)].id);
  }

  // o resto sai da metade mais barata do que sobrou, para a vitrine ficar
  // ambiciosa sem virar impossível
  const pilha = faltam.filter((a) => !sorteadas.includes(a.id)).sort((a, b) => a.preco - b.preco);
  const janela = pilha.slice(0, Math.max(quantas, Math.ceil(pilha.length * 0.65)));
  while (sorteadas.length < quantas && janela.length) {
    sorteadas.push(janela.splice(Math.floor(Math.random() * janela.length), 1)[0].id);
  }

  // se a janela acabou antes, completa com qualquer uma que reste
  const sobra = faltam.filter((a) => !sorteadas.includes(a.id));
  while (sorteadas.length < quantas && sobra.length) {
    sorteadas.push(sobra.splice(Math.floor(Math.random() * sobra.length), 1)[0].id);
  }
  return sorteadas;
}

export function criarLoja(resultado, estado, aoContinuar) {
  let MENU_L = larguraMenu();
  const ofertas = resultado.ofertas.map((id) => POR_ID[id]).filter(Boolean);
  const compradas = new Set();
  // quem perdeu a fase cai direto no treino: recrutar carta nova raramente é a
  // resposta para "não segurei a horda"
  let aba = resultado.venceu === false ? 'treinar' : 'recrutar';

  /** As cartas do baralho que ainda podem subir de nível. */
  function treinaveis() {
    return estado.baralho
      .map((id) => ({ id, nivel: estado.niveis[id] || 1 }))
      .filter((c) => c.nivel < NIVEL_MAX)
      .map((c) => ({ ...c, base: POR_ID[c.id], custo: custoDeTreino(c.id, c.nivel) }))
      .filter((c) => c.base)
      .sort((a, b) => a.custo - b.custo);
  }
  let t = 0;
  let recado = null;
  const botoes = [];

  function dizer(txt, cor) {
    recado = { txt, cor, t: 2.4 };
  }

  function atualizar(dt) {
    t += dt;
    if (recado) {
      recado.t -= dt;
      if (recado.t <= 0) recado = null;
    }
  }

  function desenhar(ctx) {
    MENU_L = larguraMenu();
    // fundo na tela inteira, conteúdo centrado na prancheta
    papel(ctx, vp.L, ALTURA, { base: '#efe4cc' });
    ctx.save();
    aplicarMoldura(ctx);
    botoes.length = 0;

    // cabeçalho — o quartel serve tanto para quem venceu quanto para quem caiu
    const venceu = resultado.venceu !== false;
    texto(ctx, venceu ? 'FASE VENCIDA' : 'QUARTEL', MENU_L / 2, 62, {
      tamanho: 42, alinha: 'center', cor: venceu ? CORES.bom : TINTA,
    });
    texto(ctx, `${resultado.fase.nome} · ${resultado.fase.local}`, MENU_L / 2, 90, {
      tamanho: 17, alinha: 'center', cor: TINTA_FRACA,
    });

    // ganhos — a moeda vem decomposta para a economia ficar legível
    const ganhos = [
      {
        rot: 'moedas',
        val: `🪙 ${resultado.moedas}`,
        cor: CORES.destaqueEscuro,
        pe: resultado.troco ? `${resultado.base} + ${resultado.troco} de troco` : null,
      },
      {
        rot: 'monstros derrubados',
        val: String(resultado.mortos),
        cor: CORES.perigo,
        pe: resultado.ganhoMortes ? `renderam ${resultado.ganhoMortes} sementes` : null,
      },
      {
        rot: 'humanos libertados',
        val: `${resultado.humanos} milhões`,
        cor: CORES.bom,
        pe: null,
      },
    ];
    ganhos.forEach((g, i) => {
      const x = MENU_L / 2 - 345 + i * 230;
      caixa(ctx, x, 118, 214, 76, 10, { cor: TINTA, largura: 2.4, preenche: '#fbf5e6', semente: 10 + i });
      texto(ctx, g.rot, x + 107, 140, { tamanho: 13, alinha: 'center', cor: TINTA_FRACA });
      texto(ctx, g.val, x + 107, 168, { tamanho: 23, alinha: 'center', cor: g.cor });
      if (g.pe) texto(ctx, g.pe, x + 107, 186, { tamanho: 12, alinha: 'center', cor: TINTA_FRACA });
    });

    // saldo
    texto(ctx, `você tem 🪙 ${estado.moedas}`, MENU_L / 2, 216, { tamanho: 21, alinha: 'center', cor: TINTA });

    // ------------------------------------------------------------------ abas
    // Recrutar abre o leque; treinar aprofunda o que você já usa. A campanha
    // não paga pelos dois, e é essa escolha que dá identidade ao baralho.
    const abas = [
      { id: 'recrutar', rot: `RECRUTAR (${ofertas.filter((c) => !compradas.has(c.id)).length})` },
      { id: 'treinar', rot: `TREINAR (${treinaveis().length})` },
    ];
    const larguraAba = 220;
    abas.forEach((a, i) => {
      const x = MENU_L / 2 - (abas.length * larguraAba) / 2 + i * larguraAba;
      const ativa = aba === a.id;
      caixa(ctx, x, 236, larguraAba - 8, 42, 9, {
        cor: TINTA,
        largura: ativa ? 3.4 : 2,
        preenche: ativa ? CORES.destaque : '#e4dac2',
        semente: 200 + i,
      });
      texto(ctx, a.rot, x + (larguraAba - 8) / 2, 263, {
        tamanho: 16, alinha: 'center', cor: ativa ? TINTA : TINTA_FRACA,
      });
      botoes.push({ x, y: 236, w: larguraAba - 8, h: 42, acao: 'aba', qual: a.id });
    });

    if (aba === 'recrutar') desenharRecrutar(ctx);
    else desenharTreinar(ctx);

    // continuar
    const proxima = resultado.proximaFase;
    caixa(ctx, MENU_L / 2 - 180, ALTURA - 84, 360, 64, 12, { cor: TINTA, largura: 3.4, preenche: CORES.destaque, semente: 60 });
    texto(ctx, proxima ? `SEGUIR PARA A FASE ${proxima}` : 'VER O MAPA', MENU_L / 2, ALTURA - 43, {
      tamanho: 22, alinha: 'center', cor: TINTA,
    });
    botoes.push({ x: MENU_L / 2 - 180, y: ALTURA - 84, w: 360, h: 64, acao: 'continuar' });

    if (recado) {
      texto(ctx, recado.txt, MENU_L / 2, ALTURA - 96, { tamanho: 18, alinha: 'center', cor: recado.cor, alfa: Math.min(1, recado.t) });
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- recrutar

  function desenharRecrutar(ctx) {
    if (!ofertas.length) {
      caixa(ctx, MENU_L / 2 - 300, 300, 600, 120, 14, { cor: TINTA, largura: 3, preenche: '#fbf5e6', semente: 30 });
      texto(ctx, 'Baralho completo!', MENU_L / 2, 344, { tamanho: 28, alinha: 'center', cor: CORES.bom });
      texto(ctx, 'Não sobrou bicho para recrutar — treine os que você tem.', MENU_L / 2, 378, {
        tamanho: 17, alinha: 'center', cor: TINTA_FRACA,
      });
      return;
    }

    texto(ctx, 'três apareceram desta vez — compre quantas quiser', MENU_L / 2, 300, {
      tamanho: 15, alinha: 'center', cor: TINTA_FRACA,
    });

    const cw = 250;
    const ch = 272;
    const gap = 30;
    const x0 = MENU_L / 2 - (ofertas.length * cw + (ofertas.length - 1) * gap) / 2;

    ofertas.forEach((c, i) => {
      const x = x0 + i * (cw + gap);
      const y = 316;
      const comprada = compradas.has(c.id);
      const pode = estado.moedas >= c.preco && !comprada;
      const flutua = Math.sin(t * 2 + i) * 3;

      caixa(ctx, x, y + flutua, cw, ch, 16, {
        cor: comprada ? CORES.bom : TINTA,
        largura: comprada ? 4 : 3,
        preenche: comprada ? '#e4f0dd' : '#fbf5e6',
        semente: 40 + i,
      });

      porSprite(ctx, spriteAnimal(c.id, 128), x + cw / 2, y + flutua + 82, 0.95);
      texto(ctx, c.nome, x + cw / 2, y + flutua + 158, { tamanho: 24, alinha: 'center', cor: TINTA });
      texto(ctx, `${c.origem} · ${PAPEIS[c.papel] || c.papel}`, x + cw / 2, y + flutua + 178, {
        tamanho: 12, alinha: 'center', cor: CORES.destaqueEscuro,
      });
      quebrarTexto(ctx, c.descricao, cw - 36, 13).slice(0, 3).forEach((ln, j) => {
        texto(ctx, ln, x + cw / 2, y + flutua + 200 + j * 17, { tamanho: 13, alinha: 'center', cor: TINTA_FRACA });
      });

      const by = y + flutua + ch - 42;
      caixa(ctx, x + 20, by, cw - 40, 34, 8, {
        cor: TINTA, largura: 2.2,
        preenche: comprada ? CORES.bom : pode ? CORES.destaque : '#ccc2ae',
        semente: 50 + i,
      });
      texto(ctx, comprada ? '✓ no baralho' : `🪙 ${c.preco}`, x + cw / 2, by + 23, {
        tamanho: 18, alinha: 'center', cor: TINTA,
      });
      texto(ctx, `custa ${c.custo} sementes em campo`, x + cw / 2, y + flutua + ch + 16, {
        tamanho: 12, alinha: 'center', cor: TINTA_FRACA,
      });

      if (!comprada) botoes.push({ x, y: y + flutua, w: cw, h: ch, acao: 'comprar', carta: c });
    });
  }

  // --------------------------------------------------------------- treinar

  function desenharTreinar(ctx) {
    const lista = treinaveis();
    if (!lista.length) {
      caixa(ctx, MENU_L / 2 - 300, 300, 600, 120, 14, { cor: TINTA, largura: 3, preenche: '#fbf5e6', semente: 31 });
      texto(ctx, 'Todo mundo no nível máximo', MENU_L / 2, 344, { tamanho: 26, alinha: 'center', cor: CORES.bom });
      texto(ctx, 'Não há mais o que treinar neste baralho.', MENU_L / 2, 378, {
        tamanho: 17, alinha: 'center', cor: TINTA_FRACA,
      });
      return;
    }

    texto(ctx, 'treinar não muda o custo em sementes — a mesma semente rende mais', MENU_L / 2, 294, {
      tamanho: 14, alinha: 'center', cor: TINTA_FRACA,
    });

    // Grade de até 14 cartas em duas fileiras. Com duas, o card encolhe — a
    // segunda fileira precisa terminar antes do botão de continuar, senão fica
    // escondida atrás dele.
    const porLinha = Math.min(7, Math.max(3, Math.ceil(Math.min(lista.length, 14) / 2)));
    const linhas = Math.ceil(Math.min(lista.length, 14) / porLinha);
    const cw = Math.min(180, (MENU_L - 100) / porLinha - 12);
    const ch = linhas > 1 ? 144 : 172;
    const y0 = linhas > 1 ? 308 : 344;

    lista.slice(0, 14).forEach((item, i) => {
      const lin = Math.floor(i / porLinha);
      const col = i % porLinha;
      const nesta = Math.min(porLinha, lista.length - lin * porLinha);
      const x = MENU_L / 2 - (nesta * (cw + 12)) / 2 + col * (cw + 12);
      const y = y0 + lin * (ch + 14);

      const pode = estado.moedas >= item.custo;
      const proximo = item.nivel + 1;
      const antes = cartaNoNivel(item.id, item.nivel);
      const depois = cartaNoNivel(item.id, proximo);

      caixa(ctx, x, y, cw, ch, 12, {
        cor: TINTA, largura: 2.6,
        preenche: pode ? '#fbf5e6' : '#e6ddc8',
        semente: 300 + i,
      });
      ctx.save();
      ctx.globalAlpha = pode ? 1 : 0.5;
      const compacto = ch < 160;
      porSprite(ctx, spriteAnimal(item.id, 128), x + cw / 2, y + (compacto ? 36 : 42), compacto ? 0.46 : 0.54);
      ctx.restore();

      texto(ctx, item.base.nome, x + cw / 2, y + (compacto ? 74 : 88), {
        tamanho: compacto ? 14 : 15, alinha: 'center', cor: TINTA,
      });

      // o que muda: mostra o número, não "fica mais forte"
      texto(ctx, descreverGanho(antes, depois), x + cw / 2, y + (compacto ? 92 : 108), {
        tamanho: 12, alinha: 'center', cor: CORES.bom,
      });
      texto(ctx, `nível ${item.nivel} → ${proximo}`, x + cw / 2, y + (compacto ? 108 : 126), {
        tamanho: 11, alinha: 'center', cor: TINTA_FRACA,
      });

      caixa(ctx, x + 12, y + ch - 32, cw - 24, 26, 6, {
        cor: TINTA, largura: 2, preenche: pode ? CORES.destaque : '#ccc2ae', semente: 320 + i,
      });
      texto(ctx, `🪙 ${item.custo}`, x + cw / 2, y + ch - 13, { tamanho: 14, alinha: 'center', cor: TINTA });

      botoes.push({ x, y, w: cw, h: ch, acao: 'treinar', item });
    });

    if (lista.length > 14) {
      texto(ctx, `e mais ${lista.length - 14} — os mais baratos aparecem primeiro`, MENU_L / 2, y0 + linhas * (ch + 14) + 6, {
        tamanho: 13, alinha: 'center', cor: TINTA_FRACA,
      });
    }
  }

  function clique(xTela, yTela) {
    const { x, y } = pontoNaMoldura(xTela, yTela);
    for (const b of botoes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.acao === 'comprar') {
          const c = b.carta;
          if (estado.moedas < c.preco) {
            som.erro();
            dizer('moedas insuficientes', CORES.perigo);
            return;
          }
          estado.moedas -= c.preco;
          estado.baralho.push(c.id);
          compradas.add(c.id);
          som.moeda();
          dizer(`${c.nome} entrou no baralho!`, CORES.bom);
          return;
        }
        if (b.acao === 'aba') {
          aba = b.qual;
          som.carta();
          return;
        }
        if (b.acao === 'treinar') {
          const { id, custo, nivel, base } = b.item;
          if (estado.moedas < custo) {
            som.erro();
            dizer('moedas insuficientes', CORES.perigo);
            return;
          }
          estado.moedas -= custo;
          estado.niveis[id] = nivel + 1;
          som.moeda();
          dizer(`${base.nome} agora é nível ${nivel + 1}!`, CORES.bom);
          return;
        }
        if (b.acao === 'continuar') {
          som.clique();
          aoContinuar();
          return;
        }
      }
    }
  }

  return { atualizar, desenhar, clique, mover() {} };
}
