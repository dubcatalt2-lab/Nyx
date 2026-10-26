import assert from "node:assert/strict";
import { randomBytes, scryptSync, createHmac } from "node:crypto";
import { chromium } from "playwright";
import { createGate } from "./server.mjs";

const password = "fixture-\u03a9-\u2603-password";
const config = {
  key: randomBytes(32).toString("hex"),
  salt: randomBytes(16).toString("hex"),
};
config.hash = scryptSync(password, config.salt, 64).toString("hex");
const gate = createGate(config);
await new Promise((resolve) => gate.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + gate.address().port;
const origin = "https://sec.ridgewoodstem.org";
const login = (value = password, extra = {}) =>
  fetch(base + "/_q83entry/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...extra },
    body: JSON.stringify({ username: "fixture-user", password: value }),
  });
const verify = (cookie = "", headers = {}) =>
  fetch(base + "/verify", { headers: { cookie, ...headers } });
const document = {
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  accept: "text/html",
};
let browser;
try {
  assert.equal((await verify("", document)).status, 401);
  assert.equal((await login("wrong-password")).status, 401);
  assert.equal(
    (await login(password, { origin: "https://other.test" })).status,
    403,
  );
  const response = await login();
  assert.equal(response.status, 204);
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /Secure; HttpOnly; SameSite=Strict/);
  const cookie = setCookie.split(";")[0];
  assert.equal(
    (await verify(cookie, { "sec-fetch-dest": "script" })).status,
    204,
  );
  assert.equal(
    (
      await verify(cookie, {
        "sec-fetch-dest": "iframe",
        "sec-fetch-mode": "navigate",
      })
    ).status,
    204,
  );
  assert.equal((await verify(cookie, document)).status, 204);
  assert.equal(
    (await verify(cookie, document)).status,
    401,
    "Reload needs another password entry",
  );
  assert.equal(
    (await verify(cookie, { "sec-fetch-dest": "empty" })).status,
    204,
    "API requests remain authorized",
  );
  assert.equal(
    (await verify(cookie, { accept: "text/html" })).status,
    401,
    "HTML navigation fallback must also prompt",
  );
  assert.equal((await verify("", { "sec-fetch-dest": "script" })).status, 401);
  const payload =
    String(Math.floor(Date.now() / 1000) + 3600) +
    "." +
    randomBytes(16).toString("hex");
  const mac = createHmac("sha256", Buffer.from(config.key, "hex"))
    .update(payload)
    .digest("hex");
  const old = "__Host-q83entry=" + payload + "." + mac;
  assert.equal(
    (await verify(old, document)).status,
    401,
    "Previously issued sessions do not skip entry",
  );
  const expiring = (await login()).headers.get("set-cookie").split(";")[0];
  const now = Date.now;
  try {
    Date.now = () => now() + 61000;
    assert.equal(
      (await verify(expiring, document)).status,
      401,
      "Unused admission expires after one minute",
    );
  } finally {
    Date.now = now;
  }
  console.log(
    "PASS server: one-use entry, expiration, legacy sessions, authenticated subresources, origin and password checks",
  );

  browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext();
  await context.route(origin + "/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const direct = url.pathname.startsWith("/_q83entry/");
    const headers = await request.allHeaders();
    // Chromium adds Fetch Metadata after Playwright's interception point.
    // Reconstruct the headers that the real Caddy forward_auth request receives.
    if (!headers["sec-fetch-dest"]) {
      headers["sec-fetch-dest"] =
        request.resourceType() === "document"
          ? request.frame().parentFrame()
            ? "iframe"
            : "document"
          : { script: "script", stylesheet: "style", image: "image" }[
              request.resourceType()
            ] || "empty";
    }
    delete headers.host;
    delete headers["content-length"];
    const result = await fetch(base + (direct ? url.pathname : "/verify"), {
      method: direct ? request.method() : "GET",
      headers,
      ...(direct && request.postDataBuffer()
        ? { body: request.postDataBuffer() }
        : {}),
    });
    if (process.argv.includes("--debug") && !direct)
      console.log(
        "VERIFY",
        url.pathname,
        request.resourceType(),
        headers["sec-fetch-dest"],
        headers["sec-fetch-mode"],
        Boolean(headers.cookie),
        result.status,
      );
    if (!direct && result.status === 204) {
      if (url.pathname === '/') return route.fulfill({
        contentType: 'text/html',
        body: '<h1>School cover</h1><script>setTimeout(()=>location.replace("/studies.html"),1012)</script>',
      });
      if (url.pathname === "/asset.js")
        return route.fulfill({
          contentType: "text/javascript",
          body: "window.assetLoaded=true;",
        });
      if (url.pathname === "/api/test")
        return route.fulfill({ json: { ok: true } });
      if (url.pathname === "/frame")
        return route.fulfill({
          contentType: "text/html",
          body: "<h2>Embedded content</h2>",
        });
      return route.fulfill({
        contentType: "text/html",
        body: '<h1>Application ready</h1><script src="/asset.js"></script><iframe src="/frame"></iframe>',
      });
    }
    return route.fulfill({
      status: result.status,
      headers: Object.fromEntries(result.headers),
      body: Buffer.from(await result.arrayBuffer()),
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const enter = async (target) => {
    await target.locator("input[name=username]").fill("fixture-user");
    await target.locator("input[name=password]").fill("  " + password + "  ");
    await target.getByRole("button", { name: "Enter library" }).click();
    await target.getByRole("heading", { name: "Application ready" }).waitFor();
    assert.equal(new URL(target.url()).pathname, '/studies.html', 'One-use admission opens the app directly, not the redirecting cover');
  };
  await page.goto(origin);
  await page.locator("input[name=password]").waitFor();
  await enter(page);
  assert.equal(await page.evaluate(() => window.assetLoaded), true);
  await page
    .frameLocator("iframe")
    .getByRole("heading", { name: "Embedded content" })
    .waitFor();
  assert.equal(
    await page.evaluate(
      async () => (await (await fetch("/api/test")).json()).ok,
    ),
    true,
  );
  await page.reload();
  await page.locator("input[name=password]").waitFor();
  await enter(page);
  const second = await context.newPage();
  await second.goto(origin);
  await second.locator("input[name=password]").waitFor();
  await enter(second);
  await second.goto(origin + "/another-entry");
  await second.locator("input[name=password]").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: existing obfuscated client, Unicode password/ASCII trim, reload, second tab, fresh path, assets, API and iframe",
  );
} finally {
  await browser?.close();
  gate.closeAllConnections();
  await new Promise((resolve) => gate.close(resolve));
}
