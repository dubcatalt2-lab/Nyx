importScripts("/uv/uv.bundle.js");
importScripts("/uv.config.js");
importScripts("/uv/uv.sw.js");

const uvSessions = new Map();
const UV_ASSET_RETRY_DELAYS = [0, 180, 520];

const NYX_PROXY_PRIVACY_GUARD = `<script data-nyx-proxy-privacy>(${function () {
  if (globalThis.__nyxProxyPrivacyInstalled) return;
  globalThis.__nyxProxyPrivacyInstalled = true;
  const denied = Object.freeze({ code: 1, message: "Location access is disabled in Nyx private tabs." });
  const fail = callback => {
    if (typeof callback === "function") queueMicrotask(() => callback(denied));
  };
  const geolocation = Object.freeze({
    getCurrentPosition(_success, error) { fail(error); },
    watchPosition(_success, error) { fail(error); return 0; },
    clearWatch() {}
  });
  try { Object.defineProperty(Navigator.prototype, "geolocation", { configurable: true, get: () => geolocation }); } catch {}
  try { Object.defineProperty(navigator, "geolocation", { configurable: true, get: () => geolocation }); } catch {}
  const nativeQuery = navigator.permissions?.query?.bind(navigator.permissions);
  if (nativeQuery) {
    try {
      navigator.permissions.query = descriptor => {
        if (String(descriptor?.name || "").toLowerCase() === "geolocation") {
          const status = new EventTarget();
          Object.defineProperties(status, {
            state: { enumerable: true, value: "denied" },
            onchange: { configurable: true, writable: true, value: null }
          });
          return Promise.resolve(status);
        }
        return nativeQuery(descriptor);
      };
    } catch {}
  }
}.toString()})();<\/script>`;

function uvSessionDetails(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const match = url.pathname.match(/^\/service\/(nyx_[a-z0-9_-]{12,80})\//i);
    if (!match) return { id: "", prefix: self.__uv$config?.prefix || "/service/", dbName: "__op" };
    return {
      id: match[1],
      prefix: `/service/${match[1]}/`,
      dbName: `__nyx_uv_tab_${match[1]}`
    };
  } catch {
    return { id: "", prefix: self.__uv$config?.prefix || "/service/", dbName: "__op" };
  }
}

function uvForRequest(requestUrl) {
  const session = uvSessionDetails(requestUrl);
  const key = session.id || "legacy";
  let engine = uvSessions.get(key);
  if (!engine) {
    const inject = Array.isArray(self.__uv$config?.inject) ? [...self.__uv$config.inject] : [];
    inject.push({ host: ".*", injectTo: "head", html: NYX_PROXY_PRIVACY_GUARD });
    engine = new UVServiceWorker({
      ...self.__uv$config,
      prefix: session.prefix,
      cookieDbName: session.dbName,
      inject
    });
    uvSessions.set(key, engine);
  }
  return { engine, session };
}

function clearCookieDatabase(name) {
  return new Promise(resolve => {
    let request;
    try { request = indexedDB.open(name); } catch { resolve(false); return; }
    request.onerror = () => resolve(false);
    request.onupgradeneeded = () => {};
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("cookies")) {
        database.close();
        resolve(true);
        return;
      }
      const transaction = database.transaction("cookies", "readwrite");
      transaction.objectStore("cookies").clear();
      transaction.oncomplete = () => { database.close(); resolve(true); };
      transaction.onerror = () => { database.close(); resolve(false); };
      transaction.onabort = () => { database.close(); resolve(false); };
    };
  });
}

self.addEventListener("message", event => {
  const data = event.data;
  if (data?.type !== "nyx:destroy-proxy-session" || !/^nyx_[a-z0-9_-]{12,80}$/i.test(String(data.sessionId || ""))) return;
  const id = String(data.sessionId);
  uvSessions.delete(id);
  event.waitUntil?.(clearCookieDatabase(`__nyx_uv_tab_${id}`));
});

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

function proxiedSourceUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const prefix = uvSessionDetails(requestUrl).prefix;
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

function emptyNeutralizedScriptResponse(event) {
  const accept = event.request.headers.get("accept") || "";
  const path = new URL(event.request.url).pathname;
  const looksLikeScript = /\.(?:js|mjs|cjs|jq|hs|ohs)(?:$|[/?#])/i.test(path);
  if (["script", "worker", "sharedworker"].includes(event.request.destination) || /javascript|ecmascript/i.test(accept) || looksLikeScript) {
    return new Response("", {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
  return null;
}

function uvRequestIsStyle(event) {
  if (event.request.destination === "style") return true;
  const accept = event.request.headers.get("accept") || "";
  if (/text\/css/i.test(accept)) return true;
  try {
    return /\.css(?:$|[/?#])/i.test(new URL(proxiedSourceUrl(event.request.url)).pathname);
  } catch {
    return false;
  }
}

function uvRequestIsScript(event) {
  if (["script", "worker", "sharedworker"].includes(event.request.destination)) return true;
  const accept = event.request.headers.get("accept") || "";
  if (/javascript|ecmascript/i.test(accept)) return true;
  try {
    return /\.(?:js|mjs|cjs|jq|hs|ohs)(?:$|[/?#])/i.test(new URL(proxiedSourceUrl(event.request.url)).pathname);
  } catch {
    return false;
  }
}

function uvRequestIsRetryableAsset(event) {
  return uvRequestIsStyle(event) || uvRequestIsScript(event);
}

function uvResponseHasAssetMimeError(response) {
  const contentType = response?.headers?.get("content-type") || "";
  return /text\/html|application\/json|text\/json/i.test(contentType);
}

async function uvFetchWithAssetRetry(event, engine) {
  if (!uvRequestIsRetryableAsset(event)) return engine.fetch(event);
  let lastResponse = null;
  let lastError = null;
  for (let attempt = 0; attempt < UV_ASSET_RETRY_DELAYS.length; attempt += 1) {
    const delay = UV_ASSET_RETRY_DELAYS[attempt];
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    try {
      lastResponse = await engine.fetch(event);
      lastError = null;
      if (lastResponse.status < 400 && !uvResponseHasAssetMimeError(lastResponse)) {
        return lastResponse;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error("UV asset request failed");
}

async function patchUvUnityWorkerCallbacks(event, response) {
  if (!uvRequestIsScript(event) || response.status >= 400) return response;
  let source;
  try {
    source = new URL(proxiedSourceUrl(event.request.url));
  } catch {
    return response;
  }
  if (!/unityloader\.js$/i.test(source.pathname)) return response;
  const text = await response.clone().text().catch(() => "");
  const brokenLookup = "this.callbacks[__uv.$wrap((e.data.id))]";
  if (!text.includes(brokenLookup)) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("cache-control", "no-store");
  const brokenCall = `${brokenLookup}(e.data.decompressed)`;
  const guardedCall = '(typeof this.callbacks[e.data.id]==="function"&&this.callbacks[e.data.id](e.data.decompressed))';
  const patched = text
    .replaceAll(brokenCall, guardedCall)
    .replaceAll(brokenLookup, "this.callbacks[e.data.id]");
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
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
  const { engine } = uvForRequest(event.request.url);
  if (shouldNeutralizeUvScript(event)) {
    return emptyNeutralizedScriptResponse(event);
  }
  const response = await patchUvUnityWorkerCallbacks(event, await uvFetchWithAssetRetry(event, engine));
  if (response.status >= 400) {
    try {
      console.warn("[nyx UV upstream error]", response.status, event.request.method, proxiedSourceUrl(event.request.url) || event.request.url);
    } catch {}
  }
  const contentType = response.headers.get("content-type") || "";
  const expectsAsset = uvRequestExpectsAsset(event);
  const badAssetMime = expectsAsset
    && (contentType.includes("text/html") || contentType.includes("application/json") || contentType.includes("text/json"));
  if (expectsAsset && badAssetMime) {
    return Response.error();
  }
  if (expectsAsset && response.status >= 400) {
    return response;
  }
  if (expectsAsset) {
    const text = await response.clone().text().catch(() => "");
    if (badAssetBody(text)) {
      return Response.error();
    }
  }
  if (!["document", "iframe", "frame"].includes(event.request.destination)) {
    return response;
  }
  return response;
}

self.addEventListener("fetch", event => {
  event.respondWith(nyxUvFetch(event).catch(() => Response.error()));
});
