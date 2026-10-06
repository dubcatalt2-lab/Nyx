import {sourceFile} from '../scripture/source-layout.mjs';
import vm from 'node:vm';
import {posix} from 'node:path';
import {readFileSync} from 'node:fs';
import express from 'express';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createNyxCloudDesktop} from '../scripture/nyxcloud-desktop.mjs';
import {nyxCloudOwnerUid} from '../scripture/nyxcloud-access.mjs';
import assert from 'node:assert/strict';
// Explicit local live-VM smoke test. Never sends desktop keyboard/mouse input.
const file=process.env.NYXCLOUD_LOCAL_CONFIG;if(!file)throw Error('Set NYXCLOUD_LOCAL_CONFIG to the private local VM configuration.');
const {password}=JSON.parse(await readFile(sourceFile(file),'utf8'));
const app=express(),cloud=createNyxCloudDesktop({port:5990,password,firebase:async()=>({auth:{verifyIdToken:async token=>{if(token!=='local-test')throw Error();return {uid:nyxCloudOwnerUid};}}})});
const routeSource=readFileSync(sourceFile('shepherd.js'),'utf8');
const routeStart=routeSource.indexOf("app.use('/api/nyxcloud',nyxCloudDesktop.router);");
const routeEnd=routeSource.indexOf("app.use('/api/private-remote',",routeStart);
assert(routeStart>=0&&routeEnd>routeStart);
vm.runInThisContext('(function(app,nyxCloudDesktop,posix){'+routeSource.slice(routeStart,routeEnd)+'})')(app,cloud,posix);
app.get('/api/founder-profile/auth-config',(_req,res)=>res.json({enabled:true,apiKey:'fixture',projectId:'fixture'}));
app.use('/apps/nyxcloud',express.static(resolve(process.env.NYX_TEST_BUILT?'dist/apps/nyxcloud':'apps/nyxcloud')));
app.use('/assets/vendor/novnc',express.static(dirname(dirname(createRequire(import.meta.url).resolve('@novnc/novnc')))));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));server.on('upgrade',cloud.upgrade);
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'application/javascript',body:route.request().url().endsWith('firebase-app.js')?'export const getApps=()=>[]; export const initializeApp=()=>({});':'const user={getIdToken:async()=>"local-test"};export const getAuth=()=>({currentUser:user});export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(_auth,callback)=>callback(user);'}));
 const session=await context.request.post(origin+'/api/nyxcloud/session',{headers:{Authorization:'Bearer local-test',Origin:origin}});assert.equal(session.status(),200);
 const cookie=session.headers()['set-cookie'].split(';')[0];
 const route=await context.request.get(origin+'/apps/nyxcloud/',{maxRedirects:0,headers:{cookie}});assert.equal(route.status(),200,'Authorized slash URL must serve the viewer, not redirect to itself');
 const canonical=await context.request.get(origin+'/apps/nyxcloud',{maxRedirects:0,headers:{cookie}});assert.equal(canonical.status(),302);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
 await page.addInitScript(()=>{const Original=window.WebSocket;window.WebSocket=new Proxy(Original,{construct(Type,args){const socket=new Type(...args);if(String(args[0]).includes('/api/nyxcloud/socket')){window.testDesktopSocket=socket;window.testDesktopConnections=(window.testDesktopConnections||0)+1;}return socket;}});});
 const navigation=await page.goto(origin+'/apps/nyxcloud/');assert.equal(navigation.status(),200,'Browser owner page status');
 try{await page.waitForFunction(()=>document.getElementById('status')?.textContent==='Connected',{timeout:15000});}catch(error){console.log({status:await page.locator('body').textContent({timeout:1000}),errors});throw error;}
 const display=await page.locator('#screen canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));assert(display.width>=1280&&display.height>=720,JSON.stringify(display));
 // An idle guest can legitimately show a black screensaver. Require a decoded
 // opaque framebuffer; optionally require wallpaper colors for an awake guest.
 await page.waitForFunction(()=>{const c=document.querySelector('#screen canvas');return c?.getContext('2d').getImageData(50,50,1,1).data[3]===255;});
 if(process.env.NYXCLOUD_EXPECT_WALLPAPER==='1')await page.waitForFunction(()=>{const c=document.querySelector('#screen canvas');if(!c)return false;const ctx=c.getContext('2d'),colors=new Set();for(let y=50;y<c.height;y+=80)for(let x=50;x<c.width;x+=80)colors.add([...ctx.getImageData(x,y,1,1).data].join(','));return colors.size>20;},{timeout:30000});
 assert.deepEqual(errors,[]);await page.screenshot({path:process.env.NYXCLOUD_SCREENSHOT||'C:/Users/dubca/AppData/Local/NyxCloud/website-preview.png'});
 const before=await page.evaluate(()=>window.testDesktopConnections);
 await page.evaluate(()=>window.testDesktopSocket.close(4001,'Fixture connection loss'));
 await page.waitForFunction(count=>window.testDesktopConnections>count&&document.getElementById('status').textContent==='Connected',before);
 await page.waitForFunction(()=>document.querySelector('#screen canvas')?.getContext('2d').getImageData(50,50,1,1).data[3]===255);
 if(process.env.NYXCLOUD_SOAK_SECONDS){
   const expected=await page.evaluate(()=>window.testDesktopConnections);
   const seconds=Number(process.env.NYXCLOUD_SOAK_SECONDS);
   for(let elapsed=0;elapsed<seconds;elapsed+=10){await page.waitForTimeout(10000);assert.equal(await page.locator('#status').textContent(),'Connected');assert.equal(await page.evaluate(()=>window.testDesktopConnections),expected);}
   console.log('PASS uninterrupted live VM stream for '+seconds+' seconds, including authorization renewal.');
 }
 await page.locator('#disconnect').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Disconnected.');
 await page.locator('#connect').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Connected');
 console.log('PASS live NyxCloud browser: authenticated viewer, full-resolution VNC, no JS errors, disconnect/reconnect; no guest input sent.',display);
}finally{await browser.close();cloud.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
