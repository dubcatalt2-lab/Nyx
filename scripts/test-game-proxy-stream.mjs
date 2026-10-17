import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { brotliCompressSync, createBrotliDecompress } from 'node:zlib';
import { createGameProxy } from '../lib/game-proxy-stream.mjs';
import { gameResourceEdit } from '../lib/game-resource-repairs.mjs';

const block = Buffer.alloc(64 * 1024, 7), counts = new Map();
let finishedLarge = 0, cancelled = 0, retry = 0, networkRetry = 0;
const upstream = http.createServer(async (req, res) => {
  counts.set(req.url, (counts.get(req.url) || 0) + 1);
  if (req.url === '/html') { res.end('<html>upstream failure</html>'); return; }
  if (req.url === '/retry' && retry++ < 2) { res.writeHead(503); res.end('busy'); return; }
  if (req.url === '/network-retry' && networkRetry++ < 2) { res.destroy(); return; }
  if (req.url === '/stall') { res.writeHead(200); res.flushHeaders(); return; }
  if (req.url === '/br') { res.end(brotliCompressSync(Buffer.from('decoded binary'))); return; }
  if (req.url === '/cutoff') { res.write(block); setTimeout(() => res.destroy(), 30); return; }
  if (['/large', '/cancel', '/edit'].includes(req.url)) {
    res.on('close', () => { if (!res.writableFinished) cancelled++; });
    for (let i = 0; i < 96 && !res.destroyed; i++) {
      res.write(block); await delay(3);
    }
    if (!res.destroyed) { finishedLarge++; res.end(); } return;
  }
  res.end('resource');
});
upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
const origin = `http://127.0.0.1:${upstream.address().port}`;
const proxy = createGameProxy({ idleTimeout: 5000, maxBuffered: 16 * 1024 ** 2 });
const tiny = createGameProxy({ maxBuffered: 1024, idleTimeout: 150 });
const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.end('ok'); return; }
  const suffix = req.url.split('?')[0];
  try {
    await (['/limit', '/stall'].includes(suffix) ? tiny : proxy).send(req, res, {
      candidates: (suffix === '/fallback' ? ['/html', '/ok'] : [suffix === '/limit' ? '/large' : suffix]).map(p => new URL(p, origin)),
      validate: (_url, {body}) => { if (body.toString().startsWith('<html')) throw new Error('HTML'); },
      transform: () => ['/edit', '/limit'].includes(suffix) ? async body => { await delay(15); return Buffer.from(body).fill(9); }
        : suffix === '/br' ? {stream: () => createBrotliDecompress()} : null
    });
  } catch (error) { if (!res.headersSent && !res.destroyed) { res.statusCode = error.status || 502; res.end('source error'); } }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const first = await fetch(`${base}/large`);
  assert.equal(finishedLarge, 0, 'first bytes arrive before the entire upstream file');
  const binary = new Uint8Array(await first.arrayBuffer());
  assert.equal(binary.length, 96 * block.length); assert.ok(binary.every(v => v === 7));
  assert.equal(await (await fetch(`${base}/fallback`)).text(), 'resource');
  assert.equal(await (await fetch(`${base}/retry`)).text(), 'resource'); assert.equal(retry, 3);
  assert.equal(await (await fetch(`${base}/network-retry`)).text(), 'resource'); assert.equal(networkRetry, 3);
  assert.equal(await (await fetch(`${base}/br`)).text(), 'decoded binary');
  assert.equal((await fetch(`${base}/stall`)).status, 504);
  assert.equal((await fetch(`${base}/limit`)).status, 502);
  const abort = new AbortController(); const response = await fetch(`${base}/cancel`, {signal: abort.signal});
  await response.body.getReader().read(); abort.abort(); await delay(100); assert.ok(cancelled >= 2);
  const broken = await fetch(`${base}/cutoff`); await assert.rejects(broken.arrayBuffer());
  assert.equal(counts.get('/cutoff'), 1, 'never append an error or retry after response bytes');
  let peakTransforms = 0, peakBuffer = 0;
  const sample = setInterval(() => { const stats = proxy.stats(); peakTransforms = Math.max(peakTransforms, stats.transforms); peakBuffer = Math.max(peakBuffer, stats.bufferedMiB); }, 5);
  const edits = await Promise.all(Array.from({length: 6}, () => fetch(`${base}/edit`).then(async r => { assert.equal(r.status, 200, await (r.ok ? Promise.resolve('') : r.text())); return r.arrayBuffer(); })));
  clearInterval(sample);
  assert.ok(edits.every(body => new Uint8Array(body).every(v => v === 9)));
  assert.equal(peakTransforms, 2); assert.ok(peakBuffer <= 16);
  const starts = Date.now(), healthTimes = [];
  const work = Promise.all(Array.from({length: 20}, () => fetch(`${base}/large`).then(async r => {
    let size = 0; for await (const chunk of r.body) size += chunk.length; assert.equal(size, 96 * block.length);
  })));
  for (let i = 0; i < 10; i++) { const t = performance.now(); assert.equal(await (await fetch(`${base}/health`)).text(), 'ok'); healthTimes.push(performance.now() - t); await delay(20); }
  await work; await delay(30);
  assert.deepEqual(proxy.stats(), {active: 0, queued: 0, transforms: 0, waiting: 0, bufferedMiB: 0});
  assert.equal(gameResourceEdit(new URL('https://cdn.jsdelivr.net/gh/other/game@main/game.wasm'), block), null);
  assert.equal(typeof gameResourceEdit(new URL('https://cdn.jsdelivr.net/gh/freebuisness/assets@main/116/Build/bike.data.unityweb'), Buffer.from('UnityWeb Compressed Content (brotli)')).stream, 'function');
  console.log(JSON.stringify({pass: true, concurrentDownloads: 20, transferMiB: 120, elapsedMs: Date.now() - starts, healthMaxMs: Math.round(Math.max(...healthTimes)), peakTransforms, peakBufferedMiB: peakBuffer}));
} finally { server.closeAllConnections(); upstream.closeAllConnections(); server.close(); upstream.close(); }
