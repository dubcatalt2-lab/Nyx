# Release repairs ? verification candidate

2026-10-12 UTC. The document service is active at https://documents.nyxlearning.org. The main application and public main have not yet been updated. This report supersedes the earlier blocked audit.

## COMPLETED

- Added a code-aware release audit with scope/alias-aware native-call counting,
  decoded constant strings, inline scripts, compressed executable inspection,
  source-map detection and complete raw findings. A finding is reviewed by exact
  file SHA256 plus individual context hashes. Changed bytes invalidate the review.
  No game or vendor directory is exempt. Known removed-engine identifiers cannot
  be approved through the evidence file.
- Added regression tests for aliases, shadowed names, reflective constructors,
  source-map comments, compressed programs, changed review hashes, callback
  registries and explicit compiler bindings. CI runs the tests and retains the
  raw release audit even when the build fails. Component builds now write a
  separate report instead of overwriting the full application audit.
- Renamed the green theme to Botany, including CSS variables, selectors and the
  background identifier. The persisted `fresh` value and palette remain stable.
  Renamed other first-party labels/selectors identified by the audit.
- Renamed all twelve flagged asset paths and updated the catalog, thumbnail
  references and styles together. Game titles, keys, directories and save keys
  remain stable. Old decoration values normalize to the new value in the app,
  server and chat. Migration input aliases remain until stored records have been
  migrated; no bulk account-data mutation was performed.
- Retained the genuine controller hardware identifier, graphics UV coordinates,
  serialized game plant identifiers and reviewed multiplayer transport method.
  These are compatibility data or third-party game functions, not Nyx branding
  or the removed connection engine. PNG chunks were decoded, the WASM validated,
  and encoded payload formats/hashes examined. The gzip program was expanded and
  parsed rather than assumed to be inert data.
- Replaced dynamic callback lookups with explicit function registries, point
  access with property accessors, and keyword/global-object factories with
  ordinary functions. Constant-expression compilation remains in the build.
  Necessary game program compilation uses `scripture/lesson-compiler.mjs` with
  explicit parameter arrays/bindings. Its global evaluator preserves developer
  console declarations. There is one compiler and one global evaluator in source;
  the static publisher duplicates the shipped module, giving two physical call
  sites for each in the distribution. The evaluator is counted, not hidden.
- Fixed compiler loading when game documents have an external base URL, including
  the actual embedded-document preparation path. The backend serves the audited
  built compiler, console and media files. Removed the dead controller route that
  referenced a deleted implementation.
- Kept browser games minified and obfuscated. Normalized document line endings
  before positional mangling so Windows and Linux builds produce consistent
  reviewed bytes. No streaming was enabled. Removed unused saved-container
  bootstrap scripts from the Cookie Clicker document while retaining its game
  scripts and DOM.
- Clarified the yt-dlp authentication error and tested the expired-session and
  recovery paths. Added the private cookie renewal procedure to NYXTUBE_BACKEND.md.
- Refreshed all 840 GN Math catalog entries while retaining stable IDs and saved titles. Stored 835 optimized local covers; five exceptional formats/sizes retain remote fallbacks. Stale launch paths refresh from the provider after a 404. Verified old Slope/Retro Bowl URLs and a real Retro Bowl launch.
- Added separate HTTPS document origins, private persistent cookie jars, authenticated event streams, and clicked popup/callback handling. Worker requests receive single-use origin-bound tickets through the owning window because browser worker connections can omit partitioned cookies. Ticket reuse and cross-origin use are rejected. CI now tests the actual nested Nyx shell.
- Fixed cookie-write failure recovery, default saved-shortcut migration, static-publisher folder navigation, and two new-page controls whose renamed attributes had detached their handlers. Updated obsolete UI test fixtures to match the current navigation and editor.
- Removed the embedded source-map directive from the generated offline game and disabled its original signature badge. The source archive stays unchanged; the distributed game is explicitly a modified, unsigned build.
- Renewed the private server YouTube cookie file supplied by the user. Credentials remain outside the repository and reports.

## INCOMPLETE

- Public-main reconciliation and main application activation are pending. The separately hosted document service and localhost configuration have been updated.
- Full third-party OAuth login completion is not verified. Popup opening/callbacks pass Chrome and Edge, and live TikTok opens the actual Google sign-in page; cookie-only OAuth flows across top-level partitions are not guaranteed to share a session. TikTok intermittently returns feed 403 responses and an initialization error also reproduced in a direct Chrome load.
- Comprehensive gameplay of every bundled/provider game is not verified. The modified offline game reaches the new-world loading screen; complete play/save/reload remains unverified. Five cover files retain remote fallbacks.
- A pre-refactor full-distribution byte baseline was not captured. The precise before/after game-delivery measurement below covers 1,586 files, not the entire application.

## VERIFICATION OUTPUT

Machine-local workspace paths below are abbreviated; the original raw logs remain in .codex-artifacts.

Raw matches and their classifications remain in `.codex-artifacts/release-audit.json`. CI uploads the complete report, including failed audits. The literal scan is retained; exact hashes and contexts classify incidental matches without directory exemptions.

```text
{
  "passed": true,
  "files": 5220,
  "counts": {
    "atob": 0,
    "eval": 2,
    "Function": 2
  },
  "nonGlobalFunctionMethods": 4,
  "rawMatches": 452,
  "classified": 452,
  "blockingFindings": 0,
  "pathMatches": 0,
  "parseErrors": 0,
  "unreadable": 0,
  "sourceMaps": 0,
  "embeddedPrograms": 1,
  "report": "C:\\Users\\dubca\\Downloads\\<workspace>\\.worktrees\\nyx-page-wording-20261008\\.codex-artifacts\\release-audit.json"
}
VPS build ready in C:\Users\dubca\Downloads\<workspace>\.worktrees\nyx-page-wording-20261008\dist
```

```text
Lesson delivery: {"files":1586,"scripts":2411,"beforeBytes":169071635,"afterBytes":161472701,"cached":1586,"failures":[]}
```

Raw release-dependencies.log:

```text
PASS manifest: no prohibited dependency
PASS regenerated lockfile: 408 entries, no prohibited package or dependency
PASS installed tree: 348 packages, no prohibited package
PASS copied runtimes, workers, relay and asset-copy generator are absent
PASS start:relay uses the original implementation
```

Raw release-deploy-check.log:

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
PASS retired-engine audit: 3971 files, 71 decoded payloads, 1268 media/archive files classified separately, 0 prohibited matches
Deployment check passed (302 required files found).
npm notice run nyx@1.0.0 check:branding
npm notice run node rituals/check-branding.mjs
Nyx branding check passed (3989 tracked files checked).
```

Raw release-shell-chrome.log:

```text
PASS isolated worker ready
node : {"event":"document-request-error","route":"document","kind":"Document origin mismatch"}
At line:2 char:113
+ ... ost:8080/study.html'; node connection/isolated-smoke.mjs 2>&1 | Out-F ...
+                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ({"event":"docum...igin mismatch"}:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
PASS isolated Chrome through Nyx shell: distinct origins, storage, HttpOnly exclusion, cookies after navigation/reload, failed cookie-write recovery, CORS denial/allowance, Worker/SharedWorker, authenticated event stream, clicked login popup, cross-window callbacks, blocked unsolicited popup and forged host rejection
```

Raw release-shell-edge.log:

```text
PASS isolated worker ready
node : {"event":"document-request-error","route":"document","kind":"Document origin mismatch"}
At line:2 char:68
+ ... SER_CHANNEL='msedge'; node connection/isolated-smoke.mjs 2>&1 | Out-F ...
+                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ({"event":"docum...igin mismatch"}:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
PASS isolated msedge through Nyx shell: distinct origins, storage, HttpOnly exclusion, cookies after navigation/reload, failed cookie-write recovery, CORS denial/allowance, Worker/SharedWorker, authenticated event stream, clicked login popup, cross-window callbacks, blocked unsolicited popup and forged host rejection
```

Raw release-session-tests.log:

```text
✔ session cookies persist across stores and stay isolated (22.8694ms)
{"event":"document-request-error","route":"document","kind":"Document session missing"}
✔ document access tickets require cookies and cannot be reused or cross origins (49.4498ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 329.0082
```

Raw release-code-studio.log:

```text
Code Sandbox test: all 16 language paths, AI suggestions, preview, and mobile layout passed
```

Raw release-account-controls.log:

```text
Homepage constellation, workspace URL privacy, colored app icons, account controls, and embedded Chat profile regression passed.
```

Raw release-built-catalog.log:

```text
PASS backend serves the audited developer console, media library and compiler build bytes
PASS Games back label/open/close 1365 /assets/games/
PASS Games back label/open/close 1365 /apps/drop/games.html
PASS Games back label/open/close 390 /assets/games/
PASS Games back label/open/close 390 /apps/drop/games.html
Built arcade loads the real JSON manifest and both bundled game catalogs.
```

Live TikTok provider popup (no credentials entered):

```text
{"popupOpened":true,"popupHost":"d-89a8000a68d759c68bfaeab5056d67342e97643511923e63702da58a.nyxlearning.org","title":"Sign in - Google Accounts"}
```

No removed package appears in the final build in any form. This covers the audited review candidate, not the older public main or main production deployment. No removed networking source was vendored or wrapped.

## FILES CHANGED

This full scoped list excludes unrelated Nook/cloud changes. Generated dist files were built, not edited. No public game functions were renamed; generated local names are mangled by the build. New source functions include inspectCode, auditRelease, repairLessonCode, buildLessonRuntime, compile, evaluateGlobal, prepareOfflineDocument, isolatedApplication, sessionStore, partition, and catalogDocuments. The twelve asset renames retain stable game identities and saved-data migrations.

```text
M	.github/workflows/network.yml
M	chapels/chat/app.js
M	connection/README.md
M	connection/address.mjs
M	connection/assets.mjs
M	connection/build.mjs
M	connection/channel.mjs
M	connection/index.html
A	connection/isolated-app.mjs
A	connection/isolated-client.mjs
A	connection/isolated-smoke.mjs
A	connection/isolated-worker.mjs
M	connection/package.json
A	connection/partition.mjs
M	connection/runtime.js
M	connection/server.mjs
A	connection/session-store.mjs
M	connection/socket.mjs
M	connection/transform.mjs
M	gospel.js
A	mission/install-document-service.sh
A	mission/systemd/nyx-document.service.template
M	package.json
M	parables/document-window.mjs
M	relics/games/games.js
A	relics/gn-math/covers/lesson-0.webp
A	relics/gn-math/covers/lesson-1.webp
A	relics/gn-math/covers/lesson-10.webp
A	relics/gn-math/covers/lesson-100.webp
A	relics/gn-math/covers/lesson-101.webp
A	relics/gn-math/covers/lesson-102.webp
A	relics/gn-math/covers/lesson-103.webp
A	relics/gn-math/covers/lesson-104.webp
A	relics/gn-math/covers/lesson-105.webp
A	relics/gn-math/covers/lesson-106.webp
A	relics/gn-math/covers/lesson-107.webp
A	relics/gn-math/covers/lesson-108.webp
A	relics/gn-math/covers/lesson-109.webp
A	relics/gn-math/covers/lesson-11.webp
A	relics/gn-math/covers/lesson-110.webp
A	relics/gn-math/covers/lesson-111.webp
A	relics/gn-math/covers/lesson-113.webp
A	relics/gn-math/covers/lesson-114.webp
A	relics/gn-math/covers/lesson-115.webp
A	relics/gn-math/covers/lesson-116.webp
A	relics/gn-math/covers/lesson-117.webp
A	relics/gn-math/covers/lesson-118.webp
A	relics/gn-math/covers/lesson-120.webp
A	relics/gn-math/covers/lesson-121.webp
A	relics/gn-math/covers/lesson-122.webp
A	relics/gn-math/covers/lesson-123.webp
A	relics/gn-math/covers/lesson-124.webp
A	relics/gn-math/covers/lesson-125.webp
A	relics/gn-math/covers/lesson-127.webp
A	relics/gn-math/covers/lesson-128.webp
A	relics/gn-math/covers/lesson-129.webp
A	relics/gn-math/covers/lesson-13.webp
A	relics/gn-math/covers/lesson-130.webp
A	relics/gn-math/covers/lesson-14.webp
A	relics/gn-math/covers/lesson-146.webp
A	relics/gn-math/covers/lesson-147.webp
A	relics/gn-math/covers/lesson-148.webp
A	relics/gn-math/covers/lesson-149.webp
A	relics/gn-math/covers/lesson-15.webp
A	relics/gn-math/covers/lesson-150.webp
A	relics/gn-math/covers/lesson-151.webp
A	relics/gn-math/covers/lesson-152.webp
A	relics/gn-math/covers/lesson-153.webp
A	relics/gn-math/covers/lesson-154.webp
A	relics/gn-math/covers/lesson-155.webp
A	relics/gn-math/covers/lesson-156.webp
A	relics/gn-math/covers/lesson-157.webp
A	relics/gn-math/covers/lesson-158.webp
A	relics/gn-math/covers/lesson-159.webp
A	relics/gn-math/covers/lesson-16.webp
A	relics/gn-math/covers/lesson-160.webp
A	relics/gn-math/covers/lesson-161.webp
A	relics/gn-math/covers/lesson-162.webp
A	relics/gn-math/covers/lesson-163.webp
A	relics/gn-math/covers/lesson-164.webp
A	relics/gn-math/covers/lesson-165.webp
A	relics/gn-math/covers/lesson-166.webp
A	relics/gn-math/covers/lesson-167.webp
A	relics/gn-math/covers/lesson-168.webp
A	relics/gn-math/covers/lesson-169.webp
A	relics/gn-math/covers/lesson-17.webp
A	relics/gn-math/covers/lesson-170.webp
A	relics/gn-math/covers/lesson-171.webp
A	relics/gn-math/covers/lesson-172.webp
A	relics/gn-math/covers/lesson-173.webp
A	relics/gn-math/covers/lesson-174.webp
A	relics/gn-math/covers/lesson-175.webp
A	relics/gn-math/covers/lesson-176.webp
A	relics/gn-math/covers/lesson-177.webp
A	relics/gn-math/covers/lesson-178.webp
A	relics/gn-math/covers/lesson-179.webp
A	relics/gn-math/covers/lesson-18.webp
A	relics/gn-math/covers/lesson-180.webp
A	relics/gn-math/covers/lesson-181.webp
A	relics/gn-math/covers/lesson-182.webp
A	relics/gn-math/covers/lesson-183.webp
A	relics/gn-math/covers/lesson-185.webp
A	relics/gn-math/covers/lesson-186.webp
A	relics/gn-math/covers/lesson-187.webp
A	relics/gn-math/covers/lesson-188.webp
A	relics/gn-math/covers/lesson-19.webp
A	relics/gn-math/covers/lesson-190.webp
A	relics/gn-math/covers/lesson-191.webp
A	relics/gn-math/covers/lesson-192.webp
A	relics/gn-math/covers/lesson-193.webp
A	relics/gn-math/covers/lesson-194.webp
A	relics/gn-math/covers/lesson-195.webp
A	relics/gn-math/covers/lesson-196.webp
A	relics/gn-math/covers/lesson-197.webp
A	relics/gn-math/covers/lesson-198.webp
A	relics/gn-math/covers/lesson-199.webp
A	relics/gn-math/covers/lesson-2.webp
A	relics/gn-math/covers/lesson-20.webp
A	relics/gn-math/covers/lesson-200.webp
A	relics/gn-math/covers/lesson-201.webp
A	relics/gn-math/covers/lesson-202.webp
A	relics/gn-math/covers/lesson-203.webp
A	relics/gn-math/covers/lesson-204.webp
A	relics/gn-math/covers/lesson-205.webp
A	relics/gn-math/covers/lesson-206.webp
A	relics/gn-math/covers/lesson-207.webp
A	relics/gn-math/covers/lesson-208.webp
A	relics/gn-math/covers/lesson-209.webp
A	relics/gn-math/covers/lesson-21.webp
A	relics/gn-math/covers/lesson-210.webp
A	relics/gn-math/covers/lesson-211.webp
A	relics/gn-math/covers/lesson-212.webp
A	relics/gn-math/covers/lesson-213.webp
A	relics/gn-math/covers/lesson-214.webp
A	relics/gn-math/covers/lesson-215.webp
A	relics/gn-math/covers/lesson-216.webp
A	relics/gn-math/covers/lesson-217.webp
A	relics/gn-math/covers/lesson-218.webp
A	relics/gn-math/covers/lesson-219.webp
A	relics/gn-math/covers/lesson-22.webp
A	relics/gn-math/covers/lesson-220.webp
A	relics/gn-math/covers/lesson-221.webp
A	relics/gn-math/covers/lesson-222.webp
A	relics/gn-math/covers/lesson-223.webp
A	relics/gn-math/covers/lesson-224.webp
A	relics/gn-math/covers/lesson-225.webp
A	relics/gn-math/covers/lesson-226.webp
A	relics/gn-math/covers/lesson-227.webp
A	relics/gn-math/covers/lesson-228.webp
A	relics/gn-math/covers/lesson-229.webp
A	relics/gn-math/covers/lesson-23.webp
A	relics/gn-math/covers/lesson-230.webp
A	relics/gn-math/covers/lesson-231.webp
A	relics/gn-math/covers/lesson-232.webp
A	relics/gn-math/covers/lesson-233.webp
A	relics/gn-math/covers/lesson-234.webp
A	relics/gn-math/covers/lesson-235.webp
A	relics/gn-math/covers/lesson-236.webp
A	relics/gn-math/covers/lesson-237.webp
A	relics/gn-math/covers/lesson-238.webp
A	relics/gn-math/covers/lesson-239.webp
A	relics/gn-math/covers/lesson-24.webp
A	relics/gn-math/covers/lesson-240.webp
A	relics/gn-math/covers/lesson-241.webp
A	relics/gn-math/covers/lesson-242.webp
A	relics/gn-math/covers/lesson-243.webp
A	relics/gn-math/covers/lesson-244.webp
A	relics/gn-math/covers/lesson-245.webp
A	relics/gn-math/covers/lesson-246.webp
A	relics/gn-math/covers/lesson-247.webp
A	relics/gn-math/covers/lesson-248.webp
A	relics/gn-math/covers/lesson-249.webp
A	relics/gn-math/covers/lesson-25.webp
A	relics/gn-math/covers/lesson-250.webp
A	relics/gn-math/covers/lesson-251.webp
A	relics/gn-math/covers/lesson-252.webp
A	relics/gn-math/covers/lesson-253.webp
A	relics/gn-math/covers/lesson-255.webp
A	relics/gn-math/covers/lesson-256.webp
A	relics/gn-math/covers/lesson-257.webp
A	relics/gn-math/covers/lesson-258.webp
A	relics/gn-math/covers/lesson-259.webp
A	relics/gn-math/covers/lesson-26.webp
A	relics/gn-math/covers/lesson-260.webp
A	relics/gn-math/covers/lesson-261.webp
A	relics/gn-math/covers/lesson-262.webp
A	relics/gn-math/covers/lesson-263.webp
A	relics/gn-math/covers/lesson-264.webp
A	relics/gn-math/covers/lesson-265.webp
A	relics/gn-math/covers/lesson-266.webp
A	relics/gn-math/covers/lesson-267.webp
A	relics/gn-math/covers/lesson-268.webp
A	relics/gn-math/covers/lesson-269.webp
A	relics/gn-math/covers/lesson-27.webp
A	relics/gn-math/covers/lesson-270.webp
A	relics/gn-math/covers/lesson-271.webp
A	relics/gn-math/covers/lesson-272.webp
A	relics/gn-math/covers/lesson-273.webp
A	relics/gn-math/covers/lesson-274.webp
A	relics/gn-math/covers/lesson-275.webp
A	relics/gn-math/covers/lesson-276.webp
A	relics/gn-math/covers/lesson-277.webp
A	relics/gn-math/covers/lesson-278.webp
A	relics/gn-math/covers/lesson-279.webp
A	relics/gn-math/covers/lesson-28.webp
A	relics/gn-math/covers/lesson-280.webp
A	relics/gn-math/covers/lesson-281.webp
A	relics/gn-math/covers/lesson-282.webp
A	relics/gn-math/covers/lesson-283.webp
A	relics/gn-math/covers/lesson-284.webp
A	relics/gn-math/covers/lesson-285.webp
A	relics/gn-math/covers/lesson-286.webp
A	relics/gn-math/covers/lesson-287.webp
A	relics/gn-math/covers/lesson-288.webp
A	relics/gn-math/covers/lesson-289.webp
A	relics/gn-math/covers/lesson-29.webp
A	relics/gn-math/covers/lesson-290.webp
A	relics/gn-math/covers/lesson-291.webp
A	relics/gn-math/covers/lesson-292.webp
A	relics/gn-math/covers/lesson-293.webp
A	relics/gn-math/covers/lesson-294.webp
A	relics/gn-math/covers/lesson-295.webp
A	relics/gn-math/covers/lesson-297.webp
A	relics/gn-math/covers/lesson-298.webp
A	relics/gn-math/covers/lesson-299.webp
A	relics/gn-math/covers/lesson-3.webp
A	relics/gn-math/covers/lesson-30.webp
A	relics/gn-math/covers/lesson-300.webp
A	relics/gn-math/covers/lesson-301.webp
A	relics/gn-math/covers/lesson-302.webp
A	relics/gn-math/covers/lesson-303.webp
A	relics/gn-math/covers/lesson-304.webp
A	relics/gn-math/covers/lesson-305.webp
A	relics/gn-math/covers/lesson-306.webp
A	relics/gn-math/covers/lesson-307.webp
A	relics/gn-math/covers/lesson-308.webp
A	relics/gn-math/covers/lesson-309.webp
A	relics/gn-math/covers/lesson-31.webp
A	relics/gn-math/covers/lesson-310.webp
A	relics/gn-math/covers/lesson-311.webp
A	relics/gn-math/covers/lesson-312.webp
A	relics/gn-math/covers/lesson-313.webp
A	relics/gn-math/covers/lesson-314.webp
A	relics/gn-math/covers/lesson-315.webp
A	relics/gn-math/covers/lesson-316.webp
A	relics/gn-math/covers/lesson-317.webp
A	relics/gn-math/covers/lesson-318.webp
A	relics/gn-math/covers/lesson-319.webp
A	relics/gn-math/covers/lesson-32.webp
A	relics/gn-math/covers/lesson-320.webp
A	relics/gn-math/covers/lesson-321.webp
A	relics/gn-math/covers/lesson-322.webp
A	relics/gn-math/covers/lesson-323.webp
A	relics/gn-math/covers/lesson-324.webp
A	relics/gn-math/covers/lesson-325.webp
A	relics/gn-math/covers/lesson-326.webp
A	relics/gn-math/covers/lesson-327.webp
A	relics/gn-math/covers/lesson-328.webp
A	relics/gn-math/covers/lesson-329.webp
A	relics/gn-math/covers/lesson-33.webp
A	relics/gn-math/covers/lesson-330.webp
A	relics/gn-math/covers/lesson-331.webp
A	relics/gn-math/covers/lesson-333.webp
A	relics/gn-math/covers/lesson-334.webp
A	relics/gn-math/covers/lesson-335.webp
A	relics/gn-math/covers/lesson-336.webp
A	relics/gn-math/covers/lesson-337.webp
A	relics/gn-math/covers/lesson-338.webp
A	relics/gn-math/covers/lesson-339.webp
A	relics/gn-math/covers/lesson-34.webp
A	relics/gn-math/covers/lesson-340.webp
A	relics/gn-math/covers/lesson-341.webp
A	relics/gn-math/covers/lesson-342.webp
A	relics/gn-math/covers/lesson-343.webp
A	relics/gn-math/covers/lesson-344.webp
A	relics/gn-math/covers/lesson-345.webp
A	relics/gn-math/covers/lesson-346.webp
A	relics/gn-math/covers/lesson-347.webp
A	relics/gn-math/covers/lesson-348.webp
A	relics/gn-math/covers/lesson-349.webp
A	relics/gn-math/covers/lesson-350.webp
A	relics/gn-math/covers/lesson-351.webp
A	relics/gn-math/covers/lesson-352.webp
A	relics/gn-math/covers/lesson-353.webp
A	relics/gn-math/covers/lesson-354.webp
A	relics/gn-math/covers/lesson-355.webp
A	relics/gn-math/covers/lesson-356.webp
A	relics/gn-math/covers/lesson-357.webp
A	relics/gn-math/covers/lesson-358.webp
A	relics/gn-math/covers/lesson-359.webp
A	relics/gn-math/covers/lesson-36.webp
A	relics/gn-math/covers/lesson-360.webp
A	relics/gn-math/covers/lesson-361.webp
A	relics/gn-math/covers/lesson-362.webp
A	relics/gn-math/covers/lesson-363.webp
A	relics/gn-math/covers/lesson-364.webp
A	relics/gn-math/covers/lesson-365.webp
A	relics/gn-math/covers/lesson-366.webp
A	relics/gn-math/covers/lesson-367.webp
A	relics/gn-math/covers/lesson-368.webp
A	relics/gn-math/covers/lesson-369.webp
A	relics/gn-math/covers/lesson-37.webp
A	relics/gn-math/covers/lesson-370.webp
A	relics/gn-math/covers/lesson-371.webp
A	relics/gn-math/covers/lesson-372.webp
A	relics/gn-math/covers/lesson-373.webp
A	relics/gn-math/covers/lesson-374.webp
A	relics/gn-math/covers/lesson-375.webp
A	relics/gn-math/covers/lesson-376.webp
A	relics/gn-math/covers/lesson-377.webp
A	relics/gn-math/covers/lesson-378.webp
A	relics/gn-math/covers/lesson-379.webp
A	relics/gn-math/covers/lesson-38.webp
A	relics/gn-math/covers/lesson-380.webp
A	relics/gn-math/covers/lesson-381.webp
A	relics/gn-math/covers/lesson-382.webp
A	relics/gn-math/covers/lesson-383.webp
A	relics/gn-math/covers/lesson-384.webp
A	relics/gn-math/covers/lesson-385.webp
A	relics/gn-math/covers/lesson-386.webp
A	relics/gn-math/covers/lesson-387.webp
A	relics/gn-math/covers/lesson-388.webp
A	relics/gn-math/covers/lesson-389.webp
A	relics/gn-math/covers/lesson-39.webp
A	relics/gn-math/covers/lesson-390.webp
A	relics/gn-math/covers/lesson-391.webp
A	relics/gn-math/covers/lesson-392.webp
A	relics/gn-math/covers/lesson-393.webp
A	relics/gn-math/covers/lesson-394.webp
A	relics/gn-math/covers/lesson-395.webp
A	relics/gn-math/covers/lesson-396.webp
A	relics/gn-math/covers/lesson-397.webp
A	relics/gn-math/covers/lesson-398.webp
A	relics/gn-math/covers/lesson-399.webp
A	relics/gn-math/covers/lesson-4.webp
A	relics/gn-math/covers/lesson-40.webp
A	relics/gn-math/covers/lesson-400.webp
A	relics/gn-math/covers/lesson-401.webp
A	relics/gn-math/covers/lesson-402.webp
A	relics/gn-math/covers/lesson-403.webp
A	relics/gn-math/covers/lesson-404.webp
A	relics/gn-math/covers/lesson-405.webp
A	relics/gn-math/covers/lesson-406.webp
A	relics/gn-math/covers/lesson-407.webp
A	relics/gn-math/covers/lesson-408.webp
A	relics/gn-math/covers/lesson-409.webp
A	relics/gn-math/covers/lesson-41.webp
A	relics/gn-math/covers/lesson-410.webp
A	relics/gn-math/covers/lesson-411.webp
A	relics/gn-math/covers/lesson-413.webp
A	relics/gn-math/covers/lesson-414.webp
A	relics/gn-math/covers/lesson-415.webp
A	relics/gn-math/covers/lesson-416.webp
A	relics/gn-math/covers/lesson-417.webp
A	relics/gn-math/covers/lesson-418.webp
A	relics/gn-math/covers/lesson-419.webp
A	relics/gn-math/covers/lesson-420.webp
A	relics/gn-math/covers/lesson-421.webp
A	relics/gn-math/covers/lesson-422.webp
A	relics/gn-math/covers/lesson-423.webp
A	relics/gn-math/covers/lesson-426.webp
A	relics/gn-math/covers/lesson-427.webp
A	relics/gn-math/covers/lesson-428.webp
A	relics/gn-math/covers/lesson-429.webp
A	relics/gn-math/covers/lesson-43.webp
A	relics/gn-math/covers/lesson-430.webp
A	relics/gn-math/covers/lesson-432.webp
A	relics/gn-math/covers/lesson-433.webp
A	relics/gn-math/covers/lesson-434.webp
A	relics/gn-math/covers/lesson-435.webp
A	relics/gn-math/covers/lesson-436.webp
A	relics/gn-math/covers/lesson-437.webp
A	relics/gn-math/covers/lesson-438.webp
A	relics/gn-math/covers/lesson-439.webp
A	relics/gn-math/covers/lesson-44.webp
A	relics/gn-math/covers/lesson-440.webp
A	relics/gn-math/covers/lesson-441.webp
A	relics/gn-math/covers/lesson-442.webp
A	relics/gn-math/covers/lesson-443.webp
A	relics/gn-math/covers/lesson-444.webp
A	relics/gn-math/covers/lesson-445.webp
A	relics/gn-math/covers/lesson-446.webp
A	relics/gn-math/covers/lesson-447.webp
A	relics/gn-math/covers/lesson-448.webp
A	relics/gn-math/covers/lesson-449.webp
A	relics/gn-math/covers/lesson-45.webp
A	relics/gn-math/covers/lesson-450.webp
A	relics/gn-math/covers/lesson-451.webp
A	relics/gn-math/covers/lesson-452.webp
A	relics/gn-math/covers/lesson-453.webp
A	relics/gn-math/covers/lesson-454.webp
A	relics/gn-math/covers/lesson-455.webp
A	relics/gn-math/covers/lesson-456.webp
A	relics/gn-math/covers/lesson-457.webp
A	relics/gn-math/covers/lesson-458.webp
A	relics/gn-math/covers/lesson-459.webp
A	relics/gn-math/covers/lesson-46.webp
A	relics/gn-math/covers/lesson-460.webp
A	relics/gn-math/covers/lesson-461.webp
A	relics/gn-math/covers/lesson-462.webp
A	relics/gn-math/covers/lesson-463.webp
A	relics/gn-math/covers/lesson-464.webp
A	relics/gn-math/covers/lesson-465.webp
A	relics/gn-math/covers/lesson-466.webp
A	relics/gn-math/covers/lesson-467.webp
A	relics/gn-math/covers/lesson-468.webp
A	relics/gn-math/covers/lesson-469.webp
A	relics/gn-math/covers/lesson-47.webp
A	relics/gn-math/covers/lesson-470.webp
A	relics/gn-math/covers/lesson-471.webp
A	relics/gn-math/covers/lesson-472.webp
A	relics/gn-math/covers/lesson-473.webp
A	relics/gn-math/covers/lesson-474.webp
A	relics/gn-math/covers/lesson-475.webp
A	relics/gn-math/covers/lesson-476.webp
A	relics/gn-math/covers/lesson-477.webp
A	relics/gn-math/covers/lesson-478.webp
A	relics/gn-math/covers/lesson-479.webp
A	relics/gn-math/covers/lesson-48.webp
A	relics/gn-math/covers/lesson-480.webp
A	relics/gn-math/covers/lesson-481.webp
A	relics/gn-math/covers/lesson-482.webp
A	relics/gn-math/covers/lesson-483.webp
A	relics/gn-math/covers/lesson-484.webp
A	relics/gn-math/covers/lesson-485.webp
A	relics/gn-math/covers/lesson-486.webp
A	relics/gn-math/covers/lesson-487.webp
A	relics/gn-math/covers/lesson-488.webp
A	relics/gn-math/covers/lesson-489.webp
A	relics/gn-math/covers/lesson-49.webp
A	relics/gn-math/covers/lesson-490.webp
A	relics/gn-math/covers/lesson-491.webp
A	relics/gn-math/covers/lesson-492.webp
A	relics/gn-math/covers/lesson-493.webp
A	relics/gn-math/covers/lesson-494.webp
A	relics/gn-math/covers/lesson-495.webp
A	relics/gn-math/covers/lesson-496.webp
A	relics/gn-math/covers/lesson-497.webp
A	relics/gn-math/covers/lesson-498.webp
A	relics/gn-math/covers/lesson-499.webp
A	relics/gn-math/covers/lesson-5.webp
A	relics/gn-math/covers/lesson-50.webp
A	relics/gn-math/covers/lesson-500.webp
A	relics/gn-math/covers/lesson-501.webp
A	relics/gn-math/covers/lesson-502.webp
A	relics/gn-math/covers/lesson-503.webp
A	relics/gn-math/covers/lesson-504.webp
A	relics/gn-math/covers/lesson-505.webp
A	relics/gn-math/covers/lesson-506.webp
A	relics/gn-math/covers/lesson-507.webp
A	relics/gn-math/covers/lesson-508.webp
A	relics/gn-math/covers/lesson-509.webp
A	relics/gn-math/covers/lesson-51.webp
A	relics/gn-math/covers/lesson-510.webp
A	relics/gn-math/covers/lesson-511.webp
A	relics/gn-math/covers/lesson-512.webp
A	relics/gn-math/covers/lesson-513.webp
A	relics/gn-math/covers/lesson-514.webp
A	relics/gn-math/covers/lesson-515.webp
A	relics/gn-math/covers/lesson-516.webp
A	relics/gn-math/covers/lesson-517.webp
A	relics/gn-math/covers/lesson-518.webp
A	relics/gn-math/covers/lesson-519.webp
A	relics/gn-math/covers/lesson-52.webp
A	relics/gn-math/covers/lesson-520.webp
A	relics/gn-math/covers/lesson-521.webp
A	relics/gn-math/covers/lesson-522.webp
A	relics/gn-math/covers/lesson-523.webp
A	relics/gn-math/covers/lesson-524.webp
A	relics/gn-math/covers/lesson-525.webp
A	relics/gn-math/covers/lesson-526.webp
A	relics/gn-math/covers/lesson-527.webp
A	relics/gn-math/covers/lesson-528.webp
A	relics/gn-math/covers/lesson-529.webp
A	relics/gn-math/covers/lesson-53.webp
A	relics/gn-math/covers/lesson-530.webp
A	relics/gn-math/covers/lesson-531.webp
A	relics/gn-math/covers/lesson-532.webp
A	relics/gn-math/covers/lesson-533.webp
A	relics/gn-math/covers/lesson-534.webp
A	relics/gn-math/covers/lesson-535.webp
A	relics/gn-math/covers/lesson-536.webp
A	relics/gn-math/covers/lesson-537.webp
A	relics/gn-math/covers/lesson-538.webp
A	relics/gn-math/covers/lesson-539.webp
A	relics/gn-math/covers/lesson-54.webp
A	relics/gn-math/covers/lesson-540.webp
A	relics/gn-math/covers/lesson-541.webp
A	relics/gn-math/covers/lesson-542.webp
A	relics/gn-math/covers/lesson-543.webp
A	relics/gn-math/covers/lesson-544.webp
A	relics/gn-math/covers/lesson-545.webp
A	relics/gn-math/covers/lesson-546.webp
A	relics/gn-math/covers/lesson-547.webp
A	relics/gn-math/covers/lesson-548.webp
A	relics/gn-math/covers/lesson-549.webp
A	relics/gn-math/covers/lesson-55.webp
A	relics/gn-math/covers/lesson-550.webp
A	relics/gn-math/covers/lesson-551.webp
A	relics/gn-math/covers/lesson-552.webp
A	relics/gn-math/covers/lesson-553.webp
A	relics/gn-math/covers/lesson-554.webp
A	relics/gn-math/covers/lesson-555.webp
A	relics/gn-math/covers/lesson-556.webp
A	relics/gn-math/covers/lesson-557.webp
A	relics/gn-math/covers/lesson-558.webp
A	relics/gn-math/covers/lesson-559.webp
A	relics/gn-math/covers/lesson-56.webp
A	relics/gn-math/covers/lesson-560.webp
A	relics/gn-math/covers/lesson-561.webp
A	relics/gn-math/covers/lesson-562.webp
A	relics/gn-math/covers/lesson-563.webp
A	relics/gn-math/covers/lesson-564.webp
A	relics/gn-math/covers/lesson-565.webp
A	relics/gn-math/covers/lesson-567.webp
A	relics/gn-math/covers/lesson-568.webp
A	relics/gn-math/covers/lesson-569.webp
A	relics/gn-math/covers/lesson-570.webp
A	relics/gn-math/covers/lesson-571.webp
A	relics/gn-math/covers/lesson-572.webp
A	relics/gn-math/covers/lesson-573.webp
A	relics/gn-math/covers/lesson-574.webp
A	relics/gn-math/covers/lesson-575.webp
A	relics/gn-math/covers/lesson-576.webp
A	relics/gn-math/covers/lesson-577.webp
A	relics/gn-math/covers/lesson-578.webp
A	relics/gn-math/covers/lesson-579.webp
A	relics/gn-math/covers/lesson-58.webp
A	relics/gn-math/covers/lesson-580.webp
A	relics/gn-math/covers/lesson-581.webp
A	relics/gn-math/covers/lesson-582.webp
A	relics/gn-math/covers/lesson-583.webp
A	relics/gn-math/covers/lesson-584.webp
A	relics/gn-math/covers/lesson-585.webp
A	relics/gn-math/covers/lesson-586.webp
A	relics/gn-math/covers/lesson-587.webp
A	relics/gn-math/covers/lesson-588.webp
A	relics/gn-math/covers/lesson-589.webp
A	relics/gn-math/covers/lesson-59.webp
A	relics/gn-math/covers/lesson-590.webp
A	relics/gn-math/covers/lesson-591.webp
A	relics/gn-math/covers/lesson-592.webp
A	relics/gn-math/covers/lesson-593.webp
A	relics/gn-math/covers/lesson-594.webp
A	relics/gn-math/covers/lesson-595.webp
A	relics/gn-math/covers/lesson-596.webp
A	relics/gn-math/covers/lesson-597.webp
A	relics/gn-math/covers/lesson-598.webp
A	relics/gn-math/covers/lesson-599.webp
A	relics/gn-math/covers/lesson-6.webp
A	relics/gn-math/covers/lesson-60.webp
A	relics/gn-math/covers/lesson-600.webp
A	relics/gn-math/covers/lesson-601.webp
A	relics/gn-math/covers/lesson-602.webp
A	relics/gn-math/covers/lesson-603.webp
A	relics/gn-math/covers/lesson-604.webp
A	relics/gn-math/covers/lesson-605.webp
A	relics/gn-math/covers/lesson-606.webp
A	relics/gn-math/covers/lesson-607.webp
A	relics/gn-math/covers/lesson-608.webp
A	relics/gn-math/covers/lesson-609.webp
A	relics/gn-math/covers/lesson-61.webp
A	relics/gn-math/covers/lesson-610.webp
A	relics/gn-math/covers/lesson-611.webp
A	relics/gn-math/covers/lesson-612.webp
A	relics/gn-math/covers/lesson-613.webp
A	relics/gn-math/covers/lesson-614.webp
A	relics/gn-math/covers/lesson-615.webp
A	relics/gn-math/covers/lesson-616.webp
A	relics/gn-math/covers/lesson-617.webp
A	relics/gn-math/covers/lesson-618.webp
A	relics/gn-math/covers/lesson-619.webp
A	relics/gn-math/covers/lesson-62.webp
A	relics/gn-math/covers/lesson-620.webp
A	relics/gn-math/covers/lesson-621.webp
A	relics/gn-math/covers/lesson-622.webp
A	relics/gn-math/covers/lesson-623.webp
A	relics/gn-math/covers/lesson-624.webp
A	relics/gn-math/covers/lesson-625.webp
A	relics/gn-math/covers/lesson-626.webp
A	relics/gn-math/covers/lesson-627.webp
A	relics/gn-math/covers/lesson-628.webp
A	relics/gn-math/covers/lesson-629.webp
A	relics/gn-math/covers/lesson-63.webp
A	relics/gn-math/covers/lesson-630.webp
A	relics/gn-math/covers/lesson-631.webp
A	relics/gn-math/covers/lesson-632.webp
A	relics/gn-math/covers/lesson-633.webp
A	relics/gn-math/covers/lesson-634.webp
A	relics/gn-math/covers/lesson-635.webp
A	relics/gn-math/covers/lesson-636.webp
A	relics/gn-math/covers/lesson-637.webp
A	relics/gn-math/covers/lesson-638.webp
A	relics/gn-math/covers/lesson-639.webp
A	relics/gn-math/covers/lesson-64.webp
A	relics/gn-math/covers/lesson-640.webp
A	relics/gn-math/covers/lesson-641.webp
A	relics/gn-math/covers/lesson-642.webp
A	relics/gn-math/covers/lesson-643.webp
A	relics/gn-math/covers/lesson-644.webp
A	relics/gn-math/covers/lesson-645.webp
A	relics/gn-math/covers/lesson-646.webp
A	relics/gn-math/covers/lesson-647.webp
A	relics/gn-math/covers/lesson-648.webp
A	relics/gn-math/covers/lesson-649.webp
A	relics/gn-math/covers/lesson-65.webp
A	relics/gn-math/covers/lesson-650.webp
A	relics/gn-math/covers/lesson-651.webp
A	relics/gn-math/covers/lesson-653.webp
A	relics/gn-math/covers/lesson-654.webp
A	relics/gn-math/covers/lesson-656.webp
A	relics/gn-math/covers/lesson-657.webp
A	relics/gn-math/covers/lesson-658.webp
A	relics/gn-math/covers/lesson-659.webp
A	relics/gn-math/covers/lesson-66.webp
A	relics/gn-math/covers/lesson-660.webp
A	relics/gn-math/covers/lesson-661.webp
A	relics/gn-math/covers/lesson-662.webp
A	relics/gn-math/covers/lesson-663.webp
A	relics/gn-math/covers/lesson-664.webp
A	relics/gn-math/covers/lesson-665.webp
A	relics/gn-math/covers/lesson-666.webp
A	relics/gn-math/covers/lesson-667.webp
A	relics/gn-math/covers/lesson-668.webp
A	relics/gn-math/covers/lesson-669.webp
A	relics/gn-math/covers/lesson-67.webp
A	relics/gn-math/covers/lesson-670.webp
A	relics/gn-math/covers/lesson-671.webp
A	relics/gn-math/covers/lesson-672.webp
A	relics/gn-math/covers/lesson-673.webp
A	relics/gn-math/covers/lesson-674.webp
A	relics/gn-math/covers/lesson-675.webp
A	relics/gn-math/covers/lesson-676.webp
A	relics/gn-math/covers/lesson-677.webp
A	relics/gn-math/covers/lesson-678.webp
A	relics/gn-math/covers/lesson-679.webp
A	relics/gn-math/covers/lesson-68.webp
A	relics/gn-math/covers/lesson-680.webp
A	relics/gn-math/covers/lesson-681.webp
A	relics/gn-math/covers/lesson-682.webp
A	relics/gn-math/covers/lesson-683.webp
A	relics/gn-math/covers/lesson-684.webp
A	relics/gn-math/covers/lesson-685.webp
A	relics/gn-math/covers/lesson-686.webp
A	relics/gn-math/covers/lesson-687.webp
A	relics/gn-math/covers/lesson-688.webp
A	relics/gn-math/covers/lesson-689.webp
A	relics/gn-math/covers/lesson-69.webp
A	relics/gn-math/covers/lesson-690.webp
A	relics/gn-math/covers/lesson-691.webp
A	relics/gn-math/covers/lesson-692.webp
A	relics/gn-math/covers/lesson-693.webp
A	relics/gn-math/covers/lesson-694.webp
A	relics/gn-math/covers/lesson-695.webp
A	relics/gn-math/covers/lesson-696.webp
A	relics/gn-math/covers/lesson-697.webp
A	relics/gn-math/covers/lesson-698.webp
A	relics/gn-math/covers/lesson-699.webp
A	relics/gn-math/covers/lesson-7.webp
A	relics/gn-math/covers/lesson-70.webp
A	relics/gn-math/covers/lesson-700.webp
A	relics/gn-math/covers/lesson-701.webp
A	relics/gn-math/covers/lesson-702.webp
A	relics/gn-math/covers/lesson-703.webp
A	relics/gn-math/covers/lesson-704.webp
A	relics/gn-math/covers/lesson-705.webp
A	relics/gn-math/covers/lesson-706.webp
A	relics/gn-math/covers/lesson-707.webp
A	relics/gn-math/covers/lesson-708.webp
A	relics/gn-math/covers/lesson-709.webp
A	relics/gn-math/covers/lesson-71.webp
A	relics/gn-math/covers/lesson-710.webp
A	relics/gn-math/covers/lesson-711.webp
A	relics/gn-math/covers/lesson-712.webp
A	relics/gn-math/covers/lesson-713.webp
A	relics/gn-math/covers/lesson-714.webp
A	relics/gn-math/covers/lesson-715.webp
A	relics/gn-math/covers/lesson-716.webp
A	relics/gn-math/covers/lesson-717.webp
A	relics/gn-math/covers/lesson-718.webp
A	relics/gn-math/covers/lesson-719.webp
A	relics/gn-math/covers/lesson-72.webp
A	relics/gn-math/covers/lesson-720.webp
A	relics/gn-math/covers/lesson-721.webp
A	relics/gn-math/covers/lesson-722.webp
A	relics/gn-math/covers/lesson-723.webp
A	relics/gn-math/covers/lesson-724.webp
A	relics/gn-math/covers/lesson-725.webp
A	relics/gn-math/covers/lesson-726.webp
A	relics/gn-math/covers/lesson-727.webp
A	relics/gn-math/covers/lesson-728.webp
A	relics/gn-math/covers/lesson-729.webp
A	relics/gn-math/covers/lesson-73.webp
A	relics/gn-math/covers/lesson-730.webp
A	relics/gn-math/covers/lesson-731.webp
A	relics/gn-math/covers/lesson-732.webp
A	relics/gn-math/covers/lesson-733.webp
A	relics/gn-math/covers/lesson-734.webp
A	relics/gn-math/covers/lesson-735.webp
A	relics/gn-math/covers/lesson-736.webp
A	relics/gn-math/covers/lesson-737.webp
A	relics/gn-math/covers/lesson-738.webp
A	relics/gn-math/covers/lesson-739.webp
A	relics/gn-math/covers/lesson-74.webp
A	relics/gn-math/covers/lesson-740.webp
A	relics/gn-math/covers/lesson-741.webp
A	relics/gn-math/covers/lesson-742.webp
A	relics/gn-math/covers/lesson-743.webp
A	relics/gn-math/covers/lesson-744.webp
A	relics/gn-math/covers/lesson-745.webp
A	relics/gn-math/covers/lesson-746.webp
A	relics/gn-math/covers/lesson-747.webp
A	relics/gn-math/covers/lesson-748.webp
A	relics/gn-math/covers/lesson-749.webp
A	relics/gn-math/covers/lesson-75.webp
A	relics/gn-math/covers/lesson-750.webp
A	relics/gn-math/covers/lesson-751.webp
A	relics/gn-math/covers/lesson-752.webp
A	relics/gn-math/covers/lesson-753.webp
A	relics/gn-math/covers/lesson-754.webp
A	relics/gn-math/covers/lesson-755.webp
A	relics/gn-math/covers/lesson-756.webp
A	relics/gn-math/covers/lesson-757.webp
A	relics/gn-math/covers/lesson-758.webp
A	relics/gn-math/covers/lesson-759.webp
A	relics/gn-math/covers/lesson-76.webp
A	relics/gn-math/covers/lesson-760.webp
A	relics/gn-math/covers/lesson-761.webp
A	relics/gn-math/covers/lesson-762.webp
A	relics/gn-math/covers/lesson-763.webp
A	relics/gn-math/covers/lesson-764.webp
A	relics/gn-math/covers/lesson-765.webp
A	relics/gn-math/covers/lesson-766.webp
A	relics/gn-math/covers/lesson-767.webp
A	relics/gn-math/covers/lesson-768.webp
A	relics/gn-math/covers/lesson-769.webp
A	relics/gn-math/covers/lesson-77.webp
A	relics/gn-math/covers/lesson-770.webp
A	relics/gn-math/covers/lesson-771.webp
A	relics/gn-math/covers/lesson-772.webp
A	relics/gn-math/covers/lesson-773.webp
A	relics/gn-math/covers/lesson-774.webp
A	relics/gn-math/covers/lesson-775.webp
A	relics/gn-math/covers/lesson-776.webp
A	relics/gn-math/covers/lesson-777.webp
A	relics/gn-math/covers/lesson-778.webp
A	relics/gn-math/covers/lesson-779.webp
A	relics/gn-math/covers/lesson-78.webp
A	relics/gn-math/covers/lesson-780.webp
A	relics/gn-math/covers/lesson-781.webp
A	relics/gn-math/covers/lesson-782.webp
A	relics/gn-math/covers/lesson-783.webp
A	relics/gn-math/covers/lesson-784.webp
A	relics/gn-math/covers/lesson-785.webp
A	relics/gn-math/covers/lesson-786.webp
A	relics/gn-math/covers/lesson-787.webp
A	relics/gn-math/covers/lesson-788.webp
A	relics/gn-math/covers/lesson-789.webp
A	relics/gn-math/covers/lesson-79.webp
A	relics/gn-math/covers/lesson-790.webp
A	relics/gn-math/covers/lesson-791.webp
A	relics/gn-math/covers/lesson-792.webp
A	relics/gn-math/covers/lesson-793.webp
A	relics/gn-math/covers/lesson-794.webp
A	relics/gn-math/covers/lesson-795.webp
A	relics/gn-math/covers/lesson-796.webp
A	relics/gn-math/covers/lesson-797.webp
A	relics/gn-math/covers/lesson-798.webp
A	relics/gn-math/covers/lesson-799.webp
A	relics/gn-math/covers/lesson-8.webp
A	relics/gn-math/covers/lesson-80.webp
A	relics/gn-math/covers/lesson-800.webp
A	relics/gn-math/covers/lesson-801.webp
A	relics/gn-math/covers/lesson-802.webp
A	relics/gn-math/covers/lesson-803.webp
A	relics/gn-math/covers/lesson-804.webp
A	relics/gn-math/covers/lesson-805.webp
A	relics/gn-math/covers/lesson-806.webp
A	relics/gn-math/covers/lesson-807.webp
A	relics/gn-math/covers/lesson-808.webp
A	relics/gn-math/covers/lesson-809.webp
A	relics/gn-math/covers/lesson-81.webp
A	relics/gn-math/covers/lesson-810.webp
A	relics/gn-math/covers/lesson-811.webp
A	relics/gn-math/covers/lesson-812.webp
A	relics/gn-math/covers/lesson-813.webp
A	relics/gn-math/covers/lesson-814.webp
A	relics/gn-math/covers/lesson-815.webp
A	relics/gn-math/covers/lesson-816.webp
A	relics/gn-math/covers/lesson-817.webp
A	relics/gn-math/covers/lesson-818.webp
A	relics/gn-math/covers/lesson-819.webp
A	relics/gn-math/covers/lesson-82.webp
A	relics/gn-math/covers/lesson-820.webp
A	relics/gn-math/covers/lesson-821.webp
A	relics/gn-math/covers/lesson-822.webp
A	relics/gn-math/covers/lesson-823.webp
A	relics/gn-math/covers/lesson-824.webp
A	relics/gn-math/covers/lesson-825.webp
A	relics/gn-math/covers/lesson-826.webp
A	relics/gn-math/covers/lesson-827.webp
A	relics/gn-math/covers/lesson-828.webp
A	relics/gn-math/covers/lesson-829.webp
A	relics/gn-math/covers/lesson-83.webp
A	relics/gn-math/covers/lesson-830.webp
A	relics/gn-math/covers/lesson-831.webp
A	relics/gn-math/covers/lesson-832.webp
A	relics/gn-math/covers/lesson-833.webp
A	relics/gn-math/covers/lesson-834.webp
A	relics/gn-math/covers/lesson-835.webp
A	relics/gn-math/covers/lesson-836.webp
A	relics/gn-math/covers/lesson-837.webp
A	relics/gn-math/covers/lesson-838.webp
A	relics/gn-math/covers/lesson-839.webp
A	relics/gn-math/covers/lesson-84.webp
A	relics/gn-math/covers/lesson-840.webp
A	relics/gn-math/covers/lesson-841.webp
A	relics/gn-math/covers/lesson-842.webp
A	relics/gn-math/covers/lesson-843.webp
A	relics/gn-math/covers/lesson-844.webp
A	relics/gn-math/covers/lesson-845.webp
A	relics/gn-math/covers/lesson-846.webp
A	relics/gn-math/covers/lesson-847.webp
A	relics/gn-math/covers/lesson-848.webp
A	relics/gn-math/covers/lesson-849.webp
A	relics/gn-math/covers/lesson-85.webp
A	relics/gn-math/covers/lesson-850.webp
A	relics/gn-math/covers/lesson-851.webp
A	relics/gn-math/covers/lesson-852.webp
A	relics/gn-math/covers/lesson-853.webp
A	relics/gn-math/covers/lesson-854.webp
A	relics/gn-math/covers/lesson-855.webp
A	relics/gn-math/covers/lesson-856.webp
A	relics/gn-math/covers/lesson-857.webp
A	relics/gn-math/covers/lesson-858.webp
A	relics/gn-math/covers/lesson-859.webp
A	relics/gn-math/covers/lesson-86.webp
A	relics/gn-math/covers/lesson-860.webp
A	relics/gn-math/covers/lesson-861.webp
A	relics/gn-math/covers/lesson-862.webp
A	relics/gn-math/covers/lesson-863.webp
A	relics/gn-math/covers/lesson-864.webp
A	relics/gn-math/covers/lesson-865.webp
A	relics/gn-math/covers/lesson-866.webp
A	relics/gn-math/covers/lesson-867.webp
A	relics/gn-math/covers/lesson-868.webp
A	relics/gn-math/covers/lesson-87.webp
A	relics/gn-math/covers/lesson-88.webp
A	relics/gn-math/covers/lesson-89.webp
A	relics/gn-math/covers/lesson-9.webp
A	relics/gn-math/covers/lesson-90.webp
A	relics/gn-math/covers/lesson-91.webp
A	relics/gn-math/covers/lesson-92.webp
A	relics/gn-math/covers/lesson-93.webp
A	relics/gn-math/covers/lesson-94.webp
A	relics/gn-math/covers/lesson-95.webp
A	relics/gn-math/covers/lesson-96.webp
A	relics/gn-math/covers/lesson-97.webp
A	relics/gn-math/covers/lesson-98.webp
A	relics/gn-math/covers/lesson-99.webp
M	relics/gn-math/games.json
M	relics/gn-math/play.html
M	relics/profile/decorations/catalog.json
R100	relics/profile/decorations/infernal-ring-still.png	relics/profile/decorations/scholar-ring-still.png
R100	relics/profile/decorations/infernal-ring.png	relics/profile/decorations/scholar-ring.png
M	relics/profile/effects/catalog.json
M	relics/ugs/C/clcookieclicker.txt
R100	relics/ugs/L/cllegobatman2superheroes.html	relics/ugs/L/lesson-001.html
R100	relics/ugs/P/clpheonixtrialsandyeartrhfasd.html	relics/ugs/P/lesson-002.html
R100	relics/ugs/R/clrhythmheaven.html	relics/ugs/R/lesson-003.html
R100	relics/ugs/R/clrhythymymheaven.html	relics/ugs/R/lesson-004.html
R100	relics/ugs/S/clsubwaysurferswinterholiday.html	relics/ugs/S/lesson-005.html
R100	relics/ugs/S/clsuperhot.html	relics/ugs/S/lesson-006.html
R100	relics/ugs/S/clsuperhotlinemiami.html	relics/ugs/S/lesson-007.html
R100	relics/ugs/S/clsuperhouseofdeadninjas.html	relics/ugs/S/lesson-008.html
R100	relics/ugs/T/clturokdinosaurhunter.html	relics/ugs/T/lesson-009.html
R100	relics/ugs/Y/clyouvs100skibidi.html	relics/ugs/Y/lesson-010.html
M	relics/ugs/games.json
M	relics/ugs/index.html
A	rituals/audit-code.mjs
M	rituals/audit-release.mjs
M	rituals/build-lesson-assets.mjs
A	rituals/build-lesson-runtime.mjs
M	rituals/build-vps.mjs
A	rituals/lesson-compiler-entry.mjs
A	rituals/prepare-offline-document.mjs
M	rituals/sync-gn-math.mjs
M	rituals/test-account-controls.mjs
A	rituals/test-catalog-documents.mjs
M	rituals/test-chat-voice-relay.mjs
M	rituals/test-code-studio.mjs
M	rituals/test-dependency-purge.mjs
M	rituals/test-lesson-assets.mjs
A	rituals/test-lesson-runtime-browser.mjs
M	rituals/test-lessons-built.mjs
M	rituals/test-nyxify-native-player.mjs
M	rituals/test-nyxtube-backend.mjs
A	rituals/test-release-repairs.mjs
M	rituals/test-static-publisher-workspace.mjs
M	rituals/test-theme-restoration.mjs
A	scripture/catalog-documents.mjs
A	scripture/lesson-compiler.mjs
M	scripture/nyxtube-streaming.mjs
M	scrolls/DEPLOYMENT_STATUS.md
M	scrolls/NYXTUBE_BACKEND.md
A	scrolls/RELEASE_REPAIRS.md
A	scrolls/release-evidence.json
M	shepherd.js
M	vestments.css
M	vestments/avatar-decorations.css
M	vestments/theme-tints.css
A	connection/session.test.mjs
```

## DEPENDENCIES REMOVED

None additionally removed in this repair; no dependencies were added. The earlier
purge was rechecked for the manifest, lockfile and installed tree, including:

- @mercuryworkshop/bare-mux
- @mercuryworkshop/epoxy-tls
- @mercuryworkshop/epoxy-transport
- @mercuryworkshop/libcurl-transport
- @mercuryworkshop/proxy-transports
- @mercuryworkshop/scramjet
- @mercuryworkshop/scramjet-controller
- libcurl.js
- wispurr
