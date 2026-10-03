$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open PowerShell as administrator, then run this updater. It preserves your existing pairing.' }
$destination = Join-Path $env:ProgramFiles 'NyxRemote'
$target = Join-Path $destination 'service-bridge.mjs'
$source = Join-Path $PSScriptRoot 'service-bridge.mjs'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $target)) { throw 'The installed Nyx bridge was not found. Nothing changed.' }
$old = [IO.File]::ReadAllText($target)
$new = [IO.File]::ReadAllText($source)
# Keep the transport selected on this PC, including the existing ngrok option.
$pattern = "new WebSocket\('([^']+)'\)"
$match = [regex]::Match($old,$pattern)
if (-not $match.Success) { throw 'Unrecognized installed bridge. Nothing changed.' }
$address = $match.Groups[1].Value
$allowed = @('wss://fmsrobotics.robot-agachado.com/api/private-remote/socket','wss://nyxlearning.org/api/private-remote/socket','wss://used-cause-riveting.ngrok-free.dev/api/private-remote/socket')
if ($address -notin $allowed) { throw 'Unrecognized connection address. Nothing changed.' }
$new = $new.Replace('wss://fmsrobotics.robot-agachado.com/api/private-remote/socket',$address)
$staged = Join-Path $destination 'service-bridge-update.mjs'
[IO.File]::WriteAllText($staged,$new,(New-Object Text.UTF8Encoding($false)))
& $node --check $staged
if ($LASTEXITCODE -ne 0) { throw 'Bridge syntax validation failed. The installed bridge was not changed.' }
$backup = $target + '.before-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item -LiteralPath $target -Destination $backup
Stop-ScheduledTask -TaskName 'Nyx Remote Service Bridge'
try {
  Copy-Item -LiteralPath $staged -Destination $target -Force
  Start-ScheduledTask -TaskName 'Nyx Remote Service Bridge'
} catch {
  Copy-Item -LiteralPath $backup -Destination $target -Force
  Start-ScheduledTask -TaskName 'Nyx Remote Service Bridge'
  throw
}
Start-Sleep -Seconds 8
Get-Content (Join-Path $env:ProgramData 'NyxRemote\status.txt')
Write-Host 'Bridge updated. Pairing and connection address preserved. Refresh the remote viewer once.'
