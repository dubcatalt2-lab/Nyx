import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

// All API calls are fixtures: this test never creates real links or accounts.
const root = resolve(process.env.NYX_TEST_STATIC_ROOT || '.');
const workspace = await chromium.launch({ headless: true });
const context = await workspace.newContext();
const requests = [], errors = [];
let failPublish = false, parentToken = 'fixture-host-token';
const json = (route, value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'identitytoolkit.googleapis.com') {
    if (url.pathname.endsWith('accounts:lookup')) return json(route, { users: [{ localId: 'fixture-user', email: 'fixture@example.test', emailVerified: true }] });
    return json(route, { idToken: 'fixture-standalone-token', refreshToken: 'fixture-refresh', expiresIn: '3600', email: 'fixture@example.test' });
  }
  if (url.hostname !== 'localhost') return route.fulfill({ status: 404, body: '' });
  if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: `<style>body{margin:0}iframe{width:100%;height:100vh;border:0}</style><iframe src="/apps/link-generator/"></iframe><script>addEventListener('message',async e=>{if(e.origin!==location.origin||e.data?.type!=='nyx:account-token-request')return;const token=await fetch('/fixture-token').then(r=>r.text());e.source.postMessage({type:'nyx:account-token-response',requestId:e.data.requestId,token},e.origin)})</script>` });
  if (url.pathname === '/fixture-token') return route.fulfill({ body: parentToken });
  if (url.pathname === '/api/link-generator/auth-config') return json(route, { enabled: true, apiKey: 'fixture-key' });
  if (url.pathname === '/api/account/me') return json(route, { subscriptionStatus: 'free' });
  if (url.pathname === '/api/link-generator/status') return json(route, { available: true, globalPublisherConfigured: true, origin: 'https://nyxlearning.org' });
  if (url.pathname === '/api/link-checker/vendors') return json(route, { vendors: [{ key: 'goguardian', label: 'GoGuardian' }] });
  if (url.pathname === '/api/link-checker/check') return json(route, { vendors: { goguardian: { blocked: false } } });
  if (url.pathname === '/api/link-generator') {
    requests.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
    if (failPublish) return json(route, { error: 'Publisher temporarily unavailable. Try again.' }, 503);
    return json(route, { links: ['https://cdn.jsdelivr.net/gh/example/links@main/study-room.svg'], remaining: 99 }, 201);
  }
  if (url.pathname.startsWith('/api/')) return json(route, {}, 404);
  const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  try {
    return route.fulfill({ contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(pathname)] || 'application/octet-stream', body: await readFile(sourceFile(resolve(root, '.' + pathname))) });
  } catch { return route.fulfill({ status: 404, body: '' }); }
});
try {
  const page = await context.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost/fixture');
  const ui = page.frameLocator('iframe');
  await ui.locator('[data-wizard-next]').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('iframe').contentDocument.querySelector('[data-wizard-next]').disabled);
  assert.equal(await ui.locator('[data-access-gate]').isVisible(), false, 'Host account should be reused');
  for (const selector of ['[data-provider]', '[data-cdn-host]', '[data-premium-amount]', '[data-bulk-job]']) assert.equal(await ui.locator(selector).isVisible(), false, selector);
  assert.equal(await ui.locator('script[src*="tutorial"]').count(), 0);
  assert.equal(await ui.getByRole('link', { name: 'Bulk links' }).getAttribute('href'), './bulk.html');
  await ui.locator('[data-wizard-next]').first().click();
  await ui.getByText('Give your link a name.', { exact: true }).waitFor();
  await ui.locator('[data-label-input]').fill('study room');
  await ui.locator('[data-label-input]').press('Enter');
  await ui.locator('[data-wizard-step="1"]').waitFor({ state: 'visible' });
  assert.equal(requests.length, 0, 'Enter must advance without publishing');
  assert.equal(await ui.locator('[data-review-label]').textContent(), 'study room');
  await ui.getByRole('button', { name: 'Yes, continue' }).click();
  await ui.getByRole('button', { name: 'Create link', exact: true }).click();
  await ui.getByText('Choose a blocker before creating the link.', { exact: true }).waitFor();
  assert.equal(requests.length, 0);
  await ui.locator('[data-filter-select]').selectOption('goguardian');
  await ui.getByRole('button', { name: 'Create link', exact: true }).click();
  await ui.locator('[data-result-card]').waitFor({ state: 'visible' });
  await ui.locator('[data-filter-check-state]', { hasText: '1 allowed' }).waitFor();
  assert.deepEqual(requests[0], { body: { label: 'study room', provider: 'jsdelivr', method: 'managed', amount: 1 }, authorization: 'Bearer fixture-host-token' });
  assert.equal(await ui.getByRole('link', { name: 'Open link', exact: true }).getAttribute('aria-disabled'), 'false');
  assert.equal(await ui.locator('body').evaluate(() => sessionStorage.getItem('nyx.linkGenerator.firebaseSession')), null, 'Do not persist host tokens');
  await ui.getByRole('button', { name: 'Create another link' }).click();
  await ui.getByRole('button', { name: 'P2P', exact: true }).click();
  await ui.locator('[data-label-input]').fill('second link');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await ui.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Horizontal overflow');
    const button = await ui.getByRole('button', { name: 'Next', exact: true }).boundingBox();
    assert.ok(button.width >= 44 && button.height >= 44);
  }
  await mkdir('.codex-artifacts', { recursive: true });
  await page.screenshot({ path: '.codex-artifacts/link-generator-simple-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.codex-artifacts/link-generator-simple.png', fullPage: true });
  await ui.getByRole('button', { name: 'Next', exact: true }).click();
  await ui.locator('[data-wizard-step="1"]').waitFor({ state: 'visible' });
  assert.equal(await ui.locator('[data-review-method]').textContent(), 'P2P');
  await ui.getByRole('button', { name: 'Back', exact: true }).first().click();
  await ui.locator('[data-label-input]').fill('my second link');
  await ui.getByRole('button', { name: 'Next', exact: true }).click();
  await ui.getByRole('button', { name: 'Yes, continue' }).click();
  await ui.locator('[data-filter-select]').selectOption('goguardian');
  failPublish = true;
  await ui.getByRole('button', { name: 'Create link', exact: true }).click();
  await ui.getByText('Publisher temporarily unavailable. Try again.', { exact: true }).waitFor();
  assert.equal(await ui.locator('[data-wizard-step="2"]').isVisible(), true);
  assert.equal(await ui.locator('[data-label-input]').inputValue(), 'my second link');
  failPublish = false;
  await ui.getByRole('button', { name: 'Create link', exact: true }).click();
  await ui.locator('[data-result-card]').waitFor({ state: 'visible' });
  assert.equal(requests.at(-1).body.method, 'p2p');
  assert.equal(requests.at(-1).body.amount, 1);
  await ui.getByRole('button', { name: 'Create another link' }).click();
  await ui.locator('[data-label-input]').fill('signed out');
  parentToken = '';
  await ui.getByRole('button', { name: 'Next', exact: true }).click();
  await ui.locator('[data-access-gate]').waitFor({ state: 'visible' });
  assert.equal(requests.length, 3, 'Signing out must prevent further publishing');
  // A standalone link has an ordinary sign-in fallback.
  await page.goto('http://localhost/apps/link-generator/');
  await page.locator('[data-access-gate]').waitFor({ state: 'visible' });
  await page.locator('[data-account-email]').fill('fixture@example.test');
  await page.locator('[data-account-password]').fill('fixture-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('[data-access-gate]').waitFor({ state: 'hidden' });
  await page.locator('[data-label-input]').fill('standalone');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await page.locator('[data-filter-select]').selectOption('goguardian');
  await page.getByRole('button', { name: 'Create link', exact: true }).click();
  await page.locator('[data-result-card]').waitFor({ state: 'visible' });
  assert.equal(requests.at(-1).authorization, 'Bearer fixture-standalone-token');
  const palettes = [];
  for (const [theme, appearance] of [['default','dark'], ['halloween','dark'], ['emerald','light']]) {
    palettes.push(await page.evaluate(({theme,appearance}) => {
      document.documentElement.dataset.nyxTheme=theme;
      document.documentElement.dataset.nyxAppearance=appearance;
      const card=getComputedStyle(document.querySelector('[data-wizard-card]'));
      return [card.backgroundColor,card.color].join('|');
    }, {theme,appearance}));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.equal(new Set(palettes).size, 3, 'Cards must follow the shared theme palette');
  assert.deepEqual(errors, []);
  console.log('Simple link flow passed: host/standalone sign-in, Nyx/P2P, one-link requests, validation, retries, sign-out, desktop/mobile. No external writes.');
} finally { await workspace.close(); }
