import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
let requests=0;
const source=readFileSync('js/proxy-startup.mjs');
const server=createServer((req,res)=>{
  if(req.url==='/loader.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(source)}
  if(req.url==='/engine.js'){requests++;res.setHeader('Content-Type','text/javascript');if(requests===1){res.statusCode=503;return res.end('')}return res.end('window.engineReady=true')}
  if(req.url==='/incomplete.js'){res.setHeader('Content-Type','text/javascript');return res.end('void 0')}
  res.end('<!doctype html><title>Startup fixture</title>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{window.loader=await import('/loader.mjs');await Promise.all(Array.from({length:20},()=>loader.loadProxyScript('/engine.js',()=>window.engineReady)));});
  assert.equal(requests,2,'Concurrent startup shares one bounded retry after a failed script');
  assert.equal(await page.locator('script[src="/engine.js"]').count(),1,'Failed script removed');
  const incomplete=await page.evaluate(async()=>{try{await loader.loadProxyScript('/incomplete.js',()=>false)}catch(e){return e.message}});
  assert.match(incomplete,/incomplete/);assert.equal(await page.locator('script[src="/incomplete.js"]').count(),0);
  await page.evaluate(async()=>{await loader.waitForProxyController({wait:()=>new Promise(r=>setTimeout(r,5500))});});
  assert.match(await page.evaluate(async()=>{try{await loader.waitForProxyController({wait:()=>new Promise(()=>{})},25)}catch(e){return e.message}}),/too long/);
  console.log('PASS shared proxy startup: script failure recovery, deduplication, cleanup, slow controller and bounded timeout.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
