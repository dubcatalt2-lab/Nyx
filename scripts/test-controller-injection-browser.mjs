import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { chromium } from 'playwright';
import { rewriteRuntimeNames } from './build-runtime-names.mjs';
const root = process.env.NYX_TEST_STATIC_ROOT || 'dist';
const { aliases } = JSON.parse(await readFile(root + '/proxy-assets.json', 'utf8'));
const app = express();
app.get('/fixture', (_, res) => res.type('html').send('<title>Controller test</title><iframe id="game"></iframe>'));
app.use((_, res, next) => { res.set('Service-Worker-Allowed', '/'); next(); });
app.use(express.static(root));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('http://127.0.0.1:' + server.address().port + '/fixture');
  await page.addScriptTag({ url: aliases['/scramjet/scramjet.js'] });
  await page.addScriptTag({ url: aliases['/controller/controller.api.js'] });
  await page.evaluate(async ({ aliases, apiName }) => {
    const registration = await navigator.serviceWorker.register(aliases['/polygon.studies.js'], { scope: '/4otig/' });
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker.state !== 'activated') await new Promise((resolve, reject) => worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') resolve();
      if (worker.state === 'redundant') reject(Error('Worker failed'));
    }));
    const html = '<!doctype html><title>Proxied fixture</title><button id="run">Run</button><output id="result"></output><script>document.getElementById("run").onclick=()=>{document.cookie="test=yes; Path=/";history.pushState({},"","/next");document.getElementById("result").textContent=location.pathname+":"+document.cookie;};</script>';
    const transport = { ready: true, async request() { return { status: 200, statusText: 'OK', headers: [['content-type', 'text/html']], body: new Response(html).body }; }, connect() { return [() => {}, () => {}]; } };
    const controller = new window[apiName].Controller({ serviceworker: worker, transport,
      config: { prefix: '/4otig/', scramjetPath: aliases['/scramjet/scramjet.js'], injectPath: aliases['/controller/controller.inject.js'], wasmPath: aliases['/scramjet/scramjet.wasm'], virtualWasmPath: 'engine.wasm.js', codec: { encode: value => encodeURIComponent(value), decode: value => decodeURIComponent(value) } },
      scramjetConfig: { flags: { captureErrors: false, cleanErrors: false, sourcemaps: false, allowFailedIntercepts: true } },
    });
    await controller.wait();
    controller.createFrame(document.getElementById('game')).go('https://fixture.test/start');
  }, { aliases, apiName: rewriteRuntimeNames('$scramjetController') });
  const frame = page.frameLocator('#game');
  await frame.locator('#run').click();
  await frame.locator('#result').filter({ hasText: '/next:test=yes' }).waitFor();
  assert(requests.includes(aliases['/controller/controller.inject.js']), 'Uses repository injection alias');
  assert.deepEqual(errors, []);
  console.log('PASS real compiled engine, worker, controller and repository injection: proxied script execution, cookies and history');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
