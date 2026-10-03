import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';

// Large Unity assets must not become one retained ArrayBuffer per player.
// Only the few resources requiring text edits are buffered, with a shared cap.
export function createGameProxy({ request = fetch, headerTimeout = 12000,
  idleTimeout = 30000, transferTimeout = 300000, maxBuffered = 64 * 1024 ** 2,
  maxTransforms = 2, maxWaiting = 24 } = {}) {
  let active = 0, buffered = 0, transforms = 0;
  const waiting = [];
  const failure = (message, status = 502) => Object.assign(new Error(message), { status });
  async function acquire(signal) {
    signal.throwIfAborted();
    if (transforms < maxTransforms) { transforms++; return; }
    if (waiting.length >= maxWaiting) throw failure('Game preparation is busy', 503);
    await new Promise((resolve, reject) => {
      const item = { resolve: () => { cleanup(); resolve(); } };
      const abort = () => { const i = waiting.indexOf(item); if (i >= 0) waiting.splice(i, 1); cleanup(); reject(signal.reason); };
      const cleanup = () => signal.removeEventListener('abort', abort);
      waiting.push(item); signal.addEventListener('abort', abort, { once: true });
    });
  }
  function release() { const next = waiting.shift(); if (next) next.resolve(); else transforms--; }
  async function send(req, res, { candidates, validate = () => {}, contentType = (_url, type) => type,
    transform = () => null, cacheControl = 'no-store' }) {
    active++;
    const controller = new AbortController(), { signal } = controller;
    const disconnect = () => { if (!res.writableFinished) controller.abort(new Error('Player disconnected')); };
    res.once('close', disconnect);
    if (res.destroyed) disconnect();
    const lifetime = setTimeout(() => controller.abort(failure('Game transfer timed out', 504)), transferTimeout);
    lifetime.unref?.();
    let lastError;
    try {
      for (const url of candidates) {
        signal.throwIfAborted();
        let upstream, reader, idle, slot = false, bytes = 0;
        const attempt = new AbortController();
        const attemptSignal = AbortSignal.any([signal, attempt.signal]);
        const arm = ms => { clearTimeout(idle); idle = setTimeout(() => attempt.abort(failure('Game source timed out', 504)), ms); idle.unref?.(); };
        try {
          for (let retry = 0; retry < 3; retry++) {
            arm(headerTimeout);
            try {
              upstream = await request(url, { headers: { accept: '*/*', 'user-agent': 'nyx/1.0' }, signal: attemptSignal });
            } catch (error) {
              clearTimeout(idle);
              if (attemptSignal.aborted || retry === 2) throw error;
              await delay(180 + retry * 260, undefined, { signal: attemptSignal });
              continue;
            }
            clearTimeout(idle);
            if (upstream.ok) break;
            await upstream.body?.cancel();
            if (retry === 2 || ![429, 500, 502, 503, 504].includes(upstream.status)) throw failure(`HTTP ${upstream.status}`, upstream.status);
            await delay(180 + retry * 260, undefined, { signal: attemptSignal });
          }
          reader = upstream.body?.getReader();
          const read = async () => { arm(idleTimeout); try { return reader ? await reader.read() : { done: true }; } finally { clearTimeout(idle); } };
          // Sniff before writing headers so an HTML error can still use a mirror.
          const head = []; let headSize = 0;
          while (headSize < 512) {
            const part = await read(); if (part.done) break;
            head.push(Buffer.from(part.value.buffer, part.value.byteOffset, part.value.byteLength)); headSize += part.value.byteLength;
          }
          const prefix = Buffer.concat(head, headSize);
          const type = upstream.headers.get('content-type') || 'application/octet-stream';
          validate(url, { body: prefix, contentType: type });
          const edit = transform(url, type, prefix);
          async function* chunks() {
            if (prefix.length) yield prefix;
            for (;;) { const part = await read(); if (part.done) return; yield part.value; }
          }
          let body;
          if (typeof edit === 'function') {
            arm(idleTimeout); await acquire(attemptSignal); clearTimeout(idle); slot = true;
            const parts = [];
            for await (const part of chunks()) {
              if (bytes + part.byteLength > maxBuffered) throw failure('Game script exceeds the preparation limit');
              parts.push(part); bytes += part.byteLength; buffered += part.byteLength;
            }
            body = await edit(Buffer.concat(parts, bytes));
          }
          signal.throwIfAborted();
          res.setHeader('Cache-Control', cacheControl);
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Type', contentType(url, type));
          // Preserve progress totals only when fetch has not decoded the body.
          const length = upstream.headers.get('content-length');
          if (!edit && !upstream.headers.get('content-encoding') && /^\d+$/.test(length || '')) res.setHeader('Content-Length', length);
          if (body) {
            // pipeline respects a slow client; keep the transform slot until sent.
            res.setHeader('Content-Length', String(body.byteLength));
            await pipeline(Readable.from([body]), res, { signal: attemptSignal });
          } else {
            const stream = Readable.from(chunks(), { objectMode: false, highWaterMark: 64 * 1024 });
            if (edit?.stream) await pipeline(stream, edit.stream(), res, { signal: attemptSignal });
            else await pipeline(stream, res, { signal: attemptSignal });
          }
          return;
        } catch (error) {
          lastError = error;
          if (res.headersSent || res.destroyed || signal.aborted) throw error;
        } finally {
          clearTimeout(idle); attempt.abort();
          await reader?.cancel().catch(() => {});
          reader?.releaseLock();
          buffered -= bytes; if (slot) release();
        }
      }
      throw lastError || failure('Game source unavailable');
    } finally {
      clearTimeout(lifetime); res.removeListener('close', disconnect); controller.abort(); active--;
    }
  }
  return { send, stats: () => ({ active, transforms, waiting: waiting.length, bufferedMiB: Math.round(buffered / 1024 ** 2) }) };
}
