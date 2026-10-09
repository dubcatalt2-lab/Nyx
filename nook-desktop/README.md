# Nook Agent for Windows

Windows 10/11 x64 is the primary target. The NSIS installer includes the application runtime, creates a Start Menu entry and supports uninstall through Windows Settings. Node.js is not needed on the user's machine. ARM64 can be cross-built; test on actual ARM hardware before treating it as verified.

## Use

Open Nook Agent, then Permissions & account. Use Open Nook web to sign in to nook.nyxlearning.org and create a Nook API key. Paste it into the local app. The app validates the key against its model catalog and stores it using Windows DPAPI. Account and model quotas stay enforced by Nook's API. No provider secret is shipped.

Choose a project folder and grant a permission level for 15, 30 or 60 minutes. Grants reset at application restart. Local task execution requires a text model that follows the documented JSON action protocol. A malformed response fails visibly without executing an action. Twenty steps and ten minutes bound each run. No inference retries are automatic.

Files supports bounded text reading, listing, search, writes, folder creation and undo. Writes verify expected hashes, store recoverable backups and recheck the result. Links and credential filenames are denied. These checks do not isolate the app from another malicious process running as the same Windows user. Commands require separate approval and have ordinary Windows user access outside the selected folder. Their output is capped, execution is bounded to sixty seconds or remaining grant duration, and Stop attempts to kill their process tree.

UI Automation reads or operates accessible controls within a specified process after native approval. Some applications do not expose supported control patterns. Password fields and protected system processes are excluded. Administrator actions use one local confirmation and Windows UAC per command. The non-elevated application cannot guarantee termination of an elevated child; only its exit code is returned, and effects require separate verification. It never automates UAC.

Task history, manually saved notes and file backups remain local under the application's user-data directory. Clear history removes task events and notes. Uninstall preserves local data. API keys are encrypted separately; Disconnect removes the saved key. The website cannot request desktop tasks in this version. The web-account window has no local IPC bridge.

The optional tray runs only while the user has enabled it for the current session. No service, login task or scheduled automation is installed. Ctrl+Shift+Esc and STOP AGENT stop ordinary work. Pause takes effect between steps. Elevated work may continue independently.

## Develop and build

Use Node.js 24 and Windows. Run `npm ci`, `npm test`, `npm start`. Build `npm run build:win` for x64 or `npm run build:arm64`. Run `npm run checksums`. Artifacts are in release/. Parent repository Playwright is required for `node scripts/smoke.mjs`. Use `NOOK_INSTALLED_EXE` to test an installed executable. `node scripts/test-uia.cjs` opens and controls only a dedicated WPF test fixture.

The Windows GitHub Actions workflow builds both architectures and uploads actual installer artifacts with checksums. Optional repository secrets NOOK_WINDOWS_CERTIFICATE and NOOK_WINDOWS_CERTIFICATE_PASSWORD enable signing. Without them the installer is unsigned and the website must say so. Builds are not automatically published or auto-installed by users' applications.

## Publish

Test the x64 installer, install/start/uninstall and inspect Authenticode status. Copy immutable installers to `/var/lib/nyx/nook-desktop/VERSION/` with read access for the nyx service. Verify SHA-256 on the server, then atomically write release.json containing version, signed and artifacts entries with arch, file, size and sha256. Only publish a manifest after files exist. The backend validates names and sizes before advertising or serving a download. The website dynamically reveals Download for Windows when `/api/nook-desktop/release` reports a valid x64 artifact.

The first release does not implement the entire platform proposal. Browser automation, remote pairing, cloud task sync, schedules, vector search, OAuth/MCP integrations, plugins and subagents remain subsequent work. Web chat, voice/media functionality outside the specifically removed Nook controls, accounts, model policies and existing developer APIs remain separate existing features.
