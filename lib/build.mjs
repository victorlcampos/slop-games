// O build de todo jogo do slop-games.
//
// Os quatro jogos empacotavam de três jeitos diferentes: esbuild, um bundler ES
// caseiro de 150 linhas e `cat` de arquivos numerados. Cada um com as próprias
// armadilhas, e as mesmas duas cicatrizes repetidas em dois deles. Aqui é um só,
// com dois modos:
//
//   modo 'modulos'      entrada ESM, esbuild resolve os imports (o normal)
//   modo 'concatenado'  arquivos de escopo global, na ordem (o Zoo Magnata)
//
// Nos dois o resultado é o mesmo: um `dist/index.html` que abre com duplo
// clique, minificado, sem uma única referência a arquivo de fora.
//
// As duas armadilhas, que valem para qualquer modo:
//
//   1. `</script>` dentro do bundle fecha a tag no meio do jogo. Precisa escapar.
//   2. `String.replace` interpreta `$&` e `$1` no texto de substituição — e todo
//      bundle minificado tem esses caracteres. Por isso a substituição é sempre
//      por função.

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const MARCA = '/*__APP__*/';

/**
 * @param {object} cfg
 * @param {string} cfg.raiz          pasta do jogo (use import.meta.dirname)
 * @param {string} [cfg.modo]        'modulos' (padrão) ou 'concatenado'
 * @param {string} [cfg.entrada]     modo modulos: arquivo de entrada
 * @param {string[]} [cfg.arquivos]  modo concatenado: na ordem exata
 * @param {string} [cfg.template]    HTML com a marca /*__APP__*\/
 * @param {object} [cfg.alias]       aliases de import (ex.: three → vendor)
 * @param {string[]} [cfg.globais]   modo concatenado: pacotes a expor como global
 * @param {boolean} [cfg.minificar]  padrão true
 * @param {string} [cfg.rodape]      texto colado no fim do bundle
 * @param {object} [cfg.pwa]         { nome, curto, emoji, cor, fundo } — instalável
 */
export async function construir(cfg) {
  const {
    raiz,
    modo = 'modulos',
    entrada = 'src/main.js',
    arquivos = [],
    template = 'template.html',
    alias = {},
    globais = {},
    minificar = true,
    rodape = '',
    pwa = null,
    saida = 'dist/index.html',
  } = cfg;

  if (!raiz) throw new Error('construir: falta `raiz` (passe import.meta.dirname)');
  const daRaiz = (p) => path.resolve(raiz, p);

  let js =
    modo === 'concatenado'
      ? await empacotarConcatenado(daRaiz, arquivos, globais, minificar)
      : await empacotarModulos(daRaiz, entrada, alias, minificar);

  if (rodape) js += '\n' + rodape;

  // 1ª armadilha: o bundle não pode fechar a própria tag
  js = js.replace(/<\/script>/gi, '<\\/script>');

  let molde = fs.readFileSync(daRaiz(template), 'utf8');
  if (!molde.includes(MARCA)) {
    throw new Error(`${template}: falta a marca ${MARCA} onde o bundle entra`);
  }
  // `pwa: true` puxa nome, emoji e descrição do jogo.json — assim não há dois
  // lugares dizendo como o jogo se chama
  const dadosPWA = pwa === true ? lerJogoJson(daRaiz) : pwa;
  if (dadosPWA) molde = injetarPWA(molde, dadosPWA);
  // 2ª armadilha: função, nunca string — o bundle tem $& e $1
  const html = molde.replace(MARCA, () => js);

  conferirAutossuficiente(html);

  fs.mkdirSync(daRaiz(path.dirname(saida)), { recursive: true });
  fs.writeFileSync(daRaiz(saida), html);

  const kb = (html.length / 1024).toFixed(0);
  console.log(`${saida} gerado: ${kb} KB`);
  return { html, bytes: html.length };
}

/** Modo normal: esbuild resolve os imports a partir de uma entrada ESM. */
async function empacotarModulos(daRaiz, entrada, alias, minificar) {
  const res = await esbuild.build({
    entryPoints: [daRaiz(entrada)],
    bundle: true,
    minify: minificar,
    format: 'iife',
    target: ['es2020'],
    write: false,
    logLevel: 'warning',
    alias: Object.fromEntries(Object.entries(alias).map(([k, v]) => [k, daRaiz(v)])),
  });
  return res.outputFiles[0].text;
}

/**
 * Modo do Zoo Magnata: arquivos que compartilham escopo global e dependem da
 * ordem. Não há import para resolver — mas dá para minificar tudo junto e para
 * pendurar pacotes ESM (o slopkit) num global antes, o que devolve a esses
 * jogos o acesso ao kit sem reescrever o escopo inteiro.
 */
async function empacotarConcatenado(daRaiz, arquivos, globais, minificar) {
  let prefixo = '';
  for (const [nomeGlobal, pacote] of Object.entries(globais)) {
    const iife = await esbuild.build({
      stdin: {
        contents: `import * as m from ${JSON.stringify(pacote)}; window.${nomeGlobal} = m;`,
        resolveDir: daRaiz('.'),
        loader: 'js',
      },
      bundle: true,
      minify: minificar,
      format: 'iife',
      target: ['es2020'],
      write: false,
      logLevel: 'warning',
    });
    prefixo += iife.outputFiles[0].text + '\n';
  }

  const corpo = arquivos.map((a) => fs.readFileSync(daRaiz(a), 'utf8')).join('\n');
  if (!minificar) return prefixo + corpo;

  // o corpo é um script clássico (sem import/export): minifica sem bundle
  const min = await esbuild.transform(corpo, { minify: true, target: 'es2020', loader: 'js' });
  return prefixo + min.code;
}

/** Metadados do jogo.json, no formato que o manifesto espera. */
function lerJogoJson(daRaiz) {
  try {
    const j = JSON.parse(fs.readFileSync(daRaiz('jogo.json'), 'utf8'));
    return {
      nome: j.nome,
      curto: j.nome,
      emoji: j.emoji,
      descricao: j.descricao,
      // só quem precisa declara: forçar paisagem num jogo que roda em pé
      // trava o aparelho do jogador à toa
      orientacao: j.orientacao,
    };
  } catch {
    return null;
  }
}

/**
 * Torna o jogo instalável na tela inicial do celular, sem quebrar a regra do
 * arquivo único: o manifesto vai embutido como `data:` URI, e o ícone é um SVG
 * com o emoji do jogo — também embutido.
 *
 * Não há service worker, e não faz falta: o jogo inteiro já é um HTML só, sem
 * nada para buscar na rede. Um SW aqui existiria apenas para cachear o que já
 * está cacheado. O efeito prático do que fica: quem adicionar à tela inicial
 * abre em tela cheia, sem barra de navegador, com ícone e nome próprios.
 */
function injetarPWA(molde, pwa) {
  const {
    nome,
    curto = nome,
    emoji = '🎮',
    fundo = '#16130f',
    descricao = '',
    orientacao = 'any',
  } = pwa;

  // se o jogo já declarou uma cor de tema, ela manda: quem escreveu o HTML
  // sabe melhor que este build qual é a cara do jogo
  const jaTemTema = /<meta[^>]+name=["']theme-color["']/i.test(molde);
  const corTema = (molde.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)/i) || [])[1];
  const cor = pwa.cor || corTema || fundo;

  const icone = (tam) =>
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tam} ${tam}">` +
        `<rect width="${tam}" height="${tam}" fill="${fundo}"/>` +
        `<text x="50%" y="50%" dy=".1em" font-size="${Math.round(tam * 0.62)}" ` +
        `text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
    );

  const manifesto = {
    name: nome,
    short_name: curto,
    description: descricao,
    start_url: './',
    scope: './',
    display: 'fullscreen',
    orientation: orientacao,
    background_color: fundo,
    theme_color: cor,
    icons: [
      { src: icone(192), sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: icone(512), sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };

  const tags = [
    `<link rel="manifest" href="data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifesto))}">`,
    ...(jaTemTema ? [] : [`<meta name="theme-color" content="${cor}">`]),
    // o Safari do iOS ignora o manifesto e lê estas três
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    `<meta name="apple-mobile-web-app-title" content="${curto}">`,
    `<link rel="apple-touch-icon" href="${icone(180)}">`,
    '<meta name="mobile-web-app-capable" content="yes">',
  ].join('\n');

  return molde.replace('</head>', tags + '\n</head>');
}

/** A regra nº 2 do CLAUDE.md, cobrada aqui: um arquivo, nada de fora. */
function conferirAutossuficiente(html) {
  const externo =
    html.match(/<script\b[^>]*\bsrc=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bstylesheet[^>]*\bhref=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bhref=["']?(?!data:|#)[^"'>\s]+[^>]*\bstylesheet/i);
  if (externo) {
    throw new Error(
      `o HTML final carrega recurso externo (${externo[0].slice(0, 60)}…) — ` +
        'o jogo tem que ser um arquivo só, senão não abre por file://'
    );
  }
}
