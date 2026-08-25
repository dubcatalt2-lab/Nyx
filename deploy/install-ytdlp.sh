#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo: sudo bash deploy/install-ytdlp.sh"
  exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REQUIREMENTS_FILE="${SCRIPT_DIR}/requirements-yt-dlp.txt"
INSTALL_ROOT=/var/lib/nyx/yt-dlp
VENV_DIR="${INSTALL_ROOT}/venv"
YTDLP_BIN="${VENV_DIR}/bin/yt-dlp"

if [[ ! -f ${REQUIREMENTS_FILE} ]]; then
  echo "Missing ${REQUIREMENTS_FILE}."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3
fi

if ! python3 -c 'import ensurepip' >/dev/null 2>&1; then
  PYTHON_SERIES=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv "python${PYTHON_SERIES}-venv"
fi

install -d -m 0750 -o root -g nyx "${INSTALL_ROOT}"
if [[ ! -x ${VENV_DIR}/bin/python ]]; then
  python3 -m venv --clear "${VENV_DIR}"
fi

REQUIRED_VERSION=$(sed -nE 's/^yt-dlp\[default\]==([0-9.]+)$/\1/p' "${REQUIREMENTS_FILE}")
if [[ -z ${REQUIRED_VERSION} ]]; then
  echo "The pinned yt-dlp version is invalid."
  exit 1
fi

CURRENT_VERSION=$(${YTDLP_BIN} --version 2>/dev/null || true)
if [[ ${CURRENT_VERSION} != "${REQUIRED_VERSION}" ]]; then
  "${VENV_DIR}/bin/python" -m pip install --disable-pip-version-check --no-cache-dir --requirement "${REQUIREMENTS_FILE}"
fi

INSTALLED_VERSION=$(${YTDLP_BIN} --version)
if [[ ${INSTALLED_VERSION} != "${REQUIRED_VERSION}" ]]; then
  echo "yt-dlp version check failed: expected ${REQUIRED_VERSION}, found ${INSTALLED_VERSION}."
  exit 1
fi

chgrp -R nyx "${INSTALL_ROOT}"
chmod -R g+rX "${INSTALL_ROOT}"
echo "yt-dlp ${INSTALLED_VERSION} is installed server-side; Nyx does not invoke it with media URLs."
