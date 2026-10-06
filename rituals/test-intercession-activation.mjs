import {sourceFile} from '../scripture/source-layout.mjs';
﻿import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const source=await readFile(sourceFile('script.js'),'utf8');
const start=source.indexOf('async function waitForServiceWorkerScript('),end=source.indexOf('async function refreshScramjetServiceWorker(',start);
assert(start>0&&end>start);
const server=createServer((req,res)=>{
 if(req.url.startsWith('/worker.js')){
  res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');
  const slow=req.url.includes('version=two');
  return res.end(`self.addEventListener('install',event=>event.waitUntil(new Promise(resolve=>setTimeout(resolve,${slow?15000:0})).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>event.respondWith(new Response('Connected',{headers:{'Content-Type':'text/html'}})));`);
 }
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Activation test</title>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 await page.addScriptTag({content:source.slice(start,end)});
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/worker.js?version=one',{scope:'/proxy/'});});
 await page.evaluate(async()=>{
  const until=Date.now()+10000;
  while((await navigator.serviceWorker.getRegistration('/proxy/'))?.active?.state!=='activated'){
   if(Date.now()>until)throw Error('Initial worker did not activate');
   await new Promise(r=>setTimeout(r,30));
  }
 });
 const result=await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.register('/worker.js?version=two',{scope:'/proxy/'});
  const began=performance.now();const usable=await waitForServiceWorkerScript(registration,'/worker.js?version=two','/proxy/');
  return {elapsed:Math.round(performance.now()-began),worker:usable?.scriptURL||null,previous:registration.active?.scriptURL,previousState:registration.active?.state};
 });
 console.log(result);
 assert(result.worker,'An activated compatible worker should keep browsing available while its update installs');
 assert(result.elapsed<1000,'Existing worker must be usable immediately');
 await page.evaluate(async()=>{
  const until=Date.now()+20000;
  while(true){
   const active=(await navigator.serviceWorker.getRegistration('/proxy/'))?.active;
   if(active?.state==='activated'&&active.scriptURL.includes('version=two'))break;
   if(Date.now()>until)throw Error('Replacement worker did not activate');
   await new Promise(r=>setTimeout(r,30));
  }
 });
 assert.match(await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/proxy/');return (await waitForServiceWorkerScript(r,'/worker.js?version=two','/proxy/'))?.scriptURL||'';}),/version=two/);
 console.log('PASS real service-worker update: current compatible worker stays usable while a slow update activates, then switches to the new worker.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
