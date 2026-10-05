param([string]$InstallerPath)
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Right-click Install-Nyx-Service.cmd and choose Run as administrator.' }
$destination = Join-Path $env:ProgramFiles 'NyxRemote'
$state = Join-Path $env:ProgramData 'NyxRemote'
$serviceConfig = Join-Path $state 'service.dpapi'
if (Test-Path -LiteralPath $serviceConfig) { throw 'A service pairing already exists. Use Remove-Service.ps1 before reinstalling.' }
if ((Get-Service -Name tvnserver -ErrorAction SilentlyContinue) -and -not (Test-Path -LiteralPath (Join-Path $state 'nyx-installed.txt'))) { throw 'An existing TightVNC installation was found. It has not been changed.' }
if (-not $InstallerPath) { $InstallerPath = Join-Path $PSScriptRoot 'tightvnc-2.8.88-gpl-setup-64bit.msi' }
if (-not (Test-Path -LiteralPath $InstallerPath)) { Invoke-WebRequest -UseBasicParsing 'https://www.tightvnc.com/download/2.8.88/tightvnc-2.8.88-gpl-setup-64bit.msi' -OutFile $InstallerPath }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $InstallerPath).Hash -ne 'FA86D817AC29C5FFE1E8E7095E738D9BA5CA28AA62304AC234580916622A8CA2') { throw 'Installer checksum mismatch.' }
$signature = Get-AuthenticodeSignature -LiteralPath $InstallerPath
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=OOO GlavSoft') { throw 'Installer signature could not be verified.' }
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) { throw 'Install Node.js 22 or 24 for all users first.' }
New-Item -ItemType Directory -Force -Path $destination,$state | Out-Null


foreach ($directory in @($destination,$state)) {
 $acl = New-Object Security.AccessControl.DirectorySecurity
 $acl.SetAccessRuleProtection($true,$false)
 $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
 foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
  $rule = New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)),'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $directory -AclObject $acl
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'service-bridge.mjs') -Destination $destination -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Remove-Service.ps1') -Destination $destination -Force
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32; $random.GetBytes($bytes)
$credential = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$passwordBytes = New-Object byte[] 16; $random.GetBytes($passwordBytes)
$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$password = -join ($passwordBytes[0..7] | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
$random.Dispose()
Add-Type -AssemblyName System.Security
$config = @{origin='https://nyxlearning.org';credential=$credential;name=$env:COMPUTERNAME;vncPassword=$password} | ConvertTo-Json -Compress
$encrypted = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($config),$null,[Security.Cryptography.DataProtectionScope]::LocalMachine)
[IO.File]::WriteAllText($serviceConfig,[Convert]::ToBase64String($encrypted))
[IO.File]::WriteAllText((Join-Path $state 'nyx-installed.txt'),'TightVNC installed for Nyx Remote')
foreach ($name in @('pairing.txt','status.txt')) {
 $path = Join-Path $state $name; [IO.File]::WriteAllText($path,'Waiting for service setup')
 $acl = Get-Acl -LiteralPath $path
 $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity.User,'Read','Allow')))
 Set-Acl -LiteralPath $path -AclObject $acl
}


$arguments = @('/i',('"'+$InstallerPath+'"'),'/quiet','/norestart','ADDLOCAL=Server','SERVER_REGISTER_AS_SERVICE=1','SERVER_ADD_FIREWALL_EXCEPTION=0','SERVER_ALLOW_SAS=1','SET_ACCEPTHTTPCONNECTIONS=1','VALUE_OF_ACCEPTHTTPCONNECTIONS=0','SET_ACCEPTRFBCONNECTIONS=1','VALUE_OF_ACCEPTRFBCONNECTIONS=0','SET_ALLOWLOOPBACK=1','VALUE_OF_ALLOWLOOPBACK=1','SET_LOOPBACKONLY=1','VALUE_OF_LOOPBACKONLY=1','SET_USEVNCAUTHENTICATION=1','VALUE_OF_USEVNCAUTHENTICATION=1','SET_PASSWORD=1',('VALUE_OF_PASSWORD='+$password),'SET_USECONTROLAUTHENTICATION=1','VALUE_OF_USECONTROLAUTHENTICATION=1','SET_CONTROLPASSWORD=1',('VALUE_OF_CONTROLPASSWORD='+$password))
$process = Start-Process -FilePath msiexec.exe -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -notin @(0,3010)) { throw ('TightVNC installation failed: '+$process.ExitCode) }
Stop-Service tvnserver -ErrorAction SilentlyContinue
$registry = 'HKLM:\SOFTWARE\TightVNC\Server'
foreach ($item in @{LoopbackOnly=1;AllowLoopback=1;AcceptHttpConnections=0;AcceptRfbConnections=1;UseVncAuthentication=1;EnableFileTransfers=0;AcceptCutText=0;SendCutText=0}.GetEnumerator()) {
 New-ItemProperty -Path $registry -Name $item.Key -Value $item.Value -PropertyType DWord -Force | Out-Null
}
$registryAcl = New-Object Security.AccessControl.RegistrySecurity
$registryAcl.SetAccessRuleProtection($true,$false)
foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
 $registryAcl.AddAccessRule((New-Object Security.AccessControl.RegistryAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)),'FullControl','ContainerInherit','None','Allow')))
}
Set-Acl -Path $registry -AclObject $registryAcl
Set-Service tvnserver -StartupType Automatic
Start-Service tvnserver
$action = New-ScheduledTaskAction -Execute $node -Argument ('"'+(Join-Path $destination 'service-bridge.mjs')+'"') -WorkingDirectory $destination
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT20S'
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'Nyx Remote Service Bridge' -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Description 'Owner-only Nyx connection to loopback TightVNC; starts before Windows sign-in.' -Force | Out-Null

$oldTask = Get-ScheduledTask -TaskName 'Nyx Remote Desktop' -ErrorAction SilentlyContinue
if ($oldTask) { Stop-ScheduledTask -TaskName 'Nyx Remote Desktop'; Disable-ScheduledTask -TaskName 'Nyx Remote Desktop' | Out-Null }
Start-ScheduledTask -TaskName 'Nyx Remote Service Bridge'
Write-Host 'Windows service installed. In Nyx Owner Dashboard > Remote desktop, enter the code in:'
Write-Host (Join-Path $state 'pairing.txt')
Write-Host 'Nyx backend must be deployed before pairing works. Your PC must remain powered on and awake.'
