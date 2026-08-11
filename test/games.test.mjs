// O que todo jogo do catálogo tem de cumprir, seja qual for a tecnologia.
//
// Cada jogo pode (e deve) ter o teste dele em `jogos/<slug>/test/`, exercitando
// a própria jogabilidade. Este aqui é o piso: se falhar, o jogo está quebrado
// para quem abriu o arquivo, independentemente do que mais faça.

import { abrirNavegador, abrir, APARELHOS, cenario, conferir, rodar, espera } from 'slopkit/testes';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = path.join(RAIZ, 'dist');

const catalogo = readdirSync(path.join(RAIZ, 'jogos'))
  .filter((slug) => {
    try {
      return statSync(path.join(RAIZ, 'jogos', slug, 'jogo.json')).isFile();
    } catch {
      return false;
    }
  })
  .map((slug) => JSON.parse(readFileSync(path.join(RAIZ, 'jogos', slug, 'jogo.json'), 'utf8')));

const navegador = await abrirNavegador();

for (const jogo of catalogo) {
  const arquivo = path.join(DIST, jogo.slug, 'index.html');

  cenario(`${jogo.emoji} ${jogo.nome}: abre por file:// e desenha`, async () => {
    conferir(existsSync(arquivo), `${jogo.slug}: falta dist — rode npm run build`);
    const j = await abrir(navegador, arquivo, APARELHOS.desktop, { esperaBoot: 2200 });
    const pintou = await j.pagina.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { erro: 'sem canvas' };
      return { erro: null, w: c.width, h: c.height, titulo: document.title };
    });
    conferir(!pintou.erro, `${jogo.slug}: ${pintou.erro}`);
    conferir(pintou.w > 0 && pintou.h > 0, `${jogo.slug}: canvas com tamanho zero`);
    conferir(!!pintou.titulo, `${jogo.slug}: página sem <title>`);
    j.exigirSemErros(jogo.slug);
    await j.fechar();
  });

  cenario(`${jogo.emoji} ${jogo.nome}: é um arquivo só, sem buscar nada de fora`, async () => {
    const html = readFileSync(arquivo, 'utf8');
    const externo =
      html.match(/<script\b[^>]*\bsrc=["']?(?!data:)[^"'>\s]+/i) ||
      html.match(/<link\b[^>]*\bstylesheet[^>]*\bhref=["']?(?!data:)[^"'>\s]+/i);
    conferir(!externo, `${jogo.slug}: carrega recurso externo (${externo && externo[0].slice(0, 50)})`);
  });

  cenario(`${jogo.emoji} ${jogo.nome}: preenche a tela em qualquer proporção`, async () => {
    for (const ap of [APARELHOS.desktop, APARELHOS.celular]) {
      const j = await abrir(navegador, arquivo, ap, { esperaBoot: 1800 });
      const m = await j.pagina.evaluate(() => {
        const c = document.querySelector('canvas');
        const r = c.getBoundingClientRect();
        // em pé, alguns jogos escondem o canvas e pedem para girar: isso vale
        const escondido = r.width === 0 && r.height === 0;
        return { escondido, w: r.width, h: r.height, jw: window.innerWidth, jh: window.innerHeight };
      });
      if (!m.escondido) {
        const sobraH = m.jh - m.h;
        const sobraW = m.jw - m.w;
        conferir(
          sobraH <= m.jh * 0.15 && sobraW <= m.jw * 0.15,
          `${jogo.slug} em ${ap.nome}: sobrou ${Math.round(sobraW)}x${Math.round(sobraH)}px de borda`
        );
      }
      await j.fechar();
    }
  });

}

cenario('girar o aparelho não quebra o toque', async () => {
  // O sintoma que motivou este teste: abrir em pé, girar, e o jogo parar de
  // responder ao dedo — enquanto quem abria já deitado jogava normalmente.
  const j = await abrir(navegador, path.join(DIST, 'animais-vs-monstros/index.html'), APARELHOS.celularEmPe, {
    esperaBoot: 900,
  });
  await j.pagina.setViewport({
    width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true,
  });
  await espera(700);

  const m = await j.pagina.evaluate(() => {
    const t = window.__jogo.tela;
    return {
      escala: +t.escala.toFixed(3),
      esperada: +(window.innerHeight / 720).toFixed(3),
      overlay: getComputedStyle(document.getElementById('gire')).pointerEvents,
    };
  });
  conferir(
    m.escala === m.esperada,
    `depois de girar a escala ficou ${m.escala}, devia ser ${m.esperada} — o toque cairia no lugar errado`
  );
  conferir(m.overlay === 'none', 'o aviso de girar não pode interceptar toque quando some');
  await j.fechar();
});

cenario('o catálogo é instalável e o escopo cobre os jogos', async () => {
  const j = await abrir(navegador, path.join(DIST, 'index.html'), APARELHOS.celular, { esperaBoot: 900 });
  const m = await j.pagina.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return { erro: 'o índice não tem manifesto' };
    let man;
    try {
      man = await (await fetch(link.href)).json();
    } catch (e) {
      return { erro: 'manifesto ilegível: ' + e.message };
    }
    return {
      erro: null,
      nome: man.name,
      escopo: man.scope,
      inicio: man.start_url,
      display: man.display,
      icones: (man.icons || []).length,
      ios: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
    };
  });
  conferir(!m.erro, String(m.erro));
  conferir(m.escopo === './', `escopo "${m.escopo}" precisa cobrir as subpastas dos jogos`);
  conferir(m.display === 'standalone', `display é "${m.display}"`);
  conferir(m.icones >= 2, 'precisa de ícone 192 e 512');
  conferir(m.ios, 'falta a meta que o Safari do iOS usa');
  j.exigirSemErros('catálogo');
  await j.fechar();
});

cenario('todo jogo tem saída para o catálogo na tela inicial', async () => {
  for (const jogo of catalogo) {
    const html = readFileSync(path.join(DIST, jogo.slug, 'index.html'), 'utf8');
    const temDom = html.includes('data-voltar-catalogo');
    const temCanvas = html.includes('__catalogo');
    conferir(
      temDom || temCanvas,
      `${jogo.slug}: nenhuma saída para o catálogo — em modo app não há barra de navegador e o jogador fica preso`
    );
    // a definição, não a leitura: o Animais lê `window.__catalogo` no código
    // dele, e isso não é o mesmo que o catálogo ter ativado a volta
    conferir(
      html.includes("window.__catalogo = '../index.html'"),
      `${jogo.slug}: o build do catálogo não ativou a volta`
    );
  }

  // o arquivo do jogo fora do catálogo não recebe o ativador, então nada aparece
  const solto = readFileSync(path.join(RAIZ, 'jogos', catalogo[0].slug, 'dist/index.html'), 'utf8');
  conferir(
    !solto.includes("window.__catalogo = '../index.html'"),
    'quem baixa só o jogo não pode receber link para um catálogo que não tem'
  );
});

cenario('a saída aparece e leva de volta', async () => {
  // os dois caminhos do contrato: link em DOM (todo jogo que tem menu em HTML)
  // e botão desenhado em canvas
  for (const jogo of catalogo) {
    const arquivo = path.join(DIST, jogo.slug, 'index.html');
    // o elemento declarado, não o seletor do script que o build injeta — esse
    // aparece em todo jogo, inclusive nos que desenham a saída em canvas
    if (!/<a\b[^>]*\bdata-voltar-catalogo\b/.test(readFileSync(arquivo, 'utf8'))) continue;

    const j = await abrir(navegador, arquivo, APARELHOS.desktop, { esperaBoot: 3200 });
    const m = await j.pagina.evaluate(() => {
      const l = document.querySelector('[data-voltar-catalogo]');
      if (!l) return { erro: 'sem link' };
      const r = l.getBoundingClientRect();
      return {
        erro: null,
        visivel: !l.hidden && r.width > 0,
        naTela: r.y >= 0 && r.y + r.height <= innerHeight,
        href: l.getAttribute('href'),
        cor: getComputedStyle(l).color,
      };
    });
    conferir(!m.erro, `${jogo.slug}: ${m.erro}`);
    conferir(m.visivel, `${jogo.slug}: a saída devia estar visível dentro do catálogo`);
    conferir(m.naTela, `${jogo.slug}: a saída está fora da área visível`);
    conferir(m.href === '../index.html', `${jogo.slug}: aponta para "${m.href}"`);
    // Um <a> sem `color` no CSS herda o azul de link do navegador. Aqui isso
    // já aconteceu nos três jogos de uma vez: sobre fundo escuro, ilegível.
    // A saída tem que vestir o botão do próprio jogo.
    conferir(
      m.cor !== 'rgb(0, 0, 238)',
      `${jogo.slug}: a saída ficou com o azul padrão de link — falta dar a ela o estilo do jogo`
    );
    await j.fechar();
  }

  // no Animais a saída é desenhada em canvas: confere que ela existe na barra
  const a = await abrir(navegador, path.join(DIST, 'animais-vs-monstros/index.html'), APARELHOS.desktop, {
    esperaBoot: 900,
  });
  await a.executar((jogo) => {
    jogo.estado().viuAbertura = true;
    jogo.irParaMapa();
  });
  await a.esperarQuadros(3);
  const temBotao = await a.executar(
    (jogo) => !!window.__catalogo && typeof jogo.atual().clique === 'function'
  );
  conferir(temBotao, 'animais-vs-monstros: a barra do mapa devia oferecer a volta');
  await a.fechar();
});

cenario('o índice lista todos os jogos e cada link existe', async () => {
  const j = await abrir(navegador, path.join(DIST, 'index.html'), APARELHOS.desktop, { esperaBoot: 800 });
  const cards = await j.pagina.$$eval('.card', (els) => els.map((e) => e.getAttribute('href')));
  conferir(cards.length === catalogo.length, `${cards.length} cards para ${catalogo.length} jogos`);
  for (const href of cards) {
    conferir(existsSync(path.join(DIST, href)), `link quebrado no índice: ${href}`);
  }
  j.exigirSemErros('índice');
  await j.fechar();
});

await rodar('catálogo');
await navegador.close();
