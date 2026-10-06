import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

const app = express();
app.get('/runtime-config.js', (_, res) => res.type('js').send(''));
app.use('/api', (_, res) => res.json({enabled: false, online: 0, users: [], apps: []}));
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT || '.'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = process.env.NYX_TEST_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel: 'msedge', headless: true});
const errors = [];
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  if (process.env.NYX_TEST_BASE_URL) await context.route('**/api/**', route => route.fulfill({json:{enabled:false,online:0,users:[],apps:[]}}));
  let bannerRequests = 0;
  await context.route('https://bicea.org/**', route => {
    bannerRequests++;
    return route.fulfill({contentType: 'text/javascript', body: `const child=document.createElement('iframe');child.title='Test creative';child.width=(window.atOptions?.width||360);child.height=(window.atOptions?.height||300);document.body.append(child);setTimeout(()=>{const doc=child.contentDocument;const image=doc.createElement('img');image.width=(window.atOptions?.width||360);image.height=(window.atOptions?.height||300);image.src='https://creative.example.invalid/banner.svg';doc.body.style.margin='0';doc.body.append(image);},40);`});
  });
  await context.route('https://creative.example.invalid/**', route => route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="468" height="600"><rect width="100%" height="100%" fill="#263a30"/></svg>'}));
  await context.route('https://asiafilm.org/**', route => route.abort());
  await context.route('**/assets/games/games.json', route => route.fulfill({json: {
    version: 1, includeUnillustrated: true,
    catalogs: [{id: 'local', format: 'ugs', url: '/fixtures/catalog.json', coversUrl: '/fixtures/covers.json', player: '/fixtures/play.html?game={path}', priority: 50}]
  }}));
  await context.route('**/fixtures/catalog.json', route => route.fulfill({json: Array.from({length: 36}, (_, i) => ({title: `Fixture ${String(i).padStart(2, '0')}`, path: `game-${i}.html`}))}));
  await context.route('**/fixtures/covers.json', route => route.fulfill({json: []}));
  const page = await context.newPage();
  await page.addInitScript(()=>{window.__nyxPublisherMode='adkid';});
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/assets/games/');
  await page.waitForFunction(() => document.querySelectorAll('.game-card').length === 30);
  assert.equal(await page.locator('#gameCount').textContent(), '36 games');
  assert.equal(await page.locator('.nyx-sponsor-slot').count(), 3);
  assert.equal(bannerRequests, 0, 'offscreen placements must not request ads');
  await page.locator('.nyx-sponsor-slot').first().scrollIntoViewIfNeeded();
  await page.frameLocator('.nyx-sponsor-slot iframe').first().frameLocator('iframe').locator('img').waitFor();
  const firstFrame = await page.locator('.nyx-sponsor-slot iframe').first().evaluate(frame => {
    frame.dataset.persist = 'yes';
    return {sandbox: frame.getAttribute('sandbox'), width: frame.getBoundingClientRect().width};
  });
  assert.equal(firstFrame.width, 468);
  assert.ok(firstFrame.sandbox.includes('allow-same-origin'));
  assert.ok((await page.locator('.nyx-sponsor-slot iframe').first().getAttribute('src')).startsWith('data:text/html'));
  const isolation=await page.locator('.nyx-sponsor-slot iframe').first().evaluate(frame=>{try{return frame.contentDocument===null}catch{return true}});
  assert.ok(isolation,'data frame must remain isolated from Nyx despite allowing its own child frames');
  const wrapper = await (await page.locator('.nyx-sponsor-slot iframe').first().elementHandle()).contentFrame();
  const boundaries = await wrapper.evaluate(() => {
    let parentReadable=false,storageReadable=false;
    try {parentReadable=!!parent.document.body;} catch {}
    try {storageReadable=!!localStorage;} catch {}
    return {parentReadable,storageReadable,childWritable:!!document.querySelector('iframe').contentDocument.body.querySelector('img')};
  });
  assert.deepEqual(boundaries,{parentReadable:false,storageReadable:false,childWritable:true});
  const requestsBeforeFilter = bannerRequests;
  await page.locator('#gameSearch').fill('Fixture 00');
  assert.equal(await page.locator('.game-card').count(), 1);
  assert.equal(await page.locator('.nyx-sponsor-slot:visible').count(), 0);
  await page.locator('#gameSearch').fill('');
  assert.equal(await page.locator('.nyx-sponsor-slot iframe').first().getAttribute('data-persist'), 'yes');
  assert.equal(bannerRequests, requestsBeforeFilter, 'search must not reload an existing creative');
  await page.getByRole('button',{name:'Close banner advertisement 1',exact:true}).click();
  assert.equal(await page.locator('.nyx-sponsor-slot').first().isVisible(),false);
  await page.locator('#gameSearch').fill('Fixture 00');
  await page.locator('#gameSearch').fill('');
  assert.equal(await page.locator('.nyx-sponsor-slot').first().isVisible(),false,'dismissed game banner stays closed across filtering');
  await page.setViewportSize({width: 390, height: 850});
  await page.waitForFunction(() => [...document.querySelectorAll('.nyx-sponsor-slot:not(.nyx-sponsor-native)')].every(el => el.hidden));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('.nyx-sponsor-native').scrollIntoViewIfNeeded();
  await page.frameLocator('.nyx-sponsor-native iframe').first().frameLocator('iframe').locator('img').waitFor();
  assert.equal(await page.locator('.nyx-sponsor-native iframe').first().evaluate(frame=>frame.getBoundingClientRect().width<=frame.parentElement.clientWidth),true);
  await page.getByRole('button',{name:'Close native advertisement',exact:true}).click();
  assert.equal(await page.locator('.nyx-sponsor-native iframe').count(),0);
  await page.close();

  await context.addInitScript(() => {
    try {
      localStorage.setItem('nyx.setupComplete', 'true');
      localStorage.setItem('nyx.tosAcceptedVersion', '2026-07-30');
    } catch {}
  });
  async function homePage() {
    const tab = await context.newPage();
    tab.on('pageerror', error => errors.push(error.message));
    await tab.goto(base, {waitUntil: 'domcontentloaded'});
    await tab.waitForFunction(() => document.body?.classList.contains('browser-shell') && !document.body.classList.contains('nyx-loading-active'));
    await tab.getByRole('button', {name: 'Got it', exact: true}).click({timeout: 1500}).catch(() => {});
    await tab.evaluate(() => {
      window.testNow = Date.now();
      Date.now = () => window.testNow;
      window.sponsorOpens = [];
      window.popupAttempts=[];
      window.__nyxNativeOpen = (...args) => {window.popupAttempts.push(args); if(window.blockSponsorPopup)return null; const popup={opener:window,document:{createElement:()=>({}),head:{append:()=>{}}},close(){},location:{replace(url){if(popup.opener!==null)throw Error('Unsafe opener');window.sponsorOpens.push([url,'_blank','noopener,noreferrer']);}}};return popup;};
    });
    return tab;
  }
  const first = await homePage();
  await first.waitForFunction(()=>document.querySelectorAll('.nyx-home-sponsor[data-ready]').length===2);
  await first.screenshot({path:'.codex-artifacts/publisher-home-preview.png'});
  const sideBounds=await first.locator('.nyx-home-sponsor iframe').evaluateAll(frames=>frames.map(f=>({width:f.getBoundingClientRect().width,height:f.getBoundingClientRect().height,sandbox:f.getAttribute('sandbox')})));
  assert.ok(sideBounds.every(f=>Math.abs(f.width-80)<1&&Math.abs(f.height-300)<1&&f.sandbox.includes('allow-same-origin')));
  await first.getByRole('button',{name:'Close left advertisement',exact:true}).click();
  assert.equal(await first.locator('.nyx-home-sponsor iframe').count(),1);
  await first.setViewportSize({width:800,height:900});
  await first.waitForFunction(()=>[...document.querySelectorAll('.nyx-home-sponsor')].every(s=>s.hidden));
  await first.setViewportSize({width:1440,height:900});
  await first.waitForFunction(()=>[...document.querySelectorAll('.nyx-home-sponsor')].every(s=>!s.hidden));
  const second = await homePage();
  const clock = await first.evaluate(() => Date.now());
  await second.evaluate(now => {window.testNow = now;}, clock);
  const clickHome = tab => tab.locator('.browser-home.nyx-minimal-home:not(.hidden) h1').click();
  await clickHome(first);
  await first.waitForFunction(() => window.sponsorOpens.length === 1);
  await clickHome(second);
  await second.waitForTimeout(100);
  assert.equal(await second.evaluate(() => window.sponsorOpens.length), 0, 'second tab shares cap');
  await first.evaluate(() => {window.testNow += 1000;});
  await clickHome(first);
  await first.waitForFunction(() => window.sponsorOpens.length === 2);
  await clickHome(first);
  await first.waitForTimeout(100);
  assert.equal(await first.evaluate(() => window.sponsorOpens.length), 2);
  await first.evaluate(() => {window.testNow += 2 * 60 * 1000;});
  await clickHome(first);
  await first.waitForTimeout(100);
  assert.equal(await first.evaluate(()=>window.sponsorOpens.length),2);
  await first.evaluate(()=>{window.testNow+=4*60*1000;});
  await clickHome(first);
  await first.waitForFunction(() => window.sponsorOpens.length === 3);
  const opened = await first.evaluate(() => window.sponsorOpens);
  assert.ok(opened.every(([url, target, features]) => url === 'https://asiafilm.org/4/4e423fea224eac7374c037f143e080e3' && target === '_blank' && features === 'noopener,noreferrer'));
  await first.evaluate(() => {window.testNow += 10 * 60 * 1000; document.querySelector('.browser-home.nyx-minimal-home h1').click();});
  assert.equal(await first.evaluate(() => window.sponsorOpens.length), 3, 'synthetic clicks never open ads');
  await first.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await first.waitForFunction(()=>document.querySelectorAll('.nyx-home-sponsor iframe').length===0);
  await first.locator('[data-nyx-dock-item="settings"]').click();
  assert.equal(await first.evaluate(() => window.sponsorOpens.length), 3, 'settings click must not open an ad');
  const protection = await first.evaluate(async () => {
    const sponsored = document.createElement('iframe');
    sponsored.src = '/apps/sponsor/banner.html';
    sponsored.setAttribute('sandbox', 'allow-scripts allow-popups');
    const allowed = window.nyxInstallGameAdProtection(sponsored);
    const game = document.createElement('iframe');
    game.srcdoc = '<!doctype html><div class="ad-banner">Third party ad</div><main>Game</main>';
    document.body.append(game);
    await new Promise(resolve => game.addEventListener('load', resolve, {once: true}));
    window.nyxInstallGameAdProtection(game);
    await new Promise(resolve => setTimeout(resolve, 50));
    const protectedGame = game.contentWindow.__nyxBrowserAdBlock === true;
    const removed = !game.contentDocument.querySelector('.ad-banner');
    game.remove();
    return {allowed, protectedGame, removed};
  });
  assert.equal(protection.allowed, false, 'owned isolated banner must not receive game ad protection');
  assert.equal(protection.protectedGame, true);
  assert.equal(protection.removed, true);

  const refreshed = await homePage();
  await refreshed.waitForFunction(()=>document.querySelectorAll('.nyx-home-sponsor[data-ready]').length===2);
  await refreshed.reload({waitUntil:'domcontentloaded'});
  await refreshed.waitForFunction(()=>document.querySelectorAll('.nyx-home-sponsor[data-ready]').length===2);
  await refreshed.close();
  const third = await homePage();
  await third.evaluate(now => {window.testNow = now;}, clock + 4 * 60 * 1000);
  await clickHome(third);
  await third.waitForTimeout(100);
  assert.equal(await third.evaluate(() => window.sponsorOpens.length), 0, 'new document must retain cap');
  const concurrentNow = clock + 30 * 60 * 1000;
  for (const tab of [second, third]) await tab.evaluate(now => {window.testNow = now; window.sponsorOpens = [];}, concurrentNow);
  await Promise.all([clickHome(second), clickHome(third)]);
  await third.waitForTimeout(100);
  assert.equal(await second.evaluate(() => window.sponsorOpens.length) + await third.evaluate(() => window.sponsorOpens.length), 1, 'concurrent tabs must reserve atomically');
  await third.evaluate(() => {
    window.testNow += 20 * 60 * 1000;
    window.sponsorOpens = [];
    Storage.prototype.setItem = () => {throw new Error('Storage disabled');};
  });
  await clickHome(third);
  await third.waitForTimeout(100);
  assert.equal(await third.evaluate(() => window.sponsorOpens.length), 0, 'storage failure must not permit uncapped popups');

  const shell = await homePage();
  await shell.locator('[data-nyx-dock-item="games"]').click();
  let arcade;
  for (let attempt = 0; attempt < 100 && !arcade; attempt++) {
    arcade = shell.frames().find(frame => frame.url().includes('/assets/games/'));
    if (!arcade) await shell.waitForTimeout(100);
  }
  assert.ok(arcade, 'Arcade should open inside Nyx');
  await arcade.locator('.game-card').first().waitFor();
  assert.equal(await arcade.locator('.nyx-sponsor-slot:visible').count(),0,'regular users have no game ads');
  assert.equal(await arcade.locator('.nyx-sponsor-slot iframe').count(),0,'regular game pages do not request ads');
  await shell.waitForFunction(()=>!document.querySelector('.nyx-home-sponsor iframe'));
  await arcade.locator('h1').click();
  assert.equal(await shell.evaluate(()=>window.sponsorOpens.length),0,'regular app clicks have no popup ads');
  await shell.evaluate(()=>{
    window.__nyxPublisherMode='adkid';window.dispatchEvent(new Event('nyx:publisher-change'));
    document.querySelectorAll('iframe').forEach(frame=>frame.contentWindow.postMessage({type:'nyx:publisher-change'},location.origin));
  });
  await arcade.locator('.nyx-sponsor-slot').first().scrollIntoViewIfNeeded();
  await arcade.frameLocator('.nyx-sponsor-slot iframe').first().frameLocator('iframe').locator('img').waitFor();
  assert.equal(await shell.evaluate(() => window.sponsorOpens.length), 0, 'opening and browsing games must not open a home popup');
  await shell.evaluate(() => {
    window.__nyxPublisherMode = 'off';
    document.querySelectorAll('iframe').forEach(frame => frame.contentWindow.postMessage({type:'nyx:publisher-change'},location.origin));
  });
  await arcade.waitForFunction(() => !document.querySelector('.nyx-sponsor-slot iframe'));
  assert.equal(await arcade.locator('.nyx-sponsor-slot:visible').count(), 0, 'upgrade removes existing ads');
  const rolePage = await homePage();
  await rolePage.evaluate(() => {localStorage.removeItem('nyx.publisher.home.v1');window.__nyxPublisherMode='off';});
  await clickHome(rolePage);
  assert.equal(await rolePage.evaluate(() => window.sponsorOpens.length), 0, 'ad-free accounts never open ads');
  await rolePage.evaluate(() => {window.__nyxPublisherMode='pending';});
  await clickHome(rolePage);
  assert.equal(await rolePage.evaluate(() => window.sponsorOpens.length), 0, 'pending account lookup never opens ads');
  await rolePage.evaluate(() => {window.__nyxPublisherMode='adkid';window.dispatchEvent(new Event('nyx:publisher-change'));});
  await rolePage.waitForFunction(()=>document.querySelector('.nyx-social-sponsor[data-ready]'));
  assert((await rolePage.locator('.nyx-social-sponsor').boundingBox()).width<=272,'homepage Social Bar stays compact');
  await rolePage.waitForFunction(()=>document.querySelectorAll('.nyx-adkid-sponsors [data-ready]').length===2);
  await clickHome(rolePage);
  await rolePage.waitForFunction(() => window.sponsorOpens.length===1);
  await clickHome(rolePage);
  assert.equal(await rolePage.evaluate(() => window.sponsorOpens.length), 1, 'adkid spacing still applies');
  for (let i=1;i<100;i++) {
    await rolePage.evaluate(() => {window.testNow+=600;});
    await clickHome(rolePage);
    await rolePage.waitForFunction(n=>window.sponsorOpens.length===n,i+1);
  }
  await rolePage.evaluate(() => {window.testNow+=100;});
  await clickHome(rolePage);
  assert.equal(await rolePage.evaluate(() => window.sponsorOpens.length), 100, '100 attempts per minute maximum');
  await rolePage.evaluate(() => {window.testNow+=600;});
  await clickHome(rolePage);
  await rolePage.waitForFunction(() => window.sponsorOpens.length===101);
  const requestsBeforeResize = bannerRequests;
  await rolePage.setViewportSize({width:390,height:850});
  await rolePage.waitForFunction(()=>[...document.querySelectorAll('.nyx-adkid-sponsors .nyx-home-sponsor')].every(slot=>slot.hidden));
  assert.equal(await rolePage.locator('.nyx-social-sponsor').evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&el.getBoundingClientRect().left>=0),true);
  await rolePage.setViewportSize({width:1440,height:900});
  assert.equal(bannerRequests,requestsBeforeResize,'resizing does not refresh Adkid ads');
  await rolePage.getByRole('button',{name:'Close advertisement',exact:true}).click();
  assert.equal(await rolePage.locator('.nyx-social-sponsor').count(),0,'social close removes the provider frame');
  await rolePage.evaluate(() => {window.dispatchEvent(new Event('nyx:publisher-change'));});
  assert.equal(await rolePage.locator('.nyx-social-sponsor').count(),0,'dismissal lasts this page visit');
  await rolePage.evaluate(() => {window.__nyxPublisherMode='standard';window.testNow+=60000;window.dispatchEvent(new Event('nyx:publisher-change'));});
  await clickHome(rolePage);
  assert.equal(await rolePage.evaluate(() => window.sponsorOpens.length), 101, 'role changes retain the four-minute history');
  await rolePage.waitForFunction(()=>!document.querySelector('.nyx-adkid-sponsors'));
  await shell.evaluate(() => {window.__nyxPublisherMode='adkid';window.testNow+=600000;window.dispatchEvent(new Event('nyx:publisher-change'));});
  await arcade.locator('h1').click();
  await shell.waitForFunction(()=>window.sponsorOpens.length===1);
  await arcade.evaluate(()=>document.querySelector('h1').click());
  assert.equal(await shell.evaluate(()=>window.sponsorOpens.length),1,'synthetic iframe clicks cannot open ads');
  await shell.evaluate(() => {window.__nyxPublisherMode='off';window.dispatchEvent(new Event('nyx:publisher-change'));});
  await shell.waitForFunction(()=>!document.querySelector('.nyx-social-sponsor')&&!document.querySelector('.nyx-adkid-sponsors'));
  await context.route('https://bicea.org/**', route => route.fulfill({contentType:'text/javascript',body:''}));
  const empty = await context.newPage();
  await empty.addInitScript(()=>{window.__nyxPublisherMode='adkid';});
  await empty.goto(base+'/assets/games/');
  await empty.locator('.game-card').first().waitFor();
  await empty.locator('.nyx-sponsor-slot').first().scrollIntoViewIfNeeded();
  assert.ok(await empty.locator('.nyx-sponsor-slot').first().evaluate(s=>s.getBoundingClientRect().height<=1),'no empty advertising row while waiting');
  await empty.waitForFunction(() => document.querySelector('.nyx-sponsor-slot')?.dataset.failed==='true',null,{timeout:20000});
  assert.equal(await empty.locator('.nyx-sponsor-slot').first().isVisible(),false,'empty provider response removes the blank placement');
  await context.route('**/api/founder-profile/auth-config', route => route.fulfill({json:{enabled:true,apiKey:'test-key',projectId:'test-project'}}));
  await context.route('https://www.gstatic.com/firebasejs/**/firebase-app.js', route => route.fulfill({contentType:'text/javascript',body:`export const getApps=()=>[];export const initializeApp=()=>({});`}));
  await context.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js', route => route.fulfill({contentType:'text/javascript',body:`
    const user={uid:'test-premium-user',getIdToken:async()=> 'test-token'};
    export const browserLocalPersistence={};export const setPersistence=async()=>{};
    export const getAuth=()=>({currentUser:user,authStateReady:async()=>{}});
    export const onAuthStateChanged=(auth,cb)=>{queueMicrotask(()=>cb(user));return()=>{}};
  `}));
  const premiumAccount={uid:'test-premium-user',role:'member',subscriptionStatus:'premium',publisherMode:'off',premiumAccess:true};
  await context.route('**/api/account/me',async route=>{await new Promise(r=>setTimeout(r,1500));return route.fulfill({json:premiumAccount});});
  await context.route('**/api/activity/heartbeat',async route=>{await new Promise(r=>setTimeout(r,1500));return route.fulfill({json:premiumAccount});});
  const premiumPage=await homePage();
  await premiumPage.waitForFunction(()=>window.__nyxPublisherMode==='off');
  assert.equal(await premiumPage.locator('.nyx-home-sponsor iframe').count(),0,'premium home has no ads');
  await clickHome(premiumPage);
  assert.equal(await premiumPage.evaluate(()=>window.sponsorOpens.length),0,'server account policy disables premium popups');
  await premiumPage.locator('[data-nyx-dock-item="games"]').click();
  let premiumArcade;
  for(let i=0;i<100&&!premiumArcade;i++){premiumArcade=premiumPage.frames().find(f=>f.url().includes('/assets/games/'));if(!premiumArcade)await premiumPage.waitForTimeout(100);}
  await premiumArcade.locator('.game-card').first().waitFor();
  assert.equal(await premiumArcade.locator('.nyx-sponsor-slot iframe').count(),0,'premium page does not request banners');
  const adkidAccount={...premiumAccount,role:'adkid',subscriptionStatus:'free',publisherMode:'adkid',premiumAccess:false};
  await context.route('**/api/account/me',route=>route.fulfill({json:adkidAccount}));
  await context.route('**/api/activity/heartbeat',route=>route.fulfill({json:adkidAccount}));
  const signedInAdkid=await homePage();
  await signedInAdkid.waitForFunction(()=>window.__nyxPublisherMode==='adkid');
  await signedInAdkid.waitForFunction(()=>document.querySelectorAll('.nyx-adkid-sponsors iframe').length===2&&document.querySelectorAll('.nyx-social-sponsor iframe').length===1);
  assert.equal(await signedInAdkid.evaluate(()=>window.__nyxPublisherMode),'adkid','authenticated account response selects Adkid automatically');
  await context.route('**/api/account/ad-free/redeem',route=>route.fulfill({json:{uid:adkidAccount.uid,publisherMode:'off',adFree:{active:true,expiresAtMs:0}}}));
  await signedInAdkid.locator('#nyxAccountButton').click();
  await signedInAdkid.locator('[data-nyx-account-menu-action="ad-free"]').click();
  await signedInAdkid.getByLabel('Ad-free key',{exact:true}).fill('NYX-ADFREE-11111111-22222222-33333333-44444444');
  await signedInAdkid.getByRole('button',{name:'Redeem key',exact:true}).click();
  await signedInAdkid.waitForFunction(()=>window.__nyxPublisherMode==='off'&&!document.querySelector('.nyx-social-sponsor')&&!document.querySelector('.nyx-home-sponsor iframe'));
  assert.equal(await signedInAdkid.evaluate(()=>document.body.dataset.nyxSubscription),'free','ad-free keys do not grant premium');
  await context.close();
  assert.deepEqual(errors, []);
  console.log('PASS nested creative writes with account/storage isolation; banners and mobile bounds; Adkid 100/minute cap, app clicks, Social Bar dismissal and premium/staff exclusions; ordinary shared cap, expiry, synthetic-click rejection and retained game ad protection. No live advertising impressions or clicks generated.');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
