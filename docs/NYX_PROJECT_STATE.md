# Nyx Project State

Last repository review: 2026-08-05

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
- Combined release commit: `c1101ed2ec8654646d6ef07219adcbfd4ac88574`
- `main` / `origin/main`: `0a654cc1c3e17faff12424ae1f2a1a4eb63f6a90`
- Draft PR: `https://github.com/dubcatalt2-lab/Nyx/pull/34`
- PR title: **Ship Pirate Cove and Owner Dashboard IP bans**
- Production URL: `https://nyxlearning.org`
- Netlify project URL: `https://nyxlearning.netlify.app`
- Netlify site ID: `c3ee107b-3703-489c-9793-6a8eb598e186`
- Latest verified production deploy: `6a73b2e30de5962b1f91764d`
- Unique deploy URL: `https://6a73b2e30de5962b1f91764d--nyxlearning.netlify.app`
- Production Wisp: `wss://nyx-temporary-production.up.railway.app/wisp/`

The following working-tree entries were deliberately left untracked and must not be staged, removed, or treated as Nyx release files without explicit instruction:

- `.codex-artifacts/`
- `.worktrees/`
- `wisp-test/` — a separate test project, not the Nyx application

## Current Production Verification

The 2026-08-05 combined Pirate Cove and Owner Dashboard IP-ban deployment was verified on the custom domain:

- `/assets/games/index.html`: HTTP 200 and contains **Pirate Cove**
- `/assets/backgrounds/pirate-cove.gif`: HTTP 200 with `image/gif`
- `/healthz`: HTTP 200 JSON
- `/catclass-games`: HTTP 200 JSON
- `/api/owner-dashboard/ip-bans`: HTTP 401 when unauthenticated, confirming the route and function bundle are live
- **Amazing Strange Rope Police**: transformed Unity loader uses the guarded worker callback, creates its canvas, and shows no Unity error dialog through Ultraviolet
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
- Keep the Developer Console implemented with Eruda unless the user explicitly requests otherwise.
- Theme work should recolor the existing interface without unexpectedly changing its layout. Custom-theme text, icons, controls, and selected states must use the selected theme tokens.
- Preserve animated GIF banners and avatars as animated media. Do not replace them with static conversions.
- Public profile, profile editor preview, and account dropdown share behavior but must not lose their intended presentation or editing controls.
- Only add entries to the About Nyx changelog when the user explicitly asks.
- Do not import or mirror third-party game catalogs or copyrighted assets without checking authorization and deployment implications.
- The game titled **A Mirror's Curse SFW** must remain excluded from both server-fed and client-cached catalogs.
- Pirate Cove must retain the supplied animated background, smooth delayed parallax, filled page bottom, responsive 30-item pagination, and working source fallback behavior.
- `uv.sw.js` repairs the exact legacy UnityLoader worker-callback lookup that Ultraviolet rewrites incorrectly. Keep the patch scoped to transformed `*UnityLoader.js` scripts containing that marker, and regression-test **Amazing Strange Rope Police** before removing or broadening it.

## Pirate Cove Release Details

PR #34 contains the Pirate Cove release, durable handoff updates, and the combined IP-ban commit:

- `5d8d71a` — redesign the game library as Pirate Cove, add the supplied GIF, improve failed/404 game fallback, and exclude A Mirror's Curse
- `844b91c` — route `/catclass-games` through the Netlify function so the live remote catalog works in production
- `d206192` and `8fd6a4f` — add and format the durable Nyx handoff
- `5c690f5` — add Owner Dashboard IP bans and dashboard polish on top of Pirate Cove
- `c1101ed` — repair the legacy UnityLoader worker callback after Ultraviolet rewriting

The supplied background is stored at:

`assets/backgrounds/pirate-cove.gif`

Do not remove the `.gitignore` exception that allows this asset to be versioned.

The Netlify build intentionally skips five bundled Minecraft HTML files larger than Netlify's recommended 10 MB limit. Their source files remain in the repository, and the generated UGS catalog excludes them from that deployment.

## Deployment Topology

### Current production

- Static frontend and Express-backed HTTP routes: Netlify
- Public domain and DNS: Cloudflare-managed `nyxlearning.org`
- Wisp WebSocket server: separate Railway deployment
- Accounts and shared profile/admin data: Firebase Authentication and Firestore

Netlify cannot replace the long-running Wisp WebSocket service. `netlify.toml` and `netlify/functions/api.mjs` inject the Railway Wisp endpoint into the generated runtime.

If Railway restricts Wisp origins, `NYX_ALLOWED_ORIGINS` must include the exact active origins that should connect, normally the custom domain and Netlify domain. Confirm the deployed Railway variables rather than assuming their value.

## IP Ban Controls

- The Owner Dashboard gives Owner, Co-owner, and Admin roles an **IP bans** control. It stores exact IPv4/IPv6 addresses in the server-only `nyxIpBans` Firestore collection and records changes in `nyxAuditLog`.
- Authenticated activity heartbeats and session-start events update server-managed `lastSeenIp` and `lastSeenIpAt` fields for that account. Authorized staff can view the last observed address for accounts they can manage and use **Disable + block IP**; it disables the Firebase account, revokes sessions, and creates the IP ban. It is not a historical IP log.
- Express and Netlify-function requests are checked before routes run; ban data is cached for up to 30 seconds and invalidated after a local change. The application must fail open if Firebase is unavailable rather than turn a Firebase outage into a site outage.
- Netlify functions default `NYX_TRUST_PROXY` to `true` so the verified deployment headers can identify the source IP. A self-hosted deployment may set it only behind a proxy that overwrites client-supplied forwarding headers.
- Static files are served by Netlify ahead of the function, so a matching Cloudflare IP List plus WAF rule is required for a full `nyxlearning.org` block. The exact runbook is `docs/IP_BANS.md`. Do not add a Cloudflare API token to Nyx merely to synchronize the two lists.
- Railway's direct Wisp endpoint is outside Cloudflare. Blocked visitors cannot load Nyx through the domain once the WAF rule is active, but direct Wisp abuse requires a separate Railway-side policy.

### Future VPS option

`DEPLOYMENT.md` documents an alternative single-OVHcloud-VPS deployment using Ubuntu, Nginx, systemd, and embedded Wisp. It is not the current production topology.

## Server Environment Variable Names

Values belong in Netlify, Railway, Firebase, or the future VPS environment—not in Git.

Core deployment:

- `PORT`
- `WISP_URL`
- `NYX_ALLOWED_ORIGINS`
- `NYX_PUBLIC_ORIGIN`
- `NYX_TRUST_PROXY`
- `NYX_PROJECT_ROOT`

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

- Spotify authentication inside the proxied browser has been unreliable. Observed failures included invalid CSRF responses and reCAPTCHA timeouts on both the custom domain and localhost. Treat it as unresolved unless a fresh end-to-end login succeeds. Do not add another forced-engine or authentication workaround without tracing the exact request/cookie/origin flow.
- Some external sites use bot protection, DRM, cross-origin isolation, OAuth restrictions, or security verification that may not work through a browser proxy. Distinguish an upstream restriction from a Nyx regression.
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
