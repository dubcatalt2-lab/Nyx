import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const storage=new Map();let firstClient;
for(const cookies of [true,false]){
 const handlers={},calls=[];let checks=0;
 const context={URL,Headers,Response,Request,crypto:webcrypto,caches:{open:async()=>({match:async key=>storage.get(key)?.clone(),put:async(key,value)=>storage.set(key,value.clone())})},fetch:async(input,options={})=>{const path=new URL(input).pathname;calls.push(path);if(path==='/direct-s3-config.json')return Response.json({backend:'https://backend.example',aliases:{}});if(path==='/api/static-host/check'){checks++;const client=new Headers(options.headers).get('X-Nyx-Host-Client');assert.match(client,/^[a-f0-9]{32}$/);firstClient??=client;assert.equal(client,firstClient,'Identity survives worker restart');return Response.json({supported:true,cookies,session:'signed-fixture-session'});}assert.equal(new Headers(options.headers).get('X-Nyx-Host-Session'),'signed-fixture-session');return Response.json({ok:true},{headers:{'Access-Control-Allow-Origin':'https://bucket.example'}});},self:{location:{href:'https://bucket.example/direct-s3-worker.js',origin:'https://bucket.example'},addEventListener:(type,fn)=>handlers[type]=fn}};
 vm.runInNewContext(await readFile('js/direct-s3-worker.js','utf8'),context);
 for(const path of ['/api/private','/math-fetch','/gms-games-proxy','/reds-misc-proxy','/reading-fetch','/game-cover','/duckmath-games']){let response;handlers.fetch({request:new Request('https://bucket.example'+path),respondWith:value=>response=value});assert.equal((await response).status,200);}
 assert.equal(checks,1);assert(calls.includes('/api/private'));
 let response;handlers.fetch({request:new Request('https://bucket.example/math-fetch',{headers:{Origin:'null'}}),respondWith:value=>response=value});assert.equal((await response).headers.get('access-control-allow-origin'),'null');
}
console.log('PASS signed worker sessions with cookies allowed or blocked, persisted identity, all game routes and sandbox resource CORS');

{
 const handlers={};let checks=0,attempts=0;
 const context={URL,Headers,Response,Request,crypto:webcrypto,caches:{open:async()=>({match:async key=>storage.get(key)?.clone(),put:async(key,value)=>storage.set(key,value.clone())})},fetch:async(input,options={})=>{const path=new URL(input).pathname;if(path==='/direct-s3-config.json')return Response.json({backend:'https://backend.example',aliases:{}});if(path==='/api/static-host/check')return Response.json({supported:true,session:'renewed-'+(++checks)});assert.equal(new TextDecoder().decode(options.body),'payload');attempts++;return attempts===1?Response.json({code:'HOST_SESSION_REQUIRED'},{status:428}):Response.json({ok:true});},self:{location:{href:'https://bucket.example/direct-s3-worker.js',origin:'https://bucket.example'},addEventListener:(type,fn)=>handlers[type]=fn}};
 vm.runInNewContext(await readFile('js/direct-s3-worker.js','utf8'),context);let response;handlers.fetch({request:new Request('https://bucket.example/api/private',{method:'POST',body:'payload'}),respondWith:value=>response=value});assert.equal((await response).status,200);assert.equal(checks,2);assert.equal(attempts,2);
 console.log('PASS explicit expired-session renewal before protected POST processing, with unchanged request body');
}
