import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { cloudIceConfig } from '../services/stratus/ice-config.mjs';
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceDir = path.resolve('services/stratus');
const port = 33_001;
const apiKey = "smoke-test-only-key-000000000000000000000000";
const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "nyx-stratus-smoke-"));
let output = "";
const child = spawn(process.execPath, [path.join(serviceDir, "launcher.mjs")], {
  cwd: serviceDir,
  env: {
    ...process.env,
    STRATUS_API_KEY: apiKey,
    STRATUS_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    STRATUS_PORT: String(port),
    STRATUS_RUNTIME_DIR: runtimeDir,
    STRATUS_ACCOUNT_POOL_TARGET: "0",
    STRATUS_MAX_CONCURRENT_SESSIONS: "1"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", chunk => {
    output = `${output}${chunk}`.slice(-8_000);
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Service exited before health check.\n${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/cloud/v1/healthz`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Service did not become healthy.\n${output}`);
}

async function request(pathname, options) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  let payload = null;
  try { payload = await response.json(); } catch {}
  return { response, payload };
}

try {
  const health = await waitForHealth();
  if (health?.ok !== true || health?.service !== "nyx-stratus") throw new Error("Health response was incomplete.");

  const source = await request("/cloud/v1/source");
  if (!source.response.ok || source.payload?.license !== "AGPL-3.0-only") throw new Error("Source response was incomplete.");

  const embedResponse = await fetch(`http://127.0.0.1:${port}/cloud/v1/embed?id=smoke-test`);
  const embed = await embedResponse.text();
  if (
    !embedResponse.ok ||
    embedResponse.headers.get("x-frame-options") !== "SAMEORIGIN" ||
    !String(embedResponse.headers.get("content-security-policy") || "").includes("frame-ancestors 'self'") ||
    !embed.includes("/cloud/v1/embed-data?id=") ||
    embed.includes("/api/cloud/embed-data?id=") ||
    !embed.includes("pendingMoveX += moveX") ||
    !embed.includes("const MOUSE_FLUSH_INTERVAL_MS = 8") ||
    !embed.includes('const pointerMovementEvent = "onpointerrawupdate" in window ? "pointerrawupdate" : "mousemove"') ||
    !embed.includes("if (_dc.bufferedAmount > MAX_MOUSE_BUFFERED_BYTES) return") ||
    !embed.includes("setInterval(flushMouse, MOUSE_FLUSH_INTERVAL_MS)") ||
    !embed.includes("let cachedVideoRect = null") ||
    !embed.includes("requestPointerLock({ unadjustedMovement: true })") ||
    !embed.includes("const localCursorEl = document.createElement(\"img\")") ||
    embed.includes("if (document.pointerLockElement === streamEl) document.exitPointerLock()") ||
    embed.includes("flushMouse();\n            if (_dc && _dc.readyState === \"open\") sendGamepad();")
  ) {
    throw new Error("The generated embed client did not include the active route and low-latency mouse path.");
  }

  const servers=[{urls:['stun:relay.example:3478','turn:relay.example:3478?transport=udp','turn:relay.example:3478?transport=tcp','turns:relay.example:443?transport=tcp'],username:'fixture',credential:'fixture'}];
  assert.equal(cloudIceConfig(servers).iceServers,servers);
  assert.equal(cloudIceConfig(servers,true).iceServers[0].urls.length,2);
  assert.throws(()=>cloudIceConfig([{urls:'stun:relay.example'}],true),/No TCP/);
  const browser=await chromium.launch({headless:true});
  try {
    for(const mode of ['auto','restricted']) {
      const page=await browser.newPage();
      await page.route('**/cloud/v1/embed-data?**',r=>r.fulfill({json:{ice_servers:servers,signaling_ws:'ws://fixture.invalid'}}));
      await page.addInitScript(()=>{
        window.WebSocket=class{constructor(){setTimeout(()=>this.onmessage?.({data:JSON.stringify({type:'game_ready'})}),20)}send(){}close(){}};
        window.RTCPeerConnection=class{constructor(config){window.testIce=config;}addTransceiver(){}createDataChannel(){return {readyState:'connecting'}}async createOffer(){return {type:'offer',sdp:'fixture'}}async setLocalDescription(){}close(){}};
      });
      await page.goto(`http://127.0.0.1:${port}/cloud/v1/embed?id=fixture&network=${mode}`);
      await page.waitForFunction(()=>window.testIce);
      const config=await page.evaluate(()=>window.testIce);
      assert.equal(config.iceTransportPolicy,mode==='restricted'?'relay':undefined);
      assert.equal(config.iceServers[0].urls.length,mode==='restricted'?2:4);
      await page.close();
    }
  } finally {await browser.close();}
  console.log('Browser verified generated Stratus player: Automatic preserves ICE; Restricted uses TCP/TLS relay only.');

  const unauthenticated = await request("/cloud/v1/createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (unauthenticated.response.status !== 401) throw new Error(`Missing-key request returned ${unauthenticated.response.status}.`);

  const authenticated = await request("/cloud/v1/createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({})
  });
  if (authenticated.response.status !== 400) throw new Error(`Valid-key malformed request returned ${authenticated.response.status}.`);

  console.log("Stratus smoke test passed: health, embed route, source disclosure, and API-key boundary verified.");
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await new Promise(resolve => child.exitCode === null ? child.once("exit", resolve) : resolve());
  await rm(runtimeDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
