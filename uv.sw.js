importScripts("/uv/uv.bundle.js");
importScripts("/uv.config.js");
importScripts("/uv/uv.sw.js");

const uv = new UVServiceWorker();

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

function proxiedSourceUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const prefix = self.__uv$config?.prefix || "/service/";
    if (!url.pathname.startsWith(prefix)) return "";
    return self.__uv$config.decodeUrl(url.pathname.slice(prefix.length));
  } catch {
    return "";
  }
}

function shouldNeutralizeUvScript(event) {
  if (!["script", "worker", "sharedworker"].includes(event.request.destination)) return false;
  try {
    const source = new URL(proxiedSourceUrl(event.request.url));
    return source.hostname.endsWith("cookielaw.org") ||
      source.hostname.endsWith("onetrust.com");
  } catch {
    return false;
  }
}

function emptyUvAssetResponse(event, reason = "") {
  const accept = event.request.headers.get("accept") || "";
  const path = new URL(event.request.url).pathname;
  const looksLikeScript = /\.(?:js|mjs|cjs|jq|hs|ohs)(?:$|[/?#])/i.test(path);
  if (["script", "worker", "sharedworker"].includes(event.request.destination) || /javascript|ecmascript/i.test(accept) || looksLikeScript) {
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

function uvRequestExpectsAsset(event) {
  const accept = event.request.headers.get("accept") || "";
  const path = new URL(event.request.url).pathname;
  let sourcePath = "";
  try {
    sourcePath = new URL(proxiedSourceUrl(event.request.url)).pathname;
  } catch {}
  return ["script", "worker", "sharedworker", "style"].includes(event.request.destination)
    || /javascript|ecmascript|text\/css/i.test(accept)
    || /\.(?:js|mjs|cjs|css|jq|hs|ohs)(?:$|[/?#])/i.test(path)
    || /\.(?:js|mjs|cjs|css|jq|hs|ohs)(?:$|[/?#])/i.test(sourcePath);
}

function badAssetBody(text) {
  return /^\s*</.test(text) || /^\s*\)\]\}'/.test(text) || /^\s*\)\]/.test(text);
}

async function nyxUvFetch(event) {
  if (shouldNeutralizeUvScript(event)) {
    return emptyUvAssetResponse(event);
  }
  const response = await uv.fetch(event);
  if (response.status >= 400) {
    try {
      console.warn("[nyx UV upstream error]", response.status, event.request.method, proxiedSourceUrl(event.request.url) || event.request.url);
    } catch {}
  }
  const contentType = response.headers.get("content-type") || "";
  const expectsAsset = uvRequestExpectsAsset(event);
  const badAssetMime = expectsAsset
    && (contentType.includes("text/html") || contentType.includes("application/json") || contentType.includes("text/json"));
  const emptyAsset = (response.status >= 400 || badAssetMime) ? emptyUvAssetResponse(event) : null;
  if (emptyAsset) return emptyAsset;
  if (expectsAsset) {
    const text = await response.clone().text().catch(() => "");
    if (badAssetBody(text)) return emptyUvAssetResponse(event, "bad script body") || response;
    if (text) {
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
  }
  if (!["document", "iframe", "frame"].includes(event.request.destination)) {
    return response;
  }
  return response;
}

self.addEventListener("fetch", event => {
  event.respondWith(nyxUvFetch(event).catch(() => emptyUvAssetResponse(event) || Response.error()));
});
