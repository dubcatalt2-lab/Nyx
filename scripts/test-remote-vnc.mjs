import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {WebSocket} from 'ws';
import {createRemoteDesktop,remoteOwnerUid} from '../lib/remote-desktop.mjs';
const require=createRequire(import.meta.url),records=new Map();
const collection={doc:id=>({get:async()=>({data:()=>records.get(id)}),set:async data=>records.set(id,data),delete:async()=>records.delete(id)}),where:()=>({get:async()=>({size:records.size,docs:[...records].map(([id,data])=>({id,data:()=>data}))})})};
const remote=createRemoteDesktop({firebase:async()=>({auth:{verifyIdToken:async token=>({uid:token==='owner'?remoteOwnerUid:'denied'})},firestore:{collection:()=>collection}}),download:async()=>Buffer.from('zip')});
const app=express();app.use('/api/private-remote',remote.router);app.get('/api/founder-profile/auth-config',(_req,res)=>res.json({enabled:true,apiKey:'fixture',projectId:'fixture'}));app.use('/assets/vendor/novnc',express.static(dirname(dirname(require.resolve('@novnc/novnc')))));app.use(express.static(resolve(process.env.REMOTE_TEST_DIST?'dist':'.')));
const server=createServer(app);server.on('upgrade',remote.upgrade);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const post=async(path,body)=>(await fetch(origin+'/api/private-remote'+path,{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(body)})).json();
const credential=randomBytes(32).toString('base64url'),pair=await post('/pair/start',{credential,name:'Windows service fixture',mode:'vnc'});await post('/pair/approve',{code:pair.code});const {deviceId:id}=await post('/pair/poll',{poll:pair.poll});
const host=new WebSocket(origin.replace('http:','ws:')+'/api/private-remote/socket');await new Promise(resolve=>host.once('open',resolve));const ready=new Promise(resolve=>host.once('message',resolve));host.send(JSON.stringify({type:'host',id,credential}));await ready;
let stage=0,pending=Buffer.alloc(0),frames=0,keys=0,pointers=0,stopped=false;
function serverInit(){const name=Buffer.from('Service test'),init=Buffer.alloc(24+name.length);init.writeUInt16BE(320,0);init.writeUInt16BE(200,2);init[4]=32;init[5]=24;init[7]=1;init.writeUInt16BE(255,8);init.writeUInt16BE(255,10);init.writeUInt16BE(255,12);init[14]=16;init[15]=8;init.writeUInt32BE(name.length,20);name.copy(init,24);return init;}
host.on('message',(data,binary)=>{
 if(!binary){const value=JSON.parse(data);if(value.type==='control'&&value.active){host.send(JSON.stringify({type:'vnc',password:'Abcdef23'}));host.send(Buffer.from('RFB 003.008\n'));}if(value.type==='control'&&!value.active)stopped=true;return;}
 pending=Buffer.concat([pending,data]);
 if(stage===0&&pending.length>=12){assert.equal(pending.subarray(0,12).toString(),'RFB 003.008\n');pending=pending.subarray(12);host.send(Buffer.from([1,1]));stage++;}
 if(stage===1&&pending.length>=1){assert.equal(pending[0],1);pending=pending.subarray(1);host.send(Buffer.alloc(4));stage++;}
 if(stage===2&&pending.length>=1){pending=pending.subarray(1);host.send(serverInit());stage++;}
 while(stage===3&&pending.length){const type=pending[0];let size=({0:20,3:10,4:8,5:6})[type];if(type===2){if(pending.length<4)return;size=4+pending.readUInt16BE(2)*4;}if(!size||pending.length<size)return;pending=pending.subarray(size);if(type===4)keys++;if(type===5)pointers++;if(type===3&&!frames++){const frame=Buffer.alloc(16+320*200*4);frame.writeUInt16BE(1,2);frame.writeUInt16BE(320,8);frame.writeUInt16BE(200,10);frame.fill(Buffer.from([40,80,40,0]),16);host.send(frame);}}
});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'const user={getIdToken:async()=>"owner"};export const getAuth=()=>({currentUser:user});export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(a,f)=>f(user);'}));
 await page.goto(origin+'/apps/remote/');await page.getByRole('button',{name:'Connect',exact:true}).click();await page.getByText('Connected · Windows service',{exact:true}).waitFor();const canvas=page.locator('#screen canvas');await canvas.click();await page.keyboard.press('a');await page.waitForTimeout(150);assert(keys>0);assert(pointers>0);assert(frames>0);assert(await page.locator('#secureAttention').isVisible());await page.locator('#disconnect').click();await page.waitForTimeout(100);assert(stopped);assert.deepEqual(errors,[]);
 console.log('PASS: noVNC RFB handshake, framebuffer, mouse/keyboard over owner-authenticated binary relay; session teardown. Native Windows service installation still requires administrator approval.');
}finally{await browser.close();host.close();remote.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
