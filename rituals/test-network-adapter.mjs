import assert from 'node:assert/strict';
import http from 'node:http';
import {gzipSync} from 'node:zlib';
import express from 'express';
import {chromium} from 'playwright';
import Socket from 'ws';
import {pack, unpack, limits} from '../relics/network/frames.mjs';
import {Adapter} from '../relics/network/adapter.mjs';
import {createServer, destination, exchange, publicAddress} from '../scripture/network/server.mjs';

const body = new Uint8Array([0,255,128,1]);
assert.deepEqual(unpack(pack({id: 1, kind: 'request', text: '\u263a'}, body)).body, body);
for (const bytes of [new Uint8Array(), new Uint8Array(8), pack({id: 0, kind: 'request'}), pack({id: 1, kind: 'request'}).slice(1)]) assert.throws(() => unpack(bytes));
assert.throws(() => pack({id: 1, kind: 'request', data: 'a'.repeat(limits.metadata)}));
for (const address of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.1','100.64.1.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1','2002:7f00:1::']) assert.equal(publicAddress(address), false, address);
for (const address of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111']) assert.equal(publicAddress(address), true, address);
for (const value of ['file:///etc/passwd','http://127.0.0.1','http://user:pass@example.com','https://example.com:22']) await assert.rejects(destination(value));
await assert.rejects(destination('https://example.com', async () => [{address: '127.0.0.1', family: 4}]));
await assert.rejects(destination('https://example.com', async () => [{address: '1.1.1.1', family: 4},{address: '10.0.0.1', family: 4}]));
assert.equal((await destination('https://example.com', async () => [{address: '1.1.1.1', family: 4}])).address.address, '1.1.1.1');

const calls = [];
const established = {ready: true, request: async (...args) => {calls.push(args);return 'established';}, connect: () => 'live', close() {}};
let attempts = 0;
const primary = {request: async () => {attempts++;return 'primary';}, close() {}};
const combined = new Adapter(established, primary);
assert.equal(await combined.request('https://example.com', 'GET', null, []), 'primary');
assert.equal(await combined.request('https://example.com', 'POST', 'data', []), 'established');
assert.equal(await combined.request('https://example.com', 'GET', null, [['Range','bytes=0-99']]), 'established');
assert.equal(await combined.request('https://example.com/movie.mp4', 'GET', null, []), 'established');
assert.equal(combined.connect(), 'live');
primary.request = async () => {attempts++;throw new Error('Offline');};
assert.equal(await combined.request('https://example.com', 'GET', null, []), 'established');
assert.equal(await combined.request('https://example.com', 'GET', null, []), 'established');
assert.equal(attempts, 2);
const cancelled = AbortSignal.abort(new Error('Cancelled'));
await assert.rejects(combined.request('https://example.com', 'POST', 'data', [], cancelled), /Cancelled/);
assert.equal(calls.length, 5);

const app = express();
app.use('/assets/network', express.static('relics/network'));
app.get('/', (_req, res) => res.type('html').send('<button id="start">Connect</button>'));
app.use('/fixture', (req, res) => {
  if (req.url === '/slow') { req.once('close', () => {}); return; }
  if (req.url === '/redirect') {res.writeHead(302, {Location: '/fixture/result'}).end(); return;}
  if (req.url === '/compressed') {res.writeHead(200, {'Content-Encoding':'gzip','Content-Type':'text/plain'}).end(gzipSync('Decoded text')); return;}
  if (req.url === '/broken') {res.writeHead(200, {'Content-Encoding':'gzip'}).end('invalid'); return;}
  if (req.url === '/unknown') {res.writeHead(200, {'Content-Encoding':'unknown'}).end('invalid'); return;}
  const chunks=[];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {res.setHeader('Set-Cookie', ['a=1; Path=/','b=2; Path=/']);res.type('application/octet-stream').send(chunks.length ? Buffer.concat(chunks) : Buffer.from([0,255,128,1]));});
});
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let connections = 0, openedAt = 0, active = 0;
const relay = createServer({run: async (metadata, bytes, signal) => {
  active++;
  try {return await exchange(metadata, bytes, signal, {resolveDestination: async value => ({url: new URL(new URL(value).pathname, origin), address: {address:'127.0.0.1',family:4}})});}
  finally {active--;}
}});
server.on('upgrade', (req, socket, head) => {connections++;openedAt=Date.now();void relay.upgrade(req, socket, head);});
const browser = await chromium.launch({...process.platform==='win32'?{channel:'msedge'}:{},headless:true});
try {
  const page = await browser.newPage();
  await page.goto(origin);
  await page.evaluate(async () => {
    const {default: Transport} = await import('/assets/network/transport.mjs');
    window.client = new Transport();
    window.started = client.init().then(() => window.connected = true);
  });
  await page.waitForTimeout(250);
  assert.equal(connections, 0, 'Loading and init must not connect');
  const clickedAt = Date.now();
  await page.click('#start');
  await page.waitForFunction(() => window.connected, null, {timeout:10000});
  assert.equal(connections, 1);
  assert(openedAt - clickedAt >= 2000 && openedAt - clickedAt < 7000, `Activation delay ${openedAt-clickedAt}`);
  const result = await page.evaluate(async () => {
    const response = await client.request(new URL('https://fixture.example/fixture/result'), 'GET', null, []);
    return {...response, body: [...new Uint8Array(response.body)]};
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, [...body]);
  assert.equal(result.headers.filter(([key]) => key.toLowerCase() === 'set-cookie').length, 2);
  const post = await page.evaluate(async () => [...new Uint8Array((await client.request('https://fixture.example/fixture/result', 'POST', new Uint8Array([5,0,255]), [['Content-Type','application/octet-stream']])).body)]);
  assert.deepEqual(post, [5,0,255]);
  const redirect = await page.evaluate(async () => {const value=await client.request('https://fixture.example/fixture/redirect','GET',null,[]);return {status:value.status,headers:value.headers};});
  assert.equal(redirect.status, 302);
  assert(redirect.headers.some(([key,value])=>key.toLowerCase()==='location' && value==='/fixture/result'));
  assert.equal(await page.evaluate(async () => new TextDecoder().decode((await client.request('https://fixture.example/fixture/compressed','GET',null,[])).body)), 'Decoded text');
  for (const path of ['broken','unknown']) assert.match(await page.evaluate(async path => {try {await client.request('https://fixture.example/fixture/'+path,'GET',null,[]);return 'unexpected';}catch(error){return error.message;}}, path), /could not be loaded/);
  assert.equal(await page.evaluate(async () => {
    const controller=new AbortController();
    const pending=client.request('https://fixture.example/fixture/slow','GET',null,[],controller.signal);
    setTimeout(()=>controller.abort(new Error('User cancelled')),100);
    try {await pending;return 'unexpected';} catch(error){return error.message;}
  }), 'User cancelled');
  await page.waitForTimeout(100);
  assert.equal(active, 0);
  const rejected = await new Promise(resolve => {
    const socket = new Socket(origin.replace('http:', 'ws:')+'/api/sync', {origin:'https://unrelated.example'});
    socket.on('unexpected-response', (_request,response)=>{resolve(response.statusCode);response.resume();socket.terminate();});
    socket.on('error',()=>{});
  });
  assert.equal(rejected, 403);
  const invalid = await new Promise(resolve => {
    const socket=new Socket(origin.replace('http:', 'ws:')+'/api/sync',{origin});
    socket.on('open',()=>socket.send('not binary'));
    socket.on('close',code=>resolve(code));
  });
  assert.equal(invalid, 1002);
  await page.evaluate(()=>client.close());
  console.log('PASS framing, address restrictions, DNS pinning, trusted activation/delay, binary HTTP, uploads, cookies, redirects, decompression, cancellation, origin validation, fallback and write/live-session preservation.');
} finally {
  await browser.close();
  relay.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
