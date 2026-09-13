import { mkdtemp, copyFile, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeTubeTool, TubeError } from './nyxtube-streaming.mjs';

const VIDEO = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const text = (value, limit = 2000) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, limit);
const count = value => value != null && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;
const date = value => Number.isFinite(value) && Math.abs(value) < 8e12 ? new Date(value * 1000).toISOString() : null;
function picture(value, avatar = false) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (avatar ? /(^|\.)(ggpht\.com|googleusercontent\.com)$/ : /(^|\.)ytimg\.com$/).test(url.hostname) ? url.href : '';
  } catch { return ''; }
}
function permitted(info, full) {
  return VIDEO.test(info?.id || '') && (!full || info.availability === 'public')
    && (!info.availability || info.availability === 'public')
    && !(Number(info.age_limit) > 0) && !info.is_live && !info.is_upcoming
    && !['is_live', 'is_upcoming', 'post_live'].includes(info.live_status)
    && info.playable_in_embed !== false
    && (!Array.isArray(info.geo_countries) || info.geo_countries.includes('US'));
}
export function catalogVideo(info, full = false) {
  if (!permitted(info, full)) return null;
  const duration = count(info.duration);
  if (full && !(duration > 0)) return null;
  return {
    id: info.id, title: text(info.title || 'Untitled video', 180),
    creator: text(info.channel || info.uploader || 'YouTube', 100),
    channelId: CHANNEL.test(info.channel_id || '') ? info.channel_id : '', channelAvatar: '',
    description: text(info.description, 5000),
    thumbnail: picture(info.thumbnail) || (info.thumbnails || []).map(t => picture(t.url)).filter(Boolean).at(-1) || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
    publishedAt: date(info.timestamp) || (/^\d{8}$/.test(info.upload_date || '') ? `${info.upload_date.slice(0,4)}-${info.upload_date.slice(4,6)}-${info.upload_date.slice(6,8)}T00:00:00.000Z` : null),
    durationSeconds: duration || 0, viewCount: count(info.view_count), likeCount: count(info.like_count), commentCount: count(info.comment_count),
    captions: Boolean(Object.keys(info.subtitles || {}).length || Object.keys(info.automatic_captions || {}).length),
    isShort: duration > 0 && duration <= 180, sourceUrl: `https://www.youtube.com/watch?v=${info.id}`,
    detailsPending: !full
  };
}

// Search entries are discovery metadata, not a playback authorization. Full
// public-video validation is performed on opening/preparing every selected ID.
export function createTubeCatalog(options = {}) {
  const env = options.env || process.env;
  const binary = env.NYX_YTDLP_BIN || (process.platform === 'win32' ? 'yt-dlp' : '/var/lib/nyx/yt-dlp/venv/bin/yt-dlp');
  const run = options.execute || executeTubeTool, now = options.now || Date.now;
  const cache = new Map(), inflight = new Map(), waiting = [], controllers = new Set();
  let active = 0, cacheBytes = 0, closed = false;
  function prune(key) { const entry = cache.get(key); if (entry) cacheBytes -= entry.bytes; cache.delete(key); }
  function remember(key, value, ttl) {
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if (bytes > 8 * 1024 ** 2) return value;
    prune(key);
    while (cache.size >= 160 || cacheBytes + bytes > 32 * 1024 ** 2) prune(cache.keys().next().value);
    cache.set(key, { value, bytes, expires: now() + ttl }); cacheBytes += bytes;
    return value;
  }
  async function cached(key, task, ttl = 5 * 60000) {
    if (closed) throw new TubeError('setup', 'The video service is stopping.');
    const entry = cache.get(key);
    if (entry?.expires > now()) {
      if (entry.value.failure) throw new TubeError(entry.value.failure, entry.value.message, entry.value.status);
      return entry.value;
    }
    prune(key);
    if (inflight.has(key)) return inflight.get(key);
    const promise = Promise.resolve().then(task).then(value => remember(key, value, ttl)).catch(error => {
      const safe = error instanceof TubeError ? error : new TubeError('service', 'Video information could not be loaded.');
      if (safe.code !== 'busy') remember(key, { failure: safe.code, message: safe.message, status: safe.status }, 15000);
      throw safe;
    }).finally(() => inflight.delete(key));
    inflight.set(key, promise); return promise;
  }
  async function acquire() {
    if (closed) throw new TubeError('setup', 'The video service is stopping.');
    if (active < 2) { active++; return; }
    if (waiting.length >= 8) throw new TubeError('busy', 'Video search is busy. Try again shortly.', 429);
    await new Promise((resolve, reject) => {
      const item = { resolve, reject, timer: null };
      item.timer = setTimeout(() => { waiting.splice(waiting.indexOf(item), 1); reject(new TubeError('busy', 'Video search is busy. Try again shortly.', 429)); }, 15000);
      waiting.push(item);
    });
  }
  function release() {
    const next = waiting.shift();
    if (next) { clearTimeout(next.timer); next.resolve(); } else active--;
  }
  async function extract(target, extra = []) {
    await acquire();
    const controller = new AbortController(); controllers.add(controller);
    let work;
    try {
      if (closed) throw new TubeError('setup', 'The video service is stopping.');
      work = await mkdtemp(join(tmpdir(), 'nyx-tube-catalog-'));
      const args = ['--ignore-config', '--no-cache-dir', '--js-runtimes', `node:${process.execPath}`, '--skip-download', '--no-warnings', '--socket-timeout', '8', '--retries', '0', '--extractor-retries', '0', '--dump-single-json', ...extra];
      if (env.NYX_YOUTUBE_COOKIES_FILE) {
        const cookies = join(work, 'cookies.txt');
        try { await copyFile(env.NYX_YOUTUBE_COOKIES_FILE, cookies); await chmod(cookies, 0o600); }
        catch { throw new TubeError('setup', 'The server login file is missing or unreadable.'); }
        args.push('--cookies', cookies);
      }
      args.push('--', target);
      return JSON.parse(await run(binary, args, { timeout: 35000, signal: controller.signal, maxBytes: 8 * 1024 ** 2 }));
    } finally {
      try { if (work) await rm(work, { recursive: true, force: true }); }
      finally { controllers.delete(controller); release(); }
    }
  }
  const validateId = id => { if (!VIDEO.test(id)) throw new TubeError('video', 'Choose a valid video.', 400); return id; };
  async function info(id) {
    validateId(id);
    return cached(`info:${id}`, async () => {
      const result = await extract(`https://www.youtube.com/watch?v=${id}`, ['--no-playlist']);
      if (result.id !== id || !catalogVideo(result, true)) throw new TubeError('video', 'That video is unavailable or restricted.', 422);
      return result;
    });
  }
  const video = async id => {
    const result = catalogVideo(await info(id), true);
    if (result.channelId) {
      try { result.channelAvatar = (await channel(result.channelId)).channel.avatarUrl; }
      catch { /* Optional creator artwork must not prevent playback. */ }
    }
    return result;
  };
  function search(query, limit = 24) {
    const clean = text(query, 100).replace(/\s+/g, ' ').trim();
    if (clean.length < 2) throw new TubeError('video', 'Enter at least two characters to search.', 400);
    const size = Math.max(1, Math.min(50, Math.floor(Number(limit) || 24)));
    return cached(`search:${clean.toLowerCase()}:${size}`, async () => {
      const result = await extract(`ytsearch${size}:${clean}`, ['--flat-playlist', '--playlist-end', String(size)]);
      const entries = Array.isArray(result.entries) ? result.entries : [];
      return [...new Map(entries.slice(0, size).map(item => catalogVideo(item)).filter(Boolean).map(item => [item.id, item])).values()];
    });
  }
  function channel(id) {
    if (!CHANNEL.test(id)) throw new TubeError('video', 'Choose a valid channel.', 400);
    return cached(`channel:${id}`, async () => {
      const result = await extract(`https://www.youtube.com/channel/${id}/videos`, ['--flat-playlist', '--playlist-end', '12']);
      if (result.channel_id && result.channel_id !== id) throw new TubeError('video', 'That channel is unavailable.', 404);
      const avatar = (result.thumbnails || []).map(item => picture(item.url, true)).filter(Boolean).at(-1) || '';
      return { channel: { id, title: text(result.channel || result.uploader || result.title || 'YouTube channel', 120), handle: text(result.uploader_id, 120), description: text(result.description, 3000), avatarUrl: avatar, subscriberCount: count(result.channel_follower_count), videoCount: count(result.playlist_count) }, videos: (result.entries || []).slice(0,12).map(item => catalogVideo(item)).filter(Boolean) };
    }, 10 * 60000);
  }
  async function comments(id) {
    validateId(id);
    return cached(`comments:${id}`, async () => {
      await info(id);
      const result = await extract(`https://www.youtube.com/watch?v=${id}`, ['--no-playlist', '--write-comments', '--extractor-args', 'youtube:max_comments=20,20,0,0;comment_sort=top']);
      if (result.id !== id || !catalogVideo(result, true)) throw new TubeError('video', 'Comments are unavailable.', 422);
      if (!Array.isArray(result.comments)) return { available: false, comments: [], message: 'Comments are unavailable for this video.' };
      return { available: true, comments: result.comments.slice(0,20).filter(c => text(c.text)).map(c => ({ id: text(c.id,120), author: text(c.author || 'YouTube viewer',100), avatarUrl: picture(c.author_thumbnail,true), text: text(c.text), likeCount: count(c.like_count), replyCount: count(c.reply_count), publishedAt: date(c.timestamp), updatedAt: null })) };
    });
  }
  async function close() {
    closed = true;
    for (const item of waiting.splice(0)) { clearTimeout(item.timer); item.reject(new TubeError('setup', 'The video service is stopping.')); }
    for (const controller of controllers) controller.abort();
    await Promise.allSettled([...inflight.values()]); cache.clear(); cacheBytes = 0;
  }
  return { info, video, search, channel, comments, close };
}
