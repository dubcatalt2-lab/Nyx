import {createServer,request} from 'node:http';
import {connect} from 'node:net';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Separate ngrok entry point. Authentication and all desktop authorization stay
// in the existing relay; no desktop credential or Firebase admin key lives here.
export function createRemoteEntry({upstreamPort=8080,root=resolve('apps/remote-entry')}={}){
 const entry=new Map([['/',['index.html','text/html']],['/entry.js',['entry.js','text/javascript']],['/entry.css',['entry.css','text/css']]]);
 const allowed=path=>path==='/healthz'||path==='/api/founder-profile/auth-config'||/^\/api\/private-remote\/(?:access|session|renew|devices|connect|host\.zip|pair\/(?:start|poll|approve)|devices\/[a-f0-9]{32}(?:\/code)?)$/.test(path)||/^\/apps\/remote\/(?:index\.html|app\.js|desktop-controls\.js|style\.css)?$/.test(path)||/^\/assets\/vendor\/novnc\/[a-zA-Z0-9_/-]+\.js$/.test(path)||path==='/apps/agents/fonts/Quicksand-Variable.ttf';
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const path=(req.url||'').split('?')[0];
  if(entry.has(path)&&['GET','HEAD'].includes(req.method)){
   const [file,type]=entry.get(path);try{const body=await readFile(resolve(root,file));res.setHeader('Content-Type',type+'; charset=utf-8');res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(503).end('Unavailable');}return;
  }
  if(!allowed(path)&&!/^\/apps\/remote\/@r[a-f0-9]{24}!\.js$/.test(path)){res.writeHead(404).end('Not found');return;}
  const proxy=request({host:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
  proxy.setTimeout(15000,()=>proxy.destroy());proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Remote service unavailable');});
  req.on('aborted',()=>proxy.destroy());res.on('close',()=>proxy.destroy());req.pipe(proxy);
 });
 server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/api/private-remote/socket'){socket.destroy();return;}
  const upstream=connect({host:'127.0.0.1',port:upstreamPort});
  upstream.once('connect',()=>{upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`+req.rawHeaders.reduce((text,value,i)=>text+(i%2?value+'\r\n':value+': '),'')+'\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});
  socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.on('close',()=>upstream.destroy());upstream.on('close',()=>socket.destroy());
 });
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 createRemoteEntry({root:process.env.NYX_REMOTE_ENTRY_ROOT||resolve('apps/remote-entry')}).listen(Number(process.env.PORT||8081),'127.0.0.1');
}
