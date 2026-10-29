#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo.'; exit 1; }
release=${1:?exact active release directory required}
active=$(systemctl show nyx -p WorkingDirectory --value)
[[ "$release" == "$active" && "$release" =~ ^/var/www/nyx-release-[0-9a-f]{8}$ ]] || exit 2
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
install -d -m 0755 /usr/local/lib/nyx/resources/lib
install -m 0644 "$source_dir/server-resources.mjs" /usr/local/lib/nyx/resources/server-resources.mjs
install -m 0644 "$source_dir/lib/resource-routing.mjs" "$source_dir/lib/public-assets.mjs" /usr/local/lib/nyx/resources/lib/
install -m 0644 "$source_dir/deploy/systemd/nyx-resources@.service" /etc/systemd/system/nyx-resources@.service
python3 - "$release" <<'ENV'
from pathlib import Path
import sys,os,pwd,grp
root=Path(sys.argv[1]);assert root.resolve()==root and not root.is_symlink()
short=root.name.removeprefix('nyx-release-');source=Path('/etc/nyx/release-'+short+'.env');dest=Path('/etc/nyx/resources-'+short+'.env')
content=source.read_bytes()
if dest.exists():assert dest.read_bytes()==content
else:dest.write_bytes(content)
dest.chmod(0o600);os.chown(dest,pwd.getpwnam('nyx').pw_uid,grp.getgrnam('nyx').gr_gid)
link=Path('/etc/nyx/resources.env')
if link.exists() or link.is_symlink():
 assert link.is_symlink() and link.resolve()==dest
else:link.symlink_to(dest)
print('Resource workers use an unchanged private environment copy; application secrets were not printed')
ENV
systemctl daemon-reload
systemctl enable --now nyx-resources@18180.service nyx-resources@18181.service
node --input-type=module - <<'READY'
for(const port of [18180,18181]){let ready=false;for(let attempt=0;attempt<20;attempt++){try{const r=await fetch('http://127.0.0.1:'+port+'/healthz',{signal:AbortSignal.timeout(1000)});const d=await r.json();if(r.ok&&d.service==='nyx-resources'){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('Resource worker is not ready on '+port);console.log('READY resource worker',port)}
READY
