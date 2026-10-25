importScripts("/js/polygon-graphics-adapter.js");

importScripts("/js/proxy-url-codec.js");

let nyxscrRevivePromise = null;

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

function nyxscrRouteMissHtml() {
  return `<!doctype html>
<meta charset="utf-8">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101318;color:#f5f7fb;font:15px/1.45 system-ui,sans-serif}
  main{max-width:560px;padding:28px;text-align:center}
  h1{font-size:20px;margin:0 0 10px}
  p{margin:0;color:#c8ced8}
  button{margin-top:18px;border:1px solid #445066;border-radius:10px;background:#1b2230;color:#f5f7fb;padding:10px 15px;font:600 14px system-ui,sans-serif;cursor:pointer}
</style>
<main>
  <h1>Reconnecting scr</h1>
  <button type="button" onclick="location.reload()">Reload</button>
</main>
<script>
  (() => {
    const key='nyx.scr-route-retry:'+location.pathname;
    const attempts=Number(sessionStorage.getItem(key)||0);
    if(attempts<2){
      sessionStorage.setItem(key,String(attempts+1));
      setTimeout(()=>location.reload(),900);
    }else{
      sessionStorage.removeItem(key);
    }
  })();
<\/script>`;
}

function nyxIsscrRequest(event) {
  try {
    return new URL(event.request.url).pathname.startsWith(self.NYX_TUTSI_WORKER ? "/~/tm/" : "/~/sj/");
  } catch {
    return false;
  }
}

function nyxscrSourcePath(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const match = url.pathname.match(/^\/~\/(?:sj|tm)\/[^/]+\/[^/]+\/([^?#]*)/);
    if (!match) return "";
    return new URL(self.NyxProxyUrlCodec.decode(match[1])).pathname;
  } catch {
    return "";
  }
}

function nyxscrSourceUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const match = url.pathname.match(/^\/~\/(?:sj|tm)\/[^/]+\/[^/]+\/([^?#]*)/);
    if (!match) return "";
    return new URL(self.NyxProxyUrlCodec.decode(match[1])).href;
  } catch {
    return "";
  }
}

const nyxBlockedRequestHosts = [
  "pagead2.googlesyndication.com",
  "googlesyndication.com",
  "googleads.g.doubleclick.net",
  "doubleclick.net",
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "adservice.google.com",
  "adtrafficquality.google",
  "stats.g.doubleclick.net",
  "static.cloudflareinsights.com",
  "cloudflareinsights.com",
  "statcounter.com",
  "c.statcounter.com",
  "www.statcounter.com",
  "inmobi.com",
  "cmp.inmobi.com",
  "vntsm.com",
  "hb.vntsm.com",
  "facebook.net",
  "connect.facebook.net",
  "ads.emulatorjs.org",
  "cdn.r9x.in",
  "gamemonetize.com",
  "html5.api.gamedistribution.com",
  "imasdk.googleapis.com",
  "sdk.poki.com"
];

function nyxHostBlocked(hostname) {
  const host = String(hostname || "").toLowerCase();


  if (host === "cmp.inmobi.com" || host.endsWith(".cmp.inmobi.com")) return false;
  return nyxBlockedRequestHosts.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

function nyxShouldBlockscrRequest(event) {
  const source = nyxscrSourceUrl(event.request.url);
  if (!source) return false;
  try {
    const url = new URL(source);
    return nyxHostBlocked(url.hostname)
      || /(?:^|\/)(?:ads?|ad[-_.]?(?:loader|manager|script)|jump[_-]gamemonetize|poki-(?:master-loader|sdk))\.(?:js|mjs)(?:$|\/)/i.test(url.pathname)
      || (url.hostname === "serve.app.playsaurus.com" && /\/ad-campaigns\//i.test(url.pathname));
  } catch {
    return false;
  }
}

function nyxBlockedscrResponse(event) {
  const accept = event.request.headers.get("accept") || "";
  if (["script", "worker", "sharedworker"].includes(event.request.destination) || /javascript|ecmascript/i.test(accept)) {
    return new Response("", { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8" } });
  }
  if (event.request.destination === "style" || /text\/css/i.test(accept)) {
    return new Response("", { status: 200, headers: { "Content-Type": "text/css; charset=utf-8" } });
  }
  if (event.request.destination === "image") {
    return new Response("", { status: 204 });
  }
  if (event.request.destination === "document" || event.request.destination === "iframe") {
    return new Response("<!doctype html><meta charset=\"utf-8\">", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response(null, { status: 204 });
}

function nyxRequestExpectsAsset(event) {
  // Fetch/XHR APIs can end in .js and accept JavaScript while returning JSON.
  // Only browser-loaded executable resources are eligible for asset scrubbing.
  return ["script", "worker", "sharedworker", "style"].includes(event.request.destination);
}

function nyxEmptyAssetResponse(event) {
  const accept = event.request.headers.get("accept") || "";
  const path = new URL(event.request.url).pathname;
  const sourcePath = nyxscrSourcePath(event.request.url);
  const looksLikeScript = ["script", "worker", "sharedworker"].includes(event.request.destination)
    || /javascript|ecmascript/i.test(accept)
    || /\.(?:js|mjs|cjs|jq|hs|ohs)(?:$|[/?#])/i.test(path)
    || /\.(?:js|mjs|cjs|jq|hs|ohs)(?:$|[/?#])/i.test(sourcePath);
  if (looksLikeScript) {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "application/javascript; charset=utf-8" }
    });
  }
  if (event.request.destination === "style" || /text\/css/i.test(accept)) {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "text/css; charset=utf-8" }
    });
  }
  return null;
}

function nyxBadAssetBody(text) {
  return /^\s*</.test(text) || /^\s*\)\]\}'/.test(text) || /^\s*\)\]/.test(text);
}

async function nyxScrubAssetResponse(event, response) {
  if (!nyxRequestExpectsAsset(event)) return response;
  const contentType = response.headers.get("content-type") || "";
  if (response.status >= 400 || contentType.includes("text/html") || contentType.includes("application/json") || contentType.includes("text/json")) {
    return nyxEmptyAssetResponse(event) || response;
  }
  const text = await response.clone().text().catch(() => "");
  if (nyxBadAssetBody(text)) return nyxEmptyAssetResponse(event) || response;
  if (!text) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function nyxDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function nyxNotifyscrControllers() {
  if (nyxscrRevivePromise) return nyxscrRevivePromise;
  nyxscrRevivePromise = (async () => {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window"
    });
    for (const client of clients) {
      try {
        client.postMessage({ $controller$swrevive: {} });
      } catch {}
    }
    await nyxDelay(60);
  })().finally(() => {
    nyxscrRevivePromise = null;
  });
  return nyxscrRevivePromise;
}

async function nyxRouteAfterRevive(event) {
  const deadline = Date.now() + 7000;
  let nextNotifyAt = 0;
  while (Date.now() < deadline) {
    const now = Date.now();
    if (now >= nextNotifyAt) {
      await nyxNotifyscrControllers();
      nextNotifyAt = now + 500;
    }
    if ($scrController.shouldRoute(event)) {
      return nyxRoutescr(event);
    }
    await nyxDelay(100);
  }
  return new Response(nyxscrRouteMissHtml(), {
    status: 502,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function nyxRoutescr(event) {
  const response = await $scrController.route(event);
  return nyxScrubAssetResponse(event, response);
}

self.addEventListener("fetch", event => {
  if (!self.NYX_TUTSI_WORKER && nyxShouldBlockscrRequest(event)) {
    event.respondWith(nyxBlockedscrResponse(event));
    return;
  }
  if ($scrController.shouldRoute(event)) {
    event.respondWith(nyxRoutescr(event));
    return;
  }
  if (nyxIsscrRequest(event)) {
    event.respondWith(nyxRouteAfterRevive(event));
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    nyxNotifyscrControllers().catch(() => {})
  ]));
});

setTimeout(() => {
  nyxNotifyscrControllers().catch(() => {});
}, 120);
