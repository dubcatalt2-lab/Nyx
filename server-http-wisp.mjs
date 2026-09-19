import { randomBytes } from 'node:crypto';
import express from 'express';
import WebSocket from 'ws';

// Carries Wisp frames to a fixed server-owned relay. Clients cannot choose a target.
export function installHttpWisp(app, {upstream, allowed, clientIp, banned = async () => false}) {
  const sessions = new Map();
  const attempts = new Map();
  const maxQueue = 8 * 1024 * 1024;
  const maxSendQueue = 2 * 1024 * 1024;
  function dispose(s) {
    if (!sessions.delete(s.token)) return;
    clearTimeout(s.connectTimer);
    if (s.poll) { clearTimeout(s.poll.timer); s.poll.res.sendStatus(410); s.poll = null; }
    s.ws.terminate(); s.frames = []; s.bytes = 0;
  }
  function flush(s) {
    if (!s.poll || !s.frames.length) return;
    const {res, timer} = s.poll; s.poll = null; clearTimeout(timer);
    const data = Buffer.concat(s.frames, s.bytes); s.frames = []; s.bytes = 0;
    res.type('application/octet-stream').send(data);
    if(s.ws.isPaused && s.ws.readyState===WebSocket.OPEN)s.ws.resume();
  }
  const sweep = setInterval(() => {
    for (const s of sessions.values()) if (Date.now() - s.touched > 60000) dispose(s);
    for (const [ip, entry] of attempts) if (Date.now() - entry.start > 60000) attempts.delete(ip);
  }, 10000); sweep.unref();
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!allowed(req)) return res.sendStatus(403);
    next();
  });
  router.post('/sessions', async (req, res) => {
    try {
      const ip = clientIp(req);
      let entry = attempts.get(ip);
      if (!entry || Date.now() - entry.start > 60000) {
        if (!entry && attempts.size >= 2048) return res.sendStatus(429);
        entry = {start: Date.now(), count: 0}; attempts.set(ip, entry);
      }
      if (++entry.count > 30) return res.sendStatus(429);
      if (await banned(req)) return res.sendStatus(403);
      if (sessions.size >= 64 || [...sessions.values()].filter(s => s.ip === ip).length >= 6) return res.sendStatus(429);
      const target = upstream();
      if (!target) return res.sendStatus(503);
      const token = randomBytes(32).toString('hex');
      const ws = new WebSocket(target.url, {origin: target.origin, handshakeTimeout: 8000, maxPayload: maxSendQueue, perMessageDeflate: false});
      const s = {token, ip, ws, touched: Date.now(), frames: [], bytes: 0, sequence: 0, poll: null};
      sessions.set(token, s);
      s.connectTimer = setTimeout(() => { dispose(s); if (!res.headersSent) res.sendStatus(504); }, 9000);
      res.on('close', () => { if (!res.writableEnded) dispose(s); });
      ws.on('open', () => { clearTimeout(s.connectTimer); res.json({token}); });
      ws.on('message', (data, binary) => {
        if (!binary || s.bytes + data.length + 4 > maxQueue) return dispose(s);
        const size = Buffer.alloc(4); size.writeUInt32LE(data.length);
        s.frames.push(size, data); s.bytes += 4 + data.length;
        // Image grids can arrive faster than the next HTTP poll. Apply backpressure
        // before the bounded queue fills instead of disconnecting healthy streams.
        if(s.bytes>=maxQueue/2&&!s.poll)s.ws.pause();
        flush(s);
      });
      ws.on('error', () => { dispose(s); if (!res.headersSent) res.sendStatus(502); });
      ws.on('close', () => { dispose(s); if (!res.headersSent) res.sendStatus(502); });
    } catch { if (!res.headersSent) res.sendStatus(503); }
  });
  router.use((req, res, next) => {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
    const s = sessions.get(token);
    if (!s || s.ip !== clientIp(req)) return res.sendStatus(410);
    s.touched = Date.now(); req.relaySession = s; next();
  });
  router.get('/receive', (req, res) => {
    const s = req.relaySession;
    if (s.poll) return res.sendStatus(409);
    const timer = setTimeout(() => { s.poll = null; res.sendStatus(204); }, 20000);
    s.poll = {res, timer};
    res.on('close', () => { if (s.poll?.res === res) { clearTimeout(timer); s.poll = null; } });
    flush(s);
  });
  router.post('/send', express.raw({type: 'application/octet-stream', limit: '256kb'}), (req, res) => {
    const s = req.relaySession;
    if (!Buffer.isBuffer(req.body) || Number(req.headers['x-tutsi-sequence']) !== s.sequence || s.ws.readyState !== WebSocket.OPEN) return res.sendStatus(409);
    if (s.ws.bufferedAmount + req.body.length > maxSendQueue) { dispose(s); return res.sendStatus(429); }
    s.sequence++;
    s.ws.send(req.body, {binary: true}, error => { if (error) { dispose(s); res.sendStatus(502); } else res.sendStatus(204); });
  });
  router.delete('/session', (req, res) => { dispose(req.relaySession); res.sendStatus(204); });
  app.use('/api/tutsi-relay', router);
  return () => { clearInterval(sweep); attempts.clear(); for (const s of sessions.values()) dispose(s); };
}
