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
