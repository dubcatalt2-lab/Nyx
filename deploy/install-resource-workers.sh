#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo.'; exit 1; }
release=${1:?exact active release directory required}
active=$(systemctl show nyx -p WorkingDirectory --value)
[[ "$release" =~ ^/var/www/nyx-release-[0-9a-f]{8}$ && "$active" =~ ^/var/www/nyx-release-[0-9a-f]{8}$ ]] || exit 2
[[ "$release" == "$active" || "${2:-}" == --candidate ]] || exit 2
test -r "$release/dist/studies.html"
git -C "$release" diff --exit-code
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
install -d -m 0755 /usr/local/lib/nyx/resources/lib
install -m 0644 "$source_dir/server-resources.mjs" /usr/local/lib/nyx/resources/server-resources.mjs
install -m 0644 "$source_dir/lib/resource-routing.mjs" "$source_dir/lib/public-assets.mjs" /usr/local/lib/nyx/resources/lib/
install -m 0644 "$source_dir/deploy/systemd/nyx-resources@.service" /etc/systemd/system/nyx-resources@.service
python3 - "$release" "$active" <<'ENV'
from pathlib import Path
import sys,os,pwd,grp
root=Path(sys.argv[1]);assert root.resolve()==root and not root.is_symlink()
short=root.name.removeprefix('nyx-release-');active=Path(sys.argv[2]);source=Path('/etc/nyx/release-'+active.name.removeprefix('nyx-release-')+'.env');dest=Path('/etc/nyx/resources-'+short+'.env')
lines=[line for line in source.read_text().splitlines() if not line.startswith(('NYX_PROJECT_ROOT=','NYX_STATIC_ROOT='))]
lines+=['NYX_PROJECT_ROOT='+str(root),'NYX_STATIC_ROOT='+str(root/'dist')]
content=('\n'.join(lines)+'\n').encode()
if dest.exists():assert dest.read_bytes()==content
else:dest.write_bytes(content)
dest.chmod(0o600);os.chown(dest,pwd.getpwnam('nyx').pw_uid,grp.getgrnam('nyx').gr_gid)
link=Path('/etc/nyx/resources.env')
if link.exists() or link.is_symlink():
 assert link.is_symlink() and link.resolve().parent==Path('/etc/nyx') and link.resolve().name.startswith('resources-')
 stage=Path('/etc/nyx/resources.env.next');assert not stage.exists() and not stage.is_symlink();stage.symlink_to(dest);stage.replace(link)
else:link.symlink_to(dest)
print('Resource workers use an private environment copy with only release-root paths updated; application secrets were not printed')
ENV
node "$source_dir/deploy/resource-environment.mjs"
systemctl daemon-reload
systemctl enable nyx-resources@18180.service nyx-resources@18181.service
for port in 18180 18181; do
  systemctl restart "nyx-resources@$port.service"
  node --input-type=module - "$port" <<'WORKER'
const port=process.argv[2];let ready=false;for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/healthz',{signal:AbortSignal.timeout(1000)});if(r.ok&&(await r.json()).service==='nyx-resources'){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('Resource worker did not start.');
const {readFileSync}=await import('node:fs');const {execFileSync}=await import('node:child_process');const environment=unit=>{const pid=execFileSync('systemctl',['show',unit,'-p','MainPID','--value'],{encoding:'utf8'}).trim();return Object.fromEntries(readFileSync('/proc/'+pid+'/environ','utf8').split('\0').filter(row=>row.includes('=')).map(row=>{const at=row.indexOf('=');return [row.slice(0,at),row.slice(at+1)]}))};const primary=environment('nyx'),worker=environment('nyx-resources@'+port);for(const key of ['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','FIREBASE_WEB_API_KEY','NYX_STATIC_ORIGINS'])if(primary[key]&&worker[key]!==primary[key])throw Error('Resource account configuration does not match primary service');
if(['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY'].every(key=>primary[key])){const r=await fetch('http://127.0.0.1:'+port+'/assets/entry-cover/district-logo.png',{headers:{Cookie:'nyx_q74bd9='+'0'.repeat(32)+'.'+'0'.repeat(64)},signal:AbortSignal.timeout(15000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/png'))throw Error('Resource access check failed for an existing identity-shaped cookie');await r.arrayBuffer();}console.log('PASS resource account configuration and cookie-bearing asset access',port);
WORKER
done
node --input-type=module - <<'READY'
for(const port of [18180,18181]){let ready=false;for(let attempt=0;attempt<20;attempt++){try{const r=await fetch('http://127.0.0.1:'+port+'/healthz',{signal:AbortSignal.timeout(1000)});const d=await r.json();if(r.ok&&d.service==='nyx-resources'){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('Resource worker is not ready on '+port);console.log('READY resource worker',port)}
READY
