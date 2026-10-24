import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {chromium} from 'playwright';
const app=express();app.use(express.json());
const server=createServer(app),io=new Server(server),sessions=new Map();let sequence=0;
const channels=[{id:'lounge',name:'Lounge'}];
const identity=uid=>({uid,displayName:uid,handle:'@'+uid,role:'member'});
const uid=req=>String(req.headers.authorization||'').replace('Bearer ','');
const snapshot=()=>({channels,participants:[...sessions.values()]});
function signal(from,value){const sender=sessions.get(from),target=sessions.get(value.toUid);if(sender&&target)io.to(value.toUid).emit('nyx:voice:signal',{...value,id:String(++sequence),fromUid:from,fromSessionId:sender.sessionId,toSessionId:target.sessionId,from:sender});}
io.on('connection',socket=>{const from=socket.handshake.auth.token;socket.join(from);socket.on('nyx:voice:signal',(value,ack)=>{signal(from,value);ack({ok:true})});});
app.get('/api/chat/voice/state',(req,res)=>res.json({...snapshot(),joined:sessions.get(uid(req))?.sessionId===req.query.sessionId}));
app.post('/api/chat/voice/join',(req,res)=>{sessions.set(uid(req),{...identity(uid(req)),...req.body});res.json({...snapshot(),joined:true});io.emit('nyx:voice:refresh')});
app.post('/api/chat/voice/signal',(req,res)=>{signal(uid(req),req.body);res.json({ok:true})});
app.post('/api/chat/voice/leave',(req,res)=>{sessions.delete(uid(req));res.json({ok:true});io.emit('nyx:voice:refresh')});
if(process.env.NYX_TEST_ASSET_ORIGIN) app.use(async(req,res,next)=>{
 if(req.method!=='GET')return next();
 try {const upstream=await fetch(new URL(req.originalUrl,process.env.NYX_TEST_ASSET_ORIGIN));res.status(upstream.status).type(upstream.headers.get('content-type')||'application/octet-stream').send(Buffer.from(await upstream.arrayBuffer()));}
 catch(error){next(error);}
});
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.NYX_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}`;
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8');
const moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pages=[],errors=[];
try {
 for(const name of ['Alice','Bob','Carol']) {
  const page=await browser.newPage({viewport:{width:1280,height:850}});pages.push(page);page.setDefaultTimeout(15000);console.log('Opening',name);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.testConnections=[];
   const Peer=window.RTCPeerConnection;
   window.RTCPeerConnection=new Proxy(Peer,{construct(target,args){const peer=new target(...args);testConnections.push(peer);return peer;}});
   // Real audio graph and real WebRTC; deterministic microphone and screen sources.
   navigator.mediaDevices.getUserMedia=async()=>{
    const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();
    gain.gain.value=0;osc.connect(gain);gain.connect(destination);osc.start();await context.resume();
    window.testMic={context,gain,stream:destination.stream};return destination.stream;
   };
   navigator.mediaDevices.getDisplayMedia=async options=>{
    if(options.audio !== true) throw new Error('Screen audio was not requested');
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    const context=canvas.getContext('2d');let n=0;
    window.testScreenTimer=setInterval(()=>{context.fillStyle=n++%2?'#163':'#369';context.fillRect(0,0,640,360)},60);
    const sound=new AudioContext(),osc=sound.createOscillator(),gain=sound.createGain(),destination=sound.createMediaStreamDestination();
    gain.gain.value=.1;osc.frequency.value=880;osc.connect(gain);gain.connect(destination);osc.start();await sound.resume();
    const stream=canvas.captureStream(15);stream.addTrack(destination.stream.getAudioTracks()[0]);
    return window.testScreen=stream;
   };
  });
  for(const [file,key] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']])await page.route('**/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleText(key).replaceAll('test-token',name).replaceAll('test-user-1234',name)}));
  await page.route('**/api/**',r=>{
   const path=new URL(r.request().url()).pathname;
   if(path.startsWith('/api/chat/voice/'))return r.continue();
   if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'fixture',apiKey:'test'}});
   if(path==='/api/chat/bootstrap')return r.fulfill({json:{me:identity(name),members:[],channels:[{id:'general',name:'general'}],conversations:[],voice:snapshot()}});
   return r.fulfill({json:{messages:[],events:[]}});
  });
  await page.goto(base+'/apps/chat/');
  await page.getByRole('button',{name:'Lounge'}).click();
  await page.getByRole('region',{name:'Voice room',exact:true}).waitFor();
 }
 const [alice,bob,carol]=pages,room=alice.getByRole('region',{name:'Voice room',exact:true});
 for(const page of pages)await page.waitForFunction(()=>document.querySelector('[aria-label="Connected members"]')?.children.length===3);
 assert.equal(await room.getByRole('listitem').count(),3);
 await bob.evaluate(()=>{testMic.gain.gain.value=.15});
 await alice.waitForFunction(()=>[...document.querySelectorAll('[role="listitem"]')].some(e=>e.textContent.normalize('NFKC').replaceAll('0','o').includes('Bob')&&e.querySelector('small')?.textContent.normalize('NFKC').replaceAll('3','e').replaceAll('0','o')==='Speaking'));
 await bob.evaluate(()=>{testMic.gain.gain.value=0});
 await alice.waitForFunction(()=>[...document.querySelectorAll('[role="listitem"]')].some(e=>e.textContent.normalize('NFKC').replaceAll('0','o').includes('Bob')&&e.querySelector('small')?.textContent.normalize('NFKC').replaceAll('3','e').replaceAll('0','o')==='Listening'));
 await alice.getByRole('button',{name:'Back to chat',exact:true}).click();
 assert(await room.isHidden());assert.equal(sessions.size,3);
 await alice.getByRole('button',{name:/Lounge/}).first().click();assert(await room.isVisible());
 await bob.getByRole('button',{name:'Share screen',exact:true}).click();
 await room.getByRole('button',{name:"Watch Bob's screen",exact:true}).waitFor();
 await alice.waitForFunction(()=>[...document.querySelectorAll('video')].some(v=>v.videoWidth===640));
 assert(await alice.evaluate(()=>[...document.querySelectorAll('video')].every(v=>v.srcObject.getAudioTracks().length===0)),'Video controls cannot bypass screen audio deafen');
 assert(await bob.evaluate(()=>[...document.querySelectorAll('video')].every(v=>v.srcObject.getAudioTracks().length===0)),'Local preview cannot echo shared sound');
 await alice.waitForFunction(()=>[...document.querySelectorAll('audio')].filter(a=>a.srcObject?.getAudioTracks().some(t=>t.readyState==='live'&&!t.muted)).length===3);
 const screenAudio=await alice.evaluate(async()=>{
   const audio=[...document.querySelectorAll('audio')].find(a=>a.dataset.screenAudio);
   const context=new AudioContext(),source=context.createMediaStreamSource(audio.srcObject),analyser=context.createAnalyser();source.connect(analyser);await context.resume();
   await new Promise(r=>setTimeout(r,200));const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);source.disconnect();await context.close();
   return {energy:data.reduce((n,x)=>n+x*x,0),gain:audio._nyxVoiceGain?.gain.value,muted:audio.muted};
 });
 assert(screenAudio.energy>.01,'Real screen audio arrives'); assert.equal(screenAudio.gain,1,'Screen sound routed to output');
 await bob.getByRole('button',{name:'Mute microphone',exact:true}).click();
 assert(await bob.evaluate(()=>testMic.stream.getAudioTracks().every(t=>!t.enabled)&&testScreen.getAudioTracks().every(t=>t.enabled)),'Mic mute leaves screen sound enabled');
 await bob.getByRole('button',{name:'Unmute microphone',exact:true}).click();
 await alice.getByRole('button',{name:'Deafen',exact:true}).click();
 await alice.waitForFunction(()=>[...document.querySelectorAll('audio')].filter(a=>a._nyxVoiceGain).every(a=>a._nyxVoiceGain.gain.value===0));
 await alice.getByRole('button',{name:'Undeafen',exact:true}).click();
 await alice.waitForFunction(()=>[...document.querySelectorAll('audio')].some(a=>a.dataset.screenAudio&&a._nyxVoiceGain?.gain.value===1));
 await room.getByRole('button',{name:"Watch Bob's screen",exact:true}).click();
 assert.equal(await room.getByRole('button',{name:"Watch Bob's screen",exact:true}).getAttribute('aria-expanded'),'true');
 await alice.screenshot({path:'.codex-artifacts/voice-room-screen.png'});
 await alice.getByRole('button',{name:'Back to chat',exact:true}).click();
 await alice.getByRole('button',{name:/Open voice room.*1 screen share/}).click();
 await bob.getByRole('button',{name:'Stop sharing screen',exact:true}).click();
 await room.getByRole('button',{name:"Watch Bob's screen",exact:true}).waitFor({state:'detached'});
 await alice.waitForFunction(()=>[...document.querySelectorAll('audio')].filter(a=>a.srcObject?.getAudioTracks().some(t=>t.readyState==='live'&&!t.muted)).length===2);
 await bob.getByRole('button',{name:'Share screen',exact:true}).click();
 await room.getByRole('button',{name:"Watch Bob's screen",exact:true}).waitFor();
 await alice.waitForFunction(()=>[...document.querySelectorAll('audio')].filter(a=>a.srcObject?.getAudioTracks().some(t=>t.readyState==='live'&&!t.muted)).length===3);
 await carol.getByRole('button',{name:'Disconnect voice',exact:true}).click();
 await alice.waitForFunction(()=>document.querySelector('[aria-label="Connected members"]')?.children.length===2);
 await carol.getByRole('button',{name:/Lounge/}).first().click();
 await carol.waitForFunction(()=>[...document.querySelectorAll('audio')].filter(a=>a.srcObject?.getAudioTracks().some(t=>t.readyState==='live'&&!t.muted)).length===3);
 await carol.getByRole('button',{name:'Disconnect voice',exact:true}).click();
 await bob.getByRole('button',{name:'Disconnect voice',exact:true}).click();
 await alice.waitForFunction(()=>document.querySelector('[aria-label="Connected members"]')?.children.length===1);
 assert.equal(await room.locator('video').count(),0);
 assert.equal(await alice.locator('audio').count(),0);
 await alice.setViewportSize({width:390,height:844});
 assert(await room.isVisible());
 assert(await room.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 mkdirSync('.codex-artifacts',{recursive:true});await alice.screenshot({path:'.codex-artifacts/voice-room-mobile.png'});
 await room.getByRole('button',{name:'Disconnect voice in voice room',exact:true}).click();assert(await room.isHidden());
 assert.deepEqual(errors,[]);
 console.log('PASS full voice room: 3 real WebRTC peers, audio-driven speaking/decay, close/reopen, live screen video, enlarge, stop/restart, participant departure, mobile layout, disconnect cleanup.');
}catch(error){console.log('Sessions', [...sessions.keys()], 'Errors',errors);for(const p of pages)console.log(await p.evaluate(()=>({headings:[...document.querySelectorAll('h2')].map(e=>e.textContent),connections:testConnections.map(p=>[p.connectionState,p.iceConnectionState,p.signalingState]),context:testMic.context.state,audio:[...document.querySelectorAll('audio')].map(a=>[a.srcObject?.getAudioTracks().map(t=>[t.readyState,t.muted]),a.paused]),status:document.querySelector('[data-voice-status]')?.textContent})));await pages[0]?.screenshot({path:'.codex-artifacts/voice-room-failure.png'});throw error;}finally{await browser.close();io.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
