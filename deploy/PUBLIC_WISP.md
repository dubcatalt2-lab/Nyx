# Public Wisp endpoint

Compatible clients can configure `wss://nyxlearning.org/wisp/` after deploying this restored server. `/wisp` and `/wisp/` both use the embedded Wispurr service; no separate relay process is needed. The existing `/resources/live/` endpoint remains compatible.

This is a WebSocket endpoint, not a search website. Opening the URL in a normal browser address bar does not test the protocol. Clients on other origins are supported without a Nyx login. IP bans, bounded buffers/streams, TCP ports 80/443 and upstream private/loopback-network restrictions remain in place.

The embedded endpoint requires `WISP_URL` external-relay overrides to be unset; check the configured variable in server.js before changing production environment settings. Do not print private environment files.

Check a running server:

```
node scripts/test-public-wisp.mjs ws://localhost:8080/wisp/
node scripts/test-public-wisp.mjs wss://nyxlearning.org/wisp/
```

As of October 14, 2026, localhost passes the cross-origin Wisp handshake; the old deployed server returns 404 and still needs this release activated.
