$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$staticRoot = Join-Path $projectRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $staticRoot 'index.html'))) {
  throw 'Run npm run build:vps before starting the obfuscated local app.'
}
$env:PORT = '8080'
$env:NYX_STATIC_ROOT = $staticRoot
$env:NYX_MUSIC_PROVIDER = 'hybrid'
$credentialPath = Join-Path $env:USERPROFILE 'tidal-credentials.json'
if (Test-Path -LiteralPath $credentialPath) { $env:NYX_TIDAL_CREDENTIALS_FILE = $credentialPath }
$tokenPath = Join-Path $env:USERPROFILE 'discord-bot-token.txt'
if (Test-Path -LiteralPath $tokenPath) {
  $env:NYX_DISCORD_TOKEN_FILE = $tokenPath
  $env:NYX_DISCORD_BRIDGE_ENABLED = '1'
}
& (Join-Path $PSScriptRoot 'start-local-accounts.ps1')
exit $LASTEXITCODE
