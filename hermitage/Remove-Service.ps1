$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this script as administrator.' }
$task = Get-ScheduledTask -TaskName 'Nyx Remote Service Bridge' -ErrorAction SilentlyContinue
if ($task) { Stop-ScheduledTask -TaskName 'Nyx Remote Service Bridge'; Unregister-ScheduledTask -TaskName 'Nyx Remote Service Bridge' -Confirm:$false }
$service = Get-Service -Name tvnserver -ErrorAction SilentlyContinue
if ($service) { Stop-Service tvnserver; Set-Service tvnserver -StartupType Disabled }
$pairing = Join-Path $env:ProgramData 'NyxRemote\service.dpapi'
if (Test-Path -LiteralPath $pairing) { Remove-Item -LiteralPath $pairing }
Write-Host 'Remote service stopped and disabled. Remove this computer from Nyx to revoke its pairing. Uninstall TightVNC through Windows Installed apps if no longer needed.'
