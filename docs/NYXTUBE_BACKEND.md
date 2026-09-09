# NyxTube native playback

Native playback is optional and disabled until explicitly configured. The existing
YouTube metadata/search/community APIs and iframe player remain available. This is
a first version: the selected video must finish preparing before native playback
starts. Shorts and Nyxify retain their existing players. Native captions are not yet
rendered over the video; the transcript remains readable and seekable, and the
YouTube player remains selectable for captions.

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

- Public YouTube videos only; official public catalog validation precedes preparation,
  and extraction rejects non-public, age-restricted, live, or over-one-hour videos.
- Only HTTPS Google video media URLs from the extractor are requested. No client URL,
  cookie, signed media URL, or extractor stderr is returned to the browser.
- One preparation job at a time, with duplicate jobs sharing work. No unbounded queue.
  Cached format lookup remains available during other jobs or service cooldowns.
  The player retries temporary busy responses for up to one minute per request;
  rejected requests do not consume its request allowance.
- H.264/AAC MP4 at available 360p, 480p, or 720p; FFmpeg combines streams without
  re-encoding. Files without both audio and video fail preparation.
- Five GiB total media cache; six-hour idle expiration and least-recently-used eviction.
  Up to 512 MiB of input per job, with a reserved output allowance before downloading.
  At least two GiB disk headroom is required in addition to job reservations.
- Downloads use bounded byte ranges with a 30-second timeout per attempt and up
  to two retries. Partial bytes are discarded before retrying the same range; the
  four-minute total preparation deadline still applies.
- Extractor deadline 35 seconds; entire preparation four minutes; merge 90 seconds.
  Temporary work is removed on failure and on the next startup after a crash.
- Completed files are published atomically and served with HTTP Range support.
  Active readers pin their cache file until their response closes.
- Per-network preparation/format requests are limited to ten per ten minutes.
- Native failures fall back to the existing YouTube player. Switching quality retains
  playback position, pause state, volume, mute, and speed after preparation.

The cache directory must be exclusive to a single Nyx process and must never be
served by a generic static server. Shared multi-process deployments require a
separate cache lock/service before enabling this backend.

No new monthly subscription is required by this implementation. Capacity must be
measured alongside the existing Nyx workload before raising concurrency or quality.
