import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
export function createGameReports({file,catalog,now=Date.now}) {
 const rows=new Map(),limits=new Map(),salt=randomBytes(16),reasons=new Set(['load-error','resource-error','startup-timeout','no-render']);
 let tail=Promise.resolve(),pending=0,loaded=false,globalWindow=0,globalCount=0;
 const prune=()=>{for(const [key,row] of rows)if(now()-row.lastSeen>7*86400000)rows.delete(key);while(rows.size>200)rows.delete(rows.keys().next().value);};
 async function load(){if(loaded)return;loaded=true;try{const data=JSON.parse(await readFile(file,'utf8'));for(const row of data.slice(-200)){const key=`${row.provider}:${row.game}:${row.reason}:${row.brand}`;if(catalog.has(`${row.provider}:${row.game}`)&&reasons.has(row.reason))rows.set(key,row)}}catch{}prune();}
 return {
  async report(input,client,brand){
   if(!input||typeof input.game!=='string'||input.game.length>200||!catalog.has(`${input.provider}:${input.game}`)||!reasons.has(input.reason))return 400;
   const clock=now(),minute=Math.floor(clock/60000),id=createHash('sha256').update(salt).update(String(client)).digest('hex');
   if(globalWindow!==minute){globalWindow=minute;globalCount=0;limits.clear();}
   if(globalCount>=120||(limits.get(id)||0)>=3||pending>=16)return 429;
   limits.set(id,(limits.get(id)||0)+1);globalCount++;pending++;
   const task=tail.then(async()=>{await load();const key=`${input.provider}:${input.game}:${input.reason}:${brand}`;const old=rows.get(key);rows.delete(key);rows.set(key,{provider:input.provider,game:input.game,title:catalog.get(`${input.provider}:${input.game}`),reason:input.reason,brand,count:Math.min(1000000,(old?.count||0)+1),firstSeen:old?.firstSeen||clock,lastSeen:clock});prune();await mkdir(dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify([...rows.values()]),{mode:0o600});await rename(file+'.tmp',file);return 202;}).finally(()=>pending--);
   tail=task.catch(()=>{});return task;
  },
  async list(){await tail;await load();prune();return [...rows.values()].sort((a,b)=>b.lastSeen-a.lastSeen);}
 };
}
