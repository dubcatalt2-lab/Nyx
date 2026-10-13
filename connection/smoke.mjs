import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import {application} from './assembly.mjs';
import {WebSocketServer} from 'ws';

const upstream = createServer((request, response) => {
  const path = new URL(request.url, 'http://fixture').pathname;
  const send = (type, body) => {response.writeHead(200, {'content-type':type});response.end(body);};
  if (path === '/static') return send('text/html', '<!doctype html><html><head><title>Static lesson</title></head><body><h1>Static lesson</h1><a href="/styled">Next</a></body></html>');
  if (path === '/styled') return send('text/html', '<!doctype html><html><head><base href="/assets/"><link rel="stylesheet" href="main.css"></head><body><h1>Styled lesson</h1><div id="sample">Styled</div></body></html>');
  if (path === '/assets/main.css') return send('text/css', '@import "detail.css";#sample{color:rgb(18,52,86);background-image:url("photo.svg");width:100px;height:100px}');
  if (path === '/assets/detail.css') return send('text/css', '#sample{border-top:3px solid rgb(18,52,86)}');
  if (path === '/assets/photo.svg') return send('image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
  if (path === '/interactive') return send('text/html', '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src none"><script src="/logic.js" defer></script></head><body><h1>Interactive lesson</h1><output id="result"></output><output id="module"></output><output id="request"></output><output id="xhr"></output><output id="worker"></output><output id="moduleworker"></output></body></html>');
  if (path === '/logic.js') return send('application/javascript', 'const endpoint="/data";fetch(endpoint).then(r=>r.json()).then(v=>document.querySelector("#result").textContent=v.message);const mod="/module.js";import(mod).then(v=>document.querySelector("#module").textContent=v.answer);fetch(new Request("/data")).then(r=>r.json()).then(v=>document.querySelector("#request").textContent=v.message);const x=new XMLHttpRequest();x.open("GET","/data");x.onload=()=>document.querySelector("#xhr").textContent=JSON.parse(x.responseText).message;x.send();for(const kind of ["classic","module"]){const w=new Worker("/task.js",{type:kind});w.onmessage=e=>{document.querySelector(kind==="classic"?"#worker":"#moduleworker").textContent=e.data;w.terminate()};}');
  if (path === '/module.js') return send('application/javascript', 'export const answer="Module loaded";');
  if (path === '/task.js') return send('application/javascript', 'fetch("/data").then(r=>r.json()).then(v=>postMessage(v.message));');
  if (path === '/shared.js') return send('application/javascript', 'let connections=0;onconnect=event=>{const port=event.ports[0],number=++connections;fetch("/data").then(r=>r.json()).then(value=>port.postMessage({number,message:value.message}));};');
  if (path === '/data') return send('application/json', '{"message":"Loaded through transport"}');
  if (path === '/navigation') return send('text/html','<!doctype html><html><head><title>Navigation lesson</title></head><body><h1>Navigation lesson</h1><button id="state" onclick="history.pushState({lesson:2},\'\',\'/folder/state?lesson=2#read\');document.querySelector(\'output\').textContent=location.pathname+location.search+location.hash;fetch(\'received\').then(r=>r.json()).then(v=>document.querySelector(\'output\').dataset.loaded=String(v.cookies!==undefined))">Next section</button><button id="assign" onclick="window.location=\'/static\'">Next document</button><button id="replace" onclick="location.replace(\'/styled\')">Replace document</button><output></output><form action="/submitted" method="get"><input name="lesson" value="waterloo"><button>Submit lesson</button></form></body></html>');
  if (path === '/submitted') return send('text/html','<!doctype html><html><head><title>Submitted lesson</title></head><body><h1>'+new URL(request.url,'https://fixture.test').searchParams.get('lesson')+'</h1><script>document.body.dataset.address=location.search;</script></body></html>');
  if(path==='/filters')return send('text/html',`<!doctype html><title>Results</title><h1>Search filters</h1><nav></nav><output></output><script>const view=document.defaultView;function state(){const current=view.location;return {pathname:current.pathname,search:current.search,hash:current.hash}}for(const name of ['Images','Videos','All']){const values=new URLSearchParams(state().search);values.set('type',name.toLowerCase());const link=document.createElement('a');link.textContent=name;link.href='/filters?'+values;document.querySelector('nav').append(link)}document.querySelector('output').textContent=state().search;</script>`);
  if(path==='/signin'){
    response.writeHead(302,{location:'/cookies','set-cookie':['account=fixture; HttpOnly; Secure; Path=/','theme=dark; Secure; Path=/']});
    response.end();return;
  }
  if(path==='/cookies')return send('text/html','<!doctype html><html><head><title>Cookie fixture</title></head><body><h1>Cookie fixture</h1></body></html>');
  if(path==='/folder/cookies'){
    response.setHeader('set-cookie','section=one; Secure; Path=/folder');
    return send('text/html','<!doctype html><html><head><base href="https://assets.test/assets/"></head><body><h1>Base fixture</h1></body></html>');
  }
  if(path==='/received'||path==='/folder/received')return send('application/json',JSON.stringify({cookies:request.headers.cookie||''}));
  if(path==='/events'){
    response.writeHead(200,{'content-type':'text/event-stream'});
    if(request.headers['last-event-id']==='first'){
      response.write('event: update\r\ndata: resumed\r\n\r\n');
      const timer=setTimeout(()=>response.end(),5000);
      response.on('close',()=>clearTimeout(timer));
    }else{
      response.write('id: first\r\nretry: 20\r\ndata: one\r');
      const timer=setTimeout(()=>response.end('\n\r\n'),50);
      response.on('close',()=>clearTimeout(timer));
    }
    return;
  }
  if (path === '/redirect') {response.writeHead(302, {location:'/static'});response.end();return;}
  response.writeHead(404);response.end('Fixture missing');
});
const sockets=new WebSocketServer({server:upstream});
sockets.on('connection',socket=>socket.on('message',(bytes,binary)=>socket.send(bytes,{binary})));
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
let connections = 0, first = 0;
const app = application({resolveDestination: async value => ({url:new URL(new URL(value).pathname+new URL(value).search, 'http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
app.on('upgrade',()=>{connections++;first ||= Date.now();});
app.listen(0,'127.0.0.1');await once(app,'listening');
const browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
page.on('requestfailed',request=>errors.push(request.url()+': '+request.failure()?.errorText));
try {
  await page.goto('http://127.0.0.1:'+app.address().port);
  await page.waitForTimeout(300);
  assert.equal(connections,0);
  async function open(path, selector, text) {
    await page.locator('input').fill('https://fixture.test'+path);
    const clicked = Date.now();
    await page.getByRole('button',{name:'Open',exact:true}).click();
    const frame = page.frameLocator('iframe');
    await frame.locator(selector).filter({hasText:text}).waitFor({timeout:30000});
    return {frame,clicked};
  }
  let result=await open('/static','h1','Static lesson');
  assert.ok(first-result.clicked>=0 && first-result.clicked<1900, 'activation delay '+(first-result.clicked));
  console.log('PASS static HTML: heading rendered; zero console errors; first socket '+(first-result.clicked)+'ms after click');
  result=await open('/styled','h1','Styled lesson');
  await result.frame.locator('#sample').evaluate(element=>Promise.all([...document.styleSheets].map(sheet=>sheet.href)).then(()=>element));
  await page.waitForTimeout(400);
  const style=await result.frame.locator('#sample').evaluate(element=>({color:getComputedStyle(element).color,border:getComputedStyle(element).borderTopWidth,image:getComputedStyle(element).backgroundImage}));
  assert.equal(style.color,'rgb(18, 52, 86)');
  assert.equal(style.border,'3px');
  assert.ok(style.image.includes('photo.svg'));
  console.log('PASS external CSS: base URL, @import and url() rendered; zero console errors');
  result=await open('/interactive','h1','Interactive lesson');
  for (const id of ['result','request','xhr','worker','moduleworker']) await result.frame.locator('#'+id).filter({hasText:'Loaded through transport'}).waitFor({timeout:20000});
  await result.frame.locator('#module').filter({hasText:'Module loaded'}).waitFor({timeout:20000});
  console.log('PASS JavaScript: dynamic fetch, Request, XMLHttpRequest, import(), classic and module workers completed; zero console errors');
  const parallel = await result.frame.locator('body').evaluate(async () => Promise.all(Array.from({length:40},async()=>{
    const response = await fetch('/data');
    return (await response.json()).message;
  })));
  assert.equal(parallel.length,40);
  assert.ok(parallel.every(value=>value==='Loaded through transport'));
  console.log('PASS 40 concurrent document requests: queued without dropping resources');
  for (const type of ['classic','module']) {
    const shared = await result.frame.locator('body').evaluate(async (_element, type) => {
      const workers = [new SharedWorker('/shared.js',{name:type,type}),new SharedWorker('/shared.js',{name:type,type})];
      const values = await Promise.all(workers.map(worker => new Promise((resolve,reject) => {
        const timer = setTimeout(()=>reject(new Error('Shared worker timed out')),10000);
        worker.port.onmessage = event => {clearTimeout(timer);resolve(event.data);};
        worker.onerror = event => {clearTimeout(timer);reject(new Error(event.message || 'Shared worker failed'));};
      })));
      workers.forEach(worker=>worker.port.close());
      return values;
    }, type);
    assert.deepEqual(shared.map(value=>value.number).sort(),[1,2]);
    assert.ok(shared.every(value=>value.message==='Loaded through transport'));
    console.log('PASS '+type+' SharedWorker: two ports share one instance; nested fetch completes');
  }
  await open('/redirect','h1','Static lesson');
  console.log('PASS Location redirect');
  result=await open('/navigation','h1','Navigation lesson');
  await result.frame.locator('#state').click();
  await result.frame.locator('output[data-loaded="true"]').waitFor();
  assert.equal(await result.frame.locator('output').textContent(),'/folder/state?lesson=2#read');
  await page.waitForFunction(()=>document.querySelector('input').value==='https://fixture.test/folder/state?lesson=2#read');
  await result.frame.locator('#assign').click();
  await result.frame.getByRole('heading',{name:'Static lesson',exact:true}).waitFor();
  result=await open('/navigation','h1','Navigation lesson');
  await result.frame.locator('#replace').click();
  await result.frame.getByRole('heading',{name:'Styled lesson',exact:true}).waitFor();
  result=await open('/navigation','h1','Navigation lesson');
  await result.frame.getByRole('button',{name:'Submit lesson',exact:true}).click();
  await result.frame.getByRole('heading',{name:'waterloo',exact:true}).waitFor();
  assert.equal(await result.frame.locator('body').getAttribute('data-address'),'?lesson=waterloo');
  console.log('PASS location assignment, replace, history state, relative fetch after navigation and GET form query preservation');
  result=await open('/filters?q=waterloo','h1','Search filters');
  for(const name of ['Images','Videos','All']){
    await result.frame.getByRole('link',{name,exact:true}).click();
    await result.frame.locator('output').filter({hasText:'type='+name.toLowerCase()}).waitFor();
    assert.match(await result.frame.locator('output').textContent(),/q=waterloo/);
  }
  console.log('PASS Images, Videos and All filter clicks preserve the search query through a window alias');
  result=await open('/signin','h1','Cookie fixture');
  let received=await result.frame.locator('body').evaluate(async()=>({visible:document.cookie,sent:await fetch('/received').then(response=>response.json())}));
  assert.equal(received.visible,'theme=dark');
  assert.match(received.sent.cookies,/account=fixture/);
  await result.frame.locator('body').evaluate(()=>{document.cookie='client=yes; Path=/';if(!document.cookie.includes('client=yes'))throw new Error('Cookie setter must update synchronously');});
  await page.waitForTimeout(200);
  received=await result.frame.locator('body').evaluate(()=>fetch('/received').then(response=>response.json()));
  assert.match(received.cookies,/client=yes/);
  assert.match(received.cookies,/account=fixture/);
  await page.reload();
  result=await open('/cookies','h1','Cookie fixture');
  received=await result.frame.locator('body').evaluate(async()=>({visible:document.cookie,sent:await fetch('/received').then(response=>response.json())}));
  assert.match(received.visible,/client=yes/);
  assert.doesNotMatch(received.visible,/account/);
  assert.match(received.sent.cookies,/account=fixture/);
  const omitted=await result.frame.locator('body').evaluate(()=>fetch('/received',{credentials:'omit'}).then(response=>response.json()));
  assert.equal(omitted.cookies,'');
  console.log('PASS cookie redirect, HttpOnly exclusion, synchronous document.cookie, credentials omission and profile persistence after reload');
  const live=await result.frame.locator('body').evaluate(()=>new Promise((resolve,reject)=>{
    const connection=new WebSocket('wss://fixture.test/live','example');
    connection.binaryType='arraybuffer';
    const values=[];
    connection.onopen=()=>{connection.send('hello');connection.send(new Uint8Array([0,254,255]));};
    connection.onerror=()=>reject(new Error('Live connection failed'));
    connection.onmessage=event=>{
      values.push(typeof event.data==='string'?event.data:[...new Uint8Array(event.data)]);
      if(values.length===2){connection.close(1000,'Finished');resolve({values,protocol:connection.protocol,url:connection.url});}
    };
    setTimeout(()=>reject(new Error('Live connection timed out')),10000);
  }));
  assert.deepEqual(live,{values:['hello',[0,254,255]],protocol:'example',url:'wss://fixture.test/live'});
  console.log('PASS runtime WebSocket API: text, binary, requested protocol, URL and close');
  const streamed=await result.frame.locator('body').evaluate(()=>new Promise((resolve,reject)=>{
    const events=new EventSource(documentAddress('/events')),values=[];
    const timer=setTimeout(()=>{events.close();reject(new Error('Event stream timed out'));},10000);
    events.onmessage=event=>values.push({data:event.data,id:event.lastEventId});
    events.addEventListener('update',event=>{
      values.push({data:event.data,id:event.lastEventId});events.close();clearTimeout(timer);resolve({values,state:events.readyState});
    });
  }));
  assert.deepEqual(streamed,{values:[{data:'one',id:'first'},{data:'resumed',id:'first'}],state:2});
  console.log('PASS incremental EventSource records, fragmented CRLF, server retry, Last-Event-ID reconnect, named events and explicit close');
  result=await open('/folder/cookies','h1','Base fixture');
  const scoped=await result.frame.locator('body').evaluate(async()=>{
    const initial=document.cookie;
    document.cookie='section=two; Secure; Path=/folder';
    const immediate=document.cookie;
    const sent=await fetch('https://fixture.test/folder/received',{credentials:'include'}).then(response=>response.json());
    return {initial,immediate,sent};
  });
  assert.match(scoped.initial,/section=one/);
  assert.match(scoped.immediate,/section=two/);
  assert.match(scoped.sent.cookies,/section=two/);
  console.log('PASS foreign document base does not change cookie domain or path');
  assert.deepEqual(errors,[]);
  console.log('PASS browser smoke: 3 pages, 0 console errors, 0 failed requests; original transport and original transformation only');
} catch(error) {
  console.error(JSON.stringify({errors,frames:page.frames().map(frame=>frame.url()),status:await page.locator('output').textContent()},null,2));
  throw error;
} finally {await browser.close();sockets.close();app.closeAllConnections();app.close();upstream.closeAllConnections();upstream.close();}

