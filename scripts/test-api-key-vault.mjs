import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import express from 'express';
import {createApiKeyVault} from '../lib/api-key-vault.mjs';
import {createKeyStore,installDeveloperApi,passwordDigest} from '../lib/developer-api.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';

const root=await mkdtemp(join(tmpdir(),'nyx-key-vault-'));
let server;
try {
  const file=join(root,'vault.key'),vault=createApiKeyVault(file),db=memoryFirestore();
  let now=Date.now();const store=createKeyStore(db,()=>now,vault);
  const issued=await store.issue('member','device','Test key');
  assert.ok(!JSON.stringify([...db.records]).includes(issued.key),'Database must never contain a plaintext key');
  assert.equal((await readFile(file)).length,32);
  assert.equal((await store.reveal('member','owner')).key,issued.key);
  assert.equal((await createKeyStore(db,()=>now,createApiKeyVault(file)).reveal('member','owner')).key,issued.key,'Vault survives process restart');
  const record=[...db.records].find(([path,v])=>path.includes('/key-')&&v.uid==='member');
  assert.equal(record[1].lastRevealedBy,'owner');
  await assert.rejects(vault.open(record[1].encryptedKey,'another-account'),'Ciphertext is bound to account and key ID');
  const tampered={...record[1].encryptedKey,tag:Buffer.alloc(16).toString('base64')};
  await assert.rejects(vault.open(tampered,'member:test'));
  await createKeyStore(db).issue('legacy','other-device','Old key');
  await assert.rejects(store.reveal('legacy','owner'),/older key/);
  const firebase={firestore:db,auth:{getUser:async uid=>({uid})}},password='fixture-owner-password';
  const digest=await passwordDigest(password),app=express();app.use(express.json());
  installDeveloperApi(app,{keyVault:vault,ownerUid:()=> 'owner',passwordHash:()=>digest,configured:()=>true,
    authenticate:async req=>{const uid=req.get('authorization')?.replace('Bearer ','');if(!['owner','member'].includes(uid))throw Object.assign(Error('Sign in'),{status:401});return {firebase,token:{uid}};},
    sameOrigin:req=>!req.get('origin')||req.get('origin')===`http://${req.get('host')}`,page:(_req,res)=>res.send('API')});
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,uid,body={},cookie='',origin)=>fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+uid,'Content-Type':'application/json',cookie,...(origin?{origin}:{})},body:JSON.stringify(body)});
  const path='/api/developer/owner/account/member/reveal-key';
  assert.equal((await post(path,'member')).status,403);
  assert.equal((await post(path,'owner')).status,403);
  const unlock=await post('/api/developer/unlock','owner',{password}),cookie=unlock.headers.get('set-cookie').split(';')[0];
  assert.equal((await post(path,'member',{},cookie)).status,403);
  assert.equal((await post(path,'owner',{},cookie,'https://foreign.test')).status,403);
  const response=await post(path,'owner',{},cookie);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).key,issued.key);
  const metadata=await fetch(base+'/api/developer/me',{headers:{Authorization:'Bearer member'}});assert.ok(!(await metadata.text()).includes(issued.key));
  await store.revoke('member');await assert.rejects(store.reveal('member','owner'),/no active key/);assert.equal(db.records.get(record[0]).encryptedKey,null);
  assert.equal((await post(path,'owner',{},cookie)).status,404);
  now+=61000;const replacement=await store.issue('member','device','Replacement');assert.notEqual(replacement.key,issued.key);assert.equal((await store.details('member')).balance,1000);
  console.log('PASS: encrypted key storage, restart recovery, tamper/account binding, legacy keys, owner unlock, cross-origin rejection, no-store metadata isolation, revoke and replacement');
} finally {
  server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('nyx-key-vault-'));
  await rm(root,{recursive:true,force:true});
}
