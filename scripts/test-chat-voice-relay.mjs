import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { Server } from 'socket.io';
import { parse } from 'acorn';
import { chromium } from 'playwright';
import { exchangeVoiceAudio, createVoiceAudioAccess } from '../lib/chat-voice-relay.mjs';

const makeSession = (uid, channelId = 'lounge', audioTransport = 'relay') => ({ uid, channelId, sessionId: `session-${uid}`, audioTransport, audioRelayVersion: 1 });
const allowed = new Set(['lounge']);
let checked=0,clock=1000;
const access=createVoiceAudioAccess(async()=>{checked++;return 'allowed'},()=>clock);
assert.deepEqual(await Promise.all([access('token-ip',{}),access('token-ip',{})]),['allowed','allowed']);
assert.equal(checked,1);clock=6001;await access('token-ip',{});assert.equal(checked,2);
let rejected=0;const denied=createVoiceAudioAccess(async()=>{rejected++;throw Error('denied')});
await assert.rejects(denied('bad',{}));await assert.rejects(denied('bad',{}));assert.equal(rejected,2);
const data = Buffer.alloc(3200, 12).toString('base64');
const sessions = new Map(['alice', 'bob'].map(uid => [uid, makeSession(uid)]));
sessions.set('outsider', makeSession('outsider', 'private'));
const exchange = (uid, frames = [], now = 1000) => exchangeVoiceAudio(sessions, uid, { sessionId: sessions.get(uid).sessionId, frames }, allowed, now);
exchange('bob');
exchange('alice', [{ seq: 0, data }]);
assert.equal(exchange('bob').frames.length, 1);
exchange('alice', [{ seq: 0, data }]);
assert.equal(exchange('bob').frames.length, 0, 'acknowledgement loss must not replay speech');
assert.equal(sessions.get('outsider').audioRelay, undefined);
assert.throws(() => exchangeVoiceAudio(sessions, 'alice', { sessionId: 'old', frames: [] }, allowed, 1000), { status: 409 });
assert.throws(() => exchange('alice', [{ seq: 1, data: 'bad' }]), { status: 400 });
exchange('alice', [{ seq: 1, data }]);
assert.equal(exchange('bob', [], 2200).frames.length, 0, 'expired frames discarded');
exchange('alice', [{ seq: 2, data }], 2200);
sessions.set('alice', makeSession('alice')); sessions.get('alice').sessionId = 'new-session';
assert.equal(exchange('bob', [], 2200).frames.length, 0, 'old session frames discarded');
assert.throws(() => exchangeVoiceAudio(sessions, 'bob', { sessionId: 'session-bob', frames: [] }, new Set(), 2300), { status: 403 });
assert.equal(sessions.has('bob'), false);
const burst = new Map([['alice', makeSession('alice')]]);
for (let i = 0; i < 20; i++) exchangeVoiceAudio(burst, 'alice', { sessionId: 'session-alice', frames: [] }, allowed, 1000);
assert.throws(() => exchangeVoiceAudio(burst, 'alice', { sessionId: 'session-alice', frames: [] }, allowed, 1000), { status: 429 });
const capacity = new Map(Array.from({length:129}, (_, i) => [String(i), makeSession(String(i))]));
for (let i=0;i<128;i++) exchangeVoiceAudio(capacity,String(i),{sessionId:`session-${i}`,frames:[]},allowed,1000);
assert.throws(()=>exchangeVoiceAudio(capacity,'128',{sessionId:'session-128',frames:[]},allowed,1000),{status:503});
assert.equal(exchangeVoiceAudio(capacity,'128',{sessionId:'session-128',frames:[]},allowed,5000).ok,true);
const room=new Map(Array.from({length:8},(_,i)=>[String(i),makeSession(String(i))]));
for(let i=0;i<8;i++)exchangeVoiceAudio(room,String(i),{sessionId:`session-${i}`,frames:[]},allowed,1000);
for(let seq=0;seq<10;seq++)for(let i=0;i<7;i++)exchangeVoiceAudio(room,String(i),{sessionId:`session-${i}`,frames:[{seq,data}]},allowed,1000+seq);
assert.equal(room.get('7').audioRelay.queue.length,64,'slow receiver queue remains bounded');
console.log('PASS relay validation, session/channel isolation, duplicate/expired frame removal, rate and capacity bounds.');

// Actual HTTP route and socket listener, with isolated account/authorization dependencies.
const source = readFileSync('server.js','utf8'), app = express(), server = createServer(app);
app.use(express.json({limit:'32kb'}));
const io = new Server(server), liveSessions = new Map(), counters={http:0,socket:0};
const channels=[{id:'lounge',name:'Lounge',description:'Fixture voice'}];
let socketFailure=false;
const user = req => String(req.headers.authorization||'').replace(/^Bearer /,'');
const identity = uid => ({uid,role:'member',handle:`@${uid}`,displayName:uid});
const context = vm.createContext({app,Set,Date,Error,createHash,createVoiceAudioAccess,exchangeVoiceAudio,nyxChatVoiceSessions:liveSessions,
  sameOriginRequest:req=>!req.headers.origin||req.headers.origin===`http://${req.headers.host}`,
  authenticatedNyxChatUser:async req=>{const uid=user(req);if(!/^voice-[ab]$/.test(uid))throw Object.assign(Error('Sign in'),{status:401});return {firebase:{},token:{uid}}},
  loadNyxChatConfiguration:async()=>({voiceChannels:channels}),nyxChatIdentity:async(_f,token)=>identity(token.uid),
  nyxChatCanAccessChannel:()=>true,nyxClientIp:()=>'',
  emitNyxChatVoiceRefresh:()=>io.emit('nyx:voice:refresh'),
  authorizeNyxChatSocket:async socket=>{socket.data.visibleVoiceChannelIds=['lounge'];return {firebase:{},token:{uid:socket.handshake.auth.token}}},
  nyxChatActiveTemporaryBan:async()=>false
});
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const authorization=ast.body.find(n=>n.declarations?.[0]?.id?.name==='authorizeNyxChatVoiceAudio');
vm.runInContext(source.slice(authorization.start,authorization.end),context);
const route=ast.body.find(n=>n.expression?.arguments?.[0]?.value==='/api/chat/voice/audio');
app.use('/api/chat/voice/audio',(_req,_res,next)=>{counters.http++;next()});
vm.runInContext(source.slice(route.start,route.end),context);
const socketStart=source.indexOf('    socket.on("nyx:voice:audio"');
const socketEnd=source.indexOf('    socket.on("disconnect"',socketStart);
const install=vm.runInContext(`(socket,uid)=>{${source.slice(socketStart,socketEnd)}}`,context);
io.on('connection',socket=>{
  socket.data.token=socket.handshake.auth.token;
  socket.use(([event],next)=>{if(event==='nyx:voice:audio'){counters.socket++;if(socketFailure)return;}next()});
  install(socket,socket.handshake.auth.token);
});
const voiceState=(uid,sessionId)=>({channels,participants:[...liveSessions.values()],joined:liveSessions.get(uid)?.sessionId===sessionId,signals:[]});
app.get('/api/chat/voice/state',(req,res)=>res.json(voiceState(user(req),req.query.sessionId)));
app.post('/api/chat/voice/join',(req,res)=>{const uid=user(req);liveSessions.set(uid,{...makeSession(uid),...req.body,...identity(uid)});io.emit('nyx:voice:refresh');res.json(voiceState(uid,req.body.sessionId))});
app.post('/api/chat/voice/leave',(req,res)=>{if(liveSessions.get(user(req))?.sessionId===req.body.sessionId)liveSessions.delete(user(req));io.emit('nyx:voice:refresh');res.json({ok:true})});
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||process.cwd(),{dotfiles:'allow'}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
assert.equal((await fetch(origin+'/api/chat/voice/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
assert.equal((await fetch(origin+'/api/chat/voice/audio',{method:'POST',headers:{origin:'https://elsewhere.example','Content-Type':'application/json'},body:'{}'})).status,403);
const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const fixture=readFileSync('scripts/test-account-controls.mjs','utf8'),moduleText=name=>fixture.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'))[1];
try{
  for(const scenario of ['http','socket','automatic','timeout']){
    liveSessions.clear();socketFailure=false;counters.http=0;counters.socket=0;
    const pages=[],contexts=[];
    for(const [index,uid] of ['voice-a','voice-b'].entries()){
      const ctx=await browser.newContext({permissions:['microphone']});contexts.push(ctx);
      const page=await ctx.newPage();pages.push(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
      page.fixtureErrors=errors;
      await page.addInitScript(({scenario,index})=>{
        window.voiceReceived=0;window.voiceEnergy=0;
        const start=AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.length===1600){window.voiceReceived++;window.voiceEnergy+=this.buffer.getChannelData(0).reduce((n,v)=>n+Math.abs(v),0)}return start.apply(this,args)};
        const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia=async(...args)=>window.voiceTestStream=await gum(...args);
        if(index===0&&scenario!=='timeout'){if(scenario==='automatic')window.RTCPeerConnection=class {constructor(){throw new Error('WebRTC blocked')}};else window.RTCPeerConnection=undefined;}
      },{scenario,index});
      for(const [file,name] of [['firebase-app.js','firebaseAppModule'],['firebase-auth.js','firebaseAuthModule']]){
        const body=moduleText(name).replaceAll('test-token',uid).replaceAll('test-user-1234',uid);
        await page.route('**/'+file,r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body}));
      }
      if(scenario==='http')await page.route('**/socket.io/**',r=>r.abort());
      await page.route('**/api/**',r=>{
        const path=new URL(r.request().url()).pathname;
        if(path.startsWith('/api/chat/voice/'))return r.continue();
        if(path==='/api/founder-profile/auth-config')return r.fulfill({json:{enabled:true,projectId:'nyx-test',apiKey:'test'}});
        if(path==='/api/chat/bootstrap')return r.fulfill({json:{me:identity(uid),members:[],channels:[{id:'general',name:'general'}],conversations:[],voice:{channels,participants:[]}}});
        return r.fulfill({json:{messages:[],events:[],channels:[],participants:[],signals:[]}});
      });
      await page.goto(origin+'/apps/chat/'+(index?'?tutsi=1':''));
      await page.locator('[data-message-form]').waitFor({state:'visible'});
      if(scenario==='http'&&index)await page.locator('[data-voice-transport]').selectOption('http');
      await page.locator('[data-voice-channel-list] .voice-channel-button').click();
    }
    for(const page of pages)await page.waitForFunction(()=>window.voiceReceived>3&&window.voiceEnergy>0,{},{timeout:20000});
    assert([...liveSessions.values()].some(p=>p.audioTransport==='relay'));
    if(scenario==='http'){assert.equal(counters.socket,0);assert(counters.http>0);}
    else {assert(counters.socket>0);socketFailure=true;const before=counters.http;await pages[0].waitForFunction(()=>document.querySelector('[data-voice-status]').textContent==='Voice via HTTP',{},{timeout:15000});assert(counters.http>before);}
    await pages[0].locator('[data-voice-mute]').click();
    await pages[0].waitForTimeout(1500);const before=await pages[1].evaluate(()=>window.voiceReceived);
    await pages[0].waitForTimeout(700);assert.equal(await pages[1].evaluate(()=>window.voiceReceived),before,'muted sender sends no frames');
    await pages[0].locator('[data-voice-mute]').click();
    await pages[1].waitForFunction(n=>window.voiceReceived>n,before);
    await pages[1].locator('[data-voice-deafen]').click();
    const deaf=await pages[1].evaluate(()=>window.voiceReceived);await pages[1].waitForTimeout(500);assert.equal(await pages[1].evaluate(()=>window.voiceReceived),deaf);
    await pages[1].locator('[data-voice-deafen]').click();await pages[1].waitForFunction(n=>window.voiceReceived>n,deaf);
    if(scenario==='timeout'){
      liveSessions.delete('voice-a');
      await pages[0].waitForFunction(()=>window.voiceTestStream.getTracks().every(t=>t.readyState==='ended'));
    }
    for(const page of pages){if(await page.locator('[data-voice-disconnect]').isVisible())await page.locator('[data-voice-disconnect]').click();await page.waitForFunction(()=>window.voiceTestStream.getTracks().every(t=>t.readyState==='ended'));assert.deepEqual(page.fixtureErrors,[]);}
    if(scenario==='http'){for(const page of pages){await page.locator('[data-voice-channel-list] .voice-channel-button').click();}await Promise.all(pages.map(async page=>{const n=await page.evaluate(()=>window.voiceReceived);await page.waitForFunction(n=>window.voiceReceived>n,n);}));for(const page of pages){await page.locator('[data-voice-disconnect]').click();assert.deepEqual(page.fixtureErrors,[]);}}
    for(const ctx of contexts)await ctx.close();
    console.log(`PASS ${scenario}: Nyx + Tutsi bidirectional real worklet PCM playback, mute/deafen, cleanup${scenario==='http'?' without WebRTC/WebSocket':', socket-to-HTTP recovery'}.`);
  }
}finally{await browser.close();io.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
