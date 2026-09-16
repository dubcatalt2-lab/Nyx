# Confirming movie identities

Nyx keeps TMDB as its primary movie ID. SupaPlay's MovieBox route uses a separate detail path; it cannot be derived from a TMDB ID.

MovieBox's public search and its own search page returned no Interstellar results in the local September 12 check. The fallback reads the authoritative movie metadata from an individual MovieBox detail page, without evaluating scripts or reading user comments as metadata.

From the repository folder, preview a match:

```powershell
node scripts/match-movie.mjs --tmdb 1108427 --provider https://supaplay.fun/mw/moana-KHgXxMgKVV --local
```

`--local` uses the existing ignored `.nyx-local.json` TMDB token. On the server, use the existing `TMDB_TOKEN` environment and omit `--local`. No token is printed.

The command compares title (including the original TMDB title), release year, movie type and runtime within five minutes. A matching title alone never qualifies. Mismatches are rejected, including the animated 2016 Moana versus the 2026 remake. Metadata agreement does not establish that the provider serves the right footage: check playback before confirming.

After reviewing the comparison and the actual movie, repeat with `--confirm` to save. Only someone with filesystem/server access can run this confirmation; ordinary Nyx users cannot submit mappings. Preview does not write anything. Different existing assignments are not overwritten, and one provider movie cannot be assigned to two TMDB IDs.

The persistent file defaults to `.nyx/movie-mappings.json` under the server user's home directory, outside the site. Set `NYX_MOVIE_MAPPINGS_FILE` to an absolute private path if needed, using the same path for the command and the server. Back it up with server data. Writes use an exclusive lock and atomic replacement. If a process crashes leaving a `.lock`, verify no matching command is running before removing that exact lock file.

You can omit `--provider` to look up the title in MovieBox's working public catalog pages. Nyx verifies candidate detail pages against TMDB and requires exactly one compatible match. This fallback covers entries exposed in that catalog; it does not repair MovieBox's upstream keyword search or promise older-title coverage. If a title is absent, supply a known provider link. Confirmation and mismatch checks still apply.

Movie details return confirmed records in `providerMappings`. If metadata changes, a mapping becomes ineligible until reviewed again. Missing or damaged mapping files do not break ordinary movie browsing. Confirmed movies now offer SupaPlay alongside native VixSrc in Sources. SupaPlay uses a restricted iframe and its own playback controls; Nyx only labels it Playing after advancing progress events from that exact frame and origin. A saved identity is not a guarantee of provider availability.
