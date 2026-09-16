import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createTubeCatalog } from '../lib/nyxtube-catalog.mjs';

// A parent-process deadline also catches synchronous event-loop hangs.
if (!process.argv.includes('--worker')) {
  const result = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), '--worker'], {
    timeout: 20000, maxBuffer: 1024 * 1024
  });
  process.stdout.write(result.stdout);
} else {
  let clock = 0, calls = 0, padding = 'x'.repeat(1024 * 1024);
  const id = n => String(n).padStart(11, '0');
  const catalog = createTubeCatalog({ env: {}, now: () => clock, execute: async (_binary, args) => {
    calls++;
    return JSON.stringify({ id: new URL(args.at(-1)).searchParams.get('v'),
      availability: 'public', duration: 7200, title: 'Cache regression fixture', padding });
  } });
  try {
    await catalog.info(id(0));
    await catalog.info(id(1));
    const start = calls;
    for (let n = 0; n < 80; n++) await catalog.info(id(1), { refresh: true });
    assert.equal(calls, start + 80);
    await catalog.info(id(0));
    assert.equal(calls, start + 80, 'Refreshes must not accumulate phantom bytes and evict unrelated cached data');
    for (let n = 2; n < 45; n++) await catalog.info(id(n));
    let before = calls;
    await catalog.info(id(44));
    assert.equal(calls, before, 'Newest large entry stays cached');
    await catalog.info(id(0));
    assert.equal(calls, before + 1, 'Byte limit evicts oldest large entry');
    clock += 300001;
    before = calls;
    await catalog.info(id(0));
    assert.equal(calls, before + 1, 'Expired metadata refreshes');
    before = calls;
    await Promise.all(Array.from({ length: 80 }, () => catalog.info(id(0), { refresh: true })));
    assert.equal(calls, before + 1, 'Concurrent refreshes share one extraction');
    padding = '';
    for (let n = 100; n < 270; n++) await catalog.info(id(n));
    before = calls;
    await catalog.info(id(269));
    assert.equal(calls, before, 'Newest small entry stays cached');
    await catalog.info(id(100));
    assert.equal(calls, before + 1, 'Entry count limit evicts oldest small entry');
  } finally { await catalog.close(); }
  await assert.rejects(catalog.info(id(0)), /stopping/);
  console.log('NyxTube cache: repeated refresh, byte/count eviction, expiry, concurrent refresh and shutdown passed within parent deadline.');
}
