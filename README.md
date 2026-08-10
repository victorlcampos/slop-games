# 🕹️ slop-games

Jogos que rodam inteiros no navegador. Cada um é **um único arquivo HTML** —
sem servidor, sem instalação, sem conta.

▶️ **[Jogar](https://victorlcampos.github.io/slop-games/)**

---

## O catálogo

| | Jogo | O que é | Libs | Rede |
|---|---|---|---|---|
| 🐆 | **[Animais vs Monstros](jogos/animais-vs-monstros)** | Defesa de fileiras. As lendas ganharam corpo e paralisaram a humanidade de medo; os bichos nunca ouviram essas histórias e por isso são imunes. 10 fases no Brasil contra o folclore. | nenhuma | offline |
| ⛷️ | **[SkiFree 3D](jogos/skifree3d)** | Releitura em 3D do SkiFree de 1991. Desça a montanha desviando das árvores até o Abominável aparecer. | three.js | offline |
| 🚗 | **[World Drive](jogos/worlddrive)** | Dirija por qualquer rua do mundo. O cenário 3D é montado ao vivo com dados reais do OpenStreetMap. | three.js | precisa de rede |
| 🦁 | **[Zoo Magnata](jogos/zoo-magnata)** | Tycoon de zoológico com 219 espécies desenhadas em código, recintos de forma livre e economia completa. | nenhuma | offline |

Nenhum deles tem uma única imagem: sprites, terreno, texturas e som são gerados
por código em tempo de carga.

## Rodando local

```bash
npm install       # uma vez
npm run abrir     # builda tudo e abre o índice no navegador
```

O build gera `dist/index.html` (o índice) e `dist/<slug>/index.html` (cada jogo).
Todos abrem com **duplo clique** — nada de servidor local.

```bash
npm run build              # builda tudo
npm run build zoo-magnata  # builda um jogo só
npm test                   # abre tudo por file:// e checa erro de JS
```

## Adicionando um jogo

As regras da casa — tecnologias, contrato de build, o que não se negocia — estão
em **[CLAUDE.md](CLAUDE.md)**. O resumo: um `index.html` autossuficiente, zero
CDN, assets gerados por código, esbuild como bundler.

O índice é gerado a partir dos `jogos/*/jogo.json`, então um jogo novo aparece
sozinho depois do build.

## Publicação

Push na `main` → o GitHub Actions **roda os testes e só publica se passarem**. O
que vai ao ar é o mesmo artefato que foi testado, não um build novo. Pull request
roda os testes sem publicar. `dist/` não vai para o git.

## Testes

```bash
npm test               # unidade do kit + o piso de todos os jogos
npm run test:jogos     # o teste próprio de cada jogo
CI=1 npm test          # reproduz o ambiente do runner
```
