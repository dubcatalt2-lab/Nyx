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
