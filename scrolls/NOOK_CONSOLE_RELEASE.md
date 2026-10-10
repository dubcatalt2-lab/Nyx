# Nook desktop 0.1.1

The Windows application now uses the selected Console (F) layout, Nook website colors, and a collapsible sidebar using the same Hugeicons exports as Hermes Workspace. The reference is https://github.com/outsourc-e/hermes-workspace; this is a Nook implementation, not a bundled Hermes runtime.

Native email/password sign-in, account creation and password reset connect to existing Nook accounts. An automatically provisioned desktop key is separate from the user's developer API key. Keys and refresh credentials are DPAPI-encrypted. Passwords are not persisted. API model policies and shared account usage limits remain authoritative. Owner key revocation covers both key types.

Local sessions retain recent conversation context. Memory is explicitly enabled per note before being sent to models. Skills store reusable instructions; Profiles store instructions and a preferred model. A local checklist and reviewed, sequential Conductor queue are functional. Jobs displays execution history, and Operations retains approved Windows UI Automation and administrator actions. Queues run only while the app is open and never restart automatically. This does not implement Hermes swarm, scheduling, skill marketplace or remote plugins.

Native account UIDs and manual-key fingerprints partition local SQLite data, project selection and backups. Legacy manual-key data is copied to its initial key profile with SQLite checkpointing and hash verification; original files remain. Signing out opens a separate local profile. Tool grants expire and reset on restart/account change.

The model picker uses `/api/v1/models` with the account key. Model assets are rebuilt from `chapels/agents/models.js`, so the desktop uses the website's company/family icon mapping. Replies keep their response model IDs. The shared website currently uses one pulsing thinking dot beside each model's specific icon. Provider-labelled reasoning summaries appear in a closed Thinking summary disclosure and persist in history; omitted, raw or encrypted reasoning is not fabricated or exposed.

Source assets regenerate through `nook-desktop/scripts/build-assets.mjs`; the pinned Hugeicons development dependency is not shipped as a runtime dependency. Licenses ship in resources. The Windows pipeline regenerates assets before testing/building both architectures.

Verification: desktop unit tests exercise real file writes/undo, approved PowerShell/CMD, cancellation, permission revocation, provider contracts, workspace context and reasoning. Electron smoke checks exercise actual native approvals and controls. Console and account fixtures verify model icons, thinking disclosures, multi-turn sessions, skills/profiles/memory, sequential queues, account isolation, DPAPI persistence and 1320/800-width layouts. Backend account tests verify authenticated key provisioning, existing developer key preservation, separate revocation and shared-pool enforcement. No paid live model inference or real-user password sign-in is claimed. ARM64 is cross-built without ARM hardware testing. Installers remain unsigned.

Production advertising stays disabled. No retired runtime is introduced. Independent Altar Worship, Drop and Tutsi projects are not changed by this release.

## Administrator install and test workspace

The installer now installs for all users and requests Windows administrator approval. The installed application remains asInvoker; install approval does not permanently elevate the agent. User clarification requested a coding-agent project workspace, not a VM or third-party sandbox driver. Files > Create test workspace copies the chosen project and grants level 3 access to the copy for 60 minutes. Credentials, links and node_modules are excluded. Copies are bounded to 50 MB, 10,000 entries and 4 MB per file. The UI reports excluded entries; dependencies may need installing separately. Originals remain untouched by ordinary file tools and relative test commands until Review & apply is approved. Text-file applications use snapshot hashes and backups; conflicts refuse overwrite. Deleted, binary and oversized files require manual handling. Test copies remain locally available when leaving or restarting; tool access is not restored.

This workspace is not an OS security sandbox. Approved commands have ordinary Windows user rights and can explicitly reach outside the copy. UI Automation and elevated commands retain separate exact-action approvals. No Windows Sandbox, Sandboxie driver, service or automatic startup is installed. Development smoke ran a real PowerShell command in the copy, verified the original was unchanged, then applied the generated text file through native approval.

## 0.1.2 chat-driven terminal

Removed manual shell, working-directory, command and administrator-command forms. The Terminal page is a read-only activity log with a return-to-chat action. The existing agent loop formulates commands, invokes the broker and observes results; exact-command approval and administrator UAC still apply. Tested with a fixture model producing a real PowerShell action and receiving its exit status/output, plus native approval, denial and test-copy application checks. No paid live inference was used.

## 0.1.3 private NyxCloud VM

The private Debian QEMU VM now has a dedicated nook-agent account and systemd guest broker. Nook uses authenticated HTTP over a fixed localhost-only QEMU port forward (127.0.0.1:48764 to guest 8087); no cloud execution service or public listener is added. Configuration remains under LOCALAPPDATA/NyxCloud outside Git. Setup creates an incremental cloud-init seed and backs up the launcher without replacing the disk or personal files. Existing VM desktop/tunnel remains separate. Run setup-private-vm.py with the existing VM build-tools Python only while the VM is shut down.

Connect Nyx VM in the composer or Use private Nyx VM in Settings grants a 60-minute guest workspace. Account switch/restart revokes access. File tools, conflict-aware writes/undo and bash commands run in /home/nook-agent/workspace. VM commands have a 60-second timeout, bounded output and cancellation by process group. The guest service cannot gain privileges or write system directories; Windows UI/elevation tools are unavailable and there is no fallback to Windows execution. Windows project files are not automatically transferred. Guest network access remains available. This uses the existing persistent VM, not an ephemeral clean image.

Tests: real guest status, anonymous rejection, read/write/conflict/undo, model-fixture-driven Linux command and observations, unprivileged identity, path escape refusal and cancellation; unit tests cover fixed loopback/auth, no redirect, cancellation and approval/revocation. No paid inference used. Reference: QEMU system invocation hostfwd and cloud-init module documentation.

## 0.1.4 automatic AI-only VM and reply parsing

Supersedes the manual VM-connect workflow above. On PCs with the private VM configuration, AI tasks automatically receive a separate guest broker; manual tools retain their separate Windows permission scope. There is no Connect VM button or per-command VM approval. Guest access expires after each run, no Windows fallback occurs, and ordinary chat does not require the guest to be online. Windows commands still require their existing explicit grants and approvals. The existing personal VM stays persistent and manually started; Nook does not silently restart it or expose it to other website users.

Added VM-only browser tool using headless Chromium to render HTTP(S) pages and return bounded untrusted text and links. Chromium runs without its inner process sandbox inside the unprivileged, systemd-restricted guest service; the QEMU VM remains the host-isolation boundary. No Windows files are mounted into this workspace. Native code does not send the local VM token to Nook or model providers. Real example.com rendering and automatic AI-only bash execution passed.

Reply parser accepts normal conversational text, fenced JSON and final-answer trailing prose. Multiple or ambiguous tool objects never execute; one bounded format-repair request is permitted before a readable failure. Fixed the reported JSON trailing-character error without relaxing tool-name/argument validation.

## 0.1.5 conversation presentation

User messages align right in compact, wrapping panels; assistant responses remain left. Updated send control uses Hugeicons ArrowUp02 with a 42px target, rounded-square styling, clear hover/disabled states and reduced-motion support. Agent instructions request natural direct replies and avoid unsolicited branding/hosting/VM narration, while retaining accurate disclosure when asked or relevant to limitations. Saved conversation content is preserved; wording guidance affects new responses.

## 0.1.6: Windows projects, optional VM testing, and connected publishing

The selected Windows project is now the primary AI workspace. Open folder grants reviewed local access; normal file and command tools use it. The private VM is reserved for explicit test tools and website checks. No VM command implicitly substitutes for a Windows command.

Projects provides GitHub CLI browser sign-in, current Windows GitHub account status, repository listing, and clone/open with destination selection. GitHub credentials are not copied into the VM or sent as model context. The existing Windows GitHub/hosting CLI sessions are available to individually approved local commands. Publishing is an agent-prepared command flow, not a provider-specific deployment dashboard; a new hosting account still requires that provider's sign-in. Git and GitHub CLI are prerequisites with installation links. Repository list shows the first 100 owned repositories; shared repos can be entered as owner/name.

Optional test copies support up to 50 MB/10,000 entries, 4 MB per file, excluded credentials/dependencies/generated output, text and binary transfer, persisted copy identity, reviewed apply-back including deletions, content hash conflict checks and recovery receipts. VM copies are not refreshed automatically; Refresh from Windows preserves the prior copy. VM remains a separately running personal guest, not installed or started on other users' computers by this release. Transfers use a versioned helper through the existing authenticated guest daemon, so no guest service restart is required.

Reply handling retains final-answer fields and trailing final prose rather than dropping them. Progress-only final replies trigger at most two repair attempts; persistent failures produce a visible failure response instead of Done. This is a bounded wording check, not a guarantee that every model answer is correct. Previous chat history is preserved.

Validation includes unit tests, actual Windows commands, actual private VM binary/text transfer and conflict/recovery checks, app UI with Windows primary and explicit VM tests/apply-back, GitHub UI fixtures, and current Windows GitHub account/repository discovery. No real repository push, deployment of a user-selected project, new GitHub login, or paid model inference was performed by these tests.
