import {createHmac,createHash,timingSafeEqual,randomBytes} from 'node:crypto';

export function createHostingSessions({secret,now=Date.now}={}){
 const fallback=randomBytes(32);secret ||= async()=>fallback;
 const sign=(key,body)=>createHmac('sha256',key).update('nyx.host.session.v1:'+body).digest('hex');
 async function read(token,origin,{renew=false}={}){
  if(typeof token!=='string'||token.length>1500)return null;
  const [body,signature,...extra]=token.split('.');
  if(extra.length||!body||!/^[a-f0-9]{64}$/.test(signature||''))return null;
  const expected=sign(await secret(),body);
  if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex')))return null;
  let value;try{value=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));}catch{return null;}
  if(value.v!==1||value.origin!==origin||!/^[a-f0-9]{32}$/.test(value.id||'')||!Number.isSafeInteger(value.until)||(!renew&&value.until<=now()))return null;
  return value;
 }
 async function issue({origin,client,cookie='',previous=''}){
  if(!/^[a-f0-9]{32}$/.test(client||''))throw Object.assign(Error('Invalid connection identity.'),{status:400});
  const key=await secret(),prior=await read(previous,origin,{renew:true});
  const raw=String(cookie).split(';').map(v=>v.trim()).find(v=>v.startsWith('nyx_q74bd9='))?.slice(11)||'';
  const match=/^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(raw);
  const expected=match&&createHmac('sha256',key).update('nyx_q74bd9:'+match[1]).digest('hex');
  const existing=match&&timingSafeEqual(Buffer.from(match[2],'hex'),Buffer.from(expected,'hex'))?match[1]:null;
  const id=existing||prior?.id||createHmac('sha256',key).update('nyx.host.client.v1:'+origin+':'+client).digest('hex').slice(0,32);
  const body=Buffer.from(JSON.stringify({v:1,origin,id,until:now()+86400000})).toString('base64url');
  return body+'.'+sign(key,body);
 }
 return {read,issue,identity:value=>createHash('sha256').update(value.id).digest('hex')};
}
