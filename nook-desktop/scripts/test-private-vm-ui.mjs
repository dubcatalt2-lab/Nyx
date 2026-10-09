import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{_electron}=require('../../node_modules/playwright-core');
const data=mkdtempSync(path.join(tmpdir(),'nook-vmui-')),env={...process.env,NOOK_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
const installed=process.env.NOOK_INSTALLED_EXE;
const app=await _electron.launch({executablePath:installed||require('electron'),args:installed?['--user-data-dir='+data]:[path.resolve(import.meta.dirname,'..')],env});
try{
 const page=await app.firstWindow();await page.locator('#version').waitFor();
 await app.evaluate(({app})=>{
  const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),{Provider}=require('./src/provider.cjs');
  let step=0;Provider.prototype.request=async function(route,body){if(route.endsWith('/models'))return {models:[{id:'fixture/model',label:'Fixture'}]};
   const content=step++===0?JSON.stringify({message:'Check the VM',tool:'command',args:{command:'uname -s; id -un',shell:'bash'}}):JSON.stringify({message:'VM check completed',done:true})+'\nReady.';
   return {choices:[{message:{content},finish_reason:'stop'}]};};
 });
 await page.locator('#manualKey summary').click();await page.locator('#key').fill('n_api_'+'a'.repeat(43));await page.locator('#connectAccount').click();await page.locator('#accountSetup').waitFor({state:'hidden'});
 await page.locator('#prompt').fill('Test in the private VM');await page.locator('#run').click();
 await page.waitForFunction(()=>document.getElementById('state').textContent==='Done');
 assert.equal(app.windows().length,1);
 const status=await page.evaluate(()=>window.nook.invoke('status'));assert.equal(status.permissions.target,'local');assert.equal(status.permissions.level,0);
 assert.equal(await page.locator('#connectVM').count(),0);
 await page.getByRole('button',{name:'Terminal',exact:true}).click();assert.match(await page.locator('#terminalOutput').textContent(),/Linux/);assert.match(await page.locator('#terminalOutput').textContent(),/nook-agent/);assert.equal(await page.locator('#commandForm').count(),0);
 await page.screenshot({path:path.join(data,'private-vm.png')});
 console.log('PASS '+(installed?'installed':'development')+' automatic AI-only VM connection, no setup/command prompts, real Linux command, separate manual permissions and formatted-reply recovery');
 console.log(path.join(data,'private-vm.png'));
}finally{await app.close();}
