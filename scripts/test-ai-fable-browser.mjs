import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const server=express().use(express.static(process.env.NYX_TEST_BUILT==='1'?'dist':'.')).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const origin=process.env.NYX_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let used=100,pending=0,limit=7000,signedIn=true,usageCalls=0,chatCalls=0;
  await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
  await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getAuth=()=>({currentUser:{getIdToken:async()=>"fixture"}});export const setPersistence=async()=>{};export const browserLocalPersistence={};'}));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/auth-config'))return route.fulfill({json:{enabled:true,apiKey:'fixture',projectId:'fixture'}});
    if(path.endsWith('/providers'))return route.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}});
    if(path.endsWith('/models'))return route.fulfill({json:{models:[{id:'anthropic/claude-fable-5.1',label:'Claude Fable 5.1',text:true,allowanceLabel:'One-week trial: 5 messages total; $0.05 output/reply; input billed separately; $1.50 shared trial budget'}]}});
    if(path.endsWith('/usage')){
      usageCalls++;assert.equal(route.request().headers().authorization,'Bearer fixture');
      return route.fulfill(signedIn?{json:{fableTrial:{messageLimit:5,messagesRemaining:Math.max(0,5-chatCalls),outputLimitUsd:.05,endsAt:1793064075385},scope:'account',tokens:{limit,used,pending,remaining:limit-used-pending},periodDays:4,resetAt:Date.now()+86400000,pendingCostsUsd:pending?.001:0}}:{status:401,json:{error:'Sign in',code:'authentication'}});
    }
    if(path==='/api/nyx-ai'&&route.request().method()==='POST'){
      used+=25;chatCalls++;
      return route.fulfill({headers:{'content-type':'text/event-stream'},body:'data: {"choices":[{"delta":{"content":"Hello there."}}]}\n\ndata: [DONE]\n\n'});
    }
    return route.fulfill({json:{}});
  });
  await page.addInitScript(()=>localStorage.setItem('nyx.aiUsage.v1',JSON.stringify([{at:Date.now(),tokens:999999}])));
  await page.goto(origin+'/ai.html');
  await page.waitForFunction(()=>document.querySelector('#usageWeek')?.textContent==='6,900');
  assert.equal(await page.locator('#usageAll').textContent(),'100','Balance comes from server, not local history');
  await page.locator('#model option[value="anthropic/claude-fable-5.1"]').waitFor({state:'attached'});
  for(let i=0;i<2;i++){
    await page.locator('#input').fill('Hi');await page.locator('#send').click();
    await page.waitForFunction(expected=>document.querySelector('#usageAll').textContent===String(expected),100+(i+1)*25);
  }
  assert.equal(chatCalls,2);assert(usageCalls>=3);
  assert.match((await page.locator('#usageStatus').textContent()).normalize('NFKC'),/3 of 5 messages left/);
  assert.match((await page.locator('#usageStatus').textContent()).normalize('NFKC'),/output per reply; input billed separately/);
  assert.match((await page.locator('#usageStatus').textContent()).normalize('NFKC'),/\$1\.50 shared trial budget/);
  assert(!/\$0\.10/.test((await page.locator('#usageStatus').textContent()).normalize('NFKC')));
  await page.locator('#modelTrigger').click();
  assert.match((await page.locator('#modelOptions').innerText()).normalize('NFKC'),/5 messages total/);
  await page.setViewportSize({width:390,height:850});
  const item=page.locator('[data-model-id="anthropic/claude-fable-5.1"]');
  assert(await item.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:'.codex-artifacts/fable-trial-picker.png'});
  await item.click();
  limit=50000;pending=500;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('#usageWeek')?.textContent==='49,350');
  assert.equal(await page.locator('#usageRequests').textContent(),'500');
  assert.match((await page.locator('#usageStatus').textContent()).normalize('NFKC'),/50,000 tokens \/ 4 days/);
  assert.match((await page.locator('#usageStatus').textContent()).normalize('NFKC'),/awaiting confirmation/);
  signedIn=false;
  await page.evaluate(()=>window.postMessage({type:'nyx:ai-profile',profile:{}},location.origin));
  await page.waitForFunction(()=>document.querySelector('#usageStatus').textContent.normalize('NFKC').includes('Sign in'));
  assert.equal(await page.locator('#usageWeek').textContent(),'\u2014','Sign-out clears the previous balance');
  await page.setViewportSize({width:390,height:700});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);
  console.log('PASS Fable trial labels, mobile picker, two exchanges, premium refresh, pending costs, sign-out, stale local history isolation and mobile fit');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
