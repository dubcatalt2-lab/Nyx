import express from 'express';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createNyxCloudDesktop} from '../lib/nyxcloud-desktop.mjs';
import {nyxCloudOwnerUid} from '../lib/nyxcloud-access.mjs';
import assert from 'node:assert/strict';
// Explicit local live-VM smoke test. Never sends desktop keyboard/mouse input.
const file=process.env.NYXCLOUD_LOCAL_CONFIG;if(!file)throw Error('Set NYXCLOUD_LOCAL_CONFIG to the private local VM configuration.');
const {password}=JSON.parse(await readFile(file,'utf8'));
const app=express(),cloud=createNyxCloudDesktop({port:5990,password,firebase:async()=>({auth:{verifyIdToken:async token=>{if(token!=='local-test')throw Error();return {uid:nyxCloudOwnerUid};}}})});
app.use('/api/nyxcloud',cloud.router);app.get('/api/founder-profile/auth-config',(_req,res)=>res.json({enabled:true,apiKey:'fixture',projectId:'fixture'}));
app.use('/apps/nyxcloud',cloud.pageAccess,express.static(resolve(process.env.NYX_TEST_BUILT?'dist/apps/nyxcloud':'apps/nyxcloud')));
app.use('/assets/vendor/novnc',express.static(dirname(dirname(createRequire(import.meta.url).resolve('@novnc/novnc')))));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));server.on('upgrade',cloud.upgrade);
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'application/javascript',body:route.request().url().endsWith('firebase-app.js')?'export const getApps=()=>[]; export const initializeApp=()=>({});':'const user={getIdToken:async()=>"local-test"};export const getAuth=()=>({currentUser:user});export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(_auth,callback)=>callback(user);'}));
 const session=await context.request.post(origin+'/api/nyxcloud/session',{headers:{Authorization:'Bearer local-test',Origin:origin}});assert.equal(session.status(),200);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/apps/nyxcloud/');
 await page.waitForFunction(()=>document.getElementById('status')?.textContent==='Connected',{timeout:30000});
 const display=await page.locator('#screen canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));assert(display.width>=1280&&display.height>=720,JSON.stringify(display));
 await page.waitForFunction(()=>{const c=document.querySelector('#screen canvas');if(!c)return false;const ctx=c.getContext('2d'),colors=new Set();for(let y=50;y<c.height;y+=80)for(let x=50;x<c.width;x+=80)colors.add([...ctx.getImageData(x,y,1,1).data].join(','));return colors.size>20;},{timeout:30000});
 assert.deepEqual(errors,[]);await page.screenshot({path:process.env.NYXCLOUD_SCREENSHOT||'C:/Users/dubca/AppData/Local/NyxCloud/website-preview.png'});
 await page.locator('#disconnect').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Disconnected.');
 await page.locator('#connect').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Connected');
 console.log('PASS live NyxCloud browser: authenticated viewer, full-resolution VNC, no JS errors, disconnect/reconnect; no guest input sent.',display);
}finally{await browser.close();cloud.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
