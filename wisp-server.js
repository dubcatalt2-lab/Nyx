import { createServer } from "node:http";
import { startWispurr } from "./lib/wispurr-relay.mjs";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const configuredAllowedOrigins = String(process.env.NYX_ALLOWED_ORIGINS || "")
  .split(",")
  .map(value => value.trim().replace(/\/$/, ""))
  .filter(Boolean);
const canonicalAllowedOrigins = [
  process.env.NYX_PUBLIC_ORIGIN,
  "https://nyxlearning.org",
  "https://www.nyxlearning.org",
  "https://nyxlearning.netlify.app"
]
  .map(value => String(value || "").trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = [...new Set([...configuredAllowedOrigins, ...canonicalAllowedOrigins])];
const presenceSessions = new Map();
const presenceTtlMs = 45_000;

const wisp = await startWispurr({
  onFailure: () => { console.error("Nyx relay worker stopped."); shutdown("worker", 1); }
});

function originAllowed(origin) {
  if (!allowedOrigins.length || allowedOrigins.includes("*")) return true;
  return allowedOrigins.includes(String(origin || "").replace(/\/$/, ""));
}

function rejectUpgrade(socket, status = "403 Forbidden") {
  try {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } finally {
    socket.destroy();
  }
}

function prunePresence(now = Date.now()) {
  for (const [sessionId, lastSeen] of presenceSessions) {
    if (now - lastSeen > presenceTtlMs) presenceSessions.delete(sessionId);
  }
  return presenceSessions.size;
}

function applyPresenceCors(req, res) {
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (origin && originAllowed(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("cache-control", "no-store");
}

function sendPresence(res, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ online: prunePresence(), ttl: presenceTtlMs }));
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/presence") {
    applyPresenceCors(req, res);
    const origin = String(req.headers.origin || "").replace(/\/$/, "");
    if (origin && !originAllowed(origin)) {
      sendPresence(res, 403);
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET") {
      sendPresence(res);
      return;
    }
    if (req.method === "POST") {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", chunk => {
        body += chunk;
        if (body.length > 1024) req.destroy();
      });
      req.on("end", () => {
        try {
          const sessionId = String(JSON.parse(body || "{}").sessionId || "");
          if (!/^[a-zA-Z0-9_-]{16,128}$/.test(sessionId)) {
            sendPresence(res, 400);
            return;
          }
          presenceSessions.set(sessionId, Date.now());
          sendPresence(res);
        } catch {
          sendPresence(res, 400);
        }
      });
      return;
    }
    sendPresence(res, 405);
    return;
  }
  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({
      ok: true,
      service: "nyx-wisp",
      online: prunePresence(),
      originsRestricted: allowedOrigins.length > 0,
      dnsResultOrder: "ipv4first",
      implementation: "wispurr"
    }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end("Nyx Wisp is running. WebSocket endpoint: /wisp/\n");
});

server.on("upgrade", (req, socket, head) => {
  let url;
  try { url = new URL(req.url || "/", "http://localhost"); }
  catch { rejectUpgrade(socket, "400 Bad Request"); return; }
  if (url.pathname !== "/wisp/") {
    rejectUpgrade(socket, "404 Not Found");
    return;
  }
  if (!originAllowed(req.headers.origin)) {
    rejectUpgrade(socket);
    return;
  }
  wisp.route(req, socket, head);
});

server.listen(port, "0.0.0.0");

let shuttingDown = false;
function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const workerStopped = wisp.stop();
  server.close(() => Promise.resolve(workerStopped).then(() => process.exit(exitCode)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
server.once("error", () => shutdown("listen", 1));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
if (process.channel) process.once("disconnect", () => shutdown("disconnect"));
