import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import express from 'express';
import {chromium} from 'playwright';
const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);};
const app=express();app.use(express.json());let mutations=[],audits=[],fail=false;
const ownerUid='owner-fixture',targetUid='member-fixture';
const users=new Map([[targetUid,{uid:targetUid,emailVerified:false,displayName:'Member'}],[ownerUid,{uid:ownerUid,email:'owner@example.com'}]]);
const firebase={auth:{getUser:async uid=>users.get(uid),updateUser:async(uid,update)=>{if(fail)throw Object.assign(new Error('Sensitive provider failure'),{code:'auth/invalid-password'});mutations.push({uid,update});}},firestore:{collection:()=>({doc:()=>({get:async()=>({data:()=>({})})})})}};
const context=vm.createContext({app,founderProfileConfig:()=>({administratorUid:ownerUid}),
 sameOriginRequest:req=>req.get('sec-fetch-site')!=='cross-site',ownerDashboardActor:async req=>{if(!req.get('x-actor'))throw Object.assign(new Error('Sign in'),{status:401});const uid=req.get('x-actor'),role=req.get('x-role')||'owner';return {firebase,ownerUid,token:{uid,email:'fixture@example.com'},actor:{uid,role}};},
 nyxRolePolicy:role=>({rank:role==='owner'?100:role==='admin'?80:10}),nyxActorHasPermission:()=>true,nyxAssignableRolesForActor:()=>[],
 nyxRoleForUser:uid=>uid===ownerUid?'owner':'member',nyxRoleLabels:{owner:'Owner',admin:'Admin'},founderProfileText:(text)=>text,
 invalidateOwnerDashboardSnapshot:()=>{},recordNyxAuditSafe:async(_firebase,record)=>audits.push(record),nyxCustomRoles:async()=>[],nyxOwnerUserRecord:user=>user,nyxOwnerUserForViewer:user=>user,nyxOwnerAccessPayload:()=>({}),nyxVisibleCustomRoles:()=>[]});
vm.runInContext(['nyxOwnerUserCapabilities','assertNyxOwnerCapability'].map(declaration).join('\n'),context);
const route=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.object?.name==='app'&&n.expression?.callee?.property?.name==='patch'&&n.expression.arguments[0]?.value==='/api/owner-dashboard/users/:uid');vm.runInContext(source.slice(route.start,route.end),context);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const secret='Fixture password 123!';
const send=(body={},headers={'x-actor':ownerUid},uid=targetUid)=>fetch(`http://127.0.0.1:${server.address().port}/api/owner-dashboard/users/${uid}`,{method:'PATCH',headers:{'content-type':'application/json',...headers},body:JSON.stringify({action:'set_password',password:secret,...body})});
try{
 assert.equal((await send({},{})).status,401);
 for(const headers of [{'x-actor':'admin-fixture','x-role':'admin'},{'x-actor':'fake-owner','x-role':'owner'},{'x-actor':ownerUid,'sec-fetch-site':'cross-site'}])assert.equal((await send({},headers)).status,403);
 for(const password of ['',123,'short','x'.repeat(257)])assert.equal((await send({password})).status,400);
 assert.equal(mutations.length,0);
 for(const email of [undefined,'person@example.com','member@username.nyx.invalid']){
   users.set(targetUid,{uid:targetUid,email,emailVerified:false});const r=await send();assert.equal(r.status,200);assert(!JSON.stringify(await r.json()).includes(secret));
 }
 assert.equal(mutations.length,3);assert.deepEqual(structuredClone(mutations[0]),{uid:targetUid,update:{password:secret}});assert.equal(audits.length,3);assert.equal(audits[0].action,'password_set_by_owner');assert(!JSON.stringify(audits).includes(secret));
 fail=true;const r=await send();assert.equal(r.status,400);assert(!JSON.stringify(await r.json()).includes('Sensitive'));assert.equal(audits.length,3);
 console.log('PASS actual owner password route: owner identity enforcement, origin/auth, length/type validation, email-less/unverified aliases, sanitized errors, secret-free response/audit');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.setContent('<div id="confirm"></div>');
 const ui=readFileSync('js/owner-dashboard.js','utf8'),start=ui.indexOf('    function requestCustomPassword('),end=ui.indexOf('    function showResetLink(',start);
 await page.evaluate(code=>{const confirmHost=document.querySelector('#confirm'),esc=text=>String(text).replace(/[<>&"]/g,'');eval(code+';window.openPassword=()=>{window.result="pending";requestCustomPassword({displayName:"Member"}).then(value=>window.result=value);};');},ui.slice(start,end));
 await page.evaluate(()=>window.openPassword());assert.equal(await page.locator('input[type=password]').count(),2);
 await page.locator('[name=newPassword]').fill(secret);await page.locator('[name=confirmPassword]').fill('Wrong password 123');await page.locator('[type=submit]').click();assert.equal(await page.evaluate(()=>window.result),'pending');await page.getByText('Passwords must match.',{exact:true}).waitFor();
 await page.locator('[name=confirmPassword]').fill(secret);await page.locator('[type=submit]').click();assert.equal(await page.evaluate(()=>window.result),secret);assert.equal(await page.locator('input').count(),0);
 await page.evaluate(()=>window.openPassword());await page.locator('[name=newPassword]').fill(secret);await page.locator('[data-owner-confirm-cancel]').click();assert.equal(await page.evaluate(()=>window.result),null);assert.equal(await page.locator('input').count(),0);
 console.log('PASS actual custom password dialog: masked fields, confirmation mismatch, submit/cancel and field cleanup');
}finally{await browser.close();}
