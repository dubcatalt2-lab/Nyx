import express from 'express';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

// Local frontend, production services. Secrets remain on the VPS.
const port=Number(process.env.PREVIEW_PORT || 9091);
const tunnelPort=Number(process.env.PREVIEW_TUNNEL_PORT || 19080);
const upstreamHost='tutsi.nyxlearning.org';
const tunnel=spawn('ssh',['-N','-T','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=20','-o','ServerAliveCountMax=3','-L',`127.0.0.1:${tunnelPort}:127.0.0.1:8080`,process.env.PREVIEW_SSH_HOST || 'ubuntu@15.204.93.166'],{stdio:['ignore','ignore','pipe'],windowsHide:true});
const app=express();
// Do not accept LAN traffic or other sites' requests to this localhost bridge.
app.use((req,res,next)=>{
 if(!['localhost','127.0.0.1'].includes(req.hostname)) return res.sendStatus(403);
 const sandboxGameAsset=req.headers.origin==='null'&&['GET','HEAD','OPTIONS'].includes(req.method)&&/^\/(?:gn-math-(?:fetch|asset|proxy)|gms-games-(?:fetch|proxy)|assets\/games\/(?:game-health|game-ad-protection|game-runtime-compat)\.js)$/.test(req.path);
 if(req.headers.origin && !sandboxGameAsset && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin)) return res.sendStatus(403);
 next();
});
const root=resolve(process.env.PREVIEW_STATIC_ROOT || 'dist');
app.get(['/tutsi','/tutsi/'],(req,res)=>res.sendFile(resolve(root,'apps/tutsi/index.html'),{dotfiles:'allow'}));
app.use(express.static(root,{dotfiles:'allow',setHeaders:res=>res.setHeader('Cache-Control','no-store')}));
function headers(req){
 const result={...req.headers,host:upstreamHost};
 // The tunnel terminates at the existing app, behind its normal public HTTPS host.
 result['x-forwarded-proto']='https';
 if(result.origin && result.origin!=='null') result.origin=`https://${upstreamHost}`;
 if(result.referer) result.referer=`https://${upstreamHost}/`;
 delete result['x-forwarded-for'];
 return result;
}
app.use((req,res)=>{
 const upstream=http.request({hostname:'127.0.0.1',port:tunnelPort,path:req.originalUrl,method:req.method,headers:headers(req)},reply=>{
  const outgoing={...reply.headers};
  if(outgoing.location?.startsWith(`https://${upstreamHost}/`)) outgoing.location=outgoing.location.slice(`https://${upstreamHost}`.length);
  res.writeHead(reply.statusCode,outgoing);reply.pipe(res);
 });
 upstream.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'VPS connection unavailable. Restart the local preview.'});else res.destroy();});
 res.on('close',()=>upstream.destroy());req.pipe(upstream);
});
const server=http.createServer(app);
server.on('upgrade',(req,socket,head)=>{
 if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host) || (req.headers.origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin))){socket.destroy();return;}
 const upstream=net.connect(tunnelPort,'127.0.0.1',()=>{
  upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n`+Object.entries(headers(req)).map(([k,v])=>`${k}: ${v}\r\n`).join('')+'\r\n');
  if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
 });
 upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());upstream.on('close',()=>socket.destroy());
});
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;tunnel.kill();server.close();setTimeout(()=>process.exit(code),100).unref();}
tunnel.on('error',()=>{console.error('Unable to start SSH. Check your SSH setup.');stop(1);});
tunnel.on('exit',code=>{if(!stopping){console.error(`VPS tunnel closed (${code}).`);stop(1);}});
tunnel.stderr.on('data',()=>{});
server.on('error',error=>{console.error(`Preview could not start: ${error.code}`);stop(1);});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
server.listen(port,'127.0.0.1',()=>console.log(`Local preview: http://localhost:${port}/tutsi — uses live VPS services and real account data.`));
