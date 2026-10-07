import {spawn} from 'node:child_process';
import {createCompanion} from './core.mjs';
function powershell(script,env={},signal){return new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,env:{...process.env,...env}});let value='';child.stdout.on('data',part=>value+=part);child.on('error',reject);const stop=()=>child.kill();signal?.addEventListener('abort',stop,{once:true});child.on('close',code=>{signal?.removeEventListener('abort',stop);code===0?resolve(value.trim()):reject(new Error('Desktop dialog was closed.'));});});}
if(process.platform!=='win32')throw new Error('This launcher supports Windows.');
const workspace=await powershell("Add-Type -AssemblyName System.Windows.Forms; $dialog=New-Object System.Windows.Forms.FolderWorkspaceDialog; $dialog.Description='Choose a project folder for Nook'; if($dialog.ShowDialog() -eq 'OK'){[Console]::Write($dialog.SelectedPath)}");
if(!workspace)process.exit(0);
const origin=process.env.NYX_AGENTS_ORIGIN||'https://nook.nyxlearning.org';
const companion=await createCompanion({workspace,origin,approve:async({title,text},signal)=>(await powershell("Add-Type -AssemblyName System.Windows.Forms; $answer=[System.Windows.Forms.MessageBox]::Show($env:NYX_DIALOG_TEXT,$env:NYX_DIALOG_TITLE,'YesNo','Question','Button2'); [Console]::Write($answer)",{NYX_DIALOG_TEXT:text,NYX_DIALOG_TITLE:title},signal))==='Yes'});
const url=origin+(origin.includes('localhost')?'/apps/agents/':'/')+'#companion='+companion.token+'&port='+companion.port;
await powershell('Start-Process -FilePath $env:NYX_AGENTS_URL',{NYX_AGENTS_URL:url});
console.log('Nook companion is running. Close this window to disconnect.');
console.log('Backups for this session: '+companion.backupRoot);
process.on('SIGINT',async()=>{await companion.close();process.exit(0);});
