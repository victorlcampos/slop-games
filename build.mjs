#!/usr/bin/env node
// Builda todos os jogos e monta o índice em dist/.
//
//   node build.mjs              -> builda tudo
//   node build.mjs zoo-magnata  -> builda só um jogo (e o índice)
//
// Resultado: dist/index.html (o índice) + dist/<slug>/index.html (cada jogo).
// Tudo abre com duplo clique — os links são relativos, então funciona por file://
// do mesmo jeito que funciona no GitHub Pages.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const JOGOS = join(ROOT, 'jogos');
const DIST = join(ROOT, 'dist');

const filtro = process.argv.slice(2);
const kb = (bytes) => (bytes / 1024).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ------------------------------------------------------------------ catálogo
const catalogo = readdirSync(JOGOS)
  .filter((slug) => {
    try {
      return statSync(join(JOGOS, slug, 'jogo.json')).isFile();
    } catch {
      return false;
    }
  })
  .map((slug) => {
    const meta = JSON.parse(readFileSync(join(JOGOS, slug, 'jogo.json'), 'utf8'));
    if (meta.slug !== slug) {
      throw new Error(`jogos/${slug}/jogo.json: campo "slug" diz "${meta.slug}", devia dizer "${slug}"`);
    }
    return meta;
  })
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

if (!catalogo.length) throw new Error('nenhum jogo encontrado em jogos/*/jogo.json');

const aBuildar = filtro.length ? catalogo.filter((j) => filtro.includes(j.slug)) : catalogo;
for (const slug of filtro) {
  if (!catalogo.some((j) => j.slug === slug)) throw new Error(`jogo desconhecido: ${slug}`);
}

// -------------------------------------------------------------------- build
if (!filtro.length) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const jogo of aBuildar) {
  const pasta = join(JOGOS, jogo.slug);
  process.stdout.write(`  ${jogo.emoji}  ${jogo.nome} … `);

  execFileSync('npm', ['run', '--silent', 'build'], { cwd: pasta, stdio: ['ignore', 'ignore', 'inherit'] });

  const gerado = join(pasta, 'dist/index.html');
  let tamanho;
  try {
    tamanho = statSync(gerado).size;
  } catch {
    throw new Error(`\n${jogo.slug}: o build não gerou dist/index.html — veja o contrato no CLAUDE.md`);
  }

  // O jogo tem que ser autossuficiente: nada de <script src> nem <link stylesheet>
  // apontando para fora do arquivo, senão ele não abre por file://.
  const html = readFileSync(gerado, 'utf8');
  const externo =
    html.match(/<script\b[^>]*\bsrc=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bstylesheet[^>]*\bhref=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bhref=["']?(?!data:|#)[^"'>\s]+[^>]*\bstylesheet/i);
  if (externo) {
    throw new Error(`\n${jogo.slug}: dist/index.html carrega arquivo externo (${externo[0].slice(0, 60)}…) — o jogo tem que ser um HTML só`);
  }

  mkdirSync(join(DIST, jogo.slug), { recursive: true });
  // A cópia do catálogo ganha o caminho de volta; o arquivo do jogo em
  // jogos/<slug>/dist continua puro, para quem baixa só ele.
  writeFileSync(join(DIST, jogo.slug, 'index.html'), comVoltaAoCatalogo(html), 'utf8');
  console.log(`${kb(tamanho)} KB`);
}

/**
 * Botão de volta ao catálogo, injetado só na cópia publicada.
 *
 * O catálogo é o app instalável, e os jogos vivem dentro do escopo dele. Em
 * modo app não existe barra de navegador: sem isto, quem entra num jogo fica
 * preso — no Android ainda há o botão voltar do sistema, no iOS não há nada.
 *
 * Por isso a media query: fora do modo app o botão nem aparece, porque lá o
 * navegador já tem o "voltar" dele e um botão a mais só rouba canto de tela.
 */
function comVoltaAoCatalogo(html) {
  const estilo = `<style>
  #voltar-catalogo { display: none; }
  @media (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui) {
    #voltar-catalogo {
      display: grid;
      place-items: center;
      position: fixed;
      left: calc(env(safe-area-inset-left) + 6px);
      top: calc(env(safe-area-inset-top) + 6px);
      width: 34px; height: 34px;
      z-index: 99;
      border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,.35);
      background: rgba(20,18,16,.5);
      color: #fff;
      font: 16px/1 system-ui, sans-serif;
      text-decoration: none;
      opacity: .35;
      -webkit-backdrop-filter: blur(3px);
      backdrop-filter: blur(3px);
      transition: opacity .15s;
    }
    #voltar-catalogo:active { opacity: 1; }
  }
</style>`;
  const botao = '<a id="voltar-catalogo" href="../index.html" aria-label="Voltar ao catálogo">←</a>';
  return html.replace('</head>', estilo + '\n</head>').replace('</body>', botao + '\n</body>');
}

// -------------------------------------------------------------------- índice
const cards = catalogo
  .map((jogo) => {
    const selo = jogo.offline
      ? '<span class="selo selo--offline" title="Roda sem internet">offline</span>'
      : '<span class="selo selo--online" title="Precisa de internet">precisa de rede</span>';
    const tags = jogo.tags.map((t) => `<li>${t}</li>`).join('');
    const libs = jogo.libs.length ? jogo.libs.join(' · ') : 'sem dependências';
    return `        <a class="card" href="./${jogo.slug}/index.html">
          <span class="card__emoji" aria-hidden="true">${jogo.emoji}</span>
          <h2 class="card__nome">${jogo.nome}</h2>
          <p class="card__desc">${jogo.descricao}</p>
          <ul class="card__tags">${tags}</ul>
          <footer class="card__pe"><span class="card__libs">${libs}</span>${selo}</footer>
        </a>`;
  })
  .join('\n');

const template = readFileSync(join(ROOT, 'site/index.html'), 'utf8');
if (!template.includes('<!--__JOGOS__-->')) throw new Error('site/index.html: placeholder <!--__JOGOS__--> ausente');

// o índice também é instalável: quem adiciona à tela inicial ganha o catálogo
// inteiro num ícone, e de lá abre qualquer jogo
const manifestoIndice = {
  name: 'slop-games',
  short_name: 'slop-games',
  description: 'Jogos que rodam inteiros no navegador.',
  start_url: './',
  scope: './',
  // standalone (e não fullscreen): mantém a barra de status do sistema, que é
  // onde o usuário vê horas e bateria enquanto joga
  display: 'standalone',
  background_color: '#0c0d12',
  theme_color: '#0c0d12',
  icons: [192, 512].map((t) => ({
    src:
      'data:image/svg+xml,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}">` +
          `<rect width="${t}" height="${t}" fill="#0c0d12"/>` +
          `<text x="50%" y="50%" dy=".1em" font-size="${Math.round(t * 0.62)}" ` +
          `text-anchor="middle" dominant-baseline="middle">🕹️</text></svg>`
      ),
    sizes: `${t}x${t}`,
    type: 'image/svg+xml',
    purpose: t === 512 ? 'maskable' : 'any',
  })),
};

const tagsPWA = [
  `<link rel="manifest" href="data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifestoIndice))}">`,
  '<meta name="theme-color" content="#0c0d12">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="slop-games">',
  `<link rel="apple-touch-icon" href="${manifestoIndice.icons[0].src}">`,
].join('\n');

const indice = template
  .replace('</head>', () => tagsPWA + '\n</head>')
  .replace('<!--__JOGOS__-->', () => cards)
  .replace('<!--__TOTAL__-->', () => String(catalogo.length));

writeFileSync(join(DIST, 'index.html'), indice, 'utf8');
writeFileSync(join(DIST, '.nojekyll'), '', 'utf8');

console.log(`\n  ✔ dist/index.html  (${catalogo.length} jogos no catálogo)`);
console.log('    Abra com duplo clique — não precisa de servidor.\n');
