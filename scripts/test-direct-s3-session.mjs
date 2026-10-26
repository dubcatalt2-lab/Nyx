import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
for(const cookies of [true,false]){
 const handlers={},calls=[];let checks=0;
 const context={URL,Headers,Response,fetch:async(input,options)=>{const path=new URL(input).pathname;calls.push(path);if(path==='/direct-s3-config.json')return Response.json({backend:'https://backend.example',aliases:{}});if(path==='/api/static-host/check'){assert.equal(options.credentials,'include');return Response.json({supported:true,cookies:++checks>1&&cookies});}assert.equal(checks,2);return Response.json({ok:true});},self:{location:{href:'https://bucket.example/direct-s3-worker.js',origin:'https://bucket.example'},addEventListener:(type,fn)=>handlers[type]=fn}};
 vm.runInNewContext(await readFile('js/direct-s3-worker.js','utf8'),context);
 let response;const event={request:new Request('https://bucket.example/api/private'),respondWith:value=>response=value};handlers.fetch(event);
 if(cookies){assert.equal((await response).status,200);handlers.fetch(event);await response;assert.equal(checks,2);assert.deepEqual(calls.slice(0,4),['/direct-s3-config.json','/api/static-host/check','/api/static-host/check','/api/private']);}
 else{await assert.rejects(response,/session cookie/);assert(!calls.includes('/api/private'));}
}
console.log('PASS worker establishes its own cookie partition before API forwarding and rejects missing cookies');
