import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';

const fixture=readFileSync('scripts/test-account-controls.mjs','utf8');
const moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const app=express();app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||process.cwd()));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
const me={uid:'test-user-1234',displayName:'Owner',handle:'@owner',role:'owner',canModerate:true};
const peer={uid:'target-user-1234',displayName:'River',handle:'@river',role:'member'};
const devices=[{id:'a'.repeat(64),label:'Chrome on Windows',lastSeenAt:Date.now(),banned:false},{id:'b'.repeat(64),label:'Firefox on Linux',lastSeenAt:Date.now(),banned:false}];
const writes=[],errors=[];let listCalls=0,accountCalls=0,duplicate=false;const accountWrites=[];
try{
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  for(const [file,name] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('https://www.gstatic.com/firebasejs/11.10.0/'+file,route=>route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(name)}));
  await page.route('**/socket.io/**',route=>route.abort());
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;let payload={};
    if(path==='/api/founder-profile/auth-config')payload={enabled:true,projectId:'fixture',apiKey:'test'};
    if(path==='/api/chat/bootstrap')payload={me,members:[me],channels:[{id:'general',name:'general'}],conversations:[],voice:{channels:[],participants:[]}};
    if(path==='/api/owner-dashboard')payload={users:[{...peer,displayName:'River Song',username:'river'},...(duplicate?[{...peer,uid:'duplicate',displayName:'River Song',username:'other'}]:[])],pagination:{pages:1,truncated:false}};
    if(path==='/api/chat/members')payload={members:[peer]};
    if(path==='/api/chat/messages')payload={messages:[]};
    if(path==='/api/chat/relationships')payload={relationships:[]};
    if(path==='/api/chat/q74bd9/'+peer.uid){
      if(route.request().method()==='PATCH'){const body=route.request().postDataJSON();writes.push(body);devices.find(item=>item.id===body.id).banned=body.action==='ban';payload={ok:true};}
      else{listCalls++;payload={devices};}
    }
    if(path.startsWith('/api/owner-dashboard/users/')){accountCalls++;accountWrites.push(route.request().postDataJSON());payload={ok:true};}
    return route.fulfill({json:payload});
  });
  const open=async()=>{await page.goto('http://127.0.0.1:'+server.address().port+'/apps/chat/');await page.locator('[data-message-input]').waitFor({state:'visible'});};
  const command=async text=>{await page.locator('[data-message-input]').fill(text);await page.locator('[data-message-form]').evaluate(form=>form.requestSubmit());};
  const dialog=page.locator('dialog[data-q74bd9]');
  await open();await command('/ban device @river');await dialog.waitFor();
  assert.equal(await dialog.locator('input:checked').count(),0,'Multiple devices require explicit selection');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.length,0);
  await command('/ban device @river');await dialog.waitFor();
  await dialog.locator('input[type=radio]').nth(1).check();await dialog.getByLabel('Reason',{exact:true}).fill('Test moderation');
  await dialog.getByRole('button',{name:'Block selected browser',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');
  assert.deepEqual(writes,[{id:'b'.repeat(64),reason:'Test moderation',action:'ban'}]);assert.equal(accountCalls,0);
  await command('/unban device @river');await dialog.waitFor();assert.equal(await dialog.locator('input[type=radio]').count(),1);
  await dialog.getByRole('button',{name:'Unblock selected browser',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');assert.equal(writes.at(-1).action,'unban');
  page.on('dialog',dialog=>dialog.accept());await command('/ban @river ordinary account ban');
  await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');assert.equal(accountCalls,1,'Existing account ban still uses its original endpoint');
  me.role='member';await open();const before=listCalls;await command('/ban device @river');
  await page.waitForFunction(()=>document.querySelector('[data-chat-notice]').textContent.normalize('NFKC').replaceAll('3','e').replaceAll('0','o').toLowerCase().includes('only the owner can manage browser bans.'));assert.equal(listCalls,before);assert.equal(writes.length,2);
  me.role='owner';await open();
  await command('/device ban "River Song"');await dialog.waitFor();
  assert.equal(await dialog.locator('input[type=radio]').count(),2);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await command('/ban "River Song" test');await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');assert.equal(accountCalls,2);
  duplicate=true;await command('/ban "River Song" test');
  await page.waitForFunction(()=>document.querySelector('[data-chat-notice]').textContent.normalize('NFKC').replaceAll('3','e').replaceAll('0','o').includes('@other'));assert.equal(accountCalls,2);
  duplicate=false;await command('/role add @river mod');await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');assert.deepEqual(accountWrites.at(-1),{action:'set_role',role:'moderator'});
  await command('/role add Moderator @river');await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');assert.equal(accountWrites.at(-1).role,'moderator');
  assert.deepEqual(errors,[]);console.log('PASS chat command selection, cancellation, targeted ban/unban, unchanged account command, owner restriction and browser runtime');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
