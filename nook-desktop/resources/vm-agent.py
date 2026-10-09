import hashlib
import hmac
import json
import os
import pathlib
import signal
import subprocess
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path('/home/nook-agent/workspace')
BACKUP = pathlib.Path('/home/nook-agent/backups')
TOKEN = pathlib.Path('/etc/nook-agent/token').read_text().strip()
LOCK = threading.Lock()
ACTIVE = {}
CANCELLED = {}
ROOT.mkdir(exist_ok=True)
BACKUP.mkdir(exist_ok=True)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def target(value):
    if not isinstance(value, str) or len(value) > 1000:
        raise ValueError('Invalid relative path')
    p = pathlib.PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or '\\' in value or any(x.startswith('.env') or x in ['.ssh', '.gnupg'] for x in p.parts):
        raise ValueError('Path is outside the VM workspace')
    location = ROOT
    for part in p.parts:
        location = location / part
        if location.is_symlink() or (location.is_file() and location.stat().st_nlink > 1):
            raise ValueError('Linked files are not supported')
    if not location.resolve().is_relative_to(ROOT):
        raise ValueError('Path is outside the VM workspace')
    return location

def read(value):
    p = target(value)
    if p.stat().st_size > 256000:
        raise ValueError('File exceeds the text limit')
    data = p.read_bytes()
    return dict(path=value, content=data.decode('utf-8'), hash=digest(data))

def run(tool, args, request_id):
    if tool == 'list':
        p = target(args.get('path', ''))
        return dict(entries=[dict(path=str(x.relative_to(ROOT)), name=x.name, directory=x.is_dir()) for x in sorted(p.iterdir()) if not x.is_symlink()][:1000])
    if tool == 'read':
        return read(args['path'])
    if tool == 'mkdir':
        target(args['path']).mkdir(parents=True, exist_ok=True)
        return dict(created=True)
    if tool == 'write':
        p = target(args['path'])
        data = args['content'].encode('utf-8')
        if len(data) > 256000:
            raise ValueError('File exceeds the text limit')
        old = p.read_bytes() if p.exists() and p.stat().st_size <= 256000 else None
        if p.exists() and old is None:
            raise ValueError('Existing file exceeds the text limit')
        if (digest(old) if old is not None else None) != args.get('expectedHash'):
            raise ValueError('File changed; read it again')
        change = uuid.uuid4().hex
        record = dict(path=args['path'], old=old.hex() if old is not None else None, hash=digest(data))
        (BACKUP / change).write_text(json.dumps(record))
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return dict(id=change, hash=digest(p.read_bytes()), verified=p.read_bytes() == data)
    if tool == 'undo':
        change = args['id']
        if not isinstance(change, str) or len(change) != 32 or any(x not in '0123456789abcdef' for x in change):
            raise ValueError('Invalid change ID')
        record = json.loads((BACKUP / change).read_text())
        p = target(record['path'])
        if digest(p.read_bytes()) != record['hash']:
            raise ValueError('Newer work prevents undo')
        if record['old'] is None:
            p.unlink()
        else:
            p.write_bytes(bytes.fromhex(record['old']))
        return dict(restored=True)
    if tool == 'search':
        query = args.get('query', '')
        if not isinstance(query, str) or not query or len(query) > 1000:
            raise ValueError('Invalid query')
        matches = []
        visited = 0
        for folder, dirs, files in os.walk(ROOT, followlinks=False):
            dirs[:] = [x for x in dirs if not x.startswith('.') and x != 'node_modules' and not (pathlib.Path(folder) / x).is_symlink()]
            for name in files:
                visited += 1
                if visited > 5000 or len(matches) >= 100:
                    return dict(matches=matches, truncated=True)
                relative = str((pathlib.Path(folder) / name).relative_to(ROOT))
                try:
                    for number, line in enumerate(read(relative)['content'].splitlines(), 1):
                        if query in line:
                            matches.append(dict(path=relative, line=number, text=line[:300]))
                            if len(matches) >= 100:
                                break
                except (ValueError, OSError, UnicodeError):
                    pass
        return dict(matches=matches)
    if tool == 'command':
        command = args.get('command')
        if not isinstance(command, str) or not command.strip() or len(command) > 6000:
            raise ValueError('Invalid command')
        if args.get('shell', 'bash') not in ['bash', 'sh']:
            raise ValueError('The VM uses Linux bash, not PowerShell or CMD')
        cwd = target(args.get('cwd', ''))
        start = time.monotonic()
        stopped = ''
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            process = subprocess.Popen(['/bin/bash', '-c', command], cwd=cwd, stdout=out, stderr=err, start_new_session=True, env={'HOME': '/home/nook-agent', 'USER': 'nook-agent', 'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8'})
            ACTIVE[request_id] = process
            try:
                while process.poll() is None:
                    if request_id in CANCELLED:
                        stopped = 'cancelled'
                    elif time.monotonic() - start > 60:
                        stopped = 'timeout'
                    elif os.fstat(out.fileno()).st_size + os.fstat(err.fileno()).st_size > 64000:
                        stopped = 'output limit'
                    if stopped:
                        break
                    time.sleep(0.05)
            finally:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()
                ACTIVE.pop(request_id, None)
            out.seek(0)
            err.seek(0)
            return dict(exitCode=process.returncode, stdout=out.read(32000).decode('utf-8', errors='replace'), stderr=err.read(32000).decode('utf-8', errors='replace'), durationMs=round((time.monotonic()-start)*1000), stopped=stopped)
    raise ValueError('This tool is unavailable in the VM')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        if self.headers.get('Origin') or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer '+TOKEN):
            return self.reply(403, dict(error='Not authorized'))
        acquired = False
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 2 or size > 280000:
                raise ValueError('Invalid request size')
            data = json.loads(self.rfile.read(size))
            if self.path == '/status':
                return self.reply(200, dict(service='nook-private-vm', root=str(ROOT), platform='linux', user='nook-agent'))
            request_id = data.get('id', '')
            if not isinstance(request_id, str) or len(request_id) != 36:
                raise ValueError('Invalid request ID')
            for key, deadline in list(CANCELLED.items()):
                if deadline < time.monotonic():
                    CANCELLED.pop(key, None)
            if self.path == '/cancel':
                CANCELLED[request_id] = time.monotonic()+120
                process = ACTIVE.get(request_id)
                if process:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                return self.reply(200, dict(cancelled=True))
            if self.path != '/run':
                return self.reply(404, dict(error='Not found'))
            acquired = LOCK.acquire(blocking=False)
            if not acquired:
                return self.reply(409, dict(error='A VM operation is already running'))
            if request_id in CANCELLED:
                raise ValueError('Cancelled')
            return self.reply(200, run(data.get('tool'), data.get('args', {}), request_id))
        except Exception as error:
            self.reply(400, dict(error=str(error)[:300]))
        finally:
            if acquired:
                LOCK.release()

server = ThreadingHTTPServer(('0.0.0.0', 8087), Handler)
server.daemon_threads = True
server.serve_forever()
