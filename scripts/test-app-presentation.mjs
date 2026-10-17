import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, symlink, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

// A fresh credential-free backend, serving the actual production build. The
// junction avoids Express's intentional rejection of dot-directory file paths.
const temp = await mkdtemp(join(tmpdir(), 'nyx-app-presentation-'));
const staticRoot = join(temp, 'site');
await symlink(resolve(process.argv.includes('--built')?'dist':'.'), staticRoot, process.platform === 'win32' ? 'junction' : 'dir');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
const child = fork(new URL('../server.js', import.meta.url), [], {
  env: { ...env, PORT: '0', WISP_URL:'wss://example.com/wisp/', NYX_STATIC_ROOT: staticRoot, NYX_YOUTUBE_NATIVE_ENABLED: '0' }, silent: true
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
  assert.equal(health.wispImplementation, 'external');
  browser = await chromium.launch({ channel: 'msedge', headless: true });

  for(const [width,mode] of [[390,'load'],[768,'load'],[390,'error'],[390,'timeout']]) {
    const context=await browser.newContext({viewport:{width,height:844}});
    try {
      await context.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'{}'}));
      await context.addInitScript(()=>{
        localStorage.setItem('tutsi.customize.seen','1');
        localStorage.setItem('tutsi.settings.v1',JSON.stringify({closePrevention:false}));
      });
      let release,requested;
      const held=new Promise(r=>release=r),seen=new Promise(r=>requested=r);
      await context.route('**/apps/tutsi/embedded.css*',async route=>{requested();await held;if(mode==='error')await route.abort();else await route.continue();});
      const page=await context.newPage();
      await page.goto(base+'/apps/tutsi/index.html#ai',{waitUntil:'domcontentloaded'});
      await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Theme stylesheet not requested')),20000))]);
      const frame=page.frameLocator('#app-host iframe:not([hidden])');
      assert.equal(await frame.locator('html').getAttribute('data-app-presentation'),'pending');
      assert.equal(await frame.locator('body').evaluate(n=>getComputedStyle(n).visibility),'hidden');
      if(mode!=='timeout')release();
      await frame.locator('html:not([data-app-presentation])').waitFor({timeout:12000});
      if(mode==='timeout')release();
      assert.equal(await frame.locator('body').evaluate(n=>getComputedStyle(n).visibility),'visible');
      assert.equal(await frame.locator('html').getAttribute('data-tutsi-app'),'ai');
      console.log(`Tutsi ${width}px: ${mode}: initial app waits for theme CSS and reveals without getting stuck`);
    } finally {await context.close();}
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try {
    await context.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'{}'}));
    let release,requested;
    const held=new Promise(r=>release=r),seen=new Promise(r=>requested=r);
    await context.route('**/*',async route=>{
      const url=route.request().url();
      if(url.includes('20260922-model-picker-v8')&&route.request().resourceType()==='script'){requested();await held;}
      await route.fallback();
    });
    const page=await context.newPage();
    await page.goto(base+'/ai.html',{waitUntil:'commit'});await seen;
    await page.locator('body').waitFor({state:'attached'});
    assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).visibility),'hidden');
    release();
    await page.locator('html:not([data-app-presentation])').waitFor();
    assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).visibility),'visible');
    console.log('Nyx mobile: waits for deferred app initialization, then reveals layout');
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
