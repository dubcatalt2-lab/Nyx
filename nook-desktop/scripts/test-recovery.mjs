import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{_electron}=require('../../node_modules/playwright-core');
const data=mkdtempSync(path.join(tmpdir(),'nook-recovery-ui-')),project=path.join(data,'project'),env={...process.env,NOOK_TEST_DATA:path.join(data,'profile')};delete env.ELECTRON_RUN_AS_NODE;
mkdirSync(project);writeFileSync(path.join(project,'index.html'),'<h1>Before</h1>');
const installed=process.env.NOOK_INSTALLED_EXE;
const app=await _electron.launch({executablePath:installed||require('electron'),args:installed?['--user-data-dir='+path.join(data,'profile')]:[path.resolve(import.meta.dirname,'..')],env});
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.locator('#version').waitFor();
 await app.evaluate(({app,dialog},project)=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});
  const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),{Provider}=require('./src/provider.cjs');let step=0;
  Provider.prototype.request=async function(route,body){if(route.endsWith('/models'))return {models:[{id:'fixture/model',label:'Fixture'}]};
   const observation=body.messages.filter(m=>m.content.startsWith('UNTRUSTED TOOL OBSERVATION: ')).at(-1);
   const hash=observation?JSON.parse(observation.content.slice('UNTRUSTED TOOL OBSERVATION: '.length)).hash:null;
   const replies=[{content:'<invoke_tool>{"message":"Inspecting the project.","tool":"read","args":{"path":"index.html"}}',finish_reason:'stop'},
   {content:'{"message":"Edit","tool":"edit","args":{"path":"index.html","newText":"partial',finish_reason:'length'},
   {content:JSON.stringify({message:'Update the heading.',tool:'edit',args:{path:'index.html',oldText:'Before',newText:'After',expectedHash:hash}}),finish_reason:'stop'},
   {content:JSON.stringify({message:'Verify the file.',tool:'read',args:{path:'index.html'}}),finish_reason:'stop'},
   {content:JSON.stringify({message:'The heading is After. I read back index.html and verified the edit.',done:true}),finish_reason:'stop'},
   {content:JSON.stringify({message:body.messages.some(m=>m.content.includes('UNTRUSTED PREVIOUS TOOL OBSERVATION'))?'Previous tool results confirm the heading is After.':'Evidence missing',done:true}),finish_reason:'stop'}];
   const reply=replies[step++];return {choices:[{message:{content:reply.content},finish_reason:reply.finish_reason}]};};
 },project);
 await page.locator('#manualKey summary').click();await page.locator('#key').fill('n_api_'+'a'.repeat(43));await page.locator('#connectAccount').click();await page.locator('#accountSetup').waitFor({state:'hidden'});
 let approval=app.waitForEvent('window');await page.locator('#quickFolder').click();await(await approval).locator('#allow').click();
 approval=app.waitForEvent('window');await page.locator('#prompt').fill('Change the fixture heading and verify it');await page.locator('#run').click();const start=await approval;approval=app.waitForEvent('window');await start.locator('#allow').click();const edit=await approval;await edit.locator('#title').filter({hasText:'Apply this file edit?'}).waitFor();await edit.locator('#allow').click();
 await page.waitForFunction(()=>document.getElementById('state').textContent==='Done');
 assert.equal(readFileSync(path.join(project,'index.html'),'utf8'),'<h1>After</h1>');
 assert(!(await page.locator('#conversation').textContent()).includes('<invoke_tool>'));
 assert.equal(await page.locator('#error').isVisible(),false);
 assert.match(await page.locator('#activity').textContent(),/output_limit/);
 approval=app.waitForEvent('window');await page.locator('#prompt').fill('What was verified?');await page.locator('#run').click();await(await approval).locator('#allow').click();await page.locator('.message.assistant').last().filter({hasText:'Previous tool results confirm'}).waitFor();
 assert.match(await page.locator('.message.assistant').last().textContent(),/Previous tool results confirm/);
 await page.screenshot({path:path.join(data,'recovered.png')});assert.deepEqual(errors,[]);
 console.log('PASS '+(installed?'packaged':'development')+' Electron wrapper recovery, truncated edit regeneration, real approved file edit, read-back, evidence across turns and no raw protocol in chat. '+data);
}finally{await app.close();}
