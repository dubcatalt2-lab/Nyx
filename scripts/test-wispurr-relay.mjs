import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import { startWispurr } from '../lib/wispurr-relay.mjs';

const relay = await startWispurr({ port: 16960 });
const server = createServer();
server.on('upgrade', (req, socket, head) => relay.route(req, socket, head));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `ws://127.0.0.1:${server.address().port}`;
const clients = new Set();
function connection(url, protocol) {
  const ws = new WebSocket(url, protocol);
  clients.add(ws);
  const frames = [];
  ws.on('message', data => frames.push(data));
  ws.on('error', () => {});
  return { ws, frames };
}
async function until(check, label, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out: ${label}`);
}
function connectPacket(id, hostname, port, type = 1) {
  const packet = Buffer.alloc(8 + Buffer.byteLength(hostname));
  packet[0] = 1; packet.writeUInt32LE(id, 1); packet[5] = type;
  packet.writeUInt16LE(port, 6); packet.write(hostname, 8);
  return packet;
}
try {
  const workerUrl = `ws://127.0.0.1:${relay.workerPorts[0]}/wisp/`;
  const direct = new WebSocket(workerUrl);
  const rejected = new Promise(resolve => direct.on('unexpected-response', (_req, res) => {
    resolve(res.statusCode); res.resume(); direct.terminate();
  }));
  direct.on('error', () => {});
  assert.equal(await rejected, 426, 'Worker does not accept unauthenticated v1');
  for (const info of [Buffer.from([5,0,0,0,0,2,1]), Buffer.from([5,0,0,0,0,2,1,2,5,0,0,0,3,110,121,120,120])]) {
    const raw = new WebSocket(workerUrl, { headers: { 'Sec-WebSocket-Protocol': 'wisp-v2' } });
    clients.add(raw); raw.on('error', () => {});
    const frames = []; raw.on('message', frame => frames.push(frame));
    await until(() => frames.shift(), 'private worker INFO'); raw.send(info);
    const denied = await until(() => frames.shift(), 'private worker denial');
    assert.equal(denied[0], 4); assert([0xc0, 0xc2].includes(denied[5])); raw.terminate();
  }
  console.log('Direct worker access rejects missing and incorrect internal credentials.');
  // Public endpoints must work without a site login, credential or password.
  for (const path of ['/wisp/', '/resources/live/']) {
    for (const v2 of [false, true]) {
      const { ws, frames } = connection(base + path, v2 ? 'wisp-v2' : undefined);
      if (v2) {
        const info = await until(() => frames.shift(), 'v2 INFO');
        assert.deepEqual([...info], [5, 0, 0, 0, 0, 2, 1], 'No password extension reaches visitors');
        ws.send(info);
      }
      const initial = await until(() => frames.shift(), 'CONTINUE');
      assert.equal(initial[0], 3); assert.equal(initial.readUInt32LE(1), 0);
      assert.equal(initial.readUInt32LE(5), 128);
      let id = 0;
      for (const [host, port, type] of [
        ['127.0.0.1', 80, 1], ['::1', 443, 1], ['10.0.0.1', 80, 1],
        ['169.254.169.254', 80, 1], ['localhost', 443, 1],
        ['example.com', 22, 1], ['example.com', 443, 2]
      ]) {
        ws.send(connectPacket(++id, host, port, type));
        const denied = await until(() => frames.find(frame => frame[0] === 4 && frame.readUInt32LE(1) === id), `blocked ${host}:${port}`);
        assert([0x41, 0x48, 0x49].includes(denied[5]), `Explicit policy rejection: ${denied.toString('hex')}`);
      }
      ws.send(connectPacket(++id, 'example.com', 80));
      const request = Buffer.from('GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n');
      const data = Buffer.alloc(5 + request.length); data[0] = 2; data.writeUInt32LE(id, 1); request.copy(data, 5); ws.send(data);
      await until(() => frames.some(frame => frame[0] === 2 && frame.readUInt32LE(1) === id), 'public HTTP bytes', 20000);
      await until(() => frames.some(frame => frame[0] === 4 && frame.readUInt32LE(1) === id), 'public stream close', 20000);
      const response = Buffer.concat(frames.filter(frame => frame[0] === 2 && frame.readUInt32LE(1) === id).map(frame => frame.subarray(5))).toString();
      assert.match(response, /^HTTP\/1\.[01] 200/);
      assert.match(response, /Example Domain/);
      ws.terminate();
      console.log(`${path} Wisp v${v2 ? 2 : 1}: anonymous HTTP and restricted egress passed`);
    }
  }
  const { ws, frames } = connection(base + '/wisp/');
  await until(() => frames.length, 'shutdown client');
  const closed = once(ws, 'close');
  await relay.stop(); await closed;
  assert.equal(relay.isRunning, false);
  assert.equal(relay.workerPorts.length, 0);
  console.log('Worker shutdown closes active relay sessions.');
} finally {
  for (const ws of clients) ws.terminate();
  await relay.stop();
  await new Promise(resolve => server.close(resolve));
}
