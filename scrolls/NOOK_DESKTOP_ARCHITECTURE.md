# Nook Agent: Windows release

## Existing system

Nook is a vanilla HTML/CSS/JavaScript app in chapels/agents, served at nook.nyxlearning.org by the shared Express shepherd.js service. Firebase Authentication and Firestore implement accounts, policy and usage accounting. Chat supports streaming, images, voice, locally saved conversations and projects. The authenticated /api/v1/models and /api/v1/ai endpoints accept revocable Nook account keys and enforce the existing account model catalog and token pool. Provider credentials remain on the server.

The deacon companion is a Node source ZIP, not an installer. Its loopback HTTP interface uses an origin-bound session token, prompts before edits/commands and maintains temporary undo copies. The launcher's FolderWorkspaceDialog reference is invalid. This release leaves the existing web flows intact and introduces a separately packaged desktop runtime.

## Windows-first architecture

Electron supplies a bundled Chromium/Node runtime and an NSIS per-user installer. The local renderer has sandboxing, context isolation, no Node integration and a narrow preload interface. IPC accepts only the application's exact local top-level document. Remote Nook pages open in a separate sandboxed window with no preload or local capability bridge. There is no public or loopback terminal endpoint.

Trusted main-process modules own folder selection, permissions, provider requests, secret storage, execution and audit records. Account keys use Electron safeStorage (Windows DPAPI); no key is returned to the renderer after saving. Requests target only the fixed HTTPS Nook origin, disallow redirects and retain server model/account enforcement. Users create an account key in the existing web interface; password handling is not duplicated.

The local engine uses the existing JSON-action approach because Nook's API does not accept native tool-call payloads. Each response is schema checked; tool observations are sent as untrusted data. Steps, response size, context, elapsed time and command output are bounded. Pause occurs between steps; Stop aborts inference and terminates ordinary child process trees. Restarted tasks are marked interrupted, never silently resumed.

Filesystem tools use an explicitly selected project root, deny traversal, alternate data streams, links and credential files, require expected content hashes, revalidate after approval, and keep recoverable backups. Arbitrary approved commands are not a filesystem sandbox: each prompt explicitly discloses current-user system access. No tool can raise the selected permission level. Administrator commands require a distinct approval and Windows UAC for each action; elevated processes cannot be reliably terminated by a non-elevated app.

Windows UI Automation uses a bundled PowerShell helper loading Microsoft's UIAutomation assemblies. Controls are addressed within an approved process; protected/password fields are excluded. No security-desktop automation or password entry is provided. Application control is visible and individually approved.

## Implementation order

1. Package and test a real x64 installer with local UI, identity and Start Menu entry.
2. Enforce permissions and implement file, command, agent-loop and UI Automation tools.
3. Test rejection paths, cancellation, actual file changes, actual processes and installed startup.
4. Build an ARM64 artifact where cross-packaging succeeds; identify hardware testing gaps.
5. Publish immutable installer files and checksums, then expose a working website download.

## Scope and remaining platform work

Version 0.1 is the first working Windows vertical slice, not completion of the entire platform specification. macOS/Linux installers, cloud task synchronization, remote device requests, vector memory, third-party OAuth/MCP integrations, arbitrary plugin execution, scheduled autonomous jobs and subagent orchestration are subsequent phases. Existing web chat features remain available. Local task history is separate from web conversation storage. Release signing depends on provisioned publisher credentials; unsigned artifacts must be labelled honestly. Automatic executable updates are not enabled without a trusted signing setup.

Electron security guidance: https://www.electronjs.org/docs/latest/tutorial/security/

NSIS packaging: https://www.electron.build/docs/nsis/
