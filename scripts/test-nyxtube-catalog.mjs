import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTubeCatalog, catalogVideo } from '../lib/nyxtube-catalog.mjs';

const root = await mkdtemp(join(tmpdir(), 'nyx-catalog-test-'));
const id = 'YE7VzlLtp-4', channelId = 'UCSMOQeBJ2RAnuFungnQOxLg';
const info = { id, availability: 'public', title: 'Public video', channel: 'Creator', channel_id: channelId, duration: 7200, view_count: 100, description: 'Description', subtitles: { en: [{ ext: 'json3', url: 'https://www.youtube.com/api/timedtext?v=test' }] }, formats: [{ url: 'https://r1.googlevideo.com/private-signed-url' }] };
let catalog, running = 0, peak = 0, calls = 0, fail = false, clock = Date.now();
const sessionPaths = [];
try {
  const cookieFile = join(root, 'session.txt'); await writeFile(cookieFile, 'TEST-PRIVATE-SESSION');
  catalog = createTubeCatalog({ env: { NYX_YTDLP_BIN: 'test', NYX_YOUTUBE_COOKIES_FILE: cookieFile }, now: () => clock,
    execute: async (_binary, args, opts) => {
      calls++; running++; peak = Math.max(peak, running);
      try {
        assert.ok(args.includes('--skip-download')); assert.equal(args.at(-2), '--');
        assert.equal(opts.timeout, 35000); assert.ok(opts.maxBytes <= 8 * 1024 ** 2);
        const cookie = args[args.indexOf('--cookies') + 1]; sessionPaths.push(cookie);
        assert.equal(await readFile(cookie, 'utf8'), 'TEST-PRIVATE-SESSION');
        await new Promise(resolve => setTimeout(resolve, 35));
        if (fail) throw new Error('PRIVATE RAW ERROR');
        if (args.at(-1).includes('/channel/')) return JSON.stringify({ channel_id: channelId, channel: 'Creator', entries: [info] });
        if (args.includes('--write-comments')) {
          assert.ok(args.includes('youtube:max_comments=20,20,0,0;comment_sort=top'));
          return JSON.stringify({ ...info, comments: [{ id: 'c1', author: 'Person', text: 'Hello', timestamp: 1700000000 }] });
        }
        if (args.at(-1).startsWith('ytsearch')) {
          assert.ok(args.includes('--flat-playlist'));
          return JSON.stringify({ entries: [info, info, { ...info, id: 'aqz-KE-bpKQ', availability: 'private' }, { ...info, id: 'bad' }] });
        }
        return JSON.stringify(info);
      } finally { running--; }
    }
  });
  const results = await Promise.all(Array.from({ length: 30 }, () => catalog.search('A query', 20)));
  assert.equal(calls, 1, 'Identical searches share one extractor');
  assert.equal(results[0].length, 1); assert.equal(results[0][0].detailsPending, true);
  assert.ok(!JSON.stringify(results).includes('private-signed-url'));
  assert.ok(!JSON.stringify(results).includes('TEST-PRIVATE-SESSION'));
  await catalog.search('a QUERY',20); assert.equal(calls,1);
  const detail = await catalog.video(id); assert.equal(detail.durationSeconds,7200); assert.equal(detail.detailsPending,false); assert.equal(detail.likeCount,null);
  assert.ok(!JSON.stringify(detail).includes('private-signed-url'));
  const before = calls; await catalog.info(id); assert.equal(calls,before,'Playback shares cached full metadata');
  const channel = await catalog.channel(channelId); assert.equal(channel.channel.title,'Creator'); assert.equal(channel.videos[0].id,id);
  const comments = await catalog.comments(id); assert.equal(comments.comments[0].text,'Hello');
  for (const bad of [{ availability: 'unlisted' }, { age_limit: 18 }, { is_live: true }, { playable_in_embed: false }, { geo_countries: ['CA'] }]) assert.equal(catalogVideo({ ...info, ...bad },true),null);
  assert.equal(catalogVideo({ ...info, availability: undefined },true),null);
  await assert.rejects(catalog.info('--exec=bad'),e=>e.status===400);
  assert.throws(()=>catalog.channel('https://localhost/'),e=>e.status===400);
  const burst = await Promise.allSettled(Array.from({length:20},(_,i)=>catalog.search(`different query ${i}`,2)));
  assert.ok(burst.some(r=>r.status==='rejected'&&r.reason.code==='busy')); assert.equal(peak,2);
  for (const path of sessionPaths) await assert.rejects(access(path));
  assert.equal(await readFile(cookieFile,'utf8'),'TEST-PRIVATE-SESSION');
  fail=true;clock+=6*60000;
  await assert.rejects(catalog.search('failure'),e=>!e.message.includes('PRIVATE'));
  const failedCalls=calls; await assert.rejects(catalog.search('failure'));assert.equal(calls,failedCalls,'Failures briefly cached');
  fail=false;clock+=16000;assert.equal((await catalog.search('failure')).length,1);
  console.log('Catalog: keyless discovery/details/channel/comments, shared cache, 30-user coalescing, bounded concurrency, restriction checks and private-session cleanup passed.');
} finally { await catalog?.close(); await rm(root,{recursive:true,force:true}); }
