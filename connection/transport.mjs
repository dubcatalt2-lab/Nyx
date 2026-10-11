import {pack, unpack, limits} from './frames.mjs';

export class Transport {
  constructor(endpoint = '/api/sync') {
    this.endpoint = endpoint;
    this.sequence = 0;
    this.active = new Set();
    this.waiting = [];
    this.started = 0;
  }
  activate(event) {
    if (!(event instanceof Event) || !event.isTrusted || !['click', 'keydown', 'pointerup'].includes(event.type)) throw new Error('A user action is required');
    this.started ||= Date.now();
  }
  async fetch(input, init) {
    if (!this.started) throw new Error('Start the connection first');
    const request = input instanceof Request && !init ? input : new Request(input, init);
    const wireHeaders=new Headers(request.headers);
    if(init?.headers)for(const [name,value] of new Headers(init.headers))wireHeaders.set(name,value);
    request.signal.throwIfAborted();
    const chunks = [];
    let length = 0;
    if (request.body) {
      const reader = request.body.getReader();
      const cancel = () => { void reader.cancel(request.signal.reason).catch(() => {}); };
      request.signal.addEventListener('abort', cancel, {once: true});
      try {
        while (true) {
          request.signal.throwIfAborted();
          const {done, value} = await reader.read();
          if (done) break;
          length += value.length;
          if (length > limits.upload) throw new Error('Upload exceeds size limit');
          chunks.push(value);
        }
      } finally { request.signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const target = new URL(this.endpoint, location.href);
    if (target.origin !== location.origin || !['/api/sync', '/api/presence'].includes(target.pathname) || target.search || target.hash) throw new Error('Invalid endpoint');
    target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
    if (this.waiting.length >= 256) throw new Error('Request queue is full');
    const id = this.sequence = this.sequence % 0xffffffff + 1;
    return new Promise((resolve, reject) => {
      let socket, delay, timeout, settled = false;
      const task = {stop: error => finish(error), start: null};
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(delay);
        clearTimeout(timeout);
        request.signal.removeEventListener('abort', abort);
        this.active.delete(task);
        const index = this.waiting.indexOf(task);
        if (index !== -1) this.waiting.splice(index, 1);
        if (socket && socket.readyState < 2) socket.close();
        error ? reject(error) : resolve(value);
        this.drain();
      };
      const abort = () => finish(request.signal.reason);
      request.signal.addEventListener('abort', abort, {once: true});
      if (request.signal.aborted) { abort(); return; }
      timeout = setTimeout(() => finish(new Error('Request timed out')), 60000);
      task.start = () => {
        this.active.add(task);
        delay = setTimeout(() => {
        socket = new WebSocket(target);
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => {
          try { socket.send(pack(id, 0, {url: request.url, method: request.method, headers: [...wireHeaders]}, bytes)); }
          catch (error) { finish(error); }
        };
        socket.onmessage = event => {
          try {
            if (!(event.data instanceof ArrayBuffer)) throw new Error('Expected binary response');
            const result = unpack(event.data);
            if (result.id !== id) throw new Error('Unexpected response identity');
            const {status, headers} = result.metadata;
            if (result.type === 1) throw new Error(new TextDecoder().decode(result.body) || 'Request failed');
            if (!Number.isInteger(status) || status < 200 || status > 599 || !Array.isArray(headers)) throw new Error('Invalid response');
            const response = new Response(request.method === 'HEAD' || [204,205,304].includes(status) ? null : result.body, {status, headers});
            Object.defineProperty(response, 'url', {value: request.url});
            Object.defineProperty(response, 'headerPairs', {value: headers});
            finish(null, response);
          } catch (error) { finish(error); }
        };
        socket.onerror = () => finish(new Error('Connection failed'));
        socket.onclose = () => finish(new Error('Connection closed before a complete response'));
        }, Math.max(0, this.started - Date.now()));
      };
      this.waiting.push(task);
      this.drain();
    });
  }
  drain() {
    while (this.started && this.active.size < 16 && this.waiting.length) this.waiting.shift().start();
  }
  close() {
    this.started = 0;
    for (const task of [...this.waiting, ...this.active]) task.stop(new Error('Connection closed'));
  }
}

