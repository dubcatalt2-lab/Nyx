import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { chromium } from "playwright";
import { proxyAssetNames } from "./build-proxy-assets.mjs";
const root = process.env.NYX_TEST_ASSET_ROOT || "dist";
const aliases = JSON.parse(
  await readFile("dist/proxy-assets.json", "utf8"),
).aliases;
const app = express()
  .use((_req, res, next) => {
    res.set("Service-Worker-Allowed", "/");
    next();
  })
  .use(express.static(root))
  .use(express.static("dist"));
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const transport = `export default class {ready=true;async init(){}close(){}connect(){return [()=>{},()=>{}]}async request(raw){const u=new URL(String(raw));let type='text/html',body;if(u.hostname==='thumb.test'){type='image/svg+xml';body='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="green"/></svg>';}else if(u.pathname==='/i.js'){type='application/json';body=JSON.stringify({results:[{image:'https://thumb.test/image.svg?q='+encodeURIComponent(u.searchParams.get('q')),title:u.searchParams.get('q')}]});}else if(u.hostname==='destination.test'){body='<h1>Destination works</h1>';}else{const q=u.searchParams.get('q')||'cats';body='<h1>Search '+q+'</h1><a id="images" href="/?q='+encodeURIComponent(q)+'&ia=images">Images</a><form action="https://duckduckgo.com/"><input name="q" id="query" value="'+q+'"><button>Search</button></form><article data-testid="result"><a id="result" href="https://destination.test/">A real search result destination</a></article><section id="results"></section>';if(u.searchParams.get('ia')==='images')body+='<script>fetch("/i.js?q='+encodeURIComponent(q)+'",{headers:{accept:"application/json, text/javascript"}}).then(r=>r.json()).then(data=>{for(const row of data.results){const img=document.createElement("img");img.id="thumb";img.src=row.image;img.alt=row.title;document.querySelector("#results").append(img);const lazy=document.createElement("img");lazy.id="scroll-thumb";lazy.style="position:absolute;top:6000px;width:120px;height:90px";lazy.setAttribute("loading","lazy");lazy.setAttribute("data-image-url",row.image+"&page=2");document.querySelector("#results").append(lazy);}})</script>';}return{status:200,statusText:'OK',headers:[['content-type',type]],body:new Response('<!doctype html>'+body).body,...(type!=='text/html'?{body:new Response(body).body}:{})};}}`;
const browser = await chromium.launch({ channel: "msedge" });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    if (!/^https?:$/.test(location.protocol)) return;
    localStorage.setItem("nyx.setupComplete", "true");
    localStorage.setItem("nyx.tosAcceptedVersion", "2026-07-30");
    localStorage.setItem("nyx.browserMode", "scramjet");
    localStorage.setItem(
      "nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen",
      "2026-10-02-nyx-1.6.8",
    );
  });
  await context.routeWebSocket("**/api/tutsi-relay/socket/", (socket) =>
    socket.send(Buffer.from([3, 0, 0, 0, 0, 10, 0, 0, 0])),
  );
  await context.route("**/api/**", (r) => r.fulfill({ json: {} }));
  await context.route("**/api/tutsi-relay/sessions", (r) =>
    r.fulfill({ json: { token: "fixture" } }),
  );
  await context.route("**/api/tutsi-relay/receive", (r) =>
    r.fulfill({
      contentType: "application/octet-stream",
      body: Buffer.from([9, 0, 0, 0, 3, 0, 0, 0, 0, 10, 0, 0, 0]),
    }),
  );
  const paths = [
    "/assets/transports/libcurl-scramjet.mjs",
    "/assets/transports/epoxy-scramjet.mjs",
  ];
  await context.route(
    (url) =>
      paths.some((p) =>
        [p, proxyAssetNames[p], aliases[p]].includes(url.pathname),
      ),
    (r) => r.fulfill({ contentType: "text/javascript", body: transport }),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  if (process.argv.includes("--debug")) {
    page.on("console", (m) =>
      console.log("CONSOLE", m.type(), m.text().slice(0, 300)),
    );
    page.on("framenavigated", (f) => console.log("FRAME", f.url()));
  }
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.waitForTimeout(8500);
  const search = page.locator("[data-q53154c3f0fbe71a11b]:visible").first();
  await search.fill("cats");
  await search.press("Enter");
  const frame = page.frameLocator(".q6576ed118d3ca9c284 iframe.view.active");
  await frame
    .getByRole("heading", { name: "Search cats", exact: true })
    .waitFor();
  await frame.locator("#images").click();
  await frame.locator("#thumb").waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("iframe.view.active")].some(
      (f) => f.contentDocument?.querySelector("#thumb")?.naturalWidth === 120,
    ),
  );
  assert.equal(await frame.locator("#thumb").getAttribute("alt"), "cats");
  assert.equal(await frame.locator("#scroll-thumb").getAttribute("src"), null);
  await frame.locator("body").evaluate(() => scrollTo(0, 5900));
  await page.waitForFunction(() =>
    [...document.querySelectorAll("iframe.view.active")].some(
      (f) => f.contentDocument?.querySelector("#scroll-thumb")?.naturalWidth === 120,
    ), null, {timeout: 10000});
  await frame.locator("body").evaluate(() => scrollTo(0, 0));
  await frame.locator("#query").fill("dogs");
  await frame.locator("#query").press("Enter");
  await frame
    .getByRole("heading", { name: "Search dogs", exact: true })
    .waitFor();
  await frame.locator("#images").click();
  await frame.locator("#thumb").waitFor();
  assert.equal(await frame.locator("#thumb").getAttribute("alt"), "dogs");
  await frame.locator("#result").click();
  await frame
    .getByRole("heading", { name: "Destination works", exact: true })
    .waitFor();
  assert.equal(context.pages().length, 1);
  console.log(
    "PASS " +
      root +
      ": web search -> Images JSON API -> loaded thumbnail -> second query -> Images -> result navigation in same tab",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
