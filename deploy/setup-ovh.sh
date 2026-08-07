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
NGINX_SITE=/etc/nginx/sites-available/nyx

echo "Installing Nyx for ${DOMAIN} from ${APP_DIR}"
apt-get update
apt-get install -y ca-certificates curl git nginx ufw fail2ban

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
runuser -u "${APP_OWNER}" -- env NYX_BUILD_TARGET=vps NYX_PUBLIC_ORIGIN="https://${DOMAIN}" WISP_URL="wss://${DOMAIN}/wisp/" npm run build:netlify
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

if [[ ! -f ${NGINX_SITE} ]]; then
  sed "s|__NYX_DOMAIN__|${DOMAIN}|g" deploy/nginx/nyx.conf.template > "${NGINX_SITE}"
else
  echo "Preserving existing ${NGINX_SITE} so certificate settings are not overwritten."
fi
ln -sfn "${NGINX_SITE}" /etc/nginx/sites-enabled/nyx
rm -f /etc/nginx/sites-enabled/default

CF_REAL_IP_TMP=$(mktemp)
{
  echo "# Generated from Cloudflare's published origin networks by deploy/setup-ovh.sh."
  while IFS= read -r range; do [[ -n ${range} ]] && printf 'set_real_ip_from %s;\n' "${range}"; done < <(curl -fsSL https://www.cloudflare.com/ips-v4)
  while IFS= read -r range; do [[ -n ${range} ]] && printf 'set_real_ip_from %s;\n' "${range}"; done < <(curl -fsSL https://www.cloudflare.com/ips-v6)
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} > "${CF_REAL_IP_TMP}"
install -m 0644 -o root -g root "${CF_REAL_IP_TMP}" /etc/nginx/conf.d/cloudflare-real-ip.conf
rm -f "${CF_REAL_IP_TMP}"

nginx -t
systemctl daemon-reload
systemctl enable --now fail2ban nginx nyx
systemctl restart nyx
systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

sleep 1
curl --fail --show-error http://127.0.0.1:8080/healthz >/dev/null
echo
echo "Nyx is running locally and Nginx is ready for ${DOMAIN}."
echo "Secrets: sudo nano ${ENV_FILE}"
echo "After editing secrets: sudo systemctl restart nyx"
echo "Next, follow DEPLOYMENT.md to install HTTPS and change Cloudflare DNS."
