import base64
import hashlib
import json
import os
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
base = pathlib.Path('/home/nook-agent/workspace')
if root.parent != base / 'projects' or not re.fullmatch(r'[a-f0-9-]{36}', root.name) or root.is_symlink() or not root.resolve().is_relative_to(base):
    raise ValueError('Invalid test workspace')
request = pathlib.Path(sys.argv[3])
if request.parent != base or not re.fullmatch(r'\.nook-transfer-[a-f0-9-]{36}\.json', request.name) or request.is_symlink():
    raise ValueError('Invalid transfer request')
args = json.loads(request.read_text())
request.unlink()
excluded = re.compile(r'^(?:\.git|\.env(?:\..*)?|\.ssh|\.aws|\.azure|\.npmrc|\.netrc|credentials.*|node_modules|dist|build|release|target|\.next|\.cache|\.venv|venv|\.worktrees|\.codex-artifacts)$', re.I)

def blocked(name):
    return excluded.fullmatch(name) or re.search(r'\.(pem|key|pfx|p12)$', name, re.I)

def target(value):
    if not isinstance(value, str) or len(value) > 500 or '\\' in value or ':' in value or any(ord(c) < 32 for c in value):
        raise ValueError('Invalid file path')
    p = pathlib.PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or any(blocked(x) for x in p.parts):
        raise ValueError('Unavailable file path')
    current = root
    for part in p.parts:
        current = current / part
        if current.is_symlink() or (current.is_file() and current.stat().st_nlink != 1):
            raise ValueError('Linked files are unavailable')
    if not current.resolve().is_relative_to(root.resolve()):
        raise ValueError('Path leaves project')
    return current

tool = sys.argv[2]
if tool == 'project.upload':
    p = target(args['path'])
    data = base64.b64decode(args['data'], validate=True)
    offset = args['offset']
    if not isinstance(offset, int) or offset < 0 or offset + len(data) > 4000000:
        raise ValueError('Transfer size exceeds limit')
    p.parent.mkdir(parents=True, exist_ok=True)
    if offset and (not p.exists() or p.stat().st_size != offset):
        raise ValueError('Upload offset mismatch')
    with p.open('xb' if offset == 0 else 'ab') as stream:
        stream.write(data)
    result = dict(written=len(data))
elif tool == 'project.download':
    p = target(args['path'])
    offset = args['offset']
    if not isinstance(offset, int) or offset < 0 or p.stat().st_size > 4000000:
        raise ValueError('Invalid download')
    with p.open('rb') as stream:
        stream.seek(offset)
        data = stream.read(12000)
    result = dict(data=base64.b64encode(data).decode(), more=offset+len(data) < p.stat().st_size)
elif tool == 'project.manifest':
    files = []
    total = 0
    visited = 0
    for folder, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(x for x in dirs if not blocked(x) and not (pathlib.Path(folder) / x).is_symlink())
        for name in sorted(names):
            visited += 1
            if visited > 10000:
                raise ValueError('Review exceeds 10,000 entries')
            if blocked(name):
                continue
            relative = str((pathlib.Path(folder) / name).relative_to(root))
            p = target(relative)
            if not p.is_file():
                continue
            size = p.stat().st_size
            total += size
            if size > 4000000 or total > 50000000:
                raise ValueError('Review exceeds 4 MB per file or 50 MB total')
            files.append(dict(path=relative, size=size, hash=hashlib.sha256(p.read_bytes()).hexdigest()))
    offset = args.get('offset', 0)
    if not isinstance(offset, int) or offset < 0:
        raise ValueError('Invalid review offset')
    result = dict(files=files[offset:offset+40], more=offset+40 < len(files))
else:
    raise ValueError('Unknown transfer operation')
print(json.dumps(result))
