import net from 'node:net';
import {randomBytes,createHash} from 'node:crypto';
import {WebSocketServer} from 'ws';
import express from 'express';
import {hasNyxCloudAccess} from './nyxcloud-access.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
export function createNyxCloudDesktop({firebase,port=Number(process.env.NYXCLOUD_VNC_PORT||0),password=process.env.NYXCLOUD_VNC_PASSWORD||'',now=Date.now,recheckMs=60000}){
  const router=express.Router(),pages=new Map(),tickets=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024,perMessageDeflate:false});
  const configured=Number.isInteger(port)&&port>0&&port<65536&&password.length>=8;
  const verify=async token=>{if(!token)throw Error();const user=await(await firebase()).auth.verifyIdToken(token,true);if(!hasNyxCloudAccess(user))throw Error();return user;};
  const sameOrigin=req=>{try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}};
  const prune=map=>{for(const [id,value]of map)if(value.expires<=now())map.delete(id);};
  const ticket=(map,token,lifetime)=>{prune(map);if(map.size>=30)throw Error();const id=randomBytes(32).toString('base64url');map.set(hash(id),{token,expires:now()+lifetime});return id;};
  const cookie=req=>{const id=String(req.headers.cookie||'').match(/(?:^|;\s*)__Host-nyxcloud=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];return id&&pages.get(hash(id));};
  const reachable=()=>new Promise(resolve=>{
    if(!configured)return resolve(false);
    const socket=net.connect({host:'127.0.0.1',port});let finished=false;
    const done=ok=>{if(finished)return;finished=true;socket.destroy();resolve(ok);};
    socket.setTimeout(1500,()=>done(false));socket.once('error',()=>done(false));
    socket.once('data',data=>done(data.toString('ascii').startsWith('RFB ')));
  });
  router.use(express.json({limit:'2kb'}));
  router.use(async(req,res,next)=>{
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    try{
      const token=String(req.get('authorization')||'').match(/^Bearer (.{1,8192})$/)?.[1];await verify(token);
      if(req.method!=='GET'&&!sameOrigin(req))throw Error();req.cloudToken=token;next();
    }catch{res.status(404).json({error:'Not available.'});}
  });
  router.get('/access',async(_req,res)=>res.json({allowed:true,available:configured,online:await reachable(),status:configured?'connected':'reserved'}));
  router.post('/session',(req,res)=>{try{const value=ticket(pages,req.cloudToken,600000);res.set('Set-Cookie',`__Host-nyxcloud=${value}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Strict`).json({allowed:true});}catch{res.status(429).end();}});
  router.post('/connect',async(req,res)=>{
    if(!await reachable())return res.status(503).json({error:'NyxCloud is offline. Start the VM on your Windows PC.'});
    try{res.json({ticket:ticket(tickets,req.cloudToken,30000)});}catch{res.status(429).end();}
  });
  router.use((_req,res)=>res.status(404).json({error:'Not available.'}));
  async function pageAccess(req,res,next){
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    try{const session=cookie(req);if(!session||session.expires<=now())throw Error();await verify(session.token);next();}
    catch{res.status(404).end();}
  }
  function upgrade(req,socket,head){
    const session=cookie(req);
    if(!configured||!sameOrigin(req)||!session||session.expires<=now()||wss.clients.size>=4){socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>{
      let tcp,authorized=false,alive=true,rechecking=false;
      const timeout=setTimeout(()=>ws.close(4003,'Authorization required'),5000);
      const heartbeat=setInterval(()=>{if(!alive)return ws.terminate();alive=false;ws.ping();},20000);
      const recheck=setInterval(async()=>{if(!authorized||rechecking)return;rechecking=true;try{await verify(session.token);}catch{ws.close(4003,'Session expired');}finally{rechecking=false;}},recheckMs);
      ws.on('pong',()=>{alive=true;});ws.on('error',()=>{});
      ws.once('close',()=>{clearTimeout(timeout);clearInterval(heartbeat);clearInterval(recheck);tcp?.destroy();});
      ws.once('message',async(data,binary)=>{
        try{
          if(binary)throw Error();const value=JSON.parse(data.toString());const entry=tickets.get(hash(String(value.ticket||'')));
          tickets.delete(hash(String(value.ticket||'')));
          if(!entry||entry.expires<=now()||entry.token!==session.token)throw Error();await verify(entry.token);
          if(ws.readyState!==1)return;authorized=true;clearTimeout(timeout);
          tcp=net.connect({host:'127.0.0.1',port});tcp.setNoDelay(true);
          tcp.once('connect',()=>ws.send(JSON.stringify({ready:true,password})));
          tcp.on('data',chunk=>{if(ws.readyState!==1)return;if(ws.bufferedAmount>8*1024*1024)return ws.close(4010,'Connection too slow');ws.send(chunk,{binary:true},error=>{if(error)tcp.destroy();});});
          tcp.on('error',()=>ws.close(4011,'VM offline'));tcp.on('close',()=>ws.close(4011,'VM disconnected'));
          ws.on('message',(chunk,isBinary)=>{if(!isBinary||tcp.writableLength>1024*1024)return ws.close(4003,'Invalid stream');tcp.write(chunk);});
        }catch{ws.close(4003,'Not available');}
      });
    });
  }
  return {router,pageAccess,upgrade,close(){for(const ws of wss.clients)ws.terminate();wss.close();}};
}
