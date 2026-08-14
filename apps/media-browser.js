(() => {
  "use strict";

  const provider = document.body.dataset.provider === "soundcloud" ? "soundcloud" : "youtube";
  const providerName = provider === "youtube" ? "YouTube" : "SoundCloud";
  const appName = provider === "youtube" ? "NyxTube" : "NyxCloud";
  const apiBase = provider === "youtube" ? "/api/nyxtube" : "/api/nyxcloud";
  const refs = {
    back: document.querySelector("[data-back-to-nyx]"),
    form: document.querySelector("[data-media-search]"),
    input: document.querySelector("[data-media-query]"),
    submit: document.querySelector("[data-media-submit]"),
    status: document.querySelector("[data-media-status]"),
    statusText: document.querySelector("[data-media-status-text]"),
    count: document.querySelector("[data-media-count]"),
    notice: document.querySelector("[data-media-notice]"),
    results: document.querySelector("[data-media-results]"),
    player: document.querySelector("[data-media-player]"),
    playerTitle: document.querySelector("[data-media-player-title]"),
    playerCreator: document.querySelector("[data-media-player-creator]"),
    playerFrame: document.querySelector("[data-media-player-frame]"),
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

  async function fetchJson(path) {
    const response = await fetch(path, { headers: { accept: "application/json" } });
    const type = String(response.headers.get("content-type") || "");
    const payload = type.includes("application/json") ? await response.json() : {};
    if (!response.ok) throw new Error(payload?.error || `${appName} could not reach ${providerName}.`);
    return payload;
  }

  function setConfigured(configured) {
    refs.status.classList.toggle("online", configured);
    refs.status.classList.toggle("offline", !configured);
    refs.statusText.textContent = configured ? `${providerName} API ready` : "Administrator setup required";
    refs.submit.disabled = !configured;
    refs.input.disabled = !configured;
    if (!configured) showNotice(`${appName} is installed, but its server credentials have not been added to OVH yet.`);
  }

  function showNotice(message = "") {
    refs.notice.textContent = message;
    refs.notice.hidden = !message;
  }

  function setBusy(busy) {
    refs.submit.disabled = busy;
    refs.input.readOnly = busy;
    refs.submit.textContent = busy ? "Searching…" : `Search ${providerName}`;
  }

  function emptyState(title, detail) {
    const root = document.createElement("div");
    root.className = "media-empty";
    root.innerHTML = `${icon(provider === "youtube" ? "play" : "cloud")}<strong></strong><span></span>`;
    root.querySelector("strong").textContent = title;
    root.querySelector("span").textContent = detail;
    refs.results.replaceChildren(root);
  }

  function durationLabel(value) {
    const seconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
    if (!seconds) return "";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function play(result) {
    refs.playerTitle.textContent = result.title;
    refs.playerCreator.textContent = result.creator;
    const frame = document.createElement("iframe");
    frame.title = `${result.title} — ${providerName}`;
    frame.loading = "eager";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    frame.src = provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(result.id)}?autoplay=1&playsinline=1&hl=en&rel=0`
      : `https://w.soundcloud.com/player/?url=${encodeURIComponent(result.sourceUrl)}&color=%23ff9a54&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`;
    refs.playerFrame.replaceChildren(frame);
    refs.player.hidden = false;
  }

  function resultCard(result) {
    const article = document.createElement("article");
    article.className = "media-result";
    const cover = document.createElement("div");
    cover.className = "media-result-cover";
    const fallback = document.createElement("span");
    fallback.innerHTML = icon(provider === "youtube" ? "play" : "cloud");
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
    const copy = document.createElement("div");
    copy.className = "media-result-copy";
    const title = document.createElement("h2");
    title.textContent = result.title;
    const creator = document.createElement("p");
    const duration = durationLabel(result.durationMs);
    creator.textContent = duration ? `${result.creator} · ${duration}` : result.creator;
    const actions = document.createElement("div");
    actions.className = "media-result-actions";
    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = `Play in ${appName}`;
    playButton.addEventListener("click", () => play(result));
    const source = document.createElement("a");
    source.href = result.sourceUrl;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.title = `Open on ${providerName}`;
    source.setAttribute("aria-label", `Open ${result.title} on ${providerName}`);
    source.innerHTML = icon("external");
    actions.append(playButton, source);
    copy.append(title, creator, actions);
    article.append(cover, copy);
    return article;
  }

  async function search(query) {
    setBusy(true);
    showNotice("");
    refs.count.textContent = "Searching…";
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

  refs.playerClose.addEventListener("click", () => {
    refs.player.hidden = true;
    refs.playerFrame.replaceChildren();
  });

  refs.back.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "nyx:close-tab" }, location.origin);
      return;
    }
    location.href = "/";
  });

  emptyState(`Search ${providerName}`, provider === "youtube" ? "Find videos and play them with YouTube's official embedded player." : "Find playable tracks and listen through SoundCloud's official player.");
  fetchJson(`${apiBase}/status`).then(payload => setConfigured(Boolean(payload?.configured))).catch(() => setConfigured(false));
})();
