# 🐆 Animais vs Monstros

Defesa de fileiras no espírito de *Plants vs. Zombies*, em um único HTML que
abre com duplo clique. Tudo é desenhado em código — não há uma imagem sequer no
arquivo.

▶️ **[Jogar](https://victorlcampos.github.io/slop-games/animais-vs-monstros/)**

---

## A ideia

As lendas se cansaram de ser só histórias e ganharam corpo. Não foi uma guerra:
quem cresceu ouvindo aqueles nomes **trava de medo** na hora de correr, e é por
isso que a humanidade perdeu em três dias — cada povo preso exatamente pelo que
ele mesmo inventou.

Só que ninguém nunca contou essas histórias para os bichos. Um tatu não sabe o
que é uma Cuca. Uma abelha nunca ouviu falar de lobisomem. **Não dá para
paralisar de medo quem nunca aprendeu a ter** — e é por isso que a resistência
é dos animais.

Daí a campanha ser país a país: os animais vêm do mundo inteiro, os monstros são
sempre os do lugar. A primeira campanha é o **Brasil**, onde o inimigo é o
folclore.

## Como se joga

Cada fase é um tabuleiro de **5 fileiras por 9 colunas**. Os monstros entram
pela direita; se algum cruzar a cerca da esquerda, a fase acabou.

1. **Plante geradores.** Sem semente entrando, nada mais entra em campo.
2. **Clique nas sementes** que caem no chão para recolhê-las.
3. **Monte a fileira**: parede na frente, quem atira atrás.
4. **Mate rápido** — todo monstro derrubado devolve semente.
5. Entre as fases, gaste **moedas** recrutando cartas novas ou treinando as que já tem.

### A economia

Semente vem de **duas fontes que se equilibram**:

| Fonte | Como chega | O que ela premia |
|---|---|---|
| **Gerador** | cai no chão, você clica | investir cedo e aceitar risco enquanto está indefeso |
| **Monstro morto** | vai direto para o saldo | matar rápido, e não deixar a onda acumular |

A assimetria é de propósito: no meio de uma horda ninguém tem mão livre para
clicar em cada gota, então o que vem do combate entra sozinho. E é o que impede
a espiral de derrota — quem foi obrigado a gastar tudo em defesa cedo ainda tem
como se financiar, desde que segure a linha.

O peso vira ao longo da campanha: na fase 1 os monstros são 14% da sua renda; na
fase 10, 60%. Você começa dependendo de plantar e termina se sustentando do que
mata.

Duas regras menores fecham o sistema: a **pá devolve metade** do custo (errar o
lugar não pode custar a fase), e a **semente que sobrou vira moeda** no fim, a
5 por 1 — com teto de 35% do prêmio da fase, para não transformar "não plantar"
em estratégia.

### Entre as fases: moedas

Vencer paga o prêmio cheio da fase. **Perder também paga** — proporcional a
quantas ondas você segurou, de 12% a 35% do prêmio. Tentar uma fase difícil não
pode ser tempo jogado fora, mas perder nunca rende mais que vencer. Refazer fase
já vencida rende 30%, senão a fase 1 vira caixa eletrônico.

No quartel, as moedas vão para dois lugares:

- **Recrutar** — três cartas sorteadas, das que você ainda não tem.
- **Treinar** — subir de nível uma carta do baralho (até o nível 3).

Treinar aumenta o que a carta já faz e **não muda o custo em sementes**: a mesma
semente em campo passa a render mais. No nível 3 a carta também volta mais
rápido. Um Esquilo treinado produz 25 → 34 → 45 sementes; um Macaco bate 22 →
30 → 40.

O treino custa a partir do valor da própria carta, então aprofundar um Elefante
sai mais caro que recrutar uma carta média. E a conta não fecha para os dois:
**recrutar tudo custa 4030, treinar tudo 8512, e a campanha rende cerca de
3800**. Ou você abre o leque, ou aprofunda o que já usa — o baralho de cada
jogador acaba diferente por causa dessa escolha.

| Ação | No computador | No celular |
|---|---|---|
| escolher o bicho | clique na carta | toque na carta |
| plantar | clique na casa | arraste até a casa e solte |
| recolher semente | clique nela | toque **ou** arraste o dedo por cima |
| tirar um bicho | ⛏ e clique nele | ⛏ e toque nele |
| som | `M` | botão no mapa |
| pular a abertura | `Esc` | toque para avançar |

### Tela

O jogo ocupa a janela inteira, em qualquer proporção. A altura lógica é fixa —
é ela que define o tamanho de bicho, fileira e fonte — e a **largura acompanha o
formato da tela**: num monitor ultrawide você enxerga mais campo à frente, num
4:3 menos. Não há barra preta nem imagem esticada.

O tabuleiro em si tem tamanho de casa com teto, então a largura que sobra vira
**pista de aproximação** à direita: em tela grande você vê a horda chegando de
longe, o que é vantagem sem mexer no equilíbrio da fase.

No celular o jogo pede para virar o aparelho — nove colunas não cabem em pé — e
as cartas crescem para o dedo, quebrando em duas linhas quando o baralho fica
grande demais para uma.

## O elenco

**19 animais**, de todo canto: Esquilo e Castor produzem sementes; Macaco,
Abelha, Cobra, Escorpião, Coruja, Morcego e Águia atiram; Tartaruga, Ouriço,
Elefante e Hipopótamo seguram a linha; Onça, Canguru e Jacaré batem de perto;
Leão atordoa e Urso Polar congela; Gambá explode uma vez só.

**12 monstros do folclore brasileiro**, cada um com um truque: o **Saci** pula a
primeira defesa, o **Curupira** chega antes do que você calculou, a **Mula sem
Cabeça** usa armadura, a **Iara** só desce pelas fileiras alagadas (e lá quem
segura é Jacaré ou Hipopótamo), a **Mãe-de-Ouro** cruza o céu e não olha para o
chão — parede nenhuma segura ela, só quem alcança o alto —, o
**Boitatá** queima de longe, o **Lobisomem** acelera quando apanha, o
**Bicho-papão** anda invisível no escuro, e a **Cuca** — a chefona — chama
reforço enquanto vem.

## As 10 fases

Cada uma muda o cenário, uma regra de tabuleiro e o elenco inimigo ao mesmo tempo.

| # | Fase | O que muda |
|---|---|---|
| 1 | Sítio do Interior | o básico |
| 2 | Mata Atlântica | Saci pula defesas |
| 3 | Cerrado | inimigos rápidos e de longe |
| 4 | Pantanal | duas fileiras alagadas: só bicho aquático · Iara |
| 5 | Caatinga | a seca corta sua produção de sementes · Mapinguari |
| 6 | Amazônia | névoa esconde o campo — precisa de Coruja |
| 7 | Litoral do Nordeste | noite + água · Bicho-papão invisível |
| 8 | Centro de São Paulo | hordas grandes |
| 9 | Serra da Mantiqueira | névoa · a Mãe-de-Ouro voa por cima da defesa |
| 10 | Cristo Redentor | **a Cuca** |

## Save

O progresso salva sozinho no navegador. Como o jogo roda por `file://` — onde
cada pasta é uma origem diferente —, o botão **baixar save** gera um `.json`
que você guarda onde quiser e recarrega com **carregar** em qualquer máquina.

**Recomeçar** apaga tudo e volta à abertura. A confirmação mostra o que se
perde em números — fases, cartas, moedas e humanos libertados — e lembra de
baixar o save antes, porque essa é a única ação do jogo que não dá para
desfazer.

## Mexer no código

```bash
npm install       # na raiz do slop-games
npm run build     # → dist/index.html
```

O código vive em `src/` como módulos ES, empacotados por esbuild num HTML só.

```
src/
  rabisco.js        motor de traço torto: nada é reto, nada é redondo
  viewport.js       tela elástica: altura fixa, largura conforme o monitor
  paleta.js         cores de lápis
  audio.js          Web Audio na mão — efeitos e trilha, nenhum arquivo
  save.js           localStorage + baixar/carregar .json
  dados/            animais (com níveis), monstros, fases e a economia
  desenho/          os 30 sprites, os cenários e o mapa-múndi
  telas/            cutscene, mapa, batalha e loja
  main.js           máquina de telas
```

Dois detalhes que valem saber antes de mexer:

- **O traço não pode tremer sozinho.** Todo desvio vem de um PRNG com semente
  fixa (`rabisco.js`), não de `Math.random()`. Se trocar, a tela inteira ferve.
- **Sprite se desenha uma vez.** Cada bicho é pintado num canvas fora da tela e
  reusado; redesenhar 40 criaturas rabiscadas por quadro derruba o fps, porque
  cada traço são duas passadas de curva de Bézier.
- **A largura da tela é variável, a altura não.** Desenhe sempre contra
  `ALTURA` (720) e leia `vp.L` para a largura. As telas de menu foram compostas
  numa prancheta de 1280 e ficam centradas por `margem()`; a batalha, não — lá
  a largura extra é campo de verdade.

Para adicionar um bicho: descreva-o em `src/dados/animais.js`, desenhe-o em
`src/desenho/animais.js` e pronto — a loja passa a sorteá-lo sozinha.
