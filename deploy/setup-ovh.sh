#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo: sudo bash deploy/setup-ovh.sh yourdomain.com"
  exit 1
fi

DOMAIN=${1:-}
if [[ ! ${DOMAIN} =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]]; then
  echo "Usage: sudo bash deploy/setup-ovh.sh yourdomain.com"
  exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "${SCRIPT_DIR}/.." && pwd)
APP_OWNER=${SUDO_USER:-root}
ENV_FILE=/etc/nyx/nyx.env
CADDY_FILE=/etc/caddy/Caddyfile

echo "Installing Nyx for ${DOMAIN} from ${APP_DIR}"
apt-get update
apt-get install -y ca-certificates curl git ufw fail2ban debian-keyring debian-archive-keyring apt-transport-https gnupg

curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --batch --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
if [[ ${NODE_MAJOR} -lt 20 || ${NODE_MAJOR} -ge 25 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! id nyx >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/nyx --shell /usr/sbin/nologin nyx
fi

cd "${APP_DIR}"
runuser -u "${APP_OWNER}" -- npm ci
runuser -u "${APP_OWNER}" -- env -u WISP_URL NYX_BUILD_TARGET=vps NYX_PUBLIC_ORIGIN="https://${DOMAIN}" npm run build:netlify
runuser -u "${APP_OWNER}" -- npm run check:deploy
runuser -u "${APP_OWNER}" -- npm prune --omit=dev
chgrp -R nyx "${APP_DIR}"
chmod -R g+rX "${APP_DIR}"

install -d -m 0750 -o root -g nyx /etc/nyx
DOMAIN_TMP=$(mktemp)
printf '%s\n' "${DOMAIN}" > "${DOMAIN_TMP}"
install -m 0644 -o root -g root "${DOMAIN_TMP}" /etc/nyx/domain
rm -f "${DOMAIN_TMP}"
if [[ ! -f ${ENV_FILE} ]]; then
  ENV_TMP=$(mktemp)
  sed -e "s|__NYX_ROOT__|${APP_DIR}|g" -e "s|__NYX_DOMAIN__|${DOMAIN}|g" deploy/nyx.env.example > "${ENV_TMP}"
  install -m 0640 -o root -g nyx "${ENV_TMP}" "${ENV_FILE}"
  rm -f "${ENV_TMP}"
  echo "Created ${ENV_FILE}. Add server secrets there after setup."
else
  echo "Preserving existing ${ENV_FILE}."
fi

sed "s|__NYX_ROOT__|${APP_DIR}|g" deploy/systemd/nyx.service.template > /etc/systemd/system/nyx.service

CADDY_TMP=$(mktemp)
sed "s|__NYX_DOMAIN__|${DOMAIN}|g" deploy/caddy/nyx.Caddyfile.template > "${CADDY_TMP}"
caddy validate --config "${CADDY_TMP}" --adapter caddyfile
install -m 0644 -o root -g root "${CADDY_TMP}" "${CADDY_FILE}"
rm -f "${CADDY_TMP}"

systemctl daemon-reload
systemctl enable --now fail2ban caddy nyx
systemctl restart nyx
systemctl reload caddy

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

sleep 1
curl --fail --show-error http://127.0.0.1:8080/healthz >/dev/null
echo
echo "Nyx is running locally and Caddy is ready for ${DOMAIN}."
echo "Secrets: sudo nano ${ENV_FILE}"
echo "After editing secrets: sudo systemctl restart nyx"
echo "Next, set NYX_CUSTOM_HOST_IPS in ${ENV_FILE}, then follow DEPLOYMENT.md to change Cloudflare DNS."
