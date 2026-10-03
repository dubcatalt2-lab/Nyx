Nyx Remote Desktop - private owner preview

Unattended Windows service (recommended for login-screen access)
1. Right-click Install-Nyx-Service.cmd and choose Run as administrator.
   It downloads the official signed TightVNC 2.8.88 installer if needed,
   verifies its pinned SHA256 and signature, and installs only its server.
2. The backend listens for loopback connections only, with a generated password;
   no firewall exception or public/LAN remote-desktop access is enabled.
3. After the Nyx backend is deployed, open Nyx > Owner Dashboard > Remote desktop
   with your exact owner account. Enter the code from
   C:\ProgramData\NyxRemote\pairing.txt. The code expires in five minutes.
4. The Windows service and SYSTEM relay task start before sign-in. Windows can
   be locked or signed out, but the computer must stay powered on and awake.
   Sign into Windows remotely using your normal Windows credentials; Nyx does
   not save those credentials. Do not enable automatic Windows sign-in.
5. Remove a computer in Nyx to revoke access. Run Remove-Service.ps1 as
   administrator to stop/disable the backend and remove its relay task/pairing.
   Uninstall TightVNC through Windows Installed apps if no longer needed.

Service credentials use machine DPAPI in a SYSTEM/Administrators-only directory;
   code, configuration and TightVNC password registry access are restricted too.
   The prior sign-in-only Nyx task is disabled after successful service setup.
   Clipboard sharing, file transfer and audio are not enabled. A Ctrl+Alt+Delete
   button is available in the service viewer. Login-screen behavior must be
   verified after administrator installation; it is not certified by the mock
   RFB browser test. This setup does not change sleep/power or automatic login.

Optional sign-in-only helper (does NOT support locked/signed-out Windows)
Requires Windows 10/11 and Node.js 22 or 24. No npm packages needed.
1. Extract this entire folder and run Start-Nyx-Remote.cmd.
2. Open Nyx > Owner Dashboard > Remote desktop on your exact owner account.
3. Enter the pairing code displayed by the helper.
4. On your other device, sign into that same account and connect to this PC.
5. Optional: run Install-Startup.ps1 to start at Windows sign-in.

The tray icon shows when a viewer is connected. Its menu can disconnect the
viewer or exit. Remove a computer from Nyx to revoke its pairing permanently.
Remove-Startup.ps1 disables automatic startup. Pairing is encrypted with
Windows DPAPI under your Windows account in LocalAppData/NyxRemote.

This initial version streams the primary screen as JPEG at up to 4 fps and
1600px wide, with mouse and keyboard control. It requires Windows to remain
signed in, awake, and unlocked. It cannot unlock Windows, operate UAC/secure
desktop prompts, transmit audio, or transfer files. Browser/OS shortcuts may
remain local. One viewer at a time; active sessions renew authorization automatically. Desktop data
uses TLS through your Nyx server and is relayed in memory, never recorded.
Only the exact configured Firebase owner UID can pair, view, or remove devices.
Roles, co-owners, and the separate Drop owner do not grant access.

Connection route
Both Windows helpers default to the direct TLS desktop relay at
fmsrobotics.robot-agachado.com. Pairing/account requests still use nyxlearning.org.
The direct route uses the same exact-owner authorization and encrypted transport;
it avoids the previous route, which showed more frequent disconnects in testing.
No router port forwarding or public Windows desktop listener is required.

The Windows service retries interrupted connections and checks relay replies.
A brief missed heartbeat does not end an otherwise active desktop stream.
Protected ProgramData/NyxRemote/bridge-log.txt keeps the last 100 status entries
(close codes and connection state only, no credentials or desktop content).

Service updates
Run Update-Service.ps1 from an administrator PowerShell after downloading the
updated helper. It backs up the installed bridge and preserves its pairing and
selected connection address. A slow uplink now pauses desktop reads instead of
ending the stream when the outgoing buffer reaches 4 MB.
