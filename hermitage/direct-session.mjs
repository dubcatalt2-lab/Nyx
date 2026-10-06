import express from 'express';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {hostname} from 'node:os';
import {readFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline';
import {createRemoteDesktop,remoteOwnerUid} from '../scripture/remote-desktop.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const accountOrigin='https://fmsrobotics.robot-agachado.com';
async function verifyOwner(token){
 let response;
 try{response=await fetch(accountOrigin+'/api/private-remote/access',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});}catch{throw Object.assign(Error('Account verification unavailable'),{code:'auth/network-request-failed'});}
 if(response.status>=500)throw Object.assign(Error('Account verification unavailable'),{code:'auth/network-request-failed'});
 if(!response.ok||(await response.json()).enabled!==true)throw Error('Access denied');
 return {uid:remoteOwnerUid};
}
export async function createDirectSession({verify=verifyOwner,authConfig,port=0,computer=hostname()}={}){
 const records=new Map();
 const collection={doc:id=>({get:async()=>({data:()=>records.get(id)}),set:async data=>records.set(id,data),delete:async()=>records.delete(id)}),where:()=>({get:async()=>({size:records.size,docs:[...records].map(([id,data])=>({id,data:()=>data}))})})};
 const remote=createRemoteDesktop({firebase:async()=>({auth:{verifyIdToken:verify},firestore:{collection:()=>collection}}),download:async()=>{throw Error('Unavailable')},report:()=>{}});
 let desktopReady=false;
 const app=express();app.disable('x-powered-by');
 app.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});next();});
 app.get('/healthz',(_req,res)=>res.json({ok:true,service:'nyx-direct-desktop',desktopReady}));
 app.get('/api/founder-profile/auth-config',async(_req,res)=>{
  try{if(authConfig)return res.json(authConfig);const response=await fetch(accountOrigin+'/api/founder-profile/auth-config',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();res.json(await response.json());}catch{res.status(503).json({error:'Account service unavailable.'});}
 });
 // This session exposes only this local desktop, never a pairing/admin API.
 app.use('/api/private-remote',(req,res,next)=>{
  if(!['/access','/session','/devices','/connect'].includes(req.path))return res.status(404).end();next();
 },remote.router);
 app.use('/apps/remote',remote.pageAccess);
 app.get('/apps/remote/index.html',async(_req,res)=>{
  let html=await readFile(join(root,'apps/remote/index.html'),'utf8');
  html=html.replace('<html lang="en">','<html lang="en" data-direct-desktop>')
   .replace('id="setup"','id="setup" style="grid-template-columns:1fr"')
   .replace('<section class="panel"><h2>Add this computer','<section class="panel" hidden><h2>Add this computer')
   .replaceAll('Back to Nyx','Account').replaceAll('Return to Nyx','Sign in');
  res.type('html').send(html);
 });
 app.use('/apps/remote',express.static(join(root,'apps/remote'),{index:false}));
 app.get('/apps/agents/fonts/Quicksand-Variable.ttf',(_req,res)=>res.sendFile(join(root,'apps/agents/fonts/Quicksand-Variable.ttf'),{dotfiles:'allow'}));
 app.get('/',(_req,res)=>res.sendFile(join(root,'apps/remote-entry/index.html'),{dotfiles:'allow'}));
 for(const file of ['entry.js','entry.css'])app.get('/'+file,(_req,res)=>res.sendFile(join(root,'apps/remote-entry',file),{dotfiles:'allow'}));
 const server=createServer(app);
 server.on('upgrade',(req,socket,head)=>{if(req.url==='/api/private-remote/socket')remote.upgrade(req,socket,head);else socket.destroy();});
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});
 const id=randomBytes(16).toString('hex'),credential=randomBytes(32).toString('base64url');
 records.set(id,{uid:remoteOwnerUid,hash:createHash('sha256').update(credential).digest('hex'),name:computer+' (direct session)',mode:'jpeg',created:Date.now()});
 const origin='http://127.0.0.1:'+server.address().port;
 let socket,stopping=false,retry,worker,lines;
 const command=value=>{if(worker&&!worker.stdin.destroyed)worker.stdin.write(JSON.stringify(value)+'\n');};
 function connect(){
  if(stopping)return;socket=new WebSocket(origin.replace('http:','ws:')+'/api/private-remote/socket');
  socket.onopen=()=>socket.send(JSON.stringify({type:'host',id,credential}));
  socket.onmessage=event=>{try{const value=JSON.parse(event.data);if(value.type!=='ready')command(value);}catch{socket.close();}};
  socket.onerror=()=>{};socket.onclose=()=>{command({type:'control',active:false});if(!stopping)retry=setTimeout(connect,1000);};
 }
 function startDesktop(){
  worker=spawn('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',join(root,'hermitage/desktop.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  lines=createInterface({input:worker.stdout});
  lines.on('line',line=>{
   if(line==='READY'){desktopReady=true;console.log('Direct desktop ready. Waiting for owner sign-in.');connect();return;}
   if(line==='STOP'){socket?.close();return;}
   if(socket?.readyState!==1)return;
   if(line.startsWith('FRAME:')&&socket.bufferedAmount<256000)socket.send(Buffer.from(line.slice(6),'base64'));
   if(line.startsWith('STATUS:'))socket.send(JSON.stringify({type:'status',message:line.slice(7)}));
  });
  worker.stderr.on('data',()=>console.error('Desktop helper error. Restart the direct session.'));
  worker.on('error',()=>void close());worker.on('exit',()=>void close());
 }
 async function close(){if(stopping)return;stopping=true;clearTimeout(retry);command({type:'control',active:false});worker?.stdin.end();socket?.close();remote.close();server.closeAllConnections();await new Promise(r=>server.close(r));lines?.close();worker?.kill();}
 return {origin,startDesktop,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.platform!=='win32')throw Error('This helper requires Windows.');
 const session=await createDirectSession({port:8766});session.startDesktop();
 console.log('Direct session listening on loopback only. Windows must remain signed in and unlocked.');
 process.on('SIGINT',()=>void session.close());process.on('SIGTERM',()=>void session.close());
}
