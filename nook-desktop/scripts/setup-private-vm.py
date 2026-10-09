import ast
import io
import json
import os
import pathlib
import secrets
import shutil
import time
import pycdlib
import yaml

root = pathlib.Path(os.environ['LOCALAPPDATA']) / 'NyxCloud'
source = pathlib.Path(__file__).resolve().parents[1] / 'resources' / 'vm-agent.py'
if (root / 'running.json').exists():
    raise SystemExit('Shut down NyxCloud normally before updating its agent.')
if (root / 'pending-shortcuts.iso').exists():
    raise SystemExit('An existing VM update is pending; apply it before this update.')
agent = source.read_text(encoding='utf-8')
ast.parse(agent)
config_path = root / 'nook-agent.json'
config = json.loads(config_path.read_text()) if config_path.exists() else dict(port=48764, token=secrets.token_hex(32))
service = '''[Unit]
Description=Nook private VM workspace
After=network.target
[Service]
Type=simple
User=nook-agent
Group=nook-agent
ExecStart=/usr/bin/python3 /usr/local/lib/nook-agent.py
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/nook-agent
InaccessiblePaths=/home/nyx /root
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
KillMode=control-group
TasksMax=128
MemoryMax=512M
LimitFSIZE=268435456
UMask=0077
[Install]
WantedBy=multi-user.target
'''
files = [dict(path='/usr/local/lib/nook-agent.py', permissions='0644', content=agent), dict(path='/etc/nook-agent/token', permissions='0640', content=config['token']), dict(path='/etc/systemd/system/nook-agent.service', permissions='0644', content=service)]
commands = [['sh', '-c', 'id nook-agent >/dev/null 2>&1 || useradd --create-home --shell /bin/bash nook-agent'], ['chown', 'root:nook-agent', '/etc/nook-agent/token'], ['chmod', '0750', '/home/nook-agent'], ['sh', '-c', 'command -v chromium >/dev/null || (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends chromium)'], ['systemctl', 'daemon-reload'], ['systemctl', 'enable', 'nook-agent.service'], ['systemctl', 'restart', 'nook-agent.service']]
data = '#cloud-config\n' + yaml.safe_dump(dict(users=[], ssh_deletekeys=False, preserve_hostname=True, write_files=files, runcmd=commands), sort_keys=False)
iso = pycdlib.PyCdlib()
iso.new(interchange_level=3, joliet=3, rock_ridge='1.09', vol_ident='CIDATA')
for name, content in [('user-data', data), ('meta-data', 'instance-id: nook-agent-'+secrets.token_hex(8)+'\nlocal-hostname: nyxcloud\n')]:
    encoded = content.encode()
    iso.add_fp(io.BytesIO(encoded), len(encoded), iso_path='/'+name.upper().replace('-', '_')+';1', rr_name=name, joliet_path='/'+name)
iso.write(str(root / 'pending-shortcuts.iso'))
iso.close()
launcher = root / 'run.mjs'
text = launcher.read_text(encoding='utf-8-sig')
old = "'-nic','user,model=virtio-net-pci'"
new = "'-nic','user,model=virtio-net-pci,hostfwd=tcp:127.0.0.1:48764-:8087'"
if new not in text:
    if old not in text:
        raise SystemExit('Unexpected VM networking; launcher not changed.')
    shutil.copyfile(launcher, root / ('run-before-nook-'+str(int(time.time()))+'.mjs'))
    launcher.write_text(text.replace(old, new), encoding='utf-8')
config_path.write_text(json.dumps(config), encoding='utf-8')
print('Prepared private VM agent and localhost forwarding. Existing VM disk and user files preserved.')
