import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import express from 'express';

const app=express();app.use(express.static('dist'));const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base = process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:'+server.address().port;
const workspace = await chromium.launch({ channel: 'msedge', headless: true });
const json = body => ({ contentType: 'application/json', body: JSON.stringify(body) });
try {
  const page = await workspace.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/games/games.json', route => route.fulfill(json({ catalogs: [
    { id: 'gn', format: 'gn', url: '/arcade-test/catalog.json', player: '/assets/gn-math/play.html?game={path}', priority: 40 }
  ] })));
  await page.route('**/arcade-test/catalog.json', route => route.fulfill(json(
    ['Slope', 'Retro Bowl', 'Geometry Dash'].map((title, index) => ({ title, path: `${index}.html`, cover: '/arcade-test/cover.svg' }))
  )));
  await page.route('**/arcade-test/cover.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#246"/></svg>' }));
  await page.route(url => url.pathname === '/assets/gn-math/play.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Game ready</p><script>parent.postMessage({type:"nyx:game-launched"},"*")</script>' }));
  await page.route('**/apps/cloud-gaming/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Cloud games</p>' }));

  await page.goto(base + '/assets/games/');
  await page.getByRole('button', { name: 'Launch Slope', exact: true }).waitFor();
  assert.equal((await page.locator('h1').textContent()).normalize('NFKC'), '@RC@D3');
  assert.equal(await page.locator('.cove-mark, .subtitle').count(), 0);
  assert.equal(await page.locator('.arcade-feature').count(), 3);
  // clean-css drops a font shorthand containing clamp(); guard the rendered
  // production typography so the featured titles cannot fall back to body text.
  const featuredType = await page.locator('.arcade-feature-title').nth(1).evaluate(element => {
    const style = getComputedStyle(element);
    return { size: parseFloat(style.fontSize), weight: Number(style.fontWeight), family: style.fontFamily };
  });
  assert(featuredType.size >= 25 && featuredType.weight >= 700 && featuredType.family.includes('ArcadeDisplay'), JSON.stringify(featuredType));
  assert.equal(await page.locator('#emptyState').isVisible(), false);
  assert.equal(await page.locator('#gamePagination').isVisible(), false);

  // Keyboard launch uses the same player and restores focus on close.
  const spotlight = page.getByRole('button', { name: 'Launch Slope', exact: true });
  await spotlight.focus();
  await page.keyboard.press('Enter');
  await page.locator('#gamePlayer').waitFor();
  assert.equal((await page.locator('#playerTitle').textContent()).normalize('NFKC'), '$L0P3');
  await page.waitForFunction(()=>document.querySelector('#gameFrame')?.getAttribute('src')?.includes('game=0.html'));
  assert.match(await page.locator('#gameFrame').getAttribute('src'), /game=0.html/);
  await page.locator('#closePlayer').click();
  assert.equal(await spotlight.evaluate(element => element === document.activeElement), true);

  await page.locator('#gameSearch').fill('Retro');
  assert.equal(await page.locator('.arcade-featured').isVisible(), false);
  assert.equal(await page.locator('.game-card').count(), 1);
  await page.getByRole('button', { name: 'Random game', exact: true }).click();
  assert.equal((await page.locator('#playerTitle').textContent()).normalize('NFKC'), 'R37R0 B0WL');
  await page.locator('#closePlayer').click();
  await page.locator('#gameSearch').fill('no matching games');
  assert.equal(await page.locator('#emptyState').isVisible(), true);
  assert.equal(await page.locator('.arcade-random').isDisabled(), true);
  await page.locator('#gameSearch').fill('');
  await page.locator('[data-library="gn"]').click();
  assert.equal(await page.locator('.arcade-featured').isVisible(), false);
  await page.locator('[data-library="all"]').click();
  assert.equal(await page.locator('.arcade-featured').isVisible(), true);
  await page.locator('[data-game-view="cloud"]').click();
  assert.equal(await page.locator('#localGamesView').isVisible(), false);
  assert.equal(await page.locator('#cloudGamingFrame').isVisible(), true);
  await page.locator('[data-game-view="all"]').click();

  for (const width of [1440, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    assert.equal(await page.locator('#gameSearch').isVisible(), true);
    assert(!/\b(?:games?|gaming|arcade|play|search)\b/i.test(await page.locator('body').innerText()),'Visible game labels must be styled');
    assert(!/\b(?:search|games)\b/i.test(await page.locator('#gameSearch').getAttribute('placeholder')));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await spotlight.hover();
  assert.equal(await spotlight.evaluate(element => getComputedStyle(element).transform), 'none');

  // These shells share catalog code, but must retain their own presentation.
  await page.goto(base + '/apps/drop/games.html');
  await page.locator('.game-card').first().waitFor();
  assert.equal(await page.locator('body').evaluate(element => element.classList.contains('nyx-arcade')), false);
  assert.equal(await page.locator('.arcade-featured').count(), 0);
  await page.route('**/arcade-test/tutsi', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html data-app-shell="tutsi"><iframe data-app-shell="tutsi" src="/assets/games/"></iframe></html>' }));
  await page.goto(base + '/arcade-test/tutsi');
  const tutsi = page.frameLocator('iframe');
  await tutsi.locator('.game-card').first().waitFor();
  assert.equal(await tutsi.locator('body').evaluate(element => element.classList.contains('nyx-arcade')), false);
  assert.equal(await tutsi.locator('.arcade-featured').count(), 0);
  assert.notEqual((await tutsi.locator('h1').textContent()).normalize('NFKC'), '@RC@D3');
  assert.deepEqual(errors, []);
  console.log('Nyx arcade: featured and random launches, filters, empty state, keyboard focus, cloud view, responsive layout, reduced motion, and shell isolation passed.');
} finally {
  await workspace.close();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
