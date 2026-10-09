# Nyx interface wording and archive loading — 2026-10-09

The shared display formatter now covers whole interface words in Nyx's built-in pages: game/games/gaming, arcade/play, search variants, browse/browser variants, proxy/proxies, Scramjet, BareMux, Ultraviolet, Wisp, relay, movie/video/music/shorts and link generator. Visible text, placeholders, tooltips and image alternatives use the existing Unicode display style. Later text and attribute updates receive the same treatment. Game collection names also use the display formatter.

Typed values, editable/code regions, chat messages, saved profile names, internal identifiers, routes, API contracts and stored data are preserved. Ordinary accessible names remain readable. This is a presentation change, not the outstanding exhaustive dependency/source naming migration. Nook, Drop and Tutsi retain their separate interface behavior.

The ordinary archive loader now inserts its fetched HTML into the player instead of discarding it and navigating to fetch it again. Relative asset bases, existing document repairs and ad protection remain. Fetches have a fifteen-second deadline and cancel on page exit. GN Math/GMS already use fetched documents; their loading UI now receives the same display formatter. External provider embeds and the standalone bundled game retain their required loading paths.

Validation includes dynamic labels and user-content preservation; desktop/mobile built-in-page auditing; Arcade filters, search, keyboard/random launch, empty state, cloud switching and responsive layouts; selected HTML fetched once, relative JavaScript, local save/reload and HTTP failures; existing cloud-save and game-startup health tests; real Cookie Clicker input and save/reload using the changed loader. API catalogs in page audits are fixtures and do not establish every upstream media provider's availability. The full archive is not individually gameplay-tested.

The unfinished native Nook account/UI changes are excluded from this release. Production advertising stays disabled; Ultraviolet is not added.
