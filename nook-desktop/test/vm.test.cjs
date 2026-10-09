const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {PrivateVM}=require('../src/vm.cjs');
const {Broker}=require('../src/broker.cjs');
test('private VM authenticates only to loopback, rejects redirects and cancels remote work',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-vm-')),config=path.join(root,'config.json'),calls=[];
  fs.writeFileSync(config,JSON.stringify({port:48764,token:'a'.repeat(64)}));
  const vm=new PrivateVM({config,fetcher:async(url,options)=>{calls.push({url,options});if(url.endsWith('/status'))return Response.json({service:'nook-private-vm',platform:'linux',root:'/home/nook-agent/workspace'});if(url.endsWith('/cancel'))return Response.json({cancelled:true});return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));}});
  assert.equal((await vm.status()).platform,'linux');
  const abort=new AbortController(),pending=vm.run('command',{command:'sleep 20',shell:'bash'},abort.signal);abort.abort();await assert.rejects(pending,/Stopped/);
  assert(calls.some(x=>x.url.endsWith('/cancel')));
  assert(calls.every(x=>x.url.startsWith('http://127.0.0.1:48764/')&&x.options.redirect==='error'&&x.options.headers.Authorization==='Bearer '+'a'.repeat(64)));
});
test('VM broker routes file/command tools to guest, denies Windows tools and rechecks approval revocation',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-vmbroker-'));let allow=true,after=()=>{},calls=[];
  const broker=new Broker({backup:root,approve:async()=>{after();return allow;}});
  const vm={status:async()=>({root:'/home/nook-agent/workspace'}),run:async(tool,args)=>{calls.push({tool,args});return {exitCode:0,stdout:'guest',stderr:''};}};
  await broker.grantVM(vm);assert.equal(broker.status().target,'vm');
  await broker.run('command',{command:'uname',shell:'bash'});assert.equal(calls.length,1);
  await assert.rejects(broker.run('ui.inspect',{pid:1}),/unavailable/);
  await assert.rejects(broker.run('elevate',{command:'anything'}),/outside/);
  allow=false;await assert.rejects(broker.run('write',{path:'x',content:'x'}),/declined/);
  allow=true;after=()=>broker.revoke();await assert.rejects(broker.run('command',{command:'echo nope',shell:'bash'}),/permissions changed/);assert.equal(calls.length,1);
});
