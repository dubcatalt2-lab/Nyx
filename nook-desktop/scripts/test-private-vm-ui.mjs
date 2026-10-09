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
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const popup=app.waitForEvent('window');await page.locator('#connectVM').click();await(await popup).locator('#allow').click();
 await page.waitForFunction(()=>document.getElementById('quickFolder').textContent==='Nyx VM');
 const status=await page.evaluate(()=>window.nook.invoke('status'));assert.equal(status.permissions.target,'vm');
 const runPopup=app.waitForEvent('window');const pending=page.evaluate(()=>window.nook.invoke('tool',{tool:'command',args:{command:'uname -s; id -un',shell:'bash'}}));
 const approval=await runPopup;assert.match(await approval.locator('#detail').textContent(),/Linux bash inside NyxCloud/);await approval.locator('#allow').click();
 const result=await pending;assert.equal(result.exitCode,0);assert.match(result.stdout,/Linux/);assert.match(result.stdout,/nook-agent/);
 await page.getByRole('button',{name:'Terminal',exact:true}).click();assert.match(await page.locator('#terminalOutput').textContent(),/Linux/);assert.equal(await page.locator('#commandForm').count(),0);
 await page.screenshot({path:path.join(data,'private-vm.png')});
 console.log('PASS '+(installed?'installed':'development')+' private VM connection, native approval, actual Linux command, output log and composer target');
 console.log(path.join(data,'private-vm.png'));
}finally{await app.close();}
