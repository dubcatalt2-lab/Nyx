import express from "express";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { uvPath } = require("@titaniumnetwork-dev/ultraviolet");
const { baremuxPath } = require("@mercuryworkshop/bare-mux/node");
const { scramjetPath } = require("@mercuryworkshop/scramjet/path");
const scramjetControllerPath = dirname(require.resolve("@mercuryworkshop/scramjet-controller"));
const epoxyPath = join(dirname(require.resolve("@mercuryworkshop/epoxy-transport")), "..", "dist");
const libcurlPath = dirname(require.resolve("@mercuryworkshop/libcurl-transport"));
const app = express();
const uvHandlerPath = join(uvPath, "uv.handler.js");
const baremuxIndexPath = join(baremuxPath, "index.mjs");
const scramjetRuntimePath = join(scramjetPath, "scramjet.js");

app.use((req, res, next) => {
  const noStorePaths = new Set([
    "/",
    "/index.html",
    "/uv.sw.js",
    "/uv.config.js",
    "/uv/uv.bundle.js",
    "/uv/uv.client.js",
    "/scramjet.sw.js",
    "/uv/uv.handler.js",
    "/baremux/index.mjs",
    "/scramjet/scramjet.js",
    "/nyx-scramjet-runtime-guard.js"
  ]);
  if (noStorePaths.has(req.path)) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function patchedUvHandler() {
  const source = readFileSync(uvHandlerPath, "utf8");
  const original = "t.respondWith(h?l(t.target,[t.data.message,t.data.transfer],t.that):l(t.target,[t.data.message,t.data.origin,t.data.transfer],t.that))";
  const patched = `(()=>{let n=t.data.transfer||[];try{const o=new Set(n);const i=new Set;const a=e=>{if(!e||typeof e!="object"||i.has(e))return;i.add(e);let t="";try{t=Object.prototype.toString.call(e)}catch{}if(typeof MessagePort!="undefined"&&e instanceof MessagePort||t==="[object MessagePort]"){o.add(e);return}if(Array.isArray(e)){for(const t of e)a(t);return}for(const t of Object.values(e))a(t)};a(t.data.message);n=[...o]}catch{}return t.respondWith(h?l(t.target,[t.data.message,n],t.that):l(t.target,[t.data.message,t.data.origin,n],t.that))})()`;
  return source.includes(original) ? source.replace(original, patched) : source;
}

function patchedBareMuxIndex() {
  return readFileSync(baremuxIndexPath, "utf8")
    .replace(
      'const e=(await self.clients.matchAll({type:"window",includeUncontrolled:!0})).map',
      'const e=(await self.clients.matchAll({type:"window",includeUncontrolled:!0})).filter((e=>{try{const t=new URL(e.url);return t.origin===self.location.origin&&!t.pathname.startsWith("/service/")&&!t.pathname.startsWith("/~/sj/")}catch{return!1}})).map'
    )
    .replace(/setTimeout\(([^,]+),1e3,new TypeError\("timeout"\)\)/g, 'setTimeout($1,5000,new TypeError("timeout"))')
    .replace(/within 1s/g, "within 5s");
}

function patchedScramjetRuntime() {
  return readFileSync(scramjetRuntimePath, "utf8");
}

function scramjetRuntimeGuard() {
  return `(() => {
  if (typeof window === "undefined" || window.__nyxScramjetGuards) return;
  window.__nyxScramjetGuards = true;
  const nativeOpen = window.open?.bind(window);
  if (!window.trustedTypes) {
    try {
      Object.defineProperty(window, "trustedTypes", {
        configurable: true,
        value: {
          createPolicy(_name, rules = {}) {
            return {
              createHTML(value) {
                return typeof rules.createHTML === "function" ? rules.createHTML(value) : value;
              },
              createScript(value) {
                return typeof rules.createScript === "function" ? rules.createScript(value) : value;
              },
              createScriptURL(value) {
                return typeof rules.createScriptURL === "function" ? rules.createScriptURL(value) : value;
              }
            };
          }
        }
      });
    } catch {}
  }
  try {
    const nativeCurrentScript = Object.getOwnPropertyDescriptor(Document.prototype, "currentScript");
    const fallbackScript = document.createElement("script");
    fallbackScript.setAttribute("nonce", "");
    Object.defineProperty(Document.prototype, "currentScript", {
      configurable: true,
      get() {
        let current = null;
        try {
          current = nativeCurrentScript?.get?.call(this) || null;
        } catch {}
        if (current) return current;
        return this.querySelector?.("script[src],script") || fallbackScript;
      }
    });
  } catch {}
  const blockedHtml = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>nyx://blocked67haha</title><style>html,body{margin:0;width:100%;height:100%;background:#fff;color:#111;font:28px Raleway,Arial,sans-serif}body{display:grid;place-items:center;text-align:center}main{padding:24px}</style></head><body><main>are you trying to hack me scamma???</main></body></html>';
  const popupProtectionEnabled = () => {
    try {
      return JSON.parse(localStorage.getItem("nyx.popupProtection") ?? "true") !== false;
    } catch {
      return true;
    }
  };
  const writeBlocked = popup => {
    if (!popup) return false;
    try {
      popup.document.open();
      popup.document.write(blockedHtml);
      popup.document.close();
      popup.focus?.();
      return true;
    } catch {
      return false;
    }
  };
  const opennyxPopupWarning = () => {
    const popup = nativeOpen ? nativeOpen("about:blank", "_blank") : null;
    if (!writeBlocked(popup)) {
      try {
        window.parent?.postMessage({ type: "nyx:popup", url: "about:blank" }, "*");
      } catch {}
    }
    return {
      closed: false,
      focus() { try { popup?.focus?.(); } catch {} },
      blur() { try { popup?.blur?.(); } catch {} },
      close() { try { popup?.close?.(); } catch {} this.closed = true; },
      postMessage() {},
      document: {
        open() { writeBlocked(popup); return this; },
        write() { writeBlocked(popup); },
        writeln() { writeBlocked(popup); },
        close() { writeBlocked(popup); }
      },
      location: {
        href: "nyx://blocked67haha",
        assign() { opennyxPopupWarning(); },
        replace() { opennyxPopupWarning(); },
        reload() { writeBlocked(popup); },
        toString() { return "nyx://blocked67haha"; }
      }
    };
  };
  let guardedOpen = (...args) => {
    if (!popupProtectionEnabled() && nativeOpen) return nativeOpen(...args);
    return opennyxPopupWarning();
  };
  try {
    if (typeof nativeOpen === "function" && typeof Proxy === "function") {
      guardedOpen = new Proxy(nativeOpen, {
        apply(target, thisArg, args) {
          if (!popupProtectionEnabled()) return Reflect.apply(target, thisArg, args);
          return opennyxPopupWarning();
        },
        construct(target, args, newTarget) {
          if (!popupProtectionEnabled()) {
            try {
              return Reflect.construct(target, args, newTarget);
            } catch {
              return Reflect.apply(target, window, args);
            }
          }
          return opennyxPopupWarning();
        },
        get(target, prop, receiver) {
          if (prop === "__nyxPopupGuard") return true;
          if (prop === "toString") return () => "function open() { [native code] }";
          return Reflect.get(target, prop, receiver);
        }
      });
    }
  } catch {}
  const shouldTrapPopupTarget = target => {
    const value = String(target || "").toLowerCase();
    return value && !["_self", "_parent", "_top"].includes(value);
  };
  const shouldTrapDownloadLink = link => {
    if (!link) return false;
    if (link.hasAttribute("download")) return true;
    const rawHref = String(link.href || link.getAttribute("href") || "").trim();
    if (/^(?:blob|data):/i.test(rawHref)) return true;
    const href = rawHref.split(/[?#]/)[0].toLowerCase();
    return /\.(?:apk|appx|bat|bin|cmd|com|crx|deb|dmg|exe|iso|jar|js|jse|msi|pkg|ps1|scr|sh|vbs|wsf|zip|7z|rar)$/i.test(href);
  };
  try {
    Object.defineProperty(window, "open", { value: guardedOpen, writable: true, configurable: true });
  } catch {
    window.open = guardedOpen;
  }
  try {
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (popupProtectionEnabled() && (shouldTrapPopupTarget(this.target) || shouldTrapDownloadLink(this))) {
        opennyxPopupWarning();
        return;
      }
      return nativeAnchorClick.call(this);
    };
  } catch {}
  if (document && !window.__nyxPopupWarningListeners) {
    window.__nyxPopupWarningListeners = true;
    document.addEventListener("click", event => {
      if (!popupProtectionEnabled()) return;
      const link = event.target?.closest?.("a[href]");
      if (!link || (!shouldTrapPopupTarget(link.getAttribute("target")) && !shouldTrapDownloadLink(link))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opennyxPopupWarning();
    }, true);
    document.addEventListener("auxclick", event => {
      if (!popupProtectionEnabled()) return;
      const link = event.target?.closest?.("a[href]");
      if (!link || (!shouldTrapPopupTarget(link.getAttribute("target")) && !shouldTrapDownloadLink(link))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opennyxPopupWarning();
    }, true);
    document.addEventListener("submit", event => {
      if (!popupProtectionEnabled()) return;
      const form = event.target;
      if (!form || String(form.tagName || "").toUpperCase() !== "FORM" || !shouldTrapPopupTarget(form.getAttribute("target"))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opennyxPopupWarning();
    }, true);
  }
  const wrapCue = name => {
    const Native = window[name];
    if (typeof Native !== "function" || Native.__nyxWrapped) return;
    function SafeCue(start, end, text) {
      let safeStart = Number(start);
      let safeEnd = Number(end);
      if (!Number.isFinite(safeStart) || safeStart < 0) safeStart = 0;
      if (!Number.isFinite(safeEnd) || safeEnd <= safeStart) safeEnd = safeStart + 0.001;
      return Reflect.construct(Native, [safeStart, safeEnd, text == null ? "" : String(text)], new.target || SafeCue);
    }
    try {
      Object.setPrototypeOf(SafeCue, Native);
      SafeCue.prototype = Native.prototype;
      Object.defineProperty(SafeCue, "__nyxWrapped", { value: true });
      window[name] = SafeCue;
    } catch {}
  };
  wrapCue("VTTCue");
  wrapCue("TextTrackCue");
})();`;
}

function searchShell(query, body = "") {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Search</title>
<style>
  body{margin:0;background:#0b0f17;color:#e5e7eb;font:15px/1.45 Arial,sans-serif}
  form{position:sticky;top:0;z-index:2;display:flex;gap:8px;padding:12px;background:#111827;border-bottom:1px solid rgba(255,255,255,.12)}
  input{flex:1;min-width:0;height:38px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:#020617;color:white;padding:0 12px;outline:0}
  button{height:38px;border:0;border-radius:10px;background:#2563eb;color:white;padding:0 14px}
  main{max-width:920px;margin:0 auto;padding:18px}
  a{color:#93c5fd}
  .result,.web-result{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.1)}
  .result__snippet,.result-snippet,.snippet{color:#cbd5e1}
</style>
</head>
<body>
<form action="/search" method="get"><input name="q" value="${esc(query)}" autocomplete="off" autofocus><button>Search</button></form>
<main>${body || `<p>Search without embedding a third-party page directly.</p>`}</main>
<script>
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-nyx-url]');
  if (!link) return;
  event.preventDefault();
  parent.postMessage({ type: 'nyx:navigate', url: link.dataset.nyxUrl }, location.origin);
});
</script>
</body>
</html>`;
}

function rewriteSearchHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi, "")
    .replace(/<form\b[^>]*>/gi, '<form action="/search" method="get">')
    .replace(/\bname=["']?q["']?/gi, 'name="q"')
    .replace(/\bhref=(["'])(.*?)\1/gi, (_match, quote, rawHref) => {
      let href = rawHref.replaceAll("&amp;", "&");
      try {
        const url = new URL(href, "https://lite.duckduckgo.com/");
        const target = url.searchParams.get("uddg") || url.searchParams.get("u") || url.href;
        if (/^https?:\/\//i.test(target) && !target.includes("duckduckgo.com/html")) {
          return `href=${quote}#${quote} data-nyx-url=${quote}${esc(target)}${quote}`;
        }
        if (url.hostname.includes("duckduckgo.com")) {
          const q = url.searchParams.get("q");
          if (q) return `href=${quote}/search?q=${encodeURIComponent(q)}${quote}`;
        }
      } catch {}
      return `href=${quote}${esc(href)}${quote}`;
    });
}

app.get("/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  if (!query) {
    res.type("html").send(searchShell(""));
    return;
  }
  try {
    const upstream = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: { "user-agent": "nyx/1.0" }
    });
    if (!upstream.ok) throw new Error(`Search failed: ${upstream.status}`);
    const html = await upstream.text();
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    res.type("html").send(searchShell(query, rewriteSearchHtml(match ? match[1] : html)));
  } catch {
    res.status(502).type("html").send(searchShell(query, `<p>Search is unavailable right now. Try a direct URL.</p>`));
  }
});

function safeSeraphPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || !/^[a-z0-9_./-]+$/i.test(clean)) return "";
  if (/(^|\/)(?:404|408)\.html$/i.test(clean)) return "";
  return clean;
}

app.get("/seraph-fetch", async (req, res) => {
  const path = safeSeraphPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid Seraph path");
    return;
  }
  const upstreamUrl = `https://cdn.jsdelivr.net/gh/a456pur/seraph@main/games/${path}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "nyx/1.0"
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).type("text/plain").send(`Seraph upstream returned ${upstream.status}`);
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("html").send(await upstream.text());
  } catch (error) {
    res.status(502).type("text/plain").send(`Seraph network error: ${error?.message || error}`);
  }
});

app.get("/uv/uv.handler.js", (_req, res) => {
  res.type("application/javascript").send(patchedUvHandler());
});
app.get("/baremux/index.mjs", (_req, res) => {
  res.type("application/javascript").send(patchedBareMuxIndex());
});
app.get("/scramjet/scramjet.js", (_req, res) => {
  res.type("application/javascript").send(patchedScramjetRuntime());
});
app.get("/nyx-scramjet-runtime-guard.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("application/javascript").send(scramjetRuntimeGuard());
});
app.use(express.static(__dirname));
app.use("/uv/", express.static(uvPath));
app.use("/scramjet/", express.static(scramjetPath));
app.use("/controller/", express.static(scramjetControllerPath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/libcurl/", express.static(libcurlPath));

app.use("/~/sj/", (_req, res) => {
  res.status(502).type("html").send(`<!doctype html>
<meta charset="utf-8">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101318;color:#f5f7fb;font:15px/1.45 Raleway,Arial,sans-serif}
  main{max-width:560px;padding:28px;text-align:center}
  h1{font-size:20px;margin:0 0 10px}
  p{margin:0;color:#c8ced8}
</style>
<main>
  <h1>Scramjet route missed</h1>
  <p>The Scramjet service worker did not claim this frame yet. Reload nyx and try again.</p>
</main>`);
});

app.use((_req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

const server = createServer((req, res) => app(req, res));

server.on("upgrade", (req, socket, head) => {
  if (req.url?.endsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

const port = Number.parseInt(process.env.PORT || "8080", 10);

server.listen(port, "0.0.0.0", () => {
  const address = server.address();
  console.log("nyx running with Ultraviolet and Scramjet:");
  console.log(`  http://localhost:${address.port}`);
  console.log(`  http://${hostname()}:${address.port}`);
});
