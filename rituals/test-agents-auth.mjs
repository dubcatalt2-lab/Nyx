import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await workspace.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:`
 const auth={currentUser:null};let listener;
 export const getAuth=()=>auth;export const browserLocalPersistence={};export const setPersistence=async()=>{};
 export const onAuthStateChanged=(a,f)=>{listener=f;f(a.currentUser);};
 const enter=()=>{auth.currentUser={uid:'signup-fixture',getIdToken:async()=>'fixture'};listener(auth.currentUser);return {user:auth.currentUser};};
 export const createUserWithEmailAndPassword=async(a,email,password)=>{window.__signup=(window.__signup||0)+1;if(window.__authError)throw {code:window.__authError};return enter();};
 export const signInWithCustomToken=async()=>enter();
 export const signInWithEmailAndPassword=async()=>{window.__signin=true;return enter();};
 export const signOut=async()=>{auth.currentUser=null;listener(null);};`}));
 await page.route('**/api/**',r=>r.fulfill({json:r.request().url().includes('auth-config')?{enabled:true,apiKey:'fixture',projectId:'fixture'}:r.request().url().includes('/models')?{models:[]}:{profile:{handle:'@newuser'}}}));
 await page.route('**/api/account/register',async r=>{const count=await page.evaluate(()=>window.__signup=(window.__signup||0)+1);const fail=await page.evaluate(()=>window.__authError);const body=r.request().postDataJSON();assert.equal(body.username,'newuser');return r.fulfill({status:fail?409:201,json:fail?{error:'This email already has an account.'}:{customToken:'fixture-token'}});});
 await page.goto((process.env.NYX_AGENTS_TEST_URL||'http://localhost:6769')+'/apps/agents/');
 await page.locator('#account').click();await page.locator('#authSwitch').click();
 assert.equal(await page.locator('#authTitle').innerText(),'Create an account');assert.equal(await page.locator('#password').getAttribute('autocomplete'),'new-password');
 await page.locator('#signupUsername').fill('newuser');await page.locator('#email').fill('newuser@example.test');await page.locator('#password').fill('test-password');await page.locator('#confirmPassword').fill('different-password');await page.locator('#authSubmit').click();assert.match(await page.locator('#loginError').innerText(),/do not match/);assert.equal(await page.evaluate(()=>window.__signup||0),0);
 await page.locator('#confirmPassword').fill('test-password');await page.evaluate(()=>window.__authError='auth/email-already-in-use');await page.locator('#authSubmit').click();await page.waitForFunction(()=>!document.getElementById('authSubmit').disabled);assert.match(await page.locator('#loginError').innerText(),/already has an account/);
 await page.screenshot({path:'.codex-artifacts/agents-create-account.png'});
 await page.evaluate(()=>window.__authError='');await page.locator('#authSubmit').click();await page.locator('#login').waitFor({state:'hidden'});assert.equal(await page.locator('#account').innerText(),'Sign out');assert.equal(await page.locator('#password').inputValue(),'');assert.equal(await page.locator('#confirmPassword').inputValue(),'');
 await page.locator('#account').click();await page.locator('#account').click();await page.locator('#authSwitch').click();assert(await page.locator('#confirmPasswordLabel').isHidden());await page.locator('#password').fill('test-password');await page.locator('#authSubmit').click();await page.locator('#login').waitFor({state:'hidden'});assert(await page.evaluate(()=>window.__signin));assert.deepEqual(errors,[]);
 console.log('PASS account creation, mismatched passwords, duplicate email, retry, password clearing and existing-account sign-in');
}finally{await workspace.close();}
