import Transport from './transport.mjs';

export class Adapter {
  constructor(established, primary = new Transport()) {
    this.established = established;
    this.primary = primary;
    this.ready = established.ready;
    this.available = true;
  }
  async init() {
    if (!this.established.ready) await this.established.init();
    this.ready = true;
  }
  async request(remote, method, body, headers, signal) {
    signal?.throwIfAborted();
    const verb = String(method || 'GET').toUpperCase();
    const url = new URL(String(remote));
    const special = [...headers].some(([key, value]) => /^(?:range|accept)$/i.test(key) && (key.toLowerCase() === 'range' || /(?:event-stream|audio\/|video\/)/i.test(value)));
    const media = /\.(?:mp4|webm|mp3|ogg|wav|m3u8|mpd|ts)(?:$|\?)/i.test(url.pathname);
    if (this.available && ['GET','HEAD'].includes(verb) && body == null && !special && !media && ['http:','https:'].includes(url.protocol)) {
      try { return await this.primary.request(remote, method, body, headers, signal); }
      catch (error) {
        signal?.throwIfAborted();
        this.available = false;
        this.primary.close(error);
      }
    }
    return this.established.request(remote, method, body, headers, signal);
  }
  connect(...args) { return this.established.connect(...args); }
  close() { this.ready = false; this.primary.close(); this.established.close?.(); }
}
