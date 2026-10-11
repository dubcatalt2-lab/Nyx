# DuckDuckGo result repair - 2026-10-10

Local source at `.worktrees/nyx-page-wording-20261008`, running on localhost:8080 with the document service on localhost:8082. This report supersedes the DuckDuckGo challenge/result limitation in SEARCH_AND_UI_VERIFICATION.md. The wider refactor remains incomplete and is not deployed.

## COMPLETED

- Traced the exact live failure: the image endpoint returned HTTP 200 and valid JSON with `application/x-javascript`. The old transformation tried to parse the data as a JavaScript program, raised `Unexpected token (1:6)`, and returned 502. Data requests now preserve valid JSON; executable script responses still use the original AST transformation.
- Rebuilt dynamic-content handling using the existing original HTML/CSS parsers: inner/outer HTML, adjacent/contextual fragments, responsive image candidates, style attributes, style properties, stylesheet rules and constructed stylesheets. Preserved table/template/shadow contexts and prevented repeated routing of copied markup.
- Corrected startup waiting for worker updates. Reconnect existing document windows when their service worker restarts or is replaced. Browser tests deliberately stop and replace the worker, then click a filter and verify results without reopening the page.
- In the visible Chrome test, the user completed DuckDuckGo's human verification. Real Images, image detail, Videos, a Blue color filter, return to All/web, and return to Images then worked with `q=e` preserved. Real result payloads contained 51 images, 60 videos, and 75 filtered images. Screenshots are in `.codex-artifacts/images-live-fixed.png`, `images-detail-fixed.png`, `videos-live-fixed.png`, `images-color-fixed.png`, and `all-live-fixed.png`.
- Added cross-browser regression coverage to `npm run test:network`, already invoked by the connection CI job. Chrome and Edge both pass the controlled dynamic-content and worker-lifecycle tests. Desktop/mobile shell controls also pass.
- No removed library, local legacy copy, facade or wrapper was added. The user's external Classes-cloaking userscript was not changed.

## INCOMPLETE

- The complete production build still fails its pre-existing strict release gate: 664 signature matches, 12 flagged paths, 24 eval calls and 25 Function calls. Nothing was pushed or deployed by this repair.
- The wider refactor issues and six failed broad UI suites recorded in SEARCH_AND_UI_VERIFICATION.md remain open. This repair resolves the demonstrated dynamic image and worker lifecycle failures; it does not establish universal external-site compatibility or complete remote-site isolation.
- Real provider verification may recur; no challenge was bypassed or replaced with fabricated results. Live evidence here is Chrome after human verification; Edge has controlled regression evidence.
- No comparable pre-refactor whole-application size baseline exists. The before/after figures below cover this repair's three document JavaScript bundles only.
- The exact statement "No removed package appears in the final build in any form" is not established for the complete application. Dependency checks pass, but the full strict scan fails; every remaining raw match is included below.

## VERIFICATION OUTPUT

Captured upstream failure before the data fix:

```text
WIRE /i.js 0 200 application/x-javascript; charset=UTF-8
TRANSFORM FAIL Unexpected token (1:6)
RESULT_RESPONSE {"endpoint":"/i.js","query":"e","status":502,"responseType":null,"results":null}
```

Live responses after the fix (captured metadata only; no cookies or verification tokens):

```json
{
  "responses": [
    {
      "endpoint": "/i.js",
      "query": "e",
      "status": 200,
      "responseType": "images",
      "results": 51
    },
    {
      "endpoint": "/v.js",
      "query": "e",
      "status": 200,
      "responseType": "videos",
      "results": 60
    },
    {
      "endpoint": "/i.js",
      "query": "e",
      "status": 200,
      "responseType": "images",
      "results": 51
    },
    {
      "endpoint": "/i.js",
      "query": "e",
      "status": 200,
      "responseType": "images",
      "results": 75
    },
    {
      "endpoint": "/i.js",
      "query": "e",
      "status": 200,
      "responseType": "images",
      "results": 75
    }
  ],
  "errors": []
}
```

### Unit tests

```text
✔ data responses retain valid JSON despite a JavaScript media type (6.3973ms)
✔ document location transformation preserves local bindings and property names (4.2312ms)
✔ window aliases expose the original location without changing ordinary location properties (2.1366ms)
✔ worker startup follows replacements instead of waiting on a redundant worker (5.8749ms)
✔ document edits preserve nested imports, location arguments and large programs (102.2045ms)
✔ production constant storage preserves text, keys and unmatched UTF-16 units (3.4444ms)
✔ event records survive fragmented line endings and preserve IDs, event types and retry (0.4154ms)
✔ cookie persistence is needed only for accepted response cookies (5.0416ms)
✔ cookie domains, paths, expiry, secure flags, HttpOnly and persistence (11.0185ms)
✔ original live channel forwards text, binary, protocols and closes upstream (18.5051ms)
✔ transport rejects synthetic activation and requests before interaction (0.7511ms)
✔ wire bytes use exact little-endian identity, type, length and metadata (0.5424ms)
✔ destination validation pins only public addresses (0.957ms)
✔ HTML, CSS and JS transforms use syntax trees and document base (8.0274ms)
✔ streams before upstream end; binary bodies, headers, redirects and disconnect abort (218.1866ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2148.3747
```

### Original component smoke

```text
node.exe : npm notice run nyx@1.0.0 test:network
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Users\dubca\AppData\Roaming\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice run nyx@1.0.0 test:network:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

npm notice run npm --prefix connection test
npm notice run test
npm notice run node --test test.mjs && node smoke.mjs && node dynamic-smoke.mjs
✔ data responses retain valid JSON despite a JavaScript media type (6.4534ms)
✔ document location transformation preserves local bindings and property names (4.9121ms)
✔ window aliases expose the original location without changing ordinary location properties (2.059ms)
✔ worker startup follows replacements instead of waiting on a redundant worker (6.0883ms)
✔ document edits preserve nested imports, location arguments and large programs (104.0044ms)
✔ production constant storage preserves text, keys and unmatched UTF-16 units (3.0418ms)
✔ event records survive fragmented line endings and preserve IDs, event types and retry (0.3944ms)
✔ cookie persistence is needed only for accepted response cookies (4.7886ms)
✔ cookie domains, paths, expiry, secure flags, HttpOnly and persistence (11.0529ms)
✔ original live channel forwards text, binary, protocols and closes upstream (18.1449ms)
✔ transport rejects synthetic activation and requests before interaction (0.3987ms)
✔ wire bytes use exact little-endian identity, type, length and metadata (0.1765ms)
✔ destination validation pins only public addresses (0.3944ms)
✔ HTML, CSS and JS transforms use syntax trees and document base (7.071ms)
✔ streams before upstream end; binary bodies, headers, redirects and disconnect abort (213.4195ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2205.6155
PASS static HTML: heading rendered; zero console errors; first socket 210ms after click
PASS external CSS: base URL, @import and url() rendered; zero console errors
PASS JavaScript: dynamic fetch, Request, XMLHttpRequest, import(), classic and module workers completed; zero console errors
PASS 40 concurrent document requests: queued without dropping resources
PASS classic SharedWorker: two ports share one instance; nested fetch completes
PASS module SharedWorker: two ports share one instance; nested fetch completes
PASS Location redirect
PASS location assignment, replace, history state, relative fetch after navigation and GET form query preservation
PASS Images, Videos and All filter clicks preserve the search query through a window alias
PASS cookie redirect, HttpOnly exclusion, synchronous document.cookie, credentials omission and profile persistence after reload
PASS runtime WebSocket API: text, binary, requested protocol, URL and close
PASS incremental EventSource records, fragmented CRLF, server retry, Last-Event-ID reconnect, named events and explicit close
PASS foreign document base does not change cookie domain or path
PASS browser smoke: 3 pages, 0 console errors, 0 failed requests; original transport and original transformation only
PASS chrome: clicked Images -> Videos -> Images; query, JSON served with JavaScript MIME type and inserted image preserved
PASS chrome: HTML insertion, table/template/shadow contexts, srcset, CSS setters/rules, copied markup and result navigation; zero console errors or failed resources
PASS msedge: clicked Images -> Videos -> Images; query, JSON served with JavaScript MIME type and inserted image preserved
PASS msedge: HTML insertion, table/template/shadow contexts, srcset, CSS setters/rules, copied markup and result navigation; zero console errors or failed resources
```

### Final Chrome/Edge lifecycle and DOM regression

```text
PASS chrome: clicked Images -> Videos -> Images; query, JSON served with JavaScript MIME type and inserted image preserved
PASS chrome: stopped worker and installed replacement worker; existing page automatically reconnects and loads results
PASS chrome: HTML insertion, table/template/shadow contexts, srcset, CSS setters/rules, copied markup and result navigation; zero console errors or failed resources
PASS msedge: clicked Images -> Videos -> Images; query, JSON served with JavaScript MIME type and inserted image preserved
PASS msedge: stopped worker and installed replacement worker; existing page automatically reconnects and loads results
PASS msedge: HTML insertion, table/template/shadow contexts, srcset, CSS setters/rules, copied markup and result navigation; zero console errors or failed resources
```

### Desktop/mobile shell controls

```text
Initial search rendered in 485ms
Repeat navigation rendered in 183ms
PASS back, forward and reload
PASS 1365px: no initial request; one Enter loads results without an artificial delay; no second form; link updates address; cached worker; back/forward/reload; new/switch/close tabs; context-menu new page; zero page errors
Initial search rendered in 399ms
Repeat navigation rendered in 174ms
PASS back, forward and reload
PASS 390px: no initial request; one Enter loads results without an artificial delay; no second form; link updates address; cached worker; back/forward/reload; new/switch/close tabs; context-menu new page; zero page errors
```

### Chrome storage regression

```text
PASS Chrome with third-party cookies blocked: cross-site storage failure is reported to Nyx without an uncaught startup error
PASS Chrome with third-party cookies blocked: same host, separate port loads and reloads; account origin storage remains inaccessible; zero page errors
```

### Dependency audit

```text
PASS manifest: no prohibited dependency
PASS regenerated lockfile: 408 entries, no prohibited package or dependency
PASS installed tree: 348 packages, no prohibited package
PASS copied runtimes, workers, relay and asset-copy generator are absent
PASS start:relay uses the original implementation
```

### Narrow deploy-file and branding check

```text
node.exe : npm notice run nyx@1.0.0 check:deploy
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Users\dubca\AppData\Roaming\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice run nyx@1.0.0 check:deploy:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

npm notice run node rituals/check-deploy.mjs && npm run check:branding
APPROVED rituals/audit-release.mjs: Regression scanner signature definitions only; not published application code
APPROVED rituals/check-retired-engine.mjs: Regression scanner signature definitions only; not published application code
PASS retired-engine audit: 3061 files, 69 decoded payloads, 433 media/archive files classified separately, 0 prohibited matches
Deployment check passed (302 required files found).
npm notice run nyx@1.0.0 check:branding
npm notice run node rituals/check-branding.mjs
Nyx branding check passed (3143 tracked files checked).
```

### Component and complete release AST/signature audits

```json
{
  "passed": true,
  "files": 5,
  "counts": {
    "atob": 0,
    "eval": 0,
    "Function": 0
  },
  "nonGlobalFunctionMethods": 12,
  "signatureMatches": 0,
  "pathMatches": 0,
  "parseErrors": 0,
  "unreadable": 0,
  "sourceMaps": 0,
  "report": null
}
{
  "passed": false,
  "files": 3548,
  "counts": {
    "atob": 0,
    "eval": 24,
    "Function": 25
  },
  "nonGlobalFunctionMethods": 2,
  "signatureMatches": 664,
  "pathMatches": 12,
  "parseErrors": 0,
  "unreadable": 0,
  "sourceMaps": 0,
  "report": null
}
```

### Bundle sizes (bytes; source build, uncompressed)

```json
{
  "before_this_repair": {
    "client.js": 8468,
    "runtime.js": 491204,
    "worker.js": 1073448,
    "total": 1573120
  },
  "after_this_repair": {
    "client.js": 9015,
    "runtime.js": 1084920,
    "worker.js": 1074388,
    "total": 2168323
  }
}
```
The runtime now includes the original HTML/CSS/JavaScript parsers needed to process inserted content. Controlled shell first-load measurements are in the output above; these are not timings for DuckDuckGo's upstream service.

### Static scrub of all dist files

Historical result: FAIL. The complete original report, including its raw match listing, is archived locally at `.codex-artifacts/historical-verification/DUCKDUCKGO_RESULTS_VERIFICATION.md`. The duplicate listing was removed from source documentation on 2026-10-11; the failure counts above are unchanged. This does not change or exempt any application asset from the release audit.

## FILES CHANGED

Files changed specifically for this repair (earlier worktree changes are inventoried in SEARCH_AND_UI_VERIFICATION.md):

- connection/address.mjs - make repeated routing idempotent for already mapped addresses.
- connection/transform.mjs - shared markup traversal, contextual fragment transformation, preserve JSON data with a JavaScript MIME type.
- connection/runtime.js - intercept dynamic HTML, image and CSS entry points.
- connection/client.mjs - wait for worker updates, coalesce connection attempts, reconnect on a worker request.
- connection/worker.mjs - recover document sessions after worker restart/update.
- connection/test.mjs - data-versus-program response regression.
- connection/dynamic-smoke.mjs - Chrome/Edge filter, image, CSS, DOM, worker restart and replacement tests.
- connection/package.json - include the dynamic browser test in the existing test command.
- scrolls/DUCKDUCKGO_RESULTS_VERIFICATION.md - this report.
- scrolls/SEARCH_AND_UI_VERIFICATION.md - link to the newer repair evidence.
- docs/NYX_PROJECT_STATE.md in the repository root - durable handoff update.
- Generated connection/dist/ and dist/ were rebuilt through the build commands; no generated file was edited manually. The failed release gate still prohibits deployment.

Functions added: `markup`, `fragment`, runtime `css`/`attribute`/`html` helpers, client `connect`, worker `reconnect`. Functions changed: `route`, `document`, `content`, `attach`, worker connect/fetch handlers, runtime DOM/CSS descriptors. Functions renamed: none. This was a behavior repair, not identifier camouflage. Ignored diagnostics and screenshots are in `.codex-artifacts/`.

## DEPENDENCIES REMOVED

None in this repair. No packages were added. Earlier dependency removals are listed in SEARCH_AND_UI_VERIFICATION.md; the current dependency-purge check output is reproduced above.
