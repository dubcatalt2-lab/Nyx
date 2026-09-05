import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { buildAliasUrl, estimatedLinkBytes, MAX_LINKS, prepareAliasBase } from "../apps/link-generator/bulk-variants.js";

const plan = prepareAliasBase("https://nyxlearning.org/ignored?old=1#lesson", "BatchCode1");
assert.equal(buildAliasUrl(plan, 42), "https://nyxlearning.org/l/BatchCode1-42");
assert.equal(estimatedLinkBytes(plan, 3, "sequential"), [1, 2, 3].map(value => buildAliasUrl(plan, value)).join("\n").length + 1);
assert.throws(() => estimatedLinkBytes(plan, MAX_LINKS + 1), /between 1 and 5,000,000/);
assert.throws(() => prepareAliasBase("file:///private.html", "BatchCode1"), /public http/);
assert.throws(() => prepareAliasBase("https://user:pass@example.com/", "BatchCode1"), /public http/);
assert.throws(() => prepareAliasBase("https://example.com/", "short"), /safe link group/);

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
  assert.match(await page.locator("[data-bulk-alias-example]").textContent(), /\/l\/NyxLinkGroup-/);
  await page.locator("[data-bulk-count]").fill("3");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-bulk-generate]").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "nyx-path-links-3.txt");
  const smallText = await downloadText(download);
  const links = smallText.trim().split("\n");
  assert.equal(links.length, 3);
  assert.equal(new Set(links).size, 3, "Generated path links were not distinct");
  links.forEach((link, index) => {
    assert.match(link, new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/l/[A-Za-z0-9_-]{12}\\-${index + 1}$`));
    assert.ok(!link.includes("?"), "Generated link used a query-string ID");
  });
  await page.locator("[data-bulk-progress].complete").waitFor();
  const aliasResponse = await context.request.get(links[0]);
  assert.equal(aliasResponse.status(), 200, "Generated Nyx path did not resolve");
  assert.match(aliasResponse.headers()["content-type"] || "", /^image\/svg\+xml/);
  assert.match(await aliasResponse.text(), /Loads the official Nyx site inside a full-window frame/);
  assert.equal((await context.request.get(`${origin}/l/short`)).status(), 404, "Invalid alias token did not fail closed");
  assert.equal(publishRequests, 0, "Bulk path links called the hosted Link Generator API");

  await page.locator("[data-bulk-count]").fill("100001");
  await page.locator("[data-bulk-generate]").click();
  await page.locator("[data-bulk-progress].complete").waitFor({ timeout: 30_000 });
  const streamProbe = await page.evaluate(() => window.__variantStreamProbe);
  assert.equal(streamProbe.writes, 11, "Large list was not written in bounded chunks");
  assert.equal(streamProbe.closed, true, "Large streamed list was not closed");
  assert.equal(streamProbe.aborted, false, "Completed stream was unexpectedly aborted");
  const firstLargeLink = (await page.locator("[data-bulk-preview-lines]").textContent()).split("\n")[0];
  const largePlan = Object.freeze({ prefix: firstLargeLink.slice(0, -1), suffix: "" });
  assert.equal(streamProbe.characters, estimatedLinkBytes(largePlan, 100001), "Large streamed list had the wrong size");
  assert.equal(publishRequests, 0, "Large path generation called the hosted Link Generator API");
  assert.deepEqual(errors, [], `Bulk link browser errors: ${errors.join(" | ")}`);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert.ok(overflow <= 1, `Bulk links caused ${overflow}px of mobile overflow`);
  console.log("Bulk Nyx links test: distinct paths, live alias route, bounded streaming, no publisher call, and mobile layout passed");
} finally {
  if (browser) await browser.close();
  nyx.kill("SIGTERM");
  await new Promise(resolve => nyx.once("exit", resolve));
}
