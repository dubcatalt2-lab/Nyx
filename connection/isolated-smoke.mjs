import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {createServer as httpsServer} from 'node:https';
import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync,fork} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {isolatedApplication} from './isolated-app.mjs';
import {partition,digest} from './partition.mjs';
import {route} from './address.mjs';

for(const value of ['','abc','https://example.com','https://a.example:443','a'.repeat(500)])assert.equal(digest(value),createHash('sha256').update(value).digest('hex'));
const temporary=await mkdtemp(join(tmpdir(),'document-isolation-'));
const key=join(temporary,'key.pem'),cert=join(temporary,'cert.pem');
const openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl';
const generated=spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=nyx.test'],{encoding:'utf8',env:{...process.env,MSYS_NO_PATHCONV:'1'}});
assert.equal(generated.status,0,generated.stderr);
const requests=[];
const upstream=httpServer((request,response)=>{
 const url=new URL(request.url,'http://fixture');requests.push({path:url.pathname,cookie:request.headers.cookie||'',origin:request.headers.origin||''});
 if(url.pathname==='/a'||url.pathname==='/b'){
  const label=url.pathname.slice(1);response.setHeader('content-type','text/html');response.setHeader('set-cookie','secret='+label+'; Path=/; Secure; HttpOnly; SameSite=None');
  response.end('<!doctype html><h1>'+label+'</h1><a href="https://'+(label==='a'?'b':'a')+'.example/'+(label==='a'?'b':'a')+'">Next</a><button onclick="window.open(\'/login\',\'signin\')">Sign in</button><button onclick="window.open(\'https://b.example/login\',\'provider\')">Provider</button><script>localStorage.setItem("site","'+label+'");globalThis.ready=true;globalThis.blocked=window.open("/unwanted")===null;addEventListener("message",e=>{if(e.origin==="https://b.example"&&e.data==="signed-in"){globalThis.callback=e.data;e.source.postMessage("received",e.origin)}});</script>');return;
 }
 if(url.pathname==='/delayed'){response.setHeader('content-type','text/html');response.end('<h1>Waiting</h1><link rel="stylesheet" href="/color.css"><script src="/ready.js"></script>');return;}
 if(url.pathname==='/color.css'){response.setHeader('content-type','text/css');response.end('h1{color:rgb(0,128,0)}');return;}
 if(url.pathname==='/ready.js'){response.setHeader('content-type','text/javascript');response.end('document.querySelector("h1").textContent="Loaded"');return;}
 if(url.pathname==='/cookies'){response.setHeader('content-type','application/json');response.end(JSON.stringify({cookie:request.headers.cookie||''}));return;}
 if(url.pathname==='/cors'){response.setHeader('access-control-allow-origin','https://a.example');response.setHeader('access-control-allow-credentials','true');response.end('allowed');return;}
 if(url.pathname==='/events'){response.setHeader('content-type','text/event-stream');response.write('data: '+(request.headers.cookie||'none')+'\n\n');return;}
 if(url.pathname==='/worker'){response.setHeader('content-type','text/javascript');response.end('postMessage("ready")');return;}
 if(url.pathname==='/worker-cookies'){response.setHeader('content-type','text/javascript');response.end('fetch("https://a.example/cookies").then(response=>response.json()).then(value=>postMessage(value.cookie));');return;}
 if(url.pathname==='/shared'){response.setHeader('content-type','text/javascript');response.end('let count=0;onconnect=e=>{e.ports[0].postMessage(++count)}');return;}
 if(url.pathname==='/set-visible'){response.setHeader('set-cookie','serverVisible=yes; Path=/; Secure');response.end('saved');return;}
 if(url.pathname==='/login'){response.setHeader('content-type','text/html');response.end('<h1>Sign in fixture</h1><script>if(opener){addEventListener("message",e=>{if(e.origin==="https://a.example")globalThis.reply=e.data});opener.postMessage("signed-in","https://a.example");}</script>');return;}
 response.end('private response');
}).listen(0,'127.0.0.1');await once(upstream,'listening');
const service=isolatedApplication({suffix:'nyx.test',directory:join(temporary,'sessions'),resolveDestination:async value=>{
 const remote=new URL(value);return {url:new URL(remote.pathname+remote.search,'http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}};
}});
let rejectCookie=false,delayRuntime=false;
const server=httpsServer({key:await readFile(key),cert:await readFile(cert)},(request,response)=>{
 if(rejectCookie&&request.url==='/api/cookies'){rejectCookie=false;response.writeHead(503).end();return;}
 if(delayRuntime&&request.url==='/boot/runtime.js'){setTimeout(()=>service.handler(request,response),700);return;}
 return service.handler(request,response);
});
server.on('upgrade',service.upgrade);server.listen(0,'127.0.0.1');await once(server,'listening');
const port=server.address().port,origin='https://documents.nyx.test:'+port;
// Request Host includes the ephemeral test port, including the broker frame address.
const browser=await chromium.launch({channel:process.env.NYX_BROWSER_CHANNEL||(process.platform==='win32'?'chrome':undefined),args:['--host-resolver-rules=MAP *.nyx.test 127.0.0.1','--no-proxy-server','--ignore-certificate-errors']});
let context;
let shellServer,shellUrl=process.env.NYX_TEST_SHELL_URL;
try{
 if(shellUrl==='auto'){
  shellServer=fork(new URL('../shepherd.js',import.meta.url),[],{env:{...process.env,PORT:'0',NYX_STATIC_ROOT:''},silent:true});
  shellServer.stdout.resume();shellServer.stderr.resume();
  const port=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Shell startup timeout')),20000);shellServer.once('error',reject);shellServer.on('message',message=>{if(message.type==='nyx:listening'){clearTimeout(timeout);resolve(message.port)}})});
  shellUrl='http://127.0.0.1:'+port+'/study.html';
 }
 context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 if(shellUrl){
  await page.addInitScript(origin=>{localStorage.setItem('nyx.documentOrigin',origin);localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-10-02-nyx-1.6.8.seen','2026-10-02-nyx-1.6.8')},origin);
  await page.goto(shellUrl);
  const input=page.locator('[data-workspace-blank-input]:visible');await input.fill('https://a.example/a');await input.press('Enter');
 }else{
  await page.goto(origin);await page.locator('input').fill('https://a.example/a');await page.getByRole('button',{name:'Open',exact:true}).click();
 }
 let frame;
 for(let i=0;i<100;i++){frame=page.frames().find(frame=>frame.url().includes('/content/'));if(frame&&await frame.locator('h1').count())break;await page.waitForTimeout(100);}
 assert.equal(await frame.locator('h1').textContent(),'a');
 await frame.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker not ready')),10000))]));console.log('PASS isolated worker ready');
 const original=frame.url();delayRuntime=true;
 await frame.goto(original.replace(/%2Fa$/,'%2Fdelayed'));
 await frame.locator('h1').filter({hasText:'Loaded'}).waitFor({timeout:10000});
 assert.equal(await frame.locator('h1').evaluate(element=>getComputedStyle(element).color),'rgb(0, 128, 0)');
 delayRuntime=false;await frame.goto(original);
 console.log('PASS startup deadlock: queued authorization reaches the page before DOMContentLoaded; scripts and styles load');
 assert.equal(await frame.evaluate(()=>document.cookie.includes('secret=')),false);
 assert.equal(await frame.evaluate(()=>globalThis.blocked),true);
 assert.equal(await frame.evaluate(async()=>{const response=await fetch('/cookies');return (await response.json()).cookie;}),'secret=a');
 await page.bringToFront();
 const popupPromise=context.waitForEvent('page');void popupPromise.catch(()=>{});await frame.getByRole('button',{name:'Sign in'}).click({timeout:10000});const popup=await popupPromise;
 await popup.waitForLoadState();assert.equal(await popup.locator('h1').textContent(),'Sign in fixture');assert.equal(new URL(popup.url()).origin,new URL(frame.url()).origin);await popup.close();
 await page.bringToFront();
 const providerPromise=context.waitForEvent('page');void providerPromise.catch(()=>{});await frame.getByRole('button',{name:'Provider',exact:true}).click({timeout:10000});const provider=await providerPromise;
 await provider.waitForLoadState();await frame.waitForFunction(()=>globalThis.callback==='signed-in');await provider.waitForFunction(()=>globalThis.reply==='received');await provider.close();
 assert.equal(await frame.evaluate(()=>localStorage.getItem('site')),'a');
 assert.equal(await frame.evaluate(async()=>{const response=await fetch('/cookies');return (await response.json()).cookie;}),'secret=a');
 assert.equal(await frame.evaluate(async()=>{document.cookie='visible=yes; Path=/; Secure';const response=await fetch('/cookies');return (await response.json()).cookie.includes('visible=yes');}),true);
 await frame.evaluate(()=>fetch('/set-visible'));await frame.waitForFunction(()=>document.cookie.includes('serverVisible=yes'));
 rejectCookie=true;
 assert.equal(await frame.evaluate(async()=>{document.cookie='temporary=yes; Path=/';try{await fetch('/cookies');return false;}catch{return true;}}),true);
 assert.equal(await frame.evaluate(async()=>{const response=await fetch('/cookies');return response.ok;}),true);
 await frame.evaluate(()=>new Promise(resolve=>{globalThis.fixtureShared=new SharedWorker('/shared');fixtureShared.port.onmessage=e=>{globalThis.sharedCount=e.data;resolve()};fixtureShared.port.start()}));
 assert.equal(await frame.evaluate(()=>sharedCount),1);
 const sibling=await context.newPage();await sibling.goto(frame.url());
 assert.equal(await sibling.evaluate(()=>new Promise(resolve=>{globalThis.fixtureShared=new SharedWorker('/shared');fixtureShared.port.onmessage=e=>resolve(e.data);fixtureShared.port.start()})),2);await sibling.close();
 const aUrl=frame.url();const bOrigin='https://'+partition('https://b.example','nyx.test')+':'+port;
 const attackerPage=await context.newPage();await attackerPage.goto(origin);
 assert.equal(await attackerPage.evaluate(async endpoint=>new Promise(resolve=>{const socket=new WebSocket(endpoint);socket.onopen=()=>{socket.close();resolve(false)};socket.onerror=()=>resolve(true);}),bOrigin.replace('https:','wss:')+'/api/sync'),true);
 await attackerPage.close();
 const bUrl=route('https://b.example/cookies','https://a.example',new URL('/content/page/',aUrl).href);
 assert.equal(await frame.evaluate(async url=>{try{await fetch(url,{credentials:'include'});return false;}catch{return true;}},bUrl),true);
 assert.equal(await frame.evaluate(async()=>{const response=await fetch('https://b.example/cors',{credentials:'include'});return response.text();}),'allowed');
 assert.equal(await frame.evaluate(async()=>{const value=await new Promise((resolve,reject)=>{const worker=new Worker('/worker');worker.onmessage=e=>{resolve(e.data);worker.terminate()};worker.onerror=reject});return value;}),'ready');
 assert.match(await frame.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/worker-cookies');worker.onmessage=e=>{resolve(e.data);worker.terminate()};worker.onerror=reject})),/secret=a/);
 assert.equal(await frame.evaluate(async()=>new Promise((resolve,reject)=>{const events=new EventSource('/events',{withCredentials:true});events.onmessage=e=>{events.close();resolve(e.data)};events.onerror=()=>{events.close();reject(Error('Event failed'))}})).then(value=>value.includes('secret=a')),true);
 await frame.getByRole('link',{name:'Next'}).click();await page.waitForTimeout(700);frame=page.frames().find(frame=>frame.url().includes('/content/'));
 assert.equal(await frame.locator('h1').textContent(),'b');assert.equal(new URL(frame.url()).origin,bOrigin);
 assert.equal(await frame.evaluate(()=>localStorage.getItem('site')),'b');
 assert.equal(await frame.evaluate(async()=>{const response=await fetch('/cookies');return (await response.json()).cookie;}),'secret=b');
 const attacker=await context.newPage();const malicious=await attacker.goto(bOrigin+'/content/test/'+encodeURIComponent('https://a.example/cookies'));assert.equal(malicious.status(),502);await attacker.close();
 await frame.getByRole('link',{name:'Next'}).click();await page.waitForTimeout(700);frame=page.frames().find(frame=>frame.url().includes('/content/'));
 assert.equal(await frame.evaluate(async()=>{const response=await fetch('/cookies');return (await response.json()).cookie.includes('secret=a');}),true);
 await frame.evaluate(()=>location.reload());await page.waitForTimeout(700);frame=page.frames().find(frame=>frame.url().includes('/content/'));
 assert.equal(await frame.evaluate(()=>localStorage.getItem('site')),'a');
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('PASS isolated '+(process.env.NYX_BROWSER_CHANNEL||'Chrome')+(process.env.NYX_TEST_SHELL_URL?' through Nyx shell':'')+': distinct origins, storage, HttpOnly exclusion, cookies after navigation/reload, failed cookie-write recovery, CORS denial/allowance, Worker/SharedWorker, authenticated event stream, clicked login popup, cross-window callbacks, blocked unsolicited popup and forged host rejection');
}finally{shellServer?.kill();await context?.close();await browser.close();service.close();server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))]);await rm(temporary,{recursive:true,force:true});}
