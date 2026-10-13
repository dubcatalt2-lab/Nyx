Local absolute paths in the historical stack trace below are normalized to `<workspace>`. The verbatim original report is archived at `.codex-artifacts/historical-verification/LOADING_VERIFICATION.md`.

# Local loading optimization verification ? 2026-10-11
## COMPLETED

- The document asset server now negotiates Brotli/gzip, caches the four known assets in memory, and revalidates them using content-based ETags. Each request checks file metadata so new builds invalidate all encoded copies. Generic URLs do not receive immutable caching.
- A controlled Chrome benchmark measured 2,168,323 ? 466,473 transfer bytes (78.5% reduction); revalidation returns 304 with no body. Three-context median opening time was 1,379 ? 887 ms cold and 1,373 ? 257 ms warm. This measures a deterministic local upstream with page-network emulation, not guaranteed live search-engine latency. First samples were slower in both runs; raw samples follow.
- The lesson test command and both corresponding test filenames now use lessons. Its existing functional assertions now use accessible library labels and stable card identities to accommodate the current educational display names.
- Confirmed original session MessageChannel, original browser Transport ? /api/sync, and same-origin /boot/start.js registration. Stopped/replaced workers recover in Chrome and Edge. No removed library was restored, wrapped, or vendored. Browser service-worker APIs remain required browser APIs.
- The optimized document service is active on local port 8082 behind the existing localhost:8080 shell.
## INCOMPLETE

- Public GitHub and production remain unchanged. The full build failed its existing strict release audit (664 signature matches, 12 paths, 24 eval and 25 Function calls); the narrow deploy check is a separate check and does not override that failure.
- Prior architecture/release issues remain documented in DUCKDUCKGO_RESULTS_VERIFICATION.md and SEARCH_AND_UI_VERIFICATION.md. This optimization does not complete the entire earlier refactor.
## VERIFICATION OUTPUT

### Before measurement

```text
{
  "resources": [
    {
      "path": "/boot/client.js",
      "plainBytes": 9015,
      "transferBytes": 9015,
      "repeatBytes": 9015,
      "repeatStatus": 200,
      "encoding": "identity"
    },
    {
      "path": "/boot/start.js",
      "plainBytes": 1074388,
      "transferBytes": 1074388,
      "repeatBytes": 1074388,
      "repeatStatus": 200,
      "encoding": "identity"
    },
    {
      "path": "/boot/runtime.js",
      "plainBytes": 1084920,
      "transferBytes": 1084920,
      "repeatBytes": 1084920,
      "repeatStatus": 200,
      "encoding": "identity"
    }
  ],
  "totals": {
    "plain": 2168323,
    "transfer": 2168323,
    "repeat": 2168323
  }
}
{
  "conditions": "Chrome; page network emulation 40ms latency / 10Mbps; local deterministic upstream; 3 fresh contexts",
  "samples": [
    {
      "state": "cold",
      "milliseconds": 3063
    },
    {
      "state": "warm",
      "milliseconds": 1390
    },
    {
      "state": "cold",
      "milliseconds": 1375
    },
    {
      "state": "warm",
      "milliseconds": 1364
    },
    {
      "state": "cold",
      "milliseconds": 1379
    },
    {
      "state": "warm",
      "milliseconds": 1373
    }
  ],
  "medianColdMs": 1379,
  "medianWarmMs": 1373,
  "consoleErrors": 0
}
```

### After measurement

```text
{
  "resources": [
    {
      "path": "/boot/client.js",
      "plainBytes": 9015,
      "transferBytes": 3661,
      "repeatBytes": 0,
      "repeatStatus": 304,
      "encoding": "br"
    },
    {
      "path": "/boot/start.js",
      "plainBytes": 1074388,
      "transferBytes": 230405,
      "repeatBytes": 0,
      "repeatStatus": 304,
      "encoding": "br"
    },
    {
      "path": "/boot/runtime.js",
      "plainBytes": 1084920,
      "transferBytes": 232407,
      "repeatBytes": 0,
      "repeatStatus": 304,
      "encoding": "br"
    }
  ],
  "totals": {
    "plain": 2168323,
    "transfer": 466473,
    "repeat": 0
  }
}
{
  "conditions": "Chrome; page network emulation 40ms latency / 10Mbps; local deterministic upstream; 3 fresh contexts",
  "samples": [
    {
      "state": "cold",
      "milliseconds": 2573
    },
    {
      "state": "warm",
      "milliseconds": 272
    },
    {
      "state": "cold",
      "milliseconds": 884
    },
    {
      "state": "warm",
      "milliseconds": 257
    },
    {
      "state": "cold",
      "milliseconds": 887
    },
    {
      "state": "warm",
      "milliseconds": 242
    }
  ],
  "medianColdMs": 887,
  "medianWarmMs": 257,
  "consoleErrors": 0
}
```

### Network, worker lifecycle and browser tests

```text
node.exe : npm notice run nyx@1.0.0 test:network
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Users\dubca\AppData\Roaming\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice run nyx@1.0.0 test:network:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

npm notice run npm --prefix connection test
npm notice run test
npm notice run node --test test.mjs assets.test.mjs && node smoke.mjs && node dynamic-smoke.mjs
✔ assets compress, revalidate, negotiate and invalidate after a new build (208.9599ms)
✔ data responses retain valid JSON despite a JavaScript media type (8.018ms)
✔ document location transformation preserves local bindings and property names (4.1235ms)
✔ window aliases expose the original location without changing ordinary location properties (2.1156ms)
✔ worker startup follows replacements instead of waiting on a redundant worker (5.9303ms)
✔ document edits preserve nested imports, location arguments and large programs (106.8147ms)
✔ production constant storage preserves text, keys and unmatched UTF-16 units (3.5187ms)
✔ event records survive fragmented line endings and preserve IDs, event types and retry (0.4574ms)
✔ cookie persistence is needed only for accepted response cookies (5.0365ms)
✔ cookie domains, paths, expiry, secure flags, HttpOnly and persistence (11.8294ms)
✔ original live channel forwards text, binary, protocols and closes upstream (22.5258ms)
✔ transport rejects synthetic activation and requests before interaction (0.4029ms)
✔ wire bytes use exact little-endian identity, type, length and metadata (0.1868ms)
✔ destination validation pins only public addresses (0.4446ms)
✔ HTML, CSS and JS transforms use syntax trees and document base (8.6239ms)
✔ streams before upstream end; binary bodies, headers, redirects and disconnect abort (213.775ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3904.6736
PASS static HTML: heading rendered; zero console errors; first socket 240ms after click
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
PASS chrome: stopped worker and installed replacement worker; existing page automatically reconnects and loads results
PASS chrome: HTML insertion, table/template/shadow contexts, srcset, CSS setters/rules, copied markup and result navigation; zero console errors or failed resources
PASS msedge: clicked Images -> Videos -> Images; query, JSON served with JavaScript MIME type and inserted image preserved
PASS msedge: stopped worker and installed replacement worker; existing page automatically reconnects and loads results
PASS msedge: HTML insertion, table/template/shadow contexts, srcset, CSS setters/rules, copied markup and result navigation; zero console errors or failed resources
```

### Lesson functionality

```text
Game library, progressive catalog loading, adaptive optimizer, and in-frame ad protection checks passed.
```

### Built lesson pages

```text
PASS Games back label/open/close 1365 /assets/games/
PASS Games back label/open/close 1365 /apps/drop/games.html
PASS Games back label/open/close 390 /assets/games/
PASS Games back label/open/close 390 /apps/drop/games.html
Built arcade loads the real JSON manifest and both bundled game catalogs.
```

### Desktop/mobile shell

```text
Initial search rendered in 395ms
Repeat navigation rendered in 192ms
PASS back, forward and reload
PASS 1365px: no initial request; one Enter loads results without an artificial delay; no second form; link updates address; cached worker; back/forward/reload; new/switch/close tabs; context-menu new page; zero page errors
Initial search rendered in 407ms
Repeat navigation rendered in 172ms
PASS back, forward and reload
PASS 390px: no initial request; one Enter loads results without an artificial delay; no second form; link updates address; cached worker; back/forward/reload; new/switch/close tabs; context-menu new page; zero page errors
```

### Chrome storage

```text
PASS Chrome with third-party cookies blocked: cross-site storage failure is reported to Nyx without an uncaught startup error
PASS Chrome with third-party cookies blocked: same host, separate port loads and reloads; account origin storage remains inaccessible; zero page errors
```

### Full build ? FAILED

```text
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
PASS original document application build
UGS catalog: 1578/1578 deployable games
Production-obfuscated all 99 first-party workspace runtime files (8% smaller; no source maps)
Stylesheet cache revision: aaec1d7918f8b3ae
Production-minified 113 first-party HTML/CSS files (-7% smaller; comments removed)
Published 30 workspace modules as JavaScript; legacy URLs mapped explicitly.
Frontend build: 98 stable script aliases; one lesson cover with an HTML redirect to study.html.
Native decoding: 56 calls replaced with byte decoding; 0 parse failures remain for the mandatory release audit.
Static publisher package: 807 files, 46 MiB; no hosted-site iframe.
Workspace strings: 301 scripts and 50 pages verified against their parsed executable structure.
PASS 98 scattered scripts parse; 79 local imports resolve; shell, games and AI included
PASS retired-engine audit: 3548 files, 639 decoded payloads, 657 media/archive files classified separately, 0 prohibited matches
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
node : <workspace>/rituals/build-vps.mjs:389
At line:2 char:1
+ node rituals/build-vps.mjs > .codex-artifacts/loading-build.log 2>&1; ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (file:///C:/User...ild-vps.mjs:389:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

  if (releaseAudit.status !== 0) throw new Error('Release signature and native-call audit failed. Output is not ready
for deployment.');
                                       ^

Error: Release signature and native-call audit failed. Output is not ready for deployment.
    at main
(<workspace>/rituals/build-vps.mjs:389:40)
    at async <workspace>/rituals/build-vps.mjs:395:1

Node.js v24.16.0
```

### Narrow deploy checks

```text
npm.cmd : npm notice run nyx@1.0.0 check:deploy
At line:2 char:1
+ npm.cmd run check:deploy > .codex-artifacts/loading-deploy.log 2>&1;  ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice run nyx@1.0.0 check:deploy:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

npm notice run node rituals/check-deploy.mjs && npm run check:branding
APPROVED rituals/audit-release.mjs: Regression scanner signature definitions only; not published application code
APPROVED rituals/check-retired-engine.mjs: Regression scanner signature definitions only; not published application code
PASS retired-engine audit: 3059 files, 69 decoded payloads, 433 media/archive files classified separately, 0 prohibited matches
Deployment check passed (302 required files found).
npm notice run nyx@1.0.0 check:branding
npm notice run node rituals/check-branding.mjs
Nyx branding check passed (3149 tracked files checked).
```

### Dependency/channel and server checks

```text
PASS manifest: no prohibited dependency
PASS regenerated lockfile: 408 entries, no prohibited package or dependency
PASS installed tree: 348 packages, no prohibited package
PASS copied runtimes, workers, relay and asset-copy generator are absent
PASS start:relay uses the original implementation
PASS removed dependency absent from manifest, lockfile and installed tree; 2398 release text files contain no removed runtime fingerprints; recovery waits for explicit Reload
PASS Nyx document launch: separate origin, URL handoff, rendered response and navigation feedback
PASS no socket before shell click; single-click launch without a second form; no artificial startup delay
PASS remote content cannot read the account origin storage; no page errors
PASS original document server: origin/route/access rejection, both routes, exact framing, binary response, POST body, header pairs and structured request errors
```

## FILES CHANGED

These are the files changed in this optimization, not the full pre-existing dirty worktree.

- `connection/assets.mjs (new)`
- `connection/assets.test.mjs (new)`
- `connection/assembly.mjs`
- `connection/dynamic-smoke.mjs`
- `connection/measure-loading.mjs (new)`
- `connection/package.json`
- `connection/README.md`
- `package.json`
- `rituals/test-games.mjs -> rituals/test-lessons.mjs`
- `rituals/test-games-built.mjs -> rituals/test-lessons-built.mjs`
- `scrolls/LOADING_VERIFICATION.md (new)`
- `docs/NYX_PROJECT_STATE.md (local handoff)`

## DEPENDENCIES REMOVED

No additional package changes in this optimization. The previously removed direct dependencies remain absent from the active manifest, lockfile and installed tree: @mercuryworkshop/bare-mux, @mercuryworkshop/epoxy-transport, @mercuryworkshop/libcurl-transport, @mercuryworkshop/scramjet, @mercuryworkshop/scramjet-controller, and wispurr. Do not interpret this as a whole-output signature audit pass.
