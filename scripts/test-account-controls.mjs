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
    localStorage.setItem('nyx.releaseNotes.2026-08-17-interface-release.device','2026-08-17-interface-release');
    localStorage.setItem('nyx.releaseNotes.2026-08-17-interface-release.test-user-1234','2026-08-17-interface-release');
    globalThis.__nyxMockSignOuts=0;
    const removeStartup=()=>{
      document.querySelector('#nyxStudyHubStartup')?.remove();
      document.documentElement.classList.remove('nyx-studyhub-starting');
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
    if(path==='/api/chat/messages')return json({messages:[],hasMore:false});
    if(path==='/api/chat/conversations')return json({conversations:[],channelActivity:{}});
    if(path==='/api/chat/caffeine')return json({caffeine:null});
    if(path==='/api/chat/voice/status')return json({channels:[],participants:[]});
    if(path.startsWith('/api/activity/'))return json({ok:true});
    return route.continue();
  });

  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.nyx-home-dot-field[data-constellation-count]');
  assert.equal(await page.locator('.nyx-home-dot-field').getAttribute('data-constellation-count'),'5','Desktop home did not render the expanded constellation field');
  await page.setViewportSize({width:2560,height:800});
  await page.waitForFunction(()=>document.querySelector('.nyx-home-dot-field')?.dataset.constellationCount==='7');
  await page.evaluate(()=>{
    localStorage.setItem('nyx.performanceTier','medium');
    localStorage.setItem('nyx.performanceTierSource','explicit');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.nyx-home-dot-field')?.dataset.constellationCount==='4');
  await page.setViewportSize({width:600,height:800});
  await page.waitForFunction(()=>document.querySelector('.nyx-home-dot-field')?.dataset.constellationCount==='3');
  await page.evaluate(()=>{
    localStorage.setItem('nyx.performanceTier','high');
    localStorage.setItem('nyx.performanceTierSource','explicit');
  });
  await page.setViewportSize({width:1280,height:800});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.nyx-home-dot-field')?.dataset.constellationCount==='5');

  await page.locator('[data-nyx-apps-toggle]').click();
  const appsFrame=page.frameLocator('.browser-window iframe.active');
  const coloredIcons=appsFrame.locator('[data-global-app-id="crunchyroll"] .quick-icon,[data-global-app-id="newgrounds"] .quick-icon,[data-global-app-id="kick"] .quick-icon,[data-global-app-id="itch"] .quick-icon');
  await coloredIcons.first().waitFor();
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
  await page.locator('[data-browser-shell-home]').first().evaluate(button=>button.click());
  await page.waitForSelector('.nyx-minimal-home');
  await page.waitForSelector('#nyxAccountButton.nyx-account-button-rich',{timeout:15_000});

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

  await page.locator('.nyx-minimal-top-actions [data-open="settings"]').click();
  await page.waitForSelector('.browser-shell-settings-overlay');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.browser-shell-settings-overlay').count(),1,'Homepage Settings was removed after opening');
  await page.locator('[data-browser-shell-home]').evaluate(button=>button.click());
  await page.waitForSelector('.browser-shell-settings-overlay',{state:'detached'});
  await page.locator('[data-browser-shell-settings]').evaluate(button=>button.click());
  await page.waitForSelector('.browser-shell-settings-overlay');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.browser-shell-settings-overlay').count(),1,'Toolbar Settings was removed after opening');
  await page.locator('[data-browser-shell-home]').evaluate(button=>button.click());
  await page.waitForSelector('.browser-shell-settings-overlay',{state:'detached'});

  await page.locator('.nyx-minimal-top-actions [data-app-url="/apps/chat/"]').click();
  const chatFrame=page.frames().find(frame=>new URL(frame.url()).pathname==='/apps/chat/');
  if(!chatFrame)await page.waitForTimeout(500);
  const activeChatFrame=page.frames().find(frame=>new URL(frame.url()).pathname==='/apps/chat/');
  assert.ok(activeChatFrame,'Embedded Chat frame did not open');
  await activeChatFrame.waitForSelector('.member-button');
  await activeChatFrame.locator('.member-button').filter({hasText:'Chat Member'}).click();
  await page.waitForSelector('.nyx-profile-directory-overlay.show',{timeout:5_000});
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.nyx-profile-directory-overlay.show').count(),1,'Chat profile was removed after opening');
  await page.waitForSelector('.nyx-profile-directory-view-head',{timeout:10_000});
  assert.match(await page.locator('.nyx-profile-directory-view-head').textContent(),/Chat Member/);

  assert.deepEqual(pageErrors,[],`Browser errors: ${pageErrors.join(' | ')}`);
  console.log('Homepage constellation, colored app icons, account controls, and embedded Chat profile regression passed.');
}finally{
  await browser?.close().catch(()=>{});
  if(server.exitCode===null)server.kill();
}
