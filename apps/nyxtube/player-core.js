(() => {
  "use strict";

  const PlayerState = Object.freeze({ UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 });

  function createDirectYoutubeApi({ optimisticState = true } = {}) {
    class DirectYouTubePlayer {
      constructor(id, config) {
        this.config = config;
        this.container = document.getElementById(id);
        this.stage = this.container?.closest(".watch-player,.short-card") || null;
        this.state = PlayerState.UNSTARTED;
        this.currentTime = 0;
        this.total = Number(config.expectedDuration) || 0;
        this.muted = Boolean(config.playerVars?.mute);
        this.volume = 100;
        this.playbackRate = 1;
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
          controls: String(config.playerVars?.controls ?? 1), enablejsapi: "1", origin: location.origin, widget_referrer: location.href,
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
          if (Number.isFinite(Number(payload.info.volume))) this.volume = Number(payload.info.volume);
          if (Number.isFinite(Number(payload.info.playbackRate)) && Number(payload.info.playbackRate) > 0) this.playbackRate = Number(payload.info.playbackRate);
        }
      }
      playVideo() { this.command("playVideo"); if (optimisticState) this.emitState(PlayerState.PLAYING); }
      pauseVideo() { this.command("pauseVideo"); if (optimisticState) this.emitState(PlayerState.PAUSED); }
      stopVideo() { this.command("stopVideo"); if (optimisticState) this.emitState(PlayerState.PAUSED); }
      loadVideoById(value) { this.command("loadVideoById", [String(value || "")]); }
      seekTo(value) { this.currentTime = Math.max(0, Number(value) || 0); this.command("seekTo", [this.currentTime, true]); }
      mute() { this.muted = true; this.command("mute"); }
      unMute() { this.muted = false; this.command("unMute"); }
      isMuted() { return this.muted; }
      setVolume(value) { this.volume = Math.max(0, Math.min(100, Number(value) || 0)); this.command("setVolume", [this.volume]); }
      getVolume() { return this.volume; }
      getPlayerState() { return this.state; }
      getCurrentTime() { return this.currentTime; }
      getDuration() { return this.total; }
      getAvailablePlaybackRates() { return [.25, .5, 1, 1.5, 2]; }
      getPlaybackRate() { return this.playbackRate; }
      setPlaybackRate(value) { this.playbackRate = Math.max(.25, Math.min(2, Number(value) || 1)); this.command("setPlaybackRate", [this.playbackRate]); }
      loadModule(name) { this.command("loadModule", [name]); }
      unloadModule(name) { this.command("unloadModule", [name]); }
      destroy() {
        this.destroyed = true;
        removeEventListener("message", this.handleMessage);
        this.stage?.classList.remove("direct-player");
        this.iframe?.remove();
      }
    }
    return Object.freeze({ Player: DirectYouTubePlayer, PlayerState });
  }

  window.NyxTubePlayerCore = Object.freeze({ PlayerState, createDirectYoutubeApi });
})();
