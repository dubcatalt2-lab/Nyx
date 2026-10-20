import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
const derive = promisify(scrypt);
const host = "sec.ridgewoodstem.org";
const cookie = "__Host-q83entry";
const ttl = 8 * 60 * 60;
export function createGate(config) {
  const key = Buffer.from(config.key, "hex");
  const expected = Buffer.from(config.hash, "hex");
  if (
    key.length !== 32 ||
    expected.length !== 64 ||
    !/^[a-f0-9]{32}$/.test(config.salt)
  )
    throw new Error("Invalid private gate configuration");
  const script = readFileSync(new URL("q19.js", import.meta.url), "utf8");
  const attempts = new Map();
  const είσοδοι = new Map();
  let running = 0;
  function sign(value) {
    return createHmac("sha256", key).update(value).digest("hex");
  }
  function διαβατήριο(req) {
    return (
      String(req.headers.cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(cookie + "="))
        ?.slice(cookie.length + 1) || ""
    );
  }
  function είσοδος(req) {
    const προορισμός = String(
      req.headers["sec-fetch-dest"] || "",
    ).toLowerCase();
    if (προορισμός) return προορισμός === "document";
    return (
      req.headers["sec-fetch-mode"] === "navigate" ||
      /text\/html/i.test(String(req.headers.accept || ""))
    );
  }
  function valid(req) {
    const raw = διαβατήριο(req);
    const [expiry, nonce, mac] = raw.split(".");
    if (
      !/^\d{10}$/.test(expiry || "") ||
      !/^[a-f0-9]{32}$/.test(nonce || "") ||
      !/^[a-f0-9]{64}$/.test(mac || "")
    )
      return false;
    const now = Math.floor(Date.now() / 1000);
    return (
      Number(expiry) > now &&
      Number(expiry) <= now + ttl &&
      timingSafeEqual(
        Buffer.from(mac, "hex"),
        Buffer.from(sign(expiry + "." + nonce), "hex"),
      )
    );
  }
  const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Library access</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f2ed;color:#28352f;font:16px system-ui,sans-serif}header{padding:24px 6vw;border-bottom:1px solid #d5d8cf;font-weight:650}main{max-width:440px;margin:10vh auto;padding:28px}small{color:#687269}h1{font:36px Georgia,serif;margin:14px 0}p{line-height:1.6;color:#687269}label{display:block;margin-top:22px;font-size:14px}input{display:block;width:100%;padding:13px;margin-top:8px;border:1px solid #b9c0b8;border-radius:6px;background:#fff;font:inherit}input:focus-visible,button:focus-visible{outline:3px solid #8da99a;outline-offset:3px}button{width:100%;margin-top:26px;padding:14px;border:0;border-radius:6px;background:#314c3f;color:white;font:600 15px system-ui;cursor:pointer}button:hover{background:#223b2e}button:disabled{opacity:.6;cursor:wait}[role=status]{min-height:48px;font-size:14px}footer{font-size:12px;color:#687269}</style><header>Learning library</header><main><small>Member access</small><h1>A place to explore.</h1><p>Sign in with your access password to continue to the library.</p><form><label>Username<input name="username" autocomplete="username" required maxlength="100"></label><label>Access password<input name="password" type="password" autocomplete="current-password" required maxlength="1024"></label><button>Enter library</button><p role="status" aria-live="polite"></p></form><footer>Enter your password each time you open or reload this site.</footer></main><script src="/_q83entry/q19.js" defer></script></html>`;
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/verify") {
      if (valid(req)) {
        if (!είσοδος(req)) {
          res.writeHead(204);
          res.end();
          return;
        }
        const άδεια = διαβατήριο(req);
        const λήξη = είσοδοι.get(άδεια) || 0;
        είσοδοι.delete(άδεια);
        if (λήξη > Date.now()) {
          res.writeHead(204);
          res.end();
          return;
        }
      }
      res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    if (url.pathname === "/_q83entry/q19.js" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      res.end(script);
      return;
    }
    if (url.pathname !== "/_q83entry/login" || req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }
    if (
      req.headers.origin !== "https://" + host ||
      !String(req.headers["content-type"]).startsWith("application/json")
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    const now = Date.now();
    for (const [άδεια, λήξη] of είσοδοι) if (λήξη <= now) είσοδοι.delete(άδεια);
    for (const [id, record] of attempts)
      if (record.until < now) attempts.delete(id);
    const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress);
    const record = attempts.get(ip) || { count: 0, until: now + 600000 };
    if (
      record.count >= 10 ||
      running >= 4 ||
      είσοδοι.size >= 10000 ||
      (attempts.size >= 10000 && !attempts.has(ip))
    ) {
      res.writeHead(429, { "Retry-After": "600" });
      res.end();
      return;
    }
    record.count++;
    attempts.set(ip, record);
    running++;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) {
          res.writeHead(413);
          res.end();
          return;
        }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        typeof data.username !== "string" ||
        !data.username.trim() ||
        data.username.length > 100 ||
        typeof data.password !== "string" ||
        data.password.length > 1024
      ) {
        res.writeHead(400);
        res.end();
        return;
      }
      const actual = await derive(data.password, config.salt, 64);
      if (!timingSafeEqual(actual, expected)) {
        res.writeHead(401);
        res.end();
        return;
      }
      attempts.delete(ip);
      const payload =
        String(Math.floor(Date.now() / 1000) + ttl) +
        "." +
        randomBytes(16).toString("hex");
      const άδεια = payload + "." + sign(payload);
      είσοδοι.set(άδεια, Date.now() + 60000);
      res.writeHead(204, {
        "Set-Cookie":
          cookie +
          "=" +
          άδεια +
          "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=" +
          ttl,
      });
      res.end();
    } catch {
      if (!res.headersSent) res.writeHead(400);
      res.end();
    } finally {
      running--;
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = JSON.parse(
    readFileSync(process.env.Q83_CONFIG || "/etc/nyx/q83entry.json", "utf8"),
  );
  const server = createGate(config);
  server.requestTimeout = 15000;
  server.listen(Number(process.env.PORT || 8193), "127.0.0.1");
}
