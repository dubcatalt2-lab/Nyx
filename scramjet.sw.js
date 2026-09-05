importScripts("/controller/controller.sw.js?v=20260905-cookie-owner-v1");

let nyxScramjetRevivePromise = null;

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

function nyxScramjetRouteMissHtml() {
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
  <h1>Reconnecting Scramjet</h1>
  <p>Nyx is reconnecting this tab to the proxy service worker.</p>
  <button type="button" onclick="location.reload()">Retry now</button>
</main>
<script>
  (() => {
    const key='nyx.scramjet-route-retry:'+location.pathname;
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

function nyxIsScramjetRequest(event) {
  try {
    return new URL(event.request.url).pathname.startsWith("/~/sj/");
  } catch {
    return false;
  }
}

function nyxScramjetSourcePath(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const match = url.pathname.match(/^\/~\/sj\/[^/]+\/[^/]+\/([^?#]*)/);
    if (!match) return "";
    return new URL(decodeURIComponent(match[1])).pathname;
  } catch {
    return "";
  }
}

function nyxScramjetSourceUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const match = url.pathname.match(/^\/~\/sj\/[^/]+\/[^/]+\/([^?#]*)/);
    if (!match) return "";
    return new URL(decodeURIComponent(match[1])).href;
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
  return nyxBlockedRequestHosts.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

function nyxShouldBlockScramjetRequest(event) {
  const source = nyxScramjetSourceUrl(event.request.url);
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

function nyxBlockedScramjetResponse(event) {
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
  const accept = event.request.headers.get("accept") || "";
  const path = new URL(event.request.url).pathname;
  const sourcePath = nyxScramjetSourcePath(event.request.url);
  return ["script", "worker", "sharedworker", "style"].includes(event.request.destination)
    || /javascript|ecmascript|text\/css/i.test(accept)
    || /\.(?:js|mjs|cjs|css|jq|hs|ohs)(?:$|[/?#])/i.test(path)
    || /\.(?:js|mjs|cjs|css|jq|hs|ohs)(?:$|[/?#])/i.test(sourcePath);
}

function nyxEmptyAssetResponse(event) {
  const accept = event.request.headers.get("accept") || "";
  const path = new URL(event.request.url).pathname;
  const sourcePath = nyxScramjetSourcePath(event.request.url);
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

async function nyxNotifyScramjetControllers() {
  if (nyxScramjetRevivePromise) return nyxScramjetRevivePromise;
  nyxScramjetRevivePromise = (async () => {
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
    nyxScramjetRevivePromise = null;
  });
  return nyxScramjetRevivePromise;
}

async function nyxRouteAfterRevive(event) {
  const deadline = Date.now() + 7000;
  let nextNotifyAt = 0;
  while (Date.now() < deadline) {
    const now = Date.now();
    if (now >= nextNotifyAt) {
      await nyxNotifyScramjetControllers();
      nextNotifyAt = now + 500;
    }
    if ($scramjetController.shouldRoute(event)) {
      return nyxRouteScramjet(event);
    }
    await nyxDelay(100);
  }
  return new Response(nyxScramjetRouteMissHtml(), {
    status: 502,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function nyxRouteScramjet(event) {
  const response = await $scramjetController.route(event);
  return nyxScrubAssetResponse(event, response);
}

self.addEventListener("fetch", event => {
  if (nyxShouldBlockScramjetRequest(event)) {
    event.respondWith(nyxBlockedScramjetResponse(event));
    return;
  }
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith(nyxRouteScramjet(event));
    return;
  }
  if (nyxIsScramjetRequest(event)) {
    event.respondWith(nyxRouteAfterRevive(event));
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    nyxNotifyScramjetControllers().catch(() => {})
  ]));
});

setTimeout(() => {
  nyxNotifyScramjetControllers().catch(() => {});
}, 120);
