# Nyx Project State

Last repository review: 2026-08-17

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
- Latest application release: commit `e486ba3` on `agent/pirate-cove`, deployed to OVH and production-verified on 2026-08-17. The minimalist homepage uses a slim black taskbar, centered search/shortcuts, the complete jet-black Apps catalog, a horizontal Time/Weather/Session dashboard, an interactive 3D-dot background, and a Nocturne-style particle **NYX** wordmark whose sampled dots repel from the pointer and return to the title. Browser content retains the Mizu-style tab drawer and direct developer-console shortcut, while Nyx AI exposes Low/Medium/High reasoning effort.
- The same release includes Nocturne-style settings categories and verified-email cloud saves. Cloud saves retain a vetted set of Nyx preferences and same-origin game local-storage changes per user/game; cross-origin games remain local-only because their storage is not safely readable by Nyx. Email-backed accounts show a persistent resend/check-verification gate until Firebase confirms their email; username-only accounts remain supported without cloud-save eligibility.
- Each release can present a versioned update log once per local device or signed-in account after startup/required gates are clear. It is client-side only and must not be used for sensitive information or server-side account state.
- The protected untracked local work directories listed below remain present and untouched.
- `main` / `origin/main`: `0a654cc1c3e17faff12424ae1f2a1a4eb63f6a90`
- Draft PR: `https://github.com/dubcatalt2-lab/Nyx/pull/34`
- PR title: **Ship Pirate Cove, account controls, Link Checker, custom domains, and Nyx Chat**
- Production URL: `https://nyxlearning.org`
- Production alias: `https://networkforteachers.netw.ar` (FreeDNS A record to the OVH VPS)
- Production host: OVHcloud VPS `15.204.93.166`, behind Cloudflare
- Production Wisp: `wss://nyxlearning.org/wisp/` (embedded)
- Rollback Wisp: `wss://nyx-temporary-production.up.railway.app/wisp/`

The following working-tree entries were deliberately left untracked and must not be staged, removed, or treated as Nyx release files without explicit instruction:

- `.codex-artifacts/`
- `.worktrees/`
- `wisp-test/` — a separate test project, not the Nyx application

## Current Production Verification

The OVHcloud cutover was completed on 2026-08-08 and migrated from Nginx/Certbot to Caddy on 2026-08-08. Cloudflare uses Full (strict), Caddy and Nyx are enabled at boot, Nginx is inactive and disabled, SSH uses key-only login, and Netlify is no longer an active deployment target. The earlier smartwatch, game-performance, Pirate Cove, and Owner Dashboard IP-ban checks remain part of the release baseline:

- `/assets/games/index.html`: HTTP 200 and contains **Pirate Cove**
- `/assets/backgrounds/pirate-cove.gif`: HTTP 200 with `image/gif`
- `/healthz`: HTTP 200 JSON with `"wisp":"embedded"` on both apex and `www`
- 2026-08-13 media discovery release: OVH fast-forwarded to `8d957dc`; production Chromium at 800x600 rendered 7 real Nyxify popular tracks and 7 artist entries, played **Someone Like You** through the same-origin relay at ready state 4, loaded 18 official NyxTube popular-feed results, and selected `www.youtube.com/embed` under a ChromeOS user agent. The apex, `www`, and FreeDNS alias health routes returned HTTP 200, the new versioned media assets returned HTTP 200, and `nyx`, `caddy`, and `coturn` were active.
- 2026-08-13 NyxTube retirement and Nyxify artwork release: OVH fast-forwarded to `6055d1a`; `/api/nyxtube/status` returned HTTP 410 and `/apps/nyxtube/` redirected home. The live Nyxify document references the existing Spotify-style icon, catalog search returns a same-origin `/api/music/artwork/:assetId` URL, and a real artwork request returned HTTP 200 with `image/jpeg`. Public health reported embedded Wisp, while `nyx`, `caddy`, and `coturn` were active.
- 2026-08-14 Nyxify media latency release: OVH fast-forwarded to `e933c09`; production timing confirmed 0.17-0.24-second warmed covers, a 3.3-second first 256 KB audio range, and a 0.48-second reused range. A live 800x600 ChromeOS Chromium run loaded all seven discovery covers, started playback in 2.02 seconds at ready state 4, produced no browser errors, and had no horizontal overflow. Public health reported embedded Wisp, while `nyx`, `caddy`, and `coturn` were active.
- 2026-08-14 Nyxify instant-playback and mix-art release: OVH fast-forwarded to `8076435`; all seven generated mix queries returned a leading track with validated same-origin JPEG artwork, the versioned Nyxify assets returned HTTP 200, and the live discovery track returned its first 256 KB in 0.27 seconds plus the full cached 512 KB prefix in 0.22 seconds. Public health reported embedded Wisp and Socket.IO chat, while `nyx`, `caddy`, and `coturn` were active.
- 2026-08-14 private-tab, Movies, and AI release: OVH fast-forwarded through `35fd455` to `678bb01`; the apex, `www`, and FreeDNS alias health routes returned HTTP 200, the KaTeX runtime and theatre-mask icon returned HTTP 200, and the live AI catalog returned 23 models authorized by the configured key. Production Chromium rendered the exact reported LaTeX/TSV sample as nine KaTeX nodes and one table with no raw delimiters, horizontal overflow, or browser errors. The VPS reported `nyx`, `caddy`, and `coturn` active with no recent error-level Nyx journal entries.
- 2026-08-14 rose-bloom and AI profile-name release: OVH fast-forwarded to `3646da8`; the apex, AI page, cache-versioned profile assets, and new individual rose SVG returned HTTP 200. Production Chromium observed zero blooms at profile mount, six staggered blooms opening midway, and all eight complete at the end with no 440-pixel viewport overflow; the AI profile control rendered the formatted Japanese display name with no visible `&` codes and the correct visible-character fallback initial. Public health reported embedded Wisp and Socket.IO Chat, while `nyx`, `caddy`, and `coturn` were active with no recent error-level Nyx journal entries.
- 2026-08-14 Nyxify Popular Tracks removal: OVH fast-forwarded to `5f38431`; the live v7 page and client bundle contain no Popular Tracks markup, controls, discovery state, or `global hits` request. Production Chromium at 800x600 rendered the remaining mix/search/player interface with no browser errors or horizontal overflow and made only the seven existing mix-art queries. Public health reported embedded Wisp and Socket.IO Chat, while `nyx`, `caddy`, and `coturn` were active with no recent error-level Nyx journal entries.
- 2026-08-15 StudyHub tab-identity release: OVH fast-forwarded to `1ea644e`; production Chromium observed the StudyHub title and dedicated SVG favicon both immediately and after the 3.5-second startup transition, with the startup iframe removed normally and no browser errors. The favicon returned HTTP 200 as `image/svg+xml`, public health reported embedded Wisp and Socket.IO Chat, and `nyx`, `caddy`, and `coturn` were active with no recent error-level Nyx journal entries.
- 2026-08-15 Nyx search-discovery release: OVH fast-forwarded to `42aa867`; the homepage, `/about-nyx.html`, `/robots.txt`, and `/sitemap.xml` returned HTTP 200 through Cloudflare with the expected canonical identity and crawler content. Production mobile Chromium rendered the public About page without horizontal overflow, retained the StudyHub tab title before and after startup, parsed **Nyx Learning** with the Nyx/StudyHub/domain alternate names, and reported no browser errors. Public health reported embedded Wisp and Socket.IO Chat, while `nyx`, `caddy`, and `coturn` were active with no recent error-level Nyx journal entries.
- 2026-08-15 personal-key AI workspace release: OVH fast-forwarded through `972eb9c` to `ffeb82f`; malformed personal credentials returned HTTP 400 without falling back to the shared key, and the shared catalog returned DeepSeek V4 Flash plus Claude Opus 4.8 after per-key verification. Production Chromium at 1280 and 390 pixels rendered chat search, response-depth controls, the personal-key dialog, current model, and usage controls without browser errors or horizontal overflow. Public health reported embedded Wisp and Socket.IO Chat, while `nyx`, `caddy`, and `coturn` were active with no recent error-level Nyx journal entries.
- 2026-08-15 multiple-owner hierarchy release: OVH fast-forwarded to `8ce116b`; the local authorization matrix verified that only the configured Founder can assign Owner, manage a secondary Owner, or cross the Owner search-history boundary. Secondary Owners cannot manage the Founder or a peer Owner and cannot open founder-only custom-role/profile controls. The public cache-versioned Owner Dashboard and shell assets returned HTTP 200, public and local health reported embedded Wisp plus Socket.IO Chat, and `nyx`, `caddy`, and `coturn` were active.
- 2026-08-17 minimalist-browser and particle-wordmark release: OVH fast-forwarded to `e486ba3`, rebuilt the VPS bundle, passed deployment and branding checks, restarted Nyx, validated Caddy, and returned a successful local health check. Local Chromium rendered the sampled **NYX** title particles and interactive homepage dot field, while the production bundle exposed the title particle canvas and repel-and-return behavior. Public health reported embedded Wisp and Socket.IO Chat.
- 2026-08-13 browser-shell/custom-role release: OVH fast-forwarded to `cb1a04d`; the apex and `www` health routes returned HTTP 200, the cache-versioned shell-history and custom-role assets returned HTTP 200, and `nyx`, `caddy`, and `coturn` were active. A local browser regression run verified Chat remained open while the new search-result tab became active, then one Back action restored the Nyx new-tab surface without an unidentified proxy route.
- 2026-08-13 Tide privacy release: OVH fast-forwarded to `1b88728`; local projection assertions verified Owner/Tide/other-viewer behavior, the public health route returned HTTP 200 with embedded Wisp and Socket.IO, the `20260813-private-tide-v35` shell asset returned HTTP 200, and `nyx`, `caddy`, and `coturn` were active.
- 2026-08-13 Owner Dashboard controls release: OVH fast-forwarded to `14408e6`; role rows fit without overflow at 700, 515, 360, and 300 pixels, authorization assertions covered built-in and custom moderator access while preserving Tide privacy, the public dashboard JS/CSS assets returned HTTP 200 with the new capability/container logic, and `nyx`, `caddy`, and `coturn` were active.
- 2026-08-13 custom-role control and Tide-ID correction: OVH fast-forwarded to `fe560e8`; projection assertions verified Owner/Tide/other-viewer behavior for the live `tide-stressed` ID, the cache-versioned Owner Dashboard JS/CSS assets and public health route returned HTTP 200 through Cloudflare, and `nyx`, `caddy`, and `coturn` were active.
- 2026-08-13 Chat commands, screen sharing, and rose-frame release: OVH fast-forwarded to `51c884d`; all 50 new command handlers passed browser execution and autocomplete coverage, a real browser WebRTC video-track negotiation/removal test passed, and the apex, `www`, and FreeDNS alias health routes plus the cache-versioned Chat JS/CSS and rose SVG assets returned HTTP 200. The live Chat bundle contains the command registry, screen-share capture path, and generated-message limit guard; `nyx`, `caddy`, and `coturn` were active.
- 2026-08-13 profile-decoration visibility correction: OVH fast-forwarded to `6e4fa9a`; a real Chromium render confirmed the rose frame and candle decoration paint above the profile body, including the static completed-bloom fallback under Lag Reducer. The apex and FreeDNS alias health routes, homepage, and cache-versioned `styles.css?v=20260813-rose-frame-v105` returned HTTP 200 with the new layer and fallback rules; `nyx`, `caddy`, and `coturn` were active.
- 2026-08-10 realtime/latency verification: `/healthz` reports `"chatRealtime":"socket.io"`; apex, `www`, the FreeDNS alias, homepage, auth config, Chat, Link Checker, and the Socket.IO client asset returned HTTP 200 with measured public TTFB between 0.13 and 0.34 seconds after the IP-ban cache was made non-blocking. Authenticated Socket.IO handshakes correctly reject invalid sessions over both WebSocket and HTTP polling.
- coturn is enabled on OVH with short-lived credentials generated by Nyx, listens on TCP/UDP 3478 with bounded UDP relay ports, and TCP 3478 was reachable from outside the VPS. The shared TURN secret remains only in `/etc/nyx/nyx.env`.
- `/catclass-games`: HTTP 200 JSON
- `/api/owner-dashboard/ip-bans`: HTTP 401 when unauthenticated, confirming the route and function bundle are live
- `/apps/link-checker/`: HTTP 200 with the Nocturne-inspired dashboard, sidebar, matching vector action icons, in-app tab-closing **Back to Nyx** action, and FreeDNS Scraper UI
- `/apps/chat/`: account-only Nyx community chat with staff-managed text/voice channels, private DMs, attachments, reactions, mentions, responsive channel/member drawers, member presence, unread markers, message pagination, and author/moderator deletion
- Link Checker God Domains and unresolved-result retry asset version `20260808-double-check-v12` is the current release candidate, and unauthenticated `/api/link-checker/full-scan/status` requests return HTTP 401
- The OVH-only Nocturne account credentials successfully authenticated and read `/api/vendors/status` without exposing credentials or starting a scan
- `/api/link-checker/freedns-registry?page=1`: HTTP 200 with 100 parsed registry entries; FreeDNS reported 21,163 entries across 212 pages at verification time
- `/api/link-checker/vendors`: HTTP 200 with 18 vendors
- `/api/link-checker/check`: `example.com` returned HTTP 200 with 18 vendor results and the configured paid plan, confirming the server-only OVH key is active
- Firebase sign-in, Owner Dashboard user listing, IP-ban listing, Nyx AI, Bunny link-generator access, Pirate Cove, and a proxied page through embedded Wisp were verified after the cutover
- FreeDNS inline vendor check: the production UI kept `example.com` in the scraper table and rendered all 18 vendor shields after the row refresh action (10 allowed, 2 blocked, 3 unknown, and 3 errors at verification time) with no horizontal overflow
- FreeDNS custom hostname: `networkforteachers.netw.ar` resolves to the OVH IPv4 address, is approved in `nyxCustomHostnames`, receives an automatic Caddy certificate, returns HTTP 200, and opens same-origin Wisp
- Self-service custom domains are live at `/connect-domain`: anyone can point an A/AAAA hostname directly to `NYX_CUSTOM_HOST_IPS` and open it; the first HTTPS visit is authorized automatically without submitting the hostname or waiting for owner approval. The connection form remains an optional preflight that stores verified hostnames in server-only `nyxCustomHostnames`. Caddy authorization is loopback-only, preserves explicit disabled records, shares concurrent DNS checks, and uses a bounded five-minute positive/30-second negative cache.
- Owner Dashboard redesign assets: cache-versioned stylesheet and script returned through the production homepage; desktop, 390x844, and 320x320 local interaction checks showed no horizontal overflow
- Active visitors without an account use the username saved in their local Nyx startup wizard and appear in the Owner Dashboard as **Guest / No account** rows with limited session details and no account-management controls. A browser that skipped the name receives a deterministic random Nyx guest name instead. Authenticated presence heartbeats carry a verified Firebase token so signed-in browsers are excluded from the guest list instead of appearing twice. Guest identities do not add IP collection and expire with the existing 45-second presence window.
- New Nyx registrations that include a deliverable email automatically request Firebase's verification email after the account signs in. Username-only accounts remain supported and do not receive email. The verification action returns to the canonical `NYX_PUBLIC_ORIGIN`; that hostname must remain in Firebase Authentication's authorized-domain list, while the sender/action-link domain is configured and DNS-verified from Firebase Authentication email templates.
- YouTube top-level navigation is normalized to English and seeds YouTube's `PREF` locale cookie inside either proxy engine. Both Ultraviolet and Scramjet use Epoxy for YouTube's streaming media even when another transport is selected for ordinary browsing, cap the proxied player at 480p for stability, and pause media in inactive Nyx tabs. The proxy-engine choice remains unchanged.
- TikTok must use Ultraviolet even when Scramjet is the saved browser engine. TikTok's current router turns its Scramjet location into `/undefined` and then serves its own 404 page; the scoped UV compatibility choice preserves the user's saved engine for every other site.
- **Amazing Strange Rope Police**: transformed Unity loader uses the guarded worker callback through Ultraviolet; the selected Scramjet path loads the 66 MB legacy Unity data archive, creates its canvas, and shows no callback or DataView error through a 90-second production regression run
- Homepage cursor effects: the background dots repel, fade, and return along the pointer path; the **NYX** title is independently rasterized into sampled dots that repel from the pointer, fade at large displacement, and spring back into the wordmark. Reduced-motion and minimum-performance modes keep the accessible text fallback instead.
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
- `apps/chat/`: account-only community chat client and responsive Discord-inspired presentation
- `apps/nyxify/`: music search, playback, queue, liked/recent tracks, and device-local playlists
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
- Searches submitted while the preserved Chat app tab is active open in a separate browser tab and select that result tab immediately, leaving Chat connected in the background.
- Browser-shell history records Scramjet URL changes as source URLs. Back/Forward restore those source entries, while a tab's initial blank entry returns to the Nyx new-tab surface instead of being sent through a proxy engine.
- Profile customization, animated avatars and banners, decorations, effects, badges, roles, status, and profile directory
- Settings and onboarding
- AI workspace, model selection, conversations, temporary chats, image attachments, and API integration
- Owner Dashboard, role permissions, subscriptions, premium access, profiles, activity, and audit records
- Account-only community chat channels, voice rooms, message history, online member presentation, unread state, send limits, and author/moderator deletion
- Shared homepage/guest presence is kept in the active OVH Node process, including the stable guest label and authenticated account UID when a valid bearer token is present; it does not consume Firestore reads or writes
- Signed-in activity heartbeats run every five minutes while visible; they refresh activity state, but rewrite the administration IP only when it changes or its recorded timestamp is at least 24 hours old
- About Nyx and its user-directed changelog
- Pirate Cove search, sorting, pagination, remote catalogs, fallbacks, and full-screen player
- Single-file export/download behavior
- Nyxify search/playback through optional official SoundCloud and the public Meting-compatible fallback, including its fixed-host CDN selection, bounded redirect/cover caches, and startup discovery prewarm

Nyx AI obtains its selectable catalog from the provider without exposing the server key. Nocturne's `/api/ai/config` catalog is session-based and returns only the anonymous model to API-key requests, so Nyx validates its known and explicitly configured candidate IDs with no-prompt authorization checks and caches the verified result for one hour. Those checks do not generate a completion or consume model output tokens. `NYX_AI_MODEL_IDS` may add newly issued provider model IDs to the candidate set without a code release. Do not restore unavailable models merely because they remain in an old static list. Assistant replies render Markdown tables, tab-separated tables, and standard `\(...\)` / `\[...\]` LaTeX with the locally served KaTeX runtime so managed devices do not depend on a third-party CDN.

Users may optionally supply a personal Nocturne AI API key through the key control in the Nyx AI header. Personal keys stay in browser session storage by default, or local storage only after the user explicitly selects **Remember on this device**; they are never written to Firebase, source, server logs, or an API response. The browser sends the key only to Nyx's same-origin AI routes, the server uses it for that request, and verified model caches are isolated by a one-way credential digest. Removing it returns that browser to Nyx's shared server key. An invalid personal key must never silently fall back to the shared credential.

Claude Opus 4.8 is withheld from the model catalog and rejected server-side unless the request carries a valid active Premium account token; this remains true when the browser supplies a personal AI key. Premium accounts receive a Firestore-backed 2,000 generated-token allowance per UTC day. The configured Owner role can use every provider-available model, including Opus, without that daily cap. Keep this entitlement and reservation logic server-side; the client picker is only a convenience layer.

The AI workspace includes local chat search, Off/Normal/Extended response-depth controls, the current model summary, and per-browser estimated token/response totals. Response depth is validated server-side and maps to Nocturne's native `level` and `reasoning_effort` fields plus bounded output guidance; it does not reveal private chain-of-thought. Usage totals are approximate character-based estimates kept only in browser storage because Nocturne's streaming response does not expose authoritative billing usage. Nocturne does not publish a complete API-key model-list endpoint, so the per-key catalog is the intersection of Nyx's current candidate IDs and no-prompt authorization probes; keep current Claude candidates in that verified set rather than exposing them unconditionally.

## Durable Product Instructions

- Preserve functionality before changing presentation.
- Diagnose the actual cause of a regression; do not keep stacking speculative CSS, proxy overrides, cache resets, or host-specific fixes.
- The user's explicit proxy engine and transport choice should remain authoritative. Do not silently force a different engine for a site unless the user asks for that policy. YouTube is the one documented transport exception: either selected engine uses Epoxy for stable streamed playback, while the saved general transport remains unchanged.
- Scramjet controller frames are tied to a particular service-worker instance. After registering or updating that worker, wait for the requested version to become active and reconnect the existing controller's message port to that exact worker before routing a frame; checking only that any older worker is active recreates the **Scramjet route missed** race.
- External browser tabs use private, per-tab proxy cookie sessions. Scramjet creates a separate controller and in-memory cookie jar for each Nyx tab, scopes service-worker cookie synchronization to that controller, disables saved-cookie persistence, and clears the jar when the tab or browser window closes. Ultraviolet encodes a random tab session in the `/service/` path, stores cookies in a separate IndexedDB database for that session, and clears its cookie store on tab or page close. Proxied documents also deny the precise Geolocation API, and browser iframes carry a geolocation-denying Permissions Policy. This isolation does not change Nyx account/session storage, prevent a destination from inferring an approximate location from the proxy/VPS egress IP, or provide VPN-level anonymity; an abrupt browser/process crash can also prevent best-effort close cleanup, although the random abandoned session is not reused.
- Smartwatch-specific layout is limited to viewports no larger than 480px wide and 520px tall. It keeps Back, Reload, Home, the address field, and Menu visible; Forward, Bookmark, and Weather remain available outside that watch breakpoint.
- Dense workspaces must account for ChromeOS display scaling: Link Checker and Nyx AI collapse their desktop sidebars at 1100px so filters, model controls, tables, and dropdowns retain the full content width. Larger laptop and desktop viewports keep the persistent sidebars. The main browser shell also has a viewport-driven short-laptop layout for 481-1100px-wide screens at 650px height or less; it compacts the homepage, account menu, weather report, and settings controls without changing the separate watch layout.
- When Link Checker or Nyx Chat runs inside a Nyx tab, it obtains a fresh Firebase ID token from the authenticated same-origin parent through the narrowly scoped `nyx:account-token-request` bridge. The parent validates the requesting tab as the exact `/apps/link-checker/` or `/apps/chat/` path before replying. This avoids loading a second Firebase copy from Google's CDN, which managed Chromebooks can replace with an HTML block page. Direct standalone app pages retain the Firebase module fallback.
- Nyx Chat uses the same narrowly scoped parent token bridge, with the parent accepting only the exact `/apps/chat/` and `/apps/link-checker/` paths. Chat is unavailable to guests. Staff-managed community channels and two-participant private DMs read and write through authenticated `/api/chat/*` routes; direct browser access to `nyxChatChannels`, `nyxChatConversations`, `nyxChatAttachments`, `nyxCaffeineGifts`, `nyxChatConfiguration`, and `nyxChatMutes` remains denied by Firestore rules. Owner, Co-owner, Admin, and Manager roles can create, rename, remove, and apply minimum-role restrictions to text or voice channels through the server API; at least one channel of each kind is retained. The default **Staff Room** requires Moderator or above, and server-side scope checks protect its messages, attachments, activity, presence, and voice signaling. Private-message APIs and attachment downloads verify that the requester is a conversation participant, and public-channel moderator powers do not grant access to private DMs. Scope resolution must test explicit channel and conversation identifiers without allowing an absent channel to default to `general`; this keeps DM reads, sends, reactions, deletes, and attachment authorization isolated from public chat. Messages support plain text up to 1,000 characters, up to three allowlisted 8 MB attachments with an 8 MB combined limit for every role, and the fixed reaction palette. Allowlisted attachments include the existing image, PDF, text, and Office formats plus common MP3/M4A/OGG/WAV/WebM audio and MP4/MOV/OGG/WebM video; media renders with authenticated in-chat controls and unsafe active web/executable formats remain blocked. New attachments upload in bounded Firestore chunks and are served only through authenticated routes, and files or images pasted into the composer with Ctrl+V follow the same validation. Historical streamed Owner attachments remain readable and deletable, but the large-upload endpoints reject every new file above 8 MB. Authors can delete their own messages, while Moderator-or-higher roles can remove others' public-channel messages. Right-clicking a message opens a Nyx-styled context menu for Reply, the fixed quick-reaction palette, Copy text, Copy message ID, and Delete when the same author/moderator rule allows it. Member mentions and slash commands autocomplete in the composer; applicable commands include private-message, Caffeine gift, voice controls, channel lock/unlock, account disable/IP-ban/re-enable, timed chat mute/unmute, presence/ping, and harmless text transforms. `/mute @person` asks for a duration from one minute through four weeks and a required reason; the server persists and enforces that mute across public channels and DMs, prevents self/peer/higher-rank moderation, and records mute/unmute audit events. Nyx may persist multiple Owner roles, but the configured Founder Owner remains the sole hierarchy override: only the Founder can promote or demote secondary Owners, moderate another Owner, manage custom roles, or publish the Founder profile, and no account can target the configured Founder itself. Secondary Owners retain normal Owner operational permissions but cannot manage the Founder or a peer Owner. Microphone commands remain separate as `/micmute` and `/micunmute`. Privileged slash commands reuse authenticated server APIs, so client-side menu visibility is never the authorization boundary. Only Moderator-or-higher roles may send `@everyone`. On the active OVH server, Firebase-authenticated Socket.IO rooms deliver persisted messages, DMs, reactions, deletes, presence, Caffeine, membership, and channel changes immediately to authorized viewers without a Firestore query per connected browser. The in-memory revision feed remains as a once-per-minute consistency fallback while sockets are healthy and resumes its faster recovery cycle if the socket cannot connect. Member/channel data use bounded ten-minute server caches and identities use a bounded fifteen-minute cache, while a ten-minute bootstrap refresh preserves eventual consistency; administrative/profile writes invalidate those caches immediately. Every new incoming channel message or DM sends one narrowly validated same-origin notification to the parent Nyx tab, excluding the viewer's own posts and deduplicating Socket.IO/polling delivery. The parent plays the louder two-tone ping after browser audio is unlocked and displays a red unread dot until that tab is activated; standalone Chat retains the same local sound. Clicking a chat member asks the same-origin Nyx parent to open that account in the existing full public-profile viewer.
- Chat member lists are grouped by canonical Nyx role rank (Owner through Member); each role group places online accounts before offline accounts, then sorts by display name. Every non-Member role name uses its canonical role-color pair for the same layered glow/highlight treatment everywhere Chat renders that identity; Member names stay neutral, and this visual treatment never replaces server-side role authorization. Moderator-or-higher roles can open **Search history** from the member sidebar or use the shield beside an account in Owner Dashboard to review that account's retained searches. Every explicit search made through Nyx while an account is signed in is sent to the authenticated server route and retained in `nyxSearchHistory` for 30 days; recording waits for Firebase's persisted account restoration, retries once after an expired-token rejection, and the first confirmed write on a browser displays a disclosure toast. The conservative classifier remains as a server-generated label so policy-matching searches are highlighted, but normal searches are retained too. Records contain the search text, classification, account identity, role, and timestamp; they do not contain IP addresses, destination URLs, clicked results, or search-engine metadata. Direct Firestore access is denied, and results are exposed only through the authenticated Moderator-or-higher API. The configured Founder can review all retained searches, while every non-founder reviewer receives a server-filtered result that excludes other Owner accounts; a secondary Owner may still review their own history. The dashboard also hides Owner shields from staff who cannot manage that account. Legacy flagged-search API paths remain aliases during the cached-client transition.
- The Chat slash-command registry contains 80 commands: the existing messaging, voice, Caffeine, information, and server-authorized staff actions plus 50 member-safe utilities for text formatting, encoding, random choices, calculations, timers, dates/time zones, channel/member summaries, status messages, and welcomes. Commands remain discoverable through `/help` and composer autocomplete; generated messages are subject to the same 1,000-character ceiling as manually typed messages.
- **Caffeine** is the chat-facing name for the existing Nyx Premium entitlement. Owner and Co-owner roles always receive Caffeine and may create unlimited distinct gifts; directly assigned Premium or Trial accounts may send one Caffeine gift for the current subscription grant. The recipient sees an in-chat acceptance prompt; accepting atomically marks that individual gift accepted and grants the existing Premium subscription status. Gift-derived Premium cannot be gifted again, an active recipient cannot accept another gift, pending gifts expire after seven days, and Owner Dashboard subscription assignments rotate a normal subscription gift grant only when beginning a new Premium period rather than on every save. An unlimited role gift is valid only while its sender remains Owner or Co-owner. There is no separate payment processor or checkout record in this repository, so “purchased” currently means Premium or Trial assigned through the existing administration flow.
- Nyx Chat voice rooms are account-only and use the server-managed voice-channel list, initially **Lounge**, **Gaming**, and **Study Room**. Audio and optional screen-share video travel between browsers with WebRTC and are never recorded or stored by Nyx; the persistent OVH Node process keeps only authenticated room presence and 60-second offer/answer/ICE signaling in memory. Screen sharing is available only after joining voice, uses the browser's native display picker, has an explicit start/stop control, and automatically cleans up when the browser ends capture or the user leaves voice. Authenticated Socket.IO delivers voice membership changes and offer/answer/ICE signals immediately, while the voice-state route polls only as recovery. Explicit leave/disconnect ends an active call; a 24-hour stale-presence cleanup only removes callers whose browser disappeared without sending leave. Each room is limited to eight participants to bound browser CPU/network use. The client provides join/leave, microphone mute, deafen, screen sharing, live participant lists, and profile handoff. Voice capture uses echo cancellation, noise suppression, and microphone automatic gain control; received audio uses gain plus compression, prefers Opus with in-band FEC and DTX disabled, requests a modest receive jitter buffer, prioritizes the audio sender, and restarts ICE after sustained disconnection. Nyx's internal tab switcher must leave Chat audio running instead of pausing its media elements. Public STUN remains the fallback. When `NYX_TURN_URLS` and the server-only `NYX_TURN_SHARED_SECRET` are configured, the voice-state API adds short-lived HMAC TURN credentials and coturn relays otherwise unreachable media; never expose the shared secret to a browser or commit it. The in-memory Socket.IO/signaling layer is intentionally designed for the active single-instance OVH deployment rather than multi-instance hosting.
- The StudyHub startup cover has a 3.5-second minimum/automatic lifetime and then uses its existing 350 ms fade/removal path. Completing its math interaction early no longer removes the cover before the 3.5-second mark.
- Public search discovery uses the canonical `nyxlearning.org` homepage, a crawlable `/about-nyx.html` identity page, `robots.txt`, `sitemap.xml`, and schema.org `WebSite`/`Organization` metadata. The browser tab remains StudyHub, while search-facing metadata consistently identifies the product as **Nyx Learning** with **Nyx**, **StudyHub**, and **nyxlearning.org** as alternate names. Google Search Console verification, sitemap submission, and indexing requests are external release steps; indexing is not automatic or guaranteed.
- Scramjet requires browser Service Worker support. When the selected browser cannot provide it, keep the saved engine unchanged and offer the user a per-tab **Try direct mode** action; direct mode still depends on the destination allowing iframe embedding.
- Keep the Developer Console implemented with Eruda unless the user explicitly requests otherwise.
- Link Checker vendor scans go through Nyx's same-origin `/api/link-checker/*` server bridge to `lc.nocturne.lol`. Individual checks prefer the paid Nocturne account session and fall back to `NYX_LINK_CHECKER_API_KEY` only when account credentials are not configured. Fast page and full-registry scans require `NYX_LINK_CHECKER_ACCOUNT_USERNAME` and `NYX_LINK_CHECKER_ACCOUNT_PASSWORD`; Nyx keeps the resulting session cookie only in server memory and automatically signs in again after rejection or restart. Starting a full scan returns as soon as Nocturne accepts the job instead of waiting on a second provider status request, and the browser automatically retries transient provider timeouts, overload responses, and rate limits while the user keeps the scan active. Never put any of these values in client code, tracked files, documentation, logs, or commits.
- Link Generator obtains its selectable vendor list and performs its post-generation vendor check through Nyx's same-origin Link Checker bridge. It must not call a legacy third-party filter endpoint directly from the browser. The vendor list may contain string keys or keyed objects, and the client normalizes both shapes before populating the selector.
- NyxTube is retired. It must not appear in default or saved internal home shortcuts, the Apps list, deployment-required files, environment templates, or active catalog APIs. Old `/apps/nyxtube/` requests redirect home and old `/api/nyxtube/*` requests return `410` so stale browser state fails cleanly.
- Nyxify is a distinct music workspace at `/apps/nyxify/`. Its discovery home uses real provider search results for popular-track and artist shelves plus clearly labeled Nyx-generated mixes; each generated mix uses the leading search result's real same-origin artwork instead of an unrelated decorative cover. It must remain branded as Nyxify rather than copying Spotify or Echo branding/assets. When both `NYX_SOUNDCLOUD_CLIENT_ID` and `NYX_SOUNDCLOUD_CLIENT_SECRET` are configured, the server exchanges them for a cached short-lived token, searches only playable public SoundCloud tracks, preserves required uploader/source attribution, and relays a validated numeric track through `/api/music/soundcloud/:trackId`. Missing credentials, empty SoundCloud results, or a temporary SoundCloud API failure fall back to the public Meting-compatible catalog and `/api/music/stream/:trackId`. Both audio relays are fixed-target and must never accept caller-supplied upstream URLs. Meting cover art uses `/api/music/artwork/:assetId`, which reconstructs the provider request from a numeric ID and validates redirects, image MIME type, size, and timeouts so managed devices remain same-origin. The server also keeps a bounded 512 KB leading audio range for each startup discovery track so first playback begins without another cold provider round trip; requests beyond that prefix continue through the validated range relay. Playback queue, shuffle/repeat state, recent history, liked songs, and playlists remain device-local.
- The Apps workspace exposes **Movies** as the primary movie entry, opening `https://aether.cx/` with Nyx's theatre-mask icon. Do not restore Cineby as the primary movie tile unless the user requests that provider change.
- The Netlify build uses Terser to mangle private identifiers in Nyx's first-party browser and service-worker runtimes. Repository sources remain readable, user-facing labels and storage/message values remain unchanged, and required public contracts such as `__uv$config`, `__NYX_RUNTIME_CONFIG__`, service-worker routes, and third-party runtime APIs must never be property-mangled or renamed.
- Nyx presents the non-account Link Checker workspace in a Nocturne-inspired sidebar and table layout, with a local dashboard, single all-vendor or selected-vendor checks, device-local history, filters, CSV/JSON exports, preferences, vendor reports, and public RDAP registration details. Its **Back to Nyx** action closes the containing Nyx browser tab when embedded and returns to `/` when opened directly. Its FreeDNS Scraper reads the public `freedns.afraid.org` registry through a fixed-target same-origin route and stores the collected registry only in that browser, including the public owner and added-date fields. When the scraper is opened, the first 25-domain page is checked automatically if its rows have no saved verdicts; **Check this page** sends one bounded batch of up to 25 URLs to Nyx, which checks them through the paid account session with bounded server concurrency instead of starting separately rate-limited browser requests or displaying a cooldown countdown. Signed-in Premium/Trial accounts and Moderator-or-higher staff roles can run **Check all domains**; ordinary free members cannot. A full scan first imports Nocturne's existing cached `/api/domains` vendor maps in bounded parallel page batches and updates visible progress from saved verdicts, matching Nocturne's fast cached-first presentation. Nyx starts or reconnects to the account-authenticated server-side `/api/scan` job only for domains still missing results, polls `/api/vendors/status` without allowing a slow provider counter to move local progress backward, then imports refreshed results. Compact device-local verdicts are saved in 100-result checkpoints using a registry-indexed array rather than repeating every domain key; legacy object caches migrate on load. This avoids one browser `/api/check` request per domain, its 15-minute burst cooldown, and the local-storage quota failure caused by the older verbose format. The registry and verdict cache clear together after eight hours without cache activity; expiry is deferred while scraping or scanning is active, and a periodic check also releases the in-memory arrays in tabs left open. Stopping Nyx polling does not cancel the provider job; the next click reconnects and imports its results. Ordinary single checks retain Nyx's 30-per-15-minute client allowance but prefer the paid account session upstream. Each row also has an explicit refresh action, and vendor results appear as allowed, blocked, unknown, or error shields. After a result is saved and scanning is idle, the compact shield group is clickable and opens a responsive detail dialog with every vendor state, refreshed category data when available, FreeDNS metadata, and public RDAP registration fields; failure to refresh preserves the compact result display. Nocturne account, upgrade, admin, API-key-management, and scrape controls remain deliberately unexposed.
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
- Pirate Cove keeps direct third-party covers first for ordinary browsers, then retries catalog-approved CatClass/Selenite/Velara/Truffled-derived covers through the bounded same-origin `/catalog-game-cover` route when managed Chromebook filters block those image hosts. The route accepts only HTTPS hosts on the explicit cover allowlist, verifies that the exact URL exists in the current server-loaded catalog, permits only inert raster image MIME types up to 5 MB, bounds redirects and request time, and applies long-lived browser/edge caching. The 30 cards on the active page load eagerly so Chromium's embedded-frame lazy-image heuristics cannot leave most covers blank; genuinely missing upstream covers retain the initial-letter fallback.
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

- Static frontend, Express-backed HTTP routes, authenticated Socket.IO Chat, and embedded Wisp: OVHcloud VPS behind Caddy
- Public domain, edge proxy, and DNS: Cloudflare-managed `nyxlearning.org`
- Accounts and shared profile/admin data: Firebase Authentication and Firestore
- Netlify is not an active deployment target; Railway Wisp remains a legacy fallback only

The VPS serves generated `dist/` through Express on local port 8080 and exposes authenticated Socket.IO at `/socket.io/` plus embedded Wisp at `/wisp/` through Caddy. Caddy trusts forwarded client headers only from Cloudflare's published networks, then overwrites `CF-Connecting-IP` with its parsed client address before proxying. Direct FreeDNS requests therefore cannot spoof the address used by Nyx IP logging and bans.

## IP Ban Controls

- The Owner Dashboard gives Owner, Co-owner, and Admin roles an **IP bans** control. It stores exact IPv4/IPv6 addresses in the server-only `nyxIpBans` Firestore collection and records changes in `nyxAuditLog`.
- Authenticated activity heartbeats and session-start events update server-managed `lastSeenIp` and `lastSeenIpAt` fields for that account. Authorized staff can view the last observed address for accounts they can manage and use **Disable + block IP**; it disables the Firebase account, revokes sessions, and creates the IP ban. It is not a historical IP log.
- Express and Netlify-function requests are checked before routes run. The guard returns the last-known ban decision immediately, refreshes Firestore in the background at most every ten minutes, and backs off for five minutes after a failed refresh. Local additions/removals update the cache immediately. The application must fail open if Firebase is unavailable rather than turn a Firebase outage into a site outage.
- Netlify functions default `NYX_TRUST_PROXY` to `true` so the verified deployment headers can identify the source IP. A self-hosted deployment may set it only behind a proxy that overwrites client-supplied forwarding headers.
- Production static files, APIs, and Wisp upgrades pass through Express's IP-ban guard on OVH. A matching Cloudflare IP List plus WAF rule remains the earliest edge block and prevents cached responses from bypassing the origin guard. The exact runbook is `docs/IP_BANS.md`. Do not add a Cloudflare API token to Nyx merely to synchronize the two lists.
- Railway's direct Wisp endpoint is rollback-only and remains outside Cloudflare.

## Custom Roles and Profile Presentation

- The configured Founder Owner is the only account allowed to create, edit, delete, or assign custom roles and the only account allowed to assign the built-in Owner role. Definitions live in the server-only `nyxCustomRoles` Firestore collection and contain a stable ID, a display label up to 64 characters including formatting codes, color, built-in hierarchy placement, and a validated list of existing Nyx permissions. Owner Dashboard presents these definitions as a compact list and expands only the role currently being edited. The dashboard accepts either `#RRGGBB` or Minecraft `&0`–`&f` codes for the role color and normalizes them to a safe hex value. Custom roles cannot create another Owner or invent arbitrary permission names.
- Assigning a custom role retains its built-in placement in `nyxUserAdministration.role`, records the custom role ID, and remembers the prior built-in role so removal can restore it. Direct built-in role changes clear any custom assignment. Owner Dashboard and Chat show the custom label/color while security comparisons continue using the placement rank.
- Chat exposes `/roles`, Founder Owner-only `/roleadd` and `/roleremove`, plus `/userinfo`, `/avatar`, `/channelinfo`, `/poll`, and `/timestamp`. Command visibility is only a UI aid; every privileged mutation is re-authorized by the server.
- Chat expands a bounded built-in set of recognized emoji shortcodes such as `:smiley:`, `:heart:`, and `:coffee:` before sending. Unknown shortcodes remain unchanged.
- Display names and Chat message bodies may contain Minecraft-style `&` formatting codes for the 16 Bedrock colors plus magic, bold, italic, underline, strikethrough, and reset. Message formatting is rendered through safe DOM nodes and composes with clickable mentions; formatting is presentation-only, while canonical account usernames/handles remain plain and continue to control login, mentions, and uniqueness.
- Profile cosmetics are being narrowed to simple, readable motifs: a blooming rose vine around the profile edge and candlelight around the avatar. Saved IDs from both earlier generic cosmetics and the retired signature-scene collection migrate to these replacements, identity content remains unobscured, and animations become static under reduced-motion preferences.
- The compact homepage account menu intentionally suppresses profile effects and avatar decorations. It remains a clean navigation surface while full profile cards and the editor preview remain the cosmetic preview surfaces.

### OVH deployment

`DEPLOYMENT.md` and `deploy/` define the active single-OVHcloud-VPS deployment using Ubuntu 26.04, Caddy, systemd, authenticated Socket.IO Chat, and embedded Wisp. The installer builds the minified `dist/` output with a dynamic same-host Wisp URL and all large game assets, serves it through Express so the application IP-ban guard also covers static pages, validates and reloads Caddy, sanitizes forwarding headers, restricts Cloudflare visitor-IP trust to Cloudflare's published networks, and prunes build-only dependencies. `/etc/nyx/nyx.env` and the selected domain are preserved across reruns, and `deploy/update-ovh.sh` provides validated fast-forward updates. If a pull changes the updater itself, it re-executes the new copy before applying deployment steps so new systemd or storage requirements are not skipped on that release.

## Server Environment Variable Names

Production values belong in `/etc/nyx/nyx.env`, Firebase, or the relevant external service—not in Git.

Core deployment:

- `PORT`
- `WISP_URL`
- `NYX_ALLOWED_ORIGINS`
- `NYX_PUBLIC_ORIGIN`
- `NYX_TRUST_PROXY`
- `NYX_CUSTOM_HOST_IPS` (OVH/Caddy only; comma-separated public addresses accepted by self-service domain verification)
- `NYX_CHAT_ATTACHMENT_ROOT` (OVH only; retains the storage path needed to serve/delete historical streamed attachments)
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
- `NYX_AI_MODEL_IDS` (optional comma-separated candidates for providers without a key-authenticated catalog)
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
- `NYX_SOUNDCLOUD_CLIENT_ID` (optional preferred Nyxify provider)
- `NYX_SOUNDCLOUD_CLIENT_SECRET` (optional preferred Nyxify provider)

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

- The OVH Firebase Admin credential currently fails Google token exchange with `invalid_grant: account not found`, consistent with a deleted service account or a client-email/private-key mismatch. Health remains available because it does not require Firebase, but authenticated account/admin operations and the pending Midnight Owner promotion cannot be considered healthy until a newly generated service-account JSON is installed as a matching `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` pair and verified.
- Fast full-registry scans depend on valid paid Nocturne account credentials in the VPS environment and on Nocturne's server-side queue. Provider outages or account changes can delay that external job. Nyx can stop polling without canceling it and reconnect later, but imported verdicts remain device-local.
- Nyxify uses SoundCloud only when a registered official app is configured; SoundCloud authentication, off-platform playback eligibility, and provider rate limits still apply. Without it, or during a temporary provider error, Nyxify falls back to the community-operated `api.qijieya.cn` Meting service, which has no guaranteed availability or service-level agreement. The fallback resolves only validated NetEase media hosts, prefers the CDN edge verified reachable from OVH, and uses bounded caches, but a provider-wide outage can still interrupt new searches or uncached playback.
- Voice calls now use the authenticated OVH coturn relay when direct WebRTC connectivity fails. Keep TCP/UDP 3478 and UDP 49160-49260 allowed through every active host/provider firewall; browser-to-browser audio still requires an end-to-end call test between two real accounts and networks after changes to WebRTC, Caddy, or OVH networking.
- The search-history classifier is intentionally conservative and can still produce false positives or miss disguised harmful language. Its highlight is a moderation signal, not proof of wrongdoing. Search history is deliberately limited to explicit searches made through Nyx while signed in, retained for 30 days, and excludes destination URLs, clicked results, IP addresses, and search-engine metadata.
- Historical streamed Owner chat attachments remain on the VPS disk and are not copied to external object storage. New uploads are uniformly limited to 8 MB; keep `/var/lib/nyx/chat-attachments` available until every historical streamed attachment has been removed or migrated.
- Homepage guest presence and Chat's revision feed are intentionally local to the active single OVH Node process. A future multi-instance deployment must replace them with shared pub/sub or another realtime coordination layer before adding a second application instance.
- Cloudflare now routes `www.nyxlearning.org` to the OVH VPS. Caddy serves the apex, `www`, and `networkforteachers.netw.ar`; preserve the former Netlify target (`nyxlearning.netlify.app`) only as rollback information.
- Self-service custom domains intentionally accept only exact A/AAAA records resolving to `NYX_CUSTOM_HOST_IPS`. Certificate-authority issuance limits still apply, browser Firebase sessions are per hostname, and direct FreeDNS aliases do not inherit Cloudflare WAF protection. Keep the optional preflight rate limit, bounded authorization cache, and Caddy ask endpoint enabled.
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
