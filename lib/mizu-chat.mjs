import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

export const mizuUid=id=>'mizu_'+createHash('sha256').update(id).digest('hex').slice(0,40);
export function mizuSignature(secret,method,path,timestamp,body={}) {
  return createHmac('sha256',secret).update([timestamp,method.toUpperCase(),path,JSON.stringify(body)].join('\n')).digest('hex');
}
const fail=(status,message)=>Object.assign(new Error(message),{status});
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,max);
const externalId=value=>{if(typeof value!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(value))throw fail(400,'Invalid MizuMath user ID.');return value;};
function imageUrl(value){
  if(!value)return '';
  let u;try{u=new URL(value);}catch{throw fail(400,'Profile images must use an HTTPS URL.');}
  if(u.protocol!=='https:'||u.username||u.password||u.href.length>1900)throw fail(400,'Profile images must use an HTTPS URL.');
  return u.href;
}
export function mizuProfile(user){
  const id=externalId(user?.id),uid=mizuUid(id);
  const displayName=clean(user.displayName,36)||'MizuMath member';
  return {id,uid,profile:{displayName:displayName+' (Mizu)',username:'mizu_'+uid.slice(-16),handle:'@mizu_'+uid.slice(-16),bio:clean(user.bio,280),avatarUrl:imageUrl(user.avatarUrl),bannerUrl:imageUrl(user.bannerUrl),avatarDecoration:'none',profileEffect:'none'}};
}

// The partner secret stays on MizuMath's server. No browser CORS or shared user token.
export function installMizuChat(app,{database,enabled=()=>true,secret=()=>process.env.NYX_MIZU_CHAT_SECRET||'',canAccess,moderator,serialize,emit=()=>{},now=Date.now}){
  const base='/api/integrations/mizu/v1';
  const wrap=fn=>async(req,res)=>{res.set('Cache-Control','no-store');try{if(!enabled())throw fail(404,'Not found');await fn(req,res);}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Chat is unavailable.'});}};
  async function partner(req){
    const key=secret();if(key.length<32)throw fail(503,'MizuMath integration is not configured.');
    const timestamp=req.get('x-mizu-timestamp')||'',signature=req.get('x-mizu-signature')||'';
    if(!/^\d{13}$/.test(timestamp)||Math.abs(now()-Number(timestamp))>60000||! /^[a-f0-9]{64}$/.test(signature))throw fail(401,'Invalid integration signature.');
    const expected=mizuSignature(key,req.method,req.originalUrl,timestamp,req.body||{});
    if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex')))throw fail(401,'Invalid integration signature.');
    const db=await database();await canAccess(db);return db;
  }
  const users=db=>db.collection('nyxMizuMembers');
  const channel=db=>db.collection('nyxChatChannels').doc('general');
  app.post(base+'/messages',wrap(async(req,res)=>{
    const db=await partner(req),person=mizuProfile(req.body?.user),requestId=req.body?.messageId;
    if(typeof requestId!=='string'||! /^[A-Za-z0-9_-]{12,100}$/.test(requestId))throw fail(400,'Use a stable message ID of 12–100 letters, numbers, underscores or hyphens.');
    const text=String(req.body?.text??'').replace(/\r\n?/g,'\n').trim();
    if(!text||text.length>1000)throw fail(400,'Messages must contain 1–1,000 characters.');
    if(/@(?:everyone|here)\b/i.test(text))throw fail(403,'Mass mentions are not available.');
    const id=createHash('sha256').update(person.uid+':'+requestId).digest('hex').slice(0,40);
    const room=channel(db),ref=room.collection('messages').doc(id),member=users(db).doc(person.uid);
    const result=await db.runTransaction(async tx=>{
      const [user,existing,roomState]=await Promise.all([tx.get(member),tx.get(ref),tx.get(room)]);
      const state=user.data()||{};
      if(state.banned===true)throw fail(403,'You are banned from shared global chat.');
      if(roomState.data()?.locked)throw fail(403,'Global chat is currently locked.');
      if(existing.exists)return {duplicate:true,message:serialize(existing)};
      const times=(state.sendTimes||[]).filter(t=>t>now()-60000);
      if(times.length>=20||times.some(t=>t>now()-1000))throw fail(429,'Slow down before sending another message.');
      const createdAtMs=now();
      const data={channel:'general',conversationId:'',authorUid:person.uid,author:{uid:person.uid,displayName:person.profile.displayName,handle:person.profile.username,avatarUrl:person.profile.avatarUrl,avatarDecoration:'none',profileEffect:'none',role:'member',customRole:null,caffeine:false},text,attachments:[],reactions:[],createdAtMs,createdAt:new Date(createdAtMs).toISOString(),externalSource:'mizu'};
      tx.set(ref,data);
      tx.set(member,{externalId:person.id,sendTimes:[...times,createdAtMs],updatedAtMs:createdAtMs},{merge:true});
      tx.set(db.collection('nyxUserProfiles').doc(person.uid),{profile:person.profile,externalSource:'mizu',updatedAtMs:createdAtMs},{merge:true});
      tx.set(room,{lastMessageAtMs:createdAtMs,lastMessageText:text,lastMessageAuthorUid:person.uid,updatedAtMs:createdAtMs},{merge:true});
      return {duplicate:false,message:serialize({id,data:()=>data})};
    });
    if(!result.duplicate)await emit({kind:'message',scopeType:'channel',scopeId:'general',messageDocument:await ref.get(),messageId:id,lastMessageText:text,lastMessageAuthorUid:person.uid,createdAtMs:result.message.createdAtMs});
    res.json(result);
  }));
  app.put(base+'/profile',wrap(async(req,res)=>{
    const db=await partner(req),person=mizuProfile(req.body?.user);
    await db.collection('nyxUserProfiles').doc(person.uid).set({profile:person.profile,externalSource:'mizu',updatedAtMs:now()},{merge:true});
    await users(db).doc(person.uid).set({externalId:person.id},{merge:true});
    res.json({uid:person.uid});
  }));
  app.get(base+'/messages',wrap(async(req,res)=>{
    const db=await partner(req);
    let query=channel(db).collection('messages').orderBy('createdAtMs','desc');
    if(req.query.before!==undefined){const before=Number(req.query.before);if(!Number.isSafeInteger(before)||before<1)throw fail(400,'Invalid history cursor.');query=query.where('createdAtMs','<',before);}
    const snapshot=await query.limit(100).get();
    res.json({messages:snapshot.docs.map(d=>serialize(d)).reverse(),nextBefore:snapshot.docs.length===100?snapshot.docs.at(-1).data().createdAtMs:null});
  }));
  app.get(base+'/users/:id/status',wrap(async(req,res)=>{
    const db=await partner(req),uid=mizuUid(externalId(req.params.id)),member=(await users(db).doc(uid).get()).data()||{};
    res.json({uid,banned:member.banned===true});
  }));
  const moderation='/api/chat/integrations/mizu/users/:uid';
  async function target(req){if(!/^mizu_[a-f0-9]{40}$/.test(req.params.uid))throw fail(400,'Invalid MizuMath user.');const actor=await moderator(req);return {actor,ref:users(actor.db).doc(req.params.uid)};}
  app.get(moderation,wrap(async(req,res)=>{const {ref}=await target(req),value=(await ref.get()).data();if(!value)throw fail(404,'Member not found.');res.json({banned:value.banned===true});}));
  app.post(moderation,wrap(async(req,res)=>{
    const {actor,ref}=await target(req);if(typeof req.body?.banned!=='boolean')throw fail(400,'Specify whether the member is banned.');
    await actor.db.runTransaction(async tx=>{if(!(await tx.get(ref)).exists)throw fail(404,'Member not found.');tx.set(ref,{banned:req.body.banned,moderatedBy:actor.uid,moderatedAtMs:now()},{merge:true});});
    res.json({banned:req.body.banned});
  }));
}
