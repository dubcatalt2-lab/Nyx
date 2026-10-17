import {chromium} from 'playwright';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
process.env.NYX_STATIC_ROOT=new URL('../dist/',import.meta.url).pathname.replace(/^\/(.:\/)/,'$1');
const {app}=await import('../server.js');
const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage();const drop=[],errors=[];
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/apps/drop/'))drop.push(r.url())});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/apps/agents/');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.locator('#login').waitFor({state:'visible'});
 assert.equal((await page.locator('#authTitle').innerText()).normalize('NFKC'),'Sign in');
 await page.locator('#authSwitch').click();
 assert.equal((await page.locator('#authTitle').innerText()).normalize('NFKC'),'Create an account');
 assert.equal(drop.length,0,'Active Agents must not load retired Drop assets');
 assert.deepEqual(errors,[]);
 await page.goto(origin+'/assets/gn-math/');await page.waitForTimeout(1500);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Game catalog overflow at '+width)}
 const thumbs=await page.request.get(origin+'/assets/ugs/thumbs.json');assert.equal(thumbs.status(),200);assert(Array.isArray(await thumbs.json()));
 const missing=[];page.on('response',r=>{if(r.status()===404&&r.url().includes('background'))missing.push(r.url())});
 await page.goto(origin+'/apps/tutsi/profiles.html');await page.waitForTimeout(1500);assert.deepEqual(missing,[]);
 console.log('PASS built Agents sign-in UI without retired imports, catalog desktop/mobile sizing, thumbnails manifest and profile background');
}finally{await browser.close();await new Promise(r=>server.close(r));}
