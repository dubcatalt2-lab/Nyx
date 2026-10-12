# Active release - 2026-10-12 UTC

Search follow-up: the separate HTTPS document service now runs the script-processing/cache and startup-message fixes from `fd5bfc03`. Public main includes these changes and localhost:8080 serves their audited build. Main static production remains the release described below. Final observed rendering was 5,544 ms cold / 2,632 ms repeat versus 11,696 ms before; provider verification still prevents claiming real search results. See [SEARCH_LOADING_REPAIR.md](SEARCH_LOADING_REPAIR.md) for evidence and remaining limits.

Runtime 59a1b70d15c4d971d7041256ae9e8be2d628febd is deployed to the main VPS application. Public main is reconciled, the HTTPS document service is active, and localhost:8080 serves the verified build. GitHub CI and Windows/Linux release audits pass: 5,220 files, 452 classified raw matches, zero blocked findings/source maps; native calls atob 0, eval 2, Function 2.

GN Math launch paths and 835 local covers are repaired. Clicked sign-in windows and callbacks pass Chrome/Edge tests; live TikTok opens Google sign-in inside Nyx. Complete third-party account login and all-game gameplay are not claimed. Five covers still use remote fallbacks. See RELEASE_REPAIRS.md for full raw evidence and limitations. Rollback code, dependency tree and private environment are retained on the VPS.

Everything below is historical.

---

# Current verification candidate ? 2026-10-12 UTC

The full code-aware release audit passes: 5,220 files; atob 0, eval 2, Function 2; 452 raw matches reviewed; zero blocked findings, paths, parse errors or source maps. GN Math catalog/cover repairs, nested login-popup/session fixes, private cookie persistence and current UI regression tests pass. The isolated HTTPS document service is active; the main production application and public main are still pending. See RELEASE_REPAIRS.md for raw outputs and explicit compatibility limits. The user-provided YouTube session was renewed privately. Earlier status below is historical.

# Release repairs — 2026-10-11; still blocked

Code-aware audit now retains all raw findings and per-match hash-bound reviews. Botany/theme restoration, twelve asset-path changes, saved-decoration normalization, explicit game callback registries/property accessors and the shared compiler are implemented locally. Browser games remain minified/obfuscated, with stable line endings; no streaming. Built compiler, console and media routes are verified.

Final distribution audit: 3550 files; atob 0, eval 2, Function 2; 450 raw findings, 450 reviewed, 0 unclassified; 0 flagged paths, 0 parse failures; **1 source-map reference remains inside a compressed signed game program**. The gate correctly FAILS. Do not deploy or describe the release as complete. Hosted document origin/isolation and comprehensive game compatibility remain open. Public main and production are unchanged.

See RELEASE_REPAIRS.md for scoped changes, raw outputs and limits, and NYXTUBE_BACKEND.md for renewing the server's YouTube cookie session. The real cookie session was not replaced. Unrelated Nook/cloud changes are preserved.

# Current follow-up ? 2026-10-11

Browser games retained at the user's request; remote streaming is not enabled. The new bundled-game build pass processes 1,586 files / 2,412 scripts with zero failures and reduces 169,222,971 bytes to 161,787,238 bytes. Chrome/Edge game and fixture interactions, generated-build checks, desktop/mobile catalog controls, and the narrow deployment check pass. See LESSON_DELIVERY_VERIFICATION.md for raw output and limits.

Full release remains blocked: atob 0, eval 13, Function 15, signatures 656, paths 12, parse errors 0, source maps 0. HTTPS hosting and isolation work remain open. No production update. Historical status follows.

# Deployment status ? 2026-10-11

The original document service, dependency removals, browser repairs, loading optimization and lesson-test naming are prepared on `agent/nyx-page-wording-20261008`. This branch is not a production release.

## Verified locally

The original service audit passes with zero prohibited signatures, flagged paths, atob, eval and native Function calls. Sixteen unit checks, static/CSS/JavaScript browser smoke tests, Chrome/Edge worker replacement, desktop/mobile shell navigation, catalog functionality, built catalog navigation and storage checks pass. The narrow deployment check also passes. Raw evidence is in LOADING_VERIFICATION.md.

## Release blockers

The full output audit was rerun before publication and failed:

```json
{"passed":false,"files":3548,"counts":{"atob":0,"eval":24,"Function":25},"signatureMatches":664,"pathMatches":12,"parseErrors":0,"unreadable":0,"sourceMaps":0}
```

Remaining native calls are in bundled game documents, Balatro assets and Eruda (including copies in the static publisher package). Signature matches also include embedded game clients, theme names and stylesheet selectors. Flagged paths include profile decoration names and several catalog filenames. Replacing or renaming these must preserve the relevant runtime behavior and asset references; suppressing the audit is not a fix.

Hosted `DOCUMENT_ORIGIN` and the corresponding separate HTTPS document service are not configured by this change. The production integration and earlier remote-origin isolation limitations in connection/README.md still need resolution. Local port 8082 is not an externally deployable origin for production users.

Production and public main remain at the earlier redirect-only release. Do not activate this branch's output while these blockers remain. No release-audit exception or legacy-engine fallback was added.
