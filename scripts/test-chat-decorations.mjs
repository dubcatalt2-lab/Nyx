import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {parse} from 'acorn';
import vm from 'node:vm';
const server=readFileSync('server.js','utf8'),ast=parse(server,{ecmaVersion:'latest',sourceType:'module'});
const functions=['nyxChatMessagePayload','nyxChatConversationMember','nyxChatVoiceParticipant'];
const context=vm.createContext({nyxAvatarDecorationValue:v=>v==='arcane-circle'?v:'none',nyxProfileEffectValue:v=>v==='fx-void-shards'?v:'none',nyxChatConversationIdPattern:/^[a-f0-9]{40}$/,nyxChatCustomRole:()=>null,nyxRolePresentation:()=>({role:'member'}),nyxChatRole:()=> 'member',nyxChatChannel:()=> 'general',nyxChatText:String,nyxChatMessageLimit:2000,nyxChatReplyPayload:()=>null,nyxChatAttachmentMetadata:x=>x,nyxChatAttachmentCountLimit:4,nyxChatReactionPayload:()=>[],safeDateIso:()=>'',founderProfileText:v=>v,nyxProfileUsername:v=>v,nyxChatAvatar:v=>v,nyxChatVoiceChannel:v=>v});
for(const node of ast.body)if(node.type==='FunctionDeclaration'&&functions.includes(node.id.name))vm.runInContext(server.slice(node.start,node.end),context);
const person={uid:'member-user-123',displayName:'Decorated member',handle:'decorated',avatarDecoration:'arcane-circle',profileEffect:'fx-void-shards',avatarUrl:''};
for(const result of [context.nyxChatMessagePayload({id:'message1',data:()=>({author:person})}).author,context.nyxChatConversationMember(person),context.nyxChatVoiceParticipant({uid:person.uid,identity:person})]){assert.equal(result.avatarDecoration,person.avatarDecoration);assert.equal(result.profileEffect,person.profileEffect);}
assert.equal(context.nyxChatConversationMember({...person,avatarDecoration:'../../bad'}).avatarDecoration,'none');
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8'),mockModule=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [file,module] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('https://www.gstatic.com/firebasejs/11.10.0/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:mockModule(module)}));
 await page.route('**/socket.io/**',r=>r.abort());
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'nyx-test',apiKey:'test'}});
  if(path==='/api/chat/bootstrap')return r.fulfill({json:{me:{...person,self:true},members:[person],channels:[{id:'general',name:'general',type:'text'}],conversations:[],voice:{channels:[],participants:[]}}});
  if(path==='/api/chat/messages')return r.fulfill({json:{messages:[{id:'old-message',text:'An older message uses the current saved decoration.',createdAtMs:1,author:{uid:person.uid,displayName:person.displayName,avatarUrl:''}}]}});
  return r.fulfill({json:{events:[],channels:[],participants:[],signals:[]}});
 });
 await page.goto((process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199')+'/apps/chat/');
 const art=page.locator('.message .nyx-avatar-decoration');await art.waitFor({state:'visible'});
 assert.match(await art.evaluate(e=>getComputedStyle(e).backgroundImage),/arcane-circle.png/);
 assert.equal(await art.evaluate(e=>getComputedStyle(e.parentElement).overflow),'visible');
 assert.equal(await art.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 await page.locator('.member-button').first().click();await page.locator('.member-dialog[open] .nyx-user-profile-effect').waitFor({state:'visible'});
 await page.screenshot({path:'.codex-artifacts/chat-decorations.png'});
 await page.emulateMedia({reducedMotion:'reduce'});assert.match(await art.evaluate(e=>getComputedStyle(e).backgroundImage),/arcane-circle-still.png/);
 await page.locator('[data-member-dialog-close]').click();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS Chat message/DM/voice serialization, old-message decoration hydration, avatar clipping, popup artwork, reduced motion and mobile bounds');
}finally{await browser.close();}
