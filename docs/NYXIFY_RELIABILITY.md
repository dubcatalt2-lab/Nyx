# Nyxify playback reliability review — 2026-09-09

Scope: the ordinary listener's music playback path, including browser state, native matching/streaming, player controls and backend resource limits. This is a failure-injection review, not proof that every device, recording or network will work. Released to OVH in bc6c51e alongside the active HTTP logging configuration. Live desktop/phone fault tests and real three-song playback/seeking passed; release verification is recorded in NYX_PROJECT_STATE.md.

## Findings and fixes

| Failure path | Result |
| --- | --- |
| Lookup never completes | Requests have a 25-second deadline; playback stops waiting and explains the failure. |
| Temporary busy/502/503/504/429 response | One bounded retry honors a short Retry-After before preview fallback. Network lookup failures can also retry once while online. |
| Rapid track changes | Superseded lookups are aborted; stale results cannot replace the selected song. Selecting an aborted lookup again creates a fresh request. |
| Pause while matching | The desired paused state and button icon are retained when the song becomes ready. |
| Browser denies autoplay | The player asks for a play gesture; a rejected play promise does not crash the page. |
| Audio error or expired registered media link | One renewed match retries playback from its previous position. |
| Buffering never raises a media error | A 45-second progress watchdog attempts recovery, then gives an explicit fallback instead of spinning forever. |
| Connection goes offline | Buffered audio may continue; errors wait for reconnection instead of immediately attempting a preview. |
| Full audio cannot be matched or has the wrong duration | Existing preview fallback remains, with its status visible in the bottom player as well as Now Playing. |
| Browser storage is full, denied or corrupt | Playback no longer depends on successfully saving history; failed writes remain in page memory. Invalid stored lists, repeat modes and volume values are handled. Failed saves do not persist after the page closes. |
| Many listeners use the same media host | The media connection pool now aligns with the existing 40-transfer limit, removing the previous six-connection queue at a single host. |
| Malformed ranges or upstream partial responses | Unsafe/reversed ranges return 416; inconsistent partial audio responses and oversized file totals are rejected. |
| Provider returns HTML instead of audio | Rejected as an upstream failure; no HTML is passed to the audio player. |
| Socket creation or DNS fails | Errors reject the request rather than escaping an asynchronous connection callback. |
| Listener disconnects | Upstream bodies are cancelled and stream capacity is released. |

## Verification

- Chromium at 1280px and 390px: actual MP3 decoding, seeking, pause/resume, next track, fast switching, transient busy recovery, stream failure renewal, pause during lookup, autoplay denial, bounded hung lookup, offline recovery, stalled progress fallback, corrupted/full/restricted storage, missing recording and truncated recording fallback.
- Backend fixtures: 30 identical concurrent matches coalesce; 40 simultaneous streams are accepted, the 41st receives a controlled busy response, and all disconnected bodies are cancelled before capacity is reused. This checks resource accounting, not 40-user real-provider throughput.
- Connection regression: TLS-stalled address recovery, losing socket cleanup, working-address preference, certificate verification options, DNS timeout/failure and synchronous socket creation failure.
- Existing range, expired-URL refresh, recording-match and redirect isolation regressions remain in place.

- The same desktop/phone fault suite passed against the production-obfuscated build. Production build, deployment manifest (100 required files), branding and whitespace checks passed.

## Remaining limits

- Some catalog songs have no matching full recording. Title/artist/duration matching is conservative and is not an authenticity guarantee.
- A provider outage, denied stream, unavailable recording, or a network blocking Nyx itself still prevents full playback. Retries are deliberately bounded.
- Peak VPS bandwidth, 40 real simultaneous upstream transfers, managed Chromebooks, Safari/iOS background suspension and Bluetooth interruptions have not been established by these Chromium/fixture checks.
- Recovery restarts a stream at the last known position; it does not promise gapless audio. A preview is still an explicit fallback, not a full-length substitute.
- This review does not change account authentication, search providers, artwork providers, playlists' server-side storage or NyxTube.
