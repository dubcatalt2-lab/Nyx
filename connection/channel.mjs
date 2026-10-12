import {WebSocket} from 'ws';
import {pack, unpack, limits} from './frames.mjs';

export function channel(socket, resolveDestination, headersFor,prepare=async()=>null) {
  let upstream, started=false, ready=false;
  const timer=setTimeout(()=>socket.terminate(),15000);
  const stop=()=>{
    clearTimeout(timer);
    if(upstream&&upstream.readyState!==WebSocket.CLOSED)upstream.terminate();
  };
  socket.once('close',stop);
  socket.on('error',stop);
  socket.on('message',async(bytes,binary)=>{
    if(started){
      if(!ready||upstream.readyState!==WebSocket.OPEN){socket.close(1008,'Connection is not ready');return;}
      if(upstream.bufferedAmount>limits.upload){socket.close(1009,'Sending limit');return;}
      upstream.send(bytes,{binary},error=>{if(error)socket.terminate();});
      return;
    }
    started=true;
    let id;
    try{
      if(!binary)throw new Error('Expected binary request');
      const request=unpack(bytes);
      id=request.id;
      const metadata=request.metadata;
      if(request.type!==0||request.body.length||metadata.method!=='GET'||Object.keys(metadata).sort().join(',')!=='headers,method,url')throw new Error('Invalid request');
      const destination=new URL(metadata.url);
      if(!['ws:','wss:'].includes(destination.protocol))throw new Error('Unsupported destination');
      destination.protocol=destination.protocol==='wss:'?'https:':'http:';
      const resolved=await resolveDestination(destination.href);
      if(socket.readyState!==WebSocket.OPEN)return;
      const target=new URL(resolved.url);
      target.protocol=target.protocol==='https:'?'wss:':'ws:';
      const policy=await prepare(metadata);
      const headers=Object.fromEntries(headersFor(policy?.headers||metadata.headers));
      const protocols=metadata.headers.filter(([name])=>name.toLowerCase()==='sec-websocket-protocol').flatMap(([,value])=>value.split(',').map(item=>item.trim()));
      const addresses=resolved.addresses||[resolved.address];
      upstream=new WebSocket(target,protocols,{
        headers,perMessageDeflate:false,maxPayload:limits.upload,handshakeTimeout:10000,
        lookup:(_host,options,callback)=>options?.all?callback(null,addresses):callback(null,resolved.address.address,resolved.address.family)
      });
      if(policy)upstream.once('upgrade',response=>void policy.receive({headers:{getSetCookie:()=>response.headers['set-cookie']||[]}}).catch(()=>socket.terminate()));
      upstream.once('open',()=>{
        clearTimeout(timer);
        if(socket.readyState!==WebSocket.OPEN){stop();return;}
        socket.send(pack(id,0,{status:101,headers:upstream.protocol?[['sec-websocket-protocol',upstream.protocol]]:[]}),{binary:true});
        ready=true;
      });
      upstream.on('message',(data,isBinary)=>{
        if(socket.readyState!==WebSocket.OPEN)return;
        if(socket.bufferedAmount>limits.upload){socket.close(1009,'Receiving limit');return;}
        socket.send(data,{binary:isBinary},error=>{if(error)socket.terminate();});
      });
      upstream.on('error',()=>{
        if(socket.readyState!==WebSocket.OPEN)return;
        if(!ready)socket.send(pack(id,1,{status:502,headers:[]}));
        socket.close(1011,'Destination connection failed');
      });
      upstream.once('close',(code,reason)=>{
        if(socket.readyState===WebSocket.OPEN)socket.close([1005,1006,1015].includes(code)?1011:code,reason);
      });
    }catch{
      if(id&&socket.readyState===WebSocket.OPEN)socket.send(pack(id,1,{status:502,headers:[]}));
      socket.close(1008,'Invalid connection request');
    }
  });
}
