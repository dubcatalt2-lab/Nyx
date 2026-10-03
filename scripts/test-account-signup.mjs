import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const port=8198;
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
  const user={uid:'test-user-1234',email:'account-test@example.com',emailVerified:false,async getIdToken(){return 'test-token'},async reload(){}};
  const auth={currentUser:user,async authStateReady(){},async signOut(){globalThis.__nyxMockSignOuts=(globalThis.__nyxMockSignOuts||0)+1;this.currentUser=null;listeners.forEach(listener=>listener(null))}};
  export const browserLocalPersistence={};
  export const getAuth=()=>auth;
  export async function setPersistence(){}
  export function onAuthStateChanged(_auth,listener){listeners.push(listener);queueMicrotask(()=>listener(auth.currentUser));return()=>{}}
  export async function signInWithCustomToken(){auth.currentUser=user;listeners.forEach(listener=>listener(user));return {user}}
  export async function sendEmailVerification(){throw new Error('Email verification must not be requested')}
`;

let browser;
let postedChatMessage=null;
let registrations=0,cloudReads=0;
try{
  await waitForServer();
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('nyx.setupComplete','true');
    localStorage.setItem('nyx.browserShellMode','true');
    if(!sessionStorage.getItem('nyx.test.originalMigration')){
      localStorage.setItem('nyx.homeDesign','original');
      sessionStorage.setItem('nyx.test.originalMigration','true');
    }
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
  if(process.env.NYX_TEST_BUILD==='true')await page.route('**/script.js?*',async route=>route.fulfill({contentType:'text/javascript',body:await readFile('dist/script.js','utf8')}));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    const method=route.request().method();
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/api/founder-profile/auth-config')return json({enabled:true,projectId:'nyx-test',apiKey:'test',ownerConfigured:true});
    if(path==='/api/founder-profile/owner')return json({founder:true,dashboard:true,role:'owner',permissions:[]});
    if(path==='/api/profiles/me')return json({uid:'test-user-1234',profile,createdAt:'2026-01-01T00:00:00.000Z'});
    if(path==='/api/account/me')return json({email:'account-test@example.com',role:'owner',subscriptionStatus:'premium'});
    if(path==='/api/account/cloud-preferences'){if(method==='GET')cloudReads++;return json({preferences:{}});}
    if(path==='/api/account/register'){registrations++;assert.ok(['optional@example.com',''].includes(route.request().postDataJSON().email));return json({customToken:'fixture-token',verificationRequired:false});}
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
    if(path==='/api/chat/messages'&&method==='POST'){
      postedChatMessage=route.request().postDataJSON();
      const replyTo=postedChatMessage.replyToMessageId?{id:'test-message-1',text:'Existing message',attachmentName:'',author:{uid:'test-member-5678',displayName:'Chat Member',handle:'@chat-member'}}:null;
      return json({message:{id:'test-message-2',text:'Smooth send',replyTo,attachments:[],reactions:[],createdAt:'2026-08-20T20:01:00.000Z',createdAtMs:1787256060000,author:{uid:'test-user-1234',displayName:'Account Test',handle:'@account-test',role:'owner'}}});
    }
    if(path==='/api/chat/messages')return json({messages:[{id:'test-message-1',text:'Existing message',attachments:[],reactions:[],createdAt:'2026-08-20T20:00:00.000Z',createdAtMs:1787256000000,author:{uid:'test-member-5678',displayName:'Chat Member',handle:'@chat-member',role:'member'}}],hasMore:false});
    if(path==='/api/chat/conversations')return json({conversations:[],channelActivity:{}});
    if(path==='/api/chat/caffeine')return json({caffeine:null});
    if(path==='/api/chat/voice/status')return json({channels:[],participants:[]});
    if(path.startsWith('/api/activity/'))return json({ok:true});
    return json({});
  });

  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#nyxAccountButton.nyx-account-button-rich');
  await page.waitForFunction(()=>!document.querySelector('.nyx-preflight,.nyx-tos-gate'));
  for(const [width,email] of [[1280,'optional@example.com'],[390,'']]) {
    // Open at desktop size, then verify the same form at the target viewport.
    await page.setViewportSize({width:1280,height:850});
    await page.locator('#nyxAccountButton').click();
    await page.locator('[data-nyx-account-menu-action="switch"]').click();
    await page.locator('[data-nyx-account-tab="register"]').click();
    await page.setViewportSize({width,height:850});
    assert.ok(cloudReads>0,'Unverified accounts must load cloud preferences');
    assert.match(await page.locator('.nyx-account-footer').innerText(),/Email is optional/);
    assert.equal(await page.locator('.nyx-account-overlay [name="email"]').getAttribute('required'),null);
    await page.locator('.nyx-account-overlay [name="username"]').fill('signup-test');
    await page.locator('.nyx-account-overlay [name="email"]').fill(email);
    await page.locator('.nyx-account-overlay [name="password"]').fill('fixture-password-123');
    await page.locator('.nyx-account-submit').click();
    await page.waitForSelector('.nyx-account-overlay',{state:'detached'});
    assert.equal(await page.locator('.nyx-email-verification-overlay').count(),0);
  }
  assert.equal(registrations,2);
  assert.deepEqual(pageErrors,[]);
  console.log('PASS: desktop/mobile signup with optional or absent email, no verification request/gate, unverified cloud sync');
} finally {
  await browser?.close().catch(()=>{});
  if(server.exitCode===null)server.kill();
}
