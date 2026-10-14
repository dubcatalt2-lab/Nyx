# Deploy the restored release

These instructions replace the active Nyx service with this restored checkout, retaining existing private environment files and other services. They do not deploy Novene. The activation script has been syntax-checked locally; remote activation is unverified because SSH authentication was unavailable.

## On your laptop (PowerShell)

```powershell
Set-Location C:/Users/dubca/Downloads/Nyx-VM-Restore-20261013
git push origin HEAD:refs/heads/rollback/vm-complete-20261013
ssh ubuntu@15.204.93.166
```

If SSH asks for account verification, complete it yourself. If it reports `Permission denied (publickey)`, use your configured SSH identity or your VPS provider console; these commands cannot fix missing server access.

## On the VPS (Bash)

Use a new checkout, not `/var/www/nyx`. Node.js 20?24 and npm must be available. The existing `nyx.service`, private environment files and domain routing must already be configured.

```bash
release="/var/www/nyx-restored-$(date +%Y%m%d-%H%M%S)"
sudo mkdir "$release"
sudo chown "$USER":"$(id -gn)" "$release"
git clone --single-branch --branch rollback/vm-complete-20261013 https://github.com/dubcatalt2-lab/Nyx.git "$release"
cd "$release"
npm ci
npm run build:vps
npm run check:deploy
sudo bash deploy/activate-restored-release.sh
```

Run each command only if the previous one succeeds. Activation rolls back its new systemd override if its health or Wisp handshake checks fail. It leaves the previous release files intact. It refuses to overwrite an existing restored-release override; inspect that override before a later deployment.

## Verify after activation

```bash
curl -fsS http://127.0.0.1:8080/healthz
node scripts/test-public-wisp.mjs wss://nyxlearning.org/wisp/
sudo systemctl status nyx.service --no-pager
```

Open the public site and test the built-in apps. If the local handshake passes but the public one fails, inspect the existing reverse-proxy routing for `/wisp/`; a successful local startup alone does not prove public routing works.

The shareable endpoint is `wss://nyxlearning.org/wisp/`. Configure it in Wisp-compatible clients, not as an ordinary search-page URL.

NyxTube still needs valid private server cookies and upstream YouTube access. This release distinguishes a YouTube verification challenge from rejected login cookies; it cannot guarantee that refreshed cookies will be accepted by YouTube.
