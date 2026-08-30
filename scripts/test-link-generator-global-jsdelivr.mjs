import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { linkGeneratorHourlyQuota } from '../lib/link-generator-quota.mjs';

const githubPort = 8214;
const nyxPort = 8215;
const origin = `http://127.0.0.1:${nyxPort}`;
const githubRequests = [];

const quotaStart = Date.UTC(2026, 7, 29, 12, 0, 0);
assert.deepEqual(
  linkGeneratorHourlyQuota({ count: 73, windowStarted: quotaStart }, 27, quotaStart + 30_000, 100, 3_600_000),
  { allowed: true, count: 73, nextCount: 100, remaining: 27, remainingAfter: 0, retryAfter: 3570, windowStarted: quotaStart },
  'The regular hourly quota did not allow the exact remaining amount'
);
assert.equal(linkGeneratorHourlyQuota({ count: 73, windowStarted: quotaStart }, 28, quotaStart + 30_000, 100, 3_600_000).allowed, false, 'The regular hourly quota allowed more than 100 links');
assert.equal(linkGeneratorHourlyQuota({ count: 100, windowStarted: quotaStart }, 100, quotaStart + 3_600_000, 100, 3_600_000).allowed, true, 'The regular hourly quota did not reset after 60 minutes');

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
}

const github = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  githubRequests.push({ method: request.method, url: request.url, authorization: request.headers.authorization || '', body });
  if (request.method === 'GET' && request.url === '/repos/dubcatalt2-lab/nyx-jsdelivr-links') return sendJson(response, 200, { default_branch: 'main', private: false });
  if (request.method === 'GET' && request.url === '/repos/dubcatalt2-lab/nyx-jsdelivr-links/git/ref/heads/main') return sendJson(response, 200, { object: { sha: 'head-sha' } });
  if (request.method === 'GET' && request.url === '/repos/dubcatalt2-lab/nyx-jsdelivr-links/git/commits/head-sha') return sendJson(response, 200, { tree: { sha: 'base-tree-sha' } });
  if (request.method === 'GET' && request.url === '/repos/dubcatalt2-lab/nyx-jsdelivr-links/git/trees/base-tree-sha?recursive=1') return sendJson(response, 200, { truncated: false, tree: [{ path: 'existing.svg', type: 'blob' }] });
  if (request.method === 'POST' && request.url === '/repos/dubcatalt2-lab/nyx-jsdelivr-links/git/trees') return sendJson(response, 201, { sha: 'new-tree-sha' });
  if (request.method === 'POST' && request.url === '/repos/dubcatalt2-lab/nyx-jsdelivr-links/git/commits') return sendJson(response, 201, { sha: 'new-commit-sha' });
  if (request.method === 'PATCH' && request.url === '/repos/dubcatalt2-lab/nyx-jsdelivr-links/git/refs/heads/main') return sendJson(response, 200, { object: { sha: 'new-commit-sha' } });
  return sendJson(response, 500, { message: `Unexpected mock request: ${request.method} ${request.url}` });
});

await new Promise((resolve, reject) => github.once('error', reject).listen(githubPort, '127.0.0.1', resolve));

const nyx = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(nyxPort),
    LINK_GENERATOR_ACCESS_CODE: 'test-premium-code',
    NYX_PUBLIC_ORIGIN: 'https://nyxlearning.org',
    NYX_JSDELIVR_GITHUB_TOKEN: 'github_pat_server_only_test',
    NYX_JSDELIVR_GITHUB_REPOSITORY: 'dubcatalt2-lab/nyx-jsdelivr-links',
    NYX_JSDELIVR_GITHUB_API_BASE: `http://127.0.0.1:${githubPort}`
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
nyx.stdout.on('data', chunk => { output += chunk; });
nyx.stderr.on('data', chunk => { output += chunk; });

async function waitForNyx() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (nyx.exitCode !== null) throw new Error(`Nyx stopped early.\n${output}`);
    try { if ((await fetch(`${origin}/healthz`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Nyx did not start.\n${output}`);
}

function routeJson(route, value) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
}

let browser;
try {
  await waitForNyx();
  const status = await (await fetch(`${origin}/api/link-generator/status`)).json();
  assert.equal(status.globalPublisherConfigured, true, 'The global publisher was not reported as configured');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1_280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/api/link-checker/vendors', route => routeJson(route, { vendors: [{ key: 'goguardian', label: 'GoGuardian' }] }));
  await page.route('**/api/link-checker/check', route => routeJson(route, { vendors: { goguardian: { blocked: false } } }));
  await page.goto(`${origin}/apps/link-generator/`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-access-code]').fill('test-premium-code');
  await page.locator('[data-wizard-step="0"] [data-wizard-next]').click();
  await page.locator('[data-label-input]').fill('study room');
  await page.locator('[data-filter-select]').selectOption('goguardian');
  await page.locator('[data-premium-amount]').fill('2');
  await page.locator('[data-wizard-step="1"] [data-wizard-next]').click();
  await page.locator('[data-confirm]').check();
  await page.locator('[data-generate-button]').click();
  await page.locator('[data-result-card]:not([hidden])').waitFor({ state: 'visible' });

  assert.equal(new URL(page.url()).pathname, '/apps/link-generator/', 'Global publishing redirected to the personal-token publisher');
  const links = (await page.locator('[data-result-url]').inputValue()).trim().split('\n');
  assert.equal(links.length, 2, 'The global publisher did not return the requested number of links');
  links.forEach(link => assert.match(link, /^https:\/\/cdn\.jsdelivr\.net\/gh\/dubcatalt2-lab\/nyx-jsdelivr-links@main\/study-room-learning-[a-f0-9]{32}\.svg$/));
  assert.equal(await page.locator('[data-open]').getAttribute('aria-disabled'), 'false', 'The generated JSDelivr link was not immediately openable');
  assert.deepEqual(pageErrors, [], `Link Generator browser errors: ${pageErrors.join(' | ')}`);

  const treeRequest = githubRequests.find(request => request.method === 'POST' && request.url.endsWith('/git/trees'));
  assert.ok(treeRequest, 'The server did not create a Git tree');
  assert.equal(githubRequests.some(request => request.method === 'GET' && request.url.includes('/git/trees/')), false, 'The global publisher scanned the existing repository tree');
  const tree = JSON.parse(treeRequest.body);
  assert.equal(tree.tree.length, 2, 'The Git tree did not contain every requested Nyx SVG');
  assert.ok(tree.tree.every(entry => entry.content.includes('src="https://nyxlearning.org/"')), 'The server did not publish the maintained Nyx SVG');
  assert.ok(githubRequests.every(request => request.authorization === 'Bearer github_pat_server_only_test'), 'A server-side GitHub request omitted the configured token');
  const browserState = await page.evaluate(() => `${document.documentElement.innerHTML}\n${JSON.stringify({ ...localStorage, ...sessionStorage })}`);
  assert.doesNotMatch(browserState, /github_pat_server_only_test/, 'The global GitHub token reached the browser');

  const oneLinkRequestStart = githubRequests.length;
  const oneLinkResponse = await fetch(`${origin}/api/link-generator`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ provider: 'jsdelivr', accessCode: 'test-premium-code', label: 'one link test', amount: 1 })
  });
  assert.equal(oneLinkResponse.status, 201, 'The exact one-link generation request failed');
  const oneLinkResult = await oneLinkResponse.json();
  assert.equal(oneLinkResult.created, 1, 'The exact one-link generation request did not create one result');
  assert.match(oneLinkResult.links?.[0]?.url || '', /one-link-test-learning-[a-f0-9]{32}\.svg$/, 'The exact one-link generation request returned an invalid URL');
  const oneLinkTree = githubRequests.slice(oneLinkRequestStart).find(request => request.method === 'POST' && request.url.endsWith('/git/trees'));
  assert.equal(JSON.parse(oneLinkTree?.body || '{}').tree?.length, 1, 'The exact one-link generation request did not publish one SVG');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert.ok(overflow <= 1, `Global results caused ${overflow}px of mobile overflow`);

  const regularPage = await browser.newPage({ viewport: { width: 1_280, height: 900 } });
  const regularErrors = [];
  let regularRequest = null;
  regularPage.on('pageerror', error => regularErrors.push(error.message));
  await regularPage.addInitScript(session => {
    sessionStorage.setItem('nyx.linkGenerator.firebaseSession', JSON.stringify(session));
  }, {
    idToken: 'regular-test-token',
    refreshToken: 'regular-test-refresh',
    expiresAt: Date.now() + 3_600_000,
    email: 'regular@example.com',
    emailVerified: true,
    subscriptionStatus: 'free',
    premiumAccess: false
  });
  await regularPage.route('**/api/link-generator/status', route => routeJson(route, {
    available: true,
    provider: 'jsdelivr',
    globalPublisherConfigured: true,
    accountAccess: true,
    origin: 'https://nyxlearning.org',
    freeHourlyLimit: 100,
    freeWindowMinutes: 60,
    premiumBatchLimit: 100,
    premiumImmediateCooldownAt: 5,
    premiumAccumulatedLimit: 30,
    premiumCooldownMinutes: 10
  }));
  await regularPage.route('**/api/link-generator/auth-config', route => routeJson(route, { enabled: true, apiKey: 'test-web-key' }));
  await regularPage.route('**/api/account/me', route => routeJson(route, { subscriptionStatus: 'free', premiumAccess: false }));
  await regularPage.route('**/api/link-checker/vendors', route => routeJson(route, { vendors: [{ key: 'goguardian', label: 'GoGuardian' }] }));
  await regularPage.route('**/api/link-checker/check', route => routeJson(route, { vendors: { goguardian: { blocked: false } } }));
  await regularPage.route('**/api/link-generator', route => {
    regularRequest = JSON.parse(route.request().postData() || '{}');
    return routeJson(route, {
      authorized: true,
      provider: 'jsdelivr',
      published: true,
      requested: regularRequest.amount,
      created: regularRequest.amount,
      access: 'account',
      remaining: 100 - regularRequest.amount,
      links: Array.from({ length: regularRequest.amount }, (_, index) => ({ url: `https://cdn.jsdelivr.net/gh/dubcatalt2-lab/nyx-jsdelivr-links@main/regular-${index + 1}.svg` }))
    });
  });
  await regularPage.goto(`${origin}/apps/link-generator/`, { waitUntil: 'domcontentloaded' });
  await regularPage.locator('[data-account-status]', { hasText: '100 links per 60-minute window' }).waitFor();
  await regularPage.locator('[data-wizard-step="0"] [data-wizard-next]').click();
  await regularPage.locator('[data-premium-amount-field]').waitFor({ state: 'visible' });
  assert.equal(await regularPage.locator('[data-premium-amount]').getAttribute('max'), '100', 'Regular account batch input did not expose the 100-link maximum');
  await regularPage.locator('[data-label-input]').fill('regular batch');
  await regularPage.locator('[data-filter-select]').selectOption('goguardian');
  await regularPage.locator('[data-premium-amount]').fill('73');
  await regularPage.locator('[data-wizard-step="1"] [data-wizard-next]').click();
  await regularPage.locator('[data-review-amount]', { hasText: '73 links' }).waitFor();
  await regularPage.locator('[data-confirm]').check();
  await regularPage.locator('[data-generate-button]').click();
  await regularPage.locator('[data-result-card]:not([hidden])').waitFor({ state: 'visible' });
  assert.equal(regularRequest?.amount, 73, 'The regular-account batch amount was not sent to the server');
  await regularPage.locator('[data-notice]', { hasText: '27 links remaining' }).waitFor();
  assert.match(await regularPage.locator('[data-notice]').textContent(), /27 links remaining in your current hourly window/i, 'The regular-account hourly remainder was not shown');
  assert.deepEqual(regularErrors, [], `Regular-account batch browser errors: ${regularErrors.join(' | ')}`);
  await regularPage.close();

  console.log('Global server-side JSDelivr publishing, token isolation, filter checking, results, and mobile regressions passed.');
} finally {
  await browser?.close().catch(() => {});
  if (nyx.exitCode === null) nyx.kill();
  await new Promise(resolve => github.close(resolve));
}
