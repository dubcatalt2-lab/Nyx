# Local playback checks — September 12, 2026

These are short playback samples, not uptime guarantees or proof that an entire catalog works. Tests used ordinary Microsoft Edge with an iframe sandbox allowing scripts, same-origin, forms and presentation, but no popups or top navigation. A playable result required actual video dimensions, advancing playback, seeking past two minutes and continued playback. Provider ready/play messages alone were not sufficient. No production deployment was performed.

## VidCore expansion and quality ranking

[VidCore official docs](https://www.vidcore.org/) specify movie/TV embed endpoints and a theme parameter. The current vidcore.org host passed Inception and Interstellar movies, Breaking Bad S1E1, and Jujutsu Kaisen S1E1 in the retained sandbox, including seeking and continued playback. Screenshot review confirmed footage. Actual Nyx Inception played/sought and cleaned up without popups or overflow; the upstream player logs checkWindowSize errors, so this is not a claim of error-free operation. Results: provider-expansion-round2-results.json, vidcore-confirm-results.json, vidcore-connected-results.json in local artifacts.

VidKing failed the bounded playback test despite metadata/progress messages; Videasy and Mapple explicitly reject sandboxing; CinemaOS did not play in its tested route, and the old VidCore created.app host failed. EmbedMaster's docs explicitly prohibit sandboxing. NexStream requires a domain-bound API key. No protection was removed. This round established one additional connected provider, not three.

Nyx Auto ranks recent per-title playback evidence and, when actually exposed, measured dimensions. Unknown iframe quality remains unknown; marketing FHD/4K labels are never used as measured quality. No cross-provider maximum-quality guarantee or hidden simultaneous streams.

## Additional sandbox sources connected locally

- [NHD documentation](https://streammafia.to/api-docs): Inception and Fight Club movies, Breaking Bad S1E1/S1E2, One Piece AniList episode 1, and Jujutsu Kaisen TMDB S1E1 passed short sandbox play/seek/continue checks. The initial Interstellar attempt failed, so availability is not universal. Evidence: nhd-round-results.json, nhd-movie-round2-results.json and nhd-tv-anime-results.json in local artifacts.
- [ScreenScape documentation](https://screenscape.me/embed): Interstellar, Breaking Bad S1E1 and Jujutsu Kaisen S1E1 passed sandbox play/seek/continue checks. English is requested; in-player ads/countdowns may appear. Evidence: screenscape-round-results.json.
- Both are connected through validated fixed-host iframe URLs, retaining sandbox restrictions. Actual Nyx season selection, episode changes, source choices, mobile layout and frame cleanup passed. Iframe load is described as Player loaded rather than proof of playback. Native VixSrc remains the default for movies.
- NHD's documented direct JSON mode requires its own API key; no such key is configured. Embedded player styling remains provider-controlled. No native response schema was guessed, and no provider protection was removed. VidBolt movie/TV/anime tests failed and it was not added.

## Connected to Nyx

- **September 12 integration follow-up:** SupaPlay is connected for confirmed MovieBox movies (local Moana 2026, One Night Only 2026, Mayday 2026 mappings), and for One Piece E2 / Jujutsu Kaisen S1E1. Anime Player is connected for Hidden Love S1E25. All six samples played and sought inside Nyx with zero popup pages, mobile overflow or app errors. One Piece needed more than the initial six-second seek wait; a bounded 25-second follow-up passed. Full-film/episode uptime is not guaranteed. MovieBox discovery now reads public catalog candidates and verifies their detail metadata; upstream keyword search itself is still unavailable.

- **VixSrc native HLS:** Interstellar, Inception and Fight Club played and sought in the sandbox with zero popup pages. Nyx relays bounded, allowlisted session resources and runs its own controls. It remains the default general-movie source alongside mapped SupaPlay. Full movies and production network capacity remain unverified.

## Episode sources found

| Source | Sample checks | Limitations |
| --- | --- | --- |
| [SupaPlay](https://supaplay.fun/) | One Piece episode 2 via `/stream/ani/21/2/sub`, the documented classic episode 2142, and Jujutsu Kaisen via `/mw/jujutsu-kaisen-english-KD0jSM9ot5/1/1` played, sought and continued in the sandbox. Anime footage was visually checked; durations were roughly 24 minutes. No popup pages. | Classic player emitted preroll-ad events. MW and anime routes use different identifiers; it is not a drop-in TMDB movie resolver. General TV/movie coverage and exact episode matching across the catalog are unverified. |
| [Anime Player / ani.megaplay.su](https://ani.megaplay.su/) | Documented drama IDs 129692 and 210822 played, sought and continued in the sandbox with no popup pages. | The anime MAL/AniList routes tested with One Piece, Frieren and Attack on Titan returned 404. Treat this as a drama candidate, not verified anime coverage. Full episode/title matching and uptime remain unverified. |

The individually identified episodes listed in the integration follow-up are now installed, with matching TMDB series detail links. Other episode IDs in this research table remain unconnected until their identity is confirmed. External players retain their own controls; Nyx does not assume a native-player command API.

## Rejected or inconclusive

- **Additional regular-movie checks:** SupaPlay's MW routes for its catalog entries Moana, One Night Only and Mayday played, sought past two minutes and continued without popup pages. Screenshots showed movie footage; catalog-wide title/year matching remains unverified. These are one provider, not three. SupaPlay now connects only confirmed MovieBox detail paths; the tested public search returned no mappings for Interstellar, Inception or Fight Club. Do not guess a path from a TMDB ID.
- **Latest embed rounds:** VidLink and AutoEmbed explicitly rejected sandboxing. VidFast, VidPlus, current MoviesAPI, VidSrc.cc, 2Embed, NontonGo and VidZen did not produce successful sandbox playback. No protection was removed to turn a failure into a pass. Results are in `movies-round3-results.json` through `movies-round7-results.json` under `.codex-artifacts/`.

- **VidRock / VidZee native APIs:** API responses and master playlists worked for some films, but the registered streams failed real playback. Segment hosts returned 403 or image-wrapped bytes. Experimental adapters were removed; server host restrictions were not broadened to make them appear operational.
- **111Movies / VidLove, MultiEmbed / SuperEmbed, VidSrc variants:** observed sandbox rejection, redirects, missing files or unavailable upstreams. Not integrated.
- **VidNest, Smashy, Vidora, MoviesAPI, EzVidAPI, Embed.su, Vidify, Filmku:** errors, redirects or no successful bounded sandbox play/seek result. Provider-page success is not native Nyx integration.
- **MegaPlay at megaplay.buzz:** initially started a sample but subsequently explicitly refused sandboxing. This is a different endpoint from ani.megaplay.su above; no sandbox workaround was applied.
- **Anixo:** emitted the requested anime title and played a roughly ten-minute video, but its on-screen warning identified a substitute stream. Not counted as successful requested-title playback.
- **Yenime:** play event with no playable duration; no successful video sample.
- **DropFile / MegaFlix:** unavailable pages in the tested embeds.
- **VixSrc TV:** a Breaking Bad episode resolved to a playlist, but the bounded native playback test failed. Anime sample IDs returned 404. Not counted as working TV/anime coverage.

The later NHD/ScreenScape checks above supersede this earlier source-count shortfall; sustained uptime and entire catalogs remain unverified. Do not add fake available badges, count mirrors as independent providers, or remove sandbox protections to meet that number.

Sanitized results and screenshots are in `.codex-artifacts/native-sandbox-results.json`, `anime-tv-sandbox-results.json`, `anime-round2-results.json`, `anime-round3-results.json`, and `anime-round4-results.json`. Other temporary research artifacts may contain ephemeral upstream stream URLs and are not release files.
