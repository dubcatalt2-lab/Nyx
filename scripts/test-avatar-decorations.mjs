import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import vm from 'node:vm';
const catalog=JSON.parse(readFileSync('assets/profile/decorations/catalog.json','utf8'));
const effects=JSON.parse(readFileSync('assets/profile/effects/catalog.json','utf8'));
const source=readFileSync('server.js','utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('const nyxAvatarDecorationValues ='),source.indexOf('const nyxLegacyProfileEffectMap ='))+source.slice(source.indexOf('const nyxLegacyAvatarDecorationMap ='),source.indexOf('function nyxProfileEffectValue'))+source.slice(source.indexOf('function nyxAvatarDecorationValue'),source.indexOf('\n}',source.indexOf('function nyxAvatarDecorationValue'))+2),context);
for(const item of catalog){
 assert.equal(context.nyxAvatarDecorationValue(item.id),item.id);
 assert.equal(readFileSync('.'+item.path).includes(Buffer.from('acTL')),item.animated);
 assert(!readFileSync('.'+item.staticPath).includes(Buffer.from('acTL')));
}
assert.equal(context.nyxAvatarDecorationValue('untrusted-path'),'none');assert.equal(context.nyxAvatarDecorationValue('starfall'),'candlelight');
vm.runInContext(source.slice(source.indexOf('const nyxProfileEffectValues ='),source.indexOf('const nyxAvatarDecorationValues ='))+source.slice(source.indexOf('const nyxLegacyProfileEffectMap ='),source.indexOf('const nyxLegacyAvatarDecorationMap ='))+source.slice(source.indexOf('function nyxProfileEffectValue'),source.indexOf('\n}',source.indexOf('function nyxProfileEffectValue'))+2),context);
for(const item of effects){assert.equal(context.nyxProfileEffectValue(item.id),item.id);assert.equal(readFileSync('.'+item.path).includes(Buffer.from('acTL')),item.animated);assert(!readFileSync('.'+item.staticPath).includes(Buffer.from('acTL')));}
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8');
const mockModule=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199';
let profile={displayName:'Decoration Test',handle:'@account-test',avatarUrl:'',avatarDecoration:'none',profileEffect:'none',status:'online'},saved;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');});
 for(const [file,module] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('https://www.gstatic.com/firebasejs/11.10.0/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:mockModule(module)}));
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname,json=body=>r.fulfill({json:body});
  if(path==='/api/founder-profile/auth-config')return json({enabled:true,projectId:'nyx-test',apiKey:'test',ownerConfigured:true});
  if(path==='/api/founder-profile/owner')return json({founder:false,dashboard:false,role:'member',permissions:[]});
  if(path==='/api/profiles/me'){if(r.request().method()==='PUT'){saved=r.request().postDataJSON();profile={...profile,...saved.profile,...saved};}return json({uid:'test-user-1234',profile,createdAt:'2026-01-01T00:00:00.000Z'});}
  if(path==='/api/account/me')return json({email:'account-test@example.com',role:'member',subscriptionStatus:'none'});
  if(path.startsWith('/api/activity/'))return json({ok:true});
  return r.continue();
 });
 await page.goto(base);await page.waitForFunction(()=>!document.body.classList.contains('nyx-loading-active')&&!document.body.classList.contains('nyx-startup-prep'));await page.locator('#nyxAccountButton[title="Account menu"]').click();await page.locator('[data-nyx-account-menu-action="edit"]').click();
 const picker=page.locator('select[name=avatarDecoration]');await picker.waitFor();assert.equal(await picker.locator('option').count(),27);
 for(const item of catalog){
  await picker.selectOption(item.id);
  const overlay=page.locator('.nyx-user-profile-view .nyx-user-profile-avatar>.nyx-avatar-decoration');
  await page.waitForFunction(id=>{const e=document.querySelector('.nyx-user-profile-view .nyx-user-profile-avatar>.nyx-avatar-decoration');return e&&getComputedStyle(e).backgroundImage.includes(id+'.png');},item.id);
  assert.equal(await overlay.evaluate(e=>getComputedStyle(e).display),'block');
  assert.equal(await overlay.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 }
 const effectPicker=page.locator('select[name=profileEffect]');assert.equal(await effectPicker.locator('option').count(),56);
 for(const item of effects){
  assert.equal(await effectPicker.locator(`option[value="${item.id}"]`).textContent(),item.label);
  await effectPicker.selectOption(item.id);
  await page.waitForFunction(id=>{const e=document.querySelector('.nyx-user-profile-view .nyx-user-profile-effect');return e&&getComputedStyle(e).backgroundImage.includes(id+'.png')&&getComputedStyle(e).pointerEvents==='none';},item.id);
 }
 await effectPicker.selectOption('fx-cosmic-vortex');
 await picker.selectOption('vortex-crown');await page.waitForTimeout(400);
 await page.screenshot({path:'.codex-artifacts/profile-effects-desktop.png'});
 await picker.selectOption('neon-vortex');await page.screenshot({path:'.codex-artifacts/decorations-desktop.png'});
 await page.emulateMedia({reducedMotion:'reduce'});assert.match(await page.locator('.nyx-user-profile-view .nyx-user-profile-avatar>.nyx-avatar-decoration').evaluate(e=>getComputedStyle(e).backgroundImage),/neon-vortex-still.png/);
 assert.match(await page.locator('.nyx-user-profile-view .nyx-user-profile-effect').evaluate(e=>getComputedStyle(e).backgroundImage),/fx-cosmic-vortex-still.png/);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.evaluate(()=>{const form=document.querySelector('.nyx-user-profile-form').getBoundingClientRect(),preview=document.querySelector('.nyx-discord-preview-pane').getBoundingClientRect();return preview.top>=form.bottom-1;}),'Mobile preview must not overlap editor fields');
 await page.screenshot({path:'.codex-artifacts/decorations-mobile.png'});
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.waitForTimeout(500);assert.equal(saved?.avatarDecoration||saved?.profile?.avatarDecoration,'neon-vortex');
 await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('nyx-loading-active')&&!document.body.classList.contains('nyx-startup-prep'));await page.setViewportSize({width:1440,height:960});await page.locator('#nyxAccountButton[title="Account menu"]').click();await page.locator('[data-nyx-account-menu-action="edit"]').click();assert.equal(await picker.inputValue(),'neon-vortex');
 assert.equal(await effectPicker.inputValue(),'fx-cosmic-vortex');
 await page.getByRole('navigation',{name:'Profile sections'}).getByRole('button',{name:'Decorations',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:'.codex-artifacts/profile-editor-decorations.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS 25 avatar decorations and 54 profile effects: animation/stills, server allowlists, labels, previews, save/reload, reduced motion and mobile layout');
}finally{await browser.close();}
