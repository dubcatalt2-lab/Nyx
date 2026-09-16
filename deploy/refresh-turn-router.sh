#!/usr/bin/env bash
set -Eeuo pipefail
[[ -f /etc/nyx/turn-shared-443 ]] || exit 0
[[ $(cat /etc/nyx/turn-shared-443) == 1 ]] || exit 0
relay_domain=$(tr -d '[:space:]' < /etc/nyx/turn-domain)
[[ ${relay_domain} =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || exit 1
router_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
router_tmp=$(mktemp)
trap 'rm -f -- "$router_tmp"' EXIT
sed "s|__NYX_TURN_DOMAIN__|${relay_domain}|g" "$router_root/haproxy-turn.cfg.template" > "$router_tmp"
haproxy -c -f "$router_tmp"
install -o root -g root -m 0644 "$router_tmp" /etc/haproxy/haproxy.cfg
install -o root -g root -m 0755 "$router_root/renew-turn-certificate.sh" /etc/letsencrypt/renewal-hooks/deploy/nyx-turn-certificate
systemctl enable haproxy
systemctl reload-or-restart haproxy
