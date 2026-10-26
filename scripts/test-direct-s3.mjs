import assert from 'node:assert/strict';import express from 'express';import {createServer} from 'node:https';import {readFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {chromium} from 'playwright';import {Server as SocketIOServer} from 'socket.io';
import {createStaticHostAccess,directS3Origin} from '../lib/static-host-access.mjs';
import {WebSocketServer} from 'ws';
import {installHttpWisp} from '../server-http-wisp.mjs';
const origin='https://nyx-fixture.s3.amazonaws.com',certificateDir=await mkdtemp(join(tmpdir(),'nyx-s3-fixture-'));
const openssl=process.env.NYX_TEST_OPENSSL||(process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl');
const generated=spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-keyout',join(certificateDir,'key.pem'),'-out',join(certificateDir,'cert.pem')],{encoding:'utf8'});
if(generated.error||generated.status!==0){await rm(certificateDir,{recursive:true,force:true});throw Error('Test certificate generation failed. Set NYX_TEST_OPENSSL to your OpenSSL executable.');}
const tls={key:await readFile(join(certificateDir,'key.pem')),cert:await readFile(join(certificateDir,'cert.pem'))};
for(const bad of ['https://s3.amazonaws.com','https://nyx-fixture.s3.amazonaws.com:8443','https://nyx-fixture.s3.amazonaws.com/','https://attacker.test'])assert.throws(()=>directS3Origin(bad));
const access=createStaticHostAccess([origin]),backendApp=express();backendApp.use(access.middleware);backendApp.use(express.json());
const seen=[];backendApp.use((req,res,next)=>{seen.push({path:req.path,authorization:req.headers.authorization,cookie:req.headers.cookie});next();});
backendApp.get('/api/private',(req,res)=>{if(req.headers.authorization!=='Bearer test-only')return res.status(401).json({error:'Sign in'});res.append('Set-Cookie','nyx_q74bd9=signed-fixture; Path=/; HttpOnly; SameSite=Lax; Secure');res.json({ok:true});});
backendApp.post('/api/stream',(req,res)=>{if(req.headers.authorization!=='Bearer test-only')return res.sendStatus(401);res.type('text/event-stream');res.write('data: first\n\n');setTimeout(()=>res.end('data: second\n\n'),250);});
backendApp.get('/api/media',(req,res)=>{assert.equal(req.headers.range,'bytes=0-3');res.status(206).set({'Content-Type':'application/octet-stream','Content-Range':'bytes 0-3/8'}).send(Buffer.from([0,1,2,3]));});
const upstream=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>upstream.once('listening',r));
upstream.on('connection',socket=>{socket.send(Buffer.from([3,0,0,0,0,10,0,0,0]));socket.on('message',value=>socket.send(value));});
const stopHttp=installHttpWisp(backendApp,{upstream:()=>({url:'ws://127.0.0.1:'+upstream.address().port}),allowed:req=>access.allowed(req.headers.origin),clientIp:()=> 'fixture'});
const backend=createServer(tls,backendApp);await new Promise(r=>backend.listen(0,'127.0.0.1',r));const backendOrigin=`https://127.0.0.1:${backend.address().port}`;
const sockets=new SocketIOServer(backend,{cors:{origin:(value,cb)=>cb(null,access.allowed(value)),credentials:true}});sockets.use((socket,next)=>next(socket.handshake.auth.token==='test-only'?undefined:Error('Sign in')));sockets.on('connection',socket=>{assert(socket.handshake.headers.cookie?.includes('nyx_q74bd9=signed-fixture'));socket.on('echo',(value,reply)=>reply(value));});
const relay=new WebSocketServer({noServer:true});backend.on('upgrade',(request,socket,head)=>{if(request.url!=='/resources/live/')return;assert.equal(request.headers.origin,origin);assert(request.headers.cookie?.includes('nyx_q74bd9=signed-fixture'));relay.handleUpgrade(request,socket,head,ws=>ws.on('message',value=>ws.send(value.toString())));});
const exported=process.env.NYX_TEST_EXPORT_ROOT;const source=exported?exported+'/site':process.env.NYX_TEST_STATIC_ROOT||'.';let runtime='/js/direct-s3-runtime.js',entry='/js/direct-s3-entry.js',worker='/js/direct-s3-worker.js';
if(source==='dist'){const aliases=JSON.parse(await readFile('dist/frontend-assets.json','utf8')).aliases;runtime=aliases[runtime]||runtime;entry=aliases[entry]||entry;worker=aliases[worker]||worker;}
const exportConfig=exported?JSON.parse(await readFile(source+'/direct-s3-config.json','utf8')):null;if(exportConfig){runtime=exportConfig.runtime;entry=exportConfig.aliases['/js/direct-s3-entry.js']||entry;worker='/direct-s3-worker.js';}
let httpModule='/apps/tutsi/http-relay.mjs';
if(source==='dist'||exported){const modules=JSON.parse(await readFile(source+'/public-modules.json','utf8')).aliases;httpModule=modules[httpModule]||httpModule;}
const frontendApp=express();frontendApp.get('/fixture-relay.mjs',async(_req,res)=>res.type('text/javascript').send(await readFile(source+httpModule,'utf8')));frontendApp.get('/direct-s3-config.json',(_req,res)=>res.json({origin,backend:backendOrigin,runtime,aliases:exportConfig?.aliases||{}}));
frontendApp.get('/direct-s3-worker.js',async(_req,res)=>res.type('text/javascript').send(await readFile(source+worker,'utf8')));
if(!exported)frontendApp.get('/index.html',(_req,res)=>res.type('html').send(`<html><head></head><body><p role="status">Connecting</p><script src="${entry}"></script></body></html>`));
if(!exported)frontendApp.get('/studies.html',(_req,res)=>res.type('html').send('<html><head></head><body>Fixture workspace</body></html>'));frontendApp.use(express.static(source));
const frontend=createServer(tls,frontendApp);await new Promise(r=>frontend.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--ignore-certificate-errors',`--host-resolver-rules=MAP nyx-fixture.s3.amazonaws.com 127.0.0.1:${frontend.address().port}`]});
try{
 const page=await browser.newPage({ignoreHTTPSErrors:true});page.on('response',r=>{if(r.url().includes('/api/tutsi-relay/')&&r.status()>=400)console.log('RELAY HTTP',new URL(r.url()).pathname,r.status());});if(exported)await page.addInitScript(()=>{try{if(location.origin!=='https://nyx-fixture.s3.amazonaws.com')return;localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');}catch{}});page.on('pageerror',e=>console.log('PAGE ERROR',e.message));page.context().on('serviceworker',w=>w.on('console',m=>console.log('WORKER',m.text())));if(exported){
  const sharedRequests=[];
  await page.route('https://s3.amazonaws.com/**',async route=>{
   sharedRequests.push(route.request().url());
   assert.equal(route.request().resourceType(),'document','Shared S3 origin must not load app resources');
   await route.fulfill({status:200,contentType:'text/html',body:await readFile(source+'/studies.html')});
  });
  await page.goto('https://s3.amazonaws.com/nyx-fixture/studies.html');
  await page.waitForURL(origin+'/studies.html');
  assert.equal(sharedRequests.length,1);
  console.log('PASS path-style entry redirects to isolated bucket origin before loading application assets');
 }else await page.goto(origin+'/index.html');await page.waitForURL('**/studies.html');if(exported){await page.waitForFunction(()=>typeof window.nyxLaunchGameFrame==='function');console.log('PASS actual compiled Nyx shell initialized from the exported S3 files');}
 assert.equal(await page.evaluate(async()=>{const r=await fetch('/api/private');return r.status}),401);
 assert.deepEqual(await page.evaluate(async()=>{const r=await fetch('/api/private',{mode:'same-origin',cache:'no-store',headers:{Authorization:'Bearer test-only'}});return r.json()}),{ok:true});
 await page.evaluate(()=>fetch('/api/private',{mode:'same-origin',cache:'no-store',headers:{Authorization:'Bearer test-only'}}));assert(seen.at(-1).cookie.includes('nyx_q74bd9=signed-fixture'));
 assert.deepEqual(await page.evaluate(async()=>{const r=await fetch('/api/media',{headers:{Range:'bytes=0-3'}});return [r.status,r.headers.get('content-range'),...new Uint8Array(await r.arrayBuffer())]}),[206,'bytes 0-3/8',0,1,2,3]);
 const chunks=await page.evaluate(async()=>{const response=await fetch('/api/stream',{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:JSON.stringify({message:'fixture'})});const reader=response.body.getReader(),a=await reader.read(),b=await reader.read();return [new TextDecoder().decode(a.value),new TextDecoder().decode(b.value)]});assert.deepEqual(chunks,['data: first\n\n','data: second\n\n']);
 await page.addScriptTag({url:'/socket.io/socket.io.js'});
 for(const transport of ['websocket','polling'])assert.equal(await page.evaluate(transport=>new Promise((resolve,reject)=>{const socket=io({auth:{token:'test-only'},transports:[transport],withCredentials:true,reconnection:false});socket.on('connect_error',reject);socket.on('connect',()=>socket.emit('echo','hello',value=>{socket.disconnect();resolve(value)}));}),transport),'hello');
 assert.equal(await page.evaluate(()=>new Promise((resolve,reject)=>{const socket=new WebSocket('wss://'+location.host+'/resources/live/');socket.onopen=()=>socket.send('proxy-relay');socket.onerror=()=>reject(Error('Relay connection failed'));socket.onmessage=event=>{socket.close();resolve(event.data);};})),'proxy-relay');

 assert.equal(await page.evaluate(async()=>{
  const {HttpRelaySocket}=await import('/fixture-relay.mjs');
  return new Promise((resolve,reject)=>{const socket=new HttpRelaySocket('wss://'+location.host+'/api/tutsi-relay/socket/');socket.binaryType='arraybuffer';let ready=false;
   const timer=setTimeout(()=>{socket.close();reject(Error('HTTP relay timed out'));},10000);
   socket.onerror=()=>{clearTimeout(timer);reject(Error('HTTP relay failed'));};
   socket.onmessage=async event=>{if(!ready){ready=true;socket.send(new TextEncoder().encode('http-relay'));}else{while(socket.bufferedAmount&&socket.readyState===1)await new Promise(r=>setTimeout(r,10));if(socket.readyState!==1)return;clearTimeout(timer);socket.close();resolve(new TextDecoder().decode(event.data));}};
  });
 }),'http-relay');
 const preflight=await page.request.fetch(backendOrigin+'/api/private',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization,content-type'}});assert.equal(preflight.status(),204);assert.equal(preflight.headers()['access-control-allow-origin'],origin);
 const denied=await page.request.fetch(backendOrigin+'/api/private',{headers:{Origin:'https://other.s3.amazonaws.com'}});assert.equal(denied.headers()['access-control-allow-origin'],undefined);
 console.log('PASS direct-S3 controlled HTTPS: worker startup, unauthenticated rejection, bearer preservation, persistent device cookies, streaming, ranges, WebSocket routing, real HTTP relay batches and exact-origin CORS. No live accounts/providers used.');
}finally{await browser.close();stopHttp();for(const socket of upstream.clients)socket.terminate();upstream.close();relay.close();sockets.close();backend.closeAllConnections();frontend.closeAllConnections();await Promise.all([new Promise(r=>backend.close(r)),new Promise(r=>frontend.close(r))]);await rm(certificateDir,{recursive:true,force:true});}
