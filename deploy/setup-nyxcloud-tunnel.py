#!/usr/bin/env python3
"""Root-only: read the local VM public key/password JSON from stdin, never log it."""
import json, os, pathlib, pwd, re, subprocess, sys
if os.geteuid() != 0:
    raise SystemExit('Run as root.')
config = json.load(sys.stdin)
public = config['publicKey'].strip()
password = config['password']
if not re.fullmatch(r'ssh-ed25519 [A-Za-z0-9+/=]+(?: [^\r\n]*)?', public):
    raise SystemExit('Invalid public key.')
if not re.fullmatch(r'[a-f0-9]{32}', password):
    raise SystemExit('Invalid VM password.')
name = 'nyxcloud-tunnel'
try:
    account = pwd.getpwnam(name)
except KeyError:
    subprocess.run(['useradd', '--system', '--create-home', '--home-dir', '/var/lib/nyxcloud-tunnel', '--shell', '/usr/sbin/nologin', name], check=True)
    account = pwd.getpwnam(name)
ssh = pathlib.Path(account.pw_dir) / '.ssh'
ssh.mkdir(mode=0o700, exist_ok=True)
os.chown(ssh, account.pw_uid, account.pw_gid)
key = ssh / 'authorized_keys'
key.write_text('restrict,port-forwarding,permitlisten="127.0.0.1:15990",permitopen="127.0.0.1:1",command="/bin/false" ' + public + '\n')
os.chmod(key, 0o600)
os.chown(key, account.pw_uid, account.pw_gid)
env = pathlib.Path('/etc/nyx/nyx.env')
text = env.read_text()
for field, value in {'NYXCLOUD_VNC_PORT': '15990', 'NYXCLOUD_VNC_PASSWORD': password}.items():
    text = re.sub(r'^' + field + r'=.*\n?', '', text, flags=re.M)
    text = text.rstrip('\n') + '\n' + field + '=' + value + '\n'
env.write_text(text)
print('Private NyxCloud tunnel identity and server configuration installed.')
