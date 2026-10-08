# Source layout

The repository uses themed source names. Published browser paths remain compatible with existing tabs and static packages through `scripture/source-layout.mjs` and the VPS build.

| Original source | Current source |
| --- | --- |
| assets | relics |
| baremux | barebooks |
| css | vestments |
| deploy | mission |
| epoxy | incense |
| js | parables |
| scramjet | pilgrim |
| scripts | rituals |
| tools | ministry |
| script.js | gospel.js |
| index.html | study.html |
| server.js | shepherd.js |
| startup.js | genesis.js |
| styles.css | vestments.css |
| scramjet.sw.js | pilgrim.sw.js |
| wisp-server.js | fellowship-server.js |
| ai.html | oracle.html |
| app.webmanifest | covenant.webmanifest |
| firestore.rules | covenant.rules |
| nyx-singlefile.html | pilgrimage.html |
| startup-studyhub.html | catechism.html |
| README.md | TESTAMENT.md |
| DEPLOYMENT.md | MISSION.md |
| OWNER_DASHBOARD.md | STEWARDSHIP.md |
| Dockerfile.wisp | Dockerfile.fellowship |
| apps | chapels |
| lib | scripture |
| services | ministries |
| companion | deacon |
| remote-host | hermitage |
| static-export | lectionary |
| docs | scrolls |
| about-nyx.html | testimony.html |
| student-resources.html | teachings.html |
| nyx.html | sanctum.html |
| tutsi-runtime.sw.js | vespers.sw.js |
| server-http-wisp.mjs | fellowship-gateway.mjs |

Remaining first-party filenames use `intercession`, `discernment`, `fellowship`, `incense`, `pilgrim`, and `communion` in place of the previous proxy, search, Wisp, Epoxy, Scramjet, and BareMux terms. The complete mapping is in `scripture/source-layout.mjs`. Third-party branding, required licenses, dependency names and network protocol identifiers are preserved. These source renames do not make downloaded browser code private.

The two old HTML backups are `archive-chronicle.html` and `archive-testament.html`. Ultraviolet and obsolete Netlify deployment files are removed. Tool-discovered names (`package.json`, `package-lock.json`, `firebase.json`, `railway.json`, `.gitignore`, `.gitattributes`, `.dockerignore`, `.nvmrc`) stay intact. The source entry is `study.html`; builds publish a single educational `index.html` cover with an HTML refresh to `study.html`. The app entry and `/nyx` load the workspace without a second educational splash. Existing BareMux URLs still resolve to the `barebooks` sources.

Browser builds assign opaque local variable/function names and encode string literals after imports, worker URLs and module filenames have been rewritten. The string pass compares parsed executable structure before and after each transformation. Public APIs, export names, licenses, directives, tagged-template raw text and binary data retain their required contracts. Server/build source stays private and editable. Public modules remain `.js`, with explicit compatibility routes for old `.mjs` URLs. The private frontend manifest retains entry payloads so static exports can rebase them; it is neither served nor included in the static package. Static exports decode strings before URL rebasing, then encode them again, retaining the publisher's hosting-path placeholder.

Use `npm start`, `npm run build:vps`, and `npm run check:deploy`. Deployment scripts are under `mission/`; tests and build helpers are under `rituals/`. Generated `dist/` keeps established public URLs; do not edit it manually. `sourceFile` resolves legacy source references for build/read checks without publishing private code. Both old and new private paths are rejected by the server.

The October 6 naming update replaces owned local bindings with `workspace`, `connection`, `explore`, and `studyjet` names, and updates the corresponding DOM classes, data attributes, selectors, dataset access, and test fixtures together. The default page identity is Learning Commons. Existing default StudyHub titles migrate once; custom titles and saved preferences are preserved.

Shared startup exports are now `loadConnectionScript`, `trackConnectionController`, and `waitForConnectionController`. Tutsi/Drop use `explore`, `reloadWorkspace`, `closeWorkspace`, and `warmWorkspace`; movie controls use `launchMovieConnection`, `inspectMovieConnection`, `canStartMovieConnection`, and `startMovieConnection`. Each module retains its previous exports as aliases to the same functions for cached callers.

The final build pass also writes selected runtime-sensitive identifiers using JavaScript Unicode escapes. It verifies identical parsed executable structure, including import/export bindings, member names, private fields, and shorthand properties. Static publishing decodes these escapes before rebasing and encodes them afterward. This is a source presentation change, not access control. Required licenses, browser APIs, dependency package names, protocol/storage keys, and legacy routes remain compatible; diagnostic regular expressions retain their behavior. Public assets remain `.js` with explicit legacy `.mjs` mappings. The naming update does not activate ads or add Ultraviolet.

The follow-up uses `workspace` throughout remaining owned classes, IDs, animation names, state properties, routes, local bindings, helper exports, and 29 source filenames. The app uses `nyx.workspaceMode`, `nyx.workspaceBackground`, and `nyx.workspaceBookmarks`; existing local/cloud preferences migrate without replacing newer values. Old cloud clients retain response aliases. Tutsi accepts its old saved hash and normalizes it to `#workspace`. Renamed runtime modules retain explicit `.mjs`, previous `.js`, and previous opaque-URL compatibility; new publication paths use `workspace`. The third-party Firebase persistence export, external service hostnames, CLI platform values, game library signatures, and required licenses keep their external meanings.

`nyx.ridgewoodstem.org` is an approved Nyx hostname, served by the existing Caddy on-demand HTTPS setup. Production ads remain disabled and UV remains excluded.

Startup does not await the optional keyboard-lock permission request. A pending permission prompt previously held the launch screen at 49%; shortcut permission now proceeds independently while Home finishes loading. The built regression in `rituals/test-startup-keyboard-permission.mjs` covers pending, denied, unavailable and granted permission, including late completion and desktop/mobile input access.

The default tab identity is now DeltaMath, using the locally served graduation-cap favicon from `https://www.deltamath.com/favicon-32x32.png` at `relics/icons/deltamath.png`. New sessions and existing untouched StudyHub/Learning Commons defaults migrate once to `deltamath-v5`; custom titles, custom icons and explicitly selected presets are preserved. DeltaMath is selectable in the tab preset controls and used by Reset. The HTML-only entry cover and app entry shell use the same title/icon. This changes the tab preset, not the Nyx interface or organization metadata.

Balatro is available in the bundled Nyx Games catalog at /assets/vendor/balatro/index.html, using a pinned 55GMS web-build snapshot documented in that directory's ORIGIN.txt. Assets and saves are local; the upstream global script, remote base URL and ad callback are omitted. The game sends the catalog readiness message when its runtime is ready. Autosaves use a deduplicated direct FS.syncfs bridge; synthetic beforeunload dispatches are forbidden because they can stop the game engine. The static exporter includes this bundled catalog alongside the existing local catalog. The port is included in the next verified release, with no upstream advertising scripts.


The October 7 interface and save update groups the shell under a display:contents #app container, including the dock, tab sidebar and owned overlays. Uploaded/generated wallpaper data uses short, reusable object URLs without changing bytes; old references are released. This compacts the Elements tree; it does not prevent inspection. Production naming/string encoding and private-source restrictions remain in place.

Hosted Nyx exposes educational shell routes: Games /history, Music /arts, NyxTube /lectures, Movies /literature, Chat /classroom, AI /mathematics, VMs /laboratory, cloud gaming /computing, Code Sandbox /assignments, Link Generator /references, Link Checker /citations, publisher /publishing, API keys /credentials, Settings /planner, Apps /resources. Direct links reopen their app; selection updates the address without reloading the shell. Canonical iframe/asset/API paths remain compatible. A shared learning-routes module owns the mapping; static exports without hosted runtime configuration retain their existing routes. App and navigation display labels use Unicode/leet presentation while route IDs, stored names and accessible labels retain their contracts.

Game cloud sync now checkpoints every five seconds and when hidden/closed, reports save status, and retains an account/game-scoped retry journal. It restores supported filesystem records before starting the game, including Date/binary FILE_DATA records in /userfs, /idbfs and /home/web_user/love. Super Liquid Soccer uses /userfs and previously received no IndexedDB cloud sync. Restores preserve newer pending local progress, and server/parent relays reject mismatched account identities. Existing backend payload limits still apply; oversized saves report that local progress is retained. Opaque or external-origin providers and other database schemas are not covered by this adapter. It cannot recover progress that was never saved. The status is grouped with the game title so toolbar controls remain clickable.

Production advertising remains disabled; Ultraviolet stays excluded. Localhost alone uses NYX_ADS_ENABLED=true and NYX_ADS_ADKID_ONLY=true. Guests/ordinary accounts and exempt Premium/staff/ad-free accounts stay off. All Adkid placements now require the actual visible Home selection; no global overlay or cross-app click handlers remain. Leaving Home destroys frames/cancels pending fetches, popup lock callbacks recheck navigation, and ad breaks/dismissals/frequency limits remain enforced. Local launcher files remain ignored and are not deployed.

The release build no longer shares Terser name caches across unrelated pages or modules. Module syntax is detected even in .js files; classic-script top-level globals retain their cross-script contracts. The previous shared cache could rename the browser history API to an undefined identifier from the AI app. The built desktop/mobile interface regression covers Home, educational routes, deep-link reloads, compact wallpaper URLs and localhost-only advertising cleanup. Owned localhost ad containers use the existing overlay marker so Nyx's quarantine does not remove them; production advertising remains off. Pending game-save startup retries settle before the session is reported ready.

The October 7 settings naming pass uses Connections, Learning engine, Compatibility mode and Connection method in place of the old technical settings headings. Connection choices show Atlas, Textbook and Relay; stored values, selectors and connection contracts remain unchanged. Tutsi/Drop settings and connection errors use the same vocabulary. Legacy failure-page matching still recognizes the previous names for cached clients.

The shared display-label formatter now loads in standalone first-party apps, handles icon-bearing headings and dynamically rendered app tiles, and installs once per document. It preserves accessible names, icons, editable fields, user/profile names, chat/AI messages and code blocks. The built desktop/mobile app audit covers the default catalog, settings saving and 14 primary app startup surfaces with fixture APIs. Native music tests cover full-song playback, seeking, retry/renewal, pause while loading, autoplay denial, timeouts, rapid switching and offline recovery on desktop/mobile. The old test-nyxify-player.mjs targets the retired preview/Octave flow and is not the current playback acceptance test; use test-nyxify-native-player.mjs with NYX_TEST_ASSET_ROOT=dist. Production ads remain disabled and UV excluded.

The AI workspace at /ai.html (source oracle.html), distinct from the Nook agents app, now loads the shared display formatter and explicitly marks its brand label. Its visible title/brand and screen-share/status branding use the styled name, composer says "Message your model...", allowance says "Your model allowance", and the disclaimer retains its meaning using "Responses can contain mistakes." Code Studio's assistant eyebrow is also marked. AI message bodies and saved thread lists are excluded from formatting. The app-label audit now includes this actual AI workspace on desktop/mobile and verifies typed/message text preservation.

The follow-up display preference keeps AI/A1 labels as literal A1 (normal ASCII A and 1), including the dock, workspace title, AI brand, Code Studio label and assistant fallback icon. Other app names retain their existing Unicode/leet presentation.

The Games player back-button label is now explicitly marked for display-name formatting in both the main catalog and Drop. It previously sat outside the formatter's heading/navigation selectors and remained plain GAMES. The built Games test exercises the marked label across player open/close/reopen on desktop/mobile, with fixture game documents and the real built catalog.

Luna cloud gaming now uses the built-in connection engine instead of a direct external iframe. Nested Games/Cloud Gaming pages find the host's managed-frame API; the standalone/pop-out page initializes the same engine using saved connection settings. The toolbar pop-out opens the Nyx cloud page. Closing, replacing or leaving Luna cancels its pending launch and releases its managed frame; stale attempts cannot update a reopened player. Connection failure does not fall back to a direct provider frame. The targeted Luna fixture covers nested routing, cancellation/reopen races, standalone preferences and failure cleanup. Production advertising and UV settings are unchanged.

The subsequent retired-engine cleanup removes the two obsolete archived shell pages containing the old engine implementation, the missing configuration-file preflight request, engine-specific branches, cache-name matching, asset-route/build handling and obsolete documentation. Unknown saved engine names now resolve generically to the current engine, preserving migration without retaining retired-engine aliases in application code. Generic legacy /service/ URL recovery remains for old saved links. Negative regression tests and historical release notes retain the retired engine's name to verify its absence and record history. Graphics texture-coordinate variables named uv are unrelated and remain intact.

The subsequent classic-engine cleanup removes the Scramjet 1.1.0 dependency, its vendored pilgrim runtime binaries/scripts, classic worker, server handlers, shell loader/state/configuration and build/asset aliases. The supported 2.x engine/controller remains. Unknown saved selections still migrate to the supported engine; a generic versioned-link decoder preserves previously saved destinations without loading the retired runtime. Regression cases using old selection names intentionally remain. Access-log sanitization continues to hide destinations in retired versioned paths.


## 2026-10-07 Settings presentation and Code Sandbox

Settings use educational wording and Unicode display labels for section names, workspace controls, automatic study-window opening, and return destinations. Internal storage keys, connection option values, provider URLs, and event handlers are preserved. Category search indexes readable source labels before styling. Generated accessibility names update when headings change. NyxTube topic/Shorts labels and the cloud catalog switch use the shared display formatter.

Code Sandbox adds local language-keyword, current-file identifier, and small snippet suggestions (Ctrl+Space, arrows, Enter/Tab, Escape). This is lightweight completion, not a language server or full VS Code IntelliSense. Mid-sized desktops stack editor/preview; small screens switch between editor, result, and assistant. Saved files and preview flow are unchanged. Regression checks: test-code-suggestions.mjs and test-app-label-audit.mjs. Production ads remain disabled and retired UV/SJv1 assets remain absent.

Stratus uses the self-hosted standalone backend refreshed directly from GitHub x8rr/stratus-api at 8783524043ac214c0f6a64d4fa0ae94360200d7c; API and embed contents match the previous snapshot. Maintenance now requires an explicit NYX_CLOUD_GAMING_MAINTENANCE=1, rather than silently defaulting on. Existing-account login, access checks, limits, and private credentials remain. Live preflight accepted sign-in but returned provider access status 3004 (streaming credit required); no game session was created. Hosted api.stratus.lol did not resolve from the VPS. Catalog availability is not proof that streaming is available.


## Barebooks runtime naming

The shell initialization guard is `__nyxBarebooksResponderInstalled`. The production runtime transformer now consistently maps BareMux/baremux to Bookmux/bookmux and bare-mux message names to book-mux; current assets use /bookmux/ URLs. Source directory remains barebooks. Worker identity stays ridgewood-stem-worker across callers. Original package coordinates and legacy compatibility paths remain for dependency resolution and already-open clients. The immediately previous opaque /baremux/ aliases are also generated with their previous export/message contract; current clients use only the renamed module. Test-runtime-names checks current active scripts/WASM, and test-bookmux-worker checks both current and previous module exports and live SharedWorker handshakes. Real navigation was verified with HTTP bridge enabled and disabled.


## 2026-10-08 NyxTube recovery and A1 spending controls

- Native NyxTube playback now calls yt-dlp independently of discovery's Invidious cooldown/cache. Native failures remain on the selected player, show the original safe error and expose an accessible retry button. Invidious remains an explicit alternative.
- Nyx A1 reserves Astra, Claude except Haiku 4.5, and models with input or output pricing over USD 3 per million tokens for owners. Both catalog and request/reservation checks enforce this; Premium and per-user allow rules cannot bypass it. Other app policies are preserved.
- Owner user editor supports model filtering, hidden owner-reserved rows for members, separate access/message controls and per-user/model token credit grants. Credits are consumed before the normal token pool, persist across resets, are granted idempotently and refunded with usage settlement. They do not override access, model restrictions or shared dollar budgets. One credit is one input/output token.
- Production ads remain disabled; UV and retired SJ v1 remain excluded.
