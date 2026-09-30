import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {join} from 'node:path';
const directory=join(process.env.ProgramData,'NyxRemote');
const configPath=join(directory,'service.dpapi');
const ps=(script,input)=>new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true});let result='';child.stdout.on('data',data=>result+=data);child.on('error',reject);child.on('close',code=>code===0?resolve(result.trim()):reject(Error('Credential protection unavailable')));child.stdin.end(input);});
const decode=text=>ps('Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::LocalMachine))',text);
const encode=text=>ps('Add-Type -AssemblyName System.Security; $bytes=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::LocalMachine))',text);
const config=JSON.parse(await decode(await readFile(configPath,'utf8')));
if(config.origin!=='https://nyxlearning.org')throw Error('Unexpected remote origin');
const post=async(path,body)=>{const response=await fetch(config.origin+'/api/private-remote'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Remote service unavailable');return response.json();};
let socket,desktop,stopped=false,timer,watchdog,failures=0;
let diagnostics=Promise.resolve();
const status=message=>{diagnostics=diagnostics.then(async()=>{
 const line=new Date().toISOString()+' '+message;
 await writeFile(join(directory,'status.txt'),line);
 const path=join(directory,'bridge-log.txt');
 const previous=await readFile(path,'utf8').catch(()=>'');
 await writeFile(path,previous.split('\n').filter(Boolean).slice(-99).concat(line).join('\n')+'\n');
}).catch(()=>{});return diagnostics;};
const closeDesktop=()=>{const old=desktop;desktop=null;old?.destroy();};
function connect(){
 if(stopped)return;
 const current=new WebSocket('wss://fmsrobotics.robot-agachado.com/api/private-remote/socket');socket=current;current.binaryType='arraybuffer';
 let lastReply=Date.now(),readyAt=0,timeoutAt=0,failure='transport closed';
 void status('Connecting to direct relay');
 watchdog=setInterval(()=>{
  if(current!==socket)return;
  const time=Date.now();
  if(timeoutAt){if(time-timeoutAt>=5000)finish(1006);return;}
  if(time-lastReply>(readyAt?60000:20000)){
   failure=readyAt?'relay heartbeat timed out':'connection setup timed out';timeoutAt=time;
   current.close(4000,'Connection timed out');return;
  }
  if(readyAt&&current.readyState===1)current.send(JSON.stringify({type:'heartbeat'}));
 },10000);
 const finish=code=>{
  if(current!==socket)return;socket=null;clearInterval(watchdog);closeDesktop();
  if(code===4003){stopped=true;void status('Pairing rejected; check owner device approval');return;}
  if(readyAt&&Date.now()-readyAt>=60000)failures=0;
  const delay=Math.min(10000,1000*2**Math.min(failures++,4));
  void status('Offline; reconnecting in '+delay/1000+'s; code '+code+'; '+failure);
  if(!stopped)timer=setTimeout(connect,delay);
 };
 current.onopen=()=>{if(current!==socket)return;current.send(JSON.stringify({type:'host',id:config.id,credential:config.credential}));};
 current.onmessage=event=>{
  if(current!==socket)return;lastReply=Date.now();
  if(typeof event.data!=='string'){if(desktop&&!desktop.destroyed){if(desktop.writableLength>4*1024*1024){closeDesktop();current.send(JSON.stringify({type:'ended'}));}else desktop.write(Buffer.from(event.data));}return;}
  try{const value=JSON.parse(event.data);
   if(value.type==='ready'){readyAt=Date.now();void status('Online; awaiting owner connection');return;}
   if(value.type==='heartbeat')return;
   if(value.type!=='control')return;closeDesktop();
   if(!value.active){void status('Online; owner disconnected');return;}
   void status('Owner connected');
   current.send(JSON.stringify({type:'vnc',password:config.vncPassword}));
   const tcp=createConnection({host:'127.0.0.1',port:5900});desktop=tcp;
   tcp.on('data',chunk=>{if(current!==socket||current.readyState!==1||current.bufferedAmount>4*1024*1024){tcp.destroy();return;}current.send(chunk);});
   tcp.on('error',()=>{void status('Local desktop stream error');});tcp.on('close',()=>{if(desktop===tcp){desktop=null;if(current===socket&&current.readyState===1)current.send(JSON.stringify({type:'ended'}));}});
  }catch{failure='invalid relay message';current.close();}
 };
 current.onerror=()=>{failure='WebSocket transport error';};current.onclose=event=>finish(event.code);
}
if(!config.id){
 // The elevated installer leaves a code for the owner. It contains no secrets.
 const pair=await post('/pair/start',{credential:config.credential,name:config.name,mode:'vnc'});
 await writeFile(join(directory,'pairing.txt'),pair.code.match(/.{1,4}/g).join('-'));
 for(let i=0;i<100;i++){await new Promise(resolve=>setTimeout(resolve,3000));const result=await post('/pair/poll',{poll:pair.poll});if(result.deviceId){config.id=result.deviceId;await writeFile(configPath,await encode(JSON.stringify(config)));await writeFile(join(directory,'pairing.txt'),'Paired');break;}}
 if(!config.id){await status('Pairing expired; start the bridge task again');process.exit(1);}
}
connect();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopped=true;clearTimeout(timer);clearInterval(watchdog);closeDesktop();socket?.close();process.exit(0);});
