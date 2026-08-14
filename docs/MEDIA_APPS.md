# NyxTube, NyxCloud, and Nyxify setup

Nyx keeps provider credentials on the OVH server. The browser calls same-origin Nyx routes, receives normalized public search results, and plays selected media only through the providers' official embedded players. Neither app extracts raw YouTube media URLs or exposes the SoundCloud client secret.

## NyxTube

1. Open Google Cloud Console and select or create the project used for Nyx.
2. Enable **YouTube Data API v3**.
3. Create an API key under **APIs & Services > Credentials**.
4. Restrict the key to **YouTube Data API v3** and restrict application access to the OVH VPS public IP.
5. Add the key to `/etc/nyx/nyx.env`:

   ```dotenv
   NYX_YOUTUBE_API_KEY='replace-with-youtube-data-api-key'
   ```

NyxTube uses the official `search.list` endpoint for embeddable videos and the privacy-enhanced YouTube IFrame player for playback. Search is quota-limited by Google, so Nyx caches identical searches briefly and rate-limits callers.

## NyxCloud

1. Register a SoundCloud developer application and obtain its client ID and client secret. SoundCloud currently requires an eligible account for API-key registration.
2. Add both credentials to `/etc/nyx/nyx.env`:

   ```dotenv
   NYX_SOUNDCLOUD_CLIENT_ID='replace-with-soundcloud-client-id'
   NYX_SOUNDCLOUD_CLIENT_SECRET='replace-with-soundcloud-client-secret'
   ```

NyxCloud uses SoundCloud's server-side client-credentials flow for public playable-track search. The access token is reused in memory until near expiry, and playback uses SoundCloud's official widget. Tracks that SoundCloud marks blocked or unavailable for off-platform playback are excluded.

## Nyxify

Nyxify uses the public Meting-compatible endpoint at `https://api.qijieya.cn/meting/`. The endpoint does not issue or require an API key, so there is no Nyxify secret to add to `/etc/nyx/nyx.env`.

Nyx sends searches through its same-origin `/api/nyxify/search` route, rate-limits callers, caches identical searches briefly, and validates returned stream, cover, and lyric URLs before sending normalized results to the browser. The app provides playback, queue, shuffle, repeat, recent history, liked songs, and device-local playlists. Catalog availability depends on the community-operated upstream service; it is not a Spotify API or a guaranteed service-level dependency.

## Apply and verify

After editing the environment file:

```bash
sudo systemctl restart nyx
curl --fail http://127.0.0.1:8080/api/nyxtube/status
curl --fail http://127.0.0.1:8080/api/nyxcloud/status
curl --fail http://127.0.0.1:8080/api/nyxify/status
```

Each response should contain `"configured":true`. Then open `/apps/nyxtube/`, `/apps/nyxcloud/`, and `/apps/nyxify/` through Nyx and run a harmless search. Never commit either provider credential.
