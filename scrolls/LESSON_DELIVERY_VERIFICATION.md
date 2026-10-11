# Browser game delivery ? 2026-10-11

## COMPLETED

- User chose browser games with minification and obfuscation instead of remote streaming. No streaming service was added or enabled. Build work runs locally; clients execute the delivered games.
- Added an explicit build pass for bundled documents and the bundled Balatro runtime: compact deterministic local identifiers, whitespace minification, retained public names/properties/function names and licenses, no source maps. No runtime decoder, artificial startup delay or extra server request was added.
- Preserved inline event handlers, shared globals, module exports, data scripts and direct-evaluation bindings. Invalid source fails the build. The content-addressed cache includes the transform revision and invalidates when input changes.
- Compiled 18 known literal expressions/global-object factories ahead of time. Genuinely dynamic code remains reported by the mandatory audit. No removed engine was restored or wrapped.
- Added Chromium CI coverage and local Chrome/Edge interaction tests. A real bundled game was also tested from the generated build.
- Archived four historical verification reports verbatim under the ignored local historical-verification directory; removed duplicate signature listings from source documentation and normalized local stack-trace paths. Application audit rules are unchanged.

## INCOMPLETE

- Production deployment remains blocked by the full release audit below. This is not completion of the entire refactor.
- Existing HTTPS document-service configuration and remote-origin isolation work remain open.
- Third-party remotely hosted game code is outside this build's control. Browser-delivered code remains inspectable; this is obfuscation, not source confidentiality.
- The complete catalog was parsed and transformed, but gameplay for every externally dependent title was not tested. Browser checks cover the listed controls and one bundled title, not all game levels or provider services.
- A whole-release before/after byte total was not recorded. The exact byte comparison below covers the transformed game assets only.
- No assertion that all removed-package source is absent in every embedded payload is made: the dependency tree is clean, but the strict scan still reports legacy references including assets/ugs/B/clbasketbros.html and other embedded documents. Full cleanup is still required.

## VERIFICATION OUTPUT

Full build: exit 1. Raw mandatory static/AST audit output:

```json
{
  "passed": false,
  "files": 3548,
  "counts": {
    "atob": 0,
    "eval": 13,
    "Function": 15
  },
  "nonGlobalFunctionMethods": 2,
  "signatureMatches": 656,
  "pathMatches": 12,
  "parseErrors": 0,
  "unreadable": 0,
  "sourceMaps": 0,
  "report": null
}
```

Raw game-pass output (the complete per-file size list is in the ignored local .codex-artifacts/lesson-build-report.json):

```text
Lesson delivery: {"files":1586,"scripts":2412,"beforeBytes":169222971,"afterBytes":161787238,"cached":0,"failures":[]}
```

Before/after scope: 1586 game assets, 169222971 -> 161787238 bytes; 4.39% smaller. This is a transfer-size comparison, not an upstream latency measurement.

Raw successful test output; the invalid-source fixture deliberately checks rejection:

```text
PASS static execution: lexical values, Module initialization, global discovery, feature probe and shadowed bindings; genuinely dynamic code left unchanged
PASS binary decoding: padded/unpadded data, ASCII whitespace, invalid input and 50 KB payload; AST replacement preserves unrelated methods
PASS lesson build cache: identical input reused, changed input rebuilt, invalid source blocks the build
PASS chrome: inline callbacks, cross-script globals, keyboard, canvas, animation and saved state after reload
PASS chrome: bundled Evil Glitch renders after click and keyboard interaction without page errors
PASS msedge: inline callbacks, cross-script globals, keyboard, canvas, animation and saved state after reload
PASS msedge: bundled Evil Glitch renders after click and keyboard interaction without page errors
PASS lesson assets: deterministic identifier obfuscation, minification, modules, eval bindings, names, license retention, source-map removal and syntax failure
PASS lesson build cache: identical input reused, changed input rebuilt, invalid source blocks the build
PASS chrome: inline callbacks, cross-script globals, keyboard, canvas, animation and saved state after reload
PASS chrome: bundled Evil Glitch renders after click and keyboard interaction without page errors
PASS msedge: inline callbacks, cross-script globals, keyboard, canvas, animation and saved state after reload
PASS msedge: bundled Evil Glitch renders after click and keyboard interaction without page errors
PASS lesson assets: deterministic identifier obfuscation, minification, modules, eval bindings, names, license retention, source-map removal and syntax failure
PASS Games back label/open/close 1365 /assets/games/
PASS Games back label/open/close 1365 /apps/drop/games.html
PASS Games back label/open/close 390 /assets/games/
PASS Games back label/open/close 390 /apps/drop/games.html
Built arcade loads the real JSON manifest and both bundled game catalogs.
PASS retired-engine audit: 3113 files, 71 decoded payloads, 433 media/archive files classified separately, 0 prohibited matches
Deployment check passed (302 required files found).
Nyx branding check passed (3121 tracked files checked).
```

The earlier source deployment check failed on historical quoted identifiers and local machine paths in documentation. The original reports are preserved locally; the rerun above passes. The separate complete release audit still fails and still blocks deployment. No live server was updated.

The existing static/CSS/fetch document smoke tests were not rerun for this game-build-only change; their previous results are recorded separately. No new all-site compatibility claim is made.

## FILES CHANGED

- .github/workflows/network.yml
- package.json
- rituals/build-lesson-assets.mjs
- rituals/build-native-values.mjs
- rituals/build-vps.mjs
- rituals/test-lesson-assets.mjs
- rituals/test-static-execution.mjs
- scrolls/DEPLOYMENT_STATUS.md
- scrolls/LESSON_DELIVERY_VERIFICATION.md
- scrolls/DUCKDUCKGO_RESULTS_VERIFICATION.md
- scrolls/SEARCH_AND_UI_VERIFICATION.md
- scrolls/REPLACEMENT_VERIFICATION.md
- scrolls/LOADING_VERIFICATION.md

Added functions: compactLessonScript, compactLessonDocument, buildLessonAssets, replaceStaticCalls. Existing buildNativeValues and replaceBinaryCalls now also handle provably static expressions; no public runtime functions were renamed. The 1,586 generated asset paths and exact sizes are listed in the local build report, not edited directly.

## DEPENDENCIES REMOVED

None in this follow-up. No obfuscation dependency was added. Existing manifest/lockfile/installed-tree checks pass with the previously removed dependencies absent. The broader final-build absence assertion remains unverified for embedded third-party payloads as stated above.
