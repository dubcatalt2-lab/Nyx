import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
import vm from 'node:vm';
const source=await readFile(sourceFile('script.js'),'utf8');let quick;
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name==='quickTiles')quick=source.slice(n.start,n.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
visit(parse(source,{ecmaVersion:'latest'}));
for(const uid of ['other','3158eOj4ATMzkoC1PAm8H7TXc2R2']){
  const text=vm.runInNewContext(quick+';quickTiles()', {nyxGlobalApps:[],nyxFounderSignedInUser:{uid},esc:s=>s,globalAppIconMarkup:()=>''});
  assert.equal(text.includes('>VMs<'),true);
}
const app=express();app.use('/app',express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));
app.get('/',(_req,res)=>res.send(`<div id="status"></div><main id="screen"></main><script type="module">
import {loremDesktop} from '/app/apps/nyxcloud/lorem.js';
const scenario=new URLSearchParams(location.search).get('case');
window.calls=[];window.dispose=loremDesktop({screen:document.querySelector('#screen'),status:t=>document.querySelector('#status').textContent=t,connected:()=>{},api:async(path,method)=>{
 calls.push({path,method});
 if(path==='/lorem/vms'){
   if(scenario==='disposed')await new Promise(r=>setTimeout(r,100));
   return {vms:['existing','stopped','timed','revoked'].includes(scenario)?[{id:'one',state:scenario==='stopped'?'stopped':'running',url:'https://loremgroup.org/vm/fixture/'}]:[],queued:scenario==='queued',expiresAt:scenario==='timed'?Date.now()+2000:null};
 }
  if(path==='/lorem/create'||path==='/lorem/queue'){
   if(scenario==='revoked')return {status:'recovering',message:'This desktop assignment could not be verified.'};
   if(['waiting','outage','service-error'].includes(scenario)){
     if(scenario==='outage'&&path==='/lorem/queue'&&!window.retried){window.retried=true;throw Object.assign(Error('Temporary outage'),{status:503});}
     return {status:'queued',position:3,reason:scenario==='service-error'&&!window.serviceRecovered?'service_unavailable':'capacity'};
   }
   if(scenario==='recovering')return {status:'recovering',message:'Provider confirmation pending.'};
   return {status:'ready',vm:{url:'https://loremgroup.org/vm/fixture/'}};
 }
 return {};
}});
if(scenario==='disposed')dispose();
</script>`));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://loremgroup.org/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Fixture desktop</h1>'}));
  for(const scenario of ['new','existing','stopped','queued','disposed']){
    await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+scenario);
    if(scenario==='disposed'){
      await page.waitForTimeout(200);assert.equal(await page.locator('iframe').count(),0);
    }else{
      await page.locator('iframe').waitFor();assert.equal(await page.locator('iframe').getAttribute('src'),'https://loremgroup.org/vm/fixture/');
    }
    const calls=await page.evaluate(()=>window.calls);
    assert.equal(calls.filter(c=>c.path==='/lorem/create').length,scenario==='new'?1:0);
    assert.equal(calls.filter(c=>c.path==='/lorem/start/one').length,scenario==='stopped'?1:0);
    assert.equal(calls.filter(c=>c.path==='/lorem/queue').length,scenario==='queued'?1:0);
    assert(!(await page.locator('body').innerText()).includes('LoremGroup'));
    await page.evaluate(()=>dispose());
  }
  assert.deepEqual(errors,[]);
  for(const scenario of ['waiting','outage','service-error']){
    await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+scenario);
    if(scenario==='outage'){
      await page.getByText('Reconnecting to the queue. Your place is saved.',{exact:true}).first().waitFor();
      await page.getByRole('heading',{name:'You’re #3 in line'}).waitFor({timeout:15000});
    }else if(scenario==='service-error'){
      await page.getByRole('heading',{name:'Desktop service unavailable'}).waitFor();
      await page.evaluate(()=>{window.serviceRecovered=true;});
      await page.getByRole('heading',{name:'You’re #3 in line'}).waitFor({timeout:10000});
    }else await page.getByRole('heading',{name:'You’re #3 in line'}).waitFor();
    await page.getByRole('button',{name:'Leave queue'}).click();
    await page.getByRole('heading',{name:'You left the queue'}).waitFor();
    assert.equal(await page.locator('iframe').count(),0);
    assert.equal((await page.evaluate(()=>window.calls)).filter(c=>c.path==='/lorem/cancel').length,1);
    await page.evaluate(()=>dispose());
  }
  await page.clock.install();
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case=timed');
  await page.locator('iframe').waitFor();
  await page.clock.runFor(3100);
  assert.equal(await page.locator('iframe').count(),0);
  await page.getByRole('heading',{name:'Session ended',exact:true}).waitFor();
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case=revoked');
  await page.locator('iframe').waitFor();await page.clock.runFor(30100);
  assert.equal(await page.locator('iframe').count(),0);
  await page.getByText('This desktop assignment could not be verified.',{exact:true}).first().waitFor();
  console.log('PASS public VMs tile, automatic create/reuse/start/queue, stale-response cleanup, countdown expiry and revoked-assignment viewer removal');

}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
