import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

const app = express();
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT || '.'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport: {width, height: 850}});
    const errors = [];
    let lunaRequests = 0;
    let launches = 0;
    let apiRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      apiRequests++;
      if (route.request().url().includes('/sessions')) launches++;
      return route.fulfill({json: {configured: false, maintenance: true}});
    });
    await page.route('https://luna.loan/**', route => {
      lunaRequests++;
      assert.equal(route.request().headers().authorization, undefined);
      assert.equal(route.request().headers().referer, undefined);
      return route.fulfill({contentType: 'text/html', body: '<h1>Luna fixture</h1>'});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/apps/cloud-gaming/?embedded=games`);
    await page.frameLocator('[data-luna-host] iframe').getByText('Luna fixture').waitFor();
    assert.equal(lunaRequests, 1);
    assert.equal(apiRequests, 0, 'Luna default must not start Stratus authentication or restore a hidden session');
    assert.equal(await page.locator('[data-luna-dialog]').evaluate(el => el.open), true);
    const bounds = await page.locator('[data-luna-dialog]').boundingBox();
    assert.equal(bounds.width, width);
    assert.equal(bounds.height, 850);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('[data-luna-close]').click();
    await page.getByText('Stratus is currently unavailable. Luna is available above.', {exact: true}).waitFor();
    await page.waitForFunction(() => !document.documentElement.classList.contains('cloud-session-active'));
    assert.equal(await page.locator('[data-luna-host] iframe').count(), 0);
    assert.equal(await page.locator('[data-luna-open]').evaluate(el => el === document.activeElement), true);
    await page.locator('[data-luna-open]').click();
    await page.frameLocator('[data-luna-host] iframe').getByText('Luna fixture').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-luna-dialog]').open);
    await page.waitForFunction(() => !document.querySelector('[data-luna-host] iframe'));
    assert.equal(launches, 0);
    const previousRequests = lunaRequests;
    await page.goto(`http://127.0.0.1:${server.address().port}/apps/cloud-gaming/?provider=stratus`);
    await page.getByText('Stratus is currently unavailable. Luna is available above.', {exact: true}).waitFor();
    assert.equal(lunaRequests, previousRequests);
    assert.equal(await page.locator('[data-luna-dialog]').evaluate(el => el.open), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS Luna default, deferred Stratus authentication/session restore, explicit Stratus link, desktop/mobile sizing, close/reopen and Escape cleanup');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
