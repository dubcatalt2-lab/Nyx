import {createHash, randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const q68a1 = Object.freeze({general:'1540790581687484487','announcements-91ac52':'1540790811397062746','links-cb70af':'1544915374619762729'});
export const qGuild = '1517273935908049028';
export const qCustom = value => /^<a?:[A-Za-z0-9_]{1,32}:\d{17,20}>$/.test(String(value));
const hash = value => createHash('sha256').update(value).digest('hex').slice(0,40);
const mark = (scope,id) => hash(scope+':'+id);
const quiet = value => String(value||'').replace(/@/g,'@\u200b');
export function qEnqueue(db,writer,scope,id,enabled=process.env.NYX_DISCORD_BRIDGE_ENABLED==='1') {
  if(!enabled||scope?.private||!q68a1[scope?.id])return;
  writer.set(db.collection('qBridgeQueue').doc('out-'+mark(scope.id,id)),{direction:'out',scope:scope.id,id,revision:randomUUID(),at:Date.now()});
}
export function qEmoji(value) {return value?.id?`<${value.animated?'a':''}:${value.name||'emoji'}:${value.id}>`:String(value?.name||'');}
export function qReactionMerge(local,remote,valid) {
  const result=new Map((local||[]).filter(r=>valid(r.emoji)||qCustom(r.emoji)).map(r=>[r.emoji,{emoji:r.emoji,uids:(r.uids||[]).filter(u=>!u.startsWith('discord_'))}]));
  for(const item of remote){if(!valid(item.emoji)&&!qCustom(item.emoji))continue;const old=result.get(item.emoji)||{emoji:item.emoji,uids:[]};old.uids=[...new Set([...old.uids,...item.uids])].slice(0,250);result.set(item.emoji,old);}
  return [...result.values()].filter(r=>r.uids.length).slice(0,20);
}
export function qOutbound(value,id) {
  const counts=(value.reactions||[]).map(r=>({emoji:r.emoji,count:(r.uids||[]).filter(u=>!u.startsWith('discord_')).length})).filter(r=>r.count);
  const author=quiet(value.author?.displayName||'N7X member').slice(0,80);
  return {content:`**${author.replace(/[\\*_~`|]/g,'')} · N7X**\n${quiet(value.text).slice(0,1700)}`.slice(0,1950),allowed_mentions:{parse:[]},nonce:hash(id).slice(0,24),enforce_nonce:true,embeds:counts.length?[{description:'N7X reactions: '+counts.map(r=>`${r.emoji} ${r.count}`).join('  ').slice(0,3500)}]:[]};
}
export function qBridge({db,rest,botId,valid,emit,channels=q68a1,now=Date.now,allowed=async()=>true,files=async()=>[],mime=()=>false,fetcher=fetch}) {
  const reverse=new Map(Object.entries(channels).map(([k,v])=>[v,k]));
  const message=(scope,id)=>db.collection('nyxChatChannels').doc(scope).collection('messages').doc(id);
  const mapping=(scope,id)=>db.collection('qBridgeMap').doc(mark(scope,id));
  const dmap=id=>db.collection('qBridgeDiscord').doc(id);
  const job=id=>db.collection('qBridgeQueue').doc(id);
  const status=db.collection('qBridgeState').doc('worker');
  const owner=randomUUID();let stopped=false,busy=false,leaseUntil=0,lastSweep=0,reconcileAfter=null;
  async function lease(){
    leaseUntil=await db.runTransaction(async tx=>{const s=(await tx.get(status)).data()||{};if(s.owner!==owner&&s.until>now())return 0;const until=now()+60000;tx.set(status,{owner,until},{merge:true});return until;});
    return Boolean(leaseUntil);
  }
  async function assertLease(){if(stopped||leaseUntil-now()<15000){if(stopped||!await lease())throw Error('bridge_lease_unavailable');}}
  async function queue(scope,id,direction='in') {await job(direction+'-'+mark(scope,id)).set({direction,scope,id,revision:randomUUID(),at:now()});}
  async function bind(scope,nid,did,source){const batch=db.batch();const data={scope,nid,did,source,at:now()};batch.set(mapping(scope,nid),data);batch.set(dmap(did),data);await batch.commit();return data;}
  async function missing(path){try{return await rest.get(path)}catch(e){if(Number(e.code)===10008)return null;throw e;}}
  async function remoteReactions(remote){
    const items=[];
    for(const r of (remote.reactions||[]).slice(0,20)){
      const emoji=qEmoji(r.emoji);if(!valid(emoji)&&!qCustom(emoji))continue;
      const endpoint=r.emoji.id?`${r.emoji.name}:${r.emoji.id}`:r.emoji.name;
      const uids=[];let after='';
      while(uids.length<250){const users=await rest.get(`/channels/${remote.channel_id}/messages/${remote.id}/reactions/${encodeURIComponent(endpoint)}`,{query:new URLSearchParams({limit:'100',...(after?{after}:{})})});
        for(const u of users)if(u.id!==botId&&!u.bot)uids.push('discord_'+u.id);
        if(users.length<100)break;after=users.at(-1).id;
      }
      items.push({emoji,uids:uids.slice(0,250)});
    }
    return items;
  }
  async function importFiles(scope,remote,nid){
    const result=[];let total=0;
    for(const a of (remote.attachments||[]).slice(0,4)){
      if(!mime(a.content_type)||!Number.isFinite(a.size)||a.size<1||a.size>8*1024*1024||total+a.size>8*1024*1024)continue;
      let url;try{url=new URL(a.url)}catch{continue}if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname))continue;
      const id=hash('discord-attachment:'+remote.id+':'+a.id),ref=db.collection('nyxChatAttachments').doc(id),old=(await ref.get()).data();
      if(old?.complete&&old.scopeId===scope){result.push({id,name:old.name,mime:old.mime,size:old.size});total+=old.size;continue;}
      const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('attachment_download_failed');
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>8*1024*1024||size>a.size)throw Error('attachment_too_large');chunks.push(chunk);}if(size!==a.size)throw Error('attachment_size_mismatch');
      const encoded=Buffer.concat(chunks).toString('base64'),totalChunks=Math.ceil(encoded.length/500000),batch=db.batch();
      for(let i=0;i<totalChunks;i++)batch.set(ref.collection('chunks').doc(String(i).padStart(3,'0')),{index:i,chunk:encoded.slice(i*500000,(i+1)*500000)});
      const record={id,name:String(a.filename||'attachment').slice(0,100),mime:a.content_type,size,ownerUid:'discord_'+remote.author.id,scopeType:'channel',scopeId:scope,messageId:nid,bound:true,complete:true,totalChunks,expiresAtMs:0};
      batch.set(ref,record);await batch.commit();result.push({id,name:record.name,mime:record.mime,size});total+=size;
    }return result;
  }
  async function inbound(scope,did){
    const mapped=(await dmap(did).get()).data();
    if(mapped&&mapped.scope!==scope)return;
    const remote=await missing(`/channels/${channels[scope]}/messages/${did}`);
    if(!remote){if(!mapped)return;await message(scope,mapped.nid).delete();await mapping(scope,mapped.nid).set({deleted:true},{merge:true});emit({kind:'delete',scopeType:'channel',scopeId:scope,messageId:mapped.nid});return;}
    if(remote.author?.id===botId&&!mapped)return;
    if((remote.author?.bot||remote.webhook_id)&&remote.author?.id!==botId)return;
    const nid=mapped?.nid||hash('discord:'+did),ref=message(scope,nid);
    if(mapped&&(await mapping(scope,mapped.nid).get()).data()?.deleted)return;
    const reactions=await remoteReactions(remote);
    const source=mapped?.source||'discord';
    const imported=source==='discord'?await importFiles(scope,remote,nid):[];
    let changed=false;
    await db.runTransaction(async tx=>{
      const old=(await tx.get(ref)).data();
      if(source==='nyx'&&!old)return;
      const merged=qReactionMerge(old?.reactions,reactions,valid);
      if(source==='nyx'){changed=JSON.stringify(old.reactions||[])!==JSON.stringify(merged);if(changed)tx.set(ref,{reactions:merged},{merge:true});return;}
      const author=remote.author||{},uid='discord_'+author.id;
      const attachments=(remote.attachments||[]).map(a=>{try{const u=new URL(a.url);return u.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname)?u.href:''}catch{return ''}}).filter(Boolean);
      const text=quiet([remote.content,...attachments].filter(Boolean).join('\n')).slice(0,1000);
      const createdAtMs=Date.parse(remote.timestamp)||now();
      const data={channel:scope,authorUid:uid,author:{uid,displayName:(author.global_name||author.username||'Discord member').slice(0,38)+' (Discord)',handle:'discord_'+author.id,role:'member',avatarUrl:author.avatar?`https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`:'',avatarDecoration:'none',profileEffect:'none',caffeine:false},text,reactions:merged,attachments:imported,createdAtMs,createdAt:new Date(createdAtMs).toISOString(),qDiscord:did};
      changed=JSON.stringify(old)!==JSON.stringify(data);if(changed)tx.set(ref,data);
      if(!old)tx.set(db.collection('nyxChatChannels').doc(scope),{lastMessageAtMs:createdAtMs,lastMessageText:text,lastMessageAuthorUid:uid,updatedAtMs:createdAtMs},{merge:true});
    });
    if(!mapped)await bind(scope,nid,did,source);
    if(changed){const snap=await ref.get();emit(source==='nyx'?{kind:'reaction',scopeType:'channel',scopeId:scope,messageId:nid,reactions:snap.data()?.reactions||[]}:{kind:'message',scopeType:'channel',scopeId:scope,messageDocument:snap,createdAtMs:snap.data()?.createdAtMs,lastMessageText:snap.data()?.text,lastMessageAuthorUid:snap.data()?.authorUid});}
  }
  async function outbound(scope,nid){
    const ref=message(scope,nid),data=(await ref.get()).data();let mapped=(await mapping(scope,nid).get()).data();
    if(!data){if(mapped&&!mapped.deleted){try{await rest.delete(`/channels/${channels[scope]}/messages/${mapped.did}`)}catch(e){if(Number(e.code)!==10008)throw e;}await mapping(scope,nid).set({deleted:true},{merge:true});}return;}
    if(mapped?.deleted||(!mapped&&!data.qBridgeEligible&&!data.qDiscord))return;
    const body=qOutbound(data,nid);
    if(!mapped){if(data.qDiscord){mapped=await bind(scope,nid,data.qDiscord,'discord');}else{await assertLease();const sent=await rest.post(`/channels/${channels[scope]}/messages`,{body,files:await files(scope,data)});mapped=await bind(scope,nid,sent.id,'nyx');}}
    const path=`/channels/${channels[scope]}/messages/${mapped.did}`;
    const remote=await missing(path);if(!remote){await inbound(scope,mapped.did);return;}
    if(mapped.source==='nyx'){delete body.nonce;delete body.enforce_nonce;if(remote.content!==body.content||JSON.stringify(remote.embeds?.map(e=>({description:e.description}))||[])!==JSON.stringify(body.embeds))await rest.patch(path,{body});}
    const active=new Set((data.reactions||[]).filter(r=>(r.uids||[]).some(u=>!u.startsWith('discord_'))).map(r=>r.emoji));
    for(const emoji of active){if((remote.reactions||[]).some(r=>qEmoji(r.emoji)===emoji&&r.me))continue;const key=qCustom(emoji)?emoji.replace(/^<a?:|>$/g,''):emoji;await rest.put(path+'/reactions/'+encodeURIComponent(key)+'/@me');}
    for(const r of remote.reactions||[]){const emoji=qEmoji(r.emoji);if(r.me&&!active.has(emoji)){const key=r.emoji.id?`${r.emoji.name}:${r.emoji.id}`:emoji;await rest.delete(path+'/reactions/'+encodeURIComponent(key)+'/@me');}}
  }
  async function receive(packet){
    const d=packet?.d||{},scope=reverse.get(d.channel_id);if(!scope||d.guild_id&&d.guild_id!==qGuild)return;
    if(packet.t==='MESSAGE_CREATE'&&(d.author?.bot||d.webhook_id))return;
    if((packet.t||'').startsWith('MESSAGE_REACTION_')&&d.user_id===botId)return;
    if(packet.t==='MESSAGE_DELETE_BULK'){for(const id of d.ids||[])await queue(scope,id);return;}
    if(['MESSAGE_CREATE','MESSAGE_UPDATE','MESSAGE_DELETE','MESSAGE_REACTION_ADD','MESSAGE_REACTION_REMOVE','MESSAGE_REACTION_REMOVE_ALL','MESSAGE_REACTION_REMOVE_EMOJI'].includes(packet.t))await queue(scope,d.message_id||d.id);
  }
  async function sweep(){
    for(const [scope,cid] of Object.entries(channels)){
      const ref=db.collection('qBridgeState').doc('cursor-'+scope),saved=(await ref.get()).data();
      const rows=await rest.get(`/channels/${cid}/messages`,{query:new URLSearchParams(saved?.after?{after:saved.after,limit:'100'}:{limit:'1'})});
      if(!saved){await ref.set({after:rows[0]?.id||String((BigInt(now())-1420070400000n)<<22n)});continue;}
      for(const row of [...rows].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1))await receive({t:'MESSAGE_CREATE',d:{...row,guild_id:qGuild,channel_id:cid}});
      if(rows.length)await ref.set({after:rows.reduce((a,b)=>BigInt(a)>BigInt(b.id)?a:b.id,saved.after)});
    }
  }
  async function reconcile(){
    let query=db.collection('qBridgeMap').orderBy('at').limit(8);if(reconcileAfter)query=query.startAfter(reconcileAfter);
    const page=await query.get();reconcileAfter=page.docs.length===8?page.docs.at(-1):null;
    for(const doc of page.docs){const m=doc.data();if(channels[m.scope]&&!m.deleted)await queue(m.scope,m.did);}
  }
  async function tick(){
    if(busy||stopped)return;busy=true;
    try{
      if(!await lease())return;
      if(now()-lastSweep>30000){await sweep();await reconcile();lastSweep=now();}
      const pending=await db.collection('qBridgeQueue').orderBy('at').limit(20).get();
      for(const snapshot of pending.docs){await assertLease();const j=snapshot.data();if(!channels[j.scope]||j.at>now())continue;if(!await allowed(j.scope)){await snapshot.ref.set({at:now()+30000,lastCode:'channel_not_public'},{merge:true});continue;}
        try{await (j.direction==='in'?inbound(j.scope,j.id):outbound(j.scope,j.id));await db.runTransaction(async tx=>{const current=await tx.get(snapshot.ref);if(current.data()?.revision===j.revision)tx.delete(snapshot.ref);});}
        catch(error){await snapshot.ref.set({at:now()+15000,lastCode:String(error.code||error.status||'retry').slice(0,30)},{merge:true});}
      }
    }finally{busy=false;}
  }
  return {receive,tick,inbound,outbound,stop:async()=>{stopped=true;await db.runTransaction(async tx=>{const current=(await tx.get(status)).data();if(current?.owner===owner)tx.set(status,{until:0},{merge:true});});}};
}
export async function qStart({db,valid,emit,validate,allowed,files,mime}) {
  if(process.env.NYX_DISCORD_BRIDGE_ENABLED!=='1')return {close:async()=>{}};
  const file=process.env.NYX_DISCORD_TOKEN_FILE;
  if(!file)throw Error('Discord token file is not configured');
  const token=(await readFile(file,'utf8')).trim();if(!token)throw Error('Discord token file is empty');
  await validate(Object.keys(q68a1));
  const {Client,GatewayIntentBits,Partials}=await import('discord.js');
  const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildMessageReactions,GatewayIntentBits.MessageContent],partials:[Partials.Message,Partials.Channel,Partials.Reaction,Partials.User]});
  let worker,timer,failures=0;
  const safe=work=>Promise.resolve(work).catch(()=>{if(++failures%20===1)console.error('Discord bridge operation will retry.');});
  client.on('error',()=>console.error('Discord bridge connection error.'));
  client.on('raw',packet=>{if(worker)void safe(worker.receive(packet));});
  try{
    await client.login(token);
    if(!client.isReady())await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Discord login timed out')),30000);client.once('clientReady',()=>{clearTimeout(t);resolve();});});
    for(const cid of Object.values(q68a1)){const channel=await client.rest.get('/channels/'+cid);if(channel.guild_id!==qGuild||![0,5].includes(channel.type))throw Error('Discord channel configuration mismatch');}
    worker=qBridge({db,rest:client.rest,botId:client.user.id,valid,emit,allowed,files,mime});
    await worker.tick();timer=setInterval(()=>void safe(worker.tick()),3000);timer.unref();
    return {close:async()=>{clearInterval(timer);await worker.stop();await client.destroy();}};
  }catch(error){await client.destroy();throw error;}
}
