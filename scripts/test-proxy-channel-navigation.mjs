import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import {proxyAssetNames} from './build-proxy-assets.mjs';

const app=express(),root=process.env.NYX_TEST_BUILT==='1'?'dist':'.';
app.use((req,res,next)=>{res.set('Service-Worker-Allowed','/');next();});
app.use(express.static(root));app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
const html=`<!doctype html><html><head><title>Channels</title><style>body{background:#202225;color:white;font:16px sans-serif}a{display:block;color:cyan;padding:12px}</style></head><body>
<h1 id="channel">A</h1><textarea id="draft"></textarea><nav id="links"><a id="b" href="/channels/100/200">B</a><a id="c" href="/channels/100/300">C</a></nav><script src="/fixture.js"></script></body></html>`;
const fixture=`document.body.dataset.instance=String(Math.random());
document.getElementById('links').addEventListener('click',event=>{
 const link=event.target.closest('a');if(!link)return;event.preventDefault();
 try{history.pushState({key:link.id,state:{channel:link.id}},'',link.getAttribute('href'));}
 catch(error){document.body.dataset.historyError=error.name+': '+error.message;throw error;}
 document.getElementById('channel').textContent=link.textContent;
});
window.fixtureTransition=()=>{
 history.replaceState({channel:'C',loading:true},'',location.pathname+'?view=messages#latest');
 const body=document.body,nodes=[...body.childNodes];body.replaceChildren();
 setTimeout(()=>body.append(...nodes),6000);
};`;
const transport=`export default class {ready=false;async init(){this.ready=true}close(){}connect(){return [()=>{},()=>{}]}async request(raw){const script=new URL(String(raw)).pathname==='/fixture.js';return {status:200,statusText:'OK',headers:[['content-type',script?'text/javascript':'text/html']],body:new Response(script?${JSON.stringify(fixture)}:${JSON.stringify(html)}).body};}}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const brand of (process.env.NYX_TEST_BRANDS||'nyx,tutsi,drop').split(',')){
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
 await context.route(url=>paths.some(p=>url.pathname===p||url.pathname===proxyAssetNames[p]),r=>r.fulfill({contentType:'text/javascript',body:transport}));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 if(process.argv.includes('--debug')){page.on('framenavigated',f=>console.log('NAV',f.url()));page.on('console',m=>{if(m.type()==='error')console.log('ERROR',m.text().slice(0,300));});}
 await page.goto(base+(brand==='nyx'?'/index.html':'/apps/'+brand+'/'));await page.waitForTimeout(8500);
 assert.ok(await page.locator('svg rect[x="2"][y="6"][width="20"][height="13"]').count(),brand+' uses the requested rectangular Games controller');
 const query=page.locator(brand==='nyx'?'[data-browser-blank-input]:visible':'#query').first();
 await query.fill('https://discord.com/app');await query.press('Enter');
 const selector=brand==='nyx'?'.browser-body iframe.view.active':brand==='tutsi'?'#browser-stage iframe:not([hidden])':'#stage iframe:not([hidden])';
 const frame=page.frameLocator(selector);
 try{
  await frame.locator('#b').waitFor({timeout:25000});
  const instance=await frame.locator('body').getAttribute('data-instance');assert(instance);
  await frame.locator('#draft').fill('Keep this draft');
  await frame.locator('#b').click();
  assert.equal(await frame.locator('#channel').innerText(),'B');
  const address=page.locator(brand==='nyx'?'[data-browser-shell-url]:visible':'#address').first();
  await page.waitForTimeout(1000);
  assert.match(await address.inputValue(),/discord\.com\/channels\/100\/200/,'Shell address must follow the channel without navigation');
  await page.waitForTimeout(13000);
  assert.equal(await frame.locator('body').getAttribute('data-instance'),instance,'Channel switch must keep the same document');
  await frame.locator('#c').click();
  assert.equal(await frame.locator('#channel').innerText(),'C');
  assert.equal(await frame.locator('#draft').inputValue(),'Keep this draft');
  // A loading channel may temporarily clear its content without replacing the
  // document. The host must not interpret that as another startup failure.
  await frame.locator('body').evaluate(()=>window.fixtureTransition());
  await page.waitForTimeout(7000);
  assert.equal(await frame.locator('body').getAttribute('data-instance'),instance);
  assert.equal(await frame.locator('#draft').inputValue(),'Keep this draft');
  assert.match(await address.inputValue(),/channels\/100\/300\?view=messages#latest/);
  // A route update must not overwrite a new destination being typed.
  await address.fill('https://example.com/typing');
  await frame.locator('body').evaluate(()=>history.pushState({},'', '/channels/100/400'));
  await page.waitForTimeout(700);
  assert.equal(await address.inputValue(),'https://example.com/typing');
  assert.deepEqual(errors,[]);
  console.log('PASS',root,brand,'channel changes preserve document and draft');
 }catch(error){console.log(brand,errors,(await page.locator('body').innerText()).slice(-1500));throw error;}
 await context.close();
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
