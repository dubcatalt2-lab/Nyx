# Document connection prototype

Original transport and document transformation, isolated from the main application's engine. This is not ready to replace production browsing.

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

Production output retains parser license notices. The release audit counts syntax-tree calls; CSS parser methods named Function are separately listed rather than treated as native code construction. The full application audit still fails. See ../scrolls/CONNECTION_REPLACEMENT.md for release state.
