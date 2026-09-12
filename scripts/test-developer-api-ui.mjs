import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const root=process.env.NYX_TEST_ASSET_ROOT||'.';
// Exercise the real host bridge, including its source/origin checks.
const host=await readFile('script.js','utf8');
const sourcePredicate=host.match(/const nyxAccountClientSourcePath=([^;]+);/)[1];
const validPath=new Function('nyxChatSourcePath','return '+sourcePredicate)(()=>false);
assert.ok(validPath('/api'));assert.ok(validPath('/apps/api-keys/index.html'));assert.ok(!validPath('/untrusted'));
const bridge=host.slice(host.indexOf("      if(e.data.type==='nyx:account-open-signin'){"),host.indexOf("      if(e.data.type==='nyx:account-token-request'){"));
const handle=new Function('e','location','state','nyxAccountClientSourcePath','browserMessageSourcePath','openNyxAccountAccess',bridge);
let opened=0;const source={},state={tabs:[{frame:{contentWindow:source},path:'/api'}]};
const send=(origin,from=source)=>handle({origin,source:from,data:{type:'nyx:account-open-signin'}},{origin:'http://nyx.test'},state,validPath,t=>t.path,()=>opened++);
send('http://evil.test');send('http://nyx.test',{});assert.equal(opened,0);
send('http://nyx.test');assert.equal(opened,1);
const browser=await chromium.launch({headless:true});
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let owner=false,verified=false,unlocked=false,key=null,balance=1000,premium=false;
    const answer='Rainbows form **in water droplets**.\n\n1. First step\n2. Second step\n\n$34 \\times 3 = 102$\n\n```js\n'+ 'x'.repeat(400)+'\n```\n\n<img src=x onerror=alert(1)>\n\n'+('Long response paragraph. '.repeat(15)+'\n\n').repeat(30)+'Last paragraph.';
    await page.route('http://nyx.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/')return route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Outfit,Arial,sans-serif;background:#141414}iframe{border:0;width:100%;height:950px}</style><iframe src="/api"></iframe><script>window.signedIn=false;addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='nyx:account-token-request')e.source.postMessage({type:'nyx:account-token-response',requestId:e.data.requestId,token:window.signedIn?'fixture':''},location.origin);if(e.origin===location.origin&&e.data.type==='nyx:account-open-signin'){window.signedIn=true;e.source.postMessage({type:'nyx:account-changed'},location.origin);}});</script>`});
      if(path.startsWith('/assets/vendor/katex/'))return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'font/woff2',body:await readFile(root==='.'?'node_modules/katex/dist/'+path.split('/katex/')[1]:root+path)});
      if(path==='/assets/icons/nyx-monogram.png')return route.fulfill({contentType:'image/png',body:await readFile(root+path)});
      if(path==='/api'||path.startsWith('/apps/api-keys/')||['/js/ai-markdown.js','/apps/utility-shell.css','/apps/visual-redesign.css','/assets/vendor/three.r134.min.js','/js/beams-wallpaper.js','/js/line-waves-wallpaper.js'].includes(path))return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html',body:await readFile(root+(path==='/api'?'/apps/api-keys/index.html':path),'utf8')});
      if(path==='/api/v1/ai'){balance-=12;return route.fulfill({json:{choices:[{message:{content:answer},finish_reason:'length'}],usage:{prompt_tokens:7,completion_tokens:5}}});}
      if(path==='/api/developer/owner/account/member/reveal-key')return route.fulfill({json:{key:'n_api_owner-reveal-fixture'}});
      if(path==='/api/developer/owner/accounts')return route.fulfill({json:{members:[{uid:'member',name:'Test Member',balance,usedTokens:12,key:{prefix:'n_api_fixture'}}],nextCursor:null}});
      if(path==='/api/developer/unlock')unlocked=true;
      if(path==='/api/developer/lock')unlocked=false;
      if(path==='/api/developer/keys') {
        if(route.request().method()==='DELETE')key=null;
        else {key={prefix:'n_api_fixture',label:'Test key'};return route.fulfill({json:{key:'n_api_fixture-only-secret'}});}
      }
      if(path==='/api/developer/owner/account/member'&&route.request().method()==='POST')balance+=route.request().postDataJSON().addTokens;
      return route.fulfill({json:{uid:'member',premium,monthlyModelLimits:premium?{luna:25000,gemini:50000}:{luna:0,gemini:0},modelAllowances:premium?{'openai/gpt-5.6-luna':{limit:25000,used:0,remaining:25000},'google/gemini-2.5-flash-lite':{limit:50000,used:0,remaining:50000}}:undefined,balance,usedTokens:0,models:['google/gemini-2.5-flash-lite'],dailyRequests:20,minuteRequests:4,maxOutput:512,owner,verified,unlocked,key,configured:true,grantedTokens:1000,requestsToday:1,recent:[{at:Date.now(),model:'google/gemini-2.5-flash-lite',tokens:12,status:'completed'}]}});
    });
    await page.goto('http://nyx.test/');const frame=page.frameLocator('iframe');
    await frame.locator('#notice').filter({hasText:'Sign in to Nyx to continue.'}).waitFor();
    await frame.locator('#sign-in').click();
    await frame.locator('#account').filter({hasText:'1,000'}).waitFor();
    assert.equal(await frame.locator('#sign-in').isVisible(),false,'Signed-in users must not see a sign-in link');
    assert.equal(await frame.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await frame.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
    assert.equal(await frame.locator('#nyxBeamsBg').count(),0,'Embedded page must not duplicate wallpaper rendering');
    assert.equal(await frame.locator('#create-button').isDisabled(),false,'Email verification is not required');
    assert.equal(await frame.locator('#verify').count(),0);
    verified=true;await frame.locator('#refresh').click();
    await frame.locator('#create-button').click();await frame.locator('#reveal').waitFor();
    assert.equal(await frame.locator('#secret').inputValue(),'n_api_fixture-only-secret');
    await frame.locator('#dismiss').click();assert.equal(await frame.locator('#secret').inputValue(),'');
    await frame.locator('[data-tab=playground]').click();
    assert.equal(await frame.locator('#playground-key').inputValue(),'n_api_fixture-only-secret');
    await frame.locator('#playground-prompt').fill('Explain rainbows.');await frame.locator('#playground-send').click();
    await frame.locator('#playground-response strong').filter({hasText:'in water droplets'}).waitFor();
    assert.equal(await frame.locator('#playground-response li').count(),2);
    assert.equal(await frame.locator('#playground-response .katex').count(),1);
    assert.equal(await frame.locator('#playground-response img').count(),0);
    assert.equal(await frame.locator('#playground-limit').isVisible(),true);
    assert.equal(await frame.locator('#playground-tokens').inputValue(),'512');
    const geometry=await frame.locator('#playground-response').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+1}));
    assert.ok(geometry.height>950,'Long answers expand beyond the viewport');
    assert.ok(geometry.scroll<=geometry.height+1,'Response is not clipped');
    assert.equal(geometry.overflow,false,'Wide code stays inside the response');
    await frame.locator('#playground-response p').last().scrollIntoViewIfNeeded();
    assert.equal(await frame.locator('#playground-response p').last().textContent(),'Last paragraph.');
    await frame.locator('body').evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.codex-artifacts/developer-playground-${width}.png`});
    await frame.locator('[data-tab=usage]').click();await frame.locator('#usage-remaining').filter({hasText:'988'}).waitFor();
    assert.equal(await frame.locator('#usage-rows tr').count(),1);
    await frame.locator('[data-tab=keys]').click();await frame.locator('#revoke').click();
    owner=true;await frame.locator('#refresh').click();await frame.locator('[data-tab=owner]').click();await frame.locator('#owner').waitFor();
    await frame.locator('#unlock input').fill('fixture password');await frame.locator('#unlock button').click();await frame.locator('#management').waitFor();await frame.locator('#members-rows').filter({hasText:'Test Member'}).waitFor();
    assert.equal(await frame.locator('#unlock input').inputValue(),'');
    await frame.locator('#lookup button').click();await frame.locator('#target').filter({hasText:'988 tokens'}).waitFor();assert.equal(await frame.locator('[name=lunaMonthlyLimit]').isVisible(),false,'Non-Premium accounts must not show a monthly allowance');
    await frame.locator('[name=addTokens]').fill('50');await frame.locator('#limits button[type=submit]').click();await frame.locator('#target').filter({hasText:'1038 tokens'}).waitFor();
    premium=true;key={prefix:'n_api_fixture',label:'Test key',revealAvailable:true};await frame.locator('#lookup button').click();await frame.locator('[name=lunaMonthlyLimit]').waitFor();
    assert.equal(await frame.locator('[name=lunaMonthlyLimit]').inputValue(),'25000');assert.equal(await frame.locator('[name=geminiMonthlyLimit]').inputValue(),'50000');
    assert.match(await frame.locator('#target').textContent(),/Luna: 25,000 \/ 25,000/);
    await frame.locator('#owner-show-key').click();await frame.locator('#owner-key-reveal').waitFor();
    assert.equal(await frame.locator('#owner-key-value').inputValue(),'n_api_owner-reveal-fixture');
    assert.equal(await frame.locator('body').evaluate(()=>JSON.stringify(localStorage).includes('n_api_owner-reveal-fixture')),false);
    await frame.locator('#owner-key-hide').click();assert.equal(await frame.locator('#owner-key-value').inputValue(),'');
    await frame.locator('#owner-show-key').click();await frame.locator('#owner-key-reveal').waitFor();
    await frame.locator('[data-tab=usage]').click();assert.equal(await frame.locator('#owner-key-value').inputValue(),'');
    await frame.locator('[data-tab=owner]').click();
    const overflow=await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`No horizontal overflow at ${width}px`);
    await page.screenshot({path:`.codex-artifacts/developer-api-${width}.png`,fullPage:true});
    await frame.locator('#lock').click();await frame.locator('#unlock').waitFor();
    await page.evaluate(()=>{window.signedIn=false;document.querySelector('iframe').contentWindow.postMessage({type:'nyx:account-changed'},location.origin);});
    await frame.locator('#sign-in').waitFor();assert.equal(await frame.locator('#create-button').isDisabled(),true);
    assert.equal(await frame.locator('#owner-tab').isVisible(),false);
    assert.deepEqual(errors,[]);
    await page.addInitScript(()=>localStorage.setItem('nyx.beamWallpaper','rose'));
    await page.goto('http://nyx.test/api');await page.locator('#nyxBeamsBg[data-preset=rose]').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-nyx-beam-wallpaper'),'rose');
    assert.match(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily),/Outfit/);
    assert.equal(await page.locator('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.locator('.brand-logo').evaluate(el=>el.decode());assert.ok(await page.locator('.brand-logo').evaluate(el=>el.naturalWidth>0));
    await page.screenshot({path:`.codex-artifacts/developer-nyx-theme-${width}.png`});await page.close();
  }
  console.log('PASS: API account-only access, one-time reveal, playground completion, usage metrics, owner unlock/limits/relock, desktop and mobile layout');
}finally{await browser.close();}
