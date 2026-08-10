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
  cpSync(gerado, join(DIST, jogo.slug, 'index.html'), { force: true });
  console.log(`${kb(tamanho)} KB`);
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

const indice = template
  .replace('<!--__JOGOS__-->', () => cards)
  .replace('<!--__TOTAL__-->', () => String(catalogo.length));

writeFileSync(join(DIST, 'index.html'), indice, 'utf8');
writeFileSync(join(DIST, '.nojekyll'), '', 'utf8');

console.log(`\n  ✔ dist/index.html  (${catalogo.length} jogos no catálogo)`);
console.log('    Abra com duplo clique — não precisa de servidor.\n');
