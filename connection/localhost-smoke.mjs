import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {isolatedApplication} from './isolated-app.mjs';

const state=await mkdtemp(join(tmpdir(),'nyx-local-test-'));
const upstream=createServer((request,response)=>{
  if(request.url==='/data'){response.setHeader('content-type','application/json');response.end(JSON.stringify({cookie:request.headers.cookie||''}));return;}
  response.setHeader('content-type','text/html');response.end('<h1>Local document</h1>');
}).listen(0,'127.0.0.1');await once(upstream,'listening');
const service=isolatedApplication({suffix:'localhost',directory:state,protocol:'http:',resolveDestination:async value=>({url:new URL(new URL(value).pathname,'http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
const broker='http://documents.localhost:'+service.server.address().port;
const shell=createServer((_request,response)=>{response.setHeader('content-type','text/html');response.end('<iframe src="'+broker+'" style="width:100%;height:90vh"></iframe>');}).listen(0,'127.0.0.1');await once(shell,'listening');
const browser=await chromium.launch({channel:process.env.NYX_BROWSER_CHANNEL||(process.platform==='win32'?'chrome':undefined)});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:'+shell.address().port);
  const outer=page.frames().find(frame=>frame.url().startsWith(broker));
  // The real shell sends this only following its user's search submission.
  await page.evaluate(origin=>document.querySelector('iframe').contentWindow.postMessage({type:'document-prepare'},origin),broker);
  await outer.evaluate(()=>{location.hash=encodeURIComponent('https://fixture.example/');});
  await page.evaluate(origin=>document.querySelector('iframe').contentWindow.postMessage({type:'document-start',url:'https://fixture.example/',readyAt:Date.now()},origin),broker);
  let frame;
  for(let i=0;i<100;i++){frame=page.frames().find(value=>value.url().includes('/content/'));if(frame&&await frame.locator('h1').count())break;await page.waitForTimeout(50);}
  assert.equal(await frame.locator('h1').textContent(),'Local document');
  await frame.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await frame.evaluate(async()=>{document.cookie='localCookie=present; Path=/; Secure';return (await (await fetch(new Request('/data'))).json()).cookie;}),'localCookie=present');
  const cookies=await page.context().cookies();
  const session=cookies.find(value=>value.name==='__Secure_document'&&value.domain.startsWith('d-'));
  assert.ok(session,'Chrome must accept the local host-only session');assert.equal(session.httpOnly,true);assert.equal(session.secure,true);
  await frame.goto(frame.url());
  assert.equal(await frame.evaluate(async()=>{return (await (await fetch('/data')).json()).cookie;}),'localCookie=present');
  assert.deepEqual(errors,[]);
  console.log('PASS local isolated HTTP: host-only Secure/HttpOnly session accepted, worker tickets authorize data, cookies survive reload through localhost shell');
}finally{await browser.close();await service.close();service.server.closeAllConnections();upstream.closeAllConnections();shell.closeAllConnections();await Promise.all([new Promise(r=>service.server.close(r)),new Promise(r=>upstream.close(r)),new Promise(r=>shell.close(r))]);await rm(state,{recursive:true,force:true});}
