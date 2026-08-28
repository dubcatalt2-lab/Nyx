(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const views = Object.fromEntries($$("[data-view]").map(view => [view.dataset.view, view]));
  const state = {
    view: "home", videos: [], shorts: [], shortIndex: 0,
    watchPlayer: null, shortPlayer: null, watchTimer: 0, shortTimer: 0,
    watchVideo: null, watchCaptions: false, shortCaptions: false, shortMuted: true,
  };
  const refs = Object.fromEntries([
    "notice", "search-form", "search-input", "feed-title", "result-count", "video-grid",
    "watch-stage", "watch-player", "watch-loading", "watch-center-play", "watch-toggle", "watch-time",
    "watch-mute", "watch-captions", "watch-caption-option", "watch-fullscreen", "watch-progress",
    "watch-title", "watch-creator", "watch-channel-mark", "watch-source", "short-stage", "short-player",
    "short-loading", "short-center-play", "short-mute", "short-captions", "short-fullscreen",
    "short-progress", "short-title", "short-creator",
  ].map(name => [name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()), $(`[data-${name}]`)]));

  function applyTheme() {
    const raw = String(localStorage.getItem("theme") || localStorage.getItem("nyxTheme") || "").toLowerCase();
    const theme = ["ruby", "emerald", "sakura", "fresh"].find(name => raw.includes(name));
    if (theme) document.body.classList.add(`theme-${theme}`);
  }
  const icon = id => `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;
  function notice(message = "") { refs.notice.textContent = message; refs.notice.hidden = !message; }
  async function json(url) {
    const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
    let payload = null;
    try { payload = await response.json(); } catch { /* reported below */ }
    if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
    return payload;
  }
  function duration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), secs = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
  }
  function viewsLabel(value) {
    const count = Number(value) || 0;
    if (count >= 1e9) return `${(count / 1e9).toFixed(count >= 1e10 ? 0 : 1)}B views`;
    if (count >= 1e6) return `${(count / 1e6).toFixed(count >= 1e7 ? 0 : 1)}M views`;
    if (count >= 1e3) return `${(count / 1e3).toFixed(count >= 1e4 ? 0 : 1)}K views`;
    return count ? `${count.toLocaleString()} views` : "YouTube";
  }
  function skeletons() {
    refs.videoGrid.replaceChildren(...Array.from({ length: 8 }, () => {
      const card = document.createElement("article");
      card.className = "video-card skeleton";
      card.innerHTML = '<div class="video-cover"></div><b></b><i></i>';
      return card;
    }));
  }
  function renderVideos(videos) {
    state.videos = Array.isArray(videos) ? videos : [];
    refs.resultCount.textContent = `${state.videos.length} video${state.videos.length === 1 ? "" : "s"}`;
    if (!state.videos.length) {
      const empty = document.createElement("p");
      empty.className = "empty-grid";
      empty.textContent = "No playable videos were found.";
      refs.videoGrid.replaceChildren(empty);
      return;
    }
    refs.videoGrid.replaceChildren(...state.videos.map(video => {
      const card = document.createElement("article"); card.className = "video-card";
      const cover = document.createElement("button"); cover.className = "video-cover"; cover.type = "button";
      cover.setAttribute("aria-label", `Play ${video.title || "video"}`);
      const image = document.createElement("img"); image.alt = ""; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; image.src = video.thumbnail || "";
      image.addEventListener("error", () => image.remove());
      const fallback = document.createElement("span"); fallback.className = "fallback"; fallback.innerHTML = icon("icon-play");
      const stamp = document.createElement("span"); stamp.className = "duration"; stamp.textContent = duration(video.durationSeconds);
      cover.append(image, fallback, stamp); cover.addEventListener("click", () => openWatch(video));
      const copy = document.createElement("div"); copy.className = "card-copy";
      const title = document.createElement("strong"); title.textContent = video.title || "Untitled video";
      const meta = document.createElement("span"); meta.textContent = `${video.creator || "YouTube"} · ${viewsLabel(video.viewCount)}`;
      copy.append(title, meta); card.append(cover, copy); return card;
    }));
  }
  async function loadFeed(query = "") {
    notice(); skeletons(); refs.resultCount.textContent = "Loading...";
    refs.feedTitle.textContent = query ? `Results for “${query}”` : "Popular videos";
    refs.searchForm.querySelector("button").disabled = true;
    try {
      const endpoint = query ? `/api/nyxtube/search?q=${encodeURIComponent(query)}&limit=20` : "/api/nyxtube/feed?limit=20";
      renderVideos((await json(endpoint))?.videos);
    } catch (error) { renderVideos([]); notice(error.message || "Videos could not be loaded."); }
    finally { refs.searchForm.querySelector("button").disabled = false; }
  }
  function showView(name) {
    state.view = name;
    Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
    $$("[data-view-button]").forEach(button => button.classList.toggle("active", button.dataset.viewButton === (name === "watch" ? "home" : name)));
    if (name !== "watch") stopWatch();
    if (name !== "shorts") stopShorts();
    scrollTo({ top: 0, behavior: "smooth" });
  }

  let iframeApi;
  function youtubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (iframeApi) return iframeApi;
    iframeApi = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timer = setTimeout(() => reject(new Error("The YouTube player took too long to start.")), 15000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(window.YT); };
      const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true;
      script.addEventListener("error", () => { clearTimeout(timer); reject(new Error("The YouTube player could not be loaded.")); });
      document.head.append(script);
    });
    return iframeApi;
  }
  function mount(container, name) {
    container.replaceChildren();
    const element = document.createElement("div"); element.id = `${name}-${Date.now()}`; container.append(element); return element.id;
  }
  function options(videoId, short = false) {
    return { width: "100%", height: "100%", videoId, host: "https://www.youtube-nocookie.com", playerVars: {
      autoplay: 1, controls: 0, disablekb: 1, enablejsapi: 1, fs: 0, modestbranding: 1, playsinline: 1, rel: 0,
      origin: location.origin, ...(short ? { mute: 1 } : {}),
    } };
  }
  const ready = player => player && typeof player.getPlayerState === "function";
  function updateToggle(button, playing) {
    button.innerHTML = icon(playing ? "icon-pause" : "icon-play");
    button.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function openWatch(video) {
    if (!video?.id) return;
    state.watchVideo = video; showView("watch"); notice();
    refs.watchTitle.textContent = video.title || "Untitled video";
    refs.watchCreator.textContent = `${video.creator || "YouTube"} · ${viewsLabel(video.viewCount)}`;
    refs.watchChannelMark.textContent = (video.creator || "Y").trim().slice(0, 1).toUpperCase();
    refs.watchSource.href = video.sourceUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    refs.watchLoading.hidden = false; refs.watchCenterPlay.hidden = true; refs.watchProgress.value = "0";
    refs.watchTime.textContent = `0:00 / ${duration(video.durationSeconds)}`;
    createWatch(video).catch(error => { refs.watchLoading.hidden = true; notice(error.message || "The video player could not be started."); });
  }
  async function createWatch(video) {
    const YT = await youtubeApi();
    if (state.view !== "watch" || state.watchVideo?.id !== video.id) return;
    state.watchPlayer?.destroy?.();
    const config = options(video.id);
    config.events = {
      onReady: event => { refs.watchLoading.hidden = true; event.target.playVideo(); startWatchTimer(); },
      onStateChange: event => {
        const playing = event.data === YT.PlayerState.PLAYING, paused = event.data === YT.PlayerState.PAUSED;
        if (playing) refs.watchLoading.hidden = true;
        updateToggle(refs.watchToggle, playing); refs.watchCenterPlay.hidden = !paused;
      },
      onError: () => { refs.watchLoading.hidden = true; notice("This video is not available for embedded playback."); },
    };
    state.watchPlayer = new YT.Player(mount(refs.watchPlayer, "nyxtube-watch"), config);
  }
  function startWatchTimer() {
    clearInterval(state.watchTimer);
    state.watchTimer = setInterval(() => {
      if (!ready(state.watchPlayer)) return;
      const current = Number(state.watchPlayer.getCurrentTime?.()) || 0;
      const total = Number(state.watchPlayer.getDuration?.()) || Number(state.watchVideo?.durationSeconds) || 0;
      refs.watchTime.textContent = `${duration(current)} / ${duration(total)}`;
      refs.watchProgress.value = total ? String(Math.round(current / total * 1000)) : "0";
    }, 250);
  }
  function stopWatch() {
    clearInterval(state.watchTimer); state.watchTimer = 0; state.watchPlayer?.destroy?.(); state.watchPlayer = null; refs.watchPlayer.replaceChildren();
  }
  function toggleWatch() {
    if (!ready(state.watchPlayer)) return;
    state.watchPlayer.getPlayerState() === window.YT.PlayerState.PLAYING ? state.watchPlayer.pauseVideo() : state.watchPlayer.playVideo();
  }
  function toggleWatchMute() {
    if (!ready(state.watchPlayer)) return;
    const muted = Boolean(state.watchPlayer.isMuted?.()); muted ? state.watchPlayer.unMute() : state.watchPlayer.mute();
    refs.watchMute.innerHTML = icon(muted ? "icon-volume" : "icon-muted"); refs.watchMute.setAttribute("aria-label", muted ? "Mute" : "Unmute");
  }
  function setCaptions(player, enabled, button, option) {
    if (!ready(player)) return false;
    try { enabled ? player.loadModule?.("captions") : player.unloadModule?.("captions"); } catch { return false; }
    button.setAttribute("aria-pressed", String(enabled));
    if (option) option.querySelector("span").textContent = enabled ? "On" : "Off";
    return true;
  }
  function fullscreen(element) {
    const request = element.requestFullscreen || element.webkitRequestFullscreen; if (request) request.call(element).catch?.(() => {});
  }

  async function loadShorts() {
    notice(); refs.shortLoading.hidden = false;
    try {
      if (!state.shorts.length) state.shorts = (await json("/api/nyxtube/shorts?limit=16"))?.videos || [];
      if (!state.shorts.length) throw new Error("No playable Shorts were found.");
      await showShort(state.shortIndex);
    } catch (error) { refs.shortLoading.hidden = true; notice(error.message || "Shorts could not be loaded."); }
  }
  async function showShort(index) {
    if (!state.shorts.length) return;
    state.shortIndex = (index + state.shorts.length) % state.shorts.length;
    const video = state.shorts[state.shortIndex];
    refs.shortTitle.textContent = video.title || "Untitled Short"; refs.shortCreator.textContent = video.creator || "YouTube";
    refs.shortLoading.hidden = false; refs.shortCenterPlay.hidden = true; refs.shortProgress.style.width = "0";
    const YT = await youtubeApi(); if (state.view !== "shorts") return;
    state.shortPlayer?.destroy?.();
    const config = options(video.id, true);
    config.events = {
      onReady: event => { event.target.mute(); state.shortMuted = true; refs.shortMute.innerHTML = icon("icon-muted"); event.target.playVideo(); refs.shortLoading.hidden = true; startShortTimer(); },
      onStateChange: event => {
        const playing = event.data === YT.PlayerState.PLAYING, paused = event.data === YT.PlayerState.PAUSED;
        if (playing) refs.shortLoading.hidden = true;
        refs.shortCenterPlay.hidden = !paused;
        if (event.data === YT.PlayerState.ENDED) showShort(state.shortIndex + 1);
      },
      onError: () => showShort(state.shortIndex + 1),
    };
    state.shortPlayer = new YT.Player(mount(refs.shortPlayer, "nyxtube-short"), config);
  }
  function startShortTimer() {
    clearInterval(state.shortTimer);
    state.shortTimer = setInterval(() => {
      if (!ready(state.shortPlayer)) return;
      const current = Number(state.shortPlayer.getCurrentTime?.()) || 0, total = Number(state.shortPlayer.getDuration?.()) || 0;
      refs.shortProgress.style.width = total ? `${Math.min(100, current / total * 100)}%` : "0";
    }, 250);
  }
  function stopShorts() {
    clearInterval(state.shortTimer); state.shortTimer = 0; state.shortPlayer?.destroy?.(); state.shortPlayer = null; refs.shortPlayer.replaceChildren();
  }
  function toggleShort() {
    if (!ready(state.shortPlayer)) return;
    state.shortPlayer.getPlayerState() === window.YT.PlayerState.PLAYING ? state.shortPlayer.pauseVideo() : state.shortPlayer.playVideo();
  }
  function toggleShortMute() {
    if (!ready(state.shortPlayer)) return;
    state.shortMuted = !state.shortMuted; state.shortMuted ? state.shortPlayer.mute() : state.shortPlayer.unMute();
    refs.shortMute.innerHTML = icon(state.shortMuted ? "icon-muted" : "icon-volume");
  }
  const changeShort = delta => state.shorts.length && showShort(state.shortIndex + delta);
  const editable = target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;

  function bind() {
    refs.searchForm.addEventListener("submit", event => { event.preventDefault(); const query = refs.searchInput.value.trim(); if (query) loadFeed(query); });
    $$("[data-topic]").forEach(button => button.addEventListener("click", () => { refs.searchInput.value = button.dataset.topic; loadFeed(button.dataset.topic); }));
    $$("[data-view-button]").forEach(button => button.addEventListener("click", () => { showView(button.dataset.viewButton); if (state.view === "shorts") loadShorts(); }));
    $("[data-back]").addEventListener("click", () => { if (state.view === "watch") showView("home"); else if (history.length > 1) history.back(); else location.href = "/"; });
    refs.watchToggle.addEventListener("click", toggleWatch); refs.watchCenterPlay.addEventListener("click", toggleWatch); refs.watchMute.addEventListener("click", toggleWatchMute);
    refs.watchProgress.addEventListener("input", () => { if (ready(state.watchPlayer)) state.watchPlayer.seekTo((state.watchPlayer.getDuration?.() || 0) * Number(refs.watchProgress.value) / 1000, true); });
    const watchCaptions = () => { state.watchCaptions = !state.watchCaptions; if (!setCaptions(state.watchPlayer, state.watchCaptions, refs.watchCaptions, refs.watchCaptionOption)) state.watchCaptions = !state.watchCaptions; };
    refs.watchCaptions.addEventListener("click", watchCaptions); refs.watchCaptionOption.addEventListener("click", watchCaptions); refs.watchFullscreen.addEventListener("click", () => fullscreen(refs.watchStage));
    refs.shortCenterPlay.addEventListener("click", toggleShort); refs.shortStage.addEventListener("click", event => { if (!event.target.closest("button")) toggleShort(); });
    refs.shortMute.addEventListener("click", toggleShortMute);
    refs.shortCaptions.addEventListener("click", () => { state.shortCaptions = !state.shortCaptions; if (!setCaptions(state.shortPlayer, state.shortCaptions, refs.shortCaptions)) state.shortCaptions = !state.shortCaptions; });
    refs.shortFullscreen.addEventListener("click", () => fullscreen(refs.shortStage));
    $("[data-short-previous]").addEventListener("click", () => changeShort(-1)); $("[data-short-next]").addEventListener("click", () => changeShort(1));
    document.addEventListener("keydown", event => {
      if (editable(event.target)) return;
      if (state.view === "watch") {
        if (["Space", "ArrowLeft", "ArrowRight", "KeyM", "KeyF"].includes(event.code)) event.preventDefault();
        if (event.code === "Space") toggleWatch();
        if (event.code === "ArrowLeft" && ready(state.watchPlayer)) state.watchPlayer.seekTo(Math.max(0, state.watchPlayer.getCurrentTime() - 5), true);
        if (event.code === "ArrowRight" && ready(state.watchPlayer)) state.watchPlayer.seekTo(state.watchPlayer.getCurrentTime() + 5, true);
        if (event.code === "KeyM") toggleWatchMute(); if (event.code === "KeyF") fullscreen(refs.watchStage);
      } else if (state.view === "shorts") {
        if (["Space", "ArrowUp", "ArrowDown", "KeyM", "KeyF"].includes(event.code)) event.preventDefault();
        if (event.code === "Space") toggleShort(); if (event.code === "ArrowUp") changeShort(-1); if (event.code === "ArrowDown") changeShort(1);
        if (event.code === "KeyM") toggleShortMute(); if (event.code === "KeyF") fullscreen(refs.shortStage);
      }
    });
  }

  applyTheme(); bind(); skeletons();
  json("/api/nyxtube/status").then(status => {
    if (!status?.configured) throw new Error("NyxTube is not configured yet.");
    return loadFeed();
  }).catch(error => { renderVideos([]); notice(error.message || "NyxTube could not be started."); });
})();
