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
   projeto sem pasta de binários. Nenhum jogo daqui tem **uma única imagem**: o
   Zoo Magnata desenha 219 espécies a partir de 28 planos corporais
   parametrizados, o SkiFree 3D gera terreno e neve por ruído, o World Drive
   monta o cenário a partir de dados vetoriais, e o Animais vs Monstros desenha
   33 criaturas com um motor de traço torto de 200 linhas.

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
  package.json     # precisa de um script "build" (e um "test", se tiver)
  build.mjs        # gera dist/index.html
  src/             # o código de verdade, em módulos
  test/            # o teste do jogo, sobre slopkit/testes
  dist/index.html  # gerado, fora do git
  README.md        # como jogar, controles, o que tem de interessante
```

Só duas coisas são obrigatórias, e o build da raiz cobra as duas:

- **`jogo.json`** com o `slug` batendo com o nome da pasta.
- **`npm run build` gerando `dist/index.html`** autossuficiente — o orquestrador
  verifica se sobrou referência externa e falha o build se sobrou.

Uma terceira é fortemente recomendada, e o teste do catálogo usa quando existe:

- **`window.__jogo`** com pelo menos `{ nome, tela }`, onde `tela` expõe `L` e
  `A` (as medidas lógicas). É por aí que o teste converte toque em coordenada
  sem chutar — veja a seção 6.

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

## 2b. O slopkit

Os quatro jogos resolviam os mesmos sete problemas — tela, laço, save, mudo — e
cada um resolvia de um jeito. O `lib/` guarda a melhor resposta de cada um, e
jogo novo começa daí em vez de reinventar (pior).

```bash
npm i slopkit          # já é workspace: basta declarar a dependência
```

```js
import { criarTela, criarLaco, criarSave, criarSom } from 'slopkit';
```

### O que veio de onde

Isto não é opinião: cada peça foi escolhida comparando as quatro
implementações que já existiam.

| Peça | Veio do | Por que ganhou |
|---|---|---|
| `tela` — largura elástica | Animais vs Monstros | altura lógica fixa, largura acompanhando a proporção: preenche qualquer monitor sem barra nem distorção |
| `tela` — teto de DPR | Zoo Magnata | teto **adaptativo** (1.6 em celular pequeno, 2 no resto); DPR 3 triplica a área de pintura sem ganho visível num traço cartoon |
| `laco` — passo fixo | Zoo Magnata | era o único com acumulador e guarda; os outros três usavam dt cru, e com dt cru o jogo se comporta diferente a 60 e a 144 Hz |
| `save` — um formato só | Zoo Magnata | o mesmo retrato serve ao autosave e ao arquivo. Dois formatos viram dois saves divergindo |
| `save` — normalizar | Animais vs Monstros | todo save lido passa por uma função que preenche o que falta; save velho perde um campo, nunca a partida |
| `save` — baixar arquivo | Zoo Magnata | `revokeObjectURL` com folga (revogar cedo cancela o download no Safari) |
| `som` — mudo persistido | 3 dos 4 | o Animais era o único que esquecia a escolha ao recarregar |

### As regras que saíram disso

1. **Simulação em passo fixo, desenho livre.** `simular(h)` recebe sempre o
   mesmo `h`. Se o seu `update` usa o dt que chega, o jogo muda de
   comportamento conforme o monitor de quem joga.
2. **Nunca confie no que leu do disco.** Todo save passa por `normalizar`. O
   jogo precisa abrir mesmo com um save de duas versões atrás, editado à mão.
3. **A altura lógica é fixa; a largura, não.** Desenhe contra `A` e leia `L`.
   Elemento com posição absoluta em X só sobrevive dentro de uma *moldura* —
   e moldura **escala** quando a tela é mais estreita que ela, senão vaza
   (um monitor 16:10 dá 1152 de largura lógica, não 1280).
4. **Teto de DPR.** Renderizar em 3x um traço cartoon é gastar três vezes mais
   para ninguém ver diferença.

### Quem usa o quê

Os quatro jogos compartilham build e teste. Do resto, cada um adotou o que tinha
ganho real — migrar código bom por código equivalente é risco sem retorno:

| | build | teste | save | tela | laço | som |
|---|---|---|---|---|---|---|
| Animais vs Monstros | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SkiFree 3D | ✅ | ✅ | ✅ | — | — | — |
| World Drive | ✅ | ✅ | ✅ | — | — | — |
| Zoo Magnata | ✅ | ✅ | — | — | — | — |

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

**2. `build.mjs`** — três linhas, porque o build mora no kit (seção 5):

```js
import { construir } from 'slopkit/build';

await construir({ raiz: import.meta.dirname });
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

**4. `jogo.json`** com os metadados (seção 2).

**5. Ligue o slopkit** — tela, laço, save e som já resolvidos (seção 2b):

```js
import { criarTela, criarLaco, criarSave, criarSom } from 'slopkit';

const tela = criarTela(document.getElementById('tela'));
tela.observar(() => reposicionar());

const cofre = criarSave({ jogo: 'meu-jogo', versao: 1, inicial: saveNovo, normalizar });
let estado = cofre.carregar();

criarLaco({
  passo: 1 / 60,
  simular: (h) => mundo.tick(h),      // h é sempre o mesmo
  desenhar: () => { tela.preparar(); pintar(tela.ctx); },
}).iniciar();

window.__jogo = { nome: 'meu-jogo', tela };   // ponte de teste (seção 6)
```

**6. Registre e confira** — na raiz do repositório:

```bash
npm install          # o workspace jogos/* pega o jogo novo sozinho
npm run build        # builda tudo e regenera o índice
npm test             # confere que abre por file:// e cumpre o piso
```

O índice **não precisa ser editado**: ele é gerado a partir dos `jogo.json`.

---

## 5. Build

Tudo pela raiz:

```bash
npm install            # uma vez (npm workspaces cuida dos jogos e do lib)
npm run build          # builda todos os jogos + o índice -> dist/
npm run build zoo-magnata   # builda só um jogo (e o índice)
npm run abrir          # builda e abre o índice no navegador
```

O `build.mjs` da raiz roda o `npm run build` de cada jogo, valida o resultado,
copia para `dist/<slug>/index.html` e monta o índice a partir de `site/index.html`
+ os `jogo.json`. `dist/` é gerado e **não vai para o git**.

### O build de cada jogo

Todo jogo usa o mesmo build, que mora no kit. O `build.mjs` do jogo é a
configuração, não a implementação:

```js
import { construir } from 'slopkit/build';

await construir({ raiz: import.meta.dirname });
```

Isso empacota `src/main.js` com esbuild, injeta na marca `/*__APP__*/` do
`template.html`, minifica e escreve `dist/index.html`. É o caso normal.

**Aliases** — quando uma lib vem vendorizada em vez do npm (o SkiFree tem o
three em `vendor/`):

```js
await construir({
  raiz: import.meta.dirname,
  alias: { 'three/addons': 'vendor/addons', three: 'vendor/three.module.js' },
});
```

**Modo concatenado** — para código que compartilha escopo global e depende da
ordem dos arquivos, sem `import` nenhum (o Zoo Magnata). Continua minificando
tudo junto, e `globais` pendura um pacote ESM numa variável global, o que dá a
esses jogos acesso ao slopkit sem reescrever o escopo inteiro:

```js
await construir({
  raiz: import.meta.dirname,
  modo: 'concatenado',
  globais: { Slop: 'slopkit' },       // vira window.Slop
  arquivos: ['src/02_util.js', 'src/03_species.js', /* … na ordem exata */],
});
```

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
| SkiFree 3D | 1622 KB | **690 KB** | bundler caseiro não minificava |
| Zoo Magnata | 377 KB | **268 KB** | `cat` não minificava |
| World Drive | 581 KB | 584 KB | já era esbuild |
| Animais vs Monstros | 111 KB | 111 KB | já era esbuild |

Sumiram no caminho: um bundler ES caseiro de 150 linhas (SkiFree), um `build.sh`
de bash (Zoo) e três cópias da mesma lógica de injeção no template.

## 6. Testes

```bash
npm test               # unidade do kit + o piso de todos os jogos
npm run test:jogos     # o teste próprio de cada jogo, se tiver
node lib/test/kit.test.mjs           # só a unidade (milissegundos, sem Chrome)
node jogos/<slug>/test/jogo.test.mjs # só um jogo
```

### Três camadas, e o que vai em cada uma

1. **Unidade, sem navegador** (`lib/test/`) — a conta pura: quantos passos o
   laço dá, que largura a tela escolhe, o que a normalização faz com um save
   velho. Roda em milissegundos. Se dá para testar aqui, **não** teste no
   navegador.
2. **Piso do catálogo** (`test/jogos.test.mjs`) — vale para todo jogo, seja qual
   for a tecnologia: abre por `file://`, desenha, tem título, não busca nada de
   fora, preenche a tela. É o teste que cobra as regras da seção 1.
3. **O jogo em si** (`jogos/<slug>/test/`) — jogabilidade e o que só quebra no
   navegador: toque, arraste, save que persiste, tela que se adapta.

### Como escrever

O `slopkit/testes` dá o andaime — puppeteer-core com o Chrome do sistema
(`CHROME=/caminho` aponta outro):

```js
import { abrirNavegador, abrir, APARELHOS, cenario, conferir, rodar } from 'slopkit/testes';

const navegador = await abrirNavegador();

cenario('plantar arrastando funciona no toque', async () => {
  const j = await abrir(navegador, ARQUIVO, APARELHOS.celular);
  await j.executar((jogo) => jogo.irParaFase(1));
  await j.tocar(...j.pontos(240, 50));               // coordenada do JOGO
  await j.arrastar(j.pontos(300, 400), j.pontos(520, 500));
  conferir(await j.executar((jogo) => jogo.atual().est.plantados.length) === 1);
  j.exigirSemErros();
  await j.fechar();
});

await rodar('meu jogo');
```

### Nunca durma um tempo fixo

`await espera(300)` passa na sua máquina e falha no runner, onde o Chrome
renderiza por software. Pior: passa sozinho e falha no meio da suíte, quando não
há nada antes dando o tempo que faltava. Duas ferramentas para não chutar:

```js
await j.esperarQuadros(3);                       // deixa a tela desenhar
await j.esperarAte((jogo) => jogo.pronto());     // espera o que interessa
```

`esperarQuadros` precisa de `quadros()` na ponte do jogo — um contador
incrementado no desenho. Vale expor: **a lista de botões clicáveis de uma tela
só existe depois que ela desenha**, então trocar de tela e clicar no mesmo
instante acerta uma tela sem botão nenhum. Foi assim que um teste daqui passou a
falhar só dentro da suíte.

**Mudar de estado não é a mesma coisa que estar desenhado.** Este é o erro que
já apareceu duas vezes aqui, a segunda só no CI:

```js
await j.esperarAte((jogo) => jogo.atual().confirmando());  // o diálogo abriu…
await j.esperarQuadros(2);                                 // …mas ainda não tem botão
await j.tocar(...);
```

Abrir um diálogo liga uma flag na hora; os botões dele só entram na lista de
clicáveis no desenho seguinte. Sempre que o próximo passo for clicar em algo que
acabou de aparecer, ponha `esperarQuadros` entre as duas coisas.

**`j.pontos(x, y)` não é conveniência, é a parte que mais dá errado.** Converter
coordenada lógica em coordenada de tela "no olho" (`x / 1280 * largura`) falhou
duas vezes durante o desenvolvimento — uma porque o canvas ficava centralizado
com barras, outra porque a largura lógica virou elástica. Nos dois casos o teste
acusou bug de jogo que era bug de teste. `pontos()` lê a medida do próprio jogo,
via `window.__jogo.tela`. Para conteúdo dentro de uma moldura, use
`pontosMoldura()`, que também desconta a escala.

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
   referência externa (regra nº 2).
2. `npm test` — unidade do kit + o piso de todos os jogos.
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
mantém o repositório leve). O `acharChrome()` do slopkit encontra em macOS,
Linux e Windows; `CHROME=/caminho` força outro.

Como o SwiftShader é lento, teste que dorme um tempo fixo passa no seu laptop e
falha no runner. Use `esperarQuadros()` e `esperarAte()` — veja a seção 6.

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
