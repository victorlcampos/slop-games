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

  const molde = fs.readFileSync(daRaiz(template), 'utf8');
  if (!molde.includes(MARCA)) {
    throw new Error(`${template}: falta a marca ${MARCA} onde o bundle entra`);
  }
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
