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

# skill sound-effects (glebis, MIT): gera os efeitos sonoros com a ElevenLabs
$sfx = Join-Path $PSScriptRoot 'skills\sound-effects'
$sfxDest = Join-Path $env:USERPROFILE '.claude\skills\sound-effects'
if (Test-Path $sfxDest) { Remove-Item -Recurse -Force $sfxDest }
Copy-Item -Recurse -Force $sfx $sfxDest
Write-Host "Skill sound-effects copiada para $sfxDest"

node (Join-Path $dest 'scripts\setup.mjs')
Write-Host "`nPronto. Abra o Claude Code e use /maquina-cortes-gta"
