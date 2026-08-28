importScripts("/scramjet-v1/scramjet.all.js?v=nyx-sj-v1-controller-first-v3");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (scramjet.route(event)) event.respondWith(scramjet.fetch(event));
});
