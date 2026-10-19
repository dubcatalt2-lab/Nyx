import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { chromium } from "playwright";
const html = await readFile("index.html", "utf8");
const handler = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((s) => s.includes("event.key!=='F12'"));
assert(html.indexOf(handler) < html.indexOf("js/loading-screen.js"));
assert(handler?.includes("window.location.assign('about:blank')"));
const app = express();
app.get("/", (_, res) =>
  res.send(
    "<!doctype html><body><script>" +
      handler +
      '</script><script>window.addEventListener("keydown",event=>{event.preventDefault();event.stopImmediatePropagation()},true)</script><main>Private interface</main><iframe src="/child"></iframe></body>',
  ),
);
app.get("/child", (_, res) => res.send("<button>Nested app</button>"));
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const url = "http://127.0.0.1:" + server.address().port;
  await page.goto(url);
  await page.keyboard.press("Shift+F12");
  assert(page.url().startsWith(url));
  await page.keyboard.press("F12");
  await page.waitForURL("about:blank");
  assert.equal(await page.locator("body").innerHTML(), "");
  assert.equal(await page.locator("script,iframe,canvas").count(), 0);
  await page.goBack();
  assert.equal(await page.locator("main").textContent(), "Private interface");
  await page.frameLocator("iframe").locator("button").click();
  await page.keyboard.press("F12");
  await page.waitForURL("about:blank");
  assert.equal(await page.locator("body").innerHTML(), "");
  console.log(
    "PASS F12 blank document, modified-key exclusion, Back navigation and nested app shortcut",
  );
} finally {
  await browser.close();
  server.close();
}
