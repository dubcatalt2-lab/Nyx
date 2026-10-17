$ErrorActionPreference = 'Stop'
$destination = Join-Path $env:LOCALAPPDATA 'NyxRemote'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
foreach ($name in @('host.mjs','desktop.ps1','Start-Nyx-Remote.cmd','Start-Background.ps1','Remove-Startup.ps1')) {
 $source = Join-Path $PSScriptRoot $name
 $target = Join-Path $destination $name
 if ([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($target)) { Copy-Item -LiteralPath $source -Destination $target -Force }
}
$null = Get-Command node.exe -ErrorAction Stop
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $destination 'Start-Background.ps1') + '"') -WorkingDirectory $destination
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Nyx Remote Desktop' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Private Nyx owner remote desktop. Stop using its tray menu.' -Force | Out-Null
Write-Host 'Nyx Remote will start when you sign into Windows. Keep the PC awake to connect.'
