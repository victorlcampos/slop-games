# slop-games — regras da casa

Coleção de jogos que rodam inteiros no navegador. Cada jogo é **um único arquivo
HTML** que abre com duplo clique: sem servidor, sem instalação, sem conta, sem
backend.

Este documento vale para qualquer jogo do repositório — os que já existem e os
que ainda vão nascer.

---

## 1. O que não se negocia

Estas cinco regras definem o projeto. Se uma ideia esbarra em qualquer uma delas,
a ideia muda — não a regra.

1. **100% do lado do cliente.** Nenhum backend, nenhuma build server-side,
   nenhum banco. O que o jogo precisa guardar vai em `localStorage`.
2. **Um único `index.html`.** O artefato final é um arquivo só, com HTML, CSS,
   JS e assets embutidos. Nada de `<script src>`, `<link rel=stylesheet>`,
   `<img src>` ou `fetch` apontando para arquivo vizinho — via `file://` isso
   quebra (ou esbarra em CORS).
3. **Tem que abrir com duplo clique.** O teste de aceitação é literal: abrir o
   `dist/<slug>/index.html` pelo Finder, sem servidor local, e o jogo rodar. Se
   precisa de `python -m http.server` para funcionar, está errado.
4. **Zero CDN, zero asset externo.** Nada de `unpkg`, `jsdelivr`, Google Fonts,
   sprite baixado, música em `.mp3` remoto. Tudo que o jogo usa está dentro do
   arquivo. Bibliotecas entram pelo bundler, não por `<script src>`.
5. **Assets gerados por código.** Sprites, texturas, terreno, som — tudo
   desenhado/sintetizado em runtime. É o que mantém o arquivo pequeno e o
   projeto sem pasta de binários. Os três jogos atuais não têm **uma única
   imagem**: o Zoo Magnata desenha 219 espécies a partir de 28 planos corporais
   parametrizados, o SkiFree 3D gera terreno e neve por ruído, o World Drive
   monta o cenário a partir de dados vetoriais.

### "Roda no cliente" ≠ "roda offline"

Um jogo pode consultar uma API pública em runtime e continuar 100% cliente — é o
caso do World Drive, que busca as ruas no Overpass (OpenStreetMap). O que não
pode é ter **backend próprio**. Quando o jogo depende de rede, marque
`"offline": false` no `jogo.json` e explique em `"nota"` — o índice mostra o selo
"precisa de rede" para o jogador não se frustrar.

---

## 2. Anatomia de um jogo

Todo jogo mora em `jogos/<slug>/` e cumpre este contrato:

```
jogos/<slug>/
  jogo.json        # metadados — é o que alimenta o índice
  package.json     # precisa de um script "build"
  build.mjs        # gera dist/index.html
  src/             # o código de verdade, em módulos
  dist/index.html  # gerado, fora do git
  README.md        # como jogar, controles, o que tem de interessante
```

Só duas coisas são obrigatórias, e o build da raiz cobra as duas:

- **`jogo.json`** com o `slug` batendo com o nome da pasta.
- **`npm run build` gerando `dist/index.html`** autossuficiente — o orquestrador
  verifica se sobrou referência externa e falha o build se sobrou.

O resto (nome do bundler, organização de `src/`) é escolha de cada jogo.

### `jogo.json`

```json
{
  "slug": "meu-jogo",
  "nome": "Meu Jogo",
  "emoji": "🎮",
  "descricao": "Uma frase que dê vontade de clicar. Sem adjetivo vazio.",
  "tags": ["2d", "puzzle"],
  "libs": ["three.js"],
  "offline": true,
  "nota": "Só quando offline:false — o que exatamente precisa de rede.",
  "ano": 2026
}
```

`libs: []` vira "sem dependências" no card, que é um selo de honra aqui.

---

## 3. Tecnologias

### Use

| Para | Use | Por quê |
|---|---|---|
| 3D | **three.js** (`npm i three`) | É o que os jogos 3D daqui usam. Bundler faz tree-shaking. |
| 2D | **Canvas 2D puro** | Nenhuma lib 2D justifica seu peso. O Zoo Magnata é 385 KB **com** 219 espécies desenhadas. |
| Som | **Web Audio API** na mão | Osciladores e ruído sintetizado. Nunca arquivo de áudio. |
| UI/HUD | **DOM + CSS puro** | Sobreposto ao canvas. É mais rápido de mexer que UI dentro do canvas. |
| Estado salvo | **`localStorage`** | Único armazenamento disponível sem backend. |
| Build | **esbuild** | Rápido, uma dependência, `bundle + minify` resolve tudo. |

### Evite

- **Framework de UI** (React, Vue, Svelte) — o jogo é um canvas com HUD; o
  framework é peso e indireção sem retorno.
- **Engine de jogo** (Phaser, PixiJS, Babylon) — resolvem problemas que estes
  jogos não têm e engordam o arquivo. Canvas 2D e three.js dão conta.
- **TypeScript** — nenhum jogo aqui usa; adiciona etapa de build sem ganho nesta
  escala. Se um jogo novo quiser, que seja decisão consciente e isolada nele.
- **Qualquer coisa que exija servidor** — WebSockets próprios, multiplayer com
  backend, upload de save.

### Peso do arquivo

Referência dos jogos atuais: Zoo Magnata 377 KB (sem libs), World Drive 581 KB
(three.js minificado), SkiFree 3D 1,6 MB (three.js **sem** minificar — o bundler
caseiro dele não minifica, e é o motivo de ser o maior dos três).

Passou de ~2 MB, investigue antes de aceitar: quase sempre é asset embutido como
base64 ou bundle sem minificar.

---

## 4. Criando um jogo novo

```bash
mkdir -p jogos/meu-jogo/src
cd jogos/meu-jogo
```

**1. `package.json`** — o nome tem que bater com o slug:

```json
{
  "name": "meu-jogo",
  "version": "1.0.0",
  "description": "Uma frase.",
  "type": "module",
  "private": true,
  "scripts": { "build": "node build.mjs" },
  "license": "MIT",
  "dependencies": { "three": "^0.185.1" }
}
```

**2. `build.mjs`** — este é o padrão para jogos novos (copiado do World Drive,
que é o mais limpo dos três):

```js
// Bundle de src/main.js + inline no template => dist/index.html (arquivo único)
import * as esbuild from 'esbuild';
import fs from 'node:fs';

const res = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  logLevel: 'warning',
});

let js = res.outputFiles[0].text;
js = js.replace(/<\/script>/gi, '<\\/script>');   // não deixa o bundle fechar a tag

const template = fs.readFileSync('template.html', 'utf8');
if (!template.includes('/*__APP__*/')) throw new Error('placeholder ausente no template');
const html = template.replace('/*__APP__*/', () => js);   // função: o bundle tem $& e $1

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html gerado:', (html.length / 1024).toFixed(0) + ' KB');
```

Os dois detalhes comentados acima já morderam este projeto. Não os remova:
escapar `</script>` evita que uma string no bundle feche a tag no meio do jogo, e
passar **função** para o `.replace` evita que `$&` dentro do código minificado
seja interpretado como padrão de substituição.

**3. `template.html`** — HTML, CSS e o placeholder do bundle:

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meu Jogo</title>
<style> /* CSS inteiro aqui — nada de arquivo separado */ </style>
</head>
<body>
  <canvas id="tela"></canvas>
  <div id="hud"><!-- HUD em DOM --></div>
<script>/*__APP__*/</script>
</body>
</html>
```

**4. `jogo.json`** com os metadados (seção 2).

**5. Registre as dependências** — na raiz do repositório:

```bash
npm install          # o workspace jogos/* pega o jogo novo sozinho
npm run build        # builda tudo e regenera o índice
npm test             # confere que abre por file://
```

O índice **não precisa ser editado**: ele é gerado a partir dos `jogo.json`.

---

## 5. Build

Tudo pela raiz:

```bash
npm install            # uma vez (npm workspaces cuida dos jogos)
npm run build          # builda os três jogos + o índice -> dist/
npm run build zoo-magnata   # builda só um jogo (e o índice)
npm run abrir          # builda e abre o índice no navegador
npm test               # smoke test: abre tudo por file:// e checa erro de JS
```

O `build.mjs` da raiz roda o `npm run build` de cada jogo, valida que o
`dist/index.html` gerado não tem referência externa, copia para
`dist/<slug>/index.html` e monta o `dist/index.html` do índice a partir de
`site/index.html` + os `jogo.json`.

`dist/` é gerado e **não vai para o git**. Quem clona roda `npm run build`.

### Os builds legados

Dois jogos vieram de repositórios separados com build próprio. Funcionam e não
serão reescritos sem motivo:

- **zoo-magnata** — `build.sh` concatena `src/01_head.html` … `src/09_game.js`
  na ordem. Os módulos compartilham escopo global (não são ES modules), então a
  **ordem dos arquivos importa** e renomear quebra. Para adicionar código, crie
  um arquivo numerado na posição certa e inclua no `cat`.
- **skifree3d** — `build.js` é um bundler ES caseiro de ~150 linhas, sem
  dependência: reescreve `import`/`export` por regex e costura tudo em
  `index.html`. Ele só entende a sintaxe estática que o projeto usa — uma forma
  de `export` fora do padrão faz o build falhar com mensagem explícita. O
  `vendor/` traz o three.js vendorizado.

**Jogo novo usa esbuild** (seção 4). Os legados ficam como estão.

---

## 6. Testes

Cada jogo pode ter o seu (`jogos/*/test/`), e o World Drive tem um que dirige de
verdade e confere a velocidade. Além deles, o teste da raiz vale para todos:

```bash
npm test               # todos
node test/smoke.mjs skifree3d   # só um
```

Ele abre cada `dist/<slug>/index.html` **por `file://`** — exatamente como o
jogador abre — e reprova se a página não desenha um `<canvas>`, se não tem
`<title>` ou se algum erro de JS aparece no console. Usa `puppeteer-core` com o
Chrome do sistema (`CHROME=/caminho/do/chrome` para apontar outro).

Rode antes de publicar. É o teste que pega a regra nº 3.

---

## 7. Publicação

Push na `main` publica. O GitHub Actions roda `npm ci`, `node build.mjs` e joga o
`dist/` no GitHub Pages:

- Índice: `https://victorlcampos.github.io/slop-games/`
- Jogo: `https://victorlcampos.github.io/slop-games/<slug>/`

Não existe deploy manual e não se commita `dist/`. Para conferir antes de subir,
`npm run abrir`.

---

## 8. Convenções de código

- **Português nos comentários, README e mensagem de commit.** Identificadores e
  APIs seguem em inglês onde já são (`three`, `requestAnimationFrame`); o
  vocabulário do domínio do jogo pode ser em português, e é o que os jogos atuais
  fazem.
- **Comentário explica o porquê, não o quê.** Os bons comentários deste repo
  registram a armadilha ("a substituição PRECISA ser por função: o bundle contém
  `$&`"), não a operação.
- **Sem dependência nova sem necessidade real.** Cada `npm i` precisa justificar
  o peso no arquivo final. Em dúvida, escreva as 40 linhas.
- **`src/` em módulos pequenos e temáticos** — `render`, `input`, `audio`,
  `world`, `entities`. Nenhum arquivo de 3000 linhas.
- **README de cada jogo** com controles e o que o jogo tem de interessante.
