# Engine comparison and regression repairs — 2026-10-12

## COMPLETED

- Reviewed the upstream v2 reference at commit `b14b709ac190b786dd03becbd0728ab72bdd3ad6` (package version `2.0.67-alpha.2`) outside this repository. Compared request construction, response addresses, document bases, worker initialization, destination-specific body handling, redirects, cookies, syntax traversal and connection lifetime. No reference source, package, WASM or wrapper was copied into Nyx.
- Added original regression fixtures before repairing Request construction, exposed request/response/XHR/base addresses, and module-worker dependencies. The existing engine failed those fixtures in Chrome.
- Initialize isolated module-worker context from its own routed address, before imported dependencies execute. Only worker entry scripts receive startup code; dependencies no longer receive the invalid classic startup call.
- Transform HTML only for document destinations and CSS/JavaScript only for executable destinations. Data fetches preserve their original bodies. Upstream script error statuses and redirect bodies are retained rather than parsed into new gateway failures.
- Invalid individual URLs and inline syntax errors no longer prevent the rest of a document from being delivered. Syntax errors remain visible to the browser. Declared character encodings are decoded before transformed output is emitted as UTF-8.
- Preserve opaque CORS origins. Retain separate site origins, server-side HttpOnly cookies, authorization tickets and destination validation.
- Reuse upstream connections by exact origin and freshly validated address set. Bound the pool to 32 origins, six connections per origin and 15-second idle lifetime. Request headers, bodies and cookies remain per request. Changed DNS addresses cannot reuse a prior pool entry.
- Identify gateway failures by stage in the `X-Document-Failure` response header. Await asynchronous transformation inside the handler's error boundary; propagate request cancellation. Server transport diagnostics contain no destination URLs, credentials or cookie values.
- Retain real Wispurr on the server as explicitly requested. Search still uses the original document engine. The reference engine has not been silently restored.

Reference locations: [request APIs](https://github.com/MercuryWorkshop/scramjet/blob/b14b709ac190b786dd03becbd0728ab72bdd3ad6/packages/core/src/client/shared/requests/fetch.ts), [body handling](https://github.com/MercuryWorkshop/scramjet/blob/b14b709ac190b786dd03becbd0728ab72bdd3ad6/packages/core/src/fetch/body.ts), [worker handling](https://github.com/MercuryWorkshop/scramjet/blob/b14b709ac190b786dd03becbd0728ab72bdd3ad6/packages/core/src/client/shared/worker.ts), [syntax handling](https://github.com/MercuryWorkshop/scramjet/blob/b14b709ac190b786dd03becbd0728ab72bdd3ad6/packages/core/rewriter/js/src/visitor.rs). These are behavioral comparisons, not a claim of feature parity or a benchmark of the reference implementation.

## INCOMPLETE / LIMITS

- A screenshot does not identify the cause of every historical 502. The opaque-origin failure, parser-startup deadlock and compatibility regressions have concrete reproductions; new stage diagnostics distinguish future failures.
- Fresh DuckDuckGo sessions may receive its human-verification challenge. A styled challenge is not proof that search results beyond it work. Live measurements must label that distinction.
- The engine does not yet reproduce every browser semantic handled by a mature engine: dynamic generated JavaScript, every destructuring/global alias, worklets, all DOM URL APIs, complete charset sniffing and every redirect-chain/SameSite case remain outside this tested repair. Complete third-party OAuth and all games are not certified by these tests.
- The external Study Tools userscript's invalid cross-origin registration and the separate AI-model API 503 are not engine asset failures and are unchanged. The user's external tab-title behavior is preserved.
- This review does not claim that all previously requested release work is finished. See `SEARCH_RELAY_REPAIR.md` for Drop retirement, restored dependency scope and DNS limitations.

## VERIFICATION OUTPUT

Raw logs remain in ignored `.codex-artifacts/engine-*.log`.

Before the repairs:

```text
✖ upstream script errors retain their status and body
✖ redirects preserve bodies without compiling them as scripts
✖ data HTML is returned without document runtime injection
✖ malformed resource addresses do not destroy the surrounding document
✖ a syntax error in one inline script does not prevent document delivery
✖ declared legacy text encoding is decoded and normalized after transformation
Upstream TCP connections for six sequential resources: 6
Uncaught TypeError: Failed to execute 'importScripts' on 'WorkerGlobalScope': Module scripts don't support importScripts().
```

After the repairs:

```text
Upstream TCP connections for six sequential resources: 1
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
PASS Request construction/cloning, original request/response/XHR/base addresses, module runtime before dependencies
PASS startup deadlock: queued authorization reaches the page before DOMContentLoaded; scripts and styles load
PASS large external scripts/styles compiled off the request thread and rendered
PASS opaque-origin stylesheet request preserves Origin null without failing URL parsing
```

The isolated tests above pass in Chrome and Edge through Nyx's actual nested shell. They also cover cookies after refresh, separate storage, HttpOnly exclusion, unauthorized-origin rejection, CORS, Worker/SharedWorker, event streams, clicked sign-in windows and cross-window callbacks. The broader network/browser suite passes static HTML, CSS, JavaScript/fetch, 40 concurrent requests, search filters, worker replacement, dynamic markup/styles, redirects and disconnect cancellation.

Component build audit:

```json
{"passed":true,"files":7,"counts":{"atob":0,"eval":0,"Function":0},"rawMatches":0,"blockingFindings":0,"pathMatches":0,"parseErrors":0,"sourceMaps":0}
```

`npm run check:deploy` passed: 288 required files found. Release audit and live verification are recorded at activation; no production activation was inferred from local test results.

## FILES CHANGED

- `connection/address.mjs`
- `connection/compatibility.test.mjs` (new)
- `connection/connections.mjs` (new)
- `connection/connections.test.mjs` (new)
- `connection/isolated-app.mjs`
- `connection/isolated-smoke.mjs`
- `connection/isolated-worker.mjs`
- `connection/package.json`
- `connection/runtime.js`
- `connection/server.mjs`
- `connection/transform.mjs`
- `connection/worker.mjs`
- `scrolls/ENGINE_DEBUG_REVIEW.md` (this report)

No public API function was renamed. New internal functions are `connections` and `decodedText`.

## DEPENDENCIES REMOVED

None in this comparison pass. The separately recorded server restoration of `wispurr@4.2.0` remains intentional. No other removed engine is restored, disguised, wrapped or vendored.
