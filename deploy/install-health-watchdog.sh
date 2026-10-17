#!/usr/bin/env bash
set -Eeuo pipefail
if [[ ${EUID} -ne 0 ]]; then
  echo 'Run this installer with sudo.'
  exit 1
fi
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
install -d -m 0755 -o root -g root /usr/local/lib/nyx
install -m 0644 -o root -g root "${SCRIPT_DIR}/health-watchdog.mjs" /usr/local/lib/nyx/health-watchdog.mjs
install -m 0644 -o root -g root "${SCRIPT_DIR}/systemd/nyx-health-check.service" /etc/systemd/system/nyx-health-check.service
install -m 0644 -o root -g root "${SCRIPT_DIR}/systemd/nyx-health-check.timer" /etc/systemd/system/nyx-health-check.timer
systemctl daemon-reload
systemctl enable --now nyx-health-check.timer
systemctl start nyx-health-check.service
echo 'Nyx health monitoring is enabled.'
