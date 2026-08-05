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

This branch (`agent/owner-dashboard-ip-bans`) is based on `main`, not `agent/pirate-cove`. The two branches are independent; merging one does not require the other.

## Current Git and Release State

- Repository: `https://github.com/dubcatalt2-lab/Nyx.git`
- Active branch: `agent/owner-dashboard-ip-bans` (based on `main`)
- `main` / `origin/main`: unchanged base for this branch
- A separate branch `agent/pirate-cove` backs draft PR #34 (Pirate Cove game library redesign) and is not part of this change set
- Production URL: `https://nyxlearning.org`
- Netlify project URL: `https://nyxlearning.netlify.app`
- Netlify site ID: `c3ee107b-3703-489c-9793-6a8eb598e186`
- Production Wisp: `wss://nyx-temporary-production.up.railway.app/wisp/`

## This Change Set: Owner Dashboard IP Bans + Redesign

- `server.js`:
  - Persistent exact IPv4/IPv6 ban list in Firestore collection `nyxIpBans`
  - Application/function request guard checked before routes run; cached up to 30 seconds, invalidated on local change; fails open if Firebase is unavailable
  - Owner, Co-owner, and Admin roles get the `network:bans` permission
  - Owner Dashboard API endpoints to list/create/delete IP bans
  - Authenticated activity heartbeat and session-start events record `lastSeenIp` and `lastSeenIpAt` in `nyxUserAdministration`
  - User drawer exposes last-seen IP only to authorized staff managing that target
  - "Disable + block IP" disables the Firebase account, revokes sessions, and creates/updates the IP ban
- `js/owner-dashboard.js`:
  - IP bans button beside Export page
  - User drawer shows last-seen IP and the combined disable+block action when available
  - Fixed two double-encoded UTF-8 strings (mojibake middle dot and ellipsis) in the access-copy and loading-state text
- `netlify/functions/api.mjs` defaults `NYX_TRUST_PROXY=true` for serverless handling
- `firestore.rules` blocks direct client access to `nyxIpBans`
- `css/owner-dashboard.css` and `css/owner-dashboard-polish.css`: premium visual redesign of the Owner Dashboard — bolder Outfit/Inter typography, glass-panel metric and workspace cards, refined shadows/spacing, subtle entrance and hover motion (respects `prefers-reduced-motion`), and polish coverage extended to the new IP-ban drawer, confirm dialog, and toasts. No functional/markup changes; CSS-only.
- `styles.css`, `index.html`: cache-busting version bumps for the changed CSS/JS assets
- `docs/IP_BANS.md`: Cloudflare IP-list + WAF runbook for blocking the full `nyxlearning.org` site at the edge (Nyx does not store a Cloudflare API token or automate this)

## Durable Product Instructions

- Preserve functionality before changing presentation.
- A user's IP appears only after future authenticated activity; there is no historical backfill.
- The Owner Dashboard ban list protects Nyx server/function traffic only. A matching Cloudflare IP List (`nyx_ip_bans`) and WAF rule (`ip.src in $nyx_ip_bans` → Block) are required to block the full site at the edge; see `docs/IP_BANS.md`.
- Railway's direct Wisp endpoint is outside Cloudflare and needs a separate Railway-side policy if direct abuse becomes a concern.
- Do not store a Cloudflare API token in this repository.
- Firestore rules are a separate deployment from Netlify: `firebase deploy --only firestore:rules`.

## Build, Test, and Run Commands

```powershell
npm ci
npm start
```

```text
http://localhost:8080
http://localhost:8080/healthz
```

```powershell
npm run dev:accounts
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

## Validation Expectations

1. `git diff --check`
2. `node --check` on changed JavaScript
3. `npm run build:netlify`
4. `npm run check:deploy`
5. For local account testing, `npm run dev:accounts`, then hard-refresh localhost (service workers can serve stale cached assets)

## Handoff Update Checklist

- Replace the active branch, commit, PR, and deploy ID rather than accumulating stale release entries.
- Never record secret values.
- Commit the handoff with the code change that made it necessary when practical.
