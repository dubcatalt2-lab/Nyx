import { createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const upstreamDir = path.join(serviceDir, "upstream");
const expectedUpstream = Object.freeze({
  commit: "bd760513ce7616e955181dfd18017e2a6c278e3c",
  apiSha256: "31a82035a8da6a6dce432fcf21738233892b1829eb8ee9b11c4c7efa1be8255b",
  embedSha256: "5109aebfaab56da2328ced169939915a12c8e70b544ca91536a84fdd14528055"
});

function boundedInteger(name, fallback, minimum, maximum) {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return parsed;
}

function requiredApiKey() {
  const value = String(process.env.STRATUS_API_KEY || "").trim();
  if (value.length < 32 || value.length > 256 || /\s/.test(value)) {
    throw new Error("STRATUS_API_KEY must be a secret value between 32 and 256 characters with no whitespace.");
  }
  return value;
}

function publicOrigin() {
  const value = String(process.env.STRATUS_PUBLIC_ORIGIN || "").trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("STRATUS_PUBLIC_ORIGIN must be the public HTTPS origin for Nyx.");
  }
  const localHttp = parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) throw new Error("STRATUS_PUBLIC_ORIGIN must use HTTPS outside local development.");
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("STRATUS_PUBLIC_ORIGIN must contain only a scheme, host, and optional port.");
  }
  return parsed.origin;
}

function httpsSourceUrl() {
  const fallback = "https://github.com/dubcatalt2-lab/Nyx/tree/agent/pirate-cove/services/stratus";
  const value = String(process.env.STRATUS_SOURCE_URL || fallback).trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("STRATUS_SOURCE_URL must be an HTTPS URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("STRATUS_SOURCE_URL must be an HTTPS URL.");
  return parsed.href;
}

function normalized(value) {
  return value.replace(/\r\n/g, "\n");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertDigest(label, actual, expected) {
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new Error(`${label} does not match pinned Stratus commit ${expectedUpstream.commit}.`);
  }
}

function replaceOnce(source, find, replacement, label) {
  const first = source.indexOf(find);
  if (first < 0 || source.indexOf(find, first + find.length) >= 0) {
    throw new Error(`Could not apply the pinned Stratus hardening step: ${label}.`);
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + find.length)}`;
}

function buildRuntimeSource(source, config) {
  let output = source;
  output = replaceOnce(output, "const PORT = 3001;", `const PORT = ${config.port};`, "listen port");
  output = replaceOnce(output, "const MAX_SESSION_SECONDS = 19 * 60;", `const MAX_SESSION_SECONDS = ${config.maxSessionSeconds};`, "session cap");
  output = replaceOnce(output, "const POOL_TARGET = 5;", `const POOL_TARGET = ${config.poolTarget};`, "idle account pool");

  output = replaceOnce(
    output,
    `let poolFilling = false;`,
    `let poolFilling = false;\nlet poolFillPromise = null;`,
    "shared account-pool preparation"
  );
  output = replaceOnce(
    output,
    `async function fillPool() {`,
    `async function fillPoolWork() {`,
    "account-pool worker"
  );
  output = replaceOnce(
    output,
    `async function createAccount() {\n  if (pool.length > 0) {\n    const acc = pool.shift();\n    logSys(chalk.gray(\`pool: served account (\${pool.length} remaining)\`));\n    fillPool().catch(() => {});\n    return acc;\n  }\n  logSys(chalk.gray("pool: miss — creating account on demand"));\n  const acc = await createAccountRaw();\n  fillPool().catch(() => {});\n  return acc;\n}`,
    `function fillPool() {\n  if (poolFillPromise) return poolFillPromise;\n  poolFillPromise = fillPoolWork().finally(() => {\n    poolFillPromise = null;\n  });\n  return poolFillPromise;\n}\n\nasync function createAccount() {\n  if (pool.length > 0) {\n    const acc = pool.shift();\n    logSys(chalk.gray(\`pool: served account (\${pool.length} remaining)\`));\n    fillPool().catch(() => {});\n    return acc;\n  }\n  if (poolFillPromise) {\n    logSys(chalk.gray("pool: waiting for prepared account"));\n    await poolFillPromise;\n    if (pool.length > 0) {\n      const acc = pool.shift();\n      logSys(chalk.gray(\`pool: served account (\${pool.length} remaining)\`));\n      fillPool().catch(() => {});\n      return acc;\n    }\n  }\n  logSys(chalk.gray("pool: miss — creating account on demand"));\n  const acc = await createAccountRaw();\n  fillPool().catch(() => {});\n  return acc;\n}`,
    "account-pool launch coordination"
  );

  output = replaceOnce(
    output,
    `  const loginRes = await raccoonFetch("/users/emailLogin", {\n    method: "POST",\n    headers: h,\n    body: new URLSearchParams({ email, password: raccoonPassword, ...base }),\n  });\n  const loginData = await loginRes.json();`,
    `  const loginOptions = {\n    method: "POST",\n    headers: h,\n    body: new URLSearchParams({ email, password: raccoonPassword, ...base }),\n  };\n  let loginRes;\n  let loginData;\n  for (let attempt = 0; attempt < 2; attempt++) {\n    try {\n      loginRes = await raccoonFetch("/users/emailLogin", loginOptions);\n      loginData = await loginRes.json();\n      break;\n    } catch (error) {\n      if (attempt === 1) throw error;\n      logSys(chalk.gray("account login response interrupted - retrying"));\n      await new Promise(resolve => setTimeout(resolve, 750));\n    }\n  }`,
    "provider login response retry"
  );

  output = replaceOnce(
    output,
    `  } catch (e) {\n    releaseAccountSlot(apiKey);\n    push({ status: "error", error: e.message });\n    killSession(uuid, "creation_error");\n  }`,
    `  } catch (e) {\n    releaseAccountSlot(apiKey);\n    const rawError = String(e?.message || "Cloud Gaming provider error");\n    logApi(apiKey, chalk.red(\`createSession error - \${rawError}\`));\n    const publicError = /terminated|fetch failed|aborted|econnreset|etimedout|socket/i.test(rawError)\n      ? "The cloud provider connection was interrupted. Please retry."\n      : rawError;\n    push({ status: "error", error: publicError });\n    killSession(uuid, "creation_error");\n  }`,
    "provider creation error reporting"
  );

  output = replaceOnce(
    output,
    `  doStopGame(session).catch(() => {});\n  sessions.delete(uuid);`,
    `  const stopPromise = doStopGame(session).catch(() => {});\n  sessions.delete(uuid);`,
    "session stop tracking"
  );
  output = replaceOnce(
    output,
    `  );\n}\n\nfunction resetPingTimeout(uuid) {`,
    `  );\n  return stopPromise;\n}\n\nfunction resetPingTimeout(uuid) {`,
    "session stop completion"
  );

  output = replaceOnce(
    output,
    `  req.setTimeout(30_000, () => {\n    res.status(408).json({ error: "Request timeout." });\n  });`,
    `  const timeoutMs = req.path === "/cloud/v1/createSession" ? ${config.createTimeoutMs} : 30_000;\n  req.setTimeout(timeoutMs);\n  res.setTimeout(timeoutMs, () => {\n    if (!res.headersSent) res.status(408).json({ error: "Request timeout." });\n    else if (!res.writableEnded) res.end();\n  });`,
    "route-aware timeouts"
  );

  output = replaceOnce(
    output,
    `app.use(express.static(path.join(__dirname, "public")));`,
    `app.use((req, res, next) => {\n  res.setHeader("X-Content-Type-Options", "nosniff");\n  res.setHeader("Referrer-Policy", "no-referrer");\n  res.setHeader("X-Frame-Options", "SAMEORIGIN");\n  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");\n  res.setHeader("Cache-Control", "no-store");\n  next();\n});\n\napp.get("/cloud/v1/healthz", (_req, res) => {\n  res.json({ ok: true, service: "nyx-stratus", upstream_commit: ${JSON.stringify(expectedUpstream.commit)} });\n});\n\napp.get("/cloud/v1/source", (_req, res) => {\n  res.json({\n    license: "AGPL-3.0-only",\n    source: ${JSON.stringify(config.sourceUrl)},\n    upstream: "https://github.com/x8rr/stratus-api",\n    upstream_commit: ${JSON.stringify(expectedUpstream.commit)}\n  });\n});\n\napp.use(express.static(path.join(__dirname, "public")));`,
    "health, source, and response headers"
  );

  output = replaceOnce(
    output,
    `  const push = (obj) => res.write(JSON.stringify(obj) + "\\n");\n  const uuid = randomUUID();`,
    `  const uuid = randomUUID();\n  const push = (obj) => {\n    if (!res.destroyed && !res.writableEnded) res.write(JSON.stringify(obj) + "\\n");\n  };\n  res.once("close", () => {\n    if (!res.writableEnded) killSession(uuid, "client_disconnected");\n  });`,
    "client-disconnect cleanup"
  );

  const signalingOrigin = config.publicOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  output = replaceOnce(
    output,
    `  const proto = req.headers["x-forwarded-proto"] || req.protocol;\n  const signalingWs = \`${"${proto === \"https\" ? \"wss\" : \"ws\"}"}://${"${req.headers.host}"}/cloud/v1/signal/${"${uuid}"}\`;`,
    `  const signalingWs = ${JSON.stringify(`${signalingOrigin}/cloud/v1/signal/`)} + uuid;`,
    "public WebSocket origin"
  );

  output = replaceOnce(
    output,
    `        if (data.from === gl_key && data.body?.code === 200) {\n          toClient({ type: "game_ready" });\n        }`,
    `        if (data.from === gl_key && data.body?.code === 200) {\n          session.game_ready = true;\n          toClient({ type: "game_ready" });\n        }`,
    "provider readiness retention"
  );
  output = replaceOnce(
    output,
    `    session.clientWs = ws;\n\n    ws.on("message", (raw) => {`,
    `    session.clientWs = ws;\n    if (session.game_ready && ws.readyState === WebSocket.OPEN) {\n      ws.send(JSON.stringify({ type: "game_ready" }));\n    }\n\n    ws.on("message", (raw) => {`,
    "late player readiness replay"
  );

  output = replaceOnce(
    output,
    `httpServer.listen(PORT, () => {`,
    `let shuttingDown = false;\nfunction shutdown(signal) {\n  if (shuttingDown) return;\n  shuttingDown = true;\n  logSys(chalk.gray(\`shutdown: \${signal}\`));\n  const stops = [...sessions.keys()].map(uuid => killSession(uuid, "service_shutdown"));\n  Promise.allSettled(stops).finally(() => httpServer.close(() => process.exit(0)));\n  setTimeout(() => process.exit(1), 10_000).unref();\n}\nprocess.once("SIGTERM", () => shutdown("SIGTERM"));\nprocess.once("SIGINT", () => shutdown("SIGINT"));\n\nhttpServer.listen(PORT, "127.0.0.1", () => {`,
    "loopback binding and graceful shutdown"
  );
  return output;
}

function buildRuntimeEmbed(source) {
  let output = replaceOnce(
    source,
    "/api/cloud/embed-data?id=",
    "/cloud/v1/embed-data?id=",
    "embed-data route"
  );
  output = replaceOnce(
    output,
    `        let mouseButtons = 0;
        const activeKeys = new Set();`,
    `        let mouseButtons = 0;
        let pendingMoveX = 0, pendingMoveY = 0;
        const MOUSE_FLUSH_INTERVAL_MS = 8;
        const MAX_MOUSE_BUFFERED_BYTES = 1024;
        const activeKeys = new Set();`,
    "coalesced mouse state"
  );
  output = replaceOnce(
    output,
    `        document.addEventListener("mousemove", (e) => {`,
    `        const pointerMovementEvent = "onpointerrawupdate" in window ? "pointerrawupdate" : "mousemove";
        document.addEventListener(pointerMovementEvent, (e) => {`,
    "raw pointer movement"
  );
  output = replaceOnce(
    output,
    `        function getVideoRect() {
            const rect = streamEl.getBoundingClientRect();
            const vw   = streamEl.videoWidth  || rect.width;
            const vh   = streamEl.videoHeight || rect.height;
            const scale = Math.min(rect.width / vw, rect.height / vh);
            const rw = vw * scale, rh = vh * scale;
            return {
                left:   rect.left + (rect.width  - rw) / 2,
                top:    rect.top  + (rect.height - rh) / 2,
                width:  rw,
                height: rh,
            };
        }`,
    `        let cachedVideoRect = null;
        function invalidateVideoRect() {
            cachedVideoRect = null;
        }
        function getVideoRect() {
            if (cachedVideoRect) return cachedVideoRect;
            const rect = streamEl.getBoundingClientRect();
            const vw   = streamEl.videoWidth  || rect.width;
            const vh   = streamEl.videoHeight || rect.height;
            const scale = Math.min(rect.width / vw, rect.height / vh);
            const rw = vw * scale, rh = vh * scale;
            cachedVideoRect = {
                left:   rect.left + (rect.width  - rw) / 2,
                top:    rect.top  + (rect.height - rh) / 2,
                width:  rw,
                height: rh,
            };
            return cachedVideoRect;
        }
        new ResizeObserver(invalidateVideoRect).observe(streamEl);
        streamEl.addEventListener("loadedmetadata", invalidateVideoRect);
        document.addEventListener("fullscreenchange", invalidateVideoRect);
        window.addEventListener("resize", invalidateVideoRect, { passive: true });`,
    "cached video geometry"
  );
  output = replaceOnce(
    output,
    `        function setupCursorHandling(dc) {
            const MIMEMAP = { 0: "image/x-icon", 1: "image/jpeg", 2: "image/png", 3: "image/gif" };
            let currentCursorUrl = null;
            dc.onmessage = (e) => {
                if (!(e.data instanceof ArrayBuffer)) return;
                const v = new DataView(e.data);
                if (v.byteLength > 4 && v.getUint8(0) === 163 && v.getUint8(1) === 6) {
                    if (v.byteLength <= 32) {
                        streamEl.style.cursor = "none";
                        if (currentCursorUrl) { URL.revokeObjectURL(currentCursorUrl); currentCursorUrl = null; }
                    } else {
                        const mimeType = MIMEMAP[v.getUint8(2)] || "image/png";
                        const hotX = v.getUint8(3), hotY = v.getUint8(4);
                        const blob = new Blob([e.data.slice(5)], { type: mimeType });
                        if (currentCursorUrl) URL.revokeObjectURL(currentCursorUrl);
                        currentCursorUrl = URL.createObjectURL(blob);
                        streamEl.style.cursor = \`url(\${currentCursorUrl}) \${hotX} \${hotY}, default\`;
                        if (document.pointerLockElement === streamEl) document.exitPointerLock();
                    }
                }
            };
        }`,
    `        const localCursorEl = document.createElement("img");
        localCursorEl.alt = "";
        localCursorEl.setAttribute("aria-hidden", "true");
        Object.assign(localCursorEl.style, {
            position: "fixed",
            left: "0",
            top: "0",
            zIndex: "40",
            pointerEvents: "none",
            display: "none",
            maxWidth: "none",
            maxHeight: "none"
        });
        document.body.appendChild(localCursorEl);
        let currentCursorUrl = null;
        let cursorHotX = 0, cursorHotY = 0;
        function updateLocalCursor() {
            if (!pointerLocked || !currentCursorUrl) return;
            localCursorEl.style.transform = \`translate3d(\${curX - cursorHotX}px, \${curY - cursorHotY}px, 0)\`;
        }
        function syncCursorPresentation() {
            if (pointerLocked) {
                streamEl.style.cursor = "none";
                localCursorEl.style.display = currentCursorUrl ? "block" : "none";
                updateLocalCursor();
            } else {
                localCursorEl.style.display = "none";
                streamEl.style.cursor = currentCursorUrl
                    ? \`url(\${currentCursorUrl}) \${cursorHotX} \${cursorHotY}, default\`
                    : "none";
            }
        }
        function setupCursorHandling(dc) {
            const MIMEMAP = { 0: "image/x-icon", 1: "image/jpeg", 2: "image/png", 3: "image/gif" };
            dc.onmessage = (e) => {
                if (!(e.data instanceof ArrayBuffer)) return;
                const v = new DataView(e.data);
                if (v.byteLength > 4 && v.getUint8(0) === 163 && v.getUint8(1) === 6) {
                    if (v.byteLength <= 32) {
                        if (currentCursorUrl) URL.revokeObjectURL(currentCursorUrl);
                        currentCursorUrl = null;
                        localCursorEl.removeAttribute("src");
                    } else {
                        const mimeType = MIMEMAP[v.getUint8(2)] || "image/png";
                        cursorHotX = v.getUint8(3);
                        cursorHotY = v.getUint8(4);
                        const blob = new Blob([e.data.slice(5)], { type: mimeType });
                        if (currentCursorUrl) URL.revokeObjectURL(currentCursorUrl);
                        currentCursorUrl = URL.createObjectURL(blob);
                        localCursorEl.src = currentCursorUrl;
                    }
                    syncCursorPresentation();
                }
            };
        }`,
    "persistent pointer-lock cursor"
  );
  output = replaceOnce(
    output,
    `                sendMouse(moveX, moveY, 0);
            } else {`,
    `                pendingMoveX += moveX;
                pendingMoveY += moveY;
            } else {`,
    "coalesced mouse movement"
  );
  output = replaceOnce(
    output,
    `        document.addEventListener("mousedown", (e) => {
            if (!streamFocused || !_dc) return;
            if (streamEl.style.cursor === "none" && !pointerLocked) {
                streamEl.requestPointerLock().catch(() => {});
            }
            mouseButtons = e.buttons;
            sendMouse(0, 0, 0);
        });`,
    `        document.addEventListener("mousedown", (e) => {
            if (!_dc || e.target !== streamEl) return;
            if (!streamFocused) {
                streamFocused = true;
                navigator.keyboard?.lock?.().catch(() => {});
            }
            if (!pointerLocked) {
                curX = e.clientX;
                curY = e.clientY;
                streamEl.requestPointerLock({ unadjustedMovement: true })
                    .catch(() => streamEl.requestPointerLock().catch(() => {}));
            }
            flushMouse();
            mouseButtons = e.buttons;
            sendMouse(0, 0, 0);
        });`,
    "first-click mouse capture"
  );
  output = replaceOnce(
    output,
    `            } else {
                navigator.keyboard?.unlock?.();
            }
        });`,
    `            } else {
                navigator.keyboard?.unlock?.();
            }
            syncCursorPresentation();
        });`,
    "pointer-lock cursor presentation"
  );
  output = replaceOnce(
    output,
    `                    curX = r.left + vMouseX;
                    curY = r.top  + vMouseY;
                } else {`,
    `                    curX = r.left + vMouseX;
                    curY = r.top  + vMouseY;
                    updateLocalCursor();
                } else {`,
    "virtual cursor movement"
  );
  output = replaceOnce(
    output,
    `            mouseButtons = e.buttons;
            sendMouse(0, 0, 0);
        });
        document.addEventListener("contextmenu"`,
    `            flushMouse();
            mouseButtons = e.buttons;
            sendMouse(0, 0, 0);
        });
        document.addEventListener("contextmenu"`,
    "mouse release ordering"
  );
  output = replaceOnce(
    output,
    `        function sendMouse(moveX = 0, moveY = 0, scroll = 0) {
            moveX = Math.max(-127, Math.min(127, moveX));
            moveY = Math.max(-127, Math.min(127, moveY));
            const r    = getVideoRect();`,
    `        function flushMouse() {
            if (!_dc || _dc.readyState !== "open") {
                pendingMoveX = 0;
                pendingMoveY = 0;
                return;
            }
            if (_dc.bufferedAmount > MAX_MOUSE_BUFFERED_BYTES) return;
            let moveX = pendingMoveX;
            let moveY = pendingMoveY;
            pendingMoveX = 0;
            pendingMoveY = 0;
            if (!moveX && !moveY) return;
            const rect = getVideoRect();
            while (moveX || moveY) {
                if (_dc.bufferedAmount > MAX_MOUSE_BUFFERED_BYTES) {
                    pendingMoveX += moveX;
                    pendingMoveY += moveY;
                    return;
                }
                const stepX = Math.max(-127, Math.min(127, moveX));
                const stepY = Math.max(-127, Math.min(127, moveY));
                sendMouse(stepX, stepY, 0, rect);
                moveX -= stepX;
                moveY -= stepY;
            }
        }
        function sendMouse(moveX = 0, moveY = 0, scroll = 0, rect = null) {
            moveX = Math.max(-127, Math.min(127, moveX));
            moveY = Math.max(-127, Math.min(127, moveY));
            const r    = rect || getVideoRect();`,
    "frame-paced mouse sender"
  );
  output = replaceOnce(
    output,
    `        }
        requestAnimationFrame(inputLoop);`,
    `        }
        setInterval(flushMouse, MOUSE_FLUSH_INTERVAL_MS);
        requestAnimationFrame(inputLoop);`,
    "low-latency mouse pump"
  );
  return output;
}

async function prepareRuntime() {
  const apiKey = requiredApiKey();
  const origin = publicOrigin();
  const config = Object.freeze({
    apiKey,
    publicOrigin: origin,
    sourceUrl: httpsSourceUrl(),
    port: boundedInteger("STRATUS_PORT", 3001, 1024, 65_535),
    maxConcurrentSessions: boundedInteger("STRATUS_MAX_CONCURRENT_SESSIONS", 4, 1, 12),
    maxSessionSeconds: boundedInteger("STRATUS_MAX_SESSION_SECONDS", 1_140, 60, 1_140),
    createTimeoutMs: boundedInteger("STRATUS_CREATE_TIMEOUT_MS", 180_000, 60_000, 300_000),
    poolTarget: boundedInteger("STRATUS_ACCOUNT_POOL_TARGET", 1, 0, 2),
    perMinute: boundedInteger("STRATUS_LIMIT_PER_MINUTE", 4, 1, 30),
    perHour: boundedInteger("STRATUS_LIMIT_PER_HOUR", 20, 1, 300),
    perDay: boundedInteger("STRATUS_LIMIT_PER_DAY", 80, 1, 2_000),
    perMonth: boundedInteger("STRATUS_LIMIT_PER_MONTH", 500, 1, 20_000)
  });

  const runtimeDir = path.resolve(String(process.env.STRATUS_RUNTIME_DIR || path.join(serviceDir, ".runtime")));
  const apiSource = normalized(await readFile(path.join(upstreamDir, "api.js"), "utf8"));
  const embedSource = normalized(await readFile(path.join(upstreamDir, "public", "e.html"), "utf8"));
  assertDigest("The vendored API", sha256(apiSource), expectedUpstream.apiSha256);
  assertDigest("The vendored embed client", sha256(embedSource), expectedUpstream.embedSha256);

  const runtimeSource = buildRuntimeSource(apiSource, config);
  const runtimeEmbed = buildRuntimeEmbed(embedSource);
  const sites = {
    sites: {
      nyx: {
        api_key: apiKey,
        enabled: true,
        max_concurrent_sessions: config.maxConcurrentSessions,
        max_session_seconds: config.maxSessionSeconds,
        limits: {
          per_minute: config.perMinute,
          per_hour: config.perHour,
          per_day: config.perDay,
          per_month: config.perMonth
        }
      }
    }
  };

  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(path.join(runtimeDir, "public"), { recursive: true, mode: 0o750 });
  await writeFile(path.join(runtimeDir, "api.cjs"), runtimeSource, { encoding: "utf8", mode: 0o640 });
  await writeFile(path.join(runtimeDir, "sites.json"), `${JSON.stringify(sites, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await writeFile(path.join(runtimeDir, "public", "e.html"), runtimeEmbed, { encoding: "utf8", mode: 0o640 });
  return { runtimeDir, runtimeSource, config };
}

async function main() {
  const prepared = await prepareRuntime();
  if (process.argv.includes("--check")) {
    console.log(`Stratus runtime verified at pinned commit ${expectedUpstream.commit}.`);
    await rm(prepared.runtimeDir, { recursive: true, force: true });
    return;
  }

  const child = spawn(process.execPath, [path.join(prepared.runtimeDir, "api.cjs")], {
    cwd: prepared.runtimeDir,
    env: {
      ...process.env,
      STRATUS_API_KEY: undefined,
      NODE_PATH: [path.join(serviceDir, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(path.delimiter)
    },
    stdio: "inherit"
  });
  const forward = signal => {
    if (!child.killed) child.kill(signal);
  };
  process.once("SIGTERM", () => forward("SIGTERM"));
  process.once("SIGINT", () => forward("SIGINT"));
  child.once("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

main().catch(error => {
  console.error(`Nyx Stratus service failed: ${error.message}`);
  process.exitCode = 1;
});
