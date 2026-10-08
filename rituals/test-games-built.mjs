import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, symlink, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

// A fresh credential-free backend, serving the actual production build. The
// junction avoids Express's intentional rejection of dot-directory file paths.
const temp = await mkdtemp(join(tmpdir(), 'nyx-wispurr-workspace-'));
const staticRoot = join(temp, 'site');
await symlink(resolve('dist'), staticRoot, process.platform === 'win32' ? 'junction' : 'dir');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
const child = fork(new URL('../shepherd.js', import.meta.url), [], {
  env: { ...env, PORT: '0', NYX_STATIC_ROOT: staticRoot, NYX_YOUTUBE_NATIVE_ENABLED: '0' }, silent: true
});
child.stdout.resume();
let stderr = '';
child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
let workspace;
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
  workspace = await chromium.launch({ channel: 'msedge', headless: true });
  const page=await workspace.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const catalogResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/assets/games/games.json');
  await page.goto(base+'/assets/games/');
  const manifest=await catalogResponse;
  assert.equal(manifest.status(),200);
  assert((await manifest.json()).catalogs.length>0);
  await page.locator('.game-card').first().waitFor({timeout:30000});
  await page.locator('[data-library="local"]').click();
  assert(await page.locator('.game-card').count()>0);
  await page.locator('[data-library="gn"]').click();
  assert(await page.locator('.game-card').count()>0);
  // Exercise the exact player toolbar, including the Drop variant. Game documents
  // are fixtures so this label/navigation regression never contacts providers.
  await page.route('**/*',route=>route.request().isNavigationRequest()&&route.request().frame()!==page.mainFrame()
    ?route.fulfill({contentType:'text/html',body:'<!doctype html><title>Game fixture</title><p>Ready</p>'})
    :route.continue());
  for(const width of [1365,390])for(const path of ['/assets/games/','/apps/drop/games.html']){
    await page.setViewportSize({width,height:900});
    await page.goto(base+path);
    await page.locator('.game-card').first().waitFor({timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#closePlayer [data-nyx-display-label]')?.textContent.normalize('NFKC')==='G@M3Z');
    for(let attempt=0;attempt<2;attempt++){
      await page.locator('.game-card').first().click();
      await page.locator('#gamePlayer').waitFor({state:'visible'});
      assert.equal((await page.locator('#closePlayer [data-nyx-display-label]').textContent()).normalize('NFKC'),'G@M3Z');
      await page.locator('#closePlayer').click();
      await page.locator('#gamePlayer').waitFor({state:'hidden'});
    }
    console.log('PASS Games back label/open/close',width,path);
  }
  assert.deepEqual(errors,[]);
  console.log('Built arcade loads the real JSON manifest and both bundled game catalogs.');

} finally {
  await workspace?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'exit'); child.disconnect();
    const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
    await closed; clearTimeout(timeout);
  }
  await unlink(staticRoot); await rmdir(temp);
}
