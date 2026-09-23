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
  for (const [mode, transport] of [['scramjet','libcurlRaw'], ['scramjet','epoxy'], ['scramjet-v1','epoxy'], ['ultraviolet','epoxy'], ['ultraviolet','libcurlRaw']]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({mode, transport, base}) => {
        localStorage.setItem('nyx.setupComplete', 'true');
        localStorage.setItem('nyx.tosAcceptedVersion', '2026-07-30');
        localStorage.setItem('nyx.browserMode', mode);
        localStorage.setItem('nyx.transport', transport);
        localStorage.setItem('nyx.wispUrl', base.replace(/^http/, 'ws') + '/resources/live/');
      }, {mode, transport, base});
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
      console.log(`Nyx built: ${mode}/${transport} anonymous HTTPS passed`);
    } finally { await context.close(); }
  }
  for (const httpOnly of [false, true]) {
    for (const transport of ['epoxy', 'libcurl', 'wisp']) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage(); const requests = []; const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', req => { if (req.url().includes('/api/tutsi-relay/')) requests.push(req.method() + ' ' + new URL(req.url()).pathname); });
        await page.addInitScript(({transport, httpOnly, base}) => {
          localStorage.setItem('tutsi.customize.seen', '1');
          localStorage.setItem('tutsi.settings.v1', JSON.stringify({transport, closePrevention: false, ...(httpOnly ? {} : {relay: base.replace(/^http/, 'ws') + '/resources/live/', autoRelay: false})}));
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
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'exit'); child.disconnect();
    const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
    await closed; clearTimeout(timeout);
  }
  await unlink(staticRoot); await rmdir(temp);
}
