# 🦁 Zoo Magnata

Um tycoon de zoológico que roda **inteiro no navegador**, em um único arquivo HTML,
sem dependências externas e sem servidor. Funciona offline.

▶️ **[Jogar](https://victorlcampos.github.io/zoo-magnata/)**

---

## O que tem

- **219 espécies**, cada uma com bioma, dieta, espaço necessário, tamanho de grupo,
  longevidade, nível de perigo e preço. Nenhum sprite é imagem: todos são desenhados
  em código a partir de 28 planos corporais parametrizados, com 6 quadros de animação.
- **Cenário com acabamento**: trilhas formam uma faixa contínua com meio-fio que
  se curva nas viradas, funde blocos em praças (com medalhão de calçamento no
  centro), alarga em mirante rente à cerca dos recintos e vira ponte de madeira
  sobre a água. Perto de uma loja, a calçada abre em leque até a porta — centrada
  na fachada — com capacho na cor da loja, janelas, toldo listrado, beiral e
  chaminé. Banco, lixeira, bebedouro e playground são desenhados de verdade, não
  caixas com emoji. Biomas se encontram em franjas orgânicas (espuma na beira
  d'água, dossel na mata, flores e seixos na grama, vitórias-régias na água
  rasa, chão batido nos recintos), e o mapa é um planalto com barranco de terra
  nas bordas.
- **Mundo vivo**: nuvens sombreiam o chão, a água cintila e peixes pulam nos
  lagos fundos, copas de árvore balançam na brisa, borboletas rondam os
  canteiros (vagalumes à noite), pássaros cruzam o céu, o balanço do playground
  balança, a fonte esguicha, cercas elétricas soltam faísca, fumaça sobe das
  cozinhas e animais na água fazem ondulações. Visitantes viram de frente para
  o recinto ou a loja que estão usando. À noite: céu estrelado, janelas acesas
  e poças de luz quente sob postes e fachadas.
- **Recintos de forma livre** — arraste para criar, arraste colado para ampliar.
  Dá para fazer L, T, U e até recintos com buraco no meio. A cerca é derivada das
  bordas, então todo tile pago vira área útil.
- **Felicidade decomposta em 8 fatores com peso** (espaço, bioma, convívio,
  enriquecimento, limpeza, saúde, comida, adequação da cerca). O inspetor mostra
  item por item, então dá para descobrir o que consertar.
- **Ciclo de vida completo**: com macho e fêmea adultos da espécie, felizes e
  com espaço no recinto, nascem filhotes — desenhados menores até crescerem.
  Espécies de vida curta e de bando procriam mais rápido; veterinários no
  quadro aceleram o programa de cria. A gestante mostra 🤰 no balão e na ficha.
- **Barra de alertas do gerente**: fugas, doenças, saúde crítica, recintos sem
  comida/água, cercas se rompendo, animais no fim da vida — agrupados por tipo;
  clicar centraliza a câmera no caso (e cicla entre eles).
- **Desfazer compras** (↩️ no HUD ou Ctrl+Z): as últimas 5 compras — trilha,
  terreno, recinto, ampliação, objetos, animais, troca de cerca — voltam com
  reembolso integral. Uma pincelada inteira de trilha conta como uma ação só, e
  o jogo recusa desfazer o que deixaria animal sem recinto.
- **Extrato da reputação**: clicar em ⭐ abre a nota decomposta — a avaliação
  contínua (bem-estar, satisfação, variedade, lixo, fugas, com os pesos reais) e
  o histórico de choques (mortes, fugas, nascimentos, avaliações do público).
- **Balões de pensamento** sobre animais e visitantes, com ícones escolhidos para
  ensinar: o bicho com fome pensa na comida da dieta dele (🥩 leão, 🥬 girafa) e o
  que está no bioma errado mostra o bioma que quer (🧊 para o urso-polar na grama).
- **Visitantes** com fome, sede, banheiro, cansaço e diversão, pathfinding real nas
  trilhas e decisão de compra sensível a preço. O humor deles vira reputação, que
  controla quanta gente aparece.
- **Economia**: ingresso, 15 tipos de comércio com preço regulável por loja,
  4 funções de funcionário, contas semanais, empréstimo com juros, marketing, falência.
- **Relatório de satisfação** que ranqueia os motivos de insatisfação com uma dica
  acionável em cada linha.
- Save/load no navegador, **exportação do save em `.json`** e de um **relatório de
  status em `.txt`**, com importação de volta.
- **Som inteiramente sintetizado** (Web Audio, nenhum arquivo de áudio): 22 gestos
  sonoros — rugido, uivo, trombeta, piado, chiado, coaxo… — atribuídos por família,
  com exceções por espécie (zebra late, raposa late, girafa bufa). O tamanho puxa a
  afinação e o nome semeia o timbre, então duas espécies do mesmo gesto não soam
  iguais. Clicar num bicho, num visitante ou num funcionário faz ele responder.
  Botão 🔊 no HUD alterna cheio / baixo / mudo (atalho `S`).
- **Voz humana por síntese de formantes** (Klatt): cascata de 5 ressoadores sobre um
  trem de impulsos glotal, com frequências de formante de Peterson & Barney (1952),
  aspiração para preencher o espectro, jitter de ~0,3% e forma temporal de sílaba
  (transição de ~60 ms e alvo sustentado).
- Responsivo: toque, pinça para zoom, e três arranjos de layout (celular em pé,
  celular deitado, desktop).

## Por que Canvas 2D e não three.js

Zoo Tycoon é isométrico 2D. Canvas 2D puro deu três vantagens decisivas aqui:

1. **Zero dependências** — o arquivo roda offline de verdade, sem CDN.
2. **219 animais visualmente distintos** gerados proceduralmente. Em 3D procedural
   eles virariam blobs genéricos.
3. O traço cartoon com contorno grosso é nativo do Canvas 2D.

## Estrutura

O jogo é entregue como **um** `index.html`, mas é editado em módulos:

| arquivo | conteúdo |
|---|---|
| `src/01_head.html` | HTML e CSS |
| `src/02_util.js` | utilitários, constantes do mundo |
| `src/03_species.js` | catálogo das 219 espécies |
| `src/04_sprites.js` | gerador procedural de sprites |
| `src/05_world.js` | grade, recintos, caminhos |
| `src/06_entities.js` | animais, visitantes, funcionários |
| `src/06b_audio.js` | síntese de áudio (vozes, efeitos, ambiente) |
| `src/07_render.js` | renderização isométrica |
| `src/08_ui.js` | interface |
| `src/09_game.js` | input, simulação, economia, save |

```bash
./build.sh      # regenera o index.html a partir de src/
```

Não edite o `index.html` diretamente — ele é gerado.

## Como o áudio é verificado

Ouvido não entra no ciclo de desenvolvimento, e "medi e deu bom" já enganou aqui
mais de uma vez: dá para provar numericamente que um som tem a estrutura certa e
ele continuar não soando como a coisa. Então a verificação é **comparativa** —
gravação real de um lado, síntese do outro, mesmo STFT, e a diferença aparece.

```bash
tools/gerar-referencias.sh    # voz via `say` do macOS; bichos do Wikimedia Commons
python3 -m http.server 8000
# tools/comparar.html  → voz humana real x sintetizada
# tools/animais.html   → 14 gravações de bicho x o gesto correspondente
# tools/espectro.html  → só a síntese, para inspeção isolada
```

Cada painel imprime a energia em quatro faixas (0–0,5 / 0,5–1,5 / 1,5–3 / 3–5 kHz).
Foi essa comparação que derrubou três premissas minhas: a voz estava brilhante
demais (25–30% acima de 1,5 kHz, contra 1–5% na fala real), o espectro era de
linhas finas em vez de bandas contínuas (faltava aspiração), e quase todo bicho
estava grave demais — o rosnado de urso real concentra 89% da energia entre 500 e
1500 Hz, não é subgrave. As gravações de referência não são versionadas.

## Rodando localmente

Abrir o `index.html` no navegador já funciona. Servir por HTTP é melhor: em `file://`
o navegador trata cada arquivo como origem isolada, o que torna o `localStorage`
(onde mora o autosave) menos confiável.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Licença

MIT
