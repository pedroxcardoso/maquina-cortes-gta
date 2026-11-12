# Instala a skill maquina-cortes-gta e as dependências dela (Windows / PowerShell).
# Uso:  powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = 'Stop'
$skill = Join-Path $PSScriptRoot 'skills\maquina-cortes-gta'
$dest = Join-Path $env:USERPROFILE '.claude\skills\maquina-cortes-gta'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale o Node.js 18+ (recomendado 22+): https://nodejs.org' }

New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Copy-Item -Recurse -Force $skill $dest
Write-Host "Skill copiada para $dest"

node (Join-Path $dest 'scripts\setup.mjs')
Write-Host "`nPronto. Abra o Claude Code e use /maquina-cortes-gta"
