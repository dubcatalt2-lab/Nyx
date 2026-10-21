import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import express from "express";
import { chromium } from "playwright";
import { buildGameCatalogs, κωδικοποίηση } from "./build-game-catalogs.mjs";
import { αποκωδικοποίηση } from "../assets/games/catalog-codec.js";

const δείγμα = [{ title: "Étoile 日本 🎮", path: "folder/a.html?x=1&y=2" }];
assert.deepEqual(αποκωδικοποίηση(κωδικοποίηση(δείγμα)), δείγμα);
assert.deepEqual(αποκωδικοποίηση(δείγμα), δείγμα);
assert.throws(() => αποκωδικοποίηση({ representation: "n7x-xor-1", key: [], chunks: [] }));
const προσωρινό = await mkdtemp(join(tmpdir(), "n7x-catalog-"));
try {
  await mkdir(join(προσωρινό, "assets/games"), { recursive: true });
  await mkdir(join(προσωρινό, "assets/gn-math"), { recursive: true });
  await writeFile(join(προσωρινό, "assets/gn-math/games.json"), JSON.stringify(δείγμα));
  await writeFile(join(προσωρινό, "assets/games/games.json"), JSON.stringify({ catalogs: [
    { url: "/assets/gn-math/games.json", player: "/assets/gn-math/play.html?game={path}" }
  ] }));
  const first = await buildGameCatalogs(προσωρινό);
  const second = await buildGameCatalogs(προσωρινό);
  assert.notEqual(first["/assets/games/games.json"], second["/assets/games/games.json"]);
  for (const aliases of [first, second]) {
    const manifest = αποκωδικοποίηση(JSON.parse(await readFile(join(προσωρινό, aliases["/assets/games/games.json"]), "utf8")));
    assert.deepEqual(αποκωδικοποίηση(JSON.parse(await readFile(join(προσωρινό, manifest.catalogs[0].url), "utf8"))), δείγμα);
    assert.equal(manifest.catalogs[0].player, "/assets/gn-math/play.html?game={path}");
  }
} finally { await rm(προσωρινό, { recursive: true, force: true }); }

const root = resolve(process.env.NYX_TEST_DIST || ".");
let aliases = {};
if (process.env.NYX_TEST_DIST) {
  aliases = JSON.parse(await readFile(join(root, "game-catalog-assets.json"), "utf8")).aliases;
  for (const [original, encoded] of Object.entries(aliases)) {
    const decoded = αποκωδικοποίηση(JSON.parse(await readFile(join(root, encoded), "utf8")));
    if (original !== "/assets/games/games.json")
      assert.deepEqual(decoded, JSON.parse(await readFile(join(root, original), "utf8")));
    else for (const catalog of decoded.catalogs) for (const field of ["url", "coversUrl"])
      if (catalog[field]?.startsWith("/assets/games/@r"))
        assert(Object.values(aliases).includes(catalog[field]));
  }
}
const app = express(); app.use(express.static(root));
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage(); const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(base + (aliases["/assets/games/games.json"] || "/assets/games/games.json"), route => route.fulfill({ json: κωδικοποίηση({ catalogs: [
    { id: "gn", format: "gn", url: "/fixture/catalog.json", player: "/fixture/play.html?game={path}", priority: 40 }
  ] }) }));
  await page.route("**/fixture/catalog.json", route => route.fulfill({ json: κωδικοποίηση([
    { title: "Slope", path: "test.html", cover: "/fixture/cover.svg" }
  ]) }));
  await page.route("**/fixture/cover.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>' }));
  await page.route("**/fixture/play.html?*", route => route.fulfill({ contentType: "text/html", body: '<p>Fixture ready</p><script>parent.postMessage({type:"nyx:game-launched"},"*")</script>' }));
  await page.goto(base + "/assets/games/");
  const launch = page.getByRole("button", { name: "Launch Slope", exact: true });
  try { await launch.waitFor(); } catch (error) {
    console.error({ errors, text: (await page.locator("body").innerText()).slice(0, 1800) });
    throw error;
  }
  await launch.click();
  const frame = page.locator('iframe[src*="/fixture/play.html"]');
  await frame.waitFor(); assert.match(await frame.getAttribute("src"), /game=test.html/);
  await frame.contentFrame().getByText("Fixture ready").waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS Unicode round-trip, random builds, preserved player URLs, encoded catalog fetch and real player launch: " + root);
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
