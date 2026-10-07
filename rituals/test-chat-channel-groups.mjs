import {sourceFile} from '../scripture/source-layout.mjs';
﻿import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import vm from 'node:vm';
import express from 'express';
import {parse} from 'acorn';
import {chromium} from 'playwright';
const source=readFileSync(sourceFile('shepherd.js'),'utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declaration=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end)};
let configuration={textChannels:[{id:'general',name:'Global Chat',minimumRole:'moderator',description:'Original',group:'chat'},{id:'links-abcdef',name:'Links',minimumRole:'member',group:'links'}],voiceChannels:[],customCommands:[]},writes=0;
const firebase={firestore:{collection:()=>({doc:()=>({set:async value=>{writes++;configuration=structuredClone(value)}})})}};
const ranks={member:0,moderator:1,owner:2};
const app=express();app.use(express.json());
const ctx=vm.createContext({app,randomBytes,firebase,nyxRolePolicies:Object.fromEntries(Object.keys(ranks).map(k=>[k,{}])),nyxRolePolicy:role=>({rank:ranks[role]||0}),sameOriginRequest:req=>req.get('Origin')!=='https://foreign.invalid',authenticatedNyxChatUser:async req=>{if(!req.get('Authorization'))throw Object.assign(Error('Sign in'),{status:401});return {firebase,token:{uid:req.get('Authorization')}}},nyxChatIdentity:async(_f,t)=>({role:t.uid,canManageChannels:t.uid==='owner'}),loadNyxChatConfiguration:async()=>structuredClone(configuration),nyxChatCanAccessChannel:(role,ch)=>ranks[role]>=ranks[ch.minimumRole||'member'],nyxClientIp:()=>'',nyxChatConfigurationCollection:'config',nyxChatConfigurationDocument:'channels',nyxChatConfigurationCache:{},nyxChatConfigurationTtlMs:60000,nyxChatChannelActivityCache:{},nyxChatVoiceSessions:new Map(),nyxChatVoiceSignals:new Map(),emitNyxChatVoiceRefresh:()=>{},recordNyxAuditSafe:async()=>{},refreshNyxChatSocketAuthorizations:async()=>{},recordNyxChatRealtimeEvent:()=>1,emitNyxChatSocketEvent:()=>{}});
vm.runInContext(declaration('nyxChatChannelGroup'),ctx);
for(const [channel,group] of [[{id:'announcements-91ac52'},'announcements'],[{name:'Bugs🐛'},'info'],[{name:'Suggestions'},'info'],[{id:'links-cb70af'},'links'],[{name:'General chat for randoms!'},'chat'],[{name:'Links',group:'info'},'info']])assert.equal(ctx.nyxChatChannelGroup(channel),group);
const route=ast.body.find(n=>n.expression?.callee?.property?.name==='post'&&n.expression.arguments[0]?.value==='/api/chat/channels');vm.runInContext(source.slice(route.start,route.end),ctx);
const api=app.listen(0,'127.0.0.1');await new Promise(r=>api.once('listening',r));
const save=(body,uid='owner',origin='http://localhost')=>fetch('http://127.0.0.1:'+api.address().port+'/api/chat/channels',{method:'POST',headers:{'Content-Type':'application/json',Authorization:uid,Origin:origin},body:JSON.stringify(body)});
try{
 const update={action:'update',kind:'text',id:'general',name:'Global Chat',description:'Original',minimumRole:'moderator',group:'info'};
 assert.equal((await save(update,'member')).status,403);assert.equal((await save(update,'')).status,401);assert.equal((await save(update,'owner','https://foreign.invalid')).status,403);
 assert.equal((await save({...update,group:'arbitrary'})).status,400);assert.equal(writes,0);
 assert.equal((await save(update)).status,200);assert.equal(configuration.textChannels[0].group,'info');assert.equal(configuration.textChannels[0].minimumRole,'moderator');assert.equal(configuration.textChannels[0].id,'general');
 const {group,...legacy}=update;assert.equal((await save(legacy)).status,200);assert.equal(configuration.textChannels[0].group,'info','Older clients retain saved section');
 assert.equal((await save({action:'create',kind:'text',name:'Announcements',group:'',minimumRole:'member'})).status,200);assert.equal(configuration.textChannels.at(-1).group,'announcements');
}finally{api.closeAllConnections();await new Promise(r=>api.close(r));}
const fixture=readFileSync(sourceFile('scripts/test-account-controls.mjs'),'utf8');const moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const web=express();web.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));const webServer=web.listen(0,'127.0.0.1');await new Promise(r=>webServer.once('listening',r));
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:'+webServer.address().port;
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await workspace.newPage({viewport:{width:1365,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [file,name] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('https://www.gstatic.com/firebasejs/11.10.0/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(name)}));
 let channels=[{id:'announcements-91ac52',name:'Announcements',minimumRole:'moderator'},{id:'general',name:'General',minimumRole:'member'},{id:'rules',name:'Rules',minimumRole:'member'},{id:'links-cb70af',name:'Links',minimumRole:'moderator'}],saved;
 await page.route('**/socket.io/**',r=>r.abort());
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;let json={};
  if(path.includes('auth-config'))json={enabled:true,apiKey:'test',projectId:'fixture'};
  if(path==='/api/chat/bootstrap')json={me:{uid:'fixture-owner',displayName:'Owner',role:'owner',canManageChannels:true},members:[],channels,conversations:[],latestActivity:{'links-cb70af':Date.now()+10000},voice:{channels:[],participants:[]}};
  if(path==='/api/chat/messages')json={messages:[]};
  if(path==='/api/chat/channels'){saved=r.request().postDataJSON();channels=channels.map(ch=>ch.id===saved.id?{...ch,...saved}:ch);json={textChannels:channels,voiceChannels:[]};}
  return r.fulfill({json});
 });
 await page.goto(base+'/apps/chat/');await page.locator('[data-channel-group="links"]').waitFor();
 assert.deepEqual(await page.locator('[data-channel-group]').evaluateAll(nodes=>nodes.filter(n=>n.tagName==='SECTION').map(n=>n.dataset.channelGroup)),['announcements','chat','info','links']);
 assert(await page.locator('[data-channel-group-toggle="links"]').evaluate(e=>e.classList.contains('unread')));
 await page.getByRole('button',{name:'Links',exact:true}).first().click();assert(await page.locator('#chat-group-links').isHidden());
 await page.locator('[data-channel-id="rules"]').click();await page.waitForFunction(()=>document.querySelector('[data-channel-title]').textContent==='Rules');assert(await page.locator('#chat-group-links').isHidden(),'A channel change preserves collapsed sections');
 await page.getByRole('button',{name:'Manage channels'}).click();const dialog=page.locator('[data-channel-manager-dialog]');
 await dialog.locator('.channel-manager-item').filter({hasText:'Links'}).getByRole('button',{name:'Edit channel'}).click();await dialog.locator('[data-channel-group-select]').selectOption('info');await dialog.getByRole('button',{name:'Save changes'}).click();
 await page.waitForFunction(()=>document.querySelector('[data-channel-group="info"] [data-channel-id="links-cb70af"]'));
 assert.equal(saved.minimumRole,'moderator');assert.equal(saved.id,'links-cb70af');assert.equal(saved.group,'info');
 await page.keyboard.press('Escape');await page.screenshot({path:'.codex-artifacts/chat-social/channel-sections.png'});
 await page.setViewportSize({width:390,height:700});await page.getByRole('button',{name:'Show channels'}).click();await page.locator('[data-channel-id="links-cb70af"]').click();await page.waitForFunction(()=>document.querySelector('[data-channel-title]').textContent==='Links');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS channel grouping, custom IDs, collapse/unread state, section editor, legacy updates, preserved access/history IDs, auth and mobile navigation');
}finally{await workspace.close();webServer.closeAllConnections();await new Promise(r=>webServer.close(r));}
