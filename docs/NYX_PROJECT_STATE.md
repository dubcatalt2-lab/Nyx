# Nyx Project State

Last repository review: 2026-08-08

Workspace: repository root (`<repo-root>`)

This file is the durable handoff for future Nyx chats. Read it with the repository and Git state. Never put API keys, passwords, private keys, access codes, tokens, or other secrets here.

## Start Here

Before making changes:

```powershell
git status -sb
git log -5 --oneline --decorate
npm run check:deploy
```

Important release warning: production currently contains commits that are not on `main`. Resolve or build on PR #34 before starting from `main`, or the Pirate Cove release can be accidentally omitted.

## Current Git and Release State

- Repository: `https://github.com/dubcatalt2-lab/Nyx.git`
- Active branch: `agent/pirate-cove`
- Latest release: Caddy On-Demand TLS and self-service custom domains, Link Checker God Domains and unresolved-result double checks, account-session reliability, and Chromebook workspace sizing on `agent/pirate-cove`
- `main` / `origin/main`: `0a654cc1c3e17faff12424ae1f2a1a4eb63f6a90`
- Draft PR: `https://github.com/dubcatalt2-lab/Nyx/pull/34`
- PR title: **Ship Pirate Cove and Owner Dashboard IP bans**
- Production URL: `https://nyxlearning.org`
- Production alias: `https://networkforteachers.netw.ar` (FreeDNS A record to the OVH VPS)
- Netlify project URL: `https://nyxlearning.netlify.app`
- Netlify site ID: `c3ee107b-3703-489c-9793-6a8eb598e186`
- Production host: OVHcloud VPS `15.204.93.166`, behind Cloudflare
- Production Wisp: `wss://nyxlearning.org/wisp/` (embedded)
- Rollback frontend: `https://nyxlearning.netlify.app`
- Rollback Wisp: `wss://nyx-temporary-production.up.railway.app/wisp/`

The following working-tree entries were deliberately left untracked and must not be staged, removed, or treated as Nyx release files without explicit instruction:

- `.codex-artifacts/`
- `.worktrees/`
- `wisp-test/` — a separate test project, not the Nyx application

## Current Production Verification

The OVHcloud cutover was completed on 2026-08-08 and migrated from Nginx/Certbot to Caddy on 2026-08-08. Cloudflare uses Full (strict), Caddy and Nyx are enabled at boot, Nginx is inactive and disabled, SSH uses key-only login, and Netlify/Railway remain available temporarily for rollback. The earlier smartwatch, game-performance, Pirate Cove, and Owner Dashboard IP-ban checks remain part of the release baseline:

- `/assets/games/index.html`: HTTP 200 and contains **Pirate Cove**
- `/assets/backgrounds/pirate-cove.gif`: HTTP 200 with `image/gif`
- `/healthz`: HTTP 200 JSON with `"wisp":"embedded"` on both apex and `www`
- `/catclass-games`: HTTP 200 JSON
- `/api/owner-dashboard/ip-bans`: HTTP 401 when unauthenticated, confirming the route and function bundle are live
- `/apps/link-checker/`: HTTP 200 with the Nocturne-inspired dashboard, sidebar, matching vector action icons, in-app tab-closing **Back to Nyx** action, and FreeDNS Scraper UI
- Link Checker God Domains and unresolved-result retry asset version `20260808-double-check-v12` is the current release candidate, and unauthenticated `/api/link-checker/full-scan/status` requests return HTTP 401
- The OVH-only Nocturne account credentials successfully authenticated and read `/api/vendors/status` without exposing credentials or starting a scan
- `/api/link-checker/freedns-registry?page=1`: HTTP 200 with 100 parsed registry entries; FreeDNS reported 21,163 entries across 212 pages at verification time
- `/api/link-checker/vendors`: HTTP 200 with 18 vendors
- `/api/link-checker/check`: `example.com` returned HTTP 200 with 18 vendor results and the configured paid plan, confirming the server-only OVH key is active
- Firebase sign-in, Owner Dashboard user listing, IP-ban listing, Nyx AI, Bunny link-generator access, Pirate Cove, and a proxied page through embedded Wisp were verified after the cutover
- FreeDNS inline vendor check: the production UI kept `example.com` in the scraper table and rendered all 18 vendor shields after the row refresh action (10 allowed, 2 blocked, 3 unknown, and 3 errors at verification time) with no horizontal overflow
- FreeDNS custom hostname: `networkforteachers.netw.ar` resolves to the OVH IPv4 address, is approved in `nyxCustomHostnames`, receives an automatic Caddy certificate, returns HTTP 200, and opens same-origin Wisp
- Self-service custom domains are live at `/connect-domain`: Nyx verifies A/AAAA records against `NYX_CUSTOM_HOST_IPS`, stores approved hostnames in server-only `nyxCustomHostnames`, and supplies Caddy's constant-time On-Demand TLS authorization lookup. The page displayed `15.204.93.166`, enabled submission, and had no horizontal overflow at 390x844 during production verification.
- Owner Dashboard redesign assets: cache-versioned stylesheet and script returned through the production homepage; desktop, 390x844, and 320x320 local interaction checks showed no horizontal overflow
- **Amazing Strange Rope Police**: transformed Unity loader uses the guarded worker callback through Ultraviolet; the selected Scramjet path loads the 66 MB legacy Unity data archive, creates its canvas, and shows no callback or DataView error through a 90-second production regression run
- Homepage cursor effect: the background dots repel, fade, and return along the pointer path; the **Nyx** wordmark remains fixed with no cursor transform
- Smartwatch stylesheet and cache-versioned application script: HTTP 200; the 320x320, 396x484, and 450x450 layouts keep essential browser controls and home actions reachable
- Scramjet capability fallback: browsers without Service Worker support receive an explanation and a per-tab **Try direct mode** action without changing the saved proxy engine
- Pirate Cove game performance control: Auto, On, and Off are present; Auto lowers iframe resolution immediately on low-power devices or after sustained frame stalls
- Reset navigation returns to the clean application path without adding a `nyx-reset` query parameter
- Live CatClass-derived catalog: 4,482 games at verification time
- Removed-game matches for **A Mirror's Curse SFW**: 0

Catalog size is external data and can change. The route and exclusion behavior are the durable checks.

## Architecture

Nyx is primarily a vanilla HTML, CSS, and JavaScript application, not React or another component framework.

- `index.html`: main application shell and entry markup
- `script.js`: main client runtime; browser tabs, navigation, settings, themes, profiles, proxy selection, games entry points, and many UI flows
- `styles.css` and `css/`: base styles plus feature-specific presentation layers
- `startup-studyhub.html` and `startup.js`: startup/onboarding experience
- `ai.html`, `js/ai-workspace.js`, `css/ai-workspace.css`: AI workspace
- `js/owner-dashboard.js`, `css/owner-dashboard.css`, `css/owner-dashboard-polish.css`: Owner Dashboard
- `server.js`: Express 5 application and HTTP/API routes
- `wisp-server.js`: standalone Wisp WebSocket service used by Railway
- `uv/`, `uv.sw.js`, `uv.config.js`: Ultraviolet proxy runtime
- `scramjet/`, `scramjet.sw.js`: Scramjet proxy runtime
- `baremux/`, `epoxy/`, `assets/transports/`: BareMux, Epoxy, and Libcurl transports
- `assets/games/`: Pirate Cove UI, manifest, game launcher, and fallback behavior
- `assets/ugs/`, `assets/gn-math/`, `assets/gms-games/`, `assets/seraph/`: game sources and players
- `netlify/functions/api.mjs`: wraps the Express app with `serverless-http`
- `scripts/build-netlify.mjs`: produces generated `dist/` output and runtime configuration
- `firestore.rules`: Firestore access rules; these are not deployed by Netlify

Client preferences and much local UI state use browser storage. Cross-device account, profile, role, subscription, activity, and audit state use Firebase Authentication, Firebase Admin, and Firestore through server routes.

## Main Product Areas to Preserve

- Browser shell, tabs, navigation, address bar, downloads, popup protection, and developer console
- Smartwatch layout for short, narrow viewports, including reachable home actions and compact browser controls
- User-selected proxy engine and transport
- Themes and custom recoloring
- Homepage shortcuts, effects, profile/account controls, and search/course entry
- Profile customization, animated avatars and banners, decorations, effects, badges, roles, status, and profile directory
- Settings and onboarding
- AI workspace, model selection, conversations, temporary chats, image attachments, and API integration
- Owner Dashboard, role permissions, subscriptions, premium access, profiles, activity, and audit records
- About Nyx and its user-directed changelog
- Pirate Cove search, sorting, pagination, remote catalogs, fallbacks, and full-screen player
- Single-file export/download behavior

## Durable Product Instructions

- Preserve functionality before changing presentation.
- Diagnose the actual cause of a regression; do not keep stacking speculative CSS, proxy overrides, cache resets, or host-specific fixes.
- The user's explicit proxy engine and transport choice should remain authoritative. Do not silently force a different engine for a site unless the user asks for that policy.
- Smartwatch-specific layout is limited to viewports no larger than 480px wide and 520px tall. It keeps Back, Reload, Home, the address field, and Menu visible; Forward, Bookmark, and Weather remain available outside that watch breakpoint.
- Dense workspaces must account for ChromeOS display scaling: Link Checker and Nyx AI collapse their desktop sidebars at 1100px so filters, model controls, tables, and dropdowns retain the full content width. Larger laptop and desktop viewports keep the persistent sidebars.
- When Link Checker runs inside a Nyx tab, it obtains a fresh Firebase ID token from the authenticated same-origin parent through the narrowly scoped `nyx:account-token-request` bridge. The parent validates the requesting tab as `/apps/link-checker/` before replying. This avoids loading a second Firebase copy from Google's CDN, which managed Chromebooks can replace with an HTML block page. Direct standalone Link Checker pages retain the Firebase module fallback.
- Scramjet requires browser Service Worker support. When the selected browser cannot provide it, keep the saved engine unchanged and offer the user a per-tab **Try direct mode** action; direct mode still depends on the destination allowing iframe embedding.
- Keep the Developer Console implemented with Eruda unless the user explicitly requests otherwise.
- Link Checker vendor scans go through Nyx's same-origin `/api/link-checker/*` server bridge to `lc.nocturne.lol`. Individual checks prefer the paid Nocturne account session and fall back to `NYX_LINK_CHECKER_API_KEY` only when account credentials are not configured. Fast page and full-registry scans require `NYX_LINK_CHECKER_ACCOUNT_USERNAME` and `NYX_LINK_CHECKER_ACCOUNT_PASSWORD`; Nyx keeps the resulting session cookie only in server memory and automatically signs in again after rejection or restart. Starting a full scan returns as soon as Nocturne accepts the job instead of waiting on a second provider status request, and the browser automatically retries transient provider timeouts, overload responses, and rate limits while the user keeps the scan active. Never put any of these values in client code, tracked files, documentation, logs, or commits.
- The Netlify build uses Terser to mangle private identifiers in Nyx's first-party browser and service-worker runtimes. Repository sources remain readable, user-facing labels and storage/message values remain unchanged, and required public contracts such as `__uv$config`, `__NYX_RUNTIME_CONFIG__`, service-worker routes, and third-party runtime APIs must never be property-mangled or renamed.
- Nyx presents the non-account Link Checker workspace in a Nocturne-inspired sidebar and table layout, with a local dashboard, single all-vendor or selected-vendor checks, device-local history, filters, CSV/JSON exports, preferences, vendor reports, and public RDAP registration details. Its **Back to Nyx** action closes the containing Nyx browser tab when embedded and returns to `/` when opened directly. Its FreeDNS Scraper reads the public `freedns.afraid.org` registry through a fixed-target same-origin route and stores the collected registry only in that browser, including the public owner and added-date fields. When the scraper is opened, the first 25-domain page is checked automatically if its rows have no saved verdicts; **Check this page** sends one bounded batch of up to 25 URLs to Nyx, which checks them through the paid account session with bounded server concurrency instead of starting separately rate-limited browser requests or displaying a cooldown countdown. Only signed-in Premium and Trial accounts can run **Check all domains**; staff role alone does not grant access. A full scan first imports Nocturne's existing cached `/api/domains` vendor maps in bounded parallel page batches and updates visible progress from saved verdicts, matching Nocturne's fast cached-first presentation. Nyx starts or reconnects to the account-authenticated server-side `/api/scan` job only for domains still missing results, polls `/api/vendors/status` without allowing a slow provider counter to move local progress backward, then imports refreshed results. Compact device-local verdicts are saved in 100-result checkpoints. This avoids one browser `/api/check` request per domain and its 15-minute burst cooldown. Stopping Nyx polling does not cancel the provider job; the next click reconnects and imports its results. Ordinary single checks retain Nyx's 30-per-15-minute client allowance but prefer the paid account session upstream. Each row also has an explicit refresh action, and vendor results appear as allowed, blocked, unknown, or error shields. After a result is saved and scanning is idle, the compact shield group is clickable and opens a responsive detail dialog with every vendor state, refreshed category data when available, FreeDNS metadata, and public RDAP registration fields; failure to refresh preserves the compact result display. Nocturne account, upgrade, admin, API-key-management, and scrape controls remain deliberately unexposed.
- **God Domains** is a device-local ranking toggle over saved FreeDNS verdicts. It preserves text and public/private filters, hides unchecked domains, ranks by the greatest number of unblocked vendors followed by fewer blocked and unknown results, and shows each row's unblocked/checked score. It does not start checks or alter the cached-first scan pipeline.
- When a clean full scan finishes with domains still missing provider verdicts, Nyx exposes **Double check (N)** with the unresolved count. It reruns the same cached-first flow over only those missing domains and hides again after they resolve; failed or manually stopped jobs do not falsely present the scan as complete.
- Theme work should recolor the existing interface without unexpectedly changing its layout. Custom-theme text, icons, controls, and selected states must use the selected theme tokens.
- The 2D homepage dot field uses a swept-pointer particle response: nearby dots repel and fade, then spring back into their grid. Preserve its reduced-motion behavior and keep it disabled when 3D backgrounds are active.
- Preserve animated GIF banners and avatars as animated media. Do not replace them with static conversions.
- Public profile, profile editor preview, and account dropdown share behavior but must not lose their intended presentation or editing controls.
- Only add entries to the About Nyx changelog when the user explicitly asks.
- Do not import or mirror third-party game catalogs or copyrighted assets without checking authorization and deployment implications.
- The game titled **A Mirror's Curse SFW** must remain excluded from both server-fed and client-cached catalogs.
- Pirate Cove must retain the supplied animated background, smooth delayed parallax, filled page bottom, responsive 30-item pagination, and working source fallback behavior.
- Pirate Cove suspends its hidden catalog and animated cove background while a game is open. Its **Game performance** control cycles Auto, On, and Off; Auto lowers the game iframe's render resolution on low-power devices or after sustained frame stalls without changing the saved Nyx proxy engine.
- Pirate Cove remote games must honor Nyx's configured proxy engine and transport. Its managed Scramjet frame path is required for large legacy Unity builds; do not restore the old behavior that forced every remote game through Ultraviolet.
- `uv.sw.js` repairs the exact legacy UnityLoader worker-callback lookup that Ultraviolet rewrites incorrectly. Keep the patch scoped to transformed `*UnityLoader.js` scripts containing that marker, and regression-test **Amazing Strange Rope Police** before removing or broadening it.

## Pirate Cove Release Details

PR #34 contains the Pirate Cove release, durable handoff updates, and the combined IP-ban commit:

- `5d8d71a` — redesign the game library as Pirate Cove, add the supplied GIF, improve failed/404 game fallback, and exclude A Mirror's Curse
- `844b91c` — route `/catclass-games` through the Netlify function so the live remote catalog works in production
- `d206192` and `8fd6a4f` — add and format the durable Nyx handoff
- `5c690f5` — add Owner Dashboard IP bans and dashboard polish on top of Pirate Cove
- `c1101ed` — repair the legacy UnityLoader worker callback after Ultraviolet rewriting
- `f689159` — make Pirate Cove honor Nyx's selected proxy engine so large legacy Unity archives use the reliable managed Scramjet frame path
- `12a557f` — add the cursor-reactive homepage particle field while keeping the Nyx wordmark fixed
- `f5375cb` — add the smartwatch layout, Scramjet direct-mode fallback, clean reset URL, and Pirate Cove performance safeguards

The supplied background is stored at:

`assets/backgrounds/pirate-cove.gif`

Do not remove the `.gitignore` exception that allows this asset to be versioned.

The Netlify build intentionally skips five bundled Minecraft HTML files larger than Netlify's recommended 10 MB limit. Their source files remain in the repository, and the generated UGS catalog excludes them from that deployment.

## Deployment Topology

### Current production

- Static frontend, Express-backed HTTP routes, and embedded Wisp: OVHcloud VPS behind Caddy
- Public domain, edge proxy, and DNS: Cloudflare-managed `nyxlearning.org`
- Accounts and shared profile/admin data: Firebase Authentication and Firestore
- Rollback only: Netlify frontend and Railway Wisp remain configured until the OVH release is stable

The VPS serves generated `dist/` through Express on local port 8080 and exposes the embedded Wisp endpoint through Caddy at `/wisp/`. Caddy trusts forwarded client headers only from Cloudflare's published networks, then overwrites `CF-Connecting-IP` with its parsed client address before proxying. Direct FreeDNS requests therefore cannot spoof the address used by Nyx IP logging and bans.

## IP Ban Controls

- The Owner Dashboard gives Owner, Co-owner, and Admin roles an **IP bans** control. It stores exact IPv4/IPv6 addresses in the server-only `nyxIpBans` Firestore collection and records changes in `nyxAuditLog`.
- Authenticated activity heartbeats and session-start events update server-managed `lastSeenIp` and `lastSeenIpAt` fields for that account. Authorized staff can view the last observed address for accounts they can manage and use **Disable + block IP**; it disables the Firebase account, revokes sessions, and creates the IP ban. It is not a historical IP log.
- Express and Netlify-function requests are checked before routes run; ban data is cached for up to 30 seconds and invalidated after a local change. The application must fail open if Firebase is unavailable rather than turn a Firebase outage into a site outage.
- Netlify functions default `NYX_TRUST_PROXY` to `true` so the verified deployment headers can identify the source IP. A self-hosted deployment may set it only behind a proxy that overwrites client-supplied forwarding headers.
- Production static files, APIs, and Wisp upgrades pass through Express's IP-ban guard on OVH. A matching Cloudflare IP List plus WAF rule remains the earliest edge block and prevents cached responses from bypassing the origin guard. The exact runbook is `docs/IP_BANS.md`. Do not add a Cloudflare API token to Nyx merely to synchronize the two lists.
- Railway's direct Wisp endpoint is rollback-only and remains outside Cloudflare.

### OVH deployment

`DEPLOYMENT.md` and `deploy/` define the active single-OVHcloud-VPS deployment using Ubuntu 26.04, Caddy, systemd, and embedded Wisp. The installer builds the minified `dist/` output with a dynamic same-host Wisp URL and without Netlify's large-file omissions, serves it through Express so the application IP-ban guard also covers static pages, validates and reloads Caddy, sanitizes forwarding headers, restricts Cloudflare visitor-IP trust to Cloudflare's published networks, and prunes build-only dependencies. `/etc/nyx/nyx.env` and the selected domain are preserved across reruns, and `deploy/update-ovh.sh` provides validated fast-forward updates.

## Server Environment Variable Names

Values belong in Netlify, Railway, Firebase, or the future VPS environment—not in Git.

Core deployment:

- `PORT`
- `WISP_URL`
- `NYX_ALLOWED_ORIGINS`
- `NYX_PUBLIC_ORIGIN`
- `NYX_TRUST_PROXY`
- `NYX_CUSTOM_HOST_IPS` (OVH/Caddy only; comma-separated public addresses accepted by self-service domain verification)
- `NYX_PROJECT_ROOT`
- `NYX_STATIC_ROOT` (VPS only; points Express at generated `dist/` while dependencies remain under the project root)

Firebase/account administration:

- `FIREBASE_WEB_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `NYX_FOUNDER_PROFILE_ADMIN_UID`

AI integration:

- `NYX_AI_API_KEY`
- `NYX_AI_ENDPOINT`
- `NYX_AI_BASE_URL`
- `NYX_AI_MODELS_ENDPOINT`
- `NYX_AI_TEMPERATURE`
- `NYX_AI_MAX_TOKENS`
- model-specific variables such as `NYX_AI_MODEL_CHATGPT_54_MINI`

Other server features:

- `BUNNY_API_KEY`
- `LINK_GENERATOR_ACCESS_CODE`
- `LINK_GENERATOR_MAX_ZONES`
- `LINK_GENERATOR_PREMIUM_BATCH_LIMIT`
- `NYX_LINK_CHECKER_API_KEY`
- `NYX_LINK_CHECKER_ACCOUNT_USERNAME`
- `NYX_LINK_CHECKER_ACCOUNT_PASSWORD`
- `NYX_LINK_CHECKER_BULK_CONCURRENCY_PER_USER`
- `NYX_LINK_CHECKER_BULK_CONCURRENCY_GLOBAL`
- `NYX_SAFE_BROWSING_API_KEY` or `GOOGLE_SAFE_BROWSING_API_KEY`

Inspect `server.js`, `wisp-server.js`, and deployment settings before adding or renaming variables.

## Build, Test, and Run Commands

Install and run locally:

```powershell
npm ci
npm start
```

Local URL and health check:

```text
http://localhost:8080
http://localhost:8080/healthz
```

Account-oriented local helper:

```powershell
npm run dev:accounts
```

Build and validate Netlify output:

```powershell
npm run build:netlify
npm run check:deploy
```

Production deployment, only after explicit user authorization:

```powershell
npx netlify-cli deploy --prod --dir=dist
```

Firestore rules are a separate deployment:

```powershell
firebase deploy --only firestore:rules
```

Do not edit `dist/` directly. It is regenerated by `npm run build:netlify` and by Netlify's configured build command.

## Validation Expectations

Choose checks proportional to the change, but always include:

1. `git diff --check`
2. Syntax/build checks for changed JavaScript
3. `npm run build:netlify`
4. `npm run check:deploy`
5. Desktop and narrow/mobile interaction checks for UI changes
6. Live custom-domain checks after a production deployment

For proxy/browser work, test the user-selected engine and transport without silently switching it. Check service-worker registration, encoded route, Wisp connectivity, network response, and console error separately.

For profiles, test static and animated media, edit actions, preview, account dropdown, public profile directory, roles, subscriptions, theme colors, and mobile overflow.

For Pirate Cove, test search, sort, pagination, card cover fallbacks, launch/retry/close/fullscreen, remote catalog failure, actual 404 documents, background animation, maximum scroll, and horizontal overflow.

## Known Risks and Unresolved Areas

- Fast full-registry scans depend on valid paid Nocturne account credentials in the VPS environment and on Nocturne's server-side queue. Provider outages or account changes can delay that external job. Nyx can stop polling without canceling it and reconnect later, but imported verdicts remain device-local.
- Cloudflare's `www.nyxlearning.org` record still targets the former Netlify origin. The Caddy template treats `www` as an allowed on-demand hostname but cannot issue its certificate until the Cloudflare record is changed to the OVH VPS. The apex and `networkforteachers.netw.ar` are live through Caddy; preserve the Netlify target as rollback information when fixing `www`.
- Self-service custom domains intentionally accept only exact A/AAAA records resolving to `NYX_CUSTOM_HOST_IPS`. Certificate-authority issuance limits still apply, browser Firebase sessions are per hostname, and direct FreeDNS aliases do not inherit Cloudflare WAF protection. Keep registration rate limiting and the Caddy ask endpoint enabled.
- Spotify authentication inside the proxied browser has been unreliable. Observed failures included invalid CSRF responses and reCAPTCHA timeouts on both the custom domain and localhost. Treat it as unresolved unless a fresh end-to-end login succeeds. Do not add another forced-engine or authentication workaround without tracing the exact request/cookie/origin flow.
- Some external sites use bot protection, DRM, cross-origin isolation, OAuth restrictions, or security verification that may not work through a browser proxy. Distinguish an upstream restriction from a Nyx regression.
- Large WebGL/Unity games can still exceed a device's available GPU memory or have their own performance defects. Pirate Cove's Auto performance mode reduces host rendering and game resolution, but it cannot guarantee that every third-party game is safe on every GPU.
- Some smartwatch browsers do not expose Service Workers, so Scramjet cannot run in those browsers. Nyx reports that capability limit and offers a user-triggered direct-mode attempt for the failed tab, but sites that block iframe embedding will still be unavailable there.
- Service workers and versioned proxy assets can make old behavior appear after a deployment. Inspect the active registration and cached asset version before changing application logic.
- `script.js` and `styles.css` are large, and several feature CSS files overlap. Keep changes narrowly scoped, inspect computed precedence, and remove obsolete rules when replacing a presentation layer.
- Production is ahead of `main` until PR #34 is merged.

## Handoff Update Checklist

When materially updating this file:

- Replace the active branch, commit, PR, and deploy ID rather than accumulating stale release entries.
- Move completed issues out of **Known Risks** only after verification.
- Add only durable instructions, not raw terminal logs or long chat transcripts.
- Never record secret values.
- Commit the handoff with the code change that made it necessary when practical.
