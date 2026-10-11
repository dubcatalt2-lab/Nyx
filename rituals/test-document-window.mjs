import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import {application} from '../connection/app.mjs';

const upstream=createServer((_request,response)=>{
  response.setHeader('content-type','text/html');
  response.end('<!doctype html><html><head><title>Connected lesson</title></head><body><h1>Connected lesson</h1><a href="/next">Next lesson</a></body></html>');
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const service=application({resolveDestination:async()=>({url:new URL('http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
service.listen(0,'127.0.0.1');await once(service,'listening');
const documentOrigin='http://127.0.0.1:'+service.address().port;
let sockets=0;
service.on('upgrade',()=>sockets++);
const shell=createServer(async(request,response)=>{
  if(request.url==='/document-window.mjs'){
    response.setHeader('content-type','application/javascript');
    response.end(await readFile(new URL('../parables/document-window.mjs',import.meta.url)));
    return;
  }
  response.setHeader('content-type','text/html');
  response.end(`<!doctype html><link rel="icon" href="data:,"><button id="launch">Lesson</button><iframe title="Lesson window"></iframe><script type="module">import {openDocument} from './document-window.mjs';localStorage.setItem('account-fixture','private-value');document.querySelector('button').onclick=()=>openDocument(document.querySelector('iframe'),'https://lesson.test/',{onNavigate:next=>document.body.dataset.address=next.url,config:{documentOrigin:${JSON.stringify(documentOrigin)}}});</script>`);
});
shell.listen(0,'127.0.0.1');await once(shell,'listening');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+shell.address().port);
  await page.waitForTimeout(5500);
  assert.equal(sockets,0);
  const clicked=Date.now();
  await page.locator('#launch').click();
  const window=page.frameLocator('iframe');
  await window.locator('html.embedded').waitFor();
  assert.equal(await window.locator('form').count(),0);
  assert.equal(await window.locator('output').count(),0);
  const lesson=window.frameLocator('iframe');
  await lesson.getByRole('heading',{name:'Connected lesson'}).waitFor({timeout:20000});
  assert(Date.now()-clicked<1900);
  assert(sockets>0);
  const access=await lesson.locator('body').evaluate(()=>{
    let parentBlocked=false;
    try{void top.localStorage.getItem('account-fixture');}catch{parentBlocked=true;}
    return {parentBlocked,own:localStorage.getItem('account-fixture')};
  });
  assert.deepEqual(access,{parentBlocked:true,own:null});
  await lesson.getByRole('link',{name:'Next lesson'}).click();
  await page.waitForFunction(()=>document.body.dataset.address==='https://lesson.test/next');
  assert.deepEqual(errors,[]);
  console.log('PASS Nyx document launch: separate origin, URL handoff, rendered response and navigation feedback');
  console.log('PASS no socket before shell click; single-click launch without a second form; no artificial startup delay');
  console.log('PASS remote content cannot read the account origin storage; no page errors');
}finally{
  await browser.close();
  for(const server of [shell,service,upstream]){server.closeAllConnections();server.close();}
}
