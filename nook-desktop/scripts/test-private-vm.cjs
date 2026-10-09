const assert=require('node:assert/strict');
const {PrivateVM}=require('../src/vm.cjs');
const {Broker}=require('../src/broker.cjs');
const {Engine}=require('../src/engine.cjs');
const {Store}=require('../src/store.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
  const vm=new PrivateVM(),info=await vm.status();assert.equal(info.user,'nook-agent');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-livevm-')),store=new Store(path.join(root,'tasks.sqlite'));
  const broker=new Broker({backup:root,approve:async()=>true});await broker.grantVM(vm);
  const name='test-'+Date.now()+'.txt';
  const write=await broker.run('write',{path:name,content:'guest-only',expectedHash:null});assert(write.verified);
  assert.equal((await broker.run('read',{path:name})).content,'guest-only');
  await assert.rejects(broker.run('read',{path:'../private'}),/outside/);
  await assert.rejects(broker.run('write',{path:name,content:'conflict',expectedHash:null}),/changed/);
  await broker.run('undo',{id:write.id});
  const replies=[{message:'Check VM',tool:'command',args:{shell:'bash',command:'uname -s; id -un; pwd',cwd:''}},{message:'Verified guest',done:true}],requests=[];
  const engine=new Engine({provider:{complete:async(model,messages)=>{requests.push(structuredClone(messages));return {text:JSON.stringify(replies.shift())};}},broker,store,emit:()=>{}});
  try{assert.equal((await engine.start({prompt:'Check the private VM',model:'fixture'})).state,'completed');assert.match(requests[1].at(-1).content,/Linux/);assert.match(requests[1].at(-1).content,/nook-agent/);assert.match(requests[1].at(-1).content,/workspace/);}finally{store.close();}
  const controller=new AbortController(),start=Date.now();setTimeout(()=>controller.abort(),500);
  await assert.rejects(broker.run('command',{shell:'bash',command:'sleep 20'},controller.signal),/Stopped/);assert(Date.now()-start<5000);
  await new Promise(resolve=>setTimeout(resolve,500));
  const remaining=await broker.run('command',{shell:'bash',command:"pgrep -f '^sleep 20$' >/dev/null && exit 1; printf stopped"});assert.equal(remaining.exitCode,0);
  const auth=await fetch('http://127.0.0.1:48764/status',{method:'POST',body:'{}'});assert.equal(auth.status,403);
  console.log('PASS actual private Debian VM: authenticated guest-only files, conflict/undo, agent-driven bash, unprivileged identity, cancellation and anonymous denial');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
