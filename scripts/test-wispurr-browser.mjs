import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, symlink, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

// A fresh credential-free backend, serving the actual production build. The
// junction avoids Express's intentional rejection of dot-directory file paths.
const temp = await mkdtemp(join(tmpdir(), 'nyx-wispurr-browser-'));
const staticRoot = join(temp, 'site');
await symlink(resolve('dist'), staticRoot, process.platform === 'win32' ? 'junction' : 'dir');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
const child = fork(new URL('../server.js', import.meta.url), [], {
  env: { ...env, PORT: '0', NYX_STATIC_ROOT: staticRoot, NYX_YOUTUBE_NATIVE_ENABLED: '0' }, silent: true
});
child.stdout.resume();
let stderr = '';
child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
let browser;
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 20000);
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited (${code}): ${stderr}`)));
    child.on('message', message => { if (message.type === 'nyx:listening') { clearTimeout(timeout); resolve(message.port); } });
  });
  const base = `http://127.0.0.1:${port}`;
  const health = await (await fetch(base + '/healthz')).json();
  assert.equal(health.wispImplementation, 'wispurr');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  if(!process.argv.includes('--settings-only')) for (const [mode, transport, httpBridge] of [['scramjet','libcurlRaw',undefined], ['scramjet','epoxy',undefined], ['scramjet','libcurlRaw',false], ['scramjet','epoxy',false], ['scramjet','libcurlRaw',true], ['scramjet','epoxy',true], ['scramjet-v1','epoxy',false], ['ultraviolet','epoxy',false], ['ultraviolet','libcurlRaw',false]]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({mode, transport, base, httpBridge}) => {
        localStorage.setItem('nyx.setupComplete', 'true');
        localStorage.setItem('nyx.tosAcceptedVersion', '2026-07-30');
        localStorage.setItem('nyx.browserMode', mode);
        localStorage.setItem('nyx.transport', transport);
        if (httpBridge !== undefined) localStorage.setItem('nyx.httpBridge', JSON.stringify(httpBridge));
        if (httpBridge !== false) window.WebSocket = class { constructor() { throw new Error('Native WebSockets disabled by test'); } };
      }, {mode, transport, base, httpBridge});
      await page.goto(base + '/nyx');
      await page.waitForFunction(() => typeof nyxLaunchGameFrame === 'function');
      const launch = await page.evaluate(async () => {
        const frame = document.createElement('iframe'); frame.id = 'relay-test'; document.body.append(frame);
        const result = await nyxLaunchGameFrame(frame, 'https://example.com/');
        if (!result.managed) frame.src = result.url;
        return result;
      });
      assert.equal(launch.engine, 'scramjet');
      await page.waitForFunction(() => document.querySelector('#relay-test')?.contentDocument?.body?.innerText?.includes('Example Domain'), {}, {timeout: 45000});
      assert.deepEqual(errors, []);
      console.log(`Nyx built: ${mode}/${transport}/${httpBridge === undefined ? "default HTTP" : httpBridge ? "HTTP" : "WebSocket"} anonymous HTTPS passed`);
    } finally { await context.close(); }
  }
  if(!process.argv.includes('--settings-only')) for (const httpOnly of [false, true]) {
    for (const transport of ['epoxy', 'libcurl', 'wisp']) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage(); const requests = []; const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', req => { if (req.url().includes('/api/tutsi-relay/')) requests.push(req.method() + ' ' + new URL(req.url()).pathname); });
        await page.addInitScript(({transport, httpOnly, base}) => {
          localStorage.setItem('tutsi.customize.seen', '1');
          localStorage.setItem('tutsi.settings.v1', JSON.stringify({transport, closePrevention: false, httpBridge: httpOnly}));
          if (httpOnly) window.WebSocket = class { constructor() { throw new Error('WebSockets disabled by test'); } };
        }, {transport, httpOnly, base});
        await page.goto(base + '/tutsi');
        await page.locator('#studyready-startup').waitFor({state: 'detached', timeout: 15000});
        await page.fill('#query', 'https://example.com/'); await page.locator('#search button').click();
        await page.frameLocator('#browser-stage iframe:not([hidden])').getByRole('heading', {name: 'Example Domain'}).waitFor({timeout: 60000});
        assert.equal(await page.locator('#browser-tabs [role=tab]').count(), 1);
        assert.deepEqual(errors, []);
        if (httpOnly) assert(requests.includes('POST /api/tutsi-relay/send'));
        else assert(!requests.includes('POST /api/tutsi-relay/send'), 'Explicit WebSocket choice stays selected');
        console.log(`Tutsi built: ${transport}/${httpOnly ? 'HTTP bridge' : 'WebSocket'} anonymous HTTPS passed`);
      } finally { await context.close(); }
    }
  }
  // Exercise the visible Tutsi switch on an existing website tab, then reload
  // with the new connection method. No production accounts or DNS are touched.
  const context = await browser.newContext();
  try {
    await context.addInitScript(()=>{
      localStorage.setItem('tutsi.customize.seen','1');
      localStorage.setItem('tutsi.settings.v1',JSON.stringify({transport:'libcurl',closePrevention:false}));
      localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');
    });
    const page=await context.newPage();let receives=0;
    page.on('request',r=>{if(r.url().endsWith('/api/tutsi-relay/receive'))receives++;});
    await page.goto(base+'/tutsi');
    await page.locator('#studyready-startup').waitFor({state:'detached',timeout:15000});
    await page.fill('#query','https://example.com/');await page.locator('#search button').click();
    const heading=page.frameLocator('#browser-stage iframe:not([hidden])').getByRole('heading',{name:'Example Domain'});
    await heading.waitFor({timeout:60000});assert(receives>0);
    await page.evaluate(()=>location.hash='settings');
    await page.locator('#http-bridge').uncheck();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tutsi.settings.v1')).httpBridge),false);
    await page.keyboard.press('Alt+1');
    await page.locator('#reload').click();await heading.waitFor({timeout:60000});
    await page.waitForTimeout(1500);const before=receives;await page.waitForTimeout(1500);assert.equal(receives,before,'Bridge polling stops after direct reload');
    await page.evaluate(()=>location.hash='settings');await page.locator('#http-bridge').check();
    await page.keyboard.press('Alt+1');await page.locator('#reload').click();
    await page.waitForFunction(()=>document.querySelector('#browser-stage iframe:not([hidden])')?.contentDocument?.body?.innerText.includes('Example Domain'),{},{timeout:60000});
    await page.waitForTimeout(1000);assert(receives>before,'Bridge resumes after enabled reload');
    await page.goto(base+'/nyx');await page.waitForFunction(()=>typeof nyxLaunchGameFrame==='function');
    await page.waitForFunction(()=>!document.querySelector('#nyxStudyHubStartup')&&!document.body.classList.contains('nyx-loading-active'));
    await page.locator('[data-browser-shell-search]').evaluate(form=>{form.querySelector('[data-browser-shell-url]').value='https://example.com/';form.requestSubmit();});
    await page.frameLocator('iframe.view.active').getByRole('heading',{name:'Example Domain'}).waitFor({timeout:60000});
    await page.locator('[data-browser-shell-settings]').first().evaluate(el=>el.click());
    await page.locator('[data-settings-category-button="proxy"]').click();
    const toggle=page.locator('[data-switch="nyx.httpBridge"]');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.httpBridge')),null);
    assert.equal(await toggle.getAttribute('aria-checked'),'true');
    assert.equal(await toggle.innerText(),'On');
    for (const enabled of [false,true]) {
      await toggle.click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nyx.httpBridge'))),enabled);
      const nyxBefore=receives;
      await page.locator('[data-browser-shell-tab]').filter({hasText:'example.com'}).first().evaluate(el=>el.click());
      await page.locator('[data-browser-shell-reload]').evaluate(el=>el.click());
      await page.frameLocator('iframe.view.active').getByRole('heading',{name:'Example Domain'}).waitFor({timeout:60000});
      await page.waitForTimeout(1500);const settled=receives;await page.waitForTimeout(1500);
      if(enabled) assert(receives>nyxBefore,'Nyx existing tab reload applies HTTP transport');
      else assert.equal(receives,settled,'Nyx polling stops after direct reload');
      await page.locator('[data-browser-shell-settings]').first().evaluate(el=>el.click());
      await page.locator('[data-settings-category-button="proxy"]').click();
    }
    await page.route('**/api/custom-hostnames/config',r=>r.fulfill({json:{enabled:true,targetIps:['15.204.93.166']}}));
    let body;
    await page.route('**/api/custom-hostnames',r=>{body=r.request().postDataJSON();return r.fulfill({json:{hostname:body.hostname,url:'https://'+body.hostname+'/',message:'Domain verified.'}});});
    await page.goto(base+'/tutsi/connect-domain');await page.fill('#hostname','fixture.example.org');await page.locator('[data-submit]').click();
    await page.locator('[data-status].success').waitFor();assert.equal(body.site,'tutsi');assert.match(await page.title(),/Tutsi/);
    console.log('Built settings: both switches persist, Tutsi existing-tab transport changes, domain form branding and payload passed.');
  } finally {await context.close();}
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'exit'); child.disconnect();
    const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
    await closed; clearTimeout(timeout);
  }
  await unlink(staticRoot); await rmdir(temp);
}
