import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import express from "express";
import { chromium } from "playwright";
import { κατάλογοςZengs } from "../lib/zengs-catalog.mjs";
import { αποκωδικοποίηση } from "../assets/studies/catalog-codec.js";

const origin = "https://d1a9n6wbsc5thc.cloudfront.net";
const encode = value => {
  const key = [0x3b, 0x9a, 0x51, 0xe7, 0x2c, 0x84, 0x1d, 0xf0, 0x66];
  return Buffer.from([...Buffer.from(value)].map((byte, index) => byte ^ key[index % key.length])).toString("base64url");
};
const fixture = { items: [
  { title: encode("Zengs Only"), play: "/lg/fixture/index.html", cover: "/lgt/fixture.svg" },
  { title: encode("Étoile 日本"), play: "/lg/unicode/index.html", cover: "/lgt/fixture.svg" },
  { title: "%%%", play: "/invalid" },
  { title: encode("Unsafe"), play: "//other.example/game" },
  { title: encode("Unsafe"), play: "javascript:alert(1)" },
] };
const decoded = κατάλογοςZengs(fixture, origin + "/zg/c.json");
assert.deepEqual(decoded.map(item => item.title), ["Zengs Only", "Étoile 日本"]);
assert.equal(decoded[0].url, origin + "/lg/fixture/index.html");
assert.deepEqual(κατάλογοςZengs({}, origin), []);
const root = resolve(process.env.NYX_TEST_DIST || ".");
const manifest = JSON.parse(await readFile(join(root, "assets/studies/studies.json"), "utf8"));
assert(!manifest.catalogs.some(item => item.id === "lumin"));
assert(manifest.catalogs.some(item => item.id === "zengs" && item.url === "/zengs-games"));
const app = express(); app.use(express.static(root));
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = process.env.NYX_TEST_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = []; const sdkRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (/luminsdk|lumin\.min/i.test(request.url())) sdkRequests.push(request.url()); });
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (url === base + "/zengs-games") return route.fulfill({ json: { games: decoded.map(item => ({...item, url: item.url.replace(origin, "/zengs-assets/0"), cover: item.cover.replace(origin, "/zengs-assets/0")})) } });
      if (url === base + "/zengs-assets/0/lg/fixture/index.html") return route.fulfill({ contentType: "text/html", body: "<h1>Zengs player fixture</h1>" });
      if (url === base + "/zengs-assets/0/lgt/fixture.svg") return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40"/></svg>' });
      if (url.endsWith(".json") && url.startsWith(base)) {
        const response = await route.fetch();
        const value = αποκωδικοποίηση(await response.json());
        if (value.catalogs) return route.fulfill({ json: { ...value, catalogs: value.catalogs.filter(item => item.id === "zengs") } });
        return route.fulfill({ response });
      }
      return route.continue();
    });
    await page.goto(base + "/assets/studies/");
    const provider = page.getByRole("button", { name: "Zengs, 2 games", exact: true });
    try { await provider.waitFor({timeout: 10000}); } catch (error) {
      console.error({errors, text: (await page.locator("body").innerText()).slice(0, 1800)});
      throw error;
    }
    assert((await provider.innerText()).includes("𝙕𝙚𝙣𝙜𝙨"));
    await provider.click();
    await page.getByRole("button", { name: /^(?:Play|Start|start) Zengs Only$/ }).click();
    await page.frameLocator(`iframe[src="/zengs-assets/0/lg/fixture/index.html"]`).getByText("Zengs player fixture").waitFor();
    assert.deepEqual(sdkRequests, []);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("PASS Zengs title decoding, unsafe URL rejection, real manifest, Unicode provider, desktop/mobile player and no LuminSDK requests");
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
