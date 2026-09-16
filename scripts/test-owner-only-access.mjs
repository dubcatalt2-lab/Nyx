import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import express from 'express';

const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end);};
const ownerUid='configured-owner';let databaseCalls=0;
const snapshot={docs:[{id:'audit-event',data:()=>({details:{ip:'192.0.2.10'}})}]};
const collection={doc:()=>({set:async()=>{databaseCalls++;},get:async()=>{databaseCalls++;return {data:()=>({role:'owner'})};}}),orderBy:()=>collection,limit:()=>collection,get:async()=>{databaseCalls++;return snapshot;}};
const firebase={firestore:{collection:()=>collection}};
const app=express();
const context=vm.createContext({app,founderProfileConfig:()=>({administratorUid:ownerUid}),
 authenticatedNyxUser:async req=>{const uid=req.get('x-fixture-uid');if(!uid)throw Object.assign(new Error('Sign in'),{status:401});return {firebase,token:{uid,role:req.get('x-fixture-role'),permissions:['dashboard:view','network:bans']}};},
 nyxRoleForUser:uid=>uid===ownerUid?'owner':'admin',nyxRolePolicy:()=>({rank:100,permissions:['dashboard:view','users:view','audit:view','network:bans']}),nyxRoleLabels:{owner:'Owner'},
 nyxAssignedCustomRole:()=>({permissions:['dashboard:view','network:bans'],rank:100}),nyxCustomRoles:async()=>new Map(),
 nyxRolePresentation:role=>({role,roleLabel:role}),nyxActorCanReviewSearchHistory:()=>false,nyxAssignableRolesForActor:()=>[],
 nyxIpBans:async()=>[{ip:'192.0.2.10'}],nyxClientIp:()=> '192.0.2.20',safeDateIso:value=>value||''});
vm.runInContext(['nyxActorHasPermission','nyxOwnerAccessPayload','ownerDashboardActor','nyxFounderOwnerActor'].map(declaration).join('\n'),context);
const routes=ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.object?.name==='app'&&String(n.expression.arguments?.[0]?.value||'').startsWith('/api/owner-dashboard'));
for(const route of routes)assert.match(source.slice(route.start,route.end),/await (?:ownerDashboardActor|nyxFounderOwnerActor)\(req/,route.expression.arguments[0].value+' must authenticate through the owner gate');
for(const path of ['/api/owner-dashboard','/api/owner-dashboard/users/:uid','/api/owner-dashboard/audit','/api/owner-dashboard/ip-bans']){
 const route=routes.find(n=>n.expression.callee.property.name==='get'&&n.expression.arguments[0].value===path);vm.runInContext(source.slice(route.start,route.end),context);
}
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const request=(path,uid,role='member')=>fetch(`http://127.0.0.1:${server.address().port}/api/owner-dashboard${path}`,{headers:uid?{'x-fixture-uid':uid,'x-fixture-role':role}:{}});
try{
 for(const path of ['', '/users/fixture-user', '/audit','/ip-bans']){
  assert.equal((await request(path)).status,401);
  for(const role of ['member','support','moderator','developer','manager','admin','co_owner','owner','custom-admin']){
   const response=await request(path,'other-'+role,role);assert.equal(response.status,403,role+' '+path);assert(!JSON.stringify(await response.json()).includes('192.0.2.'));
  }
 }
 assert.equal(databaseCalls,0,'Non-owners must be rejected before reading or updating administration/data');
 for(const path of ['/audit','/ip-bans']){const response=await request(path,ownerUid,'owner');assert.equal(response.status,200);assert(JSON.stringify(await response.json()).includes('192.0.2.10'));}
 for(const role of ['owner','co_owner','admin','moderator','member']){
  context.actor={uid:'other-user',role,permissions:['dashboard:view','network:bans','chat:moderate']};
  const access=vm.runInContext('nyxOwnerAccessPayload(actor)',context);assert.equal(access.dashboard,false);assert(!access.permissions.includes('network:bans'));assert(!access.permissions.includes('dashboard:view'));
  assert.equal(vm.runInContext('nyxActorHasPermission(actor,"network:bans")',context),false);assert.equal(vm.runInContext('nyxActorHasPermission(actor,"chat:moderate")',context),true);
 }
 context.actor={uid:ownerUid,role:'owner',permissions:['dashboard:view','network:bans']};assert.equal(vm.runInContext('nyxOwnerAccessPayload(actor).dashboard',context),true);
 const rules=readFileSync('firestore.rules','utf8');for(const name of ['nyxUserAdministration','nyxAuditLog'])assert.match(rules,new RegExp('match /'+name+'/\\{[^}]+\\} \\{\\s+allow read: if false;'));
 console.log('PASS all dashboard routes use owner gate; non-owner roles/forged owner/custom claims denied before data reads; owner IP/audit access retained; chat permission unaffected; direct sensitive Firestore reads disabled');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
