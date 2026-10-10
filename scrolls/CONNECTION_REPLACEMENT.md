# Connection replacement status

## Compatibility boundary

The user selected preserving external-site compatibility while replacing components in stages. This release implements the first stage. It does not claim that the complete dependency purge or whole-release identifier scrub has finished.

The established engine remains the default. `NYX_SYNC_ENABLED=1` exposes an optional setting on the local server. Users must also explicitly enable that setting and reopen the application. Production does not enable it. Existing saved connection settings, accounts, sessions and game data are retained.

## New implementation

- `relics/network/frames.mjs`: `pack`, `unpack` and shared limits. Binary messages contain a big-endian 32-bit length, metadata length, UTF-8 JSON metadata and optional binary body. No application version handshake or vendor handshake is sent. The standard WebSocket HTTP upgrade still occurs.
- `relics/network/transport.mjs`: `Transport` exposes `init`, `request`, `connect` and `close`. `activated`, `delay`, `readBody` and `abortable` implement trusted interaction gating, a randomized 2–5 second startup delay, bounded uploads and cancellation. This standalone transport does not implement live remote sockets yet.
- `relics/network/adapter.mjs`: `Adapter` preserves the established interface. Eligible GET/HEAD requests use the new path; uploads, other methods, ranged/media requests, event streams and live sockets use the established implementation. A failed trial read falls back once and disables the trial for that adapter. Writes are never replayed through both paths.
- `scripture/network/server.mjs`: `createServer`, `exchange`, `destination`, `publicAddress` and `requestHeaders` implement `/api/sync`, same-host origin checks, the existing IP-ban policy, public-address validation, pinned DNS results, header validation, TLS, decompression, duplicate response headers, cancellation and bounded concurrency/memory. The client does not receive server credentials. The server is opt-in.

Responses are currently buffered with a 32 MiB cap and uploads have an 8 MiB cap. Media and streaming continue using the established connection. Removing that connection requires implementing and testing streaming, live sockets and the remaining engine responsibilities first.

## Integration and validation files

- `gospel.js`: optional trial setting and adapter construction; the previous transport preference and interface remain unchanged.
- `shepherd.js`: optional runtime capability and route, plus shutdown cleanup.
- `package.json`: `test:network` and `check:release-audit` commands. No dependencies were removed, renamed, upgraded or reinstalled for this stage; the lockfile remains valid.
- `rituals/test-network-adapter.mjs`: real browser and local HTTP/socket fixtures cover framing, malformed messages, address checks, DNS pinning, no initial connection, activation delay, binary bodies, cookies, redirects, compressed responses, cancellation, origin rejection and compatibility routing.
- `rituals/test-http-relay-workspace.mjs`: source-layout correction, headless option and trial-response verification through the actual page loader. Both new-path navigation and existing HTTP-bridge navigation with native WebSockets unavailable were verified.
- `rituals/audit-release.mjs`: repeatable artifact inventory, decoded JavaScript literals, paths, WASM strings, source maps, parse failures and native call sites. It exits nonzero on violations and does not silently approve remaining names. Counts are syntactic call sites, including duplicated artifacts; alias-based dynamic calls cannot be proven absent by this audit.
- `rituals/check-retired-engine.mjs`: explicitly classifies the audit's signature definitions as scanner code, just like its own definitions. No application exception was added.
- `.github/workflows/network.yml`: adapter tests and strict naming/native-call checks for replacement directories. Whole-release enforcement is pending replacement of the remaining engine and bundled code. Repository branch-protection settings were not changed.

No existing functions were renamed in this transport stage. The four replacement modules have zero matched signatures, source maps, `atob`, `eval` or `Function` calls. The broader snapshot inventory still reports 159 `atob`, 188 `eval`, 96 `Function` call sites, 4,617 raw/decoded signature matches, 69 matching paths and 38 JavaScript parse failures across the prior 3,773-file build. Raw and decoded matches can overlap; these are findings, not a clean audit. Regenerate the report for each complete release with `node rituals/audit-release.mjs dist .codex-artifacts/release-inventory.json`.

The existing Scramjet/controller, BareMux, Epoxy, Libcurl and Wisp-related dependencies, external protocol contracts, license notices and data migrations remain. They must not be deleted while this adapter still relies on them. Browser API names and mandatory attribution also cannot be replaced indiscriminately. A custom transport does not replace document/script rewriting, cookies, navigation, workers or site compatibility.

## Other Nyx changes in this release

- `study.html`, `gospel.js`, `parables/loading-screen.js`, `rituals/build-frontend-assets.mjs`, `rituals/check-deploy.mjs`: removed the obsolete startup wizard/progress screen and DeltaMath defaults. Old identity recognition remains for migration; custom titles/icons are preserved. Terms consent remains.
- `parables/display-names.js`, `rituals/test-display-labels.mjs`: original library names render with Unicode letterforms in visible labels; URLs, code, input values and accessible names stay intact.
- `parables/pwa-install.js`: prevents a MutationObserver feedback loop between the install widget and display formatter.
- `rituals/build-game-strings.mjs`, `rituals/build-workspace-scramble.mjs`, `rituals/test-game-obfuscation.mjs`: deterministic game string pools and private identifier mangling with parser/runtime regressions, including compact return statements. Serialized helper functions and static rebasing retain their behavior.
- `rituals/test-entry-cover.mjs`, `rituals/test-no-welcome.mjs`, `rituals/test-startup-keyboard-permission.mjs`, `rituals/test-game-cloud-save.mjs`, `rituals/test-games-built.mjs`, `rituals/test-static-publisher-workspace.mjs`: updated identity/startup checks, built asset support and Unicode-aware display assertions.

The independent projects and uncommitted Nook desktop work are excluded. Production advertising stays disabled. No UV engine is reintroduced.

Local verification: VPS build and check:deploy pass. Actual built-engine navigation returns a successful framed response from the trial transport; the original HTTP bridge also passes with native WebSockets disabled. Desktop/mobile startup, identity migration, retained settings, keyboard-permission behavior, catalog/player controls and the nested static publisher package pass. Game saved-data, HTML loading and cloud-save regressions also passed during preparation. Localhost8080 serves the latest source with the trial available but unselected. The new CI workflow has not yet run on GitHub at this point.
