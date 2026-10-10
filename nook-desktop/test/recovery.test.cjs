const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Engine,parse}=require('../src/engine.cjs');
const {Store}=require('../src/store.cjs');
const {Broker}=require('../src/broker.cjs');
const {observation}=require('../src/observation.cjs');
const {Provider}=require('../src/provider.cjs');
const fixture=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-recovery-'));const project=path.join(root,'project');fs.mkdirSync(project);const store=new Store(':memory:');const broker=new Broker({backup:path.join(root,'backup'),approve:async()=>true});broker.grant(project,4);return {root,project,store,broker};};
test('screenshot wrapper is a validated tool action, never a completed chat message',()=>{
 const json='{"message":"Inspect","tool":"list","args":{"path":""}}';
 assert.equal(parse('<invoke_tool>\n'+json).tool,'list');
 assert.equal(parse('<invoke_tool>'+json+'</invoke_tool>').tool,'list');
 assert.throws(()=>parse('<invoke_tool>'+json+json),/ambiguous/);
 assert.throws(()=>parse('<invoke_tool>{"message":"broken"'),/incomplete/);
 assert.throws(()=>parse('Here is an action: '+json),/invalid action format/);
 assert.throws(()=>parse('{"message":"bad","tool":"command","args":{},"done":true}'),/ambiguous/);
});
test('truncated writes regenerate once, execute only the complete action, then retain evidence in next turn',async()=>{
 const f=fixture(),events=[],requests=[];let step=0;
 const engine=new Engine({...f,emit:e=>events.push(e),provider:{complete:async(_model,messages,_signal,options)=>{
  requests.push({messages:structuredClone(messages),options});
  const replies=[{text:'{"message":"Write","tool":"write","args":{"content":"partial',finishReason:'length'},
   {text:'<invoke_tool>{"message":"Create file","tool":"write","args":{"path":"result.txt","content":"complete","expectedHash":null}}</invoke_tool>'},
   {text:'{"message":"Created result.txt and verified its contents.","done":true}'},
   {text:'{"message":"The earlier write returned a verified file hash.","done":true}'}];return replies[step++];}}});
 try{
  const result=await engine.start({prompt:'Create result.txt',model:'fixture'});assert.equal(result.state,'completed');
  assert.equal(fs.readFileSync(path.join(f.project,'result.txt'),'utf8'),'complete');
  assert.equal(events.filter(e=>e.type==='tool').length,1);
  assert.equal(requests[0].options.maxTokens,8192);assert.equal(requests[1].options.maxTokens,16384);
  await engine.start({prompt:'What happened?',model:'fixture',session:result.session});
  assert(requests[3].messages.some(m=>m.content.includes('UNTRUSTED PREVIOUS TOOL OBSERVATION')&&m.content.includes('verified')));
  assert(!events.some(e=>e.type==='message'&&e.body.text.includes('<invoke_tool>')));
 }finally{f.store.close();}
});
test('repeated output truncation is bounded and reports earlier work accurately',async()=>{
 const f=fixture(),events=[];let calls=0;
 const engine=new Engine({...f,emit:e=>events.push(e),provider:{complete:async()=>++calls===1?{text:'{"message":"Inspect","tool":"list","args":{}}'}:{text:'{"partial":',finishReason:'length'}}});
 try{assert.equal((await engine.start({prompt:'Work',model:'fixture'})).state,'failed');assert.equal(calls,4);assert.equal(events.filter(e=>e.type==='tool').length,1);assert.match(events.filter(e=>e.type==='message').at(-1).body.text,/1 tool actions already returned/);}finally{f.store.close();}
});
test('targeted edits preserve hash checks, single matches, approvals and undo',async()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.project,'index.html'),'<h1>Before</h1>');const before=f.broker.workspace.read('index.html');
  const changed=await f.broker.run('edit',{path:'index.html',oldText:'Before',newText:'After',expectedHash:before.hash});assert(changed.verified);
  await assert.rejects(f.broker.run('edit',{path:'index.html',oldText:'After',newText:'Stale',expectedHash:before.hash}),/changed/);
  assert.equal(f.broker.workspace.undo(changed.id).verified,true);
  f.broker.grant(f.project,2);f.broker.approve=async()=>false;
  await assert.rejects(f.broker.run('edit',{path:'index.html',oldText:'Before',newText:'Denied',expectedHash:before.hash}),{code:'DENIED'});
  assert.equal(f.broker.workspace.read('index.html').content,'<h1>Before</h1>');
 }finally{f.store.close();}
});
test('large observations remain valid JSON and preserve file hashes and command failures',()=>{
 const value=JSON.parse(observation({content:'x'.repeat(100000),hash:'verified-hash',exitCode:1,error:'failed'}));
 assert.equal(value.observation.hash,'verified-hash');assert.equal(value.observation.exitCode,1);assert.equal(value.observation.error,'failed');assert(value.truncated);
});
test('context trimming never drops the current user request',async()=>{
 const f=fixture();let count=0;const original='Remember this exact current task';
 const engine=new Engine({...f,emit:()=>{},provider:{complete:async(_model,messages)=>{assert(messages.some(m=>m.content===original));assert(messages.length<=22);return {text:JSON.stringify(++count<16?{message:'Inspect',tool:'list',args:{}}:{message:'Inspected the directory.',done:true})};}}});
 try{assert.equal((await engine.start({prompt:original,model:'fixture'})).state,'completed');}finally{f.store.close();}
});
test('provider output budgets and length-only reasoning responses reach recovery',async()=>{
 const provider=new Provider({file:'unused',safeStorage:{}});provider.request=async(_route,body)=>{assert.equal(body.max_tokens,16384);return {choices:[{message:{content:null},finish_reason:'length'}]};};
 assert.equal((await provider.complete('fixture',[],undefined,{maxTokens:999999})).finishReason,'length');
});

test('ranged reads preserve the full-file hash and can edit beyond the observation limit',async()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.project,'large.html'),'x'.repeat(22000)+'<h1>Before</h1>'+'z'.repeat(22000));
  const read=await f.broker.run('read',{path:'large.html',offset:22000,limit:15});
  assert.equal(read.content,'<h1>Before</h1>');assert.equal(read.hash,f.broker.workspace.read('large.html').hash);assert(read.truncated);
  await f.broker.run('edit',{path:'large.html',oldText:'<h1>Before</h1>',newText:'<h1>After</h1>',expectedHash:read.hash});
  assert.equal(f.broker.workspace.read('large.html').content,'x'.repeat(22000)+'<h1>After</h1>'+'z'.repeat(22000));
  await assert.rejects(f.broker.run('read',{path:'large.html',offset:-1}),/nonnegative/);
 }finally{f.store.close();}
});
test('stopping a recovering provider response never executes its eventual action',async()=>{
 const f=fixture(),events=[];let started,release;
 const waiting=new Promise(resolve=>started=resolve),reply=new Promise(resolve=>release=resolve);let calls=0;
 const engine=new Engine({...f,emit:e=>events.push(e),provider:{complete:async()=>{if(++calls===1)return {text:'partial',finishReason:'length'};started();return reply;}}});
 try{
  const running=engine.start({prompt:'Work',model:'fixture'});await waiting;engine.stop();release({text:'{"message":"Write","tool":"write","args":{"path":"bad.txt","content":"bad","expectedHash":null}}'});
  assert.equal((await running).state,'cancelled');assert.equal(events.filter(e=>e.type==='tool').length,0);assert(!fs.existsSync(path.join(f.project,'bad.txt')));
 }finally{f.store.close();}
});
test('a denied recovered action is never retried',async()=>{
 const f=fixture();f.broker.grant(f.project,2);f.broker.approve=async()=>false;let calls=0;
 const engine=new Engine({...f,emit:()=>{},provider:{complete:async()=>({text:++calls===1?'broken {"tool":':'{"message":"Write","tool":"write","args":{"path":"bad.txt","content":"bad","expectedHash":null}}'})}});
 try{assert.equal((await engine.start({prompt:'Work',model:'fixture'})).state,'failed');assert.equal(calls,2);assert(!fs.existsSync(path.join(f.project,'bad.txt')));}finally{f.store.close();}
});
test('persisted evidence remains valid structured data after reopening a session',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-history-')),file=path.join(root,'state.sqlite');let store=new Store(file);
 const task=store.create('Inspect'),session=store.workspace.session('','Inspect');store.workspace.link(task,session);
 store.event(task,'result',{tool:'read',result:{path:'large.txt',hash:'full-hash',content:'a'.repeat(10000),parts:Array.from({length:50},()=>('b'.repeat(2000)))}});store.close();store=new Store(file);
 try{const history=store.workspace.history(session);assert.equal(history.length,1);const data=JSON.parse(history[0].content.replace('UNTRUSTED PREVIOUS TOOL OBSERVATION: ',''));assert.equal(data.hash,'full-hash');assert(data.truncated);}finally{store.close();}
});
