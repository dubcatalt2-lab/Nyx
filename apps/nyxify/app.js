(() => {
  "use strict";
  const API = "/api/nyxify";
  const keys = { liked: "nyx.nyxify.audius.liked.v1", recent: "nyx.nyxify.audius.recent.v1", playlists: "nyx.nyxify.audius.playlists.v1" };
  const read = (key, fallback = []) => { try { const value = JSON.parse(localStorage.getItem(key) || "null"); return Array.isArray(value) ? value : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const state = { collection: [], featured: [], current: null, index: -1, liked: read(keys.liked).slice(0, 200), recent: read(keys.recent).slice(0, 50), playlists: read(keys.playlists).slice(0, 40), shuffle: false, repeat: 0, view: "discover", lastQuery: "" };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const refs = {
    audio: $("[data-audio]"), results: $("[data-results]"), content: $("[data-content]"), title: $("[data-title]"), kicker: $("[data-kicker]"), count: $("[data-count]"), notice: $("[data-notice]"), status: $("[data-status]"), catalogNote: $("[data-catalog-note]"), player: $("[data-player]"),
    form: $("[data-search-form]"), input: $("[data-search-input]"), play: $("[data-play]"), previous: $("[data-previous]"), next: $("[data-next]"), shuffle: $("[data-shuffle]"), repeat: $("[data-repeat]"), repeatOne: $("[data-repeat-one]"), seek: $("[data-seek]"), current: $("[data-current]"), duration: $("[data-duration]"), volume: $("[data-volume]"),
    cover: $("[data-player-cover]"), fallback: $("[data-player-fallback]"), playerTitle: $("[data-player-title]"), playerArtist: $("[data-player-artist]"), source: $("[data-player-source]"), playerLike: $("[data-player-like]"), playlists: $("[data-playlists]"), queue: $("[data-queue]"), queueList: $("[data-queue-list]"), queueCount: $("[data-queue-count]"), likedList: $("[data-liked-list]"), historyList: $("[data-history-list]"), likedCount: $("[data-liked-count]")
  };
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const trackKey = track => `${track?.provider || "audius"}:${track?.id || ""}`;
  const cleanTracks = value => (Array.isArray(value) ? value : []).filter(track => track?.id && track?.title && track?.streamUrl).slice(0, 50);
  const time = value => { const seconds = Math.max(0, Math.floor(Number(value) || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };
  function setNotice(message = "") { refs.notice.textContent = message; refs.notice.hidden = !message; }
  async function json(url) { const response = await fetch(url, { headers: { Accept: "application/json" } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Nyxify could not reach the catalog."); return body; }
  function liked(track) { const key = trackKey(track); return state.liked.some(item => trackKey(item) === key); }
  function persistLibrary() { write(keys.liked, state.liked); write(keys.recent, state.recent); write(keys.playlists, state.playlists); renderPlaylists(); renderSideLibraries(); }
  function toggleLike(track = state.current) {
    if (!track) return;
    const key = trackKey(track);
    state.liked = liked(track) ? state.liked.filter(item => trackKey(item) !== key) : [track, ...state.liked.filter(item => trackKey(item) !== key)].slice(0, 200);
    persistLibrary(); updateLikeButtons();
    if (state.view === "liked") renderCollection(state.liked, "Liked songs", "YOUR LIBRARY", false);
  }
  function updateLikeButtons() {
    $$("[data-like-id]").forEach(button => button.classList.toggle("active", state.liked.some(track => trackKey(track) === button.dataset.likeId)));
    refs.playerLike.classList.toggle("active", liked(state.current));
  }
  function addRecent(track) { state.recent = [track, ...state.recent.filter(item => trackKey(item) !== trackKey(track))].slice(0, 50); write(keys.recent, state.recent); renderSideLibraries(); }
  function createPlaylist(initialTrack = null) {
    const name = prompt("Playlist name", `Playlist ${state.playlists.length + 1}`)?.trim();
    if (!name) return;
    state.playlists.push({ id: `playlist-${Date.now()}`, name: name.slice(0, 50), tracks: initialTrack ? [initialTrack] : [] });
    persistLibrary();
  }
  function addToPlaylist(track) {
    if (!state.playlists.length) { createPlaylist(track); return; }
    const choices = state.playlists.map((playlist, index) => `${index + 1}. ${playlist.name}`).join("\n");
    const index = Number.parseInt(prompt(`Add to which playlist?\n${choices}`, "1"), 10) - 1;
    const playlist = state.playlists[index];
    if (!playlist) return;
    if (!playlist.tracks.some(item => trackKey(item) === trackKey(track))) playlist.tracks.push(track);
    persistLibrary();
  }
  function renderPlaylists() {
    refs.playlists.replaceChildren(...state.playlists.map(playlist => {
      const button = document.createElement("button"); button.type = "button"; button.className = "playlist-button"; button.textContent = playlist.name; button.title = `${playlist.name} · ${playlist.tracks.length} tracks`;
      button.addEventListener("click", () => renderCollection(cleanTracks(playlist.tracks), playlist.name, "PLAYLIST", false)); return button;
    }));
  }
  function miniTrack(track, collection) {
    const button = document.createElement("button"); button.type = "button"; button.className = "mini"; button.classList.toggle("playing", trackKey(track) === trackKey(state.current));
    const artwork = track.thumbnail ? Object.assign(new Image(), { src: track.thumbnail, alt: "", loading: "lazy", decoding: "async" }) : null;
    const fallback = document.createElement("span"); fallback.className = "mini-fallback"; fallback.innerHTML = icon("note");
    const copy = document.createElement("span"); const title = document.createElement("strong"); title.textContent = track.title; const artist = document.createElement("small"); artist.textContent = track.creator || "Audius artist"; copy.append(title, artist);
    button.append(artwork || fallback, copy); button.addEventListener("click", () => playTrack(collection.indexOf(track), collection)); return button;
  }
  function renderSideLibraries() {
    refs.likedCount.textContent = String(state.liked.length);
    const likedTracks = cleanTracks(state.liked).slice(0, 5); const recentTracks = cleanTracks(state.recent).slice(0, 5);
    refs.likedList.replaceChildren(...(likedTracks.length ? likedTracks.map(track => miniTrack(track, likedTracks)) : [Object.assign(document.createElement("div"), { className: "mini-empty", textContent: "like a track and it will stay close by" })]));
    refs.historyList.replaceChildren(...(recentTracks.length ? recentTracks.map(track => miniTrack(track, recentTracks)) : [Object.assign(document.createElement("div"), { className: "mini-empty", textContent: "tracks you play will appear here" })]));
  }
  function row(track, index, collection) {
    const article = document.createElement("article"); article.className = "track-row"; article.tabIndex = 0; article.dataset.trackId = trackKey(track); article.classList.toggle("current", trackKey(track) === trackKey(state.current));
    const position = document.createElement("div"); position.className = "track-position"; position.innerHTML = `<span>${index + 1}</span><button type="button" aria-label="Play ${escapeText(track.title)}">${icon("play")}</button>`;
    const art = document.createElement("div"); art.className = "track-art"; art.innerHTML = icon("note");
    if (track.thumbnail) { const image = new Image(); image.alt = ""; image.loading = index < 8 ? "eager" : "lazy"; image.decoding = "async"; image.src = track.thumbnail; image.addEventListener("load", () => art.append(image), { once: true }); }
    const copy = document.createElement("div"); copy.className = "track-copy"; const title = document.createElement("strong"); title.textContent = track.title; const creator = document.createElement("small"); creator.textContent = track.creator || "Audius artist"; copy.append(title, creator);
    const meta = document.createElement("div"); meta.className = "track-meta"; meta.textContent = `${track.genre || "Music"} · Audius upload`;
    const actions = document.createElement("div"); actions.className = "track-actions";
    const like = document.createElement("button"); like.type = "button"; like.dataset.likeId = trackKey(track); like.classList.toggle("active", liked(track)); like.setAttribute("aria-label", "Like track"); like.innerHTML = icon("heart"); like.addEventListener("click", event => { event.stopPropagation(); toggleLike(track); });
    const add = document.createElement("button"); add.type = "button"; add.setAttribute("aria-label", "Add to playlist"); add.innerHTML = icon("plus"); add.addEventListener("click", event => { event.stopPropagation(); addToPlaylist(track); }); actions.append(like, add);
    const duration = document.createElement("span"); duration.className = "track-duration"; duration.textContent = track.durationMs ? time(track.durationMs / 1000) : "--:--";
    article.append(position, art, copy, meta, actions, duration);
    const play = () => playTrack(collection.indexOf(track), collection); article.addEventListener("click", play); article.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); play(); } }); position.querySelector("button").addEventListener("click", event => { event.stopPropagation(); play(); }); return article;
  }
  function escapeText(value) { return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function renderCollection(items, title, kicker = "MUSIC") {
    const tracks = cleanTracks(items); state.collection = tracks; refs.title.textContent = title; refs.kicker.textContent = kicker; refs.count.textContent = `${tracks.length} track${tracks.length === 1 ? "" : "s"}`;
    if (!tracks.length) { const empty = document.createElement("div"); empty.className = "empty"; empty.innerHTML = `${icon("note")}<strong>nothing matched</strong><span>${state.lastQuery ? "That recording is not available in the Audius streaming catalog. Try the title and artist, or look for a creator-uploaded version." : "Search for music or add tracks to your library."}</span>`; refs.results.replaceChildren(empty); }
    else refs.results.replaceChildren(...tracks.map((track, index) => row(track, index, tracks)));
    renderQueue(); updateLikeButtons(); renderSideLibraries();
  }
  function selectView(view) { state.view = view; $$('[data-view]').forEach(button => button.classList.toggle("active", button.dataset.view === view)); }
  async function discover() { selectView("discover"); state.lastQuery = ""; setNotice(""); try { if (!state.featured.length) { refs.results.innerHTML = '<div class="empty">loading the open catalog…</div>'; const payload = await json(`${API}/featured?limit=24`); state.featured = cleanTracks(payload.results); } renderCollection(state.featured, "trending now", "DISCOVER"); } catch (error) { renderCollection([], "catalog unavailable", "DISCOVER"); setNotice(error.message); } }
  async function search(query) { selectView("search"); state.lastQuery = query; setNotice(""); refs.title.textContent = "searching…"; refs.results.replaceChildren(); try { const payload = await json(`${API}/search?q=${encodeURIComponent(query)}&limit=32`); renderCollection(payload.results, `results for “${query}”`, "SEARCH"); } catch (error) { renderCollection([], "search unavailable", "SEARCH"); setNotice(error.message); } }
  function renderQueue() {
    refs.queueCount.textContent = `${state.collection.length} track${state.collection.length === 1 ? "" : "s"}`;
    refs.queueList.replaceChildren(...state.collection.map((track, index) => { const button = document.createElement("button"); button.type = "button"; button.className = "queue-item"; button.classList.toggle("active", index === state.index); const art = track.thumbnail ? Object.assign(new Image(), { src: track.thumbnail, alt: "", loading: "lazy" }) : null; const fallback = document.createElement("span"); fallback.className = "queue-fallback"; fallback.innerHTML = icon("note"); const copy = document.createElement("span"); const title = document.createElement("strong"); title.textContent = track.title; const artist = document.createElement("small"); artist.textContent = track.creator; copy.append(title, artist); button.append(art || fallback, copy); button.addEventListener("click", () => playTrack(index)); return button; }));
  }
  async function playTrack(index, collection = state.collection) {
    const track = collection[index]; if (!track) return; state.collection = collection; state.index = index; state.current = track; setNotice(""); addRecent(track);
    refs.player.classList.add("visible");
    refs.playerTitle.textContent = track.title; refs.playerArtist.textContent = track.creator || "Audius artist"; refs.cover.hidden = true; refs.fallback.hidden = false;
    if (track.thumbnail) { const expectedCover = new URL(track.thumbnail, location.origin).href; refs.cover.onload = () => { if (refs.cover.src !== expectedCover) return; refs.cover.hidden = false; refs.fallback.hidden = true; }; refs.cover.onerror = () => { if (refs.cover.src !== expectedCover) return; refs.cover.hidden = true; refs.fallback.hidden = false; }; refs.cover.src = expectedCover; } else refs.cover.removeAttribute("src");
    refs.source.hidden = !track.sourceUrl; if (track.sourceUrl) refs.source.href = track.sourceUrl;
    refs.audio.src = track.streamUrl; refs.audio.load(); renderQueue(); updateLikeButtons(); $$(".track-row").forEach(item => item.classList.toggle("current", item.dataset.trackId === trackKey(track)));
    renderSideLibraries();
    if ("mediaSession" in navigator && "MediaMetadata" in window) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.creator, album: "Nyxify · Audius", artwork: track.thumbnail ? [{ src: new URL(track.thumbnail, location.origin).href }] : [] }); } catch {} }
    try { await refs.audio.play(); } catch { setNotice("Press play to start. Your browser blocked automatic playback."); }
  }
  function step(direction) { if (!state.collection.length) return; if (state.shuffle) return playTrack(Math.floor(Math.random() * state.collection.length)); const next = (state.index + direction + state.collection.length) % state.collection.length; return playTrack(next); }
  refs.form.addEventListener("submit", event => { event.preventDefault(); const query = refs.input.value.trim(); if (query.length < 2) { setNotice("Enter at least two characters to search."); refs.input.focus(); return; } void search(query); });
  $$('[data-focus-search]').forEach(button => button.addEventListener("click", () => refs.input.focus()));
  document.addEventListener("keydown", event => { if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) { event.preventDefault(); refs.input.focus(); } });
  $$('[data-view]').forEach(button => button.addEventListener("click", () => { const view = button.dataset.view; if (view === "discover") void discover(); else if (view === "liked") { state.lastQuery = ""; selectView(view); renderCollection(state.liked, "liked songs", "YOUR LIBRARY"); } else if (view === "recent") { state.lastQuery = ""; selectView(view); renderCollection(state.recent, "recently played", "HISTORY"); } }));
  $("[data-create-playlist]").addEventListener("click", () => createPlaylist());
  $("[data-back]").addEventListener("click", () => { if (window.parent !== window) window.parent.postMessage({ type: "nyx:close-tab" }, location.origin); else location.href = "/"; });
  refs.play.addEventListener("click", () => { if (!state.current && state.collection.length) void playTrack(0); else if (refs.audio.paused) void refs.audio.play(); else refs.audio.pause(); }); refs.previous.addEventListener("click", () => void step(-1)); refs.next.addEventListener("click", () => void step(1)); refs.playerLike.addEventListener("click", () => toggleLike());
  refs.shuffle.addEventListener("click", () => { state.shuffle = !state.shuffle; refs.shuffle.classList.toggle("active", state.shuffle); }); refs.repeat.addEventListener("click", () => { state.repeat = (state.repeat + 1) % 3; refs.repeat.classList.toggle("active", state.repeat > 0); refs.repeatOne.hidden = state.repeat !== 2; refs.repeat.setAttribute("aria-label", state.repeat === 2 ? "Repeat one" : state.repeat === 1 ? "Repeat all" : "Repeat off"); });
  refs.audio.addEventListener("play", () => { refs.play.innerHTML = icon("pause"); refs.play.setAttribute("aria-label", "Pause"); if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing"; }); refs.audio.addEventListener("pause", () => { refs.play.innerHTML = icon("play"); refs.play.setAttribute("aria-label", "Play"); if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused"; }); refs.audio.addEventListener("error", () => setNotice("This track could not start. Try another track."));
  refs.audio.addEventListener("ended", () => { if (state.repeat === 2) { refs.audio.currentTime = 0; void refs.audio.play(); } else if (state.index < state.collection.length - 1 || state.repeat === 1) void step(1); }); refs.audio.addEventListener("timeupdate", () => { const duration = Number(refs.audio.duration) || 0; refs.current.textContent = time(refs.audio.currentTime); refs.duration.textContent = time(duration); refs.seek.value = duration ? String(Math.round(refs.audio.currentTime / duration * 1000)) : "0"; });
  refs.seek.addEventListener("input", () => { if (Number.isFinite(refs.audio.duration)) refs.audio.currentTime = Number(refs.seek.value) / 1000 * refs.audio.duration; }); refs.volume.addEventListener("input", () => { refs.audio.volume = Number(refs.volume.value); }); refs.audio.volume = Number(refs.volume.value);
  $$('[data-queue-toggle]').forEach(button => button.addEventListener("click", () => { refs.queue.hidden = !refs.queue.hidden; if (!refs.queue.hidden) renderQueue(); })); $("[data-queue-close]").addEventListener("click", () => { refs.queue.hidden = true; });
  if ("mediaSession" in navigator) { navigator.mediaSession.setActionHandler("play", () => void refs.audio.play()); navigator.mediaSession.setActionHandler("pause", () => refs.audio.pause()); navigator.mediaSession.setActionHandler("previoustrack", () => void step(-1)); navigator.mediaSession.setActionHandler("nexttrack", () => void step(1)); }
  renderPlaylists(); renderSideLibraries(); void discover(); json(`${API}/status`).then(payload => { refs.status.classList.add("online"); refs.status.querySelector("span").textContent = payload.providerLabel || "music ready"; }).catch(() => { refs.status.classList.add("offline"); refs.status.querySelector("span").textContent = "catalog unavailable"; });
})();
