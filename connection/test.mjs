import test from 'node:test';
import {activeWorker} from './registration.mjs';
import {parse as jsParse} from 'acorn';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer as httpServer} from 'node:http';
import {gzipSync} from 'node:zlib';
import {WebSocket,WebSocketServer} from 'ws';
import {indexedDB} from 'fake-indexeddb';
import {Cookies,cookieStore} from './covenant.mjs';
import {constants} from './constants.mjs';
import {runInNewContext} from 'node:vm';
import {EventLines} from './canticle.mjs';
import {parse as htmlParse} from 'parse5';
import {pack, unpack} from './verses.mjs';
import {Transport} from './pilgrimage.mjs';
import {application} from './assembly.mjs';
import {destination, publicAddress} from './sanctuary.mjs';
import {script, stylesheet, document, candidates, content} from './liturgy.mjs';

test('data responses retain valid JSON despite a JavaScript media type',async()=>{
  const input=JSON.stringify({results:[{title:'Example',image:'https://images.test/photo.jpg'}],next:'/results?page=2'});
  const response=await content(new Response(input,{headers:{'content-type':'application/x-javascript; charset=UTF-8'}}),'https://fixture.test/results','/content/test/');
  assert.equal(response.status,200);assert.equal(await response.text(),input);
  const program='globalThis.results={image:"/photo.jpg"};';
  const scriptResponse=await content(new Response(program,{headers:{'content-type':'application/x-javascript'}}),'https://fixture.test/results','/content/test/','script');
  assert.equal(await scriptResponse.text(),program);
});

test('document location transformation preserves local bindings and property names',()=>{
  const location={href:'https://fixture.test/start',pathname:'/start'};
  const context={documentLocation:location,documentOwner:value=>value};
  const input=`const object={location};function local(location){return location;}function other(document){return document.location;}const property={location:17};globalThis.result=[object.location.href,local(23),other({location:31}),property.location,window.location.pathname,document.location.href];location='/next';`;
  runInNewContext(script(input,'https://fixture.test/start','/content/test/'),context);
  assert.deepEqual(Array.from(context.result),['https://fixture.test/start',23,31,17,'/start','https://fixture.test/start']);
  assert.equal(location.href,'/next');
  const loop='for(let fetch of []){fetch("/local")}fetch("/remote");';
  assert.equal(script(loop,'https://fixture.test/','/content/test/'),'for(let fetch of []){fetch("/local")}fetch("/content/test/https%3A%2F%2Ffixture.test%2Fremote");');
});

test('window aliases expose the original location without changing ordinary location properties',()=>{
  const window={},view={location:{search:'?q=waterloo',href:'https://fixture.test/?q=waterloo'}};
  const context={document:{defaultView:window},documentOwner:value=>value===window?view:value};
  const input=`const r=document.defaultView;const ordinary={location:{search:'normal'}};const absent=null;const nested={location:{location:3}};globalThis.result=[r.location.search,ordinary.location.search,absent?.child.location,nested.location.location];r.location='/next';`;
  const output=script(input,'https://fixture.test/?q=waterloo','/content/test/');
  runInNewContext(output,context);
  assert.deepEqual(Array.from(context.result),['?q=waterloo','normal',undefined,3]);
  assert.equal(view.location,'/next');
  jsParse(script('class A{get location(){return 1}}class B extends A{#location=2;read(){return super.location+this.#location}}','https://fixture.test/','/content/test/'),{ecmaVersion:'latest'});
});

test('worker startup follows replacements instead of waiting on a redundant worker',async()=>{
  const registration=new EventTarget(),old=new EventTarget(),next=new EventTarget();
  old.state='installing';next.state='installing';registration.installing=old;
  const ready=activeWorker(registration,{timeout:1000});
  registration.installing=next;old.state='redundant';old.dispatchEvent(new Event('statechange'));
  registration.dispatchEvent(new Event('updatefound'));
  next.state='activated';registration.installing=null;registration.active=next;next.dispatchEvent(new Event('statechange'));
  assert.equal(await ready,next);
  assert.equal(await activeWorker(registration),next);
  const update=new EventTarget();update.state='installing';registration.installing=update;
  let complete=false;const changed=activeWorker(registration).then(worker=>{complete=true;return worker;});
  await Promise.resolve();assert.equal(complete,false);
  update.state='activated';registration.installing=null;registration.active=update;update.dispatchEvent(new Event('statechange'));
  assert.equal(await changed,update);
  await assert.rejects(activeWorker(new EventTarget(),{timeout:5}),/did not start/);
});

test('document edits preserve nested imports, location arguments and large programs',()=>{
  const input='const link=import(location.href);const second=import(import("./module.js"));';
  const output=script(input,'https://fixture.test/start','/content/test/',true);
  assert.match(output,/documentAddress\(globalThis.documentLocation.href/);
  assert.doesNotThrow(()=>jsParse(output,{ecmaVersion:'latest',sourceType:'module'}));
  const large=Array.from({length:10000},(_,i)=>'fetch("/resource/'+i+'");').join('\n');
  const result=script(large,'https://fixture.test/','/content/test/');
  const parsed=jsParse(result,{ecmaVersion:'latest'});
  assert.equal(parsed.body.length,10000);
  for(const index of [0,4999,9999])assert.equal(parsed.body[index].expression.arguments[0].value,'/content/test/https%3A%2F%2Ffixture.test%2Fresource%2F'+index);
});

test('production constant storage preserves text, keys and unmatched UTF-16 units',()=>{
  for(const value of ['plain text '.repeat(100),'\u00e9\ud83d\ude00\ud800'.repeat(100)]){
    const code='({'+JSON.stringify(value)+':'+JSON.stringify(value)+'})';
    const output=runInNewContext(constants(code));
    assert.equal(output[value],value);
    assert.equal(Object.keys(output)[0],value);
  }
});

test('event records survive fragmented line endings and preserve IDs, event types and retry',()=>{
  const events=[],delays=[],lines=new EventLines(value=>events.push(value),value=>delays.push(value));
  for(const character of ':comment\r\nid: first\r\nretry: 12\r\nevent: update\r\ndata: one\r\ndata: two\r\n\r\ndata: next\n\n')lines.write(character);
  assert.deepEqual(events,[{type:'update',data:'one\ntwo',lastEventId:'first'},{type:'message',data:'next',lastEventId:'first'}]);
  assert.deepEqual(delays,[12]);
});

test('cookie persistence is needed only for accepted response cookies',()=>{
  const cookies=new Cookies();
  assert.equal(cookies.receive('https://fixture.test/',[['content-type','text/css']]),false);
  assert.equal(cookies.receive('https://fixture.test/',[['set-cookie','foreign=1; Domain=another.test']]),false);
  assert.equal(cookies.receive('https://fixture.test/',[['set-cookie','session=1; HttpOnly; Secure']]),true);
  assert.equal(cookies.header('https://fixture.test/'),'session=1');
  assert.equal(cookies.visible('https://fixture.test/'),'');
});

test('cookie domains, paths, expiry, secure flags, HttpOnly and persistence',async()=>{
  const cookies=new Cookies();
  cookies.receive('https://one.example.com/folder/page',[
    ['set-cookie','private=secret; Secure; HttpOnly; Path=/'],
    ['set-cookie','theme=dark; Secure; Path=/'],
    ['set-cookie','section=one; Path=/folder'],
    ['set-cookie','parent=shared; Domain=example.com; Path=/'],
    ['set-cookie','invalid=bad; Domain=com; Path=/'],
    ['set-cookie','foreign=bad; Domain=two.example.com; Path=/']
  ]);
  assert.match(cookies.header('https://one.example.com/folder/page'),/private=secret/);
  assert.doesNotMatch(cookies.visible('https://one.example.com/folder/page'),/private|invalid|foreign/);
  assert.equal(cookies.header('https://two.example.com/'),'parent=shared');
  assert.doesNotMatch(cookies.header('http://one.example.com/'),/private|theme|section/);
  cookies.set('https://one.example.com/','private=changed; Path=/');
  assert.match(cookies.header('https://one.example.com/'),/private=secret/);
  assert.doesNotMatch(JSON.stringify(cookies.snapshot('https://one.example.com/')),/secret/);
  cookies.set('https://one.example.com/','theme=; Max-Age=0; Path=/');
  assert.doesNotMatch(cookies.visible('https://one.example.com/'),/theme/);
  cookies.set('https://one.example.com/','js=one; Path=/');
  assert.match(cookies.visible('https://one.example.com/'),/js=one/);
  const store=await cookieStore(indexedDB);
  await store.save('profile-one',cookies);
  assert.match((await store.load('profile-one')).header('https://one.example.com/'),/private=secret/);
  assert.equal((await store.load('profile-two')).header('https://one.example.com/'),'');
  store.close();
});

test('original live channel forwards text, binary, protocols and closes upstream',async()=>{
  const upstream=httpServer(),relay=new WebSocketServer({server:upstream});
  let ended;
  const closed=new Promise(resolve=>ended=resolve);
  relay.on('connection',socket=>{
    socket.on('message',(bytes,binary)=>socket.send(bytes,{binary}));
    socket.on('close',ended);
  });
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const app=application({resolveDestination:async()=>({url:new URL('http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  const origin='http://127.0.0.1:'+app.address().port;
  const socket=new WebSocket(origin.replace('http:','ws:')+'/api/channel',{origin});
  try{
    await once(socket,'open');
    socket.send(pack(1,0,{url:'wss://example.com/live',method:'GET',headers:[['sec-websocket-protocol','example']]}));
    const [opened]=await once(socket,'message');
    assert.deepEqual(unpack(opened).metadata,{status:101,headers:[['sec-websocket-protocol','example']]});
    socket.send('hello');
    const [text,binary]=await once(socket,'message');
    assert.equal(binary,false);assert.equal(text.toString(),'hello');
    socket.send(new Uint8Array([0,254,255]));
    const [bytes,isBinary]=await once(socket,'message');
    assert.equal(isBinary,true);assert.deepEqual([...bytes],[0,254,255]);
    socket.close();
    await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Upstream remained connected')),1500))]);
  }finally{socket.terminate();relay.close();app.closeAllConnections();app.close();upstream.closeAllConnections();upstream.close();}
});

test('transport rejects synthetic activation and requests before interaction', async () => {
  const transport = new Transport();
  assert.throws(() => transport.activate(new Event('click')));
  assert.throws(() => transport.activate({isTrusted:true,type:'click'}));
  await assert.rejects(transport.fetch('https://example.com'), /Start the connection first/);
  assert.equal(transport.active.size,0);
});

test('wire bytes use exact little-endian identity, type, length and metadata', () => {
  const value = pack(0x12345678, 0, {url:'https://example.com',method:'GET',headers:[]}, new Uint8Array([9,8]));
  assert.deepEqual([...value.slice(0,5)], [0x78,0x56,0x34,0x12,0]);
  assert.equal(new DataView(value.buffer).getUint32(5,true), value.length - 11);
  assert.deepEqual(unpack(value).body, new Uint8Array([9,8]));
  assert.throws(() => unpack(value.slice(0,8)));
  const wrong = value.slice(); wrong[5] = 255; assert.throws(() => unpack(wrong));
  assert.throws(() => pack(0, 0, {}));
  assert.throws(() => pack(1, 2, {}));
});

test('destination validation pins only public addresses', async () => {
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','::ffff:127.0.0.1','2001:db8::1']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('1.1.1.1'), true);
  await assert.rejects(destination('file:///test'));
  await assert.rejects(destination('http://user:secret@example.com'));
  await assert.rejects(destination('https://example.com', async () => [{address:'127.0.0.1',family:4}]));
  const result = await destination('https://example.com/a', async () => [{address:'1.1.1.1',family:4}]);
  assert.equal(result.address.address, '1.1.1.1');
  const dual = await destination('https://example.com', async () => [{address:'2606:4700:4700::1111',family:6},{address:'1.1.1.1',family:4}]);
  assert.equal(dual.addresses.length,2);
});

test('HTML, CSS and JS transforms use syntax trees and document base', () => {
  const prefix = '/content/test/';
  const mapped = value => prefix + encodeURIComponent(value);
  const output = document('<html><head><base href="/assets/"><meta http-equiv="Content-Security-Policy" content="script-src none"><style>@import "a.css";.a{background:url(../photo.jpg)}</style></head><body><img src="a.png" srcset="one.png 1x, two.png 2x" data-src="lazy.png"><form action="post"></form><script>fetch("api.json")</script></body></html>', 'https://example.com/docs/page', prefix);
  assert.ok(output.includes(mapped('https://example.com/assets/a.png')));
  assert.ok(output.includes(mapped('https://example.com/assets/api.json')));
  assert.ok(output.includes(mapped('https://example.com/assets/post')));
  assert.ok(output.indexOf('/boot/runtime.js') < output.indexOf('<base'));
  assert.equal(output.includes('Content-Security-Policy'), false);
  assert.ok(stylesheet('@import "a.css";p{background:url("/p.png")}', 'https://example.com/style/main.css',prefix).includes(mapped('https://example.com/style/a.css')));
  const code = script('const url="./late.js"; import(url); fetch("/api"); const a="fetch(\\"untouched\\")";', 'https://example.com/page',prefix,true);
  assert.ok(code.includes('documentAddress(url,'));
  assert.ok(code.includes(mapped('https://example.com/api')));
  assert.ok(code.includes('untouched'));
  const shadowed='function f(fetch){return fetch("leave-me")}const api={fetch(value){return value}};api.fetch("also-unchanged");';
  assert.equal(script(shadowed,'https://example.com/',prefix),shadowed);
  assert.ok(script('function f(){fetch("/yes")}function g(fetch){fetch("/no")}', 'https://example.com/',prefix).includes(mapped('https://example.com/yes')));
  assert.ok(candidates('data:image/png;base64,AAAA 1x, icon.png 2x','https://example.com/',prefix).includes('data:image/png;base64,AAAA 1x'));
  htmlParse(output);
});

test('streams before upstream end; binary bodies, headers, redirects and disconnect abort', async () => {
  let finishSlow, started, cancelled;
  const begun = new Promise(resolve => started = resolve);
  const aborted = new Promise(resolve => cancelled = resolve);
  const upstream = httpServer((req,res) => {
    if (req.url === '/slow') { res.writeHead(200, {'content-type':'text/plain'}); res.write('first'); finishSlow = () => res.end('second'); started(); return; }
    if (req.url === '/cancel') { res.on('close', () => { if (!res.writableEnded) cancelled(); }); res.writeHead(200); res.write('waiting'); return; }
    if (req.url === '/compressed') { res.writeHead(200, {'content-encoding':'gzip'}); res.end(gzipSync('Decoded content')); return; }
    if (req.url === '/broken') { res.writeHead(200); res.write('partial'); setTimeout(() => res.destroy(), 30); return; }
    if (req.url === '/redirect') { res.writeHead(302, {'location':'/next'}); res.end(); return; }
    if (req.url === '/cookies') { res.writeHead(200, {'set-cookie':['a=1','b=2']}); res.end('cookies'); return; }
    const chunks=[]; req.on('data',part=>chunks.push(part)); req.on('end',()=>{res.writeHead(200,{'content-type':'application/octet-stream'});res.end(Buffer.concat(chunks));});
  });
  upstream.listen(0,'127.0.0.1'); await once(upstream,'listening');
  const events=[];
  const app = application({resolveDestination: async value => ({url:new URL(new URL(value).pathname, 'http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}}), observe:(...args)=>events.push(args)});
  app.listen(0,'127.0.0.1'); await once(app,'listening');
  const origin='http://127.0.0.1:'+app.address().port;
  async function request(path, body = new Uint8Array()) {
    const socket = new WebSocket(origin.replace('http:','ws:')+'/api/sync',{origin});
    await once(socket,'open');
    socket.send(pack(1,0,{url:'https://fixture.test'+path,method:body.length?'POST':'GET',headers:[]},body));
    return socket;
  }
  try {
    const socket = await request('/slow'); const received=once(socket,'message');
    await begun;
    for (let count=0;count<100&&!events.some(([name])=>name==='chunk');count++) await new Promise(resolve=>setTimeout(resolve,10));
    assert.ok(events.some(([name])=>name==='chunk'),'a fragment is sent while upstream is still open');
    assert.equal(events.some(([name])=>name==='complete'),false);
    finishSlow(); const [bytes] = await received; assert.equal(new TextDecoder().decode(unpack(bytes).body),'firstsecond'); socket.close();
    for (const path of ['/echo','/redirect','/cookies','/compressed']) {
      const next=await request(path,path==='/echo'?new Uint8Array([0,255,3]):undefined);
      const [bytes]=await once(next,'message'); const result=unpack(bytes);
      if(path==='/echo') assert.deepEqual([...result.body],[0,255,3]);
      if(path==='/redirect') assert.equal(result.metadata.status,302);
      if(path==='/cookies') assert.equal(result.metadata.headers.filter(([key])=>key==='set-cookie').length,2);
      if(path==='/compressed') { assert.equal(new TextDecoder().decode(result.body),'Decoded content'); assert.equal(result.metadata.headers.some(([key])=>key==='content-encoding'),false); }
      next.close();
    }
    const cancel=await request('/cancel');
    await new Promise(resolve=>setTimeout(resolve,100)); cancel.terminate();
    await Promise.race([aborted,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Upstream did not abort')),1500))]);
    const broken=await request('/broken');let completed=false;broken.on('message',()=>{completed=true;});await once(broken,'close');assert.equal(completed,false);
  } finally { app.closeAllConnections(); app.close(); upstream.closeAllConnections(); upstream.close(); }
});

