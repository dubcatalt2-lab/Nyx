import { TubeError } from './nyxtube-streaming.mjs';

// API-enabled instance from https://api.invidious.io/. Deployment configuration
// can replace this with an operator's instance or an empty string to disable it.
export const DEFAULT_INVIDIOUS_ORIGINS = 'https://invidious.f5.si';
export function invidiousEmbedOrigin(env = process.env) {
  try {
    const url = new URL(env.NYX_INVIDIOUS_EMBED_ORIGIN ?? 'https://invidious.tiekoetter.com');
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && !url.search && !url.hash && url.pathname === '/' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ? url.origin : '';
  } catch { return ''; }
}
const unavailable = () => new TubeError('service', 'The backup video service is unavailable.');
const restricted = () => new TubeError('video', 'That video is unavailable or restricted.', 422);
const idPattern = /^[A-Za-z0-9_-]{11}$/;

function entry(item) {
  return {id: item.videoId, title: item.title, channel: item.author, channel_id: item.authorId,
    description: item.description, thumbnails: item.videoThumbnails, duration: Number(item.lengthSeconds),
    timestamp: item.published, view_count: item.viewCount, like_count: item.likeCount,
    availability: item.isListed === false || item.paid || item.premium ? 'private' : 'public',
    age_limit: item.isFamilyFriendly === false ? 18 : 0,
    is_live: Boolean(item.liveNow), is_upcoming: Boolean(item.isUpcoming), geo_countries: item.allowedRegions};
}
export function invidiousInfo(item, id) {
  if (item?.videoId !== id || item.isListed !== true || item.isFamilyFriendly !== true
    || item.paid || item.premium || item.liveNow || item.isUpcoming
    || !Array.isArray(item.allowedRegions) || !item.allowedRegions.includes('US') || !(Number(item.lengthSeconds) > 0)) throw restricted();
  // Public instances can return stream signatures bound to their own IP.
  // Keep discovery useful without advertising unverified playback URLs.
  return {...entry(item), formats: [], metadataOnly: true, availability: 'public', age_limit: 0};
}

export function createInvidiousFallback({env = process.env, fetch: request = fetch, now = Date.now} = {}) {
  const origins = [...new Set(String(env.NYX_INVIDIOUS_ORIGINS ?? DEFAULT_INVIDIOUS_ORIGINS).split(',').map(value => {
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && !url.search && !url.hash && url.pathname === '/' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)
        ? url.origin : '';
    } catch { return ''; }
  }).filter(Boolean))].slice(0, 3);
  const failedUntil = new Map(), controllers = new Set();
  let active = 0, closed = false;
  async function json(path, params = {}) {
    if (closed || !origins.length) throw unavailable();
    if (active >= 2) throw new TubeError('busy', 'Video search is busy. Try again shortly.', 429);
    const available = origins.filter(origin => !(failedUntil.get(origin) > now()));
    if (!available.length) throw unavailable();
    active++;
    const controller = new AbortController(); controllers.add(controller);
    const total = setTimeout(() => controller.abort(), 10000); total.unref?.();
    try {
      for (const origin of available) {
        if (controller.signal.aborted) break;
        const attempt = new AbortController(), timer = setTimeout(() => attempt.abort(), 4000);
        timer.unref?.(); let response;
        try {
          const url = new URL(`/api/v1/${path}`, origin);
          for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
          response = await request(url, {headers: {accept: 'application/json'}, redirect: 'error', signal: AbortSignal.any([controller.signal, attempt.signal])});
          if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) throw unavailable();
          const chunks = []; let size = 0;
          for await (const chunk of response.body) {
            size += chunk.byteLength; if (size > 2 * 1024 ** 2) throw unavailable(); chunks.push(chunk);
          }
          const result = JSON.parse(Buffer.concat(chunks, size).toString());
          if (!result || result.error) throw unavailable();
          failedUntil.delete(origin); return result;
        } catch { failedUntil.set(origin, now() + 60000); }
        finally { clearTimeout(timer); attempt.abort(); await response?.body?.cancel().catch(() => {}); }
      }
      throw unavailable();
    } finally { clearTimeout(total); controllers.delete(controller); active--; }
  }
  const validate = id => { if (!idPattern.test(id)) throw restricted(); };
  return {
    enabled: origins.length > 0,
    info: async id => { validate(id); return invidiousInfo(await json(`videos/${id}`), id); },
    search: async (query, size) => {
      const results = await json('search', {q: query, type: 'video'});
      if (!Array.isArray(results)) throw unavailable();
      return {entries: results.filter(item => ['video', 'shortVideo'].includes(item.type) && idPattern.test(item.videoId || '')).slice(0, size).map(entry)};
    },
    shorts: async size => {
      const result = await json('hashtag/shorts');
      if (!Array.isArray(result.results)) throw unavailable();
      return {entries: result.results.filter(item => ['video','shortVideo'].includes(item.type) && idPattern.test(item.videoId || '')).map(entry).filter(item => item.duration > 0 && item.duration <= 180).slice(0, size)};
    },
    channel: async id => {
      if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) throw restricted();
      const item = await json(`channels/${id}`);
      if (item.authorId !== id) throw unavailable();
      return {channel_id: id, channel: item.author, description: item.description,
        thumbnails: item.authorThumbnails, channel_follower_count: item.subCount,
        entries: (item.latestVideos || []).slice(0, 12).map(entry)};
    },
    comments: async id => {
      validate(id); const item = await json(`comments/${id}`, {sort_by: 'top'});
      return {comments: Array.isArray(item.comments) ? item.comments.slice(0, 20).map(c => ({id: c.commentId,
        author: c.author, author_thumbnail: c.authorThumbnails?.at(-1)?.url, text: c.content,
        like_count: c.likeCount, reply_count: c.replies?.replyCount, timestamp: c.published})) : undefined};
    },
    close: () => { closed = true; for (const controller of controllers) controller.abort(); }
  };
}
