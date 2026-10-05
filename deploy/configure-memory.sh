#!/usr/bin/env bash
set -Eeuo pipefail


library=$(ldconfig -p | awk '/libjemalloc.so.2 / && !found {print $NF; found=1}')
if [[ -z ${library} ]]; then
  apt-get update
  apt-get install -y libjemalloc2
  library=$(ldconfig -p | awk '/libjemalloc.so.2 / && !found {print $NF; found=1}')
fi
[[ -f ${library} ]] || { echo 'jemalloc library is unavailable'; exit 1; }
install -d -m 0750 /etc/nyx
temp=$(mktemp)
printf 'LD_PRELOAD=%s\nMALLOC_CONF=background_thread:true,dirty_decay_ms:1000,muzzy_decay_ms:1000,narenas:2\n' "${library}" > "${temp}"
install -m 0644 "${temp}" /etc/nyx/memory.env
rm -f "${temp}"
