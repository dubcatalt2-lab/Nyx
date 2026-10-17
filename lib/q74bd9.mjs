import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';

const qCookie='nyx_q74bd9';
const qKey=value=>createHash('sha256').update(value).digest('hex');
const qFailure=(message,status=400)=>Object.assign(new Error(message),{status});
const qUid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(value);
export function q74bd9({firebase,ownerUid,authorize,sameOrigin,audit=async()=>{},now=Date.now}) {
  let qSecret;
  const qCache=new Map(),qObserved=new Map(),qConnections=new Map();
  const qRemember=(map,key,value)=>{map.delete(key);map.set(key,value);if(map.size>4096)map.delete(map.keys().next().value);};
  async function qDatabase(){const f=await firebase();if(!f?.firestore)throw qFailure('Browser access is temporarily unavailable.',503);return f.firestore;}
  async function qSigning(){
    qSecret ||= qDatabase().then(db=>db.runTransaction(async tx=>{
      const ref=db.collection('nyxBrowserAccess').doc('signing'),snap=await tx.get(ref);
      if(snap.exists)return snap.data().secret;
      const secret=randomBytes(32).toString('hex');tx.set(ref,{secret});return secret;
    })).catch(error=>{qSecret=null;throw error;});
    return qSecret;
  }
  async function qIdentify(req,res){
    if(req.q74bd9)return req.q74bd9;
    const raw=String(req.headers?.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(qCookie+'='))?.slice(qCookie.length+1)||'';
    const match=/^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(raw);
    if(!match&&!res)return '';
    const secret=await qSigning(),sign=id=>createHmac('sha256',secret).update(qCookie+':'+id).digest('hex');
    const valid=match&&timingSafeEqual(Buffer.from(match[2],'hex'),Buffer.from(sign(match[1]),'hex'));
    if(!valid&&!res)return '';
    const id=valid?match[1]:randomBytes(16).toString('hex');
    if(res&&!valid)res.append('Set-Cookie',`${qCookie}=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${(req.secure||req.headers?.['x-forwarded-proto']==='https')?'; Secure':''}`);
    return req.q74bd9=qKey(id);
  }
  function qLabel(req){
    const ua=String(req.headers?.['user-agent']||'');
    const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Browser';
    const os=/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Windows/.test(ua)?'Windows':/Macintosh/.test(ua)?'macOS':/CrOS/.test(ua)?'ChromeOS':/Linux/.test(ua)?'Linux':'unknown system';
    return `${browser} on ${os}`;
  }
  async function observe(req,res,uid,role){
    const key=await qIdentify(req,res),stamp=now(),seenKey=uid+':'+key+':'+role;
    if((qObserved.get(seenKey)||0)>stamp-60000)return;
    const db=await qDatabase(),device=db.collection('nyxBrowserAccess').doc(key),member=db.collection('nyxBrowserMembers').doc(uid).collection('profiles').doc(key);
    await db.runTransaction(async tx=>{
      const snap=await tx.get(device),old=snap.data()||{};
      tx.set(device,{protectedOwner:old.protectedOwner===true||uid===ownerUid()||role==='owner',createdAt:old.createdAt||stamp},{merge:true});
      tx.set(member,{label:qLabel(req),lastSeenAt:stamp},{merge:true});
    });
    qRemember(qObserved,seenKey,stamp);
  }
  async function blocked(req){
    const key=await qIdentify(req);if(!key)return false;
    const saved=qCache.get(key);if(saved&&saved.until>now())return saved.banned;
    try{const db=await qDatabase(),snap=await db.collection('nyxBrowserAccess').doc(key).get();const banned=snap.data()?.banned===true;qRemember(qCache,key,{banned,until:now()+15000});return banned;}
    catch(error){if(saved)return saved.banned;throw error;}
  }
  async function guard(req,res,next){
    try{
      if(!await blocked(req))return next();
      res.set('Cache-Control','no-store');
      if(req.path.startsWith('/api/'))return res.status(403).json({error:'This browser has been blocked from Nyx.',code:'BROWSER_BLOCKED'});
      res.status(403).type('html').send('<!doctype html><meta name="viewport" content="width=device-width"><title>Access blocked</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b101a;color:#eee;font:16px system-ui}main{max-width:420px;padding:24px}</style><main><h1>Access blocked</h1><p>This browser has been blocked from Nyx. Other devices on your network are unaffected.</p></main>');
    }catch{res.status(503).set('Cache-Control','no-store').json({error:'Browser access is temporarily unavailable.'});}
  }
  async function track(req,connection,close=()=>connection.destroy()){
    const key=await qIdentify(req);if(!key)return;
    if(await blocked(req)){close();return;}
    const entries=qConnections.get(key)||new Set(),entry={close};entries.add(entry);qConnections.set(key,entries);
    const remove=()=>{entries.delete(entry);if(!entries.size)qConnections.delete(key);};
    connection.once('close',remove);connection.once('disconnect',remove);
  }
  async function qActor(req){
    const context=await authorize(req);
    if(context.actor?.role!=='owner')throw qFailure('Only the owner can manage browser bans.',403);
    const uid=req.params.uid;
    if(!qUid(uid))throw qFailure('Choose a valid member.');
    if(uid===context.token.uid||uid===ownerUid())throw qFailure('The owner and your own account are protected.',409);
    return context;
  }
  function install(app){
    app.get('/api/chat/q74bd9/:uid',async(req,res)=>{
      res.set('Cache-Control','no-store');
      try{
        await qActor(req);const db=await qDatabase();
        const rows=await db.collection('nyxBrowserMembers').doc(req.params.uid).collection('profiles').orderBy('lastSeenAt','desc').limit(20).get();
        const current=await qIdentify(req);
        const devices=await Promise.all(rows.docs.map(async row=>{
          const snap=await db.collection('nyxBrowserAccess').doc(row.id).get(),record=snap.data()||{};
          return {id:row.id,label:row.data().label,lastSeenAt:row.data().lastSeenAt,banned:record.banned===true,protected:record.protectedOwner===true||row.id===current};
        }));
        res.json({devices});
      }catch(error){res.status(error.status||503).json({error:error.status?error.message:'Browser devices are unavailable.'});}
    });
    app.patch('/api/chat/q74bd9/:uid',async(req,res)=>{
      res.set('Cache-Control','no-store');
      if(!sameOrigin(req))return res.status(403).json({error:'Cross-origin requests are not allowed.'});
      try{
        const context=await qActor(req),{id,action}=req.body||{};
        if(!/^[a-f0-9]{64}$/.test(String(id||''))||!['ban','unban'].includes(action))throw qFailure('Choose a browser and an action.');
        const reason=String(req.body?.reason||'').trim();if(action==='ban'&&(!reason||reason.length>500))throw qFailure('Enter a reason of 1 to 500 characters.');
        if(id===await qIdentify(req))throw qFailure('You cannot block the browser managing Nyx.',409);
        const db=await qDatabase(),device=db.collection('nyxBrowserAccess').doc(id),member=db.collection('nyxBrowserMembers').doc(req.params.uid).collection('profiles').doc(id);
        await db.runTransaction(async tx=>{
          const [snap,link]=await Promise.all([tx.get(device),tx.get(member)]);
          if(!snap.exists||!link.exists)throw qFailure('That browser is not registered to this member.',404);
          if(snap.data().protectedOwner)throw qFailure('A browser used by the owner is protected.',409);
          tx.set(device,{banned:action==='ban',reason:action==='ban'?reason:'',updatedAt:now(),updatedBy:context.token.uid},{merge:true});
        });
        qRemember(qCache,id,{banned:action==='ban',until:now()+15000});
        if(action==='ban')for(const entry of qConnections.get(id)||[])entry.close();
        await audit(context,{action:action==='ban'?'browser_banned':'browser_unbanned',targetUid:req.params.uid,details:{browserId:id,reason:action==='ban'?reason:''}});
        res.json({ok:true});
      }catch(error){res.status(error.status||503).json({error:error.status?error.message:'The browser action could not be saved.'});}
    });
  }
  return {observe,blocked,guard,track,install};
}
