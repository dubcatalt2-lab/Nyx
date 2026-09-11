export const AI_UNAVAILABLE = 'AI is unavailable at this moment. Try again later.';
const unavailable=()=>Object.assign(new Error(AI_UNAVAILABLE),{status:503,code:'ai_allowance',retryAfter:60});
const micro=value=>{
  if(typeof value!=='number'||!Number.isFinite(value))throw unavailable();
  const result=Math.floor(value*1_000_000+0.000001);
  if(!Number.isSafeInteger(result))throw unavailable();
  return result;
};

// One ledger across all shared models/processes. Recent estimates remain reserved
// for five minutes, even after completion, to allow for provider billing lag.
export function createOpenRouterBalanceGuard({db,managementKey,fetchImpl=fetch,now=Date.now}) {
  const ref=db.collection('nyxAiAllowance').doc('openrouter-balance');
  async function reserve({key,amount,signal}) {
    if(!managementKey||!key||!Number.isSafeInteger(amount)||amount<0)throw unavailable();
    const deadline=AbortSignal.timeout(5000);
    const combined=signal?AbortSignal.any([signal,deadline]):deadline;
    try {
      const {remaining}=await readOpenRouterBalance({key,managementKey,fetchImpl,signal:combined});
      if(combined.aborted)throw unavailable();
      await db.runTransaction(async tx=>{
        const snapshot=await tx.get(ref);
        const pending=(snapshot.data()?.pending||[]).filter(item=>item.until>now());
        if(pending.some(item=>!Number.isSafeInteger(item.amount)||item.amount<0))throw unavailable();
        const held=pending.reduce((total,item)=>total+item.amount,0);
        // Also pause above ten cents when the next request could cross the floor.
        if(!Number.isSafeInteger(held)||pending.length>=2048||remaining- held-amount<=100000)throw unavailable();
        if(combined.aborted)throw unavailable();
        tx.set(ref,{pending:[...pending,{amount,until:now()+300000}],updatedAt:now()});
      });
    } catch {throw unavailable();}
  }
  return {reserve};
}

export async function readOpenRouterBalance({key,managementKey,fetchImpl=fetch,signal}) {
  if(!key||!managementKey)throw unavailable();
  const deadline=AbortSignal.timeout(5000);
  const combined=signal?AbortSignal.any([signal,deadline]):deadline;
  async function read(path,credential) {
    const response=await fetchImpl(`https://openrouter.ai/api/v1/${path}`,{
      headers:{authorization:`Bearer ${credential}`,accept:'application/json'},
      signal:combined,redirect:'error',cache:'no-store'
    });
    if(!response.ok)throw unavailable();
    const text=await response.text();
    if(text.length>32768)throw unavailable();
    return JSON.parse(text).data;
  }
  try {
    const [account,currentKey]=await Promise.all([read('credits',managementKey),read('key',key)]);
    if(account.total_credits<0||account.total_usage<0)throw unavailable();
    const balance=micro(account.total_credits)-micro(account.total_usage);
    const keyBalance=currentKey.limit_remaining===null?null:micro(currentKey.limit_remaining);
    if(combined.aborted)throw unavailable();
    return {balance,keyBalance,remaining:Math.min(balance,keyBalance??Number.MAX_SAFE_INTEGER)};
  } catch {throw unavailable();}
}

export function createOpenRouterOwnerStatus({credentials,fetchImpl=fetch,now=Date.now}) {
  let cached=null,pending=null;
  return async function status() {
    if(cached&&now()-cached.checkedAt<30000)return cached;
    if(pending)return pending;
    pending=(async()=>{
      try {
        const {balance,keyBalance,remaining}=await readOpenRouterBalance({...credentials(),fetchImpl});
        return cached={state:remaining<=100000?'paused':remaining<500000?'low':'ok',
          balanceUsd:balance/1000000,keyRemainingUsd:keyBalance===null?null:keyBalance/1000000,
          checkedAt:now(),warningThresholdUsd:.5,pauseThresholdUsd:.1};
      } catch {return cached={state:'unknown',checkedAt:now()};}
    })();
    try{return await pending;}finally{pending=null;}
  };
}
