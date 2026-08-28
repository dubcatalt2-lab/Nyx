(()=>{
  'use strict';
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const refs={
    status:$('[data-status]'),notice:$('[data-notice]'),list:$('[data-key-list]'),create:$('[data-create]'),dialog:$('[data-dialog]'),form:$('[data-key-form]'),label:$('[data-label]'),confirm:$('[data-create-confirm]'),revealDialog:$('[data-reveal-dialog]'),reveal:$('[data-reveal]'),toggleReveal:$('[data-toggle-reveal]'),copy:$('[data-copy]'),limits:$('[data-limits]'),unavailableDialog:$('[data-unavailable-dialog]'),createReplacement:$('[data-create-replacement]'),
    title:$('#page-title'),subtitle:$('[data-page-subtitle]'),tabs:$$('[data-tab]'),panels:$$('[data-panel]'),tokenUsage:$('[data-token-usage]'),tokenLimit:$('[data-token-limit]'),tokenMeter:$('[data-token-meter]'),requestUsage:$('[data-request-usage]'),requestLimit:$('[data-request-limit]'),requestMeter:$('[data-request-meter]'),plan:$('[data-plan]'),reset:$('[data-reset]'),usageRows:$('[data-usage-rows]'),refreshUsage:$('[data-refresh-usage]'),
    playgroundForm:$('[data-playground-form]'),playgroundKey:$('[data-playground-key]'),togglePlaygroundKey:$('[data-toggle-playground-key]'),keyHint:$('[data-key-hint]'),model:$('[data-playground-model]'),prompt:$('[data-playground-prompt]'),tokens:$('[data-playground-tokens]'),temperature:$('[data-playground-temperature]'),send:$('[data-playground-send]'),responseCard:$('[data-response-card]'),response:$('[data-playground-response]'),responseMeta:$('[data-response-meta]'),copyResponse:$('[data-copy-response]')
  };
  const tabCopy={keys:['API Keys','Nyx developer access'],usage:['Usage','Daily gateway activity'],playground:['Playground','Test the Nyx API']};
  const revealStoragePrefix='nyx.api-key-reveal.';
  let accountToken='';
  let configured=false;
  let allKeys=[];
  let usageLoaded=false;
  let modelsLoaded=false;

  function applyTheme(){try{const theme=localStorage.getItem('nyx.theme')||'default';if(theme!=='default')document.body.classList.add(`theme-${theme}`)}catch{}}
  function notice(message,type=''){refs.notice.textContent=message;refs.notice.className=`notice page-notice${type?` ${type}`:''}`;refs.notice.hidden=!message}
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
  function openCreate(label=''){if(!configured)return;refs.label.value=label;refs.dialog.showModal();refs.label.focus()}
  function openUnavailable(label){refs.createReplacement.dataset.keyLabel=label;refs.unavailableDialog.showModal()}
  async function copyText(value){try{await navigator.clipboard.writeText(value);return true}catch{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const copied=document.execCommand('copy');area.remove();return copied}}
  function formatTime(value){if(!value)return 'Never used';const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toLocaleString():'Never used'}
  function number(value){return Math.max(0,Number(value)||0).toLocaleString()}
  function knownPlaygroundKey(){for(const key of allKeys){const full=storedReveal(key.id);if(full)return {key:full,label:key.label}}return null}
  function syncPlaygroundKey(){if(refs.playgroundKey.value)return;const saved=knownPlaygroundKey();if(saved){refs.playgroundKey.value=saved.key;refs.keyHint.textContent=`Using ${saved.label}, available in this browser tab.`}}
  async function revokeKey(key){
    if(!confirm(`Revoke ${key.label}? Apps using it will stop immediately.`))return false;
    await api(`/api/nyx-api-keys/${encodeURIComponent(key.id)}`,{method:'DELETE'});forgetReveal(key.id);allKeys=allKeys.filter(item=>item.id!==key.id);renderKeys(allKeys);usageLoaded=false;notice('Key revoked and removed from your active keys.');return true;
  }
  function renderKeys(keys=[]){
    allKeys=keys;
    refs.list.replaceChildren();
    if(!keys.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No API keys yet. Create one for your app or environment.';refs.list.append(empty);return}
    keys.forEach(key=>{
      const row=document.createElement('article');row.className='key-row';
      const details=document.createElement('div');
      const label=document.createElement('strong');label.textContent=key.label;
      const prefix=document.createElement('code');prefix.textContent=`${key.prefix}••••••••`;
      const used=document.createElement('small');used.textContent=`Last used: ${formatTime(key.lastUsedAt)}`;
      details.append(label,prefix,used);
      const actions=document.createElement('div');actions.className='key-actions';
      const savedKey=storedReveal(key.id);
      const view=document.createElement('button');view.type='button';view.className='secondary-action';view.textContent='View / copy';view.addEventListener('click',()=>savedKey?openReveal(savedKey):openUnavailable(key.label));actions.append(view);
      const copy=document.createElement('button');copy.type='button';copy.className='secondary-action';copy.textContent=savedKey?'Copy key':'Copy prefix';copy.addEventListener('click',async()=>{const copied=await copyText(savedKey||key.prefix);if(copied){copy.textContent='Copied';notice(savedKey?'Full key copied to your clipboard.':'Only the non-secret key prefix was copied. Create a replacement to get a full key.');setTimeout(()=>copy.textContent=savedKey?'Copy key':'Copy prefix',1200)}});actions.append(copy);
      const revoke=document.createElement('button');revoke.type='button';revoke.className='danger-action';revoke.textContent='Revoke';revoke.addEventListener('click',async()=>{revoke.disabled=true;try{if(!await revokeKey(key))revoke.disabled=false}catch(error){notice(error.message,'error');revoke.disabled=false}});actions.append(revoke);
      row.append(details,actions);refs.list.append(row);
    });
    syncPlaygroundKey();
  }
  async function loadKeys(){try{const result=await api('/api/nyx-api-keys');renderKeys(result.keys||[])}catch(error){renderKeys([]);notice(error.message,'error')}}
  function renderUsage(data){
    const tokenLimit=data.tokens?.unlimited?'Unlimited':number(data.tokens?.limit);
    refs.tokenUsage.textContent=data.tokens?.unlimited?number(data.tokens?.used):`${number(data.tokens?.used)} / ${tokenLimit}`;
    refs.tokenLimit.textContent=data.tokens?.unlimited?'No daily generated-token limit':`${number(data.tokens?.remaining)} tokens remaining today`;
    refs.tokenMeter.style.width=data.tokens?.unlimited?'0%':`${Math.min(100,(Number(data.tokens?.used)||0)/Math.max(1,Number(data.tokens?.limit)||1)*100)}%`;
    const requestCapacity=(Number(data.requests?.limitPerKey)||0)*(Number(data.requests?.activeKeys)||0);
    refs.requestUsage.textContent=requestCapacity?`${number(data.requests?.used)} / ${number(requestCapacity)}`:number(data.requests?.used);
    refs.requestLimit.textContent=`${number(data.requests?.limitPerKey)} requests per active key per day`;
    refs.requestMeter.style.width=requestCapacity?`${Math.min(100,(Number(data.requests?.used)||0)/requestCapacity*100)}%`:'0%';
    refs.plan.textContent=data.plan||'Regular';
    const resetTime=Date.parse(data.resetsAt);refs.reset.textContent=Number.isFinite(resetTime)?`Resets ${new Date(resetTime).toLocaleString()}`:'Resets daily at 00:00 UTC';
    refs.usageRows.replaceChildren();
    if(!data.keys?.length){const row=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=5;cell.className='empty';cell.textContent='No active keys yet. Create one on the API Keys page.';row.append(cell);refs.usageRows.append(row);return}
    data.keys.forEach(key=>{
      const row=document.createElement('tr');
      const name=document.createElement('td');const strong=document.createElement('strong');strong.textContent=key.label;const code=document.createElement('code');code.textContent=`${key.prefix}••••`;name.append(strong,code);
      const requests=document.createElement('td');requests.textContent=`${number(key.requests)} / ${number(key.requestLimit)}`;
      const remaining=document.createElement('td');remaining.textContent=number(key.remainingRequests);
      const lastUsed=document.createElement('td');lastUsed.textContent=formatTime(key.lastUsedAt);
      const action=document.createElement('td');const revoke=document.createElement('button');revoke.type='button';revoke.className='danger-action';revoke.textContent='Revoke';revoke.addEventListener('click',async()=>{revoke.disabled=true;try{if(await revokeKey(key))await loadUsage()}catch(error){notice(error.message,'error');revoke.disabled=false}});action.append(revoke);
      row.append(name,requests,remaining,lastUsed,action);refs.usageRows.append(row);
    });
  }
  async function loadUsage(){
    refs.refreshUsage.disabled=true;refs.refreshUsage.textContent='Refreshing...';
    try{const data=await api('/api/nyx-api-keys/usage');renderUsage(data);usageLoaded=true;notice('')}
    catch(error){notice(error.message,'error')}
    finally{refs.refreshUsage.disabled=false;refs.refreshUsage.textContent='Refresh'}
  }
  async function loadModels(){
    if(modelsLoaded)return;
    refs.model.disabled=true;
    try{
      const response=await fetch('/api/v1/ai',{headers:{Accept:'application/json'},cache:'no-store'});const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||`Models could not be loaded (${response.status}).`);
      const models=Array.isArray(data.models)?data.models:[];refs.model.replaceChildren();
      if(!models.length){const option=document.createElement('option');option.value='';option.textContent='No chat models available';refs.model.append(option);throw new Error('The Nyx API gateway has no available chat models.');}
      models.forEach((model,index)=>{const option=document.createElement('option');option.value=model;option.textContent=model;option.selected=index===0;refs.model.append(option)});modelsLoaded=true;
    }catch(error){notice(error.message,'error')}
    finally{refs.model.disabled=false}
  }
  async function showTab(name,{updateHash=true}={}){
    if(!tabCopy[name])name='keys';
    refs.tabs.forEach(button=>button.setAttribute('aria-selected',String(button.dataset.tab===name)));
    refs.panels.forEach(panel=>panel.hidden=panel.dataset.panel!==name);
    refs.title.textContent=tabCopy[name][0];refs.subtitle.textContent=tabCopy[name][1];notice('');
    if(updateHash&&location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);
    if(name==='usage'&&!usageLoaded)await loadUsage();
    if(name==='playground'){syncPlaygroundKey();await loadModels()}
  }
  async function load(){
    try{
      const info=await api('/api/nyx-api-keys/status');configured=info.configured===true;
      status(configured,configured?'Groq gateway ready':'Gateway setup required');refs.create.disabled=!configured;
      const tokenAllowance=info.unlimitedTokens?'Unlimited generated tokens/day for your Premium or Owner account.':`${number(info.regularDailyTokens)} generated tokens/day for regular accounts.`;
      refs.limits.textContent=configured?`${number(info.dailyRequests)} requests/day · ${number(info.minuteRequests)} requests/minute · up to ${number(info.maxTokens)} output tokens/request. ${tokenAllowance}`:'The service owner must set the server-only Groq credential before keys can be created.';
      if(!configured)notice('The Nyx API gateway is not configured yet. Your account and existing keys remain private.','error');
      await loadKeys();
    }catch(error){status(false,'Sign-in required');refs.create.disabled=true;renderKeys([]);notice(error.message,'error')}
  }
  refs.tabs.forEach(button=>button.addEventListener('click',()=>void showTab(button.dataset.tab)));
  refs.create.addEventListener('click',()=>openCreate());
  refs.createReplacement.addEventListener('click',()=>{const label=String(refs.createReplacement.dataset.keyLabel||'').trim();refs.unavailableDialog.close();openCreate(label?`${label} replacement`:'Replacement key')});
  refs.form.addEventListener('submit',async event=>{
    if(event.submitter?.value==='cancel')return;
    event.preventDefault();const label=refs.label.value.trim();if(label.length<2){refs.label.focus();return}
    refs.confirm.disabled=true;refs.confirm.textContent='Creating...';
    try{const result=await api('/api/nyx-api-keys',{method:'POST',body:JSON.stringify({label})});if(!result.key)throw new Error('Nyx could not reveal the new key. Create a new key and copy it immediately.');rememberReveal(result.apiKey?.id,result.key);refs.dialog.close();openReveal(result.key);usageLoaded=false;await loadKeys()}catch(error){notice(error.message,'error')}finally{refs.confirm.disabled=false;refs.confirm.textContent='Create key'}
  });
  refs.toggleReveal.addEventListener('click',()=>{const show=refs.reveal.type==='password';refs.reveal.type=show?'text':'password';refs.toggleReveal.setAttribute('aria-pressed',String(show));refs.toggleReveal.textContent=show?'Hide key':'Show key';refs.reveal.focus()});
  refs.copy.addEventListener('click',async()=>{if(await copyText(refs.reveal.value)){refs.copy.textContent='Copied';setTimeout(()=>refs.copy.textContent='Copy key',1200)}});
  refs.revealDialog.addEventListener('close',()=>{refs.reveal.value='';refs.reveal.type='password';refs.toggleReveal.setAttribute('aria-pressed','false');refs.toggleReveal.textContent='Show key'});
  refs.refreshUsage.addEventListener('click',()=>void loadUsage());
  refs.togglePlaygroundKey.addEventListener('click',()=>{const show=refs.playgroundKey.type==='password';refs.playgroundKey.type=show?'text':'password';refs.togglePlaygroundKey.setAttribute('aria-pressed',String(show));refs.togglePlaygroundKey.textContent=show?'Hide':'Show';refs.playgroundKey.focus()});
  refs.playgroundForm.addEventListener('submit',async event=>{
    event.preventDefault();const key=refs.playgroundKey.value.trim();const prompt=refs.prompt.value.trim();if(!key||!prompt||!refs.model.value)return;
    refs.send.disabled=true;refs.send.textContent='Sending...';refs.responseCard.hidden=false;refs.response.textContent='Waiting for the model...';refs.responseMeta.textContent='';const started=performance.now();
    try{
      const response=await fetch('/api/v1/ai',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:refs.model.value,messages:[{role:'user',content:prompt}],max_tokens:Number(refs.tokens.value)||400,temperature:Number(refs.temperature.value)||0})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error?.message||data.error||`Request failed (${response.status})`);
      const content=data.choices?.[0]?.message?.content;refs.response.textContent=typeof content==='string'&&content.trim()?content:'The model returned no visible text.';
      const elapsed=Math.round(performance.now()-started);const completionTokens=Number(data.usage?.completion_tokens)||0;refs.responseMeta.textContent=`${elapsed.toLocaleString()} ms${completionTokens?` · ${completionTokens.toLocaleString()} output tokens`:''}`;usageLoaded=false;notice('');
    }catch(error){refs.response.textContent=error.message;refs.responseMeta.textContent='Request failed';notice(error.message,'error')}
    finally{refs.send.disabled=false;refs.send.textContent='Send request'}
  });
  refs.copyResponse.addEventListener('click',async()=>{if(await copyText(refs.response.textContent)){refs.copyResponse.textContent='Copied';setTimeout(()=>refs.copyResponse.textContent='Copy',1200)}});
  addEventListener('hashchange',()=>void showTab(location.hash.slice(1),{updateHash:false}));
  applyTheme();void showTab(location.hash.slice(1)||'keys',{updateHash:false});void load();
})();
