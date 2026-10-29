import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();
app.get('/existing-worker.js',(_req,res)=>res.type('js').send('self.addEventListener("install",()=>self.skipWaiting());'));
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try {
 const context=await browser.newContext();
 // Isolate transport delivery; run the real document processor and service worker.
 await context.route('**/assets/vendor/r7f29c1/x9K2m.js', route=>route.fulfill({contentType:'text/javascript',body:`globalThis.W1I41={W1I41Connection:class {async setzIWyC(path,args){globalThis.launchParameters={path,args};}}};`}));
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>{errors.push(error.message);});
 await page.goto(base+'/apps/r7f29c1/');
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.register('/existing-worker.js',{scope:'/preserved/'});await new Promise(resolve=>{const w=r.installing||r.active;if(w.state==='activated')return resolve();w.addEventListener('statechange',()=>w.state==='activated'&&resolve());});});
 await page.getByRole('textbox',{name:'Website address'}).fill('javascript:alert(1)');
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.getByRole('status',{name:'Enter an http or https website address.',exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(rs=>rs.length))),1);
 await page.getByRole('textbox',{name:'Website address'}).fill('https://example.com/test');
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.getByRole('status',{name:'Website opened.',exact:true}).waitFor();
 const registrations=await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>r.scope)));
 assert(registrations.includes(base+'/preserved/'));
 assert(registrations.includes(base+'/apps/r7f29c1/'));
 assert(!registrations.includes(base+'/'));
 const parameters=await page.evaluate(()=>launchParameters);
 assert.equal(parameters.args[0].WeZaN,base.replace('http:','ws:')+'/resources/live/');
 assert.match(await page.locator('iframe').getAttribute('src'),/^\/apps\/r7f29c1\/view\//);
 await page.reload();await page.getByRole('textbox',{name:'Website address'}).fill('example.org');await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.getByRole('status',{name:'Website opened.',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS alternate view: URL validation, worker coexistence, selected endpoint setup, reopen. Transport delivery mocked.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
