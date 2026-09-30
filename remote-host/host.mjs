import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {hostname} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';

if(process.platform!=='win32'||typeof WebSocket==='undefined')throw Error('Nyx Remote needs Windows and Node.js 22 or 24.');
const root=dirname(fileURLToPath(import.meta.url));
const directory=join(process.env.LOCALAPPDATA,'NyxRemote'),configPath=join(directory,'device.dpapi');
const origin=process.env.NYX_REMOTE_ORIGIN||'https://nyxlearning.org';
if(new URL(origin).protocol!=='https:'&&!/^http:\/\/localhost:\d+$/.test(origin))throw Error('HTTPS is required.');
const ps=(script,input='')=>new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true});let out='';
  child.stdout.on('data',data=>out+=data);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(Error('Windows credential protection failed.')));child.stdin.end(input);
});
const protect=text=>ps('$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force; ConvertFrom-SecureString $s',text);
const unprotect=text=>ps('$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}',text);
const save=async config=>{await mkdir(directory,{recursive:true});await writeFile(configPath,await protect(JSON.stringify(config)),'utf8');};
const request=async(path,body)=>{const res=await fetch(origin+'/api/private-remote'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('Remote service unavailable ('+res.status+').');return res.json();};
let config;
try{config=JSON.parse(await unprotect(await readFile(configPath,'utf8')));}catch(error){if(error.code!=='ENOENT')throw Error('Saved pairing cannot be read. Use Remove pairing before trying again.');}
if(config&&config.origin!==origin)throw Error('Saved pairing belongs to another server.');
if(!config){
 const credential=randomBytes(32).toString('base64url');const pair=await request('/pair/start',{credential,name:hostname()});
 console.log('On your owner account, open '+origin+'/apps/remote/');
 console.log('Pair this computer with code: '+pair.code.match(/.{1,4}/g).join('-'));
 console.log('This code expires in five minutes.');
 for(let i=0;i<100;i++){
  await new Promise(resolve=>setTimeout(resolve,3000));const result=await request('/pair/poll',{poll:pair.poll});
  if(result.deviceId){config={origin,id:result.deviceId,credential};await save(config);break;}
 }
 if(!config)throw Error('Pairing expired. Run Start-Nyx-Remote.cmd again.');
}
console.log('Nyx Remote is running. Use its tray menu to disconnect or exit.');
const worker=spawn('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',join(root,'desktop.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
let socket=null,stopping=false,retry=null,workerReady=false;
function command(value){if(!worker.stdin.destroyed)worker.stdin.write(JSON.stringify(value)+'\n');}
function stop(){if(stopping)return;stopping=true;clearTimeout(retry);socket?.close();command({type:'control',active:false});worker.stdin.end();setTimeout(()=>{worker.kill();process.exit(0);},1000).unref();}
const lines=createInterface({input:worker.stdout});
lines.on('line',line=>{
 if(line==='READY'){workerReady=true;connect();return;}
 if(line==='STOP'){socket?.close();return;}
 if(socket?.readyState!==1)return;
 if(line.startsWith('FRAME:')){if(socket.bufferedAmount<256000)socket.send(Buffer.from(line.slice(6),'base64'));}
 if(line.startsWith('STATUS:'))socket.send(JSON.stringify({type:'status',message:line.slice(7)}));
});
worker.stderr.on('data',()=>console.error('Desktop helper reported an error. Restart Nyx Remote.'));
worker.on('error',stop);worker.on('exit',()=>{stopping=true;clearTimeout(retry);socket?.close();process.exit(0);});
function connect(){
 if(stopping||!workerReady)return;
 socket=new WebSocket(origin.replace(/^http/,'ws')+'/api/private-remote/socket');
 socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'host',id:config.id,credential:config.credential})));
 socket.addEventListener('message',event=>{try{const data=JSON.parse(event.data);if(data.type!=='ready')command(data);}catch{socket.close();}});
 socket.addEventListener('error',()=>{});
 socket.addEventListener('close',event=>{command({type:'control',active:false});if(event.code===4003){console.error('Pairing was removed. Re-pair this PC to continue.');stop();return;}if(!stopping)retry=setTimeout(connect,5000);});
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
