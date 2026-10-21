import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const json = body => ({ contentType: 'application/json', body: JSON.stringify(body) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/studies/studies.json', route => route.fulfill(json({ catalogs: [
    { id: 'gn', format: 'gn', url: '/arcade-test/catalog.json', player: '/assets/gn-math/play.html?game={path}', priority: 40 }
  ] })));
  await page.route('**/arcade-test/catalog.json', route => route.fulfill(json(
    ['Slope', 'Retro Bowl', 'Geometry Dash'].map((title, index) => ({ title, path: `${index}.html`, cover: '/arcade-test/cover.svg' }))
  )));
  await page.route('**/arcade-test/cover.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#246"/></svg>' }));
  await page.route(url => url.pathname === '/assets/gn-math/play.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Game ready</p><script>parent.postMessage({type:"nyx:game-launched"},"*")</script>' }));
  await page.route('**/apps/cloud-studies/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Cloud games</p>' }));

  await page.goto(base + '/assets/studies/');
  await page.getByRole('button', { name: 'Launch Slope', exact: true }).waitFor();
  assert.equal((await page.locator('h1').textContent()).normalize('NFKC'), 'COLL3CTION');
  assert.equal(await page.locator('.cove-mark, .subtitle').count(), 0);
  assert.equal(await page.locator('.q921bc84267c79a9e21').count(), 3);
                                                                            
                                                                                
  const featuredType = await page.locator('.q59902aeaa3dea4c952').nth(1).evaluate(element => {
    const style = getComputedStyle(element);
    return { size: parseFloat(style.fontSize), weight: Number(style.fontWeight), family: style.fontFamily };
  });
  assert(featuredType.size >= 25 && featuredType.weight >= 700 && featuredType.family.includes('ArcadeDisplay'), JSON.stringify(featuredType));
  assert.equal(await page.locator('#emptyState').isVisible(), false);
  assert.equal(await page.locator('#q01d9d441eece').isVisible(), false);

                                                                      
  const spotlight = page.getByRole('button', { name: 'Launch Slope', exact: true });
  await spotlight.focus();
  await page.keyboard.press('Enter');
  await page.locator('#qb12206a9731b').waitFor();
  // The existing interface presentation styles titles; routing retains catalog values.
  assert.equal((await page.locator('#q46bf26c70a26').textContent()).normalize('NFKC'), 'Slop3');
  assert.match(await page.locator('#qcb196f617df1').getAttribute('src'), /game=0.html/);
  await page.locator('#qd322f3d74d9d').click();
  assert.equal(await spotlight.evaluate(element => element === document.activeElement), true);

  await page.locator('#q768acae37c5a').fill('Retro');
  assert.equal(await page.locator('.qb9e3292dc267f78416').isVisible(), false);
  assert.equal(await page.locator('.q482f08e91ee0').count(), 1);
  await page.getByRole('button', { name: 'Random item', exact: true }).click();
  assert.equal((await page.locator('#q46bf26c70a26').textContent()).normalize('NFKC'), 'R3tro B0wl');
  await page.locator('#qd322f3d74d9d').click();
  await page.locator('#q768acae37c5a').fill('no matching games');
  assert.equal(await page.locator('#emptyState').isVisible(), true);
  assert.equal(await page.locator('.qdada7726cace5ea104').isDisabled(), true);
  await page.locator('#q768acae37c5a').fill('');
  await page.locator('[data-qd05585e7109f3d1dde="gn"]').click();
  assert.equal(await page.locator('.qb9e3292dc267f78416').isVisible(), false);
  await page.locator('[data-qd05585e7109f3d1dde="all"]').click();
  assert.equal(await page.locator('.qb9e3292dc267f78416').isVisible(), true);
  await page.locator('[data-q81d4="cloud"]').click();
  assert.equal(await page.locator('#q92df914ad808').isVisible(), false);
  assert.equal(await page.locator('#cloudGamingFrame').isVisible(), true);
  await page.locator('[data-q81d4="all"]').click();

  for (const width of [1440, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    assert.equal(await page.locator('#q768acae37c5a').isVisible(), true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await spotlight.hover();
  assert.equal(await spotlight.evaluate(element => getComputedStyle(element).transform), 'none');

                                                                             
  await page.goto(base + '/apps/drop/games.html');
  await page.locator('.q482f08e91ee0').first().waitFor();
  assert.equal(await page.locator('body').evaluate(element => element.classList.contains('q2ff352f9bbd5153b5a')), false);
  assert.equal(await page.locator('.qb9e3292dc267f78416').count(), 0);
  await page.route('**/arcade-test/tutsi', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html data-app-shell="tutsi"><iframe data-app-shell="tutsi" src="/assets/studies/"></iframe></html>' }));
  await page.goto(base + '/arcade-test/tutsi');
  const tutsi = page.frameLocator('iframe');
  await tutsi.locator('.q482f08e91ee0').first().waitFor();
  assert.equal(await tutsi.locator('body').evaluate(element => element.classList.contains('q2ff352f9bbd5153b5a')), false);
  assert.equal(await tutsi.locator('.qb9e3292dc267f78416').count(), 0);
  assert.equal((await tutsi.locator('h1').textContent()).normalize('NFKC'), 'IT3MS');
  assert.deepEqual(errors, []);
  console.log('Nyx arcade: featured and random launches, filters, empty state, keyboard focus, cloud view, responsive layout, reduced motion, and shell isolation passed.');
} finally {
  await browser.close();
}
