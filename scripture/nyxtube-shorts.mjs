import {TubeError} from './nyxtube-streaming.mjs';

// Actual channel Shorts tabs, not the unmoderated global #shorts hashtag.
// These are discovery sources, not an endorsement or an AI-content detector.
export const SHORTS_TOPICS = Object.freeze({
  science: ['UCY1kMZp36IQSyNx_9h4mpCg'], // Mark Rober
  nature: ['UCwmZiChSryoWQCZMIQezgTg'], // BBC Earth
  gaming: ['UC1sELGmy5jp5fQUugmuYlXQ'], // Minecraft
  sports: ['UCWJ2lWNubArHWmf3FIHbfcQ'], // NBA
});
const sourcesFor = (topic, creators) => topic === 'discover' ? [...new Set([...creators, ...Object.values(SHORTS_TOPICS).flat()])] : SHORTS_TOPICS[topic];
const invalid = () => new TubeError('video', 'Choose a valid Shorts feed.', 400);

export function createShortsDiscovery({fallback, cached, catalogVideo}) {
  return function discover({query = '', topic = 'discover', cursor = '', creators = ''} = {}, page = 1, size = 24) {
    if (typeof query !== 'string' || typeof topic !== 'string' || typeof cursor !== 'string' || cursor.length > 18000 || typeof creators !== 'string' || creators.length > 49) throw invalid();
    const favorites = creators ? creators.split(',') : [];
    if (favorites.length > 2 || new Set(favorites).size !== favorites.length || favorites.some(id => !/^UC[A-Za-z0-9_-]{22}$/.test(id))) throw invalid();
    const clean = query.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!fallback?.enabled) throw new TubeError('service', 'Shorts discovery is temporarily unavailable.');
    const videosFrom = entries => [...new Map((entries || []).map(item => catalogVideo(item)).filter(video => video?.isShort).map(video => [video.id, video])).values()];
    if (clean) {
      if (clean.length < 2 || cursor) throw invalid();
      return cached(`shorts-search:${clean.toLowerCase()}:${page}:${size}`, async () => {
        const result = await fallback.searchShorts(clean, page);
        return {videos: videosFrom(result.entries).slice(0, size), nextPage: page < 100 && result.hasMore ? page + 1 : null};
      });
    }
    const sources = sourcesFor(topic, favorites);
    if (!Array.isArray(sources)) throw invalid();
    let position = {topic, creators, page: 1, sources: sources.map(() => ({offset: 0, continuation: '', done: false}))};
    if (cursor) {
      try {
        if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw invalid();
        position = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (position.topic !== topic || position.creators !== creators || !Number.isInteger(position.page) || position.page < 1 || position.page > 100
          || !Array.isArray(position.sources) || position.sources.length !== sources.length
          || position.sources.some(s => !s || !Number.isInteger(s.offset) || s.offset < 0 || s.offset > 100
            || typeof s.continuation !== 'string' || s.continuation.length > 2000 || typeof s.done !== 'boolean')) throw invalid();
      } catch { throw invalid(); }
    }
    return cached(`shorts-discover:${topic}:${creators}:${cursor}:${size}`, async () => {
      const queues = [], failures = [];
      // Sequential bounded calls leave capacity for playback metadata requests.
      // Provider pages are cached independently, so scrolling reuses unused items.
      for (const [index, id] of sources.entries()) {
        const saved = position.sources[index];
        if (saved.done) { queues.push(null); continue; }
        try {
          const batch = await cached(`channel-shorts:${id}:${saved.continuation}`, async () => {
            const result = await fallback.channelShorts(id, saved.continuation);
            return {videos: videosFrom(result.entries).slice(0, 100), continuation: result.continuation || ''};
          });
          queues.push(batch);
        } catch (error) { queues.push(null); failures.push(error); }
      }
      if (failures.length && !queues.some(Boolean)) throw failures[0];
      const next = position.sources.map(s => ({...s})), videos = [], seen = new Set();
      // Interleave creators instead of playing an entire channel consecutively.
      let added = true;
      while (videos.length < size && added) {
        added = false;
        for (let i = 0; i < queues.length && videos.length < size; i++) {
          const batch = queues[i], saved = next[i];
          if (!batch || saved.offset >= batch.videos.length) continue;
          const rank = topic === 'discover' ? favorites.indexOf(sources[i]) : -1;
          const weight = rank === 0 ? 3 : rank === 1 ? 2 : 1;
          for (let n = 0; n < weight && saved.offset < batch.videos.length && videos.length < size; n++) {
            const video = batch.videos[saved.offset++]; added = true;
            if (!seen.has(video.id)) { seen.add(video.id); videos.push(video); }
          }
        }
      }
      for (let i = 0; i < queues.length; i++) {
        const batch = queues[i], saved = next[i];
        if (!batch || saved.offset < batch.videos.length) continue;
        if (batch.continuation && batch.continuation !== saved.continuation && batch.continuation.length <= 2000) {
          saved.offset = 0; saved.continuation = batch.continuation;
        } else saved.done = true;
      }
      const nextCursor = position.page < 100 && next.some(s => !s.done)
        ? Buffer.from(JSON.stringify({topic, creators, page: position.page + 1, sources: next})).toString('base64url') : null;
      return {videos, nextCursor, nextPage: null};
    });
  };
}
