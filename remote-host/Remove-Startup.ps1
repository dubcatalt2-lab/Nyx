$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName 'Nyx Remote Desktop' -ErrorAction SilentlyContinue
if ($task) { Stop-ScheduledTask -TaskName 'Nyx Remote Desktop'; Unregister-ScheduledTask -TaskName 'Nyx Remote Desktop' -Confirm:$false }
Write-Host 'Automatic startup removed. Exit any manually started helper using its tray menu. Remove the computer from Nyx to revoke its pairing.'
