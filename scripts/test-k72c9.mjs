import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import express from 'express';
import {createHostingSessions} from '../lib/k72c9.mjs';
import {createStaticHostAccess} from '../lib/static-host-access.mjs';
import {q74bd9} from '../lib/q74bd9.mjs';
const origin='https://fixture.s3.amazonaws.com',secret='fixture-key-not-a-production-secret';
let now=1000;const sessions=createHostingSessions({secret:async()=>secret,now:()=>now});
const client='1'.repeat(32),token=await sessions.issue({origin,client}),record=await sessions.read(token,origin);
assert(record);assert.equal(await sessions.read(token,'https://other.s3.amazonaws.com'),null);
assert.equal(await sessions.read(token.slice(0,-1)+(token.endsWith('0')?'1':'0'),origin),null);
now+=86400001;assert.equal(await sessions.read(token,origin),null);
assert.equal((await sessions.read(await sessions.issue({origin,client,previous:token}),origin)).id,record.id);
const legacy='2'.repeat(32),signature=createHmac('sha256',secret).update('nyx_q74bd9:'+legacy).digest('hex');
assert.equal((await sessions.read(await sessions.issue({origin,client,cookie:'nyx_q74bd9='+legacy+'.'+signature}),origin)).id,legacy);
const access=createStaticHostAccess([origin],{secret:async()=>secret}),app=express();app.use(access.middleware);
app.get('/api/private',(req,res)=>req.headers.authorization==='Bearer fixture'?res.json({id:req.q74bd9}):res.sendStatus(401));
app.get('/gms-studies-fetch',(req,res)=>{res.set('Access-Control-Allow-Origin','*');res.json({id:req.q74bd9});});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{
 const base='http://127.0.0.1:'+server.address().port,headers={Origin:origin,'X-Nyx-Host-Client':client};
 const start=await fetch(base+'/api/static-host/check',{headers});const session=(await start.json()).session;assert(session);
 const protectedHeaders={Origin:origin,'X-Nyx-Host-Session':session};
 assert.equal((await fetch(base+'/api/private',{headers:protectedHeaders})).status,401,'Connection identity grants no account access');
 const game=await fetch(base+'/gms-studies-fetch',{headers:protectedHeaders});assert.equal(game.status,200);assert.equal(game.headers.get('access-control-allow-origin'),origin,'Credentialed response cannot use wildcard origin');
 const identity=(await game.json()).id;
 assert.equal((await(await fetch(base+'/api/private',{headers:{...protectedHeaders,Authorization:'Bearer fixture'}})).json()).id,identity);
 const moderation=q74bd9({firebase:async()=>({firestore:{collection:()=>({doc:id=>({get:async()=>({data:()=>({banned:id===identity})})})})}}),ownerUid:()=>'',authorize:async()=>({}),sameOrigin:()=>true});
 assert.equal(await moderation.blocked({q74bd9:identity,headers:{}}),true,'Signed connection identity remains subject to device bans');
 assert.equal((await fetch(base+'/api/private',{headers:{...protectedHeaders,'X-Nyx-Host-Session':session+'x'}})).status,428);
 const req={url:'/resources/live/',headers:{origin,'sec-websocket-protocol':'binary, nyx-host.'+session}};
 assert.equal(await access.upgrade(req),true);assert.equal(req.headers['sec-websocket-protocol'],'binary');assert.equal(req.q74bd9,identity);
 assert.equal(await access.upgrade({url:'/resources/live/',headers:{origin}}),false);
 console.log('PASS cookie-free signed sessions, origin/tamper/expiry checks, renewal, legacy device continuity, unchanged account authentication, device bans, exact CORS and preserved socket protocols');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}

const {memoryFirestore}=await import('./test-ai-allowance.mjs');const {createAiAllowance,aiAllowanceConfig}=await import('../lib/ai-allowance.mjs');const db=memoryFirestore(),allowance=()=>createAiAllowance({db,config:aiAllowanceConfig({})}),request={headers:{},nyxHostSession:{id:'3'.repeat(32)}};const response={headersSent:false,append(){}};const device=await allowance().device(request,response);assert.equal(await allowance().device(request,response),device);assert.notEqual(await allowance().device({...request,nyxHostSession:{id:'4'.repeat(32)}},response),device);console.log('PASS stable AI/signup device accounting without cookies');
