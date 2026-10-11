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

FAIL: matches remain. Raw `rg --text --hidden --no-ignore -n -o -i` output (matching substrings, not full minified lines):

```text
dist\@r525f31eeb43c82e14a860e31!.js:16:scramjet
dist\@r525f31eeb43c82e14a860e31!.js:16:scramjet
dist\@r525f31eeb43c82e14a860e31!.js:46:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:16:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:16:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:46:scramjet
dist\styles.css:4888:fern
dist\styles.css:4894:fern
dist\styles.css:4906:fern
dist\styles.css:4907:fern
dist\styles.css:4911:fern
dist\styles.css:4912:fern
dist\styles.css:4921:fern
dist\styles.css:4922:fern
dist\styles.css:4953:wisp
dist\styles.css:5081:fern
dist\styles.css:5088:fern
dist\styles.css:5091:fern
dist\styles.css:5093:fern
dist\styles.css:5101:fern
dist\styles.css:5274:wisp
dist\styles.css:5373:fern
dist\styles.css:5476:fern
dist\styles.css:5479:fern
dist\styles.css:5485:fern
dist\styles.css:5488:fern
dist\styles.css:5489:fern
dist\script.js:16:scramjet
dist\script.js:16:scramjet
dist\script.js:46:scramjet
dist\css\theme-tints.css:140:fern
dist\css\theme-tints.css:141:fern
dist\css\theme-tints.css:142:fern
dist\css\theme-tints.css:143:fern
dist\css\theme-tints.css:144:fern
dist\css\theme-tints.css:145:fern
dist\css\theme-tints.css:146:fern
dist\css\theme-tints.css:147:fern
dist\css\theme-tints.css:148:fern
dist\css\theme-tints.css:151:fern
dist\css\theme-tints.css:152:fern
dist\css\theme-tints.css:153:fern
dist\css\theme-tints.css:159:fern
dist\css\theme-tints.css:160:fern
dist\css\theme-tints.css:161:fern
dist\css\theme-tints.css:162:fern
dist\css\theme-tints.css:164:fern
dist\css\theme-tints.css:165:fern
dist\css\theme-tints.css:166:fern
dist\css\theme-tints.css:167:fern
dist\css\theme-tints.css:170:fern
dist\css\theme-tints.css:171:fern
dist\css\theme-tints.css:172:fern
dist\css\theme-tints.css:174:fern
dist\css\theme-tints.css:175:fern
dist\css\theme-tints.css:176:fern
dist\css\theme-tints.css:178:fern
dist\css\theme-tints.css:179:fern
dist\css\theme-tints.css:184:fern
dist\css\theme-tints.css:185:fern
dist\css\theme-tints.css:186:fern
dist\css\theme-tints.css:188:fern
dist\css\theme-tints.css:192:fern
dist\css\avatar-decorations.css:77:fern
dist\css\avatar-decorations.css:78:fern
dist\css\avatar-decorations.css:79:fern
dist\css\avatar-decorations.css:111:fern
dist\css\avatar-decorations.css:169:fern
dist\css\avatar-decorations.css:170:fern
dist\css\avatar-decorations.css:171:fern
dist\css\avatar-decorations.css:227:fern
dist\css\avatar-decorations.css:255:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\nyxify\app.js:1:fern
dist\apps\nyxify\app.js:1:fern
dist\apps\nyxify\app.js:1:fern
dist\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4888:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4894:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4906:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4907:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4911:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4912:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4921:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4922:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4953:wisp
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5081:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5088:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5091:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5093:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5101:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5274:wisp
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5373:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5476:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5479:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5485:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5488:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5489:fern
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:16:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:16:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:46:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:16:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:16:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:46:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:16:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:16:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:46:scramjet
dist\assets\profile\effects\catalog.json:527:Wisp
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:140:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:141:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:142:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:143:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:144:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:145:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:146:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:147:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:148:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:151:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:152:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:153:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:159:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:160:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:161:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:162:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:164:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:165:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:166:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:167:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:170:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:171:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:172:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:174:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:175:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:176:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:178:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:179:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:184:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:185:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:186:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:188:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:192:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:77:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:78:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:79:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:111:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:169:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:170:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:171:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:227:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:255:fern
dist\assets\profile\decorations\catalog.json:24:Wisp
dist\assets\profile\decorations\catalog.json:193:fern
dist\assets\profile\decorations\catalog.json:195:fern
dist\assets\profile\decorations\catalog.json:196:fern
dist\assets\profile\decorations\catalog.json:200:fern
dist\assets\profile\decorations\cybernetic-halo.png:2720:FeRN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\vendor\hls.min.js:18:ferN
dist\assets\profile\effects\fx-astral-spark.png:2720:FeRN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\ugs\P\clpinkbike.html:81:wisp
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:18:ferN
dist\assets\ugs\P\clpaperio3d.html:236:WIsP
dist\assets\ugs\P\clpaperio3d.html:236:wisP
dist\assets\ugs\P\clpaperio3d.html:266:Daydream
dist\assets\ugs\P\clpaperio3d.html:266:Daydream
dist\assets\ugs\G\clgeometrydashscratch.html:219:WISp
dist\assets\ugs\G\clgeometrydashscratch.html:371:WIsp
dist\assets\ugs\G\clgeometrydashscratch.html:398:ScRAM
dist\assets\ugs\G\clgeometrydashscratch.html:401:wISP
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\ugs\O\cloperius.html:105:fern
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\effects\catalog.json:527:Wisp
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:24:Wisp
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:193:fern
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:195:fern
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:196:fern
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:200:fern
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:25:WIsP
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:4967:fern
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:5008:wisP
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:5008:WIsp
dist\assets\ugs\D\cldoodlejumpgoober.html:38:Fern
dist\assets\ugs\D\cldoodlejump.html:31:Fern
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:ScRAm
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wiSP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FeRn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WISp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WISP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:feRN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wisP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Wisp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FErN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FeRn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:EPoxY
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wiSp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WIsP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:SCraM
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Fern
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Wisp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WIsP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wIsP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Wisp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wisP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FErn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FerN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:ferN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:fERn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WiSp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:feRn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:feRN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:fErN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:45884:fern
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:45930:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:45932:fern
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:46123:ferN
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:wisp
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fErN
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fErn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:wISP
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fERn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:glYPe
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:FErn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fERn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:wIsp
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:WisP
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:FErn
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:wiSp
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:wiSp
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:WiSp
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:FErN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44427:fern
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44470:FERN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44473:fern
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44662:ferN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FeRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:Wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fErn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FeRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:Wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FErN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FErN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:sCraM
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fERN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fErn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fern
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FeRn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FErN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:WiSP
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FerN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:Wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:GLype
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FERn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:WISp
dist\assets\ugs\minecraft\Dragonxclient.html:31450:fern
dist\assets\ugs\minecraft\Dragonxclient.html:31480:FERN
dist\assets\ugs\minecraft\Dragonxclient.html:31483:fern
dist\assets\ugs\minecraft\Dragonxclient.html:31711:fERn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WiSp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WISp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:fErn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:fERN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:FErn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:feRN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:Wisp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WISP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WisP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:FeRN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:wISp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WiSP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:feRn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:feRn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:ferN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:FErN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WISP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WisP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:wISp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:wiSp
dist\assets\ugs\C\clcookieclicker.txt:48:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:48:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:482:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:483:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:483:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:483:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:484:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:525:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:525:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:527:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:528:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:541:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:546:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:555:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:679:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:772:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:772:proxyUrl
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WIsp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WISP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FerN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FERn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:feRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WISp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:SCrAm
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WIsP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FErN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FeRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WisP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FeRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WIsp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:feRN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FERn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FerN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:feRN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:wisP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:wisp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FeRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:ferN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:19505:fern
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:35823:fern
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WIsP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wIsp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:ScrAm
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:EPoxY
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:EPoxY
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wIsP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:fERN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wISP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:feRN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FERn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FERn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wIsp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WiSp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:feRn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WiSp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:glyPE
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:fern
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FeRn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:fERN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:feRn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:Fern
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WIsP
dist\assets\profile\effects\fx-supernova-flash.png:12221:feRn
dist\assets\profile\effects\fx-solar-surge.png:8797:__Uv
dist\assets\ugs\S\clslowroads.html:41:setTransport
dist\assets\ugs\S\clslowroads.html:41:setTransport
dist\assets\ugs\S\clslowroads.html:41:setTransport
dist\assets\ugs\S\clstreangeropepolice.html:28:wIsp
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern

```

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
