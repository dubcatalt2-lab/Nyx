import assert from "node:assert/strict";
import express from "express";
import { installZengsProvider, κείμενοZengs, διαδρομήZengs } from "../lib/zengs-provider.mjs";
const upstream = "https://d1a9n6wbsc5thc.cloudfront.net";
const requests = [];
const app = express();
installZengsProvider(app, { request: async (url, options) => {
  requests.push(url.href);
  assert.equal(options.redirect, "manual");
  assert.equal(options.headers?.authorization, undefined);
  if (url.pathname === "/zg/c.json") return Response.json({ items: [{ title: "dOwexx4", play: "/lg/ovo-2/index.html", cover: "/lgt/id-2.webp" }] });
  if (url.pathname.endsWith(".wasm")) return new Response(new Uint8Array([0, 97, 115, 109]), { headers: { "content-type": "application/wasm" } });
  return new Response('<html><head></head><body><script src="https://cdn.jsdelivr.net/npm/example/game.js"></script><img src="/lgt/test.png"><script>fetch("/lg/file.wasm")</script></body></html>', { headers: { "content-type": "text/html" } });
} });
const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const catalog = await (await fetch(base + "/zengs-games")).json();
  assert.equal(catalog.games[0].title, "OvO 2");
  assert.equal(catalog.games[0].url, "/zengs-assets/0/lg/ovo-2/index.html");
  assert(!/cloudfront|jsdelivr/.test(JSON.stringify(catalog)));
  await fetch(base + "/zengs-games");
  assert.equal(requests.filter(url => url.endsWith("/zg/c.json")).length, 1);
  const html = await (await fetch(base + catalog.games[0].url)).text();
  assert(!/cloudfront|jsdelivr/.test(html));
  assert(html.includes('<base href="/zengs-assets/0/lg/ovo-2/">'));
  assert(html.includes('src="/zengs-assets/1/npm/example/game.js"'));
  assert(html.includes('fetch("/zengs-assets/0/lg/file.wasm")'));
  const wasm = await (await fetch(base + "/zengs-assets/0/lg/file.wasm")).arrayBuffer();
  assert.deepEqual([...new Uint8Array(wasm)], [0, 97, 115, 109]);
  assert.equal((await fetch(base + "/zengs-assets/999/file")).status, 404);
  assert.equal((await fetch(base + "/zengs-assets/0//evil.example/file")).status, 400);
  assert.throws(() => διαδρομήZengs("https://127.0.0.1/private"));
  assert.equal(κείμενοZengs('const normal = "hello";', upstream + "/lg/a.js", "application/javascript"), 'const normal = "hello";');
  const expression = 'const expression = /[a-z]+/gi; fetch("/lg/data.json");';
  assert.equal(κείμενοZengs(expression, upstream + "/lg/a.js", "application/javascript"), 'const expression = /[a-z]+/gi; fetch("/zengs-assets/0/lg/data.json");');
  console.log("PASS server-only catalog, cache, local asset rewriting, binary integrity and fixed-origin boundary");
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
