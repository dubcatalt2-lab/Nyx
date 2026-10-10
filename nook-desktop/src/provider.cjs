const fs = require('node:fs');
const path = require('node:path');
const {Account} = require('./account.cjs');
const ORIGIN = 'https://nook.nyxlearning.org';
class Provider {
  constructor({file, safeStorage, fetcher = fetch}) { Object.assign(this, {file, safeStorage, fetcher}); this.key = ''; this.account=new Account({file:path.join(path.dirname(file),'session.dpapi'),safeStorage,fetcher}); }
  load() { this.account.load();if(this.account.session){this.key=this.account.session.key;return;}if (fs.existsSync(this.file) && this.safeStorage.isEncryptionAvailable()) this.key = this.safeStorage.decryptString(fs.readFileSync(this.file)); }
  async signIn(data) { const result=await this.account.signIn(data);this.key=this.account.session.key;if(fs.existsSync(this.file))fs.unlinkSync(this.file);return result; }
  connected() { return !!this.key; }
  async save(key) {
    if (typeof key !== 'string' || !/^n_api_[A-Za-z0-9_-]{43}$/.test(key.trim())) throw Error('Paste a Nook account API key from the website.');
    if (!this.safeStorage.isEncryptionAvailable()) throw Error('Windows encrypted credential storage is unavailable.');
    const previous = this.key; this.key = key.trim();
    try { const result = await this.models(); fs.writeFileSync(this.file, this.safeStorage.encryptString(this.key), {mode: 0o600}); this.account.forget();return result; }
    catch (error) { this.key = previous; throw error; }
  }
  forget() { this.key = '';this.account.forget(); if (fs.existsSync(this.file)) fs.unlinkSync(this.file); }
  async request(route, body, signal) {
    if (!this.key) throw Error('Connect your Nook account key in Settings.');
    const response = await this.fetcher(ORIGIN + route, {method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(90000), ...(signal ? [signal] : [])]), headers: {Authorization: 'Bearer ' + this.key, ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) { const {value, done} = await reader.read(); if (done) break; size += value.length; if (size > 2000000) { await reader.cancel(); throw Error('Server response exceeded the size limit.'); } chunks.push(Buffer.from(value)); }
    let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Error('Nook returned an invalid response. Please retry.'); }
    if (!response.ok) throw Error(`${response.status}: ${typeof data.error === 'string' ? data.error.slice(0, 400) : 'Request failed.'}`);
    return data;
  }
  async models() { const data = await this.request('/api/v1/models'); if (!Array.isArray(data.models)) throw Error('Invalid model catalog.'); this.catalog = data.models.map(model => typeof model === 'string' ? {id: model, name: model} : model).filter(model => typeof model.id === 'string'); return this.catalog; }
  async complete(model, messages, signal, {maxTokens=8192}={}) {
    const selected = this.catalog?.find(item => item.id === model);
    const data = await this.request('/api/v1/ai', {model, messages, max_tokens: Math.max(1024,Math.min(16384,Number.isSafeInteger(maxTokens)?maxTokens:8192)), stream: false, ...(selected?.reasoning ? {reasoning: {effort: 'low'}} : {})}, signal);
    const choice = data.choices?.[0];
    const content=choice?.message?.content;
    const text=typeof content==='string'?content:Array.isArray(content)?content.filter(item=>item?.type==='text'&&typeof item.text==='string').map(item=>item.text).join(''):choice?.finish_reason==='length'?'':null;
    if (typeof text !== 'string') throw Error('Choose a model that supports text responses.');
    const reasoning = (Array.isArray(choice.message.reasoning_details) ? choice.message.reasoning_details : []).slice(0,20).filter(item => item?.type === 'reasoning.summary' && typeof item.summary === 'string').map(item => item.summary).join('').slice(0,2400);
    return {text, reasoning, model: typeof data.model === 'string' ? data.model.slice(0,200) : model, finishReason: choice.finish_reason, usage: data.usage};
  }
}
module.exports = {Provider, ORIGIN};
