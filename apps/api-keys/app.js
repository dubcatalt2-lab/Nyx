(()=>{
  'use strict';
  const $=selector=>document.querySelector(selector);
  const refs={status:$('[data-status]'),notice:$('[data-notice]'),list:$('[data-key-list]'),create:$('[data-create]'),dialog:$('[data-dialog]'),form:$('[data-key-form]'),label:$('[data-label]'),confirm:$('[data-create-confirm]'),revealDialog:$('[data-reveal-dialog]'),reveal:$('[data-reveal]'),toggleReveal:$('[data-toggle-reveal]'),copy:$('[data-copy]'),limits:$('[data-limits]')};
  let accountToken='';
  let configured=false;
  const revealStoragePrefix='nyx.api-key-reveal.';

  function applyTheme(){try{const theme=localStorage.getItem('nyx.theme')||'default';if(theme!=='default')document.body.classList.add(`theme-${theme}`)}catch{}}
  function notice(message,type=''){refs.notice.textContent=message;refs.notice.className=`notice${type?` ${type}`:''}`;refs.notice.hidden=!message}
  function status(online,label){refs.status.classList.toggle('online',online);refs.status.classList.toggle('offline',!online);refs.status.querySelector('span').textContent=label}
  async function parentToken(){
    if(window.parent===window)return '';
    const requestId=`keys-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve=>{
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('message',receive);resolve(String(value||''))};
      const receive=event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='nyx:account-token-response'&&event.data.requestId===requestId)finish(event.data.token)};
      const timer=setTimeout(()=>finish(''),2500);addEventListener('message',receive);parent.postMessage({type:'nyx:account-token-request',requestId},location.origin);
    });
  }
  async function firebaseToken(){
    const token=await parentToken();
    if(token)return token;
    const configResponse=await fetch('/api/founder-profile/auth-config',{cache:'no-store'});
    const config=await configResponse.json();
    if(!config?.enabled||!config?.apiKey||!config?.projectId)return '';
    const [{initializeApp,getApps},{getAuth,setPersistence,browserLocalPersistence}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')
    ]);
    const app=getApps().find(item=>item.name==='nyx-founder-owner')||initializeApp({apiKey:config.apiKey,authDomain:`${config.projectId}.firebaseapp.com`,projectId:config.projectId},'nyx-founder-owner');
    const auth=getAuth(app);try{await setPersistence(auth,browserLocalPersistence)}catch{}
    if(typeof auth.authStateReady==='function')await auth.authStateReady();
    return auth.currentUser?auth.currentUser.getIdToken():'';
  }
  async function api(path,options={}){
    accountToken=await firebaseToken();
    if(!accountToken)throw new Error('Sign in to Nyx to manage API keys.');
    const response=await fetch(path,{...options,headers:{Accept:'application/json',Authorization:`Bearer ${accountToken}`,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},cache:'no-store'});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error||`Request failed (${response.status})`);
    return body;
  }
  function storedReveal(id){try{return sessionStorage.getItem(`${revealStoragePrefix}${id}`)||''}catch{return ''}}
  function rememberReveal(id,key){try{if(id&&key)sessionStorage.setItem(`${revealStoragePrefix}${id}`,key)}catch{}}
  function forgetReveal(id){try{sessionStorage.removeItem(`${revealStoragePrefix}${id}`)}catch{}}
  function openReveal(key){refs.reveal.value=key;refs.reveal.type='password';refs.toggleReveal.setAttribute('aria-pressed','false');refs.toggleReveal.textContent='Show key';refs.revealDialog.showModal();refs.reveal.focus()}
  function formatTime(value){if(!value)return 'Never used';const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toLocaleString():'Never used'}
  function renderKeys(keys=[]){
    refs.list.replaceChildren();
    if(!keys.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No API keys yet. Create one for your app or environment.';refs.list.append(empty);return}
    keys.forEach(key=>{
      const row=document.createElement('article');row.className=`key-row${key.revokedAt?' is-revoked':''}`;
      const details=document.createElement('div');details.innerHTML=`<strong></strong><code></code><small></small>`;details.querySelector('strong').textContent=key.label;details.querySelector('code').textContent=`${key.prefix}••••••••`;details.querySelector('small').textContent=key.revokedAt?`Revoked ${formatTime(key.revokedAt)}`:`Last used: ${formatTime(key.lastUsedAt)}`;
      const actions=document.createElement('div');actions.className='key-actions';
      const savedKey=key.revokedAt?'':storedReveal(key.id);
      if(savedKey){const view=document.createElement('button');view.type='button';view.className='secondary-action';view.textContent='View / copy';view.addEventListener('click',()=>openReveal(savedKey));actions.append(view)}
      const revoke=document.createElement('button');revoke.type='button';revoke.className='danger-action';revoke.textContent=key.revokedAt?'Revoked':'Revoke';revoke.disabled=Boolean(key.revokedAt);revoke.addEventListener('click',async()=>{if(!confirm(`Revoke ${key.label}? Apps using it will stop immediately.`))return;revoke.disabled=true;try{await api(`/api/nyx-api-keys/${encodeURIComponent(key.id)}`,{method:'DELETE'});forgetReveal(key.id);notice('Key revoked and removed from this list.');renderKeys(keys.filter(item=>item.id!==key.id))}catch(error){notice(error.message,'error');revoke.disabled=false}});
      actions.append(revoke);row.append(details,actions);refs.list.append(row);
    });
  }
  async function loadKeys(){try{const result=await api('/api/nyx-api-keys');renderKeys(result.keys||[])}catch(error){renderKeys([]);notice(error.message,'error')}}
  async function load(){
    try{
      const info=await api('/api/nyx-api-keys/status');configured=info.configured===true;
      status(configured,configured?'Groq gateway ready':'Gateway setup required');
      refs.create.disabled=!configured;
      const tokenAllowance=info.unlimitedTokens?'Unlimited generated tokens/day for your Premium or Owner account.':`${Number(info.regularDailyTokens||0).toLocaleString()} generated tokens/day for regular accounts.`;
      refs.limits.textContent=configured?`${info.dailyRequests} requests/day · ${info.minuteRequests} requests/minute · up to ${info.maxTokens} output tokens/request. ${tokenAllowance}`:'The service owner must set the server-only Groq credential before keys can be created.';
      if(!configured)notice('The Nyx API gateway is not configured yet. Your account and existing keys remain private.','error');
      await loadKeys();
    }catch(error){status(false,'Sign-in required');refs.create.disabled=true;renderKeys([]);notice(error.message,'error')}
  }
  refs.create.addEventListener('click',()=>{if(configured){refs.label.value='';refs.dialog.showModal();refs.label.focus()}});
  refs.form.addEventListener('submit',async event=>{
    if(event.submitter?.value==='cancel')return;
    event.preventDefault();const label=refs.label.value.trim();if(label.length<2){refs.label.focus();return}
    refs.confirm.disabled=true;refs.confirm.textContent='Creating…';
    try{const result=await api('/api/nyx-api-keys',{method:'POST',body:JSON.stringify({label})});if(!result.key)throw new Error('Nyx could not reveal the new key. Create a new key and copy it immediately.');rememberReveal(result.apiKey?.id,result.key);refs.dialog.close();openReveal(result.key);await loadKeys()}catch(error){notice(error.message,'error')}finally{refs.confirm.disabled=false;refs.confirm.textContent='Create key'}
  });
  refs.toggleReveal.addEventListener('click',()=>{const show=refs.reveal.type==='password';refs.reveal.type=show?'text':'password';refs.toggleReveal.setAttribute('aria-pressed',String(show));refs.toggleReveal.textContent=show?'Hide key':'Show key';refs.reveal.focus()});
  refs.copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(refs.reveal.value);refs.copy.textContent='Copied';setTimeout(()=>refs.copy.textContent='Copy key',1200)}catch{refs.reveal.select();document.execCommand('copy')}});
  refs.revealDialog.addEventListener('close',()=>{refs.reveal.value='';refs.reveal.type='password';refs.toggleReveal.setAttribute('aria-pressed','false');refs.toggleReveal.textContent='Show key'});
  applyTheme();void load();
})();
