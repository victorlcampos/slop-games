# ⛷️ SkiFree 3D

Releitura em 3D do **SkiFree** (Chris Pirih, 1991) — aquele jogo do Windows 3.1 em que
você desce a montanha até o Abominável Homem das Neves aparecer e te devorar.

Roda **100% no cliente**: Three.js puro, sem backend, sem CDN, sem nenhum asset externo.
Todo o conteúdo — terreno, texturas, modelos, som — é gerado por código em tempo de carga.

---

## Como rodar

Rode `npm run build` (na raiz do slop-games ou aqui) e **dê duplo clique em
`dist/index.html`**. Só isso.

É um arquivo único de ~690 KB com o jogo e o Three.js embutidos. Não precisa de servidor,
de internet, de instalação nem de nenhum processo rodando — funciona pelo `file://` mesmo,
inclusive offline e copiado para um pendrive.

Requisitos: um navegador com WebGL2 (Chrome, Firefox, Safari 15+, Edge).

<details>
<summary>Mexer no código</summary>

O código-fonte vive em `src/` como módulos ES. Depois de editar, regenere o arquivo único:

```bash
npm run build        # → dist/index.html
```

O build é o do slop-games (`slopkit/build`): esbuild empacota `src/main.js`, injeta no
`template.html` e minifica. O three vem de `vendor/`, apontado por alias — foi o que
derrubou o arquivo final de 1,6 MB para 690 KB, já que o empacotador caseiro anterior
não minificava.

</details>

---

## Controles

| Tecla | No chão | No ar |
|---|---|---|
| `←` `→` | virar / fazer curva | girar (spin) |
| `↑` | agachar — mais velocidade | mortal para trás |
| `↓` | frear em cunha | mortal para frente |
| `espaço` | pular | — |
| `C` | trocar câmera (perseguição · retrô · colada) | |
| `P` / `Esc` | pausar · `M` som · `R` recomeçar | |

Em telas de toque, a metade inferior vira três zonas: esquerda, pular, direita.

**Aterrissar torto derruba.** Feche o giro antes de tocar a neve — se estiver desalinhado,
o tombo é certo. Manobras limpas valem pontos e sobem o multiplicador de estilo.

---

## Os desafios do original

Tudo o que atrapalhava a descida em 1991 está aqui:

- 🌲 **Árvores** — não dá para pular, só desviar. A mata fecha nas laterais e delimita a pista.
- 🪨 **Pedras** — as baixas dá para saltar; as grandes, não.
- 🎿 **Rampas** — impulso para o ar, onde acontecem as manobras.
- 🚡 **Teleférico** — as torres derrubam. As cadeiras passam por cima, com gente sentada.
- 🚩 **Portões de slalom** — bandeira vermelha à esquerda, azul à direita, como no original.
- 🏂 **Outros esquiadores e snowboarders** — os snowboarders vêm por trás e miram em você.
- 🐕 **O cachorro** — atravessa a pista correndo e para para marcar território.
- 🏚️ **Chalés, tocos, placas e arbustos** espalhados pela montanha.
- 👹 **O Yeti** — acorda aos **2 000 m** e não cansa. Ele acelera enquanto persegue.

### Sobre o Yeti

No jogo de 1991 o Yeti sempre vencia — não havia escapatória. Aqui a regra é quase a mesma,
com uma concessão à jogabilidade: se você abrir **130 m** de vantagem, ele desiste e afunda
na neve — mas volta 12 segundos depois, mais rápido, e cada retorno é pior que o anterior.
Ou seja: dá para adiar, nunca para vencer.

---

## Modos

| Modo | O que muda |
|---|---|
| **Descida Livre** | A montanha inteira, sem regras. Yeti aos 2 000 m. |
| **Slalom** | Portões a cada 42 m. Acertar dá 150 pontos e sobe o estilo; errar tira 120 e zera. |
| **Slalom na Floresta** | Mata fechada com um corredor sinuoso de 34 m. Yeti já aos 1 600 m. |
| **Estilo Livre** | Rampas por toda parte. A pontuação vem do ar: giros, mortais e tempo de voo. |

Pontuação: 1 ponto por metro × multiplicador de estilo (sobe a cada 120 m sem cair, até ×5;
qualquer tombo zera). Os recordes ficam no `localStorage`, separados por modo.

---

## Como foi feito

### Origem flutuante
O jogador nunca sai da origem da cena. O mundo inteiro vive num `worldGroup` deslocado para
`(0, SLOPE·z, −z)` a cada quadro, então o esquiador fica sempre em `z = 0` e perto de `y = 0`.
Isso mantém as matrizes pequenas e elimina o tremor de precisão de `float32` depois de alguns
quilômetros de descida — sem precisar rebasear coordenadas.

### Terreno
Uma grade de 7 × 10 blocos de 80 m reciclados conforme você desce. A altura vem de uma única
função (`groundHeight` em `config.js`) usada tanto pela malha quanto pela física, pela IA e
pelo posicionamento dos objetos — malha e colisão nunca divergem.

As normais são calculadas sobre uma grade estendida com um anel extra de vértices, o que dá
continuidade perfeita entre blocos vizinhos (sem a costura visível típica de terreno em chunks).
A reconstrução é enfileirada e limitada a 2 blocos por quadro, então não há engasgo.

### Neve
`MeshPhysicalMaterial` com normal map procedural (grãos + sastrugi de vento, gerada em canvas
e tileável) amostrada em duas escalas para matar a repetição do ladrilho, `sheen` para o
aveludado da neve fofa e um `clearcoat` fino de crosta de gelo. As vertex colors escurecem os
vales pelo laplaciano da altura e expõem rocha nas partes íngremes. Por cima, um passe de
cintilância injetado via `onBeforeCompile`: cristais isolados por hash 3D que só acendem
quando a normal aleatória alinha com o meio-caminho entre sol e câmera.

### Iluminação e atmosfera
- **Céu Preetham** (`Sky` do three) com espalhamento Rayleigh/Mie — o mesmo céu gera o
  **environment map** via `PMREMGenerator`, então a luz ambiente vem fisicamente do ar.
- **Sombras em cascata (CSM)**, 4 níveis até 190 m: nítidas junto ao esquiador e ainda
  presentes ao longe, o que uma shadow map única deste alcance não entrega.
- **Perspectiva aérea**: o fog do three foi substituído (patch nos `ShaderChunk` globais) por
  um que muda de cor com a direção do olhar — dourado na direção do sol, azul de costas.
  É o que amarra o terreno distante ao céu.
- **Sol baixo (20°) e à frente** de quem desce. É a única posição em que o disco cabe no
  enquadramento — a câmera olha encosta abaixo, então qualquer sol alto sai da tela e não
  sobra nada para bloom nem para god rays. De quebra rende contraluz e sombras longas.

### Pós-processamento
`RenderPass → GTAO → god rays → bloom → OutputPass → lente`, com MSAA 4× no render target.

- **GTAO** (ground-truth ambient occlusion) para dar volume a troncos, pegadas e dobras do relevo.
- **God rays** volumétricos em screen space: marcha do pixel em direção ao sol acumulando o que
  é muito brilhante. Como o disco solar é o único objeto realmente estourado, as árvores que o
  cobrem recortam os raios de graça.
- **Lente**: borrão radial que cresce com a velocidade, aberração cromática, vinheta, grão e
  color grading com split toning (sombras frias, realces quentes).
- **Tone mapping Neutral** (Khronos PBR Neutral) em vez de ACES: nesta faixa de exposição o
  ACES lavava o azul do céu para branco (croma medido caía de 43 para 17).

Toda a calibração — exposição, intensidade do céu, limiares de bloom e dos raios — foi medida
lendo os pixels do quadro renderizado, não estimada no olho.

### Qualidade adaptativa
O GTAO custa ~41% do quadro. Em vez de fixar um preset, o jogo mede os primeiros segundos
reais e desliga o que for mais caro se não fechar a conta (GTAO → bloom e raios → pixel ratio).

### Objetos
Tudo instanciado (`InstancedMesh` com pool de slots e lista de livres). O mundo é dividido em
faixas de 25 m geradas deterministicamente a partir do índice da faixa — a montanha é sempre a
mesma, e cada faixa pode ser descartada e recriada sem guardar estado.

### Som
Nenhum arquivo de áudio: um buffer de ruído rosa gerado uma vez alimenta filtros biquad para
o vento e o atrito dos esquis (ganho e frequência seguem a velocidade), e osciladores compõem
saltos, batidas, portões e o rugido do Yeti (dente de serra grave com vibrato e filtro descendente).

---

## Estrutura

```
dist/index.html       ← o jogo: arquivo único, abre com duplo clique (gerado)
template.html         interface, HUD e menus; o bundle entra na marca /*__APP__*/
build.mjs             três linhas chamando o build do slopkit
jogo.json             metadados que alimentam o índice do slop-games
src/
  main.js             bootstrap e ligação com a UI
  game.js             cena, luz, pós-processamento, laço principal
  config.js           constantes + groundHeight (fonte da verdade do relevo)
  input.js            teclado e toque
  audio.js            síntese WebAudio
  hud.js              todo o DOM
  lib/noise.js        Perlin, fbm e hashes determinísticos
  world/
    sky.js            céu Preetham, cordilheiras, nuvens, environment map
    terrain.js        blocos recicláveis
    snowMaterial.js   material da neve + normal map procedural
    geometries.js     pinheiros, pedras, rampas, teleférico, bandeiras, chalés
    props.js          povoamento por faixas + colisores
    lift.js           torres, cabos e cadeiras
  entities/
    skierModel.js     modelo articulado (jogador e NPCs)
    player.js         física, saltos, manobras, quedas
    npcs.js           esquiadores, snowboarders e o cachorro
    yeti.js           modelo e perseguição
  render/
    postfx.js         god rays e o passe de lente
    atmosphere.js     perspectiva aérea (patch do fog do three)
  fx/
    particles.js      spray de neve e estouros
    snowfall.js       nevasca (animada no vertex shader)
    trail.js          rastro dos esquis
vendor/               Three.js r170 + addons (cópia local, roda offline)
```

---

## Licença

Código sob MIT. *SkiFree* é obra de Chris Pirih (1991); este é um remake independente,
sem vínculo com o autor original.
