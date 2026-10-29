import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import {installHttpWisp} from '../server-http-wisp.mjs';
import {startWispurr} from '../lib/wispurr-relay.mjs';
const app=express();
app.get('/runtime-config.js',(_req,res)=>res.type('js').send('globalThis.english_RUNTIME_CONFIG={};'));
app.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const relay=await startWispurr({port:26710});
server.on('upgrade',(req,socket,head)=>relay.route(req,socket,head));
const closeHttp=installHttpWisp(app,{upstream:()=>({url:`ws://127.0.0.1:${server.address().port}/resources/live/`,origin:`http://127.0.0.1:${server.address().port}`}),allowed:()=>true,clientIp:()=> 'fixture'});
const browser=await chromium.launch();
try {
 for(const http of [false,true]) {
 const page=await browser.newPage();
 if(http)await page.addInitScript(()=>{window.nyxAlternateRelayAddress=()=>`ws://${location.host}/api/tutsi-relay/socket/`;const Native=WebSocket;globalThis.WebSocket=class extends Native{constructor(){throw Error('Direct WebSockets disabled in the launch page');}};});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/apps/r7f29c1/`);
 await page.getByRole('textbox',{name:'Website address'}).fill('https://example.com/');
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.title==='Example Domain'&&d.body?.innerText.includes('documentation');},{},{timeout:45000});
 assert.deepEqual(errors,[]);
 console.log('PASS real engine and external HTTPS rendering over '+(http?'HTTP bridge':'WebSocket relay'));await page.close();
 }
} finally {await browser.close();closeHttp();await relay.stop();await new Promise(resolve=>server.close(resolve));}
