import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { chromium } from "playwright";
const source = await readFile("polygon.studies.js", "utf8");
const app = express();
app.get("/js/K7b49.js", (_req, res) => res.sendFile("js/K7b49.js", { root: process.cwd() }));
app.get("/", (_req, res) =>
  res
    .type("html")
    .send("<!doctype html><title>Worker response regression</title>"),
);
app.get("/worker.js", (_req, res) => res.type("js").send(source));
app.get("/js/polygon-graphics-adapter.js", (_req, res) =>
  res
    .type("js")
    .send(
      `self.$scrController={shouldRoute:e=>new URL(e.request.url).pathname.startsWith('/~/sj/'),route:async e=>{const url=new URL(e.request.url),kind=url.searchParams.get('kind');if(kind==='script')return new Response('window.scriptWorked=true',{headers:{'content-type':'application/javascript'}});if(kind==='bad-script')return new Response('<html>Unavailable</html>',{status:502,headers:{'content-type':'text/html'}});if(kind==='html')return new Response('<p>fragment</p>',{headers:{'content-type':'text/html'}});return new Response(JSON.stringify(kind==='challenge'?{response_type:'botnet_challenge'}:{results:[{image:'https://example.com/picture.png'}]}),{status:kind==='challenge'?202:kind==='limited'?429:200,headers:{'content-type':'application/json','retry-after':'15'}})}};`,
    ),
);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/worker.js");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  for (const [kind, status] of [
    ["data", 200],
    ["challenge", 202],
    ["limited", 429],
  ]) {
    const result = await page.evaluate(async (kind) => {
      const r = await fetch("/~/sj/session/frame/api.js?kind=" + kind, {
        headers: { accept: "application/json, text/javascript, */*; q=0.01" },
      });
      return {
        status: r.status,
        type: r.headers.get("content-type"),
        body: await r.json(),
        retry: r.headers.get("retry-after"),
      };
    }, kind);
    assert.equal(result.status, status);
    assert.match(result.type, /application\/json/);
    assert.equal(result.retry, "15");
    if (kind === "challenge")
      assert.equal(result.body.response_type, "botnet_challenge");
    else assert.equal(result.body.results.length, 1);
  }
  const xhr = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const x = new XMLHttpRequest();
        x.open("GET", "/~/sj/session/frame/i.js?kind=data");
        x.setRequestHeader("Accept", "text/javascript");
        x.onload = () =>
          resolve({ status: x.status, data: JSON.parse(x.responseText) });
        x.send();
      }),
  );
  assert.equal(xhr.status, 200);
  assert.equal(xhr.data.results.length, 1);
  assert.equal(
    await page.evaluate(async () =>
      (await fetch("/~/sj/session/frame/template.js?kind=html")).text(),
    ),
    "<p>fragment</p>",
  );
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/~/sj/session/frame/run.js?kind=script";
        s.onload = resolve;
        s.onerror = reject;
        document.head.append(s);
      }),
  );
  assert.equal(await page.evaluate(() => window.scriptWorked), true);
  const bad = page.waitForResponse((r) => r.url().includes("kind=bad-script"));
  await page.evaluate(() => {
    const s = document.createElement("script");
    s.src = "/~/sj/session/frame/bad.js?kind=bad-script";
    document.head.append(s);
  });
  assert.equal(await (await bad).text(), "");
  for (const representation of ["legacy", "versioned"]) {
    const blocked = await page.evaluate(async (representation) => {
      const target = "https://google-analytics.com/collect";
      const token = representation === "legacy" ? encodeURIComponent(target) :
        "u1." + btoa(target).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const response = await fetch("/~/sj/session/frame/" + token);
      return response.status;
    }, representation);
    assert.equal(blocked, 204, "Existing tracker protection must decode both representations");
  }
  console.log(
    "PASS real service worker: JSON fetch/XHR .js APIs, challenge202, rate-limit429 and HTML fragments preserved; executable-script safeguards retained",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
