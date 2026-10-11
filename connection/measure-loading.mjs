import {application} from './app.mjs';
import {createServer, get} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const upstream=createServer((_request,response)=>{response.setHeader('content-type','text/html');response.end('<!doctype html><title>Lesson</title><h1>Lesson loaded</h1>');});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const app=application({resolveDestination:async()=>({url:new URL('http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
app.listen(0,'127.0.0.1');await once(app,'listening');
const origin='http://127.0.0.1:'+app.address().port;
function resource(path,headers){return new Promise((resolve,reject)=>{get(origin+path,{headers},response=>{let bytes=0;response.on('data',chunk=>bytes+=chunk.length);response.on('end',()=>resolve({status:response.statusCode,bytes,headers:response.headers}));}).on('error',reject);});}
let browser;
try{
  const resources=[];
  for(const path of ['/boot/client.js','/boot/start.js','/boot/runtime.js']){
    const plain=await resource(path,{'accept-encoding':'identity'});
    const compressed=await resource(path,{'accept-encoding':'br,gzip'});
    const repeat=await resource(path,{'accept-encoding':'br,gzip',...(compressed.headers.etag?{'if-none-match':compressed.headers.etag}:{})});
    resources.push({path,plainBytes:plain.bytes,transferBytes:compressed.bytes,repeatBytes:repeat.bytes,repeatStatus:repeat.status,encoding:compressed.headers['content-encoding']||'identity'});
  }
  console.log(JSON.stringify({resources,totals:{plain:resources.reduce((n,r)=>n+r.plainBytes,0),transfer:resources.reduce((n,r)=>n+r.transferBytes,0),repeat:resources.reduce((n,r)=>n+r.repeatBytes,0)}},null,2));
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{})});
  const samples=[];
  for(let sample=0;sample<3;sample++){
    const context=await browser.newContext();
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const session=await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:1250000,uploadThroughput:1250000});
    for(const state of ['cold','warm']){
      await page.goto(origin);
      await page.locator('input').fill('https://fixture.test/');
      const start=performance.now();
      await page.getByRole('button',{name:'Open',exact:true}).click();
      await page.frameLocator('iframe').getByRole('heading',{name:'Lesson loaded',exact:true}).waitFor();
      samples.push({state,milliseconds:Math.round(performance.now()-start)});
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
  const median=state=>samples.filter(s=>s.state===state).map(s=>s.milliseconds).sort((a,b)=>a-b)[1];
  console.log(JSON.stringify({conditions:'Chrome; page network emulation 40ms latency / 10Mbps; local deterministic upstream; 3 fresh contexts',samples,medianColdMs:median('cold'),medianWarmMs:median('warm'),consoleErrors:0},null,2));
}finally{await browser?.close();app.closeAllConnections();app.close();upstream.closeAllConnections();upstream.close();}
