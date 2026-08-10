// Smoke test do catálogo: abre dist/index.html e cada dist/<slug>/index.html
// por file:// — do jeito que o usuário abre, com duplo clique — e confere que
// a página sobe sem erro de JS e desenha alguma coisa.
//
//   node test/smoke.mjs            -> testa tudo
//   node test/smoke.mjs skifree3d  -> testa só um jogo
//
// Não substitui o teste de cada jogo (jogos/*/test), que exercita a jogabilidade.

import puppeteer from 'puppeteer-core';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const filtro = process.argv.slice(2);

const catalogo = readdirSync(path.join(ROOT, 'jogos'))
  .filter((slug) => {
    try { return statSync(path.join(ROOT, 'jogos', slug, 'jogo.json')).isFile(); } catch { return false; }
  })
  .map((slug) => JSON.parse(readFileSync(path.join(ROOT, 'jogos', slug, 'jogo.json'), 'utf8')))
  .filter((j) => !filtro.length || filtro.includes(j.slug));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1280,800', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions'],
  defaultViewport: { width: 1280, height: 800 },
});

const falhas = [];

/** Abre uma página por file:// e devolve os erros de JS que ela cuspiu. */
async function abrir(arquivo, checagem) {
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

  try {
    await page.goto('file://' + arquivo, { waitUntil: 'load', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500)); // deixa o jogo montar a cena
    await checagem(page);
    return erros.filter((e) => !e.includes('favicon'));
  } finally {
    await page.close();
  }
}

// ------------------------------------------------------------------- índice
if (!filtro.length) {
  process.stdout.write('  🕹️  índice … ');
  try {
    const erros = await abrir(path.join(DIST, 'index.html'), async (page) => {
      const cards = await page.$$eval('.card', (els) => els.map((e) => e.getAttribute('href')));
      if (cards.length !== catalogo.length) {
        throw new Error(`${cards.length} cards para ${catalogo.length} jogos`);
      }
      for (const href of cards) {
        // o link tem que apontar para um arquivo que existe de verdade
        statSync(path.join(DIST, href));
      }
    });
    console.log(erros.length ? `⚠ ${erros.length} erro(s) de console` : 'ok');
    if (erros.length) falhas.push(['índice', erros]);
  } catch (e) {
    console.log('FALHOU');
    falhas.push(['índice', [e.message]]);
  }
}

// -------------------------------------------------------------------- jogos
for (const jogo of catalogo) {
  process.stdout.write(`  ${jogo.emoji}  ${jogo.nome} … `);
  const arquivo = path.join(DIST, jogo.slug, 'index.html');
  try {
    const erros = await abrir(arquivo, async (page) => {
      // todo jogo aqui desenha em canvas; se não tem canvas, não subiu
      const temCanvas = await page.$('canvas');
      if (!temCanvas) throw new Error('nenhum <canvas> na página');
      const titulo = await page.title();
      if (!titulo) throw new Error('página sem <title>');
    });
    console.log(erros.length ? `⚠ ${erros.length} erro(s) de console` : 'ok');
    if (erros.length) falhas.push([jogo.slug, erros]);
  } catch (e) {
    console.log('FALHOU');
    falhas.push([jogo.slug, [e.message]]);
  }
}

await browser.close();

if (falhas.length) {
  console.log('');
  for (const [nome, erros] of falhas) {
    console.log(`  ✗ ${nome}:`);
    for (const e of erros.slice(0, 6)) console.log(`      ${e}`);
  }
  console.log('\nSMOKE FAIL\n');
  process.exitCode = 1;
} else {
  console.log('\n  ✔ tudo abre por file:// sem erro\n');
}
