(async()=>{
const $=id=>document.getElementById(id);
let auth,signIn,signOut;
async function openComputers(){
 const token=await auth.currentUser?.getIdToken();
 if(!token)throw Error('Sign in to continue.');
 const response=await fetch('/api/private-remote/session',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(response.status===404?'This account does not have access.':'Connection unavailable. Try again.');
 location.assign('/apps/remote/index.html');
}
async function run(action){
 $('status').textContent='Connecting…';
 document.querySelectorAll('button').forEach(button=>button.disabled=true);
 try{await action();}catch(error){$('status').textContent=error.code?.startsWith('auth/')?'Sign-in failed. Check your account details and connection.':error.message;}
 finally{$('password').value='';document.querySelectorAll('button').forEach(button=>button.disabled=false);}
}
$('login').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{await signIn(auth,$('email').value.trim(),$('password').value);await openComputers();});});
$('open').onclick=()=>run(openComputers);
$('signOut').onclick=()=>run(async()=>{await signOut(auth);$('status').textContent='Signed out.';});
try{
 const response=await fetch('/api/founder-profile/auth-config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Account service unavailable. Reload to try again.');
 const config=await response.json();if(!config.enabled)throw Error('Account sign-in is unavailable.');
 const [appModule,module]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
 const app=appModule.getApps().find(item=>item.name==='nyx-founder-owner')||appModule.initializeApp({apiKey:config.apiKey,authDomain:config.projectId+'.firebaseapp.com',projectId:config.projectId},'nyx-founder-owner');
 auth=module.getAuth(app);signIn=module.signInWithEmailAndPassword;signOut=module.signOut;
 await module.setPersistence(auth,module.browserLocalPersistence);
 module.onAuthStateChanged(auth,user=>{$('login').hidden=!!user;$('signedIn').hidden=!user;$('account').textContent=user?.email||'';$('status').textContent='';$('submit').disabled=false;});
}catch(error){$('status').textContent=error.message;}
})();
