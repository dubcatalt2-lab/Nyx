import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{_electron}=require('../../node_modules/playwright-core');
const folder=path.resolve(import.meta.dirname,'..'),data=mkdtempSync(path.join(tmpdir(),'nook-simple-')),project=path.join(data,'project');mkdirSync(project);
const env={...process.env,NOOK_TEST_DATA:path.join(data,'profile')};delete env.ELECTRON_RUN_AS_NODE;
const launch=()=>_electron.launch({executablePath:require('electron'),args:[folder],env});
let app=await launch();
try{
 let page=await app.firstWindow();await page.locator('#accountSetup').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-page=memory]').isVisible(),true);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({app,dialog},project)=>{
   const {createRequire}=process.getBuiltinModule('module'),require=createRequire(app.getAppPath()+'/package.json');
   const {Provider}=require('./src/provider.cjs');
   Provider.prototype.request=async()=>({models:[{id:'fixture-model',label:'Fixture model'},{id:'anthropic/claude-haiku-5.5',label:'Claude Haiku 5.5'}]});
   const {Account}=require('./src/account.cjs');
   Account.prototype.json=async function(url,options={}){if(url.includes('auth-config'))return {enabled:true,apiKey:'fixture'};if(url.includes('signInWithPassword')){const uid=options.body.email.split('@')[0];return {localId:uid,idToken:uid,refreshToken:'fixture-refresh',expiresIn:'3600'};}if(url.endsWith('/connect'))return {uid:options.token,key:'n_api_'+(options.token==='member'?'x':'y').repeat(43)};return {uid:this.session.uid,email:this.session.email,name:this.session.uid,usage:{total:{limit:7000,used:100,remaining:6900},expensive:{remaining:1000},haiku:{remainingUsd:.05},periodDays:4}};};
   dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});
 },project);
 await page.locator('#email').fill('member@example.test');await page.locator('#password').fill('fixture-password');await page.locator('#signIn').click();await page.locator('#accountSetup').waitFor({state:'hidden'});
 await page.locator('#usageHint').filter({hasText:'6,900'}).waitFor();
 assert.equal(await page.locator('#model').inputValue(),'anthropic/claude-haiku-5.5');assert.equal(await page.locator('#run').isEnabled(),true);
 await page.locator('#modelTrigger').click();await page.locator('#modelQuery').fill('fixture');await page.locator('.model-option').click();
 const review=app.waitForEvent('window');await page.locator('#quickFolder').click();await(await review).locator('#allow').click();
 await page.locator('#scope').filter({hasText:'Project access'}).waitFor();
 assert.equal(JSON.parse(readFileSync(path.join(data,'profile/profiles',createHash('sha256').update('member').digest('hex'),'project.json'),'utf8')).root,project);
 await page.locator('[data-prompt]').first().click();assert.match(await page.locator('#prompt').inputValue(),/Explain this project/);
 for(const [width,height] of [[1320,880],[800,600]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);
  await page.waitForTimeout(100);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#run').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(data,`connected-${width}.png`)});
 }
 await page.evaluate(()=>window.nook.invoke('remember',{text:'Account A private note'}));
 await page.locator('#accountShortcut').click();await page.locator('#email').fill('other@example.test');await page.locator('#password').fill('fixture-password');await page.locator('#signIn').click();await page.locator('#accountSetup').waitFor({state:'hidden'});
 let switched=await page.evaluate(()=>window.nook.invoke('status'));assert.equal(switched.account.uid,'other');assert.equal(switched.permissions.level,0);assert.equal(switched.memories.length,0);assert.equal(await page.locator('#prompt').inputValue(),'');
 await page.locator('#accountShortcut').click();await page.locator('#email').fill('member@example.test');await page.locator('#password').fill('fixture-password');await page.locator('#signIn').click();await page.locator('#accountSetup').waitFor({state:'hidden'});
 switched=await page.evaluate(()=>window.nook.invoke('status'));assert.equal(switched.memories[0].text,'Account A private note');
 await app.close();app=await launch();page=await app.firstWindow();
 await page.locator('#scope').filter({hasText:'Access paused'}).waitFor();
 assert.equal(await page.locator('#quickFolder').textContent(),'project');
 assert.equal(await page.evaluate(()=>localStorage.getItem('nook.model')),'fixture-model');
 const status=await page.evaluate(()=>window.nook.invoke('status'));assert.equal(status.connected,true);assert.equal(status.permissions.level,0);
 assert.deepEqual(errors,[]);
 console.log('PASS native sign-in, usage display, secure saved account, account-isolated notes, preferred model, one-click project review, remembered folder without restored permission, and compact layouts');
 console.log('Screenshots: '+data);
}finally{await app.close();}
