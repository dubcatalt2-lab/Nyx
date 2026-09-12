import {createHash,createHmac,randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const GEMINI='google/gemini-2.5-flash-lite', LUNA='openai/gpt-5.6-luna';
const hash=s=>createHash('sha256').update(String(s)).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const equal=(a,b)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function passwordDigest(password,salt=randomBytes(16).toString('hex')) {
  return `${salt}:${Buffer.from(await scrypt(password,salt,64)).toString('hex')}`;
}
export async function checkPassword(password,stored) {
  if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)||typeof password!=='string'||password.length>256)return false;
  return equal(await passwordDigest(password,stored.split(':')[0]),stored);
}
const defaults=()=>({balance:1000,grantedTokens:1000,models:[GEMINI],dailyRequests:20,minuteRequests:4,maxOutput:512,createdAt:Date.now()});
export function createKeyStore(db,now=Date.now) {
  const col=db.collection('nyxDeveloperApi'),ref=id=>col.doc(id);
  const account=uid=>ref(`account-${hash(uid)}`);
  async function issue(uid,device,label,exempt=false) {
    const secret=`n_api_${randomBytes(32).toString('base64url')}`,id=hash(secret);
    await db.runTransaction(async tx=>{
      const a=await tx.get(account(uid));
      const data=a.data()||defaults();
      if(data.activeKey)throw fail('Revoke your existing key before creating a replacement.',409);
      if(data.lastIssuedAt&&now()-data.lastIssuedAt<60000)throw fail('Wait a minute before creating another key.',429);
      // Reserve the free grant atomically with issuance, not at page load.
      if(!a.exists&&!exempt){
        if(!device)throw fail('Unable to check account creation limits. Please retry.',503);
        const day=new Date(now()).toISOString().slice(0,10);
        const d=ref(`grant-device-${hash(device)}`),g=ref('grant-global');
        const [ds,gs]=await Promise.all([tx.get(d),tx.get(g)]);
        const dc=ds.data()?.day===day?ds.data().count||0:0,gc=gs.data()?.day===day?gs.data().count||0:0;
        if(dc>=3)throw fail('This browser has reached its free API key signup limit for today. Use your existing account or try tomorrow.',429);
        if(gc>=30)throw fail('Free API key signups have reached today’s limit. Existing keys still work. Try tomorrow or contact the owner.',429);
        tx.set(d,{day,count:dc+1});tx.set(g,{day,count:gc+1});
      }
      tx.set(account(uid),{...data,uid,activeKey:id,lastIssuedAt:now()});
      tx.set(ref(`key-${id}`),{uid,prefix:secret.slice(0,13),label:String(label||'My API key').trim().slice(0,60),createdAt:now(),revoked:false});
    });
    return {key:secret};
  }
  async function revoke(uid) {
    await db.runTransaction(async tx=>{
      const a=await tx.get(account(uid)),data=a.data();if(!data?.activeKey)return;
      const k=ref(`key-${data.activeKey}`),ks=await tx.get(k),ip=ks.data()?.ipId;
      const ips=ip?await tx.get(ref(ip)):null;
      tx.set(k,{revoked:true},{merge:true});
      tx.set(account(uid),{activeKey:null},{merge:true});
      if(ips?.data()?.activeKey===data.activeKey)tx.set(ref(ip),{activeKey:null},{merge:true});
    });
  }
  async function authenticate(secret) {
    if(!/^n_api_[A-Za-z0-9_-]{43}$/.test(secret))throw fail('A valid Nyx API key is required.',401);
    const id=hash(secret),s=await ref(`key-${id}`).get(),key=s.data();
    if(!key||key.revoked)throw fail('This API key is invalid or revoked.',401);
    return {...key,id};
  }
  async function details(uid) {
    const a=(await account(uid).get()).data();
    const k=a?.activeKey?(await ref(`key-${a.activeKey}`).get()).data():null;
    const v=a||defaults(),day=new Date(now()).toISOString().slice(0,10);
    return {uid,balance:v.balance,grantedTokens:v.grantedTokens??v.balance+(v.usedTokens||0),usedTokens:v.usedTokens||0,
      models:v.models,dailyRequests:v.dailyRequests,minuteRequests:v.minuteRequests,maxOutput:v.maxOutput,
      requestsToday:v.day===day?v.requests||0:0,resetAt:Date.parse(day+'T00:00:00Z')+86400000,
      recent:(v.recent||[]).slice(-20).reverse(),pending:Boolean(v.hold?.until>now()),
      key:k?{prefix:k.prefix,label:k.label,createdAt:k.createdAt}:null};
  }
  async function update(uid,body) {
    if(!integer(body.addTokens,0,10000000)||!integer(body.dailyRequests,1,1000)||!integer(body.minuteRequests,1,30)||!integer(body.maxOutput,1,2200)||!Array.isArray(body.models)||!body.models.length||body.models.some(m=>![GEMINI,LUNA].includes(m)))throw fail('Enter valid token and request limits.');
    await db.runTransaction(async tx=>{
      const a=await tx.get(account(uid)),v=a.data()||defaults();
      if(v.balance+body.addTokens>10000000)throw fail('The maximum token balance is 10 million.');
      tx.set(account(uid),{...v,uid,balance:v.balance+body.addTokens,grantedTokens:(v.grantedTokens??v.balance+(v.usedTokens||0))+body.addTokens,models:[...new Set(body.models)],dailyRequests:body.dailyRequests,minuteRequests:body.minuteRequests,maxOutput:body.maxOutput,updatedAt:now()});
    });
  }
  async function reserve(key,payload,premium=false,owner=false) {
    const id=randomBytes(16).toString('hex');
    let reserved;
    await db.runTransaction(async tx=>{
      const [as,ks]=await Promise.all([tx.get(account(key.uid)),tx.get(ref(`key-${key.id}`))]);
      const a=as.data();
      if(!a||a.activeKey!==key.id||ks.data()?.revoked)throw fail('This API key is revoked.',401);
      if(a.hold?.until>now())throw fail('Wait for your current request to finish.',429);
      if(!(premium?[GEMINI,LUNA]:a.models).includes(payload.model))throw fail('This model is not enabled for your key.',403);
      const minute=(a.minute||[]).filter(t=>t>now()-60000),day=new Date(now()).toISOString().slice(0,10),requests=a.day===day?a.requests:0;
      if(minute.length>=a.minuteRequests||(!owner&&requests>=a.dailyRequests))throw fail('Your API request limit has been reached.',429);
      // UTF-8 bytes deliberately overestimate text tokens; reserve before spending.
      const input=96+payload.messages.reduce((n,m)=>n+64+Buffer.byteLength(m.content),0);
      const output=Math.min(payload.max_tokens,a.maxOutput,premium?2200:a.balance-input);
      if(output<1)throw fail('Insufficient tokens. Shorten the prompt or ask the owner for more tokens.',429);
      reserved=input+output;payload.max_tokens=output;
      tx.set(account(key.uid),{...a,balance:premium?a.balance:a.balance-reserved,day,requests:requests+1,minute:[...minute,now()],hold:{id,until:now()+180000}});
    });
    return {uid:key.uid,id,reserved,premium,model:payload.model,startedAt:now()};
  }
  async function settle(receipt,usage,notSent=false) {
    const valid=usage&&integer(usage.prompt_tokens,0,10000000)&&integer(usage.completion_tokens,0,10000000);
    const used=notSent?0:valid?usage.prompt_tokens+usage.completion_tokens:receipt.reserved;
    await db.runTransaction(async tx=>{
      const a=await tx.get(account(receipt.uid)),v=a.data();if(v?.hold?.id!==receipt.id)return;
      tx.set(account(receipt.uid),{balance:receipt.premium?v.balance:v.balance+receipt.reserved-used,hold:null,usedTokens:(v.usedTokens||0)+used,recent:[...(v.recent||[]).slice(-19),{at:now(),model:receipt.model,tokens:used,status:notSent?'not_sent':valid?'completed':'unconfirmed',durationMs:Math.max(0,now()-receipt.startedAt)}]},{merge:true});
    });
  }
  return {issue,revoke,authenticate,details,update,reserve,settle,ref};
}

export function installDeveloperApi(app,deps) {
  const wrap=fn=>async(req,res)=>{res.set('Cache-Control','no-store');try{await fn(req,res);}catch(e){if(!res.headersSent)res.status(e.status||503).json({error:e.status?e.message:'AI is unavailable at this moment. Try again later.'});}};
  async function identity(firebase,uid,allowRestricted=false) {
    const [u,a]=await Promise.all([firebase.auth.getUser(uid).catch(e=>{if(allowRestricted&&e.code==='auth/user-not-found')return {};throw e;}),firebase.firestore.collection('nyxUserAdministration').doc(uid).get()]);
    if(!allowRestricted&&(u.disabled||a.data()?.disabled||a.data()?.aiAccess==='restricted'))throw fail('This account cannot use the API.',403);
    const admin=a.data()||{};
    return {uid,premium:['premium','trialing'].includes(admin.subscriptionStatus||admin.subscription?.status),monthlyTokenLimit:Number.isSafeInteger(admin.aiMonthlyTokenLimit)?admin.aiMonthlyTokenLimit:50000,owner:uid===deps.ownerUid(),verified:Boolean(u.email&&u.emailVerified)};
  }
  async function user(req,mutation=false) {
    if(mutation&&(!deps.sameOrigin(req)||(req.get('origin')&&new URL(req.get('origin')).host!==req.get('host'))))throw fail('Cross-origin changes are not allowed.',403);
    const {firebase,token}=await deps.authenticate(req);
    if(token.firebase?.sign_in_provider==='anonymous')throw fail('Create a Nyx username and password account to use the API.',403);
    return {firebase,store:createKeyStore(firebase.firestore),...await identity(firebase,token.uid)};
  }
  const cookieName='n_api_owner';
  function unlocked(req,u) {
    if(!u.owner||!deps.passwordHash())return false;
    const value=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)||'';
    const [expires,signature]=value.split('.');
    return Number(expires)>Date.now()&&Number(expires)<=Date.now()+900000&&equal(signature||'',createHmac('sha256',deps.passwordHash()).update(`${u.uid}:${expires}`).digest('hex'));
  }
  async function owner(req) {
    const u=await user(req,true);if(!unlocked(req,u))throw fail('Owner login and password unlock are required.',403);return u;
  }
  async function accountDetails(u){
    const details=await u.store.details(u.uid);
    if(u.owner){details.models=[GEMINI,LUNA];details.unlimited=true;}
    else if(u.premium){const usage=(await u.firebase.firestore.collection('nyxAiAllowance').doc(`premium-${hash(u.uid)}`).get()).data()||{};const month=new Date().toISOString().slice(0,7);details.balance=Math.max(0,u.monthlyTokenLimit-(usage.month===month?usage.tokens||0:0));details.grantedTokens=u.monthlyTokenLimit;details.usedTokens=usage.month===month?usage.tokens||0:0;details.models=details.balance>0?[GEMINI,LUNA]:[GEMINI];details.premium=true;}
    details.premium=Boolean(u.premium);details.monthlyTokenLimit=u.premium&&!u.owner?u.monthlyTokenLimit:0;return details;
  }
  app.get('/api',deps.page);
  app.get('/api/developer/me',wrap(async(req,res)=>{
    const u=await user(req),details=await accountDetails(u);
    res.json({...details,verified:u.verified,owner:u.owner,unlocked:unlocked(req,u),configured:deps.configured()});
  }));
  app.post('/api/developer/keys',wrap(async(req,res)=>{
    const u=await user(req,true);
    if(!deps.configured())throw fail('The owner needs to configure OpenRouter first.',503);
    res.json(await u.store.issue(u.uid,await deps.device(req,res,u.firebase),req.body?.label,u.owner||u.premium));
  }));
  app.delete('/api/developer/keys',wrap(async(req,res)=>{const u=await user(req,true);await u.store.revoke(u.uid);res.json({ok:true});}));
  app.post('/api/developer/unlock',wrap(async(req,res)=>{
    const u=await user(req,true);if(!u.owner)throw fail('Only the site owner can unlock management.',403);
    if(!deps.passwordHash())throw fail('Set NYX_API_OWNER_PASSWORD_HASH on the server first.',503);
    await u.firebase.firestore.runTransaction(async tx=>{
      const r=u.store.ref(`unlock-${hash(u.uid)}`),s=await tx.get(r),times=(s.data()?.times||[]).filter(t=>t>Date.now()-900000);
      if(times.length>=5)throw fail('Too many password attempts. Try again in 15 minutes.',429);
      tx.set(r,{times:[...times,Date.now()]});
    });
    if(!await checkPassword(req.body?.password,deps.passwordHash()))throw fail('Incorrect owner password.',403);
    const expires=Date.now()+900000,signature=createHmac('sha256',deps.passwordHash()).update(`${u.uid}:${expires}`).digest('hex');
    res.append('Set-Cookie',`${cookieName}=${expires}.${signature}; Path=/api/developer; HttpOnly; Secure; SameSite=Strict; Max-Age=900`);res.json({ok:true});
  }));
  app.post('/api/developer/lock',wrap(async(req,res)=>{await user(req,true);res.append('Set-Cookie',`${cookieName}=; Path=/api/developer; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);res.json({ok:true});}));
  app.get('/api/developer/owner/accounts',wrap(async(req,res)=>{
    const u=await owner(req),cursor=String(req.query?.cursor||'');
    if(cursor&&!/^account-[a-f0-9]{64}$/.test(cursor))throw fail('Invalid page cursor.');
    let query=u.firebase.firestore.collection('nyxDeveloperApi').orderBy('__name__').endAt('account-\uf8ff').limit(51);
    query=cursor?query.startAfter(cursor):query.startAt('account-');
    const snapshot=await query.get(),docs=snapshot.docs.slice(0,50);
    const members=await Promise.all(docs.filter(doc=>doc.data().activeKey).map(async doc=>{const record=doc.data();const details=await accountDetails({...u,...await identity(u.firebase,record.uid,true)});let name=record.uid,email='';try{const person=await u.firebase.auth.getUser(record.uid);name=person.displayName||record.uid;email=person.email||'';}catch{}return {...details,name,email};}));
    res.json({members,nextCursor:snapshot.docs.length>50?docs.at(-1).id:null});
  }));
  app.get('/api/developer/owner/account/:uid',wrap(async(req,res)=>{const u=await owner(req);const target={...u,...await identity(u.firebase,req.params.uid,true)};res.json(await accountDetails(target));}));
  app.post('/api/developer/owner/account/:uid',wrap(async(req,res)=>{const u=await owner(req);const target={...u,...await identity(u.firebase,req.params.uid,true)};const limit=req.body?.monthlyTokenLimit;if(limit!==undefined&&limit!==0&&(!target.premium||target.owner))throw fail('Monthly AI allowances are only available to Premium members.',403);if(limit!==undefined&&!integer(limit,0,10000000))throw fail('Enter a valid monthly token limit.');await u.store.update(req.params.uid,req.body);if(limit!==undefined&&target.premium&&!target.owner){await u.firebase.firestore.collection('nyxUserAdministration').doc(target.uid).set({aiMonthlyTokenLimit:limit},{merge:true});target.monthlyTokenLimit=limit;}res.json(await accountDetails(target));}));
  app.delete('/api/developer/owner/account/:uid/key',wrap(async(req,res)=>{const u=await owner(req);await u.store.revoke(req.params.uid);res.json({ok:true});}));
  const cors=res=>res.set({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  app.options('/api/v1/ai',(_req,res)=>{cors(res);res.sendStatus(204);});
  app.post('/api/v1/ai',wrap(async(req,res)=>{
    cors(res);
    if(!deps.configured())throw fail('AI is unavailable at this moment. Try again later.',503);
    const firebase=await deps.firebase();if(!firebase)throw fail('API storage is unavailable.',503);
    const store=createKeyStore(firebase.firestore),key=await store.authenticate(String(req.get('authorization')||'').replace(/^Bearer\s+/i,''));
    const u=await identity(firebase,key.uid);
    const b=req.body||{};
    if(b.stream||b.tools||b.functions||b.n&&b.n!==1)throw fail('This API supports single, non-streaming text completions.');
    if(!Array.isArray(b.messages)||!b.messages.length||b.messages.length>24||b.messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||Buffer.byteLength(JSON.stringify(b.messages))>32000)throw fail('Send up to 24 text messages, under 32 KB.');
    if(b.max_tokens!==undefined&&!integer(b.max_tokens,1,2200))throw fail('max_tokens must be between 1 and 2200.');
    const payload={model:b.model||GEMINI,messages:b.messages.map(({role,content})=>({role,content})),max_tokens:b.max_tokens||256};
    const receipt=await store.reserve(key,payload,u.premium||u.owner,u.owner);

    try {
      const settings=await store.details(key.uid);
      // Legacy apiVerified flag means authenticated Nyx key, not verified email.
      req.nyxAiBilling={firebase,uid:key.uid,apiVerified:true,dailyRequests:settings.dailyRequests,minuteRequests:settings.minuteRequests,maxOutput:settings.maxOutput};

      const response=await deps.send(req,payload),result=await response.json();
      await store.settle(receipt,response.ok?result.usage:null);
      if(!response.ok||result.error)throw fail('AI is unavailable at this moment. Try again later.',503);
      res.json({id:result.id,object:'chat.completion',model:payload.model,choices:result.choices,usage:result.usage});
    } catch(e) {await store.settle(receipt,null,!req.nyxApiSent).catch(()=>{});throw e;}
  }));
}
