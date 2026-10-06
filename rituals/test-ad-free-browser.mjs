import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();
app.get('/adfree-fixture',(_,res)=>res.send('<!doctype html><html><body style="background:#111;color:#eee"><button id="launch">Account</button></body></html>'));
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT || '.'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=`http://127.0.0.1:${server.address().port}`;
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let row=null;
 await page.route('**/api/owner-dashboard/ad-free-keys**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()==='GET')return route.fulfill({json:{keys:row?[row]:[],nextCursor:''}});
  if(path.endsWith('/assign')){row={...row,status:'active',assignedUid:request.postDataJSON().uid,expiresAtMs:Date.now()+86400000};return route.fulfill({json:row});}
  if(path.endsWith('/revoke')){row={...row,status:'revoked'};return route.fulfill({json:row});}
  assert.equal(request.postDataJSON().durationDays,30);
  row={id:'a'.repeat(64),label:request.postDataJSON().label,suffix:'12345678',status:'unused',durationDays:30,assignedUid:''};
  return route.fulfill({status:201,json:{...row,key:'NYX-ADFREE-11111111-22222222-33333333-44444444'}});
 });
 await page.goto(base+'/adfree-fixture');
 await page.evaluate(async()=>{const mod=await import('/js/ad-free.js');await mod.openAdFreeManager({api:async(path,options={})=>{const r=await fetch(path,{...options,headers:{'Content-Type':'application/json'}});const body=await r.json();if(!r.ok)throw Error(body.error);return body;}});});
 await page.getByLabel('Label',{exact:true}).fill('<img src=x onerror=alert(1)>');
 await page.getByRole('button',{name:'Create key',exact:true}).click();
 await page.locator('[data-key-result]:visible').waitFor();
 assert.match(await page.getByLabel('New ad-free key').inputValue(),/^NYX-ADFREE/);
 assert.equal(await page.locator('[data-list] img').count(),0,'labels are escaped');
 await page.locator('[data-assign] input').fill('recipient');
 await page.getByRole('button',{name:'Assign key',exact:true}).click();
 await page.getByText('Account: recipient',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Revoke key',exact:true}).click();
 await page.getByRole('button',{name:'Confirm revocation',exact:true}).click();
 await page.locator('[data-list]').getByText('revoked',{exact:false}).waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.nyx-adfree-dialog').count(),0);
 assert(!await page.evaluate(()=>JSON.stringify({...localStorage}).includes('NYX-ADFREE-')));
 let rejected=true;
 await page.route('**/api/account/me',route=>route.fulfill({json:{uid:'recipient',publisherMode:'adkid',adFree:{active:false,expiresAtMs:null}}}));
 await page.route('**/api/account/ad-free/redeem',route=>{
  if(rejected){rejected=false;return route.fulfill({status:400,json:{error:'That key is invalid or no longer available.'}});}
  return route.fulfill({json:{uid:'recipient',publisherMode:'off',adFree:{active:true,expiresAtMs:0}}});
 });
 await page.evaluate(async()=>{window.accountEvents=[];const mod=await import('/js/ad-free.js');await mod.openAdFreeRedeem({getToken:async()=> 'fixture',onAccount:account=>window.accountEvents.push(account)});});
 await page.getByLabel('Ad-free key',{exact:true}).fill('bad');
 await page.getByRole('button',{name:'Redeem key',exact:true}).click();
 await page.getByText('That key is invalid or no longer available.',{exact:true}).waitFor();
 await page.getByLabel('Ad-free key',{exact:true}).fill('NYX-ADFREE-11111111-22222222-33333333-44444444');
 await page.getByRole('button',{name:'Redeem key',exact:true}).click();
 await page.getByText('Ad-free access is active.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.accountEvents.at(-1).publisherMode),'off');
 assert.equal(await page.locator('.nyx-adfree-dialog form').isVisible(),false);
 await page.setViewportSize({width:390,height:844});
 const bounds=await page.locator('.nyx-adfree-dialog').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth}));
 assert(bounds.left>=0&&bounds.right<=bounds.width);
 await page.screenshot({path:'.codex-artifacts/ad-free-access-preview.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS owner key UI creation, one-time reveal, assignment, revocation, label escaping; account redemption errors/success and immediate policy callback; mobile bounds and Escape cleanup.');
} finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
