import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8198;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Nyx test server stopped early.\n${serverOutput}`);
    try { if ((await fetch(`${origin}/healthz`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Nyx test server did not start.\n${serverOutput}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  const verificationBodies = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/custom-hostnames/config') return json({ enabled: true, automatic: true, targetIps: ['15.204.93.166'] });
    if (url.pathname === '/api/link-checker/freedns-registry') return json({
      page: 1,
      totalPages: 212,
      totalDomains: 21_178,
      domains: [
        { id: '42', domain: 'mooo.com', status: 'public', hosts: 800_000 },
        { id: '43', domain: 'private.example', status: 'private', hosts: 10 }
      ]
    });
    if (url.pathname === '/api/custom-hostnames' && request.method() === 'POST') {
      const body = request.postDataJSON();
      verificationBodies.push(body);
      return json({ ok: true, hostname: body.hostname, url: `https://${body.hostname}/`, message: 'Domain verified.' });
    }
    if (url.hostname === 'freedns.afraid.org') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>FreeDNS</title><p>Human CAPTCHA form</p>' });
    }
    return route.continue();
  });

  await page.goto(`${origin}/connect-domain`, { waitUntil: 'domcontentloaded' });
  await page.locator('#link-name').fill('study-room');
  await page.locator('#base-domain').selectOption('mooo.com');
  assert.equal(await page.locator('[data-hostname-preview]').textContent(), 'study-room.mooo.com');
  assert.equal(await page.locator('input[type="password"]').count(), 0, 'Nyx must not collect FreeDNS passwords');

  await page.locator('[data-open-freedns]').click();
  await page.locator('[data-freedns-dialog]').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('[data-freedns-frame]').getAttribute('src'),
    'https://freedns.afraid.org/subdomain/edit.php?edit_domain_id=42'
  );
  assert.equal(await page.locator('[data-dialog-ip]').textContent(), '15.204.93.166');

  await page.locator('[data-created-verify]').click();
  await page.locator('.status.success').waitFor();
  assert.deepEqual(verificationBodies, [{ hostname: 'study-room.mooo.com' }]);
  assert.match(await page.locator('.status.success').textContent(), /Domain verified/);

  await page.setViewportSize({ width: 390, height: 760 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(mobileOverflow <= 1, `FreeDNS link setup overflowed the mobile viewport by ${mobileOverflow}px`);
  assert.deepEqual(pageErrors, [], `Browser errors: ${pageErrors.join(' | ')}`);
  console.log('FreeDNS assisted-link regression passed.');
} finally {
  await browser?.close().catch(() => {});
  if (server.exitCode === null) server.kill();
}
