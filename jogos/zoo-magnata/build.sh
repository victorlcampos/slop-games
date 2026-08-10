#!/usr/bin/env bash
# Gera o dist/index.html final concatenando os módulos de src/ na ordem.
# O jogo é entregue como UM arquivo, mas é editado em partes.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p dist

cat src/01_head.html \
    src/02_util.js \
    src/03_species.js \
    src/04_sprites.js \
    src/05_world.js \
    src/06_entities.js \
    src/06b_audio.js \
    src/07_render.js \
    src/08_ui.js \
    src/09_game.js > dist/index.html
printf '\n</script>\n</body>\n</html>\n' >> dist/index.html

# checagem de sintaxe do JS concatenado (precisa de node; opcional)
if command -v node >/dev/null 2>&1; then
  cat src/0[2-9]*.js > dist/.check.js
  node --check dist/.check.js && echo "sintaxe: ok"
  rm -f dist/.check.js
fi

echo "dist/index.html: $(wc -c < dist/index.html) bytes"
