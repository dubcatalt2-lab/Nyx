import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';
import { prepareStaticPackage, staticLauncher } from '../apps/jsdelivr-publisher/static-publish.js';

// Materialize the exact Git objects the publisher sends, with no GitHub writes.
const root = process.env.NYX_TEST_PACKAGE_ROOT || 'dist/apps/jsdelivr-publisher/static-package';
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const objects = new Map();
let sequence = 0;
const entry = await prepareStaticPackage({
  repository: 'test/repo', branch: 'main', headTree: 'head', manifest,
  readBytes: path => readFile(join(root, 'files', path)),
  api: async (path, options) => {
    if (!options) return { tree: [] };
    const body = JSON.parse(options.body), sha = String(++sequence);
    if (path.endsWith('/blobs')) objects.set(sha, Buffer.from(body.content, 'base64'));
    else {
      const tree = new Map(objects.get(body.base_tree) || []);
      for (const file of body.tree) tree.set(file.path, file.sha ? objects.get(file.sha) : Buffer.from(file.content));
      objects.set(sha, tree);
    }
    return { sha };
  }
});
const published = objects.get(entry.sha);
const base = '/gh/test/repo@main/nyx-static/';
const failures = [];
const mime = { '.html': 'text/plain', '.svg': 'image/svg+xml', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const content = path === '/gh/test/repo@main/link.svg' ? Buffer.from(staticLauncher()) : path.startsWith(base) ? published.get(path.slice(base.length)) : null;
  if (!content) { failures.push(path); response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
  response.end(content);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 503, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('nyx.setupComplete', 'true');
    localStorage.setItem('nyx.browserShellMode', 'true');
    localStorage.setItem('nyx.tosAcceptedVersion', '2026-07-30');
    localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen', '2026-10-02-nyx-1.6.8');
  });
  await page.goto(origin + '/gh/test/repo@main/link.svg', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(origin + base + 'index.html');
  await page.waitForFunction(() => !document.querySelector('#nyxStudyHubStartup') && !document.body.classList.contains('nyx-loading-active'));
  await page.locator('[data-nyx-dock-item="apps"]').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => globalThis.__NYX_STATIC_CONFIG__.base), base);
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
  assert.equal(await page.evaluate(() => crossOriginIsolated), true);
  assert.equal(await page.locator('iframe[src^="https://nyxlearning.org"]').count(), 0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-nyx-dock-item="apps"]').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('#nyxStudyHubStartup') && !document.body.classList.contains('nyx-loading-active'));
  await page.locator('[data-nyx-dock-item="apps"]').click();
  await page.frameLocator('iframe.view.active').locator('[data-global-app-id="code-studio"]').waitFor({state:'visible'});
  for (const id of ['nyx-vms','nyx-ai','nyx-chat','link-generator','jsdelivr-publisher']) {
    assert.equal(await page.frameLocator('iframe.view.active').locator(`[data-global-app-id="${id}"]`).isVisible(), false, 'Static-only app picker must hide '+id);
  }
  await page.locator('[data-nyx-dock-item="games"]').click();
  const games = page.frameLocator('iframe.view.active');
  await games.locator('#catalogProgress.done').waitFor({ state: 'attached' });
  const allCount = Number((await games.locator('[data-library="all"] .library-tab-count').innerText()).replaceAll(',', ''));
  assert(allCount > 1000, `Static All games must include the packaged catalog even without cover art; got ${allCount}`);
  assert.equal(await games.locator('.game-card').count(), 30);
  assert.equal(await games.locator('#emptyState').isVisible(), false);
  assert.equal(await games.locator('.arcade-random').isEnabled(), true);
  await games.locator('#nextPage').click();
  assert.match(await games.locator('#pageInfo').innerText(), /Page 2 of/);
  await games.locator('#gameSearch').fill('Slope');
  await games.locator('.game-card').first().waitFor();
  assert.match(await games.locator('#gameGrid').innerText(), /slope/i);
  await games.locator('.game-card').first().click();
  await games.locator('#gameFrame[src^="https://vps-a556737a.vps.ovh.us/assets/ugs/play.html"]').waitFor({ state: 'attached' });
  assert.match(await games.locator('#gameFrame').getAttribute('src'), /^https:\/\/vps-a556737a\.vps\.ovh\.us\/assets\/ugs\/play\.html/);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures.filter(path => /\.(?:js|mjs|css|wasm|html)$/.test(path)), []);
  await mkdir('.codex-artifacts', { recursive: true });
  await page.screenshot({ path: '.codex-artifacts/static-publisher-desktop.png' });
  console.log(`PASS actual static package: ${manifest.files.length} assets verified and published through mocked Git, launcher redirect, worker startup, HTML MIME correction, isolated app shell and reload.`);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
