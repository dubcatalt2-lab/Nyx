import {createHash} from 'node:crypto';

// Per-account state across channels/DMs, checked in the message transaction.
// Retain bounded timestamps and hashes, not copies of private message text.
export function chatSendDecision(previous={},text='',now=Date.now()) {
  const recent=(Array.isArray(previous.recent)?previous.recent:[]).filter(item=>Number.isFinite(item.at)&&item.at>now-60000&&item.at<=now).slice(-20);
  if(Number(previous.until)>now)return {state:{recent,until:previous.until},error:'Chat is cooling down. Please wait before sending again.',retryAfter:Math.ceil((previous.until-now)/1000)};
  const normalized=String(text).normalize('NFKC').toLowerCase().replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').replace(/(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,}(?=[/?#]))[^\s<>"']*|[&\u00a7][0-9a-fk-or]/gi,token=>/^[&\u00a7]/.test(token)?'':token).replace(/\s+/g,' ').trim();
  const hash=normalized?createHash('sha256').update(normalized).digest('hex'):'';
  const repeated=hash&&recent.filter(item=>item.hash===hash).length>=2;
  const burst=recent.filter(item=>item.at>now-10000).length>=5;
  if(repeated||burst||recent.length>=20)return {state:{recent,until:now+10000},error:(repeated?'Repeated messages were blocked.':'You are sending messages too quickly.')+' Please wait 10 seconds.',retryAfter:10};
  return {state:{recent:[...recent,{at:now,hash}],until:0}};
}
