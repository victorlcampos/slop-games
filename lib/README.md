# slopkit

O que todo jogo do slop-games precisa antes de virar jogo: tela que se adapta,
laço que não muda de comportamento com o monitor, save que sobrevive à próxima
versão, mudo que o jogador não precisa desligar duas vezes, e as duas bandeiras.

Nada aqui desenha nada — o traço é de cada jogo. As bandeiras são a única
exceção, e por um motivo: elas são as mesmas em todo lugar.

## Por que existe

Os quatro jogos do catálogo resolviam os mesmos problemas, cada um de um jeito.
Este pacote é o resultado de comparar as quatro implementações e ficar com a
melhor de cada uma:

| Peça | Veio do | Por quê |
|---|---|---|
| largura elástica | Animais vs Monstros | preenche qualquer proporção sem barra nem distorção |
| teto de DPR adaptativo | Zoo Magnata | DPR 3 triplica a pintura sem ganho visível |
| laço de passo fixo | Zoo Magnata | era o único imune a variação de framerate |
| save em formato único | Zoo Magnata | mesmo retrato para autosave e arquivo |
| normalização de save | Animais vs Monstros | save velho perde um campo, nunca a partida |
| mudo persistido | 3 dos 4 jogos | o Animais era o único que esquecia |
| dicionário por frase | novo | com um objeto por idioma, uma chave some no outro sem ninguém ver |

## Uso

```js
import { createViewport, createLoop, createSave, createSound, createI18n } from 'slopkit';

const vp = createViewport(canvas);       // altura lógica 720, largura elástica
vp.watch(() => reposition());            // só dispara se a largura mudar

const i18n = createI18n({
  dict: { play: { pt: 'Jogar', en: 'Play' } },   // as duas línguas lado a lado
});

const vault = createSave({
  game: 'meu-jogo',
  version: 1,
  initial: () => ({ version: 1, coins: 0 }),
  normalize: (raw, base) => ({ ...base, ...raw }),
  i18n,                                  // os avisos de save falam a língua certa
});
let state = vault.load();

const sound = createSound({ game: 'meu-jogo' });

createLoop({
  step: 1 / 60,
  update: (h) => world.tick(h),   // h é SEMPRE o mesmo valor
  draw: () => { vp.begin(); paint(vp.ctx); },
}).start();
```

## Módulos

- **`slopkit/viewport`** — `createViewport`, `measure` (a conta pura, testável sem browser)
- **`slopkit/loop`** — `createLoop`, `stepsFor` (idem)
- **`slopkit/save`** — `createSave`, `downloadText`, `readTextFile`
- **`slopkit/sound`** — `createSound`
- **`slopkit/i18n`** — `createI18n`, `pickLang`, `interpolate`, `missingKeys`
- **`slopkit/flags`** — `drawFlag`, `flagDataURL` (bandeiras desenhadas em canvas)
- **`slopkit/langpicker`** — `mountLangPicker`, `bindText`, `drawLangPicker`, `pickLangAt`
- **`slopkit/build`** — o build de todo jogo daqui
- **`slopkit/testing`** — andaime de teste de jogo (Node + puppeteer-core)

Funções puras existem de propósito: a conta que importa cabe num teste de
milissegundos, sem abrir Chrome. Vale para o i18n também — `pickLang`,
`interpolate` e `missingKeys` são testados sem navegador nenhum.

## Sobre as bandeiras

Desenhadas em canvas, não emoji. O 🇧🇷 e o 🇺🇸 são pares de indicadores
regionais, e o Windows não tem glifo para eles: no sistema desktop mais comum
do mundo o seletor viraria as letras "BR" e "US" numa caixinha. Vinte linhas de
canvas ganham disso em todo lugar — e ainda respeitam a regra nº 5 do
repositório, que proíbe imagem.

Uma rotina, duas saídas: `drawFlag` pinta em qualquer contexto 2D (jogo que
desenha o menu no canvas) e `flagDataURL` roda a mesma rotina num canvas fora
da tela para o DOM usar como `<img>`.

## Testes

```bash
npm test -w slopkit
```
