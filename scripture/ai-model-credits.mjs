import {createHash} from 'node:crypto';
import {assignableAiModels} from './ai-model-policy.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const modelCreditRef=(db,uid)=>db.collection('nyxAiAllowance').doc('models-'+hash(uid));
export async function addModelCredits(db,uid,{model,credits,requestId}) {
  if(!assignableAiModels.includes(model)||!Number.isSafeInteger(credits)||credits<1||credits>10000000||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId||''))throw Object.assign(Error('Choose a model and 1-10,000,000 token credits.'),{status:400});
  const ref=modelCreditRef(db,uid),receipt=db.collection('nyxAiCreditGrants').doc(hash(uid+'|'+requestId));
  return db.runTransaction(async tx=>{
    const [snapshot,previous]=await Promise.all([tx.get(ref),tx.get(receipt)]);
    if(previous.exists){if(previous.data().model!==model||previous.data().credits!==credits)throw Object.assign(Error('This credit request was already used.'),{status:409});return;}
    const balance=snapshot.data()?.credits||{},current=Number.isSafeInteger(balance[model])?balance[model]:0;
    if(current+credits>100000000)throw Object.assign(Error('This model already has the maximum credit balance.'),{status:400});
    tx.set(ref,{credits:{...balance,[model]:current+credits}},{merge:true});
    tx.set(receipt,{model,credits,createdAt:Date.now()});
  });
}
