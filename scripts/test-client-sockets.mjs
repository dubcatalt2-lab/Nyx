import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {connect} from 'node:net';
import {readFile} from 'node:fs/promises';
import {WebSocketServer,WebSocket} from 'ws';
import {chromium} from 'playwright';
import {patchClientSockets} from './patch-client-sockets.mjs';
const upstream=await readFile('node_modules/@mercuryworkshop/libcurl-transport/dist/index.mjs','utf8');
const built=process.argv.includes('--built');
const aliases=built?JSON.parse(await readFile('dist/proxy-assets.json','utf8')).aliases:null;
const code=built?await readFile('dist'+aliases['/libcurl/index.mjs'],'utf8'):patchClientSockets(upstream);
const headers=await readFile('assets/transports/header-utils.mjs','utf8');
const clients=new Set(),tcp=new Set();
const server=createServer((req,res)=>{
 if(req.url==='/fixture'){res.setHeader('set-cookie',['one=1','two=2']);res.setHeader('content-type','application/json');res.end(JSON.stringify({nested:req.headers['x-fixture']||null}));return;}
 if(req.url==='/transport.mjs'||req.url==='/headers.mjs'){res.setHeader('content-type','text/javascript');res.end(req.url==='/transport.mjs'?code:headers);return;}
 res.setHeader('content-type','text/html');res.end('<!doctype html><title>Socket fixture</title><body></body>');
});
const relay=new WebSocketServer({noServer:true}),echo=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{
 if(req.headers.upgrade==='h2c'&&req.url==='/fixture'){const body=JSON.stringify({nested:req.headers['x-fixture']||null});socket.end('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nSet-Cookie: one=1\r\nSet-Cookie: two=2\r\nContent-Length: '+Buffer.byteLength(body)+'\r\nConnection: close\r\n\r\n'+body);return;}
 if(req.url==='/bridge/')relay.handleUpgrade(req,socket,head,ws=>relay.emit('connection',ws));
 else if(req.url==='/echo')echo.handleUpgrade(req,socket,head,ws=>echo.emit('connection',ws));
 else socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
});
echo.on('connection',ws=>{clients.add(ws);ws.on('message',(data,binary)=>ws.send(data,{binary}));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
// Loopback-only protocol fixture. It can dial this test server and nothing else.
relay.on('connection',ws=>{
 clients.add(ws);const streams=new Map();
 const send=(type,id,data)=>{if(ws.readyState!==WebSocket.OPEN)return;const b=Buffer.alloc(5+data.length);b[0]=type;b.writeUInt32LE(id,1);data.copy(b,5);ws.send(b);};
 const credit=Buffer.alloc(4);credit.writeUInt32LE(128);send(3,0,credit);
 ws.on('message',raw=>{
  const b=Buffer.from(raw),id=b.readUInt32LE(1);
  if(b[0]===1){
   if(b[5]!==1||b.readUInt16LE(6)!==port||b.subarray(8).toString()!=='127.0.0.1'){send(4,id,Buffer.from([0x41]));return;}
   const socket=connect(port,'127.0.0.1');tcp.add(socket);streams.set(id,socket);
   socket.on('data',data=>send(2,id,data));socket.on('error',()=>{});
   socket.on('close',()=>{tcp.delete(socket);streams.delete(id);send(4,id,Buffer.from([2]));});
  }else if(b[0]===2){streams.get(id)?.write(b.subarray(5));send(3,id,credit);}
  else if(b[0]===4)streams.get(id)?.destroy();
 });
 ws.on('close',()=>{for(const socket of streams.values())socket.destroy();});
});
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}/`);
 const result=await page.evaluate(async port=>{
  const {default:Client}=await import('/transport.mjs'),{headerEntries}=await import('/headers.mjs');
  const client=new Client({wisp:`ws://127.0.0.1:${port}/bridge/`});await client.init();
  const frame=document.createElement('iframe');document.body.append(frame);
  const nested=frame.contentDocument.createElement('iframe');frame.contentDocument.body.append(nested);
  const supplied=new nested.contentWindow.Headers({'x-fixture':'nested'});
  const response=await client.request(new URL(`http://127.0.0.1:${port}/fixture`),'GET',null,headerEntries(supplied));
  const content=await new Response(response.body).text();if(!content)throw Error('Empty fixture '+response.status+' '+JSON.stringify(response.headers));const data=JSON.parse(content);
  const messages=await new Promise((resolve,reject)=>{
   const list=[],timer=setTimeout(()=>reject(Error('Echo timeout')),10000);let controls;
   controls=client.connect(new URL(`ws://127.0.0.1:${port}/echo`),[],headerEntries(null),()=>{
    controls[0]('heartbeat');controls[0](new Uint8Array([0,127,255]).buffer);
   },value=>{
    list.push(typeof value==='string'?value:Array.from(new Uint8Array(value)));
    if(list.length===2){clearTimeout(timer);controls[1](1000,'done');resolve(list);}
   },()=>{},error=>{clearTimeout(timer);reject(Error('Echo failed '+error));});
  });
  const rejected=await new Promise((resolve,reject)=>{
   let errors=0;const timer=setTimeout(()=>reject(Error('Rejected handshake stayed pending')),5000);
   client.connect(new URL(`ws://127.0.0.1:${port}/reject`),[],[],()=>reject(Error('Unexpected open')),()=>{},code=>{clearTimeout(timer);resolve({errors,code});},()=>{errors++;});
  });
  return {data,messages,rejected,nullHeaders:headerEntries(null),cookies:response.headers.filter(([key])=>key.toLowerCase()==='set-cookie')};
 },port);
 assert.deepEqual(result.data,{nested:'nested'});assert.deepEqual(result.nullHeaders,[]);assert.equal(result.cookies.length,2);
 assert.deepEqual(result.messages,['heartbeat',[0,127,255]]);assert.deepEqual(result.rejected,{errors:1,code:1006});
 console.log('PASS real browser/WASM client: nested-realm headers, null headers, duplicate cookies, WebSocket text/binary echo, rejected handshake error then close.');
}finally{
 await browser.close();for(const ws of clients)ws.terminate();for(const socket of tcp)socket.destroy();relay.close();echo.close();server.closeAllConnections();await new Promise(r=>server.close(r));
}
