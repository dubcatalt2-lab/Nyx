# Nook Agent 0.1.0 Windows release

The Windows x64 NSIS installer was built, installed, started, uninstalled and reinstalled on Windows. The installed executable passed isolated-renderer startup, native approval, real project editing and undo, PowerShell execution, command denial and permission revocation checks. The installer creates a Start Menu entry and includes its runtime. ARM64 was cross-built but not executed on ARM hardware.

The runtime tests cover filesystem traversal, junction and hard-link rejection, concurrent-edit conflicts, permission expiration and revocation, real PowerShell/CMD execution, process cancellation, a simulated model's multi-step task with actual file changes, and the fixed HTTPS provider contract. Windows UI Automation was exercised against a dedicated WPF fixture, including verified text changes and button invocation. No paid model inference or live administrator command was executed in release testing.

The installers are unsigned. No code-signing certificate was available. The download page discloses this and publishes SHA-256 checksums. Production dependency audit reports zero findings; the build-tool dependency audit has eight moderate findings in electron-builder's transitive dependency tree. The Windows workflow builds both architectures and retains installer artifacts. Its hosted execution has not been verified by this local release.

The release backend advertises downloads only when the manifest and actual installer files validate. Installers reside outside the application checkout under /var/lib/nyx/nook-desktop. Publish files and verify checksums before activating release.json. Website regression tests cover desktop/mobile downloads, unavailable artifacts, attachment responses and path validation.

Nook now includes anthropic/claude-haiku-5.5 in its ordinary account token pool, including account API keys. Targeted tests cover catalog and inference-policy parity, pool exhaustion, no separate model allowance and continued enforcement for other restricted models. Nook's dictation and voice-conversation buttons are removed. The shared Drop embed retains its existing controls.

Version 0.1 is a working Windows desktop foundation, not the entire platform roadmap. Advanced browser automation, cloud task synchronization, schedules, MCP/OAuth integrations, plugins, subagents and macOS/Linux installers remain unimplemented. See NOOK_DESKTOP_ARCHITECTURE.md and nook-desktop/README.md for boundaries and permission details.
