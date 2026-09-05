import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { buildVariantUrl, estimatedVariantBytes, MAX_VARIANTS, prepareVariantBase } from "../apps/link-generator/bulk-variants.js";

const plan = prepareVariantBase("https://example.com/page.html?old=1&id=remove#lesson", "id");
assert.equal(buildVariantUrl(plan, 42), "https://example.com/page.html?old=1&id=42#lesson");
assert.equal(estimatedVariantBytes(plan, 3, "sequential"), [1, 2, 3].map(value => buildVariantUrl(plan, value)).join("\n").length + 1);
assert.throws(() => estimatedVariantBytes(plan, MAX_VARIANTS + 1), /between 1 and 5,000,000/);
assert.throws(() => prepareVariantBase("file:///private.html", "id"), /public http/);
assert.throws(() => prepareVariantBase("https://user:pass@example.com/", "id"), /without embedded credentials/);

const port = 8231;
const origin = `http://127.0.0.1:${port}`;
const nyx = spawn(process.execPath, ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
nyx.stdout.on("data", chunk => { serverOutput += chunk; });
nyx.stderr.on("data", chunk => { serverOutput += chunk; });
async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (nyx.exitCode !== null) throw new Error(`Nyx stopped early.\n${serverOutput}`);
    try { if ((await fetch(`${origin}/healthz`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Nyx did not start.\n${serverOutput}`);
}
async function downloadText(download) {
  const stream = createReadStream(await download.path(), { encoding: "utf8" });
  let text = "";
  for await (const chunk of stream) text += chunk;
  return text;
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__variantStreamProbe = { writes: 0, characters: 0, closed: false, aborted: false };
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async chunk => {
          window.__variantStreamProbe.writes += 1;
          window.__variantStreamProbe.characters += String(chunk).length;
        },
        close: async () => { window.__variantStreamProbe.closed = true; },
        abort: async () => { window.__variantStreamProbe.aborted = true; }
      })
    });
  });
  const errors = [];
  let publishRequests = 0;
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/link-generator") publishRequests += 1; });
  await page.route("**/api/link-checker/vendors", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ vendors: [{ key: "goguardian", label: "GoGuardian" }] }) }));
  await page.goto(`${origin}/apps/link-generator/`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-bulk-base]").fill("https://example.com/lesson");
  await page.locator("[data-bulk-count]").fill("3");
  await page.locator("[data-bulk-key]").fill("copy");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-bulk-generate]").click();
  const download = await downloadPromise;
  assert.equal(await download.suggestedFilename(), "nyx-url-variants-3.txt");
  assert.equal(await downloadText(download), "https://example.com/lesson?copy=1\nhttps://example.com/lesson?copy=2\nhttps://example.com/lesson?copy=3\n");
  await page.locator("[data-bulk-progress].complete").waitFor();
  assert.match(await page.locator("[data-bulk-preview-lines]").textContent(), /copy=1/);
  assert.equal(publishRequests, 0, "Local variants called the hosted Link Generator API");

  await page.locator("[data-bulk-count]").fill("100001");
  await page.locator("[data-bulk-generate]").click();
  await page.locator("[data-bulk-progress].complete").waitFor({ timeout: 30_000 });
  const streamProbe = await page.evaluate(() => window.__variantStreamProbe);
  assert.equal(streamProbe.writes, 11, "Large list was not written in bounded chunks");
  assert.equal(streamProbe.closed, true, "Large streamed list was not closed");
  assert.equal(streamProbe.aborted, false, "Completed stream was unexpectedly aborted");
  assert.equal(streamProbe.characters, estimatedVariantBytes(prepareVariantBase("https://example.com/lesson", "copy"), 100001), "Large streamed list had the wrong size");
  assert.equal(publishRequests, 0, "Large local variants called the hosted Link Generator API");

  assert.deepEqual(errors, [], `Bulk variant browser errors: ${errors.join(" | ")}`);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert.ok(overflow <= 1, `Bulk variants caused ${overflow}px of mobile overflow`);
  console.log("Link Generator variants test: validation, local and streamed downloads, no server publish, and mobile layout passed");
} finally {
  if (browser) await browser.close();
  nyx.kill("SIGTERM");
  await new Promise(resolve => nyx.once("exit", resolve));
}
