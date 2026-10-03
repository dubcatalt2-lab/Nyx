import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { BulkJob } from '../apps/link-generator/bulk-jobs.js';
const hosts = ['cdn.jsdelivr.net', 'gcore.jsdelivr.net', 'fastly.jsdelivr.net', 'quantil.jsdelivr.net', 'originfastly.jsdelivr.net', 'testingcf.jsdelivr.net', 'jsdelivr.b-cdn.net', 'esm.sh', 'raw.esm.sh'];

// Intercept every request; tests never publish to GitHub.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let sourceRequests = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cdn.jsdelivr.net') {
      assert.equal(url.pathname, '/gh/dubcatalt2-lab/nyx-jsdelivr-links@main/1-learning-005847b5039fb2c8f4515165e0d79a17.svg');
      assert.equal(route.request().headers().authorization, undefined);
      sourceRequests++;
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><title>Source fixture</title></svg>' });
    }
    if (url.hostname !== 'nyx.test' || url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, body: '{}' });
    const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    try {
      const body = await readFile(resolve('.' + pathname));
      const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(pathname)] || 'application/octet-stream';
      return route.fulfill({ contentType, body });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  await page.goto('http://nyx.test/apps/link-generator/');
  assert.equal(await page.locator('[data-bulk-generate]').count(), 0);
  assert.equal(await page.locator('script[src*="bulk-variants"]').count(), 0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.bulk-variants-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  }
  await page.locator('[data-bulk-label]').fill('34');
  await page.locator('[data-bulk-host]').selectOption('gcore.jsdelivr.net');
  await page.locator('[data-bulk-setup] button').click();
  assert.equal(await page.locator('[data-label-input]').inputValue(), '34');
  assert.equal(await page.locator('[data-cdn-host]').inputValue(), 'gcore.jsdelivr.net');
  assert.equal(await page.locator('[data-premium-amount]').inputValue(), '10');
  assert.equal(new URL(page.url()).pathname, '/apps/link-generator/');
  const filenames = ['34-learning-05fd049f1fe4cc7137a52fd41697f8f2.svg', '34-learning-29c2e1b79a4705f1a6dc9a9e1fc8f9c8.svg'];
  await page.route('**/api/link-generator', async route => {
    const payload = route.request().postDataJSON();
    assert.equal(payload.label, '34');
    assert.equal(payload.amount, 2);
    assert.equal(payload.provider, 'jsdelivr');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      provider: 'jsdelivr', links: filenames.map(file => 'https://cdn.jsdelivr.net/gh/dubcatalt2-lab/nyx-jsdelivr-links@main/' + file), remaining: 98
    }) });
  });
  for (const host of hosts) {
    await page.evaluate(host => {
      document.querySelector('[data-access-mode="administrator"]').click();
      document.querySelector('[data-access-code]').value = 'fixture';
      document.querySelector('[data-premium-amount]').value = '2';
      document.querySelector('[data-cdn-host]').value = host;
      const filter = document.querySelector('[data-filter-select]');
      filter.innerHTML = '<option value="test">Test filter</option>';
      document.querySelector('[data-generator-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, host);
    await page.waitForFunction(() => !document.querySelector('[data-generate-button]').disabled);
    const links = (await page.locator('[data-result-url]').inputValue()).split('\n');
    assert.deepEqual(links, filenames.map(file => 'https://' + host + '/gh/dubcatalt2-lab/nyx-jsdelivr-links@main/' + file));
    assert.equal(await page.locator('[data-open]').getAttribute('href'), links[0]);
  }
  const downloaded = page.waitForEvent('download');
  await page.locator('[data-download-links]').click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), 'nyx-jsdelivr-links.txt');
  assert.match(await readFile(await download.path(), 'utf8'), /https:\/\/raw\.esm\.sh\/gh\//);
  await page.goto('http://nyx.test/apps/jsdelivr-publisher/?preset=nyx&source=jsdelivr&count=10&cdn=gcore.jsdelivr.net');
  await page.waitForFunction(() => typeof presetSvg !== 'undefined' && presetSvg.includes('Source fixture'));
  assert.equal(sourceRequests, 1);
  assert.equal(await page.locator('#count').inputValue(), '10');
  assert.equal(await page.locator('#fileDisplay').textContent(), 'Selected jsDelivr SVG');
  assert.equal(await page.evaluate(() => selectedProvider), 'gcore');
  const result = await page.evaluate(async () => {
    const calls = [];
    getGitHead = async () => ({ treeSha: 'old-tree', commitSha: 'old-commit' });
    githubJson = async (path, token, options) => {
      calls.push({ path, body: JSON.parse(options.body) });
      return { sha: 'new-sha' };
    };
    await publishTree({ fullName: 'test/repo', branch: 'main' }, ['one.svg', 'two.svg'], presetSvg, 'fixture');
    let failed = false;
    githubJson = async () => { throw new Error('Publishing rejected'); };
    try { await publishTree({ fullName: 'test/repo', branch: 'main' }, ['fail.svg'], presetSvg, 'fixture'); } catch { failed = true; }
    return { calls, failed, url: providers.jsdelivr('test/repo', 'main', 'one.svg') };
  });
  assert.equal(result.calls.length, 3);
  assert.equal(result.calls[0].body.tree.length, 2);
  assert.equal(result.calls[2].body.force, false);
  assert.equal(result.failed, true);
  assert.equal(result.url, 'https://cdn.jsdelivr.net/gh/test/repo@main/one.svg');
  // Every provider keeps the same published files and supports mobile selection.
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      publishedResult = { publishedCount: 2, repos: [{repo: 'test/repo', branch: 'main', files: ['one.svg','two.svg']}], links: ['one.svg','two.svg'].map(file => ({repo:'test/repo',branch:'main',file})) };
      renderResults();
      window.copiedLinks = '';
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {writeText: async value => { window.copiedLinks = value; }} });
    });
    for (const host of hosts) {
      const key = await page.evaluate(host => Object.keys(providers).find(key => new URL(providers[key]('test/repo','main','one.svg')).hostname === host), host);
      await page.locator(`[data-provider="${key}"]`).click();
      const expected = ['one.svg','two.svg'].map(file => `https://${host}/gh/test/repo@main/${file}`).join('\n');
      assert.equal(await page.locator('#linksOutput').inputValue(), expected);
      await page.locator('#copyLinks').click();
      assert.equal(await page.evaluate(() => window.copiedLinks), expected);
      const pendingDownload = page.waitForEvent('download');
      await page.locator('#downloadLinks').click();
      assert.equal(await readFile(await (await pendingDownload).path(), 'utf8'), expected + '\n');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.match(await page.locator('#resultsSummary').textContent(), /2 SVG files/);
  }
  for (const host of hosts) {
    await page.goto(`http://nyx.test/apps/jsdelivr-publisher/?preset=nyx&count=2&cdn=${host}`);
    assert.equal(await page.evaluate(() => new URL(providers[selectedProvider]('test/repo','main','one.svg')).hostname), host);
    let saved;
    let batch;
    const store = { read: async () => saved, save: async (job, value) => { saved = structuredClone(job); if(value) batch = value; } };
    const job = new BulkJob({store, access: async () => ({uid:'test',token:'fixture',limit:2,method:'managed'}), request: async () => new Response(JSON.stringify({links:['https://cdn.jsdelivr.net/gh/test/repo@main/one.svg']}),{headers:{'Content-Type':'application/json'}})});
    await job.create({total:1,label:'test',host});
    await job.run();
    assert.equal(saved.completed,1);
    assert.deepEqual(batch.links,[`https://${host}/gh/test/repo@main/one.svg`]);
  }
  // Exercise both actual popup validators without relaxing URL/source checks.
  const shell = await readFile('script.js','utf8');
  const outerSource = shell.slice(shell.indexOf('function isNyxGeneratedCdnUrl('),shell.indexOf('  function externalHttpUrl(',shell.indexOf('function isNyxGeneratedCdnUrl(')));
  const innerStart = shell.indexOf('const trustedGeneratedPopup = link => {');
  const innerSource = shell.slice(innerStart,shell.indexOf('      const nativeOpen',innerStart));
  const outer = new Function(outerSource + '; return isNyxGeneratedCdnUrl;')();
  const inner = new Function('location',innerSource + '; return trustedGeneratedPopup;')({pathname:'/apps/link-generator/',href:'https://nyx.test/apps/link-generator/'});
  for (const host of hosts) {
    const url = `https://${host}/gh/test/repo@main/one.svg`;
    assert.equal(outer(url),true);
    assert.equal(inner({matches:()=>true,href:url}),true);
    assert.equal(inner({matches:()=>false,href:url}),false);
    for (const bad of [url+'?x=1',url+'#x',url.replace('https:','http:'),url.replace(host,'user:pass@'+host),url.replace('one.svg','one.html'),url.replace(host,host+'.example.com')]) {
      assert.equal(outer(bad),false,bad);
      assert.equal(inner({matches:()=>true,href:bad}),false,bad);
    }
  }
  console.log('jsDelivr handoff, source, responsive card, publish sequence and failure checks passed (mocked publishing).');
} finally { await browser.close(); }
