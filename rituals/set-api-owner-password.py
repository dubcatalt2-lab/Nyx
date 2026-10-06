#!/usr/bin/env python3
"""Run on the VPS with sudo; prompts never echo or print credentials."""
import getpass
import hashlib
import os
import secrets
import tempfile
from pathlib import Path

target = Path('/etc/nyx/nyx.env')
password = getpass.getpass('New API owner password (16+ characters): ')
if len(password) < 16 or len(password) > 256:
    raise SystemExit('Use between 16 and 256 characters.')
if password != getpass.getpass('Confirm password: '):
    raise SystemExit('Passwords did not match. Nothing changed.')
salt = secrets.token_hex(16)
digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
info = target.stat()
lines = target.read_text().splitlines()
name = 'NYX_API_OWNER_PASSWORD_HASH'
lines = [line for line in lines if not line.lstrip().removeprefix('export ').startswith(name + '=')]
lines.append(f"{name}='{salt}:{digest}'")
fd, temporary = tempfile.mkstemp(prefix='.nyx-password-', dir=target.parent)
try:
    with os.fdopen(fd, 'w') as output:
        output.write('\n'.join(lines) + '\n')
        output.flush()
        os.fsync(output.fileno())
    os.chown(temporary, info.st_uid, info.st_gid)
    os.chmod(temporary, info.st_mode & 0o777)
    os.replace(temporary, target)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print('Password hash saved. Restart nyx to load it. The password was not printed.')
