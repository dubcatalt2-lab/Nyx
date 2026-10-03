import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.TUTSI_TEST_URL||'http://localhost:9091/tutsi';
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.goto(base+'#settings',{waitUntil:'domcontentloaded'});
 const cover=page.locator('#studyready-startup');
 await cover.waitFor();
 await page.frameLocator('#studyready-startup').getByRole('heading',{name:'My courses',exact:true}).waitFor();
 const started=Date.now();
 await page.waitForTimeout(1500);
 assert(await cover.isVisible());
 await cover.waitFor({state:'detached',timeout:7000});
 assert(Date.now()-started>=2500,'Cover dismissed too soon');
 assert.equal(new URL(page.url()).hash,'#settings');
 assert(!await page.locator('html').evaluate(el=>el.classList.contains('startup-covered')));
 await page.reload({waitUntil:'domcontentloaded'});
 await cover.waitFor();
 await cover.waitFor({state:'detached',timeout:9000});
 const fresh=await browser.newPage({viewport:{width:390,height:844}});
 await fresh.goto(base,{waitUntil:'domcontentloaded'});
 await fresh.locator('#studyready-startup').waitFor();
 assert(!await fresh.locator('#customize-dialog').evaluate(el=>el?.open||false));
 await fresh.locator('#studyready-startup').waitFor({state:'detached',timeout:9000});
 await fresh.waitForFunction(()=>document.querySelector('dialog[open]'));
 assert(!await fresh.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
 for(const action of ['click','keyboard','scroll','touch']) {
   const interactive=await browser.newPage({hasTouch:action==='touch'});
   await interactive.clock.install();
   await interactive.goto(base,{waitUntil:'domcontentloaded'});
   const study=interactive.frameLocator('#studyready-startup');
   await study.getByRole('heading',{name:'My courses',exact:true}).waitFor();
   const search=study.getByRole('searchbox',{name:'Find a skill'});
   if(action==='click') await study.getByRole('link',{name:'Lesson',exact:true}).first().click();
   if(action==='keyboard'){await search.focus();await interactive.keyboard.type('linear');}
   if(action==='scroll'){await study.getByRole('heading',{name:'My courses',exact:true}).hover();await interactive.mouse.wheel(0,300);}
   if(action==='touch')await search.tap();
   await interactive.waitForFunction(()=>document.querySelector('#studyready-startup')?.dataset.staying==='true');
   await interactive.clock.runFor(10000);
   assert(await interactive.locator('#studyready-startup').isVisible(),action+' failed to retain StudyReady');
   assert(!await interactive.locator('#customize-dialog').evaluate(el=>el.open));
   await interactive.close();
 }
 console.log('PASS: StudyReady lessons, four-second startup, reload, preserved route, mobile and wizard sequencing');
}finally{await browser.close()}

