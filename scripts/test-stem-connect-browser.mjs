import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {parse} from 'acorn';
import {rewriteProxyReferences} from './build-proxy-assets.mjs';
import {rewriteRuntimeNames} from './build-runtime-names.mjs';
import {rewriteFrontendReferences} from './build-frontend-assets.mjs';
const proxy=JSON.parse(await readFile('dist/proxy-assets.json','utf8')).aliases;
const frontend=JSON.parse(await readFile('dist/frontend-assets.json','utf8')).aliases;
const app=express();
const source=await readFile('script.js','utf8'),parts=[];
function visit(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='FunctionDeclaration'&&['installUltraviolet','waitForServiceWorkerScript'].includes(node.id?.name))parts.push(source.slice(node.start,node.end));
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(parse(source,{ecmaVersion:'latest'}));assert.equal(parts.length,2);
let installer='let uvInstallPromise=null,uvRegistration=null;async function installBareMuxTransport(){}\n'+parts.join('\n')+'\nglobalThis.runStemInstall=installUltraviolet;';
installer=rewriteFrontendReferences(rewriteRuntimeNames(rewriteProxyReferences(installer,'/script.js')),'/script.js',frontend);
app.get('/installer.js',(_req,res)=>res.type('text/javascript').send(installer));
app.get('/study-fixture.js',(_req,res)=>res.type('text/javascript').send('self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));'));
app.get('/fixture',(_req,res)=>res.send('<!doctype html><title>STEM Connect test</title><iframe id="view"></iframe>'));
app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
 await page.evaluate(async({proxy,frontend})=>{
  const {BareMuxConnection}=await import(proxy['/baremux/index.mjs']);
  const connection=new BareMuxConnection(proxy['/baremux/worker.js']);
  await connection.setManualTransport(`return [class {
    ready=false; async init(){this.ready=true}
    async request(url){
      const script=String(url).endsWith('/app.js');
      const html='<!doctype html><title>Fixture</title><h1>STEM page loaded</h1><button id="count">0</button><a id="next" href="/next">Next</a><script src="/app.js"><\\/script>';
      const code='document.getElementById("count").onclick=()=>{document.getElementById("count").textContent="1";document.cookie="lesson=yes; Path=/"};';
      return {status:200,statusText:'OK',headers:{'content-type':script?'text/javascript':'text/html'},body:new Response(script?code:html).body};
    }
  },'stem-fixture'];`,[]);
  window.addEventListener('message',event=>{
    if(event.data?.type!=='getPort'||!event.data.port)return;
    const worker=new SharedWorker(proxy['/baremux/worker.js'],'ridgewood-stem-worker');
    event.data.port.postMessage(worker.port,[worker.port]);
  });
  // An existing StudyJet-scope registration must not be confused with UV.
  await navigator.serviceWorker.register('/study-fixture.js',{scope:'/~/study/'});
  for(const path of ['/installer.js']){
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=resolve;s.onerror=reject;document.head.append(s);});
  }
  const outcomes=await Promise.all([runStemInstall(),runStemInstall()]);
  if(outcomes.some(value=>!value))throw Error('STEM installer failed');
  if(!window.StemConnect||window.Ultraviolet)throw Error('Runtime branding mismatch');
  const registration=await navigator.serviceWorker.getRegistration('/service/');
  if(!registration.active.scriptURL.includes(frontend['/stem-connect.sw.js']))throw Error('Incorrect worker path');
  const study=await navigator.serviceWorker.getRegistration('/~/study/');
  if(!study.active?.scriptURL.endsWith('/study-fixture.js'))throw Error('StudyJet registration changed');
  document.getElementById('view').src='/service/'+window.__uv$config.encodeUrl('https://fixture.example/start');
 },{proxy,frontend});
 const frame=page.frameLocator('#view');await frame.getByRole('heading',{name:'STEM page loaded'}).waitFor();
 await frame.locator('#count').click();assert.equal(await frame.locator('#count').innerText(),'1');
 assert.match(await frame.locator('body').evaluate(()=>document.cookie),/lesson=yes/);
 await frame.locator('#next').click();await frame.getByRole('heading',{name:'STEM page loaded'}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS built STEM Connect: renamed runtime + worker activation, HTML and script rewriting, interaction, cookies and link navigation');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
