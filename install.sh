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

# skill sound-effects (glebis, MIT): gera os efeitos sonoros com a ElevenLabs
SFX_DEST="$HOME/.claude/skills/sound-effects"
rm -rf "$SFX_DEST"
cp -R "$HERE/skills/sound-effects" "$SFX_DEST"
echo "Skill sound-effects copiada para $SFX_DEST"

node "$DEST/scripts/setup.mjs"
echo
echo "Pronto. Abra o Claude Code e use /maquina-cortes-gta"
