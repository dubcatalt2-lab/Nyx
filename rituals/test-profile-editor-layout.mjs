import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199';
const profile={
  displayName:'Account Test',handle:'@account-test',bio:'Workspace regression profile',
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

let workspace;
let postedChatMessage=null;
try{

  workspace=await chromium.launch({channel:'msedge',headless:true});
  const page=await workspace.newPage({viewport:{width:1280,height:800}});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('nyx.setupComplete','true');
    localStorage.setItem('nyx.workspaceShellMode','true');
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
    if(path==='/api/profiles/me'&&method==='PUT'){Object.assign(profile,route.request().postDataJSON().profile||route.request().postDataJSON());return json({profile});}
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
  await page.getByRole('button',{name:'Got it',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#nyxStudyHubStartup'));
  await page.locator('#nyxAccountButton.nyx-account-button-rich').waitFor();
  await page.waitForFunction(()=>!document.body.classList.contains('nyx-loading-active'));
  await page.locator('#nyxAccountButton').click();
  await page.locator('[data-nyx-account-menu-action="edit"]').click();
  const editor=page.locator('.nyx-profile-organized'), form=editor.locator('form'), card=editor.locator('.nyx-public-profile-popup');
  await editor.waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({path:'.codex-artifacts/chat-social/editor-desktop.png'});
  const bounds=await editor.locator('.nyx-user-profile-dialog').boundingBox();
  assert(bounds.x>50&&bounds.width<=1022&&bounds.height<=762);
  assert((await card.boundingBox()).height<550);
  assert.equal(await editor.locator('.nyx-profile-section-nav button svg').count(),6);
  await form.locator('[name="displayName"]').fill('River Updated');
  await page.waitForFunction(()=>document.querySelector('.nyx-public-profile-popup h2')?.textContent==='River Updated');
  await form.locator('[type="submit"]').click();
  await page.waitForTimeout(500);
  assert.equal(profile.displayName,'River Updated');
  assert.equal(profile.avatarDecoration,'candlelight');
  assert.equal(profile.profileEffect,'blooming-roses');
  if(!await editor.isVisible()){await page.locator('#nyxAccountButton').click();await page.locator('[data-nyx-account-menu-action="edit"]').click();}
  await page.setViewportSize({width:390,height:700});
  await page.waitForTimeout(200);
  assert(await form.isVisible());assert(!await editor.locator('.nyx-discord-preview-pane').isVisible());
  await editor.locator('.nyx-profile-preview-toggle').click();
  assert(await card.isVisible());assert(!await form.isVisible());
  const mobile=await card.boundingBox();assert(mobile.x>=0&&mobile.x+mobile.width<=390);
  await page.screenshot({path:'.codex-artifacts/chat-social/editor-mobile.png'});
  await editor.locator('.nyx-profile-preview-toggle').click();
  await editor.getByRole('button',{name:'Images',exact:true}).click();
  await editor.locator('[data-nyx-pick-image="banner"]').waitFor({state:'visible'});
  const chooser=page.waitForEvent('filechooser');await editor.locator('[data-nyx-pick-image="banner"]').click();await chooser;
  assert.deepEqual(pageErrors,[]);
  console.log('PASS centered editor, compact live card, SVG navigation, profile save/decorations, mobile Edit/Preview and preserved image picker');
}finally{await workspace?.close();}
