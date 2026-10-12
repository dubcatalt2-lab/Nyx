# Media and game delivery repairs — 2026-10-12

## COMPLETED

- Original runtime handles dynamically assigned script/link integrity consistently with transformed markup, and exposes original resource addresses through DOM URL properties. No reference engine source or package was copied.
- Document iframe delegates autoplay, encrypted media, presentation, fullscreen, picture-in-picture and user-activated storage access. Cross-origin media retains its original referrer and byte-range response.
- Local development uses documents.preview.localhost:8082 beneath a cookie-capable parent domain. Related original sites share one private server session; unrelated origins receive no upstream cookies. Main app remains localhost:8080. Existing private session files are preserved.
- Supplied Moonrise photograph is the default for fresh/theme-default selections. Saved wallpaper choices remain intact.
- Game catalog SDK, covers, launch documents and resource fallbacks use repository mirrors or unpkg instead of jsDelivr. Incoming legacy catalog URLs are converted before fetch, including server redirects. Game identities and save keys are unchanged. The follow-up replaces 5,600 embedded URLs in 1,413 game documents, converts nested source streams and generated markup before parsing, and starts guards ahead of packed pre-head scripts. Cookie Clicker now loads the main script from its existing pinned asset archive instead of an unavailable repository. A mandatory build/CI gate rejects actual jsDelivr targets in game output. Legacy URL matchers remain migration inputs, never outbound targets.
- Repeated execution of an obfuscated classic helper retains its existing initialization guard instead of failing on a duplicate generated lexical declaration.

## INCOMPLETE

- Final rebuilt artifact, current CI and production activation are pending at this review commit.
- Full authenticated Spotify playback is not verified: the owner performed login, while automated checks used fresh profiles without credentials. Public player rendered successfully on repeat; an earlier upstream fetch returned 502. No DRM or CAPTCHA bypass implemented.
- TikTok target video advanced beyond 20 seconds with readyState 4 and no media error. Audio was unmuted at volume 0.7 with decoded audio bytes. Physical speaker output is not observable remotely. Some site script errors remain; no all-site compatibility claim.
- External games can change after release. Slope, Run 3, Cookie Clicker, Basket Random, Retro Bowl and Gladihoppers pass startup/input checks with zero jsDelivr requests using the corrected source. The test disables Chromium local-network restrictions for the sandbox-to-localhost fixture; public-origin deployment does not make those loopback requests. A stock local Edge profile can block these sandbox requests pending browser network permission. A complete gameplay test of every catalog entry is not claimed.

## VERIFICATION OUTPUT

Captured in ignored .codex-artifacts/media-*.log and tiktok-current.log/tiktok-audio.log:

```text
PASS game delivery: pinned repository paths, scoped npm packages, static scripts, dynamic scripts and fetch; zero browser requests to jsDelivr
PASS streamed nested game sources: byte-split URLs and UTF-8, pinned commits/packages, templates and worker imports retained; no CDN target
Slope: rendered game content and input passed; zero jsDelivr requests
Run3: rendered game content and input passed; zero jsDelivr requests
CookieClicker: rendered game content and input passed; zero jsDelivr requests
BasketRandom: rendered game content and input passed; zero jsDelivr requests
RetroBowl: rendered game content and input passed; zero jsDelivr requests
Gladihoppers: rendered game content and input passed; zero jsDelivr requests
PASS real Express routes: streamed binary, loader repair, MIME, JSON/CSS rewriting, cover cache and denied upstream host
PASS 1365px wallpaper previews: five photographs decode, styles select, applied choice survives reload, no failed image requests
PASS 390px wallpaper previews: five photographs decode, styles select, applied choice survives reload, no failed image requests
PASS local shared session: parent-domain cookies reach media subdomain; unrelated origin receives no cookies
PASS browser smoke: 3 pages, 0 console errors, 0 failed requests; original transport and original transformation only
```

Chrome/Edge isolated-shell and dynamic-navigation suites pass. Thirty-two connection unit tests pass. The first complete build passed with 5172 files, atob 0 / eval 2 / Function 2, 452 raw matches individually classified, zero blocked findings, paths, parse errors or source maps. Updated application copies were re-reviewed against four unchanged saved-preference migration/export contexts and pinned by new SHA-256; no directory exemption was added. Final rebuild includes the subsequent repeated-helper fix and is not yet declared passed here.

## FILES CHANGED

The review commit records the complete file list. Principal areas: connection runtime/iframe/header handling and tests; game delivery resolver, document preparation, catalog and server routes; obfuscator and regressions; Moonrise asset and appearance; exact release evidence and CI.

## DEPENDENCIES REMOVED

None in this follow-up. Wispurr 4.2.0 remains explicitly authorized on the server. Previously removed browser engines remain absent; dependency audit passed. The retained server package is not renamed or described as removed.
