# NyxTube and Nyxify setup

Nyx keeps the YouTube provider credential on the OVH server. The browser calls same-origin Nyx routes and receives normalized public search results. NyxTube plays selected videos only through an official YouTube embedded player, while Nyxify searches its public Meting-compatible catalog and streams selected tracks through Nyx's fixed-target, same-origin music route. Neither app extracts raw YouTube media URLs.

## NyxTube

1. Open Google Cloud Console and select or create the project used for Nyx.
2. Enable **YouTube Data API v3**.
3. Create an API key under **APIs & Services > Credentials**.
4. Restrict the key to **YouTube Data API v3** and restrict application access to the OVH VPS public IP.
5. Add the key to `/etc/nyx/nyx.env`:

   ```dotenv
   NYX_YOUTUBE_API_KEY='replace-with-youtube-data-api-key'
   ```

NyxTube uses the official `search.list` endpoint for embeddable videos and the official YouTube IFrame player for playback. It normally uses YouTube's privacy-enhanced player; ChromeOS defaults to the standard player because managed-device filters more commonly allow that host, and the player header provides a saved compatibility toggle. Search is quota-limited by Google, so Nyx caches identical searches briefly and rate-limits callers.

## Nyxify

Nyxify uses the public Meting-compatible endpoint at `https://api.qijieya.cn/meting/`. The endpoint does not issue or require an API key, so there is no Nyxify secret to add to `/etc/nyx/nyx.env`.

Nyx sends searches through its same-origin `/api/nyxify/search` route, rate-limits callers, caches identical searches briefly, and validates returned stream, cover, and lyric URLs before sending normalized results to the browser. Playback uses `/api/music/stream/:trackId`, which accepts only numeric NetEase track IDs, follows only the fixed Meting endpoint and trusted NetEase audio hosts, supports byte ranges, and never accepts an arbitrary upstream URL. This keeps audio same-origin for managed Chromebooks without creating an open proxy. The app provides playback, queue, shuffle, repeat, recent history, liked songs, and device-local playlists. Catalog availability depends on the community-operated upstream service; it is not a Spotify API or a guaranteed service-level dependency.

## Apply and verify

After editing the environment file:

```bash
sudo systemctl restart nyx
curl --fail http://127.0.0.1:8080/api/nyxtube/status
curl --fail http://127.0.0.1:8080/api/nyxify/status
```

Each response should contain `"configured":true`. Then open `/apps/nyxtube/` and `/apps/nyxify/` through Nyx and run a harmless search. Never commit the YouTube provider credential.
