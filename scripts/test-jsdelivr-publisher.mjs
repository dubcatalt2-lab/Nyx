import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8213;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    LINK_GENERATOR_ACCESS_CODE: 'test-premium-code',
    NYX_PUBLIC_ORIGIN: 'https://nyxlearning.org'
  },
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

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installGithubMock(page, { failTree = false } = {}) {
  const requests = [];
  let automaticRepositoryCreated = false;
  await page.route('https://api.github.com/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    requests.push({ path, method, authorization: request.headers().authorization || '', body: request.postData() || '' });
    if (path === '/user' && method === 'GET') return json(route, { login: 'dubcatalt2-lab' });
    if (path === '/repos/dubcatalt2-lab/study-room-auto-1' && method === 'GET') {
      return automaticRepositoryCreated ? json(route, { default_branch: 'main', private: false }) : json(route, { message: 'Not Found' }, 404);
    }
    if (path === '/user/repos' && method === 'POST') {
      automaticRepositoryCreated = true;
      return json(route, { full_name: 'dubcatalt2-lab/study-room-auto-1', default_branch: 'main', private: false }, 201);
    }
    if (path === '/repos/dubcatalt2-lab/nyx-jsdelivr-links' && method === 'GET') return json(route, { default_branch: 'main', private: false });
    if (path.endsWith('/git/ref/heads/main') && method === 'GET') return json(route, { object: { sha: 'head-sha' } });
    if (path.endsWith('/git/commits/head-sha') && method === 'GET') return json(route, { tree: { sha: 'base-tree-sha' } });
    if (path.endsWith('/git/trees/base-tree-sha') && method === 'GET') return json(route, { truncated: false, tree: [{ path: 'existing-link-5.svg', type: 'blob' }] });
    if (path.endsWith('/git/trees') && method === 'POST') {
      if (failTree) return json(route, { message: 'Resource not accessible by personal access token', documentation_url: 'https://docs.github.com/rest/git/trees#create-a-tree' }, 403);
      return json(route, { sha: 'new-tree-sha' }, 201);
    }
    if (path.endsWith('/git/commits') && method === 'POST') return json(route, { sha: 'new-commit-sha' }, 201);
    if (path.endsWith('/git/refs/heads/main') && method === 'PATCH') return json(route, { object: { sha: 'new-commit-sha' } });
    return json(route, { message: `Unexpected mock request: ${method} ${path}` }, 500);
  });
  return requests;
}

async function fillPublisher(page, count = 3) {
  await page.locator('#token').fill('github_pat_test_secret');
  await page.locator('#repo').fill('dubcatalt2-lab/nyx-jsdelivr-links');
  await page.locator('#mainWords').fill('nyx, learning');
  await page.locator('#sideWords').fill('portal, cloud, study');
  await page.locator('#count').fill(String(count));
  await page.locator('#svgFile').setInputFiles({
    name: 'nyx-source.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>Nyx test</title></svg>')
  });
}

let browser;
try {
  await waitForServer();
  const appsResponse = await fetch(`${origin}/api/apps`);
  assert.equal(appsResponse.ok, true, 'The public app catalog did not load');
  const apps = await appsResponse.json();
  assert.ok(apps.apps?.some(app => app.id === 'jsdelivr-publisher' && app.url === '/apps/jsdelivr-publisher/'), 'The JSDelivr Publisher was missing from the app catalog');

  browser = await chromium.launch({ headless: true });

  const handoffPage = await browser.newPage({ viewport: { width: 1_280, height: 900 } });
  const handoffErrors = [];
  let p2pRequest = null;
  handoffPage.on('pageerror', error => handoffErrors.push(error.message));
  await handoffPage.route('**/api/link-checker/vendors', route => json(route, { vendors: [{ key: 'goguardian', label: 'GoGuardian' }] }));
  await handoffPage.route('**/api/link-checker/check', route => json(route, { vendors: { goguardian: { blocked: false } } }));
  await handoffPage.route('**/api/link-generator', route => {
    p2pRequest = JSON.parse(route.request().postData() || '{}');
    return json(route, {
      authorized: true,
      provider: 'jsdelivr',
      method: 'p2p',
      published: true,
      requested: p2pRequest.amount,
      created: 1,
      partial: true,
      warning: 'Mocked partial P2P response.',
      access: 'administrator',
      links: [{ url: 'https://cdn.jsdelivr.net/gh/dubcatalt2-lab/nyx-jsdelivr-links@main/p2p-test.svg' }],
      premiumCooldown: { triggered: true, minutes: 10, accumulated: p2pRequest.amount, accumulatedLimit: 30 }
    }, 201);
  });
  await handoffPage.goto(`${origin}/apps/link-generator/`, { waitUntil: 'domcontentloaded' });
  await handoffPage.locator('[data-access-code]').fill('test-premium-code');
  await handoffPage.locator('[data-wizard-step="0"] [data-wizard-next]').click();
  await handoffPage.locator('[data-wizard-step="1"]:not([hidden])').waitFor({ state: 'visible' });
  await handoffPage.locator('[data-label-input]').fill('study room');
  await handoffPage.locator('[data-filter-select]').selectOption('goguardian');
  await handoffPage.locator('[data-premium-amount]').fill('2');
  await handoffPage.locator('[data-generation-method]').selectOption('p2p');
  assert.equal(await handoffPage.locator('[data-premium-amount]').getAttribute('max'), '1000', 'Premium P2P did not expose the 1,000-link maximum');
  assert.match(await handoffPage.locator('[data-premium-amount-hint]').textContent(), /up to 1,000 links per run/i, 'Premium P2P did not explain its higher batch limit');
  await handoffPage.locator('[data-premium-amount]').fill('1000');
  await handoffPage.locator('[data-wizard-step="1"] [data-wizard-next]').click();
  await handoffPage.locator('[data-wizard-step="2"]:not([hidden])').waitFor({ state: 'visible' });
  await handoffPage.locator('[data-review-method]', { hasText: 'P2P' }).waitFor();
  await handoffPage.locator('[data-confirm]').check();
  await handoffPage.locator('[data-generate-button]').click();
  await handoffPage.locator('[data-result-card]:not([hidden])').waitFor({ state: 'visible' });
  assert.equal(new URL(handoffPage.url()).pathname, '/apps/link-generator/', 'P2P redirected to the manual publisher instead of returning Nyx links');
  assert.equal(p2pRequest?.method, 'p2p', 'Link Generator did not send the P2P method');
  assert.equal(p2pRequest?.amount, 1000, 'Link Generator did not send the requested P2P maximum');
  assert.equal(p2pRequest?.label, 'study room', 'Link Generator did not send the requested P2P label');
  assert.match(await handoffPage.locator('[data-result-url]').inputValue(), /p2p-test\.svg$/, 'P2P did not render the returned Nyx link');
  assert.equal(await handoffPage.locator('#token').count(), 0, 'P2P exposed the personal-token publisher form');
  assert.deepEqual(handoffErrors, [], `Direct P2P Link Generator browser errors: ${handoffErrors.join(' | ')}`);
  await handoffPage.close();

  const cloakBridgePage = await browser.newPage({ viewport: { width: 1_280, height: 900 } });
  const cloakBridgeErrors = [];
  cloakBridgePage.on('pageerror', error => cloakBridgeErrors.push(error.message));
  await cloakBridgePage.route('https://nyxlearning.org/', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><script>parent.postMessage({type:"nyx:tab-cloak-sync",title:"Google Classroom",favicon:"https://nyxlearning.org/assets/icons/nyx.svg"},"*")<\/script>'
  }));
  await cloakBridgePage.goto(`${origin}/apps/jsdelivr-publisher/nyx-source.svg`, { waitUntil: 'domcontentloaded' });
  await cloakBridgePage.waitForFunction(() => document.title === 'Google Classroom');
  assert.equal(await cloakBridgePage.locator('#nyxOuterTabIcon').getAttribute('href'), 'https://nyxlearning.org/assets/icons/nyx.svg', 'The JSDelivr wrapper did not mirror the selected favicon');
  assert.deepEqual(cloakBridgeErrors, [], `JSDelivr tab-cloak bridge errors: ${cloakBridgeErrors.join(' | ')}`);
  await cloakBridgePage.close();

  const page = await browser.newPage({ viewport: { width: 1_280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const requests = await installGithubMock(page);
  await page.goto(`${origin}/apps/jsdelivr-publisher/`, { waitUntil: 'domcontentloaded' });
  await fillPublisher(page, 3);
  await page.locator('#publishButton').click();
  await page.locator('#results:not([hidden])').waitFor({ state: 'visible' });

  const output = (await page.locator('#linksOutput').inputValue()).trim().split('\n');
  assert.equal(output.length, 3, 'The publisher did not return the requested number of links');
  output.forEach((link, index) => {
    assert.match(link, /^https:\/\/cdn\.jsdelivr\.net\/gh\/dubcatalt2-lab\/nyx-jsdelivr-links@main\/[a-z0-9-]+\.svg$/, 'The publisher returned an invalid jsDelivr URL');
    assert.ok(link.endsWith(`-${index + 6}.svg`), `Generated link ${index + 1} did not continue after the existing numeric suffix`);
  });

  const treeRequest = requests.find(request => request.path.endsWith('/git/trees') && request.method === 'POST');
  assert.ok(treeRequest, 'The publisher did not create a Git tree');
  const treePayload = JSON.parse(treeRequest.body);
  assert.equal(treePayload.tree.length, 3, 'The Git tree did not contain every requested SVG');
  assert.ok(treePayload.tree.every(entry => entry.content.includes('<title>Nyx test</title>')), 'The selected SVG was not preserved in each tree entry');
  assert.ok(requests.every(request => request.authorization === 'Bearer github_pat_test_secret'), 'A GitHub API request omitted the bearer token');
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  assert.doesNotMatch(storage, /github_pat_test_secret/, 'The GitHub token was written to browser storage');

  await page.locator('#providerTabs button', { hasText: 'Fastly' }).click();
  assert.match(await page.locator('#linksOutput').inputValue(), /^https:\/\/fastly\.jsdelivr\.net\/gh\//, 'Provider switching did not update the generated links');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert.ok(mobileOverflow <= 1, `The publisher caused ${mobileOverflow}px of mobile overflow`);
  assert.deepEqual(pageErrors, [], `Publisher browser errors: ${pageErrors.join(' | ')}`);
  await page.close();

  const errorPage = await browser.newPage({ viewport: { width: 1_280, height: 800 } });
  const errorPageErrors = [];
  errorPage.on('pageerror', error => errorPageErrors.push(error.message));
  await installGithubMock(errorPage, { failTree: true });
  await errorPage.goto(`${origin}/apps/jsdelivr-publisher/`, { waitUntil: 'domcontentloaded' });
  await fillPublisher(errorPage, 1);
  await errorPage.locator('#publishButton').click();
  await errorPage.locator('#publisherMessage.error').waitFor({ state: 'visible' });
  assert.match(await errorPage.locator('#publisherMessage').textContent(), /GitHub API 403: Resource not accessible by personal access token/i, 'The publisher hid the actionable GitHub permission error');
  assert.equal(await errorPage.locator('#results').isHidden(), true, 'Failed publishing exposed stale results');
  assert.deepEqual(errorPageErrors, [], `Permission-error browser errors: ${errorPageErrors.join(' | ')}`);
  await errorPage.close();

  console.log('Link Generator handoff and JSDelivr Publisher catalog, publishing, outer tab cloak, provider, token-safety, filter, error, and mobile regressions passed.');
} finally {
  await browser?.close().catch(() => {});
  if (server.exitCode === null) server.kill();
}
