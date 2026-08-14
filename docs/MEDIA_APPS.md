# NyxTube and Nyxify setup

Nyx keeps every provider credential on the OVH server. Browsers call same-origin Nyx routes and receive normalized public results. NyxTube plays videos only through an official YouTube embedded player. Nyxify can prefer SoundCloud's official API and automatically falls back to the public Meting-compatible catalog. Neither app exposes provider credentials or extracts raw YouTube media URLs.

## NyxTube

1. Open Google Cloud Console and select or create the project used for Nyx.
2. Enable **YouTube Data API v3**.
3. Create an API key under **APIs & Services > Credentials**.
4. Restrict the key to **YouTube Data API v3** and restrict application access to the OVH VPS public IP.
5. Add the key to `/etc/nyx/nyx.env`:

   ```dotenv
   NYX_YOUTUBE_API_KEY='replace-with-youtube-data-api-key'
   ```

NyxTube uses the official `videos.list` popular feed and `search.list` endpoint for embeddable videos, then plays selections through the official YouTube IFrame player. ChromeOS defaults to the standard YouTube embed host because managed-device filters more commonly allow it; every player also offers the privacy-enhanced official host and an external YouTube link. A device administrator can still block both official hosts, which application code cannot override. Google quota applies, so Nyx caches feed and search results and rate-limits callers.

## Nyxify

Nyxify works without another credential through its existing public Meting-compatible fallback. To prefer SoundCloud results and playback, register an official SoundCloud application, then add its two server credentials to `/etc/nyx/nyx.env`:

```dotenv
NYX_SOUNDCLOUD_CLIENT_ID='replace-with-soundcloud-client-id'
NYX_SOUNDCLOUD_CLIENT_SECRET='replace-with-soundcloud-client-secret'
```

Both values are required. Do not put either value in browser code, screenshots, commits, or documentation. Nyx exchanges them for a short-lived server token, searches only playable public tracks, displays the uploader and SoundCloud source link, and relays the selected fixed track ID through `/api/music/soundcloud/:trackId`. If credentials are missing or SoundCloud has a temporary API failure, searches fall back to the keyless catalog and playback uses `/api/music/stream/:trackId`.

Both stream routes are fixed-target relays rather than arbitrary URL proxies. They validate numeric track IDs, trusted provider hosts, media response types, byte ranges, and timeouts. Nyxify's queue, shuffle/repeat state, listening history, liked songs, and playlists remain device-local.

## Apply and verify

After editing the environment file:

```bash
sudo systemctl restart nyx
curl --fail http://127.0.0.1:8080/api/nyxtube/status
curl --fail http://127.0.0.1:8080/api/nyxify/status
```

NyxTube should report `"configured":true`. Nyxify always reports configured and identifies its current preferred provider. Then open `/apps/nyxtube/` and `/apps/nyxify/`, load the video feed, run a harmless search in each app, and play one result. Never commit any provider credential.
