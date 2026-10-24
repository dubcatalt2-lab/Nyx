import { readFileSync } from "node:fs";

export function installChatGifs(app, { authenticate, sameOrigin, request = fetch, key = () =>
  process.env.NYX_GIPHY_API_KEY || (process.env.NYX_GIPHY_API_KEY_FILE ? readFileSync(process.env.NYX_GIPHY_API_KEY_FILE, "utf8").trim() : "") }) {
  const cache = new Map(); const limits = new Map();
  const media = value => {
    try { const url = new URL(value); return url.protocol === "https:" && /^(?:media\d*|i)\.giphy\.com$/.test(url.hostname) && !url.username && !url.password ? url.href : ""; }
    catch { return ""; }
  };
  app.get("/api/chat/gifs/media", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!sameOrigin(req)) return res.sendStatus(403);
    try {
      const {token} = await authenticate(req, false);
      const url = media(String(req.query.url || ""));
      if (!url || new URL(url).port) return res.sendStatus(400);
      const now = Date.now(), id = 'media:' + token.uid;
      let quota = limits.get(id);
      if (!quota || quota.until < now) { quota = {until: now + 60000, count: 0}; limits.set(id, quota); }
      if (++quota.count > 240) return res.status(429).set('Retry-After', '60').end();
      if (limits.size > 2000) for (const [id, value] of limits) if (value.until < now) limits.delete(id);
      const upstream = await request(new URL(url), {redirect:'error', signal:AbortSignal.timeout(15000)});
      const max = 8 * 1024 ** 2;
      if (!upstream.ok || Number(upstream.headers.get('content-length')) > max) { await upstream.body?.cancel(); return res.sendStatus(502); }
      const chunks = []; let size = 0;
      const reader = upstream.body.getReader();
      try {
        for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > max) throw new Error('GIF exceeds size limit'); chunks.push(Buffer.from(value)); }
      } finally { await reader.cancel(); }
      const bytes = Buffer.concat(chunks);
      if (!['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii'))) return res.sendStatus(502);
      res.set({'Content-Type':'image/gif','X-Content-Type-Options':'nosniff'}).send(bytes);
    } catch (error) { res.sendStatus([401,403].includes(error.status) ? error.status : 502); }
  });
  app.get("/api/chat/gifs", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!sameOrigin(req)) return res.status(403).json({ error: "Cross-origin requests are not allowed." });
    try {
      const { token } = await authenticate(req, false);
      const now = Date.now();
      let quota = limits.get(token.uid);
      if (!quota || quota.until < now) { quota = { until: now + 60000, count: 0 }; limits.set(token.uid, quota); }
      if (++quota.count > 40) return res.status(429).set("Retry-After", "60").json({ error: "Please wait a moment before searching again." });
      if (limits.size > 2000) for (const [uid, value] of limits) if (value.until < now) limits.delete(uid);
      const apiKey = key();
      if (!apiKey) return res.status(503).json({ error: "GIF search is waiting for the site owner to connect GIPHY." });
      const q = String(req.query.q || "").trim().slice(0, 100);
      const offset = Math.min(200, Math.max(0, Number.parseInt(req.query.offset, 10) || 0));
      const cacheKey = JSON.stringify([q, offset]);
      if (cache.get(cacheKey)?.until > now) return res.json(cache.get(cacheKey).value);
      const url = new URL(`https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}`);
      url.search = new URLSearchParams({ api_key: apiKey, q, limit: "24", offset: String(offset), rating: "pg", lang: "en" }).toString();
      const response = await request(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
      if (!response.ok) throw new Error("GIF provider unavailable");
      const payload = await response.json();
      const items = (Array.isArray(payload.data) ? payload.data : []).slice(0, 24).flatMap(item => {
        const rendition = item.images?.downsized || item.images?.original;
        const url = media(rendition?.url); const preview = media(item.images?.fixed_width?.url) || media(item.images?.fixed_width_small?.url) || url;
        if (!url || Number(rendition?.size) > 8 * 1024 ** 2) return [];
        return [{ id: String(item.id || "").slice(0, 100), title: String(item.title || "GIF").slice(0, 180), url, preview }];
      });
      const next = offset + (Number(payload.pagination?.count) || 0);
      const value = { items, next: next > offset && next < Math.min(201, Number(payload.pagination?.total_count) || 0) ? next : null };
      cache.set(cacheKey, { until: now + 60000, value });
      while (cache.size > 128) cache.delete(cache.keys().next().value);
      res.json(value);
    } catch (error) {
      const status = [401, 403].includes(error.status) ? error.status : 502;
      res.status(status).json({ error: status === 401 ? "Sign in to use GIF search." : status === 403 ? "GIF search is unavailable for this account." : "GIF search is temporarily unavailable. Please try again." });
    }
  });
}
