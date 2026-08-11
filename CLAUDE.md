# slop-games — regras da casa

Coleção de jogos que rodam inteiros no navegador. Cada jogo é **um único arquivo
HTML** que abre com duplo clique: sem servidor, sem instalação, sem conta, sem
backend.

Este documento vale para qualquer jogo do repositório — os que já existem e os
que ainda vão nascer.

---

## 1. O que não se negocia

Estas seis regras definem o projeto. Se uma ideia esbarra em qualquer uma delas,
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
   projeto sem pasta de binários. Nenhum jogo daqui tem **uma única imagem**: o
   Zoo Magnata desenha 219 espécies a partir de 28 planos corporais
   parametrizados, o SkiFree 3D gera terreno e neve por ruído, o World Drive
   monta o cenário a partir de dados vetoriais, e o Animais vs Monstros desenha
   33 criaturas com um motor de traço torto de 200 linhas. Até as bandeiras do
   seletor de idioma são desenhadas em canvas — o emoji 🇧🇷 não tem glifo no
   Windows, e ali o seletor viraria as letras "BR" numa caixinha.
6. **Todo jogo fala português e inglês.** Duas bandeiras, uma escolha, e ela
   vale para o catálogo inteiro. O mecanismo mora no slopkit (seção 2c) — não
   se reimplementa por jogo.

### "Roda no cliente" ≠ "roda offline"

Um jogo pode consultar uma API pública em runtime e continuar 100% cliente — é o
caso do World Drive, que busca as ruas no Overpass (OpenStreetMap). O que não
pode é ter **backend próprio**. Quando o jogo depende de rede, marque
`"offline": false` no `game.json` e explique em `"note"` — o índice mostra o selo
"precisa de rede" para o jogador não se frustrar.

---

## 2. Anatomia de um jogo

Todo jogo mora em `games/<slug>/` e cumpre este contrato:

```
games/<slug>/
  game.json        # metadados — é o que alimenta o índice
  package.json     # precisa de um script "build" (e um "test", se tiver)
  build.mjs        # gera dist/index.html
  src/             # o código de verdade, em módulos
  test/            # o teste do jogo, sobre slopkit/testing
  dist/index.html  # gerado, fora do git
  README.md        # como jogar, controles, o que tem de interessante
```

Só duas coisas são obrigatórias, e o build da raiz cobra as duas:

- **`game.json`** com o `slug` batendo com o nome da pasta, e `name`/`description`
  nas duas línguas.
- **`npm run build` gerando `dist/index.html`** autossuficiente — o orquestrador
  verifica se sobrou referência externa e falha o build se sobrou.

Duas outras são fortemente recomendadas, e o teste do catálogo usa quando existem:

- **`window.__game`** com pelo menos `{ name, viewport, i18n }`, onde `viewport`
  expõe `W` e `H` (as medidas lógicas). É por aí que o teste converte toque em
  coordenada sem chutar — veja a seção 6 — e é por `i18n` que ele confere que a
  bandeira troca de verdade.

O **slug fica como está**, mesmo em português: ele é a URL publicada
(`/animais-vs-monstros/`), e o jogo já tem os dois nomes pelo `game.json`.

O resto (nome do bundler, organização de `src/`) é escolha de cada jogo.

### `game.json`

```json
{
  "slug": "meu-jogo",
  "name": { "pt": "Meu Jogo", "en": "My Game" },
  "emoji": "🎮",
  "description": {
    "pt": "Uma frase que dê vontade de clicar. Sem adjetivo vazio.",
    "en": "One line that makes you want to click. No empty adjectives."
  },
  "tags": ["2d", "puzzle"],
  "libs": ["three.js"],
  "offline": true,
  "note": { "pt": "Só quando offline:false…", "en": "Only when offline:false…" },
  "year": 2026
}
```

`libs: []` vira "sem dependências" no card, que é um selo de honra aqui.

As **tags são slugs em inglês** (`tower-defense`, `open-world`) e a tradução
mora em `TAGS`, no `build.mjs` da raiz — em um lugar só. Tag desconhecida faz o
build falhar, em vez de aparecer crua no card.

`name` e `description` sem os dois lados **derrubam o build**. É de propósito:
meia tradução é o tipo de coisa que só aparece quando alguém troca de bandeira.

---

## 2b. O slopkit

Os quatro jogos resolviam os mesmos sete problemas — tela, laço, save, mudo — e
cada um resolvia de um jeito. O `lib/` guarda a melhor resposta de cada um, e
jogo novo começa daí em vez de reinventar (pior).

```bash
npm i slopkit          # já é workspace: basta declarar a dependência
```

```js
import { createViewport, createLoop, createSave, createSound, createI18n } from 'slopkit';
```

### O que veio de onde

Isto não é opinião: cada peça foi escolhida comparando as quatro
implementações que já existiam.

| Peça | Veio do | Por que ganhou |
|---|---|---|
| `viewport` — largura elástica | Animais vs Monstros | altura lógica fixa, largura acompanhando a proporção: preenche qualquer monitor sem barra nem distorção |
| `viewport` — teto de DPR | Zoo Magnata | teto **adaptativo** (1.6 em celular pequeno, 2 no resto); DPR 3 triplica a área de pintura sem ganho visível num traço cartoon |
| `loop` — passo fixo | Zoo Magnata | era o único com acumulador e guarda; os outros três usavam dt cru, e com dt cru o jogo se comporta diferente a 60 e a 144 Hz |
| `save` — um formato só | Zoo Magnata | o mesmo retrato serve ao autosave e ao arquivo. Dois formatos viram dois saves divergindo |
| `save` — normalizar | Animais vs Monstros | todo save lido passa por uma função que preenche o que falta; save velho perde um campo, nunca a partida |
| `save` — baixar arquivo | Zoo Magnata | `revokeObjectURL` com folga (revogar cedo cancela o download no Safari) |
| `sound` — mudo persistido | 3 dos 4 | o Animais era o único que esquecia a escolha ao recarregar |
| `i18n` — dicionário por frase | novo | com um objeto por idioma, uma chave existe num e some no outro sem ninguém ver |

### As regras que saíram disso

1. **Simulação em passo fixo, desenho livre.** `update(h)` recebe sempre o
   mesmo `h`. Se o seu `update` usa o dt que chega, o jogo muda de
   comportamento conforme o monitor de quem joga.
2. **Nunca confie no que leu do disco.** Todo save passa por `normalize`. O
   jogo precisa abrir mesmo com um save de duas versões atrás, editado à mão.
3. **A altura lógica é fixa; a largura, não.** Desenhe contra `H` e leia `W`.
   Elemento com posição absoluta em X só sobrevive dentro de uma *moldura* —
   e moldura **escala** quando a tela é mais estreita que ela, senão vaza
   (um monitor 16:10 dá 1152 de largura lógica, não 1280).
4. **Teto de DPR.** Renderizar em 3x um traço cartoon é gastar três vezes mais
   para ninguém ver diferença.

### Quem usa o quê

Os quatro jogos compartilham build e teste. Do resto, cada um adotou o que tinha
ganho real — migrar código bom por código equivalente é risco sem retorno:

| | build | teste | save | viewport | loop | sound | i18n |
|---|---|---|---|---|---|---|---|
| Animais vs Monstros | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SkiFree 3D | ✅ | ✅ | ✅ | — | — | — | ✅ |
| World Drive | ✅ | ✅ | ✅ | — | — | — | ✅ |
| Zoo Magnata | ✅ | ✅ | — | — | — | — | ✅ |

O Zoo é a origem de metade do kit — o save, a tela e o laço dele **são** o
padrão; só não importa o módulo porque roda em escopo global (tem `window.Slop`
disponível se precisar). SkiFree e World Drive têm a tela gerenciada pelo
renderer do three, então `slopkit/tela` não se aplica a eles.

Sobre o laço, o critério **não é 2D contra 3D** — é se a aceleração depende da
velocidade que ela mesma altera:

```js
// Animais vs Monstros — velocidade constante, dt entra linear:
m.x -= velocidade * dt;        // dois passos de dt/2 dão o mesmo que um de dt

// SkiFree e World Drive — arrasto em função da própria velocidade:
a -= drag * v * v;             // o arrasto muda quando v muda…
v += a * dt;                   // …então subdividir dt dá outro resultado
```

Na primeira forma passo fixo é troca livre — foi por isso que o Animais, que é
2D mas poderia ser qualquer coisa, migrou sem rebalancear nada. Na segunda, o
tamanho do passo altera a velocidade terminal e a curva de aceleração: o jogo
responde diferente e os recordes salvos deixam de ser comparáveis. Migrar é
possível, mas vem com playtest e reajuste de constantes — trabalho de design,
não de estilo.

(Cuidado com o palpite fácil: o `damp` exponencial que o SkiFree usa em tudo —
`lerp(a, b, 1 - exp(-λ·dt))` — **é** invariante a subdivisão de dt, de propósito.
O problema está só na integração da velocidade.)

---

## 2c. As duas bandeiras

Todo jogo daqui fala português e inglês. A escolha mora numa chave que o
catálogo inteiro compartilha (`slop:lang`), então escolher inglês no índice vale
para o jogo que abrir em seguida. Na primeira visita o idioma vem do navegador.

```js
import { createI18n, mountLangPicker, bindText } from 'slopkit';
const i18n = createI18n({ dict: { play: { pt: 'Jogar', en: 'Play' } } });
```

**O dicionário é indexado por frase, não por idioma.** É a decisão que mais
importa aqui:

```js
// certo: a tradução que falta aparece na linha que você está editando
{ play: { pt: 'Jogar', en: 'Play' } }

// errado: `en.play` pode simplesmente não existir, e você só descobre
// quando um jogador troca de bandeira e vê a chave crua na tela
{ pt: { play: 'Jogar' }, en: { /* … */ } }
```

`missingKeys(dict)` transforma isso em teste. Use.

### Onde a tradução vai

Não há um lugar só, e não deveria haver — o texto mora perto do que ele nomeia:

| A frase é… | Escreva assim | Quem usa |
|---|---|---|
| copy estática de menu em HTML | `data-pt` / `data-en` no próprio elemento | SkiFree, World Drive, índice |
| atributo (title, placeholder) | `data-en-title="…"` | World Drive, Zoo |
| campo de uma tabela de dados densa | `'Savana\|Savanna'`, lido por um `LN()` do jogo | Zoo (219 espécies) |
| frase montada em runtime | dicionário + `t('key', { n })` | todos |

`bindText(i18n)` cuida das duas primeiras formas: acha os elementos marcados e
troca o texto a cada mudança de bandeira. Como o texto está no HTML, ele
aparece **antes** de qualquer JavaScript rodar — não há flash de tela vazia.

### O seletor

```js
mountLangPicker(i18n);              // preenche todo [data-lang-picker] da página
drawLangPicker(ctx, i18n, { x, y }) // jogo que desenha o menu em canvas
```

O de canvas devolve as zonas de toque; `pickLangAt(zonas, x, y)` diz em qual
bandeira o dedo caiu. As duas versões pintam a mesma bandeira: `drawFlag`
desenha em qualquer contexto 2D e `flagDataURL` roda a mesma rotina num canvas
fora da tela para o DOM usar como `<img>`.

**Jogo em canvas ganha i18n quase de graça** — a tela é repintada por quadro, e
trocar de idioma é o quadro seguinte ler outra string. O que precisa de atenção
é o cache de sprite: se o desenho tem texto embutido, a chave do cache precisa
incluir o idioma. E se o sprite é semeado pelo nome, guarde uma identidade
estável (o Zoo tem `sp.key`) — senão trocar de bandeira redesenha 219 bichos.

---

## 3. Tecnologias

### Use

| Para | Use | Por quê |
|---|---|---|
| 3D | **three.js** (`npm i three`) | É o que os jogos 3D daqui usam. Bundler faz tree-shaking. |
| 2D | **Canvas 2D puro** | Nenhuma lib 2D justifica seu peso. O Zoo Magnata é 377 KB **com** 219 espécies desenhadas; o Animais vs Monstros, 98 KB com 30. |
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

Referência dos jogos atuais: Animais vs Monstros 111 KB e Zoo Magnata 268 KB
(ambos sem libs), World Drive 584 KB e SkiFree 3D 690 KB (three.js minificado
junto). Os dois últimos carregam o three inteiro — é o preço do 3D.

Passou de ~2 MB, investigue antes de aceitar: quase sempre é asset embutido como
base64 ou bundle sem minificar.

---

## 4. Criando um jogo novo

```bash
mkdir -p games/meu-jogo/src
cd games/meu-jogo
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

**2. `build.mjs`** — três linhas, porque o build mora no kit (seção 5):

```js
import { build } from 'slopkit/build';

await build({ root: import.meta.dirname });
```

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

**4. `game.json`** com os metadados (seção 2).

**5. Ligue o slopkit** — tela, laço, save, som e idioma já resolvidos (2b e 2c):

```js
import { createViewport, createLoop, createSave, createI18n } from 'slopkit';

const i18n = createI18n({ dict: { play: { pt: 'Jogar', en: 'Play' } } });

const vp = createViewport(document.getElementById('canvas'));
vp.watch(() => reposition());

const vault = createSave({ game: 'meu-jogo', version: 1, initial: freshSave, normalize, i18n });
let state = vault.load();

createLoop({
  step: 1 / 60,
  update: (h) => world.tick(h),       // h é sempre o mesmo
  draw: () => { vp.begin(); paint(vp.ctx); },
}).start();

window.__game = { name: 'meu-jogo', viewport: vp, i18n };   // ponte de teste (seção 6)
```

**6. Registre e confira** — na raiz do repositório:

```bash
npm install          # o workspace games/* pega o jogo novo sozinho
npm run build        # builda tudo e regenera o índice
npm test             # confere que abre por file:// e cumpre o piso
```

O índice **não precisa ser editado**: ele é gerado a partir dos `game.json`.

---

## 5. Build

Tudo pela raiz:

```bash
npm install            # uma vez (npm workspaces cuida dos jogos e do lib)
npm run build          # builda todos os jogos + o índice -> dist/
npm run build zoo-magnata   # builda só um jogo (e o índice)
npm run open           # builda e abre o índice no navegador
```

O `build.mjs` da raiz roda o `npm run build` de cada jogo, valida o resultado,
copia para `dist/<slug>/index.html` e monta o índice a partir de `site/index.html`
+ os `game.json`. `dist/` é gerado e **não vai para o git**.

O índice também passa pelo `slopkit/build`: ele tem a marca `/*__APP__*/` e um
`site/index.js` que liga o seletor de idioma. Não havia motivo para o catálogo
ter um empacotador próprio.

### O build de cada jogo

Todo jogo usa o mesmo build, que mora no kit. O `build.mjs` do jogo é a
configuração, não a implementação:

```js
import { build } from 'slopkit/build';

await build({ root: import.meta.dirname });
```

Isso empacota `src/main.js` com esbuild, injeta na marca `/*__APP__*/` do
`template.html`, minifica e escreve `dist/index.html`. É o caso normal.

**Aliases** — quando uma lib vem vendorizada em vez do npm (o SkiFree tem o
three em `vendor/`):

```js
await build({
  root: import.meta.dirname,
  alias: { 'three/addons': 'vendor/addons', three: 'vendor/three.module.js' },
});
```

**Modo `concat`** — para código que compartilha escopo global e depende da
ordem dos arquivos, sem `import` nenhum (o Zoo Magnata). Continua minificando
tudo junto, e `globals` pendura um pacote ESM numa variável global, o que dá a
esses jogos acesso ao slopkit sem reescrever o escopo inteiro:

```js
await build({
  root: import.meta.dirname,
  mode: 'concat',
  globals: { Slop: 'slopkit' },       // vira window.Slop
  files: ['src/01_i18n.js', 'src/02_util.js', /* … na ordem exata */],
});
```

### Instalável no celular (PWA)

**O app é o catálogo, não cada jogo.** Um ícone na tela inicial abre o índice, e
dali se entra em qualquer jogo — quatro ícones separados seria só poluição.

O manifesto vive no `build.mjs` da raiz, embutido no índice como `data:` URI
junto de um ícone SVG. `scope: './'` faz os jogos rodarem dentro do app, e
`display: standalone` mantém a barra de status do sistema — quem joga quer ver
as horas e a bateria.

**Não há service worker, e não faz falta.** Tudo aqui já é HTML único, sem nada
para buscar na rede. (O prompt automático de instalação do Chrome exige SW;
"Adicionar à tela inicial" pelo menu funciona sem, e no iOS é assim de qualquer
jeito.)

`orientation` no `game.json` é opcional, padrão `any`. Declare `landscape` só se
o jogo realmente não funciona em pé.

O manifesto instalado fala **uma língua só** — nome de app não troca com a
bandeira. Ele usa o lado `pt`; o `<title>`, que JavaScript consegue atualizar, é
que acompanha a escolha do jogador.

### A saída para o catálogo (obrigatória)

Em modo app **não existe barra de navegador**. Quem entra num jogo fica preso:
no Android ainda há o botão voltar do sistema, no iOS não há nada. Por isso todo
jogo daqui precisa oferecer a volta.

Ela vai **na tela inicial do jogo** — o menu, o splash, o mapa —, com a cara do
jogo, e não como um `←` flutuante por cima da partida. Botão sobreposto atrapalha
quem está jogando e não pertence a lugar nenhum; na tela inicial ele é só mais
uma opção do menu, que é onde o jogador procura por "sair".

O contrato é de duas pontas: **o jogo diz onde quer a saída, o catálogo a ativa.**

**Jogo com menu em DOM** — declare o elemento escondido, vestindo **a classe de
botão que o jogo já tem**, e não um estilo novo:

```html
<!-- SkiFree: .btn.ghost, o secundário ao lado do "Descer a montanha" -->
<a class="btn ghost back-to-games" data-back-to-catalog data-t="slop.backToCatalog" hidden></a>
<!-- World Drive: .chip, a mesma pílula dos atalhos de cidade -->
<!-- Zoo Magnata: .btn, o botão cartoon da casa                -->
```

A frase vem do kit (`slop.backToCatalog`), então ela já chega nas duas línguas —
não é preciso reescrevê-la em cada jogo. A classe `.back-to-games` cuida só do
que não é visual (`inline-flex`, o `gap` do emoji, tirar o sublinhado, esconder).
**Nunca deixe o `<a>` sem `color`**: sem isso ele herda o azul de link do
navegador (`#0000EE`) — e, se a borda for `currentColor`, ela vai junto. Já
aconteceu nos três jogos de uma vez: sobre os fundos escuros do SkiFree e do
World Drive o botão ficou ilegível. Herdar a classe do jogo resolve isso de
graça, e é o que faz a saída parecer parte do menu em vez de um enxerto. O teste
do catálogo cobra a cor.

**Jogo que desenha em canvas** — leia `window.__catalogo` e desenhe do seu jeito:

```js
...(window.__catalog ? [{ label: t('slop.backToCatalog'), action: 'catalog' }] : []),
// e no clique:
window.location.href = window.__catalog;
```

**Botão desenhado mede o texto.** "recomeçar" e "restart" não têm o mesmo
tamanho; largura fixa corta um dos dois. O Animais mede com `measureText` e
soma o respiro — é o que deixa a barra sobreviver à troca de bandeira.

Nos dois casos o build da raiz injeta, **só na cópia publicada**, um script que
define `window.__catalogo` e revela os elementos marcados. Quem baixa o HTML do
jogo sozinho não recebe esse script: o elemento continua escondido e não sobra
link para um catálogo que não existe. O `games/<slug>/dist/index.html` fica puro.

O teste do catálogo cobra os dois lados — que o jogo ofereça a saída e que o
arquivo solto não a mostre.

### O contrato

- **`template.html`** com a marca `/*__APP__*/` onde o bundle entra.
- **`npm run build`** rodando `node build.mjs`.
- O resultado é validado: se sobrou `<script src>` ou `<link stylesheet>`
  apontando para fora, o build **falha** em vez de gerar um HTML que não abre
  por `file://`. É a regra nº 2 cobrada por máquina.

### As duas armadilhas, resolvidas de uma vez

Estavam repetidas em dois builds diferentes antes de virar uma coisa só:

1. **`</script>` dentro do bundle fecha a tag no meio do jogo.** Todo texto que
   entra no HTML precisa escapar isso.
2. **`String.replace` interpreta `$&` e `$1` no texto de substituição** — e todo
   bundle minificado tem esses caracteres. Por isso a substituição é sempre por
   função, nunca por string.

### O que a padronização rendeu

| Jogo | Antes | Depois | |
|---|---|---|---|
| SkiFree 3D | 1622 KB | **702 KB** | bundler caseiro não minificava |
| Zoo Magnata | 377 KB | **291 KB** | `cat` não minificava |
| World Drive | 581 KB | 596 KB | já era esbuild |
| Animais vs Monstros | 111 KB | 138 KB | já era esbuild |

Os números de hoje já incluem o segundo idioma: o texto duplicado custa entre 10
e 25 KB por jogo, e o kit de i18n (dicionário, bandeiras desenhadas, seletor)
sai por ~4 KB. Barato para o que entrega.

Sumiram no caminho: um bundler ES caseiro de 150 linhas (SkiFree), um `build.sh`
de bash (Zoo) e três cópias da mesma lógica de injeção no template.

## 6. Testes

```bash
npm test               # unidade do kit + o piso de todos os jogos
npm run test:games     # o teste próprio de cada jogo, se tiver
node lib/test/kit.test.mjs            # só a unidade (milissegundos, sem Chrome)
node games/<slug>/test/game.test.mjs  # só um jogo
```

### Três camadas, e o que vai em cada uma

1. **Unidade, sem navegador** (`lib/test/`) — a conta pura: quantos passos o
   laço dá, que largura a tela escolhe, o que a normalização faz com um save
   velho. Roda em milissegundos. Se dá para testar aqui, **não** teste no
   navegador.
2. **Piso do catálogo** (`test/games.test.mjs`) — vale para todo jogo, seja qual
   for a tecnologia: abre por `file://`, desenha, tem título, não busca nada de
   fora, preenche a tela, oferece a saída para o catálogo e **troca de idioma**.
   É o teste que cobra as regras da seção 1.
3. **O jogo em si** (`games/<slug>/test/`) — jogabilidade e o que só quebra no
   navegador: toque, arraste, save que persiste, tela que se adapta.

### Como escrever

O `slopkit/testing` dá o andaime — puppeteer-core com o Chrome do sistema
(`CHROME=/caminho` aponta outro):

```js
import { launchBrowser, open, DEVICES, scenario, check, run } from 'slopkit/testing';

const browser = await launchBrowser();

scenario('plantar arrastando funciona no toque', async () => {
  const g = await open(browser, FILE, DEVICES.phone);
  await g.exec((game) => game.goToBattle(1));
  await g.tap(...g.at(240, 50));                     // coordenada do JOGO
  await g.drag(g.at(300, 400), g.at(520, 500));
  check(await g.exec((game) => game.current().st.planted.length) === 1);
  await g.setLang('en');                             // e em inglês também
  g.expectNoErrors();
  await g.close();
});

await run('meu jogo');
```

### Nunca durma um tempo fixo

`await espera(300)` passa na sua máquina e falha no runner, onde o Chrome
renderiza por software. Pior: passa sozinho e falha no meio da suíte, quando não
há nada antes dando o tempo que faltava. Duas ferramentas para não chutar:

```js
await g.waitFrames(3);                        // deixa a tela desenhar
await g.waitUntil((game) => game.ready());    // espera o que interessa
```

`waitFrames` precisa de `frames()` na ponte do jogo — um contador
incrementado no desenho. Vale expor: **a lista de botões clicáveis de uma tela
só existe depois que ela desenha**, então trocar de tela e clicar no mesmo
instante acerta uma tela sem botão nenhum. Foi assim que um teste daqui passou a
falhar só dentro da suíte.

**Mudar de estado não é a mesma coisa que estar desenhado.** Este é o erro que
já apareceu duas vezes aqui, a segunda só no CI:

```js
await g.waitUntil((game) => game.current().confirming());  // o diálogo abriu…
await g.waitFrames(2);                                     // …mas ainda não tem botão
await g.tap(...);
```

Abrir um diálogo liga uma flag na hora; os botões dele só entram na lista de
clicáveis no desenho seguinte. Sempre que o próximo passo for clicar em algo que
acabou de aparecer, ponha `waitFrames` entre as duas coisas.

**`g.at(x, y)` não é conveniência, é a parte que mais dá errado.** Converter
coordenada lógica em coordenada de tela "no olho" (`x / 1280 * largura`) falhou
duas vezes durante o desenvolvimento — uma porque o canvas ficava centralizado
com barras, outra porque a largura lógica virou elástica. Nos dois casos o teste
acusou bug de jogo que era bug de teste. `at()` lê a medida do próprio jogo, via
`window.__game.viewport`. Para conteúdo dentro de uma moldura, use `atFrame()`,
que também desconta a escala.

**Não procure botão por pixel.** Com o texto mudando de idioma, uma barra que se
dimensiona pelo conteúdo muda de posição. O Animais expõe `buttons()` na tela do
mapa e o teste acha o botão pela ação que ele executa — resiste a tradução e a
mudança de layout.

Rode antes de publicar.

---

## 7. Publicação

Push na `main` roda os testes e, **se passarem**, publica no GitHub Pages:

- Índice: `https://victorlcampos.github.io/slop-games/`
- Jogo: `https://victorlcampos.github.io/slop-games/<slug>/`

Pull request roda os mesmos testes e não publica. Não existe deploy manual e não
se commita `dist/`.

### O portão

O workflow tem dois jobs: `testar` constrói e testa, `publicar` só publica.
**O artefato que vai ao ar é exatamente o que passou nos testes** — o job de
publicação não reconstrói nada. Sem isso existiria a hipótese de subir um build
diferente do que foi verificado.

O que barra o deploy:

1. `npm run build` — que já falha sozinho se algum jogo gerar HTML com
   referência externa (regra nº 2) ou com `game.json` faltando um idioma.
2. `npm test` — unidade do kit + o piso de todos os jogos, inclusive a troca de
   bandeira em cada um.
3. O teste do Animais vs Monstros.

O que **não** barra: o smoke do World Drive, que dirige num mapa real do
OpenStreetMap. É um bom teste e um péssimo portão — depende de uma API pública
de terceiros que cai e limita requisição. Roda com `continue-on-error` para dar
visibilidade sem poder segurar o catálogo inteiro refém.

Quando algo quebra, as telas dos testes sobem como artefato (`telas-da-falha`):
numa falha de layout, a imagem diz em um segundo o que o log não diz em vinte.

### Rodar como o CI roda

Duas coisas mudam quando `CI` está definido, e as duas por motivo concreto:

```bash
CI=1 npm test        # reproduz o ambiente do runner na sua máquina
```

- **`--no-sandbox`** — o runner roda como root em contêiner e o Chrome recusa
  subir com sandbox.
- **WebGL por software** (`--use-angle=swiftshader`). O reflexo aqui seria
  `--disable-gpu`, e ele **quebra os jogos 3D**: sem contexto WebGL, SkiFree e
  World Drive não criam canvas nenhum e o teste acusa "sem canvas" como se o
  jogo estivesse defeituoso. SwiftShader renderiza na CPU — mais lento, mas
  real.

O Chrome vem do runner (`puppeteer-core` não baixa navegador, e é isso que
mantém o repositório leve). O `findChrome()` do slopkit encontra em macOS,
Linux e Windows; `CHROME=/caminho` força outro.

Como o SwiftShader é lento, teste que dorme um tempo fixo passa no seu laptop e
falha no runner. Use `waitFrames()` e `waitUntil()` — veja a seção 6.

## 8. Convenções de código

- **Código e comentários em inglês. Documentação, README e commit em
  português.** A regra é a fronteira do artefato: o que compila é inglês, o que
  se lê sobre o projeto é português. Nomes de domínio do jogo entram em inglês
  também (`enclosure`, `stage`, `wave`).

  A exceção são os **nomes próprios**: `saci`, `curupira`, `boitata`,
  `bichopapao` continuam como estão nos ids do Animais vs Monstros. Traduzir um
  Saci é inventar uma criatura que não existe — o que se traduz é a lenda que o
  descreve, não o nome dele. O mesmo para os **slugs** dos jogos, que são URL
  publicada.

- **O texto que o jogador lê existe nas duas línguas, lado a lado.** Nunca em
  tabelas separadas por idioma — veja a seção 2c e o porquê.

- **Comentário explica o porquê, não o quê.** Os bons comentários deste repo
  registram a armadilha ("a substituição PRECISA ser por função: o bundle contém
  `$&`"), não a operação.
- **Sem dependência nova sem necessidade real.** Cada `npm i` precisa justificar
  o peso no arquivo final. Em dúvida, escreva as 40 linhas.
- **`src/` em módulos pequenos e temáticos** — `render`, `input`, `audio`,
  `world`, `entities`. Nenhum arquivo de 3000 linhas.
- **README de cada jogo** com controles e o que o jogo tem de interessante.
