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
  try {
    if (!window.__nyxPointerLockBridge) {
      window.__nyxPointerLockBridge = true;
      const pointerStyle = document.createElement("style");
      pointerStyle.textContent = "html.nyx-pointer-captured,html.nyx-pointer-captured *{cursor:none!important}";
      const addPointerStyle = () => {
        try {
          (document.head || document.documentElement)?.appendChild(pointerStyle);
        } catch {}
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addPointerStyle, { once: true });
      else addPointerStyle();
      const pointerTargets = 'canvas,video,[role="application"],[data-testid*="game" i],[data-testid*="stream" i],[class*="game" i],[class*="stream" i],[class*="player" i],[id*="game" i],[id*="stream" i],[id*="player" i]';
      const isEditingTarget = target => !!(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || "")));
      const requestGamePointer = event => {
        try {
          if (isEditingTarget(event.target)) return;
          const target = event.target?.closest?.(pointerTargets);
          if (!target) return;
          target.focus?.({ preventScroll: true });
          try {
            if (!document.pointerLockElement && target.requestPointerLock) {
              const lock = target.requestPointerLock({ unadjustedMovement: true });
              lock?.catch?.(() => {
                try {
                  target.requestPointerLock?.();
                } catch {}
              });
            }
          } catch {
            try {
              target.requestPointerLock?.();
            } catch {}
          }
          document.documentElement.classList.add("nyx-pointer-captured");
        } catch {}
      };
      document.addEventListener("pointerdown", requestGamePointer, true);
      document.addEventListener("click", requestGamePointer, true);
      document.addEventListener("pointerlockchange", () => {
        document.documentElement.classList.toggle("nyx-pointer-captured", !!document.pointerLockElement);
      });
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
        if (event.key === "Escape") document.documentElement.classList.remove("nyx-pointer-captured");
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
    res.send(buffer);
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
