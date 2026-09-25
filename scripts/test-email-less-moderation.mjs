import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import express from 'express';
import {createHash} from 'node:crypto';
const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);};
const app=express();app.use(express.json());let mutations=[],audits=[],fail=false;
const ownerUid='owner-fixture',targetUid='member-fixture';
const users=new Map([[targetUid,{uid:targetUid,emailVerified:false,displayName:'Member'}],[ownerUid,{uid:ownerUid,email:'owner@example.com'}]]);
const records=new Map();const ref=path=>({path,get:async()=>({exists:records.has(path),data:()=>records.get(path)}),delete:async()=>records.delete(path)});
const firebase={auth:{getUser:async uid=>users.get(uid),updateUser:async(uid,update)=>{if(fail)throw Object.assign(new Error('Sensitive provider failure'),{code:'auth/invalid-password'});mutations.push({uid,update});Object.assign(users.get(uid),update);},revokeRefreshTokens:async uid=>mutations.push({revoke:uid})},firestore:{collection:name=>({doc:id=>ref(name+'/'+id)}),batch:()=>({set:(r,v)=>records.set(r.path,v),delete:r=>records.delete(r.path),commit:async()=>{}})}};
const context=vm.createContext({app,createHash,nyxChatTemporaryBanCollection:'temporary',nyxAccountNoticeCollectionName:'notices',nyxAccountNoticeStatuses:new Set(['banned','disabled','deleted']),nyxProfileUsername:(v,f='')=>String(v||f).replace(/^@/,''),founderProfileConfig:()=>({administratorUid:ownerUid}),
 sameOriginRequest:req=>req.get('sec-fetch-site')!=='cross-site',ownerDashboardActor:async req=>{if(!req.get('x-actor'))throw Object.assign(new Error('Sign in'),{status:401});const uid=req.get('x-actor'),role=req.get('x-role')||'owner';return {firebase,ownerUid,token:{uid,email:'fixture@example.com'},actor:{uid,role}};},
 nyxRolePolicy:role=>({rank:role==='owner'?100:role==='admin'?80:10}),nyxActorHasPermission:()=>true,nyxAssignableRolesForActor:()=>[],
 nyxRoleForUser:uid=>uid===ownerUid?'owner':'member',nyxRoleLabels:{owner:'Owner',admin:'Admin'},founderProfileText:(text)=>text,
 invalidateOwnerDashboardSnapshot:()=>{},recordNyxAuditSafe:async(_firebase,record)=>audits.push(record),nyxCustomRoles:async()=>[],nyxOwnerUserRecord:user=>user,nyxOwnerUserForViewer:user=>user,nyxOwnerAccessPayload:()=>({}),nyxVisibleCustomRoles:()=>[]});
vm.runInContext(['nyxOwnerUserCapabilities','assertNyxOwnerCapability','nyxDeliverableEmail','normalizeNyxAccountEmail','nyxAccountNoticeDocumentId','nyxAccountNoticeIdentifierEntries','stageNyxAccountNotice','setNyxAccountNotice','clearNyxAccountNotice','nyxAccountNoticeUsername'].map(declaration).join('\n'),context);
const route=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.object?.name==='app'&&n.expression?.callee?.property?.name==='patch'&&n.expression.arguments[0]?.value==='/api/owner-dashboard/users/:uid');vm.runInContext(source.slice(route.start,route.end),context);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));

const send=(action='ban',uid=targetUid,role='owner')=>fetch(`http://127.0.0.1:${server.address().port}/api/owner-dashboard/users/${uid}`,{method:'PATCH',headers:{'content-type':'application/json','x-actor':ownerUid,'x-role':role},body:JSON.stringify({action,reason:'Fixture moderation reason'})});
try{
 for(const email of [undefined,'member@account.nyx.local','member@username.nyx.invalid','member@example.com']){
  records.clear();users.set(targetUid,{uid:targetUid,email,disabled:false});
  records.set('nyxUserProfiles/'+targetUid,{profile:{handle:'@member'}});
  const response=await send();const payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));
  assert.equal(users.get(targetUid).disabled,true);assert([...records.values()].some(v=>v.status==='banned'&&v.identifierKind==='uid'));
  const enabled=await send('enable');assert.equal(enabled.status,200,JSON.stringify(await enabled.json()));assert.equal(users.get(targetUid).disabled,false);
  assert(![...records.values()].some(v=>v.status==='banned'));
 }
 assert.equal((await send('ban',ownerUid)).status,403);
 console.log('PASS ban/unban route for absent email, both username aliases, and email accounts; UID notices and owner protection.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
