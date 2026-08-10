#!/usr/bin/env bash
# Gera o index.html final concatenando os módulos de src/ na ordem.
# O jogo é entregue como UM arquivo, mas é editado em partes.
set -euo pipefail
cd "$(dirname "$0")"

cat src/01_head.html \
    src/02_util.js \
    src/03_species.js \
    src/04_sprites.js \
    src/05_world.js \
    src/06_entities.js \
    src/06b_audio.js \
    src/07_render.js \
    src/08_ui.js \
    src/09_game.js > index.html
printf '\n</script>\n</body>\n</html>\n' >> index.html

# checagem de sintaxe do JS concatenado (precisa de node; opcional)
if command -v node >/dev/null 2>&1; then
  cat src/0[2-9]*.js > /tmp/zoo-check.js
  node --check /tmp/zoo-check.js && echo "sintaxe: ok"
  rm -f /tmp/zoo-check.js
fi

echo "index.html: $(wc -c < index.html) bytes"
