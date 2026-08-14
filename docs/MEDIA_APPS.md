# Nyxify setup

Nyx keeps every provider credential on the OVH server. Browsers call same-origin Nyx routes and receive normalized public results. Nyxify can prefer SoundCloud's official API and automatically falls back to the public Meting-compatible catalog. It does not expose provider credentials.

## Nyxify

Nyxify works without another credential through its existing public Meting-compatible fallback. To prefer SoundCloud results and playback, register an official SoundCloud application, then add its two server credentials to `/etc/nyx/nyx.env`:

```dotenv
NYX_SOUNDCLOUD_CLIENT_ID='replace-with-soundcloud-client-id'
NYX_SOUNDCLOUD_CLIENT_SECRET='replace-with-soundcloud-client-secret'
```

Both values are required. Do not put either value in browser code, screenshots, commits, or documentation. Nyx exchanges them for a short-lived server token, searches only playable public tracks, displays the uploader and SoundCloud source link, and relays the selected fixed track ID through `/api/music/soundcloud/:trackId`. If credentials are missing or SoundCloud has a temporary API failure, searches fall back to the keyless catalog and playback uses `/api/music/stream/:trackId`.

Both stream routes are fixed-target relays rather than arbitrary URL proxies. They validate numeric track IDs, trusted provider hosts, media response types, byte ranges, and timeouts. Meting artwork is also served through the fixed-target `/api/music/artwork/:assetId` route so managed devices do not need to contact third-party cover hosts directly. The route validates the numeric artwork ID, redirect hosts, image type, response size, and timeout. Nyxify's queue, shuffle/repeat state, listening history, liked songs, and playlists remain device-local.

## Apply and verify

After editing the environment file:

```bash
sudo systemctl restart nyx
curl --fail http://127.0.0.1:8080/api/nyxify/status
```

Nyxify always reports configured and identifies its current preferred provider. Then open `/apps/nyxify/`, run a harmless search, verify that artwork loads from `/api/music/artwork/`, and play one result. Never commit any provider credential.
