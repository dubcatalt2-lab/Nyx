# Move Nyx to one OVHcloud VPS

This runbook moves Nyx's website, API, and Wisp WebSocket service onto one Ubuntu VPS. Nginx is the public reverse proxy, Nyx listens only on local port `8080`, and systemd keeps it running. The application serves the generated, minified `dist/` build while the API and IP-ban guard continue to run through Express.

Netlify and Railway are intentionally left configured as a rollback until the OVH deployment has been stable. Do not cancel them or remove their files before completing the final verification.

## What to buy

- One standard OVHcloud VPS with Ubuntu 24.04. A 2-vCPU, 4-GB RAM plan is a sensible starting point for Nyx.
- Keep `nyxlearning.org` in the existing Cloudflare account. You do not need another domain, paid SSL, Plesk, cPanel, or web-hosting add-ons.
- Do not expose port `8080`. Only SSH, HTTP, and HTTPS should be public.

## 1. Publish the prepared code

On the Windows development computer, from the Nyx repository:

```powershell
cd C:\path\to\Nyx
npm ci
npm run build:netlify
npm run check:deploy
git status -sb
```

Review and commit only the intended Nyx files. Never use `git add -A` in this workspace because `.codex-artifacts/`, `.worktrees/`, and `wisp-test/` must remain untouched.

```powershell
git add DEPLOYMENT.md deploy docs/NYX_PROJECT_STATE.md server.js scripts/check-deploy.mjs
git add apps/link-checker package.json package-lock.json scramjet.sw.js scripts/build-netlify.mjs
git diff --cached --check
git commit -m "Prepare Nyx for OVHcloud"
git push origin agent/pirate-cove
```

Those commands are instructions, not permission for an agent to push. Confirm that PR #34 contains the commit before installing the VPS.

## 2. Create and secure the VPS

Install Ubuntu 24.04 from the OVHcloud control panel. OVH will show the initial SSH username and IP address. From PowerShell:

```powershell
ssh-keygen -t ed25519 -C "nyx-ovh"
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
ssh ubuntu@YOUR_VPS_IP
```

Add the displayed public key to the VPS if it was not supplied during installation. After key login works, follow OVH's security guidance: update packages, create a non-root sudo user if the image did not provide one, and disable password SSH login only after confirming the key works in a second terminal.

On the VPS:

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
```

For a private GitHub repository, create a separate SSH key on the VPS and add its public half to GitHub as a read-only deploy key. Then clone the active branch:

```bash
git clone --branch agent/pirate-cove git@github.com:dubcatalt2-lab/Nyx.git /var/www/nyx
cd /var/www/nyx
```

## 3. Install Nyx

Run the prepared installer with the domain name, without `https://` or `www`:

```bash
sudo bash deploy/setup-ovh.sh nyxlearning.org
```

The installer:

- installs a supported Node.js release, Nginx, UFW, and Fail2ban;
- builds and validates Nyx for its same-origin Wisp endpoint, keeps the large bundled games that the Netlify build must omit, then removes build-only packages from the VPS;
- creates an unprivileged, hardened `nyx` systemd service;
- serves the generated `dist/` output through the same Express request/IP-ban guard as the API;
- configures WebSocket forwarding for embedded Wisp;
- trusts Cloudflare visitor-IP headers only from Cloudflare's published networks and overwrites spoofable forwarding headers;
- opens only SSH, HTTP, and HTTPS; and
- preserves the secret environment file and certificate-aware Nginx site when rerun.

## 4. Add the environment variables

The installer creates `/etc/nyx/nyx.env`. Open it on the VPS:

```bash
sudo nano /etc/nyx/nyx.env
```

The non-secret core values are already filled in. Copy the current secret values from **Netlify > Site configuration > Environment variables** into their matching lines:

```dotenv
FIREBASE_WEB_API_KEY='...'
FIREBASE_PROJECT_ID='...'
FIREBASE_CLIENT_EMAIL='...'
FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
NYX_FOUNDER_PROFILE_ADMIN_UID='...'
NYX_LINK_CHECKER_API_KEY='...'
BUNNY_API_KEY='...'
LINK_GENERATOR_ACCESS_CODE='...'
NYX_SAFE_BROWSING_API_KEY='...'
NYX_AI_API_KEY='...'
```

Only add variables for features you use. Do not paste `curl` commands into this file, and never put the actual values in Git, Discord, screenshots, or chat. Keep the Firebase private key on one line with literal `\n` characters.

For the one-server setup, leave `WISP_URL` commented out. Nyx then uses `wss://nyxlearning.org/wisp/`. `NYX_ALLOWED_ORIGINS` must include the exact production domain. `NYX_SITE_URL` and `OPENROUTER_API_KEY` are obsolete names and should not be added.

Save Nano with `Ctrl+O`, Enter, then `Ctrl+X`. Apply and verify:

```bash
sudo systemctl restart nyx
sudo systemctl status nyx --no-pager
curl --fail http://127.0.0.1:8080/healthz
```

If it fails:

```bash
sudo journalctl -u nyx -n 100 --no-pager
```

## 5. Install HTTPS before changing DNS

Cloudflare's DNS challenge lets the VPS obtain a certificate before traffic is moved. In Cloudflare, create an API token limited to **Zone / DNS / Edit** for only `nyxlearning.org`. On the VPS:

```bash
sudo apt-get install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare
sudo install -d -m 0700 /etc/letsencrypt
sudo nano /etc/letsencrypt/cloudflare.ini
```

Put only this in that file:

```ini
dns_cloudflare_api_token = YOUR_LIMITED_CLOUDFLARE_DNS_TOKEN
```

Then:

```bash
sudo chmod 600 /etc/letsencrypt/cloudflare.ini
sudo certbot run \
  --authenticator dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --installer nginx \
  -d nyxlearning.org \
  -d www.nyxlearning.org
sudo certbot renew --dry-run
sudo nginx -t
```

Do not put this Cloudflare token in `/etc/nyx/nyx.env`; it belongs only in Certbot's root-only credential file.

## 6. Test the origin before cutover

From the Windows computer, force only this request to the VPS while public DNS still points to Netlify:

```powershell
curl.exe --resolve nyxlearning.org:443:YOUR_VPS_IP https://nyxlearning.org/healthz
curl.exe --resolve nyxlearning.org:443:YOUR_VPS_IP https://nyxlearning.org/apps/link-checker/
```

The health response should report `"ok":true` and `"wisp":"embedded"`. Also test sign-in, Owner Dashboard, Link Checker, Pirate Cove, one proxied page, and one Wisp-backed game in a temporary hosts-file test or after cutover.

## 7. Change Cloudflare DNS

In **Cloudflare > DNS > Records**, change the existing `A` records:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `YOUR_VPS_IP` | Proxied |
| A | `www` | `YOUR_VPS_IP` | Proxied |

Remove only conflicting web `A`/`AAAA`/`CNAME` records after confirming what they do. Preserve mail records. In Cloudflare, use **SSL/TLS > Full (strict)** and keep WebSockets enabled.

Keep the existing `nyx_ip_bans` IP List and WAF expression:

```text
ip.src in $nyx_ip_bans
```

The VPS also applies Nyx's Firestore IP-ban list to every Express-served page, API call, and Wisp upgrade. Cloudflare remains the earliest full-site block.

## 8. Verify production and retain rollback

```powershell
curl.exe https://nyxlearning.org/healthz
```

Verify:

- homepage and static assets;
- Firebase sign-in and account/profile activity;
- Owner Dashboard and a harmless administrative read;
- Link Checker single check and authorized full scan controls;
- Pirate Cove and a large Unity game;
- Scramjet/Ultraviolet through embedded Wisp;
- smartwatch layout if that device matters; and
- HTTPS renewal with `sudo certbot renew --dry-run`.

Keep Netlify and Railway intact for at least 24 hours of stable production. Rollback is changing the Cloudflare web records back to the previous Netlify target. Only after the VPS is proven should you decide whether to cancel paid services or remove old deployment configuration.

## Updating Nyx later

After reviewed changes are committed and pushed to the same branch, SSH into the VPS and run:

```bash
cd /var/www/nyx
sudo bash deploy/update-ovh.sh
```

The updater performs a fast-forward-only pull, reinstalls the locked dependencies, rebuilds and validates `dist/`, removes build-only packages, restarts Nyx, and checks local health. It stops instead of deploying when the pull or validation fails.

Useful commands:

```bash
sudo systemctl status nyx --no-pager
sudo journalctl -u nyx -f
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart nyx
curl --fail http://127.0.0.1:8080/healthz
```
