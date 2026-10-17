# Nyx Movies API v1

Local implementation: `/api/movies/v1`. Use the origin of the running Nyx server
(for example `http://localhost:8080`). These routes are not deployed yet.

This read-only API combines Nyx's supported external embedded players under one
TMDB identity. It includes NHD, Rive, FrameXTV and confirmed SupaPlay/Anime Player
mappings when available. It does not return downloaded movies or a universal
HLS stream. VixSrc's existing cookie-bound native relay remains private to Nyx;
it is not a reusable external embed and is not exposed by this API.

## Endpoints

| GET route | Result |
| --- | --- |
| `/search?q=Frieren&page=1` | Movie and TV search; anime series have `kind: "tv"` |
| `/movies/27205` | Movie metadata |
| `/tv/209867` | Series metadata and available seasons |
| `/tv/209867/seasons/1` | Episodes in that season |
| `/sources?type=movie&id=27205` | Combined movie player list |
| `/sources?type=tv&id=209867&season=1&episode=1` | Combined TV/anime episode player list |

TV/anime source lists put Rive first, other supported providers next, and FrameXTV last.

Always use the returned seasons and episode numbers. The backend validates the
episode and translates grouped seasons to each source's canonical coordinates.
Never substitute a MAL or AniList ID for the TMDB ID.

```js
const base = 'http://localhost:8080/api/movies/v1';
const response = await fetch(`${base}/sources?type=movie&id=27205`);
const data = await response.json();
if (!response.ok) throw new Error(data.error);
// Render a provider chooser from data.sources.
const source = data.sources[0];
const player = document.createElement('iframe');
player.setAttribute('sandbox', source.sandbox);
player.allow = 'autoplay; fullscreen; picture-in-picture';
player.referrerPolicy = 'strict-origin-when-cross-origin';
player.src = source.url;
document.querySelector('#player').replaceChildren(player);
```

Sources have `id`, `name`, `url`, `type: "iframe"`, `sandbox`,
`availability: "unchecked"`, and `quality: null`. A returned URL is a candidate,
not a guarantee that this title plays or a claim of measured quality. Do not
label an iframe load as successful playback. The provider controls its own
cross-origin player UI. No ad-free guarantee is implied.

GET requests support browser CORS without cookies or an API key. The TMDB token
stays on the Nyx backend. Requests share the existing limit of 120 per minute
per client IP, cached/coalesced metadata, and bounded upstream concurrency.
429 responses include `Retry-After: 60`; stop and retry after that delay.
Errors are JSON `{ "error": "..." }`: 400 invalid input, 404 unavailable
identity, 405 unsupported method, 429 rate limit, 503 upstream unavailable.
No user-provided URLs, account credentials, or arbitrary proxy endpoints are accepted.

Movie metadata displays must retain the existing TMDB attribution and logo.
