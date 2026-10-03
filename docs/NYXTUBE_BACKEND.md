# NyxTube native playback

Native playback is optional and disabled until explicitly configured. The existing
Extractor-backed search, metadata, community features and the iframe player remain available.
Native playback uses HLS: the server reads the source index and fetches only the
requested audio/video sections. Playback can start before the entire video downloads,
and seeking requests the sections near the new position. Shorts use the Invidious
player described below; Nyxify retains its existing player. Native captions use
the transcript service, and the YouTube player remains selectable for captions.

## Search and video information

NyxTube no longer requires `NYX_YOUTUBE_API_KEY`. The installed yt-dlp tool handles
bounded flat searches, full selected-video metadata, channel listings, and up to
20 top-level comments. Transcripts reuse the selected video's extracted caption
tracks. Search never downloads its result videos or fully extracts every result;
opening a result validates the selected public, non-live video before playback.
Unknown statistics display as unavailable. The home page uses a shared discovery
search instead of Google's most-popular chart. Search ordering, field availability,
and regional visibility can differ from the old Data API results.

The catalog shares identical in-flight requests, caches successful lookups for five
minutes (channels ten), and briefly caches failures. Its cache is bounded to 160
entries / 32 MiB. At most two extractor jobs run concurrently, with eight waiting
jobs, a 15-second queue deadline and 35-second extractor deadline. Each process
has bounded output and a private temporary cookie copy removed on completion.
Native preparation reuses full catalog metadata; signed media URLs stay server-only.
This replaces Google developer quotas, not YouTube's own throttling or login checks.

On an extractor service, login, setup or rate failure, the catalog can use the
Invidious API for searches, public-video details, channels and comments. Explicit
video restrictions and full queues do not trigger this fallback. Set the server-only
`NYX_INVIDIOUS_ORIGINS` to up to three comma-separated HTTPS instance origins;
an empty string disables it. The default is `https://invidious.f5.si`, listed as
API-enabled when checked on October 2, 2026. Public instances can change or fail.
No account credentials or cookies are forwarded. Calls have a two-request admission
limit, a two-MiB response limit, per-instance timeout and failure cooldown. The
primary extractor is retried after 30 seconds rather than retried on every lookup.

This fallback is metadata-only: its media URLs returned HTTP 403 from the VPS, and
its local playback path returned HTML instead of video during verification. It does
not advertise those URLs as working native formats. Native playback still requires
valid extractor media access. The frontend also supports a separate Invidious embed
from `NYX_INVIDIOUS_EMBED_ORIGIN` (default `https://invidious.tiekoetter.com`; empty
string disables it). Its public embed and companion playback were verified in a
browser with decoded audio, frames and seeking on October 2, 2026. It streams to the
browser using the provider's supported player, without storing video on the Nyx VPS.
The previous instance's media routes return an Anubis bot-check page; no challenge
is bypassed and no third-party cookies are copied to the server.

The Invidious button selects this player. Native playback failures and YouTube
player transport errors 5/153 can select it automatically. A temporary metadata
service failure can open the same listed video in the embed; explicit 4xx video
restrictions are retained. Initial time, volume, speed and pause preference are
passed to the player. Invidious does not expose a public cross-origin control API,
so its own controls handle playback/quality/fullscreen. Outer fake progress or
mute controls are hidden. Switching away destroys the iframe and stops audio.

Shorts use Invidious's hashtag feed, shared and cached separately from broad video
searches that previously returned only long compilations and an empty filtered feed.
The bounded extractor fallback reads the YouTube hashtag Shorts tab. Only permitted
results with positive duration up to 180 seconds enter this feed. Shorts use one
active Invidious iframe, muted initially and looping, with next/previous buttons;
no hidden preloaded players run. Use the player controls and adjacent navigation
buttons (cross-origin frame input does not bubble to the parent for custom gestures
or automatic end detection). Playback does not wait on another metadata request.
Drop retains its existing complete Shorts exclusion. Instance availability and
supported video formats can still change; the YouTube player remains selectable.

`NYX_YTDLP_BIN` and the existing optional cookie-file setting also apply to the
catalog. The OVH installer already provides the tool. Native playback can remain
disabled while catalog search and the embedded player work. The separate Nyxify
music matcher retains its existing optional Google API verification; do not delete
that server setting merely because NyxTube no longer needs it.

## Server setup

The normal OVH installer installs the pinned yt-dlp package and FFmpeg and creates
`/var/lib/nyx/youtube-cache` with access limited to the Nyx service. No server changes
occur merely by editing this repository.

Add these server-only settings to `/etc/nyx/nyx.env` when releasing the feature:

```text
NYX_YOUTUBE_NATIVE_ENABLED=1
NYX_YOUTUBE_CACHE_DIR=/var/lib/nyx/youtube-cache
NYX_YOUTUBE_COOKIES_FILE=/etc/nyx/youtube-cookies.txt
```

The cookie file must be outside the repository and static root, owned by root with
group `nyx` and mode `0640`. Replace it atomically from a private uploaded file.
Do not upload it to the dashboard, print its contents, commit it, or include it in
application backups. Each extractor invocation uses an isolated temporary copy;
the original is not rewritten. The copy is removed after the invocation. Never
reuse the previous test session for production without the owner's authorization.

For local isolated tests, `NYX_YTDLP_BIN`, `NYX_FFMPEG_BIN`, and the two path settings
can point to local executables/private temporary directories. Disable the feature
by clearing `NYX_YOUTUBE_NATIVE_ENABLED` and restarting Nyx.

## Owner status

Only the Owner role can read `/api/owner-dashboard/nyxtube` or invoke the bounded
POST `/api/owner-dashboard/nyxtube/check`. The panel refreshes status once a minute
while visible, without sending background requests to YouTube. Check now tests
one fixed public video and reads a small stream sample. Preparing real videos
also updates status. Two consecutive authentication failures produce **Login needs
refreshing**; one failure produces **Service trouble**. Removed/private/unsupported
videos do not label the account expired. Successful uncached extraction plus media
access clears the warning. Cached playback alone does not prove the session valid.

Checks have a one-minute minimum interval. Authentication and rate failures impose
a five-minute backend cooldown. The panel shows the last check and successful media
access. After a restart it displays **Not checked yet**, with historical timestamps.
This is an operational signal, not a guarantee that every video or session works.

To refresh a session, use the dedicated account and yt-dlp's documented YouTube
Incognito cookie-export procedure, privately replace the server file, then use
Check now after the cooldown. Cookies can expire, be revoked, or be restricted;
there is no guaranteed refresh interval.

## Limits and behavior

- Public YouTube videos only; full extractor metadata validation precedes preparation,
  and extraction rejects non-public, age-restricted, live, or invalid-duration videos.
  HLS has no one-hour or whole-video 1.5 GiB limit. Individual fragments, metadata,
  free disk space, provider availability and request deadlines remain bounded.
- Only HTTPS Google video media URLs from the extractor are requested. No client URL,
  cookie, signed media URL, or extractor stderr is returned to the browser.
- H.264/AAC at available 360p, 480p, or 720p. Adaptive MP4 sources with a flat `sidx`
  reuse existing independently playable fragments directly. Ordinary MP4s use their
  sample tables to create roughly six-second fMP4 fragments without re-encoding.
  Unsupported indexes/codecs, nested indexes and files missing audio/video fall back
  to the selectable YouTube player. Captions still use the transcript/embedded player.
- One index preparation and two fragment jobs may run concurrently. Eight fragment
  jobs may wait; duplicate requests share work. The last waiting viewer disconnecting
  cancels that fragment's work. Fragment responses have a global 40-request admission
  limit. Existing catalog extractor admission limits still apply.
- MP4Box parses bounded initialization/index data: at most 12 MiB for `moov`,
  one million samples per ordinary track, or 20,000 direct `sidx` references.
  Retained indexes are bounded to 64 MiB per video, 128 MiB total, and 64 entries.
  Old unpinned indexes expire after two idle hours or under memory pressure.
- Five GiB total disk cache shared with older complete MP4 downloads. Two-hour idle
  expiration and LRU capacity eviction apply to individual fragments/files. Fragments
  in active HTTP transfers are pinned until their responses close. Completed fragments
  publish atomically; concurrent writers reserve 64 MiB within the cache, and each
  source span/output is bounded to 16 MiB. Two GiB additional disk headroom is required.
  Cleanup runs every minute and before new writes. Recent indexed fragments can be
  reused after restart once source metadata has been validated again.
- Metadata preparation has a 45-second deadline. Source ranges are at most four MiB,
  with a 15-second attempt timeout and at most two retries; a fragment job has 45
  seconds total, and each viewer waits at most 60 seconds including the queue.
  Expiring source URLs are refreshed through the existing extractor. Temporary files
  are removed on cancellation/failure and on startup after a crash.
- The locally bundled hls.js player targets a 12-second forward buffer, capped at 24
  seconds plus the necessary complete fragment, and retains about 12 seconds behind.
  Seeking skips intervening downloads. Native HLS browsers manage their own buffers.
  Startup/seek buffering shows the moving circle. Busy/connection retries are bounded;
  an expired HLS session can be renewed while preserving the selected position.
- Same-origin routes serve the HLS master, track playlists, initialization and fragments.
  Public-video checks precede preparation. No source URL can be supplied by a client.
  Per-network preparation/format requests remain limited to ten per ten minutes.
- The older complete MP4 preparation route remains compatible for older clients: one
  job, a 1.5 GiB combined input limit, reserved merge output, 12-minute download deadline,
  90-second FFmpeg stream-copy merge, and HTTP Range playback. It cannot write alongside
  HLS preparation. New clients explicitly request `?mode=hls`.
- Native failures retain the existing YouTube fallback. Switching quality retains
  playback position, pause state, volume, mute, and speed after preparation.

The cache directory must be exclusive to a single Nyx process and must never be
served by a generic static server. Shared multi-process deployments require a
separate cache lock/service before enabling this backend.

No new monthly subscription is required by this implementation. Capacity must be
measured alongside the existing Nyx workload before raising concurrency or quality.
