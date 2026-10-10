import {pack, unpack, limits} from './frames.mjs';

function activated(signal) {
  if (globalThis.navigator?.userActivation?.hasBeenActive) return Promise.resolve();
  if (!globalThis.document) return Promise.reject(new Error('Start this connection from the application window'));
  return new Promise((resolve, reject) => {
    const finish = error => {
      document.removeEventListener('click', click, true);
      signal.removeEventListener('abort', abort);
      error ? reject(error) : resolve();
    };
    const click = event => { if (event.isTrusted) finish(); };
    const abort = () => finish(signal.reason);
    document.addEventListener('click', click, true);
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
  });
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
  });
}

function abortable(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, {once: true});
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

async function readBody(body, signal) {
  if (body == null) return new Uint8Array();
  const reader = new Response(body).body.getReader();
  const chunks = [];
  let length = 0;
  const abort = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal?.addEventListener('abort', abort, {once: true});
  try {
    while (true) {
      signal?.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limits.upload) throw new Error('Upload exceeds the size limit');
      chunks.push(value);
    }
    signal?.throwIfAborted();
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export default class Transport {
  constructor({endpoint = '/api/sync'} = {}) {
    this.endpoint = endpoint;
    this.ready = false;
    this.pending = new Map();
    this.sequence = 0;
    this.lifetime = new AbortController();
  }
  init() {
    if (!this.starting) this.starting = this.start();
    return this.starting;
  }
  async start() {
    await activated(this.lifetime.signal);
    const entropy = crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
    await delay(2000 + Math.floor(entropy * 3001), this.lifetime.signal);
    const target = new URL(this.endpoint, location.href);
    if (target.origin !== location.origin || target.pathname !== '/api/sync' || target.search || target.hash) throw new Error('Invalid connection endpoint');
    target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
    return new Promise((resolve, reject) => {
      const socket = this.socket = new WebSocket(target);
      socket.binaryType = 'arraybuffer';
      const timer = setTimeout(() => this.close(new Error('Connection timed out')), 15000);
      socket.onopen = () => { clearTimeout(timer); this.ready = true; resolve(); };
      socket.onmessage = event => {
        try {
          if (!(event.data instanceof ArrayBuffer)) throw new Error('Expected a binary message');
          const {metadata, body} = unpack(event.data);
          const pending = this.pending.get(metadata.id);
          if (!pending) return;
          if (metadata.kind === 'error') { pending.finish(new Error(metadata.message || 'Request failed')); return; }
          if (metadata.kind !== 'result' || !Number.isInteger(metadata.status) || metadata.status < 100 || metadata.status > 599 || !Array.isArray(metadata.headers)) throw new Error('Invalid response');
          pending.finish(null, {status: metadata.status, statusText: metadata.statusText || '', headers: metadata.headers, body: body.slice().buffer});
        } catch (error) { this.close(error); }
      };
      socket.onerror = () => this.close(new Error('Connection failed'));
      socket.onclose = () => { clearTimeout(timer); const error = this.failure || new Error('Connection closed'); reject(error); this.close(error); };
    });
  }
  async request(remote, method = 'GET', body = null, headers = [], signal) {
    signal?.throwIfAborted();
    const bytes = await readBody(body, signal);
    await abortable(this.init(), signal);
    signal?.throwIfAborted();
    if (!this.ready) throw this.failure || new Error('Connection is closed');
    if (this.pending.size >= 16) throw new Error('Too many simultaneous requests');
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (error, value) => {
        if (!this.pending.delete(id)) return;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        error ? reject(error) : resolve(value);
      };
      const abort = () => {
        if (this.socket.readyState === WebSocket.OPEN) this.socket.send(pack({id, kind: 'cancel'}));
        finish(signal?.reason || new Error('Request timed out'));
      };
      this.pending.set(id, {finish});
      timer = setTimeout(abort, 45000);
      signal?.addEventListener('abort', abort, {once: true});
      try {
        if (this.socket.bufferedAmount + bytes.length > limits.frame) throw new Error('Connection queue is full');
        this.socket.send(pack({id, kind: 'request', url: String(remote), method, headers: [...headers]}, bytes));
      } catch (error) { finish(error); }
    });
  }
  connect() {
    throw new Error('This experimental connection does not yet support live sockets. Use the standard connection for this site.');
  }
  close(error = new Error('Connection closed')) {
    if (this.lifetime.signal.aborted) return;
    this.failure = error;
    this.ready = false;
    this.lifetime.abort(error);
    for (const pending of this.pending.values()) pending.finish(error);
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
  }
}
