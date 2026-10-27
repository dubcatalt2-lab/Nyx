import assert from 'node:assert/strict';
import express from 'express';
import {installMizuChat,mizuSignature,mizuUid} from '../lib/mizu-chat.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const db=memoryFirestore(),baseCollection=db.collection;
db.collection=function collection(path){
  const result={doc(id){const ref=baseCollection(path).doc(id);ref.id=id;ref.collection=name=>collection(path+'/'+id+'/'+name);ref.set=(v,o)=>db.runTransaction(async tx=>tx.set(ref,v,o));return ref;},orderBy(){return result;},limit(n){result.count=n;return result;},where(_field,_op,n){result.before=n;return result;},async get(){return {docs:[...db.records].filter(([k,v])=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')&&(!result.before||v.createdAtMs<result.before)).map(([k,v])=>({id:k.split('/').at(-1),data:()=>v})).sort((a,b)=>b.data().createdAtMs-a.data().createdAtMs).slice(0,result.count||100)};}};return result;
};
const key='fixture-secret-never-use-in-production-123456789',api='/api/integrations/mizu/v1';
let time=Date.now(),enabled=true,allowed=true,events=0;
const app=express();app.use(express.json());installMizuChat(app,{database:async()=>db,secret:()=>key,enabled:()=>enabled,canAccess:async()=>{if(!allowed)throw Object.assign(new Error('private'),{status:403});},moderator:async req=>{if(req.get('authorization')!=='Bearer fixture-moderator')throw Object.assign(new Error('Forbidden'),{status:403});return {db,uid:'moderator'};},serialize:d=>({id:d.id,...d.data()}),emit:()=>events++,now:()=>time});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
async function send(path,body={},method='POST',extra={}){const timestamp=String(time);return fetch(origin+path,{method,headers:{'content-type':'application/json','x-mizu-timestamp':timestamp,'x-mizu-signature':mizuSignature(key,method,path,timestamp,body),...extra},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
const body={messageId:'unique-message-0001',user:{id:'alice',displayName:'Alice',bio:'Hello',avatarUrl:'https://mizumath.com/avatar.png',bannerUrl:'https://mizumath.com/banner.png',role:'owner',premium:true},text:'Hi from Mizu',channel:'private-staff'};
try{
  assert.equal((await fetch(origin+api+'/messages')).status,401);
  assert.equal((await send(api+'/messages',body,'POST',{'x-mizu-signature':'0'.repeat(64)})).status,401);
  assert.equal((await send(api+'/messages',body,'POST',{'x-mizu-timestamp':String(time-120000)})).status,401);
  let r=await send(api+'/messages',body);assert.equal(r.status,200);const first=await r.json();assert.equal(first.message.channel,'general');assert.equal(first.message.author.role,'member');assert.equal(first.message.author.caffeine,false);assert.equal(events,1);
  assert.equal((await(await send(api+'/messages',body)).json()).duplicate,true);assert.equal(events,1);
  const uid=mizuUid('alice'),profile=db.records.get('nyxUserProfiles/'+uid).profile;assert.equal(profile.bio,'Hello');assert.equal(profile.bannerUrl,body.user.bannerUrl);assert.equal(profile.role,undefined);
  assert.equal((await send(api+'/messages',{...body,messageId:'unique-message-0002'})).status,429);
  const moderation='/api/chat/integrations/mizu/users/'+uid;
  assert.equal((await send(moderation,{banned:true})).status,403);
  assert.equal((await send(moderation,{banned:true},'POST',{authorization:'Bearer fixture-moderator'})).status,200);
  time+=2000;assert.equal((await send(api+'/messages',{...body,messageId:'unique-message-0003'})).status,403);
  assert.equal((await(await send(api+'/users/alice/status',{},'GET')).json()).banned,true);
  assert.equal((await send(api+'/profile',{user:{...body.user,displayName:'Changed',banned:false}},'PUT')).status,200);
  assert.equal((await send(api+'/messages',{...body,messageId:'unique-message-0004'})).status,403,'Profile updates cannot remove a ban');
  await send(moderation,{banned:false},'POST',{authorization:'Bearer fixture-moderator'});
  assert.equal((await send(api+'/messages',{...body,messageId:'unique-message-0005'})).status,200);
  await db.collection('nyxChatChannels').doc('general').collection('messages').doc('native').set({text:'Hi from Nyx',authorUid:'native-member',createdAtMs:time+1});
  const history=await(await send(api+'/messages',{},'GET')).json();assert.equal(history.messages.length,3);assert.equal(history.messages.at(-1).text,'Hi from Nyx');
  await db.collection('nyxChatChannels').doc('general').set({locked:true},{merge:true});time+=2000;
  assert.equal((await send(api+'/messages',{...body,messageId:'unique-message-0006'})).status,403);
  allowed=false;assert.equal((await send(api+'/messages',{},'GET')).status,403);allowed=true;
  assert.equal((await send(api+'/profile',{user:{...body.user,avatarUrl:'javascript:alert(1)'}},'PUT')).status,400);
  enabled=false;assert.equal((await send(api+'/messages',{},'GET')).status,404);
  console.log('PASS Mizu signatures, tamper/stale rejection, idempotency, profiles, role isolation, rate limit, moderator ban/unban, persistent ban after profile update, bidirectional history, locked/private channel and disabled deployment');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
