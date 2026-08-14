(() => {
  "use strict";

  const provider = "youtube";
  const providerName = "YouTube";
  const appName = "NyxTube";
  const apiBase = "/api/nyxtube";
  const playerModeKey = "nyx.nyxtube.playerMode.v1";
  const savedPlayerMode = localStorage.getItem(playerModeKey);
  const isChromeOs = /\bCrOS\b/i.test(navigator.userAgent);
  const state = {
    configured: false,
    busy: false,
    currentResult: null,
    feed: [],
    feedLoaded: false,
    standardPlayer: savedPlayerMode === "standard" || (!savedPlayerMode && isChromeOs)
  };
  const refs = {
    back: [...document.querySelectorAll("[data-back-to-nyx]")],
    home: [...document.querySelectorAll("[data-media-home]")],
    focusSearch: [...document.querySelectorAll("[data-media-focus-search]")],
    suggestions: [...document.querySelectorAll("[data-media-suggestion]")],
    form: document.querySelector("[data-media-search]"),
    input: document.querySelector("[data-media-query]"),
    submit: document.querySelector("[data-media-submit]"),
    status: document.querySelector("[data-media-status]"),
    statusText: document.querySelector("[data-media-status-text]"),
    sectionTitle: document.querySelector("[data-media-section-title]"),
    count: document.querySelector("[data-media-count]"),
    notice: document.querySelector("[data-media-notice]"),
    setup: document.querySelector("[data-media-setup]"),
    results: document.querySelector("[data-media-results]"),
    player: document.querySelector("[data-media-player]"),
    playerTitle: document.querySelector("[data-media-player-title]"),
    playerCreator: document.querySelector("[data-media-player-creator]"),
    playerSource: document.querySelector("[data-media-player-source]"),
    playerFrame: document.querySelector("[data-media-player-frame]"),
    playerCompat: document.querySelector("[data-media-player-compat]"),
    playerClose: document.querySelector("[data-media-player-close]")
  };

  function icon(kind) {
    const paths = {
      play: '<path d="M9 7.5v9l7-4.5-7-4.5Z" fill="currentColor"/>',
      cloud: '<path d="M7.3 17h9.3a3.4 3.4 0 0 0 .5-6.76A5.2 5.2 0 0 0 7.18 11.7 2.65 2.65 0 0 0 7.3 17Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      external: '<path d="M14 5h5v5M19 5l-8 8M17 13v5H6V7h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] || paths.play}</svg>`;
  }

  function plainText(value) {
    const element = document.createElement("textarea");
    element.innerHTML = String(value || "");
    return element.value.trim();
  }

  async function fetchJson(path) {
    const response = await fetch(path, { headers: { accept: "application/json" } });
    const type = String(response.headers.get("content-type") || "");
    const payload = type.includes("application/json") ? await response.json() : {};
    if (!response.ok) throw new Error(payload?.error || `${appName} could not reach ${providerName}.`);
    return payload;
  }

  function showNotice(message = "") {
    refs.notice.textContent = message;
    refs.notice.hidden = !message;
  }

  function previewCard() {
    const article = document.createElement("article");
    article.className = `media-preview media-preview-${provider}`;
    const art = document.createElement("div");
    art.className = "media-preview-art";
    art.innerHTML = `<i></i><b>${icon("play")}</b>`;
    const lines = document.createElement("div");
    lines.className = "media-preview-lines";
    lines.innerHTML = "<i></i><i></i>";
    article.append(art, lines);
    return article;
  }

  function showConfigurationPreview() {
    const count = 8;
    refs.sectionTitle.textContent = "Video feed preview";
    refs.count.textContent = "Waiting for server connection";
    refs.results.replaceChildren(...Array.from({ length: count }, (_, index) => previewCard(index)));
  }

  function setConfigured(configured) {
    state.configured = configured;
    document.body.classList.toggle("media-configured", configured);
    document.body.classList.toggle("media-unconfigured", !configured);
    refs.status.classList.toggle("online", configured);
    refs.status.classList.toggle("offline", !configured);
    refs.statusText.textContent = configured ? `${providerName} API ready` : "Setup needed";
    refs.submit.disabled = !configured;
    refs.input.disabled = !configured;
    refs.setup.hidden = configured;
    showNotice("");
    if (configured) showLanding();
    else showConfigurationPreview();
  }

  function setBusy(busy) {
    state.busy = busy;
    refs.submit.disabled = busy || !state.configured;
    refs.input.readOnly = busy;
    const label = busy ? "Searching..." : `Search ${providerName}`;
    const span = refs.submit.querySelector("span");
    if (span) span.textContent = busy ? "Searching" : "Search";
    else refs.submit.textContent = label;
  }

  function emptyState(title, detail) {
    const root = document.createElement("div");
    root.className = "media-empty";
    root.innerHTML = `${icon(provider === "youtube" ? "play" : "cloud")}<strong></strong><span></span>`;
    root.querySelector("strong").textContent = title;
    root.querySelector("span").textContent = detail;
    refs.results.replaceChildren(root);
  }

  async function showLanding() {
    refs.sectionTitle.textContent = "Popular videos";
    if (state.feedLoaded) {
      refs.count.textContent = `${state.feed.length} videos`;
      refs.results.replaceChildren(...state.feed.map(resultCard));
      return;
    }
    refs.count.textContent = "Loading...";
    refs.results.replaceChildren(...Array.from({ length: 8 }, previewCard));
    try {
      const payload = await fetchJson(`${apiBase}/feed?limit=18`);
      state.feed = Array.isArray(payload?.results) ? payload.results : [];
      state.feedLoaded = true;
      refs.count.textContent = `${state.feed.length} video${state.feed.length === 1 ? "" : "s"}`;
      if (state.feed.length) refs.results.replaceChildren(...state.feed.map(resultCard));
      else emptyState("Nothing popular right now", "Search for a video, creator, or topic instead.");
    } catch (error) {
      refs.count.textContent = "Feed unavailable";
      emptyState("Search NyxTube", "The popular feed could not load, but video search is still ready.");
      showNotice(error.message || "NyxTube could not load its video feed.");
    }
  }

  function durationLabel(value) {
    const seconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
    if (!seconds) return "";
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function renderPlayerFrame(result) {
    refs.playerTitle.textContent = plainText(result.title);
    refs.playerCreator.textContent = plainText(result.creator);
    if (refs.playerSource) refs.playerSource.href = result.sourceUrl;
    const frame = document.createElement("iframe");
    frame.title = `${plainText(result.title)} - ${providerName}`;
    frame.loading = "eager";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    const playerHost = state.standardPlayer ? "www.youtube.com" : "www.youtube-nocookie.com";
    const origin = state.standardPlayer ? `&origin=${encodeURIComponent(location.origin)}` : "";
    frame.src = `https://${playerHost}/embed/${encodeURIComponent(result.id)}?autoplay=1&playsinline=1&hl=en&cc_lang_pref=en&rel=0&enablejsapi=1${origin}`;
    refs.playerFrame.replaceChildren(frame);
    if (refs.playerCompat) {
      refs.playerCompat.textContent = state.standardPlayer ? "Use private player" : "Try standard player";
      refs.playerCompat.title = state.standardPlayer
        ? "Switch to YouTube's privacy-enhanced player"
        : "Use the standard YouTube player for managed-device compatibility";
    }
  }

  function play(result) {
    state.currentResult = result;
    renderPlayerFrame(result);
    refs.player.hidden = false;
  }

  function resultCard(result) {
    const article = document.createElement("article");
    article.className = `media-result media-result-${provider}`;
    const cover = document.createElement("div");
    cover.className = "media-result-cover";
    const fallback = document.createElement("span");
    fallback.innerHTML = icon("play");
    cover.append(fallback);
    if (result.thumbnail) {
      const image = document.createElement("img");
      image.src = result.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("load", () => fallback.remove(), { once: true });
      image.addEventListener("error", () => image.remove(), { once: true });
      cover.append(image);
    }
    const coverPlay = document.createElement("button");
    coverPlay.type = "button";
    coverPlay.className = "media-card-play";
    coverPlay.setAttribute("aria-label", `Play ${plainText(result.title)}`);
    coverPlay.innerHTML = icon("play");
    coverPlay.addEventListener("click", () => play(result));
    cover.append(coverPlay);

    const copy = document.createElement("div");
    copy.className = "media-result-copy";
    const title = document.createElement("h2");
    title.textContent = plainText(result.title) || "Untitled";
    const creator = document.createElement("p");
    const duration = durationLabel(result.durationMs);
    const views = Math.max(0, Number(result.viewCount) || 0);
    const viewsLabel = views >= 1_000_000 ? `${(views / 1_000_000).toFixed(views >= 10_000_000 ? 0 : 1)}M views` : (views >= 1_000 ? `${(views / 1_000).toFixed(views >= 10_000 ? 0 : 1)}K views` : "");
    creator.textContent = [plainText(result.creator), viewsLabel, duration].filter(Boolean).join(" - ");
    copy.append(title, creator);
    const actions = document.createElement("div");
    actions.className = "media-result-actions";
    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "Watch";
    playButton.addEventListener("click", () => play(result));
    const source = document.createElement("a");
    source.href = result.sourceUrl;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.title = `Open on ${providerName}`;
    source.setAttribute("aria-label", `Open ${plainText(result.title)} on ${providerName}`);
    source.innerHTML = icon("external");
    actions.append(playButton, source);
    copy.append(actions);
    article.append(cover, copy);
    return article;
  }

  async function search(query) {
    if (!state.configured) {
      refs.setup.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    showNotice("");
    refs.sectionTitle.textContent = `Results for "${query}"`;
    refs.count.textContent = "Searching...";
    try {
      const payload = await fetchJson(`${apiBase}/search?q=${encodeURIComponent(query)}&limit=16`);
      const results = Array.isArray(payload?.results) ? payload.results : [];
      refs.count.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
      if (!results.length) {
        emptyState("Nothing found", `Try a different ${providerName} search.`);
        return;
      }
      refs.results.replaceChildren(...results.map(resultCard));
    } catch (error) {
      refs.count.textContent = "Search unavailable";
      showNotice(error.message || `${appName} could not complete that search.`);
    } finally {
      setBusy(false);
    }
  }

  refs.form.addEventListener("submit", event => {
    event.preventDefault();
    const query = refs.input.value.trim();
    if (query.length < 2) {
      showNotice("Enter at least two characters to search.");
      refs.input.focus();
      return;
    }
    void search(query);
  });
  refs.suggestions.forEach(button => button.addEventListener("click", () => {
    refs.input.value = button.dataset.mediaSuggestion || "";
    if (state.configured) void search(refs.input.value);
    else refs.setup.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
  refs.focusSearch.forEach(button => button.addEventListener("click", () => refs.input.focus()));
  refs.home.forEach(button => button.addEventListener("click", () => {
    if (state.configured) void showLanding();
    else showConfigurationPreview();
  }));
  refs.playerClose.addEventListener("click", () => {
    refs.player.hidden = true;
    state.currentResult = null;
    refs.playerFrame.replaceChildren();
  });
  refs.playerCompat?.addEventListener("click", () => {
    state.standardPlayer = !state.standardPlayer;
    localStorage.setItem(playerModeKey, state.standardPlayer ? "standard" : "private");
    if (state.currentResult) renderPlayerFrame(state.currentResult);
  });
  refs.back.forEach(button => button.addEventListener("click", () => {
    if (window.parent !== window) window.parent.postMessage({ type: "nyx:close-tab" }, location.origin);
    else location.href = "/";
  }));

  showConfigurationPreview();
  fetchJson(`${apiBase}/status`).then(payload => setConfigured(Boolean(payload?.configured))).catch(() => setConfigured(false));
})();
