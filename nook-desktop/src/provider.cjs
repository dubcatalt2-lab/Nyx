const fs = require('node:fs');
const ORIGIN = 'https://nook.nyxlearning.org';
class Provider {
  constructor({file, safeStorage, fetcher = fetch}) { Object.assign(this, {file, safeStorage, fetcher}); this.key = ''; }
  load() { if (fs.existsSync(this.file) && this.safeStorage.isEncryptionAvailable()) this.key = this.safeStorage.decryptString(fs.readFileSync(this.file)); }
  connected() { return !!this.key; }
  async save(key) {
    if (typeof key !== 'string' || !/^n_api_[A-Za-z0-9_-]{43}$/.test(key.trim())) throw Error('Paste a Nook account API key from the website.');
    if (!this.safeStorage.isEncryptionAvailable()) throw Error('Windows encrypted credential storage is unavailable.');
    const previous = this.key; this.key = key.trim();
    try { const result = await this.models(); fs.writeFileSync(this.file, this.safeStorage.encryptString(this.key), {mode: 0o600}); return result; }
    catch (error) { this.key = previous; throw error; }
  }
  forget() { this.key = ''; if (fs.existsSync(this.file)) fs.unlinkSync(this.file); }
  async request(route, body, signal) {
    if (!this.key) throw Error('Connect your Nook account key in Settings.');
    const response = await this.fetcher(ORIGIN + route, {method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(90000), ...(signal ? [signal] : [])]), headers: {Authorization: 'Bearer ' + this.key, ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) { const {value, done} = await reader.read(); if (done) break; size += value.length; if (size > 2000000) { await reader.cancel(); throw Error('Server response exceeded the size limit.'); } chunks.push(Buffer.from(value)); }
    let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Error('Nook returned an invalid response. Please retry.'); }
    if (!response.ok) throw Error(`${response.status}: ${typeof data.error === 'string' ? data.error.slice(0, 400) : 'Request failed.'}`);
    return data;
  }
  async models() { const data = await this.request('/api/v1/models'); if (!Array.isArray(data.models)) throw Error('Invalid model catalog.'); return data.models.map(model => typeof model === 'string' ? {id: model, name: model} : model).filter(model => typeof model.id === 'string'); }
  async complete(model, messages, signal) {
    const data = await this.request('/api/v1/ai', {model, messages, max_tokens: 1600, stream: false}, signal);
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== 'string') throw Error('Choose a model that supports text responses.');
    return {text, finishReason: choice.finish_reason, usage: data.usage};
  }
}
module.exports = {Provider, ORIGIN};
