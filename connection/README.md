# Covenant engine

The release service is `isolated-app.mjs`. Set `DOCUMENT_SUFFIX`,
`DOCUMENT_STATE_DIR`, and `PORT`, then run `node connection/isolated-app.mjs`.
`mission/install-document-service.sh` installs the separate systemd service and
wildcard HTTPS routing. The main app uses `DOCUMENT_ORIGIN` for its broker.

Each remote origin gets its own hashed hostname, DOM/storage boundary, and
service worker. Cookie jars persist in private server files; HttpOnly cookies
are never included in page runtime data. Native browser cookie partitioning is
preserved. Worker requests use single-use, 30-second tickets issued through the
owning window, restricted to that remote origin. Tickets cannot be reused or
used to access another site's jar. Navigation establishes the destination's
HttpOnly session before worker requests begin.

Clicked windows can open and exchange origin-checked callback messages. Popups
without a current trusted interaction remain blocked. Chrome and Edge tests
cover this through the actual nested Nyx shell, session reload/persistence,
CORS, workers and authenticated streams. Provider login completion still needs
live verification; cookie-only OAuth callbacks across different top-level
partitions are not claimed to share an authenticated session.

The single-origin development preview below remains for transport testing and
must not be used as the production isolation boundary.

Original transport and document transformation; no removed engine is wrapped or restored.

From the Nyx repository after installing its build tools:

```sh
npm ci --prefix connection
npm --prefix connection run build
npm --prefix connection test
npm --prefix connection start
```

The preview binds to 127.0.0.1:8082. It has no Nyx accounts or keys. Press Open to activate the connection, without an artificial delay. Nothing opens a socket on initial load.

The service handler is registered at /boot/start.js. The server endpoint is /api/sync. Each request uses one socket, allowing cancellation without adding undocumented message types. Server responses use WebSocket continuation frames and a final frame, so the server sends chunks without collecting the whole response. Browser message delivery still buffers the completed response, capped at 32 MiB; uploads are capped at 8 MiB.

The owner window and worker communicate through a session-specific MessageChannel. Registration waits for the current worker to activate, and existing windows reconnect after a stopped or replaced worker. No external transport library executes in the browser.

Startup assets negotiate Brotli or gzip and revalidate with content-based ETags. File changes invalidate the in-memory representations, including compressed copies. Generic worker URLs never receive immutable caching. Run `npm --prefix connection run measure:loading` for transfer sizes and a controlled Chrome opening benchmark; timings are measurements, not a pass/fail threshold.

Supported tests cover HTML, document bases, CSS imports/resources, scripts, dynamic fetch, Request, XMLHttpRequest, imports, redirects classic/module workers, 40 concurrent requests, and same-document classic/module SharedWorker sharing. DNS is validated and pinned to the validated address set. Error and truncated responses are not presented as successful results.

Live text/binary WebSockets and incremental event streams now have original implementations and browser tests. Cookie sessions persist per profile, with domain/path/expiry handling, synchronous document.cookie updates and HttpOnly exclusion from that getter. Authenticated live streams, independent remote-origin security/storage isolation, complete history emulation and cross-document SharedWorker lifecycle coverage remain unfinished. Remote scripts still share the preview origin, so the cookie getter restriction is not a secure boundary against hostile scripts accessing origin storage. Keep this preview separate from real account origins and credentials. It does not fall back to another engine.

Production output retains parser license notices. The release audit counts syntax-tree calls; CSS parser methods named Function are separately listed rather than treated as native code construction. See ../scrolls/RELEASE_REPAIRS.md for the current release results and remaining limitations.
