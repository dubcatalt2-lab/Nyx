(() => {
  "use strict";

  const recentKey = "nyx.nyxify.recent.v1";
  const likedKey = "nyx.nyxify.liked.v1";
  const playlistKey = "nyx.nyxify.playlists.v1";

  function musicArtworkUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, location.origin);
      if (url.origin === location.origin && /^\/api\/music\/artwork\/\d{1,24}$/.test(url.pathname)) return `${url.pathname}${url.search}`;
      if (url.hostname === "api.qijieya.cn" && /^\/meting\/?$/.test(url.pathname) && String(url.searchParams.get("type") || "").toLowerCase() === "pic") {
        const id = String(url.searchParams.get("id") || "").trim();
        if (/^\d{1,24}$/.test(id)) return `/api/music/artwork/${encodeURIComponent(id)}`;
      }
    } catch {}
    return raw;
  }

  function readList(key, limit) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value.filter(item => item?.streamUrl && item?.title).slice(0, limit).map(item => ({ ...item, thumbnail: musicArtworkUrl(item.thumbnail) })) : [];
    } catch { return []; }
  }

  function readPlaylists() {
    try {
      const value = JSON.parse(localStorage.getItem(playlistKey) || "[]");
      return Array.isArray(value) ? value.filter(item => item?.id && item?.name && Array.isArray(item.tracks)).slice(0, 30) : [];
    } catch { return []; }
  }

  const state = {
    results: [],
    discovery: [],
    recent: readList(recentKey, 24),
    liked: readList(likedKey, 100),
    playlists: readPlaylists(),
    currentIndex: -1,
    current: null,
    shuffled: false,
    repeat: 0,
    activeView: "home",
    discoveryLoaded: false,
    discoveryBusy: false
  };

  const refs = {
    back: [...document.querySelectorAll("[data-back-to-nyx]")],
    focusSearch: [...document.querySelectorAll("[data-focus-search]")],
    viewButtons: [...document.querySelectorAll("[data-view]")],
    mixButtons: [...document.querySelectorAll("[data-mix-query]")],
    createPlaylists: [...document.querySelectorAll("[data-create-playlist]")],
    playlistList: document.querySelector("[data-playlist-list]"),
    likedCount: document.querySelector("[data-liked-count]"),
    recentCount: document.querySelector("[data-recent-count]"),
    form: document.querySelector("[data-search-form]"),
    input: document.querySelector("[data-search-input]"),
    searchButton: document.querySelector("[data-search-button]"),
    searchButtonLabel: document.querySelector("[data-search-button-label]"),
    status: document.querySelector("[data-api-status]"),
    notice: document.querySelector("[data-notice]"),
    homeView: document.querySelector("[data-home-view]"),
    browseView: document.querySelector("[data-browse-view]"),
    homePopular: document.querySelector("[data-home-popular]"),
    homeArtists: document.querySelector("[data-home-artists]"),
    showPopular: document.querySelector("[data-show-popular]"),
    title: document.querySelector("[data-section-title]"),
    count: document.querySelector("[data-result-count]"),
    results: document.querySelector("[data-results]"),
    audio: document.querySelector("[data-audio]"),
    playerTitle: document.querySelector("[data-player-title]"),
    playerArtist: document.querySelector("[data-player-artist]"),
    playerSource: document.querySelector("[data-player-source]"),
    playerCover: document.querySelector("[data-player-cover]"),
    playerFallback: document.querySelector("[data-player-fallback]"),
    toggle: document.querySelector("[data-toggle-play]"),
    previous: document.querySelector("[data-previous]"),
    next: document.querySelector("[data-next]"),
    shuffle: document.querySelector("[data-shuffle]"),
    repeat: document.querySelector("[data-repeat]"),
    repeatOne: document.querySelector("[data-repeat-one]"),
    seek: document.querySelector("[data-seek]"),
    currentTime: document.querySelector("[data-current-time]"),
    duration: document.querySelector("[data-duration]"),
    volume: document.querySelector("[data-volume]"),
    queue: document.querySelector("[data-queue]"),
    queueToggle: [...document.querySelectorAll("[data-queue-toggle]")],
    queueClose: document.querySelector("[data-queue-close]"),
    queueList: document.querySelector("[data-queue-list]")
  };

  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function iconMarkup(name) {
    return `<svg aria-hidden="true"><use href="#nyxify-icon-${name}"></use></svg>`;
  }

  function setButtonIcon(button, name) {
    const use = button?.querySelector("use");
    if (use) use.setAttribute("href", `#nyxify-icon-${name}`);
  }

  function trackKey(track) {
    return `${String(track?.provider || "music")}:${String(track?.providerId || track?.id || "")}`;
  }

  function saveRecent(track) {
    const key = trackKey(track);
    state.recent = [track, ...state.recent.filter(item => trackKey(item) !== key)].slice(0, 24);
    store(recentKey, state.recent);
    updateLibraryCounts();
  }

  function setNotice(message = "") {
    refs.notice.textContent = message;
    refs.notice.hidden = !message;
  }

  function timeLabel(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const type = String(response.headers.get("content-type") || "");
    const payload = type.includes("application/json") ? await response.json() : {};
    if (!response.ok) throw new Error(payload?.error || "Nyxify could not reach the music service.");
    return payload;
  }

  function setMixCover(button, track) {
    const cover = button?.querySelector("i");
    const source = musicArtworkUrl(track?.thumbnail);
    if (!cover || !source) return;
    const image = document.createElement("img");
    image.src = source;
    image.alt = "";
    image.loading = "eager";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => {
      cover.querySelectorAll("img").forEach(existing => {
        if (existing !== image) existing.remove();
      });
      cover.classList.add("has-cover");
    }, { once: true });
    image.addEventListener("error", () => image.remove(), { once: true });
    cover.append(image);
  }

  async function loadMixCovers() {
    await Promise.allSettled(refs.mixButtons.map(async button => {
      const query = String(button.dataset.mixQuery || "").trim();
      if (!query) return;
      const payload = await fetchJson(`/api/nyxify/search?q=${encodeURIComponent(query)}&limit=1`);
      const leadingTrack = Array.isArray(payload?.results) ? payload.results[0] : null;
      setMixCover(button, leadingTrack);
    }));
  }

  function updateLibraryCounts() {
    refs.likedCount.textContent = `Playlist - ${state.liked.length} song${state.liked.length === 1 ? "" : "s"}`;
    refs.recentCount.textContent = `${state.recent.length} recent track${state.recent.length === 1 ? "" : "s"}`;
  }

  function isLiked(track) {
    const key = trackKey(track);
    return state.liked.some(item => trackKey(item) === key);
  }

  function toggleLiked(track, button) {
    const key = trackKey(track);
    state.liked = isLiked(track) ? state.liked.filter(item => trackKey(item) !== key) : [track, ...state.liked].slice(0, 100);
    store(likedKey, state.liked);
    updateLibraryCounts();
    if (button) {
      const liked = isLiked(track);
      button.classList.toggle("active", liked);
      button.innerHTML = iconMarkup(liked ? "heart-fill" : "heart");
      button.setAttribute("aria-label", liked ? "Remove from liked songs" : "Add to liked songs");
    }
  }

  function renderPlaylists() {
    refs.playlistList.replaceChildren(...state.playlists.map(playlist => {
      const button = document.createElement("button");
      button.type = "button";
      const art = document.createElement("i");
      art.innerHTML = iconMarkup("note");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = playlist.name;
      const count = document.createElement("small");
      count.textContent = `Playlist - ${playlist.tracks.length} song${playlist.tracks.length === 1 ? "" : "s"}`;
      copy.append(title, count);
      button.append(art, copy);
      button.addEventListener("click", () => renderBrowse(playlist.tracks, playlist.name));
      return button;
    }));
  }

  function savePlaylists() {
    store(playlistKey, state.playlists);
    renderPlaylists();
  }

  function createPlaylist(initialTrack = null) {
    const name = window.prompt("Playlist name", `My playlist ${state.playlists.length + 1}`)?.trim();
    if (!name) return null;
    const playlist = { id: `playlist-${Date.now()}`, name: name.slice(0, 50), tracks: initialTrack ? [initialTrack] : [] };
    state.playlists.push(playlist);
    savePlaylists();
    return playlist;
  }

  function addToPlaylist(track) {
    if (!state.playlists.length) { createPlaylist(track); return; }
    const options = state.playlists.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
    const choice = Number.parseInt(window.prompt(`Add to which playlist?\n${options}`, "1"), 10) - 1;
    const playlist = state.playlists[choice];
    if (!playlist) return;
    if (!playlist.tracks.some(item => trackKey(item) === trackKey(track))) playlist.tracks.push(track);
    savePlaylists();
  }

  function playFromCollection(track, collection) {
    state.results = collection;
    const index = collection.findIndex(item => trackKey(item) === trackKey(track));
    void playTrack(Math.max(0, index));
  }

  function card(track, index, collection = state.results) {
    const article = document.createElement("article");
    article.className = "nyxify-card";
    const cover = document.createElement("div");
    cover.className = "nyxify-card-cover";
    const fallback = document.createElement("span");
    fallback.innerHTML = iconMarkup("note");
    cover.append(fallback);
    if (track.thumbnail) {
      const image = document.createElement("img");
      image.src = musicArtworkUrl(track.thumbnail);
      image.alt = "";
      image.loading = "eager";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("load", () => fallback.remove(), { once: true });
      image.addEventListener("error", () => image.remove(), { once: true });
      cover.append(image);
    }
    const play = document.createElement("button");
    play.type = "button";
    play.className = "nyxify-card-play";
    play.setAttribute("aria-label", `Play ${track.title}`);
    play.innerHTML = iconMarkup("play");
    play.addEventListener("click", event => { event.stopPropagation(); playFromCollection(track, collection); });
    cover.append(play);

    const actions = document.createElement("div");
    actions.className = "nyxify-card-actions";
    const like = document.createElement("button");
    like.type = "button";
    like.classList.toggle("active", isLiked(track));
    like.setAttribute("aria-label", isLiked(track) ? "Remove from liked songs" : "Add to liked songs");
    like.innerHTML = iconMarkup(isLiked(track) ? "heart-fill" : "heart");
    like.addEventListener("click", event => { event.stopPropagation(); toggleLiked(track, like); });
    const add = document.createElement("button");
    add.type = "button";
    add.innerHTML = iconMarkup("plus");
    add.setAttribute("aria-label", "Add to playlist");
    add.addEventListener("click", event => { event.stopPropagation(); addToPlaylist(track); });
    actions.append(like, add);

    const title = document.createElement("h3");
    title.textContent = track.title;
    const artist = document.createElement("p");
    artist.textContent = track.creator;
    article.append(actions, cover, title, artist);
    if (track.sourceUrl) {
      const source = document.createElement("a");
      source.className = "nyxify-card-source";
      source.href = track.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = track.providerLabel || (track.provider === "soundcloud" ? "SoundCloud" : "Source");
      source.insertAdjacentHTML("beforeend", iconMarkup("external"));
      source.addEventListener("click", event => event.stopPropagation());
      article.append(source);
    }
    article.tabIndex = 0;
    article.addEventListener("click", () => playFromCollection(track, collection));
    article.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playFromCollection(track, collection); }
    });
    return article;
  }

  function renderQueue() {
    refs.queueList.replaceChildren(...state.results.map((track, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nyxify-queue-track";
      button.classList.toggle("active", trackKey(state.current) === trackKey(track));
      const fallback = document.createElement("i");
      fallback.innerHTML = iconMarkup("note");
      button.append(fallback);
      if (track.thumbnail) {
        const image = document.createElement("img");
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("load", () => fallback.replaceWith(image), { once: true });
        image.src = musicArtworkUrl(track.thumbnail);
      }
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = track.title;
      const artist = document.createElement("small");
      artist.textContent = track.creator;
      copy.append(title, artist);
      button.append(copy);
      button.addEventListener("click", () => void playTrack(index));
      return button;
    }));
  }

  function activateView(view) {
    state.activeView = view;
    refs.viewButtons.forEach(button => button.classList.toggle("active", button.dataset.view === view));
  }

  function showHome() {
    activateView("home");
    refs.homeView.hidden = false;
    refs.browseView.hidden = true;
    setNotice("");
    if (!state.discoveryLoaded && !state.discoveryBusy) void loadDiscovery();
  }

  function renderBrowse(items, title) {
    activateView(title === "Liked songs" ? "liked" : (title === "Recently played" ? "library" : "search"));
    refs.homeView.hidden = true;
    refs.browseView.hidden = false;
    state.results = items;
    refs.title.textContent = title;
    refs.count.textContent = `${items.length} track${items.length === 1 ? "" : "s"}`;
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "nyxify-empty";
      const emptyTitle = title === "Liked songs" ? "No liked songs yet" : (title === "Recently played" ? "Your listening history is empty" : "Find something to play");
      const emptyDetail = title === "Liked songs" ? "Tap the heart on a track to keep it here." : "Search for a song, artist, or album to get started.";
      empty.innerHTML = `${iconMarkup("note")}<strong>${emptyTitle}</strong><span>${emptyDetail}</span>`;
      refs.results.replaceChildren(empty);
      renderQueue();
      return;
    }
    refs.results.replaceChildren(...items.map((track, index) => card(track, index, items)));
    renderQueue();
  }

  function artistButton(artist) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nyxify-artist";
    const fallback = document.createElement("i");
    fallback.innerHTML = iconMarkup("note");
    button.append(fallback);
    if (artist.thumbnail) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "eager";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("load", () => fallback.replaceWith(image), { once: true });
      image.src = musicArtworkUrl(artist.thumbnail);
    }
    const name = document.createElement("strong");
    name.textContent = artist.name;
    const type = document.createElement("span");
    type.textContent = "Artist";
    button.append(name, type);
    button.addEventListener("click", () => { refs.input.value = artist.name; void search(artist.name); });
    return button;
  }

  function renderDiscovery(tracks) {
    state.discovery = tracks;
    refs.homePopular.replaceChildren(...tracks.slice(0, 7).map((track, index) => card(track, index, tracks)));
    const seen = new Set();
    const artists = [];
    tracks.forEach(track => {
      const name = String(track.creator || "").trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      artists.push({ name, thumbnail: track.thumbnail });
    });
    refs.homeArtists.replaceChildren(...artists.slice(0, 7).map(artistButton));
  }

  async function loadDiscovery() {
    state.discoveryBusy = true;
    try {
      const payload = await fetchJson("/api/nyxify/search?q=global%20hits&limit=20");
      const tracks = Array.isArray(payload?.results) ? payload.results : [];
      if (tracks.length) {
        state.discoveryLoaded = true;
        renderDiscovery(tracks);
      } else if (state.recent.length) {
        renderDiscovery(state.recent);
      }
    } catch {
      if (state.recent.length) renderDiscovery(state.recent);
      else refs.homePopular.innerHTML = '<div class="nyxify-empty"><strong>Discovery is taking a break</strong><span>Search for a song or artist to keep listening.</span></div>';
    } finally {
      state.discoveryBusy = false;
    }
  }

  async function playTrack(index) {
    const track = state.results[index];
    if (!track) return;
    state.currentIndex = index;
    state.current = track;
    refs.playerTitle.textContent = track.title;
    refs.playerArtist.textContent = track.creator;
    refs.playerCover.hidden = true;
    refs.playerFallback.hidden = false;
    if (track.thumbnail) {
      refs.playerCover.onload = () => { refs.playerCover.hidden = false; refs.playerFallback.hidden = true; };
      refs.playerCover.onerror = () => { refs.playerCover.hidden = true; refs.playerFallback.hidden = false; };
      refs.playerCover.src = musicArtworkUrl(track.thumbnail);
    } else {
      refs.playerCover.removeAttribute("src");
    }
    if (track.sourceUrl) {
      refs.playerSource.hidden = false;
      refs.playerSource.href = track.sourceUrl;
      refs.playerSource.firstChild.textContent = track.provider === "soundcloud" ? "SoundCloud " : "Open source ";
    } else {
      refs.playerSource.hidden = true;
      refs.playerSource.removeAttribute("href");
    }
    refs.audio.src = track.streamUrl;
    refs.audio.load();
    saveRecent(track);
    renderQueue();
    setNotice("");
    try { await refs.audio.play(); } catch { setNotice("Press play to start this track. Your browser blocked automatic playback."); }
  }

  async function search(query) {
    refs.searchButton.disabled = true;
    refs.input.readOnly = true;
    refs.searchButtonLabel.textContent = "Searching";
    setNotice("");
    refs.homeView.hidden = true;
    refs.browseView.hidden = false;
    refs.title.textContent = "Searching...";
    refs.count.textContent = "";
    try {
      const payload = await fetchJson(`/api/nyxify/search?q=${encodeURIComponent(query)}&limit=20`);
      renderBrowse(Array.isArray(payload?.results) ? payload.results : [], `Results for \"${query}\"`);
    } catch (error) {
      renderBrowse([], "Search unavailable");
      setNotice(error.message || "Nyxify could not complete that search.");
    } finally {
      refs.searchButton.disabled = false;
      refs.input.readOnly = false;
      refs.searchButtonLabel.textContent = "Search";
    }
  }

  refs.form.addEventListener("submit", event => {
    event.preventDefault();
    const query = refs.input.value.trim();
    if (query.length < 2) { setNotice("Enter at least two characters to search."); refs.input.focus(); return; }
    void search(query);
  });
  refs.focusSearch.forEach(button => button.addEventListener("click", () => refs.input.focus()));
  refs.viewButtons.forEach(button => button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view === "liked") renderBrowse(state.liked, "Liked songs");
    else if (view === "library") renderBrowse(state.recent, "Recently played");
    else showHome();
  }));
  refs.mixButtons.forEach(button => button.addEventListener("click", () => {
    const query = button.dataset.mixQuery || "";
    refs.input.value = query;
    void search(query);
  }));
  refs.showPopular.addEventListener("click", () => renderBrowse(state.discovery, "Popular tracks"));
  refs.createPlaylists.forEach(button => button.addEventListener("click", () => createPlaylist()));
  refs.back.forEach(button => button.addEventListener("click", () => {
    if (window.parent !== window) window.parent.postMessage({ type: "nyx:close-tab" }, location.origin);
    else location.href = "/";
  }));
  refs.toggle.addEventListener("click", () => {
    if (!state.current && state.results.length) { void playTrack(0); return; }
    if (!state.current && state.discovery.length) { playFromCollection(state.discovery[0], state.discovery); return; }
    if (refs.audio.paused) void refs.audio.play(); else refs.audio.pause();
  });
  refs.previous.addEventListener("click", () => {
    if (state.results.length) void playTrack((state.currentIndex - 1 + state.results.length) % state.results.length);
  });
  refs.next.addEventListener("click", () => {
    if (state.results.length) void playTrack((state.currentIndex + 1) % state.results.length);
  });
  refs.shuffle.addEventListener("click", () => {
    state.shuffled = !state.shuffled;
    refs.shuffle.classList.toggle("active", state.shuffled);
  });
  refs.repeat.addEventListener("click", () => {
    state.repeat = (state.repeat + 1) % 3;
    refs.repeat.classList.toggle("active", state.repeat > 0);
    refs.repeatOne.hidden = state.repeat !== 2;
    refs.repeat.title = state.repeat === 2 ? "Repeat one" : (state.repeat === 1 ? "Repeat all" : "Repeat off");
    refs.repeat.setAttribute("aria-label", refs.repeat.title);
  });
  refs.audio.addEventListener("play", () => {
    setButtonIcon(refs.toggle, "pause");
    refs.toggle.setAttribute("aria-label", "Pause");
    refs.toggle.title = "Pause";
  });
  refs.audio.addEventListener("pause", () => {
    setButtonIcon(refs.toggle, "play");
    refs.toggle.setAttribute("aria-label", "Play");
    refs.toggle.title = "Play";
  });
  refs.audio.addEventListener("error", () => setNotice("This track could not start. Try it again or choose another result."));
  refs.audio.addEventListener("ended", () => {
    if (state.repeat === 2) { refs.audio.currentTime = 0; void refs.audio.play(); return; }
    if (!state.results.length) return;
    if (state.shuffled) { void playTrack(Math.floor(Math.random() * state.results.length)); return; }
    if (state.currentIndex < state.results.length - 1 || state.repeat === 1) refs.next.click();
  });
  refs.audio.addEventListener("timeupdate", () => {
    const duration = Number(refs.audio.duration) || 0;
    refs.currentTime.textContent = timeLabel(refs.audio.currentTime);
    refs.duration.textContent = timeLabel(duration);
    refs.seek.value = duration ? String((refs.audio.currentTime / duration) * 100) : "0";
  });
  refs.seek.addEventListener("input", () => {
    if (Number.isFinite(refs.audio.duration)) refs.audio.currentTime = (Number(refs.seek.value) / 100) * refs.audio.duration;
  });
  refs.volume.addEventListener("input", () => { refs.audio.volume = Number(refs.volume.value); });
  refs.audio.volume = Number(refs.volume.value);
  refs.queueToggle.forEach(button => button.addEventListener("click", () => {
    refs.queue.hidden = !refs.queue.hidden;
    if (!refs.queue.hidden) renderQueue();
  }));
  refs.queueClose.addEventListener("click", () => { refs.queue.hidden = true; });

  updateLibraryCounts();
  renderPlaylists();
  showHome();
  void loadMixCovers();
  fetchJson("/api/nyxify/status").then(payload => {
    refs.status.classList.add("online");
    refs.status.querySelector("span").textContent = `${payload?.providerLabel || "Music catalog"} ready`;
  }).catch(() => {
    refs.status.classList.add("offline");
    refs.status.querySelector("span").textContent = "Catalog unavailable";
  });
})();
