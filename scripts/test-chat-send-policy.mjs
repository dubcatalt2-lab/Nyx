import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import express from 'express';
import {chatSendDecision} from '../lib/chat-send-policy.mjs';

let time=100000;
let state={};
for(let i=0;i<20;i++){const result=chatSendDecision(state,'different '+i,time+i*2500);assert(!result.error);state=result.state;}
assert.equal(chatSendDecision(state,'twenty first',time+50000).retryAfter,30);
state={};for(const text of ['hello','HELLO','he\u200bllo']){const result=chatSendDecision(state,text,time++);state=result.state;}
assert(state.until>time);assert.equal(chatSendDecision(state,'other',time).retryAfter,30);
assert(!chatSendDecision(state,'other',time+60001).error);
assert(!JSON.stringify(state).includes('hello'));

assert.notEqual(chatSendDecision({},'https://example.com?a=1&foo=2').state.recent[0].hash,chatSendDecision({},'https://example.com?a=1oo=2').state.recent[0].hash);

const source=readFileSync('server.js','utf8'),records=new Map();let tail=Promise.resolve();
const ref=path=>({path,id:path.split('/').at(-1),collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)}),get:async()=>snap(path),set:async(value,options)=>records.set(path,options?.merge?{...records.get(path),...structuredClone(value)}:structuredClone(value))});
const snap=path=>({id:path.split('/').at(-1),exists:records.has(path),data:()=>structuredClone(records.get(path))});
const db={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:fn=>{
  const work=tail.then(async()=>{const writes=[];const result=await fn({get:async r=>{assert.equal(writes.length,0,'All transaction reads must precede writes');return snap(r.path);},set:(r,value,options)=>writes.push([r,value,options]),create:(r,value)=>{assert(!records.has(r.path));writes.push([r,value]);}});for(const [r,value,options] of writes)await r.set(value,options);return result;});tail=work.catch(()=>{});return work;
}};
const ranks={owner:100,co_owner:90,admin:80,manager:70,developer:60,moderator:50,support:40,member:0};
const roles={member:'member',mod:'moderator',dev:'developer',owner:'owner',support:'support'};
for(const [uid,role] of Object.entries(roles))records.set('nyxUserAdministration/'+uid,{role});
records.set('nyxChatChannels/general',{name:'General',minimumRole:'member'});
const app=express();app.use(express.json());let broadcasts=0;
const context=vm.createContext({app,Date:class extends Date{static now(){return time;}},createHash,chatSendDecision,
 sameOriginRequest:req=>req.get('sec-fetch-site')!=='cross-site',authenticatedNyxChatUser:async req=>{const uid=req.get('authorization');if(!roles[uid])throw Object.assign(Error('Sign in'),{status:401});return {firebase:{firestore:db},token:{uid}};},
 nyxRoleForUser:(_uid,admin)=>admin.role||'member',nyxChatCanModerate:role=>ranks[role]>=50,
 nyxChatIdentity:async(_firebase,token)=>({uid:token.uid,role:roles[token.uid],canModerate:ranks[roles[token.uid]]>=50,displayName:token.uid,handle:token.uid,avatarUrl:'',avatarDecoration:'none',profileEffect:'none',customRole:null,caffeine:false}),assertNyxChatCanSend:async()=>{},
 nyxChatScope:async(_firebase,_uid,input,role)=>{if(input.channel==='restricted'&&ranks[role]<80)throw Object.assign(Error('Restricted'),{status:403});if(input.channel&&!['general','restricted'].includes(input.channel))throw Object.assign(Error('Missing channel'),{status:404});const privateScope=!input.channel,id=input.channel||input.conversationId;if(!id)throw Object.assign(Error('No channel'),{status:400});const r=ref((privateScope?'nyxChatConversations/':'nyxChatChannels/')+id);return {id,type:privateScope?'conversation':'channel',private:privateScope,ref:r,messages:r.collection('messages'),participants:[]};},
 nyxChatText:value=>String(value||'').trim(),nyxChatMessageLimit:1000,nyxChatMessageIdPattern:/^[a-f0-9]{40}$/,nyxChatAttachmentIdPattern:/^[a-f0-9]{40}$/,nyxChatAttachmentCountLimit:4,nyxChatAttachmentMessageLimit:8000000,nyxChatMentionHandles:text=>[...text.matchAll(/@([a-z]+)/g)].map(m=>m[1]),nyxChatConsumeSendAttempt:()=>{},nyxChatMessagePayload:doc=>({id:doc.id,...doc.data()}),nyxChatReplyPayload:v=>v,nyxChatAttachmentMetadata:v=>v,
 nyxClientIp:()=> 'shared-school-ip',recordNyxAuditSafe:async()=>{},recordNyxChatRealtimeEvent:()=>1,emitNyxChatSocketEvent:()=>broadcasts++,nyxChatChannelActivityCache:{value:new Map()}
});
for(const [start,end] of [['app.post("/api/chat/channels/lock",','app.post("/api/chat/channels",'],['app.post("/api/chat/messages",','async function deleteNyxChatMessageDocuments']]){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);vm.runInContext(source.slice(a,b),context);}
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const request=(uid,path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',authorization:uid,...headers},body:JSON.stringify(body)});
const lock=(uid,locked,extra={})=>request(uid,'/api/chat/channels/lock',{channel:'general',locked,...extra});
const send=(uid,text,id,extra={})=>request(uid,'/api/chat/messages',{channel:'general',text,requestId:'fixture-request-'+id,...extra});
try {
 assert.equal((await lock('member',true,{role:'owner'})).status,403);
 assert.equal((await lock('support',true)).status,403);
 assert.equal((await request('mod','/api/chat/channels/lock',{channel:'general',locked:true},{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await lock('mod',true,{channel:'restricted'})).status,403);
 assert.equal((await lock('mod','true')).status,400);
 assert.equal((await lock('mod',true)).status,200);assert.equal(records.get('nyxChatChannels/general').minimumRole,'member');
 assert.equal((await send('member','bypass','locked')).status,403);
 const attachment='a'.repeat(40);records.set('nyxChatAttachments/'+attachment,{ownerUid:'member',complete:true,bound:false,expiresAtMs:time+60000,size:1});
 assert.equal((await send('member','','attachment',{attachmentIds:[attachment]})).status,403);assert.equal(records.get('nyxChatAttachments/'+attachment).bound,false);
 for(const uid of ['mod','dev','owner'])assert.equal((await send(uid,'staff message',uid)).status,201);
 assert.equal((await lock('mod',false)).status,200);assert.equal(records.get('nyxChatChannels/general').minimumRole,'member');
 time+=61000;const replies=await Promise.all(Array.from({length:10},(_,i)=>send('member','unique '+i,'parallel-'+i)));
 assert.equal(replies.filter(r=>r.status===201).length,5);assert.equal(replies.filter(r=>r.status===429).length,5);
 const first=await replies.find(r=>r.status===201).json();const accepted=Number(first.message.text.split(' ').at(-1));
 const before=broadcasts;const duplicate=await send('member','same request','parallel-'+accepted);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).duplicate,true);assert.equal(broadcasts,before);
 const crossRoom=await send('member','new room','dm',{channel:undefined,conversationId:'private'});assert.equal(crossRoom.status,429);assert.equal(crossRoom.headers.get('retry-after'),'30');
 time+=61000;assert.equal((await send('member','repeat','repeat-1')).status,201);assert.equal((await send('member','REPEAT','repeat-2')).status,201);assert.equal((await send('member','re\u200bpeat','repeat-3')).status,429);
 time+=61000;assert.equal((await send('member','@a @b @c @d @e @f','mentions')).status,400);
 assert.equal((await send('member','Normal conversation','normal')).status,201);
 console.log('PASS real lock/send routes: roles, origin, channel visibility, attachment lock, staff send, unlock, concurrent spam, durable cross-scope cooldown, normalized repeats, mentions and idempotent retry');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
