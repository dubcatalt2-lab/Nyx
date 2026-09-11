import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual route handler with isolated authorization and status data.
const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
const route=source.slice(source.indexOf("app.get('/api/owner-dashboard/ai-status'"),source.indexOf('app.get("/api/owner-dashboard",'));
let handler,role='member',checks=0;
vm.runInNewContext(route,{app:{get:(_path,fn)=>handler=fn},process:{env:{NYX_AI_DAILY_BUDGET_USD:'1'}},
  ownerDashboardActor:async()=>({actor:{role}}),nyxOpenRouterOwnerStatus:async()=>{checks++;return {state:'low',balanceUsd:.49};}});
const response=()=>({code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
let res=response();await handler({},res);assert.equal(res.code,403);assert.equal(checks,0);
role='owner';res=response();await handler({},res);assert.equal(res.code,200);assert.equal(res.body.dailyCapUsd,1);assert.equal(res.headers['Cache-Control'],'no-store');

const root=process.env.NYX_TEST_ASSET_ROOT||'.';
const browser=await chromium.launch({headless:true});
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let state='low',dashboardRole='owner',statusRequests=0;
    await page.route('http://nyx.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'});
      let body={};
      if(path==='/api/owner-dashboard')body={access:{role:dashboardRole,permissions:[]},users:[],metrics:{},pagination:{},audit:[]};
      if(path==='/api/owner-dashboard/ai-status'){
        statusRequests++;
        body={state,balanceUsd:state==='ok'?10:state==='paused'?.1:.49,keyRemainingUsd:4.9,dailyCapUsd:1,checkedAt:Date.now()};
      }
      return route.fulfill({json:body});
    });
    await page.goto('http://nyx.test/');
    await page.addStyleTag({path:`${root}/css/owner-dashboard.css`});
    await page.addScriptTag({path:`${root}/js/owner-dashboard.js`});
    await page.evaluate(()=>{window.dashboard=NyxOwnerDashboard.open({getToken:async()=>'fixture'});});
    const host=page.locator('[data-owner-ai-status]');
    await page.waitForFunction(()=>document.querySelector('[data-owner-ai-status]')?.dataset.aiState==='low');
    assert.match(await host.innerText(),/below \$0\.50/);
    const bounds=await host.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Warning fits the viewport');
    for(const next of ['paused','unknown','ok']){
      state=next;await page.evaluate(()=>window.dashboard.refresh());
      await page.waitForFunction(value=>document.querySelector('[data-owner-ai-status]')?.dataset.aiState===value,next);
    }
    assert.doesNotMatch(await host.innerText(),/below \$0\.50/,'Refill clears the warning');
    dashboardRole='admin';const before=statusRequests;
    await page.evaluate(()=>window.dashboard.refresh());
    await page.waitForFunction(()=>document.querySelector('[data-owner-ai-status]').hidden);
    assert.equal(statusRequests,before,'Non-owner dashboard does not request billing status');
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser.close();}
console.log('PASS: owner-only billing endpoint, desktop/mobile low balance, cutoff, unavailable check, refill and non-owner isolation');
