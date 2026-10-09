const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Connections} = require('../src/connections.cjs');
const {ConnectedBroker} = require('../src/connected-broker.cjs');
const {Broker} = require('../src/broker.cjs');
const {Engine, parse} = require('../src/engine.cjs');
const {Store} = require('../src/store.cjs');
test('GitHub actions use argument arrays, preserve existing directories and never retrieve tokens',async()=>{
  const calls=[], root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-github-'));
  const c=new Connections({find:name=>name,run:async(executable,args)=>{calls.push({executable,args});return {exitCode:0,stdout:args[0]==='api'?'fixture-user\n':args[1]==='list'?'[]':'',stderr:''};}});
  assert.deepEqual(await c.status(),{connected:true,login:'fixture-user'});
  await c.login();assert.deepEqual(await c.repositories(),[]);
  await c.clone('owner/repo',path.join(root,'repo'));
  await assert.rejects(c.clone('owner/repo',root),/already exists/);
  await assert.rejects(c.clone('owner/repo;whoami',path.join(root,'bad')),/owner\/name/);
  assert(calls.some(item=>item.args.join(' ')==='auth setup-git --hostname github.com'));
  assert(!calls.some(item=>item.args.includes('token')));
  assert.deepEqual(calls.find(item=>item.args[1]==='clone').args,['repo','clone','owner/repo',path.join(root,'repo')]);
});
test('selected Windows folder stays primary; only explicit website/test actions use VM',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-primary-')), project=path.join(root,'project');fs.mkdirSync(project);fs.writeFileSync(path.join(project,'local.txt'),'on Windows');
  const local=new Broker({backup:path.join(root,'backups'),approve:async()=>true});local.grant(project,3);
  let vmCalls=0;
  const connected=new ConnectedBroker({local,config:path.join(root,'absent'),directory:root,approve:async()=>true,vmFactory:()=>({run:async()=>{vmCalls++;return {text:'Example Domain'};}})});
  assert.equal(connected.status().target,'local');
  assert.equal((await connected.run('read',{path:'local.txt'})).content,'on Windows');
  assert.equal(vmCalls,0);
  assert.equal((await connected.run('browser',{url:'https://example.com'})).text,'Example Domain');assert.equal(vmCalls,1);
  local.revoke();await assert.rejects(connected.run('test.prepare',{}),/approve project access/);
});
test('final answers retain actual answer fields and progress-only completion is repaired',async()=>{
  assert.equal(parse('{"message":"Summarizing what I found.","answer":"The page contains a mathematics curriculum.","done":true}').message,'The page contains a mathematics curriculum.');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-final-')),store=new Store(path.join(root,'test.sqlite')),events=[];
  const responses=[{message:'Opening the website.',tool:'browser',args:{url:'https://example.com'}},{message:'I opened the page. Summarizing what it shows.',done:true},{message:'Example Domain is a sample domain used in documentation.',done:true}];
  const engine=new Engine({provider:{complete:async()=>({text:JSON.stringify(responses.shift())})},broker:{status:()=>({target:'local'}),run:async()=>({text:'Example Domain. This domain is for use in illustrative examples.'})},store,emit:event=>events.push(event)});
  try{assert.equal((await engine.start({prompt:'What is this page?',model:'fixture'})).state,'completed');assert.match(events.filter(event=>event.type==='message').at(-1).body.text,/sample domain/);assert(!events.some(event=>event.body?.text==='I opened the page. Summarizing what it shows.'));}finally{store.close();}
});
test('repeated progress-only replies fail visibly instead of reporting Done',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nook-noresult-')),store=new Store(path.join(root,'test.sqlite')),events=[];
  const engine=new Engine({provider:{complete:async()=>({text:JSON.stringify({message:'I will check the website.',done:true})})},broker:{status:()=>({})},store,emit:event=>events.push(event)});
  try{assert.equal((await engine.start({prompt:'Check this page',model:'fixture'})).state,'failed');assert.match(events.filter(event=>event.type==='message').at(-1).body.text,/could not finish/);}finally{store.close();}
});
