import assert from 'node:assert/strict';
import {createCloudLaunchLimit} from '../lib/cloud-launch-limit.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
let time=0;const gate=createCloudLaunchLimit({now:()=>time});
for(let i=0;i<3;i++)gate.reserve('user').finish(true);
assert.equal(gate.reserve('other').allowed,true);
for(time=1000;time<600000;time+=1000)assert.equal(gate.reserve('user').retryAfter,Math.ceil((600000-time)/1000));
assert.equal(gate.reserve('user').allowed,true,'Rejected clicks do not extend the window');
const failed=createCloudLaunchLimit({now:()=>time});
for(let i=0;i<8;i++){const r=failed.reserve('user');assert(r.allowed);r.finish(false);assert.equal(failed.reserve('user').retryAfter,10);time+=10000;}
assert(failed.reserve('user').allowed,'Provider failures do not consume a ten-minute slot');
const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
const start=source.indexOf('app.post("/api/cloud-gaming/sessions",');
const end=source.indexOf('app.get("/api/cloud-gaming/sessions/:id/queue"',start);
let handler,resolveCatalog;const provisioning=new Set(),sessions=new Map();let upstreamCalls=0;
const context={app:{post:(path,fn)=>handler=fn},sameOriginRequest:()=>true,nyxCloudGamingConfig:()=>({configured:true,maxActiveSessions:8,createTimeoutMs:1000}),nyxCloudGamingUser:async()=>({token:{uid:'user'}}),nyxCloudGamingError:(m,status)=>Object.assign(new Error(m),{status}),nyxCloudGamingPublicError:m=>m,nyxCloudGamingProvisioningUsers:provisioning,nyxCloudGamingSessions:sessions,nyxCloudGamingLaunchLimit:createCloudLaunchLimit(),nyxCloudGamingCatalog:()=>new Promise(resolve=>resolveCatalog=resolve),nyxCloudGamingUpstream:async()=>{upstreamCalls++;return new Response(JSON.stringify({id:'fixture-session',status:'queue'})+'\n')},nyxCloudGamingSafeEvent:value=>value,AbortController,TextDecoder,Uint8Array,setTimeout,clearTimeout,Date};
vm.runInNewContext(source.slice(start,end),context);
function response(){return Object.assign(new EventEmitter(),{headers:{},code:200,body:'',headersSent:false,writableEnded:false,set(k,v){this.headers[k]=v;return this},status(v){this.code=v;return this},type(){return this},json(v){this.body=v;this.writableEnded=true;return this},flushHeaders(){this.headersSent=true},write(v){this.body+=v},end(v=''){this.body+=v;this.writableEnded=true}})}
const req={body:{gameKey:'fixture'}};const first=response();const pending=handler(req,first);await new Promise(setImmediate);
assert(provisioning.has('user'));const duplicate=response();await handler(req,duplicate);assert.equal(duplicate.code,409);assert(provisioning.has('user'),'Rejected duplicate must not clear the first reservation');
resolveCatalog([{key:'fixture',name:'Fixture'}]);await pending;assert.equal(upstreamCalls,1);assert.equal(first.code,200);assert(!provisioning.has('user'));assert(sessions.has('fixture-session'));
console.log('Cloud launch: rejection deadlines, failure cooldown, account isolation and concurrent provisioning passed.');
