import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const server=express().use(express.static(process.env.NYX_TEST_BUILT==='1'?'dist':'.')).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const origin=process.env.NYX_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}`;
const workspace=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await workspace.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let used=100,pending=0,limit=7000,signedIn=true,usageCalls=0,chatCalls=0;
  await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
  await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getAuth=()=>({currentUser:{getIdToken:async()=>"fixture"}});export const setPersistence=async()=>{};export const browserLocalPersistence={};'}));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/auth-config'))return route.fulfill({json:{enabled:true,apiKey:'fixture',projectId:'fixture'}});
    if(path.endsWith('/providers'))return route.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}});
    if(path.endsWith('/models'))return route.fulfill({json:{models:[{id:'google/gemini-fixture',label:'Test',text:true}]}});
    if(path.endsWith('/usage')){
      usageCalls++;assert.equal(route.request().headers().authorization,'Bearer fixture');
      return route.fulfill(signedIn?{json:{scope:'account',tokens:{limit,used,pending,remaining:limit-used-pending},periodDays:4,resetAt:Date.now()+86400000,pendingCostsUsd:pending?.001:0}}:{status:401,json:{error:'Sign in',code:'authentication'}});
    }
    if(path==='/api/nyx-ai'&&route.request().method()==='POST'){
      used+=25;chatCalls++;
      return route.fulfill({headers:{'content-type':'text/event-stream'},body:'data: {"choices":[{"delta":{"content":"Hello there."}}]}\n\ndata: [DONE]\n\n'});
    }
    return route.fulfill({json:{}});
  });
  await page.addInitScript(()=>localStorage.setItem('nyx.aiUsage.v1',JSON.stringify([{at:Date.now(),tokens:999999}])));
  await page.goto(origin+'/ai.html');
  await page.waitForFunction(()=>document.querySelector('#usageWeek').textContent==='6,900');
  assert.equal(await page.locator('#usageAll').textContent(),'100','Balance comes from server, not local history');
  await page.locator('#model option[value="google/gemini-fixture"]').waitFor({state:'attached'});
  for(let i=0;i<6;i++){
    await page.locator('#input').fill('Hi');await page.locator('#send').click();
    await page.waitForFunction(expected=>document.querySelector('#usageAll').textContent===String(expected),100+(i+1)*25);
  }
  assert.equal(chatCalls,6);assert(usageCalls>=7);
  limit=50000;pending=500;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('#usageWeek').textContent==='49,250');
  assert.equal(await page.locator('#usageRequests').textContent(),'500');
  assert.match(await page.locator('#usageStatus').textContent(),/50,000 tokens \/ 4 days/);
  assert.match(await page.locator('#usageStatus').textContent(),/awaiting confirmation/);
  signedIn=false;
  await page.evaluate(()=>window.postMessage({type:'nyx:ai-profile',profile:{}},location.origin));
  await page.waitForFunction(()=>document.querySelector('#usageStatus').textContent.includes('Sign in'));
  assert.equal(await page.locator('#usageWeek').textContent(),'\u2014','Sign-out clears the previous balance');
  await page.setViewportSize({width:390,height:700});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);
  console.log('PASS workspace server balance, six exchanges, premium refresh, pending costs, sign-out, stale local history isolation and mobile fit');
}finally{await workspace.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
