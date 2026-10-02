import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';

const root=resolve(process.env.NYX_TEST_ASSET_ROOT || '.');
const browser=await chromium.launch({headless:true});
await mkdir('.codex-artifacts',{recursive:true});
const now=Date.UTC(2026,9,1,19,34,30);
function fixture(minutes) {
  const end=Math.floor(now/60000)*60000;
  const points=Array.from({length:minutes},(_,i)=>({at:end-(minutes-1-i)*60000,requests:i<minutes-58?null:i===minutes-18?840:i===minutes-37?410:42+(i%7)*11,errors:i===minutes-18?6:0,partial:i===minutes-1}));
  points[minutes-32].requests=null;
  return {minutes,points,startedAt:end-57*60000,generatedAt:now,totals:{requests:points.reduce((sum,p)=>sum+(p.requests||0),0),errors:6,aborted:2,averageMs:84},peak:{at:end-17*60000,requests:840,partial:false},peakMembers:{count:47,at:end-9*60000}};
}
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:1000},timezoneId:'America/Los_Angeles'});
    await page.clock.install({time:new Date(now)});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let trafficCalls=0,failTraffic=false,founder=true,lastQuery='';
    await page.route('http://nyx.test/**',async route=>{
      const url=new URL(route.request().url()),path=url.pathname;
      if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/owner-dashboard-polish.css"></head><body class="browser-shell"><script src="/js/owner-dashboard.js"></script></body></html>'});
      if(!path.startsWith('/api/')) {
        const asset=resolve(root,'.'+path);
        if(!asset.startsWith(root+sep))return route.fulfill({status:404,body:''});
        try{return route.fulfill({body:await readFile(asset),contentType:({'.css':'text/css','.js':'application/javascript','.ttf':'font/ttf','.woff2':'font/woff2'})[extname(asset)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
      }
      assert.equal(route.request().headers().authorization,'Bearer fixture');
      let body={};
      if(path==='/api/owner-dashboard') {
        lastQuery=url.search;
        body={access:{role:founder?'owner':'admin',founder,permissions:['network:bans']},metrics:{totalUsers:902,activeToday:143,onlineUsers:27,newSignups:85,premiumSubscribers:18,monthlyRevenueCents:25000},
          users:[{uid:'fixture-member',displayName:'Test Member',username:'member',email:'member@example.test',role:'member',subscriptionStatus:'free',online:true,lastActiveAt:now}],pagination:{total:1,accounts:1,pages:1},recentActivity:[]};
      }
      if(path==='/api/owner-dashboard/traffic'){
        trafficCalls++;
        if(failTraffic)return route.fulfill({status:503,json:{error:'Unavailable'}});
        body=fixture(Number(url.searchParams.get('minutes'))||60);
      }
      if(path==='/api/owner-dashboard/ai-status')body={state:'ok',balanceUsd:28.57,keyRemainingUsd:10.48,dailyCapUsd:1,checkedAt:now};
      if(path==='/api/owner-dashboard/nyxtube')body={enabled:true,state:'working',lastSuccess:now};
      return route.fulfill({json:body});
    });
    await page.goto('http://nyx.test/');
    await page.evaluate(()=>{window.dashboard=NyxOwnerDashboard.open({getToken:async()=>'fixture'});});
    await page.clock.runFor(200);
    await page.locator('[data-traffic-state="ready"]').waitFor({timeout:10000}).catch(async error=>{
      console.error({width,errors,trafficCalls,body:(await page.locator('.nyx-owner-dashboard').innerText()).slice(0,1800)});
      await page.screenshot({path:'.codex-artifacts/owner-traffic-failure.png'});throw error;
    });
    assert.ok(await page.locator('[data-owner-panel="users"]').isHidden());
    assert.ok(await page.locator('[data-owner-ai-status]').isHidden());
    assert.match(await page.locator('[data-traffic-stats]').innerText(),/840/);
    assert.match(await page.locator('[data-traffic-stats]').innerText(),/Peak members\s+47/);
    assert.match(await page.locator('[data-traffic-detail]').innerText(),/12:17 PM/,'Peak time uses the viewer timezone');
    const chartBox=await page.locator('[data-traffic-chart]').boundingBox();assert.ok(chartBox.width>250);
    const fit=await page.locator('.nyx-owner-dashboard').evaluate(node=>({scroll:node.scrollWidth,width:node.clientWidth}));assert.ok(fit.scroll<=fit.width+1,'Dashboard fits the viewport');
    await page.screenshot({path:`.codex-artifacts/owner-overview-${width}.png`,fullPage:true});
    await page.locator('[data-owner-traffic]').screenshot({path:`.codex-artifacts/owner-traffic-${width}.png`});
    const slider=page.locator('[data-traffic-minute]');await slider.focus();await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('[data-traffic-detail]').innerText(),/12:18 PM/,'Keyboard can inspect adjacent minutes');
    await page.locator('[data-traffic-range="1440"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-traffic-minute]').max==='57');
    await slider.fill('0');assert.doesNotMatch(await page.locator('[data-traffic-detail]').innerText(),/No measurement/,'Leading unrecorded time does not squeeze the chart');
    await slider.fill('26');assert.match(await page.locator('[data-traffic-detail]').innerText(),/No measurement/,'Internal measurement gaps remain honest');
    failTraffic=true;await page.clock.fastForward(10001);
    await page.locator('[data-traffic-state="unavailable"]').waitFor();
    assert.match(await page.locator('[data-traffic-status]').innerText(),/Showing data from/);
    assert.ok(await page.locator('[data-traffic-chart] svg').isVisible(),'Failed refresh retains measured history');
    failTraffic=false;await page.clock.fastForward(10001);await page.locator('[data-traffic-state="ready"]').waitFor();
    await page.locator('[data-owner-segment="online"]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-owner-panel="users"]').hidden);
    await page.locator('[data-owner-view-user="fixture-member"]').first().waitFor();
    assert.match(lastQuery,/segment=online/,'Metric opens the matching account list');
    const before=trafficCalls;await page.clock.fastForward(30001);assert.equal(trafficCalls,before,'No polling in background sections');
    await page.screenshot({path:`.codex-artifacts/owner-users-${width}.png`,fullPage:true});
    await page.locator('[data-owner-section="services"]').click();assert.ok(await page.locator('[data-owner-ai-status]').isVisible());
    await page.screenshot({path:`.codex-artifacts/owner-services-${width}.png`,fullPage:true});
    await page.locator('[data-owner-section="activity"]').click();assert.ok(await page.locator('[data-owner-activity]').isVisible());
    founder=false;await page.evaluate(()=>window.dashboard.refresh());
    await page.waitForFunction(()=>document.querySelector('[data-owner-section="services"]').hidden);
    const denied=trafficCalls;await page.locator('[data-owner-section="overview"]').click();await page.clock.fastForward(10001);
    assert.equal(trafficCalls,denied,'Non-founder cannot request traffic');assert.ok(await page.locator('[data-owner-traffic]').isHidden());
    await page.evaluate(()=>window.dashboard.destroy());await page.clock.fastForward(60001);assert.equal(trafficCalls,denied,'Closing dashboard stops polling');
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Desktop/mobile dashboard sections, real chart rendering, spike timestamps, keyboard inspection, range changes, polling, stale data and owner-only UI passed.');
} finally {await browser.close();}
