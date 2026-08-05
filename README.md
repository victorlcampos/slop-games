# WorldDrive 🌍🏎️

### ▶️ [Jogar agora](https://victorlcampos.github.io/worlddrive/)

Jogo de carro no browser: escolha **qualquer rua do mundo** e dirija nela. O mundo 3D é
gerado na hora a partir de dados reais:

- **Ruas, prédios e árvores** — OpenStreetMap (Overpass API, com 4 espelhos e retry)
- **Relevo** — AWS Terrain Tiles / formato terrarium (SRTM etc., z15)
- **Chão** — imagens de satélite Esri World Imagery (mosaico z17–19)
- **Busca de lugares** — Photon, com fallback Nominatim

Tudo roda **100% no cliente**: o entregável é um único arquivo — **`dist/index.html`**
(~580 KB) — que abre com **duplo clique** (`file://`), sem servidor. Todos os provedores
acima respondem `Access-Control-Allow-Origin: *` inclusive para origem `null` (verificado).
Só é preciso internet durante o carregamento de uma área.

## Build

```sh
npm install
node build.mjs        # gera dist/index.html (bundle three.js inline no template)
```

## Teste (smoke)

```sh
node test/smoke.mjs               # Chrome headless: abre via file://, carrega São Francisco e dirige
PRESET=2 node test/smoke.mjs      # 0=São Francisco 1=Mônaco 2=Rio 3=Paris 4=Tóquio 5=NY
URL=https://victorlcampos.github.io/worlddrive/ node test/smoke.mjs   # testa o deploy publicado
```

Obs.: o Overpass principal rejeita o fingerprint "HeadlessChrome" (406); o teste disfarça
UA + client hints. Browsers reais não são afetados.

## Controles

W/A/S/D ou setas · **espaço** freio de mão (drift) · **R** volta à rua · **N** recarrega o
mundo onde você está (dirige "infinito" por saltos) · **C** câmeras · **M** som · **Esc** menu.
Em telas touch aparecem botões na tela.

## Arquitetura (src/)

`geo` projeções/tiles · `net` fetch/pool · `overpass` query+parse OSM · `terrain` heightmap
terrarium · `satellite` mosaico Esri · `roads` fitas de asfalto + índice espacial ·
`buildings` extrusão + colisão · `trees` instancing · `world` orquestra tudo ·
`car` física arcade (bicycle model, substeps, ladeira, colisão círculo×parede) ·
`main` three.js, câmeras, loop, auto-qualidade · `ui`/`picker`/`minimap`/`audio`/`input`.

## Limitações conhecidas

- Área carregada de ~1,3×1,3 km por vez (tecla **N** recarrega centrado em você).
- Pontes/túneis são achatados no terreno (túneis são omitidos).
- Elevação z15 (~5 m/px): ladeiras reais aparecem, mas detalhes finos (meio-fio, viadutos) não.
- Os espelhos públicos do Overpass têm picos de carga; o jogo tenta 4 espelhos × 2 rodadas.
