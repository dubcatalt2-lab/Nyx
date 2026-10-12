import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 for(const width of [1365,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();
  const failed=[];page.on('response',response=>{if(response.url().includes('/backgrounds/')&&response.status()>=400)failed.push(response.status()+' '+response.url());});
  await page.addInitScript(()=>{localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen','2026-10-02-nyx-1.6.8');});
  await page.goto((process.env.NYX_TEST_BASE_URL||'http://localhost:8080')+'/planner');
  const gotIt=page.getByRole('button',{name:'Got it',exact:true});if(await gotIt.isVisible())await gotIt.click();
  for(const family of ['moonrise','leaves','moonlight','rain','halloween']){
   const card=page.locator('[data-nyx-wallpaper-family="'+family+'"]');
   await card.scrollIntoViewIfNeeded();
   await card.locator('img').evaluate(image=>image.decode());
   assert(await card.locator('img').evaluate(image=>image.naturalWidth>0&&image.getBoundingClientRect().height>0));
   await card.click();
   const variant=page.locator('button[data-nyx-beam-wallpaper^="photo-'+family+'-"]').first();
   await variant.locator('img').evaluate(image=>image.decode());
   const selected=await variant.getAttribute('data-nyx-beam-wallpaper');
   await variant.click();
   await page.waitForFunction(value=>localStorage.getItem('nyx.beamWallpaper')===value&&document.documentElement.dataset.nyxBeamWallpaper===value,selected);
   await page.reload();
   await page.waitForFunction(value=>document.documentElement.dataset.nyxBeamWallpaper===value,selected);
   assert(await page.locator('[data-nyx-wallpaper-family="'+family+'"] .nyx-wallpaper-check').isVisible());
  }
  assert.deepEqual(failed,[]);
  console.log(`PASS ${width}px wallpaper previews: five photographs decode, styles select, applied choice survives reload, no failed image requests`);
  await context.close();
 }
}finally{await browser.close();}
