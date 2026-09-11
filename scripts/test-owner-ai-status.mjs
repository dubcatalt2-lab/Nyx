import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parse} from 'acorn';

// Exercise the actual route handler with isolated authorization and status data.
const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
const route=source.slice(source.indexOf("app.get('/api/owner-dashboard/ai-status'"),source.indexOf('app.get("/api/owner-dashboard",'));
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});const caps=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='nyxOwnerUserCapabilities');
const capContext={nyxRolePolicy:role=>({rank:role==='member'?1:10}),nyxActorHasPermission:()=>true,nyxAssignableRolesForActor:()=>[],founderProfileConfig:()=>({administratorUid:'founder'})};
vm.runInNewContext(source.slice(caps.start,caps.end)+';result=nyxOwnerUserCapabilities;',capContext);
for(const role of ['owner','co_owner','admin','manager']){const result=capContext.result({uid:'other',role},'member','member','founder');assert.equal(result.canSetSubscription,false);assert.equal(result.canSetAiLimit,false);}
assert.equal(capContext.result({uid:'founder',role:'owner'},'member','member','founder').canSetSubscription,true);
let handler,role='member',checks=0;
vm.runInNewContext(route,{app:{get:(_path,fn)=>handler=fn},process:{env:{NYX_AI_DAILY_BUDGET_USD:'1'}},
  founderProfileConfig:()=>({administratorUid:'founder'}),ownerDashboardActor:async()=>({actor:{role,uid:role==='owner'?'founder':'other'}}),nyxOpenRouterOwnerStatus:async()=>{checks++;return {state:'low',balanceUsd:.49};}});
const response=()=>({code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
let res=response();await handler({},res);assert.equal(res.code,403);assert.equal(checks,0);
role='owner';res=response();await handler({},res);assert.equal(res.code,200);assert.equal(res.body.dailyCapUsd,1);assert.equal(res.headers['Cache-Control'],'no-store');

// Real gifting route rejects non-owner senders before touching recipient records.
const giftNode=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.arguments?.[0]?.value==='/api/chat/caffeine/gifts');
let giftHandler;vm.runInNewContext(source.slice(giftNode.start,giftNode.end),{app:{post:(_path,fn)=>giftHandler=fn},sameOriginRequest:()=>true,authenticatedNyxChatUser:async()=>({firebase:{},token:{uid:'non-owner'}}),founderProfileConfig:()=>({administratorUid:'founder'})});
const giftResponse=response();await giftHandler({body:{recipientUid:'recipient'}},giftResponse);assert.equal(giftResponse.code,403);
const root=process.env.NYX_TEST_ASSET_ROOT||'.';
const browser=await chromium.launch({headless:true});
try {
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let state='low',dashboardRole='owner',statusRequests=0,monthlyTokenLimit=50000;const member={uid:'member123',displayName:'Test Member',username:'member',email:'member@example.test',role:'member',subscriptionStatus:'premium',profile:{}};
    await page.route('http://nyx.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'});
      let body={};
      if(path==='/api/owner-dashboard')body={access:{role:dashboardRole,founder:dashboardRole==='owner',permissions:[]},users:[member],metrics:{},pagination:{},audit:[]};
      if(path==='/api/owner-dashboard/users/member123'){
        if(route.request().method()==='PATCH'){assert.equal(route.request().postDataJSON().action,'set_ai_limit');monthlyTokenLimit=route.request().postDataJSON().monthlyTokenLimit;}
        body={user:{...member,aiMonthlyTokenLimit:monthlyTokenLimit},access:{role:dashboardRole,founder:dashboardRole==='owner',permissions:[]},capabilities:{canSetAiLimit:dashboardRole==='owner',canSetSubscription:dashboardRole==='owner'}};
      }
      if(path==='/api/owner-dashboard/ai-status'){
        statusRequests++;
        body={state,balanceUsd:state==='ok'?10:state==='paused'?.1:.49,keyRemainingUsd:4.9,dailyCapUsd:1,checkedAt:Date.now()};
      }
      return route.fulfill({json:body});
    });
    await page.goto('http://nyx.test/');
    await page.addStyleTag({path:`${root}/css/owner-dashboard.css`});
    await page.addStyleTag({path:`${root}/css/owner-dashboard-polish.css`});
    await page.addScriptTag({path:`${root}/js/owner-dashboard.js`});
    await page.evaluate(()=>{window.dashboard=NyxOwnerDashboard.open({getToken:async()=>'fixture'});});
    const host=page.locator('[data-owner-ai-status]');
    await page.waitForFunction(()=>document.querySelector('[data-owner-ai-status]')?.dataset.aiState==='low');
    assert.match(await host.innerText(),/below \$0\.50/);
    const metric=await page.locator('.nyx-owner-metric').first().boundingBox();
    assert.ok(metric.height<160,'Status cards must not stretch the statistics row');
    const workspace=page.locator('.nyx-owner-workspace');await workspace.scrollIntoViewIfNeeded();
    const area=await workspace.boundingBox();assert.ok(area.height>=300,'User controls retain usable space');
    await host.scrollIntoViewIfNeeded();
    const bounds=await host.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Warning fits the viewport');
    for(const next of ['paused','unknown','ok']){
      state=next;await page.evaluate(()=>window.dashboard.refresh());
      await page.waitForFunction(value=>document.querySelector('[data-owner-ai-status]')?.dataset.aiState===value,next);
    }
    await page.screenshot({path:`.codex-artifacts/owner-layout-${width}.png`});
    assert.doesNotMatch(await host.innerText(),/below \$0\.50/,'Refill clears the warning');
    await page.locator('[data-owner-view-user=member123]').first().click();
    await page.locator('[data-owner-ai-limit]').fill('65000');await page.locator('[data-owner-save-ai-limit]').click();
    await page.waitForFunction(()=>document.querySelector('[data-owner-ai-limit]')?.value==='65000');assert.equal(monthlyTokenLimit,65000);
    await page.locator('[data-owner-drawer-close]').click();
    dashboardRole='admin';const before=statusRequests;
    await page.evaluate(()=>window.dashboard.refresh());
    await page.waitForFunction(()=>document.querySelector('[data-owner-ai-status]').hidden);
    assert.equal(statusRequests,before,'Non-owner dashboard does not request billing status');
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser.close();}
console.log('PASS: owner-only billing endpoint, desktop/mobile low balance, cutoff, unavailable check, refill and non-owner isolation');
