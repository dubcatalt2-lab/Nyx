(() => {
  "use strict";

  const recentKey = "nyx.nyxify.recent.v1";
  const likedKey = "nyx.nyxify.liked.v1";
  const playlistKey = "nyx.nyxify.playlists.v1";

  function readList(key, limit) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value.filter(item => item?.streamUrl && item?.title).slice(0, limit) : [];
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
    recent: readList(recentKey, 24),
    liked: readList(likedKey, 100),
    playlists: readPlaylists(),
    currentIndex: -1,
    current: null,
    shuffled: false,
    repeat: 0
  };
  const refs = {
    back: [...document.querySelectorAll("[data-back-to-nyx]")],
    focusSearch: document.querySelector("[data-focus-search]"),
    viewButtons: [...document.querySelectorAll("[data-view]")],
    createPlaylists: [...document.querySelectorAll("[data-create-playlist]")],
    playlistList: document.querySelector("[data-playlist-list]"),
    form: document.querySelector("[data-search-form]"),
    input: document.querySelector("[data-search-input]"),
    searchButton: document.querySelector("[data-search-button]"),
    status: document.querySelector("[data-api-status]"),
    notice: document.querySelector("[data-notice]"),
    title: document.querySelector("[data-section-title]"),
    count: document.querySelector("[data-result-count]"),
    results: document.querySelector("[data-results]"),
    audio: document.querySelector("[data-audio]"),
    playerTitle: document.querySelector("[data-player-title]"),
    playerArtist: document.querySelector("[data-player-artist]"),
    playerCover: document.querySelector("[data-player-cover]"),
    playerFallback: document.querySelector("[data-player-fallback]"),
    toggle: document.querySelector("[data-toggle-play]"),
    previous: document.querySelector("[data-previous]"),
    next: document.querySelector("[data-next]"),
    shuffle: document.querySelector("[data-shuffle]"),
    repeat: document.querySelector("[data-repeat]"),
    seek: document.querySelector("[data-seek]"),
    currentTime: document.querySelector("[data-current-time]"),
    duration: document.querySelector("[data-duration]"),
    volume: document.querySelector("[data-volume]"),
    queue: document.querySelector("[data-queue]"),
    queueToggle: document.querySelector("[data-queue-toggle]"),
    queueClose: document.querySelector("[data-queue-close]"),
    queueList: document.querySelector("[data-queue-list]")
  };

  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function saveRecent(track) {
    state.recent = [track, ...state.recent.filter(item => item.id !== track.id)].slice(0, 24);
    store(recentKey, state.recent);
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

  function isLiked(track) {
    return state.liked.some(item => item.id === track.id);
  }

  function toggleLiked(track) {
    state.liked = isLiked(track) ? state.liked.filter(item => item.id !== track.id) : [track, ...state.liked].slice(0, 100);
    store(likedKey, state.liked);
    render(state.results, refs.title.textContent);
  }

  function renderPlaylists() {
    refs.playlistList.replaceChildren(...state.playlists.map(playlist => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = playlist.name;
      button.addEventListener("click", () => render(playlist.tracks, playlist.name));
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
    if (!playlist.tracks.some(item => item.id === track.id)) playlist.tracks.push(track);
    savePlaylists();
  }

  function card(track, index) {
    const article = document.createElement("article");
    article.className = "nyxify-card";
    const cover = document.createElement("div");
    cover.className = "nyxify-card-cover";
    const fallback = document.createElement("span");
    fallback.textContent = "\u266b";
    cover.append(fallback);
    if (track.thumbnail) {
      const image = document.createElement("img");
      image.src = track.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("load", () => fallback.remove(), { once: true });
      image.addEventListener("error", () => image.remove(), { once: true });
      cover.append(image);
    }
    const play = document.createElement("button");
    play.type = "button";
    play.className = "nyxify-card-play";
    play.setAttribute("aria-label", `Play ${track.title}`);
    play.textContent = "\u25b6";
    play.addEventListener("click", event => { event.stopPropagation(); void playTrack(index); });
    cover.append(play);

    const actions = document.createElement("div");
    actions.className = "nyxify-card-actions";
    const like = document.createElement("button");
    like.type = "button";
    like.classList.toggle("active", isLiked(track));
    like.setAttribute("aria-label", isLiked(track) ? "Remove from liked songs" : "Add to liked songs");
    like.textContent = isLiked(track) ? "\u2665" : "\u2661";
    like.addEventListener("click", event => { event.stopPropagation(); toggleLiked(track); });
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "+";
    add.setAttribute("aria-label", "Add to playlist");
    add.addEventListener("click", event => { event.stopPropagation(); addToPlaylist(track); });
    actions.append(like, add);

    const title = document.createElement("h3");
    title.textContent = track.title;
    const artist = document.createElement("p");
    artist.textContent = track.creator;
    article.append(actions, cover, title, artist);
    article.tabIndex = 0;
    article.addEventListener("click", () => void playTrack(index));
    article.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void playTrack(index); }
    });
    return article;
  }

  function renderQueue() {
    refs.queueList.replaceChildren(...state.results.map((track, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nyxify-queue-track";
      button.classList.toggle("active", state.current?.id === track.id);
      if (track.thumbnail) {
        const image = document.createElement("img");
        image.src = track.thumbnail;
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        button.append(image);
      } else {
        button.append(document.createElement("i"));
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

  function render(items, title) {
    state.results = items;
    refs.title.textContent = title;
    refs.count.textContent = `${items.length} track${items.length === 1 ? "" : "s"}`;
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "nyxify-empty";
      empty.innerHTML = "<strong>No tracks here yet</strong><span>Search for music to begin your library.</span>";
      refs.results.replaceChildren(empty);
      renderQueue();
      return;
    }
    refs.results.replaceChildren(...items.map(card));
    renderQueue();
  }

  async function playTrack(index) {
    const track = state.results[index];
    if (!track) return;
    state.currentIndex = index;
    state.current = track;
    refs.playerTitle.textContent = track.title;
    refs.playerArtist.textContent = track.creator;
    refs.playerCover.hidden = !track.thumbnail;
    refs.playerFallback.hidden = Boolean(track.thumbnail);
    if (track.thumbnail) refs.playerCover.src = track.thumbnail;
    refs.audio.src = track.streamUrl;
    refs.audio.load();
    saveRecent(track);
    renderQueue();
    try { await refs.audio.play(); } catch { setNotice("Press play to start this track. Your browser blocked automatic playback."); }
  }

  async function search(query) {
    refs.searchButton.disabled = true;
    refs.input.readOnly = true;
    refs.searchButton.textContent = "Searching";
    setNotice("");
    refs.title.textContent = "Searching...";
    refs.count.textContent = "";
    try {
      const payload = await fetchJson(`/api/nyxify/search?q=${encodeURIComponent(query)}&limit=20`);
      render(Array.isArray(payload?.results) ? payload.results : [], `Results for "${query}"`);
    } catch (error) {
      render([], "Search unavailable");
      setNotice(error.message || "Nyxify could not complete that search.");
    } finally {
      refs.searchButton.disabled = false;
      refs.input.readOnly = false;
      refs.searchButton.textContent = "Search";
    }
  }

  refs.form.addEventListener("submit", event => {
    event.preventDefault();
    const query = refs.input.value.trim();
    if (query.length < 2) { setNotice("Enter at least two characters to search."); refs.input.focus(); return; }
    void search(query);
  });
  refs.focusSearch?.addEventListener("click", () => refs.input.focus());
  refs.viewButtons.forEach(button => button.addEventListener("click", () => {
    refs.viewButtons.forEach(item => item.classList.toggle("active", item === button));
    if (button.dataset.view === "liked") render(state.liked, "Liked songs");
    else if (button.dataset.view === "library") render(state.recent, "Recently played");
    else render(state.recent, state.recent.length ? "Recently played" : "Start listening");
  }));
  refs.createPlaylists.forEach(button => button.addEventListener("click", () => createPlaylist()));
  refs.back.forEach(button => button.addEventListener("click", () => {
    if (window.parent !== window) window.parent.postMessage({ type: "nyx:close-tab" }, location.origin);
    else location.href = "/";
  }));
  refs.toggle.addEventListener("click", () => {
    if (!state.current && state.results.length) { void playTrack(0); return; }
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
    refs.repeat.textContent = state.repeat === 2 ? "\u21bb1" : "\u21bb";
    refs.repeat.title = state.repeat === 2 ? "Repeat one" : (state.repeat === 1 ? "Repeat all" : "Repeat off");
  });
  refs.audio.addEventListener("play", () => {
    refs.toggle.textContent = "II";
    refs.toggle.setAttribute("aria-label", "Pause");
  });
  refs.audio.addEventListener("pause", () => {
    refs.toggle.textContent = "\u25b6";
    refs.toggle.setAttribute("aria-label", "Play");
  });
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
  refs.queueToggle.addEventListener("click", () => {
    refs.queue.hidden = !refs.queue.hidden;
    if (!refs.queue.hidden) renderQueue();
  });
  refs.queueClose.addEventListener("click", () => { refs.queue.hidden = true; });

  render(state.recent, state.recent.length ? "Recently played" : "Start listening");
  renderPlaylists();
  fetchJson("/api/nyxify/status").then(() => {
    refs.status.classList.add("online");
    refs.status.querySelector("span").textContent = "Music API ready";
  }).catch(() => {
    refs.status.classList.add("offline");
    refs.status.querySelector("span").textContent = "Music API unavailable";
  });
})();
