import assert from "node:assert/strict";
import express from "express";
import { request } from "node:http";
import { τοπικήΓέφυρα } from "../lib/local-ai-relay.mjs";

assert.throws(() => τοπικήΓέφυρα({origin: "http://example.com"}));
assert.throws(() => τοπικήΓέφυρα({origin: "https://user:pass@example.com"}));
let calls = 0;
let last;
let responseStatus = 200;
const app = express().use(express.json()).use(τοπικήΓέφυρα({
  origin: "https://example.com",
  request: async (url, options) => {
    calls++;
    last = {url, options};
    return new Response(responseStatus === 200 ? 'data: {"answer":"hello"}\n\n' : '{"error":"quota"}', {
      status: responseStatus,
      headers: {"content-type": "text/event-stream", "retry-after": "17"},
    });
  },
})).use((_req, res) => res.status(404).end());
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const rawStatus = headers => new Promise((resolve, reject) => {
  const req = request(origin + "/api/nyx-ai", {headers}, res => {
    res.resume();
    res.on("end", () => resolve(res.statusCode));
  });
  req.on("error", reject);
  req.end();
});
try {
  const response = await fetch(origin + "/api/nyx-ai", {
    method: "POST",
    headers: {"content-type": "application/json", authorization: "Bearer fixture", origin,
      cookie: "unrelated=private; nyx_q74bd9=device-fixture", "x-forwarded-for": "1.2.3.4"},
    body: JSON.stringify({messages: [{role: "user", content: "hello"}], model: "fixture"}),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'data: {"answer":"hello"}\n\n');
  assert.equal(last.url.href, "https://example.com/api/nyx-ai");
  assert.equal(last.options.headers.authorization, "Bearer fixture");
  assert.equal(last.options.headers.cookie, "nyx_q74bd9=device-fixture");
  assert.equal(last.options.headers["x-forwarded-for"], undefined);
  assert.equal(last.options.headers.origin, "https://example.com");
  assert.equal(last.options.redirect, "error");
  assert.equal(JSON.parse(last.options.body).model, "fixture");
  assert.equal((await fetch(origin + "/api/nyx-ai", {method: "POST", headers: {origin: "https://evil.example"}})).status, 403);
  assert.equal(await rawStatus({host: "evil.example"}), 403);
  assert.equal(await rawStatus({"sec-fetch-site": "cross-site"}), 403);
  assert.equal(calls, 1, "Cross-origin requests never reach the VPS");
  assert.equal((await fetch(origin + "/api/owner-dashboard")).status, 404);
  responseStatus = 429;
  const quota = await fetch(origin + "/api/nyx-ai/usage");
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get("retry-after"), "17");
  assert.equal((await quota.json()).error, "quota");
  assert.equal(last.options.headers.authorization, undefined, "No credentials are invented for anonymous clients");
  console.log("PASS opt-in local AI relay: same-origin/loopback guards, scoped paths, credential preservation, streaming, quota status and Retry-After");
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
