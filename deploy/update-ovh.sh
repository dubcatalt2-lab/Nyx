#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this updater with sudo: sudo bash deploy/update-ovh.sh"
  exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "${SCRIPT_DIR}/.." && pwd)
APP_OWNER=${SUDO_USER:-root}
DOMAIN_FILE=/etc/nyx/domain

if [[ ! -f ${DOMAIN_FILE} ]]; then
  echo "Missing ${DOMAIN_FILE}. Rerun: sudo bash deploy/setup-ovh.sh yourdomain.com"
  exit 1
fi
DOMAIN=$(tr -d '[:space:]' < "${DOMAIN_FILE}")
if [[ ! ${DOMAIN} =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]]; then
  echo "Invalid domain in ${DOMAIN_FILE}."
  exit 1
fi

cd "${APP_DIR}"
runuser -u "${APP_OWNER}" -- git pull --ff-only
runuser -u "${APP_OWNER}" -- npm ci
runuser -u "${APP_OWNER}" -- env NYX_BUILD_TARGET=vps NYX_PUBLIC_ORIGIN="https://${DOMAIN}" WISP_URL="wss://${DOMAIN}/wisp/" npm run build:netlify
runuser -u "${APP_OWNER}" -- npm run check:deploy
runuser -u "${APP_OWNER}" -- npm prune --omit=dev
chgrp -R nyx "${APP_DIR}"
chmod -R g+rX "${APP_DIR}"

systemctl restart nyx
sleep 1
curl --fail --show-error http://127.0.0.1:8080/healthz >/dev/null
echo "Nyx updated successfully."
