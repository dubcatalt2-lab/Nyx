// Ephemeral speech frames only. Nothing in this relay is written to disk.
export function createVoiceAudioAccess(check, clock = Date.now) {
  const leases = new Map();
  return async (key, request) => {
    const now = clock(), existing = leases.get(key);
    if (existing && existing.expires > now) return existing.promise;
    for (const [id, lease] of leases) if (lease.expires <= now) leases.delete(id);
    if (leases.size >= 256) leases.delete(leases.keys().next().value);
    const lease = { expires: now + 5000 };
    lease.promise = Promise.resolve().then(() => check(request)).catch(error => {
      if (leases.get(key) === lease) leases.delete(key);
      throw error;
    });
    leases.set(key, lease);
    return lease.promise;
  };
}

export function cleanupVoiceAudio(sessions, now = Date.now()) {
  for (const session of sessions.values()) {
    if (!session.audioRelay) continue;
    if (now - session.audioRelay.seen > 3000) delete session.audioRelay;
    else session.audioRelay.queue = session.audioRelay.queue.filter(frame => now - frame.at < 1000);
  }
}

export function exchangeVoiceAudio(sessions, uid, value, allowedChannels, now = Date.now()) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  const session = sessions.get(uid);
  if (!session || session.sessionId !== value?.sessionId) fail(409, 'Rejoin the voice channel.');
  if (!allowedChannels.has(session.channelId)) {
    sessions.delete(uid);
    fail(403, 'This voice channel is no longer available.');
  }
  if (session.audioRelayVersion !== 1) fail(409, 'Reload Chat to use compatibility voice.');
  // Idle receivers retain no audio; cap active relays independently of room size.
  cleanupVoiceAudio(sessions, now);
  let active = 0;
  for (const peer of sessions.values()) {
    if (peer.audioRelay) active++;
  }
  if (!session.audioRelay && active >= 128) fail(503, 'Compatibility voice is busy. Try again shortly.');
  const relay = session.audioRelay ||= { seen: now, window: now, requests: 0, frames: 0, queue: [] };
  if (now - relay.window >= 1000) Object.assign(relay, { window: now, requests: 0, frames: 0 });
  if (++relay.requests > 20) fail(429, 'Voice audio is arriving too quickly.');
  const frames = value?.frames;
  if (!Array.isArray(frames) || frames.length > 4) fail(400, 'Invalid voice audio batch.');
  if (relay.frames + frames.length > 16) fail(429, 'Voice audio is arriving too quickly.');
  let sequence = session.audioSequence ?? -1;
  for (const frame of frames) {
    if (!Number.isSafeInteger(frame?.seq) || frame.seq < 0 || typeof frame.data !== 'string' ||
        frame.data.length !== 4268 || !/^[A-Za-z0-9+/]{4267}=$/.test(frame.data) ||
        Buffer.from(frame.data, 'base64').length !== 3200) fail(400, 'Invalid voice audio frame.');
    if (frame.seq <= sequence) continue; // A lost socket acknowledgement must not replay audio over HTTP.
    sequence = frame.seq;
  }
  relay.frames += frames.length;
  relay.seen = now;
  session.lastSeenAtMs = now;
  const changed = value.transport === 'relay' && session.audioTransport !== 'relay';
  if (changed) session.audioTransport = 'relay';
  for (const frame of frames) {
    if (frame.seq <= (session.audioSequence ?? -1)) continue;
    session.audioSequence = frame.seq;
    for (const peer of sessions.values()) {
      if (peer.uid === uid || peer.channelId !== session.channelId || !peer.audioRelay ||
          (session.audioTransport !== 'relay' && peer.audioTransport !== 'relay')) continue;
      peer.audioRelay.queue = peer.audioRelay.queue.filter(item => now - item.at < 1000).slice(-63);
      peer.audioRelay.queue.push({ fromUid: uid, fromSessionId: session.sessionId, seq: frame.seq, data: frame.data, at: now });
    }
  }
  const received = relay.queue.filter(frame => {
    const sender = sessions.get(frame.fromUid);
    return now - frame.at < 1000 && sender?.sessionId === frame.fromSessionId && sender.channelId === session.channelId;
  });
  relay.queue = [];
  return { ok: true, frames: received, changed };
}
