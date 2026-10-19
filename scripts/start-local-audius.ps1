$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$staticRoot = Join-Path $projectRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $staticRoot 'index.html'))) {
  throw 'Build Nyx with npm run build:vps before starting the Audius test.'
}
$env:PORT = '6769'
$env:NYX_STATIC_ROOT = $staticRoot
$env:NYX_MUSIC_PROVIDER = 'hybrid'
$credentialPath = Join-Path $env:USERPROFILE 'tidal-credentials.json'
if (Test-Path -LiteralPath $credentialPath) { $env:NYX_TIDAL_CREDENTIALS_FILE = $credentialPath }
$env:NYX_DISCORD_BRIDGE_ENABLED = '0'
& (Join-Path $PSScriptRoot 'start-local-accounts.ps1')
exit $LASTEXITCODE
