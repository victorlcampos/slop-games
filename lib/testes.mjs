// Kit de teste de jogo: abre o HTML por file://, dirige o jogo e cobra o
// resultado. Roda em Node com puppeteer-core e o Chrome do sistema.
//
// Duas coisas aqui existem por cicatriz:
//
// 1. `pontos()` converte coordenada lógica do jogo em coordenada de tela. Fazer
//    essa conta "no olho" (largura/1280) falhou duas vezes durante o
//    desenvolvimento — uma porque o canvas ficava centralizado com barras, outra
//    porque a largura lógica passou a ser elástica. O teste perseguiu um bug de
//    jogo que era bug de teste. Aqui a conta sai do próprio jogo, sempre.
//
// 2. `abrir()` coleta pageerror e console.error desde antes do load. Erro que
//    acontece no boot não aparece se você registra o listener depois.
//
//   const j = await abrir(browser, arquivo, APARELHOS.desktop);
//   await j.executar((s) => s.irParaFase(3));
//   await j.tocar(...j.pontos(640, 400));
//   j.exigirSemErros();

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Acha o Chrome da máquina. `puppeteer-core` não baixa navegador — é justamente
 * o que mantém o repositório leve —, então alguém precisa dizer onde ele está.
 * A ordem cobre a máquina de quem desenvolve e o runner do CI sem configuração.
 */
export function acharChrome() {
  if (process.env.CHROME) return process.env.CHROME;

  const candidatos = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidatos) if (existsSync(c)) return c;

  // último recurso: perguntar ao PATH
  for (const nome of ['google-chrome', 'chromium', 'chrome']) {
    try {
      const achado = execSync(`command -v ${nome}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      if (achado) return achado;
    } catch {
      /* não está no PATH */
    }
  }

  throw new Error(
    'não achei o Chrome. Instale o Google Chrome ou aponte o caminho:\n' +
      '  CHROME=/caminho/para/chrome npm test'
  );
}

export const CHROME = process.env.CHROME || null;

export const APARELHOS = {
  desktop: { nome: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, hasTouch: false, isMobile: false },
  ultrawide: { nome: 'ultrawide', width: 2560, height: 1080, deviceScaleFactor: 1, hasTouch: false, isMobile: false },
  retina: { nome: 'retina', width: 1440, height: 900, deviceScaleFactor: 2, hasTouch: false, isMobile: false },
  celular: { nome: 'celular deitado', width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  celularEmPe: { nome: 'celular em pé', width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  tablet: { nome: 'tablet', width: 1180, height: 820, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};

export async function abrirNavegador(opcoes = {}) {
  const naCI = !!process.env.CI;
  return puppeteer.launch({
    executablePath: acharChrome(),
    headless: 'new',
    args: [
      '--touch-events=enabled',
      '--mute-audio',
      '--no-first-run',
      // No CI: sem sandbox (o runner roda como root) e com WebGL por software.
      // Cuidado com `--disable-gpu` aqui — ele derruba o WebGL junto, e os
      // jogos 3D deixam de criar contexto: o teste acusa "sem canvas" como se
      // o jogo estivesse quebrado. SwiftShader renderiza na CPU e resolve.
      ...(naCI
        ? [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ]
        : []),
      ...(opcoes.args || []),
    ],
    ...opcoes,
  });
}

/**
 * Abre o jogo e devolve um punhado de facilidades em volta da página.
 *
 * @param {string} arquivo caminho absoluto do index.html
 * @param {object} aparelho um item de APARELHOS
 * @param {object} opcoes { ponte: nome da variável global que o jogo expõe }
 */
export async function abrir(navegador, arquivo, aparelho = APARELHOS.desktop, opcoes = {}) {
  // `limparDados` é o padrão de propósito: todas as páginas file:// dividem o
  // mesmo localStorage, então sem isso um cenário herda o save do anterior e
  // passa (ou falha) por motivo que não tem nada a ver com o que ele testa.
  const { ponte = '__jogo', esperaBoot = 500, limparDados = true } = opcoes;
  const pagina = await navegador.newPage();
  const erros = [];

  // antes do goto: erro de boot também conta
  pagina.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) erros.push('console: ' + m.text());
  });

  await pagina.setViewport({
    width: aparelho.width,
    height: aparelho.height,
    deviceScaleFactor: aparelho.deviceScaleFactor,
    hasTouch: aparelho.hasTouch,
    isMobile: aparelho.isMobile,
    isLandscape: aparelho.width > aparelho.height,
  });
  await pagina.goto('file://' + arquivo, { waitUntil: 'load' });
  if (limparDados) {
    // limpa e recarrega: o jogo precisa bootar já com o storage vazio, senão
    // ele carregou o save do cenário anterior antes de a gente apagar
    await pagina.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* storage bloqueado: nada a limpar */
      }
    });
    erros.length = 0;
    await pagina.reload({ waitUntil: 'load' });
  }
  await espera(esperaBoot);

  /** Retângulo do canvas e escala lógica, lidos do próprio jogo. */
  async function metrica() {
    return pagina.evaluate((nomePonte) => {
      const c = document.querySelector('canvas');
      const r = c ? c.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
      const j = window[nomePonte];
      const tela = j && (j.tela || j.vp);
      return {
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        // se o jogo não expõe a tela, cai no tamanho do canvas mesmo
        L: (tela && tela.L) || (c && c.width) || r.width,
        A: (tela && tela.A) || (c && c.height) || r.height,
      };
    }, ponte);
  }

  let m = await metrica();

  const jogo = {
    pagina,
    erros,
    aparelho,

    /** Relê o retângulo — chame depois de girar a tela ou redimensionar. */
    async remedir() {
      m = await metrica();
      return m;
    },

    /**
     * Coordenada lógica do jogo → coordenada de tela para clicar/tocar.
     * Espalhe `...jogo.pontos(x, y)` direto nos métodos de mouse/touch.
     */
    pontos(x, y) {
      return [m.rect.x + (x / m.L) * m.rect.w, m.rect.y + (y / m.A) * m.rect.h];
    },

    /**
     * O mesmo, para conteúdo desenhado numa prancheta de tamanho fixo (telas de
     * menu). A prancheta centraliza quando a tela é maior e **encolhe** quando
     * é menor — um monitor 16:10 dá 1152 de largura lógica, abaixo dos 1280 de
     * prancheta. Ignorar esse encolhimento faz o toque cair no lugar errado.
     */
    pontosMoldura(x, y, moldura = 1280, alturaMoldura = 720) {
      const k = Math.min(1, m.L / moldura);
      return jogo.pontos((m.L - moldura * k) / 2 + x * k, (m.A - alturaMoldura * k) / 2 + y * k);
    },

    get largura() {
      return m.L;
    },
    get altura() {
      return m.A;
    },

    /** Clica ou toca, conforme o aparelho. */
    async tocar(x, y) {
      if (aparelho.hasTouch) await pagina.touchscreen.tap(x, y);
      else await pagina.mouse.click(x, y);
      await espera(120);
    },

    /** Arrastar: no toque é o gesto principal do jogo. */
    async arrastar(de, ate, passos = 6) {
      const [x1, y1] = de;
      const [x2, y2] = ate;
      const toque = aparelho.hasTouch;
      if (toque) await pagina.touchscreen.touchStart(x1, y1);
      else await pagina.mouse.move(x1, y1), await pagina.mouse.down();
      for (let i = 1; i <= passos; i++) {
        const x = x1 + ((x2 - x1) * i) / passos;
        const y = y1 + ((y2 - y1) * i) / passos;
        if (toque) await pagina.touchscreen.touchMove(x, y);
        else await pagina.mouse.move(x, y);
        await espera(50);
      }
      if (toque) await pagina.touchscreen.touchEnd();
      else await pagina.mouse.up();
      await espera(150);
    },

    /** Roda uma função dentro do jogo, recebendo a ponte como argumento. */
    executar(fn, ...args) {
      return pagina.evaluate(
        (nomePonte, corpo, extras) => {
          // eslint-disable-next-line no-new-func
          const f = new Function('jogo', ...extras.map((_, i) => 'a' + i), `return (${corpo})(jogo, ${extras.map((_, i) => 'a' + i).join(', ')})`);
          return f(window[nomePonte], ...extras);
        },
        ponte,
        fn.toString(),
        args
      );
    },

    esperar: espera,

    /**
     * Espera o jogo desenhar N quadros. É o jeito honesto de dizer "deixa a
     * tela aparecer": muita coisa (a lista de botões clicáveis, por exemplo) só
     * existe depois do primeiro desenho, e dormir um tempo fixo é apostar na
     * velocidade da máquina — no CI o Chrome renderiza por software e demora
     * bem mais que no seu laptop.
     *
     * Exige `quadros()` na ponte do jogo; sem ela, cai num sleep curto.
     */
    async esperarQuadros(n = 2, limite = 4000) {
      const temContador = await jogo.executar((j) => typeof j.quadros === 'function');
      if (!temContador) return espera(200);
      const inicio = await jogo.executar((j) => j.quadros());
      return jogo.esperarAte((j, alvo) => j.quadros() >= alvo, {
        limite,
        oQue: `o jogo desenhar ${n} quadros`,
        args: [inicio + n],
      });
    },

    /**
     * Espera uma condição virar verdadeira dentro do jogo, em vez de chutar um
     * `sleep`. Teste que dorme um tempo fixo passa na sua máquina e falha na
     * do CI — ou, pior, passa sozinho e falha no meio da suíte.
     */
    async esperarAte(fn, { limite = 4000, intervalo = 100, oQue = 'condição', args = [] } = {}) {
      const fim = Date.now() + limite;
      while (Date.now() < fim) {
        if (await jogo.executar(fn, ...args)) return true;
        await espera(intervalo);
      }
      throw new Error(`esperei ${limite}ms e ${oQue} não aconteceu`);
    },

    async foto(caminho) {
      await pagina.screenshot({ path: caminho });
      return caminho;
    },

    /** Falha o teste se algum erro apareceu no console ou na página. */
    exigirSemErros(rotulo = '') {
      if (erros.length) {
        const cabeca = erros.slice(0, 6).join('\n  ');
        throw new Error(`${rotulo || 'o jogo'} soltou ${erros.length} erro(s):\n  ${cabeca}`);
      }
    },

    fechar: () => pagina.close(),
  };

  return jogo;
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------- mini test runner

const casos = [];
let atual = null;

export function cenario(nome, fn) {
  casos.push({ nome, fn });
}

export function conferir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem || 'condição falsa');
  if (atual) atual.checagens++;
}

export function conferirIgual(recebido, esperado, mensagem) {
  const a = JSON.stringify(recebido);
  const b = JSON.stringify(esperado);
  conferir(a === b, `${mensagem || 'valores diferentes'}\n     esperado: ${b}\n     recebido: ${a}`);
}

/** Roda tudo que foi registrado com `cenario`. Sai com código 1 se algo falhar. */
export async function rodar(titulo = 'testes') {
  console.log(`\n  ${titulo}\n`);
  let falhas = 0;
  for (const c of casos) {
    atual = { checagens: 0 };
    const t0 = Date.now();
    try {
      await c.fn();
      console.log(`  ✓ ${c.nome}  (${atual.checagens} checagens, ${Date.now() - t0}ms)`);
    } catch (err) {
      falhas++;
      console.log(`  ✗ ${c.nome}`);
      console.log(`     ${String(err.message).split('\n').join('\n     ')}`);
    }
  }
  console.log(falhas ? `\n  ${falhas} de ${casos.length} falharam\n` : `\n  ✔ ${casos.length} cenários passaram\n`);
  if (falhas) process.exitCode = 1;
  return falhas === 0;
}
