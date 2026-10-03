/* Same-origin compatibility audio. One bounded exchange at a time, no recording. */
window.NyxVoiceRelay = class {
  constructor({ stream, audioContext, exchange, accept, muted, deafened, status, denied }) {
    Object.assign(this, { stream, audioContext, exchange, accept, muted, deafened, status, denied });
    this.pending = []; this.sequence = 0; this.playheads = new Map(); this.sources = new Set(); this.closed = false;
  }
  async start() {
    // Reuse the context unlocked by the Join gesture, including on mobile browsers.
    this.context = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.gain = this.context.createGain(); this.gain.connect(this.context.destination);
    await this.context.resume();
    if (!this.context._nyxVoiceCaptureModule) {
      this.context._nyxVoiceCaptureModule = this.context.audioWorklet.addModule('./voice-capture.js?v=20260923-voice-relay-v1').catch(error => {
        delete this.context._nyxVoiceCaptureModule; throw error;
      });
    }
    await this.context._nyxVoiceCaptureModule;
    if (this.closed) return;
    this.input = this.context.createMediaStreamSource(this.stream);
    this.capture = new AudioWorkletNode(this.context, 'nyx-voice-capture');
    this.silent = this.context.createGain(); this.silent.gain.value = 0;
    this.input.connect(this.capture); this.capture.connect(this.silent); this.silent.connect(this.context.destination);
    this.capture.port.onmessage = event => {
      if (this.closed || this.muted()) { this.pending = []; return; }
      const samples = new Int16Array(event.data), bytes = new Uint8Array(3200), view = new DataView(bytes.buffer);
      for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
      const data = btoa(String.fromCharCode(...bytes));
      this.pending.push({ seq: this.sequence++, data });
      if (this.pending.length > 4) this.pending.shift();
    };
    void this.tick();
  }
  async tick() {
    if (this.closed) return;
    let delay = 120;
    try {
      const result = await this.exchange(this.muted() ? (this.pending = []) : this.pending.splice(0, 4));
      if (this.closed) return;
      this.status(result.transport === 'http' ? 'Voice via HTTP' : 'Voice via chat connection');
      this.gain.gain.value = this.deafened() ? 0 : 1;
      for (const frame of result.frames || []) this.play(frame);
    } catch (error) {
      if (this.closed) return;
      if ([401, 403, 409].includes(error.status)) { this.close(); this.denied(); return; }
      this.pending = []; delay = 1000;
      this.status(error.status === 403 || error.status === 401 || error.status === 409 ? 'Voice disconnected — rejoin the channel' : 'Voice reconnecting…');
    }
    if (!this.closed) this.timer = setTimeout(() => void this.tick(), delay);
  }
  play(frame) {
    if (this.deafened() || !this.accept(frame) || typeof frame.data !== 'string' || frame.data.length !== 4268) return;
    const key = `${frame.fromUid}:${frame.fromSessionId}`, previous = this.playheads.get(key);
    if (previous && frame.seq <= previous.seq) return;
    const bytes = Uint8Array.from(atob(frame.data), c => c.charCodeAt(0));
    if (bytes.length !== 3200) return;
    const buffer = this.context.createBuffer(1, 1600, 16000), samples = buffer.getChannelData(0), view = new DataView(bytes.buffer);
    for (let i = 0; i < 1600; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    const now = this.context.currentTime;
    const at = Math.max(now + .04, previous?.at || 0);
    if (at > now + .5) return; // Drop excess latency instead of replaying stale speech.
    const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.gain);
    this.sources.add(source); source.onended = () => { this.sources.delete(source); source.disconnect(); };
    source.start(at); this.playheads.set(key, { seq: frame.seq, at: at + .1 });
    if (this.playheads.size > 16) this.playheads.delete(this.playheads.keys().next().value);
  }
  silence() {
    this.pending = [];
    if (this.gain) this.gain.gain.value = this.deafened() ? 0 : 1;
    if (this.deafened()) {
      for (const source of this.sources) { try { source.stop(); } catch {} }
      this.sources.clear(); this.playheads.clear();
    }
  }
  close() {
    this.closed = true; clearTimeout(this.timer); this.pending = [];
    if (this.capture) { this.capture.port.onmessage = null; this.capture.port.close(); this.capture.disconnect(); }
    this.input?.disconnect(); this.silent?.disconnect(); this.gain?.disconnect();
    for (const source of this.sources) { try { source.stop(); } catch {} }
    this.sources.clear(); this.playheads.clear();
    if (!this.audioContext) void this.context?.close().catch(() => {});
  }
};
