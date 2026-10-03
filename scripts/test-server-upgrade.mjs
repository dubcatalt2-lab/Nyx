import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { connect } from 'node:net';
import { once } from 'node:events';

// Isolated real server, no production credentials or external requests.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp)$/i.test(key)));
const child = fork(new URL('../server.js', import.meta.url), [], {
  env: { ...env, PORT: '0', NYX_PUBLIC_ORIGIN: 'https://nyxlearning.org', NYX_YOUTUBE_NATIVE_ENABLED: '0' }, silent: true
});
const deadline = setTimeout(() => child.kill('SIGKILL'), 20000);
let stderr = '';
child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
child.stdout.resume();
try {
  const port = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited before ready (${code}): ${stderr}`)));
    child.on('message', message => { if (message.type === 'nyx:listening') resolve(message.port); });
  });
  async function upgrade(path, origin = `http://127.0.0.1:${port}`) {
    return new Promise((resolve, reject) => {
      const socket = connect(port, '127.0.0.1');
      let response = '';
      socket.setTimeout(3000, () => socket.destroy(new Error('Upgrade timed out')));
      socket.once('error', reject);
      socket.once('connect', () => socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`));
      socket.on('data', chunk => {
        response += chunk.toString();
        if (response.includes('\r\n\r\n')) socket.destroy();
      });
      socket.once('close', () => resolve(response.split('\r\n')[0]));
    });
  }
  assert.match(await upgrade('http://['), /400/, 'Malformed upgrade URL is rejected without crashing');
  assert.match(await upgrade('/missing'), /404/);
  assert.match(await upgrade('/wisp/', 'https://untrusted.invalid'), /403/);
  assert.match(await upgrade('/wisp/'), /101/, 'Embedded Wisp still upgrades');
  assert.match(await upgrade('/resources/live/', 'https://untrusted.invalid'), /403/);
  assert.match(await upgrade('/resources/live/'), /101/, 'Neutral relay path upgrades with the same protections');
  const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  console.log('Server: malformed WebSocket request rejected, unknown route and origin checks retained, Wisp handshake and subsequent health passed.');
} catch (error) {
  if (stderr) process.stderr.write(stderr);
  throw error;
} finally {
  clearTimeout(deadline);
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'exit');
    const forced = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.disconnect();
    await stopped;
    clearTimeout(forced);
  }
}
