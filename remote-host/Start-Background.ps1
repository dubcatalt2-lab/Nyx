$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'NyxRemote\device.dpapi'))) { exit 0 }
$node = (Get-Command node.exe -ErrorAction Stop).Source
Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $PSScriptRoot 'host.mjs') + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -Wait
