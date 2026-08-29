import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const githubPort = 8214;
const nyxPort = 8215;
const origin = `http://127.0.0.1:${nyxPort}`;
const githubRequests = [];

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
  links.forEach(link => assert.match(link, /^https:\/\/cdn\.jsdelivr\.net\/gh\/dubcatalt2-lab\/nyx-jsdelivr-links@main\/study-room-learning-[a-f0-9]{12}\.svg$/));
  assert.equal(await page.locator('[data-open]').getAttribute('aria-disabled'), 'false', 'The generated JSDelivr link was not immediately openable');
  assert.deepEqual(pageErrors, [], `Link Generator browser errors: ${pageErrors.join(' | ')}`);

  const treeRequest = githubRequests.find(request => request.method === 'POST' && request.url.endsWith('/git/trees'));
  assert.ok(treeRequest, 'The server did not create a Git tree');
  const tree = JSON.parse(treeRequest.body);
  assert.equal(tree.tree.length, 2, 'The Git tree did not contain every requested Nyx SVG');
  assert.ok(tree.tree.every(entry => entry.content.includes('src="https://nyxlearning.org/"')), 'The server did not publish the maintained Nyx SVG');
  assert.ok(githubRequests.every(request => request.authorization === 'Bearer github_pat_server_only_test'), 'A server-side GitHub request omitted the configured token');
  const browserState = await page.evaluate(() => `${document.documentElement.innerHTML}\n${JSON.stringify({ ...localStorage, ...sessionStorage })}`);
  assert.doesNotMatch(browserState, /github_pat_server_only_test/, 'The global GitHub token reached the browser');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert.ok(overflow <= 1, `Global results caused ${overflow}px of mobile overflow`);
  console.log('Global server-side JSDelivr publishing, token isolation, filter checking, results, and mobile regressions passed.');
} finally {
  await browser?.close().catch(() => {});
  if (nyx.exitCode === null) nyx.kill();
  await new Promise(resolve => github.close(resolve));
}
