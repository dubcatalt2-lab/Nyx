import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import vm from 'node:vm';
import express from 'express';
import {chromium} from 'playwright';
const source=readFileSync('server.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const app=express(),profiles=Array.from({length:400},(_,i)=>({id:'member-'+i,handle:'@member'+String(i).padStart(3,'0')}));
let queries=[];
const firebase={firestore:{collection(name){assert.equal(name,'nyxUserProfiles');let filters=[],limit=0;const q={where(field,op,value){assert.equal(field,'profile.handle');filters.push([op,value]);return q},orderBy(field){assert.equal(field,'profile.handle');return q},limit(n){limit=n;return q},async get(){queries.push(filters);return {docs:profiles.filter(p=>filters.every(([op,v])=>op==='>='?p.handle>=v:p.handle<=v)).slice(0,limit)}}};return q}}};
const context=vm.createContext({app,authenticatedNyxChatUser:async req=>{if(req.get('authorization')!=='fixture')throw Object.assign(Error('Sign in'),{status:401});return {firebase,token:{uid:'staff'}}},nyxChatIdentity:async(_,{uid})=>({uid,handle:profiles.find(p=>p.id===uid).handle,displayName:'No email member',role:'member'}),nyxChatMemberForViewer:m=>m,signedInPresence:new Map(),signedInOnlineWindowMs:30000});
const route=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.object?.name==='app'&&n.expression?.arguments?.[0]?.value==='/api/chat/members');vm.runInContext(source.slice(route.start,route.end),context);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{const base=`http://127.0.0.1:${server.address().port}/api/chat/members`;assert.equal((await fetch(base+'?search=member')).status,401);assert.equal((await fetch(base+'?search=%25',{headers:{authorization:'fixture'}})).status,400);const result=await (await fetch(base+'?search=member399',{headers:{authorization:'fixture'}})).json();assert.equal(result.members[0].uid,'member-399');assert.equal(result.members[0].email,undefined);assert.equal((await (await fetch(base+'?search=member',{headers:{authorization:'fixture'}})).json()).members.length,20);console.log('PASS authenticated bounded username lookup finds member beyond bootstrap/directory limits without an email.');}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
const browser=await chromium.launch();
try{
 const fixture=readFileSync('scripts/test-account-controls.mjs','utf8'),moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
 for(const theme of ['', '?tutsi=1']){
  const page=await browser.newPage();let bans=[];
  for(const [file,module] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('**/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(module)}));
  await page.route('**/socket.io/**',r=>r.abort());
  await page.route('**/api/**',r=>{
   const path=new URL(r.request().url()).pathname;
   if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'nyx-test',apiKey:'test'}});
   if(path==='/api/chat/bootstrap')return r.fulfill({json:{me:{uid:'staff',role:'owner',canModerate:true,displayName:'Staff'},members:[],channels:[{id:'general',name:'general'}],conversations:[],voice:{channels:[],participants:[]}}});
   if(path==='/api/chat/members')return r.fulfill({json:{members:[{uid:'member-399',handle:'@member399',displayName:'No email member',role:'member'}]}});
   if(path==='/api/owner-dashboard/users/member-399'){bans.push(r.request().postDataJSON());return r.fulfill({json:{ok:true}})}
   return r.fulfill({json:{messages:[],events:[],channels:[],participants:[],signals:[]}});
  });
  await page.goto((process.env.NYX_TEST_BASE_URL||'http://localhost:9091')+'/apps/chat/'+theme);
  const input=page.locator('[data-message-input]');await page.locator('[data-message-form]').waitFor({state:'visible'});
  await input.fill('/ban member399');await page.locator('[data-mention-menu]').getByText('@member399',{exact:true}).waitFor();
  await page.locator('[data-mention-menu] button').first().click();assert.match(await input.inputValue(),/^\/ban @member399/);
  page.on('dialog',d=>d.accept());await input.fill('/ban @member399 Fixture reason');await page.locator('[data-message-form]').evaluate(el=>el.requestSubmit());
  for(let n=0;n<50&&!bans.length;n++)await page.waitForTimeout(100);
  if(!bans.length)console.log(await page.locator('body').innerText());
  assert.deepEqual(bans,[{action:'ban',reason:'Fixture reason'}]);await page.close();
 }
 console.log('PASS Nyx/Tutsi Chat remote username suggestions and ban-by-UID submission (fixtures only).');
}finally{await browser.close()}
