import assert from 'node:assert/strict';
import express from 'express';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const serverApp = express();
serverApp.use('/apps', express.static(resolve('chapels')));
serverApp.use('/js', express.static(resolve('parables')));
const server = serverApp.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const origin = process.env.NYX_TEST_ORIGIN || 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  for (const width of [1365, 390]) {
    const page = await browser.newPage({viewport: {width, height: 900}}), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (!process.env.NYX_TEST_ORIGIN) await page.route('**/api/nook-desktop/release', route => route.fulfill({json: {version: '0.1.0', signed: false, artifacts: [{arch: 'x64', size: 110000000, sha256: 'a'.repeat(64), url: '/download/nook/0.1.0/Nook-Agent-0.1.0-windows-x64-setup.exe'}]}}));
    await page.goto(origin + '/apps/agents/download.html');
    await page.locator('a.download').first().waitFor();
    assert.match(await page.locator('#signing').textContent(), /unsigned/);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    await page.close();
  }
  if (!process.env.NYX_TEST_ORIGIN) {
    const page = await browser.newPage(); await page.route('**/api/nook-desktop/release', route => route.fulfill({status: 503, json: {error: 'Unavailable'}}));
    await page.goto(origin + '/apps/agents/download.html'); await page.locator('#releaseStatus').filter({hasText: 'unavailable'}).waitFor(); assert.equal(await page.locator('a.download').count(), 0); await page.close();
  }
  console.log('PASS desktop/mobile download page, unsigned-release disclosure, real manifest links and unavailable-release handling');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
