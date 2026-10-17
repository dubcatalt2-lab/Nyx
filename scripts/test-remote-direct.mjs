import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createDirectSession} from '../remote-host/direct-session.mjs';
import {remoteOwnerUid} from '../lib/remote-desktop.mjs';
const session=await createDirectSession({verify:async token=>({uid:token==='owner'?remoteOwnerUid:'other'}),authConfig:{enabled:true,apiKey:'fixture',projectId:'fixture'},computer:'Direct test'});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const path of ['/api/private-remote/devices','/api/private-remote/pair/start','/apps/remote/index.html'])assert.equal((await fetch(session.origin+path)).status,404);
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:`const make=value=>value?{email:value+'@example.test',getIdToken:async()=>value}:null;const auth={currentUser:make(localStorage.getItem('fixture-user'))};let changed=()=>{};export const getAuth=()=>auth;export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(a,f)=>{changed=f;f(a.currentUser)};export const signInWithEmailAndPassword=async(a,email)=>{const name=email.split('@')[0];localStorage.setItem('fixture-user',name);a.currentUser=make(name);changed(a.currentUser)};export const signOut=async a=>{localStorage.removeItem('fixture-user');a.currentUser=null;changed(null)};`}));
 await page.goto(session.origin);await page.locator('#email').fill('member@example.test');await page.locator('#password').fill('fixture');await page.locator('#submit').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('does not have access'));
 await page.locator('#signOut').click();await page.locator('#email').fill('owner@example.test');await page.locator('#password').fill('fixture');await page.locator('#submit').click();
 await page.waitForURL('**/apps/remote/index.html');await page.locator('#workspace').waitFor();
 assert.equal(await page.locator('.device button').count(),1);
 assert(await page.locator('#pair').isHidden());assert.deepEqual(errors,[]);
 if(process.env.REMOTE_TEST_NATIVE==='1'){
  session.startDesktop();
  let device;
  for(let i=0;i<60;i++){const response=await fetch(session.origin+'/api/private-remote/devices',{headers:{Authorization:'Bearer owner'}});device=(await response.json()).devices[0];if(device.online)break;await new Promise(r=>setTimeout(r,250));}
  assert(device.online,'Native helper must become ready');
  const response=await fetch(session.origin+'/api/private-remote/connect',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({id:device.id})});const {ticket}=await response.json();
  await new Promise((resolve,reject)=>{const ws=new WebSocket(session.origin.replace('http:','ws:')+'/api/private-remote/socket');ws.binaryType='arraybuffer';const timer=setTimeout(()=>{ws.close();reject(Error('Desktop capture unavailable: Windows may be locked.'));},12000);ws.onopen=()=>ws.send(JSON.stringify({type:'viewer',ticket}));ws.onerror=reject;ws.onmessage=event=>{if(typeof event.data==='string')return;const bytes=Buffer.from(event.data);try{assert.equal(bytes.readUInt16BE(0),0xffd8);console.log('Actual laptop JPEG reached the owner-authenticated local viewer; frame not saved, no input injected.');clearTimeout(timer);ws.close();resolve();}catch(error){clearTimeout(timer);ws.close();reject(error);}};});
 }
 console.log('Direct session: owner-only login, private pages, local device and simplified controls passed.');
}finally{await browser.close();await session.close();}
