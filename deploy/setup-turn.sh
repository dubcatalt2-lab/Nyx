#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/setup-turn.sh"
  exit 1
fi

ENV_FILE=/etc/nyx/nyx.env
DOMAIN_FILE=/etc/nyx/domain
if [[ ! -r ${ENV_FILE} || ! -r ${DOMAIN_FILE} ]]; then
  echo "Nyx environment or domain configuration is missing."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

if [[ -z ${NYX_TURN_SHARED_SECRET:-} || -z ${NYX_TURN_URLS:-} ]]; then
  echo "TURN is not configured; set NYX_TURN_URLS and NYX_TURN_SHARED_SECRET in ${ENV_FILE}."
  exit 0
fi

DOMAIN=$(tr -d '[:space:]' < "${DOMAIN_FILE}")
if [[ ! ${DOMAIN} =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]]; then
  echo "Invalid Nyx domain in ${DOMAIN_FILE}."
  exit 1
fi

if ! command -v turnserver >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y coturn
fi

TURN_TMP=$(mktemp)
cat > "${TURN_TMP}" <<EOF
listening-port=3478
listening-ip=0.0.0.0
fingerprint
use-auth-secret
static-auth-secret=${NYX_TURN_SHARED_SECRET}
realm=${DOMAIN}
stale-nonce=600
total-quota=100
user-quota=12
min-port=49160
max-port=49260
no-cli
no-loopback-peers
no-multicast-peers
EOF

TURN_TLS_PORT=${NYX_TURN_TLS_PORT:-}
TURN_TLS_CERT=${NYX_TURN_TLS_CERT:-}
TURN_TLS_KEY=${NYX_TURN_TLS_KEY:-}
if [[ -n ${TURN_TLS_PORT} || -n ${TURN_TLS_CERT} || -n ${TURN_TLS_KEY} ]]; then
  if [[ ! ${TURN_TLS_PORT} =~ ^[0-9]+$ ]] || (( TURN_TLS_PORT < 1 || TURN_TLS_PORT > 65535 )); then
    echo "NYX_TURN_TLS_PORT must be a valid TCP port."
    exit 1
  fi
  if [[ ! -r ${TURN_TLS_CERT} || ! -r ${TURN_TLS_KEY} ]]; then
    echo "NYX_TURN_TLS_CERT and NYX_TURN_TLS_KEY must be readable certificate files."
    exit 1
  fi
  printf 'tls-listening-port=%s\ncert=%s\npkey=%s\nno-tlsv1\nno-tlsv1_1\n' \
    "${TURN_TLS_PORT}" "${TURN_TLS_CERT}" "${TURN_TLS_KEY}" >> "${TURN_TMP}"
fi
TURN_GROUP=turnserver
getent group "${TURN_GROUP}" >/dev/null 2>&1 || TURN_GROUP=root
install -m 0640 -o root -g "${TURN_GROUP}" "${TURN_TMP}" /etc/turnserver.conf
rm -f "${TURN_TMP}"

DEFAULT_TMP=$(mktemp)
printf '%s\n' 'TURNSERVER_ENABLED=1' > "${DEFAULT_TMP}"
install -m 0644 -o root -g root "${DEFAULT_TMP}" /etc/default/coturn
rm -f "${DEFAULT_TMP}"

ufw allow 3478/udp
ufw allow 3478/tcp
if [[ -n ${TURN_TLS_PORT} ]]; then
  ufw allow "${TURN_TLS_PORT}/tcp"
fi
ufw allow 49160:49260/udp
systemctl unmask coturn.service >/dev/null 2>&1 || true
systemctl enable --now coturn
systemctl restart coturn
if [[ -n ${TURN_TLS_PORT} ]]; then
  echo "Nyx TURN relay is active with TURN-over-TLS on TCP ${TURN_TLS_PORT}."
else
  echo "Nyx TURN relay is active. Configure NYX_TURN_TLS_PORT/CERT/KEY for restrictive networks."
fi
