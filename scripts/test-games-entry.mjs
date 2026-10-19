import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import express from 'express';
import {chromium} from 'playwright';
import {buildFrontendAssets,unpackPublishedDocument} from './build-frontend-assets.mjs';
const root=await mkdtemp(join(tmpdir(),'nyx-entry-'));
let server,browser;
try{
 await mkdir(join(root,'assets/games'),{recursive:true});
 for(const name of ['@r7e41c902d6a8!.webp','@r2c98b170f4e3!.webp'])await copyFile(new URL('../assets/games/'+name,import.meta.url),join(root,'assets/games',name));
 await writeFile(join(root,'proxy-assets.json'),JSON.stringify({aliases:{}}));
 await writeFile(join(root,'assets/games/index.html'),'<!doctype html><title>Games</title><main id="catalog">Game catalog</main><script type="module" src="/assets/games/games.js"></script>');
 await writeFile(join(root,'assets/games/games.js'),'document.body.dataset.ready="yes";');
 await buildFrontendAssets(root,['assets/games/index.html','assets/games/games.js'],'');
 const aliases=JSON.parse(await readFile(join(root,'frontend-assets.json'),'utf8')).aliases;
 const renamed=aliases['/assets/games/index.html'];assert.match(renamed,/\/@r[a-f0-9]+!\.html$/);
 const pages=JSON.parse(await readFile(join(root,'published-pages.json'),'utf8')).pages;
 assert((await unpackPublishedDocument(root,pages['assets/games/index.html'])).includes(aliases['/assets/games/games.js']));
 const app=express();app.get('/missing-harness',(_req,res)=>res.type('html').send('<!doctype html><body></body>'));app.use(express.static(root));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome'});
 for(const [path,width] of [['/assets/games/',1280],[renamed,390]]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto(base+path+'?collection=all#saved',{waitUntil:'load'});
  await page.getByRole('heading',{name:'Learning Library'}).waitFor();assert.equal(await page.locator('#catalog').count(),0);
  assert(await page.locator('img').evaluateAll(images=>images.length===2&&images.every(img=>img.complete&&img.naturalWidth>0)));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.codex-artifacts/cover-'+width+'.png',fullPage:true});
  await page.clock.runFor(950);assert.equal(await page.locator('#catalog').count(),0);assert(!requests.some(u=>u.includes(aliases['/assets/games/games.js'])));
  await page.clock.runFor(150);await page.locator('body[data-ready=yes]').waitFor();assert.equal(await page.title(),'Games');
  assert.equal(new URL(page.url()).pathname,renamed);assert.equal(new URL(page.url()).search,'?collection=all');assert.equal(new URL(page.url()).hash,'#saved');assert.deepEqual(errors,[]);await page.close();
 }
 const hidden=await browser.newPage();await hidden.goto(base+'/missing-harness');
 await hidden.setContent('<iframe style="display:none" src="'+base+'/assets/games/"></iframe>');
 const frame=hidden.frameLocator('iframe');await hidden.waitForTimeout(1400);
 assert.equal(await frame.locator('#catalog').count(),0);
 await hidden.locator('iframe').evaluate(el=>el.style.display='block');
 await frame.getByRole('heading',{name:'Learning Library'}).waitFor();
 await hidden.waitForTimeout(700);assert.equal(await frame.locator('#catalog').count(),0);
 await frame.locator('#catalog').waitFor();await hidden.close();
 console.log('PASS hidden/preloaded frame retains cover until one visible second');
 console.log('PASS educational cover, delayed catalog/runtime, renamed entry, legacy URL, preserved query/hash and encoded payload');
}finally{await browser?.close();server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
