#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo after building this release.'; exit 1; }
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
[[ $release == /var/www/* && $release != /var/www/nyx ]] || { echo 'Use a separate release checkout under /var/www, not the old live checkout.'; exit 1; }
[[ -s $release/dist/index.html && -f $release/server.js && -d $release/node_modules ]] || { echo 'Run npm ci, npm run build:vps and npm run check:deploy first.'; exit 1; }
revision=$(git -C "$release" rev-parse --short=12 HEAD)
[[ $revision =~ ^[a-f0-9]{12}$ ]] || exit 1
node_bin=$(command -v node)
[[ $node_bin == /usr/* ]] || { echo 'Install a system Node.js release under /usr first; the service cannot use a home-directory runtime.'; exit 1; }
systemctl cat nyx.service >/dev/null
config=/etc/systemd/system/nyx.service.d/zz-restored-release.conf
environment=/etc/nyx/restored-$revision.env
[[ ! -e $config ]] || { echo 'A restored-release override already exists; inspect it before replacing it.'; exit 1; }
[[ ! -e $environment ]] || { echo 'A release environment file already exists; inspect it first.'; exit 1; }
mkdir -p /etc/systemd/system/nyx.service.d /etc/nyx
umask 077
printf 'NYX_PROJECT_ROOT=%s\nNYX_STATIC_ROOT=%s/dist\nPORT=8080\nWISP_URL=\n' "$release" "$release" > "$environment"
printf '[Service]\nWorkingDirectory=%s\nExecStart=\nExecStart=%s %s/server.js\nEnvironmentFile=%s\n' "$release" "$node_bin" "$release" "$environment" > "$config"
rollback(){
 echo 'Activation failed; restoring the previous service configuration.'
 rm -f -- "$config" "$environment"
 systemctl daemon-reload
 systemctl restart nyx.service
}
trap 'rollback' ERR
systemctl daemon-reload
systemctl restart nyx.service
healthy=0
for attempt in $(seq 1 45); do
 if curl -fsS --max-time 2 http://127.0.0.1:8080/healthz >/dev/null && curl -fsS --max-time 2 http://127.0.0.1:8080/runtime-config.js | grep -q english_RUNTIME_CONFIG; then healthy=1;break;fi
 sleep 1
done
[[ $healthy -eq 1 ]]
cd "$release"
"$node_bin" scripts/test-public-wisp.mjs ws://127.0.0.1:8080/wisp/
trap - ERR
printf 'Activated %s. Existing credentials and other services were preserved.\n' "$revision"
printf 'Verify the website and wss://nyxlearning.org/wisp/ before considering deployment complete.\n'
