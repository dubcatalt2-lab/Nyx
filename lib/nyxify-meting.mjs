import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const endpoint = 'https://api.qijieya.cn/meting/';
const ttl = 60 * 60_000;
const maxBytes = 64 * 1024 * 1024;
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const fail = (message, status = 502) => Object.assign(new Error(message), { status });
const metingUrl = params => `${endpoint}?${new URLSearchParams({ server: 'netease', ...params })}`;

export function allowedMetingAudioUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.hash && (!u.port || u.port === '443')
      && (u.hostname === 'music.126.net' || u.hostname.endsWith('.music.126.net'));
  } catch { return false; }
}

export function matchMetingRecording(song, hints) {
  const duration = Number(song?.duration) / 1000;
  const expected = Number(hints.duration);
  return normalize(song?.name) === normalize(hints.title)
    && normalize((song?.artists || []).map(a => a.name).join(' ')) === normalize(hints.artist)
    && duration > 45 && Number.isFinite(duration)
    && (!(expected > 0) || Math.abs(duration - expected) <= Math.max(4, expected * .03));
}

export function createMetingBackend({ fetchImpl = fetch } = {}) {
  const matches = new Map(), inflight = new Map(), registered = new Map(), urls = new Map();
  let resolving = 0, streaming = 0;
  function put(map, key, value) {
    map.delete(key); map.set(key, value);
    while (map.size > 256) map.delete(map.keys().next().value);
  }
  async function json(url) {
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !(type.includes('json') || type.startsWith('text/plain'))) {
      await response.body?.cancel();
      throw fail('Music lookup is temporarily unavailable.');
    }
    let size = 0; const chunks = [];
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 1024 * 1024) throw fail('Music lookup returned too much data.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw fail('Music lookup returned an invalid response.'); }
  }
  async function resolve(hints) {
    const title = String(hints.title || '').trim().slice(0, 180);
    const artist = String(hints.artist || '').trim().slice(0, 120);
    if (!title || !artist) throw fail('This song is missing its title or artist.', 400);
    const key = JSON.stringify([title, artist, Number(hints.duration) || 0]);
    const cached = matches.get(key);
    if (cached?.expires > Date.now()) {
      if (cached.error) throw fail(cached.error, 404);
      if (registered.get(cached.match.id) > Date.now()) return cached.match;
    }
    if (inflight.has(key)) return inflight.get(key);
    if (resolving >= 4) throw fail('Music lookup is busy. Please try again shortly.', 503);
    resolving++;
    const work = (async () => {
      const rows = await json(metingUrl({ type: 'search', id: `${artist} ${title}`, limit: '10' }));
      const ids = [...new Set((Array.isArray(rows) ? rows : []).slice(0, 10).filter(row =>
        normalize(row.name) === normalize(title) && normalize(row.artist) === normalize(artist)
      ).flatMap(row => {
        try {
          const u = new URL(row.url);
          const id = u.searchParams.get('id');
          return u.origin === new URL(endpoint).origin && u.pathname === '/meting/'
            && u.searchParams.get('server') === 'netease' && /^\d{1,16}$/.test(id) ? [id] : [];
        } catch { return []; }
      }))];
      if (ids.length) {
        const details = await json(`https://music.163.com/api/song/detail/?ids=${encodeURIComponent(JSON.stringify(ids))}`);
        const candidates = (details.songs || []).filter(song => ids.includes(String(song.id)) && matchMetingRecording(song, { title, artist, duration: hints.duration }));
        candidates.sort((a, b) => Math.abs(a.duration / 1000 - Number(hints.duration || a.duration / 1000)) - Math.abs(b.duration / 1000 - Number(hints.duration || b.duration / 1000)));
        if (candidates.length) {
          const song = candidates[0], id = String(song.id);
          const match = { mode: 'meting', id, title: song.name, durationSeconds: song.duration / 1000, streamUrl: `/api/nyxify/audio/${id}` };
          put(registered, id, Date.now() + ttl);
          put(matches, key, { match, expires: Date.now() + ttl });
          return match;
        }
      }
      const message = 'No matching full recording is available for this song.';
      put(matches, key, { error: message, expires: Date.now() + 15_000 });
      throw fail(message, 404);
    })();
    inflight.set(key, work);
    try { return await work; }
    finally { resolving--; inflight.delete(key); }
  }
  async function openAudio(id, range, signal, refresh = false) {
    let current = urls.get(id);
    let target = !refresh && current?.expires > Date.now() ? current.url : metingUrl({ type: 'url', id, br: '320' });
    for (let hop = 0; hop < 4; hop++) {
      if (target !== metingUrl({ type: 'url', id, br: '320' }) && !allowedMetingAudioUrl(target)) throw fail('The music provider returned an unsupported audio host.');
      const response = await fetchImpl(target, {
        redirect: 'manual', signal,
        headers: { Accept: 'audio/mpeg,application/octet-stream', ...(range ? { Range: range } : {}) }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw fail('The audio link is unavailable.');
        target = new URL(location, target).href;
        continue;
      }
      if ([403, 404, 410].includes(response.status) && current && !refresh) {
        await response.body?.cancel(); urls.delete(id);
        return openAudio(id, range, signal, true);
      }
      if (response.status === 416) { await response.body?.cancel(); throw fail('Audio seek is outside the available range.', 416); }
      const type = response.headers.get('content-type')?.split(';')[0].trim();
      if (![200, 206].includes(response.status) || !['audio/mpeg', 'audio/mp3', 'application/octet-stream'].includes(type) || !response.body) {
        await response.body?.cancel();
        throw fail('Full audio is temporarily unavailable.', response.status === 429 ? 503 : 502);
      }
      const length = Number(response.headers.get('content-length'));
      if (length > maxBytes) { await response.body.cancel(); throw fail('This audio file exceeds the playback limit.'); }
      if (!allowedMetingAudioUrl(target)) { await response.body.cancel(); throw fail('No supported audio link was returned.'); }
      put(urls, id, { url: target, expires: Date.now() + 5 * 60_000 });
      return response;
    }
    throw fail('The music provider returned too many redirects.');
  }
  async function stream(req, res) {
    const id = String(req.params.id || '');
    if (!/^\d{1,16}$/.test(id) || !(registered.get(id) > Date.now())) throw fail('Reload this song to renew its playback link.', 404);
    const range = String(req.headers.range || '').trim();
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) throw fail('Invalid audio range.', 416);
    if (streaming >= 40) throw fail('Music playback is busy. Please try again shortly.', 503);
    streaming++;
    const controller = new AbortController();
    const close = () => controller.abort();
    res.once('close', close);
    const timer = setTimeout(close, 10 * 60_000); timer.unref?.();
    let idle;
    const resetIdle = () => { clearTimeout(idle); idle = setTimeout(close, 30_000); idle.unref?.(); };
    resetIdle();
    try {
      const upstream = await openAudio(id, range, controller.signal);
      res.status(upstream.status).set({ 'Content-Type': 'audio/mpeg', 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      for (const name of ['content-length', 'content-range', 'accept-ranges']) {
        const value = upstream.headers.get(name); if (value) res.set(name, value);
      }
      if (req.method === 'HEAD') { await upstream.body.cancel(); res.end(); return; }
      let bytes = 0;
      const limiter = new Transform({ transform(chunk, encoding, callback) {
        bytes += chunk.length; resetIdle();
        callback(bytes > maxBytes ? fail('Audio exceeds playback limit.') : null, chunk);
      } });
      await pipeline(Readable.fromWeb(upstream.body), limiter, res, { signal: controller.signal });
    } finally {
      controller.abort(); clearTimeout(timer); clearTimeout(idle); res.off('close', close); streaming--;
    }
  }
  return { resolve, stream };
}
