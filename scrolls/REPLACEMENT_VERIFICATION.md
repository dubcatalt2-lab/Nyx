> Historical verification snapshot. For the latest search repairs, interaction sweep and current release failures, see [SEARCH_AND_UI_VERIFICATION.md](SEARCH_AND_UI_VERIFICATION.md). The older counts below are retained as historical evidence.

# COMPLETED

- Removed all six requested direct dependencies. Deleted the root lockfile, regenerated it, then completed a fresh npm ci. The original connection application is now an npm workspace.
- Deleted copied runtime directories, both old worker entry files, the previous relay implementation, and generators that copied or renamed the removed engine. Deleted CANON.md. These deletions are not replacement copies under different names.
- Connected Nyx document launch to the original connection service on a separate origin. The relay entry is relay.js and its npm script is start:relay. Local account application runs on 8080; document service on 8082.
- Original transport and HTML/CSS/JavaScript transforms pass unit and browser fixtures. Actual Nyx launch into the separate service and public HTTPS rendering were checked.
- Desktop/mobile source and built navigation, cached redirect recovery, saved-game persistence, selected AI quota/access tests, and built catalog/player controls pass their targeted checks.

# INCOMPLETE

- Full release build fails. Raw scan has 962 matching lines; decoded/source-aware audit reports 1641 signature matches, 12 path matches, and 24 parse failures. Remaining first-party settings/state/old URL recognition and bundled game content must still be corrected. Literal scanner definitions and this required evidence report also retain names; a repository-wide zero-occurrence claim would be false.
- Native call limits fail: 93 atob, 164 eval, 74 native Function sites. Parse failures mean the inventory is not complete. Replacing eval mechanically can change lexical scope and break game code; this is not claimed fixed.
- Separate account-origin isolation is tested; isolation between unrelated remote sites inside the document service is not complete. Authenticated live sockets, arbitrary-site navigation/script compatibility, custom media inspection, ad-policy propagation and full static-export integration remain incomplete.
- Full all-functions validation has not passed. Earlier aggregate tests had unresolved media/account/model/static-export failures; current targeted checks are not an aggregate pass.
- Fresh installation reported 21 dependency vulnerabilities (1 low, 12 moderate, 7 high, 1 critical). No forced dependency upgrade was applied.
- No complete comparable pre-change bundle measurement was retained. Current output size is reported below without an invented before/after comparison. Docker release configuration and remote CI/branch protection have not been verified.
- This replacement is local and uncommitted. It has not been pushed or deployed. The separately released redirect repair is public commit 724288e5dbed4e48951d36209c6edfb707d83859 and VPS source ae20381381eda600019cac4271830f93f8de3d08; those releases still use their previous engine.

# VERIFICATION OUTPUT

Dependency removal:

```text
PASS manifest: no prohibited dependency
PASS regenerated lockfile: 408 entries, no prohibited package or dependency
PASS installed tree: 348 packages, no prohibited package
PASS copied runtimes, workers, relay and asset-copy generator are absent
PASS start:relay uses the original implementation
```
Full release AST/decoded scan (exit 1):

```text
{
  "passed": false,
  "files": 3548,
  "counts": {
    "atob": 93,
    "eval": 164,
    "Function": 74
  },
  "nonGlobalFunctionMethods": 2,
  "signatureMatches": 1641,
  "pathMatches": 12,
  "parseErrors": 24,
  "unreadable": 0,
  "sourceMaps": 0,
  "report": ".codex-artifacts/full-release-audit.json"
}
```
Original component scan:

```text
{
  "passed": true,
  "files": 5,
  "counts": {
    "atob": 0,
    "eval": 0,
    "Function": 0
  },
  "nonGlobalFunctionMethods": 6,
  "signatureMatches": 0,
  "pathMatches": 0,
  "parseErrors": 0,
  "unreadable": 0,
  "sourceMaps": 0,
  "report": null
}
```
Raw static scrub (rg exit 0 means matches were found; therefore FAIL). All output follows, not a sample:

Historical match listing archived verbatim with the original report at `.codex-artifacts/historical-verification/REPLACEMENT_VERIFICATION.md`. The audit failed; its summary counts remain unchanged. This archived listing is not current verification output.
Original component test output:

```text
node.exe : npm notice run nyx@1.0.0 test:network
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Users\dubca\AppData\Roaming\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice run nyx@1.0.0 test:network:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

npm notice run npm --prefix connection test
npm notice run test
npm notice run node --test test.mjs && node smoke.mjs
✔ production constant storage preserves text, keys and unmatched UTF-16 units (12.28ms)
✔ event records survive fragmented line endings and preserve IDs, event types and retry (2.5615ms)
✔ cookie domains, paths, expiry, secure flags, HttpOnly and persistence (66.5967ms)
✔ original live channel forwards text, binary, protocols and closes upstream (49.3998ms)
✔ transport rejects synthetic activation and requests before interaction (2.0614ms)
✔ wire bytes use exact little-endian identity, type, length and metadata (0.4527ms)
✔ destination validation pins only public addresses (0.8064ms)
✔ HTML, CSS and JS transforms use syntax trees and document base (23.2462ms)
✔ streams before upstream end; binary bodies, headers, redirects and disconnect abort (416.2482ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4608.3443
PASS static HTML: heading rendered; zero console errors; first socket 3803ms after click
PASS external CSS: base URL, @import and url() rendered; zero console errors
PASS JavaScript: dynamic fetch, Request, XMLHttpRequest, import(), classic and module workers completed; zero console errors
PASS 40 concurrent document requests: queued without dropping resources
PASS classic SharedWorker: two ports share one instance; nested fetch completes
PASS module SharedWorker: two ports share one instance; nested fetch completes
PASS Location redirect
PASS cookie redirect, HttpOnly exclusion, synchronous document.cookie, credentials omission and profile persistence after reload
PASS runtime WebSocket API: text, binary, requested protocol, URL and close
PASS incremental EventSource records, fragmented CRLF, server retry, Last-Event-ID reconnect, named events and explicit close
PASS foreign document base does not change cookie domain or path
PASS browser smoke: 3 pages, 0 console errors, 0 failed requests; original transport and original transformation only
```
Deployment structure check (does not override the failed release audit):

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
PASS retired-engine audit: 3062 files, 93 decoded payloads, 433 media/archive files classified separately, 0 prohibited matches
Deployment check passed (302 required files found).
npm notice run nyx@1.0.0 check:branding
npm notice run node rituals/check-branding.mjs
Nyx branding check passed (3130 tracked files checked).
```
Current bundle measurement:

```text
dist: 454794511 bytes
connection/dist: 1577992 bytes
Comparable complete-application before measurement: unavailable
```
Package-content certification: I cannot certify "No removed package appears in the final build in any form." The manifest, regenerated lockfile and installed package-name checks pass, and known copied runtimes were deleted. Legacy identifiers and integration remnants still appear in first-party output and bundled content, listed in the raw scan. The strict release gate remains failed.

Parse failures:

```text
[
  {
    "file": "assets/ugs/1/cl12minibattles.html",
    "section": "inline 9",
    "message": "Unexpected token (1:605)"
  },
  {
    "file": "assets/ugs/1/cl1v1lolifnoaboutblank.html",
    "section": "inline 1",
    "message": "Unexpected token (1:370)"
  },
  {
    "file": "assets/ugs/B/clblockcraftparkour.html",
    "section": "inline 871",
    "message": "Unexpected token (2:0)"
  },
  {
    "file": "assets/ugs/C/clcarmods.html",
    "section": "inline 50",
    "message": "Unexpected token (62:61)"
  },
  {
    "file": "assets/ugs/C/clcastlewarsmodern.html",
    "section": "inline 10",
    "message": "Unexpected token (1:765)"
  },
  {
    "file": "assets/ugs/C/clcuttherope.html",
    "section": "inline 1212",
    "message": "Unexpected token (20:21)"
  },
  {
    "file": "assets/ugs/C/clcuttherope.html",
    "section": "inline 1238",
    "message": "Unexpected token (4:22)"
  },
  {
    "file": "assets/ugs/D/cldrawclimber.html",
    "section": "inline 8",
    "message": "Unexpected token (1:32)"
  },
  {
    "file": "assets/ugs/F/clfootballlegends.html",
    "section": "inline 56",
    "message": "Unexpected token (3:1)"
  },
  {
    "file": "assets/ugs/H/clhandulum.html",
    "section": "inline 44",
    "message": "Unexpected token (2:0)"
  },
  {
    "file": "assets/ugs/I/clinnkeeper.html",
    "section": "inline 21",
    "message": "Unterminated string constant (6:18)"
  },
  {
    "file": "assets/ugs/J/cljellytruckgood.html",
    "section": "inline 8",
    "message": "Unexpected token (1:1022)"
  },
  {
    "file": "assets/ugs/M/clmonkeymartenc.html",
    "section": "inline 923",
    "message": "Unexpected token (9:0)"
  },
  {
    "file": "assets/ugs/M/clmotox3mpoolparty.html",
    "section": "inline 8",
    "message": "Unexpected token (1:1148)"
  },
  {
    "file": "assets/ugs/M/clmotox3mspookyland.html",
    "section": "inline 9",
    "message": "Unexpected token (1:1100)"
  },
  {
    "file": "assets/ugs/P/clpapapizzagood.html",
    "section": "inline 1",
    "message": "Unexpected token (1:969)"
  },
  {
    "file": "assets/ugs/P/clpapapizzamamamia.html",
    "section": "inline 1",
    "message": "Unexpected token (1:969)"
  },
  {
    "file": "assets/ugs/P/clpaperio3d.html",
    "section": "inline 236",
    "message": "Unexpected token (4:0)"
  },
  {
    "file": "assets/ugs/P/clpaperiomania.html",
    "section": "inline 47",
    "message": "Unexpected token (3:3)"
  },
  {
    "file": "assets/ugs/R/clracingarena.html",
    "section": "inline 1",
    "message": "Unexpected token (1:12318)"
  },
  {
    "file": "assets/ugs/S/clskibidiinthebackrooms.html",
    "section": "inline 8",
    "message": "Unexpected token (1:49)"
  },
  {
    "file": "assets/ugs/S/clslowroads.html",
    "section": "inline 40",
    "message": "Unterminated string constant (3:242084)"
  },
  {
    "file": "assets/ugs/S/clslowroads.html",
    "section": "inline 45",
    "message": "Unterminated string constant (2:97621)"
  },
  {
    "file": "assets/ugs/T/cltunnelrush.html",
    "section": "inline 8",
    "message": "Unexpected token (1:967)"
  }
]
```
# FILES CHANGED

This inventory includes the current Nyx replacement work relative to HEAD and new files. Unrelated Nook and cloud-page edits are excluded and preserved. Generated dist files are rebuilt, not edited directly. The root handoff document was also updated without reencoding its existing bytes.

- `.github/workflows/network.yml`
- `CANON.md`
- `Dockerfile.fellowship`
- `Dockerfile.relay`
- `barebooks/index.mjs`
- `barebooks/worker.js`
- `chapels/tutsi/http-relay.mjs`
- `chapels/tutsi/intercession-compat.mjs`
- `chapels/tutsi/intercession.mjs`
- `chapels/tutsi/relay.mjs`
- `connection/README.md`
- `connection/passage.mjs`
- `connection/assembly.mjs`
- `connection/build.mjs`
- `connection/channel.mjs`
- `connection/client.mjs`
- `connection/constants.mjs`
- `connection/covenant.mjs`
- `connection/canticle.mjs`
- `connection/verses.mjs`
- `connection/index.html`
- `connection/live.mjs`
- `connection/package-lock.json`
- `connection/package.json`
- `connection/runtime.js`
- `connection/sanctuary.mjs`
- `connection/smoke.mjs`
- `connection/communion.mjs`
- `connection/test.mjs`
- `connection/liturgy.mjs`
- `connection/pilgrimage.mjs`
- `connection/worker.mjs`
- `fellowship-gateway.mjs`
- `fellowship-server.js`
- `gospel.js`
- `incense/incense.wasm`
- `incense/index.mjs`
- `package-lock.json`
- `package.json`
- `parables/display-names.js`
- `parables/document-window.mjs`
- `parables/intercession-startup.mjs`
- `parables/relay-selection.js`
- `pilgrim.sw.js`
- `relay.js`
- `relics/network/adapter.mjs`
- `relics/network/frames.mjs`
- `relics/network/transport.mjs`
- `relics/transports/header-utils.mjs`
- `relics/transports/incense-pilgrim.mjs`
- `relics/transports/libcurl-client.mjs`
- `relics/transports/libcurl-communion.mjs`
- `relics/transports/libcurl-pilgrim.mjs`
- `relics/transports/libcurl-response.mjs`
- `rituals/audit-release.mjs`
- `rituals/build-frontend-assets.mjs`
- `rituals/build-intercession-assets.mjs`
- `rituals/build-runtime-names.mjs`
- `rituals/build-static-export.mjs`
- `rituals/build-vps.mjs`
- `rituals/check-deploy.mjs`
- `rituals/intercession-asset-names.json`
- `rituals/test-ai-free-errors.mjs`
- `rituals/test-ai-quota-regressions.mjs`
- `rituals/test-ai-reply-model.mjs`
- `rituals/test-bookmux-worker.mjs`
- `rituals/test-cached-folder-navigation.mjs`
- `rituals/test-code-edit-route.mjs`
- `rituals/test-dependency-purge.mjs`
- `rituals/test-document-window.mjs`
- `rituals/test-games-built.mjs`
- `rituals/test-http-relay-workspace.mjs`
- `rituals/test-intercession-transport-init.mjs`
- `rituals/test-libcurl-response.mjs`
- `rituals/test-local-folder-navigation.mjs`
- `rituals/test-movie-discernment-types.mjs`
- `rituals/test-movie-ranking.mjs`
- `rituals/test-network-adapter.mjs`
- `rituals/test-regression.mjs`
- `rituals/test-retired-transport.mjs`
- `rituals/test-source-layout.mjs`
- `rituals/test-worker-port.mjs`
- `scripture/fellowship-relay.mjs`
- `scripture/network/server.mjs`
- `scripture/public-assets.mjs`
- `scripture/source-layout.mjs`
- `scrolls/CONNECTION_REPLACEMENT.md`
- `scrolls/REPLACEMENT_VERIFICATION.md`
- `shepherd.js`
- `study.html`
- `vespers.sw.js`

Removed and added function declarations in the main integration files:

```text
gospel.js
Removed declarations: studyjetUrl, refreshStudyjetServiceWorker, normalizeWispUrl, defaultWispUrl, storedCustomWispUrl, workspaceHttpRelayUrl, wispUrl, configuredWispUrls, selectWispRelay, installBookmuxTransport, createStudyjetTransport, studyjetConfig, studyjetRuntimeConfig, createStudyjetController, createPrivateStudyjetController, reconnectStudyjetController, ensureStudyjetWorkerConnection, loadStudyjetRuntimeGuardSource, findStudyjetHtmlNode, installStudyjetRuntimeGuards, shouldUseStudyjetRuntimeGuard, shouldUseStudyjetMinimalGuard, shouldUseStudyjetHelperGuard, shouldStripStudyjetDuckDuckGoScripts, watchStudyjetHealth, removeStudyjetHtmlNodes, stripStudyjetDuckDuckGoScripts, stripStudyjetPreloadLinks, stripStudyjetResourceIntegrity, patchStudyjetHtml, createStudyjetCompatibilityPlugin, isStudyjetIdbShapeError, repairStudyjetStorage, repairStudyjetCaches, repairRetiredConnectionStorage, repairRetiredConnectionCaches, ensureFreshConnectionState, ensureFreshStudyjetState, installStudyjet, preflightLibcurlReady, recoverRejectedStudyjetLocation, retryStudyjetTab, loadStudyjetTab, installBookmuxPortResponder
Added declarations: documentAddress, normalizeDocumentOrigin, defaultDocumentOrigin, storedDocumentOrigin, selectedDocumentOrigin, prepareDocumentWindow, internalDocumentAddress, preflightDocumentReady, retryDocumentTab, loadDocumentTab, installRetiredRuntimeRecovery

shepherd.js
Removed declarations: normalizePublicWispUrl, rejectWispUpgrade, patchedBookmuxIndex, patchedStudyjetControllerAsset, patchedStudyjetRuntime, studyjetRuntimeGuard
Added declarations: rejectUpgrade

parables/intercession-startup.mjs
Removed declarations: trackConnectionController, waitForConnectionController
Added declarations:

chapels/tutsi/intercession.mjs
Removed declarations: activeWorker, relayUrl, relayStatus, transport, engine, sourceUrl, installImageRepair
Added declarations:
```
# DEPENDENCIES REMOVED

Direct dependencies:

- `@mercuryworkshop/bare-mux`
- `@mercuryworkshop/epoxy-transport`
- `@mercuryworkshop/libcurl-transport`
- `@mercuryworkshop/scramjet`
- `@mercuryworkshop/scramjet-controller`
- `wispurr`

Also absent from the regenerated dependency tree:

- `@mercuryworkshop/epoxy-tls`
- `@mercuryworkshop/proxy-transports`
- `libcurl.js`
