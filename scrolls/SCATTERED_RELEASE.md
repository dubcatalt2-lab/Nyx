# Scattered frontend release

The VPS build permutes hoisted function declarations within their existing lexical scope, mangles private identifiers, compacts first-party JavaScript, and publishes 108 frontend scripts beneath deterministic opaque two-level directories. This includes the workspace/search shell, activity loader and AI workspace. Seeded paths are stable between equivalent builds.

Modules move as units. Functions that share closures stay together; imports, exports, initialization order and external browser/API contracts are preserved. Module-relative imports and importScripts paths follow the new location. Document-relative fetch and element URLs retain their original base. import.meta.url resource resolution retains the original logical module URL.

Previous script aliases remain available for open pages. New documents use the scattered paths. The static publisher includes the same paths. Existing runtime/worker/WASM naming, storage migration, account authorization, provider policies and advertising configuration are unchanged. Dependencies, WASM binaries and server source are not split into arbitrary function files. Source stays maintainable and remains readable in the public repository; this is reverse-engineering friction, not secrecy or an access-control boundary.

Build-time validation parses every scattered script, checks local import destinations, requires workspace/games/AI coverage and checks previous aliases. Additional checks: test-frontend-references.mjs, test-workspace-scramble.mjs, test-activity-layout.mjs, test-ai-workspace.mjs and built intercession worker recovery.
