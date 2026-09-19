import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const emojiData=createRequire(import.meta.url)('@emoji-mart/data');
import {chromium} from 'playwright';
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8'),moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const url='https://example.com/watch?v=test&list=123&foo=bar&color=red&k=1&r=2';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const role of ['member','moderator','owner']) {
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];let reactionEmoji=null,locked=true,posts=0,lockCalls=0,limited=true;
    page.on('pageerror',e=>errors.push(e.message));
    for(const [file,module] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('https://www.gstatic.com/firebasejs/11.10.0/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(module)}));
    await page.route('**/apps/chat/emoji-catalog.js*',r=>r.fulfill({contentType:'text/javascript',body:'globalThis.NYX_REACTION_EMOJIS='+JSON.stringify(Object.values(emojiData.emojis).flatMap(e=>e.skins.map((skin,i)=>({emoji:skin.native,name:e.id+(i?' skin tone '+i:'')}))))}));
    await page.route('**/socket.io/**',r=>r.abort());
    await page.route('**/api/**',r=>{
      const path=new URL(r.request().url()).pathname;
      if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'nyx-test',apiKey:'test'}});
      if(path==='/api/chat/deleted-messages')return r.fulfill({json:{messages:[{id:'retained',text:'Deleted fixture <script>unsafe</script>',author:{displayName:'Friend'},createdAtMs:1,deletedAtMs:2,deletedBy:'owner',attachmentNames:['picture.png']}],nextCursor:null}});
      if(path==='/api/chat/bootstrap')return r.fulfill({json:{me:{uid:'fixture-member',role,canModerate:role==='moderator',canManageChannels:false,displayName:'Member'},members:[],channels:[{id:'general',name:'general',description:'Public channel',locked}],conversations:[],voice:{channels:[],participants:[]}}});
      if(path==='/api/chat/channels/lock'){lockCalls++;const body=r.request().postDataJSON();assert.equal(body.channel,'general');assert.equal(body.minimumRole,undefined);locked=body.locked;return r.fulfill({json:{ok:true,channel:'general',locked}});}
      if(path.endsWith('/reactions')){reactionEmoji=r.request().postDataJSON().emoji;return r.fulfill({json:{reactions:[{emoji:reactionEmoji,count:1,self:true}]}});}
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
    await page.locator('.message').first().hover();await page.locator('.reaction-add').first().click();
    assert(await page.locator('.reaction-emoji-grid button').count()>3000);
    await page.getByRole('searchbox',{name:'Search reaction emojis'}).fill('rocket');await page.getByRole('button',{name:'React rocket',exact:true}).click();assert.equal(reactionEmoji,'\u{1F680}');
    await page.locator('.message').first().click({button:'right'});await page.getByRole('menuitem',{name:'All emojis',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('.reaction-picker').count(),0);
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
    const spacing=await page.locator('.message.grouped').first().evaluate(el=>{const text=el.querySelector('.message-text'),original=text.textContent;text.textContent='k';const result={row:el.getBoundingClientRect().height,text:text.getBoundingClientRect().height};text.textContent=original;return result;});assert(spacing.row<=spacing.text+3,'Grouped message height follows text instead of hidden avatar');
    if(role==='owner'){await page.locator('[data-deleted-messages]').click();await page.locator('[data-deleted-list] article').waitFor();assert.match(await page.locator('[data-deleted-list]').innerText(),/Deleted fixture <script>unsafe<\/script>/);assert.equal(await page.locator('[data-deleted-list] script').count(),0);await page.locator('[data-deleted-close]').click();}else assert(!await page.locator('[data-deleted-messages]').isVisible());
    if(role==='moderator'){limited=false;const before=posts;for(let i=0;i<8;i++){await input.fill('Staff burst '+i);await page.locator('[data-message-form]').evaluate(el=>el.requestSubmit());}await page.waitForFunction(()=>!document.querySelector('.message.pending'));assert.equal(posts,before+8);}
    for(const height of [844,400,650]){await page.setViewportSize({width:390,height});await page.waitForTimeout(100);const bounds=await input.boundingBox();assert(bounds.y>=0&&bounds.y+bounds.height<=height,'Composer stays within viewport without focus');}
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS literal URL ampersands and surrounding formatting; member read-only view, live lock refresh, draft restoration and cooldown, moderator /lock and /unlock without channel-manager access, no visibility mutation and mobile bounds');
}finally{await browser.close();}
