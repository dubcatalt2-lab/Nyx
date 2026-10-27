import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Opt-in local development transport. Authentication and accounting stay upstream.
export function τοπικήΓέφυρα({ origin = process.env.NYX_LOCAL_AI_ORIGIN, request = fetch } = {}) {
  if (!origin) return (_req, _res, next) => next();
  const προορισμός = new URL(origin);
  if (προορισμός.protocol !== "https:" || προορισμός.username || προορισμός.password ||
      προορισμός.pathname !== "/" || προορισμός.search || προορισμός.hash)
    throw new Error("NYX_LOCAL_AI_ORIGIN must be a credential-free HTTPS origin.");
  return async (req, res, next) => {
    if (!/^\/api\/nyx-ai(?:\/(?:models|providers|usage|media(?:\/[A-Za-z0-9-]+(?:\/content)?)?))?$/.test(req.path)) return next();
    const τοπικός = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
    let ασφαλές = false;
    try {
      const οικοδεσπότης = new URL(`http://${req.headers.host}`);
      ασφαλές = ["localhost", "127.0.0.1", "[::1]"].includes(οικοδεσπότης.hostname) &&
        (!req.headers.origin || new URL(req.headers.origin).host === οικοδεσπότης.host) &&
        req.headers["sec-fetch-site"] !== "cross-site";
    } catch {}
    if (!τοπικός || !ασφαλές) return res.status(403).json({ error: "The local AI relay accepts same-origin localhost requests only." });
    if (!["GET", "POST", "HEAD"].includes(req.method)) return res.status(405).end();
    const κεφαλίδες = { accept: req.headers.accept || "application/json", origin: προορισμός.origin };
    for (const όνομα of ["authorization", "content-type", "x-nyx-ai-provider", "x-nyx-ai-api-key", "x-nyx-ai-base-url", "range"])
      if (req.headers[όνομα]) κεφαλίδες[όνομα] = req.headers[όνομα];
    const συσκευή = String(req.headers.cookie || "").split(";").map(τιμή => τιμή.trim()).find(τιμή => τιμή.startsWith("nyx_q74bd9="));
    if (συσκευή) κεφαλίδες.cookie = συσκευή;
    const έλεγχος = new AbortController();
    const χρονόμετρο = setTimeout(() => έλεγχος.abort(), 600000);
    χρονόμετρο.unref();
    const κλείσιμο = () => έλεγχος.abort();
    res.once("close", κλείσιμο);
    try {
      const απάντηση = await request(new URL(req.originalUrl, προορισμός.origin), {
        method: req.method,
        headers: κεφαλίδες,
        body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
        redirect: "error",
        signal: έλεγχος.signal,
      });
      res.status(απάντηση.status);
      res.set("Cache-Control", "private, no-store");
      for (const όνομα of ["content-type", "retry-after", "content-range", "accept-ranges"])
        if (απάντηση.headers.has(όνομα)) res.set(όνομα, απάντηση.headers.get(όνομα));
      if (απάντηση.body && req.method !== "HEAD")
        await pipeline(Readable.fromWeb(απάντηση.body), res, { signal: έλεγχος.signal });
      else res.end();
    } catch {
      if (!res.headersSent && !res.destroyed) res.status(502).json({ error: "The VPS AI service could not be reached. Try again shortly." });
      else if (!res.destroyed) res.destroy();
    } finally {
      clearTimeout(χρονόμετρο);
      res.removeListener("close", κλείσιμο);
    }
  };
}
