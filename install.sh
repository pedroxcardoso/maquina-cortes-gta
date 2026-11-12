#!/usr/bin/env bash
# Instala a skill maquina-cortes-gta e as dependências dela (macOS / Linux / Git Bash).
# Uso:  bash install.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude/skills/maquina-cortes-gta"

command -v node >/dev/null || { echo "Instale o Node.js 18+ (recomendado 22+): https://nodejs.org"; exit 1; }

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$HERE/skills/maquina-cortes-gta" "$DEST"
echo "Skill copiada para $DEST"

node "$DEST/scripts/setup.mjs"
echo
echo "Pronto. Abra o Claude Code e use /maquina-cortes-gta"
