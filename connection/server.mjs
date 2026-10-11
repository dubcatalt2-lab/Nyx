import {lookup} from 'node:dns/promises';
import {BlockList, isIP} from 'node:net';
import {validateHeaderName, validateHeaderValue} from 'node:http';
import {Agent, fetch} from 'undici';
import {WebSocketServer} from 'ws';
import {pack, unpack, limits} from './frames.mjs';
import {channel} from './channel.mjs';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::',32],['2001:db8::',32],['2002::',16]]) blocked.addSubnet(address, prefix, 'ipv6');

export function publicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export async function destination(value, resolveAddresses = lookup) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new Error('Unsupported destination');
  url.hash = '';
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{address: hostname, family: isIP(hostname)}] : await resolveAddresses(hostname, {all: true, verbatim: true});
  if (!addresses.length || addresses.some(entry => !publicAddress(entry.address))) throw new Error('Destination is not public');
  return {url, address: addresses[0], addresses};
}

const excluded = new Set(['host','connection','upgrade','transfer-encoding','keep-alive','te','trailer','content-length','accept-encoding','proxy-authorization','proxy-authenticate']);
function requestHeaders(entries) {
  if (!Array.isArray(entries) || entries.length > 128) throw new Error('Invalid headers');
  const result = [];
  const nominated = new Set(entries.filter(pair => Array.isArray(pair) && String(pair[0]).toLowerCase() === 'connection').flatMap(pair => String(pair[1]).toLowerCase().split(',').map(value => value.trim())));
  for (const pair of entries) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string')) throw new Error('Invalid header');
    const [name, value] = pair;
    validateHeaderName(name);
    validateHeaderValue(name, value);
    if (!excluded.has(name.toLowerCase()) && !nominated.has(name.toLowerCase()) && !name.toLowerCase().startsWith('sec-')) result.push(pair);
  }
  result.push(['accept-encoding', 'identity']);
  return result;
}

function send(socket, bytes, fin) {
  return new Promise((resolve, reject) => {
    if (socket.readyState !== 1) { reject(new Error('Connection closed')); return; }
    socket.send(bytes, {binary: true, fin}, error => error ? reject(error) : resolve());
  });
}

export function createServer({allowed = async () => true, resolveDestination = destination, observe = () => {}} = {}) {
  const server = new WebSocketServer({noServer: true, maxPayload: limits.upload + limits.metadata + 9, perMessageDeflate: false});
  let active = 0;
  server.on('connection', (socket, request) => {
    if(new URL(request.url,'http://localhost').pathname==='/api/channel'){
      channel(socket,resolveDestination,requestHeaders);
      return;
    }
    const events=new URL(request.url,'http://localhost').pathname==='/api/events';
    const controller = new AbortController();
    let busy = false;
    const idle = setTimeout(() => socket.terminate(), 10000);
    socket.once('close', () => { clearTimeout(idle); controller.abort(); });
    socket.on('error', () => controller.abort());
    socket.on('message', async (bytes, binary) => {
      if (busy) { socket.close(1008, 'One request per connection'); return; }
      clearTimeout(idle);
      busy = true;
      let message, dispatcher, began = false;
      const timeout = setTimeout(() => { controller.abort(); socket.terminate(); }, 45000);
      active++;
      try {
        if (!binary || active > 64) throw new Error('Request limit');
        message = unpack(bytes);
        const {id, type, metadata, body} = message;
        if (type !== 0 || Object.keys(metadata).sort().join(',') !== 'headers,method,url' || body.length > limits.upload) throw new Error('Invalid request');
        const method = String(metadata.method).toUpperCase();
        if (!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(method) || (['GET','HEAD'].includes(method) && body.length)) throw new Error('Unsupported method');
        const headers = requestHeaders(metadata.headers);
        const {url, address, addresses = [address]} = await resolveDestination(metadata.url);
        controller.signal.throwIfAborted();
        dispatcher = new Agent({connect: {autoSelectFamily: true, lookup: (_host, options, callback) => options?.all ? callback(null, addresses) : callback(null, address.address, address.family)}});
        const response = await fetch(url, {dispatcher, method, headers, body: body.length ? body : undefined, redirect: 'manual', signal: controller.signal});
        const outgoing = [...response.headers].filter(([name]) => !excluded.has(name) && !['content-encoding','set-cookie'].includes(name));
        for (const value of response.headers.getSetCookie()) outgoing.push(['set-cookie', value]);
        const header = pack(id, 0, {status: response.status, headers: outgoing});
        began = true;
        await send(socket, header, events);
        if(events)clearTimeout(timeout);
        observe('headers', {id, status: response.status});
        let length = 0;
        if (response.body) for await (const chunk of response.body) {
          length += chunk.length;
          if (length > limits.body) throw new Error('Response exceeds size limit');
          await send(socket, events?pack(id,0,{status:response.status,headers:[]},chunk):chunk, events);
          observe('chunk', {id, length: chunk.length});
        }
        if(events)socket.close(1000);
        else await send(socket, new Uint8Array(), true);
        observe('complete', {id, length});
      } catch (error) {
        observe('failure', {aborted: controller.signal.aborted, message: error.message, code: error.cause?.code});
        if (!began && message?.id && socket.readyState === 1) await send(socket, pack(message.id, 1, {status: 502, headers: []}, new TextEncoder().encode('The destination could not be loaded')), true).catch(() => {});
        else socket.terminate();
      } finally {
        clearTimeout(timeout);
        active--;
        controller.abort();
        await dispatcher?.destroy().catch(() => {});
      }
    });
  });
  return {
    async upgrade(request, socket, head) {
      try {
        const origin = new URL(request.headers.origin || '');
        const route = new URL(request.url, origin);
        if (!['/api/sync','/api/presence','/api/channel','/api/events'].includes(route.pathname) || route.search || origin.host !== request.headers.host || !['http:','https:'].includes(origin.protocol) || server.clients.size >= 64 || !await allowed(request) || server.clients.size >= 64) throw new Error('Not permitted');
        if (!socket.destroyed) server.handleUpgrade(request, socket, head, client => server.emit('connection', client, request));
      } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); }
    },
    close() { for (const socket of server.clients) socket.terminate(); server.close(); }
  };
}

