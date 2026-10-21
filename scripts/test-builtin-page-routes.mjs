import assert from "node:assert/strict";
import { chromium } from "playwright";

// Run against the real backend, including when NYX_STATIC_ROOT has a hidden parent.
const base = process.env.NYX_TEST_BASE_URL || "http://localhost:8080";
for (const path of ["/apps/nyxify", "/apps/nyxify/", "/apps/nyxtube", "/apps/nyxtube/", "/connect-domain", "/tutsi/connect-domain", "/tutsi/"]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert(!/NotFoundError|Cannot GET/.test(await response.text()), path);
}
for (const path of ["/.env", "/.codex-artifacts/start-local-release.ps1", "/server.js", "/lib/public-assets.mjs"]) {
  assert.equal((await fetch(base + path)).status, 404, `Private path must stay blocked: ${path}`);
}
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const path of ["/apps/nyxify/", "/apps/nyxtube/", "/apps/chat/", "/ai.html", "/apps/code-studio/"]) {
    const page = await browser.newPage();
    const errors = []; const missing = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      if (response.status() === 404 && response.url().startsWith(base) && !response.url().includes("/api/")) missing.push(response.url());
    });
    // Keep provider calls deterministic; this verifies document and UI initialization.
    await page.route("**/api/**", route => route.fulfill({ json: {} }));
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200, path);
    await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 50 && getComputedStyle(document.body).visibility !== "hidden");
    await page.waitForTimeout(1000);
    assert.deepEqual(missing, [], path);
    assert.deepEqual(errors, [], path);
    await page.close();
  }
  console.log("PASS fixed document routes, built-in page initialization and private-file boundaries");
} finally { await browser.close(); }
