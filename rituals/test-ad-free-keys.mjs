import assert from 'node:assert/strict';
import express from 'express';
import {createAdFreeKeys,adFreeStatus,installAdFreeRoutes} from '../scripture/ad-free-keys.mjs';

function memoryDb() {
  const data=new Map();
  let queue=Promise.resolve();
  const snap=ref=>({id:ref.id,exists:data.has(ref.path),data:()=>structuredClone(data.get(ref.path))});
  const collection=name=>({
    doc(id){const ref={id,path:name+'/'+id};return {...ref,get:async()=>snap(ref)};},
    orderBy(){let limit=Infinity,cursor='';const query={limit(n){limit=n;return query;},startAfter(doc){cursor=doc.id;return query;},async get(){let rows=[...data].filter(([key])=>key.startsWith(name+'/')).sort((a,b)=>b[1].createdAtMs-a[1].createdAtMs).map(([key])=>snap({id:key.split('/')[1],path:key}));if(cursor)rows=rows.slice(rows.findIndex(row=>row.id===cursor)+1);return{docs:rows.slice(0,limit)};}};return query;}
  });
  return {data,collection,runTransaction(fn){const task=queue.then(async()=>{const writes=[];const tx={get:async ref=>{assert.equal(writes.length,0,'Firestore reads must precede writes');return snap(ref);},set:(ref,value,options)=>writes.push([ref,structuredClone(value),options?.merge]),create:(ref,value)=>{assert(!data.has(ref.path));writes.push([ref,structuredClone(value),false]);}};const result=await fn(tx);for(const [ref,value,merge] of writes)data.set(ref.path,merge?{...data.get(ref.path),...value}:value);return result;});queue=task.catch(()=>{});return task;}};
}

let now=1800000000000;
const db=memoryDb(),store=createAdFreeKeys(db,()=>now);
const first=await store.create({ownerUid:'owner',durationDays:7,label:'Gift'});
assert.match(first.key,/^NYX-ADFREE-(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/);
assert(!JSON.stringify([...db.data]).includes(first.key),'raw keys never persist');
const race=await Promise.allSettled([store.redeem(first.key,'alice'),store.redeem(first.key,'bob')]);
assert.equal(race.filter(r=>r.status==='fulfilled').length,1,'exactly one account claims a key');
assert(adFreeStatus(db.data.get('nyxUserAdministration/alice'),now).active);
assert.deepEqual(await store.redeem(first.key,'alice'),race[0].value,'same-account retry is idempotent');
const spare=await store.create({ownerUid:'owner'});
await assert.rejects(store.redeem(spare.key,'alice'),e=>e.status===409);
assert.equal(db.data.get('nyxAdFreeKeys/'+spare.id).status,'unused','failed redemption must not consume key');
now+=8*86400000;
assert.equal(adFreeStatus(db.data.get('nyxUserAdministration/alice'),now).active,false);
await store.assign(spare.id,'alice');
await store.revoke(first.id);
assert(adFreeStatus(db.data.get('nyxUserAdministration/alice'),now).active,'revoking an old key preserves the replacement');
await store.revoke(spare.id);
assert.equal(adFreeStatus(db.data.get('nyxUserAdministration/alice'),now).active,false);
await assert.rejects(store.redeem(spare.key,'bob'));
const lifetime=await store.create({ownerUid:'owner',uid:'bob',durationDays:0});
now+=9000*86400000;
assert(adFreeStatus(db.data.get('nyxUserAdministration/bob'),now).active);
await assert.rejects(store.assign(lifetime.id,'alice'),e=>e.status===409);
for(let i=0;i<5;i++)await assert.rejects(store.redeem('invalid','guesser'),e=>e.status===400);
await assert.rejects(store.redeem('invalid','guesser'),e=>e.status===429);
now+=60000;
await assert.rejects(store.redeem('invalid','guesser'),e=>e.status===400);
await assert.rejects(store.create({ownerUid:'owner',durationDays:-1}));
for(let i=0;i<53;i++){now++;await store.create({ownerUid:'owner'});}
const page=await store.list(),next=await store.list(page.nextCursor);
assert.equal(page.keys.length,50);assert(next.keys.length>0);assert(!next.keys.some(r=>page.keys.some(p=>p.id===r.id)));
assert(!JSON.stringify(page).includes('NYX-ADFREE-'));

const app=express();app.use(express.json());
const audit=[];
const user=async req=>{const uid=req.get('authorization')?.replace('Bearer ','');if(!uid)throw Object.assign(new Error('Sign in'),{status:401});return{firebase:{firestore:db,auth:{getUser:async id=>{if(id==='missing')throw Error();return{uid:id};}}},token:{uid}};};
const owner=async req=>{const context=await user(req);if(context.token.uid!=='owner')throw Object.assign(new Error('Owner only'),{status:403});return context;};
installAdFreeRoutes(app,{owner,user,sameOrigin:req=>req.get('origin')!=='https://other.invalid',audit:async(_,entry)=>audit.push(entry)});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const request=(path,uid,body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:body?'POST':'GET',headers:{...(uid?{Authorization:'Bearer '+uid}:{}),'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
try {
  for(const uid of ['', 'member','admin','co_owner','forged-owner']){
    const response=await request('/api/owner-dashboard/ad-free-keys',uid,{durationDays:30});assert.equal(response.status,uid?403:401);
  }
  assert.equal((await request('/api/owner-dashboard/ad-free-keys','owner',{},{Origin:'https://other.invalid'})).status,403);
  assert.equal((await request('/api/owner-dashboard/ad-free-keys','owner',{uid:'missing'})).status,404);
  const createdResponse=await request('/api/owner-dashboard/ad-free-keys','owner',{durationDays:30});assert.equal(createdResponse.status,201);
  const created=await createdResponse.json();
  const redeemed=await request('/api/account/ad-free/redeem','recipient',{key:created.key});assert.equal(redeemed.status,200);assert.equal((await redeemed.json()).publisherMode,'off');
  const revoked=await request(`/api/owner-dashboard/ad-free-keys/${created.id}/revoke`,'owner',{});assert.equal(revoked.status,200);
  assert.equal(adFreeStatus(db.data.get('nyxUserAdministration/recipient')).active,false);
  assert(!JSON.stringify(audit).includes(created.key));
  assert.equal((await request('/api/owner-dashboard/ad-free-keys','owner')).headers.get('cache-control'),'no-store');
  console.log('PASS ad-free creation, hashed storage, single-use concurrency, idempotent retries, assignment, replacement-safe revocation, expiry/lifetime, rate limits, pagination, owner authorization and audit secrecy.');
} finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
