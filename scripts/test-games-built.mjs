import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, symlink, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

                                                                            
                                                                               
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
  const page=await browser.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const catalogResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/assets/studies/studies.json');
  await page.goto(base+'/assets/studies/');
  const manifest=await catalogResponse;
  assert.equal(manifest.status(),200);
  assert((await manifest.json()).catalogs.length>0);
  await page.locator('.q482f08e91ee0').first().waitFor({timeout:30000});
  await page.locator('[data-library="local"]').click();
  assert(await page.locator('.q482f08e91ee0').count()>0);
  await page.locator('[data-library="gn"]').click();
  assert(await page.locator('.q482f08e91ee0').count()>0);
  assert.deepEqual(errors,[]);
  console.log('Built arcade loads the real JSON manifest and both bundled game catalogs.');

} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'exit'); child.disconnect();
    const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
    await closed; clearTimeout(timeout);
  }
  await unlink(staticRoot); await rmdir(temp);
}
