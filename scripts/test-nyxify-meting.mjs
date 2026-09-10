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
  const range = options.headers.Range;
  if (range) return new Response(bytes.subarray(3, 13), { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': `bytes 3-12/${bytes.length}`, 'content-length': '10', 'accept-ranges': 'bytes' } });
  return new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'content-length': String(bytes.length), 'accept-ranges': 'bytes' } });
};
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
  let r = await fetch(base + '/audio/17177324'); assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
  expire = true;
  r = await fetch(base + '/audio/17177324', { headers: { Range: 'bytes=3-12' } });
  assert.equal(r.status, 206); assert.equal(r.headers.get('content-range'), `bytes 3-12/${bytes.length}`); assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes.subarray(3, 13));
  assert.equal(resolutions, 2, 'Expired media URL is resolved once again');
  malicious = true; expire = true;
  const before = mediaCalls;
  assert.equal((await fetch(base + '/audio/17177324')).status, 502);
  assert.equal(mediaCalls, before + 1, 'No request follows an unapproved redirect');
  console.log('PASS: recording matching, 30-user coalescing, audio bytes, ranges, expiry refresh, and redirect isolation.');
} finally { await new Promise(r => server.close(r)); }
