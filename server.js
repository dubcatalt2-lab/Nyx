import express from "express";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

// Using the process root keeps this file compatible with Netlify's CommonJS
// function bundle while preserving normal `node server.js` behavior.
const __dirname = resolve(process.env.NYX_PROJECT_ROOT || process.cwd());
const require = createRequire(join(__dirname, "package.json"));
const { uvPath } = require("@titaniumnetwork-dev/ultraviolet");
const { baremuxPath } = require("@mercuryworkshop/bare-mux/node");
const { scramjetPath } = require("@mercuryworkshop/scramjet/path");
const scramjetControllerPath = dirname(require.resolve("@mercuryworkshop/scramjet-controller"));
const epoxyPath = join(dirname(require.resolve("@mercuryworkshop/epoxy-transport")), "..", "dist");
const libcurlPath = dirname(require.resolve("@mercuryworkshop/libcurl-transport"));
const erudaPath = require.resolve("eruda");
let cinebyAppCache = { source: "", expires: 0 };
const gameCoverLookupCache = new Map();
const app = express();

function normalizePublicWispUrl(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const url = new URL(raw);
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return "";
    if (!url.pathname || url.pathname === "/") url.pathname = "/wisp/";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

const externalWispUrl = normalizePublicWispUrl(process.env.WISP_URL);
const presenceSessions = new Map();
const presenceTtlMs = 45_000;
const linkGeneratorAttempts = new Map();
const linkGeneratorWindowMs = 15 * 60 * 1000;
const linkGeneratorCooldownMs = 10 * 60 * 1000;
const linkGeneratorMaxAttempts = 5;
app.use(express.json({ limit: "2mb" }));
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Invalid JSON request body." });
    return;
  }
  next(error);
});
const uvHandlerPath = join(uvPath, "uv.handler.js");
const uvBundlePath = join(uvPath, "uv.bundle.js");
const baremuxIndexPath = join(baremuxPath, "index.mjs");
const scramjetRuntimePath = join(scramjetPath, "scramjet.js");

app.use((req, res, next) => {
  const noStorePaths = new Set([
    "/",
    "/index.html",
    "/script.js",
    "/startup.js",
    "/styles.css",
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
  const noStorePrefix = /^\/(?:assets\/(?:gms-games|reds-misc)\/|gms-games-|reds-misc-)/i.test(req.path);
  if (noStorePaths.has(req.path) || noStorePrefix) {
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

function gameTitleKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(?:online|unblocked|play|game)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 100);
}

function gameCoverResultScore(page, titleKey) {
  if (!page?.thumbnail?.source) return -Infinity;
  const pageKey = gameTitleKey(page.title);
  const description = String(page.terms?.description?.[0] || "").toLowerCase();
  const isExactTitle = pageKey === titleKey;
  const isGameArticle = /video game|browser game|arcade game|platform game|puzzle game|sports game|racing game/.test(description);
  if (!isExactTitle && !isGameArticle) return -Infinity;
  let score = 0;
  if (isExactTitle) score += 100;
  else if (pageKey.includes(titleKey) || titleKey.includes(pageKey)) score += 55;
  if (isGameArticle) score += 45;
  if (/film|album|song|novel|television|company|person/.test(description)) score -= 60;
  return score;
}

async function findOnlineGameCover(title) {
  const cleanTitle = String(title || "").replace(/\s+/g, " ").trim().slice(0, 90);
  const titleKey = gameTitleKey(cleanTitle);
  if (!cleanTitle || !titleKey) return "";
  if (gameCoverLookupCache.has(titleKey)) return gameCoverLookupCache.get(titleKey);
  const lookup = (async () => {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      generator: "search",
      gsrsearch: `${cleanTitle} video game`,
      gsrnamespace: "0",
      gsrlimit: "6",
      prop: "pageimages|pageterms",
      piprop: "thumbnail",
      pithumbsize: "512",
      pilimit: "6",
      wbptterms: "description",
      redirects: "1"
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: {
        "accept": "application/json",
        "user-agent": "nyx-local-game-library/1.0"
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return "";
    const payload = await response.json();
    const pages = Array.isArray(payload?.query?.pages) ? payload.query.pages : [];
    const match = pages
      .map(page => ({ page, score: gameCoverResultScore(page, titleKey) }))
      .filter(result => result.score >= 40)
      .sort((a, b) => b.score - a.score)[0]?.page;
    const source = String(match?.thumbnail?.source || "");
    try {
      const imageUrl = new URL(source);
      return imageUrl.protocol === "https:" && imageUrl.hostname === "upload.wikimedia.org" ? imageUrl.href : "";
    } catch {
      return "";
    }
  })().catch(() => "");
  gameCoverLookupCache.set(titleKey, lookup);
  return lookup;
}

app.get("/game-cover", async (req, res) => {
  const title = String(req.query.title || "");
  if (!title.trim() || title.length > 100) {
    res.status(400).type("text/plain").send("Invalid game title");
    return;
  }
  const cover = await findOnlineGameCover(title);
  if (!cover) {
    res.status(404).type("text/plain").send("No online cover found");
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.redirect(302, cover);
});

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

function patchedUvBundle() {
  const source = readFileSync(uvBundlePath, "utf8");
  const original = "rewriteImport(t,r,n=this.meta){return this.rewriteUrl(t,{...n,base:r})}";
  const patched = "rewriteImport(t,r,n=this.meta){return this.rewriteUrl(r,{...n,base:t})}";
  if (!source.includes(original)) throw new Error("Ultraviolet dynamic import signature changed");
  return source.replace(original, patched);
}

function patchedScramjetRuntime() {
  const source = readFileSync(scramjetRuntimePath, "utf8");
  const original = 'if(u.origin===new i.xP(e.rawUrl).origin)throw new i.$D("attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting");';
  const patched = 'if(u.origin===new i.xP(e.rawUrl).origin&&u.pathname.startsWith(t.context.prefix.pathname))u=new i.xP((0,n.v2)(u,t.context));else if(u.origin===new i.xP(e.rawUrl).origin)throw new i.$D("attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting");';
  return source.includes(original) ? source.replace(original, patched) : source;
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
  try {
    if (!window.__nyxRuntimeShortcuts) {
      window.__nyxRuntimeShortcuts = true;
      const isEditingTarget = target => !!(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || "")));
      const selectedTextFromTarget = target => {
        try {
          if (/^(INPUT|TEXTAREA)$/i.test(target?.tagName || "")) return String(target.value || "").slice(target.selectionStart || 0, target.selectionEnd || 0);
          return String(getSelection?.() || "");
        } catch {
          return "";
        }
      };
      const replaceSelectionInTarget = (target, text) => {
        try {
          if (/^(INPUT|TEXTAREA)$/i.test(target?.tagName || "")) {
            const start = target.selectionStart || 0;
            const end = target.selectionEnd || 0;
            const value = String(target.value || "");
            target.value = value.slice(0, start) + text + value.slice(end);
            const cursor = start + String(text).length;
            target.setSelectionRange(cursor, cursor);
            target.dispatchEvent(new Event("input", { bubbles: true }));
            return;
          }
          document.execCommand?.("insertText", false, text);
        } catch {}
      };
      const writeClipboard = async text => {
        try {
          await navigator.clipboard?.writeText(String(text || ""));
        } catch {
          try { document.execCommand?.("copy"); } catch {}
        }
      };
      const shortcutParent = (() => { try { return window.parent; } catch { return null; } })();
      const shortcutTop = (() => { try { return window.top; } catch { return null; } })();
      const postAltShortcut = payload => {
        try { shortcutParent?.postMessage(payload, "*"); } catch {}
        try {
          if (shortcutTop && shortcutTop !== shortcutParent) shortcutTop.postMessage(payload, "*");
        } catch {}
        try { window.parent?.postMessage(payload, "*"); } catch {}
        try {
          if (window.top && window.top !== window.parent) window.top.postMessage(payload, "*");
        } catch {}
      };
      window.addEventListener("keydown", event => {
        const key = String(event.key || "").toLowerCase();
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.location !== 2 && key === "alt") {
          event.preventDefault();
          event.stopPropagation();
          postAltShortcut({ type: "nyx:alt-prime" });
          return;
        }
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.location !== 2 && isEditingTarget(event.target) && /^[acxvzy]$/.test(key)) {
          event.preventDefault();
          event.stopPropagation();
          if (key === "a") {
            if (event.target?.select) event.target.select();
            else document.execCommand?.("selectAll");
            return;
          }
          if (key === "c") {
            writeClipboard(selectedTextFromTarget(event.target));
            return;
          }
          if (key === "x") {
            const selected = selectedTextFromTarget(event.target);
            writeClipboard(selected);
            replaceSelectionInTarget(event.target, "");
            return;
          }
          if (key === "v") {
            navigator.clipboard?.readText?.().then(text => replaceSelectionInTarget(event.target, text)).catch(() => {
              try { document.execCommand?.("paste"); } catch {}
            });
            return;
          }
          if (key === "z") {
            document.execCommand?.("undo");
            return;
          }
          if (key === "y") {
            document.execCommand?.("redo");
            return;
          }
        }
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.location !== 2 && (/^[1-9]$/.test(key) || ["l", "d", "t", "w", "r", "arrowleft", "arrowright", "tab"].includes(key))) {
          event.preventDefault();
          event.stopPropagation();
          postAltShortcut({ type: "nyx:alt-shortcut", key, code: event.code || "", location: event.location || 0, shiftKey: !!event.shiftKey });
          return;
        }
      }, true);
    }
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

function safeSeraphAssetPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || !/^[a-z0-9_./?&=%-]+$/i.test(clean)) return "";
  return clean;
}

function rewriteSeraphCss(css, assetPath) {
  const base = new URL(String(assetPath || ""), "https://seraph.local/");
  return String(css || "").replace(/url\(\s*(["']?)(?![a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)([^"')]+)\1\s*\)/gi, (match, quote, raw) => {
    try {
      const resolved = new URL(String(raw || "").trim(), base).pathname.replace(/^\/+/, "");
      return `url(${quote}/seraph-asset?path=${encodeURIComponent(resolved)}${quote})`;
    } catch {
      return match;
    }
  });
}

app.get("/seraph-asset", async (req, res) => {
  const path = safeSeraphAssetPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid Seraph asset path");
    return;
  }
  const upstreamUrl = `https://cdn.jsdelivr.net/gh/a456pur/seraph@main/${path}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "accept": "*/*",
        "user-agent": "nyx/1.0"
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).type("text/plain").send(`Seraph asset returned ${upstream.status}`);
      return;
    }
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(/text\/css/i.test(contentType || "") || /\.css(?:$|\?)/i.test(path) ? Buffer.from(rewriteSeraphCss(buffer.toString("utf8"), path)) : buffer);
  } catch (error) {
    res.status(502).type("text/plain").send(`Seraph asset network error: ${error?.message || error}`);
  }
});

const gnMathGamesCache = { timestamp: 0, games: [] };
const gnMathTitleCache = new Map();
const gnMathRepos = new Set(["html", "covers", "assets"]);

function safeGnMathPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || !/^[a-z0-9_./?&=%-]+$/i.test(clean)) return "";
  return clean;
}

function safeGnMathHtmlPath(path) {
  const clean = safeGnMathPath(path);
  if (!clean || !/^[a-z0-9_.-]+\.html$/i.test(clean)) return "";
  return clean;
}

function gnMathCoverName(path) {
  const id = String(path || "").match(/^\d+/)?.[0];
  return id ? `${id}.png` : "";
}

function extractTitle(html, fallback) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? match[1].replace(/\s+/g, " ").trim() : "";
  return title || fallback;
}

async function fetchText(url, headers = {}) {
  const upstream = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "nyx/1.0",
      ...headers
    }
  });
  if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
  return upstream.text();
}

app.get("/gn-math-games", async (_req, res) => {
  const now = Date.now();
  if (gnMathGamesCache.games.length && now - gnMathGamesCache.timestamp < 10 * 60 * 1000) {
    res.json({ games: gnMathGamesCache.games });
    return;
  }
  try {
    const [htmlResponse, coverResponse] = await Promise.all([
      fetch("https://api.github.com/repos/gn-math/html/contents/", {
        headers: { "accept": "application/vnd.github+json", "user-agent": "nyx/1.0" }
      }),
      fetch("https://api.github.com/repos/gn-math/covers/contents/", {
        headers: { "accept": "application/vnd.github+json", "user-agent": "nyx/1.0" }
      })
    ]);
    if (!htmlResponse.ok) throw new Error(`HTML HTTP ${htmlResponse.status}`);
    if (!coverResponse.ok) throw new Error(`Covers HTTP ${coverResponse.status}`);
    const items = await htmlResponse.json();
    const covers = new Set((await coverResponse.json())
      .filter(item => item?.type === "file")
      .map(item => item.name));
    const games = (Array.isArray(items) ? items : [])
      .filter(item => item?.type === "file" && /\.html?$/i.test(item.name))
      .map(item => {
        const cover = gnMathCoverName(item.name);
        return {
          path: item.name,
          title: gnMathTitleCache.get(item.name) || "",
          cover: cover && covers.has(cover) ? `/gn-math-asset?repo=covers&path=${encodeURIComponent(cover)}` : ""
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    gnMathGamesCache.timestamp = now;
    gnMathGamesCache.games = games;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ games });
  } catch (error) {
    res.status(502).json({ error: `GN Math list network error: ${error?.message || error}` });
  }
});

app.get("/gn-math-title", async (req, res) => {
  const path = safeGnMathHtmlPath(req.query.path);
  if (!path) {
    res.status(400).json({ error: "Invalid GN Math path" });
    return;
  }
  if (gnMathTitleCache.has(path)) {
    res.json({ title: gnMathTitleCache.get(path) });
    return;
  }
  try {
    const html = await fetchText(`https://raw.githubusercontent.com/gn-math/html/main/${path}`);
    const title = extractTitle(html, "");
    if (title) gnMathTitleCache.set(path, title);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json({ title });
  } catch (error) {
    res.status(502).json({ error: `GN Math title network error: ${error?.message || error}` });
  }
});

app.get("/gn-math-fetch", async (req, res) => {
  const path = safeGnMathHtmlPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid GN Math path");
    return;
  }
  try {
    const html = await fetchText(`https://raw.githubusercontent.com/gn-math/html/main/${path}`);
    const title = extractTitle(html, "");
    if (title) gnMathTitleCache.set(path, title);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("html").send(html);
  } catch (error) {
    res.status(502).type("text/plain").send(`GN Math network error: ${error?.message || error}`);
  }
});

app.get("/gn-math-asset", async (req, res) => {
  const repo = String(req.query.repo || "");
  const path = safeGnMathPath(req.query.path);
  if (!gnMathRepos.has(repo) || !path) {
    res.status(400).type("text/plain").send("Invalid GN Math asset path");
    return;
  }
  try {
    const upstream = await fetch(`https://raw.githubusercontent.com/gn-math/${repo}/main/${path}`, {
      headers: {
        "accept": "*/*",
        "user-agent": "nyx/1.0"
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).type("text/plain").send(`GN Math asset returned ${upstream.status}`);
      return;
    }
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).type("text/plain").send(`GN Math asset network error: ${error?.message || error}`);
  }
});

const gnMathProxyHosts = new Set([
  "cdn.jsdelivr.net",
  "raw.githubusercontent.com",
  "rawcdn.githack.com",
  "raw.githack.com"
]);

function safeGnMathProxyUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!gnMathProxyHosts.has(url.hostname)) return null;
    if (/(?:googletagmanager|google-analytics|googlesyndication|doubleclick|facebook|recaptcha|pagead|cdn\.r9x\.in)/i.test(url.href)) return null;
    return url;
  } catch {
    return null;
  }
}

async function directProxyFetch(url) {
  let upstream;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      upstream = await fetch(url, {
        headers: {
          "accept": "*/*",
          "user-agent": "nyx/1.0"
        }
      });
      if (upstream.ok || ![429, 500, 502, 503, 504].includes(upstream.status)) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 180 + attempt * 260));
  }
  if (!upstream && lastError) throw lastError;
  if (!upstream.ok) {
    const error = new Error(`HTTP ${upstream.status}`);
    error.status = upstream.status;
    throw error;
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  return {
    body,
    contentType: upstream.headers.get("content-type") || "application/octet-stream",
    cacheControl: "no-store"
  };
}

app.get("/gn-math-proxy", async (req, res) => {
  const url = safeGnMathProxyUrl(req.query.url);
  if (!url) {
    res.status(400).type("text/plain").send("Invalid GN Math proxy URL");
    return;
  }
  try {
    const result = await directProxyFetch(url);
    res.setHeader("Cache-Control", result.cacheControl);
    res.type(result.contentType);
    res.send(result.body);
  } catch (error) {
    res.status(error?.status || 502).type("text/plain").send(`GN Math proxy error: ${error?.message || error}`);
  }
});

const redsMiscProxyHosts = new Set([
  "raw.githubusercontent.com",
  "cdn.jsdelivr.net",
  "rawcdn.githack.com",
  "raw.githack.com"
]);

function safeRedsMiscPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (
    !/^misc\/[a-z0-9_.() -]+(?:\/[a-z0-9_.() -]+)*\.html?$/i.test(clean) ||
    clean.includes("..") ||
    clean.includes("\\")
  ) return "";
  return clean;
}

function safeRedsMiscProxyUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const isGithubPages = url.hostname === "github.io" || url.hostname.endsWith(".github.io");
    if (!redsMiscProxyHosts.has(url.hostname) && !isGithubPages) return null;
    if (url.hostname === "raw.githubusercontent.com") {
      const allowed = /^\/isaacduh123\/reds-exploit-corner\/main\//i.test(url.pathname);
      if (!allowed) return null;
    }
    if (/(?:googletagmanager|google-analytics|googlesyndication|doubleclick|facebook|recaptcha|pagead|cdn\.r9x\.in)/i.test(url.href)) return null;
    return url;
  } catch {
    return null;
  }
}

function rewriteGmsCssUrls(buffer, baseUrl) {
  const css = buffer.toString("utf8");
  return Buffer.from(css.replace(/url\(\s*(["']?)(?![a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)([^"')]+)\1\s*\)/gi, (_match, quote, raw) => {
    try {
      const next = new URL(String(raw || "").trim(), baseUrl).href;
      return `url(${quote}/gms-games-proxy?url=${encodeURIComponent(next)}${quote})`;
    } catch {
      return _match;
    }
  }), "utf8");
}

async function handleGmsGamesFetch(req, res) {
  const path = safeRedsMiscPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid GMS path");
    return;
  }
  try {
    const url = new URL(`https://raw.githubusercontent.com/isaacduh123/reds-exploit-corner/main/${path}`);
    const result = await directProxyFetch(url);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(result.body);
  } catch (error) {
    res.status(error?.status || 502).type("text/plain").send(`GMS network error: ${error?.message || error}`);
  }
}

async function handleGmsGamesProxy(req, res) {
  const url = safeRedsMiscProxyUrl(req.query.url);
  if (!url) {
    res.status(400).type("text/plain").send("Invalid GMS proxy URL");
    return;
  }
  try {
    const result = await directProxyFetch(url);
    const isCss = /text\/css/i.test(result.contentType) || /\.css(?:$|\?)/i.test(url.pathname);
    const body = isCss ? rewriteGmsCssUrls(result.body, url.href) : result.body;
    res.setHeader("Cache-Control", result.cacheControl);
    res.type(result.contentType);
    res.send(body);
  } catch (error) {
    res.status(error?.status || 502).type("text/plain").send(`GMS proxy error: ${error?.message || error}`);
  }
}

app.get("/gms-games-fetch", handleGmsGamesFetch);
app.get("/gms-games-proxy", handleGmsGamesProxy);
app.get("/reds-misc-fetch", handleGmsGamesFetch);
app.get("/reds-misc-proxy", handleGmsGamesProxy);

const nyxAiModels = {
  "llama-3.3-70b": process.env.NYX_AI_MODEL_LLAMA_33_70B || "meta-llama/llama-3.3-70b-instruct",
  "gpt-oss-120b": process.env.NYX_AI_MODEL_GPT_OSS_120B || "openai/gpt-oss-120b",
  "qwen3-32b": process.env.NYX_AI_MODEL_QWEN3_32B || "qwen/qwen3-32b",
  "llama-4-scout": process.env.NYX_AI_MODEL_LLAMA_4_SCOUT || "meta-llama/llama-4-scout",
  "chatgpt-5.4-mini": process.env.NYX_AI_MODEL_CHATGPT_54_MINI || "openai/gpt-5.4-mini"
};

function nyxAiKey() {
  return process.env.NYX_AI_API_KEY || process.env.OPENROUTER_API_KEY || "";
}

const nyxAiUsage = new Map();
let nyxAiActiveRequests = 0;
const nyxAiLimit = (name, fallback) => {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const nyxAiLimits = {
  minute: nyxAiLimit("NYX_AI_REQUESTS_PER_MINUTE", 6),
  daily: nyxAiLimit("NYX_AI_REQUESTS_PER_DAY", 60),
  perIpConcurrent: nyxAiLimit("NYX_AI_CONCURRENT_PER_IP", 2),
  globalConcurrent: nyxAiLimit("NYX_AI_CONCURRENT_GLOBAL", 3),
  promptChars: nyxAiLimit("NYX_AI_MAX_PROMPT_CHARS", 4000),
  contextChars: nyxAiLimit("NYX_AI_MAX_CONTEXT_CHARS", 24000),
  timeoutMs: nyxAiLimit("NYX_AI_TIMEOUT_MS", 45000)
};

function nyxAiClientId(req) {
  const forwarded = process.env.NYX_TRUST_PROXY === "true"
    ? String(req.get("cf-connecting-ip") || req.get("x-forwarded-for") || "").split(",")[0].trim()
    : "";
  return forwarded || req.socket.remoteAddress || "unknown";
}

function nyxAiRateLimit(req, res, next) {
  const now = Date.now();
  const clientId = nyxAiClientId(req);
  const usage = nyxAiUsage.get(clientId) || { minute: [], day: [], active: 0, seen: now };
  usage.minute = usage.minute.filter(time => now - time < 60_000);
  usage.day = usage.day.filter(time => now - time < 86_400_000);
  usage.seen = now;
  nyxAiUsage.set(clientId, usage);
  res.setHeader("x-ratelimit-limit-minute", nyxAiLimits.minute);
  res.setHeader("x-ratelimit-remaining-minute", Math.max(0, nyxAiLimits.minute - usage.minute.length));
  res.setHeader("x-ratelimit-limit-day", nyxAiLimits.daily);
  res.setHeader("x-ratelimit-remaining-day", Math.max(0, nyxAiLimits.daily - usage.day.length));
  if (usage.minute.length >= nyxAiLimits.minute || usage.day.length >= nyxAiLimits.daily) {
    const retryAfter = usage.minute.length >= nyxAiLimits.minute
      ? Math.max(1, Math.ceil((60_000 - (now - usage.minute[0])) / 1000))
      : Math.max(1, Math.ceil((86_400_000 - (now - usage.day[0])) / 1000));
    res.setHeader("retry-after", retryAfter);
    res.status(429).json({ error: "Nyx AI usage limit reached. Please try again later." });
    return;
  }
  if (usage.active >= nyxAiLimits.perIpConcurrent || nyxAiActiveRequests >= nyxAiLimits.globalConcurrent) {
    res.setHeader("retry-after", "10");
    res.status(429).json({ error: "Nyx AI is busy. Please wait for another response to finish." });
    return;
  }
  usage.minute.push(now);
  usage.day.push(now);
  usage.active += 1;
  nyxAiActiveRequests += 1;
  let released = false;
  req.nyxAiRelease = () => {
    if (released) return;
    released = true;
    usage.active = Math.max(0, usage.active - 1);
    nyxAiActiveRequests = Math.max(0, nyxAiActiveRequests - 1);
  };
  res.once("close", req.nyxAiRelease);
  res.once("finish", req.nyxAiRelease);
  next();
}

setInterval(() => {
  const cutoff = Date.now() - 86_400_000;
  for (const [clientId, usage] of nyxAiUsage) {
    if (!usage.active && usage.seen < cutoff) nyxAiUsage.delete(clientId);
  }
}, 3_600_000).unref();

app.post("/api/nyx-ai", nyxAiRateLimit, async (req, res) => {
  const key = nyxAiKey();
  if (!key) {
    res.status(503).json({
      error: "Nyx AI is not configured. Set NYX_AI_API_KEY or OPENROUTER_API_KEY in the server environment."
    });
    return;
  }
  const requestedModel = String(req.body?.model || "llama-3.3-70b");
  const model = nyxAiModels[requestedModel];
  if (!model) {
    res.status(400).json({ error: "Unknown Nyx AI model." });
    return;
  }
  const message = String(req.body?.message || "").trim();
  const imageContext = String(req.body?.imageContext || "").trim();
  if (message.length > nyxAiLimits.promptChars) {
    res.status(413).json({ error: `Message is too long. The limit is ${nyxAiLimits.promptChars} characters.` });
    return;
  }
  const history = Array.isArray(req.body?.messages)
    ? req.body.messages.slice(-20).map(item => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: String(item?.content || "").slice(0, 12000)
      })).filter(item => item.content.trim())
    : [];
  let contextChars = imageContext.length;
  for (const item of history) contextChars += item.content.length;
  if (contextChars > nyxAiLimits.contextChars) {
    res.status(413).json({ error: "This conversation is too long. Clear the chat and try again." });
    return;
  }
  if (!message && !imageContext && !history.length) {
    res.status(400).json({ error: "Message is required." });
    return;
  }
  const baseUrl = String(process.env.NYX_AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const prompt = imageContext ? `${message || "Answer the attached image."}\n\nImage context from Nyx OCR/analysis:\n${imageContext}` : message;
  const messages = history.length ? history : [{ role: "user", content: prompt }];
  if (history.length && imageContext) messages[messages.length - 1] = { role: "user", content: prompt };
  const wantsStream = req.body?.stream !== false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), nyxAiLimits.timeoutMs);
  res.once("close", () => controller.abort());
  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${key}`,
        "http-referer": process.env.NYX_SITE_URL || "http://localhost:8080",
        "x-title": "Nyx AI"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are Nyx AI inside the Nyx browser. Be helpful, direct, and accurate. If you do not know something, say so plainly."
          },
          ...messages
        ],
        temperature: Number(process.env.NYX_AI_TEMPERATURE || 0.7),
        max_tokens: Number(process.env.NYX_AI_MAX_TOKENS || 1200),
        stream: wantsStream
      })
    });
    if (wantsStream && upstream.ok) {
      res.status(200);
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.flushHeaders?.();
      const reader = upstream.body?.getReader();
      if (!reader) throw new Error("AI provider did not return a response stream.");
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
      return;
    }
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: data?.error?.message || data?.message || `Model request failed (${upstream.status}).`
      });
      return;
    }
    const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    res.json({ text: String(text || "").trim(), model });
  } catch (error) {
    if (!res.headersSent) {
      const timedOut = error?.name === "AbortError";
      res.status(timedOut ? 504 : 502).json({ error: timedOut ? "Nyx AI timed out. Please try again." : `Nyx AI request failed: ${error?.message || error}` });
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    clearTimeout(timeout);
    req.nyxAiRelease?.();
  }
});

app.use((req, res, next) => {
  const referer = String(req.get("referer") || "");
  const fromGmsRunner = /\/assets\/(?:gms-games|reds-misc)\/play\.html/i.test(referer);
  if (fromGmsRunner && (req.path === "/" || req.path === "/index.html")) {
    res.status(409).type("html").send(`<!doctype html>
<meta charset="utf-8">
<title>GMS navigation blocked</title>
<style>
  html,body{margin:0;width:100%;height:100%;display:grid;place-items:center;background:#0b0f17;color:#f8fafc;font:16px Outfit,Arial,sans-serif}
  main{max-width:420px;padding:24px;text-align:center}
</style>
<main>This GMS game tried to open Nyx inside itself, so Nyx blocked that redirect.</main>`);
    return;
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "nyx",
    wisp: externalWispUrl ? "external" : "embedded"
  });
});

function prunePresence(now = Date.now()) {
  for (const [sessionId, lastSeen] of presenceSessions) {
    if (now - lastSeen > presenceTtlMs) presenceSessions.delete(sessionId);
  }
  return presenceSessions.size;
}

function sendPresence(res, status = 200) {
  res.status(status)
    .set("Cache-Control", "no-store")
    .json({ online: prunePresence(), ttl: presenceTtlMs });
}

app.options("/presence", (_req, res) => {
  res.set("Cache-Control", "no-store").sendStatus(204);
});

app.get("/presence", (_req, res) => {
  sendPresence(res);
});

app.post("/presence", express.text({ type: "text/plain", limit: "2kb" }), (req, res) => {
  try {
    const sessionId = String(JSON.parse(req.body || "{}").sessionId || "");
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

app.get("/runtime-config.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("application/javascript").send(
    `globalThis.__NYX_RUNTIME_CONFIG__=Object.freeze(${JSON.stringify({ wispUrl: externalWispUrl })});`
  );
});

app.get("/uv/uv.handler.js", (_req, res) => {
  res.type("application/javascript").send(patchedUvHandler());
});
app.get("/uv/uv.bundle.js", (_req, res) => {
  res.type("application/javascript").send(patchedUvBundle());
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
app.get("/nyx-compat/cineby-app.js", async (_req, res) => {
  try {
    if (!cinebyAppCache.source || cinebyAppCache.expires < Date.now()) {
      const pageResponse = await fetch("https://www.cineby.at/");
      if (!pageResponse.ok) throw new Error(`Cineby returned ${pageResponse.status}`);
      const html = await pageResponse.text();
      const match = html.match(/<script[^>]+src=["']([^"']*\/_app-[^"']+\.js)["']/i);
      if (!match) throw new Error("Cineby app bundle was not found");
      const scriptUrl = new URL(match[1], "https://www.cineby.at/");
      const scriptResponse = await fetch(scriptUrl);
      if (!scriptResponse.ok) throw new Error(`Cineby app bundle returned ${scriptResponse.status}`);
      const original = await scriptResponse.text();
      const devtoolPatched = original.replace(
        /ignore:\(\)=>\[[^\]]*\]\.includes\(location\.href\)/,
        "ignore:()=>true"
      );
      if (devtoolPatched === original) throw new Error("Cineby DevTools detector signature changed");
      const patched = devtoolPatched.replace(
        /let e=\[\{id:"adstag-gk",src:"\/scripts\/os\.js"\},\{id:"adstag-2",src:"\/\/[^"\\]+"\}\];/,
        "let e=[];"
      );
      if (patched === devtoolPatched) throw new Error("Cineby ad loader signature changed");
      cinebyAppCache = { source: patched, expires: Date.now() + 5 * 60 * 1000 };
    }
    res.setHeader("Cache-Control", "no-store");
    res.type("application/javascript").send(cinebyAppCache.source);
  } catch (error) {
    res.status(502).type("application/javascript").send(`throw new Error(${JSON.stringify(`Nyx Cineby compatibility failed: ${error.message}`)});`);
  }
});
app.get("/assets/vendor/eruda.min.js", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.type("application/javascript").sendFile(erudaPath);
});

function linkGeneratorConfig() {
  const maxZones = Math.max(1, Math.min(100, Number.parseInt(process.env.LINK_GENERATOR_MAX_ZONES || "20", 10) || 20));
  let origin = "";
  try {
    const parsed = new URL(process.env.NYX_PUBLIC_ORIGIN || "https://nyxlearning.netlify.app");
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      parsed.pathname = parsed.pathname.replace(/\/$/, "");
      parsed.search = "";
      parsed.hash = "";
      origin = parsed.href.replace(/\/$/, "");
    }
  } catch {}
  return {
    apiKey: String(process.env.BUNNY_API_KEY || "").trim(),
    accessCode: String(process.env.LINK_GENERATOR_ACCESS_CODE || ""),
    origin,
    maxZones
  };
}

function secretMatches(actual, expected) {
  const left = createHash("sha256").update(String(actual || "")).digest();
  const right = createHash("sha256").update(String(expected || "")).digest();
  return timingSafeEqual(left, right) && Boolean(expected);
}

function linkGeneratorClientId(req) {
  return String(
    req.get("x-nf-client-connection-ip") ||
    req.get("x-forwarded-for")?.split(",")[0] ||
    req.ip ||
    "unknown"
  ).trim().slice(0, 100);
}

function sameOriginRequest(req) {
  const fetchSite = String(req.get("sec-fetch-site") || "").trim().toLowerCase();
  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;
  if (fetchSite === "cross-site") return false;
  const origin = String(req.get("origin") || "").trim();
  if (!origin) return true;
  try {
    const forwardedHost = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    return new URL(origin).host === forwardedHost;
  } catch {
    return false;
  }
}

function linkGeneratorRateState(clientId, now = Date.now()) {
  for (const [key, state] of linkGeneratorAttempts) {
    if (now - state.windowStarted > linkGeneratorWindowMs && now - state.lastCreated > linkGeneratorCooldownMs) {
      linkGeneratorAttempts.delete(key);
    }
  }
  let state = linkGeneratorAttempts.get(clientId);
  if (!state || now - state.windowStarted > linkGeneratorWindowMs) {
    state = { attempts: 0, windowStarted: now, lastCreated: 0 };
    linkGeneratorAttempts.set(clientId, state);
  }
  return state;
}

function generatedPullZoneName(label) {
  const slug = String(label || "link")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "link";
  return `nyx-public-${slug}-${randomBytes(3).toString("hex")}`;
}

async function bunnyRequest(path, apiKey, options = {}) {
  const response = await fetch(`https://api.bunny.net${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      AccessKey: apiKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15_000)
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const message = String(payload?.Message || payload?.message || `Bunny API returned ${response.status}`).slice(0, 240);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

app.get("/api/link-generator/status", (_req, res) => {
  const config = linkGeneratorConfig();
  res.set("Cache-Control", "no-store").json({
    available: Boolean(config.apiKey && config.accessCode && config.origin),
    origin: config.origin,
    cooldownMinutes: Math.round(linkGeneratorCooldownMs / 60_000)
  });
});

app.post("/api/link-generator", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }

  const config = linkGeneratorConfig();
  if (!config.apiKey || !config.accessCode || !config.origin) {
    res.status(503).json({ error: "Link Generator has not been configured by the Nyx administrator yet." });
    return;
  }

  const clientId = linkGeneratorClientId(req);
  const now = Date.now();
  const rate = linkGeneratorRateState(clientId, now);
  rate.attempts += 1;
  if (rate.attempts > linkGeneratorMaxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + linkGeneratorWindowMs - now) / 1000));
    res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }
  if (!secretMatches(req.body?.accessCode, config.accessCode)) {
    res.status(401).json({ error: "The access code is incorrect." });
    return;
  }
  if (rate.lastCreated && now - rate.lastCreated < linkGeneratorCooldownMs) {
    const retryAfter = Math.max(1, Math.ceil((rate.lastCreated + linkGeneratorCooldownMs - now) / 1000));
    res.set("Retry-After", String(retryAfter)).status(429).json({ error: `A link was already generated recently. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` });
    return;
  }

  try {
    const zonesPayload = await bunnyRequest("/pullzone?page=1&perPage=1000&search=nyx-public-", config.apiKey);
    const zones = Array.isArray(zonesPayload) ? zonesPayload : Array.isArray(zonesPayload?.Items) ? zonesPayload.Items : [];
    const generatedZones = zones.filter(zone => String(zone?.Name || "").startsWith("nyx-public-"));
    if (generatedZones.length >= config.maxZones) {
      res.status(409).json({ error: "The public Link Generator has reached its zone limit. Ask the Nyx administrator to remove an old generated link." });
      return;
    }

    const name = generatedPullZoneName(req.body?.label);
    const zone = await bunnyRequest("/pullzone", config.apiKey, {
      method: "POST",
      body: JSON.stringify({ Name: name, OriginUrl: config.origin })
    });
    const systemHostname = Array.isArray(zone?.Hostnames)
      ? zone.Hostnames.find(item => item?.IsSystemHostname)?.Value || zone.Hostnames[0]?.Value
      : "";
    if (!systemHostname) throw new Error("Bunny created the zone but did not return its hostname.");
    rate.lastCreated = Date.now();
    res.status(201).json({
      id: zone.Id,
      name: zone.Name || name,
      url: `https://${systemHostname}`,
      origin: config.origin
    });
  } catch (error) {
    console.error("Nyx Link Generator failed:", error?.message || error);
    res.status(502).json({ error: `Bunny could not create the link: ${String(error?.message || "Unknown error")}` });
  }
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

app.use((req, res, next) => {
  const path = String(req.path || "");
  const shouldNotServeNyx =
    path.startsWith("/assets/") ||
    path.startsWith("/games/") ||
    path.startsWith("/images/") ||
    path.startsWith("/js/") ||
    path.startsWith("/css/") ||
    /\.(?:avif|bmp|css|gif|html?|ico|jpe?g|js|json|mjs|mp3|mp4|ogg|opus|png|svg|wasm|wav|webm|webp|woff2?|xml)$/i.test(path);
  if (!shouldNotServeNyx) {
    next();
    return;
  }
  res.status(404).type("text/plain").send("Not found");
});

app.use((_req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

export { app, externalWispUrl, normalizePublicWispUrl };

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === join(__dirname, "server.js");
if (isDirectRun) {
  const server = createServer((req, res) => app(req, res));

  server.on("upgrade", (req, socket, head) => {
    if (!externalWispUrl && req.url?.endsWith("/wisp/")) {
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
    console.log(`  wisp transport: ${externalWispUrl || "same-host /wisp/"}`);
  });

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; closing nyx server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
