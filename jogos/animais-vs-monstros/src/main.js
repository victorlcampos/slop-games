// Bootstrap e máquina de telas.
//
//   abertura -> mapa -> batalha -> (loja | derrota) -> mapa -> ...

import { papel, texto, caixa, circulo, quebrarTexto, porSprite } from './rabisco.js';
import { TINTA, TINTA_FRACA, CORES, PAPEL, PAPEL_ESCURO } from './paleta.js';
import { criarCutscene } from './telas/cutscene.js';
import { criarMapa } from './telas/mapa.js';
import { criarBatalha } from './telas/batalha.js';
import { criarLoja } from './telas/loja.js';
import { spriteMonstro } from './desenho/monstros.js';
import { FASES } from './dados/fases.js';
import { cartasExigidas, sortearCartas } from './dados/animais.js';
import { calcularRecompensa } from './dados/economia.js';
import { vp, ALTURA, ajustar, preparar, observar, pontoLogico, aplicarMoldura, pontoNaMoldura, larguraMenu } from './viewport.js';
import { criarLaco } from 'slopkit/laco';
import * as Save from './save.js';
import { som, acordarAudio, alternarSom, somLigado, pararMusica, tocarMusica } from './audio.js';

const tela = document.getElementById('tela');
tela.hidden = false;
const girando = document.getElementById('girando');
if (girando) girando.remove();

const ctx = tela.getContext('2d');
ajustar(tela);

// A janela mudou de tamanho: reposiciona quem estiver em campo. O kit cuida de
// escutar os eventos e também de perceber a rotação que o evento não entregou.
observar(() => {
  if (atual && atual.redimensionar) atual.redimensionar();
});
let estado = Save.carregar();
let atual = null;

// --------------------------------------------------------------- navegação

function irParaMapa() {
  pararMusica();
  atual = criarMapa(estado, {
    jogar: irParaBatalha,
    baixar: () => Save.baixar(estado),
    carregar: () =>
      Save.importar().then((novo) => {
        estado = novo;
        Save.salvar(estado);
        irParaMapa();
      }),
    som: () => alternarSom(),
    somLigado,
    abertura: irParaAbertura,
    recomecar: () => {
      // jogo novo de verdade: apaga o guardado, zera o estado em memória e
      // toca a abertura de novo, que é onde a campanha começa
      Save.apagar();
      estado = Save.saveNovo();
      Save.salvar(estado);
      irParaAbertura();
    },
  });
}

function irParaAbertura() {
  pararMusica();
  atual = criarCutscene(() => {
    estado.viuAbertura = true;
    Save.salvar(estado);
    irParaMapa();
  });
}

function irParaBatalha(numeroFase) {
  const fase = FASES.find((f) => f.n === numeroFase);
  if (!fase) return irParaMapa();

  atual = criarBatalha(
    fase,
    estado.baralho,
    (venceu, resumo) => {
      if (venceu) venceuFase(fase, resumo);
      else perdeuFase(fase, resumo);
    },
    estado.niveis
  );
}

function venceuFase(fase, resumo) {
  const primeiraVez = !estado.vencidas.includes(fase.n);
  const { base, troco, total } = calcularRecompensa(fase, resumo, true, primeiraVez);
  const humanos = primeiraVez ? fase.humanos : 0;

  estado.moedas += total;
  estado.humanos += humanos;
  if (primeiraVez) {
    estado.vencidas.push(fase.n);
    estado.faseAtual = Math.min(FASES.length, fase.n + 1);
  }
  const recorde = estado.recordes[fase.n];
  if (!recorde || resumo.mortos > recorde) estado.recordes[fase.n] = resumo.mortos;
  Save.salvar(estado);

  irParaQuartel({
    venceu: true,
    fase,
    moedas: total,
    base,
    troco,
    humanos,
    mortos: resumo.mortos,
    sobra: resumo.sobra || 0,
    ganhoMortes: resumo.ganhoMortes || 0,
  });
}

function perdeuFase(fase, resumo) {
  const primeiraVez = !estado.vencidas.includes(fase.n);
  const { base, troco, total } = calcularRecompensa(fase, resumo, false, primeiraVez);
  estado.moedas += total;
  Save.salvar(estado);

  atual = telaDerrota(fase, resumo, { moedas: total, base, troco });
}

/** A tela entre fases: recrutar cartas novas ou treinar as que já tem. */
function irParaQuartel(resultado) {
  const proxima = estado.vencidas.length >= FASES.length ? null : estado.faseAtual;
  // o que a próxima fase exige entra na vitrine na marra: chegar na fase da
  // água sem bicho aquático é chegar sem defesa na fileira por onde a Iara vem
  const exigidas = cartasExigidas(FASES.find((f) => f.n === proxima), estado.baralho);
  const ofertas = sortearCartas(estado.baralho, 3, estado.moedas, exigidas);
  atual = criarLoja({ ...resultado, ofertas, proximaFase: proxima }, estado, () => {
    Save.salvar(estado);
    irParaMapa();
  });
}

// ------------------------------------------------------------ tela derrota

function telaDerrota(fase, resumo, ganho) {
  const botoes = [];
  let t = 0;

  return {
    atualizar(dt) {
      t += dt;
    },
    desenhar(c) {
      papel(c, vp.L, ALTURA, { base: '#d9c9b4' });
      c.fillStyle = 'rgba(60, 30, 40, 0.12)';
      c.fillRect(0, 0, vp.L, ALTURA);
      c.save();
      aplicarMoldura(c);
      botoes.length = 0;
      const MENU_L = larguraMenu();

      porSprite(c, spriteMonstro('bichopapao', 128), MENU_L / 2, 250 + Math.sin(t * 1.6) * 6, 1.9, false, 0.9);

      texto(c, 'ELES PASSARAM', MENU_L / 2, 110, { tamanho: 52, alinha: 'center', cor: CORES.perigo });
      texto(c, `${fase.nome} continua tomada.`, MENU_L / 2, 146, { tamanho: 20, alinha: 'center', cor: TINTA_FRACA });

      const dica = dicaDaFase(fase);
      const linhas = quebrarTexto(c, dica, 720, 19);
      caixa(c, MENU_L / 2 - 390, 380, 780, 40 + linhas.length * 26, 12, {
        cor: TINTA, largura: 3, preenche: '#fbf5e6', semente: 5,
      });
      linhas.forEach((ln, i) => {
        texto(c, ln, MENU_L / 2, 412 + i * 26, { tamanho: 19, alinha: 'center', cor: TINTA });
      });

      texto(c, `você derrubou ${resumo.mortos} antes de cair`, MENU_L / 2, 512, {
        tamanho: 17, alinha: 'center', cor: TINTA_FRACA,
      });

      // Perder também paga. Menos, e proporcional a quanto você aguentou — mas
      // paga, porque tentar uma fase difícil não pode ser tempo jogado fora.
      if (ganho && ganho.moedas > 0) {
        caixa(c, MENU_L / 2 - 220, 528, 440, 56, 10, {
          cor: TINTA, largura: 2.6, preenche: '#fbf5e6', semente: 7,
        });
        texto(c, `🪙 +${ganho.moedas}`, MENU_L / 2, 552, {
          tamanho: 23, alinha: 'center', cor: CORES.destaqueEscuro,
        });
        texto(
          c,
          ganho.troco
            ? `${ganho.base} pelo que você segurou · ${ganho.troco} de troco das sementes`
            : 'pelo que você segurou',
          MENU_L / 2,
          574,
          { tamanho: 13, alinha: 'center', cor: TINTA_FRACA }
        );
      }

      const bts = [
        { rot: 'TENTAR DE NOVO', acao: 'repetir', cor: CORES.destaque, larg: 240 },
        { rot: 'QUARTEL', acao: 'quartel', cor: '#c9a165', larg: 180 },
        { rot: 'MAPA', acao: 'mapa', cor: PAPEL_ESCURO, larg: 150 },
      ];
      let x = MENU_L / 2 - (bts.reduce((s, b) => s + b.larg, 0) + 2 * 16) / 2;
      for (const b of bts) {
        caixa(c, x, 596, b.larg, 58, 12, { cor: TINTA, largura: 3.2, preenche: b.cor, semente: 10 + x });
        texto(c, b.rot, x + b.larg / 2, 633, { tamanho: 19, alinha: 'center', cor: TINTA });
        botoes.push({ x, y: 596, w: b.larg, h: 58, acao: b.acao });
        x += b.larg + 16;
      }
      c.restore();
    },
    clique(xTela, yTela) {
      const { x, y } = pontoNaMoldura(xTela, yTela);
      for (const b of botoes) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          som.clique();
          if (b.acao === 'repetir') irParaBatalha(fase.n);
          else if (b.acao === 'quartel') {
            irParaQuartel({
              venceu: false,
              fase,
              moedas: ganho ? ganho.moedas : 0,
              base: ganho ? ganho.base : 0,
              troco: ganho ? ganho.troco : 0,
              humanos: 0,
              mortos: resumo.mortos,
              sobra: resumo.sobra || 0,
              ganhoMortes: resumo.ganhoMortes || 0,
            });
          } else irParaMapa();
          return;
        }
      }
    },
    mover() {},
  };
}

/** Uma dica útil, ligada ao que aquela fase tem de específico. */
function dicaDaFase(fase) {
  if (fase.chefe) return 'A Cuca chama reforço enquanto anda. Segure as fileiras com paredes e concentre o dano nela — quem para de atirar na Cuca perde o campo.';
  if (fase.nevoa) return 'A névoa esconde o meio do campo: uma Coruja em qualquer fileira levanta o véu do tabuleiro inteiro.';
  if (fase.noite) return 'No escuro tem coisa que anda invisível. Sem alguém que enxergue à noite, você só descobre quando já está sendo mordido.';
  if (fase.agua && fase.agua.length) return 'Fileira alagada só aceita bicho aquático — Jacaré e Hipopótamo. É por ela que a Iara desce: água vazia é estrada aberta até a cerca.';
  if (fase.fatorSementes) return 'Na seca as sementes demoram mais. Plante geradores antes de qualquer outra coisa e aguente o começo com uma parede só.';
  return 'Comece pelos geradores: sem semente entrando, nada mais entra em campo. Duas fileiras de defesa valem mais que uma cheia de bicho caro.';
}

// -------------------------------------------------------------- entrada

function pontoNoCanvas(ev) {
  const fonte = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
  return pontoLogico(tela, fonte.clientX, fonte.clientY);
}

// Toque e mouse pelo mesmo caminho. A ação vale no *soltar*, não no apertar:
// é o que deixa o dedo arrastar até a casa certa antes de confirmar, e o que
// permite desistir escorregando para fora do botão.
tela.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  acordarAudio();
  tela.setPointerCapture?.(ev.pointerId);
  const p = pontoNoCanvas(ev);
  if (!atual) return;
  if (atual.pressionar) atual.pressionar(p.x, p.y);
  else if (atual.mover) atual.mover(p.x, p.y);
});

tela.addEventListener('pointermove', (ev) => {
  ev.preventDefault();
  const p = pontoNoCanvas(ev);
  if (atual && atual.mover) atual.mover(p.x, p.y);
});

tela.addEventListener('pointerup', (ev) => {
  ev.preventDefault();
  // devolve a captura: um ponteiro que ficou preso (gesto interrompido por
  // rotação, chamada, troca de app) faz o toque seguinte ir para o lugar errado
  tela.releasePointerCapture?.(ev.pointerId);
  const p = pontoNoCanvas(ev);
  if (!atual) return;
  if (atual.soltar) atual.soltar(p.x, p.y);
  else if (atual.clique) atual.clique(p.x, p.y);
});

// dedo saiu da tela ou o sistema roubou o toque: cancela sem executar a ação
tela.addEventListener('pointercancel', (ev) => {
  tela.releasePointerCapture?.(ev.pointerId);
  if (atual) atual.cancelar?.();
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (atual && atual.pular) atual.pular();
  }
  if (ev.key === 'm' || ev.key === 'M') alternarSom();
});

// ---------------------------------------------------------------- ciclo

// Passo fixo: com dt variável o jogo se comporta diferente a 60 e a 144 Hz —
// monstro que anda mais, tiro que sai mais rápido. A 1/60 o comportamento é o
// mesmo em qualquer máquina, e a guarda do laço impede a espiral quando a aba
// volta do segundo plano.
let quadros = 0;

const laco = criarLaco({
  passo: 1 / 60,
  maxPassos: 8,
  simular: (h) => {
    if (atual) atual.atualizar(h);
  },
  desenhar: () => {
    if (!atual) return;
    // a transformação leva o mundo lógico (720 de altura) até o pixel físico
    preparar(ctx);
    atual.desenhar(ctx);
    quadros++;
  },
});

if (estado.viuAbertura) irParaMapa();
else irParaAbertura();

laco.iniciar();

// deixa acessível para o smoke test conferir que o jogo subiu
// Ponte de teste. O nome `__jogo` é convenção do slopkit: o kit de teste
// procura por ela para ler a tela (e converter coordenada de toque sem chutar)
// e para dirigir o jogo de fora.
window.__jogo = {
  nome: 'animais-vs-monstros',
  tela: vp, // precisa expor L e A: é daí que sai a conversão de coordenadas
  estado: () => estado,
  atual: () => atual,
  irParaBatalha,
  irParaMapa,
  laco,
  // o teste usa para esperar a tela desenhar, em vez de dormir um tempo fixo
  quadros: () => quadros,
};

// nome antigo, mantido para não quebrar scripts soltos
window.AVM = { ...window.__jogo, tela: () => atual, vp };
