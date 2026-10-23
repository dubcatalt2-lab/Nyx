import { κατάλογοςZengs } from "./zengs-catalog.mjs";
import { createGameProxy } from "./game-proxy-stream.mjs";
import { tokenizer } from "acorn";
import { parse, serialize } from "parse5";

// Provider addresses stay server-side. Public documents receive only N7X paths.
const πηγές = [
  "https://d1a9n6wbsc5thc.cloudfront.net",
  "https://cdn.jsdelivr.net",
  "https://genizymath.github.io",
  "https://html5.gamemonetize.co",
  "https://territorial.io",
];
export function διαδρομήZengs(τιμή, βάση = πηγές[0]) {
  const url = new URL(τιμή, βάση);
  const index = πηγές.indexOf(url.origin);
  if (index < 0 || url.username || url.password) throw new Error("Unsupported game origin");
  return `/zengs-assets/${index}${url.pathname}${url.search}${url.hash}`;
}

export function κείμενοZengs(κείμενο, βάση, τύπος = "text/html") {
  const διεύθυνση = value => {
    if (!/^(?:https?:\/\/|\/\/|\/[^/])/.test(value) || value.startsWith("/zengs-assets/")) return value;
    try { return διαδρομήZengs(value, βάση); } catch { return value; }
  };
  const javascript = value => {
    const edits = [];
    for (const token of tokenizer(value, {ecmaVersion: "latest", sourceType: "module", allowHashBang: true})) {
      if (token.type.label !== "string") continue;
      const next = διεύθυνση(token.value);
      if (next !== token.value) edits.push({start: token.start, end: token.end, value: JSON.stringify(next)});
    }
    for (const edit of edits.reverse()) value = value.slice(0, edit.start) + edit.value + value.slice(edit.end);
    return value;
  };
  const css = value => value.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
    (_, quote, url) => `url(${quote}${διεύθυνση(url.trim())}${quote})`);
  if (/javascript/i.test(τύπος)) return javascript(κείμενο);
  if (/css/i.test(τύπος)) return css(κείμενο);
  if (/json/i.test(τύπος)) {
    const walk = value => typeof value === "string" ? διεύθυνση(value) : Array.isArray(value) ? value.map(walk) :
      value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, walk(entry)])) : value;
    return JSON.stringify(walk(JSON.parse(κείμενο)));
  }
  if (!/html/i.test(τύπος)) return κείμενο;
  const document = parse(κείμενο);
  const walk = node => {
    for (const attr of node.attrs || []) {
      if (["src", "href", "poster", "action", "data-src"].includes(attr.name)) attr.value = διεύθυνση(attr.value);
      if (attr.name === "style") attr.value = css(attr.value);
    }
    if (node.tagName === "script" && !(node.attrs || []).some(attr => attr.name === "src")) {
      const type = node.attrs?.find(attr => attr.name === "type")?.value || "";
      if (["", "module", "text/javascript", "application/javascript"].includes(type))
        for (const child of node.childNodes || []) if (child.nodeName === "#text") child.value = javascript(child.value);
    }
    if (node.tagName === "style") for (const child of node.childNodes || []) if (child.nodeName === "#text") child.value = css(child.value);
    if (node.childNodes) node.childNodes = node.childNodes.filter(child => child.tagName !== "base");
    for (const child of node.childNodes || []) walk(child);
  };
  walk(document);
  return serialize(document).replace(/<head>/i, `<head><base href="${διαδρομήZengs(new URL(".", βάση))}">`);
}

export function installZengsProvider(app, { request = fetch } = {}) {
  const λαβή = async (url, options = {}) => {
    const target = new URL(url);
    if (!πηγές.includes(target.origin) || target.username || target.password) throw new Error("Unsupported game origin");
    // Never follow an upstream redirect to an unvalidated host.
    const response = await request(target, { ...options, redirect: "manual" });
    return response;
  };
  const proxy = createGameProxy({ request: λαβή });
  let cache = null;
  let expires = 0;
  let pending = null;
  async function catalog() {
    if (cache && Date.now() < expires) return cache;
    if (pending) return pending;
    pending = (async () => {
      const response = await λαβή(πηγές[0] + "/zg/c.json", { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("Catalog unavailable");
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 4 * 1024 ** 2) throw new Error("Catalog exceeds size limit");
        chunks.push(chunk);
      }
      cache = κατάλογοςZengs(JSON.parse(Buffer.concat(chunks).toString("utf8")), πηγές[0]).map(item => ({
        ...item, url: διαδρομήZengs(item.url), cover: item.cover ? διαδρομήZengs(item.cover) : "",
      }));
      expires = Date.now() + 300000;
      return cache;
    })().finally(() => { pending = null; });
    return pending;
  }
  app.get("/zengs-games", async (_req, res) => {
    try { res.set("Cache-Control", "public, max-age=300").json({ games: await catalog() }); }
    catch { res.status(502).json({ error: "Zengs catalog is temporarily unavailable." }); }
  });
  app.get(/^\/zengs-assets\/(\d+)(\/.*)$/, async (req, res) => {
    // Sandboxed game frames have an opaque origin. These allowlisted public
    // assets carry no user credentials and must be readable by their engines.
    res.set('Access-Control-Allow-Origin','*');
    try {
      const origin = πηγές[Number(req.params[0])];
      if (!origin) return res.sendStatus(404);
      const path = req.originalUrl.replace(/^\/zengs-assets\/\d+/, "");
      const url = new URL(path, origin);
      if (url.origin !== origin || url.username || url.password) return res.sendStatus(400);
      await proxy.send(req, res, {
        candidates: [url],
        cacheControl: "public, max-age=300",
        transform: (candidate, type) => /html|javascript|css|json|svg/i.test(type)
          ? body => Buffer.from(κείμενοZengs(body.toString("utf8"), candidate.href, type)) : null,
      });
    } catch {
      if (res.headersSent) res.destroy();
      else res.status(502).type("text/plain").send("The game resource is temporarily unavailable.");
    }
  });
}
