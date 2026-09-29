import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext();
 await context.route('http://drop.test/**',async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.startsWith('/api/'))return r.fulfill({json:{}});
  try {
   const file=resolve('dist','.'+path+(path.endsWith('/')?'index.html':''));
   if(!file.startsWith(resolve('dist')+'\\'))throw Error();
   await r.fulfill({body:await readFile(file),contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'});
  }catch {await r.fulfill({status:404,body:''});}
 });
 const p=await context.newPage();
 await p.goto('http://drop.test/apps/drop/',{waitUntil:'domcontentloaded'});
 const cover=p.locator('#studyready-startup');await cover.waitFor();
 await p.frameLocator('#studyready-startup').getByRole('heading',{name:'My courses',exact:true}).waitFor();
 const start=Date.now();await p.waitForTimeout(1000);assert(await cover.isVisible());
 await cover.waitFor({state:'detached'});assert(Date.now()-start>=1800);assert.equal(await p.title(),'Drop');assert(await p.locator('#query').isVisible());
 await p.reload({waitUntil:'domcontentloaded'});await cover.waitFor();
 await p.frameLocator('#studyready-startup').getByRole('heading',{name:'My courses',exact:true}).click();
 await p.waitForTimeout(3400);assert(await cover.isVisible());assert.equal(await cover.getAttribute('data-staying'),'true');
 console.log('PASS built Drop study screen, three-second reveal, title restore and interaction retains lessons');
} finally {await browser.close();}
