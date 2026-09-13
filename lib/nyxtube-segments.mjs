import { createHash, randomUUID } from 'node:crypto';
import { writeFile, rename, statfs, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readMp4Index, segmentTrack, makeFragment } from './nyxtube-mp4.mjs';

const MB = 1024 ** 2, IDLE = 2 * 3600000, MAX_SEGMENT = 16 * MB;
export const HLS_CACHE_NAME = /^hls-[a-f0-9]{32}-(video|audio)-\d{1,6}\.m4s$/;
const error = (message, code = 'service', status = 503) => Object.assign(new Error(message), { code, status });

export function createTubeSegments({ root, files, leases, evict, info, choices, response, guard, now, record }) {
  const entries = new Map(), preparing = new Map(), jobs = new Map(), queue = [];
  let running = 0, indexing = false, closed = false, indexController;
  const check = () => { if (closed) throw error('Video playback is shutting down.'); guard(); };
  async function read(media, format, start, end, signal) {
    const chunks = []; let total;
    for (let offset = start; offset <= end;) {
      const last = Math.min(end, offset + 4 * MB - 1);
      let block;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const upstream = await response(media, format, AbortSignal.any([signal, AbortSignal.timeout(15000)]), `bytes=${offset}-${last}`);
          const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(upstream.headers.get('content-range') || '');
          if (upstream.status !== 206 || !match || Number(match[1]) !== offset || Number(match[2]) > last
              || Number(match[2]) < offset || Number(match[2]) >= Number(match[3]) || !Number.isSafeInteger(Number(match[3]))) {
            await upstream.body?.cancel(); throw error('This video does not support indexed playback.', 'video', 422);
          }
          const count = Number(match[2]) - offset + 1;
          const parts = []; let received = 0;
          for await (const chunk of upstream.body) {
            received += chunk.length;
            if (received > count) throw error('The video returned too much range data.', 'video', 422);
            parts.push(chunk);
          }
          if (received !== count) throw error('A video segment download was interrupted.');
          block = Buffer.concat(parts); total = Number(match[3]); break;
        } catch (e) { if (signal.aborted || attempt === 2 || ['video', 'authentication', 'rate'].includes(e.code)) throw e; }
      }
      chunks.push(block); offset += block.length;
      if (offset >= total) break;
    }
    return { data: Buffer.concat(chunks), total };
  }
  function sweep() {
    for (const [token, entry] of entries) if (entry.touched < now() - IDLE && !entry.users) entries.delete(token);
  }
  async function prepare(id, height) {
    sweep();
    const key = `${id}-${height}`;
    for (const entry of entries.values()) if (entry.key === key) { entry.touched = now(); return ready(entry); }
    if (preparing.has(key)) return preparing.get(key);
    check();
    if (indexing) throw error('Another video index is being prepared. Try again shortly.', 'busy', 429);
    indexing = true;
    indexController = new AbortController();
    const work = (async () => {
      const signal = AbortSignal.any([indexController.signal, AbortSignal.timeout(45000)]);
      const media = await info(id, false, signal), choice = choices(media).find(f => f.height === height);
      if (!choice) throw error('That video quality is unavailable.', 'video', 422);
      const video = await readMp4Index((a, b) => read(media, choice.video, a, b, signal), 'video');
      const audioFormat = choice.audio || choice.video;
      const audio = await readMp4Index((a, b) => read(media, audioFormat, a, b, signal), 'audio');
      video.format = choice.video; audio.format = audioFormat;
      const tracks = { video, audio }, bytes = video.bytes + audio.bytes;
      if (bytes > 64 * MB) throw error('This video index exceeds the playback memory limit.', 'video', 422);
      let used = [...entries.values()].reduce((sum, e) => sum + e.bytes, 0);
      for (const [token, entry] of [...entries].sort((a, b) => a[1].touched - b[1].touched)) {
        if (used + bytes <= 128 * MB && entries.size < 64) break;
        if (entry.users || entry.touched > now() - 60000) continue;
        entries.delete(token); used -= entry.bytes;
      }
      if (used + bytes > 128 * MB || entries.size >= 64) throw error('Video playback is busy. Try again shortly.', 'busy', 429);
      const hash = createHash('sha256').update(key);
      for (const track of Object.values(tracks)) {
        hash.update(track.init).update(Buffer.from(track.offset.buffer)).update(Buffer.from(track.size.buffer));
        track.segments = segmentTrack(track);
      }
      const token = hash.digest('hex').slice(0, 32);
      const entry = { token, key, id, height, tracks, bytes, media, refreshed: now(), touched: now(), users: 0,
        shift: Math.max(video.edit / video.timescale, audio.edit / audio.timescale) };
      entries.set(token, entry);
      return ready(entry);
    })().catch(e => { if (!closed) record(e); throw e; }).finally(() => { preparing.delete(key); indexing = false; indexController = null; });
    preparing.set(key, work); return work;
  }
  const ready = entry => ({ state: 'ready', kind: 'hls', url: `/api/nyxtube/native/hls/${entry.token}/master.m3u8` });
  function entryFor(token) {
    const entry = /^[a-f0-9]{32}$/.test(token) && entries.get(token);
    if (!entry || (entry.touched < now() - IDLE && !entry.users)) throw error('This video session expired. Reload the video to continue.', 'expired', 410);
    entry.touched = now(); return entry;
  }
  function playlist(token, name) {
    const entry = entryFor(token);
    if (name === 'master.m3u8') {
      const { video, audio } = entry.tracks;
      return `#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=${Math.ceil((Number(video.format.tbr) || 2500) * 1000 + 256000)},CODECS="${video.codec},${audio.codec}",AUDIO="audio"\nvideo.m3u8\n`;
    }
    const kind = name.replace('.m3u8', ''), track = entry.tracks[kind];
    if (!track) throw error('Unknown video playlist.', 'video', 404);
    return `#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...track.segments.map(s => s.duration)))}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-MAP:URI="${kind}-init.mp4"\n` +
      track.segments.map((s, n) => `#EXTINF:${s.duration.toFixed(6)},\n${kind}-${n}.m4s\n`).join('') + '#EXT-X-ENDLIST\n';
  }
  function init(token, kind) { return entryFor(token).tracks[kind]?.init; }
  function cached(name) {
    const file = files.get(name); if (!file) return null;
    file.touched = now(); leases.set(name, (leases.get(name) || 0) + 1);
    let released = false;
    return { path: file.path, release() { if (!released) { released = true; const n = (leases.get(name) || 1) - 1; if (n) leases.set(name, n); else leases.delete(name); } } };
  }
  function pump() {
    while (!closed && running < 2 && queue.length) {
      const job = queue.shift();
      if (job.controller.signal.aborted) { job.reject(error('Video request cancelled.')); continue; }
      running++;
      job.done = job.run().then(job.resolve, job.reject).finally(() => { running--; pump(); });
    }
  }
  async function segment(token, kind, number, signal) {
    signal.throwIfAborted();
    const entry = entryFor(token), track = entry.tracks[kind], item = track?.segments[number];
    if (!item || !Number.isInteger(number) || number < 0) throw error('Unknown video segment.', 'video', 404);
    const name = `hls-${token}-${kind}-${number}.m4s`;
    const hit = cached(name); if (hit) return hit;
    check();
    let job = jobs.get(name);
    if (!job) {
      if (queue.length >= 8) throw error('Video playback is busy. Try again shortly.', 'busy', 429);
      const controller = new AbortController();
      entry.users++;
      job = { controller, consumers: 0, run: async () => {
        check();
        const deadline = setTimeout(() => controller.abort(error('Video segment preparation timed out.')), 45000);
        const temporary = join(root, `work-${randomUUID()}`);
        try {
          // Two bounded 16 MiB writers fit inside this reservation, including publication overhead.
          await evict(64 * MB);
          const disk = await statfs(root);
          if (disk.bavail * disk.bsize < 2 * 1024 * MB + 64 * MB) throw error('The server needs more free space before preparing video segments.');
          if (entry.refreshed < now() - 4 * 60000) {
            entry.refresh ||= info(entry.id, true).then(media => {
              const fresh = choices(media).find(f => f.height === entry.height);
              if (!fresh || fresh.video.format_id !== entry.tracks.video.format.format_id
                || (fresh.audio || fresh.video).format_id !== entry.tracks.audio.format.format_id) { entries.delete(entry.token); throw error('The video stream changed. Reload the video.', 'expired', 410); }
              entry.media = media; entry.tracks.video.format = fresh.video; entry.tracks.audio.format = fresh.audio || fresh.video;
              entry.refreshed = now();
            }).finally(() => { entry.refresh = null; });
            await entry.refresh;
          }
          const { start, end } = item;
          let first = track.fragmented ? item.offset : Infinity, last = track.fragmented ? item.offset + item.length : 0, size = track.fragmented ? item.length : 0;
          if (!track.fragmented) for (let i = start; i < end; i++) { first = Math.min(first, track.offset[i]); last = Math.max(last, track.offset[i] + track.size[i]); size += track.size[i]; }
          if (last - first > MAX_SEGMENT || size > MAX_SEGMENT - 128000) throw error('This video segment is too large. Choose a lower quality.', 'video', 422);
          const range = await read(entry.media, track.format, first, last - 1, controller.signal);
          if (range.total !== track.total || range.data.length !== last - first) { entries.delete(entry.token); throw error('The video stream changed. Reload the video.', 'expired', 410); }
          let fragment = range.data;
          if (!track.fragmented) {
            const samples = [];
            for (let i = start; i < end; i++) samples.push(range.data.subarray(track.offset[i] - first, track.offset[i] - first + track.size[i]));
            fragment = makeFragment(track, item, number + 1, entry.shift, Buffer.concat(samples));
          }
          if (fragment.length > MAX_SEGMENT) throw error('This video segment is too large. Choose a lower quality.', 'video', 422);
          const path = join(root, name);
          // A temporary regular file is atomically published; no partial fragment is served.
          await writeFile(temporary, fragment, { mode: 0o600, signal: controller.signal });
          await rename(temporary, path);
          files.set(name, { path, size: fragment.length, touched: now() }); record(null);
        } catch (e) { if (!controller.signal.aborted || controller.signal.reason?.code === 'service') record(controller.signal.aborted ? controller.signal.reason : e); throw e; }
        finally { clearTimeout(deadline); await rm(temporary, { force: true }); }
      } };
      job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
      job.promise.finally(() => { jobs.delete(name); entry.users--; }).catch(() => {});
      jobs.set(name, job); queue.push(job);
    }
    job.consumers++;
    let rejectWait, timer;
    const abort = () => rejectWait(error('Video request cancelled.'));
    const interrupted = new Promise((_, reject) => {
      rejectWait = reject;
      timer = setTimeout(() => reject(error('Video segment preparation took too long.')), 60000);
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    pump();
    try {
      await Promise.race([job.promise, interrupted]);
      if (signal.aborted) throw error('Video request cancelled.');
      const result = cached(name); if (!result) throw error('The video segment expired. Retry playback.'); return result;
    } finally {
      signal.removeEventListener('abort', abort);
      clearTimeout(timer);
      if (--job.consumers === 0) {
        job.controller.abort();
        const at = queue.indexOf(job);
        if (at !== -1) { queue.splice(at, 1); job.reject(error('Video request cancelled.')); }
      }
    }
  }
  async function close() {
    closed = true; indexController?.abort();
    const pending = [...jobs.values()];
    for (const job of pending) job.controller.abort();
    for (const job of queue.splice(0)) job.reject(error('Video playback is shutting down.'));
    await Promise.allSettled([...pending.map(j => j.done || j.promise), ...preparing.values()]);
    entries.clear();
  }
  return { prepare, playlist, init, segment, sweep, close, get active() { return running; }, get indexing() { return indexing; } };
}
