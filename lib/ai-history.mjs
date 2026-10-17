import {createHash,randomUUID} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const safeCount=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const text=value=>typeof value==='string'?value:'';
export async function recordAiExchange(db,uid,{model,prompt,answer,usage,temporary=false,now=Date.now()}) {
  const ref=db.collection('nyxAiHistory').doc(hash(uid));
  await db.runTransaction(async tx=>{
    const previous=(await tx.get(ref)).data()||{};
    const totals={...(previous.models||{})};
    const old=totals[model]||{};
    totals[model]={requests:safeCount(old.requests)+1,input:safeCount(old.input)+safeCount(usage?.input),output:safeCount(old.output)+safeCount(usage?.output),unknownUsage:safeCount(old.unknownUsage)+(usage?0:1)};
    const entries=Array.isArray(previous.entries)?previous.entries.slice(-50):[];
    if(!temporary)entries.push({id:randomUUID(),model,at:now,prompt:text(prompt).slice(0,4000),answer:text(answer).slice(0,12000),truncated:text(prompt).length>4000||text(answer).length>12000});
    while(entries.length>50||Buffer.byteLength(JSON.stringify(entries),'utf8')>500000)entries.shift();
    tx.set(ref,{models:totals,entries,updatedAt:now});
  });
}
export async function readAiActivity(db,uid,rules=[]) {
  const col=db.collection('nyxAiAllowance');
  const [history,models,account,...policies]=await Promise.all([
    db.collection('nyxAiHistory').doc(hash(uid)).get(),col.doc('models-'+hash(uid)).get(),col.doc('account-'+hash(uid)).get(),
    ...rules.map(rule=>col.doc('policy-'+hash(uid+'|'+rule.model)).get())
  ]);
  const a=account.data()||{},today=new Date().toISOString().slice(0,10);
  return {models:history.data()?.models||{},entries:(history.data()?.entries||[]).slice().reverse(),pool:models.data()?.pool||null,
    today:{requests:a.day===today?safeCount(a.requests):0,tokens:a.day===today?safeCount(a.tokens):0},
    limits:rules.map((rule,i)=>{const data=policies[i].data()||{};const resetAt=Number.isFinite(data.start)?data.start+rule.periodDays*86400000:null;return {...rule,used:resetAt>Date.now()?safeCount(data.used):0,resetAt};})};
}
