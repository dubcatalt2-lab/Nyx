import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=8197;
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.js'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port)},
  stdio:['ignore','pipe','pipe']
});
let serverOutput='';
server.stdout.on('data',chunk=>{serverOutput+=chunk});
server.stderr.on('data',chunk=>{serverOutput+=chunk});

const waitForServer=async()=>{
  const deadline=Date.now()+15_000;
  while(Date.now()<deadline){
    if(server.exitCode!==null)throw new Error(`Nyx test server stopped early.\n${serverOutput}`);
    try{if((await fetch(`${origin}/healthz`)).ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error(`Nyx test server did not start.\n${serverOutput}`);
};

const profile={
  displayName:'Account Test',handle:'@account-test',bio:'Browser regression profile',
  avatarUrl:'',bannerUrl:'',accentPrimary:'#5865f2',accentSecondary:'#8ea1ff',
  bannerColor:'#8ea1ff',displayNameFont:'gg-sans',displayNameEffect:'solid',
  displayNameColorPrimary:'#ffffff',displayNameColorSecondary:'#8ea1ff',
  profileEffect:'blooming-roses',avatarDecoration:'candlelight',status:'online',customStatus:'Testing controls'
};
const firebaseAppModule=`
  const apps=[];
  export const getApps=()=>apps;
  export function initializeApp(config,name){const app={config,name};apps.push(app);return app}
`;
const firebaseAuthModule=`
  const listeners=[];
  const user={uid:'test-user-1234',email:'account-test@example.com',emailVerified:true,async getIdToken(){return 'test-token'},async reload(){}};
  const auth={currentUser:user,async authStateReady(){},async signOut(){globalThis.__nyxMockSignOuts=(globalThis.__nyxMockSignOuts||0)+1;this.currentUser=null;listeners.forEach(listener=>listener(null))}};
  export const browserLocalPersistence={};
  export const getAuth=()=>auth;
  export async function setPersistence(){}
  export function onAuthStateChanged(_auth,listener){listeners.push(listener);queueMicrotask(()=>listener(auth.currentUser));return()=>{}}
  export async function signInWithCustomToken(){return {user:auth.currentUser}}
`;

let browser;
try{
  await waitForServer();
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('nyx.setupComplete','true');
    localStorage.setItem('nyx.browserShellMode','true');
    localStorage.setItem('nyx.homeDesign','redesigned');
    localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
    if(sessionStorage.getItem('nyx.test.releaseNotesFresh')!=='true'){
      localStorage.setItem('nyx.releaseNotes.2026-08-31-new-nyx.device','2026-08-31-new-nyx');
      localStorage.setItem('nyx.releaseNotes.2026-08-31-new-nyx.test-user-1234','2026-08-31-new-nyx');
    }
    globalThis.__nyxMockSignOuts=0;
    const removeStartup=()=>{
      document.querySelector('#nyxStudyHubStartup')?.remove();
      document.documentElement.classList.remove('nyx-studyhub-starting');
      document.body?.classList.remove('nyx-startup-prep','nyx-loading-active');
    };
    document.addEventListener('DOMContentLoaded',()=>{
      removeStartup();
      new MutationObserver(removeStartup).observe(document.documentElement,{childList:true,subtree:true});
    });
  });
  await page.route('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js',route=>route.fulfill({status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:firebaseAppModule}));
  await page.route('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js',route=>route.fulfill({status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:firebaseAuthModule}));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    const method=route.request().method();
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/api/founder-profile/auth-config')return json({enabled:true,projectId:'nyx-test',apiKey:'test',ownerConfigured:true});
    if(path==='/api/founder-profile/owner')return json({founder:true,dashboard:true,role:'owner',permissions:[]});
    if(path==='/api/profiles/me')return json({uid:'test-user-1234',profile,createdAt:'2026-01-01T00:00:00.000Z'});
    if(path==='/api/account/me')return json({email:'account-test@example.com',role:'owner',subscriptionStatus:'premium'});
    if(path==='/api/profiles/test-member-5678')return json({uid:'test-member-5678',profile:{...profile,displayName:'Chat Member',handle:'@chat-member'},role:'member',createdAt:'2026-02-01T00:00:00.000Z',online:true});
    if(path==='/api/chat/bootstrap')return json({
      me:{uid:'test-user-1234',displayName:'Account Test',handle:'@account-test',role:'owner'},
      members:[
        {uid:'test-user-1234',displayName:'Account Test',handle:'@account-test',role:'owner',online:true,self:true},
        {uid:'test-member-5678',displayName:'Chat Member',handle:'@chat-member',role:'member',online:true,self:false}
      ],
      channels:[{id:'general',name:'general',description:'Test channel'}],conversations:[],latestActivity:{},revision:1,
      voice:{channels:[],participants:[]}
    });
    if(path==='/api/chat/messages'&&method==='POST')return json({message:{id:'test-message-2',text:'Smooth send',attachments:[],reactions:[],createdAt:'2026-08-20T20:01:00.000Z',createdAtMs:1787256060000,author:{uid:'test-user-1234',displayName:'Account Test',handle:'@account-test',role:'owner'}}});
    if(path==='/api/chat/messages')return json({messages:[{id:'test-message-1',text:'Existing message',attachments:[],reactions:[],createdAt:'2026-08-20T20:00:00.000Z',createdAtMs:1787256000000,author:{uid:'test-member-5678',displayName:'Chat Member',handle:'@chat-member',role:'member'}}],hasMore:false});
    if(path==='/api/chat/conversations')return json({conversations:[],channelActivity:{}});
    if(path==='/api/chat/caffeine')return json({caffeine:null});
    if(path==='/api/chat/voice/status')return json({channels:[],participants:[]});
    if(path.startsWith('/api/activity/'))return json({ok:true});
    return route.continue();
  });

  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#nyxBeamsBg[data-preset]');
  assert.equal(await page.locator('.nyx-home-dot-field').count(),0,'Retired constellation field was still present');
  assert.equal(await page.locator('#nyxBeamsBg').getAttribute('data-preset'),'frost','Desktop home did not render the default Beams wallpaper');
  await page.setViewportSize({width:2560,height:800});
  await page.waitForFunction(()=>document.getElementById('nyxBeamsBg')?.getBoundingClientRect().width===innerWidth);
  await page.evaluate(()=>{
    localStorage.setItem('nyx.performanceTier','medium');
    localStorage.setItem('nyx.performanceTierSource','explicit');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#nyxBeamsBg[data-preset="frost"]');
  await page.setViewportSize({width:600,height:800});
  await page.waitForFunction(()=>document.getElementById('nyxBeamsBg')?.getBoundingClientRect().width===innerWidth);
  await page.evaluate(()=>{
    localStorage.setItem('nyx.performanceTier','high');
    localStorage.setItem('nyx.performanceTierSource','explicit');
  });
  await page.setViewportSize({width:1280,height:800});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#nyxBeamsBg[data-preset="frost"]');

  await page.locator('[data-nyx-dock-item="apps"]').click();
  const appsFrame=page.frameLocator('.browser-window iframe.active');
  const coloredIcons=appsFrame.locator('[data-global-app-id="crunchyroll"] .quick-icon,[data-global-app-id="newgrounds"] .quick-icon,[data-global-app-id="kick"] .quick-icon,[data-global-app-id="itch"] .quick-icon');
  await coloredIcons.first().waitFor({state:'attached'});
  assert.equal(await coloredIcons.count(),4,'Expected all four dark-background icon replacements');
  const iconStats=await coloredIcons.evaluateAll(async images=>Promise.all(images.map(async image=>{
    await image.decode();
    const canvas=document.createElement('canvas');
    canvas.width=64;
    canvas.height=64;
    const context=canvas.getContext('2d');
    context.drawImage(image,0,0,64,64);
    const pixels=context.getImageData(0,0,64,64).data;
    let colored=0;
    for(let index=0;index<pixels.length;index+=4){
      const red=pixels[index],green=pixels[index+1],blue=pixels[index+2],alpha=pixels[index+3];
      if(alpha>32 && Math.max(red,green,blue)-Math.min(red,green,blue)>28 && Math.max(red,green,blue)>80) colored++;
    }
    return {src:new URL(image.src).pathname,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,colored};
  })));
  for(const icon of iconStats){
    assert.ok(icon.naturalWidth>0 && icon.naturalHeight>0,`App icon failed to load: ${icon.src}`);
    assert.ok(icon.colored>20,`App icon remained monochrome or invisible: ${icon.src}`);
  }
  await page.locator('[data-nyx-dock-item="home"]').click();
  await page.waitForSelector('.nyx-minimal-home');
  await page.waitForSelector('#nyxAccountButton.nyx-account-button-rich',{timeout:15_000});
  await page.waitForTimeout(500);

  const externalPathUrl='https://example.com/pokemon';
  const homeSearch=page.locator('.browser-window.browser-home-page [data-browser-blank-input]:visible');
  await page.waitForTimeout(4500);
  await homeSearch.fill(externalPathUrl);
  await homeSearch.press('Enter');
  await page.waitForFunction(()=>[...document.querySelectorAll('.browser-window iframe.view')].some(frame=>String(frame.getAttribute('src') || '').includes('/~/sj/')));
  await page.waitForFunction(()=>[...document.querySelectorAll('.browser-window iframe.view')].some(frame=>{
    try{return String(frame.getAttribute('src') || '').includes('/~/sj/') && !!frame.contentDocument?.documentElement}catch{return false}
  }));
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'clipboard',{
      configurable:true,
      value:{writeText:async value=>{globalThis.__nyxCopiedLink=String(value)}}
    });
    const frame=[...document.querySelectorAll('.browser-window iframe.view')].find(node=>String(node.getAttribute('src') || '').includes('/~/sj/'));
    frame.dispatchEvent(new Event('load'));
  });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const frame=[...document.querySelectorAll('.browser-window iframe.view')].find(node=>String(node.getAttribute('src') || '').includes('/~/sj/'));
    frame.dispatchEvent(new Event('load'));
    const link=frame.contentDocument.createElement('a');
    link.textContent='Cineby test link';
    link.href=`${location.origin}/~/sj/tbsmrs4y/0jbe7xpv/https%3A%2F%2Fcineby.at%2F?%24rfp=strict-origin-when-cross-origin&%24io=https%3A%2F%2Ffmhy.net`;
    frame.contentDocument.documentElement.appendChild(link);
    link.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:24,clientY:24}));
  });
  await page.locator('.nyx-browser-link-menu').waitFor();
  await page.locator('[data-nyx-copy-clean-link]').click();
  assert.equal(await page.evaluate(()=>globalThis.__nyxCopiedLink),'https://cineby.at/','Right-click Copy link exposed a Scramjet URL');
  await page.evaluate(()=>{
    const frame=[...document.querySelectorAll('.browser-window iframe.view')].find(node=>String(node.getAttribute('src') || '').includes('/~/sj/'));
    frame.src='/4poekf=4watepo/w4geriaerjmgotbg';
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('.browser-window iframe.view')].some(frame=>{
    try{return frame.contentWindow.location.pathname==='/4poekf=4watepo/w4geriaerjmgotbg'}catch{return false}
  }));
  await page.evaluate(()=>{
    const frame=[...document.querySelectorAll('.browser-window iframe.view')].find(node=>{
      try{return node.contentWindow.location.pathname==='/4poekf=4watepo/w4geriaerjmgotbg'}catch{return false}
    });
    frame.dispatchEvent(new Event('load'));
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.browser-window .urlbar').inputValue(),externalPathUrl,'Proxy path replaced the real legacy address');
  assert.equal(await page.locator('[data-browser-shell-url]').inputValue(),externalPathUrl,'Proxy path replaced the real shell address');
  await page.locator('[data-nyx-dock-item="home"]').click();
  await page.waitForSelector('.nyx-minimal-home');

  const containedBrowserFrame=page.locator('.browser-window iframe.view').first();
  await containedBrowserFrame.evaluate(frame=>{
    frame.dataset.nyxBrowserContained='true';
  });
  await page.locator('#nyxAccountButton').click();
  await page.locator('[data-nyx-account-menu-action="owner-dashboard"]').click();
  await page.waitForSelector('.nyx-owner-dashboard-overlay');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.nyx-owner-dashboard-overlay').count(),1,'Owner Dashboard was removed after opening');
  await page.locator('[data-owner-close]').click();
  await page.waitForSelector('.nyx-owner-dashboard-overlay',{state:'detached'});
  await containedBrowserFrame.evaluate(frame=>{
    delete frame.dataset.nyxBrowserContained;
  });

  await page.locator('#nyxAccountButton').click();
  await page.locator('[data-nyx-account-menu-action="edit"]').click();
  await page.waitForSelector('.nyx-user-profile-overlay.show');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.nyx-user-profile-overlay.show').count(),1,'Profile editor was removed after opening');
  assert.equal(await page.locator('#nyxUserProfileTitle').textContent(),'Profiles');
  await page.locator('[data-close-nyx-profile]').click();
  await page.waitForSelector('.nyx-user-profile-overlay',{state:'detached'});

  await page.locator('#nyxAccountButton').click();
  await page.locator('[data-nyx-account-menu-action="switch"]').click();
  await page.waitForSelector('.nyx-account-overlay');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.nyx-account-overlay').count(),1,'Account switcher was removed after opening');
  assert.equal(await page.locator('#nyxAccountTitle').textContent(),'Switch accounts');
  assert.equal(await page.evaluate(()=>globalThis.__nyxMockSignOuts),0,'Switch Accounts signed the active account out before replacement login');
  await page.locator('[data-close-nyx-account]').click();

  await page.locator('[data-nyx-dock-item="settings"]').click();
  await page.waitForSelector('.browser-shell-settings-overlay');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.browser-shell-settings-overlay').count(),1,'Homepage Settings was removed after opening');
  await page.locator('[data-nyx-dock-item="home"]').click();
  await page.waitForSelector('.browser-shell-settings-overlay',{state:'detached'});
  await page.locator('[data-browser-shell-settings]').evaluate(button=>button.click());
  await page.waitForSelector('.browser-shell-settings-overlay');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.browser-shell-settings-overlay').count(),1,'Toolbar Settings was removed after opening');
  await page.locator('[data-settings-category-button="data"]').click();
  await page.waitForSelector('[data-settings-category="data"].active');
  await page.evaluate(()=>{
    localStorage.setItem('portable-game-save','level=7');
    localStorage.setItem('nyx.aiMessages','[{"role":"user","content":"portable conversation"}]');
    localStorage.setItem('nyx.aiPersonalKey.device','do-not-export');
  });
  await page.evaluate(()=>{
    const createObjectUrl=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{
      globalThis.__nyxTestExportBlob=blob;
      return createObjectUrl(blob);
    };
  });
  await page.locator('[data-nyx-data-export]').click();
  await page.waitForFunction(()=>document.querySelector('[data-nyx-data-transfer-status]')?.textContent?.startsWith('Exported '));
  const backup=await page.evaluate(async()=>JSON.parse(await globalThis.__nyxTestExportBlob.text()));
  assert.equal(backup.format,'nyx-portable-backup','Data export used the wrong backup format');
  assert.equal(backup.storage['portable-game-save'],'level=7','Data export omitted supported game storage');
  assert.match(backup.storage['nyx.aiMessages'],/portable conversation/,'Data export omitted AI conversation history');
  assert.equal(backup.storage['nyx.aiPersonalKey.device'],undefined,'Data export included a personal API key');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-nyx-data-import-file]').setInputFiles({
    name:'nyx-data-test.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({format:'nyx-portable-backup',version:1,sourceOrigin:'https://old-nyx.example',storage:{'portable-game-save':'level=12','nyx.font':'outfit','nyx.aiPersonalKey.device':'must-stay-blocked'}}))
  });
  await page.waitForFunction(()=>document.querySelector('[data-nyx-data-transfer-status]')?.textContent?.startsWith('Imported 2 data entries'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('portable-game-save')),'level=12','Data import did not restore supported game storage');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.aiPersonalKey.device')),'do-not-export','Data import replaced a personal API key');
  assert.equal(await page.locator('[data-nyx-data-reload]').isVisible(),true,'Data import did not offer to reload Nyx');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'Portable Data Transfer settings overflowed a mobile viewport');
  await page.setViewportSize({width:1280,height:800});
  await page.locator('[data-settings-category-button="proxy"]').click();
  await page.waitForSelector('[data-settings-category="proxy"].active');
  const wispInput=page.locator('[data-browser-wisp-url]');
  await wispInput.waitFor();
  assert.equal(await wispInput.isVisible(),true,'Wisp URL control was not visible in Proxy settings');
  await wispInput.fill('wss://relay.example.test/custom-wisp');
  await page.locator('[data-browser-wisp-save]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.wispUrl')),'wss://relay.example.test/custom-wisp','Custom Wisp URL was not persisted');
  assert.match(await page.locator('[data-browser-wisp-status]').textContent(),/Custom relay: wss:\/\/relay\.example\.test\/custom-wisp/,'Custom Wisp URL was not selected at runtime');
  await wispInput.fill('https://relay.example.test/wisp');
  await page.locator('[data-browser-wisp-save]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.wispUrl')),'wss://relay.example.test/custom-wisp','Invalid Wisp protocol replaced the saved relay');
  await page.locator('[data-browser-wisp-reset]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.wispUrl')),'','Reset did not restore the default Wisp relay');
  assert.match(await page.locator('[data-browser-wisp-status]').textContent(),/^Default relay: wss?:\/\//,'Default Wisp relay status was not restored');
  await page.locator('.brand-mini [data-browser-shell-new-tab]').evaluate(button=>button.click());
  await page.waitForSelector('.browser-shell-settings-overlay',{state:'detached'});
  assert.equal(await page.locator('.nyx-browser-tab-row.active strong').textContent(),'New Tab','New tab created from Settings did not become the active blank tab');
  assert.equal(await page.locator('[data-browser-shell-url]').inputValue(),'','New tab created from Settings inherited its internal URL');
  assert.equal(await page.locator('.browser-window.browser-home-page .nyx-minimal-home:visible').count(),1,'New tab created from Settings did not show the Nyx homepage');
  await page.locator('[data-nyx-dock-item="home"]').click();
  const tabLifecycleHomeSearch=page.locator('.browser-window.browser-home-page [data-browser-blank-input]');
  await tabLifecycleHomeSearch.fill('stale tab search');
  await page.locator('.brand-mini [data-browser-shell-new-tab]').evaluate(button=>button.click());
  assert.equal(await page.locator('.browser-window.browser-home-page [data-browser-blank-input]').inputValue(),'','A new blank tab inherited the previous tab search text');
  await page.locator('.nyx-browser-tab-row.active [data-browser-shell-close-tab]').evaluate(button=>button.click());
  assert.equal(await page.locator('.browser-window.browser-home-page [data-browser-blank-input]').inputValue(),'','Closing a blank tab restored stale homepage search text');
  assert.equal(await page.locator('[data-browser-shell-url]').inputValue(),'','Closing a blank tab restored stale address text');

  await page.locator('[data-nyx-dock-item="chat"]').click();
  const chatFrame=page.frames().find(frame=>new URL(frame.url()).pathname==='/apps/chat/');
  if(!chatFrame)await page.waitForTimeout(500);
  const activeChatFrame=page.frames().find(frame=>new URL(frame.url()).pathname==='/apps/chat/');
  assert.ok(activeChatFrame,'Embedded Chat frame did not open');
  const existingMessage=activeChatFrame.locator('[data-message-id="test-message-1"]');
  await existingMessage.waitFor();
  await existingMessage.evaluate(node=>{node.dataset.renderIdentity='retained'});
  const chatInput=activeChatFrame.locator('[data-message-input]');
  await chatInput.fill(':sku');
  await activeChatFrame.locator('.mention-menu:not([hidden])').waitFor();
  assert.equal(await activeChatFrame.locator('.mention-option').first().locator('strong').textContent(),':skull:','Emoji shortcode suggestion did not rank the matching emoji first');
  await chatInput.press('Enter');
  assert.equal(await chatInput.inputValue(),'\u{1F480} ','Emoji suggestion did not insert the selected emoji');
  await chatInput.fill('');
  await chatInput.fill('Smooth send');
  await chatInput.press('Enter');
  await activeChatFrame.locator('[data-message-id="test-message-2"]').waitFor();
  assert.equal(await existingMessage.getAttribute('data-render-identity'),'retained','An unchanged message was rebuilt during a realtime-style send');
  await activeChatFrame.waitForSelector('.member-button');
  await activeChatFrame.locator('.member-button').filter({hasText:'Chat Member'}).click();
  await page.waitForSelector('.nyx-profile-directory-overlay.show',{timeout:5_000});
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.nyx-profile-directory-overlay.show').count(),1,'Chat profile was removed after opening');
  await page.waitForSelector('.nyx-profile-directory-view-head',{timeout:10_000});
  assert.match(await page.locator('.nyx-profile-directory-view-head').textContent(),/Chat Member/);

  await page.evaluate(()=>{
    sessionStorage.setItem('nyx.test.releaseNotesFresh','true');
  Object.keys(localStorage).filter(key=>key.startsWith('nyx.releaseNotes.2026-08-31-new-nyx.')).forEach(key=>localStorage.removeItem(key));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('.nyx-release-notes-overlay.show',{timeout:10_000});
  assert.equal(await page.locator('.nyx-release-notes footer span').count(),0,'Release notes still showed the one-time explanatory text');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nyx.releaseNotes.2026-08-31-new-nyx.seen')),'2026-08-31-new-nyx','Release notes were not acknowledged when shown');
  await page.locator('.nyx-release-notes [data-nyx-release-notes-close]').last().click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('.nyx-release-notes-overlay').count(),0,'Release notes appeared again after acknowledgement');

  assert.deepEqual(pageErrors,[],`Browser errors: ${pageErrors.join(' | ')}`);
  console.log('Homepage constellation, browser URL privacy, colored app icons, account controls, and embedded Chat profile regression passed.');
}finally{
  await browser?.close().catch(()=>{});
  if(server.exitCode===null)server.kill();
}
