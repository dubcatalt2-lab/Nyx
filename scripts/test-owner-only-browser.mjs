import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8'),moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const app=express();app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'dist'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const role of ['admin','owner']){
 const page=await browser.newPage();let dashboardRequests=0;const founder=role==='owner';
 await page.addInitScript(()=>{for(const [k,v] of Object.entries({'nyx.setupComplete':'true','nyx.tosAcceptedVersion':'2026-07-30','nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen':'2026-09-14-nyx-1.0.3','nyx.browserShellMode':'true','nyx.homeDesign':'redesigned'}))localStorage.setItem(k,v)});
 for(const [file,module] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('https://www.gstatic.com/firebasejs/11.10.0/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(module)}));
 await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;
 if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'nyx-test',apiKey:'test',ownerConfigured:true}});
 // A stale dashboard grant must not expose the menu to a non-founder.
 if(path==='/api/founder-profile/owner')return r.fulfill({json:{founder,dashboard:true,role,permissions:['dashboard:view']}});
 if(path==='/api/account/me')return r.fulfill({json:{email:'account-test@example.com',founder,dashboard:true,role,subscriptionStatus:'free'}});
 if(path==='/api/profiles/me')return r.fulfill({json:{uid:'test-user-1234',profile:{displayName:'Account Test',handle:'@account-test',avatarUrl:'',bannerUrl:''},createdAt:'2026-01-01'}});
 if(path.startsWith('/api/owner-dashboard')){dashboardRequests++;return r.fulfill({status:403,json:{error:'Fixture dashboard data is intentionally empty'}});}
 return r.fulfill({json:{ok:true}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#nyxStudyHubStartup').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.body.classList.contains('nyx-loading-active'));
 await page.locator('#nyxAccountButton').click();await page.locator('[data-nyx-account-menu-action="edit"]').waitFor();
 const entry=page.locator('[data-nyx-account-menu-action="owner-dashboard"]');assert.equal(await entry.count(),founder?1:0);
 if(founder){await entry.click();await page.locator('.nyx-owner-dashboard-overlay').waitFor();await page.waitForFunction(()=>document.querySelector('.nyx-owner-dashboard-overlay')?.textContent.includes('Fixture dashboard'));assert(dashboardRequests>0);}else assert.equal(dashboardRequests,0);
 await page.close();
}console.log('PASS built shell hides Owner Dashboard from staff even with stale dashboard grants; owner entry opens dashboard');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
