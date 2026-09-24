import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
const fixture=createServer((_req,res)=>res.end('<!doctype html><title>Isolated voice fixture</title>'));
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
const source=readFileSync('apps/chat/app.js','utf8');
const relayChoice=source.match(/  function voiceUsesRelay[^\n]+/)[0];
const code=relayChoice+'\n'+source.slice(source.indexOf('  async function sendVoiceSignal('),source.indexOf('  async function applyVoiceState('));
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 const page=await browser.newPage();page.on("console",m=>{if(m.type()==="error")console.log(m.text())});await page.goto(`http://127.0.0.1:${fixture.address().port}`+'/apps/chat/');
 await page.evaluate(async code=>{
  window.peers={};window.held=[];window.hold=false;window.httpSignals=0;window.sequence=0;window.sent=[];
  for(const uid of ['alice000','bob00000']){
   const state={voiceTransport:'webrtc',me:{uid},voiceSessionId:uid+'-session',voiceChannelId:'lounge',voiceParticipants:[],voicePeers:new Map(),voiceSignalIds:new Set(),voiceIceServers:[],voiceStream:await navigator.mediaDevices.getUserMedia({audio:true}),socketConnected:true,socket:{timeout(){return {emit(_event,_value,callback){window.signalingDenied?callback(null,{ok:false,status:403}):callback(new Error('socket timeout'))}}}}};
   const refs={voiceStatus:document.createElement('span')};
   const fetchJson=async(_url,options)=>{httpSignals++;const value=JSON.parse(options.body);sent.push([uid,value.type]);const signal={...value,id:String(++sequence),fromUid:uid,fromSessionId:state.voiceSessionId,toSessionId:value.toUid+'-session',from:{uid,channelId:'lounge',sessionId:state.voiceSessionId}};const deliver=()=>peers[value.toUid].handle(signal);if(hold)held.push(deliver);else setTimeout(deliver,0);return {ok:true}};
   const make=new Function('state','refs','fetchJson',`const API='/api/chat',VOICE_JITTER_BUFFER_MS=120;const voiceMember=v=>v;const activateVoiceFallback=()=>{throw new Error('Unexpected audio fallback in healthy WebRTC test')};const removeVoiceScreen=()=>{},showVoiceScreen=()=>{};function closeVoicePeer(uid){state.voicePeers.get(uid)?.connection.close();state.voicePeers.delete(uid)};${code};return {state,offer:createVoiceOffer,handle:handleVoiceSignal,ensure:ensureVoicePeer,signal:sendVoiceSignal}`);
   peers[uid]=make(state,refs,fetchJson);
  }
  for(const [uid,peer] of Object.entries(peers)){const other=uid==='alice000'?'bob00000':'alice000';peer.ensure({uid:other,sessionId:other+'-session',channelId:'lounge'});}
  await peers.alice000.signal('bob00000',{type:'probe'});
 },code);
 assert.equal(await page.evaluate(()=>httpSignals),1,'Socket timeout must fall back to HTTP');
 await page.evaluate(async()=>{window.signalingDenied=true;await peers.alice000.signal('bob00000',{type:'probe'});window.signalingDenied=false;});
 assert.equal(await page.evaluate(()=>httpSignals),1,'Authorization rejection must not fall back');
 await page.evaluate(async()=>{hold=true;await Promise.all([peers.alice000.offer('bob00000'),peers.bob00000.offer('alice000')]);hold=false;for(const deliver of held.splice(0))void deliver();});
 await page.waitForFunction(()=>Object.values(peers).every(p=>[...p.state.voicePeers.values()].every(e=>e.connection.connectionState==='connected')),{},{timeout:15000}).catch(async error=>{console.log(await page.evaluate(()=>({sent})));console.log(await page.evaluate(()=>Object.values(peers).map(p=>[...p.state.voicePeers.values()].map(e=>({state:e.connection.connectionState,ice:e.connection.iceConnectionState,signal:e.connection.signalingState,making:e.makingOffer,pending:e.pendingCandidates.length})))));throw error});
 await page.waitForFunction(async()=>{for(const p of Object.values(peers)){const report=await [...p.state.voicePeers.values()][0].connection.getStats();if(![...report.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0))return false}return true});
 await page.evaluate(async()=>{hold=true;await Promise.all([peers.alice000.offer('bob00000',true),peers.bob00000.offer('alice000',true)]);hold=false;for(const deliver of held.splice(0))void deliver();});
 await page.waitForFunction(()=>Object.values(peers).every(p=>[...p.state.voicePeers.values()].every(e=>e.connection.signalingState==='stable'&&e.connection.connectionState==='connected')));
 console.log('PASS voice: socket timeout fallback, simultaneous offers, bidirectional real WebRTC audio packets, simultaneous ICE restart');
}finally{await browser.close();fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve))}
