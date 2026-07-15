import { createServer } from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const allowedOrigins = String(process.env.NYX_ALLOWED_ORIGINS || "")
  .split(",")
  .map(value => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;
wisp.options.allow_direct_ip = true;
wisp.options.allow_udp_streams = false;
wisp.options.port_whitelist = [80, 443];
wisp.options.stream_limit_per_host = 8;
wisp.options.stream_limit_total = 64;
wisp.options.wisp_motd = "Nyx Railway Wisp";

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

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true, service: "nyx-wisp", originsRestricted: allowedOrigins.length > 0 }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end("Nyx Wisp is running. WebSocket endpoint: /wisp/\n");
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/wisp/") {
    rejectUpgrade(socket, "404 Not Found");
    return;
  }
  if (!originAllowed(req.headers.origin)) {
    rejectUpgrade(socket);
    return;
  }
  wisp.routeRequest(req, socket, head);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Nyx Wisp listening on 0.0.0.0:${port}`);
  console.log(allowedOrigins.length ? `Allowed origins: ${allowedOrigins.join(", ")}` : "Warning: NYX_ALLOWED_ORIGINS is empty; all browser origins are currently allowed.");
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing Wisp server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
