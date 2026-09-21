import { randomBytes } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';

const maxFrame = 2 * 1024 * 1024;
const maxQueue = 20 * 1024 * 1024;
const serverInfo = Buffer.from([5, 0, 0, 0, 0, 2, 1]);

// Wispurr 4.2 has no bind-address setting. Require a fresh private password on
// every worker connection, including when its port is reachable off-host.
// Terminate that handshake here so existing v1/v2 browser clients need no secret.
export async function startWispurr({ port = 6001, onFailure = () => {} } = {}) {
  const { wispurr } = await import('wispurr');
  const password = randomBytes(32).toString('hex');
  const username = 'nyx';
  const auth = Buffer.concat([Buffer.from([username.length]), Buffer.from(username + password)]);
  const authInfo = Buffer.alloc(12 + auth.length);
  serverInfo.copy(authInfo);
  authInfo[7] = 2;
  authInfo.writeUInt32LE(auth.length, 8);
  auth.copy(authInfo, 12);
  const worker = new wispurr({
    port,
    allowTCP: true,
    allowUDP: false,
    allowDirectIP: true,
    allowPrivateIPs: false,
    allowLoopbackIPs: false,
    whitelist: { ports: [80, 443] },
    dnsMethod: 'lookup',
    dnsResultOrder: 'ipv4first',
    enableV2: true,
    enableTwisp: false,
    passwordAuth: true,
    passwordAuthRequired: true,
    passwordUsers: { [username]: password },
    parseRealIP: false,
    reputation: { enabled: false },
    floodProtection: { maxConcurrentStreamsPerConnection: 64, logBlockedDials: false },
    tcpBufferSize: 64 * 1024,
    socketBufferSize: 4 * 1024 * 1024,
    pendingQueueSize: 8 * 1024 * 1024,
    bufferRemainingLength: 128,
    maxMessageSize: maxFrame,
    staticDir: '',
    motd: '',
    logLevel: 'none'
  });
  await worker.start(1);
  const terminateWorker = () => { if (worker.isRunning) worker.kill(); };
  process.once('exit', terminateWorker);
  let stopping = false;
  const sessions = new Set();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: maxFrame, perMessageDeflate: false });
  for (const { process: child } of worker.processes) {
    child.once('exit', () => {
      if (!stopping) {
        for (const dispose of sessions) dispose();
        onFailure(new Error('Wispurr worker exited unexpectedly.'));
      }
    });
  }

  function connect(client, v2) {
    let upstream;
    let disposed = false;
    let clientReady = !v2;
    let authenticated = false;
    let sentAuth = false;
    let continueFrame;
    let ready = false;
    const timer = setTimeout(dispose, 10_000);
    function dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      sessions.delete(dispose);
      client.terminate();
      upstream?.terminate();
    }
    function finishHandshake() {
      if (!clientReady || !authenticated || ready || disposed) return;
      ready = true;
      clearTimeout(timer);
      client.send(continueFrame, { binary: true }, error => { if (error) dispose(); });
    }
    function forward(source, target, data) {
      if (disposed || target.readyState !== WebSocket.OPEN || target.bufferedAmount + data.length > maxQueue) return dispose();
      source.pause();
      target.send(data, { binary: true }, error => {
        if (error) dispose();
        else if (!disposed) source.resume();
      });
    }
    sessions.add(dispose);
    client.on('error', dispose);
    client.on('close', dispose);
    client.on('message', (data, binary) => {
      if (!binary || data.length < 5) return dispose();
      if (!clientReady) {
        if (data[0] !== 5 || data.readUInt32LE(1) !== 0 || data.length < 7 || data[5] !== 2) return dispose();
        // No extensions are offered to the client. Validate but do not forward
        // its extension payload (especially credentials) to the private worker.
        for (let offset = 7; offset < data.length;) {
          if (offset + 5 > data.length) return dispose();
          offset += 5 + data.readUInt32LE(offset + 1);
          if (offset > data.length) return dispose();
        }
        clientReady = true;
        finishHandshake();
        return;
      }
      if (!ready || data[0] === 5) return dispose();
      forward(client, upstream, data);
    });
    if (v2) client.send(serverInfo, { binary: true });
    // This upstream currently detects v2 from the header but does not echo a
    // WebSocket subprotocol. Supply the header without requiring that echo.
    upstream = new WebSocket(`ws://127.0.0.1:${worker.ports[0]}/wisp/`, {
      headers: { 'Sec-WebSocket-Protocol': 'wisp-v2' },
      handshakeTimeout: 8000, maxPayload: maxFrame, perMessageDeflate: false
    });
    upstream.on('error', dispose);
    upstream.on('close', dispose);
    upstream.on('message', (data, binary) => {
      if (!binary || data.length < 5) return dispose();
      if (!sentAuth) {
        if (data[0] !== 5 || data.readUInt32LE(1) !== 0 || data.length < 7 || data[5] !== 2) return dispose();
        sentAuth = true;
        upstream.send(authInfo, { binary: true });
        return;
      }
      if (!authenticated) {
        if (data.length !== 9 || data[0] !== 3 || data.readUInt32LE(1) !== 0) return dispose();
        authenticated = true;
        continueFrame = data;
        finishHandshake();
        return;
      }
      if (!ready) return dispose();
      forward(upstream, client, data);
    });
  }

  return {
    get workerPorts() { return worker.ports; },
    get isRunning() { return !stopping && worker.isRunning; },
    route(req, socket, head) {
      if (stopping || !worker.isRunning) {
        socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        return;
      }
      sockets.handleUpgrade(req, socket, head, client => connect(client, Boolean(req.headers['sec-websocket-protocol'])));
    },
    async stop() {
      if (stopping) return;
      stopping = true;
      for (const dispose of sessions) dispose();
      sockets.close();
      await worker.stop(3000);
      process.removeListener('exit', terminateWorker);
      authInfo.fill(0);
    }
  };
}
