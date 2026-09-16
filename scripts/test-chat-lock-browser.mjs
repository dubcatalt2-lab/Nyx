import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8'),moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const url='https://example.com/watch?v=test&list=123&foo=bar&color=red&k=1&r=2';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const role of ['member','moderator']) {
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];let locked=true,posts=0,lockCalls=0,limited=true;
    page.on('pageerror',e=>errors.push(e.message));
    for(const [file,module] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('https://www.gstatic.com/firebasejs/11.10.0/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(module)}));
    await page.route('**/socket.io/**',r=>r.abort());
    await page.route('**/api/**',r=>{
      const path=new URL(r.request().url()).pathname;
      if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'nyx-test',apiKey:'test'}});
      if(path==='/api/chat/bootstrap')return r.fulfill({json:{me:{uid:'fixture-member',role,canModerate:role==='moderator',canManageChannels:false,displayName:'Member'},members:[],channels:[{id:'general',name:'general',description:'Public channel',locked}],conversations:[],voice:{channels:[],participants:[]}}});
      if(path==='/api/chat/channels/lock'){lockCalls++;const body=r.request().postDataJSON();assert.equal(body.channel,'general');assert.equal(body.minimumRole,undefined);locked=body.locked;return r.fulfill({json:{ok:true,channel:'general',locked}});}
      if(path==='/api/chat/channels')throw Error('Lock must not change channel visibility');
      if(path==='/api/chat/messages'&&r.request().method()==='POST'){posts++;if(limited)return r.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:'Please wait before sending again.'}});return r.fulfill({json:{message:{id:'a'.repeat(40),text:r.request().postDataJSON().text,author:{uid:'fixture-member',displayName:'Member'},createdAtMs:Date.now()}}});}
      if(path==='/api/chat/messages'&&r.request().method()==='GET')return r.fulfill({json:{messages:[url,'&aGreen &r'+url+' &lBold','www.example.com/a?a=1&list=2','example.com/a?a=1&color=red'].map((text,i)=>({id:String(i).repeat(40),text,author:{uid:'url-author',displayName:'URL tester'},createdAtMs:Date.now()+i}))}});
      return r.fulfill({json:{messages:[],events:[],channels:[],participants:[],signals:[]}});
    });
    await page.goto((process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199')+'/apps/chat/');
    const input=page.locator('[data-message-input]'),send=page.locator('[data-send-button]');
    await page.locator('[data-message-form]').waitFor({state:'visible'});
    assert.match(await page.locator('[data-channel-description]').innerText(),/Locked/);
    await page.locator('.message-text').first().waitFor();
    assert.equal(await page.locator('.message-text').nth(0).innerText(),url);
    assert.equal(await page.locator('.message-text').nth(0).locator('.minecraft-segment').count(),0);
    assert.equal(await page.locator('.message-text').nth(1).innerText(),'Green '+url+' Bold');
    assert.equal(await page.locator('.message-text').nth(1).locator('.minecraft-segment').last().evaluate(el=>el.style.fontWeight),'900');
    assert.equal(await page.locator('.message-text').nth(2).innerText(),'www.example.com/a?a=1&list=2');
    assert.equal(await page.locator('.message-text').nth(3).innerText(),'example.com/a?a=1&color=red');
    if(role==='member') {
      assert(await input.evaluate(el=>el.readOnly));assert(await send.isDisabled());assert(await page.locator('[data-attachment-button]').isDisabled());
      await input.evaluate(el=>{el.readOnly=false;el.value='bypass';});await page.locator('[data-message-form]').evaluate(el=>el.requestSubmit());assert.equal(posts,0);
      locked=false;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>!document.querySelector('[data-message-input]').readOnly);
      await input.fill('test cooldown');await send.click();await page.waitForFunction(()=>document.querySelector('[data-message-count]').textContent.includes('Wait'));
      assert(await send.isDisabled());assert.equal(await input.inputValue(),'test cooldown');
      await page.locator('[data-message-form]').evaluate(el=>el.requestSubmit());assert.equal(posts,1);
      await page.waitForFunction(()=>!document.querySelector('[data-send-button]').disabled);limited=false;await send.click();await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');
      locked=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>document.querySelector('[data-message-input]').readOnly);
    } else {
      assert(!await input.evaluate(el=>el.readOnly));
      await input.fill('/unlock');await send.click();await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');assert.equal(lockCalls,1);assert.equal(locked,false);assert.equal(posts,0);
      await input.fill('/lock');await send.click();await page.waitForFunction(()=>document.querySelector('[data-message-input]').value==='');assert.equal(lockCalls,2);assert.equal(locked,true);assert(!await input.evaluate(el=>el.readOnly));
    }
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS literal URL ampersands and surrounding formatting; member read-only view, live lock refresh, draft restoration and cooldown, moderator /lock and /unlock without channel-manager access, no visibility mutation and mobile bounds');
}finally{await browser.close();}
