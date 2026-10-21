import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {domHookAlias} from './build-dom-hooks.mjs';

const root = process.env.NYX_TEST_DIST || 'dist';
const {pages} = JSON.parse(await readFile(root + '/published-pages.json', 'utf8'));
const paths = Object.keys(pages).filter(path => path === 'ai.html' || /^apps\/[^/]+\/index\.html$/.test(path));
const app = express(); app.use(express.static(root));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = process.env.NYX_TEST_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel:'msedge'});
try {
  for (const path of paths) {
    const page = await browser.newPage({viewport:{width:1440,height:940}});
    const missing = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'stylesheet' && response.status() >= 400) missing.push(response.url());
    });
    await page.route('**/api/**', route => route.fulfill({json:{}}));
    await page.goto(base + '/' + path);
    await page.waitForFunction(() => document.querySelector('link[rel="stylesheet"],style'));
    await page.waitForTimeout(1500);
    assert.deepEqual(missing, [], path + ' stylesheet responses');
    const result = await page.evaluate(alias => ({
      loaded:[...document.querySelectorAll('link[rel="stylesheet"]')].every(link => !!link.sheet),
      hidden:[...document.querySelectorAll('.sr-only,.' + alias)].map(element => {
        const box = element.getBoundingClientRect();
        return {width:box.width,height:box.height};
      }),
    }), domHookAlias('class','sr-only'));
    assert(result.loaded, path + ' linked styles loaded');
    for (const box of result.hidden) assert(box.width <= 1 && box.height <= 1, path + ' accessible-only control escaped its CSS');
    if (path === 'ai.html') {
      assert(result.hidden.length >= 3, 'A1 hidden controls were exercised');
      const input = page.locator('input[type="file"]');
      assert((await input.boundingBox()).width <= 1, 'A1 file input remains visually hidden');
    }
    console.log('PASS built-in styles: ' + path);
    await page.close();
  }
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
