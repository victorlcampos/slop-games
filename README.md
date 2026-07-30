# 🦁 Zoo Magnata

Um tycoon de zoológico que roda **inteiro no navegador**, em um único arquivo HTML,
sem dependências externas e sem servidor. Funciona offline.

▶️ **[Jogar](https://victorlcampos.github.io/zoo-magnata/)**

---

## O que tem

- **219 espécies**, cada uma com bioma, dieta, espaço necessário, tamanho de grupo,
  longevidade, nível de perigo e preço. Nenhum sprite é imagem: todos são desenhados
  em código a partir de 28 planos corporais parametrizados, com 6 quadros de animação.
- **Recintos de forma livre** — arraste para criar, arraste colado para ampliar.
  Dá para fazer L, T, U e até recintos com buraco no meio. A cerca é derivada das
  bordas, então todo tile pago vira área útil.
- **Felicidade decomposta em 8 fatores com peso** (espaço, bioma, convívio,
  enriquecimento, limpeza, saúde, comida, adequação da cerca). O inspetor mostra
  item por item, então dá para descobrir o que consertar.
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
- **Som inteiramente sintetizado** (Web Audio, nenhum arquivo de áudio): cada bicho
  tem voz derivada do plano corporal e do tamanho, o murmúrio da multidão usa
  formantes de vogal com ritmo silábico e cresce com o número de visitantes, e há
  grilos à noite. Botão 🔊 no HUD alterna cheio / baixo / mudo (atalho `S`).
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
