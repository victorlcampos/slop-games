# slopkit

O que todo jogo do slop-games precisa antes de virar jogo: tela que se adapta,
laço que não muda de comportamento com o monitor, save que sobrevive à próxima
versão, mudo que o jogador não precisa desligar duas vezes.

Nada aqui desenha nada — o traço é de cada jogo.

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

## Uso

```js
import { criarTela, criarLaco, criarSave, criarSom } from 'slopkit';

const tela = criarTela(canvas);          // altura lógica 720, largura elástica
tela.observar(() => reposicionar());     // só dispara se a largura mudar

const cofre = criarSave({
  jogo: 'meu-jogo',
  versao: 1,
  inicial: () => ({ versao: 1, moedas: 0 }),
  normalizar: (bruto, base) => ({ ...base, ...bruto }),
});
let estado = cofre.carregar();

const som = criarSom({ jogo: 'meu-jogo' });

criarLaco({
  passo: 1 / 60,
  simular: (h) => mundo.tick(h),   // h é SEMPRE o mesmo valor
  desenhar: () => { tela.preparar(); pintar(tela.ctx); },
}).iniciar();
```

## Módulos

- **`slopkit/tela`** — `criarTela`, `medir` (a conta pura, testável sem browser)
- **`slopkit/laco`** — `criarLaco`, `passosPara` (idem)
- **`slopkit/save`** — `criarSave`, `baixarTexto`, `lerArquivoTexto`
- **`slopkit/som`** — `criarSom`
- **`slopkit/testes`** — andaime de teste de jogo (Node + puppeteer-core)

Funções puras existem de propósito: a conta que importa cabe num teste de
milissegundos, sem abrir Chrome.

## Testes

```bash
npm test -w slopkit
```
