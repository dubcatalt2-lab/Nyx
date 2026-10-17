import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import express from 'express';
import {validateAiModelRules} from '../lib/ai-model-policy.mjs';
import {readAiActivity,recordAiExchange} from '../lib/ai-history.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const app=express();app.use(express.json());const db=memoryFirestore();const col=db.collection;db.collection=name=>({doc:id=>{const r=col(name).doc(id);r.set=async(data,options)=>db.runTransaction(tx=>tx.set(r,data,options));return r;}});
const ownerUid='owner-fixture',uid='member-fixture',firebase={firestore:db,auth:{getUser:async uid=>({uid})}};let audits=[];
const context=vm.createContext({app,validateAiModelRules,readAiActivity,founderProfileConfig:()=>({administratorUid:ownerUid}),
 sameOriginRequest:req=>req.get('sec-fetch-site')!=='cross-site',ownerDashboardActor:async req=>{if(!req.get('x-actor'))throw Object.assign(Error('Sign in'),{status:401});return{firebase,ownerUid,token:{uid:req.get('x-actor')},actor:{uid:req.get('x-actor'),role:req.get('x-role')||'member'}};},nyxRolePolicy:role=>({rank:role==='owner'?100:role==='admin'?80:10}),nyxActorHasPermission:()=>true,nyxAssignableRolesForActor:()=>[],nyxRoleForUser:uid=>uid===ownerUid?'owner':'member',nyxRoleLabels:{},founderProfileText:t=>t,
 invalidateOwnerDashboardSnapshot:()=>{},recordNyxAuditSafe:async(_f,r)=>audits.push(r),nyxCustomRoles:async()=>[],nyxOwnerUserRecord:u=>u,nyxOwnerUserForViewer:u=>u,nyxOwnerAccessPayload:()=>({}),nyxVisibleCustomRoles:()=>[]});
for(const name of ['nyxOwnerUserCapabilities','assertNyxOwnerCapability']){const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);vm.runInContext(source.slice(n.start,n.end),context);}
for(const [method,path] of [['patch','/api/owner-dashboard/users/:uid'],['get','/api/owner-dashboard/users/:uid/ai']]){const n=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.property?.name===method&&n.expression?.arguments?.[0]?.value===path);vm.runInContext(source.slice(n.start,n.end),context);}
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api/owner-dashboard/users/${uid}`;
const rules=[{model:'openai/gpt-5.6-luna',access:'allow',messages:12,periodDays:4}];
const send=(actor,role,modelRules=rules,extra={})=>fetch(base,{method:'PATCH',headers:{'content-type':'application/json',...(actor?{'x-actor':actor}:{}),'x-role':role,...extra},body:JSON.stringify({action:'set_ai_models',modelRules})});
try{
 assert.equal((await send(null,'owner')).status,401);
 for(const role of ['member','admin','co_owner','owner'])assert.equal((await send('other-person',role)).status,403);
 assert.equal((await send(ownerUid,'owner',rules,{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await send(ownerUid,'owner',[{...rules[0],messages:-1}])).status,400);
 const result=await send(ownerUid,'owner');assert.equal(result.status,200,await result.text());assert.deepEqual(db.records.get('nyxUserAdministration/'+uid).aiModelRules,rules);
 await send(ownerUid,'owner',[]);assert.deepEqual(db.records.get('nyxUserAdministration/'+uid).aiModelRules,[]);
 await recordAiExchange(db,uid,{model:rules[0].model,prompt:'Fixture question',answer:'Fixture answer',usage:{input:12,output:4}});
 assert.equal((await fetch(base+'/ai')).status,401);
 assert.equal((await fetch(base+'/ai',{headers:{'x-actor':'other-person','x-role':'owner'}})).status,403);
 const activity=await fetch(base+'/ai',{headers:{'x-actor':ownerUid,'x-role':'owner'}});assert.equal(activity.status,200);assert.equal(activity.headers.get('cache-control'),'private, no-store');assert.equal((await activity.json()).entries[0].prompt,'Fixture question');
 assert(audits.some(a=>a.action==='ai_history_viewed'));assert(audits.some(a=>a.action==='ai_model_access_changed'));
 console.log('PASS actual owner routes: access validation, auth/role/origin rejection, replacement persistence, history isolation, no-store and audits');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
