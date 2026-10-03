import {chromium} from 'playwright';
import express from 'express';
import assert from 'node:assert/strict';
const app=express();app.use(express.static('.'));const server=app.listen(8301);
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-08-31-new-nyx.device','2026-08-31-new-nyx')});
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:`const listeners=[];const user={uid:'new-user',email:'newuser@nyx.local',emailVerified:true,getIdToken:async()=>'token'};const auth={currentUser:null,authStateReady:async()=>{}};export const browserLocalPersistence={};export const getAuth=()=>auth;export const setPersistence=async()=>{};export function onAuthStateChanged(a,f){listeners.push(f);queueMicrotask(()=>f(auth.currentUser));return()=>{}}export async function signInWithCustomToken(){auth.currentUser=user;listeners.forEach(f=>f(user));return {user}}`}));
 let profile={displayName:'newuser',handle:'@newuser',bio:''};let saved=false;
 await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;let body={};if(p.endsWith('/auth-config'))body={enabled:true,projectId:'test',apiKey:'test'};if(p==='/api/account/register')body={customToken:'mock'};if(p==='/api/account/me')body={email:'',role:'member',subscriptionStatus:'free'};if(p==='/api/profiles/me'){if(r.request().method()==='PUT'){profile=r.request().postDataJSON().profile;saved=true}body={uid:'new-user',profile}}return r.fulfill({contentType:'application/json',body:JSON.stringify(body)})});
 await page.goto('http://localhost:8301');await page.locator('#setupScreen.show').waitFor();await page.waitForTimeout(2000);
 const next=page.locator('[data-setup-next]');await next.click();await page.locator('#setupName').fill('newuser');await next.click();
 const account=page.locator('.nyx-account-overlay');await account.waitFor();await account.locator('[name=password]').fill('test-password-123');await account.locator('[name=password]').press('Enter');
 await page.locator('[data-setup-step="3"].active').waitFor();await account.waitFor({state:'detached'});
 await page.locator('[data-setup-edit-profile]').focus();await page.keyboard.press('Enter');const editor=page.locator('.nyx-user-profile-overlay');await editor.waitFor();await editor.locator('[data-nyx-display-style-toggle]').click();
 await editor.locator('[name=displayName]').fill('My new profile');await editor.locator('[name=bio]').fill('My first bio');await editor.locator('[name=displayName]').press('Enter');
 await editor.waitFor({state:'detached'});assert(saved);assert.equal(profile.displayName,'My new profile');assert.equal(await page.locator('[data-setup-step="3"].active').count(),1);
 await next.click();assert.equal(await page.locator('[data-setup-step="4"].active').count(),1);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-setup-back]').click();assert.equal(await page.locator('[data-setup-step="3"].active').count(),1);assert(await page.locator('[data-setup-edit-profile]').isVisible());
 const guest=await browser.newPage();await guest.addInitScript(()=>{localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');localStorage.setItem('nyx.releaseNotes.2026-08-31-new-nyx.device','2026-08-31-new-nyx')});await guest.goto('http://localhost:8301');await guest.locator('#setupScreen.show').waitFor();await guest.waitForTimeout(1500);await guest.locator('[data-setup-next]').click();await guest.locator('#setupName').fill('');await guest.locator('[data-setup-next]').click();await guest.locator('[data-setup-next]').click();assert.equal(await guest.locator('[data-setup-step="4"].active').count(),1);await guest.locator('[data-setup-back]').click();assert.equal(await guest.locator('[data-setup-step="2"].active').count(),1);
 assert.deepEqual(errors,[]);console.log('PASS: signup to profile step, keyboard editor opening/save, saved profile, wizard resume, mobile and guest skip/back.');
}finally{await browser.close();server.close()}
