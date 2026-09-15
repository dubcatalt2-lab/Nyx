// Fixed-origin artwork relay. No arbitrary URLs, credentials or redirects.
export function installMovieImages(app, {fetchImpl = fetch, now = Date.now} = {}) {
  const cache = new Map(), pending = new Map();
  let bytes = 0, active = 0;
  const waiting = [];
  const acquire = () => active < 4 ? (active++, Promise.resolve()) : new Promise(resolve => waiting.push(resolve));
  const release = () => waiting.length ? waiting.shift()() : active--;
  app.get('/api/movies/image/:size/:file', async (req, res) => {
    const {size, file} = req.params;
    if (!/^(w185|w342|w500|w780|w1280|original)$/.test(size) || !/^[a-zA-Z0-9_-]{1,100}\.(jpg|png|webp)$/.test(file)) return res.sendStatus(400);
    const key = size + '/' + file;
    try {
      let item = cache.get(key);
      if (item && item.until <= now()) { cache.delete(key); bytes -= item.body.length; item = null; }
      if (!item) {
        let job = pending.get(key);
        if (!job) {
          if (pending.size >= 64) return res.status(429).set('Retry-After', '2').end();
          job = (async () => {
            await acquire();
            try {
            const upstream = await fetchImpl('https://image.tmdb.org/t/p/' + key, {redirect: 'error', signal: AbortSignal.timeout(12000)});
            if (!upstream.ok) throw Error('Artwork unavailable');
            const type = upstream.headers.get('content-type')?.split(';')[0];
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw Error('Invalid artwork');
            const reader = upstream.body.getReader(), chunks = []; let length = 0;
            try {
              while (true) {
                const {done, value} = await reader.read(); if (done) break;
                length += value.byteLength; if (length > 5 * 1024 * 1024) throw Error('Artwork too large');
                chunks.push(value);
              }
            } finally { await reader.cancel().catch(() => {}); }
            const result = {type, body: Buffer.concat(chunks), until: now() + 3600000};
            while (cache.size && (bytes + length > 32 * 1024 * 1024 || cache.size >= 256)) {
              const first = cache.keys().next().value; bytes -= cache.get(first).body.length; cache.delete(first);
            }
            cache.set(key, result); bytes += length; return result;
            } finally { release(); }
          })().finally(() => pending.delete(key));
          pending.set(key, job);
        }
        item = await job;
      }
      res.set({'Content-Type': item.type, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff'}).send(item.body);
    } catch { res.status(502).set('Cache-Control', 'no-store').end(); }
  });
}
