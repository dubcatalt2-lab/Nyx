importScripts("/scramjet-v1/scramjet.all.js?v=nyx-sj-v1-ready-before-route-v5");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const scramjetReady = scramjet.loadConfig();

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith((async () => {
    await scramjetReady;
    if (scramjet.route(event)) return scramjet.fetch(event);
    return fetch(event.request);
  })());
});
