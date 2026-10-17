import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('https://nyx.test/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<h1>Storage fixture</h1>' });
    return route.fulfill({ contentType: 'application/javascript', body: await readFile(resolve('.' + pathname)) });
  });
  await page.goto('https://nyx.test/');
  const before = await page.evaluate(async () => {
    const { BulkJob, openJobStore } = await import('/apps/link-generator/bulk-jobs.js');
    const store = await openJobStore();
    let worker;
    worker = new BulkJob({ store, access: async () => ({ uid: 'user', token: 'not-stored', limit: 2, method: 'managed' }),
      request: async () => { worker.pause(); throw new Error('Lost reply'); } });
    await worker.create({ total: 2, label: '34', host: 'fastly.jsdelivr.net' });
    await worker.run();
    return await store.read();
  });
  assert.equal(before.completed, 0);
  assert.ok(before.pending.id);
  await page.reload();
  const after = await page.evaluate(async () => {
    const { BulkJob, openJobStore } = await import('/apps/link-generator/bulk-jobs.js');
    const store = await openJobStore();
    let requested;
    const worker = new BulkJob({ store, now: () => Date.now() + 300000,
      access: async () => ({ uid: 'user', token: 'not-stored', limit: 2, method: 'managed' }),
      request: async (_url, options) => {
        requested = JSON.parse(options.body).batchRequestId;
        return new Response(JSON.stringify({ links: ['https://cdn.jsdelivr.net/gh/test/repo@main/a.svg', 'https://cdn.jsdelivr.net/gh/test/repo@main/b.svg'] }));
      } });
    const job = await worker.run();
    return { job, requested, chunks: await store.links(job) };
  });
  assert.equal(after.requested, before.pending.id);
  assert.equal(after.job.completed, 2);
  assert.match(after.chunks.join(''), /fastly.jsdelivr.net/);
  assert.ok(!JSON.stringify(after).includes('not-stored'));
  console.log('IndexedDB reload preserved pending batch identity, atomic progress and download data without credentials.');
} finally { await browser.close(); }
