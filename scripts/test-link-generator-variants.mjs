import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

// Intercept every request; tests never publish to GitHub.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let sourceRequests = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cdn.jsdelivr.net') {
      assert.equal(url.pathname, '/gh/dubcatalt2-lab/nyx-jsdelivr-links@main/1-learning-005847b5039fb2c8f4515165e0d79a17.svg');
      assert.equal(route.request().headers().authorization, undefined);
      sourceRequests++;
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><title>Source fixture</title></svg>' });
    }
    if (url.hostname !== 'nyx.test' || url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, body: '{}' });
    const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    try {
      const body = await readFile(resolve('.' + pathname));
      const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(pathname)] || 'application/octet-stream';
      return route.fulfill({ contentType, body });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  await page.goto('http://nyx.test/apps/link-generator/');
  assert.equal(await page.locator('[data-bulk-generate]').count(), 0);
  assert.equal(await page.locator('script[src*="bulk-variants"]').count(), 0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.bulk-variants-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  }
  await page.locator('[data-jsdelivr-publish]').click();
  await page.waitForFunction(() => typeof presetSvg !== 'undefined' && presetSvg.includes('Source fixture'));
  assert.equal(sourceRequests, 1);
  assert.equal(await page.locator('#count').inputValue(), '10');
  assert.equal(await page.locator('#fileDisplay').textContent(), 'Selected jsDelivr SVG');
  const result = await page.evaluate(async () => {
    const calls = [];
    getGitHead = async () => ({ treeSha: 'old-tree', commitSha: 'old-commit' });
    githubJson = async (path, token, options) => {
      calls.push({ path, body: JSON.parse(options.body) });
      return { sha: 'new-sha' };
    };
    await publishTree({ fullName: 'test/repo', branch: 'main' }, ['one.svg', 'two.svg'], presetSvg, 'fixture');
    let failed = false;
    githubJson = async () => { throw new Error('Publishing rejected'); };
    try { await publishTree({ fullName: 'test/repo', branch: 'main' }, ['fail.svg'], presetSvg, 'fixture'); } catch { failed = true; }
    return { calls, failed, url: providers.jsdelivr('test/repo', 'main', 'one.svg') };
  });
  assert.equal(result.calls.length, 3);
  assert.equal(result.calls[0].body.tree.length, 2);
  assert.equal(result.calls[2].body.force, false);
  assert.equal(result.failed, true);
  assert.equal(result.url, 'https://cdn.jsdelivr.net/gh/test/repo@main/one.svg');
  console.log('jsDelivr handoff, source, responsive card, publish sequence and failure checks passed (mocked publishing).');
} finally { await browser.close(); }
