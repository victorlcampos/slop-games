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

  cenario(`${jogo.emoji} ${jogo.nome}: dá para instalar na tela inicial`, async () => {
    const j = await abrir(navegador, arquivo, APARELHOS.celular, { esperaBoot: 1200 });
    const m = await j.pagina.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return { erro: 'sem <link rel=manifest>' };
      let man;
      try {
        man = await (await fetch(link.href)).json();
      } catch (e) {
        return { erro: 'manifesto ilegível: ' + e.message };
      }
      return {
        erro: null,
        nome: man.name,
        icones: (man.icons || []).length,
        temas: document.querySelectorAll('meta[name="theme-color"]').length,
        ios: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
      };
    });
    conferir(!m.erro, `${jogo.slug}: ${m.erro}`);
    conferir(m.nome === jogo.nome, `${jogo.slug}: manifesto diz "${m.nome}", jogo.json diz "${jogo.nome}"`);
    conferir(m.icones >= 2, `${jogo.slug}: precisa de ícone 192 e 512`);
    conferir(m.temas === 1, `${jogo.slug}: ${m.temas} tags theme-color — devia ser exatamente uma`);
    conferir(m.ios, `${jogo.slug}: falta a meta que o Safari do iOS usa`);
    await j.fechar();
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
