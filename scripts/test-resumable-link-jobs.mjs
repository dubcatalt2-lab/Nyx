import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { batchFiles, inspectBatchTree } from '../lib/link-generator-batch.mjs';
import { BulkJob } from '../apps/link-generator/bulk-jobs.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const id = '12345678-1234-1234-1234-123456789abc';
const files = batchFiles('user', id, '34', 2);
assert.deepEqual(files, batchFiles('user', id, '34', 2));
assert.notDeepEqual(files, batchFiles('another-user', id, '34', 2));
assert.match(files[0], /^34-learning-[a-f0-9]{32}\.svg$/);
const svg = '<svg/>';
const sha = createHash('sha1').update('blob 6\0' + svg).digest('hex');
assert.equal(inspectBatchTree({ tree: [] }, files, svg), false);
assert.equal(inspectBatchTree({ tree: files.map(path => ({ type: 'blob', path, sha, size: 6 })) }, files, svg), true);
assert.throws(() => inspectBatchTree({ truncated: true }, files, svg), /too large/);
assert.throws(() => inspectBatchTree({ tree: [{ type: 'blob', path: files[0], sha }] }, files, svg), /conflicts/);
assert.throws(() => inspectBatchTree({ tree: [{ type: 'blob', path: 'large', size: 140_000_000 }] }, files, svg), /capacity/);

function memoryStore() {
  let state = null; const batches = new Map();
  return {
    read: async () => structuredClone(state),
    save: async (job, batch) => { state = structuredClone(job); if (batch) batches.set(batch.id, batch.links); },
    batches
  };
}
const store = memoryStore();
let time = 0, calls = 0, lostReply = true;
const published = new Map();
const worker = new BulkJob({
  store, now: () => time, sleep: async ms => { time += ms; },
  access: async () => ({ uid: 'user', token: 'fixture', limit: 1000, method: 'p2p' }),
  request: async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    if (!published.has(body.batchRequestId)) published.set(body.batchRequestId, batchFiles('user', body.batchRequestId, body.label, body.amount));
    if (lostReply) { lostReply = false; throw new Error('Lost reply after commit'); }
    return new Response(JSON.stringify({ links: published.get(body.batchRequestId).map(file => 'https://cdn.jsdelivr.net/gh/test/repo@main/' + file) }));
  }
});
await worker.create({ total: 100000, label: '34', host: 'gcore.jsdelivr.net' });
const complete = await worker.run();
assert.equal(complete.completed, 100000);
assert.equal(published.size, 100);
assert.equal(calls, 101);
assert.equal(store.batches.size, 100);
const links = [...store.batches.values()].flat();
assert.equal(new Set(links).size, 100000);
assert.ok(links.every(link => link.startsWith('https://gcore.jsdelivr.net/')));
assert.ok(!(JSON.stringify(await store.read()).includes('fixture')), 'Never store credentials');

const pausedStore = memoryStore();
let pauseWorker;
pauseWorker = new BulkJob({
  store: pausedStore, access: async () => ({ uid: 'user', token: 'fixture', limit: 2, method: 'managed' }),
  request: async () => { pauseWorker.pause(); return new Response(JSON.stringify({ links: ['https://cdn.jsdelivr.net/gh/t/r@main/a.svg', 'https://cdn.jsdelivr.net/gh/t/r@main/b.svg'] })); }
});
await pauseWorker.create({ total: 4, label: '34', host: 'cdn.jsdelivr.net' });
assert.equal((await pauseWorker.run()).completed, 2);
const resumeWorker = new BulkJob({ store: pausedStore, now: () => Date.now() + 60000,
  access: async () => ({ uid: 'wrong-user' }) });
await assert.rejects(resumeWorker.run(), /account that started/);

const rateStore = memoryStore(); let attempts = 0, waited = 0;
const rateWorker = new BulkJob({ store: rateStore, now: () => waited, sleep: async ms => { waited += ms; },
  access: async () => ({ uid: 'user', token: 'fixture', limit: 1, method: 'managed' }),
  request: async () => {
    attempts++;
    return attempts === 1 ? new Response('{}', { status: 429, headers: { 'Retry-After': '120' } })
      : new Response(JSON.stringify({ links: ['https://cdn.jsdelivr.net/gh/t/r@main/a.svg'] }));
  }
});
await rateWorker.create({ total: 1, label: '34', host: 'cdn.jsdelivr.net' });
await rateWorker.run(); assert.ok(waited >= 120000);
console.log('100,000-link mocked job: batching, stable retry IDs, pause, account binding, cooldown, capacity and replay checks passed.');

// Exercise the actual server publisher with a lost response AFTER the branch
// update. The next call must discover the atomic batch, not write another one.
const server = readFileSync('server.js', 'utf8');
const publisherSource = server.slice(server.indexOf('async function publishNyxJsdelivrLinks('), server.indexOf('async function nyxifyOctaveProviderSearch('));
let serverTime = 100000, writes = 0, committed = false, entries = [];
const publish = runInNewContext(publisherSource + '\npublishNyxJsdelivrLinks;', {
  batchFiles, inspectBatchTree, nyxBulkPublishNextAt: 0,
  Date: { now: () => serverTime }, staticRoot: '.', join: (...parts) => parts.join('/'),
  readFileSync: () => svg, githubRepositoryApiPath: value => value,
  nyxJsdelivrGithubJson: async (_config, path, options) => {
    if (!options) {
      if (path.endsWith('?recursive=1')) return { tree: committed ? entries : [] };
      if (path.includes('/git/ref/')) return { object: { sha: 'head' } };
      if (path.includes('/git/commits/')) return { tree: { sha: 'tree' } };
      return { private: false, default_branch: 'main' };
    }
    writes++;
    if (path.endsWith('/git/trees')) {
      entries = JSON.parse(options.body).tree.map(item => ({ type: 'blob', path: item.path, sha, size: 6 }));
      return { sha: 'new-tree' };
    }
    if (path.endsWith('/git/commits')) return { sha: 'new-commit' };
    committed = true;
    throw new Error('Connection lost after updating branch');
  }
});
await assert.rejects(publish({ githubRepository: 'test/repo' }, 2, '34', { uid: 'user', requestId: id }), /Connection lost/);
serverTime += 31000;
const recovered = await publish({ githubRepository: 'test/repo' }, 2, '34', { uid: 'user', requestId: id });
assert.equal(recovered.length, 2);
assert.equal(recovered.replayed, true);
assert.equal(writes, 3);
console.log('Actual server publisher recovered a committed batch after a lost response without additional Git writes.');
