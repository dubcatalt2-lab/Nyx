#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root'; exit 1; }
APP_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
DOMAIN=${1:?Document domain suffix required}
[[ $DOMAIN =~ ^[a-z0-9]+([.-][a-z0-9]+)+$ ]] || exit 1
test -f /etc/letsencrypt/live/nyx-documents/fullchain.pem
test -f "${APP_DIR}/connection/dist/isolated-worker.js"
id nyx-document >/dev/null 2>&1 || useradd --system --home /var/lib/nyx-document --shell /usr/sbin/nologin nyx-document
install -d -m 0700 -o nyx-document -g nyx-document /var/lib/nyx-document
install -d -m 0750 -o root -g caddy /etc/caddy/document-certificate
install -m 0640 -o root -g caddy /etc/letsencrypt/live/nyx-documents/fullchain.pem /etc/caddy/document-certificate/fullchain.pem
install -m 0640 -o root -g caddy /etc/letsencrypt/live/nyx-documents/privkey.pem /etc/caddy/document-certificate/privkey.pem
printf 'PORT=8082\nDOCUMENT_SUFFIX=%s\nDOCUMENT_STATE_DIR=/var/lib/nyx-document\n' "$DOMAIN" > /etc/nyx/document.env
chown root:nyx-document /etc/nyx/document.env
chmod 0640 /etc/nyx/document.env
sed "s|__NYX_ROOT__|${APP_DIR}|g" "${APP_DIR}/mission/systemd/nyx-document.service.template" > /etc/systemd/system/nyx-document.service
systemctl daemon-reload
systemctl enable nyx-document
systemctl restart nyx-document
curl --fail --silent --retry 10 --retry-delay 1 --retry-connrefused -H "Host: documents.${DOMAIN}" http://127.0.0.1:8082/healthz
CONFIG=$(mktemp)
BACKUP=$(mktemp)
HAD_CONFIG=0
if [[ -f /etc/caddy/sites-enabled/documents.caddy ]]; then cp /etc/caddy/sites-enabled/documents.caddy "$BACKUP"; HAD_CONFIG=1; fi
rollback() {
    if [[ $HAD_CONFIG == 1 ]]; then cp "$BACKUP" /etc/caddy/sites-enabled/documents.caddy; else rm -f /etc/caddy/sites-enabled/documents.caddy; fi
    rm -f "$CONFIG" "$BACKUP"
}
trap rollback ERR
BIND=''
if [[ -f /etc/nyx/turn-shared-443 ]] && [[ $(cat /etc/nyx/turn-shared-443) == 1 ]]; then BIND='bind 127.0.0.1'; fi
cat > "$CONFIG" <<EOF
*.${DOMAIN} {
    ${BIND}
    tls /etc/caddy/document-certificate/fullchain.pem /etc/caddy/document-certificate/privkey.pem
    @documents expression \`{host} == "documents.${DOMAIN}" || {host}.matches("^d-[a-f0-9]{56}[.]${DOMAIN//./[.]}\$")\`
    handle @documents {
        reverse_proxy 127.0.0.1:8082
    }
    @public_cloud path /cloud/v1/embed /cloud/v1/embed-data /cloud/v1/signal/* /cloud/v1/healthz /cloud/v1/source
    handle @public_cloud {
        reverse_proxy 127.0.0.1:3001 {
            header_up X-Caddy-Real-IP-Is-Here1357908642 {client_ip}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Forwarded-Host {host}
        }
    }
    @private_cloud path /cloud/v1/*
    handle @private_cloud {
        respond 404
    }
    handle {
        import nyx_proxy
    }
}
EOF
install -m 0644 "$CONFIG" /etc/caddy/sites-enabled/documents.caddy
rm -- "$CONFIG"
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
trap - ERR
rm -f "$BACKUP"
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/nyx-document-certificate.sh <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${RENEWED_LINEAGE:-} == /etc/letsencrypt/live/nyx-documents ]] || exit 0
install -m 0640 -o root -g caddy "$RENEWED_LINEAGE/fullchain.pem" /etc/caddy/document-certificate/fullchain.pem
install -m 0640 -o root -g caddy "$RENEWED_LINEAGE/privkey.pem" /etc/caddy/document-certificate/privkey.pem
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
EOF
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/nyx-document-certificate.sh
