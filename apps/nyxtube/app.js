(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const views = Object.fromEntries($$("[data-view]").map(view => [view.dataset.view, view]));
  const state = {
    view: "home", videos: [], catalog: [], shorts: [], shortIndex: 0,
    watchPlayer: null, shortPlayer: null, watchTimer: 0, shortTimer: 0,
    watchVideo: null, watchCaptions: false, shortCaptions: false, shortMuted: true,
    failedVideoIds: new Set(), failedShortIds: new Set(), watchRecoveryTimer: 0,
    profile: { uid: "", signedIn: false, displayName: "Profile", avatarUrl: "" }, profileRequestId: "",
  };
  const refs = Object.fromEntries([
    "notice", "search-form", "search-input", "feed-title", "result-count", "video-grid",
    "watch-stage", "watch-player", "watch-loading", "watch-center-play", "watch-toggle", "watch-time",
    "watch-mute", "watch-captions", "watch-caption-option", "watch-fullscreen", "watch-progress",
    "watch-title", "watch-creator", "watch-channel-mark", "watch-source", "watch-description", "watch-related", "short-stage", "short-player",
    "short-loading", "short-center-play", "short-mute", "short-captions", "short-fullscreen",
    "short-progress", "short-title", "short-creator", "profile-button", "profile-avatar",
    "watch-settings", "watch-settings-menu", "watch-speed", "watch-settings-captions",
    "watch-rewind", "watch-forward",
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
  function dateLabel(value) {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function renderProfile(profile = {}) {
    const displayName = String(profile.displayName || "Profile").trim() || "Profile";
    state.profile = { uid: String(profile.uid || ""), signedIn: Boolean(profile.signedIn), displayName, avatarUrl: String(profile.avatarUrl || "") };
    refs.profileButton.title = state.profile.signedIn ? `Open ${displayName}'s profile` : "Sign in or create a profile";
    refs.profileButton.setAttribute("aria-label", refs.profileButton.title);
    const fallback = () => {
      refs.profileAvatar.replaceChildren();
      if (state.profile.signedIn) {
        const initial = document.createElement("span"); initial.textContent = displayName.slice(0, 1).toUpperCase() || "N"; refs.profileAvatar.append(initial);
      } else refs.profileAvatar.innerHTML = icon("icon-user");
    };
    if (!state.profile.avatarUrl) { fallback(); return; }
    const image = document.createElement("img"); image.alt = ""; image.loading = "eager"; image.src = state.profile.avatarUrl;
    image.addEventListener("error", fallback, { once: true }); refs.profileAvatar.replaceChildren(image);
  }
  function requestProfile() {
    state.profileRequestId = `nyxtube-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    parent.postMessage({ type: "nyx:nyxtube-profile-request", requestId: state.profileRequestId }, location.origin);
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
    const catalog = new Map(state.catalog.map(video => [video.id, video]));
    state.videos.forEach(video => { if (video?.id) catalog.set(video.id, video); });
    state.catalog = [...catalog.values()].slice(-60);
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

  const directPlayerState = Object.freeze({ ENDED: 0, PLAYING: 1, PAUSED: 2 });
  class DirectYouTubePlayer {
    constructor(id, config) {
      this.config = config;
      this.container = document.getElementById(id);
      this.stage = this.container?.closest(".watch-player,.short-card") || null;
      this.state = -1;
      this.currentTime = 0;
      this.total = Number(config.expectedDuration) || 0;
      this.muted = Boolean(config.playerVars?.mute);
      this.destroyed = false;
      this.handleMessage = event => this.receive(event);
      this.iframe = document.createElement("iframe");
      this.iframe.dataset.directYoutube = "true";
      this.iframe.title = "YouTube video player";
      this.iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      this.iframe.allowFullscreen = true;
      this.iframe.referrerPolicy = "strict-origin-when-cross-origin";
      const parameters = new URLSearchParams({
        ...Object.fromEntries(Object.entries(config.playerVars || {}).map(([name, value]) => [name, String(value)])),
        controls: "1",
        enablejsapi: "1",
        origin: location.origin,
        widget_referrer: location.href,
      });
      this.iframe.src = `${config.host || "https://www.youtube-nocookie.com"}/embed/${encodeURIComponent(config.videoId)}?${parameters}`;
      addEventListener("message", this.handleMessage);
      this.iframe.addEventListener("load", () => {
        if (this.destroyed) return;
        this.stage?.classList.add("direct-player");
        this.post({ event: "listening", id });
        this.command("addEventListener", ["onStateChange"]);
        this.command("addEventListener", ["onError"]);
        config.events?.onReady?.({ target: this });
      }, { once: true });
      this.container?.replaceChildren(this.iframe);
    }
    post(payload) { this.iframe?.contentWindow?.postMessage(JSON.stringify(payload), "*"); }
    command(func, args = []) { this.post({ event: "command", func, args }); }
    emitState(next) {
      if (!Number.isFinite(next) || this.state === next) return;
      this.state = next;
      this.config.events?.onStateChange?.({ target: this, data: next });
    }
    receive(event) {
      if (event.source !== this.iframe?.contentWindow || !/^https:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)$/.test(event.origin)) return;
      let payload = event.data;
      if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { return; } }
      if (!payload || typeof payload !== "object") return;
      if (payload.event === "onStateChange") this.emitState(Number(payload.info));
      if (payload.event === "onError") this.config.events?.onError?.({ target: this, data: payload.info });
      if (payload.event === "infoDelivery" && payload.info && typeof payload.info === "object") {
        if (Number.isFinite(Number(payload.info.currentTime))) this.currentTime = Number(payload.info.currentTime);
        if (Number.isFinite(Number(payload.info.duration)) && Number(payload.info.duration) > 0) this.total = Number(payload.info.duration);
        if (Number.isFinite(Number(payload.info.playerState))) this.emitState(Number(payload.info.playerState));
        if (typeof payload.info.muted === "boolean") this.muted = payload.info.muted;
      }
    }
    playVideo() { this.command("playVideo"); this.emitState(directPlayerState.PLAYING); }
    pauseVideo() { this.command("pauseVideo"); this.emitState(directPlayerState.PAUSED); }
    seekTo(value) { this.currentTime = Math.max(0, Number(value) || 0); this.command("seekTo", [this.currentTime, true]); }
    mute() { this.muted = true; this.command("mute"); }
    unMute() { this.muted = false; this.command("unMute"); }
    isMuted() { return this.muted; }
    getPlayerState() { return this.state; }
    getCurrentTime() { return this.currentTime; }
    getDuration() { return this.total; }
    loadModule(name) { this.command("loadModule", [name]); }
    unloadModule(name) { this.command("unloadModule", [name]); }
    destroy() {
      this.destroyed = true;
      removeEventListener("message", this.handleMessage);
      this.stage?.classList.remove("direct-player");
      this.iframe?.remove();
    }
  }
  const directYoutubeApi = Object.freeze({ Player: DirectYouTubePlayer, PlayerState: directPlayerState });

  let iframeApi;
  function youtubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (iframeApi) return iframeApi;
    iframeApi = new Promise(resolve => {
      const previous = window.onYouTubeIframeAPIReady;
      let settled = false;
      let script;
      const finish = api => { if (settled) return; settled = true; clearTimeout(timer); resolve(api); };
      const useDirectPlayer = () => { script?.remove(); finish(directYoutubeApi); };
      const timer = setTimeout(useDirectPlayer, 5000);
      window.onYouTubeIframeAPIReady = () => { previous?.(); finish(window.YT?.Player ? window.YT : directYoutubeApi); };
      script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true;
      script.addEventListener("error", useDirectPlayer, { once: true });
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
  function closeWatchSettings() {
    refs.watchSettingsMenu.hidden = true;
    refs.watchSettings.setAttribute("aria-expanded", "false");
  }
  function configureWatchSettings(player, video) {
    let rates = [];
    try { rates = player.getAvailablePlaybackRates?.() || []; } catch { rates = []; }
    rates = [...new Set(rates.map(Number).filter(rate => Number.isFinite(rate) && rate > 0))].sort((left, right) => left - right);
    if (!rates.length) rates = [1];
    refs.watchSpeed.replaceChildren(...rates.map(rate => {
      const option = document.createElement("option"); option.value = String(rate); option.textContent = rate === 1 ? "Normal" : `${rate}x`; return option;
    }));
    let currentRate = 1;
    try { currentRate = Number(player.getPlaybackRate?.()) || 1; } catch { currentRate = 1; }
    refs.watchSpeed.value = rates.includes(currentRate) ? String(currentRate) : String(rates.includes(1) ? 1 : rates[0]);
    refs.watchSettingsCaptions.disabled = !video?.captions;
    refs.watchSettingsCaptions.title = video?.captions ? "" : "Captions are not available for this video";
    refs.watchSettingsCaptions.value = state.watchCaptions && video?.captions ? "on" : "off";
  }
  function openWatch(video, { recoveryMessage = "" } = {}) {
    if (!video?.id) return;
    clearTimeout(state.watchRecoveryTimer); state.watchRecoveryTimer = 0;
    state.watchVideo = video; showView("watch"); notice(recoveryMessage); closeWatchSettings();
    refs.watchTitle.textContent = video.title || "Untitled video";
    refs.watchCreator.textContent = [video.creator || "YouTube", viewsLabel(video.viewCount), dateLabel(video.publishedAt)].filter(Boolean).join(" · ");
    refs.watchChannelMark.textContent = (video.creator || "Y").trim().slice(0, 1).toUpperCase();
    refs.watchDescription.textContent = String(video.description || "No description was provided for this video.");
    renderRelated(video);
    refs.watchSource.href = video.sourceUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    state.watchCaptions = false; refs.watchCaptions.setAttribute("aria-pressed", "false"); refs.watchCaptionOption.querySelector("span").textContent = "Off";
    refs.watchLoading.hidden = false; refs.watchCenterPlay.hidden = true; refs.watchProgress.value = "0";
    refs.watchTime.textContent = `0:00 / ${duration(video.durationSeconds)}`;
    createWatch(video).catch(error => { refs.watchLoading.hidden = true; notice(error.message || "The video player could not be started."); });
  }
  async function createWatch(video, forceDirect = false) {
    const YT = forceDirect ? directYoutubeApi : await youtubeApi();
    if (state.view !== "watch" || state.watchVideo?.id !== video.id) return;
    state.watchPlayer?.destroy?.();
    const config = options(video.id); config.expectedDuration = video.durationSeconds;
    config.events = {
      onReady: event => { refs.watchLoading.hidden = true; configureWatchSettings(event.target, video); event.target.playVideo(); startWatchTimer(); },
      onStateChange: event => {
        const playing = event.data === YT.PlayerState.PLAYING, paused = event.data === YT.PlayerState.PAUSED;
        if (playing) refs.watchLoading.hidden = true;
        updateToggle(refs.watchToggle, playing); refs.watchCenterPlay.hidden = !paused;
      },
      onError: event => recoverWatch(video, Number(event?.data), YT === directYoutubeApi),
    };
    state.watchPlayer = new YT.Player(mount(refs.watchPlayer, "nyxtube-watch"), config);
  }
  function relatedVideos(selected, limit = 10) {
    const seen = new Set();
    return [...state.catalog, ...state.shorts]
      .filter(video => video?.id && video.id !== selected.id && !state.failedVideoIds.has(video.id) && !seen.has(video.id) && seen.add(video.id))
      .sort((left, right) => relatedScore(right, selected) - relatedScore(left, selected))
      .slice(0, limit);
  }
  function recoverWatch(video, code, directPlayer) {
    if (state.view !== "watch" || state.watchVideo?.id !== video.id) return;
    refs.watchLoading.hidden = true;
    if (!directPlayer && (code === 5 || code === 153)) {
      notice("Retrying this video with the Chromebook-compatible player...");
      createWatch(video, true).catch(error => notice(error.message || "The video player could not be restarted."));
      return;
    }
    state.failedVideoIds.add(video.id);
    const next = relatedVideos(video, 1)[0];
    if (!next) {
      notice("YouTube says this video is unavailable or restricted on this Chromebook. Choose another video.");
      return;
    }
    const message = "That video is unavailable or restricted on this Chromebook. Loading another playable video...";
    notice(message);
    state.watchPlayer?.destroy?.(); state.watchPlayer = null; refs.watchPlayer.replaceChildren();
    state.watchRecoveryTimer = setTimeout(() => openWatch(next, { recoveryMessage: message }), 500);
  }
  function relatedScore(candidate, selected) {
    const sameCreator = String(candidate.creator || "").toLowerCase() === String(selected.creator || "").toLowerCase() ? 20 : 0;
    const words = new Set(String(selected.title || "").toLowerCase().match(/[a-z0-9]{4,}/g) || []);
    const overlap = (String(candidate.title || "").toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter(word => words.has(word)).length;
    return sameCreator + overlap;
  }
  function renderRelated(selected) {
    const videos = relatedVideos(selected);
    if (!videos.length) {
      const empty = document.createElement("p"); empty.className = "related-empty"; empty.textContent = "More videos will appear here as you browse.";
      refs.watchRelated.replaceChildren(empty); return;
    }
    refs.watchRelated.replaceChildren(...videos.map(video => {
      const button = document.createElement("button"); button.type = "button"; button.className = "related-card";
      const image = document.createElement("img"); image.alt = ""; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; image.src = video.thumbnail || "";
      image.addEventListener("error", () => image.remove());
      const stamp = document.createElement("span"); stamp.className = "related-duration"; stamp.textContent = duration(video.durationSeconds);
      const thumb = document.createElement("span"); thumb.className = "related-thumb"; thumb.append(image, stamp);
      const copy = document.createElement("span"); copy.className = "related-copy";
      const title = document.createElement("strong"); title.textContent = video.title || "Untitled video";
      const meta = document.createElement("small"); meta.textContent = `${video.creator || "YouTube"} · ${viewsLabel(video.viewCount)}`;
      copy.append(title, meta); button.append(thumb, copy); button.addEventListener("click", () => openWatch(video)); return button;
    }));
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
    clearInterval(state.watchTimer); state.watchTimer = 0; clearTimeout(state.watchRecoveryTimer); state.watchRecoveryTimer = 0;
    closeWatchSettings(); state.watchPlayer?.destroy?.(); state.watchPlayer = null; refs.watchPlayer.replaceChildren();
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
  function seekWatchBy(seconds) {
    if (!ready(state.watchPlayer)) return;
    const current = Number(state.watchPlayer.getCurrentTime?.()) || 0;
    const total = Number(state.watchPlayer.getDuration?.()) || Number(state.watchVideo?.durationSeconds) || 0;
    state.watchPlayer.seekTo(Math.max(0, total ? Math.min(total, current + seconds) : current + seconds), true);
  }
  function setCaptions(player, enabled, button, option) {
    if (!ready(player)) return false;
    try { enabled ? player.loadModule?.("captions") : player.unloadModule?.("captions"); } catch { return false; }
    button.setAttribute("aria-pressed", String(enabled));
    if (option) option.querySelector("span").textContent = enabled ? "On" : "Off";
    return true;
  }
  function changeWatchCaptions(enabled) {
    const previous = state.watchCaptions;
    state.watchCaptions = Boolean(enabled);
    if (!setCaptions(state.watchPlayer, state.watchCaptions, refs.watchCaptions, refs.watchCaptionOption)) state.watchCaptions = previous;
    refs.watchSettingsCaptions.value = state.watchCaptions ? "on" : "off";
  }
  function fullscreen(element) {
    const request = element.requestFullscreen || element.webkitRequestFullscreen; if (request) request.call(element).catch?.(() => {});
  }

  async function loadShorts() {
    notice(); refs.shortLoading.hidden = false;
    try {
      if (!state.shorts.length) state.shorts = (await json("/api/nyxtube/shorts?limit=16"))?.videos || [];
      if (!state.shorts.length) throw new Error("No playable Shorts were found.");
      state.failedShortIds.clear();
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
    const config = options(video.id, true); config.expectedDuration = video.durationSeconds;
    config.events = {
      onReady: event => { event.target.mute(); state.shortMuted = true; refs.shortMute.innerHTML = icon("icon-muted"); event.target.playVideo(); refs.shortLoading.hidden = true; startShortTimer(); },
      onStateChange: event => {
        const playing = event.data === YT.PlayerState.PLAYING, paused = event.data === YT.PlayerState.PAUSED;
        if (playing) refs.shortLoading.hidden = true;
        refs.shortCenterPlay.hidden = !paused;
        if (event.data === YT.PlayerState.ENDED) showShort(state.shortIndex + 1);
      },
      onError: () => recoverShort(video),
    };
    state.shortPlayer = new YT.Player(mount(refs.shortPlayer, "nyxtube-short"), config);
  }
  function recoverShort(video) {
    if (state.view !== "shorts" || state.shorts[state.shortIndex]?.id !== video.id) return;
    state.failedShortIds.add(video.id);
    const nextIndex = state.shorts.findIndex((candidate, index) => index !== state.shortIndex && candidate?.id && !state.failedShortIds.has(candidate.id));
    if (nextIndex < 0) {
      refs.shortLoading.hidden = true;
      state.shortPlayer?.destroy?.(); state.shortPlayer = null; refs.shortPlayer.replaceChildren();
      notice("YouTube says these Shorts are unavailable or restricted on this Chromebook. Try again later.");
      return;
    }
    notice("Skipping a Short that YouTube restricts on this Chromebook...");
    showShort(nextIndex);
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
    addEventListener("message", event => {
      if (event.origin !== location.origin || event.data?.type !== "nyx:nyxtube-profile" || event.data.requestId !== state.profileRequestId) return;
      renderProfile(event.data.profile);
    });
    refs.profileButton.addEventListener("click", () => parent.postMessage({ type: "nyx:nyxtube-open-profile", uid: state.profile.uid }, location.origin));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) requestProfile(); });
    refs.searchForm.addEventListener("submit", event => { event.preventDefault(); const query = refs.searchInput.value.trim(); if (query) loadFeed(query); });
    $$("[data-topic]").forEach(button => button.addEventListener("click", () => { refs.searchInput.value = button.dataset.topic; loadFeed(button.dataset.topic); }));
    $$("[data-view-button]").forEach(button => button.addEventListener("click", () => { showView(button.dataset.viewButton); if (state.view === "shorts") loadShorts(); }));
    $("[data-back]").addEventListener("click", () => { if (state.view === "watch") showView("home"); else if (history.length > 1) history.back(); else location.href = "/"; });
    refs.watchToggle.addEventListener("click", toggleWatch); refs.watchCenterPlay.addEventListener("click", toggleWatch); refs.watchMute.addEventListener("click", toggleWatchMute);
    refs.watchProgress.addEventListener("input", () => { if (ready(state.watchPlayer)) state.watchPlayer.seekTo((state.watchPlayer.getDuration?.() || 0) * Number(refs.watchProgress.value) / 1000, true); });
    const watchCaptions = () => changeWatchCaptions(!state.watchCaptions);
    refs.watchCaptions.addEventListener("click", watchCaptions); refs.watchCaptionOption.addEventListener("click", watchCaptions); refs.watchFullscreen.addEventListener("click", () => fullscreen(refs.watchStage));
    refs.watchSettings.addEventListener("click", event => {
      event.stopPropagation(); const opening = refs.watchSettingsMenu.hidden; closeWatchSettings();
      if (opening) { refs.watchSettingsMenu.hidden = false; refs.watchSettings.setAttribute("aria-expanded", "true"); refs.watchSpeed.focus(); }
    });
    refs.watchSettingsMenu.addEventListener("click", event => event.stopPropagation());
    refs.watchSpeed.addEventListener("change", () => { try { state.watchPlayer?.setPlaybackRate?.(Number(refs.watchSpeed.value) || 1); } catch { /* YouTube rejected this rate. */ } });
    refs.watchSettingsCaptions.addEventListener("change", () => changeWatchCaptions(refs.watchSettingsCaptions.value === "on"));
    refs.watchRewind.addEventListener("click", () => seekWatchBy(-5)); refs.watchForward.addEventListener("click", () => seekWatchBy(5));
    document.addEventListener("click", closeWatchSettings);
    refs.shortCenterPlay.addEventListener("click", toggleShort); refs.shortStage.addEventListener("click", event => { if (!event.target.closest("button")) toggleShort(); });
    refs.shortMute.addEventListener("click", toggleShortMute);
    refs.shortCaptions.addEventListener("click", () => { state.shortCaptions = !state.shortCaptions; if (!setCaptions(state.shortPlayer, state.shortCaptions, refs.shortCaptions)) state.shortCaptions = !state.shortCaptions; });
    refs.shortFullscreen.addEventListener("click", () => fullscreen(refs.shortStage));
    $("[data-short-previous]").addEventListener("click", () => changeShort(-1)); $("[data-short-next]").addEventListener("click", () => changeShort(1));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !refs.watchSettingsMenu.hidden) { event.preventDefault(); closeWatchSettings(); refs.watchSettings.focus(); return; }
      if (editable(event.target)) return;
      if (state.view === "watch") {
        if (["Space", "ArrowLeft", "ArrowRight", "KeyM", "KeyF"].includes(event.code)) event.preventDefault();
        if (event.code === "Space") toggleWatch();
        if (event.code === "ArrowLeft") seekWatchBy(-5);
        if (event.code === "ArrowRight") seekWatchBy(5);
        if (event.code === "KeyM") toggleWatchMute(); if (event.code === "KeyF") fullscreen(refs.watchStage);
      } else if (state.view === "shorts") {
        if (["Space", "ArrowUp", "ArrowDown", "KeyM", "KeyF"].includes(event.code)) event.preventDefault();
        if (event.code === "Space") toggleShort(); if (event.code === "ArrowUp") changeShort(-1); if (event.code === "ArrowDown") changeShort(1);
        if (event.code === "KeyM") toggleShortMute(); if (event.code === "KeyF") fullscreen(refs.shortStage);
      }
    });
  }

  applyTheme(); bind(); skeletons(); requestProfile();
  json("/api/nyxtube/status").then(status => {
    if (!status?.configured) throw new Error("NyxTube is not configured yet.");
    return loadFeed();
  }).catch(error => { renderVideos([]); notice(error.message || "NyxTube could not be started."); });
})();
