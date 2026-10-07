import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const server=express().use(express.static(process.env.NYX_TEST_BUILT==='1'?'dist':'.')).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const workspace=await chromium.launch({channel:'msedge',headless:true});
try {for(const brand of ['nyx','tutsi','nook','drop']){
 const page=await workspace.newPage();const errors=[];let attempts=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'const auth={currentUser:{uid:"fixture",getIdToken:async()=>"fixture"}};export const getAuth=()=>auth;export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(a,f)=>f(a.currentUser);export const signOut=async()=>{};'}));
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/auth-config'))return route.fulfill({json:{enabled:true,apiKey:'fixture',projectId:'fixture'}});
  if(url.pathname.endsWith('/providers'))return route.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}});
  if(url.pathname.endsWith('/models'))return route.fulfill({json:{models:[{id:'openai/test',label:'Test',text:true,outputModalities:['text']}]}});
  if(route.request().method()==='POST'&&/\/api\/(nyx|tutsi|nook|drop)-ai$/.test(url.pathname)){
   attempts++;assert.equal(url.pathname,'/api/'+brand+'-ai');
   return route.fulfill({status:429,headers:{'retry-after':'2'},json:{error:'Please wait 2 seconds before sending another AI message.'}});
  }
  return route.fulfill({json:{profile:{handle:'fixture'}}});
 });
 if(brand==='tutsi')await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.appShell='tutsi';}));
 if(brand==='drop'){
  await page.route(origin+'/test-frame',r=>r.fulfill({contentType:'text/html',body:'<iframe src="/apps/agents/?shell=drop"></iframe>'}));
  await page.goto(origin+'/test-frame');
 }else await page.goto(origin+(brand==='nook'?'/apps/agents/':'/ai.html'));
 const ui=brand==='drop'?page.frameLocator('iframe'):page;
 const agents=['nook','drop'].includes(brand);
 await ui.locator('#model option[value="openai/test"]').waitFor({state:'attached'});
 const input=ui.locator(agents?'#prompt':'#input');await input.fill('Hello');await ui.locator('#send').click();
 await ui.locator('.ai-send-cooldown').waitFor();assert(await ui.locator('#send').isDisabled());
 await input.fill('My next draft');
 await ui.locator(agents?'#composer':'#form').evaluate(form=>form.requestSubmit());
 assert.equal(attempts,1,'Enter must not bypass cooldown');
 await page.waitForTimeout(2400);assert(!(await ui.locator('#send').isDisabled()));assert.equal(await input.inputValue(),'My next draft');
 assert.equal(attempts,1,'No automatic paid retry');assert.deepEqual(errors,[]);
 await page.close();console.log('PASS '+brand+' countdown, preserved draft, submit blocking and automatic unlock');
 }}finally{await workspace.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
