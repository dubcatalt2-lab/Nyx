import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const root=process.env.NYX_TEST_ASSET_ROOT||'.';
const browser=await chromium.launch({headless:true});
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let owner=false,verified=false,unlocked=false,key=null,balance=1000;
    await page.route('http://nyx.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/')return route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{border:0;width:100%;height:950px}</style><iframe src="/api"></iframe><script>addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='nyx:account-token-request')e.source.postMessage({type:'nyx:account-token-response',requestId:e.data.requestId,token:'fixture'},location.origin);});</script>`});
      if(path==='/api'||path.startsWith('/apps/api-keys/'))return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html',body:await readFile(root+(path==='/api'?'/apps/api-keys/index.html':path),'utf8')});
      if(path==='/api/v1/ai'){balance-=12;return route.fulfill({json:{choices:[{message:{content:'Rainbows form when sunlight refracts and reflects in water droplets.'}}],usage:{prompt_tokens:7,completion_tokens:5}}});}
      if(path==='/api/developer/unlock')unlocked=true;
      if(path==='/api/developer/lock')unlocked=false;
      if(path==='/api/developer/keys') {
        if(route.request().method()==='DELETE')key=null;
        else {key={prefix:'n_api_fixture',label:'Test key'};return route.fulfill({json:{key:'n_api_fixture-only-secret'}});}
      }
      if(path==='/api/developer/owner/account/member'&&route.request().method()==='POST')balance+=route.request().postDataJSON().addTokens;
      return route.fulfill({json:{uid:'member',balance,usedTokens:0,models:['google/gemini-2.5-flash-lite'],dailyRequests:20,minuteRequests:4,maxOutput:512,owner,verified,unlocked,key,configured:true,grantedTokens:1000,requestsToday:1,recent:[{at:Date.now(),model:'google/gemini-2.5-flash-lite',tokens:12,status:'completed'}]}});
    });
    await page.goto('http://nyx.test/');const frame=page.frameLocator('iframe');
    await frame.locator('#account').filter({hasText:'1,000'}).waitFor();
    assert.equal(await frame.locator('#create-button').isDisabled(),true);
    assert.equal(await frame.locator('#verify').isVisible(),true);
    verified=true;await frame.locator('#refresh').click();
    await frame.locator('#create-button').click();await frame.locator('#reveal').waitFor();
    assert.equal(await frame.locator('#secret').inputValue(),'n_api_fixture-only-secret');
    await frame.locator('#dismiss').click();assert.equal(await frame.locator('#secret').inputValue(),'');
    await frame.locator('[data-tab=playground]').click();
    assert.equal(await frame.locator('#playground-key').inputValue(),'n_api_fixture-only-secret');
    await frame.locator('#playground-prompt').fill('Explain rainbows.');await frame.locator('#playground-send').click();
    await frame.locator('#playground-response').filter({hasText:'Rainbows form'}).waitFor();
    await frame.locator('body').evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.codex-artifacts/developer-playground-${width}.png`});
    await frame.locator('[data-tab=usage]').click();await frame.locator('#usage-remaining').filter({hasText:'988'}).waitFor();
    assert.equal(await frame.locator('#usage-rows tr').count(),1);
    await frame.locator('[data-tab=keys]').click();await frame.locator('#revoke').click();
    owner=true;await frame.locator('#refresh').click();await frame.locator('[data-tab=owner]').click();await frame.locator('#owner').waitFor();
    await frame.locator('#unlock input').fill('fixture password');await frame.locator('#unlock button').click();await frame.locator('#management').waitFor();
    assert.equal(await frame.locator('#unlock input').inputValue(),'');
    await frame.locator('#lookup button').click();await frame.locator('#target').filter({hasText:'988 tokens'}).waitFor();
    await frame.locator('[name=addTokens]').fill('50');await frame.locator('#limits button').click();await frame.locator('#target').filter({hasText:'1038 tokens'}).waitFor();
    const overflow=await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`No horizontal overflow at ${width}px`);
    await page.screenshot({path:`.codex-artifacts/developer-api-${width}.png`,fullPage:true});
    await frame.locator('#lock').click();await frame.locator('#unlock').waitFor();
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: API verified-user gating, one-time reveal, playground completion, usage metrics, owner unlock/limits/relock, desktop and mobile layout');
}finally{await browser.close();}
