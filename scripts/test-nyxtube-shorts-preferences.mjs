import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(process.env.NYX_PALETTE_ROOT||'.'),base='http://nyx.test',embed='https://invidious.fixture.test';
const channels=['UCY1kMZp36IQSyNx_9h4mpCg','UCwmZiChSryoWQCZMIQezgTg','UC1sELGmy5jp5fQUugmuYlXQ','UCX6OQ3DkcsbYNE6H8uQQuVA'];
const video=(id,c=0)=>({id,title:id,creator:`Creator ${c}`,channelId:channels[c],durationSeconds:30,isShort:true});
const defaults=[video('DEF00000001'),video('DEF00000002',1),video('DEF00000003',2),video('DEF00000004'),video('DEF00000005',1),video('DEF00000006',2),video('DEF00000007'),video('DEF00000008',1)];
const cats=[video('CAT00000001',3),video('CAT00000002',3),video('CAT00000003',1),video('CAT00000004',2)];
const requests=[],errors=[];let releaseSlow,sawSlow;
const slowStarted=new Promise(resolve=>{sawSlow=resolve;});
const slowGate=new Promise(resolve=>{releaseSlow=resolve;});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route(base+'/**',async route=>{
    const url=new URL(route.request().url());let path=url.pathname;
    if(path.startsWith('/api/')){
      if(path.endsWith('/shorts')){
        const params=Object.fromEntries(url.searchParams);requests.push(params);
        if(params.q==='unavailable')return route.fulfill({status:503,json:{error:'The backup video service is unavailable.'}});
        if(params.q==='slow'){sawSlow();await slowGate;}
        let videos=params.q==='cats'?cats:params.q==='slow'?[video('OLD00000001')]:params.topic==='gaming'?[video('GAM00000001',2),video('GAM00000002',2)]:defaults;
        if(params.creators===channels[3])videos=[cats[0],...defaults];
        if(Number(params.page)>1)videos=[];
        try{await route.fulfill({json:{videos,nextPage:Number(params.page)===1?2:null}});}catch{/* Aborted stale searches are expected. */}
        return;
      }
      return route.fulfill({json:path.endsWith('/status')?{configured:true,nativeAvailable:false,invidiousEmbedOrigin:embed}:{videos:[],users:[]}});
    }
    if(path==='/fixture-host')return route.fulfill({contentType:'text/html',body:'<iframe id="app" src="/apps/nyxtube/" style="width:900px;height:540px;border:0"></iframe>'});
    if(path.endsWith('/'))path+='index.html';
    const file=resolve(root,'.'+decodeURIComponent(path));
    try{
      if(!file.startsWith(root+sep))throw Error('path');
      await route.fulfill({body:await readFile(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(file)]||'application/octet-stream'});
    }catch{await route.fulfill({status:404,body:'Not found'});}
  });
  await context.route(embed+'/**',route=>route.fulfill({contentType:'text/html',body:'<button>Player controls</button>'}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const open=async()=>{await page.goto(base+'/apps/nyxtube/',{waitUntil:'domcontentloaded'});await page.locator('[data-view-button="shorts"]').click();};
  const current=()=>page.locator('[data-short-player] iframe');
  const waitForId=id=>page.waitForFunction(id=>document.querySelector('[data-short-player] iframe')?.src.includes('/embed/'+id+'?'),id);
  const search=async query=>{await page.locator('[data-short-search-input]').fill(query);await page.locator('[data-short-search-form] button').click();};
  await open();await waitForId(defaults[0].id);
  const measure=()=>{
    const selectors=['.shorts-discovery','.short-card','.short-caption','[data-short-heart]','[data-short-previous]','[data-short-next]','.short-menu summary'];
    return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
      elements:selectors.map(selector=>({selector,...document.querySelector(selector).getBoundingClientRect().toJSON()})),
      animatedBackground:document.getAnimations().filter(a=>a.playState==='running'&&a.effect.target.closest?.('.starfield')).length};
  };
  const assertFit=metrics=>{
    assert.ok(metrics.scrollHeight<=metrics.height+1,`No vertical cutoff at ${metrics.width}x${metrics.height}: ${metrics.scrollHeight}`);
    assert.ok(metrics.scrollWidth<=metrics.width+1,'No horizontal overflow');
    for(const e of metrics.elements)assert.ok(e.top>=-1&&e.left>=-1&&e.bottom<=metrics.height+1&&e.right<=metrics.width+1,`${e.selector} stays within ${metrics.width}x${metrics.height}: ${JSON.stringify(e)}`);
    const stage=metrics.elements.find(e=>e.selector==='.short-card');assert.ok(Math.abs(stage.width/stage.height-9/16)<.01,'Full portrait frame retains its aspect ratio');
    assert.equal(metrics.animatedBackground,0,'Large background layers pause during Shorts');
  };
  for(const [width,height] of [[1366,768],[1024,600],[390,844],[320,568],[844,390],[600,360],[320,400]]){
    await page.setViewportSize({width,height});
    assertFit(await page.evaluate(measure));
  }
  await page.setViewportSize({width:1280,height:900});
  await search('cats');await waitForId(cats[0].id);
  await current().evaluate(frame=>{frame.dataset.searchIdentity='keep';});
  await search('unavailable');await page.waitForFunction(()=>document.querySelector('[data-notice]').textContent.includes('current video'));
  assert.equal(await current().getAttribute('data-search-identity'),'keep','failed search preserves the playing video');
  assert.equal(await page.locator('[data-short-empty]').isVisible(),false,'no blank stage replaces working playback');
  await search('cats');await waitForId(cats[0].id);
  await current().evaluate(frame=>{frame.dataset.playbackIdentity='keep';});
  await page.locator('[data-short-heart]').click();
  assert.equal(await page.locator('[data-short-heart]').getAttribute('aria-pressed'),'true');
  assert.equal(await current().getAttribute('data-playback-identity'),'keep','liking does not restart playback');
  assert.ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('nyx.shorts-preferences.v1')))).likes.some(v=>v.id==='CAT00000001'));
  await page.locator('[data-short-topic="discover"]').click();await waitForId(cats[0].id);
  assert.ok(requests.some(p=>!p.q&&p.creators===channels[3]),'hearts steer default discovery toward liked creators');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-view-button="shorts"]').click();await waitForId(cats[0].id);
  assert.equal(await page.locator('[data-short-heart]').getAttribute('aria-pressed'),'true','hearts survive reload');
  await current().evaluate(frame=>{frame.dataset.playbackIdentity='keep';});
  await page.locator('[data-short-heart]').click();
  assert.equal(await page.locator('[data-short-heart]').getAttribute('aria-pressed'),'false');
  assert.equal(await current().getAttribute('data-playback-identity'),'keep');
  await page.locator('[data-short-next]').click();await waitForId(defaults[0].id);
  await search('cats');await waitForId(cats[0].id);
  await page.locator('[data-short-menu] summary').click();await page.locator('[data-short-dislike]').click();await waitForId(cats[1].id);
  await page.locator('[data-short-menu] summary').click();await page.locator('[data-short-hide-channel]').click();await waitForId(cats[2].id);
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-view-button="shorts"]').click();await current().waitFor();
  await search('cats');await waitForId(cats[2].id);
  assert.equal(await current().count(),1,'filtering retains only one playing iframe');
  await search('slow');await slowStarted;
  await page.locator('[data-short-topic="gaming"]').click();await waitForId('GAM00000001');
  releaseSlow();await page.waitForTimeout(100);
  assert.ok((await current().getAttribute('src')).includes('GAM00000001'),'stale searches never replace a selected topic');
  await page.locator('[data-short-menu] summary').click();await page.locator('[data-short-reset]').click();await waitForId(defaults[0].id);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nyx.shorts-preferences.v1')));
  assert.deepEqual(saved,{videos:[],channels:[],likes:[]});
  await search('cats');await waitForId(cats[0].id);
  await page.locator('[data-view-button="home"]').click();assert.equal(await current().count(),0);
  const host=await context.newPage();await host.goto(base+'/fixture-host');
  const app=host.frameLocator('#app');await app.locator('[data-view-button="shorts"]').click();await app.locator('[data-short-player] iframe').waitFor();
  assertFit(await app.locator('body').evaluate(measure));
  await app.locator('[data-short-menu] summary').click();await app.locator('[data-short-hide-channel]').click();
  await host.close();
  assert.deepEqual(errors,[]);
  console.log('PASS Shorts search, mobile controls, hearts/weighted-discovery requests, uninterrupted playback, persisted likes/hides, reset and stale-search cancellation');
}finally{releaseSlow();await browser.close();}
