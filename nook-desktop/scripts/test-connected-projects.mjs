import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{_electron}=require('../../node_modules/playwright-core');
const data=mkdtempSync(path.join(tmpdir(),'nook-connected-ui-')),project=path.join(data,'project'),env={...process.env,NOOK_TEST_DATA:path.join(data,'profile')};delete env.ELECTRON_RUN_AS_NODE;
mkdirSync(project);writeFileSync(path.join(project,'hello.txt'),'Windows primary');
const installed=process.env.NOOK_INSTALLED_EXE;
const app=await _electron.launch({executablePath:installed||require('electron'),args:installed?['--user-data-dir='+path.join(data,'profile')]:[path.resolve(import.meta.dirname,'..')],env});
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.locator('#version').waitFor();
 await app.evaluate(({app,dialog},project)=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});
  const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),{Provider}=require('./src/provider.cjs'),{Connections}=require('./src/connections.cjs');
  Connections.prototype.status=async()=>({connected:true,login:'fixture-user'});
  Connections.prototype.repositories=async()=>[{nameWithOwner:'fixture/project',isPrivate:true}];
  let step=0;Provider.prototype.request=async function(route,body){if(route.endsWith('/models'))return {models:[{id:'fixture/model',label:'Fixture'}]};
   const replies=[{message:'Reading the project.',tool:'read',args:{path:'hello.txt'}},{message:'Running the isolated check.',tool:'test.command',args:{command:'uname -s; cat hello.txt; printf tested > tested.txt'}},{message:'Summarizing what I found.',done:true},{message:'The Windows project contains hello.txt. The Linux test completed and created tested.txt only in the test copy.',done:true}];
   globalThis.connectedTestMessages=body.messages;
   return {choices:[{message:{content:JSON.stringify(replies[step++])},finish_reason:'stop'}]};};
 },project);
 await page.locator('#manualKey summary').click();await page.locator('#key').fill('n_api_'+'a'.repeat(43));await page.locator('#connectAccount').click();await page.locator('#accountSetup').waitFor({state:'hidden'});
 let popup=app.waitForEvent('window');await page.locator('#quickFolder').click();await(await popup).locator('#allow').click();await page.waitForFunction(()=>document.getElementById('scope').textContent.startsWith('Project access'));
 popup=app.waitForEvent('window');await page.locator('#prompt').fill('Inspect this Windows project and test in the VM');await page.locator('#run').click();await(await popup).locator('#allow').click();
 await page.waitForFunction(()=>document.getElementById('state').textContent==='Done');
 assert.equal(readFileSync(path.join(project,'hello.txt'),'utf8'),'Windows primary');
 const status=await page.evaluate(()=>window.nook.invoke('status'));assert.equal(status.permissions.target,'local');assert.equal(status.permissions.root,project);assert(status.permissions.testing.ready);
 assert.match(await page.locator('.message.assistant').last().textContent(),/created tested.txt only/);
 assert(!(await page.locator('#conversation').textContent()).includes('Summarizing what I found.'));
 await page.getByRole('button',{name:'Projects',exact:true}).click();await page.locator('#githubStatus').filter({hasText:'fixture-user'}).waitFor();await page.locator('#githubRepos').click();await page.locator('#repositoryList button').filter({hasText:'fixture/project'}).waitFor();
 await page.locator('#reviewVM').click();await page.locator('#vmChanges').filter({hasText:'tested.txt'}).waitFor();
 popup=app.waitForEvent('window');await page.locator('#vmChanges button').click();await(await popup).locator('#allow').click();await page.waitForFunction(()=>!document.getElementById('vmChanges').children.length);assert.equal(readFileSync(path.join(project,'tested.txt'),'utf8'),'tested');
 await page.screenshot({path:path.join(data,'projects.png')});
 await page.setViewportSize({width:800,height:720});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(data,'projects-compact.png')});
 await page.locator('#publishProject').click();assert.match(await page.locator('#prompt').inputValue(),/commit, push and deploy/);
 assert.deepEqual(errors,[]);
 console.log('PASS '+(installed?'installed':'development')+' Windows-primary files, explicit real-VM test, reviewed apply-back, GitHub repository UI, useful final-answer recovery, desktop/compact layout and publishing prompt. Screenshots: '+data);
}finally{await app.close();}
