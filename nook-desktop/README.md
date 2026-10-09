# Nook Agent for Windows

Windows 10/11 x64 is the primary target. The NSIS installer includes the application runtime, creates a Start Menu entry and supports uninstall through Windows Settings. Node.js is not needed on the user's machine. ARM64 can be cross-built; test on actual ARM hardware before treating it as verified.

## Use

Open Nook Agent and sign in with your Nook email and password, or create an account in the app. A separate desktop key connects automatically without rotating your developer key. Refresh credentials and the desktop key use Windows DPAPI; passwords are never saved. Manual API-key connection remains available. The model picker reads the same account-filtered Nook catalog and packages the website?s model artwork locally. Account and model quotas stay enforced by Nook's API. No provider secret is shipped.

Choose a project folder and grant a permission level for 15, 30 or 60 minutes. Grants reset at application restart. Local task execution requires a text model that follows the documented JSON action protocol. A malformed response fails visibly without executing an action. Twenty steps and ten minutes bound each run. No inference retries are automatic.

Files supports bounded text reading, listing, search, writes, folder creation and undo. Writes verify expected hashes, store recoverable backups and recheck the result. Links and credential filenames are denied. These checks do not isolate the app from another malicious process running as the same Windows user. Commands require separate approval and have ordinary Windows user access outside the selected folder. Their output is capped, execution is bounded to sixty seconds or remaining grant duration, and Stop attempts to kill their process tree.

UI Automation reads or operates accessible controls within a specified process after native approval. Some applications do not expose supported control patterns. Password fields and protected system processes are excluded. Administrator actions use one local confirmation and Windows UAC per command. The non-elevated application cannot guarantee termination of an elevated child; only its exit code is returned, and effects require separate verification. It never automates UAC.

Sessions, task history, memory, skills, profiles, checklists and queues remain local under an account-specific user-data directory. Memory is excluded from model requests until enabled. Enabled memory, skills and profile instructions accompany future requests within a bounded context. Multi-turn sessions retain recent conversational context. Clear local workspace removes those local records. Uninstall preserves local data. API keys are encrypted separately; Sign out removes saved credentials. Revoke desktop key invalidates desktop sessions without replacing an existing developer key. The website cannot request desktop tasks in this version. The web-account window has no local IPC bridge.

The optional tray runs only while the user has enabled it for the current session. No service, login task or scheduled automation is installed. Ctrl+Shift+Esc and STOP AGENT stop ordinary work. Pause takes effect between steps. Elevated work may continue independently.

## Develop and build

Use Node.js 24 and Windows. Run `npm ci`, `npm test`, `npm start`. Build `npm run build:win` for x64 or `npm run build:arm64`. Run `npm run checksums`. Artifacts are in release/. Parent repository Playwright is required for `node scripts/smoke.mjs`. Use `NOOK_INSTALLED_EXE` to test an installed executable. `node scripts/test-uia.cjs` opens and controls only a dedicated WPF test fixture.

The Windows GitHub Actions workflow builds both architectures and uploads actual installer artifacts with checksums. Optional repository secrets NOOK_WINDOWS_CERTIFICATE and NOOK_WINDOWS_CERTIFICATE_PASSWORD enable signing. Without them the installer is unsigned and the website must say so. Builds are not automatically published or auto-installed by users' applications.

## Publish

Test the x64 installer, install/start/uninstall and inspect Authenticode status. Copy immutable installers to `/var/lib/nyx/nook-desktop/VERSION/` with read access for the nyx service. Verify SHA-256 on the server, then atomically write release.json containing version, signed and artifacts entries with arch, file, size and sha256. Only publish a manifest after files exist. The backend validates names and sizes before advertising or serving a download. The website dynamically reveals Download for Windows when `/api/nook-desktop/release` reports a valid x64 artifact.

This release does not implement the entire platform proposal. Browser automation, remote pairing, cloud task sync, schedules, vector search, OAuth/MCP integrations, plugins and subagents remain subsequent work. Web chat, voice/media functionality outside the specifically removed Nook controls, accounts, model policies and existing developer APIs remain separate existing features.

## Console interface (0.1.1)

Option F uses Nook?s near-black palette, flat console messages, and a collapsible sidebar with the same Hugeicons exports used by Hermes Workspace. Search (Ctrl+K) opens saved sessions. Jobs lists actual executions; Tasks is a local checklist. Conductor runs up to ten reviewed prompts sequentially, shares their session, stops on failure, and does not resume automatically. It is not Hermes?s multi-agent swarm or scheduler. Skills are editable instructions, not executable plugins or a remote marketplace. Profiles choose a model and reusable instructions.

The thinking indicator matches Nook web?s pulsing dot next to the current model icon. The shared website does not currently define distinct animation sequences per provider. Replies and saved sessions keep their response model ID and provider-labelled reasoning summaries. Raw or encrypted reasoning is not displayed; no synthetic summary is produced when the provider omits one. Media-only catalog entries open Nook web.

`npm run assets` regenerates the Hermes Hugeicons subset and Nook model branding directly from pinned icon data and `chapels/agents/models.js`. License notices ship under resources. `node scripts/test-console.mjs` tests models, context, sessions and queues with fixture inference. `node scripts/test-simple-ui.mjs` tests account setup/isolation and compact layouts with fixture authentication. These tests do not claim a paid live inference or a real-user sign-in was performed.

## Administrator install and test workspace

The installer now installs for all users and requests Windows administrator approval. The installed application remains asInvoker; install approval does not permanently elevate the agent. User clarification requested a coding-agent project workspace, not a VM or third-party sandbox driver. Files > Create test workspace copies the chosen project and grants level 3 access to the copy for 60 minutes. Credentials, links and node_modules are excluded. Copies are bounded to 50 MB, 10,000 entries and 4 MB per file. The UI reports excluded entries; dependencies may need installing separately. Originals remain untouched by ordinary file tools and relative test commands until Review & apply is approved. Text-file applications use snapshot hashes and backups; conflicts refuse overwrite. Deleted, binary and oversized files require manual handling. Test copies remain locally available when leaving or restarting; tool access is not restored.

This workspace is not an OS security sandbox. Approved commands have ordinary Windows user rights and can explicitly reach outside the copy. UI Automation and elevated commands retain separate exact-action approvals. No Windows Sandbox, Sandboxie driver, service or automatic startup is installed. Development smoke ran a real PowerShell command in the copy, verified the original was unchanged, then applied the generated text file through native approval.
