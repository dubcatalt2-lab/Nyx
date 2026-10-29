importScripts("/assets/vendor/r7f29c1/8b3rt.js", "/apps/r7f29c1/r41c9.js", "/assets/vendor/r7f29c1/1vN6h.js");
const processor = new fPvwK();
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (processor.route(event)) event.respondWith(processor.fetch(event));
});
