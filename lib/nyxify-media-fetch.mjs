import https from 'node:https';
import tls from 'node:tls';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';

// Race through TLS completion: TCP-only address selection can choose a CDN
// address whose TCP connection succeeds but whose TLS handshake never finishes.
export function createMediaConnector({ lookupImpl = lookup, connectImpl = tls.connect,
  attemptMs = 1800, staggerMs = 250, deadlineMs = 8000 } = {}) {
  const preferred = new Map();
  return (options, callback) => {
    const host = options.hostname || options.host;
    const sockets = new Set();
    let finished = false, next = 0, addresses = [], stagger;
    const timeoutError = () => Object.assign(new Error('Music media connection timed out.'), { code: 'ETIMEDOUT' });
    const finish = (error, winner) => {
      if (finished) return;
      finished = true; clearTimeout(deadline); clearTimeout(stagger);
      for (const socket of sockets) if (socket !== winner) socket.destroy();
      callback(error, winner);
    };
    const deadline = setTimeout(() => finish(timeoutError()), deadlineMs);
    deadline.unref?.();
    function start() {
      if (finished || next >= addresses.length || sockets.size >= 3) return;
      const address = addresses[next++];
      let socket;
      try {
        socket = connectImpl({ host: address.address, family: address.family,
          port: Number(options.port) || 443, servername: host, rejectUnauthorized: true,
          ALPNProtocols: ['http/1.1'] });
      } catch (error) { finish(error); return; }
      sockets.add(socket);
      socket.setTimeout(attemptMs);
      const failed = () => {
        if (!sockets.delete(socket)) return;
        socket.destroy();
        if (finished) return;
        if (next >= addresses.length && sockets.size === 0) finish(timeoutError());
        else start();
      };
      socket.once('error', failed);
      socket.once('timeout', failed);
      socket.once('secureConnect', () => {
        if (finished) return socket.destroy();
        socket.setTimeout(0);
        socket.removeListener('timeout', failed);
        socket.removeListener('error', failed);
        preferred.delete(host); preferred.set(host, { address: address.address, expires: Date.now() + 120_000 });
        while (preferred.size > 32) preferred.delete(preferred.keys().next().value);
        finish(null, socket);
      });
      clearTimeout(stagger);
      stagger = setTimeout(start, staggerMs);
      stagger.unref?.();
    }
    lookupImpl(host, { all: true }).then(result => {
      if (finished) return;
      addresses = [...new Map(result.map(a => [a.address, a])).values()].slice(0, 16);
      const best = preferred.get(host);
      if (best?.expires > Date.now()) addresses.sort((a, b) => Number(b.address === best.address) - Number(a.address === best.address));
      if (!addresses.length) return finish(timeoutError());
      start();
    }).catch(error => finish(error));
  };
}

export function createMediaFetch() {
  const agent = new https.Agent({ keepAlive: true, maxSockets: 40, maxTotalSockets: 40, maxFreeSockets: 2, timeout: 30_000 });
  agent.createConnection = createMediaConnector();
  return (url, options = {}) => new Promise((resolve, reject) => {
    const request = https.request(url, { agent, method: 'GET', headers: options.headers, signal: options.signal }, response => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      try {
        const bodyless = [204, 205, 304].includes(response.statusCode);
        if (bodyless) response.resume();
        resolve(new Response(bodyless ? null : Readable.toWeb(response), { status: response.statusCode, headers }));
      } catch (error) { response.destroy(); reject(error); }
    });
    request.once('error', reject);
    request.end();
  });
}
