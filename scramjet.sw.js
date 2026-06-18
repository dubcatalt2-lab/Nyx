importScripts("/controller/controller.sw.js");

self.__goodlionScramjetRevivePromise = null;

function goodlionScramjetRouteMissHtml() {
  return `<!doctype html>
<meta charset="utf-8">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101318;color:#f5f7fb;font:15px/1.45 system-ui,sans-serif}
  main{max-width:560px;padding:28px;text-align:center}
  h1{font-size:20px;margin:0 0 10px}
  p{margin:0;color:#c8ced8}
</style>
<main>
  <h1>Scramjet route missed</h1>
  <p>The Scramjet service worker did not reconnect to GoodLion in time. Reload GoodLion and try again.</p>
</main>`;
}

function goodlionIsScramjetRequest(event) {
  try {
    return new URL(event.request.url).pathname.startsWith("/~/sj/");
  } catch {
    return false;
  }
}

function goodlionDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function goodlionNotifyScramjetControllers() {
  if (self.__goodlionScramjetRevivePromise) return self.__goodlionScramjetRevivePromise;
  self.__goodlionScramjetRevivePromise = (async () => {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window"
    });
    for (const client of clients) {
      try {
        client.postMessage({ $controller$swrevive: {} });
      } catch {}
    }
    await goodlionDelay(60);
  })().finally(() => {
    self.__goodlionScramjetRevivePromise = null;
  });
  return self.__goodlionScramjetRevivePromise;
}

async function goodlionRouteAfterRevive(event) {
  await goodlionNotifyScramjetControllers();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ($scramjetController.shouldRoute(event)) {
      return goodlionRouteScramjet(event);
    }
    await goodlionDelay(50);
  }
  return new Response(goodlionScramjetRouteMissHtml(), {
    status: 502,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function goodlionRouteScramjet(event) {
  return $scramjetController.route(event);
}

self.addEventListener("fetch", event => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith(goodlionRouteScramjet(event));
    return;
  }
  if (goodlionIsScramjetRequest(event)) {
    event.respondWith(goodlionRouteAfterRevive(event));
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(goodlionNotifyScramjetControllers().catch(() => {}));
});

setTimeout(() => {
  goodlionNotifyScramjetControllers().catch(() => {});
}, 120);
