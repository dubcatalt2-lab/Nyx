# Search and relay repair — 2026-10-12

The owner explicitly requested that Wispurr be retained after the earlier dependency purge. The real `wispurr@4.2.0` package is restored on the server, with its identity and license intact. `/api/relay` supports its v1/v2 clients and starts a worker on demand. The custom document transport and HTML/CSS/JavaScript rewriter continue to handle Nyx search. Wispurr is not represented as an original implementation or as the solution to rewriting delays.

## COMPLETED

- Reproduced a stylesheet 502 when a request has the legitimate serialized opaque origin `null`. Preserve that value rather than passing it to URL parsing. This fixes one confirmed failure matching the server's invalid-URL errors; it does not establish that every error in the user's browser had that cause.
- Reduced unnecessary syntax-node processing while preserving scope analysis. Twelve captured assets produce identical transformed output.
- Move large server-side JavaScript/CSS transformations into two bounded worker threads. Queue stylesheets first. Keep the existing exact-source cache, isolated sessions, cookies and request policy. Capacity, timeout, shutdown and parse failures remain errors.
- Restore the actual Wispurr dependency and first-party private-worker adapter, under `scripture/communion-relay.mjs`. The Go worker requires fresh internal credentials, denies private/loopback destinations and restricts ports to 80/443. The public endpoint checks origins and denies retired Drop hosts. No other removed engine is restored.
- Delete the Drop application, its Nook embedding, owner override and API alias. Retire both known Drop hostnames and all Drop app/API paths with HTTP 410. Deny future certificate authorization for those hosts. No account/history data is deleted.
- Build the static release in `.nyx-releases/release-20261012-drop-search/site`. Do not rebuild the directory used by the active localhost preview: the old build process deletes that directory first.

## INCOMPLETE / LIMITS

- DuckDuckGo can return its human verification page from this VPS. Fresh automated tests render it; they do not prove access to results beyond that challenge.
- Existing AI catalog 503 and the external Study Tools userscript's cross-origin Railway worker registration are separate issues. The user requested preservation of their external tab-cloaking behavior.
- DNS records are not deleted: DNS administration is unavailable. Drop is disconnected at the application and web-server routes. `drop.ridgewoodstem.org` does not currently respond over public HTTPS; direct Host-header checks cover its retirement.
- Wispurr is intentionally present in the server dependency tree. Earlier statements that every removed package is absent no longer describe the owner's current requirements. Browser-output audits remain unchanged; only the exact Wispurr dependency exception is permitted.

## VERIFICATION OUTPUT

Raw logs are retained in ignored `.codex-artifacts`.

Before the origin correction:

```text
AssertionError [ERR_ASSERTION]: Serialized opaque Origin must not break stylesheet loading
502 !== 200
```

After the correction in Chrome and Edge through the real nested shell:

```text
PASS startup deadlock: queued authorization reaches the page before DOMContentLoaded; scripts and styles load
PASS large external scripts/styles compiled off the request thread and rendered
PASS opaque-origin stylesheet request preserves Origin null without failing URL parsing
```

Unit/network tests: 22 passed, 0 failed. Browser fixtures cover HTML, external CSS, scripts/fetch, filter navigation, cookies after refresh, worker lifecycle, sockets, streams, popups and cross-window callbacks. Nook reply formatting/history/mobile checks pass after removing Drop embedding.

```text
Direct worker access rejects missing and incorrect internal credentials.
/api/relay Wisp v1: anonymous HTTP and restricted egress passed
/api/relay Wisp v2: anonymous HTTP and restricted egress passed
Worker shutdown closes active relay sessions.
PASS actual app: same-origin relay connects; missing/foreign origins and retired Drop domain are rejected
PASS Drop domains, app paths, encoded paths and APIs retired; certificate requests denied; Nyx health preserved
```

The staged build audit reports 5,170 files; atob 0, eval 2, Function 2; 452 raw matches, all individually classified; zero blocked findings, forbidden paths, parse errors or source maps.

VPS diagnostic asset batch, before/after: 5,438 ms / 3,991 ms cold. This is a batch of eleven fetched and transformed assets, not a complete search-result timing. Maximum timer gap during the revised batch was 83 ms. Live-browser timings are recorded after deployment below.

## FILES CHANGED

The release commit is the authoritative complete file list (`git show --name-status`). Changes cover `connection` compiler/transform/origin handling and tests; `shepherd.js`; the restored server relay and its tests; retired Drop middleware/tests; Drop app/test deletions; Nook embedding removal; package manifest/lockfile; build required-file lists; Caddy template; CI and this report.

## DEPENDENCIES REMOVED / RESTORED

No additional dependency was removed in this repair. Restored: `wispurr@4.2.0` with chalk, detect-port, address and its TypeScript peer. The other previously removed networking and rewriting packages remain absent. The Wispurr adapter deliberately imports the real package; it does not conceal or vendor it.
