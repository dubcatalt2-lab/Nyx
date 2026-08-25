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
ENV_FILE=/etc/nyx/nyx.env
STRATUS_ENV_FILE=/etc/nyx/stratus.env
STRATUS_TURN_ENV_FILE=/etc/nyx/stratus-turn.env

stratus_is_configured() {
  [[ -f ${STRATUS_ENV_FILE} ]] && grep -Eq "^[[:space:]]*STRATUS_API_KEY=['\"]?[A-Za-z0-9_./:+-]{32,256}['\"]?[[:space:]]*$" "${STRATUS_ENV_FILE}"
}

sync_stratus_turn_environment() {
  local turn_tmp
  turn_tmp=$(mktemp)
  if [[ -f ${ENV_FILE} ]]; then
    grep -E '^[[:space:]]*NYX_TURN_(URLS|SHARED_SECRET|TTL_SECONDS)=' "${ENV_FILE}" > "${turn_tmp}" || true
  fi
  install -m 0640 -o root -g nyx "${turn_tmp}" "${STRATUS_TURN_ENV_FILE}"
  rm -f "${turn_tmp}"
}

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
UPDATE_SCRIPT_HASH=$(sha256sum "${BASH_SOURCE[0]}" | cut -d ' ' -f 1)
runuser -u "${APP_OWNER}" -- git pull --ff-only
UPDATED_SCRIPT_HASH=$(sha256sum "${BASH_SOURCE[0]}" | cut -d ' ' -f 1)
if [[ ${UPDATE_SCRIPT_HASH} != "${UPDATED_SCRIPT_HASH}" && ${NYX_UPDATE_REEXEC:-0} != 1 ]]; then
  echo "Nyx updater changed; restarting with the new deployment steps."
  exec env NYX_UPDATE_REEXEC=1 bash "${BASH_SOURCE[0]}"
fi
if [[ ! -f ${STRATUS_ENV_FILE} ]]; then
  STRATUS_ENV_TMP=$(mktemp)
  sed "s|__NYX_DOMAIN__|${DOMAIN}|g" deploy/stratus.env.example > "${STRATUS_ENV_TMP}"
  install -m 0640 -o root -g nyx "${STRATUS_ENV_TMP}" "${STRATUS_ENV_FILE}"
  rm -f "${STRATUS_ENV_TMP}"
  echo "Created ${STRATUS_ENV_FILE}. Add a generated key there to enable self-hosted Cloud Gaming."
fi
bash "${SCRIPT_DIR}/install-ytdlp.sh"
runuser -u "${APP_OWNER}" -- npm ci
runuser -u "${APP_OWNER}" -- npm ci --prefix services/stratus --omit=dev --ignore-scripts
runuser -u "${APP_OWNER}" -- env -u WISP_URL NYX_BUILD_TARGET=vps NYX_PUBLIC_ORIGIN="https://${DOMAIN}" npm run build:netlify
runuser -u "${APP_OWNER}" -- npm run check:deploy
runuser -u "${APP_OWNER}" -- npm prune --omit=dev
chgrp -R nyx "${APP_DIR}"
chmod -R g+rX "${APP_DIR}"

install -d -m 0750 -o nyx -g nyx /var/lib/nyx/chat-attachments
install -d -m 0750 -o nyx -g nyx /var/lib/nyx/vision-models
install -d -m 0750 -o nyx -g nyx /var/lib/nyx-stratus
sync_stratus_turn_environment
runuser -u nyx -- env NYX_AI_VISION_CACHE_DIR=/var/lib/nyx/vision-models npm run prepare:vision
sed "s|__NYX_ROOT__|${APP_DIR}|g" deploy/systemd/nyx.service.template > /etc/systemd/system/nyx.service
sed "s|__NYX_ROOT__|${APP_DIR}|g" deploy/systemd/nyx-stratus.service.template > /etc/systemd/system/nyx-stratus.service
systemctl daemon-reload
if stratus_is_configured; then
  systemctl enable nyx-stratus
  systemctl restart nyx-stratus
else
  systemctl disable --now nyx-stratus >/dev/null 2>&1 || true
fi
systemctl restart nyx
if [[ -x deploy/setup-turn.sh || -f deploy/setup-turn.sh ]]; then
  bash deploy/setup-turn.sh
fi
CADDY_TMP=$(mktemp)
sed "s|__NYX_DOMAIN__|${DOMAIN}|g" deploy/caddy/nyx.Caddyfile.template > "${CADDY_TMP}"
caddy validate --config "${CADDY_TMP}" --adapter caddyfile
install -m 0644 -o root -g root "${CADDY_TMP}" /etc/caddy/Caddyfile
rm -f "${CADDY_TMP}"
systemctl reload caddy
sleep 1
curl --fail --show-error http://127.0.0.1:8080/healthz >/dev/null
if stratus_is_configured; then
  curl --fail --show-error http://127.0.0.1:3001/cloud/v1/healthz >/dev/null
fi
echo "Nyx updated successfully."
