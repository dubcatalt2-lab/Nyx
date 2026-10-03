import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch();try{
 const page=await browser.newPage();let launches=0;
 await page.route('**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:"export const getAuth=()=>({currentUser:{getIdToken:async()=>'fixture'},authStateReady:async()=>{}});export const setPersistence=async()=>{};export const browserLocalPersistence={};"}));
 await page.route('**/api/**',r=>{
 const path=new URL(r.request().url()).pathname;
 if(path==='/api/cloud-gaming/sessions'){launches++;return r.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:'Please wait before starting another session.'}})}
 const data=path.endsWith('/auth-config')?{enabled:true,projectId:'fixture',apiKey:'fixture'}:path.endsWith('/status')?{configured:true}:path.endsWith('/catalog')?{games:[{key:'fixture',name:'Fixture',tags:[]}]}:{session:null};return r.fulfill({json:data});
 });
 await page.goto('http://localhost:9091/apps/cloud-gaming/');const play=page.getByRole('button',{name:'Play',exact:true});await play.click();
 await page.getByText(/Please wait 2 seconds/).waitFor();assert(await play.isDisabled());assert.equal(launches,1);
 await page.getByText('You can try launching a game again.').waitFor();assert(await play.isEnabled());assert.equal(launches,1,'No automatic launch retry');
 console.log('Cloud Gaming Retry-After countdown, disabled launches and retry expiry passed with fixtures.');
}finally{await browser.close()}
