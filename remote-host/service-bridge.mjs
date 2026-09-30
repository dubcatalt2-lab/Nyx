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
let socket,desktop,stopped=false,timer;
const status=message=>writeFile(join(directory,'status.txt'),new Date().toISOString()+' '+message).catch(()=>{});
const closeDesktop=()=>{desktop?.destroy();desktop=null;};
function connect(){
 if(stopped)return;socket=new WebSocket(config.origin.replace('https:','wss:')+'/api/private-remote/socket');socket.binaryType='arraybuffer';
 socket.onopen=()=>{socket.send(JSON.stringify({type:'host',id:config.id,credential:config.credential}));void status('Online; awaiting owner connection');};
 socket.onmessage=event=>{
  if(typeof event.data!=='string'){if(desktop&&!desktop.destroyed){if(desktop.writableLength>4*1024*1024){closeDesktop();socket.send(JSON.stringify({type:'ended'}));}else desktop.write(Buffer.from(event.data));}return;}
  try{const value=JSON.parse(event.data);if(value.type!=='control')return;closeDesktop();
   if(!value.active){void status('Online; owner disconnected');return;}
   void status('Owner connected');
   socket.send(JSON.stringify({type:'vnc',password:config.vncPassword}));
   const tcp=createConnection({host:'127.0.0.1',port:5900});desktop=tcp;
   tcp.on('data',chunk=>{if(socket.readyState!==1||socket.bufferedAmount>4*1024*1024){tcp.destroy();return;}socket.send(chunk);});
   tcp.on('error',()=>{});tcp.on('close',()=>{if(desktop===tcp){desktop=null;if(socket.readyState===1)socket.send(JSON.stringify({type:'ended'}));}});
  }catch{socket.close();}
 };
 socket.onerror=()=>{};socket.onclose=event=>{closeDesktop();if(event.code===4003){stopped=true;void status('Pairing removed; reinstallation required');return;}void status('Offline; reconnecting');if(!stopped)timer=setTimeout(connect,5000);};
}
if(!config.id){
 // The elevated installer leaves a code for the owner. It contains no secrets.
 const pair=await post('/pair/start',{credential:config.credential,name:config.name,mode:'vnc'});
 await writeFile(join(directory,'pairing.txt'),pair.code.match(/.{1,4}/g).join('-'));
 for(let i=0;i<100;i++){await new Promise(resolve=>setTimeout(resolve,3000));const result=await post('/pair/poll',{poll:pair.poll});if(result.deviceId){config.id=result.deviceId;await writeFile(configPath,await encode(JSON.stringify(config)));await writeFile(join(directory,'pairing.txt'),'Paired');break;}}
 if(!config.id){await status('Pairing expired; start the bridge task again');process.exit(1);}
}
connect();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopped=true;clearTimeout(timer);closeDesktop();socket?.close();process.exit(0);});
