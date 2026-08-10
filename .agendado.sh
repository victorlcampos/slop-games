#!/usr/bin/env bash
# Commit e push agendados para as 20:30 de hoje.
# Idempotente: se já foi commitado, sai sem fazer nada.
set -euo pipefail
cd /Users/victorcampos/Workspace/slop-games

ALVO=$(date -j -f '%Y-%m-%d %H:%M:%S' "$(date '+%Y-%m-%d') 20:30:00" '+%s')
AGORA=$(date '+%s')
ESPERA=$(( ALVO - AGORA ))
if [ "$ESPERA" -gt 0 ]; then
  echo "[$(date '+%H:%M:%S')] esperando ${ESPERA}s até as 20:30…"
  sleep "$ESPERA"
fi

echo "[$(date '+%H:%M:%S')] publicando"
git add -A
if git diff --cached --quiet; then
  echo "nada para commitar — provavelmente já foi"
  exit 0
fi

git commit -F .commit-msg.tmp
echo "[$(date '+%H:%M:%S')] commit $(git rev-parse --short HEAD) feito, empurrando"
# a limpeza só depois do push: se o push falhar, a mensagem tem de sobreviver
git push origin main
rm -f .commit-msg.tmp .agendado.sh
echo "[$(date '+%H:%M:%S')] PUSH OK — $(git rev-parse --short HEAD)"
git log --oneline -1
