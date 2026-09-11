import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

export const AI_JOIN_CUTOFF=Date.parse('2026-08-25T07:00:00Z'); // Midnight America/Los_Angeles.
const BASE_MESSAGES=5, MAX_MESSAGES=10, BONUS_TOKEN_LIMIT=10000;
const DAY=86400000, MINUTE=60000, USD=1_000_000;
const failure=(message,status=429,retryAfter=60)=>Object.assign(new Error(message),{status,retryAfter,code:'ai_allowance'});
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const count=value=>Math.max(0,Number.isSafeInteger(value)?value:0);
const int=(value,fallback,min=1,max=1000000)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const dollars=value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>100000)throw new Error('Invalid AI dollar limit.');return Math.floor(n*USD);};

export function aiAllowanceConfig(env={}) {
  let prices={};try {prices=JSON.parse(env.NYX_AI_MODEL_PRICES_JSON||'{}');}catch{throw new Error('Invalid AI model price configuration.');}
  if(!prices||typeof prices!=='object'||Array.isArray(prices))throw new Error('Invalid AI model price configuration.');
  // One normalized image (1600px maximum edge), conservative per-model reserve.
  for(const id of ['shared:google/gemini-2.5-flash-lite','shared:openai/gpt-5.6-luna']) {
    const price=prices[id];
    if(price&&typeof price==='object'&&!Array.isArray(price))price.imageTokens=Math.max(8192,Number(price.imageTokens)||0);
  }
  const dailyUsd=dollars(env.NYX_AI_DAILY_BUDGET_USD||0);
  return {dailyRequests:int(env.NYX_AI_DAILY_REQUEST_BUDGET,1000),dailyUsd,
    monthlyUsd:dollars(env.NYX_AI_MONTHLY_BUDGET_USD||(dailyUsd?dailyUsd/USD*30:0)),prices,
    newDaily:int(env.NYX_AI_NEW_DAILY_REQUESTS,10),establishedDaily:int(env.NYX_AI_ESTABLISHED_DAILY_REQUESTS,10),
    minute:int(env.NYX_AI_ACCOUNT_REQUESTS_PER_MINUTE,4),networkMinute:int(env.NYX_AI_NETWORK_REQUESTS_PER_MINUTE,120),
    globalConcurrent:int(env.NYX_AI_CONCURRENT_GLOBAL,3,1,32),
    trusted:new Set(String(env.NYX_AI_TRUSTED_UIDS||'').split(',').map(s=>s.trim()).filter(Boolean))};
}

// All documents are server-only under the existing catch-all Firestore deny rule.
// Fixed account/device/network documents reset their bounded counters in place.
export function createAiAllowance({db,config,now=Date.now}) {
  const col=db.collection('nyxAiAllowance'),ref=id=>col.doc(id);
  const day=()=>new Date(now()).toISOString().slice(0,10);
  const state=(data={})=>data.day===day()?data:{...data,day:day(),requests:0,money:0,tokens:0,newcomerRequests:0,establishedRequests:0,reserveRequests:0,newcomerMoney:0,establishedMoney:0,reserveMoney:0};
  const recent=values=>(Array.isArray(values)?values:[]).filter(n=>Number.isFinite(n)&&n>now()-MINUTE&&n<=now());
  const slotValues=data=>(Array.isArray(data?.slots)?data.slots:[]).filter(s=>s?.until>now()).slice(0,32);
  const days=data=>(Array.isArray(data?.activeDays)?data.activeDays:[]).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>=new Date(now()-30*DAY).toISOString().slice(0,10)).slice(-30);
  const bucket=(data,limit,amount)=>{
    const capacity=Math.max(1,limit/8),available=Math.min(capacity,Math.max(0,Number(data?.available)||0)+Math.max(0,now()-(Number(data?.at)||now()))*limit/DAY);
    const balance=data?available:capacity;
    if(amount>capacity)throw failure('This request is too expensive for the new-account allowance. Shorten the conversation or choose a cheaper model.',429,3600);
    if(balance<amount)throw failure('The new-account AI allowance is resting. Please try again later.',429,Math.max(1,Math.ceil((amount-balance)/(limit/DAY)/1000)));
    return {available:balance-amount,at:now()};
  };
  function tier(actor,usage) {
    if(actor.blocked)throw failure('Shared AI access is restricted for this account.',403);
    if(!actor.apiVerified&&!actor.premium&&!(Number.isFinite(actor.createdAt)&&actor.createdAt<AI_JOIN_CUTOFF))throw failure('Shared AI is available to Premium members and accounts created before August 25, 2026 (Pacific time).',403);
    if(actor.owner)return 'reserve';
    if(actor.premium||actor.trusted||config.trusted.has(actor.uid))return 'established';
    const activeDays=days(usage);
    return Number.isFinite(actor.createdAt)&&actor.createdAt<=now()-7*DAY&&activeDays.length>=3&&activeDays[0]<day()?'established':'newcomer';
  }
  const share=t=>t==='newcomer'?.2:t==='reserve'?.1:.7;
  const references=actor=>({account:ref(`${actor.apiVerified?'api-account':'account'}-${hash(actor.uid)}`),device:ref(`device-${hash(actor.device||actor.uid)}`),network:ref(`network-${hash(actor.network||'unknown')}`),global:ref('global')});
  async function begin(actor) {
    if(!actor?.uid)throw failure('Sign in to use shared Nyx AI.',401);
    const refs=references(actor),id=randomBytes(16).toString('hex');
    const accepted=await db.runTransaction(async tx=>{
      const [a,d,n,g]=await Promise.all([tx.get(refs.account),tx.get(refs.device),tx.get(refs.network),tx.get(refs.global)]);
      const raw=a.data()||{},account=state(raw),device=state(d.data()),network=n.data()||{},global=state(g.data()),selected=tier(actor,raw);
      const slots=slotValues(raw),globalSlots=slotValues(g.data()),minute=recent(raw.minute),networkTimes=recent(network.minute);
      if(slots.length||globalSlots.length>=config.globalConcurrent)throw failure('Nyx AI is busy. Please wait for another response to finish.',429,5);
      if(selected!=='reserve'&&globalSlots.filter(s=>s.tier!=='reserve').length>=Math.max(1,config.globalConcurrent-1))throw failure('Nyx AI is busy. Please wait a moment.',429,5);
      if(selected==='newcomer'&&globalSlots.filter(s=>s.tier==='newcomer').length>=Math.max(1,Math.floor(config.globalConcurrent/3)))throw failure('New-account AI is busy. Please wait a moment.',429,5);
      if(minute.length>=(actor.apiVerified?int(actor.apiMinuteRequests,4,1,30):config.minute))throw failure('Please wait before sending another AI message.',429,60);
      if(networkTimes.length>=config.networkMinute)throw failure('This network is sending too many AI requests. Please wait a moment.',429,60);
      const maximum=actor.apiVerified?int(actor.apiDailyRequests,20,1,1000):Math.min(MAX_MESSAGES,selected==='newcomer'?config.newDaily:config.establishedDaily);
      if(!actor.apiVerified&&count(account.requests)>=BASE_MESSAGES&&count(account.tokens)>=BONUS_TOKEN_LIMIT)throw failure('Your 5-message AI allowance is used. Extra messages require a low-token day. Try again after 00:00 UTC.',429,Math.ceil((Date.parse(`${day()}T00:00:00Z`)+DAY-now())/1000));
      if(count(account.requests)>=maximum)throw failure('Your shared AI allowance resets at 00:00 UTC.',429,Math.ceil((Date.parse(`${day()}T00:00:00Z`)+DAY-now())/1000));
      const used=count(global[`${selected}Requests`]),limit=Math.floor(config.dailyRequests*share(selected));
      if(used>=limit)throw failure('This shared AI allowance has been used for today. Please try again after 00:00 UTC.',429,Math.ceil((Date.parse(`${day()}T00:00:00Z`)+DAY-now())/1000));
      if(selected==='newcomer'&&count(device.requests)>=config.newDaily*3)throw failure('This browser has used its new-account AI allowance for today.',429,3600);
      const paced=selected==='newcomer'?bucket(global.newRequestBucket,limit,1):null;
      const slot={id,tier:selected,until:now()+180000};
      tx.set(refs.account,{...raw,...account,requests:count(account.requests)+1,minute:[...minute,now()],slots:[slot],activeDays:days(raw),updatedAt:now()});
      tx.set(refs.device,{...device,requests:count(device.requests)+1,updatedAt:now()});
      tx.set(refs.network,{minute:[...networkTimes,now()],updatedAt:now()},{merge:true});
      tx.set(refs.global,{...global,[`${selected}Requests`]:used+1,slots:[...globalSlots,slot],...(paced?{newRequestBucket:paced}:{})});
      return {tier:selected,messageNumber:count(account.requests)+1};
    });
    return {id,actor,refs,tier:accepted.tier,messageNumber:accepted.messageNumber,day:day(),calls:0,closed:false};
  }
  function estimate(session,provider,payload) {
    const model=String(payload.model||''),price=config.prices[`${provider}:${model}`];
    if(config.dailyUsd&&!price)throw failure('This model is not available under the shared AI budget. Choose another model.',503);
    const maximum=session.actor.apiVerified?int(session.actor.apiMaxOutput,512,1,2200):session.tier==='newcomer'?700:2200;
    const output=int(payload.max_completion_tokens??payload.max_tokens,1200,1,65536);
    const capped=Math.min(output,maximum);
    if('max_completion_tokens' in payload)payload.max_completion_tokens=capped;else payload.max_tokens=capped;
    if(payload.tools?.length||payload.functions?.length||Number(payload.n||1)!==1)throw failure('This shared AI request type is unavailable.',400);
    const messages=Array.isArray(payload.messages)?payload.messages:[];
    if(messages.length>24)throw failure('This conversation is too long. Start a new chat.',413);
    let bytes=Buffer.byteLength(String(payload.system||''))+1024,images=0;
    for(const message of messages) {
      bytes+=64;
      if(Array.isArray(message.content))for(const part of message.content){if(part.type==='image_url')images++;else if(part.type==='text')bytes+=Buffer.byteLength(String(part.text||''));else throw failure('Unsupported shared AI content.',400);}
      else if(typeof message.content==='string')bytes+=Buffer.byteLength(message.content);
      else throw failure('Unsupported shared AI content.',400);
    }
    if(bytes>100000||images>1)throw failure('This AI request is too large. Shorten the conversation.',413);
    if(!config.dailyUsd)return {reserved:0,tokens:bytes+capped,price:null,provider,model};
    const inputRate=Number(price.inputPerMillion),outputRate=Number(price.outputPerMillion),fixed=Number(price.requestUsd||0);
    if(![inputRate,outputRate,fixed].every(n=>Number.isFinite(n)&&n>=0&&n<=100000)||images&&!(Number.isSafeInteger(Number(price.imageTokens))&&Number(price.imageTokens)>0))throw failure('This model needs a valid shared AI price configuration.',503);
    const input=bytes+(images?images*Number(price.imageTokens):0);
    if(input>int(price.maxInputTokens,100000))throw failure('This conversation exceeds the shared model limit. Start a new chat.',413);
    const reserved=Math.ceil(input*inputRate+capped*outputRate+fixed*USD);
    if(!Number.isSafeInteger(reserved))throw failure('This model needs a valid shared AI price configuration.',503);
    return {reserved,tokens:input+capped,price:{inputRate,outputRate,fixed},provider,model};
  }
  async function reserve(session,provider,payload) {
    if(session.closed||++session.calls>4)throw failure('This AI request has reached its processing limit.',429);
    const cost=estimate(session,provider,payload),id=randomBytes(12).toString('hex');
    await db.runTransaction(async tx=>{
      const [a,g]=await Promise.all([tx.get(session.refs.account),tx.get(session.refs.global)]);
      const raw=a.data()||{},account=state(raw),global=state(g.data()),month=day().slice(0,7),moneyKey=`${session.tier}Money`;
      if(!slotValues(raw).some(s=>s.id===session.id))throw failure('This AI request expired. Please send it again.',429);
      if(session.day!==day())throw failure('The daily AI allowance reset. Please send your message again.',429);
      if(!session.actor.apiVerified&&session.messageNumber>BASE_MESSAGES&&count(account.tokens)+cost.tokens>BONUS_TOKEN_LIMIT)throw failure('This extra message would exceed your daily token allowance. Shorten the conversation or try again after 00:00 UTC.',429,3600);
      const pool=Math.floor(config.dailyUsd*share(session.tier));
      const personal=Math.floor(config.dailyUsd*(session.tier==='newcomer'?.02:.1));
      const spentMonth=global.month===month?count(global.monthMoney):0;
      if(config.dailyUsd&&(count(global[moneyKey])+cost.reserved>pool||count(account.money)+cost.reserved>personal||spentMonth+cost.reserved>config.monthlyUsd))throw failure('The shared AI spending allowance has been reached. Please try again later.',429,3600);
      const paced=config.dailyUsd&&session.tier==='newcomer'?bucket(global.newMoneyBucket,pool,cost.reserved):null;
      const receipts=(raw.receipts||[]).filter(r=>r.until>now());
      tx.set(session.refs.account,{...raw,...account,money:count(account.money)+cost.reserved,tokens:count(account.tokens)+cost.tokens,receipts:[...receipts,{id,reserved:cost.reserved,tokens:cost.tokens,day:day(),tier:session.tier,until:now()+180000}]});
      tx.set(session.refs.global,{...global,month,monthMoney:spentMonth+cost.reserved,[moneyKey]:count(global[moneyKey])+cost.reserved,...(paced?{newMoneyBucket:paced}:{})});
    });
    return {...cost,id,day:day(),session};
  }
  async function settle(reservation,usage,notSent=false) {
    const {session,id}=reservation;
    let charged=reservation.reserved;
    if(reservation.price&&usage&&Number.isFinite(usage.input)&&Number.isFinite(usage.output)&&usage.input>=0&&usage.output>=0) {
      const p=reservation.price;
      charged=Math.ceil(usage.input*p.inputRate+usage.output*p.outputRate+p.fixed*USD);
      if(Number.isFinite(usage.cost)&&usage.cost>=0)charged=Math.max(charged,Math.ceil(usage.cost*USD));
      // Malformed/absurd provider usage must stop spending, never wrap/reset a counter.
      if(!Number.isSafeInteger(charged))charged=Number.MAX_SAFE_INTEGER;
    }
    let chargedTokens=reservation.tokens;
    if(usage&&Number.isSafeInteger(usage.input)&&Number.isSafeInteger(usage.output)&&usage.input>=0&&usage.output>=0)chargedTokens=Math.min(Number.MAX_SAFE_INTEGER,usage.input+usage.output);
    if(notSent){charged=0;chargedTokens=0;}
    await db.runTransaction(async tx=>{
      const [a,g]=await Promise.all([tx.get(session.refs.account),tx.get(session.refs.global)]);
      const account=a.data()||{},global=g.data()||{},receipt=(account.receipts||[]).find(r=>r.id===id);
      if(!receipt)return;
      const tokenDifference=chargedTokens-count(receipt.tokens);
      const difference=charged-receipt.reserved,key=`${receipt.tier}Money`;
      const adjust=value=>Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,count(value)+difference));
      tx.set(session.refs.account,{receipts:(account.receipts||[]).filter(r=>r.id!==id),...(account.day===receipt.day?{money:adjust(account.money),tokens:Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,count(account.tokens)+tokenDifference))}:{})},{merge:true});
      tx.set(session.refs.global,{...(global.day===receipt.day?{[key]:adjust(global[key])}:{}),...(global.month===receipt.day.slice(0,7)?{monthMoney:adjust(global.monthMoney)}:{})},{merge:true});
    });
  }
  async function finish(session,success=false) {
    if(session.closed)return;session.closed=true;
    await db.runTransaction(async tx=>{
      const [a,g]=await Promise.all([tx.get(session.refs.account),tx.get(session.refs.global)]);
      const account=a.data()||{};
      const activeDays=days(account);if(success&&!activeDays.includes(day()))activeDays.push(day());
      tx.set(session.refs.account,{slots:slotValues(account).filter(s=>s.id!==session.id),activeDays:activeDays.slice(-30)},{merge:true});
      tx.set(session.refs.global,{slots:slotValues(g.data()).filter(s=>s.id!==session.id)},{merge:true});
    });
  }
  let secretPromise;
  async function device(req,res) {
    secretPromise ||= db.runTransaction(async tx=>{const r=ref('device-secret'),s=await tx.get(r);if(s.exists)return s.data().secret;const secret=randomBytes(32).toString('hex');tx.set(r,{secret});return secret;}).catch(e=>{secretPromise=null;throw e;});
    const secret=await secretPromise,sign=id=>createHmac('sha256',secret).update(id).digest('hex');
    const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nyx_ai_device='))?.slice(14)||'';
    const match=/^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(cookie);
    if(match&&timingSafeEqual(Buffer.from(match[2],'hex'),Buffer.from(sign(match[1]),'hex')))return match[1];
    const id=randomBytes(16).toString('hex');
    if(!res.headersSent)res.append('Set-Cookie',`nyx_ai_device=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${req.secure?'; Secure':''}`);
    return id;
  }
  async function register(deviceId,networkId) {
    await db.runTransaction(async tx=>{
      const d=ref(`signup-device-${hash(deviceId)}`),n=ref(`signup-network-${hash(networkId)}`);
      const [ds,ns]=await Promise.all([tx.get(d),tx.get(n)]),dv=state(ds.data()),nv=ns.data()||{};
      const times=(nv.times||[]).filter(t=>t>now()-3600000&&t<=now());
      if(count(dv.requests)>=3)throw failure('This browser has reached its account creation limit for today.',429,3600);
      if(times.length>=100)throw failure('Too many accounts are being created on this network. Please try again later.',429,600);
      tx.set(d,{...dv,requests:count(dv.requests)+1,updatedAt:now()});tx.set(n,{times:[...times,now()],updatedAt:now()});
    });
  }
  return {begin,reserve,settle,finish,device,register};
}
