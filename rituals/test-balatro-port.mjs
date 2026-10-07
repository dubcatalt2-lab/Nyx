import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import express from 'express';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {PNG}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
import {chromium} from 'playwright';

const root=process.env.NYX_TEST_STATIC_ROOT||'dist';
const manifest=JSON.parse(await readFile(`${root}/assets/games/games.json`,'utf8'));
assert(manifest.catalogs.some(c=>c.id==='bundled'));
const app=express();
app.use('/api',(_,res)=>res.json({enabled:false}));
app.use(express.static(root));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=process.env.NYX_TEST_ORIGIN||`http://127.0.0.1:${server.address().port}`;
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await workspace.newContext({viewport:{width:1200,height:850}}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==new URL(base).origin){external.push(url.href);return route.abort();}
    if(url.pathname.endsWith('/assets/games/games.json'))return route.fulfill({json:{...manifest,catalogs:manifest.catalogs.filter(c=>c.id==='bundled')}});
    return route.continue();
  });
  await page.goto(base+'/assets/games/');
  await page.locator('#gameSearch').fill('Balatro');
  const card=page.locator('[data-game-key="balatro"]');
  await card.waitFor();
  assert.equal(await card.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0),true);
  await card.click();
  const canvas=page.frameLocator('#gameFrame').locator('#canvas');
  await canvas.waitFor({state:'visible',timeout:60000});
  const game=page.frames().find(frame=>frame.url().includes('/assets/vendor/balatro/index.html'));
  assert(game,'The catalog must open the local game');
  await game.waitForFunction(()=>window.Module?.calledRun&&Module.remainingDependencies===0);
  await page.locator('#playerLoading').waitFor({state:'hidden'});
  await game.evaluate(()=>{window.nyxUnexpectedUnload=0;window.addEventListener('beforeunload',()=>window.nyxUnexpectedUnload++);});
  await canvas.click({position:{x:600,y:350}});
  await page.waitForTimeout(18000);
  assert.equal(await game.evaluate(()=>window.nyxUnexpectedUnload),0,'Autosave must not dispatch unload events into the engine');
  const checkRendered=async()=>{
    const picture=PNG.sync.read(await canvas.screenshot());let colored=0;
    for(let pixel=0;pixel<picture.data.length;pixel+=4){const [r,g,b]=picture.data.subarray(pixel,pixel+3);if(Math.max(r,g,b)-Math.min(r,g,b)>30)colored++;}
    assert(colored>picture.width*picture.height*.1,'The game must keep rendering instead of turning white');
  };
  await checkRendered();
  await page.mouse.click(420,695);
  await page.waitForTimeout(5000);
  await page.mouse.click(1080,660);
  await page.waitForTimeout(1500);
  await page.mouse.click(418,345);
  await page.waitForTimeout(5000);
  await page.mouse.click(1080,660);
  await page.waitForTimeout(1000);
  await page.mouse.click(350,570);
  await page.mouse.click(505,705);
  await page.waitForTimeout(5000);
  await checkRendered();
  await game.evaluate(()=>Module.nyxPersistSaves());
  const savedFiles=()=>game.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('/home/web_user/love');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{return await new Promise((resolve,reject)=>{const request=db.transaction('FILE_DATA').objectStore('FILE_DATA').getAllKeys();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
  });
  let files=[];
  for(let attempt=0;attempt<90;attempt++){files=await savedFiles();if(files.some(file=>String(file).endsWith('.jkr')))break;await page.waitForTimeout(500);}
  await page.screenshot({path:'.codex-artifacts/balatro-catalog.png'});
  console.log('Saved game paths:',files);
  assert(files.some(file=>String(file).endsWith('/save.jkr')),'Starting and playing a run must persist its save file');
  await page.screenshot({path:'.codex-artifacts/balatro-catalog.png'});
  await page.locator('#reloadGame').click();await page.locator('#playerLoading').waitFor({state:'hidden',timeout:60000});await canvas.waitFor({state:'visible',timeout:60000});
  await page.waitForTimeout(18000);await checkRendered();
  const restored=await savedFiles();
  for(const file of files)assert(restored.includes(file),'Save path survives reload: '+file);
  await page.locator('#closePlayer').click();
  assert.equal(await page.locator('#gamePlayer').isVisible(),false);
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[],'The bundled game must not need outside game, ad or analytics hosts');
  console.log('PASS Balatro catalog, local cover/runtime, input, IndexedDB saves/reload and close; no external requests or page errors.');
  await context.close();
}finally{await workspace.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
