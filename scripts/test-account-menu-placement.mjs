import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const source = await readFile('script.js', 'utf8');
const position = source.slice(source.indexOf('  function positionNyxAccountMenu('), source.indexOf('  function openNyxAccountMenu('));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('http://nyx.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    try {
      const body = await readFile(resolve('.' + path));
      await route.fulfill({ body, contentType: extname(path) === '.css' ? 'text/css' : 'application/octet-stream' });
    } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await page.setContent(`<html data-nyx-theme="default"><head><link rel="stylesheet" href="http://nyx.test/styles.css"></head><body>
    <button id="anchor" style="position:fixed;bottom:8px;right:8px;width:48px;height:48px">Avatar</button>
    <aside class="nyx-account-menu show" role="menu">
      <div class="nyx-account-menu-banner"></div>
      <div class="nyx-account-menu-profile"><h2>Test profile</h2><p class="nyx-account-menu-handle">@test</p><p class="nyx-account-menu-bio">Profile menu layout check.</p></div>
      <div class="nyx-account-menu-group"><button>Edit Profile</button><button>Browse Profiles</button><button>Online</button><button>Switch Accounts</button><button>Copy User ID</button></div>
    </aside></body></html>`);
  await page.addScriptTag({ content: position });
  for (const [width, height] of [[1280, 900], [1024, 600], [390, 844], [320, 480]]) {
    await page.setViewportSize({ width, height });
    for (const side of ['bottom', 'top']) {
      const geometry = await page.evaluate(side => {
        const anchor = document.getElementById('anchor');
        anchor.style.top = side === 'top' ? '8px' : 'auto';
        anchor.style.bottom = side === 'bottom' ? '8px' : 'auto';
        const menu = document.querySelector('.nyx-account-menu');
        positionNyxAccountMenu(menu, anchor);
        const rect = menu.getBoundingClientRect(), button = anchor.getBoundingClientRect();
        menu.scrollTop = menu.scrollHeight;
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
          anchorTop: button.top, anchorBottom: button.bottom,
          lastVisible: menu.lastElementChild.lastElementChild.getBoundingClientRect().bottom <= rect.bottom };
      }, side);
      assert.ok(geometry.top >= 11 && geometry.bottom <= height - 11, JSON.stringify(geometry));
      assert.ok(geometry.left >= 11 && geometry.right <= width - 11, JSON.stringify(geometry));
      assert.ok(side === 'bottom' ? geometry.bottom < geometry.anchorTop : geometry.top > geometry.anchorBottom);
      assert.ok(geometry.lastVisible, 'Last action must remain reachable by scrolling');
    }
  }
  await page.evaluate(() => {
    const anchor = document.getElementById('anchor');
    anchor.style.top = 'auto'; anchor.style.bottom = '8px';
    positionNyxAccountMenu(document.querySelector('.nyx-account-menu'), anchor);
  });
  await page.screenshot({ path: '.codex-artifacts/account-menu-placement.png' });
  console.log('Account menu fits above/below anchors at four desktop/mobile sizes; all actions remain reachable.');
} finally { await browser.close(); }
