import express from 'express';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {fullCatalogUid} from './ai-owner-catalog.mjs';
import {desktopFlow,transientDesktopAuth,desktopAuthClose} from './desktop-flow.mjs';

export const remoteOwnerUid=fullCatalogUid;
const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const idOK=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function remoteInput(value){
  if(!value||typeof value!=='object')return null;
  if(value.type==='release')return {type:'release'};
  if(value.type==='pointer'&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&value.x>=0&&value.x<=1&&value.y>=0&&value.y<=1&&['move','down','up'].includes(value.action)&&[0,1,2].includes(value.button??0))return {type:'pointer',x:value.x,y:value.y,action:value.action,button:value.button??0};
  if(value.type==='wheel'&&Number.isFinite(value.delta))return {type:'wheel',delta:Math.max(-3,Math.min(3,Math.round(value.delta)))};
  if(value.type==='key'&&Number.isInteger(value.key)&&value.key>=8&&value.key<=222&&['down','up'].includes(value.action))return {type:'key',key:value.key,action:value.action};
  return null;
}

// All durable records are server-only. No Firebase client rules grant access.
export function createRemoteDesktop({firebase,download,now=Date.now,heartbeatInterval=15000,heartbeatTimeout=60000,recheckMs=60000,report=entry=>console.info('Remote session '+JSON.stringify(entry))}){
  const pending=new Map(),tickets=new Map(),hosts=new Map(),viewers=new Map(),attempts=new Map(),pageSessions=new Map(),leases=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:2*1024*1024,perMessageDeflate:false});
  const router=express.Router();
  router.use(express.json({limit:'8kb'}));
  router.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});next();});
  const store=async()=> (await firebase()).firestore.collection('nyxPrivateRemoteDevices');
  const send=(ws,data)=>{if(ws?.readyState===1)ws.send(JSON.stringify(data));};
  const detach=(id,code=1000,reason='Disconnected')=>{const viewer=viewers.get(id);viewers.delete(id);viewer?.close(code,reason);send(hosts.get(id),{type:'control',active:false});};
  const auth=async(req,res,next)=>{
    try{const token=String(req.get('authorization')||'').match(/^Bearer (.{1,8192})$/)?.[1];
      if(!token)throw Error();
      const user=await (await firebase()).auth.verifyIdToken(token,true);
      if(user.uid!==remoteOwnerUid)throw Error();
      req.remoteToken=token;next();
    }catch(error){const transient=transientDesktopAuth(error);res.status(transient?503:error?.code==='auth/id-token-expired'?401:404).json({error:transient?'Account verification temporarily unavailable.':'Not available.'});}
  };
  // Pairing is the only unauthenticated HTTP operation. The random host secret
  // cannot authorize access until the exact Firebase owner approves its code.
  router.post('/pair/start',(req,res)=>{
    const key=req.ip,old=attempts.get(key),state=old&&old.until>now()?old:{count:0,until:now()+60000};
    if(!old&&attempts.size>=2000)return res.status(429).end();
    attempts.set(key,state);
    if(++state.count>5||pending.size>=20)return res.status(429).json({error:'Try pairing again later.'});
    const credential=String(req.body?.credential||'');
    if(!/^[A-Za-z0-9_-]{43}$/.test(credential))return res.status(400).end();
    const code=randomBytes(6).toString('hex').toUpperCase(),poll=secret();
    pending.set(hash(poll),{code,hash:hash(credential),mode:req.body?.mode==='vnc'?'vnc':'jpeg',name:String(req.body?.name||'Windows PC').slice(0,64),expires:now()+300000,deviceId:null});
    res.json({code,poll,expiresIn:300});
  });
  router.post('/pair/poll',(req,res)=>{
    const key=hash(String(req.body?.poll||'')),pair=pending.get(key);
    if(!pair||pair.expires<now())return res.status(404).end();
    if(!pair.deviceId)return res.json({waiting:true});
    pending.delete(key);res.json({deviceId:pair.deviceId});
  });
  router.use(auth);
  router.post('/session',(req,res)=>{
    if(pageSessions.size>=50)return res.status(429).end();
    const value=secret();pageSessions.set(hash(value),{token:req.remoteToken,expires:now()+600000});
    res.set('Set-Cookie','__Host-nyx-remote='+value+'; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Strict').json({enabled:true});
  });
  router.get('/access',(_req,res)=>res.json({enabled:true}));
  router.post('/renew',(req,res)=>{
    const lease=leases.get(String(req.body?.session||''));if(!lease)return res.status(409).json({error:'Session ended. Reconnect to continue.'});
    lease.token=req.remoteToken;lease.expires=now()+600000;
    const value=String(req.headers.cookie||'').match(/(?:^|;\s*)__Host-nyx-remote=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1],page=value&&pageSessions.get(hash(value));
    if(page){page.token=req.remoteToken;page.expires=lease.expires;res.set('Set-Cookie','__Host-nyx-remote='+value+'; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Strict');}
    res.json({renewed:true});
  });
  router.get('/host.zip',async(_req,res)=>{
    try{res.type('application/zip').set('Content-Disposition','attachment; filename="Nyx-Remote.zip"').send(await download());}
    catch{res.status(503).json({error:'Host download unavailable.'});}
  });
  router.post('/pair/approve',async(req,res)=>{
    const pair=[...pending.values()].find(item=>item.code===String(req.body?.code||'').replace(/[^a-z0-9]/gi,'').toUpperCase()&&item.expires>now()&&!item.deviceId);
    if(!pair||pair.approving)return res.status(400).json({error:'Pairing code expired or invalid.'});
    if(pair.existingId){
      try{if((await (await store()).doc(pair.existingId).get()).data()?.uid!==remoteOwnerUid)return res.status(400).json({error:'Computer was removed.'});
        if(pair.used)return res.status(400).json({error:'Code already used.'});pair.used=true;
        pair.deviceId=pair.existingId;return res.json({paired:true});
      }catch{return res.status(503).json({error:'Unable to verify computer.'});}
    }
    pair.approving=true;
    try{const collection=await store();if((await collection.where('uid','==',remoteOwnerUid).get()).size>=10)throw Error('Remove an old device first.');
      const deviceId=randomBytes(16).toString('hex');
      await collection.doc(deviceId).set({uid:remoteOwnerUid,hash:pair.hash,name:pair.name,mode:pair.mode,created:now()});
      pair.deviceId=deviceId;res.json({paired:true});
    }catch{res.status(503).json({error:'Unable to pair. Remove an old device or try again.'});}finally{pair.approving=false;}
  });
  router.get('/devices',async(_req,res)=>{
    try{const snap=await (await store()).where('uid','==',remoteOwnerUid).get();res.json({devices:snap.docs.map(doc=>({id:doc.id,name:doc.data().name,mode:doc.data().mode||'jpeg',online:hosts.has(doc.id),connected:viewers.has(doc.id)}))});}
    catch{res.status(503).json({error:'Devices unavailable.'});}
  });
  router.delete('/devices/:id',async(req,res)=>{
    if(!idOK(req.params.id))return res.status(404).end();
    try{const ref=(await store()).doc(req.params.id);if((await ref.get()).data()?.uid!==remoteOwnerUid)return res.status(404).end();
      await ref.delete();detach(req.params.id,4003,'Device removed');hosts.get(req.params.id)?.close(4003,'Device removed');hosts.delete(req.params.id);res.json({removed:true});
    }catch{res.status(503).json({error:'Unable to remove device.'});}
  });
  // Codes for existing computers remain scoped to the same exact owner.
  router.post('/devices/:id/code',async(req,res)=>{
    if(!idOK(req.params.id))return res.status(404).end();
    try{const record=(await (await store()).doc(req.params.id).get()).data();
      if(record?.uid!==remoteOwnerUid)return res.status(404).end();
      for(const [key,item]of pending)if(item.existingId===req.params.id)pending.delete(key);
      if(pending.size>=20)return res.status(429).json({error:'Try again later.'});
      const code=randomBytes(6).toString('hex').toUpperCase();
      pending.set(hash(secret()),{code,existingId:req.params.id,expires:now()+300000});
      res.json({code,expiresIn:300});
    }catch{res.status(503).json({error:'Unable to generate code.'});}
  });
  router.post('/connect',async(req,res)=>{
    const id=req.body?.id;if(!idOK(id)||!hosts.has(id))return res.status(409).json({error:'Computer is offline.'});
    if(tickets.size>=20)return res.status(429).end();
    const ticket=secret();tickets.set(hash(ticket),{id,token:req.remoteToken,expires:now()+30000});res.json({ticket});
  });
  wss.on('connection',ws=>{
    let identity=null,authenticating=false,events=0,windowStart=now(),flow,flowTarget,flowClosed,rechecking=false,lastVerified=now();const openedAt=now();let receivedBytes=0;
    const clearFlow=()=>{if(flowClosed)flowTarget?.off('close',flowClosed);flow?.close();flow=null;flowTarget=null;flowClosed=null;};
    const deadline=setTimeout(()=>ws.close(4001,'Authentication required'),5000);
    // Revalidate permission without interrupting a healthy desktop every 30 minutes.
    const authorization=setInterval(async()=>{
      if(!identity||rechecking||ws.readyState!==1)return;rechecking=true;
      try{
        if(identity.kind==='host'){
          let record;try{record=(await (await store()).doc(identity.id).get()).data();}
          catch{if(now()-lastVerified<120000)return;ws.transportFailure='device-verification-unavailable';ws.close(1013,'Device verification temporarily unavailable');return;}
          if(record?.uid!==remoteOwnerUid||!equal(record.hash,identity.hash))throw Error('Device revoked');
        }else{
          const lease=leases.get(identity.session);
          if(!lease||lease.expires<=now()){ws.close(4001,'Renew authorization');return;}
          if((await(await firebase()).auth.verifyIdToken(lease.token,true)).uid!==remoteOwnerUid)throw Error('Access revoked');
        }
        lastVerified=now();
      }catch(error){if(transientDesktopAuth(error)&&now()-lastVerified<120000)return;ws.transportFailure='authorization-check';ws.close(desktopAuthClose(error),'Authorization check failed');}
      finally{rechecking=false;}
    },recheckMs);authorization.unref();
    ws.lastActivity=now();ws.lastPong=now();ws.on('pong',()=>{ws.lastActivity=now();ws.lastPong=now();});ws.on('error',()=>{ws.transportFailure='socket-error';});
    ws.on('message',async(data,binary)=>{
      try{
        receivedBytes+=data.length;ws.lastActivity=now();
        if(!identity){
          if(authenticating||binary||data.length>10000)return ws.close(4001,'Unauthorized');
          authenticating=true;const first=JSON.parse(data.toString());
          if(first.type==='host'&&idOK(first.id)&&/^[A-Za-z0-9_-]{43}$/.test(first.credential||'')){
            let record;
            try{record=(await (await store()).doc(first.id).get()).data();}catch{ws.close(1013,'Device verification temporarily unavailable');return;}
            if(record?.uid!==remoteOwnerUid||!equal(record.hash,hash(first.credential)))throw Error();
            if(ws.readyState!==1)return;
            if(hosts.has(first.id)){ws.close(4009,'Bridge already connected');return;}
            identity={kind:'host',id:first.id,hash:record.hash,mode:record.mode||'jpeg'};ws.remoteMode=identity.mode;hosts.set(first.id,ws);send(ws,{type:'ready'});
          }else if(first.type==='viewer'){
            const key=hash(String(first.ticket||'')),ticket=tickets.get(key);tickets.delete(key);
            if(!ticket||ticket.expires<now())throw Error();
            if(!hosts.has(ticket.id)){ws.close(4012,'Windows bridge disconnected');return;}
            if(viewers.has(ticket.id)){ws.close(4009,'Computer already in use');return;}
            identity={kind:'viewer',id:ticket.id,mode:hosts.get(ticket.id).remoteMode,session:secret()};leases.set(identity.session,{token:ticket.token,expires:now()+600000});viewers.set(ticket.id,ws);send(ws,{type:'ready',mode:identity.mode,session:identity.session});send(hosts.get(ticket.id),{type:'control',active:true});
          }else throw Error();
          clearTimeout(deadline);return;
        }
        if(now()-windowStart>=1000){windowStart=now();events=0;}
        if(++events>(identity.mode==='vnc'?1000:identity.kind==='host'?10:150))return ws.close(4008,'Rate exceeded');
        if(!binary&&data.length<128&&JSON.parse(data).type==='heartbeat'){send(ws,{type:'heartbeat'});return;}
        if(identity.mode==='vnc'){
          const target=identity.kind==='host'?viewers.get(identity.id):hosts.get(identity.id);
          if(binary){if(target?.readyState===1){
            if(flowTarget!==target){clearFlow();flowTarget=target;flow=desktopFlow(ws,(chunk,done)=>target.send(chunk,{binary:true},done),reason=>{ws.transportFailure=reason;detach(identity.id,4010,reason);});flowClosed=()=>{if(flowTarget===target)clearFlow();};target.once('close',flowClosed);}
            flow.write(data);
          }return;}
          if(data.length>1024)throw Error();const value=JSON.parse(data);
          if(identity.kind==='host'&&value.type==='vnc'&&/^[A-Za-z0-9]{8}$/.test(value.password||''))send(target,{type:'vnc',password:value.password});
          else if(identity.kind==='host'&&value.type==='ended')detach(identity.id,4011,'Windows desktop stream ended');
          else if(identity.kind==='viewer'&&value.type==='release'){} // RFB handles key release itself.
          else throw Error();
          return;
        }
        if(identity.kind==='host'){
          if(binary){const viewer=viewers.get(identity.id);if(data.length>0&&viewer?.readyState===1&&viewer.bufferedAmount<256000)viewer.send(data,{binary:true});}
          else if(data.length<1024){const status=JSON.parse(data);if(status.type==='status')send(viewers.get(identity.id),{type:'status',message:String(status.message||'').slice(0,200)});}
        }else{
          if(binary||data.length>1024)throw Error();
          const input=remoteInput(JSON.parse(data));if(!input)throw Error();send(hosts.get(identity.id),input);
        }
      }catch{ws.close(4003,'Unauthorized or invalid request');}
    });
    ws.on('close',(code)=>{
      if(identity)report({kind:identity.kind,mode:identity.mode,code,seconds:Math.round((now()-openedAt)/1000),receivedKiB:Math.round(receivedBytes/1024),cause:ws.transportFailure||'peer-close',idleSeconds:Math.round((now()-ws.lastActivity)/1000),pongAgeSeconds:Math.round((now()-ws.lastPong)/1000)});
      clearTimeout(deadline);clearInterval(authorization);clearFlow();if(identity?.session)leases.delete(identity.session);
      if(identity?.kind==='host'&&hosts.get(identity.id)===ws){hosts.delete(identity.id);detach(identity.id,4012,'Windows bridge disconnected');}
      if(identity?.kind==='viewer'&&viewers.get(identity.id)===ws){viewers.delete(identity.id);send(hosts.get(identity.id),{type:'control',active:false});}
    });
  });
  const timer=setInterval(()=>{
    for(const [key,value]of pageSessions)if(value.expires<now())pageSessions.delete(key);
    for(const [key,value]of pending)if(value.expires<now())pending.delete(key);
    for(const [key,value]of tickets)if(value.expires<now())tickets.delete(key);
    for(const [key,value]of attempts)if(value.until<now())attempts.delete(key);
    for(const ws of wss.clients){if(ws.desktopBackpressured)continue;if(now()-ws.lastActivity>=heartbeatTimeout){ws.transportFailure='heartbeat-timeout';ws.terminate();}else if(ws.readyState===1)ws.ping();}
  },heartbeatInterval);timer.unref();
  const pageAccess=async(req,res,next)=>{
    res.set({'Cache-Control':'private, no-store','Vary':'Cookie'});
    try{const value=String(req.headers.cookie||'').match(/(?:^|;\s*)__Host-nyx-remote=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
      const session=value&&pageSessions.get(hash(value));if(!session||session.expires<now())throw Error();
      const user=await(await firebase()).auth.verifyIdToken(session.token,true);if(user.uid!==remoteOwnerUid)throw Error();next();
    }catch{res.status(404).send('Not found');}
  };
  return {router,pageAccess,upgrade(req,socket,head){
    // Workspace clients must be same-origin. Native host clients omit Origin.
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw Error();}catch{socket.destroy();return;}}
    if(wss.clients.size>=30){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  },close(){clearInterval(timer);for(const ws of wss.clients)ws.terminate();wss.close();}};
}
