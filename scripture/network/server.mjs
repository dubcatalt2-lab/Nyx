import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {BlockList, isIP} from 'node:net';
import {createGunzip, createInflate, createBrotliDecompress} from 'node:zlib';
import {WebSocketServer} from 'ws';
import {pack, unpack, limits} from '../../relics/network/frames.mjs';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001::', 32, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');

export function publicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export async function destination(value, resolveAddresses = lookup) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || (url.port && !['80','443'].includes(url.port))) throw new Error('Unsupported destination');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{address: hostname, family: isIP(hostname)}] : await resolveAddresses(hostname, {all: true, verbatim: true});
  if (!addresses.length || addresses.some(entry => !publicAddress(entry.address))) throw new Error('Destination is not public');
  return {url, address: addresses[0]};
}

const excludedHeaders = /^(?:host|connection|upgrade|proxy-.*|transfer-encoding|keep-alive|te|trailer|content-length)$/i;
let responseBytes = 0;
function requestHeaders(entries) {
  if (!Array.isArray(entries) || entries.length > 128) throw new Error('Invalid headers');
  const headers = Object.create(null);
  for (const pair of entries) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string')) throw new Error('Invalid header');
    const [key, value] = pair;
    http.validateHeaderName(key);
    http.validateHeaderValue(key, value);
    if (excludedHeaders.test(key)) continue;
    const name = key.toLowerCase();
    if (headers[name] === undefined) headers[name] = value;
    else headers[name] = [].concat(headers[name], value);
  }
  return headers;
}

export async function exchange(metadata, bytes, signal, {resolveDestination = destination} = {}) {
  const {url, address} = await resolveDestination(metadata.url);
  signal.throwIfAborted();
  const method = String(metadata.method || 'GET').toUpperCase();
  if (!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(method)) throw new Error('Unsupported method');
  if (bytes.length > limits.upload) throw new Error('Upload exceeds the size limit');
  const headers = requestHeaders(metadata.headers);
  headers['accept-encoding'] = 'identity';
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method, headers, signal,
      lookup: (_name, options, callback) => options?.all ? callback(null, [address]) : callback(null, address.address, address.family)
    }, response => {
      const chunks = [];
      let length = 0;
      let released = false;
      const release = () => { if (!released) { responseBytes -= length; released = true; } };
      let content = response;
      const encoding = String(response.headers['content-encoding'] || '').toLowerCase().trim();
      if (method !== 'HEAD' && encoding && encoding !== 'identity') {
        const decompress = {gzip: createGunzip, deflate: createInflate, br: createBrotliDecompress}[encoding];
        if (!decompress) { response.destroy(); reject(new Error('Unsupported content encoding')); return; }
        content = response.pipe(decompress());
      }
      const fail = error => { release(); response.destroy(); content.destroy(); reject(error); };
      response.once('error', fail);
      content.on('data', chunk => {
        if (released) return;
        length += chunk.length;
        responseBytes += chunk.length;
        if (length > limits.body || responseBytes > limits.body * 3) { fail(new Error('Response exceeds the size limit')); return; }
        chunks.push(chunk);
      });
      if (content !== response) content.once('error', fail);
      content.once('end', () => {
        if (released) return;
        release();
        const entries = [];
        for (let index = 0; index < response.rawHeaders.length; index += 2) {
          if (excludedHeaders.test(response.rawHeaders[index]) || (content !== response && /^content-encoding$/i.test(response.rawHeaders[index]))) continue;
          entries.push([response.rawHeaders[index], response.rawHeaders[index + 1]]);
        }
        resolve({status: response.statusCode, statusText: response.statusMessage, headers: entries, body: Buffer.concat(chunks, length)});
      });
    });
    request.once('error', reject);
    request.end(bytes);
  });
}

export function createServer({allowed = async () => true, run = exchange} = {}) {
  const server = new WebSocketServer({noServer: true, maxPayload: limits.upload + limits.metadata + 8, perMessageDeflate: false});
  const clients = new Set();
  let active = 0, incoming = 0;
  server.on('connection', socket => {
    clients.add(socket);
    const pending = new Map();
    let allocated = 0;
    const send = (metadata, bytes) => {
      const frame = pack(metadata, bytes);
      if (socket.readyState !== 1) return;
      if (socket.bufferedAmount + frame.length > limits.frame * 2) { socket.close(1009, 'Queue limit'); return; }
      socket.send(frame);
    };
    socket.on('message', (data, binary) => {
      let message;
      try { if (!binary) throw new Error(); message = unpack(data); }
      catch { socket.close(1002, 'Invalid message'); return; }
      const {metadata, body} = message;
      if (metadata.kind === 'cancel') { pending.get(metadata.id)?.abort(); return; }
      if (metadata.kind !== 'request' || pending.has(metadata.id)) { socket.close(1002, 'Invalid request'); return; }
      if (active >= 64 || pending.size >= 16 || body.length > limits.upload || allocated + body.length > limits.body || incoming + body.length > limits.body * 2) { send({id: metadata.id, kind: 'error', message: 'Request limit reached'}); return; }
      const controller = new AbortController();
      pending.set(metadata.id, controller);
      allocated += body.length;
      incoming += body.length;
      active++;
      const timer = setTimeout(() => { send({id: metadata.id, kind: 'error', message: 'Request timed out'}); controller.abort(new Error('Request timed out')); }, 40000);
      Promise.resolve().then(() => run(metadata, body, controller.signal)).then(result => {
        if (!controller.signal.aborted) send({id: metadata.id, kind: 'result', status: result.status, statusText: result.statusText, headers: result.headers}, result.body);
      }).catch(() => {
        if (!controller.signal.aborted) send({id: metadata.id, kind: 'error', message: 'The destination could not be loaded'});
      }).finally(() => { clearTimeout(timer); pending.delete(metadata.id); allocated -= body.length; incoming -= body.length; active--; });
    });
    socket.once('close', () => { clients.delete(socket); for (const controller of pending.values()) controller.abort(); pending.clear(); });
    socket.on('error', () => socket.terminate());
  });
  return {
    async upgrade(request, socket, head) {
      try {
        const origin = new URL(request.headers.origin || '');
        if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== request.headers.host || clients.size >= 64 || !await allowed(request) || clients.size >= 64) throw new Error();
        if (!socket.destroyed) server.handleUpgrade(request, socket, head, client => server.emit('connection', client));
      } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); }
    },
    close() { for (const client of clients) client.terminate(); server.close(); }
  };
}
