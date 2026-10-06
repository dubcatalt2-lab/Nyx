import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {proxyAssetNames} from './build-intercession-assets.mjs';
const root=process.env.NYX_TEST_BUILT==='1'?'dist':'.',app=express();
app.use((req,res,next)=>{res.set('Service-Worker-Allowed','/');next();});
app.use(express.static(root));app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
const aliases=root==='dist'?JSON.parse(await readFile(sourceFile('dist/frontend-assets.json'),'utf8')).aliases:{};
const browser=await chromium.launch({channel:'msedge'});
try{for(const brand of (process.env.NYX_TEST_BRANDS||'tutsi,drop,nyx').split(',')){
 const context=await browser.newContext();
 await context.addInitScript(()=>{
 localStorage.setItem('tutsi.customize.seen','1');localStorage.setItem('tutsi.settings.v1',JSON.stringify({closePrevention:false,httpBridge:true,transport:'epoxy'}));
 localStorage.setItem('drop.setupComplete','1');localStorage.setItem('drop.settings',JSON.stringify({connection:'bridge',restore:false}));
 localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-26-nyx-1.3.6.7.seen','2026-09-26-nyx-1.3.6.7');localStorage.setItem('nyx.browserMode','scramjet');localStorage.setItem('nyx.transport','epoxy');
 });
 await context.route('**/api/**',r=>r.fulfill({json:{}}));
 await context.route('**/api/tutsi-relay/sessions',r=>r.fulfill({json:{token:'fixture'}}));
 await context.route('**/api/tutsi-relay/receive',r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from([9,0,0,0,3,0,0,0,0,10,0,0,0])}));
 const paths=['/assets/transports/epoxy-scramjet.mjs','/assets/transports/libcurl-scramjet.mjs'];
 await context.route(url=>paths.some(p=>url.pathname===p||url.pathname===proxyAssetNames[p]),r=>r.fulfill({contentType:'text/javascript',body:`let created=0,empty=0;export default class {ready=false;generation=++created;async init(){this.ready=true}close(){}connect(){return [()=>{},()=>{}]}async request(raw){if(this.generation===1)throw Error('Wisp connection closed');const url=new URL(String(raw));const blank=url.pathname==='/empty'&&++empty===1;if(url.pathname==='/missing.css')return {status:200,headers:[['content-type','text/css']],body:new Response('').body};const consent='<!doctype html><title>Cookies</title><link rel=stylesheet href=/missing.css><button onclick="this.textContent=String(Date.now())">Accept cookies</button><p>Choose your cookie preferences before continuing. If something went wrong, contact our support team for assistance.</p><script type=application/json>"Internal service worker error"</script>';return {status:200,statusText:'OK',headers:[['content-type','text/html']],body:new Response(blank?'<!doctype html><body></body>':url.pathname==='/consent'?consent:'<!doctype html><title>Recovered</title><h1>'+url.pathname+'</h1>').body};}}`}));
 if(brand!=='nyx')await context.route(url=>url.pathname==='/apps/tutsi/frame-navigation.mjs'||url.pathname===aliases['/apps/tutsi/frame-navigation.mjs'],async r=>{const text=await readFile(sourceFile('apps/tutsi/frame-navigation.mjs'),'utf8');await r.fulfill({contentType:'text/javascript',body:text.replace('timeoutMs=25000','timeoutMs=2000')});});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+(brand==='nyx'?'/index.html':'/apps/'+brand+'/'));await page.waitForTimeout(8500);
 const query=page.locator(brand==='nyx'?'[data-browser-blank-input]:visible':'#query').first();
 assert.match(await query.getAttribute('placeholder'),/S3ARC4/);
 await query.fill('https://fixture.test/recovered');await query.press('Enter');
 const selector=brand==='nyx'?'.browser-body iframe.view.active':brand==='tutsi'?'#browser-stage iframe:not([hidden])':'#stage iframe:not([hidden])';
 const frame=()=>page.frameLocator(selector);
 try{await frame().getByRole('heading',{name:'/recovered',exact:true}).waitFor({timeout:25000});}catch(e){console.log(brand,'errors',errors,'body',(await page.locator('body').innerText()).slice(-600));throw e;}
 if(brand!=='nyx'){
  const address=page.locator('#address');await address.fill('https://fixture.test/empty');await address.press('Enter');
  const retry=brand==='tutsi'?page.locator('.browser-status:visible button'):page.locator('#retryPage');
  await frame().getByRole('heading',{name:'/empty',exact:true}).waitFor({timeout:15000});assert.equal(await retry.isVisible(),false,'Recovery must not require a retry page');
  await page.locator('#reload').click();await frame().getByRole('heading',{name:'/empty',exact:true}).waitFor();
 }
 if(brand==='nyx'){
  const address=page.locator('[data-browser-shell-url]:visible').first();await address.fill('https://fixture.test/consent');await address.press('Enter');
  const accept=frame().getByRole('button',{name:'Accept cookies'});await accept.waitFor();
  await frame().locator('body').evaluate(body=>body.dataset.instance='preserve');
  await page.waitForTimeout(13000);
  assert.equal(await frame().locator('body').getAttribute('data-instance'),'preserve','Consent screen must not reload before acceptance');
  await accept.click();const accepted=await frame().locator('button').innerText();
  await page.waitForTimeout(9000);assert.equal(await frame().locator('button').innerText(),accepted,'Acceptance must survive recovery timers');
 }
 assert.deepEqual(errors,[]);console.log('PASS',brand,'stale connection recovered; labels work; automatic empty-page recovery and reload checked where applicable');
 await context.close();
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
