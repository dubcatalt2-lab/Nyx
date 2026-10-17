#!/usr/bin/env bash
set -Eeuo pipefail
relay_domain=$(tr -d '[:space:]' < /etc/nyx/turn-domain)
[[ ${relay_domain} =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || exit 1
relay_lineage="/etc/letsencrypt/live/${relay_domain}"
[[ ${RENEWED_LINEAGE:-${relay_lineage}} == "$relay_lineage" ]] || exit 0
install -d -o root -g turnserver -m 0750 /etc/coturn/certs
for relay_file in fullchain.pem privkey.pem; do
    relay_staged=$(mktemp /etc/coturn/certs/.renew.XXXXXX)
    install -o root -g turnserver -m 0640 "$relay_lineage/$relay_file" "$relay_staged"
    mv -f -- "$relay_staged" "/etc/coturn/certs/$relay_file"
done
systemctl restart coturn
