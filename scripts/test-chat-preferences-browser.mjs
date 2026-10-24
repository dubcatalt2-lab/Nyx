import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';
const app=express();
if(process.env.NYX_TEST_ASSET_ORIGIN)app.use(async(req,res,next)=>{
 if(req.method!=='GET')return next();
 try{const response=await fetch(new URL(req.originalUrl,process.env.NYX_TEST_ASSET_ORIGIN));res.status(response.status).type(response.headers.get('content-type')||'application/octet-stream').send(Buffer.from(await response.arrayBuffer()));}catch(error){next(error);}
});
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8'),moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
const me={uid:'fixture-member',displayName:'Alex',handle:'@alex',role:'member'},peer={uid:'hidden-person',displayName:'\u200b',handle:'',role:'member'};
const messages=[{id:'a'.repeat(40),author:me,text:'Original',createdAtMs:Date.now()-60000},{id:'b'.repeat(40),author:peer,text:'Other message',createdAtMs:Date.now()-30000}];
let patchCount=0,conflict=false;
try{
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.handlers={};window.io=()=>{const socket={connected:true,on(name,fn){handlers[name]=fn;return this;},emit(){return this;},timeout(){return this;},disconnect(){},removeAllListeners(){},connect(){}};setTimeout(()=>handlers.connect?.(),100);return socket;};});
 for(const [file,key] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('**/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(key)}));
 await page.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname;
  if(r.request().method()==='PATCH'){
   patchCount++;if(conflict)return r.fulfill({status:409,json:{error:'This message changed. Close the editor and open it again.'}});
   const body=r.request().postDataJSON();assert.equal(body.originalText,messages[0].text);Object.assign(messages[0],{text:body.text,editedAtMs:Date.now()});return r.fulfill({json:messages[0]});
  }
  if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'fixture',apiKey:'test'}});
  if(path==='/api/chat/bootstrap')return r.fulfill({json:{me,members:[me],channels:[{id:'general',name:'general'}],conversations:[],voice:{channels:[],participants:[]}}});
  if(path==='/api/chat/messages')return r.fulfill({json:{messages}});
  return r.fulfill({json:{messages:[],events:[],relationships:[]}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/apps/chat/`);
 const own=page.getByRole('button',{name:'Message options for Alex',exact:true});await own.click();
 await page.getByRole('menuitem',{name:'Edit message',exact:true}).click();
 await page.getByLabel('Edit message text',{exact:true}).fill('Edited <script> stays text');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByRole('dialog',{name:'Edit message',exact:true}).waitFor({state:'detached'});
 assert.equal(patchCount,1);assert(await page.getByText('Edited <script> stays text',{exact:true}).isVisible());
 conflict=true;await own.click();await page.getByRole('menuitem',{name:'Edit message',exact:true}).click();
 await page.getByLabel('Edit message text',{exact:true}).fill('Draft preserved');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByText('This message changed. Close the editor and open it again.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Edit message text',{exact:true}).inputValue(),'Draft preserved');
 await page.getByRole('dialog',{name:'Edit message',exact:true}).getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(id=>window.handlers['nyx:chat:event']({kind:'edit',scopeType:'channel',scopeId:'general',messageId:id,text:'Edited in another window',editedAtMs:Date.now(),revision:100}),messages[0].id);
 await page.getByText('Edited in another window',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Message options for Member person',exact:true}).click();
 assert.equal(await page.getByRole('menuitem',{name:'Edit message',exact:true}).count(),0);
 await page.getByRole('menuitem',{name:'Mute notifications from this person',exact:true}).click();
 await page.getByRole('button',{name:'Notification settings',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Notifications',exact:true});await dialog.getByRole('button',{name:'Unmute Member person',exact:true}).waitFor();
 await page.getByLabel('Notify me about',{exact:true}).selectOption('mentions');await page.getByLabel('Space out alerts',{exact:true}).selectOption('15');
 await page.getByLabel('Mute notifications for this conversation',{exact:true}).check();
 assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.reload();
 await page.getByRole('button',{name:'Notification settings',exact:true}).click();assert.equal(await page.getByLabel('Notify me about',{exact:true}).inputValue(),'mentions');assert.equal(await page.getByLabel('Space out alerts',{exact:true}).inputValue(),'15');
 assert(await page.getByLabel('Mute notifications for this conversation',{exact:true}).isChecked());
 await dialog.getByRole('button',{name:'Unmute Member person',exact:true}).click();assert.equal(await dialog.getByRole('button',{name:/Unmute/}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS mobile edit/save/conflict, safe text, own-only edit UI, nameless sender mute, account-local preferences persistence/unmute and layout');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
