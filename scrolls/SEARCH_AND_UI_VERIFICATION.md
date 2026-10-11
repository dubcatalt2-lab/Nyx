Latest DuckDuckGo result and worker-lifecycle repair: [DUCKDUCKGO_RESULTS_VERIFICATION.md](DUCKDUCKGO_RESULTS_VERIFICATION.md). This older sweep remains the record for wider incomplete work.

# Search and user interaction verification — 2026-10-10

Local repair/test report. **The overall refactor remains incomplete and has not been deployed.** Source: `.worktrees/nyx-page-wording-20261008`. Main application: localhost:8080; separate document service: localhost:8082.

## COMPLETED

- Reproduced Chrome storage denial with third-party cookies blocked. Local document origin now keeps the main hostname on a separate port; startup reports storage denial instead of crashing silently. Browser preferences, extensions and cookies were not changed. This reproduces one blank-page cause; the user's exact Chrome profile was not diagnosed conclusively.
- Corrected transformed JavaScript reading `location` through window aliases. Real DuckDuckGo Images/Videos/News links now preserve `q`; fixture Images → Videos → All clicks pass.
- Removed the embedded Address/Open/Opening interface and artificial startup delay. Replaced repeated string copying in transformation with a sorted edit/join pass. Added worker replacement/activation handling.
- Fixed Back after following an in-page link: launch validation now compares against the launch fragment, not the current address input.
- Fixed right-click New page, which referred to a removed button.
- Restored mobile video skip controls and verified their labeled ten-second actions.
- Fixed related-video card overflow on phones with bounded thumbnails and wrapping text.
- Verified wallpaper image decoding, preview/style selection and persistence at desktop and phone widths.
- Ran desktop/mobile click tests for search, links, Back/Forward/Reload, new/switch/close tabs and the context menu. Ran broader suites for accounts, chat, AI, games/saves, settings, music, movies, video, API keys and code editing.
- Corrected stale fixture paths/selectors/sample labels. The original Code Studio suite is preserved; a separate focused actions suite verifies its 16 language paths, previews, downloads, AI helper and mobile panels.

## INCOMPLETE

- Full release audit still fails. Narrow deploy-file/branding checks passing do not override the release gate.
- Failed account-controls suite expects the retired default wallpaper and old engine URLs. Original Code Studio suite expects the old Ruby palette. Voice test's generated-markup fixture is stale. Static publisher expects a deleted legacy shared module. These suites need migration before their full scope can be called verified.
- Music preview-while-full-track-loads assertion remains unresolved. Video interactions pass through playback, mobile layout, Shorts and discovery, but the suite still times out on the old returning-profile shortcut migration.
- Real DuckDuckGo returns a human-verification challenge in automation. Real link URLs and controlled filter navigation are verified; unrestricted live filter results are not. No challenge was bypassed.
- Movie control fixtures pass; real media inspection across the new document origin still needs an integration. Mocked launch is not live-provider proof.
- Isolation between unrelated remote sites within the document service, cookie-jar protection from untrusted pages, authenticated sockets, worker restart recovery, full dynamic-content compatibility, hosted document-origin setup and full static export integration remain incomplete.
- Local AI has no configured provider in the inspected environment. Account/API tests use fixture credentials and responses, not live purchases, account mutation or provider completion.
- No comparable pre-refactor whole-build size was retained. No invented before/after comparison is supplied.
- “No removed package appears in the final build in any form” is **not established**. Direct manifest/lockfile/installed-tree checks pass, but prohibited strings still remain in output; the complete raw scan follows.
- No push/deployment. Unrelated Nook desktop and cloud-gaming changes were preserved. The installed Nook app was not modified by this sweep.

## VERIFICATION OUTPUT

Latest completed run per browser suite. This is not exhaustive coverage of every game, provider, browser profile or user state. Logs are in `.codex-artifacts/regression-browser/`.

```text
{"total": 31, "PASS": 25, "FAIL": 6, "TIMEOUT": 0}
FAIL test-account-controls.mjs 32079ms
PASS test-account-signup.mjs 3037ms
PASS test-activity-layout.mjs 3053ms
PASS test-ai-company-icons.mjs 5456ms
PASS test-ai-cooldown-workspace.mjs 13541ms
PASS test-ai-history-workspace.mjs 3155ms
PASS test-ai-usage-workspace.mjs 2878ms
PASS test-ai-workspace.mjs 6191ms
PASS test-chat-social-workspace.mjs 8026ms
FAIL test-chat-voice-relay.mjs 1713ms
PASS test-code-studio-actions.mjs 6327ms
FAIL test-code-studio.mjs 2907ms
PASS test-code-suggestions.mjs 6029ms
PASS test-developer-api-ui.mjs 6101ms
PASS test-game-cloud-save.mjs 12916ms
PASS test-games-built.mjs 10311ms
PASS test-movie-startup-recovery.mjs 4980ms
PASS test-movies.mjs 11914ms
PASS test-nyxify-navigation-races.mjs 3379ms
FAIL test-nyxify-player.mjs 1784ms
PASS test-nyxtube-native-ui.mjs 22098ms
PASS test-nyxtube-segments.mjs 15082ms
FAIL test-nyxtube.mjs 38096ms
PASS test-owner-ai-status.mjs 3771ms
PASS test-owner-traffic.mjs 3075ms
PASS test-profile-popup.mjs 3230ms
FAIL test-static-publisher-workspace.mjs 4663ms
PASS test-storage-migration.mjs 2644ms
PASS test-theme-restoration.mjs 22995ms
PASS test-wallpaper-failure.mjs 7685ms
PASS test-workspace-settings-layout.mjs 7195ms
```

### Navigation and tabs

```text
Initial search rendered in 555ms
Repeat navigation rendered in 213ms
PASS back, forward and reload
PASS 1365px: no initial request; one Enter loads results without an artificial delay; no second form; link updates address; cached worker; back/forward/reload; new/switch/close tabs; context-menu new page; zero page errors
Initial search rendered in 412ms
Repeat navigation rendered in 160ms
PASS back, forward and reload
PASS 390px: no initial request; one Enter loads results without an artificial delay; no second form; link updates address; cached worker; back/forward/reload; new/switch/close tabs; context-menu new page; zero page errors
```

### Chrome storage

```text
PASS Chrome with third-party cookies blocked: cross-site storage failure is reported to Nyx without an uncaught startup error
PASS Chrome with third-party cookies blocked: same host, separate port loads and reloads; account origin storage remains inaccessible; zero page errors
```

### Wallpaper selection

```text
PASS 1365px wallpaper previews: four photographs decode, styles select, applied choice survives reload, no failed image requests
PASS 390px wallpaper previews: four photographs decode, styles select, applied choice survives reload, no failed image requests
```

### Component unit tests

```text
✔ document location transformation preserves local bindings and property names (11.0361ms)
✔ window aliases expose the original location without changing ordinary location properties (3.4374ms)
✔ worker startup follows replacements instead of waiting on a redundant worker (6.7099ms)
✔ document edits preserve nested imports, location arguments and large programs (150.4456ms)
✔ production constant storage preserves text, keys and unmatched UTF-16 units (6.0076ms)
✔ event records survive fragmented line endings and preserve IDs, event types and retry (0.8105ms)
✔ cookie persistence is needed only for accepted response cookies (7.9397ms)
✔ cookie domains, paths, expiry, secure flags, HttpOnly and persistence (18.813ms)
✔ original live channel forwards text, binary, protocols and closes upstream (36.2956ms)
✔ transport rejects synthetic activation and requests before interaction (0.8945ms)
✔ wire bytes use exact little-endian identity, type, length and metadata (0.3262ms)
✔ destination validation pins only public addresses (0.9699ms)
✔ HTML, CSS and JS transforms use syntax trees and document base (11.0342ms)
✔ streams before upstream end; binary bodies, headers, redirects and disconnect abort (240.3259ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2697.4246
```

### Component browser smoke

```text
PASS static HTML: heading rendered; zero console errors; first socket 539ms after click
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
```

### Dependency audit

```text
PASS manifest: no prohibited dependency
PASS regenerated lockfile: 408 entries, no prohibited package or dependency
PASS installed tree: 348 packages, no prohibited package
PASS copied runtimes, workers, relay and asset-copy generator are absent
PASS start:relay uses the original implementation
```

### Narrow deploy check

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
Nyx branding check passed (3141 tracked files checked).
```

### Build AST/signature output

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
Error: Release signature and native-call audit failed. Output is not ready for deployment.
```

### Raw static scrub

Historical result: FAIL. The complete original report, including its raw match listing, is archived locally at `.codex-artifacts/historical-verification/SEARCH_AND_UI_VERIFICATION.md`. The duplicate listing was removed from source documentation on 2026-10-11; the failure counts above are unchanged. This does not change or exempt any application asset from the release audit.

### Bundle sizes

```text
Before: unavailable (no comparable baseline retained)
Current dist/: 454128505 bytes
Current connection/dist/: 1584087 bytes
```

## FILES CHANGED

Full current worktree snapshot, including earlier unfinished work. Nook desktop/cloud-gaming index/release-note edits include unrelated changes and are not claimed as this repair. Generated output was rebuilt, not edited directly.

```text
.github/workflows/network.yml
CANON.md
Dockerfile.fellowship
Dockerfile.relay
barebooks/index.mjs
barebooks/worker.js
chapels/chat/app.js
chapels/cloud-gaming/luna-connection.mjs
chapels/drop/app.mjs
chapels/movies/intercession.mjs
chapels/nyxtube/styles.css
chapels/tutsi/app.mjs
chapels/tutsi/frame-navigation.mjs
chapels/tutsi/http-relay.mjs
chapels/tutsi/index.html
chapels/tutsi/intercession-compat.mjs
chapels/tutsi/intercession.mjs
chapels/tutsi/protections.mjs
chapels/tutsi/relay.mjs
chapels/tutsi/workspace-ad-runtime.mjs
connection/README.md
connection/address.mjs
connection/app.mjs
connection/build.mjs
connection/channel.mjs
connection/client.mjs
connection/constants.mjs
connection/cookies.mjs
connection/events.mjs
connection/frames.mjs
connection/index.html
connection/live.mjs
connection/package-lock.json
connection/package.json
connection/registration.mjs
connection/runtime.js
connection/server.mjs
connection/smoke.mjs
connection/socket.mjs
connection/test.mjs
connection/transform.mjs
connection/transport.mjs
connection/worker.mjs
fellowship-gateway.mjs
fellowship-server.js
gospel.js
incense/incense.wasm
incense/index.mjs
lectionary/offline.js
ministries/domain-pages/integration.mjs
nook-desktop/package-lock.json
nook-desktop/package.json
nook-desktop/scripts/test-connected-projects.mjs
nook-desktop/scripts/test-project-design.mjs
nook-desktop/scripts/test-web-reader.mjs
nook-desktop/src/connected-broker.cjs
nook-desktop/src/connections.cjs
nook-desktop/src/engine.cjs
nook-desktop/src/github-window.cjs
nook-desktop/src/index.html
nook-desktop/src/main.cjs
nook-desktop/src/renderer.js
nook-desktop/src/style.css
nook-desktop/src/web-reader.cjs
nook-desktop/test/connections.test.cjs
nook-desktop/test/github-login.test.cjs
package-lock.json
package.json
parables/display-names.js
parables/document-controls.js
parables/document-window.mjs
parables/intercession-startup.mjs
parables/relay-selection.js
pilgrim.sw.js
relay.js
relics/network/adapter.mjs
relics/network/frames.mjs
relics/network/transport.mjs
relics/transports/header-utils.mjs
relics/transports/incense-pilgrim.mjs
relics/transports/libcurl-client.mjs
relics/transports/libcurl-communion.mjs
relics/transports/libcurl-pilgrim.mjs
relics/transports/libcurl-response.mjs
relics/ugs/1/cl12minibattles.html
relics/ugs/1/cl1v1lolifnoaboutblank.html
relics/ugs/1/cl1v1lolnoaboutblank.html
relics/ugs/A/clachievmentunlocked.html
relics/ugs/B/clBTD1.html
relics/ugs/B/clballsandbricks.html
relics/ugs/B/clbigtowertinysquare.html
relics/ugs/B/clbigtowertinysquare2.html
relics/ugs/B/clblockcraftparkour.html
relics/ugs/C/clcarmods.html
relics/ugs/C/clcastlewarsmodern.html
relics/ugs/C/clcuttherope.html
relics/ugs/D/cldrawclimber.html
relics/ugs/D/cldriftboss.html
relics/ugs/F/clfootballlegends.html
relics/ugs/G/clgunmayhem2.html
relics/ugs/H/clhandulum.html
relics/ugs/I/clinnkeeper.html
relics/ugs/J/cljellytruck.html
relics/ugs/J/cljellytruckgood.html
relics/ugs/M/clmadalinstuntcars.html
relics/ugs/M/clmonkeymartenc.html
relics/ugs/M/clmotox3mpoolparty.html
relics/ugs/M/clmotox3mspookyland.html
relics/ugs/O/closu.html
relics/ugs/O/clovo.html
relics/ugs/P/clpapapizzagood.html
relics/ugs/P/clpapapizzamamamia.html
relics/ugs/P/clpaperio3d.html
relics/ugs/P/clpaperiomania.html
relics/ugs/P/clpolytrack.html
relics/ugs/P/clpolytrackalt.html
relics/ugs/R/clracingarena.html
relics/ugs/R/clredvsblue2.html
relics/ugs/R/clretrobowlfixed.html
relics/ugs/R/clrocketjump.html
relics/ugs/S/clsentryfortress.html
relics/ugs/S/clskibidiinthebackrooms.html
relics/ugs/S/clslowroads.html
relics/ugs/S/clsnakeis.html
relics/ugs/S/clsnipershot.html
relics/ugs/S/clsouljumper.html
relics/ugs/T/cltankmayhem.html
relics/ugs/T/cltanukisunset.html
relics/ugs/T/clthereisnofile.html
relics/ugs/T/cltunnelrush.html
rituals/audit-release.mjs
rituals/build-frontend-assets.mjs
rituals/build-intercession-assets.mjs
rituals/build-native-values.mjs
rituals/build-runtime-names.mjs
rituals/build-static-export.mjs
rituals/build-vps.mjs
rituals/check-deploy.mjs
rituals/intercession-asset-names.json
rituals/test-account-signup.mjs
rituals/test-ai-company-icons.mjs
rituals/test-ai-free-errors.mjs
rituals/test-ai-quota-regressions.mjs
rituals/test-ai-reply-model.mjs
rituals/test-binary-text.mjs
rituals/test-bookmux-worker.mjs
rituals/test-cached-folder-navigation.mjs
rituals/test-chat-social-workspace.mjs
rituals/test-code-edit-route.mjs
rituals/test-code-studio-actions.mjs
rituals/test-custom-hostname-sites.mjs
rituals/test-dependency-purge.mjs
rituals/test-developer-api-ui.mjs
rituals/test-document-listener.mjs
rituals/test-document-server.mjs
rituals/test-document-storage.mjs
rituals/test-document-window.mjs
rituals/test-expression.mjs
rituals/test-fellowship-relay.mjs
rituals/test-games-built.mjs
rituals/test-http-relay-workspace.mjs
rituals/test-intercession-transport-init.mjs
rituals/test-libcurl-response.mjs
rituals/test-local-folder-navigation.mjs
rituals/test-movie-discernment-types.mjs
rituals/test-movie-ranking.mjs
rituals/test-movies.mjs
rituals/test-network-adapter.mjs
rituals/test-nyxify-navigation-races.mjs
rituals/test-nyxtube-native-ui.mjs
rituals/test-nyxtube.mjs
rituals/test-regression.mjs
rituals/test-retired-transport.mjs
rituals/test-shell-document.mjs
rituals/test-source-layout.mjs
rituals/test-wallpaper-previews.mjs
rituals/test-workspace-settings-layout.mjs
robots.txt
scripture/binary-text.mjs
scripture/expression.mjs
scripture/fellowship-relay.mjs
scripture/network/server.mjs
scripture/public-assets.mjs
scripture/source-layout.mjs
scrolls/CONNECTION_REPLACEMENT.md
scrolls/NOOK_CONSOLE_RELEASE.md
scrolls/REPLACEMENT_VERIFICATION.md
shepherd.js
study.html
vespers.sw.js
```

Repair functions changed/added include `documentOrigin`, `openDocument`, `activeWorker`, `readTarget`, `navigate`, `reset`, `loadDocumentTab`, transformation edit/location handling, runtime `documentOwner` and context-menu `openMenu`. No rename-only substitution was used for these repairs. The larger refactor function-by-function inventory remains incomplete.

## DEPENDENCIES REMOVED

Root direct dependencies removed relative to HEAD:

- `@mercuryworkshop/bare-mux`
- `@mercuryworkshop/epoxy-transport`
- `@mercuryworkshop/libcurl-transport`
- `@mercuryworkshop/scramjet`
- `@mercuryworkshop/scramjet-controller`
- `wispurr`
