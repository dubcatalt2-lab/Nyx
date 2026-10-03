import assert from 'node:assert/strict';
import express from 'express';
import { createMetingBackend, allowedMetingAudioUrl, matchMetingRecording } from '../lib/nyxify-meting.mjs';

const hints = { title: 'Yellow', artist: 'Coldplay', duration: 267 };
const song = { id: 17177324, name: 'Yellow', artists: [{ name: 'Coldplay' }], duration: 266773 };
assert.ok(matchMetingRecording(song, hints));
for (const altered of [{ ...song, name: 'Yellow (Live)' }, { ...song, artists: [{ name: 'Cover Artist' }] }, { ...song, duration: 30000 }]) assert.equal(matchMetingRecording(altered, hints), false);
for (const url of ['http://m701.music.126.net/a', 'https://m701.music.126.net.evil.test/a', 'https://127.0.0.1/a', 'https://music.126.net:8443/a', 'https://user:pass@music.126.net/a']) assert.equal(allowedMetingAudioUrl(url), false);
assert.ok(allowedMetingAudioUrl('https://m701.music.126.net/song.mp3'));
let searches = 0, resolutions = 0, malicious = false, expire = false, mediaCalls = 0;
let badRange = false, hold = false, cancelled = 0, wrongType = false;
const bytes = Buffer.from('ID3' + 'test audio bytes '.repeat(20));
const fakeFetch = async (url, options = {}) => {
  const u = new URL(url);
  if (u.searchParams.get('type') === 'search') {
    searches++; await new Promise(r => setTimeout(r, 20));
    return Response.json([{ name: 'Yellow', artist: 'Coldplay', url: 'https://api.qijieya.cn/meting/?server=netease&type=url&id=17177324' }]);
  }
  if (u.hostname === 'music.163.com') return new Response(JSON.stringify({ songs: [song] }), { headers: { 'content-type': 'text/plain' } });
  if (u.searchParams.get('type') === 'url') {
    resolutions++;
    return new Response(null, { status: 302, headers: { location: malicious ? 'https://127.0.0.1/private' : 'https://m701.music.126.net/song.mp3' } });
  }
  assert.equal(u.hostname, 'm701.music.126.net'); mediaCalls++;
  if (expire) { expire = false; return new Response(null, { status: 403 }); }
  if (wrongType) return new Response('<html>provider error</html>', { headers: { 'content-type': 'text/html' } });
  if (hold) return new Response(new ReadableStream({ start(c) { c.enqueue(bytes); }, cancel() { cancelled++; } }), { headers: { 'content-type': 'audio/mpeg' } });
  const range = options.headers.Range;
  if (badRange) return new Response(bytes, { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 999-1000/1' } });
  if (range) return new Response(bytes.subarray(3, 13), { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': `bytes 3-12/${bytes.length}`, 'content-length': '10', 'accept-ranges': 'bytes' } });
  return new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'content-length': String(bytes.length), 'accept-ranges': 'bytes' } });
};
const collaboration = { ...song, artists: [{ name: 'Coldplay' }, { name: 'Guest Artist' }] };
assert.ok(matchMetingRecording(collaboration, hints));
assert.equal(matchMetingRecording({ ...collaboration, artists: [{ name: 'Coldplay Tribute' }] }, hints), false);
const collaborationBackend = createMetingBackend({ fetchImpl: async url => new URL(url).hostname === 'music.163.com'
  ? Response.json({ songs: [collaboration] })
  : Response.json([{ name: 'Yellow', artist: 'Coldplay/Guest Artist', url: 'https://api.qijieya.cn/meting/?server=netease&type=url&id=17177324' }]) });
assert.equal((await collaborationBackend.resolve(hints)).id, '17177324', 'Primary catalog artist matches a provider collaboration through both filters');
const backend = createMetingBackend({ fetchImpl: fakeFetch });
const results = await Promise.all(Array.from({ length: 30 }, () => backend.resolve(hints)));
assert.equal(searches, 1); assert.equal(new Set(results.map(r => r.streamUrl)).size, 1);
assert.ok(results.every(r => !JSON.stringify(r).includes('qijieya')));
const app = express();
app.get('/audio/:id', async (req, res) => { try { await backend.stream(req, res); } catch (e) { if (!res.headersSent && !res.destroyed) res.status(e.status || 502).end(); } });
const server = app.listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  assert.equal((await fetch(base + '/audio/999')).status, 404);
  assert.equal((await fetch(base + '/audio/17177324', { headers: { Range: 'bytes=1-2,4-5' } })).status, 416);
  for (const range of ['bytes=5-2', 'bytes=-0', 'bytes=999999999999999999999-']) {
    assert.equal((await fetch(base + '/audio/17177324', { headers: { Range: range } })).status, 416);
  }
  let r = await fetch(base + '/audio/17177324'); assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
  expire = true;
  r = await fetch(base + '/audio/17177324', { headers: { Range: 'bytes=3-12' } });
  assert.equal(r.status, 206); assert.equal(r.headers.get('content-range'), `bytes 3-12/${bytes.length}`); assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes.subarray(3, 13));
  assert.equal(resolutions, 2, 'Expired media URL is resolved once again');
  malicious = true; expire = true;
  const before = mediaCalls;
  assert.equal((await fetch(base + '/audio/17177324')).status, 502);
  assert.equal(mediaCalls, before + 1, 'No request follows an unapproved redirect');
  malicious = false; badRange = true;
  assert.equal((await fetch(base + '/audio/17177324', { headers: { Range: 'bytes=0-10' } })).status, 502);
  badRange = false; wrongType = true;
  assert.equal((await fetch(base + '/audio/17177324')).status, 502);
  wrongType = false; hold = true;
  const listeners = await Promise.all(Array.from({ length: 40 }, () => fetch(base + '/audio/17177324')));
  assert.ok(listeners.every(r => r.status === 200));
  assert.equal((await fetch(base + '/audio/17177324')).status, 503, '40 active transfers reject extra work cleanly');
  await Promise.all(listeners.map(r => r.body.cancel()));
  for (let i = 0; i < 100 && cancelled < 40; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(cancelled, 40, 'disconnects cancel every upstream body and free capacity');
  hold = false;
  const recovered = await fetch(base + '/audio/17177324');
  assert.equal(recovered.status, 200); await recovered.arrayBuffer();
  console.log('PASS: recording matching, 30-user coalescing, audio bytes, ranges, expiry refresh, and redirect isolation.');
  console.log('PASS: malformed ranges, HTML upstream errors, 40 active listeners, overload response, disconnect cancellation and capacity recovery.');
} finally { await new Promise(r => server.close(r)); }

let releaseLookups;
const lookupGate = new Promise(resolve => { releaseLookups = resolve; });
let startedLookups = 0;
const priorityBackend = createMetingBackend({ fetchImpl: async () => { startedLookups++; await lookupGate; return Response.json([]); } });
const background = priorityBackend.resolve(hints, { prefetch: true }).catch(e => e.status);
try {
  await assert.rejects(priorityBackend.resolve({ ...hints, title: 'Speculative second' }, { prefetch: true }), e => e.status === 503);
  const foreground = [1, 2, 3].map(n => priorityBackend.resolve({ ...hints, title: 'Selected ' + n }).catch(e => e.status));
  assert.equal(startedLookups, 4, 'One background request leaves three lookup slots for listeners');
  await assert.rejects(priorityBackend.resolve({ ...hints, title: 'Over capacity' }), e => e.status === 503);
  releaseLookups();
  assert.deepEqual(await Promise.all([background, ...foreground]), [404, 404, 404, 404]);
} finally { releaseLookups(); }
console.log('PASS: speculative lookup cap reserves foreground capacity.');
