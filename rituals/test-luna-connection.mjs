import assert from 'node:assert/strict';
import express from 'express';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const app = express();
app.get('/host', (_, res) => res.type('html').send(`<!doctype html><script>
window.calls=[];window.nyxLaunchGameFrame=(frame,url,options)=>new Promise((resolve,reject)=>{
 const call={frame,url,options,resolve,reject};calls.push(call);
 options.signal.addEventListener('abort',()=>call.aborted=true,{once:true});
});</script><iframe src="/middle"></iframe>`));
app.get('/middle', (_, res) => res.type('html').send('<!doctype html><iframe src="/apps/cloud-gaming/"></iframe>'));
app.get('/connected', (_, res) => res.type('html').send('<!doctype html><h1>Connected fixture</h1>'));
app.get('/apps/cloud-gaming/app.js', (_, res) => res.type('js').send(''));
app.get('/js/intercession-startup.mjs', (_, res) => res.type('js').send(`
export async function loadConnectionScript(url){window.configLoads=(window.configLoads||0)+1;window.__NYX_RUNTIME_CONFIG__={};}`));
app.get('/chapels/tutsi/intercession.mjs', (_, res) => res.type('js').send(`
export async function explore(url,settings,frame){window.standalone={url,settings};frame.src='/connected';}
export function closeWorkspace(frame){window.lunaCloseCount=(window.lunaCloseCount||0)+1;frame.src='about:blank';}`));
app.get('/js/display-names.js', (_, res) => res.sendFile(resolve('parables/display-names.js'), {dotfiles:'allow'}));
app.get('/js/app-presentation.js', (_, res) => res.type('js').send(''));
app.use('/apps/cloud-gaming', express.static('chapels/cloud-gaming'));
const server = app.listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage(), errors = [], direct = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).hostname === 'luna.loan') direct.push(r.url()); });
  await page.goto(base + '/host');
  await page.waitForFunction(() => calls.length === 1);
  const cloud = page.frames().find(f => f.url().includes('/apps/cloud-gaming/'));
  assert.equal(await page.evaluate(() => calls[0].url), 'https://luna.loan/');
  assert.equal(await page.evaluate(() => calls[0].options.forceProxy), true);
  assert.equal(await cloud.locator('[data-luna-dialog] a').getAttribute('href'), '/apps/cloud-gaming/?provider=luna');

  // Close during connection startup; a late failure must not affect a new session.
  await cloud.locator('[data-luna-close]').click();
  await page.waitForFunction(() => calls[0].aborted);
  assert.equal(await cloud.locator('[data-luna-host] iframe').count(), 0);
  await cloud.locator('[data-luna-open]').click();
  await page.waitForFunction(() => calls.length === 2);
  await page.evaluate(() => {
    calls[1].frame.src = '/connected'; calls[1].resolve({managed: true});
    calls[0].reject(new Error('Old attempt failed'));
  });
  await cloud.waitForFunction(() => document.querySelector('[data-luna-status]').textContent === 'CloudMoon games');
  assert.equal(await cloud.locator('[data-luna-host] iframe').count(), 1);
  await cloud.locator('[data-luna-close]').click();
  await page.waitForFunction(() => calls[1].aborted);

  await cloud.locator('[data-luna-open]').click();
  await page.waitForFunction(() => calls.length === 3);
  await page.evaluate(() => calls[2].resolve({managed: false}));
  await cloud.getByText('Luna could not connect. Close and reopen it to retry.').waitFor();
  assert.equal(await cloud.locator('[data-luna-host] iframe').count(), 0, 'Never fall back to a direct Luna iframe');
  assert.deepEqual(direct, []);
  assert.deepEqual(errors, []);
  await page.close();

  const standalone = await browser.newPage();
  await standalone.addInitScript(() => {
    localStorage.setItem('nyx.transport', 'wisp');
    localStorage.setItem('nyx.httpBridge', 'false');
    localStorage.setItem('nyx.wispUrl', 'wss://relay.example/resources/live/');
    localStorage.setItem('nyx.popupProtection', 'false');
  });
  await standalone.goto(base + '/apps/cloud-gaming/');
  await standalone.waitForFunction(() => !!window.standalone);
  assert.deepEqual(await standalone.evaluate(() => window.standalone), {
    url: 'https://luna.loan/', settings: {transport: 'wisp', httpBridge: false,
      relay: 'wss://relay.example/resources/live/', autoRelay: true, adBlock: false, popupBlock: true, downloadBlock: true}
  });
  assert.equal(await standalone.evaluate(() => configLoads), 1);
  await standalone.locator('[data-luna-close]').click();
  await standalone.waitForFunction(() => window.lunaCloseCount === 1);
  await standalone.close();
  console.log('PASS Luna nested host routing, forced connection, cancellation/reopen races, failure without direct fallback, proxied pop-out and standalone saved settings.');
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r));
}
